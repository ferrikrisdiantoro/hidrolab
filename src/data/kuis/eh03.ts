/**
 * Bank soal EH-03 Lintasan ikan bertingkat (KUIS.md, termasuk revisi
 * insinyur 1 November: B4 diganti hitung ε = ρgQΔz/(LBy) dengan banding
 * 150 W/m³, Larinier 2002; tidak ada cascadeOverallPassage; B3 umpan balik
 * menyebut ε berlipat dua bila Q dilipatduakan).
 *
 * Semua masukan jatuh di kisi penggeser lembar (ParamDef di bawah, dipakai
 * InputRow LintasanBertingkatClient), dan semua kunci dihitung SESUDAH
 * pembulatan itu lewat cascadePassage, fungsi yang sama dengan lembar.
 * Lembar menulis beda tinggi tiap undakan sebagai Δz; soal memakai lambang
 * yang sama.
 *
 * Soal contoh: belum ditelaah dosen pengampu (KUIS.md baris 4).
 */

import {
  CASCADE_POOL_RATIO,
  FISHWAY_POWER_GENERAL,
  G,
  cascadePassage,
  type CascadeResult,
} from "../../lib/hydraulics.ts";
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

/** Sama dengan InputRow lembar LintasanBertingkatClient. */
export const P_H: ParamDef = { min: 0.3, max: 12, step: 0.1, digits: 1 };
export const P_N: ParamDef = { min: 2, max: 60, step: 1, digits: 0 };
export const P_L: ParamDef = { min: 1, max: 8, step: 0.2, digits: 1 };
export const P_B: ParamDef = { min: 0.8, max: 8, step: 0.2, digits: 1 };
export const P_Y: ParamDef = { min: 0.1, max: 3, step: 0.05, digits: 2 };
export const P_Q: ParamDef = { min: 0.02, max: 5, step: 0.02, digits: 2 };
export const P_U: ParamDef = { min: 0.5, max: 6, step: 0.1, digits: 1 };

/** Panggilan cascadePassage yang sama dengan lembar. */
export const lintasanLembar = (k: Keadaan): CascadeResult =>
  cascadePassage(k.H, k.N, k.L, k.B, k.y, k.Q, k.Ub);

type F = (v: number, d: number) => string;
type L = "id" | "en";
const langkahBi = (t: (f: F, l: L) => LangkahKuis[]): Bi<LangkahKuis[]> => ({
  id: t((v, d) => fmtL(v, d, "id"), "id"),
  en: t((v, d) => fmtL(v, d, "en"), "en"),
});

/** Keadaan acak yang wajar: kolam beberapa meter, debit sungai kecil. */
function acakKeadaan(r: () => number): Keadaan {
  return {
    H: acakKisi(r, P_H, 1, 8),
    N: bulatAcak(r, 3, 40),
    L: acakKisi(r, P_L, 1.6, 5),
    B: acakKisi(r, P_B, 1, 4),
    y: acakKisi(r, P_Y, 0.4, 2),
    Q: acakKisi(r, P_Q, 0.04, 1),
    Ub: acakKisi(r, P_U, 1.5, 4),
  };
}

const teksKolam = (m: Keadaan, f: F, l: L) =>
  l === "id"
    ? `kolam L = ${f(m.L, 1)} m, B = ${f(m.B, 1)} m, y = ${f(m.y, 2)} m, debit Q = ${f(m.Q, 2)} m³/s`
    : `pools L = ${f(m.L, 1)} m, B = ${f(m.B, 1)} m, y = ${f(m.y, 2)} m, discharge Q = ${f(m.Q, 2)} m³/s`;

const lDz = (m: Keadaan, r: CascadeResult, f: F, l: L): LangkahKuis => ({
  judul: l === "id" ? "Beda tinggi tiap undakan" : "Drop per step",
  rumus: "Δz = H / N",
  isi: `${f(m.H, 1)} / ${f(m.N, 0)}`,
  hasil: f(r.stepDrop, 4),
  satuan: "m",
  tint: C.energy,
});
const lU = (r: CascadeResult, f: F, l: L): LangkahKuis => ({
  judul: l === "id" ? "Kecepatan lompat tegak" : "Vertical jump speed",
  rumus: "u = √( 2 · g · Δz )",
  isi: `√( 2 · ${f(G, 2)} · ${f(r.stepDrop, 4)} )`,
  hasil: f(r.requiredBurst, 3),
  satuan: "m/s",
});
const lEps = (m: Keadaan, r: CascadeResult, f: F, l: L): LangkahKuis => ({
  judul: l === "id" ? "Lesapan daya per isi kolam" : "Dissipation per pool volume",
  rumus: "ε = ρ · g · Q · Δz / ( L · B · y )",
  isi: `1000 · ${f(G, 2)} · ${f(m.Q, 2)} · ${f(r.stepDrop, 4)} / ( ${f(m.L, 1)} · ${f(m.B, 1)} · ${f(m.y, 2)} )`,
  hasil: f(r.powerDensity, 1),
  satuan: "W/m³",
});

/* ------------------------------------------------------------------ *
 * B1 hitung: kecepatan lompat tegak u = √(2gH/N)
 * ------------------------------------------------------------------ */

function soal1(benih: number): Soal {
  const m = cobaBenih<Keadaan>(
    benih,
    1,
    (r) => {
      const k = acakKeadaan(r);
      const dz = lintasanLembar(k).stepDrop;
      return dz >= 0.05 && dz <= 1 ? k : null;
    },
    () => ({ H: 3, N: 10, L: 2, B: 1.6, y: 0.6, Q: 0.1, Ub: 2.5 })
  );
  const r = lintasanLembar(m);
  const tol = 0.02 * r.requiredBurst;
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: r.requiredBurst },
    [
      {
        nilai: Math.sqrt(2 * G * m.H),
        alasan: {
          id: "Ini √(2gH) dengan H seluruhnya. Ikan hanya melompati satu undakan: pakai Δz = H/N.",
          en: "This is √(2gH) with the whole rise H. The fish jumps one step at a time: use Δz = H/N.",
        },
      },
      {
        nilai: Math.sqrt(G * r.stepDrop),
        alasan: {
          id: "Angka 2 hilang. Dari u² = 2gΔz, kecepatan awal lompatan tegak u = √(2gΔz).",
          en: "The factor 2 is missing. From u² = 2gΔz, the launch speed of a vertical jump is u = √(2gΔz).",
        },
      },
      {
        nilai: r.requiredBurst45,
        alasan: {
          id: "Ini kecepatan untuk lompatan 45°, √2 kali lompatan tegak. Soal menanyakan lompatan tegak, batas fisis terkecil.",
          en: "This is the speed for a 45° jump, √2 times the vertical one. The question asks for the vertical jump, the smallest physical demand.",
        },
      },
      {
        nilai: 2 * G * r.stepDrop,
        alasan: {
          id: "Akarnya belum ditarik: 2gΔz adalah u², bukan u.",
          en: "The square root is missing: 2gΔz is u², not u.",
        },
      },
    ],
    { toleransi: tol, digits: 2 }
  );
  return {
    jenis: "hitung",
    id: "eh03-1",
    tanya: bi((f, l) =>
      l === "id"
        ? `Beda tinggi seluruhnya H = ${f(m.H, 1)} m dibagi rata ke N = ${f(m.N, 0)} undakan. Hitung kecepatan lompat tegak u yang dituntut dari ikan untuk naik satu undakan (g = ${f(G, 2)} m/s²).`
        : `A total rise H = ${f(m.H, 1)} m is split evenly over N = ${f(m.N, 0)} steps. Compute the vertical jump speed u demanded from a fish to climb one step (g = ${f(G, 2)} m/s²).`
    ),
    kunci: r.requiredBurst,
    toleransi: tol,
    digits: 2,
    satuan: { id: "m/s", en: "m/s" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `Δz = ${f(m.H, 1)} / ${f(m.N, 0)} = ${f(r.stepDrop, 3)} m, lalu u = √(2gΔz) = ${f(r.requiredBurst, 2)} m/s. Lompatan pada 45° menuntut √2 kali lebih, ${f(r.requiredBurst45, 2)} m/s. Lihat baris Kecepatan lompat tegak di tabel hasil.`
        : `Δz = ${f(m.H, 1)} / ${f(m.N, 0)} = ${f(r.stepDrop, 3)} m, then u = √(2gΔz) = ${f(r.requiredBurst, 2)} m/s. A 45° jump demands √2 times more, ${f(r.requiredBurst45, 2)} m/s. See the Vertical jump speed row in the results.`
    ),
    langkah: langkahBi((f, l) => [lDz(m, r, f, l), lU(r, f, l)]),
    masukan: m,
  };
}

/* ------------------------------------------------------------------ *
 * B2 atur: N paling sedikit yang sah
 * ------------------------------------------------------------------ */

const sahN = (k: Keadaan) => {
  const r = lintasanLembar(k);
  return !r.tooHigh && !r.poolTooShallow;
};

function soal2(benih: number): Soal {
  const s = cobaBenih<{ tetap: Keadaan; Nmin: number; N0: number }>(
    benih,
    2,
    (r) => {
      const k = acakKeadaan(r);
      const tetap = { H: k.H, L: k.L, B: k.B, y: k.y, Q: k.Q, Ub: k.Ub };
      // Telusur kisi N lewat lib, bukan rumus tertutup yang dibulatkan.
      const Nmin = kisi(P_N).find((N) => sahN({ ...tetap, N }));
      if (Nmin === undefined || Nmin < 5 || Nmin + 1 > P_N.max) return null;
      // Pada Nmin kolam tidak teraduk, supaya yang dinilai hanya dua syarat soal.
      if (lintasanLembar({ ...tetap, N: Nmin }).powerDensity > FISHWAY_POWER_GENERAL) return null;
      const N0 = Math.max(P_N.min, Math.round(Nmin / 2));
      return N0 < Nmin ? { tetap, Nmin, N0 } : null;
    },
    () => ({ tetap: { H: 3, L: 3, B: 2, y: 1, Q: 0.3, Ub: 2.5 }, Nmin: 10, N0: 5 })
  );
  const { tetap, Nmin, N0 } = s;
  const r0 = lintasanLembar({ ...tetap, N: N0 });
  const dzMampu = (tetap.Ub * tetap.Ub) / (2 * G);
  const dzKolam = tetap.y / CASCADE_POOL_RATIO;
  const rMin = lintasanLembar({ ...tetap, N: Nmin });
  return {
    jenis: "atur",
    id: "eh03-2",
    tanya: bi((f, l) =>
      l === "id"
        ? `Beda tinggi H = ${f(tetap.H, 1)} m, ${teksKolam(tetap, f, l)}, ikan rancangan Ub = ${f(tetap.Ub, 1)} m/s. Dengan N = ${f(N0, 0)} ${r0.tooHigh ? "undakannya terlalu tinggi" : "kolamnya terlalu dangkal"}. Atur N ke jumlah undakan paling sedikit yang dapat dilompati (u ≤ Ub) dan kolamnya cukup dalam (y ≥ ${f(CASCADE_POOL_RATIO, 2)}·Δz), lalu periksa.`
        : `Rise H = ${f(tetap.H, 1)} m, ${teksKolam(tetap, f, l)}, design fish Ub = ${f(tetap.Ub, 1)} m/s. With N = ${f(N0, 0)} ${r0.tooHigh ? "the steps are too tall" : "the pools are too shallow"}. Set N to the fewest steps that can be jumped (u ≤ Ub) with pools deep enough (y ≥ ${f(CASCADE_POOL_RATIO, 2)}·Δz), then check.`
    ),
    ukur: (k) => k.N,
    simbol: "N",
    digits: 0,
    target: { min: Nmin, max: Nmin + 1 },
    geser: { kunci: "N", p: P_N },
    siapkan: { ...tetap, N: N0 },
    tetap,
    // Sasaran "paling sedikit": Nmin dan satu undakan di atasnya.
    langkahMin: 2,
    bahas: bi((f, l) =>
      l === "id"
        ? `Δz terbesar yang boleh adalah yang lebih kecil dari Ub²/2g = ${f(dzMampu, 3)} m dan y/${f(CASCADE_POOL_RATIO, 2)} = ${f(dzKolam, 3)} m. N paling sedikit ${f(Nmin, 0)} (Δz = ${f(rMin.stepDrop, 3)} m), dan lintasannya ${f(Nmin * tetap.L, 1)} m. Menambah undakan lagi tetap sah tetapi memanjangkan lintasan. Lihat pita u/Ub dan kartu kondisi.`
        : `The largest allowed Δz is the smaller of Ub²/2g = ${f(dzMampu, 3)} m and y/${f(CASCADE_POOL_RATIO, 2)} = ${f(dzKolam, 3)} m. The fewest steps is ${f(Nmin, 0)} (Δz = ${f(rMin.stepDrop, 3)} m), a ${f(Nmin * tetap.L, 1)} m passage. More steps still work but lengthen the passage. See the u/Ub scale and the state card.`
    ),
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "Batas lompat dan batas kolam" : "Jump limit and pool limit",
        rumus: `Δz ≤ min( Ub² / 2g ; y / ${f(CASCADE_POOL_RATIO, 2)} )`,
        isi: `min( ${f(dzMampu, 3)} ; ${f(dzKolam, 3)} )`,
        hasil: f(Math.min(dzMampu, dzKolam), 3),
        satuan: "m",
        tint: C.energy,
      },
      {
        judul: l === "id" ? "N bulat terkecil di kisi penggeser" : "Smallest whole N on the slider",
        rumus: "N ≥ H / Δz",
        isi: `${f(tetap.H, 1)} / ${f(Math.min(dzMampu, dzKolam), 3)}`,
        hasil: f(Nmin, 0),
      },
    ]),
  };
}

/* ------------------------------------------------------------------ *
 * B3 pilih: Q ×2 tidak mengubah status lompat, ε berlipat dua
 * ------------------------------------------------------------------ */

function soal3(benih: number): Soal {
  const tinggi = prng(turunan(benih, 3, 100))() < 0.5;
  const m = cobaBenih<Keadaan>(
    benih,
    3,
    (r) => {
      const k = acakKeadaan(r);
      k.N = bulatAcak(r, 2, 30);
      k.Q = acakKisi(r, P_Q, 0.04, 1.2);
      const h = lintasanLembar(k);
      // Bermargin dari batas u = Ub supaya statusnya tidak bergantung pembulatan.
      if (Math.abs(h.requiredBurst / k.Ub - 1) < 0.05) return null;
      return h.tooHigh === tinggi ? k : null;
    },
    () => (tinggi ? { H: 3, N: 4, L: 3, B: 2, y: 1, Q: 0.3, Ub: 2.5 } : { H: 3, N: 15, L: 3, B: 2, y: 1, Q: 0.3, Ub: 2.5 })
  );
  const r1 = lintasanLembar(m);
  const m2 = { ...m, Q: 2 * m.Q };
  const r2 = lintasanLembar(m2);
  const status: Bi<string> = tinggi
    ? { id: "terlalu tinggi untuk dilompati", en: "too tall to jump" }
    : { id: "dapat dilompati", en: "passable" };
  const pilihan: Pilihan[] = [
    {
      id: "tetap",
      teks: { id: "Status lompatnya tidak berubah; ε berlipat dua", en: "The jump status is unchanged; ε doubles" },
    },
    {
      id: "berubah",
      teks: tinggi
        ? { id: "Undakannya menjadi dapat dilompati: aliran yang lebih besar membantu ikan", en: "The step becomes passable: the larger flow helps the fish" }
        : { id: "Undakannya menjadi terlalu tinggi: arus yang lebih besar menghalangi ikan", en: "The step becomes too tall: the stronger current holds the fish back" },
      alasan: {
        id: "Tuntutan lompat u = √(2gΔz) hanya bergantung pada Δz = H/N. Debit tidak masuk ke rumus itu, jadi status lompatnya tetap.",
        en: "The jump demand u = √(2gΔz) depends on Δz = H/N alone. Discharge is not in it, so the jump status stays.",
      },
    },
    {
      id: "epsTetap",
      teks: { id: "Status lompatnya tidak berubah, ε juga tetap", en: "The jump status is unchanged, and so is ε" },
      alasan: bi((f, l) =>
        l === "id"
          ? `ε = ρgQΔz/(LBy) sebanding Q: dari ${f(r1.powerDensity, 1)} menjadi ${f(r2.powerDensity, 1)} W/m³.`
          : `ε = ρgQΔz/(LBy) is proportional to Q: from ${f(r1.powerDensity, 1)} to ${f(r2.powerDensity, 1)} W/m³.`
      ),
    },
    {
      id: "uDua",
      teks: { id: "Kecepatan lompat yang dituntut u ikut berlipat dua", en: "The demanded jump speed u doubles too" },
      alasan: {
        id: "u = √(2gΔz) tidak memuat Q. Yang berlipat dua adalah ε, daya yang dilesapkan tiap meter kubik kolam.",
        en: "u = √(2gΔz) does not contain Q. What doubles is ε, the power dissipated per cubic metre of pool.",
      },
    },
  ];
  return {
    jenis: "pilih",
    id: "eh03-3",
    tanya: bi((f, l) =>
      l === "id"
        ? `H = ${f(m.H, 1)} m dalam N = ${f(m.N, 0)} undakan, ${teksKolam(m, f, l)}, Ub = ${f(m.Ub, 1)} m/s. Sekarang undakannya ${status.id} (u = ${f(r1.requiredBurst, 2)} m/s). Debit dilipatduakan menjadi ${f(m2.Q, 2)} m³/s, yang lain tetap. Apa yang terjadi?`
        : `H = ${f(m.H, 1)} m over N = ${f(m.N, 0)} steps, ${teksKolam(m, f, l)}, Ub = ${f(m.Ub, 1)} m/s. The step is now ${status.en} (u = ${f(r1.requiredBurst, 2)} m/s). The discharge is doubled to ${f(m2.Q, 2)} m³/s, all else fixed. What happens?`
    ),
    pilihan,
    kunci: "tetap",
    bahas: bi((f, l) =>
      l === "id"
        ? `u = √(2gΔz) = ${f(r1.requiredBurst, 2)} m/s tidak memuat Q, jadi undakannya tetap ${status.id}. Q ×2 menggandakan ε: ${f(r1.powerDensity, 1)} → ${f(r2.powerDensity, 1)} W/m³ (batas ${f(FISHWAY_POWER_GENERAL, 0)}). Lembar sekarang memakai Q = ${f(m2.Q, 2)} m³/s; lihat baris ε dan u di tabel hasil.`
        : `u = √(2gΔz) = ${f(r1.requiredBurst, 2)} m/s does not contain Q, so the step stays ${status.en}. Q ×2 doubles ε: ${f(r1.powerDensity, 1)} → ${f(r2.powerDensity, 1)} W/m³ (limit ${f(FISHWAY_POWER_GENERAL, 0)}). The sheet now uses Q = ${f(m2.Q, 2)} m³/s; see the ε and u rows in the results.`
    ),
    langkah: langkahBi((f, l) => [
      lU(r1, f, l),
      { ...lEps(m, r1, f, l), judul: l === "id" ? `ε pada Q = ${f(m.Q, 2)}` : `ε at Q = ${f(m.Q, 2)}` },
      { ...lEps(m2, r2, f, l), judul: l === "id" ? `ε pada 2Q = ${f(m2.Q, 2)}` : `ε at 2Q = ${f(m2.Q, 2)}` },
    ]),
    masukan: m2,
  };
}

/* ------------------------------------------------------------------ *
 * B4 hitung: ε = ρgQΔz/(LBy), banding 150 W/m³
 * ------------------------------------------------------------------ */

function soal4(benih: number): Soal {
  const m = cobaBenih<Keadaan>(
    benih,
    4,
    (r) => {
      const k = acakKeadaan(r);
      k.N = bulatAcak(r, 3, 25);
      const e = lintasanLembar(k).powerDensity;
      // Di kedua sisi 150, bermargin supaya perbandingannya jelas.
      return e >= 30 && e <= 600 && Math.abs(e / FISHWAY_POWER_GENERAL - 1) > 0.1 ? k : null;
    },
    () => ({ H: 3, N: 10, L: 2, B: 1.6, y: 0.6, Q: 0.1, Ub: 2.5 })
  );
  const r = lintasanLembar(m);
  const tol = 0.02 * r.powerDensity;
  const teraduk = r.powerDensity > FISHWAY_POWER_GENERAL;
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: r.powerDensity },
    [
      {
        nilai: r.powerDensity * m.N,
        alasan: {
          id: "Ini memakai H seluruhnya. Tiap kolam hanya melesapkan terjunan satu undakan, Δz = H/N.",
          en: "This uses the whole rise H. Each pool only dissipates the drop of one step, Δz = H/N.",
        },
      },
      {
        nilai: r.powerDensity * m.y,
        alasan: {
          id: "Isi kolam L·B·y: kedalaman y tertinggal, jadi yang terhitung daya per luas, bukan per isi.",
          en: "Pool volume is L·B·y: the depth y was left out, so this is power per area, not per volume.",
        },
      },
      {
        nilai: r.powerDensity / G,
        alasan: {
          id: "g tertinggal. Daya terjunan ρgQΔz memuat percepatan gravitasi.",
          en: "g was left out. The falling power ρgQΔz contains gravitational acceleration.",
        },
      },
    ],
    { toleransi: tol, digits: 1 }
  );
  return {
    jenis: "hitung",
    id: "eh03-4",
    tanya: bi((f, l) =>
      l === "id"
        ? `H = ${f(m.H, 1)} m dalam N = ${f(m.N, 0)} undakan, ${teksKolam(m, f, l)}. Hitung lesapan daya per isi kolam ε = ρgQΔz/(LBy), dengan ρ = 1000 kg/m³ dan g = ${f(G, 2)} m/s².`
        : `H = ${f(m.H, 1)} m over N = ${f(m.N, 0)} steps, ${teksKolam(m, f, l)}. Compute the power dissipated per pool volume ε = ρgQΔz/(LBy), with ρ = 1000 kg/m³ and g = ${f(G, 2)} m/s².`
    ),
    kunci: r.powerDensity,
    toleransi: tol,
    digits: 1,
    satuan: { id: "W/m³", en: "W/m³" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `Δz = ${f(r.stepDrop, 3)} m, isi kolam ${f(m.L * m.B * m.y, 2)} m³, ε = ${f(r.powerDensity, 1)} W/m³. ${teraduk ? `Di atas ${f(FISHWAY_POWER_GENERAL, 0)} W/m³ kolamnya terlalu teraduk: ikan kehilangan arah (Larinier 2002). Perbesar kolam atau bagi debitnya.` : `Di bawah ${f(FISHWAY_POWER_GENERAL, 0)} W/m³ kolamnya cukup tenang untuk ikan beristirahat (Larinier 2002).`} Lihat baris ε di tabel hasil.`
        : `Δz = ${f(r.stepDrop, 3)} m, pool volume ${f(m.L * m.B * m.y, 2)} m³, ε = ${f(r.powerDensity, 1)} W/m³. ${teraduk ? `Above ${f(FISHWAY_POWER_GENERAL, 0)} W/m³ the pool is too turbulent: fish lose their way (Larinier 2002). Enlarge the pool or split the discharge.` : `Below ${f(FISHWAY_POWER_GENERAL, 0)} W/m³ the pool is calm enough for fish to rest (Larinier 2002).`} See the ε row in the results.`
    ),
    langkah: langkahBi((f, l) => [lDz(m, r, f, l), lEps(m, r, f, l)]),
    masukan: m,
  };
}

/* ------------------------------------------------------------------ *
 * B5 pilih: N naik → Δz dan u turun, lintasan memanjang
 * ------------------------------------------------------------------ */

function soal5(benih: number): Soal {
  const s = cobaBenih<{ m: Keadaan; N2: number }>(
    benih,
    5,
    (r) => {
      const m = acakKeadaan(r);
      m.N = bulatAcak(r, 3, 30);
      const N2 = m.N + bulatAcak(r, 2, 12);
      return N2 <= P_N.max ? { m, N2 } : null;
    },
    () => ({ m: { H: 3, N: 6, L: 3, B: 2, y: 1, Q: 0.3, Ub: 2.5 }, N2: 12 })
  );
  const { m, N2 } = s;
  const m2 = { ...m, N: N2 };
  const r1 = lintasanLembar(m), r2 = lintasanLembar(m2);
  const pilihan: Pilihan[] = [
    {
      id: "turun-panjang",
      teks: { id: "Δz dan u turun; lintasan N·L memanjang", en: "Δz and u fall; the passage N·L gets longer" },
    },
    {
      id: "turun-tetap",
      teks: { id: "Δz dan u turun; panjang lintasan tetap karena H tetap", en: "Δz and u fall; the passage length stays because H stays" },
      alasan: bi((f, l) =>
        l === "id"
          ? `Panjang lintasan N·L, bukan H: ${f(m.N * m.L, 1)} m menjadi ${f(N2 * m.L, 1)} m.`
          : `The passage length is N·L, not H: ${f(m.N * m.L, 1)} m becomes ${f(N2 * m.L, 1)} m.`
      ),
    },
    {
      id: "u-tetap",
      teks: { id: "Δz turun, tetapi u tetap karena u ditentukan ikannya", en: "Δz falls, but u stays because the fish sets u" },
      alasan: bi((f, l) =>
        l === "id"
          ? `Yang ditentukan ikan adalah Ub. u adalah tuntutan undakan, √(2gΔz), dan ikut turun: ${f(r1.requiredBurst, 2)} → ${f(r2.requiredBurst, 2)} m/s.`
          : `The fish sets Ub. u is the demand of the step, √(2gΔz), and it falls too: ${f(r1.requiredBurst, 2)} → ${f(r2.requiredBurst, 2)} m/s.`
      ),
    },
    {
      id: "u-naik",
      teks: { id: "Δz turun, tetapi u naik karena ikan harus melompat lebih sering", en: "Δz falls, but u rises because the fish has to jump more often" },
      alasan: {
        id: "u adalah tuntutan satu lompatan, √(2gΔz). Lompatan lebih banyak, tetapi tiap lompatan lebih rendah.",
        en: "u is the demand of one jump, √(2gΔz). There are more jumps, but each is lower.",
      },
    },
  ];
  return {
    jenis: "pilih",
    id: "eh03-5",
    tanya: bi((f, l) =>
      l === "id"
        ? `H = ${f(m.H, 1)} m dalam N = ${f(m.N, 0)} undakan, panjang kolam L = ${f(m.L, 1)} m. Jumlah undakan dinaikkan menjadi ${f(N2, 0)}, H dan L tetap. Apa yang terjadi pada beda tinggi tiap undakan Δz, kecepatan lompat u, dan panjang lintasan?`
        : `H = ${f(m.H, 1)} m over N = ${f(m.N, 0)} steps, pool length L = ${f(m.L, 1)} m. The number of steps is raised to ${f(N2, 0)}, H and L fixed. What happens to the drop per step Δz, the jump speed u, and the passage length?`
    ),
    pilihan,
    kunci: "turun-panjang",
    bahas: bi((f, l) =>
      l === "id"
        ? `Δz ${f(r1.stepDrop, 3)} → ${f(r2.stepDrop, 3)} m, u ${f(r1.requiredBurst, 2)} → ${f(r2.requiredBurst, 2)} m/s, lintasan ${f(m.N * m.L, 1)} → ${f(N2 * m.L, 1)} m. Panjang dan tuntutan lompat bergerak berlawanan arah. Lihat baris Δz, u, dan Ltot di tabel hasil.`
        : `Δz ${f(r1.stepDrop, 3)} → ${f(r2.stepDrop, 3)} m, u ${f(r1.requiredBurst, 2)} → ${f(r2.requiredBurst, 2)} m/s, passage ${f(m.N * m.L, 1)} → ${f(N2 * m.L, 1)} m. Length and jump demand move in opposite directions. See the Δz, u, and Ltot rows in the results.`
    ),
    langkah: langkahBi((f, l) => [
      lDz(m2, r2, f, l),
      lU(r2, f, l),
      {
        judul: l === "id" ? "Panjang lintasan" : "Passage length",
        rumus: "Ltot = N · L",
        isi: `${f(N2, 0)} · ${f(m.L, 1)}`,
        hasil: f(N2 * m.L, 1),
        satuan: "m",
      },
    ]),
    masukan: m2,
  };
}

export const EH03: BankKuis = {
  kode: "EH-03",
  jumlah: 5,
  buat: (benih) => [soal1(benih), soal2(benih), soal3(benih), soal4(benih), soal5(benih)],
};
