/**
 * Keluaran penggambar untuk lapis di atas gambar.
 *
 * Penggambar (draw*.ts) tahu skala gambar; Client dan lapis gerak tidak.
 * Supaya pegangan seret, hit-test, dan partikel tidak perlu menebak skala,
 * penggambar boleh mengembalikan PlateOut dari fungsi gambarnya. Isinya
 * tambahan murni: mengembalikan PlateOut tidak mengubah satu piksel pun.
 *
 * Semua koordinat piksel dalam satuan CSS (sebelum dikali devicePixelRatio),
 * dihitung dari pojok kiri atas kanvas. Nilai fisik dalam satuan SI sumbu
 * yang bersangkutan (biasanya m untuk jarak, m/s untuk kecepatan).
 */

/** Bidang gambar (kotak plot) dalam piksel CSS. */
export type PlateFrame = {
  /** Tepi kiri */
  x0: number;
  /** Tepi atas */
  y0: number;
  /** Tepi kanan */
  x1: number;
  /** Tepi bawah */
  y1: number;
};

/** Konversi dua arah antara nilai fisik dan piksel. */
export type PlateMap = {
  /** Nilai fisik sumbu mendatar ke piksel x */
  X: (v: number) => number;
  /** Nilai fisik sumbu tegak ke piksel y */
  Y: (v: number) => number;
  /** Piksel x ke nilai fisik sumbu mendatar */
  invX: (px: number) => number;
  /** Piksel y ke nilai fisik sumbu tegak */
  invY: (px: number) => number;
  frame: PlateFrame;
};

/** Titik bernama dalam piksel, misalnya puncak ambang atau ujung loncatan. */
export type PlateAnchor = { x: number; y: number };

/** Kotak label yang sudah ditempatkan, untuk dihindari pegangan seret. */
export type PlateRect = { x: number; y: number; w: number; h: number };

export type PlateOut = {
  map: PlateMap;
  anchors?: Record<string, PlateAnchor>;
  /**
   * Poligon badan air dalam piksel, berurutan x0,y0,x1,y1,...
   * Dipakai lapis gerak untuk memotong goresan ke dalam air.
   */
  water?: ArrayLike<number>;
  labels?: PlateRect[];
};

/**
 * PlateMap linier dari kotak plot dan rentang nilai kedua sumbu.
 * Sumbu tegak dibalik (nilai besar di atas), seperti semua lembar.
 */
export function linearMap(
  frame: PlateFrame,
  xDomain: readonly [number, number],
  yDomain: readonly [number, number]
): PlateMap {
  const [a0, a1] = xDomain;
  const [b0, b1] = yDomain;
  const sx = (frame.x1 - frame.x0) / (a1 - a0 || 1);
  const sy = (frame.y1 - frame.y0) / (b1 - b0 || 1);
  return {
    X: (v) => frame.x0 + (v - a0) * sx,
    Y: (v) => frame.y1 - (v - b0) * sy,
    invX: (px) => a0 + (px - frame.x0) / sx,
    invY: (px) => b0 + (frame.y1 - px) / sy,
    frame,
  };
}

/** Apakah titik piksel berada di dalam bidang gambar. */
export function inFrame(f: PlateFrame, x: number, y: number): boolean {
  return x >= f.x0 && x <= f.x1 && y >= f.y0 && y <= f.y1;
}
