import type { Bi, Lang } from "./i18n";

/**
 * Kerangka verifikasi.
 *
 * Angka pada kolom "acuan" berasal dari LUAR aplikasi ini: buku teks, standar,
 * diagram terbitan, atau sifat matematis yang memang harus berlaku.
 * Membandingkan sebuah fungsi dengan hasilnya sendiri tidak membuktikan apa pun.
 *
 * Kolom "hitungan" dievaluasi saat halaman digambar, bukan disalin dari hasil
 * lama. Dengan begitu blok ini ikut berubah bila modelnya berubah, dan tidak
 * bisa diam-diam menjadi basi.
 */

export type CheckKind =
  /** Nilai yang diterbitkan: tabel, diagram, atau standar */
  | "terbitan"
  /** Sifat matematis yang harus berlaku pada model itu sendiri */
  | "sifat"
  /** Membalik lalu menghitung maju kembali */
  | "pulang-pergi"
  /** Dua jalur perhitungan berbeda harus bertemu di angka yang sama */
  | "silang"
  /** Perilaku yang harus benar, misalnya naik monoton */
  | "perilaku";

export type Check = {
  /** Apa yang diperiksa */
  label: Bi<string>;
  /** Sumber acuan, ditulis apa adanya agar dapat ditelusuri */
  source: string;
  kind: CheckKind;
  /** Nilai acuan dari sumber di atas */
  expected: number;
  /** Nilai yang dihitung aplikasi ini, dievaluasi saat digambar */
  actual: number;
  /** Toleransi relatif yang diterima, misalnya 0,02 untuk pembacaan grafik */
  tol: number;
  /**
   * Toleransi mutlak. Diperlukan bila nilai acuannya nol, karena toleransi
   * relatif terhadap nol selalu nol dan itu bukan yang dimaksud. Sisa
   * pembulatan dari pencarian akar tetap harus dianggap lolos.
   */
  absTol?: number;
  /** Alasan toleransinya sebesar itu, bila bukan ketelitian mesin */
  tolReason?: Bi<string>;
  unit?: string;
  /** Jumlah angka di belakang koma saat ditampilkan */
  digits?: number;
};

export const KIND_LABEL: Record<CheckKind, Bi<string>> = {
  terbitan: { id: "Nilai terbitan", en: "Published value" },
  sifat: { id: "Sifat matematis", en: "Mathematical property" },
  "pulang-pergi": { id: "Pulang pergi", en: "Round trip" },
  silang: { id: "Konsistensi silang", en: "Cross check" },
  perilaku: { id: "Perilaku", en: "Behaviour" },
};

export type CheckResult = {
  /** Selisih mutlak */
  diff: number;
  /** Selisih relatif terhadap acuan, dalam persen */
  pct: number;
  pass: boolean;
};

export function evaluate(c: Check): CheckResult {
  const diff = Math.abs(c.actual - c.expected);
  const denom = Math.abs(c.expected);
  const pct = denom > 1e-12 ? (diff / denom) * 100 : 0;
  const tol = denom * c.tol + (c.absTol ?? 1e-12);
  return { diff, pct, pass: diff <= tol };
}

/**
 * Menuliskan selisih dengan cara yang jujur.
 *
 * Selisih yang lebih kecil dari ketelitian yang wajar ditulis sebagai "nol",
 * bukan sebagai angka pecahan panjang yang menyiratkan ketelitian palsu.
 */
export function deviationText(c: Check, lang: Lang): string {
  const r = evaluate(c);
  if (r.diff === 0) return lang === "id" ? "nol" : "zero";
  if (Math.abs(c.expected) <= 1e-12) {
    return r.diff < 1e-9
      ? lang === "id"
        ? "nol"
        : "zero"
      : r.diff.toExponential(1);
  }
  if (r.pct < 0.0001) return lang === "id" ? "< 0,0001%" : "< 0.0001%";
  const s = r.pct.toFixed(r.pct < 1 ? 3 : 2);
  return lang === "id" ? `${s.replace(".", ",")}%` : `${s}%`;
}

/** Ringkasan satu lembar: berapa pemeriksaan, berapa yang lolos. */
export function summarise(checks: Check[]) {
  const passed = checks.filter((c) => evaluate(c).pass).length;
  return { total: checks.length, passed, allPass: passed === checks.length };
}
