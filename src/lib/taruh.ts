/**
 * Logika murni klik-taruh di atas gambar (DragLayer, prop `place`).
 *
 * Dipisah dari komponen supaya bisa diuji dengan node --test tanpa DOM:
 *   - pemisah ketuk dan gulir: sentuhan yang bergeser lebih dari 6 px atau
 *     lebih lama dari 300 ms dianggap gulir/tekan lama, bukan ketuk, jadi
 *     halaman tetap bisa digulir dengan menyentuh gambar;
 *   - posisi taruh: piksel → nilai lewat toValue lalu snapSeret, jadi titik
 *     baru berpijak dan berbatas sama dengan penggeser posisinya (aturan 4).
 */

import type { ParamDef } from "./rentang.ts";
import type { PlateFrame, PlateMap } from "./plateOut.ts";
import { snapSeret, type Pasangan } from "./seret.ts";

/** Geseran terjauh (piksel CSS) yang masih dihitung ketuk. */
export const KETUK_GESER = 6;
/** Lama sentuh terpanjang (ms) yang masih dihitung ketuk; tetikus tidak dibatasi waktu. */
export const KETUK_LAMA = 300;

/** Jenis penunjuk dari PointerEvent.pointerType. */
export type JenisPenunjuk = string;

/** Keadaan saat jari/tetikus turun. */
export type AwalKetuk = { x: number; y: number; t: number; jenis: JenisPenunjuk };

/** Tetikus tidak menggulir halaman dengan menyeret, jadi tidak perlu batas waktu. */
const pakaiWaktu = (jenis: JenisPenunjuk) => jenis !== "mouse";

/**
 * Apakah gerakan sejauh ini masih bisa menjadi ketuk. Dipanggil di
 * pointermove; begitu salah, calon ketuk dibuang dan tidak bisa pulih.
 */
export function masihKetuk(a: AwalKetuk, x: number, y: number, t: number): boolean {
  if (Math.hypot(x - a.x, y - a.y) > KETUK_GESER) return false;
  if (pakaiWaktu(a.jenis) && t - a.t > KETUK_LAMA) return false;
  return true;
}

/** Apakah pointerup di (x, y) pada waktu t menutup sebuah ketuk/klik. */
export function apakahKetuk(a: AwalKetuk, x: number, y: number, t: number): boolean {
  return masihKetuk(a, x, y, t);
}

/** Titik di dalam bidang plot (tepi termasuk). */
export function dalamBingkai(p: { x: number; y: number }, f: PlateFrame): boolean {
  return p.x >= f.x0 && p.x <= f.x1 && p.y >= f.y0 && p.y <= f.y1;
}

/** Apakah jumlah titik sudah mencapai batas. */
export function penuh(count: number, max?: number): boolean {
  return max !== undefined && count >= max;
}

export type HasilTaruh =
  /** Di luar bidang plot: diabaikan, beri tanda singkat. */
  | { jenis: "luar" }
  /** Jumlah sudah mencapai max: jangan taruh, beri penanda "paling banyak N". */
  | { jenis: "penuh"; max: number }
  /** Taruh di `value`; `clamped` = salah satu sumbu dipotong ke ujung rentang. */
  | { jenis: "taruh"; value: Pasangan; clamped: boolean };

type OpsiTaruh = {
  param: readonly [ParamDef, ParamDef];
  count: number;
  max?: number;
};

/** Nilai mentah → hasil taruh (cek batas jumlah, lalu snap ke rentang penggeser). */
export function taruhNilai(raw: Pasangan, o: OpsiTaruh): HasilTaruh {
  if (penuh(o.count, o.max)) return { jenis: "penuh", max: o.max as number };
  const s = snapSeret(raw, o.param);
  return { jenis: "taruh", value: s.value, clamped: s.clamped };
}

/**
 * Klik/ketuk di piksel p (dari pojok kiri atas kanvas) → hasil taruh.
 * Di luar bingkai `map.frame` selalu "luar", sebelum batas jumlah dicek.
 */
export function taruhKlik(
  p: { x: number; y: number },
  map: PlateMap,
  o: OpsiTaruh & {
    toValue: (px: number, py: number, map: PlateMap) => Pasangan;
  }
): HasilTaruh {
  if (!dalamBingkai(p, map.frame)) return { jenis: "luar" };
  if (penuh(o.count, o.max)) return { jenis: "penuh", max: o.max as number };
  return taruhNilai(o.toValue(p.x, p.y, map), o);
}
