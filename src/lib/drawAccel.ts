import { C, DASH, F, W } from "./theme.ts";
import { pen } from "./plate.ts";
import { fmtPlain } from "./hydraulics.ts";
import { mapFrom, type PlateMap, type PlateOut } from "./plateOut.ts";

/**
 * FF-07 PERCEPATAN ALIRAN — sketsa saluran dengan vektor percepatan dan
 * lapis gerak kursor waktu (batch B5c).
 *
 * - accelTerms menyalin rumus tertutup acceleration() di hydraulics.ts
 *   supaya lapis gerak tidak membuat 81 objek profil tiap frame; sama
 *   persisnya diuji di drawAccel.test.ts.
 * - Kursor waktu menyapu masukan t dari 0 sampai 6 s (rentang penggeser t)
 *   dalam waktu nyata: setiap frame model dihitung ulang pada saat τ, dan
 *   ketiga bidang (sketsa saluran, profil a(x), grafik a(t)) membaca τ yang
 *   sama karena digambar dari satu jam di satu kanvas.
 */

/** Ujung atas rentang penggeser t, detik: kursor menyapu 0 sampai ini. */
export const ACCEL_SWEEP = 6;

/**
 * u, ∂u/∂t, u ∂u/∂x di penampang x pada saat t (rumus acceleration()).
 * out = [kecepatan, lokal, konvektif].
 */
export function accelTerms(
  Q0: number,
  swing: number,
  omega: number,
  D1: number,
  D2: number,
  L: number,
  x: number,
  t: number,
  out: Float64Array
): void {
  const s = Math.min(Math.max(x / Math.max(L, 1e-9), 0), 1);
  const Dx = D1 + (D2 - D1) * s;
  const A = Math.max((Math.PI * Dx * Dx) / 4, 1e-12);
  const V = (Q0 * (1 + swing * Math.sin(omega * t))) / A;
  const local = (Q0 * swing * omega * Math.cos(omega * t)) / A;
  const dDdx = (D2 - D1) / Math.max(L, 1e-9);
  const dudx = (-2 * V * dDdx) / Math.max(Dx, 1e-12);
  out[0] = V;
  out[1] = local;
  out[2] = V * dudx;
}

/** Saat kursor pada waktu putar t (detik nyata): 0 → 6 s lalu ulang. */
export function sweepTime(t: number, tEnd = ACCEL_SWEEP): number {
  if (!(tEnd > 0)) return 0;
  const m = t % tEnd;
  return m < 0 ? m + tEnd : m;
}

const tmp3 = new Float64Array(3);

/**
 * Nilai mutlak terbesar ∂u/∂t, u ∂u/∂x, dan jumlahnya selama sapuan
 * 0..tEnd, di penampang x (xs = null) atau di seluruh saluran (xs = n
 * titik). Skala panah dan rentang sumbu memakai ini, jadi tanda di setiap
 * saat τ tetap di dalam bidang dan panjangnya sebanding antar saat.
 */
export function accelRange(
  Q0: number,
  swing: number,
  omega: number,
  D1: number,
  D2: number,
  L: number,
  x: number | null,
  tEnd = ACCEL_SWEEP,
  nT = 240,
  nX = 40
): { min: number; max: number; absMax: number } {
  let lo = 0;
  let hi = 0;
  const xsN = x === null ? nX : 0;
  for (let i = 0; i <= nT; i++) {
    const t = (tEnd * i) / nT;
    for (let j = 0; j <= xsN; j++) {
      const xx = x === null ? (L * j) / nX : x;
      accelTerms(Q0, swing, omega, D1, D2, L, xx, t, tmp3);
      const a = tmp3[1] + tmp3[2];
      lo = Math.min(lo, tmp3[1], tmp3[2], a);
      hi = Math.max(hi, tmp3[1], tmp3[2], a);
    }
  }
  return { min: lo, max: hi, absMax: Math.max(Math.abs(lo), Math.abs(hi)) };
}

export type DuctSpec = {
  D1: number;
  D2: number;
  L: number;
  /** Penampang yang ditinjau, m */
  x: number;
  /** Suku pada saat penggeser t, m/s² */
  local: number;
  convective: number;
  /** Panjang panah: |a| = absMax digambar `arrowPx` piksel */
  absMax: number;
  /** Piksel x untuk x = 0 dan x = L (ductSpan) */
  px0: number;
  px1: number;
  /** Panah statis digambar rambut bergaris phantom (lapis gerak sedang menggambar τ) */
  faded: boolean;
  labels: { local: string; convective: string; total: string; station: string };
};

/** Jarak tepi kanvas ke ruang panah, piksel. */
export const DUCT_TEPI = 20;

/** Panjang panah untuk |a| = absMax pada kanvas selebar w, piksel. */
export function ductArrowPx(w: number): number {
  return Math.max(40, Math.min(150, 0.18 * w));
}

/**
 * Piksel x = 0 dan x = L sketsa saluran. Di kiri dan kanannya disisakan
 * satu panjang panah, jadi panah di penampang mana pun (pangkal atau ujung,
 * ke hulu atau ke hilir) tidak pernah keluar kanvas dan tidak perlu
 * dipotong, dan panjangnya tetap sebanding.
 */
export function ductSpan(w: number): [number, number] {
  const a = ductArrowPx(w);
  return [DUCT_TEPI + a, w - DUCT_TEPI - a];
}

/** Panjang panah dari letak pangkal saluran (lihat ductSpan). */
function panjangPanah(px0: number, _px1: number) {
  return px0 - DUCT_TEPI;
}

/** Kepala panah terbuka di ujung (x1, y). */
function panahDatar(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number) {
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  const d = x1 - x0;
  if (Math.abs(d) < 3) return;
  const k = d > 0 ? -1 : 1;
  ctx.beginPath();
  ctx.moveTo(x1 + 6 * k, y - 3.5);
  ctx.lineTo(x1, y);
  ctx.lineTo(x1 + 6 * k, y + 3.5);
  ctx.stroke();
}

/** Letak tegak tiga panah relatif sumbu saluran: lokal, konvektif, total. */
const BARIS = [-14, 0, 14] as const;

/**
 * Tiga panah percepatan di penampang x, dari garis penampang ke arah
 * tandanya: lokal (biru air), konvektif (ungu), seluruhnya (bata).
 */
export function drawDuctArrows(
  ctx: CanvasRenderingContext2D,
  map: PlateMap,
  x: number,
  local: number,
  convective: number,
  absMax: number,
  px0: number,
  px1: number,
  weight: number,
  dash: readonly number[]
): void {
  const k = absMax > 0 ? panjangPanah(px0, px1) / absMax : 0;
  const xp = map.X(x);
  const yc = map.Y(0);
  const nilai = [local, convective, local + convective];
  const warna = [C.water, C.critical, C.energy];
  for (let i = 0; i < 3; i++) {
    pen(ctx, weight, warna[i], dash);
    panahDatar(ctx, xp, xp + nilai[i] * k, yc + BARIS[i]);
  }
  ctx.setLineDash([]);
}

/**
 * Sketsa saluran mengerucut (tampak samping, tegak dilebihkan supaya
 * diameter terbaca) dengan garis penampang x dan panah percepatannya.
 * Sumbu datar memakai piksel px0..px1 dari ductSpan, dengan ruang satu
 * panjang panah di kedua sisi.
 */
export function drawDuct(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: DuctSpec
): PlateOut {
  ctx.fillStyle = C.sheet;
  ctx.fillRect(0, 0, w, h);
  const padT = 14;
  const padB = 14;
  const yc = padT + (h - padT - padB) / 2;
  const r1 = Math.max(s.D1, s.D2) / 2;
  const sy = (h - padT - padB) / 2 / Math.max(r1, 1e-9);
  const sx = (s.px1 - s.px0) / Math.max(s.L, 1e-9);
  const X = (v: number) => s.px0 + v * sx;
  const Y = (v: number) => yc - v * sy;
  const frame = { x0: s.px0, y0: padT, x1: s.px1, y1: h - padB };
  const map = mapFrom(X, Y, frame, [0, s.L], [-r1, r1]);

  // Air dan dinding.
  const rA = s.D1 / 2;
  const rB = s.D2 / 2;
  ctx.beginPath();
  ctx.moveTo(X(0), Y(rA));
  ctx.lineTo(X(s.L), Y(rB));
  ctx.lineTo(X(s.L), Y(-rB));
  ctx.lineTo(X(0), Y(-rA));
  ctx.closePath();
  ctx.fillStyle = C.waterFill;
  ctx.fill();
  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  ctx.moveTo(X(0), Y(rA));
  ctx.lineTo(X(s.L), Y(rB));
  ctx.moveTo(X(0), Y(-rA));
  ctx.lineTo(X(s.L), Y(-rB));
  ctx.stroke();
  // Sumbu saluran.
  pen(ctx, W.hair, C.ink3, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(X(0) - 8, yc);
  ctx.lineTo(X(s.L) + 8, yc);
  ctx.stroke();
  ctx.setLineDash([]);

  // Garis penampang x.
  const xp = X(s.x);
  const rx = rA + (rB - rA) * Math.min(Math.max(s.x / Math.max(s.L, 1e-9), 0), 1);
  pen(ctx, W.thin, C.ink2);
  ctx.beginPath();
  ctx.moveTo(xp, Y(rx) - 5);
  ctx.lineTo(xp, Y(-rx) + 5);
  ctx.stroke();

  drawDuctArrows(
    ctx,
    map,
    s.x,
    s.local,
    s.convective,
    s.absMax,
    s.px0,
    s.px1,
    s.faded ? W.hair : W.bold,
    s.faded ? DASH.phantom : DASH.solid
  );

  // Nama panah sebagai legenda di ujung saluran yang jauh dari garis
  // penampang (panah paling panjang 150 px, jadi tidak sampai ke sana);
  // tiap nama sebaris dengan panahnya dan berwarna sama.
  ctx.font = F.labelSm;
  ctx.textBaseline = "middle";
  const kiri = xp - s.px0 > (s.px1 - s.px0) / 2;
  ctx.textAlign = kiri ? "left" : "right";
  const nama = [s.labels.local, s.labels.convective, s.labels.total];
  const warna = [C.water, C.critical, C.energy];
  for (let i = 0; i < 3; i++) {
    const teks = nama[i];
    const tx = kiri ? s.px0 + 8 : s.px1 - 8;
    const ty = yc + BARIS[i];
    const lebar = ctx.measureText(teks).width;
    ctx.fillStyle = C.sheet;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(kiri ? tx - 2 : tx - lebar - 2, ty - 6, lebar + 4, 12);
    ctx.globalAlpha = 1;
    ctx.fillStyle = warna[i];
    ctx.fillText(teks, tx, ty);
  }
  ctx.textAlign = "center";
  ctx.fillStyle = C.ink2;
  ctx.fillText(`${s.labels.station} = ${fmtPlain(s.x, 2)} m`, Math.min(Math.max(xp, s.px0 + 40), s.px1 - 40), h - 6);

  return { map, anchors: { station: { x: xp, y: yc } } };
}

export type AccelMotionParams = {
  Q0: number;
  swing: number;
  omega: number;
  D1: number;
  D2: number;
  L: number;
  /** Penampang yang ditinjau, m */
  x: number;
  /** Skala panah, sama dengan lapis statis (accelRange di penampang x) */
  absMax: number;
};

export type AccelMotion = { kunci: number; teks: string };

export function createAccelMotion(): AccelMotion {
  return { kunci: NaN, teks: "" };
}

/**
 * FF-07. Kursor waktu τ = t mod 6 s (waktu nyata). Setiap frame:
 * - bidang profil (out.map): kurva konvektif, lokal, dan total pada saat τ
 * - sketsa saluran (out.maps.duct): panah ketiga suku di penampang x pada τ
 * - grafik a(t) (out.maps.ct, sumbu datar detik): garis kursor di τ dan
 *   titik ketiga suku pada τ
 */
export function drawAccelMotion(
  ctx: CanvasRenderingContext2D,
  t: number,
  out: PlateOut | null,
  p: AccelMotionParams,
  st: AccelMotion
): void {
  if (!out) return;
  const tau = sweepTime(t);
  const map = out.map;
  const f = map.frame;

  // Profil a(x) pada saat τ.
  ctx.save();
  ctx.beginPath();
  ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
  ctx.clip();
  const n = 80;
  for (let k = 0; k < 3; k++) {
    if (k === 0) pen(ctx, W.bold, C.critical);
    else if (k === 1) pen(ctx, W.bold, C.water, DASH.hidden);
    else pen(ctx, W.thin, C.energy);
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const xx = (p.L * i) / n;
      accelTerms(p.Q0, p.swing, p.omega, p.D1, p.D2, p.L, xx, tau, tmp3);
      const v = k === 0 ? tmp3[2] : k === 1 ? tmp3[1] : tmp3[1] + tmp3[2];
      if (i) ctx.lineTo(map.X(xx), map.Y(v));
      else ctx.moveTo(map.X(xx), map.Y(v));
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  accelTerms(p.Q0, p.swing, p.omega, p.D1, p.D2, p.L, p.x, tau, tmp3);
  const lokal = tmp3[1];
  const konv = tmp3[2];
  const total = lokal + konv;
  titik(ctx, map.X(p.x), map.Y(total), C.energy);
  ctx.restore();

  // Panah di sketsa saluran.
  const duct = out.maps?.duct;
  if (duct) {
    drawDuctArrows(ctx, duct, p.x, lokal, konv, p.absMax, duct.frame.x0, duct.frame.x1, W.bold, DASH.solid);
  }

  // Kursor waktu di grafik a(t).
  const ct = out.maps?.ct;
  if (ct) {
    const g = ct.frame;
    const px = ct.X(tau);
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0);
    ctx.clip();
    pen(ctx, W.thin, C.ink2);
    ctx.beginPath();
    ctx.moveTo(px, g.y0);
    ctx.lineTo(px, g.y1);
    ctx.stroke();
    titik(ctx, px, ct.Y(lokal), C.water);
    titik(ctx, px, ct.Y(konv), C.critical);
    titik(ctx, px, ct.Y(total), C.energy);
    ctx.restore();
  }

  // Jam.
  const kunci = Math.round(tau * 100);
  if (kunci !== st.kunci) {
    st.kunci = kunci;
    st.teks = `t = ${fmtPlain(kunci / 100, 2)} s`;
  }
  ctx.font = F.value;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const wT = ctx.measureText(st.teks).width;
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = C.sheet;
  ctx.fillRect(f.x0 + 4, f.y0 + 5, wT + 8, 16);
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.ink2;
  ctx.fillText(st.teks, f.x0 + 8, f.y0 + 13);
}

function titik(ctx: CanvasRenderingContext2D, px: number, py: number, warna: string) {
  ctx.fillStyle = warna;
  ctx.strokeStyle = C.sheet;
  ctx.lineWidth = W.thin;
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}
