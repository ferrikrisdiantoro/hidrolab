/**
 * MODUL REGRESI — dipindahkan dari proyek cl42 ke HidroLab, lembar HY-05.
 *
 * Enam bentuk yang sama dengan cl42, yang dulu diminta klien karena ada di
 * garis tren MS Excel: linear, polinomial, eksponensial, pangkat,
 * logaritmik, dan rata-rata bergerak. Semuanya kini dihitung di peramban;
 * cl42 mengirim datanya ke rute API di peladen, dan HidroLab tidak punya
 * peladen.
 *
 * Empat cacat cl42 yang tidak ikut pindah:
 *
 * 1. Kurva tergambar sebagai garis yang menghubungkan nilai prediksi DI
 *    TITIK DATA, menurut urutan baris tabel. Data yang tidak urut x-nya
 *    tergambar sebagai garis yang bolak-balik, dan kurva polinomial di
 *    antara titik datanya tidak pernah tergambar. Di sini kurvanya fungsi
 *    yang dievaluasi rapat di sepanjang sumbu.
 * 2. R², MAE, dan RMSE bentuk eksponensial, pangkat, dan logaritmik
 *    dihitung atas SEMUA baris, termasuk yang dibuang karena nilainya nol
 *    atau negatif, dengan prediksi nol atau prediksi dari rumus yang tidak
 *    berlaku di situ. Di sini metriknya hanya atas pasangan yang dipakai,
 *    dan jumlah yang dibuang ditulis.
 * 3. Rata-rata bergerak di titik-titik awal memakai rata-rata semua titik
 *    sebelumnya, padahal Excel tidak menggambar apa pun sebelum jendelanya
 *    penuh. Di sini mengikuti Excel.
 * 4. R² bernilai tak hingga negatif bila seluruh y sama, karena pembaginya
 *    nol. Di sini ditulis tidak terdefinisi.
 *
 * Polinomialnya dicocokkan pada x yang dinormalkan ke [−1, 1] lalu
 * koefisiennya dikembalikan ke basis x. Ini PENGAMAN, bukan perbaikan
 * cacat: cara cl42 (persamaan normal pada x mentah dengan pivot) diuji
 * ulang pada dataset NIST Pontius dan data contoh cl42 sampai derajat
 * enam, dan hasilnya sama dengan cara ini sampai digit terakhir yang
 * ditulis. Normalisasi menjaga hasil yang sama bila datanya lebih ekstrem.
 *
 * Satu hal yang sengaja DIPERTAHANKAN sama dengan Excel: R² bentuk
 * eksponensial dan pangkat dihitung di ruang logaritma, karena itu yang
 * ditampilkan garis tren Excel dan yang akan dibandingkan klien. R² di ruang
 * aslinya ikut ditulis di sampingnya, karena keduanya bisa jauh berbeda.
 */

export type RegKind =
  | "linear"
  | "polinomial"
  | "eksponensial"
  | "pangkat"
  | "logaritmik"
  | "rata-bergerak";

export type XY = { x: number; y: number };

export type RegFit = {
  kind: RegKind;
  /**
   * Koefisien dalam basis yang ditulis di rumus:
   * linear dan polinomial c0 + c1 x + ...; eksponensial [a, b] untuk a e^(bx);
   * pangkat [a, b] untuk a x^b; logaritmik [a, b] untuk a + b ln x;
   * rata-rata bergerak [lebar jendela].
   */
  coeffs: number[];
  /** Nilai kurva di x mana pun; null untuk rata-rata bergerak */
  predict: ((x: number) => number) | null;
  /** Garis rata-rata bergerak, urut x, hanya bila jendelanya penuh */
  maLine: XY[];
  /** R² di ruang asli y */
  r2: number | null;
  /** R² seperti yang ditulis garis tren Excel: di ruang ln y untuk eksponensial dan pangkat */
  r2Excel: number | null;
  mae: number;
  rmse: number;
  /** Pasangan yang ikut menghitung metrik */
  n: number;
  /** Pasangan yang dibuang karena rumusnya tidak berlaku di situ */
  dropped: number;
  xMin: number;
  xMax: number;
};

const rata = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;

function metrik(y: number[], yHat: number[]) {
  const n = y.length;
  const m = rata(y);
  let ssTot = 0;
  let ssRes = 0;
  let abs = 0;
  y.forEach((v, i) => {
    ssTot += (v - m) ** 2;
    ssRes += (v - yHat[i]) ** 2;
    abs += Math.abs(v - yHat[i]);
  });
  return {
    r2: ssTot > 0 ? 1 - ssRes / ssTot : null,
    mae: abs / n,
    rmse: Math.sqrt(ssRes / n),
  };
}

/** Kuadrat terkecil garis lurus, dihitung dari simpangan terhadap rata-rata */
function garis(x: number[], y: number[]) {
  const mx = rata(x);
  const my = rata(y);
  let sxx = 0;
  let sxy = 0;
  x.forEach((v, i) => {
    sxx += (v - mx) ** 2;
    sxy += (v - mx) * (y[i] - my);
  });
  if (sxx <= 0) return null;
  const b = sxy / sxx;
  return { a: my - b * mx, b };
}

/** Penyelesaian sistem linear dengan pivot sebagian; null bila singular */
function selesaikan(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-13) return null;
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

/** Koefisien binomial */
function binom(n: number, k: number) {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

export function fitRegression(
  data: XY[],
  kind: RegKind,
  degree = 2,
  window = 3
): RegFit | null {
  const semua = data.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const pakai = semua.filter((p) =>
    kind === "eksponensial"
      ? p.y > 0
      : kind === "pangkat"
        ? p.x > 0 && p.y > 0
        : kind === "logaritmik"
          ? p.x > 0
          : true
  );
  const dropped = semua.length - pakai.length;
  const x = pakai.map((p) => p.x);
  const y = pakai.map((p) => p.y);
  if (pakai.length < 2) return null;
  const xMin = Math.min(...x);
  const xMax = Math.max(...x);

  const dasar = { dropped, xMin, xMax, maLine: [] as XY[] };

  if (kind === "rata-bergerak") {
    const w = Math.max(2, Math.round(window));
    if (pakai.length < w) return null;
    const urut = pakai.slice().sort((a, b) => a.x - b.x);
    const garisMA: XY[] = [];
    const yAsli: number[] = [];
    const yMA: number[] = [];
    for (let i = w - 1; i < urut.length; i++) {
      const v = rata(urut.slice(i - w + 1, i + 1).map((p) => p.y));
      garisMA.push({ x: urut[i].x, y: v });
      yAsli.push(urut[i].y);
      yMA.push(v);
    }
    const m = metrik(yAsli, yMA);
    return {
      kind,
      coeffs: [w],
      predict: null,
      ...dasar,
      maLine: garisMA,
      r2: m.r2,
      r2Excel: m.r2,
      mae: m.mae,
      rmse: m.rmse,
      n: yAsli.length,
    };
  }

  let coeffs: number[];
  let predict: (x: number) => number;
  let r2Excel: number | null = null;

  if (kind === "linear") {
    const g = garis(x, y);
    if (!g) return null;
    coeffs = [g.a, g.b];
    predict = (v) => g.a + g.b * v;
  } else if (kind === "polinomial") {
    const d = Math.max(1, Math.round(degree));
    if (pakai.length < d + 1) return null;
    const tengah = (xMin + xMax) / 2;
    const separuh = (xMax - xMin) / 2;
    if (separuh <= 0) return null;
    const u = x.map((v) => (v - tengah) / separuh);
    const A = Array.from({ length: d + 1 }, (_, i) =>
      Array.from({ length: d + 1 }, (__, j) => u.reduce((s, v) => s + Math.pow(v, i + j), 0))
    );
    const b = Array.from({ length: d + 1 }, (_, i) =>
      u.reduce((s, v, k) => s + Math.pow(v, i) * y[k], 0)
    );
    const cu = selesaikan(A, b);
    if (!cu) return null;
    /* Kurvanya dievaluasi di basis ternormal, yang teliti */
    predict = (v) => {
      const t = (v - tengah) / separuh;
      let s = 0;
      for (let i = cu.length - 1; i >= 0; i--) s = s * t + cu[i];
      return s;
    };
    /* Koefisien basis x untuk ditulis: ((x − m)/h)^i dijabarkan binomial */
    coeffs = new Array(d + 1).fill(0);
    for (let i = 0; i <= d; i++)
      for (let k = 0; k <= i; k++)
        coeffs[k] += (cu[i] * binom(i, k) * Math.pow(-tengah, i - k)) / Math.pow(separuh, i);
  } else if (kind === "eksponensial") {
    const g = garis(x, y.map(Math.log));
    if (!g) return null;
    const a = Math.exp(g.a);
    coeffs = [a, g.b];
    predict = (v) => a * Math.exp(g.b * v);
    r2Excel = metrik(y.map(Math.log), x.map((v) => g.a + g.b * v)).r2;
  } else if (kind === "pangkat") {
    const lx = x.map(Math.log);
    const g = garis(lx, y.map(Math.log));
    if (!g) return null;
    const a = Math.exp(g.a);
    coeffs = [a, g.b];
    predict = (v) => (v > 0 ? a * Math.pow(v, g.b) : NaN);
    r2Excel = metrik(y.map(Math.log), lx.map((v) => g.a + g.b * v)).r2;
  } else {
    const g = garis(x.map(Math.log), y);
    if (!g) return null;
    coeffs = [g.a, g.b];
    predict = (v) => (v > 0 ? g.a + g.b * Math.log(v) : NaN);
  }

  const m = metrik(y, x.map(predict));
  return {
    kind,
    coeffs,
    predict,
    ...dasar,
    r2: m.r2,
    r2Excel: r2Excel ?? m.r2,
    mae: m.mae,
    rmse: m.rmse,
    n: pakai.length,
  };
}

/** Nilai rumus seperti yang DITULIS, dari koefisien basis x. Dipakai verifikasi. */
export function formulaValue(f: RegFit, x: number): number {
  const c = f.coeffs;
  switch (f.kind) {
    case "linear":
    case "polinomial":
      return c.reduce((s, v, i) => s + v * Math.pow(x, i), 0);
    case "eksponensial":
      return c[0] * Math.exp(c[1] * x);
    case "pangkat":
      return c[0] * Math.pow(x, c[1]);
    case "logaritmik":
      return c[0] + c[1] * Math.log(x);
    default:
      return NaN;
  }
}

/**
 * Rumus yang dapat dibaca dan disalin.
 *
 * Angkanya ditulis dengan jumlah angka bermakna yang tetap, bukan jumlah
 * desimal tetap. cl42 menulis empat desimal, sehingga koefisien x² sebesar
 * 3e-15 pada data seperti Pontius tertulis "0,0000" dan rumus yang disalin
 * ke laporan diam-diam kehilangan sukunya.
 */
export function regressionFormula(
  f: RegFit,
  num: (v: number) => string,
  names = { x: "x", y: "y" }
): string {
  const { x, y } = names;
  const c = f.coeffs;
  const suku = (v: number, s: string, pertama: boolean) => {
    const tanda = pertama ? (v < 0 ? "−" : "") : v < 0 ? " − " : " + ";
    return `${tanda}${num(Math.abs(v))}${s}`;
  };
  switch (f.kind) {
    case "linear":
      return `${y} = ${suku(c[0], "", true)}${suku(c[1], `·${x}`, false)}`;
    case "polinomial":
      return (
        `${y} = ` +
        c.map((v, i) => suku(v, i === 0 ? "" : i === 1 ? `·${x}` : `·${x}^${i}`, i === 0)).join("")
      );
    case "eksponensial":
      return `${y} = ${num(c[0])}·e^(${num(c[1])}·${x})`;
    case "pangkat":
      return `${y} = ${num(c[0])}·${x}^${num(c[1])}`;
    case "logaritmik":
      return `${y} = ${suku(c[0], "", true)}${suku(c[1], `·ln(${x})`, false)}`;
    default:
      return `${y} = rata-rata ${c[0]} titik`;
  }
}

/** Data contoh cl42: debit (x) terhadap tinggi muka air (y) */
export const SAMPLE_REGRESSION: XY[] = [
  { x: 33262.03, y: 14.44 },
  { x: 48285.7, y: 18.16 },
  { x: 68609.89, y: 21.55 },
  { x: 86754.77, y: 23.38 },
  { x: 93855.33, y: 24.0 },
  { x: 100956.16, y: 24.76 },
  { x: 113156.71, y: 25.45 },
  { x: 121846.33, y: 26.31 },
  { x: 126080.48, y: 27.0 },
  { x: 133181.13, y: 27.83 },
];
