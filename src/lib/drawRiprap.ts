import { C, DASH, F, W } from "./theme.ts";
import { createLabelPlacer, dimH, ground, hatchSoil, pen } from "./plate.ts";
import { mapFrom, rectsFrom, type PlateOut } from "./plateOut.ts";
import { fmtPlain } from "./hydraulics.ts";
import { grainFill } from "./drawGrain.ts";

/**
 * HS-08: POTONGAN TEBING BERLAPIS BATU (riprap), berskala d50.
 *
 * Panel di samping diagram Isbash. Batu digambar sebanding dengan diameter
 * yang dipasang, dua baris setebal 2d (tebal lapis riprapSize), di atas
 * tebing tanah berarsir. Skala fisik ditulis sebagai garis ukur meter.
 *
 * Yang SKEMATIK dan ditulis begitu oleh lembar:
 * - kemiringan tebing 1 : 2 (riprapSize tidak memuat kemiringan tebing)
 * - posisi gagal (R5): Isbash adalah keseimbangan gaya statis, tanpa
 *   dinamika. Batu tidak dianimasikan bergeser; posisi gagalnya digambar
 *   garis phantom tinta, tergeser RIPRAP_SLIDE_D d menuruni lereng dan RIPRAP_LIFT_D d
 *   keluar dari lapis (besar geseran tetap, bukan hitungan), sama dengan pola DM-01 (damFailure).
 */

/** Kemiringan tebing yang digambar, tegak : datar = 1 : 2. */
export const BANK_SLOPE_DRAWN = 0.5;
/** Panjang lereng yang digambar, dalam d terbesar (d pakai atau d50 perlu). */
const BANK_LEN_D = 9;
/** Geseran posisi gagal batu menuruni lereng, dalam d (skematik, tetap). */
export const RIPRAP_SLIDE_D = 1.5;
/** Angkatan posisi gagal keluar dari lapis, dalam d (skematik, tetap): batu
    yang terseret lepas dari kuncian tetangganya dan duduk di atas lapis. */
export const RIPRAP_LIFT_D = 1;

export type RiprapBankState = {
  /** Diameter batu yang dipasang (terpilih, atau d50 bila belum dipilih), m */
  dUsed: number;
  /** d50 yang dituntut Isbash, m */
  dReq: number;
  /** Ukuran batu dipilih pengguna */
  chosen: boolean;
  /** riprapSize().stable */
  stable: boolean;
  title: string;
  tint: string;
  /** Mis. "posisi gagal: batu terseret (skematik)" */
  phantomLabel: string;
  /** Mis. "d50 perlu" */
  reqLabel: string;
  /** Mis. "tebing 1 : 2 (skematik)" */
  slopeLabel: string;
};

/** Panjang garis ukur yang bulat (1, 2, 5 × 10^n), tidak melebihi `maks`. */
export function niceLength(maks: number): number {
  const e = Math.pow(10, Math.floor(Math.log10(maks)));
  for (const k of [5, 2, 1]) if (k * e <= maks + 1e-12) return k * e;
  return e;
}

/** Banyak batu yang digeser ke posisi gagal (0 bila stabil atau belum dipilih). */
export function riprapFailedCount(nPerRow: number, chosen: boolean, stable: boolean): number {
  if (!chosen || stable) return 0;
  return Math.max(0, nPerRow - 1 - Math.floor((nPerRow - 1) / 2));
}

export function drawRiprapBank(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: RiprapBankState
): PlateOut & { stones: number; failed: number; pxPerM: number } {
  ground(ctx, w, h);
  /* Pita kepala: judul, angka, lalu satu baris per keterangan (posisi
     gagal, d50 perlu). Keterangan ditulis di pita ini, bukan di dalam
     gambar, supaya tidak pernah menindih batu; penunjuknya garis rambut. */
  const gagalAda = s.chosen && !s.stable;
  const yGagal = 44;
  const yPerlu = gagalAda ? 60 : 44;
  const top = 44 + (gagalAda ? 16 : 0) + (s.chosen ? 16 : 0);
  const bottom = h - 34;
  const left = 10;
  const right = w - 10;
  // Lereng 1 : 2 sebesar mungkin di bidang yang tersedia.
  let lebar = (right - left) * 0.84;
  if (lebar * BANK_SLOPE_DRAWN > (bottom - top) * 0.78) lebar = ((bottom - top) * 0.78) / BANK_SLOPE_DRAWN;
  const T = { x: right - lebar - 4, y: bottom - 14 };
  const Cr = { x: T.x + lebar, y: T.y - lebar * BANK_SLOPE_DRAWN };
  const L = Math.hypot(Cr.x - T.x, Cr.y - T.y);
  const ux = (Cr.x - T.x) / L;
  const uy = (Cr.y - T.y) / L;
  // Normal ke luar lereng (ke arah air, kiri atas).
  const nx = uy;
  const ny = -ux;
  const dMax = Math.max(s.dUsed, s.dReq, 1e-9);
  const k = L / (BANK_LEN_D * dMax);
  const dp = s.dUsed * k;
  const r = dp / 2;
  const t = 2 * dp;
  const frame = { x0: left, y0: top, x1: right, y1: bottom };
  const map = mapFrom(
    (v) => T.x + v * k,
    (v) => T.y - v * k,
    frame,
    [(left - T.x) / k, (right - T.x) / k],
    [(T.y - bottom) / k, (T.y - top) / k]
  );

  /* Air di saluran, sampai 70 % tinggi lereng. */
  const yAir = T.y - 0.7 * (T.y - Cr.y);
  const xAir = T.x + (T.y - yAir) / BANK_SLOPE_DRAWN + nx * t;
  ctx.fillStyle = C.waterFill;
  ctx.beginPath();
  ctx.moveTo(left, yAir);
  ctx.lineTo(xAir, yAir);
  ctx.lineTo(T.x + nx * t, T.y);
  ctx.lineTo(left, T.y);
  ctx.closePath();
  ctx.fill();
  pen(ctx, W.thin, C.water);
  ctx.beginPath();
  ctx.moveTo(left, yAir);
  ctx.lineTo(xAir, yAir);
  ctx.stroke();

  /* Tubuh tebing dan dasar saluran: tanah berarsir. */
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left, T.y);
  ctx.lineTo(T.x, T.y);
  ctx.lineTo(Cr.x, Cr.y);
  ctx.lineTo(right, Cr.y);
  ctx.lineTo(right, bottom + 12);
  ctx.lineTo(left, bottom + 12);
  ctx.closePath();
  ctx.clip();
  hatchSoil(ctx, left, Cr.y, right - left, bottom + 12 - Cr.y, 7);
  ctx.restore();
  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  ctx.moveTo(left, T.y);
  ctx.lineTo(T.x, T.y);
  ctx.lineTo(Cr.x, Cr.y);
  ctx.lineTo(right, Cr.y);
  ctx.stroke();

  /* Lapis batu: dua baris berdiameter d, tebal 2d, di atas lereng. */
  const fill = grainFill(s.dUsed);
  const batu = (cx: number, cy: number, phantom: boolean) => {
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1, r - 0.5), 0, Math.PI * 2);
    if (phantom) {
      pen(ctx, W.thin, C.ink, DASH.phantom);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    ctx.fillStyle = fill;
    ctx.fill();
    pen(ctx, dp > 8 ? W.thin : W.hair, C.ink);
    ctx.stroke();
  };
  const nBatu = Math.max(1, Math.floor(L / dp));
  const pusat = (baris: number, j: number) => {
    const sAlong = (j + 0.5 + (baris === 1 ? 0.5 : 0)) * dp;
    const off = r + baris * dp;
    return { x: T.x + ux * sAlong + nx * off, y: T.y + uy * sAlong + ny * off };
  };
  let stones = 0;
  for (let baris = 0; baris < 2; baris++) {
    for (let j = 0; j < nBatu - baris; j++) {
      const p = pusat(baris, j);
      batu(p.x, p.y, false);
      stones++;
    }
  }

  const lp = createLabelPlacer(ctx, { padL: 4, padT: 2, plotW: w - 8, plotH: h - 4 });
  lp.write(s.title, left, 12, s.tint, { align: "left" });

  /* Tulisan biasa: simbol dan satuan tidak dikapitalkan stensil. Kotaknya
     didaftarkan ke penempat yang sama dengan judul, dan tulisan yang
     menabrak kotak terdaftar (judul, tulisan lain, kelompok batu phantom)
     digeser turun satu baris, seperti createLabelPlacer.place. */
  const tabrak = (x0: number, x1: number, a0: number, a1: number) =>
    lp.boxes().some((d) => x0 < d.x1 && x1 > d.x0 && a0 < d.bawah && a1 > d.atas);
  const tulis = (teks: string, x: number, y: number, warna: string, align: CanvasTextAlign = "left") => {
    ctx.font = F.value;
    const lebarT = ctx.measureText(teks).width;
    const x0 = align === "left" ? x : align === "right" ? x - lebarT : x - lebarT / 2;
    const xx = Math.min(Math.max(x0, 4), w - lebarT - 4);
    let yy = y;
    for (let i = 0; i < 10 && tabrak(xx - 2, xx + lebarT + 2, yy - 7, yy + 7); i++) yy += 15;
    lp.reserve(xx - 2, xx + lebarT + 2, yy - 7, yy + 7);
    ctx.fillStyle = C.sheet;
    ctx.fillRect(xx - 2, yy - 7, lebarT + 4, 14);
    ctx.fillStyle = warna;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(teks, xx, yy);
    return { x0: xx, x1: xx + lebarT, y: yy };
  };

  const m = (v: number) => `${fmtPlain(v, v >= 1 ? 2 : 3)} m`;
  tulis(`d = ${m(s.dUsed)}; t = 2d = ${m(2 * s.dUsed)}`, left, 28, C.ink2);

  /* Posisi gagal (R5), phantom tinta, tanpa gerak. Tulisannya di ruang
     udara kiri atas (di atas air, di kiri lereng), dengan garis penunjuk
     rambut ke kelompok phantom, supaya tidak menindih batu atau judul. */
  const failed = riprapFailedCount(nBatu, s.chosen, s.stable);
  if (failed > 0) {
    const gx = -ux * RIPRAP_SLIDE_D * dp + nx * RIPRAP_LIFT_D * dp;
    const gy = -uy * RIPRAP_SLIDE_D * dp + ny * RIPRAP_LIFT_D * dp;
    let px = 0;
    let py = 0;
    let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
    for (let j = nBatu - 1 - failed; j < nBatu - 1; j++) {
      const p = pusat(1, j);
      const qx = p.x + gx;
      const qy = p.y + gy;
      batu(qx, qy, true);
      px += qx;
      py += qy;
      bx0 = Math.min(bx0, qx - r);
      bx1 = Math.max(bx1, qx + r);
      by0 = Math.min(by0, qy - r);
      by1 = Math.max(by1, qy + r);
    }
    lp.reserve(bx0, bx1, by0, by1);
    const pos = tulis(s.phantomLabel, left, yGagal, C.ink);
    // Garis penunjuk dari ujung tulisan ke batu phantom terdekat.
    const ax = Math.min(Math.max(px / failed, pos.x0), pos.x1);
    pen(ctx, W.hair, C.ink);
    ctx.beginPath();
    ctx.moveTo(ax, pos.y + 7);
    ctx.lineTo(px / failed, by0 - 1);
    ctx.stroke();
  }

  /* Pembanding ukuran: d50 yang dituntut, lingkaran garis tersembunyi
     ungu (warna kurva Isbash), di ruang udara kiri atas di bawah tulisan
     lain; ikut tinggi panel: dijepit di antara tulisan dan muka air. */
  if (s.chosen) {
    const rq = (s.dReq * k) / 2;
    // Ruang udara kiri atas, tepat di bawah pita kepala.
    const cx = left + 6 + rq;
    const cy = top + rq + 4;
    pen(ctx, W.thin, C.critical, DASH.hidden);
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1, rq), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    lp.reserve(cx - rq, cx + rq, cy - rq, cy + rq);
    const pos = tulis(`${s.reqLabel} ${m(s.dReq)}`, left, yPerlu, C.critical, "left");
    pen(ctx, W.hair, C.critical);
    ctx.beginPath();
    ctx.moveTo(Math.min(cx, pos.x1), pos.y + 7);
    ctx.lineTo(cx, cy - rq - 1);
    ctx.stroke();
  }

  /* Catatan kemiringan skematik di bawah kaki tebing. */
  tulis(s.slopeLabel, left + 2, T.y + 12, C.ink3);

  /* Garis ukur skala. */
  const bar = niceLength((0.3 * (right - left)) / k);
  const yUkur = h - 6;
  dimH(ctx, yUkur, right - bar * k, right, "", C.ink2, undefined, [0, w]);
  const teksUkur = `${fmtPlain(bar, bar >= 1 ? 0 : bar >= 0.1 ? 1 : bar >= 0.01 ? 2 : 3)} m`;
  ctx.font = F.label;
  const lu = ctx.measureText(teksUkur).width;
  ctx.fillStyle = C.ink2;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(teksUkur, right - bar * k - lu - 8, yUkur + 4);

  return { map, anchors: {}, labels: rectsFrom(lp.boxes()), stones, failed, pxPerM: k };
}
