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

/**
 * Angka untuk ditulis DI DALAM gambar.
 *
 * Pemisah desimalnya mengikuti bahasa, tetapi pemisah ribuannya dimatikan.
 * Alasannya konvensi gambar teknik: dimensi 1200 mm ditulis 1200, bukan 1.200,
 * karena titik pada gambar sudah dipakai sebagai pemisah desimal dan
 * memunculkannya dua kali dengan arti berbeda membuat angka mudah salah baca.
 *
 * Untuk prosa dan tabel dipakai fmt, yang membiarkan pemisah ribuannya, karena
 * di sana angkanya dibaca sebagai bagian dari kalimat.
 */
export function fmtPlain(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(numberLocale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  });
}

export function fmtSci(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  const exp = Math.floor(Math.log10(Math.abs(value)));
  const mant = value / Math.pow(10, exp);
  // Mantisanya ikut mengikuti bahasa, sama seperti angka lain di layar.
  return `${fmtPlain(mant, 2)} × 10${toSuperscript(exp)}`;
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

export type GvfPoint = {
  x: number;
  y: number;
  nearCritical: boolean;
  /** Muka air di titik ini terlalu curam untuk disebut berubah lambat */
  rapid: boolean;
};

/**
 * Kecuraman muka air yang menandai batas aliran berubah lambat.
 *
 * Persamaan aliran berubah lambat mengandaikan lengkung permukaan tetap landai,
 * sehingga tekanannya boleh dianggap hidrostatik. Andaian itu tidak punya batas
 * yang diterbitkan sebagai angka, jadi nilai di bawah ini adalah pilihan
 * rekayasa, bukan kutipan: muka air yang berubah lebih dari sepuluh sentimeter
 * tiap meter sudah tidak masuk akal disebut berubah lambat.
 *
 * Nilainya sengaja diberi nama dan ditaruh di sini, bukan disembunyikan di
 * dalam penggambar, supaya dapat diperdebatkan dan diubah di satu tempat.
 */
export const RVF_SURFACE_SLOPE = 0.1;

export type GvfResult = {
  points: GvfPoint[];
  /**
   * Ruas tempat persamaannya kehilangan keberlakuan, dalam jarak.
   *
   * Ruas ini hampir selalu sangat pendek, sering kurang dari satu meter, karena
   * di dekat kondisi kritis muka air berubah sangat cepat. Karena itu ia
   * dilaporkan sebagai rentang jarak dan bukan sebagai kumpulan titik: lembar
   * yang memakainya perlu tahu bahwa ruas itu terlalu pendek untuk digambar
   * sebagai garis, dan harus ditandai sebagai satu penampang.
   */
  rvf: { from: number; to: number } | null;
  /** Nama profil menurut penggolongan baku, misalnya M1 atau S2 */
  profile: string;
  /** Arah penelusuran: hulu untuk aliran subkritis, hilir untuk superkritis */
  direction: "hulu" | "hilir";
  /**
   * Benar bila penelusuran berhenti karena mencapai kedalaman kritis, bukan
   * karena kehabisan bentang.
   *
   * Aliran tidak dapat melintasi kondisi kritis tanpa loncatan air, dan
   * loncatan bukan aliran berubah lambat. Profil yang sampai di kedalaman
   * kritis karena itu SELESAI di situ, dan sisa bentangnya memang tidak memuat
   * profil ini.
   */
  endsAtCritical: boolean;
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

  // Sisi kedalaman kritis tempat profil ini berada. Ia tidak boleh berpindah
  // sisi, karena berpindah sisi berarti melintasi kondisi kritis.
  const sisi = yControl >= yc ? 1 : -1;
  let endsAtCritical = false;

  for (let i = 0; i <= steps; i++) {
    const xFromControl = i * (length / steps);
    const x = subcritical ? length - xFromControl : xFromControl;
    const Fr2 = (q * q) / (G * y * y * y);

    // Runge-Kutta orde empat pada dy/dx.
    const k1 = gvfSlope(Q, b, y, n, S0);
    points.push({
      x,
      y,
      nearCritical: Math.abs(1 - Fr2) < 0.06,
      rapid: Math.abs(k1) > RVF_SURFACE_SLOPE,
    });

    if (i === steps) break;

    const k2 = gvfSlope(Q, b, clampDepth(y + (dx * k1) / 2, yc), n, S0);
    const k3 = gvfSlope(Q, b, clampDepth(y + (dx * k2) / 2, yc), n, S0);
    const k4 = gvfSlope(Q, b, clampDepth(y + dx * k3, yc), n, S0);
    const yBaru = y + (dx / 6) * (k1 + 2 * k2 + 2 * k3 + k4);

    /*
     * Penelusuran berhenti di kedalaman kritis, tidak diteruskan ke seberang.
     *
     * Penahan kedalaman hanya mencegah hasil MENDARAT di dalam pita tipis di
     * sekitar kedalaman kritis; ia tidak mencegah satu langkah MELOMPATINYA.
     * Tanpa pemeriksaan ini, profil superkritis melompat ke sisi subkritis lalu
     * berosilasi, dan yang tergambar adalah aliran yang melintasi kondisi
     * kritis tanpa loncatan air, yang mustahil.
     */
    if (Math.sign(yBaru - yc) !== sisi) {
      const beda = yBaru - y;
      const f = Math.abs(beda) < 1e-12 ? 1 : (yc - y) / beda;
      points.push({
        x: x + dx * Math.min(Math.max(f, 0), 1),
        y: yc,
        nearCritical: true,
        rapid: true,
      });
      endsAtCritical = true;
      break;
    }

    y = clampDepth(yBaru, yc);
  }

  points.sort((a, c) => a.x - c.x);

  const curam = points.filter((p) => p.rapid);
  const rvf =
    curam.length > 0
      ? { from: curam[0].x, to: curam[curam.length - 1].x }
      : null;

  return { points, profile, direction, endsAtCritical, y0, yc, mild, rvf };
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
 * Kedalaman hulu yang dipaksakan bangunan ambang lebar
 * ------------------------------------------------------------------ */

/**
 * Kedalaman air tepat di hulu sebuah bangunan bermercu lebar.
 *
 * Di atas mercu aliran melewati kondisi kritis, jadi energi spesifik yang
 * dibutuhkan, diukur dari dasar saluran, adalah P + 1,5 yc. Kedalaman hulunya
 * adalah akar subkritis persamaan energi untuk nilai itu. Ini BUKAN P + yc:
 * yang sama dengan P + yc adalah muka air di atas mercu, bukan di hulunya,
 * dan selisih keduanya adalah tinggi kecepatan yang tidak boleh dilupakan.
 *
 * Yang diabaikan hanya kehilangan setempat di muka bangunan, sehingga
 * kedalamannya sedikit di bawah yang sesungguhnya. Henderson (1966) Bab 6.
 */
export function broadCrestControlDepth(P: number, q: number): number {
  return depthFromEnergy(P + 1.5 * criticalDepth(q), q, "subkritis");
}

/**
 * Tinggi bangunan terendah yang masih membendung.
 *
 * Bila energi aliran normal saluran sudah melampaui P + 1,5 yc, air melewati
 * mercu tanpa harus menjadi kritis di atasnya, dan kedalaman hulu tetap pada
 * kedalaman normal. Bangunan yang lebih rendah dari nilai ini tidak menahan
 * apa pun.
 */
export function minControllingHeight(y0: number, q: number): number {
  return specificEnergy(y0, q) - 1.5 * criticalDepth(q);
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
        // Tepat di kedalaman kritis, kemiringan muka air menuju tak hingga.
        rapid: true,
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

export type NotchOutOfRange = "tinggi-rendah" | "tinggi-tinggi" | "sudut" | null;

export type NotchResult = {
  Q: number;
  Ce: number;
  he: number;
  /** Benar bila tinggi muka air atau sudut takik di luar rentang keberlakuan rumus */
  outOfRange: boolean;
  /** Sebab keluar rentang, atau null bila di dalam rentang */
  reason: NotchOutOfRange;
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
  const reason: NotchOutOfRange =
    H < NOTCH_H_MIN
      ? "tinggi-rendah"
      : H > NOTCH_H_MAX
        ? "tinggi-tinggi"
        : thetaDeg < NOTCH_THETA_MIN || thetaDeg > NOTCH_THETA_MAX
          ? "sudut"
          : null;
  return { Q, Ce, he, outOfRange: reason !== null, reason };
}

/**
 * Batas keberlakuan pada ISO 1438:2017 untuk takik V berkontraksi penuh.
 *
 * Di bawah 5 cm tegangan permukaan menguasai. Di atas 38 cm data kalibrasi
 * Kindsvater-Shen tidak menjangkau. Kurva Ce hanya diterbitkan untuk sudut
 * 20 sampai 100 derajat; di luar itu nilainya ekstrapolasi.
 */
export const NOTCH_H_MIN = 0.05;
export const NOTCH_H_MAX = 0.38;
export const NOTCH_THETA_MIN = 20;
export const NOTCH_THETA_MAX = 100;

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
  /** Kehilangan tinggi tekan akibat gesekan, hasil integrasi Sf sepanjang profil */
  hf: number;
  /**
   * Penurunan dasar SEPANJANG PROFIL, bukan sepanjang bentang yang diminta.
   *
   * Keduanya berbeda bila profil berakhir di kedalaman kritis sebelum mencapai
   * ujung bentang. Membandingkan kehilangan gesekan sepanjang profil terhadap
   * penurunan dasar sepanjang bentang penuh akan membandingkan dua jarak yang
   * berbeda, dan angka yang keluar tidak berarti apa-apa.
   */
  dz: number;
  /** Panjang profil yang benar-benar tertelusuri, meter */
  length: number;
  /** Benar bila profil berhenti karena mencapai kedalaman kritis */
  endsAtCritical: boolean;
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

  const panjang = points[points.length - 1].x - points[0].x;

  return {
    points,
    y0: r.y0,
    yc: r.yc,
    profile: r.profile,
    mild: r.mild,
    hf,
    dz: S0 * panjang,
    length: panjang,
    endsAtCritical: r.endsAtCritical,
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
  steps = 400,
  /**
   * Menelusuri TANPA suku percepatan, tetapi tetap dengan debit yang bertambah.
   *
   * Ini hitungan yang lazim dilakukan orang: debit diperbarui di tiap penampang,
   * tetapi biaya mempercepat air yang baru masuk dilupakan. Dipakai sebagai
   * pembanding pada gambar, supaya selisihnya benar-benar mengukur pengaruh
   * suku itu dan bukan pengaruh perbedaan debit.
   */
  tanpaPercepatan = false
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
    svfSlope(
      Qat(xx),
      tanpaPercepatan ? 0 : qStar,
      b,
      Math.max(0.01, yy),
      n,
      S0
    );

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
  /**
   * Absis tempat penelusuran berhenti karena aliran di hulunya superkritis,
   * atau null bila seluruh saluran subkritis. Di hulu titik ini muka airnya
   * TIDAK dihitung: kendali di ujung keluar tidak lagi menjangkaunya, dan
   * `points` hanya memuat bagian dari titik ini sampai ujung keluar.
   */
  supercriticalFrom: number | null;
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

  /*
   * Penelusuran dari kendali di ujung keluar hanya berlaku selama alirannya
   * subkritis. Begitu sebuah penampang menjadi superkritis, kendali di hilir
   * tidak lagi menjangkau hulunya; muka air di sana ditentukan dari pangkal,
   * dan di antara keduanya ada loncatan air. Kalau penelusuran diteruskan
   * juga, kedalamannya terjepit ke batas bawah dan kemiringan gesekannya
   * meledak, sehingga muka air "naik" ratusan meter dalam beberapa langkah.
   * Angka itu pernah keluar, dan bukan angka.
   */
  let supercriticalFrom: number | null = null;

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

    if (Q1 > 0 && froude(Q1 / (b * y1), y1) > 1.001) {
      supercriticalFrom = x2;
      break;
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
    anySupercritical: supercriticalFrom !== null,
    supercriticalFrom,
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

/* ------------------------------------------------------------------ *
 * Lubang berbibir tajam dan vena contracta
 * ------------------------------------------------------------------ */

/**
 * Koefisien kontraksi teoretis untuk celah dua dimensi berbibir tajam.
 *
 * Angka ini bukan hasil pengukuran melainkan penyelesaian tertutup: pada
 * aliran tanpa kekentalan yang keluar dari celah panjang pada dinding datar,
 * lebar pancaran menyempit menjadi pi dibagi pi ditambah dua kali lebar
 * celahnya. Nilainya 0,6110, dan pengukuran pada lubang bulat berbibir tajam
 * memang jatuh di sekitar 0,62.
 *
 * Rujukan: penyelesaian Kirchhoff untuk pancaran bebas, dibahas di Lamb (1932)
 * Hydrodynamics dan Vennard & Street, Elementary Fluid Mechanics.
 */
export const ORIFICE_CC_SLOT = Math.PI / (Math.PI + 2);

export type OrificeResult = {
  /** Kecepatan menurut Torricelli, tanpa kehilangan */
  Vth: number;
  /** Kecepatan sesungguhnya di vena contracta */
  V: number;
  Q: number;
  Cc: number;
  Cv: number;
  /** Koefisien debit, hasil kali Cc dan Cv */
  Cd: number;
  /** Luas lubang */
  area: number;
  /** Luas penampang pancaran di vena contracta */
  areaVena: number;
  /** Jarak vena contracta dari bidang lubang, meter */
  xVena: number;
  /** Tinggi kehilangan energi pada lubang */
  headLoss: number;
  /**
   * Benar bila seluruh bukaan berada di bawah muka air. Bila salah, bibir
   * atas lubang muncul di atas permukaan dan yang terjadi bukan lagi aliran
   * lubang melainkan luapan di atas ambang: rumus di lembar ini tidak
   * berlaku, dan tinggi muka air di atas titik berat pun kehilangan artinya.
   */
  submerged: boolean;
  /** Tinggi muka air terkecil yang masih merendam seluruh bukaan, meter */
  minHead: number;
};

/**
 * Pancaran yang keluar dari lubang berbibir tajam pada dinding tegak.
 *
 * Dua koefisien bekerja berurutan dan tidak boleh ditukar. Kontraksi mengurangi
 * LUAS pancaran, karena garis arus yang datang dari samping tidak dapat
 * berbelok tajam tepat di bibir lubang. Kecepatan mengurangi LAJU, karena ada
 * gesekan pada bibirnya. Koefisien debit adalah hasil kali keduanya, dan itulah
 * satu-satunya yang terbaca dari pengukuran debit.
 */
export function orificeJet(
  /** Tinggi muka air di atas titik berat lubang, meter */
  H: number,
  /** Tinggi bukaan lubang, meter */
  a: number,
  /** Lebar lubang, meter */
  bLubang: number,
  Cv: number,
  Cc: number
): OrificeResult {
  const Vth = Math.sqrt(2 * G * Math.max(H, 0));
  const V = Cv * Vth;
  const area = a * bLubang;
  const areaVena = Cc * area;
  const Q = V * areaVena;

  return {
    Vth,
    V,
    Q,
    Cc,
    Cv,
    Cd: Cc * Cv,
    area,
    areaVena,
    // Vena contracta terbentuk kira-kira setengah tinggi bukaan di hilir bibir.
    xVena: 0.5 * a,
    headLoss: (Vth * Vth - V * V) / (2 * G),
    submerged: H >= a / 2,
    minHead: a / 2,
  };
}

/**
 * Lintasan pancaran mendatar dari sebuah lubang.
 *
 * Pancaran meninggalkan lubang mendatar dengan kecepatan V lalu jatuh bebas,
 * sehingga lintasannya parabola. Bila kecepatannya persis Torricelli, seluruh
 * ketergantungan pada gravitasi saling menghapus dan tersisa hubungan yang
 * bersih: x kuadrat sama dengan empat kali H kali y. Hubungan itulah yang
 * dipakai di laboratorium untuk mengukur koefisien kecepatan tanpa mengukur
 * kecepatan sama sekali, cukup dengan meteran.
 */
export function orificeTrajectory(V: number, x: number): number {
  if (V <= 0) return 0;
  return (G * x * x) / (2 * V * V);
}

/* ------------------------------------------------------------------ *
 * Venturi
 * ------------------------------------------------------------------ */

/** Koefisien debit venturi klasik dengan bagian menyempit hasil pemesinan. */
export const VENTURI_C_MACHINED = 0.995;
/** Koefisien debit venturi klasik dengan bagian menyempit hasil cor. */
export const VENTURI_C_CAST = 0.984;
/** Koefisien debit venturi dari pelat besi yang dilas kasar. */
export const VENTURI_C_WELDED = 0.985;

export type VenturiResult = {
  /** Perbandingan garis tengah leher terhadap pipa */
  beta: number;
  Q: number;
  /** Kecepatan di pipa dan di leher */
  V1: number;
  V2: number;
  /** Faktor kecepatan datang, satu dibagi akar satu dikurangi beta pangkat empat */
  approachFactor: number;
  /** Beda tinggi tekan yang terbaca pada manometer, meter */
  dh: number;
  C: number;
  /** Kehilangan tekanan tetap, ditaksir sebagai bagian dari beda tekanan */
  permanentLoss: number;
  outOfRange: boolean;
  reason: "" | "beta-kecil" | "beta-besar" | "bukan-venturi";
};

/** Batas bawah perbandingan garis tengah yang lazim dipakai pada venturi klasik. */
export const VENTURI_BETA_MIN = 0.3;
/** Batas atas perbandingan garis tengah yang lazim dipakai pada venturi klasik. */
export const VENTURI_BETA_MAX = 0.75;

/**
 * Debit yang lewat sebuah venturi dari beda tinggi tekan yang terbaca.
 *
 * Faktor kecepatan datang di dalam akar sering terlupa, dan melupakannya
 * membuat debit yang dihitung selalu lebih kecil daripada yang sebenarnya.
 * Besarnya kesalahan itu naik cepat terhadap perbandingan garis tengah: pada
 * beta 0,5 ia sekitar tiga persen, pada beta 0,75 sudah lebih dari dua puluh
 * persen.
 *
 * Rujukan: ISO 5167-4, tabung venturi klasik.
 */
export function venturiDischarge(
  /** Garis tengah pipa, meter */
  D1: number,
  /** Garis tengah leher, meter */
  D2: number,
  /** Beda tinggi tekan antara pipa dan leher, meter kolom air */
  dh: number,
  C: number
): VenturiResult {
  const beta = D1 > 0 ? D2 / D1 : 0;
  const A1 = (Math.PI / 4) * D1 * D1;
  const A2 = (Math.PI / 4) * D2 * D2;

  /*
   * Leher yang tidak lebih sempit daripada pipanya bukan venturi. Rumusnya
   * membagi dengan akar (1 - beta^4), yang nol pada beta satu dan khayal di
   * atasnya. Kalau dipaksa lewat pembatas kecil, keluarnya debit tiga juta
   * liter per detik dari pipa 200 mm, dan angka itu pernah keluar. Yang benar
   * adalah tidak ada debit yang dapat dihitung.
   */
  if (beta >= 1) {
    return {
      beta,
      Q: 0,
      V1: 0,
      V2: 0,
      approachFactor: 0,
      dh,
      C,
      permanentLoss: 0,
      outOfRange: true,
      reason: "bukan-venturi",
    };
  }

  const approachFactor = 1 / Math.sqrt(1 - Math.pow(beta, 4));
  const Q = C * approachFactor * A2 * Math.sqrt(2 * G * Math.max(dh, 0));

  const reason: VenturiResult["reason"] =
    beta < VENTURI_BETA_MIN
      ? "beta-kecil"
      : beta > VENTURI_BETA_MAX
        ? "beta-besar"
        : "";

  return {
    beta,
    Q,
    V1: A1 > 0 ? Q / A1 : 0,
    V2: A2 > 0 ? Q / A2 : 0,
    approachFactor,
    dh,
    C,
    // Kehilangan tetap venturi klasik jauh lebih kecil daripada pelat lubang,
    // dan itulah alasan utama orang memilihnya. Ditaksir dari beta.
    permanentLoss: dh * (0.218 - 0.42 * beta + 0.38 * beta * beta),
    outOfRange: reason !== "",
    reason,
  };
}

/** Beda tinggi tekan yang akan terbaca pada debit tertentu. */
export function venturiHead(
  D1: number,
  D2: number,
  Q: number,
  C: number
): number {
  const beta = D1 > 0 ? D2 / D1 : 0;
  const A2 = (Math.PI / 4) * D2 * D2;
  const approachFactor = 1 / Math.sqrt(Math.max(1 - Math.pow(beta, 4), 1e-9));
  const V = Q / (C * approachFactor * A2);
  return (V * V) / (2 * G);
}

/* ------------------------------------------------------------------ *
 * Tabung Pitot
 * ------------------------------------------------------------------ */

/**
 * Kecepatan setempat dari beda tinggi tekan sebuah tabung Pitot statik.
 *
 * Lubang depan menghadap aliran dan membacanya sampai berhenti, sehingga ia
 * membaca tekanan stagnasi. Lubang samping membaca tekanan statik. Selisih
 * keduanya persis tinggi kecepatan, dan itulah seluruh isi alat ini.
 */
export function pitotVelocity(dh: number, Cp = 1): number {
  return Cp * Math.sqrt(2 * G * Math.max(dh, 0));
}

/** Beda tinggi tekan yang akan terbaca pada kecepatan tertentu. */
export function pitotHead(V: number, Cp = 1): number {
  const Vk = Cp > 0 ? V / Cp : 0;
  return (Vk * Vk) / (2 * G);
}

/**
 * Kecepatan setempat pada jarak r dari sumbu pipa, menurut hukum pangkat.
 *
 * Bentuk pangkat satu per tujuh berlaku baik pada aliran turbulen di pipa licin
 * dengan bilangan Reynolds sedang. Ia tidak berlaku di dinding, tempat
 * turunannya menjadi tak hingga, dan tidak berlaku pada aliran laminar yang
 * profilnya parabola penuh.
 */
export function powerLawVelocity(
  r: number,
  R: number,
  uMax: number,
  n = 7
): number {
  if (R <= 0) return 0;
  const s = Math.max(0, 1 - Math.abs(r) / R);
  return uMax * Math.pow(s, 1 / n);
}

/**
 * Perbandingan kecepatan rata-rata terhadap kecepatan sumbu untuk hukum pangkat.
 *
 * Hasil tertutup dari mengintegrasikan profilnya pada penampang lingkaran:
 * dua n kuadrat dibagi n tambah satu kali dua n tambah satu. Untuk n sama
 * dengan tujuh nilainya 0,8167, dan angka itulah yang membuat satu bacaan di
 * sumbu pipa dapat diubah menjadi debit.
 */
export function powerLawMeanRatio(n = 7): number {
  return (2 * n * n) / ((n + 1) * (2 * n + 1));
}

/**
 * Jarak dari sumbu tempat kecepatan setempat sama dengan kecepatan rata-rata.
 *
 * Titik inilah yang dicari juru ukur bila hanya sempat mengambil satu bacaan.
 * Letaknya tidak di tengah dan tidak di dinding, melainkan pada pecahan tetap
 * dari jari-jari yang hanya bergantung pada pangkatnya.
 */
export function powerLawMeanRadius(R: number, n = 7): number {
  const rasio = powerLawMeanRatio(n);
  return R * (1 - Math.pow(rasio, n));
}

/* ------------------------------------------------------------------ *
 * Flum berleher panjang
 * ------------------------------------------------------------------ */

/**
 * Tetapan aliran kritis pada leher persegi, satuan SI.
 *
 * Nilainya dua per tiga pangkat satu setengah dikali akar percepatan gravitasi,
 * yaitu 1,7048. Ia bukan koefisien empiris melainkan akibat langsung dari dua
 * hal: aliran di leher melewati kondisi kritis, dan pada kondisi kritis
 * kedalaman persis dua per tiga tinggi energi.
 */
export const FLUME_C = Math.pow(2 / 3, 1.5) * Math.sqrt(G);

export type FlumeResult = {
  Q: number;
  /** Tinggi energi total di penampang ukur, meter */
  H1: number;
  /** Kedalaman kritis di leher, yaitu dua per tiga H1 */
  yc: number;
  /** Koefisien kecepatan datang, H1 dibagi h1 pangkat satu setengah */
  Cv: number;
  /** Bilangan Froude di penampang ukur */
  Fr1: number;
  /** Batas muka air hilir agar flum tetap bekerja bebas */
  tailLimit: number;
  /**
   * Benar bila leher benar-benar mengendalikan aliran. Salah bila lehernya
   * terlalu lebar untuk saluran datangnya, sehingga tidak ada tinggi energi
   * yang memenuhi persamaan kecepatan datang; pada keadaan itu tidak ada
   * debit yang dapat dihitung dari h1.
   */
  controlled: boolean;
  outOfRange: boolean;
  reason: "" | "HL-kecil" | "HL-besar" | "Fr-besar" | "tak-terkendali";
};

/** Batas bawah perbandingan tinggi energi terhadap panjang leher. */
export const FLUME_HL_MIN = 0.07;
/** Batas atas perbandingan tinggi energi terhadap panjang leher. */
export const FLUME_HL_MAX = 0.7;
/** Bilangan Froude terbesar di penampang ukur yang masih diizinkan ISO 4359. */
export const FLUME_FR_MAX = 0.5;

/**
 * Debit yang lewat sebuah flum berleher panjang berpenampang persegi.
 *
 * Kekuatan alat ini bukan pada ketelitian koefisiennya melainkan pada asalnya:
 * lehernya dibuat cukup panjang sehingga garis arus di dalamnya sejajar, dan
 * begitu itu terpenuhi, aliran kritis di leher menjadi hubungan yang dapat
 * diturunkan, bukan dikalibrasi. Itu sebabnya flum berleher panjang dapat
 * dirancang di atas kertas untuk bentuk penampang apa pun.
 *
 * Kecepatan datang ikut diperhitungkan lewat iterasi, karena tinggi energi
 * bergantung pada debit sedangkan debit bergantung pada tinggi energi.
 *
 * Rujukan: ISO 4359, flum berleher panjang berpenampang persegi.
 */
export function flumeDischarge(
  /** Tinggi muka air di atas mercu leher, terukur di penampang ukur */
  h1: number,
  /** Lebar leher, meter */
  bThroat: number,
  /** Lebar saluran datang, meter */
  bApproach: number,
  /** Tinggi mercu leher di atas dasar saluran datang, meter */
  p: number,
  /** Panjang leher searah aliran, meter */
  Lthroat: number,
  Cd: number
): FlumeResult {
  /*
   * Tinggi energi dan debit saling bergantung:
   *
   *   H1 = h1 + k H1^3,   k = (Cd C b)^2 / (2 g A1^2)
   *
   * Fungsi f(H) = H - h1 - k H^3 naik dari negatif di H = h1, memuncak di
   * H = 1/sqrt(3k), lalu turun. Akar yang berarti adalah yang terkecil, dan
   * ia ADA hanya bila puncaknya tidak negatif, yaitu k <= 4 / (27 h1^2).
   * Kalau tidak ada, lehernya terlalu lebar untuk saluran datangnya: aliran
   * datang tidak sanggup membawa debit yang diminta leher pada kedalaman itu,
   * dan lehernya bukan penampang kendali. Iterasi titik tetap yang dulu
   * dipakai tidak tahu itu; ia terus melipatgandakan sampai tak hingga.
   */
  const A1 = bApproach * (h1 + p);
  const k = A1 > 0 ? Math.pow(Cd * FLUME_C * bThroat, 2) / (2 * G * A1 * A1) : 0;
  const puncak = k > 0 ? 1 / Math.sqrt(3 * k) : Number.POSITIVE_INFINITY;
  const terkendali = h1 > 0 && (k === 0 || puncak - h1 - k * puncak * puncak * puncak >= 0);

  if (!terkendali) {
    return {
      Q: 0,
      H1: h1,
      yc: 0,
      Cv: 1,
      Fr1: 0,
      tailLimit: p,
      controlled: false,
      outOfRange: true,
      reason: "tak-terkendali",
    };
  }

  let lo = h1;
  let hi = Math.min(puncak, h1 * 50);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (mid - h1 - k * mid * mid * mid >= 0) hi = mid;
    else lo = mid;
    if (hi - lo < 1e-13) break;
  }
  const H1 = (lo + hi) / 2;
  const Q = Cd * FLUME_C * bThroat * Math.pow(H1, 1.5);
  const V1 = A1 > 0 ? Q / A1 : 0;
  const Fr1 = froude(V1, h1 + p);
  const rasioHL = Lthroat > 0 ? H1 / Lthroat : 0;

  const reason: FlumeResult["reason"] =
    Fr1 > FLUME_FR_MAX
      ? "Fr-besar"
      : rasioHL < FLUME_HL_MIN
        ? "HL-kecil"
        : rasioHL > FLUME_HL_MAX
          ? "HL-besar"
          : "";

  return {
    Q,
    H1,
    yc: (2 / 3) * H1,
    Cv: Math.pow(H1 / h1, 1.5),
    Fr1,
    // Flum berhenti bekerja bebas bila muka air hilir naik melewati kira-kira
    // tiga perempat tinggi energi di atas mercu.
    tailLimit: p + 0.75 * H1,
    controlled: true,
    outOfRange: reason !== "",
    reason,
  };
}

/* ------------------------------------------------------------------ *
 * Pengukuran pengenceran garam
 * ------------------------------------------------------------------ */

export type TracerPoint = {
  /** Waktu sejak penyuntikan, detik */
  t: number;
  /** Kepekatan di atas latar, satuan mg per liter */
  c: number;
};

export type TracerResult = {
  points: TracerPoint[];
  /** Kepekatan puncak di atas latar */
  cPeak: number;
  /** Waktu datangnya puncak, detik */
  tPeak: number;
  /** Luas di bawah kurva, satuan mg per liter dikali detik */
  area: number;
  /** Debit yang dihitung kembali dari luas kurva, meter kubik per detik */
  Qgulp: number;
  /** Waktu tempuh rata-rata, detik */
  tTravel: number;
  /** Lama awan tracer lewat, dihitung pada satu persen puncak */
  duration: number;
  /**
   * Bilangan Peclet, u L dibagi D. Menyatakan seberapa jauh angkutan arus
   * menguasai penyebaran. Penyelesaian satu dimensi yang dipakai di sini
   * hanya berlaku bila angkanya besar.
   */
  peclet: number;
  /** Benar bila penyebaran menguasai dan penyelesaian ini tidak berlaku */
  dispersionDominated: boolean;
};

/**
 * Bilangan Peclet terkecil yang masih membuat penyelesaian satu dimensi ini
 * sahih. Di bawah nilai ini awan tracer menyebar lebih cepat daripada ia
 * terbawa, sebagian massanya menjalar ke hulu titik suntik, dan luas kurva
 * di penampang ukur tidak lagi sama dengan massa dibagi debit. Diperiksa
 * dengan menghitung debit balik dari luas kurva pada 243 keadaan: di atas
 * sepuluh selisihnya tidak pernah melebihi 0,15 persen, di bawah satu ia
 * mencapai ratusan persen.
 */
export const TRACER_PECLET_MIN = 10;

/**
 * Awan tracer yang lewat di penampang ukur setelah penyuntikan sesaat.
 *
 * Bentuk kurvanya diselesaikan dari persamaan sebaran satu dimensi: awan
 * garam terbawa arus sambil melebar karena penyebaran memanjang. Yang penting
 * dari kurva ini bukan bentuknya melainkan LUASNYA, karena luas di bawah kurva
 * sama dengan massa yang disuntikkan dibagi debitnya, apa pun bentuk kurvanya.
 * Itulah yang membuat cara ini bekerja pada sungai berbatu yang penampangnya
 * tidak mungkin diukur.
 *
 * Rujukan: ISO 9555, pengukuran debit dengan tracer.
 */
export function tracerCurve(
  /** Debit sungai yang sebenarnya, meter kubik per detik */
  Q: number,
  /** Massa garam yang disuntikkan, kilogram */
  M: number,
  /** Jarak dari titik suntik ke penampang ukur, meter */
  L: number,
  /** Luas penampang rata-rata, meter persegi */
  A: number,
  /** Koefisien sebaran memanjang, meter persegi per detik */
  D: number,
  steps = 600
): TracerResult {
  const u = A > 0 ? Q / A : 0;
  const tTravel = u > 0 ? L / u : 0;

  /*
   * Rentang waktu dipilih dari lebar awannya sendiri, bukan dipatok, supaya
   * seluruh kurva selalu masuk berapa pun sebarannya.
   *
   * Batas bawahnya diambil sebagai pecahan dari waktu tempuh, bukan angka
   * tetap sepersepuluh detik. Pada sungai kecil yang cepat, waktu tempuhnya
   * sendiri sepersepuluh detik, dan batas tetap itu memotong separuh kurva
   * lalu melaporkan debit yang meleset delapan puluh persen.
   */
  const sigma = Math.sqrt((2 * D * tTravel) / Math.max(u * u, 1e-9));
  const t0 = Math.max(tTravel * 1e-6, tTravel - 6 * sigma);
  const t1 = tTravel + 6 * sigma;
  const dt = (t1 - t0) / steps;

  // Massa kilogram dibagi meter kubik menjadi kg per m3; dikali sejuta
  // menjadi mg per liter.
  const skala = ((M / A) * 1e6) / 1000;

  const points: TracerPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = t0 + i * dt;
    const c =
      t > 0
        ? (skala / Math.sqrt(4 * Math.PI * D * t)) *
          Math.exp(-Math.pow(L - u * t, 2) / (4 * D * t))
        : 0;
    points.push({ t, c });
  }

  let area = 0;
  for (let i = 1; i < points.length; i++) {
    area += ((points[i].c + points[i - 1].c) / 2) * (points[i].t - points[i - 1].t);
  }

  const puncak = points.reduce((m, p) => (p.c > m.c ? p : m), points[0]);
  const ambang = puncak.c * 0.01;
  const mulai = points.find((p) => p.c >= ambang);
  const habis = [...points].reverse().find((p) => p.c >= ambang);

  return {
    points,
    cPeak: puncak.c,
    tPeak: puncak.t,
    area,
    // Massa dalam kg menjadi mg, dibagi luas kurva dalam mg per liter kali
    // detik, menghasilkan liter per detik, lalu dibagi seribu menjadi m3/s.
    Qgulp: area > 0 ? (M * 1e6) / area / 1000 : 0,
    tTravel,
    duration: mulai && habis ? habis.t - mulai.t : 0,
    peclet: D > 0 ? (u * L) / D : Number.POSITIVE_INFINITY,
    dispersionDominated: D > 0 && (u * L) / D < TRACER_PECLET_MIN,
  };
}

/**
 * Debit dari penyuntikan laju tetap.
 *
 * Cara kedua pada standar yang sama, dan sering lebih disukai di lapangan
 * karena hanya perlu satu bacaan kepekatan setelah keadaan mantap tercapai,
 * bukan seluruh kurva.
 */
export function dilutionDischarge(
  /** Laju suntik, liter per detik */
  q: number,
  /** Kepekatan larutan yang disuntikkan, mg per liter */
  c1: number,
  /** Kepekatan mantap di penampang ukur, mg per liter */
  c2: number,
  /** Kepekatan latar sungai, mg per liter */
  c0: number
): number {
  const penyebut = c2 - c0;
  if (penyebut <= 0) return 0;
  // Hasilnya liter per detik, dibagi seribu menjadi meter kubik per detik.
  return (q * (c1 - c2)) / penyebut / 1000;
}

/**
 * Panjang pencampuran yang lazim disyaratkan sebelum penampang ukur.
 *
 * Bukan rumus melainkan patokan praktik: tracer harus sudah bercampur merata
 * di seluruh penampang, dan pada sungai kecil berbatu hal itu lazim dicapai
 * setelah beberapa puluh kali lebar sungainya. Angka ini dipakai di sini
 * sebagai penanda kelayakan, bukan sebagai hasil hitungan.
 */
export const TRACER_MIX_WIDTHS = 25;

/* ------------------------------------------------------------------ *
 * Kekentalan kinematik air
 * ------------------------------------------------------------------ */

/**
 * Kekentalan kinematik air tawar sebagai fungsi suhu, meter persegi per detik.
 *
 * Pendekatan Poiseuille yang lazim dikutip di buku ajar, berlaku baik pada
 * 0 sampai 40 derajat. Dipakai bersama oleh lembar pipa dan lembar sedimen,
 * jadi ditaruh di sini alih-alih diulang di tiap lembar.
 */
export function waterViscosity(TCelsius: number): number {
  return 1.79e-6 / (1 + 0.03368 * TCelsius + 0.000221 * TCelsius * TCelsius);
}

/* ------------------------------------------------------------------ *
 * Rumus Colebrook-White bentuk terbuka: bagan Wallingford
 * ------------------------------------------------------------------ */

export type WallingfordResult = {
  /** Kecepatan rata-rata pada pipa penuh, meter per detik */
  V: number;
  Q: number;
  Re: number;
  /** Faktor gesekan yang menyertai kecepatan itu */
  f: number;
  /** Kemiringan hidrolik, kehilangan tinggi tekan per satuan panjang */
  S: number;
  /** Benar bila alirannya belum turbulen sehingga bagan tidak berlaku */
  outOfRange: boolean;
};

/**
 * Kecepatan pada pipa penuh, langsung dari kemiringan hidrolik.
 *
 * Inilah yang membedakan bagan Wallingford dari diagram Moody. Moody menjawab
 * berapa faktor gesekannya dan masih menyisakan satu persamaan untuk
 * diselesaikan; bagan Wallingford menjawab berapa kecepatannya sekali jalan,
 * karena Colebrook-White dapat dibalik secara tertutup bila yang dicari
 * kecepatan dan bukan faktor gesekan:
 *
 *   V = -2 sqrt(2 g D S) log10[ ks / (3,7 D) + 2,51 nu / (D sqrt(2 g D S)) ]
 *
 * Tidak ada iterasi di dalamnya, dan itu bukan pendekatan melainkan hasil
 * penyusunan ulang yang tepat. Itu sebabnya bagan ini tetap dipakai di
 * lapangan lama setelah kalkulator tersedia.
 *
 * Rujukan: Colebrook (1939); HR Wallingford dan Barr, Tables for the
 * Hydraulic Design of Pipes, Sewers and Channels.
 */
export function wallingfordVelocity(
  /** Garis tengah dalam pipa, meter */
  D: number,
  /** Kemiringan hidrolik */
  S: number,
  /** Kekasaran mutlak dinding, meter */
  ks: number,
  /** Kekentalan kinematik, meter persegi per detik */
  nu: number
): WallingfordResult {
  const akar = Math.sqrt(2 * G * Math.max(D, 1e-9) * Math.max(S, 0));
  const arg = ks / (3.7 * D) + (2.51 * nu) / (D * Math.max(akar, 1e-12));
  const Vhitung = akar > 0 && arg > 0 ? -2 * akar * Math.log10(arg) : 0;
  const V = Math.max(Vhitung, 0);
  const A = (Math.PI / 4) * D * D;
  const Re = reynolds(V, D, nu);
  // Dibalik dari definisi Darcy-Weisbach, bukan dihitung ulang dari
  // Colebrook: dengan begitu f yang ditampilkan memang f yang menyertai V.
  const f = V > 0 ? (2 * G * D * S) / (V * V) : 0;
  return { V, Q: V * A, Re, f, S, outOfRange: Re < RE_TURBULENT_MIN };
}

/* ------------------------------------------------------------------ *
 * Hukum dinding
 * ------------------------------------------------------------------ */

/** Tetapan von Karman, diukur berulang kali sejak 1930-an. */
export const KARMAN = 0.41;
/** Tetapan penambah lapisan logaritmik untuk dinding licin. */
export const WALL_B = 5.0;
/** Batas atas lapisan kental dalam jarak tak berdimensi. */
export const WALL_VISCOUS_MAX = 5;
/** Batas bawah lapisan logaritmik. */
export const WALL_LOG_MIN = 30;

export type WallLayer = "kental" | "penyangga" | "logaritmik";

/**
 * Kecepatan tak berdimensi pada jarak tak berdimensi dari dinding.
 *
 * Dua hukum yang berlaku di dua daerah terpisah, dan di antaranya ada daerah
 * penyangga yang tidak dijelaskan oleh keduanya:
 *
 *   u+ = y+                 untuk y+ di bawah 5, lapisan kental
 *   u+ = (1/k) ln y+ + B    untuk y+ di atas 30, lapisan logaritmik
 *
 * Yang dikembalikan di sini nilai kedua hukum itu masing-masing, bukan satu
 * kurva mulus yang menyambungkannya. Menyambungkannya dengan rumus antara
 * justru menyembunyikan hal terpenting dari lembar ini: di daerah penyangga
 * tidak ada hukum sederhana yang berlaku, dan itu kenyataan, bukan kekurangan
 * penggambaran.
 *
 * Rujukan: Nikuradse (1932); Schlichting, Boundary-Layer Theory, Bab 17.
 */
export function wallLaw(
  yPlus: number,
  /**
   * Tetapan dapat diganti karena bukan satu pasang saja yang beredar. Pasangan
   * 0,41 dan 5,0 dipakai di lembar ini; pasangan lama 0,40 dan 5,5 masih
   * sering dikutip, dan titik potong 11,6 yang terkenal itu berasal dari
   * pasangan lama, bukan dari yang dipakai di sini.
   */
  kappa = KARMAN,
  B = WALL_B
): {
  viscous: number;
  log: number;
  layer: WallLayer;
} {
  const y = Math.max(yPlus, 1e-9);
  return {
    viscous: y,
    log: (1 / kappa) * Math.log(y) + B,
    layer:
      y < WALL_VISCOUS_MAX
        ? "kental"
        : y >= WALL_LOG_MIN
          ? "logaritmik"
          : "penyangga",
  };
}

/** Kecepatan gesek dari tegangan geser dinding dan rapat massa. */
export function frictionVelocity(tauWall: number, rho = 1000): number {
  return Math.sqrt(Math.max(tauWall, 0) / rho);
}

/** Tebal lapisan kental dalam satuan panjang, yaitu y+ = 5. */
export function viscousSublayer(uStar: number, nu: number): number {
  return uStar > 0 ? (WALL_VISCOUS_MAX * nu) / uStar : 0;
}

/* ------------------------------------------------------------------ *
 * Hukum gesekan: Chezy, Manning, Darcy-Weisbach
 * ------------------------------------------------------------------ */

/**
 * Koefisien Chezy dari angka kekasaran Manning: C = R^(1/6) / n.
 *
 * Perhatikan bahwa C bergantung pada jari-jari hidrolik sedangkan n dianggap
 * tidak. Itulah perbedaan pokok keduanya, dan sebabnya angka n yang
 * dikalibrasi pada satu ukuran saluran tidak otomatis berlaku pada ukuran
 * yang lain.
 */
export function chezyFromManning(n: number, R: number): number {
  return n > 0 ? Math.pow(Math.max(R, 1e-9), 1 / 6) / n : 0;
}

/** Koefisien Chezy dari faktor gesekan Darcy: C = sqrt(8 g / f). */
export function chezyFromDarcy(f: number): number {
  return f > 0 ? Math.sqrt((8 * G) / f) : 0;
}

/** Faktor gesekan Darcy dari koefisien Chezy. */
export function darcyFromChezy(C: number): number {
  return C > 0 ? (8 * G) / (C * C) : 0;
}

/**
 * Angka Manning dari kekasaran butir menurut Strickler: n = ks^(1/6) / 21,1.
 *
 * Hubungan inilah yang menjembatani dunia pipa, yang memakai kekasaran
 * mutlak, dengan dunia saluran terbuka, yang memakai angka kekasaran.
 */
export function stricklerN(ks: number): number {
  return Math.pow(Math.max(ks, 1e-12), 1 / 6) / 21.1;
}

/** Kecepatan aliran seragam menurut Chezy: V = C sqrt(R S). */
export function chezyVelocity(C: number, R: number, S: number): number {
  return C * Math.sqrt(Math.max(R, 0) * Math.max(S, 0));
}

/* ------------------------------------------------------------------ *
 * Kurva Shields
 * ------------------------------------------------------------------ */

/** Rapat massa jenis butir terhadap air, nilai lazim untuk kuarsa. */
export const SEDIMENT_S = 2.65;

/**
 * Ukuran butir tak berdimensi.
 *
 *   D* = d [ (s-1) g / nu^2 ]^(1/3)
 *
 * Dipakai sebagai sumbu mendatar kurva Shields bentuk modern, menggantikan
 * bilangan Reynolds butir. Bentuk aslinya tidak dapat dibaca langsung karena
 * sumbu mendatarnya mengandung kecepatan gesek, yaitu besaran yang justru
 * sedang dicari, sehingga pemakaiannya menuntut iterasi di atas kertas.
 */
export function dimensionlessGrain(d: number, s: number, nu: number): number {
  return d * Math.pow(((s - 1) * G) / (nu * nu), 1 / 3);
}

/**
 * Tegangan geser kritis tak berdimensi, bentuk tertutup Soulsby-Whitehouse:
 *
 *   theta_cr = 0,30 / (1 + 1,2 D*) + 0,055 [ 1 - exp(-0,02 D*) ]
 *
 * Mengikuti pita data asli Shields tanpa iterasi, dan menuju 0,055 pada butir
 * kasar, nilai dataran yang sudah dikenal sejak Shields sendiri.
 *
 * Rujukan: Soulsby dan Whitehouse (1997); Shields (1936).
 */
export function shieldsCritical(dStar: number): number {
  const D = Math.max(dStar, 1e-9);
  return 0.3 / (1 + 1.2 * D) + 0.055 * (1 - Math.exp(-0.02 * D));
}

/** Nilai dataran kurva Shields pada butir kasar. */
export const SHIELDS_PLATEAU = 0.055;

export type ShieldsResult = {
  dStar: number;
  /** Tegangan geser tak berdimensi yang bekerja */
  theta: number;
  thetaCritical: number;
  /** Tegangan geser dasar yang bekerja, pascal */
  tau: number;
  /** Tegangan geser dasar yang baru menggerakkan butir, pascal */
  tauCritical: number;
  /** Kedalaman terbesar yang masih membiarkan butir diam, meter */
  RCritical: number;
  moving: boolean;
};

/**
 * Apakah butir bergerak pada kedalaman dan kemiringan tertentu.
 *
 * Tegangan geser dasar diambil dari bentuk aliran seragam, tau = rho g R S,
 * yang berlaku bila alirannya mantap dan seragam. Perbandingannya terhadap
 * tegangan kritis itulah yang dinamakan bilangan Shields.
 */
export function shieldsState(
  /** Jari-jari hidrolik atau kedalaman, meter */
  R: number,
  /** Kemiringan dasar */
  S: number,
  /** Garis tengah butir, meter */
  d: number,
  /** Rapat massa jenis butir terhadap air */
  s: number,
  nu: number,
  rho = 1000
): ShieldsResult {
  const dStar = dimensionlessGrain(d, s, nu);
  const thetaCritical = shieldsCritical(dStar);
  const tau = rho * G * Math.max(R, 0) * Math.max(S, 0);
  const penyebut = (s - 1) * rho * G * Math.max(d, 1e-12);
  const tauCritical = thetaCritical * penyebut;
  return {
    dStar,
    theta: tau / penyebut,
    thetaCritical,
    tau,
    tauCritical,
    RCritical: S > 0 ? tauCritical / (rho * G * S) : Number.POSITIVE_INFINITY,
    moving: tau > tauCritical,
  };
}

/* ------------------------------------------------------------------ *
 * Kecepatan endap butir
 * ------------------------------------------------------------------ */

/**
 * Kecepatan endap butir bulat di air diam, bentuk tertutup Ferguson-Church.
 *
 *   ws = (s-1) g d^2 / [ C1 nu + sqrt(0,75 C2 (s-1) g d^3) ]
 *
 * Satu rumus untuk seluruh rentang ukuran, dari lanau sampai kerikil. Pada
 * butir halus suku pertama penyebutnya menguasai dan hasilnya kembali menjadi
 * hukum Stokes; pada butir kasar suku kedua yang menguasai dan hasilnya
 * menjadi hukum seret tetap. Tidak ada peralihan yang harus dipilih tangan,
 * dan tidak ada iterasi.
 *
 * C1 = 18 dan C2 = 1,0 untuk butir bulat halus; C2 sekitar 1,0 sampai 1,2
 * untuk pasir alam bersudut.
 *
 * Rujukan: Ferguson & Church (2004), A simple universal equation for grain
 * settling velocity, Journal of Sedimentary Research vol. 74.
 */
export function settlingVelocity(
  /** Garis tengah butir, meter */
  d: number,
  /** Rapat massa jenis butir terhadap air */
  s: number,
  nu: number,
  C1 = 18,
  C2 = 1.0
): number {
  const R = (s - 1) * G;
  const atas = R * d * d;
  const bawah = C1 * nu + Math.sqrt(0.75 * C2 * R * d * d * d);
  return bawah > 0 ? atas / bawah : 0;
}

/* ------------------------------------------------------------------ *
 * Profil Rouse
 * ------------------------------------------------------------------ */

/** Perbandingan sebaran pusaran sedimen terhadap momentum, lazim dipakai 1. */
export const ROUSE_BETA = 1;

/**
 * Bilangan Rouse, Z = ws / (beta kappa u*).
 *
 * Satu angka yang menentukan seluruh bentuk sebaran sedimen melayang.
 * Besar berarti butir kalah cepat mengendap dibanding diangkat pusaran,
 * sehingga sedimennya menumpuk di dekat dasar; kecil berarti sebarannya
 * hampir merata sepanjang kedalaman.
 */
export function rouseNumber(
  ws: number,
  uStar: number,
  beta = ROUSE_BETA,
  kappa = KARMAN
): number {
  return uStar > 0 ? ws / (beta * kappa * uStar) : Number.POSITIVE_INFINITY;
}

/**
 * Kepekatan nisbi pada ketinggian y, terhadap kepekatan acuan di ketinggian a.
 *
 *   c/ca = [ (h - y)/y * a/(h - a) ]^Z
 *
 * Turunan dari keseimbangan antara pengendapan ke bawah dan sebaran pusaran
 * ke atas, dengan andaian sebaran pusaran berbentuk parabola sepanjang
 * kedalaman. Nilainya satu tepat pada y = a menurut definisinya.
 *
 * Rujukan: Rouse (1937); Vanoni (1975), Sedimentation Engineering, Bab 2.
 */
export function rouseConcentration(
  /** Ketinggian di atas dasar, meter */
  y: number,
  /** Kedalaman aliran, meter */
  h: number,
  /** Ketinggian acuan di atas dasar, meter */
  a: number,
  Z: number
): number {
  if (y <= 0 || y >= h || a <= 0 || a >= h) return 0;
  const basis = ((h - y) / y) * (a / (h - a));
  return Math.pow(Math.max(basis, 0), Z);
}

export type RouseResult = {
  ws: number;
  Z: number;
  /** Cara angkut yang berlaku pada bilangan Rouse itu */
  mode: "melayang-penuh" | "melayang-sebagian" | "dasar" | "tidak-terangkut";
  /** Perbandingan kepekatan di setengah kedalaman terhadap acuan */
  midRatio: number;
  /** Bagian muatan yang berada di separuh bawah kedalaman */
  lowerHalf: number;
};

/**
 * Batas bilangan Rouse yang lazim dipakai untuk menggolongkan cara angkut.
 *
 * Batas-batas ini kesepakatan lapangan, bukan hasil turunan, dan penulis
 * yang berbeda memakai angka yang sedikit berbeda. Ditulis di satu tempat
 * supaya dapat diperdebatkan sekali, bukan tersebar di beberapa lembar.
 */
export const ROUSE_FULL = 0.8;
export const ROUSE_PARTIAL = 1.2;
export const ROUSE_BEDLOAD = 2.5;

export function rouseState(
  d: number,
  s: number,
  nu: number,
  uStar: number,
  h: number,
  a: number
): RouseResult {
  const ws = settlingVelocity(d, s, nu);
  const Z = rouseNumber(ws, uStar);
  const mode =
    Z < ROUSE_FULL
      ? "melayang-penuh"
      : Z < ROUSE_PARTIAL
        ? "melayang-sebagian"
        : Z < ROUSE_BEDLOAD
          ? "dasar"
          : "tidak-terangkut";

  // Bagian muatan di separuh bawah, dihitung dengan aturan trapesium pada
  // seratus pias. Pias dipilih tetap supaya angkanya tidak bergoyang saat
  // slider digeser.
  let bawah = 0;
  let total = 0;
  const n = 200;
  for (let i = 1; i < n; i++) {
    const y1 = a + ((h - a) * (i - 1)) / n;
    const y2 = a + ((h - a) * i) / n;
    const c1 = rouseConcentration(y1, h, a, Z);
    const c2 = rouseConcentration(y2, h, a, Z);
    const luas = ((c1 + c2) / 2) * (y2 - y1);
    total += luas;
    if (y2 <= h / 2) bawah += luas;
  }

  return {
    ws,
    Z,
    mode,
    midRatio: rouseConcentration(h / 2, h, a, Z),
    lowerHalf: total > 0 ? bawah / total : 1,
  };
}

/* ------------------------------------------------------------------ *
 * Erosi, angkutan, dan pengendapan: diagram Hjulstrom
 * ------------------------------------------------------------------ */

export type HjulstromResult = {
  /** Kecepatan rata-rata yang baru mengangkat butir dari dasar, m/s */
  erosion: number;
  /** Kecepatan rata-rata yang baru tidak sanggup lagi mengangkut, m/s */
  deposition: number;
  /** Kecepatan yang baru membuat butir melayang, ws = u* */
  suspension: number;
  state: "mengendap" | "terangkut" | "tererosi";
  /** Benar bila butirnya kohesif sehingga kurva erosi tidak berlaku */
  cohesive: boolean;
};

/** Batas bawah butir lepas; di bawahnya gaya tarik antar butir menguasai. */
export const COHESIVE_LIMIT = 0.00006;

/**
 * Tiga kecepatan penentu nasib satu butir, dinyatakan sebagai kecepatan
 * rata-rata penampang alih-alih tegangan geser.
 *
 * Kurva erosi diturunkan dari ambang Shields, bukan dibaca dari gambar
 * Hjulstrom asli: tegangan geser kritis diubah menjadi kecepatan rata-rata
 * lewat koefisien Chezy, sehingga lembar ini tetap satu bangunan dengan
 * lembar Shields dan tidak memakai dua sumber yang bisa bertentangan.
 *
 * Kurva pengendapan diturunkan dari kecepatan endap dengan cara yang sama.
 * Kurva melayang adalah tempat kecepatan gesek menyamai kecepatan endap,
 * yaitu bilangan Rouse sama dengan satu per kappa.
 *
 * Rujukan: Hjulstrom (1935); Sundborg (1956); Shields (1936).
 */
export function hjulstrom(
  /** Garis tengah butir, meter */
  d: number,
  /** Kedalaman aliran, meter */
  h: number,
  /** Kecepatan rata-rata penampang yang sedang berlangsung, m/s */
  V: number,
  s: number,
  nu: number,
  /** Angka kekasaran Manning dasar */
  n = 0.025,
  rho = 1000
): HjulstromResult {
  const C = chezyFromManning(n, h);
  // V = C sqrt(R S) dan tau = rho g R S, jadi tau = rho g V^2 / C^2.
  const VdariTau = (tau: number) =>
    C > 0 ? Math.sqrt((tau * C * C) / (rho * G)) : 0;

  const dStar = dimensionlessGrain(d, s, nu);
  const tauCr = shieldsCritical(dStar) * (s - 1) * rho * G * d;
  const ws = settlingVelocity(d, s, nu);

  /*
   * Butir berhenti terangkut ketika kecepatan gesek turun di bawah kira-kira
   * seperlima kecepatan endapnya. Angka itu kesepakatan lapangan yang lazim,
   * dan ia masuk akal untuk butir halus yang diangkut melayang.
   *
   * Untuk butir kasar ukuran itu berlebihan: seperlima kecepatan endap
   * kerikil melampaui tegangan yang baru mengangkatnya dari dasar, sehingga
   * kurva pengendapan akan memotong ke atas kurva erosi. Itu tidak mungkin,
   * karena butir tidak dapat mengendap pada aliran yang masih sanggup
   * mengerosinya. Karena itu ambangnya ditahan pada tegangan kritis: pada
   * butir kasar kedua kurva menyatu, dan penyatuan itu memang bentuk yang
   * ditunjukkan diagram Hjulstrom asli di sisi kanannya.
   */
  const tauEndap = Math.min(rho * Math.pow(ws / 5, 2), tauCr);
  // Melayang penuh ketika kecepatan gesek menyamai kecepatan endap.
  const tauSuspensi = rho * ws * ws;

  const tauKerja = C > 0 ? (rho * G * V * V) / (C * C) : 0;

  return {
    erosion: VdariTau(tauCr),
    deposition: VdariTau(tauEndap),
    suspension: VdariTau(tauSuspensi),
    state:
      tauKerja >= tauCr
        ? "tererosi"
        : tauKerja >= tauEndap
          ? "terangkut"
          : "mengendap",
    cohesive: d < COHESIVE_LIMIT,
  };
}

/* ------------------------------------------------------------------ *
 * Bak sedimentasi
 * ------------------------------------------------------------------ */

export type BasinResult = {
  /** Laju limpah, yaitu debit dibagi luas permukaan, m/s */
  overflowRate: number;
  /** Perbandingan kecepatan endap terhadap laju limpah */
  ratio: number;
  /** Efisiensi menurut bak ideal Hazen, 0 sampai 1 */
  idealEfficiency: number;
  /** Efisiensi dengan pengadukan menyeluruh, rumus Hazen bentuk pangkat */
  mixedEfficiency: number;
  ws: number;
  /** Waktu tinggal rata-rata, detik */
  residence: number;
  /** Panjang terpendek yang masih meloloskan butir mengendap, meter */
  minLength: number;
  /** Benar bila alirannya terlalu deras sehingga endapan tergerus lagi */
  scouring: boolean;
};

/**
 * Bilangan Hazen bentuk pangkat untuk bak yang terganggu pengadukan.
 *
 *   eta = 1 - (1 + ws / (n Q/A))^(-n)
 *
 * n di sini banyaknya bak seri semu, bukan angka Manning: n = 1 berarti bak
 * teraduk sempurna, n menuju tak hingga berarti bak ideal tanpa pengadukan.
 * Nilai 3 sampai 8 lazim dipakai untuk bak lapangan.
 */
export function hazenEfficiency(ratio: number, tanks: number): number {
  if (ratio <= 0) return 0;
  return 1 - Math.pow(1 + ratio / tanks, -tanks);
}

/**
 * Bak sedimentasi persegi panjang aliran mendatar.
 *
 * Yang menentukan efisiensi bak ideal bukan kedalamannya melainkan LUAS
 * PERMUKAANNYA, dan kesimpulan berlawanan naluri itulah isi lembar ini.
 * Memperdalam bak menambah waktu tinggal, tetapi juga menambah jarak yang
 * harus ditempuh butir untuk sampai ke dasar, dan keduanya persis saling
 * menghapus.
 *
 * Rujukan: Hazen (1904); Camp (1946); Metcalf & Eddy, Wastewater Engineering.
 */
export function settlingBasin(
  Q: number,
  /** Panjang bak searah aliran, meter */
  L: number,
  /** Lebar bak, meter */
  B: number,
  /** Kedalaman air di bak, meter */
  H: number,
  d: number,
  s: number,
  nu: number,
  tanks = 4
): BasinResult {
  const ws = settlingVelocity(d, s, nu);
  const A = L * B;
  const overflowRate = A > 0 ? Q / A : Number.POSITIVE_INFINITY;
  const ratio = overflowRate > 0 ? ws / overflowRate : Number.POSITIVE_INFINITY;
  const V = B * H > 0 ? Q / (B * H) : 0;

  // Endapan tergerus kembali bila kecepatan mendatarnya melampaui kira-kira
  // dua puluh kali kecepatan endap; batas kasar Camp yang lazim dipakai.
  const scouring = ws > 0 && V > 20 * ws;

  return {
    overflowRate,
    ratio,
    idealEfficiency: Math.min(ratio, 1),
    mixedEfficiency: hazenEfficiency(ratio, tanks),
    ws,
    residence: Q > 0 ? (L * B * H) / Q : Number.POSITIVE_INFINITY,
    minLength: ws > 0 && B > 0 ? Q / (B * ws) : Number.POSITIVE_INFINITY,
    scouring,
  };
}

/* ------------------------------------------------------------------ *
 * Hidrograf satuan sintetis dan limpasan
 * ------------------------------------------------------------------ */

export type HydrographPoint = {
  /** Waktu sejak hujan mulai, jam */
  t: number;
  /** Hujan efektif pada pias itu, mm per jam */
  rain: number;
  /** Debit sungai, meter kubik per detik */
  Q: number;
};

export type HydrographResult = {
  points: HydrographPoint[];
  /** Debit puncak, meter kubik per detik */
  peak: number;
  /** Waktu puncak sejak hujan mulai, jam */
  peakTime: number;
  /** Waktu naik hidrograf satuan, jam */
  tp: number;
  /** Debit puncak hidrograf satuan, m3/s per mm */
  qp: number;
  /** Hujan efektif seluruhnya, mm */
  effectiveRain: number;
  /** Isi hidrograf, meter kubik */
  volume: number;
  /** Kedalaman limpasan yang dihitung balik dari isi hidrograf, mm */
  runoffDepth: number;
  /** Benar bila hujannya lebih pendek daripada seperlima waktu naik */
  burstTooShort: boolean;
};

/**
 * Kehilangan hujan menurut bilangan kurva SCS.
 *
 *   S = 25400/CN - 254  (mm),  Ia = 0,2 S
 *   Pe = (P - Ia)^2 / (P - Ia + S)  bila P melebihi Ia, selain itu nol
 *
 * Bilangan kurva menyatukan jenis tanah, tutupan lahan, dan keadaan lembap
 * sebelumnya ke dalam satu angka antara 30 dan 100. Angka itu tidak punya
 * makna fisis sendiri; ia pengenal baris pada tabel yang disusun dari ribuan
 * petak percobaan.
 *
 * Rujukan: USDA NRCS, National Engineering Handbook Bagian 630 Bab 10.
 */
export function scsEffectiveRain(P: number, CN: number): number {
  const S = 25400 / Math.min(Math.max(CN, 1), 100) - 254;
  const Ia = 0.2 * S;
  if (P <= Ia) return 0;
  return Math.pow(P - Ia, 2) / (P - Ia + S);
}

/** Simpanan maksimum menurut bilangan kurva, mm. */
export function scsStorage(CN: number): number {
  return 25400 / Math.min(Math.max(CN, 1), 100) - 254;
}

/**
 * Hidrograf satuan segitiga SCS pada waktu t.
 *
 * Bentuknya segitiga dengan waktu naik tp dan waktu turun 1,67 tp, sehingga
 * waktu dasarnya 2,67 tp. Luasnya persis satu milimeter limpasan di atas
 * seluruh daerah aliran, dan itulah yang menentukan tinggi puncaknya:
 *
 *   qp = 0,208 A / tp    dengan A dalam km2, tp dalam jam, qp dalam m3/s/mm
 *
 * Tetapan 0,208 bukan pilihan bebas melainkan akibat langsung dari
 * perbandingan sisi segitiga itu:
 *
 *   luas segitiga = 0,5 qp (2,67 tp) jam = 1,335 qp tp jam
 *   satu milimeter di atas A km2 = 1000 A meter kubik
 *   1,335 qp tp x 3600 = 1000 A  memberi  qp = 0,208 A / tp
 *
 * Angka 2,08 yang juga beredar berlaku bila limpasannya dinyatakan dalam
 * sentimeter, bukan milimeter. Keduanya benar pada satuannya masing-masing,
 * dan tertukar sepuluh kali lipat bila tidak diperiksa.
 */
export function scsUnitHydrograph(t: number, tp: number): number {
  if (t <= 0 || tp <= 0) return 0;
  const tb = 2.67 * tp;
  if (t >= tb) return 0;
  return t <= tp ? t / tp : (tb - t) / (tb - tp);
}

/** Debit puncak hidrograf satuan, meter kubik per detik tiap milimeter. */
export function scsPeakRate(areaKm2: number, tp: number): number {
  return tp > 0 ? (0.208 * areaKm2) / tp : 0;
}

/**
 * Hidrograf banjir dari hujan merata, lewat hidrograf satuan SCS.
 *
 * Hujan efektif dibagi menjadi pias sejam, tiap pias menghasilkan hidrograf
 * satuannya sendiri yang digeser waktunya, lalu seluruhnya dijumlahkan. Itu
 * asas superposisi, dan ia berlaku karena hidrograf satuan mengandaikan
 * tanggapan daerah aliran itu linear terhadap besarnya hujan.
 *
 * Rujukan: Chow, Maidment & Mays (1988), Applied Hydrology, Bab 7.
 */
export function floodHydrograph(
  /** Hujan total, mm */
  P: number,
  /** Lama hujan, jam */
  duration: number,
  CN: number,
  /** Luas daerah aliran, kilometer persegi */
  areaKm2: number,
  /** Waktu tempuh terpanjang di daerah aliran, jam */
  tc: number,
  steps = 400
): HydrographResult {
  const Pe = scsEffectiveRain(P, CN);
  // Waktu naik hidrograf satuan untuk pias hujan sejam: tp = 0,5 dt + 0,6 tc.
  const dtPias = 1;
  const tp = 0.5 * dtPias + 0.6 * tc;
  const qp = scsPeakRate(areaKm2, tp);
  const tb = 2.67 * tp;

  const nPias = Math.max(1, Math.round(duration / dtPias));
  const perPias = Pe / nPias;
  const tAkhir = duration + tb;
  const dt = tAkhir / steps;

  const points: HydrographPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i * dt;
    let Q = 0;
    for (let k = 0; k < nPias; k++) {
      Q += perPias * qp * scsUnitHydrograph(t - k * dtPias, tp);
    }
    points.push({
      t,
      rain: t < duration ? P / duration : 0,
      Q,
    });
  }

  let volume = 0;
  for (let i = 1; i < points.length; i++) {
    volume +=
      ((points[i].Q + points[i - 1].Q) / 2) * (points[i].t - points[i - 1].t) * 3600;
  }

  const puncak = points.reduce((m, p) => (p.Q > m.Q ? p : m), points[0]);

  return {
    points,
    peak: puncak.Q,
    peakTime: puncak.t,
    tp,
    qp,
    effectiveRain: Pe,
    volume,
    runoffDepth: areaKm2 > 0 ? (volume / (areaKm2 * 1e6)) * 1000 : 0,
    burstTooShort: duration < tp / 5,
  };
}

/* ------------------------------------------------------------------ *
 * Penelusuran waduk
 * ------------------------------------------------------------------ */

export type RoutingPoint = {
  t: number;
  /** Debit masuk, meter kubik per detik */
  inflow: number;
  /** Debit keluar, meter kubik per detik */
  outflow: number;
  /** Tinggi muka air di atas mercu pelimpah, meter */
  head: number;
  /** Tampungan di atas mercu, meter kubik */
  storage: number;
};

export type RoutingResult = {
  points: RoutingPoint[];
  /** Puncak debit masuk */
  inflowPeak: number;
  /** Puncak debit keluar */
  outflowPeak: number;
  /** Bagian puncak yang teredam, 0 sampai 1 */
  attenuation: number;
  /** Selang waktu antara kedua puncak, jam */
  lag: number;
  /** Tinggi muka air tertinggi di atas mercu, meter */
  maxHead: number;
  /** Tampungan terbesar yang terpakai, meter kubik */
  maxStorage: number;
  /** Benar bila muka air melampaui tinggi jagaan yang tersedia */
  overtops: boolean;
};

/**
 * Penelusuran banjir lewat waduk dengan cara tampungan-keluaran.
 *
 * Persamaan kekekalan isi diselesaikan langkah demi langkah:
 *
 *   (I1 + I2)/2 - (O1 + O2)/2 = (S2 - S1) / dt
 *
 * Bentuk ini melibatkan O2 dan S2 yang sama-sama belum diketahui, dan
 * keduanya terikat oleh satu hubungan: tampungan dan keluaran sama-sama
 * fungsi tinggi muka air. Karena itu tiap langkah diselesaikan dengan bagi
 * dua atas tinggi muka air, bukan dengan tabel tampungan-keluaran yang harus
 * disiapkan lebih dulu seperti pada cara Puls di atas kertas.
 *
 * Pelimpah dianggap ambang bebas lebar tetap, O = Cd b sqrt(2g) (2/3) h^1,5,
 * dan tampungan dianggap berbanding lurus dengan luas genangan tetap.
 *
 * Rujukan: Chow, Maidment & Mays (1988), Applied Hydrology, Bab 8.
 */
export function reservoirRouting(
  inflow: { t: number; Q: number }[],
  /** Luas genangan waduk pada muka air mercu, meter persegi */
  surfaceArea: number,
  /** Lebar mercu pelimpah, meter */
  crestWidth: number,
  /** Tinggi jagaan di atas mercu sampai puncak bendungan, meter */
  freeboard: number,
  Cd = 0.6
): RoutingResult {
  const keluar = (h: number) =>
    h <= 0 ? 0 : (2 / 3) * Cd * crestWidth * Math.sqrt(2 * G) * Math.pow(h, 1.5);
  const tampung = (h: number) => Math.max(h, 0) * surfaceArea;

  const points: RoutingPoint[] = [];
  let h = 0;
  points.push({
    t: inflow[0]?.t ?? 0,
    inflow: inflow[0]?.Q ?? 0,
    outflow: 0,
    head: 0,
    storage: 0,
  });

  for (let i = 1; i < inflow.length; i++) {
    const dt = (inflow[i].t - inflow[i - 1].t) * 3600;
    const I1 = inflow[i - 1].Q;
    const I2 = inflow[i].Q;
    const O1 = keluar(h);
    const S1 = tampung(h);

    // Yang dicari h2 yang memenuhi:
    //   S(h2) + dt O(h2)/2 = S1 - dt O1/2 + dt (I1 + I2)/2
    const kanan = S1 - (dt * O1) / 2 + (dt * (I1 + I2)) / 2;
    let lo = 0;
    let hi = Math.max(h * 2, 1);
    while (tampung(hi) + (dt * keluar(hi)) / 2 < kanan && hi < 1e4) hi *= 2;
    for (let k = 0; k < 200; k++) {
      const mid = (lo + hi) / 2;
      if (tampung(mid) + (dt * keluar(mid)) / 2 < kanan) lo = mid;
      else hi = mid;
      if (hi - lo < 1e-12) break;
    }
    h = (lo + hi) / 2;

    points.push({
      t: inflow[i].t,
      inflow: I2,
      outflow: keluar(h),
      head: h,
      storage: tampung(h),
    });
  }

  const puncakMasuk = points.reduce((m, p) => (p.inflow > m.inflow ? p : m), points[0]);
  const puncakKeluar = points.reduce(
    (m, p) => (p.outflow > m.outflow ? p : m),
    points[0]
  );
  const maxHead = points.reduce((m, p) => Math.max(m, p.head), 0);

  return {
    points,
    inflowPeak: puncakMasuk.inflow,
    outflowPeak: puncakKeluar.outflow,
    attenuation:
      puncakMasuk.inflow > 0
        ? 1 - puncakKeluar.outflow / puncakMasuk.inflow
        : 0,
    lag: puncakKeluar.t - puncakMasuk.t,
    maxHead,
    maxStorage: points.reduce((m, p) => Math.max(m, p.storage), 0),
    overtops: maxHead > freeboard,
  };
}

/* ------------------------------------------------------------------ *
 * EH-04 Daya renang ikan
 * ------------------------------------------------------------------ */

export type SwimResult = {
  /** Lama ikan sanggup bertahan pada kecepatan itu, detik */
  endurance: number;
  /** Kecepatan jelajah, sanggup dipertahankan tanpa batas, m/s */
  sustained: number;
  /** Kecepatan yang hanya sanggup dipertahankan dua puluh detik, m/s */
  burst: number;
  /** Kecepatan maju bersih terhadap dasar bila berenang sentak, m/s */
  groundSpeed: number;
  /**
   * Jarak terjauh yang dapat ditempuh melawan arus itu, meter.
   *
   * Dihitung pada satu andaian yang tetap: ikan berenang pada kecepatan
   * sentaknya, yang menurut kesepakatan hanya sanggup dipertahankan dua puluh
   * detik. Angka inilah yang dipakai merancang panjang gorong-gorong dan
   * jarak antar kolam pada lintasan ikan.
   */
  distance: number;
  mode: "jelajah" | "berkelanjutan" | "sentak" | "tidak-mampu";
};

/**
 * Batas antara ketiga cara berenang, dinyatakan dalam panjang tubuh per detik.
 *
 * Batas-batas ini kesepakatan dari kumpulan percobaan berenang, bukan hasil
 * turunan, dan penulis yang berbeda memakai angka yang sedikit berbeda.
 * Ditulis di satu tempat supaya dapat diperdebatkan sekali.
 */
export const SWIM_SUSTAINED_BL = 2;
export const SWIM_BURST_BL = 10;
/** Lama yang dipakai sebagai batas kecepatan sentak, detik. */
export const SWIM_BURST_TIME = 20;
/** Lama yang dianggap tak terhingga untuk kecepatan jelajah, detik. */
export const SWIM_SUSTAINED_TIME = 200 * 60;

/**
 * Daya tahan ikan melawan arus, hubungan kecepatan dengan lama bertahan.
 *
 * Bentuk yang dipakai hubungan logaritmik yang lazim dipakai pada rancangan
 * lintasan ikan:
 *
 *   ln t = a - b U
 *
 * dengan U kecepatan berenang dalam panjang tubuh per detik. Dua tetapan
 * ditentukan dari dua titik yang disepakati: kecepatan jelajah dapat
 * dipertahankan sangat lama, dan kecepatan sentak hanya dua puluh detik.
 * Dengan begitu tetapannya terikat pada dua besaran yang memang diukur di
 * lapangan, bukan pada angka yang harus dicari di tabel.
 *
 * Rujukan: Beamish (1978), Swimming capacity, dalam Fish Physiology vol. 7;
 * Katopodis & Gervais (2016), Fish swimming performance database.
 */
export function fishSwim(
  /** Panjang tubuh ikan, meter */
  bodyLength: number,
  /** Kecepatan arus yang dilawan, m/s */
  flowVelocity: number,
  /** Kecepatan jelajah dalam panjang tubuh per detik */
  sustainedBL = SWIM_SUSTAINED_BL,
  /** Kecepatan sentak dalam panjang tubuh per detik */
  burstBL = SWIM_BURST_BL
): SwimResult {
  const sustained = sustainedBL * bodyLength;
  const burst = burstBL * bodyLength;
  const U = bodyLength > 0 ? flowVelocity / bodyLength : 0;

  // ln t = a - b U, ditentukan dari dua titik yang disepakati.
  const b =
    burstBL > sustainedBL
      ? (Math.log(SWIM_SUSTAINED_TIME) - Math.log(SWIM_BURST_TIME)) /
        (burstBL - sustainedBL)
      : 0;
  const a = Math.log(SWIM_SUSTAINED_TIME) + b * sustainedBL;

  const endurance =
    U <= sustainedBL ? Number.POSITIVE_INFINITY : Math.exp(a - b * U);

  const groundSpeed = burst - flowVelocity;

  /*
   * Daya tahan dan jarak tempuh menjawab dua pertanyaan yang berbeda, dan
   * keduanya tidak boleh dikalikan begitu saja.
   *
   * Daya tahan di atas dihitung pada kecepatan berenang yang sama dengan
   * kecepatan arus, yaitu keadaan ikan menahan diri di tempat. Pada keadaan
   * itu kecepatan majunya justru nol menurut definisinya sendiri, sehingga
   * mengalikannya dengan kecepatan maju sentak akan menggabungkan dua
   * keadaan yang tidak dapat berlangsung bersamaan.
   *
   * Jarak tempuh karena itu dihitung pada andaian tunggal: ikan berenang
   * pada kecepatan sentaknya selama waktu sentak yang disepakati.
   */
  return {
    endurance,
    sustained,
    burst,
    groundSpeed,
    distance: groundSpeed > 0 ? groundSpeed * SWIM_BURST_TIME : 0,
    mode:
      flowVelocity >= burst
        ? "tidak-mampu"
        : U <= sustainedBL
          ? "jelajah"
          : U <= (sustainedBL + burstBL) / 2
            ? "berkelanjutan"
            : "sentak",
  };
}

/* ------------------------------------------------------------------ *
 * EK-01 Tingkat trofik
 * ------------------------------------------------------------------ */

export type TrophicLevel = {
  level: number;
  /** Aliran energi yang tersedia di tingkat itu, kilojoule per m2 per tahun */
  energy: number;
  /** Biomassa tegakan, gram per meter persegi */
  biomass: number;
};

export type TrophicResult = {
  levels: TrophicLevel[];
  /** Banyaknya tingkat yang masih di atas ambang kelayakan */
  supported: number;
  /** Bagian energi produsen yang sampai ke tingkat teratas */
  topFraction: number;
  /** Benar bila tingkat yang diminta tidak dapat ditopang */
  overreach: boolean;
};

/** Ambang aliran energi terkecil yang masih menopang satu tingkat, kJ/m2/th. */
export const TROPHIC_MIN_ENERGY = 1;

/**
 * Piramida energi rantai makanan sungai.
 *
 * Tiap tingkat hanya meneruskan sebagian kecil energi yang diterimanya, dan
 * sisanya habis untuk pernapasan, gerak, serta bagian yang tidak tercerna.
 * Efisiensi peralihan sepuluh persen adalah angka kasar yang lazim dikutip,
 * dan nilai lapangannya tersebar antara dua sampai dua puluh persen.
 *
 * Yang membuat piramida ini penting bagi hidraulika sungai: banyaknya tingkat
 * yang dapat ditopang ditentukan oleh produksi dasarnya, dan produksi dasar
 * ditentukan oleh cahaya, hara, dan waktu tinggal air. Membendung sungai
 * mengubah ketiganya sekaligus.
 *
 * Rujukan: Lindeman (1942), The trophic-dynamic aspect of ecology, Ecology
 * vol. 23; Pauly & Christensen (1995).
 */
export function trophicPyramid(
  /** Produksi primer bersih, kilojoule per meter persegi per tahun */
  primaryProduction: number,
  /** Efisiensi peralihan antar tingkat, 0 sampai 1 */
  efficiency: number,
  /** Banyaknya tingkat yang ingin dilihat */
  levelCount: number,
  /** Perbandingan biomassa terhadap aliran energi, gram per kilojoule */
  biomassRatio = 0.02
): TrophicResult {
  const levels: TrophicLevel[] = [];
  let energy = primaryProduction;
  for (let i = 1; i <= levelCount; i++) {
    levels.push({
      level: i,
      energy,
      // Tingkat yang lebih tinggi berumur lebih panjang, jadi biomassanya
      // menumpuk lebih lama untuk aliran energi yang sama.
      biomass: energy * biomassRatio * Math.pow(1.6, i - 1),
    });
    energy *= efficiency;
  }

  const supported = levels.filter((l) => l.energy >= TROPHIC_MIN_ENERGY).length;

  return {
    levels,
    supported,
    topFraction:
      primaryProduction > 0
        ? levels[levels.length - 1].energy / primaryProduction
        : 0,
    overreach: supported < levelCount,
  };
}

/* ------------------------------------------------------------------ *
 * EK-02 Aturan panen
 * ------------------------------------------------------------------ */

export type HarvestResult = {
  /** Kurva hasil lestari terhadap upaya */
  curve: { effort: number; yield: number; stock: number }[];
  /** Hasil lestari maksimum */
  msy: number;
  /** Upaya yang memberi hasil maksimum */
  effortAtMsy: number;
  /** Populasi pada upaya yang sedang dipakai */
  stock: number;
  /** Hasil pada upaya yang sedang dipakai */
  currentYield: number;
  /** Benar bila upayanya melampaui titik hasil maksimum */
  overfished: boolean;
  /** Benar bila upayanya sudah meruntuhkan populasinya */
  collapsed: boolean;
};

/**
 * Hasil lestari menurut model Schaefer.
 *
 * Pertumbuhan populasi logistik, dan panen sebanding dengan upaya dikali
 * populasi:
 *
 *   dN/dt = r N (1 - N/K) - q E N
 *
 * Pada keadaan mantap dN/dt nol, sehingga N = K (1 - qE/r) dan hasilnya
 * Y = q E N. Kurvanya berbentuk parabola dengan puncak di E = r/(2q), dan
 * puncak itulah yang dinamakan hasil lestari maksimum.
 *
 * Yang sering terlewat: kurva ini menurun sesudah puncaknya. Menambah upaya
 * di sebelah kanan puncak MENURUNKAN hasil, bukan menaikkannya, dan itulah
 * bentuk kegagalan pengelolaan perikanan yang paling sering terjadi.
 *
 * Rujukan: Schaefer (1954); Hilborn & Walters (1992), Quantitative Fisheries
 * Stock Assessment.
 */
export function schaeferHarvest(
  /** Laju pertumbuhan hakiki per tahun */
  r: number,
  /** Daya dukung, ton */
  K: number,
  /** Kemampuan tangkap per satuan upaya */
  q: number,
  /** Upaya yang sedang dipakai, satuan upaya per tahun */
  effort: number,
  steps = 200
): HarvestResult {
  const eMax = q > 0 ? (r / q) * 1.4 : 1;
  const curve: { effort: number; yield: number; stock: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const E = (eMax * i) / steps;
    const N = Math.max(K * (1 - (q * E) / r), 0);
    curve.push({ effort: E, yield: q * E * N, stock: N });
  }

  const stock = Math.max(K * (1 - (q * effort) / r), 0);
  const effortAtMsy = q > 0 ? r / (2 * q) : 0;

  return {
    curve,
    msy: (r * K) / 4,
    effortAtMsy,
    stock,
    currentYield: q * effort * stock,
    overfished: effort > effortAtMsy,
    collapsed: stock <= 0.05 * K,
  };
}

/* ------------------------------------------------------------------ *
 * EK-03 Tangkap-tandai-tangkap ulang
 * ------------------------------------------------------------------ */

export type MarkRecaptureResult = {
  /** Taksiran Lincoln-Petersen */
  petersen: number;
  /** Taksiran Chapman, yang tidak berat sebelah pada contoh kecil */
  chapman: number;
  /** Ragam taksiran Chapman */
  variance: number;
  /** Selang kepercayaan sembilan puluh lima persen, batas bawah dan atas */
  ciLow: number;
  ciHigh: number;
  /** Bagian populasi yang tertandai */
  markedFraction: number;
  /** Benar bila tangkapan ulangnya terlalu sedikit untuk dipercaya */
  tooFewRecaptures: boolean;
};

/** Banyaknya tangkapan ulang terkecil yang masih dianggap layak dipercaya. */
export const RECAPTURE_MIN = 7;

/**
 * Taksiran ukuran populasi dari dua kali penangkapan.
 *
 * Gagasannya satu kalimat: bila bagian yang tertandai pada tangkapan kedua
 * sama dengan bagian yang tertandai pada seluruh populasi, maka
 *
 *   m / n = M / N   sehingga   N = M n / m
 *
 * Itu taksiran Lincoln-Petersen. Ia berat sebelah ke atas pada contoh kecil,
 * dan menjadi tak hingga bila tidak ada satu pun yang tertangkap ulang.
 * Taksiran Chapman memperbaiki keduanya dengan menambahkan satu pada tiap
 * hitungan, dan ia yang dipakai dalam praktik.
 *
 * Rujukan: Seber (1982), The Estimation of Animal Abundance, edisi ke-2;
 * Chapman (1951); Krebs (1999), Ecological Methodology.
 */
export function markRecapture(
  /** Banyaknya yang ditandai pada penangkapan pertama */
  M: number,
  /** Banyaknya yang ditangkap pada penangkapan kedua */
  n: number,
  /** Banyaknya bertanda di dalam tangkapan kedua */
  m: number
): MarkRecaptureResult {
  const petersen = m > 0 ? (M * n) / m : Number.POSITIVE_INFINITY;
  const chapman = ((M + 1) * (n + 1)) / (m + 1) - 1;
  const variance =
    ((M + 1) * (n + 1) * (M - m) * (n - m)) /
    ((m + 1) * (m + 1) * (m + 2));
  const se = Math.sqrt(Math.max(variance, 0));

  return {
    petersen,
    chapman,
    variance,
    ciLow: Math.max(chapman - 1.96 * se, 0),
    ciHigh: chapman + 1.96 * se,
    markedFraction: chapman > 0 ? M / chapman : 0,
    tooFewRecaptures: m < RECAPTURE_MIN,
  };
}

/* ------------------------------------------------------------------ *
 * EK-04 Lintasan ikan dan populasi
 * ------------------------------------------------------------------ */

export type PassageResult = {
  /** Lintasan populasi tahun demi tahun */
  path: { year: number; population: number }[];
  /** Populasi pada keadaan mantap, atau nol bila punah */
  equilibrium: number;
  /** Keberhasilan lintasan terkecil yang masih menghindarkan kepunahan */
  criticalPassage: number;
  /** Benar bila populasinya menuju punah */
  extinct: boolean;
  /**
   * Benar bila kematian alaminya menyamai atau melampaui pertumbuhannya,
   * sehingga lintasan ikan sebaik apa pun tidak menolong. Pada keadaan itu
   * yang harus diperbaiki bukan bendungnya melainkan sebab kematiannya.
   */
  hopeless: boolean;
  /** Banyaknya tahun sampai populasinya tinggal sepersepuluh */
  yearsToTenth: number;
};

/**
 * Lintasan populasi ikan ruaya yang harus melewati bendung tiap generasi.
 *
 * Tiap tahun, sebagian populasi dewasa berusaha naik ke hulu untuk memijah.
 * Hanya bagian p yang berhasil melewati bendungnya, dan hanya bagian itu yang
 * menyumbang keturunan. Pertumbuhannya sendiri logistik:
 *
 *   N(t+1) = N(t) + r p N(t) (1 - N(t)/K) - d N(t)
 *
 * Keadaan mantapnya N* = K (1 - d/(r p)), dan dari situ terbaca syarat
 * kelestariannya: r p harus melebihi d. Keberhasilan lintasan yang lebih
 * kecil dari d/r membuat populasinya menuju nol berapa pun besarnya sekarang.
 *
 * Yang membuat hasil ini penting: keberhasilan lintasan sembilan puluh
 * persen dan lima puluh persen tidak berbeda sepuluh berbanding lima,
 * melainkan berbeda antara lestari dan punah, tergantung letak keduanya
 * terhadap satu ambang tunggal.
 *
 * Rujukan: Kareiva et al. (2000), Recovery and management options for
 * spring/summer chinook salmon, Science vol. 290; Caswell (2001), Matrix
 * Population Models.
 */
export function fishPassage(
  /** Populasi awal */
  N0: number,
  /** Daya dukung */
  K: number,
  /** Laju pertumbuhan hakiki per tahun */
  r: number,
  /** Laju kematian alami per tahun */
  d: number,
  /** Bagian yang berhasil melewati bendung, 0 sampai 1 */
  passage: number,
  years = 60
): PassageResult {
  const path: { year: number; population: number }[] = [];
  let N = N0;
  for (let y = 0; y <= years; y++) {
    path.push({ year: y, population: N });
    const tumbuh = r * passage * N * (1 - N / K);
    N = Math.max(N + tumbuh - d * N, 0);
  }

  const kritis = r > 0 ? d / r : 1;
  const equilibrium =
    r * passage > d ? K * (1 - d / (r * passage)) : 0;

  const sepersepuluh = path.find((p) => p.population <= N0 / 10);

  return {
    path,
    equilibrium,
    criticalPassage: kritis,
    extinct: r * passage <= d,
    hopeless: kritis >= 1,
    yearsToTenth: sepersepuluh ? sepersepuluh.year : Number.POSITIVE_INFINITY,
  };
}

/* ------------------------------------------------------------------ *
 * Bendung ogee
 * ------------------------------------------------------------------ */

export type OgeeResult = {
  Q: number;
  /** Koefisien debit pada tinggi energi yang sedang berlangsung */
  Cd: number;
  /** Koefisien debit pada tinggi energi rancangan */
  CdDesign: number;
  /** Perbandingan tinggi energi terhadap tinggi rancangan */
  ratio: number;
  /** Tinggi energi, yaitu tinggi muka air ditambah tinggi kecepatan datang */
  He: number;
  /** Kecepatan datang di hulu mercu */
  Va: number;
  /** Tekanan di mercu dinyatakan dalam meter kolom air, terhadap tekanan udara */
  crestPressure: number;
  /** Benar bila tekanan di mercu turun di bawah ambang kavitasi */
  cavitationRisk: boolean;
  outOfRange: boolean;
  reason: "" | "He-kecil" | "He-besar" | "tak-terkendali";
  /**
   * Benar bila mercunya tidak lagi mengendalikan aliran: tinggi muka air
   * terlalu besar dibanding tinggi mercunya, sehingga kecepatan datang
   * menjadi sebesar kecepatan di mercu dan tidak ada tinggi energi yang
   * memenuhi persamaannya. Yang ada di sana bukan bendung melainkan
   * penyempitan saluran.
   */
  controlled: boolean;
};

/** Koefisien debit bendung ogee pada tinggi energi rancangan, SI. */
export const OGEE_CD_DESIGN = 2.2;
/** Batas bawah perbandingan He terhadap Hd yang masih layak dipakai. */
export const OGEE_RATIO_MIN = 0.2;
/** Batas atas perbandingan He terhadap Hd sebelum kavitasi menjadi nyata. */
export const OGEE_RATIO_MAX = 3.0;
/**
 * Tekanan terendah di mercu yang masih dianggap aman, meter kolom air di
 * bawah tekanan udara. Di bawah ini gelembung uap mulai terbentuk dan
 * runtuhnya menggerus beton.
 */
export const OGEE_CAVITATION_LIMIT = -6;

/**
 * Ordinat muka hilir mercu ogee menurut bentuk WES.
 *
 *   y / Hd = -0,5 (x / Hd)^1,85
 *
 * Bentuk ini bukan pilihan sembarang melainkan jejak permukaan bawah tirai
 * luapan bebas dari ambang tajam pada tinggi rancangannya. Karena mercunya
 * dibuat persis mengikuti bentuk itu, pada tinggi rancangan air menyentuh
 * mercu tanpa menekan dan tanpa terangkat: tekanan di seluruh permukaannya
 * sama dengan tekanan udara.
 *
 * Rujukan: US Army Corps of Engineers, Hydraulic Design Criteria 111;
 * USBR (1987), Design of Small Dams, Bab 9.
 */
export function wesCrest(x: number, Hd: number): number {
  if (Hd <= 0 || x < 0) return 0;
  return -0.5 * Hd * Math.pow(x / Hd, 1.85);
}

/**
 * Koefisien debit ogee sebagai fungsi perbandingan tinggi energi.
 *
 * Pada tinggi rancangan nilainya 2,2 dalam satuan SI. Di bawah rancangan
 * tirai menekan mercu sehingga koefisiennya turun; di atas rancangan tirai
 * terangkat sehingga tekanan di mercu menjadi negatif dan koefisiennya naik.
 * Kenaikan itu tampak menguntungkan dan justru berbahaya, karena tekanan
 * negatiflah yang menimbulkan kavitasi.
 *
 * Bentuk yang dipakai pendekatan pangkat terhadap perbandingan He/Hd yang
 * mengikuti bagan HDC 111-3.
 */
export function ogeeCd(ratio: number): number {
  return OGEE_CD_DESIGN * Math.pow(Math.max(ratio, 1e-6), 0.12);
}

/**
 * Tekanan di mercu ogee, meter kolom air terhadap tekanan udara.
 *
 * Nol tepat ketika tinggi ENERGI menyamai tinggi rancangan, bukan ketika
 * tinggi muka airnya yang menyamai. Bedanya tinggi kecepatan datang, dan
 * pada bendung rendah dengan tinggi rancangan besar beda itu tidak kecil.
 * Dipisahkan menjadi fungsi tersendiri supaya sifat itu dapat diuji pada
 * syaratnya sendiri, bukan lewat keadaan yang kebetulan mendekatinya.
 */
export function ogeeCrestPressure(He: number, Hd: number): number {
  return He > Hd ? -(He - Hd) * 1.4 : (Hd - He) * 0.35;
}

export function ogeeWeir(
  /** Tinggi muka air di atas mercu, meter */
  h: number,
  /** Tinggi energi rancangan, meter */
  Hd: number,
  /** Panjang mercu, meter */
  L: number,
  /** Tinggi mercu di atas dasar hulu, meter */
  P: number
): OgeeResult {
  const CdDesign = OGEE_CD_DESIGN;

  /*
   * Tinggi energi dan debit saling bergantung lewat kecepatan datang:
   *
   *   He = h + k He^3,24,   k = Cd0^2 Hd^-0,24 / (2 g (h+P)^2)
   *
   * Bentuk ini sama jenisnya dengan yang ditemui pada flum berleher panjang,
   * dan iterasi titik tetap atasnya punya cacat yang sama: bila akarnya tidak
   * ada, ia melipatgandakan sampai tak hingga tanpa pernah tahu. Akar ada
   * hanya bila puncak f(He) = He - h - k He^3,24 tidak negatif, dan puncak itu
   * berada di He = (1/(3,24 k))^(1/2,24).
   *
   * Bila tidak ada akar, artinya kecepatan datang sudah sebesar kecepatan di
   * mercu, dan yang ada di sana bukan bendung melainkan penyempitan saluran.
   */
  const pangkat = 3.24;
  const k =
    h + P > 0 && Hd > 0
      ? (OGEE_CD_DESIGN * OGEE_CD_DESIGN * Math.pow(Hd, -0.24)) /
        (2 * G * (h + P) * (h + P))
      : 0;
  const f = (He: number) => He - h - k * Math.pow(He, pangkat);
  const puncak = k > 0 ? Math.pow(1 / (pangkat * k), 1 / (pangkat - 1)) : Infinity;
  const terkendali = h > 0 && (k === 0 || f(puncak) >= 0);

  let He = h;
  if (terkendali && k > 0) {
    let lo = h;
    let hi = Math.min(puncak, h * 60);
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) >= 0) hi = mid;
      else lo = mid;
      if (hi - lo < 1e-13) break;
    }
    He = (lo + hi) / 2;
  }

  if (!terkendali) {
    return {
      Q: 0,
      Cd: 0,
      CdDesign,
      ratio: Hd > 0 ? h / Hd : 0,
      He: h,
      Va: 0,
      crestPressure: 0,
      cavitationRisk: false,
      outOfRange: true,
      reason: "tak-terkendali",
      controlled: false,
    };
  }

  const Q = ogeeCd(Hd > 0 ? He / Hd : 1) * L * Math.pow(Math.max(He, 0), 1.5);
  const A = L * (h + P);
  const Va = A > 0 ? Q / A : 0;
  const ratio = Hd > 0 ? He / Hd : 0;
  const Cd = ogeeCd(ratio);

  const crestPressure = ogeeCrestPressure(He, Hd);

  const reason: OgeeResult["reason"] =
    ratio < OGEE_RATIO_MIN
      ? "He-kecil"
      : ratio > OGEE_RATIO_MAX
        ? "He-besar"
        : "";

  return {
    Q,
    Cd,
    CdDesign,
    ratio,
    He,
    Va,
    crestPressure,
    cavitationRisk: crestPressure < OGEE_CAVITATION_LIMIT,
    outOfRange: reason !== "",
    reason,
    controlled: true,
  };
}

/* ------------------------------------------------------------------ *
 * Bendung labirin
 * ------------------------------------------------------------------ */

export type LabyrinthResult = {
  Q: number;
  /** Debit bendung lurus dengan lebar yang sama, sebagai pembanding */
  QLinear: number;
  /** Perbandingan debit labirin terhadap bendung lurus */
  gain: number;
  /** Panjang mercu seluruhnya */
  crestLength: number;
  /** Perbandingan panjang mercu terhadap lebar saluran */
  magnification: number;
  /** Perbandingan tinggi muka air terhadap tinggi mercu */
  headRatio: number;
  /** Sudut dinding sisi terhadap arah aliran, derajat */
  sidewallAngle: number;
  /** Benar bila tirai dari kedua sisi bertemu dan saling mengganggu */
  interference: boolean;
  outOfRange: boolean;
};

/**
 * Batas perbandingan tinggi muka air terhadap tinggi mercu yang masih
 * membuat labirin berguna. Di atas nilai ini tirai dari kedua dinding sisi
 * bertemu di tengah siklus, saling menekan, dan tambahan panjang mercu
 * berhenti memberi tambahan debit.
 */
export const LABYRINTH_HP_MAX = 0.9;

/**
 * Bendung labirin berdenah trapesium.
 *
 * Gagasannya sederhana: pada lebar saluran yang sama, mercu yang dilipat
 * zig-zag menjadi jauh lebih panjang, dan debit ambang sebanding dengan
 * panjang mercu. Yang membuatnya tidak sesederhana itu: pada tinggi muka air
 * yang besar tirai dari kedua dinding sisi bertemu dan saling mengganggu,
 * sehingga tambahan panjang berhenti berguna justru pada keadaan banjir yang
 * menjadi alasan membangunnya.
 *
 * Koefisien debitnya karena itu turun terhadap perbandingan tinggi muka air
 * terhadap tinggi mercu, dan bentuk penurunannya diambil dari kurva Tullis.
 *
 * Rujukan: Tullis, Amanian & Waldron (1995), Design of labyrinth spillways,
 * Journal of Hydraulic Engineering vol. 121; Falvey (2003), Hydraulic Design
 * of Labyrinth Weirs.
 */
export function labyrinthWeir(
  /** Tinggi muka air di atas mercu, meter */
  h: number,
  /** Tinggi mercu, meter */
  P: number,
  /** Lebar saluran seluruhnya, meter */
  W: number,
  /** Banyaknya siklus */
  cycles: number,
  /** Panjang siklus searah aliran, meter */
  cycleLength: number,
  /** Koefisien debit bendung lurus pembanding, SI */
  CdLinear = 1.85
): LabyrinthResult {
  const headRatio = P > 0 ? h / P : Number.POSITIVE_INFINITY;

  // Denah trapesium: tiap siklus punya lebar w dan panjang searah aliran B.
  const w = cycles > 0 ? W / cycles : W;
  const sisi = Math.sqrt(cycleLength * cycleLength + (w / 4) * (w / 4));
  const crestLength = cycles * (2 * sisi + w / 2);
  const magnification = W > 0 ? crestLength / W : 1;
  const sidewallAngle = (Math.atan(w / 4 / Math.max(cycleLength, 1e-9)) * 180) / Math.PI;

  /*
   * Koefisien debit turun terhadap h/P karena gangguan antar tirai.
   *
   * Bentuk yang dipakai penurunan mulus yang bertemu koefisien bendung lurus
   * pada h/P mendekati satu, yaitu keadaan tempat labirin sudah berperilaku
   * seperti bendung lurus selebar saluran dan tambahan panjangnya tidak lagi
   * memberi apa-apa.
   */
  const Cd = CdLinear * (1 - 0.55 * Math.min(headRatio / LABYRINTH_HP_MAX, 1));

  const Q = Cd * crestLength * Math.pow(Math.max(h, 0), 1.5);
  const QLinear = CdLinear * W * Math.pow(Math.max(h, 0), 1.5);

  return {
    Q,
    QLinear,
    gain: QLinear > 0 ? Q / QLinear : 0,
    crestLength,
    magnification,
    headRatio,
    sidewallAngle,
    interference: headRatio > LABYRINTH_HP_MAX,
    outOfRange: headRatio > LABYRINTH_HP_MAX,
  };
}

/* ------------------------------------------------------------------ *
 * Pintu sorong
 * ------------------------------------------------------------------ */

export type SluiceResult = {
  Q: number;
  /** Koefisien debit gabungan */
  Cd: number;
  /** Kedalaman di vena contracta di hilir pintu */
  y2: number;
  /** Kedalaman lawan loncatan dari vena contracta */
  yConjugate: number;
  /** Bilangan Froude di vena contracta */
  Fr2: number;
  /** Gaya mendatar pada daun pintu, newton per meter lebar */
  gateForce: number;
  submerged: boolean;
  /** Benar bila bukaan melebihi kedalaman hulu; tidak ada pintu lagi */
  gateAboveWater: boolean;
};

/**
 * Pintu sorong berbibir tajam pada saluran persegi.
 *
 * Koefisien debitnya bukan tetapan melainkan akibat langsung dari kontraksi:
 *
 *   Cd = Cc / sqrt(1 + Cc a / y1)
 *
 * Bentuk ini diturunkan dari persamaan energi antara hulu dan vena contracta
 * dengan kontraksi Cc, bukan dikalibrasi. Karena itu ia otomatis mengecil
 * ketika bukaan mendekati kedalaman hulu, dan pada bukaan kecil ia mendekati
 * Cc itu sendiri.
 *
 * Aliran menjadi tenggelam bila muka air hilir melebihi kedalaman lawan
 * loncatan dari vena contracta: loncatan yang seharusnya terbentuk di hilir
 * pintu terdorong balik dan menenggelamkan bukaannya.
 *
 * Rujukan: Henderson (1966), Open Channel Flow, Bab 6; Rajaratnam &
 * Subramanya (1967); USBR Design of Small Canal Structures.
 */
export function sluiceGate(
  /** Kedalaman hulu, meter */
  y1: number,
  /** Bukaan pintu, meter */
  a: number,
  /** Lebar saluran, meter */
  b: number,
  /** Kedalaman hilir, meter */
  y3: number,
  /** Koefisien kontraksi */
  Cc = 0.611,
  rho = 1000
): SluiceResult {
  if (a >= y1) {
    return {
      Q: 0,
      Cd: 0,
      y2: 0,
      yConjugate: 0,
      Fr2: 0,
      gateForce: 0,
      submerged: false,
      gateAboveWater: true,
    };
  }

  const Cd = Cc / Math.sqrt(1 + (Cc * a) / y1);
  const Qbebas = Cd * b * a * Math.sqrt(2 * G * y1);
  const y2 = Cc * a;
  const q = b > 0 ? Qbebas / b : 0;
  const V2 = y2 > 0 ? q / y2 : 0;
  const Fr2 = froude(V2, y2);
  const yConjugate = conjugateDepth(y2, Fr2);

  const submerged = y3 > yConjugate;

  /*
   * Pada aliran tenggelam debitnya berkurang karena beda tinggi tekan efektif
   * mengecil.
   *
   * Mengganti begitu saja y1 dengan selisih muka air hulu dan hilir pada suku
   * akarnya adalah cara yang lazim ditulis di buku, dan cara itu punya cacat
   * yang tidak boleh dibiarkan pada lembar yang sliders-nya digeser orang:
   * debitnya MELOMPAT pada saat pintu mulai tenggelam. Tepat di ambang
   * tenggelam, rumus bebas memberi akar y1 sedangkan rumus tenggelam memberi
   * akar (y1 - y3), dan keduanya jauh berbeda. Di alam tidak ada lompatan itu.
   *
   * Yang dipakai di sini faktor penenggelaman yang bernilai satu tepat di
   * ambangnya dan turun mulus menuju nol ketika muka air hilir mendekati muka
   * air hulu:
   *
   *   psi = sqrt[ (y1 - y3) / (y1 - y_lawan) ]
   *
   * Ini interpolasi rekayasa, bukan penyelesaian tertutup, dan dinyatakan
   * sebagai interpolasi alih-alih disamarkan sebagai rumus. Yang dijamin
   * olehnya dua hal yang memang harus berlaku: kesinambungan di ambang, dan
   * penurunan monoton sesudahnya.
   */
  const psi = submerged
    ? Math.sqrt(
        Math.max(y1 - y3, 0) / Math.max(y1 - yConjugate, 1e-9)
      )
    : 1;
  const Q = Qbebas * Math.min(psi, 1);

  /*
   * Gaya mendatar pada daun pintu, dari kekekalan momentum.
   *
   * Bukan sekadar tekanan hidrostatis pada daunnya: aliran yang dipercepat
   * mengurangi gaya itu, dan selisihnya tidak kecil.
   *
   * Penampang hilir yang dipakai berbeda menurut keadaannya, dan ini bukan
   * kehalusan melainkan keharusan. Pada aliran bebas penampang hilirnya vena
   * contracta, karena di sanalah tekanan kembali hidrostatis. Pada aliran
   * tenggelam vena contracta terendam, air hilir menekan balik daun pintu,
   * dan penampang yang berlaku adalah muka air hilir itu sendiri. Memakai
   * vena contracta pada keadaan tenggelam membuat gayanya justru NAIK ketika
   * air hilir naik, padahal yang sesungguhnya terjadi sebaliknya.
   */
  const qKerja = b > 0 ? Q / b : 0;
  const yHilir = submerged ? y3 : y2;
  const M1 = (rho * G * y1 * y1) / 2 + (rho * qKerja * qKerja) / Math.max(y1, 1e-9);
  const M2 =
    (rho * G * yHilir * yHilir) / 2 +
    (rho * qKerja * qKerja) / Math.max(yHilir, 1e-9);

  return {
    Q,
    Cd,
    y2,
    yConjugate,
    Fr2,
    gateForce: M1 - M2,
    submerged,
    gateAboveWater: false,
  };
}

/* ------------------------------------------------------------------ *
 * Gorong-gorong
 * ------------------------------------------------------------------ */

export type CulvertResult = {
  /** Tinggi muka air di sisi masuk yang dibutuhkan, meter di atas dasar */
  headwater: number;
  /** Tinggi muka air bila yang mengendalikan sisi masuk */
  inletHeadwater: number;
  /** Tinggi muka air bila yang mengendalikan sisi keluar */
  outletHeadwater: number;
  control: "masuk" | "keluar";
  /** Kecepatan rata-rata di dalam gorong-gorong */
  velocity: number;
  /** Perbandingan tinggi muka air terhadap tinggi gorong-gorong */
  hwRatio: number;
  /** Benar bila tinggi muka air melampaui tinggi jalan di atasnya */
  overtops: boolean;
  /** Benar bila kecepatannya melampaui batas yang dapat dilewati ikan */
  fishBarrier: boolean;
  /**
   * Benar bila pipanya memang mengalir penuh.
   *
   * Hitungan kendali sisi keluar di sini memakai kecepatan pipa penuh dan
   * muka air keluar yang diandaikan setengah tinggi pipa. Bila pipanya
   * sebenarnya mengalir sebagian, keduanya tidak berlaku, dan angka kendali
   * sisi keluarnya menjadi taksiran kasar yang cenderung terlalu besar.
   * HDS-5 sendiri menyatakan caranya hanya pendekatan di daerah itu.
   */
  flowsFull: boolean;
};

/** Perbandingan tinggi muka air terhadap tinggi gorong-gorong yang lazim jadi batas rancangan. */
export const CULVERT_HW_D_MAX = 1.5;
/** Kecepatan yang lazim dipakai sebagai batas lintasan ikan, m/s. */
export const CULVERT_FISH_VELOCITY = 1.2;

/**
 * Gorong-gorong bulat, kendali sisi masuk dibanding kendali sisi keluar.
 *
 * Inilah pokok lembar gorong-gorong, dan yang paling sering salah dipahami:
 * ada DUA hitungan yang berbeda sama sekali, dan yang berlaku adalah yang
 * menuntut tinggi muka air lebih besar.
 *
 * Kendali sisi masuk berarti mulut gorong-gorong yang membatasi, seperti
 * ambang atau lubang, dan panjang maupun kekasaran pipanya tidak berpengaruh
 * sama sekali. Kendali sisi keluar berarti gesekan sepanjang pipa dan muka
 * air hilir yang membatasi, dan di situ panjang serta kekasaran menentukan.
 *
 * Memperpanjang gorong-gorong yang dikendalikan sisi masuk tidak mengubah
 * apa pun; memperpanjang yang dikendalikan sisi keluar menaikkan muka air
 * hulunya. Itu sebabnya kedua hitungan harus dikerjakan, bukan dipilih.
 *
 * Rujukan: FHWA HDS-5, Hydraulic Design of Highway Culverts, edisi ke-3;
 * Normann, Houghtalen & Johnston (2012).
 */
export function culvert(
  /** Debit rancangan, meter kubik per detik */
  Q: number,
  /** Garis tengah gorong-gorong, meter */
  D: number,
  /** Panjang gorong-gorong, meter */
  L: number,
  /** Kemiringan dasar gorong-gorong */
  S: number,
  /** Angka kekasaran Manning */
  n: number,
  /** Kedalaman air di hilir, meter di atas dasar keluar */
  tailwater: number,
  /** Tinggi timbunan jalan di atas dasar masuk, meter */
  roadHeight: number,
  /** Koefisien kehilangan pada mulut */
  Ke = 0.5
): CulvertResult {
  const A = (Math.PI / 4) * D * D;
  const V = A > 0 ? Q / A : 0;

  /*
   * Kendali sisi masuk, bentuk lubang terendam yang dipakai HDS-5 pada
   * HW/D di atas kira-kira satu:
   *
   *   HW = D [ (Q / (C A sqrt(g D)))^2 + k ]
   *
   * Tetapan diambil untuk mulut ujung terpotong sejajar timbunan.
   */
  const bilangan = A > 0 && D > 0 ? Q / (A * Math.sqrt(G * D)) : 0;
  const inletHeadwater = D * (0.44 * bilangan * bilangan + 0.5 * bilangan + 0.05);

  /*
   * Kendali sisi keluar, persamaan energi sepanjang pipa:
   *
   *   HW = TW + H - S L,   H = (Ke + 2g n^2 L / R^(4/3) + 1) V^2 / 2g
   *
   * Muka air hilir dipakai bila melebihi setengah tinggi pipa; bila tidak,
   * dipakai kedalaman kritis semu setengah tinggi pipa, seperti pada HDS-5.
   */
  const R = D / 4;
  const hf =
    ((Ke + (2 * G * n * n * L) / Math.pow(R, 4 / 3) + 1) * V * V) / (2 * G);
  const ho = Math.max(tailwater, D / 2);
  const outletHeadwater = ho + hf - S * L;

  const headwater = Math.max(inletHeadwater, outletHeadwater);

  return {
    headwater,
    inletHeadwater,
    outletHeadwater,
    flowsFull: headwater >= 1.2 * D || tailwater >= D,
    control: inletHeadwater >= outletHeadwater ? "masuk" : "keluar",
    velocity: V,
    hwRatio: D > 0 ? headwater / D : 0,
    overtops: headwater > roadHeight,
    fishBarrier: V > CULVERT_FISH_VELOCITY,
  };
}

/* ------------------------------------------------------------------ *
 * Pembendungan oleh pilar jembatan
 * ------------------------------------------------------------------ */

export type BridgeResult = {
  /** Kenaikan muka air di hulu jembatan, meter */
  backwater: number;
  /** Bagian lebar sungai yang tertutup pilar */
  blockage: number;
  /** Bilangan Froude di hilir jembatan */
  Fr: number;
  /** Kecepatan di antara pilar */
  velocityBetween: number;
  /** Kedalaman gerusan setempat di hidung pilar, meter */
  scourDepth: number;
  /** Benar bila alirannya superkritis sehingga rumus Yarnell tidak berlaku */
  outOfRange: boolean;
  /** Benar bila penyempitannya melampaui batas yang biasa diterima */
  heavyBlockage: boolean;
};

/** Bagian lebar tertutup pilar yang lazim dipakai sebagai batas rancangan. */
export const BRIDGE_BLOCKAGE_MAX = 0.25;

/**
 * Pembendungan oleh pilar jembatan, rumus Yarnell.
 *
 *   dh = K (K + 5 Fr^2 - 0,6) (alpha + 15 alpha^4) Fr^2 y3
 *
 * dengan alpha bagian lebar yang tertutup pilar dan K tetapan bentuk hidung
 * pilar. Rumus ini berasal dari lebih dari dua ribu percobaan saluran dan
 * tetap dipakai sampai sekarang untuk pilar tanpa kondisi tersendat.
 *
 * Perhatikan pangkat empat pada suku alpha: menggandakan bagian yang
 * tertutup menaikkan pembendungannya jauh lebih dari dua kali, dan itulah
 * alasan pilar dibuat sesedikit dan setipis mungkin.
 *
 * Gerusan setempat memakai bentuk HEC-18 yang disederhanakan untuk pilar
 * bulat pada dasar berpasir.
 *
 * Rujukan: Yarnell (1934), Bridge piers as channel obstructions, USDA
 * Technical Bulletin 442; Richardson & Davis (2001), HEC-18.
 */
export function bridgePiers(
  /** Debit, meter kubik per detik */
  Q: number,
  /** Lebar sungai seluruhnya, meter */
  B: number,
  /** Kedalaman di hilir jembatan, meter */
  y3: number,
  /** Banyaknya pilar */
  piers: number,
  /** Lebar satu pilar, meter */
  pierWidth: number,
  /** Tetapan bentuk hidung pilar Yarnell */
  K = 0.9
): BridgeResult {
  const alpha = B > 0 ? (piers * pierWidth) / B : 0;
  const Bbersih = Math.max(B - piers * pierWidth, 1e-9);
  const V3 = B * y3 > 0 ? Q / (B * y3) : 0;
  const Fr = froude(V3, y3);
  const Vantara = Bbersih * y3 > 0 ? Q / (Bbersih * y3) : 0;

  const backwater =
    alpha >= 1 || Fr >= 1
      ? 0
      : K *
        (K + 5 * Fr * Fr - 0.6) *
        (alpha + 15 * Math.pow(alpha, 4)) *
        Fr *
        Fr *
        y3;

  /*
   * Gerusan setempat di hidung pilar, bentuk HEC-18 yang disederhanakan:
   *
   *   ys = 2,0 K1 K2 a^0,65 y^0,35 Fr^0,43
   *
   * dengan a lebar pilar. K1 dan K2 diambil satu untuk pilar bulat sejajar
   * arus. Rumus ini sengaja konservatif dan lazim dianggap batas atas.
   */
  const scourDepth =
    pierWidth > 0 && y3 > 0
      ? 2.0 *
        Math.pow(pierWidth, 0.65) *
        Math.pow(y3, 0.35) *
        Math.pow(Math.max(Fr, 1e-9), 0.43)
      : 0;

  return {
    backwater,
    blockage: alpha,
    Fr,
    velocityBetween: Vantara,
    scourDepth,
    outOfRange: Fr >= 1 || alpha >= 1,
    heavyBlockage: alpha > BRIDGE_BLOCKAGE_MAX,
  };
}

/* ------------------------------------------------------------------ *
 * Perlindungan erosi dengan batu
 * ------------------------------------------------------------------ */

export type RiprapResult = {
  /** Garis tengah batu yang dibutuhkan, meter */
  d50: number;
  /** Massa satu batu seukuran itu, kilogram */
  stoneMass: number;
  /** Tebal lapisan yang disyaratkan, meter */
  layerThickness: number;
  /** Kecepatan yang sanggup ditahan oleh ukuran batu yang dipilih */
  capacityVelocity: number;
  /** Perbandingan kecepatan kerja terhadap kecepatan tahan */
  utilisation: number;
  stable: boolean;
};

/** Tetapan Isbash untuk batu yang tertanam rapat di dalam lapisan. */
export const ISBASH_EMBEDDED = 1.2;
/** Tetapan Isbash untuk batu yang menonjol sendirian di permukaan. */
export const ISBASH_EXPOSED = 0.86;

/**
 * Ukuran batu yang tahan terhadap kecepatan aliran, rumus Isbash.
 *
 *   d50 = V^2 / (2 g C^2 (s - 1))
 *
 * Bentuk ini keseimbangan gaya seret terhadap berat terendam satu batu, dan
 * tetapan C menyatakan seberapa terlindung batu itu oleh tetangganya. Batu
 * yang tertanam rapat jauh lebih tahan daripada batu yang sama yang
 * tergeletak sendirian, dan perbedaannya bukan sedikit: pada tetapan 1,2
 * lawan 0,86 ukuran yang dibutuhkan berbeda hampir dua kali lipat.
 *
 * Perhatikan pangkat dua pada kecepatan: menggandakan kecepatan menuntut
 * batu empat kali lebih besar garis tengahnya, yaitu enam puluh empat kali
 * lebih berat.
 *
 * Rujukan: Isbash (1936); USACE EM 1110-2-1601, Hydraulic Design of Flood
 * Control Channels; CIRIA C683, The Rock Manual.
 */
export function riprapSize(
  /** Kecepatan rata-rata aliran, m/s */
  V: number,
  /** Rapat massa jenis batu terhadap air */
  s: number,
  /** Tetapan Isbash */
  C = ISBASH_EMBEDDED,
  /** Ukuran batu yang direncanakan dipakai, meter; nol berarti pas ukuran */
  chosen = 0,
  rho = 1000
): RiprapResult {
  const d50 = (V * V) / (2 * G * C * C * (s - 1));
  const dPakai = chosen > 0 ? chosen : d50;
  const capacityVelocity = Math.sqrt(2 * G * C * C * (s - 1) * dPakai);

  return {
    d50,
    // Batu dianggap bola dengan garis tengah d50.
    stoneMass: s * rho * (Math.PI / 6) * Math.pow(dPakai, 3),
    // Tebal lapisan yang lazim disyaratkan dua kali garis tengah batu.
    layerThickness: 2 * dPakai,
    capacityVelocity,
    utilisation: capacityVelocity > 0 ? V / capacityVelocity : Infinity,
    stable: dPakai >= d50,
  };
}

/* ------------------------------------------------------------------ *
 * Tangga ikan berkolam
 * ------------------------------------------------------------------ */

export type PoolFishwayResult = {
  Q: number;
  /** Daya yang dilesapkan tiap kolam, watt */
  power: number;
  /** Daya lesap per satuan isi kolam, watt per meter kubik */
  powerDensity: number;
  /** Isi satu kolam, meter kubik */
  poolVolume: number;
  /** Banyaknya kolam yang dibutuhkan untuk naik setinggi itu */
  poolCount: number;
  /** Panjang tangga ikan seluruhnya searah aliran, meter */
  totalLength: number;
  /** Kecepatan di celah antar kolam */
  slotVelocity: number;
  /** Benar bila lesapan dayanya melampaui batas yang dapat dilewati ikan */
  tooTurbulent: boolean;
  /** Benar bila kecepatan celah melampaui kecepatan sentak ikan rancangan */
  tooFast: boolean;
};

/**
 * Batas lesapan daya per satuan isi kolam, watt per meter kubik.
 *
 * Angka ini yang paling menentukan rancangan tangga ikan berkolam, dan ia
 * kesepakatan dari pengamatan lapangan, bukan hasil turunan. Nilai yang
 * lazim dipakai berbeda menurut jenis ikannya: ikan salmon besar menerima
 * sampai 200, ikan sungai tropis yang lebih kecil jauh lebih rendah.
 */
export const FISHWAY_POWER_SALMON = 200;
export const FISHWAY_POWER_GENERAL = 150;
export const FISHWAY_POWER_WEAK = 100;

/**
 * Tangga ikan berkolam dengan celah tegak.
 *
 * Debit lewat celah tegak dihitung sebagai lubang bebas dengan beda tinggi
 * muka air antar kolam:
 *
 *   Q = Cd b0 y sqrt(2 g dh)
 *
 * Yang menentukan apakah ikan sanggup melewatinya bukan debitnya melainkan
 * seberapa deras air itu berputar di dalam kolam. Ukurannya daya yang
 * dilesapkan tiap satuan isi kolam:
 *
 *   eps = rho g Q dh / V_kolam
 *
 * Kolam yang terlalu kecil untuk debit yang lewat menjadi teraduk sedemikian
 * rupa sehingga ikan kehilangan arah dan tidak menemukan celah berikutnya,
 * walaupun kecepatan celahnya sendiri masih sanggup dilawan.
 *
 * Rujukan: FAO/DVWK (2002), Fish Passes: Design, Dimensions and Monitoring;
 * Larinier (2002), Pool fishways, pre-barrages and natural bypass channels,
 * Bulletin Francais de la Peche et de la Pisciculture 364.
 */
export function poolFishway(
  /** Beda tinggi muka air antar kolam, meter */
  dh: number,
  /** Panjang kolam searah aliran, meter */
  poolLength: number,
  /** Lebar kolam, meter */
  poolWidth: number,
  /** Kedalaman air di kolam, meter */
  poolDepth: number,
  /** Lebar celah tegak, meter */
  slotWidth: number,
  /** Beda tinggi seluruhnya yang harus dinaiki, meter */
  totalRise: number,
  /** Koefisien debit celah */
  Cd = 0.65,
  rho = 1000
): PoolFishwayResult {
  const Q = Cd * slotWidth * poolDepth * Math.sqrt(2 * G * Math.max(dh, 0));
  const poolVolume = poolLength * poolWidth * poolDepth;
  const power = rho * G * Q * Math.max(dh, 0);
  const powerDensity = poolVolume > 0 ? power / poolVolume : Infinity;
  const poolCount = dh > 0 ? Math.ceil(totalRise / dh) : Infinity;

  return {
    Q,
    power,
    powerDensity,
    poolVolume,
    poolCount,
    totalLength: Number.isFinite(poolCount) ? poolCount * poolLength : Infinity,
    // Kecepatan di celah dari beda tinggi muka air, bukan dari debit dibagi
    // luas: yang dirasakan ikan kecepatan pancaran, dan itu ditentukan beda
    // tinggi tekannya.
    slotVelocity: Math.sqrt(2 * G * Math.max(dh, 0)),
    tooTurbulent: powerDensity > FISHWAY_POWER_GENERAL,
    tooFast: false,
  };
}

/* ------------------------------------------------------------------ *
 * Tangga ikan Denil
 * ------------------------------------------------------------------ */

export type DenilResult = {
  Q: number;
  /** Kecepatan rata-rata di dalam palung */
  meanVelocity: number;
  /** Kecepatan terbesar di sumbu palung, yang harus dilawan ikan */
  maxVelocity: number;
  /** Kedalaman aliran diukur tegak lurus dasar palung */
  depth: number;
  /** Daya lesap per satuan isi palung */
  powerDensity: number;
  /** Panjang palung tanpa kolam istirahat, meter */
  runLength: number;
  /** Benar bila kemiringannya di luar rentang rancangan Denil */
  slopeOutOfRange: boolean;
  /** Benar bila palungnya terlalu panjang tanpa kolam istirahat */
  needsRestPool: boolean;
  /**
   * Perbandingan lesapan dayanya terhadap batas tangga ikan berkolam.
   *
   * Angkanya hampir selalu jauh di atas satu, dan itu bukan cacat melainkan
   * ciri alat ini: tangga Denil memang jauh lebih teraduk daripada tangga
   * berkolam. Itulah harga yang dibayar untuk lintasan yang jauh lebih
   * pendek, dan alasan Denil hanya dipakai untuk jenis ikan yang kuat
   * berenang serta selalu disertai kolam istirahat.
   */
  powerRatioToPool: number;
};

/** Batas kemiringan tangga Denil yang lazim dipakai. */
export const DENIL_SLOPE_MIN = 0.1;
export const DENIL_SLOPE_MAX = 0.25;
/** Panjang palung terpanjang tanpa kolam istirahat, meter. */
export const DENIL_RUN_MAX = 10;

/**
 * Tangga ikan Denil dengan sirip penahan miring ke hulu.
 *
 * Yang membuat alat ini bekerja bukan penghalangan melainkan pembalikan:
 * sirip yang miring ke hulu memaksa sebagian air berputar balik di dekat
 * dinding dan dasar, dan putaran balik itu melesap tenaga tanpa menutup
 * lintasan di tengah palung. Ikan berenang di sepanjang sumbu, tempat airnya
 * masih mengalir maju tetapi jauh lebih lambat daripada kemiringan palungnya
 * seharusnya membuatnya.
 *
 * Debitnya dinyatakan dalam bentuk tak berdimensi yang dipakai pada
 * rancangan Denil baku:
 *
 *   Q / (b^2,5 sqrt(g)) = f(y/b, S)
 *
 * dengan bentuk yang mengikuti kurva rancangan Bell. Pendekatan yang dipakai
 * di sini linear terhadap kedalaman nisbi dan berakar terhadap kemiringan,
 * yang cocok dengan pita data pada rentang kemiringan yang disyaratkan.
 *
 * Rujukan: Denil (1909); Bell, M.C. (1991), Fisheries Handbook of
 * Engineering Requirements; Katopodis (1992), Introduction to fishway design.
 */
export function denilFishway(
  /** Lebar palung antar sirip, meter */
  width: number,
  /** Kedalaman aliran tegak lurus dasar, meter */
  depth: number,
  /** Kemiringan palung */
  slope: number,
  /** Beda tinggi seluruhnya yang harus dinaiki, meter */
  totalRise: number,
  rho = 1000
): DenilResult {
  const yb = width > 0 ? depth / width : 0;
  const Qstar = 0.94 * yb * Math.sqrt(Math.max(slope, 0)) + 0.16 * yb * yb;
  const Q = Qstar * Math.pow(width, 2.5) * Math.sqrt(G);

  const luas = width * depth;
  const meanVelocity = luas > 0 ? Q / luas : 0;
  // Kecepatan di sumbu palung kira-kira satu setengah kali kecepatan
  // rata-rata; itulah yang harus dilawan ikan, bukan rata-ratanya.
  const maxVelocity = 1.5 * meanVelocity;

  const runLength = slope > 0 ? totalRise / slope : Infinity;
  const isiPerMeter = luas;
  const powerDensity =
    isiPerMeter > 0 ? (rho * G * Q * slope) / isiPerMeter : Infinity;

  return {
    Q,
    meanVelocity,
    maxVelocity,
    depth,
    powerDensity,
    runLength,
    slopeOutOfRange: slope < DENIL_SLOPE_MIN || slope > DENIL_SLOPE_MAX,
    needsRestPool: Number.isFinite(runLength) && runLength > DENIL_RUN_MAX,
    powerRatioToPool: powerDensity / FISHWAY_POWER_GENERAL,
  };
}

/* ------------------------------------------------------------------ *
 * Lintasan ikan bertingkat
 * ------------------------------------------------------------------ */

export type CascadeResult = {
  /** Beda tinggi tiap undakan, meter */
  stepDrop: number;
  /** Banyaknya undakan */
  stepCount: number;
  /** Kedalaman kolam yang dibutuhkan agar loncatan terlesap, meter */
  requiredPoolDepth: number;
  /** Tinggi lompatan yang dituntut dari ikan, meter */
  jumpHeight: number;
  /** Kecepatan terkecil yang memungkinkan melompat setinggi itu, lompatan tegak */
  requiredBurst: number;
  /** Kecepatan yang dibutuhkan bila melompat pada sudut empat puluh lima derajat */
  requiredBurst45: number;
  /** Daya lesap per satuan isi kolam */
  powerDensity: number;
  /** Benar bila undakannya terlalu tinggi untuk dilompati ikan rancangan */
  tooHigh: boolean;
  /** Benar bila kolamnya terlalu dangkal untuk melesapkan terjunannya */
  poolTooShallow: boolean;
};

/**
 * Perbandingan kedalaman kolam terhadap tinggi terjun yang lazim disyaratkan
 * agar terjunannya terlesap dan tidak menghantam dasar kolam.
 */
export const CASCADE_POOL_RATIO = 1.25;

/**
 * Lintasan ikan bertingkat, yaitu rangkaian bendung kecil berurutan.
 *
 * Bentuk ini yang paling sering dipakai di sungai kecil karena dapat dibuat
 * dari batu setempat tanpa beton. Yang menentukan keberhasilannya dua hal
 * yang saling bertentangan: undakan harus cukup rendah untuk dilompati atau
 * direnangi ikan, dan kolam di bawahnya harus cukup dalam untuk melesapkan
 * terjunannya. Menurunkan tinggi undakan memperbanyak jumlah undakan dan
 * memperpanjang seluruh lintasan, dan panjang itu yang menjadi batas
 * anggaran maupun lahan.
 *
 * Tinggi lompat yang dituntut dihitung dari lintasan peluru: ikan yang
 * meninggalkan air dengan kecepatan u pada sudut terbaik mencapai tinggi
 * u kuadrat dibagi empat g bila sudutnya empat puluh lima derajat.
 *
 * Rujukan: FAO/DVWK (2002); Larinier (2002); Powers & Orsborn (1985),
 * Analysis of barriers to upstream fish migration.
 */
export function cascadePassage(
  /** Beda tinggi seluruhnya, meter */
  totalRise: number,
  /** Banyaknya undakan */
  steps: number,
  /** Panjang kolam searah aliran, meter */
  poolLength: number,
  /** Lebar kolam, meter */
  poolWidth: number,
  /** Kedalaman kolam yang direncanakan, meter */
  poolDepth: number,
  /** Debit yang lewat, meter kubik per detik */
  Q: number,
  /** Kecepatan sentak ikan rancangan, m/s */
  burstSpeed: number,
  rho = 1000
): CascadeResult {
  const stepDrop = steps > 0 ? totalRise / steps : totalRise;
  const poolVolume = poolLength * poolWidth * poolDepth;
  const powerDensity =
    poolVolume > 0 ? (rho * G * Q * stepDrop) / poolVolume : Infinity;

  /*
   * Kecepatan yang dibutuhkan untuk melompati undakan setinggi itu.
   *
   * Batas fisisnya lompatan TEGAK, u = sqrt(2 g h), dan tidak ada sudut
   * lompat yang menuntut lebih sedikit daripada itu. Lompatan pada sudut
   * empat puluh lima derajat menuntut akar dua kali lebih besar, karena
   * separuh tenaganya terpakai untuk maju mendatar.
   *
   * Yang dipakai sebagai penanda batas fisisnya, bukan sudut tertentu:
   * menandai undakan sebagai tidak terlewati padahal masih mungkin dilompati
   * tegak akan menolak rancangan yang sesungguhnya berjalan. Keduanya tetap
   * ditampilkan, karena selisihnya empat puluh satu persen dan itu selisih
   * yang menentukan pada rancangan yang ketat.
   */
  const jumpHeight = stepDrop;
  const requiredBurst = Math.sqrt(2 * G * Math.max(jumpHeight, 0));
  const requiredBurst45 = requiredBurst * Math.SQRT2;

  return {
    stepDrop,
    stepCount: steps,
    requiredPoolDepth: CASCADE_POOL_RATIO * stepDrop,
    jumpHeight,
    requiredBurst,
    requiredBurst45,
    powerDensity,
    tooHigh: requiredBurst > burstSpeed,
    poolTooShallow: poolDepth < CASCADE_POOL_RATIO * stepDrop,
  };
}

/* ==================================================================== *
 *                                                                      *
 *  AIR TANAH, REMBESAN, DAN GEOTEKNIK BENDUNGAN — keluarga G           *
 *                                                                      *
 *  Tujuh lembar terakhir pekan ketiga. Yang menyatukannya bukan bentuk  *
 *  gambarnya melainkan pokoknya: air yang bergerak di dalam bahan,      *
 *  bukan di atasnya, dan bangunan tanah yang menahannya.                *
 *                                                                      *
 * ==================================================================== */

/* ------------------------------------------------------------------ *
 * Bantu: luas dan titik berat poligon
 * ------------------------------------------------------------------ *
 * Dipakai dua kali pada lembar stabilitas bendungan, sekali untuk badan
 * betonnya dan sekali untuk diagram tekanan angkat di bawah dasarnya.
 * Menghitung keduanya dengan rumus trapesium yang ditulis tangan adalah
 * cara paling mudah membuat momen yang salah tanda, jadi keduanya lewat
 * satu pintu yang sama.
 */

export type PolyProps = { area: number; cx: number; cz: number };

export function polygonProps(pts: { x: number; z: number }[]): PolyProps {
  let a2 = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const silang = p.x * q.z - q.x * p.z;
    a2 += silang;
    cx += (p.x + q.x) * silang;
    cz += (p.z + q.z) * silang;
  }
  const luas = a2 / 2;
  if (Math.abs(luas) < 1e-15)
    return { area: 0, cx: pts[0]?.x ?? 0, cz: pts[0]?.z ?? 0 };
  return { area: Math.abs(luas), cx: cx / (3 * a2), cz: cz / (3 * a2) };
}

/* ------------------------------------------------------------------ *
 * GW-01  Garis freatik pada bendungan urugan: parabola Kozeny
 * ------------------------------------------------------------------ */

/**
 * Koreksi titik masuk Casagrande.
 *
 * Garis freatik yang sebenarnya memotong lereng hulu tegak lurus, sedangkan
 * parabola dasarnya tidak. Casagrande memundurkan titik pangkal parabola
 * sejauh tiga persepuluh proyeksi mendatar lereng hulu yang terendam, lalu
 * bagian antara keduanya digambar sebagai peralihan yang mulus.
 */
export const CASAGRANDE_ENTRY = 0.3;

/** Berat jenis butir dan angka pori baku untuk gradien kritis. */
export const SOIL_GS = 2.65;
export const SOIL_VOID_RATIO = 0.7;

/** Gradien kritis: pada nilai ini tegangan efektif di muka keluaran habis. */
export function criticalGradient(Gs = SOIL_GS, e = SOIL_VOID_RATIO): number {
  return (Gs - 1) / (1 + e);
}

export type EmbankmentGeometry = {
  /** Sudut badan bendungan, meter */
  body: { x: number; z: number }[];
  /** Absis kaki hulu, selalu nol */
  toeUp: number;
  /** Absis kaki hilir */
  toeDown: number;
  /** Absis pangkal dan ujung mercu */
  crestFrom: number;
  crestTo: number;
};

export function embankmentSection(
  damHeight: number,
  crestWidth: number,
  mUp: number,
  mDown: number
): EmbankmentGeometry {
  const crestFrom = mUp * damHeight;
  const crestTo = crestFrom + crestWidth;
  const toeDown = crestTo + mDown * damHeight;
  return {
    body: [
      { x: 0, z: 0 },
      { x: crestFrom, z: damHeight },
      { x: crestTo, z: damHeight },
      { x: toeDown, z: 0 },
    ],
    toeUp: 0,
    toeDown,
    crestFrom,
    crestTo,
  };
}

export type SeepageResult = {
  geometry: EmbankmentGeometry;
  /** Permeabilitas setara, akar hasil kali mendatar dan tegak, m/s */
  kEq: number;
  /** Faktor pemampatan absis pada penampang terubah */
  squeeze: number;
  /** Absis fokus parabola, yaitu pangkal drainase kaki, meter */
  focus: number;
  /** Jarak mendatar titik masuk terkoreksi ke fokus, penampang TERUBAH */
  d: number;
  /** Setengah parameter parabola Kozeny, meter. Sekaligus rembesan dibagi k */
  y0: number;
  /** Debit rembesan tiap meter panjang bendungan, m3/s tiap m */
  q: number;
  /** Debit yang sama dalam liter tiap hari tiap meter, karena angkanya kecil */
  qLitreDay: number;
  /** Titik-titik garis freatik pada penampang NYATA */
  phreatic: { x: number; z: number }[];
  /** Benar bila garis freatik memotong lereng hilir di atas drainase */
  daylights: boolean;
  /** Panjang drainase terpendek yang menahan freatik di dalam badan, meter */
  drainNeeded: number;
  /** Kemiringan garis freatik di fokus pada penampang terubah. Selalu satu */
  exitSlope: number;
  /** Gradien kritis butirannya */
  iCritical: number;
  /** Gradien rata-rata sepanjang badan, pendekatan Dupuit */
  iMean: number;
  /** Rembesan menurut Dupuit, untuk pembanding silang */
  qDupuit: number;
  /** Salah bila airnya melampaui mercu atau drainasenya melampaui kaki */
  valid: boolean;
};

/**
 * Rembesan melalui bendungan urugan homogen berdrainase kaki mendatar.
 *
 * Dasar penyelesaiannya parabola Kozeny: seluruh garis aliran di dalam
 * bendungan adalah parabola sefokus, dan garis freatik adalah salah satu
 * di antaranya. Dengan fokus di pangkal drainase dan sumbu mendatar,
 *
 *     z kuadrat = y0 kuadrat + 2 y0 x,
 *
 * dengan x diukur ke hulu dari fokus. Melewatkan parabola itu pada titik
 * masuk terkoreksi setinggi H sejauh d memberi
 *
 *     y0 = akar(d kuadrat + H kuadrat) − d,
 *
 * dan debit rembesannya persis k dikali y0. Tidak ada iterasi di mana pun
 * pada lembar ini: seluruhnya bentuk tertutup.
 *
 * Tanah yang permeabilitas mendatarnya berbeda dari yang tegak dikerjakan
 * pada penampang terubah, yaitu penampang yang seluruh absisnya dikalikan
 * akar kv per kh, dengan permeabilitas setara akar kh kali kv. Akibatnya
 * yang pantas diperhatikan: pada permeabilitas rata-rata ukur yang sama,
 * tanah yang mendatarnya lebih lolos MEREMBESKAN LEBIH BANYAK, karena
 * penampang terubahnya menjadi lebih pendek dan gradiennya naik.
 *
 * Rujukan: Casagrande, A. (1937). Seepage through dams. J. New England
 * Water Works Assoc. 51(2); Cedergren, H.R. (1989). Seepage, Drainage and
 * Flow Nets, edisi ke-3; USBR (1987). Design of Small Dams, edisi ke-3.
 */
export function seepageLine(
  /** Kedalaman air hulu, meter */
  H: number,
  /** Tinggi bendungan, meter */
  damHeight: number,
  /** Lebar mercu, meter */
  crestWidth: number,
  /** Kemiringan hulu, mendatar tiap satu tegak */
  mUp: number,
  /** Kemiringan hilir, mendatar tiap satu tegak */
  mDown: number,
  /** Panjang drainase kaki hilir, meter */
  drainLength: number,
  /** Permeabilitas mendatar, m/s */
  kh: number,
  /** Permeabilitas tegak, m/s */
  kv: number,
  Gs = SOIL_GS,
  e = SOIL_VOID_RATIO
): SeepageResult {
  const geometry = embankmentSection(damHeight, crestWidth, mUp, mDown);
  const kEq = Math.sqrt(Math.max(kh, 1e-30) * Math.max(kv, 1e-30));
  const squeeze = Math.sqrt(Math.max(kv, 1e-30) / Math.max(kh, 1e-30));

  const focus = geometry.toeDown - drainLength;

  /* Titik masuk nyata pada lereng hulu, lalu koreksi Casagrande ke hulu. */
  const masuk = mUp * H;
  const masukKoreksi = masuk * (1 - CASAGRANDE_ENTRY);
  const d = Math.max((focus - masukKoreksi) * squeeze, 1e-9);

  const y0 = Math.sqrt(d * d + H * H) - d;
  const q = kEq * y0;

  /* Garis freatik pada penampang nyata. Absis terubah ke hulu dari fokus
     dibagi kembali dengan faktor pemampatannya. */
  const phreatic: { x: number; z: number }[] = [];
  const langkah = 120;
  for (let i = 0; i <= langkah; i++) {
    const xi = (d * i) / langkah;
    const z = Math.sqrt(y0 * y0 + 2 * y0 * xi);
    phreatic.push({ x: focus - xi / squeeze, z });
  }
  phreatic.reverse();

  /*
   * Apakah parabolanya keluar di lereng hilir.
   *
   * Diperiksa di SEPANJANG lereng, bukan hanya di pangkal drainasenya.
   * Membandingkan tinggi freatik dengan muka lereng di satu titik saja akan
   * meloloskan keadaan yang parabolanya memotong lereng beberapa meter di
   * hulu pangkal drainase, dan keadaan itu ada: tinggi freatik tumbuh seperti
   * akar sedangkan muka lereng tumbuh lurus, jadi keduanya dapat berpotongan
   * dua kali.
   */
  const keluar = (y0_: number, d_: number, Ld: number) => {
    const f = geometry.toeDown - Ld;
    const n = 200;
    for (let i = 0; i <= n; i++) {
      const xi = (d_ * i) / n;
      const x = f - xi / squeeze;
      if (x < geometry.crestTo) break;
      const z = Math.sqrt(y0_ * y0_ + 2 * y0_ * xi);
      const muka = (geometry.toeDown - x) / Math.max(mDown, 1e-9);
      if (z > muka + 1e-9) return true;
    }
    return false;
  };
  const daylights = keluar(y0, d, drainLength);

  /*
   * Panjang drainase terpendek yang menahan freatik di dalam badan.
   *
   * Dicari dengan bagi dua memakai UJI KELUAR YANG SAMA dengan yang dipakai
   * menandai keadaan sekarang, bukan dengan syarat pendek buatan sendiri.
   * Dengan begitu angka yang ditampilkan sebagai panjang yang dituntut tidak
   * dapat bertentangan dengan penanda di sebelahnya, dan itulah cacat yang
   * sudah dibayar tiga kali pada pekan pertama.
   */
  const cukup = (Ld: number) => {
    const f = geometry.toeDown - Ld;
    const dd = Math.max((f - masukKoreksi) * squeeze, 1e-9);
    const yy = Math.sqrt(dd * dd + H * H) - dd;
    return !keluar(yy, dd, Ld);
  };
  let lo = 0;
  let hi = Math.max(geometry.toeDown - geometry.crestTo, 1e-6);
  let drainNeeded = hi;
  if (cukup(hi)) {
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (cukup(mid)) hi = mid;
      else lo = mid;
    }
    drainNeeded = hi;
  }

  /*
   * Kemiringan garis freatik tepat di fokus.
   *
   * Turunan parabolanya dz/dx sama dengan y0 dibagi z, dan di fokus z sama
   * dengan y0, jadi kemiringannya SATU apa pun ukuran bendungannya. Itu
   * bukan kebetulan melainkan sifat parabola, dan artinya air masuk ke
   * drainase pada empat puluh lima derajat pada penampang terubah, berapa
   * pun tinggi airnya.
   */
  const exitSlope = 1;

  const iCritical = criticalGradient(Gs, e);
  const iMean = H / Math.max(d / Math.max(squeeze, 1e-30), 1e-9);
  const qDupuit = (kEq * H * H) / (2 * d);

  return {
    geometry,
    kEq,
    squeeze,
    focus,
    d,
    y0,
    q,
    qLitreDay: q * 1000 * 86400,
    phreatic,
    daylights,
    drainNeeded,
    exitSlope,
    iCritical,
    iMean,
    qDupuit,
    valid: H <= damHeight && drainLength < geometry.toeDown - geometry.crestTo,
  };
}

/* ------------------------------------------------------------------ *
 * GW-02  Kerucut penurunan di sekitar sumur pompa
 * ------------------------------------------------------------------ */

/** Tetapan Sichardt untuk taksiran jari-jari pengaruh. */
export const SICHARDT_C = 3000;

export type WellResult = {
  confined: boolean;
  /** Keterusan akuifer tertekan, meter persegi tiap detik */
  T: number;
  /** Penurunan di dinding sumur akibat akuifernya sendiri, meter */
  sAquifer: number;
  /** Kehilangan tinggi tekan di sumurnya sendiri, meter */
  sWellLoss: number;
  /** Penurunan seluruhnya yang terukur di dalam sumur, meter */
  sTotal: number;
  /** Tinggi muka air di dinding sumur di atas dasar akuifer, meter */
  hWell: number;
  /** Debit tiap satuan penurunan, meter persegi tiap detik */
  specificCapacity: number;
  /** Debit terbesar sebelum muka air mencapai dasar akuifer, m3/s */
  Qmax: number;
  /** Jari-jari tempat penurunannya tepat separuh penurunan di sumur */
  halfRadius: number;
  /** Taksiran Sichardt untuk jari-jari pengaruh, meter */
  sichardt: number;
  /** Perbandingan penurunan tak tertekan terhadap rumus tertekan */
  unconfinedRatio: number;
  /** Benar bila sumurnya kering pada debit itu */
  dry: boolean;
  /** Benar bila penurunannya melampaui seperempat tebal akuifer bebas */
  deepDrawdown: boolean;
};

/** Penurunan pada jarak r dari sumbu sumur, meter. */
export function wellDrawdownAt(
  r: number,
  Q: number,
  k: number,
  thickness: number,
  rw: number,
  R: number,
  confined: boolean
): number {
  const rr = Math.min(Math.max(r, rw), R);
  const ln = Math.log(R / rr);
  if (confined) {
    const T = k * thickness;
    return T > 0 ? (Q * ln) / (2 * Math.PI * T) : Infinity;
  }
  const sisa = thickness * thickness - (Q * ln) / (Math.PI * Math.max(k, 1e-30));
  if (sisa <= 0) return thickness;
  return thickness - Math.sqrt(sisa);
}

/**
 * Sumur tunggal pada aliran tunak: rumus Thiem.
 *
 * Akuifer tertekan memberi penurunan berbanding lurus dengan debit,
 *
 *     s = Q ln(R/r) / (2 pi T),
 *
 * sedangkan akuifer bebas bekerja pada KUADRAT tinggi muka airnya,
 *
 *     H kuadrat − h kuadrat = Q ln(R/r) / (pi k).
 *
 * Dua hal yang pantas diperhatikan dan keduanya berasal dari logaritma itu.
 * Pertama, separuh penurunan terjadi di dalam jari-jari akar R kali rw,
 * yaitu rata-rata UKUR jari-jari sumur dan jari-jari pengaruh, bukan rata-
 * rata hitungnya. Pada sumur berjari-jari sepersepuluh meter dengan
 * pengaruh tiga ratus meter, itu berarti separuh seluruh penurunan sudah
 * selesai dalam lima setengah meter pertama. Kedua, jari-jari pengaruh yang
 * ditaksir kasar tidak semerusak yang dikira, karena ia berada di dalam
 * logaritma: melipatempatkannya mengubah penurunan hanya sebesar ln 4
 * dibagi ln(R per rw).
 *
 * Rujukan: Thiem, G. (1906). Hydrologische Methoden; Kruseman, G.P. & de
 * Ridder, N.A. (1990). Analysis and Evaluation of Pumping Test Data, ILRI
 * 47; Jacob, C.E. (1947). Drawdown test to update potential yield of well.
 */
export function pumpingWell(
  /** Debit pemompaan, meter kubik tiap detik */
  Q: number,
  /** Permeabilitas, m/s */
  k: number,
  /** Tebal akuifer tertekan atau tinggi muka air mula-mula, meter */
  thickness: number,
  /** Jari-jari sumur, meter */
  rw: number,
  /** Jari-jari pengaruh, meter */
  R: number,
  confined: boolean,
  /** Tetapan kehilangan sumur menurut Jacob */
  wellLossC = 0
): WellResult {
  const T = k * thickness;
  const lnR = Math.log(Math.max(R, rw * 1.0001) / Math.max(rw, 1e-6));

  const Qmax = confined ? Infinity : (Math.PI * k * thickness * thickness) / lnR;
  const dry = !confined && Q >= Qmax;

  const sAquifer = wellDrawdownAt(rw, Q, k, thickness, rw, R, confined);
  const sWellLoss = wellLossC * Q * Q;
  const sTotal = sAquifer + sWellLoss;
  const hWell = Math.max(thickness - sAquifer, 0);

  /*
   * Jari-jari tempat penurunannya separuh penurunan di sumur.
   *
   * Untuk akuifer tertekan hasilnya akar R kali rw dengan tepat, karena
   * ln(R/r) harus separuh ln(R/rw). Untuk akuifer bebas tidak persis, sebab
   * yang berbanding lurus dengan logaritma adalah selisih kuadratnya, dan
   * angka ini dicari dengan bagi dua supaya keduanya diperlakukan sama.
   */
  let halfRadius = Math.sqrt(R * rw);
  if (!confined && sAquifer > 0) {
    let lo = rw;
    let hi = R;
    for (let i = 0; i < 60; i++) {
      const mid = Math.sqrt(lo * hi);
      const s = wellDrawdownAt(mid, Q, k, thickness, rw, R, confined);
      if (s > sAquifer / 2) lo = mid;
      else hi = mid;
    }
    halfRadius = Math.sqrt(lo * hi);
  }

  const sichardt = SICHARDT_C * sAquifer * Math.sqrt(Math.max(k, 0));
  const sTertekan = T > 0 ? (Q * lnR) / (2 * Math.PI * T) : Infinity;

  return {
    confined,
    T,
    sAquifer,
    sWellLoss,
    sTotal,
    hWell,
    specificCapacity: sTotal > 0 ? Q / sTotal : Infinity,
    Qmax,
    halfRadius,
    sichardt,
    unconfinedRatio: sTertekan > 0 ? sAquifer / sTertekan : 1,
    dry,
    deepDrawdown: !confined && sAquifer > 0.25 * thickness,
  };
}

/* ------------------------------------------------------------------ *
 * GW-03  Tanggapan muka air tanah terhadap hujan dan pemompaan
 * ------------------------------------------------------------------ */

export type AquiferResponse = {
  /** Tetapan waktu akuifer, hari */
  tau: number;
  /** Muka air rata-rata pada keadaan tunak, meter di atas ambang keluaran */
  meanHead: number;
  /** Simpangan muka air dari rata-ratanya, meter */
  amplitude: number;
  /** Simpangan yang sama seandainya akuifernya tanpa simpanan, meter */
  amplitudeUndamped: number;
  /** Peredaman simpangan, nol sampai satu */
  damping: number;
  /** Tundaan puncak muka air terhadap puncak imbuhan, hari */
  lag: number;
  /** Tundaan itu sebagai bagian dari satu musim */
  lagFraction: number;
  /** Deret waktu hasil hitungan langkah demi langkah, satu musim terakhir */
  series: { t: number; head: number; recharge: number }[];
  /** Simpangan yang TERBACA dari deret di atas, untuk pembanding silang */
  amplitudeSim: number;
  /** Tundaan yang TERBACA dari deret di atas, hari */
  lagSim: number;
  /**
   * Benar bila ayunan musimannya cukup besar untuk dibaca puncaknya.
   *
   * Deret yang datar tidak punya puncak, jadi tundaan yang terbaca darinya
   * tidak berarti apa-apa. Menyatakannya di sini lebih jujur daripada
   * memulangkan angka yang kebetulan keluar dari pencarian nilai terbesar.
   */
  seasonal: boolean;
  /** Benar bila muka airnya pernah turun di bawah ambang keluaran */
  runsDry: boolean;
  minHead: number;
  maxHead: number;
  /** Debit keluaran rata-rata, milimeter tiap hari */
  baseflow: number;
};

/**
 * Akuifer sebagai satu tampungan lurus.
 *
 * Simpanan tertentu dikali laju perubahan muka air sama dengan imbuhan
 * dikurangi pemompaan dikurangi keluaran, dan keluarannya diambil
 * berbanding lurus dengan muka airnya sendiri:
 *
 *     Sy dh/dt = R(t) − P − alfa h.
 *
 * Itulah umpan balik dan tundaan yang ditanyakan lembar ini. Umpan
 * baliknya suku alfa h: makin tinggi muka airnya makin deras ia mengalir
 * keluar, sehingga sistemnya menarik dirinya sendiri kembali. Tundaannya
 * simpanan Sy: air yang masuk tidak segera menjadi muka air melainkan
 * harus mengisi pori lebih dulu. Tetapan waktunya hasil bagi keduanya.
 *
 * Tanggapan terhadap imbuhan yang berayun sepanjang musim punya bentuk
 * tertutup yang pantas dihafal:
 *
 *     peredaman = 1 / akar(1 + (omega tau) kuadrat),
 *     tundaan   = arctan(omega tau) / omega,
 *
 * dan yang paling berguna dari keduanya: TUNDAANNYA TIDAK PERNAH LEBIH
 * DARI SEPEREMPAT MUSIM. Akuifer selambat apa pun tidak dapat membuat
 * muka air tanahnya memuncak pada musim yang berlawanan, dan lapangan yang
 * puncaknya jauh lebih terlambat daripada tiga bulan pasti menerima
 * imbuhan yang bukan hujan setempat.
 *
 * Rujukan: Kraijenhoff van de Leur, D.A. (1958). A study of non-steady
 * groundwater flow; Gelhar, L.W. (1974). Stochastic analysis of phreatic
 * aquifers, Water Resour. Res. 10(3); Cuthbert, M.O. (2014). Straight
 * thinking about groundwater recession, Water Resour. Res. 50(3).
 */
export function aquiferResponse(
  /** Imbuhan rata-rata, milimeter tiap hari */
  rechargeMean: number,
  /** Simpangan imbuhan musiman, milimeter tiap hari */
  rechargeSwing: number,
  /** Pemompaan tetap yang disebar atas luasnya, milimeter tiap hari */
  pumping: number,
  /** Simpanan tertentu, tanpa satuan */
  Sy: number,
  /** Tetapan resesi keluaran, meter tiap hari tiap meter muka air */
  alpha: number,
  /** Panjang musim, hari */
  period = 365,
  /** Lama hitungan, hari */
  span = 365 * 5
): AquiferResponse {
  const tau = Sy / Math.max(alpha, 1e-9);
  const omega = (2 * Math.PI) / period;

  /** milimeter tiap hari menjadi meter tiap hari */
  const m = (mm: number) => mm / 1000;

  const hMean = m(rechargeMean - pumping) / Math.max(alpha, 1e-12);
  const damping = 1 / Math.sqrt(1 + omega * tau * omega * tau);
  const amplitudeUndamped = m(rechargeSwing) / Math.max(alpha, 1e-12);
  const amplitude = amplitudeUndamped * damping;
  const lag = Math.atan(omega * tau) / omega;

  /* Hitungan langkah demi langkah, Runge-Kutta orde empat.
     dh/dt = (R(t) − P − alfa h) / Sy, seluruhnya dalam meter dan hari. */
  const imbuhan = (t: number) =>
    m(rechargeMean + rechargeSwing * Math.sin(omega * t));
  const laju = (t: number, h: number) =>
    (imbuhan(t) - m(pumping) - alpha * h) / Math.max(Sy, 1e-9);

  const dt = 0.25;
  const series: { t: number; head: number; recharge: number }[] = [];
  let h = hMean;
  let runsDry = false;
  let minHead = Infinity;
  let maxHead = -Infinity;

  for (let t = 0; t <= span + 1e-9; t += dt) {
    if (t >= span - period - 1e-9) {
      minHead = Math.min(minHead, h);
      maxHead = Math.max(maxHead, h);
      series.push({
        t: t - (span - period),
        head: h,
        recharge: imbuhan(t) * 1000,
      });
      if (h < 0) runsDry = true;
    }
    const k1 = laju(t, h);
    const k2 = laju(t + dt / 2, h + (dt * k1) / 2);
    const k3 = laju(t + dt / 2, h + (dt * k2) / 2);
    const k4 = laju(t + dt, h + dt * k3);
    h += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
  }

  /* Simpangan dan tundaan yang TERBACA dari deretnya, bukan dari rumusnya.
     Keduanya dibandingkan dengan rumusnya di blok verifikasi. */
  const amplitudeSim = (maxHead - minHead) / 2;
  let tPuncak = 0;
  let tertinggi = -Infinity;
  for (const p of series)
    if (p.head > tertinggi) {
      tertinggi = p.head;
      tPuncak = p.t;
    }
  /* Puncak imbuhan jatuh seperempat musim sesudah awal deret yang dipotong,
     karena span dipilih kelipatan bulat musimnya. */
  let lagSim = tPuncak - period / 4;
  while (lagSim < -period / 2) lagSim += period;
  while (lagSim > period / 2) lagSim -= period;

  return {
    tau,
    meanHead: hMean,
    amplitude,
    amplitudeUndamped,
    damping,
    lag,
    lagFraction: lag / period,
    series,
    amplitudeSim,
    lagSim,
    seasonal: amplitudeSim > 1e-4,
    runsDry,
    minHead: Number.isFinite(minHead) ? minHead : hMean,
    maxHead: Number.isFinite(maxHead) ? maxHead : hMean,
    baseflow: alpha * hMean * 1000,
  };
}

/* ------------------------------------------------------------------ *
 * DM-01  Stabilitas bendungan beton gravitasi
 * ------------------------------------------------------------------ */

export const WATER_UNIT_WEIGHT = 9.81;
export const CONCRETE_UNIT_WEIGHT = 24;
/** Sisa tekanan angkat di garis tirisan bila tirisannya bekerja baik. */
export const UPLIFT_DRAIN_RESIDUAL = 1 / 3;

export type DamStability = {
  section: { x: number; z: number }[];
  /** Diagram tekanan angkat di bawah dasar, sebagai poligon kPa terhadap x */
  upliftShape: { x: number; z: number }[];
  /** Berat badan bendungan tiap meter panjang, kN */
  weight: number;
  /** Absis titik berat badan dari tumit, meter */
  weightArm: number;
  /** Gaya angkat seluruhnya tiap meter panjang, kN */
  uplift: number;
  upliftArm: number;
  /** Dorongan air hulu dan hilir, kN */
  thrustUp: number;
  thrustDown: number;
  sumV: number;
  sumH: number;
  /** Absis resultan pada dasar, diukur dari tumit, meter */
  resultantAt: number;
  /** Simpangan resultan dari tengah dasar, meter */
  eccentricity: number;
  /** Tegangan dasar di tumit dan di ujung kaki, kPa */
  heelStress: number;
  toeStress: number;
  fsOverturning: number;
  fsSliding: number;
  /** Benar bila resultannya keluar dari sepertiga tengah dasar */
  tension: boolean;
  /** Lebar dasar terkecil yang membuat tumitnya tidak tertarik, meter */
  baseNoTension: number;
  valid: boolean;
};

/** Inti hitungannya, dipakai juga oleh pencarian lebar dasar terkecil. */
function damCore(
  damHeight: number,
  a: number,
  B: number,
  H: number,
  Ht: number,
  drainResidual: number,
  drainAt: number,
  upliftOn: boolean,
  gammaC: number,
  gammaW: number
) {
  const aa = Math.min(a, B);
  const section = [
    { x: 0, z: 0 },
    { x: 0, z: damHeight },
    { x: aa, z: damHeight },
    { x: B, z: 0 },
  ];
  const badan = polygonProps(section);
  const weight = gammaC * badan.area;

  /*
   * Diagram tekanan angkat.
   *
   * Tinggi tekan di tumit sama dengan kedalaman air hulu dan di ujung kaki
   * sama dengan kedalaman air hilir. Bila ada tirisan, tinggi tekan di garis
   * tirisan turun menjadi air hilir ditambah sisa bagiannya dari selisih
   * keduanya, lalu lurus ke kiri dan ke kanan dari titik itu.
   */
  const xd = Math.min(Math.max(drainAt, 0), 1) * B;
  const hDrain = Ht + drainResidual * (H - Ht);
  const puncak = !upliftOn
    ? [
        { x: 0, z: 0 },
        { x: B, z: 0 },
      ]
    : drainResidual >= 1 || xd <= 0 || xd >= B
      ? [
          { x: 0, z: -gammaW * H },
          { x: B, z: -gammaW * Ht },
        ]
      : [
          { x: 0, z: -gammaW * H },
          { x: xd, z: -gammaW * hDrain },
          { x: B, z: -gammaW * Ht },
        ];
  const upliftShape = [{ x: 0, z: 0 }, ...puncak, { x: B, z: 0 }];
  const diagram = polygonProps(upliftShape);

  const thrustUp = 0.5 * gammaW * H * H;
  const thrustDown = 0.5 * gammaW * Ht * Ht;
  const sumV = weight - diagram.area;
  const sumH = thrustUp - thrustDown;

  /*
   * Letak resultan pada dasar, diukur dari tumit.
   *
   * Momen seluruh gaya terhadap tumit harus sama dengan momen resultan
   * tegaknya. Gaya mendatar ikut masuk lewat ketinggian titik tangkapnya,
   * sepertiga kedalaman airnya masing-masing dari dasar.
   */
  const momen =
    weight * badan.cx -
    diagram.area * diagram.cx +
    (thrustUp * H) / 3 -
    (thrustDown * Ht) / 3;
  const resultantAt = sumV !== 0 ? momen / sumV : Infinity;

  return {
    section,
    upliftShape,
    badan,
    diagram,
    weight,
    thrustUp,
    thrustDown,
    sumV,
    sumH,
    momen,
    resultantAt,
    e: resultantAt - B / 2,
  };
}

/**
 * Bendungan beton gravitasi: guling, geser, dan daya dukung.
 *
 * Penampangnya segitiga bermercu: muka hulu tegak, mercu selebar a, muka
 * hilir melandai sampai lebar dasar B. Berat, titik berat, gaya angkat, dan
 * lengannya seluruhnya dihitung dari poligon lewat satu pintu yang sama,
 * bukan dari rumus trapesium yang ditulis ulang tiap kali.
 *
 * Yang paling pantas diperhatikan pada lembar ini bukan angka faktor
 * keamanannya melainkan UMPAN BALIK yang tersembunyi di baliknya. Bila
 * resultan keluar dari sepertiga tengah dasar, tumitnya tertarik; beton
 * tidak menahan tarik, jadi tumitnya retak; retakan itu terisi air, jadi
 * tekanan angkat bekerja penuh sepanjang retakan; tekanan angkat yang naik
 * menggeser resultan lebih jauh lagi ke arah kaki. Itu sebabnya aturan
 * sepertiga tengah tidak diperlakukan sebagai batas kenyamanan melainkan
 * sebagai batas mutlak.
 *
 * Yang kedua: tekanan angkat, bukan dorongan air, yang paling sering
 * menjatuhkan hitungan ini. Tirisan yang menurunkan tekanan angkat di garis
 * tirisan menjadi sepertiganya sering menaikkan faktor geser lebih banyak
 * daripada melebarkan dasarnya satu meter, dan jauh lebih murah.
 *
 * Rujukan: USBR (1976). Design of Gravity Dams; USACE (1995). Gravity Dam
 * Design, EM 1110-2-2200; Novak, P. dkk. (2007). Hydraulic Structures,
 * edisi ke-4, bab 4.
 */
export function gravityDam(
  /** Tinggi bendungan, meter */
  damHeight: number,
  /** Lebar mercu, meter */
  crestWidth: number,
  /** Lebar dasar, meter */
  baseWidth: number,
  /** Kedalaman air hulu, meter */
  H: number,
  /** Kedalaman air hilir, meter */
  Ht: number,
  /** Koefisien gesek dasar */
  mu: number,
  /** Kohesi dasar, kPa */
  cohesion: number,
  /** Bagian tekanan angkat yang tersisa di garis tirisan, nol sampai satu */
  drainResidual = 1,
  /** Letak garis tirisan sebagai bagian lebar dasar dari tumit */
  drainAt = 0.1,
  /** Salah bila tekanan angkat sengaja ditiadakan, untuk perbandingan */
  upliftOn = true,
  gammaC = CONCRETE_UNIT_WEIGHT,
  gammaW = WATER_UNIT_WEIGHT
): DamStability {
  const a = Math.min(crestWidth, baseWidth);
  const c = damCore(
    damHeight, a, baseWidth, H, Ht, drainResidual, drainAt, upliftOn, gammaC, gammaW
  );

  const B = baseWidth;
  const rata = c.sumV / Math.max(B, 1e-9);
  const heelStress = rata * (1 - (6 * c.e) / Math.max(B, 1e-9));
  const toeStress = rata * (1 + (6 * c.e) / Math.max(B, 1e-9));

  const momenGuling =
    (c.thrustUp * H) / 3 + c.diagram.area * (B - c.diagram.cx);
  const momenTahan =
    c.weight * (B - c.badan.cx) + (c.thrustDown * Ht) / 3;

  /*
   * Lebar dasar terkecil yang membebaskan tumit dari tarikan.
   *
   * Untuk penampang segitiga tanpa mercu dan tanpa air hilir, hasilnya
   * bentuk tertutup yang terbit di buku teks: tinggi air dibagi akar rapat
   * massa jenis betonnya bila tanpa angkat, dan dibagi akar rapat massa
   * jenis itu dikurangi satu bila angkatnya penuh. Di sini dicari dengan
   * bagi dua supaya berlaku juga untuk penampang bermercu dan bertirisan.
   */
  const tertarik = (bb: number) =>
    damCore(
      damHeight, a, bb, H, Ht, drainResidual, drainAt, upliftOn, gammaC, gammaW
    ).e >
    bb / 6;
  let lo = Math.max(a, 1e-3);
  let hi = Math.max(20 * Math.max(damHeight, 1), lo * 4);
  let baseNoTension = hi;
  if (!tertarik(hi)) {
    for (let i = 0; i < 70; i++) {
      const mid = (lo + hi) / 2;
      if (tertarik(mid)) lo = mid;
      else hi = mid;
    }
    baseNoTension = hi;
  }

  return {
    section: c.section,
    upliftShape: c.upliftShape,
    weight: c.weight,
    weightArm: c.badan.cx,
    uplift: c.diagram.area,
    upliftArm: c.diagram.cx,
    thrustUp: c.thrustUp,
    thrustDown: c.thrustDown,
    sumV: c.sumV,
    sumH: c.sumH,
    resultantAt: c.resultantAt,
    eccentricity: c.e,
    heelStress,
    toeStress,
    fsOverturning: momenGuling > 0 ? momenTahan / momenGuling : Infinity,
    fsSliding:
      c.sumH > 0 ? (mu * c.sumV + cohesion * B) / c.sumH : Infinity,
    tension: Math.abs(c.e) > B / 6,
    baseNoTension,
    valid: H <= damHeight && Ht <= H && B > a,
  };
}

/* ------------------------------------------------------------------ *
 * DM-02  Gradasi filter bendungan
 * ------------------------------------------------------------------ */

/** Angka baku sebaran normal pada persen lolos yang dipakai kriteria filter. */
const Z_LOLOS: Record<number, number> = {
  10: -1.2815515655446004,
  15: -1.0364333894937898,
  50: 0,
  60: 0.2533471031357997,
  85: 1.0364333894937898,
  90: 1.2815515655446004,
};

export const FILTER_RETAIN = 4;
export const FILTER_DRAIN = 4;
export const FILTER_CU_MAX = 20;
export const FILTER_D50_RATIO_MAX = 25;
/** Tetapan Hazen untuk pasir bersih, k dalam cm/s bila D10 dalam cm. */
export const HAZEN_C = 100;

export type Gradation = {
  d50: number;
  cu: number;
  /** Simpangan baku logaritma natural garis tengah butirannya */
  sigma: number;
  d10: number;
  d15: number;
  d60: number;
  d85: number;
  d90: number;
  /** Permeabilitas menurut Hazen, m/s */
  k: number;
};

/** Menyusun gradasi log-normal dari garis tengah tengah dan keseragamannya. */
export function gradation(d50: number, cu: number): Gradation {
  const sigma = Math.log(Math.max(cu, 1.0001)) / (Z_LOLOS[60] - Z_LOLOS[10]);
  const D = (p: number) => d50 * Math.exp(Z_LOLOS[p] * sigma);
  const d10 = D(10);
  return {
    d50,
    cu,
    sigma,
    d10,
    d15: D(15),
    d60: D(60),
    d85: D(85),
    d90: D(90),
    /* Hazen memberi cm/s untuk D10 dalam cm; d10 di sini dalam milimeter */
    k: (HAZEN_C * (d10 / 10) * (d10 / 10)) / 100,
  };
}

/** Sebaran normal baku, hampiran Abramowitz & Stegun 26.2.17. */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

/** Persen lolos pada garis tengah tertentu, kebalikan dari gradation. */
export function passingAt(g: Gradation, d: number): number {
  if (g.sigma <= 0) return d >= g.d50 ? 100 : 0;
  const z = Math.log(Math.max(d, 1e-12) / g.d50) / g.sigma;
  return 100 * normalCdf(z);
}

/** Garis tengah pada persen lolos tertentu, arah maju dari gradation. */
export function sizeAt(g: Gradation, percent: number): number {
  const p = Math.min(Math.max(percent, 0.01), 99.99) / 100;
  /* Kebalikan sebaran normal, hampiran Acklam yang dipangkas ke satu cabang */
  const t = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p));
  const z0 =
    t -
    (2.515517 + 0.802853 * t + 0.010328 * t * t) /
      (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
  const z = p < 0.5 ? -z0 : z0;
  return g.d50 * Math.exp(z * g.sigma);
}

export type FilterResult = {
  base: Gradation;
  filter: Gradation;
  /** Batas bawah dan batas atas D15 filter yang diperbolehkan, milimeter */
  d15Min: number;
  d15Max: number;
  /** Lebar jendela itu sebagai perbandingan, sama dengan D85 per D15 tanah */
  window: number;
  retains: boolean;
  drains: boolean;
  uniform: boolean;
  d50Ratio: boolean;
  passes: boolean;
  /** Perbandingan permeabilitas filter terhadap tanah dasarnya */
  kRatio: number;
  /** Jendela yang sama dinyatakan dalam D50 filter, supaya dapat digambar */
  d50Min: number;
  d50Max: number;
};

/**
 * Kriteria filter Terzaghi.
 *
 * Dua syaratnya menarik ke arah yang berlawanan. Filter harus cukup halus
 * untuk menahan butiran tanah yang dilindunginya,
 *
 *     D15 filter tidak lebih dari empat kali D85 tanah,
 *
 * dan cukup kasar untuk mengalirkan air lebih lancar daripada tanahnya,
 *
 *     D15 filter tidak kurang dari empat kali D15 tanah.
 *
 * Bagi keduanya dan angka empatnya saling menghapus: LEBAR JENDELA YANG
 * TERSEDIA PERSIS SAMA DENGAN D85 TANAH DIBAGI D15 TANAH, yaitu rentang
 * gradasi tanah yang dilindungi itu sendiri. Tanah yang seragam hampir
 * tidak memberi pilihan filter sama sekali, dan tanah bergradasi lebar
 * memberi pilihan yang longgar. Itu kesimpulan yang tidak terbaca dari
 * kedua syaratnya bila dibaca satu per satu.
 *
 * Akibat kedua dari syarat kedua: karena permeabilitas kira-kira sebanding
 * dengan kuadrat garis tengah butiran, filter yang memenuhi syarat aliran
 * SELALU sekurangnya enam belas kali lebih lolos daripada tanah yang
 * dilindunginya. Filter bukan lapisan yang sedikit lebih kasar.
 *
 * Rujukan: Terzaghi, K. (1922); Bertram, G.E. (1940). An experimental
 * investigation of protective filters, Harvard Soil Mechanics Series 7;
 * Sherard, J.L. & Dunnigan, L.P. (1989). Critical filters for impervious
 * soils, J. Geotech. Eng. 115(7); USBR (2011). Design Standards No. 13,
 * bab 5: Protective Filters.
 */
export function filterDesign(
  baseD50: number,
  baseCu: number,
  filterD50: number,
  filterCu: number
): FilterResult {
  const base = gradation(baseD50, baseCu);
  const filter = gradation(filterD50, filterCu);

  const d15Min = FILTER_DRAIN * base.d15;
  const d15Max = FILTER_RETAIN * base.d85;

  const retains = filter.d15 <= d15Max;
  const drains = filter.d15 >= d15Min;
  const uniform = filter.cu <= FILTER_CU_MAX;
  const d50Ratio = filter.d50 <= FILTER_D50_RATIO_MAX * base.d50;

  /* Jendela yang sama dinyatakan dalam D50 filter, supaya dapat digambar
     sebagai pita tegak pada bidang gradasi. Perbandingan D50 terhadap D15
     tetap selama keseragaman filternya tidak diubah. */
  const bagi = filter.d50 / Math.max(filter.d15, 1e-12);

  return {
    base,
    filter,
    d15Min,
    d15Max,
    window: base.d85 / Math.max(base.d15, 1e-12),
    retains,
    drains,
    uniform,
    d50Ratio,
    passes: retains && drains && uniform && d50Ratio,
    kRatio: filter.k / Math.max(base.k, 1e-30),
    d50Min: d15Min * bagi,
    d50Max: d15Max * bagi,
  };
}

/* ------------------------------------------------------------------ *
 * DM-03  Aliran melalui tubuh bendungan urugan batu
 * ------------------------------------------------------------------ */

/** Tetapan suku kental dan suku inersia pada persamaan Ergun. */
export const ERGUN_VISCOUS = 150;
export const ERGUN_INERTIAL = 1.75;
/** Bilangan Reynolds pori tempat hukum Darcy mulai ditinggalkan. */
export const PORE_RE_DARCY = 10;

export type RockflowResult = {
  /** Tetapan suku lurus, detik tiap meter */
  A: number;
  /** Tetapan suku kuadrat, detik kuadrat tiap meter persegi */
  B: number;
  /** Permeabilitas Darcy yang berlaku pada gradien sangat kecil, m/s */
  kDarcy: number;
  i: number;
  /** Kecepatan semu melalui seluruh penampang, m/s */
  v: number;
  /** Kecepatan yang akan diramalkan hukum Darcy pada gradien yang sama */
  vDarcy: number;
  /** Berapa kali Darcy melebih-lebihkan alirannya */
  overprediction: number;
  /** Debit tiap meter lebar melalui tebal yang diberikan, m3/s tiap m */
  q: number;
  /** Bilangan Reynolds pori */
  poreRe: number;
  /** Bagian gradien yang dihabiskan suku kuadrat */
  turbulentShare: number;
  /** Kemiringan garis pada bidang log-log, antara setengah dan satu */
  exponent: number;
  darcyValid: boolean;
};

/**
 * Aliran melalui urugan batu: persamaan Ergun.
 *
 * Hukum Darcy tidak berlaku pada batu. Gradien hidrauliknya bukan
 * berbanding lurus dengan kecepatan melainkan mengandung dua suku,
 *
 *     i = A v + B v kuadrat,
 *
 * dengan suku pertama berasal dari kekentalan dan suku kedua dari inersia
 * air yang berbelok terus-menerus di antara batunya. Pada batu berukuran
 * sentimeter ke atas, suku keduanya menguasai hampir seluruh gradien.
 *
 * Akibatnya satu kalimat yang mengubah cara membaca seluruh soal drainase
 * urugan batu: KECEPATANNYA SEBANDING DENGAN AKAR GRADIEN, bukan dengan
 * gradien. Menggandakan beda tinggi tidak menggandakan alirannya melainkan
 * menaikkannya empat puluh satu persen saja. Dan sebaliknya, menghitung
 * kapasitas urugan batu dengan permeabilitas Darcy yang diukur pada gradien
 * kecil akan melebih-lebihkan alirannya, sering sepuluh kali lipat atau
 * lebih. Perbandingan itu ditampilkan sebagai angka tersendiri di lembar
 * ini, karena itulah kesalahan yang paling sering terjadi.
 *
 * Pembalikannya bentuk tertutup, akar persamaan kuadrat, tanpa iterasi.
 *
 * Rujukan: Ergun, S. (1952). Fluid flow through packed columns, Chem. Eng.
 * Prog. 48(2); Wilkins, J.K. (1956). Flow of water through rockfill;
 * Leps, T.M. (1973). Flow through rockfill, dalam Embankment Dam
 * Engineering; Stephenson, D. (1979). Rockfill in Hydraulic Engineering.
 */
export function rockfillFlow(
  /** Gradien hidraulik, beda tinggi dibagi panjang lintasan */
  i: number,
  /** Garis tengah butiran setara, meter */
  d: number,
  /** Porositas urugan */
  n: number,
  /** Tebal lapisan tembus air, meter */
  thickness: number,
  /** Suhu air, derajat Celsius */
  TCelsius = 20
): RockflowResult {
  const nu = waterViscosity(TCelsius);
  const nn = Math.min(Math.max(n, 0.05), 0.7);
  const dd = Math.max(d, 1e-6);

  const A =
    (ERGUN_VISCOUS * (1 - nn) * (1 - nn) * nu) / (nn * nn * nn * G * dd * dd);
  const B = (ERGUN_INERTIAL * (1 - nn)) / (nn * nn * nn * G * dd);

  const kDarcy = 1 / A;
  const ii = Math.max(i, 0);

  /*
   * v dari i = A v + B v kuadrat, akar positifnya.
   *
   * Ditulis sebagai 2i dibagi (A + akar), bukan sebagai (−A + akar) dibagi
   * 2B. Keduanya sama persis secara aljabar dan SANGAT BERBEDA di mesin.
   * Bentuk yang kedua mengurangkan dua bilangan yang hampir sama ketika
   * gradiennya kecil, dan pada urugan berbutir sentimeter dengan porositas
   * rendah ia kehilangan dua angka berarti: hukum Darcy yang seharusnya
   * dipulangkan dengan tepat meleset satu persen. Bentuk yang dipakai di
   * sini tidak pernah mengurangkan apa pun, jadi batas Darcynya pulang
   * dengan ketelitian mesin.
   */
  const v =
    B > 0
      ? (2 * ii) / (A + Math.sqrt(A * A + 4 * B * ii))
      : ii / Math.max(A, 1e-30);

  const vDarcy = kDarcy * ii;
  const poreRe = (v * dd) / (nu * (1 - nn));
  const turbulentShare = ii > 0 ? (B * v * v) / ii : 0;

  /*
   * Kemiringan pada bidang log-log, diturunkan apa adanya.
   *
   * di/dv = A + 2 B v, jadi dln v per dln i = (A v + B v kuadrat) dibagi
   * (A v + 2 B v kuadrat). Di ujung kental hasilnya satu, di ujung inersia
   * setengah, dan tidak pernah di luar keduanya.
   */
  const exponent = v > 0 ? (A * v + B * v * v) / (A * v + 2 * B * v * v) : 1;

  return {
    A,
    B,
    kDarcy,
    i: ii,
    v,
    vDarcy,
    overprediction: v > 0 ? vDarcy / v : 1,
    q: v * thickness,
    poreRe,
    turbulentShare,
    exponent,
    darcyValid: poreRe < PORE_RE_DARCY,
  };
}

/** Gradien yang dibutuhkan untuk kecepatan tertentu, arah maju persamaannya. */
export function rockfillGradient(
  v: number,
  d: number,
  n: number,
  TCelsius = 20
): number {
  const r = rockfillFlow(0, d, n, 1, TCelsius);
  return r.A * v + r.B * v * v;
}

/* ------------------------------------------------------------------ *
 * SY-01  Regulasi tidur: model dua proses
 * ------------------------------------------------------------------ */

/** Tetapan waktu naik dan turunnya tekanan tidur, jam. */
export const SLEEP_TAU_RISE = 18.2;
export const SLEEP_TAU_FALL = 4.2;
/**
 * Aras rata-rata ambang atas dan ambang bawah.
 *
 * Daan, Beersma & Borbely memakai irama harian berbentuk dua harmonik.
 * Di sini iramanya satu harmonik saja supaya dapat diturunkan dengan
 * tangan, dan ambang bawahnya disetel sedikit ke atas supaya jadwal bebas
 * jatuh di sekitar delapan jam sebagaimana pada modelnya yang asli.
 */
export const SLEEP_H0 = 0.6;
export const SLEEP_L0 = 0.2;
/** Simpangan irama harian dan jam puncaknya. */
export const SLEEP_AMPLITUDE = 0.1;
export const SLEEP_ACROPHASE = 20;

export type SleepEpisode = { onset: number; wake: number; duration: number };

/** Jadwal yang dipaksakan jam dinding, atau kosong bila dibiarkan bebas. */
export type SleepSchedule = { bedtime: number; wakeTime: number };

export type SleepResult = {
  series: {
    t: number;
    S: number;
    upper: number;
    lower: number;
    asleep: boolean;
  }[];
  episodes: SleepEpisode[];
  /** Jam tidur dan bangun pada daur terakhir */
  onsetClock: number;
  wakeClock: number;
  /** Lama tidur rata-rata pada tiga daur terakhir, jam */
  meanDuration: number;
  /** Tekanan tidur saat bangun dan saat mulai tidur pada daur terakhir */
  Swake: number;
  Sonset: number;
  /** Tekanan tidur saat bangun yang dituju daur itu, bentuk tertutup */
  SwakeSteady: number;
  /** Lama berbaring sebelum tertidur pada jadwal yang dipaksakan, jam */
  latency: number;
  /** Benar bila pada jam tidurnya tekanan tidur belum mencapai ambang atas */
  cannotSleepYet: boolean;
  /** Benar bila jadwalnya memaksa dan tidurnya menjadi lebih pendek */
  restricted: boolean;
  /** Kekurangan tidur terhadap jadwal bebas, jam tiap hari */
  debtHours: number;
  /**
   * Panjang daur bebasnya menurut bentuk tertutup, jam.
   *
   * Tanpa irama harian, daurnya hanya waktu naik dari ambang bawah ke ambang
   * atas ditambah waktu turun kembali. Tujuh belas jam, bukan dua puluh
   * empat.
   */
  freePeriod: number;
  /** Panjang daur yang sesungguhnya terjadi, terbaca dari dua awal tidur */
  cyclePeriod: number;
  /** Benar bila daurnya terkunci pada dua puluh empat jam */
  entrained: boolean;
  /**
   * Benar bila daurnya sudah berulang sama.
   *
   * Pada simpangan irama yang sedang, model ini masuk ke daerah yang
   * daurnya SETENGAH TERKUNCI: panjangnya berubah dari malam ke malam dan
   * tidak pernah menetap. Keadaan itu bukan cacat hitungan melainkan
   * ramalan modelnya, dan bentuk tertutup tekanan tidur yang mengandaikan
   * daur berulang tidak berlaku di situ. Menyatakannya di sini mencegah
   * lembar ini menampilkan angka yang tidak berarti apa-apa.
   */
  steady: boolean;
  /** Benar bila ada petang tempat ambangnya naik lebih cepat daripada S */
  forbiddenZone: boolean;
  forbiddenHours: number;
  valid: boolean;
};

/** Irama harian, puncaknya pada jam akrofase. */
export function circadian(t: number, amplitude = SLEEP_AMPLITUDE): number {
  return amplitude * Math.cos((2 * Math.PI * (t - SLEEP_ACROPHASE)) / 24);
}

/** Tekanan tidur sesudah terjaga selama dt jam. */
export function sleepRise(S: number, dt: number, tau = SLEEP_TAU_RISE): number {
  return 1 - (1 - S) * Math.exp(-dt / tau);
}

/** Tekanan tidur sesudah tidur selama dt jam. */
export function sleepFall(S: number, dt: number, tau = SLEEP_TAU_FALL): number {
  return S * Math.exp(-dt / tau);
}

/** Lama terjaga yang dibutuhkan untuk naik dari S ke sasaran, jam. */
export function wakeTimeTo(
  S: number,
  target: number,
  tau = SLEEP_TAU_RISE
): number {
  if (target <= S) return 0;
  if (target >= 1) return Infinity;
  return -tau * Math.log((1 - target) / (1 - S));
}

/** Lama tidur yang dibutuhkan untuk turun dari S ke sasaran, jam. */
export function sleepTimeTo(
  S: number,
  target: number,
  tau = SLEEP_TAU_FALL
): number {
  if (target >= S) return 0;
  if (target <= 0) return Infinity;
  return tau * Math.log(S / target);
}

/**
 * Model dua proses Borbely: tekanan tidur dan irama harian.
 *
 * Proses S naik menuju satu selama terjaga dan turun menuju nol selama
 * tidur, keduanya secara eksponensial dengan tetapan waktu yang SANGAT
 * BERBEDA: delapan belas jam untuk naik, empat jam untuk turun. Proses C
 * tidak menyimpan apa pun; ia hanya menaikturunkan dua ambang sepanjang
 * hari. Pada jadwal bebas, tidur mulai ketika S mencapai ambang atas dan
 * berhenti ketika S turun ke ambang bawah.
 *
 * Empat hal yang membuat model ini pantas dipelajari sebagai model SISTEM,
 * bukan hanya sebagai model tidur.
 *
 * Pertama, lama tidurnya tidak ditetapkan di mana pun. Tidak ada tetapan
 * delapan jam di dalam model ini. Lamanya muncul sendiri dari pertemuan
 * satu keadaan yang menyimpan dengan dua ambang yang berayun.
 *
 * Kedua, iramanya bukan sumber daurnya. Matikan proses C seluruhnya dan
 * daurnya tetap ada, hanya panjangnya menjadi tujuh belas jam, bukan dua
 * puluh empat. Yang dikerjakan irama harian bukan menciptakan daur itu
 * melainkan MENGUNCINYA ke dua puluh empat jam. Itu perbedaan yang sama
 * dengan perbedaan antara pendulum dan jam.
 *
 * Ketiga, jadwal yang memaksa tidur lebih pendek tidak membuat tekanan tidur
 * naik tanpa batas. Ia menetap pada aras baru yang lebih tinggi lalu diam di
 * situ, dan aras itu punya bentuk tertutup. Sistemnya tetap mantap; yang
 * berubah hanya titik mantapnya. Itu sebabnya orang yang kurang tidur
 * menahun berhenti merasa bertambah buruk padahal tetap berada di aras yang
 * buruk.
 *
 * Keempat, jadwal yang memaksa tidur lebih AWAL tidak menambah tidur sama
 * sekali. Bila pada jam tidurnya tekanan tidur belum mencapai ambang atas,
 * yang terjadi bukan tidur melainkan berbaring, dan lamanya berbaring itu
 * dihitung di lembar ini sebagai waktu tunggu. Model ini meramalkan bahwa
 * majukan jam tidur satu jam akan menghasilkan satu jam terjaga, bukan satu
 * jam tidur tambahan.
 *
 * Rujukan: Borbely, A.A. (1982). A two process model of sleep regulation,
 * Hum. Neurobiol. 1(3); Daan, S., Beersma, D.G.M. & Borbely, A.A. (1984).
 * Timing of human sleep, Am. J. Physiol. 246(2); Achermann, P. & Borbely,
 * A.A. (2003). Mathematical models of sleep regulation, Front. Biosci. 8;
 * Strogatz, S.H. (1986). The Mathematical Structure of the Human
 * Sleep-Wake Cycle.
 */
export function sleepRegulation(
  /** Simpangan irama harian */
  amplitude = SLEEP_AMPLITUDE,
  /** Aras ambang atas */
  H0 = SLEEP_H0,
  /** Aras ambang bawah */
  L0 = SLEEP_L0,
  /** Jadwal yang dipaksakan, atau kosong bila dibiarkan bebas */
  schedule: SleepSchedule | null = null,
  /** Banyaknya hari yang dihitung */
  days = 12,
  tauRise = SLEEP_TAU_RISE,
  tauFall = SLEEP_TAU_FALL
): SleepResult {
  const dt = 1 / 12;
  const atas = (t: number) => H0 + circadian(t, amplitude);
  const bawah = (t: number) => L0 + circadian(t, amplitude);

  const series: SleepResult["series"] = [];
  const episodes: SleepEpisode[] = [];
  const langkah = Math.round((days * 24) / dt);

  /** Benar bila jam dinding itu berada di dalam jendela tidur jadwalnya. */
  const dalamJendela = (jam: number) => {
    if (!schedule) return false;
    const a = ((schedule.bedtime % 24) + 24) % 24;
    const b = ((schedule.wakeTime % 24) + 24) % 24;
    return a <= b ? jam >= a && jam < b : jam >= a || jam < b;
  };

  let S = 0.3;
  let asleep = false;
  let onset = 0;
  let berbaring = 0;
  /* Waktu tunggu tiap malam, dirata-ratakan atas malam-malam yang sama
     dengan yang dipakai merata-ratakan lama tidurnya. Merata-ratakan
     keduanya atas himpunan malam yang berbeda membuat jumlah keduanya tidak
     lagi sama dengan lebar jendelanya, dan itu selisih yang tidak berarti
     apa-apa selain salah hitung. */
  const tunggu: number[] = [];

  for (let i = 0; i <= langkah; i++) {
    const t = i * dt;
    const jam = ((t % 24) + 24) % 24;
    series.push({ t, S, upper: atas(t), lower: bawah(t), asleep });

    if (schedule) {
      /*
       * Jadwal menentukan KAPAN BOLEH tidur, bukan kapan tertidur. Di dalam
       * jendelanya, orang tetap harus menunggu tekanan tidurnya mencapai
       * ambang atas; selama menunggu ia terjaga dan tekanannya tetap naik.
       */
      const boleh = dalamJendela(jam);
      if (!boleh && asleep) {
        asleep = false;
        episodes.push({ onset, wake: t, duration: t - onset });
      } else if (boleh && !asleep) {
        if (berbaring === 0) berbaring = t;
        if (S >= atas(t)) {
          asleep = true;
          onset = t;
          tunggu.push(t - berbaring);
          berbaring = 0;
        }
      }
      if (!boleh) berbaring = 0;
    } else if (!asleep && S >= atas(t)) {
      asleep = true;
      onset = t;
    } else if (asleep && S <= bawah(t)) {
      asleep = false;
      episodes.push({ onset, wake: t, duration: t - onset });
    }

    S = asleep ? sleepFall(S, dt, tauFall) : sleepRise(S, dt, tauRise);
  }

  const belakang = episodes.slice(-3);
  const tungguAkhir = tunggu.slice(-belakang.length);
  const meanLatency =
    tungguAkhir.length > 0
      ? tungguAkhir.reduce((a, b) => a + b, 0) / tungguAkhir.length
      : 0;
  const meanDuration =
    belakang.length > 0
      ? belakang.reduce((a, e) => a + e.duration, 0) / belakang.length
      : 0;
  const terakhir = episodes[episodes.length - 1];
  const onsetClock = terakhir ? ((terakhir.onset % 24) + 24) % 24 : 0;
  const wakeClock = terakhir ? ((terakhir.wake % 24) + 24) % 24 : 0;

  const iOnset = terakhir ? Math.round(terakhir.onset / dt) : 0;
  const iWake = terakhir ? Math.round(terakhir.wake / dt) : 0;
  const Sonset = series[Math.min(iOnset, series.length - 1)]?.S ?? 0;
  const Swake = series[Math.min(iWake, series.length - 1)]?.S ?? 0;

  /*
   * Panjang daur yang sesungguhnya terjadi, dibaca dari dua awal tidur
   * berturut-turut. Dua puluh empat jam hanya bila iramanya cukup kuat
   * untuk mengunci; tanpa irama, daurnya tujuh belas jam.
   */
  const cyclePeriod =
    episodes.length >= 3
      ? episodes[episodes.length - 1].onset - episodes[episodes.length - 2].onset
      : 24;

  /*
   * Aras mantap tekanan tidur saat bangun, bentuk tertutup.
   *
   * Pada daur yang berulang sepanjang P, kenaikan selama terjaga harus persis
   * menghapus penurunan selama tidur. Dengan lama tidur D dan lama terjaga
   * P − D,
   *
   *     Sbangun = [1 − (1 − Sbangun) e^(−(P−D)/tr)] e^(−D/tf),
   *
   * dan itu dapat diselesaikan langsung terhadap Sbangun:
   *
   *     Sbangun = ef (1 − er) / (1 − ef er).
   *
   * Yang dipakai P DAUR SEBENARNYA, bukan dua puluh empat jam. Memakai dua
   * puluh empat di situ benar untuk orang yang iramanya terkunci dan salah
   * sebesar sembilan belas persen untuk daur bebas tujuh belas jam, dan
   * kesalahan seperti itu tidak akan pernah terlihat pada nilai bawaan
   * lembar ini karena pada nilai bawaan iramanya memang terkunci.
   */
  const D = meanDuration;
  const P = Math.max(cyclePeriod, D + 0.1);
  const ef = Math.exp(-D / tauFall);
  const er = Math.exp(-(P - D) / tauRise);
  const SwakeSteady = D > 0 ? (ef * (1 - er)) / (1 - ef * er) : 0;

  /*
   * Panjang daur bebasnya, diturunkan apa adanya.
   *
   * Tanpa irama harian, ambangnya tetap, dan daurnya hanya jumlah waktu naik
   * dari ambang bawah ke ambang atas dan waktu turun kembali.
   */
  const freePeriod =
    H0 < 1 && L0 > 0 && H0 > L0
      ? wakeTimeTo(L0, H0, tauRise) + sleepTimeTo(H0, L0, tauFall)
      : Infinity;

  /* Jadwal bebas sebagai pembanding, untuk menghitung kekurangan tidurnya */
  let bebas = meanDuration;
  if (schedule)
    bebas = sleepRegulation(amplitude, H0, L0, null, days, tauRise, tauFall)
      .meanDuration;

  /*
   * Petang yang terlarang untuk tidur.
   *
   * Pada sore menjelang malam, irama harian menaikkan ambang atas. Bila ia
   * menaikkannya lebih cepat daripada tekanan tidur naik mengejarnya, jarak
   * keduanya justru MELEBAR, dan ada beberapa jam ketika orang yang sudah
   * lelah tetap tidak dapat tertidur. Jamnya justru tepat sebelum jam
   * tidurnya yang biasa.
   *
   * Yang menentukan ada atau tidaknya petang itu adalah simpangan irama
   * hariannya. Laju naik ambang paling besar adalah simpangan dikali dua pi
   * per dua puluh empat, sedangkan laju naik tekanan tidur di petang hari
   * kira-kira sepertiga dibagi delapan belas jam. Pada simpangan kecil,
   * petang itu tidak ada sama sekali.
   */
  let forbiddenHours = 0;
  if (terakhir) {
    const mulai = Math.max(iOnset - Math.round(14 / dt), 1);
    for (let i = mulai; i < iOnset; i++) {
      const p = series[i];
      if (!p || p.asleep) continue;
      const naikS = (1 - p.S) / tauRise;
      const naikAmbang = (atas(p.t + dt) - atas(p.t - dt)) / (2 * dt);
      if (naikAmbang > naikS) forbiddenHours += dt;
    }
  }

  return {
    series,
    episodes,
    onsetClock,
    wakeClock,
    meanDuration,
    Swake,
    Sonset,
    SwakeSteady,
    latency: meanLatency,
    cannotSleepYet: meanLatency > 0.25,
    restricted: !!schedule && meanDuration < bebas - 0.1,
    debtHours: Math.max(bebas - meanDuration, 0),
    freePeriod,
    cyclePeriod,
    entrained: Math.abs(cyclePeriod - 24) < 0.1,
    steady: (() => {
      if (episodes.length < 4) return false;
      const d3 = belakang.map((e) => e.duration);
      const rentang = Math.max(...d3) - Math.min(...d3);
      const antara = episodes
        .slice(-3)
        .map((e, i, a) => (i ? e.onset - a[i - 1].onset : NaN))
        .filter((v) => !Number.isNaN(v));
      const rentangAntara =
        antara.length > 1 ? Math.max(...antara) - Math.min(...antara) : 0;
      return rentang < 0.2 && rentangAntara < 0.2;
    })(),
    forbiddenZone: forbiddenHours > 0.5,
    forbiddenHours,
    valid: H0 > L0 && H0 + amplitude < 1 && L0 - amplitude > 0,
  };
}
