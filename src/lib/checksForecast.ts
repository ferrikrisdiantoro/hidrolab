import type { Check } from "./verify.ts";
import { fitArima, kpss } from "./arima.ts";
import { mvTabularFeatures, parseDate, uvTabularFeatures, type Skor } from "./forecast.ts";

/**
 * Blok verifikasi HY-06.
 *
 * Tiga acuan datang dari luar aplikasi dalam arti yang ketat: pandas
 * (penyusunan fitur), onnxruntime Python (keluaran model), dan statsmodels
 * (ARIMA dan KPSS). Ketiganya dihitung sekali di Python oleh skrip di folder
 * scripts dan disimpan sebagai JSON; di sini angka yang sama dihitung ulang
 * oleh kode peramban dan dibandingkan.
 */

export type ForecastCheckInput = {
  mode: "uv" | "mv";
  samples: {
    uv: { hujan: number[]; acuan: { tanggal: string; fitur: number[] } & Record<string, unknown> };
    mv: { hujan: number[]; tma: number[]; acuan: { fitur: number[] } & Record<string, unknown> };
  };
  arimaRef: {
    deret: Record<string, number[]>;
    kasus: { deret: string; order: number[]; seasonal: number[]; loglik: number }[];
    kpss: Record<string, number>;
  };
  /** Keluaran model terpilih pada masukan acuan, dihitung di peramban; null bila belum atau bukan ONNX */
  onnxJs: { model: string; nilai: number; acuan: number } | null;
  /** Uji satu langkah pada data pengguna */
  uji: { y: number[]; p: number[]; skor: Skor; persistensi: Skor; yPersist: number[] } | null;
  ramalan: number[];
  /** ARIMA(1,0,1) acuan, dicocokkan sekali dan disimpan lembarnya karena makan waktu */
  arima101: number | null;
};

export function checksForecast(c: ForecastCheckInput): Check[] {
  const out: Check[] = [];

  const fitur =
    c.mode === "uv"
      ? uvTabularFeatures(c.samples.uv.hujan, parseDate(c.samples.uv.acuan.tanggal))
      : mvTabularFeatures(c.samples.mv.hujan, c.samples.mv.tma);
  const acuanFitur = c.mode === "uv" ? c.samples.uv.acuan.fitur : c.samples.mv.acuan.fitur;
  out.push({
    label: {
      id: `Fitur ${c.mode === "uv" ? "univariat (9)" : "multivariat (14)"} yang disusun peramban sama dengan pandas`,
      en: `The ${c.mode === "uv" ? "univariate (9)" : "multivariate (14)"} features built in the browser equal pandas`,
    },
    source: "pandas 2.3, rolling dengan shift(1) dan std pembagi n − 1, scripts/data_contoh_prediksi.py",
    kind: "silang",
    expected: 0,
    actual: Math.max(...fitur.map((v, i) => Math.abs(v - acuanFitur[i]))),
    tol: 0,
    absTol: 1e-10,
    digits: 12,
  });

  if (c.onnxJs)
    out.push({
      label: {
        id: `Keluaran ONNX ${c.onnxJs.model} di peramban sama dengan onnxruntime Python`,
        en: `The ${c.onnxJs.model} ONNX output in the browser equals Python onnxruntime`,
      },
      source: "onnxruntime 1.21 (Python) pada masukan yang sama",
      kind: "silang",
      expected: c.onnxJs.acuan,
      actual: c.onnxJs.nilai,
      tol: 1e-5,
      absTol: 1e-6,
      tolReason: {
        id: "Model dijalankan dalam float32",
        en: "The model runs in float32",
      },
      unit: "mm",
      digits: 6,
    });

  const kasus = c.arimaRef.kasus[0];
  if (c.arima101 !== null)
    out.push({
      label: {
        id: "Kemungkinan log ARIMA(1,0,1) sama dengan statsmodels",
        en: "The ARIMA(1,0,1) log-likelihood equals statsmodels",
      },
      source: "statsmodels 0.15, ARIMA kemungkinan maksimum eksak, scripts/acuan_arima.py",
      kind: "silang",
      expected: kasus.loglik,
      actual: c.arima101,
      tol: 1e-6,
      tolReason: {
        id: "Kedua pengoptimal berhenti pada toleransinya sendiri",
        en: "Both optimisers stop at their own tolerance",
      },
      digits: 5,
    });

  out.push({
    label: {
      id: "Statistik KPSS pemilih diferensiasi sama dengan statsmodels",
      en: "The KPSS statistic that chooses differencing equals statsmodels",
    },
    source: "statsmodels 0.15, kpss(regression='c', nlags='legacy')",
    kind: "silang",
    expected: c.arimaRef.kpss.jalan,
    actual: kpss(c.arimaRef.deret.jalan),
    tol: 1e-10,
    digits: 6,
  });

  if (c.uji) {
    const { y, p, skor } = c.uji;
    const m = y.reduce((a, b) => a + b, 0) / y.length;
    const ssTot = y.reduce((a, v) => a + (v - m) ** 2, 0);
    out.push({
      label: {
        id: "NSE sama dengan satu dikurangi n·RMSE² dibagi ragam totalnya",
        en: "NSE equals one minus n·RMSE² over the total sum of squares",
      },
      source: "Nash & Sutcliffe (1970), definisi",
      kind: "sifat",
      expected: 1 - (y.length * skor.rmse * skor.rmse) / ssTot,
      actual: skor.nse,
      tol: 1e-10,
      absTol: 1e-12,
      digits: 6,
    });
    const maeP = c.uji.yPersist.reduce((a, v, i) => a + Math.abs(y[i] - v), 0) / y.length;
    out.push({
      label: {
        id: "MAE pembanding \"sama dengan kemarin\" dihitung ulang langsung dari datanya",
        en: "The \"same as yesterday\" baseline MAE recomputed straight from the data",
      },
      source: "Selisih mutlak hujan hari t dan hari t − 1",
      kind: "silang",
      expected: maeP,
      actual: c.uji.persistensi.mae,
      tol: 1e-12,
      absTol: 1e-12,
      unit: "mm",
      digits: 5,
    });
    void p;
  }

  out.push({
    label: {
      id: "Tidak ada ramalan hujan yang negatif",
      en: "No rainfall forecast is negative",
    },
    source: "Hujan tidak negatif; keluaran model dipotong di nol",
    kind: "perilaku",
    expected: 1,
    actual: c.ramalan.every((v) => v >= 0) ? 1 : 0,
    tol: 0,
    digits: 0,
  });

  return out;
}

/** ARIMA(1,0,1) pada deret acuan, dipanggil sekali oleh lembarnya */
export function arimaAcuan(ref: ForecastCheckInput["arimaRef"]): number | null {
  const k = ref.kasus[0];
  const f = fitArima(ref.deret[k.deret], { p: k.order[0], d: k.order[1], q: k.order[2] });
  return f ? f.loglik : null;
}
