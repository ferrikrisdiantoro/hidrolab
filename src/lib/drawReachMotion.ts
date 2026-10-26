import { C, W } from "./theme.ts";
import { pen } from "./plate.ts";
import { createPool, hash01, relane, tracePolygon, type Pool } from "./motion.ts";
import type { PlateOut } from "./plateOut.ts";
import { rollerAt, rollerIcon, type ReachPoint } from "./drawReach.ts";

/**
 * LAPIS GERAK POTONGAN MEMANJANG (drawReach) — batch B6.
 *
 * Aturan yang mengikat berkas ini sama dengan OC-01 dan B5a:
 * - Laju partikel = kecepatan rata-rata penampang V = Q / A dari MODEL
 *   lembarnya, disisipkan linier di antara stasiun yang dihitung model.
 *   Tidak ada laju karangan. Uji: drawReachMotion.test.ts.
 * - Lintasan: partikel menyimpan kedalaman relatif η = (z − z_dasar) / d
 *   yang tetap sepanjang jalannya. Itu garis arus aliran berubah lambat
 *   yang memenuhi kontinuitas (sama dengan OC-01), jadi partikel naik dan
 *   turun mengikuti muka air dan tidak pernah keluar dari badan air.
 * - Debit yang bertambah sepanjang alur (aliran masuk lateral, saluran
 *   samping): partikel lahir di hulu dengan peluang Q(hulu)/Q(hilir), dan
 *   sisanya lahir merata di sepanjang alur. Jumlah partikel yang lewat
 *   penampang x per detik karena itu sebanding dengan Q(x) = Q₀ + q*·x,
 *   dan tiap partikel mewakili volume air yang sama.
 * - Waktu: bentang ratusan meter dengan V beberapa m/s butuh menit untuk
 *   dilalui, jadi waktunya dipercepat ×N (deret 1-2-5) supaya satu lintasan
 *   memakan 6 sampai 15 detik layar. Lembar wajib menulis "×N".
 * - Tanpa alokasi per frame: kolam partikel larik bertipe; Path2D badan air
 *   dan letak gulungan dihitung ulang hanya saat PlateOut berganti.
 */

/** Stasiun aliran dari model, berurutan dari hulu. */
export type ReachStation = {
  /** Jarak dari ujung hulu gambar, m */
  x: number;
  /** Elevasi dasar, m */
  zb: number;
  /** Elevasi muka air, m */
  zs: number;
  /** Kecepatan rata-rata penampang dari model, m/s */
  V: number;
  /** Debit di penampang, m³/s; bawaan tetap (tanpa aliran masuk) */
  Q?: number;
  /** Elevasi garis energi, m; bila ada, lapis gerak menjalankan tanda energi */
  egl?: number;
};

export type ReachFlow = {
  n: number;
  x: Float64Array;
  zb: Float64Array;
  zs: Float64Array;
  V: Float64Array;
  Q: Float64Array;
  egl: Float64Array | null;
  /** Kumulatif ∫ d dx dari hulu, m²: sebaran tunak partikel ∝ kedalaman */
  cum: Float64Array;
  /** Peluang lahir di ujung hulu, Q(hulu) / Q(hilir) */
  pInlet: number;
  /**
   * Waktu tinggal rata-rata air di bentang, ∫ A dx / Q(hilir), detik fisik.
   * Debit tetap: sama dengan waktu tempuh hulu ke hilir ∫ dx / V. Debit
   * bertambah dari nol (saluran samping): ∫ dx / V divergen karena V(0) = 0,
   * sedangkan volume / debit keluar tetap terhingga dan itulah umur rata-rata
   * air yang keluar.
   */
  crossTime: number;
  /** Loncatan air: absis dan laju putar gulungan ω = V₁ / y₂, rad/s */
  rollers: { x: number; omega: number }[];
  /** Deret muka air dan dasar untuk letak gulungan (sama dengan gambar) */
  water: ReachPoint[];
  bed: ReachPoint[];
};

/**
 * Menyusun aliran dari stasiun model. Stasiun dengan absis sama (muka
 * loncatan) dibiarkan: penyisipan di sana memilih sisi hilir.
 * `water` dan `bed` = deret yang SAMA dengan yang dikirim ke drawReach.
 */
export function reachFlow(
  st: ReachStation[],
  water: ReachPoint[],
  bed: ReachPoint[],
  rollers: { x: number; omega: number }[] = []
): ReachFlow | null {
  const ok = st.filter(
    (s) => Number.isFinite(s.x) && Number.isFinite(s.zs) && Number.isFinite(s.zb) && Number.isFinite(s.V)
  );
  if (ok.length < 2) return null;
  // Urut stabil menurut x: dua titik muka loncatan tetap berurutan.
  const idx = ok.map((_, i) => i).sort((a, b) => ok[a].x - ok[b].x || a - b);
  const n = idx.length;
  const f: ReachFlow = {
    n,
    x: new Float64Array(n),
    zb: new Float64Array(n),
    zs: new Float64Array(n),
    V: new Float64Array(n),
    Q: new Float64Array(n),
    egl: ok.every((s) => s.egl !== undefined) ? new Float64Array(n) : null,
    cum: new Float64Array(n),
    pInlet: 1,
    crossTime: 0,
    rollers,
    water,
    bed,
  };
  for (let k = 0; k < n; k++) {
    const s = ok[idx[k]];
    f.x[k] = s.x;
    f.zb[k] = s.zb;
    f.zs[k] = Math.max(s.zs, s.zb);
    f.V[k] = Math.max(0, s.V);
    f.Q[k] = s.Q ?? 1;
    if (f.egl) f.egl[k] = s.egl as number;
  }
  if (!(f.x[n - 1] - f.x[0] > 0)) return null;
  // Luas basah A = Q / V di tiap stasiun. Stasiun diam (Q = V = 0, pangkal
  // saluran samping) memakai A stasiun bergerak terdekat.
  const A = new Float64Array(n).fill(NaN);
  for (let k = 0; k < n; k++) if (f.V[k] > 1e-9) A[k] = f.Q[k] / f.V[k];
  for (let k = 0; k < n; k++) {
    if (Number.isFinite(A[k])) continue;
    for (let j = 1; j < n; j++) {
      if (k + j < n && Number.isFinite(A[k + j]) && f.V[k + j] > 1e-9) { A[k] = A[k + j]; break; }
      if (k - j >= 0 && Number.isFinite(A[k - j]) && f.V[k - j] > 1e-9) { A[k] = A[k - j]; break; }
    }
  }
  let vol = 0;
  for (let k = 1; k < n; k++) {
    const dx = f.x[k] - f.x[k - 1];
    const d0 = f.zs[k - 1] - f.zb[k - 1];
    const d1 = f.zs[k] - f.zb[k];
    f.cum[k] = f.cum[k - 1] + ((d0 + d1) / 2) * dx;
    vol += ((A[k - 1] + A[k]) / 2) * dx;
  }
  const qOut = f.Q[n - 1];
  f.crossTime = qOut > 0 && Number.isFinite(vol) ? vol / qOut : Infinity;
  const qa = f.Q[0];
  const qb = f.Q[n - 1];
  f.pInlet = qb > 0 ? Math.min(1, Math.max(0, qa / qb)) : 1;
  return f;
}

/** Indeks ruas k (x[k] ≤ x ≤ x[k+1]); pada muka loncatan memilih sisi hilir. */
function ruas(f: ReachFlow, x: number): number {
  let lo = 0;
  let hi = f.n - 1;
  if (x <= f.x[0]) return 0;
  if (x >= f.x[hi]) return hi - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (f.x[m] <= x) lo = m;
    else hi = m;
  }
  return lo;
}

/** Nilai larik a pada absis x, disisipkan linier. */
export function along(f: ReachFlow, a: Float64Array, x: number): number {
  const k = ruas(f, x);
  const x0 = f.x[k];
  const x1 = f.x[k + 1];
  const t = x1 - x0 > 1e-12 ? Math.min(1, Math.max(0, (x - x0) / (x1 - x0))) : 1;
  return a[k] + (a[k + 1] - a[k]) * t;
}

/** Kecepatan partikel pada absis x, m/s: V model disisipkan. */
export function velocityAt(f: ReachFlow, x: number): number {
  return along(f, f.V, x);
}

/**
 * Pengali waktu deret 1-2-5 supaya satu lintasan hulu ke hilir memakan
 * kira-kira 10 detik layar (6 sampai 15 detik). 1 = waktu nyata; di bawah 1
 * = diperlambat.
 */
export function reachTimeScale(crossTime: number, target = 10): number {
  if (!(crossTime > 0) || !Number.isFinite(crossTime)) return 1;
  const raw = crossTime / target;
  const e = Math.floor(Math.log10(raw));
  const m = raw / Math.pow(10, e);
  const nice = m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10;
  return nice * Math.pow(10, e);
}

/** Pajanan goresan, detik LAYAR; dikali timeScale menjadi detik fisik. */
const PAJANAN = 0.3;
/** Goresan terpendek agar partikel lambat tetap tampak, px. */
const GORES_MIN = 2;
/** Tiap partikel ke-k membawa tanda energi di garis energi. */
const TIAP_ENERGI = 7;

/** Putaran gulungan tercepat yang masih dipertahankan, putaran per detik layar. */
export const PUTAR_MAKS = 1;

/** Gulungan ikut berputar pada jam partikel ×timeScale? */
export function rollerSpins(omega: number, timeScale: number): boolean {
  const putaranPerDetik = (Math.abs(omega) * Math.max(timeScale, 0)) / (2 * Math.PI);
  return Number.isFinite(putaranPerDetik) && putaranPerDetik <= PUTAR_MAKS;
}

/** Sudut gulungan pada waktu fisik t; 0 (diam) bila terlalu cepat untuk diputar. */
export function rollerPhase(omega: number, t: number, timeScale: number): number {
  return rollerSpins(omega, timeScale) ? omega * t : 0;
}

export type ReachMotion = {
  pool: Pool;
  flow: ReachFlow | null;
  out: PlateOut | null;
  clip: Path2D | null;
  roll: { cx: number; cy: number; r: number; omega: number }[];
};

export function createReachMotion(n = 160): ReachMotion {
  return { pool: createPool(n), flow: null, out: null, clip: null, roll: [] };
}

/** x dari pecahan kumulatif u (0..1) kedalaman: sebaran tunak. */
function xDariKumulatif(f: ReachFlow, u: number): number {
  const total = f.cum[f.n - 1];
  if (!(total > 0)) return f.x[0] + u * (f.x[f.n - 1] - f.x[0]);
  const c = u * total;
  let lo = 0;
  let hi = f.n - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (f.cum[m] <= c) lo = m;
    else hi = m;
  }
  const dc = f.cum[hi] - f.cum[lo];
  const t = dc > 0 ? (c - f.cum[lo]) / dc : 0;
  return f.x[lo] + (f.x[hi] - f.x[lo]) * t;
}

/**
 * Sebar ulang seluruh partikel pada sebaran tunak aliran baru. Jumlah
 * partikel per meter sebanding dengan luas basah (Q/V = A), jadi lembar
 * yang baru dibuka langsung tampak tunak, tidak menunggu satu lintasan.
 */
export function scatterReach(p: Pool, f: ReachFlow): void {
  for (let i = 0; i < p.n; i++) {
    p.x[i] = xDariKumulatif(f, (i + 0.5) / p.n);
    p.y[i] = 0.06 + p.seed[i] * 0.88;
    p.age[i] = 0;
  }
}

/** Lahir ulang: di hulu dengan peluang pInlet, selain itu merata di alur. */
export function respawnReach(p: Pool, i: number, f: ReachFlow): void {
  const s = relane(p, i);
  p.y[i] = 0.06 + s * 0.88;
  const g = p.gen[i];
  const pilih = hash01(i + 0x2f1, g);
  if (pilih < f.pInlet) p.x[i] = f.x[0];
  else p.x[i] = f.x[0] + hash01(i + 0x5a7, g) * (f.x[f.n - 1] - f.x[0]);
  p.age[i] = 0;
}

/** Memajukan partikel satu langkah: x += V(x)·dt, waktu fisik. */
export function advanceReach(p: Pool, f: ReachFlow, dt: number): void {
  const xEnd = f.x[f.n - 1];
  for (let i = 0; i < p.n; i++) {
    const V = velocityAt(f, p.x[i]);
    p.u[i] = V;
    const nx = p.x[i] + V * dt;
    p.age[i] += dt;
    if (!(nx <= xEnd)) respawnReach(p, i, f);
    else p.x[i] = nx;
  }
}

/**
 * Satu frame lapis gerak potongan memanjang.
 * - Goresan biru di badan air: kepala di posisi partikel, ekor di posisi
 *   PAJANAN detik layar sebelumnya sepanjang garis arus η yang sama.
 * - Tanda energi (bila flow.egl): partikel ke-7 membawa goresan merah bata
 *   di garis energi pada absis yang sama, karena tinggi energi adalah milik
 *   air yang sedang lewat di situ. Lajunya laju air, bukan laju hias.
 * - Gulungan loncatan berputar ω = V₁/y₂ pada JAM YANG SAMA dengan partikel
 *   (t fisik, dipercepat ×N), jadi lembar cukup menulis satu jam. Bila
 *   putaran yang dihasilkan melebihi PUTAR_MAKS putaran per detik layar,
 *   gulungan digambar diam: lebih cepat dari itu ia terbaca diam atau mundur
 *   (stroboskop), dan gerak palsu lebih buruk daripada tanda diam.
 */
export function drawReachMotion(
  ctx: CanvasRenderingContext2D,
  t: number,
  dt: number,
  out: PlateOut | null,
  flow: ReachFlow | null,
  timeScale: number,
  st: ReachMotion
): void {
  if (!out || !flow) return;
  const pool = st.pool;
  if (st.flow !== flow) {
    st.flow = flow;
    scatterReach(pool, flow);
    st.out = null;
  }
  if (st.out !== out) {
    st.out = out;
    st.clip = null;
    if (typeof Path2D !== "undefined" && out.water && out.water.length >= 6) {
      const c = new Path2D();
      const w = out.water;
      for (let k = 0; k + 1 < w.length; k += 2) {
        if (k === 0) c.moveTo(w[k], w[k + 1]);
        else c.lineTo(w[k], w[k + 1]);
      }
      c.closePath();
      st.clip = c;
    }
    st.roll = [];
    for (const r of flow.rollers) {
      const m = rollerAt(r.x, out.map.X, out.map.Y, flow.water, flow.bed);
      if (m) st.roll.push({ ...m, omega: r.omega });
    }
  }

  advanceReach(pool, flow, dt);

  const { X, Y, frame } = out.map;
  const tau = PAJANAN * timeScale;
  const x0 = flow.x[0];

  ctx.save();
  ctx.beginPath();
  ctx.rect(frame.x0, frame.y0, frame.x1 - frame.x0, frame.y1 - frame.y0);
  ctx.clip();
  if (st.clip) ctx.clip(st.clip);
  else if (out.water) {
    tracePolygon(ctx, out.water);
    ctx.clip();
  }

  pen(ctx, W.hair, C.water);
  ctx.lineCap = "butt";
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  for (let i = 0; i < pool.n; i++) {
    const x = pool.x[i];
    const eta = pool.y[i];
    const zb = along(flow, flow.zb, x);
    const d = along(flow, flow.zs, x) - zb;
    const hx = X(x);
    const hy = Y(zb + eta * d);
    let xt = x - pool.u[i] * tau;
    if (xt < x0) xt = x0;
    const zbt = along(flow, flow.zb, xt);
    const dt2 = along(flow, flow.zs, xt) - zbt;
    let tx = X(xt);
    let ty = Y(zbt + eta * dt2);
    const len = Math.hypot(hx - tx, hy - ty);
    if (len < GORES_MIN) {
      tx = hx - GORES_MIN;
      ty = hy;
    }
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
  }
  ctx.stroke();

  // Gulungan loncatan, jam yang sama dengan partikel (t fisik).
  for (const r of st.roll) rollerIcon(ctx, r.cx, r.cy, r.r, rollerPhase(r.omega, t, timeScale));
  ctx.restore();

  // Tanda energi di garis energi: dipotong ke bingkai saja (garis energi di
  // atas muka air).
  const egl = flow.egl;
  if (egl) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(frame.x0, frame.y0, frame.x1 - frame.x0, frame.y1 - frame.y0);
    ctx.clip();
    pen(ctx, W.thin, C.energy);
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (let i = 0; i < pool.n; i += TIAP_ENERGI) {
      const x = pool.x[i];
      let xt = x - pool.u[i] * tau;
      if (xt < x0) xt = x0;
      const hx = X(x);
      const hy = Y(along(flow, egl, x));
      let tx = X(xt);
      let ty = Y(along(flow, egl, xt));
      if (Math.hypot(hx - tx, hy - ty) < GORES_MIN + 1) {
        tx = hx - GORES_MIN - 1;
        ty = hy;
      }
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
    }
    ctx.stroke();
    ctx.restore();
  }
}
