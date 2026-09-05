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
  svfProfile,
  type SvfResult,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksSvf } from "@/lib/checks";

const TXT = {
  id: {
    title: "Aliran masuk lateral",
    sheetTitle: "Debit bertambah sepanjang saluran — saluran persegi prismatis",
    dQ0: "Debit masuk di ujung hulu",
    dq: "Aliran masuk per satuan panjang",
    db: "Lebar dasar",
    dn: "Kekasaran Manning",
    dS: "Kemiringan dasar",
    dL: "Panjang bentang",
    dy: "Kedalaman di ujung hilir",
    pDrainase: "Saluran drainase jalan",
    pIrigasi: "Saluran pembuang sawah",
    pTanpa: "Tanpa aliran masuk",
    rQend: "Debit di ujung hilir",
    rQ0: "Debit di ujung hulu",
    rYup: "Kedalaman di ujung hulu",
    rYdn: "Kedalaman di ujung hilir",
    rFrMax: "Bilangan Froude terbesar",
    rBeda: "Selisih terhadap tanpa aliran masuk",
    rYc: "Kedalaman kritis di ujung hilir",
    lintas: "Melewati kondisi kritis",
    hilirSuper: "Kendali tidak di ujung hilir",
    hilirSuperNote:
      "Aliran di ujung hilir ternyata superkritis, dan penelusuran ini mengandaikan kendalinya berada di sana. Pada aliran superkritis kendali pindah ke hulu, sehingga muka air yang tergambar tidak berlaku dan tidak boleh dibaca sebagai hasil. Naikkan kedalaman di ujung hilir sampai di atas kedalaman kritis, perlebar dasar, atau kurangi aliran masuknya.",
    lintasNote:
      "Profilnya melintasi kondisi kritis di tengah bentang. Di titik itu penyebut persamaan menuju nol dan kemiringan muka air menjadi tegak, sehingga hasil di sekitarnya digambar titik rapat dan tidak boleh dibaca sebagai angka. Keadaan nyata di situ adalah loncatan air atau penampang kendali, yang penanganannya berbeda. Perkecil aliran masuk, perbesar lebar dasar, atau naikkan kedalaman di ujung hilir.",
    exagg: "pelebihan tegak",
    note:
      "Persamaannya sama dengan aliran berubah lambat kecuali satu suku tambahan di pembilang, dan suku itulah seluruh isi lembar ini. Air yang masuk dari samping datang tanpa membawa momentum searah saluran, sehingga ia harus dipercepat oleh aliran yang sudah ada, dan biaya percepatan itu diambil dari tinggi tekan. Akibatnya muka air selalu lebih tinggi daripada seandainya debit yang sama mengalir tanpa penambahan di sepanjang jalan. Garis putus panjang pada gambar memperlihatkan perbandingannya: itulah profil yang akan terbentuk bila seluruh debit sudah masuk sejak ujung hulu. Selisih di antara keduanya bukan pengaruh gesekan dan bukan pula pengaruh bertambahnya debit semata, melainkan biaya mempercepat air yang baru masuk. Dalam perancangan saluran drainase tepi jalan dan saluran pembuang, selisih itulah yang menentukan tinggi jagaan, dan mengabaikannya membuat saluran tampak cukup di atas kertas tetapi melimpah di lapangan.",
  },
  en: {
    title: "Lateral inflow",
    sheetTitle: "Discharge increasing along the channel — prismatic rectangular channel",
    dQ0: "Inflow at the upstream end",
    dq: "Inflow per unit length",
    db: "Bed width",
    dn: "Manning roughness",
    dS: "Bed slope",
    dL: "Reach length",
    dy: "Depth at the downstream end",
    pDrainase: "Road drainage channel",
    pIrigasi: "Field drainage channel",
    pTanpa: "No lateral inflow",
    rQend: "Discharge at the downstream end",
    rQ0: "Discharge at the upstream end",
    rYup: "Depth at the upstream end",
    rYdn: "Depth at the downstream end",
    rFrMax: "Largest Froude number",
    rBeda: "Difference against no lateral inflow",
    rYc: "Critical depth at the downstream end",
    lintas: "Crosses critical conditions",
    hilirSuper: "Control is not at the downstream end",
    hilirSuperNote:
      "The flow at the downstream end turns out to be supercritical, and this traverse assumes the control sits there. In supercritical flow the control moves upstream, so the water surface drawn does not apply and must not be read as a result. Raise the depth at the downstream end above critical depth, widen the bed, or reduce the inflow.",
    lintasNote:
      "The profile crosses critical conditions in mid reach. There the denominator of the equation tends to zero and the surface slope becomes vertical, so results around that point are drawn with fine dots and must not be read as numbers. What really happens there is a hydraulic jump or a control section, which is handled differently. Reduce the inflow, widen the bed, or raise the depth at the downstream end.",
    exagg: "vertical exaggeration",
    note:
      "The equation is the same as for gradually varied flow except for one extra term in the numerator, and that term is the whole content of this sheet. Water entering from the side arrives with no momentum along the channel, so it has to be accelerated by the flow already there, and the cost of that acceleration is taken from head. The water surface therefore always sits higher than it would if the same discharge flowed without being added along the way. The long dashed line on the drawing shows the comparison: that is the profile that would form if the whole discharge had entered at the upstream end. The gap between them is neither friction nor the mere growth of discharge, but the cost of accelerating the newly arrived water. In designing roadside drains and field drainage channels, that gap is what sets the freeboard, and ignoring it makes a channel look adequate on paper while it overtops in the field.",
  },
} as const;

const REFS = {
  id: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Bab 12, aliran berubah beraturan dengan debit bertambah.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Bab 7.",
    "Yen, B.C. & Wenzel, H.G. (1970). Dynamic equations for steady spatially varied flow. Journal of the Hydraulics Division, ASCE.",
    "US Federal Highway Administration (2013). Urban Drainage Design Manual, HEC-22, edisi ke-3.",
  ],
  en: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Chapter 12, spatially varied flow with increasing discharge.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Chapter 7.",
    "Yen, B.C. & Wenzel, H.G. (1970). Dynamic equations for steady spatially varied flow. Journal of the Hydraulics Division, ASCE.",
    "US Federal Highway Administration (2013). Urban Drainage Design Manual, HEC-22, 3rd ed.",
  ],
} as const;

export function AliranMasukLateralClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [Q0, setQ0] = useState(4);
  const [qLit, setQLit] = useState(20);
  const [b, setB] = useState(5);
  const [n, setN] = useState(0.025);
  const [S0, setS0] = useState(0.0012);
  const [L, setL] = useState(500);
  const [yEnd, setYEnd] = useState(2.2);

  const qStar = qLit / 1000;
  const r = svfProfile(Q0, qStar, b, n, S0, L, yEnd);
  const tanpa = svfProfile(Q0 + qStar * L, 0, b, n, S0, L, yEnd);
  const ycEnd = criticalDepth(r.Qend / b);

  const ref = useCanvas(
    (ctx, w, h) => drawReach(ctx, w, h, susun(r, tanpa, ycEnd, L, S0, lang)),
    [Q0, qLit, b, n, S0, L, yEnd, lang]
  );

  const zSpan = Math.max(S0 * L + r.yMax, 1e-3);
  const exagg = L / zSpan / 1.9;
  const frMax = r.points.reduce((m, p) => Math.max(m, p.Fr), 0);
  const beda = r.points[0].y - tanpa.points[0].y;

  return (
    <LabShell
      sheet="OC-12"
      subject={SUBJECTS.OC[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Air masuk di sepanjang saluran, bukan hanya di ujungnya. Debitnya
            bertambah setiap meter, dan{" "}
            <Term tint={C.water}>muka airnya</Term> naik lebih tinggi daripada
            yang diperkirakan dari debit akhir saja, karena air yang baru masuk
            harus ikut dipercepat.
          </p>
        ) : (
          <p>
            Water enters along the channel, not only at its end. The discharge
            grows every metre, and the{" "}
            <Term tint={C.water}>water surface</Term> sits higher than the final
            discharge alone would suggest, because the newly arrived water has
            to be accelerated too.
          </p>
        )
      }
      drawing={
        <Sheet
          number="OC-12"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "Q₀", value: `${fmt(Q0, 1)} m³/s`, tint: C.water },
            { label: "Q_L", value: `${fmt(r.Qend, 1)} m³/s`, tint: C.water },
            { label: "q*", value: `${fmt(qLit, 0)} l/s·m` },
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
              <InputRow symbol="Q₀" label={x.dQ0} value={Q0} min={0} max={40} step={0.5} digits={1} unit="m³/s" onChange={setQ0} tint={C.water} />
              <InputRow symbol="q*" label={x.dq} value={qLit} min={0} max={120} step={1} digits={0} unit="l/s·m" onChange={setQLit} tint={C.water} />
              <InputRow symbol="b" label={x.db} value={b} min={0.5} max={20} step={0.1} digits={1} unit="m" onChange={setB} />
              <InputRow symbol="n" label={x.dn} value={n} min={0.01} max={0.07} step={0.001} digits={3} onChange={setN} />
              <InputRow symbol="S₀" label={x.dS} value={S0 * 1000} min={0.1} max={20} step={0.1} digits={1} unit="‰" onChange={(v) => setS0(v / 1000)} />
              <InputRow symbol="L" label={x.dL} value={L} min={50} max={1500} step={10} digits={0} unit="m" onChange={setL} />
              <InputRow symbol="y_L" label={x.dy} value={yEnd} min={0.2} max={6} step={0.05} unit="m" onChange={setYEnd} tint={C.signal} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pDrainase, apply: () => { setQ0(0); setQLit(4); setB(0.8); setN(0.014); setS0(0.004); setL(300); setYEnd(0.9); } },
                  { label: x.pIrigasi, apply: () => { setQ0(4); setQLit(20); setB(5); setN(0.025); setS0(0.0012); setL(500); setYEnd(2.2); } },
                  { label: x.pTanpa, apply: () => { setQ0(14); setQLit(0); setB(5); setN(0.025); setS0(0.0012); setL(500); setYEnd(2.2); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={C.water}>{`${fmt(Q0, 1)} → ${fmt(r.Qend, 1)} m³/s`}</Flag>
              {r.outletSupercritical && <Flag alert>{x.hilirSuper}</Flag>}
              {r.crossesCritical && !r.outletSupercritical && (
                <Flag alert>{x.lintas}</Flag>
              )}
            </div>
            {r.outletSupercritical && (
              <div className="mb-2.5">
                <Note>{x.hilirSuperNote}</Note>
              </div>
            )}
            {r.crossesCritical && !r.outletSupercritical && (
              <div className="mb-2.5">
                <Note>{x.lintasNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "Q₀", label: x.rQ0, value: fmt(Q0, 2), unit: "m³/s", tint: C.water },
                { symbol: "Q_L", label: x.rQend, value: fmt(r.Qend, 2), unit: "m³/s", tint: C.water, strong: true },
                { symbol: "y₀", label: x.rYup, value: fmt(r.points[0].y, 3), unit: "m", strong: true },
                { symbol: "y_L", label: x.rYdn, value: fmt(yEnd, 3), unit: "m" },
                { symbol: "Δy", label: x.rBeda, value: fmt(beda, 3), unit: "m", tint: C.signal },
                { symbol: "Fr", label: x.rFrMax, value: fmt(frMax, 3), tint: frMax > 1 ? C.signal : undefined },
                { symbol: "yc", label: x.rYc, value: fmt(ycEnd, 3), unit: "m", tint: C.critical },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(beda, qStar, L, r, lang)}</Note>
          </Block>
        </>
      }
      verification={
        <Verification checks={checksSvf(Q0, qStar, b, n, S0, L, yEnd)} />
      }
      below={
        <Basis
          equations={
            <>
              <Eq>
                <Frac num="dy" den="dx" />
                <span>=</span>
                <Frac num="S₀ − Sf − 2 Q q* / (g A²)" den="1 − Fr²" />
              </Eq>
              <Eq>
                <span>Q(x) = Q₀ + q* x</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "suku ketiga di pembilang hilang bila q* nol"
                    : "the third term in the numerator vanishes when q* is zero"}
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

function susun(
  r: SvfResult,
  tanpa: SvfResult,
  ycEnd: number,
  L: number,
  S0: number,
  lang: Lang
) {
  const T = cl(lang);
  const zb = (x: number) => (L - x) * S0;

  const bed: ReachPoint[] = [
    { x: 0, z: zb(0) },
    { x: L, z: 0 },
  ];

  const air: ReachPoint[] = r.points.map((p) => ({
    x: p.x,
    z: zb(p.x) + p.y,
    invalid: p.nearCritical,
  }));

  const garis: ReachSeries[] = [
    {
      pts: tanpa.points.map((p) => ({ x: p.x, z: zb(p.x) + p.y })),
      color: C.water,
      weight: W.hair,
      dash: DASH.phantom,
      label: T.noInflow,
      labelAt: 0.3,
      labelDy: 12,
    },
    {
      pts: [
        { x: 0, z: zb(0) + ycEnd },
        { x: L, z: ycEnd },
      ],
      color: C.critical,
      weight: W.hair,
      dash: DASH.axis,
      label: `yc ${ycEnd.toFixed(2)} m`,
      labelAt: 0.62,
      labelDy: 11,
    },
  ];

  const tanda: ReachMarker[] = [
    {
      x: L,
      label: T.control,
      color: C.signal,
      zBottom: 0,
      dim: {
        zTop: r.points[r.points.length - 1].y,
        zBottom: 0,
        text: `${r.points[r.points.length - 1].y.toFixed(2)} m`,
        side: -1,
      },
    },
    {
      x: 0,
      label: T.upstream,
      color: C.water,
      zBottom: zb(0),
      dim: {
        zTop: zb(0) + r.points[0].y,
        zBottom: zb(0),
        text: `${r.points[0].y.toFixed(2)} m`,
        side: 1,
      },
    },
  ];

  const wilayah: ReachRegion[] = [
    {
      x: L * 0.5,
      z: zb(L * 0.5) + r.yMax * 1.55,
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
  beda: number,
  qStar: number,
  L: number,
  r: SvfResult,
  lang: Lang
): string {
  if (qStar <= 0) {
    return lang === "id"
      ? "Aliran masuk lateral dimatikan, jadi suku tambahannya hilang dan yang tersisa adalah persamaan aliran berubah lambat biasa. Profil menerus dan garis putus panjang berimpit, dan memang harus berimpit: itu pemeriksaan paling murah yang tersedia untuk model ini, dan blok verifikasi di bawah melakukannya dengan angka."
      : "The lateral inflow is switched off, so the extra term vanishes and what remains is the ordinary gradually varied flow equation. The solid profile and the long dashed line coincide, and they must: that is the cheapest check available for this model, and the verification block below performs it numerically.";
  }

  const persen = r.points[0].y > 0 ? (beda / r.points[0].y) * 100 : 0;

  if (lang === "en")
    return `Over ${L} m the channel picks up ${(qStar * L).toFixed(2)} m³/s along its length. At the upstream end the surface stands ${beda.toFixed(3)} m higher than it would if that same discharge had arrived all at once at the head, which is ${persen.toFixed(1)} per cent of the depth there. That difference is the price of accelerating water that entered sideways, and it is the part most often left out of a hand calculation.`;
  return `Sepanjang ${L} m, saluran ini memungut ${(qStar * L).toFixed(2)} m³/s di sepanjang jalannya. Di ujung hulu, muka airnya berdiri ${beda.toFixed(3)} m lebih tinggi daripada seandainya debit yang sama sudah masuk seluruhnya sejak pangkal, yaitu ${persen.toFixed(1)} persen dari kedalaman di situ. Selisih itu adalah harga mempercepat air yang masuk dari samping, dan justru bagian itulah yang paling sering tertinggal dalam hitungan tangan.`;
}
