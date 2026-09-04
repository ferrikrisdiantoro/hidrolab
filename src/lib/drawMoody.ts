import { C, DASH, F, W, stencil } from "./theme";
import {
  axisTitle,
  axisValue,
  curveLabel,
  ground,
  ruling,
  pen,
  region,
} from "./plate";
import {
  RE_LAMINAR_MAX,
  RE_TURBULENT_MIN,
  colebrookFriction,
} from "./hydraulics";
import { cl } from "./strings";
import type { Lang } from "./i18n";

const RE_MIN = 1e3;
const RE_MAX = 1e8;
const F_MIN = 0.008;
const F_MAX = 0.1;

/** Keluarga kekasaran relatif yang digambar sebagai kurva latar. */
const FAMILY = [
  0.05, 0.03, 0.02, 0.01, 6e-3, 4e-3, 2e-3, 1e-3, 6e-4, 4e-4, 2e-4, 1e-4, 5e-5,
  1e-5, 1e-6,
];

export type MoodyState = {
  Re: number;
  relRough: number;
  f: number;
  regime: "laminar" | "transisi" | "turbulen";
};

/**
 * DIAGRAM MOODY — solusi grafis persamaan Colebrook-White.
 *
 * Yang membuat diagram ini bertahan delapan dekade adalah adanya JALUR
 * BACA yang bisa ditelusuri jari: masuk dari sumbu bawah pada Re, naik
 * sampai menyentuh kurva kekasaran yang sesuai, lalu belok kiri untuk
 * membaca f. Jalur itu digambar ulang di sini sebagai garis sumbu.
 *
 * Zona kritis dibiarkan kosong tanpa kurva, persis seperti aslinya —
 * di rentang itu nilainya memang tidak dapat dipastikan.
 */
export function drawMoody(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: MoodyState,
  lang: Lang
) {
  const T = cl(lang);
  const padL = 62;
  const padR = 74;
  const padT = 26;
  const padB = 52;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = Math.max(10, h - padT - padB);

  const lgReMin = Math.log10(RE_MIN);
  const lgReMax = Math.log10(RE_MAX);
  const lgFMax = Math.log10(F_MAX);
  const lgFMin = Math.log10(F_MIN);

  const X = (Re: number) =>
    padL + ((Math.log10(Re) - lgReMin) / (lgReMax - lgReMin)) * plotW;
  const Y = (f: number) =>
    padT + ((lgFMax - Math.log10(f)) / (lgFMax - lgFMin)) * plotH;

  ground(ctx, w, h);

  /* ---------------- kisi logaritmik ---------------- */
  const minor: number[] = [];
  const major: number[] = [];
  for (let d = 3; d <= 8; d++) {
    for (let m = 1; m < 10; m++) {
      const Re = m * Math.pow(10, d);
      if (Re > RE_MAX) break;
      (m === 1 ? major : minor).push(X(Re));
    }
  }
  const fMinor: number[] = [];
  const fMajor: number[] = [];
  for (const f of [0.008, 0.009, 0.015, 0.025, 0.035, 0.045, 0.05, 0.07, 0.09])
    fMinor.push(Y(f));
  for (const f of [0.01, 0.02, 0.03, 0.04, 0.06, 0.08, 0.1]) fMajor.push(Y(f));

  ruling(ctx, padL, padT, padL + plotW, padT + plotH, {
    vertical: minor,
    horizontal: fMinor,
  });
  ruling(ctx, padL, padT, padL + plotW, padT + plotH, {
    vertical: major,
    horizontal: fMajor,
    strong: true,
  });

  for (let d = 3; d <= 8; d++)
    axisValue(
      ctx,
      `10${sup(d)}`,
      X(Math.pow(10, d)),
      padT + plotH + 9,
      "center",
      "top"
    );
  for (const f of [0.01, 0.02, 0.03, 0.04, 0.06, 0.08, 0.1])
    axisValue(ctx, f.toFixed(2), padL - 8, Y(f), "right", "middle");

  /* ---------------- zona kritis: ruang kosong yang jujur ---------- */
  const xc0 = X(RE_LAMINAR_MAX);
  const xc1 = X(RE_TURBULENT_MIN);
  ctx.fillStyle = C.paperSunk;
  ctx.globalAlpha = 0.75;
  ctx.fillRect(xc0, padT, xc1 - xc0, plotH);
  ctx.globalAlpha = 1;
  pen(ctx, W.hair, C.ruleStrong, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(Math.round(xc0) + 0.5, padT);
  ctx.lineTo(Math.round(xc0) + 0.5, padT + plotH);
  ctx.moveTo(Math.round(xc1) + 0.5, padT);
  ctx.lineTo(Math.round(xc1) + 0.5, padT + plotH);
  ctx.stroke();
  ctx.setLineDash([]);
  region(
    ctx,
    T.criticalZone,
    (xc0 + xc1) / 2,
    padT + plotH * 0.62,
    C.ink3,
    -Math.PI / 2
  );

  /* ---------------- garis laminar ---------------- */
  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  let firstLam = true;
  for (let Re = RE_MIN; Re <= RE_LAMINAR_MAX; Re *= 1.02) {
    const f = 64 / Re;
    if (f > F_MAX) continue;
    if (firstLam) {
      ctx.moveTo(X(Re), Y(f));
      firstLam = false;
    } else ctx.lineTo(X(Re), Y(f));
  }
  ctx.stroke();
  curveLabel(ctx, "f = 64 / Re", X(1.15e3), Y(64 / 1250) - 11, C.ink);
  region(ctx, T.laminar, X(1.45e3), padT + plotH - 16, C.ink3);

  /* ---------------- keluarga kurva kekasaran ---------------- */
  const roughLocus: [number, number][] = [];

  for (const rr of FAMILY) {
    const active =
      Math.abs(Math.log10(rr) - Math.log10(Math.max(s.relRough, 1e-7))) < 0.03;

    pen(ctx, active ? W.bold : W.thin, active ? C.water : C.ruleStrong);
    ctx.beginPath();
    let first = true;
    for (let lg = Math.log10(RE_TURBULENT_MIN); lg <= 8.0001; lg += 0.015) {
      const Re = Math.pow(10, lg);
      const f = colebrookFriction(Re, rr);
      if (f < F_MIN || f > F_MAX) continue;
      if (first) {
        ctx.moveTo(X(Re), Y(f));
        first = false;
      } else ctx.lineTo(X(Re), Y(f));
    }
    ctx.stroke();

    // Batas turbulen penuh: Re·(ε/D)·√f ≈ 200
    if (rr > 0) {
      for (let lg = Math.log10(RE_TURBULENT_MIN); lg <= 8.0001; lg += 0.01) {
        const Re = Math.pow(10, lg);
        const f = colebrookFriction(Re, rr);
        if (Re * rr * Math.sqrt(f) >= 200) {
          if (f >= F_MIN && f <= F_MAX) roughLocus.push([X(Re), Y(f)]);
          break;
        }
      }
    }

    const fEnd = colebrookFriction(RE_MAX, rr);
    if (fEnd >= F_MIN && fEnd <= F_MAX) {
      curveLabel(
        ctx,
        fmtRR(rr),
        padL + plotW + 7,
        Y(fEnd),
        active ? C.water : C.ink3
      );
    }
  }

  // Pipa licin sempurna
  pen(ctx, W.thin, C.ink2, DASH.hidden);
  ctx.beginPath();
  let firstSmooth = true;
  for (let lg = Math.log10(RE_TURBULENT_MIN); lg <= 8.0001; lg += 0.015) {
    const Re = Math.pow(10, lg);
    const f = colebrookFriction(Re, 0);
    if (f < F_MIN || f > F_MAX) continue;
    if (firstSmooth) {
      ctx.moveTo(X(Re), Y(f));
      firstSmooth = false;
    } else ctx.lineTo(X(Re), Y(f));
  }
  ctx.stroke();
  ctx.setLineDash([]);
  curveLabel(ctx, T.smoothPipe, X(2.2e7), Y(colebrookFriction(2.2e7, 0)) + 12, C.ink2);

  // Garis batas turbulen penuh
  if (roughLocus.length > 2) {
    pen(ctx, W.thin, C.critical, DASH.axis);
    ctx.beginPath();
    roughLocus.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.setLineDash([]);
    const mid = roughLocus[Math.floor(roughLocus.length * 0.55)];
    if (mid) region(ctx, T.fullyRough, mid[0] + 4, mid[1] - 16, C.critical);
  }

  /* ---------------- jalur baca dan titik operasi ---------------- */
  if (s.Re >= RE_MIN && s.Re <= RE_MAX && s.f >= F_MIN && s.f <= F_MAX) {
    const px = X(s.Re);
    const py = Y(s.f);

    pen(ctx, W.thin, C.signal, DASH.axis);
    ctx.beginPath();
    ctx.moveTo(px, padT + plotH);
    ctx.lineTo(px, py);
    ctx.lineTo(padL, py);
    ctx.stroke();
    ctx.setLineDash([]);

    // Penanda belah ketupat, bentuk titik ukur pada gambar teknik.
    pen(ctx, W.thin, C.signal);
    ctx.fillStyle = C.sheet;
    ctx.beginPath();
    ctx.moveTo(px, py - 5);
    ctx.lineTo(px + 5, py);
    ctx.lineTo(px, py + 5);
    ctx.lineTo(px - 5, py);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Nilai dibaca pada kedua ujung jalur.
    ctx.fillStyle = C.signal;
    ctx.font = F.label;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = C.sheet;
    ctx.fillRect(padL + 2, py - 7, 46, 14);
    ctx.fillStyle = C.signal;
    stencil(ctx, `f ${s.f.toFixed(4)}`, padL + 5, py + 0.5);

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = C.sheet;
    ctx.fillRect(px - 30, padT + plotH - 16, 60, 14);
    ctx.fillStyle = C.signal;
    stencil(ctx, `Re ${fmtRe(s.Re)}`, px, padT + plotH - 14);
  }

  /* ---------------- bingkai dan judul sumbu ---------------- */
  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(padL) + 0.5,
    Math.round(padT) + 0.5,
    Math.round(plotW),
    Math.round(plotH)
  );

  axisTitle(ctx, T.axReynolds, padL + plotW / 2, padT + plotH + 34);
  axisTitle(ctx, T.axFriction, 20, padT + plotH / 2, -Math.PI / 2);
  axisTitle(ctx, T.axRoughness, w - 16, padT + plotH / 2, -Math.PI / 2);
}

function fmtRe(Re: number): string {
  const exp = Math.floor(Math.log10(Re));
  const mant = Re / Math.pow(10, exp);
  return `${mant.toFixed(1)}·10${sup(exp)}`;
}

function fmtRR(rr: number): string {
  if (rr >= 0.01) return rr.toFixed(2);
  if (rr >= 1e-3) return rr.toFixed(3);
  const exp = Math.round(Math.log10(rr));
  const mant = rr / Math.pow(10, exp);
  return Math.abs(mant - 1) < 0.1
    ? `10${sup(exp)}`
    : `${mant.toFixed(0)}·10${sup(exp)}`;
}

function sup(n: number): string {
  const map: Record<string, string> = {
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
    "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻",
  };
  return String(n).split("").map((c) => map[c] ?? c).join("");
}
