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
  FLUME_HL_MAX,
  FLUME_HL_MIN,
  flumeDischarge,
  fmt,
  type FlumeResult,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksFlume } from "@/lib/checks";

const TXT = {
  id: {
    title: "Flum berleher panjang",
    sheetTitle: "Flum berleher panjang persegi — potongan memanjang",
    dh: "Tinggi muka air di atas mercu leher",
    dbt: "Lebar leher",
    dbA: "Lebar saluran datang",
    dp: "Tinggi mercu leher di atas dasar",
    dL: "Panjang leher searah aliran",
    dCd: "Koefisien debit",
    dTail: "Muka air hilir di atas dasar",
    pKecil: "Saluran irigasi tersier",
    pSedang: "Saluran pembuang",
    pBesar: "Sungai kecil",
    rQ: "Debit",
    rH1: "Tinggi energi di penampang ukur",
    rYc: "Kedalaman kritis di leher",
    rCv: "Koefisien kecepatan datang",
    rHL: "Perbandingan tinggi energi terhadap panjang leher",
    rV: "Kecepatan di leher",
    rTail: "Batas muka air hilir agar tetap bebas",
    luar: "Di luar rentang keberlakuan",
    luarKecil:
      "Tinggi energi terlalu kecil dibanding panjang leher. Gesekan di sepanjang leher menjadi terlalu besar untuk diabaikan, dan koefisien debitnya tidak lagi mendekati satu. Perpendek lehernya atau ukur pada debit yang lebih besar.",
    luarBesar:
      "Tinggi energi terlalu besar dibanding panjang leher. Garis arus di dalam leher belum sempat menjadi sejajar, sehingga andaian aliran kritis dengan tekanan hidrostatik tidak berlaku, dan alat ini kembali menjadi ambang lebar biasa yang harus dikalibrasi. Perpanjang lehernya.",
    tenggelam: "Flum tenggelam",
    tenggelamNote:
      "Muka air hilir sudah naik melewati batas kerja bebas. Begitu itu terjadi, kondisi kritis di leher hilang, dan tinggi muka air di hulu tidak lagi menentukan debit sendirian. Rendahkan muka air hilir, atau naikkan mercu lehernya.",
    exagg: "pelebihan tegak",
    note:
      "Kekuatan alat ini bukan pada ketelitian koefisiennya melainkan pada asal-usulnya. Lehernya sengaja dibuat cukup panjang sehingga garis arus di dalamnya menjadi sejajar dan tekanannya kembali hidrostatik. Begitu syarat itu terpenuhi, aliran melewati kondisi kritis di dalam leher, dan pada kondisi kritis kedalaman persis dua per tiga tinggi energi. Dari dua kenyataan itu saja debitnya sudah dapat diturunkan, tanpa satu pun angka hasil pengujian. Tetapan 1,7049 pada rumusnya bukan koefisien empiris melainkan dua per tiga pangkat satu setengah dikali akar percepatan gravitasi. Konsekuensinya besar dalam praktik: flum berleher panjang dapat dirancang di atas kertas untuk bentuk penampang apa pun, lalu dibangun dan langsung dipakai. Alat ukur yang koefisiennya empiris tidak punya kemewahan itu. Yang tetap harus dijaga hanya dua hal, dan keduanya ditandai pada lembar ini: perbandingan tinggi energi terhadap panjang leher harus berada di dalam rentangnya, dan muka air hilir tidak boleh naik sampai menenggelamkan kondisi kritis di leher.",
  },
  en: {
    title: "Long-throated flume",
    sheetTitle: "Rectangular long-throated flume — longitudinal section",
    dh: "Head above the throat crest",
    dbt: "Throat width",
    dbA: "Approach channel width",
    dp: "Crest height above the bed",
    dL: "Throat length along the flow",
    dCd: "Discharge coefficient",
    dTail: "Tailwater above the bed",
    pKecil: "Tertiary irrigation canal",
    pSedang: "Drainage channel",
    pBesar: "Small river",
    rQ: "Discharge",
    rH1: "Total head at the gauging section",
    rYc: "Critical depth in the throat",
    rCv: "Velocity of approach coefficient",
    rHL: "Ratio of head to throat length",
    rV: "Velocity in the throat",
    rTail: "Tailwater limit for free flow",
    luar: "Outside the valid range",
    luarKecil:
      "The head is too small against the throat length. Friction along the throat becomes too large to ignore, and the discharge coefficient no longer sits close to one. Shorten the throat or gauge at a larger discharge.",
    luarBesar:
      "The head is too large against the throat length. The streamlines inside the throat have not had room to become parallel, so the assumption of critical flow with hydrostatic pressure fails, and the device reverts to an ordinary broad-crested weir that must be calibrated. Lengthen the throat.",
    tenggelam: "Flume submerged",
    tenggelamNote:
      "The tailwater has risen past the limit for free flow. Once that happens the critical condition in the throat is lost, and the upstream head no longer sets the discharge on its own. Lower the tailwater, or raise the throat crest.",
    exagg: "vertical exaggeration",
    note:
      "The strength of this device is not the accuracy of its coefficient but where that coefficient comes from. The throat is deliberately made long enough for the streamlines inside it to become parallel and the pressure to return to hydrostatic. Once that holds, the flow passes through critical conditions inside the throat, and at critical conditions the depth is exactly two thirds of the total head. From those two facts alone the discharge follows, without a single measured number. The constant 1.7049 in the formula is not empirical: it is two thirds to the power of one and a half times the square root of gravity. The practical consequence is large: a long-throated flume can be designed on paper for any cross-sectional shape, then built and used straight away. A device with an empirical coefficient does not have that luxury. Only two things must still be watched, and both are marked on this sheet: the ratio of head to throat length must stay inside its range, and the tailwater must not rise far enough to drown the critical condition in the throat.",
  },
} as const;

const REFS = {
  id: [
    "ISO 4359. Flow measurement structures — Rectangular, trapezoidal and U-shaped flumes.",
    "Bos, M.G. (1989). Discharge Measurement Structures, edisi ke-3. ILRI Publication 20.",
    "Clemmens, A.J., Wahl, T.L., Bos, M.G. & Replogle, J.A. (2001). Water Measurement with Flumes and Weirs. ILRI Publication 58.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Bab 3 dan Bab 14.",
  ],
  en: [
    "ISO 4359. Flow measurement structures — Rectangular, trapezoidal and U-shaped flumes.",
    "Bos, M.G. (1989). Discharge Measurement Structures, 3rd ed. ILRI Publication 20.",
    "Clemmens, A.J., Wahl, T.L., Bos, M.G. & Replogle, J.A. (2001). Water Measurement with Flumes and Weirs. ILRI Publication 58.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Chapters 3 and 14.",
  ],
} as const;

export function FlumLeherPanjangClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [h1, setH1] = useState(0.3);
  const [bt, setBt] = useState(0.6);
  const [bA, setBA] = useState(1.2);
  const [p, setP] = useState(0.25);
  const [Lt, setLt] = useState(0.9);
  const [Cd, setCd] = useState(0.99);
  const [tail, setTail] = useState(0.25);

  const r = flumeDischarge(h1, bt, bA, p, Lt, Cd);
  const tenggelam = tail > r.tailLimit;

  const ref = useCanvas(
    (ctx, w, h) => drawReach(ctx, w, h, susun(r, h1, p, Lt, tail, lang)),
    [h1, bt, bA, p, Lt, Cd, tail, lang]
  );

  const alasan =
    r.reason === "HL-kecil" ? x.luarKecil : r.reason === "HL-besar" ? x.luarBesar : "";

  return (
    <LabShell
      sheet="FM-04"
      subject={SUBJECTS.FM[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Lehernya dibuat panjang bukan demi kekuatan, melainkan supaya garis
            arus di dalamnya sempat menjadi sejajar. Begitu itu terjadi, aliran
            melewati <Term tint={C.critical}>kondisi kritis</Term> di leher, dan
            debitnya dapat diturunkan di atas kertas tanpa satu pun angka hasil
            pengujian.
          </p>
        ) : (
          <p>
            The throat is made long not for strength but so that the streamlines
            inside it have room to become parallel. Once that happens the flow
            passes through <Term tint={C.critical}>critical conditions</Term> in
            the throat, and the discharge can be derived on paper without a
            single measured number.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FM-04"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "h₁", value: `${fmt(h1, 3)} m`, tint: C.water },
            { label: "Q", value: `${fmt(r.Q, 4)} m³/s`, tint: C.water },
            { label: "yc", value: `${fmt(r.yc, 4)} m`, tint: C.critical },
            {
              label: "H/L",
              value: fmt(r.H1 / Lt, 3),
              tint: r.outOfRange ? C.signal : undefined,
            },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="h₁" label={x.dh} value={h1} min={0.02} max={1.5} step={0.01} digits={3} unit="m" onChange={setH1} tint={C.water} />
              <InputRow symbol="b" label={x.dbt} value={bt} min={0.1} max={5} step={0.05} unit="m" onChange={setBt} />
              <InputRow symbol="B" label={x.dbA} value={bA} min={0.15} max={10} step={0.05} unit="m" onChange={setBA} />
              <InputRow symbol="p" label={x.dp} value={p} min={0} max={1.5} step={0.05} unit="m" onChange={setP} />
              <InputRow symbol="L" label={x.dL} value={Lt} min={0.1} max={5} step={0.05} unit="m" onChange={setLt} />
              <InputRow symbol="Cd" label={x.dCd} value={Cd} min={0.93} max={1} step={0.005} digits={3} onChange={setCd} />
              <InputRow symbol="y_h" label={x.dTail} value={tail} min={0} max={2} step={0.05} unit="m" onChange={setTail} tint={C.signal} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pKecil, apply: () => { setH1(0.12); setBt(0.3); setBA(0.6); setP(0.2); setLt(0.4); setCd(0.99); setTail(0.18); } },
                  { label: x.pSedang, apply: () => { setH1(0.3); setBt(0.6); setBA(1.2); setP(0.25); setLt(0.9); setCd(0.99); setTail(0.25); } },
                  { label: x.pBesar, apply: () => { setH1(0.5); setBt(1.5); setBA(3); setP(0.4); setLt(1.5); setCd(0.99); setTail(0.4); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={C.water}>{`${fmt(r.Q * 1000, 0)} l/s`}</Flag>
              {r.outOfRange && <Flag alert>{x.luar}</Flag>}
              {tenggelam && <Flag alert>{x.tenggelam}</Flag>}
            </div>
            {r.outOfRange && (
              <div className="mb-2.5">
                <Note>{alasan}</Note>
              </div>
            )}
            {tenggelam && (
              <div className="mb-2.5">
                <Note>{x.tenggelamNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "Q", label: x.rQ, value: fmt(r.Q, 4), unit: "m³/s", tint: C.water, strong: true },
                { symbol: "H₁", label: x.rH1, value: fmt(r.H1, 4), unit: "m", tint: C.energy, strong: true },
                { symbol: "yc", label: x.rYc, value: fmt(r.yc, 4), unit: "m", tint: C.critical },
                { symbol: "Vc", label: x.rV, value: fmt(r.yc > 0 ? Math.sqrt(9.81 * r.yc) : 0, 3), unit: "m/s" },
                { symbol: "Cv", label: x.rCv, value: fmt(r.Cv, 4) },
                { symbol: "H/L", label: x.rHL, value: fmt(r.H1 / Lt, 3), tint: r.outOfRange ? C.signal : undefined },
                { symbol: "y*", label: x.rTail, value: fmt(r.tailLimit, 3), unit: "m", tint: tenggelam ? C.signal : undefined },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(r, tenggelam, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksFlume(h1, bt, bA, p, Lt, Cd)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Q = Cd</span>
                <span className="ml-1">(2/3)^1,5</span>
                <span className="ml-1">√g b H₁^1,5</span>
                <span className="ml-6">yc =</span>
                <Frac num="2" den="3" />
                <span>H₁</span>
              </Eq>
              <Eq>
                <span>H₁ = h₁ +</span>
                <Frac num="V₁²" den="2g" />
                <span className="ml-6">{FLUME_HL_MIN} ≤ H₁ / L ≤ {FLUME_HL_MAX}</span>
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
 * Menyusun potongan memanjang flum.
 *
 * Bentuknya dinyatakan dalam kelipatan panjang leher, supaya perbandingan
 * bagian-bagiannya tetap terbaca berapa pun ukurannya. Yang harus terlihat
 * bukan gambar teknik yang dapat dibangun, melainkan tiga ketinggian yang
 * saling terkait: tinggi energi di penampang ukur, kedalaman kritis di leher
 * yang tepat dua per tiganya, dan batas muka air hilir.
 */
function susun(
  r: FlumeResult,
  h1: number,
  p: number,
  Lt: number,
  tail: number,
  lang: Lang
) {
  const T = cl(lang);

  const xDatang = 2.5 * Lt;
  const xKerucut = 1.0 * Lt;
  const xLeher = Lt;
  const xLebar = 2.0 * Lt;
  const xHilir = 1.5 * Lt;

  const a1 = xDatang;
  const a2 = a1 + xKerucut;
  const a3 = a2 + xLeher;
  const a4 = a3 + xLebar;
  const L = a4 + xHilir;

  const bed: ReachPoint[] = [
    { x: 0, z: 0 },
    { x: a1, z: 0 },
    { x: a2, z: p },
    { x: a3, z: p },
    { x: a4, z: 0 },
    { x: L, z: 0 },
  ];

  const xUkur = Math.max(0.4 * Lt, a1 - 2.5 * h1);
  const zUkur = p + h1;
  const zKritis = p + r.yc;

  // Muka air: mendatar sampai penampang ukur, turun halus menuju kondisi
  // kritis di leher, tetap kritis sepanjang leher, lalu jatuh ke muka air
  // hilir. Ruas terakhir sengaja digambar sebagai peralihan, bukan hasil
  // hitungan, karena lembar ini tidak menelusuri profil di hilir leher.
  const air: ReachPoint[] = [{ x: 0, z: zUkur }, { x: xUkur, z: zUkur }];
  for (let i = 1; i <= 20; i++) {
    const f = i / 20;
    const xx = xUkur + (a2 - xUkur) * f;
    air.push({ x: xx, z: zUkur - (zUkur - zKritis) * f * f });
  }
  air.push({ x: a3, z: zKritis });
  const zAkhir = Math.max(tail, 0.02);
  for (let i = 1; i <= 16; i++) {
    const f = i / 16;
    const xx = a3 + (a4 - a3) * f;
    air.push({ x: xx, z: zKritis - (zKritis - zAkhir) * Math.sqrt(f), invalid: true });
  }
  air.push({ x: L, z: zAkhir, invalid: true });

  const garis: ReachSeries[] = [
    {
      pts: [
        { x: 0, z: p + r.H1 },
        { x: a3, z: p + r.H1 },
      ],
      color: C.energy,
      weight: W.thin,
      dash: DASH.hidden,
      label: `H₁ ${r.H1.toFixed(3)} m`,
      labelAt: 0.5,
      labelDy: -9,
    },
    {
      pts: [
        { x: a1, z: zKritis },
        { x: a4, z: zKritis },
      ],
      color: C.critical,
      weight: W.hair,
      dash: DASH.axis,
      label: `yc ${r.yc.toFixed(3)} m`,
      labelAt: 0.04,
      labelDy: 11,
    },
    {
      pts: [
        { x: a3, z: r.tailLimit },
        { x: L, z: r.tailLimit },
      ],
      color: C.signal,
      weight: W.hair,
      dash: DASH.phantom,
      label: T.submerged,
      labelAt: 0.98,
      labelAlign: "right",
      labelDy: -9,
    },
  ];

  const tanda: ReachMarker[] = [
    {
      x: xUkur,
      label: T.gauging,
      color: C.water,
      zBottom: 0,
      dim: { zTop: zUkur, zBottom: p, text: `h₁ ${h1.toFixed(3)} m`, side: -1 },
    },
    {
      x: (a2 + a3) / 2,
      label: T.throat,
      color: C.critical,
      zBottom: p,
      dim: {
        zTop: zKritis,
        zBottom: p,
        text: `${r.yc.toFixed(3)} m`,
        side: 1,
      },
    },
  ];

  const wilayah: ReachRegion[] = [
    {
      x: (a2 + a3) / 2,
      z: (p + r.H1) * 1.16,
      text: "Fr = 1",
      color: C.critical,
      big: true,
    },
    {
      x: xDatang * 0.4,
      z: zUkur * 1.22,
      text: T.subcritical,
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
    axisX: T.axStation,
    axisZ: T.elevation,
  };
}

function notice(r: FlumeResult, tenggelam: boolean, lang: Lang): string {
  if (tenggelam) {
    return lang === "id"
      ? "Selama muka air hilir masih di atas batas kerja bebas, tinggi muka air di hulu tidak lagi menentukan debit sendirian, dan angka pada tabel di atas tidak berlaku. Turunkan muka air hilirnya, lalu perhatikan garis merah putus-putus di hilir leher turun di bawah muka airnya."
      : "While the tailwater stays above the free-flow limit, the upstream head no longer sets the discharge on its own and the numbers in the table above do not apply. Lower the tailwater and watch the dashed red line downstream of the throat drop below the surface.";
  }

  const bagian = (r.yc / r.H1) * 100;

  if (lang === "en")
    return `Read the throat against the energy line above it. Critical depth sits at ${r.yc.toFixed(3)} m, which is ${bagian.toFixed(1)} per cent of the total head of ${r.H1.toFixed(3)} m, and that fraction stays at two thirds no matter what you change. The velocity of approach coefficient is ${r.Cv.toFixed(4)}, so ignoring the approach velocity would understate the discharge by ${((r.Cv - 1) * 100).toFixed(2)} per cent. Widen the approach channel and watch that error shrink toward nothing.`;
  return `Bacalah leher terhadap garis energi di atasnya. Kedalaman kritis duduk di ${r.yc.toFixed(3)} m, yaitu ${bagian.toFixed(1)} persen dari tinggi energi ${r.H1.toFixed(3)} m, dan pecahan itu tetap dua per tiga apa pun yang diubah. Koefisien kecepatan datangnya ${r.Cv.toFixed(4)}, jadi mengabaikan kecepatan datang akan mengecilkan debit sebesar ${((r.Cv - 1) * 100).toFixed(2)} persen. Perlebar saluran datangnya, lalu perhatikan kesalahan itu menyusut mendekati nol.`;
}
