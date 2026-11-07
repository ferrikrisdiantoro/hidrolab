/**
 * Bank soal EK-04 Lintasan ikan dan populasi (KUIS.md, termasuk revisi
 * insinyur 1 November: B2 pmin = p bulat terkecil dengan
 * !fishPassage().extinct, telusur 0..100, sasaran [pmin; pmin+2]; B4 syarat
 * r·p ≥ 1,2 d).
 *
 * Semua masukan jatuh di kisi penggeser lembar (ParamDef di bawah, dipakai
 * InputRow LintasanIkanPopulasiClient; p dalam persen seperti penggesernya),
 * dan semua kunci dihitung lewat fishPassage, fungsi yang sama dengan lembar.
 *
 * Pembangkit memanggil fishPassage dengan years = 0: extinct,
 * criticalPassage, dan equilibrium dihitung dari r, d, p saja dan tidak
 * bergantung pada lintasan tahunannya, jadi angkanya sama dengan panggilan
 * lembar (60 tahun) tetapi tanpa menghitung lintasan RK4 di tiap benih.
 * kuisEK04.test.ts membandingkan keduanya.
 *
 * Soal contoh: belum ditelaah dosen pengampu (KUIS.md baris 4).
 */

import { fishPassage, type PassageResult } from "../../lib/hydraulics.ts";
import { C } from "../../lib/theme.ts";
import type { ParamDef } from "../../lib/rentang.ts";
import {
  acakKisi,
  bi,
  bulatAcak,
  buangDuplikat,
  cobaBenih,
  fmtL,
  kisi,
  prng,
  turunan,
  type BankKuis,
  type Bi,
  type Kesalahan,
  type Keadaan,
  type LangkahKuis,
  type Pilihan,
  type Soal,
} from "../../lib/kuis.ts";

/** Sama dengan InputRow lembar LintasanIkanPopulasiClient (p dalam persen). */
export const P_N0: ParamDef = { min: 100, max: 20000, step: 100, digits: 0 };
export const P_K: ParamDef = { min: 500, max: 50000, step: 500, digits: 0 };
export const P_R: ParamDef = { min: 0.05, max: 2, step: 0.05, digits: 2 };
export const P_D: ParamDef = { min: 0.02, max: 1, step: 0.02, digits: 2 };
export const P_P: ParamDef = { min: 0, max: 100, step: 1, digits: 0 };

/** fishPassage tanpa lintasan tahunan (lihat catatan berkas). */
const populasi = (k: Keadaan): PassageResult => fishPassage(k.N0, k.K, k.r, k.d, k.p / 100, 0);

type F = (v: number, d: number) => string;
type L = "id" | "en";
const langkahBi = (t: (f: F, l: L) => LangkahKuis[]): Bi<LangkahKuis[]> => ({
  id: t((v, d) => fmtL(v, d, "id"), "id"),
  en: t((v, d) => fmtL(v, d, "en"), "en"),
});

/** r dan d dengan ambang d/r di [0,1; 0,9]. */
function acakRd(r: () => number): { r: number; d: number } | null {
  const rr = acakKisi(r, P_R, 0.3, 2);
  const d = acakKisi(r, P_D, 0.1 * rr, 0.9 * rr);
  const q = d / rr;
  return q >= 0.1 && q <= 0.9 ? { r: rr, d } : null;
}

function acakKeadaan(r: () => number): Keadaan | null {
  const rd = acakRd(r);
  if (!rd) return null;
  return {
    N0: acakKisi(r, P_N0, 500, 10000),
    K: acakKisi(r, P_K, 2000, 40000),
    r: rd.r,
    d: rd.d,
    p: acakKisi(r, P_P, 1, 100),
  };
}

const teksRd = (m: Keadaan, f: F, l: L) =>
  l === "id"
    ? `laju pertumbuhan hakiki r = ${f(m.r, 2)} per tahun dan laju kematian alami d = ${f(m.d, 2)} per tahun`
    : `intrinsic growth rate r = ${f(m.r, 2)} per year and natural mortality d = ${f(m.d, 2)} per year`;

const lKrit = (m: Keadaan, h: PassageResult, f: F, l: L): LangkahKuis => ({
  judul: l === "id" ? "Ambang keberhasilan" : "Success threshold",
  rumus: "p* = d / r",
  isi: `${f(m.d, 2)} / ${f(m.r, 2)}`,
  hasil: f(h.criticalPassage * 100, 2),
  satuan: "%",
  tint: C.critical,
});
const lBanding = (m: Keadaan, h: PassageResult, f: F, l: L): LangkahKuis => ({
  judul: l === "id" ? "Banding r·p dengan d" : "Compare r·p with d",
  rumus: `r · p ${h.extinct ? "≤" : ">"} d`,
  isi: `${f(m.r, 2)} · ${f(m.p / 100, 2)} = ${f((m.r * m.p) / 100, 3)} ${h.extinct ? "≤" : ">"} ${f(m.d, 2)}`,
  hasil: h.extinct ? (l === "id" ? "Punah" : "Extinct") : l === "id" ? "Lestari" : "Persists",
  tint: h.extinct ? C.caution : C.water,
});
const lEq = (m: Keadaan, h: PassageResult, f: F, l: L): LangkahKuis => ({
  judul: l === "id" ? "Populasi keadaan mantap" : "Equilibrium population",
  rumus: "N* = K · ( 1 − d / ( r · p ) )",
  isi: `${f(m.K, 0)} · ( 1 − ${f(m.d, 2)} / ( ${f(m.r, 2)} · ${f(m.p / 100, 2)} ) )`,
  hasil: f(h.equilibrium, 1),
  satuan: l === "id" ? "ekor" : "individuals",
  tint: C.water,
});

/* ------------------------------------------------------------------ *
 * B1 hitung: ambang p* = d/r, dalam persen
 * ------------------------------------------------------------------ */

function soal1(benih: number): Soal {
  const m = cobaBenih<Keadaan>(benih, 1, acakKeadaan, () => ({ N0: 5000, K: 10000, r: 0.6, d: 0.3, p: 90 }));
  const h = populasi(m);
  const kunci = h.criticalPassage * 100;
  const tol = 0.5;
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: kunci },
    [
      {
        nilai: (1 - m.d / m.r) * 100,
        alasan: {
          id: "Ini 1 − d/r, sisanya. Ambangnya d/r: bagian yang harus lolos supaya r·p menyamai d.",
          en: "This is 1 − d/r, the remainder. The threshold is d/r: the share that must pass for r·p to equal d.",
        },
      },
      {
        nilai: m.d * 100,
        alasan: {
          id: "d belum dibagi r. Syarat lestari r·p > d memberi p > d/r.",
          en: "d has not been divided by r. The condition r·p > d gives p > d/r.",
        },
      },
      {
        nilai: (m.r / m.d) * 100,
        alasan: {
          id: "Pembagiannya terbalik: p* = d/r, bukan r/d.",
          en: "The division is upside down: p* = d/r, not r/d.",
        },
      },
    ],
    { toleransi: tol, digits: 1 }
  );
  return {
    jenis: "hitung",
    id: "ek04-1",
    tanya: bi((f, l) =>
      l === "id"
        ? `Ikan ruaya di sungai ini punya ${teksRd(m, f, l)}. Hitung keberhasilan lintasan terkecil p* (dalam persen) yang masih menghindarkan populasinya dari kepunahan.`
        : `Migratory fish in this river have ${teksRd(m, f, l)}. Compute the smallest passage success p* (in per cent) that still keeps the population from extinction.`
    ),
    kunci,
    toleransi: tol,
    digits: 1,
    satuan: { id: "%", en: "%" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `Populasi lestari bila r·p > d, jadi p* = d/r = ${f(m.d, 2)} / ${f(m.r, 2)} = ${f(kunci, 1)} %. Ambangnya tidak bergantung pada N₀ maupun K. Lihat batas pita p di atas grafik dan baris p* di tabel hasil.`
        : `The population persists when r·p > d, so p* = d/r = ${f(m.d, 2)} / ${f(m.r, 2)} = ${f(kunci, 1)} %. The threshold depends on neither N₀ nor K. See the band edge on the p scale above the graph and the p* row in the results.`
    ),
    langkah: langkahBi((f, l) => [lKrit(m, h, f, l)]),
    masukan: m,
  };
}

/* ------------------------------------------------------------------ *
 * B2 atur: p bulat terkecil yang lestari
 * ------------------------------------------------------------------ */

function soal2(benih: number): Soal {
  const s = cobaBenih<{ tetap: Keadaan; pmin: number; p0: number }>(
    benih,
    2,
    (r) => {
      const k = acakKeadaan(r);
      if (!k) return null;
      const tetap = { N0: k.N0, K: k.K, r: k.r, d: k.d };
      // Telusur kisi p lewat lib (revisi insinyur), bukan ⌈100 d/r⌉.
      const pmin = kisi(P_P).find((p) => !populasi({ ...tetap, p }).extinct);
      if (pmin === undefined || pmin < 12 || pmin + 2 > P_P.max) return null;
      const p0 = pmin - bulatAcak(r, 10, Math.min(30, pmin));
      return p0 >= P_P.min && p0 < pmin ? { tetap, pmin, p0 } : null;
    },
    () => ({ tetap: { N0: 5000, K: 10000, r: 0.6, d: 0.3 }, pmin: 51, p0: 30 })
  );
  const { tetap, pmin, p0 } = s;
  const krit = (tetap.d / tetap.r) * 100;
  return {
    jenis: "atur",
    id: "ek04-2",
    tanya: bi((f, l) =>
      l === "id"
        ? `N₀ = ${f(tetap.N0, 0)}, K = ${f(tetap.K, 0)}, ${teksRd(tetap, f, l)}. Mulai dari p = ${f(p0, 0)} % populasinya menuju punah. Atur p ke keberhasilan lintasan bulat terkecil yang membuatnya lestari (sampai 2 poin di atasnya masih diterima), lalu periksa.`
        : `N₀ = ${f(tetap.N0, 0)}, K = ${f(tetap.K, 0)}, ${teksRd(tetap, f, l)}. Starting at p = ${f(p0, 0)} % the population heads to extinction. Set p to the smallest whole-number passage success that makes it persist (up to 2 points above is accepted), then check.`
    ),
    ukur: (k) => k.p,
    simbol: "p",
    digits: 0,
    target: { min: pmin, max: pmin + 2 },
    geser: { kunci: "p", p: P_P },
    siapkan: { ...tetap, p: p0 },
    tetap,
    bahas: bi((f, l) =>
      l === "id"
        ? `Ambangnya d/r = ${f(krit, 2)} %. Pada p = ${f(pmin - 1, 0)} % r·p belum melebihi d dan populasinya punah; ${f(pmin, 0)} % adalah bilangan bulat pertama yang lestari. Lihat garis lintasan di grafik berubah dari turun ke nol menjadi menetap.`
        : `The threshold is d/r = ${f(krit, 2)} %. At p = ${f(pmin - 1, 0)} % r·p does not yet exceed d and the population dies out; ${f(pmin, 0)} % is the first whole number that persists. Watch the path in the graph change from falling to zero to levelling off.`
    ),
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "Ambang" : "Threshold",
        rumus: "p* = d / r",
        isi: `${f(tetap.d, 2)} / ${f(tetap.r, 2)}`,
        hasil: f(krit, 2),
        satuan: "%",
        tint: C.critical,
      },
      {
        judul: l === "id" ? "p bulat terkecil dengan r·p > d" : "Smallest whole p with r·p > d",
        rumus: "r · p > d",
        isi: `${f(tetap.r, 2)} · ${f(pmin / 100, 2)} = ${f((tetap.r * pmin) / 100, 4)} > ${f(tetap.d, 2)}`,
        hasil: f(pmin, 0),
        satuan: "%",
        tint: C.water,
      },
    ]),
  };
}

/* ------------------------------------------------------------------ *
 * B3 pilih: lestari atau punah, bermargin
 * ------------------------------------------------------------------ */

function soal3(benih: number): Soal {
  const punah = prng(turunan(benih, 3, 100))() < 0.5;
  const m = cobaBenih<Keadaan>(
    benih,
    3,
    (r) => {
      const k = acakKeadaan(r);
      if (!k) return null;
      if (Math.abs((k.r * k.p) / 100 - k.d) <= 0.05 * k.d) return null;
      return populasi(k).extinct === punah ? k : null;
    },
    () => (punah ? { N0: 5000, K: 10000, r: 0.6, d: 0.3, p: 25 } : { N0: 5000, K: 10000, r: 0.6, d: 0.3, p: 90 })
  );
  const h = populasi(m);
  const rp = (m.r * m.p) / 100;
  const pilihan: Pilihan[] = [
    {
      id: "lestari",
      teks: { id: "Lestari: menetap pada keadaan mantap di atas nol", en: "Persists: settles at an equilibrium above zero" },
      alasan: bi((f, l) =>
        l === "id"
          ? `r·p = ${f(rp, 3)} tidak melebihi d = ${f(m.d, 2)}: kematian mengalahkan pertumbuhan dan populasinya menuju nol.`
          : `r·p = ${f(rp, 3)} does not exceed d = ${f(m.d, 2)}: mortality beats growth and the population goes to zero.`
      ),
    },
    {
      id: "punah",
      teks: { id: "Punah: turun terus menuju nol", en: "Extinct: keeps falling to zero" },
      alasan: bi((f, l) =>
        l === "id"
          ? `r·p = ${f(rp, 3)} melebihi d = ${f(m.d, 2)}, jadi populasinya menetap pada N* = ${f(h.equilibrium, 0)} ekor.`
          : `r·p = ${f(rp, 3)} exceeds d = ${f(m.d, 2)}, so the population settles at N* = ${f(h.equilibrium, 0)}.`
      ),
    },
    {
      id: "tanpa",
      teks: { id: "Punah berapa pun keberhasilan lintasannya", en: "Extinct whatever the passage success" },
      alasan: bi((f, l) =>
        l === "id"
          ? `Itu hanya bila d ≥ r. Di sini d/r = ${f(h.criticalPassage * 100, 1)} %, jadi lintasan yang cukup baik masih menolong.`
          : `That holds only when d ≥ r. Here d/r = ${f(h.criticalPassage * 100, 1)} %, so a good enough passage still helps.`
      ),
    },
  ];
  return {
    jenis: "pilih",
    id: "ek04-3",
    tanya: bi((f, l) =>
      l === "id"
        ? `N₀ = ${f(m.N0, 0)}, K = ${f(m.K, 0)}, ${teksRd(m, f, l)}. Bendungnya diloloskan ${f(m.p, 0)} % ikan yang mencoba naik. Ke mana populasinya dalam jangka panjang?`
        : `N₀ = ${f(m.N0, 0)}, K = ${f(m.K, 0)}, ${teksRd(m, f, l)}. The weir lets ${f(m.p, 0)} % of the fish that try through. Where does the population go in the long run?`
    ),
    pilihan,
    kunci: h.extinct ? "punah" : "lestari",
    bahas: bi((f, l) =>
      l === "id"
        ? `Bandingkan r·p = ${f(m.r, 2)} · ${f(m.p / 100, 2)} = ${f(rp, 3)} dengan d = ${f(m.d, 2)}: ${h.extinct ? "tidak melebihi, jadi punah" : `melebihi, jadi lestari pada N* = ${f(h.equilibrium, 0)} ekor`}. Ambang p* = ${f(h.criticalPassage * 100, 1)} %. Lihat pita p dan lintasan tebal di grafik.`
        : `Compare r·p = ${f(m.r, 2)} · ${f(m.p / 100, 2)} = ${f(rp, 3)} with d = ${f(m.d, 2)}: ${h.extinct ? "it does not exceed it, so extinct" : `it exceeds it, so it persists at N* = ${f(h.equilibrium, 0)}`}. Threshold p* = ${f(h.criticalPassage * 100, 1)} %. See the p scale and the bold path in the graph.`
    ),
    langkah: langkahBi((f, l) => [lKrit(m, h, f, l), lBanding(m, h, f, l)]),
    masukan: m,
  };
}

/* ------------------------------------------------------------------ *
 * B4 hitung: N* = K(1 − d/(r·p)), r·p ≥ 1,2 d
 * ------------------------------------------------------------------ */

function soal4(benih: number): Soal {
  const m = cobaBenih<Keadaan>(
    benih,
    4,
    (r) => {
      const k = acakKeadaan(r);
      if (!k) return null;
      if ((k.r * k.p) / 100 < 1.2 * k.d) return null;
      /* Populasi kecil, N* di bawah 1000: jawaban bulat tanpa pemisah ribuan
         (kotak jawaban membaca "1.234" sebagai 1,234). */
      k.K = acakKisi(r, P_K, 500, 2500);
      k.N0 = acakKisi(r, P_N0, 100, Math.min(P_N0.max, 2 * k.K));
      const e = populasi(k).equilibrium;
      return e >= 100 && e <= 999 ? k : null;
    },
    () => ({ N0: 500, K: 1500, r: 0.6, d: 0.3, p: 90 })
  );
  const h = populasi(m);
  const tol = 0.01 * h.equilibrium;
  const pp = m.p / 100;
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: h.equilibrium },
    [
      {
        nilai: m.K * (1 - m.d / m.r),
        alasan: {
          id: "p tertinggal. Hanya bagian p yang lolos ikut memijah, jadi pertumbuhan efektifnya r·p.",
          en: "p was left out. Only the share p that passes spawns, so the effective growth is r·p.",
        },
      },
      {
        nilai: (m.K * m.d) / (m.r * pp),
        alasan: {
          id: "Ini K·d/(r·p), bagian yang hilang. N* = K·(1 − d/(r·p)).",
          en: "This is K·d/(r·p), the part that is lost. N* = K·(1 − d/(r·p)).",
        },
      },
      {
        nilai: m.K * (1 - m.d / (m.r * m.p)),
        alasan: {
          id: "p dimasukkan dalam persen. Pakai pecahan: p = " + fmtL(pp, 2, "id") + ".",
          en: "p was entered in per cent. Use the fraction: p = " + fmtL(pp, 2, "en") + ".",
        },
      },
    ],
    { toleransi: tol, digits: 0 }
  );
  return {
    jenis: "hitung",
    id: "ek04-4",
    tanya: bi((f, l) =>
      l === "id"
        ? `Daya dukung K = ${f(m.K, 0)} ekor, ${teksRd(m, f, l)}, keberhasilan lintasan p = ${f(m.p, 0)} %. Hitung populasi keadaan mantap N*.`
        : `Carrying capacity K = ${f(m.K, 0)}, ${teksRd(m, f, l)}, passage success p = ${f(m.p, 0)} %. Compute the equilibrium population N*.`
    ),
    kunci: h.equilibrium,
    toleransi: tol,
    digits: 0,
    satuan: { id: "ekor", en: "individuals" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `Laju bersih nol bila r·p·(1 − N/K) = d, jadi N* = K·(1 − d/(r·p)) = ${f(m.K, 0)} · (1 − ${f(m.d, 2)} / ${f(m.r * pp, 3)}) = ${f(h.equilibrium, 0)} ekor. Lihat garis putus N* di grafik dan baris N* di tabel hasil.`
        : `The net rate is zero when r·p·(1 − N/K) = d, so N* = K·(1 − d/(r·p)) = ${f(m.K, 0)} · (1 − ${f(m.d, 2)} / ${f(m.r * pp, 3)}) = ${f(h.equilibrium, 0)}. See the dashed N* line in the graph and the N* row in the results.`
    ),
    langkah: langkahBi((f, l) => [lBanding(m, h, f, l), lEq(m, h, f, l)]),
    masukan: m,
  };
}

/* ------------------------------------------------------------------ *
 * B5 tebak: N₀ ×2 → N* tetap
 * ------------------------------------------------------------------ */

function soal5(benih: number): Soal {
  const m = cobaBenih<Keadaan>(
    benih,
    5,
    (r) => {
      const k = acakKeadaan(r);
      if (!k) return null;
      if ((k.r * k.p) / 100 < 1.2 * k.d) return null;
      return populasi(k).equilibrium >= 100 && 2 * k.N0 <= P_N0.max ? k : null;
    },
    () => ({ N0: 5000, K: 10000, r: 0.6, d: 0.3, p: 90 })
  );
  const m2 = { ...m, N0: 2 * m.N0 };
  const h = populasi(m);
  const pilihan: Pilihan[] = [
    { id: "tetap", teks: { id: "N* tidak berubah", en: "N* does not change" } },
    {
      id: "dua",
      teks: { id: "N* ikut berlipat dua", en: "N* doubles too" },
      alasan: {
        id: "N* = K·(1 − d/(r·p)) tidak memuat N₀. Populasi awal hanya mengubah jalan menuju N*.",
        en: "N* = K·(1 − d/(r·p)) does not contain N₀. The starting population only changes the path to N*.",
      },
    },
    {
      id: "naik",
      teks: { id: "N* naik, tetapi kurang dari dua kali", en: "N* rises, but by less than double" },
      alasan: {
        id: "Daya dukung K yang membatasi, bukan N₀. N* sama untuk N₀ berapa pun selama r·p > d.",
        en: "The carrying capacity K sets the limit, not N₀. N* is the same for any N₀ as long as r·p > d.",
      },
    },
    {
      id: "turun",
      teks: { id: "N* turun karena persaingan makin ketat", en: "N* falls because competition is tighter" },
      alasan: {
        id: "Persaingan memang menurunkan populasi yang besar, tetapi ke N* yang sama: lintasannya turun dari atas.",
        en: "Competition does pull a large population down, but to the same N*: the path just comes from above.",
      },
    },
  ];
  return {
    jenis: "tebak",
    id: "ek04-5",
    tanya: bi((f, l) =>
      l === "id"
        ? `K = ${f(m.K, 0)}, ${teksRd(m, f, l)}, p = ${f(m.p, 0)} %, populasi awal N₀ = ${f(m.N0, 0)}. Tebak dulu: bila N₀ dilipatduakan menjadi ${f(m2.N0, 0)}, apa yang terjadi pada populasi keadaan mantap N*?`
        : `K = ${f(m.K, 0)}, ${teksRd(m, f, l)}, p = ${f(m.p, 0)} %, starting population N₀ = ${f(m.N0, 0)}. Guess first: if N₀ is doubled to ${f(m2.N0, 0)}, what happens to the equilibrium population N*?`
    ),
    pilihan,
    kunci: "tetap",
    bahas: bi((f, l) =>
      l === "id"
        ? `N* = ${f(h.equilibrium, 0)} ekor untuk kedua N₀: rumusnya hanya memuat K, d, r, p. Lintasan di grafik berbeda di tahun-tahun awal lalu bertemu di garis N* yang sama. Lembar sekarang memakai N₀ = ${f(m2.N0, 0)}.`
        : `N* = ${f(h.equilibrium, 0)} for both N₀: the formula contains only K, d, r, p. The paths in the graph differ in the early years, then meet on the same N* line. The sheet now uses N₀ = ${f(m2.N0, 0)}.`
    ),
    langkah: langkahBi((f, l) => [lEq(m, h, f, l)]),
    masukan: m2,
  };
}

export const EK04: BankKuis = {
  kode: "EK-04",
  jumlah: 5,
  buat: (benih) => [soal1(benih), soal2(benih), soal3(benih), soal4(benih), soal5(benih)],
};
