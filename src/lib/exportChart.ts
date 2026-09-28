"use client";

import { xlsxBytes, type XlsxCell } from "@/lib/xlsx";

/**
 * Ekspor grafik dan data, untuk lembar yang dipindahkan dari cl42.
 *
 * Permintaan revisi klien pada cl42 (Rev1): grafik akan disalin ke laporan,
 * jadi harus dapat diunduh, disalin ke clipboard, dan datanya diekspor untuk
 * dipakai aplikasi lain.
 *
 * Grafik ekspor TIDAK diambil dari kanvas di layar. Kanvas layar ukurannya
 * mengikuti lebar jendela dan kerapatan piksel layar pengguna, jadi grafik
 * yang sama akan tersimpan dalam ukuran yang berbeda-beda. Di sini fungsi
 * gambarnya dijalankan ulang pada kanvas tersendiri berukuran tetap.
 *
 * Ukurannya ditentukan oleh HURUF, bukan piksel. Grafik laporan ditempel
 * selebar halaman, sekitar 16 cm, dan huruf penggambar ukurannya tetap
 * dalam px. Dulu digambar selebar 1100 px sehingga di Word angka sumbu
 * tinggal sekitar 4,5 pt (uji rekan V8). Selebar 640 px angka sumbu
 * sekitar 8 pt dan judul sekitar 9 pt, ukuran lazim gambar jurnal.
 * Kerapatan 3,5 kali menjaga jumlah pikselnya (2240 × 1400) tetap tajam
 * saat dicetak.
 */

export type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export const EXPORT_W = 640;
export const EXPORT_H = 400;

function render(draw: Draw, w = EXPORT_W, h = EXPORT_H, skala = 3.5): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w * skala;
  c.height = h * skala;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.setTransform(skala, 0, 0, skala, 0, 0);
    draw(ctx, w, h);
  }
  return c;
}

function blobPng(c: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((r) => c.toBlob((b) => r(b), "image/png"));
}

function unduh(blob: Blob, nama: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPng(draw: Draw, nama: string) {
  const b = await blobPng(render(draw));
  if (b) unduh(b, `${nama}.png`);
}

/** Menyalin grafik ke clipboard; false bila peramban menolaknya. */
export async function copyPng(draw: Draw): Promise<boolean> {
  try {
    const b = await blobPng(render(draw));
    if (!b || typeof ClipboardItem === "undefined") return false;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]);
    return true;
  } catch {
    return false;
  }
}

export async function copyText(teks: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(teks);
    return true;
  } catch {
    return false;
  }
}

/**
 * CSV dengan koma sebagai pemisah dan titik sebagai desimal, bentuk yang
 * dibaca aplikasi lain dan tombol unggah lembar ini. Untuk dibuka di Excel
 * pakai downloadXlsx: Excel membaca CSV dengan pemisah dan tanda desimal
 * dari pengaturan komputernya, jadi CSV bentuk apa pun terbuka salah di
 * sebagian komputer (lihat xlsx.ts). Diawali tanda urutan bita supaya huruf
 * non-ASCII pada judul kolom terbaca benar.
 */
export function downloadCsv(kepala: string[], baris: XlsxCell[][], nama: string) {
  const sel = (v: XlsxCell) => {
    const t =
      v === null
        ? ""
        : v instanceof Date
          ? v.toISOString().slice(0, 10)
          : typeof v === "number"
            ? Number.isFinite(v)
              ? String(v)
              : ""
            : v;
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const isi = [kepala, ...baris].map((r) => r.map(sel).join(",")).join("\r\n");
  unduh(new Blob(["﻿" + isi], { type: "text/csv;charset=utf-8" }), `${nama}.csv`);
}

/** Buku kerja Excel dengan isi yang sama seperti downloadCsv */
export function downloadXlsx(kepala: string[], baris: XlsxCell[][], nama: string) {
  const b = xlsxBytes([kepala, ...baris]);
  unduh(
    new Blob([b.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${nama}.xlsx`
  );
}
