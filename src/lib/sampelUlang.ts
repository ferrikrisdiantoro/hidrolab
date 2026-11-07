/*
 * EK-03 "ambil sampel lagi": penangkapan kedua yang diulang pada populasi
 * tertutup yang ukurannya diketahui, supaya sebaran taksiran Lincoln-Petersen
 * dan Chapman terlihat.
 *
 * Bukan model baru: taksirannya tetap markRecapture() di hydraulics.ts.
 * Berkas ini hanya menarik m secara acak berbenih.
 *
 * Sebaran m (Chapman 1951; Seber 1982 §3.1.1): menangkap n ekor tanpa
 * pengembalian dari N ekor yang M di antaranya bertanda memberi m
 * hipergeometrik, E[m] = nM/N, Var[m] = n(M/N)(1 − M/N)(N − n)/(N − 1).
 * Tarikannya dilakukan ekor demi ekor: peluang ekor ke-i bertanda sama
 * dengan sisa bertanda dibagi sisa populasi. Itu definisi langsung
 * hipergeometrik, tanpa pendekatan.
 */
import { markRecapture } from "./hydraulics.ts";

/** Pembangkit acak berbenih (mulberry32), keluaran di [0, 1). */
export function rngBerbenih(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Banyaknya bertanda di dalam n ekor yang ditangkap dari N (M bertanda). */
export function tangkapanBertanda(N: number, M: number, n: number, seed: number): number {
  const rng = rngBerbenih(seed);
  let sisaBertanda = M;
  let sisa = N;
  let m = 0;
  const ambil = Math.min(n, N);
  for (let i = 0; i < ambil; i++) {
    if (sisaBertanda <= 0) break;
    if (rng() * sisa < sisaBertanda) {
      m++;
      sisaBertanda--;
    }
    sisa--;
  }
  return m;
}

/** Rerata dan ragam teori m (hipergeometrik). */
export function momenHipergeometrik(N: number, M: number, n: number): { mean: number; variance: number } {
  const p = M / N;
  return {
    mean: n * p,
    variance: N > 1 ? (n * p * (1 - p) * (N - n)) / (N - 1) : 0,
  };
}

export type SampelUlang = {
  benih: number;
  m: number;
  chapman: number;
  /** Infinity bila m = 0 */
  petersen: number;
};

/** Satu penangkapan kedua berbenih dan kedua taksirannya. */
export function ambilSampel(N: number, M: number, n: number, seed: number): SampelUlang {
  const m = tangkapanBertanda(N, M, n, seed);
  const r = markRecapture(M, n, m);
  return { benih: seed, m, chapman: r.chapman, petersen: r.petersen };
}

export type Histogram = {
  bins: { x0: number; x1: number; count: number }[];
  /** Nilai di atas hi, termasuk tak terhingga */
  diAtas: number;
  diBawah: number;
};

/** Histogram lebar kelas sama; nilai tepat di hi masuk kelas terakhir. */
export function histogram(values: readonly number[], lo: number, hi: number, k: number): Histogram {
  const lebar = (hi - lo) / k;
  const bins = Array.from({ length: k }, (_, i) => ({
    x0: lo + i * lebar,
    x1: i === k - 1 ? hi : lo + (i + 1) * lebar,
    count: 0,
  }));
  let diAtas = 0;
  let diBawah = 0;
  for (const v of values) {
    if (!(v <= hi)) {
      if (v > hi) diAtas++;
      continue;
    }
    if (v < lo) {
      diBawah++;
      continue;
    }
    const i = Math.min(k - 1, Math.floor((v - lo) / lebar));
    bins[i].count++;
  }
  return { bins, diAtas, diBawah };
}
