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
  type LangkahHitung,
} from "@/components/ui";
import { usePlate } from "@/lib/usePlate";
import { drawMoody } from "@/lib/drawMoody";
import { DragLayer, type HandleSpec } from "@/components/DragLayer";
import type { ParamDef } from "@/lib/rentang";
import {
  G,
  RE_LAMINAR_MAX,
  RE_TURBULENT_MIN,
  colebrookFriction,
  fmt,
  fmtSci,
  frictionFactor,
  headLoss,
  reynolds,
} from "@/lib/hydraulics";
import { C, type Tone } from "@/lib/theme";
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
    lam: "Laminar",
    trans: "Zona kritis",
    bandLam: "Laminar, f = 64/Re",
    bandKritis: "Zona kritis, nilai tidak pasti",
    bandTrans: "Turbulen transisi",
    bandKasar: "Kasar penuh",
    hNu: "Viskositas kinematik dari suhu",
    hRe: "Bilangan Reynolds dan kekasaran relatif",
    hF0: "Tebakan awal Swamee-Jain",
    hF: "Faktor gesekan",
    hFKritis: "Faktor gesekan: interpolasi 64/2000 ke Colebrook(4000), tidak dapat diandalkan",
    hRes: "Colebrook terselesaikan (Newton-Raphson): sisa persamaan",
    hHf: "Kehilangan tinggi tekan",
    hS: "Kemiringan hidraulik",
    hdlPoint: "Titik kerja: geser mendatar untuk mengubah Re lewat kecepatan V",
    hdlRough: "Ujung kurva kekasaran: geser tegak untuk mengubah kekasaran ε",
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
    lam: "Laminar",
    trans: "Critical zone",
    bandLam: "Laminar, f = 64/Re",
    bandKritis: "Critical zone, value uncertain",
    bandTrans: "Transitional turbulent",
    bandKasar: "Fully rough",
    hNu: "Kinematic viscosity from temperature",
    hRe: "Reynolds number and relative roughness",
    hF0: "Swamee-Jain starting guess",
    hF: "Friction factor",
    hFKritis: "Friction factor: interpolation 64/2000 to Colebrook(4000), not reliable",
    hRes: "Colebrook solved (Newton-Raphson): equation residual",
    hHf: "Head loss",
    hS: "Hydraulic gradient",
    hdlPoint: "Operating point: drag sideways to change Re through velocity V",
    hdlRough: "Roughness curve end: drag up or down to change roughness ε",
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

/* Sumbu pita Re 10²–10⁸ memuat seluruh penggeser (Re 254 pada V 0,02,
   D 0,02, T 4; 2,41·10⁷ pada V 8, D 2, T 40). */
const RE_AXIS_MIN = 1e2;
const RE_AXIS_MAX = 1e8;
/*
 * Rentang masukan yang dipakai bersama oleh penggeser, kotak angka, dan
 * pegangan seret di diagram (aturan 4: satu sumber nilai).
 */
const P_V: ParamDef = { min: 0.02, max: 8, step: 0.01, digits: 2 };
const P_EPS: ParamDef = { min: 0, max: 3, step: 0.0005, digits: 4 };

/*
 * Kebalikan Colebrook pada Re tetap: ε/D yang membuat kurva Colebrook lewat
 * f di Re itu. Dari 1/√f = −2 log₁₀(ε/D / 3,7 + 2,51 / (Re √f)):
 *   ε/D = 3,7 · ( 10^(−1/(2√f)) − 2,51 / (Re √f) )
 * Hasil negatif berarti f di bawah kurva pipa licin; snap memotongnya ke
 * ε = 0 dengan penanda "dibatasi ke".
 */
function rrDariF(f: number, Re: number): number {
  const sf = Math.sqrt(f);
  return 3.7 * (Math.pow(10, -1 / (2 * sf)) - 2.51 / (Re * sf));
}

/** Kurva kekasaran terbesar pada diagram Moody (1944) dan drawMoody (FAMILY). */
const RR_MAX_MOODY = 0.05;

/*
 * Re awal kasar penuh: Re yang membuat Re·(ε/D)·√f = 200 dengan f Colebrook
 * pada Re itu. Kriteria ini SAMA dengan garis putus ungu drawMoody dan
 * penanda `fullyRough`, jadi penanda pita tidak pernah berada di pita
 * "transisi" sementara kartu menulis "kasar penuh". (Rumus f∞ di spesifikasi
 * memberi Re sedikit lebih besar karena f∞ < f.) Fungsinya naik monoton
 * terhadap Re, jadi bagi dua pada log Re. ε = 0: tidak ada.
 */
function reKasarPenuh(rr: number): number {
  if (rr <= 0) return Infinity;
  const g = (lg: number) => {
    const Re = 10 ** lg;
    return Re * rr * Math.sqrt(colebrookFriction(Re, rr)) - 200;
  };
  let lo = Math.log10(RE_TURBULENT_MIN);
  let hi = Math.log10(RE_AXIS_MAX);
  if (g(lo) >= 0) return RE_TURBULENT_MIN;
  if (g(hi) < 0) return Infinity;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (g(m) >= 0) hi = m;
    else lo = m;
  }
  return 10 ** hi;
}

/** Tebakan awal Swamee-Jain, rumus yang sama dengan hydraulics.ts (tidak diekspor). */
function swameeJain(Re: number, rr: number): number {
  const inner = rr / 3.7 + 5.74 / Math.pow(Re, 0.9);
  return 0.25 / Math.pow(Math.log10(inner), 2);
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
  /*
   * Pencacah seret. Pegangan ada di dalam Sheet, di luar Block masukan,
   * jadi usePresetTouch di DragLayer tidak menjangkau PresetRow (tanpa
   * lingkup = tidak berbuat apa-apa). Tanda contoh dipadamkan dengan
   * memasang ulang PresetRow tiap kali pegangan mengubah nilai.
   */
  const [seretGen, setSeretGen] = useState(0);

  const nu = nuWater(T);
  const Re = reynolds(V, D, nu);
  const relRough = epsMm / 1000 / D;
  const { f, regime } = frictionFactor(Re, relRough);
  const hf = headLoss(f, L, D, V);
  const Q = V * Math.PI * 0.25 * D * D;
  const kritis = regime === "transisi";
  // Kasar penuh hanya bermakna untuk aliran turbulen (Colebrook); di zona
  // kritis f hanya interpolasi. Dulu V 0,20, D 0,020, ε 3 (Re 3 937) memberi
  // "turbulen penuh" bersamaan dengan "zona kritis".
  const fullyRough = regime === "turbulen" && Re * relRough * Math.sqrt(f) >= 200;
  const diLuarMoody = relRough > RR_MAX_MOODY;
  const vh = (V * V) / (2 * G);
  const S = (hf / L) * 1000;

  const regimeLabel =
    regime === "laminar" ? x.lam : kritis ? x.trans : fullyRough ? x.bandKasar : x.bandTrans;
  const nada: Tone =
    regime === "laminar" ? "water" : kritis ? "invalid" : fullyRough ? "critical" : "neutral";

  /* Pita Re: batas laminar dan zona kritis dari frictionFactor (2000, 4000);
     batas kasar penuh dinamis. Pita yang lebarnya nol (ε = 0, atau kasar
     penuh sudah dimulai di Re 4000 pada ε/D besar) dibuang. */
  const reKp = Math.min(Math.max(reKasarPenuh(relRough), RE_TURBULENT_MIN), RE_AXIS_MAX);
  const bands = [
    { from: RE_AXIS_MIN, to: RE_LAMINAR_MAX, label: x.bandLam, tone: "water" as Tone },
    { from: RE_LAMINAR_MAX, to: RE_TURBULENT_MIN, label: x.bandKritis, tone: "invalid" as Tone },
    { from: RE_TURBULENT_MIN, to: reKp, label: x.bandTrans, tone: "neutral" as Tone },
    { from: reKp, to: RE_AXIS_MAX, label: x.bandKasar, tone: "critical" as Tone },
  ].filter((b) => b.to > b.from);

  // Di zona kritis tabel menulis "≈" (interpolasi), Hitungan menulis "—".
  const kira = (s: string) => (kritis ? `≈ ${s}` : s);

  /* Langkah faktor gesekan bergantung rezim. Nilai antara satu digit lebih
     banyak dari tabel. */
  const langkahF: LangkahHitung[] =
    regime === "laminar"
      ? [
          {
            judul: x.hF,
            rumus: (<><span>f =</span><Frac num="64" den="Re" /></>),
            isi: `64 / ${fmtSci(Re)}`,
            hasil: fmt(f, 4),
            tint: C.water,
          },
        ]
      : kritis
        ? [
            {
              judul: x.hFKritis,
              rumus: <span>f ≈ 64/2000 + t · ( f(4000) − 64/2000 )</span>,
              isi: "—",
              hasil: "—",
            },
          ]
        : (() => {
            const f0 = swameeJain(Re, relRough);
            const sisa =
              1 / Math.sqrt(f) + 2 * Math.log10(relRough / 3.7 + 2.51 / (Re * Math.sqrt(f)));
            const teksSisa = Math.abs(sisa) < 1e-9 ? fmt(0, 0) : fmtSci(sisa);
            return [
              {
                judul: x.hF0,
                rumus: (<><span>f₀ =</span><Frac num={fmt(0.25, 2)} den={`[ log₁₀( ε/D / ${fmt(3.7, 1)} + ${fmt(5.74, 2)} / Re^${fmt(0.9, 1)} ) ]²`} /></>),
                isi: `${fmt(0.25, 2)} / [ log₁₀( ${fmtSci(relRough)} / ${fmt(3.7, 1)} + ${fmt(5.74, 2)} / ( ${fmtSci(Re)} )^${fmt(0.9, 1)} ) ]²`,
                hasil: fmt(f0, 5),
              },
              {
                judul: x.hRes,
                rumus: (<><Frac num="1" den="√f" /><span>+ 2 log₁₀(</span><Frac num="ε/D" den={fmt(3.7, 1)} /><span>+</span><Frac num={fmt(2.51, 2)} den="Re · √f" /><span>) ≈ 0</span></>),
                isi: `1/√${fmt(f, 5)} + 2 log₁₀( ${fmtSci(relRough)} / ${fmt(3.7, 1)} + ${fmt(2.51, 2)} / ( ${fmtSci(Re)} · √${fmt(f, 5)} ) ) = ${teksSisa}`,
                hasil: fmt(f, 4),
                tint: C.water,
              },
            ];
          })();

  const plate = usePlate(
    (ctx, w, h) => drawMoody(ctx, w, h, { Re, relRough, f, regime }, lang),
    null,
    [Re, relRough, f, regime, lang]
  );

  /*
   * Pegangan seret. Posisi tegak titik kerja adalah f HASIL hitungan, jadi
   * titik kerja hanya diseret mendatar (Re). Re bukan masukan; yang diubah
   * adalah V, satu-satunya masukan yang tidak ikut mengubah ε/D:
   *   V = Re · ν / D   (D dan T tetap)
   * Kekasaran diseret lewat pegangan kedua di ujung kanan kurvanya (Re 10⁸,
   * tepat di depan skala ε/D sumbu kanan): f di ujung → ε/D lewat kebalikan
   * Colebrook → ε = ε/D · D (D tetap). Keduanya memakai ParamDef yang sama
   * dengan InputRow V dan ε, dan memanggil setter yang sama.
   */
  const reDariV = (v: number) => reynolds(v, D, nu);
  const handles: HandleSpec[] = [
    {
      id: "titik",
      anchor: "point",
      axis: "x",
      label: x.hdlPoint,
      // Belah ketupat titik kerja tetap terlihat di dalam cincin.
      hollow: true,
      param: P_V,
      value: V,
      toValue: (px, _py, m) => (m.invX(px) * nu) / D,
      onChange: (v) => {
        setV(v);
        setSeretGen((g) => g + 1);
      },
      format: (v) => `V ${fmt(v, 2)} m/s, Re ${fmtSci(reDariV(v))}`,
    },
    {
      id: "kekasaran",
      anchor: "roughnessEnd",
      axis: "y",
      label: x.hdlRough,
      tint: C.water,
      param: P_EPS,
      value: epsMm,
      toValue: (_px, py, m) => rrDariF(m.invY(py), RE_AXIS_MAX) * D * 1000,
      onChange: (v) => {
        setEpsMm(v);
        setSeretGen((g) => g + 1);
      },
      format: (v) => `ε ${fmt(v, 4)} mm, ε/D ${fmtSci(v / 1000 / D)}`,
    },
  ];

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="Re"
          value={Re}
          scale="log"
          digits={0}
          invalid={kritis}
          bands={bands}
        />
      }
      sheet="PI-01"
      subject={SUBJECTS.PI[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Faktor gesekan pipa tidak bisa dibaca dari satu rumus tunggal.
            Diagram ini menyelesaikannya secara grafis: masuk dari sumbu bawah
            pada <Term tint={C.ink}>Re</Term>, naik sampai menyentuh kurva{" "}
            <Term tint={C.water}>kekasaran</Term> yang sesuai, lalu belok kiri
            untuk membaca f. Jalur baca itu digambar mengikuti masukan Anda.
          </p>
        ) : (
          <p>
            The pipe friction factor cannot be read from a single formula. This
            chart solves it graphically: enter on the bottom axis at{" "}
            <Term tint={C.ink}>Re</Term>, rise until you meet the matching{" "}
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
          <canvas ref={plate.ref} className="block h-full w-full" />
          {/* usePlate menaikkan `version` (state) tiap lapis statis digambar
              ulang, jadi Client dirender ulang dan pegangan membaca anchor
              baru dari outRef. Tanpa key: pegangan tidak boleh dipasang
              ulang di tengah seret (pointer capture hilang). */}
          <DragLayer out={plate.outRef.current} handles={handles} />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="V" label={x.dV} value={V} {...P_V} unit="m/s" onChange={setV} />
              <InputRow symbol="D" label={x.dD} value={D} min={0.02} max={2} step={0.005} digits={3} unit="m" onChange={setD} />
              <InputRow symbol="ε" label={x.dE} value={epsMm} {...P_EPS} unit="mm" onChange={setEpsMm} tint={C.water} />
              <InputRow symbol="L" label={x.dL} value={L} min={5} max={2000} step={5} digits={0} unit="m" onChange={setL} />
              <InputRow symbol="T" label={x.dT} value={T} min={4} max={40} step={0.5} digits={1} unit="°C" onChange={setT} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                key={seretGen}
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
            {/* Rezim kini di pita Re dan kartu keadaan. Re sudah di pita, jadi
                angka besar pindah ke f dan hf. */}
            <ResultTable
              rows={[
                { symbol: "f", label: x.rf, value: kira(fmt(f, 4)), tint: C.water, strong: true },
                { symbol: "hf", label: x.rHf, value: kira(fmt(hf, 3)), unit: "m", tint: C.energy, strong: true },
                { symbol: "Re", label: x.rRe, value: fmtSci(Re) },
                { symbol: "ε/D", label: x.rRR, value: fmtSci(relRough), tint: C.water },
                { symbol: "ν", label: x.rNu, value: fmtSci(nu), unit: "m²/s" },
                { symbol: "Q", label: x.rQ, value: Q < 0.01 ? fmtSci(Q) : fmt(Q, 4), unit: "m³/s" },
                { symbol: "S", label: x.rS, value: kira(fmt(S, 2)), unit: "‰", tint: C.energy },
                { symbol: "—", label: x.rVh, value: vh < 0.001 ? fmtSci(vh) : fmt(vh, 4), unit: "m" },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hNu,
                    rumus: (<><span>ν =</span><Frac num={`${fmt(1.79, 2)} · 10⁻⁶`} den={`1 + ${fmt(0.03368, 5)} T + ${fmt(0.000221, 6)} T²`} /></>),
                    isi: `${fmt(1.79, 2)} · 10⁻⁶ / ( 1 + ${fmt(0.03368, 5)} · ${fmt(T, 1)} + ${fmt(0.000221, 6)} · ${fmt(T, 1)}² )`,
                    hasil: fmtSci(nu),
                    satuan: "m²/s",
                  },
                  {
                    judul: x.hRe,
                    rumus: (<><span>Re =</span><Frac num="V · D" den="ν" /><span className="ml-4">ε/D =</span><Frac num="ε" den="D" /></>),
                    isi: `${fmt(V, 2)} · ${fmt(D, 3)} / ${fmtSci(nu)};  ε/D = ${fmt(epsMm / 1000, 7)} / ${fmt(D, 3)} = ${fmtSci(relRough)}`,
                    hasil: fmtSci(Re),
                  },
                  ...langkahF,
                  {
                    judul: x.hHf,
                    rumus: (<><span>hf = f ·</span><Frac num="L" den="D" /><span>·</span><Frac num="V²" den="2g" /></>),
                    isi: kritis ? "—" : `${fmt(f, 5)} · ${fmt(L, 0)} / ${fmt(D, 3)} · ${fmt(V, 2)}² / ( 2 · ${fmt(G, 2)} )`,
                    hasil: kritis ? "—" : fmt(hf, 3),
                    satuan: "m",
                    tint: C.energy,
                  },
                  {
                    judul: x.hS,
                    rumus: (<><span>S =</span><Frac num="hf" den="L" /><span>· 1000</span></>),
                    isi: kritis ? "—" : `${fmt(hf, 4)} / ${fmt(L, 0)} · 1000`,
                    hasil: kritis ? "—" : fmt(S, 2),
                    satuan: "‰",
                    tint: C.energy,
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={nada}
            badge={regimeLabel}
            {...notice({ Re, f, regime, hf, L, fullyRough, diLuarMoody, relRough }, lang)}
          />
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

/*
 * Isi kalimatnya sama dengan catatan lama satu paragraf; kalimat pertama
 * menyatakan keadaan, sisanya menjadi butir.
 */
function notice(
  s: {
    Re: number;
    f: number;
    regime: string;
    hf: number;
    L: number;
    fullyRough: boolean;
    diLuarMoody: boolean;
    relRough: number;
  },
  lang: Lang
): { state: string; notice: string[] } {
  const L0 = fmt(s.L, 0);
  const Re = fmtSci(s.Re);
  const rr = fmtSci(s.relRough);

  if (lang === "en") {
    const luar = s.diLuarMoody
      ? `ε/D = ${rr} is above 0.05, outside the range of the Colebrook data and Moody's largest curve; the operating point may fall outside the chart.`
      : "";
    if (s.regime === "laminar")
      return {
        state: `Re = ${Re}: laminar; f = ${fmt(s.f, 4)} and a loss of ${fmt(s.hf, 3)} m over ${L0} m.`,
        notice: [
          "Wall roughness has no effect at all: f = 64/Re depends on Re alone. Move the roughness now and the operating point does not budge.",
          luar,
        ],
      };
    if (s.regime === "transisi")
      return {
        state: `Re = ${Re} lies in the critical zone between 2,000 and 4,000: f and hf are only an interpolation, marked ≈.`,
        notice: [
          "Values in this band cannot be relied on: the flow may switch between laminar and turbulent depending on upstream disturbance.",
          "In design this range is best avoided. Choose a diameter that moves the point clear of the band.",
          luar,
        ],
      };
    if (s.fullyRough)
      return {
        state: `Re = ${Re}: fully rough; f = ${fmt(s.f, 4)} and a loss of ${fmt(s.hf, 3)} m over ${L0} m.`,
        notice: [
          "The curve has flattened: raising Re further barely lowers f, so more velocity no longer buys efficiency.",
          "From here the only way to cut head loss is a larger diameter or a smoother wall.",
          luar,
        ],
      };
    return {
      state: `Re = ${Re}: transitional turbulent; f = ${fmt(s.f, 4)} and a loss of ${fmt(s.hf, 3)} m over ${L0} m.`,
      notice: [
        "f still falls as Re rises. Move the roughness and watch the point travel between curves: the further right, the less Re matters and the more roughness dominates.",
        luar,
      ],
    };
  }

  const luar = s.diLuarMoody
    ? `ε/D = ${rr} di atas 0,05, di luar rentang data Colebrook dan kurva terbesar Moody; titik operasi bisa jatuh di luar diagram.`
    : "";
  if (s.regime === "laminar")
    return {
      state: `Re = ${Re}: laminar; f = ${fmt(s.f, 4)} dan kehilangan ${fmt(s.hf, 3)} m sepanjang ${L0} m.`,
      notice: [
        "Kekasaran dinding sama sekali tidak berpengaruh: f = 64/Re hanya bergantung pada Re. Geser kekasaran sekarang, titik operasi tidak bergerak.",
        luar,
      ],
    };
  if (s.regime === "transisi")
    return {
      state: `Re = ${Re} berada di zona kritis antara 2.000 dan 4.000: f dan hf hanya interpolasi, ditandai ≈.`,
      notice: [
        "Nilai di pita ini tidak dapat diandalkan: aliran bisa berbalik-balik antara laminar dan turbulen tergantung gangguan di hulu.",
        "Dalam desain rentang ini sebaiknya dihindari. Pilih diameter yang menggeser titik keluar dari pita.",
        luar,
      ],
    };
  if (s.fullyRough)
    return {
      state: `Re = ${Re}: kasar penuh; f = ${fmt(s.f, 4)} dan kehilangan ${fmt(s.hf, 3)} m sepanjang ${L0} m.`,
      notice: [
        "Kurvanya sudah mendatar: menaikkan Re hampir tidak menurunkan f, jadi menambah kecepatan tidak lagi memperbaiki efisiensi.",
        "Pada tahap ini satu-satunya cara menurunkan kehilangan tekan adalah memperbesar diameter atau memperhalus dinding.",
        luar,
      ],
    };
  return {
    state: `Re = ${Re}: turbulen transisi; f = ${fmt(s.f, 4)} dan kehilangan ${fmt(s.hf, 3)} m sepanjang ${L0} m.`,
    notice: [
      "f masih turun bila Re naik. Geser kekasaran dan perhatikan titik operasi berpindah antarkurva: semakin ke kanan, semakin kecil pengaruh Re dan semakin dominan pengaruh kekasaran.",
      luar,
    ],
  };
}
