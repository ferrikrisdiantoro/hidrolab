/**
 * Bank soal HY-04 Lengkung debit (KUIS.md putaran 2, termasuk revisi
 * insinyur 1 November).
 *
 * Tiap soal membawa tabelnya sendiri: 8–12 pasangan dari
 * Q = a (H − h0)^b (a 2–6, b 1,5–2,5, h0 −0,1–0,15 m) dengan derau relatif
 * 2–5 %, H dibulatkan ke 0,01 m dan Q ke 0,001 m³/s. Kunci dihitung pada
 * data yang SUDAH dibulatkan, yaitu data yang masuk tabel lembar lewat
 * "Muat data soal", dengan fitRating/ratingValue yang sama dengan lembar.
 * Kurva sebenarnya hanya dipakai butir 3.
 *
 * H yang dibaca jatuh di kisi penggeser lembar: 0 sampai 1,5·hDataMax
 * (dibulatkan ke atas ke sentimeter), langkah 0,01.
 *
 * Zona terbatas (hMax < H ≤ 1,2·hMax) adalah batas pilihan lembar ini, bukan
 * angka dari standar; zonaBaca dipakai bersama oleh lembar dan butir 4.
 *
 * Soal contoh: belum ditelaah dosen pengampu (KUIS.md baris 4).
 */

import { fitRating, ratingValue, type Pt, type RatingFit, type RatingKind } from "../../lib/discharge.ts";
import { C } from "../../lib/theme.ts";
import type { ParamDef } from "../../lib/rentang.ts";
import {
  acakKisi,
  bi,
  bulatAcak,
  buangDuplikat,
  cobaBenih,
  dataBerderau,
  fmtL,
  lengkungPangkat,
  prng,
  seragam,
  turunan,
  xAcak,
  type BankKuis,
  type Bi,
  type Kesalahan,
  type LangkahKuis,
  type Pilihan,
  type Soal,
} from "../../lib/kuis.ts";
import { bulat, dataCocok, denganData, sidikData } from "./dataSoal.ts";

/** Urutan bentuk sama dengan PresetRow lembar (KINDS). */
export const BENTUK: RatingKind[] = ["pangkat", "pangkat-h0", "polinomial"];

/** Ujung atas penggeser H lembar: 1,5·hDataMax dibulatkan ke atas ke sentimeter. */
export const maksPenggeserH = (hDataMax: number) =>
  Math.ceil(Math.max(0.1, hDataMax * 1.5) * 100 - 1e-9) / 100;

/** Sama dengan InputRow H lembar LengkungDebitClient. */
export const pH = (hDataMax: number): ParamDef => ({
  min: 0,
  max: Number(maksPenggeserH(hDataMax).toFixed(2)),
  step: 0.01,
  digits: 2,
});

/** Batas atas zona terbatas, kelipatan hMax. Batas pilihan lembar ini. */
export const BATAS_TERBATAS = 1.2;

export type Zona = "bawah" | "dalam" | "terbatas" | "jauh";

/** Zona H yang dibaca; dipakai lembar (pita, kartu keadaan) dan butir 4. */
export function zonaBaca(H: number, r: RatingFit | null): Zona {
  if (!r) return "jauh";
  if (H < r.hMin) return "bawah";
  if (H <= r.hMax) return "dalam";
  if (H <= BATAS_TERBATAS * r.hMax) return "terbatas";
  return "jauh";
}

type F = (v: number, d: number) => string;
type L = "id" | "en";
const langkahBi = (t: (f: F, l: L) => LangkahKuis[]): Bi<LangkahKuis[]> => ({
  id: t((v, d) => fmtL(v, d, "id"), "id"),
  en: t((v, d) => fmtL(v, d, "en"), "en"),
});

type Lengkung = { a: number; b: number; h0: number; derau: number; pts: Pt[] };

/**
 * Data soal: n pasangan, H di [max(0,1; h0 + 0,1), hi] berkisi 0,01,
 * Q berderau dan dibulatkan ke 0,001. Null bila ada Q < 0,01 setelah bulat.
 */
function bangunData(r: () => number, hiMin = 0.8): Lengkung | null {
  const a = bulat(seragam(r, 2, 6), 2);
  const b = bulat(seragam(r, 1.5, 2.5), 2);
  const h0 = bulat(seragam(r, -0.1, 0.15), 3);
  const derau = bulat(seragam(r, 0.02, 0.05), 3);
  const n = bulatAcak(r, 8, 12);
  const lo = Math.ceil(Math.max(0.1, h0 + 0.1) * 100) / 100;
  const hi = seragam(r, Math.max(hiMin, lo + 0.5), 2.5);
  const xs = xAcak(r, n, lo, hi, 0.01);
  if (xs.length !== n) return null;
  const pts = dataBerderau(r, xs, lengkungPangkat(a, b, h0), derau).map((p) => ({ x: p.x, y: bulat(p.y, 3) }));
  if (pts.some((p) => p.y < 0.01)) return null;
  return { a, b, h0, derau, pts };
}

const hMaxData = (pts: Pt[]) => Math.max(...pts.map((p) => p.x));

/** Angka yang disisipkan sesudah tanda kurang: negatif ditulis dalam kurung. */
const sisip = (v: number, d: number, f: F) => (v < 0 ? `( ${f(v, d)} )` : f(v, d));

/** "H − H0" dengan tanda yang terbaca: H + 0,05 bila H0 = −0,05. */
const hMinH0 = (h0: number, f: F) => (h0 < 0 ? `H + ${f(-h0, 3)}` : `H − ${f(h0, 3)}`);

/** Kalimat pembuka yang sama untuk semua butir. */
const pembuka = (pts: Pt[], f: F, l: L) =>
  l === "id"
    ? `Tekan Muat data soal untuk memasukkan ${pts.length} pasangan H–Q soal ini ke tabel lembar (H ${f(Math.min(...pts.map((p) => p.x)), 2)} sampai ${f(hMaxData(pts), 2)} m).`
    : `Press Load question data to put this question's ${pts.length} H–Q pairs into the sheet's table (H ${f(Math.min(...pts.map((p) => p.x)), 2)} to ${f(hMaxData(pts), 2)} m).`;

const langkahPangkat = (r: RatingFit, H: number, f: F, l: L, warna: string): LangkahKuis[] => [
  ...(r.kind === "pangkat-h0"
    ? [
        {
          judul: l === "id" ? "Tinggi aliran nol dari pencarian emas" : "Zero-flow stage from golden-section search",
          rumus: "H0 = arg min Σ( ln Q − ln Q̂ )²",
          isi: `${f(r.hMin - 2 * (r.hMax - r.hMin), 2)} ≤ H0 < ${f(r.hMin, 2)}`,
          hasil: f(r.h0, 3),
          satuan: "m",
          tint: C.critical,
        },
      ]
    : []),
  {
    judul: l === "id" ? `Kuadrat terkecil ruang logaritma, n = ${r.n}` : `Least squares in log space, n = ${r.n}`,
    rumus: "b = Sxy / Sxx;  a = exp( ȳ − b · x̄ )",
    isi: r.kind === "pangkat-h0" ? "x = ln( H − H0 ), y = ln Q" : "x = ln H, y = ln Q",
    hasil: `a = ${f(r.a, 4)};  b = ${f(r.b, 4)}`,
    tint: C.water,
  },
  {
    judul: l === "id" ? `Debit pada H = ${f(H, 2)} m` : `Discharge at H = ${f(H, 2)} m`,
    rumus: r.kind === "pangkat-h0" ? "Q = a · ( H − H0 )^b" : "Q = a · H^b",
    isi:
      r.kind === "pangkat-h0"
        ? `${f(r.a, 4)} · ( ${f(H, 2)} − ${sisip(r.h0, 3, f)} )^${f(r.b, 4)}`
        : `${f(r.a, 4)} · ${f(H, 2)}^${f(r.b, 4)}`,
    hasil: f(ratingValue(r, H), 3),
    satuan: "m³/s",
    tint: warna,
  },
];

/** Cari dengan benih turunan; bila 400 percobaan gagal, telusuri benih tetap sampai ketemu. */
function cari<T>(benih: number, butir: number, bangun: (r: () => number) => T | null): T {
  return cobaBenih(benih, butir, bangun, () => {
    for (let i = 0; ; i++) {
      const v = bangun(prng(turunan(0x4804, butir, i)));
      if (v !== null) return v;
    }
  }, 400);
}

/* ------------------------------------------------------------------ *
 * B1 hitung: Q bentuk pangkat pada H di dalam data
 * ------------------------------------------------------------------ */

function interpolasi(pts: Pt[], H: number): number {
  const u = pts.slice().sort((p, q) => p.x - q.x);
  for (let i = 1; i < u.length; i++)
    if (H <= u[i].x) return u[i - 1].y + ((u[i].y - u[i - 1].y) * (H - u[i - 1].x)) / (u[i].x - u[i - 1].x);
  return u[u.length - 1].y;
}

function soal1(benih: number): Soal {
  const s = cari(benih, 1, (r) => {
    const d = bangunData(r);
    if (!d) return null;
    const f = fitRating(d.pts, "pangkat");
    if (!f) return null;
    const span = f.hMax - f.hMin;
    const H = acakKisi(r, pH(f.hMax), f.hMin + 0.15 * span, f.hMax - 0.1 * span);
    if (d.pts.some((p) => Math.abs(p.x - H) < 1e-9)) return null;
    const Q = ratingValue(f, H);
    return Q >= 0.2 ? { d, f, H, Q } : null;
  });
  const { d, f, H, Q } = s;
  const fh0 = fitRating(d.pts, "pangkat-h0")!;
  const tol = 0.01 * Q;
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: Q },
    [
      {
        nilai: interpolasi(d.pts, H),
        alasan: {
          id: "Ini interpolasi garis lurus antara dua pasangan terdekat. Soal meminta Q dari lengkung yang dicocokkan ke SEMUA pasangan; titik ukur sendiri membawa derau.",
          en: "This is straight-line interpolation between the two nearest pairs. The question asks for Q from the curve fitted to ALL pairs; each measured point carries noise.",
        },
      },
      {
        nilai: ratingValue(fh0, H),
        alasan: {
          id: "Ini bentuk dengan tinggi aliran nol, Q = a·(H − H0)^b. Soal meminta bentuk pangkat biasa Q = a·H^b.",
          en: "This is the zero-flow form, Q = a·(H − H0)^b. The question asks for the plain power form Q = a·H^b.",
        },
      },
    ],
    { toleransi: tol, digits: 3 }
  );
  const q: Soal = {
    jenis: "hitung",
    id: "hy04-1",
    tanya: bi((f2, l) =>
      l === "id"
        ? `${pembuka(d.pts, f2, l)} Cocokkan bentuk pangkat Q = a·H^b, lalu hitung debit pada H = ${f2(H, 2)} m.`
        : `${pembuka(d.pts, f2, l)} Fit the power form Q = a·H^b, then compute the discharge at H = ${f2(H, 2)} m.`
    ),
    kunci: Q,
    toleransi: tol,
    digits: 3,
    satuan: { id: "m³/s", en: "m³/s" },
    kesalahan,
    bahas: bi((f2, l) =>
      l === "id"
        ? `Kuadrat terkecil di ruang logaritma memberi a = ${f2(f.a, 4)} dan b = ${f2(f.b, 4)}, jadi Q(${f2(H, 2)}) = ${f2(Q, 3)} m³/s. H ini di dalam data ukur, jadi hasilnya interpolasi lengkung, bukan ekstrapolasi. Lihat baris Debit pada H yang dibaca di tabel hasil.`
        : `Least squares in log space gives a = ${f2(f.a, 4)} and b = ${f2(f.b, 4)}, so Q(${f2(H, 2)}) = ${f2(Q, 3)} m³/s. This H lies within the measured data, so the result is read off the curve, not extrapolated. See the Discharge at the stage read row in the results.`
    ),
    langkah: langkahBi((f2, l) => langkahPangkat(f, H, f2, l, C.water)),
    masukan: { H, bentuk: 0, deg: 2, data: sidikData(d.pts) },
  };
  return denganData(q, d.pts);
}

/* ------------------------------------------------------------------ *
 * B2 tebak: polinomial lawan pangkat di luar data
 * ------------------------------------------------------------------ */

/** Polinomial berbalik turun atau negatif di antara hMax dan Hx (200 irisan). */
function turunDiLuar(po: RatingFit, hMax: number, Hx: number): boolean {
  if (ratingValue(po, Hx) < 0) return true;
  for (let k = 0; k <= 200; k++) {
    const h1 = hMax + ((Hx - hMax) * k) / 200;
    const h2 = hMax + ((Hx - hMax) * (k + 1)) / 200;
    if (ratingValue(po, h2) < ratingValue(po, h1)) return true;
  }
  return false;
}

function soal2(benih: number): Soal {
  const s = cari(benih, 2, (r) => {
    const d = bangunData(r);
    if (!d) return null;
    const deg = bulatAcak(r, 2, 4);
    const pk = fitRating(d.pts, "pangkat");
    const po = fitRating(d.pts, "polinomial", deg);
    if (!pk || !po || pk.r2 <= 0.99 || po.r2 <= 0.99) return null;
    const P = pH(pk.hMax);
    const Hx = acakKisi(r, P, 1.3 * pk.hMax, Math.min(1.5 * pk.hMax, P.max));
    if (Hx < 1.3 * pk.hMax - 1e-9 || Hx > 1.5 * pk.hMax + 1e-9) return null;
    const qPk = ratingValue(pk, Hx);
    const qPo = ratingValue(po, Hx);
    if (!(Math.abs(qPo - qPk) / qPk > 0.1)) return null;
    const turun = turunDiLuar(po, pk.hMax, Hx);
    const kunci = turun ? "turun" : qPo > qPk ? "lebih" : "kurang";
    return { d, deg, pk, po, Hx, qPk, qPo, kunci };
  });
  const { d, deg, pk, po, Hx, qPk, qPo, kunci } = s;
  const persen = ((qPo - qPk) / qPk) * 100;
  const teksPo = (f: F) => (qPo < 0 ? "< 0" : f(qPo, 2));
  const pilihan: Pilihan[] = [
    {
      id: "sama",
      teks: { id: "Hampir sama, selisihnya di bawah 10 %", en: "Nearly the same, less than 10 % apart" },
      alasan: bi((f, l) =>
        l === "id"
          ? `Di dalam data keduanya memang hampir berimpit (R² ${f(pk.r2, 4)} dan ${f(po.r2, 4)}), tetapi di H = ${f(Hx, 2)} m polinomial memberi ${teksPo(f)} lawan ${f(qPk, 2)} m³/s.`
          : `Inside the data both nearly coincide (R² ${f(pk.r2, 4)} and ${f(po.r2, 4)}), but at H = ${f(Hx, 2)} m the polynomial gives ${teksPo(f)} against ${f(qPk, 2)} m³/s.`
      ),
    },
    {
      id: "lebih",
      teks: { id: "Polinomial lebih besar lebih dari 10 %", en: "The polynomial is more than 10 % higher" },
      alasan: bi((f, l) =>
        l === "id"
          ? `Polinomial di H = ${f(Hx, 2)} m memberi ${teksPo(f)} m³/s, bentuk pangkat ${f(qPk, 2)} m³/s.`
          : `At H = ${f(Hx, 2)} m the polynomial gives ${teksPo(f)} m³/s, the power form ${f(qPk, 2)} m³/s.`
      ),
    },
    {
      id: "kurang",
      teks: {
        id: "Polinomial tetap naik, tetapi lebih kecil lebih dari 10 %",
        en: "The polynomial keeps rising but is more than 10 % lower",
      },
      alasan: bi((f, l) =>
        l === "id"
          ? `Polinomial di H = ${f(Hx, 2)} m memberi ${teksPo(f)} m³/s, bentuk pangkat ${f(qPk, 2)} m³/s.`
          : `At H = ${f(Hx, 2)} m the polynomial gives ${teksPo(f)} m³/s, the power form ${f(qPk, 2)} m³/s.`
      ),
    },
    {
      id: "turun",
      teks: {
        id: "Polinomial berbalik turun (atau negatif) sebelum H itu",
        en: "The polynomial turns down (or negative) before that H",
      },
      alasan: bi((f, l) =>
        l === "id"
          ? `Polinomial derajat ${deg} ini tetap naik sampai H = ${f(Hx, 2)} m dan memberi ${teksPo(f)} m³/s.`
          : `This degree-${deg} polynomial keeps rising up to H = ${f(Hx, 2)} m and gives ${teksPo(f)} m³/s.`
      ),
    },
  ];
  const q: Soal = {
    jenis: "tebak",
    id: "hy04-2",
    tanya: bi((f, l) =>
      l === "id"
        ? `${pembuka(d.pts, f, l)} Bentuk pangkat dan polinomial derajat ${deg} sama-sama cocok di dalam data (R² > 0,99). Tebak dulu sebelum mengatur lembar: pada banjir H = ${f(Hx, 2)} m, di atas pengukuran tertinggi ${f(pk.hMax, 2)} m, bagaimana debit polinomial dibanding bentuk pangkat?`
        : `${pembuka(d.pts, f, l)} The power form and a degree-${deg} polynomial both fit inside the data (R² > 0.99). Guess before setting the sheet: at a flood stage H = ${f(Hx, 2)} m, above the highest measurement ${f(pk.hMax, 2)} m, how does the polynomial discharge compare with the power form?`
    ),
    pilihan,
    kunci,
    bahas: bi((f, l) =>
      l === "id"
        ? `Pada H = ${f(Hx, 2)} m bentuk pangkat memberi ${f(qPk, 2)} m³/s dan polinomial derajat ${deg} ${teksPo(f)} m³/s (${kunci === "turun" ? "polinomialnya berbalik turun di luar data" : `selisih ${f(Math.abs(persen), 0)} %`}). R² hanya menilai kecocokan di dalam data. Di luar data polinomial tidak terikat bentuk fisis apa pun, sedangkan hukum pangkat mengikuti penampang kendali. Lihat garis putus lengkung di kanan grafik, di luar pita data ukur.`
        : `At H = ${f(Hx, 2)} m the power form gives ${f(qPk, 2)} m³/s and the degree-${deg} polynomial ${teksPo(f)} m³/s (${kunci === "turun" ? "the polynomial turns down outside the data" : `a ${f(Math.abs(persen), 0)} % difference`}). R² only judges the fit inside the data. Outside it a polynomial is bound by no physical shape, while the power law follows the control section. See the dashed curve at the right of the graph, beyond the measured band.`
    ),
    langkah: langkahBi((f, l) => [
      {
        judul: l === "id" ? "Bentuk pangkat" : "Power form",
        rumus: "Q = a · H^b",
        isi: `${f(pk.a, 4)} · ${f(Hx, 2)}^${f(pk.b, 4)}`,
        hasil: f(qPk, 3),
        satuan: "m³/s",
        tint: C.water,
      },
      {
        judul: l === "id" ? `Polinomial derajat ${deg}` : `Degree-${deg} polynomial`,
        rumus: "Q = Σ cᵢ · Hⁱ",
        isi: po.coeffs.map((c, i) => `${f(c, 4)}·${f(Hx, 2)}^${i}`).join(" + "),
        hasil: f(qPo, 3),
        satuan: "m³/s",
        tint: C.energy,
      },
    ]),
    masukan: { H: Hx, bentuk: 2, deg, data: sidikData(d.pts) },
  };
  return denganData(q, d.pts);
}

/* ------------------------------------------------------------------ *
 * B3 pilih: bentuk terdekat ke kurva sebenarnya di 1,5·hMax
 * ------------------------------------------------------------------ */

const NAMA_BENTUK: Record<RatingKind, Bi<string>> = {
  pangkat: { id: "Pangkat biasa, Q = a·H^b", en: "Plain power, Q = a·H^b" },
  "pangkat-h0": { id: "Pangkat dengan tinggi aliran nol, Q = a·(H − H0)^b", en: "Power with zero-flow stage, Q = a·(H − H0)^b" },
  polinomial: { id: "Polinomial derajat 2", en: "Degree-2 polynomial" },
};

function soal3(benih: number): Soal {
  const s = cari(benih, 3, (r) => {
    const d = bangunData(r);
    if (!d) return null;
    const hMax = hMaxData(d.pts);
    const Hx = Math.floor(1.5 * hMax * 100 + 1e-9) / 100;
    const qT = lengkungPangkat(d.a, d.b, d.h0)(Hx);
    const fits = [fitRating(d.pts, "pangkat"), fitRating(d.pts, "pangkat-h0"), fitRating(d.pts, "polinomial", 2)];
    if (fits.some((f) => !f)) return null;
    const nilai = fits.map((f) => ratingValue(f!, Hx));
    const galat = nilai.map((v) => Math.abs(v - qT));
    const urut = galat.slice().sort((a, b) => a - b);
    if (urut[1] - urut[0] < 0.05 * qT) return null;
    return { d, Hx, qT, fits: fits as RatingFit[], nilai, kunci: BENTUK[galat.indexOf(urut[0])] };
  });
  const { d, Hx, qT, fits, nilai, kunci } = s;
  const pilihan: Pilihan[] = BENTUK.map((k, i) => ({
    id: k,
    teks: NAMA_BENTUK[k],
    ...(k === kunci
      ? {}
      : {
          alasan: bi((f, l) =>
            l === "id"
              ? `Bentuk ini memberi ${f(nilai[i], 2)} m³/s di H = ${f(Hx, 2)} m, meleset ${f(Math.abs(nilai[i] - qT), 2)} m³/s dari debit sebenarnya ${f(qT, 2)} m³/s.`
              : `This form gives ${f(nilai[i], 2)} m³/s at H = ${f(Hx, 2)} m, ${f(Math.abs(nilai[i] - qT), 2)} m³/s away from the true ${f(qT, 2)} m³/s.`
          ),
        }),
  }));
  const q: Soal = {
    jenis: "pilih",
    id: "hy04-3",
    tanya: bi((f, l) =>
      l === "id"
        ? `${pembuka(d.pts, f, l)} Data ini dibangkitkan dari lengkung sebenarnya Q = ${f(d.a, 2)}·(${hMinH0(d.h0, f)})^${f(d.b, 2)} ditambah derau sampai ±${f(d.derau * 100, 1)} %. Bentuk mana, dicocokkan ke data itu, yang paling dekat ke debit sebenarnya pada H = ${f(Hx, 2)} m (1,5 kali pengukuran tertinggi)?`
        : `${pembuka(d.pts, f, l)} These data come from the true curve Q = ${f(d.a, 2)}·(${hMinH0(d.h0, f)})^${f(d.b, 2)} plus noise of up to ±${f(d.derau * 100, 1)} %. Which form, fitted to the data, comes closest to the true discharge at H = ${f(Hx, 2)} m (1.5 times the highest measurement)?`
    ),
    pilihan,
    kunci,
    bahas: bi((f, l) =>
      l === "id"
        ? `Debit sebenarnya ${f(qT, 2)} m³/s. Pangkat biasa ${f(nilai[0], 2)}, pangkat dengan H0 ${f(nilai[1], 2)}, polinomial derajat 2 ${f(nilai[2], 2)} m³/s. Ekstrapolasi menguji bentuk, bukan R²: bentuk yang sama dengan hukum pembangkitnya biasanya paling dekat, tetapi derau pada beberapa titik bisa menggeser H0 dan pangkatnya. Pilih tiap bentuk di lembar dan bandingkan baris Debit pada H yang dibaca.`
        : `The true discharge is ${f(qT, 2)} m³/s. Plain power ${f(nilai[0], 2)}, power with H0 ${f(nilai[1], 2)}, degree-2 polynomial ${f(nilai[2], 2)} m³/s. Extrapolation tests the form, not R²: the form matching the generating law is usually closest, but noise on a few points can shift H0 and the exponent. Select each form on the sheet and compare the Discharge at the stage read row.`
    ),
    langkah: langkahBi((f, l) =>
      BENTUK.map((k, i) => ({
        judul: NAMA_BENTUK[k][l],
        rumus: "| Q̂ − Q |",
        isi: `| ${f(nilai[i], 3)} − ${f(qT, 3)} |`,
        hasil: f(Math.abs(nilai[i] - qT), 3),
        satuan: "m³/s",
        tint: k === kunci ? C.water : undefined,
      }))
    ),
    masukan: { H: Hx, bentuk: BENTUK.indexOf(kunci), deg: 2, data: sidikData(d.pts) },
  };
  void fits;
  return Object.assign(denganData(q, d.pts), { benar: { a: d.a, b: d.b, h0: d.h0 } });
}

/* ------------------------------------------------------------------ *
 * B4 atur: H ke zona terbatas lembar
 * ------------------------------------------------------------------ */

function soal4(benih: number): Soal {
  const s = cari(benih, 4, (r) => {
    const d = bangunData(r, 1.2);
    if (!d) return null;
    const f = fitRating(d.pts, "pangkat");
    if (!f || f.hMax < 1) return null;
    return { d, f };
  });
  const { d, f } = s;
  const sidik = sidikData(d.pts);
  const P = pH(f.hMax);
  const H0 = Math.round(0.6 * f.hMax * 100) / 100;
  const batas = BATAS_TERBATAS * f.hMax;
  return denganData(
    {
      jenis: "atur",
      id: "hy04-4",
      tanya: bi((f2, l) =>
        l === "id"
          ? `${pembuka(d.pts, f2, l)} Lembar ini menandai ekstrapolasi ke atas sampai ${f2(BATAS_TERBATAS, 1)} kali pengukuran tertinggi sebagai zona terbatas. Geser H yang dibaca ke dalam zona terbatas lembar ini, lalu periksa.`
          : `${pembuka(d.pts, f2, l)} This sheet marks upward extrapolation up to ${f2(BATAS_TERBATAS, 1)} times the highest measurement as the limited zone. Move the stage read into this sheet's limited zone, then check.`
      ),
      ukur: (k) => {
        if (!dataCocok(k, sidik)) return Number.NaN;
        const z = zonaBaca(k.H, f);
        const q = k.H / f.hMax;
        // Rasio untuk tampilan; batasnya mengikuti zonaBaca persis.
        if (z === "terbatas") return Math.min(BATAS_TERBATAS, Math.max(q, 1 + 1e-9));
        return z === "jauh" ? Math.max(q, BATAS_TERBATAS + 1e-9) : Math.min(q, 1);
      },
      simbol: "H/Hmaks",
      digits: 3,
      target: { min: 1 + 1e-9, max: BATAS_TERBATAS },
      geser: { kunci: "H", p: P },
      siapkan: { H: H0, bentuk: 0, deg: 2, data: sidik },
      bahas: bi((f2, l) =>
        l === "id"
          ? `Pengukuran tertinggi H = ${f2(f.hMax, 2)} m, jadi zona terbatas lembar ini ${f2(f.hMax, 2)} < H ≤ ${f2(batas, 2)} m. Di bawahnya debit dibaca di dalam data; di atasnya lembar menandai bacaan sebagai di luar zona terbatas. Batas ${f2(BATAS_TERBATAS, 1)}·Hmaks adalah pilihan lembar untuk latihan; batas di lapangan ditetapkan pengelola pos duga dan hanya masuk akal bila bentuk penampang tidak berubah di rentang itu. Lihat pita di atas gambar.`
          : `The highest measurement is H = ${f2(f.hMax, 2)} m, so this sheet's limited zone is ${f2(f.hMax, 2)} < H ≤ ${f2(batas, 2)} m. Below it the discharge is read within the data; above it the sheet marks the reading as beyond the limited zone. The ${f2(BATAS_TERBATAS, 1)}·Hmax limit is this sheet's choice for practice; a limit in the field is set by the gauging authority and only makes sense if the section shape does not change over that range. See the scale above the drawing.`
      ),
      langkah: langkahBi((f2, l) => [
        {
          judul: l === "id" ? "Batas atas zona terbatas lembar" : "Upper limit of the sheet's limited zone",
          rumus: `H = ${f2(BATAS_TERBATAS, 1)} · Hmaks`,
          isi: `${f2(BATAS_TERBATAS, 1)} · ${f2(f.hMax, 2)}`,
          hasil: f2(batas, 3),
          satuan: "m",
          tint: C.caution,
        },
      ]),
    },
    d.pts
  );
}

/* ------------------------------------------------------------------ *
 * B5 hitung: Q bentuk pangkat-H0 di bagian bawah data
 * ------------------------------------------------------------------ */

function soal5(benih: number): Soal {
  const s = cari(benih, 5, (r) => {
    const d = bangunData(r);
    if (!d) return null;
    const f = fitRating(d.pts, "pangkat-h0");
    if (!f || Math.abs(f.h0) < 0.05) return null;
    const span = f.hMax - f.hMin;
    const H = acakKisi(r, pH(f.hMax), f.hMin, f.hMin + 0.3 * span);
    if (H < f.hMin || H > f.hMin + 0.3 * span + 1e-9) return null;
    const Q = ratingValue(f, H);
    return Q >= 0.1 ? { d, f, H, Q } : null;
  });
  const { d, f, H, Q } = s;
  const tol = 0.01 * Q;
  const kesalahan: Kesalahan[] = buangDuplikat(
    { nilai: Q },
    [
      {
        nilai: f.a * Math.pow(H, f.b),
        alasan: bi((f2, l) =>
          l === "id"
            ? `Ini a·H^b: H0 = ${f2(f.h0, 3)} m terlupa. Pangkatnya dikenakan pada tinggi air di atas titik aliran nol, H − H0.`
            : `This is a·H^b: H0 = ${f2(f.h0, 3)} m was left out. The exponent applies to the depth above the zero-flow point, H − H0.`
        ),
      },
      {
        nilai: H + f.h0 > 0 ? f.a * Math.pow(H + f.h0, f.b) : 0,
        alasan: bi((f2, l) =>
          l === "id"
            ? `Ini a·(H + H0)^b: tanda H0 terbalik. H0 = ${f2(f.h0, 3)} m dikurangkan dari H.`
            : `This is a·(H + H0)^b: the sign of H0 is flipped. H0 = ${f2(f.h0, 3)} m is subtracted from H.`
        ),
      },
    ],
    { toleransi: tol, digits: 3 }
  );
  const q: Soal = {
    jenis: "hitung",
    id: "hy04-5",
    tanya: bi((f2, l) =>
      l === "id"
        ? `${pembuka(d.pts, f2, l)} Pilih bentuk Q = a·(H − H0)^b. Dari baris hasilnya (a, b, dan tinggi aliran nol H0), hitung debit pada H = ${f2(H, 2)} m.`
        : `${pembuka(d.pts, f2, l)} Select the form Q = a·(H − H0)^b. From its result rows (a, b, and the zero-flow stage H0), compute the discharge at H = ${f2(H, 2)} m.`
    ),
    kunci: Q,
    toleransi: tol,
    digits: 3,
    satuan: { id: "m³/s", en: "m³/s" },
    kesalahan,
    bahas: bi((f2, l) =>
      l === "id"
        ? `H0 = ${f2(f.h0, 3)} m, a = ${f2(f.a, 4)}, b = ${f2(f.b, 4)}, jadi Q = ${f2(f.a, 4)}·(${f2(H, 2)} − ${sisip(f.h0, 3, f2)})^${f2(f.b, 4)} = ${f2(Q, 3)} m³/s. Di bagian bawah data, H − H0 kecil, sehingga salah tanda atau lupa H0 paling terasa di sini. Lihat garis tinggi aliran nol di grafik dan baris H0 di tabel hasil.`
        : `H0 = ${f2(f.h0, 3)} m, a = ${f2(f.a, 4)}, b = ${f2(f.b, 4)}, so Q = ${f2(f.a, 4)}·(${f2(H, 2)} − ${sisip(f.h0, 3, f2)})^${f2(f.b, 4)} = ${f2(Q, 3)} m³/s. Near the bottom of the data H − H0 is small, so a flipped sign or a missing H0 shows most here. See the zero-flow line on the graph and the H0 row in the results.`
    ),
    langkah: langkahBi((f2, l) => langkahPangkat(f, H, f2, l, C.water)),
    masukan: { H, bentuk: 1, deg: 2, data: sidikData(d.pts) },
  };
  return denganData(q, d.pts);
}

export const HY04: BankKuis = {
  kode: "HY-04",
  jumlah: 5,
  buat: (benih) => [soal1(benih), soal2(benih), soal3(benih), soal4(benih), soal5(benih)],
};
