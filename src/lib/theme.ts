/**
 * Sistem visual: lembar gambar teknik.
 *
 * Tiga aturan yang mengikat seluruh berkas gambar:
 *
 *  1. KETEBALAN GARIS ADALAH HIERARKI, dan artinya terkunci.
 *     Kalau garis menggambarkan benda fisik  -> BOLD.
 *     Kalau garis membicarakan benda itu     -> THIN.
 *     Kalau garis hanya membantu mata        -> HAIR.
 *     Tidak ada ketebalan di luar tiga ini.
 *
 *  2. WARNA ADALAH KOSAKATA, BUKAN TEMA.
 *     Biru selalu air. Merah bata selalu energi. Ungu selalu kondisi kritis.
 *     Merah sinyal hanya berarti satu hal: di luar rentang validitas.
 *     Tidak ada warna dipakai sebagai hiasan, dan tidak ada warna di krom.
 *
 *  3. SETIAP TANDA MEMBAWA DATA. Kalau sebuah garis tidak menjelaskan
 *     apa pun, ia dihapus.
 */

export const C = {
  /* Kertas — kelabu dingin, bukan krem. Putih murni tidak pernah ada
     di lembar cetak dan membuat garis tipis menyilaukan. */
  paper: "#eceeec",
  paperSunk: "#e2e6e3",
  sheet: "#f7f8f7",
  sheetEdge: "#d5dad7",

  /* Tinta */
  ink: "#16191b",
  ink2: "#535d5b",
  ink3: "#8b9491",

  /* Garis bantu */
  rule: "#c8cecb",
  ruleFaint: "#dde1de",
  ruleStrong: "#aab2af",

  /* Kosakata terkunci */
  water: "#1f5f82",
  waterFill: "rgba(31, 95, 130, 0.10)",
  waterFillDeep: "rgba(31, 95, 130, 0.17)",
  energy: "#a6402b",
  critical: "#6e5595",
  signal: "#c0341f",

  /* Material */
  concrete: "#3d4644",
  concreteFace: "#c3c9c6",
} as const;

/** Tiga bobot garis. Tidak boleh ada nilai lain di seluruh aplikasi. */
export const W = {
  hair: 0.5,
  thin: 1,
  bold: 2,
} as const;

/**
 * Jenis garis, masing-masing dengan arti tetap.
 * Dipakai sebagai argumen setLineDash.
 */
export const DASH = {
  /** Terlihat, nyata */
  solid: [] as number[],
  /** Tersembunyi di balik sesuatu */
  hidden: [6, 4],
  /** Sumbu, datum, simetri */
  axis: [12, 3, 2, 3],
  /** Posisi alternatif — dipakai untuk kondisi sebelum perubahan */
  phantom: [16, 3, 2, 3, 2, 3],
  /** Di luar rentang validitas rumus */
  invalid: [1, 3],
} as const;

/* Huruf pada gambar mengikuti tradisi lettering drafting:
   sans, kapital, satu ketebalan, diberi jarak huruf. */
export const F = {
  label: '600 10px "Public Sans", system-ui, sans-serif',
  labelSm: '600 9px "Public Sans", system-ui, sans-serif',
  value: '500 11px "Public Sans", system-ui, sans-serif',
  region: '600 10px "Public Sans", system-ui, sans-serif',
  /** Nama besar di dalam gambar, misalnya nama profil muka air */
  heading: '700 15px "Public Sans", system-ui, sans-serif',
} as const;

/** Menulis teks kapital dengan jarak huruf, seperti stensil lettering. */
export function stencil(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing = 0.8
) {
  const chars = text.toUpperCase().split("");
  let cx = x;
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);

  if (ctx.textAlign === "center") cx = x - total / 2;
  else if (ctx.textAlign === "right") cx = x - total;

  const align = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + spacing;
  });
  ctx.textAlign = align;
  return total;
}

/** Mengukur lebar teks bergaya stensil tanpa menggambarnya. */
export function stencilWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  spacing = 0.8
) {
  const chars = text.toUpperCase().split("");
  return (
    chars.reduce((a, c) => a + ctx.measureText(c).width, 0) +
    spacing * (chars.length - 1)
  );
}
