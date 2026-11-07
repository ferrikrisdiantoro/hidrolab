/**
 * Bank soal OC-05 Transisi lebar, Δz = 0 (KUIS.md, termasuk revisi insinyur
 * 1 November: B5 debit dipasok tetap dari hulu, cabang subkritis saja,
 * "debit berkurang" pengecoh dengan umpan balik kapan ia benar).
 *
 * Semua masukan jatuh di kisi penggeser lembar (ParamDef di bawah, dipakai
 * InputRow TransitionSheet), dan semua kunci dihitung SESUDAH pembulatan
 * lewat fungsi lib yang sama dengan lembar (transition, depthFromEnergy,
 * criticalDepth, froude).
 *
 * Soal contoh: belum ditelaah dosen pengampu (KUIS.md baris 4).
 */

import { G, criticalDepth, depthFromEnergy, froude, transition } from "../../lib/hydraulics.ts";
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

/** Sama dengan InputRow TransitionSheet (OC-04, OC-05, OC-07). */
export const P_Q: ParamDef = { min: 0.5, max: 80, step: 0.5, digits: 1 };
export const P_B1: ParamDef = { min: 1, max: 20, step: 0.1, digits: 1 };
export const P_Y1: ParamDef = { min: 0.1, max: 5, step: 0.01, digits: 2 };
export const P_B2: ParamDef = { min: 0.5, max: 20, step: 0.1, digits: 1 };

type Aliran = { Q: number; b1: number; y1: number; Fr: number };
type Masuk = { Q: number; b1: number; y1: number; b2: number };
type F = (v: number, d: number) => string;

const tr = (m: Masuk) => transition({ Q: m.Q, b1: m.b1, y1: m.y1, b2: m.b2, dz: 0 });

/**
 * Q 2–40 dan b₁ 2–10 di kisi, lalu y₁ dari Fr₁ sasaran di [frLo, frHi],
 * dibulatkan ke 0,01 m, lalu Fr₁ dihitung ulang. null bila keluar pita.
 */
function aliran(r: () => number, frLo: number, frHi: number): Aliran | null {
  const Q = acakKisi(r, P_Q, 2, 40);
  const b1 = acakKisi(r, P_B1, 2, 10);
  const q1 = Q / b1;
  const Fr0 = seragam(r, frLo, frHi);
  const y = Math.pow(q1 / (Fr0 * Math.sqrt(G)), 2 / 3);
  if (y < P_Y1.min || y > P_Y1.max) return null;
  const y1 = bulatKeLangkah(y, P_Y1);
  const Fr = froude(q1 / y1, y1);
  if (Fr < frLo || Fr > frHi) return null;
  return { Q, b1, y1, Fr };
}

const masuk = (m: Masuk) => ({ Q: m.Q, b1: m.b1, y1: m.y1, b2: m.b2 });

const teksHulu = (m: Masuk, Fr: number, f: F, l: "id" | "en") =>
  l === "id"
    ? `Saluran persegi Q = ${f(m.Q, 1)} m³/s, b₁ = ${f(m.b1, 1)} m, y₁ = ${f(m.y1, 2)} m (Fr₁ = ${f(Fr, 2)}).`
    : `Rectangular channel Q = ${f(m.Q, 1)} m³/s, b₁ = ${f(m.b1, 1)} m, y₁ = ${f(m.y1, 2)} m (Fr₁ = ${f(Fr, 2)}).`;

const langkahBi = (t: (f: F, l: "id" | "en") => LangkahKuis[]): Bi<LangkahKuis[]> => ({
  id: t((v, d) => fmtL(v, d, "id"), "id"),
  en: t((v, d) => fmtL(v, d, "en"), "en"),
});

const langkahE1 = (m: Masuk, r: ReturnType<typeof tr>, f: F, l: "id" | "en"): LangkahKuis => ({
  judul: l === "id" ? "Energi spesifik hulu" : "Upstream specific energy",
  rumus: "E₁ = y₁ + q₁² / ( 2 · g · y₁² ),  q₁ = Q / b₁",
  isi: `${f(m.y1, 2)} + ${f(r.q1, 4)}² / ( 2 · ${f(G, 2)} · ${f(m.y1, 2)}² )`,
  hasil: f(r.E1, 4),
  satuan: "m",
  tint: C.energy,
});

/* ------------------------------------------------------------------ *
 * B1 atur: b₂ serapat mungkin tanpa tersendat
 * ------------------------------------------------------------------ */

function soal1(benih: number): Soal {
  type Siap = Masuk & { bmin: number; bmax: number; Fr: number };
  const siap = (a: Aliran | null): Siap | null => {
    if (!a) return null;
    // Kunci ditelusuri di kisi penggeser lewat transition(), bukan rumus b₂min yang dibulatkan.
    const bmin = kisi(P_B2).find((v) => !tr({ ...a, b2: v }).choked);
    if (bmin === undefined || bmin < 0.6) return null;
    const bmax = bulatKeLangkah(bmin + 0.2, P_B2);
    if (a.b1 < bmax + 0.3) return null;
    return { Q: a.Q, b1: a.b1, y1: a.y1, b2: a.b1, bmin, bmax, Fr: a.Fr };
  };
  const s = cobaBenih(
    benih,
    1,
    (r) => siap(aliran(r, 0.2, 0.59)),
    () => siap({ Q: 12, b1: 5, y1: 1.5, Fr: froude(2.4 / 1.5, 1.5) })!
  );
  const r0 = tr(s);
  return {
    jenis: "atur",
    id: "oc05-1",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksHulu(s, s.Fr, f, l)} Q, b₁, dan y₁ dibiarkan tetap. Sempitkan lebar hilir b₂ serapat mungkin tanpa membuat aliran tersendat, lalu periksa.`
        : `${teksHulu(s, s.Fr, f, l)} Q, b₁ and y₁ stay fixed. Narrow the downstream width b₂ as far as possible without choking the flow, then check.`
    ),
    ukur: (k) => k.b2,
    simbol: "b₂",
    digits: 1,
    target: { min: s.bmin, max: s.bmax },
    geser: { kunci: "b2", p: P_B2 },
    siapkan: masuk(s),
    tetap: { Q: s.Q, b1: s.b1, y1: s.y1 },
    bahas: bi((f, l) =>
      l === "id"
        ? `Lebar tersempit b₂min = Q / √( g · (E₁/1,5)³ ) = ${f(r0.b2Min, 2)} m; langkah penggeser tersempit yang masih lolos ${f(s.bmin, 1)} m. Di bawahnya energi yang tersedia kurang dari Emin dan aliran tersendat. Pita cadangan energi di atas lembar menunjukkan seberapa dekat ke batas itu.`
        : `The narrowest width b₂min = Q / √( g · (E₁/1.5)³ ) = ${f(r0.b2Min, 2)} m; the narrowest slider step that still passes is ${f(s.bmin, 1)} m. Below it the available energy is less than Emin and the flow chokes. The energy margin scale above the sheet shows how close you are to that limit.`
    ),
    langkah: langkahBi((f, l) => [
      langkahE1(s, r0, f, l),
      {
        judul: l === "id" ? "Lebar tersempit" : "Narrowest width",
        rumus: `b₂min = Q / √( g · ( E₁ / ${f(1.5, 1)} )³ )`,
        isi: `${f(s.Q, 1)} / √( ${f(G, 2)} · ( ${f(r0.E1, 4)} / ${f(1.5, 1)} )³ )`,
        hasil: f(r0.b2Min, 2),
        satuan: "m",
        tint: C.critical,
      },
    ]),
  };
}

/* ------------------------------------------------------------------ *
 * B2 hitung: b₂min
 * ------------------------------------------------------------------ */

function soal2(benih: number): Soal {
  type Siap = Masuk & { Fr: number };
  const siap = (a: Aliran | null): Siap | null => {
    if (!a) return null;
    const bmin = tr({ ...a, b2: a.b1 }).b2Min;
    if (!(bmin >= 0.6 && a.b1 - bmin >= 0.4)) return null;
    return { Q: a.Q, b1: a.b1, y1: a.y1, b2: bulatKeLangkah((a.b1 + bmin) / 2, P_B2), Fr: a.Fr };
  };
  // Fr₁ ≥ 0,3: di bawahnya "y₁ dipakai sebagai E₁" terlalu dekat dengan kunci.
  const s = cobaBenih(benih, 2, (r) => siap(aliran(r, 0.3, 0.8)), () => siap({ Q: 12, b1: 5, y1: 1.5, Fr: froude(2.4 / 1.5, 1.5) })!);
  const r0 = tr(s);
  const kunci = r0.b2Min;
  const tol = Math.max(0.02 * kunci, 0.01);
  const b = (E: number) => s.Q / Math.sqrt(G * E * E * E);
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: kunci },
    [
      {
        nilai: b(s.y1 / 1.5),
        alasan: {
          id: "y₁ dipakai sebagai pengganti E₁. Energi yang tersedia adalah E₁ = y₁ + V₁²/(2g), termasuk tinggi kecepatannya.",
          en: "y₁ was used in place of E₁. The available energy is E₁ = y₁ + V₁²/(2g), velocity head included.",
        },
      },
      {
        nilai: b(s.y1),
        alasan: {
          id: "Kedalaman kritis hilir disamakan dengan y₁. Di lebar tersempit yc₂ = E₁/1,5 = 2E₁/3, bukan y₁.",
          en: "The downstream critical depth was set equal to y₁. At the narrowest width yc₂ = E₁/1.5 = 2E₁/3, not y₁.",
        },
      },
      {
        nilai: b(1.5 * r0.E1),
        alasan: {
          id: "1,5 terbalik: Emin = 1,5·yc, jadi yc₂ = E₁/1,5, bukan 1,5·E₁.",
          en: "The 1.5 is inverted: Emin = 1.5·yc, so yc₂ = E₁/1.5, not 1.5·E₁.",
        },
      },
    ],
    { toleransi: tol, digits: 2 }
  );
  return {
    jenis: "hitung",
    id: "oc05-2",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksHulu(s, s.Fr, f, l)} Tanpa perubahan dasar, berapa lebar hilir tersempit b₂min yang masih dapat dilewati tanpa tersendat?`
        : `${teksHulu(s, s.Fr, f, l)} With no change in bed level, what is the narrowest downstream width b₂min that still passes the flow without choking?`
    ),
    kunci,
    toleransi: tol,
    digits: 2,
    satuan: { id: "m", en: "m" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `Di lebar tersempit aliran tepat kritis: E₁ = 1,5·yc₂, jadi yc₂ = E₁/1,5 = ${f(r0.E1 / 1.5, 3)} m dan b₂min = Q/√(g·yc₂³) = ${f(kunci, 2)} m. Lihat baris Lebar tersempit di tabel hasil.`
        : `At the narrowest width the flow is exactly critical: E₁ = 1.5·yc₂, so yc₂ = E₁/1.5 = ${f(r0.E1 / 1.5, 3)} m and b₂min = Q/√(g·yc₂³) = ${f(kunci, 2)} m. See the Narrowest width row in the results.`
    ),
    langkah: langkahBi((f, l) => [
      langkahE1(s, r0, f, l),
      {
        judul: l === "id" ? "Lebar tersempit" : "Narrowest width",
        rumus: `b₂min = Q / √( g · ( E₁ / ${f(1.5, 1)} )³ )`,
        isi: `${f(s.Q, 1)} / √( ${f(G, 2)} · ( ${f(r0.E1, 4)} / ${f(1.5, 1)} )³ )`,
        hasil: f(kunci, 2),
        satuan: "m",
        tint: C.critical,
      },
    ]),
    masukan: masuk(s),
  };
}

/* ------------------------------------------------------------------ *
 * B3 dan B4: penyempitan atau pelebaran tanpa tersendat
 * ------------------------------------------------------------------ */

type Kasus = Masuk & { Fr: number; r: ReturnType<typeof tr> };

function kasusLebar(r: () => number, sub: boolean): Kasus | null {
  const a = sub ? aliran(r, 0.2, 0.7) : aliran(r, 1.5, 3);
  if (!a) return null;
  const sempit = r() < 0.7;
  const fak = sempit ? seragam(r, 0.6, 0.9) : seragam(r, 1.15, 1.6);
  const b2 = bulatKeLangkah(a.b1 * fak, P_B2);
  if (b2 === a.b1 || b2 < P_B2.min || b2 > P_B2.max) return null;
  const m = { Q: a.Q, b1: a.b1, y1: a.y1, b2 };
  const hasil = tr(m);
  if (hasil.choked || !(hasil.chokeRatio < 0.9)) return null;
  if (Math.abs(hasil.y2 - a.y1) < Math.max(0.01, 0.01 * a.y1)) return null;
  return { ...m, Fr: a.Fr, r: hasil };
}

const cadanganLebar = (sub: boolean): Kasus => {
  const m = sub ? { Q: 12, b1: 5, y1: 1.5, b2: 4.2 } : { Q: 12, b1: 5, y1: 0.45, b2: 4.5 };
  return { ...m, Fr: froude(m.Q / m.b1 / m.y1, m.y1), r: tr(m) };
};

function penjelasan(k: Kasus, f: F, l: "id" | "en"): string {
  const sub = k.r.branch === "subkritis";
  const qNaik = k.r.q2 > k.r.q1;
  const naik = k.r.y2 > k.y1;
  if (l === "id")
    return `Lebar ${k.b2 < k.b1 ? "menyempit" : "melebar"}, jadi debit satuan ${qNaik ? "naik" : "turun"} dari q₁ = ${f(k.r.q1, 3)} ke q₂ = ${f(k.r.q2, 3)} m²/s dengan energi E tetap ${f(k.r.E1, 3)} m. Pada cabang ${sub ? "atas (subkritis)" : "bawah (superkritis)"} kurva energi, q yang ${qNaik ? "naik" : "turun"} membuat kedalaman ${sub !== qNaik ? "naik" : "turun"}: y₂ = ${f(k.r.y2, 3)} m, ${naik ? "lebih tinggi" : "lebih rendah"} dari y₁ = ${f(k.y1, 2)} m.`;
  return `The width ${k.b2 < k.b1 ? "narrows" : "widens"}, so the unit discharge ${qNaik ? "rises" : "falls"} from q₁ = ${f(k.r.q1, 3)} to q₂ = ${f(k.r.q2, 3)} m²/s at a constant energy E = ${f(k.r.E1, 3)} m. On the ${sub ? "upper (subcritical)" : "lower (supercritical)"} branch of the energy curve, a ${qNaik ? "rising" : "falling"} q makes the depth ${sub !== qNaik ? "rise" : "fall"}: y₂ = ${f(k.r.y2, 3)} m, ${naik ? "higher" : "lower"} than y₁ = ${f(k.y1, 2)} m.`;
}

const teksUbah = (k: Kasus, f: F, l: "id" | "en") =>
  l === "id"
    ? `Lebar ${k.b2 < k.b1 ? "menyempit" : "melebar"} menjadi b₂ = ${f(k.b2, 1)} m tanpa perubahan dasar.`
    : `The width ${k.b2 < k.b1 ? "narrows" : "widens"} to b₂ = ${f(k.b2, 1)} m with no change in bed level.`;

function soal3(benih: number): Soal {
  const sub = prng(turunan(benih, 3, 100))() < 0.5;
  const k = cobaBenih(benih, 3, (r) => kasusLebar(r, sub), () => cadanganLebar(sub));
  const kunci = k.r.y2 > k.y1 ? "naik" : "turun";
  const jelas = bi((f, l) => penjelasan(k, f, l));
  const pilihan: Pilihan[] = [
    { id: "naik", teks: { id: "Naik", en: "Rises" }, alasan: jelas },
    { id: "turun", teks: { id: "Turun", en: "Falls" }, alasan: jelas },
    {
      id: "tetap",
      teks: { id: "Tetap", en: "Stays the same" },
      alasan: bi((f, l) =>
        l === "id"
          ? `Debit satuan berubah dari q₁ = ${f(k.r.q1, 3)} ke q₂ = ${f(k.r.q2, 3)} m²/s, jadi dengan E tetap kedalamannya harus ikut berubah. ${penjelasan(k, f, l)}`
          : `The unit discharge changes from q₁ = ${f(k.r.q1, 3)} to q₂ = ${f(k.r.q2, 3)} m²/s, so at constant E the depth must change too. ${penjelasan(k, f, l)}`
      ),
    },
  ];
  return {
    jenis: "pilih",
    id: "oc05-3",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksHulu(k, k.Fr, f, l)} ${teksUbah(k, f, l)} Muka air di penampang hilir dibandingkan y₁: naik, turun, atau tetap?`
        : `${teksHulu(k, k.Fr, f, l)} ${teksUbah(k, f, l)} Compared with y₁, does the water surface at the downstream section rise, fall or stay the same?`
    ),
    pilihan,
    kunci,
    bahas: bi((f, l) =>
      l === "id"
        ? `${penjelasan(k, f, l)} Lihat titik operasi pada kurva energi di gambar dan baris Kedalaman hilir di tabel hasil.`
        : `${penjelasan(k, f, l)} See the operating point on the energy curve in the drawing and the Downstream depth row in the results.`
    ),
    masukan: masuk(k),
  };
}

function soal4(benih: number): Soal {
  const sub = prng(turunan(benih, 4, 100))() < 0.5;
  const k = cobaBenih(benih, 4, (r) => kasusLebar(r, sub), () => cadanganLebar(sub));
  const kunci = k.r.y2;
  const tol = Math.max(0.01 * kunci, 0.001);
  const lain = k.r.branch === "subkritis" ? "superkritis" : "subkritis";
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: kunci },
    [
      {
        nilai: depthFromEnergy(k.r.E2, k.r.q2, lain),
        alasan: {
          id: `Ini akar persamaan energi di cabang ${lain}. Aliran tidak dapat berpindah cabang tanpa melewati kondisi kritis, jadi y₂ berada di cabang yang sama dengan y₁ (${k.r.branch}).`,
          en: `This is the root of the energy equation on the ${lain === "subkritis" ? "subcritical" : "supercritical"} branch. Flow cannot change branch without passing through critical, so y₂ lies on the same branch as y₁ (${k.r.branch === "subkritis" ? "subcritical" : "supercritical"}).`,
        },
      },
      {
        nilai: (k.y1 * k.b1) / k.b2,
        alasan: {
          id: "Ini y₁·b₁/b₂, yang menganggap kecepatan tetap. Yang tetap di transisi tanpa gesekan adalah energi spesifik E; kecepatan berubah bersama kedalaman.",
          en: "This is y₁·b₁/b₂, which assumes the velocity stays the same. What stays constant in a frictionless transition is the specific energy E; the velocity changes along with the depth.",
        },
      },
      {
        nilai: criticalDepth(k.r.q2),
        alasan: {
          id: "Ini kedalaman kritis hilir yc₂. Aliran hanya kritis di penampang hilir bila transisinya tepat di ambang tersendat.",
          en: "This is the downstream critical depth yc₂. The flow is only critical at the downstream section when the transition is exactly at the choking limit.",
        },
      },
    ],
    { toleransi: tol, digits: 3 }
  );
  return {
    jenis: "hitung",
    id: "oc05-4",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksHulu(k, k.Fr, f, l)} ${teksUbah(k, f, l)} Hitung kedalaman di penampang hilir y₂ (gesekan diabaikan).`
        : `${teksHulu(k, k.Fr, f, l)} ${teksUbah(k, f, l)} Compute the depth at the downstream section y₂ (friction neglected).`
    ),
    kunci,
    toleransi: tol,
    digits: 3,
    satuan: { id: "m", en: "m" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `E₂ = E₁ = ${f(k.r.E1, 4)} m dan q₂ = ${f(k.r.q2, 4)} m²/s. Persamaan E₂ = y₂ + q₂²/(2g·y₂²) punya dua akar; yang berlaku di cabang ${k.r.branch}, y₂ = ${f(kunci, 3)} m. Lihat baris Kedalaman hilir di tabel hasil.`
        : `E₂ = E₁ = ${f(k.r.E1, 4)} m and q₂ = ${f(k.r.q2, 4)} m²/s. The equation E₂ = y₂ + q₂²/(2g·y₂²) has two roots; the one that applies is on the ${k.r.branch === "subkritis" ? "subcritical" : "supercritical"} branch, y₂ = ${f(kunci, 3)} m. See the Downstream depth row in the results.`
    ),
    langkah: langkahBi((f, l) => [
      langkahE1(k, k.r, f, l),
      {
        judul:
          l === "id"
            ? `Kedalaman hilir pada cabang ${k.r.branch} (bagi dua)`
            : `Downstream depth on the ${k.r.branch === "subkritis" ? "subcritical" : "supercritical"} branch (bisection)`,
        rumus: "E₂ = y₂ + q₂² / ( 2 · g · y₂² ),  q₂ = Q / b₂",
        isi: `${f(k.r.E2, 4)} = y₂ + ${f(k.r.q2, 4)}² / ( 2 · ${f(G, 2)} · y₂² )`,
        hasil: f(kunci, 3),
        satuan: "m",
        tint: C.water,
      },
    ]),
    masukan: masuk(k),
  };
}

/* ------------------------------------------------------------------ *
 * B5 pilih: b₂ < b₂min, debit dipasok tetap dari hulu
 * ------------------------------------------------------------------ */

function soal5(benih: number): Soal {
  type Siap = Masuk & { Fr: number };
  const siap = (a: Aliran | null, r: () => number): Siap | null => {
    if (!a) return null;
    const bmin = tr({ ...a, b2: a.b1 }).b2Min;
    const hi = 0.9 * bmin;
    const lo = Math.max(P_B2.min, 0.5 * bmin);
    if (hi < lo) return null;
    const b2 = acakKisi(r, P_B2, lo, hi);
    if (b2 > hi || !tr({ ...a, b2 }).choked) return null;
    return { Q: a.Q, b1: a.b1, y1: a.y1, b2, Fr: a.Fr };
  };
  const s = cobaBenih(
    benih,
    5,
    (r) => siap(aliran(r, 0.2, 0.7), r),
    () => ({ Q: 12, b1: 5, y1: 1.5, b2: 2.8, Fr: froude(2.4 / 1.5, 1.5) })
  );
  const r0 = tr(s);
  // Kedalaman hulu baru: E₁ naik sampai Emin di penyempitan, pada cabang subkritis.
  const y1Baru = depthFromEnergy(r0.Emin2, r0.q1, "subkritis");
  // Debit yang lolos bila hulunya waduk bermuka air tetap (E₁ tetap).
  const Qwaduk = s.b2 * Math.sqrt(G * Math.pow(r0.E1 / 1.5, 3));
  const pilihan: Pilihan[] = kocok(prng(turunan(benih, 5, 99)), [
    {
      id: "hulu-naik",
      teks: {
        id: "Kedalaman hulu naik sampai energinya cukup untuk aliran kritis di penyempitan",
        en: "The upstream depth rises until there is enough energy for critical flow in the contraction",
      },
    },
    {
      id: "debit-berkurang",
      teks: {
        id: "Debit yang lewat berkurang, kedalaman hulu tetap",
        en: "Less discharge gets through, and the upstream depth stays the same",
      },
      alasan: bi((f, l) =>
        l === "id"
          ? `Itu yang terjadi bila hulunya waduk dengan muka air tetap: energi hulu tidak dapat naik, jadi debit yang lolos turun sampai sekitar ${f(Qwaduk, 1)} m³/s. Di soal ini debit dipasok tetap dari hulu, jadi yang menyesuaikan adalah kedalaman hulu.`
          : `That is what happens when upstream is a reservoir with a fixed water level: the upstream energy cannot rise, so the discharge that gets through drops to about ${f(Qwaduk, 1)} m³/s. Here the discharge is supplied at a constant rate from upstream, so it is the upstream depth that adjusts.`
      ),
    },
    {
      id: "hilir-superkritis",
      teks: {
        id: "Kedalaman hulu tetap, dan aliran di penyempitan menjadi superkritis",
        en: "The upstream depth stays the same, and the flow in the contraction turns supercritical",
      },
      alasan: bi((f, l) =>
        l === "id"
          ? `Pada y₁ ini E₂ = ${f(r0.E2, 3)} m < Emin = ${f(r0.Emin2, 3)} m: tidak ada kedalaman, subkritis maupun superkritis, yang dapat melewatkan q₂ dengan energi sebesar itu. Keadaan hulunya harus berubah.`
          : `At this y₁, E₂ = ${f(r0.E2, 3)} m < Emin = ${f(r0.Emin2, 3)} m: no depth, subcritical or supercritical, can pass q₂ with that little energy. The upstream state has to change.`
      ),
    },
    {
      id: "hulu-turun",
      teks: {
        id: "Kedalaman hulu turun karena aliran dipercepat menuju penyempitan",
        en: "The upstream depth falls because the flow accelerates into the contraction",
      },
      alasan: bi((f, l) =>
        l === "id"
          ? `Melewatkan q₂ yang lebih besar menuntut energi lebih, bukan kurang: E₁ harus naik ke 1,5·yc₂ = ${f(r0.Emin2, 3)} m, dan pada cabang subkritis E naik bersama y.`
          : `Passing the larger q₂ needs more energy, not less: E₁ must rise to 1.5·yc₂ = ${f(r0.Emin2, 3)} m, and on the subcritical branch E rises with y.`
      ),
    },
  ]);
  return {
    jenis: "pilih",
    id: "oc05-5",
    tanya: bi((f, l) =>
      l === "id"
        ? `Debit dipasok tetap dari hulu, Q = ${f(s.Q, 1)} m³/s, di saluran b₁ = ${f(s.b1, 1)} m dengan y₁ = ${f(s.y1, 2)} m (subkritis, Fr₁ = ${f(s.Fr, 2)}). Lebar hilir dipersempit menjadi b₂ = ${f(s.b2, 1)} m, di bawah lebar tersempit b₂min = ${f(r0.b2Min, 2)} m. Apa yang terjadi?`
        : `Discharge is supplied at a constant rate from upstream, Q = ${f(s.Q, 1)} m³/s, in a channel b₁ = ${f(s.b1, 1)} m with y₁ = ${f(s.y1, 2)} m (subcritical, Fr₁ = ${f(s.Fr, 2)}). The downstream width is narrowed to b₂ = ${f(s.b2, 1)} m, below the narrowest passable width b₂min = ${f(r0.b2Min, 2)} m. What happens?`
    ),
    pilihan,
    kunci: "hulu-naik",
    bahas: bi((f, l) =>
      l === "id"
        ? `E₂ = E₁ = ${f(r0.E1, 3)} m < Emin = 1,5·yc₂ = ${f(r0.Emin2, 3)} m: tersendat. Dengan debit tetap, air membendung di hulu sampai E₁ = Emin, dan di penyempitan aliran tepat kritis. Kedalaman hulu naik dari ${f(s.y1, 2)} m ke sekitar ${f(y1Baru, 2)} m. Kartu keadaan lembar menyebut muka air hulu akan naik.`
        : `E₂ = E₁ = ${f(r0.E1, 3)} m < Emin = 1.5·yc₂ = ${f(r0.Emin2, 3)} m: choked. With the discharge held constant, water backs up upstream until E₁ = Emin, and the flow in the contraction is exactly critical. The upstream depth rises from ${f(s.y1, 2)} m to about ${f(y1Baru, 2)} m. The state card says the upstream water level will rise.`
    ),
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "Energi minimum di penyempitan" : "Minimum energy in the contraction",
        rumus: `yc₂ = ∛( q₂² / g ),  Emin = ${f(1.5, 1)} · yc₂`,
        isi: `∛( ${f(r0.q2, 4)}² / ${f(G, 2)} ) = ${f(r0.yc2, 4)} m;  ${f(1.5, 1)} · ${f(r0.yc2, 4)}`,
        hasil: f(r0.Emin2, 3),
        satuan: "m",
        tint: C.critical,
      },
      {
        judul: l === "id" ? "Kedalaman hulu baru, cabang subkritis" : "New upstream depth, subcritical branch",
        rumus: "Emin = y₁′ + q₁² / ( 2 · g · y₁′² )",
        isi: `${f(r0.Emin2, 4)} = y₁′ + ${f(r0.q1, 4)}² / ( 2 · ${f(G, 2)} · y₁′² )`,
        hasil: f(y1Baru, 2),
        satuan: "m",
        tint: C.water,
      },
    ]),
    masukan: masuk(s),
  };
}

export const OC05: BankKuis = {
  kode: "OC-05",
  jumlah: 5,
  /*
   * Urutan tampil berbeda dari nomor KUIS.md: soal atur (oc05-1) tidak boleh
   * pertama, karena Kuis memasang `siapkan` saat soal DIBUKA (buka()), dan
   * soal pertama tampil tanpa dibuka. Lagi pula b₂min lebih enak dihitung
   * dulu (oc05-2) sebelum diatur di lembar.
   */
  buat: (benih) => [soal2(benih), soal3(benih), soal1(benih), soal4(benih), soal5(benih)],
};
