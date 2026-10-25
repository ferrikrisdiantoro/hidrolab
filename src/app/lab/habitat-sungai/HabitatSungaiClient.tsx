"use client";

import { useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  Block,
  Hitungan,
  InputRow,
  InputTable,
  PresetRow,
  RegimeScale,
  ResultTable,
  Sheet,
  StateCard,
  Term,
} from "@/components/ui";
import { useCanvas } from "@/lib/useCanvas";
import { drawField, type FieldLine, type FieldMarker } from "@/lib/drawField";
import {
  HABITAT_BEST_DEPTH,
  HABITAT_BEST_VELOCITY,
  fmt,
  fmtPlain,
  riverHabitat,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
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
    rBasah: "Lebar basah (diandaikan basah penuh)",
    rV: "Kecepatan rata-rata penampang",
    rLuas: "Luas layak tiap meter panjang sungai",
    rBagi: "Bagian lebar basah yang layak",
    rBaik: "Debit yang memberi luas layak terbesar",
    rLuasBaik: "Luas layak terbesar itu",
    naik: "Menambah debit masih menambah luas layaknya",
    turun: "Menambah debit justru mengurangi luas layaknya",
    bNaik: "Menambah debit menambah habitat",
    bLewat: "Lewat puncak",
    terpotong: "Kedalaman terpotong batas pencarian",
    terpotongNote:
      "Kedalaman yang memenuhi debit ini melampaui batas pencarian model (10 000 m), jadi kedalaman, kecepatan, dan luas layaknya tidak dihitung dan ditulis \u201c\u2014\u201d. Kurangi debitnya, atau perlebar dan percuram sungainya.",
    hH: "Kedalaman tengah, dicari dengan bagi dua",
    hV: "Kecepatan rata-rata penampang",
    hF: "Kelayakan di pias tengah",
    hWUA: "Luas layak terbobot",
    hOpt: "Debit dengan luas layak terbesar",
    pias: "pias",
    kisi: "kisi 161 titik log, 0,001 sampai 10 000 m³/s",
    basahNote:
      "Penampang parabola di model ini menjaga lebar atasnya tetap W pada debit berapa pun, jadi seluruh lebarnya selalu basah dan lebar basah selalu sama dengan W. Pada sungai sungguhan lebar basah menyempit saat debit kecil; perbaikan modelnya sudah diusulkan.",
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
    rBasah: "Wetted width (assumed fully wetted)",
    rV: "Section mean velocity",
    rLuas: "Usable area per metre of river length",
    rBagi: "Share of the wetted width that is usable",
    rBaik: "Discharge giving the largest usable area",
    rLuasBaik: "That largest usable area",
    naik: "More discharge still adds usable area",
    turun: "More discharge now removes usable area",
    bNaik: "More flow adds habitat",
    bLewat: "Past the peak",
    terpotong: "Depth capped by the search limit",
    terpotongNote:
      "The depth that carries this discharge exceeds the model's search limit (10 000 m), so depth, velocity and usable area are not computed and are shown as \u201c\u2014\u201d. Reduce the discharge, or widen and steepen the river.",
    hH: "Centre depth, found by bisection",
    hV: "Section mean velocity",
    hF: "Suitability in the centre strip",
    hWUA: "Weighted usable area",
    hOpt: "Discharge with the largest usable area",
    pias: "strips",
    kisi: "161-point log grid, 0.001 to 10 000 m³/s",
    basahNote:
      "The parabolic section in this model keeps its top width at W for any discharge, so the whole width is always wet and the wetted width always equals W. In a real river the wetted width narrows at low flow; a model correction has been proposed.",
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
  const potong = r.depthCapped;
  const tampil = (v: number) => (potong ? NaN : v);
  /* Qopt dicari pada kisi 161 titik log (langkah sekitar 10 %), jadi hanya
     dua angka bermakna yang berarti. */
  const dOpt = Math.max(0, 1 - Math.floor(Math.log10(Math.max(r.bestDischarge, 1e-12))));
  const qOpt = fmt(r.bestDischarge, dOpt);
  /* Besaran untuk Hitungan, dijumlahkan dari pias model sendiri (r.cells),
     bukan dihitung ulang dengan rumus lain. */
  const dyPias = lebar / Math.max(r.cells.length, 1);
  const luasBasah = r.cells.reduce((a, c) => a + c.depth * dyPias, 0);
  const debitPias = r.cells.reduce((a, c) => a + c.velocity * c.depth * dyPias, 0);
  const tengah = r.cells[Math.floor(r.cells.length / 2)];
  const rasioQ = Q / r.bestDischarge;
  const nada: Tone = potong ? "invalid" : r.pastPeak ? "caution" : "water";

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
          /* Garis ini menandai debit terbaik, bukan lengkung kelayakannya;
             lengkung kelayakan tidak tergambar di lembar ini sama sekali. */
          label: `Qopt ${fmtPlain(r.bestDischarge, dOpt)} m³/s`,
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
          headingColor: r.pastPeak ? C.caution : C.water,
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
      status={
        <RegimeScale
          symbol="Q/Qopt"
          value={potong ? NaN : rasioQ}
          invalid={potong}
          pesan={potong ? x.terpotong : undefined}
          scale="log"
          digits={2}
          bands={
            potong
              ? [{ from: 0.001, to: 20000, label: x.terpotong, tone: "invalid" }]
              : [
                  { from: 0.001, to: 1, label: x.bNaik, tone: "water" },
                  { from: 1, to: 20000, label: x.bLewat, tone: "caution" },
                ]
          }
        />
      }
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
            { label: "WUA", value: potong ? "—" : `${fmt(r.usableArea, 2)} m²`, tint: C.energy },
            { label: "Qopt", value: `${qOpt} m³/s`, tint: C.critical },
            { label: "h", value: potong ? "—" : `${fmt(r.maxDepth, 2)} m` },
            { label: "V", value: potong ? "—" : `${fmt(r.meanVelocity, 2)} m/s` },
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
                  { label: x.pPuncak, apply: () => { setQ(2.1); setLebar(20); setKemiringan(0.002); setN(0.035); } },
                  { label: x.pBanjir, apply: () => { setQ(90); setLebar(20); setKemiringan(0.002); setN(0.035); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "h", label: x.rDalam, value: fmt(tampil(r.maxDepth), 3), unit: potong ? undefined : "m" },
                { symbol: "B", label: x.rBasah, value: fmt(tampil(r.wettedWidth), 2), unit: potong ? undefined : "m" },
                { symbol: "V", label: x.rV, value: fmt(tampil(r.meanVelocity), 3), unit: potong ? undefined : "m/s" },
                { symbol: "WUA", label: x.rLuas, value: fmt(tampil(r.usableArea), 3), unit: potong ? undefined : "m²", tint: C.energy, strong: true },
                { symbol: "—", label: x.rBagi, value: fmt(tampil(r.usableFraction * 100), 1), unit: potong ? undefined : "%" },
                { symbol: "Qopt", label: x.rBaik, value: qOpt, unit: "m³/s", tint: C.critical, strong: true },
                { symbol: "WUAm", label: x.rLuasBaik, value: fmt(r.bestUsableArea, 3), unit: "m²", tint: C.critical },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hH,
                    rumus: <span>Σ ( d^5/3 · √S / n ) · Δy = Q ,  d = h · ( 1 − s² )</span>,
                    isi: potong
                      ? "—"
                      : `Δy = ${fmt(lebar, 0)} / ${fmt(r.cells.length, 0)} = ${fmt(dyPias, 3)} m ;  Σ = ${fmt(debitPias, 3)} ≈ Q ${fmt(Q, 2)}`,
                    hasil: fmt(tampil(r.maxDepth), 3),
                    satuan: potong ? undefined : "m",
                    tint: C.water,
                  },
                  {
                    judul: x.hV,
                    rumus: (<><span>Vrata =</span><Frac num="Σ V · d · Δy" den="Σ d · Δy" />
                      <span>,  V = d^⅔ · √S / n</span></>),
                    isi: potong ? "—" : `${fmt(debitPias, 3)} / ${fmt(luasBasah, 3)}`,
                    hasil: fmt(tampil(r.meanVelocity), 3),
                    satuan: potong ? undefined : "m/s",
                  },
                  {
                    judul: x.hF,
                    rumus: <span>f(x) = exp( −( ( x − x* ) / ( {fmt(0.8, 1)} · x* ) )² ) ,  x* = {fmt(HABITAT_BEST_DEPTH, 2)} m ; {fmt(HABITAT_BEST_VELOCITY, 2)} m/s</span>,
                    isi: potong || !tengah
                      ? "—"
                      : `d ${fmt(tengah.depth, 3)} m → f(d) ${fmt(tengah.depthIndex, 3)} ;  V ${fmt(tengah.velocity, 3)} m/s → f(V) ${fmt(tengah.velocityIndex, 3)}`,
                    hasil: potong || !tengah ? "—" : fmt(tengah.combined, 3),
                  },
                  {
                    judul: x.hWUA,
                    rumus: <span>WUA = Σ f(d) · f(V) · Δy ;  WUA / B</span>,
                    isi: potong
                      ? "—"
                      : `${fmt(r.cells.length, 0)} ${x.pias} · Δy ${fmt(dyPias, 3)} m ;  ${fmt(r.usableArea, 3)} / ${fmt(r.wettedWidth, 2)} = ${fmt(r.usableFraction * 100, 1)} %`,
                    hasil: fmt(tampil(r.usableArea), 3),
                    satuan: potong ? undefined : "m²",
                    tint: C.energy,
                  },
                  {
                    judul: x.hOpt,
                    rumus: <span>Qopt = arg maks WUA( Q )</span>,
                    isi: `${x.kisi} ;  WUAm ${fmt(r.bestUsableArea, 3)} m²`,
                    hasil: qOpt,
                    satuan: "m³/s",
                    tint: C.critical,
                  },
                ]}
              />
            </div>
          </Block>

          {potong ? (
            <StateCard tone="invalid" badge={x.terpotong} state={x.terpotongNote} />
          ) : (
            <StateCard
              tone={nada}
              badge={r.pastPeak ? x.bLewat : x.bNaik}
              {...notice(Q, lebar, kemiringan, n, qOpt, lang)}
            />
          )}
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
  qOpt: string,
  lang: Lang
): { state: string; notice: string[] } {
  const x = TXT[lang];
  const a = riverHabitat(Q, lebar, kemiringan, n);
  const setengah = riverHabitat(Q / 2, lebar, kemiringan, n);
  const dua = riverHabitat(Q * 2, lebar, kemiringan, n);
  const persen = fmt((a.usableArea / Math.max(a.bestUsableArea, 1e-9)) * 100, 0);

  if (lang === "en")
    return {
      state: `WUA = ${fmt(a.usableArea, 2)} m², ${persen} % of the peak at Q = ${qOpt} m³/s; ${a.pastPeak ? "more discharge now removes habitat" : "more discharge still adds habitat"}.`,
      notice: [
        `Halve the discharge and the usable area becomes ${fmt(setengah.usableArea, 2)} m²; double it and it becomes ${fmt(dua.usableArea, 2)} m².`,
        `The peak sits at ${qOpt} m³/s. Beyond it more water buys less habitat, and a maintenance flow argued for on the grounds that more is better would in that range be arguing against the fish.`,
        "More water is not always more habitat.",
        x.basahNote,
      ],
    };
  return {
    state: `WUA = ${fmt(a.usableArea, 2)} m², ${persen} % dari puncak di Q = ${qOpt} m³/s; ${a.pastPeak ? "menambah debit justru mengurangi habitat" : "menambah debit masih menambah habitat"}.`,
    notice: [
      `Separuhkan debitnya dan luas layaknya menjadi ${fmt(setengah.usableArea, 2)} m²; lipatduakan dan ia menjadi ${fmt(dua.usableArea, 2)} m².`,
      `Puncaknya terletak di ${qOpt} m³/s. Melewati puncak itu, air yang lebih banyak justru membeli habitat yang lebih sedikit, dan debit pemeliharaan yang diperjuangkan dengan alasan makin banyak makin baik, pada rentang itu, sedang diperjuangkan melawan ikannya.`,
      "Lebih banyak air tidak selalu berarti lebih banyak habitat.",
      x.basahNote,
    ],
  };
}
