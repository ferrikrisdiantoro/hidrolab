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

/**
 * Apakah kedalaman normal benar-benar ada pada kondisi ini.
 *
 * Saluran sempit dengan kemiringan sangat kecil punya batas atas debit yang
 * dapat dialirkannya. Di luar batas itu tidak ada kedalaman yang memenuhi
 * persamaan Manning, dan `normalDepth` akan mentok di batas pencariannya lalu
 * mengembalikan angka yang keliru. Pemanggil wajib memeriksa ini sebelum
 * menampilkan hasilnya, sesuai aturan bahwa batas keberlakuan dinyatakan,
 * bukan disembunyikan.
 */
export function normalDepthReachable(
  Q: number,
  b: number,
  n: number,
  S: number,
  yMax = 50
): boolean {
  if (Q <= 0 || n <= 0 || S <= 0) return false;
  return manningDischarge(b, yMax, n, S) >= Q;
}

/**
 * Jarak antara dua kedalaman menurut METODE LANGKAH LANGSUNG.
 *
 *   dx = ( E2 - E1 ) / ( S0 - Sf rata-rata )
 *
 * Ini metode baku yang berbeda perumusannya dari penelusuran Runge-Kutta:
 * ia melangkah pada kedalaman lalu menghitung jaraknya, sedangkan
 * Runge-Kutta melangkah pada jarak lalu menghitung kedalamannya. Karena itu
 * keduanya dapat dipakai untuk saling memeriksa.
 */
export function gvfDistanceDirectStep(
  Q: number,
  b: number,
  n: number,
  S0: number,
  yFrom: number,
  yTo: number,
  steps = 400
): number {
  const q = Q / b;
  const E = (y: number) => y + (q * q) / (2 * G * y * y);
  const dy = (yTo - yFrom) / steps;
  let x = 0;

  for (let i = 0; i < steps; i++) {
    const ya = yFrom + i * dy;
    const yb = ya + dy;
    const sfAvg = (frictionSlope(Q, b, ya, n) + frictionSlope(Q, b, yb, n)) / 2;
    const denom = S0 - sfAvg;
    if (Math.abs(denom) < 1e-12) return Number.POSITIVE_INFINITY;
    x += (E(yb) - E(ya)) / denom;
  }
  return x;
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
 * Jangkauan pengaruh bangunan di hilir
 * ------------------------------------------------------------------ */

export type BackwaterExtent = {
  /** Jarak sampai pengaruhnya tinggal sekian bagian, meter */
  distance: number;
  /** Kenaikan muka air di penampang kendali terhadap kedalaman normal */
  rise: number;
  y0: number;
  /** Benar bila pengaruhnya belum habis pada bentang terpanjang yang dicari */
  beyondSearch: boolean;
};

/**
 * Sejauh mana ke hulu sebuah bangunan masih terasa.
 *
 * Profil pembendungan mendekati kedalaman normal secara asimtotik, jadi
 * pertanyaan "sampai di mana pengaruhnya berhenti" tidak punya jawaban tegas.
 * Yang dapat dijawab adalah sampai di mana pengaruhnya tinggal sekian persen,
 * dan angka itulah yang dipakai dalam praktik untuk menentukan batas kajian
 * genangan. Nilai lazimnya satu persen.
 */
export function backwaterExtent(
  Q: number,
  b: number,
  n: number,
  S0: number,
  yControl: number,
  fraction = 0.01,
  maxLength = 500000
): BackwaterExtent {
  const y0 = normalDepth(Q, b, n, S0);
  const rise = yControl - y0;
  if (Math.abs(rise) < 1e-9) {
    return { distance: 0, rise: 0, y0, beyondSearch: false };
  }

  const target = y0 + rise * fraction;
  const langkah = 2000;
  const r = gvfProfile(Q, b, n, S0, yControl, maxLength, langkah);

  // Penampang kendali ada di hilir untuk aliran subkritis, jadi dibaca mundur.
  const dariHilir = r.direction === "hulu";
  const urut = dariHilir ? [...r.points].reverse() : r.points;
  const kendaliX = urut[0].x;

  const lewat = (y: number) => (rise > 0 ? y <= target : y >= target);
  for (let i = 1; i < urut.length; i++) {
    if (lewat(urut[i].y) && !lewat(urut[i - 1].y)) {
      const a = urut[i - 1];
      const c = urut[i];
      const beda = c.y - a.y;
      const f = Math.abs(beda) < 1e-12 ? 0 : (target - a.y) / beda;
      return {
        distance: Math.abs(kendaliX - (a.x + (c.x - a.x) * f)),
        rise,
        y0,
        beyondSearch: false,
      };
    }
  }
  return { distance: maxLength, rise, y0, beyondSearch: true };
}

/* ------------------------------------------------------------------ *
 * Patahan kemiringan dasar
 * ------------------------------------------------------------------ */

export type SlopeBreakKind =
  | "landai-curam"
  | "curam-landai"
  | "landai-landai"
  | "curam-curam";

export type SlopeBreakReach = {
  y0: number;
  mild: boolean;
  /**
   * Profil pada ruas ini, atau null bila ruas ini seragam pada kedalaman
   * normalnya. Ruas yang kendalinya berada di luar bentang yang digambar
   * memang tidak punya profil peralihan untuk ditelusuri.
   */
  profile: GvfResult | null;
  /** Nama profil, atau penanda seragam */
  name: string;
};

export type SlopeBreak = {
  yc: number;
  kind: SlopeBreakKind;
  hulu: SlopeBreakReach;
  hilir: SlopeBreakReach;
  /** Kedalaman tepat di patahan */
  yBreak: number;
  /** Benar bila aliran melewati kondisi kritis tepat di patahan */
  criticalAtBreak: boolean;
  /** Jarak loncatan air dari patahan ke arah hilir, meter; null bila tidak ada */
  jumpAt: number | null;
  /** Kedalaman sesudah loncatan, yang harus sama dengan kedalaman normal ruas hilir */
  jumpTo: number | null;
  /** Kedalaman tepat sebelum loncatan */
  jumpFrom: number | null;
  /**
   * Benar bila loncatan tidak muat di ruas hilir karena muka air hilir terlalu
   * tinggi. Loncatan lalu terdorong ke hulu melewati patahan dan ruas curam
   * ikut tergenang. Ini keadaan yang berbeda, bukan kegagalan hitungan.
   */
  jumpDrowned: boolean;
};

/**
 * Dua ruas saluran dengan kemiringan dasar berbeda.
 *
 * Yang menentukan seluruh gambar adalah letak penampang kendalinya, dan letak
 * itu tidak dipilih melainkan jatuh dari jenis patahannya:
 *
 * - Landai ke curam. Aliran melewati kondisi kritis TEPAT di patahan, dan di
 *   situlah kendalinya. Ruas hulu ditelusuri ke hulu dari kedalaman kritis,
 *   ruas hilir ditelusuri ke hilir dari kedalaman yang sama.
 * - Landai ke landai. Kendali ruas hilir berada jauh di hilir, sehingga ruas
 *   hilir praktis seragam pada kedalaman normalnya. Ruas hulu menyesuaikan diri
 *   terhadap kedalaman itu di patahan.
 * - Ruas hulu curam. Aliran superkritis dikendalikan dari hulu, jadi apa pun
 *   yang terjadi di hilir tidak dapat menjalar naik: ruas hulu seragam pada
 *   kedalaman normalnya, apa pun kemiringan di seberang patahan.
 * - Curam ke landai. Aliran superkritis meneruskan perjalanannya melewati
 *   patahan sebagai profil M3, melambat, lalu naik lewat loncatan air ke
 *   kedalaman normal ruas hilir. Letak loncatannya dicari, bukan ditaruh di
 *   patahan begitu saja.
 */
export function slopeBreak(
  Q: number,
  b: number,
  n: number,
  Sa: number,
  Sb: number,
  panjangHulu = 600,
  panjangHilir = panjangHulu
): SlopeBreak {
  const q = Q / b;
  const yc = criticalDepth(q);
  const y0a = normalDepth(Q, b, n, Sa);
  const y0b = normalDepth(Q, b, n, Sb);
  const mildA = y0a > yc;
  const mildB = y0b > yc;

  const kind: SlopeBreakKind = mildA
    ? mildB
      ? "landai-landai"
      : "landai-curam"
    : mildB
      ? "curam-landai"
      : "curam-curam";

  const seragam = (y0: number, mild: boolean): SlopeBreakReach => ({
    y0,
    mild,
    profile: null,
    name: "y₀",
  });

  /**
   * Memotong profil di tempat ia mencapai kondisi kritis.
   *
   * Profil M3 naik menuju kedalaman kritis dan berhenti di situ; kelanjutannya
   * bukan aliran superkritis lagi. Langkah integrasi yang lebar dapat
   * melompatinya, jadi titik sesudah perlintasan dibuang alih-alih digambar.
   */
  const potongDiKritis = (r: GvfResult): GvfResult => {
    const urut = [...r.points].sort((a, c) => a.x - c.x);
    const batas = urut.findIndex((p) => p.y >= yc * 0.995);
    if (batas <= 0) return r;

    // Titik perlintasan digeser tepat ke kedalaman kritis, supaya ujung profil
    // tidak tampak sedikit melewatinya hanya karena lebar langkah.
    const potong = urut.slice(0, batas + 1);
    const a = potong[potong.length - 2];
    const c = potong[potong.length - 1];
    if (a && Math.abs(c.y - a.y) > 1e-9) {
      const f = (yc - a.y) / (c.y - a.y);
      potong[potong.length - 1] = {
        x: a.x + (c.x - a.x) * f,
        y: yc,
        nearCritical: true,
      };
    }
    return { ...r, points: potong };
  };

  const bertelusur = (
    S: number,
    yKendali: number,
    mild: boolean,
    y0: number,
    panjang: number
  ): SlopeBreakReach => {
    const r = gvfProfile(Q, b, n, S, yKendali, panjang, 600);
    return { y0, mild, profile: r, name: r.profile };
  };

  let hulu: SlopeBreakReach;
  let hilir: SlopeBreakReach;
  let yBreak: number;
  let jumpAt: number | null = null;
  let jumpTo: number | null = null;
  let jumpFrom: number | null = null;
  let jumpDrowned = false;

  if (mildA && !mildB) {
    // Kendali tepat di patahan. Sedikit di atas dan di bawah kritis dipakai
    // sebagai titik awal, karena persamaannya tidak terdefinisi tepat di kritis.
    yBreak = yc;
    hulu = bertelusur(Sa, yc * 1.02, true, y0a, panjangHulu);
    hilir = bertelusur(Sb, yc * 0.98, false, y0b, panjangHilir);
  } else if (mildA && mildB) {
    yBreak = y0b;
    hulu = bertelusur(Sa, y0b, true, y0a, panjangHulu);
    hilir = seragam(y0b, true);
  } else if (!mildA && !mildB) {
    yBreak = y0a;
    hulu = seragam(y0a, false);
    hilir = bertelusur(Sb, y0a, false, y0b, panjangHilir);
  } else {
    yBreak = y0a;
    hulu = seragam(y0a, false);
    const m3 = bertelusur(Sb, y0a, true, y0b, panjangHilir);
    hilir = { ...m3, profile: m3.profile ? potongDiKritis(m3.profile) : null };

    // Loncatan terjadi di tempat kedalaman konjugat aliran superkritis sudah
    // sama tinggi dengan muka air hilir.
    //
    // Sepanjang profil M3 kedalaman naik, bilangan Froude turun, dan kedalaman
    // konjugatnya IKUT TURUN. Jadi konjugat terbesar ada tepat di patahan.
    // Kalau yang terbesar pun masih di bawah kedalaman normal ruas hilir,
    // loncatan tidak muat di mana pun dan terdorong ke hulu.
    const konj = (yy: number) => conjugateDepth(yy, froude(q / yy, yy));
    const pts = hilir.profile
      ? [...hilir.profile.points].sort((a, c) => a.x - c.x)
      : [];
    for (let i = 1; i < pts.length; i++) {
      const sebelum = konj(pts[i - 1].y) - y0b;
      const sesudah = konj(pts[i].y) - y0b;
      if (sebelum >= 0 && sesudah < 0) {
        const f = sebelum / (sebelum - sesudah);
        jumpAt = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f;
        jumpFrom = pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f;
        jumpTo = y0b;
        break;
      }
    }
    if (jumpAt === null && pts.length > 0 && konj(pts[0].y) < y0b) {
      jumpDrowned = true;
    }
  }

  return {
    yc,
    kind,
    hulu,
    hilir,
    yBreak,
    criticalAtBreak: mildA && !mildB,
    jumpAt,
    jumpTo,
    jumpFrom,
    jumpDrowned,
  };
}

/* ------------------------------------------------------------------ *
 * Transisi pada saluran persegi
 *
 * Satu model untuk tiga lembar: perubahan elevasi dasar, perubahan lebar,
 * dan peralihan melewati kondisi kritis. Ketiganya persoalan yang sama,
 * yaitu energi spesifik yang tersedia di penampang hilir dibandingkan
 * dengan energi minimum yang dibutuhkan di sana.
 * ------------------------------------------------------------------ */

export type TransitionBranch = "subkritis" | "superkritis";

/**
 * Mencari kedalaman dari energi spesifik yang diketahui.
 *
 * Persamaan E = y + q^2 / (2 g y^2) punya DUA akar untuk setiap E di atas
 * energi minimum, satu di tiap sisi kedalaman kritis. Cabang mana yang
 * dipakai ditentukan fisika aliran masuknya, bukan dipilih sembarang:
 * aliran tidak dapat berpindah cabang tanpa melewati kondisi kritis.
 *
 * Dipakai metode bagi dua karena fungsinya monoton pada masing-masing
 * cabang, sehingga selalu konvergen.
 */
export function depthFromEnergy(
  E: number,
  q: number,
  branch: TransitionBranch
): number {
  const yc = criticalDepth(q);
  if (E < 1.5 * yc) return NaN;

  let lo: number;
  let hi: number;
  if (branch === "subkritis") {
    lo = yc;
    hi = E;
  } else {
    lo = 1e-9;
    hi = yc;
  }

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const Em = specificEnergy(mid, q);
    // Pada cabang subkritis E naik seiring y, pada cabang superkritis E turun.
    if (branch === "subkritis") {
      if (Em < E) lo = mid;
      else hi = mid;
    } else {
      if (Em > E) lo = mid;
      else hi = mid;
    }
    if (hi - lo < 1e-12) break;
  }
  return (lo + hi) / 2;
}

export type TransitionInput = {
  /** Debit, m3/s */
  Q: number;
  /** Lebar dasar di hulu, m */
  b1: number;
  /** Kedalaman di hulu, m */
  y1: number;
  /** Lebar dasar di hilir, m */
  b2: number;
  /** Kenaikan elevasi dasar, m. Positif berarti dasar naik */
  dz: number;
};

export type TransitionResult = {
  q1: number;
  q2: number;
  yc1: number;
  yc2: number;
  /** Energi spesifik di hulu, diukur dari dasar hulu */
  E1: number;
  /** Energi spesifik yang tersedia di hilir, diukur dari dasar hilir */
  E2: number;
  /** Energi minimum yang dibutuhkan di penampang hilir */
  Emin2: number;
  y2: number;
  Fr1: number;
  Fr2: number;
  branch: TransitionBranch;
  /**
   * Benar bila energi yang tersedia tidak cukup, sehingga aliran tersendat.
   * Pada keadaan ini kedalaman hulu terpaksa naik, dan angka y2 tidak berlaku.
   */
  choked: boolean;
  /** Kenaikan dasar terbesar yang masih dapat dilewati */
  dzMax: number;
  /** Lebar hilir tersempit yang masih dapat dilewati */
  b2Min: number;
  /** Seberapa dekat ke keadaan tersendat, 1 berarti tepat di ambangnya */
  chokeRatio: number;
};

/**
 * Transisi antara dua penampang.
 *
 * Gesekan pada bentang transisi diabaikan, sebagaimana lazimnya pada
 * perhitungan transisi pendek. Yang berlaku hanya kekekalan energi
 * spesifik dikurangi kenaikan dasar.
 */
export function transition(inp: TransitionInput): TransitionResult {
  const { Q, b1, y1, b2, dz } = inp;
  const q1 = Q / b1;
  const q2 = Q / b2;
  const yc1 = criticalDepth(q1);
  const yc2 = criticalDepth(q2);
  const E1 = specificEnergy(y1, q1);
  const E2 = E1 - dz;
  const Emin2 = 1.5 * yc2;
  const branch: TransitionBranch = y1 > yc1 ? "subkritis" : "superkritis";

  const choked = E2 < Emin2;
  const y2 = choked ? yc2 : depthFromEnergy(E2, q2, branch);
  const Fr1 = froude(q1 / y1, y1);
  const Fr2 = Number.isFinite(y2) && y2 > 0 ? froude(q2 / y2, y2) : 1;

  // Kenaikan dasar terbesar yang masih dapat dilewati pada lebar hilir ini.
  const dzMax = E1 - Emin2;

  // Lebar tersempit yang masih dapat dilewati pada kenaikan dasar ini.
  const Etersedia = E1 - dz;
  const b2Min =
    Etersedia > 0
      ? Q / Math.sqrt(G * Math.pow(Etersedia / 1.5, 3))
      : Number.POSITIVE_INFINITY;

  return {
    q1, q2, yc1, yc2, E1, E2, Emin2, y2, Fr1, Fr2, branch,
    choked, dzMax, b2Min,
    chokeRatio: Emin2 > 0 ? Emin2 / Math.max(E2, 1e-9) : 0,
  };
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

/* ------------------------------------------------------------------ *
 * Garis energi sepanjang bentang
 * ------------------------------------------------------------------ */

export type ReachEnergyPoint = {
  /** Jarak dari ujung hulu, meter */
  x: number;
  /** Elevasi dasar terhadap datum di ujung hilir */
  zb: number;
  y: number;
  V: number;
  /** Tinggi kecepatan, V kuadrat per dua g */
  vHead: number;
  /** Garis muka air, yaitu zb ditambah y */
  wsl: number;
  /** Garis energi, yaitu muka air ditambah tinggi kecepatan */
  egl: number;
  Sf: number;
  nearCritical: boolean;
};

export type ReachEnergyResult = {
  points: ReachEnergyPoint[];
  y0: number;
  yc: number;
  profile: string;
  mild: boolean;
  /** Kehilangan tinggi tekan akibat gesekan, hasil integrasi Sf sepanjang bentang */
  hf: number;
  /** Penurunan dasar sepanjang bentang, yaitu S0 dikali panjang */
  dz: number;
  /** Selisih tinggi energi total antara ujung hulu dan ujung hilir */
  dE: number;
};

/**
 * Menyusun garis energi dan garis muka air sepanjang satu bentang.
 *
 * Dua garis inilah yang membuat persamaan energi saluran terbuka dapat dibaca.
 * Jarak tegak antara garis energi dan muka air adalah tinggi kecepatan, dan
 * kemiringan garis energi adalah kemiringan gesek. Keduanya diturunkan dari
 * profil yang sama, bukan digambar terpisah, sehingga tidak mungkin saling
 * bertentangan di layar.
 */
export function reachEnergy(
  Q: number,
  b: number,
  n: number,
  S0: number,
  yControl: number,
  L: number,
  steps = 300
): ReachEnergyResult {
  const r = gvfProfile(Q, b, n, S0, yControl, L, steps);

  // Titik dari gvfProfile boleh berurut ke hulu; di sini selalu dari hulu.
  const urut = [...r.points].sort((a, c) => a.x - c.x);

  const points: ReachEnergyPoint[] = urut.map((p) => {
    const zb = (L - p.x) * S0;
    const V = Q / (b * p.y);
    const vHead = (V * V) / (2 * G);
    return {
      x: p.x,
      zb,
      y: p.y,
      V,
      vHead,
      wsl: zb + p.y,
      egl: zb + p.y + vHead,
      Sf: frictionSlope(Q, b, p.y, n),
      nearCritical: p.nearCritical,
    };
  });

  let hf = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    hf += ((points[i].Sf + points[i - 1].Sf) / 2) * dx;
  }

  return {
    points,
    y0: r.y0,
    yc: r.yc,
    profile: r.profile,
    mild: r.mild,
    hf,
    dz: S0 * L,
    dE: points[0].egl - points[points.length - 1].egl,
  };
}

/* ------------------------------------------------------------------ *
 * Aliran berubah beraturan dengan debit bertambah
 * ------------------------------------------------------------------ */

export type SvfPoint = {
  x: number;
  y: number;
  /** Debit yang lewat di penampang ini, bertambah ke arah hilir */
  Q: number;
  V: number;
  Fr: number;
  nearCritical: boolean;
};

export type SvfResult = {
  points: SvfPoint[];
  /** Debit di ujung hilir */
  Qend: number;
  /** Kedalaman kritis di ujung hilir, tempat debitnya terbesar */
  ycEnd: number;
  /** Benar bila ada titik yang melewati kondisi kritis di tengah bentang */
  crossesCritical: boolean;
  yMax: number;
  /**
   * Benar bila aliran di ujung hilir ternyata superkritis.
   *
   * Penelusuran ini mengandaikan kendali berada di ujung hilir, dan andaian itu
   * hanya berlaku untuk aliran subkritis. Pada aliran superkritis kendalinya
   * pindah ke hulu, sehingga hasil penelusuran ini tidak berlaku dan harus
   * dinyatakan demikian alih-alih ditampilkan seolah berlaku.
   */
  outletSupercritical: boolean;
};

/**
 * Kemiringan muka air pada aliran dengan debit bertambah di sepanjang jalan.
 *
 * Bedanya dengan aliran berubah lambat ada pada satu suku tambahan di
 * pembilang. Air yang masuk dari samping datang tanpa membawa momentum searah
 * saluran, jadi ia harus dipercepat oleh aliran yang sudah ada, dan biaya
 * percepatan itu diambil dari tinggi tekan. Suku itulah yang membuat muka air
 * pada saluran pengumpul naik ke arah hulu walaupun dasarnya menurun.
 *
 * Rujukan: Chow (1959) Bab 12, aliran berubah beraturan dengan debit bertambah.
 */
export function svfSlope(
  Q: number,
  qStar: number,
  b: number,
  y: number,
  n: number,
  S0: number
): number {
  const A = b * y;
  const Sf = frictionSlope(Q, b, y, n);
  const Fr2 = (Q * Q) / (G * b * b * y * y * y);
  const lateral = (2 * Q * qStar) / (G * A * A);
  const denom = 1 - Fr2;
  const kecil = Math.abs(denom) < 1e-4;
  return (S0 - Sf - lateral) / (kecil ? Math.sign(denom || 1) * 1e-4 : denom);
}

/**
 * Menelusuri muka air pada saluran yang menerima aliran masuk merata.
 *
 * Penelusuran dimulai dari ujung hilir dan berjalan ke hulu, karena aliran
 * subkritis dikendalikan dari hilir. Debit di setiap penampang dihitung dari
 * jaraknya, bukan dianggap tetap, dan itulah yang membedakan lembar ini dari
 * penelusuran biasa.
 *
 * Andaian kendali di ujung hilir tidak berlaku bila aliran di sana superkritis.
 * Keadaan itu tidak dilarang di sini, melainkan dilaporkan lewat
 * outletSupercritical, supaya lembar yang memakainya dapat menyatakannya
 * kepada pembaca alih-alih menampilkan angka yang tidak berarti.
 */
export function svfProfile(
  Q0: number,
  qStar: number,
  b: number,
  n: number,
  S0: number,
  L: number,
  yEnd: number,
  steps = 400
): SvfResult {
  const dx = L / steps;
  const Qat = (x: number) => Math.max(1e-6, Q0 + qStar * x);

  const pts: SvfPoint[] = [];
  let y = yEnd;

  const rekam = (x: number, yy: number) => {
    const Q = Qat(x);
    const V = Q / (b * yy);
    const Fr = froude(V, yy);
    pts.push({ x, y: yy, Q, V, Fr, nearCritical: Math.abs(Fr - 1) < 0.06 });
  };

  rekam(L, y);

  // Runge-Kutta orde empat, melangkah mundur sebesar dx tiap kali.
  const f = (xx: number, yy: number) =>
    svfSlope(Qat(xx), qStar, b, Math.max(0.01, yy), n, S0);

  // Langkah dibagi lagi secara adaptif bila muka air sedang curam.
  //
  // Di dekat kondisi kritis penyebut (1 - Fr kuadrat) menuju nol dan kemiringan
  // muka air membesar tanpa batas. Langkah tetap akan melompati keadaan itu dan
  // menghasilkan kedalaman yang tidak berarti apa pun. Yang dilakukan di sini
  // adalah memperkecil langkah sampai perubahan kedalaman per langkah tetap
  // kecil terhadap kedalamannya sendiri.
  const rk4 = (x: number, yy: number, h: number) => {
    const k1 = f(x, yy);
    const k2 = f(x + h / 2, yy + (h / 2) * k1);
    const k3 = f(x + h / 2, yy + (h / 2) * k2);
    const k4 = f(x + h, yy + h * k3);
    return yy + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
  };

  for (let i = 1; i <= steps; i++) {
    const x = L - (i - 1) * dx;
    const kasar = Math.abs(f(x, y) * dx);
    const bagi = Math.min(200, Math.max(1, Math.ceil(kasar / (0.02 * y))));
    const h = -dx / bagi;
    for (let j = 0; j < bagi; j++) {
      y = Math.max(0.01, rk4(x + j * h, y, h));
    }
    rekam(x - dx, y);
  }

  pts.reverse();

  return {
    points: pts,
    Qend: Qat(L),
    ycEnd: criticalDepth(Qat(L) / b),
    crossesCritical: pts.some((p) => p.Fr > 1) && pts.some((p) => p.Fr < 1),
    yMax: pts.reduce((m, p) => Math.max(m, p.y), 0),
    outletSupercritical: yEnd < criticalDepth(Qat(L) / b),
  };
}

/* ------------------------------------------------------------------ *
 * Fungsi momentum
 * ------------------------------------------------------------------ */

/**
 * Fungsi momentum per satuan lebar untuk penampang persegi, satuan meter kubik
 * per meter. Nilainya minimum tepat pada kedalaman kritis, sama seperti energi
 * spesifik, dan itu bukan kebetulan: keduanya turun dari kondisi yang sama.
 */
export function momentumFunction(y: number, q: number): number {
  return (y * y) / 2 + (q * q) / (G * y);
}

/**
 * Kedalaman lain yang memberi nilai fungsi momentum sama.
 *
 * Inilah pasangan konjugat loncatan air, dicari langsung dari fungsi
 * momentumnya alih-alih dari persamaan Belanger. Kalau keduanya bertemu di
 * angka yang sama, dua jalur perhitungan yang berbeda saling membenarkan.
 */
export function conjugateFromMomentum(y: number, q: number): number {
  const M = momentumFunction(y, q);
  const yc = criticalDepth(q);
  const naik = y < yc;

  let lo = naik ? yc : 1e-6;
  let hi = naik ? Math.max(yc * 50, y * 50, 1) : yc;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const nilai = momentumFunction(mid, q);
    // Di atas yc fungsi momentum naik terhadap y, di bawahnya turun.
    if (naik ? nilai < M : nilai > M) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}


/* ------------------------------------------------------------------ *
 * Saluran pengumpul pelimpah samping, metode Hinds
 * ------------------------------------------------------------------ */

export type TroughPoint = {
  x: number;
  y: number;
  Q: number;
  V: number;
  Fr: number;
  /** Elevasi dasar terhadap datum di ujung hilir */
  zb: number;
  /** Elevasi muka air terhadap datum yang sama */
  ws: number;
};

export type TroughResult = {
  points: TroughPoint[];
  /** Kedalaman kritis di ujung keluar, tempat kendalinya berada */
  ycOut: number;
  Qout: number;
  /** Kedalaman terbesar di sepanjang saluran pengumpul */
  yMax: number;
  /** Kenaikan muka air dari ujung keluar ke pangkal saluran */
  rise: number;
  /** Benar bila ada penampang yang menjadi superkritis, yang berarti rancangannya perlu diperiksa */
  anySupercritical: boolean;
};

/**
 * Muka air di dalam saluran pengumpul sebuah pelimpah samping.
 *
 * Dipakai bentuk beda hingga dari persamaan momentum, bukan bentuk diferensial,
 * dan itu bukan pilihan gaya. Kendali saluran pengumpul berada tepat pada
 * kondisi kritis di ujung keluarnya, dan di titik itu bentuk diferensial
 * membagi dengan (1 - Fr kuadrat) yang menuju nol, sehingga penelusuran meledak
 * pada langkah pertama. Bentuk beda hingga tidak pernah membagi dengan suku itu.
 *
 * Bentuk yang dipakai sudah dirapikan agar tidak membagi dengan debit di hulu,
 * supaya pangkal saluran yang debitnya nol tetap dapat dihitung.
 *
 * Rujukan: Hinds (1926), dikutip Chow (1959) Bab 12 dan USBR Design of Small Dams.
 */
export function sideChannelProfile(
  /** Debit total yang melimpah masuk sepanjang saluran, meter kubik per detik */
  Qtotal: number,
  /** Lebar dasar saluran pengumpul, meter */
  b: number,
  n: number,
  S0: number,
  L: number,
  steps = 120
): TroughResult {
  const dx = L / steps;
  const qStar = Qtotal / L;
  const Qat = (x: number) => qStar * x;

  const ycOut = criticalDepth(Qtotal / b);

  const pts: TroughPoint[] = [];
  let y = ycOut;
  let ws = ycOut; // dasar di ujung keluar dijadikan datum

  const simpan = (x: number, yy: number, wsn: number) => {
    const Q = Qat(x);
    const V = yy > 0 ? Q / (b * yy) : 0;
    pts.push({ x, y: yy, Q, V, Fr: froude(V, yy), zb: wsn - yy, ws: wsn });
  };

  simpan(L, y, ws);

  for (let i = 1; i <= steps; i++) {
    const x2 = L - (i - 1) * dx;
    const x1 = x2 - dx;
    const Q2 = Qat(x2);
    const Q1 = Qat(x1);
    const y2 = y;
    const V2 = Q2 / (b * y2);
    const zb1 = pts[pts.length - 1].zb + S0 * dx;

    // Kedalaman di hulu muncul di kedua ruas, jadi dicari dengan iterasi.
    // Iterasinya dituntut bertemu sampai ketelitian mesin, bukan sampai
    // gambarnya terlihat benar: sisa iterasi yang tertinggal tidak akan
    // pernah tampak di layar tetapi tetap terbawa ke langkah berikutnya.
    let y1 = y2;
    for (let k = 0; k < 300; k++) {
      const V1 = Q1 > 0 ? Q1 / (b * y1) : 0;
      const jumlahQ = Q1 + Q2;
      const dyMomentum =
        jumlahQ > 0
          ? ((V1 + V2) / (G * jumlahQ)) * (Q1 * (V2 - V1) + V2 * (Q2 - Q1))
          : 0;
      const hf =
        ((frictionSlope(Q1, b, y1, n) + frictionSlope(Q2, b, y2, n)) / 2) * dx;
      const wsBaru = ws + dyMomentum + hf;
      const yBaru = Math.max(0.01, wsBaru - zb1);
      if (Math.abs(yBaru - y1) < 1e-13) {
        y1 = yBaru;
        break;
      }
      y1 = y1 + (yBaru - y1) * 0.6;
    }

    ws = zb1 + y1;
    y = y1;
    simpan(x1, y, ws);
  }

  pts.reverse();

  return {
    points: pts,
    ycOut,
    Qout: Qtotal,
    yMax: pts.reduce((m, p) => Math.max(m, p.y), 0),
    rise: pts[0].ws - pts[pts.length - 1].ws,
    anySupercritical: pts.some((p) => p.Q > 0 && p.Fr > 1.001),
  };
}

/* ------------------------------------------------------------------ *
 * Rumus tertutup untuk saluran sangat lebar
 * ------------------------------------------------------------------ */

/**
 * Kedalaman normal pada saluran yang jauh lebih lebar daripada dalamnya.
 *
 * Pada saluran semacam itu jari-jari hidrolik mendekati kedalaman, sehingga
 * persamaan Manning dapat dibalik secara langsung tanpa iterasi. Rumus ini
 * tidak dipakai untuk menghitung apa pun yang tampil di layar; keberadaannya
 * semata sebagai pembanding terbitan yang bebas dari pencari akar kami sendiri,
 * dipakai pada blok verifikasi.
 *
 * Rujukan: Chow (1959) Bab 6, saluran sangat lebar.
 */
export function wideChannelNormalDepth(
  q: number,
  n: number,
  S: number
): number {
  return Math.pow((q * n) / Math.sqrt(S), 3 / 5);
}

/* ------------------------------------------------------------------ *
 * Tirai luapan bebas di atas ambang tajam
 * ------------------------------------------------------------------ */

/** Pangkat pada persamaan bentuk mercu WES untuk muka hulu tegak. */
export const WES_N = 1.85;
/** Tetapan pada persamaan bentuk mercu WES untuk muka hulu tegak. */
export const WES_K = 2.0;

/**
 * Permukaan bawah tirai luapan bebas, diukur turun dari puncak mercu.
 *
 * Bentuk ini bukan parabola. Ia diperoleh dari pengukuran tirai luapan pada
 * ambang tajam yang diberi udara, lalu dirumuskan sebagai persamaan pangkat
 * dengan pangkat 1,85 untuk muka hulu tegak. Bentuk mercu ogee dirancang
 * mengikuti permukaan ini persis, sehingga pada tinggi energi rancangan tirai
 * air menempel pada mercu tanpa menekan maupun terangkat.
 *
 * Rujukan: USACE, Hydraulic Design Criteria, lembar mercu WES.
 */
export function wesNappe(Hd: number, x: number): number {
  if (Hd <= 0 || x < 0) return 0;
  return Math.pow(x, WES_N) / (WES_K * Math.pow(Hd, WES_N - 1));
}

/**
 * Lintasan pancaran bebas sebagai gerak peluru.
 *
 * Ini penyederhanaan yang lazim dipakai di buku pengantar: air dianggap
 * meninggalkan mercu mendatar dengan kecepatan tetap lalu jatuh bebas.
 * Dibandingkan bentuk WES, lintasan ini turun terlalu cepat di dekat mercu,
 * karena mengabaikan tekanan dan lengkung aliran di atas puncak. Selisih itu
 * digambar pada lembarnya, bukan disembunyikan.
 */
export function jetTrajectory(V0: number, x: number): number {
  if (V0 <= 0) return 0;
  return (G * x * x) / (2 * V0 * V0);
}

/** Tetapan koreksi tinggi muka air untuk ambang tajam persegi, meter. */
export const RECT_WEIR_KH = 0.001;
/** Tinggi muka air terkecil yang masih di dalam rentang keberlakuan, meter. */
export const RECT_WEIR_H_MIN = 0.03;
/** Tinggi ambang terkecil yang masih di dalam rentang keberlakuan, meter. */
export const RECT_WEIR_P_MIN = 0.1;
/** Perbandingan tinggi muka air terhadap tinggi ambang yang masih berlaku. */
export const RECT_WEIR_HP_MAX = 2.0;

/**
 * Koefisien debit ambang tajam persegi selebar penuh saluran.
 *
 * Naik terhadap perbandingan tinggi muka air dan tinggi ambang, karena makin
 * pendek ambangnya makin besar kecepatan datang yang sudah dimiliki air
 * sebelum melewatinya.
 *
 * Rujukan: ISO 1438, bentuk Kindsvater-Carter untuk ambang selebar penuh.
 */
export function rectWeirCe(h: number, P: number): number {
  return 0.602 + 0.075 * (P > 0 ? h / P : 0);
}

export type RectWeirResult = {
  Q: number;
  Ce: number;
  /** Tinggi muka air efektif, yaitu tinggi terukur ditambah koreksi */
  he: number;
  /** Kecepatan rata-rata di atas mercu, dipakai untuk lintasan pancaran */
  V0: number;
  outOfRange: boolean;
  /** Alasan berada di luar rentang, kosong bila di dalam rentang */
  reason: "" | "h-kecil" | "P-kecil" | "hP-besar";
};

/**
 * Debit yang lewat di atas ambang tajam persegi selebar penuh saluran.
 *
 * Rujukan: ISO 1438, ambang tipis persegi.
 */
export function rectWeirDischarge(
  h: number,
  b: number,
  P: number
): RectWeirResult {
  const Ce = rectWeirCe(h, P);
  const he = h + RECT_WEIR_KH;
  const Q = (2 / 3) * Ce * Math.sqrt(2 * G) * b * Math.pow(Math.max(he, 0), 1.5);
  const V0 = h > 0 ? Q / (b * h) : 0;

  const reason: RectWeirResult["reason"] =
    h < RECT_WEIR_H_MIN
      ? "h-kecil"
      : P < RECT_WEIR_P_MIN
        ? "P-kecil"
        : h / P > RECT_WEIR_HP_MAX
          ? "hP-besar"
          : "";

  return { Q, Ce, he, V0, outOfRange: reason !== "", reason };
}
