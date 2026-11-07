/*
 * HY-03: titik penampang alam yang diedit di gambar.
 *
 * Satu sumber nilai: baris tabel DataEntry. Pegangan seret, klik-taruh,
 * dan Delete di gambar tidak memegang salinan titik; semuanya menulis ke
 * baris yang sama, lalu titik dibaca ulang dari baris dengan aturan yang
 * sama dengan tabel (bacaBaris, dipakai juga oleh ptsFromRows DataEntry).
 *
 * Tabel boleh berisi baris kosong, baris tidak dicentang, dan baris bukan
 * angka, jadi indeks titik tidak sama dengan indeks baris. `idx` memetakan
 * titik ke-i ke barisnya.
 */
import type { Pt } from "./discharge.ts";

export type Baris = { x: string; y: string; on?: boolean };

/** Titik terbaca dari baris, dengan indeks baris asal tiap titik. */
export function bacaBaris(rows: readonly Baris[]): { pts: Pt[]; idx: number[]; bad: number; off: number } {
  const pts: Pt[] = [];
  const idx: number[] = [];
  let bad = 0;
  let off = 0;
  rows.forEach((r, i) => {
    if (r.x.trim() === "" && r.y.trim() === "") return;
    if (r.on === false) {
      off++;
      return;
    }
    const x = parseFloat(r.x.replace(",", "."));
    const y = parseFloat(r.y.replace(",", "."));
    if (Number.isFinite(x) && Number.isFinite(y)) {
      pts.push({ x, y });
      idx.push(i);
    } else bad++;
  });
  return { pts, idx, bad, off };
}

/** Teks baris dari angka: titik desimal (sama dengan rowsFromPts), tanpa sisa biner. */
function teks(v: number): string {
  return String(Number(v.toFixed(6)));
}

/** Titik ke-i dipindah ke v; baris lain tidak disentuh. */
export function pindahTitik(rows: readonly Baris[], i: number, v: readonly [number, number]): Baris[] {
  const { idx } = bacaBaris(rows);
  const b = idx[i];
  if (b === undefined) return rows.slice();
  const baru = rows.slice();
  baru[b] = { ...baru[b], x: teks(v[0]), y: teks(v[1]) };
  return baru;
}

/**
 * Titik baru disisipkan menurut x: tepat sebelum baris titik pertama yang
 * x-nya lebih besar (x sama: sesudahnya, dinding tegak tetap berurut), atau
 * sesudah baris titik terakhir. `titik` = indeks titik baru di antara titik.
 */
export function sisipTitik(
  rows: readonly Baris[],
  v: readonly [number, number]
): { rows: Baris[]; titik: number } {
  const { pts, idx } = bacaBaris(rows);
  const k = pts.findIndex((p) => p.x > v[0]);
  const letak = k >= 0 ? idx[k] : idx.length ? idx[idx.length - 1] + 1 : rows.length;
  const baru = rows.slice();
  baru.splice(letak, 0, { x: teks(v[0]), y: teks(v[1]), on: true });
  return { rows: baru, titik: k >= 0 ? k : pts.length };
}

/**
 * Delete di gambar: titik dikeluarkan dari hitungan dengan mencabut
 * centangnya, barisnya tetap di tabel. Permintaan revisi klien cl42 (Rev1):
 * titik yang dikeluarkan harus dapat dimasukkan lagi kapan saja.
 */
export function keluarkanTitik(rows: readonly Baris[], i: number): Baris[] {
  const { idx } = bacaBaris(rows);
  const b = idx[i];
  if (b === undefined) return rows.slice();
  const baru = rows.slice();
  baru[b] = { ...baru[b], on: false };
  return baru;
}

/** Langkah seret 1, 2, atau 5 kali pangkat sepuluh, sekitar 1/400 rentang. */
export function langkahRapi(span: number): number {
  const mentah = Math.max(span, 1e-6) / 400;
  const pangkat = Math.pow(10, Math.floor(Math.log10(mentah)));
  const r = mentah / pangkat;
  const rapi = r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10;
  return Number((rapi * pangkat).toPrecision(12));
}
