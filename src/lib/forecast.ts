/**
 * MODUL PREDIKSI — dipindahkan dari proyek cl42 ke HidroLab, lembar HY-06.
 *
 * Berkas ONNX, skaler, dan urutan fiturnya sama dengan cl42. Yang berubah
 * adalah kejujuran angkanya dan tiga cacat penyusunan fitur:
 *
 * 1. Simpangan baku bergulir dihitung dengan pembagi n − 1, sama dengan
 *    pandas yang dipakai melatih. cl42 memakai pembagi n.
 * 2. Tanggal dibaca dan dihitung dalam UTC, jadi hari dalam pekan dan bulan
 *    tidak bergantung pada zona waktu komputer pengguna.
 * 3. Mode multivariat hanya meramal hujan, karena keempat model multivariat
 *    hanya dilatih untuk itu. cl42 menawarkan target tinggi muka air yang
 *    hanya membalik keluaran ramalan hujan dengan skaler tinggi muka air.
 *
 * Ketelitian yang ditulis di lembarnya tidak diambil dari cl42, melainkan
 * dari pengukuran ulang (scripts/ukur_model_prediksi.py) dan dari uji satu
 * langkah pada data pengguna sendiri. Tiga masalah pelatihan yang ditemukan
 * saat pengukuran itu dicatat di lembarnya dan di Progress Tracking
 * 27 September; pelatihan ulangnya di luar berkas ini.
 */

export type UvKey = "gbr" | "xgb" | "lstm" | "bilstm" | "hybrid";
export type MvKey = "gbr_mv" | "xgb_mv" | "lstm_mv" | "bilstm_mv";
export type ModelKey = UvKey | MvKey;

type Skala = { mean: number; scale: number };
export type UvScalers = {
  feature_scaler: { mean: number[]; scale: number[] };
  target_scaler: Skala;
};
export type MvScalers = {
  feature_scaler: { mean: number[]; scale: number[] };
  sequence_rainfall_scaler: Skala;
  sequence_waterlevel_scaler: Skala;
  target_rainfall_scaler: Skala;
};

/** Menjalankan satu model ONNX pada satu masukan; mengembalikan keluaran pertamanya */
export type Runner = (file: string, input: Float32Array, dims: number[]) => Promise<number>;

/* ------------------------------------------------------------------ *
 * Tanggal
 * ------------------------------------------------------------------ */

/** "2020-12-01" menjadi milidetik UTC; NaN bila bukan tanggal */
export function parseDate(s: string): number {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s.trim());
  if (!m) return NaN;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(t);
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? t : NaN;
}

export const HARI = 86400000;

export function isoDate(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ *
 * Fitur, persis seperti pandas: tujuh hari terakhir yang DIKETAHUI
 * ------------------------------------------------------------------ */

function simpBaku(a: number[]) {
  const m = a.reduce((s, v) => s + v, 0) / a.length;
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}

function tujuh(h: number[]) {
  const w = h.slice(-7);
  return [
    h[h.length - 1],
    h[h.length - 3],
    h[h.length - 7],
    w.slice(-3).reduce((s, v) => s + v, 0) / 3,
    w.reduce((s, v) => s + v, 0) / 7,
    Math.max(...w),
    simpBaku(w),
  ];
}

/**
 * Sembilan fitur model tabular univariat untuk hari `target`:
 * lag 1, 3, 7; rata-rata 3 dan 7 hari; maksimum dan simpangan baku 7 hari;
 * bulan (1-12); hari dalam pekan (Senin 0).
 */
export function uvTabularFeatures(hist: number[], target: number): number[] {
  const d = new Date(target);
  return [...tujuh(hist), d.getUTCMonth() + 1, (d.getUTCDay() + 6) % 7];
}

/** Empat belas fitur model tabular multivariat: tujuh untuk hujan, tujuh untuk tinggi muka air */
export function mvTabularFeatures(rain: number[], wl: number[]): number[] {
  return [...tujuh(rain), ...tujuh(wl)];
}

const baku = (v: number[], s: { mean: number[]; scale: number[] }) =>
  v.map((x, i) => (x - s.mean[i]) / s.scale[i]);

/* ------------------------------------------------------------------ *
 * Satu langkah ke depan
 * ------------------------------------------------------------------ */

export type Series = { t: number[]; rain: number[]; wl?: number[] };

/**
 * Ramalan hujan untuk hari sesudah titik terakhir `s`. Keluaran dipotong di
 * nol, karena hujan tidak negatif; model tabular kadang mengeluarkan angka
 * negatif kecil.
 */
export async function predictNext(
  key: ModelKey,
  s: Series,
  uv: UvScalers,
  mv: MvScalers,
  run: Runner
): Promise<number> {
  const target = s.t[s.t.length - 1] + HARI;
  const r = s.rain;
  if (key === "gbr" || key === "xgb") {
    const x = baku(uvTabularFeatures(r, target), uv.feature_scaler);
    return Math.max(0, await run(key, Float32Array.from(x), [1, 9]));
  }
  if (key === "lstm" || key === "bilstm") {
    const ts = uv.target_scaler;
    const x = r.slice(-7).map((v) => (v - ts.mean) / ts.scale);
    const z = await run(key, Float32Array.from(x), [1, 7, 1]);
    return Math.max(0, z * ts.scale + ts.mean);
  }
  if (key === "hybrid") {
    /* Bobot cl42: 0,6 XGBoost + 0,4 LSTM */
    const a = await predictNext("xgb", s, uv, mv, run);
    const b = await predictNext("lstm", s, uv, mv, run);
    return 0.6 * a + 0.4 * b;
  }
  const w = s.wl ?? [];
  if (key === "gbr_mv" || key === "xgb_mv") {
    const x = baku(mvTabularFeatures(r, w), mv.feature_scaler);
    return Math.max(0, await run(key, Float32Array.from(x), [1, 14]));
  }
  const rs = mv.sequence_rainfall_scaler;
  const ws = mv.sequence_waterlevel_scaler;
  const tr = mv.target_rainfall_scaler;
  const x: number[] = [];
  for (let i = r.length - 7; i < r.length; i++) x.push((r[i] - rs.mean) / rs.scale, (w[i] - ws.mean) / ws.scale);
  const z = await run(key, Float32Array.from(x), [1, 7, 2]);
  return Math.max(0, z * tr.scale + tr.mean);
}

/**
 * Ramalan satu langkah untuk setiap titik mulai indeks `dari`, memakai
 * nilai SEBENARNYA sebelum titik itu. Inilah cara jujur mengukur model pada
 * data pengguna: setiap ramalan hanya melihat masa lalunya sendiri.
 */
export async function oneStep(
  key: ModelKey,
  s: Series,
  dari: number,
  uv: UvScalers,
  mv: MvScalers,
  run: Runner
): Promise<number[]> {
  const out: number[] = [];
  for (let i = Math.max(dari, 7); i < s.t.length; i++) {
    const sub: Series = { t: s.t.slice(0, i), rain: s.rain.slice(0, i), wl: s.wl?.slice(0, i) };
    out.push(await predictNext(key, sub, uv, mv, run));
  }
  return out;
}

/**
 * Ramalan beberapa hari ke depan secara berantai: tiap ramalan dimasukkan
 * kembali sebagai "data" untuk hari berikutnya, sama dengan cl42. Pada mode
 * multivariat tinggi muka air hari-hari yang diramal dianggap sama dengan
 * hari terakhir yang diketahui, juga sama dengan cl42, dan lembarnya
 * menyebutkan andaian itu.
 */
export async function recursive(
  key: ModelKey,
  s: Series,
  h: number,
  uv: UvScalers,
  mv: MvScalers,
  run: Runner
): Promise<number[]> {
  const kerja: Series = { t: s.t.slice(), rain: s.rain.slice(), wl: s.wl?.slice() };
  const out: number[] = [];
  for (let i = 0; i < h; i++) {
    const v = await predictNext(key, kerja, uv, mv, run);
    out.push(v);
    kerja.t.push(kerja.t[kerja.t.length - 1] + HARI);
    kerja.rain.push(v);
    if (kerja.wl) kerja.wl.push(kerja.wl[kerja.wl.length - 1]);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Ukuran ketelitian
 * ------------------------------------------------------------------ */

/** Ambang hari hujan untuk ROC-AUC, milimeter per hari (definisi BMKG) */
export const HARI_HUJAN = 1;

export type Skor = {
  mae: number;
  rmse: number;
  /** Nash-Sutcliffe; nol berarti sama baiknya dengan menebak rata-rata */
  nse: number;
  /** Luas di bawah kurva ROC untuk membedakan hari hujan; null bila salah satu kelas kosong */
  auc: number | null;
  n: number;
};

/**
 * AUC dihitung sebagai statistik Mann-Whitney: peluang sebuah hari hujan
 * mendapat ramalan lebih besar daripada sebuah hari kering, seri dihitung
 * setengah. Permintaan klien pada cl42 (Rev1) mencantumkan ROC-AUC tetapi
 * cl42 tidak pernah menghitungnya.
 */
export function score(y: number[], p: number[]): Skor {
  const n = y.length;
  const m = y.reduce((s, v) => s + v, 0) / n;
  let abs = 0;
  let sq = 0;
  let tot = 0;
  y.forEach((v, i) => {
    abs += Math.abs(v - p[i]);
    sq += (v - p[i]) ** 2;
    tot += (v - m) ** 2;
  });
  const pos = p.filter((_, i) => y[i] >= HARI_HUJAN);
  const neg = p.filter((_, i) => y[i] < HARI_HUJAN);
  let auc: number | null = null;
  if (pos.length && neg.length) {
    let u = 0;
    for (const a of pos) for (const b of neg) u += a > b ? 1 : a === b ? 0.5 : 0;
    auc = u / (pos.length * neg.length);
  }
  return { mae: abs / n, rmse: Math.sqrt(sq / n), nse: tot > 0 ? 1 - sq / tot : NaN, auc, n };
}

/** Pemeriksaan kerapatan tanggal: banyaknya lompatan yang bukan satu hari */
export function gaps(t: number[]): number {
  let g = 0;
  for (let i = 1; i < t.length; i++) if (t[i] - t[i - 1] !== HARI) g++;
  return g;
}
