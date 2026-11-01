import { C, W } from "./theme.ts";
import { createPool, drawStreaks, hash01, type Pool } from "./motion.ts";
import {
  JET_MAX,
  createJetMotion,
  drawJet,
  finishJetPath,
  jetKeyChanged,
  jetTransitTime,
  type JetMotion,
  type JetPath,
} from "./jetMotion.ts";
import type { PlateOut } from "./plateOut.ts";

/**
 * LAPIS GERAK PEMBESARAN MENDADAK (PI-06, batch B3).
 *
 * Gambar statis PI-06: pipa lurus di sumbu z = 0, jari-jari r₁ = D₁/2 di
 * x < 0 dan r₂ = D₂/2 di x > 0 (bendPlan sudut nol), sumbu tegak = jari-jari.
 *
 * Inti aliran (data model): pancaran keluar dari pipa kecil lalu melebar
 * sampai menempel lagi ke dinding pada jarak Lr. Karena zona pusaran di
 * sudut tidak membawa debit bersih, laju inti u(x) = Q / (π rj(x)²):
 * di hulu tepat V₁ model, sesudah menempel tepat V₂ model.
 *
 * Panjang menempel ulang Lr = 8 kali tinggi anak tangga h = (D₂ − D₁)/2
 * (aliran turbulen: sekitar 8 sampai 9 h, Back & Roschke 1972 untuk
 * pembesaran bulat; 5 sampai 8 h untuk anak tangga datar, Eaton & Johnston
 * 1981). Ini BENTUK gambar, bukan hasil model; model PI-06 (Borda-Carnot)
 * tidak bergantung padanya. Pelebaran pancaran diambil lurus.
 *
 * Zona pusaran: butir beredar di sudut antara pancaran dan dinding, maju
 * di sisi pancaran, balik di sisi dinding. Laju edarnya TAKSIRAN, bukan
 * hitungan: rata-rata 0,2·(V₁ − V₂), yaitu sebanding loncatan kecepatan
 * yang menghasilkan kehilangan Borda-Carnot hL = (V₁ − V₂)²/2g. Pada
 * pembesaran besar (V₂ → 0) itu 0,2 V₁, sekitar laju balik terbesar yang
 * terukur di zona pusaran anak tangga (Eaton & Johnston 1981, AIAA J 19(9)). Client wajib menulisnya.
 */

/** Panjang menempel ulang per tinggi anak tangga. */
export const REATTACH_PER_STEP = 8;
/** Laju edar rata-rata pusaran per (V₁ − V₂), taksiran. */
export const EDDY_SPEED_RATIO = 0.2;
/** Lajur inti: bagian jari-jari pancaran setempat. */
const LAJUR = 0.9;
/** Butir pusaran per sudut. */
const PUSARAN_N = 12;

export type ExpansionState = {
  Q: number;
  D1: number;
  D2: number;
  /** Panjang ruas hulu dan hilir yang digambar, m (sama dengan lembar) */
  L: number;
};

export type ExpansionMotion = {
  jet: JetMotion;
  /** Dua sudut pusaran (atas, bawah) dalam satu kolam */
  eddy: Pool;
};

export function createExpansionMotion(n = 60): ExpansionMotion {
  return { jet: createJetMotion(n, "vertical"), eddy: createPool(2 * PUSARAN_N) };
}

/** Panjang menempel ulang, m (0 bila tidak membesar). */
export function reattachLength(D1: number, D2: number): number {
  return D2 > D1 ? (REATTACH_PER_STEP * (D2 - D1)) / 2 : 0;
}

/** Jari-jari pancaran inti pada x, m. */
export function jetRadius(s: Pick<ExpansionState, "D1" | "D2">, x: number): number {
  const r1 = s.D1 / 2;
  const r2 = s.D2 / 2;
  if (x <= 0 || !(s.D2 > s.D1)) return x <= 0 ? r1 : r2;
  const Lr = reattachLength(s.D1, s.D2);
  return r1 + (r2 - r1) * Math.min(1, x / Lr);
}

/** Laju inti pada x, m/s: Q / (π rj²). */
export function coreSpeed(s: ExpansionState, x: number): number {
  const r = jetRadius(s, x);
  return s.Q / (Math.PI * r * r);
}

/**
 * Lintasan inti dari x = −L ke x = L: laju u(x), lajur ±0,9 rj(x).
 * Titik rapat di ruas pelebaran. Mengembalikan laju terbesar (= V₁).
 */
export function fillExpansionPath(path: JetPath, s: ExpansionState): number {
  path.n = 0;
  if (!(s.Q > 0) || !(s.D1 > 0) || !(s.D2 > s.D1) || !(s.L > 0)) return 0;
  const Lr = Math.min(reattachLength(s.D1, s.D2), s.L);
  // 20 titik di hulu, sisanya dibagi di pelebaran dan sesudahnya.
  const nHulu = 20;
  const nLebar = Lr < s.L ? 180 : JET_MAX - nHulu;
  const nHilir = JET_MAX - nHulu - nLebar;
  let k = 0;
  const taruh = (x: number) => {
    const r = jetRadius(s, x);
    path.x[k] = x;
    path.z[k] = 0;
    path.v[k] = s.Q / (Math.PI * r * r);
    path.off0[k] = -LAJUR * r;
    path.off1[k] = LAJUR * r;
    k++;
  };
  for (let i = 0; i < nHulu; i++) taruh(-s.L + (s.L * i) / nHulu);
  for (let i = 0; i < nLebar; i++) taruh((Lr * i) / (nLebar - 1));
  for (let i = 0; i < nHilir; i++) taruh(Lr + ((s.L - Lr) * (i + 1)) / nHilir);
  path.n = k;
  return finishJetPath(path);
}

/** Laju edar rata-rata pusaran, m/s. */
export function eddySpeed(V1: number, V2: number): number {
  return EDDY_SPEED_RATIO * Math.max(0, V1 - V2);
}

/**
 * Butir pusaran ke-i pada saat t: elips Steiner dalam segitiga sudut
 * A (0, r₁), B (0, r₂), Cr (Lr, r₂), diperkecil k ∈ [0,3; 0,9] terhadap
 * titik beratnya, jadi selalu di dalam zona. Arah: dari dekat titik
 * menempel ke dinding, balik ke muka anak tangga, lalu maju di sisi
 * pancaran. Laju sudut tetap sehingga laju keliling rata-rata = U.
 * Ditulis ke pool (x, y, u, v). Sudut bawah = cermin.
 */
export function placeEddy(p: Pool, t: number, r1: number, r2: number, Lr: number, U: number) {
  // Titik berat dan dua vektor setengah sumbu elips Steiner.
  const gx = Lr / 3;
  const gz = (r1 + 2 * r2) / 3;
  // ½(Cr − G) dan (B − A)/(2√3)
  const ax = (Lr - gx) / 2;
  const az = (r2 - gz) / 2;
  const bz = (r2 - r1) / (2 * Math.sqrt(3));
  for (let j = 0; j < PUSARAN_N; j++) {
    const k = 0.3 + 0.6 * hash01(j, 0xed1);
    // Keliling elips (Ramanujan) dari dua sumbu tak ortogonal didekati
    // dengan panjang kedua vektor; cukup untuk laju rata-rata.
    const a = k * Math.hypot(ax, az);
    const b = k * bz;
    const keliling = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    const omega = keliling > 0 ? (2 * Math.PI * U) / keliling : 0;
    const th = 2 * Math.PI * hash01(j, 0xed2) + omega * t;
    const c = Math.cos(th);
    const s = Math.sin(th);
    const x = gx + k * ax * c;
    const z = gz + k * (az * c + bz * s);
    const u = -k * ax * s * omega;
    const w = k * (-az * s + bz * c) * omega;
    p.x[j] = x;
    p.y[j] = z;
    p.u[j] = u;
    p.v[j] = w;
    const m = j + PUSARAN_N;
    p.x[m] = x;
    p.y[m] = -z;
    p.u[m] = u;
    p.v[m] = -w;
  }
}

/**
 * Lapis gerak PI-06. `t` waktu fisik. Dipotong ke rongga pipa dan bidang.
 */
export function drawExpansionMotion(
  ctx: CanvasRenderingContext2D,
  t: number,
  out: PlateOut | null,
  s: ExpansionState & { V1: number; V2: number },
  m: ExpansionMotion
): void {
  if (!out) return;
  const jet = m.jet;
  if (jetKeyChanged(jet, s.Q, s.D1, s.D2, s.L)) jet.vMax = fillExpansionPath(jet.path, s);
  if (!(jetTransitTime(jet.path) > 0)) return;
  const map = out.map;
  const f = map.frame;
  const r1 = s.D1 / 2;
  const r2 = s.D2 / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
  ctx.clip();
  // Rongga pipa: hulu sempit lalu hilir lebar (titik searah bendPlan).
  ctx.beginPath();
  ctx.moveTo(map.X(-s.L), map.Y(r1));
  ctx.lineTo(map.X(0), map.Y(r1));
  ctx.lineTo(map.X(0), map.Y(r2));
  ctx.lineTo(map.X(s.L), map.Y(r2));
  ctx.lineTo(map.X(s.L), map.Y(-r2));
  ctx.lineTo(map.X(0), map.Y(-r2));
  ctx.lineTo(map.X(0), map.Y(-r1));
  ctx.lineTo(map.X(-s.L), map.Y(-r1));
  ctx.closePath();
  ctx.clip();
  const sx = Math.abs(map.X(1) - map.X(0)) || 1;
  const sy = Math.abs(map.Y(1) - map.Y(0)) || 1;
  const panjang = 20 * (Math.max(sx, sy) / sx);
  drawJet(ctx, jet, map, t, { pxMax: panjang });

  // Pusaran: goresan dengan skala pajanan yang SAMA dengan inti, jadi
  // perbandingan panjang goresan = perbandingan laju.
  const U = eddySpeed(s.V1, s.V2);
  const Lr = reattachLength(s.D1, s.D2);
  if (U > 0 && Lr > 0) {
    placeEddy(m.eddy, t, r1, r2, Lr, U);
    const pxPerM = Math.max(sx, sy);
    drawStreaks(ctx, m.eddy, map, {
      lenPerMps: panjang / (Math.max(jet.vMax, 1e-9) * pxPerM),
      minPx: 2,
      alpha: 0.55,
      width: W.thin,
      color: C.water,
    });
  }
  ctx.restore();
}

/**
 * Waktu tempuh inti seluruh pipa yang digambar, s (tanpa tabel):
 * L/V₁ + π Lr (r₁² + r₁r₂ + r₂²)/(3Q) + (L − Lr)/V₂, Lr dipotong ke L.
 */
export function expansionTransitTime(s: ExpansionState): number {
  if (!(s.Q > 0) || !(s.D1 > 0) || !(s.D2 > s.D1) || !(s.L > 0)) return 0;
  const r1 = s.D1 / 2;
  const Lr = Math.min(reattachLength(s.D1, s.D2), s.L);
  const r2e = jetRadius(s, Lr);
  const A1 = Math.PI * r1 * r1;
  const A2 = Math.PI * (s.D2 / 2) * (s.D2 / 2);
  return (
    (s.L * A1) / s.Q +
    (Math.PI * Lr * (r1 * r1 + r1 * r2e + r2e * r2e)) / (3 * s.Q) +
    ((s.L - Lr) * A2) / s.Q
  );
}
