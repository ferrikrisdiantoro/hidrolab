import { C, F, W } from "./theme.ts";
import { pen } from "./plate.ts";
import { fmtPlain } from "./hydraulics.ts";
import { createPool, drawStreaks, hash01, relane, type Pool } from "./motion.ts";
import type { PlateMap, PlateOut } from "./plateOut.ts";

/**
 * LAPIS GERAK PENGGAMBAR MEDAN (drawField) — batch B5a.
 *
 * Satu fungsi gerak per lembar. Aturannya sama dengan OC-01:
 * - Laju setiap tanda yang bergerak diturunkan dari medan kecepatan yang
 *   SAMA dengan yang dihitung model lembarnya. Rumus yang disalin ke sini
 *   (supaya tidak membuat objek per frame) diuji sama dengan keluaran model
 *   di drawFieldMotion.test.ts.
 * - Waktu nyata, kecuali lembar menulis "waktu dipercepat/diperlambat ×N"
 *   lewat usePlate timeScale; `t` dan `dt` yang diterima di sini sudah
 *   waktu fisik.
 * - Tanpa alokasi per frame: kolam partikel larik bertipe, keadaan lain
 *   disimpan di objek keadaan yang dibuat sekali di Client (useRef).
 * - Semua tanda dipotong ke bingkai bidang gambar (PlateOut.map.frame).
 *
 * Lembar yang TIDAK dianimasikan di sini, karena gambarnya bukan ruang
 * fisik tempat medan kecepatannya hidup: FP-03 (bidang periode lawan
 * cepat rambat; model tidak punya medan kecepatan orbit).
 */

/* ------------------------------------------------------------------ *
 * Alat bersama
 * ------------------------------------------------------------------ */

/**
 * Jam putar ulang: 0 sampai `tEnd`, lalu diam di `tEnd` selama `hold`,
 * lalu mulai lagi. Semua dalam detik waktu fisik.
 */
export function replayTime(t: number, tEnd: number, hold: number): number {
  const per = tEnd + hold;
  if (!(per > 0) || !(tEnd > 0)) return 0;
  const m = t % per;
  return m < tEnd ? m : tEnd;
}

/**
 * Pengali waktu pangkat sepuluh supaya `count` peristiwa per detik fisik
 * (frekuensi, atau kebalikan lama lintasan) tampil di layar antara `lo`
 * dan 10·lo per detik. 1 = waktu nyata. Pangkat sepuluh dipilih supaya
 * catatan "×10", "×1 000" dapat dibaca langsung.
 */
export function decadeTimeScale(perSecond: number, lo: number): number {
  if (!(perSecond > 0) || !Number.isFinite(perSecond)) return 1;
  const k = Math.floor(Math.log10(perSecond / lo));
  return Math.pow(10, -k);
}

function clipFrame(ctx: CanvasRenderingContext2D, map: PlateMap) {
  const f = map.frame;
  ctx.beginPath();
  ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
  ctx.clip();
}

/** Jam di pojok kiri atas bidang gambar, di atas alas kertas. */
function clockLabel(ctx: CanvasRenderingContext2D, map: PlateMap, text: string) {
  const f = map.frame;
  ctx.font = F.value;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width;
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = C.sheet;
  ctx.fillRect(f.x0 + 4, f.y0 + 5, w + 8, 16);
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.ink2;
  ctx.fillText(text, f.x0 + 8, f.y0 + 13);
}

/** Teks jam yang hanya dibuat ulang bila angkanya berubah. */
type Jam = { kunci: number; teks: string };
function jam(j: Jam, nilai: number, digits: number, awalan: string, satuan: string) {
  const k = Math.round(nilai * Math.pow(10, digits));
  if (k !== j.kunci) {
    j.kunci = k;
    j.teks = `${awalan}${fmtPlain(k / Math.pow(10, digits), digits)} ${satuan}`;
  }
  return j.teks;
}

/* ------------------------------------------------------------------ *
 * FF-05  Garis aliran: u = U, v = V cos ωt (flowLines)
 * ------------------------------------------------------------------ */

/** Lintasan partikel yang dilepas di titik asal pada saat nol (flowLines). */
export function pathlinePoint(
  U: number,
  V: number,
  omega: number,
  tau: number,
  out: Float64Array
): void {
  out[0] = U * tau;
  out[1] = omega !== 0 ? (V / omega) * Math.sin(omega * tau) : V * tau;
}

/** Butir yang dilepas pada saat t0, dilihat pada saat t (flowLines). */
export function streakPoint(
  U: number,
  V: number,
  omega: number,
  t: number,
  t0: number,
  out: Float64Array
): void {
  out[0] = U * (t - t0);
  out[1] =
    omega !== 0
      ? (V / omega) * (Math.sin(omega * t) - Math.sin(omega * t0))
      : V * (t - t0);
}

export type FlowLinesMotion = {
  pool: Pool;
  jam: Jam;
  siap: boolean;
  /** Jam putar ulang frame sebelumnya, untuk mengenali awal putaran */
  tauLalu: number;
};

export function createFlowLinesMotion(n = 90): FlowLinesMotion {
  return { pool: createPool(n), jam: { kunci: NaN, teks: "" }, siap: false, tauLalu: 0 };
}

export type FlowLinesParams = {
  U: number;
  V: number;
  omega: number;
  /** Saat pengamatan lembar, detik: putaran ulang berakhir di sini */
  waktu: number;
  /** Panjang yang digambar lembar, m */
  panjang: number;
};

/** Selang lepas butir zat warna, detik waktu fisik. */
const FF05_LEPAS = 0.25;
/** Lama diam di akhir putaran ulang, detik. */
const FF05_DIAM = 1.5;
const tmp2 = new Float64Array(2);

/**
 * FF-05. Putaran ulang 0 → t dalam waktu nyata:
 * - goresan pelacak di seluruh bidang mengikuti medan seragam
 *   (U, V cos ωτ) pada saat putaran τ
 * - garis arus saat τ (lurus, kemiringan V cos ωτ / U)
 * - lintasan butir yang dilepas pada saat nol sampai τ, dengan kepalanya
 * - garis jejak saat τ dan butir zat warna yang dilepas tiap 0,25 s
 * Pada τ = t ketiganya berimpit dengan garis lapis statis.
 */
export function drawFlowLinesMotion(
  ctx: CanvasRenderingContext2D,
  t: number,
  dt: number,
  out: PlateOut | null,
  p: FlowLinesParams,
  st: FlowLinesMotion
): void {
  if (!out) return;
  const map = out.map;
  const f = map.frame;
  const x0 = map.invX(f.x0);
  const x1 = map.invX(f.x1);
  const yA = map.invY(f.y1);
  const yB = map.invY(f.y0);
  const pool = st.pool;
  if (!st.siap) {
    for (let i = 0; i < pool.n; i++) {
      pool.x[i] = x0 + ((i + 0.5) / pool.n) * (x1 - x0);
      pool.y[i] = yA + pool.seed[i] * (yB - yA);
    }
    st.siap = true;
  }
  const tau = replayTime(t, p.waktu, FF05_DIAM);
  st.tauLalu = tau;
  const vSaat = p.V * Math.cos(p.omega * tau);

  // Pelacak: medan seragam, jadi u dan v sama untuk semua partikel.
  for (let i = 0; i < pool.n; i++) {
    pool.u[i] = p.U;
    pool.v[i] = vSaat;
    const nx = pool.x[i] + p.U * dt;
    const ny = pool.y[i] + vSaat * dt;
    if (!(nx >= x0 && nx <= x1 && ny >= yA && ny <= yB)) {
      const s = relane(pool, i);
      pool.x[i] = x0;
      pool.y[i] = yA + s * (yB - yA);
      pool.age[i] = 0;
    } else {
      pool.x[i] = nx;
      pool.y[i] = ny;
      pool.age[i] += dt;
    }
  }

  ctx.save();
  clipFrame(ctx, map);
  drawStreaks(ctx, pool, map, { lenPerMps: 0.25, minPx: 2 });

  const X = map.X;
  const Y = map.Y;

  // Garis arus saat τ.
  pen(ctx, W.thin, C.critical);
  ctx.beginPath();
  ctx.moveTo(X(0), Y(0));
  ctx.lineTo(X(p.panjang), Y(p.U !== 0 ? (vSaat / p.U) * p.panjang : 0));
  ctx.stroke();

  // Garis jejak saat τ: butir yang dilepas pada 0 ≤ t0 ≤ τ.
  const nJ = 120;
  pen(ctx, W.thin, C.energy);
  ctx.beginPath();
  for (let j = 0; j <= nJ; j++) {
    streakPoint(p.U, p.V, p.omega, tau, (tau * j) / nJ, tmp2);
    if (j) ctx.lineTo(X(tmp2[0]), Y(tmp2[1]));
    else ctx.moveTo(X(tmp2[0]), Y(tmp2[1]));
  }
  ctx.stroke();
  // Butir zat warna yang dilepas tiap 0,25 s: titik materi yang ikut hanyut.
  ctx.fillStyle = C.energy;
  ctx.beginPath();
  for (let t0 = 0; t0 <= tau; t0 += FF05_LEPAS) {
    streakPoint(p.U, p.V, p.omega, tau, t0, tmp2);
    const px = X(tmp2[0]);
    const py = Y(tmp2[1]);
    ctx.moveTo(px + 1.8, py);
    ctx.arc(px, py, 1.8, 0, Math.PI * 2);
  }
  ctx.fill();

  // Lintasan butir yang dilepas pada saat nol, sampai τ, dan kepalanya.
  const nL = 120;
  pen(ctx, W.thin, C.water);
  ctx.beginPath();
  for (let j = 0; j <= nL; j++) {
    pathlinePoint(p.U, p.V, p.omega, (tau * j) / nL, tmp2);
    if (j) ctx.lineTo(X(tmp2[0]), Y(tmp2[1]));
    else ctx.moveTo(X(tmp2[0]), Y(tmp2[1]));
  }
  ctx.stroke();
  pathlinePoint(p.U, p.V, p.omega, tau, tmp2);
  ctx.fillStyle = C.water;
  ctx.strokeStyle = C.sheet;
  ctx.lineWidth = W.thin;
  ctx.beginPath();
  ctx.arc(X(tmp2[0]), Y(tmp2[1]), 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  clockLabel(ctx, map, jam(st.jam, tau, 1, "τ = ", "s"));
}

/* ------------------------------------------------------------------ *
 * FF-06  Deformasi fluida: u = a x + b y, v = c x + d y (deformation)
 * ------------------------------------------------------------------ */

/**
 * e^{tA} untuk A = [[a, b], [c, d]], bentuk tertutup yang sama dengan
 * deformation() di hydraulics.ts. out = [m11, m12, m21, m22].
 */
export function deformMatrix(
  a: number,
  b: number,
  c: number,
  d: number,
  t: number,
  out: Float64Array
): void {
  const tau = (a + d) / 2;
  const b11 = a - tau;
  const b12 = b;
  const b21 = c;
  const b22 = d - tau;
  const s2 = b11 * b11 + b12 * b21;
  let c0: number;
  let c1: number;
  if (s2 > 1e-14) {
    const sq = Math.sqrt(s2);
    c0 = Math.cosh(sq * t);
    c1 = Math.sinh(sq * t) / sq;
  } else if (s2 < -1e-14) {
    const w = Math.sqrt(-s2);
    c0 = Math.cos(w * t);
    c1 = Math.sin(w * t) / w;
  } else {
    c0 = 1;
    c1 = t;
  }
  const skala = Math.exp(tau * t);
  out[0] = skala * (c0 + c1 * b11);
  out[1] = skala * c1 * b12;
  out[2] = skala * c1 * b21;
  out[3] = skala * (c0 + c1 * b22);
}

export type DeformMotion = { pool: Pool; jam: Jam; siap: boolean };

export function createDeformMotion(n = 110): DeformMotion {
  return { pool: createPool(n), jam: { kunci: NaN, teks: "" }, siap: false };
}

export type DeformParams = {
  a: number;
  b: number;
  c: number;
  d: number;
  /** Lama pengamatan lembar, detik: putaran ulang berakhir di sini */
  waktu: number;
  /** Medan memuai (∇·u ≠ 0): elemen digambar merah sinyal seperti lapis statis */
  invalid: boolean;
};

/** Umur pelacak sebelum lahir ulang di tempat acak, detik fisik. */
const FF06_UMUR = 1.2;
const FF06_DIAM = 0.3;
const mat = new Float64Array(4);

function lahirAcak(p: Pool, i: number, x0: number, x1: number, y0: number, y1: number) {
  const s = relane(p, i);
  p.x[i] = x0 + s * (x1 - x0);
  p.y[i] = y0 + hash01(i + 7919, p.gen[i]) * (y1 - y0);
  p.age[i] = hash01(i + 104729, p.gen[i]) * FF06_UMUR * 0.5;
}

/**
 * FF-06. Putaran ulang 0 → t: elemen satuan berkisi 5 × 5 yang dibawa
 * medan, x(τ) = e^{τA} x(0), sampai berimpit dengan bentuk sesudahnya di
 * lapis statis; pojok kiri bawahnya bertitik supaya putarannya terbaca.
 * Pelacak di seluruh bidang mengikuti u = A x yang sama.
 */
export function drawDeformMotion(
  ctx: CanvasRenderingContext2D,
  t: number,
  dt: number,
  out: PlateOut | null,
  p: DeformParams,
  st: DeformMotion
): void {
  if (!out) return;
  const map = out.map;
  const f = map.frame;
  const x0 = map.invX(f.x0);
  const x1 = map.invX(f.x1);
  const y0 = map.invY(f.y1);
  const y1 = map.invY(f.y0);
  const pool = st.pool;
  if (!st.siap) {
    for (let i = 0; i < pool.n; i++) lahirAcak(pool, i, x0, x1, y0, y1);
    st.siap = true;
  }
  for (let i = 0; i < pool.n; i++) {
    const x = pool.x[i];
    const y = pool.y[i];
    const u = p.a * x + p.b * y;
    const v = p.c * x + p.d * y;
    pool.u[i] = u;
    pool.v[i] = v;
    const nx = x + u * dt;
    const ny = y + v * dt;
    pool.age[i] += dt;
    if (!(nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1) || pool.age[i] > FF06_UMUR) {
      lahirAcak(pool, i, x0, x1, y0, y1);
    } else {
      pool.x[i] = nx;
      pool.y[i] = ny;
    }
  }

  ctx.save();
  clipFrame(ctx, map);
  drawStreaks(ctx, pool, map, { lenPerMps: 0.3, minPx: 2 });

  const tau = replayTime(t, p.waktu, FF06_DIAM);
  deformMatrix(p.a, p.b, p.c, p.d, tau, mat);
  const X = (x: number, y: number) => map.X(mat[0] * x + mat[1] * y);
  const Y = (x: number, y: number) => map.Y(mat[2] * x + mat[3] * y);
  const warna = p.invalid ? C.signal : C.water;

  ctx.beginPath();
  ctx.moveTo(X(-0.5, -0.5), Y(-0.5, -0.5));
  ctx.lineTo(X(0.5, -0.5), Y(0.5, -0.5));
  ctx.lineTo(X(0.5, 0.5), Y(0.5, 0.5));
  ctx.lineTo(X(-0.5, 0.5), Y(-0.5, 0.5));
  ctx.closePath();
  ctx.fillStyle = p.invalid ? C.signalFill : C.waterFillDeep;
  ctx.fill();
  pen(ctx, W.thin, warna);
  ctx.stroke();

  // Kisi dalam: pemetaannya linear, jadi garis kisi tetap lurus.
  pen(ctx, W.hair, warna);
  ctx.beginPath();
  for (let k = 1; k < 5; k++) {
    const s = k / 5 - 0.5;
    ctx.moveTo(X(-0.5, s), Y(-0.5, s));
    ctx.lineTo(X(0.5, s), Y(0.5, s));
    ctx.moveTo(X(s, -0.5), Y(s, -0.5));
    ctx.lineTo(X(s, 0.5), Y(s, 0.5));
  }
  ctx.stroke();

  ctx.fillStyle = warna;
  ctx.beginPath();
  ctx.arc(X(-0.5, -0.5), Y(-0.5, -0.5), 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  clockLabel(ctx, map, jam(st.jam, tau, 2, "τ = ", "s"));
}

/* ------------------------------------------------------------------ *
 * FP-01  Deret vorteks Kármán (vortexStreet)
 * ------------------------------------------------------------------ */

/**
 * Pengali waktu FP-01: frekuensi lepas pusaran tampil antara 0,3 dan
 * 3 per detik layar.
 */
export function karmanTimeScale(frequency: number): number {
  return decadeTimeScale(frequency, 0.3);
}

export type KarmanParams = {
  /** Diameter silinder, m */
  d: number;
  /** Jarak antar pusaran sebaris a, m (vortexStreet.spacing) */
  spacing: number;
  /** Jarak antar baris h, m (vortexStreet.rowGap) */
  rowGap: number;
  /** Frekuensi lepas pusaran per baris, Hz (vortexStreet.frequency) */
  frequency: number;
  /** Banyak pusaran per baris pada lapis statis */
  count: number;
};

/**
 * Kecepatan hanyut pusaran, m/s. Model menurunkan jarak a = 0,87 U / f
 * dari pusaran yang hanyut 0,87 U; kecepatan itu dibaca balik sebagai
 * a · f, jadi gerak di layar memakai keluaran model, bukan tetapan baru.
 */
export function karmanDrift(p: KarmanParams): number {
  return p.spacing * p.frequency;
}

/** Ofset hanyut deret pusaran pada saat t, 0 ≤ s < a. */
export function karmanShift(p: KarmanParams, t: number): number {
  if (!(p.spacing > 0)) return 0;
  const s = (karmanDrift(p) * t) % p.spacing;
  return s < 0 ? s + p.spacing : s;
}

/**
 * Pusat pusaran ke-k pada saat t, untuk k = 0 .. 2·(count+1) − 1: genap
 * baris atas, ganjil baris bawah, mulai satu pusaran sebelum yang pertama
 * di lapis statis supaya pusaran baru terlihat lahir di belakang silinder.
 * Mengembalikan false bila pusaran itu belum lahir (x < d).
 * Pada t = 0, k ≥ 2 sama persis dengan vortexStreet().street.
 */
export function karmanVortex(p: KarmanParams, t: number, k: number, out: Float64Array): boolean {
  const s = karmanShift(p, t);
  const i = (k >> 1) - 1;
  const atas = (k & 1) === 0;
  out[0] = p.d + p.spacing * (i + (atas ? 0.5 : 1)) + s;
  out[1] = atas ? p.rowGap / 2 : -p.rowGap / 2;
  out[2] = atas ? 1 : -1;
  return out[0] >= p.d - 1e-12;
}

const vtx = new Float64Array(3);

/**
 * FP-01. Pusaran kedua baris hanyut ke hilir dengan a · f; tiap baris
 * melepas satu pusaran baru per 1/f detik, bergantian setengah periode.
 * Penanda sama dengan lapis statis (biru isi = baris atas, ungu kosong =
 * baris bawah), jadi pada t = 0 gambarnya identik dengan saat dijeda.
 */
export function drawKarmanMotion(
  ctx: CanvasRenderingContext2D,
  t: number,
  out: PlateOut | null,
  p: KarmanParams
): void {
  if (!out || !(p.frequency > 0) || !(p.spacing > 0)) return;
  const map = out.map;
  ctx.save();
  clipFrame(ctx, map);
  const n = 2 * (p.count + 2);
  for (let pass = 0; pass < 2; pass++) {
    const atas = pass === 0;
    const warna = atas ? C.water : C.critical;
    pen(ctx, W.thin, warna);
    ctx.fillStyle = atas ? warna : C.sheet;
    for (let k = atas ? 0 : 1; k < n; k += 2) {
      if (!karmanVortex(p, t, k, vtx)) continue;
      const px = map.X(vtx[0]);
      const py = map.Y(vtx[1]);
      if (px > map.frame.x1 + 6) continue;
      ctx.beginPath();
      ctx.arc(px, py, 6 * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * FP-04  Adveksi dan difusi (advectionDiffusion)
 * ------------------------------------------------------------------ */

/** Kepekatan Gauss yang sama dengan advectionDiffusion(), kg/m³. */
export function plumeConcentration(
  mass: number,
  area: number,
  U: number,
  D: number,
  x: number,
  t: number
): number {
  if (t <= 0) return 0;
  const Dd = Math.max(D, 1e-9);
  const A = Math.max(area, 1e-9);
  const s = Math.sqrt(2 * Dd * t);
  const z = (x - U * t) / s;
  return (mass / (A * s * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

export type PlumeMotion = { pool: Pool; jam: Jam; tauLalu: number; k: number; U: number; D: number };

export function createPlumeMotion(n = 420): PlumeMotion {
  return { pool: createPool(n), jam: { kunci: NaN, teks: "" }, tauLalu: Infinity, k: 0, U: NaN, D: NaN };
}

export type PlumeParams = {
  mass: number;
  area: number;
  U: number;
  D: number;
  /** Saat terakhir yang digambar lembar, detik */
  tEnd: number;
};

/** Pengali waktu FP-04: satu menit fisik per detik layar. */
export const PLUME_TIME_SCALE = 60;
const FP04_DIAM = 90;

/** Bilangan normal baku dari dua hash (Box–Muller), tanpa Math.random. */
export function gauss01(i: number, k: number): number {
  const u1 = Math.max(hash01(i, 2 * k), 1e-12);
  const u2 = hash01(i, 2 * k + 1);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Satu langkah jalan acak partikel zat: x += U dt + √(2 D dt) · N(0, 1).
 * Sebaran partikelnya adalah penyelesaian Gauss yang sama dengan model:
 * rerata U t, ragam 2 D t.
 */
export function stepPlume(pool: Pool, U: number, D: number, dt: number, k: number): void {
  if (!(dt > 0)) return;
  const sd = Math.sqrt(2 * Math.max(D, 1e-9) * dt);
  for (let i = 0; i < pool.n; i++) {
    pool.x[i] += U * dt + sd * gauss01(i, k + pool.gen[i] * 1000003);
    pool.age[i] += dt;
  }
}

/**
 * FP-04. Putaran ulang 0 → saat terakhir (×60): kurva kepekatan c(x, τ)
 * dan partikel zat yang berjalan acak dengan adveksi U dan penyebaran D.
 * Tinggi tiap partikel = bilangan acak tetapnya × c(x, τ), jadi titiknya
 * mengisi luas di bawah kurva; rapatnya mengikuti kepekatan.
 */
export function drawPlumeMotion(
  ctx: CanvasRenderingContext2D,
  t: number,
  dt: number,
  out: PlateOut | null,
  p: PlumeParams,
  st: PlumeMotion
): void {
  if (!out) return;
  const map = out.map;
  const f = map.frame;
  const pool = st.pool;
  const tau = replayTime(t, p.tEnd, FP04_DIAM);
  // U atau D digeser selagi berputar: lepas ulang dari x = 0. Langkah
  // pertama sesudahnya sepanjang τ penuh, dan untuk jalan acak Gauss satu
  // langkah τ sama sebarannya dengan banyak langkah kecil (rerata Uτ,
  // ragam 2Dτ), jadi titik langsung mengisi kurva yang baru.
  if (p.U !== st.U || p.D !== st.D) {
    st.U = p.U;
    st.D = p.D;
    st.tauLalu = Infinity;
  }
  if (tau < st.tauLalu) {
    // Putaran baru: seluruh zat dilepas lagi di titik lepas x = 0.
    for (let i = 0; i < pool.n; i++) {
      relane(pool, i);
      pool.x[i] = 0;
      pool.age[i] = 0;
    }
    st.tauLalu = 0;
  }
  const dtau = tau - st.tauLalu;
  st.tauLalu = tau;
  st.k++;
  stepPlume(pool, p.U, p.D, dtau, st.k);

  ctx.save();
  clipFrame(ctx, map);

  // Partikel zat.
  ctx.fillStyle = C.water;
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < pool.n; i++) {
    const c = plumeConcentration(p.mass, p.area, p.U, p.D, pool.x[i], tau);
    const px = map.X(pool.x[i]);
    const py = map.Y(c * (0.03 + 0.94 * pool.seed[i]));
    ctx.fillRect(px - 0.8, py - 0.8, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;

  // Kurva kepekatan saat τ.
  const xa = map.invX(f.x0);
  const xb = map.invX(f.x1);
  const n = 220;
  pen(ctx, W.thin, C.water);
  ctx.beginPath();
  for (let j = 0; j <= n; j++) {
    const x = xa + ((xb - xa) * j) / n;
    const yy = map.Y(plumeConcentration(p.mass, p.area, p.U, p.D, x, tau));
    if (j) ctx.lineTo(map.X(x), yy);
    else ctx.moveTo(map.X(x), yy);
  }
  ctx.stroke();

  // Pusat awan saat τ.
  if (tau > 0) {
    const xc = p.U * tau;
    ctx.fillStyle = C.water;
    ctx.strokeStyle = C.sheet;
    ctx.beginPath();
    ctx.arc(map.X(xc), map.Y(plumeConcentration(p.mass, p.area, p.U, p.D, xc, tau)), 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  clockLabel(ctx, map, jam(st.jam, tau / 60, 1, "t = ", "min"));
}

/* ------------------------------------------------------------------ *
 * PI-04  Percobaan Reynolds (reynoldsExperiment)
 * ------------------------------------------------------------------ */

/**
 * Bentuk benang zat warna di tabung, dipakai lapis statis dan lapis gerak.
 * `s` = x / panjang tabung, `kacau` = 0 (laminar) .. 1, `geser` = pergeseran
 * pola gangguan ke hilir dalam bagian panjang tabung (V·t / panjang).
 * Selubung s² (gangguan tumbuh ke hilir) tetap di tempat; polanya hanyut.
 */
export function filamentY(s: number, R: number, kacau: number, geser = 0): number {
  const tumbuh = kacau * s * s;
  const q = s - geser;
  const y =
    R *
    0.34 *
    tumbuh *
    (Math.sin(28 * q) + 0.6 * Math.sin(61 * q + 1.1) + 0.35 * Math.sin(133 * q + 2.3));
  return Math.max(-R * 0.94, Math.min(R * 0.94, y));
}

/**
 * Pengali waktu PI-04: zat warna menempuh tabung dalam 3 sampai 30 detik
 * layar.
 */
export function reynoldsTimeScale(V: number, length: number): number {
  return decadeTimeScale(V / Math.max(length, 1e-9), 1 / 30);
}

export type ReynoldsMotion = { pool: Pool; siap: boolean };

export function createReynoldsMotion(n = 46): ReynoldsMotion {
  return { pool: createPool(n), siap: false };
}

export type ReynoldsParams = {
  /** Kecepatan rata-rata model V = Q/A, m/s */
  V: number;
  /** Jari-jari tabung, m */
  R: number;
  /** Panjang tabung yang digambar, m */
  length: number;
  /** 0 laminar .. 1 turbulen penuh, sama dengan lapis statis */
  kacau: number;
  /** Warna rezim, sama dengan benang lapis statis */
  color: string;
  /** Pengali waktu yang dipakai usePlate, untuk panjang goresan di layar */
  timeScale: number;
};

/** Pajanan goresan manik, detik layar. */
const PI04_PAJAN = 0.12;

/** Simpangan lateral manik ke-i dari benang, m. Nol pada aliran laminar. */
export function beadOffset(seed: number, s: number, R: number, kacau: number): number {
  return (seed - 0.5) * 2 * 0.8 * R * kacau * s * s;
}

/**
 * PI-04. Benang zat warna di sumbu tabung dengan pola gangguan yang hanyut
 * pada kecepatan rata-rata V, dan manik zat warna yang bergerak dengan V.
 * Pada aliran yang tidak laminar manik menyebar ke samping sebanding
 * selubung gangguannya (zat warna bercampur), selalu di dalam dinding.
 */
export function drawReynoldsMotion(
  ctx: CanvasRenderingContext2D,
  t: number,
  dt: number,
  out: PlateOut | null,
  p: ReynoldsParams,
  st: ReynoldsMotion
): void {
  if (!out) return;
  const map = out.map;
  const P = p.length;
  const pool = st.pool;
  if (!st.siap) {
    for (let i = 0; i < pool.n; i++) pool.x[i] = ((i + pool.seed[i]) / pool.n) * P;
    st.siap = true;
  }
  for (let i = 0; i < pool.n; i++) {
    pool.u[i] = p.V;
    let x = pool.x[i] + p.V * dt;
    if (!(x <= P)) {
      relane(pool, i);
      x = x > P && Number.isFinite(x) ? (x - P) % P : 0;
    }
    pool.x[i] = x;
  }
  const geser = (p.V * t) / P;

  ctx.save();
  clipFrame(ctx, map);
  const n = 240;
  pen(ctx, W.thin, p.color);
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const px = map.X(P * s);
    const py = map.Y(filamentY(s, p.R, p.kacau, geser));
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Manik: goresan sepanjang perpindahannya selama pajanan.
  const pxPerM = Math.abs(map.X(1) - map.X(0));
  const len = Math.min(14, Math.max(3, p.V * p.timeScale * PI04_PAJAN * pxPerM));
  pen(ctx, W.bold, p.color);
  ctx.beginPath();
  for (let i = 0; i < pool.n; i++) {
    const s = pool.x[i] / P;
    const y = beadY(s, p.R, p.kacau, geser, pool.seed[i]);
    const hx = map.X(pool.x[i]);
    const hy = map.Y(y);
    ctx.moveTo(hx - len, hy);
    ctx.lineTo(hx, hy);
  }
  ctx.stroke();
  ctx.restore();
}

/** Letak tegak manik: benang + simpangan, dijepit di dalam dinding. */
export function beadY(s: number, R: number, kacau: number, geser: number, seed: number): number {
  const y = filamentY(s, R, kacau, geser) + beadOffset(seed, s, R, kacau);
  return Math.max(-R * 0.94, Math.min(R * 0.94, y));
}
