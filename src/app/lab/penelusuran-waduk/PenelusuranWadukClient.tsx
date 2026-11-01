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
import { usePlate, usePutar } from "@/lib/usePlate";
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import { G, fmt, fmtPlain, reservoirRouting } from "@/lib/hydraulics";
import {
  drawReservoir,
  drawReservoirState,
  drawTimeCursor,
  offsetMap,
  readRouting,
  type ReservoirLayout,
} from "@/lib/drawBasin";
import { hidrografDariTitik, rapikanTitik, type TitikHidrograf } from "@/lib/hidrografKendali";
import type { PlateMap, PlateOut } from "@/lib/plateOut";
import { DragLayer, type HandleSpec } from "@/components/DragLayer";
import type { ParamDef } from "@/lib/rentang";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksRouting } from "@/lib/checks";

const TXT = {
  id: {
    title: "Penelusuran waduk",
    sheetTitle: "Penelusuran banjir lewat waduk — peredaman puncak oleh tampungan",
    dQp: "Puncak banjir masuk",
    dTp: "Waktu puncak banjir masuk",
    dArea: "Luas genangan pada muka air mercu",
    dB: "Lebar mercu pelimpah",
    dFb: "Tinggi jagaan di atas mercu",
    dCd: "Koefisien debit pelimpah",
    pKecil: "Waduk kecil, pelimpah lebar",
    pSedang: "Waduk sedang",
    pBesar: "Waduk besar, pelimpah sempit",
    rIn: "Puncak masuk",
    rOut: "Puncak keluar",
    rAtt: "Bagian puncak yang teredam",
    rLag: "Selang antara kedua puncak",
    rHmax: "Tinggi muka air tertinggi",
    rSmax: "Tampungan terpakai terbesar",
    rFb: "Sisa jagaan",
    limpas: "Air melampaui puncak bendungan",
    aman: "Di bawah puncak bendungan",
    pitaLimpas: "Melimpas, hitungan tidak berlaku",
    sedia: "Waduk meredam",
    hBase: "Waktu dasar hidrograf masuk (titik kendali terakhir)",
    dKursor: "Kursor waktu, jam ke-",
    gPuncak: "Puncak banjir masuk Ip dan tp, seret titik puncak ke mana saja",
    gTitik: "Titik kendali {i} hidrograf masuk, seret ke mana saja",
    dibatasiTitik: "titik {i} digeser: urutan waktu dan puncak dijaga",
    lReservoir: "waduk",
    lDam: "bendungan",
    lSpillway: "mercu pelimpah",
    lDamCrest: "puncak bendungan,",
    lStorage: "tampungan",
    lHmax: "hmax",
    lOvertop: "melimpas di atas puncak bendungan",
    tabelPuls: "Langkah metode Puls di sekitar puncak keluar",
    kolT: "t (h)",
    kolI: "I (m³/s)",
    kolO: "O (m³/s)",
    kolH: "h (m)",
    kolS: "S (juta m³)",
    kendaliNote:
      "Hidrograf masuk dibentuk dari lima titik kendali yang bisa diseret di grafik; titik puncak sama dengan penggeser Ip dan tp. Kurva di antara titik disambung monoton (Fritsch dan Carlson 1980) supaya tidak melampaui puncak yang digambar; ini bentuk yang digambar pengguna, bukan hasil model hujan. Ekor nol ditambahkan sampai 1,6 kali waktu titik terakhir.",
    motionNoteA: "Waktu dipercepat: satu detik layar =",
    motionNoteB: "jam. Waduk tampak samping skematik: tinggi muka air dan tampungan di atas mercu dibaca dari hasil penelusuran; bentuk tebing dan kolam di bawah mercu tidak dihitung.",
    hDt: "Selang kisi hitungan",
    hStep: "Satu langkah di puncak keluar",
    hStepNote: "diselesaikan dengan Newton atas h₂",
    hSub: "selang ini dipecah menjadi sublangkah karena tampungannya kecil, jadi substitusi satu langkah hanya hampiran",
    limpasState: "Air melampaui puncak bendungan: seluruh angka tidak berlaku.",
    limpasNote:
      "Tinggi muka air tertinggi melebihi tinggi jagaan yang tersedia, artinya air melimpah di atas puncak bendungan dan bukan lagi lewat pelimpahnya saja. Hitungan di lembar ini tidak berlaku sejak saat itu, karena seluruhnya mengandaikan air keluar hanya lewat pelimpah. Bendungan urukan yang dilimpasi biasanya runtuh dalam hitungan jam. Perlebar pelimpahnya, perbesar luas genangannya, atau tinggikan jagaannya.",
    note:
      "Dua sifat lembar ini layak diperhatikan karena keduanya berlaku untuk waduk mana pun, apa pun bentuk dan ukurannya. Yang pertama, puncak keluar selalu terjadi persis ketika kurva keluar memotong kurva masuk. Alasannya sederhana dan tidak bergantung pada rumus pelimpah mana pun: selama debit masuk masih melebihi debit keluar, tampungannya masih bertambah, muka airnya masih naik, dan keluarannya masih ikut naik. Begitu keduanya sama, tampungannya berhenti bertambah, dan di situlah keluarannya memuncak. Yang kedua, luas di antara kedua kurva sebelum perpotongan itu persis sama dengan tampungan yang terpakai. Keduanya dapat dilihat langsung di gambar, dan keduanya diuji di blok verifikasi. Perhatikan juga bahwa peredaman tidak datang dari pelimpahnya melainkan dari tampungannya: memperlebar pelimpah justru mengurangi peredaman, karena air lebih mudah keluar dan lebih sedikit yang tersimpan.",
  },
  en: {
    title: "Reservoir routing",
    sheetTitle: "Flood routing through a reservoir — peak attenuation by storage",
    dQp: "Inflow flood peak",
    dTp: "Time of the inflow peak",
    dArea: "Surface area at crest level",
    dB: "Spillway crest width",
    dFb: "Freeboard above the crest",
    dCd: "Spillway discharge coefficient",
    pKecil: "Small reservoir, wide spillway",
    pSedang: "Medium reservoir",
    pBesar: "Large reservoir, narrow spillway",
    rIn: "Inflow peak",
    rOut: "Outflow peak",
    rAtt: "Fraction of the peak attenuated",
    rLag: "Gap between the two peaks",
    rHmax: "Highest water level",
    rSmax: "Largest storage used",
    rFb: "Freeboard remaining",
    limpas: "Water overtops the dam crest",
    aman: "Below the dam crest",
    pitaLimpas: "Overtopping, calculation invalid",
    sedia: "Reservoir attenuates",
    hBase: "Base time of the inflow hydrograph (last control point)",
    dKursor: "Time cursor, hour",
    gPuncak: "Inflow peak Ip and tp, drag the peak point anywhere",
    gTitik: "Inflow hydrograph control point {i}, drag anywhere",
    dibatasiTitik: "point {i} moved: time order and peak kept",
    lReservoir: "reservoir",
    lDam: "dam",
    lSpillway: "spillway crest",
    lDamCrest: "dam crest,",
    lStorage: "storage",
    lHmax: "hmax",
    lOvertop: "overtopping the dam crest",
    tabelPuls: "Puls method steps around the outflow peak",
    kolT: "t (h)",
    kolI: "I (m³/s)",
    kolO: "O (m³/s)",
    kolH: "h (m)",
    kolS: "S (million m³)",
    kendaliNote:
      "The inflow hydrograph is shaped by five control points that can be dragged on the chart; the peak point is the same as the Ip and tp sliders. The curve between points is joined monotonically (Fritsch and Carlson 1980) so it never overshoots the drawn peak; this is the shape the user draws, not the output of a rainfall model. A zero tail is added up to 1.6 times the time of the last point.",
    motionNoteA: "Time is sped up: one screen second =",
    motionNoteB: "hours. The reservoir side view is schematic: the water level and the storage above the crest are read from the routing result; the bank shape and the pool below the crest are not computed.",
    hDt: "Calculation grid interval",
    hStep: "One step at the outflow peak",
    hStepNote: "solved by Newton on h₂",
    hSub: "this interval is split into substeps because storage is small, so the one-step substitution is only approximate",
    limpasState: "Water overtops the dam crest: every figure is invalid.",
    limpasNote:
      "The highest water level exceeds the available freeboard, meaning water spills over the dam crest and no longer leaves through the spillway alone. The calculation on this sheet stops holding at that moment, because all of it assumes water leaves only through the spillway. An embankment dam that is overtopped usually fails within hours. Widen the spillway, enlarge the surface area, or raise the freeboard.",
    note:
      "Two properties of this sheet are worth noticing, because both hold for any reservoir whatever its shape or size. First, the outflow peak always occurs exactly where the outflow curve crosses the inflow curve. The reason is simple and depends on no spillway formula: while the inflow still exceeds the outflow, the storage is still growing, the level is still rising, and the outflow is still rising with it. The moment the two are equal, the storage stops growing, and that is where the outflow peaks. Second, the area between the two curves before that crossing is exactly the storage used. Both can be seen directly in the figure, and both are tested in the verification block. Note too that the attenuation comes from the storage rather than the spillway: widening the spillway reduces the attenuation, because water leaves more easily and less of it is held back.",
  },
} as const;

const REFS = {
  id: [
    "Chow, V.T., Maidment, D.R. & Mays, L.W. (1988). Applied Hydrology. McGraw-Hill, Bab 8.",
    "Puls, L.G. (1928). Construction of flood routing curves. House Document 185, US Congress.",
    "USBR (1987). Design of Small Dams, edisi ke-3, bab pelimpah dan penelusuran banjir.",
    "Fread, D.L. (1993). Flow routing. Dalam Maidment (ed.), Handbook of Hydrology, Bab 10.",
  ],
  en: [
    "Chow, V.T., Maidment, D.R. & Mays, L.W. (1988). Applied Hydrology. McGraw-Hill, Chapter 8.",
    "Puls, L.G. (1928). Construction of flood routing curves. House Document 185, US Congress.",
    "USBR (1987). Design of Small Dams, 3rd ed., chapters on spillways and flood routing.",
    "Fread, D.L. (1993). Flow routing. In Maidment (ed.), Handbook of Hydrology, Chapter 10.",
  ],
} as const;

/* Rentang: satu definisi untuk penggeser dan pegangan seret (aturan 4). */
const P_IP: ParamDef = { min: 5, max: 2000, step: 5, digits: 0 };
const P_TP: ParamDef = { min: 0.5, max: 36, step: 0.5, digits: 1 };
const P_T: ParamDef = { min: 0, max: 150, step: 0.1, digits: 1 };
const P_Q: ParamDef = { min: 0, max: 2000, step: 1, digits: 0 };
const P_KURSOR: ParamDef = { min: 0, max: 250, step: 0.1, digits: 1 };
/** Jarak waktu terkecil antartitik kendali, jam */
const SELA = 0.25;

/** Lima titik meniru hidrograf segitiga lama: 0, tp/2, tp, tengah sisi turun, tb = 2,67 tp. */
function titikAwal(Ip: number, tp: number): TitikHidrograf[] {
  const tb = 2.67 * tp;
  return [
    { t: 0, Q: 0 },
    { t: tp / 2, Q: Ip / 2 },
    { t: tp, Q: Ip },
    { t: (tp + tb) / 2, Q: Ip / 2 },
    { t: tb, Q: 0 },
  ];
}

/** Urutan waktu dijaga (rapikanTitik), titik 0 tetap, titik lain tidak melampaui puncak. */
function rapikan(p: TitikHidrograf[]): { titik: TitikHidrograf[]; dibatasi: boolean[] } {
  const r = rapikanTitik(p, SELA, { tMin: 0, tMax: P_T.max, QMax: P_Q.max });
  r.titik[0] = { t: 0, Q: 0 };
  r.dibatasi[0] = false;
  const puncak = r.titik[2].Q;
  for (const i of [1, 3, 4])
    if (r.titik[i].Q > puncak) {
      r.titik[i] = { t: r.titik[i].t, Q: puncak };
      r.dibatasi[i] = true;
    }
  return r;
}

export function PenelusuranWadukClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  /* Hidrograf masuk dari lima titik kendali (hidrografKendali.ts, bukan
     fisika). Titik 0 tetap di (0, 0); titik 2 = puncak = penggeser Ip, tp.
     Tiap perubahan dirapikan: urutan waktu dijaga dan titik lain tidak
     boleh melampaui puncak; titik yang digeser diberi penanda. */
  const [titik, setTitikMentah] = useState<TitikHidrograf[]>(() => titikAwal(120, 6));
  const [dibatasi, setDibatasi] = useState<boolean[]>([false, false, false, false, false]);
  const setTitik = (p: TitikHidrograf[]) => {
    const r = rapikan(p);
    setTitikMentah(r.titik);
    setDibatasi(r.dibatasi);
  };
  const Qp = titik[2].Q;
  const tPeak = titik[2].t;
  /* Penggeser dan pegangan puncak menggeser bentuk: sisi naik diskalakan
     dengan tp, sisi turun digeser bersama puncak, debit diskalakan dengan Ip. */
  const setPuncak = (Ip: number, tp: number) => {
    const lama = titik[2];
    const kQ = lama.Q > 0 ? Ip / lama.Q : 1;
    const kT = lama.t > 0 ? tp / lama.t : 1;
    const geser = tp - lama.t;
    setTitik([
      titik[0],
      { t: titik[1].t * kT, Q: titik[1].Q * kQ },
      { t: tp, Q: Ip },
      { t: titik[3].t + geser, Q: titik[3].Q * kQ },
      { t: titik[4].t + geser, Q: titik[4].Q * kQ },
    ]);
  };
  const setQp = (v: number) => setPuncak(v, tPeak);
  const setTPeak = (v: number) => setPuncak(Qp, v);
  const [areaHa, setAreaHa] = useState(200);
  const [b, setB] = useState(30);
  const [fb, setFb] = useState(3);
  const [Cd, setCd] = useState(0.6);
  const [kursor, setKursor] = useState(8);

  const tb = titik[4].t;
  const tEkor = 1.6 * tb;
  const dtKisi = tEkor / 160;
  const masuk = hidrografDariTitik([...titik, { t: tEkor, Q: 0 }], dtKisi, "monoton");

  const area = areaHa * 1e4;
  const r = reservoirRouting(masuk, area, b, fb, Cd);
  const sisaJagaan = fb - r.maxHead;
  const limpas = r.overtops;
  // Selama melimpas, angka yang mengandaikan air keluar lewat pelimpah saja
  // ditulis "—"; hmax dan f′ tetap tampil karena keduanya sebabnya.
  const sah = (v: string) => (limpas ? "—" : v);
  // Digit Omax di kop sama dengan label titik di gambar.
  const digitO = r.outflowPeak < 1 ? 3 : 1;


  // Satu langkah hitungan di titik puncak keluar, dibaca dari hasil model.
  const kP = r.points.reduce((m, p, i, a) => (p.outflow > a[m].outflow ? i : m), 0);
  const p1 = r.points[Math.max(kP - 1, 0)];
  const p2 = r.points[kP];
  const dtS = (p2.t - p1.t) * 3600;
  const kanan = p1.storage - (dtS * p1.outflow) / 2 + (dtS * (p1.inflow + p2.inflow)) / 2;
  const kiri = p2.storage + (dtS * p2.outflow) / 2;
  // Model memecah selang menjadi sublangkah bila tampungannya kecil; saat
  // itu satu langkah trapesium di kisi tidak lagi setimbang persis.
  const hampiran = kP > 0 && Math.abs(kiri - kanan) > 1e-6 * Math.max(kanan, 1);

  /* Bidang grafik dikunci selama pegangan diseret (pola HS-01): tanpa
     kunci, sumbu ikut nilai yang diseret dan pegangan saling kejar. */
  const [kunci, setKunci] = useState<{ tMax: number; qMax: number } | null>(null);
  const bebas = {
    tMax: masuk[masuk.length - 1].t,
    qMax: Math.max(Math.max(...titik.map((p) => p.Q)) * 1.15, 1e-6),
  };
  const bidangRef = useRef(bebas);
  bidangRef.current = bebas;
  const bidang = kunci ?? bebas;

  const { playing, toggle: togglePutar } = usePutar();
  const bergerak = playing;
  const sentuh = useRef<() => void>(() => {});
  const tataRef = useRef<ReservoirLayout | null>(null);
  const petaGrafik = useRef<PlateMap | null>(null);
  const mulai = useRef<{ tt: number | null; t: number; kini: number }>({ tt: null, t: 8, kini: 8 });
  const kini = useRef({ inflow: 0, outflow: 0, head: 0, storage: 0 });
  const titikKursor = useRef<[number, string][]>([
    [0, C.water],
    [0, C.energy],
  ]);
  /** Jam model per detik layar: seluruh hidrograf dalam 12 detik */
  const LAJU = tEkor / 12;
  const labelWaduk = {
    reservoir: x.lReservoir,
    dam: x.lDam,
    spillway: x.lSpillway,
    damCrest: x.lDamCrest,
    storage: x.lStorage,
    hmax: x.lHmax,
    overtop: x.lOvertop,
    millionCubic: T.millionCubic,
  };

  const grafik = (ctx: CanvasRenderingContext2D, w: number, h: number): PlateOut => {
      const tMax = bidang.tMax;
      const deret: ChartSeries[] = [
        {
          pts: r.points.map((p) => ({ x: p.t, y: p.inflow })),
          color: C.water,
          weight: W.bold,
          label: T.inflowCurve,
          labelAt: 0.28,
          labelDy: -11,
        },
        {
          pts: r.points.map((p) => ({ x: p.t, y: p.outflow })),
          color: limpas ? C.signal : C.energy,
          weight: W.bold,
          dash: limpas ? DASH.invalid : DASH.solid,
          label: T.outflowCurve,
          labelAt: 0.62,
          labelDy: 14,
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
          yMax: bidang.qMax,
          axisX: T.axTimeHour,
          axisY: T.axFlowRate,
          series: deret,
          point: {
            x: p2.t,
            y: r.outflowPeak,
            /* Tiga desimal untuk puncak yang kecil, karena waduk besar dengan
               pelimpah sempit meredam sampai puluhan liter per detik dan satu
               desimal menuliskannya sebagai nol. Kop memakai digit yang sama. */
            label: `${fmtPlain(r.outflowPeak, digitO)} m³/s`,
            invalid: limpas,
          },
          heading: limpas ? x.limpas : undefined,
          headingColor: C.signal,
          markers: titik.map((p) => ({ x: p.t, y: p.Q, color: C.water, hollow: true })),
          regions: dibatasi.some((d) => d)
            ? [{ x: bidang.tMax * 0.5, y: bidang.qMax * 0.97, text: x.dibatasiTitik.replace("{i}", dibatasi.map((d, i) => (d ? String(i) : "")).filter(Boolean).join(", ")), color: C.caution }]
            : undefined,
          anchors: Object.fromEntries(titik.map((p, i) => [`p${i}`, { x: p.t, y: p.Q }])),
        },
        lang
      );
  };

  const plate = usePlate(
    (ctx, w, h) => {
      const hRes = Math.round(Math.min(Math.max(h * 0.38, 160), 270));
      const tK = Math.min(kursor, tEkor);
      const k = { inflow: 0, outflow: 0, head: 0, storage: 0 };
      readRouting(r.points, tK, k);
      const res = drawReservoir(
        ctx,
        w,
        hRes,
        {
          head: k.head,
          freeboard: fb,
          crestWidth: b,
          storage: k.storage,
          overtops: limpas,
          headMax: r.maxHead,
          inflow: k.inflow,
          outflow: k.outflow,
          flowMax: r.inflowPeak,
        },
        { labels: labelWaduk, withState: !bergerak }
      );
      tataRef.current = res.layout;
      ctx.save();
      ctx.translate(0, hRes);
      const out = grafik(ctx, w, h - hRes);
      ctx.restore();
      const peta = offsetMap(out.map, 0, hRes);
      petaGrafik.current = peta;
      if (!bergerak) {
        titikKursor.current[0][0] = k.inflow;
        titikKursor.current[1][0] = k.outflow;
        drawTimeCursor(ctx, peta, tK, titikKursor.current);
      }
      const anchors: Record<string, { x: number; y: number }> = {};
      for (const key in out.anchors ?? {}) anchors[key] = { x: out.anchors![key].x, y: out.anchors![key].y + hRes };
      return { map: peta, anchors, maps: { reservoir: res.out.map } };
    },
    (ctx, w, h, tt) => {
      const tata = tataRef.current;
      const peta = petaGrafik.current;
      if (!tata || !peta) return;
      const m = mulai.current;
      if (m.tt === null) m.tt = tt;
      let t = (m.t + (tt - m.tt) * LAJU) % tEkor;
      if (t < 0) t += tEkor;
      m.kini = t;
      const k = kini.current;
      readRouting(r.points, t, k);
      drawReservoirState(ctx, tata, k.head, k.inflow, k.outflow, k.storage);
      titikKursor.current[0][0] = k.inflow;
      titikKursor.current[1][0] = k.outflow;
      drawTimeCursor(ctx, peta, t, titikKursor.current);
    },
    [
      titik.map((p) => `${p.t},${p.Q}`).join(";"),
      dibatasi.join(","),
      areaHa,
      b,
      fb,
      Cd,
      lang,
      kursor,
      bergerak,
      kunci ? kunci.tMax : NaN,
      kunci ? kunci.qMax : NaN,
    ],
    { playing }
  );

  const putar = () => {
    if (playing) setKursor(Math.round(mulai.current.kini * 10) / 10);
    else {
      mulai.current.tt = null;
      mulai.current.t = Math.min(kursor, tEkor);
    }
    togglePutar();
  };

  const ubahTitik = (i: number) => (v: [number, number]) => {
    const p = titik.slice();
    p[i] = { t: v[0], Q: v[1] };
    setTitik(p);
  };
  const handles: HandleSpec[] = [
    {
      id: "puncak",
      anchor: "p2",
      axis: "xy",
      label: x.gPuncak,
      tint: C.water,
      hollow: true,
      param: [P_TP, P_IP],
      value: [tPeak, Qp],
      toValue: (px, py, m) => [m.invX(px), m.invY(py)],
      onChange: ([tt, q]) => setPuncak(q, tt),
      format: (v) => `tp ${fmt(v[0], 1)} h; Ip ${fmt(v[1], 0)} m³/s`,
    },
    ...[1, 3, 4].map(
      (i): HandleSpec => ({
        id: `p${i}`,
        anchor: `p${i}`,
        axis: "xy",
        label: x.gTitik.replace("{i}", String(i)),
        tint: C.water,
        hollow: true,
        param: [P_T, P_Q],
        value: [titik[i].t, titik[i].Q],
        toValue: (px, py, m) => [m.invX(px), m.invY(py)],
        onChange: ubahTitik(i),
        format: (v) => `t ${fmt(v[0], 1)} h; Q ${fmt(v[1], 0)} m³/s`,
      })
    ),
  ];
  const lepasKunci = () => setKunci(null);

  const persen = fmtPersen(r.attenuation * 100);

  return (
    <LabShell
      status={
        /* Rentang penggeser memberi hmax/f dari 1,6e-5 sampai 153; skala
           berhenti di 2, nilai di atasnya ditandai di luar skala (dan tetap
           merah karena memang melimpas). */
        <RegimeScale
          symbol="hmax/f"
          value={r.maxHead / fb}
          invalid={limpas}
          pesan={limpas ? x.limpas : undefined}
          digits={2}
          bands={[
            { from: 0, to: 1, label: x.aman, tone: "pass" },
            { from: 1, to: 2, label: x.pitaLimpas, tone: "invalid" },
          ]}
        />
      }
      sheet="HY-01"
      subject={SUBJECTS.HY[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Waduk tidak menghilangkan banjir, ia hanya{" "}
            <Term tint={C.energy}>menundanya dan meratakannya</Term>. Yang
            meredam puncak bukan pelimpahnya melainkan{" "}
            <Term tint={C.water}>tampungannya</Term>, dan itu terlihat jelas
            dari luas di antara kedua kurva.
          </p>
        ) : (
          <p>
            A reservoir does not remove a flood, it only{" "}
            <Term tint={C.energy}>delays and flattens it</Term>. What attenuates
            the peak is not the spillway but the{" "}
            <Term tint={C.water}>storage</Term>, and that shows plainly in the
            area between the two curves.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HY-01"
          title={x.sheetTitle}
          rev="A"
          height="clamp(560px, 82vh, 860px)"
          motion={{ playing, onToggle: putar, allowed: plate.motionAllowed, note: `${x.motionNoteA} ${fmt(LAJU, 1)} ${x.motionNoteB}` }}
          cells={[
            { label: t.tbUnit, value: "SI (m³/s, m)" },
            { label: "Imax", value: `${fmt(r.inflowPeak, 1)} m³/s`, tint: C.water },
            { label: "Omax", value: sah(`${fmt(r.outflowPeak, digitO)} m³/s`), tint: C.energy },
            { label: lang === "id" ? "redam" : "atten.", value: sah(`${fmt(r.attenuation * 100, 1)} %`) },
            {
              label: "hmax",
              value: `${fmt(r.maxHead, 2)} m`,
              tint: limpas ? C.signal : undefined,
            },
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
              <InputRow symbol="Ip" label={x.dQp} value={Qp} {...P_IP} unit="m³/s" onChange={setQp} tint={C.water} />
              <InputRow symbol="tp" label={x.dTp} value={tPeak} {...P_TP} unit="h" onChange={setTPeak} />
              <InputRow symbol="As" label={x.dArea} value={areaHa} min={1} max={5000} step={1} digits={0} unit="ha" onChange={setAreaHa} tint={C.energy} />
              <InputRow symbol="b" label={x.dB} value={b} min={2} max={200} step={1} digits={0} unit="m" onChange={setB} />
              <InputRow symbol="f" label={x.dFb} value={fb} min={0.5} max={15} step={0.1} digits={1} unit="m" onChange={setFb} />
              <InputRow symbol="Cd" label={x.dCd} value={Cd} min={0.5} max={0.75} step={0.005} digits={3} onChange={setCd} />
              <InputRow symbol="t" label={x.dKursor} value={kursor} {...P_KURSOR} unit="h" onChange={setKursor} />
            </InputTable>
            <SentuhContoh sentuh={sentuh} />

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pKecil, apply: () => { setTitik(titikAwal(120, 6)); setAreaHa(40); setB(60); setFb(3); setCd(0.6); } },
                  { label: x.pSedang, apply: () => { setTitik(titikAwal(120, 6)); setAreaHa(200); setB(30); setFb(3); setCd(0.6); } },
                  { label: x.pBesar, apply: () => { setTitik(titikAwal(120, 6)); setAreaHa(1200); setB(12); setFb(4); setCd(0.6); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "Omax", label: x.rOut, value: sah(fmt(r.outflowPeak, 2)), unit: "m³/s", tint: C.energy, strong: true },
                { label: x.rAtt, value: sah(fmt(r.attenuation * 100, 2)), unit: "%", strong: true },
                { symbol: "Imax", label: x.rIn, value: fmt(r.inflowPeak, 2), unit: "m³/s", tint: C.water },
                { symbol: "tlag", label: x.rLag, value: sah(fmt(r.lag, 2)), unit: "h" },
                { symbol: "hmax", label: x.rHmax, value: fmt(r.maxHead, 3), unit: "m", tint: limpas ? C.signal : undefined },
                { symbol: "Smax", label: x.rSmax, value: sah(fmt(r.maxStorage / 1e6, 3)), unit: T.millionCubic, tint: C.water },
                { symbol: "f′", label: x.rFb, value: fmt(sisaJagaan, 2), unit: "m", tint: limpas ? C.signal : undefined },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hBase,
                    rumus: <span>tb = t₄</span>,
                    isi: `t₄ = ${fmt(tb, 2)}`,
                    hasil: fmt(tb, 2),
                    satuan: "h",
                  },
                  {
                    judul: x.hDt,
                    rumus: (<><span>Δt =</span><Frac num={`${fmt(1.6, 1)} · tb`} den="160" /><span>(+ {lang === "id" ? "waktu tiap titik kendali" : "each control point time"})</span></>),
                    isi: `${fmt(1.6, 1)} · ${fmt(tb, 2)} / 160`,
                    hasil: fmt(dtKisi, 4),
                    satuan: "h",
                  },
                  {
                    judul: `${x.hStep}, ${x.hStepNote}${hampiran ? `; ${x.hSub}` : ""}`,
                    rumus: <span>As · h₂ + Δt · O(h₂)/2 = S₁ − Δt · O₁/2 + Δt · (I₁ + I₂)/2</span>,
                    isi:
                      kP > 0
                        ? `${fmt(p1.storage, 0)} − ${fmt(dtS, 1)} · ${fmt(p1.outflow, 3)}/2 + ${fmt(dtS, 1)} · (${fmt(p1.inflow, 3)} + ${fmt(p2.inflow, 3)})/2 = ${fmt(kanan, 0)} m³`
                        : "—",
                    hasil: kP > 0 ? `h₂ = ${fmt(p2.head, 4)}` : "—",
                    satuan: "m",
                  },
                  {
                    judul: x.rOut,
                    rumus: (<><span>Omax =</span><Frac num="2" den="3" /><span>· Cd · b · √(2g) · hmax^{fmt(1.5, 1)}</span></>),
                    isi: limpas ? "—" : `(2/3) · ${fmt(Cd, 3)} · ${fmt(b, 0)} · √(2 · ${fmt(G, 2)}) · ${fmt(r.maxHead, 4)}^${fmt(1.5, 1)}`,
                    hasil: sah(fmt(r.outflowPeak, 2)),
                    satuan: "m³/s",
                    tint: C.energy,
                  },
                  {
                    judul: x.rAtt,
                    rumus: (<><span>redam = 1 −</span><Frac num="Omax" den="Imax" /></>),
                    isi: limpas ? "—" : `1 − ${fmt(r.outflowPeak, 3)} / ${fmt(r.inflowPeak, 2)}`,
                    hasil: sah(fmt(r.attenuation * 100, 2)),
                    satuan: "%",
                  },
                  {
                    judul: x.rLag,
                    rumus: <span>tlag = t(Omax) − t(Imax)</span>,
                    isi: limpas ? "—" : `${fmt(p2.t, 3)} − ${fmt(tPeak, 3)}`,
                    hasil: sah(fmt(r.lag, 2)),
                    satuan: "h",
                  },
                  {
                    judul: x.rSmax,
                    rumus: <span>Smax = As · hmax</span>,
                    isi: limpas ? "—" : `${fmt(area, 0)} · ${fmt(r.maxHead, 4)}`,
                    hasil: sah(fmt(r.maxStorage / 1e6, 3)),
                    satuan: T.millionCubic,
                    tint: C.water,
                  },
                  {
                    judul: x.rFb,
                    rumus: <span>f′ = f − hmax</span>,
                    isi: `${fmt(fb, 1)} − ${fmt(r.maxHead, 3)}`,
                    hasil: fmt(sisaJagaan, 2),
                    satuan: "m",
                  },
                ]}
              />
            </div>
            <div className="mt-3 overflow-x-auto">
              <p className="stencil mb-1">{x.tabelPuls}</p>
              <table className="w-full text-right text-[0.8rem] tabular-nums">
                <thead className="text-ink-3">
                  <tr>
                    <th className="pr-2 font-normal">{x.kolT}</th>
                    <th className="pr-2 font-normal">{x.kolI}</th>
                    <th className="pr-2 font-normal">{x.kolO}</th>
                    <th className="pr-2 font-normal">{x.kolH}</th>
                    <th className="font-normal">{x.kolS}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.points.slice(Math.max(kP - 3, 0), kP + 4).map((q, i0) => {
                    const idx = Math.max(kP - 3, 0) + i0;
                    return (
                      <tr key={idx} className={idx === kP ? "font-semibold text-ink" : "text-ink-2"}>
                        <td className="pr-2">{fmt(q.t, 2)}</td>
                        <td className="pr-2">{fmt(q.inflow, 2)}</td>
                        <td className="pr-2">{limpas ? "—" : fmt(q.outflow, 2)}</td>
                        <td className="pr-2">{fmt(q.head, 3)}</td>
                        <td>{limpas ? "—" : fmt(q.storage / 1e6, 3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Block>

          {limpas ? (
            <StateCard
              tone="invalid"
              badge={x.limpas}
              state={x.limpasState}
              notice={[x.limpasNote]}
            />
          ) : (
            <StateCard
              tone="pass"
              badge={`${x.sedia} ${persen} %`}
              {...notice(r.attenuation, r.lag, r.maxStorage, masuk, area, b, fb, Cd, lang)}
            />
          )}
        </>
      }
      verification={<Verification checks={checksRouting(masuk, area, b, fb, Cd)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <Frac num="I₁ + I₂" den="2" />
                <span>−</span>
                <Frac num="O₁ + O₂" den="2" />
                <span>=</span>
                <Frac num="S₂ − S₁" den="Δt" />
              </Eq>
              <Eq>
                <span>O =</span>
                <Frac num="2" den="3" />
                <span>Cd b √(2g) h^1,5</span>
                <span className="ml-5">S = As h</span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "O₂ dan S₂ sama-sama fungsi h₂, jadi tiap langkah diselesaikan dengan Newton atas h₂; selang yang lebih panjang dari 0,5 K (K = As h / 1,5 O) dipecah menjadi sublangkah"
                    : "O₂ and S₂ are both functions of h₂, so each step is solved by Newton on h₂; intervals longer than 0.5 K (K = As h / 1.5 O) are split into substeps"}
                </span>
              </Eq>
            </>
          }
          note={`${x.note} ${x.kendaliNote}`}
          refs={[...REFS[lang]]}
        />
      }
    />
  );
}

/** Persen redam: satu desimal bila 99 ke atas, supaya tidak tertulis "100". */
function fmtPersen(v: number): string {
  return v >= 99 ? fmt(v, 1) : fmt(v, 0);
}

function notice(
  attenuation: number,
  lag: number,
  maxStorage: number,
  masuk: { t: number; Q: number }[],
  area: number,
  b: number,
  fb: number,
  Cd: number,
  lang: Lang
): { state: string; notice: string[] } {
  const lebar = reservoirRouting(masuk, area, b * 2, fb, Cd);
  const luas = reservoirRouting(masuk, area * 2, b, fb, Cd);
  const a = fmtPersen(attenuation * 100);
  const aLebar = fmtPersen(lebar.attenuation * 100);
  const aLuas = fmtPersen(luas.attenuation * 100);

  if (lang === "en")
    return {
      state: `The reservoir holds back ${a} per cent of the peak and delays it by ${fmt(lag, 1)} hours, using ${fmt(maxStorage / 1e6, 2)} million m³ of storage.`,
      notice: [
        `Double the spillway width and the attenuation falls to ${aLebar} per cent; double the surface area instead and it rises to ${aLuas} per cent.`,
        "The storage does the attenuating, not the spillway. The spillway is what lets water out, so making it larger makes the reservoir do less.",
      ],
    };
  return {
    state: `Waduk menahan ${a} persen puncak dan menundanya ${fmt(lag, 1)} jam, memakai ${fmt(maxStorage / 1e6, 2)} juta m³ tampungan.`,
    notice: [
      `Lipatduakan lebar pelimpahnya dan peredamannya turun ke ${aLebar} persen; lipatduakan luas genangannya dan peredamannya naik ke ${aLuas} persen.`,
      "Yang meredam tampungannya, bukan pelimpahnya. Pelimpah adalah jalan air keluar, jadi memperbesarnya justru membuat waduk bekerja lebih sedikit.",
    ],
  };
}
