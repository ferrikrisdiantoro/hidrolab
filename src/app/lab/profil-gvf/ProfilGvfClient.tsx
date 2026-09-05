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
import { drawGvf } from "@/lib/drawGvf";
import {
  criticalDepth,
  fmt,
  froude,
  gvfProfile,
  normalDepth,
  normalDepthReachable,
} from "@/lib/hydraulics";
import { C } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksGvf } from "@/lib/checks";

const TXT = {
  id: {
    title: "Profil aliran berubah lambat",
    sheetTitle: "Profil muka air — saluran persegi prismatis",
    dQ: "Debit",
    db: "Lebar dasar",
    dn: "Kekasaran Manning",
    dS: "Kemiringan dasar",
    dyc: "Kedalaman di penampang kendali",
    dL: "Panjang bentang",
    pM1: "M1 — bendung di hilir",
    pM2: "M2 — terjunan di hilir",
    pS2: "S2 — saluran curam",
    rProfile: "Jenis profil",
    rY0: "Kedalaman normal",
    rYc: "Kedalaman kritis",
    rFrC: "Froude di penampang kendali",
    rDir: "Arah penelusuran",
    rSlope: "Jenis kemiringan",
    rDy: "Selisih terhadap kedalaman normal",
    tak: "Melampaui kapasitas saluran",
    takNote: "Pada lebar dan kemiringan ini, saluran tidak sanggup mengalirkan debit sebesar itu berapa pun dalamnya. Tidak ada kedalaman normal yang memenuhi persamaan Manning, jadi angka y₀ di atas hanyalah batas atas pencarian, bukan hasil yang berlaku. Perbesar lebar dasar, perbesar kemiringan, atau kurangi debitnya.",
    dirUp: "Ke hulu",
    dirDown: "Ke hilir",
    mild: "Landai",
    steep: "Curam",
    note: "Persamaan aliran berubah lambat diselesaikan dengan Runge-Kutta orde empat, bukan dengan langkah maju sederhana, karena galat langkah maju menumpuk sepanjang bentang panjang dan membuat profil menyimpang dari kedalaman normal yang seharusnya didekatinya. Arah penelusuran ditentukan fisika: aliran subkritis dikendalikan dari hilir sehingga ditelusuri ke arah hulu, sedangkan aliran superkritis dikendalikan dari hulu. Ruas yang mendekati kedalaman kritis digambar titik rapat — di situ penyebut (1 − Fr²) menuju nol dan kemiringan muka air menjadi tegak, yang merupakan batas keberlakuan persamaannya, bukan keadaan nyata.",
  },
  en: {
    title: "Gradually varied flow profile",
    sheetTitle: "Water surface profile — prismatic rectangular channel",
    dQ: "Discharge",
    db: "Bed width",
    dn: "Manning roughness",
    dS: "Bed slope",
    dyc: "Depth at control section",
    dL: "Reach length",
    pM1: "M1 — weir downstream",
    pM2: "M2 — free overfall",
    pS2: "S2 — steep channel",
    rProfile: "Profile type",
    rY0: "Normal depth",
    rYc: "Critical depth",
    rFrC: "Froude at control section",
    rDir: "Computation direction",
    rSlope: "Slope type",
    rDy: "Difference from normal depth",
    tak: "Exceeds channel capacity",
    takNote: "At this width and slope the channel cannot carry that discharge at any depth. No normal depth satisfies Manning's equation, so the y₀ shown above is only the upper bound of the search, not a valid result. Widen the bed, steepen the slope, or reduce the discharge.",
    dirUp: "Upstream",
    dirDown: "Downstream",
    mild: "Mild",
    steep: "Steep",
    note: "The gradually varied flow equation is integrated with fourth-order Runge-Kutta rather than a simple forward step, because forward-step error accumulates over a long reach and drags the profile away from the normal depth it should approach. The direction of computation is set by physics: subcritical flow is controlled from downstream and therefore computed upstream, while supercritical flow is controlled from upstream. Reaches approaching critical depth are drawn with fine dots — there the denominator (1 − Fr²) tends to zero and the surface slope becomes vertical, which marks the limit of the equation rather than a real condition.",
  },
} as const;

const REFS = {
  id: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Bab 9 — Theory and Analysis of Gradually Varied Flow.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Bab 6.",
    "USGS (1988). Basic Hydraulic Principles of Open-Channel Flow, Open-File Report 88-707.",
    "Sturm, T.W. (2010). Open Channel Hydraulics, edisi ke-2. McGraw-Hill.",
  ],
  en: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Chapter 9 — Theory and Analysis of Gradually Varied Flow.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Chapter 6.",
    "USGS (1988). Basic Hydraulic Principles of Open-Channel Flow, Open-File Report 88-707.",
    "Sturm, T.W. (2010). Open Channel Hydraulics, 2nd ed. McGraw-Hill.",
  ],
} as const;

export function ProfilGvfClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [Q, setQ] = useState(12);
  const [b, setB] = useState(5);
  const [n, setN] = useState(0.025);
  const [S0, setS0] = useState(0.0015);
  const [yCtl, setYCtl] = useState(2.5);
  const [L, setL] = useState(1200);

  const yc = criticalDepth(Q / b);
  const y0 = normalDepth(Q, b, n, S0);
  const terjangkau = normalDepthReachable(Q, b, n, S0);
  const result = gvfProfile(Q, b, n, S0, yCtl, L, 400);
  const FrCtl = froude(Q / (b * yCtl), yCtl);

  const ref = useCanvas(
    (ctx, w, h) => drawGvf(ctx, w, h, { result, length: L, S0 }, lang),
    [Q, b, n, S0, yCtl, L, lang]
  );

  return (
    <LabShell
      sheet="OC-03"
      subject={SUBJECTS.OC[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Di antara dua penampang kendali, muka air tidak sejajar dasar. Ia
            melengkung menuju <Term tint={C.water}>kedalaman normal</Term> di
            satu sisi dan menjauhinya di sisi lain, dan bentuk lengkung itulah
            yang menentukan sejauh mana pengaruh sebuah bangunan menjalar.
          </p>
        ) : (
          <p>
            Between two control sections the water surface is not parallel to
            the bed. It curves toward <Term tint={C.water}>normal depth</Term> on
            one side and away from it on the other, and that curvature decides
            how far the influence of a structure reaches.
          </p>
        )
      }
      drawing={
        <Sheet
          number="OC-03"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "Q", value: `${fmt(Q, 1)} m³/s`, tint: C.water },
            { label: "y₀", value: `${fmt(y0, 3)} m`, tint: C.water },
            { label: "yc", value: `${fmt(yc, 3)} m`, tint: C.critical },
            { label: t.tbSlope, value: result.mild ? x.mild : x.steep },
            { label: x.rProfile, value: result.profile },
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
              <InputRow symbol="S₀" label={x.dS} value={S0 * 1000} min={0.05} max={40} step={0.05} digits={2} unit="‰" onChange={(v) => setS0(v / 1000)} />
              <InputRow symbol="y" label={x.dyc} value={yCtl} min={0.1} max={6} step={0.05} unit="m" onChange={setYCtl} tint={C.signal} />
              <InputRow symbol="L" label={x.dL} value={L} min={100} max={4000} step={50} digits={0} unit="m" onChange={setL} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pM1, apply: () => { setQ(12); setB(5); setN(0.025); setS0(0.0015); setYCtl(2.8); setL(2000); } },
                  { label: x.pM2, apply: () => { setQ(12); setB(5); setN(0.025); setS0(0.0015); setYCtl(0.95); setL(800); } },
                  { label: x.pS2, apply: () => { setQ(12); setB(5); setN(0.025); setS0(0.02); setYCtl(0.84); setL(400); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={C.critical}>{result.profile}</Flag>
              <span className="value label text-[0.78rem] text-ink-3">
                {result.mild ? x.mild : x.steep}
              </span>
              {!terjangkau && <Flag alert>{x.tak}</Flag>}
            </div>
            {!terjangkau && (
              <div className="mb-2.5">
                <Note>{x.takNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "—", label: x.rProfile, value: result.profile, tint: C.critical, strong: true },
                { symbol: "y₀", label: x.rY0, value: fmt(y0, 3), unit: "m", tint: C.water, strong: true },
                { symbol: "yc", label: x.rYc, value: fmt(yc, 3), unit: "m", tint: C.critical },
                { symbol: "Fr", label: x.rFrC, value: fmt(FrCtl) },
                { symbol: "—", label: x.rDir, value: result.direction === "hulu" ? x.dirUp : x.dirDown },
                { symbol: "Δy", label: x.rDy, value: fmt(Math.abs(result.points[0].y - y0), 3), unit: "m" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(result.profile, result.points[0].y, y0, L, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksGvf(Q, b, n, S0)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <Frac num="dy" den="dx" />
                <span>=</span>
                <Frac num="S₀ − Sf" den="1 − Fr²" />
              </Eq>
              <Eq>
                <span>Sf =</span>
                <Frac num="n² V²" den="R^(4/3)" />
                <span className="ml-5">Fr² =</span>
                <Frac num="q²" den="g y³" />
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
  profile: string,
  yFar: number,
  y0: number,
  L: number,
  lang: Lang
): string {
  const gap = Math.abs(yFar - y0);
  const close = gap < 0.05;

  if (lang === "en") {
    if (profile === "M1")
      return `A backwater curve. The weir holds the depth above normal, and the effect reaches upstream until the surface settles back to y₀. After ${L} m the depth is still ${gap.toFixed(3)} m away from normal${close ? " — practically settled" : ", so the reach drawn is not yet long enough to contain the whole influence"}. This is the curve that decides how far upstream a structure floods land.`;
    if (profile === "M2")
      return "A drawdown curve toward a free overfall. The depth falls from normal toward critical, and the surface steepens as it approaches it. Notice the dotted section near the downstream end: there the equation loses validity, because gradually varied flow assumes the surface curvature stays gentle.";
    if (profile === "M3")
      return "The flow is supercritical on a mild slope — this happens below a gate. The depth rises toward critical going downstream, and a hydraulic jump will form where it meets the tailwater. Sheet OC-01 covers what happens at that point.";
    if (profile === "S2")
      return "On a steep slope the flow accelerates from critical toward normal depth going downstream. Notice that the computation runs downstream here, not upstream: supercritical flow is controlled from upstream, so what happens below cannot travel back up.";
    return `The profile is ${profile}. Move the control depth across y₀ and yc and watch the profile name change — the letter comes from the slope type, the number from which zone the control depth falls in.`;
  }

  if (profile === "M1")
    return `Kurva pembendungan. Bendung menahan kedalaman di atas normal, dan pengaruhnya menjalar ke hulu sampai muka air kembali ke y₀. Setelah ${L} m, kedalamannya masih berselisih ${gap.toFixed(3)} m dari normal${close ? " — praktis sudah kembali" : ", jadi bentang yang digambar belum cukup panjang untuk memuat seluruh pengaruhnya"}. Kurva inilah yang menentukan sejauh mana ke hulu sebuah bangunan menggenangi lahan.`;
  if (profile === "M2")
    return "Kurva penurunan menuju terjunan bebas. Kedalaman turun dari normal menuju kritis, dan muka air makin curam saat mendekatinya. Perhatikan ruas titik-titik di dekat ujung hilir: di situ persamaannya kehilangan keberlakuan, karena aliran berubah lambat mengandaikan lengkung permukaan tetap landai.";
  if (profile === "M3")
    return "Aliran superkritis di atas saluran landai — ini yang terjadi di hilir pintu. Kedalaman naik menuju kritis ke arah hilir, dan loncatan air akan terbentuk di tempat ia bertemu muka air hilir. Lembar OC-01 membahas apa yang terjadi di titik itu.";
  if (profile === "S2")
    return "Pada saluran curam, aliran dipercepat dari kondisi kritis menuju kedalaman normal ke arah hilir. Perhatikan bahwa penelusuran di sini berjalan ke hilir, bukan ke hulu: aliran superkritis dikendalikan dari hulu, sehingga apa yang terjadi di bawah tidak dapat menjalar naik.";
  return `Profilnya ${profile}. Geser kedalaman di penampang kendali melewati y₀ dan yc, lalu perhatikan nama profilnya berubah — hurufnya berasal dari jenis kemiringan, angkanya dari zona tempat kedalaman kendali berada.`;
}
