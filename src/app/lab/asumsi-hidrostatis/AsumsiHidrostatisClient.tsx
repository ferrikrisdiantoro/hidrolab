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
import { drawField, type FieldDim, type FieldLine } from "@/lib/drawField";
import {
  HYDROSTATIC_TOLERANCE,
  curvaturePressure,
  fmt,
  fmtPlain,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksCurvature } from "@/lib/checks";

const TXT = {
  id: {
    title: "Asumsi hidrostatis",
    sheetTitle: "Sebaran tekanan pada penampang bergaris arus melengkung",
    dV: "Kecepatan rata-rata",
    dD: "Kedalaman aliran",
    dR: "Jari-jari lengkung garis arus",
    lengkung: "Arah lengkung",
    cembung: "Cembung ke atas, seperti di atas mercu",
    cekung: "Cekung ke atas, seperti di kaki pelimpah",
    pLurus: "Garis arus hampir lurus",
    pMercu: "Di atas mercu pelimpah",
    pLepas: "Mercu terlalu tajam, air terangkat",
    rHid: "Tekanan dasar bila dianggap hidrostatis",
    rSim: "Simpangan akibat kelengkungan",
    rAkt: "Tekanan dasar yang sebenarnya",
    rNis: "Simpangan nisbi terhadap hidrostatisnya",
    rBil: "Bilangan kelengkungan V² per gR",
    boleh: "Anggapan hidrostatis masih boleh dipakai",
    tidak: "Anggapan hidrostatis sudah tidak berlaku",
    lepas: "Tekanan dasar habis, airnya terangkat",
    lepasNote:
      "Tekanan di dasar sudah turun sampai nol atau lebih rendah, dan air tidak dapat menarik. Yang terjadi bukan tekanan negatif melainkan air yang lepas dari permukaannya: tirainya terangkat, rongga terbentuk di bawahnya, dan tekanan di rongga itu ditentukan udara yang dapat masuk ke sana, bukan lagi oleh alirannya. Pada mercu pelimpah keadaan ini dihindari bukan karena airnya berhenti mengalir, melainkan karena rongga yang tidak berudara akan berdenyut dan menggetarkan seluruh bangunannya.",
    note:
      "Hampir seluruh hidraulika saluran terbuka berdiri di atas satu anggapan yang jarang disebut, yaitu bahwa tekanan bertambah lurus terhadap kedalaman seperti pada air yang diam. Anggapan itu menuntut garis arusnya lurus dan sejajar, dan ia benar pada hampir seluruh panjang sungai. Yang perlu diketahui adalah di mana ia berhenti benar. Begitu garis arusnya melengkung, percepatan menuju pusat lengkungnya harus disediakan oleh selisih tekanan, dan simpangannya terhadap hidrostatis sebesar rho V kuadrat d dibagi R. Dibagi tekanan hidrostatisnya sendiri, kedalamannya lenyap dari perbandingan dan yang tersisa hanya V kuadrat dibagi gR. Satu bilangan, dan seluruh keputusan bergantung padanya. Di atas mercu pelimpah garis arusnya cembung ke atas, jadi tekanan dasarnya lebih kecil daripada hidrostatis, dan pada mercu yang tajam ia dapat habis sama sekali. Di kaki pelimpah keadaannya terbalik: tekanannya lebih besar, dan justru kelebihan itulah yang menuntut lantai kolam olakan setebal yang biasa kita lihat. Dua tempat pada satu bangunan yang sama, dengan dua kesimpulan yang berlawanan, dan keduanya tidak akan pernah muncul dari perhitungan yang memakai anggapan hidrostatis di mana-mana.",
  },
  en: {
    title: "Hydrostatic assumption",
    sheetTitle: "Pressure distribution on a section with curved streamlines",
    dV: "Mean velocity",
    dD: "Flow depth",
    dR: "Radius of streamline curvature",
    lengkung: "Direction of curvature",
    cembung: "Convex upward, as over a crest",
    cekung: "Concave upward, as at a spillway toe",
    pLurus: "Nearly straight streamlines",
    pMercu: "Over a spillway crest",
    pLepas: "Crest too sharp, the water lifts off",
    rHid: "Bed pressure if taken as hydrostatic",
    rSim: "Departure caused by curvature",
    rAkt: "Actual bed pressure",
    rNis: "Relative departure from hydrostatic",
    rBil: "Curvature number V² over gR",
    boleh: "The hydrostatic assumption still holds",
    tidak: "The hydrostatic assumption no longer holds",
    lepas: "The bed pressure is gone, the water lifts off",
    lepasNote:
      "The bed pressure has fallen to zero or below, and water cannot pull. What happens is not a negative pressure but water leaving its surface: the nappe lifts, a cavity forms beneath it, and the pressure in that cavity is set by whatever air can reach it rather than by the flow. On a spillway crest this state is avoided not because the water stops flowing, but because an unvented cavity pulses and shakes the whole structure.",
    note:
      "Almost the whole of open-channel hydraulics rests on one assumption that is rarely named, namely that pressure grows linearly with depth as it does in standing water. That assumption demands straight, parallel streamlines, and it holds along nearly the whole length of a river. What needs to be known is where it stops holding. As soon as the streamlines curve, the acceleration toward their centre of curvature must be supplied by a pressure difference, and the departure from hydrostatic is rho V squared d over R. Divided by the hydrostatic pressure itself, the depth vanishes from the ratio and what remains is V squared over gR alone. One number, and every decision hangs on it. Over a spillway crest the streamlines are convex upward, so the bed pressure is smaller than hydrostatic, and on a sharp crest it can vanish entirely. At the spillway toe the case reverses: the pressure is larger, and it is exactly that excess which demands a stilling-basin floor of the thickness we are used to seeing. Two places on one structure, with opposite conclusions, and neither will ever emerge from a calculation that assumes hydrostatic everywhere.",
  },
} as const;

const REFS = {
  id: [
    "Rouse, H. (1946). Elementary Mechanics of Fluids, bab 4.",
    "Chow, V.T. (1959). Open-Channel Hydraulics, bab 1.",
    "Montes, J.S. (1998). Hydraulics of Open Channel Flow, bab 6.",
    "Hager, W.H. (2010). Wastewater Hydraulics, edisi ke-2, bab 2.",
  ],
  en: [
    "Rouse, H. (1946). Elementary Mechanics of Fluids, ch. 4.",
    "Chow, V.T. (1959). Open-Channel Hydraulics, ch. 1.",
    "Montes, J.S. (1998). Hydraulics of Open Channel Flow, ch. 6.",
    "Hager, W.H. (2010). Wastewater Hydraulics, 2nd ed., ch. 2.",
  ],
} as const;

export function AsumsiHidrostatisClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [V, setV] = useState(3);
  const [d, setD] = useState(1);
  const [R, setR] = useState(6);
  /* Nol berarti cembung ke atas, satu berarti cekung ke atas. */
  const [arah, setArah] = useState(0);

  const jari = arah === 0 ? R : -R;
  const r = curvaturePressure(V, d, jari);

  const ref = useCanvas(
    (ctx, w, ch) => {
      /*
       * Sumbu datarnya tekanan dan sumbu tegaknya tinggi di atas dasar, jadi
       * kedua sumbunya BUKAN ruang yang sama dan skalanya memang dibedakan.
       * Keduanya lurus karena simpangannya sendiri berbanding lurus dengan
       * jarak dari muka air, sama seperti hidrostatisnya.
       */
      const garis: FieldLine[] = [
        {
          pts: [
            { x: r.hydrostatic, y: 0 },
            { x: 0, y: d },
          ],
          color: C.ink2,
          weight: W.thin,
          dash: DASH.hidden,
          label: T.hydrostaticLine,
          labelAt: 0.5,
          labelDy: -10,
          labelAlign: "center",
        },
        {
          pts: [
            { x: r.actual, y: 0 },
            { x: 0, y: d },
          ],
          color: r.liftsOff ? C.signal : C.water,
          weight: W.bold,
          dash: DASH.solid,
          label: T.actualPressure,
          labelAt: 0.5,
          labelDy: 16,
          labelAlign: "center",
        },
        {
          /* Muka air dan dasar, sebagai dua batas bidangnya. */
          pts: [
            { x: 0, y: d },
            { x: Math.max(r.hydrostatic, r.actual) * 1.1, y: d },
          ],
          color: C.ink3,
          weight: W.hair,
          dash: DASH.axis,
          label: T.waterGrade,
          labelAt: 0.96,
          labelDy: -9,
          labelAlign: "right",
        },
      ];

      const dims: FieldDim[] = [
        {
          axis: "h",
          at: 0,
          from: Math.min(r.actual, r.hydrostatic),
          to: Math.max(r.actual, r.hydrostatic),
          text: `${fmtPlain(Math.abs(r.deviation), 2)} kPa`,
          color: r.liftsOff ? C.signal : C.critical,
          offset: 26,
        },
      ];

      const pMax = Math.max(r.hydrostatic, r.actual, 1) * 1.18;
      const pMin = Math.min(0, r.actual) * 1.18;
      drawField(
        ctx,
        w,
        ch,
        {
          xMin: pMin,
          xMax: pMax,
          yMin: 0,
          yMax: d * 1.2,
          equalScale: false,
          lines: garis,
          dims,
          regions: [
            {
              x: pMax * 0.62,
              y: d * 0.86,
              text: r.convex ? x.cembung : x.cekung,
              color: C.ink2,
            },
          ],
          heading: r.liftsOff
            ? x.lepas
            : r.hydrostaticValid
              ? undefined
              : x.tidak,
          headingColor: r.liftsOff ? C.signal : C.critical,
          axisX: T.axPressureKpa,
          axisY: T.axHeightAboveBed,
        },
        lang
      );
    },
    [V, d, R, arah, lang]
  );

  return (
    <LabShell
      sheet="FF-04"
      subject={SUBJECTS.FF[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Satu bilangan menentukan seluruhnya:{" "}
            <Term tint={C.critical}>V² dibagi gR</Term>. Kedalamannya lenyap
            dari perbandingan, jadi yang menentukan hanya kecepatan dan
            kelengkungannya.
          </p>
        ) : (
          <p>
            One number decides it all:{" "}
            <Term tint={C.critical}>V² over gR</Term>. The depth vanishes from
            the ratio, so only the velocity and the curvature count.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FF-04"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (kPa, m, m/s)" },
            { label: "V²/gR", value: fmt(r.curvatureNumber, 3), tint: C.critical },
            { label: "p₀", value: `${fmt(r.hydrostatic, 1)} kPa` },
            {
              label: "p",
              value: `${fmt(r.actual, 1)} kPa`,
              tint: r.liftsOff ? C.signal : C.water,
            },
            { label: "Δ/p₀", value: `${fmt(r.ratio * 100, 1)} %` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="V" label={x.dV} value={V} min={0.1} max={15} step={0.1} digits={1} unit="m/s" onChange={setV} tint={C.water} />
              <InputRow symbol="d" label={x.dD} value={d} min={0.05} max={8} step={0.05} digits={2} unit="m" onChange={setD} />
              <InputRow symbol="R" label={x.dR} value={R} min={0.2} max={200} step={0.2} digits={1} unit="m" onChange={setR} tint={C.critical} />
            </InputTable>

            <div className="mt-3.5 flex flex-col gap-2">
              <PresetRow
                label={x.lengkung}
                active={arah}
                presets={[
                  { label: x.cembung, apply: () => setArah(0) },
                  { label: x.cekung, apply: () => setArah(1) },
                ]}
              />
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pLurus, apply: () => { setV(1.5); setD(1.5); setR(200); setArah(0); } },
                  { label: x.pMercu, apply: () => { setV(4); setD(0.9); setR(3); setArah(0); } },
                  { label: x.pLepas, apply: () => { setV(6); setD(0.8); setR(0.8); setArah(0); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5">
              <Flag
                tint={r.hydrostaticValid ? C.water : C.critical}
                alert={r.liftsOff}
              >
                {r.liftsOff ? x.lepas : r.hydrostaticValid ? x.boleh : x.tidak}
              </Flag>
            </div>
            {r.liftsOff && (
              <div className="mb-2.5">
                <Note>{x.lepasNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "p₀", label: x.rHid, value: fmt(r.hydrostatic, 2), unit: "kPa" },
                { symbol: "Δp", label: x.rSim, value: fmt(r.deviation, 2), unit: "kPa", tint: C.critical, strong: true },
                { symbol: "p", label: x.rAkt, value: fmt(r.actual, 2), unit: "kPa", tint: r.liftsOff ? C.signal : C.water, strong: true },
                { symbol: "Δ/p₀", label: x.rNis, value: fmt(r.ratio * 100, 2), unit: "%" },
                { symbol: "V²/gR", label: x.rBil, value: fmt(r.curvatureNumber, 4), strong: true },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(V, d, R, arah, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksCurvature(V, d, jari)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Δp =</span>
                <Frac num="ρ V² d" den="R" />
                <span className="ml-5">p = ρgd + Δp</span>
              </Eq>
              <Eq>
                <Frac num="Δp" den="ρgd" />
                <span>=</span>
                <Frac num="V²" den="gR" />
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? `kedalamannya lenyap; batas yang lazim diabaikan ${fmtPlain(HYDROSTATIC_TOLERANCE * 100, 0)} persen`
                    : `the depth vanishes; the usual threshold for ignoring it is ${fmtPlain(HYDROSTATIC_TOLERANCE * 100, 0)} per cent`}
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

function notice(V: number, d: number, R: number, arah: number, lang: Lang) {
  const jari = arah === 0 ? R : -R;
  const a = curvaturePressure(V, d, jari);
  const dalam = curvaturePressure(V, d * 3, jari);
  const cepat = curvaturePressure(V * 2, d, jari);

  if (lang === "en")
    return `The departure here is ${fmt(a.ratio * 100, 1)} per cent of the hydrostatic pressure. Make the flow three times as deep and it stays ${fmt(dalam.ratio * 100, 1)} per cent: the depth cancels, so a deep river and a shallow one with the same velocity and the same curvature depart by exactly the same fraction. Double the velocity instead and it becomes ${fmt(cepat.ratio * 100, 1)} per cent, four times over, because the departure follows the square of the velocity. That is why the assumption survives long rivers, which are slow and barely curved, and fails on spillways, which are neither.`;
  return `Simpangannya di sini ${fmt(a.ratio * 100, 1)} persen tekanan hidrostatisnya. Buat alirannya tiga kali lebih dalam dan ia tetap ${fmt(dalam.ratio * 100, 1)} persen: kedalamannya saling menghapus, jadi sungai yang dalam dan yang dangkal dengan kecepatan dan kelengkungan yang sama menyimpang sebanyak yang sama persis. Lipatduakan kecepatannya dan ia menjadi ${fmt(cepat.ratio * 100, 1)} persen, empat kali lipat, karena simpangannya mengikuti kuadrat kecepatan. Itulah sebabnya anggapan ini bertahan di sungai panjang, yang lambat dan hampir tidak melengkung, dan gugur di pelimpah, yang bukan keduanya.`;
}
