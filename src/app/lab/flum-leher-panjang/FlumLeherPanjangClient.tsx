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
  FLUME_C,
  FLUME_FR_MAX,
  FLUME_HL_MAX,
  FLUME_HL_MIN,
  G,
  flumeDischarge,
  fmt,
  fmtPlain,
  type FlumeResult,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
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
    rFr: "Bilangan Froude di penampang ukur",
    rV: "Kecepatan di leher",
    rTail: "Batas muka air hilir agar tetap bebas",
    luar: "Di luar rentang keberlakuan",
    luarFr:
      "Bilangan Froude di penampang ukur melampaui 0,5, batas yang ditetapkan ISO 4359. Pada aliran datang secepat itu muka air bergelombang dan bacaan tinggi muka air tidak lagi dapat dipercaya; kecepatan datang juga sudah menjadi bagian besar dari tinggi energi. Perlebar saluran datang atau tinggikan mercu.",
    takKendali: "Leher tidak mengendalikan aliran",
    takKendaliNote:
      "Lehernya terlalu lebar untuk saluran datangnya. Pada kedalaman ini saluran datang tidak sanggup membawa debit yang akan dilewatkan leher, jadi tidak ada tinggi energi yang memenuhi persamaan kecepatan datang, dan kondisi kritis tidak terbentuk di leher. Tidak ada debit yang dapat dihitung dari tinggi muka air. Sempitkan leher, perlebar saluran datang, atau tinggikan mercu.",
    luarKecil:
      "Tinggi energi terlalu kecil dibanding panjang leher. Gesekan di sepanjang leher menjadi terlalu besar untuk diabaikan, dan koefisien debitnya tidak lagi mendekati satu. Perpendek lehernya atau ukur pada debit yang lebih besar.",
    luarBesar:
      "Tinggi energi terlalu besar dibanding panjang leher. Garis arus di dalam leher belum sempat menjadi sejajar, sehingga andaian aliran kritis dengan tekanan hidrostatik tidak berlaku, dan alat ini kembali menjadi ambang lebar biasa yang harus dikalibrasi. Perpanjang lehernya.",
    tenggelam: "Flum tenggelam",
    leherLebar: "Leher lebih lebar dari saluran datang",
    leherLebarNote:
      "Lebar leher melampaui lebar saluran datangnya. Itu bukan penyempitan: air tidak dapat melebar ke leher yang lebih lebar daripada dindingnya sendiri, jadi kondisi kritis di leher tidak terbentuk dan tidak ada debit yang dapat dihitung dari tinggi muka air. Lebar leher boleh sama dengan saluran datang (flum dengan penyempitan dasar saja), tetapi tidak lebih. Sempitkan leher atau perlebar saluran datang.",
    cekDisembunyikan:
      "Tiga pemeriksaan kondisi kritis di leher tidak ditampilkan pada blok verifikasi: leher yang tidak mengendalikan aliran tidak punya penampang kritis, jadi angka nol lawan nol di sana bukan bukti apa pun.",
    bebas: "Aliran bebas",
    indikatif: "indikatif",
    bandHLKecil: "Gesekan leher tidak terabaikan",
    bandHL: "Rentang berlaku",
    bandHLBesar: "Garis arus belum sejajar",
    bandFrOk: "Aliran datang tenang",
    bandFr: "Aliran datang terlalu cepat, ISO 4359",
    bandBebas: "Aliran bebas",
    bandTenggelam: "Tenggelam",
    hA: "Luas penampang ukur dan tetapan k",
    hH1: "Tinggi energi, akar terkecil H = h₁ + k H³",
    hQ: "Debit dan kedalaman kritis",
    hFr: "Froude di penampang ukur dan perbandingan H₁/L",
    hTail: "Batas muka air hilir",
    hTak: "k > 4/(27 h₁²): leher bukan penampang kendali",
    hLebar: "b > B: leher lebih lebar dari saluran datang",
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
    rFr: "Froude number at the gauging section",
    rV: "Velocity in the throat",
    rTail: "Tailwater limit for free flow",
    luar: "Outside the valid range",
    luarFr:
      "The Froude number at the gauging section exceeds 0.5, the limit set by ISO 4359. With approach flow that fast the surface is wavy and the head reading can no longer be trusted; the velocity head is also a large part of the total head. Widen the approach channel or raise the sill.",
    takKendali: "Throat does not control the flow",
    takKendaliNote:
      "The throat is too wide for its approach channel. At this depth the approach channel cannot carry the discharge the throat would pass, so no energy head satisfies the velocity-of-approach equation and critical flow does not form in the throat. No discharge can be computed from the head. Narrow the throat, widen the approach, or raise the sill.",
    luarKecil:
      "The head is too small against the throat length. Friction along the throat becomes too large to ignore, and the discharge coefficient no longer sits close to one. Shorten the throat or gauge at a larger discharge.",
    luarBesar:
      "The head is too large against the throat length. The streamlines inside the throat have not had room to become parallel, so the assumption of critical flow with hydrostatic pressure fails, and the device reverts to an ordinary broad-crested weir that must be calibrated. Lengthen the throat.",
    tenggelam: "Flume submerged",
    leherLebar: "Throat wider than the approach channel",
    leherLebarNote:
      "The throat is wider than its approach channel. That is not a contraction: water cannot spread into a throat wider than its own walls, so critical flow does not form in the throat and no discharge can be computed from the head. The throat may equal the approach width (a flume with a raised sill only), but not exceed it. Narrow the throat or widen the approach channel.",
    cekDisembunyikan:
      "The three checks on critical flow in the throat are not shown in the verification block: a throat that does not control the flow has no critical section, so a zero-against-zero match there proves nothing.",
    bebas: "Free flow",
    indikatif: "indicative",
    bandHLKecil: "Throat friction not negligible",
    bandHL: "Valid range",
    bandHLBesar: "Streamlines not yet parallel",
    bandFrOk: "Calm approach",
    bandFr: "Approach too fast, ISO 4359",
    bandBebas: "Free flow",
    bandTenggelam: "Submerged",
    hA: "Gauging section area and constant k",
    hH1: "Total head, smallest root of H = h₁ + k H³",
    hQ: "Discharge and critical depth",
    hFr: "Froude number at the gauging section and the ratio H₁/L",
    hTail: "Tailwater limit",
    hTak: "k > 4/(27 h₁²): the throat is not a control section",
    hLebar: "b > B: the throat is wider than the approach channel",
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
  const takKendali = !r.controlled;
  const leherLebar = r.reason === "leher-lebar";
  const tenggelam = r.controlled && tail > r.tailLimit;
  const takAda = "—";
  const rasioHL = Lt > 0 ? r.H1 / Lt : 0;
  /* Model memberi satu sebab saja (Fr lebih dulu daripada H/L). Keduanya
     diperiksa sendiri supaya StateCard memuat semua butir yang berlaku. */
  const frLuar = r.controlled && r.Fr1 > FLUME_FR_MAX;
  const hlLuar = r.controlled && (rasioHL < FLUME_HL_MIN || rasioHL > FLUME_HL_MAX);
  /* Tenggelam: tinggi hulu tidak lagi menentukan debit sendirian, jadi
     debit, tinggi energi, dan besaran kritis ditulis "—". */
  const debitSah = r.controlled && !tenggelam;
  const tintQ = frLuar || hlLuar ? C.signal : C.water;
  const tandaQ = debitSah && (frLuar || hlLuar) ? ` (${x.indikatif})` : "";

  const ref = useCanvas(
    (ctx, w, h) => drawReach(ctx, w, h, susun(r, h1, p, Lt, tail, tenggelam, lang)),
    [h1, bt, bA, p, Lt, Cd, tail, lang]
  );

  const alasanTak = leherLebar ? x.leherLebarNote : x.takKendaliNote;
  const butir: string[] = [];
  if (takKendali) butir.push(alasanTak, x.cekDisembunyikan);
  if (frLuar) butir.push(x.luarFr);
  if (hlLuar) butir.push(rasioHL < FLUME_HL_MIN ? x.luarKecil : x.luarBesar);
  if (tenggelam) butir.push(x.tenggelamNote);
  butir.push(...notice(r, tenggelam, frLuar, lang));

  const nada: Tone = takKendali || frLuar || hlLuar || tenggelam ? "invalid" : "pass";
  const badge = takKendali
    ? leherLebar
      ? x.leherLebar
      : x.takKendali
    : tenggelam
      ? x.tenggelam
      : frLuar || hlLuar
        ? x.luar
        : x.bebas;
  const state = takKendali
    ? leherLebar
      ? lang === "id"
        ? `Leher ${fmt(bt, 2)} m lebih lebar dari saluran datang ${fmt(bA, 2)} m: tidak ada debit yang dapat dihitung.`
        : `The ${fmt(bt, 2)} m throat is wider than the ${fmt(bA, 2)} m approach: no discharge can be computed.`
      : lang === "id"
        ? "Leher tidak mengendalikan aliran: tidak ada tinggi energi yang memenuhi persamaan kecepatan datang."
        : "The throat does not control the flow: no total head satisfies the velocity-of-approach equation."
    : tenggelam
      ? lang === "id"
        ? `Muka air hilir ${fmt(tail, 2)} m melewati batas kerja bebas ${fmt(r.tailLimit, 3)} m: debit tidak dapat dibaca dari h₁.`
        : `Tailwater ${fmt(tail, 2)} m is above the free-flow limit ${fmt(r.tailLimit, 3)} m: the discharge cannot be read from h₁.`
      : lang === "id"
        ? `Q ${fmt(r.Q, 4)} m³/s${tandaQ}; yc = ⅔ H₁ = ${fmt(r.yc, 3)} m.`
        : `Q ${fmt(r.Q, 4)} m³/s${tandaQ}; yc = ⅔ H₁ = ${fmt(r.yc, 3)} m.`;

  /* Saat leher tak terkendali, model dan cek membuat tiga pemeriksaan
     kondisi kritis lolos dengan sendirinya (yc 0 lawan 0). Lolos seperti
     itu bukan bukti, jadi tidak ditampilkan; butir StateCard menyebutnya. */
  const KRITIS = new Set([
    "Kedalaman kritis di leher adalah dua per tiga tinggi energi",
    "Debit di leher sama dengan luas kritis dikali kecepatan kritis",
    "Bilangan Froude di leher sama dengan satu",
  ]);
  const cek = checksFlume(h1, bt, bA, p, Lt, Cd);
  // Tak terkendali atau tenggelam: kondisi kritis di leher tidak ada, jadi
  // tiga cek kritis tidak boleh tampil seolah lolos.
  const cekTampil = debitSah ? cek : cek.filter((c) => !KRITIS.has(c.label.id));

  const A1 = bA * (h1 + p);
  const k = A1 > 0 ? Math.pow(Cd * FLUME_C * bt, 2) / (2 * G * A1 * A1) : 0;
  const kMaks = h1 > 0 ? 4 / (27 * h1 * h1) : Infinity;
  const Vc = r.yc > 0 ? Math.sqrt(G * r.yc) : 0;
  const e15 = fmt(1.5, 1);

  const langkah = [
    {
      judul: x.hA,
      rumus: (<><span>A₁ = B ( h₁ + p ) ;  k =</span><Frac num={`( Cd · ${fmt(FLUME_C, 4)} · b )²`} den="2 g A₁²" /></>),
      isi: `A₁ = ${fmt(bA, 2)} · ( ${fmt(h1, 3)} + ${fmt(p, 2)} ) = ${fmt(A1, 4)} m² ;  ( ${fmt(Cd, 3)} · ${fmt(FLUME_C, 4)} · ${fmt(bt, 2)} )² / ( 2 · ${fmt(G, 2)} · ${fmt(A1, 4)}² )`,
      hasil: fmt(k, 4),
      satuan: "m⁻²",
    },
    takKendali
      ? {
          judul: x.takKendali,
          rumus: leherLebar ? <span>b ≤ B</span> : <span>k ≤ 4 / ( 27 h₁² )</span>,
          isi: leherLebar
            ? `${fmt(bt, 2)} > ${fmt(bA, 2)}: ${x.hLebar}`
            : `${fmt(k, 4)} > ${fmt(kMaks, 4)}: ${x.hTak}`,
          hasil: takAda,
        }
      : {
          judul: x.hH1,
          rumus: <span>k ≤ 4 / ( 27 h₁² ) ;  H₁ = h₁ + k H₁³ ;  Cv = ( H₁ / h₁ )^{e15}</span>,
          isi: `${fmt(k, 4)} ≤ ${fmt(kMaks, 4)} ;  H₁ = ${fmt(h1, 3)} + ${fmt(k, 4)} · H₁³ ;  Cv = ( H₁ / ${fmt(h1, 3)} )^${e15} = ${fmt(r.Cv, 4)}`,
          hasil: fmt(r.H1, 4),
          satuan: "m",
          tint: C.energy,
        },
    ...(takKendali
      ? []
      : [
          {
            judul: `${x.hQ}${tandaQ}`,
            rumus: <span>Q = Cd · ( 2/3 )^{e15} · √g · b · H₁^{e15} ;  yc = ⅔ H₁</span>,
            isi: debitSah
              ? `${fmt(Cd, 3)} · ${fmt(FLUME_C, 4)} · ${fmt(bt, 2)} · ${fmt(r.H1, 4)}^${e15} ;  yc = ${fmt(r.yc, 4)} m`
              : takAda,
            hasil: debitSah ? fmt(r.Q, 4) : takAda,
            satuan: debitSah ? "m³/s" : undefined,
            tint: tintQ,
          },
          {
            judul: x.hFr,
            rumus: (<><span>Fr₁ =</span><Frac num="Q" den="A₁ √( g ( h₁ + p ) )" /><span className="ml-3">H₁ / L</span></>),
            isi: !tenggelam
              ? `${fmt(r.Q, 4)} / ( ${fmt(A1, 4)} · √( ${fmt(G, 2)} · ${fmt(h1 + p, 3)} ) ) = ${fmt(r.Fr1, 3)} ;  ${fmt(r.H1, 4)} / ${fmt(Lt, 2)}`
              : `Fr₁ = ${fmt(r.Fr1, 3)} ;  ${fmt(r.H1, 4)} / ${fmt(Lt, 2)}`,
            hasil: fmt(rasioHL, 3),
            tint: hlLuar ? C.signal : undefined,
          },
          {
            judul: x.hTail,
            rumus: <span>y* = p + {fmt(0.75, 2)} H₁ ;  y_h ≤ y*</span>,
            isi: `${fmt(p, 2)} + ${fmt(0.75, 2)} · ${fmt(r.H1, 4)} = ${fmt(r.tailLimit, 3)} ;  ${fmt(tail, 2)} ${tenggelam ? ">" : "≤"} ${fmt(r.tailLimit, 3)}`,
            hasil: fmt(r.tailLimit, 3),
            satuan: "m",
            tint: tenggelam ? C.signal : undefined,
          },
        ]),
  ];

  /* Batas pita dari FLUME_HL_MIN/MAX dan FLUME_FR_MAX (Bos 1989,
     ISO 4359) dan tailLimit (batas moduler p + 0,75 H₁). Sumbu H₁/L
     0,004 sampai 25 dan Fr₁ 0 sampai 1 memuat rentang penggeser
     (0,0040 sampai 20,85; Fr₁ paling besar 0,883). */
  const Y_MAKS = 2;
  const batasY = Math.min(Y_MAKS, Math.max(0, r.tailLimit));
  const status = takKendali ? (
    <RegimeScale
      symbol="H₁/L"
      value={NaN}
      invalid
      pesan={leherLebar ? x.leherLebar : x.takKendali}
      scale="log"
      digits={3}
      bands={[{ from: 0.004, to: 25, label: leherLebar ? x.leherLebar : x.takKendali, tone: "invalid" }]}
    />
  ) : (
    <div className="flex flex-col gap-2">
      <RegimeScale
        symbol="H₁/L"
        value={rasioHL}
        invalid={hlLuar}
        scale="log"
        digits={3}
        bands={[
          { from: 0.004, to: FLUME_HL_MIN, label: x.bandHLKecil, tone: "invalid" },
          { from: FLUME_HL_MIN, to: FLUME_HL_MAX, label: x.bandHL, tone: "pass" },
          { from: FLUME_HL_MAX, to: 25, label: x.bandHLBesar, tone: "invalid" },
        ]}
      />
      <RegimeScale
        symbol="Fr₁"
        value={r.Fr1}
        invalid={frLuar}
        digits={3}
        bands={[
          { from: 0, to: FLUME_FR_MAX, label: x.bandFrOk, tone: "neutral" },
          { from: FLUME_FR_MAX, to: 1, label: x.bandFr, tone: "invalid" },
        ]}
      />
      <RegimeScale
        symbol="y_h"
        value={tail}
        invalid={tenggelam}
        digits={2}
        bands={
          batasY >= Y_MAKS
            ? [{ from: 0, to: Y_MAKS, label: x.bandBebas, tone: "pass" }]
            : batasY <= 0
              ? [{ from: 0, to: Y_MAKS, label: x.bandTenggelam, tone: "invalid" }]
              : [
                  { from: 0, to: batasY, label: x.bandBebas, tone: "pass" },
                  { from: batasY, to: Y_MAKS, label: x.bandTenggelam, tone: "invalid" },
                ]
        }
      />
    </div>
  );

  return (
    <LabShell
      status={status}
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
            { label: "Q", value: debitSah ? `${fmt(r.Q, 4)} m³/s` : takAda, tint: debitSah ? tintQ : C.signal },
            { label: "yc", value: debitSah ? `${fmt(r.yc, 4)} m` : takAda, tint: C.critical },
            // Merah hanya pada besaran yang memang di luar rentang.
            {
              label: "H/L",
              value: takKendali ? takAda : fmt(rasioHL, 3),
              tint: takKendali || hlLuar ? C.signal : undefined,
            },
            {
              label: "Fr₁",
              value: takKendali ? takAda : fmt(r.Fr1, 3),
              tint: frLuar ? C.signal : undefined,
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
              <InputRow symbol="y_h" label={x.dTail} value={tail} min={0} max={2} step={0.05} unit="m" onChange={setTail} tint={tenggelam ? C.signal : undefined} />
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
            <ResultTable
              rows={[
                { symbol: "Q", label: `${x.rQ}${tandaQ}`, value: debitSah ? fmt(r.Q, 4) : takAda, unit: debitSah ? "m³/s" : undefined, tint: tintQ, strong: true },
                /* Saat tenggelam H₁ tetap ditulis: ia tinggi energi dengan andaian
                   aliran bebas, dan dipakai untuk batas y* di bawah. Yang
                   tidak berlaku adalah debitnya. */
                { symbol: "H₁", label: x.rH1, value: takKendali ? takAda : fmt(r.H1, 4), unit: takKendali ? undefined : "m", tint: C.energy, strong: !tenggelam },
                { symbol: "yc", label: x.rYc, value: debitSah ? fmt(r.yc, 4) : takAda, unit: debitSah ? "m" : undefined, tint: C.critical },
                { symbol: "Vc", label: x.rV, value: debitSah ? fmt(Vc, 3) : takAda, unit: debitSah ? "m/s" : undefined },
                { symbol: "Cv", label: x.rCv, value: takKendali ? takAda : fmt(r.Cv, 4) },
                { symbol: "Fr₁", label: x.rFr, value: takKendali ? takAda : fmt(r.Fr1, 3), tint: frLuar ? C.signal : undefined },
                { symbol: "H/L", label: x.rHL, value: takKendali ? takAda : fmt(rasioHL, 3), tint: hlLuar ? C.signal : undefined },
                { symbol: "y*", label: x.rTail, value: takKendali ? takAda : fmt(r.tailLimit, 3), unit: takKendali ? undefined : "m", tint: tenggelam ? C.signal : undefined },
              ]}
            />
            <div className="mt-3">
              <Hitungan langkah={langkah} />
            </div>
          </Block>

          <StateCard tone={nada} badge={badge} state={state} notice={butir} />
        </>
      }
      verification={<Verification checks={cekTampil} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Q = Cd</span>
                <span className="ml-1">(2/3)^{fmt(1.5, 1)}</span>
                <span className="ml-1">√g b H₁^{fmt(1.5, 1)}</span>
                <span className="ml-6">yc =</span>
                <Frac num="2" den="3" />
                <span>H₁</span>
              </Eq>
              <Eq>
                <span>H₁ = h₁ +</span>
                <Frac num="V₁²" den="2g" />
                <span className="ml-6">{fmt(FLUME_HL_MIN, 2)} ≤ H₁ / L ≤ {fmt(FLUME_HL_MAX, 2)}</span>
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
  tenggelam: boolean,
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
    // Saat tenggelam bentuk muka air di kerucut dan leher tidak diketahui
    // lembar ini, jadi digambar bertitik rapat.
    air.push({ x: xx, z: zUkur - (zUkur - zKritis) * f * f, invalid: tenggelam || undefined });
  }
  air.push({ x: a3, z: zKritis, invalid: tenggelam || undefined });
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
      label: `H₁ ${fmtPlain(r.H1, 3)} m`,
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
      label: `yc ${fmtPlain(r.yc, 3)} m`,
      labelAt: 0.04,
      labelDy: 11,
    },
    {
      pts: [
        { x: a3, z: r.tailLimit },
        { x: L, z: r.tailLimit },
      ],
      // Batas kerja bebas: oker selama flum bebas, merah sinyal hanya bila
      // muka air hilir sudah melewatinya.
      color: tail > r.tailLimit ? C.signal : C.caution,
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
      dim: { zTop: zUkur, zBottom: p, text: `h₁ ${fmtPlain(h1, 3)} m`, side: -1 },
    },
    {
      x: (a2 + a3) / 2,
      label: T.throat,
      color: C.critical,
      zBottom: p,
      dim: {
        zTop: zKritis,
        zBottom: p,
        text: `${fmtPlain(r.yc, 3)} m`,
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

  // Leher yang tidak mengendalikan aliran: tidak ada kondisi kritis, tidak
  // ada garis energi, tidak ada batas tenggelam. Muka air digambar mendatar
  // pada tinggi yang dimasukkan dan seluruhnya bertitik rapat, karena lembar
  // ini memang tidak tahu bentuknya, dan gambar menulis mengapa.
  if (!r.controlled) {
    return {
      length: L,
      bed,
      water: [
        { x: 0, z: zUkur, invalid: true },
        { x: L, z: zUkur, invalid: true },
      ],
      series: [],
      markers: [tanda[0]],
      regions: [
        {
          x: L * 0.5,
          z: zUkur * 1.22,
          text: T.throatNoControl,
          color: C.signal,
        },
      ],
      axisX: T.axStation,
      axisZ: T.elevation,
    };
  }

  // Tenggelam: kondisi kritis di leher hilang. Garis dan dimensi yc serta
  // wilayah "Fr = 1" dibuang agar gambar tidak bertentangan dengan tabel.
  // Garis H₁ dan batas y* tetap, untuk menunjukkan y_h > y*.
  if (tenggelam) {
    return {
      length: L,
      bed,
      water: air,
      series: garis.filter((_, i) => i !== 1),
      markers: [tanda[0], { x: tanda[1].x, label: tanda[1].label, color: C.ink3, zBottom: p }],
      regions: [wilayah[1]],
      axisX: T.axStation,
      axisZ: T.elevation,
    };
  }

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

/*
 * Butir tambahan sesudah butir keadaan di luar rentang. Dulu satu paragraf
 * yang hanya memuat satu sebab; kini Fr besar dan tenggelam masing-masing
 * punya butir sendiri dan tampil bersamaan bila keduanya terjadi.
 */
function notice(r: FlumeResult, tenggelam: boolean, frLuar: boolean, lang: Lang): string[] {
  const en = lang === "en";
  if (!r.controlled)
    return [
      en
        ? "Narrow the throat below the approach width, or raise the sill, and watch the energy line and critical depth reappear."
        : "Sempitkan lehernya sampai di bawah lebar saluran datang, atau tinggikan mercunya, lalu perhatikan garis energi dan kedalaman kritis muncul kembali.",
    ];
  const out: string[] = [];
  if (frLuar)
    out.push(
      en
        ? `The Froude number at the gauging section is ${fmt(r.Fr1, 3)}. Widen the approach channel and watch the velocity-of-approach coefficient ${fmt(r.Cv, 4)} fall toward one.`
        : `Bilangan Froude di penampang ukur ${fmt(r.Fr1, 3)}. Perlebar saluran datang, lalu perhatikan koefisien kecepatan datang ${fmt(r.Cv, 4)} turun mendekati satu.`
    );
  if (tenggelam)
    out.push(
      en
        ? "Lower the tailwater and watch the dashed line downstream of the throat drop below the surface."
        : "Turunkan muka air hilirnya, lalu perhatikan garis putus-putus di hilir leher turun di bawah muka airnya."
    );
  if (tenggelam) return out;

  const bagian = (r.yc / r.H1) * 100;
  out.push(
    en
      ? `Read the throat against the energy line above it. Critical depth sits at ${fmt(r.yc, 3)} m, which is ${fmt(bagian, 1)} per cent of the total head of ${fmt(r.H1, 3)} m, and that fraction stays at two thirds no matter what you change.`
      : `Bacalah leher terhadap garis energi di atasnya. Kedalaman kritis duduk di ${fmt(r.yc, 3)} m, yaitu ${fmt(bagian, 1)} persen dari tinggi energi ${fmt(r.H1, 3)} m, dan pecahan itu tetap dua per tiga apa pun yang diubah.`
  );
  if (!frLuar)
    out.push(
      en
        ? `The velocity of approach coefficient is ${fmt(r.Cv, 4)}, so ignoring the approach velocity would understate the discharge by ${fmt((r.Cv - 1) * 100, 2)} per cent. Widen the approach channel and watch that error shrink toward nothing.`
        : `Koefisien kecepatan datangnya ${fmt(r.Cv, 4)}, jadi mengabaikan kecepatan datang akan mengecilkan debit sebesar ${fmt((r.Cv - 1) * 100, 2)} persen. Perlebar saluran datangnya, lalu perhatikan kesalahan itu menyusut mendekati nol.`
    );
  return out;
}
