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
  SEDIMENT_S,
  SHIELDS_PLATEAU,
  fmt,
  fmtPlain,
  fmtSci,
  shieldsCritical,
  shieldsState,
  waterViscosity,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksShields } from "@/lib/checks";

const TXT = {
  id: {
    title: "Kurva Shields",
    sheetTitle: "Kurva Shields — ambang gerak butir dasar",
    dD: "Garis tengah butir",
    dR: "Jari-jari hidrolik atau kedalaman",
    dS: "Kemiringan dasar",
    dRho: "Rapat massa jenis butir terhadap air",
    dT: "Suhu air",
    pPasir: "Pasir sedang di saluran datar",
    pKerikil: "Kerikil di sungai pegunungan",
    pLanau: "Lanau halus di waduk",
    rTheta: "Tegangan geser tak berdimensi",
    rThetaCr: "Ambangnya pada ukuran butir ini",
    rTau: "Tegangan geser dasar",
    rTauCr: "Tegangan yang baru menggerakkan",
    rDstar: "Ukuran butir tak berdimensi",
    rRcr: "Kedalaman yang baru menggerakkan",
    rCadangan: "Perbandingan terhadap ambang",
    bergerak: "Butir bergerak",
    diam: "Butir diam",
    halus: "Butir sehalus ini tidak lagi lepas satu per satu",
    halusNote:
      "Di bawah kira-kira 0,06 mm butirnya masuk golongan lanau dan lempung, dan yang menahannya di dasar bukan lagi beratnya sendiri melainkan gaya tarik antar butir. Kurva Shields diturunkan untuk butir yang lepas, jadi ambang yang ditampilkan di sini tidak berlaku: lempung padat dapat bertahan pada tegangan berkali lipat dari yang diramalkan, sedangkan lumpur yang baru mengendap justru lepas jauh lebih awal. Yang menentukan di daerah ini sejarah pengendapannya, bukan ukuran butirnya.",
    note:
      "Sumbu mendatar lembar ini sengaja bukan bilangan Reynolds butir seperti pada kurva Shields aslinya. Bentuk asli itu memuat kecepatan gesek di kedua sumbunya, sehingga memakainya menuntut menebak dulu jawabannya lalu mengulang sampai cocok; itulah sebabnya kurva aslinya selalu disertai keluarga garis bantu yang membuat halamannya penuh. Ukuran butir tak berdimensi menyingkirkan masalah itu sama sekali karena ia hanya memuat besaran yang sudah diketahui sejak awal: ukuran butir, rapat massanya, dan kekentalan airnya. Titik kerja karena itu dapat diletakkan langsung tanpa iterasi, dan pembacaannya menjadi satu langkah. Yang perlu diingat, kurva ini menyatakan ambang gerak butir tunggal di dasar yang rata, bukan laju angkutan; di atas ambang ia tidak mengatakan berapa banyak yang terangkut, hanya bahwa angkutannya sudah dimulai.",
  },
  en: {
    title: "Shields curve",
    sheetTitle: "Shields curve — threshold of motion for bed grains",
    dD: "Grain diameter",
    dR: "Hydraulic radius or depth",
    dS: "Bed slope",
    dRho: "Grain density relative to water",
    dT: "Water temperature",
    pPasir: "Medium sand in a flat channel",
    pKerikil: "Gravel in a mountain river",
    pLanau: "Fine silt in a reservoir",
    rTheta: "Dimensionless shear stress",
    rThetaCr: "Its threshold at this grain size",
    rTau: "Bed shear stress",
    rTauCr: "Stress that just starts motion",
    rDstar: "Dimensionless grain size",
    rRcr: "Depth that just starts motion",
    rCadangan: "Ratio to the threshold",
    bergerak: "Grain moves",
    diam: "Grain at rest",
    halus: "Grains this fine no longer come loose one by one",
    halusNote:
      "Below about 0.06 mm the grains fall into the silt and clay class, and what holds them on the bed is no longer their own weight but cohesion between grains. The Shields curve was derived for loose grains, so the threshold shown here does not apply: firm clay can survive stresses many times the predicted value, while freshly settled mud comes loose far earlier. What decides in this region is the deposition history, not the grain size.",
    note:
      "The horizontal axis of this sheet is deliberately not the grain Reynolds number of the original Shields curve. That original form carries the friction velocity on both axes, so using it means guessing the answer first and iterating until it fits; that is why the original is always printed with a family of guide lines that crowd the page. The dimensionless grain size removes the problem entirely, because it contains only quantities known from the start: grain size, density, and the viscosity of the water. The operating point can therefore be placed directly without iteration, and reading it becomes a single step. Keep in mind that this curve states the threshold of motion for a single grain on a flat bed, not a transport rate; above the threshold it does not say how much moves, only that movement has begun.",
  },
} as const;

const REFS = {
  id: [
    "Shields, A. (1936). Anwendung der Ähnlichkeitsmechanik und der Turbulenzforschung auf die Geschiebebewegung. Mitteilungen der Preussischen Versuchsanstalt für Wasserbau 26.",
    "Soulsby, R.L. & Whitehouse, R.J.S. (1997). Threshold of sediment motion in coastal environments. Pacific Coasts and Ports Conference.",
    "Van Rijn, L.C. (1993). Principles of Sediment Transport in Rivers, Estuaries and Coastal Seas. Aqua Publications, Bab 4.",
    "Buffington, J.M. & Montgomery, D.R. (1997). A systematic analysis of eight decades of incipient motion studies. Water Resources Research, vol. 33.",
  ],
  en: [
    "Shields, A. (1936). Anwendung der Ähnlichkeitsmechanik und der Turbulenzforschung auf die Geschiebebewegung. Mitteilungen der Preussischen Versuchsanstalt für Wasserbau 26.",
    "Soulsby, R.L. & Whitehouse, R.J.S. (1997). Threshold of sediment motion in coastal environments. Pacific Coasts and Ports Conference.",
    "Van Rijn, L.C. (1993). Principles of Sediment Transport in Rivers, Estuaries and Coastal Seas. Aqua Publications, Chapter 4.",
    "Buffington, J.M. & Montgomery, D.R. (1997). A systematic analysis of eight decades of incipient motion studies. Water Resources Research, vol. 33.",
  ],
} as const;

const DSTAR_MIN = 0.3;
const DSTAR_MAX = 3000;
/** Batas bawah butir lepas; di bawahnya gaya tarik antar butir menguasai. */
const D_KOHESIF = 0.00006;

export function KurvaShieldsClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [dMm, setDMm] = useState(20);
  const [R, setR] = useState(1);
  const [S, setS] = useState(0.001);
  const [s, setS_] = useState(SEDIMENT_S);
  const [suhu, setSuhu] = useState(15);

  const nu = waterViscosity(suhu);
  const d = dMm / 1000;
  const r = shieldsState(R, S, d, s, nu);
  const kohesif = d < D_KOHESIF;
  const cadangan = r.thetaCritical > 0 ? r.theta / r.thetaCritical : 0;

  /*
   * Tegangan geser tak berdimensi membentang dari sepersejuta sampai ratusan
   * di dalam rentang penggeser lembar ini. Jumlah desimal yang tetap
   * menuliskan ujung bawahnya sebagai "0,0000", yaitu angka nol untuk besaran
   * yang bukan nol, dan pengumuman titik di luar diagram menjadi tidak
   * berguna karena ia mengumumkan angka nol. Yang kecil ditulis berpangkat.
   */
  const fTheta = (v: number) => (v > 0 && v < 1e-3 ? fmtSci(v) : fmt(v, 4));

  const ref = useCanvas(
    (ctx, w, h) => {
      const ambang: { x: number; y: number }[] = [];
      for (let lg = Math.log10(DSTAR_MIN); lg <= Math.log10(DSTAR_MAX) + 1e-9; lg += 0.02) {
        const D = Math.pow(10, lg);
        ambang.push({ x: D, y: shieldsCritical(D) });
      }

      const deret: ChartSeries[] = [
        {
          pts: ambang,
          color: C.critical,
          weight: W.bold,
          label: T.thresholdCurve,
          labelAt: 0.62,
          labelDy: -12,
        },
      ];

      drawChart(
        ctx,
        w,
        h,
        {
          xMin: DSTAR_MIN,
          xMax: DSTAR_MAX,
          yMin: 0.01,
          yMax: 3,
          xLog: true,
          yLog: true,
          axisX: T.axGrainSize,
          axisY: T.axShields,
          series: deret,
          rules: [
            {
              axis: "y",
              at: SHIELDS_PLATEAU,
              color: C.ink3,
              dash: DASH.phantom,
              label: `θ ${fmtPlain(SHIELDS_PLATEAU, 3)}`,
              labelAlign: "right",
            },
          ],
          regions: [
            /* Ungu, warna keadaan kritis, sama dengan kurva ambangnya.
               Bukan merah sinyal: butir yang bergerak adalah keadaan yang
               sah, bukan keadaan di luar rentang berlakunya rumus. */
            { x: 3, y: 1.5, text: T.grainMoves, color: C.critical },
            { x: 400, y: 0.014, text: T.grainRests, color: C.ink3 },
          ],
          point: {
            x: r.dStar,
            y: r.theta,
            label: `θ ${fTheta(r.theta)}`,
            invalid: kohesif,
          },
          heading: kohesif ? T.noLawHere : undefined,
          headingColor: C.signal,
        },
        lang
      );
    },
    [dMm, R, S, s, suhu, lang]
  );

  return (
    <LabShell
      sheet="SD-01"
      subject={SUBJECTS.SD[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Satu butir di dasar sungai bertahan selama{" "}
            <Term tint={C.critical}>beratnya</Term> masih melebihi{" "}
            <Term tint={C.signal}>seretan aliran</Term>. Perbandingan keduanya
            tidak bersatuan, dan itulah yang membuat satu kurva berlaku untuk
            pasir maupun bongkah.
          </p>
        ) : (
          <p>
            A grain on a river bed holds while its{" "}
            <Term tint={C.critical}>weight</Term> still exceeds the{" "}
            <Term tint={C.signal}>drag of the flow</Term>. The ratio of the two
            has no units, and that is what lets one curve serve both sand and
            boulders.
          </p>
        )
      }
      drawing={
        <Sheet
          number="SD-01"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, Pa)" },
            { label: "d", value: `${fmt(dMm, 2)} mm`, tint: kohesif ? C.signal : undefined },
            { label: "D*", value: fmt(r.dStar, 1) },
            { label: "θ", value: fTheta(r.theta), tint: kohesif ? C.signal : C.critical },
            { label: "θcr", value: fmt(r.thetaCritical, 4), tint: C.critical },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="d" label={x.dD} value={dMm} min={0.004} max={300} step={0.002} digits={3} unit="mm" onChange={setDMm} tint={C.critical} />
              <InputRow symbol="R" label={x.dR} value={R} min={0.02} max={10} step={0.02} digits={2} unit="m" onChange={setR} tint={C.water} />
              <InputRow symbol="S" label={x.dS} value={S * 1000} min={0.02} max={60} step={0.02} digits={2} unit="‰" onChange={(v) => setS(v / 1000)} />
              <InputRow symbol="s" label={x.dRho} value={s} min={1.05} max={4} step={0.05} digits={2} onChange={setS_} />
              <InputRow symbol="T" label={x.dT} value={suhu} min={4} max={40} step={0.5} digits={1} unit="°C" onChange={setSuhu} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pPasir, apply: () => { setDMm(0.5); setR(1); setS(0.001); setS_(SEDIMENT_S); setSuhu(15); } },
                  { label: x.pKerikil, apply: () => { setDMm(40); setR(0.8); setS(0.02); setS_(SEDIMENT_S); setSuhu(15); } },
                  { label: x.pLanau, apply: () => { setDMm(0.02); setR(3); setS(0.00005); setS_(SEDIMENT_S); setSuhu(15); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              {/* Merah sinyal disimpan untuk satu penanda saja di lembar ini,
                  yaitu butir kohesif yang membuat kurva Shields tidak berlaku.
                  Butir yang bergerak adalah keadaan yang sah dan diberi warna
                  ungu, sama dengan kurva ambangnya. */}
              <Flag tint={r.moving ? C.critical : C.water}>
                {r.moving ? x.bergerak : x.diam}
              </Flag>
              {kohesif && <Flag alert>{x.halus}</Flag>}
            </div>
            {kohesif && (
              <div className="mb-2.5">
                <Note>{x.halusNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "τ", label: x.rTau, value: fmt(r.tau, 3), unit: "Pa", tint: C.signal, strong: true },
                { symbol: "τcr", label: x.rTauCr, value: fmt(r.tauCritical, 3), unit: "Pa", tint: C.critical, strong: true },
                { symbol: "θ", label: x.rTheta, value: fTheta(r.theta), tint: kohesif ? C.signal : C.critical },
                { symbol: "θcr", label: x.rThetaCr, value: fmt(r.thetaCritical, 5), tint: C.critical },
                { symbol: "D*", label: x.rDstar, value: fmt(r.dStar, 2) },
                { symbol: "Rcr", label: x.rRcr, value: Number.isFinite(r.RCritical) ? fmt(r.RCritical, 3) : "—", unit: Number.isFinite(r.RCritical) ? "m" : undefined, tint: C.water },
                {
                  symbol: "τ/τcr",
                  label: x.rCadangan,
                  value: cadangan > 0 && cadangan < 1e-3 ? fmtSci(cadangan) : fmt(cadangan, 3),
                  tint: r.moving ? C.critical : undefined,
                },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(r.dStar, r.thetaCritical, cadangan, r.RCritical, kohesif, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksShields(R, S, d, s, nu)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>θ =</span>
                <Frac num="τ" den="(s − 1) ρ g d" />
                <span className="ml-6">τ = ρ g R S</span>
              </Eq>
              <Eq>
                <span>D* = d</span>
                <span className="ml-1">[</span>
                <Frac num="(s − 1) g" den="ν²" />
                <span>]^(1/3)</span>
              </Eq>
              <Eq>
                <span>θcr =</span>
                <Frac num="0,30" den="1 + 1,2 D*" />
                <span>+ 0,055 [ 1 − e^(−0,02 D*) ]</span>
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
  dStar: number,
  thetaCr: number,
  cadangan: number,
  Rcr: number,
  kohesif: boolean,
  lang: Lang
): string {
  if (kohesif) {
    return lang === "id"
      ? "Pada butir sehalus ini kurvanya tidak lagi menjawab pertanyaannya. Perbesar butirnya melewati 0,06 mm, dan ambang yang digambar kembali berarti."
      : "At grains this fine the curve no longer answers the question. Raise the grain size past 0.06 mm and the threshold drawn becomes meaningful again.";
  }

  if (lang === "en")
    return `The threshold here is ${fmtPlain(thetaCr, 4)}, against the coarse-grain plateau of ${fmtPlain(SHIELDS_PLATEAU, 3)}, and the flow sits at ${fmt(cadangan, 2)} times that threshold. Notice what the curve does at its left end: fine grains need a *larger* dimensionless stress, not a smaller one, because they hide inside the viscous sublayer where the flow barely reaches them. That upturn is the part of the diagram that surprises people, and it is why a bed of fine sand can be harder to start than one of coarse sand. The depth that would just start motion at this slope is ${Number.isFinite(Rcr) ? `${fmt(Rcr, 3)} m` : "unbounded, because the slope is zero"}.`;
  return `Ambangnya di sini ${fmtPlain(thetaCr, 4)}, berbanding dataran butir kasar ${fmtPlain(SHIELDS_PLATEAU, 3)}, dan alirannya berada pada ${fmt(cadangan, 2)} kali ambang itu. Perhatikan apa yang dilakukan kurvanya di ujung kiri: butir halus justru menuntut tegangan tak berdimensi yang LEBIH BESAR, bukan lebih kecil, karena ia bersembunyi di dalam lapisan kental tempat aliran hampir tidak menjangkaunya. Kenaikan di ujung kiri itulah bagian diagram yang paling mengejutkan orang, dan itu sebabnya dasar berpasir halus dapat lebih sulit digerakkan daripada dasar berpasir kasar. Kedalaman yang baru menggerakkan butir pada kemiringan ini ${Number.isFinite(Rcr) ? `${fmt(Rcr, 3)} m` : "tidak terhingga, karena kemiringannya nol"}.`;
}
