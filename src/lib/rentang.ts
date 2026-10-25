/**
 * Rentang masukan: satu definisi untuk penggeser, kotak angka, dan (nanti)
 * pegangan seret di kanvas.
 *
 * Semua pijakan berupa kelipatan langkah yang dihitung dari NOL, bukan dari
 * min. Beberapa lembar punya min yang bukan kelipatan langkah (Falkner-Skan:
 * min -0,19884, langkah 0,002; DebitPenampang: min 0,01, langkah 0,05).
 * Pijakan dari min akan mengubah "0" menjadi -0,00084 dan membuat ujung atas
 * tak tercapai, jadi pijakan dari nol yang dipakai, lalu hasilnya dipotong
 * ke [min, max].
 */

export type ParamDef = { min: number; max: number; step: number; digits?: number };

export type SnapResult = {
  /** Nilai yang berlaku. */
  value: number;
  /** -1 bila dipotong ke min, 1 bila dipotong ke max, 0 bila di dalam rentang. */
  clamped: -1 | 0 | 1;
  /** Nilai di dalam rentang yang dibulatkan ke kelipatan langkah. */
  rounded: boolean;
};

/** Banyak angka di belakang koma sebuah langkah, untuk membulatkan tanpa sisa biner. */
export function desimal(x: number): number {
  if (!Number.isFinite(x)) return 0;
  const s = String(x);
  const e = s.indexOf("e-");
  if (e >= 0) return Number(s.slice(e + 2)) + desimal(Number(s.slice(0, e)));
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
}

/** Dua angka dianggap berbeda bila selisihnya melebihi galat relatif 1e-9. */
export function beda(a: number, b: number): boolean {
  return Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Kelipatan langkah ke-k, tanpa sisa biner. */
function grid(k: number, step: number): number {
  return Number((k * step).toFixed(desimal(step)));
}

/**
 * Kelipatan langkah terdekat dari v, lalu dipotong ke [min, max].
 * Dipakai untuk tombol panah di kotak angka, dan sebagai jalur dalam-rentang
 * dari snap().
 */
export function keLangkah(v: number, p: ParamDef): number {
  return Math.min(p.max, Math.max(p.min, grid(Math.round(v / p.step), p.step)));
}

/**
 * Nilai yang berlaku untuk masukan v.
 *
 * Di luar [min, max]: langsung menjadi ujung rentang (clamped ±1), tanpa
 * pembulatan. Di dalam rentang: dibulatkan ke kelipatan langkah dari nol,
 * lalu dipotong ke [min, max]; rounded bila hasilnya berbeda dari v.
 * `digits` hanya untuk tampilan dan tidak memengaruhi nilai.
 */
export function snap(v: number, p: ParamDef): SnapResult {
  if (v < p.min) return { value: p.min, clamped: -1, rounded: false };
  if (v > p.max) return { value: p.max, clamped: 1, rounded: false };
  const value = keLangkah(v, p);
  return { value, clamped: 0, rounded: beda(value, v) };
}

/**
 * Atribut min/max penggeser: dilebarkan ke kelipatan langkah terdekat di luar
 * rentang bila min/max bukan kelipatan langkah, supaya pijakan penggeser
 * peramban sama dengan pijakan dari nol. Nilai penggeser tetap dipotong ke
 * [min, max] oleh pemakainya.
 */
export function sliderBounds(p: ParamDef): { min: number; max: number } {
  const diGrid = (v: number) => !beda(grid(Math.round(v / p.step), p.step), v);
  return {
    min: diGrid(p.min) ? p.min : grid(Math.floor(p.min / p.step), p.step),
    max: diGrid(p.max) ? p.max : grid(Math.ceil(p.max / p.step), p.step),
  };
}
