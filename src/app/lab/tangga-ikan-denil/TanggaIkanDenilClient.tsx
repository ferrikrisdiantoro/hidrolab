"use client";

import { useMemo, useRef, useState } from "react";
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
  type SheetView,
} from "@/components/ui";
import { TombolPandang } from "@/components/Pandangan";
import { usePandangan } from "@/lib/usePandangan";
import { useCanvas } from "@/lib/useCanvas";
import { isometrikBaku } from "@/lib/proyeksi";
import { DragLayer, type HandleSpec } from "@/components/DragLayer";
import { usePlate } from "@/lib/usePlate";
import type { ParamDef } from "@/lib/rentang";
import { drawStructure, type StructureBody, type StructureSpec } from "@/lib/drawStructure";
import {
  MARGIN_ISO,
  PANDANG_AWAL,
  PANJANG_GAMBAR_MAKS,
  RUANG_JUDUL_ISO,
  drawIsoDenil,
  profilSirip,
  rasioIsoDenil,
  siripDenil,
} from "@/lib/drawIsoDenil";
import {
  DENIL_B_OVER_B0,
  DENIL_Q_COEF,
  DENIL_RUN_MAX,
  DENIL_SLOPE_MAX,
  DENIL_SLOPE_MIN,
  DENIL_UM_COEF,
  DENIL_UM_EXP,
  DENIL_YB_MAX,
  DENIL_YB_MIN,
  FISHWAY_POWER_GENERAL,
  G,
  denilFishway,
  fmt,
  fmtPlain,
} from "@/lib/hydraulics";
import { C, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksDenil } from "@/lib/checks";

const TXT = {
  id: {
    title: "Tangga ikan Denil",
    sheetTitle: "Tangga ikan Denil — sirip penahan miring ke hulu",
    isoHeading: "tampak isometrik",
    aksoHeading: "tampak 3D (aksonometri)",
    isoTerpotong: (L: string) => `L = ${L} m, digambar ${PANJANG_GAMBAR_MAKS} m pertama`,
    isoCatatan:
      "Gambar 3D skematik. Lebar bukaan b0, kemiringan, panjang, dan kedalaman air (tegak lurus lantai) dari model. Proporsi sirip dari Denil baku (Katopodis 1992 Gbr. 5.3 dan Tabel 5.2): lebar dalam palung 1,58 b0, bukaan tengah selebar b0 tempat ikan lewat, jarak sirip 0,715 b0, pelat datar condong 45° ke hulu terhadap dasar. Tinggi sayap sirip, tinggi ambang bawah bukaan, serta tinggi dan tebal dinding skematik karena tidak terbaca dari sumber. Aliran sekunder (putaran balik di dekat dinding dan dasar) tidak digambar karena model tidak memuatnya. Dinding sisi dekat dibuang supaya sirip dan air terlihat.",
    dB: "Lebar bukaan antar sirip (b0), lebar palung B ≈ 1,58 b0",
    dY: "Kedalaman aliran tegak lurus dasar",
    dS: "Kemiringan palung",
    dRise: "Beda tinggi seluruhnya",
    dU: "Kecepatan sentak (burst) ikan rancangan",
    pBaku: "Rancangan baku",
    pCuram: "Terlalu curam",
    pLebar: "Palung lebar, debit besar",
    gY: "Kedalaman aliran y tegak lurus dasar, seret muka air naik atau turun",
    gS: "Kemiringan palung S, seret ujung hilir lantai palung naik atau turun",
    rQ: "Debit yang lewat",
    rVmean: "Kecepatan rata-rata",
    rVmax: "Kecepatan acuan di sumbu, pada 75 % kedalaman (um')",
    rEps: "Lesapan daya per satuan isi",
    rRasio: "Terhadap batas tangga berkolam",
    rLength: "Panjang palung",
    rIstirahat: "Panjang terpanjang tanpa kolam istirahat",
    curam: "Kemiringan di luar rentang rancangan",
    sBawah: "Di bawah kurva Denil",
    sRancang: "Rentang rancangan",
    sAtas: "Di atas kurva Denil",
    vDapat: "Dapat dilawan",
    vTak: "Tak terlawan",
    lebihL: "L > 10 m",
    aman: "Dapat dilewati",
    hRasio: "Kedalaman nisbi dan debit tak berdimensi",
    hQ: "Debit",
    hV: "Kecepatan rata-rata pada luas palung B · y",
    hUm: "Kecepatan acuan di sumbu (um')",
    umNote:
      "Pada Denil papan datar kecepatan naik dari dasar ke muka air, jadi um' adalah skala kecepatan, bukan puncak mutlak; di dekat muka air arusnya sedikit lebih cepat (Katopodis 1992 hlm. 20 dan 22). Ikan melawan arus ini sepanjang palung tanpa jeda, jadi bandingkan dengan kecepatan sentak (burst) yang hanya bertahan kurang dari 15 detik (hlm. 2).",
    epsNote:
      "Pembanding saja: batas 150 W/m³ berlaku untuk tangga berkolam; Katopodis (1992) tidak memberi batas lesapan untuk Denil.",
    ybLuar: (v: string) =>
      `y/b = ${v} di luar rentang data kurva debit (0,5 sampai 5,8, Katopodis 1992 Tabel 5.2); Q adalah ekstrapolasi.`,
    hEps: "Lesapan daya per isi palung",
    hL: "Panjang palung",
    banding: "dibanding",
    curamNote:
      "Kemiringan palung di luar rentang sepersepuluh sampai seperempat. Di bawahnya sirip penahan tidak lagi menimbulkan putaran balik yang cukup dan palungnya berperilaku seperti saluran biasa, sehingga tidak ada gunanya memasang sirip sama sekali. Di atasnya kecepatan di sumbu palung naik melampaui yang sanggup dilawan hampir semua jenis ikan sungai, dan tangga ikannya menjadi penghalang alih-alih lintasan. Rentang ini adalah praktik rancangan menurut Katopodis (1992) hlm. 5: 10–15 % untuk ikan air tawar dewasa dan 15–25 % untuk salmon dewasa.",
    lambat: "Ikan tidak sanggup melawan arus di sumbu palung",
    lambatNote:
      "Kecepatan acuan di sumbu palung (um') melampaui kecepatan sentak ikan rancangan, sehingga ikan tidak dapat maju. Perlu diingat bahwa kecepatan sentak hanya dapat dipertahankan kurang dari 15 detik, jadi memenuhi syarat ini tepat di ambangnya berarti merancang palung yang hanya dapat dilewati sekali oleh ikan yang benar-benar segar. Landaikan palungnya, atau pilih jenis ikan rancangan yang lebih lemah dan rancang untuknya.",
    istirahat: "Butuh kolam istirahat",
    istirahatNote:
      "Palungnya lebih panjang daripada sepuluh meter tanpa kolam istirahat. Karena ikan melewati tangga Denil dengan berenang sentak dan bukan berenang jelajah, panjang palung tanpa jeda dibatasi oleh berapa lama sentakan itu dapat dipertahankan, bukan oleh kekuatan bangunannya. Sisipkan kolam istirahat setiap 5–10 m untuk ikan air tawar dan 10–15 m untuk salmon (Katopodis 1992 hlm. 5).",
    note:
      "Yang membuat tangga Denil bekerja bukan penghalangan melainkan pembalikan. Sirip yang miring ke hulu memaksa sebagian air berputar balik di dekat dinding dan dasar palung, dan putaran balik itu melesap tenaga tanpa menutup lintasan di tengah. Ikan berenang di sepanjang sumbu, tempat airnya masih mengalir maju tetapi jauh lebih lambat daripada kemiringan palungnya seharusnya membuatnya. Harga yang dibayar untuk lintasan yang jauh lebih pendek daripada tangga berkolam adalah keteradukan: pada contoh baku lembar ini lesapan daya per isi palung sekitar sepuluh kali batas 150 W/m³ yang dipakai untuk tangga berkolam, dan angkanya naik bersama kedalaman dan kemiringan. Angka itu pembanding saja, karena Katopodis (1992) tidak memberi batas lesapan untuk Denil. Itu bukan cacat rancangan melainkan ciri alatnya, dan akibatnya jelas: Denil hanya cocok untuk jenis ikan yang kuat berenang, selalu menuntut kolam istirahat pada jarak tertentu, dan sama sekali tidak cocok untuk ikan kecil atau ikan yang bergerak di dasar.",
  },
  en: {
    title: "Denil fishway",
    sheetTitle: "Denil fishway — baffles angled upstream",
    isoHeading: "isometric view",
    aksoHeading: "3D view (axonometric)",
    isoTerpotong: (L: string) => `L = ${L} m, first ${PANJANG_GAMBAR_MAKS} m drawn`,
    isoCatatan:
      "Schematic 3D drawing. Opening width b0, slope, length and water depth (normal to the invert) come from the model. Baffle proportions follow the standard Denil (Katopodis 1992 Fig. 5.3 and Table 5.2): inside trough width 1.58 b0, a central opening b0 wide where the fish passes, baffle spacing 0.715 b0, flat plates inclined 45° upstream to the invert. Baffle wing height, the height of the sill under the opening, and wall height and thickness are schematic because the source does not give them. Secondary flow (the reverse rotation near the walls and invert) is not drawn because the model does not hold it. The near sidewall is removed so the baffles and water can be seen.",
    dB: "Baffle opening width (b0), trough width B ≈ 1.58 b0",
    dY: "Flow depth normal to the invert",
    dS: "Trough slope",
    dRise: "Total rise",
    dU: "Burst speed of the design fish",
    pBaku: "Standard design",
    pCuram: "Too steep",
    pLebar: "Wide trough, large discharge",
    gY: "Flow depth y normal to the invert, drag the water surface up or down",
    gS: "Trough slope S, drag the downstream end of the trough floor up or down",
    rQ: "Discharge through the trough",
    rVmean: "Mean velocity",
    rVmax: "Centreline reference velocity at 75 % of depth (um')",
    rEps: "Power dissipated per unit volume",
    rRasio: "Against the pool fishway limit",
    rLength: "Trough length",
    rIstirahat: "Longest run without a resting pool",
    curam: "Slope outside the design range",
    sBawah: "Below the Denil curves",
    sRancang: "Design range",
    sAtas: "Above the Denil curves",
    vDapat: "Can be beaten",
    vTak: "Cannot be beaten",
    lebihL: "L > 10 m",
    aman: "Passable",
    hRasio: "Relative depth and dimensionless discharge",
    hQ: "Discharge",
    hV: "Mean velocity over the trough area B · y",
    hUm: "Centreline reference velocity (um')",
    umNote:
      "In a plain Denil velocity rises from the floor to the surface, so um' is a velocity scale, not the absolute peak; flow near the surface is somewhat faster (Katopodis 1992 pp. 20 and 22). Fish swim against it along the whole run without a break, so compare it with the burst speed, which lasts under 15 seconds (p. 2).",
    epsNote:
      "For comparison only: the 150 W/m³ limit applies to pool fishways; Katopodis (1992) gives no dissipation limit for Denils.",
    ybLuar: (v: string) =>
      `y/b = ${v} is outside the rating data range (0.5 to 5.8, Katopodis 1992 Table 5.2); Q is an extrapolation.`,
    hEps: "Dissipation per trough volume",
    hL: "Trough length",
    banding: "against",
    curamNote:
      "The trough slope lies outside one tenth to one quarter. Below it the baffles no longer set up enough reverse rotation and the trough behaves like an ordinary channel, so fitting baffles at all serves no purpose. Above it the axial velocity rises past what almost any river species can beat, and the fishway becomes a barrier rather than a passage. This range is design practice per Katopodis (1992) p. 5: 10–15 % for adult freshwater fish and 15–25 % for adult salmon.",
    lambat: "The fish cannot beat the axial velocity",
    lambatNote:
      "The centreline reference velocity (um') exceeds the design fish's burst speed, so the fish cannot advance. Remember that burst speed can be held for under 15 seconds, so meeting this condition exactly at its limit means designing a trough that can be passed once by a genuinely fresh fish. Flatten the trough, or choose a weaker design species and design for that.",
    istirahat: "Resting pool required",
    istirahatNote:
      "The trough is longer than ten metres without a resting pool. Because fish pass a Denil by burst swimming rather than cruising, the length of an uninterrupted run is limited by how long that burst can be held, not by the strength of the structure. Insert a resting pool every 5–10 m for freshwater fish and 10–15 m for salmon (Katopodis 1992 p. 5).",
    note:
      "What makes a Denil work is not obstruction but reversal. Baffles angled upstream force part of the water to rotate backwards near the walls and the invert, and that reverse rotation dissipates energy without closing the path down the middle. The fish swims along the axis, where the water still moves forward but far more slowly than the slope of the trough should make it. The price paid for a passage far shorter than a pool fishway is turbulence: in this sheet's standard example the dissipation per trough volume is about ten times the 150 W/m³ limit used for pool fishways, and it rises with depth and slope. That figure is a comparison only, because Katopodis (1992) gives no dissipation limit for Denils. That is not a design fault but a feature of the device, and its consequences are clear: a Denil suits only strong-swimming species, always demands resting pools at intervals, and does not suit small fish or bottom-moving fish at all.",
  },
} as const;

/*
 * Rentang y dan S (S dalam persen, seperti penggesernya): satu definisi untuk
 * penggeser, kotak angka, dan pegangan seret di gambar (aturan 4).
 */
const P_Y: ParamDef = { min: 0.2, max: 2, step: 0.05, digits: 2 };
const P_S: ParamDef = { min: 4, max: 40, step: 1, digits: 0 };

/** Batas bidang dan panjang palung tergambar, dikunci selama seret. */
type Bidang = { panjang: number; xMin: number; xMax: number; zMin: number; zMax: number };

const REFS = {
  id: [
    "Denil, G. (1909). Les échelles à poissons et leur application aux barrages de Meuse et d'Ourthe. Annales des Travaux Publics de Belgique.",
    "Bell, M.C. (1991). Fisheries Handbook of Engineering Requirements and Biological Criteria. US Army Corps of Engineers.",
    "Katopodis, C. (1992). Introduction to Fishway Design. Freshwater Institute, Winnipeg.",
    "Rajaratnam, N. & Katopodis, C. (1984). Hydraulics of Denil Fishways. Journal of Hydraulic Engineering 110(9), 1219–1233.",
    "FAO/DVWK (2002). Fish Passes: Design, Dimensions and Monitoring. FAO, Roma.",
  ],
  en: [
    "Denil, G. (1909). Les échelles à poissons et leur application aux barrages de Meuse et d'Ourthe. Annales des Travaux Publics de Belgique.",
    "Bell, M.C. (1991). Fisheries Handbook of Engineering Requirements and Biological Criteria. US Army Corps of Engineers.",
    "Katopodis, C. (1992). Introduction to Fishway Design. Freshwater Institute, Winnipeg.",
    "Rajaratnam, N. & Katopodis, C. (1984). Hydraulics of Denil Fishways. Journal of Hydraulic Engineering 110(9), 1219–1233.",
    "FAO/DVWK (2002). Fish Passes: Design, Dimensions and Monitoring. FAO, Rome.",
  ],
} as const;

export function TanggaIkanDenilClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [b, setB] = useState(0.6);
  const [y, setY] = useState(0.7);
  const [S, setS] = useState(0.2);
  const [rise, setRise] = useState(3);
  const [burst, setBurst] = useState(2.5);

  const r = denilFishway(b, y, S, rise);
  const tidakMampu = r.maxVelocity > burst;
  const yb = b > 0 ? y / b : 0;
  // y/b di luar data kurva debit (Katopodis 1992 Tabel 5.2): Q ekstrapolasi.
  const ybLuar = r.relDepthOutOfRange;
  const tintQ = ybLuar ? C.signal : C.water;
  const nada: Tone = r.slopeOutOfRange ? "invalid" : tidakMampu || r.needsRestPool ? "caution" : "pass";
  const badge = r.slopeOutOfRange ? x.curam : tidakMampu ? x.lambat : r.needsRestPool ? x.istirahat : x.aman;

  const sentuh = useRef<() => void>(() => {});
  /*
   * Bidang dan panjang palung yang digambar dikunci selama pegangan
   * diseret. Tanpa kunci, ujung atas sumbu tegak mengikuti y (1,25 y),
   * ujung bawahnya mengikuti S (dasar di ujung hilir), dan panjang palung
   * tergambar min(L, 8 m) mengikuti S lewat L = H/S, sedangkan skala dijaga
   * sama di kedua sumbu: tiap piksel geseran mengubah skala dan pegangan
   * saling kejar dengan sumbunya. Dilepas = semuanya dihitung ulang.
   */
  const [kunci, setKunci] = useState<Bidang | null>(null);
  const bidangRef = useRef<Bidang | null>(null);

  const plate = usePlate(
    (ctx, w, ch) => {
      // Potongan memanjang palung miring dengan sirip penahan miring ke hulu.
      const panjangBebas = Math.min(r.runLength, 8);
      const panjang = kunci ? kunci.panjang : panjangBebas;
      /* Aturan sirip satu sumber dengan tampak isometrik (siripDenil):
         jarak 0,715 b0 dan pelat condong 45° ke hulu terhadap dasar
         (Denil baku, Katopodis 1992 Gbr. 5.3, Tabel 5.2). Tampak samping
         memperlihatkan sayap sirip; tingginya skematik. */
      const { tebal, tinggi, xs: siripX } = siripDenil(b, y, S, panjang);

      const dasarDi = (xx: number) => -S * xx;
      // y di model tegak lurus dasar (Chow 1959 §1-3); tebal tegaknya di
      // gambar y·√(1+S²).
      const yTegak = y * Math.sqrt(1 + S * S);

      const badan: StructureBody[] = [
        // Lantai palung.
        {
          pts: [
            { x: 0, z: dasarDi(0) },
            { x: panjang, z: dasarDi(panjang) },
            { x: panjang, z: dasarDi(panjang) - tebal * 2 },
            { x: 0, z: dasarDi(0) - tebal * 2 },
          ],
        },
      ];

      // Sirip penahan: pelat condong 45° ke hulu (profilSirip).
      for (const xx of siripX) badan.push({ pts: profilSirip(xx, S, tebal, tinggi), color: C.ink });
      // Penunjuk sirip: 60 % tinggi sayap pada sirip kedua (atau satu-satunya).
      const pk = profilSirip(siripX[Math.min(1, siripX.length - 1)] ?? 0, S, tebal, tinggi);
      const tunjuk = { x: pk[0].x + 0.6 * (pk[3].x - pk[0].x), z: pk[0].z + 0.6 * (pk[3].z - pk[0].z) };

      const muka: { x: number; z: number }[] = [];
      for (let i = 0; i <= 40; i++) {
        const xx = (panjang * i) / 40;
        muka.push({ x: xx, z: dasarDi(xx) + yTegak });
      }

      /* Sisi kanan diberi ruang untuk ukuran y di hilir ujung palung; di HP
         0,08 panjang tinggal belasan piksel. */
      const bebas: Bidang = {
        panjang: panjangBebas,
        xMin: -panjangBebas * 0.08,
        xMax: panjangBebas * (w < 600 ? 1.15 : 1.08),
        zMin: dasarDi(panjangBebas) - tebal * 3,
        zMax: y * 1.25,
      };
      bidangRef.current = bebas;
      const bidang = kunci ?? bebas;
      /* Selama dikunci, garis ukur dipotong ke sumbu supaya tidak menembus
         bingkai; teksnya tetap nilai sebenarnya. Tanpa kunci tidak berubah. */
      const potongZ = (z: number) =>
        kunci ? Math.min(Math.max(z, kunci.zMin), kunci.zMax) : z;

      const spec: StructureSpec = {
        xMin: bidang.xMin,
        xMax: bidang.xMax,
        zMin: bidang.zMin,
        zMax: bidang.zMax,
        bodies: badan,
        waters: [
          {
            surface: muka,
            bed: [
              { x: panjang, z: dasarDi(panjang) },
              { x: 0, z: dasarDi(0) },
            ],
            invalid: r.slopeOutOfRange,
          },
        ],
        dims: [
          {
            /* Di hilir ujung palung, di luar daerah sirip: di tengah palung
               teksnya tertimpa sirip. Teks di kiri garis ukurnya, jadi
               garisnya digeser 20 px supaya teks lepas dari tepi genangan. */
            axis: "v",
            at: panjang,
            from: potongZ(dasarDi(panjang)),
            to: potongZ(dasarDi(panjang) + yTegak),
            text: `y·√(1+S²) ${fmtPlain(yTegak, 2)} m`,
            color: C.water,
            offset: 20,
          },
        ],
        callouts: [
          {
            x: tunjuk.x,
            z: tunjuk.z,
            dx: 20,
            dy: -32,
            text: T.baffleLabel,
          },
        ],
        arrows: [
          {
            // Di sumbu pada 75 % kedalaman, tempat um' (Katopodis 1992 pers. 5.2).
            x: panjang * 0.25,
            z: dasarDi(panjang * 0.25) + yTegak * 0.75,
            length: 28,
            color: tidakMampu ? C.caution : C.water,
          },
        ],
        heading: r.slopeOutOfRange
          ? x.curam
          : tidakMampu
            ? x.lambat
            : undefined,
        headingColor: r.slopeOutOfRange ? C.signal : C.caution,
        axisX: T.axHoriz,
        axisZ: T.axLevel,
        /*
         * Tempat pegangan, tidak digambar: muka air di 65 % panjang palung
         * (di antara ukuran y dan ujung hilir), dan ujung hilir lantai.
         */
        anchors: {
          muka: { x: panjang * 0.65, z: dasarDi(panjang * 0.65) + yTegak },
          lantai: { x: panjang, z: dasarDi(panjang) },
        },
      };

      return drawStructure(ctx, w, ch, spec, lang);
    },
    null,
    [
      b,
      y,
      S,
      rise,
      burst,
      lang,
      kunci ? kunci.panjang : NaN,
      kunci ? kunci.xMin : NaN,
      kunci ? kunci.xMax : NaN,
      kunci ? kunci.zMin : NaN,
      kunci ? kunci.zMax : NaN,
    ]
  );

  /*
   * Pemetaan balik, keduanya hanya tegak. Lantai palung adalah garis
   * z = -S x dari titik asal di ujung hulu, dan x jari tetap di x pegangan
   * saat seret dimulai (DragLayer mengunci sumbu yang tidak diseret):
   * - muka: muka air z = -S x + y, jadi y = z jari + S x.
   * - lantai: ujung hilir lantai z = -S x, jadi S = -z / x (dikali 100
   *   untuk persen). Panjang palung tergambar ikut dikunci selama seret,
   *   jadi x pegangan tidak bergeser bersama S dan pemetaannya satu-satu.
   */
  const handles: HandleSpec[] = [
    {
      id: "muka",
      anchor: "muka",
      axis: "y",
      label: x.gY,
      tint: C.water,
      param: P_Y,
      value: y,
      toValue: (px, py, m) => (m.invY(py) + S * m.invX(px)) / Math.sqrt(1 + S * S),
      onChange: setY,
      format: (v) => `y ${fmt(v, 2)} m`,
    },
    {
      id: "lantai",
      anchor: "lantai",
      axis: "y",
      label: x.gS,
      tint: C.energy,
      param: P_S,
      // Dibulatkan: 0,29 × 100 = 28,999999999999996 di titik mengambang.
      value: Math.round(S * 1e8) / 1e6,
      toValue: (px, py, m) => (-m.invY(py) / Math.max(m.invX(px), 1e-9)) * 100,
      onChange: (v) => setS(v / 100),
      format: (v) => `S ${fmt(v, 0)} %`,
    },
  ];
  const lepasKunci = () => setKunci(null);

  /* Tampak (Phase 3, 3D). Bawaan = potongan lama. */
  const [tampak, setTampak] = useState<SheetView>("potongan");
  const pandang = usePandangan(PANDANG_AWAL);
  const refIso = useCanvas(
    (ctx, cw, chh) => {
      if (tampak !== "isometrik") return;
      drawIsoDenil(
        ctx,
        cw,
        chh,
        { b, y, S, rise, burst },
        {
          yaw: pandang.yaw,
          pitch: pandang.pitch,
          heading: r.slopeOutOfRange
            ? x.curam
            : tidakMampu
              ? x.lambat
              : isometrikBaku(pandang.yaw, pandang.pitch)
                ? x.isoHeading
                : x.aksoHeading,
          headingColor: r.slopeOutOfRange ? C.signal : tidakMampu ? C.caution : undefined,
          teks: { sirip: T.baffleLabel, terpotong: x.isoTerpotong },
        }
      );
    },
    [tampak, pandang.yaw, pandang.pitch, b, y, S, rise, burst, lang]
  );
  const rasioIso = useMemo(() => rasioIsoDenil({ b, y, S, rise, burst }), [b, y, S, rise, burst]);
  const tinggiIso = `min(clamp(360px, 56vh, 620px), max(240px, calc(${rasioIso.toFixed(4)} * (100vw - ${
    48 + 2 * MARGIN_ISO
  }px) + ${2 * MARGIN_ISO + RUANG_JUDUL_ISO}px)))`;

  return (
    <LabShell
      status={
        <div className="flex flex-col gap-2">
          <RegimeScale
            symbol="S (%)"
            value={S * 100}
            invalid={r.slopeOutOfRange}
            digits={0}
            bands={[
              { from: 4, to: DENIL_SLOPE_MIN * 100 - 1e-9, label: x.sBawah, tone: "invalid" },
              { from: DENIL_SLOPE_MIN * 100, to: DENIL_SLOPE_MAX * 100, label: x.sRancang, tone: "pass" },
              { from: DENIL_SLOPE_MAX * 100, to: 40, label: x.sAtas, tone: "invalid" },
            ]}
          />
          <RegimeScale
            symbol="um'/Ub"
            value={r.maxVelocity / burst}
            scale="log"
            digits={2}
            bands={[
              { from: 0.1, to: 1, label: x.vDapat, tone: "pass" },
              { from: 1, to: 10, label: x.vTak, tone: "caution" },
            ]}
          />
        </div>
      }
      sheet="EH-02"
      subject={SUBJECTS.EH[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Sirip yang miring ke hulu tidak menghalangi aliran melainkan{" "}
            <Term tint={C.energy}>membalikkan sebagiannya</Term>. Lintasan di
            tengah palung tetap terbuka, jauh lebih lambat daripada kemiringan
            palungnya seharusnya membuatnya.
          </p>
        ) : (
          <p>
            Baffles angled upstream do not obstruct the flow but{" "}
            <Term tint={C.energy}>reverse part of it</Term>. The path down the
            middle stays open, far slower than the slope of the trough should
            make it.
          </p>
        )
      }
      drawing={
        <Sheet
          number="EH-02"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "S", value: `${fmt(S * 100, 0)} %`, tint: r.slopeOutOfRange ? C.signal : undefined },
            { label: "Q", value: `${fmt(r.Q, 3)} m³/s`, tint: tintQ },
            { label: "um'", value: `${fmt(r.maxVelocity, 2)} m/s`, tint: tidakMampu ? C.caution : C.energy },
            { label: "L", value: `${fmt(r.runLength, 1)} m` },
          ]}
          height={tampak === "isometrik" ? tinggiIso : undefined}
          views={{
            aktif: tampak,
            onChange: setTampak,
            alat: <TombolPandang p={pandang} />,
            catatan: x.isoCatatan,
          }}
        >
          <canvas
            ref={plate.ref}
            className={`${tampak === "isometrik" ? "hidden" : "block"} h-full w-full`}
          />
          <div
            {...pandang.permukaan}
            role="application"
            aria-label={t.viewSurface}
            className={`absolute inset-0 select-none outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-water ${
              tampak === "isometrik" ? "" : "hidden"
            }`}
          >
            <canvas ref={refIso} className="block h-full w-full" />
          </div>
          {/* display: contents, jadi pembungkus tidak membuat kotak; hanya
              menangkap pointerdown/lepas yang menggelembung dari pegangan
              untuk mengunci bidang. */}
          <div
            className="contents"
            onPointerDown={(e) => {
              // Hanya tombol utama: DragLayer mengabaikan klik lain, jadi tanpa
              // capture tidak ada pelepas dan kunci akan tertinggal.
              if (e.pointerType === "mouse" && e.button !== 0) return;
              if (kunci) return; // jari kedua tidak mengambil kunci baru
              if (bidangRef.current) setKunci(bidangRef.current);
            }}
            onPointerUp={lepasKunci}
            onPointerCancel={lepasKunci}
            onLostPointerCapture={lepasKunci}
          >
            {tampak === "potongan" && (
              <DragLayer out={plate.outRef.current} handles={handles} touch={() => sentuh.current()} />
            )}
          </div>
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="b0" label={x.dB} value={b} min={0.25} max={1.5} step={0.05} digits={2} unit="m" onChange={setB} tint={ybLuar ? C.signal : undefined} />
              <InputRow symbol="y" label={x.dY} value={y} {...P_Y} unit="m" onChange={setY} tint={ybLuar ? C.signal : C.water} />
              <InputRow symbol="S" label={x.dS} value={S * 100} {...P_S} unit="%" onChange={(v) => setS(v / 100)} tint={C.energy} />
              <InputRow symbol="H" label={x.dRise} value={rise} min={0.5} max={12} step={0.5} digits={1} unit="m" onChange={setRise} />
              <InputRow symbol="Ub" label={x.dU} value={burst} min={0.5} max={6} step={0.1} digits={1} unit="m/s" onChange={setBurst} tint={C.critical} />
            </InputTable>

            <SentuhContoh sentuh={sentuh} />
            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pBaku, apply: () => { setB(0.6); setY(0.7); setS(0.2); setRise(3); setBurst(2.5); } },
                  { label: x.pCuram, apply: () => { setB(0.6); setY(0.7); setS(0.35); setRise(3); setBurst(2.5); } },
                  { label: x.pLebar, apply: () => { setB(1.2); setY(1.2); setS(0.15); setRise(3); setBurst(2.5); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "um'", label: x.rVmax, value: fmt(r.maxVelocity, 3), unit: "m/s", tint: tidakMampu ? C.caution : C.energy, strong: true },
                { symbol: "Q", label: x.rQ, value: fmt(r.Q, 4), unit: "m³/s", tint: tintQ, strong: true },
                { symbol: "Vrata", label: x.rVmean, value: fmt(r.meanVelocity, 3), unit: "m/s" },
                { symbol: "ε", label: x.rEps, value: fmt(r.powerDensity, 0), unit: "W/m³", tint: C.energy },
                { symbol: "—", label: x.rRasio, value: fmt(r.powerRatioToPool, 1), unit: "×", tint: C.critical },
                { symbol: "L", label: x.rLength, value: fmt(r.runLength, 2), unit: "m" },
                r.needsRestPool
                  ? { symbol: "Lmax", label: x.rIstirahat, value: x.lebihL, tint: C.caution }
                  : { symbol: "Lmax", label: x.rIstirahat, value: fmt(DENIL_RUN_MAX, 0), unit: "m" },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hRasio,
                    rumus: <span>Q* = {fmt(DENIL_Q_COEF, 2)} · (y/b)²</span>,
                    isi: `y/b = ${fmt(y, 2)} / ${fmt(b, 2)} = ${fmt(yb, 4)} ;  ${fmt(DENIL_Q_COEF, 2)} · ${fmt(yb, 4)}²`,
                    hasil: fmt(r.Qstar, 4),
                    tint: ybLuar ? C.signal : undefined,
                  },
                  {
                    judul: x.hQ,
                    rumus: <span>Q = Q* · √(g · S · b⁵)</span>,
                    isi: `${fmt(r.Qstar, 4)} · √(${fmt(G, 2)} · ${fmt(S, 2)} · ${fmt(b, 2)}⁵)`,
                    hasil: fmt(r.Q, 4),
                    satuan: "m³/s",
                    tint: tintQ,
                  },
                  {
                    judul: x.hV,
                    rumus: <span>Vrata = Q / (B · y) ;  B = {fmt(DENIL_B_OVER_B0, 2)} b</span>,
                    isi: `${fmt(r.Q, 4)} / ( ${fmt(DENIL_B_OVER_B0, 2)} · ${fmt(b, 2)} · ${fmt(y, 2)} )`,
                    hasil: fmt(r.meanVelocity, 3),
                    satuan: "m/s",
                  },
                  {
                    judul: x.hUm,
                    rumus: <span>um&apos; = {fmt(DENIL_UM_COEF, 2)} · Q*^{fmt(DENIL_UM_EXP, 2)} · √(g · S · b)</span>,
                    isi: `${fmt(DENIL_UM_COEF, 2)} · ${fmt(r.Qstar, 4)}^${fmt(DENIL_UM_EXP, 2)} · √(${fmt(G, 2)} · ${fmt(S, 2)} · ${fmt(b, 2)})`,
                    hasil: fmt(r.maxVelocity, 3),
                    satuan: `m/s (${x.banding} Ub ${fmt(burst, 1)})`,
                    tint: tidakMampu ? C.caution : C.energy,
                    catatan: x.umNote,
                  },
                  {
                    judul: x.hEps,
                    rumus: (<><span>ε =</span><Frac num="ρ · g · Q · S" den="B · y" /><span className="ml-2">B = {fmt(DENIL_B_OVER_B0, 2)} b</span></>),
                    isi: `1000 · ${fmt(G, 2)} · ${fmt(r.Q, 4)} · ${fmt(S, 2)} / ( ${fmt(DENIL_B_OVER_B0, 2)} · ${fmt(b, 2)} · ${fmt(y, 2)} )`,
                    hasil: fmt(r.powerDensity, 0),
                    satuan: `W/m³ = ${fmt(r.powerRatioToPool, 1)} × ${fmt(FISHWAY_POWER_GENERAL, 0)}`,
                    tint: C.energy,
                    catatan: x.epsNote,
                  },
                  {
                    judul: x.hL,
                    rumus: <span>L = H / S</span>,
                    isi: `${fmt(rise, 1)} / ${fmt(S, 2)}  (${x.banding} Lmax ${fmt(DENIL_RUN_MAX, 0)} m)`,
                    hasil: fmt(r.runLength, 2),
                    satuan: "m",
                  },
                ]}
              />
            </div>
            {ybLuar && (
              <p role="status" className="mt-3 flex max-w-[62ch] items-start gap-2 text-[0.86rem] leading-snug" style={{ color: C.signal }}>
                <span aria-hidden="true" className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0" style={{ background: C.signal, transform: "rotate(45deg)" }} />
                {x.ybLuar(fmt(yb, 2))}
              </p>
            )}
          </Block>

          <StateCard
            tone={nada}
            badge={badge}
            {...notice(b, y, S, rise, burst, r, tidakMampu, lang)}
          />
        </>
      }
      verification={<Verification checks={checksDenil(b, y, S, rise)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <Frac num="Q" den="√(g S b⁵)" />
                <span>= {fmt(DENIL_Q_COEF, 2)}</span>
                <span className="ml-1">(</span>
                <Frac num="y" den="b" />
                <span>)²</span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `berlaku ${fmtPlain(DENIL_YB_MIN, 1)} ≤ y/b ≤ ${fmtPlain(DENIL_YB_MAX, 1)}`
                    : `valid for ${fmtPlain(DENIL_YB_MIN, 1)} ≤ y/b ≤ ${fmtPlain(DENIL_YB_MAX, 1)}`}
                </span>
              </Eq>
              <Eq>
                <span>um&apos; = {fmt(DENIL_UM_COEF, 2)} Q*^{fmt(DENIL_UM_EXP, 2)} √(g S b)</span>
              </Eq>
              <Eq>
                <span>ε =</span>
                <Frac num="ρ g Q S" den="B y" />
                <span className="ml-5">B = {fmt(DENIL_B_OVER_B0, 2)} b</span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `berlaku pada kemiringan ${fmtPlain(DENIL_SLOPE_MIN, 2)} sampai ${fmtPlain(DENIL_SLOPE_MAX, 2)}`
                    : `valid for slopes from ${fmtPlain(DENIL_SLOPE_MIN, 2)} to ${fmtPlain(DENIL_SLOPE_MAX, 2)}`}
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
  b: number,
  y: number,
  S: number,
  rise: number,
  burst: number,
  r: ReturnType<typeof denilFishway>,
  tidakMampu: boolean,
  lang: Lang
): { state: string; notice: string[] } {
  const x = TXT[lang];
  const landai = denilFishway(b, y, S / 2, rise);
  const landaiLuar = S / 2 < DENIL_SLOPE_MIN;
  const en = lang === "en";

  const state = en
    ? `um' = ${fmt(r.maxVelocity, 2)} m/s ${tidakMampu ? ">" : "≤"} Ub ${fmt(burst, 1)} m/s; trough length ${fmt(r.runLength, 1)} m${r.needsRestPool ? ", needs a resting pool" : ""}.`
    : `um' = ${fmt(r.maxVelocity, 2)} m/s ${tidakMampu ? ">" : "≤"} Ub ${fmt(burst, 1)} m/s; panjang palung ${fmt(r.runLength, 1)} m${r.needsRestPool ? ", perlu kolam istirahat" : ""}.`;

  const butir: string[] = [];
  if (r.slopeOutOfRange) butir.push(x.curamNote);
  if (tidakMampu) butir.push(x.lambatNote);
  if (r.needsRestPool) butir.push(x.istirahatNote);
  butir.push(
    en
      ? `For comparison only: the dissipation in this trough is ${fmt(r.powerRatioToPool, 1)} times the ${fmt(FISHWAY_POWER_GENERAL, 0)} W/m³ pool fishway limit; Katopodis (1992) gives no dissipation limit for Denils. That is the trade this device makes: it climbs ${fmt(rise, 1)} m in ${fmt(r.runLength, 1)} m of length.`
      : `Pembanding saja: lesapan daya di palung ini ${fmt(r.powerRatioToPool, 1)} kali batas ${fmt(FISHWAY_POWER_GENERAL, 0)} W/m³ tangga berkolam; Katopodis (1992) tidak memberi batas lesapan untuk Denil. Itulah pertukaran alat ini: ia menaiki ${fmt(rise, 1)} m dalam ${fmt(r.runLength, 1)} m panjang.`
  );
  butir.push(
    en
      ? `Halve the slope and the run becomes ${fmt(landai.runLength, 1)} m long while the axial velocity falls from ${fmt(r.maxVelocity, 2)} to ${fmt(landai.maxVelocity, 2)} m/s.${landaiLuar ? " That halved slope lies outside the Denil range." : ""}`
      : `Landaikan kemiringannya menjadi separuh dan panjangnya menjadi ${fmt(landai.runLength, 1)} m sementara kecepatan di sumbunya turun dari ${fmt(r.maxVelocity, 2)} ke ${fmt(landai.maxVelocity, 2)} m/s.${landaiLuar ? " Kemiringan separuh itu di luar rentang Denil." : ""}`
  );
  return { state, notice: butir };
}
