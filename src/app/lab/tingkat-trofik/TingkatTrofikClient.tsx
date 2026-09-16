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
  TROPHIC_MIN_ENERGY,
  fmt,
  fmtPlain,
  fmtSci,
  trophicPyramid,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksTrophic } from "@/lib/checks";

const TXT = {
  id: {
    title: "Tingkat trofik",
    sheetTitle: "Piramida energi rantai makanan sungai",
    dP: "Produksi primer bersih",
    dE: "Efisiensi peralihan antar tingkat",
    dN: "Banyaknya tingkat yang dilihat",
    pJernih: "Sungai jernih berbatu",
    pSubur: "Sungai subur dataran",
    pWaduk: "Waduk dalam, cahaya terbatas",
    rTop: "Energi di tingkat teratas",
    rFrac: "Bagian produksi yang sampai ke puncak",
    rSupported: "Tingkat yang masih tertopang",
    rBio: "Biomassa tegakan di tingkat teratas",
    rLoss: "Energi yang hilang tiap selang",
    melampaui: "Tingkat yang diminta tidak tertopang",
    melampauiNote:
      "Aliran energi di tingkat teratas turun di bawah satu kilojoule per meter persegi per tahun, dan di bawah itu tidak ada populasi yang dapat bertahan pada luas yang wajar. Tingkat yang digambar tetap ada dalam hitungan, tetapi ia tidak ada di sungainya. Inilah sebabnya rantai makanan sungai jarang melebihi empat tingkat, dan mengapa pemangsa puncak seperti sidat besar atau burung pemakan ikan menuntut daerah jelajah yang luas: mereka harus memanen produksi dasar dari berhektar-hektar sungai untuk menopang satu ekor.",
    note:
      "Piramida ini menghubungkan ekologi dengan hidraulika lewat satu jalur yang sering tidak terlihat. Banyaknya tingkat yang dapat ditopang sebuah sungai ditentukan oleh produksi dasarnya, dan produksi dasar ditentukan oleh cahaya yang menembus air, hara yang terbawa, serta waktu tinggal air yang menentukan berapa lama keduanya dapat dipakai. Membendung sungai mengubah ketiganya sekaligus: kedalaman bertambah sehingga cahaya berkurang di dasar, kecepatan turun sehingga hara mengendap, dan waktu tinggal memanjang sehingga ganggang sempat tumbuh di permukaan tetapi tidak di dasar. Akibatnya bukan sekadar berkurangnya jumlah ikan melainkan berubahnya susunan rantai makanannya. Perhatikan juga bentuk piramida biomassa yang digambar berdampingan: ia tidak selalu menciut seperti piramida energi, karena hewan bertingkat tinggi berumur lebih panjang sehingga biomassanya menumpuk lebih lama untuk aliran energi yang sama.",
  },
  en: {
    title: "Trophic levels",
    sheetTitle: "Energy pyramid of a river food chain",
    dP: "Net primary production",
    dE: "Transfer efficiency between levels",
    dN: "Number of levels shown",
    pJernih: "Clear stony river",
    pSubur: "Fertile lowland river",
    pWaduk: "Deep reservoir, limited light",
    rTop: "Energy at the top level",
    rFrac: "Fraction of production reaching the top",
    rSupported: "Levels still supported",
    rBio: "Standing biomass at the top level",
    rLoss: "Energy lost at each step",
    melampaui: "The requested level is not supported",
    melampauiNote:
      "The energy flow at the top level falls below one kilojoule per square metre per year, and below that no population can persist over any reasonable area. The level drawn still exists in the arithmetic, but it does not exist in the river. This is why river food chains rarely exceed four levels, and why top predators such as large eels or fish-eating birds demand wide ranges: they must harvest the base production of hectares of river to support a single individual.",
    note:
      "This pyramid links ecology to hydraulics along a path that is often invisible. The number of levels a river can support is set by its base production, and base production is set by the light reaching through the water, the nutrients carried past, and the residence time that decides how long both can be used. Damming a river changes all three at once: depth increases so light dims at the bed, velocity falls so nutrients settle, and residence time lengthens so algae grow at the surface but not on the bottom. The consequence is not merely fewer fish but a different arrangement of the food chain. Note also the biomass pyramid drawn alongside: it does not always narrow like the energy pyramid, because higher-level animals live longer, so their biomass accumulates for longer at the same energy flow.",
  },
} as const;

const REFS = {
  id: [
    "Lindeman, R.L. (1942). The trophic-dynamic aspect of ecology. Ecology, vol. 23.",
    "Pauly, D. & Christensen, V. (1995). Primary production required to sustain global fisheries. Nature, vol. 374.",
    "Allan, J.D. & Castillo, M.M. (2007). Stream Ecology, edisi ke-2. Springer, Bab 12.",
    "Vannote, R.L. et al. (1980). The river continuum concept. Canadian Journal of Fisheries and Aquatic Sciences, vol. 37.",
  ],
  en: [
    "Lindeman, R.L. (1942). The trophic-dynamic aspect of ecology. Ecology, vol. 23.",
    "Pauly, D. & Christensen, V. (1995). Primary production required to sustain global fisheries. Nature, vol. 374.",
    "Allan, J.D. & Castillo, M.M. (2007). Stream Ecology, 2nd ed. Springer, Chapter 12.",
    "Vannote, R.L. et al. (1980). The river continuum concept. Canadian Journal of Fisheries and Aquatic Sciences, vol. 37.",
  ],
} as const;

export function TingkatTrofikClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [P, setP] = useState(2000);
  const [eff, setEff] = useState(0.1);
  const [n, setN] = useState(4);

  const r = trophicPyramid(P, eff, n);
  const atas = r.levels[r.levels.length - 1];

  /* Dipakai pada gambar dan kop: yang kecil ditulis berpangkat sepuluh. */
  const fmtEnergi = (v: number) =>
    v > 0 && v < 1e-2 ? fmtSci(v) : fmtPlain(v, 2);

  const ref = useCanvas(
    (ctx, w, h) => {
      const energi: { x: number; y: number }[] = r.levels.map((l) => ({
        x: l.level,
        y: Math.max(l.energy, 1e-6),
      }));
      const biomassa: { x: number; y: number }[] = r.levels.map((l) => ({
        x: l.level,
        y: Math.max(l.biomass, 1e-6),
      }));

      const deret: ChartSeries[] = [
        {
          pts: energi,
          color: C.energy,
          weight: W.bold,
          label: T.axEnergyFlow.split(",")[0],
          labelAt: 0.35,
          labelDy: -12,
        },
        {
          pts: biomassa,
          color: C.water,
          weight: W.thin,
          dash: DASH.hidden,
          label: lang === "id" ? "biomassa" : "biomass",
          labelAt: 0.7,
          labelDy: 14,
        },
      ];

      drawChart(
        ctx,
        w,
        h,
        {
          xMin: 1,
          xMax: Math.max(n, 2),
          yMin: 1e-2,
          yMax: Math.max(P * 2, 10),
          yLog: true,
          axisX: T.axTrophic,
          axisY: T.axEnergyFlow,
          series: deret,
          rules: [
            {
              axis: "y",
              at: TROPHIC_MIN_ENERGY,
              color: C.signal,
              dash: DASH.axis,
              label: `${fmtPlain(TROPHIC_MIN_ENERGY, 0)} kJ/m²·y`,
              labelAlign: "left",
            },
          ],
          point: {
            x: atas.level,
            y: Math.max(atas.energy, 1e-6),
            /* Aliran tenaga di tingkat puncak membentang dari ribuan sampai
               sepersejuta kilojoule, jadi dua desimal tetap menuliskan ujung
               bawahnya sebagai nol. */
            label: fmtEnergi(atas.energy),
            invalid: r.overreach,
          },
          /*
           * Sebelumnya di sini tertulis "tidak ada hukum sederhana di sini",
           * kalimat milik lembar hukum dinding, padahal di sini hukumnya
           * berlaku sempurna. Yang tidak berlaku bukan hukumnya melainkan
           * tingkat yang diminta: aliran tenaganya jatuh di bawah ambang
           * tempat populasi masih dapat bertahan. Gambar yang mengumumkan
           * sebab yang salah menuntun pembaca mencari kesalahan di tempat
           * yang salah pula.
           */
          heading: r.overreach ? x.melampaui : undefined,
          headingColor: C.signal,
        },
        lang
      );
    },
    [P, eff, n, lang]
  );

  return (
    <LabShell
      sheet="EK-01"
      subject={SUBJECTS.EK[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Tiap tingkat rantai makanan hanya meneruskan{" "}
            <Term tint={C.energy}>sebagian kecil</Term> energi yang
            diterimanya. Karena itu panjang rantai bukan urusan selera
            melainkan urusan <Term tint={C.water}>produksi dasar</Term>.
          </p>
        ) : (
          <p>
            Each level of a food chain passes on only a{" "}
            <Term tint={C.energy}>small fraction</Term> of the energy it
            receives. The length of the chain is therefore not a matter of
            taste but of <Term tint={C.water}>base production</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="EK-01"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (kJ/m²·y)" },
            { label: "P", value: `${fmt(P, 0)}` },
            { label: "ε", value: fmt(eff, 3) },
            { label: "n", value: fmt(n, 0), tint: r.overreach ? C.signal : undefined },
            { label: "En", value: fmtEnergi(atas.energy), tint: r.overreach ? C.signal : C.energy },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="P" label={x.dP} value={P} min={20} max={20000} step={20} digits={0} unit="kJ/m²·y" onChange={setP} tint={C.water} />
              <InputRow symbol="ε" label={x.dE} value={eff} min={0.01} max={0.35} step={0.005} digits={3} onChange={setEff} tint={C.energy} />
              <InputRow symbol="n" label={x.dN} value={n} min={2} max={7} step={1} digits={0} onChange={setN} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pJernih, apply: () => { setP(800); setEff(0.12); setN(4); } },
                  { label: x.pSubur, apply: () => { setP(6000); setEff(0.1); setN(5); } },
                  { label: x.pWaduk, apply: () => { setP(200); setEff(0.08); setN(5); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={r.overreach ? undefined : C.energy} alert={r.overreach}>
                {`${fmt(r.supported, 0)} ${lang === "id" ? "tingkat" : "levels"}`}
              </Flag>
              {r.overreach && <Flag alert>{x.melampaui}</Flag>}
            </div>
            {r.overreach && (
              <div className="mb-2.5">
                <Note>{x.melampauiNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "—", label: x.rSupported, value: fmt(r.supported, 0), strong: true },
                { symbol: "En", label: x.rTop, value: atas.energy > 0 && atas.energy < 1e-2 ? fmtSci(atas.energy) : fmt(atas.energy, 3), unit: "kJ/m²·y", tint: C.energy, strong: true },
                { symbol: "En/P", label: x.rFrac, value: fmtSci(r.topFraction), tint: C.critical },
                { symbol: "Bn", label: x.rBio, value: atas.biomass > 0 && atas.biomass < 1e-2 ? fmtSci(atas.biomass) : fmt(atas.biomass, 3), unit: "g/m²", tint: C.water },
                { symbol: "—", label: x.rLoss, value: fmt((1 - eff) * 100, 1), unit: "%" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(P, eff, n, r.topFraction, r.supported, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksTrophic(P, eff, n)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>E(i) = P · ε^(i−1)</span>
                <span className="ml-6">
                  {lang === "id" ? "bagian ke puncak" : "fraction to the top"} = ε^(n−1)
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "satu tingkat dianggap tertopang bila alirannya melebihi 1 kJ/m² per tahun"
                    : "a level counts as supported when its flow exceeds 1 kJ/m² per year"}
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
  P: number,
  eff: number,
  n: number,
  topFraction: number,
  supported: number,
  lang: Lang
): string {
  const naik = trophicPyramid(P, Math.min(eff * 1.5, 0.5), n);

  if (lang === "en")
    return `At ${fmt(eff * 100, 1)} per cent transfer efficiency, only ${fmtSci(topFraction)} of the base production reaches level ${fmtPlain(n, 0)}. Raise the efficiency by half, to ${fmt(Math.min(eff * 1.5, 0.5) * 100, 1)} per cent, and that fraction becomes ${fmtSci(naik.topFraction)}, a change of ${fmt(naik.topFraction / Math.max(topFraction, 1e-30), 1)} times. A modest change in efficiency compounds through every step, which is why arguments about food-chain length turn on numbers that look small. This river supports ${fmtPlain(supported, 0)} levels.`;
  return `Pada efisiensi peralihan ${fmt(eff * 100, 1)} persen, hanya ${fmtSci(topFraction)} dari produksi dasar yang sampai ke tingkat ${fmtPlain(n, 0)}. Naikkan efisiensinya setengah kali lipat, menjadi ${fmt(Math.min(eff * 1.5, 0.5) * 100, 1)} persen, dan bagian itu menjadi ${fmtSci(naik.topFraction)}, berubah ${fmt(naik.topFraction / Math.max(topFraction, 1e-30), 1)} kali. Perubahan kecil pada efisiensi berlipat ganda melewati tiap selang, dan itulah sebabnya perdebatan tentang panjang rantai makanan berkisar pada angka yang tampak sepele. Sungai ini menopang ${fmtPlain(supported, 0)} tingkat.`;
}
