/*
 * Model mangsa-pemangsa Lotka–Volterra (usulan pengganti SY-01).
 *
 *   dx/dt = α x − β x y      (mangsa)
 *   dy/dt = δ x y − γ y      (pemangsa)
 *
 * Kuantitas kekal (integral pertama):
 *   V(x, y) = δ x − γ ln x + β y − α ln y
 * sehingga lintasan berupa lengkung tertutup di sekitar titik seimbang
 * (γ/δ, α/β). Persamaan dan V dicek pada Koshkin, S. & Meyers, I. (2022),
 * Harmonic oscillators of mathematical biology, Mathematics Magazine
 * (arXiv:2206.09561), pers. 3 dan 4 hlm. 6–7 (lambang Yunani di pindaian
 * teks hilang; bentuk dicek ulang dengan uji dV/dt = 0 di lotkaVolterra.test.ts).
 * Rujukan asal: Lotka (1925) Elements of Physical Biology; Volterra (1926)
 * Nature 118; Murray, Mathematical Biology I bab 3 (buku tidak dibuka).
 *
 * Besaran turunan (diturunkan di sini, bukan angka sumber):
 * - periode orbit kecil 2π/√(αγ): matriks Jacobi di titik seimbang punya
 *   nilai eigen ±i√(αγ);
 * - rata-rata satu putaran = titik seimbang: ∫ d(ln x) = 0 memberi
 *   ȳ = α/β, ∫ d(ln y) = 0 memberi x̄ = γ/δ;
 * - puncak pemangsa tertinggal seperempat putaran dari puncak mangsa pada
 *   orbit kecil (dari linearisasi yang sama).
 *
 * Integrasi: rk4Adaptif (ode.ts) di antara titik keluaran yang berjarak
 * rata, supaya deret cocok untuk animasi dan orbit besar yang mendekati
 * sumbu tetap teliti. `drift` melaporkan simpangan relatif V terbesar.
 */

import { rk4Adaptif, type TurunanODE } from "./ode.ts";

export type ParamLV = {
  /** Laju tumbuh mangsa tanpa pemangsa α, per satuan waktu */
  alpha: number;
  /** Laju dimangsa β, per (individu pemangsa · waktu) */
  beta: number;
  /** Laju mati pemangsa tanpa mangsa γ, per satuan waktu */
  gamma: number;
  /** Laju tambah pemangsa dari mangsa δ, per (individu mangsa · waktu) */
  delta: number;
};

export function turunanLV(p: ParamLV): TurunanODE {
  return (_t, y, dy) => {
    dy[0] = p.alpha * y[0] - p.beta * y[0] * y[1];
    dy[1] = p.delta * y[0] * y[1] - p.gamma * y[1];
  };
}

/** V = δx − γ ln x + βy − α ln y; NaN bila x atau y tidak positif. */
export function invarianLV(p: ParamLV, x: number, y: number): number {
  if (!(x > 0) || !(y > 0)) return NaN;
  return p.delta * x - p.gamma * Math.log(x) + p.beta * y - p.alpha * Math.log(y);
}

/** Titik seimbang bersama (γ/δ, α/β). */
export function titikSeimbangLV(p: ParamLV): { x: number; y: number } {
  return { x: p.gamma / p.delta, y: p.alpha / p.beta };
}

export type HasilLV = {
  t: number[];
  /** Mangsa */
  x: number[];
  /** Pemangsa */
  y: number[];
  /** V di tiap titik keluaran */
  invarian: number[];
  /** max |V − V0| / |V0|; NaN bila awal di sumbu */
  drift: number;
  equilibrium: { x: number; y: number };
  /** 2π/√(αγ) */
  periodeLinear: number;
  /** Periode terukur (rata-rata jarak puncak mangsa), null bila < 2 puncak */
  periode: number | null;
  /** Indeks puncak mangsa di deret */
  puncakMangsa: number[];
  /** Selang puncak mangsa pertama ke puncak pemangsa berikutnya, null bila tidak ada */
  tundaanPemangsa: number | null;
  /** Awal tanpa pemangsa (y0 = 0): mangsa tumbuh eksponensial */
  tanpaPemangsa: boolean;
  /** Awal tanpa mangsa (x0 = 0): pemangsa meluruh */
  tanpaMangsa: boolean;
};

/** Waktu puncak yang dihaluskan parabola tiga titik. */
function waktuPuncak(t: number[], v: number[], k: number): number {
  if (k <= 0 || k >= v.length - 1) return t[k];
  const a = v[k - 1];
  const b = v[k];
  const c = v[k + 1];
  const pembagi = a - 2 * b + c;
  if (pembagi === 0) return t[k];
  const geser = (0.5 * (a - c)) / pembagi; // dalam satuan langkah, |geser| ≤ 0,5
  const h = 0.5 * (t[k + 1] - t[k - 1]);
  return t[k] + geser * h;
}

function puncak(v: number[]): number[] {
  const out: number[] = [];
  for (let k = 1; k < v.length - 1; k++) if (v[k] > v[k - 1] && v[k] >= v[k + 1]) out.push(k);
  return out;
}

export function lotkaVolterra(
  p: ParamLV,
  x0: number,
  y0: number,
  tEnd: number,
  opsi: { titikKeluar?: number; tol?: number } = {}
): HasilLV {
  const n = Math.max(10, Math.floor(opsi.titikKeluar ?? 2000));
  const tol = opsi.tol ?? 1e-11;
  const f = turunanLV(p);
  const t: number[] = [0];
  const x: number[] = [Math.max(x0, 0)];
  const y: number[] = [Math.max(y0, 0)];
  let cur: Float64Array = new Float64Array([x[0], y[0]]);
  const periodeLinear = (2 * Math.PI) / Math.sqrt(p.alpha * p.gamma);
  let hAwal = Math.min(tEnd / n, periodeLinear / 200);
  for (let k = 1; k <= n; k++) {
    const ta = (tEnd * (k - 1)) / n;
    const tb = k === n ? tEnd : (tEnd * k) / n;
    const r = rk4Adaptif(f, cur, ta, tb, { tol, hAwal });
    cur = r.y[r.y.length - 1];
    if (r.t.length > 1) hAwal = Math.max(r.t[r.t.length - 1] - r.t[r.t.length - 2], 1e-12);
    t.push(tb);
    x.push(cur[0]);
    y.push(cur[1]);
  }

  const V0 = invarianLV(p, x[0], y[0]);
  const invarian = x.map((xi, i) => invarianLV(p, xi, y[i]));
  let drift = Number.isFinite(V0) ? 0 : NaN;
  if (Number.isFinite(V0)) {
    for (const V of invarian) drift = Math.max(drift, Math.abs(V - V0) / Math.max(Math.abs(V0), 1e-300));
  }

  const pm = puncak(x);
  let periode: number | null = null;
  if (pm.length >= 2) {
    const tp = pm.map((k) => waktuPuncak(t, x, k));
    periode = (tp[tp.length - 1] - tp[0]) / (tp.length - 1);
  }
  let tundaanPemangsa: number | null = null;
  if (pm.length >= 1) {
    const tx = waktuPuncak(t, x, pm[0]);
    const py = puncak(y).find((k) => waktuPuncak(t, y, k) > tx);
    if (py !== undefined) tundaanPemangsa = waktuPuncak(t, y, py) - tx;
  }

  return {
    t,
    x,
    y,
    invarian,
    drift,
    equilibrium: titikSeimbangLV(p),
    periodeLinear,
    periode,
    puncakMangsa: pm,
    tundaanPemangsa,
    tanpaPemangsa: !(y0 > 0),
    tanpaMangsa: !(x0 > 0),
  };
}
