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
import { fmt, sideChannelProfile, type TroughResult } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksSideChannel } from "@/lib/checks";

const TXT = {
  id: {
    title: "Pelimpah samping",
    sheetTitle: "Saluran pengumpul pelimpah samping — metode beda hingga Hinds",
    dQ: "Debit banjir rancangan",
    db: "Lebar dasar saluran pengumpul",
    dn: "Kekasaran Manning",
    dS: "Kemiringan dasar saluran pengumpul",
    dL: "Panjang mercu pelimpah",
    dz: "Tinggi mercu di atas dasar ujung keluar",
    pKecil: "Bendungan urukan kecil",
    pBesar: "Bendungan besar",
    pSempit: "Saluran terlalu sempit",
    rQ: "Debit di ujung keluar",
    rYc: "Kedalaman kritis di ujung keluar",
    rYmax: "Kedalaman terbesar, di pangkal",
    rRise: "Kenaikan muka air ke arah pangkal",
    rFree: "Jagaan terhadap mercu",
    rDrop: "Penurunan dasar sepanjang saluran",
    rQstar: "Limpasan per satuan panjang mercu",
    tenggelam: "Mercu tenggelam",
    tenggelamNote:
      "Muka air di dalam saluran pengumpul naik sampai melewati elevasi mercu. Bila itu terjadi, pelimpahnya tidak lagi bekerja sebagai ambang bebas: debit yang lewat berkurang, dan seluruh perhitungan kapasitas pelimpah yang mengandaikan aliran bebas menjadi tidak berlaku. Perdalam saluran pengumpul dengan menaikkan mercu, perlebar dasarnya, atau perpanjang mercunya supaya limpasan per satuan panjang berkurang.",
    superkritis: "Ada penampang superkritis",
    superkritisNote:
      "Ada penampang di dalam saluran pengumpul yang menjadi superkritis. Loncatan air di dalam saluran pengumpul mengganggu pola aliran menuju saluran peluncur dan menimbulkan getaran, sehingga rancangan seperti ini biasanya dihindari. Landaikan dasar saluran pengumpul atau perbesar lebarnya.",
    exagg: "pelebihan tegak",
    note:
      "Yang dipakai di sini bentuk beda hingga dari persamaan momentum, bukan bentuk diferensial, dan itu bukan pilihan gaya melainkan keharusan. Kendali saluran pengumpul berada tepat pada kondisi kritis di ujung keluarnya, dan di titik itu bentuk diferensial membagi dengan satu dikurangi kuadrat bilangan Froude yang menuju nol, sehingga penelusuran meledak pada langkah pertama. Bentuk beda hingga tidak pernah membagi dengan suku itu. Bentuk yang dipakai juga sudah dirapikan supaya tidak membagi dengan debit di hulu, sehingga pangkal saluran yang debitnya nol tetap dapat dihitung. Yang membuat saluran pengumpul dalam bukan gesekan melainkan momentum: air yang jatuh dari mercu masuk tegak lurus terhadap arah saluran dan harus dibelokkan serta dipercepat oleh aliran yang sudah ada di bawahnya. Biaya itu diambil dari tinggi tekan, dan hasilnya muka air yang justru naik ke arah pangkal walaupun dasarnya juga naik ke arah itu. Karena kedua permukaan naik bersamaan, kedalaman di pangkal tidak sebesar kenaikan muka airnya, dan itulah yang membuat pembacaan sepintas pada gambar mudah keliru.",
  },
  en: {
    title: "Side-channel spillway",
    sheetTitle: "Side-channel collector trough — Hinds finite-difference method",
    dQ: "Design flood discharge",
    db: "Trough bed width",
    dn: "Manning roughness",
    dS: "Trough bed slope",
    dL: "Spillway crest length",
    dz: "Crest height above the outlet bed",
    pKecil: "Small embankment dam",
    pBesar: "Large dam",
    pSempit: "Trough too narrow",
    rQ: "Discharge at the outlet",
    rYc: "Critical depth at the outlet",
    rYmax: "Greatest depth, at the head",
    rRise: "Rise in water level toward the head",
    rFree: "Freeboard below the crest",
    rDrop: "Bed drop along the trough",
    rQstar: "Overflow per unit length of crest",
    tenggelam: "Crest submerged",
    tenggelamNote:
      "The water surface inside the trough rises past the crest elevation. When that happens the spillway no longer acts as a free weir: the discharge passing drops, and every capacity calculation that assumed free flow stops being valid. Deepen the trough by raising the crest, widen the bed, or lengthen the crest so that the overflow per unit length falls.",
    superkritis: "A supercritical section is present",
    superkritisNote:
      "Some section inside the trough has become supercritical. A hydraulic jump inside the collector disturbs the flow pattern entering the chute and sets up vibration, so such a design is normally avoided. Flatten the trough bed or widen it.",
    exagg: "vertical exaggeration",
    note:
      "What is used here is the finite-difference form of the momentum equation rather than the differential form, and that is not a matter of style but a necessity. The control of a collector trough sits exactly at critical conditions at its outlet, and there the differential form divides by one minus the square of the Froude number, which tends to zero, so the traverse explodes on the first step. The finite-difference form never divides by that term. The form used has also been rearranged so that it does not divide by the upstream discharge, which keeps the head of the trough, where the discharge is zero, computable. What makes a collector trough deep is not friction but momentum: water falling off the crest enters at right angles to the channel and has to be turned and accelerated by the flow already beneath it. That cost is taken from head, and the result is a water surface that rises toward the head even though the bed rises that way too. Because both surfaces rise together, the depth at the head is smaller than the rise in level, and that is what makes a quick reading of the drawing easy to get wrong.",
  },
} as const;

const REFS = {
  id: [
    "Hinds, J. (1926). Side channel spillways. Transactions ASCE, vol. 89.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Bab 12, saluran pengumpul pelimpah samping.",
    "USBR (1987). Design of Small Dams, edisi ke-3, bab pelimpah saluran samping.",
    "Li, W.H. (1955). Open channels with non-uniform discharge. Transactions ASCE, vol. 120.",
  ],
  en: [
    "Hinds, J. (1926). Side channel spillways. Transactions ASCE, vol. 89.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Chapter 12, side-channel spillway troughs.",
    "USBR (1987). Design of Small Dams, 3rd ed., chapter on side-channel spillways.",
    "Li, W.H. (1955). Open channels with non-uniform discharge. Transactions ASCE, vol. 120.",
  ],
} as const;

export function PelimpahSampingClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [Q, setQ] = useState(50);
  const [b, setB] = useState(6);
  const [n, setN] = useState(0.014);
  const [S0, setS0] = useState(0.005);
  const [L, setL] = useState(60);
  const [zCrest, setZCrest] = useState(4.5);

  const r = sideChannelProfile(Q, b, n, S0, L);
  const pangkal = r.points[0];
  const jagaan = zCrest - pangkal.ws;
  const tenggelam = jagaan < 0;

  const ref = useCanvas(
    (ctx, w, h) => drawReach(ctx, w, h, susun(r, L, zCrest, lang)),
    [Q, b, n, S0, L, zCrest, lang]
  );

  const zSpan = Math.max(zCrest, pangkal.ws, 1e-3);
  const exagg = L / zSpan / 1.9;

  return (
    <LabShell
      sheet="HS-10"
      subject={SUBJECTS.HS[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Air melimpah dari mercu di sepanjang sisi saluran, lalu berbelok
            sembilan puluh derajat dan mengalir searah saluran pengumpul. Yang
            membuat saluran itu harus dibuat dalam bukan gesekan, melainkan{" "}
            <Term tint={C.energy}>biaya membelokkan dan mempercepat</Term> air
            yang baru masuk.
          </p>
        ) : (
          <p>
            Water spills off the crest along the side of the channel, turns
            ninety degrees, and runs along the collector trough. What forces
            that trough to be deep is not friction but the{" "}
            <Term tint={C.energy}>cost of turning and accelerating</Term> the
            newly arrived water.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HS-10"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "Q", value: `${fmt(Q, 1)} m³/s`, tint: C.water },
            { label: "yc", value: `${fmt(r.ycOut, 3)} m`, tint: C.critical },
            {
              label: x.rFree,
              value: `${fmt(jagaan, 2)} m`,
              tint: tenggelam ? C.signal : undefined,
            },
            { label: t.tbScale, value: `${x.exagg} ${fmt(exagg, 1)}×` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q} min={2} max={300} step={1} digits={0} unit="m³/s" onChange={setQ} tint={C.water} />
              <InputRow symbol="b" label={x.db} value={b} min={1} max={20} step={0.2} digits={1} unit="m" onChange={setB} />
              <InputRow symbol="n" label={x.dn} value={n} min={0.011} max={0.03} step={0.001} digits={3} onChange={setN} />
              <InputRow symbol="S₀" label={x.dS} value={S0 * 1000} min={0.5} max={40} step={0.5} digits={1} unit="‰" onChange={(v) => setS0(v / 1000)} />
              <InputRow symbol="L" label={x.dL} value={L} min={10} max={200} step={2} digits={0} unit="m" onChange={setL} />
              <InputRow symbol="z_m" label={x.dz} value={zCrest} min={1} max={15} step={0.1} digits={1} unit="m" onChange={setZCrest} tint={C.signal} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pKecil, apply: () => { setQ(20); setB(4); setN(0.014); setS0(0.002); setL(40); setZCrest(3.2); } },
                  { label: x.pBesar, apply: () => { setQ(150); setB(10); setN(0.014); setS0(0.008); setL(120); setZCrest(7); } },
                  { label: x.pSempit, apply: () => { setQ(80); setB(3); setN(0.014); setS0(0.005); setL(50); setZCrest(4.5); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={tenggelam ? undefined : C.water} alert={tenggelam}>
                {tenggelam ? x.tenggelam : `${fmt(jagaan, 2)} m ${x.rFree.toLowerCase()}`}
              </Flag>
              {r.anySupercritical && <Flag alert>{x.superkritis}</Flag>}
            </div>
            {tenggelam && (
              <div className="mb-2.5">
                <Note>{x.tenggelamNote}</Note>
              </div>
            )}
            {r.anySupercritical && (
              <div className="mb-2.5">
                <Note>{x.superkritisNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "y_max", label: x.rYmax, value: fmt(r.yMax, 3), unit: "m", tint: C.water, strong: true },
                { symbol: "Δws", label: x.rRise, value: fmt(r.rise, 3), unit: "m", tint: C.energy, strong: true },
                { symbol: "yc", label: x.rYc, value: fmt(r.ycOut, 3), unit: "m", tint: C.critical },
                { symbol: "Q", label: x.rQ, value: fmt(r.Qout, 1), unit: "m³/s", tint: C.water },
                { symbol: "q*", label: x.rQstar, value: fmt((Q / L) * 1000, 0), unit: "l/s·m" },
                { symbol: "Δz", label: x.rDrop, value: fmt(S0 * L, 3), unit: "m" },
                { symbol: "f", label: x.rFree, value: fmt(jagaan, 3), unit: "m", tint: tenggelam ? C.signal : undefined },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(r, S0, L, jagaan, lang)}</Note>
          </Block>
        </>
      }
      verification={
        <Verification checks={checksSideChannel(Q, b, n, S0, L)} />
      }
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Δy =</span>
                <Frac num="V₁ + V₂" den="g (Q₁ + Q₂)" />
                <span>[ Q₁ (V₂ − V₁) + V₂ (Q₂ − Q₁) ]</span>
              </Eq>
              <Eq>
                <span>ws₁ = ws₂ + Δy + hf</span>
                <span className="ml-5">Q(x) = Q L⁻¹ x</span>
                <span className="ml-5">Fr = 1</span>
                <span className="ml-2 text-ink-3">
                  {lang === "id" ? "di ujung keluar" : "at the outlet"}
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

function susun(r: TroughResult, L: number, zCrest: number, lang: Lang) {
  const T = cl(lang);

  const bed: ReachPoint[] = r.points.map((p) => ({ x: p.x, z: p.zb }));
  const air: ReachPoint[] = r.points.map((p) => ({ x: p.x, z: p.ws }));

  const garis: ReachSeries[] = [
    // Mercu pelimpah: satu elevasi tetap di sepanjang saluran pengumpul.
    // Muka air di dalam saluran tidak boleh menyentuhnya.
    {
      pts: [
        { x: 0, z: zCrest },
        { x: L, z: zCrest },
      ],
      color: C.ink,
      weight: W.thin,
      dash: DASH.phantom,
      label: T.crest,
      labelAt: 0.12,
      labelDy: -9,
    },
    {
      pts: [
        { x: 0, z: r.points[0].zb + r.ycOut },
        { x: L, z: r.ycOut },
      ],
      color: C.critical,
      weight: W.hair,
      dash: DASH.axis,
      label: `yc ${r.ycOut.toFixed(2)} m`,
      labelAt: 0.55,
      labelDy: 11,
    },
  ];

  const pangkal = r.points[0];
  const keluar = r.points[r.points.length - 1];

  const tanda: ReachMarker[] = [
    {
      x: 0,
      label: T.collector,
      color: C.water,
      zBottom: pangkal.zb,
      dim: {
        zTop: pangkal.ws,
        zBottom: pangkal.zb,
        text: `${pangkal.y.toFixed(2)} m`,
        side: 1,
      },
    },
    {
      x: L,
      label: T.control,
      color: C.signal,
      zBottom: 0,
      dim: {
        zTop: keluar.ws,
        zBottom: 0,
        text: `${keluar.y.toFixed(2)} m`,
        side: -1,
      },
    },
  ];

  const wilayah: ReachRegion[] = [
    {
      x: L * 0.5,
      z: Math.max(zCrest, pangkal.ws) * 1.05,
      text: T.lateralInflow,
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

function notice(
  r: TroughResult,
  S0: number,
  L: number,
  jagaan: number,
  lang: Lang
): string {
  const turunDasar = S0 * L;

  if (lang === "en")
    return `The water surface rises ${r.rise.toFixed(3)} m toward the head of the trough while the bed rises ${turunDasar.toFixed(3)} m over the same length, so the depth at the head works out at ${r.yMax.toFixed(3)} m against ${r.ycOut.toFixed(3)} m at the outlet. ${jagaan < 0 ? "The surface has already passed the crest, which invalidates the free-weir assumption behind the discharge." : `That leaves ${jagaan.toFixed(2)} m of freeboard below the crest.`} Raise the trough slope and watch two things move in opposite directions: the bed drops away faster, but the outlet sits lower, so the freeboard at the head does not improve as much as the slope alone would suggest.`;
  return `Muka air naik ${r.rise.toFixed(3)} m ke arah pangkal saluran pengumpul, sementara dasarnya naik ${turunDasar.toFixed(3)} m sepanjang jarak yang sama, sehingga kedalaman di pangkal menjadi ${r.yMax.toFixed(3)} m berbanding ${r.ycOut.toFixed(3)} m di ujung keluar. ${jagaan < 0 ? "Muka airnya sudah melewati mercu, dan itu membatalkan andaian ambang bebas yang menjadi dasar perhitungan debitnya." : `Sisanya ${jagaan.toFixed(2)} m sebagai jagaan di bawah mercu.`} Curamkan dasar saluran pengumpul, lalu perhatikan dua hal bergerak berlawanan arah: dasarnya menurun lebih cepat, tetapi ujung keluarnya juga duduk lebih rendah, sehingga jagaan di pangkal tidak membaik sebanyak yang dijanjikan kemiringannya sendiri.`;
}
