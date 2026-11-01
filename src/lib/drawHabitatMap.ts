import { C, DASH, F, HABITAT, W, stencil, stencilWidth } from "./theme.ts";
import { dimV, ground, pen } from "./plate.ts";
import { drawField, type FieldSpec } from "./drawField.ts";
import type { HabitatCell } from "./hydraulics.ts";
import type { Lang } from "./i18n";
import { mapFrom, type PlateOut } from "./plateOut.ts";
import { shiftPlateOut } from "./plateShift.ts";

/**
 * LEMBAR EH-06: LENGKUNG LUAS LAYAK DI ATAS, PETA HABITAT DI BAWAH.
 *
 * Peta habitat adalah tampak atas satu reach. Isinya pias melintang model
 * riverHabitat (r.cells, 60 pias selebar W) yang DIULANG sepanjang reach:
 * model hanya punya satu penampang, jadi reach-nya seragam dan setiap
 * pias menjadi satu jalur sejajar aliran. Lembar wajib menulis "reach
 * seragam"; reach riffle-pool butuh model geometri dasar yang belum ada.
 *
 * Tiga warna, dari indeks model sendiri (tanpa rumus baru):
 * - layak: f(d)·f(V) ≥ HABITAT_SUITABLE_MIN
 * - selain itu dibagi menurut SISI pembatasnya. Pembatas = indeks yang lebih
 *   kecil di antara f(d) dan f(V). Di bawah nilai terbaiknya (dangkal atau
 *   lambat) = kelas "shallow"; di atasnya (dalam atau deras) = kelas "fast".
 * Nama kelas di legenda menyebut VARIABEL pembatas yang benar-benar ada di
 * kelas itu (habitatStats), bukan satu nama tetap per warna. V tidak selalu
 * naik bersama d: pada sungai landai dan kasar (S 0,2 ‰, n 0,08, Q 5) alur
 * tengahnya dalam tetapi lambat, jadi kelas di atas nilai terbaik di sana
 * "terlalu dalam", bukan "terlalu deras", dan tepinya "terlalu lambat".
 * Pias dalam satu warna bisa dibatasi variabel berbeda; legendanya lalu
 * menyebut keduanya dengan bagian lebar masing-masing.
 * Warna dari token HABITAT, bukan merah sinyal: tidak layak bagi ikan
 * bukan di luar rentang rumus.
 */

/**
 * Ambang kelas layak pada peta, f(d)·f(V). Ambang tampilan pilihan lembar,
 * bukan bagian model IFIM/WUA; ditulis di legenda dan catatan lembar.
 */
export const HABITAT_SUITABLE_MIN = 0.5;

/** shallow = di bawah nilai terbaik (dangkal/lambat); fast = di atasnya (dalam/deras). */
export type HabitatKind = "shallow" | "suitable" | "fast";
export type HabitatLimit = "depth" | "velocity";

/** Variabel pembatas pias: indeks yang lebih kecil (kedalaman bila kering atau seri). */
export function habitatLimit(cell: HabitatCell): HabitatLimit {
  if (!(cell.depth > 0)) return "depth";
  return cell.depthIndex <= cell.velocityIndex ? "depth" : "velocity";
}

export function habitatKind(
  cell: HabitatCell,
  bestDepth: number,
  bestVelocity: number,
  min = HABITAT_SUITABLE_MIN
): HabitatKind {
  if (!(cell.depth > 0)) return "shallow";
  if (cell.combined >= min) return "suitable";
  const bawah = habitatLimit(cell) === "depth" ? cell.depth < bestDepth : cell.velocity < bestVelocity;
  return bawah ? "shallow" : "fast";
}

/** Bagian lebar tiap kelas, nol sampai satu (pias model sama lebar). */
export function habitatShares(
  cells: readonly HabitatCell[],
  bestDepth: number,
  bestVelocity: number,
  min = HABITAT_SUITABLE_MIN
): Record<HabitatKind, number> {
  const s = habitatStats(cells, bestDepth, bestVelocity, min);
  return { shallow: s.shallow.total, suitable: s.suitable.total, fast: s.fast.total };
}

/** Bagian lebar satu kelas, dipecah menurut variabel pembatasnya. */
export type HabitatShare = { total: number; depth: number; velocity: number };

export function habitatStats(
  cells: readonly HabitatCell[],
  bestDepth: number,
  bestVelocity: number,
  min = HABITAT_SUITABLE_MIN
): Record<HabitatKind, HabitatShare> {
  const n = {
    shallow: { total: 0, depth: 0, velocity: 0 },
    suitable: { total: 0, depth: 0, velocity: 0 },
    fast: { total: 0, depth: 0, velocity: 0 },
  };
  for (const c of cells) {
    const b = n[habitatKind(c, bestDepth, bestVelocity, min)];
    b.total++;
    b[habitatLimit(c)]++;
  }
  const t = Math.max(cells.length, 1);
  for (const b of Object.values(n)) {
    b.total /= t;
    b.depth /= t;
    b.velocity /= t;
  }
  return n;
}

/** Nama kelas dalam bahasa aktif. `none` dipakai bila kelasnya kosong. */
export type HabitatWords = {
  suitable: string;
  shallow: { depth: string; velocity: string; none: string };
  fast: { depth: string; velocity: string; none: string };
};

/**
 * Teks legenda satu kelas: kelas tak layak menyebut tiap variabel pembatas
 * yang ada beserta bagian lebarnya; nama kedua ditulis huruf kecil di awal.
 */
export function habitatLegendText(
  k: HabitatKind,
  s: HabitatShare,
  words: HabitatWords,
  share: (f: number) => string
): string {
  if (k === "suitable") return `${words.suitable} ${share(s.total)}`;
  const w = words[k];
  const bagian: string[] = [];
  if (s.depth > 0) bagian.push(`${w.depth} ${share(s.depth)}`);
  if (s.velocity > 0) bagian.push(`${w.velocity} ${share(s.velocity)}`);
  if (!bagian.length) return `${w.none} ${share(0)}`;
  return bagian.map((b, i) => (i ? b.charAt(0).toLowerCase() + b.slice(1) : b)).join(", ");
}

export type HabitatMapSpec = {
  cells: readonly HabitatCell[];
  /** Lebar sungai, meter */
  width: number;
  bestDepth: number;
  bestVelocity: number;
  /** Teks, sudah dalam bahasa aktif */
  title: string;
  widthText: string;
  flowText: string;
  /** Nama kelas per variabel pembatas, persentase lewat `share` */
  words: HabitatWords;
  /** Penulis persen dalam bahasa aktif, misalnya (0,3) → "30 %" */
  share: (f: number) => string;
};

const URUT: HabitatKind[] = ["shallow", "suitable", "fast"];

/**
 * PlateOut: `map` = lengkung (debit, luas layak) dengan anchors dari
 * `chart.anchors`; `maps.peta` = peta habitat (x sepanjang reach, y
 * melintang dari tepi kiri, meter).
 */
export function drawHabitatPlate(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  chart: FieldSpec,
  peta: HabitatMapSpec,
  lang: Lang
): PlateOut {
  const ch = Math.round(h * 0.62);
  const out = drawField(ctx, w, ch, chart, lang);

  const mh = h - ch;
  ctx.save();
  ctx.translate(0, ch);
  ground(ctx, w, mh);

  /* Legenda: susun dulu supaya tinggi tepi bawah diketahui. */
  ctx.font = F.labelSm;
  const kotak = 12;
  const bagian = habitatStats(peta.cells, peta.bestDepth, peta.bestVelocity);
  const item = URUT.map((k) => {
    const teks = habitatLegendText(k, bagian[k], peta.words, peta.share);
    return { k, teks, lebar: kotak + 6 + stencilWidth(ctx, teks, 0.8) + 16 };
  });
  const kiriLeg = 16;
  const kananLeg = w - 16;
  const baris: (typeof item)[] = [[]];
  let xx = kiriLeg;
  for (const it of item) {
    if (xx + it.lebar > kananLeg && baris[baris.length - 1].length) {
      baris.push([]);
      xx = kiriLeg;
    }
    baris[baris.length - 1].push(it);
    xx += it.lebar;
  }
  const tinggiBaris = 16;

  const padL = 58;
  const padR = 26;
  const padT = 22;
  const padB = 8 + baris.length * tinggiBaris;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = Math.max(10, mh - padT - padB);

  /* Skala sama di kedua arah: tinggi bidang = lebar sungai, jadi panjang
     reach tergambar = W · plotW / plotH. */
  const W0 = Math.max(peta.width, 1e-9);
  const skala = plotH / W0;
  const L = plotW / skala;
  const X = (x: number) => padL + x * skala;
  const Y = (y: number) => padT + y * skala;

  /* Judul panel di atas bidang. */
  ctx.fillStyle = C.ink2;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = F.label;
  if (stencilWidth(ctx, peta.title, 0.8) > w - 32) ctx.font = F.labelSm;
  stencil(ctx, peta.title, 16, padT - 8);

  /* Jalur kelas, digabung bila pias berurutan sekelas. */
  const n = peta.cells.length;
  const dy = W0 / Math.max(n, 1);
  const kelas = peta.cells.map((c) => habitatKind(c, peta.bestDepth, peta.bestVelocity));
  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, padT, plotW, plotH);
  ctx.clip();
  const batas: number[] = [];
  let i0 = 0;
  for (let i = 1; i <= n; i++) {
    if (i < n && kelas[i] === kelas[i0]) continue;
    const k = kelas[i0];
    ctx.fillStyle = HABITAT[k].fill;
    const y0 = Y(i0 * dy);
    const y1 = Y(i * dy);
    ctx.fillRect(padL, y0, plotW, y1 - y0);
    if (i < n) batas.push(i * dy);
    i0 = i;
  }
  /* Garis batas kelas: rambut, warna kelas sisi tengah (lebih dekat ke
     alur), sejajar aliran karena reach-nya seragam. */
  for (const yb of batas) {
    const iTengah = yb < W0 / 2 ? Math.round(yb / dy) : Math.round(yb / dy) - 1;
    pen(ctx, W.hair, HABITAT[kelas[Math.min(Math.max(iTengah, 0), n - 1)]].line);
    ctx.beginPath();
    ctx.moveTo(padL, Y(yb));
    ctx.lineTo(padL + plotW, Y(yb));
    ctx.stroke();
  }
  /* Garis tengah alur (terdalam pada penampang parabola). */
  pen(ctx, W.hair, C.ink3, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(padL, Y(W0 / 2));
  ctx.lineTo(padL + plotW, Y(W0 / 2));
  ctx.stroke();
  ctx.restore();

  /* Tepi sungai: benda fisik, garis tebal. */
  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  ctx.moveTo(padL, Y(0));
  ctx.lineTo(padL + plotW, Y(0));
  ctx.moveTo(padL, Y(W0));
  ctx.lineTo(padL + plotW, Y(W0));
  ctx.stroke();

  /* Arah aliran: panah pada garis tengah, di kanan, dengan nama. */
  ctx.font = F.labelSm;
  const lebarAliran = stencilWidth(ctx, peta.flowText, 0.8);
  const xa1 = padL + plotW - 10;
  const xa0 = Math.max(padL + 10, xa1 - 46);
  const ya = Y(W0 / 2);
  ctx.fillStyle = C.sheet;
  ctx.fillRect(xa0 - lebarAliran - 12, ya - 6, lebarAliran + 8, 12);
  ctx.fillStyle = C.water;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  stencil(ctx, peta.flowText, xa0 - 6, ya);
  pen(ctx, W.thin, C.water);
  ctx.beginPath();
  ctx.moveTo(xa0, ya);
  ctx.lineTo(xa1, ya);
  ctx.moveTo(xa1, ya);
  ctx.lineTo(xa1 - 6, ya - 3);
  ctx.moveTo(xa1, ya);
  ctx.lineTo(xa1 - 6, ya + 3);
  ctx.stroke();

  /* Lebar sungai: ukuran tegak di kiri. */
  dimV(ctx, padL - 14, Y(0), Y(W0), peta.widthText, C.ink2, padL);

  /* Bingkai. */
  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(Math.round(padL) + 0.5, Math.round(padT) + 0.5, Math.round(plotW), Math.round(plotH));

  /* Legenda. */
  ctx.font = F.labelSm;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  baris.forEach((b, j) => {
    let x = kiriLeg;
    const y = padT + plotH + 8 + j * tinggiBaris + tinggiBaris / 2;
    for (const it of b) {
      ctx.fillStyle = HABITAT[it.k].fill;
      ctx.fillRect(x, y - 5, kotak, 10);
      pen(ctx, W.thin, HABITAT[it.k].line);
      ctx.strokeRect(x + 0.5, y - 4.5, kotak - 1, 9);
      ctx.fillStyle = C.ink2;
      stencil(ctx, it.teks, x + kotak + 6, y);
      x += it.lebar;
    }
  });
  ctx.restore();

  const frame = { x0: padL, y0: padT, x1: padL + plotW, y1: padT + plotH };
  const petaMap = mapFrom(X, Y, frame, [0, L], [0, W0]);
  const geser = shiftPlateOut({ map: petaMap }, 0, ch);
  return { ...out, maps: { ...(out.maps ?? {}), peta: geser.map } };
}
