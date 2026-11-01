import { C, DASH, F, W } from "./theme.ts";
import { pen, region } from "./plate.ts";
import { fmtPlain, fmtSci } from "./hydraulics.ts";
import type { PlateFrame, PlateOut } from "./plateOut.ts";

/**
 * PIRAMIDA TROFIK BERANIMASI (EK-01).
 *
 * Satu baris per tingkat, produsen di bawah. Dua model yang berbeda
 * ditumpuk dengan dua tanda yang berbeda, supaya tidak tertukar:
 *
 * - KERANGKA merah bata = aliran energi (model piramida statis,
 *   E(i) = P·ε^(i−1)), lebarnya logaritmik. Bila E di bawah ambang
 *   tertopang, kerangkanya putus-putus oker dan diberi tulisan.
 * - ISIAN kelabu = biomassa model rantai dinamis pada saat itu dibagi
 *   biomassa keseimbangannya. Isian selebar kerangka berarti tepat di
 *   keseimbangan; lebih lebar berarti naik, lebih sempit berarti turun.
 *   Tingkat yang tidak tertopang di model dinamis (keseimbangan 0) tidak
 *   punya isian dan diberi tulisan.
 *
 * Bulatan di ujung kanan baris menyatakan apakah tingkat itu sudah
 * menanggapi gangguan (simpangan mencapai 10 % simpangan terbesarnya,
 * AMBANG_TANGGAPAN di rantaiTrofik.ts): kosong = belum, berisi = sudah.
 * Itulah rambatan antartingkat yang diminta lembar.
 *
 * drawTrophicState tidak membuat objek: aman dipanggil tiap bingkai.
 */

export type TrophicPyramidSpec = {
  /** Aliran energi tiap tingkat, kJ/m²·th (model statis) */
  energy: number[];
  /** Biomassa dinamis saat ini tiap tingkat, g/m² */
  biomass: ArrayLike<number>;
  /** Biomassa keseimbangan dinamis tiap tingkat, 0 = tidak tertopang */
  equilibrium: number[];
  /** Banyaknya tingkat yang tertopang menurut energi (E ≥ ambang) */
  supported: number;
  /** Gangguan: tingkat (1 = produsen) dan pengalinya; tanpa ini tidak ada penanda */
  pulse?: { level: number; strength: number }[];
  /** Tingkat yang sudah menanggapi saat ini (panjang = jumlah tingkat) */
  responded?: ArrayLike<boolean | number>;
};

export type TrophicLabels = {
  /** Nama tingkat, indeks 0 = produsen */
  names: string[];
  unsupportedEnergy: string;
  unsupportedDynamic: string;
  energyUnit: string;
  /** Teks penanda gangguan, misalnya "diganggu" */
  disturbed: string;
  pressKind?: string;
};

export type TrophicLayout = {
  frame: PlateFrame;
  n: number;
  /** Tengah mendatar piramida, px */
  cx: number;
  /** Ordinat tengah baris i (0 = produsen) */
  rowY: Float64Array;
  rowH: number;
  /** Lebar kerangka energi tiap baris, px */
  frameW: Float64Array;
  equilibrium: Float64Array;
  /** Absis bulatan tanggapan */
  dotX: number;
  /** Absis kanan tulisan biomassa */
  valueX: number;
};

/** Lebar isian terbesar sebagai kelipatan kerangka (di atasnya diberi tanda). */
export const RASIO_MAKS = 1.8;

function nama(L: TrophicLabels, i: number): string {
  return L.names[Math.min(i, L.names.length - 1)].replace("{i}", String(i + 1));
}

export function drawTrophicPyramid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: TrophicPyramidSpec,
  opts: { labels: TrophicLabels; minEnergy: number; withState: boolean }
): { out: PlateOut; layout: TrophicLayout } {
  const n = s.energy.length;
  const sempit = w < 600;
  const padT = 30;
  const padB = 12;
  /* Kolom kiri untuk nama tingkat, kolom kanan untuk angka energi. */
  const kolomKiri = sempit ? 92 : 150;
  const kolomKanan = sempit ? 70 : 120;
  const frame: PlateFrame = { x0: 8, y0: padT, x1: w - 8, y1: Math.max(padT + 20, h - padB) };
  const x0 = frame.x0 + kolomKiri;
  const x1 = frame.x1 - kolomKanan;
  const cx = (x0 + x1) / 2;
  const wMax = Math.max(40, (x1 - x0) / RASIO_MAKS);
  const rowH = Math.max(14, Math.min(40, (frame.y1 - frame.y0) / Math.max(n, 1)));
  const tinggiTotal = rowH * n;
  const yBawah = frame.y0 + (frame.y1 - frame.y0 + tinggiTotal) / 2;

  const rowY = new Float64Array(n);
  const frameW = new Float64Array(n);
  const eq = new Float64Array(n);
  const E1 = Math.max(s.energy[0] ?? 1, 1e-30);
  let rentang = 1;
  for (let i = 0; i < n; i++) rentang = Math.max(rentang, -Math.log10(Math.max(s.energy[i], 1e-30) / E1));
  for (let i = 0; i < n; i++) {
    rowY[i] = yBawah - rowH * (i + 0.5);
    const turun = -Math.log10(Math.max(s.energy[i], 1e-30) / E1) / rentang;
    frameW[i] = wMax * (1 - 0.78 * turun);
    eq[i] = s.equilibrium[i] ?? 0;
  }

  const L = opts.labels;
  for (let i = 0; i < n; i++) {
    const y = rowY[i];
    const bw = frameW[i];
    const tertopangE = s.energy[i] >= opts.minEnergy;
    /* Kerangka energi */
    pen(ctx, tertopangE ? W.bold : W.thin, tertopangE ? C.energy : C.caution, tertopangE ? DASH.solid : DASH.hidden);
    ctx.strokeRect(Math.round(cx - bw / 2) + 0.5, Math.round(y - rowH / 2 + 3) + 0.5, Math.round(bw), Math.round(rowH - 6));
    ctx.setLineDash([]);

    /* Nama tingkat di kiri */
    ctx.font = F.region;
    region(ctx, nama(L, i), frame.x0 + 2, y, C.ink2, 0, "left");

    /* Energi di kanan, angka apa adanya */
    const E = s.energy[i];
    const teksE = E > 0 && E < 1e-2 ? fmtSci(E) : fmtPlain(E, E >= 100 ? 0 : 2);
    ctx.font = F.value;
    ctx.fillStyle = tertopangE ? C.energy : C.caution;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(sempit ? teksE : `${teksE} ${L.energyUnit}`, frame.x1 - 2, y);
  }

  /* Penanda tidak tertopang ditulis sekali di atas piramida, tidak di tiap
     baris, supaya baris sempit di HP tidak penuh tulisan. */
  ctx.font = F.labelSm;
  const tidakE = s.energy.some((e) => e < opts.minEnergy);
  const tidakD = s.equilibrium.some((v) => !(v > 0));
  let yTulis = 12;
  const lvG = s.pulse?.[0]?.level ?? 0;
  if (lvG >= 1 && lvG <= n) {
    ctx.font = F.value;
    ctx.fillStyle = C.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`[ ${nama(L, lvG - 1)}: ${L.disturbed}`, frame.x0 + 2, yTulis);
    yTulis += 14;
  }
  if (tidakE) {
    region(ctx, L.unsupportedEnergy, frame.x0 + 2, yTulis, C.caution, 0, "left");
    yTulis += 13;
  }
  if (tidakD && !(tidakE && sempit)) region(ctx, L.unsupportedDynamic, tidakE ? frame.x0 + 2 : frame.x0 + 2, yTulis, C.ink3, 0, "left");

  const layout: TrophicLayout = {
    frame,
    n,
    cx,
    rowY,
    rowH,
    frameW,
    equilibrium: eq,
    dotX: Math.min(x1 + 10, cx + (wMax * RASIO_MAKS) / 2 + 12),
    valueX: x1 + 4,
  };

  if (opts.withState) drawTrophicState(ctx, layout, s.biomass, s.responded, s.pulse?.[0]?.level ?? 0, L);

  const out: PlateOut = {
    map: {
      X: (v) => v,
      Y: (v) => v,
      invX: (v) => v,
      invY: (v) => v,
      frame,
    },
    anchors: {},
  };
  return { out, layout };
}

/**
 * Isian biomassa dinamis dan bulatan tanggapan pada satu saat.
 * `disturbed` = tingkat yang diganggu (1 = produsen), 0 = tanpa penanda.
 */
export function drawTrophicState(
  ctx: CanvasRenderingContext2D,
  L: TrophicLayout,
  biomass: ArrayLike<number>,
  responded: ArrayLike<boolean | number> | undefined,
  disturbed: number,
  labels: TrophicLabels
): void {
  for (let i = 0; i < L.n; i++) {
    const y = L.rowY[i];
    const bw = L.frameW[i];
    const e = L.equilibrium[i];
    const atas = Math.round(y - L.rowH / 2 + 6);
    const tinggi = Math.max(2, Math.round(L.rowH - 12));
    if (!(e > 0)) {
      /* Tidak tertopang di model dinamis: garis tengah tipis saja */
      pen(ctx, W.hair, C.ink3, DASH.hidden);
      ctx.beginPath();
      ctx.moveTo(L.cx - bw / 2 + 4, Math.round(y) + 0.5);
      ctx.lineTo(L.cx + bw / 2 - 4, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }
    const rasio = Math.max(0, biomass[i] / e);
    const lebar = bw * Math.min(rasio, RASIO_MAKS);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = C.ink2;
    ctx.fillRect(L.cx - lebar / 2, atas, lebar, tinggi);
    ctx.globalAlpha = 1;
    pen(ctx, W.thin, C.ink2);
    ctx.strokeRect(Math.round(L.cx - lebar / 2) + 0.5, atas + 0.5, Math.round(lebar), tinggi);
    if (rasio > RASIO_MAKS) {
      /* Di luar lebar gambar: tanda panah di ujung kanan isian */
      const xe = L.cx + lebar / 2;
      pen(ctx, W.thin, C.ink2);
      ctx.beginPath();
      ctx.moveTo(xe + 2, y - 4);
      ctx.lineTo(xe + 7, y);
      ctx.lineTo(xe + 2, y + 4);
      ctx.stroke();
    }

    /* Bulatan tanggapan */
    const sudah = responded ? !!responded[i] : false;
    pen(ctx, W.thin, C.ink);
    ctx.fillStyle = sudah ? C.ink : C.sheet;
    ctx.beginPath();
    ctx.arc(L.dotX, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Penanda tingkat yang diganggu: kurung siku di kiri kerangka */
    if (disturbed === i + 1) {
      const xk = L.cx - (bw * RASIO_MAKS) / 2 - 4;
      pen(ctx, W.bold, C.ink);
      ctx.beginPath();
      ctx.moveTo(xk + 5, y - L.rowH / 2 + 4);
      ctx.lineTo(xk, y - L.rowH / 2 + 4);
      ctx.lineTo(xk, y + L.rowH / 2 - 4);
      ctx.lineTo(xk + 5, y + L.rowH / 2 - 4);
      ctx.stroke();
      void labels;
    }
  }
}

/**
 * Biomassa tiap tingkat pada waktu t dari deret model (interpolasi lurus;
 * tepat sama di titik deret). Titik ganda pada saat denyut (sebelum dan
 * sesudah lompatan) dibaca sebagai nilai SESUDAH lompatan. Ditulis ke `out`.
 */
export function readCascade(
  ts: readonly number[],
  biomass: readonly (readonly number[])[],
  t: number,
  out: Float64Array
): void {
  const n = ts.length;
  if (n === 0) return;
  const m = out.length;
  if (n === 1 || t <= ts[0]) {
    for (let i = 0; i < m; i++) out[i] = biomass[0][i] ?? 0;
    return;
  }
  if (t >= ts[n - 1]) {
    for (let i = 0; i < m; i++) out[i] = biomass[n - 1][i] ?? 0;
    return;
  }
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] <= t) lo = mid;
    else hi = mid;
  }
  const a = biomass[lo];
  const b = biomass[lo + 1];
  const d = ts[lo + 1] - ts[lo];
  const u = d > 0 ? (t - ts[lo]) / d : 1;
  for (let i = 0; i < m; i++) out[i] = (a[i] ?? 0) + ((b[i] ?? 0) - (a[i] ?? 0)) * u;
}
