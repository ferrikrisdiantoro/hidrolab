"use client";

import { useState } from "react";
import { Basis, Eq, LabShell } from "@/components/LabShell";
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
  HABITAT_BEST_DEPTH,
  HABITAT_BEST_VELOCITY,
  fmt,
  riverHabitat,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksHabitat } from "@/lib/checks";

const TXT = {
  id: {
    title: "Habitat sungai",
    sheetTitle: "Luas layak terbobot terhadap debit, pada penampang parabola",
    dQ: "Debit",
    dW: "Lebar sungai pada muka air penuh",
    dS: "Kemiringan dasar",
    dN: "Angka kekasaran Manning",
    pKecil: "Debit rendah, terlalu dangkal",
    pPuncak: "Debit di puncak luas layak",
    pBanjir: "Debit tinggi, terlalu deras",
    rDalam: "Kedalaman terbesar di tengah",
    rBasah: "Lebar basah",
    rV: "Kecepatan rata-rata penampang",
    rLuas: "Luas layak tiap meter panjang sungai",
    rBagi: "Bagian lebar basah yang layak",
    rBaik: "Debit yang memberi luas layak terbesar",
    rLuasBaik: "Luas layak terbesar itu",
    naik: "Menambah debit masih menambah luas layaknya",
    turun: "Menambah debit justru mengurangi luas layaknya",
    note:
      "Lembar ini menjawab pertanyaan yang tidak dapat dijawab neraca air mana pun: berapa debit yang paling baik bagi ikan. Jawabannya bukan sebanyak-banyaknya. Debit yang terlalu kecil menyisakan air yang terlalu dangkal, dan debit yang terlalu besar membuatnya terlalu deras; keduanya sama-sama tidak layak, dan di antara keduanya ada satu puncak. Puncak itulah yang dipakai menetapkan debit pemeliharaan sungai di bawah bendung, dan cara ini, yang disebut IFIM, dipakai justru karena ia mengubah pertanyaan tata air menjadi pertanyaan luasan yang dapat ditawar dengan kebutuhan irigasi dalam satuan yang sama. Dua peringatan pantas menyertainya. Pertama, lengkung kelayakan yang dipakai di sini berasal dari satu jenis ikan pada satu tahap hidupnya; jenis lain punya puncak di tempat lain, dan menetapkan satu debit untuk seluruh sungai berarti memilih jenis mana yang dimenangkan. Kedua, luas layak bukan populasi. Ia luasan yang layak dihuni, bukan jumlah ikan yang akan menghuninya, dan menyamakan keduanya adalah kekeliruan yang telah lama diketahui tetapi terus terjadi dalam dokumen perizinan.",
  },
  en: {
    title: "River habitat",
    sheetTitle: "Weighted usable area against discharge, on a parabolic section",
    dQ: "Discharge",
    dW: "River width at bankfull",
    dS: "Bed slope",
    dN: "Manning roughness",
    pKecil: "Low discharge, too shallow",
    pPuncak: "Discharge at the peak of usable area",
    pBanjir: "High discharge, too fast",
    rDalam: "Greatest depth at the centre",
    rBasah: "Wetted width",
    rV: "Section mean velocity",
    rLuas: "Usable area per metre of river length",
    rBagi: "Share of the wetted width that is usable",
    rBaik: "Discharge giving the largest usable area",
    rLuasBaik: "That largest usable area",
    naik: "More discharge still adds usable area",
    turun: "More discharge now removes usable area",
    note:
      "This sheet answers a question no water balance can answer: what discharge is best for the fish. The answer is not as much as possible. Too small a discharge leaves the water too shallow, and too large a one makes it too fast; both are unsuitable, and between them lies a single peak. That peak is what is used to set the maintenance flow of a river below a weir, and this method, called IFIM, is used precisely because it converts a question of water allocation into a question of area, which can then be traded against irrigation demand in the same unit. Two warnings belong with it. First, the suitability curves used here come from one species at one life stage; another species peaks elsewhere, and setting one discharge for the whole river means choosing which species wins. Second, usable area is not population. It is area fit to be occupied, not the number of fish that will occupy it, and equating the two is a long-known error that nonetheless keeps appearing in permit documents.",
  },
} as const;

const REFS = {
  id: [
    "Bovee, K.D. (1982). A guide to stream habitat analysis using the Instream Flow Incremental Methodology. USFWS FWS/OBS-82/26.",
    "Milhous, R.T., Updike, M.A. & Schneider, D.M. (1989). PHABSIM system reference manual. USFWS Biol. Rep. 89(16).",
    "Tharme, R.E. (2003). A global perspective on environmental flow assessment. River Res. Applic. 19, 397–441.",
    "Lamouroux, N. & Capra, H. (2002). Simple predictions of instream habitat model outputs. Freshwater Biology 47, 1543–1556.",
  ],
  en: [
    "Bovee, K.D. (1982). A guide to stream habitat analysis using the Instream Flow Incremental Methodology. USFWS FWS/OBS-82/26.",
    "Milhous, R.T., Updike, M.A. & Schneider, D.M. (1989). PHABSIM system reference manual. USFWS Biol. Rep. 89(16).",
    "Tharme, R.E. (2003). A global perspective on environmental flow assessment. River Res. Applic. 19, 397–441.",
    "Lamouroux, N. & Capra, H. (2002). Simple predictions of instream habitat model outputs. Freshwater Biology 47, 1543–1556.",
  ],
} as const;

export function HabitatSungaiClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Q, setQ] = useState(5);
  const [lebar, setLebar] = useState(20);
  const [kemiringan, setKemiringan] = useState(0.002);
  const [n, setN] = useState(0.035);

  const r = riverHabitat(Q, lebar, kemiringan, n);

  const ref = useCanvas(
    (ctx, w, ch) => {
      const garis: FieldLine[] = [
        {
          pts: r.curve.map((p) => ({ x: p.Q, y: p.usable })),
          color: C.water,
          weight: W.bold,
          dash: DASH.solid,
          label: T.usableAreaLabel,
          labelAt: 0.72,
          labelDy: 16,
          labelAlign: "center",
        },
        {
          /* Tegak lurus pada debit yang memberi puncaknya. */
          pts: [
            { x: r.bestDischarge, y: 0 },
            { x: r.bestDischarge, y: r.bestUsableArea },
          ],
          color: C.critical,
          weight: W.hair,
          dash: DASH.axis,
          label: T.suitabilityCurve,
          labelAt: 1,
          labelDy: -10,
          labelAlign: "center",
        },
      ];

      const titik: FieldMarker[] = [
        { x: Q, y: r.usableArea, color: C.energy, size: 5, filled: true },
        {
          x: r.bestDischarge,
          y: r.bestUsableArea,
          color: C.critical,
          size: 5,
          filled: false,
        },
      ];

      const qMax = Math.max(...r.curve.map((p) => p.Q), Q) * 1.06;
      const uMax = Math.max(...r.curve.map((p) => p.usable), r.usableArea) * 1.18;

      drawField(
        ctx,
        w,
        ch,
        {
          xMin: 0,
          xMax: qMax,
          yMin: 0,
          yMax: uMax > 0 ? uMax : 1,
          equalScale: false,
          lines: garis,
          markers: titik,
          heading: r.pastPeak ? x.turun : x.naik,
          headingColor: r.pastPeak ? C.critical : C.water,
          axisX: T.axDischargeQ,
          axisY: T.axUsable,
        },
        lang
      );
    },
    [Q, lebar, kemiringan, n, lang]
  );

  return (
    <LabShell
      sheet="EH-06"
      subject={SUBJECTS.EH[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Debit terbaik bagi ikan bukan sebanyak-banyaknya. Terlalu kecil
            terlalu <Term tint={C.water}>dangkal</Term>, terlalu besar terlalu{" "}
            <Term tint={C.critical}>deras</Term>, dan di antaranya ada satu
            puncak.
          </p>
        ) : (
          <p>
            The best discharge for fish is not the largest. Too little is too{" "}
            <Term tint={C.water}>shallow</Term>, too much is too{" "}
            <Term tint={C.critical}>fast</Term>, and between them lies a single
            peak.
          </p>
        )
      }
      drawing={
        <Sheet
          number="EH-06"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m³/s, m, m²)" },
            { label: "WUA", value: `${fmt(r.usableArea, 2)} m²`, tint: C.energy },
            { label: "Qopt", value: `${fmt(r.bestDischarge, 2)} m³/s`, tint: C.critical },
            { label: "h", value: `${fmt(r.maxDepth, 2)} m` },
            { label: "V", value: `${fmt(r.meanVelocity, 2)} m/s` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q} min={0.05} max={120} step={0.05} digits={2} unit="m³/s" onChange={setQ} tint={C.energy} />
              <InputRow symbol="W" label={x.dW} value={lebar} min={2} max={120} step={1} digits={0} unit="m" onChange={setLebar} />
              <InputRow symbol="S" label={x.dS} value={kemiringan * 1000} min={0.2} max={20} step={0.1} digits={1} unit="‰" onChange={(v) => setKemiringan(v / 1000)} />
              <InputRow symbol="n" label={x.dN} value={n} min={0.018} max={0.08} step={0.001} digits={3} onChange={setN} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pKecil, apply: () => { setQ(0.3); setLebar(20); setKemiringan(0.002); setN(0.035); } },
                  { label: x.pPuncak, apply: () => { setQ(5); setLebar(20); setKemiringan(0.002); setN(0.035); } },
                  { label: x.pBanjir, apply: () => { setQ(90); setLebar(20); setKemiringan(0.002); setN(0.035); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5">
              <Flag tint={r.pastPeak ? C.critical : C.water}>
                {r.pastPeak ? x.turun : x.naik}
              </Flag>
            </div>
            <ResultTable
              rows={[
                { symbol: "h", label: x.rDalam, value: fmt(r.maxDepth, 3), unit: "m" },
                { symbol: "B", label: x.rBasah, value: fmt(r.wettedWidth, 2), unit: "m" },
                { symbol: "V", label: x.rV, value: fmt(r.meanVelocity, 3), unit: "m/s" },
                { symbol: "WUA", label: x.rLuas, value: fmt(r.usableArea, 3), unit: "m²", tint: C.energy, strong: true },
                { symbol: "—", label: x.rBagi, value: fmt(r.usableFraction * 100, 1), unit: "%" },
                { symbol: "Qopt", label: x.rBaik, value: fmt(r.bestDischarge, 3), unit: "m³/s", tint: C.critical, strong: true },
                { symbol: "WUAm", label: x.rLuasBaik, value: fmt(r.bestUsableArea, 3), unit: "m²", tint: C.critical },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(Q, lebar, kemiringan, n, lang)}</Note>
          </Block>
        </>
      }
      verification={
        <Verification checks={checksHabitat(Q, lebar, kemiringan, n)} />
      }
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "WUA = Σ f(d) · f(V) · Δy, dipadukan sepanjang lebar basahnya"
                    : "WUA = Σ f(d) · f(V) · Δy, summed across the wetted width"}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `kelayakan memuncak pada kedalaman ${fmt(HABITAT_BEST_DEPTH, 2)} m dan kecepatan ${fmt(HABITAT_BEST_VELOCITY, 2)} m/s`
                    : `suitability peaks at a depth of ${fmt(HABITAT_BEST_DEPTH, 2)} m and a velocity of ${fmt(HABITAT_BEST_VELOCITY, 2)} m/s`}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "kecepatan tiap pias dari Manning pada kedalaman pias itu sendiri"
                    : "each strip's velocity from Manning at that strip's own depth"}
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
  Q: number,
  lebar: number,
  kemiringan: number,
  n: number,
  lang: Lang
) {
  const a = riverHabitat(Q, lebar, kemiringan, n);
  const setengah = riverHabitat(Q / 2, lebar, kemiringan, n);
  const dua = riverHabitat(Q * 2, lebar, kemiringan, n);

  if (lang === "en")
    return `At ${fmt(Q, 2)} cubic metres a second this reach offers ${fmt(a.usableArea, 2)} square metres of usable habitat per metre of length, which is ${fmt((a.usableArea / Math.max(a.bestUsableArea, 1e-9)) * 100, 0)} per cent of the best it can offer. Halve the discharge and it becomes ${fmt(setengah.usableArea, 2)}; double it and it becomes ${fmt(dua.usableArea, 2)}. The peak sits at ${fmt(a.bestDischarge, 2)} cubic metres a second. Notice that beyond that peak more water buys less habitat, and that a maintenance flow argued for on the grounds that more is better would in that range be arguing against the fish.`;
  return `Pada ${fmt(Q, 2)} meter kubik tiap detik, ruas ini memberi ${fmt(a.usableArea, 2)} meter persegi habitat layak tiap meter panjangnya, yaitu ${fmt((a.usableArea / Math.max(a.bestUsableArea, 1e-9)) * 100, 0)} persen yang terbaik yang dapat diberikannya. Separuhkan debitnya dan ia menjadi ${fmt(setengah.usableArea, 2)}; lipatduakan dan ia menjadi ${fmt(dua.usableArea, 2)}. Puncaknya terletak di ${fmt(a.bestDischarge, 2)} meter kubik tiap detik. Perhatikan bahwa melewati puncak itu, air yang lebih banyak justru membeli habitat yang lebih sedikit, dan debit pemeliharaan yang diperjuangkan dengan alasan makin banyak makin baik, pada rentang itu, sedang diperjuangkan melawan ikannya.`;
}
