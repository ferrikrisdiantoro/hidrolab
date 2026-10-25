import { C, DASH, F, W, stencil } from "./theme.ts";
import {
  axisTitle,
  axisValue,
  curveLabel,
  dimH,
  dimV,
  ground,
  hatchConcrete,
  hatchWater,
  niceStep,
  pen,
  region,
  ruling,
} from "./plate.ts";
import { specificEnergy, fmtPlain} from "./hydraulics.ts";
import { cl } from "./strings.ts";
import type { Lang } from "./i18n";
import { mapFrom, type PlateAnchor, type PlateOut } from "./plateOut.ts";

export type EnergyState = {
  /** Debit satuan, m2/s */
  q: number;
  /** Lebar dasar saluran, m */
  b: number;
  /** Kedalaman kritis, m */
  yc: number;
  /**
   * Kedalaman normal, m. NaN bila tidak ada kedalaman normal (debit
   * melampaui kapasitas saluran): muka air, y0, dan cadangan energi tidak
   * digambar, dan skala hanya dihitung dari yc dan Emin.
   */
  y0: number;
};

/**
 * DUA REGISTER DALAM SATU LEMBAR — cara buku teks hidraulika menyusun
 * figurnya: matematika di kiri (kurva energi spesifik), fisika di kanan
 * (penampang melintang sesungguhnya). Keduanya memakai skala kedalaman
 * yang sama, sehingga garis kedalaman kritis dan normal menyeberang
 * dari kurva ke penampang pada ketinggian yang persis sama.
 */
export function drawEnergy(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: EnergyState,
  lang: Lang
): PlateOut {
  const T = cl(lang);
  ground(ctx, w, h);

  const wide = w > 660;
  const sectionW = wide ? Math.min(230, w * 0.28) : 0;
  const curveW = w - sectionW;

  const padL = 60;
  const padR = wide ? 18 : 30;
  const padT = 26;
  const padB = 52;

  const plotW = Math.max(10, curveW - padL - padR);
  const plotH = Math.max(10, h - padT - padB);
  const baseY = padT + plotH;

  const Emin = 1.5 * s.yc;
  const adaY0 = Number.isFinite(s.y0) && s.y0 > 0;
  const E0 = adaY0 ? specificEnergy(s.y0, s.q) : NaN;
  const yMax = Math.max(adaY0 ? s.y0 * 1.55 : 0, s.yc * 2.5, 0.5);
  const eMax = Math.max(adaY0 ? E0 * 1.25 : 0, Emin * 2.1, yMax * 1.08);

  const X = (E: number) => padL + (E / eMax) * plotW;
  const Y = (y: number) => baseY - (y / yMax) * plotH;

  /* ---------------- kisi ---------------- */
  const ys = niceStep(yMax, 5);
  const es = niceStep(eMax, 5);
  const hs: number[] = [];
  const vs: number[] = [];
  for (let v = 0; v <= yMax + 1e-9; v += ys) hs.push(Y(v));
  for (let v = 0; v <= eMax + 1e-9; v += es) vs.push(X(v));
  ruling(ctx, padL, padT, padL + plotW, baseY, { horizontal: hs, vertical: vs });

  for (let v = 0; v <= yMax + 1e-9; v += ys)
    axisValue(ctx, fmtPlain(v, 1), padL - 8, Y(v), "right", "middle");
  for (let v = 0; v <= eMax + 1e-9; v += es)
    axisValue(ctx, fmtPlain(v, 1), X(v), baseY + 9, "center", "top");

  /* ---------------- asimtot E = y ---------------- */
  const lim = Math.min(yMax, eMax);
  pen(ctx, W.hair, C.ink3, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(X(0), Y(0));
  ctx.lineTo(X(lim), Y(lim));
  ctx.stroke();
  ctx.setLineDash([]);
  curveLabel(ctx, "E = y", X(lim * 0.78), Y(lim * 0.78) - 10, C.ink3);

  /* ---------------- kurva energi spesifik ----------------
     Kurva digambar dengan tinta, bukan dengan warna. Warna dalam berkas ini
     dikunci untuk BENDA dan besaran: biru air, merah energi, ungu kritis.
     Kurva bukan benda melainkan hubungan antara dua besaran, dan mewarnainya
     akan menabrak arti warna yang sudah dipakai garis-garis di sekitarnya. */
  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  let started = false;
  for (let i = 1; i <= 600; i++) {
    const y = (i / 600) * yMax;
    const E = specificEnergy(y, s.q);
    if (E > eMax) {
      started = false;
      continue;
    }
    if (!started) {
      ctx.moveTo(X(E), Y(y));
      started = true;
    } else ctx.lineTo(X(E), Y(y));
  }
  ctx.stroke();

  region(ctx, T.branchSub, X(eMax * 0.72), Y(yMax * 0.86), C.ink3);
  region(ctx, T.branchSuper, X(eMax * 0.72), Y(s.yc * 0.3), C.ink3);

  /* ---------------- kedalaman kritis ---------------- */
  pen(ctx, W.thin, C.critical, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(padL, Y(s.yc));
  ctx.lineTo(wide ? w : X(Emin), Y(s.yc));
  ctx.moveTo(X(Emin), baseY);
  ctx.lineTo(X(Emin), Y(s.yc));
  ctx.stroke();
  ctx.setLineDash([]);

  marker(ctx, X(Emin), Y(s.yc), C.critical);
  curveLabel(
    ctx,
    `yc ${fmtPlain(s.yc, 3)} m`,
    X(Emin) + 9,
    Y(s.yc) - 11,
    C.critical
  );
  curveLabel(ctx, `${T.minEnergy} ${fmtPlain(Emin, 3)}`, X(Emin) + 9, baseY - 12, C.critical);

  /* ---------------- kedalaman normal ---------------- */
  if (adaY0 && E0 <= eMax && s.y0 <= yMax) {
    pen(ctx, W.thin, C.water, DASH.hidden);
    ctx.beginPath();
    ctx.moveTo(padL, Y(s.y0));
    ctx.lineTo(wide ? w : X(E0), Y(s.y0));
    ctx.stroke();
    ctx.setLineDash([]);

    marker(ctx, X(E0), Y(s.y0), C.water, true);
    curveLabel(
      ctx,
      `y₀ ${fmtPlain(s.y0, 3)} m`,
      X(E0) + 10,
      Y(s.y0) + 11,
      C.water
    );

    // Cadangan energi di atas energi minimum.
    if (E0 - Emin > eMax * 0.03) {
      dimH(
        ctx,
        Y(s.y0) - 22,
        X(Emin),
        X(E0),
        `+${fmtPlain((E0 - Emin), 3)} m`,
        C.energy
      );
    }
  }

  /* ---------------- bingkai dan sumbu ---------------- */
  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(padL) + 0.5,
    Math.round(padT) + 0.5,
    Math.round(plotW),
    Math.round(plotH)
  );
  axisTitle(ctx, T.axEnergy, padL + plotW / 2, baseY + 34);
  axisTitle(ctx, T.axDepthShort, 18, padT + plotH / 2, -Math.PI / 2);

  /* ---------------- penampang melintang ---------------- */
  const penampang = wide ? drawSection(ctx, curveW, sectionW, s, T, Y, baseY, padT) : null;

  /*
   * PlateOut, tidak menggambar apa pun. Peta utama = kurva (E, y).
   * - `critical`: titik energi minimum (Emin, yc)
   * - `normal`: titik kedalaman normal (E0, y0), hanya bila tergambar
   * - `sectionSurface`: tengah muka air pada penampang (layar lebar, y0 ada)
   * - `sectionCritical`: tengah garis yc pada penampang (layar lebar)
   * `water` = air di dalam penampang. Penampang memakai skala tegak yang
   * sama dengan kurva, jadi `maps.section` hanya beda sumbu mendatarnya
   * (meter dari tepi kiri saluran).
   */
  const map = mapFrom(X, Y, { x0: padL, y0: padT, x1: padL + plotW, y1: baseY }, [0, eMax], [0, yMax]);
  const anchors: Record<string, PlateAnchor> = { critical: { x: X(Emin), y: Y(s.yc) } };
  if (adaY0 && E0 <= eMax && s.y0 <= yMax) anchors.normal = { x: X(E0), y: Y(s.y0) };
  if (!penampang) return { map, anchors };
  Object.assign(anchors, penampang.anchors);
  return {
    map,
    anchors,
    water: penampang.water,
    waters: penampang.water ? [penampang.water] : [],
    maps: { section: penampang.map },
  };
}

/** Penanda titik ukur: belah ketupat, isi kertas supaya kurva tidak tembus. */
function marker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  hollow = false
) {
  pen(ctx, W.thin, color);
  ctx.fillStyle = hollow ? C.sheet : color;
  ctx.beginPath();
  ctx.moveTo(x, y - 4.5);
  ctx.lineTo(x + 4.5, y);
  ctx.lineTo(x, y + 4.5);
  ctx.lineTo(x - 4.5, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * Penampang melintang, memakai skala kedalaman yang sama dengan kurva
 * di sebelah kiri — itulah yang membuat kedua register terbaca sebagai
 * satu gambar, bukan dua grafik yang kebetulan bersebelahan.
 */
function drawSection(
  ctx: CanvasRenderingContext2D,
  ox: number,
  w: number,
  s: EnergyState,
  T: ReturnType<typeof cl>,
  Y: (y: number) => number,
  baseY: number,
  padT: number
) {
  const pad = 26;
  const innerW = w - pad * 2;
  const cx = ox + w / 2;

  // Lebar saluran diskalakan agar muat; kedalaman TIDAK diskalakan ulang.
  const wallTop = padT + 6;
  const bw = Math.min(innerW, innerW * 0.86);
  const left = cx - bw / 2;
  const right = cx + bw / 2;

  pen(ctx, W.hair, C.rule);
  ctx.beginPath();
  ctx.moveTo(ox + 0.5, padT);
  ctx.lineTo(ox + 0.5, baseY + 20);
  ctx.stroke();

  region(ctx, T.section, cx, padT - 12, C.ink3);

  const adaY0 = Number.isFinite(s.y0) && s.y0 > 0;

  // Air (tidak ada bila kedalaman normal tidak ada)
  const wl = adaY0 ? Y(s.y0) : baseY;
  const clip = () => {
    ctx.beginPath();
    ctx.rect(left, wl, bw, baseY - wl);
  };
  if (adaY0) {
    ctx.save();
    clip();
    ctx.fillStyle = C.waterFill;
    ctx.fill();
    ctx.restore();
    hatchWater(ctx, clip, left, right, wl, baseY, 8);
  }

  // Kedalaman kritis menyeberang dari kurva di kiri.
  pen(ctx, W.thin, C.critical, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(left - 14, Y(s.yc));
  ctx.lineTo(right + 10, Y(s.yc));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = C.critical;
  ctx.font = F.labelSm;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  stencil(ctx, "yc", right + 13, Y(s.yc) - 2);

  // Muka air
  if (adaY0) {
    pen(ctx, W.bold, C.water);
    ctx.beginPath();
    ctx.moveTo(left, wl);
    ctx.lineTo(right, wl);
    ctx.stroke();
  }

  // Dinding dan dasar, digambar sebagai bidang terpotong
  const thk = 9;
  hatchConcrete(ctx, left - thk, wallTop, thk, baseY - wallTop + thk);
  hatchConcrete(ctx, right, wallTop, thk, baseY - wallTop + thk);
  hatchConcrete(ctx, left - thk, baseY, bw + thk * 2, thk);

  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  ctx.moveTo(left, wallTop);
  ctx.lineTo(left, baseY);
  ctx.lineTo(right, baseY);
  ctx.lineTo(right, wallTop);
  ctx.stroke();

  pen(ctx, W.hair, C.ink3);
  ctx.strokeRect(left - thk + 0.5, wallTop + 0.5, thk, baseY - wallTop + thk);
  ctx.strokeRect(right + 0.5, wallTop + 0.5, thk, baseY - wallTop + thk);
  ctx.strokeRect(left - thk + 0.5, baseY + 0.5, bw + thk * 2, thk);

  // Dimensi
  if (adaY0) dimV(ctx, left - thk - 16, wl, baseY, `y₀ ${fmtPlain(s.y0, 2)}`, C.water);
  dimH(
    ctx,
    baseY + thk + 20,
    left,
    right,
    `b ${fmtPlain(s.b, 2)} m`,
    C.ink2,
    baseY + thk
  );

  const Xs = (x: number) => left + (x / Math.max(s.b, 1e-9)) * bw;
  const anchors: Record<string, PlateAnchor> = {
    sectionCritical: { x: cx, y: Y(s.yc) },
  };
  if (adaY0) anchors.sectionSurface = { x: cx, y: wl };
  return {
    map: mapFrom(Xs, Y, { x0: ox, y0: padT, x1: ox + w, y1: baseY }, [0, Math.max(s.b, 1e-9)], [0, 1]),
    anchors,
    water: adaY0 ? Float64Array.of(left, wl, right, wl, right, baseY, left, baseY) : undefined,
  };
}
