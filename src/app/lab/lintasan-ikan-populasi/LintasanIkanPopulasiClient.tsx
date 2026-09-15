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
import { fishPassage, fmt, fmtPlain } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksPassage } from "@/lib/checks";

const TXT = {
  id: {
    title: "Lintasan ikan dan populasi",
    sheetTitle: "Lintasan populasi ikan ruaya terhadap keberhasilan melewati bendung",
    dN0: "Populasi awal",
    dK: "Daya dukung sungai",
    dR: "Laju pertumbuhan hakiki",
    dD: "Laju kematian alami",
    dP: "Keberhasilan melewati bendung",
    pBaik: "Lintasan ikan bekerja baik",
    pSedang: "Lintasan ikan sedang",
    pBuruk: "Bendung tanpa lintasan memadai",
    rEq: "Populasi pada keadaan mantap",
    rCrit: "Keberhasilan terkecil yang menyelamatkan",
    rMargin: "Selisih terhadap ambang",
    rAkhir: "Populasi pada tahun terakhir",
    rTenth: "Tahun saat populasi tinggal sepersepuluh",
    punah: "Populasi menuju punah",
    punahNote:
      "Keberhasilan melewati bendung berada pada atau di bawah ambang kelestariannya, sehingga populasinya menuju nol berapa pun besarnya sekarang. Yang perlu diperhatikan: ini bukan penurunan bertahap yang dapat ditunggu lalu diperbaiki nanti. Selama keberhasilan lintasan berada di bawah ambang, tidak ada besar populasi awal yang dapat menyelamatkannya, dan menunggu hanya memperkecil populasi yang tersisa untuk dipulihkan.",
    tanpaHarapan: "Kematian alami melampaui pertumbuhan",
    tanpaHarapanNote:
      "Laju kematian alaminya menyamai atau melampaui laju pertumbuhannya, sehingga ambang kelestariannya berada pada satu atau lebih. Pada keadaan itu lintasan ikan sesempurna apa pun tidak menolong, karena bahkan seluruh ikan yang berhasil naik pun tidak cukup menggantikan yang mati. Yang harus diperbaiki bukan bendungnya melainkan sebab kematiannya: kualitas air, penangkapan, atau hilangnya tempat memijah.",
    note:
      "Hasil terpenting lembar ini bukan angka melainkan bentuk hubungannya. Keberhasilan lintasan tidak bekerja sedikit demi sedikit: ada satu ambang, dan di kedua sisinya hasilnya berlawanan sama sekali. Di atas ambang populasinya menetap pada suatu nilai dan bertahan tak terhingga lama; di bawahnya ia menuju nol, betapa pun perlahan. Ambang itu sendiri sederhana, yaitu laju kematian dibagi laju pertumbuhan, dan ia sama sekali tidak bergantung pada besar populasi sekarang maupun daya dukung sungainya. Akibatnya bagi perancangan: lintasan ikan dengan keberhasilan lima puluh persen dan enam puluh persen bukan berbeda dua puluh persen dalam hasilnya, melainkan dapat berbeda antara lestari dan punah, tergantung letak keduanya terhadap ambang itu. Karena itu yang pertama harus diketahui sebelum merancang bukan berapa persen yang dapat dicapai, melainkan berapa persen yang dibutuhkan.",
  },
  en: {
    title: "Fish passage and population",
    sheetTitle: "Migratory fish population path against passage success at a weir",
    dN0: "Initial population",
    dK: "River carrying capacity",
    dR: "Intrinsic growth rate",
    dD: "Natural mortality rate",
    dP: "Success in passing the weir",
    pBaik: "Fishway working well",
    pSedang: "Fishway of moderate success",
    pBuruk: "Weir without adequate passage",
    rEq: "Equilibrium population",
    rCrit: "Smallest success that saves it",
    rMargin: "Margin above the threshold",
    rAkhir: "Population in the final year",
    rTenth: "Year the population falls to a tenth",
    punah: "Population heading to extinction",
    punahNote:
      "The passage success sits at or below the sustainability threshold, so the population tends to zero whatever its present size. Note what this means: it is not a gradual decline that can be watched and fixed later. While the passage success stays below the threshold, no starting population is large enough to save it, and waiting only reduces the population left to recover.",
    tanpaHarapan: "Natural mortality exceeds growth",
    tanpaHarapanNote:
      "The natural mortality rate matches or exceeds the growth rate, so the sustainability threshold sits at one or above. In that state no fishway however perfect can help, because even every fish that passes is not enough to replace those that die. What must be fixed is not the weir but the cause of mortality: water quality, fishing pressure, or lost spawning grounds.",
    note:
      "The most important result on this sheet is not a number but the shape of the relationship. Passage success does not work by degrees: there is a threshold, and on either side of it the outcome is entirely opposite. Above it the population settles at a value and holds indefinitely; below it the population tends to zero, however slowly. The threshold itself is simple, the mortality rate divided by the growth rate, and it depends not at all on the present population or the carrying capacity of the river. The consequence for design: a fishway of fifty per cent success and one of sixty per cent do not differ by twenty per cent in outcome, they may differ between persistence and extinction, depending where each sits relative to that threshold. So the first thing to establish before designing is not what percentage is achievable but what percentage is required.",
  },
} as const;

const REFS = {
  id: [
    "Kareiva, P., Marvier, M. & McClure, M. (2000). Recovery and management options for spring/summer chinook salmon. Science, vol. 290.",
    "Caswell, H. (2001). Matrix Population Models, edisi ke-2. Sinauer.",
    "Lucas, M.C. & Baras, E. (2001). Migration of Freshwater Fishes. Blackwell.",
    "Noonan, M.J., Grant, J.W.A. & Jackson, C.D. (2012). A quantitative assessment of fish passage efficiency. Fish and Fisheries, vol. 13.",
  ],
  en: [
    "Kareiva, P., Marvier, M. & McClure, M. (2000). Recovery and management options for spring/summer chinook salmon. Science, vol. 290.",
    "Caswell, H. (2001). Matrix Population Models, 2nd ed. Sinauer.",
    "Lucas, M.C. & Baras, E. (2001). Migration of Freshwater Fishes. Blackwell.",
    "Noonan, M.J., Grant, J.W.A. & Jackson, C.D. (2012). A quantitative assessment of fish passage efficiency. Fish and Fisheries, vol. 13.",
  ],
} as const;

export function LintasanIkanPopulasiClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [N0, setN0] = useState(5000);
  const [K, setK] = useState(10000);
  const [r0, setR0] = useState(0.6);
  const [d, setD] = useState(0.3);
  const [p, setP] = useState(0.9);

  const r = fishPassage(N0, K, r0, d, p);
  const tahunAkhir = r.path[r.path.length - 1];

  const ref = useCanvas(
    (ctx, w, h) => {
      const banding = [0.35, 0.5, 0.7, 1].map((pk) => ({
        p: pk,
        hasil: fishPassage(N0, K, r0, d, pk),
      }));

      const deret: ChartSeries[] = banding.map((b) => ({
        pts: b.hasil.path.map((q) => ({ x: q.year, y: q.population })),
        color: C.ink3,
        weight: W.hair,
        label: fmtPlain(b.p * 100, 0),
        labelAt: 0.97,
        labelDy: -8,
        labelAlign: "right" as CanvasTextAlign,
      }));

      deret.push({
        pts: r.path.map((q) => ({ x: q.year, y: q.population })),
        color: r.extinct ? C.signal : C.water,
        weight: W.bold,
        dash: r.extinct ? DASH.invalid : DASH.solid,
      });

      drawChart(
        ctx,
        w,
        h,
        {
          xMin: 0,
          xMax: r.path[r.path.length - 1].year,
          yMin: 0,
          yMax: K * 1.08,
          axisX: T.axYear,
          axisY: T.axFish,
          series: deret,
          rules:
            r.equilibrium > 0
              ? [
                  {
                    axis: "y",
                    at: r.equilibrium,
                    color: C.critical,
                    dash: DASH.axis,
                    label: `${fmtPlain(r.equilibrium, 0)}`,
                    labelAlign: "left",
                  },
                ]
              : undefined,
          point: {
            x: tahunAkhir.year,
            y: tahunAkhir.population,
            label: `${fmtPlain(tahunAkhir.population, 0)}`,
            invalid: r.extinct,
          },
          heading: r.extinct ? T.extinctPath : undefined,
          headingColor: C.signal,
          padRight: 42,
        },
        lang
      );
    },
    [N0, K, r0, d, p, lang]
  );

  return (
    <LabShell
      sheet="EK-04"
      subject={SUBJECTS.EK[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Keberhasilan lintasan ikan tidak bekerja sedikit demi sedikit. Ada
            satu <Term tint={C.critical}>ambang</Term>, dan di kedua sisinya
            hasilnya <Term tint={C.signal}>berlawanan sama sekali</Term>:
            lestari atau punah.
          </p>
        ) : (
          <p>
            Fish passage success does not work by degrees. There is a single{" "}
            <Term tint={C.critical}>threshold</Term>, and on either side of it
            the outcome is <Term tint={C.signal}>entirely opposite</Term>:
            persistence or extinction.
          </p>
        )
      }
      drawing={
        <Sheet
          number="EK-04"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: lang === "id" ? "ekor, tahun" : "individuals, years" },
            { label: "p", value: `${fmt(p * 100, 0)} %`, tint: r.extinct ? C.signal : C.water },
            { label: "p*", value: `${fmt(r.criticalPassage * 100, 1)} %`, tint: C.critical },
            { label: "N*", value: fmt(r.equilibrium, 0), tint: r.extinct ? C.signal : C.water },
            { label: "N60", value: fmt(tahunAkhir.population, 0) },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="N₀" label={x.dN0} value={N0} min={100} max={20000} step={100} digits={0} onChange={setN0} />
              <InputRow symbol="K" label={x.dK} value={K} min={500} max={50000} step={500} digits={0} onChange={setK} />
              <InputRow symbol="r" label={x.dR} value={r0} min={0.05} max={2} step={0.05} digits={2} unit="th⁻¹" onChange={setR0} />
              <InputRow symbol="d" label={x.dD} value={d} min={0.02} max={1} step={0.02} digits={2} unit="th⁻¹" onChange={setD} tint={C.energy} />
              <InputRow symbol="p" label={x.dP} value={p * 100} min={0} max={100} step={1} digits={0} unit="%" onChange={(v) => setP(v / 100)} tint={C.water} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pBaik, apply: () => { setN0(5000); setK(10000); setR0(0.6); setD(0.3); setP(0.9); } },
                  { label: x.pSedang, apply: () => { setN0(5000); setK(10000); setR0(0.6); setD(0.3); setP(0.6); } },
                  { label: x.pBuruk, apply: () => { setN0(5000); setK(10000); setR0(0.6); setD(0.3); setP(0.25); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={r.extinct ? undefined : C.water} alert={r.extinct}>
                {r.extinct ? x.punah : `${fmt(r.equilibrium, 0)} ${lang === "id" ? "ekor" : "individuals"}`}
              </Flag>
              {r.hopeless && <Flag alert>{x.tanpaHarapan}</Flag>}
            </div>
            {r.hopeless ? (
              <div className="mb-2.5">
                <Note>{x.tanpaHarapanNote}</Note>
              </div>
            ) : (
              r.extinct && (
                <div className="mb-2.5">
                  <Note>{x.punahNote}</Note>
                </div>
              )
            )}
            <ResultTable
              rows={[
                { symbol: "N*", label: x.rEq, value: fmt(r.equilibrium, 1), tint: r.extinct ? C.signal : C.water, strong: true },
                { symbol: "p*", label: x.rCrit, value: fmt(r.criticalPassage * 100, 2), unit: "%", tint: C.critical, strong: true },
                { symbol: "—", label: x.rMargin, value: fmt((p - r.criticalPassage) * 100, 2), unit: "%", tint: r.extinct ? C.signal : undefined },
                { symbol: "N", label: x.rAkhir, value: fmt(tahunAkhir.population, 1) },
                { symbol: "t₁₀", label: x.rTenth, value: Number.isFinite(r.yearsToTenth) ? fmt(r.yearsToTenth, 0) : "—", unit: Number.isFinite(r.yearsToTenth) ? (lang === "id" ? "th" : "y") : undefined, tint: Number.isFinite(r.yearsToTenth) ? C.signal : undefined },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(N0, K, r0, d, p, r.criticalPassage, r.equilibrium, r.hopeless, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksPassage(N0, K, r0, d, p)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>N(t+1) = N + r p N</span>
                <span className="ml-1">(</span>
                <span>1 −</span>
                <Frac num="N" den="K" />
                <span>)</span>
                <span className="ml-2">− d N</span>
              </Eq>
              <Eq>
                <span>N* = K</span>
                <span className="ml-1">(</span>
                <span>1 −</span>
                <Frac num="d" den="r p" />
                <span>)</span>
                <span className="ml-6">p* =</span>
                <Frac num="d" den="r" />
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "ambangnya tidak bergantung pada N₀ maupun K"
                    : "the threshold depends on neither N₀ nor K"}
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
  N0: number,
  K: number,
  r0: number,
  d: number,
  p: number,
  kritis: number,
  equilibrium: number,
  hopeless: boolean,
  lang: Lang
): string {
  if (hopeless) {
    return lang === "id"
      ? "Selama kematian alaminya menyamai atau melampaui pertumbuhannya, lembar ini tidak punya rancangan lintasan untuk ditawarkan. Turunkan laju kematiannya atau naikkan laju pertumbuhannya, dan ambangnya akan turun di bawah seratus persen sehingga lintasan ikan kembali punya arti."
      : "While natural mortality matches or exceeds growth, this sheet has no passage design to offer. Lower the mortality rate or raise the growth rate, and the threshold will fall below one hundred per cent so that a fishway means something again.";
  }

  const sedikitDiAtas = fishPassage(N0, K, r0, d, Math.min(kritis + 0.02, 1));
  const sedikitDiBawah = fishPassage(N0, K, r0, d, Math.max(kritis - 0.02, 0));

  if (lang === "en")
    return `The threshold here is ${fmt(kritis * 100, 1)} per cent. Two percentage points above it the population settles at ${fmt(sedikitDiAtas.equilibrium, 0)} individuals and holds; two points below it the population goes to ${fmt(sedikitDiBawah.equilibrium, 0)} and keeps falling. Four percentage points of passage success separate a river with fish from a river without them, and no amount of starting population changes which side you are on. Set the passage slider just either side of ${fmt(kritis * 100, 0)} per cent and watch the curves part.`;
  return `Ambangnya di sini ${fmt(kritis * 100, 1)} persen. Dua angka persen di atasnya populasinya menetap pada ${fmt(sedikitDiAtas.equilibrium, 0)} ekor dan bertahan; dua angka di bawahnya ia menuju ${fmt(sedikitDiBawah.equilibrium, 0)} dan terus turun. Empat angka persen keberhasilan lintasan memisahkan sungai yang berikan dari sungai yang tidak, dan sebesar apa pun populasi awalnya tidak mengubah di sisi mana ia berada. Setel slider keberhasilan tepat di kedua sisi ${fmt(kritis * 100, 0)} persen lalu perhatikan kurvanya berpisah.`;
}
