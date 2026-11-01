import { C, W } from "./theme.ts";
import { createPool, hash01, relane, tracePolygon, type Pool } from "./motion.ts";
import type { PlateMap, PlateOut } from "./plateOut.ts";
import { profilTransisi, type TransitionState } from "./drawTransition.ts";

/**
 * LAPIS GERAK TRANSISI LEBAR (OC-05) — batch B8.
 *
 * Partikel yang sama tampil di dua panel: tampak atas dan potongan
 * memanjang. Tiap partikel menyimpan pecahan bentang f, posisi lateral
 * relatif λ = jarak dari sumbu / (b/2) dan kedalaman relatif η = (z − dasar) / y.
 * λ dan η tetap sepanjang jalannya: itu garis arus aliran satu dimensi yang
 * memenuhi kontinuitas, jadi di penyempitan garis arus tampak atas merapat
 * dan di potongan partikel ikut turun bersama muka air.
 *
 * Laju = V = Q / (b·y) dari MODEL. Di penampang 1 (hulu) dan 2 (hilir) itu
 * persis kecepatan model (uji: drawTransitionMotion.test.ts). Di antara
 * keduanya model tidak menghitung apa pun; lapis gerak memakai kontinuitas
 * pada lebar dan kedalaman yang DIGAMBAR (profilTransisi), jadi partikel
 * tidak pernah lebih cepat atau lebih lambat dari badan air tergambar.
 *
 * Panjang. Sumbu mendatar gambar ini pecahan bentang, bukan meter. Lapis
 * gerak membaca tampak atas sebagai denah BERSKALA SAMA ke dua arah:
 * panjang bentang tergambar L = lebar plot / (piksel per meter lateral).
 * Kecepatan di layar karena itu V × piksel per meter, sama ke dua arah.
 *
 * Tanpa alokasi per frame: kolam larik bertipe dibuat sekali; Path2D badan
 * air dibuat ulang hanya saat PlateOut berganti. Aliran tersendat tidak
 * diberi aliran (transitionFlow mengembalikan null): kedalaman yang
 * tergambar bukan kedalaman yang terjadi.
 */

export type TransitionFlow = {
  /** Debit, m³/s */
  Q: number;
  /** Panjang bentang tergambar, m per satuan pecahan bentang */
  L: number;
  /** Kecepatan hulu V₁ = Q/(b₁·y₁), acuan warna tingkat laju */
  V1: number;
  /** Kecepatan hilir V₂ = Q/(b₂·y₂) */
  V2: number;
  /** Waktu tempuh hulu ke hilir ∫ L df / V, detik fisik */
  crossTime: number;
  /** Stasiun pecahan untuk sebaran awal */
  f: Float64Array;
  /** Kumulatif ∫ b·y df: sebaran tunak partikel ∝ luas basah */
  cum: Float64Array;
  bedAt: (f: number) => number;
  depthAt: (f: number) => number;
  bAt: (f: number) => number;
};

const N_STASIUN = 161;

/**
 * Aliran untuk lapis gerak, atau null bila tidak berlaku (tersendat,
 * nilai tak hingga). `Q` debit, `L` panjang bentang tergambar (m).
 */
export function transitionFlow(s: TransitionState, Q: number, L: number): TransitionFlow | null {
  if (s.r.choked) return null;
  if (!(Q > 0) || !(L > 0) || !Number.isFinite(L)) return null;
  const p = profilTransisi(s);
  const f = new Float64Array(N_STASIUN);
  const cum = new Float64Array(N_STASIUN);
  let waktu = 0;
  let Aprev = NaN;
  let Vprev = NaN;
  for (let k = 0; k < N_STASIUN; k++) {
    const fk = k / (N_STASIUN - 1);
    f[k] = fk;
    const A = p.bAt(fk) * p.depthAt(fk);
    const V = Q / A;
    if (!(A > 0) || !Number.isFinite(V)) return null;
    if (k > 0) {
      const df = fk - f[k - 1];
      cum[k] = cum[k - 1] + ((Aprev + A) / 2) * df;
      waktu += ((1 / Vprev + 1 / V) / 2) * df * L;
    }
    Aprev = A;
    Vprev = V;
  }
  return {
    Q,
    L,
    V1: Q / (s.b1 * p.depthAt(0)),
    V2: Q / (s.b2 * p.depthAt(1)),
    crossTime: waktu,
    f,
    cum,
    bedAt: p.bedAt,
    depthAt: p.depthAt,
    bAt: p.bAt,
  };
}

/** Kecepatan rata-rata penampang pada pecahan f, m/s: Q / (b·y). */
export function transitionVelocity(flow: TransitionFlow, f: number): number {
  return flow.Q / (flow.bAt(f) * flow.depthAt(f));
}

/**
 * Panjang bentang tergambar (m) dari peta tampak atas: lebar plot dibagi
 * piksel per meter lateral. null bila panel tampak atas tidak ada.
 */
export function panjangDenah(out: PlateOut | null): number | null {
  const m = out?.maps?.plan;
  if (!m) return null;
  const pxPerM = m.Y(0) - m.Y(1);
  const lebar = m.X(1) - m.X(0);
  return pxPerM > 0 && lebar > 0 ? lebar / pxPerM : null;
}

/** Banyak tingkat warna laju; tingkat tengah = V₁. */
export const TINGKAT_N = 5;
/** Rasio laju antar tingkat. */
export const TINGKAT_RASIO = 1.2;

/** Tingkat warna (0..4) untuk laju V terhadap V₁: 2 + bulat(log₁,₂(V/V₁)). */
export function tingkatLaju(V: number, V1: number): number {
  if (!(V > 0) || !(V1 > 0)) return 2;
  const k = 2 + Math.round(Math.log(V / V1) / Math.log(TINGKAT_RASIO));
  return k < 0 ? 0 : k > TINGKAT_N - 1 ? TINGKAT_N - 1 : k;
}

const WARNA_TINGKAT = [C.waterSlower, C.waterSlow, C.water, C.waterFast, C.waterFaster];

export type TransitionMotion = {
  /** x = pecahan bentang f, y = posisi lateral relatif λ (−1..1) */
  pool: Pool;
  /** Kedalaman relatif η (0..1) */
  eta: Float32Array;
  /** Tingkat warna laju per partikel, frame ini */
  tier: Uint8Array;
  flow: TransitionFlow | null;
  out: PlateOut | null;
  clipLong: Path2D | null;
  clipPlan: Path2D | null;
};

export function createTransitionMotion(n = 220): TransitionMotion {
  return {
    pool: createPool(n),
    eta: new Float32Array(n),
    tier: new Uint8Array(n),
    flow: null,
    out: null,
    clipLong: null,
    clipPlan: null,
  };
}

const LAT = 0.92;

/** f dari pecahan kumulatif u (0..1) luas basah. */
function fDariKumulatif(flow: TransitionFlow, u: number): number {
  const n = flow.f.length;
  const c = u * flow.cum[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (flow.cum[m] <= c) lo = m;
    else hi = m;
  }
  const dc = flow.cum[hi] - flow.cum[lo];
  const t = dc > 0 ? (c - flow.cum[lo]) / dc : 0;
  return flow.f[lo] + (flow.f[hi] - flow.f[lo]) * t;
}

/** Sebaran tunak awal: jumlah partikel per df ∝ b·y, posisi melintang dari hash. */
export function scatterTransition(st: TransitionMotion, flow: TransitionFlow): void {
  const p = st.pool;
  for (let i = 0; i < p.n; i++) {
    p.x[i] = fDariKumulatif(flow, (i + 0.5) / p.n);
    p.y[i] = -LAT + p.seed[i] * 2 * LAT;
    st.eta[i] = 0.06 + hash01(i + 0x3c1, 0) * 0.88;
    p.age[i] = 0;
  }
}

/** Lahir ulang di tepi hulu, lajur baru dari hash (tanpa Math.random). */
export function respawnTransition(st: TransitionMotion, i: number): void {
  const p = st.pool;
  const s = relane(p, i);
  p.x[i] = 0;
  p.y[i] = -LAT + s * 2 * LAT;
  st.eta[i] = 0.06 + hash01(i + 0x3c1, p.gen[i]) * 0.88;
  p.age[i] = 0;
}

/** Satu langkah waktu fisik: f += V(f)/L · dt. */
export function advanceTransition(st: TransitionMotion, flow: TransitionFlow, dt: number): void {
  const p = st.pool;
  const invL = 1 / flow.L;
  for (let i = 0; i < p.n; i++) {
    const V = transitionVelocity(flow, p.x[i]);
    p.u[i] = V;
    const nf = p.x[i] + V * invL * dt;
    p.age[i] += dt;
    if (!(nf <= 1)) respawnTransition(st, i);
    else p.x[i] = nf;
  }
}

/** Pajanan goresan, detik LAYAR; dikali timeScale menjadi detik fisik. */
const PAJANAN = 0.3;
const GORES_MIN = 2;

function poligonPath(w: ArrayLike<number> | undefined): Path2D | null {
  if (typeof Path2D === "undefined" || !w || w.length < 6) return null;
  const c = new Path2D();
  for (let k = 0; k + 1 < w.length; k += 2) {
    if (k === 0) c.moveTo(w[k], w[k + 1]);
    else c.lineTo(w[k], w[k + 1]);
  }
  c.closePath();
  return c;
}

function potong(ctx: CanvasRenderingContext2D, m: PlateMap, clip: Path2D | null, poly: ArrayLike<number> | undefined) {
  const f = m.frame;
  ctx.beginPath();
  ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
  ctx.clip();
  if (clip) ctx.clip(clip);
  else if (poly) {
    tracePolygon(ctx, poly);
    ctx.clip();
  }
}

/**
 * Satu frame: goresan biru di tampak atas dan di potongan memanjang, warna =
 * tingkat laju V/V₁ (sama di kedua panel). Kepala goresan di posisi partikel, ekor di
 * posisinya PAJANAN detik layar sebelumnya pada garis arus yang sama.
 */
export function drawTransitionMotion(
  ctx: CanvasRenderingContext2D,
  dt: number,
  out: PlateOut | null,
  flow: TransitionFlow | null,
  timeScale: number,
  st: TransitionMotion
): void {
  const plan = out?.maps?.plan;
  if (!out || !flow || !plan) return;
  const p = st.pool;
  if (st.flow === null) scatterTransition(st, flow);
  // Aliran baru (masukan berubah): partikel tetap di tempatnya; f, λ, η
  // berlaku untuk geometri apa pun, jadi tidak perlu disebar ulang.
  st.flow = flow;
  if (st.out !== out) {
    st.out = out;
    st.clipLong = poligonPath(out.water);
    st.clipPlan = poligonPath(out.waters?.[1]);
  }

  advanceTransition(st, flow, dt);

  const tau = PAJANAN * timeScale;
  const invL = 1 / flow.L;
  for (let i = 0; i < p.n; i++) st.tier[i] = tingkatLaju(p.u[i], flow.V1);

  /* Tampak atas */
  ctx.save();
  potong(ctx, plan, st.clipPlan, out.waters?.[1]);
  ctx.lineWidth = W.thin;
  ctx.lineCap = "butt";
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.7;
  for (let k = 0; k < TINGKAT_N; k++) {
    ctx.strokeStyle = WARNA_TINGKAT[k];
    ctx.beginPath();
    let ada = false;
    for (let i = 0; i < p.n; i++) {
      if (st.tier[i] !== k) continue;
      ada = true;
      const f = p.x[i];
      const lam = p.y[i];
      const hx = plan.X(f);
      const hy = plan.Y((lam * flow.bAt(f)) / 2);
      let ft = f - p.u[i] * invL * tau;
      if (ft < 0) ft = 0;
      let tx = plan.X(ft);
      let ty = plan.Y((lam * flow.bAt(ft)) / 2);
      if (Math.hypot(hx - tx, hy - ty) < GORES_MIN) {
        tx = hx - GORES_MIN;
        ty = hy;
      }
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
    }
    if (ada) ctx.stroke();
  }
  ctx.restore();

  /* Potongan memanjang */
  const m = out.map;
  ctx.save();
  potong(ctx, m, st.clipLong, out.water);
  // Tebal tipis dan warna tingkat yang sama dengan tampak atas: arsiran air
  // potongan ini sudah garis putus mendatar, goresan rambut tenggelam di sana.
  ctx.lineWidth = W.thin;
  ctx.lineCap = "butt";
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.7;
  for (let k = 0; k < TINGKAT_N; k++) {
    ctx.strokeStyle = WARNA_TINGKAT[k];
    ctx.beginPath();
    let ada = false;
    for (let i = 0; i < p.n; i++) {
      if (st.tier[i] !== k) continue;
      ada = true;
      const f = p.x[i];
      const eta = st.eta[i];
      const hx = m.X(f);
      const hy = m.Y(flow.bedAt(f) + eta * flow.depthAt(f));
      let ft = f - p.u[i] * invL * tau;
      if (ft < 0) ft = 0;
      let tx = m.X(ft);
      let ty = m.Y(flow.bedAt(ft) + eta * flow.depthAt(ft));
      if (Math.hypot(hx - tx, hy - ty) < GORES_MIN) {
        tx = hx - GORES_MIN;
        ty = hy;
      }
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
    }
    if (ada) ctx.stroke();
  }
  ctx.restore();
}
