import { C, F, W } from "./theme.ts";
import { createLabelPlacer, dimH, flowArrow, ground, hatchSoil, pen } from "./plate.ts";
import { hash01 } from "./motion.ts";
import { mapFrom, rectsFrom, type PlateOut } from "./plateOut.ts";
import { FILTER_RETAIN, fmtPlain, sizeAt, type Gradation } from "./hydraulics.ts";
import { grainFill } from "./drawGrain.ts";

/**
 * DM-02: SKETSA PORI FILTER. Potongan kecil di batas tanah dasar (kiri) dan
 * filter (kanan), butir digambar sebanding diameternya. Ukuran butir tiap
 * lapis disampel dari gradasi model (sizeAt, kuantil dari hash tetap), jadi
 * sebaran besar-kecil butir di gambar adalah kurva gradasi yang sama.
 *
 * Lubang pori filter dianggap D15f / 4: angka empat yang sama dengan syarat
 * menahan Terzaghi (D15f ≤ 4 D85b), sehingga gambar tidak pernah bertentangan
 * dengan retains dari filterDesign. Bila retains benar, sekurangnya 15 %
 * butir tanah lebih besar daripada pori dan menyumbat mulut pori
 * (penyaringan diri), jadi tidak ada butir yang bergerak. Bila retains
 * salah, butir tanah yang lebih kecil daripada pori terbawa rembesan masuk
 * ke filter.
 *
 * Laju butir terbawa SKEMATIK: lembar ini tidak menghitung kecepatan
 * rembesan (tidak ada gradien hidraulik). Lembar wajib menulisnya.
 */

/** Lubang pori filter, mm. */
export function filterPore(filter: Gradation): number {
  return filter.d15 / FILTER_RETAIN;
}

const PAD_TOP = 40;
const PAD_BOTTOM = 34;
const PAD_SIDE = 10;

type Butir = { x: number; y: number; d: number };

/**
 * Tata letak butir satu lapis dalam kotak [x0,x1]×[y0,y1] (mm), baris demi
 * baris; diameter dari kuantil hash gradasi. Tanpa Math.random.
 */
function susunLapis(g: Gradation, x0: number, x1: number, y0: number, y1: number, benih: number, maks: number): Butir[] {
  const out: Butir[] = [];
  let y = y0;
  let i = 0;
  while (y < y1 && out.length < maks) {
    let x = x0;
    let tinggi = 0;
    while (x < x1 && out.length < maks) {
      const p = 3 + 94 * hash01(i, benih);
      const d = sizeAt(g, p);
      out.push({ x: x + d / 2, y: y + d / 2, d });
      tinggi = Math.max(tinggi, d);
      x += d * 1.04;
      i++;
    }
    y += Math.max(tinggi * 0.92, 1e-9);
  }
  return out;
}

export type FilterPanelState = {
  base: Gradation;
  filter: Gradation;
  retains: boolean;
  title: string;
  tint: string;
  baseLabel: string;
  filterLabel: string;
  flowLabel: string;
  /** Lapis gerak berjalan: butir terbawa digambar di sana */
  animating: boolean;
};

/** Skala panel: px per mm, supaya D85 filter kira-kira seperlima lebar separuh panel. */
function skala(w: number, filter: Gradation): number {
  const half = (w - 2 * PAD_SIDE) / 2;
  return half / 5 / Math.max(filter.d85, 1e-9);
}

export function filterPanelGeometry(w: number, h: number, filter: Gradation) {
  const k = skala(w, filter);
  const xMid = w / 2;
  const frame = { x0: PAD_SIDE, y0: PAD_TOP, x1: w - PAD_SIDE, y1: h - PAD_BOTTOM };
  const map = mapFrom(
    (v) => xMid + v * k,
    (v) => frame.y1 - v * k,
    frame,
    [(frame.x0 - xMid) / k, (frame.x1 - xMid) / k],
    [0, (frame.y1 - frame.y0) / k]
  );
  return { k, xMid, frame, map };
}

const MAKS_BUTIR = 900;

export function drawFilterPanel(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: FilterPanelState
): PlateOut {
  ground(ctx, w, h);
  const { k, xMid, frame, map } = filterPanelGeometry(w, h, s.filter);
  const tinggiMm = (frame.y1 - frame.y0) / k;
  const kiriMm = (frame.x0 - xMid) / k;
  const kananMm = (frame.x1 - xMid) / k;

  ctx.save();
  ctx.beginPath();
  ctx.rect(frame.x0, frame.y0, frame.x1 - frame.x0, frame.y1 - frame.y0);
  ctx.clip();
  ctx.fillStyle = C.waterFill;
  ctx.fillRect(frame.x0, frame.y0, frame.x1 - frame.x0, frame.y1 - frame.y0);

  const gambar = (b: Butir[], fill: string) => {
    for (const g of b) {
      const r = Math.max(0.8, (g.d * k) / 2 - 0.3);
      ctx.beginPath();
      ctx.arc(map.X(g.x), map.Y(g.y), r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      if (r > 2.5) {
        pen(ctx, W.hair, C.ink);
        ctx.stroke();
      }
    }
  };
  const filterB = susunLapis(s.filter, 0, kananMm, 0, tinggiMm, 41, MAKS_BUTIR);
  gambar(filterB, grainFill(s.filter.d50 / 1000));
  // Tanah dasar: butir sangat kecil pada skala ini; dibatasi jumlahnya,
  // sisanya cukup diwakili warna lapisnya.
  ctx.fillStyle = C.neutralFill;
  ctx.fillRect(frame.x0, frame.y0, xMid - frame.x0, frame.y1 - frame.y0);
  /* Butir tanah lebih kecil daripada dua piksel tidak dapat digambar satu
     per satu; lapisnya diwakili arsiran tanah, dan ukurannya tertulis. */
  if (s.base.d50 * k >= 2) {
    gambar(susunLapis(s.base, kiriMm, 0, 0, tinggiMm, 7, MAKS_BUTIR), grainFill(s.base.d50 / 1000));
  } else {
    hatchSoil(ctx, frame.x0, frame.y0, xMid - frame.x0, frame.y1 - frame.y0, 4);
  }

  /* Butir terbawa pada gambar diam (saat dijeda): di dalam filter. */
  if (!s.retains && !s.animating) {
    const pori = filterPore(s.filter);
    const fill = grainFill(s.base.d50 / 1000);
    for (let i = 0; i < N_TERBAWA; i++) {
      const d = Math.min(sizeAt(s.base, 3 + 80 * hash01(i, 5)), pori);
      const x = kananMm * (0.1 + 0.8 * hash01(i, 9));
      const y = tinggiMm * (0.1 + 0.8 * hash01(i, 13));
      butirTerbawa(ctx, map.X(x), map.Y(y), d * k, fill);
    }
  }
  ctx.restore();

  /* Batas lapis. */
  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  ctx.moveTo(xMid, frame.y0);
  ctx.lineTo(xMid, frame.y1);
  ctx.stroke();
  pen(ctx, W.thin, C.ink2);
  ctx.strokeRect(frame.x0, frame.y0, frame.x1 - frame.x0, frame.y1 - frame.y0);

  const lp = createLabelPlacer(ctx, { padL: 4, padT: 2, plotW: w - 8, plotH: h - 4 });
  lp.write(s.title, frame.x0, 12, s.tint, { align: "left" });
  const pori = filterPore(s.filter);
  const mm = (v: number) => `${fmtPlain(v, v >= 10 ? 1 : v >= 1 ? 2 : 3)} mm`;
  ctx.font = F.value;
  ctx.fillStyle = C.ink2;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const teks = `pori ≈ D15f/4 = ${mm(pori)}; D85b = ${mm(s.base.d85)}`;
  ctx.fillText(teks, frame.x0 + 4, 28, w - 2 * PAD_SIDE - 52);
  lp.reserve(frame.x0, w - 48, 22, 34);

  lp.write(s.baseLabel, (frame.x0 + xMid) / 2, frame.y0 + 12, C.ink, {});
  lp.write(s.filterLabel, (xMid + frame.x1) / 2, frame.y0 + 12, C.water, {});
  flowArrow(ctx, xMid, frame.y1 - 12, 40, C.water);
  lp.write(s.flowLabel, xMid, frame.y1 - 24, C.water, {});

  /* Garis ukur. */
  const target = (0.3 * (frame.x1 - frame.x0)) / k;
  const e = Math.pow(10, Math.floor(Math.log10(target)));
  const bar = [5, 2, 1].map((m) => m * e).find((v) => v <= target) ?? e;
  dimH(ctx, h - 6, frame.x1 - bar * k, frame.x1, "", C.ink2, undefined, [0, w]);
  const tu = mm(bar);
  ctx.font = F.label;
  const lu = ctx.measureText(tu).width;
  ctx.fillStyle = C.ink2;
  ctx.textBaseline = "bottom";
  ctx.fillText(tu, frame.x1 - bar * k - lu - 8, h - 2);

  return { map, anchors: {}, labels: rectsFrom(lp.boxes()) };
}

function butirTerbawa(ctx: CanvasRenderingContext2D, x: number, y: number, dpx: number, fill: string) {
  // Paling kecil 2,5 px supaya butir halus yang terbawa tetap terlihat;
  // butir tanah lebih kecil daripada itu pada skala panel ini.
  const r = Math.max(2.5, dpx / 2);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  pen(ctx, W.thin, C.ink);
  ctx.stroke();
}

/* ------------------------------------------------------------------ *
 * Lapis gerak: butir halus terbawa (hanya bila retains salah)
 * ------------------------------------------------------------------ */

export const N_TERBAWA = 14;
/** Waktu melintasi panel, detik layar (skematik). */
export const PIPING_CROSS_SECONDS = 5;

export type PipingMotion = { x: Float32Array; y: Float32Array; d: Float32Array; gen: Uint32Array; init: boolean };

export function createPipingMotion(): PipingMotion {
  return {
    x: new Float32Array(N_TERBAWA),
    y: new Float32Array(N_TERBAWA),
    d: new Float32Array(N_TERBAWA),
    gen: new Uint32Array(N_TERBAWA),
    init: false,
  };
}

/**
 * Satu langkah: butir bergerak dari tanah dasar ke kanan menembus filter
 * dengan laju skematik (lebar panel per PIPING_CROSS_SECONDS), lajur tegak
 * berkelok lewat hash (jalur berliku di antara butir filter). Posisi dalam
 * bagian lebar panel 0..1 dan tinggi 0..1. Tanpa alokasi.
 */
export function stepPiping(m: PipingMotion, dt: number, base: Gradation, filter: Gradation): void {
  const pori = filterPore(filter);
  if (!m.init) {
    for (let i = 0; i < N_TERBAWA; i++) {
      m.x[i] = hash01(i, 3);
      m.y[i] = 0.08 + 0.84 * hash01(i, 4);
      m.d[i] = Math.min(sizeAt(base, 3 + 80 * hash01(i, 5)), pori);
    }
    m.init = true;
  }
  if (!(dt > 0)) return;
  const v = 1 / PIPING_CROSS_SECONDS;
  for (let i = 0; i < N_TERBAWA; i++) {
    let x = m.x[i] + v * dt;
    if (x > 1) {
      x -= 1;
      const g = (m.gen[i] + 1) >>> 0;
      m.gen[i] = g;
      m.y[i] = 0.08 + 0.84 * hash01(i, g + 100);
      m.d[i] = Math.min(sizeAt(base, 3 + 80 * hash01(i + 50, g)), pori);
    }
    m.x[i] = x;
  }
}

export function drawPiping(
  ctx: CanvasRenderingContext2D,
  m: PipingMotion,
  out: PlateOut | null,
  base: Gradation
): void {
  if (!out) return;
  const f = out.map.frame;
  const k = out.map.X(1) - out.map.X(0);
  const fill = grainFill(base.d50 / 1000);
  ctx.save();
  ctx.beginPath();
  ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
  ctx.clip();
  for (let i = 0; i < N_TERBAWA; i++) {
    const x = f.x0 + m.x[i] * (f.x1 - f.x0);
    // Jalur berliku di antara butir filter (skematik, tetap per butir).
    const kelok = 0.025 * Math.sin(m.x[i] * 19 + i * 1.7);
    const y = f.y0 + (m.y[i] + kelok) * (f.y1 - f.y0);
    butirTerbawa(ctx, x, y, m.d[i] * k, fill);
  }
  ctx.restore();
}
