import { C, W } from "./theme.ts";
import { createLabelPlacer, ground } from "./plate.ts";
import { rectsFrom, type PlateOut } from "./plateOut.ts";
import {
  ISO,
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

/** Batas panjang miter terhadap setengah tebal (sudut tajam di kaki siklus). */
const MITER_MAKS = 3;

/**
 * Dinding mercu sebagai rangkaian prisma tegak 0..P, satu per ruas.
 * Ruas bertetangga berbagi titik sambungan miter, jadi tepi sambungan
 * berimpit (satu garis) dan tidak ada dinding yang bertumpuk.
 */
function dindingMiter(ruas: readonly RuasDinding[], t: number, P: number): Muka[] {
  const v = [ruas[0].a, ...ruas.map((r) => r.b)];
  const n = v.length;
  // Normal kiri satuan tiap ruas.
  const nr = ruas.map((r) => {
    const dx = r.b.x - r.a.x;
    const dy = r.b.y - r.a.y;
    const L = Math.hypot(dx, dy) || 1;
    return { x: -dy / L, y: dx / L };
  });
  const kiri: { x: number; y: number }[] = [];
  const kanan: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    let mx: number, my: number, len: number;
    if (i === 0 || i === n - 1) {
      const q = nr[i === 0 ? 0 : n - 2];
      mx = q.x;
      my = q.y;
      len = t / 2;
    } else {
      const a = nr[i - 1];
      const b = nr[i];
      const sx = a.x + b.x;
      const sy = a.y + b.y;
      const sl = Math.hypot(sx, sy) || 1;
      mx = sx / sl;
      my = sy / sl;
      const cos = mx * a.x + my * a.y;
      len = (t / 2) / Math.max(cos, 1 / MITER_MAKS);
    }
    kiri.push({ x: v[i].x + mx * len, y: v[i].y + my * len });
    kanan.push({ x: v[i].x - mx * len, y: v[i].y - my * len });
  }
  const out: Muka[] = [];
  for (let j = 0; j < ruas.length; j++) {
    // Berlawanan jarum jam dilihat dari atas: kanan maju, kiri mundur.
    const alas = [kanan[j], kanan[j + 1], kiri[j + 1], kiri[j]];
    out.push(...prisma(alas, 0, P, { satuSisi: true, bobot: W.bold, garis: C.concrete }));
  }
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

  muka.push(...dindingMiter(ruasLabirin(s.W, s.cycles, s.B), t, s.P));

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
const RUANG_JUDUL = 34;

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
  const k = kameraPas(batas, w, h - RUANG_JUDUL, yaw, pitch, 20);
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
