"use client";

import { useRef, useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  Block,
  Hitungan,
  InputRow,
  InputTable,
  PresetRow,
  RegimeScale,
  ResultTable,
  SentuhContoh,
  Sheet,
  StateCard,
  Term,
} from "@/components/ui";
import { DragLayer, type HandleSpec } from "@/components/DragLayer";
import { usePlate, usePutar } from "@/lib/usePlate";
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import {
  createRenangGerak,
  drawRenangGerak,
  drawRenangLajur,
  renangKeadaan,
  renangSkalaWaktu,
  type RenangGerak,
} from "@/lib/drawRenang";
import type { ParamDef } from "@/lib/rentang";
import {
  SWIM_BURST_BL,
  SWIM_BURST_TIME,
  SWIM_SUSTAINED_BL,
  SWIM_SUSTAINED_TIME,
  fishSwim,
  fmt,
  fmtPlain,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksSwim } from "@/lib/checks";

const TXT = {
  id: {
    title: "Renang ikan",
    sheetTitle: "Daya renang ikan — kecepatan arus terhadap lama bertahan",
    dL: "Panjang tubuh ikan",
    dV: "Kecepatan arus yang dilawan",
    dSus: "Kecepatan jelajah (cruising)",
    dBurst: "Kecepatan sentak (burst)",
    pKecil: "Ikan kecil, gorong-gorong",
    pSedang: "Ikan ukuran sedang, lintasan ikan",
    pBesar: "Ikan besar, sungai deras",
    rTahan: "Lama sanggup bertahan",
    rSus: "Kecepatan jelajah (cruising)",
    rBurst: "Kecepatan sentak (burst)",
    rMaju: "Kecepatan maju bersih saat sentak",
    rJarak: "Jarak terjauh yang dapat ditempuh",
    rMode: "Cara berenang pada arus ini",
    mJelajah: "Jelajah, tanpa batas waktu",
    mLanjut: "Berkelanjutan",
    mustahil: "Kecepatan jelajah disetel melampaui kecepatan sentak",
    mustahilNote:
      "Kecepatan sentak menurut batasannya adalah kecepatan yang hanya sanggup dipertahankan dua puluh detik, jadi ia tidak mungkin lebih rendah daripada kecepatan yang sanggup dipertahankan selamanya. Tidak ada ikan yang begini. Kurva ketahanan di lembar ini diturunkan dari dua titik itu, dan ketika keduanya bertukar tempat kurvanya berbalik arah sehingga ketahanan justru NAIK bersama kecepatan. Angka yang keluar dari keadaan itu tidak menggambarkan apa pun, dan itu sebabnya lembar ini menolak menggambarnya. Turunkan kecepatan jelajahnya di bawah kecepatan sentaknya.",
    mSentak: "Sentak",
    mTidak: "Tidak bisa maju",
    tidak: "Tidak bisa maju",
    pt: "PT/dtk",
    bJelajah: "Jelajah",
    bLanjut: "Berkelanjutan",
    bSentak: "Sentak (batas model)",
    bTidak: "Tidak mampu maju",
    hU: "Kecepatan arus dalam panjang tubuh",
    hAB: "Tetapan kurva ketahanan dari dua titik",
    hT: "Lama bertahan",
    hV: "Kecepatan jelajah, sentak, dan maju bersih",
    hL: "Jarak dalam satu sentakan",
    tak: "tak terbatas",
    hdlV: "Titik kerja: geser mendatar untuk mengubah kecepatan arus V",
    lTahan: "Menahan diri di tempat",
    lDorong: (v: string) => `Terdorong mundur ${v} m/s`,
    lKibas: "kibasan/s",
    lLuar: "f < 5/s: di luar rentang Bainbridge",
    lWaktu: (te: string, tahan: string, lelah: boolean) =>
      lelah ? `lelah sesudah ${tahan}, hanyut` : `t ${te} s dari ${tahan}`,
    gNyata: "Lajur ikan: waktu nyata. Ikan berenang terhadap air secepat arus (menahan diri) atau, bila tidak mampu, pada kecepatan sentaknya; laju air, kibasan ekor, dan lama bertahan dari hitungan lembar.",
    gLambat: (s: string, f: string) =>
      `Lajur ikan: gerak diperlambat ×${s} supaya kibasan ${f} per detik terbaca; waktu yang tertulis tetap waktu fisik. Ikan berenang terhadap air secepat arus (menahan diri) atau, bila tidak mampu, pada kecepatan sentaknya.`,
    batasModel:
      "Batas antara berkelanjutan dan sentak di lembar ini ditaruh model di tengah (Us + Ub)/2, padahal menurut Beamish (1978) sentak berarti bertahan kurang dari 20 detik. Di pita sentak itu ikan masih bertahan sampai ratusan detik; perbaikan modelnya sudah diusulkan.",
    cekBaku:
      "Blok verifikasi di bawah memeriksa kurva dengan kecepatan jelajah dan sentak bawaan (2 dan 10 PT/dtk), bukan nilai penggeser yang sedang diubah.",
    tidakNote:
      "Kecepatan arusnya menyamai atau melampaui kecepatan sentak ikan ini, jadi ikan tidak dapat maju sama sekali betapa pun kuatnya ia berenang. Bangunan dengan arus seperti ini menjadi penghalang mutlak bagi ikan seukuran itu, dan memperpanjang atau memperpendeknya tidak mengubah apa pun. Yang harus diubah kecepatan arusnya, bukan panjangnya. Perbesar penampang basahnya, tambahkan kekasaran dasar, atau sisipkan kolam istirahat.",
    note:
      "Satu hal yang paling sering salah dipakai dari lembar semacam ini: kecepatan sentak bukan kecepatan yang boleh dipakai merancang. Ia hanya sanggup dipertahankan dua puluh detik, dan sesudah itu ikan harus beristirahat lama sebelum sanggup lagi. Merancang gorong-gorong dengan arus tepat di bawah kecepatan sentak berarti merancang bangunan yang hanya dapat dilewati sekali oleh ikan yang sudah segar, dan tidak dapat dilewati sama sekali oleh ikan yang baru saja melewati bangunan sebelumnya. Itu sebabnya jarak tempuh yang ditampilkan di sini dihitung pada kecepatan sentak selama dua puluh detik, dan angka itu yang menentukan panjang maksimum gorong-gorong atau jarak antar kolam istirahat pada lintasan ikan. Perhatikan juga bahwa seluruh kecepatan di lembar ini sebanding dengan panjang tubuh: ikan sepuluh sentimeter dan ikan satu meter menghadapi arus yang sama sebagai dua dunia yang sama sekali berbeda, dan rancangan yang aman bagi yang besar dapat menjadi penghalang mutlak bagi yang kecil.",
  },
  en: {
    title: "Fish locomotion",
    sheetTitle: "Fish swimming performance — current velocity against endurance",
    dL: "Fish body length",
    dV: "Current velocity opposed",
    dSus: "Cruising speed",
    dBurst: "Burst speed",
    pKecil: "Small fish, culvert",
    pSedang: "Medium fish, fishway",
    pBesar: "Large fish, fast river",
    rTahan: "Time it can hold",
    rSus: "Cruising speed",
    rBurst: "Burst speed",
    rMaju: "Net ground speed at burst",
    rJarak: "Furthest distance it can cover",
    rMode: "Swimming mode in this current",
    mJelajah: "Cruising, no time limit",
    mLanjut: "Prolonged",
    mustahil: "Cruising speed is set above burst speed",
    mustahilNote:
      "Burst speed is by definition the speed a fish can hold for only twenty seconds, so it cannot be lower than the speed it can hold indefinitely. No fish is like this. The endurance curve on this sheet is drawn through those two points, and when they swap places the curve reverses so that endurance RISES with speed. Numbers coming out of that state describe nothing at all, which is why this sheet refuses to draw it. Lower the cruising speed below the burst speed.",
    mSentak: "Burst",
    mTidak: "Cannot make headway",
    tidak: "Cannot make headway",
    pt: "BL/s",
    bJelajah: "Cruising",
    bLanjut: "Prolonged",
    bSentak: "Burst (model boundary)",
    bTidak: "Cannot make headway",
    hU: "Current speed in body lengths",
    hAB: "Endurance curve constants from two points",
    hT: "Endurance",
    hV: "Cruising, burst and net ground speed",
    hL: "Distance in one burst",
    tak: "unlimited",
    hdlV: "Operating point: drag sideways to change the current velocity V",
    lTahan: "Holding station",
    lDorong: (v: string) => `Pushed back at ${v} m/s`,
    lKibas: "beats/s",
    lLuar: "f < 5/s: outside the Bainbridge range",
    lWaktu: (te: string, tahan: string, lelah: boolean) =>
      lelah ? `exhausted after ${tahan}, drifting` : `t ${te} s of ${tahan}`,
    gNyata: "Fish lane: real time. The fish swims through the water as fast as the current (holding station) or, when it cannot, at its burst speed; water speed, tail beat and endurance come from the sheet's calculation.",
    gLambat: (s: string, f: string) =>
      `Fish lane: motion slowed ×${s} so the ${f} per second tail beat is readable; the time written is still physical time. The fish swims through the water as fast as the current (holding station) or, when it cannot, at its burst speed.`,
    batasModel:
      "The boundary between prolonged and burst on this sheet is placed by the model halfway, at (Us + Ub)/2, whereas Beamish (1978) defines burst as lasting under 20 seconds. Inside that burst band the fish still holds for hundreds of seconds; a model correction has been proposed.",
    cekBaku:
      "The verification block below checks the curve with the default cruising and burst speeds (2 and 10 BL/s), not the slider values currently changed.",
    tidakNote:
      "The current velocity matches or exceeds this fish's burst speed, so the fish cannot advance at all however hard it swims. A structure with a current like this is an absolute barrier for fish of that size, and making it longer or shorter changes nothing. What must change is the velocity, not the length. Enlarge the wetted section, add bed roughness, or insert resting pools.",
    note:
      "One thing is most often misused from a sheet like this: the burst speed is not a design speed. It can be held for twenty seconds, after which the fish must rest for a long time before it can do so again. Designing a culvert with a current just below the burst speed means designing a structure that can be passed once by a fresh fish and not at all by a fish that has just passed the structure before it. That is why the distance shown here is computed at the burst speed over twenty seconds, and it is that number which sets the maximum culvert length or the spacing of resting pools in a fishway. Note too that every velocity on this sheet scales with body length: a ten-centimetre fish and a one-metre fish meet the same current as two entirely different worlds, and a design that is safe for the large one can be an absolute barrier for the small one.",
  },
} as const;

const REFS = {
  id: [
    "Beamish, F.W.H. (1978). Swimming capacity. Dalam Hoar & Randall (ed.), Fish Physiology vol. 7. Academic Press.",
    "Katopodis, C. & Gervais, R. (2016). Fish swimming performance database and analyses. DFO Canadian Science Advisory Secretariat 2016/002.",
    "FAO/DVWK (2002). Fish Passes: Design, Dimensions and Monitoring. FAO, Roma.",
    "Bell, M.C. (1991). Fisheries Handbook of Engineering Requirements and Biological Criteria. US Army Corps of Engineers.",
  ],
  en: [
    "Beamish, F.W.H. (1978). Swimming capacity. In Hoar & Randall (eds.), Fish Physiology vol. 7. Academic Press.",
    "Katopodis, C. & Gervais, R. (2016). Fish swimming performance database and analyses. DFO Canadian Science Advisory Secretariat 2016/002.",
    "FAO/DVWK (2002). Fish Passes: Design, Dimensions and Monitoring. FAO, Rome.",
    "Bell, M.C. (1991). Fisheries Handbook of Engineering Requirements and Biological Criteria. US Army Corps of Engineers.",
  ],
} as const;

/** Rentang V: satu definisi untuk penggeser dan pegangan di kurva. */
const P_V: ParamDef = { min: 0.02, max: 6, step: 0.02, digits: 2 };
/** Tinggi lajur ikan di atas kurva, px. Bidang kurva tetap setinggi semula. */
const TINGGI_LAJUR = 140;
const TINGGI_GRAFIK = "clamp(360px, 56vh, 620px)";

export function RenangIkanClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Lcm, setLcm] = useState(20);
  const [V, setV] = useState(0.8);
  const [susBL, setSusBL] = useState(SWIM_SUSTAINED_BL);
  const [burstBL, setBurstBL] = useState(SWIM_BURST_BL);

  const L = Lcm / 100;
  const r = fishSwim(L, V, susBL, burstBL);
  const tidak = r.mode === "tidak-mampu";

  const modeNama =
    r.mode === "jelajah"
      ? x.mJelajah
      : r.mode === "berkelanjutan"
        ? x.mLanjut
        : r.mode === "sentak"
          ? x.mSentak
          : x.mTidak;

  /* Ujung kanan sumbu selalu memuat V (penggeser sampai 6 m/s, sentak ikan
     kecil bisa < 0,1 m/s) dan dikunci selama pegangan diseret; tanpa kunci
     sumbu ikut melebar mengejar jari (pola BendungOgee). */
  const [kunci, setKunci] = useState<number | null>(null);
  const lepasKunci = () => setKunci(null);
  const vMaxBebas = Math.max(r.burst * 1.3, 0.2, V * 1.05);
  const vMax = kunci ?? vMaxBebas;
  const U = L > 0 ? V / L : 0;
  /* Tetapan kurva ln t = a − b U, sama persis dengan fishSwim; ditulis
     ulang hanya untuk baris Hitungan. */
  const bK =
    burstBL > susBL
      ? (Math.log(SWIM_SUSTAINED_TIME) - Math.log(SWIM_BURST_TIME)) / (burstBL - susBL)
      : 0;
  const aK = Math.log(SWIM_SUSTAINED_TIME) + bK * susBL;
  const batasTengah = (susBL + burstBL) / 2;
  const nada: Tone = r.impossible
    ? "invalid"
    : tidak
      ? "caution"
      : r.mode === "sentak"
        ? "critical"
        : r.mode === "berkelanjutan"
          ? "neutral"
          : "pass";
  const bawaan = susBL === SWIM_SUSTAINED_BL && burstBL === SWIM_BURST_BL;
  const mati = (v: string) => (r.impossible ? "—" : v);

  // Pemadam tanda contoh untuk pegangan seret (lihat SentuhContoh).
  const sentuh = useRef<() => void>(() => {});
  const { playing, toggle: togglePutar } = usePutar();
  const gerak = useRef<RenangGerak | null>(null);
  if (gerak.current === null) gerak.current = createRenangGerak();

  /* Lajur ikan: keadaan yang sama dengan titik di kurva (renangKeadaan
     membaca fishSwim). Pada keadaan mustahil tidak ada gerak. */
  const k = renangKeadaan(L, V, susBL, burstBL);
  const skala = renangSkalaWaktu(k);
  const teksWaktu = (te: number, tahan: number) =>
    x.lWaktu(
      fmt(Math.min(te, tahan), 0),
      Number.isFinite(tahan) ? `${fmt(tahan, 0)} s${k.gagal ? ` (${x.mSentak.toLowerCase()})` : ""}` : "∞",
      te > tahan
    );
  const labelLajur = {
    state: k.gagal ? x.lDorong(fmt(-k.maju, 2)) : x.lTahan,
    bl: x.pt,
    beat: x.lKibas,
    outOfRange: x.lLuar,
    impossible: x.mustahil,
  };
  const bergerak = playing && k.berlaku;
  const lajur = usePlate(
    (ctx, w, h) => drawRenangLajur(ctx, w, h, k, labelLajur, { ikanDiam: !bergerak, lang }),
    k.berlaku
      ? (ctx, w, h, tt, dt) => drawRenangGerak(ctx, w, h, tt, dt, k, gerak.current!, teksWaktu)
      : null,
    [Lcm, V, susBL, burstBL, lang, bergerak],
    { playing, timeScale: skala }
  );

  const grafik = usePlate(
    (ctx, w, h) => {
      const kurva: { x: number; y: number }[] = [];
      for (let i = 0; i <= 300; i++) {
        const vv = (vMax * i) / 300;
        const e = fishSwim(L, vv, susBL, burstBL).endurance;
        if (Number.isFinite(e) && e >= 1 && e <= 1e5) kurva.push({ x: vv, y: e });
      }

      const deret: ChartSeries[] = [
        {
          pts: kurva,
          color: C.water,
          weight: W.bold,
        },
      ];

      return drawChart(
        ctx,
        w,
        h,
        {
          xMin: 0,
          xMax: vMax,
          yMin: 1,
          yMax: 1e5,
          yLog: true,
          axisX: T.axSwimSpeed,
          axisY: T.axEndurance,
          series: deret,
          bands: [
            { axis: "x", from: 0, to: r.sustained, label: T.sustainedZone },
            { axis: "x", from: r.burst, to: vMax, label: T.unableZone },
          ],
          rules: [
            {
              axis: "y",
              at: SWIM_BURST_TIME,
              color: C.critical,
              dash: DASH.axis,
              label: `${fmtPlain(SWIM_BURST_TIME, 0)} s`,
              labelAlign: "left",
            },
          ],
          point: Number.isFinite(r.endurance)
            ? {
                x: V,
                y: r.endurance,
                label: `${fmtPlain(r.endurance, 0)} s`,
                invalid: r.impossible,
              }
            : undefined,
          /* Keadaan mustahil didahulukan: selama kecepatan jelajah disetel
             melampaui kecepatan sentak, seluruh angka lain di lembar ini
             tidak menggambarkan apa pun, jadi itulah yang perlu dibaca lebih
             dulu. */
          heading: r.impossible ? x.mustahil : tidak ? T.unableZone : undefined,
          headingColor: r.impossible ? C.signal : C.caution,
          /* Pegangan titik kerja. Ketahanan tak terbatas (jelajah) ditaruh
             di tepi atas sumbu, tempat kurva meninggalkan bidang. */
          anchors: r.impossible
            ? undefined
            : { kerja: { x: V, y: Math.min(1e5, Math.max(1, r.endurance)) } },
        },
        lang
      );
    },
    null,
    [Lcm, V, susBL, burstBL, lang, vMax]
  );

  /* Ketahanan adalah HASIL model pada V, jadi titik hanya diseret mendatar.
     Keadaan mustahil: tanpa pegangan. */
  const handles: HandleSpec[] = r.impossible
    ? []
    : [
        {
          id: "kerja",
          anchor: "kerja",
          axis: "x",
          label: x.hdlV,
          hollow: true,
          tint: C.water,
          param: P_V,
          value: V,
          toValue: (px, _py, m) => m.invX(px),
          onChange: setV,
          format: (v) => `V ${fmt(v, 2)} m/s`,
        },
      ];

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="U"
          value={r.impossible ? NaN : U}
          invalid={r.impossible}
          pesan={r.impossible ? x.mustahil : undefined}
          scale="log"
          digits={2}
          bands={
            r.impossible
              ? [{ from: 0.01, to: 300, label: x.mustahil, tone: "invalid" }]
              : [
                  { from: 0.01, to: susBL, label: x.bJelajah, tone: "pass" },
                  { from: susBL, to: batasTengah, label: x.bLanjut, tone: "neutral" },
                  { from: batasTengah, to: burstBL, label: x.bSentak, tone: "critical" },
                  { from: burstBL, to: 300, label: x.bTidak, tone: "caution" },
                ]
          }
        />
      }
      sheet="EH-04"
      subject={SUBJECTS.EH[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Ikan tidak punya satu kecepatan renang melainkan{" "}
            <Term tint={C.water}>tiga cara berenang</Term> yang berbeda umurnya:
            yang dapat dipertahankan selamanya, yang bertahan beberapa menit,
            dan yang hanya <Term tint={C.critical}>dua puluh detik</Term>.
          </p>
        ) : (
          <p>
            A fish has no single swimming speed but{" "}
            <Term tint={C.water}>three modes</Term> that differ in how long they
            last: one it can hold forever, one for minutes, and one for only{" "}
            <Term tint={C.critical}>twenty seconds</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="EH-04"
          title={x.sheetTitle}
          rev="A"
          height={`calc(${TINGGI_GRAFIK} + ${TINGGI_LAJUR + 1}px)`}
          cells={[
            { label: t.tbUnit, value: "SI (m, m/s, s)" },
            { label: "L", value: `${fmt(Lcm, 0)} cm` },
            { label: "V", value: `${fmt(V, 2)} m/s`, tint: C.water },
            {
              label: "t",
              value: r.impossible
                ? "—"
                : Number.isFinite(r.endurance)
                  ? `${fmt(r.endurance, 0)} s`
                  : "∞",
              tint: r.impossible ? C.signal : tidak ? C.caution : C.energy,
            },
            { label: "—", value: r.impossible ? "—" : modeNama },
          ]}
          motion={{
            playing,
            onToggle: togglePutar,
            allowed: lajur.motionAllowed,
            note: skala < 1 ? x.gLambat(fmt(skala, 2), fmt(k.kibas.frequency, 1)) : x.gNyata,
          }}
        >
          <div className="flex h-full flex-col">
            {/* Lajur ikan lebih dulu: kanvas kedua di figure adalah lapis
                geraknya (alat cek-gerak membaca figure canvas[1]). */}
            <div className="relative shrink-0" style={{ height: TINGGI_LAJUR }}>
              <canvas ref={lajur.ref} className="block h-full w-full" />
              <canvas ref={lajur.motionRef} />
            </div>
            <div className="h-px shrink-0 bg-rule" />
            <div className="relative min-h-0 flex-1">
              <canvas ref={grafik.ref} className="block h-full w-full" />
              {/* display: contents; hanya menangkap pointerdown/lepas dari
                  pegangan untuk mengunci sumbu. */}
              <div
                className="contents"
                onPointerDown={(e) => {
                  if (e.pointerType === "mouse" && e.button !== 0) return;
                  if (kunci !== null) return;
                  setKunci(vMaxBebas);
                }}
                onPointerUp={lepasKunci}
                onPointerCancel={lepasKunci}
                onLostPointerCapture={lepasKunci}
              >
                <DragLayer out={grafik.outRef.current} handles={handles} touch={() => sentuh.current()} />
              </div>
            </div>
          </div>
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <SentuhContoh sentuh={sentuh} />
            <InputTable>
              <InputRow symbol="L" label={x.dL} value={Lcm} min={2} max={150} step={1} digits={0} unit="cm" onChange={setLcm} />
              <InputRow symbol="V" label={x.dV} value={V} {...P_V} unit="m/s" onChange={setV} tint={C.water} />
              <InputRow symbol="Us" label={x.dSus} value={susBL} min={0.5} max={5} step={0.1} digits={1} unit={x.pt} onChange={setSusBL} />
              <InputRow symbol="Ub" label={x.dBurst} value={burstBL} min={4} max={20} step={0.5} digits={1} unit={x.pt} onChange={setBurstBL} tint={C.critical} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pKecil, apply: () => { setLcm(8); setV(0.4); setSusBL(2); setBurstBL(10); } },
                  { label: x.pSedang, apply: () => { setLcm(25); setV(1); setSusBL(2); setBurstBL(10); } },
                  { label: x.pBesar, apply: () => { setLcm(70); setV(2.5); setSusBL(2); setBurstBL(10); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                /* Pada keadaan mustahil, ketahanan dan jarak tidak
                   ditampilkan sama sekali. Menuliskan "tak terbatas" di
                   sebelah "tidak bisa maju" adalah tabel yang membantah
                   dirinya sendiri, dan itu lebih buruk daripada diam. */
                { symbol: "t", label: x.rTahan, value: r.impossible ? "—" : Number.isFinite(r.endurance) ? fmt(r.endurance, 1) : "∞", unit: !r.impossible && Number.isFinite(r.endurance) ? "s" : undefined, tint: r.impossible ? C.signal : tidak ? C.caution : C.energy, strong: true },
                { symbol: "Ls", label: x.rJarak, value: r.impossible ? "—" : fmt(r.distance, 2), unit: r.impossible ? undefined : "m", tint: r.impossible ? C.signal : tidak ? C.caution : C.water, strong: true },
                { symbol: "Us", label: x.rSus, value: fmt(r.sustained, 3), unit: "m/s" },
                { symbol: "Ub", label: x.rBurst, value: fmt(r.burst, 3), unit: "m/s", tint: C.critical },
                { symbol: "Vg", label: x.rMaju, value: mati(fmt(r.groundSpeed, 3)), unit: r.impossible ? undefined : "m/s", tint: !r.impossible && r.groundSpeed <= 0 ? C.caution : undefined },
                { symbol: "—", label: x.rMode, value: r.impossible ? "—" : modeNama },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hU,
                    rumus: (<><span>U =</span><Frac num="V" den="L" /></>),
                    isi: `${fmt(V, 2)} / ${fmt(L, 2)}`,
                    hasil: mati(fmt(U, 2)),
                    satuan: r.impossible ? undefined : x.pt,
                  },
                  {
                    judul: x.hAB,
                    rumus: (<><span>b =</span><Frac num={`ln ${fmtPlain(SWIM_SUSTAINED_TIME, 0)} − ln ${fmtPlain(SWIM_BURST_TIME, 0)}`} den="Ub − Us" /><span>;  a = ln {fmtPlain(SWIM_SUSTAINED_TIME, 0)} + b · Us</span></>),
                    isi: r.impossible
                      ? "—"
                      : `( ln ${fmtPlain(SWIM_SUSTAINED_TIME, 0)} − ln ${fmtPlain(SWIM_BURST_TIME, 0)} ) / ( ${fmt(burstBL, 1)} − ${fmt(susBL, 1)} ) = ${fmt(bK, 4)} ;  a = ${fmt(Math.log(SWIM_SUSTAINED_TIME), 4)} + ${fmt(bK, 4)} · ${fmt(susBL, 1)}`,
                    hasil: r.impossible ? "—" : `b ${fmt(bK, 4)} ; a ${fmt(aK, 3)}`,
                  },
                  {
                    judul: x.hT,
                    rumus: <span>t = exp( a − b · U )</span>,
                    isi: r.impossible
                      ? "—"
                      : Number.isFinite(r.endurance)
                        ? `exp( ${fmt(aK, 3)} − ${fmt(bK, 4)} · ${fmt(U, 3)} )`
                        : `U ${fmt(U, 2)} ≤ Us ${fmt(susBL, 1)}: ${x.tak}`,
                    hasil: r.impossible ? "—" : Number.isFinite(r.endurance) ? fmt(r.endurance, 1) : "∞",
                    satuan: !r.impossible && Number.isFinite(r.endurance) ? "s" : undefined,
                    tint: C.energy,
                  },
                  {
                    judul: x.hV,
                    rumus: <span>Us = {fmtPlain(susBL, 1)} · L ;  Ub = {fmtPlain(burstBL, 1)} · L ;  Vg = Ub − V</span>,
                    isi: r.impossible
                      ? "—"
                      : `${fmt(susBL, 1)} · ${fmt(L, 2)} = ${fmt(r.sustained, 3)} ;  ${fmt(burstBL, 1)} · ${fmt(L, 2)} = ${fmt(r.burst, 3)} ;  ${fmt(r.burst, 3)} − ${fmt(V, 2)}`,
                    hasil: mati(fmt(r.groundSpeed, 3)),
                    satuan: r.impossible ? undefined : "m/s",
                  },
                  {
                    judul: x.hL,
                    rumus: <span>Ls = {lang === "en" ? "max" : "maks"}( Vg, 0 ) · {fmtPlain(SWIM_BURST_TIME, 0)} s</span>,
                    isi: r.impossible ? "—" : `${lang === "en" ? "max" : "maks"}( ${fmt(r.groundSpeed, 3)}, 0 ) · ${fmt(SWIM_BURST_TIME, 0)}`,
                    hasil: mati(fmt(r.distance, 2)),
                    satuan: r.impossible ? undefined : "m",
                    tint: C.water,
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={nada}
            badge={r.impossible ? x.mustahil : modeNama}
            {...notice(L, V, U, r, tidak, susBL, burstBL, bawaan, lang)}
          />
        </>
      }
      verification={<Verification checks={checksSwim(L, V)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>ln t = a − b U</span>
                <span className="ml-5">U =</span>
                <Frac num="V" den="L" />
                <span className="ml-3 text-ink-3">
                  {lang === "id"
                    ? "panjang tubuh per detik"
                    : "body lengths per second"}
                </span>
              </Eq>
              <Eq>
                <span>Us = {fmtPlain(susBL, 1)} L</span>
                <span className="ml-5">Ub = {fmtPlain(burstBL, 1)} L</span>
                <span className="ml-5">
                  Ls = (Ub − V) · {fmtPlain(SWIM_BURST_TIME, 0)} s
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

function notice(
  L: number,
  V: number,
  U: number,
  r: ReturnType<typeof fishSwim>,
  tidak: boolean,
  susBL: number,
  burstBL: number,
  bawaan: boolean,
  lang: Lang
): { state: string; notice: string[] } {
  const x = TXT[lang];
  const en = lang === "en";

  /* Keadaan mustahil: hanya mengulang alasannya. Angka jarak atau
     ketahanan dari kurva yang terbalik tidak menggambarkan apa pun. */
  if (r.impossible) return { state: x.mustahilNote, notice: [] };

  const modeNama =
    r.mode === "jelajah" ? x.mJelajah : r.mode === "berkelanjutan" ? x.mLanjut : r.mode === "sentak" ? x.mSentak : x.mTidak;
  const tahan = Number.isFinite(r.endurance) ? `${fmt(r.endurance, 0)} s` : "∞";
  const state = en
    ? `U = ${fmt(U, 2)} BL/s: ${modeNama.toLowerCase()}; holds ${tahan}, burst distance ${fmt(r.distance, 1)} m.`
    : `U = ${fmt(U, 2)} PT/dtk: ${modeNama.toLowerCase()}; bertahan ${tahan}, jarak sentak ${fmt(r.distance, 1)} m.`;

  const butir: string[] = [];
  if (tidak) {
    butir.push(x.tidakNote);
    butir.push(
      en
        ? "t = how long the fish can hold station at V; the lane shows the fish at its burst speed, lasting 20 s."
        : "t = lama menahan diri pada V; lajur menampilkan ikan pada kecepatan sentak, bertahan 20 s."
    );
    butir.push(
      en
        ? `A current of ${fmt(V, 2)} m/s already matches or exceeds the burst speed of ${fmt(r.burst, 2)} m/s. Reduce the current, or take a larger fish, and watch the distance in the table change from zero to something meaningful.`
        : `Arus ${fmt(V, 2)} m/s sudah menyamai atau melampaui kecepatan sentak ${fmt(r.burst, 2)} m/s. Perkecil arusnya, atau perbesar ikannya, lalu perhatikan jarak tempuh di tabel berubah dari nol menjadi angka yang berarti.`
    );
  } else {
    const separuh = fishSwim(L / 2, V, susBL, burstBL);
    butir.push(
      en
        ? `This fish can cover ${fmt(r.distance, 1)} m against this current in one burst, which is the longest culvert it can pass without a rest.`
        : `Ikan ini sanggup menempuh ${fmt(r.distance, 1)} m melawan arus ini dalam satu sentakan, dan itulah gorong-gorong terpanjang yang dapat dilewatinya tanpa beristirahat.`
    );
    butir.push(
      en
        ? `Halve the body length, keeping everything else, and that distance becomes ${fmt(separuh.distance, 1)} m: the design is then ${separuh.distance <= 0 ? "impassable" : `${fmt(r.distance / Math.max(separuh.distance, 1e-9), 1)} times too long`}.`
        : `Kecilkan panjang tubuhnya menjadi separuh, dengan segala hal lain tetap, dan jaraknya menjadi ${fmt(separuh.distance, 1)} m: rancangan yang sama ${separuh.distance <= 0 ? "tidak dapat dilewati sama sekali" : `${fmt(r.distance / Math.max(separuh.distance, 1e-9), 1)} kali terlalu panjang`}.`
    );
  }
  if (r.mode === "sentak") butir.push(x.batasModel);
  butir.push(
    en
      ? "Fish-passage criteria are written for the weakest species expected, not the most prominent one."
      : "Kriteria lintasan ikan ditulis untuk jenis terlemah yang diperkirakan ada, bukan untuk jenis yang paling menonjol."
  );
  if (!bawaan) butir.push(x.cekBaku);
  return { state, notice: butir };
}
