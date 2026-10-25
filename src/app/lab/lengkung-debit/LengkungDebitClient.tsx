"use client";

import { useEffect, useMemo, useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  Block,
  Flag,
  Hitungan,
  InputRow,
  InputTable,
  PresetRow,
  RegimeScale,
  ResultTable,
  Sheet,
  StateCard,
  Term,
  type LangkahHitung,
  type RegimeBand,
} from "@/components/ui";
import { DataEntry, ptsFromRows, rowsFromPts, type Row } from "@/components/DataEntry";
import { useCanvas } from "@/lib/useCanvas";
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import { fmt, fmtPlain } from "@/lib/hydraulics";
import {
  RATING_STORAGE_KEY,
  SAMPLE_RATING,
  fitRating,
  ratingFormula,
  ratingValue,
  type RatingKind,
} from "@/lib/discharge";
import { C, DASH, TONE, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksRating } from "@/lib/checksDischarge";

const TXT = {
  id: {
    title: "Lengkung debit",
    sheetTitle: "Lengkung debit dari pasangan tinggi muka air dan debit terukur",
    blkData: "data ukur",
    hH: "H, m",
    hQ: "Q, m³/s",
    bentuk: "bentuk lengkung",
    kPangkat: "Q = a·H^b",
    kPangkatH0: "Q = a·(H − H0)^b",
    kPoli: "polinomial",
    derajat: "derajat",
    dBaca: "Tinggi muka air yang dibaca",
    rN: "Pasangan yang dipakai",
    rBuang: "Pasangan yang dibuang (H atau Q tidak positif)",
    rA: "Koefisien a",
    rB: "Pangkat b",
    rH0: "Tinggi aliran nol",
    rR2: "Koefisien determinasi",
    rRmse: "Galat akar kuadrat rata-rata",
    rQ: "Debit pada H yang dibaca",
    rRentang: "Rentang H data ukur",
    kurang: "Data belum cukup untuk menyusun lengkung",
    kurangNote:
      "Bentuk pangkat butuh paling sedikit dua pasangan dengan H dan Q positif, bentuk dengan tinggi aliran nol tiga, dan polinomial satu lebih banyak daripada derajatnya. Tambah baris, unggah berkas, atau muat data contoh.",
    turun: "Lengkungnya turun di dalam rentang data",
    turunNote:
      "Pada sebagian rentang data ukur, lengkung ini memberi debit yang lebih KECIL ketika muka air NAIK. Itu tidak mungkin terjadi pada satu penampang kendali. Pada polinomial, sebabnya hampir selalu derajat yang terlalu tinggi untuk banyaknya data, sehingga kurvanya berkelok di antara titik-titik. Pada bentuk pangkat, sebabnya data itu sendiri: periksa apakah ada pasangan yang tertukar kolomnya. Turunkan derajatnya atau pakai bentuk pangkat.",
    luar: "Dibaca di luar rentang data ukur",
    luarNote:
      "Tinggi muka air yang dibaca berada di luar rentang pengukuran yang menyusun lengkung ini, jadi debitnya ekstrapolasi, bukan hasil ukur. Lengkung debit paling sering dipakai justru untuk banjir, yang jarang sempat diukur, dan di situ kesalahannya paling besar: penampang kendalinya bisa berubah, misalnya air mulai melimpas ke bantaran. ISO 18320 membatasi ekstrapolasi ke atas sampai sekitar dua puluh persen di atas pengukuran tertinggi, dan hanya bila bentuk penampangnya tidak berubah di rentang itu.",
    simpan: "pakai di HY-03",
    tersimpan: "tersimpan, HY-03 akan membandingkan debitnya",
    tersimpanLain: "lengkung tersimpan sebelumnya (bukan lengkung di layar) masih dipakai HY-03",
    note:
      "Lengkung debit mengubah pembacaan papan duga, yang murah dan dapat dicatat setiap jam, menjadi debit, yang mahal dan hanya diukur beberapa kali setahun. Karena itu seluruh catatan debit sebuah sungai sebenarnya adalah catatan tinggi muka air yang dilewatkan lengkung ini, dan setiap kesalahan pada lengkungnya ikut ke seluruh catatan itu. Tiga hal pantas dijaga. Pertama, bentuknya: debit di penampang kendali alami mengikuti hukum pangkat terhadap tinggi air DI ATAS titik aliran nol, bukan di atas nol papan duga, dan memaksa H0 = 0 pada data yang nol papannya tidak di dasar sungai membengkokkan kedua koefisiennya. Kedua, rentangnya: di luar data ukur lengkung ini tebakan, bukan pengukuran. Ketiga, waktunya: dasar sungai bergeser, rumput tumbuh, dan lengkung yang disusun tahun lalu bisa sudah tidak berlaku, sehingga pengukuran debit harus diulang secara berkala untuk memeriksanya.",
    blkSimpan: "hubungan ke HY-03",
    bNol: "Di bawah aliran nol",
    bBawah: "Di bawah data ukur",
    bDalam: "Di dalam data ukur",
    bTerbatas: "Ekstrapolasi terbatas",
    bJauh: "Di luar ekstrapolasi yang diizinkan",
    negatif: "Debit negatif, lengkung tidak berlaku",
    negatifNote:
      "Polinomial ini memberi debit di bawah nol pada H yang dibaca. Debit negatif tidak mungkin; di luar data ukur polinomial tidak terikat bentuk fisis apa pun. Baca di dalam rentang data, turunkan derajatnya, atau pakai bentuk pangkat.",
    dalamData: "di dalam rentang data",
    luarData: "di luar rentang data",
    hLs: "Kuadrat terkecil di ruang logaritma",
    hH0: "Tinggi aliran nol dicari dengan pencarian emas pada jumlah kuadrat galat ruang ln terkecil",
    hA: "Koefisien a dari rata-rata ruang logaritma",
    hPoli: "Koefisien polinomial dari kuadrat terkecil",
    hBaca: "Debit pada H yang dibaca",
    hR2: "Kecocokan terhadap data ukur",
    hRmse: "Galat akar kuadrat rata-rata",
    sxy: "x = ln(H − H0), y = ln Q",
  },
  en: {
    title: "Rating curve",
    sheetTitle: "Stage-discharge rating from measured pairs of water level and discharge",
    blkData: "measured data",
    hH: "H, m",
    hQ: "Q, m³/s",
    bentuk: "curve form",
    kPangkat: "Q = a·H^b",
    kPangkatH0: "Q = a·(H − H0)^b",
    kPoli: "polynomial",
    derajat: "degree",
    dBaca: "Water level to read",
    rN: "Pairs used",
    rBuang: "Pairs dropped (H or Q not positive)",
    rA: "Coefficient a",
    rB: "Exponent b",
    rH0: "Zero-flow stage",
    rR2: "Coefficient of determination",
    rRmse: "Root mean square error",
    rQ: "Discharge at the stage read",
    rRentang: "Measured stage range",
    kurang: "Not enough data to build a curve",
    kurangNote:
      "The power form needs at least two pairs with positive H and Q, the zero-flow form three, and a polynomial one more than its degree. Add rows, upload a file, or load the sample data.",
    turun: "The curve falls inside the data range",
    turunNote:
      "Over part of the measured range this curve gives a SMALLER discharge as the water level RISES. That cannot happen at a single control section. With a polynomial the cause is almost always a degree too high for the amount of data, so the curve wiggles between the points. With the power form the cause is the data itself: check whether any pair has its columns swapped. Lower the degree or use the power form.",
    luar: "Read outside the measured range",
    luarNote:
      "The water level being read lies outside the range of measurements that built this curve, so its discharge is an extrapolation, not a measurement. Rating curves are used most for floods, which are rarely measured, and that is exactly where they are most wrong: the control can change, for instance when water starts spilling onto the floodplain. ISO 18320 limits upward extrapolation to about twenty per cent above the highest measurement, and only if the section shape does not change over that range.",
    simpan: "use in HY-03",
    tersimpan: "saved, HY-03 will compare its discharge",
    tersimpanLain: "an earlier saved curve (not the one on screen) is still used by HY-03",
    note:
      "A rating curve turns gauge readings, which are cheap and can be logged every hour, into discharge, which is expensive and measured only a few times a year. The entire discharge record of a river is therefore really a record of water levels passed through this curve, and every error in the curve travels into the whole record. Three things deserve care. First, its form: discharge at a natural control follows a power law in the water depth ABOVE the zero-flow point, not above gauge zero, and forcing H0 = 0 on data whose gauge zero is not at the bed bends both coefficients. Second, its range: outside the measured data the curve is a guess, not a measurement. Third, its age: the bed shifts, weeds grow, and a curve built last year may no longer hold, so discharge measurements must be repeated periodically to check it.",
    blkSimpan: "link to HY-03",
    bNol: "Below zero flow",
    bBawah: "Below measured range",
    bDalam: "Within measured range",
    bTerbatas: "Limited extrapolation",
    bJauh: "Beyond permitted extrapolation",
    negatif: "Negative discharge, curve invalid",
    negatifNote:
      "This polynomial gives a discharge below zero at the stage read. A negative discharge is impossible; outside the measured data a polynomial is bound by no physical shape. Read within the data range, lower the degree, or use the power form.",
    dalamData: "within the data range",
    luarData: "outside the data range",
    hLs: "Least squares in log space",
    hH0: "Zero-flow stage found by golden-section search on the smallest log-space squared error",
    hA: "Coefficient a from the log-space means",
    hPoli: "Polynomial coefficients from least squares",
    hBaca: "Discharge at the stage read",
    hR2: "Fit to the measured data",
    hRmse: "Root mean square error",
    sxy: "x = ln(H − H0), y = ln Q",
  },
} as const;

const REFS = {
  id: [
    "ISO 18320:2020. Hydrometry — Measurement of liquid flow in open channels — Determination of the stage-discharge relationship.",
    "WMO (2010). Manual on Stream Gauging, jilid II: Computation of Discharge. WMO-No. 1044.",
    "Herschy, R.W. (2009). Streamflow Measurement, edisi ke-3. Taylor & Francis, bab 11.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill, pasal 6-2.",
  ],
  en: [
    "ISO 18320:2020. Hydrometry — Measurement of liquid flow in open channels — Determination of the stage-discharge relationship.",
    "WMO (2010). Manual on Stream Gauging, Volume II: Computation of Discharge. WMO-No. 1044.",
    "Herschy, R.W. (2009). Streamflow Measurement, 3rd edition. Taylor & Francis, Chapter 11.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill, Section 6-2.",
  ],
} as const;

const KINDS: RatingKind[] = ["pangkat", "pangkat-h0", "polinomial"];

export function LengkungDebitClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [rows, setRows] = useState<Row[]>(rowsFromPts(SAMPLE_RATING));
  const [kind, setKind] = useState<RatingKind>("pangkat");
  const [deg, setDeg] = useState(2);
  const [hBaca, setHBaca] = useState(1.2);
  /*
   * Isi lengkung yang tersimpan untuk HY-03, dibaca dari localStorage.
   * Indikatornya diturunkan dari isi itu, bukan dari riwayat tombol: sesudah
   * Reset lembar dipasang ulang, lengkung yang tersimpan tetap ada dan tetap
   * dipakai HY-03, jadi indikatornya tidak boleh padam begitu saja.
   */
  const [tersimpan, setTersimpan] = useState<string | null>(null);
  useEffect(() => {
    try {
      setTersimpan(localStorage.getItem(RATING_STORAGE_KEY));
    } catch {
      /* Penyimpanan peramban dapat ditolak */
    }
  }, []);

  const { pts } = ptsFromRows(rows);
  const kunciData = JSON.stringify(pts);
  const r = useMemo(() => fitRating(pts, kind, deg), [kunciData, kind, deg]); // eslint-disable-line react-hooks/exhaustive-deps
  const cek = useMemo(() => checksRating(pts, kind, deg), [kunciData, kind, deg]); // eslint-disable-line react-hooks/exhaustive-deps

  const hDataMax = pts.length ? Math.max(...pts.map((p) => p.x)) : 2;
  /* Dibulatkan ke atas ke sentimeter supaya ujung penggeser tidak jatuh
     di luar sumbu: 1,75 × 1,5 = 2,625 tertulis 2,63 pada penggeser */
  const hSliderMax = Math.ceil(Math.max(0.1, hDataMax * 1.5) * 100 - 1e-9) / 100;
  const luar = r !== null && (hBaca < r.hMin || hBaca > r.hMax);
  const qBaca = r ? ratingValue(r, hBaca) : 0;
  const angka = (v: number, d: number) => fmtPlain(v, d);
  /* Debit negatif (polinomial di luar data) tidak mungkin: ditulis "—" dan
     ditandai, bukan dicetak sebagai angka. */
  const qNeg = r !== null && qBaca < 0;
  const qTampil = (d: number) => (r && !qNeg ? fmt(qBaca, d) : "—");

  /* Zona H yang dibaca. Batas 1,2 hMax dari ISO 18320 seperti tertulis di
     luarNote (ekstrapolasi ke atas sampai sekitar dua puluh persen). */
  const hBatas = r ? 1.2 * r.hMax : 0;
  const zona: "bawah" | "dalam" | "terbatas" | "jauh" = !r
    ? "jauh"
    : hBaca < r.hMin
      ? "bawah"
      : hBaca <= r.hMax
        ? "dalam"
        : hBaca <= hBatas
          ? "terbatas"
          : "jauh";
  const nadaZona: Tone = qNeg
    ? "invalid"
    : zona === "dalam"
      ? "pass"
      : zona === "terbatas"
        ? "caution"
        : "invalid";
  const warnaQ = zona === "dalam" && !qNeg ? C.water : TONE[nadaZona].line;
  const skalaMax = Math.max(hSliderMax, hBatas);
  const pita: RegimeBand[] = [];
  if (r) {
    const h0 = kind === "pangkat-h0" ? Math.max(0, Math.min(r.h0, r.hMin)) : 0;
    if (h0 > 0) pita.push({ from: 0, to: h0, label: x.bNol, tone: "invalid" });
    if (r.hMin > h0) pita.push({ from: h0, to: r.hMin, label: x.bBawah, tone: "invalid" });
    pita.push({ from: r.hMin, to: r.hMax, label: x.bDalam, tone: "pass" });
    pita.push({ from: r.hMax, to: hBatas, label: x.bTerbatas, tone: "caution" });
    if (skalaMax > hBatas) pita.push({ from: hBatas, to: skalaMax, label: x.bJauh, tone: "invalid" });
  }

  const langkah: LangkahHitung[] = !r
    ? []
    : kind === "polinomial"
      ? [
          {
            judul: `${x.hPoli}, n = ${r.n}`,
            rumus: <span>Q = Σ cᵢ · Hⁱ</span>,
            isi: r.coeffs.map((c, i) => `c${i} = ${fmt(c, 6)}`).join(";  "),
            hasil: `${r.coeffs.length} ${lang === "id" ? "koefisien" : "coefficients"}`,
          },
          {
            judul: `${x.hBaca}, H = ${fmt(hBaca, 2)} m`,
            rumus: <span>Q(H) = Σ cᵢ · Hⁱ</span>,
            isi: r.coeffs.map((c, i) => `${fmt(c, 6)} · ${fmt(hBaca, 2)}^${i}`).join(" + "),
            hasil: qTampil(3),
            satuan: "m³/s",
            tint: warnaQ,
          },
        ]
      : [
          ...(kind === "pangkat-h0"
            ? [
                {
                  judul: x.hH0,
                  rumus: <span>H0 = arg min Σ( ln Q − ln Q̂ )²</span>,
                  isi: `${fmt(r.hMin - 2 * (r.hMax - r.hMin), 2)} ≤ H0 < ${fmt(r.hMin, 2)}`,
                  hasil: fmt(r.h0, 3),
                  satuan: "m",
                  tint: C.critical,
                },
              ]
            : []),
          {
            judul: `${x.hLs}, n = ${r.n}; ${x.sxy}`,
            rumus: (<><span>b =</span><Frac num="Sxy" den="Sxx" /></>),
            isi: `Σ( x − x̄ )( y − ȳ ) / Σ( x − x̄ )²`,
            hasil: fmt(r.b, 4),
            tint: C.water,
          },
          {
            judul: x.hA,
            rumus: <span>a = exp( ȳ − b · x̄ )</span>,
            isi: `exp( ȳ − ${fmt(r.b, 5)} · x̄ )`,
            hasil: fmt(r.a, 5),
          },
          {
            judul: `${x.hBaca}, H = ${fmt(hBaca, 2)} m`,
            rumus: <span>Q(H) = a · ( H − H0 )^b</span>,
            isi: `${fmt(r.a, 5)} · ( ${fmt(hBaca, 2)} − ${fmt(r.h0, 4)} )^${fmt(r.b, 5)}`,
            hasil: qTampil(3),
            satuan: "m³/s",
            tint: warnaQ,
          },
        ];
  if (r)
    langkah.push(
      {
        judul: x.hR2,
        rumus: (<><span>R² = 1 −</span><Frac num="Σ( Q − Q̂ )²" den="Σ( Q − Q̄ )²" /></>),
        isi: `n = ${r.n}`,
        hasil: fmt(r.r2, 5),
      },
      {
        judul: x.hRmse,
        rumus: <span>RMSE = √( Σ( Q − Q̂ )² / n )</span>,
        isi: `n = ${r.n}`,
        hasil: fmt(r.rmse, 4),
        satuan: "m³/s",
      }
    );

  const ref = useCanvas(
    (ctx, w, h) => {
      const semuaH = pts.map((p) => p.x);
      const semuaQ = pts.map((p) => p.y);
      const xMax = Math.max(hSliderMax, hBaca, ...semuaH, 0.1);
      const xMin = Math.min(0, ...semuaH);

      const deret: ChartSeries[] = [];
      let qAtas = Math.max(...semuaQ, 0.1);
      if (r) {
        const titik = (a: number, b: number) =>
          Array.from({ length: 121 }, (_, i) => {
            const hh = a + ((b - a) * i) / 120;
            return { x: hh, y: ratingValue(r, hh) };
          });
        const dalam = titik(r.hMin, r.hMax);
        const bawah = titik(Math.max(xMin, kind === "polinomial" ? xMin : r.h0), r.hMin);
        const atas = titik(r.hMax, xMax);
        qAtas = Math.max(qAtas, ...dalam.map((p) => p.y), ...atas.map((p) => p.y));
        deret.push(
          { pts: bawah, color: C.water, weight: W.thin, dash: DASH.hidden },
          { pts: atas, color: C.water, weight: W.thin, dash: DASH.hidden },
          {
            pts: dalam,
            color: r.nonMonotone ? C.signal : C.water,
            weight: W.bold,
            dash: r.nonMonotone ? DASH.invalid : DASH.solid,
            label: T.ratingCurve,
            labelAt: 0.55,
            labelDy: -12,
            labelAlign: "right",
          }
        );
      }
      const qMin = Math.min(0, ...semuaQ, ...(r ? [ratingValue(r, xMin)] : []));

      const pakai = (p: { x: number; y: number }) =>
        kind === "polinomial" || (p.x > 0 && p.y > 0);

      drawChart(
        ctx,
        w,
        h,
        {
          xMin,
          xMax,
          yMin: qMin,
          yMax: qAtas * 1.15,
          axisX: T.axStage,
          axisY: T.axDischargeQ,
          series: deret,
          markers: pts.map((p) => ({ x: p.x, y: p.y, color: C.ink, hollow: !pakai(p) })),
          bands: r
            ? [
                ...(r.hMin > xMin ? [{ axis: "x" as const, from: xMin, to: r.hMin }] : []),
                { axis: "x" as const, from: r.hMax, to: xMax, label: T.beyondData },
              ]
            : [],
          rules:
            r && kind === "pangkat-h0" && r.h0 > xMin && r.h0 < xMax
              ? [
                  {
                    axis: "x",
                    at: r.h0,
                    color: C.critical,
                    weight: W.hair,
                    dash: DASH.axis,
                    label: T.zeroFlowStage,
                    labelAlign: "left",
                  },
                ]
              : [],
          point: r
            ? {
                x: hBaca,
                y: qBaca,
                color: warnaQ,
                label: qNeg ? "Q < 0" : `${fmtPlain(qBaca, 2)} m³/s`,
                invalid: nadaZona === "invalid",
              }
            : undefined,
          heading: !r ? x.kurang : r.nonMonotone ? x.turun : undefined,
          headingColor: C.signal,
        },
        lang
      );
    },
    [kunciData, kind, deg, hBaca, lang]
  );

  const simpanKe = () => {
    if (!r) return;
    try {
      const isi = JSON.stringify(r);
      localStorage.setItem(RATING_STORAGE_KEY, isi);
      setTersimpan(isi);
    } catch {
      /* Penyimpanan peramban dapat ditolak; lembarnya tetap berjalan */
    }
  };

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="H"
          value={r ? hBaca : NaN}
          invalid={!r || nadaZona === "invalid"}
          pesan={!r ? x.kurang : qNeg ? x.negatif : undefined}
          digits={2}
          bands={r ? pita : [{ from: 0, to: skalaMax, label: x.kurang, tone: "invalid" }]}
        />
      }
      sheet="HY-04"
      subject={SUBJECTS.HY[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Debit sungai hampir tidak pernah diukur langsung setiap hari. Yang
            dicatat <Term tint={C.ink}>tinggi muka airnya</Term>, lalu diubah
            menjadi debit lewat <Term tint={C.water}>lengkung debit</Term> yang
            disusun dari beberapa pengukuran.
          </p>
        ) : (
          <p>
            River discharge is almost never measured directly every day. What is
            logged is the <Term tint={C.ink}>water level</Term>, which is turned
            into discharge through a <Term tint={C.water}>rating curve</Term>{" "}
            built from a handful of measurements.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HY-04"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "n", value: r ? String(r.n) : "—" },
            { label: "R²", value: r ? fmt(r.r2, 4) : "—", tint: C.water },
            { label: "RMSE", value: r ? `${fmt(r.rmse, 3)} m³/s` : "—" },
            {
              label: "Q(H)",
              value: r && !qNeg ? `${fmt(qBaca, 2)} m³/s` : "—",
              tint: warnaQ,
            },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={x.blkData}>
            <DataEntry
              rows={rows}
              onChange={setRows}
              headX={x.hH}
              headY={x.hQ}
              sample={SAMPLE_RATING}
            />
          </Block>

          <Block heading={t.blkInput}>
            <PresetRow
              label={x.bentuk}
              active={KINDS.indexOf(kind)}
              presets={[
                { label: x.kPangkat, apply: () => { setKind("pangkat"); } },
                { label: x.kPangkatH0, apply: () => { setKind("pangkat-h0"); } },
                { label: x.kPoli, apply: () => { setKind("polinomial"); } },
              ]}
            />
            {kind === "polinomial" && (
              <div className="mt-2.5">
                <PresetRow
                  label={x.derajat}
                  active={deg - 2}
                  presets={[2, 3, 4].map((d) => ({
                    label: String(d),
                    apply: () => { setDeg(d); },
                  }))}
                />
              </div>
            )}
            <div className="mt-3.5">
              <InputTable>
                <InputRow
                  symbol="H"
                  label={x.dBaca}
                  value={hBaca}
                  min={0}
                  max={Number(hSliderMax.toFixed(2))}
                  step={0.01}
                  digits={2}
                  unit="m"
                  onChange={setHBaca}
                />
              </InputTable>
            </div>
          </Block>

          <Block heading={t.blkResult}>
            {/* Rumus lengkung tetap ditulis; peringatannya pindah ke kartu
                keadaan di bawah. */}
            {r && (
              <div className="mb-2.5">
                <Flag tint={C.water}>{ratingFormula(r, angka)}</Flag>
              </div>
            )}
            {r && (
              <ResultTable
                rows={[
                  { symbol: "Q", label: x.rQ, value: qTampil(3), unit: "m³/s", tint: warnaQ, strong: true },
                  ...(kind === "polinomial"
                    ? r.coeffs.map((c, i) => ({ symbol: `c${i}`, label: `H^${i}`, value: fmt(c, 5) }))
                    : [
                        { symbol: "a", label: x.rA, value: fmt(r.a, 5) },
                        { symbol: "b", label: x.rB, value: fmt(r.b, 4), tint: C.water },
                        ...(kind === "pangkat-h0"
                          ? [{ symbol: "H0", label: x.rH0, value: fmt(r.h0, 3), unit: "m", tint: C.critical }]
                          : []),
                      ]),
                  { symbol: "R²", label: x.rR2, value: fmt(r.r2, 5), strong: true },
                  { symbol: "RMSE", label: x.rRmse, value: fmt(r.rmse, 4), unit: "m³/s" },
                  { symbol: "n", label: x.rN, value: String(r.n) },
                  ...(r.dropped > 0 ? [{ symbol: "—", label: x.rBuang, value: String(r.dropped) }] : []),
                  { symbol: "H", label: x.rRentang, value: `${fmt(r.hMin, 2)} – ${fmt(r.hMax, 2)}`, unit: "m" },
                ]}
              />
            )}
            {r && (
              <div className="mt-3">
                <Hitungan langkah={langkah} />
              </div>
            )}
          </Block>

          <Block heading={x.blkSimpan}>
            <div className="flex flex-wrap items-baseline gap-3">
              <button
                type="button"
                disabled={!r}
                onClick={simpanKe}
                className="label border-b border-rule-strong pb-px text-[0.8rem] text-ink-2 hover:border-ink hover:text-ink disabled:opacity-40"
              >
                {x.simpan}
              </button>
              {tersimpan !== null && (
                <span className="label text-[0.78rem] text-ink-3">
                  {r && tersimpan === JSON.stringify(r) ? x.tersimpan : x.tersimpanLain}
                </span>
              )}
            </div>
          </Block>

          {!r ? (
            <StateCard tone="invalid" badge={x.kurang} state={x.kurangNote} />
          ) : (
            <StateCard
              tone={r.nonMonotone ? "invalid" : nadaZona}
              badge={
                qNeg
                  ? x.negatif
                  : zona === "dalam"
                    ? x.bDalam
                    : zona === "terbatas"
                      ? x.bTerbatas
                      : zona === "bawah"
                        ? x.bBawah
                        : x.bJauh
              }
              state={
                lang === "id"
                  ? `Q(${fmt(hBaca, 2)}) = ${qTampil(3)} m³/s, ${luar ? x.luarData : x.dalamData} ${fmt(r.hMin, 2)}–${fmt(r.hMax, 2)} m.`
                  : `Q(${fmt(hBaca, 2)}) = ${qTampil(3)} m³/s, ${luar ? x.luarData : x.dalamData} ${fmt(r.hMin, 2)}–${fmt(r.hMax, 2)} m.`
              }
              notice={[
                qNeg ? x.negatifNote : null,
                r.nonMonotone ? x.turunNote : null,
                luar ? x.luarNote : null,
                notice(pts, lang),
              ]}
            />
          )}
        </>
      }
      verification={<Verification checks={cek} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Q = a · (H − H0)^b</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id" ? "H0 = 0 pada bentuk pangkat biasa" : "H0 = 0 in the plain power form"}
                </span>
              </Eq>
              <Eq>
                <span>ln Q = ln a + b · ln(H − H0)</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id" ? "kuadrat terkecil di ruang logaritma" : "least squares in log space"}
                </span>
              </Eq>
              <Eq>
                <span>R² = 1 − Σ(Q − Q̂)² / Σ(Q − Q̄)²</span>
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

function notice(pts: { x: number; y: number }[], lang: Lang): string {
  const biasa = fitRating(pts, "pangkat");
  const nol = fitRating(pts, "pangkat-h0");
  if (!biasa || !nol) {
    return lang === "id"
      ? "Begitu ada paling sedikit tiga pasangan data, lembar ini membandingkan kedua bentuk pangkat di sini."
      : "Once there are at least three data pairs, this sheet compares both power forms here.";
  }
  const hBanjir = biasa.hMax * 1.5;
  const qBiasa = ratingValue(biasa, hBanjir);
  const qNol = ratingValue(nol, hBanjir);
  const beda = qBiasa > 0 ? ((qNol - qBiasa) / qBiasa) * 100 : 0;
  /* "Hampir sama baiknya" hanya ditulis bila selisih R² memang kecil;
     pada data yang nol papannya jauh dari dasar, bentuk biasa bisa jauh
     lebih buruk (R² 0,60 lawan 1,00). */
  const mirip = Math.abs(nol.r2 - biasa.r2) < 0.01;
  if (lang === "en")
    return mirip
      ? `Within the measured range both power forms fit almost equally well: R² ${fmt(biasa.r2, 4)} without H0 and ${fmt(nol.r2, 4)} with H0 = ${fmt(nol.h0, 3)} m. The difference shows only outside the data. At a flood level of ${fmt(hBanjir, 2)} m, half again above the highest measurement, the plain form gives ${fmt(qBiasa, 2)} m³/s and the zero-flow form ${fmt(qNol, 2)} m³/s, a difference of ${fmt(beda, 0)} per cent. Two curves that agree on every measured point can disagree on the one flood that matters.`
      : `The two power forms fit these data differently: R² ${fmt(biasa.r2, 4)} without H0 and ${fmt(nol.r2, 4)} with H0 = ${fmt(nol.h0, 3)} m. The ${nol.r2 > biasa.r2 ? "zero-flow form" : "plain form"} follows the measurements better. At a flood level of ${fmt(hBanjir, 2)} m the plain form gives ${fmt(qBiasa, 2)} m³/s and the zero-flow form ${fmt(qNol, 2)} m³/s, a difference of ${fmt(beda, 0)} per cent.`;
  return mirip
    ? `Di dalam rentang data ukur kedua bentuk pangkat cocok hampir sama baiknya: R² ${fmt(biasa.r2, 4)} tanpa H0 dan ${fmt(nol.r2, 4)} dengan H0 = ${fmt(nol.h0, 3)} m. Bedanya baru terlihat di luar data. Pada muka air banjir ${fmt(hBanjir, 2)} m, setengah kali di atas pengukuran tertinggi, bentuk biasa memberi ${fmt(qBiasa, 2)} m³/s dan bentuk dengan tinggi aliran nol ${fmt(qNol, 2)} m³/s, selisih ${fmt(beda, 0)} persen. Dua lengkung yang sama-sama tepat di setiap titik ukur dapat berselisih jauh pada satu banjir yang justru penting.`
    : `Kedua bentuk pangkat tidak sama cocoknya pada data ini: R² ${fmt(biasa.r2, 4)} tanpa H0 dan ${fmt(nol.r2, 4)} dengan H0 = ${fmt(nol.h0, 3)} m. Bentuk ${nol.r2 > biasa.r2 ? "dengan tinggi aliran nol" : "biasa"} lebih mengikuti pengukurannya. Pada muka air banjir ${fmt(hBanjir, 2)} m bentuk biasa memberi ${fmt(qBiasa, 2)} m³/s dan bentuk dengan tinggi aliran nol ${fmt(qNol, 2)} m³/s, selisih ${fmt(beda, 0)} persen.`;
}

