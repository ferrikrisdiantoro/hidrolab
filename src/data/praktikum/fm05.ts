/**
 * Lembar pengamatan FM-05 Pengukuran pengenceran garam (Phase 3, P-B).
 *
 * Logika tanpa React supaya bisa diuji (src/lib/praktikumFm05.test.ts).
 * Posisi pencampuran dan denah awan garam TIDAK dibuat di sini (permintaan
 * tertunda B10, menunggu jawaban klien): alat ukur dianggap di penampang
 * yang sudah tercampur, dan kurva benarnya adalah kurva model lembar.
 *
 * Satu bacaan = konduktivitas di titik hilir pada waktu t sejak suntik:
 * - Kepekatan benar c(t) dibaca dari tracerCurve(Q, M, L, A, D).points
 *   dengan interpolasi lurus (tidak ada rumus sebaran baru di sini). c = 0
 *   sebelum suntik (t ≤ 0) dan di luar jendela kurva model
 * - Konduktivitas benar = EC_LATAR + K_GARAM · c, lalu bacaAlat dengan
 *   ALAT_KONDUKTIVITAS
 *
 * Hitungan (ISO 9555 cara suntik sesaat; Moore 2005):
 * - Latar EC₀ = rerata bacaan sebelum suntik (t ≤ 0). Tanpa bacaan itu,
 *   bacaan paling awal dipakai dan lembar menandainya
 * - ∫(EC − EC₀)dt dengan integrasiTrapesium atas bacaan t ≥ 0, diurutkan
 *   menurut waktu; ∫(c − c₀)dt = ∫(EC − EC₀)dt / K_GARAM
 * - Q = M / ∫(c − c₀)dt lewat debitGulp
 */

import type { Bi } from "../../lib/i18n.tsx";
import { tracerCurve, type TracerPoint } from "../../lib/hydraulics.ts";
import {
  bacaAlat,
  debitGulp,
  integrasiTrapesium,
  type AlatBaca,
  type KolomEkspor,
  type Rng,
} from "../../lib/praktikum.ts";

/**
 * Konduktivitas latar air sungai, µS/cm. ANGGAPAN LEMBAR: sungai pegunungan
 * berair lunak; angkanya hanya menggeser kurva, tidak mengubah Q.
 */
export const EC_LATAR = 50;

/**
 * Faktor konduktivitas garam dapur, µS/cm per mg/L NaCl. Dari konduktivitas
 * molar batas NaCl 126,4 S·cm²/mol pada 25 °C dibagi massa molar
 * 58,44 g/mol = 2,16. ANGGAPAN LEMBAR: berlaku untuk larutan encer pada
 * 25 °C; di lapangan faktor ini dikalibrasi di tempat (Moore 2005). Karena
 * lembar memakai faktor yang sama untuk membuat dan membaca kurva, faktor
 * ini tidak menggeser Q.
 */
export const K_GARAM = 2.16;

/**
 * Pengukur konduktivitas lapangan, µS/cm. Resolusi 0,1 µS/cm, galat acak per bacaan σ = √(0,1² + (0,005·EC)²) µS/cm (digabung kuadrat oleh bacaAlat). USULAN KONSERVATIF, disahkan insinyur 8 Nov: angka lazim lembar data pengukur genggam, sumber tidak dibuka; galat penguatan sistematik terkalibrasi bersama k dan tidak menggeser Q.
 */
export const ALAT_KONDUKTIVITAS: AlatBaca = { resolusi: 0.1, sigma: 0.1, sigmaRel: 0.005 };

/** Ekor dianggap terpotong bila kelebihan bacaan terakhir > 3 % puncak. */
export const BATAS_EKOR = 0.03;

export type KeadaanFm05 = {
  /** Debit sebenarnya m³/s, massa garam kg, jarak m, luas m², sebaran m²/s */
  Q: number;
  M: number;
  L: number;
  A: number;
  D: number;
  /** Waktu baca sejak suntik, s (negatif = sebelum suntik) */
  t: number;
};

export type BacaanFm05 = KeadaanFm05 & {
  /** Konduktivitas terbaca, µS/cm */
  ec: number;
};

/** c(t) dari kurva model, interpolasi lurus; 0 di luar jendela kurva. */
export function kepekatanPada(points: readonly TracerPoint[], t: number): number {
  const n = points.length;
  if (n === 0 || !(t > 0) || t < points[0].t || t > points[n - 1].t) return 0;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = points[lo], b = points[hi];
  if (b.t === a.t) return a.c;
  return a.c + ((b.c - a.c) * (t - a.t)) / (b.t - a.t);
}

export function catatFm05(s: KeadaanFm05, rng: Rng, points?: readonly TracerPoint[]): BacaanFm05 {
  const pts = points ?? tracerCurve(s.Q, s.M, s.L, s.A, s.D).points;
  const ec = bacaAlat(EC_LATAR + K_GARAM * kepekatanPada(pts, s.t), ALAT_KONDUKTIVITAS, rng);
  return { Q: s.Q, M: s.M, L: s.L, A: s.A, D: s.D, t: s.t, ec };
}

/** Ujung atas penggeser waktu: 1,3 kali akhir jendela kurva model, dibulatkan ke 10 s. */
export function tMaksFm05(points: readonly TracerPoint[]): number {
  const akhir = points.length ? points[points.length - 1].t : 0;
  return Math.max(60, Math.ceil((akhir * 1.3) / 10) * 10);
}

export type RingkasanFm05 = {
  /** Latar EC₀, µS/cm, dan jumlah bacaan sebelum suntik yang dirata-rata */
  latar: number;
  nLatar: number;
  /** ∫(EC − EC₀)dt, µS/cm·s, dan ∫(c − c₀)dt, mg/L·s */
  luasEc: number;
  luasC: number;
  /** Debit dari luas kurva, m³/s */
  Q: number;
  /** Debit sebenarnya (masukan lembar) baris terakhir, m³/s */
  Qmodel: number;
  /** (Q − Q model)/Q model, persen */
  selisih: number;
  /** Puncak kelebihan EC − EC₀ dan waktunya */
  puncak: number;
  tPuncak: number;
  /** Jumlah bacaan sesudah suntik (t ≥ 0) */
  nKurva: number;
  ekorTerpotong: boolean;
  campur: boolean;
};

export function ringkasFm05(rows: readonly BacaanFm05[]): RingkasanFm05 {
  const urut = [...rows].sort((a, b) => a.t - b.t);
  const sebelum = urut.filter((r) => r.t <= 0);
  const latar = sebelum.length
    ? sebelum.reduce((a, r) => a + r.ec, 0) / sebelum.length
    : urut.length
      ? urut[0].ec
      : NaN;
  const kurva = urut.filter((r) => r.t >= 0);
  const luasEc = integrasiTrapesium(kurva.map((r) => r.t), kurva.map((r) => r.ec), latar);
  const luasC = luasEc / K_GARAM;
  const akhir = rows[rows.length - 1];
  const M = akhir ? akhir.M : NaN;
  const Q = kurva.length >= 2 && luasC > 0 ? debitGulp(M, luasC) : NaN;
  const Qmodel = akhir ? akhir.Q : NaN;
  let puncak = -Infinity, tPuncak = NaN;
  for (const r of kurva) if (r.ec - latar > puncak) { puncak = r.ec - latar; tPuncak = r.t; }
  const terakhir = kurva[kurva.length - 1];
  const ekorTerpotong = kurva.length >= 2 && puncak > 0 && terakhir.ec - latar > Math.max(BATAS_EKOR * puncak, 3 * Math.hypot(0.1, 0.005 * latar));
  const campur = rows.some((r) => r.Q !== rows[0].Q || r.M !== rows[0].M || r.L !== rows[0].L || r.A !== rows[0].A || r.D !== rows[0].D);
  return {
    latar,
    nLatar: sebelum.length,
    luasEc,
    luasC,
    Q,
    Qmodel,
    selisih: ((Q - Qmodel) / Qmodel) * 100,
    puncak: Number.isFinite(puncak) ? puncak : NaN,
    tPuncak,
    nKurva: kurva.length,
    ekorTerpotong,
    campur,
  };
}

const us: Bi<string> = { id: "µS/cm", en: "µS/cm" };
const detik: Bi<string> = { id: "s", en: "s" };

/** Kolom tabel di layar. */
export const KOLOM_FM05: (KolomEkspor<BacaanFm05> & { digits: number })[] = [
  { key: "t", judul: { id: "Waktu sejak suntik t", en: "Time since injection t" }, satuan: detik, digits: 0 },
  { key: "ec", judul: { id: "Konduktivitas EC", en: "Conductivity EC" }, satuan: us, digits: 1 },
];

/** Kolom berkas ekspor: keadaan lembar ikut ditulis supaya tiap baris lengkap. */
export const KOLOM_EKSPOR_FM05: (KolomEkspor<BacaanFm05> & { digits: number })[] = [
  ...KOLOM_FM05,
  { key: "M", judul: { id: "Massa garam M", en: "Salt mass M" }, satuan: { id: "kg", en: "kg" }, digits: 1 },
  { key: "L", judul: { id: "Jarak suntik L", en: "Injection distance L" }, satuan: { id: "m", en: "m" }, digits: 0 },
];
