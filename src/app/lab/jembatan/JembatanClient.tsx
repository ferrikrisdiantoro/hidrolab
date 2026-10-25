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
import { drawStructure, type StructureBody, type StructureSpec } from "@/lib/drawStructure";
import {
  BRIDGE_BLOCKAGE_MAX,
  G,
  HEC18_K3_CLEAR,
  HEC18_YS_A_MAX_HIGH,
  HEC18_YS_A_MAX_LOW,
  bridgePiers,
  fmt,
  fmtPlain,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksBridge } from "@/lib/checks";

const TXT = {
  id: {
    title: "Jembatan",
    sheetTitle: "Pembendungan oleh pilar jembatan — rumus Yarnell dan gerusan setempat",
    dQ: "Debit banjir rancangan",
    dB: "Lebar sungai",
    dY3: "Kedalaman di hilir jembatan",
    dN: "Banyaknya pilar",
    dWp: "Lebar satu pilar",
    dK: "Koefisien bentuk pilar (K, Yarnell)",
    pRamping: "Pilar ramping, sungai lebar",
    pTebal: "Pilar tebal, penyempitan berat",
    pDeras: "Banjir deras, mendekati kritis",
    rDh: "Kenaikan muka air di hulu",
    rAlpha: "Bagian lebar yang tertutup pilar",
    rFr: "Bilangan Froude di hilir",
    rV: "Kecepatan di antara pilar",
    rScour: "Gerusan setempat di hidung pilar",
    rDasar: "Dasar lubang gerusan di bawah muka air",
    sempit: "Penyempitan melampaui seperempat lebar",
    sempitNote:
      "Pilar menutup lebih dari seperempat lebar sungai. Rumus Yarnell diturunkan pada pita percobaan yang tidak menjangkau penyempitan sebesar itu, dan yang lebih penting: pada penyempitan seberat ini aliran dapat menjadi tersendat, yaitu terpaksa melewati kondisi kritis di antara pilar. Pembendungan pada keadaan tersendat jauh lebih besar daripada yang diramalkan rumus ini dan dihitung dengan cara yang sama sekali berbeda. Kurangi jumlah pilarnya, tipiskan, atau perlebar bentang jembatannya.",
    superkritis: "Aliran superkritis",
    tertutup: "Pilar menutup seluruh lebar sungai",
    tertutupNote:
      "Banyaknya pilar dikalikan lebar satu pilar sudah mencapai lebar sungainya sendiri, jadi tidak ada celah tersisa untuk air lewat. Luas antar pilarnya nol, kecepatan di antaranya tak hingga, dan yang tergambar bukan jembatan melainkan bendung pejal. Ini bukan penyempitan yang berat melainkan keadaan yang bukan aliran sama sekali, dan tidak ada rumus jembatan mana pun yang berlaku di sini. Kurangi banyaknya pilar, tipiskan pilarnya, atau lebarkan sungainya.",
    superkritisNote:
      "Bilangan Froude di hilir jembatan mencapai satu atau lebih. Rumus Yarnell diturunkan untuk aliran subkritis, tempat gangguan dapat menjalar ke hulu dan menaikkan muka air di sana. Pada aliran superkritis gangguan tidak dapat menjalar ke hulu sama sekali, sehingga tidak ada pembendungan dalam arti yang dimaksud rumus ini; yang terjadi gelombang kejut miring dari tiap hidung pilar. Perdalam alirannya atau perkecil debitnya.",
    capTag: "(dipotong ke batas HEC-18)",
    bLazim: "Dalam batas lazim",
    bBerat: "Penyempitan berat",
    bTertutup: "Tertutup penuh",
    bSub: "Subkritis, Yarnell berlaku",
    bTersendat: "Tersendat (kelas B)",
    bSuper: "Superkritis",
    tersendat: "Aliran tersendat di antara pilar",
    tersendatNote: (e3: string, emin: string) =>
      `Energi spesifik hilir E₃ = ${e3} m lebih kecil daripada energi minimum yang dibutuhkan celah antarpilar, ${emin} m. Celahnya menjadi kendali kritis dan muka air hulu naik sampai sanggup melewatkan debitnya: aliran kelas B, di luar percobaan Yarnell. Kenaikannya perlu dihitung dengan metode momentum atau energi tersendiri, jadi Δh ditulis \u201c—\u201d.`,
    terpotong: (bebas: string, batas: string, k: string) =>
      `Gerusan dari rumus HEC-18 ${bebas} m melampaui batas atasnya ${batas} m (${k} kali lebar pilar, HEC-18 pers. 7.2), jadi yang ditulis batas itu.`,
    sSah: (fr: string, a: string, dh: string, ys: string) =>
      `Fr = ${fr}, α = ${a}: muka air hulu naik ${dh} mm; gerusan ${ys} m.`,
    sSuper: (fr: string) => `Superkritis (Fr = ${fr}): rumus Yarnell tidak berlaku, tidak ada pembendungan untuk dihitung.`,
    sTertutup: (a: string) => `Pilar menutup seluruh lebar (α = ${a}): tidak ada celah untuk aliran.`,
    sTersendat: (fr: string, a: string) => `Tersendat (Fr = ${fr}, α = ${a}): celah antarpilar menjadi kendali kritis.`,
    saranSuper: "Pada aliran superkritis tidak ada pembendungan untuk dihitung, karena gangguan tidak dapat menjalar ke hulu. Perdalam alirannya sampai bilangan Froude turun di bawah satu.",
    lipatDua: (rasio: string, ys: string) =>
      `Melipatduakan jumlah pilar mengalikan pembendungannya ${rasio} kali, bukan dua kali, dan tidak mengubah kedalaman gerusannya yang tetap ${ys} m karena gerusan bergantung pada lebar pilar, bukan jumlahnya.`,
    lipatDuaLuar: "Melipatduakan jumlah pilar di sini membawa alirannya ke luar rentang Yarnell (tersendat atau tertutup penuh), jadi kelipatannya tidak dikutip.",
    separuh: (dh: string, ys: string) =>
      `Menipiskan pilarnya menjadi separuh memberi pembendungan ${dh} mm dan gerusan ${ys} m: keduanya turun bersama-sama. Ketidaksetangkupan itu layak dibawa ke rapat perancangan, tempat perdebatannya biasanya tentang jumlah pilar dan jarang tentang ketebalannya.`,
    hAlpha: "Bagian lebar yang tertutup pilar",
    hFr: "Kecepatan dan bilangan Froude di hilir",
    hCek: "Pemeriksaan tersendat: energi hilir terhadap energi minimum celah",
    hDh: "Pembendungan Yarnell",
    hV: "Kecepatan di antara pilar",
    hYs: "Gerusan setempat HEC-18 dan batas atasnya",
    note:
      "Perhatikan pangkat empat pada suku penyempitan di rumus Yarnell. Bagian lebar yang tertutup pilar muncul dua kali, sekali sebagai alpha dan sekali sebagai lima belas kali alpha pangkat empat, dan suku kedua itulah yang menjelaskan mengapa jembatan berpilar banyak jauh lebih mahal secara hidraulik daripada yang tampak. Menggandakan jumlah pilar tidak menggandakan pembendungannya melainkan lebih dari itu, dan pada penyempitan yang sudah besar jauh lebih dari itu. Hal kedua yang perlu dilihat bersama: gerusan setempat di hidung pilar sama sekali tidak bergantung pada pembendungannya. Ia bergantung pada lebar pilar dan kecepatan setempat, dan karena itu pilar yang ditipiskan mengurangi keduanya sekaligus sedangkan pilar yang dikurangi jumlahnya hanya mengurangi pembendungannya. Kedalaman gerusan yang dihitung di sini memakai bentuk HEC-18 yang sengaja konservatif dan lazim dianggap batas atas, bukan taksiran terbaik.",
  },
  en: {
    title: "Bridge",
    sheetTitle: "Backwater from bridge piers — the Yarnell formula and local scour",
    dQ: "Design flood discharge",
    dB: "River width",
    dY3: "Depth downstream of the bridge",
    dN: "Number of piers",
    dWp: "Width of one pier",
    dK: "Pier shape coefficient (K, Yarnell)",
    pRamping: "Slender piers, wide river",
    pTebal: "Thick piers, heavy contraction",
    pDeras: "Fast flood, near critical",
    rDh: "Rise in water level upstream",
    rAlpha: "Fraction of width blocked by piers",
    rFr: "Froude number downstream",
    rV: "Velocity between piers",
    rScour: "Local scour at the pier nose",
    rDasar: "Bottom of the scour hole below the water surface",
    sempit: "Contraction exceeds a quarter of the width",
    sempitNote:
      "The piers block more than a quarter of the river width. The Yarnell formula was derived on an experimental band that does not reach contractions that heavy, and more importantly: at this degree of contraction the flow can choke, that is, be forced through critical conditions between the piers. Backwater in the choked state is far larger than this formula predicts and is computed in an entirely different way. Reduce the number of piers, make them thinner, or widen the bridge span.",
    superkritis: "Supercritical flow",
    tertutup: "The piers close the whole river width",
    tertutupNote:
      "The number of piers times the width of one has reached the width of the river itself, so no gap is left for water to pass. The area between the piers is zero, the velocity between them is infinite, and what is drawn is not a bridge but a solid weir. This is not heavy contraction but a state that is not a flow at all, and no bridge formula whatever applies here. Reduce the number of piers, make them thinner, or widen the river.",
    superkritisNote:
      "The Froude number downstream of the bridge has reached one or more. The Yarnell formula was derived for subcritical flow, where a disturbance can travel upstream and raise the level there. In supercritical flow a disturbance cannot travel upstream at all, so there is no backwater in the sense this formula means; what happens instead is an oblique shock wave from each pier nose. Deepen the flow or reduce the discharge.",
    capTag: "(capped at the HEC-18 limit)",
    bLazim: "Within usual limit",
    bBerat: "Heavy contraction",
    bTertutup: "Fully blocked",
    bSub: "Subcritical, Yarnell applies",
    bTersendat: "Choked (class B)",
    bSuper: "Supercritical",
    tersendat: "Flow choked between the piers",
    tersendatNote: (e3: string, emin: string) =>
      `The downstream specific energy E₃ = ${e3} m is less than the minimum energy the gap between piers needs, ${emin} m. The gap becomes a critical control and the upstream level rises until it can pass the discharge: class B flow, outside Yarnell's experiments. The rise must be computed by a separate momentum or energy method, so Δh is shown as \u201c—\u201d.`,
    terpotong: (bebas: string, batas: string, k: string) =>
      `Scour from the HEC-18 formula, ${bebas} m, exceeds its upper limit of ${batas} m (${k} times the pier width, HEC-18 eq. 7.2), so the limit is shown.`,
    sSah: (fr: string, a: string, dh: string, ys: string) =>
      `Fr = ${fr}, α = ${a}: the upstream level rises ${dh} mm; scour ${ys} m.`,
    sSuper: (fr: string) => `Supercritical (Fr = ${fr}): the Yarnell formula does not apply, there is no backwater to compute.`,
    sTertutup: (a: string) => `The piers block the full width (α = ${a}): no gap is left for flow.`,
    sTersendat: (fr: string, a: string) => `Choked (Fr = ${fr}, α = ${a}): the gap between piers becomes a critical control.`,
    saranSuper: "In supercritical flow there is no backwater to compute, because a disturbance cannot travel upstream. Deepen the flow until the Froude number falls below one.",
    lipatDua: (rasio: string, ys: string) =>
      `Doubling the number of piers multiplies the backwater by ${rasio}, not by two, and leaves the scour depth unchanged at ${ys} m because scour depends on the pier width rather than their number.`,
    lipatDuaLuar: "Doubling the number of piers here takes the flow outside the Yarnell range (choked or fully blocked), so the multiple is not quoted.",
    separuh: (dh: string, ys: string) =>
      `Halving the pier width instead gives ${dh} mm of backwater and ${ys} m of scour: both fall together. That asymmetry is worth carrying into design meetings, where the argument is usually about the number of piers and rarely about their thickness.`,
    hAlpha: "Fraction of width blocked by piers",
    hFr: "Downstream velocity and Froude number",
    hCek: "Choking check: downstream energy against the gap's minimum energy",
    hDh: "Yarnell backwater",
    hV: "Velocity between piers",
    hYs: "HEC-18 local scour and its upper limit",
    note:
      "Note the fourth power on the contraction term in the Yarnell formula. The blocked fraction appears twice, once as alpha and once as fifteen times alpha to the fourth, and it is that second term which explains why a bridge with many piers is far more expensive hydraulically than it looks. Doubling the number of piers does not double the backwater but more than doubles it, and at contractions that are already large, far more than that. A second thing to see alongside it: local scour at the pier nose does not depend on the backwater at all. It depends on the pier width and the local velocity, so thinning the piers reduces both at once while reducing their number reduces only the backwater. The scour depth computed here uses the HEC-18 form, which is deliberately conservative and usually treated as an upper bound rather than a best estimate.",
  },
} as const;

const REFS = {
  id: [
    "Yarnell, D.L. (1934). Bridge piers as channel obstructions. USDA Technical Bulletin 442.",
    "Richardson, E.V. & Davis, S.R. (2001). Evaluating Scour at Bridges, HEC-18, edisi ke-4. FHWA.",
    "Hamill, L. (1999). Bridge Hydraulics. E & FN Spon.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill, Bab 17.",
  ],
  en: [
    "Yarnell, D.L. (1934). Bridge piers as channel obstructions. USDA Technical Bulletin 442.",
    "Richardson, E.V. & Davis, S.R. (2001). Evaluating Scour at Bridges, HEC-18, 4th ed. FHWA.",
    "Hamill, L. (1999). Bridge Hydraulics. E & FN Spon.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill, Chapter 17.",
  ],
} as const;

export function JembatanClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Q, setQ] = useState(200);
  const [B, setB] = useState(50);
  const [y3, setY3] = useState(3);
  const [piers, setPiers] = useState(2);
  const [wp, setWp] = useState(1.5);
  const [K, setK] = useState(0.9);

  const r = bridgePiers(Q, B, y3, piers, wp, K);
  /*
   * Dua sebab berbeda yang sama-sama membuat rumus Yarnell tidak berlaku,
   * dan keduanya perlu disebut dengan namanya masing-masing.
   *
   * Model menggabungkan keduanya ke dalam satu bendera di luar rentang,
   * yang memang benar untuk memutuskan apakah kenaikan muka airnya boleh
   * ditulis. Tetapi lembarnya sempat memakai bendera gabungan itu untuk
   * memilih KALIMATNYA juga, sehingga jembatan berpilar dua belas selebar
   * enam meter pada bilangan Froude nol koma dua diberi tulisan "aliran
   * superkritis". Yang benar di situ bukan alirannya yang terlalu cepat
   * melainkan sungainya yang tertutup habis.
   */
  const superkritis = r.Fr >= 1;

  /* Nilai antara untuk langkah hitungan. Lib belum menyimpan E₃, Emin celah,
     gerusan sebelum dipotong, dan Fr batas tersendat sebagai field
     (PERMINTAAN ke pengembang-model); semuanya dihitung dengan rumus yang
     sama persis dengan bridgePiers. */
  const V3 = B * y3 > 0 ? Q / (B * y3) : 0;
  const E3 = y3 + (V3 * V3) / (2 * G);
  const bersih = B - piers * wp;
  const qc = bersih > 0 ? Q / bersih : NaN;
  const Emin = 1.5 * Math.cbrt((qc * qc) / G);
  const batasK = r.Fr <= 0.8 ? HEC18_YS_A_MAX_LOW : HEC18_YS_A_MAX_HIGH;
  const ysBebas =
    piers > 0 && wp > 0 && y3 > 0
      ? 2.0 * HEC18_K3_CLEAR * Math.pow(wp, 0.65) * Math.pow(y3, 0.35) * Math.pow(Math.max(r.Fr, 1e-9), 0.43)
      : 0;
  const keadaan = bacaKeadaan({ Q, B, y3, piers, wp, K }, r, { E3, Emin, ysBebas, batasK }, lang);

  const ref = useCanvas(
    (ctx, w, ch) => {
      // Tampak atas: aliran dari kiri ke kanan, pilar sebagai persegi panjang.
      /*
       * Panjang pilar searah aliran hanya ada di gambarnya, bukan di
       * hitungannya, jadi ia harus DIBATASI DI KEDUA UJUNG.
       *
       * Batas bawahnya sudah ada sejak semula supaya pilar tetap terlihat
       * pada sungai yang lebar. Batas atasnya belum: pilar selebar satu
       * setengah meter digambar sepanjang enam meter, dan pada sungai
       * selebar lima meter keduanya menembus keluar bidang gambar sampai
       * hampir satu meter di tiap sisi. Sekarang panjangnya tidak pernah
       * melebihi separuh lebar sungainya, sehingga pilar yang memang
       * kelewat besar tergambar kelewat besar, bukan tergambar di luar
       * kertas.
       */
      const panjangPilar = Math.min(
        Math.max(wp * 4, B * 0.12),
        B * 0.55
      );
      const badan: StructureBody[] = [];
      for (let i = 0; i < piers; i++) {
        const yTengah = (B * (i + 1)) / (piers + 1);
        badan.push({
          pts: [
            { x: -panjangPilar / 2, z: yTengah - wp / 2 },
            { x: panjangPilar / 2, z: yTengah - wp / 2 },
            { x: panjangPilar / 2, z: yTengah + wp / 2 },
            { x: -panjangPilar / 2, z: yTengah + wp / 2 },
          ],
        });
      }

      const spec: StructureSpec = {
        xMin: -B * 0.42,
        xMax: B * 0.42,
        zMin: -B * 0.05,
        zMax: B * 1.05,
        bodies: badan,
        waters: [
          {
            surface: [
              { x: -B * 0.42, z: B },
              { x: B * 0.42, z: B },
            ],
            bed: [
              { x: B * 0.42, z: 0 },
              { x: -B * 0.42, z: 0 },
            ],
            invalid: r.outOfRange,
          },
        ],
        lines: [
          {
            pts: [
              { x: -panjangPilar / 2, z: -B * 0.05 },
              { x: -panjangPilar / 2, z: B * 1.05 },
            ],
            color: C.ink2,
            weight: W.hair,
            dash: DASH.axis,
          },
          {
            pts: [
              { x: panjangPilar / 2, z: -B * 0.05 },
              { x: panjangPilar / 2, z: B * 1.05 },
            ],
            color: C.ink2,
            weight: W.hair,
            dash: DASH.axis,
          },
        ],
        dims:
          piers > 0
            ? [
                {
                  axis: "h",
                  at: B / (piers + 1) - wp / 2,
                  from: -panjangPilar / 2,
                  to: panjangPilar / 2,
                  text: `${fmtPlain(panjangPilar, 1)} m`,
                  color: C.ink3,
                  offset: -18,
                },
              ]
            : [],
        callouts:
          piers > 0
            ? [
                {
                  /*
                   * Namanya menunjuk pilar TERATAS, sedangkan ukuran
                   * panjangnya tetap di pilar terbawah. Keduanya di pilar
                   * yang sama akan berebut ruang yang itu-itu juga, dan
                   * pada dua belas pilar jaraknya tinggal beberapa piksel.
                   *
                   * Menjulurnya MENDATAR ke kiri, dari muka hulu pilarnya ke
                   * air terbuka. Menjulur ke atas membawanya ke kepala
                   * gambar pada dua belas pilar, dan ke badan pilarnya
                   * sendiri pada pilar selebar enam meter.
                   */
                  x: -panjangPilar / 2,
                  z: (B * piers) / (piers + 1),
                  dx: -54,
                  dy: -12,
                  text: T.pierLabel,
                },
              ]
            : [],
        arrows: [
          { x: -B * 0.34, z: B * 0.2, length: 26 },
          { x: -B * 0.34, z: B * 0.5, length: 26 },
          { x: -B * 0.34, z: B * 0.8, length: 26 },
        ],
        heading: r.fullyBlocked
          ? x.tertutup
          : superkritis
            ? x.superkritis
            : r.choked
              ? x.tersendat
              : r.heavyBlockage
                ? x.sempit
                : T.planView2,
        // α > 0,25 batas rancangan (oker); merah hanya bila rumus gugur.
        headingColor: r.outOfRange ? C.signal : r.heavyBlockage ? C.caution : C.ink3,
        axisX: T.axHoriz,
        axisZ: T.axAcrossRiver,
      };

      drawStructure(ctx, w, ch, spec, lang);
    },
    [Q, B, y3, piers, wp, K, lang]
  );

  return (
    <LabShell
      status={
        <div className="flex flex-col gap-2">
          <RegimeScale
            symbol="α"
            value={r.blockage}
            scale="lin"
            digits={3}
            invalid={r.fullyBlocked}
            pesan={r.fullyBlocked ? x.bTertutup : undefined}
            bands={[
              { from: 0, to: BRIDGE_BLOCKAGE_MAX, label: x.bLazim, tone: "pass" },
              { from: BRIDGE_BLOCKAGE_MAX, to: 1, label: x.bBerat, tone: "caution" },
            ]}
          />
          <RegimeScale
            symbol="Fr"
            value={r.Fr}
            scale="log"
            digits={3}
            invalid={r.outOfRange && !r.fullyBlocked}
            bands={pitaFr(r.blockage, lang)}
          />
        </div>
      }
      sheet="HS-05"
      subject={SUBJECTS.HS[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Pilar menaikkan muka air di hulunya, dan kenaikan itu tumbuh menurut{" "}
            <Term tint={C.critical}>pangkat empat</Term> dari bagian lebar yang
            ditutupnya. Menggandakan pilar jauh lebih mahal daripada dua kali.
          </p>
        ) : (
          <p>
            Piers raise the water level upstream, and that rise grows as the{" "}
            <Term tint={C.critical}>fourth power</Term> of the fraction of width
            they block. Doubling the piers costs far more than double.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HS-05"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "α", value: fmt(r.blockage, 3), tint: r.fullyBlocked ? C.signal : r.heavyBlockage ? C.caution : undefined },
            { label: "Fr", value: fmt(r.Fr, 3), tint: superkritis || r.choked ? C.signal : undefined },
            { label: "Δh", value: r.outOfRange ? "—" : `${fmt(r.backwater, 3)} m`, tint: C.water },
            { label: "ys", value: r.fullyBlocked ? "—" : `${fmt(r.scourDepth, 2)} m${r.scourCapped ? (lang === "id" ? " (batas)" : " (cap)") : ""}`, tint: C.critical },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q} min={5} max={3000} step={5} digits={0} unit="m³/s" onChange={setQ} tint={C.water} />
              <InputRow symbol="B" label={x.dB} value={B} min={5} max={300} step={1} digits={0} unit="m" onChange={setB} />
              <InputRow symbol="y₃" label={x.dY3} value={y3} min={0.3} max={15} step={0.1} digits={1} unit="m" onChange={setY3} />
              <InputRow symbol="N" label={x.dN} value={piers} min={0} max={12} step={1} digits={0} onChange={setPiers} />
              <InputRow symbol="ap" label={x.dWp} value={wp} min={0.2} max={6} step={0.1} digits={1} unit="m" onChange={setWp} />
              <InputRow symbol="K" label={x.dK} value={K} min={0.9} max={1.25} step={0.05} digits={2} onChange={setK} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pRamping, apply: () => { setQ(200); setB(60); setY3(3); setPiers(2); setWp(0.8); setK(0.9); } },
                  /* "Pilar tebal": ap 2,5 (α 0,333) kini tersendat menurut
                     model gelombang 1, jadi ap 2,0 (α 0,267, penyempitan
                     berat, Δh 0,233 m). "Banjir deras": y₃ 2 memberi Fr
                     1,355 (superkritis, Δh "—"); y₃ 3,2 memberi Fr 0,669,
                     tidak tersendat, Δh 0,197 m (spesifikasi B2, CACAT 1). */
                  { label: x.pTebal, apply: () => { setQ(200); setB(30); setY3(3); setPiers(4); setWp(2); setK(1.05); } },
                  { label: x.pDeras, apply: () => { setQ(600); setB(50); setY3(3.2); setPiers(2); setWp(1.5); setK(0.9); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "Δh", label: x.rDh, value: r.outOfRange ? "—" : fmt(r.backwater, 4), unit: r.outOfRange ? undefined : "m", tint: C.water, strong: true },
                /* Sungai yang tertutup habis bukan aliran, jadi tidak ada gerusan
                   maupun pondasi yang dapat dihitung dari alirannya. Gerusan
                   yang terpotong ke batas HEC-18 diberi tanda di labelnya. */
                { symbol: "ys", label: r.scourCapped ? `${x.rScour} ${x.capTag}` : x.rScour, value: r.fullyBlocked ? "—" : fmt(r.scourDepth, 3), unit: r.fullyBlocked ? undefined : "m", tint: C.critical, strong: true },
                { symbol: "α", label: x.rAlpha, value: fmt(r.blockage, 4), tint: r.fullyBlocked ? C.signal : r.heavyBlockage ? C.caution : undefined },
                { symbol: "Fr", label: x.rFr, value: fmt(r.Fr, 4), tint: superkritis || r.choked ? C.signal : undefined },
                { symbol: "V", label: x.rV, value: r.fullyBlocked ? "—" : fmt(r.velocityBetween, 3), unit: r.fullyBlocked ? undefined : "m/s" },
                { symbol: "zf", label: x.rDasar, value: r.fullyBlocked ? "—" : fmt(y3 + r.scourDepth, 2), unit: r.fullyBlocked ? undefined : "m", tint: C.critical },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hAlpha,
                    rumus: (<><span>α =</span><Frac num="N · ap" den="B" /></>),
                    isi: `${fmt(piers, 0)} · ${fmt(wp, 1)} / ${fmt(B, 0)}`,
                    hasil: fmt(r.blockage, 4),
                  },
                  {
                    judul: x.hFr,
                    rumus: (<><span>V₃ =</span><Frac num="Q" den="B · y₃" /><span className="ml-3">Fr =</span><Frac num="V₃" den="√( g · y₃ )" /></>),
                    isi: `V₃ = ${fmt(Q, 0)} / ( ${fmt(B, 0)} · ${fmt(y3, 1)} ) = ${fmt(V3, 4)} m/s; ${fmt(V3, 4)} / √( ${fmt(G, 2)} · ${fmt(y3, 1)} )`,
                    hasil: fmt(r.Fr, 4),
                  },
                  {
                    judul: x.hCek,
                    rumus: (<><span>E₃ = y₃ +</span><Frac num="V₃²" den="2g" /><span className="ml-3">Emin = {fmt(1.5, 1)} · ∛( qc² / g ), qc = Q / ( B − N ap )</span></>),
                    isi: r.fullyBlocked
                      ? "B − N ap ≤ 0"
                      : `E₃ = ${fmt(E3, 4)} m; qc = ${fmt(qc, 4)} m²/s; Emin = ${fmt(Emin, 4)} m; E₃ ${r.choked ? "<" : "≥"} Emin`,
                    hasil: r.fullyBlocked ? "—" : r.choked ? x.bTersendat : x.bSub,
                    tint: r.choked || r.fullyBlocked ? C.signal : undefined,
                  },
                  {
                    judul: x.hDh,
                    rumus: <span>Δh = K · ( K + 5 Fr² − {fmt(0.6, 1)} ) · ( α + 15 α⁴ ) · Fr² · y₃</span>,
                    isi: r.outOfRange
                      ? "—"
                      : `${fmt(K, 2)} · ( ${fmt(K, 2)} + 5 · ${fmt(r.Fr, 4)}² − ${fmt(0.6, 1)} ) · ( ${fmt(r.blockage, 4)} + 15 · ${fmt(r.blockage, 4)}⁴ ) · ${fmt(r.Fr, 4)}² · ${fmt(y3, 1)}`,
                    hasil: r.outOfRange ? "—" : fmt(r.backwater, 4),
                    satuan: r.outOfRange ? undefined : "m",
                    tint: C.water,
                  },
                  {
                    judul: x.hV,
                    rumus: (<><span>V =</span><Frac num="Q" den="( B − N ap ) · y₃" /></>),
                    isi: r.fullyBlocked ? "—" : `${fmt(Q, 0)} / ( ${fmt(B - piers * wp, 2)} · ${fmt(y3, 1)} )`,
                    hasil: r.fullyBlocked ? "—" : fmt(r.velocityBetween, 3),
                    satuan: r.fullyBlocked ? undefined : "m/s",
                  },
                  {
                    judul: x.hYs,
                    rumus: <span>ys = {fmt(2, 1)} · K₃ · ap^{fmt(0.65, 2)} · y₃^{fmt(0.35, 2)} · Fr^{fmt(0.43, 2)} ≤ {fmt(batasK, 1)} · ap</span>,
                    isi: r.fullyBlocked || piers === 0
                      ? "—"
                      : `${fmt(2, 1)} · ${fmt(HEC18_K3_CLEAR, 1)} · ${fmt(wp, 1)}^${fmt(0.65, 2)} · ${fmt(y3, 1)}^${fmt(0.35, 2)} · ${fmt(r.Fr, 4)}^${fmt(0.43, 2)} = ${fmt(ysBebas, 3)} m; ${fmt(batasK, 1)} · ${fmt(wp, 1)} = ${fmt(batasK * wp, 3)} m`,
                    hasil: r.fullyBlocked ? "—" : `${fmt(r.scourDepth, 3)}${r.scourCapped ? ` ${x.capTag}` : ""}`,
                    satuan: r.fullyBlocked ? undefined : "m",
                    tint: C.critical,
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard {...keadaan} />
        </>
      }
      verification={<Verification checks={checksBridge(Q, B, y3, piers, wp, K)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Δh = K (K + 5 Fr² − {fmt(0.6, 1)}) (α + 15 α⁴) Fr² y₃</span>
              </Eq>
              <Eq>
                <span>α =</span>
                <Frac num="N ap" den="B" />
                <span className="ml-5">ys = {fmt(2, 1)} K₃ ap^{fmt(0.65, 2)} y₃^{fmt(0.35, 2)} Fr^{fmt(0.43, 2)}</span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `berlaku pada aliran subkritis, dan pita percobaannya berhenti di α sekitar ${fmtPlain(BRIDGE_BLOCKAGE_MAX, 2)}`
                    : `valid in subcritical flow, and the experimental band stops near an α of ${fmtPlain(BRIDGE_BLOCKAGE_MAX, 2)}`}
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

/*
 * Fr batas tersendat untuk α tertentu: syarat model E₃ = 1,5 yc(qc) ditulis
 * dalam Fr menjadi 1 + Fr²/2 = 1,5 (Fr / (1 − α))^(2/3) (Henderson 1966
 * §2). Dicari dengan bagi dua pada 0 < Fr < 1; untuk α → 0 akarnya 1,
 * jadi pita tersendat hilang.
 */
function frTersendat(alpha: number): number {
  if (!(alpha > 0) || alpha >= 1) return 1;
  const f = (Fr: number) => 1 + (Fr * Fr) / 2 - 1.5 * Math.pow(Fr / (1 - alpha), 2 / 3);
  let lo = 1e-6;
  let hi = 1;
  if (f(hi) >= 0) return 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function pitaFr(alpha: number, lang: Lang): RegimeBand[] {
  const x = TXT[lang];
  const frt = frTersendat(alpha);
  const pita: RegimeBand[] = [];
  if (frt < 0.999) {
    pita.push({ from: 0.01, to: Math.max(frt, 0.0101), label: x.bSub, tone: "water" });
    pita.push({ from: Math.max(frt, 0.0101), to: 1, label: x.bTersendat, tone: "invalid" });
  } else {
    pita.push({ from: 0.01, to: 1, label: x.bSub, tone: "water" });
  }
  pita.push({ from: 1, to: 10, label: x.bSuper, tone: "invalid" });
  return pita;
}

function bacaKeadaan(
  m: { Q: number; B: number; y3: number; piers: number; wp: number; K: number },
  r: ReturnType<typeof bridgePiers>,
  h: { E3: number; Emin: number; ysBebas: number; batasK: number },
  lang: Lang
): { tone: Tone; badge: string; state: string; notice: string[] } {
  const x = TXT[lang];
  const potong = r.scourCapped
    ? [x.terpotong(fmt(h.ysBebas, 3), fmt(h.batasK * m.wp, 3), fmt(h.batasK, 1))]
    : [];

  /* Cabang dipisah (CACAT 2): tertutup penuh tidak pernah lagi diberi
     kalimat "pada aliran superkritis". */
  if (r.fullyBlocked)
    return { tone: "invalid", badge: x.tertutup, state: x.sTertutup(fmt(r.blockage, 3)), notice: [x.tertutupNote] };
  if (r.Fr >= 1)
    return {
      tone: "invalid",
      badge: x.superkritis,
      state: x.sSuper(fmt(r.Fr, 3)),
      notice: [x.superkritisNote, x.saranSuper, ...potong],
    };
  if (r.choked)
    return {
      tone: "invalid",
      badge: x.tersendat,
      state: x.sTersendat(fmt(r.Fr, 3), fmt(r.blockage, 3)),
      notice: [
        x.tersendatNote(fmt(h.E3, 3), fmt(h.Emin, 3)),
        ...(r.heavyBlockage ? [x.sempitNote] : []),
        ...potong,
      ],
    };

  /* Kalimat lipat dua pilar (CACAT 3): dilewati bila tidak ada pilar
     (rasio cadangan 2 dulu menulis "2,00 kali, bukan dua kali") dan bila
     lipat duanya membawa aliran ke luar rentang Yarnell. */
  const dua = bridgePiers(m.Q, m.B, m.y3, m.piers * 2, m.wp, m.K);
  const tipis = bridgePiers(m.Q, m.B, m.y3, m.piers, m.wp / 2, m.K);
  const lipat =
    m.piers === 0
      ? null
      : dua.outOfRange || r.backwater <= 0
        ? x.lipatDuaLuar
        : x.lipatDua(fmt(dua.backwater / r.backwater, 2), fmt(r.scourDepth, 2));
  const separuh =
    m.piers === 0 || tipis.outOfRange ? null : x.separuh(fmt(tipis.backwater * 1000, 0), fmt(tipis.scourDepth, 2));

  return {
    tone: r.heavyBlockage ? "caution" : "water",
    badge: r.heavyBlockage ? x.sempit : x.bSub,
    state: x.sSah(fmt(r.Fr, 3), fmt(r.blockage, 3), fmt(r.backwater * 1000, 0), fmt(r.scourDepth, 2)),
    notice: [
      ...(r.heavyBlockage ? [x.sempitNote] : []),
      ...potong,
      ...(lipat ? [lipat] : []),
      ...(separuh ? [separuh] : []),
    ],
  };
}
