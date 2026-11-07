/**
 * Lembar pengamatan FM-03 Tabung Pitot, mode traverse (Phase 3, P-B).
 *
 * Logika tanpa React supaya bisa diuji (src/lib/praktikumFm03.test.ts).
 *
 * Satu bacaan = satu letak ujung tabung r/R pada garis tengah pipa:
 * - Nilai benar dari model lembar: u benar = powerLawVelocity(r, R, u₀, n)
 *   dengan u₀ = pitotVelocity(Δh₀). Δh benar di ujung = pitotHead(u benar)
 * - Dua tabung manometer (tekanan total dan tekanan statik) dibaca
 *   TERPISAH dengan ALAT_MANOMETER lalu dikurangkan, sama seperti FM-02.
 *   Urutan tarikan acak: hₜ, lalu hₛ
 * - u = √(2gΔh) per titik (pitotVelocity, Cp = 1 seperti lembar). Δh
 *   terbaca negatif (galat baca pada aliran sangat pelan) memberi u = 0
 *
 * Debit cara kecepatan-luas (ISO 3966 untuk saluran tertutup; prinsip yang
 * sama dengan ISO 748 di saluran terbuka). ANGGAPAN LEMBAR, perlu dicek
 * insinyur:
 * - Penampang lingkaran, profil dianggap simetri putar: Q = ∫₀ᴿ 2πr·u dr.
 *   Tiap sisi garis tengah (r ≥ 0 dan r ≤ 0) diintegrasikan sendiri lalu
 *   dirata-rata; titik sumbu dipakai kedua sisi
 * - Trapesium atas r·u di antara titik terukur. Dari sumbu ke titik
 *   pertama (bila sumbu tidak dibaca) u dianggap tetap
 * - Zona dinding, dari titik terakhir r_k ke dinding: kecepatan rata-rata
 *   zona = m/(m+1)·u_k dengan m = 7, luas zona π(R² − r_k²). Bentuk
 *   m/(m+1) adalah rata-rata profil pangkat 1/m pada pita dekat dinding
 *   (ISO 748 memakai bentuk yang sama untuk zona tepi saluran). Juru ukur
 *   tidak tahu n lembar, jadi m tetap 7, bukan n penggeser
 * - Pembanding: trapesium yang ditutup u = 0 di dinding (Qnol). Profil
 *   turbulen menukik tajam di dekat dinding, jadi garis lurus ke nol
 *   memotong luas dan Q selalu kurang (≈ 3 sampai 4 % pada traverse baku)
 */

import type { Bi } from "../../lib/i18n.tsx";
import {
  pitotHead,
  pitotVelocity,
  powerLawMeanRatio,
  powerLawVelocity,
} from "../../lib/hydraulics.ts";
import {
  ALAT_MANOMETER,
  bacaAlat,
  bulatkanKe,
  type KolomEkspor,
  type Rng,
} from "../../lib/praktikum.ts";

/** Muka air tabung statik di atas nol skala manometer, meter. */
export const H_DATUM = 0.1;

/** Pangkat profil yang dipakai juru ukur untuk zona dinding (anggapan). */
export const M_DINDING = 7;

/** Batas dekat dinding, sama dengan `dekatDinding` lembar (|r/R| > 0,95). */
export const R_DINDING_MAKS = 0.95;

/**
 * Letak traverse yang disarankan di prosedur, r/R. Dua sisi garis tengah,
 * lebih rapat ke dinding tempat profil berubah cepat.
 */
export const POSISI_BAKU: readonly number[] = [
  0, 0.3, 0.5, 0.7, 0.8, 0.9, 0.95, -0.3, -0.5, -0.7, -0.8, -0.9, -0.95,
];

export type KeadaanFm03 = {
  /** Beda tinggi tekan di sumbu, m (penggeser lembar) */
  dh0: number;
  /** Diameter pipa, m */
  D: number;
  /** Pangkat hukum pangkat */
  n: number;
  /** Letak ujung tabung r/R, −1 sampai 1 */
  rR: number;
};

export type BacaanFm03 = {
  rR: number;
  /** Keadaan aliran saat dicatat (untuk Q model dan penanda campur) */
  D: number;
  dh0: number;
  n: number;
  /** Bacaan tabung tekanan total dan tekanan statik, m kolom air */
  ht: number;
  hs: number;
  /** hₜ − hₛ, dibulatkan ke resolusi manometer, m */
  dh: number;
  /** √(2gΔh), m/s */
  u: number;
};

/** Alasan bacaan tidak bisa dicatat, atau null bila boleh. */
export function tolakFm03(s: KeadaanFm03): "dekat-dinding" | null {
  return Math.abs(s.rR) > R_DINDING_MAKS ? "dekat-dinding" : null;
}

/** Kecepatan benar di ujung tabung menurut model lembar. */
export function uBenarFm03(s: KeadaanFm03): number {
  const R = s.D / 2;
  return powerLawVelocity(s.rR * R, R, pitotVelocity(s.dh0), s.n);
}

export function catatFm03(s: KeadaanFm03, rng: Rng): BacaanFm03 {
  const dhBenar = pitotHead(uBenarFm03(s));
  const ht = bacaAlat(H_DATUM + dhBenar, ALAT_MANOMETER, rng);
  const hs = bacaAlat(H_DATUM, ALAT_MANOMETER, rng);
  const dh = bulatkanKe(ht - hs, ALAT_MANOMETER.resolusi);
  return { rR: s.rR, D: s.D, dh0: s.dh0, n: s.n, ht, hs, dh, u: pitotVelocity(dh) };
}

/** Debit model lembar: Q = u₀ · (V/u₀) · πR². */
export function qModelFm03(s: Pick<KeadaanFm03, "dh0" | "D" | "n">): number {
  const R = s.D / 2;
  return pitotVelocity(s.dh0) * powerLawMeanRatio(s.n) * Math.PI * R * R;
}

export type TitikProfil = { s: number; u: number };

/** Satu sisi: titik diurutkan menurut s = |r/R|, letak sama dirata-rata. */
function profilSisi(titik: readonly { rR: number; u: number }[]): TitikProfil[] {
  const peta = new Map<number, number[]>();
  for (const t of titik) {
    if (!Number.isFinite(t.u) || !Number.isFinite(t.rR)) continue;
    const s = Math.abs(t.rR);
    const a = peta.get(s);
    if (a) a.push(t.u);
    else peta.set(s, [t.u]);
  }
  return [...peta.entries()]
    .map(([s, us]) => ({ s, u: us.reduce((a, b) => a + b, 0) / us.length }))
    .sort((a, b) => a.s - b.s);
}

export type IntegralSisi = { inti: number; zona: number; nol: number };

/**
 * ∫ 2πr·u dr pada satu sisi. inti = sumbu sampai titik terakhir; zona =
 * pita dinding cara m/(m+1); nol = pita dinding ditutup trapesium ke u = 0.
 */
function integralSisi(p: readonly TitikProfil[], R: number, m: number): IntegralSisi {
  const r0 = p[0].s * R;
  let inti = Math.PI * p[0].u * r0 * r0;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i];
    inti += 2 * Math.PI * R * R * ((a.s * a.u + b.s * b.u) / 2) * (b.s - a.s);
  }
  const k = p[p.length - 1];
  const zona = (m / (m + 1)) * k.u * Math.PI * R * R * (1 - k.s * k.s);
  const nol = 2 * Math.PI * R * R * ((k.s * k.u) / 2) * (1 - k.s);
  return { inti, zona, nol };
}

export type DebitTraverse = {
  /** Debit cara kecepatan-luas dengan zona dinding m/(m+1), m³/s */
  Q: number;
  /** Debit bila trapesium ditutup u = 0 di dinding, m³/s */
  Qnol: number;
  /** Bagian Q dari zona dinding (rata-rata sisi), m³/s */
  Qzona: number;
  /** Jumlah sisi garis tengah yang dipakai (1 atau 2; 0 bila kosong) */
  sisi: number;
  /** Titik profil per sisi sesudah dirata-rata, untuk langkah hitung */
  profil: TitikProfil[][];
  /** Integral per sisi, urutan sama dengan profil */
  rinci: IntegralSisi[];
};

export function debitTraverse(
  titik: readonly { rR: number; u: number }[],
  R: number,
  m: number = M_DINDING
): DebitTraverse {
  const kanan = profilSisi(titik.filter((t) => t.rR >= 0));
  const kiri = profilSisi(titik.filter((t) => t.rR <= 0));
  const ada = (p: TitikProfil[]) => p.some((t) => t.s > 0);
  let sisi: TitikProfil[][] = [kanan, kiri].filter(ada);
  // Hanya titik sumbu: satu sisi berisi sumbu saja
  if (sisi.length === 0 && kanan.length > 0) sisi = [kanan];
  if (sisi.length === 0 || !(R > 0)) return { Q: NaN, Qnol: NaN, Qzona: NaN, sisi: 0, profil: [], rinci: [] };
  const I = sisi.map((p) => integralSisi(p, R, m));
  const rata = (f: (x: IntegralSisi) => number) => I.reduce((a, x) => a + f(x), 0) / I.length;
  return {
    Q: rata((x) => x.inti + x.zona),
    Qnol: rata((x) => x.inti + x.nol),
    Qzona: rata((x) => x.zona),
    sisi: sisi.length,
    profil: sisi,
    rinci: I,
  };
}

/** Benar bila baris memakai lebih dari satu keadaan aliran atau pipa. */
export function keadaanCampur(rows: readonly BacaanFm03[]): boolean {
  return rows.some((r) => r.D !== rows[0].D || r.dh0 !== rows[0].dh0 || r.n !== rows[0].n);
}

export type RingkasanFm03 = DebitTraverse & {
  /** Debit model dari keadaan baris terakhir, m³/s */
  Qmodel: number;
  /** (Q − Q model)/Q model, persen */
  selisih: number;
  selisihNol: number;
  /** Kecepatan rata-rata penampang dari Q traverse, m/s */
  V: number;
  nTitik: number;
  campur: boolean;
  /** Ada titik di sumbu (|r/R| < 0,02)? */
  adaSumbu: boolean;
  /** Letak terjauh dari sumbu yang dibaca, |r/R| */
  sMaks: number;
};

export function ringkasFm03(rows: readonly BacaanFm03[]): RingkasanFm03 {
  const akhir = rows[rows.length - 1];
  const R = akhir ? akhir.D / 2 : NaN;
  const q = debitTraverse(rows, R);
  const Qmodel = akhir ? qModelFm03(akhir) : NaN;
  return {
    ...q,
    Qmodel,
    selisih: ((q.Q - Qmodel) / Qmodel) * 100,
    selisihNol: ((q.Qnol - Qmodel) / Qmodel) * 100,
    V: q.Q / (Math.PI * R * R),
    nTitik: rows.length,
    campur: rows.length > 0 && keadaanCampur(rows),
    adaSumbu: rows.some((r) => Math.abs(r.rR) < 0.02),
    sMaks: rows.reduce((a, r) => Math.max(a, Math.abs(r.rR)), 0),
  };
}

const mm: Bi<string> = { id: "mm", en: "mm" };
const ms: Bi<string> = { id: "m/s", en: "m/s" };

/** Kolom tabel di layar. */
export const KOLOM_FM03: (KolomEkspor<BacaanFm03> & { digits: number })[] = [
  { key: "rR", judul: { id: "Letak r/R", en: "Position r/R" }, digits: 2 },
  { key: "ht", judul: { id: "hₜ tabung total", en: "hₜ total tube" }, satuan: mm, digits: 0, hitung: (r) => r.ht * 1000 },
  { key: "hs", judul: { id: "hₛ tabung statik", en: "hₛ static tube" }, satuan: mm, digits: 0, hitung: (r) => r.hs * 1000 },
  { key: "dh", judul: { id: "Δh = hₜ − hₛ", en: "Δh = hₜ − hₛ" }, satuan: mm, digits: 0, hitung: (r) => r.dh * 1000 },
  { key: "u", judul: { id: "u = √(2gΔh)", en: "u = √(2gΔh)" }, satuan: ms, digits: 3 },
];

/** Kolom berkas ekspor: diameter dan keadaan ikut ditulis. */
export const KOLOM_EKSPOR_FM03: (KolomEkspor<BacaanFm03> & { digits: number })[] = [
  { key: "D", judul: { id: "D pipa", en: "D pipe" }, satuan: mm, digits: 0, hitung: (r) => r.D * 1000 },
  { key: "r", judul: { id: "r dari sumbu", en: "r from axis" }, satuan: mm, digits: 1, hitung: (r) => (r.rR * r.D * 1000) / 2 },
  ...KOLOM_FM03,
];
