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
import { drawField, type FieldLine, type FieldMarker } from "@/lib/drawField";
import {
  WAVE_DEEP,
  WAVE_SHALLOW,
  fmt,
  linearWave,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksWave } from "@/lib/checks";

const REZIM = {
  id: { dangkal: "Air dangkal", menengah: "Kedalaman menengah", dalam: "Air dalam" },
  en: { dangkal: "Shallow water", menengah: "Intermediate depth", dalam: "Deep water" },
} as const;

const TXT = {
  id: {
    title: "Gelombang linear",
    sheetTitle: "Kecepatan rambat terhadap perioda, pada kedalaman yang dipilih",
    dT: "Perioda gelombang",
    dH: "Kedalaman air",
    dA: "Tinggi gelombang",
    pPantai: "Gelombang pantai, air dangkal",
    pLaut: "Gelombang laut lepas, air dalam",
    pAlun: "Alun panjang yang merasakan dasar",
    rPanjang: "Panjang gelombang",
    rC: "Kecepatan rambat puncak",
    rCg: "Kecepatan rambat tenaga",
    rNisbah: "Kecepatan tenaga dibagi kecepatan puncak",
    rRel: "Kedalaman dibagi panjang gelombang",
    rDangkal: "Kecepatan menurut hampiran air dangkal",
    rDalam: "Kecepatan menurut hampiran air dalam",
    rOrbit: "Setengah tinggi lintasan partikel di dasar",
    rasa: "Gerak airnya masih terasa sampai dasar",
    takRasa: "Dasarnya tidak merasakan gelombang ini",
    note:
      "Satu hubungan sebaran mengatur seluruh gelombang permukaan, dan seluruh hampiran yang dipakai sehari-hari adalah potongan darinya. Di air dalam, tangen hiperbolik mendekati satu dan kecepatan rambatnya hanya bergantung pada perioda; gelombang yang periodanya panjang melaju lebih cepat, dan itulah sebabnya alun dari badai yang jauh tiba lebih dulu daripada gelombang pendeknya, berhari-hari lebih dulu. Di air dangkal, tangen hiperbolik mendekati sudutnya sendiri dan kecepatannya hanya bergantung pada kedalaman; seluruh perioda melaju sama cepat, gelombangnya berhenti tersebar, dan bentuk yang datang bertahan sebagai bentuk. Itulah sebabnya tsunami, yang periodanya menit dan bukan detik, selalu berada dalam air dangkal bahkan di tengah samudra, dan sampai ke pantai masih berbentuk seperti saat berangkat. Satu hal lagi yang pantas diperhatikan adalah kecepatan tenaganya. Di air dalam tenaganya bergerak setengah kecepatan puncaknya, sehingga puncak-puncak gelombang muncul di belakang sekelompok gelombang, berjalan maju melewatinya, dan lenyap di depannya. Di air dangkal keduanya sama, dan gejala itu hilang sama sekali.",
  },
  en: {
    title: "Linear wave",
    sheetTitle: "Celerity against period, at the chosen depth",
    dT: "Wave period",
    dH: "Water depth",
    dA: "Wave height",
    pPantai: "A coastal wave in shallow water",
    pLaut: "An open-sea wave in deep water",
    pAlun: "A long swell that feels the bottom",
    rPanjang: "Wavelength",
    rC: "Celerity of the crest",
    rCg: "Celerity of the energy",
    rNisbah: "Energy celerity over crest celerity",
    rRel: "Depth over wavelength",
    rDangkal: "Celerity by the shallow-water approximation",
    rDalam: "Celerity by the deep-water approximation",
    rOrbit: "Half-height of the particle orbit at the bed",
    rasa: "The water motion still reaches the bed",
    takRasa: "The bed does not feel this wave",
    note:
      "One dispersion relation governs every surface wave, and every approximation used in daily work is a slice of it. In deep water the hyperbolic tangent approaches one and the celerity depends on the period alone; waves of longer period travel faster, which is why the swell from a distant storm arrives days before its short waves. In shallow water the tangent approaches its own argument and the celerity depends on the depth alone; every period travels at the same speed, the waves stop dispersing, and a shape that arrives survives as a shape. That is why a tsunami, whose period is minutes rather than seconds, is always in shallow water even in mid-ocean, and reaches the coast still shaped as it set out. One more thing deserves attention, the celerity of the energy. In deep water the energy moves at half the crest speed, so crests appear at the back of a group of waves, run forward through it, and vanish at its front. In shallow water the two are equal and the phenomenon disappears entirely.",
  },
} as const;

const REFS = {
  id: [
    "Airy, G.B. (1845). Tides and waves. Encyclopaedia Metropolitana.",
    "Dean, R.G. & Dalrymple, R.A. (1991). Water Wave Mechanics for Engineers and Scientists.",
    "Holthuijsen, L.H. (2007). Waves in Oceanic and Coastal Waters.",
    "U.S. Army Corps of Engineers (2002). Coastal Engineering Manual, bagian II.",
  ],
  en: [
    "Airy, G.B. (1845). Tides and waves. Encyclopaedia Metropolitana.",
    "Dean, R.G. & Dalrymple, R.A. (1991). Water Wave Mechanics for Engineers and Scientists.",
    "Holthuijsen, L.H. (2007). Waves in Oceanic and Coastal Waters.",
    "U.S. Army Corps of Engineers (2002). Coastal Engineering Manual, part II.",
  ],
} as const;

export function GelombangLinearClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [perioda, setPerioda] = useState(8);
  const [dalam, setDalam] = useState(20);
  const [tinggi, setTinggi] = useState(1);

  const r = linearWave(perioda, dalam, tinggi);

  const ref = useCanvas(
    (ctx, w, ch) => {
      /* Lengkung sebarannya, dipetakan pada rentang perioda satu sampai enam
         puluh detik supaya alun panjang ikut masuk ke dalam bidangnya. */
      const tMin = 1;
      const tMax = 60;
      const n = 120;
      const tepat: { x: number; y: number }[] = [];
      const dangkal: { x: number; y: number }[] = [];
      const laut: { x: number; y: number }[] = [];
      for (let i = 0; i <= n; i++) {
        const Ti = tMin * Math.pow(tMax / tMin, i / n);
        const g = linearWave(Ti, dalam, tinggi);
        tepat.push({ x: Ti, y: g.celerity });
        dangkal.push({ x: Ti, y: g.shallowCelerity });
        laut.push({ x: Ti, y: g.deepCelerity });
      }

      const garis: FieldLine[] = [
        {
          pts: laut,
          color: C.ink3,
          weight: W.hair,
          dash: DASH.hidden,
          label: T.deepWaterLimit,
          labelAt: 0.34,
          labelDy: -10,
          labelAlign: "center",
        },
        {
          pts: dangkal,
          color: C.ink3,
          weight: W.hair,
          dash: DASH.axis,
          label: T.shallowWaterLimit,
          labelAt: 0.9,
          labelDy: 15,
          labelAlign: "right",
        },
        {
          pts: tepat,
          color: C.water,
          weight: W.bold,
          dash: DASH.solid,
          label: T.waveSurface,
          labelAt: 0.62,
          labelDy: -12,
          labelAlign: "center",
        },
      ];

      const titik: FieldMarker[] = [
        { x: perioda, y: r.celerity, color: C.energy, size: 5, filled: true },
        { x: perioda, y: r.groupVelocity, color: C.critical, size: 5, filled: false },
      ];

      const cMax = Math.max(r.shallowCelerity, ...tepat.map((p) => p.y)) * 1.18;

      drawField(
        ctx,
        w,
        ch,
        {
          xMin: 0,
          xMax: tMax,
          yMin: 0,
          yMax: cMax,
          equalScale: false,
          lines: garis,
          markers: titik,
          heading: REZIM[lang][r.regime],
          headingColor: C.ink2,
          axisX: T.axWavePeriod,
          axisY: T.axCelerity,
        },
        lang
      );
    },
    [perioda, dalam, tinggi, lang]
  );

  return (
    <LabShell
      sheet="FP-03"
      subject={SUBJECTS.FP[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Di <Term tint={C.water}>air dalam</Term> kecepatannya hanya
            bergantung pada perioda; di{" "}
            <Term tint={C.critical}>air dangkal</Term> hanya pada kedalaman, dan
            seluruh perioda melaju sama cepat.
          </p>
        ) : (
          <p>
            In <Term tint={C.water}>deep water</Term> the celerity depends on the
            period alone; in <Term tint={C.critical}>shallow water</Term> on the
            depth alone, and every period travels at the same speed.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FP-03"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, s, m/s)" },
            { label: "L", value: `${fmt(r.length, 1)} m` },
            { label: "c", value: `${fmt(r.celerity, 2)} m/s`, tint: C.energy },
            { label: "cg/c", value: fmt(r.groupRatio, 3), tint: C.critical },
            { label: "h/L", value: fmt(r.relativeDepth, 3) },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="T" label={x.dT} value={perioda} min={1} max={60} step={0.5} digits={1} unit="s" onChange={setPerioda} tint={C.energy} />
              <InputRow symbol="h" label={x.dH} value={dalam} min={0.5} max={500} step={0.5} digits={1} unit="m" onChange={setDalam} tint={C.water} />
              <InputRow symbol="H" label={x.dA} value={tinggi} min={0.1} max={6} step={0.1} digits={1} unit="m" onChange={setTinggi} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pPantai, apply: () => { setPerioda(8); setDalam(2); setTinggi(1); } },
                  { label: x.pLaut, apply: () => { setPerioda(8); setDalam(200); setTinggi(2); } },
                  { label: x.pAlun, apply: () => { setPerioda(20); setDalam(40); setTinggi(1.5); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={C.ink2}>{REZIM[lang][r.regime]}</Flag>
              <Flag tint={r.feelsBottom ? C.critical : C.water}>
                {r.feelsBottom ? x.rasa : x.takRasa}
              </Flag>
            </div>
            <ResultTable
              rows={[
                { symbol: "L", label: x.rPanjang, value: fmt(r.length, 2), unit: "m", strong: true },
                { symbol: "c", label: x.rC, value: fmt(r.celerity, 3), unit: "m/s", tint: C.energy, strong: true },
                { symbol: "cg", label: x.rCg, value: fmt(r.groupVelocity, 3), unit: "m/s", tint: C.critical, strong: true },
                { symbol: "cg/c", label: x.rNisbah, value: fmt(r.groupRatio, 4) },
                { symbol: "h/L", label: x.rRel, value: fmt(r.relativeDepth, 4) },
                { symbol: "√gh", label: x.rDangkal, value: fmt(r.shallowCelerity, 3), unit: "m/s" },
                { symbol: "gT/2π", label: x.rDalam, value: fmt(r.deepCelerity, 3), unit: "m/s" },
                { symbol: "a₀", label: x.rOrbit, value: fmt(r.bottomOrbit, 4), unit: "m", tint: r.feelsBottom ? C.critical : undefined },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(perioda, dalam, tinggi, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksWave(perioda, dalam, tinggi)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>σ² = g k tanh(k h)</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "hubungan sebaran, dan seluruh hampirannya potongan darinya"
                    : "the dispersion relation, of which every approximation is a slice"}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `air dangkal bila h/L < ${fmt(WAVE_SHALLOW, 2)}: c → √(gh); air dalam bila h/L > ${fmt(WAVE_DEEP, 2)}: c → gT/2π`
                    : `shallow if h/L < ${fmt(WAVE_SHALLOW, 2)}: c → √(gh); deep if h/L > ${fmt(WAVE_DEEP, 2)}: c → gT/2π`}
                </span>
              </Eq>
              <Eq>
                <span>cg =</span>
                <Frac num="c" den="2" />
                <span>(1 + 2kh / sinh 2kh)</span>
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

function notice(perioda: number, dalam: number, tinggi: number, lang: Lang) {
  const a = linearWave(perioda, dalam, tinggi);
  const panjang = linearWave(perioda * 2.5, dalam, tinggi);
  const laut = linearWave(perioda, 500, tinggi);

  if (lang === "en")
    return `At a period of ${fmt(perioda, 1)} seconds in ${fmt(dalam, 1)} metres of water the crest travels at ${fmt(a.celerity, 2)} metres a second while its energy travels at ${fmt(a.groupVelocity, 2)}, a ratio of ${fmt(a.groupRatio, 2)}. Lengthen the period to ${fmt(perioda * 2.5, 1)} seconds and the celerity becomes ${fmt(panjang.celerity, 2)}: ${panjang.regime === "dangkal" ? "it has stopped growing, because in shallow water the depth alone decides it" : "it keeps growing, because the wave is still deep enough to disperse"}. Take the same period into 500 metres of water and it reaches ${fmt(laut.celerity, 2)} metres a second, the deep-water limit, beyond which more depth changes nothing at all.`;
  return `Pada perioda ${fmt(perioda, 1)} detik di air setinggi ${fmt(dalam, 1)} meter, puncaknya melaju ${fmt(a.celerity, 2)} meter tiap detik sementara tenaganya melaju ${fmt(a.groupVelocity, 2)}, yaitu nisbah ${fmt(a.groupRatio, 2)}. Panjangkan periodanya menjadi ${fmt(perioda * 2.5, 1)} detik dan kecepatannya menjadi ${fmt(panjang.celerity, 2)}: ${panjang.regime === "dangkal" ? "ia berhenti bertambah, karena di air dangkal kedalamannya sendiri yang menentukan" : "ia terus bertambah, karena gelombangnya masih cukup dalam untuk tersebar"}. Bawa perioda yang sama ke air setinggi 500 meter dan ia mencapai ${fmt(laut.celerity, 2)} meter tiap detik, yaitu batas air dalam, dan lebih dalam daripada itu tidak mengubah apa pun lagi.`;
}
