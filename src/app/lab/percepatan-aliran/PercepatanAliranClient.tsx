"use client";

import { useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  Block,
  Hitungan,
  InputRow,
  InputTable,
  PresetRow,
  ResultTable,
  Sheet,
  StateCard,
  Term,
} from "@/components/ui";
import { useCanvas } from "@/lib/useCanvas";
import { drawField, type FieldLine, type FieldMarker } from "@/lib/drawField";
import { G, acceleration, fmt } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksAcceleration } from "@/lib/checks";

/** Diameter pangkal dan panjang saluran mengerucutnya, tetap. */
const D1 = 0.2;
const L = 0.5;

const TXT = {
  id: {
    title: "Percepatan aliran",
    sheetTitle: "Percepatan lokal dan konvektif di sepanjang saluran mengerucut",
    dQ: "Debit rata-rata",
    dS: "Simpangan debit terhadap rata-ratanya",
    dW: "Frekuensi ayunan debit",
    dD2: "Diameter di ujung",
    dX: "Penampang yang ditinjau",
    dT: "Saat yang ditinjau",
    pTunak: "Debit tetap, hanya percepatan konvektif",
    pAyun: "Debit berayun pada saluran hampir lurus",
    pKeduanya: "Keduanya bekerja sekaligus",
    rV: "Kecepatan di penampang itu",
    rLokal: "Percepatan lokal",
    rKonv: "Percepatan konvektif",
    rTotal: "Percepatan seluruhnya",
    rG: "Percepatan itu dalam kelipatan g",
    rBagi: "Bagian yang berasal dari suku konvektif",
    tunak: "Aliran tunak, suku lokalnya nol",
    takTunak: "Aliran tak tunak, kedua suku bekerja",
    kKonv: "konv",
    kLokal: "lokal",
    sState: (k: string, a: string, g: string, pct: string) =>
      `${k}: a = ${a} m/s² (${g} g), ${pct} % dari suku konvektif.`,
    nDiam: (a: string, b: string) =>
      `Tarik s ke nol: a berubah dari ${a} ke ${b} m/s², seluruhnya konvektif pada debit rata-rata Q₀. Suku konvektif saat ini ikut berubah karena mengikuti Q(t)², bukan Q₀².`,
    nSudahTunak: "Debitnya tidak berayun, jadi suku lokalnya nol dan seluruh percepatannya konvektif, meskipun tidak ada yang berubah terhadap waktu.",
    nDua: (a: string, b: string, rasio: string) =>
      `Lipatduakan Q₀: a berubah dari ${a} ke ${b} m/s² (${rasio} kali), karena suku konvektif menjadi empat kali (mengikuti kuadrat debit) sedangkan suku lokal hanya dua kali.`,
    nDuaNol: "Lipatduakan Q₀: suku konvektif menjadi empat kali (mengikuti kuadrat debit) sedangkan suku lokal hanya dua kali.",
    jD: "Diameter di penampang x",
    jA: "Luas penampang",
    jQ: "Debit pada saat t",
    jU: "Kecepatan",
    jLokal: "Percepatan lokal",
    jKonv: "Percepatan konvektif",
    jTotal: "Percepatan seluruhnya",
    jG: "Dalam kelipatan g",
    note:
      "Kekeliruan yang paling sering terjadi pada persoalan percepatan adalah menyamakan aliran tunak dengan aliran tanpa percepatan. Keduanya sama sekali bukan hal yang sama. Aliran tunak berarti kecepatan di satu titik tetap tidak berubah terhadap waktu; ia tidak berarti butiran airnya tidak dipercepat. Butiran air yang melewati saluran mengerucut ini dipercepat dengan keras meskipun tidak ada satu pun besaran di lembar ini yang berubah terhadap waktu, karena butiran itu berpindah ke tempat yang kecepatannya lebih besar. Percepatan yang dirasakannya itulah suku konvektif, dan pada nosel pemadam kebakaran ia sanggup mencapai ratusan kali percepatan gravitasi. Dua akibat langsung. Pertama, gaya yang menahan nosel itu bukan lahir dari alirannya berubah, melainkan dari alirannya berpindah ke penampang yang lebih sempit. Kedua, suku konvektif berbanding lurus dengan kuadrat debit sementara suku lokal berbanding lurus dengan debit dan frekuensinya, sehingga pada debit besar yang berayun perlahan hampir seluruh percepatannya konvektif, dan pada debit kecil yang dihidupmatikan dengan cepat hampir seluruhnya lokal. Alat ukur yang sama pada dua keadaan itu mengukur dua hal yang berlainan.",
  },
  en: {
    title: "Flow acceleration",
    sheetTitle: "Local and convective acceleration along a tapering duct",
    dQ: "Mean discharge",
    dS: "Swing of the discharge about its mean",
    dW: "Frequency of the swing",
    dD2: "Diameter at the outlet",
    dX: "Station examined",
    dT: "Instant examined",
    pTunak: "Steady discharge, convective acceleration only",
    pAyun: "Swinging discharge in a nearly straight duct",
    pKeduanya: "Both terms at work at once",
    rV: "Velocity at that station",
    rLokal: "Local acceleration",
    rKonv: "Convective acceleration",
    rTotal: "Total acceleration",
    rG: "That acceleration in multiples of g",
    rBagi: "Share coming from the convective term",
    tunak: "Steady flow, the local term vanishes",
    takTunak: "Unsteady flow, both terms are at work",
    kKonv: "conv",
    kLokal: "local",
    sState: (k: string, a: string, g: string, pct: string) =>
      `${k}: a = ${a} m/s² (${g} g), ${pct} % from the convective term.`,
    nDiam: (a: string, b: string) =>
      `Drag s to zero: a changes from ${a} to ${b} m/s², all of it convective at the mean discharge Q₀. The present convective term changes too, because it follows Q(t)², not Q₀².`,
    nSudahTunak: "The discharge does not swing, so the local term is zero and all the acceleration is convective, although nothing changes with time.",
    nDua: (a: string, b: string, rasio: string) =>
      `Double Q₀: a changes from ${a} to ${b} m/s² (${rasio} times), because the convective term becomes four times as large (it follows the square of the discharge) while the local term only doubles.`,
    nDuaNol: "Double Q₀: the convective term becomes four times as large (it follows the square of the discharge) while the local term only doubles.",
    jD: "Diameter at station x",
    jA: "Section area",
    jQ: "Discharge at time t",
    jU: "Velocity",
    jLokal: "Local acceleration",
    jKonv: "Convective acceleration",
    jTotal: "Total acceleration",
    jG: "In multiples of g",
    note:
      "The commonest mistake in acceleration problems is to equate steady flow with unaccelerated flow. They are not the same thing at all. Steady means the velocity at a fixed point does not change with time; it does not mean the grains of water are not accelerated. A grain passing through this tapering duct is accelerated hard although not one quantity on this sheet changes with time, because that grain moves into a place where the velocity is higher. The acceleration it feels is the convective term, and in a firefighting nozzle it reaches hundreds of times the acceleration of gravity. Two consequences follow at once. First, the force holding that nozzle is born not of the flow changing but of the flow moving into a narrower section. Second, the convective term goes with the square of the discharge while the local term goes with the discharge and its frequency, so at a large discharge swinging slowly almost all the acceleration is convective, and at a small discharge switched quickly on and off almost all of it is local. The same instrument in those two cases measures two different things.",
  },
} as const;

const REFS = {
  id: [
    "Euler, L. (1757). Principes généraux du mouvement des fluides.",
    "Batchelor, G.K. (1967). An Introduction to Fluid Dynamics, bab 3.",
    "Panton, R.L. (2013). Incompressible Flow, edisi ke-4, bab 5.",
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, edisi ke-8, bab 4.",
  ],
  en: [
    "Euler, L. (1757). Principes généraux du mouvement des fluides.",
    "Batchelor, G.K. (1967). An Introduction to Fluid Dynamics, ch. 3.",
    "Panton, R.L. (2013). Incompressible Flow, 4th ed., ch. 5.",
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, 8th ed., ch. 4.",
  ],
} as const;

export function PercepatanAliranClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Q0, setQ0] = useState(0.1);
  const [swing, setSwing] = useState(0.3);
  const [omega, setOmega] = useState(1);
  const [D2, setD2] = useState(0.08);
  const [pos, setPos] = useState(0.25);
  const [waktu, setWaktu] = useState(0.4);

  const r = acceleration(Q0, swing, omega, D1, D2, L, pos, waktu);
  /* Nilai antara untuk langkah hitungan; rumusnya sama dengan model. */
  const Dx = D1 + (D2 - D1) * Math.min(Math.max(pos / L, 0), 1);
  const Ax = (Math.PI * Dx * Dx) / 4;
  const Qt = Q0 * (1 + swing * Math.sin(omega * waktu));

  const ref = useCanvas(
    (ctx, w, ch) => {
      const garis: FieldLine[] = [
        {
          pts: r.profile.map((p) => ({ x: p.x, y: p.convective })),
          color: C.critical,
          weight: W.bold,
          dash: DASH.solid,
          label: T.convectiveAccel,
          labelAt: 0.82,
          labelDy: -10,
          labelAlign: "right",
        },
        {
          pts: r.profile.map((p) => ({ x: p.x, y: p.local })),
          color: C.water,
          weight: W.bold,
          dash: DASH.hidden,
          label: T.localAccel,
          labelAt: 0.2,
          labelDy: 16,
          labelAlign: "left",
        },
        {
          pts: r.profile.map((p) => ({ x: p.x, y: p.local + p.convective })),
          color: C.energy,
          weight: W.thin,
          dash: DASH.solid,
          label: T.totalAccel,
          labelAt: 0.52,
          labelDy: -12,
          labelAlign: "center",
        },
      ];

      const nilai = r.profile.flatMap((p) => [
        p.local,
        p.convective,
        p.local + p.convective,
      ]);
      const atas = Math.max(...nilai, 0);
      const bawah = Math.min(...nilai, 0);
      const jarak = Math.max(atas - bawah, 1e-6);

      const titik: FieldMarker[] = [
        { x: pos, y: r.total, color: C.energy, size: 5, filled: true },
      ];

      drawField(
        ctx,
        w,
        ch,
        {
          xMin: 0,
          xMax: L,
          yMin: bawah - jarak * 0.16,
          yMax: atas + jarak * 0.2,
          equalScale: false,
          lines: garis,
          markers: titik,
          heading: r.steady ? x.tunak : undefined,
          axisX: T.axAlongDuct,
          axisY: T.axAccel,
        },
        lang
      );
    },
    [Q0, swing, omega, D2, pos, waktu, lang]
  );

  return (
    <LabShell
      sheet="FF-07"
      subject={SUBJECTS.FF[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Aliran <Term tint={C.water}>tunak</Term> sama sekali bukan aliran
            tanpa percepatan. Butiran air yang melewati penyempitan dipercepat
            keras oleh suku <Term tint={C.critical}>konvektif</Term>, meskipun
            tidak ada satu pun yang berubah terhadap waktu.
          </p>
        ) : (
          <p>
            <Term tint={C.water}>Steady</Term> flow is not unaccelerated flow. A
            grain passing a contraction is accelerated hard by the{" "}
            <Term tint={C.critical}>convective</Term> term, although nothing at
            all changes with time.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FF-07"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m/s², m, s)" },
            { label: "a", value: `${fmt(r.total, 1)} m/s²`, tint: C.energy },
            { label: "a/g", value: `${fmt(r.inGravities, 2)}` },
            { label: x.kKonv, value: `${fmt(r.convective, 1)} m/s²`, tint: C.critical },
            { label: x.kLokal, value: `${fmt(r.local, 1)} m/s²`, tint: C.water },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q₀" label={x.dQ} value={Q0 * 1000} min={5} max={500} step={5} digits={0} unit="l/s" onChange={(v) => setQ0(v / 1000)} tint={C.water} />
              <InputRow symbol="s" label={x.dS} value={swing} min={0} max={0.9} step={0.05} digits={2} onChange={setSwing} />
              <InputRow symbol="ω" label={x.dW} value={omega} min={0} max={10} step={0.25} digits={2} unit="rad/s" onChange={setOmega} />
              <InputRow symbol="D₂" label={x.dD2} value={D2 * 1000} min={30} max={200} step={5} digits={0} unit="mm" onChange={(v) => setD2(v / 1000)} tint={C.critical} />
              <InputRow symbol="x" label={x.dX} value={pos} min={0} max={L} step={0.01} digits={2} unit="m" onChange={setPos} />
              <InputRow symbol="t" label={x.dT} value={waktu} min={0} max={6} step={0.05} digits={2} unit="s" onChange={setWaktu} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pTunak, apply: () => { setQ0(0.1); setSwing(0); setOmega(1); setD2(0.06); setPos(0.25); setWaktu(0.4); } },
                  { label: x.pAyun, apply: () => { setQ0(0.05); setSwing(0.8); setOmega(6); setD2(0.19); setPos(0.25); setWaktu(0.4); } },
                  { label: x.pKeduanya, apply: () => { setQ0(0.02); setSwing(0.5); setOmega(6); setD2(0.17); setPos(0.25); setWaktu(0.2); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "u", label: x.rV, value: fmt(r.velocity, 3), unit: "m/s", tint: C.water },
                { symbol: "∂u/∂t", label: x.rLokal, value: fmt(r.local, 3), unit: "m/s²", tint: C.water, strong: true },
                { symbol: "u ∂u/∂x", label: x.rKonv, value: fmt(r.convective, 3), unit: "m/s²", tint: C.critical, strong: true },
                { symbol: "a", label: x.rTotal, value: fmt(r.total, 3), unit: "m/s²", tint: C.energy, strong: true },
                { symbol: "a/g", label: x.rG, value: fmt(r.inGravities, 3) },
                { symbol: "konv/Σ", label: x.rBagi, value: fmt(r.convectiveShare * 100, 1), unit: "%" },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.jD,
                    rumus: <span>D(x) = D₁ + (D₂ − D₁) · x / L</span>,
                    isi: `${fmt(D1, 3)} + ( ${fmt(D2, 3)} − ${fmt(D1, 3)} ) · ${fmt(pos, 2)} / ${fmt(L, 2)}`,
                    hasil: fmt(Dx, 4),
                    satuan: "m",
                  },
                  {
                    judul: x.jA,
                    rumus: <span>A = π · D² / 4</span>,
                    isi: `π · ${fmt(Dx, 4)}² / 4`,
                    hasil: fmt(Ax, 5),
                    satuan: "m²",
                  },
                  {
                    judul: x.jQ,
                    rumus: <span>Q(t) = Q₀ · ( 1 + s · sin ωt )</span>,
                    isi: `${fmt(Q0, 3)} · ( 1 + ${fmt(swing, 2)} · sin( ${fmt(omega, 2)} · ${fmt(waktu, 2)} ) )`,
                    hasil: fmt(Qt, 4),
                    satuan: "m³/s",
                    tint: C.water,
                  },
                  {
                    judul: x.jU,
                    rumus: (<><span>u =</span><Frac num="Q(t)" den="A" /></>),
                    isi: `${fmt(Qt, 4)} / ${fmt(Ax, 5)}`,
                    hasil: fmt(r.velocity, 3),
                    satuan: "m/s",
                    tint: C.water,
                  },
                  {
                    judul: x.jLokal,
                    rumus: (<><Frac num="∂u" den="∂t" /><span>=</span><Frac num="Q₀ · s · ω · cos ωt" den="A" /></>),
                    isi: `${fmt(Q0, 3)} · ${fmt(swing, 2)} · ${fmt(omega, 2)} · cos( ${fmt(omega, 2)} · ${fmt(waktu, 2)} ) / ${fmt(Ax, 5)}`,
                    hasil: fmt(r.local, 3),
                    satuan: "m/s²",
                    tint: C.water,
                  },
                  {
                    judul: x.jKonv,
                    rumus: (<><span>u</span><Frac num="∂u" den="∂x" /><span>= u · ( −2u · (D₂ − D₁) / (L · D) )</span></>),
                    isi: `${fmt(r.velocity, 4)} · ( −2 · ${fmt(r.velocity, 4)} · ( ${fmt(D2, 3)} − ${fmt(D1, 3)} ) / ( ${fmt(L, 2)} · ${fmt(Dx, 4)} ) )`,
                    hasil: fmt(r.convective, 3),
                    satuan: "m/s²",
                    tint: C.critical,
                  },
                  {
                    judul: x.jTotal,
                    rumus: <span>a = ∂u/∂t + u ∂u/∂x</span>,
                    isi: `${fmt(r.local, 4)} + ${kurung(r.convective, 4)}`,
                    hasil: fmt(r.total, 3),
                    satuan: "m/s²",
                    tint: C.energy,
                  },
                  {
                    judul: x.jG,
                    rumus: <span>a / g</span>,
                    isi: `${fmt(r.total, 4)} / ${fmt(G, 2)}`,
                    hasil: fmt(r.inGravities, 3),
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={r.steady ? "water" : "neutral"}
            badge={r.steady ? x.tunak : x.takTunak}
            state={x.sState(
              r.steady ? x.tunak : x.takTunak,
              fmt(r.total, 1),
              fmt(r.inGravities, 2),
              fmt(r.convectiveShare * 100, 0)
            )}
            notice={notice(Q0, swing, omega, D2, pos, waktu, lang)}
          />
        </>
      }
      verification={
        <Verification
          checks={checksAcceleration(Q0, swing, omega, D1, D2, L, pos, waktu)}
        />
      }
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>a =</span>
                <Frac num="∂u" den="∂t" />
                <span>+ u</span>
                <Frac num="∂u" den="∂x" />
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "suku pertama lokal, suku kedua konvektif"
                    : "the first term local, the second convective"}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `saluran mengerucut dari ${fmt(D1 * 1000, 0)} mm sepanjang ${fmt(L, 2)} m; g = ${fmt(G, 2)} m/s²`
                    : `duct tapering from ${fmt(D1 * 1000, 0)} mm over ${fmt(L, 2)} m; g = ${fmt(G, 2)} m/s²`}
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

/** Angka negatif dalam substitusi ditulis berkurung. */
function kurung(v: number, dg: number) {
  const t = fmt(v, dg);
  return v < 0 && t !== fmt(0, dg) ? `(${t})` : t;
}

/*
 * Kalimat dibangun dari nilai yang dihitung: kata kerjanya netral
 * ("berubah dari … ke …") karena tanda a bisa negatif, dan nisbah Q₀ ×2
 * ditulis angkanya, bukan "lebih daripada dua kali".
 */
function notice(
  Q0: number,
  swing: number,
  omega: number,
  D2: number,
  pos: number,
  waktu: number,
  lang: Lang
): string[] {
  const x = TXT[lang];
  const a = acceleration(Q0, swing, omega, D1, D2, L, pos, waktu);
  const diam = acceleration(Q0, 0, omega, D1, D2, L, pos, waktu);
  const dua = acceleration(Q0 * 2, swing, omega, D1, D2, L, pos, waktu);
  const out: string[] = [];
  out.push(a.steady ? x.nSudahTunak : x.nDiam(fmt(a.total, 1), fmt(diam.total, 1)));
  out.push(
    Math.abs(a.total) > 1e-9
      ? x.nDua(fmt(a.total, 1), fmt(dua.total, 1), fmt(dua.total / a.total, 2))
      : x.nDuaNol
  );
  return out;
}
