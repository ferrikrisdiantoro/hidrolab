/**
 * Bank soal FF-05 Garis aliran (KUIS.md, termasuk revisi insinyur 1 November).
 *
 * Semua masukan jatuh di kisi penggeser lembar (U 0,2–8 m/s langkah 0,1;
 * V 0–4 m/s langkah 0,1; ω 0–4 rad/s langkah 0,05; t 0,5–20 s langkah 0,5),
 * dan semua kunci dihitung SESUDAH pembulatan itu lewat flowLines dengan
 * panjang gambar yang sama dengan lembar (garisLembar).
 *
 * Soal contoh: belum ditelaah dosen pengampu (KUIS.md baris 4).
 */

import { flowLines, type FlowLines } from "../../lib/hydraulics.ts";
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

/** Sama dengan InputRow lembar GarisAliranClient. */
export const P_U: ParamDef = { min: 0.2, max: 8, step: 0.1, digits: 1 };
export const P_V: ParamDef = { min: 0, max: 4, step: 0.1, digits: 1 };
export const P_W: ParamDef = { min: 0, max: 4, step: 0.05, digits: 2 };
export const P_T: ParamDef = { min: 0.5, max: 20, step: 0.5, digits: 1 };

/** Panjang gambar terpendek, m. */
export const SPAN = 10;
/** Panjang yang digambar lembar: mengikuti lintasan partikel, paling pendek SPAN. */
export const panjangGambar = (U: number, t: number) => Math.max(SPAN, U * t);
/** Panggilan flowLines yang sama persis dengan lembar. */
export const garisLembar = (k: Keadaan): FlowLines =>
  flowLines(k.U, k.V, k.w, k.t, panjangGambar(k.U, k.t));

type F = (v: number, d: number) => string;

const langkahBi = (t: (f: F, l: "id" | "en") => LangkahKuis[]): Bi<LangkahKuis[]> => ({
  id: t((v, d) => fmtL(v, d, "id"), "id"),
  en: t((v, d) => fmtL(v, d, "en"), "en"),
});

const teksSet = (m: Keadaan, f: F) =>
  `U = ${f(m.U, 1)} m/s, V = ${f(m.V, 1)} m/s, ω = ${f(m.w, 2)} rad/s, t = ${f(m.t, 1)} s`;

/** Pembulatan ke dua angka bermakna, untuk batas sasaran yang enak dibaca. */
const duaAngka = (v: number) => {
  if (!(v > 0)) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Number((Math.round(v / p) * p).toFixed(Math.max(0, -Math.round(Math.log10(p)))));
};

/* ------------------------------------------------------------------ *
 * B1 pilih: set mana yang tunak
 * ------------------------------------------------------------------ */

type PilihSet = Pilihan & { set: Keadaan };

function soal1(benih: number): Soal {
  const bangun = (r: () => number): { kunci: Keadaan; keliru: { set: Keadaan; jenis: string }[] } | null => {
    const U = acakKisi(r, P_U, 0.5, 6);
    const t = acakKisi(r, P_T, 2, 15);
    // Tunak lewat V = 0 atau lewat ω = 0, diundi sama sering.
    const kunci: Keadaan =
      r() < 0.5
        ? { U, V: 0, w: acakKisi(r, P_W, 0.5, 3), t }
        : { U, V: acakKisi(r, P_V, 0.8, 3), w: 0, t };
    const keliru = [
      // Ayunan sangat lambat: tetap tak tunak.
      { set: { U: acakKisi(r, P_U, 0.5, 6), V: acakKisi(r, P_V, 1, 4), w: acakKisi(r, P_W, 0.05, 0.3), t: acakKisi(r, P_T, 4, 20) }, jenis: "lambat" },
      // Simpangan tegak kecil: tetap tak tunak.
      { set: { U: acakKisi(r, P_U, 0.5, 3), V: acakKisi(r, P_V, 0.3, 0.8), w: acakKisi(r, P_W, 0.5, 2), t: acakKisi(r, P_T, 2, 15) }, jenis: "kecil" },
      { set: { U: acakKisi(r, P_U, 0.5, 6), V: acakKisi(r, P_V, 0.8, 3), w: acakKisi(r, P_W, 0.5, 3), t: acakKisi(r, P_T, 2, 15) }, jenis: "biasa" },
    ];
    if (keliru.some((k) => garisLembar(k.set).separation <= 0.2)) return null;
    const teks = [kunci, ...keliru.map((k) => k.set)].map((m) => teksSet(m, (v, d) => fmtL(v, d, "id")));
    if (new Set(teks).size !== teks.length) return null;
    return { kunci, keliru };
  };
  const s = cobaBenih(benih, 1, bangun, () => ({
    kunci: { U: 2, V: 0, w: 1, t: 5 },
    keliru: [
      { set: { U: 2, V: 1, w: 0.1, t: 8 }, jenis: "lambat" },
      { set: { U: 2, V: 0.5, w: 1, t: 5 }, jenis: "kecil" },
      { set: { U: 2, V: 1.5, w: 3, t: 12 }, jenis: "biasa" },
    ],
  }));

  const alasan = (m: Keadaan, jenis: string): Bi<string> =>
    bi((f, l) => {
      const d = f(garisLembar(m).separation, 2);
      if (l === "id") {
        const tambah =
          jenis === "lambat"
            ? " Ayunan selambat apa pun tetap mengubah medan terhadap waktu."
            : jenis === "kecil"
              ? " Simpangan tegak sekecil apa pun tetap mengubah medan terhadap waktu."
              : "";
        return `V dan ω sama-sama bukan nol, jadi v = V cos ωt berubah terhadap waktu dan garis arus terpisah ${d} m dari lintasan.${tambah}`;
      }
      const tambah =
        jenis === "lambat"
          ? " However slow the oscillation, the field still changes with time."
          : jenis === "kecil"
            ? " However small the vertical amplitude, the field still changes with time."
            : "";
      return `V and ω are both non-zero, so v = V cos ωt changes with time and the streamline stands ${d} m from the pathline.${tambah}`;
    });

  const r = prng(turunan(benih, 1, 99));
  const urut = kocok(r, [
    { set: s.kunci, benar: true, jenis: "" },
    ...s.keliru.map((k) => ({ set: k.set, benar: false, jenis: k.jenis })),
  ]);
  const pilihan: PilihSet[] = urut.map((u, i) => {
    const p: PilihSet = {
      id: "abcd"[i],
      teks: bi((f) => teksSet(u.set, f)),
      set: u.set,
    };
    if (!u.benar) p.alasan = alasan(u.set, u.jenis);
    return p;
  });
  const kunci = pilihan[urut.findIndex((u) => u.benar)].id;
  const sebab = s.kunci.V === 0 ? "V" : "ω";

  return {
    jenis: "pilih",
    id: "ff05-1",
    tanya: {
      id: "Medan kecepatannya u = U, v = V cos ωt. Pada set mana garis arus, lintasan partikel, dan garis jejak berimpit?",
      en: "The velocity field is u = U, v = V cos ωt. For which set do the streamline, the pathline and the streakline coincide?",
    },
    pilihan,
    kunci,
    bahas: {
      id: `Ketiganya berimpit hanya bila medannya tidak berubah terhadap waktu, yaitu V = 0 atau ω = 0. Pada set yang tepat ${sebab} = 0. Lihat judul gambar dan Δ = 0 di kop sesudah set itu dipasang.`,
      en: `The three coincide only when the field does not change with time, that is V = 0 or ω = 0. In the right set ${sebab} = 0. See the drawing heading and Δ = 0 in the title block once that set is applied.`,
    },
    masukan: s.kunci,
  };
}

/* ------------------------------------------------------------------ *
 * B2 hitung: kemiringan garis arus pada saat t
 * ------------------------------------------------------------------ */

const tolMiring = (m: number) => Math.max(0.01, 0.02 * Math.abs(m));

function soal2(benih: number): Soal {
  const m = cobaBenih<Keadaan>(
    benih,
    2,
    (r) => {
      const k = {
        U: acakKisi(r, P_U, 0.5, 8),
        V: acakKisi(r, P_V, 0.5, 4),
        w: acakKisi(r, P_W, 0.1, 4),
        t: acakKisi(r, P_T, 0.5, 20),
      };
      return Math.abs(Math.cos(k.w * k.t)) > 0.2 ? k : null;
    },
    () => ({ U: 2, V: 1, w: 0.5, t: 8 })
  );
  const c = Math.cos(m.w * m.t);
  const kunci = (m.V * c) / m.U;
  const tol = tolMiring(kunci);
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: kunci },
    [
      {
        nilai: (m.V * Math.sin(m.w * m.t)) / m.U,
        alasan: {
          id: "Ini memakai sin ωt. Komponen tegak medannya v = V cos ωt, jadi kosinus yang dipakai.",
          en: "This uses sin ωt. The vertical component is v = V cos ωt, so take the cosine.",
        },
      },
      {
        nilai: (m.V * Math.cos(m.t)) / m.U,
        alasan: {
          id: "Ini memakai cos t, ω terlupa. Sudutnya ωt, dalam radian.",
          en: "This uses cos t, ω was left out. The angle is ωt, in radians.",
        },
      },
      {
        nilai: (m.V * Math.cos((m.w * m.t * Math.PI) / 180)) / m.U,
        alasan: {
          id: "Ini hasil kalkulator dalam mode derajat. ωt bersatuan radian.",
          en: "This is a calculator set to degrees. ωt is in radians.",
        },
      },
    ],
    { toleransi: tol, digits: 3 }
  );
  const vt = m.V * c;
  return {
    jenis: "hitung",
    id: "ff05-2",
    tanya: bi((f, l) =>
      l === "id"
        ? `Medan u = U, v = V cos ωt dengan ${teksSet(m, f)}. Hitung kemiringan garis arus dy/dx pada saat t.`
        : `Field u = U, v = V cos ωt with ${teksSet(m, f)}. Compute the streamline slope dy/dx at time t.`
    ),
    kunci,
    toleransi: tol,
    digits: 3,
    satuan: { id: "m/m", en: "m/m" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `Garis arus pada saat t searah kecepatan saat itu: dy/dx = v(t)/U = V cos ωt / U = ${f(kunci, 3)}, dengan ωt = ${f(m.w * m.t, 2)} rad. Lihat baris Kemiringan garis arus di tabel hasil.`
        : `At time t the streamline follows the velocity of that instant: dy/dx = v(t)/U = V cos ωt / U = ${f(kunci, 3)}, with ωt = ${f(m.w * m.t, 2)} rad. See the Slope of the streamline row in the results.`
    ),
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "Kecepatan tegak pada saat t" : "Vertical velocity at time t",
        rumus: "v(t) = V · cos ωt",
        isi: `${f(m.V, 1)} · cos( ${f(m.w, 2)} · ${f(m.t, 1)} )`,
        hasil: f(vt, 4),
        satuan: "m/s",
      },
      {
        judul: l === "id" ? "Kemiringan garis arus" : "Streamline slope",
        rumus: "dy/dx = v(t) / U",
        isi: `${f(vt, 4)} / ${f(m.U, 1)}`,
        hasil: f(kunci, 3),
        tint: C.critical,
      },
    ]),
    masukan: m,
  };
}

/* ------------------------------------------------------------------ *
 * B3 hitung: simpangan terbesar lintasan partikel
 * ------------------------------------------------------------------ */

/** Simpangan terbesar yang dicapai lintasan sampai saat t, sama dengan baris A di lembar. */
export const simpanganLintasan = (k: Keadaan) =>
  Math.max(0, ...garisLembar(k).pathline.map((p) => Math.abs(p.y)));

function soal3(benih: number): Soal {
  const m = cobaBenih<Keadaan>(
    benih,
    3,
    (r) => {
      const w = acakKisi(r, P_W, 0.25, 4);
      // t ≥ π/(2ω): puncak sinus sudah dicapai. ωt ≤ 30: 160 titik lintasan
      // cukup rapat sehingga puncak hasil lib berbeda < 0,5 % dari V/ω.
      const lo = Math.PI / (2 * w);
      const hi = Math.min(P_T.max, 30 / w);
      if (!(lo <= hi)) return null;
      const k = { U: acakKisi(r, P_U, 0.5, 6), V: acakKisi(r, P_V, 0.5, 4), w, t: acakKisi(r, P_T, lo, hi) };
      if (k.t < lo) return null;
      const A = simpanganLintasan(k);
      return Math.abs(A - k.V / k.w) / (k.V / k.w) < 0.005 ? k : null;
    },
    () => ({ U: 2, V: 1, w: 0.5, t: 8 })
  );
  const kunci = simpanganLintasan(m);
  const tol = 0.02 * kunci;
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: kunci },
    [
      {
        nilai: m.V * m.w,
        alasan: {
          id: "Ini V·ω. Lintasannya y = (V/ω) sin ωτ: V dibagi ω, karena simpangan adalah integral kecepatan terhadap waktu.",
          en: "This is V·ω. The pathline is y = (V/ω) sin ωτ: V is divided by ω, since the excursion is the time integral of the velocity.",
        },
      },
      {
        nilai: (2 * m.V) / m.w,
        alasan: {
          id: "Ini 2V/ω, jarak puncak ke lembah. Yang ditanya simpangan dari sumbu, yaitu V/ω.",
          en: "This is 2V/ω, crest to trough. The question asks for the excursion from the axis, V/ω.",
        },
      },
    ],
    { toleransi: tol, digits: 3 }
  );
  return {
    jenis: "hitung",
    id: "ff05-3",
    tanya: bi((f, l) =>
      l === "id"
        ? `Medan u = U, v = V cos ωt dengan ${teksSet(m, f)}. Sebuah partikel dilepas di titik asal pada t = 0. Hitung simpangan tegak terbesar lintasannya sampai saat t.`
        : `Field u = U, v = V cos ωt with ${teksSet(m, f)}. A particle is released at the origin at t = 0. Compute the largest vertical excursion of its pathline up to time t.`
    ),
    kunci,
    toleransi: tol,
    digits: 3,
    satuan: { id: "m", en: "m" },
    kesalahan,
    bahas: bi((f, l) =>
      l === "id"
        ? `Lintasannya y = (V/ω) sin ωτ. Karena ωt = ${f(m.w * m.t, 2)} ≥ π/2, puncak sinus sudah dicapai, jadi A = V/ω = ${f(kunci, 3)} m. Lihat baris Simpangan terbesar lintasan partikel di tabel hasil.`
        : `The pathline is y = (V/ω) sin ωτ. Since ωt = ${f(m.w * m.t, 2)} ≥ π/2 the sine has peaked, so A = V/ω = ${f(kunci, 3)} m. See the Largest excursion of the pathline row in the results.`
    ),
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "Puncak sudah dicapai?" : "Has the peak been reached?",
        rumus: "ω · t ≥ π / 2",
        isi: `${f(m.w, 2)} · ${f(m.t, 1)} = ${f(m.w * m.t, 2)} ≥ ${f(Math.PI / 2, 2)}`,
        hasil: l === "id" ? "ya" : "yes",
      },
      {
        judul: l === "id" ? "Simpangan terbesar lintasan" : "Largest pathline excursion",
        rumus: "A = V / ω",
        isi: `${f(m.V, 1)} / ${f(m.w, 2)}`,
        hasil: f(kunci, 3),
        satuan: "m",
        tint: C.water,
      },
    ]),
    masukan: m,
  };
}

/* ------------------------------------------------------------------ *
 * B4 atur: ω sampai Δ di pita sasaran (seluruh kisi ω ditelusuri)
 * ------------------------------------------------------------------ */

export const pisahLembar = (k: Keadaan) => garisLembar(k).separation;

/** Rentang bersambung dari nilai kisi yang lolos, untuk langkah pembahasan. */
function rentangKisi(xs: number[], step: number): [number, number][] {
  const out: [number, number][] = [];
  for (const v of xs) {
    const akhir = out[out.length - 1];
    if (akhir && Math.abs(v - akhir[1] - step) < step * 1e-6) akhir[1] = v;
    else out.push([v, v]);
  }
  return out;
}

function soal4(benih: number): Soal {
  type Siap = { U: number; V: number; t: number; min: number; max: number; lolos: number[] };
  const s = cobaBenih<Siap | null>(
    benih,
    4,
    (r) => {
      const U = acakKisi(r, P_U, 0.5, 4);
      const V = acakKisi(r, P_V, 0.5, 3);
      const t = acakKisi(r, P_T, 3, 12);
      const w0 = acakKisi(r, P_W, 0.2, 3);
      const s0 = pisahLembar({ U, V, w: w0, t });
      if (s0 < 0.2) return null;
      const min = duaAngka(s0 * 0.9);
      const max = duaAngka(s0 * 1.1);
      if (!(min > 0 && max > min)) return null;
      // Δ tidak monoton terhadap ω: seluruh kisi ditelusuri.
      const lolos = kisi(P_W).filter((w) => {
        const d = pisahLembar({ U, V, w, t });
        return d >= min && d <= max;
      });
      return lolos.length >= 3 ? { U, V, t, min, max, lolos } : null;
    },
    () => null
  ) ?? (() => {
    const U = 2, V = 1, t = 8, min = 1, max = 1.2;
    const lolos = kisi(P_W).filter((w) => {
      const d = pisahLembar({ U, V, w, t });
      return d >= min && d <= max;
    });
    return { U, V, t, min, max, lolos };
  })();

  const run = rentangKisi(s.lolos, P_W.step);
  const tulisRun = (f: F) => run.map(([a, b]) => (a === b ? f(a, 2) : `${f(a, 2)}–${f(b, 2)}`)).join("; ");
  const ftk = (v: number, l: "id" | "en") => v.toLocaleString(l === "en" ? "en-US" : "id-ID", { maximumFractionDigits: 3 });

  return {
    jenis: "atur",
    id: "ff05-4",
    tanya: bi((f, l) =>
      l === "id"
        ? `U = ${f(s.U, 1)} m/s, V = ${f(s.V, 1)} m/s, dan t = ${f(s.t, 1)} s dibiarkan tetap; ω dimulai dari 0 (tunak). Atur ω sampai jarak terjauh garis arus terhadap lintasan Δ berada di antara ${ftk(s.min, l)} dan ${ftk(s.max, l)} m, lalu periksa.`
        : `U = ${f(s.U, 1)} m/s, V = ${f(s.V, 1)} m/s and t = ${f(s.t, 1)} s stay fixed; ω starts at 0 (steady). Adjust ω until the greatest gap Δ between streamline and pathline lies between ${ftk(s.min, l)} and ${ftk(s.max, l)} m, then check.`
    ),
    ukur: pisahLembar,
    simbol: "Δ",
    digits: 3,
    target: { min: s.min, max: s.max },
    geser: { kunci: "w", p: P_W },
    siapkan: { U: s.U, V: s.V, w: 0, t: s.t },
    tetap: { U: s.U, V: s.V, t: s.t },
    bahas: bi((f, l) =>
      l === "id"
        ? `Δ tidak naik terus bersama ω: pada ω kecil lintasannya hampir mengikuti garis arus, pada ω besar simpangannya V/ω mengecil lagi. Karena itu ${run.length > 1 ? "lebih dari satu rentang ω memenuhi" : "rentang ω yang memenuhi bisa terletak di tengah kisi"}, dan semuanya diterima. Lihat baris Δ di tabel hasil dan kop.`
        : `Δ does not keep growing with ω: at small ω the pathline nearly follows the streamline, at large ω its excursion V/ω shrinks again. So ${run.length > 1 ? "more than one range of ω works" : "the working range of ω may sit inside the grid"}, and all of them are accepted. See the Δ row in the results and the title block.`
    ),
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "Nilai ω di kisi penggeser yang memenuhi" : "Slider values of ω that work",
        rumus: `${ftk(s.min, l)} ≤ Δ(ω) ≤ ${ftk(s.max, l)}`,
        isi: l === "id" ? "ω = 0 sampai 4 rad/s, langkah 0,05, lewat flowLines" : "ω = 0 to 4 rad/s, step 0.05, through flowLines",
        hasil: tulisRun(f),
        satuan: "rad/s",
        tint: C.critical,
      },
    ]),
  };
}

/* ------------------------------------------------------------------ *
 * B5 tebak: zat warna dari satu titik = garis jejak
 * ------------------------------------------------------------------ */

function soal5(benih: number): Soal {
  const m = cobaBenih<Keadaan>(
    benih,
    5,
    (r) => {
      const k = {
        U: acakKisi(r, P_U, 1, 4),
        V: acakKisi(r, P_V, 0.8, 3),
        w: acakKisi(r, P_W, 0.3, 2),
        t: acakKisi(r, P_T, 4, 16),
      };
      const g = garisLembar(k);
      if (g.steady || g.separation <= 0.3) return null;
      const n = g.pathline.length - 1;
      const beda = Math.max(...g.pathline.map((p, j) => Math.abs(p.y - g.streakline[n - j].y)));
      const puncak = Math.max(...[...g.streamline, ...g.pathline, ...g.streakline].map((p) => Math.abs(p.y)));
      // Beda terlihat di gambar: ≥ 25 % tinggi bingkai separuh.
      return beda > 0.3 && beda > 0.25 * puncak ? k : null;
    },
    () => ({ U: 2, V: 1.5, w: 0.5, t: 8 })
  );
  const d = garisLembar(m).separation;
  const r = prng(turunan(benih, 5, 99));
  const pilihan: Pilihan[] = kocok(r, [
    {
      id: "arus",
      teks: { id: "Garis lurus ungu dari titik lepas", en: "The straight purple line from the release point" },
      alasan: {
        id: "Itu garis arus. Ia milik satu saat: arah kecepatan pada saat t di seluruh ruang, bukan tempat zat warna berada.",
        en: "That is the streamline. It belongs to one instant: the direction of the velocity at time t everywhere, not where the dye is.",
      },
    },
    {
      id: "lintasan",
      teks: { id: "Kurva biru", en: "The blue curve" },
      alasan: {
        id: "Itu lintasan partikel: jejak SATU butir yang dilepas pada t = 0. Zat warna yang diteteskan terus terdiri atas banyak butir yang berangkat pada saat berbeda.",
        en: "That is the pathline: the track of ONE grain released at t = 0. Dye released continuously is made of many grains that set off at different times.",
      },
    },
    {
      id: "jejak",
      teks: { id: "Kurva merah bata", en: "The brick-red curve" },
    },
    {
      id: "semua",
      teks: { id: "Ketiganya, karena semuanya berangkat dari titik lepas", en: "All three, since they all start at the release point" },
      alasan: bi((f, l) =>
        l === "id"
          ? `Ketiganya berimpit hanya pada aliran tunak. Di sini V dan ω bukan nol, dan garis arus terpisah ${f(d, 2)} m dari lintasan.`
          : `The three coincide only in steady flow. Here V and ω are non-zero, and the streamline stands ${f(d, 2)} m from the pathline.`
      ),
    },
  ]);
  return {
    jenis: "tebak",
    id: "ff05-5",
    tanya: bi((f, l) =>
      l === "id"
        ? `Masukan soal ini sudah dipasang di lembar (${teksSet(m, f)}) dan nama ketiga garis disembunyikan. Zat warna diteteskan terus-menerus dari titik lepas sejak t = 0. Garis mana di gambar yang dibentuk zat warna itu pada saat t?`
        : `This question's inputs are set on the sheet (${teksSet(m, f)}) and the names of the three lines are hidden. Dye is released continuously from the release point from t = 0. Which line in the drawing does that dye form at time t?`
    ),
    pilihan,
    kunci: "jejak",
    bahas: {
      id: "Zat warna yang diteteskan terus dari satu titik membentuk garis jejak: tempat kedudukan semua butir yang pernah lewat titik itu. Pada aliran tak tunak garis jejak bukan garis arus, jadi foto zat warna dibaca sebagai garis jejak. Nama ketiga garis kini tampil lagi di gambar.",
      en: "Dye released continuously from one point forms the streakline: where all the grains that once passed that point are now. In unsteady flow the streakline is not a streamline, so a dye photograph reads as a streakline. The names of the three lines are shown on the drawing again.",
    },
    masukan: m,
  };
}

export const FF05: BankKuis = {
  kode: "FF-05",
  jumlah: 5,
  buat: (benih) => [soal1(benih), soal2(benih), soal3(benih), soal4(benih), soal5(benih)],
};
