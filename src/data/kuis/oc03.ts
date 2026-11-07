/**
 * Bank soal OC-03 Profil aliran berubah lambat (KUIS.md, termasuk revisi
 * insinyur 1 November: huruf M/S dari gvfProfile().mild, bukan pita S₀).
 *
 * Semua masukan jatuh di kisi penggeser lembar (ParamDef di bawah, dipakai
 * InputRow ProfilGvfClient), dan semua kunci dihitung SESUDAH pembulatan
 * lewat fungsi lib yang sama dengan lembar (gvfProfile 400 langkah,
 * criticalDepth, normalDepth, normalDepthReachable). S₀ disimpan dalam ‰,
 * sama dengan penggesernya; lib menerima S₀/1000.
 *
 * Butir 1 dan 2 berjenis "tebak": lembar menyembunyikan profilnya sampai
 * soal dijawab (ProfilGvfClient, onAktif/onUngkap).
 *
 * Soal contoh: belum ditelaah dosen pengampu (KUIS.md baris 4).
 */

import {
  G,
  criticalDepth,
  gvfProfile,
  normalDepth,
  normalDepthReachable,
  type GvfResult,
} from "../../lib/hydraulics.ts";
import { C } from "../../lib/theme.ts";
import type { ParamDef } from "../../lib/rentang.ts";
import {
  acakKisi,
  bi,
  buangDuplikat,
  cobaBenih,
  fmtL,
  kisi,
  pilihAcak,
  prng,
  turunan,
  type BankKuis,
  type Bi,
  type Kesalahan,
  type LangkahKuis,
  type Pilihan,
  type Soal,
} from "../../lib/kuis.ts";

/** Sama dengan InputRow lembar ProfilGvfClient. S₀ dalam ‰. */
export const P_Q: ParamDef = { min: 0.5, max: 120, step: 0.5, digits: 1 };
export const P_B: ParamDef = { min: 0.5, max: 25, step: 0.1, digits: 1 };
export const P_N: ParamDef = { min: 0.01, max: 0.07, step: 0.001, digits: 3 };
export const P_S0: ParamDef = { min: 0.05, max: 40, step: 0.05, digits: 2 };
export const P_Y: ParamDef = { min: 0.1, max: 6, step: 0.05, digits: 2 };
export const P_L: ParamDef = { min: 100, max: 4000, step: 50, digits: 0 };
/** Jumlah langkah Runge-Kutta, sama dengan lembar. */
export const LANGKAH_GVF = 400;

const PROFIL = ["M1", "M2", "M3", "S1", "S2", "S3"] as const;
type Profil = (typeof PROFIL)[number];

type Masuk = { Q: number; b: number; n: number; S0: number; y: number; L: number };
type Kasus = Masuk & { r: GvfResult };

const gvf = (m: Masuk, L = m.L, langkah = LANGKAH_GVF) =>
  gvfProfile(m.Q, m.b, m.n, m.S0 / 1000, m.y, L, langkah);

/** Kedalaman kendali berjarak ≥ 0,05 m dan ≥ 10 % dari kedalaman acuan d. */
const jauh = (y: number, d: number) => Math.abs(y - d) >= 0.05 && Math.abs(y / d - 1) >= 0.1;

/** Rentang terbuka kedalaman kendali untuk zona profil sasaran (sama dengan penggolongan gvfProfile). */
function zona(p: Profil, y0: number, yc: number): [number, number] {
  const z = Number(p[1]);
  const [atas, bawah] = p[0] === "M" ? [y0, yc] : [yc, y0];
  return z === 1 ? [atas, Infinity] : z === 2 ? [bawah, atas] : [0, bawah];
}

/**
 * Kasus acak untuk profil sasaran: Q 5–40, b 2–10, n 0,015–0,040, S₀ landai
 * 0,5–3 ‰ atau curam 10–30 ‰; kedalaman normal ada; |y₀/yc − 1| > 0,15; y di
 * zona sasaran berjarak dari y₀ dan yc. null bila gvfProfile tidak memberi
 * profil sasaran (misalnya 10 ‰ yang ternyata landai).
 */
function kasus(r: () => number, p: Profil, Llo = 300, Lhi = 3000): Kasus | null {
  const Q = acakKisi(r, P_Q, 5, 40);
  const b = acakKisi(r, P_B, 2, 10);
  const n = acakKisi(r, P_N, 0.015, 0.04);
  const S0 = p[0] === "M" ? acakKisi(r, P_S0, 0.5, 3) : acakKisi(r, P_S0, 10, 30);
  if (!normalDepthReachable(Q, b, n, S0 / 1000)) return null;
  const yc = criticalDepth(Q / b);
  const y0 = normalDepth(Q, b, n, S0 / 1000);
  if (!(Math.abs(y0 / yc - 1) > 0.15)) return null;
  const [lo, hi] = zona(p, y0, yc);
  const calon = kisi(P_Y).filter((y) => y > lo && y < hi && jauh(y, y0) && jauh(y, yc));
  if (calon.length === 0) return null;
  const y = pilihAcak(r, calon);
  const L = acakKisi(r, P_L, Llo, Lhi);
  const m = { Q, b, n, S0, y, L };
  const hasil = gvf(m);
  if (hasil.profile !== p) return null;
  return { ...m, r: hasil };
}

/**
 * Cadangan per profil, dicek dengan lib: Q 12, b 5, n 0,025; landai
 * S₀ 1,5 ‰ (y₀ 1,582, yc 0,837 m), curam 20 ‰ (y₀ 0,656 m).
 */
function cadangan(p: Profil): Kasus {
  const y = { M1: 2.5, M2: 1.2, M3: 0.5, S1: 1.5, S2: 0.75, S3: 0.4 }[p];
  const m = { Q: 12, b: 5, n: 0.025, S0: p[0] === "M" ? 1.5 : 20, y, L: 1500 };
  return { ...m, r: gvf(m) };
}

const masukan = (k: Kasus) => ({ Q: k.Q, b: k.b, n: k.n, S0: k.S0, y: k.y, L: k.L });

const SYARAT: Record<Profil, string> = {
  M1: "y > y₀ > yc",
  M2: "y₀ > y > yc",
  M3: "y₀ > yc > y",
  S1: "y > yc > y₀",
  S2: "yc > y > y₀",
  S3: "yc > y₀ > y",
};

type F = (v: number, d: number) => string;

/** Urutan nyata y, y₀, yc dengan angkanya, dari yang terdalam. */
function urutan(k: Kasus, f: F): string {
  return [
    { s: "y", v: k.y, d: 2 },
    { s: "y₀", v: k.r.y0, d: 3 },
    { s: "yc", v: k.r.yc, d: 3 },
  ]
    .sort((a, c) => c.v - a.v)
    .map((t) => `${t.s} = ${f(t.v, t.d)} m`)
    .join(" > ");
}

const teksSaluran = (k: Kasus, f: F, l: "id" | "en") =>
  l === "id"
    ? `Saluran persegi Q = ${f(k.Q, 1)} m³/s, b = ${f(k.b, 1)} m, n = ${f(k.n, 3)}, S₀ = ${f(k.S0, 2)} ‰.`
    : `Rectangular channel Q = ${f(k.Q, 1)} m³/s, b = ${f(k.b, 1)} m, n = ${f(k.n, 3)}, S₀ = ${f(k.S0, 2)} ‰.`;

const teksKedalaman = (k: Kasus, f: F, l: "id" | "en") =>
  l === "id"
    ? `Kedalaman normal y₀ = ${f(k.r.y0, 3)} m, kedalaman kritis yc = ${f(k.r.yc, 3)} m, dan kedalaman di penampang kendali y = ${f(k.y, 2)} m.`
    : `Normal depth y₀ = ${f(k.r.y0, 3)} m, critical depth yc = ${f(k.r.yc, 3)} m, and the depth at the control section y = ${f(k.y, 2)} m.`;

const langkahBi = (t: (f: F, l: "id" | "en") => LangkahKuis[]): Bi<LangkahKuis[]> => ({
  id: t((v, d) => fmtL(v, d, "id"), "id"),
  en: t((v, d) => fmtL(v, d, "en"), "en"),
});

const langkahKlas = (k: Kasus, f: F, l: "id" | "en"): LangkahKuis => ({
  judul: l === "id" ? "Penggolongan profil" : "Profile classification",
  rumus: k.r.mild ? "y₀ > yc → M" : "y₀ < yc → S",
  isi: `y₀ ${f(k.r.y0, 3)} ${k.r.mild ? ">" : "<"} yc ${f(k.r.yc, 3)};  y ${f(k.y, 2)} → ${l === "id" ? "zona" : "zone"} ${k.r.profile.slice(1)}`,
  hasil: k.r.profile,
  tint: C.critical,
});

/** Profil sasaran diundi sekali, di luar percobaan ulang, supaya keenamnya muncul sama sering. */
const undiProfil = (benih: number, butir: number, dari: readonly Profil[] = PROFIL): Profil =>
  dari[Math.floor(prng(turunan(benih, butir, 100))() * dari.length)];

/* ------------------------------------------------------------------ *
 * B1 tebak: nama profil
 * ------------------------------------------------------------------ */

function soal1(benih: number): Soal {
  const p = undiProfil(benih, 1);
  const k = cobaBenih(benih, 1, (r) => kasus(r, p), () => cadangan(p), 60);
  const kunci = k.r.profile as Profil;
  // Pengecoh: angka sama huruf lain, lalu kedua zona lain dengan huruf yang sama.
  const lain = ((kunci[0] === "M" ? "S" : "M") + kunci[1]) as Profil;
  const sehuruf = PROFIL.filter((q) => q[0] === kunci[0] && q !== kunci);
  const ids = [kunci, lain, ...sehuruf].sort((a, c) => PROFIL.indexOf(a) - PROFIL.indexOf(c));
  const pilihan: Pilihan[] = ids.map((id) => ({
    id,
    teks: { id, en: id },
    alasan:
      id === kunci
        ? undefined
        : bi((f, l) =>
            l === "id"
              ? `${id} berlaku bila ${SYARAT[id]}. Di sini ${urutan(k, f)}.`
              : `${id} requires ${SYARAT[id]}. Here ${urutan(k, f)}.`
          ),
  }));
  return {
    jenis: "tebak",
    id: "oc03-1",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksSaluran(k, f, l)} ${teksKedalaman(k, f, l)} Tebak dulu sebelum melihat gambar: profil apa yang terbentuk?`
        : `${teksSaluran(k, f, l)} ${teksKedalaman(k, f, l)} Guess before looking at the drawing: which profile forms?`
    ),
    pilihan,
    kunci,
    bahas: bi((f, l) =>
      l === "id"
        ? `Huruf dari jenis kemiringan: y₀ ${k.r.mild ? ">" : "<"} yc, jadi saluran ${k.r.mild ? "landai (M)" : "curam (S)"}. Angka dari zona kedalaman kendali: ${urutan(k, f)}, zona ${kunci[1]}. Profilnya ${kunci}; gambar dan pita zona di atas lembar kini terbuka.`
        : `The letter comes from the slope type: y₀ ${k.r.mild ? ">" : "<"} yc, so the channel is ${k.r.mild ? "mild (M)" : "steep (S)"}. The number comes from the zone of the control depth: ${urutan(k, f)}, zone ${kunci[1]}. The profile is ${kunci}; the drawing and the zone scale above the sheet are now open.`
    ),
    langkah: langkahBi((f, l) => [langkahKlas(k, f, l)]),
    masukan: masukan(k),
  };
}

/* ------------------------------------------------------------------ *
 * B2 tebak: arah penelusuran
 * ------------------------------------------------------------------ */

function soal2(benih: number): Soal {
  const p = undiProfil(benih, 2);
  const k = cobaBenih(benih, 2, (r) => kasus(r, p), () => cadangan(p), 60);
  const sub = k.r.direction === "hulu";
  const kunci = sub ? "hulu-sub" : "hilir-sup";
  const nyata = bi((f, l) =>
    l === "id"
      ? `Di sini y = ${f(k.y, 2)} m ${sub ? ">" : "<"} yc = ${f(k.r.yc, 3)} m: aliran di penampang kendali ${sub ? "subkritis, dikendalikan dari hilir, jadi ditelusuri ke hulu" : "superkritis, dikendalikan dari hulu, jadi ditelusuri ke hilir"}.`
      : `Here y = ${f(k.y, 2)} m ${sub ? ">" : "<"} yc = ${f(k.r.yc, 3)} m: the flow at the control section is ${sub ? "subcritical, controlled from downstream, so it is computed upstream" : "supercritical, controlled from upstream, so it is computed downstream"}.`
  );
  const bukanKemiringan: Bi<string> = {
    id: `Arah penelusuran ditentukan rezim aliran di penampang kendali (y terhadap yc), bukan jenis kemiringan. Profil M3 superkritis di saluran landai dan ditelusuri ke hilir; S1 subkritis di saluran curam dan ditelusuri ke hulu. ${nyata.id}`,
    en: `The direction is set by the flow regime at the control section (y against yc), not by the slope type. An M3 profile is supercritical on a mild slope and is computed downstream; S1 is subcritical on a steep slope and is computed upstream. ${nyata.en}`,
  };
  const pilihan: Pilihan[] = [
    {
      id: "hulu-sub",
      teks: {
        id: "Ke hulu, karena aliran di penampang kendali subkritis (y > yc)",
        en: "Upstream, because the flow at the control section is subcritical (y > yc)",
      },
      alasan: nyata,
    },
    {
      id: "hilir-sup",
      teks: {
        id: "Ke hilir, karena aliran di penampang kendali superkritis (y < yc)",
        en: "Downstream, because the flow at the control section is supercritical (y < yc)",
      },
      alasan: nyata,
    },
    {
      id: "hulu-landai",
      teks: { id: "Ke hulu, karena salurannya landai (y₀ > yc)", en: "Upstream, because the channel is mild (y₀ > yc)" },
      alasan: bukanKemiringan,
    },
    {
      id: "hilir-curam",
      teks: { id: "Ke hilir, karena salurannya curam (y₀ < yc)", en: "Downstream, because the channel is steep (y₀ < yc)" },
      alasan: bukanKemiringan,
    },
  ];
  return {
    jenis: "tebak",
    id: "oc03-2",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksSaluran(k, f, l)} ${teksKedalaman(k, f, l)} Tebak dulu: dari penampang kendali, ke arah mana profil ini ditelusuri, dan mengapa?`
        : `${teksSaluran(k, f, l)} ${teksKedalaman(k, f, l)} Guess first: from the control section, which way is this profile computed, and why?`
    ),
    pilihan,
    kunci,
    bahas: bi((f, l) =>
      l === "id"
        ? `${nyata.id} Profilnya ${k.r.profile}. Lihat baris Arah penelusuran di tabel hasil dan letak penampang kendali di gambar.`
        : `${nyata.en} The profile is ${k.r.profile}. See the Computation direction row in the results and where the control section sits in the drawing.`
    ),
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "Rezim di penampang kendali" : "Regime at the control section",
        rumus: sub ? "y > yc → subkritis" : "y < yc → superkritis",
        isi: `y ${f(k.y, 2)} ${sub ? ">" : "<"} yc ${f(k.r.yc, 3)}`,
        hasil: l === "id" ? (sub ? "ke hulu" : "ke hilir") : sub ? "upstream" : "downstream",
      },
    ]),
    masukan: masukan(k),
  };
}

/* ------------------------------------------------------------------ *
 * B3 pilih: berhenti di yc atau menuju y₀
 * ------------------------------------------------------------------ */

const panjang = (r: GvfResult) => {
  const xs = r.points.map((p) => p.x);
  return Math.max(...xs) - Math.min(...xs);
};

function soal3(benih: number): Soal {
  const berhenti = prng(turunan(benih, 3, 101))() < 0.5;
  const p = undiProfil(benih, 3, berhenti ? ["M3", "S1"] : ["M1", "M2", "S2", "S3"]);
  const k = cobaBenih(
    benih,
    3,
    (r) => {
      const c = kasus(r, p);
      if (!c) return null;
      if (berhenti) return c.r.endsAtCritical && panjang(c.r) <= 0.8 * c.L ? c : null;
      // Margin: bentang 1,25 L pun belum sampai ke kondisi kritis.
      return !c.r.endsAtCritical && !gvf(c, 1.25 * c.L).endsAtCritical ? c : null;
    },
    () => cadangan(p),
    60
  );
  const kunci = k.r.endsAtCritical ? "berhenti-yc" : "menuju-y0";
  const P = k.r.profile;
  const Lp = panjang(k.r);
  const ujung = k.r.direction === "hulu" ? k.r.points[0] : k.r.points[k.r.points.length - 1];
  const dy = Math.abs(ujung.y - k.r.y0);
  const pilihan: Pilihan[] = [
    {
      id: "menuju-y0",
      teks: {
        id: "Bergerak menuju kedalaman normal y₀ tanpa mencapai yc, sampai ujung bentang",
        en: "Heads toward normal depth y₀ without reaching yc, all the way to the end of the reach",
      },
      alasan: bi((f, l) =>
        l === "id"
          ? `${P}: yc terletak di antara kedalaman kendali dan y₀, jadi profil tidak dapat menuju y₀ tanpa melintasi yc. Ke arah penelusuran ${P === "M3" ? "kedalaman naik ke arah hilir" : "kedalaman turun ke arah hulu"} sampai kondisi kritis, dicapai setelah ${f(Lp, 1)} m, sebelum ujung bentang ${f(k.L, 0)} m.`
          : `${P}: yc lies between the control depth and y₀, so the profile cannot head toward y₀ without crossing yc. Along the computation ${P === "M3" ? "the depth rises going downstream" : "the depth falls going upstream"} until critical, reached after ${f(Lp, 1)} m, before the end of the ${f(k.L, 0)} m reach.`
      ),
    },
    {
      id: "berhenti-yc",
      teks: {
        id: "Mencapai kedalaman kritis yc dan berhenti sebelum ujung bentang",
        en: "Reaches critical depth yc and stops before the end of the reach",
      },
      alasan: {
        id: `${P} mendekati y₀ secara asimtotik ke arah penelusuran dan tidak pernah melewatinya, jadi kondisi kritis tidak tercapai di bentang ini.`,
        en: `${P} approaches y₀ asymptotically along the computation and never passes it, so critical conditions are not reached in this reach.`,
      },
    },
    {
      id: "melintas",
      teks: {
        id: "Melintasi yc lalu berlanjut di sisi seberangnya sampai ujung bentang",
        en: "Crosses yc and carries on along the other side to the end of the reach",
      },
      alasan: {
        id: "Melintasi kondisi kritis berarti aliran berubah cepat: loncatan air (superkritis ke subkritis) atau penurunan tajam di penampang kendali (subkritis ke superkritis). Persamaan aliran berubah lambat tidak berlaku di yc karena penyebut 1 − Fr² menjadi nol, jadi penelusuran berhenti di yc, tidak menyeberang.",
        en: "Crossing critical conditions means rapidly varied flow: a hydraulic jump (supercritical to subcritical) or a sharp drawdown at a control (subcritical to supercritical). The gradually varied flow equation fails at yc because its denominator 1 − Fr² becomes zero, so the computation stops at yc rather than crossing it.",
      },
    },
  ];
  return {
    jenis: "pilih",
    id: "oc03-3",
    tanya: bi((f, l) =>
      l === "id"
        ? `Profil ${P}: ${teksSaluran(k, f, l)} y₀ = ${f(k.r.y0, 3)} m, yc = ${f(k.r.yc, 3)} m, kedalaman kendali y = ${f(k.y, 2)} m, bentang L = ${f(k.L, 0)} m. Bagaimana ujung jauh profil ini?`
        : `Profile ${P}: ${teksSaluran(k, f, l)} y₀ = ${f(k.r.y0, 3)} m, yc = ${f(k.r.yc, 3)} m, control depth y = ${f(k.y, 2)} m, reach L = ${f(k.L, 0)} m. What happens at the far end of this profile?`
    ),
    pilihan,
    kunci,
    bahas: bi((f, l) =>
      k.r.endsAtCritical
        ? l === "id"
          ? `Profil ${P} mencapai yc setelah ${f(Lp, 1)} m dan berhenti di situ. Lihat garis ungu "profil berakhir" di gambar dan baris Panjang profil di tabel hasil.`
          : `The ${P} profile reaches yc after ${f(Lp, 1)} m and stops there. See the purple "profile ends" line in the drawing and the Profile length row in the results.`
        : l === "id"
          ? `Profil ${P} menuju y₀; setelah ${f(k.L, 0)} m selisihnya Δy = ${f(dy, 3)} m dari y₀. Lihat baris Selisih terhadap kedalaman normal di tabel hasil.`
          : `The ${P} profile heads toward y₀; after ${f(k.L, 0)} m it is Δy = ${f(dy, 3)} m away from y₀. See the Difference from normal depth row in the results.`
    ),
    langkah: langkahBi((f, l) => [langkahKlas(k, f, l)]),
    masukan: masukan(k),
  };
}

/* ------------------------------------------------------------------ *
 * B4 hitung: kedalaman kritis
 * ------------------------------------------------------------------ */

function soal4(benih: number): Soal {
  const p = undiProfil(benih, 4);
  const k = cobaBenih(benih, 4, (r) => kasus(r, p), () => cadangan(p), 60);
  const q = k.Q / k.b;
  const yc = criticalDepth(q);
  const tol = Math.max(0.01 * yc, 0.001);
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: yc },
    [
      {
        nilai: Math.cbrt((k.Q * k.Q) / G),
        alasan: {
          id: "Q dipakai langsung. Rumus yc = ∛(q²/g) memakai debit satuan q = Q/b.",
          en: "Q was used directly. The formula yc = ∛(q²/g) uses the unit discharge q = Q/b.",
        },
      },
      {
        nilai: Math.sqrt((q * q) / G),
        alasan: {
          id: "Akar dua dipakai. Kedalaman kritis saluran persegi memakai akar tiga: yc = ∛(q²/g).",
          en: "A square root was used. Critical depth in a rectangular channel takes the cube root: yc = ∛(q²/g).",
        },
      },
      {
        nilai: Math.cbrt(q * q),
        alasan: {
          id: "g terlupa di bawah akar: yc = ∛(q²/g).",
          en: "g was left out under the root: yc = ∛(q²/g).",
        },
      },
    ],
    { toleransi: tol, digits: 3 }
  );
  return {
    jenis: "hitung",
    id: "oc03-4",
    tanya: bi((f, l) =>
      l === "id"
        ? `Saluran persegi selebar b = ${f(k.b, 1)} m mengalirkan Q = ${f(k.Q, 1)} m³/s. Hitung kedalaman kritis yc.`
        : `A rectangular channel b = ${f(k.b, 1)} m wide carries Q = ${f(k.Q, 1)} m³/s. Compute the critical depth yc.`
    ),
    kunci: yc,
    toleransi: tol,
    digits: 3,
    satuan: { id: "m", en: "m" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `q = Q/b = ${f(q, 4)} m²/s, lalu yc = ∛(q²/g) = ${f(yc, 3)} m. Bandingkan dengan baris Kedalaman kritis di tabel hasil.`
        : `q = Q/b = ${f(q, 4)} m²/s, then yc = ∛(q²/g) = ${f(yc, 3)} m. Compare with the Critical depth row in the results.`
    ),
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "Debit satuan dan kedalaman kritis" : "Unit discharge and critical depth",
        rumus: "q = Q / b,  yc = ∛( q² / g )",
        isi: `q = ${f(k.Q, 1)} / ${f(k.b, 1)} = ${f(q, 4)} m²/s;  yc = ∛( ${f(q, 4)}² / ${f(G, 2)} )`,
        hasil: f(yc, 3),
        satuan: "m",
        tint: C.critical,
      },
    ]),
    masukan: masukan(k),
  };
}

/* ------------------------------------------------------------------ *
 * B5 atur: kedalaman kendali sampai M2
 * ------------------------------------------------------------------ */

/** Langkah y di kisi penggeser yang memberi M2 menurut gvfProfile (nama profil tidak bergantung jumlah langkah). */
const langkahM2 = (m: Masuk) =>
  kisi(P_Y).filter((y) => gvfProfile(m.Q, m.b, m.n, m.S0 / 1000, y, m.L, 1).profile === "M2");

function soal5(benih: number): Soal {
  const p = undiProfil(benih, 5, ["M1", "M3"]);
  const sah = (c: Kasus | null) => (c && langkahM2(c).length >= 4 ? c : null);
  const k = cobaBenih(benih, 5, (r) => sah(kasus(r, p)), () => cadangan(p), 60);
  const lolos = langkahM2(k);
  const target = { min: lolos[0], max: lolos[lolos.length - 1] };
  return {
    jenis: "atur",
    id: "oc03-5",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksSaluran(k, f, l)} Q, b, n, dan S₀ dibiarkan tetap; profil sekarang ${k.r.profile}. Atur kedalaman di penampang kendali y sampai profilnya M2, lalu periksa.`
        : `${teksSaluran(k, f, l)} Q, b, n and S₀ stay fixed; the profile is now ${k.r.profile}. Adjust the control depth y until the profile is M2, then check.`
    ),
    ukur: (s) => s.y,
    simbol: "y",
    digits: 2,
    target,
    geser: { kunci: "y", p: P_Y },
    siapkan: masukan(k),
    tetap: { Q: k.Q, b: k.b, n: k.n, S0: k.S0 },
    bahas: {
      id: "M2 terbentuk di saluran landai bila kedalaman kendali berada di antara kedua garis putus-putus, yc < y ≤ y₀: kurva penurunan menuju terjunan bebas. Kartu keadaan lembar menyebut ruas yang terlalu curam di dekat yc.",
      en: "M2 forms on a mild slope when the control depth lies between the two dashed lines, yc < y ≤ y₀: a drawdown curve toward a free overfall. The state card points out the reach near yc that is too steep.",
    },
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "Rentang y yang memberi M2" : "Range of y that gives M2",
        rumus: "yc < y ≤ y₀",
        isi: `${f(k.r.yc, 3)} < y ≤ ${f(k.r.y0, 3)}`,
        hasil: `${f(target.min, 2)} – ${f(target.max, 2)}`,
        satuan: "m",
        tint: C.water,
      },
    ]),
  };
}

export const OC03: BankKuis = {
  kode: "OC-03",
  jumlah: 5,
  buat: (benih) => [soal1(benih), soal2(benih), soal3(benih), soal4(benih), soal5(benih)],
};
