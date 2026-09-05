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
import { G, orificeTrajectory } from "./hydraulics";
import { cl } from "./strings";
import type { Lang } from "./i18n";

export type OrificeDrawState = {
  /** Tinggi muka air di atas sumbu lubang, meter */
  H: number;
  /** Tinggi bukaan lubang, meter */
  a: number;
  /** Tinggi sumbu lubang di atas lantai, meter */
  z0: number;
  /** Koefisien kontraksi */
  Cc: number;
  /** Kecepatan sesungguhnya di vena contracta */
  V: number;
  /** Kecepatan tanpa kehilangan, menurut Torricelli */
  Vth: number;
  /** Jarak vena contracta dari bidang lubang */
  xVena: number;
};

/**
 * POTONGAN MELINTANG DINDING BERLUBANG DENGAN PANCARAN BEBAS.
 *
 * Yang harus terbaca dari gambar ini adalah SEBAB penyempitan, bukan hanya
 * akibatnya. Karena itu garis arus yang datang dari samping ikut digambar:
 * air yang mendekati lubang dari atas dan dari bawah tidak dapat berbelok
 * tajam tepat di bibirnya, sehingga ia terus melengkung sebentar setelah
 * keluar. Di tempat lengkungan itu selesai, pancaran paling sempit dan garis
 * arusnya sejajar. Hanya di situ tekanannya nol dan kecepatannya dapat
 * dihitung, dan itulah sebabnya vena contracta, bukan bibir lubang, yang
 * menjadi penampang acuan.
 *
 * Lintasan tanpa kehilangan digambar berdampingan sebagai garis khayal.
 * Selisih di antara keduanya adalah seluruh isi koefisien kecepatan, dan
 * selisih itulah yang diukur di laboratorium dengan meteran, bukan dengan
 * alat ukur kecepatan.
 */
export function drawOrifice(
  ctx: CanvasRenderingContext2D,
  w: number,
  hCanvas: number,
  s: OrificeDrawState,
  lang: Lang
) {
  const T = cl(lang);
  ground(ctx, w, hCanvas);

  const padL = 58;
  const padR = 26;
  const padT = 26;
  const padB = 52;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = Math.max(10, hCanvas - padT - padB);

  // Sejauh mana pancaran sempat jatuh sebelum mengenai lantai.
  const xJatuh =
    s.V > 0 ? Math.sqrt((2 * s.z0 * s.V * s.V) / G) : Math.max(s.a * 4, 0.2);

  const xKiri = -Math.max(s.H * 0.7, s.a * 6, 0.25);
  const xKanan = Math.max(xJatuh * 1.1, s.a * 8, 0.3);
  const spanX = xKanan - xKiri;
  const zAtas = Math.max((s.z0 + s.H) * 1.18, 0.3);

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

  /* ---------------- air di dalam bak ---------------- */
  const zMuka = s.z0 + s.H;
  const zAtasLubang = s.z0 + s.a / 2;
  const zBawahLubang = s.z0 - s.a / 2;

  const jalurBak = () => {
    ctx.beginPath();
    ctx.moveTo(X(xKiri), Z(0));
    ctx.lineTo(X(xKiri), Z(zMuka));
    ctx.lineTo(X(0), Z(zMuka));
    ctx.lineTo(X(0), Z(0));
    ctx.closePath();
  };
  ctx.save();
  jalurBak();
  ctx.fillStyle = C.waterFill;
  ctx.fill();
  ctx.restore();
  hatchWater(ctx, jalurBak, padL, X(0), Z(zMuka), Z(0), 10);

  /* ---------------- garis arus yang berbelok ke lubang ----------------
     Inilah sebab penyempitan, jadi ia dibawa sebagai isi gambar, bukan hiasan. */
  pen(ctx, W.hair, C.water, DASH.hidden);
  for (const zAwal of [
    zMuka * 0.92,
    zMuka * 0.72,
    zAtasLubang + s.a * 1.6,
    zBawahLubang - s.a * 0.9,
    Math.max(0.02, s.z0 * 0.28),
  ]) {
    if (zAwal <= 0 || zAwal >= zMuka) continue;
    const zTuju =
      zAwal > s.z0
        ? s.z0 + (s.a / 2) * s.Cc * 0.85
        : s.z0 - (s.a / 2) * s.Cc * 0.85;
    ctx.beginPath();
    ctx.moveTo(X(xKiri), Z(zAwal));
    for (let i = 1; i <= 40; i++) {
      const f = i / 40;
      const xx = xKiri + (s.xVena - xKiri) * f;
      // Belokan dipusatkan mendekati bibir lubang, karena di situlah
      // percepatan terjadi.
      const bobot = Math.pow(f, 3.2);
      ctx.lineTo(X(xx), Z(zAwal + (zTuju - zAwal) * bobot));
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  /* ---------------- pancaran ---------------- */
  const setengahDi = (x: number) => {
    if (x <= 0) return s.a / 2;
    if (x >= s.xVena) return (s.Cc * s.a) / 2;
    const f = x / s.xVena;
    return (s.a / 2) * (1 - (1 - s.Cc) * (3 * f * f - 2 * f * f * f));
  };

  const sumbuDi = (x: number) =>
    x <= s.xVena ? s.z0 : s.z0 - orificeTrajectory(s.V, x - s.xVena);

  const langkah = 200;
  const atas: [number, number][] = [];
  const bawah: [number, number][] = [];
  for (let i = 0; i <= langkah; i++) {
    const x = (i / langkah) * xKanan;
    const zc = sumbuDi(x);
    const t = setengahDi(x);
    if (zc - t < 0) break;
    atas.push([x, zc + t]);
    bawah.push([x, zc - t]);
  }

  const jalurPancaran = () => {
    ctx.beginPath();
    atas.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))));
    for (let i = bawah.length - 1; i >= 0; i--)
      ctx.lineTo(X(bawah[i][0]), Z(bawah[i][1]));
    ctx.closePath();
  };
  ctx.save();
  jalurPancaran();
  ctx.fillStyle = C.waterFillDeep;
  ctx.fill();
  ctx.restore();

  /* ---------------- lintasan tanpa kehilangan ---------------- */
  if (s.Vth > s.V) {
    pen(ctx, W.hair, C.ink3, DASH.phantom);
    ctx.beginPath();
    let mulai = false;
    for (let i = 0; i <= langkah; i++) {
      const x = (i / langkah) * xKanan;
      if (x < s.xVena) continue;
      const z = s.z0 - orificeTrajectory(s.Vth, x - s.xVena);
      if (z < 0) break;
      mulai ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z));
      mulai = true;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    curveLabel(
      ctx,
      T.projectile,
      X(xKanan * 0.62),
      Z(Math.max(0, s.z0 - orificeTrajectory(s.Vth, xKanan * 0.62 - s.xVena))) - 9,
      C.ink3
    );
  }

  pen(ctx, W.bold, C.water);
  for (const tepi of [atas, bawah]) {
    ctx.beginPath();
    tepi.forEach(([x, z], i) =>
      i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))
    );
    ctx.stroke();
  }

  /* ---------------- dinding ---------------- */
  const tebal = Math.max(spanX * 0.012, 0.003);
  const gambarDinding = (zBawah: number, zAtasBagian: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(X(0), Z(zAtasBagian), X(tebal) - X(0), Z(zBawah) - Z(zAtasBagian));
    ctx.clip();
    hatchConcrete(ctx, padL, padT, plotW, plotH);
    ctx.restore();
    pen(ctx, W.bold, C.ink);
    ctx.strokeRect(
      X(0),
      Z(zAtasBagian),
      X(tebal) - X(0),
      Z(zBawah) - Z(zAtasBagian)
    );
  };
  gambarDinding(0, zBawahLubang);
  gambarDinding(zAtasLubang, zAtas * 0.98);

  // Lantai.
  pen(ctx, W.bold, C.ink);
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

  // Muka air.
  pen(ctx, W.bold, C.water);
  ctx.beginPath();
  ctx.moveTo(X(xKiri), Z(zMuka));
  ctx.lineTo(X(0), Z(zMuka));
  ctx.stroke();

  /* ---------------- vena contracta ---------------- */
  const tVena = (s.Cc * s.a) / 2;
  pen(ctx, W.thin, C.signal, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(X(s.xVena), Z(zMuka));
  ctx.lineTo(X(s.xVena), Z(Math.max(0, s.z0 - tVena - s.a)));
  ctx.stroke();
  ctx.setLineDash([]);

  dimV(
    ctx,
    X(s.xVena) + 30,
    Z(s.z0 + tVena),
    Z(s.z0 - tVena),
    `${(s.Cc * s.a * 1000).toFixed(1)} mm`,
    C.signal
  );
  region(ctx, T.venaContracta, X(s.xVena), Z(zMuka) - 14, C.signal);

  /* ---------------- dimensi ---------------- */
  dimV(ctx, X(xKiri) + 28, Z(zMuka), Z(s.z0), `H ${s.H.toFixed(3)} m`, C.water);
  dimV(
    ctx,
    X(0) - 16,
    Z(zAtasLubang),
    Z(zBawahLubang),
    `a ${(s.a * 1000).toFixed(0)} mm`,
    C.ink
  );
  dimH(ctx, Z(0) - 14, X(0), X(s.xVena), `${(s.xVena * 1000).toFixed(0)} mm`, C.signal);

  leader(
    ctx,
    X(0),
    Z(zAtasLubang),
    X(-Math.max(spanX * 0.1, 0.05)),
    Z(zAtasLubang + Math.max(zAtas * 0.1, 0.03)),
    T.orifice,
    C.ink2
  );

  /* ---------------- nama wilayah ---------------- */
  ctx.fillStyle = C.ink;
  ctx.font = F.heading;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  stencil(ctx, T.jet, X(xKanan * 0.55), Z(s.z0) - 26, 2);

  /* ---------------- bingkai ---------------- */
  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(padL) + 0.5,
    Math.round(padT) + 0.5,
    Math.round(plotW),
    Math.round(plotH)
  );
}
