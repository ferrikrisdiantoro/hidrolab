/**
 * Logika murni pegangan seret di atas gambar (DragLayer).
 *
 * Dipisah dari komponen supaya bisa diuji dengan node --test tanpa DOM.
 * Semua nilai melewati rentang.ts, jadi pegangan memakai pijakan dan
 * rentang yang SAMA dengan penggeser InputRow (aturan 4: satu sumber nilai).
 */

import { keLangkah, snap, type ParamDef } from "./rentang.ts";

/** Arah seret: mendatar, tegak, atau dua sumbu sekaligus. */
export type Sumbu = "x" | "y" | "xy";

export type Pasangan = readonly [number, number];
export type NilaiSeret = number | Pasangan;

/** Hasil satu langkah seret: nilai yang berlaku dan apakah ada yang dipotong. */
export type HasilSeret<V extends NilaiSeret> = {
  value: V;
  /** Benar bila salah satu sumbu dipotong ke ujung rentangnya. */
  clamped: boolean;
};

/**
 * Nilai mentah dari toValue → nilai yang berlaku.
 * Tiap sumbu di-snap dengan ParamDef-nya sendiri, sama seperti kotak angka.
 */
export function snapSeret(raw: number, p: ParamDef): HasilSeret<number>;
export function snapSeret(raw: Pasangan, p: readonly [ParamDef, ParamDef]): HasilSeret<Pasangan>;
export function snapSeret(
  raw: NilaiSeret,
  p: ParamDef | readonly [ParamDef, ParamDef]
): HasilSeret<NilaiSeret> {
  if (typeof raw === "number") {
    const s = snap(raw, p as ParamDef);
    return { value: s.value, clamped: s.clamped !== 0 };
  }
  const [p1, p2] = p as readonly [ParamDef, ParamDef];
  const a = snap(raw[0], p1);
  const b = snap(raw[1], p2);
  return { value: [a.value, b.value], clamped: a.clamped !== 0 || b.clamped !== 0 };
}

/**
 * Tombol keyboard → nilai baru, atau null bila tombolnya bukan milik pegangan
 * (supaya Tab, Enter, dan lainnya tetap berjalan seperti biasa).
 *
 * Satu sumbu (x atau y), mengikuti pola slider ARIA:
 *   panah kanan/atas = +1 langkah, panah kiri/bawah = -1 langkah,
 *   PageUp/PageDown = ±10 langkah, Home/End = min/max,
 *   Shift + panah = ±10 langkah (sama dengan kotak angka InputRow).
 * Dua sumbu (xy):
 *   panah kiri/kanan = sumbu 1, panah atas/bawah = sumbu 2,
 *   Shift + panah = ±10 langkah pada sumbu yang sama,
 *   PageUp/PageDown = ±10 langkah sumbu 2, Home/End = min/max sumbu 1.
 *
 * Nilai selalu dikembalikan ke kelipatan langkah dari nol dan ke dalam
 * [min, max] lewat keLangkah, sama seperti tombol panah kotak angka.
 */
export function tombolKeNilai(
  key: string,
  shift: boolean,
  value: number,
  p: ParamDef
): number | null;
export function tombolKeNilai(
  key: string,
  shift: boolean,
  value: Pasangan,
  p: readonly [ParamDef, ParamDef]
): Pasangan | null;
export function tombolKeNilai(
  key: string,
  shift: boolean,
  value: NilaiSeret,
  p: ParamDef | readonly [ParamDef, ParamDef]
): NilaiSeret | null {
  const kali = shift ? 10 : 1;
  const geser = (v: number, q: ParamDef, n: number) => keLangkah(v + n * q.step, q);

  if (typeof value === "number") {
    const q = p as ParamDef;
    switch (key) {
      case "ArrowRight":
      case "ArrowUp":
        return geser(value, q, kali);
      case "ArrowLeft":
      case "ArrowDown":
        return geser(value, q, -kali);
      case "PageUp":
        return geser(value, q, 10);
      case "PageDown":
        return geser(value, q, -10);
      case "Home":
        return q.min;
      case "End":
        return q.max;
      default:
        return null;
    }
  }

  const [q1, q2] = p as readonly [ParamDef, ParamDef];
  const [a, b] = value;
  switch (key) {
    case "ArrowRight":
      return [geser(a, q1, kali), b];
    case "ArrowLeft":
      return [geser(a, q1, -kali), b];
    case "ArrowUp":
      return [a, geser(b, q2, kali)];
    case "ArrowDown":
      return [a, geser(b, q2, -kali)];
    case "PageUp":
      return [a, geser(b, q2, 10)];
    case "PageDown":
      return [a, geser(b, q2, -10)];
    case "Home":
      return [q1.min, b];
    case "End":
      return [q1.max, b];
    default:
      return null;
  }
}

type Titik = { x: number; y: number };

/**
 * Titik yang diteruskan ke toValue selama seret.
 *
 * `geser` = selisih pusat pegangan dengan titik pegang saat pointerdown,
 * supaya pegangan tidak meloncat ke ujung jari bila dipegang di tepi target
 * 44 px. Sumbu yang tidak diseret dikunci di posisi awalnya, jadi gerak
 * tangan yang miring tidak menggeser besaran lain.
 */
export function titikSeret(pointer: Titik, geser: Titik, awal: Titik, sumbu: Sumbu): Titik {
  const x = pointer.x + geser.x;
  const y = pointer.y + geser.y;
  if (sumbu === "x") return { x, y: awal.y };
  if (sumbu === "y") return { x: awal.x, y };
  return { x, y };
}

/** Apakah dua nilai pegangan sama (untuk menahan onChange yang tidak mengubah apa pun). */
export function samaNilai(a: NilaiSeret, b: NilaiSeret): boolean {
  if (typeof a === "number" || typeof b === "number") return a === b;
  return a[0] === b[0] && a[1] === b[1];
}
