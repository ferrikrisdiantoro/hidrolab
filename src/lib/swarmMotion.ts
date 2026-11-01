import { C, DASH, F, W } from "./theme.ts";
import { niceStep, pen } from "./plate.ts";
import { fmtPlain } from "./hydraulics.ts";
import { hash01 } from "./motion.ts";
import type { PlateMap } from "./plateOut.ts";
import {
  advanceVortices,
  createVortexSystem,
  vortexInvariants,
  vortexTimeStep,
  vortexVelocityAt,
  type PointVortex,
  type VortexInvariants,
  type VortexSystem,
} from "./vorteksTitik.ts";

/**
 * LAPIS GERAK KAWANAN — batch B5b-2 (FP-02 kinematika vorteks, EH-05
 * gerombolan ikan).
 *
 * Aturannya sama dengan lapis gerak lain (OC-01, drawFieldMotion):
 * - Posisi setiap tanda yang bergerak adalah keluaran model lembarnya:
 *   pusaran dari M3 (vorteksTitik.ts), ikan dari M4 (gerombolan.ts).
 *   Tidak ada gerak hias.
 * - `t` dan `dt` yang diterima sudah waktu fisik (usePlate timeScale);
 *   lembar menulis catatan "waktu diperlambat ×N" bila skalanya bukan 1.
 * - Tanpa alokasi per frame: larik bertipe dibuat sekali di keadaan gerak
 *   (useRef di Client); teks yang berubah di-cache dengan kunci angka.
 * - Semua tanda dipotong ke bingkai bidang gambar (PlateOut.map.frame).
 */

function clipFrame(ctx: CanvasRenderingContext2D, map: PlateMap) {
  const f = map.frame;
  ctx.beginPath();
  ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
  ctx.clip();
}

/** Teks yang hanya dibuat ulang bila angkanya berubah. */
type Teks = { kunci: number; teks: string };
function teksAngka(j: Teks, nilai: number, digits: number, awalan: string, satuan: string) {
  const k = Math.round(nilai * Math.pow(10, digits));
  if (k !== j.kunci) {
    j.kunci = k;
    j.teks = `${awalan}${fmtPlain(k / Math.pow(10, digits), digits)}${satuan}`;
  }
  return j.teks;
}

/** Kotak tulisan kecil berlatar kertas di pojok bidang gambar. */
function cornerLabel(
  ctx: CanvasRenderingContext2D,
  map: PlateMap,
  text: string,
  corner: "tl" | "bl" | "br",
  dy = 0
) {
  const f = map.frame;
  ctx.font = F.value;
  ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width;
  const x = corner === "br" ? f.x1 - w - 12 : f.x0 + 4;
  const y = corner === "tl" ? f.y0 + 5 + dy : f.y1 - 21 - dy;
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = C.sheet;
  ctx.fillRect(x, y, w + 8, 16);
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.ink2;
  ctx.textAlign = "left";
  ctx.fillText(text, x + 4, y + 8);
}

/* ================================================================== *
 * FP-02  Kinematika vorteks (M3)
 * ================================================================== */

/**
 * Jejak pusaran yang sudah dihitung: posisi dan kecepatan semua pusaran
 * pada K + 1 saat dari 0 sampai `span` detik. Dihitung sekali per susunan
 * (useMemo), bukan per frame. Lapis gerak membaca posisi pusaran dari sini
 * dengan sisipan Hermite kubik (posisi dan kecepatan kedua ujung selang), jadi pusaran yang terlihat bergerak tepat sama dengan lintasan
 * di lapis statis, dan pemaduan waktu sistem kacau (N ≥ 4) tidak membuat
 * keduanya berpisah.
 */
export type VortexTrack = {
  n: number;
  /** Banyaknya selang; sampel = K + 1 */
  K: number;
  /** Lama pengamatan, s */
  span: number;
  /** Jari-jari inti Rankine yang dipakai, m */
  core: number;
  gamma: Float64Array;
  /** Saat tiap sampel, s, naik dari 0 sampai span */
  t: Float64Array;
  /** Posisi, indeks k·n + i */
  x: Float64Array;
  y: Float64Array;
  /** Kecepatan tiap pusaran pada tiap sampel (medan pusaran lain), m/s */
  u: Float64Array;
  v: Float64Array;
  /** Besaran kekal di awal dan di akhir (Lamb Art. 154, 167) */
  start: VortexInvariants;
  end: VortexInvariants;
  /**
   * Kecepatan sudut pasangan tercepat sepanjang jejak, rad/s (batas atas
   * Lamb Art. 155, (|Γi| + |Γj|)/(2π r²) dengan r ≥ inti)
   */
  maxPairRate: number;
};

/** Sudut putar paling besar antar dua sampel jejak, rad (sama dengan vortexPair). */
const SUDUT_SAMPEL = 0.05;
const K_MIN = 400;
const K_MAKS = 20000;
/**
 * Sudut putar paling besar per langkah RK4, rad. Bawaan M3 0,05; di sini
 * 0,01 supaya galat fase pasangan tercepat (Γ 40/40, d 0,5: 1 018 rad
 * dalam 20 s) tetap di bawah 10⁻⁶ m dan jejaknya berimpit dengan vortexPair.
 */
const SUDUT_RK4 = 0.01;
/**
 * Tiga pusaran atau lebih: bawaan M3 (0,05 rad). Enam pusaran Γ 40 yang
 * berdesakan dalam 1 m butuh 1,6 s dengan 0,01 (diukur), terlalu lama
 * untuk diseret; ΔH yang ditampilkan lembar menunjukkan galatnya.
 */
const SUDUT_RK4_N = 0.05;

/**
 * Menghitung jejak N pusaran selama `span` detik dengan M3
 * (advanceVortices, RK4 berlangkah adaptif, 0,01 rad per langkah untuk
 * dua pusaran, 0,05 untuk tiga atau lebih).
 * Jarak antar sampel dipilih ulang tiap sampel supaya pasangan tercepat
 * SAAT ITU berputar paling banyak 0,05 rad per sampel; pusaran yang
 * berpapasan dekat di tengah pengamatan tetap tersampel rapat. Paling
 * sedikit 400 sampel, paling banyak sekitar 20 000.
 */
export function vortexTrack(
  vortices: PointVortex[],
  span = 20,
  core = 0
): VortexTrack {
  const n = vortices.length;
  const sys = createVortexSystem(vortices, { core });
  const start = vortexInvariants(sys);
  const ts: number[] = [0];
  const xs: number[] = [];
  const ys: number[] = [];
  const us: number[] = [];
  const vs: number[] = [];
  const o = { u: 0, v: 0 };
  /* Kecepatan pusaran i = medan di tempatnya; sumbangan dirinya nol
     (kernel kali jarak nol), jadi sama dengan medan pusaran lain. */
  const simpan = () => {
    for (let i = 0; i < n; i++) {
      xs.push(sys.x[i]);
      ys.push(sys.y[i]);
      vortexVelocityAt(sys, sys.x[i], sys.y[i], o);
      us.push(o.u);
      vs.push(o.v);
    }
  };
  simpan();
  const dtMaks = span / K_MIN;
  const dtMin = span / K_MAKS;
  let wMaks = 0;
  let t = 0;
  while (span - t > 1e-12 * span) {
    const dtw = vortexTimeStep(sys, SUDUT_SAMPEL);
    if (Number.isFinite(dtw)) wMaks = Math.max(wMaks, SUDUT_SAMPEL / dtw);
    let dt = Math.max(dtMin, Math.min(dtMaks, dtw));
    if (dt > span - t) dt = span - t;
    if (n > 1) advanceVortices(sys, dt, n === 2 ? SUDUT_RK4 : SUDUT_RK4_N);
    t += dt;
    ts.push(t);
    simpan();
  }
  ts[ts.length - 1] = span;
  const dtw = vortexTimeStep(sys, SUDUT_SAMPEL);
  if (Number.isFinite(dtw)) wMaks = Math.max(wMaks, SUDUT_SAMPEL / dtw);
  return {
    n,
    K: ts.length - 1,
    span,
    core,
    gamma: Float64Array.from(vortices, (v) => v.gamma),
    t: Float64Array.from(ts),
    x: Float64Array.from(xs),
    y: Float64Array.from(ys),
    u: Float64Array.from(us),
    v: Float64Array.from(vs),
    start,
    end: vortexInvariants(sys),
    maxPairRate: wMaks,
  };
}

/** Lintasan pusaran ke-i sebagai deret titik, untuk lapis statis (mengalokasi). */
export function trackPath(tr: VortexTrack, i: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let k = 0; k <= tr.K; k++) out.push({ x: tr.x[k * tr.n + i], y: tr.y[k * tr.n + i] });
  return out;
}

/** Indeks sampel terakhir dengan saat ≤ t (pencarian biner), 0..K−1. */
export function trackIndexAt(tr: VortexTrack, t: number): number {
  const T = tr.t;
  if (tr.K < 1 || t <= T[0]) return 0;
  if (t >= T[tr.K]) return Math.max(0, tr.K - 1);
  let lo = 0;
  let hi = tr.K;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (T[mid] <= t) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Posisi semua pusaran pada saat t (s, dijepit ke [0, span]) ke outX, outY,
 * sisipan Hermite kubik antar sampel (galat orde empat dalam sudut per
 * selang; sisipan linear memotong busur r·θ²/8 dan menggeser H). Tanpa
 * alokasi.
 */
export function trackPositionAt(
  tr: VortexTrack,
  t: number,
  outX: Float64Array,
  outY: Float64Array
): void {
  const n = tr.n;
  const tt = Math.min(tr.span, Math.max(0, t));
  const k = trackIndexAt(tr, tt);
  const k1 = Math.min(tr.K, k + 1);
  const selang = tr.t[k1] - tr.t[k];
  const s = selang > 0 ? Math.min(1, Math.max(0, (tt - tr.t[k]) / selang)) : 0;
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = (s3 - 2 * s2 + s) * selang;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = (s3 - s2) * selang;
  for (let i = 0; i < n; i++) {
    const a = k * n + i;
    const b = k1 * n + i;
    outX[i] = h00 * tr.x[a] + h10 * tr.u[a] + h01 * tr.x[b] + h11 * tr.u[b];
    outY[i] = h00 * tr.y[a] + h10 * tr.v[a] + h01 * tr.y[b] + h11 * tr.v[b];
  }
}

/**
 * Pengali waktu tampilan FP-02. Waktu nyata (1) bila pasangan tercepat
 * berputar paling banyak setengah putaran tiap detik layar; di atas itu
 * diperlambat per pangkat sepuluh (0,1; 0,01; ...), supaya pusaran tidak
 * berputar lebih dari satu kali tiap detik layar dan putarannya tidak
 * terbaca mundur (alias). Tidak pernah dipercepat: pengamatan 20 detik
 * lembar sudah cukup pendek.
 */
export function vortexTimeScale(maxPairRate: number): number {
  const putaran = maxPairRate / (2 * Math.PI);
  if (!(putaran > 0.5) || !Number.isFinite(putaran)) return 1;
  const k = Math.ceil(Math.log10(putaran / 0.5) - 1e-12);
  return Math.pow(10, -k);
}

/** Jari-jari inti Rankine FP-02, m. Lebih kecil dari jarak terkecil penggeser (0,5 m). */
export const VORTEX_CORE = 0.1;
/** Banyaknya pusaran paling banyak di FP-02 (tiap pasangan dihitung tiap tahap RK4). */
export const VORTEX_MAX = 6;
/** Jarak kisi panah medan, piksel. */
const KISI = 44;

export type VortexMotion = {
  /** Sistem pembaca medan: n = VORTEX_MAX, Γ nol untuk slot kosong */
  sys: VortexSystem;
  /** Posisi pelacak, m */
  px: Float64Array;
  py: Float64Array;
  /** Umur pelacak, s fisik */
  age: Float64Array;
  /** Cincin jejak pelacak, m; indeks i·H + k */
  hx: Float64Array;
  hy: Float64Array;
  H: number;
  hHead: number;
  hCount: number;
  /** Banyaknya lahir ulang per pelacak (benih hash) */
  born: Uint32Array;
  m: number;
  siap: boolean;
  /** Jam putar ulang frame sebelumnya, untuk mengenali awal putaran */
  tauLalu: number;
  /** Kunci jejak yang sedang dipakai; jejak baru = pelacak disebar ulang */
  trackLalu: VortexTrack | null;
  jam: Teks;
  legenda: Teks;
  _u: { u: number; v: number };
};

export function createVortexMotion(m = 140, H = 10): VortexMotion {
  const kosong: PointVortex[] = [];
  for (let i = 0; i < VORTEX_MAX; i++) kosong.push({ x: 0, y: 0, gamma: 0 });
  return {
    sys: createVortexSystem(kosong, { core: VORTEX_CORE }),
    px: new Float64Array(m),
    py: new Float64Array(m),
    age: new Float64Array(m),
    hx: new Float64Array(m * H),
    hy: new Float64Array(m * H),
    H,
    hHead: 0,
    hCount: 0,
    born: new Uint32Array(m),
    m,
    siap: false,
    tauLalu: 0,
    trackLalu: null,
    jam: { kunci: NaN, teks: "" },
    legenda: { kunci: NaN, teks: "" },
    _u: { u: 0, v: 0 },
  };
}

/** Memasang posisi pusaran jejak pada saat t ke sistem pembaca medan. */
export function loadVortices(mo: VortexMotion, tr: VortexTrack, t: number): void {
  const s = mo.sys;
  trackPositionAt(tr, t, s.x, s.y);
  for (let i = 0; i < VORTEX_MAX; i++) s.gamma[i] = i < tr.n ? tr.gamma[i] : 0;
  for (let i = tr.n; i < VORTEX_MAX; i++) {
    s.x[i] = 0;
    s.y[i] = 0;
  }
}

/**
 * Laju penuh panah medan, m/s: laju yang ditimbulkan pusaran terkuat pada
 * jarak dua kisi panah, dibulatkan ke 1, 2, 5 × 10ⁿ. Panah sepanjang penuh
 * berarti laju sama atau lebih besar (dekat inti lajunya naik tanpa batas
 * menurut Γ/(2πr), jadi panjangnya harus dipotong; batasnya ditulis).
 */
export function fieldReferenceSpeed(gammaMax: number, metrePerPx: number): number {
  const u = Math.abs(gammaMax) / (2 * Math.PI * 2 * KISI * metrePerPx);
  if (!(u > 0) || !Number.isFinite(u)) return 0;
  return niceStep(u, 1);
}

/**
 * Medan kecepatan sebagai kisi panah, dari pusaran di mo.sys. Arah = arah
 * medan; panjang sebanding laju sampai uRef, lalu tetap.
 * Dipakai lapis statis (posisi awal) dan lapis gerak (posisi saat ini).
 */
export function drawVortexArrows(
  ctx: CanvasRenderingContext2D,
  map: PlateMap,
  mo: VortexMotion,
  uRef: number
): void {
  if (!(uRef > 0)) return;
  const f = map.frame;
  const nx = Math.max(1, Math.floor((f.x1 - f.x0) / KISI));
  const ny = Math.max(1, Math.floor((f.y1 - f.y0) / KISI));
  const gx = (f.x1 - f.x0) / nx;
  const gy = (f.y1 - f.y0) / ny;
  const penuh = 0.78 * Math.min(gx, gy);
  const sx = map.X(1) - map.X(0);
  const sy = map.Y(1) - map.Y(0);
  const o = mo._u;
  ctx.save();
  clipFrame(ctx, map);
  pen(ctx, W.thin, C.ink3);
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const cx = f.x0 + (i + 0.5) * gx;
      const cy = f.y0 + (j + 0.5) * gy;
      vortexVelocityAt(mo.sys, map.invX(cx), map.invY(cy), o);
      const s = Math.hypot(o.u, o.v);
      if (!(s > 0)) continue;
      const L = penuh * Math.min(1, s / uRef);
      if (L < 1.5) continue;
      /* arah dalam piksel (sumbu y piksel terbalik lewat sy < 0) */
      const dx = o.u * sx;
      const dy = o.v * sy;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d;
      const uy = dy / d;
      const x0 = cx - 0.5 * L * ux;
      const y0 = cy - 0.5 * L * uy;
      const x1 = cx + 0.5 * L * ux;
      const y1 = cy + 0.5 * L * uy;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      const k = Math.min(4, 0.4 * L);
      ctx.moveTo(x1 - k * ux - 0.6 * k * uy, y1 - k * uy + 0.6 * k * ux);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 - k * ux + 0.6 * k * uy, y1 - k * uy - 0.6 * k * ux);
    }
  ctx.stroke();
  ctx.restore();
}

/** Tulisan skala panah di pojok kiri bawah bidang. */
export function drawArrowLegend(
  ctx: CanvasRenderingContext2D,
  map: PlateMap,
  mo: VortexMotion,
  uRef: number,
  prefix: string
): void {
  if (!(uRef > 0)) return;
  const dig = uRef >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(uRef) - 1e-9));
  cornerLabel(ctx, map, teksAngka(mo.legenda, uRef, dig, prefix, " m/s"), "bl");
}

/**
 * Tanda pusaran: lingkaran kecil dan busur berpanah yang menunjukkan arah
 * putarnya (Γ > 0 berlawanan jarum jam). Tanpa busur bila Γ = 0.
 */
export function drawVortexGlyph(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  gamma: number,
  color: string,
  filled: boolean
): void {
  pen(ctx, W.thin, color);
  ctx.beginPath();
  ctx.arc(px, py, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = filled ? color : C.sheet;
  ctx.fill();
  ctx.stroke();
  if (gamma === 0) return;
  /* Busur 260° berjari-jari 10 px. Di layar y ke bawah, jadi berlawanan
     jarum jam = sudut piksel berkurang. */
  const R = 10;
  const ccw = gamma > 0;
  const a0 = ccw ? 0.6 : -0.6;
  const a1 = ccw ? a0 - 4.5 : a0 + 4.5;
  ctx.beginPath();
  ctx.arc(px, py, R, a0, a1, ccw);
  ctx.stroke();
  const ex = px + R * Math.cos(a1);
  const ey = py + R * Math.sin(a1);
  /* singgung arah gerak di ujung busur */
  const tx = ccw ? Math.sin(a1) : -Math.sin(a1);
  const ty = ccw ? -Math.cos(a1) : Math.cos(a1);
  ctx.beginPath();
  ctx.moveTo(ex - 4 * tx - 2.6 * ty, ey - 4 * ty + 2.6 * tx);
  ctx.lineTo(ex, ey);
  ctx.lineTo(ex - 4 * tx + 2.6 * ty, ey - 4 * ty - 2.6 * tx);
  ctx.stroke();
}

function sebarPelacak(mo: VortexMotion, i: number, map: PlateMap) {
  const f = map.frame;
  const b = ++mo.born[i];
  mo.px[i] = map.invX(f.x0 + hash01(i, 2 * b) * (f.x1 - f.x0));
  mo.py[i] = map.invY(f.y0 + hash01(i, 2 * b + 1) * (f.y1 - f.y0));
  mo.age[i] = 0;
  for (let k = 0; k < mo.H; k++) {
    mo.hx[i * mo.H + k] = mo.px[i];
    mo.hy[i * mo.H + k] = mo.py[i];
  }
}

/**
 * Memajukan pelacak sepanjang dt detik fisik di medan pusaran yang sedang
 * terpasang di mo.sys (midpoint RK2, dipecah supaya tiap sublangkah
 * berpindah paling jauh seperempat inti). Tanpa alokasi.
 */
export function advectTracers(mo: VortexMotion, dt: number, uCap: number): void {
  if (!(dt > 0)) return;
  const a = mo.sys.core;
  const nSub = Math.min(8, Math.max(1, Math.ceil((uCap * dt) / (0.25 * Math.max(a, 1e-6)))));
  const h = dt / nSub;
  const o = mo._u;
  for (let i = 0; i < mo.m; i++) {
    let x = mo.px[i];
    let y = mo.py[i];
    for (let s = 0; s < nSub; s++) {
      vortexVelocityAt(mo.sys, x, y, o);
      const xm = x + 0.5 * h * o.u;
      const ym = y + 0.5 * h * o.v;
      vortexVelocityAt(mo.sys, xm, ym, o);
      x += h * o.u;
      y += h * o.v;
    }
    mo.px[i] = x;
    mo.py[i] = y;
    mo.age[i] += dt;
  }
}

export type VortexMotionStyle = {
  /** Warna tiap pusaran menurut urutan */
  colors: readonly string[];
  /** Jenis garis jejak tiap pusaran */
  dashes: readonly (readonly number[])[];
  /** Awalan tulisan jam, misalnya "t = " */
  clockPrefix: string;
  /** Awalan tulisan skala panah, misalnya "panah penuh ≥ " */
  legendPrefix: string;
  /** Laju penuh panah, m/s (fieldReferenceSpeed) */
  uRef: number;
  /** Jeda di ujung pengamatan sebelum diputar ulang, s fisik */
  hold: number;
};

/**
 * Lapis gerak FP-02: medan vektor dan pelacak pada saat τ, jejak pusaran
 * dari 0 sampai τ, dan pusarannya. τ berputar ulang 0 → span, diam
 * selama `hold`, lalu mulai lagi.
 */
export function drawVortexMotion(
  ctx: CanvasRenderingContext2D,
  map: PlateMap,
  t: number,
  dt: number,
  tr: VortexTrack,
  mo: VortexMotion,
  st: VortexMotionStyle
): void {
  const per = tr.span + Math.max(0, st.hold);
  const m = per > 0 ? t % per : 0;
  const tau = Math.min(tr.span, m);
  const ulang = !mo.siap || mo.trackLalu !== tr || m < mo.tauLalu;
  mo.tauLalu = m;
  mo.trackLalu = tr;
  mo.siap = true;
  loadVortices(mo, tr, tau);

  const f = map.frame;
  if (ulang) {
    for (let i = 0; i < mo.m; i++) sebarPelacak(mo, i, map);
    mo.hHead = 0;
    mo.hCount = 0;
  } else if (m <= tr.span) {
    /* laju terbesar yang mungkin = Γ/(2πa) pusaran terkuat di tepi inti */
    let g = 0;
    for (let i = 0; i < tr.n; i++) g = Math.max(g, Math.abs(tr.gamma[i]));
    advectTracers(mo, dt, g / (2 * Math.PI * Math.max(mo.sys.core, 1e-6)));
    /* lahir ulang: keluar bidang, atau umurnya habis (span/5) */
    const umur = tr.span / 5;
    for (let i = 0; i < mo.m; i++) {
      const X = map.X(mo.px[i]);
      const Y = map.Y(mo.py[i]);
      const luar = X < f.x0 - 8 || X > f.x1 + 8 || Y < f.y0 - 8 || Y > f.y1 + 8;
      const tua = mo.age[i] > umur * (0.6 + 0.8 * hash01(i, mo.born[i] + 7));
      if (luar || tua || !Number.isFinite(X) || !Number.isFinite(Y)) sebarPelacak(mo, i, map);
    }
    /* cincin jejak */
    const k = mo.hHead;
    for (let i = 0; i < mo.m; i++) {
      mo.hx[i * mo.H + k] = mo.px[i];
      mo.hy[i * mo.H + k] = mo.py[i];
    }
    mo.hHead = (k + 1) % mo.H;
    if (mo.hCount < mo.H) mo.hCount++;
  }

  ctx.save();
  clipFrame(ctx, map);

  drawVortexArrows(ctx, map, mo, st.uRef);

  /* Pelacak: jejak pendek, lalu titiknya. Jejak putus bila satu langkah
     melompat lebih dari 40 px (lahir ulang). */
  pen(ctx, W.thin, C.water);
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  const H = mo.H;
  const n = mo.hCount;
  for (let i = 0; i < mo.m; i++) {
    let mulai = true;
    let lx = 0;
    let ly = 0;
    for (let q = n - 1; q >= 0; q--) {
      const k = (mo.hHead - 1 - q + 2 * H) % H;
      const X = map.X(mo.hx[i * H + k]);
      const Y = map.Y(mo.hy[i * H + k]);
      if (mulai || Math.abs(X - lx) + Math.abs(Y - ly) > 40) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
      mulai = false;
      lx = X;
      ly = Y;
    }
  }
  ctx.stroke();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = C.water;
  ctx.beginPath();
  for (let i = 0; i < mo.m; i++) {
    const X = map.X(mo.px[i]);
    const Y = map.Y(mo.py[i]);
    ctx.moveTo(X + 1.3, Y);
    ctx.arc(X, Y, 1.3, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.globalAlpha = 1;

  /* Jejak pusaran 0 → τ, dijarangkan sampai paling banyak ~1500 ruas. */
  const kNow = trackIndexAt(tr, tau) + 1;
  const langkah = Math.max(1, Math.ceil(tr.K / 1500));
  for (let i = 0; i < tr.n; i++) {
    pen(ctx, W.bold, st.colors[i] ?? C.ink2, st.dashes[i] ?? DASH.solid);
    ctx.beginPath();
    ctx.moveTo(map.X(tr.x[i]), map.Y(tr.y[i]));
    for (let k = langkah; k < kNow; k += langkah) ctx.lineTo(map.X(tr.x[k * tr.n + i]), map.Y(tr.y[k * tr.n + i]));
    ctx.lineTo(map.X(mo.sys.x[i]), map.Y(mo.sys.y[i]));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (let i = 0; i < tr.n; i++)
    drawVortexGlyph(ctx, map.X(mo.sys.x[i]), map.Y(mo.sys.y[i]), tr.gamma[i], st.colors[i] ?? C.ink2, true);
  ctx.restore();

  const dig = tau < 10 ? 2 : 1;
  cornerLabel(ctx, map, teksAngka(mo.jam, tau, dig, st.clockPrefix, " s"), "bl", 20);
  drawArrowLegend(ctx, map, mo, st.uRef, st.legendPrefix);
}
