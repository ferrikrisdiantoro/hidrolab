"use client";

import { useRef, useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  Block,
  Hitungan,
  InputRow,
  InputTable,
  PresetRow,
  ResultTable,
  SentuhContoh,
  Sheet,
  StateCard,
  Term,
} from "@/components/ui";
import { usePlate, usePutar } from "@/lib/usePlate";
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import {
  fmt,
  fmtPlain,

  scsStorage,
  scsUnitHydrograph,
} from "@/lib/hydraulics";
import { floodHydrographBlocks } from "@/lib/hidrografHujan";
import {
  drawCatchment,
  drawCatchmentState,
  drawTimeCursor,
  offsetMap,
  readHydrograph,
  type CatchmentLayout,
} from "@/lib/drawBasin";
import type { PlateMap, PlateOut } from "@/lib/plateOut";
import type { Check } from "@/lib/verify";
import { DragLayer, type HandleSpec } from "@/components/DragLayer";
import type { ParamDef } from "@/lib/rentang";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksHydrograph } from "@/lib/checks";

const TXT = {
  id: {
    title: "Hidrograf banjir",
    sheetTitle: "Hidrograf banjir SCS — dari hujan daerah aliran menjadi debit sungai",
    dP: "Hujan total",
    dDur: "Lama hujan",
    dCN: "Curve Number (CN)",
    dA: "Luas daerah aliran",
    dTc: "Waktu tempuh terpanjang",
    pSawah: "Daerah persawahan, hujan sedang",
    pKota: "Daerah terbangun, hujan lebat",
    pHutan: "Daerah berhutan, hujan panjang",
    rPeak: "Debit puncak",
    rPeakTime: "Waktu puncak banjir",
    rPe: "Hujan efektif",
    rLoss: "Hujan yang hilang",
    rS: "Simpanan maksimum",
    rTp: "Waktu naik hidrograf satuan",
    rQp: "Puncak hidrograf satuan",
    rVol: "Isi hidrograf",
    rDepth: "Kedalaman limpasan",
    rDD: "Lama satu pias hujan",
    rIa: "Hujan awal yang tertahan",
    perMm: "m³/s per mm",
    kasar: "Pias hujan terlalu kasar",
    kasarNote:
      "Lama satu pias hujan melebihi seperempat waktu naik hidrograf satuan (NEH 630 Bab 16). Puncak dan bentuk sisi naiknya menjadi kasar; perpendek pias atau perpanjang waktu tempuhnya.",
    adaLimpas: "Ada limpasan",
    tanpaLimpas: "Tanpa limpasan",
    hPe0: "P tidak melebihi Ia: Pe = 0, seluruh hujan tertahan",
    hPeak: "Puncak hasil penjumlahan pias",
    hCek: "Pemeriksaan isi",
    dKursor: "Kursor waktu, jam ke-",
    kursorJepit: "digeser ke {v} h karena hidrograf memendek",
    gPias: "Hujan pias {i}, seret batang hyetograph naik atau turun",
    gPilih: "Hyetograph, seret ke kiri atau kanan memilih pias dan naik atau turun mengatur hujannya",
    lCatchment: "DAS",
    lOutlet: "outlet",
    lLumped: "hujan merata di seluruh DAS (model terpusat); awan hanya penanda waktu badai",
    lRainUnit: "mm/h",
    barLabel: "hujan",
    tabelPias: "SCS-CN per pias: CN dipakai pada hujan kumulatif (NEH 630 Bab 10)",
    kolK: "pias",
    kolP: "P (mm)",
    kolPk: "ΣP (mm)",
    kolPek: "ΣPe (mm)",
    kolPe: "Pe (mm)",
    kumulatifNote:
      "Hyetograph bisa digambar dengan menyeret batangnya; penggeser P menskalakan seluruh batang. Hujan efektif tiap pias dihitung kumulatif (NEH 630 Bab 10, Contoh 10-6): CN dipakai pada hujan kumulatif, limpasan pias = selisih limpasan kumulatif berurutan, jadi hujan awal habis mengisi Ia dan pias belakangan melimpas lebih banyak. Hidrograf = konvolusi limpasan per pias dengan hidrograf satuan segitiga SCS (NEH 630 Bab 16). Model terpusat: letak hujan di DAS tidak mengubah puncak di lembar ini; untuk itu dibutuhkan model terdistribusi (misalnya waktu-luas Clark).",
    motionNoteA: "Waktu dipercepat: satu detik layar =",
    motionNoteB: "jam. Peta DAS skematik; hujan dianggap merata, jadi letak awan tidak mengubah debit.",
    cekVol: "Isi hidrograf hyetograph gambar sama dengan hujan efektif kumulatif",
    hPiasMaks: "paling banyak 24 pias supaya bisa digambar",
    dibatasiP: "batang dibatasi: hujan total paling banyak 600 mm",
    andaian:
      "CN dan hidrograf satuan sama-sama andaian: CN berasal dari tabel petak percobaan di Amerika Serikat, dan hidrograf satuan menganggap tanggapan daerah aliran linear (Ponce dan Hawkins 1996).",
    note:
      "Dua andaian besar berdiri di balik lembar ini, dan keduanya perlu dilihat jelas sebelum angkanya dipakai. Pertama, Curve Number (CN) menyatukan jenis tanah, tutupan lahan, dan kelembapan sebelumnya ke dalam satu angka antara 30 dan 100. Angka itu tidak punya makna fisis tersendiri; ia pengenal baris pada tabel yang disusun dari ribuan petak percobaan di Amerika Serikat pada pertengahan abad lalu, dan memindahkannya ke daerah tropis adalah langkah yang harus dibenarkan, bukan diandaikan. Kedua, hidrograf satuan mengandaikan tanggapan daerah aliran itu linear: hujan dua kali lipat memberi debit dua kali lipat, dan hidrograf dari beberapa pias hujan boleh dijumlahkan begitu saja. Andaian itu cukup baik untuk banjir sedang dan meleset pada banjir besar, tempat jalur aliran berubah karena limpasannya sendiri. Yang tetap berlaku apa pun andaiannya adalah kekekalan isi: luas di bawah hidrograf harus sama dengan hujan efektif dikali luas daerah aliran, dan pemeriksaan di bawah menguji justru hal itu.",
  },
  en: {
    title: "Flood hydrograph",
    sheetTitle: "SCS flood hydrograph — from catchment rainfall to river discharge",
    dP: "Total rainfall",
    dDur: "Rain duration",
    dCN: "Curve Number (CN)",
    dA: "Catchment area",
    dTc: "Time of concentration",
    pSawah: "Paddy landscape, moderate rain",
    pKota: "Built-up area, heavy rain",
    pHutan: "Forested catchment, long rain",
    rPeak: "Peak discharge",
    rPeakTime: "Time of the flood peak",
    rPe: "Effective rainfall",
    rLoss: "Rainfall lost",
    rS: "Maximum storage",
    rTp: "Unit hydrograph time to peak",
    rQp: "Unit hydrograph peak",
    rVol: "Hydrograph volume",
    rDepth: "Runoff depth",
    rDD: "Length of one rainfall block",
    rIa: "Initial abstraction",
    perMm: "m³/s per mm",
    kasar: "Rainfall block too coarse",
    kasarNote:
      "One rainfall block is longer than a quarter of the unit hydrograph time to peak (NEH 630 Chapter 16). The peak and the rising limb become coarse; shorten the block or lengthen the time of concentration.",
    adaLimpas: "Runoff",
    tanpaLimpas: "No runoff",
    hPe0: "P does not exceed Ia: Pe = 0, all the rain is held back",
    hPeak: "Peak of the summed blocks",
    hCek: "Volume check",
    dKursor: "Time cursor, hour",
    kursorJepit: "moved to {v} h because the hydrograph got shorter",
    gPias: "Rain block {i}, drag the hyetograph bar up or down",
    gPilih: "Hyetograph, drag left or right to pick a block and up or down to set its rain",
    lCatchment: "catchment",
    lOutlet: "outlet",
    lLumped: "rain uniform over the whole catchment (lumped model); the cloud only marks storm time",
    lRainUnit: "mm/h",
    barLabel: "rain",
    tabelPias: "SCS-CN per block: CN applied to cumulative rain (NEH 630 Chapter 10)",
    kolK: "block",
    kolP: "P (mm)",
    kolPk: "ΣP (mm)",
    kolPek: "ΣPe (mm)",
    kolPe: "Pe (mm)",
    kumulatifNote:
      "The hyetograph can be drawn by dragging its bars; the P slider scales all bars. Effective rain per block is computed cumulatively (NEH 630 Chapter 10, Example 10-6): CN is applied to cumulative rain and block runoff is the difference of successive cumulative runoff, so early rain fills Ia and later blocks run off more. The hydrograph is the convolution of block runoff with the SCS triangular unit hydrograph (NEH 630 Chapter 16). Lumped model: where the rain falls in the catchment does not change the peak on this sheet; that needs a distributed model (for example Clark time-area).",
    motionNoteA: "Time is sped up: one screen second =",
    motionNoteB: "hours. Schematic catchment map; rain is taken as uniform, so the cloud position does not change the flow.",
    cekVol: "Volume of the drawn-hyetograph hydrograph equals the cumulative effective rain",
    hPiasMaks: "at most 24 blocks so they can be drawn",
    dibatasiP: "bar limited: total rain at most 600 mm",
    andaian:
      "The curve number and the unit hydrograph are both assumptions: CN comes from tables of experimental plots in the United States, and the unit hydrograph treats the catchment response as linear (Ponce and Hawkins 1996).",
    note:
      "Two large assumptions stand behind this sheet, and both deserve a clear look before the numbers are used. First, the curve number folds soil type, land cover, and antecedent moisture into a single value between 30 and 100. That value has no physical meaning of its own; it is a row identifier in a table assembled from thousands of experimental plots in the United States in the middle of the last century, and carrying it into the tropics is a step that must be justified rather than assumed. Second, the unit hydrograph assumes the catchment responds linearly: double the rain gives double the discharge, and hydrographs from several rainfall blocks may simply be added. That assumption serves moderate floods well and fails on large ones, where the flow paths themselves change because of the runoff. What holds regardless of either assumption is conservation of volume: the area under the hydrograph must equal the effective rainfall times the catchment area, and the verification below tests exactly that.",
  },
} as const;

const REFS = {
  id: [
    "USDA NRCS (2004). National Engineering Handbook Bagian 630, Bab 10: Estimation of Direct Runoff from Storm Rainfall.",
    "Chow, V.T., Maidment, D.R. & Mays, L.W. (1988). Applied Hydrology. McGraw-Hill, Bab 7.",
    "Sherman, L.K. (1932). Streamflow from rainfall by the unit-graph method. Engineering News-Record, vol. 108.",
    "Ponce, V.M. & Hawkins, R.H. (1996). Runoff curve number: has it reached maturity? Journal of Hydrologic Engineering, vol. 1.",
  ],
  en: [
    "USDA NRCS (2004). National Engineering Handbook Part 630, Chapter 10: Estimation of Direct Runoff from Storm Rainfall.",
    "Chow, V.T., Maidment, D.R. & Mays, L.W. (1988). Applied Hydrology. McGraw-Hill, Chapter 7.",
    "Sherman, L.K. (1932). Streamflow from rainfall by the unit-graph method. Engineering News-Record, vol. 108.",
    "Ponce, V.M. & Hawkins, R.H. (1996). Runoff curve number: has it reached maturity? Journal of Hydrologic Engineering, vol. 1.",
  ],
} as const;

/** Hujan total: penggeser P menskalakan seluruh batang. */
const P_TOTAL: ParamDef = { min: 5, max: 600, step: 0.1, digits: 1 };
/** Rentang hujan satu pias: satu definisi untuk pegangan batang. Batas atasnya
    sama dengan P total, karena penggeser P bisa menaruh seluruh hujan di satu
    pias (D 1 h, tc 14 h: satu pias 600 mm), sehingga nilai batang selalu di
    dalam rentang pegangannya. Jumlah batang tetap dibatasi P_TOTAL.max di setBlok. */
const P_PIAS: ParamDef = { min: 0, max: P_TOTAL.max, step: 0.5, digits: 1 };
/** Kursor waktu: batas atasnya ujung deret tAkhir, dihitung di dalam lembar. */
const LANGKAH_KURSOR = 0.1;
/** Membulatkan ke bawah ke kelipatan 0,1 jam (pembagian 10 supaya tidak 13,100000000000001). */
const keBawahKursor = (v: number) => Math.floor(v * 10 + 1e-9) / 10;
const N_PIAS_MAKS = 24;

/** Hujan total dibagi rata ke n pias. */
function rata(P: number, n: number): number[] {
  return Array.from({ length: n }, () => P / Math.max(n, 1));
}

export function HidrografBanjirClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [dur, setDur] = useState(6);
  const [CN, setCN] = useState(75);
  const [A, setA] = useState(50);
  const [tc, setTc] = useState(4);
  const [kursor, setKursor] = useState(6);

  /* Pias hyetograph: aturan ΔD floodHydrograph (min(1 h, 0,133 tc)),
     dibatasi 24 pias supaya tiap batang bisa diseret. Batang yang digambar
     disimpan bersama jumlah piasnya; bila D atau tc mengubah jumlah pias,
     hujannya dibagi rata lagi dengan jumlah yang sama. */
  const nPias = Math.min(Math.ceil(dur / Math.min(1, 0.133 * tc) - 1e-9), N_PIAS_MAKS);
  const dD = dur / nPias;
  const [hujan, setHujan] = useState<{ n: number; blok: number[] }>(() => ({ n: 6 * 2, blok: rata(80, 12) }));
  const totalLama = hujan.blok.reduce((x0, y0) => x0 + y0, 0);
  const blok = hujan.n === nPias ? hujan.blok : rata(totalLama, nPias);
  const P = blok.reduce((x0, y0) => x0 + y0, 0);
  const setP = (v: number) => {
    const k = P > 0 ? v / P : 0;
    setDibatasiP(false);
    setHujan({ n: nPias, blok: P > 0 ? blok.map((q) => q * k) : rata(v, nPias) });
  };
  /* Jumlah batang tidak boleh melampaui ujung penggeser P; batang yang
     diseret dipotong dan diberi penanda di grafik. */
  const [dibatasiP, setDibatasiP] = useState(false);
  const setBlok = (i: number, v: number) => {
    const baru = blok.slice();
    const lain = P - blok[i];
    const potong = lain + v > P_TOTAL.max;
    baru[i] = potong ? Math.max(P_TOTAL.max - lain, 0) : v;
    setDibatasiP(potong);
    setHujan({ n: nPias, blok: baru });
  };
  const aturContoh = (Pc: number, Dc: number, CNc: number, Ac: number, tcc: number) => {
    const n = Math.min(Math.ceil(Dc / Math.min(1, 0.133 * tcc) - 1e-9), N_PIAS_MAKS);
    setHujan({ n, blok: rata(Pc, n) });
    setDur(Dc);
    setCN(CNc);
    setA(Ac);
    setTc(tcc);
  };

  const r = floodHydrographBlocks(blok, dD, CN, A, tc, { kehilangan: "kumulatif" });
  const hilang = P - r.effectiveRain;
  const S = scsStorage(CN);
  const Ia = 0.2 * S;
  const adaLimpas = r.effectiveRain > 0;

  /* Batas sumbu pita hujan dikunci selama batang diseret. */
  const [kunci, setKunci] = useState<{ pMax: number } | null>(null);
  const bebas = { pMax: Math.max(Math.max(...blok) * 1.3, 1) };
  const bidangRef = useRef(bebas);
  bidangRef.current = bebas;
  const bidang = kunci ?? bebas;

  const tAkhir = r.points[r.points.length - 1].t;
  /* Kursor waktu hanya sampai ujung deret: satu ParamDef untuk penggeser dan
     kotak angkanya. Bila tAkhir mengecil di bawah kursor, kursor digeser ke
     ujung baru dan diberi penanda di bawah kotaknya (aturan 4). */
  const P_KURSOR: ParamDef = { min: 0, max: keBawahKursor(tAkhir), step: LANGKAH_KURSOR, digits: 1 };
  const [kursorJepit, setKursorJepit] = useState<number | null>(null);
  if (kursor > P_KURSOR.max) {
    setKursor(P_KURSOR.max);
    setKursorJepit(P_KURSOR.max);
  }
  const ubahKursor = (v: number) => {
    setKursorJepit(null);
    setKursor(v);
  };
  const [pilih, setPilih] = useState(0);
  const lebarBatang = useRef(0);
  const rainMax = Math.max(...blok) / dD;
  const { playing, toggle: togglePutar } = usePutar();
  const bergerak = playing;
  const sentuh = useRef<() => void>(() => {});
  const tataRef = useRef<CatchmentLayout | null>(null);
  const petaGrafik = useRef<PlateMap | null>(null);
  const petaPita = useRef<PlateMap | null>(null);
  const mulai = useRef<{ tt: number | null; t: number; kini: number }>({ tt: null, t: 6, kini: 6 });
  const kini = useRef({ Q: 0, rain: 0 });
  const titikKursor = useRef<[number, string][]>([[0, C.water]]);
  /** Jam model per detik layar: seluruh deret dalam 12 detik */
  const LAJU = tAkhir / 12;
  const labelDas = { catchment: x.lCatchment, outlet: x.lOutlet, lumped: x.lLumped, rainUnit: x.lRainUnit };

  const grafik = (ctx: CanvasRenderingContext2D, w: number, h: number): PlateOut => {
      const tMax = r.points[r.points.length - 1].t;
      const qMax = Math.max(r.peak * 1.25, 1e-6);
      const pMax = bidang.pMax;

      // Hidrograf satuan digambar sebagai pembanding, diperbesar supaya
      // bentuknya terbaca pada sumbu yang sama.
      const satuan: { x: number; y: number }[] = [];
      const skala = r.peak > 0 ? (r.peak * 0.35) / Math.max(r.qp, 1e-9) : 0;
      for (let i = 0; i <= 200; i++) {
        const tt = (tMax * i) / 200;
        satuan.push({ x: tt, y: scsUnitHydrograph(tt, r.tp) * r.qp * skala });
      }

      const deret: ChartSeries[] = [
        {
          pts: satuan,
          color: C.ink3,
          weight: W.hair,
          dash: DASH.hidden,
          label: T.unitHydrograph,
          labelAt: 0.25,
          labelDy: -10,
        },
        {
          pts: r.points.map((p) => ({ x: p.t, y: p.Q })),
          color: C.water,
          weight: W.bold,
          dash: DASH.solid,
          fill: C.waterFill,
        },
      ];

      return drawChart(
        ctx,
        w,
        h,
        {
          xMin: 0,
          xMax: tMax,
          yMin: 0,
          /*
           * Hujan yang seluruhnya terserap memberi hidrograf nol rata, dan
           * bidang setinggi nol membuat angka sumbunya menjadi lima baris
           * "0,000" berturut-turut. Angka nol yang diulang lima kali bukan
           * keterangan, melainkan kerusakan yang menyamar sebagai keterangan.
           * Batas atasnya karena itu diberi lantai, dan keadaannya dinyatakan
           * dengan tulisan alih-alih dibiarkan ditebak dari bidang kosong.
           */
          yMax: qMax > 1e-6 ? qMax : 1,
          heading: r.peak <= 1e-9 ? T.noRunoff : undefined,
          // Tanpa limpasan adalah hasil sah, bukan di luar rentang berlaku.
          headingColor: C.ink2,
          axisX: T.axTimeHour,
          axisY: T.axFlowRate,
          series: deret,
          topBars: {
            bars: r.pias.map((q) => ({ x0: q.t0, x1: q.t1, v: q.P })),
            max: pMax,
            label: x.barLabel,
            unit: "mm",
            heightFrac: 0.32,
          },
          regions: dibatasiP ? [{ x: tMax * 0.62, y: qMax * 0.6, text: x.dibatasiP, color: C.caution }] : undefined,
          point: {
            x: r.peakTime,
            y: r.peak,
            label: `${fmtPlain(r.peak, 1)} m³/s`,
          },
        },
        lang
      );
  };

  const plate = usePlate(
    (ctx, w, h) => {
      const hDas = Math.round(Math.min(Math.max(h * 0.34, 150), 240));
      const tK = kursor;
      const k = { Q: 0, rain: 0 };
      readHydrograph(r.points, tK, k);
      const das = drawCatchment(
        ctx,
        w,
        hDas,
        { areaKm2: A, tc, rainNow: k.rain, rainMax, t: tK, duration: dur, flow: k.Q },
        { labels: labelDas, withState: !bergerak }
      );
      tataRef.current = das.layout;
      ctx.save();
      ctx.translate(0, hDas);
      const out = grafik(ctx, w, h - hDas);
      ctx.restore();
      const peta = offsetMap(out.map, 0, hDas);
      petaGrafik.current = peta;
      const pita = out.maps?.topBars ? offsetMap(out.maps.topBars, 0, hDas) : null;
      petaPita.current = pita;
      if (!bergerak) {
        titikKursor.current[0][0] = k.Q;
        drawTimeCursor(ctx, peta, tK, titikKursor.current);
      }
      const anchors: Record<string, { x: number; y: number }> = {};
      if (pita) r.pias.forEach((q, i) => (anchors[`b${i}`] = { x: pita.X((q.t0 + q.t1) / 2), y: pita.Y(q.P) }));
      if (pita && r.pias.length) {
        lebarBatang.current = Math.abs(pita.X(r.pias[0].t1) - pita.X(r.pias[0].t0));
        const q = r.pias[Math.min(pilih, r.pias.length - 1)];
        anchors.pilih = { x: pita.X((q.t0 + q.t1) / 2), y: pita.Y(q.P) };
      }
      const maps: Record<string, PlateMap> = {};
      if (pita) maps.topBars = pita;
      return { map: peta, anchors, maps };
    },
    (ctx, w, h, tt) => {
      const tata = tataRef.current;
      const peta = petaGrafik.current;
      if (!tata || !peta) return;
      const m = mulai.current;
      if (m.tt === null) m.tt = tt;
      let t = (m.t + (tt - m.tt) * LAJU) % tAkhir;
      if (t < 0) t += tAkhir;
      m.kini = t;
      const k = kini.current;
      readHydrograph(r.points, t, k);
      drawCatchmentState(ctx, tata, t, dur, k.rain, k.Q, tt);
      titikKursor.current[0][0] = k.Q;
      drawTimeCursor(ctx, peta, t, titikKursor.current);
    },
    [blok.join(","), dur, CN, A, tc, lang, kursor, bergerak, dibatasiP, pilih, kunci ? kunci.pMax : NaN],
    { playing }
  );

  const putar = () => {
    // Dibulatkan ke bawah supaya tetap di dalam P_KURSOR (kini < tAkhir).
    if (playing) ubahKursor(keBawahKursor(mulai.current.kini));
    else {
      mulai.current.tt = null;
      mulai.current.t = kursor;
    }
    togglePutar();
  };

  /* Batang selebar kurang dari 44 px: pegangan 44 px akan bertumpuk,
     jadi dipakai SATU pegangan dua sumbu: geser mendatar memilih pias,
     geser tegak mengatur hujannya (menyapu = menggambar hyetograph). */
  const sempitBatang = lebarBatang.current > 0 && lebarBatang.current < 44;
  const P_INDEKS: ParamDef = { min: 0, max: Math.max(nPias - 1, 0), step: 1, digits: 0 };
  const iPilih = Math.min(pilih, nPias - 1);
  const handlesSempit: HandleSpec[] = [
    {
      id: "pilih",
      anchor: "pilih",
      axis: "xy",
      label: x.gPilih,
      tint: C.water,
      param: [P_INDEKS, P_PIAS],
      value: [iPilih, blok[iPilih]],
      toValue: (px, py) => {
        const m = petaPita.current;
        if (!m) return [iPilih, blok[iPilih]];
        return [Math.floor(m.invX(px) / dD), m.invY(py)];
      },
      onChange: ([i, v]) => {
        setPilih(i);
        setBlok(i, v);
      },
      format: (v) => `${lang === "id" ? "pias" : "block"} ${fmt(v[0] + 1, 0)}: ${fmt(v[1], 1)} mm`,
    },
  ];
  const handlesLebar: HandleSpec[] = blok.map(
    (v, i): HandleSpec => ({
      id: `b${i}`,
      anchor: `b${i}`,
      axis: "y",
      label: x.gPias.replace("{i}", String(i + 1)),
      tint: C.water,
      param: P_PIAS,
      value: v,
      toValue: (_px, py) => (petaPita.current ? petaPita.current.invY(py) : v),
      onChange: (q) => setBlok(i, q),
      format: (q) => `${fmt(q, 1)} mm`,
    })
  );
  const handles = sempitBatang ? handlesSempit : handlesLebar;
  const lepasKunci = () => setKunci(null);

  /* Pemeriksaan yang ikut hyetograph yang digambar: kekekalan isi. */
  const cekBlok: Check[] = [
    {
      label: { id: TXT.id.cekVol, en: TXT.en.cekVol },
      source: "NEH 630 Bab 16 (konvolusi) dan Bab 10 (CN kumulatif): Dr = V/A = ΣPe",
      kind: "sifat",
      expected: r.pias.length ? r.pias[r.pias.length - 1].PeKum : 0,
      actual: r.runoffDepth,
      tol: 0.01,
      unit: "mm",
      digits: 3,
    },
  ];

  return (
    <LabShell
      sheet="HY-02"
      subject={SUBJECTS.HY[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Hujan yang jatuh merata di daerah aliran tidak sampai ke sungai
            sekaligus. Sebagian <Term tint={C.ink3}>hilang</Term> ke dalam
            tanah, sisanya tiba{" "}
            <Term tint={C.water}>terlambat dan tersebar</Term> menurut jarak
            tempuhnya masing-masing.
          </p>
        ) : (
          <p>
            Rain falling evenly over a catchment does not reach the river all at
            once. Part is <Term tint={C.ink3}>lost</Term> into the ground, and
            the rest arrives{" "}
            <Term tint={C.water}>late and spread out</Term> according to how far
            each part had to travel.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HY-02"
          title={x.sheetTitle}
          rev="A"
          height="clamp(580px, 84vh, 880px)"
          motion={{ playing, onToggle: putar, allowed: plate.motionAllowed, note: `${x.motionNoteA} ${fmt(LAJU, 1)} ${x.motionNoteB}` }}
          cells={[
            { label: t.tbUnit, value: "SI (mm, m³/s)" },
            { label: "P", value: `${fmt(P, 0)} mm` },
            { label: "Pe", value: `${fmt(r.effectiveRain, 1)} mm`, tint: C.water },
            { label: "Qp", value: `${fmt(r.peak, 1)} m³/s`, tint: C.water },
            { label: "tpk", value: `${fmt(r.peakTime, 2)} h`, tint: C.energy },
          ]}
        >
          <canvas ref={plate.ref} className="block h-full w-full" />
          <canvas ref={plate.motionRef} />
          <div
            className="contents"
            onPointerDown={(e) => {
              if (e.pointerType === "mouse" && e.button !== 0) return;
              if (kunci) return;
              setKunci(bidangRef.current);
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
              <InputRow symbol="P" label={x.dP} value={P} {...P_TOTAL} unit="mm" onChange={setP} tint={C.water} />
              <InputRow symbol="D" label={x.dDur} value={dur} min={1} max={36} step={1} digits={0} unit="h" onChange={setDur} />
              <InputRow symbol="CN" label={x.dCN} value={CN} min={30} max={100} step={1} digits={0} onChange={setCN} tint={C.critical} />
              <InputRow symbol="A" label={x.dA} value={A} min={1} max={1000} step={1} digits={0} unit="km²" onChange={setA} />
              <InputRow symbol="tc" label={x.dTc} value={tc} min={0.3} max={24} step={0.1} digits={1} unit="h" onChange={setTc} tint={C.energy} />
              <InputRow symbol="t" label={x.dKursor} value={kursor} {...P_KURSOR} unit="h" onChange={ubahKursor} penanda={kursorJepit !== null && kursorJepit === kursor ? x.kursorJepit.replace("{v}", fmt(kursorJepit, 1)) : null} />
            </InputTable>
            <SentuhContoh sentuh={sentuh} />

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pSawah, apply: () => aturContoh(80, 6, 75, 50, 4) },
                  { label: x.pKota, apply: () => aturContoh(150, 3, 92, 12, 1.2) },
                  { label: x.pHutan, apply: () => aturContoh(60, 18, 55, 300, 14) },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "Qp", label: x.rPeak, value: fmt(r.peak, 2), unit: "m³/s", tint: C.water, strong: true },
                { symbol: "tpk", label: x.rPeakTime, value: fmt(r.peakTime, 2), unit: "h", tint: C.energy, strong: true },
                { symbol: "Pe", label: x.rPe, value: fmt(r.effectiveRain, 2), unit: "mm", tint: C.water },
                { symbol: "—", label: x.rLoss, value: fmt(hilang, 2), unit: "mm", tint: C.ink3 },
                { symbol: "S", label: x.rS, value: fmt(S, 1), unit: "mm", tint: C.critical },
                { symbol: "Ia", label: x.rIa, value: fmt(Ia, 2), unit: "mm" },
                { symbol: "ΔD", label: x.rDD, value: fmt(r.blockLength, 3), unit: "h" },
                { symbol: "Tp", label: x.rTp, value: fmt(r.tp, 2), unit: "h" },
                { symbol: "qp", label: x.rQp, value: fmt(r.qp, 3), unit: x.perMm },
                { symbol: "V", label: x.rVol, value: fmt(r.volume / 1e6, 3), unit: T.millionCubic },
                { symbol: "Dr", label: x.rDepth, value: fmt(r.runoffDepth, 2), unit: "mm" },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: `${x.rS}; ${x.rIa}`,
                    rumus: (<><span>S =</span><Frac num="25400" den="CN" /><span>− 254;  Ia = {fmt(0.2, 1)} · S</span></>),
                    isi: `25400 / ${fmt(CN, 0)} − 254;  Ia = ${fmt(0.2, 1)} · ${fmt(S, 2)}`,
                    hasil: `S = ${fmt(S, 1)};  Ia = ${fmt(Ia, 2)}`,
                    satuan: "mm",
                    tint: C.critical,
                  },
                  {
                    judul: adaLimpas ? x.rPe : x.hPe0,
                    rumus: (<><span>Pe =</span><Frac num="( P − Ia )²" den="P − Ia + S" /></>),
                    isi: adaLimpas
                      ? `( ${fmt(P, 0)} − ${fmt(Ia, 3)} )² / ( ${fmt(P, 0)} − ${fmt(Ia, 3)} + ${fmt(S, 3)} )`
                      : `${fmt(P, 0)} ≤ ${fmt(Ia, 3)}`,
                    hasil: fmt(r.effectiveRain, 2),
                    satuan: "mm",
                    tint: C.water,
                  },
                  {
                    judul: x.rDD,
                    rumus: <span>ΔD = D / min( ⌈ D / min( 1; {fmt(0.133, 3)} · tc ) ⌉; 24 )</span>,
                    isi: `${fmt(dur, 0)} / ${nPias} (${x.hPiasMaks})`,
                    hasil: fmt(r.blockLength, 3),
                    satuan: "h",
                  },
                  {
                    judul: x.rTp,
                    rumus: (<><span>Tp =</span><Frac num="ΔD" den="2" /><span>+ {fmt(0.6, 1)} · tc</span></>),
                    isi: `${fmt(r.blockLength, 4)} / 2 + ${fmt(0.6, 1)} · ${fmt(tc, 1)}`,
                    hasil: fmt(r.tp, 2),
                    satuan: "h",
                  },
                  {
                    judul: x.rQp,
                    rumus: (<><span>qp =</span><Frac num={`${fmt(0.208, 3)} · A`} den="Tp" /></>),
                    isi: `${fmt(0.208, 3)} · ${fmt(A, 0)} / ${fmt(r.tp, 3)}`,
                    hasil: fmt(r.qp, 3),
                    satuan: x.perMm,
                  },
                  {
                    judul: `${x.hPeak}, tpk = ${fmt(r.peakTime, 2)} h`,
                    rumus: <span>Qp = {lang === "id" ? "maks" : "max"} Σ Peₖ · qp · u( t − k · ΔD )</span>,
                    isi: adaLimpas
                      ? `${lang === "id" ? "maks" : "max"} Σ Peₖ · ${fmt(r.qp, 4)} · u( t − k · ${fmt(r.blockLength, 4)} ),  Pe = ${r.pias.slice(0, 6).map((q) => fmt(q.Pe, 2)).join("; ")}${r.pias.length > 6 ? "; …" : ""}`
                      : "—",
                    hasil: fmt(r.peak, 2),
                    satuan: "m³/s",
                    tint: C.water,
                  },
                  {
                    judul: x.hCek,
                    rumus: (<><span>Dr =</span><Frac num="V" den="A" /><span>≈ Pe</span></>),
                    isi: `${fmt(r.volume, 0)} m³ / ( ${fmt(A, 0)} · 10⁶ m² ) · 1000`,
                    hasil: fmt(r.runoffDepth, 2),
                    satuan: "mm",
                  },
                ]}
              />
            </div>
            <div className="mt-3 overflow-x-auto">
              <p className="stencil mb-1">{x.tabelPias}</p>
              <table className="w-full text-right text-[0.8rem] tabular-nums">
                <thead className="text-ink-3">
                  <tr>
                    <th className="pr-2 font-normal">{x.kolK}</th>
                    <th className="pr-2 font-normal">{x.kolP}</th>
                    <th className="pr-2 font-normal">{x.kolPk}</th>
                    <th className="pr-2 font-normal">{x.kolPek}</th>
                    <th className="font-normal">{x.kolPe}</th>
                  </tr>
                </thead>
                <tbody className="text-ink-2">
                  {r.pias.map((q, k) => (
                    <tr key={k}>
                      <td className="pr-2">{k + 1}</td>
                      <td className="pr-2">{fmt(q.P, 2)}</td>
                      <td className="pr-2">{fmt(q.Pkum, 2)}</td>
                      <td className="pr-2">{fmt(q.PeKum, 2)}</td>
                      <td>{fmt(q.Pe, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Block>

          <StateCard
            tone={r.blockTooCoarse ? "caution" : adaLimpas ? "water" : "neutral"}
            badge={r.blockTooCoarse ? x.kasar : adaLimpas ? x.adaLimpas : x.tanpaLimpas}
            {...notice(P, dur, CN, A, tc, r.peak, r.peakTime, r.effectiveRain, r.blockTooCoarse, lang, blok, dD)}
          />
        </>
      }
      verification={<Verification checks={[...checksHydrograph(P, dur, CN, A, tc), ...cekBlok]} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>S =</span>
                <Frac num="25400" den="CN" />
                <span>− 254</span>
                <span className="ml-5">Ia = 0,2 S</span>
              </Eq>
              <Eq>
                <span>Pe =</span>
                <Frac num="(P − Ia)²" den="P − Ia + S" />
                <span className="ml-4 text-ink-3">
                  {lang === "id" ? "bila P melebihi Ia" : "if P exceeds Ia"}
                </span>
              </Eq>
              <Eq>
                <span>Tp =</span>
                <Frac num="ΔD" den="2" />
                <span>+ 0,6 tc</span>
                <span className="ml-5">ΔD ≈ min(1 h; {fmt(0.133, 3)} tc)</span>

                <span className="ml-5">qp =</span>
                <Frac num="0,208 A" den="Tp" />
                <span className="ml-3 text-ink-3">
                  {lang === "id"
                    ? "0,208 bila limpasan dalam mm; 2,08 bila dalam cm"
                    : "0.208 for runoff in mm; 2.08 for centimetres"}
                </span>
              </Eq>
            </>
          }
          note={`${x.note} ${x.kumulatifNote}`}
          refs={[...REFS[lang]]}
        />
      }
    />
  );
}

function notice(
  P: number,
  dur: number,
  CN: number,
  A: number,
  tc: number,
  peak: number,
  peakTime: number,
  Pe: number,
  kasar: boolean,
  lang: Lang,
  blok: number[],
  dD: number
): { state: string; notice: string[] } {
  const x = TXT[lang];
  const en = lang === "en";
  const CN2 = Math.min(CN + 10, 100);
  const butir: string[] = [];

  if (kasar) butir.push(x.kasarNote);

  // Kepekaan CN memakai selisih sebenarnya; pada CN 100 tidak ada lagi
  // yang bisa dinaikkan, jadi butirnya ditekan.
  if (CN2 > CN) {
    const naik = floodHydrographBlocks(blok, dD, CN2, A, tc, { kehilangan: "kumulatif" });
    if (peak <= 1e-9) {
      butir.push(
        naik.peak > 1e-9
          ? en
            ? `At CN ${fmtPlain(CN2, 0)} this rain starts to run off: the peak becomes ${fmt(naik.peak, 2)} m³/s with no extra rain.`
            : `Pada CN ${fmtPlain(CN2, 0)} hujan ini mulai melimpas: puncaknya menjadi ${fmt(naik.peak, 2)} m³/s tanpa tambahan hujan.`
          : en
            ? `Even at CN ${fmtPlain(CN2, 0)} this rain is still held back completely.`
            : `Pada CN ${fmtPlain(CN2, 0)} pun hujan ini masih tertahan seluruhnya.`
      );
    } else {
      const beda = ((naik.peak - peak) / peak) * 100;
      const d = fmtPlain(CN2 - CN, 0);
      butir.push(
        en
          ? `Raise the curve number by ${d}, from ${fmtPlain(CN, 0)} to ${fmtPlain(CN2, 0)}, and the peak rises by ${fmt(beda, 0)} per cent while the rainfall is untouched.`
          : `Naikkan CN sebesar ${d} angka, dari ${fmtPlain(CN, 0)} ke ${fmtPlain(CN2, 0)}, dan puncaknya naik ${fmt(beda, 0)} persen tanpa satu milimeter pun hujan ditambahkan.`
      );
    }
  }

  if (Pe > 0) {
    const bagian = fmt((Pe / P) * 100, 0);
    // "CN rendah" hanya ditulis bila CN-nya memang rendah.
    const rendah = CN < 60;
    butir.push(
      en
        ? `${rendah ? "Little rain becomes runoff at a low curve number: at" : "At"} CN ${fmtPlain(CN, 0)}, ${bagian} per cent of ${fmtPlain(P, 0)} mm reaches the river.`
        : `${rendah ? "Pada CN rendah sedikit hujan yang menjadi limpasan: pada" : "Pada"} CN ${fmtPlain(CN, 0)}, ${bagian} persen dari ${fmtPlain(P, 0)} mm sampai ke sungai.`
    );
  }
  butir.push(x.andaian);

  const state =
    Pe > 0
      ? en
        ? `Of ${fmtPlain(P, 0)} mm of rain, ${fmt(Pe, 1)} mm becomes runoff; the peak is ${fmt(peak, 1)} m³/s at hour ${fmt(peakTime, 2)}.`
        : `Dari ${fmtPlain(P, 0)} mm hujan, ${fmt(Pe, 1)} mm menjadi limpasan; puncak ${fmt(peak, 1)} m³/s pada jam ke-${fmt(peakTime, 2)}.`
      : en
        ? "The rain is held back completely; there is no runoff."
        : "Hujan seluruhnya tertahan, tidak ada limpasan.";

  return { state, notice: butir };
}
