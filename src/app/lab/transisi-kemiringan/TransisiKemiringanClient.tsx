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
  type RegimeBand,
} from "@/components/ui";
import { useCanvas } from "@/lib/useCanvas";
import {
  drawReach,
  type ReachMarker,
  type ReachPoint,
  type ReachRegion,
  type ReachSeries,
} from "@/lib/drawReach";
import {
  G,
  conjugateDepth,
  criticalDepth,
  fmt,
  frictionSlope,
  froude,
  normalDepthReachable,
  rectGeometry,
  slopeBreak,
  type SlopeBreak,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksSlopeBreak } from "@/lib/checks";

const TXT = {
  id: {
    title: "Transisi kemiringan",
    sheetTitle: "Patahan kemiringan dasar — saluran persegi prismatis",
    dQ: "Debit",
    db: "Lebar dasar",
    dn: "Kekasaran Manning",
    dSa: "Kemiringan ruas hulu",
    dSb: "Kemiringan ruas hilir",
    dLa: "Panjang ruas hulu",
    dLb: "Panjang ruas hilir",
    pMS: "Landai ke curam",
    pSM: "Curam ke landai",
    pMM: "Landai ke lebih landai",
    rKind: "Jenis patahan",
    rY0a: "Kedalaman normal hulu",
    rY0b: "Kedalaman normal hilir",
    rYc: "Kedalaman kritis",
    rBreak: "Kedalaman di patahan",
    rProfA: "Profil ruas hulu",
    rProfB: "Profil ruas hilir",
    rJump: "Letak loncatan dari patahan",
    kindMS: "Landai ke curam",
    kindSM: "Curam ke landai",
    kindMM: "Landai ke landai",
    kindSS: "Curam ke curam",
    ctlBreak: "Kendali di patahan",
    ctlUp: "Kendali di hulu",
    ctlDown: "Kendali di hilir",
    uniform: "Seragam",
    jumpNone: "Tidak ada",
    tak: "Melampaui kapasitas saluran",
    takNote:
      "Pada lebar dan kemiringan itu, saluran tidak sanggup mengalirkan debit sebesar ini berapa pun dalamnya. Tidak ada kedalaman normal yang memenuhi persamaan Manning pada ruas itu, jadi kedalaman normalnya ditulis “—”. Perbesar lebar dasar, curamkan salah satu ruas, atau kurangi debitnya.",
    drowned: "Loncatan tenggelam",
    beyond: "Loncatan di hilir ujung bentang",
    rSc: "Kemiringan kritis",
    bMild: "Landai (M)",
    bSteep: "Curam (S)",
    hYc: "Debit satuan dan kedalaman kritis",
    hY0: (i: string) => `Kedalaman normal ruas ${i}, Manning dibalik: debit pada y₀`,
    hY0Tak: (i: string) => `Kedalaman normal ruas ${i}: tidak ada y yang memenuhi Manning`,
    hSc: "Kemiringan kritis: kemiringan gesek pada kedalaman kritis",
    hBreakMS: "Patahan landai ke curam: kendali kritis di patahan",
    hBreakMM: "Ruas hilir seragam: kedalaman di patahan = y₀₂",
    hBreakS: "Ruas hulu curam dan seragam: kedalaman di patahan = y₀₁",
    hJump: "Letak loncatan: konjugat profil M3 sama dengan y₀₂",
    hJumpBeyond: "konjugat profil M3 masih di atas y₀₂ sampai ujung ruas hilir",
    hJumpDrowned: "konjugat terbesar, tepat di patahan, sudah di bawah y₀₂",
    ruasHulu: "hulu",
    ruasHilir: "hilir",
    exagg: "pelebihan tegak",
    note:
      "Yang menentukan seluruh gambar adalah letak penampang kendalinya, dan letak itu tidak dipilih melainkan jatuh dari jenis patahannya. Pada patahan landai ke curam, aliran melewati kondisi kritis tepat di patahan, sehingga di situlah kendalinya dan kedua ruas ditelusuri menjauh dari titik yang sama. Pada ruas hulu yang curam, aliran superkritis dikendalikan dari hulu, sehingga apa pun yang terjadi di seberang patahan tidak dapat menjalar naik dan ruas hulu tetap seragam pada kedalaman normalnya. Pada patahan curam ke landai, aliran superkritis meneruskan perjalanannya melewati patahan sebagai profil M3, melambat, lalu naik lewat loncatan air. Letak loncatannya dicari, bukan ditaruh di patahan begitu saja: loncatan berdiri di tempat kedalaman konjugat aliran superkritis sudah setinggi muka air hilir. Bila konjugat terbesar pun masih di bawah muka air hilir, loncatan tidak muat di ruas hilir dan terdorong ke hulu, dan keadaan itu dinyatakan apa adanya alih-alih digambar seolah tidak terjadi.",
  },
  en: {
    title: "Slope transition",
    sheetTitle: "Bed slope break — prismatic rectangular channel",
    dQ: "Discharge",
    db: "Bed width",
    dn: "Manning roughness",
    dSa: "Upstream reach slope",
    dSb: "Downstream reach slope",
    dLa: "Upstream reach length",
    dLb: "Downstream reach length",
    pMS: "Mild to steep",
    pSM: "Steep to mild",
    pMM: "Mild to milder",
    rKind: "Break type",
    rY0a: "Upstream normal depth",
    rY0b: "Downstream normal depth",
    rYc: "Critical depth",
    rBreak: "Depth at the break",
    rProfA: "Upstream reach profile",
    rProfB: "Downstream reach profile",
    rJump: "Jump position from the break",
    kindMS: "Mild to steep",
    kindSM: "Steep to mild",
    kindMM: "Mild to mild",
    kindSS: "Steep to steep",
    ctlBreak: "Control at the break",
    ctlUp: "Control upstream",
    ctlDown: "Control downstream",
    uniform: "Uniform",
    jumpNone: "None",
    tak: "Exceeds channel capacity",
    takNote:
      "At that width and slope the channel cannot carry this discharge at any depth. No normal depth satisfies Manning's equation in that reach, so its normal depth is shown as “—”. Widen the bed, steepen one of the reaches, or reduce the discharge.",
    drowned: "Jump drowned",
    beyond: "Jump beyond the end of the reach",
    rSc: "Critical slope",
    bMild: "Mild (M)",
    bSteep: "Steep (S)",
    hYc: "Unit discharge and critical depth",
    hY0: (i: string) => `Normal depth of the ${i} reach, Manning inverted: discharge at y₀`,
    hY0Tak: (i: string) => `Normal depth of the ${i} reach: no y satisfies Manning`,
    hSc: "Critical slope: friction slope at critical depth",
    hBreakMS: "Mild-to-steep break: critical control at the break",
    hBreakMM: "Downstream reach uniform: depth at the break = y₀₂",
    hBreakS: "Upstream reach steep and uniform: depth at the break = y₀₁",
    hJump: "Jump position: conjugate of the M3 profile equals y₀₂",
    hJumpBeyond: "the conjugate of the M3 profile stays above y₀₂ to the end of the downstream reach",
    hJumpDrowned: "the largest conjugate, right at the break, is already below y₀₂",
    ruasHulu: "upstream",
    ruasHilir: "downstream",
    exagg: "vertical exaggeration",
    note:
      "What decides the whole drawing is where the control section sits, and that position is not chosen but follows from the type of break. At a mild-to-steep break the flow passes through critical conditions exactly at the break, so the control is there and both reaches are computed away from the same point. Where the upstream reach is steep, supercritical flow is controlled from upstream, so nothing on the far side of the break can travel back up and the upstream reach stays uniform at its normal depth. At a steep-to-mild break the supercritical flow carries on past the break as an M3 profile, decelerates, then rises through a hydraulic jump. The jump position is found rather than simply placed at the break: the jump stands where the conjugate depth of the supercritical flow has risen to the tailwater level. If even the largest conjugate depth stays below the tailwater, the jump does not fit in the downstream reach and is pushed upstream, and that condition is stated plainly instead of being drawn as though it had not happened.",
  },
} as const;

const REFS = {
  id: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Bab 9, khususnya pembahasan profil pada patahan kemiringan.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Bab 4 dan Bab 6.",
    "Sturm, T.W. (2010). Open Channel Hydraulics, edisi ke-2. McGraw-Hill. Bab 5.",
    "USBR (1987). Design of Small Dams, edisi ke-3. Bab tentang saluran peluncur.",
  ],
  en: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Chapter 9, in particular the treatment of profiles at a slope break.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Chapters 4 and 6.",
    "Sturm, T.W. (2010). Open Channel Hydraulics, 2nd ed. McGraw-Hill. Chapter 5.",
    "USBR (1987). Design of Small Dams, 3rd ed. Chapter on chute spillways.",
  ],
} as const;

export function TransisiKemiringanClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [Q, setQ] = useState(12);
  const [b, setB] = useState(5);
  const [n, setN] = useState(0.025);
  const [Sa, setSa] = useState(0.0008);
  const [Sb, setSb] = useState(0.02);
  const [La, setLa] = useState(600);
  const [Lb, setLb] = useState(200);

  const r = slopeBreak(Q, b, n, Sa, Sb, La, Lb);
  const yc = criticalDepth(Q / b);
  const okA = normalDepthReachable(Q, b, n, Sa);
  const okB = normalDepthReachable(Q, b, n, Sb);
  const terjangkau = okA && okB;

  /* Kemiringan kritis Sc: kemiringan gesek Manning tepat pada kedalaman
     kritis. Ruas landai bila S < Sc (setara y0 > yc, penggolongan
     slopeBreak). Ditulis dalam ‰ seperti penggesernya. */
  const Sc = frictionSlope(Q, b, yc, n);
  const ScPm = Sc * 1000;
  const geoC = rectGeometry(b, yc);
  const Vc = Q / geoC.A;
  const pitaS = (ok: boolean): RegimeBand[] => {
    if (!ok) return [{ from: 0.2, to: 120, label: x.tak, tone: "invalid" }];
    const batas = Math.min(120, Math.max(0.2, ScPm));
    const pita: RegimeBand[] = [];
    if (batas > 0.2) pita.push({ from: 0.2, to: batas, label: x.bMild, tone: "water" });
    if (batas < 120) pita.push({ from: batas, to: 120, label: x.bSteep, tone: "neutral" });
    return pita;
  };

  // Pemeriksaan Manning pada kedalaman normal tiap ruas.
  const cekQ = (y: number, S: number) => {
    const g0 = rectGeometry(b, y);
    return { R: g0.R, Q: (1 / n) * g0.A * Math.pow(g0.R, 2 / 3) * Math.sqrt(S) };
  };
  const cekA = cekQ(r.hulu.y0, Sa);
  const cekB = cekQ(r.hilir.y0, Sb);

  // Kaki loncatan: Fr₁ dan konjugatnya, dari kedalaman yang dilaporkan model.
  const Fr1j = r.jumpFrom !== null ? froude(Q / (b * r.jumpFrom), r.jumpFrom) : NaN;
  const y2j = r.jumpFrom !== null ? conjugateDepth(r.jumpFrom, Fr1j) : NaN;

  const ref = useCanvas(
    (ctx, w, h) => drawReach(ctx, w, h, susun(r, La, Lb, Sa, Sb, okA, okB, lang)),
    [Q, b, n, Sa, Sb, La, Lb, lang]
  );

  const kindLabel = {
    "landai-curam": x.kindMS,
    "curam-landai": x.kindSM,
    "landai-landai": x.kindMM,
    "curam-curam": x.kindSS,
  }[r.kind];

  const kendali = r.criticalAtBreak
    ? x.ctlBreak
    : r.hulu.mild
      ? x.ctlDown
      : x.ctlUp;

  // Pelebihan tegak dicantumkan karena dua sumbunya memang tidak sama skala.
  // Ruas tak terjangkau tidak ikut: y0-nya batas pencarian 50 m, bukan kedalaman.
  const zSpan = Math.max(
    Sa * La + Sb * Lb + Math.max(okA ? r.hulu.y0 : 0, okB ? r.hilir.y0 : 0, yc),
    1e-3
  );
  const exagg = (La + Lb) / zSpan / 1.9;

  const langkah: LangkahHitung[] = [
    {
      judul: x.hYc,
      rumus: (<><span>q =</span><Frac num="Q" den="b" /><span>, yc =</span><Frac num="∛( q² )" den="∛g" /></>),
      isi: `q = ${fmt(Q, 1)} / ${fmt(b, 1)} = ${fmt(Q / b, 4)} m²/s;  yc = ∛( ${fmt(Q / b, 4)}² / ${fmt(G, 2)} )`,
      hasil: fmt(yc, 3),
      satuan: "m",
      tint: C.critical,
    },
    ...([
      { ok: okA, y: r.hulu.y0, S: Sa, cek: cekA, i: x.ruasHulu, sim: "y₀₁", sS: "S₁" },
      { ok: okB, y: r.hilir.y0, S: Sb, cek: cekB, i: x.ruasHilir, sim: "y₀₂", sS: "S₂" },
    ].map((u) => ({
      judul: u.ok ? `${x.hY0(u.i)} = ${fmt(u.y, 3)} m` : x.hY0Tak(u.i),
      rumus: (<><span>Q =</span><Frac num="1" den="n" /><span>· ( b · {u.sim} ) · R^⅔ · {u.sS}^½</span></>),
      isi: u.ok
        ? `( 1 / ${fmt(n, 3)} ) · ( ${fmt(b, 1)} · ${fmt(u.y, 4)} ) · ${fmt(u.cek.R, 4)}^⅔ · ${fmt(u.S, 5)}^½`
        : "—",
      hasil: u.ok ? fmt(u.cek.Q, 2) : "—",
      satuan: u.ok ? "m³/s" : undefined,
      tint: C.water,
    }))),
    {
      judul: x.hSc,
      rumus: (<><span>Sc =</span><Frac num="n² · Vc²" den="Rc^(4/3)" /><span>, Vc =</span><Frac num="Q" den="b · yc" /></>),
      isi: `${fmt(n, 3)}² · ${fmt(Vc, 4)}² / ${fmt(geoC.R, 4)}^(4/3) · 1000`,
      hasil: fmt(ScPm, 2),
      satuan: "‰",
      tint: C.critical,
    },
    {
      judul: x.rKind,
      rumus: <span>S₁ ≷ Sc,  S₂ ≷ Sc</span>,
      // Tak terjangkau: penggolongan model memakai y0 batas 50 m, jadi ditekan.
      isi: terjangkau
        ? `S₁ ${fmt(Sa * 1000, 1)} ${Sa < Sc ? "<" : ">"} ${fmt(ScPm, 2)};  S₂ ${fmt(Sb * 1000, 1)} ${Sb < Sc ? "<" : ">"} ${fmt(ScPm, 2)} ‰`
        : "—",
      hasil: terjangkau ? kindLabel : "—",
    },
    {
      judul: r.kind === "landai-curam" ? x.hBreakMS : r.kind === "landai-landai" ? x.hBreakMM : x.hBreakS,
      rumus: <span>y* = {r.kind === "landai-curam" ? "yc" : r.kind === "landai-landai" ? "y₀₂" : "y₀₁"}</span>,
      isi: terjangkau ? fmt(r.yBreak, 4) : "—",
      hasil: terjangkau ? fmt(r.yBreak, 3) : "—",
      satuan: terjangkau ? "m" : undefined,
      tint: r.criticalAtBreak ? C.critical : C.water,
    },
    ...(terjangkau && r.kind === "curam-landai"
      ? [
          {
            judul: x.hJump,
            rumus: (<><Frac num="y₁" den="2" /><span>· ( √( 1 + 8 · Fr₁² ) − 1 ) = y₀₂</span></>),
            isi:
              r.jumpAt !== null
                ? `y₁ = ${fmt(r.jumpFrom ?? NaN, 3)} m, Fr₁ = ${fmt(Fr1j, 3)}:  ${fmt(r.jumpFrom ?? NaN, 3)} / 2 · ( √( 1 + 8 · ${fmt(Fr1j, 3)}² ) − 1 ) = ${fmt(y2j, 3)} ≈ ${fmt(r.hilir.y0, 3)}`
                : r.jumpBeyondReach
                  ? x.hJumpBeyond
                  : x.hJumpDrowned,
            hasil: r.jumpAt !== null ? `xj = ${fmt(r.jumpAt, 1)}` : r.jumpBeyondReach ? `xj > ${fmt(Lb, 0)}` : "—",
            satuan: r.jumpAt !== null || r.jumpBeyondReach ? "m" : undefined,
            tint: C.energy,
          },
        ]
      : []),
  ];

  const nada: Tone = !terjangkau
    ? "invalid"
    : r.jumpDrowned || r.jumpBeyondReach
      ? "caution"
      : r.criticalAtBreak
        ? "critical"
        : r.jumpAt !== null
          ? "energy"
          : r.hulu.mild
            ? "water"
            : "neutral";
  const lencana = !terjangkau
    ? x.tak
    : r.jumpDrowned
      ? x.drowned
      : r.jumpBeyondReach
        ? x.beyond
        : kindLabel;

  return (
    <LabShell
      status={
        <div className="flex flex-col gap-3">
          <RegimeScale
            symbol="S₁"
            value={okA ? Sa * 1000 : NaN}
            invalid={!okA}
            pesan={okA ? undefined : x.tak}
            scale="log"
            digits={1}
            bands={pitaS(okA)}
          />
          <RegimeScale
            symbol="S₂"
            value={okB ? Sb * 1000 : NaN}
            invalid={!okB}
            pesan={okB ? undefined : x.tak}
            scale="log"
            digits={1}
            bands={pitaS(okB)}
          />
        </div>
      }
      sheet="OC-06"
      subject={SUBJECTS.OC[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Kemiringan dasar berubah di satu titik, dan muka air harus
            menyesuaikan diri. Yang menentukan bentuk penyesuaiannya bukan besar
            perubahan itu, melainkan di sisi mana{" "}
            <Term tint={C.critical}>kedalaman kritis</Term> berada sebelum dan
            sesudah patahan.
          </p>
        ) : (
          <p>
            The bed slope changes at one point, and the water surface has to
            adjust. What sets the shape of that adjustment is not the size of
            the change but which side of{" "}
            <Term tint={C.critical}>critical depth</Term> the flow sits on
            before and after the break.
          </p>
        )
      }
      drawing={
        <Sheet
          number="OC-06"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "Q", value: `${fmt(Q, 1)} m³/s`, tint: C.water },
            { label: "yc", value: `${fmt(yc, 3)} m`, tint: C.critical },
            { label: x.rKind, value: terjangkau ? kindLabel : "—" },
            { label: t.tbScale, value: `${x.exagg} ${fmt(exagg, 0)}×` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q} min={0.5} max={80} step={0.5} digits={1} unit="m³/s" onChange={setQ} tint={C.water} />
              <InputRow symbol="b" label={x.db} value={b} min={0.5} max={20} step={0.1} digits={1} unit="m" onChange={setB} />
              <InputRow symbol="n" label={x.dn} value={n} min={0.01} max={0.07} step={0.001} digits={3} onChange={setN} />
              <InputRow symbol="S₁" label={x.dSa} value={Sa * 1000} min={0.2} max={120} step={0.2} digits={1} unit="‰" onChange={(v) => setSa(v / 1000)} />
              <InputRow symbol="S₂" label={x.dSb} value={Sb * 1000} min={0.2} max={120} step={0.2} digits={1} unit="‰" onChange={(v) => setSb(v / 1000)} />
              <InputRow symbol="L₁" label={x.dLa} value={La} min={50} max={1500} step={10} digits={0} unit="m" onChange={setLa} />
              <InputRow symbol="L₂" label={x.dLb} value={Lb} min={50} max={1500} step={10} digits={0} unit="m" onChange={setLb} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pMS, apply: () => { setQ(12); setB(5); setN(0.025); setSa(0.0008); setSb(0.02); setLa(600); setLb(200); } },
                  { label: x.pSM, apply: () => { setQ(12); setB(5); setN(0.025); setSa(0.08); setSb(0.003); setLa(150); setLb(100); } },
                  { label: x.pMM, apply: () => { setQ(12); setB(5); setN(0.025); setSa(0.002); setSb(0.0008); setLa(800); setLb(600); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "y₀₁", label: x.rY0a, value: okA ? fmt(r.hulu.y0, 3) : "—", unit: okA ? "m" : undefined, tint: C.water, strong: true },
                { symbol: "y₀₂", label: x.rY0b, value: okB ? fmt(r.hilir.y0, 3) : "—", unit: okB ? "m" : undefined, tint: C.water, strong: true },
                { symbol: "yc", label: x.rYc, value: fmt(yc, 3), unit: "m", tint: C.critical },
                { symbol: "Sc", label: x.rSc, value: fmt(ScPm, 2), unit: "‰", tint: C.critical },
                { symbol: "y*", label: x.rBreak, value: terjangkau ? fmt(r.yBreak, 3) : "—", unit: terjangkau ? "m" : undefined, tint: r.criticalAtBreak ? C.critical : C.water },
                { symbol: "—", label: x.rProfA, value: terjangkau ? (r.hulu.profile ? r.hulu.name : x.uniform) : "—" },
                { symbol: "—", label: x.rProfB, value: terjangkau ? (r.hilir.profile ? r.hilir.name : x.uniform) : "—" },
                {
                  symbol: "xj",
                  label: x.rJump,
                  value: !terjangkau ? "—" : r.jumpAt !== null ? fmt(r.jumpAt, 1) : r.jumpBeyondReach ? `> ${fmt(Lb, 0)}` : x.jumpNone,
                  unit: terjangkau && (r.jumpAt !== null || r.jumpBeyondReach) ? "m" : undefined,
                  tint: terjangkau && (r.jumpAt !== null || r.jumpBeyondReach) ? C.energy : undefined,
                },
              ]}
            />
            <div className="mt-3">
              <Hitungan langkah={langkah} />
            </div>
          </Block>

          {terjangkau ? (
            <StateCard tone={nada} badge={lencana} {...notice(r, kendali, ScPm, lang)} />
          ) : (
            <StateCard tone="invalid" badge={x.tak} state={x.takNote} />
          )}
        </>
      }
      verification={<Verification checks={checksSlopeBreak(Q, b, n, Sa)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <Frac num="dy" den="dx" />
                <span>=</span>
                <Frac num="S₀ − Sf" den="1 − Fr²" />
                <span className="ml-5">y₀ ≷ yc</span>
                <span className="ml-2 text-ink-3">
                  {lang === "id" ? "menentukan landai atau curam" : "decides mild or steep"}
                </span>
              </Eq>
              <Eq>
                <span>y₂ =</span>
                <Frac num="y₁" den="2" />
                <span>(√(1 + 8 Fr₁²) − 1)</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id" ? "syarat berdirinya loncatan" : "condition for the jump to stand"}
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

/* ------------------------------------------------------------------ *
 * Penyusunan gambar
 * ------------------------------------------------------------------ */

/**
 * Menerjemahkan hasil hitungan menjadi deretan titik pada satu datum.
 *
 * Elevasi dihitung terhadap dasar di ujung hilir, sehingga kedua ruas berada
 * pada satu kerangka tegak yang sama dan dapat dibandingkan langsung. Semua
 * urusan fisika sudah selesai sebelum fungsi ini dipanggil; yang tersisa hanya
 * memindahkan angka ke koordinat gambar.
 */
function susun(
  r: SlopeBreak,
  La: number,
  Lb: number,
  Sa: number,
  Sb: number,
  okA: boolean,
  okB: boolean,
  lang: Lang
) {
  const T = cl(lang);
  const L = La + Lb;
  const zBreak = Sb * Lb;
  const zb = (x: number) => (x <= La ? zBreak + (La - x) * Sa : (L - x) * Sb);
  const terjangkau = okA && okB;

  const bed: ReachPoint[] = [
    { x: 0, z: zb(0) },
    { x: La, z: zBreak },
    { x: L, z: 0 },
  ];

  /* -------- muka air -------- */
  const air: ReachPoint[] = [];

  /*
   * Bila salah satu ruas tak terjangkau, y0 ruas itu adalah batas pencarian
   * 50 m dan seluruh penggolongan model (jenis patahan, profil, loncatan)
   * bersandar padanya. Muka air tidak digambar sama sekali; ruas yang
   * terjangkau cukup diberi garis acuan y0-nya, sama dengan isi tabel hasil.
   * drawReach butuh deret air tak kosong, jadi diberi deret pipih menempel
   * di dasar (tak berluas, tertutup garis dasar yang digambar sesudahnya).
   */
  if (!terjangkau) {
    for (const p of bed) air.push({ ...p, invalid: true });
  } else {
    muka(r, La, L, zBreak, zb, air);
  }

  /* -------- garis acuan -------- */
  const garis: ReachSeries[] = [];
  if (okA)
    garis.push({
      pts: [
        { x: 0, z: zb(0) + r.hulu.y0 },
        { x: La, z: zBreak + r.hulu.y0 },
      ],
      color: C.water,
      weight: W.thin,
      dash: DASH.hidden,
      label: `y₀ ${fmt(r.hulu.y0, 2)} m`,
      labelAt: 0.02,
    });
  if (okB)
    garis.push({
      pts: [
        { x: La, z: zBreak + r.hilir.y0 },
        { x: L, z: r.hilir.y0 },
      ],
      color: C.water,
      weight: W.thin,
      dash: DASH.hidden,
      label: `y₀ ${fmt(r.hilir.y0, 2)} m`,
      labelAt: 0.98,
      labelAlign: "right",
    });
  garis.push({
    pts: [
      { x: 0, z: zb(0) + r.yc },
      { x: La, z: zBreak + r.yc },
      { x: L, z: r.yc },
    ],
    color: C.critical,
    weight: W.thin,
    dash: DASH.axis,
    label: `yc ${fmt(r.yc, 2)} m`,
    labelAt: 0.25,
    labelDy: 11,
  });

  /* -------- penampang bertanda -------- */
  // Tak terjangkau: kedalaman di patahan dan loncatan bersandar pada y0 batas,
  // jadi patahan hanya ditandai letaknya, tanpa dimensi, dan loncatan tidak ada.
  const tanda: ReachMarker[] = [
    {
      x: La,
      label: T.slopeBreak,
      // Kritis bila kendali ada di patahan; selain itu sekadar penanda letak.
      color: terjangkau && r.criticalAtBreak ? C.critical : C.ink2,
      zBottom: zBreak,
      dim: terjangkau
        ? {
            zTop: zBreak + r.yBreak,
            zBottom: zBreak,
            text: `${fmt(r.yBreak, 2)} m`,
            side: r.hilir.profile ? 1 : -1,
          }
        : undefined,
    },
  ];
  if (terjangkau && r.jumpAt !== null) {
    tanda.push({
      x: La + r.jumpAt,
      label: T.jump,
      // Loncatan = tempat energi diredam.
      color: C.energy,
      zBottom: zb(La + r.jumpAt),
      dim: {
        zTop: zb(La + r.jumpAt) + (r.jumpTo ?? 0),
        zBottom: zb(La + r.jumpAt) + (r.jumpFrom ?? 0),
        text: `${fmt((r.jumpTo ?? 0), 2)} m`,
        side: 1,
      },
    });
  }

  /* -------- nama wilayah -------- */
  /*
   * Nama profil dan nama regime ditumpuk dengan geseran PIKSEL, bukan dengan
   * selisih elevasi.
   *
   * Sebelumnya keduanya dipisahkan sejauh sepersekian kedalaman air. Pada ruas
   * curam, sumbu tegak gambar didominasi penurunan dasar yang belasan meter,
   * sehingga jarak setengah meter itu menyusut menjadi belasan piksel dan kedua
   * tulisan bertumpuk.
   *
   * Tak terjangkau: nama profil "—" seperti tabel hasil. Regime hanya untuk
   * ruas yang terjangkau, dibaca dari y0 terhadap yc.
   */
  const xHulu = La * 0.45;
  const xHilir = La + Lb * 0.55;
  const zHulu = zb(xHulu) + Math.max(okA ? r.hulu.y0 : 0, r.yc) * 1.5;
  const zHilir = zb(xHilir) + Math.max(okB ? r.hilir.y0 : 0, r.yc) * 1.5;
  const wilayah: ReachRegion[] = [
    {
      x: xHulu,
      z: zHulu,
      text: !terjangkau ? "—" : r.hulu.profile ? r.hulu.name : T.uniform,
      color: C.ink,
      big: true,
    },
    {
      x: xHilir,
      z: zHilir,
      text: !terjangkau ? "—" : r.hilir.profile ? r.hilir.name : T.uniform,
      color: C.ink,
      big: true,
    },
  ];
  if (okA)
    wilayah.push({
      x: xHulu,
      z: zHulu,
      dy: 15,
      text: terjangkau ? regime(r.hulu, r.yc, T) : r.hulu.y0 > r.yc ? T.subcritical : T.supercritical,
      color: C.ink3,
    });
  if (okB)
    wilayah.push({
      x: xHilir,
      z: zHilir,
      dy: 15,
      text: terjangkau ? regime(r.hilir, r.yc, T) : r.hilir.y0 > r.yc ? T.subcritical : T.supercritical,
      color: C.ink3,
    });

  return {
    length: L,
    bed,
    water: air,
    series: garis,
    markers: tanda,
    regions: wilayah,
    axisX: T.axDistance,
    axisZ: T.elevation,
  };
}

/** Muka air kedua ruas; hanya dipanggil bila kedua ruas terjangkau. */
function muka(
  r: SlopeBreak,
  La: number,
  L: number,
  zBreak: number,
  zb: (x: number) => number,
  air: ReachPoint[]
) {
  if (r.hulu.profile) {
    for (const p of [...r.hulu.profile.points].sort((a, c) => a.x - c.x)) {
      air.push({ x: p.x, z: zb(p.x) + p.y, invalid: p.nearCritical });
    }
  } else {
    air.push({ x: 0, z: zb(0) + r.hulu.y0 });
    air.push({ x: La, z: zBreak + r.hulu.y0 });
  }

  if (r.hilir.profile) {
    const pts = [...r.hilir.profile.points].sort((a, c) => a.x - c.x);
    const sampai = r.jumpAt !== null ? r.jumpAt : Infinity;
    for (const p of pts) {
      if (p.x > sampai) break;
      air.push({ x: La + p.x, z: zb(La + p.x) + p.y, invalid: p.nearCritical });
    }
    if (r.jumpAt !== null && r.jumpFrom !== null && r.jumpTo !== null) {
      const xj = La + r.jumpAt;
      // Muka loncatan digambar tegak pada absis yang sama: itu memang bentuknya.
      air.push({ x: xj, z: zb(xj) + r.jumpFrom });
      air.push({ x: xj, z: zb(xj) + r.jumpTo });
      air.push({ x: L, z: r.hilir.y0 });
    }
  } else {
    air.push({ x: La, z: zBreak + r.hilir.y0 });
    air.push({ x: L, z: r.hilir.y0 });
  }
}

/**
 * Regime aliran pada satu ruas.
 *
 * Ditentukan kedalaman terhadap kedalaman kritis, BUKAN oleh jenis
 * kemiringannya. Pada patahan curam ke landai, ruas hilir berkemiringan landai
 * tetapi membawa profil M3 yang superkritis, sehingga membaca jenis kemiringan
 * akan memberi label yang terbalik.
 */
function regime(
  ruas: SlopeBreak["hulu"],
  yc: number,
  T: ReturnType<typeof cl>
): string {
  const pts = ruas.profile?.points;
  const y = pts && pts.length > 0 ? pts[Math.floor(pts.length / 2)].y : ruas.y0;
  return y > yc ? T.subcritical : T.supercritical;
}

/*
 * Kalimat keadaan dan butir yang perlu diperhatikan; isinya catatan lama
 * satu paragraf yang dipecah. Cabang baru jumpBeyondReach: profil M3 belum
 * mencapai konjugatnya di dalam ruas hilir, jadi loncatan berdiri di hilir
 * ujung bentang. Dulu keadaan ini jatuh ke kalimat "tenggelam", padahal
 * letaknya justru kebalikannya.
 */
function notice(
  r: SlopeBreak,
  kendali: string,
  ScPm: number,
  lang: Lang
): { state: string; notice: string[] } {
  const sc = fmt(ScPm, 2);
  if (lang === "en") {
    if (r.kind === "landai-curam")
      return {
        state: "The flow passes through critical depth exactly at the break, the only place in this drawing where the depth is known without knowing anything else.",
        notice: [
          `${kendali}. Everything to the left is computed upstream from that point as an M2 drawdown; everything to the right is computed downstream from it as an S2.`,
          `Move the downstream slope back below the critical slope Sc = ${sc} ‰ and watch the control disappear: the break stops governing, and the upstream reach starts taking its cue from the downstream reach instead.`,
        ],
      };
    if (r.kind === "curam-landai") {
      if (r.jumpAt !== null)
        return {
          state: `The supercritical flow carries on into the mild reach as an M3 profile, slows down over ${fmt(r.jumpAt, 1)} m, and only then rises through a hydraulic jump to the downstream normal depth.`,
          notice: [
            `${kendali}.`,
            "That distance matters in practice: it is the length of channel that has to be lined, because it is where the fast flow is still in contact with the bed.",
          ],
        };
      if (r.jumpBeyondReach)
        return {
          state: "The M3 profile has not reached its conjugate depth within the downstream reach, so the jump stands beyond the end of the reach drawn.",
          notice: [
            "Lengthen the downstream reach to see it.",
            "Until then the whole downstream reach drawn still carries supercritical flow and has to be lined.",
          ],
        };
      return {
        state: "The tailwater is higher than any conjugate depth the supercritical flow can reach, so the jump does not fit in the downstream reach at all.",
        notice: [
          "It is pushed upstream past the break and drowns the steep reach.",
          "Steepen the downstream slope, or lower the discharge, and watch the jump appear at the break and then walk downstream.",
        ],
      };
    }
    if (r.kind === "landai-landai")
      return {
        state: "Both reaches are subcritical, so control comes from downstream in both.",
        notice: [
          "The downstream reach simply sits at its own normal depth, and the upstream reach spends its whole length adjusting to that depth at the break.",
          "Notice that the profile name changes between M1 and M2 as soon as the downstream normal depth crosses the upstream one.",
        ],
      };
    return {
      state: "Both reaches are supercritical, so control comes from upstream in both.",
      notice: [
        "Nothing downstream can travel back up, which is why the upstream reach is drawn as a straight uniform line no matter what happens beyond the break.",
        "The adjustment happens entirely in the downstream reach.",
      ],
    };
  }

  if (r.kind === "landai-curam")
    return {
      state: "Aliran melewati kedalaman kritis tepat di patahan, satu-satunya tempat pada gambar ini yang kedalamannya dapat diketahui tanpa mengetahui apa pun yang lain.",
      notice: [
        `${kendali}. Segala yang di kiri ditelusuri ke hulu dari titik itu sebagai profil M2, segala yang di kanan ditelusuri ke hilir sebagai S2.`,
        `Turunkan kemiringan ruas hilir sampai di bawah kemiringan kritis Sc = ${sc} ‰, lalu perhatikan kendalinya lenyap: patahan berhenti memerintah, dan ruas hulu mulai mengikuti ruas hilir.`,
      ],
    };
  if (r.kind === "curam-landai") {
    if (r.jumpAt !== null)
      return {
        state: `Aliran superkritis meneruskan perjalanannya masuk ke ruas landai sebagai profil M3, melambat sepanjang ${fmt(r.jumpAt, 1)} m, dan baru sesudah itu naik lewat loncatan air ke kedalaman normal hilir.`,
        notice: [
          `${kendali}.`,
          "Jarak itu penting dalam praktik: itulah panjang saluran yang harus dilapis, karena di situ aliran cepat masih bersentuhan dengan dasar.",
        ],
      };
    if (r.jumpBeyondReach)
      return {
        state: "Profil M3 belum mencapai kedalaman konjugatnya di dalam ruas hilir, jadi loncatan berdiri di hilir ujung bentang yang digambar.",
        notice: [
          "Panjangkan ruas hilir untuk melihatnya.",
          "Sampai titik itu, seluruh ruas hilir yang digambar masih dilalui aliran superkritis dan perlu dilapis.",
        ],
      };
    return {
      state: "Muka air hilir lebih tinggi daripada kedalaman konjugat mana pun yang sanggup dicapai aliran superkritis, jadi loncatan tidak muat sama sekali di ruas hilir.",
      notice: [
        "Loncatan terdorong ke hulu melewati patahan dan menenggelamkan ruas curam.",
        "Curamkan kemiringan ruas hilir, atau turunkan debitnya, lalu perhatikan loncatan muncul di patahan lalu berjalan ke hilir.",
      ],
    };
  }
  if (r.kind === "landai-landai")
    return {
      state: "Kedua ruas subkritis, jadi kendali datang dari hilir pada keduanya.",
      notice: [
        "Ruas hilir cukup duduk pada kedalaman normalnya sendiri, dan ruas hulu memakai seluruh panjangnya untuk menyesuaikan diri terhadap kedalaman itu di patahan.",
        "Perhatikan nama profilnya berpindah antara M1 dan M2 begitu kedalaman normal hilir melewati kedalaman normal hulu.",
      ],
    };
  return {
    state: "Kedua ruas superkritis, jadi kendali datang dari hulu pada keduanya.",
    notice: [
      "Tidak ada apa pun di hilir yang dapat menjalar naik, dan itulah sebabnya ruas hulu digambar sebagai garis seragam lurus apa pun yang terjadi di seberang patahan.",
      "Seluruh penyesuaian terjadi di ruas hilir.",
    ],
  };
}
