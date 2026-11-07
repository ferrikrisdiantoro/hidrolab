/**
 * Bank soal FF-07 Percepatan aliran (KUIS.md, termasuk revisi insinyur
 * 1 November).
 *
 * Saluran mengerucut dari D₁ 0,2 m sepanjang L 0,5 m (tetap, sama dengan
 * lembar). Keadaan memakai SATUAN PENGGESER: Q dalam l/s (5–500 langkah 5),
 * D2 dalam mm (30–200 langkah 5), s 0–0,9 langkah 0,05, w 0–10 rad/s langkah
 * 0,25, x 0–0,5 m langkah 0,01, t 0–6 s langkah 0,05. Semua kunci dihitung
 * SESUDAH pembulatan itu lewat acceleration() (akselLembar).
 *
 * Soal contoh: belum ditelaah dosen pengampu (KUIS.md baris 4).
 */

import { acceleration, type Acceleration } from "../../lib/hydraulics.ts";
import { C } from "../../lib/theme.ts";
import type { ParamDef } from "../../lib/rentang.ts";
import {
  acakKisi,
  bi,
  buangDuplikat,
  cobaBenih,
  fmtL,
  kisi,
  kocok,
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

/** Diameter pangkal dan panjang saluran mengerucut, tetap. */
export const D1 = 0.2;
export const L = 0.5;

/** Sama dengan InputRow lembar PercepatanAliranClient (satuan penggeser). */
export const P_Q: ParamDef = { min: 5, max: 500, step: 5, digits: 0 };
export const P_S: ParamDef = { min: 0, max: 0.9, step: 0.05, digits: 2 };
export const P_W: ParamDef = { min: 0, max: 10, step: 0.25, digits: 2 };
export const P_D2: ParamDef = { min: 30, max: 200, step: 5, digits: 0 };
export const P_X: ParamDef = { min: 0, max: L, step: 0.01, digits: 2 };
/** Ujung atas = ACCEL_SWEEP (drawAccel.ts), sapuan kursor waktu lembar. */
export const P_T: ParamDef = { min: 0, max: 6, step: 0.05, digits: 2 };

/** Panggilan acceleration() yang sama dengan lembar. */
export const akselLembar = (k: Keadaan): Acceleration =>
  acceleration(k.Q / 1000, k.s, k.w, D1, k.D2 / 1000, L, k.x, k.t);

type F = (v: number, d: number) => string;
const langkahBi = (t: (f: F, l: "id" | "en") => LangkahKuis[]): Bi<LangkahKuis[]> => ({
  id: t((v, d) => fmtL(v, d, "id"), "id"),
  en: t((v, d) => fmtL(v, d, "en"), "en"),
});

const Dx = (k: Keadaan) => D1 + (k.D2 / 1000 - D1) * Math.min(Math.max(k.x / L, 0), 1);
const luas = (D: number) => (Math.PI * D * D) / 4;
const kurung = (v: number, d: number, f: F) => (v < 0 && f(v, d) !== f(0, d) ? `(${f(v, d)})` : f(v, d));

const teksSet = (m: Keadaan, f: F) =>
  `Q₀ = ${f(m.Q, 0)} l/s, s = ${f(m.s, 2)}, ω = ${f(m.w, 2)} rad/s, D₂ = ${f(m.D2, 0)} mm, t = ${f(m.t, 2)} s`;

const duaAngka = (v: number) => {
  if (!(v > 0)) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Number((Math.round(v / p) * p).toFixed(Math.max(0, -Math.round(Math.log10(p)))));
};

const langkahDA = (m: Keadaan, f: F, l: "id" | "en"): LangkahKuis[] => {
  const D = Dx(m);
  return [
    {
      judul: l === "id" ? "Diameter di penampang x" : "Diameter at station x",
      rumus: "D(x) = D₁ + (D₂ − D₁) · x / L",
      isi: `${f(D1, 3)} + ( ${f(m.D2 / 1000, 3)} − ${f(D1, 3)} ) · ${f(m.x, 2)} / ${f(L, 2)}`,
      hasil: f(D, 4),
      satuan: "m",
    },
    {
      judul: l === "id" ? "Luas penampang" : "Section area",
      rumus: "A = π · D² / 4",
      isi: `π · ${f(D, 4)}² / 4`,
      hasil: f(luas(D), 5),
      satuan: "m²",
    },
  ];
};

/* ------------------------------------------------------------------ *
 * B1 pilih: lokal nol di setiap saat (tunak)
 * ------------------------------------------------------------------ */

type PilihSet = Pilihan & { set: Keadaan };

function soal1(benih: number): Soal {
  type Calon = { set: Keadaan; jenis: "tunak" | "cosnol" | "lurus" | "biasa" };
  const bangun = (r: () => number): Calon[] | null => {
    const x = acakKisi(r, P_X, 0.1, 0.4);
    const Q = () => acakKisi(r, P_Q, 20, 200);
    const D2 = () => acakKisi(r, P_D2, 50, 150);
    const tunak: Keadaan =
      r() < 0.5
        ? { Q: Q(), s: 0, w: acakKisi(r, P_W, 1, 8), D2: D2(), x, t: acakKisi(r, P_T, 0.2, 5) }
        : { Q: Q(), s: acakKisi(r, P_S, 0.2, 0.8), w: 0, D2: D2(), x, t: acakKisi(r, P_T, 0.2, 5) };
    // cos ωt ≈ 0 pada saat t: lokal hampir nol SESAAT, tidak di setiap saat.
    const w = acakKisi(r, P_W, 1, 8);
    const ts = kisi(P_T).filter((t) => t > 0 && Math.abs(Math.cos(w * t)) < 0.05);
    if (ts.length === 0) return null;
    const cosnol: Keadaan = { Q: Q(), s: acakKisi(r, P_S, 0.2, 0.8), w, D2: D2(), x, t: ts[Math.floor(r() * ts.length)] };
    const lurus: Keadaan = { Q: Q(), s: acakKisi(r, P_S, 0.2, 0.8), w: acakKisi(r, P_W, 1, 8), D2: 200, x, t: acakKisi(r, P_T, 0.2, 5) };
    const biasa: Keadaan = { Q: Q(), s: acakKisi(r, P_S, 0.2, 0.8), w: acakKisi(r, P_W, 1, 8), D2: D2(), x, t: acakKisi(r, P_T, 0.2, 5) };
    // Lokal pengecoh biasa dan lurus jelas bukan nol; amplitudo lokal cosnol berarti.
    for (const m of [lurus, biasa]) {
      if (Math.abs(Math.cos(m.w * m.t)) < 0.2 || Math.abs(akselLembar(m).local) <= 0.05) return null;
    }
    const amp = ((cosnol.Q / 1000) * cosnol.s * cosnol.w) / luas(Dx(cosnol));
    if (amp < 0.5) return null;
    const semua: Calon[] = [
      { set: tunak, jenis: "tunak" },
      { set: cosnol, jenis: "cosnol" },
      { set: lurus, jenis: "lurus" },
      { set: biasa, jenis: "biasa" },
    ];
    const teks = semua.map((c) => teksSet(c.set, (v, d) => fmtL(v, d, "id")));
    return new Set(teks).size === teks.length ? semua : null;
  };
  const calon = cobaBenih(benih, 1, bangun, () => [
    { set: { Q: 100, s: 0, w: 2, D2: 80, x: 0.25, t: 0.4 }, jenis: "tunak" as const },
    { set: { Q: 100, s: 0.5, w: 2, D2: 80, x: 0.25, t: 0.8 }, jenis: "cosnol" as const },
    { set: { Q: 50, s: 0.8, w: 6, D2: 200, x: 0.25, t: 0.1 }, jenis: "lurus" as const },
    { set: { Q: 20, s: 0.5, w: 6, D2: 170, x: 0.25, t: 0.2 }, jenis: "biasa" as const },
  ]);
  const x = calon[0].set.x;

  const alasan = (c: Calon): Bi<string> =>
    bi((f, l) => {
      const a = akselLembar(c.set);
      if (c.jenis === "cosnol")
        return l === "id"
          ? `Pada t ini cos ωt = ${f(Math.cos(c.set.w * c.set.t), 3)}, jadi ∂u/∂t = ${f(a.local, 3)} m/s² hampir nol SESAAT. Debitnya tetap berayun (s dan ω bukan nol); sesaat kemudian suku lokal muncul lagi.`
          : `At this t, cos ωt = ${f(Math.cos(c.set.w * c.set.t), 3)}, so ∂u/∂t = ${f(a.local, 3)} m/s² is nearly zero FOR AN INSTANT. The discharge still swings (s and ω are non-zero); a moment later the local term is back.`;
      if (c.jenis === "lurus")
        return l === "id"
          ? `D₂ = D₁ membuat saluran lurus, jadi suku KONVEKTIF yang nol. Debitnya berayun, sehingga ∂u/∂t = ${f(a.local, 3)} m/s².`
          : `D₂ = D₁ makes the duct straight, so the CONVECTIVE term vanishes. The discharge swings, so ∂u/∂t = ${f(a.local, 3)} m/s².`;
      return l === "id"
        ? `s dan ω sama-sama bukan nol: debit berayun dan ∂u/∂t = ${f(a.local, 3)} m/s².`
        : `s and ω are both non-zero: the discharge swings and ∂u/∂t = ${f(a.local, 3)} m/s².`;
    });

  const urut = kocok(prng(turunan(benih, 1, 99)), calon);
  const pilihan: PilihSet[] = urut.map((c, i) => {
    const p: PilihSet = { id: "abcd"[i], teks: bi((f) => teksSet(c.set, f)), set: c.set };
    if (c.jenis !== "tunak") p.alasan = alasan(c);
    return p;
  });
  const kunci = pilihan[urut.findIndex((c) => c.jenis === "tunak")].id;
  const tunak = calon.find((c) => c.jenis === "tunak")!.set;

  return {
    jenis: "pilih",
    id: "ff07-1",
    tanya: bi((f, l) =>
      l === "id"
        ? `Debit Q(t) = Q₀ (1 + s sin ωt) mengalir di saluran mengerucut D₁ = 200 mm, ditinjau di x = ${f(x, 2)} m. Pada set mana percepatan lokal ∂u/∂t nol di setiap saat (aliran tunak)?`
        : `A discharge Q(t) = Q₀ (1 + s sin ωt) flows through a duct tapering from D₁ = 200 mm, examined at x = ${f(x, 2)} m. For which set is the local acceleration ∂u/∂t zero at every instant (steady flow)?`
    ),
    pilihan,
    kunci,
    bahas: {
      id: `∂u/∂t = Q₀·s·ω·cos ωt / A nol di setiap saat hanya bila s = 0 atau ω = 0; pada set yang tepat ${tunak.s === 0 ? "s" : "ω"} = 0. cos ωt = 0 hanya meniadakannya sesaat, dan D₂ = D₁ meniadakan suku konvektif, bukan lokal. Lihat kartu keadaan dan baris Percepatan lokal sesudah set itu dipasang.`,
      en: `∂u/∂t = Q₀·s·ω·cos ωt / A is zero at every instant only when s = 0 or ω = 0; in the right set ${tunak.s === 0 ? "s" : "ω"} = 0. cos ωt = 0 removes it for an instant only, and D₂ = D₁ removes the convective term, not the local one. See the state card and the Local acceleration row once that set is applied.`,
    },
    masukan: tunak,
  };
}

/* ------------------------------------------------------------------ *
 * B2 hitung: percepatan konvektif tunak
 * ------------------------------------------------------------------ */

function soal2(benih: number): Soal {
  const m = cobaBenih<Keadaan>(
    benih,
    2,
    (r) => {
      const k = {
        Q: acakKisi(r, P_Q, 20, 300),
        s: 0,
        w: 1,
        D2: acakKisi(r, P_D2, 40, 160),
        x: acakKisi(r, P_X, 0.15, 0.5),
        t: 0,
      };
      return akselLembar(k).convective >= 3 ? k : null;
    },
    () => ({ Q: 100, s: 0, w: 1, D2: 80, x: 0.25, t: 0 })
  );
  const a = akselLembar(m);
  const kunci = a.convective;
  const tol = 0.02 * kunci;
  const dDdx = (m.D2 / 1000 - D1) / L;
  const V1 = m.Q / 1000 / luas(D1);
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: kunci },
    [
      {
        nilai: kunci / 2,
        alasan: {
          id: "Faktor 2 terlupa. u = Q/(πD²/4) bergantung pada D², jadi ∂u/∂x = −2u·(dD/dx)/D.",
          en: "The factor 2 was dropped. u = Q/(πD²/4) depends on D², so ∂u/∂x = −2u·(dD/dx)/D.",
        },
      },
      {
        nilai: V1 * ((-2 * V1 * dDdx) / D1),
        alasan: {
          id: "Ini memakai D₁ di pangkal. Kecepatan dan diameternya diambil di penampang x, yaitu D(x).",
          en: "This uses D₁ at the inlet. Velocity and diameter are taken at station x, that is D(x).",
        },
      },
      {
        nilai: -kunci,
        alasan: {
          id: "Tandanya terbalik. Saluran mengerucut (D₂ < D₁), jadi air dipercepat ke hilir: u ∂u/∂x positif.",
          en: "The sign is reversed. The duct tapers (D₂ < D₁), so the water speeds up downstream: u ∂u/∂x is positive.",
        },
      },
    ],
    { toleransi: tol, digits: 1 }
  );
  return {
    jenis: "hitung",
    id: "ff07-2",
    tanya: bi((f, l) =>
      l === "id"
        ? `Debit tetap Q₀ = ${f(m.Q, 0)} l/s mengalir di saluran mengerucut dari D₁ = 200 mm ke D₂ = ${f(m.D2, 0)} mm sepanjang L = ${f(L, 2)} m. Hitung percepatan konvektif u ∂u/∂x di x = ${f(m.x, 2)} m.`
        : `A steady discharge Q₀ = ${f(m.Q, 0)} l/s flows through a duct tapering from D₁ = 200 mm to D₂ = ${f(m.D2, 0)} mm over L = ${f(L, 2)} m. Compute the convective acceleration u ∂u/∂x at x = ${f(m.x, 2)} m.`
    ),
    kunci,
    toleransi: tol,
    digits: 1,
    satuan: { id: "m/s²", en: "m/s²" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `Aliran tunak tetap berpercepatan: u ∂u/∂x = u·(−2u·(D₂ − D₁)/(L·D)) = ${f(kunci, 1)} m/s², yaitu ${f(a.inGravities, 1)} g. Lihat baris Percepatan konvektif di tabel hasil.`
        : `Steady flow still accelerates: u ∂u/∂x = u·(−2u·(D₂ − D₁)/(L·D)) = ${f(kunci, 1)} m/s², that is ${f(a.inGravities, 1)} g. See the Convective acceleration row in the results.`
    ),
    langkah: langkahBi((f, l) => [
      ...langkahDA(m, f, l),
      {
        judul: l === "id" ? "Kecepatan" : "Velocity",
        rumus: "u = Q₀ / A",
        isi: `${f(m.Q / 1000, 3)} / ${f(luas(Dx(m)), 5)}`,
        hasil: f(a.velocity, 3),
        satuan: "m/s",
        tint: C.water,
      },
      {
        judul: l === "id" ? "Percepatan konvektif" : "Convective acceleration",
        rumus: "u ∂u/∂x = u · ( −2u · (D₂ − D₁) / (L · D) )",
        isi: `${f(a.velocity, 4)} · ( −2 · ${f(a.velocity, 4)} · ( ${f(m.D2 / 1000, 3)} − ${f(D1, 3)} ) / ( ${f(L, 2)} · ${f(Dx(m), 4)} ) )`,
        hasil: f(kunci, 1),
        satuan: "m/s²",
        tint: C.critical,
      },
    ]),
    masukan: m,
  };
}

/* ------------------------------------------------------------------ *
 * B3 hitung: percepatan lokal
 * ------------------------------------------------------------------ */

function soal3(benih: number): Soal {
  const m = cobaBenih<Keadaan>(
    benih,
    3,
    (r) => {
      const k = {
        Q: acakKisi(r, P_Q, 10, 200),
        s: acakKisi(r, P_S, 0.1, 0.9),
        w: acakKisi(r, P_W, 0.5, 10),
        D2: acakKisi(r, P_D2, 40, 190),
        x: acakKisi(r, P_X, 0, 0.5),
        t: acakKisi(r, P_T, 0.05, 6),
      };
      if (Math.abs(Math.cos(k.w * k.t)) <= 0.2) return null;
      return Math.abs(akselLembar(k).local) >= 0.5 ? k : null;
    },
    () => ({ Q: 50, s: 0.8, w: 6, D2: 190, x: 0.25, t: 0.4 })
  );
  const a = akselLembar(m);
  const kunci = a.local;
  const tol = 0.02 * Math.abs(kunci);
  const A = luas(Dx(m));
  const base = (m.Q / 1000) * m.s;
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: kunci },
    [
      {
        nilai: (base * m.w * Math.sin(m.w * m.t)) / A,
        alasan: {
          id: "Ini memakai sin ωt. Turunan Q₀(1 + s sin ωt) terhadap t adalah Q₀·s·ω·cos ωt.",
          en: "This uses sin ωt. The time derivative of Q₀(1 + s sin ωt) is Q₀·s·ω·cos ωt.",
        },
      },
      {
        nilai: (base * m.w * Math.cos(m.w * m.t)) / luas(D1),
        alasan: {
          id: "Luasnya diambil dengan D₁. Yang dipakai luas di penampang x, A = π·D(x)²/4.",
          en: "The area was taken with D₁. Use the area at station x, A = π·D(x)²/4.",
        },
      },
      {
        nilai: (base * Math.cos(m.w * m.t)) / A,
        alasan: {
          id: "ω terlupa. Menurunkan sin ωt terhadap t mengeluarkan faktor ω.",
          en: "ω was left out. Differentiating sin ωt with respect to t brings out a factor ω.",
        },
      },
    ],
    { toleransi: tol, digits: 2 }
  );
  return {
    jenis: "hitung",
    id: "ff07-3",
    tanya: bi((f, l) =>
      l === "id"
        ? `Debit Q(t) = Q₀ (1 + s sin ωt) dengan Q₀ = ${f(m.Q, 0)} l/s, s = ${f(m.s, 2)}, ω = ${f(m.w, 2)} rad/s mengalir di saluran mengerucut dari D₁ = 200 mm ke D₂ = ${f(m.D2, 0)} mm sepanjang ${f(L, 2)} m. Hitung percepatan lokal ∂u/∂t di x = ${f(m.x, 2)} m pada t = ${f(m.t, 2)} s.`
        : `A discharge Q(t) = Q₀ (1 + s sin ωt) with Q₀ = ${f(m.Q, 0)} l/s, s = ${f(m.s, 2)}, ω = ${f(m.w, 2)} rad/s flows through a duct tapering from D₁ = 200 mm to D₂ = ${f(m.D2, 0)} mm over ${f(L, 2)} m. Compute the local acceleration ∂u/∂t at x = ${f(m.x, 2)} m at t = ${f(m.t, 2)} s.`
    ),
    kunci,
    toleransi: tol,
    digits: 2,
    satuan: { id: "m/s²", en: "m/s²" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `∂u/∂t = Q₀·s·ω·cos ωt / A(x) = ${f(kunci, 2)} m/s², dengan ωt = ${f(m.w * m.t, 2)} rad. Lihat baris Percepatan lokal di tabel hasil.`
        : `∂u/∂t = Q₀·s·ω·cos ωt / A(x) = ${f(kunci, 2)} m/s², with ωt = ${f(m.w * m.t, 2)} rad. See the Local acceleration row in the results.`
    ),
    langkah: langkahBi((f, l) => [
      ...langkahDA(m, f, l),
      {
        judul: l === "id" ? "Percepatan lokal" : "Local acceleration",
        rumus: "∂u/∂t = Q₀ · s · ω · cos ωt / A",
        isi: `${f(m.Q / 1000, 3)} · ${f(m.s, 2)} · ${f(m.w, 2)} · cos( ${f(m.w, 2)} · ${f(m.t, 2)} ) / ${f(A, 5)}`,
        hasil: f(kunci, 2),
        satuan: "m/s²",
        tint: C.water,
      },
    ]),
    masukan: m,
  };
}

/* ------------------------------------------------------------------ *
 * B4 pilih numerik: Q₀ ×2 → rasio percepatan total
 * ------------------------------------------------------------------ */

function soal4(benih: number): Soal {
  const m = cobaBenih<Keadaan>(
    benih,
    4,
    (r) => {
      const k = {
        Q: acakKisi(r, P_Q, 10, 250),
        s: acakKisi(r, P_S, 0.2, 0.9),
        w: acakKisi(r, P_W, 1, 10),
        D2: acakKisi(r, P_D2, 60, 195),
        x: acakKisi(r, P_X, 0.1, 0.5),
        t: acakKisi(r, P_T, 0, 6),
      };
      if (!(Math.cos(k.w * k.t) > 0.2) || k.D2 >= 200) return null;
      const sh = akselLembar(k).convectiveShare;
      return sh >= 0.2 && sh <= 0.8 ? k : null;
    },
    () => ({ Q: 20, s: 0.5, w: 6, D2: 170, x: 0.25, t: 0.2 }),
    // Syarat B4 sempit (cos ωt > 0,2 dan bagian konvektif 0,2–0,8): lebih banyak percobaan.
    80
  );
  const a = akselLembar(m);
  const a2 = akselLembar({ ...m, Q: 2 * m.Q });
  const rasio = a2.total / a.total;
  const sh = a.convectiveShare;
  const calon = buangDuplikat({ key: "k", nilai: rasio }, [
    {
      key: "dua",
      nilai: 2,
      alasan: {
        id: "×2 berlaku bila seluruhnya lokal. Suku konvektif mengikuti kuadrat debit, jadi ikut menjadi empat kali.",
        en: "×2 holds only if it were all local. The convective term goes with the square of the discharge, so it becomes four times as large.",
      } as Bi<string>,
    },
    {
      key: "empat",
      nilai: 4,
      alasan: {
        id: "×4 berlaku bila seluruhnya konvektif. Suku lokal sebanding debit, jadi hanya menjadi dua kali.",
        en: "×4 holds only if it were all convective. The local term is proportional to the discharge, so it only doubles.",
      } as Bi<string>,
    },
    {
      key: "lokalTetap",
      nilai: (a.local + 4 * a.convective) / (a.local + a.convective),
      alasan: {
        id: "Ini menganggap suku lokal tidak berubah. ∂u/∂t = Q₀·s·ω·cos ωt / A ikut menjadi dua kali bersama Q₀.",
        en: "This treats the local term as unchanged. ∂u/∂t = Q₀·s·ω·cos ωt / A doubles with Q₀ as well.",
      } as Bi<string>,
    },
  ], { toleransi: 0.05, digits: 2 });
  const pilihan: Pilihan[] = [
    { id: "k", nilai: rasio, alasan: undefined as Bi<string> | undefined },
    ...calon.map((c) => ({ id: c.key, nilai: c.nilai, alasan: c.alasan as Bi<string> | undefined })),
  ]
    .sort((p, q) => p.nilai - q.nilai)
    .map((p) => ({
      id: p.id,
      teks: bi((f, l) => (l === "id" ? `a menjadi ×${f(p.nilai, 2)}` : `a becomes ×${f(p.nilai, 2)}`)),
      ...(p.alasan ? { alasan: p.alasan } : {}),
    }));
  return {
    jenis: "pilih",
    id: "ff07-4",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksSet(m, f)}, di x = ${f(m.x, 2)} m. Percepatan total a = ${f(a.total, 2)} m/s², ${f(sh * 100, 0)} % dari suku konvektif. Bila Q₀ dilipatduakan (yang lain tetap), a menjadi berapa kali?`
        : `${teksSet(m, f)}, at x = ${f(m.x, 2)} m. The total acceleration is a = ${f(a.total, 2)} m/s², ${f(sh * 100, 0)} % from the convective term. If Q₀ is doubled (all else fixed), by what factor does a change?`
    ),
    pilihan,
    kunci: "k",
    bahas: bi((f, l) =>
      l === "id"
        ? `Suku lokal ×2 dan suku konvektif ×4, jadi a₂/a = (2·lokal + 4·konv)/(lokal + konv) = 2 + 2·${f(sh, 3)} = ${f(rasio, 2)}. Butir kedua kartu keadaan menulis rasio yang sama untuk masukan lembar.`
        : `The local term ×2 and the convective term ×4, so a₂/a = (2·local + 4·conv)/(local + conv) = 2 + 2·${f(sh, 3)} = ${f(rasio, 2)}. The second point of the state card writes the same ratio for the sheet's inputs.`
    ),
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "Kedua suku pada Q₀" : "Both terms at Q₀",
        rumus: "a = ∂u/∂t + u ∂u/∂x",
        isi: `${f(a.local, 3)} + ${kurung(a.convective, 3, f)}`,
        hasil: f(a.total, 3),
        satuan: "m/s²",
        tint: C.energy,
      },
      {
        judul: l === "id" ? "Pada 2·Q₀" : "At 2·Q₀",
        rumus: "a₂ = 2 · ∂u/∂t + 4 · u ∂u/∂x",
        isi: `2 · ${f(a.local, 3)} + 4 · ${kurung(a.convective, 3, f)}`,
        hasil: f(a2.total, 3),
        satuan: "m/s²",
        tint: C.energy,
      },
      {
        judul: l === "id" ? "Rasio" : "Ratio",
        rumus: "a₂ / a",
        isi: `${f(a2.total, 3)} / ${f(a.total, 3)}`,
        hasil: f(rasio, 2),
      },
    ]),
    masukan: m,
  };
}

/* ------------------------------------------------------------------ *
 * B5 atur: D₂ sampai a/g di pita sasaran
 * ------------------------------------------------------------------ */

export const gLembar = (k: Keadaan) => akselLembar(k).inGravities;

function soal5(benih: number): Soal {
  type Siap = { tetap: Keadaan; min: number; max: number; lolos: number[] };
  const lolosDi = (tetap: Keadaan, min: number, max: number) =>
    kisi(P_D2).filter((D2) => {
      const g = gLembar({ ...tetap, D2 });
      return g >= min && g <= max;
    });
  const s =
    cobaBenih<Siap | null>(
      benih,
      5,
      (r) => {
        const tetap = { Q: acakKisi(r, P_Q, 20, 300), s: 0, w: 1, x: acakKisi(r, P_X, 0.1, 0.3), t: 0 };
        const g0 = gLembar({ ...tetap, D2: acakKisi(r, P_D2, 60, 180) });
        const min = duaAngka(g0 * 0.75);
        const max = duaAngka(g0 * 1.25);
        if (!(min > 0 && max > min)) return null;
        const lolos = lolosDi(tetap, min, max);
        return lolos.length >= 3 ? { tetap, min, max, lolos } : null;
      },
      () => null
    ) ??
    (() => {
      // Cadangan: pita ±25 % di sekitar D₂ = 120 mm, dihitung lewat lib.
      const tetap = { Q: 100, s: 0, w: 1, x: 0.2, t: 0 };
      const g0 = gLembar({ ...tetap, D2: 120 });
      const min = duaAngka(g0 * 0.75), max = duaAngka(g0 * 1.25);
      return { tetap, min, max, lolos: lolosDi(tetap, min, max) };
    })();
  const ftk = (v: number, l: "id" | "en") => v.toLocaleString(l === "en" ? "en-US" : "id-ID", { maximumFractionDigits: 3 });
  const lo = s.lolos[0], hi = s.lolos[s.lolos.length - 1];
  return {
    jenis: "atur",
    id: "ff07-5",
    tanya: bi((f, l) =>
      l === "id"
        ? `Debit tetap Q₀ = ${f(s.tetap.Q, 0)} l/s (s = 0), ditinjau di x = ${f(s.tetap.x, 2)} m; keduanya dibiarkan tetap, D₂ dimulai dari 200 mm (saluran lurus). Atur D₂ sampai percepatan a/g berada di antara ${ftk(s.min, l)} dan ${ftk(s.max, l)}, lalu periksa.`
        : `A steady discharge Q₀ = ${f(s.tetap.Q, 0)} l/s (s = 0), examined at x = ${f(s.tetap.x, 2)} m; both stay fixed, D₂ starts at 200 mm (a straight duct). Adjust D₂ until the acceleration a/g lies between ${ftk(s.min, l)} and ${ftk(s.max, l)}, then check.`
    ),
    ukur: gLembar,
    simbol: "a/g",
    digits: 2,
    target: { min: s.min, max: s.max },
    geser: { kunci: "D2", p: P_D2 },
    siapkan: { ...s.tetap, D2: 200 },
    tetap: s.tetap,
    bahas: {
      id: "Makin kecil D₂, makin tajam kerucutnya dan makin besar percepatan konvektifnya, padahal tidak ada yang berubah terhadap waktu. Lihat baris a/g di tabel hasil dan kop.",
      en: "The smaller D₂, the sharper the taper and the larger the convective acceleration, although nothing changes with time. See the a/g row in the results and the title block.",
    },
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "Nilai D₂ di kisi penggeser yang memenuhi" : "Slider values of D₂ that work",
        rumus: `${ftk(s.min, l)} ≤ a/g ≤ ${ftk(s.max, l)}`,
        isi: l === "id" ? "D₂ = 30 sampai 200 mm, langkah 5, lewat acceleration()" : "D₂ = 30 to 200 mm, step 5, through acceleration()",
        hasil: lo === hi ? f(lo, 0) : `${f(lo, 0)} – ${f(hi, 0)}`,
        satuan: "mm",
        tint: C.critical,
      },
    ]),
  };
}

export const FF07: BankKuis = {
  kode: "FF-07",
  jumlah: 5,
  buat: (benih) => [soal1(benih), soal2(benih), soal3(benih), soal4(benih), soal5(benih)],
};
