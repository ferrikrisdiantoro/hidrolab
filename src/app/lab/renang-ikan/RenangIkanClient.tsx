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
  SWIM_BURST_BL,
  SWIM_BURST_TIME,
  SWIM_SUSTAINED_BL,
  fishSwim,
  fmt,
  fmtPlain,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksSwim } from "@/lib/checks";

const TXT = {
  id: {
    title: "Renang ikan",
    sheetTitle: "Daya renang ikan — kecepatan arus terhadap lama bertahan",
    dL: "Panjang tubuh ikan",
    dV: "Kecepatan arus yang dilawan",
    dSus: "Kecepatan jelajah",
    dBurst: "Kecepatan sentak",
    pKecil: "Ikan kecil, gorong-gorong",
    pSedang: "Ikan ukuran sedang, lintasan ikan",
    pBesar: "Ikan besar, sungai deras",
    rTahan: "Lama sanggup bertahan",
    rSus: "Kecepatan jelajah",
    rBurst: "Kecepatan sentak",
    rMaju: "Kecepatan maju bersih saat sentak",
    rJarak: "Jarak terjauh yang dapat ditempuh",
    rMode: "Cara berenang pada arus ini",
    mJelajah: "Jelajah, tanpa batas waktu",
    mLanjut: "Berkelanjutan",
    mSentak: "Sentak",
    mTidak: "Tidak mampu melawan arus",
    tidak: "Tidak mampu melawan arus",
    tidakNote:
      "Kecepatan arusnya menyamai atau melampaui kecepatan sentak ikan ini, jadi ikan tidak dapat maju sama sekali betapa pun kuatnya ia berenang. Bangunan dengan arus seperti ini menjadi penghalang mutlak bagi ikan seukuran itu, dan memperpanjang atau memperpendeknya tidak mengubah apa pun. Yang harus diubah kecepatan arusnya, bukan panjangnya. Perbesar penampang basahnya, tambahkan kekasaran dasar, atau sisipkan kolam istirahat.",
    note:
      "Satu hal yang paling sering salah dipakai dari lembar semacam ini: kecepatan sentak bukan kecepatan yang boleh dipakai merancang. Ia hanya sanggup dipertahankan dua puluh detik, dan sesudah itu ikan harus beristirahat lama sebelum sanggup lagi. Merancang gorong-gorong dengan arus tepat di bawah kecepatan sentak berarti merancang bangunan yang hanya dapat dilewati sekali oleh ikan yang sudah segar, dan tidak dapat dilewati sama sekali oleh ikan yang baru saja melewati bangunan sebelumnya. Itu sebabnya jarak tempuh yang ditampilkan di sini dihitung pada kecepatan sentak selama dua puluh detik, dan angka itu yang menentukan panjang maksimum gorong-gorong atau jarak antar kolam istirahat pada lintasan ikan. Perhatikan juga bahwa seluruh kecepatan di lembar ini sebanding dengan panjang tubuh: ikan sepuluh sentimeter dan ikan satu meter menghadapi arus yang sama sebagai dua dunia yang sama sekali berbeda, dan rancangan yang aman bagi yang besar dapat menjadi penghalang mutlak bagi yang kecil.",
  },
  en: {
    title: "Fish locomotion",
    sheetTitle: "Fish swimming performance — current velocity against endurance",
    dL: "Fish body length",
    dV: "Current velocity opposed",
    dSus: "Sustained speed",
    dBurst: "Burst speed",
    pKecil: "Small fish, culvert",
    pSedang: "Medium fish, fishway",
    pBesar: "Large fish, fast river",
    rTahan: "Time it can hold",
    rSus: "Sustained speed",
    rBurst: "Burst speed",
    rMaju: "Net ground speed at burst",
    rJarak: "Furthest distance it can cover",
    rMode: "Swimming mode in this current",
    mJelajah: "Cruising, no time limit",
    mLanjut: "Prolonged",
    mSentak: "Burst",
    mTidak: "Cannot make headway",
    tidak: "Cannot make headway",
    tidakNote:
      "The current velocity matches or exceeds this fish's burst speed, so the fish cannot advance at all however hard it swims. A structure with a current like this is an absolute barrier for fish of that size, and making it longer or shorter changes nothing. What must change is the velocity, not the length. Enlarge the wetted section, add bed roughness, or insert resting pools.",
    note:
      "One thing is most often misused from a sheet like this: the burst speed is not a design speed. It can be held for twenty seconds, after which the fish must rest for a long time before it can do so again. Designing a culvert with a current just below the burst speed means designing a structure that can be passed once by a fresh fish and not at all by a fish that has just passed the structure before it. That is why the distance shown here is computed at the burst speed over twenty seconds, and it is that number which sets the maximum culvert length or the spacing of resting pools in a fishway. Note too that every velocity on this sheet scales with body length: a ten-centimetre fish and a one-metre fish meet the same current as two entirely different worlds, and a design that is safe for the large one can be an absolute barrier for the small one.",
  },
} as const;

const REFS = {
  id: [
    "Beamish, F.W.H. (1978). Swimming capacity. Dalam Hoar & Randall (ed.), Fish Physiology vol. 7. Academic Press.",
    "Katopodis, C. & Gervais, R. (2016). Fish swimming performance database and analyses. DFO Canadian Science Advisory Secretariat 2016/002.",
    "FAO/DVWK (2002). Fish Passes: Design, Dimensions and Monitoring. FAO, Roma.",
    "Bell, M.C. (1991). Fisheries Handbook of Engineering Requirements and Biological Criteria. US Army Corps of Engineers.",
  ],
  en: [
    "Beamish, F.W.H. (1978). Swimming capacity. In Hoar & Randall (eds.), Fish Physiology vol. 7. Academic Press.",
    "Katopodis, C. & Gervais, R. (2016). Fish swimming performance database and analyses. DFO Canadian Science Advisory Secretariat 2016/002.",
    "FAO/DVWK (2002). Fish Passes: Design, Dimensions and Monitoring. FAO, Rome.",
    "Bell, M.C. (1991). Fisheries Handbook of Engineering Requirements and Biological Criteria. US Army Corps of Engineers.",
  ],
} as const;

export function RenangIkanClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Lcm, setLcm] = useState(20);
  const [V, setV] = useState(0.8);
  const [susBL, setSusBL] = useState(SWIM_SUSTAINED_BL);
  const [burstBL, setBurstBL] = useState(SWIM_BURST_BL);

  const L = Lcm / 100;
  const r = fishSwim(L, V, susBL, burstBL);
  const tidak = r.mode === "tidak-mampu";

  const modeNama =
    r.mode === "jelajah"
      ? x.mJelajah
      : r.mode === "berkelanjutan"
        ? x.mLanjut
        : r.mode === "sentak"
          ? x.mSentak
          : x.mTidak;

  const vMax = Math.max(r.burst * 1.3, 0.2);

  const ref = useCanvas(
    (ctx, w, h) => {
      const kurva: { x: number; y: number }[] = [];
      for (let i = 0; i <= 300; i++) {
        const vv = (vMax * i) / 300;
        const e = fishSwim(L, vv, susBL, burstBL).endurance;
        if (Number.isFinite(e) && e >= 1 && e <= 1e5) kurva.push({ x: vv, y: e });
      }

      const deret: ChartSeries[] = [
        {
          pts: kurva,
          color: C.water,
          weight: W.bold,
        },
      ];

      drawChart(
        ctx,
        w,
        h,
        {
          xMin: 0,
          xMax: vMax,
          yMin: 1,
          yMax: 1e5,
          yLog: true,
          axisX: T.axSwimSpeed,
          axisY: T.axEndurance,
          series: deret,
          bands: [
            { axis: "x", from: 0, to: r.sustained, label: T.sustainedZone },
            { axis: "x", from: r.burst, to: vMax, label: T.unableZone },
          ],
          rules: [
            {
              axis: "y",
              at: SWIM_BURST_TIME,
              color: C.critical,
              dash: DASH.axis,
              label: `${fmtPlain(SWIM_BURST_TIME, 0)} s`,
              labelAlign: "left",
            },
          ],
          point: Number.isFinite(r.endurance)
            ? {
                x: V,
                y: r.endurance,
                label: `${fmtPlain(r.endurance, 0)} s`,
                invalid: tidak,
              }
            : undefined,
          heading: tidak ? T.unableZone : undefined,
          headingColor: C.signal,
        },
        lang
      );
    },
    [Lcm, V, susBL, burstBL, lang]
  );

  return (
    <LabShell
      sheet="EH-04"
      subject={SUBJECTS.EH[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Ikan tidak punya satu kecepatan renang melainkan{" "}
            <Term tint={C.water}>tiga cara berenang</Term> yang berbeda umurnya:
            yang dapat dipertahankan selamanya, yang bertahan beberapa menit,
            dan yang hanya <Term tint={C.critical}>dua puluh detik</Term>.
          </p>
        ) : (
          <p>
            A fish has no single swimming speed but{" "}
            <Term tint={C.water}>three modes</Term> that differ in how long they
            last: one it can hold forever, one for minutes, and one for only{" "}
            <Term tint={C.critical}>twenty seconds</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="EH-04"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m/s, s)" },
            { label: "L", value: `${fmt(Lcm, 0)} cm` },
            { label: "V", value: `${fmt(V, 2)} m/s`, tint: C.water },
            {
              label: "t",
              value: Number.isFinite(r.endurance) ? `${fmt(r.endurance, 0)} s` : "∞",
              tint: tidak ? C.signal : C.energy,
            },
            { label: "—", value: modeNama },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="L" label={x.dL} value={Lcm} min={2} max={150} step={1} digits={0} unit="cm" onChange={setLcm} />
              <InputRow symbol="V" label={x.dV} value={V} min={0.02} max={6} step={0.02} digits={2} unit="m/s" onChange={setV} tint={C.water} />
              <InputRow symbol="Us" label={x.dSus} value={susBL} min={0.5} max={5} step={0.1} digits={1} unit="L/s" onChange={setSusBL} />
              <InputRow symbol="Ub" label={x.dBurst} value={burstBL} min={4} max={20} step={0.5} digits={1} unit="L/s" onChange={setBurstBL} tint={C.critical} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pKecil, apply: () => { setLcm(8); setV(0.4); setSusBL(2); setBurstBL(10); } },
                  { label: x.pSedang, apply: () => { setLcm(25); setV(1); setSusBL(2); setBurstBL(10); } },
                  { label: x.pBesar, apply: () => { setLcm(70); setV(2.5); setSusBL(2); setBurstBL(10); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={tidak ? undefined : C.water} alert={tidak}>
                {modeNama}
              </Flag>
            </div>
            {tidak && (
              <div className="mb-2.5">
                <Note>{x.tidakNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "t", label: x.rTahan, value: Number.isFinite(r.endurance) ? fmt(r.endurance, 1) : "∞", unit: Number.isFinite(r.endurance) ? "s" : undefined, tint: C.energy, strong: true },
                { symbol: "Ls", label: x.rJarak, value: fmt(r.distance, 2), unit: "m", tint: tidak ? C.signal : C.water, strong: true },
                { symbol: "Us", label: x.rSus, value: fmt(r.sustained, 3), unit: "m/s" },
                { symbol: "Ub", label: x.rBurst, value: fmt(r.burst, 3), unit: "m/s", tint: C.critical },
                { symbol: "Vg", label: x.rMaju, value: fmt(r.groundSpeed, 3), unit: "m/s", tint: r.groundSpeed <= 0 ? C.signal : undefined },
                { symbol: "—", label: x.rMode, value: modeNama },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(L, V, r.distance, r.burst, tidak, susBL, burstBL, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksSwim(L, V)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>ln t = a − b U</span>
                <span className="ml-5">U =</span>
                <Frac num="V" den="L" />
                <span className="ml-3 text-ink-3">
                  {lang === "id"
                    ? "panjang tubuh per detik"
                    : "body lengths per second"}
                </span>
              </Eq>
              <Eq>
                <span>Us = {fmtPlain(susBL, 1)} L</span>
                <span className="ml-5">Ub = {fmtPlain(burstBL, 1)} L</span>
                <span className="ml-5">
                  Ls = (Ub − V) · {fmtPlain(SWIM_BURST_TIME, 0)} s
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
  L: number,
  V: number,
  distance: number,
  burst: number,
  tidak: boolean,
  susBL: number,
  burstBL: number,
  lang: Lang
): string {
  if (tidak) {
    return lang === "id"
      ? `Arus ${fmt(V, 2)} m/s sudah menyamai atau melampaui kecepatan sentak ${fmt(burst, 2)} m/s. Perkecil arusnya, atau perbesar ikannya, lalu perhatikan jarak tempuh di tabel berubah dari nol menjadi angka yang berarti.`
      : `A current of ${fmt(V, 2)} m/s already matches or exceeds the burst speed of ${fmt(burst, 2)} m/s. Reduce the current, or take a larger fish, and watch the distance in the table change from zero to something meaningful.`;
  }

  const separuh = fishSwim(L / 2, V, susBL, burstBL);

  if (lang === "en")
    return `This fish can cover ${fmt(distance, 1)} m against this current in one burst, which is the longest culvert it can pass without a rest. Halve the body length, keeping everything else, and that distance becomes ${fmt(separuh.distance, 1)} m. The same structure, the same flow, and a fish half as long: the design that was comfortable is now ${separuh.distance <= 0 ? "impassable" : `${fmt(distance / Math.max(separuh.distance, 1e-9), 1)} times too long`}. That is why fish-passage criteria are written for the weakest species expected, not the most prominent one.`;
  return `Ikan ini sanggup menempuh ${fmt(distance, 1)} m melawan arus ini dalam satu sentakan, dan itulah gorong-gorong terpanjang yang dapat dilewatinya tanpa beristirahat. Kecilkan panjang tubuhnya menjadi separuh, dengan segala hal lain tetap, dan jaraknya menjadi ${fmt(separuh.distance, 1)} m. Bangunan yang sama, aliran yang sama, dan ikan separuh panjangnya: rancangan yang tadinya lapang sekarang ${separuh.distance <= 0 ? "tidak dapat dilewati sama sekali" : `${fmt(distance / Math.max(separuh.distance, 1e-9), 1)} kali terlalu panjang`}. Itulah sebabnya kriteria lintasan ikan ditulis untuk jenis terlemah yang diperkirakan ada, bukan untuk jenis yang paling menonjol.`;
}
