import { C, DASH, F, W, stencil } from "./theme";
import {
  axisTitle,
  axisValue,
  curveLabel,
  dimV,
  flowArrow,
  ground,
  leader,
  niceStep,
  pen,
  pipeBody,
  region,
  ruling,
  type PipeWall,
} from "./plate";
import { powerLawVelocity } from "./hydraulics";
import { cl } from "./strings";
import type { Lang } from "./i18n";

export type PitotDrawState = {
  /** Garis tengah pipa, meter */
  D: number;
  /** Kecepatan di sumbu pipa */
  uMax: number;
  /** Kecepatan rata-rata penampang */
  uMean: number;
  /** Pangkat pada hukum pangkat */
  n: number;
  /** Jarak ujung tabung dari sumbu pipa, meter */
  rProbe: number;
  /** Jarak dari sumbu tempat kecepatan setempat sama dengan rata-rata */
  rMean: number;
  /** Kecepatan setempat pada ujung tabung */
  uProbe: number;
};

/**
 * DUA REGISTER BERDAMPINGAN PADA SATU SUMBU JARI-JARI.
 *
 * Kiri potongan pipa dengan tabung yang benar-benar berada pada kedalaman
 * yang dipilih, kanan profil kecepatannya. Sumbu tegak keduanya sama, jadi
 * ujung tabung dan titik bacaannya pada kurva selalu sejajar. Itu yang
 * membuat pertanyaan lembar ini terjawab dengan melihat: satu bacaan hanya
 * mewakili satu titik, kecuali titik itu dipilih dengan sengaja.
 *
 * Jari-jari acuan, tempat kecepatan setempat kebetulan sama dengan kecepatan
 * rata-rata penampang, ditandai pada kedua panel. Di situlah juru ukur
 * meletakkan tabungnya bila hanya sempat mengambil satu bacaan.
 */
export function drawPitot(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: PitotDrawState,
  lang: Lang
) {
  const T = cl(lang);
  ground(ctx, w, h);

  const padT = 26;
  const padB = 52;
  const padKiri = 40;
  const padKanan = 26;
  const sela = 54;

  const lebarTotal = Math.max(20, w - padKiri - padKanan - sela);
  const pipaW = lebarTotal * 0.52;
  const kurvaW = lebarTotal - pipaW;
  const plotH = Math.max(10, h - padT - padB);

  const pipaX0 = padKiri;
  const kurvaX0 = padKiri + pipaW + sela;

  const R = s.D / 2;
  const rMax = R * 1.5;
  const Y = (r: number) => padT + plotH / 2 - (r / rMax) * (plotH / 2);

  const Lpipa = s.D * 4;
  const X = (x: number) => pipaX0 + (x / Lpipa) * pipaW;

  const uTop = s.uMax * 1.18;
  const XU = (u: number) => kurvaX0 + (u / uTop) * kurvaW;

  /* ---------------- kisi ---------------- */
  const rStep = niceStep(rMax * 2, 6);
  const hs: number[] = [];
  for (let v = -rMax; v <= rMax + 1e-9; v += rStep) hs.push(Y(v));
  const uStep = niceStep(uTop, 4);
  const vsU: number[] = [];
  for (let v = 0; v <= uTop + 1e-9; v += uStep) vsU.push(XU(v));

  ruling(ctx, pipaX0, padT, pipaX0 + pipaW, padT + plotH, { horizontal: hs });
  ruling(ctx, kurvaX0, padT, kurvaX0 + kurvaW, padT + plotH, {
    horizontal: hs,
    vertical: vsU,
  });

  const digits = rStep < 0.1 ? 3 : rStep < 1 ? 2 : 1;
  for (let v = -rMax; v <= rMax + 1e-9; v += rStep)
    axisValue(ctx, Math.abs(v).toFixed(digits), pipaX0 - 8, Y(v), "right", "middle");
  for (let v = 0; v <= uTop + 1e-9; v += uStep)
    axisValue(ctx, v.toFixed(1), XU(v), padT + plotH + 9, "center", "top");

  axisTitle(ctx, T.axVelocity, kurvaX0 + kurvaW / 2, padT + plotH + 34);
  axisTitle(ctx, T.axRadius, 14, padT + plotH / 2, -Math.PI / 2);

  /* ---------------- panel kiri: potongan pipa ---------------- */
  const wall: PipeWall = [
    { x: 0, r: R },
    { x: Lpipa, r: R },
  ];

  ctx.save();
  ctx.beginPath();
  ctx.rect(X(0), Y(R), X(Lpipa) - X(0), Y(-R) - Y(R));
  ctx.clip();
  ctx.fillStyle = C.waterFill;
  ctx.fillRect(X(0), Y(R), X(Lpipa) - X(0), Y(-R) - Y(R));
  ctx.restore();

  pipeBody(ctx, wall, X, Y, {
    thickness: R * 0.12,
    clip: { x: pipaX0, y: padT, w: pipaW, h: plotH },
    axis: true,
  });

  // Panah kecepatan pada beberapa kedalaman: panjangnya kecepatan setempat.
  const skala = (pipaW / Lpipa) * s.D * 0.24;
  for (let i = -4; i <= 4; i++) {
    const r = (i / 5) * R;
    const u = powerLawVelocity(r, R, s.uMax, s.n);
    flowArrow(ctx, X(Lpipa * 0.3), Y(r), Math.max(6, u * skala), C.water);
  }

  /* ---------------- tabung Pitot ---------------- */
  const xProbe = Lpipa * 0.68;
  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  // Batang menembus dinding dari atas, lalu berbelok menghadap aliran.
  ctx.moveTo(X(xProbe), padT + 4);
  ctx.lineTo(X(xProbe), Y(s.rProbe));
  ctx.lineTo(X(xProbe) - 16, Y(s.rProbe));
  ctx.stroke();

  ctx.fillStyle = C.signal;
  ctx.beginPath();
  ctx.arc(X(xProbe) - 16, Y(s.rProbe), 2.8, 0, Math.PI * 2);
  ctx.fill();

  leader(
    ctx,
    X(xProbe) - 16,
    Y(s.rProbe),
    X(xProbe) - 52,
    Y(s.rProbe) - 22,
    T.stagnation,
    C.signal
  );
  leader(
    ctx,
    X(xProbe),
    Y(s.rProbe) - (Y(s.rProbe) - padT) * 0.42,
    X(xProbe) + 24,
    Y(s.rProbe) - (Y(s.rProbe) - padT) * 0.42 - 10,
    T.staticPort,
    C.ink2
  );

  dimV(ctx, X(Lpipa * 0.1), Y(R), Y(-R), `D ${(s.D * 1000).toFixed(0)} mm`, C.ink);

  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(pipaX0) + 0.5,
    Math.round(padT) + 0.5,
    Math.round(pipaW),
    Math.round(plotH)
  );

  /* ---------------- panel kanan: profil kecepatan ---------------- */
  pen(ctx, W.bold, C.water);
  ctx.beginPath();
  for (let i = 0; i <= 240; i++) {
    const r = -R + (2 * R * i) / 240;
    const u = powerLawVelocity(r, R, s.uMax, s.n);
    i ? ctx.lineTo(XU(u), Y(r)) : ctx.moveTo(XU(u), Y(r));
  }
  ctx.stroke();

  // Dinding pipa pada panel kurva, supaya batas profilnya jelas.
  pen(ctx, W.bold, C.ink);
  for (const r of [R, -R]) {
    ctx.beginPath();
    ctx.moveTo(kurvaX0, Y(r));
    ctx.lineTo(kurvaX0 + kurvaW, Y(r));
    ctx.stroke();
  }

  // Kecepatan rata-rata sebagai garis tegak, dan jari-jari acuan sebagai
  // garis mendatar yang melintasi kedua panel.
  pen(ctx, W.thin, C.energy, DASH.hidden);
  ctx.beginPath();
  ctx.moveTo(XU(s.uMean), Y(R));
  ctx.lineTo(XU(s.uMean), Y(-R));
  ctx.stroke();
  ctx.setLineDash([]);
  curveLabel(ctx, `${T.meanVelocity} ${s.uMean.toFixed(3)}`, XU(s.uMean) + 4, Y(R) + 12, C.energy);

  pen(ctx, W.thin, C.critical, DASH.axis);
  for (const r of [s.rMean, -s.rMean]) {
    ctx.beginPath();
    ctx.moveTo(pipaX0, Y(r));
    ctx.lineTo(kurvaX0 + kurvaW, Y(r));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  curveLabel(
    ctx,
    `r = ${(s.rMean / R).toFixed(3)} R`,
    kurvaX0 + kurvaW - 4,
    Y(s.rMean) - 9,
    C.critical,
    "right"
  );

  // Titik bacaan tabung pada kurva, sejajar dengan ujung tabung di panel kiri.
  pen(ctx, W.hair, C.signal, DASH.hidden);
  ctx.beginPath();
  ctx.moveTo(X(xProbe) - 16, Y(s.rProbe));
  ctx.lineTo(XU(s.uProbe), Y(s.rProbe));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = C.signal;
  ctx.beginPath();
  ctx.arc(XU(s.uProbe), Y(s.rProbe), 3, 0, Math.PI * 2);
  ctx.fill();
  curveLabel(
    ctx,
    `${s.uProbe.toFixed(3)} m/s`,
    XU(s.uProbe) + 6,
    Y(s.rProbe) - 10,
    C.signal
  );

  ctx.fillStyle = C.ink;
  ctx.font = F.heading;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  stencil(ctx, `1 / ${s.n}`, XU(s.uMax * 0.42), padT + 8, 2);
  region(ctx, T.powerLaw, XU(s.uMax * 0.42), padT + 28, C.ink3);

  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(kurvaX0) + 0.5,
    Math.round(padT) + 0.5,
    Math.round(kurvaW),
    Math.round(plotH)
  );
}
