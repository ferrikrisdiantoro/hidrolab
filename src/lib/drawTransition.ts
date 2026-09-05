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
import { criticalDepth, specificEnergy, type TransitionResult } from "./hydraulics";
import { cl } from "./strings";
import type { Lang } from "./i18n";

export type TransitionState = {
  r: TransitionResult;
  b1: number;
  b2: number;
  y1: number;
  dz: number;
};

/**
 * TIGA REGISTER DALAM SATU LEMBAR.
 *
 * Kiri atas potongan memanjang, kiri bawah tampak atas, kanan kurva energi
 * spesifik. Ketiganya perlu bersama karena transisi tidak dapat dijelaskan
 * oleh salah satunya sendirian: perubahan lebar hanya terlihat dari atas,
 * perubahan elevasi hanya terlihat dari samping, dan alasan mengapa muka air
 * naik atau turun hanya terlihat pada kurva energinya.
 *
 * Gesekan pada bentang transisi diabaikan, jadi garis energi digambar
 * MENDATAR. Kalau suatu saat gesekan ikut dihitung, garis itu harus miring,
 * dan gambarnya ikut berubah dengan sendirinya.
 */
export function drawTransition(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: TransitionState,
  lang: Lang
) {
  const T = cl(lang);
  ground(ctx, w, h);

  const wide = w > 700;
  const kurvaW = wide ? Math.max(260, w * 0.36) : 0;
  const kiriW = w - kurvaW;

  const potonganH = wide ? h * 0.64 : h * 0.62;
  drawLongitudinal(ctx, 0, 0, kiriW, potonganH, s, T);
  drawPlan(ctx, 0, potonganH, kiriW, h - potonganH, s, T);

  if (wide) {
    pen(ctx, W.hair, C.rule);
    ctx.beginPath();
    ctx.moveTo(Math.round(kiriW) + 0.5, 12);
    ctx.lineTo(Math.round(kiriW) + 0.5, h - 12);
    ctx.stroke();
    drawEnergyCurve(ctx, kiriW, kurvaW, h, s, T);
  }
}

/* ------------------------------------------------------------------ *
 * Potongan memanjang
 * ------------------------------------------------------------------ */

function drawLongitudinal(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  w: number,
  h: number,
  s: TransitionState,
  T: ReturnType<typeof cl>
) {
  const { r, y1, dz } = s;
  const padL = 54;
  const padR = 26;
  const padT = 26;
  const padB = 26;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = Math.max(10, h - padT - padB);
  const baseY = oy + padT + plotH;

  // Elevasi diukur dari dasar hulu. Garis energi berada pada elevasi E1.
  const zTop = Math.max(r.E1, dz + (r.choked ? r.Emin2 : r.y2), y1) * 1.22;
  const Z = (z: number) => baseY - (z / zTop) * plotH;
  const X = (f: number) => ox + padL + f * plotW;

  // Tiga daerah: hulu, transisi, hilir.
  const xa = 0.34;
  const xb = 0.5;
  const bedAt = (f: number) =>
    f <= xa ? 0 : f >= xb ? dz : (dz * (f - xa)) / (xb - xa);
  const depthAt = (f: number) => {
    if (f <= xa) return y1;
    if (f >= xb) return r.choked ? r.Emin2 / 1.5 : r.y2;
    const t = (f - xa) / (xb - xa);
    const e = t * t * (3 - 2 * t);
    return y1 + ((r.choked ? r.Emin2 / 1.5 : r.y2) - y1) * e;
  };

  /* kisi */
  const zStep = niceStep(zTop, 4);
  const hs: number[] = [];
  for (let v = 0; v <= zTop + 1e-9; v += zStep) hs.push(Z(v));
  ruling(ctx, ox + padL, oy + padT, ox + padL + plotW, baseY, { horizontal: hs });
  for (let v = 0; v <= zTop + 1e-9; v += zStep)
    axisValue(ctx, v.toFixed(1), ox + padL - 8, Z(v), "right", "middle");
  axisTitle(ctx, T.elevation, ox + 16, oy + padT + plotH / 2, -Math.PI / 2);

  /* badan air */
  const N = 160;
  const clipWater = () => {
    ctx.beginPath();
    ctx.moveTo(X(0), Z(bedAt(0)));
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      ctx.lineTo(X(f), Z(bedAt(f) + depthAt(f)));
    }
    for (let i = N; i >= 0; i--) {
      const f = i / N;
      ctx.lineTo(X(f), Z(bedAt(f)));
    }
    ctx.closePath();
  };
  ctx.save();
  clipWater();
  ctx.fillStyle = C.waterFill;
  ctx.fill();
  ctx.restore();
  hatchWater(ctx, clipWater, X(0), X(1), oy + padT + 4, baseY, 9);

  /* garis energi, mendatar karena gesekan diabaikan */
  pen(ctx, W.thin, C.energy, DASH.hidden);
  ctx.beginPath();
  ctx.moveTo(X(0), Z(r.E1));
  ctx.lineTo(X(1), Z(r.E1));
  ctx.stroke();
  ctx.setLineDash([]);
  curveLabel(ctx, T.energyLine, X(0.02), Z(r.E1) - 9, C.energy);

  /* muka air */
  pen(ctx, W.bold, r.choked ? C.signal : C.water);
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const f = i / N;
    const p: [number, number] = [X(f), Z(bedAt(f) + depthAt(f))];
    i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
  }
  ctx.stroke();

  /* kedalaman kritis di penampang hilir */
  pen(ctx, W.thin, C.critical, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(X(xb) - 8, Z(dz + r.yc2));
  ctx.lineTo(X(1), Z(dz + r.yc2));
  ctx.stroke();
  ctx.setLineDash([]);
  curveLabel(ctx, `yc ${r.yc2.toFixed(2)} m`, X(1) - 4, Z(dz + r.yc2) - 10, C.critical, "right");

  /* dasar saluran */
  const bedPts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const f = i / N;
    bedPts.push([X(f), Z(bedAt(f))]);
  }
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bedPts[0][0], bedPts[0][1]);
  for (const [x, y] of bedPts) ctx.lineTo(x, y);
  ctx.lineTo(X(1), baseY);
  ctx.lineTo(X(0), baseY);
  ctx.closePath();
  ctx.clip();
  hatchConcrete(ctx, ox + padL, oy + padT, plotW, plotH);
  ctx.restore();

  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  bedPts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();

  /* dimensi kenaikan dasar */
  if (Math.abs(dz) > zTop * 0.02) {
    dimV(ctx, X(xb) + 14, Z(dz), Z(0), `Δz ${dz.toFixed(3)} m`, C.ink2);
  }
  dimV(ctx, X(xa * 0.45), Z(y1), Z(0), `y₁ ${y1.toFixed(3)} m`, C.water);
  if (!r.choked) {
    dimV(
      ctx,
      X(0.78),
      Z(dz + r.y2),
      Z(dz),
      `y₂ ${r.y2.toFixed(3)} m`,
      C.water
    );
  }

  /* garis sumbu penampang transisi */
  pen(ctx, W.hair, C.ink3, DASH.axis);
  ctx.beginPath();
  for (const f of [xa, xb]) {
    ctx.moveTo(X(f), oy + padT);
    ctx.lineTo(X(f), baseY);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  /* nama daerah */
  region(ctx, T.upstream, X(xa / 2), oy + padT + 12, C.ink3);
  region(
    ctx,
    r.choked ? T.choked : r.branch === "subkritis" ? T.subcritical : T.supercritical,
    X((xb + 1) / 2),
    oy + padT + 12,
    r.choked ? C.signal : C.ink3
  );
}

/* ------------------------------------------------------------------ *
 * Tampak atas
 * ------------------------------------------------------------------ */

function drawPlan(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  w: number,
  h: number,
  s: TransitionState,
  T: ReturnType<typeof cl>
) {
  const padL = 54;
  const padR = 26;
  const plotW = Math.max(10, w - padL - padR);
  const cy = oy + h / 2 + 4;
  const X = (f: number) => ox + padL + f * plotW;

  const bMax = Math.max(s.b1, s.b2);
  const skala = Math.min((h - 34) / bMax, plotW * 0.06);
  const half = (b: number) => (b / 2) * skala;

  const xa = 0.34;
  const xb = 0.5;
  const bAt = (f: number) =>
    f <= xa ? s.b1 : f >= xb ? s.b2 : s.b1 + ((s.b2 - s.b1) * (f - xa)) / (xb - xa);

  region(ctx, T.planView, ox + padL + plotW / 2, oy + 10, C.ink3);

  /* air di dalam saluran */
  const N = 120;
  const clip = () => {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      ctx.lineTo(X(f), cy - half(bAt(f)));
    }
    for (let i = N; i >= 0; i--) {
      const f = i / N;
      ctx.lineTo(X(f), cy + half(bAt(f)));
    }
    ctx.closePath();
  };
  ctx.save();
  clip();
  ctx.fillStyle = C.waterFill;
  ctx.fill();
  ctx.restore();

  /* dinding saluran */
  pen(ctx, W.bold, C.ink);
  for (const tanda of [-1, 1]) {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      const y = cy + tanda * half(bAt(f));
      i ? ctx.lineTo(X(f), y) : ctx.moveTo(X(f), y);
    }
    ctx.stroke();
  }

  /* sumbu saluran */
  pen(ctx, W.hair, C.ink3, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(X(0), cy);
  ctx.lineTo(X(1), cy);
  ctx.stroke();
  ctx.setLineDash([]);

  /* dimensi lebar */
  dimV(ctx, X(xa * 0.45), cy - half(s.b1), cy + half(s.b1), `b₁ ${s.b1.toFixed(2)} m`, C.ink2);
  dimV(ctx, X(0.78), cy - half(s.b2), cy + half(s.b2), `b₂ ${s.b2.toFixed(2)} m`, C.ink2);
}

/* ------------------------------------------------------------------ *
 * Kurva energi spesifik
 * ------------------------------------------------------------------ */

function drawEnergyCurve(
  ctx: CanvasRenderingContext2D,
  ox: number,
  w: number,
  h: number,
  s: TransitionState,
  T: ReturnType<typeof cl>
) {
  const { r } = s;
  const padL = 50;
  const padR = 20;
  const padT = 30;
  const padB = 48;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = Math.max(10, h - padT - padB);
  const baseY = padT + plotH;

  const yMax = Math.max(s.y1, r.y2 || 0, r.yc2, r.yc1) * 2.1;
  const eMax = Math.max(r.E1, r.Emin2) * 1.35;
  const X = (E: number) => ox + padL + (E / eMax) * plotW;
  const Y = (y: number) => baseY - (y / yMax) * plotH;

  const es = niceStep(eMax, 4);
  const ys = niceStep(yMax, 4);
  const vs: number[] = [];
  const hs: number[] = [];
  for (let v = 0; v <= eMax + 1e-9; v += es) vs.push(X(v));
  for (let v = 0; v <= yMax + 1e-9; v += ys) hs.push(Y(v));
  ruling(ctx, ox + padL, padT, ox + padL + plotW, baseY, {
    vertical: vs,
    horizontal: hs,
  });
  for (let v = 0; v <= eMax + 1e-9; v += es)
    axisValue(ctx, v.toFixed(1), X(v), baseY + 9, "center", "top");
  for (let v = 0; v <= yMax + 1e-9; v += ys)
    axisValue(ctx, v.toFixed(1), ox + padL - 8, Y(v), "right", "middle");

  /* asimtot E = y */
  const lim = Math.min(yMax, eMax);
  pen(ctx, W.hair, C.ink3, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(X(0), Y(0));
  ctx.lineTo(X(lim), Y(lim));
  ctx.stroke();
  ctx.setLineDash([]);

  /* kurva untuk debit satuan hulu dan hilir */
  const gambarKurva = (q: number, tebal: number, warna: string) => {
    pen(ctx, tebal, warna);
    ctx.beginPath();
    let mulai = false;
    for (let i = 1; i <= 500; i++) {
      const y = (i / 500) * yMax;
      const E = specificEnergy(y, q);
      if (E > eMax) {
        mulai = false;
        continue;
      }
      if (!mulai) {
        ctx.moveTo(X(E), Y(y));
        mulai = true;
      } else ctx.lineTo(X(E), Y(y));
    }
    ctx.stroke();
  };

  const lebarBeda = Math.abs(r.q1 - r.q2) > 1e-9;
  if (lebarBeda) gambarKurva(r.q1, W.thin, C.ink3);
  gambarKurva(r.q2, W.bold, C.water);

  if (lebarBeda) {
    const ycc1 = criticalDepth(r.q1);
    curveLabel(ctx, "q₁", X(1.5 * ycc1) - 6, Y(ycc1) - 11, C.ink3, "right");
    curveLabel(ctx, "q₂", X(r.Emin2) + 7, Y(r.yc2) - 11, C.water);
  }

  /* garis energi tersedia */
  for (const [E, warna, label] of [
    [r.E1, C.energy, "E₁"],
    [r.E2, r.choked ? C.signal : C.energy, "E₂"],
  ] as [number, string, string][]) {
    if (E <= 0 || E > eMax) continue;
    pen(ctx, W.thin, warna, DASH.axis);
    ctx.beginPath();
    ctx.moveTo(X(E), padT);
    ctx.lineTo(X(E), baseY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = warna;
    ctx.font = F.labelSm;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    stencil(ctx, label, X(E), padT + 2);
  }

  /* titik operasi */
  const titik = (E: number, y: number, warna: string, isi: boolean) => {
    if (!Number.isFinite(y) || y <= 0 || E > eMax || y > yMax) return;
    pen(ctx, W.thin, warna);
    ctx.fillStyle = isi ? warna : C.sheet;
    ctx.beginPath();
    ctx.moveTo(X(E), Y(y) - 5);
    ctx.lineTo(X(E) + 5, Y(y));
    ctx.lineTo(X(E), Y(y) + 5);
    ctx.lineTo(X(E) - 5, Y(y));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  titik(r.E1, s.y1, C.ink2, false);
  titik(r.E2, r.y2, r.choked ? C.signal : C.water, true);

  /* kedalaman kritis hilir */
  pen(ctx, W.thin, C.critical, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(ox + padL, Y(r.yc2));
  ctx.lineTo(ox + padL + plotW, Y(r.yc2));
  ctx.stroke();
  ctx.setLineDash([]);
  curveLabel(ctx, "yc", ox + padL + 4, Y(r.yc2) - 10, C.critical);

  if (r.choked) {
    region(ctx, T.choked, ox + padL + plotW / 2, padT + plotH * 0.5, C.signal);
  }

  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(ox + padL) + 0.5,
    Math.round(padT) + 0.5,
    Math.round(plotW),
    Math.round(plotH)
  );
  axisTitle(ctx, T.axEnergy, ox + padL + plotW / 2, baseY + 32);
  axisTitle(ctx, T.axDepthShort, ox + 14, padT + plotH / 2, -Math.PI / 2);
}
