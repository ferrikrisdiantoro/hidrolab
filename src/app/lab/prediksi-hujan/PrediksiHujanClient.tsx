"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  BigResult,
  Block,
  Flag,
  Hitungan,
  InputRow,
  InputTable,
  PresetRow,
  ResultTable,
  Sheet,
  StateCard,
  Term,
  type LangkahHitung,
} from "@/components/ui";
import { type Tone } from "@/lib/theme";
import { SeriesEntry, readSeries, type SeriesRow } from "@/components/SeriesEntry";
import { useResetGuard } from "@/components/ResetScope";
import { useCanvas } from "@/lib/useCanvas";
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import { fmt } from "@/lib/hydraulics";
import {
  HARI,
  isoDate,
  oneStep,
  parseDate,
  predictNext,
  recursive,
  score,
  type ModelKey,
  type MvScalers,
  type Series,
  type Skor,
  type UvScalers,
} from "@/lib/forecast";
import { autoArima, fitArima, forecastArima, oneStepPredictions, type ArimaFit, type ArimaOrder } from "@/lib/arima";
import { browserRunner } from "@/lib/onnxBrowser";
import { copyPng, downloadCsv, downloadPng, downloadXlsx, type Draw } from "@/lib/exportChart";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { arimaAcuan, checksForecast } from "@/lib/checksForecast";
import SAMPEL from "@/lib/forecastSamples.json";
import UKUR from "@/lib/forecastMetrics.json";
import ACUAN_ARIMA from "@/lib/arimaReference.json";

const UV_SC = SAMPEL.skaler.uv as UvScalers;
const MV_SC = SAMPEL.skaler.mv as MvScalers;

type UvModel = "gbr" | "xgb" | "lstm" | "bilstm" | "hybrid" | "arima";
type MvModel = "gbr_mv" | "xgb_mv" | "lstm_mv" | "bilstm_mv";
type ArimaPreset = "auto" | "111" | "211" | "112" | "sarima7";

const UV_MODELS: UvModel[] = ["lstm", "bilstm", "arima", "gbr", "xgb", "hybrid"];
const MV_MODELS: MvModel[] = ["lstm_mv", "bilstm_mv", "gbr_mv", "xgb_mv"];
const ARIMA_PRESETS: ArimaPreset[] = ["auto", "111", "211", "112", "sarima7"];
const ARIMA_ORDER: Record<Exclude<ArimaPreset, "auto">, ArimaOrder> = {
  "111": { p: 1, d: 1, q: 1 },
  "211": { p: 2, d: 1, q: 1 },
  "112": { p: 1, d: 1, q: 2 },
  sarima7: { p: 1, d: 1, q: 1, P: 1, D: 1, Q: 1, s: 7 },
};

const NAMA: Record<UvModel | MvModel, string> = {
  gbr: "Gradient Boosting",
  xgb: "XGBoost",
  lstm: "LSTM",
  bilstm: "BiLSTM",
  hybrid: "Hybrid XGB + LSTM",
  arima: "ARIMA",
  gbr_mv: "GBR MV",
  xgb_mv: "XGBoost MV",
  lstm_mv: "LSTM MV",
  bilstm_mv: "BiLSTM MV",
};

/** Angka yang ditulis cl42 di layarnya, untuk dibandingkan dengan hasil ukur */
const KLAIM_CL42: Record<UvModel, { mae: number; rmse: number } | null> = {
  gbr: { mae: 0.29, rmse: 0.54 },
  xgb: { mae: 0.31, rmse: 0.53 },
  lstm: { mae: 0.46, rmse: 0.77 },
  bilstm: { mae: 0.69, rmse: 1.05 },
  hybrid: { mae: 0.35, rmse: 0.6 },
  arima: { mae: 0.35, rmse: 0.55 },
};

const BOCOR: UvModel[] = ["gbr", "xgb", "hybrid"];

const TXT = {
  id: {
    title: "Prediksi curah hujan",
    sheetTitle: "Data hujan harian, uji satu langkah, dan ramalan beberapa hari ke depan",
    blkMode: "jenis data",
    mPilih: "variabel",
    mUv: "univariat (hujan saja)",
    mMv: "multivariat (hujan dan tinggi muka air)",
    blkData: "data masukan",
    hHujan: "hujan, mm",
    hTma: "TMA, m",
    blkMetode: "metode prediksi",
    model: "model",
    arima: "orde ARIMA",
    aAuto: "otomatis",
    dH: "Lama ramalan",
    blkTampilan: "pengaturan grafik",
    judul: "Judul grafik",
    sumbuX: "Nama sumbu x",
    sumbuY: "Nama sumbu y",
    lblHist: "Label data",
    lblPred: "Label ramalan",
    defJudul: "Data historis dan prediksi curah hujan",
    defX: "Tanggal",
    defY: "Curah hujan (mm)",
    defHist: "Data historis",
    defPred: "Prediksi",
    lblUji: "Uji satu langkah",
    blkHasil: "nilai ramalan",
    blkUji: "ketelitian pada data ini",
    blkUkur: "ketelitian hasil ukur ulang",
    tglR: "tanggal",
    nilaiR: "hujan, mm",
    menghitung: "menghitung…",
    gagal: "Gagal menghitung",
    kurang: "Data belum cukup",
    kurangNote:
      "Model membaca tujuh hari terakhir, dan ketelitiannya diuji pada seperlima data terakhir (paling sedikit lima hari), jadi dibutuhkan paling sedikit empat belas hari berurutan. ARIMA butuh paling sedikit tiga puluh hari.",
    lebihBaik: "Lebih baik daripada \"sama dengan kemarin\" pada data ini",
    hitungState: "Menghitung ulang untuk data dan model ini; angka di bawah masih milik hitungan sebelumnya dan diredupkan.",
    gagalState: "Model tidak dapat dijalankan pada data ini.",
    dipotong: "Ramalan negatif dipotong ke 0 mm",
    dipotongNote: (u: number, r: number, m: string) =>
      `ARIMA memberi hujan di bawah nol pada ${u} hari uji dan ${r} hari ramalan (terendah ${m} mm). Hujan negatif tidak mungkin, jadi nilai itu ditulis 0 mm; skor uji dihitung dari nilai yang sudah dipotong.`,
    bRmseM: "RMSE model",
    bRmseP: "RMSE \"sama dengan kemarin\"",
    bHari1: "Ramalan hari pertama",
    hBagi: "Pembagian data uji",
    hModel: "Uji satu langkah, tiap hari hanya melihat hari sebelumnya",
    hSkor: "Skor model pada hari uji",
    hPersis: "Skor \"sama dengan kemarin\", ŷ(t) = y(t − 1)",
    hBanding: "Banding RMSE",
    lebihBaikKata: "lebih baik",
    lebihBurukKata: "lebih buruk",
    hari: "hari",
    celah: "Tanggalnya tidak harian berurutan",
    celahNote:
      "Ada tanggal yang melompat lebih dari sehari atau tanggal yang ganda. Semua model di lembar ini membaca tujuh BARIS terakhir sebagai tujuh HARI terakhir, jadi pada data yang melompat, \"kemarin\" bisa berarti sebulan yang lalu. Lengkapi hari yang hilang, atau hilangkan centang baris ganda.",
    bocor: "Dilatih dengan fitur yang memuat hari yang diramal",
    bocorNote:
      "Pada notebook pelatihan cl42, rata-rata, maksimum, dan simpangan baku bergulir dihitung tanpa pergeseran sehari, sehingga fitur hari t ikut memuat hujan hari t, yaitu jawaban yang sedang diramal. Model belajar memakai jawaban itu. Di lembar ini fiturnya disusun dengan benar dari hari-hari yang sudah lewat, dan tanpa jawaban yang bocor model ini lebih buruk daripada tebakan \"sama dengan kemarin\". Angka di tabel hasil ukur ulang di bawah adalah ketelitian yang sesungguhnya; angka yang dulu ditulis cl42 adalah ketelitian dengan kebocoran. Perbaikannya pelatihan ulang dengan shift(1) sebelum rolling.",
    tigaBulan: "Dilatih hanya pada April, September, dan November",
    tigaBulanNote:
      "Notebook pelatihan cl42 mengurai tanggal dari nama bulan berbahasa Indonesia dengan pustaka yang hanya mengenal bahasa Inggris. Hanya tiga bulan yang ejaannya sama di kedua bahasa yang terbaca; sembilan bulan lain dibuang tanpa peringatan, 1.800 dari 7.305 hari. Model ini karena itu tidak pernah melihat Januari sampai Maret, Mei sampai Agustus, Oktober, dan Desember, dan deret latihnya melompat sampai empat bulan di antara hari-hari yang dianggapnya berurutan.",
    tanpaKemampuan: "Tidak lebih baik daripada menebak rata-rata",
    tanpaKemampuanNote:
      "Keempat model multivariat punya NSE negatif pada data ujinya sendiri: ramalannya sedikit LEBIH BURUK daripada menebak hujan rata-rata setiap hari. Ini bukan cacat penyusunan modelnya; notebook jilid 2 dikerjakan dengan benar. Hujan harian satu stasiun di Catalonia memang nyaris tidak dapat diramal dari tujuh hari sebelumnya dan tinggi muka air sungai. Tinggi muka air untuk hari-hari yang diramal dianggap sama dengan hari terakhir yang diketahui.",
    kalah: "Lebih buruk daripada \"sama dengan kemarin\" pada data ini",
    kolModel: "model",
    kolPersis: "sama dengan kemarin",
    rMae: "Galat mutlak rata-rata",
    rRmse: "Galat akar kuadrat rata-rata",
    rNse: "Nash-Sutcliffe",
    rAuc: "ROC-AUC hari hujan (≥ 1 mm)",
    rCrps: "CRPS (ramalan tunggal: sama dengan MAE)",
    rN: "Hari yang diuji",
    ukurLengkap: "data latih lengkap, semua bulan",
    ukurNotebook: "data latih seperti dipakai notebook",
    ukurMv: "data uji Catalonia",
    klaim: "ditulis cl42",
    klaimArima: "konstanta di kode cl42, tidak pernah dihitung",
    arimaPakai: (o: string, aicc: string) => `dipakai ${o}, AICc ${aicc}`,
    unduhPng: "unduh grafik PNG",
    salinGrafik: "salin grafik",
    unduhCsv: "unduh data CSV",
    unduhXlsx: "unduh data Excel",
    tersalin: "tersalin",
    gagalSalin: "peramban menolak menyalin",
    note:
      "Lembar ini menjalankan model yang dilatih di proyek cl42 tanpa mengubah satu bobot pun, tetapi tidak lagi memakai angka ketelitian yang ditulis cl42. Setiap model diukur dengan dua cara. Pertama, pada data latihnya sendiri, dengan fitur yang disusun persis seperti peramban menyusunnya (skrip pengukurnya ada di folder scripts). Kedua, pada data yang dimasukkan di lembar ini: seperlima hari terakhir diramal satu per satu, masing-masing hanya melihat hari-hari sebelumnya, lalu dibandingkan dengan pembanding paling sederhana yang ada, yaitu \"hujan besok sama dengan hari ini\". Model yang tidak dapat mengalahkan pembanding itu belum membawa informasi apa pun tentang hujan besok. Ramalan beberapa hari ke depan dibuat berantai: ramalan hari pertama dipakai sebagai data untuk hari kedua, dan seterusnya, sehingga kesalahannya menumpuk dan ramalannya cepat mendatar ke rata-rata.",
  },
  en: {
    title: "Rainfall prediction",
    sheetTitle: "Daily rainfall data, one-step test, and a forecast several days ahead",
    blkMode: "data type",
    mPilih: "variables",
    mUv: "univariate (rainfall only)",
    mMv: "multivariate (rainfall and water level)",
    blkData: "input data",
    hHujan: "rain, mm",
    hTma: "level, m",
    blkMetode: "prediction method",
    model: "model",
    arima: "ARIMA order",
    aAuto: "automatic",
    dH: "Forecast length",
    blkTampilan: "chart settings",
    judul: "Chart title",
    sumbuX: "x axis name",
    sumbuY: "y axis name",
    lblHist: "Data label",
    lblPred: "Forecast label",
    defJudul: "Historical data and rainfall prediction",
    defX: "Date",
    defY: "Rainfall (mm)",
    defHist: "Historical data",
    defPred: "Prediction",
    lblUji: "One-step test",
    blkHasil: "forecast values",
    blkUji: "accuracy on this data",
    blkUkur: "re-measured accuracy",
    tglR: "date",
    nilaiR: "rain, mm",
    menghitung: "computing…",
    gagal: "Computation failed",
    kurang: "Not enough data",
    kurangNote:
      "The models read the last seven days, and their accuracy is tested on the last fifth of the data (at least five days), so at least fourteen consecutive days are needed. ARIMA needs at least thirty.",
    lebihBaik: "Better than \"same as yesterday\" on this data",
    hitungState: "Recomputing for this data and model; the figures below still belong to the previous run and are dimmed.",
    gagalState: "The model could not run on this data.",
    dipotong: "Negative forecasts clipped to 0 mm",
    dipotongNote: (u: number, r: number, m: string) =>
      `ARIMA gave rainfall below zero on ${u} test days and ${r} forecast days (lowest ${m} mm). Negative rainfall is impossible, so those values are written as 0 mm; the test scores are computed from the clipped values.`,
    bRmseM: "Model RMSE",
    bRmseP: "\"Same as yesterday\" RMSE",
    bHari1: "First-day forecast",
    hBagi: "Test split",
    hModel: "One-step test, each day sees only the days before it",
    hSkor: "Model scores on the test days",
    hPersis: "\"Same as yesterday\" scores, ŷ(t) = y(t − 1)",
    hBanding: "RMSE comparison",
    lebihBaikKata: "better",
    lebihBurukKata: "worse",
    hari: "days",
    celah: "The dates are not consecutive days",
    celahNote:
      "Some dates jump by more than a day or are duplicated. Every model on this sheet reads the last seven ROWS as the last seven DAYS, so on jumping data \"yesterday\" may mean a month ago. Fill in the missing days, or untick duplicated rows.",
    bocor: "Trained with features that contain the day being predicted",
    bocorNote:
      "In the cl42 training notebook the rolling mean, maximum, and standard deviation were computed without a one-day shift, so the features of day t contained the rainfall of day t, the very answer being predicted. The model learned to use that answer. On this sheet the features are built correctly from days already past, and without the leaked answer this model is worse than guessing \"same as yesterday\". The figures in the re-measured table below are its real accuracy; the figures cl42 used to show are its accuracy with the leak. The fix is retraining with shift(1) before rolling.",
    tigaBulan: "Trained only on April, September, and November",
    tigaBulanNote:
      "The cl42 training notebook parsed dates from Indonesian month names with a library that only knows English. Only the three months spelled the same in both languages were read; the other nine were dropped without warning, 1,800 of 7,305 days. This model has therefore never seen January to March, May to August, October, or December, and its training series jumps up to four months between days it treats as consecutive.",
    tanpaKemampuan: "No better than guessing the mean",
    tanpaKemampuanNote:
      "All four multivariate models have negative NSE on their own test data: their forecasts are slightly WORSE than guessing the average rainfall every day. This is not a modelling defect; the second notebook was done correctly. Daily rainfall at one Catalan station simply cannot be predicted from the previous seven days and the river level. The water level on forecast days is taken as equal to the last known day.",
    kalah: "Worse than \"same as yesterday\" on this data",
    kolModel: "model",
    kolPersis: "same as yesterday",
    rMae: "Mean absolute error",
    rRmse: "Root mean square error",
    rNse: "Nash-Sutcliffe",
    rAuc: "ROC-AUC for rain days (≥ 1 mm)",
    rCrps: "CRPS (single-value forecast: equals MAE)",
    rN: "Days tested",
    ukurLengkap: "full training data, all months",
    ukurNotebook: "training data as the notebook used it",
    ukurMv: "Catalonia test data",
    klaim: "shown by cl42",
    klaimArima: "a constant in the cl42 code, never computed",
    arimaPakai: (o: string, aicc: string) => `used ${o}, AICc ${aicc}`,
    unduhPng: "download chart PNG",
    salinGrafik: "copy chart",
    unduhCsv: "download data CSV",
    unduhXlsx: "download data Excel",
    tersalin: "copied",
    gagalSalin: "the browser refused to copy",
    note:
      "This sheet runs the models trained in the cl42 project without changing a single weight, but no longer uses the accuracy figures cl42 displayed. Each model is measured in two ways. First, on its own training data, with the features built exactly as the browser builds them (the measuring script is in the scripts folder). Second, on the data entered on this sheet: the last fifth of the days are predicted one at a time, each seeing only the days before it, and compared against the simplest baseline there is, \"tomorrow's rain equals today's\". A model that cannot beat that baseline carries no information about tomorrow's rain yet. The forecast several days ahead is chained: the first day's forecast is used as data for the second, and so on, so errors accumulate and the forecast quickly flattens toward the mean.",
  },
} as const;

const REFS = {
  id: [
    "Box, G.E.P., Jenkins, G.M., Reinsel, G.C. & Ljung, G.M. (2015). Time Series Analysis: Forecasting and Control, edisi ke-5. Wiley.",
    "Nash, J.E. & Sutcliffe, J.V. (1970). River flow forecasting through conceptual models, part I. Journal of Hydrology 10(3).",
    "Kaufman, S., Rosset, S., Perlich, C. & Stitelman, O. (2012). Leakage in data mining: formulation, detection, and avoidance. ACM TKDD 6(4).",
    "Hyndman, R.J. & Athanasopoulos, G. (2021). Forecasting: Principles and Practice, edisi ke-3. OTexts, bab 5 dan 9.",
  ],
  en: [
    "Box, G.E.P., Jenkins, G.M., Reinsel, G.C. & Ljung, G.M. (2015). Time Series Analysis: Forecasting and Control, 5th edition. Wiley.",
    "Nash, J.E. & Sutcliffe, J.V. (1970). River flow forecasting through conceptual models, part I. Journal of Hydrology 10(3).",
    "Kaufman, S., Rosset, S., Perlich, C. & Stitelman, O. (2012). Leakage in data mining: formulation, detection, and avoidance. ACM TKDD 6(4).",
    "Hyndman, R.J. & Athanasopoulos, G. (2021). Forecasting: Principles and Practice, 3rd edition. OTexts, Chapters 5 and 9.",
  ],
} as const;

const BLN = {
  id: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

const contohUv = (): SeriesRow[] =>
  SAMPEL.uv.tanggal.map((d, i) => ({ d, v: String(Number(SAMPEL.uv.hujan[i].toFixed(3))), on: true }));
const contohMv = (): SeriesRow[] =>
  SAMPEL.mv.tanggal.map((d, i) => ({
    d,
    v: String(Number(SAMPEL.mv.hujan[i].toFixed(3))),
    w: String(Number(SAMPEL.mv.tma[i].toFixed(4))),
    on: true,
  }));

type Hasil = {
  status: "diam" | "hitung" | "selesai" | "gagal";
  ramalan: number[];
  uji: { dari: number; y: number[]; p: number[]; skor: Skor; persistensi: Skor; yPersist: number[] } | null;
  arima: ArimaFit | null;
  onnxJs: { model: string; nilai: number; acuan: number } | null;
  pesan?: string;
  /** ARIMA: banyaknya nilai negatif yang dipotong ke 0, dan yang terendah */
  dipotong?: { uji: number; ramalan: number; min: number } | null;
};

export function PrediksiHujanClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [mode, setMode] = useState<"uv" | "mv">("uv");
  const [rowsUv, setRowsUv] = useState<SeriesRow[]>(contohUv);
  const [rowsMv, setRowsMv] = useState<SeriesRow[]>(contohMv);
  // Deret yang sudah diketik atau diunggah (di mode mana pun) membuat Reset
  // lembar meminta konfirmasi. Pembanding: rujukan larik awal, karena setiap
  // suntingan SeriesEntry membuat larik baru.
  const [awalUv] = useState(rowsUv);
  const [awalMv] = useState(rowsMv);
  useResetGuard(rowsUv !== awalUv || rowsMv !== awalMv);
  const [uvModel, setUvModel] = useState<UvModel>("lstm");
  const [mvModel, setMvModel] = useState<MvModel>("lstm_mv");
  const [preset, setPreset] = useState<ArimaPreset>("auto");
  const [h, setH] = useState(7);
  const [judul, setJudul] = useState<string | null>(null);
  const [namaX, setNamaX] = useState<string | null>(null);
  const [namaY, setNamaY] = useState<string | null>(null);
  const [lblHist, setLblHist] = useState<string | null>(null);
  const [lblPred, setLblPred] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [hasil, setHasil] = useState<Hasil>({ status: "diam", ramalan: [], uji: null, arima: null, onnxJs: null });
  const token = useRef(0);
  /* Cocokan ARIMA disimpan per data dan orde: mencocokkan ulang butuh
     beberapa detik, dan lama ramalan tidak mengubah cocokannya. */
  const simpanArima = useRef(new Map<string, { latih: ArimaFit | null; penuh: ArimaFit | null }>());

  const rows = mode === "uv" ? rowsUv : rowsMv;
  const setRows = mode === "uv" ? setRowsUv : setRowsMv;
  const model: UvModel | MvModel = mode === "uv" ? uvModel : mvModel;
  const seri = readSeries(rows, mode === "mv");
  const kunci = JSON.stringify([seri.t, seri.rain, mode === "mv" ? seri.wl : 0]);
  const n = seri.t.length;
  const minimum = model === "arima" ? 30 : 14;
  const cukup = n >= minimum;
  const arima101 = useMemo(() => arimaAcuan(ACUAN_ARIMA), []);

  useEffect(() => {
    if (!cukup) {
      setHasil({ status: "diam", ramalan: [], uji: null, arima: null, onnxJs: null });
      return;
    }
    const saya = ++token.current;
    setHasil((h0) => ({ ...h0, status: "hitung" }));
    const jalan = setTimeout(async () => {
      try {
        const s: Series = { t: seri.t, rain: seri.rain, wl: mode === "mv" ? seri.wl : undefined };
        const w = Math.max(5, Math.round(n * 0.2));
        const dari = Math.max(7, n - w);
        const y = s.rain.slice(dari);
        const yPersist = s.rain.slice(dari - 1, n - 1);
        let p: number[];
        let ramalan: number[];
        let fit: ArimaFit | null = null;
        let onnxJs: Hasil["onnxJs"] = null;
        let dipotong: Hasil["dipotong"] = null;

        if (model === "arima") {
          const cocok = (yy: number[]) =>
            preset === "auto" ? autoArima(yy) : fitArima(yy, ARIMA_ORDER[preset]);
          const kunciArima = `${preset}|${kunci}`;
          let simpan = simpanArima.current.get(kunciArima);
          if (!simpan) {
            simpan = { latih: cocok(s.rain.slice(0, dari)), penuh: cocok(s.rain) };
            simpanArima.current.set(kunciArima, simpan);
          }
          const latih = simpan.latih;
          if (!latih) throw new Error("ARIMA");
          /* Hujan negatif dipotong ke 0, tetapi tidak diam-diam: banyaknya
             dicatat dan ditandai di kartu keadaan. */
          const pMentah = oneStepPredictions(latih, s.rain).slice(dari);
          p = pMentah.map((v) => Math.max(0, v));
          fit = simpan.penuh;
          if (!fit) throw new Error("ARIMA");
          const rMentah = forecastArima(fit, h);
          ramalan = rMentah.map((v) => Math.max(0, v));
          const nU = pMentah.filter((v) => v < 0).length;
          const nR = rMentah.filter((v) => v < 0).length;
          dipotong = nU + nR > 0 ? { uji: nU, ramalan: nR, min: Math.min(...pMentah, ...rMentah) } : null;
        } else {
          const k = model as ModelKey;
          p = await oneStep(k, s, dari, UV_SC, MV_SC, browserRunner);
          ramalan = await recursive(k, s, h, UV_SC, MV_SC, browserRunner);
          /* Model yang sama pada masukan acuan, untuk blok verifikasi */
          const acuanSeri: Series =
            mode === "uv"
              ? { t: SAMPEL.uv.tanggal.map(parseDate), rain: SAMPEL.uv.hujan }
              : { t: SAMPEL.mv.tanggal.map(parseDate), rain: SAMPEL.mv.hujan, wl: SAMPEL.mv.tma };
          const ac = (mode === "uv" ? SAMPEL.uv.acuan : SAMPEL.mv.acuan) as unknown as Record<string, number>;
          const acuan = k === "hybrid" ? 0.6 * Math.max(0, ac.xgb) + 0.4 * Math.max(0, ac.lstm) : Math.max(0, ac[k]);
          onnxJs = { model: NAMA[model], nilai: await predictNext(k, acuanSeri, UV_SC, MV_SC, browserRunner), acuan };
        }
        if (saya !== token.current) return;
        setHasil({
          status: "selesai",
          ramalan,
          uji: { dari, y, p, skor: score(y, p), persistensi: score(y, yPersist), yPersist },
          arima: fit,
          onnxJs,
          dipotong,
        });
      } catch (e) {
        if (saya !== token.current) return;
        setHasil({ status: "gagal", ramalan: [], uji: null, arima: null, onnxJs: null, pesan: String(e) });
      }
    }, 350);
    return () => clearTimeout(jalan);
  }, [kunci, model, preset, h, mode, cukup]); // eslint-disable-line react-hooks/exhaustive-deps

  const cek = useMemo(
    () =>
      checksForecast({
        mode,
        samples: SAMPEL,
        arimaRef: ACUAN_ARIMA,
        onnxJs: hasil.onnxJs,
        uji: hasil.uji,
        ramalan: hasil.ramalan,
        arima101,
      }),
    [mode, hasil, arima101]
  );

  const nama = {
    judul: judul ?? x.defJudul,
    x: namaX ?? x.defX,
    y: namaY ?? x.defY,
    hist: lblHist ?? x.defHist,
    pred: lblPred ?? x.defPred,
  };

  const kalah =
    hasil.uji !== null && hasil.uji.skor.rmse > hasil.uji.persistensi.rmse && hasil.status === "selesai";
  const bermasalah = seri.gaps > 0 || seri.dup > 0;
  /* Selama menghitung, hasil lama masih tersimpan; angkanya diredupkan dan
     kop serta kartu besar menulis "—" supaya tidak terbaca sebagai milik
     data yang baru. */
  const siap = hasil.status === "selesai";

  const gambar: Draw = (ctx, w, hh) => {
    if (!cukup) {
      drawChart(
        ctx,
        w,
        hh,
        { xMin: 0, xMax: 1, yMin: 0, yMax: 1, axisX: nama.x, axisY: nama.y, series: [], title: nama.judul, noGrid: true, heading: x.kurang, headingColor: C.signal },
        lang
      );
      return;
    }
    /* Paling banyak 150 hari terakhir digambar, supaya ramalannya terbaca */
    const awal = Math.max(0, n - 150);
    const t0 = seri.t[awal];
    const hariKe = (tt: number) => Math.round((tt - t0) / HARI);
    const hist = seri.t.slice(awal).map((tt, i) => ({ x: hariKe(tt), y: seri.rain[awal + i] }));
    const tAkhir = seri.t[n - 1];
    const ram = siap ? hasil.ramalan.map((v, i) => ({ x: hariKe(tAkhir) + i + 1, y: v })) : [];
    const uji =
      hasil.uji && hasil.status === "selesai"
        ? hasil.uji.p.map((v, i) => ({ x: hariKe(seri.t[hasil.uji!.dari + i]), y: v })).filter((q) => q.x >= 0)
        : [];
    const xMax = Math.max(hariKe(tAkhir) + Math.max(h, 1) + 1, 7);
    const semuaY = [...hist.map((q) => q.y), ...ram.map((q) => q.y), ...uji.map((q) => q.y)];
    const yMax = Math.max(...semuaY, 1);

    /* Tanda tanggal: langkah bulat dalam hari, kira-kira enam tanda */
    const langkah = [1, 2, 7, 14, 30, 61, 91, 182, 365].find((s) => xMax / s <= 7) ?? 365;
    const tanda: { at: number; label: string }[] = [];
    if (langkah >= 30) {
      /* Langkah sebulan atau lebih jatuh di tanggal 1, bukan tiap 30 hari
         dari hari pertama data (dulu "4 Agu, 3 Sep, 3 Okt") */
      const tiap = Math.round(langkah / 30.4);
      const d0 = new Date(t0);
      let bl = d0.getUTCFullYear() * 12 + d0.getUTCMonth() + (d0.getUTCDate() > 1 ? 1 : 0);
      bl = Math.ceil(bl / tiap) * tiap;
      for (; ; bl += tiap) {
        const k = hariKe(Date.UTC(Math.floor(bl / 12), bl % 12, 1));
        if (k > xMax) break;
        tanda.push({ at: k, label: `${BLN[lang][bl % 12]} ${String(Math.floor(bl / 12)).slice(2)}` });
      }
    } else {
      for (let k = 0; k <= xMax; k += langkah) {
        const d = new Date(t0 + k * HARI);
        tanda.push({ at: k, label: `${d.getUTCDate()} ${BLN[lang][d.getUTCMonth()]}` });
      }
    }

    const deret: ChartSeries[] = [
      { pts: hist, color: C.ink, weight: W.thin, dash: DASH.solid },
      /* Deret uji bukan keadaan kritis: tinta kedua, garis putus. */
      ...(uji.length ? [{ pts: uji, color: C.ink2, weight: W.thin, dash: DASH.hidden }] : []),
      ...(ram.length ? [{ pts: [{ x: hariKe(tAkhir), y: seri.rain[n - 1] }, ...ram], color: C.water, weight: W.bold, dash: DASH.hidden }] : []),
    ];

    drawChart(
      ctx,
      w,
      hh,
      {
        xMin: 0,
        xMax,
        yMin: 0,
        yMax: yMax * 1.35,
        axisX: nama.x,
        axisY: nama.y,
        noGrid: true,
        title: nama.judul,
        xTickLabels: tanda,
        series: deret,
        markers: [
          ...hist.map((q) => ({ x: q.x, y: q.y, color: C.ink })),
          ...ram.map((q) => ({ x: q.x, y: q.y, color: C.water, hollow: true })),
        ],
        rules: [{ axis: "x", at: hariKe(tAkhir), color: C.ink3, weight: W.hair, dash: DASH.axis }],
        legend: [
          { text: nama.hist, color: C.ink, line: { weight: W.thin }, marker: true },
          ...(uji.length ? [{ text: x.lblUji, color: C.ink2, line: { weight: W.thin, dash: DASH.hidden } }] : []),
          ...(ram.length ? [{ text: nama.pred, color: C.water, line: { weight: W.bold, dash: DASH.hidden }, marker: true, hollow: true }] : []),
        ],
        heading: hasil.status === "gagal" ? x.gagal : bermasalah ? x.celah : undefined,
        headingColor: C.signal,
      },
      lang
    );
  };

  const ref = useCanvas((ctx, w, hh) => gambar(ctx, w, hh), [kunci, hasil, h, judul, namaX, namaY, lblHist, lblPred, lang, cukup]);

  const kabar = (teks: string) => {
    setPesan(teks);
    setTimeout(() => setPesan(null), 2200);
  };
  const tombol =
    "label border-b border-rule-strong pb-px text-[0.8rem] text-ink-2 hover:border-ink hover:text-ink disabled:opacity-40";
  const isian = (label: string, nilai: string, ubah: (v: string) => void) => (
    <label className="flex items-baseline gap-3 border-b border-rule-faint py-1.5">
      <span className="label w-28 shrink-0 text-[0.8rem] text-ink-2">{label}</span>
      <input value={nilai} onChange={(e) => ubah(e.target.value)} className="label w-full min-w-0 bg-transparent text-[0.84rem] text-ink outline-none" />
    </label>
  );

  const ukur =
    mode === "mv"
      ? (UKUR.mv as unknown as Record<string, { mae: number; rmse: number; nse: number }>)[model]
      : model === "arima"
        ? null
        : (UKUR.uv_lengkap as unknown as Record<string, { mae: number; rmse: number; nse: number }>)[model];
  const ukurNb = mode === "uv" && model !== "arima" ? (UKUR.uv as unknown as Record<string, { mae: number; rmse: number; nse: number }>)[model] : null;
  const persisUkur = mode === "mv" ? UKUR.mv.persistensi : UKUR.uv_lengkap.persistensi;
  const klaim = mode === "uv" ? KLAIM_CL42[uvModel] : null;
  const tAkhir = n ? seri.t[n - 1] : 0;
  /* Tanggal sebagai Date: di Excel menjadi tanggal sungguhan, di CSV ditulis 2020-12-01 */
  const isiEkspor = (): [string[], (Date | number | string)[][]] => [
    lang === "id"
      ? ["tanggal", "hujan_mm", ...(mode === "mv" ? ["tma_m"] : []), "jenis"]
      : ["date", "rain_mm", ...(mode === "mv" ? ["wl_m"] : []), "type"],
    [
      ...seri.t.map((tt, i) => [new Date(tt), seri.rain[i], ...(mode === "mv" ? [seri.wl[i]] : []), "data"]),
      ...hasil.ramalan.map((v, i) => [
        new Date(tAkhir + (i + 1) * HARI),
        v,
        ...(mode === "mv" ? [""] : []),
        `${lang === "id" ? "ramalan" : "forecast"} ${NAMA[model]}`,
      ]),
    ],
  ];
  const s = hasil.uji?.skor;
  const pr = hasil.uji?.persistensi;
  const redup = siap ? undefined : { opacity: 0.45 };
  const urutArima = hasil.arima
    ? `ARIMA(${hasil.arima.order.p},${hasil.arima.order.d},${hasil.arima.order.q})${hasil.arima.order.s ? `(${hasil.arima.order.P},${hasil.arima.order.D},${hasil.arima.order.Q})${hasil.arima.order.s}` : ""}`
    : "";
  const wUji = Math.max(5, Math.round(n * 0.2));
  const mx = lang === "id" ? "maks" : "max";
  const dr = lang === "id" ? "dari" : "from";
  const langkah: LangkahHitung[] =
    siap && hasil.uji && s && pr
      ? [
          {
            judul: x.hBagi,
            rumus: <span>w = {mx}( 5; round( {fmt(0.2, 1)} · n ) );  {dr} = {mx}( 7; n − w )</span>,
            isi: `${mx}( 5; round( ${fmt(0.2, 1)} · ${n} ) ) = ${wUji};  ${mx}( 7; ${n} − ${wUji} )`,
            hasil: `w = ${wUji};  ${dr} = ${hasil.uji.dari}`,
          },
          {
            judul: x.hModel,
            rumus: <span>ŷ(t) = f( y(t − 1), …, y(t − 7) )</span>,
            isi: hasil.arima ? `${urutArima}, AICc ${fmt(hasil.arima.aicc, 1)}` : NAMA[model],
            hasil: `${hasil.uji.p.length} ${x.hari}`,
          },
          {
            judul: x.hSkor,
            rumus: (<><span>MAE, RMSE, NSE = 1 −</span><Frac num="Σ( y − ŷ )²" den="Σ( y − ȳ )²" /></>),
            isi: `n = ${s.n}`,
            hasil: `${fmt(s.mae, 3)};  ${fmt(s.rmse, 3)};  ${fmt(s.nse, 3)}`,
            satuan: "mm; mm; —",
          },
          {
            judul: x.hPersis,
            rumus: <span>MAE, RMSE, NSE</span>,
            isi: `n = ${pr.n}`,
            hasil: `${fmt(pr.mae, 3)};  ${fmt(pr.rmse, 3)};  ${fmt(pr.nse, 3)}`,
            satuan: "mm; mm; —",
          },
          {
            judul: x.hBanding,
            rumus: <span>RMSE model ⋚ RMSE {lang === "id" ? "kemarin" : "yesterday"}</span>,
            isi: `${fmt(s.rmse, 3)} ${kalah ? ">" : "≤"} ${fmt(pr.rmse, 3)}`,
            hasil: kalah ? x.lebihBurukKata : x.lebihBaikKata,
            tint: kalah ? C.caution : undefined,
          },
        ]
      : [];
  const bocorIni = mode === "uv" && BOCOR.includes(uvModel);
  const nadaKeadaan: Tone = !cukup || hasil.status === "gagal" || bermasalah
    ? "invalid"
    : !siap
      ? "neutral"
      : kalah || bocorIni || hasil.dipotong || mode === "mv"
        ? "caution"
        : "pass";

  return (
    <LabShell
      sheet="HY-06"
      subject={SUBJECTS.HY[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Model dari cl42 meramal <Term tint={C.water}>hujan beberapa hari ke depan</Term>{" "}
            dari tujuh hari terakhir. Ketelitiannya tidak diambil dari angka lama,
            melainkan diuji ulang pada data yang dimasukkan, lewat{" "}
            <Term tint={C.ink2}>uji satu langkah</Term>, dan dibandingkan dengan
            tebakan paling sederhana: hujan besok sama dengan hari ini.
          </p>
        ) : (
          <p>
            Models from cl42 forecast <Term tint={C.water}>rainfall several days ahead</Term>{" "}
            from the last seven days. Their accuracy is not taken from old figures but
            re-tested on the data entered, by a <Term tint={C.ink2}>one-step test</Term>,
            and compared with the simplest guess there is: tomorrow's rain equals today's.
          </p>
        )
      }
      drawing={
        <div>
          <Sheet
            number="HY-06"
            title={x.sheetTitle}
            rev="A"
            cells={[
              { label: t.tbUnit, value: lang === "id" ? "mm/hari" : "mm/day" },
              { label: lang === "id" ? "Model" : "Model", value: NAMA[model] },
              { label: "n", value: String(n) },
              { label: "RMSE", value: siap && s ? fmt(s.rmse, 3) : "—", tint: kalah ? C.caution : undefined },
              { label: "NSE", value: siap && s && Number.isFinite(s.nse) ? fmt(s.nse, 3) : "—" },
            ]}
          >
            <canvas ref={ref} className="block h-full w-full" />
          </Sheet>
          <div className="mt-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
            <button type="button" className={tombol} onClick={() => downloadPng(gambar, "prediksi-hujan")}>
              {x.unduhPng}
            </button>
            <button type="button" className={tombol} onClick={async () => kabar((await copyPng(gambar)) ? x.tersalin : x.gagalSalin)}>
              {x.salinGrafik}
            </button>
            <button type="button" className={tombol} onClick={() => downloadCsv(...isiEkspor(), "prediksi-hujan")}>
              {x.unduhCsv}
            </button>
            <button type="button" className={tombol} onClick={() => downloadXlsx(...isiEkspor(), "prediksi-hujan")}>
              {x.unduhXlsx}
            </button>
            {hasil.status === "hitung" && <span className="label text-[0.78rem] text-ink-3">{x.menghitung}</span>}
            {pesan && <span className="label text-[0.78rem] text-ink-3">{pesan}</span>}
          </div>
        </div>
      }
      side={
        <>
          <Block heading={x.blkMode}>
            <PresetRow
              label={x.mPilih}
              active={mode === "uv" ? 0 : 1}
              presets={[
                { label: x.mUv, apply: () => setMode("uv") },
                { label: x.mMv, apply: () => setMode("mv") },
              ]}
            />
          </Block>

          <Block heading={x.blkData}>
            <SeriesEntry rows={rows} onChange={setRows} dua={mode === "mv"} headV={x.hHujan} headW={x.hTma} sample={mode === "uv" ? contohUv : contohMv} />
          </Block>

          <Block heading={x.blkTampilan}>
            {isian(x.judul, nama.judul, setJudul)}
            {isian(x.sumbuX, nama.x, setNamaX)}
            {isian(x.sumbuY, nama.y, setNamaY)}
            {isian(x.lblHist, nama.hist, setLblHist)}
            {isian(x.lblPred, nama.pred, setLblPred)}
          </Block>

          <Block heading={x.blkMetode}>
            {mode === "uv" ? (
              <PresetRow
                label={x.model}
                active={UV_MODELS.indexOf(uvModel)}
                presets={UV_MODELS.map((m) => ({ label: NAMA[m], apply: () => setUvModel(m) }))}
              />
            ) : (
              <PresetRow
                label={x.model}
                active={MV_MODELS.indexOf(mvModel)}
                presets={MV_MODELS.map((m) => ({ label: NAMA[m], apply: () => setMvModel(m) }))}
              />
            )}
            {mode === "uv" && uvModel === "arima" && (
              <div className="mt-2.5">
                <PresetRow
                  label={x.arima}
                  active={ARIMA_PRESETS.indexOf(preset)}
                  presets={[
                    { label: x.aAuto, apply: () => setPreset("auto") },
                    { label: "(1,1,1)", apply: () => setPreset("111") },
                    { label: "(2,1,1)", apply: () => setPreset("211") },
                    { label: "(1,1,2)", apply: () => setPreset("112") },
                    { label: "SARIMA (1,1,1)(1,1,1)7", apply: () => setPreset("sarima7") },
                  ]}
                />
              </div>
            )}
            <div className="mt-3.5">
              <InputTable>
                <InputRow symbol="h" label={x.dH} value={h} min={1} max={30} step={1} digits={0} unit={lang === "id" ? "hari" : "days"} onChange={setH} tint={C.water} />
              </InputTable>
            </div>
            {/* Penanda keadaan pindah ke kartu keadaan. Yang tetap di sini
                hanya sifat model yang dipilih, bernada oker: model tetap
                berjalan, angkanya perlu dibaca dengan hati-hati. */}
            {(bocorIni || (mode === "uv" && uvModel !== "arima") || mode === "mv" || hasil.arima) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {bocorIni && <Flag tint={C.caution}>{x.bocor}</Flag>}
                {mode === "uv" && uvModel !== "arima" && <Flag tint={C.caution}>{x.tigaBulan}</Flag>}
                {mode === "mv" && <Flag tint={C.caution}>{x.tanpaKemampuan}</Flag>}
                {hasil.arima && <Flag tint={C.ink2}>{x.arimaPakai(urutArima, fmt(hasil.arima.aicc, 1))}</Flag>}
              </div>
            )}
          </Block>

          {cukup && (
            <StateCard
              tone={nadaKeadaan}
              badge={
                hasil.status === "gagal"
                  ? x.gagal
                  : bermasalah
                    ? x.celah
                    : !siap
                      ? x.menghitung
                      : kalah
                        ? x.kalah
                        : x.lebihBaik
              }
              state={
                hasil.status === "gagal"
                  ? `${x.gagalState} ${hasil.pesan ?? ""}`
                  : !siap || !s || !pr
                    ? x.hitungState
                    : lang === "id"
                      ? `${NAMA[model]} pada ${s.n} hari uji: RMSE ${fmt(s.rmse, 3)} mm, "sama dengan kemarin" ${fmt(pr.rmse, 3)} mm, ${kalah ? x.lebihBurukKata : x.lebihBaikKata}.`
                      : `${NAMA[model]} on ${s.n} test days: RMSE ${fmt(s.rmse, 3)} mm, "same as yesterday" ${fmt(pr.rmse, 3)} mm, ${kalah ? x.lebihBurukKata : x.lebihBaikKata}.`
              }
              notice={[
                bermasalah ? x.celahNote : null,
                siap && hasil.dipotong
                  ? x.dipotongNote(hasil.dipotong.uji, hasil.dipotong.ramalan, fmt(hasil.dipotong.min, 2))
                  : null,
                bocorIni ? x.bocorNote : null,
                mode === "uv" && uvModel !== "arima" ? x.tigaBulanNote : null,
                mode === "mv" ? x.tanpaKemampuanNote : null,
                notice(mode, lang),
              ]}
            />
          )}
          {!cukup && <StateCard tone="invalid" badge={x.kurang} state={x.kurangNote} />}

          {hasil.ramalan.length > 0 && (
            <Block heading={x.blkHasil}>
              {siap && hasil.dipotong && hasil.dipotong.ramalan > 0 && (
                <div className="mb-2.5">
                  <Flag tint={C.caution}>{x.dipotong}</Flag>
                </div>
              )}
              <div className="overflow-y-auto" aria-busy={!siap} style={{ maxHeight: "14rem", ...redup }}>
                <ResultTable
                  caption={x.tglR}
                  rows={hasil.ramalan.map((v, i) => ({
                    label: isoDate(tAkhir + (i + 1) * HARI),
                    value: fmt(v, 2),
                    unit: "mm",
                    tint: C.water,
                  }))}
                />
              </div>
            </Block>
          )}

          {s && pr && (
            <Block heading={x.blkUji}>
              <div className="mb-3">
                <BigResult
                  items={[
                    { symbol: "RMSE", label: NAMA[model], value: siap ? fmt(s.rmse, 3) : "—", unit: "mm", tint: siap && kalah ? C.caution : undefined },
                    { symbol: "RMSE", label: x.kolPersis, value: siap ? fmt(pr.rmse, 3) : "—", unit: "mm" },
                    { symbol: "ŷ₁", label: x.bHari1, value: siap && hasil.ramalan.length ? fmt(hasil.ramalan[0], 2) : "—", unit: "mm", tint: C.water },
                  ]}
                />
              </div>
              <table className="data" aria-busy={!siap} style={redup}>
                <thead>
                  <tr>
                    <th />
                    <th className="n">{x.kolModel}</th>
                    <th className="n">{x.kolPersis}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [x.rMae, s.mae, pr.mae, 3],
                    [x.rRmse, s.rmse, pr.rmse, 3],
                    [x.rNse, s.nse, pr.nse, 3],
                    [x.rAuc, s.auc, pr.auc, 3],
                    [x.rCrps, s.mae, pr.mae, 3],
                  ].map(([l, a, b, d]) => (
                    <tr key={String(l)}>
                      <td className="text-ink-2">{l as string}</td>
                      <td className="n font-semibold" style={{ color: (a as number) !== null && (l === x.rRmse) && kalah ? C.caution : undefined }}>
                        {a === null || !Number.isFinite(a as number) ? "—" : fmt(a as number, d as number)}
                      </td>
                      <td className="n text-ink-2">{b === null || !Number.isFinite(b as number) ? "—" : fmt(b as number, d as number)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="text-ink-2">{x.rN}</td>
                    <td className="n">{s.n}</td>
                    <td className="n text-ink-2">{pr.n}</td>
                  </tr>
                </tbody>
              </table>
              {langkah.length > 0 && (
                <div className="mt-3">
                  <Hitungan langkah={langkah} />
                </div>
              )}
            </Block>
          )}

          <Block heading={x.blkUkur}>
            <table className="data">
              <thead>
                <tr>
                  <th />
                  <th className="n">MAE</th>
                  <th className="n">RMSE</th>
                  <th className="n">NSE</th>
                </tr>
              </thead>
              <tbody>
                {ukur && (
                  <tr>
                    <td className="text-ink-2">{mode === "mv" ? x.ukurMv : x.ukurLengkap}</td>
                    <td className="n font-semibold">{fmt(ukur.mae, 3)}</td>
                    <td className="n font-semibold">{fmt(ukur.rmse, 3)}</td>
                    <td className="n font-semibold">{fmt(ukur.nse, 3)}</td>
                  </tr>
                )}
                {ukurNb && (
                  <tr>
                    <td className="text-ink-2">{x.ukurNotebook}</td>
                    <td className="n">{fmt(ukurNb.mae, 3)}</td>
                    <td className="n">{fmt(ukurNb.rmse, 3)}</td>
                    <td className="n">{fmt(ukurNb.nse, 3)}</td>
                  </tr>
                )}
                {model !== "arima" && (
                  <tr>
                    <td className="text-ink-2">{x.kolPersis}</td>
                    <td className="n text-ink-2">{fmt(persisUkur.mae, 3)}</td>
                    <td className="n text-ink-2">{fmt(persisUkur.rmse, 3)}</td>
                    <td className="n text-ink-2">{fmt(persisUkur.nse, 3)}</td>
                  </tr>
                )}
                {klaim && (
                  <tr>
                    <td className="text-ink-3">{model === "arima" ? `${x.klaim}: ${x.klaimArima}` : x.klaim}</td>
                    <td className="n text-ink-3 line-through">{fmt(klaim.mae, 2)}</td>
                    <td className="n text-ink-3 line-through">{fmt(klaim.rmse, 2)}</td>
                    <td className="n text-ink-3">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Block>

        </>
      }
      verification={<Verification checks={cek} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>NSE = 1 − Σ(y − ŷ)² / Σ(y − ȳ)²</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id" ? "nol: sama dengan menebak rata-rata" : "zero: same as guessing the mean"}
                </span>
              </Eq>
              <Eq>
                <span>ŷ(t) = f(y(t−1), …, y(t−7))</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id" ? "hanya hari yang sudah lewat" : "only days already past"}
                </span>
              </Eq>
              <Eq>
                <span>φ(B) Φ(Bˢ) (1 − B)ᵈ (1 − Bˢ)ᴰ y(t) = θ(B) Θ(Bˢ) ε(t)</span>
              </Eq>
            </>
          }
          note={x.note}
          refs={[...REFS[lang]]}
        />
      }
    />
  );
}

function notice(mode: "uv" | "mv", lang: Lang): string {
  if (mode === "mv") {
    const m = UKUR.mv;
    return lang === "id"
      ? `Pada ${m._uji.n} hari uji Catalonia, model multivariat terbaik (BiLSTM MV) mencapai MAE ${fmt(m.bilstm_mv.mae, 2)} mm, sedangkan tebakan "sama dengan kemarin" ${fmt(m.persistensi.mae, 2)} mm. Model itu jadi memang lebih baik daripada mengulang hari ini, tetapi NSE-nya ${fmt(m.bilstm_mv.nse, 3)}: tidak lebih baik daripada menebak hujan rata-rata setiap hari. Dua pembanding memberi dua jawaban, dan keduanya perlu dilaporkan.`
      : `On ${m._uji.n} Catalan test days, the best multivariate model (BiLSTM MV) reaches an MAE of ${fmt(m.bilstm_mv.mae, 2)} mm, against ${fmt(m.persistensi.mae, 2)} mm for "same as yesterday". So it is indeed better than repeating today, yet its NSE is ${fmt(m.bilstm_mv.nse, 3)}: no better than guessing the average rainfall every day. Two baselines give two answers, and both need reporting.`;
  }
  const u = UKUR.uv_lengkap;
  return lang === "id"
    ? `Pada ${u._uji.n} hari uji data latih lengkap, tebakan "sama dengan kemarin" mencapai MAE ${fmt(u.persistensi.mae, 3)} mm, RMSE ${fmt(u.persistensi.rmse, 3)} mm, NSE ${fmt(u.persistensi.nse, 3)}. LSTM dan BiLSTM sedikit lebih baik pada RMSE (${fmt(u.lstm.rmse, 3)} dan ${fmt(u.bilstm.rmse, 3)}) dan NSE (${fmt(u.lstm.nse, 3)} dan ${fmt(u.bilstm.nse, 3)}), tetapi kalah pada MAE (${fmt(u.lstm.mae, 3)} dan ${fmt(u.bilstm.mae, 3)}). XGBoost dan Gradient Boosting kalah pada ketiganya (MAE ${fmt(u.xgb.mae, 3)} dan ${fmt(u.gbr.mae, 3)}). Selisih yang tipis itu berarti model terbaik pun hanya menambah sedikit di atas apa yang sudah terlihat hari ini.`
    : `On ${u._uji.n} test days of the full training data, "same as yesterday" reaches an MAE of ${fmt(u.persistensi.mae, 3)} mm, RMSE ${fmt(u.persistensi.rmse, 3)} mm, NSE ${fmt(u.persistensi.nse, 3)}. LSTM and BiLSTM are slightly better on RMSE (${fmt(u.lstm.rmse, 3)} and ${fmt(u.bilstm.rmse, 3)}) and NSE (${fmt(u.lstm.nse, 3)} and ${fmt(u.bilstm.nse, 3)}), but worse on MAE (${fmt(u.lstm.mae, 3)} and ${fmt(u.bilstm.mae, 3)}). XGBoost and Gradient Boosting are worse on all three (MAE ${fmt(u.xgb.mae, 3)} and ${fmt(u.gbr.mae, 3)}). Margins this thin mean even the best model adds only a little beyond what is already visible today.`;

}
