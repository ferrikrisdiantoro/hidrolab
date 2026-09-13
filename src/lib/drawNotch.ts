import { C, DASH, F, W, stencil } from "./theme";
import {
  axisTitle,
  axisValue,
  curveLabel,
  dimV,
  ground,
  hatchConcrete,
  hatchWater,
  niceStep,
  pen,
  region,
  ruling,
} from "./plate";
import { NOTCH_H_MAX, NOTCH_H_MIN, notchDischarge, fmtPlain } from "./hydraulics";
import { cl } from "./strings";
import type { Lang } from "./i18n";

export type NotchState = {
  /** Tinggi muka air di atas titik terendah takik, meter */
  H: number;
  /** Sudut takik, derajat */
  theta: number;
  Q: number;
  outOfRange: boolean;
  /** Benar bila sudut takik di luar rentang kurva Ce; seluruh kurva debit lalu tidak dapat dipercaya */
  angleOutOfRange: boolean;
};

/**
 * DUA REGISTER — tampak muka ambang di kiri, kurva debit di kanan.
 *
 * Bagian kurva di bawah tinggi muka air minimum digambar titik rapat:
 * di bawah sekitar 5 cm tegangan permukaan mulai menguasai dan rumus
 * pangkat lima per dua berhenti berlaku. Gambar menyatakan batas itu
 * alih-alih menyembunyikannya di balik pesan galat.
 */
export function drawNotch(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: NotchState,
  lang: Lang
) {
  const T = cl(lang);
  ground(ctx, w, h);

  const wide = w > 620;
  const frontW = wide ? Math.min(300, w * 0.42) : w;

  drawFront(ctx, 0, frontW, h, s, T);

  if (wide) {
    pen(ctx, W.hair, C.rule);
    ctx.beginPath();
    ctx.moveTo(Math.round(frontW) + 0.5, 14);
    ctx.lineTo(Math.round(frontW) + 0.5, h - 14);
    ctx.stroke();
    drawRating(ctx, frontW, w - frontW, h, s, T);
  }
}

/* ------------------------------------------------------------------ *
 * Tampak muka ambang
 * ------------------------------------------------------------------ */

function drawFront(
  ctx: CanvasRenderingContext2D,
  ox: number,
  w: number,
  h: number,
  s: NotchState,
  T: ReturnType<typeof cl>
) {
  const padT = 34;
  const padB = 46;
  const plotH = Math.max(10, h - padT - padB);
  const cx = ox + w / 2;
  const apexY = padT + plotH;

  region(ctx, T.notch, cx, padT - 16, C.ink3);

  // Lebar takik pada tinggi H, dari geometri sudut.
  const half = Math.tan((s.theta * Math.PI) / 360);
  const hMaxDraw = 0.45;
  // Dua belas piksel disisihkan supaya ujung atas pelat, yang digambar 16
  // piksel di atas takik, tidak naik sampai menimpa judul panel pada takik
  // sempit, tempat skalanya diatur oleh tinggi dan bukan lebar.
  const scale = Math.min((plotH - 12) / hMaxDraw, (w * 0.36) / (half * hMaxDraw));

  const topH = hMaxDraw;
  const topHalfPx = half * topH * scale;
  const topY = apexY - topH * scale;

  // Pelat ambang, digambar sebagai bidang terpotong.
  const plateL = cx - topHalfPx - 34;
  const plateR = cx + topHalfPx + 34;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(plateL, topY - 16);
  ctx.lineTo(plateR, topY - 16);
  ctx.lineTo(plateR, apexY + 26);
  ctx.lineTo(plateL, apexY + 26);
  ctx.closePath();
  // Takik dilubangi dari pelat.
  ctx.moveTo(cx, apexY);
  ctx.lineTo(cx + topHalfPx, topY);
  ctx.lineTo(cx + topHalfPx, topY - 16);
  ctx.lineTo(cx - topHalfPx, topY - 16);
  ctx.lineTo(cx - topHalfPx, topY);
  ctx.closePath();
  ctx.clip("evenodd");
  hatchConcrete(ctx, plateL, topY - 16, plateR - plateL, apexY - topY + 42, 6);
  ctx.restore();

  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  ctx.moveTo(plateL, topY - 16);
  ctx.lineTo(cx - topHalfPx, topY - 16);
  ctx.lineTo(cx, apexY);
  ctx.lineTo(cx + topHalfPx, topY - 16);
  ctx.lineTo(plateR, topY - 16);
  ctx.stroke();

  pen(ctx, W.hair, C.ink3);
  ctx.beginPath();
  ctx.moveTo(plateL, apexY + 26);
  ctx.lineTo(plateR, apexY + 26);
  ctx.moveTo(plateL, topY - 16);
  ctx.lineTo(plateL, apexY + 26);
  ctx.moveTo(plateR, topY - 16);
  ctx.lineTo(plateR, apexY + 26);
  ctx.stroke();

  // Air di dalam takik
  const wl = apexY - s.H * scale;
  const halfPx = half * s.H * scale;
  const clip = () => {
    ctx.beginPath();
    ctx.moveTo(cx, apexY);
    ctx.lineTo(cx + halfPx, wl);
    ctx.lineTo(cx - halfPx, wl);
    ctx.closePath();
  };
  ctx.save();
  clip();
  ctx.fillStyle = C.waterFill;
  ctx.fill();
  ctx.restore();
  hatchWater(ctx, clip, cx - halfPx, cx + halfPx, wl, apexY, 7);

  pen(ctx, W.bold, s.outOfRange ? C.signal : C.water);
  ctx.beginPath();
  ctx.moveTo(cx - halfPx - 22, wl);
  ctx.lineTo(cx + halfPx + 22, wl);
  ctx.stroke();

  // Dimensi tinggi muka air
  dimV(
    ctx,
    cx - topHalfPx - 22,
    wl,
    apexY,
    `H ${fmtPlain(s.H, 3)} m`,
    s.outOfRange ? C.signal : C.water
  );

  // Sudut takik
  pen(ctx, W.thin, C.critical);
  const rArc = Math.min(46, topH * scale * 0.5);
  const a0 = -Math.PI / 2 - (s.theta * Math.PI) / 360;
  const a1 = -Math.PI / 2 + (s.theta * Math.PI) / 360;
  ctx.beginPath();
  ctx.arc(cx, apexY, rArc, a0, a1);
  ctx.stroke();
  ctx.fillStyle = C.critical;
  ctx.font = F.label;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  stencil(ctx, `θ ${fmtPlain(s.theta, 0)}°`, cx, apexY - rArc - 6);

  // Garis sumbu simetri
  pen(ctx, W.hair, C.ink3, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(cx, topY - 26);
  ctx.lineTo(cx, apexY + 18);
  ctx.stroke();
  ctx.setLineDash([]);
}

/* ------------------------------------------------------------------ *
 * Kurva debit
 * ------------------------------------------------------------------ */

function drawRating(
  ctx: CanvasRenderingContext2D,
  ox: number,
  w: number,
  h: number,
  s: NotchState,
  T: ReturnType<typeof cl>
) {
  const padL = 56;
  const padR = 26;
  const padT = 30;
  const padB = 50;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = Math.max(10, h - padT - padB);

  const hMax = 0.45;
  const qMax = notchDischarge(hMax, s.theta).Q * 1.06;

  const X = (q: number) => ox + padL + (q / qMax) * plotW;
  const Y = (H: number) => padT + plotH - (H / hMax) * plotH;

  const qStep = niceStep(qMax, 4);
  const hStep = niceStep(hMax, 5);
  const hs: number[] = [];
  const vs: number[] = [];
  for (let v = 0; v <= hMax + 1e-9; v += hStep) hs.push(Y(v));
  for (let v = 0; v <= qMax + 1e-9; v += qStep) vs.push(X(v));
  ruling(ctx, ox + padL, padT, ox + padL + plotW, padT + plotH, {
    horizontal: hs,
    vertical: vs,
  });

  for (let v = 0; v <= hMax + 1e-9; v += hStep)
    axisValue(ctx, fmtPlain(v, 2), ox + padL - 8, Y(v), "right", "middle");
  for (let v = 0; v <= qMax + 1e-9; v += qStep)
    axisValue(ctx, fmtPlain(v, 3), X(v), padT + plotH + 9, "center", "top");

  region(ctx, T.ratingCurve, ox + padL + plotW / 2, padT - 14, C.ink3);

  // Daerah di luar batas keberlakuan, di bawah 5 cm dan di atas 38 cm.
  // Keduanya diarsir dan diberi nama; batasnya digambar sebagai garis.
  const yBawah = Y(NOTCH_H_MIN);
  const yAtas = Y(NOTCH_H_MAX);
  ctx.fillStyle = C.paperSunk;
  ctx.globalAlpha = 0.7;
  ctx.fillRect(ox + padL, yBawah, plotW, padT + plotH - yBawah);
  ctx.fillRect(ox + padL, padT, plotW, yAtas - padT);
  ctx.globalAlpha = 1;
  pen(ctx, W.hair, C.ruleStrong, DASH.axis);
  for (const yy of [yBawah, yAtas]) {
    ctx.beginPath();
    ctx.moveTo(ox + padL, Math.round(yy) + 0.5);
    ctx.lineTo(ox + padL + plotW, Math.round(yy) + 0.5);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  region(ctx, T.belowRange, ox + padL + plotW / 2, (yBawah + padT + plotH) / 2, C.ink3);
  region(ctx, T.belowRange, ox + padL + plotW / 2, (yAtas + padT) / 2, C.ink3);

  // Kurva: menerus di dalam rentang, titik rapat di luar rentang. Bila
  // sudutnya di luar rentang kurva Ce, seluruh kurvanya titik rapat.
  const segmen = s.angleOutOfRange
    ? [{ from: 0.002, to: hMax, dash: DASH.invalid, wgt: W.thin }]
    : [
        { from: NOTCH_H_MIN, to: NOTCH_H_MAX, dash: DASH.solid, wgt: W.bold },
        { from: 0.002, to: NOTCH_H_MIN, dash: DASH.invalid, wgt: W.thin },
        { from: NOTCH_H_MAX, to: hMax, dash: DASH.invalid, wgt: W.thin },
      ];
  for (const seg of segmen) {
    pen(ctx, seg.wgt, C.water, seg.dash);
    ctx.beginPath();
    const n = 120;
    for (let i = 0; i <= n; i++) {
      const H = seg.from + (i / n) * (seg.to - seg.from);
      const q = notchDischarge(H, s.theta).Q;
      i ? ctx.lineTo(X(q), Y(H)) : ctx.moveTo(X(q), Y(H));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Jalur baca dan titik operasi
  if (s.H > 0 && s.H <= hMax && s.Q <= qMax) {
    const px = X(s.Q);
    const py = Y(s.H);
    const tint = s.outOfRange ? C.signal : C.water;

    pen(ctx, W.thin, tint, DASH.axis);
    ctx.beginPath();
    ctx.moveTo(ox + padL, py);
    ctx.lineTo(px, py);
    ctx.lineTo(px, padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    pen(ctx, W.thin, tint);
    ctx.fillStyle = C.sheet;
    ctx.beginPath();
    ctx.moveTo(px, py - 5);
    ctx.lineTo(px + 5, py);
    ctx.lineTo(px, py + 5);
    ctx.lineTo(px - 5, py);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    curveLabel(ctx, `Q ${fmtPlain(s.Q, 4)}`, px + 10, py - 10, tint);
  }

  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(ox + padL) + 0.5,
    Math.round(padT) + 0.5,
    Math.round(plotW),
    Math.round(plotH)
  );

  axisTitle(ctx, T.axDischarge, ox + padL + plotW / 2, padT + plotH + 34);
  axisTitle(ctx, T.axHead, ox + 16, padT + plotH / 2, -Math.PI / 2);
}
