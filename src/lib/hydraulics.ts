/**
 * Mesin perhitungan hidraulika.
 *
 * Seluruh rumus di berkas ini diturunkan dari persamaan baku yang tersedia bebas
 * di literatur teknik hidro (Belanger, Colebrook-White, Manning, Chezy).
 * Tidak ada koefisien yang disalin dari perangkat lunak pihak lain.
 *
 * Satuan: SI. Panjang dalam meter, debit m3/s, kecepatan m/s.
 */

export const G = 9.81;

/* ------------------------------------------------------------------ *
 * Besaran dasar
 * ------------------------------------------------------------------ */

/** Bilangan Froude untuk saluran persegi: Fr = V / sqrt(g*y) */
export function froude(V: number, y: number): number {
  if (y <= 0) return 0;
  return V / Math.sqrt(G * y);
}

/** Kedalaman kritis saluran persegi dari debit satuan q = Q/b */
export function criticalDepth(q: number): number {
  return Math.cbrt((q * q) / G);
}

/** Energi spesifik E = y + q^2 / (2*g*y^2) */
export function specificEnergy(y: number, q: number): number {
  if (y <= 0) return Number.POSITIVE_INFINITY;
  return y + (q * q) / (2 * G * y * y);
}

/* ------------------------------------------------------------------ *
 * Loncatan air (hydraulic jump)
 * ------------------------------------------------------------------ */

/**
 * Kedalaman konjugat menurut persamaan Belanger:
 *   y2/y1 = 0.5 * ( sqrt(1 + 8*Fr1^2) - 1 )
 */
export function conjugateDepth(y1: number, Fr1: number): number {
  return (y1 / 2) * (Math.sqrt(1 + 8 * Fr1 * Fr1) - 1);
}

/**
 * Kehilangan energi pada loncatan air:
 *   dE = (y2 - y1)^3 / (4 * y1 * y2)
 */
export function jumpEnergyLoss(y1: number, y2: number): number {
  if (y1 <= 0 || y2 <= 0) return 0;
  return Math.pow(y2 - y1, 3) / (4 * y1 * y2);
}

/** Panjang loncatan, pendekatan empiris umum L ≈ 6 * y2 */
export function jumpLength(y2: number): number {
  return 6 * y2;
}

export type JumpClass = {
  key: string;
  label: string;
  range: string;
  note: string;
  /** 0 = tidak ada loncatan, 1..5 = tingkat intensitas */
  level: number;
};

/** Klasifikasi loncatan air berdasarkan bilangan Froude hulu. */
export function classifyJump(Fr1: number): JumpClass {
  if (Fr1 < 1)
    return {
      key: "subkritis",
      label: "Aliran subkritis",
      range: "Fr₁ < 1",
      note: "Aliran belum superkritis, sehingga loncatan air tidak terbentuk. Naikkan kecepatan hulu atau kurangi kedalaman hulu.",
      level: 0,
    };
  if (Fr1 < 1.7)
    return {
      key: "berombak",
      label: "Loncatan berombak",
      range: "1 ≤ Fr₁ < 1,7",
      note: "Permukaan hanya bergelombang halus. Kehilangan energi masih sangat kecil, di bawah 5 persen.",
      level: 1,
    };
  if (Fr1 < 2.5)
    return {
      key: "lemah",
      label: "Loncatan lemah",
      range: "1,7 ≤ Fr₁ < 2,5",
      note: "Mulai terbentuk rangkaian gulungan kecil di permukaan. Aliran hilir masih relatif tenang dan merata.",
      level: 2,
    };
  if (Fr1 < 4.5)
    return {
      key: "berosilasi",
      label: "Loncatan berosilasi",
      range: "2,5 ≤ Fr₁ < 4,5",
      note: "Pancaran masuk berosilasi naik-turun dan menimbulkan gelombang yang menjalar jauh ke hilir. Kondisi ini paling dihindari dalam desain kolam olak.",
      level: 3,
    };
  if (Fr1 < 9)
    return {
      key: "mantap",
      label: "Loncatan mantap",
      range: "4,5 ≤ Fr₁ < 9",
      note: "Posisi loncatan stabil dan tidak berpindah-pindah. Ini rentang yang paling diinginkan untuk peredam energi.",
      level: 4,
    };
  return {
    key: "kuat",
    label: "Loncatan kuat",
    range: "Fr₁ ≥ 9",
    note: "Peredaman energi sangat besar, tetapi permukaan menjadi sangat kasar dan bergolak. Perlu perhatian khusus pada perlindungan dasar dan dinding.",
    level: 5,
  };
}

/* ------------------------------------------------------------------ *
 * Gesekan pipa: Colebrook-White dan diagram Moody
 * ------------------------------------------------------------------ */

export const RE_LAMINAR_MAX = 2000;
export const RE_TURBULENT_MIN = 4000;

/** Tebakan awal eksplisit Swamee-Jain, dipakai sebagai titik mulai iterasi. */
function swameeJain(Re: number, relRough: number): number {
  const inner = relRough / 3.7 + 5.74 / Math.pow(Re, 0.9);
  return 0.25 / Math.pow(Math.log10(inner), 2);
}

/**
 * Faktor gesekan Darcy-Weisbach dari persamaan Colebrook-White,
 * diselesaikan dengan iterasi Newton-Raphson pada peubah x = 1/sqrt(f).
 *
 *   x = -2 * log10( rr/3.7 + 2.51*x/Re )
 */
export function colebrookFriction(Re: number, relRough: number): number {
  const f0 = swameeJain(Re, relRough);
  let x = 1 / Math.sqrt(f0);

  for (let i = 0; i < 40; i++) {
    const arg = relRough / 3.7 + (2.51 * x) / Re;
    if (arg <= 0) break;
    const gx = x + 2 * Math.log10(arg);
    const dgx = 1 + (2 / Math.LN10) * (2.51 / Re) / arg;
    const step = gx / dgx;
    x -= step;
    if (Math.abs(step) < 1e-12) break;
  }
  return 1 / (x * x);
}

export type FrictionResult = {
  f: number;
  regime: "laminar" | "transisi" | "turbulen";
  regimeLabel: string;
};

/** Faktor gesekan lengkap dengan penanganan zona laminar dan transisi. */
export function frictionFactor(Re: number, relRough: number): FrictionResult {
  if (Re <= 0) return { f: 0, regime: "laminar", regimeLabel: "Laminar" };

  if (Re < RE_LAMINAR_MAX) {
    return { f: 64 / Re, regime: "laminar", regimeLabel: "Laminar" };
  }

  if (Re < RE_TURBULENT_MIN) {
    // Zona kritis: nilai sebenarnya tidak stabil dan bergantung gangguan hulu.
    // Ditampilkan sebagai interpolasi, dan ditandai jelas di antarmuka.
    const fLam = 64 / RE_LAMINAR_MAX;
    const fTurb = colebrookFriction(RE_TURBULENT_MIN, relRough);
    const t = (Re - RE_LAMINAR_MAX) / (RE_TURBULENT_MIN - RE_LAMINAR_MAX);
    return {
      f: fLam + t * (fTurb - fLam),
      regime: "transisi",
      regimeLabel: "Zona transisi",
    };
  }

  return {
    f: colebrookFriction(Re, relRough),
    regime: "turbulen",
    regimeLabel: "Turbulen",
  };
}

/** Kehilangan tinggi tekan sepanjang pipa: hf = f * (L/D) * V^2 / (2g) */
export function headLoss(f: number, L: number, D: number, V: number): number {
  return (f * L * V * V) / (D * 2 * G);
}

/** Bilangan Reynolds pipa penuh: Re = V*D/nu */
export function reynolds(V: number, D: number, nu: number): number {
  return (V * D) / nu;
}

/* ------------------------------------------------------------------ *
 * Saluran persegi: Manning dan kedalaman normal
 * ------------------------------------------------------------------ */

export type ChannelGeometry = {
  A: number;
  P: number;
  R: number;
  T: number;
};

/** Geometri basah saluran persegi lebar b pada kedalaman y. */
export function rectGeometry(b: number, y: number): ChannelGeometry {
  const A = b * y;
  const P = b + 2 * y;
  return { A, P, R: P > 0 ? A / P : 0, T: b };
}

/** Debit Manning: Q = (1/n) * A * R^(2/3) * S^(1/2) */
export function manningDischarge(
  b: number,
  y: number,
  n: number,
  S: number
): number {
  if (y <= 0 || n <= 0 || S <= 0) return 0;
  const { A, R } = rectGeometry(b, y);
  return (1 / n) * A * Math.pow(R, 2 / 3) * Math.sqrt(S);
}

/**
 * Kedalaman normal: cari y sehingga Q(y) = Q target.
 * Memakai bisection karena selalu konvergen pada fungsi monoton naik ini,
 * berbeda dengan Newton-Raphson yang bisa melompat keluar rentang fisis.
 */
export function normalDepth(
  Q: number,
  b: number,
  n: number,
  S: number,
  yMax = 50
): number {
  if (Q <= 0 || n <= 0 || S <= 0) return 0;

  let lo = 1e-6;
  let hi = yMax;
  if (manningDischarge(b, hi, n, S) < Q) return hi;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (manningDischarge(b, mid, n, S) < Q) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-9) break;
  }
  return (lo + hi) / 2;
}

export type FlowRegime = "subkritis" | "kritis" | "superkritis";

export function classifyRegime(y: number, yc: number): FlowRegime {
  const ratio = y / yc;
  if (ratio > 1.02) return "subkritis";
  if (ratio < 0.98) return "superkritis";
  return "kritis";
}

export const REGIME_LABEL: Record<FlowRegime, string> = {
  subkritis: "Subkritis",
  kritis: "Kritis",
  superkritis: "Superkritis",
};

/** Kemiringan saluran: landai bila y0 > yc, curam bila y0 < yc. */
export function slopeType(yNormal: number, yCritical: number): string {
  if (yNormal > yCritical * 1.02) return "Landai (mild)";
  if (yNormal < yCritical * 0.98) return "Curam (steep)";
  return "Kritis (critical)";
}

/* ------------------------------------------------------------------ *
 * Bantuan format angka
 * ------------------------------------------------------------------ */

export function fmt(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtSci(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  const exp = Math.floor(Math.log10(Math.abs(value)));
  const mant = value / Math.pow(10, exp);
  return `${mant.toFixed(2)} × 10${toSuperscript(exp)}`;
}

function toSuperscript(n: number): string {
  const map: Record<string, string> = {
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
    "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
    "-": "⁻",
  };
  return String(n).split("").map((c) => map[c] ?? c).join("");
}
