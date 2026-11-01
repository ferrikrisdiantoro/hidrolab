/*
 * Integrator persamaan diferensial biasa untuk model ekologi (EK-01,
 * Lotka–Volterra) dan model lain yang butuh deret waktu.
 *
 * RK4 klasik (Runge–Kutta orde empat):
 *   k1 = f(tn, yn)
 *   k2 = f(tn + h/2, yn + h k1/2)
 *   k3 = f(tn + h/2, yn + h k2/2)
 *   k4 = f(tn + h, yn + h k3)
 *   yn+1 = yn + h (k1 + 2k2 + 2k3 + k4)/6
 * galat lokal O(h⁵), galat total O(h⁴). Dicek dengan Wikipedia
 * "Runge–Kutta methods" (bagian The Runge–Kutta method); uji orde di
 * ode.test.ts mengukur rasio galat ±16 saat langkah dibagi dua.
 *
 * rk4Adaptif memakai penggandaan langkah: satu langkah h dibandingkan dua
 * langkah h/2. Untuk metode orde p, galat dua langkah separuh ≈ (y₂ − y₁)/
 * (2^p − 1) = (y₂ − y₁)/15 (ekstrapolasi Richardson, diturunkan dari orde
 * di atas, bukan angka sumber). Hasil yang dipakai y₂ (tanpa ekstrapolasi).
 */

/** Ruas kanan dy/dt = f(t, y). Tulis ke `dy`, jangan ubah `y`. */
export type TurunanODE = (t: number, y: Float64Array, dy: Float64Array) => void;

type Kerja = { k1: Float64Array; k2: Float64Array; k3: Float64Array; k4: Float64Array; tmp: Float64Array };

function kerjaBaru(n: number): Kerja {
  return {
    k1: new Float64Array(n),
    k2: new Float64Array(n),
    k3: new Float64Array(n),
    k4: new Float64Array(n),
    tmp: new Float64Array(n),
  };
}

/** Satu langkah RK4 dari (t, y) sepanjang h, hasil ke `out` (boleh sama dengan y). */
export function rk4Step(f: TurunanODE, t: number, y: Float64Array, h: number, out: Float64Array, kerja?: Kerja): void {
  const n = y.length;
  const w = kerja ?? kerjaBaru(n);
  const { k1, k2, k3, k4, tmp } = w;
  f(t, y, k1);
  for (let i = 0; i < n; i++) tmp[i] = y[i] + 0.5 * h * k1[i];
  f(t + 0.5 * h, tmp, k2);
  for (let i = 0; i < n; i++) tmp[i] = y[i] + 0.5 * h * k2[i];
  f(t + 0.5 * h, tmp, k3);
  for (let i = 0; i < n; i++) tmp[i] = y[i] + h * k3[i];
  f(t + h, tmp, k4);
  for (let i = 0; i < n; i++) out[i] = y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
}

/**
 * RK4 langkah tetap dari t0 ke t1 dalam `steps` langkah. y[k] keadaan pada
 * t[k], k = 0 … steps; t[steps] = t1 tepat. y0 tidak diubah.
 */
export function rk4(
  f: TurunanODE,
  y0: Float64Array,
  t0: number,
  t1: number,
  steps: number
): { t: Float64Array; y: Float64Array[] } {
  const m = Math.max(1, Math.floor(steps));
  const h = (t1 - t0) / m;
  const t = new Float64Array(m + 1);
  const y: Float64Array[] = [Float64Array.from(y0)];
  t[0] = t0;
  const w = kerjaBaru(y0.length);
  for (let k = 1; k <= m; k++) {
    const nxt = new Float64Array(y0.length);
    rk4Step(f, t0 + (k - 1) * h, y[k - 1], h, nxt, w);
    y.push(nxt);
    t[k] = k === m ? t1 : t0 + k * h;
  }
  return { t, y };
}

export type OpsiAdaptif = {
  /** Toleransi galat lokal relatif-campuran: |galat| ≤ tol (1 + |y|) */
  tol: number;
  hAwal?: number;
  hMin?: number;
  hMax?: number;
  /** Batas langkah diterima; bila habis, selesai = false */
  maksLangkah?: number;
};

/** RK4 dengan langkah adaptif (penggandaan langkah). */
export function rk4Adaptif(
  f: TurunanODE,
  y0: Float64Array,
  t0: number,
  t1: number,
  opsi: OpsiAdaptif
): { t: number[]; y: Float64Array[]; langkahDitolak: number; selesai: boolean } {
  const n = y0.length;
  const rentang = t1 - t0;
  const arah = Math.sign(rentang) || 1;
  const hMax = opsi.hMax ?? Math.abs(rentang);
  const hMin = opsi.hMin ?? Math.abs(rentang) * 1e-12;
  const maks = opsi.maksLangkah ?? 100000;
  let h = Math.min(opsi.hAwal ?? Math.abs(rentang) / 100, hMax);
  const tOut: number[] = [t0];
  const yOut: Float64Array[] = [Float64Array.from(y0)];
  const w = kerjaBaru(n);
  const satu = new Float64Array(n);
  const tengah = new Float64Array(n);
  const dua = new Float64Array(n);
  let t = t0;
  let y = yOut[0];
  let ditolak = 0;
  let diterima = 0;
  while (arah * (t1 - t) > 0) {
    if (diterima >= maks) return { t: tOut, y: yOut, langkahDitolak: ditolak, selesai: false };
    let hh = Math.min(h, Math.abs(t1 - t));
    const terakhir = hh === Math.abs(t1 - t);
    const hs = arah * hh;
    rk4Step(f, t, y, hs, satu, w);
    rk4Step(f, t, y, hs / 2, tengah, w);
    rk4Step(f, t + hs / 2, tengah, hs / 2, dua, w);
    let err = 0;
    for (let i = 0; i < n; i++) {
      const e = Math.abs(dua[i] - satu[i]) / 15 / (opsi.tol * (1 + Math.abs(dua[i])));
      if (e > err) err = e;
    }
    if (err <= 1 || hh <= hMin) {
      t = terakhir ? t1 : t + hs;
      y = Float64Array.from(dua);
      tOut.push(t);
      yOut.push(y);
      diterima++;
    } else {
      ditolak++;
    }
    const faktor = err === 0 ? 5 : Math.min(5, Math.max(0.2, 0.9 * Math.pow(err, -0.2)));
    hh = Math.min(hMax, Math.max(hMin, hh * faktor));
    h = hh;
  }
  return { t: tOut, y: yOut, langkahDitolak: ditolak, selesai: true };
}
