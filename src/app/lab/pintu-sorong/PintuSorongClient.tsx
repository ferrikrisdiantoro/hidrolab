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
import { drawStructure, type StructureSpec } from "@/lib/drawStructure";
import { G, ORIFICE_CC_SLOT, fmt, fmtPlain, sluiceGate } from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksSluice } from "@/lib/checks";

const TXT = {
  id: {
    title: "Pintu sorong",
    sheetTitle: "Pintu sorong berbibir tajam — aliran bebas dan aliran tenggelam",
    dY1: "Kedalaman hulu",
    dA: "Bukaan pintu",
    dB: "Lebar saluran",
    dY3: "Kedalaman hilir",
    dCc: "Koefisien kontraksi",
    pBebas: "Aliran bebas",
    pTenggelam: "Aliran tenggelam",
    pBukaBesar: "Bukaan besar",
    rQ: "Debit",
    rCd: "Koefisien debit",
    rY2: "Kedalaman di vena contracta",
    rYc: "Kedalaman lawan loncatan",
    rFr2: "Bilangan Froude di vena contracta",
    rGaya: "Gaya mendatar pada daun pintu",
    rGayaTotal: "Gaya pada seluruh lebar pintu",
    tenggelam: "Pintu tenggelam",
    tenggelamNote:
      "Muka air hilir melampaui kedalaman lawan loncatan dari vena contracta. Loncatan air yang seharusnya terbentuk di hilir pintu terdorong balik dan menenggelamkan bukaannya. Sejak titik itu debitnya tidak lagi ditentukan oleh kedalaman hulu sendirian melainkan oleh selisih muka air hulu dan hilir, dan kepekaan pintu sebagai alat ukur menjadi jauh lebih buruk: selisih dua meter pada muka air hilir mengubah debit lebih banyak daripada selisih dua meter pada muka air hulu. Pintu yang dipakai untuk mengukur debit karena itu harus dipastikan bekerja bebas.",
    diAtasAir: "Bukaan melebihi kedalaman hulu",
    terbalik: "Muka air hilir melampaui muka air hulu",
    terdorong: "Loncatan terdorong ke hilir",
    terdorongNote:
      "Muka air hilir masih di bawah kedalaman lawan loncatan, jadi loncatannya tidak dapat berdiri tepat di hilir pintu. Ia terdorong ke hilir sampai gesekan dasar menaikkan kedalaman alirannya cukup untuk mengimbangi, dan jaraknya bergantung pada kemiringan serta kekasaran saluran di hilir, yang tidak dihitung lembar ini. Letak loncatan pada gambar karena itu hanya menyatakan bahwa ia ada di suatu tempat di hilir, bukan bahwa ia ada di titik itu. Yang penting bagi rancangan: lantai olakan harus cukup panjang untuk memuat loncatan di tempat terjauhnya, bukan di tempat terdekatnya.",
    terbalikNote:
      "Muka air hilir sudah mencapai atau melewati muka air hulu, jadi tidak ada lagi beda tinggi yang mendorong air melewati pintunya. Debitnya nol, dan bila muka air hilir dinaikkan lagi airnya justru mengalir ke arah sebaliknya. Seluruh lembar ini menganggap alirannya dari hulu ke hilir, jadi angka-angkanya tidak berlaku di sini. Gaya pada daun pintunya memang berbalik tanda, karena sekarang air hilir yang menekan pintu ke arah hulu, dan itu keadaan yang justru perlu diperiksa sendiri saat merancang batang pengangkatnya: pintu yang hanya dihitung untuk tekanan dari satu arah dapat tertekuk saat banjir hilir naik lebih cepat daripada hulunya.",
    diAtasAirNote:
      "Bukaan pintu lebih besar daripada kedalaman air di hulunya, jadi daun pintunya berada seluruhnya di atas muka air dan tidak menyentuh aliran sama sekali. Yang ada di sana saluran terbuka biasa, bukan pintu, dan tidak ada debit pintu untuk dihitung. Turunkan bukaannya di bawah kedalaman hulu.",
    bBebas: "Bebas, loncatan terdorong ke hilir",
    bTenggelam: "Tenggelam",
    bTerbalik: "Muka air hilir di atas hulu",
    badgeBebas: "Bebas",
    sBebas: (Q: string, rasio: string) => `Bebas: Q = ${Q} m³/s, y₃/y₂′ = ${rasio}.`,
    sTenggelam: (Q: string, rasio: string) => `Tenggelam: Q = ${Q} m³/s, y₃/y₂′ = ${rasio}.`,
    sTerbalik: "Muka air hilir ≥ hulu: tidak ada aliran ke hilir.",
    sDiAtasAir: "Bukaan ≥ y₁: pintu tidak menyentuh aliran.",
    saranTerbalik: "Turunkan muka air hilir di bawah muka air hulu, lalu seluruh angka di atas kembali punya arti.",
    saranDiAtasAir: "Turunkan bukaannya di bawah kedalaman hulu, lalu seluruh angka di atas kembali punya arti.",
    gayaLebih: (h: string, f: string, p: string) =>
      `Tekanan hidrostatis pada bidang daun pintu saja memberi ${h} kN tiap meter lebar, berbanding ${f} kN dari momentum: ${p} persen lebih besar. Batang pengangkat yang diukur dari tekanan saja kelebihan ukuran sebesar itu.`,
    gayaKurang: (h: string, f: string, p: string) =>
      `Tekanan hidrostatis pada bidang daun pintu saja memberi ${h} kN tiap meter lebar, berbanding ${f} kN dari momentum: ${p} persen lebih kecil. Batang pengangkat yang diukur dari tekanan saja kurang ukuran; gaya yang sesungguhnya dari momentum.`,
    saranBebas: "Naikkan muka air hilirnya melewati kedalaman lawan loncatan, lalu perhatikan debit dan gayanya turun bersama-sama.",
    saranTenggelam: "Pintunya sedang tenggelam, dan itu menurunkan debit maupun gayanya sekaligus: air hilir menekan balik.",
    hCd: "Koefisien debit dari koefisien kontraksi",
    hY2: "Kedalaman dan Froude di vena contracta",
    hYc: "Kedalaman lawan loncatan, dibandingkan dengan muka air hilir",
    hQ: "Debit, dikalikan faktor tenggelam bila tenggelam",
    hF: "Gaya pada daun pintu dari selisih momentum",
    hMati: "Rumus pintu tidak berlaku pada keadaan ini",
    note:
      "Koefisien debit pintu sorong sering disajikan sebagai angka yang harus dicari di tabel, padahal ia dapat diturunkan seluruhnya dari satu besaran saja, yaitu koefisien kontraksi. Persamaan energi antara hulu dan vena contracta memberi Cd sama dengan Cc dibagi akar dari satu ditambah Cc a per y1, dan bentuk itu otomatis mengecil ketika bukaan mendekati kedalaman hulu. Tidak ada tabel yang perlu dihafal. Yang perlu diperhatikan, gaya pada daun pintu bukan sekadar tekanan hidrostatis pada bidang daunnya. Air yang dipercepat lewat bawah pintu membawa momentum, dan gaya yang sesungguhnya ditahan daun pintu adalah selisih momentum di hulu dan di hilirnya. Arah dan besar selisihnya bergantung pada bukaan: pada bukaan kecil di saluran dalam keduanya hanya terpaut beberapa persen, sedangkan pada bukaan besar tekanan hidrostatis pada bidang daun saja jauh lebih kecil daripada gaya dari momentum. Batang pengangkat yang diukur dari tekanan saja karena itu bisa kurang ukuran; hitunglah dari momentum.",
  },
  en: {
    title: "Sluice gate",
    sheetTitle: "Sharp-edged sluice gate — free flow and submerged flow",
    dY1: "Upstream depth",
    dA: "Gate opening",
    dB: "Channel width",
    dY3: "Downstream depth",
    dCc: "Contraction coefficient",
    pBebas: "Free flow",
    pTenggelam: "Submerged flow",
    pBukaBesar: "Large opening",
    rQ: "Discharge",
    rCd: "Discharge coefficient",
    rY2: "Depth at the vena contracta",
    rYc: "Conjugate depth of the jump",
    rFr2: "Froude number at the vena contracta",
    rGaya: "Horizontal force on the gate leaf",
    rGayaTotal: "Force over the full gate width",
    tenggelam: "Gate submerged",
    tenggelamNote:
      "The tailwater exceeds the conjugate depth of the jump from the vena contracta. The hydraulic jump that should form downstream of the gate is pushed back and drowns the opening. From that point the discharge is no longer set by the upstream depth alone but by the difference between upstream and downstream levels, and the gate becomes far worse as a measuring device: two metres of change downstream now alters the discharge more than two metres of change upstream. A gate used to measure discharge must therefore be kept in free flow.",
    diAtasAir: "Opening exceeds the upstream depth",
    terbalik: "The tailwater has risen above the headwater",
    terdorong: "The jump is swept downstream",
    terdorongNote:
      "The tailwater is still below the conjugate depth, so the jump cannot stand just downstream of the gate. It is swept downstream until bed friction has raised the depth enough to balance it, and how far depends on the slope and roughness of the channel below, which this sheet does not compute. The position of the jump in the drawing therefore says only that it exists somewhere downstream, not that it stands at that point. What matters for design: the stilling basin must be long enough to hold the jump at its farthest position, not its nearest.",
    terbalikNote:
      "The downstream level has reached or passed the upstream level, so no head difference is left to drive water through the gate. The discharge is zero, and raising the tailwater further would drive the flow the other way. This whole sheet assumes flow from upstream to downstream, so its numbers do not apply here. The force on the leaf does reverse sign, because the tailwater now pushes the gate upstream, and that is a case worth checking on its own when sizing the hoist stem: a gate computed for pressure from one side only can buckle when a downstream flood rises faster than the upstream one.",
    diAtasAirNote:
      "The gate opening is larger than the depth of water upstream, so the gate leaf stands entirely above the surface and does not touch the flow at all. What is there is an ordinary open channel, not a gate, and there is no gate discharge to compute. Lower the opening below the upstream depth.",
    bBebas: "Free, jump swept downstream",
    bTenggelam: "Submerged",
    bTerbalik: "Tailwater above headwater",
    badgeBebas: "Free",
    sBebas: (Q: string, rasio: string) => `Free: Q = ${Q} m³/s, y₃/y₂′ = ${rasio}.`,
    sTenggelam: (Q: string, rasio: string) => `Submerged: Q = ${Q} m³/s, y₃/y₂′ = ${rasio}.`,
    sTerbalik: "Tailwater ≥ headwater: no flow downstream.",
    sDiAtasAir: "Opening ≥ y₁: the gate does not touch the flow.",
    saranTerbalik: "Lower the tailwater below the headwater and every number above becomes meaningful again.",
    saranDiAtasAir: "Lower the opening below the upstream depth and every number above becomes meaningful again.",
    gayaLebih: (h: string, f: string, p: string) =>
      `Hydrostatic pressure on the gate face alone gives ${h} kN per metre of width, against ${f} kN from momentum: ${p} per cent more. A hoist stem sized on pressure alone is oversized by that much.`,
    gayaKurang: (h: string, f: string, p: string) =>
      `Hydrostatic pressure on the gate face alone gives ${h} kN per metre of width, against ${f} kN from momentum: ${p} per cent less. A hoist stem sized on pressure alone is undersized; the true force comes from momentum.`,
    saranBebas: "Raise the tailwater past the conjugate depth and watch both the discharge and the force fall together.",
    saranTenggelam: "The gate is submerged, which lowers both the discharge and the force: the tailwater pushes back.",
    hCd: "Discharge coefficient from the contraction coefficient",
    hY2: "Depth and Froude number at the vena contracta",
    hYc: "Conjugate depth, compared with the tailwater",
    hQ: "Discharge, times the submergence factor when submerged",
    hF: "Force on the gate leaf from the momentum difference",
    hMati: "The gate formula does not apply in this state",
    note:
      "The discharge coefficient of a sluice gate is often presented as a number to look up, when it can be derived entirely from one quantity, the contraction coefficient. The energy equation between the upstream section and the vena contracta gives Cd as Cc divided by the square root of one plus Cc a over y1, and that form automatically shrinks as the opening approaches the upstream depth. No table needs memorising. Note also that the force on the gate leaf is not simply the hydrostatic pressure on its face. Water accelerated under the gate carries momentum, and the force the gate leaf actually holds is the difference between the momentum upstream and downstream. The direction and size of the difference depend on the opening: on a small opening in a deep channel the two differ by only a few per cent, while on a large opening hydrostatic pressure on the leaf face alone is far smaller than the momentum force. A hoist stem sized on pressure alone can therefore be undersized; compute it from momentum.",
  },
} as const;

const REFS = {
  id: [
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan, Bab 6.",
    "Rajaratnam, N. & Subramanya, K. (1967). Flow equation for the sluice gate. Journal of the Irrigation and Drainage Division, ASCE, vol. 93.",
    "USBR (1974). Design of Small Canal Structures, bab bangunan pengatur.",
    "Swamee, P.K. (1992). Sluice-gate discharge equations. Journal of Irrigation and Drainage Engineering, vol. 118.",
  ],
  en: [
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan, Chapter 6.",
    "Rajaratnam, N. & Subramanya, K. (1967). Flow equation for the sluice gate. Journal of the Irrigation and Drainage Division, ASCE, vol. 93.",
    "USBR (1974). Design of Small Canal Structures, chapters on control structures.",
    "Swamee, P.K. (1992). Sluice-gate discharge equations. Journal of Irrigation and Drainage Engineering, vol. 118.",
  ],
} as const;

export function PintuSorongClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [y1, setY1] = useState(3);
  const [a, setA] = useState(0.5);
  const [b, setB] = useState(4);
  const [y3, setY3] = useState(0.8);
  const [Cc, setCc] = useState(ORIFICE_CC_SLOT);

  const r = sluiceGate(y1, a, b, y3, Cc);
  const takAda = "—";
  /*
   * Dua keadaan yang sama-sama membuat seluruh angka lembar ini tidak
   * berlaku: pintu yang terangkat seluruhnya di atas air, dan muka air hilir
   * yang sudah melampaui muka air hulu. Keduanya diperlakukan sama di
   * tampilannya, dan hanya nama serta keterangannya yang berbeda.
   */
  const mati = r.gateAboveWater || r.reversed;
  /*
   * Loncatan hanya dapat berdiri tepat di hilir pintu bila muka air hilir
   * sudah mencapai kedalaman lawannya. Di bawah itu ia terdorong ke hilir
   * sejauh yang ditentukan gesekan dasar saluran, yaitu sesuatu yang tidak
   * dihitung lembar ini. Gambarnya boleh tetap memperlihatkan loncatan, asal
   * lembarnya berterus terang bahwa letaknya belum tentu di situ.
   */
  const terdorong = !mati && !r.submerged && y3 < r.yConjugate;

  /* Pita y₃/y₂′: batas tenggelam y₃ = y₂′ (sluiceGate) dan batas terbalik
     y₃ = y₁ (reversed), keduanya Henderson 1966 Bab 6. */
  const rasioHilir = r.yConjugate > 0 ? y3 / r.yConjugate : NaN;
  const batasTerbalik = r.yConjugate > 0 ? Math.min(Math.max(y1 / r.yConjugate, 1.0001), 149) : 149;

  /* Nilai antara langkah debit. Lib belum menyimpan debit bebas dan faktor
     tenggelam sebagai field (PERMINTAAN ke pengembang-model), jadi Qbebas
     dihitung dengan rumus yang sama persis dengan lib dari r.Cd, dan ψ
     dibaca balik dari r.Q, sehingga hasil langkah sama dengan tabel. */
  const Qbebas = r.Cd * b * a * Math.sqrt(2 * G * y1);
  const psi = Qbebas > 0 ? r.Q / Qbebas : NaN;
  const keadaan = bacaKeadaan(y1, a, y3, r, terdorong, lang);

  const ref = useCanvas(
    (ctx, w, ch) => {
      const xKiri = -Math.max(y1 * 2.2, 3);
      const xKanan = Math.max(y1 * 2.6, 4);
      const tebalPintu = Math.max(y1 * 0.035, 0.06);

      /*
       * Letak mendatar keempat tanda hilir DIPATOK PADA BIDANGNYA, bukan pada
       * kelipatan bukaan pintunya.
       *
       * Sebelumnya vena contracta berada di 2,2a dan loncatannya membentang
       * dari 5a sampai 8,5a. Itu berjalan selama bukaannya kecil, yaitu satu
       * satunya bukaan yang pernah dicoba saat lembarnya ditulis. Pada bukaan
       * dua setengah meter keempatnya sudah jauh di luar bidang gambar, jadi
       * loncatannya tidak pernah tergambar sama sekali dan muka airnya
       * tinggal melandai lurus tanpa arti. Sekarang jaraknya tetap mengikuti
       * bukaannya selama masih masuk, lalu ditahan di batas bidangnya.
       */
      const xVena = Math.min(Math.max(a * 2.2, tebalPintu * 6), xKanan * 0.22);
      const xVenaAkhir = Math.min(Math.max(a * 5, xVena * 1.6), xKanan * 0.38);
      const xLoncatAwal = terdorong ? xKanan * 0.72 : xKanan * 0.5;
      const xLoncatAkhir = terdorong ? xKanan * 0.88 : xKanan * 0.68;

      // Daun pintu: bidang tegak dari bukaan ke atas muka air.
      const daun: { x: number; z: number }[] = [
        { x: -tebalPintu / 2, z: a },
        { x: tebalPintu / 2, z: a },
        { x: tebalPintu / 2, z: y1 * 1.25 },
        { x: -tebalPintu / 2, z: y1 * 1.25 },
      ];

      // Muka air: mendatar di hulu, turun tajam lewat bukaan, lalu keadaan
      // hilir menurut bebas atau tenggelam.
      const muka: { x: number; z: number }[] = r.gateAboveWater
        ? [
            { x: xKiri, z: y1 },
            { x: xKanan, z: y1 },
          ]
        : r.reversed
          ? /* Sengaja digambar apa adanya: muka air hilir yang duduk lebih
               tinggi daripada muka air hulu adalah seluruh sebab keadaan ini
               tidak berlaku, jadi justru itulah yang harus terlihat. */
            [
              { x: xKiri, z: y1 },
              { x: -tebalPintu, z: y1 },
              { x: tebalPintu * 3, z: y3 },
              { x: xKanan, z: y3 },
            ]
          : r.submerged
          ? [
              { x: xKiri, z: y1 },
              { x: -tebalPintu, z: y1 * 0.99 },
              { x: tebalPintu * 3, z: y3 * 1.02 },
              { x: xKanan, z: y3 },
            ]
          : [
              { x: xKiri, z: y1 },
              { x: -tebalPintu, z: y1 * 0.98 },
              { x: tebalPintu, z: r.y2 * 1.35 },
              { x: xVena, z: r.y2 },
              { x: xVenaAkhir, z: r.y2 },
              { x: xLoncatAwal, z: r.yConjugate * 0.75 },
              { x: xLoncatAkhir, z: r.yConjugate },
              { x: xKanan, z: Math.max(r.yConjugate, y3) },
            ];

      const spec: StructureSpec = {
        xMin: xKiri,
        xMax: xKanan,
        zMin: -y1 * 0.12,
        zMax: Math.max(y1, r.reversed ? y3 : 0) * 1.35,
        bodies: [
          { pts: daun, color: C.ink },
          {
            pts: [
              { x: xKiri, z: 0 },
              { x: xKanan, z: 0 },
              { x: xKanan, z: -y1 * 0.12 },
              { x: xKiri, z: -y1 * 0.12 },
            ],
          },
        ],
        waters: [
          {
            surface: muka,
            bed: [
              { x: xKanan, z: 0 },
              { x: xKiri, z: 0 },
            ],
            invalid: mati,
          },
        ],
        lines: mati
          ? []
          : [
              {
                pts: [
                  { x: xLoncatAwal, z: r.yConjugate },
                  { x: xKanan, z: r.yConjugate },
                ],
                color: C.critical,
                weight: W.thin,
                dash: DASH.phantom,
                /*
                 * Labelnya di UJUNG KANAN garisnya, bukan di pangkalnya.
                 * Di pangkalnya ia berebut ruang dengan nama vena contracta
                 * pada bukaan kecil, yang loncatannya dangkal sehingga
                 * keduanya jatuh pada ketinggian yang hampir sama dan
                 * terbaca sebagai satu baris tulisan.
                 */
                label: `y₂′ ${fmtPlain(r.yConjugate, 2)} m`,
                labelAt: 0.88,
                labelDy: -10,
                labelAlign: "right",
              },
            ],
        dims: mati
          ? []
          : [
              {
                axis: "v",
                at: xKiri * 0.62,
                from: 0,
                to: y1,
                text: `y₁ ${fmtPlain(y1, 2)} m`,
                color: C.water,
              },
              {
                /*
                 * Ukuran bukaannya ditaruh di sisi HULU pintunya. Di sisi
                 * hilir ia berebut ruang dengan nama vena contracta, dan
                 * pada bukaan besar keduanya benar-benar bertindihan.
                 */
                axis: "v",
                at: -tebalPintu * 4,
                from: 0,
                to: a,
                text: `a ${fmtPlain(a, 2)} m`,
                color: C.ink,
              },
            ],
        callouts: mati
          ? []
          : [
              {
                /*
                 * Namanya menunjuk KE ATAS, ke ruang kosong di antara muka
                 * air dan garis kedalaman lawan loncatannya. Menunjuk ke
                 * bawah menaruhnya di bawah garis dasar, yaitu di dalam
                 * tanah, karena vena contracta memang dangkal.
                 *
                 * Warnanya tinta biasa: vena contracta keadaan yang sehat,
                 * dan merah sinyal hanya untuk yang di luar rentang berlaku.
                 * Menjulurnya KE KANAN, ke arah hilir. Menjulur ke kiri
                 * membawanya kembali melintasi ukuran bukaan pintunya,
                 * karena namanya panjang sedangkan vena contracta duduk
                 * dekat sekali dengan pintunya.
                 */
                x: xVena,
                z: r.y2,
                dx: 16,
                dy: -30,
                text: T.venaSection,
              },
              {
                x: 0,
                z: y1 * 1.1,
                dx: 34,
                dy: -18,
                text: T.gateLeaf,
              },
            ],
        arrows: mati ? [] : [{ x: xKiri * 0.7, z: y1 * 0.45, length: 26 }],
        heading: r.gateAboveWater
          ? x.diAtasAir
          : r.reversed
            ? x.terbalik
            : r.submerged
              ? T.submergedGate
              : terdorong
                ? x.terdorong
                : undefined,
        /*
         * Merah sinyal hanya untuk kedua keadaan yang di luar rentang
         * berlaku. Pintu tenggelam keadaan kerja yang sah, cuma buruk
         * sebagai alat ukur, jadi warnanya ungu kritis seperti perubahan
         * rezim di lembar-lembar lain.
         */
        headingColor: mati ? C.signal : C.critical,
        axisX: T.axHoriz,
        axisZ: T.axLevel,
      };

      drawStructure(ctx, w, ch, spec, lang);
    },
    [y1, a, b, y3, Cc, lang]
  );

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="y₃/y₂′"
          value={r.gateAboveWater ? NaN : rasioHilir}
          scale="log"
          digits={3}
          invalid={mati}
          pesan={r.gateAboveWater ? x.diAtasAir : undefined}
          bands={
            r.gateAboveWater
              ? [{ from: 0.002, to: 150, label: x.diAtasAir, tone: "invalid" }]
              : [
                  { from: 0.002, to: 1, label: x.bBebas, tone: "water" },
                  { from: 1, to: batasTerbalik, label: x.bTenggelam, tone: "critical" },
                  { from: batasTerbalik, to: 150, label: x.bTerbalik, tone: "invalid" },
                ]
          }
        />
      }
      sheet="HS-03"
      subject={SUBJECTS.HS[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Koefisien debitnya tidak perlu dicari di tabel: ia turun seluruhnya
            dari <Term tint={C.water}>satu koefisien kontraksi</Term>. Dan gaya
            pada daun pintunya bukan tekanan hidrostatis, melainkan{" "}
            <Term tint={C.critical}>selisih momentum</Term>.
          </p>
        ) : (
          <p>
            The discharge coefficient need not be looked up: it follows entirely
            from <Term tint={C.water}>one contraction coefficient</Term>. And
            the force on the gate leaf is not hydrostatic pressure but a{" "}
            <Term tint={C.critical}>difference of momentum</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HS-03"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "a/y₁", value: fmt(a / y1, 3), tint: r.gateAboveWater ? C.signal : undefined },
            { label: "Cd", value: mati ? takAda : fmt(r.Cd, 3) },
            { label: "Q", value: mati ? takAda : `${fmt(r.Q, 2)} m³/s`, tint: C.water },
            {
              label: "F",
              value: mati ? takAda : `${fmt(r.gateForce / 1000, 1)} kN/m`,
              tint: C.energy,
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
              <InputRow symbol="y₁" label={x.dY1} value={y1} min={0.2} max={12} step={0.1} digits={1} unit="m" onChange={setY1} tint={C.water} />
              <InputRow symbol="a" label={x.dA} value={a} min={0.02} max={6} step={0.02} digits={2} unit="m" onChange={setA} />
              <InputRow symbol="b" label={x.dB} value={b} min={0.5} max={30} step={0.5} digits={1} unit="m" onChange={setB} />
              <InputRow symbol="y₃" label={x.dY3} value={y3} min={0.02} max={12} step={0.02} digits={2} unit="m" onChange={setY3} tint={C.water} />
              <InputRow symbol="Cc" label={x.dCc} value={Cc} min={0.55} max={0.75} step={0.005} digits={3} onChange={setCc} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pBebas, apply: () => { setY1(3); setA(0.5); setB(4); setY3(0.8); setCc(ORIFICE_CC_SLOT); } },
                  { label: x.pTenggelam, apply: () => { setY1(3); setA(0.5); setB(4); setY3(2.2); setCc(ORIFICE_CC_SLOT); } },
                  { label: x.pBukaBesar, apply: () => { setY1(3); setA(2.5); setB(4); setY3(0.8); setCc(ORIFICE_CC_SLOT); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "Q", label: x.rQ, value: mati ? takAda : fmt(r.Q, 3), unit: mati ? undefined : "m³/s", tint: C.water, strong: true },
                { symbol: "F", label: x.rGaya, value: mati ? takAda : fmt(r.gateForce / 1000, 3), unit: mati ? undefined : "kN/m", tint: C.energy, strong: true },
                { symbol: "Cd", label: x.rCd, value: mati ? takAda : fmt(r.Cd, 4) },
                { symbol: "y₂", label: x.rY2, value: mati ? takAda : fmt(r.y2, 4), unit: mati ? undefined : "m", tint: C.water },
                { symbol: "y₂′", label: x.rYc, value: mati ? takAda : fmt(r.yConjugate, 4), unit: mati ? undefined : "m", tint: C.critical },
                { symbol: "Fr₂", label: x.rFr2, value: mati ? takAda : fmt(r.Fr2, 3) },
                { symbol: "Ftot", label: x.rGayaTotal, value: mati ? takAda : fmt((r.gateForce * b) / 1000, 2), unit: mati ? undefined : "kN", tint: C.energy },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={
                  mati
                    ? [
                        {
                          judul: x.hMati,
                          rumus: <span>{r.gateAboveWater ? "a ≥ y₁" : "y₃ ≥ y₁"}</span>,
                          isi: r.gateAboveWater
                            ? `${fmt(a, 2)} m ≥ ${fmt(y1, 1)} m`
                            : `${fmt(y3, 2)} m ≥ ${fmt(y1, 1)} m`,
                          hasil: "—",
                        },
                      ]
                    : [
                        {
                          judul: x.hCd,
                          rumus: (<><span>Cd =</span><Frac num="Cc" den="√( 1 + Cc · a / y₁ )" /></>),
                          isi: `${fmt(Cc, 3)} / √( 1 + ${fmt(Cc, 3)} · ${fmt(a, 2)} / ${fmt(y1, 1)} )`,
                          hasil: fmt(r.Cd, 4),
                        },
                        {
                          judul: x.hY2,
                          rumus: (<><span>y₂ = Cc · a</span><span className="ml-3">Fr₂ =</span><Frac num="q" den="y₂ · √( g · y₂ )" /></>),
                          isi: `y₂ = ${fmt(Cc, 3)} · ${fmt(a, 2)} = ${fmt(r.y2, 5)} m; q = ${fmt(Qbebas / b, 4)} m²/s; ${fmt(Qbebas / b, 4)} / ( ${fmt(r.y2, 5)} · √( ${fmt(G, 2)} · ${fmt(r.y2, 5)} ) )`,
                          hasil: fmt(r.Fr2, 3),
                          tint: C.water,
                        },
                        {
                          judul: x.hYc,
                          rumus: (<><span>y₂′ =</span><Frac num="y₂" den="2" /><span>· ( √( 1 + 8 Fr₂² ) − 1 )</span></>),
                          isi: `( ${fmt(r.y2, 5)} / 2 ) · ( √( 1 + 8 · ${fmt(r.Fr2, 4)}² ) − 1 ) ; y₃ = ${fmt(y3, 2)} m ${r.submerged ? ">" : "≤"} y₂′ → ${r.submerged ? x.bTenggelam.toLowerCase() : x.badgeBebas.toLowerCase()}`,
                          hasil: fmt(r.yConjugate, 4),
                          satuan: "m",
                          tint: C.critical,
                        },
                        {
                          judul: x.hQ,
                          rumus: r.submerged ? (
                            <span>Q = Cd · b · a · √( 2 g y₁ ) · ψ,  ψ = √( ( y₁ − y₃ ) / ( y₁ − y₂′ ) )</span>
                          ) : (
                            <span>Q = Cd · b · a · √( 2 g y₁ )</span>
                          ),
                          isi:
                            `${fmt(r.Cd, 5)} · ${fmt(b, 1)} · ${fmt(a, 2)} · √( 2 · ${fmt(G, 2)} · ${fmt(y1, 1)} )` +
                            (r.submerged
                              ? ` = ${fmt(Qbebas, 4)} m³/s; ψ = √( ( ${fmt(y1, 1)} − ${fmt(y3, 2)} ) / ( ${fmt(y1, 1)} − ${fmt(r.yConjugate, 4)} ) ) = ${fmt(psi, 4)}`
                              : ""),
                          hasil: fmt(r.Q, 3),
                          satuan: "m³/s",
                          tint: C.water,
                        },
                        {
                          judul: x.hF,
                          rumus: (<><span>F = M₁ − M₂,  M =</span><Frac num="ρ g y²" den="2" /><span>+</span><Frac num="ρ q²" den="y" /></>),
                          isi: `q = ${fmt(r.Q / b, 4)} m²/s; y₁ = ${fmt(y1, 1)} m, ${r.submerged ? `y₃ = ${fmt(y3, 2)}` : `y₂ = ${fmt(r.y2, 4)}`} m`,
                          hasil: fmt(r.gateForce / 1000, 3),
                          satuan: "kN/m",
                          tint: C.energy,
                        },
                      ]
                }
              />
            </div>
          </Block>

          <StateCard {...keadaan} />
        </>
      }
      verification={<Verification checks={checksSluice(y1, a, b, y3, Cc)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Q = Cd b a √(2 g y₁)</span>
                <span className="ml-5">Cd =</span>
                <Frac num="Cc" den="√(1 + Cc a / y₁)" />
              </Eq>
              <Eq>
                <span>F = M₁ − M₂</span>
                <span className="ml-4">M =</span>
                <Frac num="ρ g y²" den="2" />
                <span>+</span>
                <Frac num="ρ q²" den="y" />
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "tenggelam bila y₃ melebihi kedalaman lawan loncatan dari vena contracta"
                    : "submerged when y₃ exceeds the conjugate depth from the vena contracta"}
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
 * Keadaan dan butirnya. Kedua bendera dikirim terpisah (CACAT 1): versi
 * lama mengirim `gateAboveWater || reversed` sebagai satu bendera, jadi
 * saat muka air hilir di atas hulu lembar menyarankan "turunkan bukaannya".
 * Kalimat gaya dibangun dari tanda selisihnya (CACAT 2): hidrostatis bisa
 * lebih besar (bukaan kecil, saluran dalam) atau jauh lebih kecil (bukaan
 * besar) daripada gaya momentum.
 */
function bacaKeadaan(
  y1: number,
  a: number,
  y3: number,
  r: ReturnType<typeof sluiceGate>,
  terdorong: boolean,
  lang: Lang
): { tone: Tone; badge: string; state: string; notice: string[] } {
  const x = TXT[lang];
  if (r.gateAboveWater)
    return { tone: "invalid", badge: x.diAtasAir, state: x.sDiAtasAir, notice: [x.diAtasAirNote, x.saranDiAtasAir] };
  if (r.reversed)
    return { tone: "invalid", badge: x.terbalik, state: x.sTerbalik, notice: [x.terbalikNote, x.saranTerbalik] };

  const hidrostatis = (1000 * G * (y1 - a) * (y1 - a)) / 2;
  const selisih = r.gateForce > 0 ? ((hidrostatis - r.gateForce) / r.gateForce) * 100 : 0;
  const gaya = (selisih >= 0 ? x.gayaLebih : x.gayaKurang)(
    fmt(hidrostatis / 1000, 1),
    fmt(r.gateForce / 1000, 1),
    fmt(Math.abs(selisih), 0)
  );
  const rasio = fmt(r.yConjugate > 0 ? y3 / r.yConjugate : NaN, 3);

  if (r.submerged)
    return {
      tone: "critical",
      badge: x.tenggelam,
      state: x.sTenggelam(fmt(r.Q, 3), rasio),
      notice: [x.tenggelamNote, gaya, x.saranTenggelam],
    };
  return {
    tone: "water",
    badge: terdorong ? x.terdorong : x.badgeBebas,
    state: x.sBebas(fmt(r.Q, 3), rasio),
    notice: [...(terdorong ? [x.terdorongNote] : []), gaya, x.saranBebas],
  };
}
