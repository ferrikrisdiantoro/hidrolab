import { C, DASH, F, W, stencil } from "./theme";
import {
  axisTitle,
  axisValue,
  curveLabel,
  dimH,
  dimV,
  ground,
  hatchConcrete,
  hatchWater,
  leader,
  niceStep,
  pen,
  region,
  ruling,
} from "./plate";
import { jetTrajectory, wesNappe } from "./hydraulics";
import { cl } from "./strings";
import type { Lang } from "./i18n";

export type NappeState = {
  /** Tinggi muka air di atas puncak mercu, meter */
  h: number;
  /** Tinggi mercu di atas lantai hilir, meter */
  P: number;
  /** Kecepatan rata-rata di atas mercu, meter per detik */
  V0: number;
  /** Muka air hilir di atas lantai, meter */
  tail: number;
  /** Di luar rentang keberlakuan standar */
  outOfRange: boolean;
  /** Rongga di bawah tirai diberi udara */
  aerated: boolean;
};

/**
 * POTONGAN MELINTANG AMBANG TAJAM DENGAN TIRAI LUAPAN BEBAS.
 *
 * Yang harus terbaca dari gambar ini ada tiga, dan ketiganya menuntut potongan
 * tegak, bukan grafik:
 *
 * - Bentuk tirai itu sendiri, yang bukan parabola. Lintasan peluru digambar
 *   berdampingan sebagai garis khayal supaya selisihnya terlihat, bukan
 *   diceritakan.
 * - Rongga udara di bawah tirai. Rongga inilah yang menentukan apakah tirai
 *   bekerja sebagaimana rumus debitnya mengandaikan.
 * - Muka air hilir terhadap puncak mercu. Begitu ia naik melewati puncak,
 *   ambangnya tenggelam dan seluruh perhitungan debitnya gugur.
 */
export function drawNappe(
  ctx: CanvasRenderingContext2D,
  w: number,
  hCanvas: number,
  s: NappeState,
  lang: Lang
) {
  const T = cl(lang);
  ground(ctx, w, hCanvas);

  const padL = 58;
  const padR = 30;
  const padT = 26;
  const padB = 52;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = Math.max(10, hCanvas - padT - padB);

  // Jarak jatuh tirai sampai lantai, dipakai menentukan lebar bidang gambar.
  const xJatuh =
    s.h > 0 ? Math.pow(2 * Math.pow(s.h, 0.85) * Math.max(s.P, 0.01), 1 / 1.85) : 0.1;

  const xKiri = -Math.max(3 * s.h, 0.3);
  const xKanan = Math.max(xJatuh * 1.25, s.h * 2.5, 0.3);
  const spanX = xKanan - xKiri;
  const zAtas = Math.max(s.P + s.h * 1.6, s.P * 1.25, 0.3);

  const X = (x: number) => padL + ((x - xKiri) / spanX) * plotW;
  const Z = (z: number) => padT + plotH - (z / zAtas) * plotH;

  /* ---------------- kisi dan sumbu ---------------- */
  const zStep = niceStep(zAtas, 5);
  const xStep = niceStep(spanX, 6);
  const hs: number[] = [];
  const vs: number[] = [];
  for (let v = 0; v <= zAtas + 1e-9; v += zStep) hs.push(Z(v));
  for (let v = Math.ceil(xKiri / xStep) * xStep; v <= xKanan + 1e-9; v += xStep)
    vs.push(X(v));
  ruling(ctx, padL, padT, padL + plotW, padT + plotH, {
    horizontal: hs,
    vertical: vs,
  });

  const digits = zStep < 0.1 ? 2 : zStep < 1 ? 1 : 0;
  for (let v = 0; v <= zAtas + 1e-9; v += zStep)
    axisValue(ctx, v.toFixed(digits), padL - 8, Z(v), "right", "middle");
  for (let v = Math.ceil(xKiri / xStep) * xStep; v <= xKanan + 1e-9; v += xStep)
    axisValue(ctx, v.toFixed(digits), X(v), padT + plotH + 9, "center", "top");

  axisTitle(ctx, T.axStation, padL + plotW / 2, padT + plotH + 34);
  axisTitle(ctx, T.elevation, 16, padT + plotH / 2, -Math.PI / 2);

  /* ---------------- tirai luapan ---------------- */
  const langkah = 160;
  const tirai: [number, number][] = [];
  for (let i = 0; i <= langkah; i++) {
    const x = (i / langkah) * xKanan;
    const z = s.P - wesNappe(s.h, x);
    if (z < 0) break;
    tirai.push([x, z]);
  }
  if (tirai.length === 0) tirai.push([0, s.P]);

  /* ---------------- badan air di hulu ----------------
     Muka air mulai turun kira-kira dua kali tinggi luapan sebelum mercu.
     Penurunan itu digambar, karena tanpa itu gambar menyiratkan muka air
     mendatar sampai ke bibir mercu, dan itu tidak benar. */
  const awalTurun = -2 * s.h;
  const mukaHulu = (x: number) => {
    if (x <= awalTurun) return s.P + s.h;
    const f = (x - awalTurun) / (0 - awalTurun);
    return s.P + s.h - s.h * 0.28 * f * f;
  };

  const jalurAir = () => {
    ctx.beginPath();
    ctx.moveTo(X(xKiri), Z(0));
    ctx.lineTo(X(xKiri), Z(mukaHulu(xKiri)));
    for (let i = 0; i <= 60; i++) {
      const x = xKiri + ((0 - xKiri) * i) / 60;
      ctx.lineTo(X(x), Z(mukaHulu(x)));
    }
    for (const [x, z] of tirai) ctx.lineTo(X(x), Z(z));
    ctx.lineTo(X(tirai[tirai.length - 1][0]), Z(0));
    ctx.lineTo(X(0), Z(0));
    ctx.lineTo(X(0), Z(s.P));
    ctx.lineTo(X(xKiri), Z(0));
    ctx.closePath();
  };

  ctx.save();
  jalurAir();
  ctx.fillStyle = C.waterFill;
  ctx.fill();
  ctx.restore();
  hatchWater(ctx, jalurAir, padL, X(0), padT + 4, Z(0), 10);

  /* ---------------- muka air hilir ---------------- */
  if (s.tail > 0) {
    const jalurHilir = () => {
      ctx.beginPath();
      ctx.moveTo(X(xJatuh * 0.2), Z(0));
      ctx.lineTo(X(xJatuh * 0.2), Z(s.tail));
      ctx.lineTo(X(xKanan), Z(s.tail));
      ctx.lineTo(X(xKanan), Z(0));
      ctx.closePath();
    };
    ctx.save();
    jalurHilir();
    ctx.fillStyle = C.waterFill;
    ctx.fill();
    ctx.restore();
    hatchWater(ctx, jalurHilir, X(xJatuh * 0.2), padL + plotW, Z(s.tail), Z(0), 10);

    pen(ctx, W.bold, C.water);
    ctx.beginPath();
    ctx.moveTo(X(xJatuh * 0.2), Z(s.tail));
    ctx.lineTo(X(xKanan), Z(s.tail));
    ctx.stroke();
    curveLabel(ctx, T.tailwater, X(xKanan) - 4, Z(s.tail) - 10, C.water, "right");
  }

  /* ---------------- lintasan peluru sebagai pembanding ---------------- */
  pen(ctx, W.hair, C.ink3, DASH.phantom);
  ctx.beginPath();
  let mulai = false;
  for (let i = 0; i <= langkah; i++) {
    const x = (i / langkah) * xKanan;
    const z = s.P - jetTrajectory(s.V0, x);
    if (z < 0) break;
    mulai ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z));
    mulai = true;
  }
  ctx.stroke();
  ctx.setLineDash([]);
  curveLabel(
    ctx,
    T.projectile,
    X(xKanan * 0.55),
    Z(Math.max(0, s.P - jetTrajectory(s.V0, xKanan * 0.55))) + 12,
    C.ink3
  );

  /* ---------------- muka air hulu ---------------- */
  pen(ctx, W.bold, C.water);
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const x = xKiri + ((0 - xKiri) * i) / 60;
    i ? ctx.lineTo(X(x), Z(mukaHulu(x))) : ctx.moveTo(X(x), Z(mukaHulu(x)));
  }
  ctx.stroke();

  /* ---------------- tirai ---------------- */
  pen(
    ctx,
    s.outOfRange ? W.thin : W.bold,
    C.water,
    s.outOfRange ? DASH.invalid : DASH.solid
  );
  ctx.beginPath();
  tirai.forEach(([x, z], i) =>
    i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))
  );
  ctx.stroke();
  ctx.setLineDash([]);

  /* ---------------- ambang ---------------- */
  const tebal = Math.max(spanX * 0.012, 0.004);
  ctx.save();
  ctx.beginPath();
  ctx.rect(X(-tebal), Z(s.P), X(0) - X(-tebal), Z(0) - Z(s.P));
  ctx.clip();
  hatchConcrete(ctx, padL, padT, plotW, plotH);
  ctx.restore();

  pen(ctx, W.bold, C.ink);
  ctx.strokeRect(X(-tebal), Z(s.P), X(0) - X(-tebal), Z(0) - Z(s.P));

  // Lantai hilir dan dasar hulu.
  ctx.beginPath();
  ctx.moveTo(padL, Z(0));
  ctx.lineTo(padL + plotW, Z(0));
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, Z(0), plotW, padT + plotH - Z(0));
  ctx.clip();
  hatchConcrete(ctx, padL, Z(0), plotW, padT + plotH - Z(0));
  ctx.restore();

  /* ---------------- rongga udara ---------------- */
  const xRongga = Math.min(xJatuh * 0.45, xKanan * 0.4);
  const zRongga = (s.P - wesNappe(s.h, xRongga)) * 0.45;
  region(
    ctx,
    s.aerated ? T.airPocket : T.notAerated,
    X(xRongga),
    Z(zRongga),
    s.aerated ? C.ink3 : C.signal
  );
  if (!s.aerated) {
    leader(
      ctx,
      X(xRongga * 0.6),
      Z(zRongga * 1.5),
      X(xRongga * 0.6) + 30,
      Z(zRongga * 1.5) - 26,
      T.suction,
      C.signal
    );
  }

  /* ---------------- dimensi ---------------- */
  dimV(ctx, X(xKiri) + 26, Z(s.P + s.h), Z(s.P), `h ${s.h.toFixed(3)} m`, C.water);
  dimV(ctx, X(xKiri) + 62, Z(s.P), Z(0), `P ${s.P.toFixed(3)} m`, C.ink);

  // Titik acuan bentuk WES: pada x sama dengan tinggi rancangan, tirai sudah
  // turun tepat setengahnya. Angka itu jatuh langsung dari persamaannya.
  if (s.h > 0 && s.h < xKanan) {
    const zAcuan = s.P - wesNappe(s.h, s.h);
    if (zAcuan > 0) {
      pen(ctx, W.hair, C.critical, DASH.axis);
      ctx.beginPath();
      ctx.moveTo(X(s.h), Z(s.P));
      ctx.lineTo(X(s.h), Z(zAcuan));
      ctx.stroke();
      ctx.setLineDash([]);
      dimH(ctx, Z(s.P) - 16, X(0), X(s.h), `x = h`, C.critical);
      ctx.fillStyle = C.critical;
      ctx.beginPath();
      ctx.arc(X(s.h), Z(zAcuan), 2.6, 0, Math.PI * 2);
      ctx.fill();
      curveLabel(ctx, "y = h / 2", X(s.h) + 6, Z(zAcuan) + 10, C.critical);
    }
  }

  /* ---------------- nama wilayah ---------------- */
  ctx.fillStyle = C.ink;
  ctx.font = F.heading;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  stencil(ctx, T.freeNappe, X((0 + xKanan) / 2), padT + 20, 2);

  region(ctx, T.upstream, X(xKiri * 0.55), Z(s.P + s.h) - 16, C.ink3);

  /* ---------------- bingkai ---------------- */
  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(padL) + 0.5,
    Math.round(padT) + 0.5,
    Math.round(plotW),
    Math.round(plotH)
  );
}
