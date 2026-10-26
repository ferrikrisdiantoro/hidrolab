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
  Sheet,
  StateCard,
  Term,
  SentuhContoh,
} from "@/components/ui";
import { DragLayer, type HandleSpec } from "@/components/DragLayer";
import { usePlate } from "@/lib/usePlate";
import type { ParamDef } from "@/lib/rentang";
import {
  drawStructure,
  type StructureDim,
  type StructureLine,
} from "@/lib/drawStructure";
import { ATM_HEAD, G, ductEnergy, fmt, fmtPlain, vapourHead } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksDuct } from "@/lib/checks";

const L = 60;

/** Tinggi tekan uap pada suhu yang dipakai ductEnergy (15 °C), sekitar 0,173 m. */
const UAP = vapourHead(15);

const TXT = {
  id: {
    title: "Bernoulli",
    sheetTitle: "Pertukaran tiga tinggi tekan di sepanjang saluran tanpa gesekan",
    dQ: "Debit",
    dH: "Tinggi energi di hulu",
    dD1: "Diameter di hulu",
    dD2: "Diameter di leher",
    dZ: "Kenaikan sumbu pipa di leher",
    pDatar: "Pipa datar, leher menyempit",
    pNaik: "Pipa naik enam meter",
    pKavitasi: "Leher terlalu tinggi, air mendidih",
    gH: "Tinggi energi H, seret garis energi naik atau turun",
    gZ: "Elevasi leher Δz, seret leher pipa naik atau turun",
    rV: "Kecepatan di leher",
    rHv: "Tinggi kecepatan di leher",
    rHp: "Tinggi tekan di leher",
    rAbs: "Tekanan mutlak di leher",
    rHmin: "Tinggi tekan terendah",
    rEgl: "Tinggi energi di hilir",
    aman: "Di atas atmosfer",
    subAtm: "Di bawah atmosfer",
    kavitasiBadge: "Kavitasi, air mendidih",
    bandKav: "Kavitasi, air mendidih",
    bandSub: "Di bawah atmosfer",
    bandAtas: "Di atas atmosfer",
    hulu: "di hulu",
    leher: "di leher",
    hilir: "di hilir",
    diX: (x: string) => `pada x = ${x} m`,
    kavitasi: (di: string) => `Air mendidih ${di}`,
    kavitasiNote:
      "Begitu tekanan mutlak turun ke tekanan uap, air mendidih pada suhu ruang. Gelembungnya pecah lagi di tempat tekanannya pulih, dan tumbukannya cukup keras untuk mengelupas baja. Kavitasi tidak pernah diterima sebagai keadaan kerja.",
    huluMustahil: (hv: string, H: string) =>
      `Keadaan hulunya sendiri mustahil: tinggi energi hulu ${H} m lebih kecil daripada tinggi kecepatannya ${hv} m, jadi tidak ada tekanan yang tersisa di sana.`,
    melebar: "D₂ lebih besar dari D₁: penampang tengah melebar, bukan leher. Kecepatannya turun di situ dan tekanannya naik.",
    sAman: (p: string, a: string, hv: string) =>
      `Tekanan di leher p/γ = ${p} m (mutlak ${a} m), V²/2g = ${hv} m. Tekanan di sepanjang saluran masih di atas atmosfer.`,
    sSub: (p: string, a: string, hv: string, di: string) =>
      `Tekanan di leher p/γ = ${p} m (mutlak ${a} m), V²/2g = ${hv} m. Tekanan terendah ${di} di bawah atmosfer, tetapi masih di atas tekanan uap.`,
    sKav: (di: string, uap: string, hv: string) =>
      `Tekanan mutlak ${di} turun sampai tekanan uap (${uap} m): air mendidih dan persamaan Bernoulli tidak berlaku lagi. V²/2g di leher = ${hv} m.`,
    nNaik: (a: string, b: string) =>
      `Naikkan sumbu leher 1 m: p/γ turun dari ${a} ke ${b} m, tepat 1 m, sementara garis energinya tetap.`,
    nNaikKav: (a: string) =>
      `Naikkan sumbu leher 1 m: p/γ ${a} m turun 1 m lagi dan tekanan mutlaknya jatuh ke tekanan uap. Air mulai mendidih.`,
    nSempit: (a: string, b: string) =>
      `Separuhkan D₂: V²/2g naik dari ${a} ke ${b} m, enam belas kali, karena tinggi kecepatan mengikuti pangkat empat kebalikan diameter. Tinggi tekannya yang membayar.`,
    nSempitKav: (a: string, b: string) =>
      `Separuhkan D₂: V²/2g naik dari ${a} ke ${b} m, enam belas kali, dan tekanan di leher jatuh ke tekanan uap. Air mendidih.`,
    jV: "Kecepatan di leher",
    jHv: "Tinggi kecepatan di leher",
    jHp: "Tinggi tekan di leher",
    jAbs: "Tekanan mutlak di leher, dibandingkan tekanan uap",
    jEgl: "Tinggi energi di hilir, tanpa gesekan",
    note:
      "Yang paling berguna dilihat pada lembar ini bukan rumusnya melainkan pertukarannya. Tinggi energi seluruhnya tidak berubah sedikit pun di sepanjang saluran ini, dan yang berubah hanya pembagiannya ke tiga suku. Naikkan sumbu pipanya satu meter dan tinggi tekannya turun tepat satu meter, ditukar satu lawan satu, sementara garis energinya tidak bergerak. Sempitkan lehernya dan tinggi kecepatannya naik menurut pangkat empat kebalikan diameternya, sedangkan tinggi tekannya turun sebanyak itu juga. Dua hal yang mengikutinya langsung. Pertama, pipa yang naik terlalu tinggi kehabisan tekanan, bukan kehabisan tenaga, dan batasnya sepuluh koma tiga meter di atas garis energinya karena itulah seluruh tinggi tekan atmosfer. Kedua, leher yang terlalu sempit dapat menurunkan tekanan sampai di bawah tekanan uap meskipun tenaganya berlimpah. Keduanya kegagalan tekanan pada aliran yang tenaganya sama sekali tidak kurang, dan keduanya tidak akan pernah terlihat oleh orang yang hanya memeriksa neraca tenaganya.",
  },
  en: {
    title: "Bernoulli",
    sheetTitle: "The exchange of three heads along a frictionless duct",
    dQ: "Discharge",
    dH: "Total head upstream",
    dD1: "Diameter upstream",
    dD2: "Diameter at the throat",
    dZ: "Rise of the pipe axis at the throat",
    pDatar: "Level pipe, narrowed throat",
    pNaik: "Pipe raised six metres",
    pKavitasi: "Throat too high, the water boils",
    gH: "Total head H, drag the energy line up or down",
    gZ: "Throat elevation Δz, drag the throat of the duct up or down",
    rV: "Velocity at the throat",
    rHv: "Velocity head at the throat",
    rHp: "Pressure head at the throat",
    rAbs: "Absolute pressure at the throat",
    rHmin: "Lowest pressure head",
    rEgl: "Total head downstream",
    aman: "Above atmospheric",
    subAtm: "Below atmospheric",
    kavitasiBadge: "Cavitation, the water boils",
    bandKav: "Cavitation, the water boils",
    bandSub: "Below atmospheric",
    bandAtas: "Above atmospheric",
    hulu: "upstream",
    leher: "at the throat",
    hilir: "downstream",
    diX: (x: string) => `at x = ${x} m`,
    kavitasi: (di: string) => `The water boils ${di}`,
    kavitasiNote:
      "Once the absolute pressure falls to vapour pressure, water boils at room temperature. The bubbles collapse again where the pressure recovers, and the impact is hard enough to strip steel. Cavitation is never accepted as a working condition.",
    huluMustahil: (hv: string, H: string) =>
      `The upstream state is itself impossible: the upstream total head ${H} m is smaller than its velocity head ${hv} m, so no pressure is left there.`,
    melebar: "D₂ is larger than D₁: the middle section widens, it is not a throat. The velocity drops there and the pressure rises.",
    sAman: (p: string, a: string, hv: string) =>
      `Pressure at the throat p/γ = ${p} m (absolute ${a} m), V²/2g = ${hv} m. The pressure stays above atmospheric along the whole duct.`,
    sSub: (p: string, a: string, hv: string, di: string) =>
      `Pressure at the throat p/γ = ${p} m (absolute ${a} m), V²/2g = ${hv} m. The lowest pressure, ${di}, is below atmospheric but still above vapour pressure.`,
    sKav: (di: string, uap: string, hv: string) =>
      `The absolute pressure ${di} falls to vapour pressure (${uap} m): the water boils and Bernoulli's equation no longer holds. V²/2g at the throat = ${hv} m.`,
    nNaik: (a: string, b: string) =>
      `Raise the throat axis 1 m: p/γ falls from ${a} to ${b} m, exactly 1 m, while the energy line stays put.`,
    nNaikKav: (a: string) =>
      `Raise the throat axis 1 m: p/γ ${a} m falls another metre and the absolute pressure drops to vapour pressure. The water starts to boil.`,
    nSempit: (a: string, b: string) =>
      `Halve D₂: V²/2g rises from ${a} to ${b} m, sixteen times, because velocity head follows the fourth power of the inverse diameter. The pressure head pays for it.`,
    nSempitKav: (a: string, b: string) =>
      `Halve D₂: V²/2g rises from ${a} to ${b} m, sixteen times, and the throat pressure drops to vapour pressure. The water boils.`,
    jV: "Velocity at the throat",
    jHv: "Velocity head at the throat",
    jHp: "Pressure head at the throat",
    jAbs: "Absolute pressure at the throat, against vapour pressure",
    jEgl: "Total head downstream, without friction",
    note:
      "What is worth watching on this sheet is not the formula but the exchange. The total head does not change at all along this duct, and all that changes is how it divides between the three terms. Raise the pipe axis by a metre and the pressure head falls by exactly a metre, one for one, while the energy line does not move. Narrow the throat and the velocity head rises with the fourth power of the inverse diameter, while the pressure head falls by just as much. Two things follow at once. First, a pipe raised too high runs out of pressure, not out of energy, and the limit is 10.3 metres above its energy line because that is the whole of atmospheric head. Second, a throat made too narrow can drop the pressure below vapour pressure even while energy is abundant. Both are pressure failures in a flow whose energy is in no way short, and neither will ever be seen by someone who only checks the energy balance.",
  },
} as const;

const REFS = {
  id: [
    "Bernoulli, D. (1738). Hydrodynamica, sive de viribus et motibus fluidorum commentarii.",
    "Euler, L. (1757). Principes généraux du mouvement des fluides.",
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, edisi ke-8, bab 3.",
    "Knapp, R.T., Daily, J.W. & Hammitt, F.G. (1970). Cavitation.",
  ],
  en: [
    "Bernoulli, D. (1738). Hydrodynamica, sive de viribus et motibus fluidorum commentarii.",
    "Euler, L. (1757). Principes généraux du mouvement des fluides.",
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, 8th ed., ch. 3.",
    "Knapp, R.T., Daily, J.W. & Hammitt, F.G. (1970). Cavitation.",
  ],
} as const;

/*
 * Rentang H dan Δz: satu definisi untuk penggeser, kotak angka, dan pegangan
 * seret di gambar (aturan 4, satu sumber nilai).
 */
const P_H: ParamDef = { min: 2, max: 40, step: 0.5, digits: 1 };
const P_DZ: ParamDef = { min: -8, max: 25, step: 0.5, digits: 1 };

export function BernoulliClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Q, setQ] = useState(0.15);
  const [H, setH] = useState(20);
  const [D1, setD1] = useState(0.4);
  const [D2, setD2] = useState(0.18);
  const [dz, setDz] = useState(0);

  /* Saluran yang mengerucut ke leher di tengah lalu melebar kembali. */
  const stations = [
    { x: 0, z: 0, D: D1 },
    { x: L * 0.3, z: dz * 0.6, D: (D1 + D2) / 2 },
    { x: L * 0.5, z: dz, D: D2 },
    { x: L * 0.7, z: dz * 0.6, D: (D1 + D2) / 2 },
    { x: L, z: 0, D: D1 },
  ];
  const r = ductEnergy(Q, stations, H, 0);
  const leher = r.points[2];
  /* Tempat tekanan terendah, dari model. Kavitasi tidak selalu di leher:
     pada D₂ > D₁ atau keadaan hulu yang mustahil, tekanan terendahnya ada
     di ruas masuk (Q 600 l/s, D₁ 100 mm: x = 0). */
  const tempat =
    r.minPressureAt <= 0
      ? x.hulu
      : Math.abs(r.minPressureAt - L * 0.5) < 1e-9
        ? x.leher
        : r.minPressureAt >= L
          ? x.hilir
          : x.diX(fmt(r.minPressureAt, 0));
  const hulu = r.points[0];
  const huluMustahil = hulu.velocityHead > H;

  const sentuh = useRef<() => void>(() => {});
  /*
   * Ujung sumbu tegak dikunci selama pegangan diseret. Tanpa kunci, ujung
   * atasnya mengikuti H dan Δz, dan ujung bawahnya mengikuti tinggi tekan
   * terendah (yang turun bila H turun atau leher naik): tiap piksel geseran
   * mengubah skala tegak, titik di bawah jari berganti nilai, dan pegangan
   * saling kejar dengan sumbunya. Sumbu mendatar tetap −3 sampai L + 3.
   * Dilepas = sumbu kembali dihitung dari nilainya.
   */
  const [kunci, setKunci] = useState<{ zMin: number; zMax: number } | null>(null);
  const sumbuRef = useRef<{ zMin: number; zMax: number } | null>(null);

  const plate = usePlate(
    (ctx, w, ch) => {
      /*
       * Batas bidang dihitung lebih dulu, karena tebal pipa yang digambar
       * bergantung padanya. Batas atasnya memuat elevasi LEHER juga, bukan
       * hanya garis energinya: pada leher yang dinaikkan dua puluh lima
       * meter, pipanya menembus bingkai atas bersama nama dan ukurannya.
       */
      const zMin = Math.min(0, r.minPressureHead + leher.z, dz, -2);
      const zAtasAsli = Math.max(H, r.points[0].egl, dz);
      const rentang = Math.max(zAtasAsli - zMin, 1);

      /*
       * Diameter pipa DILEBIHKAN pada gambarnya, dan besarnya
       * pelebihan ditulis di nama dindingnya.
       *
       * Pipa empat puluh sentimeter pada sumbu setinggi dua puluh dua meter
       * tinggal dua garis rambut di dasar bidang, dan lehernya, yaitu pokok
       * lembar ini, sama sekali tidak terlihat menyempit. Diagram garis
       * energi di buku ajar pun menggambar pipanya dilebihkan dengan alasan
       * yang sama. Yang dilebihkan hanya tebal pipanya; seluruh tinggi tekan
       * tetap digambar pada skala yang sebenarnya.
       */
      const lebih = Math.max(1, Math.round((rentang * 0.07) / Math.max(D1, D2)));
      const zMax = (zAtasAsli + (lebih * Math.max(D1, D2)) / 2) * 1.14 + 1;
      sumbuRef.current = { zMin, zMax };
      /* Selama dikunci, garis ukur dipotong ke sumbu supaya tidak menembus
         bingkai; teksnya tetap nilai sebenarnya. Tanpa kunci tidak berubah. */
      const potongZ = (z: number) =>
        kunci ? Math.min(Math.max(z, kunci.zMin), kunci.zMax) : z;
      const atas = r.points.map((p) => ({ x: p.x, z: p.z + (lebih * p.D) / 2 }));
      const bawah = r.points.map((p) => ({ x: p.x, z: p.z - (lebih * p.D) / 2 }));

      const garis: StructureLine[] = [
        {
          pts: r.points.map((p) => ({ x: p.x, z: p.egl })),
          color: C.energy,
          weight: W.bold,
          dash: DASH.solid,
          label: T.energyGrade,
          labelAt: 0.18,
          labelDy: -10,
          labelAlign: "left",
        },
        {
          pts: r.points.map((p) => ({ x: p.x, z: p.hgl })),
          color: C.water,
          weight: W.bold,
          dash: DASH.hidden,
          label: T.hydraulicGrade,
          labelAt: 1,
          labelDy: 16,
          labelAlign: "right",
        },
        {
          pts: [
            { x: 0, z: 0 },
            { x: L, z: 0 },
          ],
          color: C.ink3,
          weight: W.hair,
          dash: DASH.axis,
          label: T.datumLine,
          labelAt: 0.06,
          labelDy: 12,
          labelAlign: "left",
        },
        { pts: atas, color: C.ink, weight: W.bold, dash: DASH.solid },
        { pts: bawah, color: C.ink, weight: W.bold, dash: DASH.solid },
      ];

      /* Ketiga tinggi tekan di leher, sebagai tiga ukuran yang bertumpuk */
      const dims: StructureDim[] = [
        {
          axis: "v",
          at: L * 0.5,
          from: potongZ(leher.hgl),
          to: potongZ(leher.egl),
          text: `${fmtPlain(leher.velocityHead, 2)} m`,
          color: C.energy,
          offset: 30,
        },
        /* Tinggi tekan di leher tidak diukur bila airnya mendidih: angka
           di bawah tekanan uap itu hanya tuntutan hitungan, tidak terjadi. */
        ...(r.cavitates
          ? []
          : [
              {
                axis: "v" as const,
                at: L * 0.5,
                from: potongZ(leher.z),
                to: potongZ(leher.hgl),
                text: `${fmtPlain(leher.pressureHead, 2)} m`,
                color: C.water,
                offset: 58,
              },
            ]),
        /* Ukuran sepanjang nol tidak mengukur apa pun, dan pada pipa datar
           ia hanya menjadi tulisan "0,00 m" yang tergantung di dasar. */
        ...(Math.abs(leher.z) > 0.05
          ? [
              {
                axis: "v" as const,
                at: L * 0.5,
                from: potongZ(0),
                to: potongZ(leher.z),
                text: `${fmtPlain(leher.z, 2)} m`,
                offset: 86,
              },
            ]
          : []),
      ];

      return drawStructure(
        ctx,
        w,
        ch,
        {
          xMin: -3,
          xMax: L + 3,
          zMin: kunci ? kunci.zMin : zMin,
          zMax: kunci ? kunci.zMax : zMax,
          equalScale: false,
          bodies: [],
          lines: garis,
          dims,
          callouts: [
            /*
             * Menunjuk dinding atas di ruas masuk, ke ATAS. Dulu menunjuk
             * dinding bawah leher ke bawah: pada pipa datar tulisannya jatuh
             * ke angka sumbu di bawah bingkai, dan pada leher yang tinggi ia
             * menabrak nama garis energi.
             */
            {
              x: (atas[0].x + atas[1].x) / 2,
              z: (atas[0].z + atas[1].z) / 2,
              dx: 14,
              dy: -26,
              text:
                lebih > 1
                  ? `${T.ductWall} · ${lang === "id" ? "tebal" : "width"} ×${lebih}`
                  : T.ductWall,
            },
          ],
          heading: r.cavitates ? x.kavitasi(tempat) : undefined,
          headingColor: C.signal,
          axisX: T.axAlongDuct,
          axisZ: T.axHeadM,
          /*
           * Tempat pegangan, tidak digambar: garis energi di ruas keluar
           * (jauh dari namanya di 18 % panjang), dan sumbu pipa di leher.
           */
          anchors: {
            energi: { x: L * 0.86, z: H },
            leher: { x: L * 0.5, z: dz },
          },
        },
        lang
      );
    },
    null,
    [Q, H, D1, D2, dz, lang, kunci ? kunci.zMin : NaN, kunci ? kunci.zMax : NaN]
  );

  /*
   * Pemetaan balik, keduanya hanya tegak (sumbu tegak = tinggi dalam m di
   * atas datum):
   * - energi: H adalah tinggi energi total di hulu, dan tanpa kehilangan
   *   garis energinya mendatar pada z = H, jadi H = z jari.
   * - leher: sumbu pipa di leher berada pada elevasi Δz, jadi Δz = z jari.
   */
  const handles: HandleSpec[] = [
    {
      id: "energi",
      anchor: "energi",
      axis: "y",
      label: x.gH,
      tint: C.energy,
      param: P_H,
      value: H,
      toValue: (_px, py, m) => m.invY(py),
      onChange: setH,
      format: (v) => `H ${fmt(v, 1)} m`,
    },
    {
      id: "leher",
      anchor: "leher",
      axis: "y",
      label: x.gZ,
      param: P_DZ,
      value: dz,
      toValue: (_px, py, m) => m.invY(py),
      onChange: setDz,
      format: (v) => `Δz ${fmt(v, 1)} m`,
    },
  ];
  const lepasKunci = () => setKunci(null);

  return (
    <LabShell
      status={
        /* Tekanan mutlak TERENDAH di sepanjang saluran, bukan tekanan leher:
           kavitasi diputuskan di tempat tekanannya paling rendah, yang bisa
           di ruas masuk. Batas dari ductEnergy: cavitates = pabs ≤ tekanan
           uap (Antoine, 15 °C), subAtmospheric = p/γ < 0. Rentang hitung
           −11 561 m sampai 58,33 m, jadi luapan kiri memang terjadi. */
        <RegimeScale
          symbol="pabs,min/γ"
          value={r.minPressureHead + ATM_HEAD}
          invalid={r.cavitates}
          pesan={r.cavitates ? x.kavitasi(tempat) : undefined}
          digits={2}
          bands={[
            { from: -10, to: UAP, label: x.bandKav, tone: "invalid" },
            { from: UAP, to: ATM_HEAD, label: x.bandSub, tone: "caution" },
            { from: ATM_HEAD, to: 60, label: x.bandAtas, tone: "water" },
          ]}
        />
      }
      sheet="FF-01"
      subject={SUBJECTS.FF[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Tinggi energi seluruhnya <Term tint={C.energy}>tidak berubah</Term>{" "}
            di sepanjang saluran ini. Yang berubah hanya{" "}
            <Term tint={C.water}>pembagiannya</Term>: satu meter elevasi
            ditukar tepat satu meter tinggi tekan.
          </p>
        ) : (
          <p>
            The total head <Term tint={C.energy}>does not change</Term> along
            this duct. All that changes is{" "}
            <Term tint={C.water}>how it divides</Term>: a metre of elevation is
            traded for exactly a metre of pressure head.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FF-01"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "H", value: `${fmt(H, 2)} m`, tint: C.energy },
            { label: "V", value: `${fmt(leher.velocity, 2)} m/s` },
            { label: "p/γ", value: r.cavitates ? "—" : `${fmt(leher.pressureHead, 2)} m`, tint: r.cavitates ? C.signal : C.water },
            { label: "V²/2g", value: `${fmt(leher.velocityHead, 2)} m` },
          ]}
        >
          <canvas ref={plate.ref} className="block h-full w-full" />
          {/* display: contents, jadi pembungkus tidak membuat kotak; hanya
              menangkap pointerdown/lepas yang menggelembung dari pegangan
              untuk mengunci sumbu. */}
          <div
            className="contents"
            onPointerDown={(e) => {
              // Hanya tombol utama: DragLayer mengabaikan klik lain, jadi tanpa
              // capture tidak ada pelepas dan kunci akan tertinggal.
              if (e.pointerType === "mouse" && e.button !== 0) return;
              if (sumbuRef.current) setKunci(sumbuRef.current);
            }}
            onPointerUp={lepasKunci}
            onPointerCancel={lepasKunci}
            onLostPointerCapture={lepasKunci}
          >
            <DragLayer out={plate.outRef.current} handles={handles} touch={() => sentuh.current()} />
          </div>
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q * 1000} min={5} max={600} step={5} digits={0} unit="l/s" onChange={(v) => setQ(v / 1000)} tint={C.water} />
              <InputRow symbol="H" label={x.dH} value={H} {...P_H} unit="m" onChange={setH} tint={C.energy} />
              <InputRow symbol="D₁" label={x.dD1} value={D1 * 1000} min={100} max={800} step={10} digits={0} unit="mm" onChange={(v) => setD1(v / 1000)} />
              <InputRow symbol="D₂" label={x.dD2} value={D2 * 1000} min={40} max={800} step={10} digits={0} unit="mm" onChange={(v) => setD2(v / 1000)} tint={C.critical} />
              <InputRow symbol="Δz" label={x.dZ} value={dz} {...P_DZ} unit="m" onChange={setDz} />
            </InputTable>

            <SentuhContoh sentuh={sentuh} />
            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pDatar, apply: () => { setQ(0.15); setH(20); setD1(0.4); setD2(0.18); setDz(0); } },
                  { label: x.pNaik, apply: () => { setQ(0.15); setH(20); setD1(0.4); setD2(0.18); setDz(6); } },
                  /* Leher dinaikkan DAN disempitkan. Menaikkannya saja sampai batas
                     penggeser, dua puluh lima meter, masih menyisakan tekanan mutlak
                     tiga setengah meter, jauh di atas tekanan uap, sehingga tombol
                     bernama "air mendidih" menyalakan penanda "masih di atas tekanan
                     uap". */
                  { label: x.pKavitasi, apply: () => { setQ(0.15); setH(20); setD1(0.4); setD2(0.13); setDz(25); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "V", label: x.rV, value: fmt(leher.velocity, 3), unit: "m/s" },
                { symbol: "V²/2g", label: x.rHv, value: fmt(leher.velocityHead, 3), unit: "m", tint: C.energy, strong: true },
                { symbol: "p/γ", label: x.rHp, value: r.cavitates ? "—" : fmt(leher.pressureHead, 3), unit: r.cavitates ? undefined : "m", tint: r.cavitates ? C.signal : C.water, strong: true },
                /* Tekanan mutlak tidak dapat turun di bawah tekanan uap: di situ airnya
                   mendidih dan tekanannya tertahan. Angka negatif yang dihasilkan
                   persamaannya bukan tekanan melainkan tanda bahwa persamaannya
                   sudah tidak berlaku. Besaran inilah yang memutuskan kavitasi,
                   jadi ditulis besar. */
                { symbol: "pabs", label: x.rAbs, value: r.cavitates ? "—" : fmt(leher.absoluteHead, 3), unit: r.cavitates ? undefined : "m", tint: r.cavitates ? C.signal : undefined, strong: true },
                { symbol: "min", label: `${x.rHmin} (${tempat})`, value: r.cavitates ? "—" : fmt(r.minPressureHead, 3), unit: r.cavitates ? undefined : "m", tint: r.cavitates ? C.signal : undefined },
                { symbol: "H", label: x.rEgl, value: fmt(r.points[r.points.length - 1].egl, 4), unit: "m", tint: C.energy },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.jV,
                    rumus: (<><span>V =</span><Frac num="Q" den="π · D₂² / 4" /></>),
                    isi: `${fmt(Q, 3)} / ( π · ${fmt(D2, 2)}² / 4 )`,
                    hasil: fmt(leher.velocity, 3),
                    satuan: "m/s",
                  },
                  {
                    judul: x.jHv,
                    rumus: (<><span>V²/2g =</span><Frac num="V²" den="2 · g" /></>),
                    isi: `${fmt(leher.velocity, 4)}² / ( 2 · ${fmt(G, 2)} )`,
                    hasil: fmt(leher.velocityHead, 3),
                    satuan: "m",
                    tint: C.energy,
                  },
                  {
                    judul: x.jHp,
                    rumus: <span>p/γ = H − Δz − V²/2g</span>,
                    isi: r.cavitates ? "—" : `${fmt(H, 1)} − ${kurung(dz, 1)} − ${fmt(leher.velocityHead, 4)}`,
                    hasil: r.cavitates ? "—" : fmt(leher.pressureHead, 3),
                    satuan: r.cavitates ? undefined : "m",
                    tint: r.cavitates ? C.signal : C.water,
                  },
                  {
                    judul: `${x.jAbs} ${fmt(UAP, 3)} m`,
                    rumus: <span>pabs/γ = p/γ + {fmt(ATM_HEAD, 2)}</span>,
                    isi: r.cavitates ? "—" : `${fmt(leher.pressureHead, 4)} + ${fmt(ATM_HEAD, 2)}`,
                    hasil: r.cavitates ? "—" : fmt(leher.absoluteHead, 3),
                    satuan: r.cavitates ? undefined : "m",
                    tint: r.cavitates ? C.signal : undefined,
                  },
                  {
                    judul: x.jEgl,
                    rumus: <span>H hilir = H</span>,
                    isi: fmt(H, 1),
                    hasil: fmt(r.points[r.points.length - 1].egl, 4),
                    satuan: "m",
                    tint: C.energy,
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={r.cavitates ? "invalid" : r.subAtmospheric ? "caution" : "water"}
            badge={r.cavitates ? x.kavitasiBadge : r.subAtmospheric ? x.subAtm : x.aman}
            state={
              r.cavitates
                ? x.sKav(tempat, fmt(UAP, 3), fmt(leher.velocityHead, 2))
                : r.subAtmospheric
                  ? x.sSub(fmt(leher.pressureHead, 2), fmt(leher.absoluteHead, 2), fmt(leher.velocityHead, 2), tempat)
                  : x.sAman(fmt(leher.pressureHead, 2), fmt(leher.absoluteHead, 2), fmt(leher.velocityHead, 2))
            }
            notice={[
              ...(r.cavitates
                ? [
                    huluMustahil ? x.huluMustahil(fmt(hulu.velocityHead, 2), fmt(H, 1)) : null,
                    x.kavitasiNote,
                  ]
                : notice(Q, H, D1, D2, dz, lang)),
              D2 > D1 ? x.melebar : null,
            ]}
          />
        </>
      }
      verification={<Verification checks={checksDuct(Q, stations, H, 0)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>z +</span>
                <Frac num="p" den="γ" />
                <span>+</span>
                <Frac num="V²" den="2g" />
                <span>= H</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id" ? "tetap di sepanjang salurannya" : "constant along the duct"}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `tinggi tekan atmosfer ${fmtPlain(ATM_HEAD, 2)} m kolom air; di bawahnya tidak ada tekanan yang tersisa untuk ditahan air`
                    : `atmospheric head ${fmtPlain(ATM_HEAD, 2)} m of water; below it no pressure is left for the water to hold`}
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

/** Angka negatif dalam substitusi ditulis berkurung: 20,0 − (−8,0). */
function kurung(v: number, d: number) {
  const s = fmt(v, d);
  return v < 0 && s !== fmt(0, d) ? `(${s})` : s;
}

/*
 * Dua butir dari catatan lama: naikkan sumbu leher 1 m, lalu separuhkan
 * diameternya. Hanya dipanggil bila keadaan saat ini tidak berkavitasi.
 * Keadaan yang dibandingkan bisa berkavitasi; di situ angka tinggi tekannya
 * tidak ditulis karena tidak terjadi.
 */
function notice(
  Q: number,
  H: number,
  D1: number,
  D2: number,
  dz: number,
  lang: Lang
): string[] {
  const x = TXT[lang];
  const st = (d2: number, z: number) => [
    { x: 0, z: 0, D: D1 },
    { x: L * 0.5, z, D: d2 },
    { x: L, z: 0, D: D1 },
  ];
  const asli = ductEnergy(Q, st(D2, dz), H, 0).points[1];
  const rNaik = ductEnergy(Q, st(D2, dz + 1), H, 0);
  const rSempit = ductEnergy(Q, st(D2 / 2, dz), H, 0);
  const naik = rNaik.points[1];
  const sempit = rSempit.points[1];
  const mendidih = (p: { absoluteHead: number }) => p.absoluteHead <= UAP;

  return [
    mendidih(naik)
      ? x.nNaikKav(fmt(asli.pressureHead, 2))
      : x.nNaik(fmt(asli.pressureHead, 2), fmt(naik.pressureHead, 2)),
    mendidih(sempit)
      ? x.nSempitKav(fmt(asli.velocityHead, 2), fmt(sempit.velocityHead, 2))
      : x.nSempit(fmt(asli.velocityHead, 2), fmt(sempit.velocityHead, 2)),
  ];
}
