import { C, DASH, F, W, stencil, stencilWidth } from "./theme";

/**
 * Perkakas gambar teknik yang dipakai bersama oleh semua lembar.
 *
 * Semua fungsi di sini mematuhi tiga bobot garis dan kosakata warna
 * yang dikunci di theme.ts. Tidak ada fungsi di berkas ini yang
 * menggambar sesuatu yang tidak membawa data, kecuali garis kisi —
 * dan kisi memakai bobot rambut supaya tidak pernah terbaca sebagai isi.
 */

export type Dash = readonly number[];

export function pen(
  ctx: CanvasRenderingContext2D,
  weight: number,
  color: string,
  dash: Dash = DASH.solid
) {
  ctx.lineWidth = weight;
  ctx.strokeStyle = color;
  ctx.setLineDash(dash as number[]);
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
}

/** Membersihkan bidang gambar. */
export function ground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = C.sheet;
  ctx.fillRect(0, 0, w, h);
}

/* ------------------------------------------------------------------ *
 * Kisi
 * ------------------------------------------------------------------ */

export function ruling(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  opts: {
    vertical?: number[];
    horizontal?: number[];
    strong?: boolean;
  }
) {
  pen(ctx, W.hair, opts.strong ? C.rule : C.ruleFaint);
  ctx.beginPath();
  for (const x of opts.vertical ?? []) {
    const xx = Math.round(x) + 0.5;
    ctx.moveTo(xx, y0);
    ctx.lineTo(xx, y1);
  }
  for (const y of opts.horizontal ?? []) {
    const yy = Math.round(y) + 0.5;
    ctx.moveTo(x0, yy);
    ctx.lineTo(x1, yy);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Jarak kisi yang bulat: 1, 2, atau 5 kali pangkat sepuluh. */
export function niceStep(range: number, target: number): number {
  const raw = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return nice * mag;
}

/* ------------------------------------------------------------------ *
 * Dimensi
 *
 * Anatomi lengkap: garis ekstensi keluar dari benda dengan CELAH,
 * garis dimensi di antaranya, terminator tick 45 derajat, angka
 * duduk di atas garis yang utuh (konvensi ISO).
 * ------------------------------------------------------------------ */

const EXT_GAP = 4;
const EXT_OVER = 5;
const TICK = 4;

function tick45(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  vertical: boolean
) {
  ctx.beginPath();
  if (vertical) {
    ctx.moveTo(x - TICK, y + TICK);
    ctx.lineTo(x + TICK, y - TICK);
  } else {
    ctx.moveTo(x - TICK, y + TICK);
    ctx.lineTo(x + TICK, y - TICK);
  }
  ctx.stroke();
}

/**
 * Dimensi vertikal pada absis x, antara dua ordinat layar.
 * objX bila diberikan menggambar garis ekstensi dari benda ke garis dimensi.
 */
export function dimV(
  ctx: CanvasRenderingContext2D,
  x: number,
  yTop: number,
  yBottom: number,
  label: string,
  color: string,
  objX?: number
) {
  pen(ctx, W.thin, color);

  if (objX !== undefined) {
    const dir = Math.sign(x - objX) || 1;
    ctx.beginPath();
    for (const y of [yTop, yBottom]) {
      ctx.moveTo(objX + dir * EXT_GAP, y);
      ctx.lineTo(x + dir * EXT_OVER, y);
    }
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(x, yTop);
  ctx.lineTo(x, yBottom);
  ctx.stroke();

  tick45(ctx, x, yTop, true);
  tick45(ctx, x, yBottom, true);

  // Angka dibaca dari kanan pada dimensi vertikal.
  ctx.save();
  ctx.translate(x - 5, (yTop + yBottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = color;
  ctx.font = F.label;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  stencil(ctx, label, 0, 0);
  ctx.restore();
}

/** Dimensi horizontal pada ordinat y, antara dua absis layar. */
export function dimH(
  ctx: CanvasRenderingContext2D,
  y: number,
  xLeft: number,
  xRight: number,
  label: string,
  color: string,
  objY?: number
) {
  pen(ctx, W.thin, color);

  if (objY !== undefined) {
    const dir = Math.sign(y - objY) || 1;
    ctx.beginPath();
    for (const x of [xLeft, xRight]) {
      ctx.moveTo(x, objY + dir * EXT_GAP);
      ctx.lineTo(x, y + dir * EXT_OVER);
    }
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(xLeft, y);
  ctx.lineTo(xRight, y);
  ctx.stroke();

  tick45(ctx, xLeft, y, false);
  tick45(ctx, xRight, y, false);

  ctx.fillStyle = color;
  ctx.font = F.label;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  stencil(ctx, label, (xLeft + xRight) / 2, y - 5);
}

/* ------------------------------------------------------------------ *
 * Leader / callout
 *
 * Garis miring dari benda, satu patahan horizontal pendek sebelum teks,
 * titik bulat di ujung yang menunjuk. Shoulder itulah yang membedakan
 * callout teknik dari garis penunjuk sembarangan.
 * ------------------------------------------------------------------ */

export function leader(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  label: string,
  color: string
) {
  const dir = toX >= fromX ? 1 : -1;
  const shoulder = 14;

  pen(ctx, W.thin, color);
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.lineTo(toX + dir * shoulder, toY);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(fromX, fromY, 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = F.label;
  ctx.textAlign = dir > 0 ? "left" : "right";
  ctx.textBaseline = "middle";
  stencil(ctx, label, toX + dir * (shoulder + 4), toY - 0.5);
}

/* ------------------------------------------------------------------ *
 * Nama wilayah
 *
 * Menamai daerah di dalam gambar, bukan hanya sumbunya. Inilah yang
 * membuat diagram Moody terasa seperti peta, bukan sekadar plot.
 * ------------------------------------------------------------------ */

export function region(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string = C.ink3,
  rotate = 0
) {
  ctx.save();
  ctx.translate(x, y);
  if (rotate) ctx.rotate(rotate);
  ctx.fillStyle = color;
  ctx.font = F.region;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  stencil(ctx, text, 0, 0, 1.4);
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * Arsiran
 * ------------------------------------------------------------------ */

/**
 * Arsiran air: garis horizontal pendek putus-putus, sejajar muka air.
 * Ini konvensi baku. Air yang diarsir miring terbaca sebagai beton.
 */
export function hatchWater(
  ctx: CanvasRenderingContext2D,
  clip: () => void,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  spacing = 9
) {
  ctx.save();
  clip();
  ctx.clip();

  pen(ctx, W.hair, C.water, [7, 6]);
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  let row = 0;
  for (let y = y0; y <= y1; y += spacing) {
    const yy = Math.round(y) + 0.5;
    const offset = row % 2 === 0 ? 0 : 6;
    ctx.moveTo(x0 + offset, yy);
    ctx.lineTo(x1, yy);
    row++;
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.restore();
}

/** Arsiran beton: garis 45 derajat, hanya pada bidang yang terpotong. */
export function hatchConcrete(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  spacing = 7
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  pen(ctx, W.hair, C.concrete);
  ctx.globalAlpha = 0.42;
  ctx.beginPath();
  for (let i = -h; i < w + h; i += spacing) {
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + h, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * Label pada kurva
 *
 * Label keluarga kurva diletakkan di ujung kurvanya, bukan di kotak
 * legenda. Ini yang membuat diagram Moody bisa ditelusuri dengan jari.
 * ------------------------------------------------------------------ */

export function curveLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  align: CanvasTextAlign = "left"
) {
  ctx.font = F.labelSm;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";

  const wText = stencilWidth(ctx, text, 0.6);
  const padX = 3;
  const bx = align === "left" ? x - padX : x - wText - padX;

  // Kertas dikosongkan di bawah label supaya kurva tidak menembus huruf.
  ctx.fillStyle = C.sheet;
  ctx.fillRect(bx, y - 6, wText + padX * 2, 12);

  ctx.fillStyle = color;
  stencil(ctx, text, x, y, 0.6);
}

/** Nilai numerik pada sumbu. */
export function axisValue(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: CanvasTextAlign,
  baseline: CanvasTextBaseline
) {
  ctx.fillStyle = C.ink3;
  ctx.font = F.value;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}

/** Judul sumbu, ditulis bergaya stensil. */
export function axisTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  rotate = 0
) {
  ctx.save();
  ctx.translate(x, y);
  if (rotate) ctx.rotate(rotate);
  ctx.fillStyle = C.ink2;
  ctx.font = F.label;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  stencil(ctx, text, 0, 0, 1.1);
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * Badan pipa dalam potongan memanjang
 *
 * Dipakai bersama oleh setiap lembar yang menggambar alat di dalam pipa.
 * Yang diurus di sini hanya bendanya: dinding, arsiran bahan, dan sumbu.
 * Isi alirannya diserahkan kepada pemanggil, karena itulah yang berbeda
 * dari satu lembar ke lembar lain.
 * ------------------------------------------------------------------ */

export type PipeWall = { x: number; r: number }[];

/**
 * Menggambar dinding pipa simetris terhadap sumbunya.
 *
 * Profil diberikan sebagai jari-jari terhadap absis, sehingga pipa lurus,
 * penyempitan, dan pembesaran semuanya ditangani bentuk data yang sama.
 * Dinding digambar dengan ketebalan nyata dan diarsir bahan, karena pada
 * potongan melintang dinding memang benda yang terpotong.
 */
export function pipeBody(
  ctx: CanvasRenderingContext2D,
  wall: PipeWall,
  X: (x: number) => number,
  R: (r: number) => number,
  opts: {
    /** Tebal dinding dalam satuan jari-jari */
    thickness: number;
    /** Batas bidang gambar untuk memotong arsiran */
    clip: { x: number; y: number; w: number; h: number };
    /** Gambar sumbu putus titik di tengah pipa */
    axis?: boolean;
  }
) {
  const urut = [...wall].sort((a, b) => a.x - b.x);
  const t = opts.thickness;

  const bidang = (tanda: 1 | -1) => {
    ctx.beginPath();
    urut.forEach((p, i) =>
      i
        ? ctx.lineTo(X(p.x), R(tanda * p.r))
        : ctx.moveTo(X(p.x), R(tanda * p.r))
    );
    for (let i = urut.length - 1; i >= 0; i--) {
      ctx.lineTo(X(urut[i].x), R(tanda * (urut[i].r + t)));
    }
    ctx.closePath();
  };

  for (const tanda of [1, -1] as const) {
    ctx.save();
    bidang(tanda);
    ctx.clip();
    hatchConcrete(ctx, opts.clip.x, opts.clip.y, opts.clip.w, opts.clip.h);
    ctx.restore();

    pen(ctx, W.bold, C.ink);
    bidang(tanda);
    ctx.stroke();
  }

  if (opts.axis) {
    pen(ctx, W.hair, C.ink3, DASH.axis);
    ctx.beginPath();
    ctx.moveTo(X(urut[0].x), R(0));
    ctx.lineTo(X(urut[urut.length - 1].x), R(0));
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/**
 * Panah arah aliran di dalam pipa.
 *
 * Panjangnya sebanding dengan kecepatan setempat, jadi panah ini membawa
 * data dan bukan hiasan: pada penyempitan ia memanjang dengan sendirinya.
 */
export function flowArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  panjang: number,
  color: string
) {
  const kepala = Math.min(5, Math.abs(panjang) * 0.4);
  pen(ctx, W.thin, color);
  ctx.beginPath();
  ctx.moveTo(x - panjang / 2, y);
  ctx.lineTo(x + panjang / 2, y);
  ctx.moveTo(x + panjang / 2 - kepala, y - kepala * 0.6);
  ctx.lineTo(x + panjang / 2, y);
  ctx.lineTo(x + panjang / 2 - kepala, y + kepala * 0.6);
  ctx.stroke();
}
