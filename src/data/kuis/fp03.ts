/**
 * Bank soal FP-03 Gelombang linear (KUIS.md, termasuk revisi insinyur
 * 1 November).
 *
 * Semua masukan jatuh di kisi penggeser lembar (T 1–60 s langkah 0,5;
 * h 0,5–500 m langkah 0,5; H 0,1–6 m langkah 0,1), dan semua kunci dihitung
 * SESUDAH pembulatan itu lewat linearWave(T, h, H), fungsi yang sama dengan
 * lembar. Pita rezim memakai h/L dengan batas 1/20 dan 1/2 (WAVE_SHALLOW,
 * WAVE_DEEP; Dean & Dalrymple 1991 Tab. 3.1).
 *
 * Soal contoh: belum ditelaah dosen pengampu (KUIS.md baris 4).
 */

import { G, WAVE_DEEP, linearWave, type LinearWave } from "../../lib/hydraulics.ts";
import { C } from "../../lib/theme.ts";
import type { ParamDef } from "../../lib/rentang.ts";
import {
  acakKisi,
  bi,
  buangDuplikat,
  bulatKeLangkah,
  cobaBenih,
  fmtL,
  kisi,
  prng,
  seragam,
  turunan,
  type BankKuis,
  type Bi,
  type Kesalahan,
  type Keadaan,
  type LangkahKuis,
  type Pilihan,
  type Soal,
} from "../../lib/kuis.ts";

/** Sama dengan InputRow lembar GelombangLinearClient. */
export const P_T: ParamDef = { min: 1, max: 60, step: 0.5, digits: 1 };
export const P_H: ParamDef = { min: 0.5, max: 500, step: 0.5, digits: 1 };
export const P_A: ParamDef = { min: 0.1, max: 6, step: 0.1, digits: 1 };

type Rezim = LinearWave["regime"];
export const REZIM: Record<"id" | "en", Record<Rezim, string>> = {
  id: { dangkal: "Air dangkal", menengah: "Kedalaman menengah", dalam: "Air dalam" },
  en: { dangkal: "Shallow water", menengah: "Intermediate depth", dalam: "Deep water" },
};

/** Panggilan linearWave yang sama dengan lembar. */
export const gelombangLembar = (k: Keadaan): LinearWave => linearWave(k.T, k.h, k.H);

type F = (v: number, d: number) => string;
const langkahBi = (t: (f: F, l: "id" | "en") => LangkahKuis[]): Bi<LangkahKuis[]> => ({
  id: t((v, d) => fmtL(v, d, "id"), "id"),
  en: t((v, d) => fmtL(v, d, "en"), "en"),
});

/** Periode yang memberi panjang gelombang L di kedalaman h (hubungan sebaran dibalik). */
const periodeUntuk = (L: number, h: number) => {
  const k = (2 * Math.PI) / L;
  return (2 * Math.PI) / Math.sqrt(G * k * Math.tanh(k * h));
};

/** h log-seragam di kisi [lo, hi]. */
const hAcak = (r: () => number, lo: number, hi: number) =>
  bulatKeLangkah(Math.exp(seragam(r, Math.log(lo), Math.log(hi))), P_H);

/** Tinggi gelombang kecil yang jauh dari pecah: ≤ 1 m dan ≤ 0,3·h. */
const tinggiAman = (h: number) => bulatKeLangkah(Math.max(0.1, Math.min(1, 0.3 * h)), P_A);

const teksTh = (m: Keadaan, f: F, l: "id" | "en") =>
  l === "id"
    ? `Gelombang berperiode T = ${f(m.T, 1)} s merambat di air sedalam h = ${f(m.h, 1)} m.`
    : `A wave of period T = ${f(m.T, 1)} s travels in water of depth h = ${f(m.h, 1)} m.`;

const langkahL = (m: Keadaan, w: LinearWave, f: F, l: "id" | "en"): LangkahKuis[] => [
  {
    judul: l === "id" ? "Panjang gelombang air dalam" : "Deep-water wavelength",
    rumus: "L₀ = g T² / ( 2π )",
    isi: `${f(G, 2)} · ${f(m.T, 1)}² / ( 2π )`,
    hasil: f(w.deepLength, 2),
    satuan: "m",
  },
  {
    judul: l === "id" ? "Hubungan sebaran, diselesaikan bagi dua" : "Dispersion relation, solved by bisection",
    rumus: "L = L₀ · tanh( 2π h / L )",
    isi: `${f(w.deepLength, 2)} · tanh( 2π · ${f(m.h, 1)} / ${f(w.length, 2)} )`,
    hasil: f(w.length, 2),
    satuan: "m",
    tint: C.water,
  },
];

/* ------------------------------------------------------------------ *
 * B1 pilih: rezim kedalaman menurut h/L
 * ------------------------------------------------------------------ */

const SASARAN: Record<Rezim, [number, number]> = {
  dangkal: [0.006, 0.035],
  menengah: [0.07, 0.35],
  dalam: [0.65, 2],
};
const diMargin = (r: number) => !(r >= 0.04 && r <= 0.06) && !(r >= 0.4 && r <= 0.6);

function keadaanRezim(r: () => number, rez: Rezim, hLo = 0.5, hHi = 500): Keadaan | null {
  const h = hAcak(r, hLo, hHi);
  const [a, b] = SASARAN[rez];
  const T0 = periodeUntuk(h / seragam(r, a, b), h);
  if (!(T0 >= P_T.min && T0 <= P_T.max)) return null;
  const m = { T: bulatKeLangkah(T0, P_T), h, H: tinggiAman(h) };
  const w = gelombangLembar(m);
  return w.regime === rez && diMargin(w.relativeDepth) && !w.breaking ? m : null;
}

function soal1(benih: number): Soal {
  const urutan: Rezim[] = ["dangkal", "menengah", "dalam"];
  const rez = urutan[Math.floor(prng(turunan(benih, 1, 100))() * 3)];
  const m = cobaBenih(benih, 1, (r) => keadaanRezim(r, rez), () => ({ T: 8, h: 20, H: 1 }));
  const w = gelombangLembar(m);
  const rentang: Record<Rezim, Bi<string>> = {
    dangkal: { id: "h/L < 1/20", en: "h/L < 1/20" },
    menengah: { id: "1/20 ≤ h/L ≤ 1/2", en: "1/20 ≤ h/L ≤ 1/2" },
    dalam: { id: "h/L > 1/2", en: "h/L > 1/2" },
  };
  const pilihan: Pilihan[] = urutan.map((k) => ({
    id: k,
    teks: { id: REZIM.id[k], en: REZIM.en[k] },
    ...(k === w.regime
      ? {}
      : {
          alasan: bi((f, l) =>
            l === "id"
              ? `${REZIM.id[k]} berlaku untuk ${rentang[k].id}, sedangkan h/L = ${f(m.h, 1)} / ${f(w.length, 2)} = ${f(w.relativeDepth, 3)}.`
              : `${REZIM.en[k]} covers ${rentang[k].en}, while h/L = ${f(m.h, 1)} / ${f(w.length, 2)} = ${f(w.relativeDepth, 3)}.`
          ),
        }),
  }));
  return {
    jenis: "pilih",
    id: "fp03-1",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksTh(m, f, l)} Menurut kedalaman relatif h/L (L panjang gelombang di kedalaman itu), gelombang ini termasuk rezim apa?`
        : `${teksTh(m, f, l)} By the relative depth h/L (L the wavelength at that depth), which regime is this wave in?`
    ),
    pilihan,
    kunci: w.regime,
    bahas: bi((f, l) =>
      l === "id"
        ? `L = ${f(w.length, 2)} m dari hubungan sebaran, jadi h/L = ${f(w.relativeDepth, 3)}: ${REZIM.id[w.regime].toLowerCase()} (batas h/L 1/20 dan 1/2). Sebagian buku memakai h/L₀ dengan L₀ = gT²/2π; batas air dangkal h/L = 1/20 setara h/L₀ ≈ 0,015. Lihat penanda di pita h/L di atas gambar.`
        : `L = ${f(w.length, 2)} m from the dispersion relation, so h/L = ${f(w.relativeDepth, 3)}: ${REZIM.en[w.regime].toLowerCase()} (limits h/L 1/20 and 1/2). Some books use h/L₀ with L₀ = gT²/2π; the shallow limit h/L = 1/20 corresponds to h/L₀ ≈ 0.015. See the marker on the h/L scale above the drawing.`
    ),
    langkah: langkahBi((f, l) => [
      ...langkahL(m, w, f, l),
      {
        judul: l === "id" ? "Kedalaman relatif" : "Relative depth",
        rumus: "h / L",
        isi: `${f(m.h, 1)} / ${f(w.length, 2)}`,
        hasil: f(w.relativeDepth, 3),
      },
    ]),
    masukan: m,
  };
}

/* ------------------------------------------------------------------ *
 * B2 hitung: panjang gelombang di kedalaman menengah
 * ------------------------------------------------------------------ */

function soal2(benih: number): Soal {
  const m = cobaBenih<Keadaan>(
    benih,
    2,
    (r) => {
      const h = hAcak(r, 1, 200);
      const T0 = periodeUntuk(h / seragam(r, 0.08, 0.35), h);
      if (!(T0 >= P_T.min && T0 <= P_T.max)) return null;
      const k = { T: bulatKeLangkah(T0, P_T), h, H: tinggiAman(h) };
      const w = gelombangLembar(k);
      if (w.regime !== "menengah" || w.breaking || w.length < 3) return null;
      const salahDangkal = k.T * Math.sqrt(G * k.h);
      return Math.abs(w.deepLength / w.length - 1) > 0.05 && Math.abs(salahDangkal / w.length - 1) > 0.05 ? k : null;
    },
    () => ({ T: 8, h: 20, H: 1 })
  );
  const w = gelombangLembar(m);
  const tol = 0.02 * w.length;
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: w.length },
    [
      {
        nilai: w.deepLength,
        alasan: {
          id: "Ini L₀ = gT²/2π, panjang gelombang air dalam. Di kedalaman menengah dasar memperpendek gelombang: L = L₀·tanh(2πh/L).",
          en: "This is L₀ = gT²/2π, the deep-water wavelength. At intermediate depth the bed shortens the wave: L = L₀·tanh(2πh/L).",
        },
      },
      {
        nilai: m.T * Math.sqrt(G * m.h),
        alasan: {
          id: "Ini T·√(gh), hampiran air dangkal. Berlaku hanya bila h/L < 1/20; di sini kedalamannya menengah.",
          en: "This is T·√(gh), the shallow-water approximation. It holds only for h/L < 1/20; here the depth is intermediate.",
        },
      },
    ],
    { toleransi: tol, digits: 1 }
  );
  return {
    jenis: "hitung",
    id: "fp03-2",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksTh(m, f, l)} Hitung panjang gelombang L di kedalaman itu.`
        : `${teksTh(m, f, l)} Compute the wavelength L at that depth.`
    ),
    kunci: w.length,
    toleransi: tol,
    digits: 1,
    satuan: { id: "m", en: "m" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `L memenuhi L = L₀·tanh(2πh/L) dengan L₀ = ${f(w.deepLength, 2)} m; diselesaikan berulang memberi L = ${f(w.length, 2)} m (h/L = ${f(w.relativeDepth, 3)}, kedalaman menengah). Lihat baris Panjang gelombang di tabel hasil.`
        : `L satisfies L = L₀·tanh(2πh/L) with L₀ = ${f(w.deepLength, 2)} m; iterating gives L = ${f(w.length, 2)} m (h/L = ${f(w.relativeDepth, 3)}, intermediate depth). See the Wavelength row in the results.`
    ),
    langkah: langkahBi((f, l) => langkahL(m, w, f, l)),
    masukan: m,
  };
}

/* ------------------------------------------------------------------ *
 * B3 hitung: kecepatan rambat c
 * ------------------------------------------------------------------ */

function soal3(benih: number): Soal {
  const urutan: Rezim[] = ["dangkal", "menengah", "dalam"];
  const rez = urutan[Math.floor(prng(turunan(benih, 3, 100))() * 3)];
  const m = cobaBenih(benih, 3, (r) => keadaanRezim(r, rez), () => ({ T: 8, h: 20, H: 1 }));
  const w = gelombangLembar(m);
  const tol = 0.02 * w.celerity;
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: w.celerity },
    [
      {
        nilai: w.shallowCelerity,
        alasan: {
          id: "Ini √(gh), hampiran air dangkal. Ia hanya berlaku bila h/L < 1/20.",
          en: "This is √(gh), the shallow-water approximation. It holds only for h/L < 1/20.",
        },
      },
      {
        nilai: w.deepCelerity,
        alasan: {
          id: "Ini gT/2π, hampiran air dalam. Ia hanya berlaku bila h/L > 1/2.",
          en: "This is gT/2π, the deep-water approximation. It holds only for h/L > 1/2.",
        },
      },
    ],
    { toleransi: tol, digits: 2 }
  );
  return {
    jenis: "hitung",
    id: "fp03-3",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksTh(m, f, l)} Hitung kecepatan rambat puncaknya c.`
        : `${teksTh(m, f, l)} Compute the crest celerity c.`
    ),
    kunci: w.celerity,
    toleransi: tol,
    digits: 2,
    satuan: { id: "m/s", en: "m/s" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `c = L/T = ${f(w.length, 2)} / ${f(m.T, 1)} = ${f(w.celerity, 2)} m/s, dengan h/L = ${f(w.relativeDepth, 3)} (${REZIM.id[w.regime].toLowerCase()}). Hampiran √(gh) = ${f(w.shallowCelerity, 2)} dan gT/2π = ${f(w.deepCelerity, 2)} m/s hanya berlaku di ujung pitanya. Lihat baris Kecepatan rambat puncak di tabel hasil.`
        : `c = L/T = ${f(w.length, 2)} / ${f(m.T, 1)} = ${f(w.celerity, 2)} m/s, with h/L = ${f(w.relativeDepth, 3)} (${REZIM.en[w.regime].toLowerCase()}). The approximations √(gh) = ${f(w.shallowCelerity, 2)} and gT/2π = ${f(w.deepCelerity, 2)} m/s hold only at the ends of their bands. See the Celerity of the crest row in the results.`
    ),
    langkah: langkahBi((f, l) => [
      ...langkahL(m, w, f, l),
      {
        judul: l === "id" ? "Kecepatan rambat" : "Celerity",
        rumus: "c = L / T",
        isi: `${f(w.length, 3)} / ${f(m.T, 1)}`,
        hasil: f(w.celerity, 2),
        satuan: "m/s",
        tint: C.energy,
      },
    ]),
    masukan: m,
  };
}

/* ------------------------------------------------------------------ *
 * B4 tebak: T ×2 → c tetap (dangkal) atau ≈ ×2 (dalam)
 * ------------------------------------------------------------------ */

function soal4(benih: number): Soal {
  const dalam = prng(turunan(benih, 4, 100))() < 0.5;
  const m = cobaBenih<Keadaan>(
    benih,
    4,
    (r) => {
      let k: Keadaan;
      if (dalam) {
        // Air dalam juga pada 2T: h ≥ g(2T)²/(4π) (revisi insinyur).
        const T = acakKisi(r, P_T, 1, 12);
        const hMin = (G * (2 * T) ** 2) / (4 * Math.PI);
        if (hMin > P_H.max) return null;
        k = { T, h: acakKisi(r, P_H, hMin, Math.min(P_H.max, 3 * hMin)), H: 0 };
        if (k.h < hMin) return null;
      } else {
        const h = hAcak(r, 0.5, 20);
        const T0 = periodeUntuk(h / seragam(r, 0.006, 0.035), h);
        if (!(T0 >= P_T.min && 2 * T0 <= P_T.max)) return null;
        k = { T: bulatKeLangkah(T0, P_T), h, H: 0 };
        if (2 * k.T > P_T.max) return null;
      }
      k.H = tinggiAman(k.h);
      const w1 = gelombangLembar(k);
      const w2 = gelombangLembar({ ...k, T: 2 * k.T });
      if (w1.breaking || w2.breaking) return null;
      const rasio = w2.celerity / w1.celerity;
      if (dalam) return rasio > 1.9 ? k : null;
      return w1.regime === "dangkal" && rasio < 1.1 ? k : null;
    },
    () => (dalam ? { T: 4, h: 60, H: 1 } : { T: 20, h: 2, H: 0.6 })
  );
  const w1 = gelombangLembar(m);
  const w2 = gelombangLembar({ ...m, T: 2 * m.T });
  const rasio = w2.celerity / w1.celerity;
  const kunci = dalam ? "dua" : "tetap";
  const pilihan: Pilihan[] = [
    {
      id: "tetap",
      teks: { id: "c hampir tidak berubah", en: "c hardly changes" },
      alasan: bi((f, l) =>
        l === "id"
          ? `Di air dalam c = gT/2π sebanding T, jadi ikut berlipat dua (×${f(rasio, 2)}).`
          : `In deep water c = gT/2π is proportional to T, so it doubles too (×${f(rasio, 2)}).`
      ),
    },
    {
      id: "akar",
      teks: { id: "c naik kira-kira √2 kali", en: "c rises by about √2" },
      alasan: bi((f, l) =>
        l === "id"
          ? `√2 muncul pada L, bukan T: c ∝ √L di air dalam. Rasio sebenarnya ×${f(rasio, 2)}.`
          : `√2 belongs to L, not T: c ∝ √L in deep water. The actual ratio is ×${f(rasio, 2)}.`
      ),
    },
    {
      id: "dua",
      teks: { id: "c naik kira-kira dua kali", en: "c roughly doubles" },
      alasan: bi((f, l) =>
        l === "id"
          ? `Di air dangkal c = √(gh) hanya bergantung pada kedalaman; periode tidak mengubahnya (×${f(rasio, 2)}).`
          : `In shallow water c = √(gh) depends on depth alone; the period does not change it (×${f(rasio, 2)}).`
      ),
    },
    {
      id: "empat",
      teks: { id: "c naik kira-kira empat kali", en: "c rises about fourfold" },
      alasan: bi((f, l) =>
        l === "id"
          ? `Empat kali berlaku untuk L₀ = gT²/2π, bukan c. Rasio c sebenarnya ×${f(rasio, 2)}.`
          : `Fourfold applies to L₀ = gT²/2π, not c. The actual ratio of c is ×${f(rasio, 2)}.`
      ),
    },
  ];
  return {
    jenis: "tebak",
    id: "fp03-4",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksTh(m, f, l)} Tebak dulu sebelum menghitung: bila periodenya dilipatduakan menjadi ${f(2 * m.T, 1)} s dan kedalamannya tetap, apa yang terjadi pada kecepatan rambat c?`
        : `${teksTh(m, f, l)} Guess before computing: if the period is doubled to ${f(2 * m.T, 1)} s at the same depth, what happens to the celerity c?`
    ),
    pilihan,
    kunci,
    bahas: bi((f, l) =>
      l === "id"
        ? `c berubah dari ${f(w1.celerity, 2)} ke ${f(w2.celerity, 2)} m/s (×${f(rasio, 2)}). ${dalam ? "Kedua periode di air dalam (h/L > 1/2), tempat c = gT/2π sebanding T." : "Gelombangnya di air dangkal (h/L < 1/20), tempat c = √(gh) hanya bergantung pada kedalaman."} Lihat lengkung c terhadap T di grafik: ${dalam ? "di kiri lengkungnya mengikuti garis gT/2π" : "di kanan lengkungnya mendatar ke √(gh)"}.`
        : `c changes from ${f(w1.celerity, 2)} to ${f(w2.celerity, 2)} m/s (×${f(rasio, 2)}). ${dalam ? "Both periods are in deep water (h/L > 1/2), where c = gT/2π is proportional to T." : "The wave is in shallow water (h/L < 1/20), where c = √(gh) depends on depth alone."} See the c against T curve in the graph: ${dalam ? "on the left it follows the gT/2π line" : "on the right it levels off at √(gh)"}.`
    ),
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? `Pada T = ${f(m.T, 1)} s` : `At T = ${f(m.T, 1)} s`,
        rumus: "c = L / T",
        isi: `${f(w1.length, 3)} / ${f(m.T, 1)}`,
        hasil: f(w1.celerity, 2),
        satuan: "m/s",
        tint: C.energy,
      },
      {
        judul: l === "id" ? `Pada 2T = ${f(2 * m.T, 1)} s` : `At 2T = ${f(2 * m.T, 1)} s`,
        rumus: "c = L / T",
        isi: `${f(w2.length, 3)} / ${f(2 * m.T, 1)}`,
        hasil: f(w2.celerity, 2),
        satuan: "m/s",
        tint: C.energy,
      },
    ]),
    masukan: m,
  };
}

/* ------------------------------------------------------------------ *
 * B5 atur: h terkecil untuk air dalam, h/L ∈ [0,5; 0,6]
 * ------------------------------------------------------------------ */

export const TARGET_B5 = { min: WAVE_DEEP, max: 0.6 };
const hLLembar = (k: Keadaan) => gelombangLembar(k).relativeDepth;

function soal5(benih: number): Soal {
  const s = cobaBenih<{ T: number; H: number; h0: number; lolos: number[] } | null>(
    benih,
    5,
    (r) => {
      const T = acakKisi(r, P_T, 3.5, 22);
      const H = 1;
      const lolos = kisi(P_H).filter((h) => {
        const v = hLLembar({ T, h, H });
        return v >= TARGET_B5.min && v <= TARGET_B5.max;
      });
      if (lolos.length < 3) return null;
      // Awal: kedalaman menengah, h ≈ 0,1·L₀.
      const h0 = bulatKeLangkah((0.1 * G * T * T) / (2 * Math.PI), P_H);
      const w0 = gelombangLembar({ T, h: h0, H });
      if (w0.breaking || w0.relativeDepth >= TARGET_B5.min) return null;
      return { T, H, h0, lolos };
    },
    () => null
  ) ?? { T: 8, H: 1, h0: 10, lolos: kisi(P_H).filter((h) => { const v = hLLembar({ T: 8, h, H: 1 }); return v >= 0.5 && v <= 0.6; }) };
  const lo = s.lolos[0], hi = s.lolos[s.lolos.length - 1];
  const L0 = (G * s.T * s.T) / (2 * Math.PI);
  return {
    jenis: "atur",
    id: "fp03-5",
    tanya: bi((f, l) =>
      l === "id"
        ? `Periode T = ${f(s.T, 1)} s dan tinggi H = ${f(s.H, 1)} m dibiarkan tetap; kedalaman dimulai dari h = ${f(s.h0, 1)} m. Atur h ke kedalaman terkecil yang sudah air dalam: h/L di antara 0,5 dan 0,6, lalu periksa.`
        : `Period T = ${f(s.T, 1)} s and height H = ${f(s.H, 1)} m stay fixed; the depth starts at h = ${f(s.h0, 1)} m. Set h to the smallest depth that is already deep water: h/L between 0.5 and 0.6, then check.`
    ),
    ukur: hLLembar,
    simbol: "h/L",
    digits: 3,
    target: TARGET_B5,
    geser: { kunci: "h", p: P_H },
    siapkan: { T: s.T, h: s.h0, H: s.H },
    tetap: { T: s.T, H: s.H },
    bahas: bi((f, l) =>
      l === "id"
        ? `Air dalam mulai pada h/L = 1/2, kira-kira h ≈ L₀/2 = ${f(L0 / 2, 1)} m untuk T ini. Di bawahnya dasar masih dirasakan gelombang; di atasnya menambah kedalaman tidak mengubah c lagi. Lihat pita h/L dan baris Setengah panjang gerak mendatar partikel di dasar.`
        : `Deep water starts at h/L = 1/2, about h ≈ L₀/2 = ${f(L0 / 2, 1)} m for this T. Below it the wave still feels the bed; above it more depth no longer changes c. See the h/L scale and the bed excursion row.`
    ),
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "Nilai h di kisi penggeser yang memenuhi" : "Slider values of h that work",
        rumus: "0,5 ≤ h / L(T, h) ≤ 0,6".replace(/,/g, l === "en" ? "." : ","),
        isi: l === "id" ? "h = 0,5 sampai 500 m, langkah 0,5, lewat linearWave" : "h = 0.5 to 500 m, step 0.5, through linearWave",
        hasil: `${f(lo, 1)} – ${f(hi, 1)}`,
        satuan: "m",
        tint: C.water,
      },
    ]),
  };
}

export const FP03: BankKuis = {
  kode: "FP-03",
  jumlah: 5,
  buat: (benih) => [soal1(benih), soal2(benih), soal3(benih), soal4(benih), soal5(benih)],
};
