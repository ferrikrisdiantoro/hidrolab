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
  fmt,
  fmtPlain,
  floodHydrograph,
  scsPeakRate,
  scsStorage,
  scsUnitHydrograph,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksHydrograph } from "@/lib/checks";

const TXT = {
  id: {
    title: "Hidrograf banjir",
    sheetTitle: "Hidrograf banjir SCS — dari hujan daerah aliran menjadi debit sungai",
    dP: "Hujan total",
    dDur: "Lama hujan",
    dCN: "Bilangan kurva",
    dA: "Luas daerah aliran",
    dTc: "Waktu tempuh terpanjang",
    pSawah: "Daerah persawahan, hujan sedang",
    pKota: "Daerah terbangun, hujan lebat",
    pHutan: "Daerah berhutan, hujan panjang",
    rPeak: "Debit puncak",
    rPeakTime: "Waktu puncak",
    rPe: "Hujan efektif",
    rLoss: "Hujan yang hilang",
    rS: "Simpanan maksimum",
    rTp: "Waktu naik hidrograf satuan",
    rQp: "Puncak hidrograf satuan",
    rVol: "Isi hidrograf",
    rDepth: "Kedalaman limpasan",
    pendek: "Hujan lebih pendek daripada tanggapan",
    pendekNote:
      "Lama hujannya kurang dari seperlima waktu naik hidrograf satuan. Pada keadaan itu pembagian hujan menjadi pias sejam yang dipakai lembar ini sudah terlalu kasar: seluruh hujan jatuh ke dalam satu pias, dan bentuk hidrografnya menjadi bentuk hidrograf satuan itu sendiri, bukan hasil penjumlahan beberapa pias. Puncaknya masih masuk akal sebagai taksiran, tetapi bentuk sisi naiknya tidak. Perpanjang hujannya, atau pakai daerah aliran yang waktu tempuhnya lebih pendek.",
    note:
      "Dua andaian besar berdiri di balik lembar ini, dan keduanya perlu dilihat jelas sebelum angkanya dipakai. Pertama, bilangan kurva menyatukan jenis tanah, tutupan lahan, dan kelembapan sebelumnya ke dalam satu angka antara 30 dan 100. Angka itu tidak punya makna fisis tersendiri; ia pengenal baris pada tabel yang disusun dari ribuan petak percobaan di Amerika Serikat pada pertengahan abad lalu, dan memindahkannya ke daerah tropis adalah langkah yang harus dibenarkan, bukan diandaikan. Kedua, hidrograf satuan mengandaikan tanggapan daerah aliran itu linear: hujan dua kali lipat memberi debit dua kali lipat, dan hidrograf dari beberapa pias hujan boleh dijumlahkan begitu saja. Andaian itu cukup baik untuk banjir sedang dan meleset pada banjir besar, tempat jalur aliran berubah karena limpasannya sendiri. Yang tetap berlaku apa pun andaiannya adalah kekekalan isi: luas di bawah hidrograf harus sama dengan hujan efektif dikali luas daerah aliran, dan pemeriksaan di bawah menguji justru hal itu.",
  },
  en: {
    title: "Flood hydrograph",
    sheetTitle: "SCS flood hydrograph — from catchment rainfall to river discharge",
    dP: "Total rainfall",
    dDur: "Rain duration",
    dCN: "Curve number",
    dA: "Catchment area",
    dTc: "Time of concentration",
    pSawah: "Paddy landscape, moderate rain",
    pKota: "Built-up area, heavy rain",
    pHutan: "Forested catchment, long rain",
    rPeak: "Peak discharge",
    rPeakTime: "Time to peak",
    rPe: "Effective rainfall",
    rLoss: "Rainfall lost",
    rS: "Maximum storage",
    rTp: "Unit hydrograph time to peak",
    rQp: "Unit hydrograph peak",
    rVol: "Hydrograph volume",
    rDepth: "Runoff depth",
    pendek: "Rain shorter than the response",
    pendekNote:
      "The rain lasts less than one fifth of the unit hydrograph time to peak. At that point the one-hour rainfall blocks used on this sheet are too coarse: all the rain falls into a single block, and the hydrograph shape becomes the unit hydrograph itself rather than a sum of several blocks. The peak is still reasonable as an estimate, but the shape of its rising limb is not. Lengthen the rain, or use a catchment with a shorter time of concentration.",
    note:
      "Two large assumptions stand behind this sheet, and both deserve a clear look before the numbers are used. First, the curve number folds soil type, land cover, and antecedent moisture into a single value between 30 and 100. That value has no physical meaning of its own; it is a row identifier in a table assembled from thousands of experimental plots in the United States in the middle of the last century, and carrying it into the tropics is a step that must be justified rather than assumed. Second, the unit hydrograph assumes the catchment responds linearly: double the rain gives double the discharge, and hydrographs from several rainfall blocks may simply be added. That assumption serves moderate floods well and fails on large ones, where the flow paths themselves change because of the runoff. What holds regardless of either assumption is conservation of volume: the area under the hydrograph must equal the effective rainfall times the catchment area, and the verification below tests exactly that.",
  },
} as const;

const REFS = {
  id: [
    "USDA NRCS (2004). National Engineering Handbook Bagian 630, Bab 10: Estimation of Direct Runoff from Storm Rainfall.",
    "Chow, V.T., Maidment, D.R. & Mays, L.W. (1988). Applied Hydrology. McGraw-Hill, Bab 7.",
    "Sherman, L.K. (1932). Streamflow from rainfall by the unit-graph method. Engineering News-Record, vol. 108.",
    "Ponce, V.M. & Hawkins, R.H. (1996). Runoff curve number: has it reached maturity? Journal of Hydrologic Engineering, vol. 1.",
  ],
  en: [
    "USDA NRCS (2004). National Engineering Handbook Part 630, Chapter 10: Estimation of Direct Runoff from Storm Rainfall.",
    "Chow, V.T., Maidment, D.R. & Mays, L.W. (1988). Applied Hydrology. McGraw-Hill, Chapter 7.",
    "Sherman, L.K. (1932). Streamflow from rainfall by the unit-graph method. Engineering News-Record, vol. 108.",
    "Ponce, V.M. & Hawkins, R.H. (1996). Runoff curve number: has it reached maturity? Journal of Hydrologic Engineering, vol. 1.",
  ],
} as const;

export function HidrografBanjirClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [P, setP] = useState(80);
  const [dur, setDur] = useState(6);
  const [CN, setCN] = useState(75);
  const [A, setA] = useState(50);
  const [tc, setTc] = useState(4);

  const r = floodHydrograph(P, dur, CN, A, tc);
  const hilang = P - r.effectiveRain;

  const ref = useCanvas(
    (ctx, w, h) => {
      const tMax = r.points[r.points.length - 1].t;
      const qMax = Math.max(r.peak * 1.25, 1e-6);

      // Hidrograf satuan digambar sebagai pembanding, diperbesar supaya
      // bentuknya terbaca pada sumbu yang sama.
      const satuan: { x: number; y: number }[] = [];
      const skala = r.peak > 0 ? (r.peak * 0.35) / Math.max(r.qp, 1e-9) : 0;
      for (let i = 0; i <= 200; i++) {
        const tt = (tMax * i) / 200;
        satuan.push({ x: tt, y: scsUnitHydrograph(tt, r.tp) * r.qp * skala });
      }

      const deret: ChartSeries[] = [
        {
          pts: satuan,
          color: C.ink3,
          weight: W.hair,
          dash: DASH.hidden,
          label: T.unitHydrograph,
          labelAt: 0.25,
          labelDy: -10,
        },
        {
          pts: r.points.map((p) => ({ x: p.t, y: p.Q })),
          color: r.burstTooShort ? C.signal : C.water,
          weight: W.bold,
          dash: r.burstTooShort ? DASH.invalid : DASH.solid,
          fill: C.waterFill,
        },
      ];

      drawChart(
        ctx,
        w,
        h,
        {
          xMin: 0,
          xMax: tMax,
          yMin: 0,
          yMax: qMax,
          axisX: T.axTimeHour,
          axisY: T.axFlowRate,
          series: deret,
          bands: [{ axis: "x", from: 0, to: dur, label: T.rainBurst }],
          point: {
            x: r.peakTime,
            y: r.peak,
            label: `${fmtPlain(r.peak, 1)} m³/s`,
            invalid: r.burstTooShort,
          },
        },
        lang
      );
    },
    [P, dur, CN, A, tc, lang]
  );

  return (
    <LabShell
      sheet="HY-02"
      subject={SUBJECTS.HY[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Hujan yang jatuh merata di daerah aliran tidak sampai ke sungai
            sekaligus. Sebagian <Term tint={C.ink3}>hilang</Term> ke dalam
            tanah, sisanya tiba{" "}
            <Term tint={C.water}>terlambat dan tersebar</Term> menurut jarak
            tempuhnya masing-masing.
          </p>
        ) : (
          <p>
            Rain falling evenly over a catchment does not reach the river all at
            once. Part is <Term tint={C.ink3}>lost</Term> into the ground, and
            the rest arrives{" "}
            <Term tint={C.water}>late and spread out</Term> according to how far
            each part had to travel.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HY-02"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (mm, m³/s)" },
            { label: "P", value: `${fmt(P, 0)} mm` },
            { label: "Pe", value: `${fmt(r.effectiveRain, 1)} mm`, tint: C.water },
            { label: "Qp", value: `${fmt(r.peak, 1)} m³/s`, tint: C.water },
            { label: "tp", value: `${fmt(r.peakTime, 2)} jam`, tint: C.energy },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="P" label={x.dP} value={P} min={5} max={400} step={5} digits={0} unit="mm" onChange={setP} tint={C.water} />
              <InputRow symbol="D" label={x.dDur} value={dur} min={1} max={36} step={1} digits={0} unit="jam" onChange={setDur} />
              <InputRow symbol="CN" label={x.dCN} value={CN} min={30} max={100} step={1} digits={0} onChange={setCN} tint={C.critical} />
              <InputRow symbol="A" label={x.dA} value={A} min={1} max={1000} step={1} digits={0} unit="km²" onChange={setA} />
              <InputRow symbol="tc" label={x.dTc} value={tc} min={0.3} max={24} step={0.1} digits={1} unit="jam" onChange={setTc} tint={C.energy} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pSawah, apply: () => { setP(80); setDur(6); setCN(75); setA(50); setTc(4); } },
                  { label: x.pKota, apply: () => { setP(150); setDur(3); setCN(92); setA(12); setTc(1.2); } },
                  { label: x.pHutan, apply: () => { setP(60); setDur(18); setCN(55); setA(300); setTc(14); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={r.burstTooShort ? undefined : C.water} alert={r.burstTooShort}>
                {`${fmt(r.peak, 1)} m³/s`}
              </Flag>
              {r.burstTooShort && <Flag alert>{x.pendek}</Flag>}
            </div>
            {r.burstTooShort && (
              <div className="mb-2.5">
                <Note>{x.pendekNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "Qp", label: x.rPeak, value: fmt(r.peak, 2), unit: "m³/s", tint: C.water, strong: true },
                { symbol: "tp", label: x.rPeakTime, value: fmt(r.peakTime, 2), unit: "jam", tint: C.energy, strong: true },
                { symbol: "Pe", label: x.rPe, value: fmt(r.effectiveRain, 2), unit: "mm", tint: C.water },
                { symbol: "—", label: x.rLoss, value: fmt(hilang, 2), unit: "mm", tint: C.ink3 },
                { symbol: "S", label: x.rS, value: fmt(scsStorage(CN), 1), unit: "mm", tint: C.critical },
                { symbol: "Tp", label: x.rTp, value: fmt(r.tp, 2), unit: "jam" },
                { symbol: "qp", label: x.rQp, value: fmt(r.qp, 3), unit: "m³/s·mm" },
                { symbol: "V", label: x.rVol, value: fmt(r.volume / 1e6, 3), unit: "juta m³" },
                { symbol: "Dr", label: x.rDepth, value: fmt(r.runoffDepth, 2), unit: "mm" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(P, dur, CN, A, tc, r.peak, r.effectiveRain, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksHydrograph(P, dur, CN, A, tc)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>S =</span>
                <Frac num="25400" den="CN" />
                <span>− 254</span>
                <span className="ml-5">Ia = 0,2 S</span>
              </Eq>
              <Eq>
                <span>Pe =</span>
                <Frac num="(P − Ia)²" den="P − Ia + S" />
                <span className="ml-4 text-ink-3">
                  {lang === "id" ? "bila P melebihi Ia" : "if P exceeds Ia"}
                </span>
              </Eq>
              <Eq>
                <span>Tp = 0,5 Δt + 0,6 tc</span>
                <span className="ml-5">qp =</span>
                <Frac num="0,208 A" den="Tp" />
                <span className="ml-3 text-ink-3">
                  {lang === "id"
                    ? "0,208 bila limpasan dalam mm; 2,08 bila dalam cm"
                    : "0.208 for runoff in mm; 2.08 for centimetres"}
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
  dur: number,
  CN: number,
  A: number,
  tc: number,
  peak: number,
  Pe: number,
  lang: Lang
): string {
  const naik = floodHydrograph(P, dur, Math.min(CN + 10, 100), A, tc);
  const bedaPuncak = peak > 0 ? ((naik.peak - peak) / peak) * 100 : 0;
  const bedaHujan = 10;

  if (lang === "en")
    return `Raise the curve number by ${fmtPlain(bedaHujan, 0)}, from ${fmtPlain(CN, 0)} to ${fmtPlain(Math.min(CN + 10, 100), 0)}, and the peak rises by ${fmt(bedaPuncak, 0)} per cent while the rainfall is untouched. That is the whole weight the curve number carries, and it is why arguments over catchment design so often turn out to be arguments over a single table lookup. Note also how little of the rain becomes runoff at low curve numbers: at ${fmtPlain(CN, 0)} only ${fmt((Pe / P) * 100, 0)} per cent of ${fmtPlain(P, 0)} mm reaches the river at all.`;
  return `Naikkan bilangan kurvanya ${fmtPlain(bedaHujan, 0)} angka, dari ${fmtPlain(CN, 0)} ke ${fmtPlain(Math.min(CN + 10, 100), 0)}, dan puncaknya naik ${fmt(bedaPuncak, 0)} persen tanpa satu milimeter pun hujan ditambahkan. Itulah seluruh beban yang dipikul satu bilangan kurva, dan itu sebabnya perdebatan tentang rancangan daerah aliran sering berujung menjadi perdebatan tentang satu baris pada tabel. Perhatikan juga betapa sedikit hujan yang menjadi limpasan pada bilangan kurva rendah: pada ${fmtPlain(CN, 0)} hanya ${fmt((Pe / P) * 100, 0)} persen dari ${fmtPlain(P, 0)} mm yang sampai ke sungai sama sekali.`;
}
