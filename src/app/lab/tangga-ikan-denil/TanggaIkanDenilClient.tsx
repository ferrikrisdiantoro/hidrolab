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
import { drawStructure, type StructureBody, type StructureSpec } from "@/lib/drawStructure";
import {
  DENIL_RUN_MAX,
  DENIL_SLOPE_MAX,
  DENIL_SLOPE_MIN,
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
    dB: "Lebar palung antar sirip",
    dY: "Kedalaman aliran tegak lurus dasar",
    dS: "Kemiringan palung",
    dRise: "Beda tinggi seluruhnya",
    dU: "Kecepatan sentak (burst) ikan rancangan",
    pBaku: "Rancangan baku",
    pCuram: "Terlalu curam",
    pLebar: "Palung lebar, debit besar",
    gY: "Kedalaman aliran y, seret muka air naik atau turun",
    gS: "Kemiringan palung S, seret ujung hilir lantai palung naik atau turun",
    rQ: "Debit yang lewat",
    rVmean: "Kecepatan rata-rata",
    rVmax: "Kecepatan di sumbu palung",
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
    hV: "Kecepatan rata-rata dan di sumbu",
    hEps: "Lesapan daya per isi palung",
    hL: "Panjang palung",
    banding: "dibanding",
    curamNote:
      "Kemiringan palung di luar rentang sepersepuluh sampai seperempat. Di bawahnya sirip penahan tidak lagi menimbulkan putaran balik yang cukup dan palungnya berperilaku seperti saluran biasa, sehingga tidak ada gunanya memasang sirip sama sekali. Di atasnya kecepatan di sumbu palung naik melampaui yang sanggup dilawan hampir semua jenis ikan sungai, dan tangga ikannya menjadi penghalang alih-alih lintasan. Kurva rancangan Denil yang dipakai di sini pun hanya diterbitkan pada rentang itu.",
    lambat: "Ikan tidak sanggup melawan arus di sumbu palung",
    lambatNote:
      "Kecepatan di sumbu palung melampaui kecepatan sentak ikan rancangan, sehingga ikan tidak dapat maju berapa pun kuatnya ia berenang. Perlu diingat bahwa kecepatan sentak hanya dapat dipertahankan sekitar dua puluh detik, jadi memenuhi syarat ini tepat di ambangnya berarti merancang palung yang hanya dapat dilewati sekali oleh ikan yang benar-benar segar. Landaikan palungnya, atau pilih jenis ikan rancangan yang lebih lemah dan rancang untuknya.",
    istirahat: "Butuh kolam istirahat",
    istirahatNote:
      "Palungnya lebih panjang daripada sepuluh meter tanpa kolam istirahat. Karena ikan melewati tangga Denil dengan berenang sentak dan bukan berenang jelajah, panjang palung tanpa jeda dibatasi oleh berapa lama sentakan itu dapat dipertahankan, bukan oleh kekuatan bangunannya. Sisipkan kolam istirahat setiap enam sampai sepuluh meter panjang palung.",
    note:
      "Yang membuat tangga Denil bekerja bukan penghalangan melainkan pembalikan. Sirip yang miring ke hulu memaksa sebagian air berputar balik di dekat dinding dan dasar palung, dan putaran balik itu melesap tenaga tanpa menutup lintasan di tengah. Ikan berenang di sepanjang sumbu, tempat airnya masih mengalir maju tetapi jauh lebih lambat daripada kemiringan palungnya seharusnya membuatnya. Harga yang dibayar untuk lintasan yang jauh lebih pendek daripada tangga berkolam adalah keteradukan: lesapan daya di dalam palung Denil belasan sampai puluhan kali batas yang diterima tangga berkolam. Itu bukan cacat rancangan melainkan ciri alatnya, dan akibatnya jelas: Denil hanya cocok untuk jenis ikan yang kuat berenang, selalu menuntut kolam istirahat pada jarak tertentu, dan sama sekali tidak cocok untuk ikan kecil atau ikan yang bergerak di dasar.",
  },
  en: {
    title: "Denil fishway",
    sheetTitle: "Denil fishway — baffles angled upstream",
    dB: "Trough width between baffles",
    dY: "Flow depth normal to the invert",
    dS: "Trough slope",
    dRise: "Total rise",
    dU: "Burst speed of the design fish",
    pBaku: "Standard design",
    pCuram: "Too steep",
    pLebar: "Wide trough, large discharge",
    gY: "Flow depth y, drag the water surface up or down",
    gS: "Trough slope S, drag the downstream end of the trough floor up or down",
    rQ: "Discharge through the trough",
    rVmean: "Mean velocity",
    rVmax: "Velocity on the trough axis",
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
    hV: "Mean and axial velocity",
    hEps: "Dissipation per trough volume",
    hL: "Trough length",
    banding: "against",
    curamNote:
      "The trough slope lies outside one tenth to one quarter. Below it the baffles no longer set up enough reverse rotation and the trough behaves like an ordinary channel, so fitting baffles at all serves no purpose. Above it the axial velocity rises past what almost any river species can beat, and the fishway becomes a barrier rather than a passage. The Denil design curves used here are only published within that range in any case.",
    lambat: "The fish cannot beat the axial velocity",
    lambatNote:
      "The velocity on the trough axis exceeds the burst speed of the design fish, so the fish cannot advance however hard it swims. Remember that burst speed can be held for only about twenty seconds, so meeting this condition exactly at its limit means designing a trough that can be passed once by a genuinely fresh fish. Flatten the trough, or choose a weaker design species and design for that.",
    istirahat: "Resting pool required",
    istirahatNote:
      "The trough is longer than ten metres without a resting pool. Because fish pass a Denil by burst swimming rather than cruising, the length of an uninterrupted run is limited by how long that burst can be held, not by the strength of the structure. Insert a resting pool every six to ten metres of trough.",
    note:
      "What makes a Denil work is not obstruction but reversal. Baffles angled upstream force part of the water to rotate backwards near the walls and the invert, and that reverse rotation dissipates energy without closing the path down the middle. The fish swims along the axis, where the water still moves forward but far more slowly than the slope of the trough should make it. The price paid for a passage far shorter than a pool fishway is turbulence: the dissipation inside a Denil trough is ten to twenty times the limit a pool fishway accepts. That is not a design fault but a feature of the device, and its consequences are clear: a Denil suits only strong-swimming species, always demands resting pools at intervals, and does not suit small fish or bottom-moving fish at all.",
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
    "FAO/DVWK (2002). Fish Passes: Design, Dimensions and Monitoring. FAO, Roma.",
  ],
  en: [
    "Denil, G. (1909). Les échelles à poissons et leur application aux barrages de Meuse et d'Ourthe. Annales des Travaux Publics de Belgique.",
    "Bell, M.C. (1991). Fisheries Handbook of Engineering Requirements and Biological Criteria. US Army Corps of Engineers.",
    "Katopodis, C. (1992). Introduction to Fishway Design. Freshwater Institute, Winnipeg.",
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
  // Q* ditulis ulang hanya untuk baris Hitungan; rumusnya sama persis dengan
  // denilFishway (hydraulics.ts), dan Q di tabel tetap r.Q.
  const yb = b > 0 ? y / b : 0;
  const Qstar = 0.94 * yb * Math.sqrt(S) + 0.16 * yb * yb;
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
      const jarakSirip = Math.max(b * 0.6, 0.25);
      const jumlah = Math.max(2, Math.floor(panjang / jarakSirip));
      const tebal = Math.max(b * 0.06, 0.03);

      const dasarDi = (xx: number) => -S * xx;

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

      // Sirip penahan: bidang tipis miring ke hulu, tingginya sebagian
      // kedalaman palung.
      for (let i = 1; i <= jumlah; i++) {
        const xx = i * jarakSirip;
        if (xx > panjang) break;
        const z0 = dasarDi(xx);
        const tinggi = y * 0.62;
        const miring = tinggi * 0.45;
        badan.push({
          pts: [
            { x: xx, z: z0 },
            { x: xx + tebal, z: z0 },
            { x: xx + tebal - miring, z: z0 + tinggi },
            { x: xx - miring, z: z0 + tinggi },
          ],
          color: C.ink,
        });
      }

      const muka: { x: number; z: number }[] = [];
      for (let i = 0; i <= 40; i++) {
        const xx = (panjang * i) / 40;
        muka.push({ x: xx, z: dasarDi(xx) + y });
      }

      const bebas: Bidang = {
        panjang: panjangBebas,
        xMin: -panjangBebas * 0.08,
        xMax: panjangBebas * 1.08,
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
            axis: "v",
            at: panjang * 0.5,
            from: potongZ(dasarDi(panjang * 0.5)),
            to: potongZ(dasarDi(panjang * 0.5) + y),
            text: `y ${fmtPlain(y, 2)} m`,
            color: C.water,
            offset: 24,
          },
        ],
        callouts: [
          {
            x: jarakSirip * 2,
            z: dasarDi(jarakSirip * 2) + y * 0.6,
            dx: 20,
            dy: -32,
            text: T.baffleLabel,
          },
        ],
        arrows: [
          {
            x: panjang * 0.25,
            z: dasarDi(panjang * 0.25) + y * 0.82,
            length: -28,
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
          muka: { x: panjang * 0.65, z: dasarDi(panjang * 0.65) + y },
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
      toValue: (px, py, m) => m.invY(py) + S * m.invX(px),
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
            symbol="Vmaks/Ub"
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
            { label: "Q", value: `${fmt(r.Q, 3)} m³/s`, tint: C.water },
            { label: "Vmaks", value: `${fmt(r.maxVelocity, 2)} m/s`, tint: tidakMampu ? C.caution : C.energy },
            { label: "L", value: `${fmt(r.runLength, 1)} m` },
          ]}
        >
          <canvas ref={plate.ref} className="block h-full w-full" />
          {/* display: contents, jadi pembungkus tidak membuat kotak; hanya
              menangkap pointerdown/lepas yang menggelembung dari pegangan
              untuk mengunci bidang. */}
          <div
            className="contents"
            onPointerDown={(e) => {
              // Hanya tombol utama: DragLayer mengabaikan klik lain, jadi tanpa
              // capture tidak ada pelepas dan kunci akan tertinggal.
              if (e.pointerType === "mouse" && e.button !== 0) return;
              if (bidangRef.current) setKunci(bidangRef.current);
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
              <InputRow symbol="b" label={x.dB} value={b} min={0.25} max={1.5} step={0.05} digits={2} unit="m" onChange={setB} />
              <InputRow symbol="y" label={x.dY} value={y} {...P_Y} unit="m" onChange={setY} tint={C.water} />
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
                { symbol: "Vmaks", label: x.rVmax, value: fmt(r.maxVelocity, 3), unit: "m/s", tint: tidakMampu ? C.caution : C.energy, strong: true },
                { symbol: "Q", label: x.rQ, value: fmt(r.Q, 4), unit: "m³/s", tint: C.water, strong: true },
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
                    rumus: <span>Q* = {fmt(0.94, 2)} · (y/b) · √S + {fmt(0.16, 2)} · (y/b)²</span>,
                    isi: `y/b = ${fmt(y, 2)} / ${fmt(b, 2)} = ${fmt(yb, 4)} ;  ${fmt(0.94, 2)} · ${fmt(yb, 4)} · √${fmt(S, 2)} + ${fmt(0.16, 2)} · ${fmt(yb, 4)}²`,
                    hasil: fmt(Qstar, 4),
                  },
                  {
                    judul: x.hQ,
                    rumus: <span>Q = Q* · b^{fmt(2.5, 1)} · √g</span>,
                    isi: `${fmt(Qstar, 4)} · ${fmt(b, 2)}^${fmt(2.5, 1)} · √${fmt(G, 2)}`,
                    hasil: fmt(r.Q, 4),
                    satuan: "m³/s",
                    tint: C.water,
                  },
                  {
                    judul: x.hV,
                    rumus: <span>Vrata = Q / (b · y) ;  Vmaks = {fmt(1.5, 1)} · Vrata</span>,
                    isi: `${fmt(r.Q, 4)} / ( ${fmt(b, 2)} · ${fmt(y, 2)} ) = ${fmt(r.meanVelocity, 3)} ;  ${fmt(1.5, 1)} · ${fmt(r.meanVelocity, 4)}  (${x.banding} Ub ${fmt(burst, 1)})`,
                    hasil: fmt(r.maxVelocity, 3),
                    satuan: "m/s",
                    tint: tidakMampu ? C.caution : C.energy,
                  },
                  {
                    judul: x.hEps,
                    rumus: (<><span>ε =</span><Frac num="ρ · g · Q · S" den="b · y" /></>),
                    isi: `1000 · ${fmt(G, 2)} · ${fmt(r.Q, 4)} · ${fmt(S, 2)} / ( ${fmt(b, 2)} · ${fmt(y, 2)} ) = ${fmt(r.powerRatioToPool, 1)} × ${fmt(FISHWAY_POWER_GENERAL, 0)}`,
                    hasil: fmt(r.powerDensity, 0),
                    satuan: "W/m³",
                    tint: C.energy,
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
                <Frac num="Q" den={`b^${fmt(2.5, 1)} √g`} />
                <span>= {fmt(0.94, 2)}</span>
                <Frac num="y" den="b" />
                <span>√S + {fmt(0.16, 2)}</span>
                <span className="ml-1">(</span>
                <Frac num="y" den="b" />
                <span>)²</span>
              </Eq>
              <Eq>
                <span>ε =</span>
                <Frac num="ρ g Q S" den="b y" />
                <span className="ml-5">Vmaks = {fmt(1.5, 1)} Vrata</span>
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
    ? `Vmax = ${fmt(r.maxVelocity, 2)} m/s ${tidakMampu ? ">" : "≤"} Ub ${fmt(burst, 1)} m/s; trough length ${fmt(r.runLength, 1)} m${r.needsRestPool ? ", needs a resting pool" : ""}.`
    : `Vmaks = ${fmt(r.maxVelocity, 2)} m/s ${tidakMampu ? ">" : "≤"} Ub ${fmt(burst, 1)} m/s; panjang palung ${fmt(r.runLength, 1)} m${r.needsRestPool ? ", perlu kolam istirahat" : ""}.`;

  const butir: string[] = [];
  if (r.slopeOutOfRange) butir.push(x.curamNote);
  if (tidakMampu) butir.push(x.lambatNote);
  if (r.needsRestPool) butir.push(x.istirahatNote);
  butir.push(
    en
      ? `The dissipation in this trough is ${fmt(r.powerRatioToPool, 1)} times what a pool fishway is allowed, and that is the trade this device makes: it climbs ${fmt(rise, 1)} m in ${fmt(r.runLength, 1)} m of length.`
      : `Lesapan daya di palung ini ${fmt(r.powerRatioToPool, 1)} kali yang diizinkan pada tangga berkolam, dan itulah pertukaran yang dilakukan alat ini: ia menaiki ${fmt(rise, 1)} m dalam ${fmt(r.runLength, 1)} m panjang.`
  );
  butir.push(
    en
      ? `Halve the slope and the run becomes ${fmt(landai.runLength, 1)} m long while the axial velocity falls from ${fmt(r.maxVelocity, 2)} to ${fmt(landai.maxVelocity, 2)} m/s.${landaiLuar ? " That halved slope lies outside the Denil range." : ""}`
      : `Landaikan kemiringannya menjadi separuh dan panjangnya menjadi ${fmt(landai.runLength, 1)} m sementara kecepatan di sumbunya turun dari ${fmt(r.maxVelocity, 2)} ke ${fmt(landai.maxVelocity, 2)} m/s.${landaiLuar ? " Kemiringan separuh itu di luar rentang Denil." : ""}`
  );
  return { state, notice: butir };
}
