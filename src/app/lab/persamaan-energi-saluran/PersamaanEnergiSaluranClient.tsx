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
  reachEnergy,
  type ReachEnergyResult,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksReachEnergy } from "@/lib/checks";

const TXT = {
  id: {
    title: "Persamaan energi saluran terbuka",
    sheetTitle: "Garis energi dan garis muka air — saluran persegi prismatis",
    dQ: "Debit",
    db: "Lebar dasar",
    dn: "Kekasaran Manning",
    dS: "Kemiringan dasar",
    dy: "Kedalaman di penampang kendali",
    dL: "Panjang bentang",
    pSeragam: "Aliran seragam",
    pBendung: "Bendung di hilir",
    pTerjun: "Terjunan di hilir",
    rY0: "Kedalaman normal",
    rYc: "Kedalaman kritis",
    rHf: "Kehilangan gesekan sepanjang bentang",
    rDz: "Penurunan dasar sepanjang bentang",
    rDE: "Penurunan tinggi energi total",
    rVh: "Tinggi kecepatan di tengah bentang",
    rSf: "Kemiringan gesek rata-rata",
    tak: "Melampaui kapasitas saluran",
    takNote:
      "Pada lebar dan kemiringan ini, saluran tidak sanggup mengalirkan debit sebesar itu berapa pun dalamnya. Kedalaman normal yang tampil hanyalah batas atas pencarian, bukan hasil yang berlaku.",
    exagg: "pelebihan tegak",
    seragam: "Aliran seragam",
    note:
      "Tiga garis pada gambar ini adalah tiga suku persamaan energi, dan jarak tegak di antaranya adalah besaran yang dicari. Dasar saluran memberi tinggi tempat, kedalaman air di atasnya memberi tinggi tekan, dan tinggi kecepatan menumpang di atas keduanya. Karena ketiganya diturunkan dari satu profil yang sama, ketiganya tidak mungkin saling bertentangan di layar. Yang perlu diperhatikan, garis energi selalu menurun ke arah hilir sedangkan muka air tidak selalu demikian: pada kurva pembendungan muka air justru naik ke arah hilir sementara garis energinya tetap turun. Itu bukan pengecualian melainkan bukti bahwa yang selalu berkurang adalah energi, bukan ketinggian air. Kehilangan gesekan pada tabel di samping dijumlahkan dengan menjumlahkan kemiringan gesek sepanjang bentang, bukan diambil dari selisih kedua ujung garis energi. Keduanya harus menghasilkan angka yang sama, dan blok verifikasi di bawah membandingkannya secara langsung.",
  },
  en: {
    title: "Open-channel energy equation",
    sheetTitle: "Energy and water surface lines — prismatic rectangular channel",
    dQ: "Discharge",
    db: "Bed width",
    dn: "Manning roughness",
    dS: "Bed slope",
    dy: "Depth at the control section",
    dL: "Reach length",
    pSeragam: "Uniform flow",
    pBendung: "Weir downstream",
    pTerjun: "Free overfall downstream",
    rY0: "Normal depth",
    rYc: "Critical depth",
    rHf: "Friction loss over the reach",
    rDz: "Bed drop over the reach",
    rDE: "Drop in total energy",
    rVh: "Velocity head at mid reach",
    rSf: "Mean friction slope",
    tak: "Exceeds channel capacity",
    takNote:
      "At this width and slope the channel cannot carry that discharge at any depth. The normal depth shown is only the upper bound of the search, not a valid result.",
    exagg: "vertical exaggeration",
    seragam: "Uniform flow",
    note:
      "The three lines on this drawing are the three terms of the energy equation, and the vertical gaps between them are the quantities being sought. The bed gives elevation head, the depth of water above it gives pressure head, and the velocity head rides on top of both. Because all three are derived from a single profile, they cannot contradict one another on screen. Note that the energy line always falls downstream while the water surface does not: on a backwater curve the surface rises downstream while the energy line still falls. That is not an exception but proof that what always decreases is energy, not water level. The friction loss in the table beside the drawing is summed from the friction slope along the reach rather than read off the difference between the two ends of the energy line. The two must produce the same number, and the verification block below compares them directly.",
  },
} as const;

const REFS = {
  id: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Bab 3 dan Bab 9.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Bab 2.",
    "USGS (1988). Basic Hydraulic Principles of Open-Channel Flow, Open-File Report 88-707.",
    "USACE (2016). HEC-RAS Hydraulic Reference Manual, bab tentang persamaan energi antara dua penampang.",
  ],
  en: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Chapters 3 and 9.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Chapter 2.",
    "USGS (1988). Basic Hydraulic Principles of Open-Channel Flow, Open-File Report 88-707.",
    "USACE (2016). HEC-RAS Hydraulic Reference Manual, chapter on the energy equation between two sections.",
  ],
} as const;

export function PersamaanEnergiSaluranClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [Q, setQ] = useState(12);
  const [b, setB] = useState(5);
  const [n, setN] = useState(0.025);
  const [S0, setS0] = useState(0.0015);
  const [yCtl, setYCtl] = useState(2.8);
  const [L, setL] = useState(1500);

  const yc = criticalDepth(Q / b);
  const terjangkau = normalDepthReachable(Q, b, n, S0);
  const r = reachEnergy(Q, b, n, S0, yCtl, L);
  const tengah = r.points[Math.floor(r.points.length / 2)];

  const ref = useCanvas(
    (ctx, w, h) => drawReach(ctx, w, h, susun(r, L, S0, lang)),
    [Q, b, n, S0, yCtl, L, lang]
  );

  const zSpan = Math.max(S0 * L + r.points[0].y + r.points[0].vHead, 1e-3);
  const exagg = L / zSpan / 1.9;
  const seragam = Math.abs(yCtl - r.y0) < 0.01;

  return (
    <LabShell
      sheet="OC-09"
      subject={SUBJECTS.OC[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Tiga garis berjalan berdampingan di sepanjang saluran: dasar,{" "}
            <Term tint={C.water}>muka air</Term>, dan{" "}
            <Term tint={C.energy}>garis energi</Term>. Jarak tegak di antara
            ketiganya adalah seluruh isi persamaan energi, dan satu-satunya yang
            pasti menurun ke arah hilir adalah yang paling atas.
          </p>
        ) : (
          <p>
            Three lines run side by side along the channel: the bed, the{" "}
            <Term tint={C.water}>water surface</Term>, and the{" "}
            <Term tint={C.energy}>energy line</Term>. The vertical gaps between
            them are the whole content of the energy equation, and the only one
            certain to fall downstream is the topmost.
          </p>
        )
      }
      drawing={
        <Sheet
          number="OC-09"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "Q", value: `${fmt(Q, 1)} m³/s`, tint: C.water },
            { label: "hf", value: `${fmt(r.hf, 3)} m`, tint: C.energy },
            { label: "Δz", value: `${fmt(r.dz, 3)} m` },
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
              <InputRow symbol="S₀" label={x.dS} value={S0 * 1000} min={0.1} max={20} step={0.05} digits={2} unit="‰" onChange={(v) => setS0(v / 1000)} />
              <InputRow symbol="y" label={x.dy} value={yCtl} min={0.15} max={6} step={0.05} unit="m" onChange={setYCtl} tint={C.signal} />
              <InputRow symbol="L" label={x.dL} value={L} min={100} max={4000} step={50} digits={0} unit="m" onChange={setL} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pSeragam, apply: () => { setQ(12); setB(5); setN(0.025); setS0(0.0015); setYCtl(1.58); setL(1500); } },
                  { label: x.pBendung, apply: () => { setQ(12); setB(5); setN(0.025); setS0(0.0015); setYCtl(3.2); setL(2500); } },
                  { label: x.pTerjun, apply: () => { setQ(12); setB(5); setN(0.025); setS0(0.0015); setYCtl(0.9); setL(700); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={C.critical}>{r.profile}</Flag>
              {seragam && (
                <span className="value label text-[0.78rem] text-ink-3">
                  {x.seragam}
                </span>
              )}
              {!terjangkau && <Flag alert>{x.tak}</Flag>}
            </div>
            {!terjangkau && (
              <div className="mb-2.5">
                <Note>{x.takNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "hf", label: x.rHf, value: fmt(r.hf, 4), unit: "m", tint: C.energy, strong: true },
                { symbol: "Δz", label: x.rDz, value: fmt(r.dz, 4), unit: "m" },
                { symbol: "ΔH", label: x.rDE, value: fmt(r.dE, 4), unit: "m", tint: C.energy },
                { symbol: "y₀", label: x.rY0, value: fmt(r.y0, 3), unit: "m", tint: C.water },
                { symbol: "yc", label: x.rYc, value: fmt(yc, 3), unit: "m", tint: C.critical },
                { symbol: "hv", label: x.rVh, value: fmt(tengah.vHead, 4), unit: "m", tint: C.energy },
                { symbol: "S̄f", label: x.rSf, value: fmt((r.hf / L) * 1000, 3), unit: "‰" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(r, L, lang)}</Note>
          </Block>
        </>
      }
      verification={
        <Verification checks={checksReachEnergy(Q, b, n, S0, yCtl, L)} />
      }
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>z₁ + y₁ +</span>
                <Frac num="V₁²" den="2g" />
                <span>= z₂ + y₂ +</span>
                <Frac num="V₂²" den="2g" />
                <span>+ hf</span>
              </Eq>
              <Eq>
                <span>hf = ∫ Sf dx</span>
                <span className="ml-5">Sf =</span>
                <Frac num="n² V²" den="R^(4/3)" />
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

function susun(r: ReachEnergyResult, L: number, S0: number, lang: Lang) {
  const T = cl(lang);

  const bed: ReachPoint[] = [
    { x: 0, z: S0 * L },
    { x: L, z: 0 },
  ];

  const air: ReachPoint[] = r.points.map((p) => ({
    x: p.x,
    z: p.wsl,
    invalid: p.nearCritical,
  }));

  const garis: ReachSeries[] = [
    {
      pts: r.points.map((p) => ({ x: p.x, z: p.egl })),
      color: C.energy,
      weight: W.thin,
      dash: DASH.hidden,
      label: T.energyGrade,
      labelAt: 0.24,
      labelDy: -9,
    },
    {
      pts: [
        { x: 0, z: S0 * L + r.y0 },
        { x: L, z: r.y0 },
      ],
      color: C.water,
      weight: W.hair,
      dash: DASH.phantom,
      label: `y₀ ${r.y0.toFixed(2)} m`,
      labelAt: 0.02,
      labelDy: 11,
    },
    {
      pts: [
        { x: 0, z: S0 * L + r.yc },
        { x: L, z: r.yc },
      ],
      color: C.critical,
      weight: W.hair,
      dash: DASH.axis,
      label: `yc ${r.yc.toFixed(2)} m`,
      labelAt: 0.72,
      labelDy: 11,
    },
  ];

  // Satu penampang dibedah untuk memperlihatkan susunan ketiga sukunya.
  const p = r.points[Math.floor(r.points.length * 0.62)];
  const tanda: ReachMarker[] = [
    {
      x: p.x,
      label: T.velocityHead,
      color: C.energy,
      zBottom: p.zb,
      dim: {
        zTop: p.egl,
        zBottom: p.wsl,
        text: `${p.vHead.toFixed(3)} m`,
        side: 1,
      },
    },
    {
      x: r.points[Math.floor(r.points.length * 0.24)].x,
      label: T.axDepth,
      color: C.water,
      zBottom: r.points[Math.floor(r.points.length * 0.24)].zb,
      dim: {
        zTop: r.points[Math.floor(r.points.length * 0.24)].wsl,
        zBottom: r.points[Math.floor(r.points.length * 0.24)].zb,
        text: `${r.points[Math.floor(r.points.length * 0.24)].y.toFixed(2)} m`,
        side: -1,
      },
    },
  ];

  const wilayah: ReachRegion[] = [
    {
      x: L * 0.5,
      z: Math.max(r.points[0].egl, r.points[r.points.length - 1].egl) * 1.06,
      text: r.profile,
      color: C.ink,
      big: true,
    },
    {
      x: L * 0.5,
      z: Math.max(r.points[0].egl, r.points[r.points.length - 1].egl) * 1.02,
      text: r.mild ? T.subcritical : T.supercritical,
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

function notice(r: ReachEnergyResult, L: number, lang: Lang): string {
  const naik = r.points[r.points.length - 1].wsl > r.points[0].wsl;
  const bagian = r.dz > 1e-9 ? (r.hf / r.dz) * 100 : 0;

  if (lang === "en") {
    if (naik)
      return `Read the two upper lines against each other. The water surface rises downstream, yet the energy line still falls: over ${L} m it drops ${r.dE.toFixed(3)} m while the bed drops ${r.dz.toFixed(3)} m. Water can be pushed uphill by a structure; energy cannot. That is the whole reason the energy line, and not the water surface, is what a backwater computation actually marches along.`;
    return `Friction spends ${r.hf.toFixed(3)} m over this reach, which is ${bagian.toFixed(0)} per cent of the ${r.dz.toFixed(3)} m the bed gives up. When those two numbers are equal the flow is uniform, the depth stops changing, and the energy line runs exactly parallel to the bed. Move the control depth to the normal depth and watch all three lines settle into parallel.`;
  }

  if (naik)
    return `Bacalah dua garis teratas terhadap satu sama lain. Muka air naik ke arah hilir, tetapi garis energinya tetap turun: sepanjang ${L} m ia turun ${r.dE.toFixed(3)} m sementara dasarnya turun ${r.dz.toFixed(3)} m. Air dapat didorong naik oleh sebuah bangunan, energi tidak bisa. Itulah alasan sesungguhnya mengapa yang ditelusuri dalam hitungan pembendungan adalah garis energi, bukan muka airnya.`;
  return `Gesekan menghabiskan ${r.hf.toFixed(3)} m di sepanjang bentang ini, yaitu ${bagian.toFixed(0)} persen dari ${r.dz.toFixed(3)} m yang diserahkan oleh dasar saluran. Saat kedua angka itu sama besar, alirannya seragam, kedalamannya berhenti berubah, dan garis energi berjalan persis sejajar dasar. Geser kedalaman kendali ke kedalaman normal, lalu perhatikan ketiga garisnya menjadi sejajar.`;
}
