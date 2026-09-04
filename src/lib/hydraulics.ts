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

export type Bilingual = { id: string; en: string };

export type JumpClass = {
  key: string;
  label: Bilingual;
  range: string;
  note: Bilingual;
  /** 0 = tidak ada loncatan, 1..5 = tingkat intensitas */
  level: number;
};

/** Klasifikasi loncatan air berdasarkan bilangan Froude hulu. */
export function classifyJump(Fr1: number): JumpClass {
  if (Fr1 < 1)
    return {
      key: "subkritis",
      label: { id: "Aliran subkritis", en: "Subcritical flow" },
      range: "Fr₁ < 1",
      note: { id: "Aliran belum superkritis, sehingga loncatan air tidak terbentuk. Naikkan kecepatan hulu atau kurangi kedalaman hulu.", en: "The flow is not yet supercritical, so no jump forms. Raise the upstream velocity or reduce the upstream depth." },
      level: 0,
    };
  if (Fr1 < 1.7)
    return {
      key: "berombak",
      label: { id: "Loncatan berombak", en: "Undular jump" },
      range: "1 ≤ Fr₁ < 1,7",
      note: { id: "Permukaan hanya bergelombang halus. Kehilangan energi masih sangat kecil, di bawah 5 persen.", en: "The surface only ripples gently. Energy loss is still very small, under 5 per cent." },
      level: 1,
    };
  if (Fr1 < 2.5)
    return {
      key: "lemah",
      label: { id: "Loncatan lemah", en: "Weak jump" },
      range: "1,7 ≤ Fr₁ < 2,5",
      note: { id: "Mulai terbentuk rangkaian gulungan kecil di permukaan. Aliran hilir masih relatif tenang dan merata.", en: "A train of small rollers begins to form at the surface. The downstream flow is still fairly smooth and even." },
      level: 2,
    };
  if (Fr1 < 4.5)
    return {
      key: "berosilasi",
      label: { id: "Loncatan berosilasi", en: "Oscillating jump" },
      range: "2,5 ≤ Fr₁ < 4,5",
      note: { id: "Pancaran masuk berosilasi naik-turun dan menimbulkan gelombang yang menjalar jauh ke hilir. Kondisi ini paling dihindari dalam desain kolam olak.", en: "The entering jet oscillates up and down and sends waves far downstream. This is the range most avoided in stilling basin design." },
      level: 3,
    };
  if (Fr1 < 9)
    return {
      key: "mantap",
      label: { id: "Loncatan mantap", en: "Steady jump" },
      range: "4,5 ≤ Fr₁ < 9",
      note: { id: "Posisi loncatan stabil dan tidak berpindah-pindah. Ini rentang yang paling diinginkan untuk peredam energi.", en: "The jump holds its position and does not wander. This is the most desirable range for an energy dissipator." },
      level: 4,
    };
  return {
    key: "kuat",
    label: { id: "Loncatan kuat", en: "Strong jump" },
    range: "Fr₁ ≥ 9",
    note: { id: "Peredaman energi sangat besar, tetapi permukaan menjadi sangat kasar dan bergolak. Perlu perhatian khusus pada perlindungan dasar dan dinding.", en: "Energy dissipation is very large, but the surface becomes rough and turbulent. Bed and wall protection need particular care." },
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

export const REGIME_LABEL: Record<FlowRegime, Bilingual> = {
  subkritis: { id: "Subkritis", en: "Subcritical" },
  kritis: { id: "Kritis", en: "Critical" },
  superkritis: { id: "Superkritis", en: "Supercritical" },
};

/** Kemiringan saluran: landai bila y0 > yc, curam bila y0 < yc. */
export function slopeType(yNormal: number, yCritical: number): Bilingual {
  if (yNormal > yCritical * 1.02)
    return { id: "Landai (mild)", en: "Mild slope" };
  if (yNormal < yCritical * 0.98)
    return { id: "Curam (steep)", en: "Steep slope" };
  return { id: "Kritis (critical)", en: "Critical slope" };
}

/* ------------------------------------------------------------------ *
 * Bantuan format angka
 * ------------------------------------------------------------------ */

/**
 * Pemisah desimal mengikuti bahasa yang aktif.
 *
 * Ini disimpan di tingkat modul, bukan dioper lewat setiap pemanggilan,
 * karena fmt dipakai di ratusan tempat dan menambah satu argumen di
 * semuanya hanya akan mengaburkan maksudnya. Nilainya diperbarui oleh
 * penyedia bahasa sebelum penggambaran ulang, sehingga selalu sepadan
 * dengan teks di sekitarnya.
 */
let numberLocale = "id-ID";

export function setNumberLocale(lang: "id" | "en") {
  numberLocale = lang === "en" ? "en-US" : "id-ID";
}

export function getNumberLocale(): string {
  return numberLocale;
}

export function fmt(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(numberLocale, {
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

/* ------------------------------------------------------------------ *
 * Aliran berubah lambat (GVF), saluran persegi
 * ------------------------------------------------------------------ */

/** Kemiringan gesek menurut Manning pada kedalaman y. */
export function frictionSlope(
  Q: number,
  b: number,
  y: number,
  n: number
): number {
  const { A, R } = rectGeometry(b, y);
  if (A <= 0 || R <= 0) return 0;
  const V = Q / A;
  return (n * n * V * V) / Math.pow(R, 4 / 3);
}

/**
 * Persamaan aliran berubah lambat:
 *
 *   dy/dx = (S0 − Sf) / (1 − Fr²)
 *
 * Penyebutnya menuju nol saat kedalaman mendekati kedalaman kritis,
 * sehingga kemiringan muka air menjadi tegak. Itu bukan kegagalan
 * hitungan melainkan batas keberlakuan persamaannya sendiri, dan
 * ditandai secara terpisah oleh nilai balik `nearCritical`.
 */
export function gvfSlope(
  Q: number,
  b: number,
  y: number,
  n: number,
  S0: number
): number {
  const q = Q / b;
  const Fr2 = (q * q) / (G * y * y * y);
  const denom = 1 - Fr2;
  if (Math.abs(denom) < 1e-4) return 0;
  return (S0 - frictionSlope(Q, b, y, n)) / denom;
}

export type GvfPoint = { x: number; y: number; nearCritical: boolean };

export type GvfResult = {
  points: GvfPoint[];
  /** Nama profil menurut penggolongan baku, misalnya M1 atau S2 */
  profile: string;
  /** Arah penelusuran: hulu untuk aliran subkritis, hilir untuk superkritis */
  direction: "hulu" | "hilir";
  y0: number;
  yc: number;
  mild: boolean;
};

/**
 * Menelusuri profil muka air dari satu penampang kendali.
 *
 * Arah penelusuran ditentukan fisika, bukan pilihan: aliran subkritis
 * dikendalikan dari hilir sehingga ditelusuri ke arah hulu, sedangkan
 * aliran superkritis dikendalikan dari hulu. Integrasi memakai
 * Runge-Kutta orde empat.
 */
export function gvfProfile(
  Q: number,
  b: number,
  n: number,
  S0: number,
  yControl: number,
  length: number,
  steps = 400
): GvfResult {
  const q = Q / b;
  const yc = criticalDepth(q);
  const y0 = S0 > 0 ? normalDepth(Q, b, n, S0) : Number.POSITIVE_INFINITY;
  const mild = y0 > yc;

  const subcritical = yControl > yc;
  const direction: "hulu" | "hilir" = subcritical ? "hulu" : "hilir";

  // Penamaan profil: huruf dari jenis kemiringan, angka dari zona.
  const letter = mild ? "M" : "S";
  let zone: number;
  if (mild) zone = yControl > y0 ? 1 : yControl > yc ? 2 : 3;
  else zone = yControl > yc ? 1 : yControl > y0 ? 2 : 3;
  const profile = `${letter}${zone}`;

  const dx = (subcritical ? -1 : 1) * (length / steps);
  const points: GvfPoint[] = [];
  let y = yControl;

  for (let i = 0; i <= steps; i++) {
    const xFromControl = i * (length / steps);
    const x = subcritical ? length - xFromControl : xFromControl;
    const Fr2 = (q * q) / (G * y * y * y);
    points.push({ x, y, nearCritical: Math.abs(1 - Fr2) < 0.06 });

    // Runge-Kutta orde empat pada dy/dx.
    const k1 = gvfSlope(Q, b, y, n, S0);
    const k2 = gvfSlope(Q, b, clampDepth(y + (dx * k1) / 2, yc), n, S0);
    const k3 = gvfSlope(Q, b, clampDepth(y + (dx * k2) / 2, yc), n, S0);
    const k4 = gvfSlope(Q, b, clampDepth(y + dx * k3, yc), n, S0);
    y = clampDepth(y + (dx / 6) * (k1 + 2 * k2 + 2 * k3 + k4), yc);
  }

  points.sort((a, c) => a.x - c.x);
  return { points, profile, direction, y0, yc, mild };
}

/** Menahan kedalaman agar tidak melintasi kedalaman kritis atau menjadi negatif. */
function clampDepth(y: number, yc: number): number {
  const floor = yc * 1.002;
  const ceil = yc * 0.998;
  if (y > yc && y < floor) return floor;
  if (y < yc && y > ceil) return ceil;
  return Math.max(1e-4, Math.min(y, 60));
}

/* ------------------------------------------------------------------ *
 * Ambang ukur V (thin-plate V-notch weir)
 * ------------------------------------------------------------------ */

/** Tinggi tambahan yang memperhitungkan tegangan permukaan dan kekentalan. */
export const NOTCH_KH = 0.00085;

/**
 * Koefisien debit efektif untuk ambang V berdinding tipis dengan
 * kontraksi penuh. Nilainya bergantung sudut takik, terendah di sekitar
 * 90 derajat dan naik pada sudut yang lebih lancip.
 */
export function notchCe(thetaDeg: number): number {
  const t = Math.min(120, Math.max(20, thetaDeg));
  // Pendekatan halus terhadap kurva Ce–θ pada rentang 20°–120°.
  return 0.6072 - 0.000874 * t + 0.0000061 * t * t;
}

export type NotchResult = {
  Q: number;
  Ce: number;
  he: number;
  /** Benar bila tinggi muka air di luar rentang keberlakuan rumus */
  outOfRange: boolean;
};

/**
 * Debit melalui ambang V:
 *
 *   Q = (8/15) · Ce · √(2g) · tan(θ/2) · he^(5/2)
 *
 * Rumus ini berlaku untuk kontraksi penuh dan tinggi muka air di atas
 * sekitar 5 cm. Di bawah itu tegangan permukaan mulai menguasai dan
 * hasilnya tidak dapat dipertanggungjawabkan — ditandai lewat
 * `outOfRange`, bukan disembunyikan.
 */
export function notchDischarge(H: number, thetaDeg: number): NotchResult {
  const Ce = notchCe(thetaDeg);
  const he = Math.max(0, H) + NOTCH_KH;
  const theta = (thetaDeg * Math.PI) / 180;
  const Q =
    (8 / 15) * Ce * Math.sqrt(2 * G) * Math.tan(theta / 2) * Math.pow(he, 2.5);
  return { Q, Ce, he, outOfRange: H < 0.05 };
}

/** Batas bawah tinggi muka air yang masih di dalam rentang keberlakuan. */
export const NOTCH_H_MIN = 0.05;
