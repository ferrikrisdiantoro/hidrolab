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
import { fmt, fmtSci, frictionFactor, headLoss, reynolds } from "@/lib/hydraulics";
import { C } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksMoody } from "@/lib/checks";

const TXT = {
  id: {
    title: "Diagram Moody",
    sheetTitle: "Faktor gesekan Darcy — Colebrook-White",
    dV: "Kecepatan aliran",
    dD: "Diameter dalam",
    dE: "Kekasaran mutlak",
    dL: "Panjang pipa",
    dT: "Suhu air",
    material: "bahan pipa",
    m: ["PVC", "Baja baru", "Besi cor", "Beton", "Berkarat"],
    rRe: "Bilangan Reynolds",
    rf: "Faktor gesekan Darcy",
    rRR: "Kekasaran relatif",
    rNu: "Viskositas kinematik",
    rQ: "Debit",
    rHf: "Kehilangan tinggi tekan",
    rS: "Kemiringan hidraulik",
    rVh: "Tinggi kecepatan",
    fullyRough: "turbulen penuh",
    lam: "Laminar",
    trans: "Zona transisi",
    turb: "Turbulen",
    note: "Persamaan Colebrook-White bersifat implisit — f muncul di kedua sisi. Di sini diselesaikan dengan iterasi Newton-Raphson pada peubah 1/√f, memakai pendekatan eksplisit Swamee-Jain sebagai tebakan awal; biasanya tiga sampai empat putaran sudah mencapai ketelitian mesin. Pita di antara Re 2.000 dan 4.000 sengaja dibiarkan kosong tanpa kurva, sebagaimana pada diagram aslinya: di rentang itu aliran dapat berbalik-balik antara laminar dan turbulen tergantung gangguan di hulu, sehingga tidak ada satu nilai yang bisa dipertanggungjawabkan.",
  },
  en: {
    title: "Moody chart",
    sheetTitle: "Darcy friction factor — Colebrook-White",
    dV: "Flow velocity",
    dD: "Internal diameter",
    dE: "Absolute roughness",
    dL: "Pipe length",
    dT: "Water temperature",
    material: "pipe material",
    m: ["PVC", "New steel", "Cast iron", "Concrete", "Rusted"],
    rRe: "Reynolds number",
    rf: "Darcy friction factor",
    rRR: "Relative roughness",
    rNu: "Kinematic viscosity",
    rQ: "Discharge",
    rHf: "Head loss",
    rS: "Hydraulic gradient",
    rVh: "Velocity head",
    fullyRough: "fully rough",
    lam: "Laminar",
    trans: "Critical zone",
    turb: "Turbulent",
    note: "The Colebrook-White equation is implicit — f appears on both sides. Here it is solved by Newton-Raphson iteration on the variable 1/√f, using the explicit Swamee-Jain approximation as a starting guess; three or four passes usually reach machine precision. The band between Re 2,000 and 4,000 is deliberately left empty of curves, as on the original chart: in that range the flow can switch back and forth between laminar and turbulent depending on upstream disturbance, so no single value can be defended.",
  },
} as const;

const REFS = {
  id: [
    "Colebrook, C.F. (1939). Turbulent Flow in Pipes. Journal of the Institution of Civil Engineers 11(4), 133–156.",
    "Moody, L.F. (1944). Friction Factors for Pipe Flow. Transactions of the ASME 66(8), 671–684.",
    "Swamee, P.K. & Jain, A.K. (1976). Explicit Equations for Pipe-Flow Problems. Journal of the Hydraulics Division 102(5), 657–664.",
    "White, F.M. (2011). Fluid Mechanics, edisi ke-7. McGraw-Hill.",
  ],
  en: [
    "Colebrook, C.F. (1939). Turbulent Flow in Pipes. Journal of the Institution of Civil Engineers 11(4), 133–156.",
    "Moody, L.F. (1944). Friction Factors for Pipe Flow. Transactions of the ASME 66(8), 671–684.",
    "Swamee, P.K. & Jain, A.K. (1976). Explicit Equations for Pipe-Flow Problems. Journal of the Hydraulics Division 102(5), 657–664.",
    "White, F.M. (2011). Fluid Mechanics, 7th ed. McGraw-Hill.",
  ],
} as const;

/** Viskositas kinematik air terhadap suhu, pendekatan umum. */
function nuWater(T: number): number {
  return 1.79e-6 / (1 + 0.03368 * T + 0.000221 * T * T);
}

export function DiagramMoodyClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [V, setV] = useState(2.0);
  const [D, setD] = useState(0.3);
  const [epsMm, setEpsMm] = useState(0.26);
  const [L, setL] = useState(120);
  const [T, setT] = useState(20);

  const nu = nuWater(T);
  const Re = reynolds(V, D, nu);
  const relRough = epsMm / 1000 / D;
  const { f, regime } = frictionFactor(Re, relRough);
  const hf = headLoss(f, L, D, V);
  const Q = V * Math.PI * 0.25 * D * D;
  const fullyRough = Re * relRough * Math.sqrt(f) >= 200;

  const regimeLabel =
    regime === "laminar" ? x.lam : regime === "transisi" ? x.trans : x.turb;

  const ref = useCanvas(
    (ctx, w, h) => drawMoody(ctx, w, h, { Re, relRough, f, regime }, lang),
    [Re, relRough, f, regime, lang]
  );

  return (
    <LabShell
      sheet="PI-01"
      subject={SUBJECTS.PI[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Faktor gesekan pipa tidak bisa dibaca dari satu rumus tunggal.
            Diagram ini menyelesaikannya secara grafis: masuk dari sumbu bawah
            pada <Term tint={C.signal}>Re</Term>, naik sampai menyentuh kurva{" "}
            <Term tint={C.water}>kekasaran</Term> yang sesuai, lalu belok kiri
            untuk membaca f. Jalur baca itu digambar mengikuti masukan Anda.
          </p>
        ) : (
          <p>
            The pipe friction factor cannot be read from a single formula. This
            chart solves it graphically: enter on the bottom axis at{" "}
            <Term tint={C.signal}>Re</Term>, rise until you meet the matching{" "}
            <Term tint={C.water}>roughness</Term> curve, then turn left to read
            f. That reading path is drawn to follow your input.
          </p>
        )
      }
      drawing={
        <Sheet
          number="PI-01"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbAxis, value: "log–log" },
            { label: t.tbUnit, value: "SI" },
            { label: "ε/D", value: fmtSci(relRough), tint: C.water },
            { label: "Re", value: fmtSci(Re) },
            { label: t.tbRegime, value: regimeLabel },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="V" label={x.dV} value={V} min={0.02} max={8} step={0.01} unit="m/s" onChange={setV} />
              <InputRow symbol="D" label={x.dD} value={D} min={0.02} max={2} step={0.005} digits={3} unit="m" onChange={setD} />
              <InputRow symbol="ε" label={x.dE} value={epsMm} min={0} max={3} step={0.005} digits={3} unit="mm" onChange={setEpsMm} tint={C.water} />
              <InputRow symbol="L" label={x.dL} value={L} min={5} max={2000} step={5} digits={0} unit="m" onChange={setL} />
              <InputRow symbol="T" label={x.dT} value={T} min={4} max={40} step={0.5} digits={1} unit="°C" onChange={setT} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={x.material}
                presets={[
                  { label: x.m[0], apply: () => setEpsMm(0.0015) },
                  { label: x.m[1], apply: () => setEpsMm(0.045) },
                  { label: x.m[2], apply: () => setEpsMm(0.26) },
                  { label: x.m[3], apply: () => setEpsMm(1.0) },
                  { label: x.m[4], apply: () => setEpsMm(2.0) },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag alert={regime === "transisi"}>{regimeLabel}</Flag>
              {fullyRough && <Flag tint={C.critical}>{x.fullyRough}</Flag>}
            </div>
            <ResultTable
              rows={[
                { symbol: "Re", label: x.rRe, value: fmtSci(Re), strong: true },
                { symbol: "f", label: x.rf, value: f.toFixed(4), tint: C.water, strong: true },
                { symbol: "ε/D", label: x.rRR, value: fmtSci(relRough), tint: C.water },
                { symbol: "ν", label: x.rNu, value: fmtSci(nu), unit: "m²/s" },
                { symbol: "Q", label: x.rQ, value: fmt(Q, 4), unit: "m³/s" },
                { symbol: "hf", label: x.rHf, value: fmt(hf, 3), unit: "m", tint: C.energy },
                { symbol: "S", label: x.rS, value: fmt((hf / L) * 1000, 2), unit: "‰", tint: C.energy },
                { symbol: "—", label: x.rVh, value: fmt((V * V) / 19.62, 4), unit: "m" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice({ f, regime, hf, L, fullyRough }, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksMoody(Re, relRough)} />}
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
          note={x.note}
          refs={[...REFS[lang]]}
        />
      }
    />
  );
}

function notice(
  s: { f: number; regime: string; hf: number; L: number; fullyRough: boolean },
  lang: Lang
): string {
  const L0 = s.L.toFixed(0);

  if (lang === "en") {
    if (s.regime === "laminar")
      return `Below Re 2,000 the flow is still laminar, and wall roughness has no effect at all — f depends on Re alone. Try moving the roughness now: the operating point does not budge. Head loss over ${L0} m is only ${s.hf.toFixed(3)} m.`;
    if (s.regime === "transisi")
      return "The operating point sits inside the empty band on the chart. Values here cannot be relied on: the flow may switch between laminar and turbulent depending on upstream disturbance. In design this range is best avoided — choose a diameter that moves the point clear of the band.";
    if (s.fullyRough)
      return "The operating point has passed the fully rough boundary and the curve has flattened. Raising Re further barely lowers f, meaning more velocity no longer buys efficiency. From here the only way to cut head loss is a larger diameter or a smoother wall.";
    return `Turbulent, but not yet fully rough: a friction factor of ${s.f.toFixed(4)} still falls as Re rises. Head loss is ${s.hf.toFixed(2)} m over ${L0} m of pipe. Move the roughness and watch the point travel between curves — the further right, the less Re matters and the more roughness dominates.`;
  }

  if (s.regime === "laminar")
    return `Pada Re di bawah 2.000 aliran masih laminar, dan kekasaran dinding sama sekali tidak berpengaruh — f hanya bergantung pada Re. Coba geser kekasaran sekarang: titik operasi tidak bergerak. Kehilangan tekan sepanjang ${L0} m hanya ${s.hf.toFixed(3)} m.`;
  if (s.regime === "transisi")
    return "Titik operasi berada di dalam pita kosong pada diagram. Nilai di sini tidak dapat diandalkan: aliran bisa berbalik-balik antara laminar dan turbulen tergantung gangguan di hulu. Dalam desain, rentang ini sebaiknya dihindari — pilih diameter yang menggeser titik operasi keluar dari pita.";
  if (s.fullyRough)
    return "Titik operasi sudah melewati batas turbulen penuh, dan kurvanya mendatar. Menaikkan Re lagi hampir tidak menurunkan f — artinya menambah kecepatan tidak lagi memperbaiki efisiensi. Pada tahap ini satu-satunya cara menurunkan kehilangan tekan adalah memperbesar diameter atau memperhalus dinding.";
  return `Aliran turbulen, tetapi belum sepenuhnya kasar: faktor gesekan ${s.f.toFixed(4)} masih ikut turun bila Re dinaikkan. Kehilangan tekan ${s.hf.toFixed(2)} m sepanjang ${L0} m pipa. Geser kekasaran dan perhatikan titik operasi berpindah antar kurva — semakin ke kanan, semakin kecil pengaruh Re dan semakin dominan pengaruh kekasaran.`;
}
