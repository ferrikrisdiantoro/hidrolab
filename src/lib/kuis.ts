/**
 * Kuis lembar (Phase 3, K0): tipe soal, penilaian, dan pembantu pembangkit.
 *
 * Berkas ini murni TypeScript tanpa React, supaya bank soal dan ujinya
 * berjalan di `node --test` dengan fungsi lib yang sama dengan lembar.
 *
 * Aturan pembangkit (KUIS.md, termasuk revisi insinyur 1 November):
 *  - benih → PRNG; masukan acak dibulatkan ke langkah penggeser, lalu kunci
 *    dihitung SESUDAH pembulatan lewat fungsi lib yang dipakai lembar
 *  - pengecoh dibuang bila jatuh ke kunci (menurut `key`, atau dalam 2×
 *    toleransi, atau sama sesudah fmt ID/EN) dan bila sama dengan sesamanya
 *  - kunci "nilai penggeser" dicari dengan menelusuri kisi penggeser (kisi())
 *    lewat lib, bukan rumus tertutup yang dibulatkan
 */

import { keLangkah, type ParamDef } from "./rentang.ts";

/** Teks dua bahasa. Sama bentuknya dengan Bi di i18n.tsx (tidak diimpor supaya bebas React). */
export type Bi<T> = { id: T; en: T };
export type Bahasa = "id" | "en";

/** Masukan lembar menurut nama variabelnya, misalnya { y1: 0.3, V1: 7 }. */
export type Keadaan = Record<string, number>;

/**
 * Satu langkah pembahasan. Bentuknya bagian dari LangkahHitung (ui.tsx)
 * dengan rumus berupa teks, jadi langsung dapat diberikan ke Hitungan.
 */
export type LangkahKuis = {
  judul?: string;
  rumus: string;
  isi: string;
  hasil: string;
  satuan?: string;
  tint?: string;
};

export type Pilihan = {
  id: string;
  teks: Bi<string>;
  /** Mengapa pilihan ini salah (atau benar); tampil sesudah dipilih. */
  alasan?: Bi<string>;
};

/** Kesalahan umum soal hitung: nilai yang muncul bila langkah tertentu keliru. */
export type Kesalahan = { nilai: number; alasan: Bi<string> };

type Dasar = {
  id: string;
  tanya: Bi<string>;
  /** Pembahasan singkat, menunjuk bagian lembar yang perlu dilihat. */
  bahas: Bi<string>;
  /** Langkah hitungan dengan angka soal, untuk komponen Hitungan. */
  langkah?: Bi<LangkahKuis[]>;
  /** Masukan lembar milik soal; dipasang ke lembar sesudah dijawab. */
  masukan?: Keadaan;
};

export type SoalPilih = Dasar & { jenis: "pilih"; pilihan: Pilihan[]; kunci: string };
export type SoalTebak = Dasar & { jenis: "tebak"; pilihan: Pilihan[]; kunci: string };
export type SoalHitung = Dasar & {
  jenis: "hitung";
  kunci: number;
  /** Toleransi mutlak, dalam satuan soal. */
  toleransi: number;
  /** Angka di belakang koma saat kunci ditulis (sama dengan tabel hasil lembar). */
  digits: number;
  satuan: Bi<string>;
  kesalahan?: Kesalahan[];
};
export type SoalAtur = Dasar & {
  jenis: "atur";
  /** Besaran yang dinilai, dibaca dari keadaan lembar. */
  ukur: (keadaan: Keadaan) => number;
  target: { min: number; max: number };
  /** Penggeser yang diatur pengguna dan kisinya (untuk uji ≥ 3 langkah). */
  geser: { kunci: string; p: ParamDef };
  /** Masukan yang dipasang saat soal dibuka. */
  siapkan?: Keadaan;
  /** Masukan yang harus tetap; diubah berarti belum dijawab sesuai soal. */
  tetap?: Keadaan;
};

/*
 * Penyesuaian dari RENCANA §4.1 (alasan):
 *  - keadaan bertipe Keadaan (Record<string, number>), bukan unknown: nama
 *    kuncinya sama dengan `masukan`, `siapkan`, `tetap`, jadi lembar cukup
 *    memberikan satu objek dan uji dapat menelusuri kisinya
 *  - hitung membawa `digits` (uji toleransi > galat tampilan) dan
 *    `kesalahan` (umpan balik menyebut langkah yang keliru)
 *  - semua jenis punya `bahas` dan `langkah` opsional (pembahasan dengan Hitungan)
 */
export type Soal = SoalPilih | SoalTebak | SoalHitung | SoalAtur;

export type BankKuis = {
  /** Kode lembar, misalnya "OC-01". */
  kode: string;
  jumlah: number;
  buat: (benih: number) => Soal[];
};

export type Nilai = {
  benar: boolean;
  /** Hitung: jawaban − kunci. Atur: ukuran − batas terdekat (0 bila di dalam). */
  selisih?: number;
  /** Hitung: kesalahan umum yang cocok dengan jawaban. */
  kesalahan?: Kesalahan;
  /** Atur: nama masukan tetap yang diubah. */
  tetapDiubah?: string;
  /** Atur: nilai yang diukur. */
  ukuran?: number;
};

const EPS = 1e-9;

export function nilaiJawab(s: Soal, jawab: string | number, keadaan?: Keadaan): Nilai {
  switch (s.jenis) {
    case "pilih":
    case "tebak":
      return { benar: String(jawab) === s.kunci };
    case "hitung": {
      const v = typeof jawab === "number" ? jawab : Number(jawab);
      if (!Number.isFinite(v)) return { benar: false };
      const selisih = v - s.kunci;
      const benar = Math.abs(selisih) <= s.toleransi * (1 + EPS);
      const kesalahan = benar
        ? undefined
        : s.kesalahan?.find((k) => Math.abs(v - k.nilai) <= s.toleransi * (1 + EPS));
      return { benar, selisih, kesalahan };
    }
    case "atur": {
      const k = keadaan ?? {};
      for (const [nama, nilai] of Object.entries(s.tetap ?? {}))
        if (Math.abs((k[nama] ?? Number.NaN) - nilai) > EPS * Math.max(1, Math.abs(nilai)))
          return { benar: false, tetapDiubah: nama };
      const u = s.ukur(k);
      if (!Number.isFinite(u)) return { benar: false, ukuran: u };
      const { min, max } = s.target;
      const selisih = u < min ? u - min : u > max ? u - max : 0;
      return { benar: selisih === 0, selisih, ukuran: u };
    }
  }
}

/* ------------------------------------------------------------------ *
 * PRNG berbenih
 * ------------------------------------------------------------------ */

/** mulberry32: cepat, 32 bit, cukup untuk mengacak soal. Hasil di [0, 1). */
export function prng(benih: number): () => number {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Benih turunan dari benih induk dan kunci (nomor butir, nomor percobaan). */
export function turunan(benih: number, ...kunci: number[]): number {
  let h = (benih >>> 0) ^ 0x9e3779b9;
  for (const k of [kunci.length, ...kunci]) {
    h = Math.imul(h ^ (k >>> 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}

/** Benih baru untuk tombol "soal baru". */
export function benihAcak(): number {
  try {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return a[0] || 1;
  } catch {
    return (Math.floor(Math.random() * 4294967295) >>> 0) || 1;
  }
}

export const seragam = (r: () => number, a: number, b: number) => a + (b - a) * r();

/** Bilangan bulat di [a, b]. */
export const bulatAcak = (r: () => number, a: number, b: number) =>
  a + Math.floor(r() * (b - a + 1));

export function pilihAcak<T>(r: () => number, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)];
}

/** Fisher-Yates; mengembalikan salinan. */
export function kocok<T>(r: () => number, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Normal baku (Box-Muller). */
export function normal(r: () => number): number {
  const u = Math.max(r(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

/* ------------------------------------------------------------------ *
 * Kisi penggeser
 * ------------------------------------------------------------------ */

/** Pembulatan ke langkah penggeser, sama dengan kotak angka InputRow. */
export const bulatKeLangkah = (v: number, p: ParamDef) => keLangkah(v, p);

/** Nilai acak di kisi penggeser, di dalam [lo, hi] (bawaan: seluruh rentang). */
export function acakKisi(r: () => number, p: ParamDef, lo = p.min, hi = p.max): number {
  const a = Math.ceil(Math.max(lo, p.min) / p.step - EPS);
  const b = Math.floor(Math.min(hi, p.max) / p.step + EPS);
  return keLangkah(bulatAcak(r, a, Math.max(a, b)) * p.step, p);
}

/** Semua kelipatan langkah di [min, max], berurutan. */
export function kisi(p: ParamDef): number[] {
  const a = Math.ceil(p.min / p.step - EPS);
  const b = Math.floor(p.max / p.step + EPS);
  const out: number[] = [];
  for (let k = a; k <= b; k++) out.push(keLangkah(k * p.step, p));
  return out;
}

/* ------------------------------------------------------------------ *
 * Format angka per bahasa
 * ------------------------------------------------------------------ */

/**
 * Sama persis dengan fmt (hydraulics.ts) tetapi bahasanya diberikan, bukan
 * dibaca dari locale global: soal ditulis dua bahasa sekaligus.
 */
export function fmtL(value: number, digits: number, lang: Bahasa): string {
  if (!Number.isFinite(value)) return "—";
  const v = Math.abs(value) < 0.5 * Math.pow(10, -digits) ? 0 : value;
  // Satu Intl.NumberFormat per (bahasa, angka): toLocaleString membuat
  // pemformat baru tiap panggilan, dan uji 1000 benih memanggilnya jutaan kali.
  const kunci = `${lang}${digits}`;
  let nf = PEMFORMAT.get(kunci);
  if (!nf) {
    nf = new Intl.NumberFormat(lang === "en" ? "en-US" : "id-ID", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    PEMFORMAT.set(kunci, nf);
  }
  return nf.format(v);
}
const PEMFORMAT = new Map<string, Intl.NumberFormat>();

/** Teks dua bahasa dari satu templat: t(f, lang) menulis angka lewat f. */
export function bi(t: (f: (v: number, d: number) => string, lang: Bahasa) => string): Bi<string> {
  return {
    id: t((v, d) => fmtL(v, d, "id"), "id"),
    en: t((v, d) => fmtL(v, d, "en"), "en"),
  };
}

/* ------------------------------------------------------------------ *
 * Pengecoh
 * ------------------------------------------------------------------ */

export type Calon = { key?: string; nilai?: number };

/**
 * Membuang pengecoh yang jatuh ke kunci atau ke sesamanya. Dua calon
 * dianggap sama bila `key`-nya sama, atau bila nilainya berselisih kurang
 * dari 2× toleransi, atau bila tertulis sama sesudah fmt ID atau EN.
 * Urutan calon dipertahankan; yang pertama menang.
 */
export function buangDuplikat<T extends Calon>(
  kunci: Calon,
  calon: readonly T[],
  opsi: { toleransi?: number; digits?: number } = {}
): T[] {
  const tol = opsi.toleransi ?? 0;
  const d = opsi.digits;
  const sama = (a: Calon, b: Calon) => {
    if (a.key !== undefined && b.key !== undefined && a.key === b.key) return true;
    if (a.nilai === undefined || b.nilai === undefined) return false;
    if (Math.abs(a.nilai - b.nilai) < 2 * tol) return true;
    if (d !== undefined)
      return (["id", "en"] as const).some((l) => fmtL(a.nilai!, d, l) === fmtL(b.nilai!, d, l));
    return false;
  };
  const out: T[] = [];
  for (const c of calon) {
    if (c.nilai !== undefined && !Number.isFinite(c.nilai)) continue;
    if (sama(c, kunci) || out.some((o) => sama(c, o))) continue;
    out.push(c);
  }
  return out;
}

/**
 * Mencoba pembangkit dengan benih turunan sampai `sah` terpenuhi
 * (maks `maks` kali), lalu memakai `cadangan`.
 */
export function cobaBenih<T>(
  benih: number,
  butir: number,
  bangun: (r: () => number) => T | null,
  cadangan: () => T,
  maks = 20
): T {
  for (let i = 0; i < maks; i++) {
    const hasil = bangun(prng(turunan(benih, butir, i)));
    if (hasil !== null) return hasil;
  }
  return cadangan();
}

/* ------------------------------------------------------------------ *
 * Data sintetis berbenih (untuk bank HY-04, HY-05 nanti)
 * ------------------------------------------------------------------ */

/**
 * Titik (x, f(x)·(1 + e)) dengan derau relatif e seragam di
 * [−derauRel, +derauRel]. Seragam, bukan normal, supaya batas derau pasti.
 */
export function dataBerderau(
  r: () => number,
  xs: readonly number[],
  f: (x: number) => number,
  derauRel: number
): { x: number; y: number }[] {
  return xs.map((x) => ({ x, y: f(x) * (1 + seragam(r, -derauRel, derauRel)) }));
}

/** Lengkung debit Q = a (H − h0)^b; nol di bawah h0. */
export const lengkungPangkat = (a: number, b: number, h0: number) => (H: number) =>
  H > h0 ? a * Math.pow(H - h0, b) : 0;

/** n titik x terurut, tersebar seragam di [lo, hi] dan dibulatkan ke langkah. */
export function xAcak(r: () => number, n: number, lo: number, hi: number, step: number): number[] {
  const p: ParamDef = { min: lo, max: hi, step };
  const s = new Set<number>();
  let jaga = 0;
  while (s.size < n && jaga++ < n * 50) s.add(acakKisi(r, p));
  return [...s].sort((a, b) => a - b);
}
