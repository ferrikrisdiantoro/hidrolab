/**
 * Lembar pengamatan FM-01 Ambang V (Phase 3, mode praktikum P-A).
 *
 * Logika tanpa React supaya bisa diuji (src/lib/praktikumFm01.test.ts).
 * Semua hitungan memakai fungsi praktikum.ts dan notchDischarge, tidak ada
 * rumus baru di sini.
 *
 * Satu bacaan:
 * - Nilai benar dibaca dari keadaan lembar (H, θ). Debit benar =
 *   notchDischarge(H, θ).Q, jadi Cd yang dihitung pengguna (Q teori dengan
 *   Cd = 1, he = H + kh(θ)) mendekati Ce model lembar
 * - H dibaca dengan pengukur titik (ALAT_PENGUKUR_TITIK), diukur dari nol
 *   datum di puncak takik. Nol datum itu disetel sekali per deret benih
 *   dengan galat tetap N(0, SIGMA_NOL²): galat sistematik, sama untuk semua
 *   bacaan satu seri. Usulan insinyur, TANPA SUMBER, belum ditelaah
 * - Debit cara volumetrik dengan ALAT_DEBIT_VOLUMETRIK
 * - Urutan tarikan acak: nol datum (sekali per deret), lalu tiap bacaan H, Q
 * - Tidak ada pemotongan. H di bawah batas rumus (NOTCH_H_MIN) dan H di atas
 *   rentang pengukur titik F1-13 (150 mm) hanya dihitung untuk penanda
 */

import type { Bi } from "../../lib/i18n.tsx";
import { NOTCH_H_MIN, notchCe, notchDischarge } from "../../lib/hydraulics.ts";
import {
  ALAT_DEBIT_VOLUMETRIK,
  ALAT_PENGUKUR_TITIK,
  bacaAlat,
  cdAmbangV,
  kalibrasiAmbangV,
  kalibrasiCd,
  kalibrasiPangkat,
  normalBaku,
  qTeoriAmbangV,
  type Kalibrasi,
  type KalibrasiPangkat,
  type KolomEkspor,
  type Rng,
} from "../../lib/praktikum.ts";

export { VOLUME_MIN_L, WAKTU_MIN_S, volumeTampungMin } from "./fm02.ts";

/** Rentang pengukur titik bangku praktikum, meter (Armfield F1-13: 0-150 mm). */
export const SKALA_PENGUKUR = 0.15;

/**
 * Simpangan baku galat nol datum, meter. Usulan insinyur (σ ≈ 0,2 mm),
 * tanpa sumber terbuka; ditulis begitu di layar.
 */
export const SIGMA_NOL = 0.0002;

export type KeadaanFm01 = { H: number; theta: number };

export type BacaanFm01 = {
  /** Sudut takik saat dicatat, derajat */
  theta: number;
  /** Bacaan pengukur titik di atas nol datum, m */
  H: number;
  /** Debit cara volumetrik, m³/s */
  Q: number;
};

/* Nol datum per deret: Praktikum.tsx membuat Rng baru tiap kali benih
   dipasang atau tabel dikosongkan, jadi kunci Rng = satu seri pengamatan. */
const nolPerDeret = new WeakMap<Rng, number>();

/**
 * Galat nol datum deret ini, meter. Ditarik pada pemanggilan pertama
 * (tarikan pertama deret), sesudah itu tetap.
 */
export function offsetNol(rng: Rng): number {
  let o = nolPerDeret.get(rng);
  if (o === undefined) {
    o = SIGMA_NOL * normalBaku(rng);
    nolPerDeret.set(rng, o);
  }
  return o;
}

export function catatFm01(s: KeadaanFm01, rng: Rng): BacaanFm01 {
  const nol = offsetNol(rng);
  const H = bacaAlat(s.H + nol, ALAT_PENGUKUR_TITIK, rng);
  const Q = bacaAlat(notchDischarge(s.H, s.theta).Q, ALAT_DEBIT_VOLUMETRIK, rng);
  return { theta: s.theta, H, Q };
}

/** Benar bila baris memakai lebih dari satu sudut takik. */
export function sudutCampur(rows: readonly BacaanFm01[]): boolean {
  return rows.some((r) => r.theta !== rows[0].theta);
}

export type RingkasanFm01 = {
  kal: Kalibrasi;
  /** Q = K·H^m dari (H bacaan, Q ukur); NaN bila sudut campur atau n < 2 */
  pangkat: KalibrasiPangkat;
  /** Ce model lembar untuk sudut seri ini; NaN bila sudut campur */
  ce: number;
  /** Sudut berbeda antarbaris: Cd kalibrasi memakai Q teori per baris */
  campur: boolean;
  /** Jumlah baris dengan H di bawah batas rumus lembar (5 cm) */
  rendah: number;
  /** Jumlah baris dengan H di atas rentang pengukur titik bangku */
  luarSkala: number;
};

const tanpaPangkat = (n: number): KalibrasiPangkat => ({ K: NaN, m: NaN, r2: NaN, n });

export function ringkasFm01(rows: readonly BacaanFm01[]): RingkasanFm01 {
  const campur = rows.length > 0 && sudutCampur(rows);
  const kal = rows.length === 0
    ? kalibrasiCd([])
    : campur
      ? kalibrasiCd(rows.map((r) => ({ qUkur: r.Q, qTeori: qTeoriAmbangV(r.H, r.theta) })))
      : kalibrasiAmbangV(rows.map((r) => ({ H: r.H, Q: r.Q })), rows[0].theta);
  return {
    kal,
    pangkat: campur ? tanpaPangkat(rows.length) : kalibrasiPangkat(rows.map((r) => ({ x: r.H, y: r.Q }))),
    ce: rows.length === 0 || campur ? NaN : notchCe(rows[0].theta),
    campur,
    rendah: rows.filter((r) => r.H < NOTCH_H_MIN).length,
    luarSkala: rows.filter((r) => r.H > SKALA_PENGUKUR).length,
  };
}

const mm: Bi<string> = { id: "mm", en: "mm" };
const ls: Bi<string> = { id: "L/dtk", en: "L/s" };

/** Kolom tabel di layar. */
export const KOLOM_FM01: (KolomEkspor<BacaanFm01> & { digits: number })[] = [
  { key: "H", judul: { id: "H pengukur titik", en: "H point gauge" }, satuan: mm, digits: 1, hitung: (r) => r.H * 1000 },
  { key: "Q", judul: { id: "Q ukur", en: "Q measured" }, satuan: ls, digits: 3, hitung: (r) => r.Q * 1000 },
  { key: "qt", judul: { id: "Q teori", en: "Q theory" }, satuan: ls, digits: 3, hitung: (r) => qTeoriAmbangV(r.H, r.theta) * 1000 },
  { key: "cd", judul: { id: "Cd", en: "Cd" }, digits: 4, hitung: (r) => cdAmbangV(r.H, r.Q, r.theta) },
];

/** Kolom berkas ekspor: sudut takik ikut ditulis supaya tiap baris lengkap. */
export const KOLOM_EKSPOR_FM01: (KolomEkspor<BacaanFm01> & { digits: number })[] = [
  { key: "theta", judul: { id: "θ sudut takik", en: "θ notch angle" }, satuan: { id: "°", en: "°" }, digits: 0 },
  ...KOLOM_FM01,
];
