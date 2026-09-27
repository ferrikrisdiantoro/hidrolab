/**
 * ARIMA dan SARIMA dengan kemungkinan maksimum eksak, untuk lembar HY-06.
 *
 * cl42 memakai paket npm "arima", pustaka C yang dikompilasi ke WebAssembly.
 * Paket itu tidak dipindahkan: ia membutuhkan pengaturan webpack tersendiri,
 * dan yang lebih penting, isinya tidak dapat diperiksa dari sini, sehingga
 * angkanya tidak dapat diverifikasi. Di sini ARIMA ditulis ulang dan
 * dicocokkan terhadap statsmodels 0.15 (Python), pustaka acuan di bidang
 * ini, sampai koefisien dan ramalannya.
 *
 * Cara hitungnya sama dengan statsmodels: model ARMA atas deret yang sudah
 * didiferensiasi ditulis dalam bentuk ruang keadaan Harvey, kemungkinannya
 * dihitung eksak dengan filter Kalman berawal stasioner, ragam galatnya
 * dipekatkan keluar, dan parameternya dicari dengan Nelder-Mead dalam ruang
 * tak terbatas yang dipetakan ke daerah stasioner dan terbalikkan lewat
 * autokorelasi parsial (Monahan 1984; Jones 1980).
 *
 * Konvensi tanda sama dengan statsmodels:
 *   (1 − φ1 B − ...)(1 − Φ1 B^s − ...)(1 − B)^d (1 − B^s)^D (y_t − μ)
 *     = (1 + θ1 B + ...)(1 + Θ1 B^s + ...) ε_t
 * dengan μ hanya bila d = D = 0.
 *
 * Rujukan: Box, Jenkins, Reinsel & Ljung (2015). Time Series Analysis, bab 7;
 * Harvey (1989). Forecasting, Structural Time Series Models and the Kalman
 * Filter; Durbin & Koopman (2012). Time Series Analysis by State Space
 * Methods, bab 5; Hyndman & Khandakar (2008). Automatic time series
 * forecasting: the forecast package for R. J. Stat. Software 27(3).
 */

export type ArimaOrder = {
  p: number;
  d: number;
  q: number;
  P?: number;
  D?: number;
  Q?: number;
  s?: number;
};

export type ArimaFit = {
  order: Required<ArimaOrder>;
  ar: number[];
  ma: number[];
  sar: number[];
  sma: number[];
  mean: number;
  sigma2: number;
  loglik: number;
  aic: number;
  aicc: number;
  /** Banyaknya pengamatan yang dipakai kemungkinannya, sesudah diferensiasi */
  nobs: number;
  /** Deret asli yang dipakai mencocokkan, untuk meramal dan memulihkan diferensiasi */
  y: number[];
};

/* ------------------------------------------------------------------ *
 * Polinomial
 * ------------------------------------------------------------------ */

/** Hasil kali dua polinomial dalam B, koefisien mulai dari B^0 */
function kali(a: number[], b: number[]) {
  const c = new Array(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (c[i + j] += x * y)));
  return c;
}

/** Polinomial AR lengkap (1 − φ(B))(1 − Φ(B^s)) sebagai [1, −a1, −a2, ...] */
function polyAR(ar: number[], sar: number[], s: number) {
  const a = [1, ...ar.map((v) => -v)];
  const b = new Array(sar.length * s + 1).fill(0);
  b[0] = 1;
  sar.forEach((v, i) => (b[(i + 1) * s] = -v));
  return kali(a, b);
}

/** Polinomial MA lengkap (1 + θ(B))(1 + Θ(B^s)) sebagai [1, b1, b2, ...] */
function polyMA(ma: number[], sma: number[], s: number) {
  const a = [1, ...ma];
  const b = new Array(sma.length * s + 1).fill(0);
  b[0] = 1;
  sma.forEach((v, i) => (b[(i + 1) * s] = v));
  return kali(a, b);
}

/** Polinomial diferensiasi (1 − B)^d (1 − B^s)^D */
function polyDiff(d: number, D: number, s: number) {
  let c = [1];
  for (let i = 0; i < d; i++) c = kali(c, [1, -1]);
  for (let i = 0; i < D; i++) {
    const b = new Array(s + 1).fill(0);
    b[0] = 1;
    b[s] = -1;
    c = kali(c, b);
  }
  return c;
}

function diferensiasi(y: number[], c: number[]) {
  const k = c.length - 1;
  const w: number[] = [];
  for (let t = k; t < y.length; t++) {
    let v = 0;
    for (let j = 0; j <= k; j++) v += c[j] * y[t - j];
    w.push(v);
  }
  return w;
}

/* ------------------------------------------------------------------ *
 * Pemetaan ke daerah stasioner (Monahan 1984), seperti statsmodels
 * ------------------------------------------------------------------ */

function stasioner(u: number[]): number[] {
  const n = u.length;
  if (n === 0) return [];
  const r = u.map((x) => x / Math.sqrt(1 + x * x));
  const y: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < k; i++) y[k][i] = y[k - 1][i] + r[k] * y[k - 1][k - i - 1];
    y[k][k] = r[k];
  }
  return y[n - 1].slice();
}

/* ------------------------------------------------------------------ *
 * Kemungkinan eksak lewat filter Kalman
 * ------------------------------------------------------------------ */

type Ruang = { T: number[][]; R: number[]; r: number };

function ruangKeadaan(a: number[], b: number[]): Ruang {
  /* a: koefisien AR sebagai y_t = a1 y_{t-1} + ..., b: [b1, b2, ...] */
  const r = Math.max(a.length, b.length + 1, 1);
  const T = Array.from({ length: r }, () => new Array(r).fill(0));
  for (let i = 0; i < r; i++) {
    if (i < a.length) T[i][0] = a[i];
    if (i + 1 < r) T[i][i + 1] = 1;
  }
  const R = new Array(r).fill(0);
  R[0] = 1;
  for (let i = 1; i < r; i++) R[i] = i - 1 < b.length ? b[i - 1] : 0;
  return { T, R, r };
}

/** P = T P Tᵀ + R Rᵀ, diselesaikan lewat vektorisasi */
function lyapunov(T: number[][], R: number[]): number[][] | null {
  const r = T.length;
  const n = r * r;
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  const b = new Array(n).fill(0);
  for (let i = 0; i < r; i++)
    for (let j = 0; j < r; j++) {
      const baris = i * r + j;
      A[baris][baris] += 1;
      for (let k = 0; k < r; k++)
        for (let l = 0; l < r; l++) A[baris][k * r + l] -= T[i][k] * T[j][l];
      b[baris] = R[i] * R[j];
    }
  /* Eliminasi Gauss berpivot */
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let i = c + 1; i < n; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i;
    if (Math.abs(A[p][c]) < 1e-14) return null;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let i = c + 1; i < n; i++) {
      const f = A[i][c] / A[c][c];
      if (f === 0) continue;
      for (let k = c; k < n; k++) A[i][k] -= f * A[c][k];
      b[i] -= f * b[c];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let k = i + 1; k < n; k++) s -= A[i][k] * x[k];
    x[i] = s / A[i][i];
  }
  return Array.from({ length: r }, (_, i) => x.slice(i * r, i * r + r));
}

type Saring = {
  /** Jumlah v²/F dan jumlah log F, untuk kemungkinan terpekatkan */
  ss: number;
  sumLogF: number;
  /** Ramalan satu langkah tiap titik, dalam skala deret yang diberikan */
  ramal: number[];
  /** Keadaan sesudah titik terakhir, untuk meramal */
  a: number[];
};

/**
 * Filter Kalman untuk bentuk ruang keadaan Harvey.
 *
 * Matriks transisinya berbentuk pendamping: kolom pertama koefisien AR,
 * di atas diagonal satu. Karena itu T·P·Tᵀ cukup dihitung dengan O(r²)
 * operasi, bukan O(r³). Begitu ragam ramalannya berhenti berubah (filter
 * mencapai keadaan tunak), P dan penguat Kalman dibekukan, seperti
 * statsmodels; kemungkinan yang dihasilkan sama sampai 1e-12.
 */
function saring(w: number[], ruang: Ruang, P0: number[][]): Saring {
  const { T, R, r } = ruang;
  const c = new Float64Array(r);
  for (let i = 0; i < r; i++) c[i] = T[i][0];
  const RR = new Float64Array(r * r);
  for (let i = 0; i < r; i++) for (let j = 0; j < r; j++) RR[i * r + j] = R[i] * R[j];

  let a = new Float64Array(r);
  const aU = new Float64Array(r);
  let P = new Float64Array(r * r);
  for (let i = 0; i < r; i++) for (let j = 0; j < r; j++) P[i * r + j] = P0[i][j];
  const PU = new Float64Array(r * r);
  const TP = new Float64Array(r * r);
  let Pbaru = new Float64Array(r * r);
  const K = new Float64Array(r);

  let ss = 0;
  let sumLogF = 0;
  const ramal: number[] = [];
  let tunak = false;
  let Fsebelum = NaN;

  for (const obs of w) {
    const F = P[0];
    const v = obs - a[0];
    ramal.push(a[0]);
    sumLogF += Math.log(F);
    ss += (v * v) / F;
    for (let i = 0; i < r; i++) K[i] = P[i * r] / F;
    for (let i = 0; i < r; i++) aU[i] = a[i] + K[i] * v;
    /* a = T aU */
    const aB = new Float64Array(r);
    for (let i = 0; i < r; i++) aB[i] = c[i] * aU[0] + (i + 1 < r ? aU[i + 1] : 0);
    a = aB;
    if (tunak) continue;
    /* PU = P − K P[0,:] */
    for (let i = 0; i < r; i++) for (let j = 0; j < r; j++) PU[i * r + j] = P[i * r + j] - K[i] * P[j];
    /* TP = T PU: baris i = c_i PU[0,:] + PU[i+1,:] */
    for (let i = 0; i < r; i++)
      for (let j = 0; j < r; j++) TP[i * r + j] = c[i] * PU[j] + (i + 1 < r ? PU[(i + 1) * r + j] : 0);
    /* P = TP Tᵀ + R Rᵀ: kolom j = TP[:,0] c_j + TP[:,j+1] */
    for (let i = 0; i < r; i++)
      for (let j = 0; j < r; j++)
        Pbaru[i * r + j] = TP[i * r] * c[j] + (j + 1 < r ? TP[i * r + j + 1] : 0) + RR[i * r + j];
    const tmp = P;
    P = Pbaru;
    Pbaru = tmp;
    if (Math.abs(P[0] - Fsebelum) < 1e-13 * Math.max(1, P[0])) tunak = true;
    Fsebelum = P[0];
  }
  return { ss, sumLogF, ramal, a: Array.from(a) };
}

/* ------------------------------------------------------------------ *
 * Nelder-Mead
 * ------------------------------------------------------------------ */

function nelderMead(f: (x: number[]) => number, x0: number[], iter = 2000, tol = 1e-11): number[] {
  const n = x0.length;
  if (n === 0) return [];
  let simpleks = [x0.slice()];
  for (let i = 0; i < n; i++) {
    const x = x0.slice();
    x[i] = x[i] !== 0 ? x[i] * 1.05 : 0.00025;
    x[i] += 0.1;
    simpleks.push(x);
  }
  let nilai = simpleks.map(f);
  for (let k = 0; k < iter; k++) {
    const urut = nilai.map((v, i) => i).sort((i, j) => nilai[i] - nilai[j]);
    simpleks = urut.map((i) => simpleks[i]);
    nilai = urut.map((i) => nilai[i]);
    if (Math.abs(nilai[n] - nilai[0]) <= tol * (Math.abs(nilai[0]) + 1e-12)) {
      const lebar = Math.max(...simpleks.map((x) => Math.max(...x.map((v, j) => Math.abs(v - simpleks[0][j])))));
      if (lebar < 1e-7) break;
    }
    const pusat = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) pusat[j] += simpleks[i][j] / n;
    const titik = (t: number) => pusat.map((c, j) => c + t * (simpleks[n][j] - c));
    const xr = titik(-1);
    const fr = f(xr);
    if (fr < nilai[0]) {
      const xe = titik(-2);
      const fe = f(xe);
      if (fe < fr) {
        simpleks[n] = xe;
        nilai[n] = fe;
      } else {
        simpleks[n] = xr;
        nilai[n] = fr;
      }
    } else if (fr < nilai[n - 1]) {
      simpleks[n] = xr;
      nilai[n] = fr;
    } else {
      const luar = fr < nilai[n];
      const xc = titik(luar ? -0.5 : 0.5);
      const fc = f(xc);
      if (fc < (luar ? fr : nilai[n])) {
        simpleks[n] = xc;
        nilai[n] = fc;
      } else {
        for (let i = 1; i <= n; i++) {
          simpleks[i] = simpleks[i].map((v, j) => simpleks[0][j] + 0.5 * (v - simpleks[0][j]));
          nilai[i] = f(simpleks[i]);
        }
      }
    }
  }
  const terbaik = nilai.indexOf(Math.min(...nilai));
  return simpleks[terbaik];
}

/* ------------------------------------------------------------------ *
 * Pencocokan
 * ------------------------------------------------------------------ */

function lengkap(o: ArimaOrder): Required<ArimaOrder> {
  return { p: o.p, d: o.d, q: o.q, P: o.P ?? 0, D: o.D ?? 0, Q: o.Q ?? 0, s: o.s ?? 0 };
}

function urai(u: number[], o: Required<ArimaOrder>) {
  let i = 0;
  const ambil = (k: number) => u.slice(i, (i += k));
  const ar = stasioner(ambil(o.p));
  const ma = stasioner(ambil(o.q)).map((v) => -v);
  const sar = stasioner(ambil(o.P));
  const sma = stasioner(ambil(o.Q)).map((v) => -v);
  return { ar, ma, sar, sma };
}

function kemungkinan(w: number[], ar: number[], ma: number[], sar: number[], sma: number[], s: number) {
  const a = polyAR(ar, sar, s).slice(1).map((v) => -v);
  const b = polyMA(ma, sma, s).slice(1);
  const ruang = ruangKeadaan(a, b);
  const P0 = lyapunov(ruang.T, ruang.R);
  if (!P0 || !(P0[0][0] > 0)) return null;
  const f = saring(w, ruang, P0);
  const n = w.length;
  const sigma2 = f.ss / n;
  const loglik = -0.5 * n * (Math.log(2 * Math.PI) + 1 + Math.log(sigma2)) - 0.5 * f.sumLogF;
  return { loglik, sigma2, ruang, P0 };
}

export function fitArima(y: number[], order: ArimaOrder): ArimaFit | null {
  const o = lengkap(order);
  const c = polyDiff(o.d, o.D, o.s || 1);
  const w0 = diferensiasi(y, c);
  const denganRata = o.d === 0 && o.D === 0;
  const nParam = o.p + o.q + o.P + o.Q;
  if (w0.length < nParam + 3) return null;

  /* Rata-rata diestimasi bersama parameter lain bila d = D = 0 */
  const nilaiAwalRata = denganRata ? w0.reduce((s, v) => s + v, 0) / w0.length : 0;
  const skala = Math.sqrt(w0.reduce((s, v) => s + (v - nilaiAwalRata) ** 2, 0) / w0.length) || 1;

  const obj = (u: number[]) => {
    const mu = denganRata ? nilaiAwalRata + u[nParam] * skala : 0;
    const w = w0.map((v) => v - mu);
    const pr = urai(u, o);
    const k = kemungkinan(w, pr.ar, pr.ma, pr.sar, pr.sma, o.s || 1);
    return k ? -k.loglik : 1e20;
  };

  const dim = nParam + (denganRata ? 1 : 0);
  let terbaik: number[] | null = null;
  let nilaiTerbaik = Infinity;
  for (const mulai of [0, 0.3, -0.3]) {
    const x0 = new Array(dim).fill(0).map((_, i) => (i < nParam ? mulai : 0));
    let x = nelderMead(obj, x0);
    x = nelderMead(obj, x);
    const v = obj(x);
    if (v < nilaiTerbaik) {
      nilaiTerbaik = v;
      terbaik = x;
    }
  }
  if (!terbaik || !Number.isFinite(nilaiTerbaik) || nilaiTerbaik >= 1e19) return null;

  const mu = denganRata ? nilaiAwalRata + (dim > nParam ? terbaik[nParam] * skala : 0) : 0;
  const pr = urai(terbaik, o);
  const k = kemungkinan(w0.map((v) => v - mu), pr.ar, pr.ma, pr.sar, pr.sma, o.s || 1)!;
  const nobs = w0.length;
  const kParam = dim + 1;
  const aic = -2 * k.loglik + 2 * kParam;
  const aicc = nobs - kParam - 1 > 0 ? aic + (2 * kParam * (kParam + 1)) / (nobs - kParam - 1) : Infinity;

  return {
    order: o,
    ...pr,
    mean: mu,
    sigma2: k.sigma2,
    loglik: k.loglik,
    aic,
    aicc,
    nobs,
    y: y.slice(),
  };
}

/**
 * Ramalan satu langkah ke depan untuk setiap titik deret `y`, memakai
 * parameter yang sudah dicocokkan (tidak dicocokkan ulang). Titik-titik
 * awal yang belum punya cukup sejarah untuk diferensiasi diberi NaN.
 */
export function oneStepPredictions(f: ArimaFit, y: number[]): number[] {
  const o = f.order;
  const c = polyDiff(o.d, o.D, o.s || 1);
  const k = c.length - 1;
  const w = diferensiasi(y, c).map((v) => v - f.mean);
  const a = polyAR(f.ar, f.sar, o.s || 1).slice(1).map((v) => -v);
  const b = polyMA(f.ma, f.sma, o.s || 1).slice(1);
  const ruang = ruangKeadaan(a, b);
  const P0 = lyapunov(ruang.T, ruang.R);
  if (!P0) return y.map(() => NaN);
  const r = saring(w, ruang, P0);
  const hasil: number[] = new Array(k).fill(NaN);
  for (let t = k; t < y.length; t++) {
    /* y_t = w_t − Σ_{j≥1} c_j y_{t−j} */
    let v = r.ramal[t - k] + f.mean;
    for (let j = 1; j <= k; j++) v -= c[j] * y[t - j];
    hasil.push(v);
  }
  return hasil;
}

/** Ramalan h langkah sesudah titik terakhir deret yang dicocokkan */
export function forecastArima(f: ArimaFit, h: number): number[] {
  const o = f.order;
  const c = polyDiff(o.d, o.D, o.s || 1);
  const k = c.length - 1;
  const w = diferensiasi(f.y, c).map((v) => v - f.mean);
  const a = polyAR(f.ar, f.sar, o.s || 1).slice(1).map((v) => -v);
  const b = polyMA(f.ma, f.sma, o.s || 1).slice(1);
  const ruang = ruangKeadaan(a, b);
  const P0 = lyapunov(ruang.T, ruang.R);
  if (!P0) return new Array(h).fill(NaN);
  let keadaan = saring(w, ruang, P0).a;
  const y = f.y.slice();
  const out: number[] = [];
  for (let i = 0; i < h; i++) {
    let v = keadaan[0] + f.mean;
    for (let j = 1; j <= k; j++) v -= c[j] * y[y.length - j];
    out.push(v);
    y.push(v);
    keadaan = ruang.T.map((row) => row.reduce((s, x, m) => s + x * keadaan[m], 0));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Pemilihan orde otomatis
 * ------------------------------------------------------------------ */

/**
 * Statistik KPSS untuk kestasioneran di sekitar rata-rata, dengan jendela
 * Bartlett dan lebar lag ⌈12 (n/100)^(1/4)⌉, sama dengan statsmodels
 * (nlags="legacy") yang dipakai sebagai acuan uji. Kwiatkowski dkk. (1992)
 * memakai 4 atau 12 di depannya; yang lebih lebar lebih hati-hati terhadap
 * autokorelasi.
 */
export function kpss(y: number[]): number {
  const n = y.length;
  const m = y.reduce((s, v) => s + v, 0) / n;
  const e = y.map((v) => v - m);
  let S = 0;
  let jumlahS2 = 0;
  for (const v of e) {
    S += v;
    jumlahS2 += S * S;
  }
  const lag = Math.min(n - 1, Math.ceil(12 * Math.pow(n / 100, 0.25)));
  let s2 = e.reduce((s, v) => s + v * v, 0) / n;
  for (let l = 1; l <= lag; l++) {
    let g = 0;
    for (let t = l; t < n; t++) g += e[t] * e[t - l];
    s2 += (2 * (1 - l / (lag + 1)) * g) / n;
  }
  return jumlahS2 / (n * n * s2);
}

/** Nilai kritis KPSS 5 persen untuk kestasioneran di sekitar rata-rata (Kwiatkowski dkk. 1992) */
export const KPSS_CRIT_5 = 0.463;

/**
 * ARIMA otomatis cara Hyndman-Khandakar yang disederhanakan: d dipilih
 * dengan uji KPSS (paling banyak dua kali diferensiasi), lalu p dan q
 * masing-masing 0 sampai 3 dengan p + q paling banyak 4 dipilih dengan
 * AICc terkecil. AICc hanya dibandingkan di antara model dengan d yang
 * sama, karena kemungkinan deret yang berbeda diferensiasinya tidak dapat
 * dibandingkan.
 */
export function autoArima(y: number[]): ArimaFit | null {
  let d = 0;
  let w = y.slice();
  while (d < 2 && w.length > 20 && kpss(w) > KPSS_CRIT_5) {
    w = w.slice(1).map((v, i) => v - w[i]);
    d++;
  }
  let terbaik: ArimaFit | null = null;
  for (let p = 0; p <= 3; p++)
    for (let q = 0; q <= 3; q++) {
      if (p + q > 4) continue;
      const f = fitArima(y, { p, d, q });
      if (f && (!terbaik || f.aicc < terbaik.aicc)) terbaik = f;
    }
  return terbaik;
}
