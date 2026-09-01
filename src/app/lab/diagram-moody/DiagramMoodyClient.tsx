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
import { drawMoody } from "@/lib/drawMoody";
import {
  fmt,
  fmtSci,
  frictionFactor,
  headLoss,
  reynolds,
} from "@/lib/hydraulics";
import { C } from "@/lib/theme";

/** Viskositas kinematik air terhadap suhu, pendekatan umum. */
function nuWater(T: number): number {
  return 1.79e-6 / (1 + 0.03368 * T + 0.000221 * T * T);
}

export function DiagramMoodyClient() {
  const [V, setV] = useState(2.0);
  const [D, setD] = useState(0.3);
  const [epsMm, setEpsMm] = useState(0.26);
  const [L, setL] = useState(120);
  const [T, setT] = useState(20);

  const nu = nuWater(T);
  const Re = reynolds(V, D, nu);
  const relRough = epsMm / 1000 / D;
  const { f, regime, regimeLabel } = frictionFactor(Re, relRough);
  const hf = headLoss(f, L, D, V);
  const Q = V * Math.PI * 0.25 * D * D;
  const fullyRough = Re * relRough * Math.sqrt(f) >= 200;

  const ref = useCanvas(
    (ctx, w, h) => drawMoody(ctx, w, h, { Re, relRough, f, regime }),
    [Re, relRough, f, regime]
  );

  return (
    <LabShell
      sheet="MD-01"
      subject="Aliran dalam pipa"
      title="Diagram Moody"
      intro={
        <p>
          Faktor gesekan pipa tidak bisa dibaca dari satu rumus tunggal. Diagram
          ini menyelesaikannya secara grafis: masuk dari sumbu bawah pada{" "}
          <Term tint={C.signal}>Re</Term>, naik sampai menyentuh kurva{" "}
          <Term tint={C.water}>kekasaran</Term> yang sesuai, lalu belok kiri
          untuk membaca f. Jalur baca itu digambar mengikuti masukan Anda.
        </p>
      }
      drawing={
        <Sheet
          number="MD-01"
          title="Faktor gesekan Darcy — Colebrook-White"
          rev="A"
          cells={[
            { label: "sumbu", value: "log–log" },
            { label: "satuan", value: "SI" },
            { label: "ε/D", value: fmtSci(relRough), tint: C.water },
            { label: "Re", value: fmtSci(Re) },
            { label: "regime", value: regimeLabel },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading="masukan">
            <InputTable>
              <InputRow symbol="V" label="Kecepatan aliran" value={V} min={0.02} max={8} step={0.01} unit="m/s" onChange={setV} />
              <InputRow symbol="D" label="Diameter dalam" value={D} min={0.02} max={2} step={0.005} digits={3} unit="m" onChange={setD} />
              <InputRow symbol="ε" label="Kekasaran mutlak" value={epsMm} min={0} max={3} step={0.005} digits={3} unit="mm" onChange={setEpsMm} tint={C.water} />
              <InputRow symbol="L" label="Panjang pipa" value={L} min={5} max={2000} step={5} digits={0} unit="m" onChange={setL} />
              <InputRow symbol="T" label="Suhu air" value={T} min={4} max={40} step={0.5} digits={1} unit="°C" onChange={setT} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label="bahan pipa"
                presets={[
                  { label: "PVC", apply: () => setEpsMm(0.0015) },
                  { label: "Baja baru", apply: () => setEpsMm(0.045) },
                  { label: "Besi cor", apply: () => setEpsMm(0.26) },
                  { label: "Beton", apply: () => setEpsMm(1.0) },
                  { label: "Berkarat", apply: () => setEpsMm(2.0) },
                ]}
              />
            </div>
          </Block>

          <Block heading="hasil">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag alert={regime === "transisi"}>{regimeLabel}</Flag>
              {fullyRough && <Flag tint={C.critical}>turbulen penuh</Flag>}
            </div>
            <ResultTable
              rows={[
                { symbol: "Re", label: "Bilangan Reynolds", value: fmtSci(Re), strong: true },
                { symbol: "f", label: "Faktor gesekan Darcy", value: f.toFixed(4), tint: C.water, strong: true },
                { symbol: "ε/D", label: "Kekasaran relatif", value: fmtSci(relRough), tint: C.water },
                { symbol: "ν", label: "Viskositas kinematik", value: fmtSci(nu), unit: "m²/s" },
                { symbol: "Q", label: "Debit", value: fmt(Q, 4), unit: "m³/s" },
                { symbol: "hf", label: "Kehilangan tinggi tekan", value: fmt(hf, 3), unit: "m", tint: C.energy },
                { symbol: "S", label: "Kemiringan hidraulik", value: fmt((hf / L) * 1000, 2), unit: "‰", tint: C.energy },
                { label: "Tinggi kecepatan", value: fmt((V * V) / 19.62, 4), unit: "m" },
              ]}
            />
          </Block>

          <Block heading="yang perlu diperhatikan">
            <Note>{notice({ Re, relRough, f, regime, hf, L, fullyRough })}</Note>
          </Block>
        </>
      }
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Re =</span>
                <Frac num="V · D" den="ν" />
                <span className="ml-6 text-ink-3">laminar:</span>
                <span className="ml-2">f = 64 / Re</span>
              </Eq>
              <Eq>
                <Frac num="1" den="√f" />
                <span>= −2 · log₁₀ (</span>
                <Frac num="ε/D" den="3,7" />
                <span>+</span>
                <Frac num="2,51" den={<>Re · √f</>} />
                <span>)</span>
              </Eq>
              <Eq>
                <span>hf = f ·</span>
                <Frac num="L" den="D" />
                <span>·</span>
                <Frac num="V²" den="2g" />
              </Eq>
            </>
          }
          note="Persamaan Colebrook-White bersifat implisit — f muncul di kedua sisi. Di sini diselesaikan dengan iterasi Newton-Raphson pada peubah 1/√f, memakai pendekatan eksplisit Swamee-Jain sebagai tebakan awal; biasanya tiga sampai empat putaran sudah mencapai ketelitian mesin. Pita di antara Re 2.000 dan 4.000 sengaja dibiarkan kosong tanpa kurva, sebagaimana pada diagram aslinya: di rentang itu aliran dapat berbalik-balik antara laminar dan turbulen tergantung gangguan di hulu, sehingga tidak ada satu nilai yang bisa dipertanggungjawabkan."
          refs={[
            "Colebrook, C.F. (1939). Turbulent Flow in Pipes. Journal of the Institution of Civil Engineers 11(4), 133–156.",
            "Moody, L.F. (1944). Friction Factors for Pipe Flow. Transactions of the ASME 66(8), 671–684.",
            "Swamee, P.K. & Jain, A.K. (1976). Explicit Equations for Pipe-Flow Problems. Journal of the Hydraulics Division 102(5), 657–664.",
            "White, F.M. (2011). Fluid Mechanics, edisi ke-7. McGraw-Hill.",
          ]}
        />
      }
    />
  );
}

function notice(s: {
  Re: number;
  relRough: number;
  f: number;
  regime: string;
  hf: number;
  L: number;
  fullyRough: boolean;
}): string {
  if (s.regime === "laminar") {
    return `Pada Re di bawah 2.000 aliran masih laminar, dan kekasaran dinding sama sekali tidak berpengaruh — f hanya bergantung pada Re. Coba geser kekasaran sekarang: titik operasi tidak bergerak. Kehilangan tekan sepanjang ${s.L.toFixed(0)} m hanya ${s.hf.toFixed(3)} m.`;
  }
  if (s.regime === "transisi") {
    return "Titik operasi berada di dalam pita kosong pada diagram. Nilai di sini tidak dapat diandalkan: aliran bisa berbalik-balik antara laminar dan turbulen tergantung gangguan di hulu. Dalam desain, rentang ini sebaiknya dihindari — pilih diameter yang menggeser titik operasi keluar dari pita.";
  }
  if (s.fullyRough) {
    return `Titik operasi sudah melewati batas turbulen penuh, dan kurvanya mendatar. Menaikkan Re lagi hampir tidak menurunkan f — artinya menambah kecepatan tidak lagi memperbaiki efisiensi. Pada tahap ini satu-satunya cara menurunkan kehilangan tekan adalah memperbesar diameter atau memperhalus dinding.`;
  }
  return `Aliran turbulen, tetapi belum sepenuhnya kasar: faktor gesekan ${s.f.toFixed(4)} masih ikut turun bila Re dinaikkan. Kehilangan tekan ${s.hf.toFixed(2)} m sepanjang ${s.L.toFixed(0)} m pipa. Geser kekasaran dan perhatikan titik operasi berpindah antar kurva — semakin ke kanan, semakin kecil pengaruh Re dan semakin dominan pengaruh kekasaran.`;
}
