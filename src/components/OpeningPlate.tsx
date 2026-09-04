"use client";

import { useRef, useState } from "react";
import { Sheet, Term } from "@/components/ui";
import { useCanvas } from "@/lib/useCanvas";
import { drawJump, makeStreaks, type Streak } from "@/lib/drawJump";
import {
  classifyJump,
  conjugateDepth,
  fmt,
  froude,
  jumpEnergyLoss,
  jumpLength,
} from "@/lib/hydraulics";
import { C } from "@/lib/theme";
import { useLang } from "@/lib/i18n";
import { str } from "@/lib/strings";

const TXT = {
  id: {
    title: "Loncatan air — saluran persegi mendatar",
    speed: "V₁ kecepatan hulu",
    lead: "Geser, dan seluruh lembar ikut berubah:",
    conj: "kedalaman konjugat",
    becomes: "menjadi",
    energy: "energi yang teredam",
    length: "dan panjang loncatan",
  },
  en: {
    title: "Hydraulic jump — horizontal rectangular channel",
    speed: "V₁ upstream velocity",
    lead: "Move it, and the whole sheet follows:",
    conj: "conjugate depth",
    becomes: "becomes",
    energy: "energy dissipated",
    length: "and jump length",
  },
} as const;

/**
 * Lembar pembuka.
 *
 * Bukan tangkapan layar dan bukan animasi rekaman: ini lembar yang sama
 * persis dengan OC-01, sudah bisa digeser sejak baris pertama halaman.
 * Pengunjung memegang alatnya sebelum membaca satu kalimat pun tentang
 * alat itu.
 */
export function OpeningPlate() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [V1, setV1] = useState(7.2);
  const y1 = 0.3;

  const Fr1 = froude(V1, y1);
  const y2 = Fr1 > 1 ? conjugateDepth(y1, Fr1) : y1;
  const dE = Fr1 > 1 ? jumpEnergyLoss(y1, y2) : 0;
  const klas = classifyJump(Fr1);

  const streaks = useRef<Streak[]>(makeStreaks(150));

  const ref = useCanvas(
    (ctx, w, h, tt, dt) =>
      drawJump(
        ctx,
        w,
        h,
        { y1, V1 },
        { showEnergy: true, streaks: streaks.current, t: tt, dt, lang }
      ),
    [V1, lang],
    { animate: true }
  );

  return (
    <div className="flex flex-col gap-4">
      <Sheet
        number="OC-01"
        title={x.title}
        rev="A"
        cells={[
          { label: t.tbScale, value: "1 : 20" },
          { label: t.tbUnit, value: "SI (m, m/s)" },
          { label: "y₁", value: `${fmt(y1)} m`, tint: C.water },
          { label: "V₁", value: `${fmt(V1, 1)} m/s`, tint: C.water },
          { label: "Fr₁", value: fmt(Fr1) },
          { label: t.tbRegime, value: klas.label[lang] },
        ]}
      >
        <canvas ref={ref} className="block h-full w-full" />
      </Sheet>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <label className="flex min-w-[280px] flex-1 items-center gap-3">
          <span className="stencil whitespace-nowrap">{x.speed}</span>
          <input
            type="range"
            min={1}
            max={14}
            step={0.1}
            value={V1}
            onChange={(e) => setV1(parseFloat(e.target.value))}
            aria-label={x.speed}
            style={{ "--slider-tint": C.water } as React.CSSProperties}
          />
          <span
            className="value label w-[5.4rem] text-right text-[0.9rem] font-semibold"
            style={{ color: C.water }}
          >
            {fmt(V1, 1)}
            <span className="ml-1 text-[0.72rem] font-normal text-ink-3">
              m/s
            </span>
          </span>
        </label>

        <p className="max-w-[48ch] text-[0.92rem] leading-[1.55] text-ink-2">
          {x.lead} <Term tint={C.water}>{x.conj}</Term> {x.becomes} {fmt(y2)} m,{" "}
          <Term tint={C.energy}>{x.energy}</Term> {fmt(dE, 3)} m, {x.length}{" "}
          <Term tint={C.critical}>Lj ≈ {fmt(jumpLength(y2), 1)} m</Term>.
        </p>
      </div>
    </div>
  );
}
