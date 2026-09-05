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
import { momentumFunction, specificEnergy } from "./hydraulics";
import { cl } from "./strings";
import type { Lang } from "./i18n";

export type EnergyMomentumState = {
  /** Debit satuan, meter persegi per detik */
  q: number;
  /** Kedalaman sebelum loncatan */
  y1: number;
  /** Kedalaman sesudah loncatan */
  y2: number;
  yc: number;
  /** Benar bila alirannya belum superkritis, sehingga loncatan tidak terbentuk */
  noJump: boolean;
};

/**
 * DUA KURVA BERDAMPINGAN PADA SATU SUMBU KEDALAMAN.
 *
 * Inilah satu-satunya susunan yang membuat pertanyaan lembar ini terjawab
 * dengan melihat, bukan dengan membaca angka. Sumbu tegaknya sama untuk kedua
 * panel, sehingga satu garis mendatar pada kedalaman tertentu memotong kedua
 * kurva pada ketinggian yang persis sama.
 *
 * Yang harus terbaca dalam sekali pandang ada dua:
 *
 * - Pada panel momentum, SATU garis tegak menyentuh kurva DUA kali. Kedua
 *   kedalaman itu punya fungsi momentum yang sama, dan itulah syarat berdirinya
 *   loncatan air.
 * - Pada panel energi, kedua kedalaman yang sama jatuh pada dua nilai energi
 *   yang BERBEDA. Jarak mendatar di antaranya adalah energi yang teredam.
 *
 * Kalau kedua panel digambar terpisah, hubungan itu harus dijelaskan dengan
 * kalimat. Digambar berdampingan, ia tidak perlu dijelaskan.
 */
export function drawEnergyMomentum(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: EnergyMomentumState,
  lang: Lang
) {
  const T = cl(lang);
  ground(ctx, w, h);

  const padL = 58;
  const padR = 22;
  const padT = 26;
  const padB = 52;
  const sela = 46;

  const lebarTotal = Math.max(20, w - padL - padR - sela);
  const panelW = lebarTotal / 2;
  const plotH = Math.max(10, h - padT - padB);
  const baseY = padT + plotH;

  const yMax = Math.max(s.y2 * 1.45, s.yc * 3, s.y1 * 3, 0.4);
  const Y = (y: number) => baseY - (y / yMax) * plotH;

  const Emin = 1.5 * s.yc;
  const Mmin = 1.5 * s.yc * s.yc;
  const eMax = Math.max(specificEnergy(yMax, s.q), Emin * 2.2);
  const mMax = Math.max(momentumFunction(yMax, s.q), Mmin * 2.2);

  const kiriX0 = padL;
  const kananX0 = padL + panelW + sela;
  const XE = (E: number) => kiriX0 + (E / eMax) * panelW;
  const XM = (M: number) => kananX0 + (M / mMax) * panelW;

  /* ---------------- kisi kedua panel ---------------- */
  const ys = niceStep(yMax, 5);
  const hs: number[] = [];
  for (let v = 0; v <= yMax + 1e-9; v += ys) hs.push(Y(v));

  const es = niceStep(eMax, 4);
  const ms = niceStep(mMax, 4);
  const vsE: number[] = [];
  const vsM: number[] = [];
  for (let v = 0; v <= eMax + 1e-9; v += es) vsE.push(XE(v));
  for (let v = 0; v <= mMax + 1e-9; v += ms) vsM.push(XM(v));

  ruling(ctx, kiriX0, padT, kiriX0 + panelW, baseY, {
    horizontal: hs,
    vertical: vsE,
  });
  ruling(ctx, kananX0, padT, kananX0 + panelW, baseY, {
    horizontal: hs,
    vertical: vsM,
  });

  for (let v = 0; v <= yMax + 1e-9; v += ys)
    axisValue(ctx, v.toFixed(1), kiriX0 - 8, Y(v), "right", "middle");
  for (let v = 0; v <= eMax + 1e-9; v += es)
    axisValue(ctx, v.toFixed(1), XE(v), baseY + 9, "center", "top");
  for (let v = 0; v <= mMax + 1e-9; v += ms)
    axisValue(ctx, v.toFixed(1), XM(v), baseY + 9, "center", "top");

  axisTitle(ctx, T.axEnergy, kiriX0 + panelW / 2, baseY + 34);
  axisTitle(ctx, T.axMomentum, kananX0 + panelW / 2, baseY + 34);
  axisTitle(ctx, T.axDepthShort, 16, padT + plotH / 2, -Math.PI / 2);

  /* ---------------- kurva ---------------- */
  const gambarKurva = (
    nilai: (y: number) => number,
    X: (v: number) => number,
    warna: string,
    batas: number
  ) => {
    pen(ctx, W.bold, warna);
    ctx.beginPath();
    let mulai = false;
    for (let i = 1; i <= 400; i++) {
      const y = (i / 400) * yMax;
      const v = nilai(y);
      if (!Number.isFinite(v) || v > batas * 1.02) {
        mulai = false;
        continue;
      }
      const px = X(v);
      const py = Y(y);
      mulai ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      mulai = true;
    }
    ctx.stroke();
  };

  gambarKurva((y) => specificEnergy(y, s.q), XE, C.energy, eMax);
  gambarKurva((y) => momentumFunction(y, s.q), XM, C.ink, mMax);

  // Asimtot E = y pada panel energi. Ia menjelaskan mengapa cabang atas kurva
  // energi makin lama makin lurus, dan tidak punya padanan di panel momentum.
  const lim = Math.min(yMax, eMax);
  pen(ctx, W.hair, C.ink3, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(XE(0), Y(0));
  ctx.lineTo(XE(lim), Y(lim));
  ctx.stroke();
  ctx.setLineDash([]);
  curveLabel(ctx, "E = y", XE(lim * 0.72), Y(lim * 0.72) - 9, C.ink3);

  /* ---------------- garis mendatar yang melintasi kedua panel ---------------- */
  const mendatar = (y: number, warna: string, dash: readonly number[], teks: string) => {
    pen(ctx, W.thin, warna, dash);
    ctx.beginPath();
    ctx.moveTo(kiriX0, Y(y));
    ctx.lineTo(kananX0 + panelW, Y(y));
    ctx.stroke();
    ctx.setLineDash([]);
    curveLabel(ctx, teks, kananX0 + panelW - 4, Y(y) - 9, warna, "right");
  };

  mendatar(s.yc, C.critical, DASH.axis, `yc ${s.yc.toFixed(3)} m`);
  if (!s.noJump) {
    mendatar(s.y1, C.water, DASH.hidden, `y₁ ${s.y1.toFixed(3)} m`);
    mendatar(s.y2, C.water, DASH.hidden, `y₂ ${s.y2.toFixed(3)} m`);
  }

  /* ---------------- nilai minimum kedua kurva ---------------- */
  const tandaMin = (X: (v: number) => number, nilai: number, warna: string, teks: string) => {
    pen(ctx, W.hair, warna, DASH.invalid);
    ctx.beginPath();
    ctx.moveTo(X(nilai), Y(s.yc));
    ctx.lineTo(X(nilai), baseY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = warna;
    ctx.font = F.labelSm;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    stencil(ctx, teks, X(nilai), baseY - 15, 0.6);
  };
  tandaMin(XE, Emin, C.energy, `E min ${Emin.toFixed(2)}`);
  tandaMin(XM, Mmin, C.ink, `M min ${Mmin.toFixed(2)}`);

  /* ---------------- inti lembar ---------------- */
  if (!s.noJump) {
    const E1 = specificEnergy(s.y1, s.q);
    const E2 = specificEnergy(s.y2, s.q);
    const M1 = momentumFunction(s.y1, s.q);

    // Panel momentum: SATU garis tegak, DUA titik singgung.
    pen(ctx, W.thin, C.signal);
    ctx.beginPath();
    ctx.moveTo(XM(M1), Y(s.y1));
    ctx.lineTo(XM(M1), Y(s.y2));
    ctx.stroke();
    for (const y of [s.y1, s.y2]) {
      ctx.fillStyle = C.signal;
      ctx.beginPath();
      ctx.arc(XM(M1), Y(y), 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    region(
      ctx,
      T.momentumEqual,
      XM(M1),
      Y((s.y1 + s.y2) / 2) - 12,
      C.signal
    );

    // Panel energi: dua titik pada dua nilai berbeda, selisihnya diukur.
    for (const [y, E] of [
      [s.y1, E1],
      [s.y2, E2],
    ] as const) {
      ctx.fillStyle = C.energy;
      ctx.beginPath();
      ctx.arc(XE(E), Y(y), 2.6, 0, Math.PI * 2);
      ctx.fill();
      pen(ctx, W.hair, C.energy, DASH.hidden);
      ctx.beginPath();
      ctx.moveTo(XE(E), Y(y));
      ctx.lineTo(XE(E), baseY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const yDim = Math.min(yMax * 0.94, Math.max(s.y2 * 1.18, s.yc * 1.6));
    dimH(
      ctx,
      Y(yDim),
      XE(Math.min(E1, E2)),
      XE(Math.max(E1, E2)),
      `ΔE ${Math.abs(E1 - E2).toFixed(3)} m`,
      C.signal
    );
  }

  /* ---------------- nama cabang ---------------- */
  region(ctx, T.branchSub, kiriX0 + panelW * 0.62, Y(yMax * 0.86), C.ink3);
  region(ctx, T.branchSuper, kiriX0 + panelW * 0.62, Y(yMax * 0.1), C.ink3);

  /* ---------------- bingkai ---------------- */
  pen(ctx, W.thin, C.ink);
  for (const x0 of [kiriX0, kananX0]) {
    ctx.strokeRect(
      Math.round(x0) + 0.5,
      Math.round(padT) + 0.5,
      Math.round(panelW),
      Math.round(plotH)
    );
  }
}
