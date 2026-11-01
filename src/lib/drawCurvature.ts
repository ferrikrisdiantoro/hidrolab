import { C, DASH, W } from "./theme.ts";
import { createLabelPlacer, dimH, dimV, ground, pen } from "./plate.ts";
import { drawField, type FieldSpec } from "./drawField.ts";
import type { Lang } from "./i18n";
import { mapFrom, rectsFrom, type PlateOut } from "./plateOut.ts";
import { shiftPlateOut } from "./plateShift.ts";

/**
 * LEMBAR FF-04: BUSUR GARIS ARUS DI SAMPING DIAGRAM TEKANAN.
 *
 * Panel pertama adalah busur ukur: satu garis arus sepanjang tali busur c
 * yang tetap, dengan puncak busur (tinggi busur s) yang bisa diseret.
 * Geometri lingkaran lewat tiga titik memberi
 *
 *   R = (c²/4 + s²) / (2s)
 *
 * dan kebalikannya s = R − √(R² − c²/4), ditulis dalam bentuk yang tidak
 * kehilangan angka pada R besar: s = (c²/4) / (R + √(R² − c²/4)).
 *
 * Tali busur DIPATOK sebesar dua kali R terkecil penggeser (0,2 m → 0,4 m):
 * setengah lingkaran (s = c/2) tepat sama dengan R terkecil, jadi seluruh
 * rentang penggeser tergambar sebagai busur yang sah dan skala panel tidak
 * bergantung pada R. Akibatnya pegangan tidak pernah saling kejar dengan
 * skalanya dan tidak perlu kunci skala selama diseret.
 *
 * Ujung lurus: s → 0 memberi R → tak hingga. Penggeser memakai R (bukan
 * 1/R) dengan batas 200 m, jadi seret yang mendatar dijepit ke 200 m oleh
 * DragLayer dengan penanda "dibatasi ke". Lewat setengah lingkaran
 * (s > c/2) rumus tiga titik berbalik naik (busur besar), jadi di sana
 * dipakai (c/2)²/s yang terus turun di bawah R terkecil dan dijepit ke
 * 0,2 m, juga dengan penanda.
 *
 * Panel kedua adalah diagram tekanan drawField apa adanya, digeser.
 */

/** Tali busur ukur, meter: dua kali R terkecil penggeser FF-04. */
export const CURVATURE_CHORD = 0.4;

/** Tinggi busur s dari jari-jari R dan tali busur c. NaN bila R < c/2. */
export function sagittaFromRadius(R: number, c: number): number {
  const h = c / 2;
  if (!(R >= h) || !(h > 0)) return NaN;
  return (h * h) / (R + Math.sqrt(Math.max(R * R - h * h, 0)));
}

/**
 * Jari-jari dari tinggi busur yang diseret. s ≤ 0 (garis lurus atau lewat
 * tali ke sisi lain) memberi tak hingga; s > c/2 memberi (c/2)²/s, yang
 * menerus dan terus turun dari c/2, supaya seret lewat setengah lingkaran
 * terbaca sebagai "lebih melengkung lagi" dan dijepit ke R terkecil.
 */
export function radiusFromSagitta(s: number, c: number): number {
  const h = c / 2;
  if (!(s > 0)) return Infinity;
  if (s > h) return (h * h) / s;
  return (h * h + s * s) / (2 * s);
}

/** Ordinat busur pada absis x (tali busur di y = 0, puncak di x = 0). */
function ordinat(x: number, R: number, s: number): number {
  const akar = Math.sqrt(Math.max(R * R - x * x, 0));
  return s - (x * x) / (R + akar);
}

export type CurvatureGauge = {
  R: number;
  convex: boolean;
  /** Tali busur, meter (CURVATURE_CHORD) */
  chord: number;
  /** Nama panel, sudah dalam bahasa aktif */
  title: string;
  radiusText: string;
  sagittaText: string;
  chordText: string;
  /** Warna jari-jari, samakan dengan tint penggeser R */
  radiusColor?: string;
  /** Warna garis arus: air, atau merah sinyal bila terangkat */
  lineColor?: string;
};

/** Panel busur di kiri bila kanvas selebar ini atau lebih, di atas bila kurang. */
const LEBAR_BERDAMPINGAN = 600;

/**
 * Menggambar busur ukur dan diagram tekanan. PlateOut:
 * - `map` = diagram tekanan (sumbu tekanan kPa, tinggi m)
 * - `maps.busur` = panel busur, meter, tali busur di y = 0, positif ke atas
 * - `anchors.apex` = puncak busur (pegangan seret)
 */
export function drawCurvaturePlate(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  g: CurvatureGauge,
  pressure: FieldSpec,
  lang: Lang
): PlateOut {
  const sisi = w >= LEBAR_BERDAMPINGAN;
  const gw = sisi ? Math.round(w * 0.36) : w;
  const gh = sisi ? h : Math.round(h * 0.4);

  /* ---------------- panel tekanan ---------------- */
  const px0 = sisi ? gw : 0;
  const py0 = sisi ? 0 : gh;
  ctx.save();
  ctx.translate(px0, py0);
  const tekanan = drawField(ctx, w - px0, h - py0, pressure, lang);
  ctx.restore();
  const out = shiftPlateOut(tekanan, px0, py0);

  /* ---------------- panel busur ---------------- */
  ground(ctx, gw, gh);
  const padL = sisi ? 18 : 16;
  const padR = sisi ? 10 : 16;
  const padT = 26;
  const padB = sisi ? 52 : 10;
  const plotW = Math.max(10, gw - padL - padR);
  const plotH = Math.max(10, gh - padT - padB);

  const c = g.chord;
  const tanda = g.convex ? 1 : -1;
  const s = sagittaFromRadius(g.R, c);
  const sOk = Number.isFinite(s) ? s : c / 2;
  const xMin = -c * 0.56;
  const xMax = c * 0.56;
  /* Ruang di sisi busur sampai sedikit di atas setengah lingkaran, dan
     ruang di sisi lain untuk ukuran tali busur. Bergantung pada arah saja,
     tidak pada R. */
  const jauh = c * 0.58;
  /* Cekung: ukuran c di atas tali, tulisannya di atas garis ukurnya, jadi
     butuh ruang lebih supaya tidak masuk baris nama panel. */
  const dekat = c * (g.convex ? 0.26 : 0.38);
  const yMin = g.convex ? -dekat : -jauh;
  const yMax = g.convex ? jauh : dekat;
  const skala = Math.min(plotW / (xMax - xMin), plotH / (yMax - yMin));
  const ox = padL + (plotW - (xMax - xMin) * skala) / 2;
  const oy = padT + (plotH - (yMax - yMin) * skala) / 2;
  const X = (x: number) => ox + (x - xMin) * skala;
  const Y = (y: number) => oy + (yMax - y) * skala;

  const taruh = createLabelPlacer(ctx, { padL, padT, plotW, plotH });

  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, padT, plotW, plotH);
  ctx.clip();

  /* Tali busur: garis bantu (sumbu), dengan tanda ujung. */
  pen(ctx, W.hair, C.ink3, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(X(-c / 2), Y(0));
  ctx.lineTo(X(c / 2), Y(0));
  ctx.stroke();
  pen(ctx, W.thin, C.ink2);
  ctx.beginPath();
  for (const xe of [-c / 2, c / 2]) {
    ctx.moveTo(X(xe), Y(0) - 4);
    ctx.lineTo(X(xe), Y(0) + 4);
  }
  ctx.stroke();

  /* Jari-jari: dari titik busur di x = −c/4 menuju pusat lengkung, dipotong
     bingkai bila pusatnya di luar panel. Kepala panah di busurnya, bentuk
     baku ukuran jari-jari. */
  const warnaR = g.radiusColor ?? C.critical;
  const xr = -c / 4;
  const yr = tanda * ordinat(xr, g.R, sOk);
  const pusatY = tanda * (sOk - g.R);
  const ux = 0 - xr;
  const uy = pusatY - yr;
  const pj = Math.hypot(ux, uy) || 1;
  const panjangPx = Math.min(g.R * skala, plotW + plotH);
  const ax = X(xr);
  const ay = Y(yr);
  const bx = ax + (ux / pj) * panjangPx;
  const by = ay - (uy / pj) * panjangPx;
  pen(ctx, W.thin, warnaR);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  kepala(ctx, bx, by, ax, ay, warnaR);
  const pusatTampak =
    g.R * skala <= plotW + plotH &&
    X(0) >= padL && X(0) <= padL + plotW && Y(pusatY) >= padT && Y(pusatY) <= padT + plotH;
  if (pusatTampak) {
    pen(ctx, W.thin, warnaR);
    ctx.beginPath();
    ctx.moveTo(X(0) - 4, Y(pusatY));
    ctx.lineTo(X(0) + 4, Y(pusatY));
    ctx.moveTo(X(0), Y(pusatY) - 4);
    ctx.lineTo(X(0), Y(pusatY) + 4);
    ctx.stroke();
  }

  /* Garis arus: polyline bentuk stabil, bukan ctx.arc, karena pada R
     200 m pusatnya ratusan ribu piksel di luar kanvas. */
  const warnaGaris = g.lineColor ?? C.water;
  pen(ctx, W.bold, warnaGaris);
  ctx.beginPath();
  const N = 48;
  let xa = 0;
  let ya = 0;
  let xb = 0;
  let yb = 0;
  for (let i = 0; i <= N; i++) {
    const xx = -c / 2 + (c * i) / N;
    const px = X(xx);
    const py = Y(tanda * ordinat(xx, g.R, sOk));
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
    if (i === N - 1) {
      xa = px;
      ya = py;
    }
    if (i === N) {
      xb = px;
      yb = py;
    }
  }
  ctx.stroke();
  kepala(ctx, xa, ya, xb, yb, warnaGaris);

  ctx.restore();

  /* Ukuran tinggi busur, di kanan pegangan supaya tidak tertutup cincinnya. */
  const xs = X(0) + 30;
  dimV(ctx, xs, Y(tanda * sOk), Y(0), g.sagittaText, C.ink2, X(0) + 10, g.convex ? "atas" : "bawah");

  /* Ukuran tali busur di sisi lawan busur. */
  const yc = Y(0) + (g.convex ? 34 : -22);
  dimH(ctx, yc, X(-c / 2), X(c / 2), g.chordText, C.ink2, undefined, [padL, padL + plotW]);

  /* Tulisan: nama panel, lalu nama jari-jari di sepanjang garisnya. */
  taruh.write(g.title, padL + plotW / 2, padT + 12, C.ink2, {});
  /* Nama jari-jari di sisi cembung busur (perpanjangan jari-jarinya ke
     luar), yaitu ruang kosong setengah lingkaran. Di sisi pusat ada ukuran
     tali busur c, dan di HP ruang di sisi itu hanya sekitar 40 piksel. */
  taruh.write(
    g.radiusText,
    ax - (ux / pj) * 16 - 4,
    ay + (uy / pj) * 16,
    warnaR,
    { align: "right" }
  );

  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(Math.round(padL) + 0.5, Math.round(padT) + 0.5, Math.round(plotW), Math.round(plotH));

  const frame = { x0: padL, y0: padT, x1: padL + plotW, y1: padT + plotH };
  const busur = mapFrom(X, Y, frame, [xMin, xMax], [yMin, yMax]);

  return {
    ...out,
    anchors: { ...out.anchors, apex: { x: X(0), y: Y(tanda * sOk) } },
    maps: { ...(out.maps ?? {}), busur },
    labels: [...(out.labels ?? []), ...rectsFrom(taruh.boxes())],
  };
}

/** Kepala panah di (x1, y1), datang dari (x0, y0). */
function kepala(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  warna: string
) {
  const sudut = Math.atan2(y1 - y0, x1 - x0);
  const k = 7;
  pen(ctx, W.thin, warna);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - k * Math.cos(sudut - 0.4), y1 - k * Math.sin(sudut - 0.4));
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - k * Math.cos(sudut + 0.4), y1 - k * Math.sin(sudut + 0.4));
  ctx.stroke();
}
