/**
 * Permainan EK-02 Aturan panen (Phase 3, K-C): logika tanpa React.
 *
 * Pemain memilih upaya penangkapan E untuk tiap tahun selama TAHUN tahun.
 * Populasi bergerak menurut persamaan lembar yang SAMA (schaeferHarvest,
 * hydraulics.ts):
 *
 *   dN/dt = r N (1 − N/K) − q E N
 *
 * Lembar hanya memakai keadaan mantapnya (dN/dt = 0). Permainan menjalankan
 * persamaan itu satu tahun dengan E tetap. Dengan E tetap persamaannya
 * logistik biasa dengan a = r − qE dan b = r/K, jadi penyelesaiannya tertutup
 * dan pasti (tanpa langkah numerik):
 *
 *   N(t)      = N0 e^{at} / (1 + (b N0 / a)(e^{at} − 1))
 *   ∫0^t N ds = (1/b) ln(1 + (b N0 / a)(e^{at} − 1))
 *   tangkapan = q E ∫0^1 N dt
 *
 * dan untuk a = 0 bentuk batasnya N0 / (1 + b N0 t) dan (1/b) ln(1 + b N0 t).
 * Uji: permainanPanen.test.ts membandingkannya dengan RK4 halus dan dengan
 * keadaan mantap schaeferHarvest. Model tidak bertambah; tidak ada acak,
 * karena persamaan lembar tidak memuat variasi lingkungan.
 *
 * SKOR (ditulis juga di layar):
 *
 *   S = Σ Cₜ − max(0, N₀ − N_T) − MSY · n_runtuh
 *
 *   Σ Cₜ       jumlah tangkapan seluruh tahun
 *   N₀ − N_T   kurasan: stok yang diambil dari "modal", bukan dari
 *              pertumbuhannya. Hanya pengurangan yang dihitung; stok yang
 *              naik tidak menambah skor
 *   n_runtuh   banyak tahun yang berakhir dengan N ≤ 0,05 K, ambang
 *              `collapsed` schaeferHarvest. Tiap tahun runtuh mengurangi satu
 *              MSY. Dengan E tetap N monoton sepanjang tahun, jadi titik
 *              terendah setahun selalu di awal atau akhirnya: memeriksa akhir
 *              tiap tahun (dan N₀) cukup
 *
 * Batas atas: dari persamaannya, Σ Cₜ = ∫ r N (1 − N/K) dt − (N_T − N₀), dan
 * pertumbuhan surplus r N (1 − N/K) tidak pernah melebihi rK/4 = MSY.
 * Karena itu S ≤ MSY · T untuk strategi apa pun, dan sama dengan MSY · T
 * hanya bila N bertahan di K/2 sepanjang permainan. Stok awal permainan
 * K/2 (tingkat stok pada MSY), sehingga pembandingnya adil: E = Emsy tiap
 * tahun mencapai batas itu tepat.
 */

import type { ParamDef } from "./rentang.ts";

/** Rentang upaya E: dipakai bersama penggeser lembar, pegangan, dan permainan. */
export const P_E: ParamDef = { min: 0, max: 150, step: 1, digits: 0 };

/** Lama permainan, tahun. */
export const TAHUN = 20;

/** Ambang runtuh sebagai bagian K, sama dengan `collapsed` schaeferHarvest. */
export const AMBANG_RUNTUH = 0.05;

export type ParamPanen = { r: number; K: number; q: number };

export type Tahun = {
  /** Nomor tahun, mulai 1 */
  t: number;
  E: number;
  /** Populasi awal dan akhir tahun, ton */
  N0: number;
  N1: number;
  /** Tangkapan tahun ini, ton */
  tangkap: number;
  /** Benar bila tahun ini berakhir di bawah ambang runtuh */
  runtuh: boolean;
};

export type NilaiPermainan = {
  msy: number;
  /** Batas atas skor: MSY · banyak tahun yang dimainkan */
  batas: number;
  tangkapTotal: number;
  kurasan: number;
  nRuntuh: number;
  penalti: number;
  skor: number;
  N0: number;
  NT: number;
};

/** Stok awal permainan: K/2, stok pada hasil lestari maksimum. */
export const awalPermainan = (p: ParamPanen) => p.K / 2;

/** Satu tahun persamaan lembar dengan upaya E tetap. */
export function majuSetahun(p: ParamPanen, N0: number, E: number): { N1: number; tangkap: number } {
  const a = p.r - p.q * E;
  const b = p.r / p.K;
  let N1: number;
  let integral: number;
  if (Math.abs(a) < 1e-12) {
    N1 = N0 / (1 + b * N0);
    integral = Math.log1p(b * N0) / b;
  } else {
    const g = Math.expm1(a); // e^{a·1} − 1
    const u = ((b * N0) / a) * g;
    N1 = (N0 * (g + 1)) / (1 + u);
    integral = Math.log1p(u) / b;
  }
  return { N1, tangkap: p.q * E * integral };
}

/** Upaya sah: di rentang penggeser dan di kisi langkahnya. */
export function upayaSah(E: number): boolean {
  if (!Number.isFinite(E) || E < P_E.min || E > P_E.max) return false;
  const k = E / P_E.step;
  return Math.abs(k - Math.round(k)) < 1e-9;
}

/** Menjalankan deret upaya dari stok awal. Upaya tidak sah ditolak, bukan dipotong. */
export function mainkan(p: ParamPanen, efforts: readonly number[]): Tahun[] {
  if (efforts.length > TAHUN) throw new RangeError(`Permainan paling lama ${TAHUN} tahun`);
  const out: Tahun[] = [];
  let N = awalPermainan(p);
  efforts.forEach((E, i) => {
    if (!upayaSah(E)) throw new RangeError(`Upaya ${E} di luar rentang atau langkah penggeser`);
    const s = majuSetahun(p, N, E);
    out.push({ t: i + 1, E, N0: N, N1: s.N1, tangkap: s.tangkap, runtuh: s.N1 <= AMBANG_RUNTUH * p.K });
    N = s.N1;
  });
  return out;
}

/** Skor menurut rumus di kepala berkas. */
export function nilaiPermainan(p: ParamPanen, th: readonly Tahun[]): NilaiPermainan {
  const msy = (p.r * p.K) / 4;
  const N0 = awalPermainan(p);
  const NT = th.length ? th[th.length - 1].N1 : N0;
  const tangkapTotal = th.reduce((s, t) => s + t.tangkap, 0);
  const kurasan = Math.max(0, N0 - NT);
  const nRuntuh = th.filter((t) => t.runtuh).length;
  const penalti = msy * nRuntuh;
  return {
    msy,
    batas: msy * th.length,
    tangkapTotal,
    kurasan,
    nRuntuh,
    penalti,
    skor: tangkapTotal - kurasan - penalti,
    N0,
    NT,
  };
}
