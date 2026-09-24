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
  ISBASH_EMBEDDED,
  ISBASH_EXPOSED,
  SEDIMENT_S,
  fmt,
  fmtPlain,
  riprapSize,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksRiprap } from "@/lib/checks";

const TXT = {
  id: {
    title: "Perlindungan erosi",
    sheetTitle: "Ukuran batu terhadap kecepatan aliran — rumus Isbash",
    dV: "Kecepatan rata-rata aliran",
    dS: "Rapat massa jenis batu terhadap air",
    dC: "Tetapan Isbash",
    dChosen: "Ukuran batu yang direncanakan",
    pTertanam: "Batu tertanam rapat",
    pMenonjol: "Batu menonjol sendirian",
    pDeras: "Hilir pelimpah, arus deras",
    rD50: "Ukuran batu yang dituntut",
    rMassa: "Massa satu batu terpilih",
    rTebal: "Tebal lapisan yang disyaratkan",
    rVtahan: "Kecepatan yang sanggup ditahan",
    rPakai: "Perbandingan kecepatan kerja terhadap tahan",
    mantap: "Batu terpilih mantap",
    belumPilih: "Ukuran batu belum dipilih",
    belumPilihNote:
      "Penggeser ukuran batu masih di nol, artinya belum ada ukuran yang dipilih untuk dibandingkan. Tiga baris terakhir tabel hasil karena itu dihitung dengan ukuran yang DITUNTUT alirannya, bukan dengan ukuran yang direncanakan, sehingga perbandingan kecepatan kerja terhadap kecepatan tahan pasti tepat satu. Angka satu di situ bukan hasil melainkan akibat dari belum adanya pilihan. Geser ukuran batunya ke nilai yang benar-benar akan dipakai supaya perbandingannya berarti.",
    goyah: "Batu terpilih terlalu kecil",
    goyahNote:
      "Ukuran batu yang direncanakan lebih kecil daripada yang dituntut kecepatan aliran ini, jadi batunya akan bergerak. Yang perlu diperhatikan tentang kegagalan lapisan batu: ia tidak pernah bertahap. Begitu beberapa batu terangkat, lubang yang ditinggalkannya memperbesar kecepatan setempat, batu tetangganya ikut terangkat, dan seluruh lapisan terbuka dalam satu banjir yang sama. Itu sebabnya perlindungan batu dirancang dengan cadangan ukuran, bukan dengan cadangan luas.",
    note:
      "Dua hal pada lembar ini yang paling berguna diingat, dan keduanya berasal dari pangkat pada rumusnya. Pertama, kecepatan muncul berpangkat dua pada ukuran batu, sehingga menggandakan kecepatan menuntut batu empat kali lebih besar garis tengahnya. Karena massa sebanding dengan pangkat tiga garis tengah, itu berarti enam puluh empat kali lebih berat. Perbedaan antara aliran dua meter per detik dan empat meter per detik karena itu bukan perbedaan derajat melainkan perbedaan antara batu yang dapat diangkat dua orang dan batu yang menuntut alat berat. Kedua, tetapan Isbash menyatakan seberapa terlindung sebuah batu oleh tetangganya, dan perbedaan antara batu yang tertanam rapat dengan batu yang menonjol sendirian hampir dua kali lipat pada ukurannya. Itu sebabnya mutu pemasangan lapisan batu sama menentukannya dengan ukuran batunya sendiri: lapisan yang dipasang asal tumpuk membuat sebagian batunya menonjol, dan batu yang menonjol itulah yang lepas lebih dulu lalu membuka seluruh lapisan.",
  },
  en: {
    title: "Erosion protection",
    sheetTitle: "Stone size against flow velocity — the Isbash formula",
    dV: "Mean flow velocity",
    dS: "Stone density relative to water",
    dC: "Isbash constant",
    dChosen: "Stone size planned",
    pTertanam: "Stone embedded tightly",
    pMenonjol: "Stone standing proud alone",
    pDeras: "Below a spillway, fast flow",
    rD50: "Stone size required",
    rMassa: "Mass of one chosen stone",
    rTebal: "Layer thickness required",
    rVtahan: "Velocity it can resist",
    rPakai: "Working velocity over resisting velocity",
    mantap: "Chosen stone is stable",
    belumPilih: "No stone size chosen yet",
    belumPilihNote:
      "The stone-size slider is still at zero, meaning no size has been chosen to compare against. The last three rows of the results are therefore computed with the size the flow DEMANDS rather than with a planned size, so the ratio of working velocity to resisting velocity is bound to be exactly one. That one is not a result but a consequence of nothing having been chosen. Move the stone size to the value that will actually be used, and the ratio starts to mean something.",
    goyah: "Chosen stone is too small",
    goyahNote:
      "The planned stone is smaller than this velocity demands, so it will move. What is worth knowing about riprap failure: it is never gradual. Once a few stones lift, the hole they leave raises the local velocity, their neighbours lift too, and the whole layer opens in the same flood. That is why rock protection is designed with a margin on size rather than a margin on area.",
    note:
      "Two things on this sheet are the most useful to remember, and both come from the exponents in the formula. First, velocity enters the stone size squared, so doubling the velocity demands a stone four times larger in diameter. Since mass scales with the cube of diameter, that is sixty-four times heavier. The difference between a two metre per second flow and a four metre per second flow is therefore not a difference of degree but the difference between a stone two people can lift and a stone that needs machinery. Second, the Isbash constant states how sheltered a stone is by its neighbours, and the difference between a tightly embedded stone and one standing proud alone is nearly a factor of two in size. That is why the quality of placement matters as much as the size of the stone: a layer tipped rather than placed leaves some stones proud, and it is those proud stones that go first and then open the whole layer.",
  },
} as const;

const REFS = {
  id: [
    "Isbash, S.V. (1936). Construction of dams by depositing rock in running water. 2nd Congress on Large Dams.",
    "USACE (1994). Hydraulic Design of Flood Control Channels, EM 1110-2-1601.",
    "CIRIA, CUR & CETMEF (2007). The Rock Manual, C683, edisi ke-2.",
    "Pilarczyk, K.W. (2001). Unification of stability formulae for revetments. IAHR Congress.",
  ],
  en: [
    "Isbash, S.V. (1936). Construction of dams by depositing rock in running water. 2nd Congress on Large Dams.",
    "USACE (1994). Hydraulic Design of Flood Control Channels, EM 1110-2-1601.",
    "CIRIA, CUR & CETMEF (2007). The Rock Manual, C683, 2nd ed.",
    "Pilarczyk, K.W. (2001). Unification of stability formulae for revetments. IAHR Congress.",
  ],
} as const;

const V_MIN = 0.2;
const V_MAX = 8;

export function PerlindunganErosiClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [V, setV] = useState(2);
  const [s, setS] = useState(SEDIMENT_S);
  const [Cis, setCis] = useState(ISBASH_EMBEDDED);
  const [chosenMm, setChosenMm] = useState(0);

  const chosen = chosenMm / 1000;
  const r = riprapSize(V, s, Cis, chosen);
  const pas = riprapSize(V, s, Cis);
  const adaPilihan = chosen > 0;

  const ref = useCanvas(
    (ctx, w, ch) => {
      const kurva = (C_: number) => {
        const pts: { x: number; y: number }[] = [];
        for (let lg = Math.log10(V_MIN); lg <= Math.log10(V_MAX) + 1e-9; lg += 0.02) {
          const vv = Math.pow(10, lg);
          pts.push({ x: vv, y: riprapSize(vv, s, C_).d50 });
        }
        return pts;
      };

      const deret: ChartSeries[] = [
        {
          pts: kurva(ISBASH_EXPOSED),
          color: C.ink3,
          weight: W.hair,
          dash: DASH.hidden,
          /*
           * Namanya tetapan Isbash-nya sendiri, sejajar dengan kurva yang
           * satu lagi. Sebelumnya terpasang nama SUMBU-nya, dipotong dari
           * "garis tengah butiran, mm", sehingga di tengah bidang melayang
           * tulisan "garis tengah butir" yang tidak menyatakan kurva yang
           * mana dan terbaca seperti judul sumbu yang tersesat.
           */
          label: `C ${fmtPlain(ISBASH_EXPOSED, 2)}`,
          labelAt: 0.55,
          labelDy: -11,
        },
        {
          pts: kurva(Cis),
          color: C.critical,
          weight: W.bold,
          label: `C ${fmtPlain(Cis, 2)}`,
          labelAt: 0.78,
          labelDy: 14,
        },
      ];

      drawChart(
        ctx,
        w,
        ch,
        {
          xMin: V_MIN,
          xMax: V_MAX,
          yMin: 0.002,
          yMax: 3,
          xLog: true,
          yLog: true,
          axisX: T.axMeanVel,
          axisY: T.axGrainMm.replace("mm", "m"),
          series: deret,
          rules: adaPilihan
            ? [
                {
                  axis: "y",
                  at: chosen,
                  color: r.stable ? C.water : C.signal,
                  dash: DASH.axis,
                  label: `${T.stoneLayer} ${fmtPlain(chosen, 3)} m`,
                  labelAlign: "left",
                },
              ]
            : undefined,
          point: {
            x: V,
            y: pas.d50,
            label: `${fmtPlain(pas.d50, 3)} m`,
            invalid: adaPilihan && !r.stable,
          },
          heading: adaPilihan && !r.stable ? x.goyah : undefined,
          headingColor: C.signal,
        },
        lang
      );
    },
    [V, s, Cis, chosenMm, lang]
  );

  return (
    <LabShell
      sheet="HS-08"
      subject={SUBJECTS.HS[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Kecepatan muncul <Term tint={C.critical}>berpangkat dua</Term> pada
            ukuran batu, dan massa berpangkat tiga pada ukurannya. Aliran dua
            kali lebih deras menuntut batu{" "}
            <Term tint={C.critical}>enam puluh empat kali lebih berat</Term>.
          </p>
        ) : (
          <p>
            Velocity enters the stone size <Term tint={C.critical}>squared</Term>,
            and mass enters the size cubed. A flow twice as fast demands a stone{" "}
            <Term tint={C.critical}>sixty-four times heavier</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HS-08"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m/s, kg)" },
            { label: "V", value: `${fmt(V, 2)} m/s`, tint: C.water },
            { label: "d50", value: `${fmt(pas.d50, 3)} m`, tint: C.critical },
            { label: "m", value: `${fmt(r.stoneMass, 1)} kg` },
            { label: "C", value: fmt(Cis, 2) },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="V" label={x.dV} value={V} min={0.2} max={8} step={0.05} digits={2} unit="m/s" onChange={setV} tint={C.water} />
              <InputRow symbol="s" label={x.dS} value={s} min={2} max={3.2} step={0.05} digits={2} onChange={setS} />
              <InputRow symbol="C" label={x.dC} value={Cis} min={0.7} max={1.4} step={0.02} digits={2} onChange={setCis} tint={C.critical} />
              <InputRow symbol="d" label={x.dChosen} value={chosenMm} min={0} max={2000} step={10} digits={0} unit="mm" onChange={setChosenMm} tint={C.critical} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pTertanam, apply: () => { setV(2); setS(SEDIMENT_S); setCis(ISBASH_EMBEDDED); setChosenMm(0); } },
                  { label: x.pMenonjol, apply: () => { setV(2); setS(SEDIMENT_S); setCis(ISBASH_EXPOSED); setChosenMm(0); } },
                  { label: x.pDeras, apply: () => { setV(5); setS(SEDIMENT_S); setCis(ISBASH_EMBEDDED); setChosenMm(400); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={!adaPilihan || r.stable ? C.water : undefined} alert={adaPilihan && !r.stable}>
                {adaPilihan ? (r.stable ? x.mantap : x.goyah) : `${fmt(pas.d50 * 1000, 0)} mm`}
              </Flag>
              {!adaPilihan && <Flag tint={C.ink2}>{x.belumPilih}</Flag>}
            </div>
            {adaPilihan && !r.stable && (
              <div className="mb-2.5">
                <Note>{x.goyahNote}</Note>
              </div>
            )}
            {!adaPilihan && (
              <div className="mb-2.5">
                <Note>{x.belumPilihNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "d50", label: x.rD50, value: fmt(pas.d50, 4), unit: "m", tint: C.critical, strong: true },
                { symbol: "m", label: x.rMassa, value: fmt(r.stoneMass, 2), unit: "kg", strong: true },
                { symbol: "t", label: x.rTebal, value: fmt(r.layerThickness, 3), unit: "m" },
                { symbol: "Vc", label: x.rVtahan, value: fmt(r.capacityVelocity, 3), unit: "m/s", tint: C.water },
                { symbol: "V/Vc", label: x.rPakai, value: fmt(r.utilisation, 3), tint: r.utilisation > 1 ? C.signal : undefined },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(V, s, Cis, pas.d50, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksRiprap(V, s, Cis, chosen)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>d₅₀ =</span>
                <Frac num="V²" den="2 g C² (s − 1)" />
                <span className="ml-5">m = s ρ</span>
                <Frac num="π" den="6" />
                <span>d₅₀³</span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `C ${fmtPlain(ISBASH_EMBEDDED, 1)} untuk batu tertanam rapat, ${fmtPlain(ISBASH_EXPOSED, 2)} untuk batu yang menonjol sendirian`
                    : `C ${fmtPlain(ISBASH_EMBEDDED, 1)} for tightly embedded stone, ${fmtPlain(ISBASH_EXPOSED, 2)} for stone standing proud`}
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
  V: number,
  s: number,
  Cis: number,
  d50: number,
  lang: Lang
): string {
  const dua = riprapSize(V * 2, s, Cis);
  const menonjol = riprapSize(V, s, ISBASH_EXPOSED);
  const pas = riprapSize(V, s, Cis);

  if (lang === "en")
    return `At ${fmt(V, 2)} m/s the stone must be ${fmt(d50 * 1000, 0)} mm and weighs ${fmt(pas.stoneMass, 1)} kg. Double the velocity and it becomes ${fmt(dua.d50 * 1000, 0)} mm weighing ${fmt(dua.stoneMass, 0)} kg: ${fmt(dua.stoneMass / Math.max(pas.stoneMass, 1e-9), 0)} times the mass for twice the speed. Now set the Isbash constant to the exposed value and the same flow demands ${fmt(menonjol.d50 * 1000, 0)} mm instead. The flow did not change; only how well the stone is held by its neighbours did.`;
  return `Pada ${fmt(V, 2)} m/s batunya harus ${fmt(d50 * 1000, 0)} mm dan beratnya ${fmt(pas.stoneMass, 1)} kg. Lipatduakan kecepatannya dan ia menjadi ${fmt(dua.d50 * 1000, 0)} mm seberat ${fmt(dua.stoneMass, 0)} kg: ${fmt(dua.stoneMass / Math.max(pas.stoneMass, 1e-9), 0)} kali massanya untuk dua kali lajunya. Sekarang setel tetapan Isbash ke nilai batu menonjol, dan aliran yang sama menuntut ${fmt(menonjol.d50 * 1000, 0)} mm. Alirannya tidak berubah; yang berubah hanya seberapa baik batunya ditahan tetangganya.`;
}
