"use client";

import { useRef, useState } from "react";
import { useCanvas } from "@/lib/useCanvas";
import {
  ambilSampel,
  histogram,
  momenHipergeometrik,
  type SampelUlang,
} from "@/lib/sampelUlang";
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
import { usePlate } from "@/lib/usePlate";
import { DragLayer, type HandleSpec } from "@/components/DragLayer";
import type { ParamDef } from "@/lib/rentang";
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import { RECAPTURE_MIN, fmt, fmtPlain, markRecapture } from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksMarkRecapture } from "@/lib/checks";

const TXT = {
  id: {
    title: "Tangkap-tandai-tangkap ulang",
    sheetTitle: "Taksiran populasi dari dua kali penangkapan",
    dM: "Ditandai pada penangkapan pertama",
    dN: "Ditangkap pada penangkapan kedua",
    dm: "Bertanda di dalam tangkapan kedua",
    pBaik: "Contoh memadai",
    pSedikit: "Tangkapan ulang sedikit",
    pKecil: "Kolam kecil, contoh besar",
    rChap: "Taksiran Chapman",
    rPet: "Taksiran Lincoln-Petersen",
    rCi: "Selang kepercayaan 95 persen",
    rLebar: "Lebar selang terhadap taksirannya",
    hdlM: "Titik taksiran: geser mendatar untuk mengubah jumlah bertanda m",
    rFrac: "Bagian populasi yang tertandai",
    rBias: "Selisih Petersen terhadap Chapman",
    sedikit: "Tangkapan ulang terlalu sedikit",
    mustahil: "Tangkapan bertanda melebihi yang mungkin",
    mustahilNote:
      "Banyaknya bertanda di dalam tangkapan kedua disetel melebihi banyaknya yang tertangkap pada penangkapan kedua, atau melebihi banyaknya yang ditandai pada penangkapan pertama. Keduanya tidak mungkin: yang bertanda adalah sebagian dari yang tertangkap, dan tidak ada ikan bertanda selain yang ditandai. Tidak ada taksiran yang dapat dihitung dari keadaan yang tidak dapat terjadi, jadi lembar ini tidak menghitungnya dan blok verifikasinya ditahan. Turunkan banyaknya yang bertanda, atau naikkan tangkapan kedua dan banyaknya yang ditandai.",
    cukup: "Tangkapan ulang memadai",
    bSedikit: "Terlalu sedikit",
    bLayak: "Layak",
    ekor: "ekor",
    hPet: "Taksiran Lincoln-Petersen",
    hChap: "Taksiran Chapman",
    hVar: "Ragam taksiran Chapman (Seber 1982)",
    hCi: "Selang kepercayaan 95 persen",
    hFrac: "Bagian populasi yang tertandai",
    takHingga: "tak terhingga, karena m = 0",
    pet0: "∞ (m = 0)",
    batasM: "Tangkapan ulang sudah sama dengan batasnya, min(M, n), jadi tidak dapat bertambah satu ekor lagi.",
    belajar:
      "Tangkapan ulang yang terlalu sedikit karena ikan belajar menghindari alat tangkap selalu membesarkan taksiran.",
    blkUlang: "Ambil sampel lagi",
    dNSim: "Populasi sebenarnya untuk simulasi",
    ulangBantu:
      "Tiap sampel mengulang penangkapan kedua: n ekor ditangkap acak dari N ekor yang M di antaranya bertanda. Banyaknya bertanda yang tertangkap mengisi m di lembar, dan kedua taksirannya masuk ke histogram.",
    ambil1: "Ambil sampel lagi",
    ambil100: "Ambil 100 sampel",
    hapus: "Kosongkan histogram",
    kosong: "Histogram masih kosong. Ambil sampel untuk mulai membangunnya.",
    nKurang: (N: string, batas: string) =>
      `Populasi sebenarnya ${N} ekor lebih kecil daripada ${batas} ekor yang ditandai atau ditangkap. Tidak ada penangkapan yang dapat ditarik; naikkan N.`,
    penuh: (k: string) => `Histogram sudah memuat ${k} sampel, batas lembar ini. Kosongkan untuk mulai lagi.`,
    benihTerakhir: (b: string, m: string) => `Sampel terakhir: benih ${b}, m = ${m}.`,
    benihRentang: (a: string, b: string) => `Benih ${a} sampai ${b}; benih yang sama selalu memberi tangkapan yang sama.`,
    dibuang: "Sampel lama dibuang karena N, M, atau n berubah.",
    sJumlah: "Banyaknya sampel",
    sMRerata: "Rerata m, teramati / teori nM/N",
    sMRagam: "Ragam m, teramati / teori hipergeometrik",
    sChap: "Rerata taksiran Chapman",
    sPet: "Rerata taksiran Lincoln-Petersen (m > 0)",
    sNol: "Sampel dengan m = 0 (Petersen tak terhingga)",
    sLuar: (k: string, lo: string, hi: string) =>
      `${k} taksiran di luar rentang histogram ${lo} sampai ${hi} tidak tergambar, tetapi tetap ikut dirata-rata.`,
    axEst: "Taksiran populasi N̂ (ekor)",
    axCount: "Banyaknya sampel",
    garisN: "N sebenarnya",
    histLabel: (k: string) => `Histogram taksiran dari ${k} sampel ulang`,
    sedikitNote:
      "Bertanda yang tertangkap ulang kurang dari tujuh ekor. Di bawah itu selang kepercayaannya melebar sampai taksirannya kehilangan arti praktis: batas atas dan batas bawah dapat terpaut berkali lipat. Angkanya tetap keluar, dan di situlah bahayanya, karena satu angka tunggal tampak lebih pasti daripada yang sebenarnya. Tambah usaha penangkapan kedua, atau tandai lebih banyak pada penangkapan pertama, sampai tangkapan ulangnya mencapai belasan.",
    note:
      "Gagasannya dapat dikatakan dalam satu kalimat: bila bagian yang tertandai pada tangkapan kedua sama dengan bagian yang tertandai pada seluruh populasi, maka jumlah populasinya dapat dihitung. Yang sulit bukan rumusnya melainkan syarat-syarat di baliknya, dan empat di antaranya jarang terpenuhi di sungai. Populasinya harus tertutup, tidak ada yang lahir, mati, masuk, atau keluar di antara kedua penangkapan. Tandanya tidak boleh lepas dan tidak boleh terlewat saat pemeriksaan. Ikan bertanda harus bercampur kembali secara merata sebelum penangkapan kedua. Dan yang paling sering dilanggar: peluang tertangkap harus sama bagi yang bertanda dan yang tidak, padahal ikan yang pernah tertangkap kerap belajar menghindari alat tangkap. Pelanggaran yang terakhir itu selalu membesarkan taksirannya, karena tangkapan ulang menjadi lebih sedikit daripada seharusnya. Taksiran Chapman dipakai di sini menggantikan Lincoln-Petersen karena ia tetap memberi angka terhingga bahkan ketika tidak ada satu pun yang tertangkap ulang.",
  },
  en: {
    title: "Mark-recapture",
    sheetTitle: "Population estimate from two capture events",
    dM: "Marked in the first capture",
    dN: "Caught in the second capture",
    dm: "Marked ones within the second catch",
    pBaik: "Adequate sample",
    pSedikit: "Few recaptures",
    pKecil: "Small pond, large sample",
    rChap: "Chapman estimate",
    rPet: "Lincoln-Petersen estimate",
    rCi: "95 per cent confidence interval",
    rLebar: "Interval width relative to the estimate",
    hdlM: "Estimate point: drag sideways to change the marked count m",
    rFrac: "Fraction of the population marked",
    rBias: "Petersen minus Chapman",
    sedikit: "Too few recaptures",
    mustahil: "Marked recaptures exceed what is possible",
    mustahilNote:
      "The number of marked individuals within the second catch is set above the size of that second catch, or above the number marked in the first capture. Neither can happen: the marked ones are a part of what was caught, and there are no marked fish besides those that were marked. No estimate can be computed from a state that cannot occur, so this sheet does not compute one and holds back the verification block. Lower the number marked, or raise the second catch and the number marked.",
    cukup: "Recaptures adequate",
    bSedikit: "Too few",
    bLayak: "Adequate",
    ekor: "individuals",
    hPet: "Lincoln-Petersen estimate",
    hChap: "Chapman estimate",
    hVar: "Variance of the Chapman estimate (Seber 1982)",
    hCi: "95 per cent confidence interval",
    hFrac: "Fraction of the population marked",
    takHingga: "infinite, because m = 0",
    pet0: "∞ (m = 0)",
    batasM: "The recaptures already equal their limit, min(M, n), so they cannot grow by one more.",
    belajar:
      "Too few recaptures because fish learn to avoid the gear always inflate the estimate.",
    blkUlang: "Sample again",
    dNSim: "True population for the simulation",
    ulangBantu:
      "Each sample repeats the second capture: n individuals are caught at random from N, of which M are marked. The marked count caught fills m on the sheet, and both estimates go into the histogram.",
    ambil1: "Sample again",
    ambil100: "Take 100 samples",
    hapus: "Clear histogram",
    kosong: "The histogram is empty. Take a sample to start building it.",
    nKurang: (N: string, batas: string) =>
      `The true population of ${N} is smaller than the ${batas} marked or caught. No capture can be drawn; raise N.`,
    penuh: (k: string) => `The histogram already holds ${k} samples, the limit on this sheet. Clear it to start again.`,
    benihTerakhir: (b: string, m: string) => `Last sample: seed ${b}, m = ${m}.`,
    benihRentang: (a: string, b: string) => `Seeds ${a} to ${b}; the same seed always gives the same catch.`,
    dibuang: "Earlier samples were discarded because N, M, or n changed.",
    sJumlah: "Number of samples",
    sMRerata: "Mean of m, observed / theory nM/N",
    sMRagam: "Variance of m, observed / hypergeometric theory",
    sChap: "Mean Chapman estimate",
    sPet: "Mean Lincoln-Petersen estimate (m > 0)",
    sNol: "Samples with m = 0 (Petersen infinite)",
    sLuar: (k: string, lo: string, hi: string) =>
      `${k} estimates outside the histogram range ${lo} to ${hi} are not drawn, but still count in the means.`,
    axEst: "Population estimate N̂ (individuals)",
    axCount: "Number of samples",
    garisN: "True N",
    histLabel: (k: string) => `Histogram of estimates from ${k} repeat samples`,
    sedikitNote:
      "Fewer than seven marked individuals were recaptured. Below that the confidence interval widens until the estimate loses practical meaning: upper and lower bounds can differ several times over. A number still appears, and that is the danger, because a single figure looks more certain than it is. Increase the second capture effort, or mark more in the first, until the recaptures reach the teens.",
    note:
      "The idea takes one sentence: if the marked fraction of the second catch equals the marked fraction of the whole population, the population size follows. What is hard is not the formula but the conditions behind it, and four of them are rarely met in a river. The population must be closed, with no births, deaths, arrivals, or departures between the two captures. Marks must not be shed and must not be missed on inspection. Marked fish must mix back evenly before the second capture. And the one most often violated: the chance of capture must be equal for marked and unmarked, although fish that have been caught once often learn to avoid the gear. That last violation always inflates the estimate, because recaptures come out fewer than they should. The Chapman estimate is used here in place of Lincoln-Petersen because it still returns a finite number even when nothing at all is recaptured.",
  },
} as const;

const REFS = {
  id: [
    "Seber, G.A.F. (1982). The Estimation of Animal Abundance and Related Parameters, edisi ke-2. Griffin.",
    "Chapman, D.G. (1951). Some properties of the hypergeometric distribution with applications to zoological censuses. University of California Publications in Statistics, vol. 1.",
    "Krebs, C.J. (1999). Ecological Methodology, edisi ke-2. Benjamin Cummings, Bab 2.",
    "Ricker, W.E. (1975). Computation and interpretation of biological statistics of fish populations. Fisheries Research Board of Canada Bulletin 191.",
  ],
  en: [
    "Seber, G.A.F. (1982). The Estimation of Animal Abundance and Related Parameters, 2nd ed. Griffin.",
    "Chapman, D.G. (1951). Some properties of the hypergeometric distribution with applications to zoological censuses. University of California Publications in Statistics, vol. 1.",
    "Krebs, C.J. (1999). Ecological Methodology, 2nd ed. Benjamin Cummings, Chapter 2.",
    "Ricker, W.E. (1975). Computation and interpretation of biological statistics of fish populations. Fisheries Research Board of Canada Bulletin 191.",
  ],
} as const;

/* Rentang m, dipakai bersama penggeser, kotak angka, dan pegangan titik
   taksiran (aturan 4: satu sumber nilai). Ujungnya = ujung M dan n (2000),
   karena "Ambil sampel" memasang m hasil undian sampai min(M, n). */
const P_M: ParamDef = { min: 0, max: 2000, step: 1, digits: 0 };

/** Populasi sebenarnya bawaan simulasi: dekat N̂ Chapman contoh bawaan (978). */
const N_SIM_AWAL = 1000;
/** Batas sampel di histogram, supaya lembar tetap ringan. */
const SAMPEL_MAKS = 5000;
const KELAS = 24;

/**
 * Rentang sumbu datar histogram, tetap selama N, M, n tetap (histogram
 * yang sedang dibangun tidak melompat). Dari m di rerata ± 4 simpangan
 * baku hipergeometrik: m besar memberi taksiran kecil, m kecil (tetapi
 * > 0) memberi Petersen terbesar. Yang di luar dihitung dan ditulis.
 */
function rentangHistogram(N: number, M: number, n: number): { lo: number; hi: number } {
  const { mean, variance } = momenHipergeometrik(N, M, n);
  const sd = Math.sqrt(variance);
  const mHi = Math.min(M, n, Math.ceil(mean + 4 * sd));
  const mLo = Math.max(1, Math.floor(mean - 4 * sd));
  const lo = Math.max(0, markRecapture(M, n, mHi).chapman);
  const hi = Math.max(markRecapture(M, n, mLo).petersen, N * 1.05, lo + 1);
  const langkah = Math.pow(10, Math.floor(Math.log10(Math.max(hi - lo, 1))) - 1);
  return { lo: Math.floor(lo / langkah) * langkah, hi: Math.ceil(hi / langkah) * langkah };
}

export function TangkapTandaiUlangClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [M, setM] = useState(200);
  const [n, setN] = useState(150);
  const [m, setM2] = useState(30);
  // Pemadam tanda contoh untuk pegangan seret (lihat SentuhContoh).
  const sentuh = useRef<() => void>(() => {});
  /*
   * Kedua sumbu dikunci selama pegangan diseret. Ujung sumbu m (3m) dan
   * ujung sumbu taksiran (dari N̂ dan selangnya pada m) ikut bergeser dengan
   * m: tanpa kunci, titik kerja selalu di sepertiga lebar dan tiap piksel
   * geseran mengubah skala yang dipakai membaca piksel berikutnya (saling
   * kejar). Dilepas = sumbu kembali dihitung dari m.
   */
  const [kunci, setKunci] = useState<{ mMax: number; yMax: number } | null>(null);

  /*
   * Ambil sampel lagi. Histogram berlaku untuk satu kombinasi N, M, n;
   * bila salah satunya berubah, sampel lama tidak dipakai lagi (ditulis)
   * dan benih mulai dari 1 lagi. Lembar tidak berubah saat dimuat: m baru
   * berganti ketika tombol ditekan.
   */
  const [NSim, setNSim] = useState(N_SIM_AWAL);
  const [ulang, setUlang] = useState<{ kunci: string; sampel: SampelUlang[] }>({
    kunci: "",
    sampel: [],
  });
  const kunciUlang = `${NSim}|${M}|${n}`;
  const basi = ulang.kunci !== kunciUlang && ulang.sampel.length > 0;
  const sampel = ulang.kunci === kunciUlang ? ulang.sampel : [];
  const NKurang = NSim < Math.max(M, n);
  const penuh = sampel.length >= SAMPEL_MAKS;
  const ambil = (k: number) => {
    if (NKurang || penuh) return;
    const mulai = sampel.length + 1;
    const akhir = Math.min(SAMPEL_MAKS, sampel.length + k);
    const baru: SampelUlang[] = [];
    for (let b = mulai; b <= akhir; b++) baru.push(ambilSampel(NSim, M, n, b));
    setUlang({ kunci: kunciUlang, sampel: [...sampel, ...baru] });
    setM2(baru[baru.length - 1].m);
    sentuh.current();
  };
  const terakhir = sampel.length ? sampel[sampel.length - 1] : null;
  const teori = momenHipergeometrik(NSim, M, n);
  const K = sampel.length;
  const rerataM = K ? sampel.reduce((a, s) => a + s.m, 0) / K : NaN;
  const ragamM =
    K > 1 ? sampel.reduce((a, s) => a + (s.m - rerataM) ** 2, 0) / (K - 1) : NaN;
  const rerataChap = K ? sampel.reduce((a, s) => a + s.chapman, 0) / K : NaN;
  const petHingga = sampel.filter((s) => Number.isFinite(s.petersen));
  const rerataPet = petHingga.length
    ? petHingga.reduce((a, s) => a + s.petersen, 0) / petHingga.length
    : NaN;
  const nolM = K - petHingga.length;
  const { lo: hLo, hi: hHi } = rentangHistogram(NSim, M, n);
  const hChap = histogram(sampel.map((s) => s.chapman), hLo, hHi, KELAS);
  const hPet = histogram(sampel.map((s) => s.petersen), hLo, hHi, KELAS);
  const luar = hChap.diAtas + hChap.diBawah + hPet.diAtas + hPet.diBawah;

  const histRef = useCanvas(
    (ctx, w, h) => {
      const tangga = (hg: typeof hChap) => {
        const pts: { x: number; y: number }[] = [{ x: hg.bins[0].x0, y: 0 }];
        for (const b of hg.bins) pts.push({ x: b.x0, y: b.count }, { x: b.x1, y: b.count });
        pts.push({ x: hg.bins[hg.bins.length - 1].x1, y: 0 });
        return pts;
      };
      const puncak = Math.max(1, ...hChap.bins.map((b) => b.count), ...hPet.bins.map((b) => b.count));
      drawChart(
        ctx,
        w,
        h,
        {
          xMin: hLo,
          xMax: hHi,
          yMin: 0,
          yMax: Math.max(4, Math.ceil(puncak * 1.2)),
          axisX: x.axEst,
          axisY: x.axCount,
          series: K
            ? [
                { pts: tangga(hChap), color: C.water, weight: W.thin, fill: C.waterFill },
                { pts: tangga(hPet), color: C.critical, weight: W.thin, dash: DASH.phantom },
              ]
            : [],
          rules: [
            { axis: "x", at: NSim, color: C.ink, weight: W.thin, dash: DASH.axis, label: `${x.garisN} ${fmtPlain(NSim, 0)}` },
          ],
          padRight: 18,
        },
        lang
      );
    },
    [sampel, NSim, hLo, hHi, lang]
  );

  /*
   * Tangkapan bertanda tidak mungkin melebihi tangkapan keduanya sendiri.
   *
   * Sebelumnya angkanya diam-diam dipotong ke n, dan akibatnya penggeser
   * menunjukkan dua ratus sementara kop menunjukkan lima, tanpa satu pun
   * tulisan yang menerangkan selisihnya. Pemotongan diam-diam pada masukan
   * yang mustahil selalu lebih buruk daripada penolakan yang bersuara:
   * pembaca yang tidak melihat keterangannya akan menyimpulkan lembarnya
   * salah hitung.
   */
  const r = markRecapture(M, n, m);
  /* Mustahil bila m > min(M, n): field model `impossible`. Angka lain tetap
     dihitung model, tetapi tidak ditampilkan; gambar memakai m terbesar
     yang mungkin supaya kurvanya tidak putus. */
  const mustahil = r.impossible;
  const mAman = Math.min(m, M, n);
  const rGambar = markRecapture(M, n, mAman);
  const lebar = r.chapman > 0 ? (r.ciHigh - r.ciLow) / r.chapman : 0;
  const tampil = (v: string) => (mustahil ? "—" : v);
  const nada: Tone = mustahil ? "invalid" : r.tooFewRecaptures ? "caution" : "pass";
  const badge = mustahil ? x.mustahil : r.tooFewRecaptures ? x.sedikit : x.cukup;
  const petTeks = Number.isFinite(r.petersen) ? fmt(r.petersen, 1) : x.pet0;

  /* Ujung sumbu, dihitung di luar penggambar supaya bisa dikunci.
     chap[0] lama = taksiran pada k = 1. */
  const mMaxBebas = Math.max(1, Math.min(n, M, Math.max(mAman * 3, 40)));
  const yMaxBebas = Math.max(
    Math.min(markRecapture(M, n, 1).chapman * 1.2, rGambar.chapman * 6),
    rGambar.ciHigh * 1.15,
    1
  );
  const mMax = kunci?.mMax ?? mMaxBebas;
  /* Ujung skala rezim m: 200 seperti dulu, melebar sampai m terbesar yang
     mungkin, min(M, n), supaya m hasil undian tidak jatuh "di luar skala". */
  const ujungSkalaM = Math.max(200, Math.min(M, n));
  const yMax = kunci?.yMax ?? yMaxBebas;

  const plate = usePlate(
    (ctx, w, h) => {
      const chap: { x: number; y: number }[] = [];
      const pet: { x: number; y: number }[] = [];
      const atas: { x: number; y: number }[] = [];
      const bawah: { x: number; y: number }[] = [];
      for (let k = 1; k <= mMax; k++) {
        const rk = markRecapture(M, n, k);
        chap.push({ x: k, y: rk.chapman });
        pet.push({ x: k, y: rk.petersen });
        atas.push({ x: k, y: rk.ciHigh });
        bawah.push({ x: k, y: rk.ciLow });
      }

      const deret: ChartSeries[] = [
        {
          pts: atas,
          color: C.ink3,
          weight: W.hair,
          dash: DASH.hidden,
          label: T.axPopulation,
          labelAt: 0.6,
          labelDy: -10,
        },
        { pts: bawah, color: C.ink3, weight: W.hair, dash: DASH.hidden },
        {
          pts: pet,
          color: C.critical,
          weight: W.thin,
          dash: DASH.phantom,
          label: "Petersen",
          labelAt: 0.35,
          labelDy: -11,
        },
        {
          pts: chap,
          color: !mustahil && mAman < RECAPTURE_MIN ? C.caution : C.water,
          weight: W.bold,
          dash: DASH.solid,
          label: "Chapman",
          labelAt: 0.75,
          labelDy: 14,
        },
      ];

      return drawChart(
        ctx,
        w,
        h,
        {
          xMin: 1,
          xMax: mMax,
          yMin: 0,
          yMax: yMax,
          axisX: T.axRecapture,
          axisY: T.axPopulation,
          series: deret,
          bands: [{ axis: "x", from: 1, to: RECAPTURE_MIN }],
          heading: mustahil ? x.mustahil : undefined,
          headingColor: C.signal,
          point: mustahil
            ? undefined
            : {
                x: mAman,
                y: r.chapman,
                label: `${fmtPlain(r.chapman, 0)}`,
              },
          /* Pegangan di m penggeser (bukan mAman) supaya pegangan = penggeser;
             pada keadaan mustahil m > min(M, n) di kanan ujung sumbu dan
             DragLayer menjepitnya ke tepi. Tegaknya kurva Chapman yang
             digambar. Tidak dari `point`: titik itu hilang di luar bidang. */
          anchors: { kerja: { x: m, y: rGambar.chapman } },
        },
        lang
      );
    },
    null,
    [M, n, m, mMax, yMax, lang]
  );

  /*
   * Posisi tegak titik adalah N̂ HASIL Chapman, jadi titik hanya diseret
   * mendatar: sumbu datar adalah m, masukan langsung.
   */
  const handles: HandleSpec[] = [
    {
      id: "kerja",
      anchor: "kerja",
      axis: "x",
      label: x.hdlM,
      hollow: true,
      param: P_M,
      value: m,
      toValue: (px, _py, mp) => mp.invX(px),
      onChange: setM2,
      format: (v) => `m ${fmt(v, 0)}`,
    },
  ];
  const lepasKunci = () => setKunci(null);

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="m"
          value={mustahil ? NaN : m}
          invalid={mustahil}
          pesan={mustahil ? x.mustahil : undefined}
          digits={0}
          bands={
            mustahil
              ? [{ from: 0, to: ujungSkalaM, label: x.mustahil, tone: "invalid" }]
              : [
                  { from: 0, to: RECAPTURE_MIN - 1e-9, label: x.bSedikit, tone: "caution" },
                  { from: RECAPTURE_MIN, to: ujungSkalaM, label: x.bLayak, tone: "pass" },
                ]
          }
        />
      }
      sheet="EK-03"
      subject={SUBJECTS.EK[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Bila bagian yang <Term tint={C.water}>bertanda</Term> pada
            tangkapan kedua sama dengan bagian bertanda pada seluruh populasi,
            jumlahnya dapat dihitung. Yang sulit bukan rumusnya melainkan{" "}
            <Term tint={C.ink}>syarat di baliknya</Term>.
          </p>
        ) : (
          <p>
            If the <Term tint={C.water}>marked</Term> fraction of the second
            catch equals the marked fraction of the whole population, the size
            follows. What is hard is not the formula but the{" "}
            <Term tint={C.ink}>conditions behind it</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="EK-03"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: lang === "id" ? "ekor" : "individuals" },
            { label: "M", value: fmt(M, 0) },
            { label: "n", value: fmt(n, 0) },
            { label: "m", value: mustahil ? "—" : fmt(m, 0), tint: mustahil ? C.signal : r.tooFewRecaptures ? C.caution : undefined },
            { label: "N̂", value: mustahil ? "—" : fmt(r.chapman, 0), tint: mustahil ? C.signal : C.water },
          ]}
        >
          <canvas ref={plate.ref} className="block h-full w-full" />
          {/* display: contents, jadi pembungkus tidak membuat kotak; hanya
              menangkap pointerdown/lepas yang menggelembung dari pegangan
              untuk mengunci sumbu. */}
          <div
            className="contents"
            onPointerDown={(e) => {
              // Hanya tombol utama (lihat AturanPanenClient).
              if (e.pointerType === "mouse" && e.button !== 0) return;
              setKunci({ mMax, yMax });
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
            <SentuhContoh sentuh={sentuh} />
            <InputTable>
              <InputRow symbol="M" label={x.dM} value={M} min={5} max={2000} step={5} digits={0} onChange={setM} tint={C.water} />
              <InputRow symbol="n" label={x.dN} value={n} min={5} max={2000} step={5} digits={0} onChange={setN} />
              <InputRow symbol="m" label={x.dm} value={m} {...P_M} onChange={setM2} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pBaik, apply: () => { setM(200); setN(150); setM2(30); } },
                  { label: x.pSedikit, apply: () => { setM(200); setN(150); setM2(3); } },
                  { label: x.pKecil, apply: () => { setM(80); setN(120); setM2(48); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={x.blkUlang}>
            <p className="mb-2 text-[0.86rem] leading-[1.5] text-ink-2">{x.ulangBantu}</p>
            <InputTable>
              <InputRow symbol="N" label={x.dNSim} value={NSim} min={5} max={20000} step={5} digits={0} unit={x.ekor} onChange={setNSim} />
            </InputTable>
            {NKurang && (
              <p role="alert" className="mt-2 text-[0.86rem] leading-[1.5] text-signal">
                {x.nKurang(fmt(NSim, 0), fmt(Math.max(M, n), 0))}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <button
                type="button"
                onClick={() => ambil(1)}
                disabled={NKurang || penuh}
                className="h-11 border border-ink px-3 text-[0.86rem] font-semibold text-ink outline-none transition-colors hover:bg-paper-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-water disabled:border-rule-strong disabled:text-ink-3 disabled:hover:bg-transparent"
              >
                {x.ambil1}
              </button>
              <button
                type="button"
                onClick={() => ambil(100)}
                disabled={NKurang || penuh}
                className="label h-11 border-b border-rule-strong text-[0.8rem] text-ink-2 outline-none transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-water disabled:text-ink-3"
              >
                {x.ambil100}
              </button>
              {K > 0 && (
                <button
                  type="button"
                  onClick={() => setUlang({ kunci: "", sampel: [] })}
                  className="label h-11 border-b border-rule-strong text-[0.8rem] text-ink-2 outline-none transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-water"
                >
                  {x.hapus}
                </button>
              )}
            </div>
            <div aria-live="polite" className="mt-1 text-[0.82rem] leading-[1.5] text-ink-2">
              {terakhir && <p>{x.benihTerakhir(fmtPlain(terakhir.benih, 0), fmtPlain(terakhir.m, 0))}</p>}
              {K > 1 && <p className="text-ink-3">{x.benihRentang("1", fmtPlain(K, 0))}</p>}
              {penuh && <p>{x.penuh(fmtPlain(SAMPEL_MAKS, 0))}</p>}
              {basi && <p className="text-ink-3">{x.dibuang}</p>}
            </div>
            <div className="mt-2 border border-rule bg-sheet" style={{ height: 230 }}>
              <canvas
                ref={histRef}
                role="img"
                aria-label={x.histLabel(fmtPlain(K, 0))}
                className="block h-full w-full"
              />
            </div>
            {/* Legenda di DOM, bukan di dalam bidang: kotak legenda menimpa
                label garis N sebenarnya pada kanvas sempit kolom samping. */}
            {K > 0 && (
              <p className="mt-1 flex flex-wrap gap-x-4 text-[0.78rem] text-ink-2" aria-hidden="true">
                <span className="flex items-center gap-1.5">
                  <svg width="22" height="8" viewBox="0 0 22 8"><line x1="1" y1="4" x2="21" y2="4" stroke={C.water} strokeWidth={W.thin} /></svg>
                  Chapman
                </span>
                <span className="flex items-center gap-1.5">
                  <svg width="22" height="8" viewBox="0 0 22 8"><line x1="1" y1="4" x2="21" y2="4" stroke={C.critical} strokeWidth={W.thin} strokeDasharray={DASH.phantom.join(" ")} /></svg>
                  Lincoln-Petersen
                </span>
              </p>
            )}
            {K === 0 ? (
              <p className="mt-2 text-[0.82rem] text-ink-3">{x.kosong}</p>
            ) : (
              <div className="mt-2">
                <ResultTable
                  rows={[
                    { symbol: "k", label: x.sJumlah, value: fmt(K, 0) },
                    { symbol: "⟨m⟩", label: x.sMRerata, value: `${fmt(rerataM, 2)} / ${fmt(teori.mean, 2)}` },
                    { symbol: "s²", label: x.sMRagam, value: K > 1 ? `${fmt(ragamM, 2)} / ${fmt(teori.variance, 2)}` : "—" },
                    { symbol: "N̂", label: x.sChap, value: fmt(rerataChap, 1), unit: x.ekor, tint: C.water },
                    { symbol: "N̂p", label: x.sPet, value: petHingga.length ? fmt(rerataPet, 1) : "—", unit: petHingga.length ? x.ekor : undefined, tint: C.critical },
                    ...(nolM > 0 ? [{ symbol: "—", label: x.sNol, value: fmt(nolM, 0) }] : []),
                  ]}
                />
                {luar > 0 && (
                  <p className="mt-2 text-[0.82rem] leading-[1.5] text-ink-2">
                    {x.sLuar(fmt(luar, 0), fmt(hLo, 0), fmt(hHi, 0))}
                  </p>
                )}
              </div>
            )}
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                /* Pada keadaan mustahil tidak satu pun taksiran ditampilkan.
                   Taksiran yang dihitung dari keadaan yang tidak dapat
                   terjadi bukan taksiran yang longgar melainkan taksiran
                   yang tidak punya arti. */
                { symbol: "N̂", label: x.rChap, value: mustahil ? "—" : fmt(r.chapman, 1), tint: mustahil ? C.signal : C.water, strong: true },
                { symbol: "—", label: x.rCi, value: mustahil ? "—" : `${fmt(r.ciLow, 0)} – ${fmt(r.ciHigh, 0)}`, tint: mustahil ? C.signal : r.tooFewRecaptures ? C.caution : undefined, strong: true },
                { symbol: "N̂p", label: x.rPet, value: tampil(petTeks), tint: mustahil ? C.signal : C.critical },
                { symbol: "—", label: x.rBias, value: mustahil ? "—" : Number.isFinite(r.petersen) ? fmt(r.petersen - r.chapman, 1) : "∞" },
                { symbol: "—", label: x.rLebar, value: mustahil ? "—" : fmt(lebar * 100, 1), unit: mustahil ? undefined : "%" },
                { symbol: "M/N̂", label: x.rFrac, value: mustahil ? "—" : fmt(r.markedFraction * 100, 2), unit: mustahil ? undefined : "%" },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hPet,
                    rumus: (<><span>N̂p =</span><Frac num="M · n" den="m" /></>),
                    isi: mustahil ? "—" : m > 0 ? `${fmt(M, 0)} · ${fmt(n, 0)} / ${fmt(m, 0)}` : `${fmt(M, 0)} · ${fmt(n, 0)} / 0 : ${x.takHingga}`,
                    hasil: tampil(Number.isFinite(r.petersen) ? fmt(r.petersen, 1) : "∞"),
                    satuan: mustahil ? undefined : x.ekor,
                    tint: C.critical,
                  },
                  {
                    judul: x.hChap,
                    rumus: (<><span>N̂ =</span><Frac num="( M + 1 ) · ( n + 1 )" den="m + 1" /><span>− 1</span></>),
                    isi: mustahil ? "—" : `( ${fmt(M, 0)} + 1 ) · ( ${fmt(n, 0)} + 1 ) / ( ${fmt(m, 0)} + 1 ) − 1`,
                    hasil: tampil(fmt(r.chapman, 1)),
                    satuan: mustahil ? undefined : x.ekor,
                    tint: C.water,
                  },
                  {
                    judul: x.hVar,
                    rumus: (<><span>Var =</span><Frac num="( M + 1 ) ( n + 1 ) ( M − m ) ( n − m )" den="( m + 1 )² ( m + 2 )" /></>),
                    isi: mustahil
                      ? "—"
                      : `( ${fmt(M, 0)} + 1 ) ( ${fmt(n, 0)} + 1 ) ( ${fmt(M, 0)} − ${fmt(m, 0)} ) ( ${fmt(n, 0)} − ${fmt(m, 0)} ) / ( ( ${fmt(m, 0)} + 1 )² ( ${fmt(m, 0)} + 2 ) )`,
                    hasil: tampil(fmt(r.variance, 1)),
                  },
                  {
                    judul: x.hCi,
                    rumus: <span>N̂ ± {fmt(1.96, 2)} · √Var</span>,
                    isi: mustahil
                      ? "—"
                      : `${fmt(r.chapman, 1)} ± ${fmt(1.96, 2)} · ${fmt(Math.sqrt(Math.max(r.variance, 0)), 2)}${r.chapman - 1.96 * Math.sqrt(Math.max(r.variance, 0)) < 0 ? (lang === "id" ? "  (batas bawah negatif, dipotong ke 0)" : "  (negative lower bound, cut to 0)") : ""}`,
                    hasil: tampil(`${fmt(r.ciLow, 0)} – ${fmt(r.ciHigh, 0)}`),
                    satuan: mustahil ? undefined : x.ekor,
                  },
                  {
                    judul: x.hFrac,
                    rumus: (<><Frac num="M" den="N̂" /></>),
                    isi: mustahil ? "—" : `${fmt(M, 0)} / ${fmt(r.chapman, 1)}`,
                    hasil: tampil(fmt(r.markedFraction * 100, 2)),
                    satuan: mustahil ? undefined : "%",
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={nada}
            badge={badge}
            {...notice(M, n, m, r, lebar, lang)}
          />
        </>
      }
      verification={mustahil ? undefined : <Verification checks={checksMarkRecapture(M, n, m)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <Frac num="m" den="n" />
                <span>=</span>
                <Frac num="M" den="N" />
                <span className="ml-5">N̂p =</span>
                <Frac num="M n" den="m" />
                <span className="ml-3 text-ink-3">
                  {lang === "id" ? "Lincoln-Petersen" : "Lincoln-Petersen"}
                </span>
              </Eq>
              <Eq>
                <span>N̂ =</span>
                <Frac num="(M+1)(n+1)" den="m+1" />
                <span>− 1</span>
                <span className="ml-3 text-ink-3">
                  {lang === "id"
                    ? "Chapman, tetap terhingga pada m nol"
                    : "Chapman, finite even at m of zero"}
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
  M: number,
  n: number,
  m: number,
  r: ReturnType<typeof markRecapture>,
  lebar: number,
  lang: Lang
): { state: string; notice: string[] } {
  const x = TXT[lang];
  const en = lang === "en";

  /* Keadaan mustahil hanya mengulang alasannya; tidak ada angka taksiran
     dari keadaan yang tidak dapat terjadi. */
  if (r.impossible) return { state: x.mustahilNote, notice: [] };

  const state = en
    ? `N̂ = ${fmt(r.chapman, 0)} individuals (95 % interval ${fmt(r.ciLow, 0)} – ${fmt(r.ciHigh, 0)}); ${r.tooFewRecaptures ? "too few" : "enough"} recaptures.`
    : `N̂ = ${fmt(r.chapman, 0)} ekor (selang 95 % ${fmt(r.ciLow, 0)} – ${fmt(r.ciHigh, 0)}); tangkapan ulang ${r.tooFewRecaptures ? "terlalu sedikit" : "cukup"}.`;

  const butir: string[] = [];
  if (r.tooFewRecaptures) butir.push(x.sedikitNote);

  if (m + 1 > Math.min(M, n)) {
    butir.push(x.batasM);
  } else {
    const lebihSatu = markRecapture(M, n, m + 1);
    const bedaSatu = Math.abs(lebihSatu.chapman - r.chapman);
    const persen = fmt((bedaSatu / Math.max(r.chapman, 1e-9)) * 100, 1);
    butir.push(
      en
        ? `One more recapture, ${fmtPlain(m + 1, 0)} instead of ${fmtPlain(m, 0)}, would change the estimate by ${fmt(bedaSatu, 0)} individuals, ${persen} per cent of the answer.`
        : `Satu ekor tangkapan ulang lagi, ${fmtPlain(m + 1, 0)} dan bukan ${fmtPlain(m, 0)}, akan mengubah taksirannya sebesar ${fmt(bedaSatu, 0)} ekor, ${persen} persen dari jawabannya.`
    );
  }
  butir.push(
    en
      ? `The confidence interval spans ${fmt(lebar * 100, 0)} per cent of the estimate. Raise the recaptures and that span closes; at m = 0 Petersen is infinite while Chapman stays finite.`
      : `Selang kepercayaannya selebar ${fmt(lebar * 100, 0)} persen dari taksirannya. Perbanyak tangkapan ulangnya dan selang itu merapat; pada m = 0 Petersen tak terhingga sementara Chapman tetap terhingga.`
  );

  /* Batas bawah selang normal dijepit model ke 0 dan bisa di bawah ekor
     berbeda yang sudah teramati, M + n − m. Pemotongan dan kekurangan itu
     ditulis, bukan disembunyikan (model butir 6 belum diperbaiki). */
  const teramati = M + n - m;
  if (r.ciLow < teramati)
    butir.push(
      en
        ? `The lower bound ${fmt(r.ciLow, 0)} is below the ${fmt(teramati, 0)} different individuals already seen (M + n − m)${r.ciLow === 0 ? ", and the model cut it to 0" : ""}. The normal interval does not hold at small m; Krebs (1999) recommends a Poisson interval there.`
        : `Batas bawah ${fmt(r.ciLow, 0)} lebih kecil daripada ${fmt(teramati, 0)} ekor berbeda yang sudah teramati (M + n − m)${r.ciLow === 0 ? ", dan model memotongnya ke 0" : ""}. Selang normal tidak berlaku pada m kecil; Krebs (1999) menganjurkan selang Poisson di situ.`
    );
  butir.push(x.belajar);
  return { state, notice: butir };
}
