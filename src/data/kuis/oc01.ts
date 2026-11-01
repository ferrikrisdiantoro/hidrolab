/**
 * Bank soal OC-01 Loncatan air (KUIS.md, termasuk revisi insinyur 1 November).
 *
 * Semua masukan jatuh di kisi penggeser lembar (y₁ 0,08–1,2 m langkah 0,01;
 * V₁ 0,5–16 m/s langkah 0,1), dan semua kunci dihitung SESUDAH pembulatan
 * itu lewat fungsi lib yang sama dengan lembar (froude, classifyJump,
 * conjugateDepth, jumpEnergyLoss).
 *
 * Soal contoh: belum ditelaah dosen pengampu (KUIS.md baris 4).
 */

import {
  G,
  classifyJump,
  conjugateDepth,
  froude,
  jumpEnergyLoss,
  type JumpClass,
} from "../../lib/hydraulics.ts";
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
  kocok,
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

/** Sama dengan InputRow lembar LoncatanAirClient. */
export const P_Y1: ParamDef = { min: 0.08, max: 1.2, step: 0.01, digits: 2 };
export const P_V1: ParamDef = { min: 0.5, max: 16, step: 0.1, digits: 1 };

/** Margin klasifikasi B1: Fr₁ berjarak ≥ 8 % (rasio) dari tiap batas pita. */
export const MARGIN_PITA = 1.08;

type Pita = { key: string; lo: number; hi: number };
/** Batas sama persis dengan classifyJump. */
const PITA: Pita[] = [
  { key: "subkritis", lo: 0, hi: 1 },
  { key: "berombak", lo: 1, hi: 1.7 },
  { key: "lemah", lo: 1.7, hi: 2.5 },
  { key: "berosilasi", lo: 2.5, hi: 4.5 },
  { key: "mantap", lo: 4.5, hi: 9 },
  { key: "kuat", lo: 9, hi: Infinity },
];
/** Kelas lib untuk tiap pita, diambil dari classifyJump sendiri (label, rentang, urutan). */
const KELAS: Record<string, JumpClass> = Object.fromEntries(
  [0.5, 1.3, 2, 3, 6, 12].map((f) => {
    const k = classifyJump(f);
    return [k.key, k];
  })
);

const rentangTeks = (k: JumpClass, lang: "id" | "en") =>
  lang === "en" ? k.range.replace(/,/g, ".") : k.range;

type Aliran = { y1: number; V1: number; Fr: number };

/**
 * y₁ acak di kisi [yLo, yHi], lalu V₁ dari Fr₁ sasaran di [frLo, frHi]
 * yang terjangkau penggeser, dibulatkan ke 0,1, lalu Fr₁ dihitung ulang.
 * null bila Fr₁ sesudah pembulatan keluar dari [frLo, frHi].
 */
function aliran(
  r: () => number,
  frLo: number,
  frHi: number,
  yLo = P_Y1.min,
  yHi = P_Y1.max
): Aliran | null {
  // Batasi y₁ ke kedalaman yang masih bisa mencapai [frLo, frHi] dengan
  // V₁ di rentang penggeser; tanpa ini pita kuat (y₁ ≲ 0,28 m) jarang terpilih.
  const yA = Math.max(yLo, frHi === Infinity ? 0 : (P_V1.min / frHi) ** 2 / G);
  const yB = Math.min(yHi, (P_V1.max / frLo) ** 2 / G);
  if (!(yA <= yB)) return null;
  const y1 = acakKisi(r, P_Y1, yA, yB);
  const akar = Math.sqrt(G * y1);
  const lo = Math.max(frLo, P_V1.min / akar);
  const hi = Math.min(frHi, P_V1.max / akar);
  if (!(lo < hi)) return null;
  const V1 = bulatKeLangkah(seragam(r, lo, hi) * akar, P_V1);
  const Fr = froude(V1, y1);
  if (Fr < frLo || Fr > frHi) return null;
  return { y1, V1, Fr };
}

const teksMasuk = (a: Aliran) =>
  bi((f, l) =>
    l === "id"
      ? `Aliran masuk y₁ = ${f(a.y1, 2)} m, V₁ = ${f(a.V1, 1)} m/s.`
      : `Incoming flow y₁ = ${f(a.y1, 2)} m, V₁ = ${f(a.V1, 1)} m/s.`
  );

const langkahFr = (a: Aliran, l: "id" | "en", f: (v: number, d: number) => string): LangkahKuis => ({
  judul: l === "id" ? "Bilangan Froude hulu" : "Upstream Froude number",
  rumus: "Fr₁ = V₁ / √( g · y₁ )",
  isi: `${f(a.V1, 1)} / √( ${f(G, 2)} · ${f(a.y1, 2)} )`,
  hasil: f(a.Fr, 2),
});

const langkahBi = (
  t: (f: (v: number, d: number) => string, l: "id" | "en") => LangkahKuis[]
): Bi<LangkahKuis[]> => ({
  id: t((v, d) => fmtL(v, d, "id"), "id"),
  en: t((v, d) => fmtL(v, d, "en"), "en"),
});

/* ------------------------------------------------------------------ *
 * B1 pilih: jenis loncatan dari y₁ dan V₁
 * ------------------------------------------------------------------ */

function soal1(benih: number): Soal {
  // Pita sasaran diundi sekali, di luar percobaan ulang, supaya keenam
  // kelas muncul sama sering.
  const pita = PITA[Math.floor(prng(turunan(benih, 1, 100))() * PITA.length)];
  const a = cobaBenih(
    benih,
    1,
    (r) => aliran(r, pita.lo * MARGIN_PITA, pita.hi / MARGIN_PITA),
    // Cadangan: Fr₁ 6,0 (mantap), jauh dari batas.
    () => ({ y1: 0.25, V1: 9.4, Fr: froude(9.4, 0.25) })
  );
  const kunci = classifyJump(a.Fr);

  type Calon = { key: string; alasan: Bi<string> };
  const keliru: Calon[] = [
    {
      key: classifyJump(a.V1 / Math.sqrt(a.y1)).key,
      alasan: bi((f, l) =>
        l === "id"
          ? `Ini hasil Fr₁ tanpa g: V₁/√y₁ = ${f(a.V1 / Math.sqrt(a.y1), 2)}. Percepatan gravitasi harus ada di bawah akar.`
          : `This is Fr₁ without g: V₁/√y₁ = ${f(a.V1 / Math.sqrt(a.y1), 2)}. Gravity belongs under the square root.`
      ),
    },
    {
      key: classifyJump(a.Fr * a.Fr).key,
      alasan: bi((f, l) =>
        l === "id"
          ? `Ini hasil memakai Fr₁² = ${f(a.Fr * a.Fr, 2)}. Pita rezim memakai Fr₁, bukan kuadratnya.`
          : `This uses Fr₁² = ${f(a.Fr * a.Fr, 2)}. The regime bands use Fr₁, not its square.`
      ),
    },
    {
      key: classifyJump(a.V1 / (G * a.y1)).key,
      alasan: bi((f, l) =>
        l === "id"
          ? `Ini hasil V₁/(g·y₁) = ${f(a.V1 / (G * a.y1), 2)}, tanpa akar. Fr₁ = V₁/√(g·y₁).`
          : `This is V₁/(g·y₁) = ${f(a.V1 / (G * a.y1), 2)}, with no square root. Fr₁ = V₁/√(g·y₁).`
      ),
    },
  ];
  // Buang yang sama dengan kunci atau sesamanya menurut key, lalu lengkapi
  // dengan pita tetangga sampai empat pilihan.
  const terpilih = buangDuplikat({ key: kunci.key }, keliru);
  const tetangga = [...PITA]
    .map((p) => KELAS[p.key])
    .sort((x, y) => Math.abs(x.level - kunci.level) - Math.abs(y.level - kunci.level) || x.level - y.level);
  for (const k of tetangga) {
    if (terpilih.length >= 3) break;
    if (k.key === kunci.key || terpilih.some((c) => c.key === k.key)) continue;
    terpilih.push({
      key: k.key,
      alasan: bi((f, l) =>
        l === "id"
          ? `Pita ${k.label.id} berlaku untuk ${rentangTeks(k, l)}, sedangkan Fr₁ = ${f(a.Fr, 2)}.`
          : `The ${k.label.en} band covers ${rentangTeks(k, l)}, while Fr₁ = ${f(a.Fr, 2)}.`
      ),
    });
  }

  const pilihan: Pilihan[] = [
    { id: kunci.key, teks: kunci.label },
    ...terpilih.map((c) => ({ id: c.key, teks: KELAS[c.key].label, alasan: c.alasan })),
  ].sort((x, y) => KELAS[x.id].level - KELAS[y.id].level);

  const masuk = teksMasuk(a);
  return {
    jenis: "pilih",
    id: "oc01-1",
    tanya: {
      id: `${masuk.id} Loncatan jenis apa yang terbentuk, bila ada?`,
      en: `${masuk.en} What type of jump forms, if any?`,
    },
    pilihan,
    kunci: kunci.key,
    bahas: bi((f, l) =>
      l === "id"
        ? `Fr₁ = V₁/√(g·y₁) = ${f(a.Fr, 2)}, jatuh di pita ${kunci.label.id} (${rentangTeks(kunci, l)}). Lihat penanda di pita rezim di atas gambar.`
        : `Fr₁ = V₁/√(g·y₁) = ${f(a.Fr, 2)}, which falls in the ${kunci.label.en} band (${rentangTeks(kunci, l)}). See the marker on the regime scale above the drawing.`
    ),
    // Satu langkah: pitanya sudah ditulis di pembahasan dan di pita rezim.
    langkah: langkahBi((f, l) => [langkahFr(a, l, f)]),
    masukan: { y1: a.y1, V1: a.V1 },
  };
}

/* ------------------------------------------------------------------ *
 * B2 hitung: kedalaman konjugat y₂
 * ------------------------------------------------------------------ */

/** Toleransi relatif dengan lantai satu angka terakhir tampilan (2 angka: 0,01 m). */
const tolY2 = (y2: number) => Math.max(0.02 * y2, 0.01);

function soal2(benih: number): Soal {
  // Fr₁ ≤ 9: di atas itu "lupa −1" kurang dari 4 % dari kunci (revisi insinyur).
  const a = cobaBenih(benih, 2, (r) => aliran(r, 1.7, 9), () => ({ y1: 0.3, V1: 7, Fr: froude(7, 0.3) }));
  const y2 = conjugateDepth(a.y1, a.Fr);
  const tol = tolY2(y2);
  const s8 = Math.sqrt(1 + 8 * a.Fr * a.Fr);
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: y2 },
    [
      {
        nilai: (a.y1 / 2) * s8,
        alasan: {
          id: "Suku −1 di dalam kurung terlupa: y₂ = y₁/2 · ( √(1 + 8·Fr₁²) − 1 ).",
          en: "The −1 inside the bracket was dropped: y₂ = y₁/2 · ( √(1 + 8·Fr₁²) − 1 ).",
        },
      },
      {
        nilai: (a.y1 / 2) * (Math.sqrt(1 + 8 * a.Fr) - 1),
        alasan: {
          id: "Fr₁ belum dikuadratkan di bawah akar: yang benar 8·Fr₁².",
          en: "Fr₁ was not squared under the root: it should be 8·Fr₁².",
        },
      },
      {
        nilai: a.y1 * a.Fr,
        alasan: {
          id: "y₂ = y₁·Fr₁ bukan persamaan Belanger. Rasio kedalaman ½·(√(1 + 8·Fr₁²) − 1) hanya mendekati Fr₁ untuk Fr₁ besar.",
          en: "y₂ = y₁·Fr₁ is not the Bélanger equation. The depth ratio ½·(√(1 + 8·Fr₁²) − 1) only approaches Fr₁ at large Fr₁.",
        },
      },
    ],
    { toleransi: tol, digits: 2 }
  );
  const masuk = teksMasuk(a);
  return {
    jenis: "hitung",
    id: "oc01-2",
    tanya: {
      id: `${masuk.id} Hitung kedalaman konjugat y₂.`,
      en: `${masuk.en} Compute the conjugate depth y₂.`,
    },
    kunci: y2,
    toleransi: tol,
    digits: 2,
    satuan: { id: "m", en: "m" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `y₂ = y₁/2 · ( √(1 + 8·Fr₁²) − 1 ) = ${f(y2, 2)} m. Bandingkan dengan baris Kedalaman konjugat di tabel hasil; suku √(1 + 8·Fr₁²) − 1 yang paling sering keliru.`
        : `y₂ = y₁/2 · ( √(1 + 8·Fr₁²) − 1 ) = ${f(y2, 2)} m. Compare with the Conjugate depth row in the results; the term √(1 + 8·Fr₁²) − 1 is where most slips happen.`
    ),
    langkah: langkahBi((f, l) => [
      langkahFr(a, l, f),
      {
        judul: l === "id" ? "Kedalaman konjugat" : "Conjugate depth",
        rumus: "y₂ = y₁ / 2 · ( √( 1 + 8 · Fr₁² ) − 1 )",
        isi: `${f(a.y1, 2)} / 2 · ( √( 1 + 8 · ${f(a.Fr, 3)}² ) − 1 )`,
        hasil: f(y2, 2),
        satuan: "m",
        tint: C.water,
      },
    ]),
    masukan: { y1: a.y1, V1: a.V1 },
  };
}

/* ------------------------------------------------------------------ *
 * B3 atur: V₁ sampai Fr₁ ∈ [5; 6] dengan y₁ tetap
 * ------------------------------------------------------------------ */

export const TARGET_B3 = { min: 5, max: 6 };
const frB3 = (k: Record<string, number>) => froude(k.V1, k.y1);

function soal3(benih: number): Soal {
  type Siap = { y1: number; V0: number; lolos: number[] };
  // Kunci dicari dengan menelusuri kisi V₁ lewat froude(), bukan rumus tertutup.
  const lolosDi = (y1: number) =>
    kisi(P_V1).filter((V) => {
      const fr = froude(V, y1);
      return fr >= TARGET_B3.min && fr <= TARGET_B3.max;
    });
  const s = cobaBenih<Siap | null>(
    benih,
    3,
    (r) => {
      const y1 = acakKisi(r, P_Y1, 0.08, 0.8);
      const lolos = lolosDi(y1);
      if (lolos.length < 3) return null;
      // Awal: Fr₁ sekitar 2,5 (berosilasi), jelas di luar sasaran.
      const V0 = bulatKeLangkah(2.5 * Math.sqrt(G * y1), P_V1);
      const fr0 = froude(V0, y1);
      if (fr0 >= TARGET_B3.min && fr0 <= TARGET_B3.max) return null;
      return { y1, V0, lolos };
    },
    () => null
  ) ?? { y1: 0.3, V0: 4.3, lolos: lolosDi(0.3) };

  const vMin = s.lolos[0], vMax = s.lolos[s.lolos.length - 1];
  return {
    jenis: "atur",
    id: "oc01-3",
    tanya: bi((f, l) =>
      l === "id"
        ? `Kedalaman hulu dipasang y₁ = ${f(s.y1, 2)} m dan dibiarkan tetap. Atur kecepatan hulu V₁ sampai Fr₁ berada di antara 5 dan 6, lalu periksa.`
        : `The upstream depth is set to y₁ = ${f(s.y1, 2)} m and stays fixed. Adjust the upstream velocity V₁ until Fr₁ lies between 5 and 6, then check.`
    ),
    ukur: frB3,
    simbol: "Fr₁",
    digits: 2,
    target: TARGET_B3,
    geser: { kunci: "V1", p: P_V1 },
    siapkan: { y1: s.y1, V1: s.V0 },
    tetap: { y1: s.y1 },
    bahas: {
      id: "Fr₁ 5 sampai 6 berada di pita Mantap (4,5 ≤ Fr₁ < 9): loncatan stabil di tempatnya. Kartu keadaan lembar menyebut panjang kolam olak yang dibutuhkan, Lj ≈ 6·y₂.",
      en: "Fr₁ of 5 to 6 lies in the Steady band (4.5 ≤ Fr₁ < 9): the jump holds its position. The state card gives the stilling basin length needed, Lj ≈ 6·y₂.",
    },
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "Rentang V₁ yang memenuhi" : "Range of V₁ that works",
        rumus: "V₁ = Fr₁ · √( g · y₁ )",
        isi: `5 · √( ${f(G, 2)} · ${f(s.y1, 2)} ) … 6 · √( ${f(G, 2)} · ${f(s.y1, 2)} )`,
        hasil: `${f(vMin, 1)} – ${f(vMax, 1)}`,
        satuan: "m/s",
        tint: C.water,
      },
    ]),
  };
}

/* ------------------------------------------------------------------ *
 * B4 pilih: V₁ +10 % atau y₁ −10 %
 * ------------------------------------------------------------------ */

function soal4(benih: number): Soal {
  const a = cobaBenih(benih, 4, (r) => aliran(r, 1.2, 8), () => ({ y1: 0.4, V1: 6, Fr: froude(6, 0.4) }));
  const frV = froude(1.1 * a.V1, a.y1);
  const frY = froude(a.V1, 0.9 * a.y1);
  const kunci = frV > frY ? "V" : "y";
  const angka = (f: (v: number, d: number) => string) => ({
    v: f(frV, 2),
    y: f(frY, 2),
    fr: f(a.Fr, 2),
  });
  const r = prng(turunan(benih, 4, 99));
  const pilihan: Pilihan[] = kocok(r, [
    {
      id: "V",
      teks: { id: "Menaikkan V₁ 10 persen", en: "Raising V₁ by 10 per cent" },
      alasan: bi((f, l) =>
        l === "id"
          ? `Fr₁ sebanding V₁: naik ×1,10 menjadi ${angka(f).v}.`
          : `Fr₁ is proportional to V₁: it rises ×1.10 to ${angka(f).v}.`
      ),
    },
    {
      id: "y",
      teks: { id: "Mengurangi y₁ 10 persen", en: "Cutting y₁ by 10 per cent" },
      alasan: bi((f, l) =>
        l === "id"
          ? `Fr₁ hanya sebanding 1/√y₁: naik ×1/√0,9 ≈ ×1,054 menjadi ${angka(f).y}.`
          : `Fr₁ is only proportional to 1/√y₁: it rises ×1/√0.9 ≈ ×1.054 to ${angka(f).y}.`
      ),
    },
    {
      id: "sama",
      teks: { id: "Keduanya sama besar", en: "Both by the same amount" },
      alasan: bi((f, l) =>
        l === "id"
          ? `Tidak sama: V₁ masuk pangkat satu, y₁ di bawah akar (${angka(f).v} lawan ${angka(f).y}).`
          : `Not the same: V₁ enters to the first power, y₁ under a square root (${angka(f).v} against ${angka(f).y}).`
      ),
    },
    {
      id: "tetap",
      teks: { id: "Fr₁ tidak berubah oleh keduanya", en: "Neither changes Fr₁" },
      alasan: {
        id: "Keduanya mengubah Fr₁, karena V₁ dan y₁ sama-sama ada di rumus Fr₁ = V₁/√(g·y₁).",
        en: "Both change Fr₁, since V₁ and y₁ both appear in Fr₁ = V₁/√(g·y₁).",
      },
    },
  ]);
  const masuk = bi((f, l) =>
    l === "id"
      ? `Dari y₁ = ${f(a.y1, 2)} m dan V₁ = ${f(a.V1, 1)} m/s (Fr₁ = ${f(a.Fr, 2)}), perubahan mana yang menaikkan Fr₁ lebih banyak?`
      : `Starting from y₁ = ${f(a.y1, 2)} m and V₁ = ${f(a.V1, 1)} m/s (Fr₁ = ${f(a.Fr, 2)}), which change raises Fr₁ more?`
  );
  return {
    jenis: "pilih",
    id: "oc01-4",
    tanya: masuk,
    pilihan,
    kunci,
    bahas: {
      id: "Fr₁ sebanding V₁ tetapi hanya sebanding 1/√y₁, jadi kecepatan lebih berpengaruh daripada kedalaman. Kartu keadaan lembar menyebut hal yang sama saat Fr₁ ≤ 1.",
      en: "Fr₁ is proportional to V₁ but only to 1/√y₁, so velocity matters more than depth. The state card says the same when Fr₁ ≤ 1.",
    },
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "V₁ naik 10 persen" : "V₁ raised 10 per cent",
        rumus: `Fr₁ = ${f(1.1, 2)} · V₁ / √( g · y₁ )`,
        isi: `${f(1.1 * a.V1, 2)} / √( ${f(G, 2)} · ${f(a.y1, 2)} )`,
        hasil: f(frV, 2),
      },
      {
        judul: l === "id" ? "y₁ berkurang 10 persen" : "y₁ cut 10 per cent",
        rumus: `Fr₁ = V₁ / √( g · ${f(0.9, 1)} · y₁ )`,
        isi: `${f(a.V1, 1)} / √( ${f(G, 2)} · ${f(0.9 * a.y1, 3)} )`,
        hasil: f(frY, 2),
      },
    ]),
    masukan: { y1: a.y1, V1: a.V1 },
  };
}

/* ------------------------------------------------------------------ *
 * B5 hitung: persentase energi teredam
 * ------------------------------------------------------------------ */

function soal5(benih: number): Soal {
  // Fr₁ ≥ 2,5: di bawahnya "dibagi E₂" terlalu dekat dengan kunci (revisi insinyur).
  const a = cobaBenih(benih, 5, (r) => aliran(r, 2.5, 9), () => ({ y1: 0.25, V1: 8.5, Fr: froude(8.5, 0.25) }));
  const y2 = conjugateDepth(a.y1, a.Fr);
  const dE = jumpEnergyLoss(a.y1, y2);
  const E1 = a.y1 + (a.V1 * a.V1) / (2 * G);
  const V2 = (a.V1 * a.y1) / y2;
  const E2 = y2 + (V2 * V2) / (2 * G);
  const kunci = (dE / E1) * 100;
  const tol = 1;
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: kunci },
    [
      {
        nilai: (dE / E2) * 100,
        alasan: {
          id: "Persentase dibagi E₂. Yang ditanya bagian energi HULU yang teredam, jadi pembaginya E₁.",
          en: "The percentage was divided by E₂. The question asks for the share of UPSTREAM energy, so divide by E₁.",
        },
      },
      {
        nilai: ((y2 - a.y1) / (4 * a.y1 * y2) / E1) * 100,
        alasan: {
          id: "Pangkat tiga pada ( y₂ − y₁ ) terlupa. Tanpa pangkat itu ΔE bersatuan 1/m, bukan m, sehingga tidak dapat dibandingkan dengan E₁.",
          en: "The cube on ( y₂ − y₁ ) was dropped. Without it ΔE has units of 1/m, not m, so it cannot be compared with E₁.",
        },
      },
    ],
    { toleransi: tol, digits: 1 }
  );
  const masuk = teksMasuk(a);
  return {
    jenis: "hitung",
    id: "oc01-5",
    tanya: {
      id: `${masuk.id} Berapa persen energi spesifik hulu E₁ yang teredam di loncatan?`,
      en: `${masuk.en} What percentage of the upstream specific energy E₁ is dissipated in the jump?`,
    },
    kunci,
    toleransi: tol,
    digits: 1,
    satuan: { id: "%", en: "%" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `ΔE = (y₂ − y₁)³ / (4·y₁·y₂) = ${f(dE, 3)} m dan E₁ = y₁ + V₁²/(2g) = ${f(E1, 3)} m, jadi ${f(kunci, 1)} persen. Lihat baris Persentase teredam di tabel hasil.`
        : `ΔE = (y₂ − y₁)³ / (4·y₁·y₂) = ${f(dE, 3)} m and E₁ = y₁ + V₁²/(2g) = ${f(E1, 3)} m, so ${f(kunci, 1)} per cent. See the Percentage dissipated row in the results.`
    ),
    langkah: langkahBi((f, l) => [
      langkahFr(a, l, f),
      {
        judul: l === "id" ? "Kedalaman konjugat" : "Conjugate depth",
        rumus: "y₂ = y₁ / 2 · ( √( 1 + 8 · Fr₁² ) − 1 )",
        isi: `${f(a.y1, 2)} / 2 · ( √( 1 + 8 · ${f(a.Fr, 3)}² ) − 1 )`,
        hasil: f(y2, 3),
        satuan: "m",
        tint: C.water,
      },
      {
        judul: l === "id" ? "Energi teredam" : "Energy dissipated",
        rumus: "ΔE = ( y₂ − y₁ )³ / ( 4 · y₁ · y₂ )",
        isi: `( ${f(y2, 3)} − ${f(a.y1, 2)} )³ / ( 4 · ${f(a.y1, 2)} · ${f(y2, 3)} )`,
        hasil: f(dE, 3),
        satuan: "m",
        tint: C.energy,
      },
      {
        judul: l === "id" ? "Bagian energi hulu yang teredam" : "Share of upstream energy dissipated",
        rumus: "ΔE / E₁ · 100;  E₁ = y₁ + V₁² / ( 2 · g )",
        isi: `${f(dE, 4)} / ( ${f(a.y1, 2)} + ${f(a.V1, 1)}² / ( 2 · ${f(G, 2)} ) ) · 100 = ${f(dE, 4)} / ${f(E1, 3)} · 100`,
        hasil: f(kunci, 1),
        satuan: "%",
        tint: C.energy,
      },
    ]),
    masukan: { y1: a.y1, V1: a.V1 },
  };
}

export const OC01: BankKuis = {
  kode: "OC-01",
  jumlah: 5,
  buat: (benih) => [soal1(benih), soal2(benih), soal3(benih), soal4(benih), soal5(benih)],
};
