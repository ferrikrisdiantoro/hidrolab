"use client";

import { useMemo, useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  Block,
  Flag,
  Hitungan,
  PresetRow,
  ResultTable,
  Sheet,
  StateCard,
  Term,
  type LangkahHitung,
} from "@/components/ui";
import { DataEntry, ptsFromRows, rowsFromPts, type Row } from "@/components/DataEntry";
import { useCanvas } from "@/lib/useCanvas";
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import { fmt, getNumberLocale } from "@/lib/hydraulics";
import {
  SAMPLE_REGRESSION,
  fitRegression,
  regressionFormula,
  type RegFit,
  type RegKind,
  type XY,
} from "@/lib/regression";
import { copyPng, copyText, downloadCsv, downloadPng, downloadXlsx, type Draw } from "@/lib/exportChart";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksRegression } from "@/lib/checksRegression";

const TXT = {
  id: {
    title: "Regresi",
    sheetTitle: "Diagram pencar dengan kurva regresi",
    blkData: "data masukan",
    blkTampilan: "pengaturan grafik",
    blkMetode: "metode regresi",
    blkRumus: "rumus regresi",
    blkMetrik: "metrik ketelitian",
    judul: "Judul grafik",
    sumbuX: "Nama sumbu x",
    sumbuY: "Nama sumbu y",
    labelData: "Label data",
    labelKurva: "Label kurva",
    defJudul: "Diagram pencar dengan kurva regresi",
    defX: "x (debit)",
    defY: "y (tinggi muka air)",
    defData: "Data",
    defKurva: "Kurva regresi",
    kLinear: "linear",
    kPoli: "polinomial",
    kEksp: "eksponensial",
    kPangkat: "pangkat",
    kLog: "logaritmik",
    kMA: "rata-rata bergerak",
    derajat: "derajat",
    jendela: "jendela",
    salin: "salin",
    tersalin: "tersalin",
    gagalSalin: "peramban menolak menyalin",
    unduhPng: "unduh grafik PNG",
    salinGrafik: "salin grafik",
    unduhCsv: "unduh data CSV",
    unduhXlsx: "unduh data Excel",
    rR2: "Koefisien determinasi",
    rR2Excel: "R² seperti garis tren Excel (ruang ln y)",
    rMae: "Galat mutlak rata-rata",
    rRmse: "Galat akar kuadrat rata-rata",
    rN: "Pasangan yang dipakai",
    rBuang: "Pasangan yang tidak berlaku bagi rumus ini",
    tidakDef: "tidak terdefinisi",
    kurang: "Data belum cukup untuk regresi ini",
    kurangNote:
      "Linear, eksponensial, pangkat, dan logaritmik butuh paling sedikit dua pasangan yang berlaku; polinomial satu lebih banyak daripada derajatnya; rata-rata bergerak paling sedikit selebar jendelanya. Pasangan yang tidak dicentang tidak dihitung.",
    buang: (n: number, k: string) =>
      `${n} pasangan dibuang: bentuk ${k} tidak berlaku untuk nilai nol atau negatif di situ`,
    maRumus: (w: number) => `y = rata-rata ${w} titik`,
    hN: "Pasangan yang dipakai",
    hKoef: "Koefisien",
    hKoefPoli: "Kuadrat terkecil pada x ternormal ke [−1, 1], lalu dijabarkan ke x",
    hKoefLn: "Kuadrat terkecil di ruang logaritma",
    hMA: "Rata-rata bergerak, titik diurutkan menurut x",
    hR2: "Koefisien determinasi di ruang y",
    hMae: "Galat mutlak rata-rata",
    hRmse: "Galat akar kuadrat rata-rata",
    dicentang: "dicentang",
    dibuang: "dibuang",
    lnNote:
      "Bentuk eksponensial dan pangkat dicocokkan di ruang ln y, seperti garis tren Excel. R² yang ditulis Excel untuk keduanya adalah R² dari ln y; R² di ruang y bisa jauh berbeda.",
    note:
      "Regresi mencari rumus yang paling dekat dengan titik-titik data menurut satu ukuran, jumlah kuadrat selisihnya. Tiga hal pantas diingat sebelum rumusnya disalin ke laporan. Pertama, R² selalu naik ketika derajat polinomial dinaikkan, bahkan bila suku tambahannya hanya mengikuti gangguan acak; polinomial derajat n melewati n + 1 titik dengan tepat dan R²-nya satu, tetapi itu bukan hukum alam. Kedua, bentuk eksponensial dan pangkat dicocokkan di ruang logaritma, seperti Excel, sehingga R² yang ditulis Excel untuk keduanya adalah R² dari ln y, bukan dari y; lembar ini menulis keduanya. Ketiga, rumus apa pun hanya dapat dipercaya di dalam rentang x datanya: di luar itu polinomial derajat tinggi dapat berbelok ke arah mana saja.",
  },
  en: {
    title: "Regression",
    sheetTitle: "Scatter plot with regression curve",
    blkData: "input data",
    blkTampilan: "chart settings",
    blkMetode: "regression method",
    blkRumus: "regression formula",
    blkMetrik: "accuracy metrics",
    judul: "Chart title",
    sumbuX: "x axis name",
    sumbuY: "y axis name",
    labelData: "Data label",
    labelKurva: "Curve label",
    defJudul: "Scatter plot with regression curve",
    defX: "x (discharge)",
    defY: "y (water level)",
    defData: "Data",
    defKurva: "Regression curve",
    kLinear: "linear",
    kPoli: "polynomial",
    kEksp: "exponential",
    kPangkat: "power",
    kLog: "logarithmic",
    kMA: "moving average",
    derajat: "degree",
    jendela: "window",
    salin: "copy",
    tersalin: "copied",
    gagalSalin: "the browser refused to copy",
    unduhPng: "download chart PNG",
    salinGrafik: "copy chart",
    unduhCsv: "download data CSV",
    unduhXlsx: "download data Excel",
    rR2: "Coefficient of determination",
    rR2Excel: "R² as in an Excel trendline (ln y space)",
    rMae: "Mean absolute error",
    rRmse: "Root mean square error",
    rN: "Pairs used",
    rBuang: "Pairs this formula cannot use",
    tidakDef: "undefined",
    kurang: "Not enough data for this regression",
    kurangNote:
      "Linear, exponential, power, and logarithmic need at least two usable pairs; a polynomial one more than its degree; a moving average at least as many as its window. Unticked pairs are not counted.",
    buang: (n: number, k: string) =>
      `${n} pairs dropped: the ${k} form does not hold for zero or negative values there`,
    maRumus: (w: number) => `y = moving average of ${w} points`,
    hN: "Pairs used",
    hKoef: "Coefficients",
    hKoefPoli: "Least squares on x normalised to [−1, 1], then expanded back to x",
    hKoefLn: "Least squares in log space",
    hMA: "Moving average, points sorted by x",
    hR2: "Coefficient of determination in y space",
    hMae: "Mean absolute error",
    hRmse: "Root mean square error",
    dicentang: "ticked",
    dibuang: "dropped",
    lnNote:
      "The exponential and power forms are fitted in ln y space, as an Excel trendline is. The R² Excel writes for them is the R² of ln y; the R² in y space can differ widely.",
    note:
      "Regression finds the formula closest to the data points by one measure, the sum of squared differences. Three things are worth remembering before the formula is pasted into a report. First, R² always rises when the polynomial degree is raised, even when the extra terms only follow random noise; a degree-n polynomial passes exactly through n + 1 points with R² equal to one, but that is not a law of nature. Second, the exponential and power forms are fitted in log space, as Excel does, so the R² Excel reports for them is the R² of ln y, not of y; this sheet writes both. Third, any formula can only be trusted inside the x range of its data: outside it a high-degree polynomial can turn in any direction.",
  },
} as const;

const REFS = {
  id: [
    "Draper, N.R. & Smith, H. (1998). Applied Regression Analysis, edisi ke-3. Wiley, bab 1, 5, dan 12.",
    "NIST (2003). Statistical Reference Datasets, Linear Least Squares Regression: Norris dan Pontius. itl.nist.gov/div898/strd.",
    "Microsoft. Trendline options in Office: linear, logarithmic, polynomial, power, exponential, moving average.",
    "Montgomery, D.C., Peck, E.A. & Vining, G.G. (2012). Introduction to Linear Regression Analysis, edisi ke-5. Wiley.",
  ],
  en: [
    "Draper, N.R. & Smith, H. (1998). Applied Regression Analysis, 3rd edition. Wiley, Chapters 1, 5, and 12.",
    "NIST (2003). Statistical Reference Datasets, Linear Least Squares Regression: Norris and Pontius. itl.nist.gov/div898/strd.",
    "Microsoft. Trendline options in Office: linear, logarithmic, polynomial, power, exponential, moving average.",
    "Montgomery, D.C., Peck, E.A. & Vining, G.G. (2012). Introduction to Linear Regression Analysis, 5th edition. Wiley.",
  ],
} as const;

const KINDS: RegKind[] = ["linear", "polinomial", "eksponensial", "pangkat", "logaritmik", "rata-bergerak"];
const DEGREES = [2, 3, 4, 5, 6];
const WINDOWS = [2, 3, 5, 7, 10];

/** Angka rumus dengan enam angka bermakna dan pemisah desimal bahasa lembar */
function angkaRumus(v: number, lang: Lang) {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const a = Math.abs(v);
  const t =
    a >= 1e-3 && a < 1e7
      ? Number(v.toPrecision(6)).toLocaleString(getNumberLocale(), {
          maximumSignificantDigits: 6,
          useGrouping: false,
        })
      : v.toExponential(5).replace("e", "×10^").replace("+", "");
  return lang === "id" ? t.replace(/\.(?=\d)/, ",") : t;
}

function kurva(f: RegFit, xMin: number, xMax: number): XY[] {
  if (!f.predict) return f.maLine;
  const a = f.kind === "pangkat" || f.kind === "logaritmik" ? Math.max(xMin, f.xMin * 1e-6, 1e-12) : xMin;
  return Array.from({ length: 241 }, (_, i) => {
    const x = a + ((xMax - a) * i) / 240;
    return { x, y: f.predict!(x) };
  }).filter((p) => Number.isFinite(p.y));
}

export function RegresiClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [rows, setRows] = useState<Row[]>(rowsFromPts(SAMPLE_REGRESSION));
  const [kind, setKind] = useState<RegKind>("linear");
  const [deg, setDeg] = useState(2);
  const [win, setWin] = useState(3);
  const [judul, setJudul] = useState<string | null>(null);
  const [namaX, setNamaX] = useState<string | null>(null);
  const [namaY, setNamaY] = useState<string | null>(null);
  const [lblData, setLblData] = useState<string | null>(null);
  const [lblKurva, setLblKurva] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const { pts } = ptsFromRows(rows);
  const kunci = JSON.stringify(pts);
  const f = useMemo(() => fitRegression(pts, kind, deg, win), [kunci, kind, deg, win]); // eslint-disable-line react-hooks/exhaustive-deps
  const cek = useMemo(() => checksRegression(pts, kind, deg, win), [kunci, kind, deg, win]); // eslint-disable-line react-hooks/exhaustive-deps

  const nama = {
    judul: judul ?? x.defJudul,
    x: namaX ?? x.defX,
    y: namaY ?? x.defY,
    data: lblData ?? x.defData,
    kurva: lblKurva ?? x.defKurva,
  };
  const namaBentuk = [x.kLinear, x.kPoli, x.kEksp, x.kPangkat, x.kLog, x.kMA][KINDS.indexOf(kind)];
  /* regressionFormula menulis rata-rata bergerak dalam Bahasa Indonesia
     saja (regression.ts:320); teksnya diganti di sini menurut bahasa. */
  const rumus = !f
    ? ""
    : kind === "rata-bergerak"
      ? x.maRumus(f.coeffs[0])
      : regressionFormula(f, (v) => angkaRumus(v, lang));
  const ar = (v: number) => angkaRumus(v, lang);
  const langkah: LangkahHitung[] = !f
    ? []
    : [
        {
          judul: x.hN,
          rumus: <span>n = {x.dicentang} − {x.dibuang}</span>,
          isi: `${f.n + f.dropped} − ${f.dropped}`,
          hasil: String(f.n),
        },
        kind === "linear"
          ? {
              judul: x.hKoef,
              rumus: (<><span>b =</span><Frac num="Sxy" den="Sxx" /><span>;  a = ȳ − b · x̄</span></>),
              isi: "Σ( x − x̄ )( y − ȳ ) / Σ( x − x̄ )²",
              hasil: `a = ${ar(f.coeffs[0])};  b = ${ar(f.coeffs[1])}`,
            }
          : kind === "polinomial"
            ? {
                judul: x.hKoefPoli,
                rumus: <span>y = Σ cᵢ · xⁱ</span>,
                isi: `${f.coeffs.length} ${lang === "id" ? "koefisien" : "coefficients"}`,
                hasil: f.coeffs.map((c, i) => `c${i} = ${ar(c)}`).join(";  "),
              }
            : kind === "eksponensial"
              ? {
                  judul: x.hKoefLn,
                  rumus: <span>ln y = ln a + b · x</span>,
                  isi: "b = Sxy / Sxx;  ln a = ȳ − b · x̄  ( y → ln y )",
                  hasil: `a = ${ar(f.coeffs[0])};  b = ${ar(f.coeffs[1])}`,
                }
              : kind === "pangkat"
                ? {
                    judul: x.hKoefLn,
                    rumus: <span>ln y = ln a + b · ln x</span>,
                    isi: "b = Sxy / Sxx;  ln a = ȳ − b · x̄  ( x → ln x, y → ln y )",
                    hasil: `a = ${ar(f.coeffs[0])};  b = ${ar(f.coeffs[1])}`,
                  }
                : kind === "logaritmik"
                  ? {
                      judul: x.hKoef,
                      rumus: <span>y = a + b · ln x</span>,
                      isi: "b = Sxy / Sxx;  a = ȳ − b · x̄  ( x → ln x )",
                      hasil: `a = ${ar(f.coeffs[0])};  b = ${ar(f.coeffs[1])}`,
                    }
                  : {
                      judul: x.hMA,
                      rumus: (<><span>ŷᵢ =</span><Frac num="yᵢ + yᵢ₋₁ + … + yᵢ₋w₊₁" den="w" /></>),
                      isi: `w = ${f.coeffs[0]}`,
                      hasil: `${f.maLine.length} ${lang === "id" ? "titik garis" : "line points"}`,
                    },
        {
          judul: x.hR2,
          rumus: (<><span>R² = 1 −</span><Frac num="SSres" den="SStot" /></>),
          isi: "1 − Σ( y − ŷ )² / Σ( y − ȳ )²",
          hasil: f.r2 !== null ? fmt(f.r2, 5) : x.tidakDef,
          tint: C.water,
        },
        {
          judul: x.hMae,
          rumus: (<><span>MAE =</span><Frac num="Σ| y − ŷ |" den="n" /></>),
          isi: `Σ| y − ŷ | / ${f.n}`,
          hasil: fmt(f.mae, 4),
        },
        {
          judul: x.hRmse,
          rumus: <span>RMSE = √( SSres / n )</span>,
          isi: `√( Σ( y − ŷ )² / ${f.n} )`,
          hasil: fmt(f.rmse, 4),
        },
      ];

  const berlaku = (p: XY) =>
    kind === "eksponensial" ? p.y > 0 : kind === "pangkat" ? p.x > 0 && p.y > 0 : kind === "logaritmik" ? p.x > 0 : true;

  const gambar: Draw = (ctx, w, h) => {
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const xMin = xs.length ? Math.min(...xs) : 0;
    const xMax = xs.length ? Math.max(...xs) : 1;
    const lebarX = xMax - xMin || Math.abs(xMax) || 1;
    const garis = f ? kurva(f, xMin, xMax) : [];
    const semuaY = [...ys, ...garis.map((p) => p.y)];
    const yMin = semuaY.length ? Math.min(...semuaY) : 0;
    const yMax = semuaY.length ? Math.max(...semuaY) : 1;
    const lebarY = yMax - yMin || Math.abs(yMax) || 1;

    const deret: ChartSeries[] = f
      ? [
          {
            pts: garis,
            color: C.water,
            weight: W.bold,
            dash: kind === "rata-bergerak" ? DASH.hidden : DASH.solid,
          },
        ]
      : [];

    drawChart(
      ctx,
      w,
      h,
      {
        xMin: xMin - lebarX * 0.05,
        xMax: xMax + lebarX * 0.05,
        /* Ruang di atas untuk legenda di pojok kiri atas */
        yMin: yMin - lebarY * 0.06,
        yMax: yMax + lebarY * 0.3,
        axisX: nama.x,
        axisY: nama.y,
        noGrid: true,
        title: nama.judul,
        series: deret,
        markers: pts.map((p) => ({ x: p.x, y: p.y, color: C.ink, hollow: !berlaku(p) })),
        legend: [
          { text: nama.data, color: C.ink },
          ...(f
            ? [
                {
                  text: nama.kurva,
                  color: C.water,
                  line: { weight: W.bold, dash: kind === "rata-bergerak" ? DASH.hidden : DASH.solid },
                },
              ]
            : []),
        ],
        heading: f ? undefined : x.kurang,
        headingColor: C.signal,
      },
      lang
    );
  };

  const ref = useCanvas((ctx, w, h) => gambar(ctx, w, h), [
    kunci,
    kind,
    deg,
    win,
    judul,
    namaX,
    namaY,
    lblData,
    lblKurva,
    lang,
  ]);

  const kabar = (teks: string) => {
    setPesan(teks);
    setTimeout(() => setPesan(null), 2200);
  };

  /* Satu baris tabel menjadi satu baris ekspor, termasuk yang tidak
     dicentang, supaya datanya dapat dimuat ulang utuh */
  const isiEkspor = (): [string[], (number | string)[][]] => [
    [nama.x, nama.y, lang === "id" ? "dipakai" : "used", lang === "id" ? "prediksi" : "predicted"],
    rows.flatMap((r) => {
      const px = parseFloat(r.x.replace(",", "."));
      const py = parseFloat(r.y.replace(",", "."));
      if (!Number.isFinite(px) || !Number.isFinite(py)) return [];
      const ramal = f?.predict ? f.predict(px) : NaN;
      return [[px, py, r.on === false ? 0 : 1, Number.isFinite(ramal) ? ramal : ""]];
    }),
  ];

  const tombol =
    "label border-b border-rule-strong pb-px text-[0.8rem] text-ink-2 hover:border-ink hover:text-ink disabled:opacity-40";

  const isian = (label: string, nilai: string, ubah: (v: string) => void) => (
    <label className="flex items-baseline gap-3 border-b border-rule-faint py-1.5">
      <span className="label w-28 shrink-0 text-[0.8rem] text-ink-2">{label}</span>
      <input
        value={nilai}
        onChange={(e) => ubah(e.target.value)}
        className="label w-full bg-transparent text-[0.84rem] text-ink outline-none"
      />
    </label>
  );

  return (
    <LabShell
      sheet="HY-05"
      subject={SUBJECTS.HY[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Enam bentuk garis tren yang sama dengan Excel, dicocokkan pada{" "}
            <Term tint={C.ink}>data masukan</Term> dengan kuadrat terkecil.{" "}
            <Term tint={C.water}>Kurvanya</Term> dan rumusnya selalu sama,
            jadi rumus yang disalin ke laporan memang rumus yang tergambar.
          </p>
        ) : (
          <p>
            The same six trendline forms as Excel, fitted to the{" "}
            <Term tint={C.ink}>input data</Term> by least squares. The{" "}
            <Term tint={C.water}>curve</Term> and the formula always agree, so
            the formula pasted into a report is the one drawn.
          </p>
        )
      }
      drawing={
        <div>
          <Sheet
            number="HY-05"
            title={x.sheetTitle}
            rev="A"
            cells={[
              { label: t.tbUnit, value: lang === "id" ? "satuan data" : "data units" },
              { label: "n", value: f ? String(f.n) : "—" },
              { label: "R²", value: f && f.r2 !== null ? fmt(f.r2, 4) : "—", tint: C.water },
              { label: "RMSE", value: f ? fmt(f.rmse, 4) : "—" },
              { label: lang === "id" ? "Bentuk" : "Form", value: namaBentuk },
            ]}
          >
            <canvas ref={ref} className="block h-full w-full" />
          </Sheet>
          <div className="mt-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
            <button type="button" className={tombol} onClick={() => downloadPng(gambar, "regresi")}>
              {x.unduhPng}
            </button>
            <button
              type="button"
              className={tombol}
              onClick={async () => kabar((await copyPng(gambar)) ? x.tersalin : x.gagalSalin)}
            >
              {x.salinGrafik}
            </button>
            <button type="button" className={tombol} onClick={() => downloadCsv(...isiEkspor(), "regresi")}>
              {x.unduhCsv}
            </button>
            <button type="button" className={tombol} onClick={() => downloadXlsx(...isiEkspor(), "regresi")}>
              {x.unduhXlsx}
            </button>
            {pesan && <span className="label text-[0.78rem] text-ink-3">{pesan}</span>}
          </div>
        </div>
      }
      side={
        <>
          <Block heading={x.blkData}>
            <DataEntry rows={rows} onChange={setRows} headX="x" headY="y" sample={SAMPLE_REGRESSION} reset />
          </Block>

          <Block heading={x.blkTampilan}>
            {isian(x.judul, nama.judul, setJudul)}
            {isian(x.sumbuX, nama.x, setNamaX)}
            {isian(x.sumbuY, nama.y, setNamaY)}
            {isian(x.labelData, nama.data, setLblData)}
            {isian(x.labelKurva, nama.kurva, setLblKurva)}
          </Block>

          <Block heading={x.blkMetode}>
            <PresetRow
              label={lang === "id" ? "bentuk" : "form"}
              active={KINDS.indexOf(kind)}
              presets={[x.kLinear, x.kPoli, x.kEksp, x.kPangkat, x.kLog, x.kMA].map((l, i) => ({
                label: l,
                apply: () => setKind(KINDS[i]),
              }))}
            />
            {kind === "polinomial" && (
              <div className="mt-2.5">
                <PresetRow
                  label={x.derajat}
                  active={DEGREES.indexOf(deg)}
                  presets={DEGREES.map((d) => ({ label: String(d), apply: () => setDeg(d) }))}
                />
              </div>
            )}
            {kind === "rata-bergerak" && (
              <div className="mt-2.5">
                <PresetRow
                  label={x.jendela}
                  active={WINDOWS.indexOf(win)}
                  presets={WINDOWS.map((d) => ({ label: String(d), apply: () => setWin(d) }))}
                />
              </div>
            )}
          </Block>

          <Block heading={x.blkRumus}>
            {f ? (
              <div className="flex items-start justify-between gap-3 border border-rule-strong bg-sheet px-3 py-2.5">
                <code className="value text-[0.86rem] leading-snug text-ink">{rumus}</code>
                <button
                  type="button"
                  className={`${tombol} shrink-0`}
                  onClick={async () => kabar((await copyText(rumus)) ? x.tersalin : x.gagalSalin)}
                >
                  {x.salin}
                </button>
              </div>
            ) : null}
            {/* Pasangan yang dibuang bukan keadaan kritis: hasilnya tetap
                berlaku untuk pasangan sisanya, jadi oker. */}
            {f && f.dropped > 0 && (
              <div className="mt-2.5">
                <Flag tint={C.caution}>{x.buang(f.dropped, namaBentuk)}</Flag>
              </div>
            )}
          </Block>

          {f && (
            <Block heading={x.blkMetrik}>
              <ResultTable
                rows={[
                  { symbol: "R²", label: x.rR2, value: f.r2 !== null ? fmt(f.r2, 5) : x.tidakDef, tint: C.water, strong: true },
                  ...(kind === "eksponensial" || kind === "pangkat"
                    ? [{ symbol: "R²ln", label: x.rR2Excel, value: f.r2Excel !== null ? fmt(f.r2Excel, 5) : x.tidakDef }]
                    : []),
                  { symbol: "MAE", label: x.rMae, value: fmt(f.mae, 4) },
                  /* RMSE ikut ditulis besar: R² tinggi belum berarti
                     modelnya baik (masukan klien baris 71). */
                  { symbol: "RMSE", label: x.rRmse, value: fmt(f.rmse, 4), strong: true },
                  { symbol: "n", label: x.rN, value: String(f.n) },
                  ...(f.dropped > 0 ? [{ symbol: "—", label: x.rBuang, value: String(f.dropped) }] : []),
                ]}
              />
              <div className="mt-3">
                <Hitungan langkah={langkah} />
              </div>
            </Block>
          )}

          {f ? (
            <StateCard
              tone={f.dropped > 0 ? "caution" : "neutral"}
              badge={namaBentuk}
              state={
                lang === "id"
                  ? `Bentuk ${namaBentuk} pada ${f.n} pasangan: R² ${f.r2 !== null ? fmt(f.r2, 4) : x.tidakDef}, RMSE ${fmt(f.rmse, 4)}.`
                  : `The ${namaBentuk} form on ${f.n} pairs: R² ${f.r2 !== null ? fmt(f.r2, 4) : x.tidakDef}, RMSE ${fmt(f.rmse, 4)}.`
              }
              notice={[
                f.dropped > 0 ? x.buang(f.dropped, namaBentuk) : null,
                notice(pts, lang),
                kind === "eksponensial" || kind === "pangkat" ? x.lnNote : null,
              ]}
            />
          ) : (
            <StateCard tone="invalid" badge={x.kurang} state={x.kurangNote} />
          )}
        </>
      }
      verification={<Verification checks={cek} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>{lang === "id" ? "minimumkan" : "minimise"} Σ (yᵢ − ŷᵢ)²</span>
              </Eq>
              <Eq>
                <span>y = a·e^(bx) → ln y = ln a + b x</span>
                <span className="ml-5">y = a·x^b → ln y = ln a + b ln x</span>
              </Eq>
              <Eq>
                <span>R² = 1 − Σ(y − ŷ)² / Σ(y − ȳ)²</span>
                <span className="ml-5">RMSE = √(Σ(y − ŷ)²/n)</span>
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

function notice(pts: XY[], lang: Lang): string {
  const lin = fitRegression(pts, "linear");
  const tinggi = fitRegression(pts, "polinomial", Math.min(6, Math.max(2, pts.length - 1)));
  if (!lin || !tinggi || lin.r2 === null || tinggi.r2 === null)
    return lang === "id"
      ? "Dengan paling sedikit tiga pasangan data, lembar ini membandingkan garis lurus dengan polinomial derajat tertinggi di sini."
      : "With at least three data pairs, this sheet compares a straight line with the highest-degree polynomial here.";
  const d = tinggi.coeffs.length - 1;
  const lebar = lin.xMax - lin.xMin;
  const xLuar = lin.xMax + lebar * 0.25;
  const yLin = lin.predict!(xLuar);
  const yPol = tinggi.predict!(xLuar);
  /* "Hampir tidak berbeda" hanya bila selisih R²-nya memang kecil; pada
     data melengkung (y = x², x −3..3) garis lurus R² 0 lawan polinomial 1. */
  const mirip = tinggi.r2 - lin.r2 < 0.01;
  if (lang === "en")
    return mirip
      ? `A straight line gives R² ${fmt(lin.r2, 4)}; a degree-${d} polynomial raises it to ${fmt(tinggi.r2, 4)}. Inside the data the two barely differ. A quarter of the data range beyond the largest x, at x = ${fmt(xLuar, 1)}, the straight line gives ${fmt(yLin, 2)} and the polynomial ${fmt(yPol, 2)}. The higher R² bought nothing that can be used outside the measurements.`
      : `A straight line gives R² ${fmt(lin.r2, 4)}; a degree-${d} polynomial raises it to ${fmt(tinggi.r2, 4)}, so these data really are curved and the line misses their shape. Even so, a quarter of the data range beyond the largest x, at x = ${fmt(xLuar, 1)}, the straight line gives ${fmt(yLin, 2)} and the polynomial ${fmt(yPol, 2)}: outside the measurements neither is a measurement.`;
  return mirip
    ? `Garis lurus memberi R² ${fmt(lin.r2, 4)}; polinomial derajat ${d} menaikkannya menjadi ${fmt(tinggi.r2, 4)}. Di dalam rentang data keduanya hampir tidak berbeda. Seperempat rentang di luar x terbesar, pada x = ${fmt(xLuar, 1)}, garis lurus memberi ${fmt(yLin, 2)} dan polinomial ${fmt(yPol, 2)}. R² yang lebih tinggi itu tidak membeli apa pun yang dapat dipakai di luar pengukuran.`
    : `Garis lurus memberi R² ${fmt(lin.r2, 4)}; polinomial derajat ${d} menaikkannya menjadi ${fmt(tinggi.r2, 4)}, jadi data ini memang melengkung dan garis lurus tidak mengikuti bentuknya. Meski begitu, seperempat rentang di luar x terbesar, pada x = ${fmt(xLuar, 1)}, garis lurus memberi ${fmt(yLin, 2)} dan polinomial ${fmt(yPol, 2)}: di luar pengukuran keduanya bukan hasil ukur.`;
}

