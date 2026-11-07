/**
 * Bank soal HY-05 Regresi (KUIS.md putaran 2, termasuk revisi insinyur
 * 1 November).
 *
 * Tiap soal membawa tabelnya sendiri (x berkisi 0,1 kecuali butir 3 yang
 * memakai bilangan bulat kecil, y dibulatkan ke 0,01). Kunci dihitung pada
 * data yang SUDAH dibulatkan, yaitu data yang masuk tabel lembar lewat
 * "Muat data soal", dengan fitRegression/formulaValue yang sama dengan
 * lembar. Kurva sebenarnya hanya dipakai butir 2.
 *
 * Lembar ini tidak punya penggeser; "derajat" kuis bernilai 1 untuk garis
 * lurus (bentuk linear) dan 2–6 untuk polinomial, sama dengan tombol
 * derajat lembar.
 *
 * Soal contoh: belum ditelaah dosen pengampu (KUIS.md baris 4).
 */

import { fitRegression, formulaValue, type RegFit, type RegKind } from "../../lib/regression.ts";
import { C } from "../../lib/theme.ts";
import type { ParamDef } from "../../lib/rentang.ts";
import {
  acakKisi,
  bi,
  bulatAcak,
  buangDuplikat,
  cobaBenih,
  dataBerderau,
  fmtL,
  kocok,
  normal,
  pilihAcak,
  prng,
  seragam,
  turunan,
  xAcak,
  type BankKuis,
  type Bi,
  type Kesalahan,
  type LangkahKuis,
  type Pilihan,
  type Soal,
} from "../../lib/kuis.ts";
import { bulat, dataCocok, denganData, sidikData, type Titik } from "./dataSoal.ts";

/** Urutan bentuk sama dengan PresetRow lembar RegresiClient (KINDS). */
export const BENTUK_REG: RegKind[] = ["linear", "polinomial", "eksponensial", "pangkat", "logaritmik", "rata-bergerak"];

/** Derajat kuis: 1 = garis lurus, 2–6 = polinomial (DEGREES lembar). */
export const P_DERAJAT: ParamDef = { min: 1, max: 6, step: 1, digits: 0 };

/** Cocokan lembar untuk derajat kuis. */
export const cocokDerajat = (d: Titik[], deg: number): RegFit | null =>
  deg === 1 ? fitRegression(d, "linear") : fitRegression(d, "polinomial", deg);

type F = (v: number, d: number) => string;
type L = "id" | "en";
const langkahBi = (t: (f: F, l: L) => LangkahKuis[]): Bi<LangkahKuis[]> => ({
  id: t((v, d) => fmtL(v, d, "id"), "id"),
  en: t((v, d) => fmtL(v, d, "en"), "en"),
});

function cari<T>(benih: number, butir: number, bangun: (r: () => number) => T | null): T {
  return cobaBenih(benih, butir, bangun, () => {
    for (let i = 0; ; i++) {
      const v = bangun(prng(turunan(0x4805, butir, i)));
      if (v !== null) return v;
    }
  }, 400);
}

/** x berkisi 0,1 di [lo, hi] dengan lo 0,5–2 dan hi 6–12. */
function xData(r: () => number, n: number): number[] | null {
  const lo = bulat(seragam(r, 0.5, 2), 1);
  const hi = bulat(seragam(r, 6, 12), 1);
  const xs = xAcak(r, n, lo, hi, 0.1);
  return xs.length === n ? xs : null;
}

/** y = f(x) + derau normal σ, dibulatkan ke 0,01. */
const titikDerau = (r: () => number, xs: number[], f: (x: number) => number, sigma: number): Titik[] =>
  xs.map((x) => ({ x, y: bulat(f(x) + sigma * normal(r), 2) }));

const rentangY = (xs: number[], f: (x: number) => number) => {
  const ys = xs.map(f);
  return Math.max(...ys) - Math.min(...ys);
};

/** Tanda kurang yang terbaca: "y = 2,1 − 0,4·x", bukan "+ -0,4". */
const suku = (v: number, d: number, f: F, s: string) => (v < 0 ? ` − ${f(-v, d)}${s}` : ` + ${f(v, d)}${s}`);

const pembuka = (d: Titik[], l: L) =>
  l === "id"
    ? `Tekan Muat data soal untuk memasukkan ${d.length} pasangan x–y soal ini ke tabel lembar.`
    : `Press Load question data to put this question's ${d.length} x–y pairs into the sheet's table.`;

const NAMA: Record<"id" | "en", Record<string, string>> = {
  id: { linear: "Linear", polinomial: "Polinomial derajat 2", eksponensial: "Eksponensial", pangkat: "Pangkat", logaritmik: "Logaritmik" },
  en: { linear: "Linear", polinomial: "Degree-2 polynomial", eksponensial: "Exponential", pangkat: "Power", logaritmik: "Logarithmic" },
};

/* ------------------------------------------------------------------ *
 * B1 tebak: R² tinggi belum berarti bentuknya lurus
 * ------------------------------------------------------------------ */

function soal1(benih: number): Soal {
  const lengkung = prng(turunan(benih, 1, 100))() < 0.5;
  const s = cari(benih, 1, (r) => {
    const xs = xData(r, bulatAcak(r, 10, 15));
    if (!xs) return null;
    let d: Titik[];
    if (lengkung) {
      const a = seragam(r, 1, 5), b = seragam(r, 0.3, 2), c = seragam(r, 0.05, 0.4) * (r() < 0.5 ? -1 : 1);
      const f = (x: number) => a + b * x + c * x * x;
      d = titikDerau(r, xs, f, seragam(r, 0.01, 0.04) * rentangY(xs, f));
    } else {
      const a = seragam(r, 1, 5), b = seragam(r, 0.5, 3) * (r() < 0.5 ? -1 : 1);
      const f = (x: number) => a + b * x;
      const sigma = seragam(r, 0.02, 0.05) * rentangY(xs, f);
      d = titikDerau(r, xs, f, sigma);
      // Satu pencilan: 4–6 σ dari garis.
      const i = bulatAcak(r, 1, xs.length - 2);
      d[i] = { x: d[i].x, y: bulat(f(d[i].x) + seragam(r, 4, 6) * sigma * (r() < 0.5 ? -1 : 1), 2) };
    }
    const lin = fitRegression(d, "linear");
    const p2 = fitRegression(d, "polinomial", 2);
    if (!lin || !p2 || lin.r2 === null || p2.r2 === null || lin.r2 <= 0.85) return null;
    const rasio = p2.rmse / lin.rmse;
    if (lengkung ? !(rasio < 0.6) : !(rasio > 0.9)) return null;
    return { d, lin, p2, rasio };
  });
  const { d, lin, p2, rasio } = s;
  const kunci = lengkung ? "lengkung" : "cukup";
  const angka = bi((f, l) =>
    l === "id"
      ? `polinomial derajat 2 memberi RMSE ${f(p2.rmse, 3)} lawan ${f(lin.rmse, 3)} untuk garis lurus (rasio ${f(rasio, 2)})`
      : `a degree-2 polynomial gives RMSE ${f(p2.rmse, 3)} against ${f(lin.rmse, 3)} for the line (ratio ${f(rasio, 2)})`
  );
  const pilihan: Pilihan[] = [
    {
      id: "cukup",
      teks: {
        id: "Garis lurus cukup: polinomial derajat 2 hampir tidak menurunkan RMSE",
        en: "A line is enough: a degree-2 polynomial barely lowers the RMSE",
      },
      alasan: { id: `Di sini ${angka.id}: data ini melengkung.`, en: `Here ${angka.en}: these data are curved.` },
    },
    {
      id: "lengkung",
      teks: {
        id: "Garis lurus melewatkan lengkung: polinomial derajat 2 menurunkan RMSE jauh",
        en: "The line misses a curve: a degree-2 polynomial lowers the RMSE a lot",
      },
      alasan: {
        id: `Di sini ${angka.id}. Sisa galatnya acak dengan satu pencilan, bukan lengkung.`,
        en: `Here ${angka.en}. What is left is random scatter and one outlier, not a curve.`,
      },
    },
    {
      id: "r2",
      teks: {
        id: "R² di atas 0,85 sudah membuktikan bentuknya lurus",
        en: "An R² above 0.85 already proves the shape is straight",
      },
      alasan: {
        id: `R² hanya mengukur seberapa banyak ragam yang terjelaskan, bukan bentuknya. Bandingkan dengan bentuk lain: ${angka.id}.`,
        en: `R² only measures how much variance is explained, not the shape. Compare with another form: ${angka.en}.`,
      },
    },
    {
      id: "r2rendah",
      teks: {
        id: "R² di bawah 0,99 berarti datanya pasti melengkung",
        en: "An R² below 0.99 means the data must be curved",
      },
      alasan: {
        id: `Derau dan pencilan juga menurunkan R². Yang menentukan bentuk adalah apakah suku lengkung menurunkan galat: ${angka.id}.`,
        en: `Noise and outliers also lower R². What settles the shape is whether a curved term lowers the error: ${angka.en}.`,
      },
    },
  ];
  const q: Soal = {
    jenis: "tebak",
    id: "hy05-1",
    tanya: bi((f, l) =>
      l === "id"
        ? `${pembuka(d, l)} Garis lurus memberi R² = ${f(lin.r2!, 3)}. Tebak dulu sebelum mencoba polinomial: apakah garis lurus sudah menangkap bentuk data ini?`
        : `${pembuka(d, l)} A straight line gives R² = ${f(lin.r2!, 3)}. Guess before trying a polynomial: does the line already capture the shape of these data?`
    ),
    pilihan,
    kunci,
    bahas: bi((f, l) =>
      l === "id"
        ? `R² garis lurus ${f(lin.r2!, 4)}, polinomial derajat 2 ${f(p2.r2!, 4)}; ${angka.id}. ${lengkung ? "RMSE turun jauh, jadi ada lengkung yang dilewatkan garis lurus walaupun R²-nya sudah tinggi." : "RMSE hampir tidak turun: sisa galatnya derau dan satu pencilan, dan suku x² hanya mengikuti derau itu."} Lihat baris RMSE di tabel metrik dan bentuk sebaran titik di sekitar kurva.`
        : `Line R² ${f(lin.r2!, 4)}, degree-2 polynomial ${f(p2.r2!, 4)}; ${angka.en}. ${lengkung ? "The RMSE falls a lot, so the line misses a curve even though its R² is already high." : "The RMSE barely falls: what is left is noise and one outlier, and the x² term only chases that noise."} See the RMSE row in the metrics table and how the points scatter around the curve.`
    ),
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "Garis lurus" : "Straight line",
        rumus: "RMSE = √( SSres / n )",
        isi: `n = ${lin.n}`,
        hasil: f(lin.rmse, 4),
      },
      {
        judul: l === "id" ? "Polinomial derajat 2" : "Degree-2 polynomial",
        rumus: "RMSE = √( SSres / n )",
        isi: `n = ${p2.n}`,
        hasil: f(p2.rmse, 4),
      },
      {
        judul: l === "id" ? "Rasio" : "Ratio",
        rumus: "RMSE₂ / RMSE₁",
        isi: `${f(p2.rmse, 4)} / ${f(lin.rmse, 4)}`,
        hasil: f(rasio, 3),
        tint: C.water,
      },
    ]),
    masukan: { deg: 2, data: sidikData(d) },
  };
  return denganData(q, d);
}

/* ------------------------------------------------------------------ *
 * B2 pilih: bentuk terdekat ke y sebenarnya di 1,3·xMax
 * ------------------------------------------------------------------ */

type Benar = { f: (x: number) => number; teks: (f: F) => string };

function fungsiBenar(r: () => number): Benar {
  const jenis = pilihAcak(r, ["linear", "kuadrat", "eksp", "pangkat", "log"] as const);
  if (jenis === "linear") {
    const a = bulat(seragam(r, 1, 5), 2), b = bulat(seragam(r, 0.5, 3), 2);
    return { f: (x) => a + b * x, teks: (f) => `y = ${f(a, 2)} + ${f(b, 2)}·x` };
  }
  if (jenis === "kuadrat") {
    const a = bulat(seragam(r, 1, 5), 2), b = bulat(seragam(r, 0.3, 2), 2), c = bulat(seragam(r, 0.05, 0.3), 3);
    return { f: (x) => a + b * x + c * x * x, teks: (f) => `y = ${f(a, 2)} + ${f(b, 2)}·x + ${f(c, 3)}·x²` };
  }
  if (jenis === "eksp") {
    const a = bulat(seragam(r, 0.5, 3), 2), k = bulat(seragam(r, 0.1, 0.3), 3);
    return { f: (x) => a * Math.exp(k * x), teks: (f) => `y = ${f(a, 2)}·e^(${f(k, 3)}·x)` };
  }
  if (jenis === "pangkat") {
    const a = bulat(seragam(r, 0.5, 3), 2), p = bulat(r() < 0.5 ? seragam(r, 0.3, 0.8) : seragam(r, 1.3, 2), 2);
    return { f: (x) => a * Math.pow(x, p), teks: (f) => `y = ${f(a, 2)}·x^${f(p, 2)}` };
  }
  const a = bulat(seragam(r, 1, 5), 2), b = bulat(seragam(r, 1, 5), 2);
  return { f: (x) => a + b * Math.log(x), teks: (f) => `y = ${f(a, 2)} + ${f(b, 2)}·ln x` };
}

const BENTUK_B2 = ["linear", "polinomial", "eksponensial", "pangkat", "logaritmik"] as const;

function soal2(benih: number): Soal {
  const s = cari(benih, 2, (r) => {
    const xs = xData(r, bulatAcak(r, 10, 15));
    if (!xs) return null;
    const benar = fungsiBenar(r);
    const derau = bulat(seragam(r, 0.02, 0.05), 3);
    const d = dataBerderau(r, xs, benar.f, derau).map((p) => ({ x: p.x, y: bulat(p.y, 2) }));
    if (d.some((p) => p.y <= 0)) return null;
    const xMax = Math.max(...xs);
    const xs13 = 1.3 * xMax;
    const yT = benar.f(xs13);
    const fits = BENTUK_B2.map((k) => fitRegression(d, k, 2));
    if (fits.some((f) => !f || !f.predict)) return null;
    const nilai = fits.map((f) => f!.predict!(xs13));
    if (nilai.some((v) => !Number.isFinite(v))) return null;
    const galat = nilai.map((v) => Math.abs(v - yT));
    const urut = galat.slice().sort((a, b) => a - b);
    if (urut[1] - urut[0] < 0.05 * Math.abs(yT)) return null;
    return { d, benar, derau, xMax, xs13, yT, nilai, kunci: BENTUK_B2[galat.indexOf(urut[0])] };
  });
  const { d, benar, derau, xs13, yT, nilai, kunci } = s;
  const pilihan: Pilihan[] = BENTUK_B2.map((k, i) => ({
    id: k,
    teks: { id: NAMA.id[k], en: NAMA.en[k] },
    ...(k === kunci
      ? {}
      : {
          alasan: bi((f, l) =>
            l === "id"
              ? `Bentuk ini memberi ${f(nilai[i], 2)} di x = ${f(xs13, 2)}, meleset ${f(Math.abs(nilai[i] - yT), 2)} dari y sebenarnya ${f(yT, 2)}.`
              : `This form gives ${f(nilai[i], 2)} at x = ${f(xs13, 2)}, ${f(Math.abs(nilai[i] - yT), 2)} away from the true y ${f(yT, 2)}.`
          ),
        }),
  }));
  const kode = BENTUK_REG.indexOf(kunci);
  const q: Soal = {
    jenis: "pilih",
    id: "hy05-2",
    tanya: bi((f, l) =>
      l === "id"
        ? `${pembuka(d, l)} Data ini dibangkitkan dari ${benar.teks(f)} ditambah derau sampai ±${f(derau * 100, 1)} %. Bentuk garis tren mana, dicocokkan ke data itu, yang paling dekat ke y sebenarnya pada x = ${f(xs13, 2)} (1,3 kali x terbesar)?`
        : `${pembuka(d, l)} These data come from ${benar.teks(f)} plus noise of up to ±${f(derau * 100, 1)} %. Which trendline form, fitted to the data, comes closest to the true y at x = ${f(xs13, 2)} (1.3 times the largest x)?`
    ),
    pilihan,
    kunci,
    bahas: bi((f, l) =>
      l === "id"
        ? `y sebenarnya ${f(yT, 2)}. ${BENTUK_B2.map((k, i) => `${NAMA.id[k]} ${f(nilai[i], 2)}`).join(", ")}. Di luar data, bentuk rumus lebih menentukan daripada R²: bentuk yang sama dengan hukum pembangkitnya biasanya paling dekat. Pilih tiap bentuk di lembar dan masukkan x itu ke rumusnya.`
        : `The true y is ${f(yT, 2)}. ${BENTUK_B2.map((k, i) => `${NAMA.en[k]} ${f(nilai[i], 2)}`).join(", ")}. Outside the data the form of the formula matters more than R²: the form matching the generating law is usually closest. Select each form on the sheet and put that x into its formula.`
    ),
    langkah: langkahBi((f, l) =>
      BENTUK_B2.map((k, i) => ({
        judul: NAMA[l][k],
        rumus: "| ŷ − y |",
        isi: `| ${f(nilai[i], 3)} − ${f(yT, 3)} |`,
        hasil: f(Math.abs(nilai[i] - yT), 3),
        tint: k === kunci ? C.water : undefined,
      }))
    ),
    masukan: kunci === "linear" ? { deg: 1, data: sidikData(d) } : kunci === "polinomial" ? { deg: 2, data: sidikData(d) } : { bentuk: kode, data: sidikData(d) },
  };
  return Object.assign(denganData(q, d), { benar: benar.f });
}

/* ------------------------------------------------------------------ *
 * B3 hitung: R² garis lurus, lima titik bulat
 * ------------------------------------------------------------------ */

function soal3(benih: number): Soal {
  const s = cari(benih, 3, (r) => {
    const xs = kocok(r, [0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 5).sort((a, b) => a - b);
    const a = seragam(r, 0, 4), b = seragam(r, -1.5, 1.5);
    const d = xs.map((x) => ({ x, y: Math.round(a + b * x + seragam(r, -3, 3)) }));
    if (d.some((p) => p.y < 0 || p.y > 15)) return null;
    const f = fitRegression(d, "linear");
    if (!f || f.r2 === null || f.r2 < 0.4 || f.r2 > 0.92) return null;
    const n = d.length;
    const kesalahan: Kesalahan[] = buangDuplikat(
      { nilai: f.r2 },
      [
        {
          nilai: Math.sqrt(f.r2),
          alasan: {
            id: "Ini |r|, besar koefisien korelasi. Koefisien determinasi adalah kuadratnya, R² = r².",
            en: "This is |r|, the size of the correlation coefficient. The coefficient of determination is its square, R² = r².",
          },
        },
        {
          nilai: 1 - f.r2,
          alasan: {
            id: "Ini SSres/SStot tanpa \"1 −\": bagian ragam yang TIDAK terjelaskan garis.",
            en: "This is SSres/SStot without the \"1 −\": the share of variance the line does NOT explain.",
          },
        },
        {
          nilai: f.rmse * f.rmse,
          alasan: {
            id: "Ini SSres/n, rata-rata kuadrat galat. R² membagi SSres dengan SStot, bukan dengan n.",
            en: "This is SSres/n, the mean squared error. R² divides SSres by SStot, not by n.",
          },
        },
      ],
      { toleransi: 0.01, digits: 2 }
    );
    if (kesalahan.length < 2) return null;
    void n;
    return { d, f, kesalahan };
  });
  const { d, f, kesalahan } = s;
  const ys = d.map((p) => p.y);
  const my = ys.reduce((t, v) => t + v, 0) / ys.length;
  const ssTot = ys.reduce((t, v) => t + (v - my) ** 2, 0);
  const ssRes = d.reduce((t, p) => t + (p.y - formulaValue(f, p.x)) ** 2, 0);
  const daftar = (l: L) => d.map((p) => `(${p.x}; ${p.y})`).join(l === "id" ? ", " : ", ");
  const q: Soal = {
    jenis: "hitung",
    id: "hy05-3",
    tanya: bi((f2, l) =>
      l === "id"
        ? `Lima titik (x; y): ${daftar(l)}. Cocokkan garis lurus y = a + b·x dengan kuadrat terkecil, lalu hitung koefisien determinasinya R². Data soal ini juga dapat dimuat ke tabel lembar.`
        : `Five points (x; y): ${daftar(l)}. Fit a straight line y = a + b·x by least squares, then compute its coefficient of determination R². This question's data can also be loaded into the sheet's table.`
    ),
    kunci: f.r2!,
    toleransi: 0.01,
    digits: 2,
    satuan: { id: "", en: "" },
    kesalahan,
    bahas: bi((f2, l) =>
      l === "id"
        ? `Garis y = ${f2(f.coeffs[0], 3)}${suku(f.coeffs[1], 3, f2, "·x")}. SSres = ${f2(ssRes, 3)}, SStot = ${f2(ssTot, 3)}, jadi R² = 1 − ${f2(ssRes, 3)}/${f2(ssTot, 3)} = ${f2(f.r2!, 3)}. Lihat baris R² di tabel metrik dan langkahnya di Tunjukkan hitungan.`
        : `Line y = ${f2(f.coeffs[0], 3)}${suku(f.coeffs[1], 3, f2, "·x")}. SSres = ${f2(ssRes, 3)}, SStot = ${f2(ssTot, 3)}, so R² = 1 − ${f2(ssRes, 3)}/${f2(ssTot, 3)} = ${f2(f.r2!, 3)}. See the R² row in the metrics table and its steps under Show working.`
    ),
    langkah: langkahBi((f2, l) => [
      {
        judul: l === "id" ? "Garis kuadrat terkecil" : "Least-squares line",
        rumus: "b = Sxy / Sxx;  a = ȳ − b · x̄",
        isi: `x̄ = ${f2(d.reduce((t, p) => t + p.x, 0) / 5, 2)};  ȳ = ${f2(my, 2)}`,
        hasil: `a = ${f2(f.coeffs[0], 4)};  b = ${f2(f.coeffs[1], 4)}`,
      },
      {
        judul: l === "id" ? "Jumlah kuadrat" : "Sums of squares",
        rumus: "SSres = Σ( y − ŷ )²;  SStot = Σ( y − ȳ )²",
        isi: `n = 5`,
        hasil: `${f2(ssRes, 4)};  ${f2(ssTot, 4)}`,
      },
      {
        judul: l === "id" ? "Koefisien determinasi" : "Coefficient of determination",
        rumus: "R² = 1 − SSres / SStot",
        isi: `1 − ${f2(ssRes, 4)} / ${f2(ssTot, 4)}`,
        hasil: f2(f.r2!, 4),
        tint: C.water,
      },
    ]),
    masukan: { deg: 1, data: sidikData(d) },
  };
  return denganData(q, d);
}

/* ------------------------------------------------------------------ *
 * B4 atur: derajat polinomial terkecil dengan R² ≥ target
 * ------------------------------------------------------------------ */

const TARGET = [0.8, 0.85, 0.9, 0.93, 0.95, 0.97, 0.98, 0.99, 0.995, 0.998, 0.999];

function soal4(benih: number): Soal {
  const ingin = 2 + Math.floor(prng(turunan(benih, 4, 100))() * 3);
  const s = cari(benih, 4, (r) => {
    const xs = xData(r, bulatAcak(r, 10, 15));
    if (!xs) return null;
    const lo = xs[0], hi = xs[xs.length - 1];
    const akar = Array.from({ length: ingin }, () => seragam(r, lo + 0.1 * (hi - lo), hi - 0.1 * (hi - lo)));
    const g = (x: number) => akar.reduce((t, a) => t * (x - a), 1);
    const skala = 10 / (rentangY(xs, g) || 1);
    const c = seragam(r, 5, 20);
    const f = (x: number) => c + skala * g(x);
    const d = titikDerau(r, xs, f, seragam(r, 0.005, 0.03) * 10);
    const r2 = [0, ...[1, 2, 3, 4, 5, 6].map((k) => cocokDerajat(d, k)?.r2 ?? Number.NaN)];
    if (r2.slice(1).some((v) => !Number.isFinite(v))) return null;
    const sah = TARGET.filter((T) => r2[ingin - 1] <= T - 0.005 && r2[ingin] >= T + 0.005);
    if (!sah.length) return null;
    return { d, r2, T: pilihAcak(r, sah) };
  });
  const { d, r2, T } = s;
  const sidik = sidikData(d);
  return denganData(
    {
      jenis: "atur",
      id: "hy05-4",
      tanya: bi((f, l) =>
        l === "id"
          ? `${pembuka(d, l)} Mulai dari garis lurus, naikkan derajat polinomial satu per satu dan berhenti pada derajat TERKECIL yang memberi R² paling sedikit ${f(T, 3)}, lalu periksa. Derajat yang lebih tinggi daripada itu tidak dinilai benar.`
          : `${pembuka(d, l)} Starting from a straight line, raise the polynomial degree one step at a time and stop at the SMALLEST degree giving R² of at least ${f(T, 3)}, then check. A degree above that one is not marked correct.`
      ),
      ukur: (k) => {
        if (!dataCocok(k, sidik)) return Number.NaN;
        const deg = k.deg;
        if (!Number.isInteger(deg) || deg < 1 || deg > 6) return Number.NaN;
        // Hanya derajat TERKECIL yang dinilai: bila derajat di bawahnya
        // sudah mencapai target, derajat ini bukan jawabannya (ditulis "—").
        if (deg > 1 && (cocokDerajat(d, deg - 1)?.r2 ?? 0) >= T) return Number.NaN;
        return cocokDerajat(d, deg)?.r2 ?? Number.NaN;
      },
      langkahMin: 1,
      simbol: "R²",
      digits: 4,
      target: { min: T, max: 1 },
      geser: { kunci: "deg", p: P_DERAJAT },
      siapkan: { deg: 1, data: sidik },
      bahas: bi((f, l) => {
        const degMin = r2.findIndex((v, i) => i > 0 && v >= T);
        const baris = [1, 2, 3, 4, 5, 6].map((k) => `${k}: ${f(r2[k], 4)}`).join("; ");
        return l === "id"
          ? `R² menurut derajat (1 = garis lurus): ${baris}. Derajat terkecil yang mencapai ${f(T, 3)} adalah ${degMin}. Derajat di atasnya juga memenuhi R² itu, tetapi bukan yang terkecil, jadi tidak dinilai benar: suku tambahannya hanya mengikuti derau dan dapat berbelok tajam di luar data. Lihat baris R² di tabel metrik tiap kali derajat dinaikkan.`
          : `R² by degree (1 = straight line): ${baris}. The smallest degree reaching ${f(T, 3)} is ${degMin}. Higher degrees meet that R² too, but they are not the smallest, so they are not marked correct: their extra terms only chase noise and can swing sharply outside the data. Watch the R² row in the metrics table each time the degree goes up.`;
      }),
      langkah: langkahBi((f, l) =>
        [1, 2, 3, 4, 5, 6].map((k) => ({
          judul: k === 1 ? (l === "id" ? "Garis lurus" : "Straight line") : l === "id" ? `Polinomial derajat ${k}` : `Degree-${k} polynomial`,
          rumus: "R² = 1 − SSres / SStot",
          isi: `${r2[k] >= T ? "≥" : "<"} ${f(T, 3)}`,
          hasil: f(r2[k], 4),
          tint: r2[k] >= T && r2[k - 1] < T ? C.water : undefined,
        }))
      ),
    },
    d
  );
}

/* ------------------------------------------------------------------ *
 * B5 hitung: y pada x dari rumus garis lurus
 * ------------------------------------------------------------------ */

function soal5(benih: number): Soal {
  const s = cari(benih, 5, (r) => {
    const xs = xData(r, bulatAcak(r, 8, 12));
    if (!xs) return null;
    const a = seragam(r, -5, 10), b = seragam(r, 0.5, 4) * (r() < 0.5 ? -1 : 1);
    const lin = (x: number) => a + b * x;
    const d = titikDerau(r, xs, lin, seragam(r, 0.03, 0.08) * rentangY(xs, lin));
    const f = fitRegression(d, "linear");
    if (!f) return null;
    const xMax = xs[xs.length - 1];
    const x = acakKisi(r, { min: 0, max: 100, step: 0.1 }, xs[0], 1.2 * xMax);
    if (xs.some((v) => Math.abs(v - x) < 1e-9)) return null;
    const y = formulaValue(f, x);
    return Math.abs(y) >= 1 ? { d, f, x, y } : null;
  });
  const { d, f, x, y } = s;
  const [a, b] = f.coeffs;
  const tol = 0.01 * Math.abs(y);
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: y },
    [
      {
        nilai: b + a * x,
        alasan: {
          id: "Ini b + a·x: kedua koefisien tertukar. Pada rumus lembar, angka pertama adalah titik potong a, angka yang mengalikan x adalah kemiringan b.",
          en: "This is b + a·x: the two coefficients are swapped. In the sheet's formula the first number is the intercept a, the one multiplying x is the slope b.",
        },
      },
      {
        nilai: b * x,
        alasan: {
          id: "Ini b·x: titik potong a terlupa.",
          en: "This is b·x: the intercept a was left out.",
        },
      },
    ],
    { toleransi: tol, digits: 2 }
  );
  const q: Soal = {
    jenis: "hitung",
    id: "hy05-5",
    tanya: bi((f2, l) =>
      l === "id"
        ? `${pembuka(d, l)} Pilih bentuk linear, baca rumus garisnya, lalu hitung y pada x = ${f2(x, 1)}.`
        : `${pembuka(d, l)} Select the linear form, read the line's formula, then compute y at x = ${f2(x, 1)}.`
    ),
    kunci: y,
    toleransi: tol,
    digits: 2,
    satuan: { id: "", en: "" },
    kesalahan,
    bahas: bi((f2, l) =>
      l === "id"
        ? `Garisnya y = ${f2(a, 4)}${suku(b, 4, f2, "·x")}, jadi y(${f2(x, 1)}) = ${f2(y, 2)}. Lihat rumus di blok Rumus; rumus yang disalin sama dengan kurva yang tergambar.`
        : `The line is y = ${f2(a, 4)}${suku(b, 4, f2, "·x")}, so y(${f2(x, 1)}) = ${f2(y, 2)}. See the formula in the Formula block; the copied formula is the curve that is drawn.`
    ),
    langkah: langkahBi((f2, l) => [
      {
        judul: l === "id" ? "Koefisien garis" : "Line coefficients",
        rumus: "b = Sxy / Sxx;  a = ȳ − b · x̄",
        isi: `n = ${f.n}`,
        hasil: `a = ${f2(a, 4)};  b = ${f2(b, 4)}`,
      },
      {
        judul: l === "id" ? `Nilai pada x = ${f2(x, 1)}` : `Value at x = ${f2(x, 1)}`,
        rumus: "y = a + b · x",
        isi: `${f2(a, 4)} + ${b < 0 ? `( ${f2(b, 4)} )` : f2(b, 4)} · ${f2(x, 1)}`,
        hasil: f2(y, 2),
        tint: C.water,
      },
    ]),
    masukan: { deg: 1, data: sidikData(d) },
  };
  return Object.assign(denganData(q, d), { x });
}

export const HY05: BankKuis = {
  kode: "HY-05",
  jumlah: 5,
  buat: (benih) => [soal1(benih), soal2(benih), soal3(benih), soal4(benih), soal5(benih)],
};
