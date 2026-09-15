"use client";

import { useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  Block,
  Flag,
  InputRow,
  InputTable,
  Note,
  PresetRow,
  ResultTable,
  Sheet,
  Term,
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

const TXT = {
  id: {
    title: "Filter bendungan",
    sheetTitle: "Gradasi filter terhadap tanah yang dilindunginya — kriteria Terzaghi",
    dBaseD50: "Garis tengah tengah tanah",
    dBaseCu: "Keseragaman tanah",
    dFilterD50: "Garis tengah tengah filter",
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
    tahanNote:
      "D15 filter melampaui empat kali D85 tanah, jadi pori filternya lebih besar daripada butiran tanah yang harus ditahannya. Yang terjadi sesudah itu bukan kebocoran yang bertambah perlahan melainkan erosi buluh: butiran halus terbawa masuk ke pori filter, lubang yang ditinggalkannya memperbesar kecepatan setempat, butiran berikutnya terbawa lebih mudah, dan saluran terbuka menembus tubuh bendungan dari hilir ke hulu. Erosi buluh adalah sebab kegagalan bendungan urugan yang paling sering, dan hampir seluruhnya berlangsung tanpa terlihat sampai tahap terakhirnya.",
    alirNote:
      "D15 filter kurang dari empat kali D15 tanah, jadi filternya tidak cukup lebih lolos daripada tanah yang dilindunginya. Filter yang tidak mengalirkan bukan filter melainkan lapisan kedap kedua: air yang sampai ke situ tertahan, tekanan air pori di belakangnya naik, dan tekanan air pori yang naik adalah persis keadaan yang ingin dihindari dengan memasang filter.",
    note:
      "Kedua syarat Terzaghi menarik ke arah yang berlawanan, dan itulah yang membuat perancangan filter menjadi soal dan bukan sekadar pilihan. Filter harus cukup halus untuk menahan butiran tanah, dan cukup kasar untuk mengalirkan air lebih lancar daripada tanahnya. Bagi kedua syarat itu satu sama lain dan angka empatnya saling menghapus: lebar jendela yang tersedia persis sama dengan D85 tanah dibagi D15 tanah, yaitu rentang gradasi tanah yang dilindungi itu sendiri. Kesimpulan itu tidak terbaca dari kedua syaratnya bila dibaca satu per satu, dan akibatnya langsung di lapangan. Tanah yang bergradasi lebar memberi pilihan filter yang longgar. Tanah yang seragam, misalnya pasir dune atau lanau hasil endapan, hampir tidak memberi pilihan sama sekali, dan di situ filter satu lapis sering tidak cukup sehingga harus dipakai filter bertingkat dua atau tiga. Akibat kedua, dari syarat alirannya saja: karena permeabilitas kira-kira sebanding dengan kuadrat garis tengah butiran, filter yang memenuhi syarat aliran selalu sekurangnya enam belas kali lebih lolos daripada tanahnya. Filter bukan lapisan yang sedikit lebih kasar; ia lapisan yang alirannya satu tingkat besaran berbeda.",
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
    tahanNote:
      "The filter D15 exceeds four times the soil D85, so the filter pores are larger than the soil particles they must hold. What follows is not a leak that grows slowly but piping: fine particles wash into the filter pores, the holes they leave raise the local velocity, the next particles go more easily, and a channel opens through the dam body from downstream to upstream. Piping is the commonest cause of embankment dam failure, and almost all of it happens unseen until the final stage.",
    alirNote:
      "The filter D15 is under four times the soil D15, so the filter is not sufficiently more permeable than the soil it protects. A filter that does not drain is not a filter but a second impervious layer: water reaching it is held back, pore pressure behind it rises, and rising pore pressure is exactly the condition the filter was installed to prevent.",
    note:
      "The two Terzaghi criteria pull in opposite directions, and that is what makes filter design a problem rather than a choice. The filter must be fine enough to hold soil particles and coarse enough to drain more freely than the soil. Divide one criterion by the other and the fours cancel: the width of the available window is exactly the soil D85 over the soil D15, which is the grading span of the protected soil itself. That conclusion cannot be read from either criterion alone, and its field consequence is immediate. A widely graded soil gives a generous choice of filter. A uniform soil, dune sand or a deposited silt, gives almost no choice at all, and there a single filter layer is often not enough so a two or three stage filter must be used. A second consequence, from the drainage criterion alone: since permeability scales roughly with the square of grain size, a filter satisfying the drainage criterion is always at least sixteen times more permeable than the soil. A filter is not a slightly coarser layer; it is a layer whose flow is an order of magnitude apart.",
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
          pts: kurva(r.filter),
          color: r.passes ? C.water : C.signal,
          weight: W.bold,
          dash: r.passes ? DASH.solid : DASH.invalid,
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
            invalid: !r.retains || !r.drains,
          },
          heading: r.retains
            ? r.drains
              ? undefined
              : x.gagalAlir
            : x.gagalTahan,
          headingColor: C.signal,
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
      sheet="DM-02"
      subject={SUBJECTS.DM[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Lebar jendela filter yang tersedia{" "}
            <Term tint={C.critical}>persis sama</Term> dengan rentang gradasi
            tanah yang dilindunginya. Tanah yang seragam{" "}
            <Term tint={C.signal}>hampir tidak memberi pilihan</Term>.
          </p>
        ) : (
          <p>
            The width of the available filter window is{" "}
            <Term tint={C.critical}>exactly</Term> the grading span of the soil
            it protects. A uniform soil{" "}
            <Term tint={C.signal}>gives almost no choice</Term>.
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
            { label: "jendela", value: fmt(r.window, 2) },
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
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={r.passes ? C.water : undefined} alert={!r.passes}>
                {pesan}
              </Flag>
            </div>
            {!r.retains && (
              <div className="mb-2.5">
                <Note>{x.tahanNote}</Note>
              </div>
            )}
            {r.retains && !r.drains && (
              <div className="mb-2.5">
                <Note>{x.alirNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "D15f", label: x.rD15, value: fmt(r.filter.d15, 4), unit: "mm", tint: C.water, strong: true },
                { symbol: "min", label: x.rD15Min, value: fmt(r.d15Min, 4), unit: "mm", tint: r.drains ? undefined : C.signal },
                { symbol: "maks", label: x.rD15Max, value: fmt(r.d15Max, 4), unit: "mm", tint: r.retains ? undefined : C.signal },
                { symbol: "n", label: x.rWindow, value: fmt(r.window, 3), tint: C.critical, strong: true },
                { symbol: "D15b", label: x.rD15b, value: fmt(r.base.d15, 4), unit: "mm" },
                { symbol: "D85b", label: x.rD85, value: fmt(r.base.d85, 4), unit: "mm" },
                { symbol: "kb", label: x.rKBase, value: fmtSci(r.base.k), unit: "m/s" },
                { symbol: "kf", label: x.rKFilter, value: fmtSci(r.filter.k), unit: "m/s" },
                { symbol: "kf/kb", label: x.rKRatio, value: fmt(r.kRatio, 1), strong: true },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(bD50, bCu, fD50, fCu, lang)}</Note>
          </Block>
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
                    ? "gradasi disusun log-normal dari garis tengah tengah dan keseragamannya, jadi tiap titik kurvanya terhitung dan bukan digambar tangan"
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

function notice(
  bD50: number,
  bCu: number,
  fD50: number,
  fCu: number,
  lang: Lang
): string {
  const r = filterDesign(bD50, bCu, fD50, fCu);
  const seragam = filterDesign(bD50, 1.4, fD50, fCu);
  const lebar = filterDesign(bD50, 20, fD50, fCu);

  if (lang === "en")
    return `The window for the filter D15 runs from ${fmt(r.d15Min, 3)} to ${fmt(r.d15Max, 3)} millimetres, a factor of ${fmt(r.window, 2)}, and that factor is exactly the soil D85 over the soil D15. Set the soil uniformity to 1.4 and the window shrinks to a factor of ${fmt(seragam.window, 2)}; set it to 20 and it opens to ${fmt(lebar.window, 1)}. The filter is not a slightly coarser layer either: at this gradation it passes water ${fmt(r.kRatio, 0)} times more freely than the soil behind it.`;
  return `Jendela untuk D15 filter terbentang dari ${fmt(r.d15Min, 3)} sampai ${fmt(r.d15Max, 3)} milimeter, yaitu ${fmt(r.window, 2)} kali lipat, dan angka itu persis D85 tanah dibagi D15 tanah. Setel keseragaman tanahnya ke 1,4 dan jendelanya menyempit menjadi ${fmt(seragam.window, 2)} kali; setel ke 20 dan ia terbuka menjadi ${fmt(lebar.window, 1)} kali. Filternya juga bukan lapisan yang sedikit lebih kasar: pada gradasi ini ia meloloskan air ${fmt(r.kRatio, 0)} kali lebih lancar daripada tanah di belakangnya.`;
}
