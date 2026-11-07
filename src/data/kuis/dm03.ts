/**
 * Bank soal DM-03 Drainase bendungan urugan batu (KUIS.md putaran 2; revisi
 * insinyur 1 November: LULUS apa adanya). i = Δh/L, rockfillFlow(i, d, n, t)
 * pada 20 °C, panggilan yang sama dengan lembar (aliranLembar).
 *
 * Semua masukan jatuh di kisi penggeser lembar (ParamDef di bawah, dipakai
 * InputRow dan pegangan titik kerja DrainaseUruganBatuClient), dan semua
 * kunci dihitung SESUDAH pembulatan itu lewat rockfillFlow.
 *
 * Soal contoh: belum ditelaah dosen pengampu (KUIS.md baris 4).
 */

import {
  ERGUN_INERTIAL,
  ERGUN_VISCOUS,
  G,
  PORE_RE_DARCY,
  rockfillFlow,
  waterViscosity,
  type RockflowResult,
} from "../../lib/hydraulics.ts";
import { C } from "../../lib/theme.ts";
import { keLangkah, type ParamDef } from "../../lib/rentang.ts";
import {
  acakKisi,
  bi,
  buangDuplikat,
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

/** Sama dengan InputRow lembar DrainaseUruganBatuClient. P_HEAD juga dipakai pegangan titik kerja. */
export const P_HEAD: ParamDef = { min: 0.02, max: 20, step: 0.02, digits: 2 };
export const P_L: ParamDef = { min: 1, max: 120, step: 1, digits: 0 };
export const P_D: ParamDef = { min: 0.005, max: 1.2, step: 0.005, digits: 3 };
export const P_N: ParamDef = { min: 0.2, max: 0.5, step: 0.01, digits: 2 };
export const P_T: ParamDef = { min: 0.2, max: 30, step: 0.2, digits: 1 };

/** Panggilan rockfillFlow yang sama dengan lembar (20 °C bawaan). */
export const aliranLembar = (k: Keadaan): RockflowResult =>
  rockfillFlow(k.dh / Math.max(k.L, 1e-6), k.d, k.n, k.t);

const NU = waterViscosity(20);
const KISI_DH = kisi(P_HEAD);

type F = (v: number, d: number) => string;
type L = "id" | "en";
const langkahBi = (t: (f: F, l: L) => LangkahKuis[]): Bi<LangkahKuis[]> => ({
  id: t((v, d) => fmtL(v, d, "id"), "id"),
  en: t((v, d) => fmtL(v, d, "en"), "en"),
});

const PANGKAT: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
/** Tiga angka berarti dengan pangkat sepuluh, misalnya 1,23·10⁻³ (seperti fmtSci lembar). */
function sci(v: number, l: L): string {
  if (!Number.isFinite(v) || v === 0) return fmtL(v, 2, l);
  let e = Math.floor(Math.log10(Math.abs(v)));
  let m = v / Math.pow(10, e);
  if (Math.abs(Number(m.toFixed(2))) >= 10) { m /= 10; e += 1; }
  if (e >= -1 && e <= 2) return fmtL(v, Math.max(0, 2 - e), l);
  return `${fmtL(m, 2, l)}·10${String(e).split("").map((c) => PANGKAT[c]).join("")}`;
}
/** Angka di belakang koma untuk tiga angka berarti. */
const digitsUntuk = (v: number) => Math.max(0, 2 - Math.floor(Math.log10(Math.abs(v))));

/** Δh di kisi penggeser yang memberi Rep terdekat ke sasaran (log). */
function dhUntukRe(tetap: Keadaan, sasaran: number): number {
  let terbaik = KISI_DH[0], selisih = Infinity;
  for (const dh of KISI_DH) {
    const s = Math.abs(Math.log(aliranLembar({ ...tetap, dh }).poreRe / sasaran));
    if (s < selisih) { selisih = s; terbaik = dh; }
  }
  return terbaik;
}

const logSeragam = (r: () => number, a: number, b: number) => Math.exp(seragam(r, Math.log(a), Math.log(b)));

const teksUrugan = (m: Keadaan, f: F, l: L) =>
  l === "id"
    ? `Urugan dengan butiran setara d = ${f(m.d, 3)} m dan porositas n = ${f(m.n, 2)} dialiri air 20 °C pada beda tinggi Δh = ${f(m.dh, 2)} m sepanjang L = ${f(m.L, 0)} m`
    : `Fill with equivalent grain size d = ${f(m.d, 3)} m and porosity n = ${f(m.n, 2)} carries water at 20 °C under a head difference Δh = ${f(m.dh, 2)} m over L = ${f(m.L, 0)} m`;

const lI = (m: Keadaan, r: RockflowResult, f: F, l: L): LangkahKuis => ({
  judul: l === "id" ? "Gradien hidraulik" : "Hydraulic gradient",
  rumus: "i = Δh / L",
  isi: `${f(m.dh, 2)} / ${f(m.L, 0)}`,
  hasil: f(r.i, 5),
  tint: C.critical,
});
const lAB = (m: Keadaan, r: RockflowResult, f: F, l: L): LangkahKuis => ({
  judul: l === "id" ? "Tetapan Ergun" : "Ergun constants",
  rumus: `A = ${f(ERGUN_VISCOUS, 0)} (1 − n)² ν / ( n³ g d² ) ; B = ${f(ERGUN_INERTIAL, 2)} (1 − n) / ( n³ g d )`,
  isi: `n = ${f(m.n, 2)} ; d = ${f(m.d, 3)} ; ν = ${sci(NU, l)} ; g = ${f(G, 2)}`,
  hasil: `${sci(r.A, l)} ; ${sci(r.B, l)}`,
});
const lV = (r: RockflowResult, f: F, l: L): LangkahKuis => ({
  judul: l === "id" ? "Kecepatan semu, akar positif i = A v + B v²" : "Superficial velocity, positive root of i = A v + B v²",
  rumus: "v = 2 i / ( A + √( A² + 4 B i ) )",
  isi: `2 · ${f(r.i, 5)} / ( ${sci(r.A, l)} + √( (${sci(r.A, l)})² + 4 · ${sci(r.B, l)} · ${f(r.i, 5)} ) )`,
  hasil: sci(r.v, l),
  satuan: "m/s",
  tint: C.water,
});
const lRe = (m: Keadaan, r: RockflowResult, f: F, l: L): LangkahKuis => ({
  judul: l === "id" ? "Bilangan Reynolds pori" : "Pore Reynolds number",
  rumus: "Rep = v · d / ( ν · (1 − n) )",
  isi: `${sci(r.v, l)} · ${f(m.d, 3)} / ( ${sci(NU, l)} · (1 − ${f(m.n, 2)}) )`,
  hasil: f(r.poreRe, digitsUntuk(r.poreRe)),
});

/** Urugan acak di kisi penggeser (Δh dipilih kemudian). */
function acakUrugan(r: () => number, dLo: number, dHi: number): Keadaan {
  return {
    dh: 1,
    L: acakKisi(r, P_L, 10, 120),
    d: acakKisi(r, P_D, dLo, dHi),
    n: acakKisi(r, P_N, 0.3, 0.45),
    t: acakKisi(r, P_T, 1, 10),
  };
}

/* ------------------------------------------------------------------ *
 * B1 pilih: Darcy berlaku atau tidak
 * ------------------------------------------------------------------ */

function soal1(benih: number): Soal {
  const darcy = prng(turunan(benih, 1, 100))() < 0.5;
  const m = cobaBenih<Keadaan>(
    benih,
    1,
    (r) => {
      const k = darcy ? acakUrugan(r, 0.005, 0.03) : acakUrugan(r, 0.01, 0.5);
      k.dh = dhUntukRe(k, darcy ? logSeragam(r, 0.3, 6) : logSeragam(r, 20, 3000));
      const h = aliranLembar(k);
      if (h.poreRe >= 7 && h.poreRe <= 14) return null;
      return h.darcyValid === darcy ? k : null;
    },
    () => (darcy ? { dh: 0.05, L: 60, d: 0.005, n: 0.35, t: 1 } : { dh: 6, L: 20, d: 0.4, n: 0.42, t: 6 })
  );
  const r = aliranLembar(m);
  const pilihan: Pilihan[] = [
    {
      id: "darcy",
      teks: { id: "Darcy berlaku: v sebanding i", en: "Darcy holds: v is proportional to i" },
      alasan: bi((f, l) =>
        l === "id"
          ? `Rep = ${f(r.poreRe, digitsUntuk(r.poreRe))} di atas ${f(PORE_RE_DARCY, 0)}: suku inersia B v² sudah memakan ${f(r.turbulentShare * 100, 0)} % gradien.`
          : `Rep = ${f(r.poreRe, digitsUntuk(r.poreRe))} is above ${f(PORE_RE_DARCY, 0)}: the inertial term B v² already takes ${f(r.turbulentShare * 100, 0)} % of the gradient.`
      ),
    },
    {
      id: "inersia",
      teks: { id: "Darcy tidak berlaku: v mendekati sebanding √i", en: "Darcy does not hold: v approaches proportional to √i" },
      alasan: bi((f, l) =>
        l === "id"
          ? `Rep = ${f(r.poreRe, digitsUntuk(r.poreRe))} di bawah ${f(PORE_RE_DARCY, 0)}: suku kental menguasai dan kemiringan log-log ${f(r.exponent, 3)}, hampir 1.`
          : `Rep = ${f(r.poreRe, digitsUntuk(r.poreRe))} is below ${f(PORE_RE_DARCY, 0)}: the viscous term dominates and the log-log slope is ${f(r.exponent, 3)}, almost 1.`
      ),
    },
    {
      id: "kuadrat",
      teks: { id: "Aliran makin cepat dari Darcy: v sebanding i²", en: "Flow outruns Darcy: v is proportional to i²" },
      alasan: {
        id: "Persamaan Ergun i = A v + B v² memberi kemiringan log-log v terhadap i antara 1/2 dan 1, tidak pernah 2. Inersia memperlambat, bukan mempercepat.",
        en: "Ergun's i = A v + B v² gives a log-log slope of v against i between 1/2 and 1, never 2. Inertia slows the flow, it does not speed it up.",
      },
    },
  ];
  return {
    jenis: "pilih",
    id: "dm03-1",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksUrugan(m, f, l)}. Apakah hukum Darcy berlaku untuk aliran ini?`
        : `${teksUrugan(m, f, l)}. Does Darcy law hold for this flow?`
    ),
    pilihan,
    kunci: r.darcyValid ? "darcy" : "inersia",
    bahas: bi((f, l) =>
      l === "id"
        ? `Rep = ${f(r.poreRe, digitsUntuk(r.poreRe))}, ${r.darcyValid ? "di bawah" : "di atas"} batas ${f(PORE_RE_DARCY, 0)}. Kemiringan garis i–v di grafik log-log m = ${f(r.exponent, 3)}: 1 berarti Darcy, 1/2 berarti inersia penuh. Lihat baris Rep di tabel hasil dan pita Rep di atas grafik.`
        : `Rep = ${f(r.poreRe, digitsUntuk(r.poreRe))}, ${r.darcyValid ? "below" : "above"} the limit ${f(PORE_RE_DARCY, 0)}. The slope of the i–v line on the log-log graph is m = ${f(r.exponent, 3)}: 1 means Darcy, 1/2 means fully inertial. See the Rep row in the results and the Rep scale above the graph.`
    ),
    langkah: langkahBi((f, l) => [lI(m, r, f, l), lAB(m, r, f, l), lV(r, f, l), lRe(m, r, f, l)]),
    masukan: m,
  };
}

/* ------------------------------------------------------------------ *
 * B2 hitung: Re pori
 * ------------------------------------------------------------------ */

function soal2(benih: number): Soal {
  const m = cobaBenih<Keadaan>(
    benih,
    2,
    (r) => {
      const k = acakUrugan(r, 0.005, 0.3);
      k.dh = dhUntukRe(k, logSeragam(r, 1, 900));
      const h = aliranLembar(k);
      return h.poreRe >= 1 && h.poreRe <= 999 ? k : null;
    },
    () => ({ dh: 2, L: 20, d: 0.02, n: 0.4, t: 2 })
  );
  const r = aliranLembar(m);
  const tol = 0.03 * r.poreRe;
  const digits = digitsUntuk(r.poreRe);
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: r.poreRe },
    [
      {
        nilai: (r.v * m.d) / NU,
        alasan: {
          id: "(1 − n) di penyebut tertinggal. Rep menurut Ergun = v·d/(ν(1 − n)): kecepatan pori v/n dikali ukuran pori yang sebanding n·d/(1 − n), sehingga n saling hapus dan tersisa (1 − n).",
          en: "The (1 − n) in the denominator is missing. Ergun's Rep = v·d/(ν(1 − n)): the pore velocity v/n times a pore size proportional to n·d/(1 − n), so n cancels and (1 − n) remains.",
        },
      },
      {
        nilai: (r.vDarcy * m.d) / (NU * (1 - m.n)),
        alasan: {
          id: "Ini memakai vD = k·i dari hukum Darcy. Di urugan ini kecepatan sebenarnya v dari persamaan Ergun.",
          en: "This uses vD = k·i from Darcy law. In this fill the real velocity is v from the Ergun equation.",
        },
      },
      {
        nilai: (r.v * m.d) / (1e-3 * (1 - m.n)),
        alasan: {
          id: "ν tertukar dengan kekentalan dinamik μ ≈ 10⁻³ Pa·s. Kekentalan kinematik air 20 °C sekitar 1,0·10⁻⁶ m²/s.",
          en: "ν was swapped for the dynamic viscosity μ ≈ 10⁻³ Pa·s. The kinematic viscosity of water at 20 °C is about 1.0·10⁻⁶ m²/s.",
        },
      },
    ],
    { toleransi: tol, digits }
  );
  return {
    jenis: "hitung",
    id: "dm03-2",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksUrugan(m, f, l)}. Persamaan Ergun memberi kecepatan semu v = ${sci(r.v, l)} m/s (Darcy akan meramalkan vD = ${sci(r.vDarcy, l)} m/s). Dengan ν = ${sci(NU, l)} m²/s, hitung bilangan Reynolds pori Rep.`
        : `${teksUrugan(m, f, l)}. The Ergun equation gives a superficial velocity v = ${sci(r.v, l)} m/s (Darcy would predict vD = ${sci(r.vDarcy, l)} m/s). With ν = ${sci(NU, l)} m²/s, compute the pore Reynolds number Rep.`
    ),
    kunci: r.poreRe,
    toleransi: tol,
    digits,
    satuan: { id: "", en: "" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `Rep = v·d/(ν(1 − n)) = ${f(r.poreRe, digits)}, ${r.darcyValid ? "di bawah 10, Darcy masih berlaku" : "di atas 10, aliran inersia"}. Lihat baris Rep di tabel hasil.`
        : `Rep = v·d/(ν(1 − n)) = ${f(r.poreRe, digits)}, ${r.darcyValid ? "below 10, Darcy still holds" : "above 10, inertial flow"}. See the Rep row in the results.`
    ),
    langkah: langkahBi((f, l) => [lRe(m, r, f, l)]),
    masukan: m,
  };
}

/* ------------------------------------------------------------------ *
 * B3 hitung: q = v·t pada aliran inersia
 * ------------------------------------------------------------------ */

function soal3(benih: number): Soal {
  const m = cobaBenih<Keadaan>(
    benih,
    3,
    (r) => {
      // Butir 3..8 cm (revisi insinyur 8 November): batu kasar membuat vD/v
      // ribuan karena k Darcy lembar = batas kental Ergun 1/A.
      const k = acakUrugan(r, 0.03, 0.08);
      k.dh = acakKisi(r, P_HEAD, 0.2, 20);
      const h = aliranLembar(k);
      return h.turbulentShare > 0.5 && h.q >= 0.01 && h.q <= 20 && h.overprediction > 1.2 && h.overprediction <= 100 ? k : null;
    },
    () => ({ dh: 2, L: 20, d: 0.05, n: 0.4, t: 2 })
  );
  const r = aliranLembar(m);
  const tol = 0.02 * r.q;
  const digits = digitsUntuk(r.q);
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: r.q },
    [
      {
        nilai: r.vDarcy * m.t,
        alasan: bi((f, l) =>
          l === "id"
            ? `Ini k·i·t dengan hukum Darcy, ${f(r.overprediction, 1)} kali aliran sebenarnya. Di urugan batu suku B v² menguasai; selesaikan i = A v + B v² untuk v.`
            : `This is k·i·t with Darcy law, ${f(r.overprediction, 1)} times the real flow. In rockfill the B v² term dominates; solve i = A v + B v² for v.`
        ),
      },
      {
        nilai: r.v,
        alasan: {
          id: "Ini kecepatan semu v. Debit tiap meter lebar q = v·t, dikali tebal lapisan.",
          en: "This is the superficial velocity v. The discharge per metre width is q = v·t, times the layer thickness.",
        },
      },
    ],
    { toleransi: tol, digits }
  );
  return {
    jenis: "hitung",
    id: "dm03-3",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksUrugan(m, f, l)}, tebal lapisan t = ${f(m.t, 1)} m. Tetapan Ergun urugan ini A = ${sci(r.A, l)} s/m dan B = ${sci(r.B, l)} s²/m². Hitung debit q tiap meter lebar.`
        : `${teksUrugan(m, f, l)}, layer thickness t = ${f(m.t, 1)} m. The Ergun constants of this fill are A = ${sci(r.A, l)} s/m and B = ${sci(r.B, l)} s²/m². Compute the discharge q per metre width.`
    ),
    kunci: r.q,
    toleransi: tol,
    digits,
    satuan: { id: "m³/s per m", en: "m³/s per m" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `i = ${f(r.i, 5)}, akar positif i = A v + B v² memberi v = ${sci(r.v, l)} m/s, q = v·t = ${f(r.q, digits)} m³/s per m. ${f(r.turbulentShare * 100, 0)} % gradiennya terpakai suku inersia, jadi hukum Darcy melebih-lebihkan ${f(r.overprediction, 1)} kali. Lihat baris q dan vD/v di tabel hasil.`
        : `i = ${f(r.i, 5)}, the positive root of i = A v + B v² gives v = ${sci(r.v, l)} m/s, q = v·t = ${f(r.q, digits)} m³/s per m. ${f(r.turbulentShare * 100, 0)} % of the gradient goes to the inertial term, so Darcy law overpredicts ${f(r.overprediction, 1)} times. See the q and vD/v rows in the results.`
    ),
    langkah: langkahBi((f, l) => [
      lI(m, r, f, l),
      lV(r, f, l),
      {
        judul: l === "id" ? "Debit tiap meter lebar" : "Discharge per metre width",
        rumus: "q = v · t",
        isi: `${sci(r.v, l)} · ${f(m.t, 1)}`,
        hasil: f(r.q, digits),
        satuan: "m³/s per m",
        tint: C.water,
      },
    ]),
    masukan: m,
  };
}

/* ------------------------------------------------------------------ *
 * B4 pilih numerik: Δh ×2 → q ×?
 * ------------------------------------------------------------------ */

const RASIO: { id: string; nilai: number; teks: Bi<string> }[] = [
  { id: "tetap", nilai: 1, teks: { id: "q hampir tidak berubah", en: "q hardly changes" } },
  { id: "akar", nilai: Math.SQRT2, teks: { id: "q naik kira-kira ×1,41 (√2)", en: "q rises about ×1.41 (√2)" } },
  { id: "dua", nilai: 2, teks: { id: "q naik kira-kira ×2", en: "q rises about ×2" } },
  { id: "empat", nilai: 4, teks: { id: "q naik kira-kira ×4", en: "q rises about ×4" } },
];

function soal4(benih: number): Soal {
  const halus = prng(turunan(benih, 4, 100))() < 0.5;
  const m = cobaBenih<Keadaan>(
    benih,
    4,
    (r) => {
      const k = halus ? acakUrugan(r, 0.005, 0.015) : acakUrugan(r, 0.05, 0.8);
      k.dh = halus ? dhUntukRe(k, logSeragam(r, 0.02, 0.3)) : acakKisi(r, P_HEAD, 0.2, 10);
      if (2 * k.dh > P_HEAD.max) return null;
      const e = aliranLembar(k).exponent;
      return halus ? (e > 0.97 ? k : null) : e < 0.53 ? k : null;
    },
    () => (halus ? { dh: 0.02, L: 120, d: 0.005, n: 0.35, t: 1 } : { dh: 6, L: 20, d: 0.4, n: 0.42, t: 6 })
  );
  const r1 = aliranLembar(m);
  const m2 = { ...m, dh: 2 * m.dh };
  const r2 = aliranLembar(m2);
  const rasio = r2.q / r1.q;
  const kunci = [...RASIO].sort((a, b) => Math.abs(a.nilai - rasio) - Math.abs(b.nilai - rasio))[0].id;
  const pilihan: Pilihan[] = RASIO.map((p) => ({
    id: p.id,
    teks: p.teks,
    ...(p.id === kunci
      ? {}
      : {
          alasan: bi((f, l) =>
            l === "id"
              ? `Rasio sebenarnya ×${f(rasio, 2)}: v ∝ i^m dengan m = ${f(r1.exponent, 3)}, jadi q(2Δh)/q(Δh) ≈ 2^m.`
              : `The actual ratio is ×${f(rasio, 2)}: v ∝ i^m with m = ${f(r1.exponent, 3)}, so q(2Δh)/q(Δh) ≈ 2^m.`
          ),
        }),
  }));
  return {
    jenis: "pilih",
    id: "dm03-4",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksUrugan(m, f, l)}. Bila beda tingginya dilipatduakan menjadi ${f(m2.dh, 2)} m, berapa kali debit q?`
        : `${teksUrugan(m, f, l)}. If the head difference is doubled to ${f(m2.dh, 2)} m, by what factor does the discharge q change?`
    ),
    pilihan,
    kunci,
    bahas: bi((f, l) =>
      l === "id"
        ? `q ${f(r1.q * 1000, 3)} → ${f(r2.q * 1000, 3)} l/s per m, ×${f(rasio, 2)}. ${halus ? "Butiran halus, Rep kecil: suku kental menguasai dan v sebanding i (Darcy)." : "Batu kasar: suku inersia menguasai dan v sebanding √i, jadi menggandakan Δh hanya menaikkan q sekitar 41 %."} Lihat kemiringan lengkung di grafik log-log dan baris m di tabel hasil. Lembar sekarang memakai Δh = ${f(m2.dh, 2)} m.`
        : `q ${f(r1.q * 1000, 3)} → ${f(r2.q * 1000, 3)} l/s per m, ×${f(rasio, 2)}. ${halus ? "Fine grains, small Rep: the viscous term dominates and v is proportional to i (Darcy)." : "Coarse rock: the inertial term dominates and v is proportional to √i, so doubling Δh raises q by only about 41 %."} See the slope of the curve on the log-log graph and the m row in the results. The sheet now uses Δh = ${f(m2.dh, 2)} m.`
    ),
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? `Pada Δh = ${f(m.dh, 2)} m` : `At Δh = ${f(m.dh, 2)} m`,
        rumus: "q = v · t",
        isi: `${sci(r1.v, l)} · ${f(m.t, 1)}`,
        hasil: sci(r1.q, l),
        satuan: "m³/s per m",
      },
      {
        judul: l === "id" ? `Pada 2Δh = ${f(m2.dh, 2)} m` : `At 2Δh = ${f(m2.dh, 2)} m`,
        rumus: "q = v · t",
        isi: `${sci(r2.v, l)} · ${f(m.t, 1)}`,
        hasil: sci(r2.q, l),
        satuan: "m³/s per m",
        tint: C.water,
      },
    ]),
    masukan: m2,
  };
}

/* ------------------------------------------------------------------ *
 * B5 atur: Δh sampai q = sasaran ±5 %
 * ------------------------------------------------------------------ */

function soal5(benih: number): Soal {
  const s = cobaBenih<{ tetap: Keadaan; dhS: number; qS: number; dh0: number }>(
    benih,
    5,
    (r) => {
      const k = acakUrugan(r, 0.02, 0.8);
      const tetap = { L: k.L, d: k.d, n: k.n, t: k.t };
      const dhS = acakKisi(r, P_HEAD, 1, 10);
      const qS = aliranLembar({ ...tetap, dh: dhS }).q;
      if (!(qS >= 0.2 && qS <= 20)) return null;
      const di = (dh: number) => {
        const u = aliranLembar({ ...tetap, dh }).q;
        return u >= 0.95 * qS && u <= 1.05 * qS;
      };
      if (KISI_DH.filter(di).length < 3) return null;
      const dh0 = keLangkah(dhS * (r() < 0.5 ? 0.3 : 2), P_HEAD);
      return di(dh0) ? null : { tetap, dhS, qS, dh0 };
    },
    () => ({ tetap: { L: 20, d: 0.4, n: 0.42, t: 6 }, dhS: 6, qS: aliranLembar({ L: 20, d: 0.4, n: 0.42, t: 6, dh: 6 }).q, dh0: 2 })
  );
  const { tetap, dhS, qS, dh0 } = s;
  const r0 = aliranLembar({ ...tetap, dh: dh0 });
  return {
    jenis: "atur",
    id: "dm03-5",
    tanya: bi((f, l) =>
      l === "id"
        ? `Urugan d = ${f(tetap.d, 3)} m, n = ${f(tetap.n, 2)}, tebal t = ${f(tetap.t, 1)} m, lintasan L = ${f(tetap.L, 0)} m. Sekarang Δh = ${f(dh0, 2)} m. Atur Δh sampai debitnya q = ${f(qS, 3)} m³/s per m (±5 %), lalu periksa. Titik kerja di grafik dapat diseret.`
        : `Fill d = ${f(tetap.d, 3)} m, n = ${f(tetap.n, 2)}, thickness t = ${f(tetap.t, 1)} m, path L = ${f(tetap.L, 0)} m. Δh is now ${f(dh0, 2)} m. Set Δh until the discharge is q = ${f(qS, 3)} m³/s per m (±5 %), then check. The working point on the graph can be dragged.`
    ),
    ukur: (k) => aliranLembar(k).q,
    simbol: "q",
    digits: 3,
    target: { min: 0.95 * qS, max: 1.05 * qS },
    geser: { kunci: "dh", p: P_HEAD },
    siapkan: { ...tetap, dh: dh0 },
    tetap,
    bahas: bi((f, l) =>
      l === "id"
        ? `Δh sekitar ${f(dhS, 2)} m memberi q = ${f(qS, 3)} m³/s per m. Dari Δh = ${f(dh0, 2)} m (q = ${f(r0.q, 3)}) perubahan q tidak sebanding perubahan Δh: kemiringan log-lognya ${f(r0.exponent, 3)}. Lihat baris q di tabel hasil.`
        : `Δh near ${f(dhS, 2)} m gives q = ${f(qS, 3)} m³/s per m. From Δh = ${f(dh0, 2)} m (q = ${f(r0.q, 3)}) q does not change in proportion to Δh: the log-log slope is ${f(r0.exponent, 3)}. See the q row in the results.`
    ),
    langkah: langkahBi((f, l) => {
      const r = aliranLembar({ ...tetap, dh: dhS });
      const m = { ...tetap, dh: dhS };
      return [lI(m, r, f, l), lV(r, f, l), { judul: l === "id" ? "Debit tiap meter lebar" : "Discharge per metre width", rumus: "q = v · t", isi: `${sci(r.v, l)} · ${f(tetap.t, 1)}`, hasil: f(r.q, 3), satuan: "m³/s per m", tint: C.water }];
    }),
  };
}

export const DM03: BankKuis = {
  kode: "DM-03",
  jumlah: 5,
  buat: (benih) => [soal1(benih), soal2(benih), soal3(benih), soal4(benih), soal5(benih)],
};
