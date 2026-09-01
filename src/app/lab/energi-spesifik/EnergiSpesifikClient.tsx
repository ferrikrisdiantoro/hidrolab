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

export function EnergiSpesifikClient() {
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
    (ctx, w, h) => drawEnergy(ctx, w, h, { q, b, yc, y0 }),
    [q, b, yc, y0]
  );

  return (
    <LabShell
      sheet="SE-01"
      subject="Saluran terbuka"
      title="Energi spesifik"
      intro={
        <p>
          Untuk satu debit, ada dua kedalaman yang membawa energi sama — satu di{" "}
          <Term tint={C.water}>cabang subkritis</Term>, satu di cabang
          superkritis. Titik baliknya adalah{" "}
          <Term tint={C.critical}>kedalaman kritis</Term>, dan di situlah energi
          spesifik mencapai nilai terkecilnya.
        </p>
      }
      drawing={
        <Sheet
          number="SE-01"
          title="Kurva energi spesifik dan penampang — saluran persegi"
          rev="A"
          cells={[
            { label: "satuan", value: "SI (m, m³/s)" },
            { label: "q", value: `${fmt(q, 3)} m²/s` },
            { label: "yc", value: `${fmt(yc, 3)} m`, tint: C.critical },
            { label: "y₀", value: `${fmt(y0, 3)} m`, tint: C.water },
            { label: "kemiringan", value: slope },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading="masukan">
            <InputTable>
              <InputRow symbol="Q" label="Debit" value={Q} min={0.5} max={120} step={0.5} digits={1} unit="m³/s" onChange={setQ} tint={C.water} />
              <InputRow symbol="b" label="Lebar dasar" value={b} min={0.5} max={25} step={0.1} digits={1} unit="m" onChange={setB} />
              <InputRow symbol="n" label="Kekasaran Manning" value={n} min={0.01} max={0.07} step={0.001} digits={3} onChange={setN} />
              <InputRow symbol="S" label="Kemiringan dasar" value={S * 1000} min={0.05} max={40} step={0.05} digits={2} unit="‰" onChange={(v) => setS(v / 1000)} />
            </InputTable>

            <div className="mt-3.5 flex flex-col gap-2.5">
              <PresetRow
                label="jenis saluran"
                presets={[
                  { label: "Beton halus", apply: () => setN(0.013) },
                  { label: "Pasangan batu", apply: () => setN(0.025) },
                  { label: "Tanah", apply: () => setN(0.03) },
                  { label: "Bervegetasi", apply: () => setN(0.05) },
                ]}
              />
              <PresetRow
                label="kemiringan"
                presets={[
                  { label: "Landai", apply: () => { setS(0.0008); setQ(12); setB(5); } },
                  { label: "Kritis", apply: () => { setS(0.0043); setQ(12); setB(5); setN(0.025); } },
                  { label: "Curam", apply: () => { setS(0.02); setQ(12); setB(5); } },
                ]}
              />
            </div>
          </Block>

          <Block heading="hasil">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag
                tint={regime === "kritis" ? C.critical : C.ink2}
                alert={regime === "kritis"}
              >
                {REGIME_LABEL[regime]}
              </Flag>
              <span className="value label text-[0.78rem] text-ink-3">{slope}</span>
            </div>
            <ResultTable
              rows={[
                { symbol: "yc", label: "Kedalaman kritis", value: fmt(yc, 3), unit: "m", tint: C.critical, strong: true },
                { symbol: "y₀", label: "Kedalaman normal", value: fmt(y0, 3), unit: "m", tint: C.water, strong: true },
                { symbol: "Emin", label: "Energi spesifik minimum", value: fmt(Emin, 3), unit: "m", tint: C.critical },
                { symbol: "E₀", label: "Energi pada kedalaman normal", value: fmt(E0, 3), unit: "m", tint: C.energy },
                { symbol: "Fr", label: "Bilangan Froude", value: fmt(Fr0) },
                { symbol: "V", label: "Kecepatan rata-rata", value: fmt(V0), unit: "m/s" },
                { symbol: "A", label: "Luas basah", value: fmt(geo.A, 3), unit: "m²" },
                { symbol: "P", label: "Keliling basah", value: fmt(geo.P, 3), unit: "m" },
                { symbol: "R", label: "Jari-jari hidraulik", value: fmt(geo.R, 3), unit: "m" },
                { symbol: "q", label: "Debit satuan", value: fmt(q, 3), unit: "m²/s" },
              ]}
            />
          </Block>

          <Block heading="yang perlu diperhatikan">
            <Note>{notice({ regime, y0, yc, Fr0, E0, Emin })}</Note>
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
                <span className="ml-6 text-ink-3">untuk penampang persegi</span>
              </Eq>
            </>
          }
          note="Kedalaman normal dicari dengan membalik persamaan Manning: nilai y yang membuat debit hitung sama dengan debit yang diberikan. Karena fungsi itu naik monoton terhadap y, dipakai metode bagi dua yang selalu konvergen — lebih andal daripada Newton-Raphson, yang pada kemiringan sangat kecil bisa melompat ke nilai negatif dan gagal. Kurva di sebelah kiri dan penampang di sebelah kanan memakai skala kedalaman yang sama, sehingga garis kedalaman kritis menyeberang di ketinggian yang persis sama pada keduanya."
          refs={[
            "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Bab 3 — Energy and Momentum Principles.",
            "Henderson, F.M. (1966). Open Channel Flow. Macmillan.",
            "Manning, R. (1891). On the Flow of Water in Open Channels and Pipes. Transactions of the Institution of Civil Engineers of Ireland.",
            "USGS (1988). Basic Hydraulic Principles of Open-Channel Flow, Open-File Report 88-707.",
          ]}
        />
      }
    />
  );
}

function notice(s: {
  regime: string;
  y0: number;
  yc: number;
  Fr0: number;
  E0: number;
  Emin: number;
}): string {
  if (s.regime === "kritis") {
    return "Kedalaman normal hampir berimpit dengan kedalaman kritis. Kondisi ini terlihat rapi di atas kertas, tetapi di lapangan justru tidak stabil: gangguan kecil membuat muka air berayun naik-turun tanpa henti. Dalam desain, kemiringan kritis sebaiknya dihindari.";
  }
  if (s.regime === "subkritis") {
    return `Kedalaman normal ${s.y0.toFixed(3)} m berada di atas kedalaman kritis ${s.yc.toFixed(3)} m, jadi salurannya landai dan alirannya subkritis. Pengendalian datang dari hilir — bangunan di hilir akan mempengaruhi muka air jauh ke arah hulu. Cadangan energinya ${(s.E0 - s.Emin).toFixed(3)} m di atas energi minimum.`;
  }
  return `Kedalaman normal ${s.y0.toFixed(3)} m berada di bawah kedalaman kritis, sehingga salurannya curam dan alirannya superkritis dengan Froude ${s.Fr0.toFixed(2)}. Pengendalian kini datang dari hulu, dan gangguan di hilir tidak dapat menjalar ke atas. Bila aliran secepat ini bertemu air tenang di hilir, akan terbentuk loncatan air — persis kondisi pada lembar HJ-01.`;
}
