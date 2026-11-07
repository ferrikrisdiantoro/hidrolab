/**
 * Data soal untuk lembar yang masukannya tabel (HY-04, HY-05) atau deret
 * (HY-06), bukan penggeser.
 *
 * Keadaan kuis (Keadaan di kuis.ts) hanya berisi angka, jadi tabel tidak
 * dapat dibawa di `masukan`. Datanya ditempelkan pada objek soal sebagai
 * medan tambahan `data` (pasangan x, y) atau `deret` (hujan harian), dan
 * lembar membacanya dari soal aktif (onAktif) saat pengguna menekan
 * "Muat data soal" atau menjawab. Tidak ada yang dimuat saat lembar dibuka.
 *
 * Soal atur yang bergantung pada data membawa sidik datanya di `siapkan`
 * (kunci "data"); lembar mengirim sidik tabelnya sendiri di keadaan, dan
 * ukurannya NaN selama tabel belum berisi data soal itu.
 */

import type { Soal } from "../../lib/kuis.ts";

export type Titik = { x: number; y: number };

type Berdata = { data?: Titik[]; deret?: number[] };

/** Menempelkan data ke soal tanpa mengubah tipe Soal di kuis.ts. */
export function denganData<S extends Soal>(s: S, data: Titik[]): S {
  return Object.assign(s, { data });
}

export function denganDeret<S extends Soal>(s: S, deret: number[]): S {
  return Object.assign(s, { deret });
}

/** Data tabel milik soal, atau null bila soal tidak membawa data. */
export function dataSoal(s: Soal | null | undefined): Titik[] | null {
  const d = (s as (Soal & Berdata) | null | undefined)?.data;
  return Array.isArray(d) ? d : null;
}

/** Deret hujan harian milik soal, atau null. */
export function deretSoal(s: Soal | null | undefined): number[] | null {
  const d = (s as (Soal & Berdata) | null | undefined)?.deret;
  return Array.isArray(d) ? d : null;
}

/**
 * Sidik data: FNV-1a 32 bit atas nilai yang dibulatkan ke 1e-6, urut
 * menurut x. Dua tabel berisi pasangan yang sama memberi sidik yang sama
 * meski urutan barisnya berbeda.
 */
export function sidikData(pts: readonly Titik[]): number {
  const teks = pts
    .map((p) => `${Math.round(p.x * 1e6)}:${Math.round(p.y * 1e6)}`)
    .sort()
    .join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < teks.length; i++) {
    h ^= teks.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Ukuran soal atur hanya berlaku pada data soal itu sendiri. */
export const dataCocok = (k: Record<string, number>, sidik: number) =>
  k.data === undefined || k.data === sidik;

/** Bulat ke n angka di belakang koma, tanpa sisa biner. */
export const bulat = (v: number, n: number) => Number(v.toFixed(n));
