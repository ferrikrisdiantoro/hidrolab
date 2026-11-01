/*
 * M6 (OC-11) Migrasi meander terhadap waktu.
 *
 * Masukan sama dengan OC-11 sekarang (PerkembanganMeanderClient →
 * meanderPath): lebar W (m), panjang gelombang SEPANJANG LINTASAN M (m),
 * sudut ayun terbesar ω (derajat). Satuan SI; waktu dalam TAHUN karena laju
 * pindah meanderPath dinyatakan dalam lebar tiap tahun.
 *
 * Model (kinematik, satu derajat kebebasan):
 * 1. Bentuk tetap kurva sinus Langbein & Leopold (1966), φ = ω sin(2π s/M),
 *    dengan ω yang tumbuh terhadap waktu.
 * 2. Panjang gelombang LEMBAH λ = M/k tetap (kelokan tumbuh melintang
 *    lembah, bukan memanjang); jadi M(ω) = λ/J0(ω) bertambah dengan ω.
 * 3. Di puncak kelokan arah alur sejajar lembah (φ = 0), jadi pindahnya
 *    tebing luar di puncak seluruhnya menambah amplitudo:
 *    dA/dt = ṁ·W, dengan ṁ (lebar/tahun) = meanderPath(W, M, ω).migrationRate
 *    pada jari-jari lengkung terkecil (puncak), yaitu laju yang SUDAH
 *    ditampilkan OC-11.
 * 4. Karena ṁ hanya bergantung pada ω, waktu dihitung sebagai integral
 *    t(ω) = ∫ A'(ω)/(W ṁ(ω)) dω (Simpson per selang 0,5°), tidak ada
 *    ketidakstabilan langkah waktu.
 * 5. Pemotongan leher: celah garis tengah di leher kelokan = W (kedua
 *    tebing bertemu). Ini definisi geometri, bukan koefisien.
 *
 * Besaran kurva sinus (identitas integral, bukan angka acuan):
 *   k = 1/J0(ω),     J0(ω) = (1/π)∫₀^π cos(ω sin ψ) dψ   (LL: k = kebalikan
 *                                                         rata-rata cos φ)
 *   A = M·S(ω)/4,    S(ω)  = (1/π)∫₀^π sin(ω sin ψ) dψ   (setengah tinggi
 *                                                         puncak-ke-puncak)
 *   celah leher = (M/π)∫₀^{ψ*} cos(ω sin ψ) dψ, ψ* = π − arcsin(π/(2ω)),
 *   hanya ada bila ω > 90° (ada bagian alur yang berbalik arah).
 * Celah itu nol pada ω = 120,9°: garis tengah mulai bersilang. LL hlm. H5
 * menyebut 125° (dibaca dari gambar dan pendekatan ω = 2,2√((k−1)/k)).
 *
 * Rujukan:
 * - Langbein, W.B. & Leopold, L.B. (1966). River meanders, theory of
 *   minimum variance. USGS PP 422-H, hlm. H5 (DIBUKA).
 * - Hickin, E.J. & Nanson, G.C. (1984). Lateral migration rates of river
 *   bends. J. Hydraul. Eng. 110(11), 1557-1567. Hanya abstrak yang terbaca:
 *   laju dirujuk ke kelengkungan acuan r/w = 2,5. Bentuk dan besar kurva
 *   ṁ(r/w) di meanderPath (puncak 0,04 lebar/tahun di r/w = 2,5) TIDAK dapat
 *   dicek terhadap makalahnya; model ini mewarisinya apa adanya.
 *
 * PENYEDERHANAAN yang harus ditulis jujur di lembar:
 * - Translasi ke hilir tidak dimodelkan (simetri kurva sinus dipertahankan).
 * - Sesudah terpotong, alur dikembalikan ke sudut awal (konvensi tampilan
 *   untuk daur berikutnya, bukan hasil fisika).
 * - meanderPath menjepit r/w ke [0,2; 30] saat menghitung ṁ.
 */
import { meanderPath } from "./hydraulics.ts";

const RAD = Math.PI / 180;
/** Selang sudut tiap bingkai, rad */
const LANGKAH_OMEGA = 0.5 * RAD;

export type MeanderFrame = {
  /** Waktu sejak awal, tahun */
  t: number;
  /** Daur ke berapa (0 = sebelum pemotongan pertama) */
  cycle: number;
  /** Lebar alur, m */
  width: number;
  /** Sudut ayun terbesar, derajat */
  omegaDeg: number;
  /** Panjang gelombang lembah λ (tetap), m */
  valleyWavelength: number;
  /** Panjang gelombang sepanjang lintasan M = kλ, m */
  pathWavelength: number;
  /** Sinusitas k = M/λ */
  sinuosity: number;
  /** Setengah tinggi puncak-ke-puncak, m */
  amplitude: number;
  /** Jari-jari lengkung terkecil (di puncak), m */
  minRadius: number;
  /** minRadius / W */
  radiusRatio: number;
  /** Laju pindah tebing di puncak, lebar/tahun (dari meanderPath) */
  migrationRate: number;
  /** Laju pindah tebing di puncak, m/tahun */
  bankRate: number;
  /** Celah garis tengah di leher, m; Infinity bila ω ≤ 90° */
  neckGap: number;
};

export type MeanderCutoff = {
  t: number;
  cycle: number;
  omegaDeg: number;
  sinuosity: number;
};

export type MeanderTimeline = {
  width: number;
  valleyWavelength: number;
  omega0Deg: number;
  /** Sudut tempat leher selebar W, derajat */
  cutoffOmegaDeg: number;
  /** Lama dari sudut awal sampai terpotong, tahun (0 bila sejak awal) */
  timeToCutoff: number;
  cutoffAtStart: boolean;
  frames: MeanderFrame[];
  cutoffs: MeanderCutoff[];
};

/* ---------- integral kurva sinus ---------- */

/** (1/π)∫₀^π cos(ω sin ψ) dψ = J0(ω); trapesium, integran periodik mulus */
function j0(w: number): number {
  const N = 256;
  let s = 0;
  for (let i = 0; i < N; i++) s += Math.cos(w * Math.sin((Math.PI * i) / N));
  return s / N;
}

/** Simpson ∫_a^b f */
function simpson(f: (x: number) => number, a: number, b: number, N = 512): number {
  if (b === a) return 0;
  const h = (b - a) / N;
  let s = f(a) + f(b);
  for (let i = 1; i < N; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}

/** (1/π)∫₀^π sin(ω sin ψ) dψ */
function struve0(w: number): number {
  return simpson((p) => Math.sin(w * Math.sin(p)), 0, Math.PI) / Math.PI;
}

/** Celah leher dibagi M; Infinity bila ω ≤ 90° */
function celahPerM(w: number): number {
  if (w <= Math.PI / 2) return Infinity;
  const psi = Math.PI - Math.asin(Math.PI / (2 * w));
  return simpson((p) => Math.cos(w * Math.sin(p)), 0, psi) / Math.PI;
}

/** Sinusitas kurva sinus, k = 1/J0(ω) (LL 1966 hlm. H5) */
export function sinuosityFromAngle(omegaDeg: number): number {
  return 1 / j0(omegaDeg * RAD);
}

function bisect(f: (x: number) => number, a: number, b: number): number {
  let fa = f(a);
  for (let k = 0; k < 200; k++) {
    const m = 0.5 * (a + b);
    const fm = f(m);
    if (fm === 0 || b - a < 1e-15) return m;
    if (Math.sign(fm) === Math.sign(fa)) {
      a = m;
      fa = fm;
    } else b = m;
  }
  return 0.5 * (a + b);
}

let _silang = NaN;
/** Sudut tempat garis tengah kurva sinus mulai bersilang (celah leher 0), derajat */
export function centrelineCrossingDeg(): number {
  if (Number.isNaN(_silang)) _silang = bisect(celahPerM, Math.PI / 2 + 1e-9, 2.4) / RAD;
  return _silang;
}

/**
 * Sudut tempat celah leher sama dengan W untuk panjang gelombang lembah λ,
 * derajat. Celah = (λ/J0(ω))·celahPerM(ω), turun dari besar (dekat 90°) ke
 * nol (120,9°).
 */
export function cutoffAngleDeg(width: number, valleyWavelength: number): number {
  const f = (w: number) => (valleyWavelength / j0(w)) * celahPerM(w) - width;
  const a = Math.PI / 2 + 1e-9;
  const b = centrelineCrossingDeg() * RAD;
  if (f(a) <= 0) return a / RAD;
  return bisect(f, a, b) / RAD;
}

/** Geometri dan laju pada sudut ω untuk λ lembah tetap */
export function meanderGeometry(
  width: number,
  valleyWavelength: number,
  omegaDeg: number
): Omit<MeanderFrame, "t" | "cycle"> {
  const w = omegaDeg * RAD;
  const J = j0(w);
  const M = valleyWavelength / J;
  /* meanderPath dengan satu daur 200 titik memakai titik sampel kelengkungan
     yang sama dengan panggilan OC-11 (dua daur 400 titik), jadi ṁ sama. */
  const mp = meanderPath(width, M, omegaDeg, 1, 200);
  const c = celahPerM(w);
  return {
    width,
    omegaDeg,
    valleyWavelength,
    pathWavelength: M,
    sinuosity: 1 / J,
    amplitude: (M * struve0(w)) / 4,
    minRadius: mp.minRadius,
    radiusRatio: mp.radiusRatio,
    migrationRate: mp.migrationRate,
    bankRate: mp.migrationRate * width,
    neckGap: Number.isFinite(c) ? M * c : Infinity,
  };
}

/** Amplitudo pada λ tetap, m */
function amplitudo(lembah: number, w: number): number {
  return (lembah * struve0(w)) / (4 * j0(w));
}

/**
 * Lini masa dari sudut awal sampai pemotongan leher (atau batas tahun).
 * opsi.years: batas waktu, tahun (bawaan tak hingga).
 * opsi.cutoffs: banyaknya daur pemotongan yang dihitung (bawaan 1).
 */
export function meanderTimeline(
  width: number,
  wavelength: number,
  maxAngleDeg: number,
  opsi: { years?: number; cutoffs?: number } = {}
): MeanderTimeline {
  const W = Math.max(width, 1e-9);
  const w0 = Math.max(0, maxAngleDeg) * RAD;
  const tahunMaks = opsi.years ?? Infinity;
  const daurMaks = Math.max(1, Math.floor(opsi.cutoffs ?? 1));
  const J0awal = j0(w0);
  const silang = centrelineCrossingDeg() * RAD;

  /* Sudut awal sudah melewati persilangan garis tengah (atau J0 ≤ 0):
     panjang gelombang lembahnya tidak terdefinisi untuk kurva yang tidak
     bersilang; dianggap terpotong sejak awal. */
  const lembah = J0awal > 0 ? wavelength * J0awal : wavelength;
  const wc = J0awal > 0 && w0 < silang ? cutoffAngleDeg(W, lembah) * RAD : 0;
  const frames: MeanderFrame[] = [];
  const cutoffs: MeanderCutoff[] = [];

  if (!(w0 < wc)) {
    frames.push({ t: 0, cycle: 0, ...meanderGeometry(W, lembah, maxAngleDeg) });
    return {
      width: W,
      valleyWavelength: lembah,
      omega0Deg: maxAngleDeg,
      cutoffOmegaDeg: wc / RAD,
      timeToCutoff: 0,
      cutoffAtStart: true,
      frames,
      cutoffs,
    };
  }

  /* dt/dω = A'(ω) / (W ṁ(ω)) */
  const h = 1e-5;
  const dtdw = (w: number) => {
    const dA = (amplitudo(lembah, w + h) - amplitudo(lembah, w - h)) / (2 * h);
    const m = meanderPath(W, lembah / j0(w), w / RAD, 1, 200).migrationRate;
    return dA / (W * m);
  };

  const nSelang = Math.max(1, Math.ceil((wc - w0) / LANGKAH_OMEGA));
  const dw = (wc - w0) / nSelang;
  /* Waktu tiap simpul satu daur (sama untuk semua daur) */
  const tSimpul = new Float64Array(nSelang + 1);
  let fKiri = dtdw(w0);
  for (let i = 0; i < nSelang; i++) {
    const a = w0 + i * dw;
    const b = i === nSelang - 1 ? wc : a + dw;
    const fKanan = dtdw(b);
    tSimpul[i + 1] = tSimpul[i] + ((b - a) / 6) * (fKiri + 4 * dtdw(0.5 * (a + b)) + fKanan);
    fKiri = fKanan;
  }
  const Tc = tSimpul[nSelang];
  const sudutSimpul = (i: number) => (i === nSelang ? wc : w0 + i * dw);

  let selesai = false;
  for (let daur = 0; daur < daurMaks && !selesai; daur++) {
    const t0 = daur * Tc;
    for (let i = 0; i <= nSelang; i++) {
      const t = t0 + tSimpul[i];
      if (t > tahunMaks) {
        /* sisip linear sudut di selang terakhir, bingkai tepat di batas tahun */
        const ta = t0 + tSimpul[i - 1];
        const r = (tahunMaks - ta) / (t - ta);
        const w = sudutSimpul(i - 1) + r * (sudutSimpul(i) - sudutSimpul(i - 1));
        frames.push({ t: tahunMaks, cycle: daur, ...meanderGeometry(W, lembah, w / RAD) });
        selesai = true;
        break;
      }
      frames.push({ t, cycle: daur, ...meanderGeometry(W, lembah, sudutSimpul(i) / RAD) });
    }
    if (!selesai) {
      const f = frames[frames.length - 1];
      cutoffs.push({ t: f.t, cycle: daur, omegaDeg: f.omegaDeg, sinuosity: f.sinuosity });
    }
  }

  return {
    width: W,
    valleyWavelength: lembah,
    omega0Deg: maxAngleDeg,
    cutoffOmegaDeg: wc / RAD,
    timeToCutoff: Tc,
    cutoffAtStart: false,
    frames,
    cutoffs,
  };
}

/**
 * Bingkai pada waktu t (tahun): sudut disisip linear antar bingkai lalu
 * geometrinya dihitung ulang. Dijepit ke bingkai pertama dan terakhir.
 */
export function meanderFrameAt(tl: MeanderTimeline, t: number): MeanderFrame {
  const F = tl.frames;
  if (t <= F[0].t) return F[0];
  if (t >= F[F.length - 1].t) return F[F.length - 1];
  let lo = 0;
  let hi = F.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (F[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = F[lo];
  const b = F[hi];
  if (b.cycle !== a.cycle || b.t === a.t) return a;
  const r = (t - a.t) / (b.t - a.t);
  const w = a.omegaDeg + r * (b.omegaDeg - a.omegaDeg);
  return { t, cycle: a.cycle, ...meanderGeometry(tl.width, tl.valleyWavelength, w) };
}

/** Titik garis tengah dari s0 ke s1 (Simpson per ruas), y dipusatkan */
function lintasan(
  M: number,
  w: number,
  A: number,
  s0: number,
  s1: number,
  n: number
): { x: number; y: number }[] {
  const arah = (s: number) => w * Math.sin((2 * Math.PI * s) / M);
  let x = 0;
  let y = 0;
  /* maju dari s = 0 ke s0 */
  const k0 = Math.max(1, Math.ceil((s0 / M) * 400));
  const d0 = s0 / k0;
  for (let i = 0; i < k0 && s0 > 0; i++) {
    const a = i * d0;
    const ta = arah(a);
    const tm = arah(a + d0 / 2);
    const tb = arah(a + d0);
    x += (d0 / 6) * (Math.cos(ta) + 4 * Math.cos(tm) + Math.cos(tb));
    y += (d0 / 6) * (Math.sin(ta) + 4 * Math.sin(tm) + Math.sin(tb));
  }
  const out: { x: number; y: number }[] = [{ x, y: y - A }];
  const ds = (s1 - s0) / n;
  for (let i = 0; i < n; i++) {
    const a = s0 + i * ds;
    const ta = arah(a);
    const tm = arah(a + ds / 2);
    const tb = arah(a + ds);
    x += (ds / 6) * (Math.cos(ta) + 4 * Math.cos(tm) + Math.cos(tb));
    y += (ds / 6) * (Math.sin(ta) + 4 * Math.sin(tm) + Math.sin(tb));
    out.push({ x, y: y - A });
  }
  return out;
}

/**
 * Garis tengah bingkai, m: mulai di lembah kelokan pada x = 0, y dipusatkan
 * (sumbu lembah y = 0), sepanjang `cycles` panjang gelombang.
 */
export function meanderFramePath(
  frame: MeanderFrame,
  cycles = 2,
  n = 400
): { x: number; y: number }[] {
  const M = frame.pathWavelength;
  return lintasan(M, frame.omegaDeg * RAD, frame.amplitude, 0, M * cycles, n);
}

/**
 * Lengkung kelokan atas pertama di antara kedua titik lehernya (yang
 * menjadi danau oxbow saat terpotong), koordinat sama dengan
 * meanderFramePath. Kosong bila ω ≤ 90° (belum ada leher).
 */
export function meanderOxbow(frame: MeanderFrame, n = 200): { x: number; y: number }[] {
  const w = frame.omegaDeg * RAD;
  if (w <= Math.PI / 2) return [];
  const M = frame.pathWavelength;
  const psi = Math.PI - Math.asin(Math.PI / (2 * w));
  const u = (psi * M) / (2 * Math.PI);
  return lintasan(M, w, frame.amplitude, M / 2 - u, M / 2 + u, n);
}
