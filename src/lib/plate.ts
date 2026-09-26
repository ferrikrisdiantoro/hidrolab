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
  //
  // Bila dimensinya lebih pendek daripada teksnya, teks ditaruh di luar
  // dimensi, di atas tanda atasnya, seperti lazimnya gambar teknik. Kalau
  // tetap dipusatkan, teks akan menjulur melewati kedua ujung dan menabrak
  // apa pun yang ada di bawahnya, misalnya sumbu.
  ctx.save();
  ctx.font = F.label;
  const lebar = stencilWidth(ctx, label);
  const muat = Math.abs(yBottom - yTop) >= lebar + 6;
  ctx.translate(x - 5, muat ? (yTop + yBottom) / 2 : Math.min(yTop, yBottom) - 4);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = color;
  ctx.textAlign = muat ? "center" : "left";
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
  objY?: number,
  /** Batas kiri dan kanan tempat tulisannya boleh berada, piksel */
  rentang?: [number, number]
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
  /*
   * Tulisan dimensi yang lebih lebar daripada dimensinya sendiri dan duduk
   * dekat tepi gambar digeser masuk, tidak dibiarkan terpotong. Contohnya
   * panjang masuk PI-04 sepanjang sebelas sentimeter di pangkal pipa, yang
   * tertulis "NJANG MASUK". Tanpa rentang, batasnya lebar kanvas.
   */
  const separuh = stencilWidth(ctx, label) / 2;
  const skala = ctx.getTransform().a || 1;
  const [kiri, kanan] = rentang ?? [0, ctx.canvas.width / skala];
  const tx = Math.min(
    Math.max((xLeft + xRight) / 2, kiri + separuh + 6),
    Math.max(kiri + separuh + 6, kanan - separuh - 6)
  );
  stencil(ctx, label, tx, y - 5);
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
  rotate = 0,
  /**
   * Perataan tulisannya terhadap titik yang diberikan.
   *
   * Dulu tetap rata tengah, sedangkan mesin penempat label menghitung kotak
   * terpakainya menurut perataan yang diminta. Selisih keduanya setengah
   * lebar tulisan, dan akibatnya tulisan rata kiri tergambar setengah lebar
   * ke kiri dari kotak yang sudah disediakan untuknya. Pada lembar aturan
   * panen, nama garis hasil lestari terbesar karena itu terpotong di tepi
   * kiri bidang dan terbaca "IMUM SUSTAINABLE YIELD".
   */
  align: CanvasTextAlign = "center"
) {
  ctx.save();
  ctx.translate(x, y);
  if (rotate) ctx.rotate(rotate);
  ctx.fillStyle = color;
  ctx.font = F.region;
  ctx.textAlign = align;
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

/**
 * Arsiran tanah berbutir: titik-titik yang letaknya ditentukan, bukan acak.
 *
 * Konvensi gambar teknik geoteknik memakai titik untuk pasir dan kerikil.
 * Letaknya diayak dari satu deret bilangan tetap dan bukan dari Math.random,
 * karena arsiran yang berubah tiap kali digambar ulang membuat mata mengira
 * ada yang berubah pada keadaannya padahal tidak ada.
 */
export function hatchSoil(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  spacing = 9
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.fillStyle = C.concrete;
  ctx.globalAlpha = 0.34;
  let n = 0;
  for (let yy = y; yy <= y + h; yy += spacing) {
    for (let xx = x; xx <= x + w; xx += spacing) {
      /* Geseran berselang-seling supaya titiknya tidak membentuk kisi
         tegak lurus yang terbaca sebagai garis. */
      const gx = ((n * 7) % 5) - 2;
      const gy = ((n * 3) % 5) - 2;
      ctx.beginPath();
      ctx.arc(Math.round(xx + gx) + 0.5, Math.round(yy + gy) + 0.5, 0.9, 0, Math.PI * 2);
      ctx.fill();
      n++;
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Arsiran urugan batu: bulatan bergaris tengah tetap, bukan titik.
 *
 * Bedanya dengan arsiran tanah bukan hiasan. Pada lembar urugan batu yang
 * dipersoalkan justru UKURAN butirannya, jadi butirannya digambar sebagai
 * benda yang punya ukuran.
 */
export function hatchRock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  spacing = 12
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  pen(ctx, W.hair, C.concrete);
  ctx.globalAlpha = 0.45;
  let n = 0;
  for (let yy = y; yy <= y + h; yy += spacing) {
    for (let xx = x; xx <= x + w; xx += spacing) {
      const gx = ((n * 5) % 7) - 3;
      const gy = ((n * 11) % 7) - 3;
      const r = 2.2 + ((n * 13) % 3) * 0.7;
      ctx.beginPath();
      ctx.arc(xx + gx, yy + gy, r, 0, Math.PI * 2);
      ctx.stroke();
      n++;
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Lapisan kedap di bawah akuifer: garis tebal beserta arsiran rapat di
 * bawahnya, tanda baku untuk batas yang tidak dapat ditembus air.
 */
export function imperviousBase(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  y: number,
  depth = 7
) {
  ctx.save();
  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  ctx.moveTo(x0, Math.round(y) + 0.5);
  ctx.lineTo(x1, Math.round(y) + 0.5);
  ctx.stroke();

  pen(ctx, W.hair, C.ink2);
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 7) {
    ctx.moveTo(x, y + 1);
    ctx.lineTo(x - depth, y + depth);
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


/**
 * Menahan absis sebuah label agar seluruh teksnya tetap di dalam bidang gambar.
 *
 * Nama wilayah dan nama penampang diletakkan dengan titik tengah pada absis
 * bendanya. Bila bendanya berada tepat di tepi bidang, separuh tulisannya
 * jatuh di luar bingkai dan terpotong. Yang digeser cukup labelnya; garis
 * penunjuknya tetap berdiri di tempat bendanya berada.
 */
export function clampLabelX(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  x0: number,
  x1: number,
  spacing = 1.4
): number {
  ctx.font = F.region;
  const separuh = stencilWidth(ctx, text, spacing) / 2 + 5;
  if (x1 - x0 < separuh * 2) return (x0 + x1) / 2;
  return Math.min(Math.max(x, x0 + separuh), x1 - separuh);
}

/* ------------------------------------------------------------------ *
 * Penempat tulisan bersama
 * ------------------------------------------------------------------ */

export type Placed = {
  x: number;
  y: number;
  x0: number;
  x1: number;
  atas: number;
  bawah: number;
};

/**
 * Membuat penempat tulisan untuk satu bidang gambar.
 *
 * Ini bagian yang paling mahal dipelajari pada pekan pertama, dan karena itu
 * ia ditarik ke sini alih-alih disalin ke tiap penggambar keluarga. Tiga
 * cacat yang pernah dibayar sekali dan tidak perlu dibayar lagi:
 *
 * 1. Satu daftar kotak terpakai untuk SELURUH tulisan di dalam bidang. Label
 *    kurva, nama penampang, nama wilayah, dan tulisan titik kerja berebut
 *    ruang yang sama; menahan tumpukan pada salah satunya saja memindahkan
 *    cacatnya, bukan menghilangkannya.
 * 2. Daftarnya menyimpan batas atas dan batas bawah, bukan satu ordinat.
 *    Huruf lima belas piksel bergaris dasar bawah tidak dapat dibandingkan
 *    dengan huruf sepuluh piksel bergaris dasar tengah memakai satu jarak
 *    tetap; yang besar akan tetap menindih dari atas walau sudah digeser.
 * 3. Tiap tulisan diberi alas kertas lewat `alas`, karena garis energi dan
 *    muka air lewat di baris yang sama dan mencoret hurufnya. Kebiasaan
 *    gambar teknik: tulisan memotong garis, bukan sebaliknya.
 */
export function createLabelPlacer(
  ctx: CanvasRenderingContext2D,
  frame: { padL: number; padT: number; plotW: number; plotH: number }
) {
  const { padL, padT, plotW, plotH } = frame;
  const dipakai: { x0: number; x1: number; atas: number; bawah: number }[] = [];

  const place = (
    teks: string,
    x: number,
    y: number,
    spacing: number,
    align: CanvasTextAlign = "center",
    font?: string
  ): Placed => {
    ctx.font = font ?? (spacing > 1 ? F.region : F.labelSm);
    const lebar = stencilWidth(ctx, teks, spacing) + 8;
    const kiri = align === "left" ? 0 : align === "right" ? lebar : lebar / 2;
    /*
     * Disisipkan tiga piksel ke dalam bidangnya, bukan ditempelkan tepat di
     * garis bingkainya. Tulisan yang dijepit tepat di padL berimpit dengan
     * garis bingkai setebal dua piksel, dan huruf sempit seperti I atau l
     * hilang seluruhnya tertutup garis itu.
     */
    const sisip = 3;
    const xx = Math.min(
      Math.max(x, padL + kiri + sisip),
      padL + plotW - (lebar - kiri) - sisip
    );
    const x0 = xx - kiri;
    const x1 = x0 + lebar;

    /*
     * Titik tumpu HURUFNYA, yang tidak sama dengan titik tumpu kotaknya.
     *
     * Lebar kotaknya sudah dilebihkan delapan piksel sebagai ruang napas,
     * dan pada tulisan rata tengah kelebihan itu terbagi rata ke kiri dan
     * ke kanan dengan sendirinya. Pada tulisan rata kiri tidak: hurufnya
     * duduk tepat di tepi kotaknya sementara seluruh kelebihan itu jatuh di
     * sebelah kanan. Akibatnya huruf pertama berada di luar alas putihnya
     * sendiri, dan huruf sempit seperti I hilang tertelan apa pun yang ada
     * di belakangnya, biasanya garis bingkai bidangnya.
     */
    const napas = 4;
    const tx =
      align === "left" ? xx + napas : align === "right" ? xx - napas : xx;

    const besar = (font ?? "").includes("15px");
    const naik = besar ? 17 : 7;
    const turun = besar ? 3 : 7;

    let yy = Math.min(Math.max(y, padT + naik + 2), padT + plotH - turun - 2);
    let putar = 0;
    while (
      putar < 10 &&
      dipakai.some(
        (d) => x0 < d.x1 && x1 > d.x0 && yy - naik < d.bawah && yy + turun > d.atas
      )
    ) {
      yy += 12;
      putar++;
    }
    dipakai.push({ x0, x1, atas: yy - naik, bawah: yy + turun });
    return { x: tx, y: yy, x0, x1, atas: yy - naik, bawah: yy + turun };
  };

  const alas = (pos: Placed) => {
    ctx.fillStyle = C.sheet;
    ctx.fillRect(pos.x0 + 3, pos.atas, pos.x1 - pos.x0 - 6, pos.bawah - pos.atas);
  };

  /** Menaruh tulisan sekaligus alasnya, lalu menggambarnya sebagai wilayah. */
  const write = (
    teks: string,
    x: number,
    y: number,
    color: string,
    opts: { spacing?: number; align?: CanvasTextAlign; big?: boolean } = {}
  ) => {
    const pos = opts.big
      ? place(teks, x, y, 2, opts.align ?? "center", F.heading)
      : place(teks, x, y, opts.spacing ?? 1.4, opts.align ?? "center");
    alas(pos);
    const rata = opts.align ?? "center";
    if (opts.big) {
      ctx.fillStyle = color;
      ctx.font = F.heading;
      ctx.textAlign = rata;
      ctx.textBaseline = "bottom";
      stencil(ctx, teks, pos.x, pos.y, 2);
    } else {
      region(ctx, teks, pos.x, pos.y, color, 0, rata);
    }
    return pos;
  };

  return { place, alas, write };
}
