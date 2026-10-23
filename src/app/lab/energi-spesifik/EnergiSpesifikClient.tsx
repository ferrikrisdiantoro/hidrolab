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
import { drawEnergy } from "@/lib/drawEnergy";
import {
  G,
  REGIME_LABEL,
  classifyRegime,
  criticalDepth,
  fmt,
  frictionSlope,
  froude,
  normalDepth,
  normalDepthReachable,
  rectGeometry,
  slopeType,
  specificEnergy,
} from "@/lib/hydraulics";
import { C, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksEnergy } from "@/lib/checks";

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
    tak: "Melampaui kapasitas saluran",
    takNote: "Pada lebar dan kemiringan ini, saluran tidak sanggup mengalirkan debit sebesar itu berapa pun dalamnya. Tidak ada kedalaman normal yang memenuhi persamaan Manning, jadi angka y₀ di atas hanyalah batas atas pencarian, bukan hasil yang berlaku. Perbesar lebar dasar, perbesar kemiringan, atau kurangi debitnya.",
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
    tak: "Exceeds channel capacity",
    takNote: "At this width and slope the channel cannot carry that discharge at any depth. No normal depth satisfies Manning's equation, so the y₀ shown above is only the upper bound of the search, not a valid result. Widen the bed, steepen the slope, or reduce the discharge.",
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

/*
 * Batas pita Froude diturunkan dari batas classifyRegime, bukan ditulis 1
 * bulat. Model menggolongkan rezim dari y/yc dengan pita ±2 %, dan untuk
 * saluran persegi Fr = (yc/y)^1,5 tepat (V = q/y, yc³ = q²/g), jadi
 * y/yc = 1,02 setara Fr = 1,02^-1,5 dan y/yc = 0,98 setara Fr = 0,98^-1,5.
 * Dengan begitu penanda tidak pernah berada di pita "kritis" sementara
 * badge menulis "subkritis".
 *
 * Skala log 0,002 sampai 10 memuat seluruh jangkauan penggeser (Fr paling
 * kecil sekitar 0,0025 pada Q 0,5, b 0,5, n 0,07, S 0,05 ‰; paling besar
 * sekitar 5,4 pada Q 120, b 25, n 0,01, S 40 ‰), sehingga "di luar skala"
 * hanya muncul bila kedalaman normal tidak ada dan y₀ hanyalah batas atas
 * pencarian.
 */
const FR_SUB = Math.pow(1.02, -1.5);
const FR_SUPER = Math.pow(0.98, -1.5);

const NADA_REZIM: Record<string, Tone> = {
  subkritis: "water",
  kritis: "critical",
  superkritis: "energy",
};

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
  const terjangkau = normalDepthReachable(Q, b, n, S);
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
      status={
        <RegimeScale
          symbol="Fr"
          value={terjangkau ? Fr0 : NaN}
          invalid={!terjangkau}
          pesan={terjangkau ? undefined : x.tak}
          scale="log"
          digits={2}
          bands={[
            { from: 0.002, to: FR_SUB, label: REGIME_LABEL.subkritis[lang], tone: "water" },
            { from: FR_SUB, to: FR_SUPER, label: REGIME_LABEL.kritis[lang], tone: "critical" },
            { from: FR_SUPER, to: 10, label: REGIME_LABEL.superkritis[lang], tone: "energy" },
          ]}
        />
      }
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
                  {
                    label: x.sl[1],
                    /* Kemiringan kritis: kemiringan gesek Manning tepat pada
                       kedalaman kritis, jadi y₀ = yc dan Fr = 1. Dihitung dari
                       model, bukan ditulis, supaya tetap kritis bila Q, b,
                       atau n contoh ini diubah. (Angka lama 4,3 ‰ memberi
                       Fr 0,67, subkritis.) */
                    apply: () => {
                      setQ(12);
                      setB(5);
                      setN(0.025);
                      setS(frictionSlope(12, 5, criticalDepth(12 / 5), 0.025));
                    },
                  },
                  { label: x.sl[2], apply: () => { setS(0.02); setQ(12); setB(5); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            {/* Nama rezim dan peringatan kapasitas kini satu tempat saja,
                di kartu keadaan di bawah; jenis kemiringan ada di kop. */}
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
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.rq,
                    rumus: (<><span>q =</span><Frac num="Q" den="b" /></>),
                    isi: `${fmt(Q, 1)} / ${fmt(b, 1)}`,
                    hasil: fmt(q, 3),
                    satuan: "m²/s",
                  },
                  {
                    judul: x.rYc,
                    rumus: (<><span>yc =</span><Frac num="∛( q² )" den="∛g" /></>),
                    isi: `∛( ${fmt(q, 3)}² / ${fmt(G, 2)} )`,
                    hasil: fmt(yc, 3),
                    satuan: "m",
                    tint: C.critical,
                  },
                  {
                    judul: x.rE0,
                    rumus: (<><span>E₀ = y₀ +</span><Frac num="q²" den="2 · g · y₀²" /></>),
                    // Tanpa kedalaman normal, y₀ hanya batas atas pencarian.
                    isi: terjangkau
                      ? `${fmt(y0, 3)} + ${fmt(q, 3)}² / ( 2 · ${fmt(G, 2)} · ${fmt(y0, 3)}² )`
                      : "—",
                    hasil: terjangkau ? fmt(E0, 3) : "—",
                    satuan: "m",
                    tint: C.energy,
                  },
                  {
                    judul: x.rEmin,
                    rumus: <span>Emin = {fmt(1.5, 1)} · yc</span>,
                    isi: `${fmt(1.5, 1)} · ${fmt(yc, 3)}`,
                    hasil: fmt(Emin, 3),
                    satuan: "m",
                    tint: C.critical,
                  },
                ]}
              />
            </div>
          </Block>

          {terjangkau ? (
            <StateCard
              tone={NADA_REZIM[regime]}
              badge={REGIME_LABEL[regime][lang]}
              {...notice({ regime, y0, yc, Fr0, E0, Emin }, lang)}
            />
          ) : (
            <StateCard tone="invalid" badge={x.tak} state={x.takNote} />
          )}
        </>
      }
      verification={<Verification checks={checksEnergy(Q, b, n, S)} />}
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

/*
 * Isi kalimatnya sama dengan catatan lama satu paragraf; hanya dipecah:
 * kalimat pertama menyatakan keadaan, sisanya menjadi butir yang perlu
 * diperhatikan.
 */
function notice(
  s: { regime: string; y0: number; yc: number; Fr0: number; E0: number; Emin: number },
  lang: Lang
): { state: string; notice: string[] } {
  const y0 = fmt(s.y0, 3);
  const yc = fmt(s.yc, 3);
  const res = fmt((s.E0 - s.Emin), 3);

  if (lang === "en") {
    if (s.regime === "kritis")
      return {
        state: "Normal depth almost coincides with critical depth.",
        notice: [
          "This looks tidy on paper but is unstable in the field: a small disturbance sets the water surface swinging up and down without settling.",
          "In design, critical slope is best avoided.",
        ],
      };
    if (s.regime === "subkritis")
      return {
        state: `Normal depth ${y0} m sits above critical depth ${yc} m, so the channel is mild and the flow subcritical.`,
        notice: [
          "Control comes from downstream — a structure below will affect the water surface far upstream.",
          `There is ${res} m of energy in reserve above the minimum.`,
        ],
      };
    return {
      state: `Normal depth ${y0} m sits below critical depth, so the channel is steep and the flow supercritical with a Froude number of ${fmt(s.Fr0, 2)}.`,
      notice: [
        "Control now comes from upstream, and disturbances downstream cannot travel back up.",
        "Where flow this fast meets calm tailwater, a hydraulic jump forms — exactly the condition on sheet OC-01.",
      ],
    };
  }

  if (s.regime === "kritis")
    return {
      state: "Kedalaman normal hampir berimpit dengan kedalaman kritis.",
      notice: [
        "Kondisi ini terlihat rapi di atas kertas, tetapi di lapangan justru tidak stabil: gangguan kecil membuat muka air berayun naik-turun tanpa henti.",
        "Dalam desain, kemiringan kritis sebaiknya dihindari.",
      ],
    };
  if (s.regime === "subkritis")
    return {
      state: `Kedalaman normal ${y0} m berada di atas kedalaman kritis ${yc} m, jadi salurannya landai dan alirannya subkritis.`,
      notice: [
        "Pengendalian datang dari hilir — bangunan di hilir akan mempengaruhi muka air jauh ke arah hulu.",
        `Cadangan energinya ${res} m di atas energi minimum.`,
      ],
    };
  return {
    state: `Kedalaman normal ${y0} m berada di bawah kedalaman kritis, sehingga salurannya curam dan alirannya superkritis dengan Froude ${fmt(s.Fr0, 2)}.`,
    notice: [
      "Pengendalian kini datang dari hulu, dan gangguan di hilir tidak dapat menjalar ke atas.",
      "Bila aliran secepat ini bertemu air tenang di hilir, akan terbentuk loncatan air — persis kondisi pada lembar OC-01.",
    ],
  };
}
