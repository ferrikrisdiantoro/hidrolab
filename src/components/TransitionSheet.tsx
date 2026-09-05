"use client";

import { type ReactNode, useState } from "react";
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
} from "@/components/ui";
import { Verification } from "@/components/Verification";
import { useCanvas } from "@/lib/useCanvas";
import { drawTransition } from "@/lib/drawTransition";
import { fmt, transition } from "@/lib/hydraulics";
import { checksTransition } from "@/lib/checks";
import { C } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";

/**
 * Tiga lembar transisi dibangun dari satu komponen.
 *
 * Perubahan elevasi dasar, perubahan lebar, dan peralihan melewati kondisi
 * kritis adalah persoalan yang sama: energi spesifik yang tersedia di hilir
 * dibandingkan dengan energi minimum yang dibutuhkan di sana. Yang berbeda
 * hanya masukan mana yang ditonjolkan dan pertanyaan apa yang dijawab.
 *
 * Ini contoh langsung dari keluarga penggambar di PRD: menambah lembar dalam
 * keluarga yang sudah ada berarti menambah teks dan pilihan masukan, bukan
 * membangun dari nol.
 */
export type TransitionMode = "step" | "width" | "critical";

export type TransitionTxt = {
  title: string;
  sheetTitle: string;
  dQ: string;
  db1: string;
  dy1: string;
  db2: string;
  ddz: string;
  note: string;
};

export function TransitionSheet({
  sheet,
  mode,
  txt,
  refs,
  intro,
  awal,
}: {
  sheet: string;
  mode: TransitionMode;
  txt: { id: TransitionTxt; en: TransitionTxt };
  refs: { id: readonly string[]; en: readonly string[] };
  intro: (lang: Lang) => ReactNode;
  awal: { Q: number; b1: number; y1: number; b2: number; dz: number };
}) {
  const { lang } = useLang();
  const t = str(lang);
  const x = txt[lang];
  const u = UMUM[lang];

  const [Q, setQ] = useState(awal.Q);
  const [b1, setB1] = useState(awal.b1);
  const [y1, setY1] = useState(awal.y1);
  const [b2, setB2] = useState(awal.b2);
  const [dz, setDz] = useState(awal.dz);

  // Lebar dan elevasi dikunci pada lembar yang tidak membahasnya, supaya
  // pertanyaan yang dijawab tiap lembar tetap satu.
  const b2Efektif = mode === "step" ? b1 : b2;
  const dzEfektif = mode === "width" ? 0 : dz;

  const r = transition({ Q, b1, y1, b2: b2Efektif, dz: dzEfektif });

  const ref = useCanvas(
    (ctx, w, h) =>
      drawTransition(
        ctx,
        w,
        h,
        { r, b1, b2: b2Efektif, y1, dz: dzEfektif },
        lang
      ),
    [Q, b1, y1, b2Efektif, dzEfektif, lang]
  );

  return (
    <LabShell
      sheet={sheet}
      subject={SUBJECTS.OC[lang]}
      title={x.title}
      intro={intro(lang)}
      drawing={
        <Sheet
          number={sheet}
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "q₂", value: `${fmt(r.q2, 3)} m²/s` },
            { label: "yc₂", value: `${fmt(r.yc2, 3)} m`, tint: C.critical },
            { label: "Fr₂", value: r.choked ? "1,00" : fmt(r.Fr2) },
            {
              label: t.tbRegime,
              value: r.choked
                ? u.choked
                : r.branch === "subkritis"
                  ? u.sub
                  : u.sup,
              tint: r.choked ? C.signal : undefined,
            },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q} min={0.5} max={80} step={0.5} digits={1} unit="m³/s" onChange={setQ} tint={C.water} />
              <InputRow symbol="b₁" label={x.db1} value={b1} min={1} max={20} step={0.1} digits={1} unit="m" onChange={setB1} />
              <InputRow symbol="y₁" label={x.dy1} value={y1} min={0.1} max={5} step={0.01} unit="m" onChange={setY1} tint={C.water} />
              {mode !== "step" && (
                <InputRow symbol="b₂" label={x.db2} value={b2} min={0.5} max={20} step={0.1} digits={1} unit="m" onChange={setB2} tint={C.critical} />
              )}
              {mode !== "width" && (
                <InputRow symbol="Δz" label={x.ddz} value={dz} min={-0.5} max={1.5} step={0.005} digits={3} unit="m" onChange={setDz} tint={C.critical} />
              )}
            </InputTable>

            <div className="mt-3.5 flex flex-col gap-2.5">
              <PresetRow
                label={t.presetExample}
                presets={preset(mode, u, r, {
                  setQ, setB1, setY1, setB2, setDz,
                })}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag alert={r.choked}>
                {r.choked ? u.choked : r.branch === "subkritis" ? u.sub : u.sup}
              </Flag>
              {!r.choked && (
                <span className="value label text-[0.78rem] text-ink-3">
                  {u.margin} {fmt((1 - r.chokeRatio) * 100, 1)}%
                </span>
              )}
            </div>
            <ResultTable
              rows={[
                { symbol: "y₂", label: u.rY2, value: r.choked ? "—" : fmt(r.y2, 3), unit: "m", tint: C.water, strong: true },
                { symbol: "Fr₂", label: u.rFr2, value: r.choked ? "1,000" : fmt(r.Fr2, 3), strong: true },
                { symbol: "E₁", label: u.rE1, value: fmt(r.E1, 3), unit: "m", tint: C.energy },
                { symbol: "E₂", label: u.rE2, value: fmt(r.E2, 3), unit: "m", tint: C.energy },
                { symbol: "Emin", label: u.rEmin, value: fmt(r.Emin2, 3), unit: "m", tint: C.critical },
                { symbol: "yc₂", label: u.rYc2, value: fmt(r.yc2, 3), unit: "m", tint: C.critical },
                { symbol: "q₂", label: u.rQ2, value: fmt(r.q2, 3), unit: "m²/s" },
                { symbol: "Fr₁", label: u.rFr1, value: fmt(r.Fr1, 3) },
                { symbol: "Δzmax", label: u.rDzMax, value: fmt(r.dzMax, 3), unit: "m", tint: C.signal },
                { symbol: "b₂min", label: u.rB2Min, value: fmt(r.b2Min, 2), unit: "m", tint: C.signal },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(mode, r, lang, y1, b1, b2Efektif, dzEfektif)}</Note>
          </Block>
        </>
      }
      verification={
        <Verification checks={checksTransition(Q, b1, y1, b2Efektif, dzEfektif)} />
      }
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>E = y +</span>
                <Frac num="q²" den="2 · g · y²" />
                <span className="ml-5">E₂ = E₁ − Δz</span>
              </Eq>
              <Eq>
                <span>Emin = 1,5 · yc</span>
                <span className="ml-5">Δzmax = E₁ − Emin₂</span>
              </Eq>
              <Eq>
                <span>b₂min =</span>
                <Frac num="Q" den={<>√( g · ( E₂ / 1,5 )³ )</>} />
              </Eq>
            </>
          }
          note={x.note}
          refs={[...refs[lang]]}
        />
      }
    />
  );
}

/* ------------------------------------------------------------------ *
 * Teks yang sama untuk ketiga lembar
 * ------------------------------------------------------------------ */

const UMUM = {
  id: {
    sub: "Subkritis",
    sup: "Superkritis",
    choked: "Tersendat",
    margin: "cadangan energi",
    rY2: "Kedalaman hilir",
    rFr2: "Froude hilir",
    rE1: "Energi spesifik hulu",
    rE2: "Energi tersedia di hilir",
    rEmin: "Energi minimum yang dibutuhkan",
    rYc2: "Kedalaman kritis hilir",
    rQ2: "Debit satuan hilir",
    rFr1: "Froude hulu",
    rDzMax: "Kenaikan dasar terbesar",
    rB2Min: "Lebar tersempit",
    pAman: "Aman",
    pHampir: "Hampir tersendat",
    pTersendat: "Tersendat",
    pSuper: "Aliran superkritis",
  },
  en: {
    sub: "Subcritical",
    sup: "Supercritical",
    choked: "Choked",
    margin: "energy margin",
    rY2: "Downstream depth",
    rFr2: "Downstream Froude",
    rE1: "Upstream specific energy",
    rE2: "Energy available downstream",
    rEmin: "Minimum energy required",
    rYc2: "Downstream critical depth",
    rQ2: "Downstream unit discharge",
    rFr1: "Upstream Froude",
    rDzMax: "Maximum bed rise",
    rB2Min: "Narrowest width",
    pAman: "Clear",
    pHampir: "Near choking",
    pTersendat: "Choked",
    pSuper: "Supercritical flow",
  },
} as const;

// Nilainya dilonggarkan menjadi string biasa, karena `as const` membuat kedua
// bahasa punya tipe harfiah yang berbeda dan tidak saling tertukar.
type Umum = { [K in keyof (typeof UMUM)["id"]]: string };

function preset(
  mode: TransitionMode,
  u: Umum,
  r: ReturnType<typeof transition>,
  set: {
    setQ: (v: number) => void;
    setB1: (v: number) => void;
    setY1: (v: number) => void;
    setB2: (v: number) => void;
    setDz: (v: number) => void;
  }
) {
  const dasar = () => {
    set.setQ(12);
    set.setB1(5);
    set.setY1(1.5);
  };
  const supers = () => {
    set.setQ(12);
    set.setB1(5);
    set.setY1(0.45);
  };

  if (mode === "width") {
    return [
      { label: u.pAman, apply: () => { dasar(); set.setB2(4.5); } },
      { label: u.pHampir, apply: () => { dasar(); set.setB2(3.45); } },
      { label: u.pTersendat, apply: () => { dasar(); set.setB2(2.8); } },
      { label: u.pSuper, apply: () => { supers(); set.setB2(4.5); } },
    ];
  }
  if (mode === "step") {
    return [
      { label: u.pAman, apply: () => { dasar(); set.setDz(0.15); } },
      { label: u.pHampir, apply: () => { dasar(); set.setDz(0.36); } },
      { label: u.pTersendat, apply: () => { dasar(); set.setDz(0.55); } },
      { label: u.pSuper, apply: () => { supers(); set.setDz(0.1); } },
    ];
  }
  return [
    { label: u.pAman, apply: () => { dasar(); set.setB2(4.5); set.setDz(0.1); } },
    { label: u.pHampir, apply: () => { dasar(); set.setB2(4); set.setDz(0.24); } },
    { label: u.pTersendat, apply: () => { dasar(); set.setB2(3.5); set.setDz(0.45); } },
    { label: u.pSuper, apply: () => { supers(); set.setB2(4.5); set.setDz(0.1); } },
  ];
}

/* ------------------------------------------------------------------ *
 * Catatan yang menyesuaikan keadaan
 * ------------------------------------------------------------------ */

function notice(
  mode: TransitionMode,
  r: ReturnType<typeof transition>,
  lang: Lang,
  y1: number,
  b1: number,
  b2: number,
  dz: number
): string {
  const naik = r.y2 > y1;
  const beda = Math.abs(r.y2 - y1);
  const sisa = (1 - r.chokeRatio) * 100;

  if (lang === "en") {
    if (r.choked) {
      const sebab =
        mode === "width"
          ? `narrowing below ${r.b2Min.toFixed(2)} m`
          : `a bed rise above ${r.dzMax.toFixed(3)} m`;
      return `The flow is choked: ${sebab} leaves less energy downstream than the minimum the section needs. The transition cannot pass this discharge at the given upstream depth, so in reality the upstream water level rises until it can. The y₂ figure no longer applies, which is why it is shown as a dash rather than a number.`;
    }
    if (r.branch === "superkritis") {
      return `The flow is supercritical, and here it behaves against intuition: ${naik ? "narrowing or raising the bed makes the water rise" : "the depth falls"}, the opposite of the subcritical case. Read it off the energy curve: on the lower branch, less available energy means a greater depth. The margin before choking is ${sisa.toFixed(1)} per cent.`;
    }
    if (sisa < 12) {
      return `Only ${sisa.toFixed(1)} per cent of energy margin is left before choking. At this point a small extra narrowing or a slightly higher step tips the flow through critical, and the upstream level starts to rise. In design this is the boundary worth staying away from, not the one to sit on.`;
    }
    return `Subcritical flow: the depth ${naik ? "rises" : "falls"} by ${beda.toFixed(3)} m through the transition. This is the direction people find surprising, because narrowing a subcritical channel lowers the water rather than raising it. The upper branch of the energy curve explains it: less available energy means a smaller depth. Margin before choking is ${sisa.toFixed(1)} per cent.`;
  }

  if (r.choked) {
    const sebab =
      mode === "width"
        ? `penyempitan di bawah ${r.b2Min.toFixed(2)} m`
        : `kenaikan dasar di atas ${r.dzMax.toFixed(3)} m`;
    return `Aliran tersendat: ${sebab} menyisakan energi di hilir lebih kecil daripada energi minimum yang dibutuhkan penampang itu. Transisi ini tidak sanggup melewatkan debit tersebut pada kedalaman hulu yang diberikan, jadi di lapangan muka air hulu akan naik sampai sanggup. Angka y₂ tidak berlaku lagi, karena itu ditampilkan sebagai garis, bukan angka.`;
  }
  if (r.branch === "superkritis") {
    return `Alirannya superkritis, dan di sini perilakunya berlawanan naluri: ${naik ? "menyempitkan atau menaikkan dasar justru menaikkan muka air" : "kedalamannya justru turun"}, kebalikan dari kasus subkritis. Bacanya dari kurva energi: pada cabang bawah, energi yang lebih kecil berarti kedalaman yang lebih besar. Cadangan sebelum tersendat tinggal ${sisa.toFixed(1)} persen.`;
  }
  if (sisa < 12) {
    return `Cadangan energi tinggal ${sisa.toFixed(1)} persen sebelum tersendat. Pada titik ini, sedikit saja penyempitan tambahan atau ambang yang lebih tinggi sudah cukup melemparkan aliran melewati kondisi kritis, dan muka air hulu mulai naik. Dalam desain, batas ini untuk dijauhi, bukan untuk ditempati.`;
  }
  return `Aliran subkritis: kedalaman ${naik ? "naik" : "turun"} sebesar ${beda.toFixed(3)} m melewati transisi. Arah inilah yang sering mengejutkan, karena menyempitkan saluran subkritis justru menurunkan muka air, bukan menaikkannya. Cabang atas kurva energi menjelaskannya: energi tersedia yang lebih kecil berarti kedalaman yang lebih kecil. Cadangan sebelum tersendat ${sisa.toFixed(1)} persen.`;
}
