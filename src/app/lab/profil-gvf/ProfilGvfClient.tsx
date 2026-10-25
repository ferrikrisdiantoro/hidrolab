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
  type RegimeBand,
} from "@/components/ui";
import { useCanvas } from "@/lib/useCanvas";
import { drawGvf } from "@/lib/drawGvf";
import {
  G,
  criticalDepth,
  type GvfResult,
  fmt,
  froude,
  gvfProfile,
  normalDepth,
  normalDepthReachable,
  rectGeometry,
} from "@/lib/hydraulics";
import { C, type Tone } from "@/lib/theme";
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
    rLen: "Panjang profil sampai kondisi kritis",
    berhenti: "Profil berakhir sebelum ujung bentang",
    tak: "Melampaui kapasitas saluran",
    takNote: "Pada lebar dan kemiringan ini, saluran tidak sanggup mengalirkan debit sebesar itu berapa pun dalamnya. Tidak ada kedalaman normal yang memenuhi persamaan Manning, jadi y₀, jenis kemiringan, nama profil, dan Δy ditulis “—”. Perbesar lebar dasar, perbesar kemiringan, atau kurangi debitnya.",
    hQ: "Debit satuan dan kedalaman kritis",
    hY0: "Kedalaman normal, Manning dibalik: debit pada y₀",
    hY0Tak: "Kedalaman normal: tidak ada y yang memenuhi Manning",
    hKlas: "Penggolongan profil",
    hInt: "Integrasi Runge-Kutta orde empat",
    hIntIsi: (L: string, dx: string, arah: string) => `400 langkah, Δx = ${L} / 400 = ${dx} m, ditelusuri ${arah} dari penampang kendali`,
    arahHulu: "ke hulu",
    arahHilir: "ke hilir",
    zona: "zona",
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
    rLen: "Profile length up to critical conditions",
    berhenti: "Profile ends before the end of the reach",
    tak: "Exceeds channel capacity",
    takNote: "At this width and slope the channel cannot carry that discharge at any depth. No normal depth satisfies Manning's equation, so y₀, the slope type, the profile name and Δy are shown as “—”. Widen the bed, steepen the slope, or reduce the discharge.",
    hQ: "Unit discharge and critical depth",
    hY0: "Normal depth, Manning inverted: discharge at y₀",
    hY0Tak: "Normal depth: no y satisfies Manning",
    hKlas: "Profile classification",
    hInt: "Fourth-order Runge-Kutta integration",
    hIntIsi: (L: string, dx: string, arah: string) => `400 steps, Δx = ${L} / 400 = ${dx} m, computed ${arah} from the control section`,
    arahHulu: "upstream",
    arahHilir: "downstream",
    zona: "zone",
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

  // Profil yang berhenti di kedalaman kritis lebih pendek daripada bentangnya.
  const urutX = [...result.points].sort((a, c) => a.x - c.x);
  const panjangProfil = urutX[urutX.length - 1].x - urutX[0].x;

  /* Ujung jauh profil, yaitu ujung yang BUKAN penampang kendali. Titik
     diurutkan menurut x, dan penampang kendali profil subkritis ada di
     hilir (x = L), profil superkritis di hulu (x = 0). Dulu Δy selalu
     memakai points[0], yang untuk profil superkritis adalah penampang
     kendalinya sendiri. */
  const ujungJauh =
    result.direction === "hulu" ? result.points[0] : result.points[result.points.length - 1];
  const dy = Math.abs(ujungJauh.y - y0);

  // Tanpa kedalaman normal, y0 hanyalah batas atas pencarian (50 m).
  const tampil = (v: number) => (terjangkau ? v : NaN);
  const q = Q / b;
  const geo0 = rectGeometry(b, y0);
  const Qcek = (1 / n) * geo0.A * Math.pow(geo0.R, 2 / 3) * Math.sqrt(S0);
  const VCtl = Q / (b * yCtl);
  const subkritisKendali = yCtl > yc;

  /* Pita zona kedalaman kendali dari yc dan y0, sama dengan penggolongan
     gvfProfile (zona 1 di atas kedua garis, 3 di bawah keduanya). Sumbu
     memuat penggeser 0,1 sampai 6 m, dan melebar bila y0 atau yc di atasnya. */
  const puncak = Math.max(6, (terjangkau ? Math.max(y0, yc) : yc) * 1.08);
  const pitaZona: RegimeBand[] = !terjangkau
    ? [{ from: 0, to: 6, label: x.tak, tone: "invalid" }]
    : result.mild
      ? [
          { from: 0, to: yc, label: "M3", tone: "neutral" },
          { from: yc, to: y0, label: "M2", tone: "water" },
          { from: y0, to: puncak, label: "M1", tone: "water" },
        ]
      : [
          { from: 0, to: y0, label: "S3", tone: "neutral" },
          { from: y0, to: yc, label: "S2", tone: "neutral" },
          { from: yc, to: puncak, label: "S1", tone: "water" },
        ];

  const nada: Tone = !terjangkau
    ? "invalid"
    : result.endsAtCritical
      ? "critical"
      : subkritisKendali
        ? "water"
        : "neutral";

  const ref = useCanvas(
    (ctx, w, h) =>
      drawGvf(
        ctx,
        w,
        h,
        { result, length: L, S0, normalUnreachable: !terjangkau },
        lang
      ),
    [Q, b, n, S0, yCtl, L, lang]
  );

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="y"
          value={terjangkau ? yCtl : NaN}
          invalid={!terjangkau}
          pesan={terjangkau ? undefined : x.tak}
          digits={2}
          bands={pitaZona}
        />
      }
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
            { label: "y₀", value: terjangkau ? `${fmt(y0, 3)} m` : "—", tint: C.water },
            { label: "yc", value: `${fmt(yc, 3)} m`, tint: C.critical },
            { label: t.tbSlope, value: terjangkau ? (result.mild ? x.mild : x.steep) : "—" },
            { label: x.rProfile, value: terjangkau ? result.profile : "—" },
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
              <InputRow symbol="y" label={x.dyc} value={yCtl} min={0.1} max={6} step={0.05} unit="m" onChange={setYCtl} tint={C.water} />
              <InputRow symbol="L" label={x.dL} value={L} min={100} max={4000} step={50} digits={0} unit="m" onChange={setL} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pM1, apply: () => { setQ(12); setB(5); setN(0.025); setS0(0.0015); setYCtl(2.8); setL(2000); } },
                  { label: x.pM2, apply: () => { setQ(12); setB(5); setN(0.025); setS0(0.0015); setYCtl(0.95); setL(800); } },
                  // Kedalaman kendali harus di BAWAH kedalaman kritis, yang pada debit
                  // dan lebar ini bernilai 0,8374 m. Nilai 0,84 yang dipakai sebelumnya
                  // berada 3 mm di atasnya, sehingga alirannya digolongkan subkritis dan
                  // profil yang keluar S1, bukan S2 seperti tertulis pada tombolnya.
                  { label: x.pS2, apply: () => { setQ(12); setB(5); setN(0.025); setS0(0.02); setYCtl(0.8); setL(400); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "—", label: x.rProfile, value: terjangkau ? result.profile : "—", tint: C.critical, strong: true },
                { symbol: "y₀", label: x.rY0, value: fmt(tampil(y0), 3), unit: terjangkau ? "m" : undefined, tint: C.water, strong: true },
                { symbol: "yc", label: x.rYc, value: fmt(yc, 3), unit: "m", tint: C.critical },
                { symbol: "Fr", label: x.rFrC, value: fmt(FrCtl) },
                { symbol: "—", label: x.rDir, value: result.direction === "hulu" ? x.dirUp : x.dirDown },
                { symbol: "Δy", label: x.rDy, value: fmt(tampil(dy), 3), unit: terjangkau ? "m" : undefined },
                ...(result.endsAtCritical
                  ? [
                      {
                        symbol: "Lp",
                        label: x.rLen,
                        value: fmt(panjangProfil, 1),
                        unit: "m",
                        tint: C.critical,
                      },
                    ]
                  : []),
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hQ,
                    rumus: (<><span>q =</span><Frac num="Q" den="b" /><span>, yc =</span><Frac num="∛( q² )" den="∛g" /></>),
                    isi: `q = ${fmt(Q, 1)} / ${fmt(b, 1)} = ${fmt(q, 4)} m²/s;  yc = ∛( ${fmt(q, 4)}² / ${fmt(G, 2)} )`,
                    hasil: fmt(yc, 3),
                    satuan: "m",
                    tint: C.critical,
                  },
                  {
                    /* Manning dibalik dengan bagi dua; langkah ini memeriksa
                       bahwa debit pada y0 yang ditemukan memang sama dengan Q. */
                    judul: terjangkau ? `${x.hY0} = ${fmt(y0, 3)} m` : x.hY0Tak,
                    rumus: (<><span>Q =</span><Frac num="1" den="n" /><span>· ( b · y₀ ) · R^⅔ · S₀^½</span></>),
                    isi: terjangkau
                      ? `( 1 / ${fmt(n, 3)} ) · ( ${fmt(b, 1)} · ${fmt(y0, 4)} ) · ${fmt(geo0.R, 4)}^⅔ · ${fmt(S0, 5)}^½`
                      : "—",
                    hasil: fmt(tampil(Qcek), 2),
                    satuan: terjangkau ? "m³/s" : undefined,
                    tint: C.water,
                  },
                  {
                    judul: x.rFrC,
                    rumus: (<><span>Fr =</span><Frac num="Q / ( b · y )" den="√( g · y )" /></>),
                    isi: `( ${fmt(Q, 1)} / ( ${fmt(b, 1)} · ${fmt(yCtl, 2)} ) ) / √( ${fmt(G, 2)} · ${fmt(yCtl, 2)} ) = ${fmt(VCtl, 3)} / √( ${fmt(G, 2)} · ${fmt(yCtl, 2)} )`,
                    hasil: fmt(FrCtl),
                  },
                  {
                    judul: x.hKlas,
                    rumus: <span>{result.mild ? "y₀ > yc → M" : "y₀ < yc → S"}</span>,
                    isi: terjangkau
                      ? `y₀ ${fmt(y0, 3)} ${result.mild ? ">" : "<"} yc ${fmt(yc, 3)};  y ${fmt(yCtl, 2)} → ${x.zona} ${result.profile.slice(1)}`
                      : "—",
                    hasil: terjangkau ? result.profile : "—",
                    tint: C.critical,
                  },
                  {
                    judul: x.hInt,
                    rumus: (<><Frac num="dy" den="dx" /><span>=</span><Frac num="S₀ − Sf" den="1 − Fr²" /></>),
                    isi: x.hIntIsi(fmt(L, 0), fmt(L / 400, 2), result.direction === "hulu" ? x.arahHulu : x.arahHilir),
                    hasil: result.endsAtCritical
                      ? `Lp = ${fmt(panjangProfil, 1)}`
                      : `Δy = ${fmt(tampil(dy), 3)}`,
                    satuan: result.endsAtCritical || terjangkau ? "m" : undefined,
                  },
                ]}
              />
            </div>
          </Block>

          {terjangkau ? (
            <StateCard
              tone={nada}
              badge={result.endsAtCritical ? x.berhenti : `${result.profile} (${result.mild ? x.mild : x.steep})`}
              {...notice(result, panjangProfil, dy, L, lang)}
            />
          ) : (
            <StateCard tone="invalid" badge={x.tak} state={x.takNote} />
          )}
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

/*
 * Kalimat keadaan dan butir yang perlu diperhatikan. Isinya sama dengan
 * catatan lama satu paragraf, dipecah dua. Selisih Δy diukur di ujung jauh
 * profil (lihat ujungJauh), bukan selalu di x = 0.
 */
function notice(
  result: GvfResult,
  panjangProfil: number,
  gap: number,
  L: number,
  lang: Lang
): { state: string; notice: string[] } {
  const profile = result.profile;
  const close = gap < 0.05;
  const lp = fmt(panjangProfil, 1);
  const bentang = fmt(L, 0);
  const saran = fmt(Math.max(20, Math.ceil((panjangProfil * 1.5) / 10) * 10), 0);

  // Profil yang berakhir di kedalaman kritis hampir selalu jauh lebih pendek
  // daripada bentang yang dipilih, dan pembaca perlu diberi tahu supaya tidak
  // menyangka gambarnya gagal.
  if (lang === "en") {
    if (result.endsAtCritical)
      return {
        state: `The ${profile} profile ends after ${lp} m, where the depth reaches critical.`,
        notice: [
          "It cannot continue past that point: crossing critical conditions requires a hydraulic jump, and a jump is not gradually varied flow.",
          `The reach drawn is ${bentang} m, so the rest of the frame is empty on purpose. Shorten the reach length to about ${saran} m to see the profile properly.`,
          "See sheet OC-01 for what happens at the jump itself.",
        ],
      };
    if (profile === "M1")
      return {
        state: "A backwater curve (M1): the weir holds the depth above normal, and the effect reaches upstream until the surface settles back to y₀.",
        notice: [
          `After ${bentang} m the depth is still ${fmt(gap, 3)} m away from normal${close ? ", practically settled." : ", so the reach drawn is not yet long enough to contain the whole influence."}`,
          "This is the curve that decides how far upstream a structure floods land.",
        ],
      };
    if (profile === "M2")
      return {
        state: "A drawdown curve (M2) toward a free overfall: the depth falls from normal toward critical, and the surface steepens as it approaches it.",
        notice: [
          "Lower the control depth toward critical depth and watch the marked reach at the downstream end: there the surface has become too steep to be called gradually varied, and the equation loses its validity.",
        ],
      };
    if (profile === "M3")
      return {
        state: "Supercritical flow on a mild slope (M3), as below a gate: the depth rises toward critical going downstream.",
        notice: [
          "A hydraulic jump will form where it meets the tailwater. Sheet OC-01 covers what happens at that point.",
        ],
      };
    if (profile === "S2")
      return {
        state: "On a steep slope (S2) the flow accelerates from critical toward normal depth going downstream.",
        notice: [
          "The computation runs downstream here, not upstream: supercritical flow is controlled from upstream, so what happens below cannot travel back up.",
        ],
      };
    return {
      state: `The profile is ${profile}.`,
      notice: [
        "Move the control depth across y₀ and yc and watch the profile name change: the letter comes from the slope type, the number from which zone the control depth falls in.",
      ],
    };
  }

  if (result.endsAtCritical)
    return {
      state: `Profil ${profile} berakhir setelah ${lp} m, di tempat kedalamannya mencapai kondisi kritis.`,
      notice: [
        "Profil tidak dapat diteruskan melewati titik itu: melintasi kondisi kritis menuntut loncatan air, dan loncatan bukan aliran berubah lambat.",
        `Bentang yang digambar ${bentang} m, jadi sisa bidangnya memang sengaja kosong. Perpendek panjang bentang menjadi sekitar ${saran} m untuk melihat profilnya dengan jelas.`,
        "Lihat lembar OC-01 untuk apa yang terjadi tepat di loncatannya.",
      ],
    };
  if (profile === "M1")
    return {
      state: "Kurva pembendungan (M1): bendung menahan kedalaman di atas normal, dan pengaruhnya menjalar ke hulu sampai muka air kembali ke y₀.",
      notice: [
        `Setelah ${bentang} m, kedalamannya masih berselisih ${fmt(gap, 3)} m dari normal${close ? ", praktis sudah kembali." : ", jadi bentang yang digambar belum cukup panjang untuk memuat seluruh pengaruhnya."}`,
        "Kurva inilah yang menentukan sejauh mana ke hulu sebuah bangunan menggenangi lahan.",
      ],
    };
  if (profile === "M2")
    return {
      state: "Kurva penurunan (M2) menuju terjunan bebas: kedalaman turun dari normal menuju kritis, dan muka air makin curam saat mendekatinya.",
      notice: [
        "Turunkan kedalaman di penampang kendali sampai mendekati kedalaman kritis, lalu perhatikan ruas bertanda di ujung hilir: di situ muka air sudah terlalu curam untuk disebut berubah lambat, dan persamaannya kehilangan keberlakuan.",
      ],
    };
  if (profile === "M3")
    return {
      state: "Aliran superkritis di atas saluran landai (M3), seperti di hilir pintu: kedalaman naik menuju kritis ke arah hilir.",
      notice: [
        "Loncatan air akan terbentuk di tempat ia bertemu muka air hilir. Lembar OC-01 membahas apa yang terjadi di titik itu.",
      ],
    };
  if (profile === "S2")
    return {
      state: "Pada saluran curam (S2), aliran dipercepat dari kondisi kritis menuju kedalaman normal ke arah hilir.",
      notice: [
        "Penelusuran di sini berjalan ke hilir, bukan ke hulu: aliran superkritis dikendalikan dari hulu, sehingga apa yang terjadi di bawah tidak dapat menjalar naik.",
      ],
    };
  return {
    state: `Profilnya ${profile}.`,
    notice: [
      "Geser kedalaman di penampang kendali melewati y₀ dan yc, lalu perhatikan nama profilnya berubah: hurufnya berasal dari jenis kemiringan, angkanya dari zona tempat kedalaman kendali berada.",
    ],
  };
}
