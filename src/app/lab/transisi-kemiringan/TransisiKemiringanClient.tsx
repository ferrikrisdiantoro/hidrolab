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
import {
  drawReach,
  type ReachMarker,
  type ReachPoint,
  type ReachRegion,
  type ReachSeries,
} from "@/lib/drawReach";
import {
  criticalDepth,
  fmt,
  normalDepthReachable,
  slopeBreak,
  type SlopeBreak,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
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
      "Pada lebar dan kemiringan itu, saluran tidak sanggup mengalirkan debit sebesar ini berapa pun dalamnya. Angka kedalaman normal yang tampil hanyalah batas atas pencarian, bukan hasil yang berlaku. Perbesar lebar dasar, curamkan salah satu ruas, atau kurangi debitnya.",
    drowned: "Loncatan tenggelam",
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
      "At that width and slope the channel cannot carry this discharge at any depth. The normal depth shown is only the upper bound of the search, not a valid result. Widen the bed, steepen one of the reaches, or reduce the discharge.",
    drowned: "Jump drowned",
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
  const terjangkau =
    normalDepthReachable(Q, b, n, Sa) && normalDepthReachable(Q, b, n, Sb);

  const ref = useCanvas(
    (ctx, w, h) => drawReach(ctx, w, h, susun(r, La, Lb, Sa, Sb, lang)),
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
  const zSpan = Math.max(
    Sa * La + Sb * Lb + Math.max(r.hulu.y0, r.hilir.y0, yc),
    1e-3
  );
  const exagg = (La + Lb) / zSpan / 1.9;

  return (
    <LabShell
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
            { label: x.rKind, value: kindLabel },
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
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={C.critical}>{kindLabel}</Flag>
              <span className="value label text-[0.78rem] text-ink-3">
                {kendali}
              </span>
              {!terjangkau && <Flag alert>{x.tak}</Flag>}
              {r.jumpDrowned && <Flag alert>{x.drowned}</Flag>}
            </div>
            {!terjangkau && (
              <div className="mb-2.5">
                <Note>{x.takNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "y₀₁", label: x.rY0a, value: fmt(r.hulu.y0, 3), unit: "m", tint: C.water, strong: true },
                { symbol: "y₀₂", label: x.rY0b, value: fmt(r.hilir.y0, 3), unit: "m", tint: C.water, strong: true },
                { symbol: "yc", label: x.rYc, value: fmt(yc, 3), unit: "m", tint: C.critical },
                { symbol: "y*", label: x.rBreak, value: fmt(r.yBreak, 3), unit: "m", tint: C.signal },
                { symbol: "—", label: x.rProfA, value: r.hulu.profile ? r.hulu.name : x.uniform },
                { symbol: "—", label: x.rProfB, value: r.hilir.profile ? r.hilir.name : x.uniform },
                { symbol: "xj", label: x.rJump, value: r.jumpAt !== null ? fmt(r.jumpAt, 1) : x.jumpNone, unit: r.jumpAt !== null ? "m" : undefined, tint: r.jumpAt !== null ? C.signal : undefined },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(r, lang)}</Note>
          </Block>
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
  lang: Lang
) {
  const T = cl(lang);
  const L = La + Lb;
  const zBreak = Sb * Lb;
  const zb = (x: number) => (x <= La ? zBreak + (La - x) * Sa : (L - x) * Sb);

  const bed: ReachPoint[] = [
    { x: 0, z: zb(0) },
    { x: La, z: zBreak },
    { x: L, z: 0 },
  ];

  /* -------- muka air -------- */
  const air: ReachPoint[] = [];

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

  /* -------- garis acuan -------- */
  const garis: ReachSeries[] = [
    {
      pts: [
        { x: 0, z: zb(0) + r.hulu.y0 },
        { x: La, z: zBreak + r.hulu.y0 },
      ],
      color: C.water,
      weight: W.thin,
      dash: DASH.hidden,
      label: `y₀ ${r.hulu.y0.toFixed(2)} m`,
      labelAt: 0.02,
    },
    {
      pts: [
        { x: La, z: zBreak + r.hilir.y0 },
        { x: L, z: r.hilir.y0 },
      ],
      color: C.water,
      weight: W.thin,
      dash: DASH.hidden,
      label: `y₀ ${r.hilir.y0.toFixed(2)} m`,
      labelAt: 0.98,
      labelAlign: "right",
    },
    {
      pts: [
        { x: 0, z: zb(0) + r.yc },
        { x: La, z: zBreak + r.yc },
        { x: L, z: r.yc },
      ],
      color: C.critical,
      weight: W.thin,
      dash: DASH.axis,
      label: `yc ${r.yc.toFixed(2)} m`,
      labelAt: 0.5,
      labelDy: 11,
    },
  ];

  /* -------- penampang bertanda -------- */
  const tanda: ReachMarker[] = [
    {
      x: La,
      label: T.slopeBreak,
      color: C.signal,
      zBottom: zBreak,
      dim: {
        zTop: zBreak + r.yBreak,
        zBottom: zBreak,
        text: `${r.yBreak.toFixed(2)} m`,
        side: r.hilir.profile ? 1 : -1,
      },
    },
  ];
  if (r.jumpAt !== null) {
    tanda.push({
      x: La + r.jumpAt,
      label: T.jump,
      color: C.signal,
      zBottom: zb(La + r.jumpAt),
      dim: {
        zTop: zb(La + r.jumpAt) + (r.jumpTo ?? 0),
        zBottom: zb(La + r.jumpAt) + (r.jumpFrom ?? 0),
        text: `${(r.jumpTo ?? 0).toFixed(2)} m`,
        side: 1,
      },
    });
  }

  /* -------- nama wilayah -------- */
  const wilayah: ReachRegion[] = [
    {
      x: La * 0.45,
      z: zb(La * 0.45) + Math.max(r.hulu.y0, r.yc) * 1.5,
      text: r.hulu.profile ? r.hulu.name : T.uniform,
      color: C.ink,
      big: true,
    },
    {
      x: La + Lb * 0.55,
      z: zb(La + Lb * 0.55) + Math.max(r.hilir.y0, r.yc) * 1.5,
      text: r.hilir.profile ? r.hilir.name : T.uniform,
      color: C.ink,
      big: true,
    },
    {
      x: La * 0.45,
      z: zb(La * 0.45) + Math.max(r.hulu.y0, r.yc) * 1.5 + zSpanKecil(r),
      text: r.hulu.mild ? T.subcritical : T.supercritical,
      color: C.ink3,
    },
    {
      x: La + Lb * 0.55,
      z: zb(La + Lb * 0.55) + Math.max(r.hilir.y0, r.yc) * 1.5 + zSpanKecil(r),
      text: r.hilir.mild ? T.subcritical : T.supercritical,
      color: C.ink3,
    },
  ];

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

/** Jarak tegak antara nama profil dan nama regime di bawahnya, dalam meter. */
function zSpanKecil(r: SlopeBreak): number {
  return Math.max(r.hulu.y0, r.hilir.y0, r.yc) * 0.42;
}

function notice(r: SlopeBreak, lang: Lang): string {
  if (lang === "en") {
    if (r.kind === "landai-curam")
      return `The flow passes through critical depth exactly at the break, and that is the only place in this drawing where its depth is known without knowing anything else. Everything to the left is computed upstream from that point as an M2 drawdown; everything to the right is computed downstream from it as an S2. Move the downstream slope back below the critical slope and watch the control disappear: the break stops governing, and the upstream reach starts taking its cue from the downstream reach instead.`;
    if (r.kind === "curam-landai")
      return r.jumpAt !== null
        ? `The supercritical flow does not stop at the break. It carries on into the mild reach as an M3 profile, slowing down over ${r.jumpAt.toFixed(1)} m, and only then rises through a hydraulic jump to the downstream normal depth. That distance matters in practice: it is the length of channel that has to be lined, because it is where the fast flow is still in contact with the bed.`
        : `The tailwater is higher than any conjugate depth the supercritical flow can reach, so the jump does not fit in the downstream reach at all. It is pushed upstream past the break and drowns the steep reach. Steepen the downstream slope, or lower the discharge, and watch the jump appear at the break and then walk downstream.`;
    if (r.kind === "landai-landai")
      return `Both reaches are subcritical, so control comes from downstream in both. The downstream reach simply sits at its own normal depth, and the upstream reach spends its whole length adjusting to that depth at the break. Notice that the profile name changes between M1 and M2 as soon as the downstream normal depth crosses the upstream one.`;
    return `Both reaches are supercritical, so control comes from upstream in both. Nothing downstream can travel back up, which is why the upstream reach is drawn as a straight uniform line no matter what happens beyond the break. The adjustment happens entirely in the downstream reach.`;
  }

  if (r.kind === "landai-curam")
    return `Aliran melewati kedalaman kritis tepat di patahan, dan itu satu-satunya tempat pada gambar ini yang kedalamannya dapat diketahui tanpa mengetahui apa pun yang lain. Segala yang di kiri ditelusuri ke hulu dari titik itu sebagai profil M2, segala yang di kanan ditelusuri ke hilir sebagai S2. Turunkan kemiringan ruas hilir sampai di bawah kemiringan kritis, lalu perhatikan kendalinya lenyap: patahan berhenti memerintah, dan ruas hulu mulai mengikuti ruas hilir.`;
  if (r.kind === "curam-landai")
    return r.jumpAt !== null
      ? `Aliran superkritis tidak berhenti di patahan. Ia meneruskan perjalanannya masuk ke ruas landai sebagai profil M3, melambat sepanjang ${r.jumpAt.toFixed(1)} m, dan baru sesudah itu naik lewat loncatan air ke kedalaman normal hilir. Jarak itu penting dalam praktik: itulah panjang saluran yang harus dilapis, karena di situ aliran cepat masih bersentuhan dengan dasar.`
      : `Muka air hilir lebih tinggi daripada kedalaman konjugat mana pun yang sanggup dicapai aliran superkritis, jadi loncatan tidak muat sama sekali di ruas hilir. Ia terdorong ke hulu melewati patahan dan menenggelamkan ruas curam. Curamkan kemiringan ruas hilir, atau turunkan debitnya, lalu perhatikan loncatan muncul di patahan lalu berjalan ke hilir.`;
  if (r.kind === "landai-landai")
    return `Kedua ruas subkritis, jadi kendali datang dari hilir pada keduanya. Ruas hilir cukup duduk pada kedalaman normalnya sendiri, dan ruas hulu memakai seluruh panjangnya untuk menyesuaikan diri terhadap kedalaman itu di patahan. Perhatikan nama profilnya berpindah antara M1 dan M2 begitu kedalaman normal hilir melewati kedalaman normal hulu.`;
  return `Kedua ruas superkritis, jadi kendali datang dari hulu pada keduanya. Tidak ada apa pun di hilir yang dapat menjalar naik, dan itulah sebabnya ruas hulu digambar sebagai garis seragam lurus apa pun yang terjadi di seberang patahan. Seluruh penyesuaian terjadi di ruas hilir.`;
}
