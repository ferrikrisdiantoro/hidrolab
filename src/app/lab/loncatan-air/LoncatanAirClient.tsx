"use client";

import { useRef, useState } from "react";
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
import { drawJump, makeStreaks, type Streak } from "@/lib/drawJump";
import {
  G,
  classifyJump,
  conjugateDepth,
  fmt,
  froude,
  jumpEnergyLoss,
  jumpLength,
} from "@/lib/hydraulics";
import { C } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksJump } from "@/lib/checks";

const TXT = {
  id: {
    title: "Loncatan air",
    sheetTitle: "Loncatan air — saluran persegi mendatar",
    d1: "Kedalaman hulu",
    d2: "Kecepatan hulu",
    pSub: "Subkritis",
    pOsc: "Berosilasi",
    pSteady: "Mantap",
    pStrong: "Kuat",
    showE: "Sembunyikan garis energi",
    hideE: "Tampilkan garis energi",
    stopF: "Hentikan alur aliran",
    startF: "Jalankan alur aliran",
    rFr1: "Bilangan Froude hulu",
    rY2: "Kedalaman konjugat",
    rV2: "Kecepatan hilir",
    rFr2: "Froude hilir",
    rE1: "Energi spesifik hulu",
    rE2: "Energi spesifik hilir",
    rDE: "Energi teredam",
    rPct: "Persentase teredam",
    rLj: "Panjang loncatan",
    rq: "Debit satuan",
    note: "Persamaan kedua adalah bentuk Belanger, diturunkan dari kekekalan momentum pada saluran persegi mendatar dengan mengabaikan gesekan dasar di sepanjang loncatan. Perlu dicatat bahwa persamaan ini hanya memberi kedalaman di kedua ujung loncatan, bukan bentuk permukaan di antaranya — karena itu bagian dalam loncatan pada gambar digambar dengan titik rapat, bukan garis menerus. Panjang loncatan memakai pendekatan empiris umum L ≈ 6·y₂.",
  },
  en: {
    title: "Hydraulic jump",
    sheetTitle: "Hydraulic jump — horizontal rectangular channel",
    d1: "Upstream depth",
    d2: "Upstream velocity",
    pSub: "Subcritical",
    pOsc: "Oscillating",
    pSteady: "Steady",
    pStrong: "Strong",
    showE: "Hide energy line",
    hideE: "Show energy line",
    stopF: "Stop flow streaks",
    startF: "Start flow streaks",
    rFr1: "Upstream Froude number",
    rY2: "Conjugate depth",
    rV2: "Downstream velocity",
    rFr2: "Downstream Froude",
    rE1: "Upstream specific energy",
    rE2: "Downstream specific energy",
    rDE: "Energy dissipated",
    rPct: "Percentage dissipated",
    rLj: "Jump length",
    rq: "Unit discharge",
    note: "The second equation is the Bélanger form, derived from momentum conservation in a horizontal rectangular channel with bed friction along the jump neglected. Note that it gives only the depths at the two ends of the jump, not the surface shape in between — which is why the interior of the jump is drawn with fine dots rather than a solid line. Jump length uses the common empirical approximation L ≈ 6·y₂.",
  },
} as const;

const REFS = {
  id: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Bab 15 — Hydraulic Jump and Its Use as Energy Dissipator.",
    "Peterka, A.J. (1978). Hydraulic Design of Stilling Basins and Energy Dissipators. USBR Engineering Monograph No. 25.",
    "USACE (1992). Hydraulic Design of Spillways, EM 1110-2-1603.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan.",
  ],
  en: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Chapter 15 — Hydraulic Jump and Its Use as Energy Dissipator.",
    "Peterka, A.J. (1978). Hydraulic Design of Stilling Basins and Energy Dissipators. USBR Engineering Monograph No. 25.",
    "USACE (1992). Hydraulic Design of Spillways, EM 1110-2-1603.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan.",
  ],
} as const;

export function LoncatanAirClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [y1, setY1] = useState(0.3);
  const [V1, setV1] = useState(7.0);
  const [showEnergy, setShowEnergy] = useState(true);
  const [showFlow, setShowFlow] = useState(true);
  const streaks = useRef<Streak[]>(makeStreaks(150));

  const Fr1 = froude(V1, y1);
  const hasJump = Fr1 > 1;
  const y2 = hasJump ? conjugateDepth(y1, Fr1) : y1;
  const q = V1 * y1;
  const V2 = q / y2;
  const Fr2 = froude(V2, y2);
  const E1 = y1 + (V1 * V1) / (2 * G);
  const E2 = y2 + (V2 * V2) / (2 * G);
  const dE = hasJump ? jumpEnergyLoss(y1, y2) : 0;
  const lossPct = E1 > 0 ? (dE / E1) * 100 : 0;
  const Lj = hasJump ? jumpLength(y2) : 0;
  const klas = classifyJump(Fr1);

  const ref = useCanvas(
    (ctx, w, h, tt, dt) =>
      drawJump(
        ctx,
        w,
        h,
        { y1, V1 },
        {
          showEnergy,
          streaks: showFlow ? streaks.current : null,
          t: tt,
          dt,
          lang,
        }
      ),
    [y1, V1, showEnergy, showFlow, lang],
    { animate: showFlow }
  );

  return (
    <LabShell
      sheet="OC-01"
      subject={SUBJECTS.OC[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Aliran <Term tint={C.water}>superkritis</Term> yang menabrak air
            tenang di hilir meredam energinya lewat loncatan. Kedalaman melompat
            dari y₁ ke <Term tint={C.water}>y₂</Term>, dan selisih{" "}
            <Term tint={C.energy}>energinya</Term> hilang sebagai turbulensi.
          </p>
        ) : (
          <p>
            <Term tint={C.water}>Supercritical</Term> flow meeting calm water
            downstream dissipates its energy through a jump. The depth leaps
            from y₁ to <Term tint={C.water}>y₂</Term>, and the difference in{" "}
            <Term tint={C.energy}>energy</Term> is lost as turbulence.
          </p>
        )
      }
      drawing={
        <Sheet
          number="OC-01"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbScale, value: "1 : 20" },
            { label: t.tbUnit, value: "SI (m, m/s)" },
            { label: "q", value: `${fmt(q)} m²/s` },
            { label: "Fr₁", value: fmt(Fr1) },
            { label: t.tbRegime, value: klas.label[lang] },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="y₁" label={x.d1} value={y1} min={0.08} max={1.2} step={0.01} unit="m" onChange={setY1} tint={C.water} />
              <InputRow symbol="V₁" label={x.d2} value={V1} min={0.5} max={16} step={0.1} digits={1} unit="m/s" onChange={setV1} tint={C.water} />
            </InputTable>

            <div className="mt-3.5 flex flex-col gap-2.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pSub, apply: () => { setY1(0.9); setV1(2.0); } },
                  { label: x.pOsc, apply: () => { setY1(0.35); setV1(6.0); } },
                  { label: x.pSteady, apply: () => { setY1(0.25); setV1(8.5); } },
                  { label: x.pStrong, apply: () => { setY1(0.15); setV1(12.0); } },
                ]}
              />
              <PresetRow
                label={t.presetView}
                presets={[
                  { label: showEnergy ? x.showE : x.hideE, apply: () => setShowEnergy((v) => !v) },
                  { label: showFlow ? x.stopF : x.startF, apply: () => setShowFlow((v) => !v) },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "Fr₁", label: x.rFr1, value: fmt(Fr1), strong: true },
                { symbol: "y₂", label: x.rY2, value: hasJump ? fmt(y2) : "—", unit: "m", tint: C.water, strong: true },
                { symbol: "V₂", label: x.rV2, value: fmt(V2), unit: "m/s" },
                { symbol: "Fr₂", label: x.rFr2, value: fmt(Fr2) },
                { symbol: "E₁", label: x.rE1, value: fmt(E1), unit: "m", tint: C.energy },
                { symbol: "E₂", label: x.rE2, value: fmt(E2), unit: "m", tint: C.energy },
                { symbol: "ΔE", label: x.rDE, value: hasJump ? fmt(dE, 3) : "—", unit: "m", tint: C.energy },
                { label: x.rPct, value: hasJump ? fmt(lossPct, 1) : "—", unit: "%", tint: C.energy },
                { symbol: "Lj", label: x.rLj, value: hasJump ? fmt(Lj, 1) : "—", unit: "m", tint: C.critical },
                { symbol: "q", label: x.rq, value: fmt(q), unit: "m²/s" },
              ]}
            />
          </Block>

          <Block heading={t.blkCondition}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag alert={!hasJump}>{klas.label[lang]}</Flag>
              <span className="value label text-[0.78rem] text-ink-3">{klas.range}</span>
            </div>
            <Note>{klas.note[lang]}</Note>
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice({ Fr1, hasJump, lossPct, Lj, y2, y1 }, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksJump(y1, V1)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Fr₁ =</span>
                <Frac num="V₁" den={<>√(g · y₁)</>} />
              </Eq>
              <Eq>
                <Frac num="y₂" den="y₁" />
                <span>= ½ · ( √(1 + 8 · Fr₁²) − 1 )</span>
              </Eq>
              <Eq>
                <span>ΔE =</span>
                <Frac num="(y₂ − y₁)³" den="4 · y₁ · y₂" />
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
  s: { Fr1: number; hasJump: boolean; lossPct: number; Lj: number; y2: number; y1: number },
  lang: Lang
): string {
  const rasio = s.y2 / s.y1;
  const pct0 = s.lossPct.toFixed(0);
  const pct1 = s.lossPct.toFixed(1);
  const lj = s.Lj.toFixed(1);
  const r1 = rasio.toFixed(1);

  if (lang === "en") {
    if (!s.hasJump)
      return "The flow here is still subcritical, so no jump forms. Reduce the upstream depth or raise the velocity until Fr₁ passes 1 — and notice that changing the depth has far more effect than changing the velocity, because depth enters as a square root in the denominator.";
    if (s.Fr1 < 1.7)
      return `The jump is only just forming. The depth rises by a factor of ${r1} and only ${pct1} per cent of the energy is dissipated. For an energy dissipator this is not yet adequate.`;
    if (s.Fr1 < 4.5)
      return `Watch the rollers in the jump: the entering jet oscillates and its waves travel far downstream. Although ${pct0} per cent of the energy is already dissipated, it is those residual waves that usually damage the downstream banks — which is why this range is avoided in stilling basin design.`;
    if (s.Fr1 < 9)
      return `This is the range sought in design: the jump holds position, ${pct0} per cent of the energy is dissipated, and the depth rises by a factor of ${r1}. The stilling basin needs to be at least ${lj} m long so the jump finishes inside the structure rather than on the natural ground beyond it.`;
    return `Dissipation is now very high at ${pct0} per cent, but the surface has become rough and turbulent. At this point the cost of bed and wall protection rises sharply; it is often cheaper to lower Fr₁ by changing the basin floor level than to strengthen the structure.`;
  }

  if (!s.hasJump)
    return "Pada kondisi ini aliran masih subkritis, sehingga loncatan tidak terbentuk. Kurangi kedalaman hulu atau naikkan kecepatan sampai Fr₁ melewati 1 — dan perhatikan bahwa mengubah kedalaman jauh lebih berpengaruh daripada mengubah kecepatan, karena kedalaman masuk sebagai akar di penyebut.";
  if (s.Fr1 < 1.7)
    return `Loncatan baru mulai terbentuk. Kedalaman hanya naik ${r1} kali lipat dan energi yang teredam masih ${pct1} persen. Untuk keperluan peredam energi, kondisi ini belum memadai.`;
  if (s.Fr1 < 4.5)
    return `Perhatikan gulungan di daerah loncatan: pancaran masuk berosilasi naik-turun dan gelombangnya menjalar jauh ke hilir. Meski energi yang teredam sudah ${pct0} persen, gelombang sisa inilah yang biasanya merusak tebing di hilir — dan karena itu rentang ini dihindari dalam desain kolam olak.`;
  if (s.Fr1 < 9)
    return `Ini rentang yang dicari dalam desain: posisi loncatan stabil, energi teredam ${pct0} persen, dan kedalaman naik ${r1} kali lipat. Panjang kolam olak perlu setidaknya ${lj} m agar loncatan selesai di dalam struktur, bukan di atas tanah asli di hilirnya.`;
  return `Peredaman sudah sangat besar, ${pct0} persen, tetapi permukaannya menjadi kasar dan bergolak. Pada kondisi ini biaya perlindungan dasar dan dinding naik tajam; sering kali lebih murah menurunkan Fr₁ dengan mengubah elevasi lantai olak daripada memperkuat strukturnya.`;
}
