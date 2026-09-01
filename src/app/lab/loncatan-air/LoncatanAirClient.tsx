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

export function LoncatanAirClient() {
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
    (ctx, w, h, t, dt) =>
      drawJump(ctx, w, h, { y1, V1 }, {
        showEnergy,
        streaks: showFlow ? streaks.current : null,
        t,
        dt,
      }),
    [y1, V1, showEnergy, showFlow],
    { animate: showFlow }
  );

  return (
    <LabShell
      sheet="HJ-01"
      subject="Saluran terbuka"
      title="Loncatan air"
      intro={
        <p>
          Aliran <Term tint={C.water}>superkritis</Term> yang menabrak air tenang
          di hilir meredam energinya lewat loncatan. Kedalaman melompat dari y₁
          ke <Term tint={C.water}>y₂</Term>, dan selisih{" "}
          <Term tint={C.energy}>energinya</Term> hilang sebagai turbulensi.
        </p>
      }
      drawing={
        <Sheet
          number="HJ-01"
          title="Loncatan air — saluran persegi mendatar"
          rev="A"
          cells={[
            { label: "skala", value: "1 : 20" },
            { label: "satuan", value: "SI (m, m/s)" },
            { label: "q", value: `${fmt(q)} m²/s` },
            { label: "Fr₁", value: fmt(Fr1) },
            { label: "regime", value: klas.label },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading="masukan">
            <InputTable>
              <InputRow
                symbol="y₁"
                label="Kedalaman hulu"
                value={y1}
                min={0.08}
                max={1.2}
                step={0.01}
                unit="m"
                onChange={setY1}
                tint={C.water}
              />
              <InputRow
                symbol="V₁"
                label="Kecepatan hulu"
                value={V1}
                min={0.5}
                max={16}
                step={0.1}
                digits={1}
                unit="m/s"
                onChange={setV1}
                tint={C.water}
              />
            </InputTable>

            <div className="mt-3.5 flex flex-col gap-2.5">
              <PresetRow
                label="kondisi contoh"
                presets={[
                  { label: "Subkritis", apply: () => { setY1(0.9); setV1(2.0); } },
                  { label: "Berosilasi", apply: () => { setY1(0.35); setV1(6.0); } },
                  { label: "Mantap", apply: () => { setY1(0.25); setV1(8.5); } },
                  { label: "Kuat", apply: () => { setY1(0.15); setV1(12.0); } },
                ]}
              />
              <PresetRow
                label="tampilan"
                presets={[
                  {
                    label: showEnergy ? "Sembunyikan garis energi" : "Tampilkan garis energi",
                    apply: () => setShowEnergy((v) => !v),
                  },
                  {
                    label: showFlow ? "Hentikan alur aliran" : "Jalankan alur aliran",
                    apply: () => setShowFlow((v) => !v),
                  },
                ]}
              />
            </div>
          </Block>

          <Block heading="hasil">
            <ResultTable
              rows={[
                { symbol: "Fr₁", label: "Bilangan Froude hulu", value: fmt(Fr1), strong: true },
                { symbol: "y₂", label: "Kedalaman konjugat", value: hasJump ? fmt(y2) : "—", unit: "m", tint: C.water, strong: true },
                { symbol: "V₂", label: "Kecepatan hilir", value: fmt(V2), unit: "m/s" },
                { symbol: "Fr₂", label: "Froude hilir", value: fmt(Fr2) },
                { symbol: "E₁", label: "Energi spesifik hulu", value: fmt(E1), unit: "m", tint: C.energy },
                { symbol: "E₂", label: "Energi spesifik hilir", value: fmt(E2), unit: "m", tint: C.energy },
                { symbol: "ΔE", label: "Energi teredam", value: hasJump ? fmt(dE, 3) : "—", unit: "m", tint: C.energy },
                { label: "Persentase teredam", value: hasJump ? fmt(lossPct, 1) : "—", unit: "%", tint: C.energy },
                { symbol: "Lj", label: "Panjang loncatan", value: hasJump ? fmt(Lj, 1) : "—", unit: "m", tint: C.critical },
                { symbol: "q", label: "Debit satuan", value: fmt(q), unit: "m²/s" },
              ]}
            />
          </Block>

          <Block heading="kondisi">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag alert={!hasJump}>{klas.label}</Flag>
              <span className="value label text-[0.78rem] text-ink-3">
                {klas.range}
              </span>
            </div>
            <Note>{klas.note}</Note>
          </Block>

          <Block heading="yang perlu diperhatikan">
            <Note>{notice({ Fr1, hasJump, lossPct, Lj, y2, y1 })}</Note>
          </Block>
        </>
      }
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
          note="Persamaan kedua adalah bentuk Belanger, diturunkan dari kekekalan momentum pada saluran persegi mendatar dengan mengabaikan gesekan dasar di sepanjang loncatan. Perlu dicatat bahwa persamaan ini hanya memberi kedalaman di kedua ujung loncatan, bukan bentuk permukaan di antaranya — karena itu bagian dalam loncatan pada gambar digambar dengan titik rapat, bukan garis menerus. Panjang loncatan memakai pendekatan empiris umum L ≈ 6·y₂."
          refs={[
            "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Bab 15 — Hydraulic Jump and Its Use as Energy Dissipator.",
            "Peterka, A.J. (1978). Hydraulic Design of Stilling Basins and Energy Dissipators. USBR Engineering Monograph No. 25.",
            "USACE (1992). Hydraulic Design of Spillways, EM 1110-2-1603.",
            "Henderson, F.M. (1966). Open Channel Flow. Macmillan.",
          ]}
        />
      }
    />
  );
}

function notice(s: {
  Fr1: number;
  hasJump: boolean;
  lossPct: number;
  Lj: number;
  y2: number;
  y1: number;
}): string {
  if (!s.hasJump) {
    return "Pada kondisi ini aliran masih subkritis, sehingga loncatan tidak terbentuk. Kurangi kedalaman hulu atau naikkan kecepatan sampai Fr₁ melewati 1 — dan perhatikan bahwa mengubah kedalaman jauh lebih berpengaruh daripada mengubah kecepatan, karena kedalaman masuk sebagai akar di penyebut.";
  }
  const rasio = s.y2 / s.y1;
  if (s.Fr1 < 1.7) {
    return `Loncatan baru mulai terbentuk. Kedalaman hanya naik ${rasio.toFixed(1)} kali lipat dan energi yang teredam masih ${s.lossPct.toFixed(1)} persen. Untuk keperluan peredam energi, kondisi ini belum memadai.`;
  }
  if (s.Fr1 < 4.5) {
    return `Perhatikan gulungan di daerah loncatan: pancaran masuk berosilasi naik-turun dan gelombangnya menjalar jauh ke hilir. Meski energi yang teredam sudah ${s.lossPct.toFixed(0)} persen, gelombang sisa inilah yang biasanya merusak tebing di hilir — dan karena itu rentang ini dihindari dalam desain kolam olak.`;
  }
  if (s.Fr1 < 9) {
    return `Ini rentang yang dicari dalam desain: posisi loncatan stabil, energi teredam ${s.lossPct.toFixed(0)} persen, dan kedalaman naik ${rasio.toFixed(1)} kali lipat. Panjang kolam olak perlu setidaknya ${s.Lj.toFixed(1)} m agar loncatan selesai di dalam struktur, bukan di atas tanah asli di hilirnya.`;
  }
  return `Peredaman sudah sangat besar, ${s.lossPct.toFixed(0)} persen, tetapi permukaannya menjadi kasar dan bergolak. Pada kondisi ini biaya perlindungan dasar dan dinding naik tajam; sering kali lebih murah menurunkan Fr₁ dengan mengubah elevasi lantai olak daripada memperkuat strukturnya.`;
}
