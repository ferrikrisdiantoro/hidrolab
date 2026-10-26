import { W } from "./theme.ts";
import { createPool, drawStreaks, hash01, type Pool } from "./motion.ts";
import type { PlateMap } from "./plateOut.ts";

/**
 * LAPIS GERAK PANCARAN DAN TIRAI (batch B7: HS-06, HS-07).
 *
 * Butir air yang meluncur sepanjang lintasan yang SUDAH digambar lapis
 * statis: sisi bawah tirai WES (HS-06) atau sumbu pancaran lubang (HS-07).
 * Penggambar mengisi tabel lintasan (x, z, laju, tebal) dari model yang
 * sama dengan gambarnya; berkas ini hanya menjalankan butirnya.
 *
 * - Laju: ds/dt = laju tabel di titik itu (m/s), jadi waktu tempuh tiap
 *   ruas = panjang ruas / laju rata-rata ruas. Tidak ada gerak hias.
 * - Tiap butir punya fase tetap φ·T (T = waktu tempuh seluruh lintasan);
 *   letaknya pada saat t dibaca dari tabel waktu tempuh, jadi tidak ada
 *   galat Euler yang menumpuk dan butir yang sampai di ujung lahir lagi di
 *   pangkal tepat sesudah T. Lajur melintang (0..1 di dalam tebal lembaran
 *   air) dihash dari (indeks, putaran), tanpa pola dan tanpa Math.random.
 * - Tanpa alokasi per frame: tabel dan kolam partikel larik bertipe yang
 *   dibuat sekali di createJetMotion; tabel diisi ulang hanya saat masukan
 *   berubah.
 */

/** Jumlah titik tabel terbanyak. */
export const JET_MAX = 241;

export type JetPath = {
  /** Jumlah titik terpakai (≥ 2 agar ada lintasan) */
  n: number;
  /** Titik garis acuan, m */
  x: Float64Array;
  z: Float64Array;
  /** Laju di titik itu, m/s */
  v: Float64Array;
  /**
   * Batas lembaran air dari garis acuan, m: lajur 0 di off0, lajur 1 di
   * off1. Arahnya `normal` (tegak lurus garis acuan, ke kiri arah aliran)
   * atau `vertical` (tegak, ke atas).
   */
  off0: Float64Array;
  off1: Float64Array;
  /** Waktu tempuh dari pangkal sampai titik ini, s (diisi finishJetPath) */
  tau: Float64Array;
  offset: "normal" | "vertical";
};

export type JetMotion = {
  path: JetPath;
  pool: Pool;
  /** Kunci masukan terakhir; tabel diisi ulang bila berubah */
  key: Float64Array;
  /** Laju terbesar di tabel, m/s (untuk panjang goresan) */
  vMax: number;
};

export function createJetPath(offset: JetPath["offset"]): JetPath {
  return {
    n: 0,
    x: new Float64Array(JET_MAX),
    z: new Float64Array(JET_MAX),
    v: new Float64Array(JET_MAX),
    off0: new Float64Array(JET_MAX),
    off1: new Float64Array(JET_MAX),
    tau: new Float64Array(JET_MAX),
    offset,
  };
}

export function createJetMotion(n: number, offset: JetPath["offset"], keySize = 8): JetMotion {
  const key = new Float64Array(keySize);
  key.fill(NaN);
  return { path: createJetPath(offset), pool: createPool(n), key, vMax: 0 };
}

/**
 * Membandingkan masukan dengan kunci tersimpan; benar (dan kunci
 * diperbarui) bila ada yang berubah. Tanpa alokasi.
 */
export function jetKeyChanged(m: JetMotion, a: number, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0): boolean {
  const k = m.key;
  if (k[0] === a && k[1] === b && k[2] === c && k[3] === d && k[4] === e && k[5] === f && k[6] === g && k[7] === h)
    return false;
  k[0] = a;
  k[1] = b;
  k[2] = c;
  k[3] = d;
  k[4] = e;
  k[5] = f;
  k[6] = g;
  k[7] = h;
  return true;
}

/** Mengisi tau (waktu tempuh kumulatif) dan mengembalikan laju terbesar. */
export function finishJetPath(p: JetPath): number {
  let vMax = 0;
  if (p.n > 0) p.tau[0] = 0;
  for (let k = 0; k < p.n; k++) if (p.v[k] > vMax) vMax = p.v[k];
  for (let k = 1; k < p.n; k++) {
    const ds = Math.hypot(p.x[k] - p.x[k - 1], p.z[k] - p.z[k - 1]);
    const vm = 0.5 * (p.v[k] + p.v[k - 1]);
    p.tau[k] = p.tau[k - 1] + (vm > 1e-9 ? ds / vm : 0);
  }
  return vMax;
}

/** Waktu tempuh seluruh lintasan, s. */
export function jetTransitTime(p: JetPath): number {
  return p.n >= 2 ? p.tau[p.n - 1] : 0;
}

const titik = new Float64Array(6);

/**
 * Letak dan kecepatan pada waktu tempuh τ, lajur η (0..1). Ditulis ke
 * out: [x, z, u, w, laju, k]. Tanpa alokasi.
 */
export function jetAt(p: JetPath, tau: number, eta: number, out: Float64Array): void {
  const n = p.n;
  // Bagi dua pada tabel waktu tempuh (naik monoton).
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (p.tau[mid] <= tau) lo = mid;
    else hi = mid;
  }
  const dt = p.tau[hi] - p.tau[lo];
  const f = dt > 0 ? Math.min(1, Math.max(0, (tau - p.tau[lo]) / dt)) : 0;
  const dx = p.x[hi] - p.x[lo];
  const dz = p.z[hi] - p.z[lo];
  const len = Math.hypot(dx, dz) || 1;
  const tx = dx / len;
  const tz = dz / len;
  const v = p.v[lo] + (p.v[hi] - p.v[lo]) * f;
  const o0 = p.off0[lo] + (p.off0[hi] - p.off0[lo]) * f;
  const o1 = p.off1[lo] + (p.off1[hi] - p.off1[lo]) * f;
  const off = o0 + (o1 - o0) * eta;
  let x = p.x[lo] + dx * f;
  let z = p.z[lo] + dz * f;
  if (p.offset === "normal") {
    // Normal kiri arah aliran: (−tz, tx). Aliran ke kanan bawah → ke atas.
    x += -tz * off;
    z += tx * off;
  } else {
    z += off;
  }
  out[0] = x;
  out[1] = z;
  out[2] = v * tx;
  out[3] = v * tz;
  out[4] = v;
  out[5] = lo;
}

/**
 * Menempatkan semua butir pada saat t (waktu fisik) lalu menggambar
 * goresannya. Goresan terpanjang (butir tercepat) ±`pxMax` piksel; yang
 * lain sebanding lajunya. Pemanggil memotong ke bidang gambar.
 */
export function drawJet(
  ctx: CanvasRenderingContext2D,
  m: JetMotion,
  map: PlateMap,
  t: number,
  opts: { pxMax?: number; alpha?: number; width?: number } = {}
): void {
  const p = m.path;
  const pool = m.pool;
  const T = jetTransitTime(p);
  if (!(T > 0) || !(m.vMax > 0)) return;
  for (let i = 0; i < pool.n; i++) {
    const fase = hash01(i, 0x5eed) * T + t;
    const putaran = Math.floor(fase / T);
    const tau = fase - putaran * T;
    jetAt(p, tau, hash01(i, putaran + 1), titik);
    pool.x[i] = titik[0];
    pool.y[i] = titik[1];
    pool.u[i] = titik[2];
    pool.v[i] = titik[3];
  }
  // Skala mendatar dan tegak gambar tidak selalu sama (HS-06 di 390 px
  // tegaknya tiga kali mendatar): goresan dibatasi oleh skala terbesar.
  const pxPerM = Math.max(Math.abs(map.X(1) - map.X(0)), Math.abs(map.Y(1) - map.Y(0))) || 1;
  drawStreaks(ctx, pool, map, {
    lenPerMps: (opts.pxMax ?? 22) / (m.vMax * pxPerM),
    minPx: 2,
    alpha: opts.alpha ?? 0.55,
    width: opts.width ?? W.thin,
  });
}
