/**
 * Bank soal HY-06 Prediksi curah hujan (KUIS.md putaran 2, termasuk revisi
 * insinyur 1 November).
 *
 * Kunci TIDAK memakai keluaran ONNX. Butir 1–4 memakai deret berbenih 6–8
 * hari yang ditulis di soal (y hujan terukur bulat mm, p ramalan berkisi
 * 0,1 mm) dan score() dari forecast.ts, fungsi yang sama dengan tabel uji
 * lembar. Butir 5 memakai kumpulan deret tetap (hy06Deret.ts, dibangkitkan
 * scripts/bangun-deret-hy06.ts) yang kelas bentuk ramalannya dihitung
 * dengan forecastArima(fitArima(y, orde), 30) dan diperiksa ulang uji.
 *
 * Soal contoh: belum ditelaah dosen pengampu (KUIS.md baris 4).
 */

import { score, type Skor } from "../../lib/forecast.ts";
import { C } from "../../lib/theme.ts";
import {
  bi,
  bulatAcak,
  buangDuplikat,
  cobaBenih,
  fmtL,
  normal,
  prng,
  seragam,
  turunan,
  type BankKuis,
  type Bi,
  type Kesalahan,
  type LangkahKuis,
  type Pilihan,
  type Soal,
} from "../../lib/kuis.ts";
import { denganDeret } from "./dataSoal.ts";
import { DERET_HY06 } from "./hy06Deret.ts";
import { PRESET_HY06, type Bentuk, type PresetHY06 } from "./hy06Bentuk.ts";

type F = (v: number, d: number) => string;
type L = "id" | "en";
const langkahBi = (t: (f: F, l: L) => LangkahKuis[]): Bi<LangkahKuis[]> => ({
  id: t((v, d) => fmtL(v, d, "id"), "id"),
  en: t((v, d) => fmtL(v, d, "en"), "en"),
});

function cari<T>(benih: number, butir: number, bangun: (r: () => number) => T | null): T {
  return cobaBenih(benih, butir, bangun, () => {
    for (let i = 0; ; i++) {
      const v = bangun(prng(turunan(0x4806, butir, i)));
      if (v !== null) return v;
    }
  }, 400);
}

const b1 = (v: number) => Math.round(v * 10) / 10;

/** Hujan harian 6–8 hari, bulat mm, ≥ 2 hari kering (0) dan ≥ 2 hari hujan. */
function hujan(r: () => number): number[] | null {
  const n = bulatAcak(r, 6, 8);
  const y = Array.from({ length: n }, () => (r() < 0.35 ? 0 : bulatAcak(r, 1, 40)));
  return y.filter((v) => v === 0).length >= 2 && y.filter((v) => v >= 1).length >= 2 ? y : null;
}

/** Ramalan model: beberapa watak galat, ≥ 0, berkisi 0,1 mm. */
function ramalan(r: () => number, y: number[]): number[] {
  const rata = y.reduce((s, v) => s + v, 0) / y.length;
  const watak = Math.floor(r() * 3);
  const sd = seragam(r, 1, 8);
  const a = seragam(r, 0.3, 1);
  const besar = Math.floor(r() * y.length);
  return y.map((v, i) => {
    let p = v + sd * normal(r);
    if (watak === 1) p = a * v + (1 - a) * rata + 0.5 * sd * normal(r);
    if (watak === 2 && i === besar) p = v + (r() < 0.5 ? -1 : 1) * seragam(r, 15, 30);
    return b1(Math.max(0, p));
  });
}

const deretTeks = (v: number[], f: F, d: number) => v.map((x) => f(x, d)).join("; ");
const teksYP = (y: number[], p: number[], f: F, l: L) =>
  l === "id"
    ? `Hujan terukur y = ${deretTeks(y, f, 0)} mm dan ramalan model p = ${deretTeks(p, f, 1)} mm (${y.length} hari berurutan).`
    : `Measured rainfall y = ${deretTeks(y, f, 0)} mm and model forecast p = ${deretTeks(p, f, 1)} mm (${y.length} consecutive days).`;

const jumlah = (v: number[]) => v.reduce((s, x) => s + x, 0);

function denganYP<S extends Soal>(s: S, y: number[], p: number[]): S {
  return Object.assign(s, { y, p });
}

/* ------------------------------------------------------------------ *
 * B1 hitung: NSE
 * ------------------------------------------------------------------ */

function soal1(benih: number): Soal {
  const s = cari(benih, 1, (r) => {
    const y = hujan(r);
    if (!y) return null;
    const p = ramalan(r, y);
    const sk = score(y, p);
    return Number.isFinite(sk.nse) && sk.nse >= -1 && sk.nse <= 0.95 ? { y, p, sk } : null;
  });
  const { y, p, sk } = s;
  const rata = jumlah(y) / y.length;
  const ssRes = jumlah(y.map((v, i) => (v - p[i]) ** 2));
  const ssTot = jumlah(y.map((v) => (v - rata) ** 2));
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: sk.nse },
    [
      {
        nilai: ssRes / ssTot,
        alasan: {
          id: "Ini Σ(y − p)² / Σ(y − ȳ)² tanpa \"1 −\": bagian ragam yang TIDAK dijelaskan model.",
          en: "This is Σ(y − p)² / Σ(y − ȳ)² without the \"1 −\": the share of variance the model does NOT explain.",
        },
      },
      {
        nilai: 1 - jumlah(y.map((v, i) => Math.abs(v - p[i]))) / jumlah(y.map((v) => Math.abs(v - rata))),
        alasan: {
          id: "Ini memakai selisih mutlak. NSE memakai kuadrat selisih, sehingga satu hari yang meleset jauh sangat menurunkannya.",
          en: "This uses absolute differences. NSE uses squared differences, so one badly missed day pulls it down hard.",
        },
      },
    ],
    { toleransi: 0.02, digits: 2 }
  );
  const q: Soal = {
    jenis: "hitung",
    id: "hy06-1",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksYP(y, p, f, l)} Hitung koefisien Nash-Sutcliffe NSE ramalan ini.`
        : `${teksYP(y, p, f, l)} Compute the Nash-Sutcliffe efficiency NSE of this forecast.`
    ),
    kunci: sk.nse,
    toleransi: 0.02,
    digits: 2,
    satuan: { id: "", en: "" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `ȳ = ${f(rata, 2)} mm, Σ(y − p)² = ${f(ssRes, 2)}, Σ(y − ȳ)² = ${f(ssTot, 2)}, jadi NSE = 1 − ${f(ssRes, 2)}/${f(ssTot, 2)} = ${f(sk.nse, 3)}. NSE nol berarti sama baiknya dengan selalu menebak rata-rata; negatif berarti lebih buruk. Lihat baris NSE di tabel uji lembar. Baris itu memakai rumus yang sama pada data lembar, bukan data soal ini.`
        : `ȳ = ${f(rata, 2)} mm, Σ(y − p)² = ${f(ssRes, 2)}, Σ(y − ȳ)² = ${f(ssTot, 2)}, so NSE = 1 − ${f(ssRes, 2)}/${f(ssTot, 2)} = ${f(sk.nse, 3)}. An NSE of zero is as good as always guessing the mean; negative is worse. See the NSE row in the sheet's test table. That row uses the same formula on the sheet's data, not this question's data.`
    ),
    langkah: langkahBi((f, l) => [
      { judul: l === "id" ? "Rata-rata terukur" : "Measured mean", rumus: "ȳ = Σy / n", isi: `${f(jumlah(y), 0)} / ${y.length}`, hasil: f(rata, 3), satuan: "mm" },
      { judul: l === "id" ? "Jumlah kuadrat galat" : "Sum of squared errors", rumus: "Σ( y − p )²", isi: `n = ${y.length}`, hasil: f(ssRes, 3) },
      { judul: l === "id" ? "Jumlah kuadrat terhadap rata-rata" : "Sum of squares about the mean", rumus: "Σ( y − ȳ )²", isi: `n = ${y.length}`, hasil: f(ssTot, 3) },
      { judul: "NSE", rumus: "NSE = 1 − Σ( y − p )² / Σ( y − ȳ )²", isi: `1 − ${f(ssRes, 3)} / ${f(ssTot, 3)}`, hasil: f(sk.nse, 3), tint: C.water },
    ]),
  };
  return denganYP(q, y, p);
}

/* ------------------------------------------------------------------ *
 * B2 hitung: MAE persistensi
 * ------------------------------------------------------------------ */

function soal2(benih: number): Soal {
  const s = cari(benih, 2, (r) => {
    const y = hujan(r);
    if (!y) return null;
    const k = score(y.slice(1), y.slice(0, -1)).mae;
    return k > 0 ? { y, p: ramalan(r, y), k } : null;
  });
  const { y, p, k } = s;
  const tol = Math.max(0.06, 0.01 * k);
  const beda = y.slice(1).map((v, i) => Math.abs(v - y[i]));
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: k },
    [
      {
        nilai: jumlah(beda) / y.length,
        alasan: {
          id: `Ini membagi dengan ${y.length}. Hari pertama tidak punya "kemarin", jadi persistensi hanya dinilai pada ${y.length - 1} hari.`,
          en: `This divides by ${y.length}. The first day has no "yesterday", so persistence is scored on ${y.length - 1} days only.`,
        },
      },
      {
        nilai: Math.sqrt(jumlah(beda.map((v) => v * v)) / beda.length),
        alasan: {
          id: "Ini RMSE persistensi (akar rata-rata kuadrat). MAE merata-ratakan selisih mutlaknya.",
          en: "This is the persistence RMSE (root mean square). MAE averages the absolute differences.",
        },
      },
    ],
    { toleransi: tol, digits: 2 }
  );
  const q: Soal = {
    jenis: "hitung",
    id: "hy06-2",
    tanya: bi((f, l) =>
      l === "id"
        ? `Hujan terukur y = ${deretTeks(y, f, 0)} mm (${y.length} hari berurutan). Ramalan persistensi berkata "besok sama dengan hari ini". Hitung MAE ramalan persistensi itu.`
        : `Measured rainfall y = ${deretTeks(y, f, 0)} mm (${y.length} consecutive days). A persistence forecast says "tomorrow equals today". Compute the MAE of that persistence forecast.`
    ),
    kunci: k,
    toleransi: tol,
    digits: 2,
    satuan: { id: "mm", en: "mm" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `Selisih mutlak hari berurutan ${deretTeks(beda, f, 0)} mm, jumlahnya ${f(jumlah(beda), 0)} mm pada ${beda.length} hari, jadi MAE = ${f(k, 3)} mm. Persistensi adalah pembanding paling sederhana; model yang tidak mengalahkannya belum berguna. Lihat baris persistensi di tabel uji lembar. Baris itu memakai rumus yang sama pada data lembar, bukan data soal ini.`
        : `The absolute day-to-day differences are ${deretTeks(beda, f, 0)} mm, summing to ${f(jumlah(beda), 0)} mm over ${beda.length} days, so MAE = ${f(k, 3)} mm. Persistence is the simplest benchmark; a model that does not beat it is not yet useful. See the persistence row in the sheet's test table. That row uses the same formula on the sheet's data, not this question's data.`
    ),
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "Selisih dengan hari sebelumnya" : "Difference from the day before",
        rumus: "| yₜ − yₜ₋₁ |,  t = 2 … n",
        isi: deretTeks(beda, f, 0),
        hasil: f(jumlah(beda), 0),
        satuan: "mm",
      },
      { judul: "MAE", rumus: "MAE = Σ| yₜ − yₜ₋₁ | / ( n − 1 )", isi: `${f(jumlah(beda), 0)} / ${beda.length}`, hasil: f(k, 3), satuan: "mm", tint: C.water },
    ]),
  };
  return denganYP(q, y, p);
}

/* ------------------------------------------------------------------ *
 * B3 pilih: model lawan persistensi dan rata-rata, pada hari yang sama
 * ------------------------------------------------------------------ */

const SKENARIO = ["baik-rata", "baik-bawah", "buruk-rata", "buruk-bawah"] as const;
type Skenario = (typeof SKENARIO)[number];

function soal3(benih: number): Soal {
  const u = prng(turunan(benih, 3, 100))();
  const ingin: Skenario = u < 0.4 ? "baik-bawah" : SKENARIO[[0, 2, 3][Math.floor(((u - 0.4) / 0.6) * 3)]];
  const s = cari(benih, 3, (r) => {
    const y = hujan(r);
    if (!y) return null;
    const p = ramalan(r, y);
    const m = score(y.slice(1), p.slice(1));
    const ps = score(y.slice(1), y.slice(0, -1));
    if (!Number.isFinite(m.nse) || Math.abs(m.mae - ps.mae) < 0.1 * ps.mae || Math.abs(m.nse) < 0.05) return null;
    const sk = `${m.mae < ps.mae ? "baik" : "buruk"}-${m.nse > 0 ? "rata" : "bawah"}` as Skenario;
    return sk === ingin ? { y, p, m, ps } : null;
  });
  const { y, p, m, ps } = s;
  const angka = (f: F, l: L) =>
    l === "id"
      ? `Pada hari 2–${y.length}: MAE model ${f(m.mae, 2)} mm lawan persistensi ${f(ps.mae, 2)} mm; NSE model ${f(m.nse, 2)}.`
      : `On days 2–${y.length}: model MAE ${f(m.mae, 2)} mm against persistence ${f(ps.mae, 2)} mm; model NSE ${f(m.nse, 2)}.`;
  const teks: Record<Skenario, Bi<string>> = {
    "baik-rata": {
      id: "Mengalahkan \"besok sama dengan hari ini\" (MAE lebih kecil) dan lebih baik daripada menebak rata-rata (NSE > 0)",
      en: "Beats \"tomorrow equals today\" (smaller MAE) and is better than guessing the mean (NSE > 0)",
    },
    "baik-bawah": {
      id: "Mengalahkan \"besok sama dengan hari ini\", tetapi tidak lebih baik daripada menebak rata-rata (NSE < 0)",
      en: "Beats \"tomorrow equals today\", but is no better than guessing the mean (NSE < 0)",
    },
    "buruk-rata": {
      id: "Kalah dari \"besok sama dengan hari ini\", tetapi lebih baik daripada menebak rata-rata",
      en: "Loses to \"tomorrow equals today\", but is better than guessing the mean",
    },
    "buruk-bawah": {
      id: "Kalah dari keduanya",
      en: "Loses to both",
    },
  };
  const pilihan: Pilihan[] = SKENARIO.map((k) => ({
    id: k,
    teks: teks[k],
    ...(k === ingin ? {} : { alasan: bi((f, l) => angka(f, l)) }),
  }));
  const q: Soal = {
    jenis: "pilih",
    id: "hy06-3",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksYP(y, p, f, l)} Bandingkan pada hari yang sama, hari 2 sampai ${y.length} (hari pertama tidak punya "kemarin"): MAE model lawan MAE persistensi, dan NSE model. Mana yang benar?`
        : `${teksYP(y, p, f, l)} Compare on the same days, day 2 to ${y.length} (the first day has no "yesterday"): model MAE against persistence MAE, and the model NSE. Which is right?`
    ),
    pilihan,
    kunci: ingin,
    bahas: bi((f, l) =>
      l === "id"
        ? `${angka(f, l)} MAE merata-ratakan selisih mutlak: satu hari yang meleset 20 mm menambah MAE sama besar dengan dua hari yang meleset 10 mm. NSE memakai kuadrat selisih, jadi satu hari yang meleset jauh bisa membuatnya negatif walaupun MAE-nya kecil. Dua ukuran itu menjawab dua pertanyaan berbeda. Lihat tabel uji lembar: baris model dan persistensi dihitung pada hari yang sama. Baris-baris itu memakai rumus yang sama pada data lembar, bukan data soal ini.`
        : `${angka(f, l)} MAE averages absolute differences: one day missed by 20 mm adds as much to MAE as two days missed by 10 mm. NSE uses squared differences, so one badly missed day can make it negative even with a small MAE. The two measures answer two different questions. See the sheet's test table: the model and persistence rows are computed on the same days. Those rows use the same formula on the sheet's data, not this question's data.`
    ),
    langkah: langkahBi((f, l) => [
      { judul: l === "id" ? "Model, hari 2 … n" : "Model, days 2 … n", rumus: "MAE = Σ| y − p | / ( n − 1 )", isi: `n − 1 = ${y.length - 1}`, hasil: f(m.mae, 3), satuan: "mm", tint: C.water },
      { judul: l === "id" ? "Persistensi, hari 2 … n" : "Persistence, days 2 … n", rumus: "MAE = Σ| yₜ − yₜ₋₁ | / ( n − 1 )", isi: `n − 1 = ${y.length - 1}`, hasil: f(ps.mae, 3), satuan: "mm" },
      { judul: l === "id" ? "NSE model, hari 2 … n" : "Model NSE, days 2 … n", rumus: "NSE = 1 − Σ( y − p )² / Σ( y − ȳ )²", isi: `n − 1 = ${y.length - 1}`, hasil: f(m.nse, 3) },
    ]),
  };
  return denganYP(q, y, p);
}

/* ------------------------------------------------------------------ *
 * B4 hitung: AUC ambang 1 mm
 * ------------------------------------------------------------------ */

function soal4(benih: number): Soal {
  const s = cari(benih, 4, (r) => {
    const y = hujan(r);
    if (!y) return null;
    const p = ramalan(r, y);
    const sk: Skor = score(y, p);
    return sk.auc !== null && sk.auc >= 0.55 && sk.auc <= 0.95 ? { y, p, auc: sk.auc } : null;
  });
  const { y, p, auc } = s;
  const pos = p.filter((_, i) => y[i] >= 1);
  const neg = p.filter((_, i) => y[i] < 1);
  let menang = 0;
  for (const a of pos) for (const b of neg) menang += a > b ? 1 : a === b ? 0.5 : 0;
  const tepat = y.filter((v, i) => (v >= 1) === (p[i] >= 1)).length / y.length;
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: auc },
    [
      {
        nilai: 1 - auc,
        alasan: {
          id: "Ini 1 − AUC: pasangan dihitung terbalik. AUC menghitung pasangan (hari hujan, hari kering) yang ramalan hari hujannya LEBIH BESAR.",
          en: "This is 1 − AUC: the pairs are counted the wrong way round. AUC counts the (wet day, dry day) pairs where the wet day's forecast is LARGER.",
        },
      },
      {
        nilai: tepat,
        alasan: {
          id: "Ini ketepatan pada ambang 1 mm (bagian hari yang hujan/keringnya ditebak benar). AUC tidak memakai ambang pada ramalan; ia membandingkan urutan ramalan.",
          en: "This is the accuracy at a 1 mm threshold (share of days called wet or dry correctly). AUC puts no threshold on the forecast; it compares the forecast ranking.",
        },
      },
    ],
    { toleransi: 0.02, digits: 2 }
  );
  const q: Soal = {
    jenis: "hitung",
    id: "hy06-4",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksYP(y, p, f, l)} Hari hujan adalah hari dengan y ≥ 1 mm. Hitung AUC ramalan p untuk membedakan hari hujan dari hari kering.`
        : `${teksYP(y, p, f, l)} A wet day is a day with y ≥ 1 mm. Compute the AUC of forecast p for telling wet days from dry days.`
    ),
    kunci: auc,
    toleransi: 0.02,
    digits: 2,
    satuan: { id: "", en: "" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `${pos.length} hari hujan dan ${neg.length} hari kering memberi ${pos.length * neg.length} pasangan; pada ${f(menang, 1)} pasangan ramalan hari hujan lebih besar (seri dihitung setengah). AUC = ${f(menang, 1)}/${pos.length * neg.length} = ${f(auc, 3)}. AUC 0,5 berarti tidak lebih baik daripada mengundi. Lihat baris AUC di tabel uji lembar. Baris itu memakai rumus yang sama pada data lembar, bukan data soal ini.`
        : `${pos.length} wet and ${neg.length} dry days make ${pos.length * neg.length} pairs; in ${f(menang, 1)} of them the wet day's forecast is larger (ties count half). AUC = ${f(menang, 1)}/${pos.length * neg.length} = ${f(auc, 3)}. An AUC of 0.5 is no better than a coin toss. See the AUC row in the sheet's test table. That row uses the same formula on the sheet's data, not this question's data.`
    ),
    langkah: langkahBi((f, l) => [
      { judul: l === "id" ? "Ramalan pada hari hujan" : "Forecasts on wet days", rumus: "p | y ≥ 1 mm", isi: deretTeks(pos, f, 1), hasil: String(pos.length), satuan: l === "id" ? "hari" : "days" },
      { judul: l === "id" ? "Ramalan pada hari kering" : "Forecasts on dry days", rumus: "p | y < 1 mm", isi: deretTeks(neg, f, 1), hasil: String(neg.length), satuan: l === "id" ? "hari" : "days" },
      { judul: "AUC", rumus: "AUC = [ #( p_hujan > p_kering ) + ½ · #( p_hujan = p_kering ) ] / ( n_hujan · n_kering )", isi: `${f(menang, 1)} / ${pos.length * neg.length}`, hasil: f(auc, 3), tint: C.water },
    ]),
  };
  return denganYP(q, y, p);
}

/* ------------------------------------------------------------------ *
 * B5 tebak: bentuk ramalan ARIMA 30 hari
 * ------------------------------------------------------------------ */

const NAMA_ORDE: Record<PresetHY06, string> = {
  "111": "ARIMA(1,1,1)",
  "211": "ARIMA(2,1,1)",
  "112": "ARIMA(1,1,2)",
  sarima7: "SARIMA(1,1,1)(1,1,1)7",
};
const POLA: Record<"acak" | "mingguan" | "tren", Bi<string>> = {
  acak: { id: "berubah acak dari hari ke hari tanpa pola", en: "varies randomly from day to day with no pattern" },
  mingguan: { id: "naik turun berulang tiap tujuh hari", en: "rises and falls in a repeating seven-day cycle" },
  tren: { id: "naik terus dan makin cepat", en: "keeps rising, faster and faster" },
};
const BENTUK_TEKS: Record<Bentuk, Bi<string>> = {
  mendatar: { id: "Mendatar: ramalan mendekati satu nilai tetap", en: "Flat: the forecast settles at one constant value" },
  tren: { id: "Tren lurus: terus naik atau turun hampir sama besar tiap hari", en: "Straight trend: keeps rising or falling by nearly the same amount each day" },
  mingguan: { id: "Mingguan: pola tujuh hari yang berulang", en: "Weekly: a repeating seven-day pattern" },
};
const SEBAB: Record<Bentuk, Bi<string>> = {
  mendatar: {
    id: "Model ARIMA dengan satu kali diferensiasi dan tanpa suku musiman melupakan pola jangka pendek: ramalannya cepat mendatar di sekitar nilai terakhir yang dihaluskan. Pola mingguan pun tidak terbawa bila ordenya tidak punya suku musiman 7.",
    en: "An ARIMA model with one difference and no seasonal term forgets short-term patterns: its forecast quickly levels off near a smoothed last value. Even a weekly pattern is not carried unless the order has a seasonal term of 7.",
  },
  tren: {
    id: "Deretnya naik makin cepat, jadi kenaikan hariannya sendiri bertahan lama. Pada deret yang sudah didiferensiasi (d = 1), koefisien AR (pada AR(2): jumlah kedua koefisiennya) sekitar 0,99, jadi kenaikan harian ramalan hanya menyusut sekitar 1 % per hari dan ramalannya tampak hampir lurus sampai hari ke-30. Tanpa suku konstanta (drift), ramalan ini tetap akan mendatar jauh sesudahnya.",
    en: "The series rises faster and faster, so its daily rise itself persists. On the differenced series (d = 1) the AR coefficient (for AR(2), the sum of both) is about 0.99, so the forecast's daily rise shrinks by only about 1 % a day and the forecast looks almost straight up to day 30. Without a constant (drift) term it would still level off far beyond that.",
  },
  mingguan: {
    id: "Diferensiasi musiman D = 1 dengan s = 7 membuat ramalan hari t bertumpu pada hari t − 7, dan suku musiman AR dan MA menimbang pola minggu-minggu sebelumnya. Pola mingguan yang dipelajari dari deret itu terbawa ke depan, jadi ramalannya berulang tiap tujuh hari.",
    en: "Seasonal differencing D = 1 with s = 7 makes the forecast for day t build on day t − 7, and the seasonal AR and MA terms weigh the pattern of earlier weeks. The weekly pattern learned from the series is carried forward, so the forecast repeats every seven days.",
  },
};

function soal5(benih: number): Soal {
  const j = Math.floor(prng(turunan(benih, 5, 0))() * DERET_HY06.length);
  const d = DERET_HY06[j];
  const rata = jumlah(d.y) / d.y.length;
  const urutan: Bentuk[] = ["mendatar", "tren", "mingguan"];
  const pilihan: Pilihan[] = urutan.map((k) => ({
    id: k,
    teks: BENTUK_TEKS[k],
    ...(k === d.bentuk ? {} : { alasan: SEBAB[d.bentuk] }),
  }));
  const q: Soal = {
    jenis: "tebak",
    id: "hy06-5",
    tanya: bi((f, l) =>
      l === "id"
        ? `${d.pola === "tren" ? "Deret latihan" : "Deret hujan harian"} ${d.y.length} hari (rata-rata ${f(rata, 1)} mm) ${POLA[d.pola].id}. Model ${NAMA_ORDE[d.preset]} dicocokkan ke seluruh deret, lalu meramal 30 hari. Tebak dulu: seperti apa bentuk ramalan hari ke-23 sampai ke-30? Sesudah menjawab, deret dan model ini dipasang di lembar.`
        : `${d.pola === "tren" ? "A training series" : "A daily rainfall series"} of ${d.y.length} days (mean ${f(rata, 1)} mm) ${POLA[d.pola].en}. A ${NAMA_ORDE[d.preset]} model is fitted to the whole series and forecasts 30 days. Guess first: what shape does the forecast take on days 23 to 30? After you answer, this series and model are set on the sheet.`
    ),
    pilihan,
    kunci: d.bentuk,
    bahas: bi((_f, l) =>
      l === "id"
        ? `${BENTUK_TEKS[d.bentuk].id}. ${SEBAB[d.bentuk].id} Lihat ramalan 30 hari (garis putus biru) di grafik lembar.`
        : `${BENTUK_TEKS[d.bentuk].en}. ${SEBAB[d.bentuk].en} See the 30-day forecast (blue dashed line) on the sheet's graph.`
    ),
    masukan: { preset: PRESET_HY06.indexOf(d.preset), h: 30 },
  };
  return denganDeret(q, d.y);
}

export const HY06: BankKuis = {
  kode: "HY-06",
  jumlah: 5,
  buat: (benih) => [soal1(benih), soal2(benih), soal3(benih), soal4(benih), soal5(benih)],
};
