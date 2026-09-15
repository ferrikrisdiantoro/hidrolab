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
  ERGUN_INERTIAL,
  ERGUN_VISCOUS,
  PORE_RE_DARCY,
  fmt,
  fmtPlain,
  fmtSci,
  rockfillFlow,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksRockfill } from "@/lib/checks";

const I_MIN = 1e-5;
const I_MAX = 10;

const TXT = {
  id: {
    title: "Drainase bendungan urugan batu",
    sheetTitle: "Aliran melalui urugan batu — persamaan Ergun",
    dHead: "Beda tinggi muka air",
    dLength: "Panjang lintasan aliran",
    dD: "Garis tengah butiran setara",
    dN: "Porositas urugan",
    dT: "Tebal lapisan tembus air",
    pKerikil: "Kerikil kasar, gradien kecil",
    pBatu: "Urugan batu, banjir",
    pHalus: "Butiran halus, Darcy masih berlaku",
    rI: "Gradien hidraulik",
    rV: "Kecepatan semu",
    rQ: "Debit tiap meter lebar",
    rVDarcy: "Kecepatan yang diramalkan hukum Darcy",
    rOver: "Berapa kali Darcy melebih-lebihkannya",
    rK: "Permeabilitas Darcy",
    rRe: "Bilangan Reynolds pori",
    rShare: "Bagian gradien yang dihabiskan suku inersia",
    rExp: "Pangkat kecepatan terhadap gradien",
    darcy: "Hukum Darcy masih berlaku",
    bukanDarcy: "Di luar hukum Darcy, aliran inersia",
    bukanDarcyNote:
      "Bilangan Reynolds porinya melampaui sepuluh, jadi kehilangan tinggi tekan di sini tidak lagi berasal dari kekentalan melainkan dari inersia air yang berbelok terus-menerus di antara batunya. Menghitung kapasitas urugan ini dengan permeabilitas Darcy yang diukur pada gradien kecil akan melebih-lebihkan alirannya, dan pada urugan batu yang sebenarnya selisihnya sering sepuluh kali lipat atau lebih. Kesalahan itu berbahaya justru karena arahnya: ia membuat perancang mengira drainasenya berlebih padahal kurang.",
    note:
      "Hukum Darcy tidak berlaku pada batu, dan lembar ini ada untuk memperlihatkan seberapa jauh ia tidak berlaku. Gradien hidrauliknya mengandung dua suku, satu dari kekentalan yang berbanding lurus dengan kecepatan, satu dari inersia yang berbanding dengan kuadratnya. Pada pasir, suku pertama menguasai dan Darcy berlaku. Pada batu berukuran sentimeter ke atas, suku kedua menguasai hampir seluruh gradiennya. Akibatnya satu kalimat yang mengubah cara membaca seluruh soal drainase urugan batu: kecepatannya sebanding dengan AKAR gradien, bukan dengan gradien. Menggandakan beda tinggi tidak menggandakan alirannya melainkan menaikkannya empat puluh satu persen saja. Yang paling berbahaya dari ini bukan rumusnya melainkan arah kesalahannya. Permeabilitas urugan batu biasanya diukur atau ditaksir pada gradien kecil, tempat Darcy masih berlaku, lalu dipakai untuk menghitung kapasitas pada gradien besar, tempat Darcy sudah lama ditinggalkan. Hasilnya selalu melebih-lebihkan, tidak pernah sebaliknya, sehingga perancang mengira drainasenya berlebih padahal kurang. Perbandingan itu ditampilkan sebagai angka tersendiri di lembar ini karena itulah satu angka yang paling pantas dibawa pulang.",
  },
  en: {
    title: "Rockfill dam drainage",
    sheetTitle: "Flow through rockfill — the Ergun equation",
    dHead: "Head difference",
    dLength: "Flow path length",
    dD: "Equivalent grain diameter",
    dN: "Porosity of the fill",
    dT: "Thickness of the pervious layer",
    pKerikil: "Coarse gravel, small gradient",
    pBatu: "Rockfill in flood",
    pHalus: "Fine grain, Darcy still holds",
    rI: "Hydraulic gradient",
    rV: "Bulk velocity",
    rQ: "Discharge per metre width",
    rVDarcy: "Velocity Darcy law would predict",
    rOver: "How many times Darcy overpredicts",
    rK: "Darcy permeability",
    rRe: "Pore Reynolds number",
    rShare: "Share of the gradient spent on inertia",
    rExp: "Exponent of velocity against gradient",
    darcy: "Darcy law still holds",
    bukanDarcy: "Beyond Darcy law, inertial flow",
    bukanDarcyNote:
      "The pore Reynolds number exceeds ten, so the head loss here no longer comes from viscosity but from the inertia of water turning continually between the stones. Computing this fill capacity with a Darcy permeability measured at a small gradient will overpredict the flow, and on real rockfill the discrepancy is often tenfold or more. The error is dangerous precisely because of its direction: it leads the designer to believe the drainage is generous when it is short.",
    note:
      "Darcy law does not hold in rock, and this sheet exists to show how far it does not hold. The hydraulic gradient contains two terms, one from viscosity proportional to velocity and one from inertia proportional to its square. In sand the first dominates and Darcy holds. In rock of centimetre size and above, the second takes almost the whole gradient. The consequence is one sentence that changes how every rockfill drainage problem reads: the velocity scales with the SQUARE ROOT of the gradient, not with the gradient. Doubling the head difference does not double the flow but raises it by forty one per cent. The most dangerous part of this is not the formula but the direction of the error. Rockfill permeability is usually measured or estimated at a small gradient, where Darcy still holds, and then used to compute capacity at a large gradient, where Darcy was left behind long ago. The result always overpredicts, never the reverse, so the designer believes the drainage is generous when it is short. That ratio is shown as a number of its own on this sheet because it is the single number most worth taking away.",
  },
} as const;

const REFS = {
  id: [
    "Ergun, S. (1952). Fluid flow through packed columns. Chemical Engineering Progress 48(2).",
    "Wilkins, J.K. (1956). Flow of water through rockfill and its application to the design of dams. NZ Institution of Engineers.",
    "Leps, T.M. (1973). Flow through rockfill, dalam Embankment Dam Engineering, Casagrande Volume. Wiley.",
    "Stephenson, D. (1979). Rockfill in Hydraulic Engineering. Elsevier.",
  ],
  en: [
    "Ergun, S. (1952). Fluid flow through packed columns. Chemical Engineering Progress 48(2).",
    "Wilkins, J.K. (1956). Flow of water through rockfill and its application to the design of dams. NZ Institution of Engineers.",
    "Leps, T.M. (1973). Flow through rockfill, in Embankment Dam Engineering, Casagrande Volume. Wiley.",
    "Stephenson, D. (1979). Rockfill in Hydraulic Engineering. Elsevier.",
  ],
} as const;

export function DrainaseUruganBatuClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [head, setHead] = useState(2);
  const [length, setLength] = useState(20);
  const [d, setD] = useState(0.2);
  const [n, setN] = useState(0.4);
  const [tebal, setTebal] = useState(2);

  const i = head / Math.max(length, 1e-6);
  const r = rockfillFlow(i, d, n, tebal);

  const ref = useCanvas(
    (ctx, w, ch) => {
      const pts: { x: number; y: number }[] = [];
      const darcy: { x: number; y: number }[] = [];
      const inersia: { x: number; y: number }[] = [];
      for (let lg = Math.log10(I_MIN); lg <= Math.log10(I_MAX) + 1e-9; lg += 0.04) {
        const ii = Math.pow(10, lg);
        const s = rockfillFlow(ii, d, n, tebal);
        pts.push({ x: ii, y: s.v });
        darcy.push({ x: ii, y: s.kDarcy * ii });
        inersia.push({ x: ii, y: Math.sqrt(ii / r.B) });
      }

      const yMin = Math.min(...pts.map((p) => p.y)) / 3;
      const yMax = Math.max(...darcy.map((p) => p.y)) * 1.5;

      const deret: ChartSeries[] = [
        {
          pts: darcy,
          color: C.ink3,
          weight: W.hair,
          dash: DASH.hidden,
          label: T.darcyLine,
          labelAt: 0.72,
          labelDy: -10,
          labelAlign: "right",
        },
        {
          pts: inersia,
          color: C.critical,
          weight: W.hair,
          dash: DASH.axis,
          label: T.inertialLine,
          labelAt: 0.3,
          labelDy: 16,
          labelAlign: "left",
        },
        {
          pts,
          color: C.water,
          weight: W.bold,
          label: T.rockfillLabel,
          labelAt: 0.55,
          labelDy: 18,
        },
      ];

      drawChart(
        ctx,
        w,
        ch,
        {
          xMin: I_MIN,
          xMax: I_MAX,
          yMin,
          yMax,
          xLog: true,
          yLog: true,
          axisX: T.axSeepGradient,
          axisY: T.axSeepVelocity,
          series: deret,
          bands: r.darcyValid ? undefined : [{ axis: "x", from: i, to: I_MAX }],
          point: {
            x: i,
            y: r.v,
            label: `${fmtSci(r.v)} m/s`,
            invalid: !r.darcyValid,
          },
          regions: [
            { x: I_MIN * 3, y: yMax / 2.2, text: T.laminar, color: C.ink3 },
          ],
          heading: r.darcyValid ? undefined : x.bukanDarcy,
          headingColor: C.signal,
          padRight: 46,
        },
        lang
      );
    },
    [head, length, d, n, tebal, lang]
  );

  return (
    <LabShell
      sheet="DM-03"
      subject={SUBJECTS.DM[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Kecepatannya sebanding dengan{" "}
            <Term tint={C.critical}>akar gradien</Term>, bukan dengan gradien.
            Menghitungnya dengan hukum Darcy melebih-lebihkan alirannya{" "}
            <Term tint={C.signal}>{fmt(r.overprediction, 1)} kali</Term>.
          </p>
        ) : (
          <p>
            The velocity scales with the{" "}
            <Term tint={C.critical}>square root of the gradient</Term>, not with
            the gradient. Computing it with Darcy law overpredicts the flow{" "}
            <Term tint={C.signal}>{fmt(r.overprediction, 1)} times over</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="DM-03"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m/s)" },
            { label: "i", value: fmt(i, 4), tint: C.critical },
            { label: "v", value: `${fmtSci(r.v)} m/s`, tint: C.water },
            { label: "Rep", value: fmt(r.poreRe, 1), tint: r.darcyValid ? undefined : C.signal },
            { label: "n", value: fmtPlain(n, 2) },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Δh" label={x.dHead} value={head} min={0.02} max={20} step={0.02} digits={2} unit="m" onChange={setHead} tint={C.water} />
              <InputRow symbol="L" label={x.dLength} value={length} min={1} max={120} step={1} digits={0} unit="m" onChange={setLength} />
              <InputRow symbol="d" label={x.dD} value={d} min={0.005} max={1.2} step={0.005} digits={3} unit="m" onChange={setD} tint={C.critical} />
              <InputRow symbol="n" label={x.dN} value={n} min={0.2} max={0.5} step={0.01} digits={2} onChange={setN} />
              <InputRow symbol="t" label={x.dT} value={tebal} min={0.2} max={30} step={0.2} digits={1} unit="m" onChange={setTebal} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pKerikil, apply: () => { setHead(0.2); setLength(40); setD(0.03); setN(0.35); setTebal(2); } },
                  { label: x.pBatu, apply: () => { setHead(6); setLength(20); setD(0.4); setN(0.42); setTebal(6); } },
                  { label: x.pHalus, apply: () => { setHead(0.05); setLength(60); setD(0.005); setN(0.35); setTebal(1); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={r.darcyValid ? C.water : undefined} alert={!r.darcyValid}>
                {r.darcyValid ? x.darcy : x.bukanDarcy}
              </Flag>
            </div>
            {!r.darcyValid && (
              <div className="mb-2.5">
                <Note>{x.bukanDarcyNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "i", label: x.rI, value: fmt(i, 5), tint: C.critical },
                { symbol: "v", label: x.rV, value: fmtSci(r.v), unit: "m/s", tint: C.water, strong: true },
                { symbol: "q", label: x.rQ, value: fmtSci(r.q), unit: "m³/s per m", strong: true },
                { symbol: "vD", label: x.rVDarcy, value: fmtSci(r.vDarcy), unit: "m/s", tint: C.ink3 },
                { symbol: "vD/v", label: x.rOver, value: fmt(r.overprediction, 2), tint: r.overprediction > 2 ? C.signal : undefined, strong: true },
                { symbol: "k", label: x.rK, value: fmtSci(r.kDarcy), unit: "m/s" },
                { symbol: "Rep", label: x.rRe, value: fmt(r.poreRe, 2), tint: r.darcyValid ? undefined : C.signal },
                { symbol: "β", label: x.rShare, value: fmt(r.turbulentShare, 3) },
                { symbol: "m", label: x.rExp, value: fmt(r.exponent, 3) },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(head, length, d, n, tebal, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksRockfill(i, d, n, tebal)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>i = A v + B v²</span>
                <span className="ml-5">A =</span>
                <Frac num={`${fmtPlain(ERGUN_VISCOUS, 0)} (1−n)² ν`} den="n³ g d²" />
                <span className="ml-5">B =</span>
                <Frac num={`${fmtPlain(ERGUN_INERTIAL, 2)} (1−n)`} den="n³ g d" />
              </Eq>
              <Eq>
                <span>v =</span>
                <Frac num="2 i" den="A + √(A² + 4 B i)" />
                <span className="ml-5">Rep =</span>
                <Frac num="v d" den="ν (1−n)" />
                <span className="ml-3 text-ink-3">
                  {lang === "id"
                    ? `Darcy ditinggalkan di atas Rep ${fmtPlain(PORE_RE_DARCY, 0)}`
                    : `Darcy is left behind above Rep ${fmtPlain(PORE_RE_DARCY, 0)}`}
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
  head: number,
  length: number,
  d: number,
  n: number,
  tebal: number,
  lang: Lang
): string {
  const i = head / Math.max(length, 1e-6);
  const r = rockfillFlow(i, d, n, tebal);
  const dua = rockfillFlow(i * 2, d, n, tebal);
  const naik = r.v > 0 ? (dua.v / r.v - 1) * 100 : 0;

  if (lang === "en")
    return `At a gradient of ${fmt(i, 5)} the fill passes ${fmtSci(r.q)} cubic metres a second for every metre of width. Double the head difference and the flow rises only ${fmt(naik, 1)} per cent, not a hundred: ${fmt(r.turbulentShare * 100, 0)} per cent of this gradient is already being spent on inertia rather than viscosity. Darcy law on the same gradient would have promised ${fmtSci(r.vDarcy)} metres a second, ${fmt(r.overprediction, 1)} times the truth, and that is the direction in which a rockfill drain is usually designed short.`;
  return `Pada gradien ${fmt(i, 5)} urugannya meloloskan ${fmtSci(r.q)} meter kubik tiap detik untuk tiap meter lebar. Gandakan beda tingginya dan alirannya naik hanya ${fmt(naik, 1)} persen, bukan seratus: ${fmt(r.turbulentShare * 100, 0)} persen gradien ini sudah terpakai untuk inersia, bukan untuk kekentalan. Hukum Darcy pada gradien yang sama akan menjanjikan ${fmtSci(r.vDarcy)} meter tiap detik, ${fmt(r.overprediction, 1)} kali yang sebenarnya, dan ke arah itulah drainase urugan batu biasanya dirancang kurang.`;
}
