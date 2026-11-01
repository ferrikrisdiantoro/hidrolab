/*
 * Rantai makanan dinamis untuk EK-01: gangguan satu tingkat dan
 * tanggapannya yang merambat (kaskade trofik).
 *
 * Model: rantai Lotka–Volterra linear, produsen tumbuh logistik.
 *   dN1/dt = r N1 (1 − N1/K) − a1 N1 N2
 *   dNi/dt = e a(i−1) N(i−1) Ni − mi Ni − ai Ni N(i+1)
 *   dNn/dt = e a(n−1) N(n−1) Nn − mn Nn
 * Tiap tingkat dianggap satu populasi pemangsa (anggapan Oksanen dkk. 1981:
 * "each trophic level acts as a single exploitative population").
 *
 * Sumber dan yang benar-benar dibuka:
 * - Oksanen, Fretwell, Arruda & Niemelä (1981). Exploitation ecosystems in
 *   gradients of primary productivity. Am. Nat. 118, 240–261. Naskah asli
 *   TIDAK berhasil dibuka; ramalannya dibaca dari Aunapuu dkk. (2008) Am.
 *   Nat. 171, 249–262, hlm. 249–250 dan gb. 1: (i) produktivitas rendah,
 *   herbivora absen; (ii) rantai 2 tingkat: biomassa tumbuhan terkunci,
 *   herbivora naik lurus dengan produktivitas; (iii) rantai 3 tingkat:
 *   herbivora terkunci, tumbuhan naik. Model Oksanen 1981 memakai model
 *   eksploitasi Rosenzweig (tanggapan fungsional jenuh); di sini tanggapan
 *   linear, yang memberi pola penguncian yang sama pada keseimbangan.
 * - Carpenter, Kitchell & Hodgson (1985). Cascading trophic interactions and
 *   lake productivity. BioScience 35(10), 634–639 (dibuka, pindaian):
 *   hlm. 634 "a rise in piscivore biomass brings decreased planktivore
 *   biomass, increased herbivore biomass, and decreased phytoplankton
 *   biomass"; hlm. 636 tanggapan tidak serentak, ada tundaan karena waktu
 *   generasi berbeda, dan sesudah gangguan sistem kembali ke keadaan yang
 *   sama.
 *
 * Angka parameter tidak ada yang dari sumber: semuanya masukan pengguna.
 * `growth` (r) bawaan 1 per tahun hanya menetapkan skala waktu.
 */

import { rk4 } from "./ode.ts";

export type ParamRantai = {
  /** Daya dukung produsen K, biomassa (mis. g/m²) */
  production: number;
  /** Efisiensi peralihan e, 0 sampai 1 */
  efficiency: number;
  /** Laju makan a_i tingkat i+1 atas tingkat i, per (biomassa·tahun); panjang levels − 1 */
  grazing: number[];
  /** Laju kematian m_i per tahun; indeks 0 (produsen) diabaikan */
  mortality: number[];
  /** Laju tumbuh hakiki produsen r per tahun, bawaan 1 */
  growth?: number;
};

export type KeseimbanganRantai = {
  /** Biomassa keseimbangan tiap tingkat (0 untuk yang tidak tertopang) */
  biomass: number[];
  /** Banyaknya tingkat yang tertopang (rantai terpanjang yang layak) */
  persisting: number;
  /** Sisa |dN/dt| terbesar di keseimbangan, pemeriksa */
  residual: number;
};

function turunan(levels: number, p: ParamRantai, N: ArrayLike<number>, dN: Float64Array, Kfaktor = 1, mFaktor?: number[]) {
  const r = p.growth ?? 1;
  const K = p.production * Kfaktor;
  const e = p.efficiency;
  for (let i = 0; i < levels; i++) {
    const n = N[i];
    let d = 0;
    if (i === 0) d = K > 0 ? r * n * (1 - n / K) : -r * n * n;
    else d = e * p.grazing[i - 1] * N[i - 1] * n - p.mortality[i] * (mFaktor ? mFaktor[i] : 1) * n;
    if (i < levels - 1) d -= p.grazing[i] * n * N[i + 1];
    dN[i] = d;
  }
}

/** Selesaikan A x = b (eliminasi Gauss, pivot parsial). */
function selesaikan(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-300) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Keseimbangan rantai sepanjang L (semua tingkat 1..L hadir). */
function keseimbanganL(L: number, p: ParamRantai, Kfaktor = 1, mFaktor?: number[]): number[] | null {
  const r = p.growth ?? 1;
  const K = p.production * Kfaktor;
  if (!(K > 0)) return null;
  if (L === 1) return [K];
  const e = p.efficiency;
  const A: number[][] = Array.from({ length: L }, () => new Array<number>(L).fill(0));
  const b = new Array<number>(L).fill(0);
  // produsen: (r/K) N1 + a1 N2 = r
  A[0][0] = r / K;
  A[0][1] = p.grazing[0];
  b[0] = r;
  for (let i = 1; i < L; i++) {
    // e a(i−1) N(i−1) − a_i N(i+1) = m_i
    A[i][i - 1] = e * p.grazing[i - 1];
    if (i < L - 1) A[i][i + 1] = -p.grazing[i];
    b[i] = p.mortality[i] * (mFaktor ? mFaktor[i] : 1);
  }
  return selesaikan(A, b);
}

function keseimbanganTerpanjang(levels: number, p: ParamRantai, Kfaktor = 1, mFaktor?: number[]): { N: number[]; L: number } {
  for (let L = levels; L >= 1; L--) {
    const x = keseimbanganL(L, p, Kfaktor, mFaktor);
    if (x && x.every((v) => v > 0)) {
      return { N: [...x, ...new Array<number>(levels - L).fill(0)], L };
    }
  }
  return { N: new Array<number>(levels).fill(0), L: 0 };
}

/**
 * Keseimbangan rantai terpanjang yang layak (semua biomassa positif).
 * Ramalan Oksanen dkk. (1981) muncul langsung: tingkat n−1, n−3, …
 * ditentukan oleh pemangsa di atasnya dan tidak bergantung pada K.
 */
export function trophicEquilibrium(levels: number, p: ParamRantai): KeseimbanganRantai {
  const { N, L } = keseimbanganTerpanjang(levels, p);
  const dN = new Float64Array(levels);
  turunan(levels, p, N, dN);
  let residual = 0;
  for (let i = 0; i < levels; i++) residual = Math.max(residual, Math.abs(dN[i]));
  return { biomass: N, persisting: L, residual };
}

/** Bagian simpangan terbesar yang dianggap "sudah menanggapi" (pilihan tampilan) */
export const AMBANG_TANGGAPAN = 0.1;

export type GangguanTrofik = {
  /** Tingkat yang diganggu, 1 = produsen (sama dengan TrophicLevel.level) */
  level: number;
  /** Pengali; denyut: biomassa × factor; tekan: m (atau K untuk tingkat 1) × factor */
  factor: number;
  /** Saat gangguan, tahun */
  at: number;
  /** "denyut" (bawaan): sekali di t = at; "tekan": menetap sejak at */
  jenis?: "denyut" | "tekan";
};

export type KaskadeTrofik = {
  /** Waktu, tahun */
  t: number[];
  /** biomass[k][i] = biomassa tingkat i+1 pada t[k] */
  biomass: number[][];
  /**
   * Tundaan tanggapan tiap tingkat, tahun: dari gangguan sampai simpangannya
   * pertama kali mencapai AMBANG_TANGGAPAN (10 %) dari simpangan terbesarnya
   * sendiri. 0 untuk tingkat yang didenyut langsung. Ambang 10 % pilihan
   * tampilan, bukan angka sumber. Sesudah denyut di tingkat j, simpangan
   * tingkat j ± k mula-mula tumbuh sebanding t^k (gangguan merambat satu
   * tingkat per turunan), jadi tundaan naik dengan jarak dari tingkat yang
   * diganggu
   */
  responseLag: number[];
  /** Tahun dari gangguan sampai simpangan terbesar tiap tingkat */
  peakLag: number[];
  /** Tanda simpangan terbesar tiap tingkat terhadap keseimbangan awal: 1, −1, atau 0 */
  responseSign: number[];
  /** Benar bila tanda tingkat i berlawanan dengan tingkat i+1 (unsur terakhir selalu false) */
  signFlip: boolean[];
  /** Keseimbangan sebelum gangguan */
  equilibrium: number[];
  /** Banyaknya tingkat yang tertopang sebelum gangguan */
  persisting: number;
};

/**
 * Simulasi gangguan satu tingkat. Dimulai dari keseimbangan rantai
 * terpanjang yang layak (tingkat yang tidak tertopang = 0 dan tetap 0).
 * Langkah RK4 dipilih dari laju terbesar di keseimbangan supaya h·λ ≤ 0,02.
 */
export function trophicCascade(
  levels: number,
  p: ParamRantai,
  perturb: GangguanTrofik,
  years: number,
  opsi: { titikKeluar?: number } = {}
): KaskadeTrofik {
  const eq = trophicEquilibrium(levels, p);
  const N0 = eq.biomass;
  const lv = Math.min(Math.max(Math.round(perturb.level), 1), levels) - 1;
  const jenis = perturb.jenis ?? "denyut";
  const at = Math.min(Math.max(perturb.at, 0), years);

  // laju khas di keseimbangan untuk memilih langkah
  const r = p.growth ?? 1;
  let lam = r;
  for (let i = 0; i < levels; i++) {
    lam = Math.max(lam, p.mortality[i] ?? 0);
    if (i < levels - 1) lam = Math.max(lam, p.grazing[i] * Math.max(N0[i + 1], N0[i]));
  }
  if (jenis === "tekan") lam *= Math.max(1, perturb.factor);
  const hMaks = 0.02 / lam;

  const nKeluar = Math.max(10, Math.floor(opsi.titikKeluar ?? 600));
  const t: number[] = [];
  const biomass: number[][] = [];

  let Kf = 1;
  let mf: number[] | undefined;
  const f = (_t: number, y: Float64Array, dy: Float64Array) => turunan(levels, p, y, dy, Kf, mf);

  // Jejak halus (tiap langkah RK4) sesudah gangguan, untuk tundaan dan
  // tanda; kisi keluaran terlalu kasar untuk membedakan tundaan antartingkat.
  const tHalus: number[] = [];
  const yHalus: Float64Array[] = [];

  const jalankan = (y: Float64Array, ta: number, tb: number, nTitik: number, sertakanAwal: boolean, catatHalus: boolean) => {
    if (sertakanAwal) {
      t.push(ta);
      biomass.push(Array.from(y));
    }
    if (catatHalus) {
      tHalus.push(ta);
      yHalus.push(Float64Array.from(y));
    }
    if (tb <= ta) return y;
    let cur = y;
    for (let j = 1; j <= nTitik; j++) {
      const t0 = ta + ((tb - ta) * (j - 1)) / nTitik;
      const t1 = j === nTitik ? tb : ta + ((tb - ta) * j) / nTitik;
      const steps = Math.max(1, Math.ceil((t1 - t0) / hMaks));
      const r = rk4(f, cur, t0, t1, steps);
      // penjaga pembulatan; langkah sudah kecil sehingga praktis tidak aktif
      for (const yy of r.y) for (let i = 0; i < levels; i++) if (yy[i] < 0) yy[i] = 0;
      cur = r.y[r.y.length - 1];
      if (catatHalus) {
        for (let k = 1; k < r.y.length; k++) {
          tHalus.push(r.t[k]);
          yHalus.push(r.y[k]);
        }
      }
      t.push(t1);
      biomass.push(Array.from(cur));
    }
    return cur;
  };

  const nSebelum = years > 0 ? Math.max(1, Math.round((nKeluar * at) / years)) : 1;
  const nSesudah = Math.max(1, nKeluar - nSebelum);
  let y = jalankan(Float64Array.from(N0), 0, at, nSebelum, true, false);

  y = Float64Array.from(y);
  if (jenis === "denyut") {
    y[lv] *= Math.max(perturb.factor, 0);
    // catat lompatan pada saat yang sama sebagai titik kedua
    t.push(at);
    biomass.push(Array.from(y));
  } else if (lv === 0) {
    Kf = Math.max(perturb.factor, 0);
  } else {
    mf = new Array<number>(levels).fill(1);
    mf[lv] = Math.max(perturb.factor, 0);
  }
  jalankan(y, at, years, nSesudah, false, true);

  // tanggapan tiap tingkat: simpangan terbesar sesudah gangguan
  const responseLag = new Array<number>(levels).fill(0);
  const peakLag = new Array<number>(levels).fill(0);
  const responseSign = new Array<number>(levels).fill(0);
  for (let i = 0; i < levels; i++) {
    if (!(N0[i] > 0)) continue;
    let besar = 0;
    let kBesar = -1;
    for (let k = 0; k < tHalus.length; k++) {
      const d = yHalus[k][i] - N0[i];
      if (Math.abs(d) > besar * (1 + 1e-12) + 1e-12 * N0[i]) {
        besar = Math.abs(d);
        kBesar = k;
      }
    }
    if (kBesar >= 0) {
      peakLag[i] = tHalus[kBesar] - at;
      responseSign[i] = Math.sign(yHalus[kBesar][i] - N0[i]);
      for (let k = 0; k <= kBesar; k++) {
        if (Math.abs(yHalus[k][i] - N0[i]) >= AMBANG_TANGGAPAN * besar) {
          responseLag[i] = tHalus[k] - at;
          break;
        }
      }
    }
  }
  const signFlip = responseSign.map(
    (s, i) => i < levels - 1 && s !== 0 && responseSign[i + 1] !== 0 && s === -responseSign[i + 1]
  );

  return { t, biomass, responseLag, peakLag, responseSign, signFlip, equilibrium: N0, persisting: eq.persisting };
}
