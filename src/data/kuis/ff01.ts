/**
 * Bank soal FF-01 Bernoulli (KUIS.md, termasuk revisi insinyur 1 November:
 * B1 Δz ∈ [1; 10] dan hv₂ ≥ 0,2 m; B4 D₂ ≤ 0,8 D₁, kunci = Δz terbesar di
 * kisi P_DZ tanpa kavitasi, diterima kunci dan satu langkah di bawahnya).
 *
 * Semua masukan jatuh di kisi penggeser lembar (ParamDef di bawah, dipakai
 * InputRow BernoulliClient; Q dalam l/s, diameter dalam mm seperti
 * penggesernya), dan semua kunci dihitung SESUDAH pembulatan lewat
 * ductEnergy dengan stasiun yang sama dengan lembar (stasiunBernoulli).
 *
 * Soal contoh: belum ditelaah dosen pengampu (KUIS.md baris 4).
 */

import { ATM_HEAD, G, ductEnergy, vapourHead, type DuctStation } from "../../lib/hydraulics.ts";
import { C } from "../../lib/theme.ts";
import { keLangkah, type ParamDef } from "../../lib/rentang.ts";
import {
  acakKisi,
  bi,
  bulatAcak,
  bulatKeLangkah,
  buangDuplikat,
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

/** Sama dengan InputRow lembar BernoulliClient. Q dalam l/s, D dalam mm. */
export const P_Q: ParamDef = { min: 5, max: 600, step: 5, digits: 0 };
export const P_H: ParamDef = { min: 2, max: 40, step: 0.5, digits: 1 };
export const P_D1: ParamDef = { min: 100, max: 800, step: 10, digits: 0 };
export const P_D2: ParamDef = { min: 40, max: 800, step: 10, digits: 0 };
export const P_DZ: ParamDef = { min: -8, max: 25, step: 0.5, digits: 1 };

/** Panjang saluran lembar, m. */
export const L_BERNOULLI = 60;

/** Saluran yang mengerucut ke leher di tengah lalu melebar kembali (meter). Satu sumber dengan lembar. */
export function stasiunBernoulli(D1: number, D2: number, dz: number): DuctStation[] {
  const L = L_BERNOULLI;
  return [
    { x: 0, z: 0, D: D1 },
    { x: L * 0.3, z: dz * 0.6, D: (D1 + D2) / 2 },
    { x: L * 0.5, z: dz, D: D2 },
    { x: L * 0.7, z: dz * 0.6, D: (D1 + D2) / 2 },
    { x: L, z: 0, D: D1 },
  ];
}

/** Tinggi tekan uap pada suhu ductEnergy (15 °C). */
const UAP = vapourHead(15);

type Masuk = { Q: number; H: number; D1: number; D2: number; dz: number };
type F = (v: number, d: number) => string;

const de = (m: Masuk) => ductEnergy(m.Q / 1000, stasiunBernoulli(m.D1 / 1000, m.D2 / 1000, m.dz), m.H, 0);
const masuk = (m: Masuk): Masuk => ({ Q: m.Q, H: m.H, D1: m.D1, D2: m.D2, dz: m.dz });

/** Q (l/s, di kisi) yang memberi tinggi kecepatan leher sekitar hv sasaran. null bila di luar penggeser. */
function debitDari(hv: number, D2mm: number): number | null {
  const D = D2mm / 1000;
  const Q = Math.sqrt(2 * G * hv) * ((Math.PI * D * D) / 4) * 1000;
  if (Q < P_Q.min || Q > P_Q.max) return null;
  return bulatKeLangkah(Q, P_Q);
}

/** Tinggi tekan nol tidak ditulis "−0,000"; negatif ditulis berkurung dalam substitusi. */
const kurung = (v: number, d: number, f: F) => {
  const s = f(v, d);
  return v < 0 && s !== f(0, d) ? `(${s})` : s;
};

const teksPipa = (m: Masuk, f: F, l: "id" | "en") =>
  l === "id"
    ? `Saluran tanpa gesekan: Q = ${f(m.Q, 0)} l/s, tinggi energi di hulu H = ${f(m.H, 1)} m, diameter hulu D₁ = ${f(m.D1, 0)} mm, leher D₂ = ${f(m.D2, 0)} mm, sumbu leher naik Δz = ${f(m.dz, 1)} m.`
    : `Frictionless duct: Q = ${f(m.Q, 0)} l/s, upstream total head H = ${f(m.H, 1)} m, upstream diameter D₁ = ${f(m.D1, 0)} mm, throat D₂ = ${f(m.D2, 0)} mm, throat axis raised Δz = ${f(m.dz, 1)} m.`;

const langkahBi = (t: (f: F, l: "id" | "en") => LangkahKuis[]): Bi<LangkahKuis[]> => ({
  id: t((v, d) => fmtL(v, d, "id"), "id"),
  en: t((v, d) => fmtL(v, d, "en"), "en"),
});

/** Tiga langkah lembar: V, V²/2g, p/γ di leher. */
function langkahLeher(m: Masuk, f: F, l: "id" | "en"): LangkahKuis[] {
  const r = de(m);
  const p = r.points[2];
  return [
    {
      judul: l === "id" ? "Kecepatan di leher" : "Velocity at the throat",
      rumus: "V = Q / ( π · D₂² / 4 )",
      isi: `${f(m.Q / 1000, 3)} / ( π · ${f(m.D2 / 1000, 2)}² / 4 )`,
      hasil: f(p.velocity, 3),
      satuan: "m/s",
    },
    {
      judul: l === "id" ? "Tinggi kecepatan di leher" : "Velocity head at the throat",
      rumus: "V² / ( 2 · g )",
      isi: `${f(p.velocity, 4)}² / ( 2 · ${f(G, 2)} )`,
      hasil: f(p.velocityHead, 3),
      satuan: "m",
      tint: C.energy,
    },
    {
      judul: l === "id" ? "Tinggi tekan di leher" : "Pressure head at the throat",
      rumus: "p/γ = H − Δz − V²/2g",
      isi: `${f(m.H, 1)} − ${kurung(m.dz, 1, f)} − ${f(p.velocityHead, 4)}`,
      hasil: f(p.pressureHead, 3),
      satuan: "m",
      tint: C.water,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * B1 hitung: p/γ di leher
 * ------------------------------------------------------------------ */

function kasus1(r: () => number): Masuk | null {
  const D1 = acakKisi(r, P_D1, 150, 600);
  const D2 = acakKisi(r, P_D2, 60, 0.8 * D1 - 5);
  if (!(D2 < 0.8 * D1)) return null;
  const Q = debitDari(seragam(r, 0.25, 5), D2);
  if (Q === null) return null;
  const m = { Q, H: acakKisi(r, P_H, 8, 35), D1, D2, dz: acakKisi(r, P_DZ, 1, 10) };
  const hasil = de(m);
  if (hasil.cavitates || hasil.points[2].velocityHead < 0.2) return null;
  return m;
}

function soal1(benih: number): Soal {
  const m = cobaBenih(benih, 1, kasus1, () => ({ Q: 150, H: 20, D1: 400, D2: 180, dz: 2 }));
  const p = de(m).points[2];
  const kunci = p.pressureHead;
  const tol = Math.max(0.02, 0.01 * Math.abs(kunci));
  const hv = p.velocityHead;
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: kunci },
    [
      {
        // D dalam mm: kecepatan 10⁶ kali lebih kecil, tinggi kecepatan praktis nol.
        nilai: m.H - m.dz - hv * 1e-12,
        alasan: {
          id: "D₂ dipakai dalam mm tanpa diubah ke meter: kecepatannya jadi hampir nol, sehingga p/γ ≈ H − Δz.",
          en: "D₂ was used in mm without converting to metres: the velocity becomes almost zero, so p/γ ≈ H − Δz.",
        },
      },
      {
        nilai: m.H - m.dz - hv / 16,
        alasan: {
          id: "Pembagi 4 pada luas terlupa (A = π·D², bukan π·D²/4): kecepatan jadi empat kali lebih kecil dan V²/2g enam belas kali lebih kecil.",
          en: "The 4 in the area was dropped (A = π·D² instead of π·D²/4): the velocity comes out four times too small and V²/2g sixteen times too small.",
        },
      },
      {
        nilai: m.H - hv,
        alasan: {
          id: "Kenaikan sumbu Δz terlupa. Leher yang naik membayar elevasinya dari tinggi tekan: p/γ = H − Δz − V²/2g.",
          en: "The axis rise Δz was left out. A raised throat pays for its elevation out of pressure head: p/γ = H − Δz − V²/2g.",
        },
      },
      {
        nilai: m.H - m.dz - p.velocity / (2 * G),
        alasan: {
          id: "V belum dikuadratkan: tinggi kecepatan adalah V²/2g, bukan V/2g.",
          en: "V was not squared: velocity head is V²/2g, not V/2g.",
        },
      },
    ],
    { toleransi: tol, digits: 3 }
  );
  return {
    jenis: "hitung",
    id: "ff01-1",
    tanya: bi((f, l) =>
      l === "id" ? `${teksPipa(m, f, l)} Hitung tinggi tekan di leher p/γ.` : `${teksPipa(m, f, l)} Compute the pressure head at the throat p/γ.`
    ),
    kunci,
    toleransi: tol,
    digits: 3,
    satuan: { id: "m", en: "m" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `Tanpa gesekan H tetap di sepanjang saluran: z + p/γ + V²/2g = H. Di leher V²/2g = ${f(hv, 3)} m, jadi p/γ = ${f(m.H, 1)} − ${kurung(m.dz, 1, f)} − ${f(hv, 3)} = ${f(kunci, 3)} m. Lihat baris Tinggi tekan di leher di tabel hasil.`
        : `Without friction H is constant along the duct: z + p/γ + V²/2g = H. At the throat V²/2g = ${f(hv, 3)} m, so p/γ = ${f(m.H, 1)} − ${kurung(m.dz, 1, f)} − ${f(hv, 3)} = ${f(kunci, 3)} m. See the Pressure head at the throat row in the results.`
    ),
    langkah: langkahBi((f, l) => langkahLeher(m, f, l)),
    masukan: masuk(m),
  };
}

/* ------------------------------------------------------------------ *
 * B2 pilih: D₂ diperkecil, p/γ turun sebesar kenaikan V²/2g
 * ------------------------------------------------------------------ */

export type Kasus2 = { m: Masuk; D2a: number; turun: number };

function kasus2(r: () => number): Kasus2 | null {
  const D1 = acakKisi(r, P_D1, 200, 600);
  const D2a = acakKisi(r, P_D2, 100, 0.8 * D1);
  const D2b = D2a - 10 * bulatAcak(r, 2, 6);
  if (D2b < 60) return null;
  const Q = debitDari(seragam(r, 0.1, 1.5), D2a);
  if (Q === null) return null;
  const m = { Q, H: acakKisi(r, P_H, 10, 35), D1, D2: D2b, dz: acakKisi(r, P_DZ, 0, 6) };
  const ra = de({ ...m, D2: D2a });
  const rb = de(m);
  if (ra.cavitates || rb.cavitates) return null;
  const turun = ra.points[2].pressureHead - rb.points[2].pressureHead;
  if (turun < 0.05) return null;
  return { m, D2a, turun };
}

/** Kasus butir 2 untuk benih ini (diekspor untuk uji: D₂ sebelum diperkecil tidak ada di masukan). */
export function ff01Kasus2(benih: number): Kasus2 {
  return cobaBenih(benih, 2, kasus2, () => {
    const m = { Q: 150, H: 20, D1: 400, D2: 160, dz: 2 };
    const turun = de({ ...m, D2: 200 }).points[2].pressureHead - de(m).points[2].pressureHead;
    return { m, D2a: 200, turun };
  });
}

function soal2(benih: number): Soal {
  const k = ff01Kasus2(benih);
  const pa = de({ ...k.m, D2: k.D2a }).points[2];
  const pb = de(k.m).points[2];
  const salahD2 = pa.velocityHead * ((k.D2a / k.m.D2) ** 2 - 1);
  const pangkatDua = buangDuplikat({ nilai: k.turun }, [{ nilai: salahD2 }], { digits: 2 });
  const calon: Pilihan[] = [
    {
      id: "dhv",
      teks: bi((f, l) =>
        l === "id"
          ? `p/γ turun ${f(k.turun, 2)} m, sama dengan kenaikan V²/2g`
          : `p/γ falls by ${f(k.turun, 2)} m, equal to the rise in V²/2g`
      ),
    },
    ...pangkatDua.map((c) => ({
      id: "pangkat2",
      teks: bi((f, l) => (l === "id" ? `p/γ turun ${f(c.nilai!, 2)} m` : `p/γ falls by ${f(c.nilai!, 2)} m`)),
      alasan: bi((f, l) =>
        l === "id"
          ? `Ini memakai V²/2g sebanding 1/D². Kecepatan sebanding 1/D², jadi tinggi kecepatan sebanding 1/D⁴: naik dari ${f(pa.velocityHead, 3)} ke ${f(pb.velocityHead, 3)} m.`
          : `This takes V²/2g as proportional to 1/D². Velocity goes as 1/D², so velocity head goes as 1/D⁴: it rises from ${f(pa.velocityHead, 3)} to ${f(pb.velocityHead, 3)} m.`
      ),
    })),
    {
      id: "nol",
      teks: { id: "p/γ tidak berubah, karena H tetap", en: "p/γ does not change, because H stays the same" },
      alasan: bi((f, l) =>
        l === "id"
          ? `H memang tetap, tetapi pembagiannya berubah: V²/2g naik dari ${f(pa.velocityHead, 3)} ke ${f(pb.velocityHead, 3)} m, dan p/γ yang membayarnya.`
          : `H does stay the same, but its split changes: V²/2g rises from ${f(pa.velocityHead, 3)} to ${f(pb.velocityHead, 3)} m, and p/γ pays for it.`
      ),
    },
    {
      id: "gesek",
      teks: bi((f, l) =>
        l === "id"
          ? `p/γ turun lebih dari ${f(k.turun, 2)} m, karena leher yang lebih sempit menambah gesekan`
          : `p/γ falls by more than ${f(k.turun, 2)} m, because the narrower throat adds friction`
      ),
      alasan: {
        id: "Lembar ini tanpa gesekan (f = 0), jadi garis energinya datar. Penurunan p/γ tepat sebesar kenaikan V²/2g.",
        en: "This sheet is frictionless (f = 0), so the energy line is flat. The fall in p/γ equals the rise in V²/2g exactly.",
      },
    },
  ];
  const pilihan = kocok(prng(turunan(benih, 2, 99)), calon);
  return {
    jenis: "pilih",
    id: "ff01-2",
    tanya: bi((f, l) =>
      l === "id"
        ? `Saluran tanpa gesekan: Q = ${f(k.m.Q, 0)} l/s, H = ${f(k.m.H, 1)} m, D₁ = ${f(k.m.D1, 0)} mm, Δz = ${f(k.m.dz, 1)} m. Leher D₂ diperkecil dari ${f(k.D2a, 0)} mm menjadi ${f(k.m.D2, 0)} mm. Bagaimana tinggi tekan di leher p/γ berubah?`
        : `Frictionless duct: Q = ${f(k.m.Q, 0)} l/s, H = ${f(k.m.H, 1)} m, D₁ = ${f(k.m.D1, 0)} mm, Δz = ${f(k.m.dz, 1)} m. The throat D₂ is reduced from ${f(k.D2a, 0)} mm to ${f(k.m.D2, 0)} mm. How does the throat pressure head p/γ change?`
    ),
    pilihan,
    kunci: "dhv",
    bahas: bi((f, l) =>
      l === "id"
        ? `V²/2g sebanding 1/D₂⁴, naik dari ${f(pa.velocityHead, 3)} ke ${f(pb.velocityHead, 3)} m. H dan Δz tetap, jadi p/γ turun sebanyak itu: dari ${f(pa.pressureHead, 3)} ke ${f(pb.pressureHead, 3)} m. Lihat batang V²/2g dan p/γ di gambar.`
        : `V²/2g goes as 1/D₂⁴, rising from ${f(pa.velocityHead, 3)} to ${f(pb.velocityHead, 3)} m. H and Δz are unchanged, so p/γ falls by the same amount: from ${f(pa.pressureHead, 3)} to ${f(pb.pressureHead, 3)} m. See the V²/2g and p/γ bars in the drawing.`
    ),
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? `Tinggi kecepatan, D₂ = ${f(k.D2a, 0)} mm` : `Velocity head, D₂ = ${f(k.D2a, 0)} mm`,
        rumus: "V²/2g = ( Q / ( π · D₂² / 4 ) )² / ( 2 · g )",
        isi: `${f(pa.velocity, 4)}² / ( 2 · ${f(G, 2)} )`,
        hasil: f(pa.velocityHead, 3),
        satuan: "m",
        tint: C.energy,
      },
      {
        judul: l === "id" ? `Tinggi kecepatan, D₂ = ${f(k.m.D2, 0)} mm` : `Velocity head, D₂ = ${f(k.m.D2, 0)} mm`,
        rumus: "V²/2g = ( Q / ( π · D₂² / 4 ) )² / ( 2 · g )",
        isi: `${f(pb.velocity, 4)}² / ( 2 · ${f(G, 2)} )`,
        hasil: f(pb.velocityHead, 3),
        satuan: "m",
        tint: C.energy,
      },
      {
        judul: l === "id" ? "Penurunan tinggi tekan" : "Fall in pressure head",
        rumus: "Δ(p/γ) = Δ(V²/2g)",
        isi: `${f(pa.pressureHead, 4)} − ${f(pb.pressureHead, 4)}`,
        hasil: f(k.turun, 2),
        satuan: "m",
        tint: C.water,
      },
    ]),
    masukan: masuk(k.m),
  };
}

/* ------------------------------------------------------------------ *
 * B3 pilih: leher naik 1 m
 * ------------------------------------------------------------------ */

function kasus3(r: () => number): Masuk | null {
  const D1 = acakKisi(r, P_D1, 150, 600);
  const D2 = acakKisi(r, P_D2, 60, 0.8 * D1 - 5);
  if (!(D2 < 0.8 * D1)) return null;
  const Q = debitDari(seragam(r, 0.2, 3), D2);
  if (Q === null) return null;
  const m = { Q, H: acakKisi(r, P_H, 10, 35), D1, D2, dz: acakKisi(r, P_DZ, 0, 8) };
  if (de(m).cavitates || de({ ...m, dz: m.dz + 1 }).cavitates) return null;
  return m;
}

function soal3(benih: number): Soal {
  const m = cobaBenih(benih, 3, kasus3, () => ({ Q: 150, H: 20, D1: 400, D2: 180, dz: 2 }));
  const p0 = de(m).points[2];
  const p1 = de({ ...m, dz: m.dz + 1 }).points[2];
  const hvTetap = bi((f, l) =>
    l === "id"
      ? `Q dan D₂ tidak berubah, jadi V dan V²/2g = ${f(p0.velocityHead, 3)} m juga tetap. Hanya z yang naik 1 m, dan seluruhnya dibayar oleh p/γ.`
      : `Q and D₂ are unchanged, so V and V²/2g = ${f(p0.velocityHead, 3)} m stay the same. Only z rises by 1 m, and p/γ pays for all of it.`
  );
  const pilihan = kocok(prng(turunan(benih, 3, 99)), [
    { id: "tepat", teks: { id: "Turun tepat 1 m", en: "Falls by exactly 1 m" } },
    {
      id: "lebih",
      teks: { id: "Turun lebih dari 1 m, karena kecepatan di leher bertambah", en: "Falls by more than 1 m, because the throat velocity increases" },
      alasan: hvTetap,
    },
    {
      id: "kurang",
      teks: { id: "Turun kurang dari 1 m, karena sebagian ditanggung tinggi kecepatan", en: "Falls by less than 1 m, because the velocity head takes part of it" },
      alasan: hvTetap,
    },
    {
      id: "tetap",
      teks: { id: "Tidak berubah, karena tekanan hanya bergantung pada kecepatan", en: "Does not change, because pressure depends only on velocity" },
      alasan: {
        id: "z + p/γ + V²/2g = H. Bila z naik 1 m dan V tetap, p/γ harus turun 1 m.",
        en: "z + p/γ + V²/2g = H. If z rises 1 m and V stays the same, p/γ must fall 1 m.",
      },
    },
  ]);
  return {
    jenis: "pilih",
    id: "ff01-3",
    tanya: bi((f, l) =>
      l === "id"
        ? `${teksPipa(m, f, l)} Sumbu leher dinaikkan 1 m lagi (Δz = ${f(m.dz + 1, 1)} m) tanpa mengubah yang lain. Apa yang terjadi pada p/γ di leher?`
        : `${teksPipa(m, f, l)} The throat axis is raised another 1 m (Δz = ${f(m.dz + 1, 1)} m) with nothing else changed. What happens to p/γ at the throat?`
    ),
    pilihan,
    kunci: "tepat",
    bahas: bi((f, l) =>
      l === "id"
        ? `p/γ = H − Δz − V²/2g: dari ${f(p0.pressureHead, 3)} m menjadi ${f(p1.pressureHead, 3)} m, turun tepat 1 m, sementara garis energi tidak bergerak. Kartu keadaan lembar menyebut pertukaran yang sama.`
        : `p/γ = H − Δz − V²/2g: from ${f(p0.pressureHead, 3)} m to ${f(p1.pressureHead, 3)} m, exactly 1 m lower, while the energy line does not move. The state card describes the same exchange.`
    ),
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "Tinggi tekan di leher, sebelum dan sesudah" : "Throat pressure head, before and after",
        rumus: "p/γ = H − Δz − V²/2g",
        isi: `${f(m.H, 1)} − ${kurung(m.dz, 1, f)} − ${f(p0.velocityHead, 4)};  ${f(m.H, 1)} − ${kurung(m.dz + 1, 1, f)} − ${f(p1.velocityHead, 4)}`,
        hasil: `${f(p0.pressureHead, 3)} → ${f(p1.pressureHead, 3)}`,
        satuan: "m",
        tint: C.water,
      },
    ]),
    masukan: masuk(m),
  };
}

/* ------------------------------------------------------------------ *
 * B4 atur: Δz setinggi mungkin tanpa kavitasi
 * ------------------------------------------------------------------ */

/** Δz terbesar di kisi penggeser yang tidak berkavitasi, ditelusuri lewat ductEnergy. */
const dzAman = (m: Omit<Masuk, "dz">) => kisi(P_DZ).filter((dz) => !de({ ...m, dz }).cavitates);

function kasus4(r: () => number): (Masuk & { kunci: number }) | null {
  const D1 = acakKisi(r, P_D1, 200, 600);
  const D2 = acakKisi(r, P_D2, 60, 0.8 * D1);
  if (!(D2 <= 0.8 * D1)) return null;
  const Q = debitDari(seragam(r, 0.3, 6), D2);
  if (Q === null) return null;
  const dasar = { Q, H: acakKisi(r, P_H, 5, 30), D1, D2 };
  const aman = dzAman(dasar);
  if (aman.length < 2) return null;
  const kunci = aman[aman.length - 1];
  if (kunci < 0.5 || kunci > 24.5) return null;
  // Monoton: satu langkah di bawah kunci juga aman.
  if (de({ ...dasar, dz: kunci - 0.5 }).cavitates) return null;
  return { ...dasar, dz: keLangkah(Math.max(P_DZ.min, kunci - 3), P_DZ), kunci };
}

function soal4(benih: number): Soal {
  const s = cobaBenih(benih, 4, kasus4, () => {
    const dasar = { Q: 150, H: 10, D1: 400, D2: 180 };
    const aman = dzAman(dasar);
    const kunci = aman[aman.length - 1];
    return { ...dasar, dz: kunci - 3, kunci };
  });
  const p = de(s).points[2];
  const dzBatas = s.H - p.velocityHead + ATM_HEAD - UAP;
  return {
    jenis: "atur",
    id: "ff01-4",
    tanya: bi((f, l) =>
      l === "id"
        ? `Saluran tanpa gesekan: Q = ${f(s.Q, 0)} l/s, H = ${f(s.H, 1)} m, D₁ = ${f(s.D1, 0)} mm, D₂ = ${f(s.D2, 0)} mm dibiarkan tetap. Naikkan sumbu leher Δz setinggi mungkin tanpa membuat air di leher mendidih (kavitasi), lalu periksa. Langkah tertinggi yang aman dan satu langkah di bawahnya diterima.`
        : `Frictionless duct: Q = ${f(s.Q, 0)} l/s, H = ${f(s.H, 1)} m, D₁ = ${f(s.D1, 0)} mm, D₂ = ${f(s.D2, 0)} mm stay fixed. Raise the throat axis Δz as high as possible without the water at the throat boiling (cavitation), then check. The highest safe step and the one below it are accepted.`
    ),
    ukur: (k) => k.dz,
    simbol: "Δz",
    digits: 1,
    target: { min: s.kunci - 0.5, max: s.kunci },
    geser: { kunci: "dz", p: P_DZ },
    langkahMin: 2,
    siapkan: masuk(s),
    tetap: { Q: s.Q, H: s.H, D1: s.D1, D2: s.D2 },
    bahas: bi((f, l) =>
      l === "id"
        ? `Kavitasi mulai saat tekanan mutlak di leher turun ke tekanan uap ${f(UAP, 3)} m: H − Δz − V²/2g + ${f(ATM_HEAD, 2)} ≤ ${f(UAP, 3)}. Jadi Δz paling tinggi ${f(dzBatas, 2)} m, dan langkah penggeser tertinggi yang aman ${f(s.kunci, 1)} m. Pipa kehabisan tekanan, bukan kehabisan energi.`
        : `Cavitation starts when the absolute pressure at the throat falls to the vapour pressure ${f(UAP, 3)} m: H − Δz − V²/2g + ${f(ATM_HEAD, 2)} ≤ ${f(UAP, 3)}. So Δz can be at most ${f(dzBatas, 2)} m, and the highest safe slider step is ${f(s.kunci, 1)} m. The pipe runs out of pressure, not out of energy.`
    ),
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "Elevasi leher tertinggi sebelum kavitasi" : "Highest throat elevation before cavitation",
        rumus: "Δzmax = H − V²/2g + patm/γ − pv/γ",
        isi: `${f(s.H, 1)} − ${f(p.velocityHead, 3)} + ${f(ATM_HEAD, 2)} − ${f(UAP, 3)}`,
        hasil: f(dzBatas, 2),
        satuan: "m",
        tint: C.critical,
      },
    ]),
  };
}

export const FF01: BankKuis = {
  kode: "FF-01",
  jumlah: 4,
  buat: (benih) => [soal1(benih), soal2(benih), soal3(benih), soal4(benih)],
};
