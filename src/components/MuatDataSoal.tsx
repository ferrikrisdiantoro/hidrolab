"use client";

import { useRef } from "react";
import { useLang } from "@/lib/i18n";

/*
 * Data soal kuis untuk lembar bertabel (HY-04, HY-05, HY-06).
 *
 * Soalnya membawa tabel sendiri (src/data/kuis/dataSoal.ts). Tabel itu masuk
 * ke lembar HANYA lewat aksi pengguna: tombol "Muat data soal" di sini, atau
 * menjawab soal (Kuis memanggil onTerapkan). Saat lembar dibuka tidak ada
 * yang dimuat, jadi data contoh tetap tampil.
 *
 * Data yang diketik atau diunggah pengguna tidak ditimpa diam-diam: bila
 * tabel berisi data yang bukan data contoh dan bukan data soal yang dimuat
 * sebelumnya, lembar bertanya dulu. Reset lembar tetap memakai penjaga
 * useResetGuard di tabel datanya, tanpa perubahan.
 */

const TXT = {
  id: {
    muat: "Muat data soal",
    judul: "Isi tabel data lembar dengan data soal yang sedang tampil",
    cocok: (n: number, s: string) => `Tabel berisi data soal ini (${n} ${s}).`,
    belum: (n: number, s: string) => `Tabel belum berisi data soal ini (${n} ${s}).`,
    tanya:
      "Tabel data lembar berisi data yang diketik atau diunggah sendiri. Memuat data soal akan menggantinya. Lanjutkan?",
  },
  en: {
    muat: "Load question data",
    judul: "Fill the sheet's data table with the data of the question shown",
    cocok: (n: number, s: string) => `The table holds this question's data (${n} ${s}).`,
    belum: (n: number, s: string) => `The table does not hold this question's data yet (${n} ${s}).`,
    tanya:
      "The sheet's data table holds data you typed or uploaded. Loading the question data will replace it. Continue?",
  },
} as const;

/**
 * Pemuat tabel bersama: mengganti isi tabel lewat setter tabel yang sama
 * dengan tabel isian, dan bertanya dulu bila isinya data milik pengguna.
 * Mengembalikan false bila pengguna menolak.
 */
export function useMuatTabel<R>(rows: R[], setRows: (r: R[]) => void, contoh: R[]) {
  const { lang } = useLang();
  const terakhir = useRef<string | null>(null);
  return (baru: R[]): boolean => {
    const kini = JSON.stringify(rows);
    const isi = JSON.stringify(baru);
    if (isi === kini) return true;
    const milikPengguna = kini !== JSON.stringify(contoh) && kini !== terakhir.current;
    if (milikPengguna && !window.confirm(TXT[lang].tanya)) return false;
    terakhir.current = isi;
    setRows(baru);
    return true;
  };
}

/** Baris tombol di bawah kuis; tidak tampil bila soal aktif tidak membawa data. */
export function MuatDataSoal({
  n,
  cocok,
  satuan,
  onMuat,
}: {
  /** Banyak baris data soal aktif; 0 = soal tanpa data (baris tidak tampil). */
  n: number;
  /** Tabel lembar sudah berisi data soal itu. */
  cocok: boolean;
  /** Nama baris data dua bahasa, misalnya pasangan / pairs. */
  satuan: { id: string; en: string };
  onMuat: () => void;
}) {
  const { lang } = useLang();
  const x = TXT[lang];
  if (n <= 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1" data-muat-soal>
      <button
        type="button"
        onClick={onMuat}
        title={x.judul}
        className="label border-b-2 border-ink pb-px text-[0.84rem] font-semibold text-ink disabled:opacity-40"
        disabled={cocok}
      >
        {x.muat}
      </button>
      <span role="status" aria-live="polite" className="label text-[0.78rem] text-ink-3">
        {cocok ? x.cocok(n, satuan[lang]) : x.belum(n, satuan[lang])}
      </span>
    </div>
  );
}
