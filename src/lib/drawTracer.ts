import { C, DASH, F, W, stencil } from "./theme";
import {
  axisTitle,
  axisValue,
  curveLabel,
  dimH,
  ground,
  niceStep,
  pen,
  region,
  ruling,
} from "./plate";
import type { TracerPoint } from "./hydraulics";
import { cl } from "./strings";
import type { Lang } from "./i18n";

export type TracerDrawState = {
  points: TracerPoint[];
  cPeak: number;
  tPeak: number;
  tTravel: number;
  /** Luas di bawah kurva, mg per liter dikali detik */
  area: number;
  /** Debit yang dihitung kembali dari luas itu */
  Qgulp: number;
  /** Kurva pembanding pada sebaran yang lebih besar, bila diminta */
  compare?: TracerPoint[];
  /** Kepekatan mantap cara laju tetap, bila diminta */
  plateau?: number;
  /** Pencampuran belum cukup pada jarak yang dipilih */
  outOfRange: boolean;
};

/**
 * KURVA KEPEKATAN TERHADAP WAKTU, DENGAN LUASNYA DIARSIR.
 *
 * Yang penting pada lembar ini bukan bentuk kurvanya melainkan LUAS di
 * bawahnya, karena luas itulah yang menyimpan debitnya. Maka luas itu yang
 * diarsir dan diberi angka, bukan puncaknya, walaupun puncak yang paling
 * menarik perhatian mata.
 *
 * Kurva pembanding pada sebaran yang lebih besar digambar sebagai garis
 * khayal. Ia lebih pendek dan lebih lebar, tetapi luasnya sama, dan
 * kesamaan itu justru inti dari cara pengukuran ini: sebaran memanjang
 * tidak perlu diketahui sama sekali.
 */
export function drawTracer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: TracerDrawState,
  lang: Lang
) {
  const T = cl(lang);
  ground(ctx, w, h);

  const padL = 64;
  const padR = 30;
  const padT = 28;
  const padB = 52;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = Math.max(10, h - padT - padB);

  const t0 = s.points[0].t;
  const t1 = s.points[s.points.length - 1].t;
  const spanT = Math.max(t1 - t0, 1e-6);
  const cTop = Math.max(
    s.cPeak * 1.22,
    (s.plateau ?? 0) * 1.35,
    1e-6
  );

  const X = (t: number) => padL + ((t - t0) / spanT) * plotW;
  const Y = (c: number) => padT + plotH - (c / cTop) * plotH;

  /* ---------------- kisi dan sumbu ---------------- */
  const cStep = niceStep(cTop, 5);
  const tStep = niceStep(spanT, 6);
  const hs: number[] = [];
  const vs: number[] = [];
  for (let v = 0; v <= cTop + 1e-9; v += cStep) hs.push(Y(v));
  for (let v = Math.ceil(t0 / tStep) * tStep; v <= t1 + 1e-9; v += tStep)
    vs.push(X(v));
  ruling(ctx, padL, padT, padL + plotW, padT + plotH, {
    horizontal: hs,
    vertical: vs,
  });

  const cDigits = cStep < 0.1 ? 2 : cStep < 1 ? 1 : 0;
  for (let v = 0; v <= cTop + 1e-9; v += cStep)
    axisValue(ctx, v.toFixed(cDigits), padL - 8, Y(v), "right", "middle");
  for (let v = Math.ceil(t0 / tStep) * tStep; v <= t1 + 1e-9; v += tStep)
    axisValue(ctx, String(Math.round(v)), X(v), padT + plotH + 9, "center", "top");

  axisTitle(ctx, T.axTime, padL + plotW / 2, padT + plotH + 34);
  axisTitle(ctx, T.axConc, 18, padT + plotH / 2, -Math.PI / 2);

  /* ---------------- luas di bawah kurva ---------------- */
  const jalurLuas = () => {
    ctx.beginPath();
    ctx.moveTo(X(s.points[0].t), Y(0));
    for (const p of s.points) ctx.lineTo(X(p.t), Y(p.c));
    ctx.lineTo(X(s.points[s.points.length - 1].t), Y(0));
    ctx.closePath();
  };
  ctx.save();
  jalurLuas();
  ctx.fillStyle = C.waterFillDeep;
  ctx.fill();
  ctx.restore();

  // Arsiran mendatar, konvensi air, dipakai supaya luasnya terbaca sebagai
  // besaran dan bukan sebagai bayangan.
  ctx.save();
  jalurLuas();
  ctx.clip();
  pen(ctx, W.hair, C.water, [7, 6]);
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  let baris = 0;
  for (let y = padT; y <= padT + plotH; y += 9) {
    const yy = Math.round(y) + 0.5;
    ctx.moveTo(padL + (baris % 2 === 0 ? 0 : 6), yy);
    ctx.lineTo(padL + plotW, yy);
    baris++;
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.restore();

  /* ---------------- kurva pembanding ---------------- */
  if (s.compare && s.compare.length > 1) {
    pen(ctx, W.hair, C.ink3, DASH.phantom);
    ctx.beginPath();
    s.compare.forEach((p, i) =>
      i ? ctx.lineTo(X(p.t), Y(p.c)) : ctx.moveTo(X(p.t), Y(p.c))
    );
    ctx.stroke();
    ctx.setLineDash([]);
    const tengah = s.compare[Math.floor(s.compare.length * 0.72)];
    curveLabel(ctx, T.wider, X(tengah.t), Y(tengah.c) - 10, C.ink3);
  }

  /* ---------------- kepekatan mantap cara laju tetap ---------------- */
  if (s.plateau !== undefined && s.plateau > 0) {
    pen(ctx, W.thin, C.energy, DASH.hidden);
    ctx.beginPath();
    ctx.moveTo(padL, Y(s.plateau));
    ctx.lineTo(padL + plotW, Y(s.plateau));
    ctx.stroke();
    ctx.setLineDash([]);
    curveLabel(
      ctx,
      `${T.steadyRate} ${s.plateau.toFixed(2)} mg/l`,
      padL + plotW - 4,
      Y(s.plateau) - 10,
      C.energy,
      "right"
    );
  }

  /* ---------------- kurva utama ---------------- */
  pen(
    ctx,
    s.outOfRange ? W.thin : W.bold,
    C.water,
    s.outOfRange ? DASH.invalid : DASH.solid
  );
  ctx.beginPath();
  s.points.forEach((p, i) =>
    i ? ctx.lineTo(X(p.t), Y(p.c)) : ctx.moveTo(X(p.t), Y(p.c))
  );
  ctx.stroke();
  ctx.setLineDash([]);

  /* ---------------- puncak dan waktu tempuh ---------------- */
  pen(ctx, W.thin, C.signal, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(X(s.tPeak), Y(0));
  ctx.lineTo(X(s.tPeak), Y(s.cPeak));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = C.signal;
  ctx.beginPath();
  ctx.arc(X(s.tPeak), Y(s.cPeak), 3, 0, Math.PI * 2);
  ctx.fill();
  region(ctx, T.peak, X(s.tPeak), Y(s.cPeak) - 14, C.signal);

  // Waktu tempuh rata-rata ditandai terpisah dari waktu puncak, karena
  // keduanya memang tidak berimpit: kurvanya menjulur ke kanan.
  if (s.tTravel >= t0 && s.tTravel <= t1) {
    pen(ctx, W.hair, C.critical, DASH.axis);
    ctx.beginPath();
    ctx.moveTo(X(s.tTravel), padT);
    ctx.lineTo(X(s.tTravel), Y(0));
    ctx.stroke();
    ctx.setLineDash([]);
    curveLabel(
      ctx,
      `L / u = ${s.tTravel.toFixed(0)} s`,
      X(s.tTravel) + 5,
      padT + 12,
      C.critical
    );
  }

  dimH(
    ctx,
    Y(s.cPeak * 0.34),
    X(s.points[0].t),
    X(s.points[s.points.length - 1].t),
    `${T.areaUnder} ${s.area.toFixed(1)} mg·s/l`,
    C.water
  );

  /* ---------------- angka utama di dalam gambar ---------------- */
  ctx.fillStyle = C.ink;
  ctx.font = F.heading;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  stencil(ctx, `Q = ${s.Qgulp.toFixed(3)} m3/s`, padL + 12, padT + 10, 2);

  /* ---------------- bingkai ---------------- */
  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(padL) + 0.5,
    Math.round(padT) + 0.5,
    Math.round(plotW),
    Math.round(plotH)
  );
}
