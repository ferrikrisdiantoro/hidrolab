import { C, W } from "./theme.ts";
import { createLabelPlacer, ground } from "./plate.ts";
import { rectsFrom, type PlateOut } from "./plateOut.ts";
import {
  ISO,
  anchor3,
  gambarMuka,
  kameraPas,
  kotak,
  plateOut3,
  prisma,
  type Kamera,
  type Muka,
  type V3,
} from "./proyeksi.ts";

/**
 * HS-02 PILOT 3D: BENDUNG LABIRIN ISOMETRIK (kerangka, TANPA tirai).
 *
 * Geometri dinding sama persis dengan denah model labyrinthWeir
 * (hydraulics.ts): tiap siklus selebar w = W / siklus berdenah trapesium,
 * kaki dari tepi siklus (x 0) ke puncak (x B) bergeser w/4 melintang,
 * puncak selebar w/2. Panjang garis tengah seluruh ruas = crestLength
 * model (diuji). Tinggi dinding = P, muka air hulu = P + h.
 *
 * Koordinat: x searah aliran (hulu di x < 0), y melintang 0..W, z elevasi
 * dari lantai saluran.
 *
 * Yang SKEMATIK dan ditulis begitu:
 * - Tebal dinding tidak ada di model; dipakai aturan gambar denah 2D lembar
 *   ini (5 % lebar siklus, paling tipis 0,12 m)
 * - Muka air hulu digambar datar P + h hanya di kolam hulu (x < 0); air di
 *   dalam siklus dan tirai belum digambar (menunggu gerbang insinyur bentuk
 *   tirai dari drawNappe/jetMotion)
 *
 * Belum dipasang ke lembar: Sheet `views` (D2) belum ada.
 */

export type IsoLabirinState = {
  /** Tinggi muka air di atas mercu, m */
  h: number;
  /** Tinggi mercu, m */
  P: number;
  /** Lebar saluran, m */
  W: number;
  /** Banyaknya siklus */
  cycles: number;
  /** Panjang siklus searah aliran, m */
  B: number;
  /** Dari model: di luar rentang berlaku (tirai bertemu) */
  outOfRange: boolean;
};

export type IsoLabirinOptions = {
  yaw?: number;
  pitch?: number;
  /** Judul gambar, sudah dalam bahasa lembar */
  heading?: string;
};

/** Ruas garis tengah dinding mercu dalam denah (x searah aliran, y melintang). */
export type RuasDinding = { a: { x: number; y: number }; b: { x: number; y: number } };

/** Tebal dinding skematik sebagai pecahan lebar satu siklus (lihat catatan berkas). */
export const TEBAL_PECAHAN = 0.05;
/** Tebal dinding skematik paling tipis, m. */
export const TEBAL_MIN = 0.12;

/** Tebal dinding skematik, m (lihat catatan berkas). */
export function tebalDinding(W: number, cycles: number): number {
  return Math.max((W / Math.max(cycles, 1)) * TEBAL_PECAHAN, TEBAL_MIN);
}

/** Garis tengah dinding mercu: 3 ruas per siklus, dari denah model. */
export function ruasLabirin(W: number, cycles: number, B: number): RuasDinding[] {
  const n = Math.max(1, Math.round(cycles));
  const w = W / n;
  const out: RuasDinding[] = [];
  for (let i = 0; i < n; i++) {
    const y0 = i * w;
    const p0 = { x: 0, y: y0 };
    const p1 = { x: B, y: y0 + w / 4 };
    const p2 = { x: B, y: y0 + (3 * w) / 4 };
    const p3 = { x: 0, y: y0 + w };
    out.push({ a: p0, b: p1 }, { a: p1, b: p2 }, { a: p2, b: p3 });
  }
  return out;
}

/**
 * Batas panjang miter terhadap setengah tebal. Di atasnya (sudut lebih
 * tajam) sisi CEMBUNG sambungan dibevel: miter penuh di V hulu (α 6°)
 * menjulurkan taji ±1,2 m ke kolam hulu, dan miter yang dijepit menipiskan
 * dinding ke 1,5·t·sin α (default α 11,8°: 0,61 t). Sisi cekung selalu
 * miter penuh: titik itu perpotongan sejati kedua muka dinding.
 */
const MITER_MAKS = 3;

type Titik2 = { x: number; y: number };

/**
 * Denah dinding: satu segi empat per ruas (berlawanan jarum jam dilihat
 * dari atas: kanan-awal, kanan-akhir, kiri-akhir, kiri-awal), ditambah
 * baji segitiga di tiap sambungan yang dibevel. Setiap titik segi empat
 * ruas berjarak tepat t/2 dari garis tengah ruasnya (tebal penuh di mana
 * pun). Ujung ruas pertama dan terakhir dipotong di dinding saluran y = 0
 * dan y = W, bukan menjulur keluar.
 */
export function alasDinding(
  ruas: readonly RuasDinding[],
  t: number,
  W: number
): { ruas: Titik2[][]; baji: Titik2[][] } {
  const m = ruas.length;
  const arah = ruas.map((r) => {
    const dx = r.b.x - r.a.x;
    const dy = r.b.y - r.a.y;
    const L = Math.hypot(dx, dy) || 1;
    return { x: dx / L, y: dy / L };
  });
  // Normal kiri satuan tiap ruas.
  const nl = arah.map((d) => ({ x: -d.y, y: d.x }));
  const h = t / 2;
  const kiriA: Titik2[] = [], kiriB: Titik2[] = [], kananA: Titik2[] = [], kananB: Titik2[] = [];
  const baji: Titik2[][] = [];

  /* Ujung saluran: perpotongan garis muka (offset ±t/2) dengan y = yc. */
  const diDinding = (j: number, sisi: 1 | -1, yc: number): Titik2 => {
    const o = { x: ruas[j].a.x + sisi * nl[j].x * h, y: ruas[j].a.y + sisi * nl[j].y * h };
    const s = Math.abs(arah[j].y) > 1e-12 ? (yc - o.y) / arah[j].y : 0;
    return { x: o.x + arah[j].x * s, y: yc };
  };
  kiriA[0] = diDinding(0, 1, 0);
  kananA[0] = diDinding(0, -1, 0);
  kiriB[m - 1] = diDinding(m - 1, 1, W);
  kananB[m - 1] = diDinding(m - 1, -1, W);

  for (let i = 1; i < m; i++) {
    const v = ruas[i].a;
    const a = nl[i - 1];
    const b = nl[i];
    const sx = a.x + b.x;
    const sy = a.y + b.y;
    const sl = Math.hypot(sx, sy);
    // Belok kiri (silang > 0): sisi kanan cembung, sisi kiri cekung.
    const silang = arah[i - 1].x * arah[i].y - arah[i - 1].y * arah[i].x;
    const cos = sl > 1e-12 ? (sx / sl) * a.x + (sy / sl) * a.y : 0;
    const miter = sl > 1e-12 ? { x: (sx / sl) * (h / cos), y: (sy / sl) * (h / cos) } : { x: 0, y: 0 };
    const kiriM = { x: v.x + miter.x, y: v.y + miter.y };
    const kananM = { x: v.x - miter.x, y: v.y - miter.y };
    if (cos >= 1 / MITER_MAKS) {
      kiriB[i - 1] = kiriA[i] = kiriM;
      kananB[i - 1] = kananA[i] = kananM;
    } else if (silang > 0) {
      kiriB[i - 1] = kiriA[i] = kiriM;
      kananB[i - 1] = { x: v.x - a.x * h, y: v.y - a.y * h };
      kananA[i] = { x: v.x - b.x * h, y: v.y - b.y * h };
      baji.push([kiriM, kananB[i - 1], kananA[i]]);
    } else {
      kananB[i - 1] = kananA[i] = kananM;
      kiriB[i - 1] = { x: v.x + a.x * h, y: v.y + a.y * h };
      kiriA[i] = { x: v.x + b.x * h, y: v.y + b.y * h };
      baji.push([kananM, kiriA[i], kiriB[i - 1]]);
    }
  }
  const segi = ruas.map((_, j) => [kananA[j], kananB[j], kiriB[j], kiriA[j]]);
  // Baji berlawanan jarum jam (luas bertanda positif) untuk prisma.
  for (const tri of baji) {
    const [p, q, r] = tri;
    if ((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x) < 0) tri.reverse();
  }
  return { ruas: segi, baji };
}

/**
 * Dinding mercu sebagai rangkaian prisma tegak 0..P: satu per ruas dan
 * satu per baji bevel. Ruas bertetangga berbagi titik sambungan, jadi tepi
 * sambungan berimpit (satu garis) dan tidak ada dinding yang bertumpuk.
 */
function dindingMercu(ruas: readonly RuasDinding[], t: number, P: number, W_: number): Muka[] {
  const { ruas: segi, baji } = alasDinding(ruas, t, W_);
  const out: Muka[] = [];
  const gaya = { satuSisi: true, bobot: W.bold, garis: C.concrete } as const;
  for (const alas of segi) out.push(...prisma(alas, 0, P, gaya));
  for (const alas of baji) out.push(...prisma(alas, 0, P, gaya));
  return out;
}

/** Seluruh muka gambar, terpisah dari kamera supaya bisa diuji dan di-cache. */
export function mukaLabirin(s: IsoLabirinState): { muka: Muka[]; batas: { min: V3; max: V3 } } {
  const t = tebalDinding(s.W, s.cycles);
  const hulu = Math.max(s.B * 0.6, 1);
  const hilir = Math.max(s.B * 0.5, 1);
  const lantai = Math.max(s.P * 0.12, 0.1);
  const muka: Muka[] = [];

  // Lantai saluran: muka atas polos, muka potongan diarsir beton.
  const dasar = kotak([-hulu, 0, -lantai], [s.B + hilir, s.W, 0], {
    satuSisi: true,
    bobot: W.bold,
    garis: C.concrete,
  });
  for (let i = 0; i < dasar.length; i++) {
    if (i !== 1) dasar[i].arsir = "beton";
    // Alas segalanya: digambar lebih dulu daripada dinding dan air.
    dasar[i].lapis = -1;
  }
  muka.push(...dasar);

  muka.push(...dindingMercu(ruasLabirin(s.W, s.cycles, s.B), t, s.P, s.W));

  // Kolam hulu, muka air datar P + h (skematik, lihat catatan berkas).
  const air = kotak([-hulu, 0, 0], [0, s.W, s.P + s.h], {
    satuSisi: true,
    bahan: "air",
    garis: C.water,
    bobot: W.thin,
  });
  air[0].garis = null; // alas air berimpit lantai
  for (let i = 2; i < air.length; i++) air[i].arsir = "air";
  muka.push(...air);

  return {
    muka,
    batas: { min: [-hulu, 0, -lantai], max: [s.B + hilir, s.W, s.P + s.h] },
  };
}

/** Ruang judul di atas gambar, px. */
export const RUANG_JUDUL_ISO = 34;
const RUANG_JUDUL = RUANG_JUDUL_ISO;
/** Margin kameraPas di keempat sisi, px. */
export const MARGIN_ISO = 20;

/**
 * Tinggi/lebar kotak batas terproyeksi pada pandangan awal. Lembar memakai
 * ini untuk tinggi bidang gambar isometrik: tinggi = rasio·(lebar − 2·margin)
 * + 2·margin + ruang judul, jadi di HP (bidang sempit) gambar tidak duduk
 * kecil di tengah bidang yang tinggi. Pandangan yang diputar tetap muat
 * (kameraPas), hanya bisa lebih kecil.
 */
export function rasioIsoLabirin(
  s: IsoLabirinState,
  yaw: number = -ISO.yaw,
  pitch: number = ISO.pitch
): number {
  const { batas } = mukaLabirin(s);
  const k = kameraPas(batas, 1000, 1e9, yaw, pitch, 0);
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const p = anchor3(
      [i & 1 ? batas.max[0] : batas.min[0], i & 2 ? batas.max[1] : batas.min[1], i & 4 ? batas.max[2] : batas.min[2]],
      k
    );
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  return (y1 - y0) / 1000;
}

/**
 * Menggambar HS-02 isometrik. Mengembalikan PlateOut (anchor terproyeksi:
 * `puncak` = puncak mercu siklus pertama, `hulu` = muka air hulu di tengah
 * kolam) dan kamera yang dipakai, untuk toValue pegangan di Client.
 */
export function drawIsoLabirin(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: IsoLabirinState,
  opts: IsoLabirinOptions = {}
): PlateOut & { kamera: Kamera } {
  ground(ctx, w, h);
  const { muka, batas } = mukaLabirin(s);
  /* Bawaan: pengamat di hilir kiri (yaw −45°), aliran datang dari kiri
     atas menuju pengamat, jadi muka hilir dinding dan siklus terbuka ke
     hilir terlihat. */
  const yaw = opts.yaw ?? -ISO.yaw;
  const pitch = opts.pitch ?? ISO.pitch;
  const k = kameraPas(batas, w, h - RUANG_JUDUL, yaw, pitch, MARGIN_ISO);
  k.cy += RUANG_JUDUL;

  const bingkai = { x0: 0, y0: 0, x1: w, y1: h };
  gambarMuka(ctx, muka, k, { bingkai });

  const placer = createLabelPlacer(ctx, { padL: 0, padT: 0, plotW: w, plotH: h });
  if (opts.heading)
    placer.write(opts.heading, w / 2, 20, s.outOfRange ? C.signal : C.ink3, { big: true });

  const w1 = s.W / Math.max(1, Math.round(s.cycles));
  const out = plateOut3(k, w, h, {
    puncak: [s.B, w1 / 2, s.P],
    hulu: [-Math.max(s.B * 0.6, 1) / 2, s.W / 2, s.P + s.h],
  });
  return { ...out, labels: rectsFrom(placer.boxes()), kamera: k };
}
