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
import type { GvfResult } from "./hydraulics";
import { cl } from "./strings";
import type { Lang } from "./i18n";

export type GvfDrawState = {
  result: GvfResult;
  /** Panjang bentang yang digambar, meter */
  length: number;
  S0: number;
};

/**
 * POTONGAN MEMANJANG — profil aliran berubah lambat.
 *
 * Dasar saluran digambar miring sesuai S0, dan kedalaman diukur tegak
 * dari dasar itu. Skala tegak dilebihkan terhadap skala mendatar, seperti
 * lazimnya profil memanjang saluran; angka pelebihannya dicantumkan di
 * kop gambar agar tidak menyesatkan.
 *
 * Bagian profil yang mendekati kedalaman kritis digambar titik rapat:
 * di situ penyebut (1 − Fr²) menuju nol dan persamaan berubah lambat
 * kehilangan keberlakuannya.
 */
export function drawGvf(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: GvfDrawState,
  lang: Lang
) {
  const T = cl(lang);
  const { result: r, length: L, S0 } = s;

  const padL = 62;
  const padR = 34;
  const padT = 28;
  const padB = 52;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = Math.max(10, h - padT - padB);

  const zb = (x: number) => (L - x) * S0;
  const zbMax = zb(0);

  const maxSurface = r.points.reduce(
    (m, p) => Math.max(m, zb(p.x) + p.y),
    zbMax + r.yc
  );
  const zTop = Math.max(maxSurface, zbMax + r.y0) * 1.12;

  const X = (x: number) => padL + (x / L) * plotW;
  const Z = (z: number) => padT + plotH - (z / zTop) * plotH;

  ground(ctx, w, h);

  /* ---------------- kisi ---------------- */
  const zStep = niceStep(zTop, 5);
  const xStep = niceStep(L, 6);
  const hs: number[] = [];
  const vs: number[] = [];
  for (let v = 0; v <= zTop + 1e-9; v += zStep) hs.push(Z(v));
  for (let x = 0; x <= L + 1e-9; x += xStep) vs.push(X(x));
  ruling(ctx, padL, padT, padL + plotW, padT + plotH, {
    horizontal: hs,
    vertical: vs,
  });

  for (let v = 0; v <= zTop + 1e-9; v += zStep)
    axisValue(ctx, v.toFixed(1), padL - 8, Z(v), "right", "middle");
  for (let x = 0; x <= L + 1e-9; x += xStep)
    axisValue(ctx, String(Math.round(x)), X(x), padT + plotH + 9, "center", "top");

  axisTitle(ctx, T.axDistance, padL + plotW / 2, padT + plotH + 34);
  axisTitle(ctx, T.elevation, 18, padT + plotH / 2, -Math.PI / 2);

  /* ---------------- badan air ---------------- */
  const clipWater = () => {
    ctx.beginPath();
    ctx.moveTo(X(r.points[0].x), Z(zb(r.points[0].x)));
    for (const p of r.points) ctx.lineTo(X(p.x), Z(zb(p.x) + p.y));
    for (let i = r.points.length - 1; i >= 0; i--)
      ctx.lineTo(X(r.points[i].x), Z(zb(r.points[i].x)));
    ctx.closePath();
  };

  ctx.save();
  clipWater();
  ctx.fillStyle = C.waterFill;
  ctx.fill();
  ctx.restore();

  hatchWater(ctx, clipWater, padL, padL + plotW, padT + 4, padT + plotH, 10);

  /* ---------------- garis kedalaman normal dan kritis ---------------- */
  pen(ctx, W.thin, C.water, DASH.hidden);
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) {
    const x = (i / 80) * L;
    const z = Z(zb(x) + r.y0);
    i ? ctx.lineTo(X(x), z) : ctx.moveTo(X(x), z);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  curveLabel(ctx, `y₀ ${r.y0.toFixed(2)} m`, X(L * 0.06), Z(zb(L * 0.06) + r.y0) - 10, C.water);

  pen(ctx, W.thin, C.critical, DASH.axis);
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) {
    const x = (i / 80) * L;
    const z = Z(zb(x) + r.yc);
    i ? ctx.lineTo(X(x), z) : ctx.moveTo(X(x), z);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  curveLabel(
    ctx,
    `yc ${r.yc.toFixed(2)} m`,
    X(L * 0.06),
    Z(zb(L * 0.06) + r.yc) + 11,
    C.critical
  );

  /* ---------------- muka air ---------------- */
  /* Ruas yang jauh dari kondisi kritis digambar menerus; ruas yang
     mendekatinya digambar titik rapat, karena di sana persamaannya
     tidak lagi berlaku. */
  let run: { pts: [number, number][]; invalid: boolean } | null = null;
  const flush = () => {
    if (!run || run.pts.length < 2) return;
    pen(
      ctx,
      run.invalid ? W.thin : W.bold,
      C.water,
      run.invalid ? DASH.invalid : DASH.solid
    );
    ctx.beginPath();
    run.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.setLineDash([]);
  };

  for (const p of r.points) {
    const pt: [number, number] = [X(p.x), Z(zb(p.x) + p.y)];
    if (!run || run.invalid !== p.nearCritical) {
      if (run) {
        run.pts.push(pt);
        flush();
      }
      run = { pts: [pt], invalid: p.nearCritical };
    } else {
      run.pts.push(pt);
    }
  }
  flush();

  /* ---------------- dasar saluran ---------------- */
  const bedPts: [number, number][] = [];
  for (let i = 0; i <= 60; i++) {
    const x = (i / 60) * L;
    bedPts.push([X(x), Z(zb(x))]);
  }
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bedPts[0][0], bedPts[0][1]);
  for (const [x, y] of bedPts) ctx.lineTo(x, y);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.lineTo(padL, padT + plotH);
  ctx.closePath();
  ctx.clip();
  hatchConcrete(ctx, padL, padT, plotW, plotH);
  ctx.restore();

  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  bedPts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();

  /* ---------------- penampang kendali ---------------- */
  const ctrl = r.direction === "hulu" ? r.points[r.points.length - 1] : r.points[0];
  const cxp = X(ctrl.x);
  pen(ctx, W.thin, C.signal, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(cxp, padT);
  ctx.lineTo(cxp, Z(zb(ctrl.x)));
  ctx.stroke();
  ctx.setLineDash([]);

  dimV(
    ctx,
    cxp + (r.direction === "hulu" ? -26 : 26),
    Z(zb(ctrl.x) + ctrl.y),
    Z(zb(ctrl.x)),
    `${ctrl.y.toFixed(2)} m`,
    C.signal
  );
  region(ctx, T.control, cxp, padT + 12, C.signal);

  /* ---------------- nama profil ---------------- */
  const mid = r.points[Math.floor(r.points.length / 2)];
  ctx.fillStyle = C.ink;
  ctx.font = '700 15px "Public Sans", system-ui, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  stencil(ctx, r.profile, X(mid.x), Z(zb(mid.x) + mid.y) - 16, 2);

  region(
    ctx,
    r.mild ? T.subcritical : T.supercritical,
    X(mid.x),
    Z(zb(mid.x) + mid.y) - 34,
    C.ink3
  );

  /* ---------------- bingkai ---------------- */
  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(padL) + 0.5,
    Math.round(padT) + 0.5,
    Math.round(plotW),
    Math.round(plotH)
  );
}
