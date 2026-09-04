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
import { drawEnergy } from "@/lib/drawEnergy";
import {
  REGIME_LABEL,
  classifyRegime,
  criticalDepth,
  fmt,
  froude,
  normalDepth,
  rectGeometry,
  slopeType,
  specificEnergy,
} from "@/lib/hydraulics";
import { C } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";

const TXT = {
  id: {
    title: "Energi spesifik",
    sheetTitle: "Kurva energi spesifik dan penampang — saluran persegi",
    dQ: "Debit",
    db: "Lebar dasar",
    dn: "Kekasaran Manning",
    dS: "Kemiringan dasar",
    channel: "jenis saluran",
    ch: ["Beton halus", "Pasangan batu", "Tanah", "Bervegetasi"],
    slope: "kemiringan",
    sl: ["Landai", "Kritis", "Curam"],
    rYc: "Kedalaman kritis",
    rY0: "Kedalaman normal",
    rEmin: "Energi spesifik minimum",
    rE0: "Energi pada kedalaman normal",
    rFr: "Bilangan Froude",
    rV: "Kecepatan rata-rata",
    rA: "Luas basah",
    rP: "Keliling basah",
    rR: "Jari-jari hidraulik",
    rq: "Debit satuan",
    note: "Kedalaman normal dicari dengan membalik persamaan Manning: nilai y yang membuat debit hitung sama dengan debit yang diberikan. Karena fungsi itu naik monoton terhadap y, dipakai metode bagi dua yang selalu konvergen — lebih andal daripada Newton-Raphson, yang pada kemiringan sangat kecil bisa melompat ke nilai negatif dan gagal. Kurva di sebelah kiri dan penampang di sebelah kanan memakai skala kedalaman yang sama, sehingga garis kedalaman kritis menyeberang di ketinggian yang persis sama pada keduanya.",
  },
  en: {
    title: "Specific energy",
    sheetTitle: "Specific energy curve and cross section — rectangular channel",
    dQ: "Discharge",
    db: "Bed width",
    dn: "Manning roughness",
    dS: "Bed slope",
    channel: "channel type",
    ch: ["Smooth concrete", "Stone masonry", "Earth", "Vegetated"],
    slope: "slope",
    sl: ["Mild", "Critical", "Steep"],
    rYc: "Critical depth",
    rY0: "Normal depth",
    rEmin: "Minimum specific energy",
    rE0: "Energy at normal depth",
    rFr: "Froude number",
    rV: "Mean velocity",
    rA: "Wetted area",
    rP: "Wetted perimeter",
    rR: "Hydraulic radius",
    rq: "Unit discharge",
    note: "Normal depth is found by inverting Manning's equation: the depth y at which the computed discharge equals the given one. Because that function rises monotonically with y, bisection is used and always converges — more dependable than Newton-Raphson, which on very flat slopes can jump to a negative value and fail. The curve on the left and the section on the right share the same depth scale, so the critical depth line crosses at exactly the same height on both.",
  },
} as const;

const REFS = {
  id: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Bab 3 — Energy and Momentum Principles.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan.",
    "Manning, R. (1891). On the Flow of Water in Open Channels and Pipes. Transactions of the Institution of Civil Engineers of Ireland.",
    "USGS (1988). Basic Hydraulic Principles of Open-Channel Flow, Open-File Report 88-707.",
  ],
  en: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Chapter 3 — Energy and Momentum Principles.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan.",
    "Manning, R. (1891). On the Flow of Water in Open Channels and Pipes. Transactions of the Institution of Civil Engineers of Ireland.",
    "USGS (1988). Basic Hydraulic Principles of Open-Channel Flow, Open-File Report 88-707.",
  ],
} as const;

export function EnergiSpesifikClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [Q, setQ] = useState(12);
  const [b, setB] = useState(5);
  const [n, setN] = useState(0.025);
  const [S, setS] = useState(0.0015);

  const q = Q / b;
  const yc = criticalDepth(q);
  const y0 = normalDepth(Q, b, n, S);
  const geo = rectGeometry(b, y0);
  const V0 = geo.A > 0 ? Q / geo.A : 0;
  const Fr0 = froude(V0, y0);
  const E0 = specificEnergy(y0, q);
  const Emin = 1.5 * yc;
  const regime = classifyRegime(y0, yc);
  const slope = slopeType(y0, yc);

  const ref = useCanvas(
    (ctx, w, h) => drawEnergy(ctx, w, h, { q, b, yc, y0 }, lang),
    [q, b, yc, y0, lang]
  );

  return (
    <LabShell
      sheet="OC-02"
      subject={SUBJECTS.OC[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Untuk satu debit, ada dua kedalaman yang membawa energi sama — satu
            di <Term tint={C.water}>cabang subkritis</Term>, satu di cabang
            superkritis. Titik baliknya adalah{" "}
            <Term tint={C.critical}>kedalaman kritis</Term>, dan di situlah
            energi spesifik mencapai nilai terkecilnya.
          </p>
        ) : (
          <p>
            For one discharge there are two depths carrying the same energy —
            one on the <Term tint={C.water}>subcritical branch</Term>, one on the
            supercritical branch. The turning point is{" "}
            <Term tint={C.critical}>critical depth</Term>, and that is where
            specific energy reaches its smallest value.
          </p>
        )
      }
      drawing={
        <Sheet
          number="OC-02"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "q", value: `${fmt(q, 3)} m²/s` },
            { label: "yc", value: `${fmt(yc, 3)} m`, tint: C.critical },
            { label: "y₀", value: `${fmt(y0, 3)} m`, tint: C.water },
            { label: t.tbSlope, value: slope[lang] },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q} min={0.5} max={120} step={0.5} digits={1} unit="m³/s" onChange={setQ} tint={C.water} />
              <InputRow symbol="b" label={x.db} value={b} min={0.5} max={25} step={0.1} digits={1} unit="m" onChange={setB} />
              <InputRow symbol="n" label={x.dn} value={n} min={0.01} max={0.07} step={0.001} digits={3} onChange={setN} />
              <InputRow symbol="S" label={x.dS} value={S * 1000} min={0.05} max={40} step={0.05} digits={2} unit="‰" onChange={(v) => setS(v / 1000)} />
            </InputTable>

            <div className="mt-3.5 flex flex-col gap-2.5">
              <PresetRow
                label={x.channel}
                presets={[
                  { label: x.ch[0], apply: () => setN(0.013) },
                  { label: x.ch[1], apply: () => setN(0.025) },
                  { label: x.ch[2], apply: () => setN(0.03) },
                  { label: x.ch[3], apply: () => setN(0.05) },
                ]}
              />
              <PresetRow
                label={x.slope}
                presets={[
                  { label: x.sl[0], apply: () => { setS(0.0008); setQ(12); setB(5); } },
                  { label: x.sl[1], apply: () => { setS(0.0043); setQ(12); setB(5); setN(0.025); } },
                  { label: x.sl[2], apply: () => { setS(0.02); setQ(12); setB(5); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag
                tint={regime === "kritis" ? C.critical : C.ink2}
                alert={regime === "kritis"}
              >
                {REGIME_LABEL[regime][lang]}
              </Flag>
              <span className="value label text-[0.78rem] text-ink-3">
                {slope[lang]}
              </span>
            </div>
            <ResultTable
              rows={[
                { symbol: "yc", label: x.rYc, value: fmt(yc, 3), unit: "m", tint: C.critical, strong: true },
                { symbol: "y₀", label: x.rY0, value: fmt(y0, 3), unit: "m", tint: C.water, strong: true },
                { symbol: "Emin", label: x.rEmin, value: fmt(Emin, 3), unit: "m", tint: C.critical },
                { symbol: "E₀", label: x.rE0, value: fmt(E0, 3), unit: "m", tint: C.energy },
                { symbol: "Fr", label: x.rFr, value: fmt(Fr0) },
                { symbol: "V", label: x.rV, value: fmt(V0), unit: "m/s" },
                { symbol: "A", label: x.rA, value: fmt(geo.A, 3), unit: "m²" },
                { symbol: "P", label: x.rP, value: fmt(geo.P, 3), unit: "m" },
                { symbol: "R", label: x.rR, value: fmt(geo.R, 3), unit: "m" },
                { symbol: "q", label: x.rq, value: fmt(q, 3), unit: "m²/s" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice({ regime, y0, yc, Fr0, E0, Emin }, lang)}</Note>
          </Block>
        </>
      }
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>E = y +</span>
                <Frac num="q²" den="2 · g · y²" />
                <span className="ml-6">yc =</span>
                <Frac num="∛( q² )" den="∛g" />
              </Eq>
              <Eq>
                <span>Q =</span>
                <Frac num="1" den="n" />
                <span>· A · R^⅔ · S^½</span>
                <span className="ml-3 text-ink-3">(Manning)</span>
              </Eq>
              <Eq>
                <span>Emin = 1,5 · yc</span>
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
  s: { regime: string; y0: number; yc: number; Fr0: number; E0: number; Emin: number },
  lang: Lang
): string {
  const y0 = s.y0.toFixed(3);
  const yc = s.yc.toFixed(3);
  const res = (s.E0 - s.Emin).toFixed(3);

  if (lang === "en") {
    if (s.regime === "kritis")
      return "Normal depth almost coincides with critical depth. This looks tidy on paper but is unstable in the field: a small disturbance sets the water surface swinging up and down without settling. In design, critical slope is best avoided.";
    if (s.regime === "subkritis")
      return `Normal depth ${y0} m sits above critical depth ${yc} m, so the channel is mild and the flow subcritical. Control comes from downstream — a structure below will affect the water surface far upstream. There is ${res} m of energy in reserve above the minimum.`;
    return `Normal depth ${y0} m sits below critical depth, so the channel is steep and the flow supercritical with a Froude number of ${s.Fr0.toFixed(2)}. Control now comes from upstream, and disturbances downstream cannot travel back up. Where flow this fast meets calm tailwater, a hydraulic jump forms — exactly the condition on sheet OC-01.`;
  }

  if (s.regime === "kritis")
    return "Kedalaman normal hampir berimpit dengan kedalaman kritis. Kondisi ini terlihat rapi di atas kertas, tetapi di lapangan justru tidak stabil: gangguan kecil membuat muka air berayun naik-turun tanpa henti. Dalam desain, kemiringan kritis sebaiknya dihindari.";
  if (s.regime === "subkritis")
    return `Kedalaman normal ${y0} m berada di atas kedalaman kritis ${yc} m, jadi salurannya landai dan alirannya subkritis. Pengendalian datang dari hilir — bangunan di hilir akan mempengaruhi muka air jauh ke arah hulu. Cadangan energinya ${res} m di atas energi minimum.`;
  return `Kedalaman normal ${y0} m berada di bawah kedalaman kritis, sehingga salurannya curam dan alirannya superkritis dengan Froude ${s.Fr0.toFixed(2)}. Pengendalian kini datang dari hulu, dan gangguan di hilir tidak dapat menjalar ke atas. Bila aliran secepat ini bertemu air tenang di hilir, akan terbentuk loncatan air — persis kondisi pada lembar OC-01.`;
}
