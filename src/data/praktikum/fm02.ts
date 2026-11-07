/**
 * Lembar pengamatan FM-02 Venturi (Phase 3, mode praktikum P-A).
 *
 * Logika tanpa React supaya bisa diuji (src/lib/praktikumFm02.test.ts).
 * Semua hitungan memakai fungsi praktikum.ts dan venturiDischarge, tidak
 * ada rumus baru di sini.
 *
 * Satu bacaan:
 * - Nilai benar dibaca dari keadaan lembar (D₁, D₂, Δh, C). Debit benar =
 *   venturiDischarge(D₁, D₂, Δh, C).Q, jadi Cd yang dihitung pengguna
 *   mendekati C yang dipasang di lembar
 * - Dua tabung manometer dibaca TERPISAH dengan ALAT_MANOMETER lalu
 *   dikurangkan (catatan insinyur): h₂ benar = H2_DATUM, h₁ benar =
 *   H2_DATUM + Δh. Urutan tarikan acak: h₁, h₂, Q
 * - Debit cara volumetrik dengan ALAT_DEBIT_VOLUMETRIK
 * - Tidak ada pemotongan ke rentang alat. h₁ di atas skala bangku 400 mm
 *   (Armfield F1-15) hanya dihitung untuk penanda di layar
 */

import type { Bi } from "../../lib/i18n.tsx";
import { venturiDischarge } from "../../lib/hydraulics.ts";
import {
  ALAT_DEBIT_VOLUMETRIK,
  ALAT_MANOMETER,
  bacaAlat,
  bulatkanKe,
  cdVenturi,
  kalibrasiCd,
  kalibrasiVenturi,
  qTeoriVenturi,
  type Kalibrasi,
  type KolomEkspor,
  type Rng,
} from "../../lib/praktikum.ts";

/** Tinggi muka air tabung leher di atas nol skala, meter (titik acuan bacaan). */
export const H2_DATUM = 0.1;

/** Panjang skala manometer bangku praktikum, meter (Armfield F1-15: 0-400 mm). */
export const SKALA_MANOMETER = 0.4;

/** Syarat usulan galat debit volumetrik 1 %: volume ≥ 10 L dan waktu ≥ 30 s. */
export const VOLUME_MIN_L = 10;
export const WAKTU_MIN_S = 30;

export type KeadaanFm02 = { D1: number; D2: number; dh: number; C: number };

export type BacaanFm02 = {
  /** Diameter pipa dan leher saat dicatat, m */
  D1: number;
  D2: number;
  /** Bacaan tabung pipa dan tabung leher, m kolom air */
  h1: number;
  h2: number;
  /** h₁ − h₂, dibulatkan ke resolusi manometer, m */
  dh: number;
  /** Debit cara volumetrik, m³/s */
  Q: number;
};

/** Alasan bacaan tidak bisa dicatat, atau null bila boleh. */
export function tolakFm02(s: KeadaanFm02): "bukan-venturi" | null {
  return venturiDischarge(s.D1, s.D2, s.dh, s.C).reason === "bukan-venturi" ? "bukan-venturi" : null;
}

export function catatFm02(s: KeadaanFm02, rng: Rng): BacaanFm02 {
  const h1 = bacaAlat(H2_DATUM + s.dh, ALAT_MANOMETER, rng);
  const h2 = bacaAlat(H2_DATUM, ALAT_MANOMETER, rng);
  const Q = bacaAlat(venturiDischarge(s.D1, s.D2, s.dh, s.C).Q, ALAT_DEBIT_VOLUMETRIK, rng);
  return { D1: s.D1, D2: s.D2, h1, h2, dh: bulatkanKe(h1 - h2, ALAT_MANOMETER.resolusi), Q };
}

/** Volume tampung paling sedikit (liter) supaya syarat 10 L dan 30 s terpenuhi. */
export function volumeTampungMin(Q: number): number {
  return Math.max(VOLUME_MIN_L, Q * 1000 * WAKTU_MIN_S);
}

/** Benar bila baris memakai lebih dari satu pasangan diameter. */
export function geometriCampur(rows: readonly BacaanFm02[]): boolean {
  return rows.some((r) => r.D1 !== rows[0].D1 || r.D2 !== rows[0].D2);
}

export type RingkasanFm02 = {
  kal: Kalibrasi;
  /** Geometri berbeda antarbaris: Cd kalibrasi memakai Q teori per baris */
  campur: boolean;
  /** Jumlah baris dengan h₁ di atas skala manometer bangku */
  luarSkala: number;
};

export function ringkasFm02(rows: readonly BacaanFm02[]): RingkasanFm02 {
  const campur = rows.length > 0 && geometriCampur(rows);
  const kal = rows.length === 0
    ? kalibrasiCd([])
    : campur
      ? kalibrasiCd(rows.map((r) => ({ qUkur: r.Q, qTeori: qTeoriVenturi(r.dh, r.D1, r.D2) })))
      : kalibrasiVenturi(rows.map((r) => ({ dh: r.dh, Q: r.Q })), rows[0].D1, rows[0].D2);
  return { kal, campur, luarSkala: rows.filter((r) => r.h1 > SKALA_MANOMETER).length };
}

const mm: Bi<string> = { id: "mm", en: "mm" };
const ls: Bi<string> = { id: "L/dtk", en: "L/s" };

/** Kolom tabel di layar. */
export const KOLOM_FM02: (KolomEkspor<BacaanFm02> & { digits: number })[] = [
  { key: "h1", judul: { id: "h₁ tabung pipa", en: "h₁ pipe tube" }, satuan: mm, digits: 0, hitung: (r) => r.h1 * 1000 },
  { key: "h2", judul: { id: "h₂ tabung leher", en: "h₂ throat tube" }, satuan: mm, digits: 0, hitung: (r) => r.h2 * 1000 },
  { key: "dh", judul: { id: "Δh = h₁ − h₂", en: "Δh = h₁ − h₂" }, satuan: mm, digits: 0, hitung: (r) => r.dh * 1000 },
  { key: "Q", judul: { id: "Q ukur", en: "Q measured" }, satuan: ls, digits: 3, hitung: (r) => r.Q * 1000 },
  { key: "qt", judul: { id: "Q teori", en: "Q theory" }, satuan: ls, digits: 3, hitung: (r) => qTeoriVenturi(r.dh, r.D1, r.D2) * 1000 },
  { key: "cd", judul: { id: "Cd", en: "Cd" }, digits: 4, hitung: (r) => cdVenturi(r.dh, r.Q, r.D1, r.D2) },
];

/** Kolom berkas ekspor: diameter ikut ditulis supaya tiap baris lengkap. */
export const KOLOM_EKSPOR_FM02: (KolomEkspor<BacaanFm02> & { digits: number })[] = [
  { key: "D1", judul: { id: "D₁ pipa", en: "D₁ pipe" }, satuan: mm, digits: 0, hitung: (r) => r.D1 * 1000 },
  { key: "D2", judul: { id: "D₂ leher", en: "D₂ throat" }, satuan: mm, digits: 0, hitung: (r) => r.D2 * 1000 },
  ...KOLOM_FM02,
];
