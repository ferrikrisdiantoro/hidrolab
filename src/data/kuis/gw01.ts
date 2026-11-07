/**
 * Bank soal GW-01 Rembesan (KUIS.md, termasuk revisi insinyur 1 November:
 * B4 lama tentang gradien keluar DIBUANG, karena gradien keluar di drainase
 * kaki singular dan exitGradient tidak dibuat; penggantinya k = √(kh·kv)
 * tetap dan kh/kv naik → q naik, kh/kv ≤ 9. B3 drainNeeded ≤ 29 m, valid,
 * Ld < md·Hd. B1 pengecoh tanpa koreksi 0,3·mu·H dan lupa konversi liter).
 *
 * Semua masukan jatuh di kisi penggeser lembar (ParamDef di bawah, dipakai
 * InputRow RembesanClient; k dalam µm/s), H < Hd, dan semua kunci dihitung
 * lewat seepageLine dengan panggilan yang sama dengan lembar (rembesanLembar).
 *
 * Soal contoh: belum ditelaah dosen pengampu (KUIS.md baris 4).
 */

import { CASAGRANDE_ENTRY, seepageLine, type SeepageResult } from "../../lib/hydraulics.ts";
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
  turunan,
  type BankKuis,
  type Bi,
  type Kesalahan,
  type Keadaan,
  type LangkahKuis,
  type Pilihan,
  type Soal,
} from "../../lib/kuis.ts";

/** Lebar mercu lembar, meter. */
export const CREST = 6;

/** Sama dengan InputRow lembar RembesanClient (k dalam µm/s). */
export const P_H: ParamDef = { min: 1, max: 20, step: 0.5, digits: 1 };
export const P_HD: ParamDef = { min: 4, max: 24, step: 0.5, digits: 1 };
export const P_MU: ParamDef = { min: 1.5, max: 5, step: 0.25, digits: 2 };
export const P_MD: ParamDef = { min: 1.5, max: 4, step: 0.25, digits: 2 };
/** Satu definisi untuk penggeser, kotak angka, dan pegangan seret drainase. */
export const P_LD: ParamDef = { min: 0, max: 30, step: 0.5, digits: 1 };
export const P_K: ParamDef = { min: 0.05, max: 20, step: 0.05, digits: 2 };
export const P_A: ParamDef = { min: 1, max: 25, step: 0.5, digits: 1 };

/** Panggilan seepageLine yang sama dengan lembar: kh = k√a, kv = k/√a. */
export function rembesanLembar(m: Keadaan): SeepageResult {
  const kEq = m.k * 1e-6;
  return seepageLine(Math.min(m.H, m.Hd), m.Hd, CREST, m.mu, m.md, m.Ld, kEq * Math.sqrt(m.a), kEq / Math.sqrt(m.a));
}

type F = (v: number, d: number) => string;
type L = "id" | "en";
const langkahBi = (t: (f: F, l: L) => LangkahKuis[]): Bi<LangkahKuis[]> => ({
  id: t((v, d) => fmtL(v, d, "id"), "id"),
  en: t((v, d) => fmtL(v, d, "en"), "en"),
});

/** Bendungan acak dengan H < Hd dan drainase di dalam lereng hilir. */
function acakBendungan(r: () => number): Keadaan | null {
  const Hd = acakKisi(r, P_HD, 6, 20);
  const H = acakKisi(r, P_H, 2, Hd - 1);
  const md = acakKisi(r, P_MD, 2, 3.5);
  const Ld = acakKisi(r, P_LD, 0, Math.min(P_LD.max, md * Hd - 1));
  const m = { H, Hd, mu: acakKisi(r, P_MU, 2, 4), md, Ld, k: acakKisi(r, P_K, 0.2, 5), a: 1 };
  return H < Hd && rembesanLembar(m).valid ? m : null;
}

const teksBendungan = (m: Keadaan, f: F, l: L, tanpaLd = false) =>
  l === "id"
    ? `Bendungan urugan homogen setinggi Hd = ${f(m.Hd, 1)} m (mercu ${f(CREST, 0)} m, lereng hulu mu = ${f(m.mu, 2)}, lereng hilir md = ${f(m.md, 2)}, mendatar per tegak) menahan air setinggi H = ${f(m.H, 1)} m${tanpaLd ? "" : `, drainase kaki Ld = ${f(m.Ld, 1)} m`}, k = ${f(m.k, 2)} µm/s${m.a === 1 ? " (kh = kv)" : `, kh/kv = ${f(m.a, 1)}`}.`
    : `A homogeneous embankment of height Hd = ${f(m.Hd, 1)} m (crest ${f(CREST, 0)} m, upstream slope mu = ${f(m.mu, 2)}, downstream slope md = ${f(m.md, 2)}, horizontal per vertical) holds water H = ${f(m.H, 1)} m deep${tanpaLd ? "" : `, toe drain Ld = ${f(m.Ld, 1)} m`}, k = ${f(m.k, 2)} µm/s${m.a === 1 ? " (kh = kv)" : `, kh/kv = ${f(m.a, 1)}`}.`;

/** Langkah hitungan sama dengan Hitungan lembar: d, y₀, q. */
function langkahQ(m: Keadaan, r: SeepageResult, f: F, l: L): LangkahKuis[] {
  const xm = m.mu * m.H * (1 - CASAGRANDE_ENTRY);
  return [
    {
      judul: l === "id" ? "Jarak titik masuk terkoreksi ke fokus" : "Corrected entry point to focus",
      rumus: "x_m = (1 − 0,3) · mu · H ; f = x_kaki − Ld ; d = (f − x_m) · √(kv/kh)".replace("0,3", l === "en" ? "0.3" : "0,3"),
      isi: `x_m = ${f(xm, 2)} ; f = ${f(r.geometry.toeDown, 1)} − ${f(m.Ld, 1)} = ${f(r.focus, 2)} ; d = ( ${f(r.focus, 2)} − ${f(xm, 2)} ) · ${f(r.squeeze, 4)}`,
      hasil: f(r.d, 2),
      satuan: "m",
    },
    {
      judul: l === "id" ? "Parameter parabola Kozeny" : "Kozeny parabola parameter",
      rumus: "y₀ = √( d² + H² ) − d",
      isi: `√( ${f(r.d, 2)}² + ${f(m.H, 1)}² ) − ${f(r.d, 2)}`,
      hasil: f(r.y0, 4),
      satuan: "m",
      tint: C.critical,
    },
    {
      judul: l === "id" ? "Rembesan tiap meter panjang" : "Seepage per metre length",
      rumus: "q = k · y₀ · 1000 · 86400",
      isi: `${f(m.k, 2)}·10⁻⁶ · ${f(r.y0, 4)} · 1000 · 86400`,
      hasil: f(r.qLitreDay, 1),
      satuan: l === "id" ? "l/hari per m" : "l/day per m",
      tint: C.water,
    },
  ];
}

/** Kesalahan umum B1: titik masuk tanpa koreksi Casagrande, di mu·H (l/hari per m). */
function tanpaKoreksi(m: Keadaan, r: SeepageResult): number {
  const dd = (r.focus - m.mu * m.H) * r.squeeze;
  return r.kEq * (Math.sqrt(dd * dd + m.H * m.H) - dd) * 1000 * 86400;
}

const satQ: Bi<string> = { id: "l/hari per m", en: "l/day per m" };

/* ------------------------------------------------------------------ *
 * B1 hitung: q dalam liter per hari per meter
 * ------------------------------------------------------------------ */

function soal1(benih: number): Soal {
  const m = cobaBenih<Keadaan>(
    benih,
    1,
    (r) => {
      const k = acakBendungan(r);
      if (!k) return null;
      const h = rembesanLembar(k);
      if (h.daylights || h.qLitreDay < 5 || h.qLitreDay > 999) return null;
      // Pengecoh tanpa koreksi harus terpisah jelas dari kunci (> 5 %).
      return Math.abs(tanpaKoreksi(k, h) / h.qLitreDay - 1) > 0.05 ? k : null;
    },
    () => ({ H: 8, Hd: 12, mu: 3, md: 2.5, Ld: 10, k: 1, a: 1 })
  );
  const r = rembesanLembar(m);
  const tol = 0.02 * r.qLitreDay;
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: r.qLitreDay },
    [
      {
        nilai: tanpaKoreksi(m, r),
        alasan: {
          id: "Titik masuk belum dikoreksi. Casagrande memundurkannya 0,3·mu·H ke hulu, jadi d dihitung dari (1 − 0,3)·mu·H.",
          en: "The entry point is uncorrected. Casagrande moves it 0.3·mu·H upstream, so d is measured from (1 − 0.3)·mu·H.",
        },
      },
      {
        nilai: r.q * 86400,
        alasan: {
          id: "Ini m³ per hari per meter. Kalikan 1000 lagi untuk liter.",
          en: "This is m³ per day per metre. Multiply by 1000 again for litres.",
        },
      },
      {
        nilai: r.q * 1000,
        alasan: {
          id: "Ini liter per detik. Kalikan 86400 untuk liter per hari.",
          en: "This is litres per second. Multiply by 86400 for litres per day.",
        },
      },
    ],
    { toleransi: tol, digits: 1 }
  );
  return {
    jenis: "hitung",
    id: "gw01-1",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksBendungan(m, f, l)} Dengan parabola Kozeny dan koreksi titik masuk Casagrande, hitung rembesan q tiap meter panjang bendungan dalam liter per hari.`
        : `${teksBendungan(m, f, l)} With the Kozeny parabola and Casagrande's entry correction, compute the seepage q per metre of dam length in litres per day.`
    ),
    kunci: r.qLitreDay,
    toleransi: tol,
    digits: 1,
    satuan: satQ,
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `d = ${f(r.d, 2)} m, y₀ = √(d² + H²) − d = ${f(r.y0, 4)} m, q = k·y₀ = ${f(r.qLitreDay, 1)} l/hari per m. Lihat ukuran y₀ di gambar dan baris q di tabel hasil.`
        : `d = ${f(r.d, 2)} m, y₀ = √(d² + H²) − d = ${f(r.y0, 4)} m, q = k·y₀ = ${f(r.qLitreDay, 1)} l/day per m. See the y₀ dimension in the drawing and the q row in the results.`
    ),
    langkah: langkahBi((f, l) => langkahQ(m, r, f, l)),
    masukan: m,
  };
}

/* ------------------------------------------------------------------ *
 * B2 pilih: drainase kaki diperpanjang → q naik
 * ------------------------------------------------------------------ */

/** Keadaan awal dan panjang drainase baru butir 2 (dipakai uji). */
export function gw01Kasus2(benih: number): { m: Keadaan; Ld2: number } {
  return cobaBenih(
    benih,
    2,
    (r) => {
      const m = acakBendungan(r);
      if (!m) return null;
      const r1 = rembesanLembar(m);
      if (r1.daylights) return null;
      const Ld2 = keLangkah(m.Ld + acakKisi(r, { min: 2, max: 8, step: 0.5 }), P_LD);
      const m2 = { ...m, Ld: Ld2 };
      const r2 = rembesanLembar(m2);
      if (Ld2 <= m.Ld || !r2.valid || r2.daylights) return null;
      return r2.q > r1.q * 1.01 ? { m, Ld2 } : null;
    },
    () => ({ m: { H: 8, Hd: 12, mu: 3, md: 2.5, Ld: 10, k: 1, a: 1 }, Ld2: 16 })
  );
}

function soal2(benih: number): Soal {
  const { m, Ld2 } = gw01Kasus2(benih);
  const m2 = { ...m, Ld: Ld2 };
  const r1 = rembesanLembar(m), r2 = rembesanLembar(m2);
  const naik = (r2.q / r1.q - 1) * 100;
  const pilihan: Pilihan[] = [
    { id: "naik", teks: { id: "q naik", en: "q rises" } },
    {
      id: "turun",
      teks: { id: "q turun, karena drainase menampung sebagian air", en: "q falls, because the drain takes up part of the water" },
      alasan: bi((f, l) =>
        l === "id"
          ? `Drainase memindahkan fokus parabola ke hulu: lintasan rembesan memendek, gradien naik, dan q naik ${f(naik, 1)} %.`
          : `The drain moves the parabola's focus upstream: the seepage path shortens, the gradient rises, and q rises ${f(naik, 1)} %.`
      ),
    },
    {
      id: "tetap",
      teks: { id: "q tetap, karena q hanya bergantung pada k dan H", en: "q stays, because q depends only on k and H" },
      alasan: bi((f, l) =>
        l === "id"
          ? `q = k·y₀ dan y₀ = √(d² + H²) − d bergantung pada d, jarak titik masuk ke fokus. d mengecil dari ${f(r1.d, 2)} ke ${f(r2.d, 2)} m.`
          : `q = k·y₀ and y₀ = √(d² + H²) − d depends on d, the distance from entry to focus. d shrinks from ${f(r1.d, 2)} to ${f(r2.d, 2)} m.`
      ),
    },
  ];
  return {
    jenis: "pilih",
    id: "gw01-2",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksBendungan(m, f, l)} Drainase kaki diperpanjang menjadi ${f(Ld2, 1)} m. Apa yang terjadi pada rembesan q?`
        : `${teksBendungan(m, f, l)} The toe drain is lengthened to ${f(Ld2, 1)} m. What happens to the seepage q?`
    ),
    pilihan,
    kunci: "naik",
    bahas: bi((f, l) =>
      l === "id"
        ? `q naik dari ${f(r1.qLitreDay, 1)} ke ${f(r2.qLitreDay, 1)} l/hari per m (${f(naik, 1)} %). Drainase tidak dibeli untuk mengurangi air, melainkan untuk menahan garis freatik di dalam badan dan memberi tempat keluar yang terkendali. Lembar sekarang memakai Ld = ${f(Ld2, 1)} m.`
        : `q rises from ${f(r1.qLitreDay, 1)} to ${f(r2.qLitreDay, 1)} l/day per m (${f(naik, 1)} %). A drain is not bought to reduce the water but to hold the phreatic line inside the body and give it a controlled exit. The sheet now uses Ld = ${f(Ld2, 1)} m.`
    ),
    langkah: langkahBi((f, l) => langkahQ(m2, r2, f, l)),
    masukan: m2,
  };
}

/* ------------------------------------------------------------------ *
 * B3 atur: Ld terpendek yang menahan garis freatik
 * ------------------------------------------------------------------ */

function soal3(benih: number): Soal {
  const s = cobaBenih<{ tetap: Keadaan; dn: number; Ld0: number }>(
    benih,
    3,
    (r) => {
      const m = acakBendungan(r);
      if (!m) return null;
      // Sebagian soal tanahnya berlapis, kh/kv ≤ 4.
      m.a = r() < 0.5 ? 1 : acakKisi(r, P_A, 1.5, 4);
      const tetap = { H: m.H, Hd: m.Hd, mu: m.mu, md: m.md, k: m.k, a: m.a };
      const dn = rembesanLembar({ ...tetap, Ld: 0 }).drainNeeded;
      if (!(dn >= 2 && dn <= 29 && dn + 1 < m.md * m.Hd && dn + 1 <= P_LD.max)) return null;
      // Seluruh kisi Ld di dalam sasaran sah dan tidak keluar lereng.
      const dalam = kisi(P_LD).filter((Ld) => Ld >= dn && Ld <= dn + 1);
      if (dalam.length < 2 || dalam.some((Ld) => { const h = rembesanLembar({ ...tetap, Ld }); return h.daylights || !h.valid; })) return null;
      const Ld0 = keLangkah(Math.max(0, dn - acakKisi(r, { min: 1.5, max: 8, step: 0.5 })), P_LD);
      if (Ld0 >= dn || !rembesanLembar({ ...tetap, Ld: Ld0 }).daylights) return null;
      return { tetap, dn, Ld0 };
    },
    () => {
      const tetap = { H: 8, Hd: 12, mu: 3, md: 2.5, k: 1, a: 1 };
      return { tetap, dn: rembesanLembar({ ...tetap, Ld: 0 }).drainNeeded, Ld0: 0 };
    }
  );
  const { tetap, dn, Ld0 } = s;
  const rn = rembesanLembar({ ...tetap, Ld: dn });
  return {
    jenis: "atur",
    id: "gw01-3",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksBendungan(tetap, f, l, true)} Dengan drainase kaki ${f(Ld0, 1)} m garis freatik keluar di lereng hilir. Atur Ld ke panjang terpendek yang menahannya di dalam badan (sampai 1 m lebih panjang masih diterima), lalu periksa.`
        : `${teksBendungan(tetap, f, l, true)} With a ${f(Ld0, 1)} m toe drain the phreatic line daylights on the downstream slope. Set Ld to the shortest length that holds it inside the body (up to 1 m longer is accepted), then check.`
    ),
    ukur: (k) => k.Ld,
    simbol: "Ld",
    digits: 1,
    target: { min: dn, max: dn + 1 },
    geser: { kunci: "Ld", p: P_LD },
    siapkan: { ...tetap, Ld: Ld0 },
    tetap,
    // Pita selebar 1 m pada langkah 0,5 m memuat dua atau tiga nilai penggeser.
    langkahMin: 2,
    bahas: bi((f, l) =>
      l === "id"
        ? `Panjang terpendek ${f(dn, 2)} m (baris Ld,min di tabel hasil). Di bawahnya parabola Kozeny memotong lereng hilir dan pita Ld/Ld,min masuk ke merah; di atasnya garis freatik bertemu drainase di dalam badan, q = ${f(rn.qLitreDay, 1)} l/hari per m. Pegangan di ujung hulu drainase di gambar dapat diseret.`
        : `The shortest length is ${f(dn, 2)} m (Ld,min row in the results). Below it the Kozeny parabola cuts the downstream slope and the Ld/Ld,min scale turns red; above it the phreatic line meets the drain inside the body, q = ${f(rn.qLitreDay, 1)} l/day per m. The handle at the upstream end of the drain in the drawing can be dragged.`
    ),
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "Uji keluar lereng sepanjang lereng hilir, dibagi dua" : "Daylight test along the downstream slope, by bisection",
        rumus: l === "id" ? "Ld terpendek dengan freatik di dalam badan" : "Shortest Ld with the line inside the body",
        isi: `0 ≤ Ld ≤ ${f(tetap.md * tetap.Hd, 1)} m`,
        hasil: f(dn, 2),
        satuan: "m",
        tint: C.critical,
      },
    ]),
  };
}

/* ------------------------------------------------------------------ *
 * B4 pilih: k = √(kh·kv) tetap, kh/kv naik → q naik
 * ------------------------------------------------------------------ */

function soal4(benih: number): Soal {
  const s = cobaBenih<{ m: Keadaan; a2: number }>(
    benih,
    4,
    (r) => {
      const m = acakBendungan(r);
      if (!m) return null;
      const a2 = prng(turunan(benih, 4, 100))() < 0.5 ? 4 : acakKisi(r, P_A, 2, 9);
      const r1 = rembesanLembar(m), r2 = rembesanLembar({ ...m, a: a2 });
      if (r1.daylights || r2.daylights || !r2.valid) return null;
      return r2.q > 1.05 * r1.q ? { m, a2 } : null;
    },
    () => ({ m: { H: 8, Hd: 12, mu: 3, md: 2.5, Ld: 17, k: 1, a: 1 }, a2: 9 })
  );
  const { m, a2 } = s;
  const m2 = { ...m, a: a2 };
  const r1 = rembesanLembar(m), r2 = rembesanLembar(m2);
  const rasio = r2.q / r1.q;
  const pilihan: Pilihan[] = [
    { id: "naik", teks: { id: "q naik, tetapi kurang dari kh/kv kali (paling banyak √(kh/kv) kali)", en: "q rises, but by less than kh/kv times (at most √(kh/kv) times)" } },
    {
      id: "tetap",
      teks: { id: "q tetap, karena k = √(kh·kv) tidak berubah", en: "q stays, because k = √(kh·kv) does not change" },
      alasan: bi((f, l) =>
        l === "id"
          ? `k memang tetap, tetapi absis penampang terubah dikalikan √(kv/kh) = ${f(r2.squeeze, 3)}: d mengecil, y₀ membesar, q ×${f(rasio, 2)}.`
          : `k does stay, but the abscissae of the transformed section are multiplied by √(kv/kh) = ${f(r2.squeeze, 3)}: d shrinks, y₀ grows, q ×${f(rasio, 2)}.`
      ),
    },
    {
      id: "turun",
      teks: { id: "q turun, karena kv lebih kecil sehingga air sulit turun ke drainase", en: "q falls, because the smaller kv makes it harder for water to reach the drain" },
      alasan: bi((f, l) =>
        l === "id"
          ? `Lapisan mendatar yang lebih lolos memendekkan lintasan terubahnya dan menaikkan gradien. q naik ×${f(rasio, 2)}.`
          : `The more permeable horizontal layering shortens the transformed path and raises the gradient. q rises ×${f(rasio, 2)}.`
      ),
    },
    {
      id: "sebanding",
      teks: { id: "q naik tepat kh/kv kali", en: "q rises exactly kh/kv times" },
      alasan: bi((f, l) =>
        l === "id"
          ? `Kenaikannya lewat panjang penampang terubah, bukan lewat k. Di sini kh/kv = ${f(a2, 1)} tetapi q hanya ×${f(rasio, 2)}.`
          : `The rise comes through the length of the transformed section, not through k. Here kh/kv = ${f(a2, 1)} but q only ×${f(rasio, 2)}.`
      ),
    },
  ];
  return {
    jenis: "pilih",
    id: "gw01-4",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksBendungan(m, f, l)} Tanahnya ternyata berlapis: permeabilitas mendatar lebih besar dari tegak. Rata-rata ukur k = √(kh·kv) dibiarkan ${f(m.k, 2)} µm/s, kh/kv naik dari 1 menjadi ${f(a2, 1)}. Apa yang terjadi pada rembesan q?`
        : `${teksBendungan(m, f, l)} The soil turns out to be layered: horizontal permeability exceeds vertical. The geometric mean k = √(kh·kv) is kept at ${f(m.k, 2)} µm/s, while kh/kv rises from 1 to ${f(a2, 1)}. What happens to the seepage q?`
    ),
    pilihan,
    kunci: "naik",
    bahas: bi((f, l) =>
      l === "id"
        ? `Penampang terubah mengalikan absis dengan √(kv/kh) = ${f(r2.squeeze, 3)}: d ${f(r1.d, 2)} → ${f(r2.d, 2)} m, q ${f(r1.qLitreDay, 1)} → ${f(r2.qLitreDay, 1)} l/hari per m (×${f(rasio, 2)}). Lihat kartu kondisi: butir perbandingan permeabilitas menyebut kenaikannya terhadap tanah seragam.`
        : `The transformed section multiplies abscissae by √(kv/kh) = ${f(r2.squeeze, 3)}: d ${f(r1.d, 2)} → ${f(r2.d, 2)} m, q ${f(r1.qLitreDay, 1)} → ${f(r2.qLitreDay, 1)} l/day per m (×${f(rasio, 2)}). See the state card: the permeability ratio item states the rise against uniform soil.`
    ),
    langkah: langkahBi((f, l) => langkahQ(m2, r2, f, l)),
    masukan: m2,
  };
}

export const GW01: BankKuis = {
  kode: "GW-01",
  jumlah: 4,
  buat: (benih) => [soal1(benih), soal2(benih), soal3(benih), soal4(benih)],
};
