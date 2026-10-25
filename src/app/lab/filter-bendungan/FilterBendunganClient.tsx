"use client";

import { useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  Block,
  Hitungan,
  InputRow,
  InputTable,
  PresetRow,
  RegimeScale,
  ResultTable,
  Sheet,
  StateCard,
  Term,
  type RegimeBand,
} from "@/components/ui";
import { useCanvas } from "@/lib/useCanvas";
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import {
  FILTER_CU_MAX,
  FILTER_D50_RATIO_MAX,
  FILTER_DRAIN,
  FILTER_RETAIN,
  filterDesign,
  fmt,
  fmtPlain,
  fmtSci,
  passingAt,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksFilter } from "@/lib/checks";

const D_MIN = 0.002;
const D_MAX = 200;
/* Titik normal baku yang dipakai gradation() untuk 10, 15, 60 persen,
   ditulis di sini hanya untuk substitusi langkah hitungan. */
const Z15 = -1.0364333894937898;
const Z60_10 = 0.2533471031357997 - -1.2815515655446004;

const TXT = {
  id: {
    title: "Filter bendungan",
    sheetTitle: "Gradasi filter terhadap tanah yang dilindunginya — kriteria Terzaghi",
    dBaseD50: "Diameter median tanah",
    dBaseCu: "Keseragaman tanah",
    dFilterD50: "Diameter median filter",
    dFilterCu: "Keseragaman filter",
    pPas: "Filter yang memenuhi",
    pKasar: "Filter terlalu kasar",
    pSeragam: "Tanah seragam, jendela sempit",
    rWindow: "Lebar jendela D15 filter",
    rD15Min: "Batas bawah D15 filter",
    rD15Max: "Batas atas D15 filter",
    rD15: "D15 filter yang dipilih",
    rKBase: "Permeabilitas tanah",
    rKFilter: "Permeabilitas filter",
    rKRatio: "Perbandingan permeabilitasnya",
    rD85: "D85 tanah",
    rD15b: "D15 tanah",
    lulus: "Filter memenuhi keempat syaratnya",
    gagalTahan: "Filter terlalu kasar, butiran tanah akan terbawa",
    gagalAlir: "Filter terlalu halus, ia menjadi bendungan kedua",
    gagalSeragam: "Filter terlalu seragam, ia akan terpisah saat ditimbun",
    gagalD50: "Filter terlalu jauh lebih kasar daripada tanahnya",
    bHalus: "Terlalu halus, tidak mengalirkan",
    bJendela: "Jendela filter",
    bKasar: "Terlalu kasar, tidak menahan",
    jendela: "jendela",
    maks: "maks",
    rRatioTahan: "D15 filter terhadap D85 tanah (≤ 4)",
    rRatioAlir: "D15 filter terhadap D15 tanah (≥ 4)",
    hGradasi: "Gradasi log-normal dari D50 dan Cu",
    hJendelaBatas: "Batas D15 filter, Terzaghi",
    hJendela: "Lebar jendela",
    hSyarat: "Keseragaman filter dan perbandingan D50",
    hK: "Permeabilitas Hazen, D10 dalam mm",
    syaratJujur:
      "Dua syarat terakhir (Cuf ≤ 20 dan D50f ≤ 25 D50b) diambil dari pedoman USBR lama dan belum diperiksa ke halaman sumbernya. Pedoman filter yang lebih baru juga membatasi butir halus filter dan memakai kriteria lain untuk tanah dasar berbutir lanau atau lempung; batas itu belum dipasang di lembar ini, jadi “memenuhi” di sini berarti memenuhi keempat syarat lembar ini.",
    halusDasar:
      "D85 tanah dasar di bawah 0,075 mm: tanahnya lanau atau lempung. Kriteria Terzaghi diturunkan untuk pasir, dan untuk tanah sehalus ini pedoman filter memakai kriteria kelompok tanah lain (Sherard dan Dunnigan 1989) yang belum dipasang di lembar ini.",
    hazenLuar:
      "D10 di luar 0,1–3 mm pada salah satu gradasinya, rentang yang lazim untuk rumus Hazen. Permeabilitas dan perbandingan kf/kb di sini hanya taksiran kasar.",
    tahanNote:
      "D15 filter melampaui empat kali D85 tanah, jadi pori filternya lebih besar daripada butiran tanah yang harus ditahannya. Yang terjadi sesudah itu bukan kebocoran yang bertambah perlahan melainkan erosi buluh: butiran halus terbawa masuk ke pori filter, lubang yang ditinggalkannya memperbesar kecepatan setempat, butiran berikutnya terbawa lebih mudah, dan saluran terbuka menembus tubuh bendungan dari hilir ke hulu. Erosi buluh adalah sebab kegagalan bendungan urugan yang paling sering, dan hampir seluruhnya berlangsung tanpa terlihat sampai tahap terakhirnya.",
    alirNote:
      "D15 filter kurang dari empat kali D15 tanah, jadi filternya tidak cukup lebih lolos daripada tanah yang dilindunginya. Filter yang tidak mengalirkan bukan filter melainkan lapisan kedap kedua: air yang sampai ke situ tertahan, tekanan air pori di belakangnya naik, dan tekanan air pori yang naik adalah persis keadaan yang ingin dihindari dengan memasang filter.",
    note:
      "Kedua syarat Terzaghi menarik ke arah yang berlawanan, dan itulah yang membuat perancangan filter menjadi soal dan bukan sekadar pilihan. Filter harus cukup halus untuk menahan butiran tanah, dan cukup kasar untuk mengalirkan air lebih lancar daripada tanahnya. Bagi kedua syarat itu satu sama lain dan angka empatnya saling menghapus: lebar jendela yang tersedia persis sama dengan D85 tanah dibagi D15 tanah, yaitu rentang gradasi tanah yang dilindungi itu sendiri. Kesimpulan itu tidak terbaca dari kedua syaratnya bila dibaca satu per satu, dan akibatnya langsung di lapangan. Tanah yang bergradasi lebar memberi pilihan filter yang longgar. Tanah yang seragam, misalnya pasir dune atau lanau hasil endapan, hampir tidak memberi pilihan sama sekali, dan di situ filter satu lapis sering tidak cukup sehingga harus dipakai filter bertingkat dua atau tiga. Akibat kedua, dari syarat alirannya saja: karena permeabilitas kira-kira sebanding dengan kuadrat diameter butiran, filter yang memenuhi syarat aliran sekurangnya enam belas kali lebih lolos daripada tanahnya bila keseragaman filter dan tanahnya sama; filter yang jauh lebih bergradasi dapat lebih rendah, karena D10-nya turun lebih jauh dari D15-nya. Filter bukan lapisan yang sedikit lebih kasar; ia biasanya lapisan yang alirannya satu tingkat besaran berbeda.",
  },
  en: {
    title: "Dam filter",
    sheetTitle: "Filter gradation against the soil it protects — the Terzaghi criteria",
    dBaseD50: "Median grain size of the soil",
    dBaseCu: "Soil uniformity",
    dFilterD50: "Median grain size of the filter",
    dFilterCu: "Filter uniformity",
    pPas: "A filter that passes",
    pKasar: "Too coarse a filter",
    pSeragam: "Uniform soil, a narrow window",
    rWindow: "Width of the filter D15 window",
    rD15Min: "Lower limit on filter D15",
    rD15Max: "Upper limit on filter D15",
    rD15: "Filter D15 chosen",
    rKBase: "Soil permeability",
    rKFilter: "Filter permeability",
    rKRatio: "Ratio of the two",
    rD85: "Soil D85",
    rD15b: "Soil D15",
    lulus: "The filter meets all four criteria",
    gagalTahan: "Too coarse, soil particles will wash through",
    gagalAlir: "Too fine, it becomes a second dam",
    gagalSeragam: "Too uniform, it will segregate when placed",
    gagalD50: "Far too much coarser than the soil",
    bHalus: "Too fine, does not drain",
    bJendela: "Filter window",
    bKasar: "Too coarse, does not retain",
    jendela: "window",
    maks: "max",
    rRatioTahan: "Filter D15 over soil D85 (≤ 4)",
    rRatioAlir: "Filter D15 over soil D15 (≥ 4)",
    hGradasi: "Log-normal gradation from D50 and Cu",
    hJendelaBatas: "Limits on filter D15, Terzaghi",
    hJendela: "Window width",
    hSyarat: "Filter uniformity and D50 ratio",
    hK: "Hazen permeability, D10 in mm",
    syaratJujur:
      "The last two criteria (Cuf ≤ 20 and D50f ≤ 25 D50b) come from older USBR guidance and have not been checked against the source pages. Newer filter guidance also limits the fines in the filter and uses other criteria for silty or clayey base soils; those limits are not on this sheet yet, so “meets” here means meets this sheet's four criteria.",
    halusDasar:
      "The base soil D85 is below 0.075 mm: the soil is silt or clay. The Terzaghi criteria were derived for sands, and for soil this fine filter guidance uses criteria for other soil groups (Sherard and Dunnigan 1989) that are not on this sheet yet.",
    hazenLuar:
      "D10 lies outside 0.1–3 mm on one of the gradations, the usual range for Hazen's formula. The permeabilities and the kf/kb ratio here are rough estimates only.",
    tahanNote:
      "The filter D15 exceeds four times the soil D85, so the filter pores are larger than the soil particles they must hold. What follows is not a leak that grows slowly but piping: fine particles wash into the filter pores, the holes they leave raise the local velocity, the next particles go more easily, and a channel opens through the dam body from downstream to upstream. Piping is the commonest cause of embankment dam failure, and almost all of it happens unseen until the final stage.",
    alirNote:
      "The filter D15 is under four times the soil D15, so the filter is not sufficiently more permeable than the soil it protects. A filter that does not drain is not a filter but a second impervious layer: water reaching it is held back, pore pressure behind it rises, and rising pore pressure is exactly the condition the filter was installed to prevent.",
    note:
      "The two Terzaghi criteria pull in opposite directions, and that is what makes filter design a problem rather than a choice. The filter must be fine enough to hold soil particles and coarse enough to drain more freely than the soil. Divide one criterion by the other and the fours cancel: the width of the available window is exactly the soil D85 over the soil D15, which is the grading span of the protected soil itself. That conclusion cannot be read from either criterion alone, and its field consequence is immediate. A widely graded soil gives a generous choice of filter. A uniform soil, dune sand or a deposited silt, gives almost no choice at all, and there a single filter layer is often not enough so a two or three stage filter must be used. A second consequence, from the drainage criterion alone: since permeability scales roughly with the square of grain size, a filter satisfying the drainage criterion is at least sixteen times more permeable than the soil when filter and soil share the same uniformity; a much more widely graded filter can fall below that, because its D10 drops further below its D15. A filter is not a slightly coarser layer; it is usually a layer whose flow is an order of magnitude apart.",
  },
} as const;

const REFS = {
  id: [
    "Terzaghi, K. (1922). Der Grundbruch an Stauwerken und seine Verhütung. Die Wasserkraft 17.",
    "Bertram, G.E. (1940). An experimental investigation of protective filters. Harvard Soil Mechanics Series 7.",
    "Sherard, J.L. & Dunnigan, L.P. (1989). Critical filters for impervious soils. J. Geotech. Eng. 115(7).",
    "USBR (2011). Design Standards No. 13: Embankment Dams, bab 5: Protective Filters.",
    "Hazen, A. (1892). Some physical properties of sands and gravels. Massachusetts State Board of Health.",
  ],
  en: [
    "Terzaghi, K. (1922). Der Grundbruch an Stauwerken und seine Verhütung. Die Wasserkraft 17.",
    "Bertram, G.E. (1940). An experimental investigation of protective filters. Harvard Soil Mechanics Series 7.",
    "Sherard, J.L. & Dunnigan, L.P. (1989). Critical filters for impervious soils. J. Geotech. Eng. 115(7).",
    "USBR (2011). Design Standards No. 13: Embankment Dams, ch. 5: Protective Filters.",
    "Hazen, A. (1892). Some physical properties of sands and gravels. Massachusetts State Board of Health.",
  ],
} as const;

export function FilterBendunganClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [bD50, setBD50] = useState(0.2);
  const [bCu, setBCu] = useState(6);
  const [fD50, setFD50] = useState(3);
  const [fCu, setFCu] = useState(6);

  const r = filterDesign(bD50, bCu, fD50, fCu);
  /* Perbandingan yang dibaca langsung terhadap kedua syarat Terzaghi. */
  const rasioTahan = r.filter.d15 / r.base.d85;
  const rasioAlir = r.filter.d15 / r.base.d15;
  /* Pita skala dari batas filterDesign, dipotong ke sumbu diagram. */
  const jepit = (v: number) => Math.min(D_MAX, Math.max(D_MIN, v));
  const pita: RegimeBand[] = (
    [
      { from: D_MIN, to: jepit(r.d15Min), label: x.bHalus, tone: "caution" },
      { from: jepit(r.d15Min), to: jepit(r.d15Max), label: x.bJendela, tone: "pass" },
      { from: jepit(r.d15Max), to: D_MAX, label: x.bKasar, tone: "caution" },
    ] as RegimeBand[]
  ).filter((b) => b.to - b.from > 1e-12);
  const letak = !r.drains ? x.bHalus : !r.retains ? x.bKasar : x.bJendela;

  const ref = useCanvas(
    (ctx, w, ch) => {
      const kurva = (g: typeof r.base): { x: number; y: number }[] => {
        const pts: { x: number; y: number }[] = [];
        for (let lg = Math.log10(D_MIN); lg <= Math.log10(D_MAX) + 1e-9; lg += 0.02) {
          const d = Math.pow(10, lg);
          pts.push({ x: d, y: passingAt(g, d) });
        }
        return pts;
      };

      const deret: ChartSeries[] = [
        {
          pts: kurva(r.base),
          color: C.ink,
          weight: W.bold,
          label: T.baseSoil,
          labelAt: 0.5,
          labelDy: -12,
        },
        {
          /* Filter yang gagal syarat adalah kegagalan rancangan, bukan
             keadaan di luar rentang berlaku: kurvanya tetap air, tidak
             merah sinyal. Penilaiannya di skala dan kartu keadaan. */
          pts: kurva(r.filter),
          color: C.water,
          weight: W.bold,
          dash: DASH.solid,
          label: T.filterSoil,
          labelAt: 0.5,
          labelDy: 18,
        },
      ];

      drawChart(
        ctx,
        w,
        ch,
        {
          xMin: D_MIN,
          xMax: D_MAX,
          yMin: 0,
          yMax: 100,
          xLog: true,
          axisX: T.axGrainLog,
          axisY: T.axPassing,
          series: deret,
          bands: [{ axis: "x", from: r.d15Min, to: r.d15Max, label: T.filterWindow }],
          rules: [
            {
              axis: "x",
              at: r.d15Min,
              color: C.critical,
              dash: DASH.axis,
              label: `${T.drainLimit} ${fmtPlain(r.d15Min, 3)}`,
              labelAlign: "right",
            },
            {
              axis: "x",
              at: r.d15Max,
              color: C.critical,
              dash: DASH.axis,
              label: `${T.retainLimit} ${fmtPlain(r.d15Max, 3)}`,
              labelAlign: "left",
            },
            { axis: "y", at: 15, color: C.ink3, dash: DASH.hidden, label: "15 %" },
          ],
          point: {
            x: r.filter.d15,
            y: 15,
            label: `D15 ${fmtPlain(r.filter.d15, 3)} mm`,
            invalid: false,
          },
          heading: r.retains
            ? r.drains
              ? undefined
              : x.gagalAlir
            : x.gagalTahan,
          headingColor: C.caution,
          padRight: 52,
        },
        lang
      );
    },
    [bD50, bCu, fD50, fCu, lang]
  );

  const pesan = !r.retains
    ? x.gagalTahan
    : !r.drains
      ? x.gagalAlir
      : !r.uniform
        ? x.gagalSeragam
        : !r.d50Ratio
          ? x.gagalD50
          : x.lulus;

  return (
    <LabShell
      status={
        /* Batas dari filterDesign: drains D15f ≥ 4 D15b, retains D15f ≤
           4 D85b (Terzaghi 1922, Bertram 1940). Lebar pita tengah = jendela,
           1,28 sampai 98,8 di rentang penggeser, tidak pernah nol. */
        <RegimeScale symbol="D15f" value={r.filter.d15} scale="log" digits={3} bands={pita} />
      }
      sheet="DM-02"
      subject={SUBJECTS.DM[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Lebar jendela filter yang tersedia{" "}
            <Term tint={C.critical}>persis sama</Term> dengan rentang gradasi
            tanah yang dilindunginya. Tanah yang seragam{" "}
            <Term tint={C.critical}>hampir tidak memberi pilihan</Term>.
          </p>
        ) : (
          <p>
            The width of the available filter window is{" "}
            <Term tint={C.critical}>exactly</Term> the grading span of the soil
            it protects. A uniform soil{" "}
            <Term tint={C.critical}>gives almost no choice</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="DM-02"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (mm, m/s)" },
            { label: "D15f", value: `${fmt(r.filter.d15, 3)} mm`, tint: C.water },
            { label: "D85b", value: `${fmt(r.base.d85, 3)} mm` },
            { label: "kf/kb", value: fmt(r.kRatio, 0), tint: C.critical },
            { label: x.jendela, value: fmt(r.window, 2) },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="D50b" label={x.dBaseD50} value={bD50} min={0.01} max={5} step={0.01} digits={2} unit="mm" onChange={setBD50} />
              <InputRow symbol="Cub" label={x.dBaseCu} value={bCu} min={1.2} max={30} step={0.2} digits={1} onChange={setBCu} tint={C.critical} />
              <InputRow symbol="D50f" label={x.dFilterD50} value={fD50} min={0.05} max={80} step={0.05} digits={2} unit="mm" onChange={setFD50} tint={C.water} />
              <InputRow symbol="Cuf" label={x.dFilterCu} value={fCu} min={1.2} max={30} step={0.2} digits={1} onChange={setFCu} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pPas, apply: () => { setBD50(0.2); setBCu(6); setFD50(3); setFCu(6); } },
                  { label: x.pKasar, apply: () => { setBD50(0.2); setBCu(6); setFD50(30); setFCu(6); } },
                  { label: x.pSeragam, apply: () => { setBD50(0.15); setBCu(1.4); setFD50(1.2); setFCu(6); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "D15f/D85b", label: x.rRatioTahan, value: fmt(rasioTahan, 3), tint: r.retains ? C.pass : C.caution, strong: true },
                { symbol: "D15f/D15b", label: x.rRatioAlir, value: fmt(rasioAlir, 2), tint: r.drains ? C.pass : C.caution, strong: true },
                { symbol: "n", label: x.rWindow, value: fmt(r.window, 3), tint: C.critical, strong: true },
                { symbol: "D15f", label: x.rD15, value: fmt(r.filter.d15, 4), unit: "mm", tint: C.water },
                { symbol: "min", label: x.rD15Min, value: fmt(r.d15Min, 4), unit: "mm", tint: r.drains ? undefined : C.caution },
                { symbol: x.maks, label: x.rD15Max, value: fmt(r.d15Max, 4), unit: "mm", tint: r.retains ? undefined : C.caution },
                { symbol: "D15b", label: x.rD15b, value: fmt(r.base.d15, 4), unit: "mm" },
                { symbol: "D85b", label: x.rD85, value: fmt(r.base.d85, 4), unit: "mm" },
                { symbol: "kb", label: x.rKBase, value: fmtSci(r.base.k), unit: "m/s" },
                { symbol: "kf", label: x.rKFilter, value: fmtSci(r.filter.k), unit: "m/s" },
                { symbol: "kf/kb", label: x.rKRatio, value: fmt(r.kRatio, 1) },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hGradasi,
                    rumus: (<><span>σ =</span><Frac num="ln Cu" den="z60 − z10" /><span>; Dp = D50 · e^(zp σ)</span></>),
                    isi: `σb = ln ${fmt(bCu, 1)} / ${fmt(Z60_10, 4)} = ${fmt(r.base.sigma, 4)} ; D15b = ${fmt(r.base.d15, 4)} ; D85b = ${fmt(r.base.d85, 4)} ; σf = ${fmt(r.filter.sigma, 4)} ; D15f = ${fmt(fD50, 2)} · e^(${fmt(Z15, 4)} · ${fmt(r.filter.sigma, 4)})`,
                    hasil: fmt(r.filter.d15, 4),
                    satuan: "mm",
                    tint: C.water,
                  },
                  {
                    judul: x.hJendelaBatas,
                    rumus: <span>{fmtPlain(FILTER_DRAIN, 0)} · D15b ≤ D15f ≤ {fmtPlain(FILTER_RETAIN, 0)} · D85b</span>,
                    isi: `${fmt(r.d15Min, 4)} ${r.drains ? "≤" : ">"} ${fmt(r.filter.d15, 4)} ${r.retains ? "≤" : ">"} ${fmt(r.d15Max, 4)} ; D15f/D85b = ${fmt(rasioTahan, 3)} ; D15f/D15b = ${fmt(rasioAlir, 2)}`,
                    hasil: letak,
                  },
                  {
                    judul: x.hJendela,
                    rumus: (<><span>n =</span><Frac num="D85b" den="D15b" /></>),
                    isi: `${fmt(r.base.d85, 4)} / ${fmt(r.base.d15, 4)}`,
                    hasil: fmt(r.window, 3),
                    tint: C.critical,
                  },
                  {
                    judul: x.hSyarat,
                    rumus: <span>Cuf ≤ {fmtPlain(FILTER_CU_MAX, 0)} ; D50f ≤ {fmtPlain(FILTER_D50_RATIO_MAX, 0)} · D50b</span>,
                    isi: `${fmt(fCu, 1)} ${r.uniform ? "≤" : ">"} ${fmtPlain(FILTER_CU_MAX, 0)} ; ${fmt(fD50, 2)} ${r.d50Ratio ? "≤" : ">"} ${fmtPlain(FILTER_D50_RATIO_MAX, 0)} · ${fmt(bD50, 2)} = ${fmt(FILTER_D50_RATIO_MAX * bD50, 2)}`,
                    hasil: pesan,
                  },
                  {
                    judul: x.hK,
                    rumus: (<><span>k =</span><Frac num="100 · (D10/10)²" den="100" /><span>; kf/kb</span></>),
                    isi: `kb = ${fmtSci(r.base.k)} (D10 ${fmt(r.base.d10, 4)}) ; kf = ${fmtSci(r.filter.k)} (D10 ${fmt(r.filter.d10, 4)}) ; ${fmtSci(r.filter.k)} / ${fmtSci(r.base.k)}`,
                    hasil: fmt(r.kRatio, 1),
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={r.passes ? "pass" : "caution"}
            badge={pesan}
            {...notice(bD50, bCu, fD50, fCu, letak, pesan, x, lang)}
          />
        </>
      }
      verification={<Verification checks={checksFilter(bD50, bCu, fD50, fCu)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>{fmtPlain(FILTER_DRAIN, 0)} D15b ≤ D15f ≤ {fmtPlain(FILTER_RETAIN, 0)} D85b</span>
                <span className="ml-5">
                  {lang === "id" ? "lebar jendela" : "window width"} =
                </span>
                <Frac num="D85b" den="D15b" />
              </Eq>
              <Eq>
                <span>Cuf ≤ {fmtPlain(FILTER_CU_MAX, 0)}</span>
                <span className="ml-5">D50f ≤ {fmtPlain(FILTER_D50_RATIO_MAX, 0)} D50b</span>
                <span className="ml-5">k ≈ 100 D10²</span>
                <span className="ml-3 text-ink-3">
                  {lang === "id" ? "Hazen, D10 dalam cm" : "Hazen, D10 in cm"}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "gradasi disusun log-normal dari diameter median dan keseragamannya, jadi tiap titik kurvanya terhitung dan bukan digambar tangan"
                    : "the gradation is built log normal from the median size and the uniformity, so every point on the curve is computed rather than drawn by hand"}
                </span>
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

/*
 * Kalimat keadaan, lalu butir: catatan gagal syarat bila ada; (a) lebar
 * jendela = D85b/D15b; (b) Cub 1,4 vs 20; (c) kf/kb tanpa klaim "selalu
 * enam belas kali"; (d) catatan kejujuran rentang berlaku.
 */
function notice(
  bD50: number,
  bCu: number,
  fD50: number,
  fCu: number,
  letak: string,
  pesan: string,
  x: { tahanNote: string; alirNote: string; syaratJujur: string; halusDasar: string; hazenLuar: string },
  lang: Lang
): { state: string; notice: string[] } {
  const en = lang === "en";
  const r = filterDesign(bD50, bCu, fD50, fCu);
  const seragam = filterDesign(bD50, 1.4, fD50, fCu);
  const lebar = filterDesign(bD50, 20, fD50, fCu);

  const state = en
    ? `D15f = ${fmt(r.filter.d15, 3)} mm: ${letak.toLowerCase()}; ${r.passes ? "all four criteria are met" : pesan.toLowerCase()}.`
    : `D15f = ${fmt(r.filter.d15, 3)} mm: ${letak.toLowerCase()}; ${r.passes ? "keempat syarat terpenuhi" : pesan.toLowerCase()}.`;

  const butir: string[] = [];
  if (!r.retains) butir.push(x.tahanNote);
  else if (!r.drains) butir.push(x.alirNote);

  butir.push(
    en
      ? `The window for the filter D15 runs from ${fmt(r.d15Min, 3)} to ${fmt(r.d15Max, 3)} mm, a factor of ${fmt(r.window, 2)}, and that factor is exactly the soil D85 over the soil D15.`
      : `Jendela untuk D15 filter terbentang dari ${fmt(r.d15Min, 3)} sampai ${fmt(r.d15Max, 3)} mm, yaitu ${fmt(r.window, 2)} kali lipat, dan angka itu persis D85 tanah dibagi D15 tanah.`,
    en
      ? `Set the soil uniformity to 1.4 and the window shrinks to a factor of ${fmt(seragam.window, 2)}; set it to 20 and it opens to ${fmt(lebar.window, 1)}.`
      : `Setel keseragaman tanahnya ke 1,4 dan jendelanya menyempit menjadi ${fmt(seragam.window, 2)} kali; setel ke 20 dan ia terbuka menjadi ${fmt(lebar.window, 1)} kali.`,
    en
      ? `At this gradation the filter passes water ${fmt(r.kRatio, 1)} times more freely than the soil behind it. The often quoted “at least sixteen times” holds only when filter and soil share the same uniformity.`
      : `Pada gradasi ini filternya meloloskan air ${fmt(r.kRatio, 1)} kali lebih lancar daripada tanah di belakangnya. Angka “sekurangnya enam belas kali” yang sering dikutip hanya berlaku bila keseragaman filter dan tanahnya sama.`
  );

  if (r.base.d85 < 0.075) butir.push(x.halusDasar);
  const hazenLuar = (d10: number) => d10 < 0.1 || d10 > 3;
  if (hazenLuar(r.base.d10) || hazenLuar(r.filter.d10)) butir.push(x.hazenLuar);
  butir.push(x.syaratJujur);

  return { state, notice: butir };
}
