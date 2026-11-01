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
  SentuhContoh,
  Sheet,
  StateCard,
  Term,
} from "@/components/ui";
import { usePlate, usePutar } from "@/lib/usePlate";
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import { drawTimeCursor, offsetMap } from "@/lib/drawBasin";
import {
  drawTrophicPyramid,
  drawTrophicState,
  readCascade,
  type TrophicLayout,
} from "@/lib/drawTrophic";
import { trophicCascade, type ParamRantai } from "@/lib/rantaiTrofik";
import type { PlateMap, PlateOut } from "@/lib/plateOut";
import { DragLayer, type HandleSpec } from "@/components/DragLayer";
import type { ParamDef } from "@/lib/rentang";
import {
  TROPHIC_MIN_ENERGY,
  fmt,
  fmtPlain,
  fmtSci,
  trophicPyramid,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksTrophic } from "@/lib/checks";

const TXT = {
  id: {
    title: "Tingkat trofik",
    sheetTitle: "Piramida energi rantai makanan sungai",
    dP: "Produksi primer bersih",
    dE: "Efisiensi peralihan antar tingkat",
    dN: "Banyaknya tingkat yang dilihat",
    pJernih: "Sungai jernih berbatu",
    pSubur: "Sungai subur dataran",
    pWaduk: "Waduk dalam, cahaya terbatas",
    rTop: "Energi di tingkat teratas",
    rFrac: "Bagian produksi yang sampai ke puncak",
    rSupported: "Tingkat yang masih tertopang",
    rBio: "Biomassa tegakan di tingkat teratas",
    rLoss: "Energi yang hilang tiap selang",
    melampaui: "Tingkat yang diminta tidak tertopang",
    tertopang: "Semua tingkat tertopang",
    satE: "kJ/m²·th",
    axE: "aliran energi, kJ/m²·th",
    bTak: "Tak tertopang",
    bYa: "Tertopang",
    dK: "Daya dukung produsen K (model dinamis)",
    dF: "Pengali gangguan",
    dT: "Kursor waktu, tahun ke-",
    gT: "Kursor waktu t, seret garis waktu di grafik ke kiri atau kanan",
    blkGanggu: "Ganggu satu tingkat",
    gangguTingkat: "Ganggu tingkat",
    jenisDenyut: "Denyut (sekali)",
    jenisTekan: "Tekan (menetap)",
    jenisLabel: "Jenis",
    namaTingkat: ["T1 produsen", "T2 herbivora", "T3 karnivora", "T{i} karnivora"],
    tidakE: "kerangka putus-putus: energi di bawah 1 kJ/m²·th",
    tidakD: "tanpa isian: tidak tertopang di model dinamis",
    diganggu: "diganggu",
    axRasio: "biomassa / keseimbangan",
    axTahun: "waktu, tahun",
    rLagT: "Tundaan tanggapan tiap tingkat",
    rEqT: "Biomassa keseimbangan (dinamis)",
    rPersist: "Tingkat tertopang di model dinamis",
    hEq: "Keseimbangan rantai dinamis",
    hLag: "Tundaan tanggapan (10 % simpangan terbesar)",
    motionNote:
      "Waktu dipercepat: satu detik layar = 4 tahun. Gangguan terjadi pada tahun ke-2. Kerangka merah bata = aliran energi (model piramida); isian kelabu = biomassa model rantai dinamis dibagi keseimbangannya; bulatan berisi = tingkat itu sudah menanggapi.",
    dinamisNote:
      "Model dinamis adalah rantai Lotka–Volterra linear dengan produsen tumbuh logistik (Oksanen dkk. 1981; Carpenter dkk. 1985). Laju makan dan kematian tiap tingkat angka tetap lembar ini, bukan dari sumber, jadi tundaan dan besar simpangannya gambaran pola, bukan ramalan lapangan. Efisiensi ε yang sama dipakai kedua model.",
    hE: "Energi tiap tingkat",
    hEn: "Energi di tingkat teratas",
    hFrac: "Bagian yang sampai ke puncak",
    hSup: "Tingkat dengan E sedikitnya 1 kJ/m²·th",
    hB: "Biomassa di tingkat teratas",
    faktor16:
      "Faktor 1,6 per tingkat pada biomassa adalah angka lembar ini, belum bersumber; biomassa ditampilkan sebagai gambaran, bukan acuan.",
    melampauiNote:
      "Aliran energi di tingkat teratas turun di bawah satu kilojoule per meter persegi per tahun, dan di bawah itu tidak ada populasi yang dapat bertahan pada luas yang wajar. Tingkat yang digambar tetap ada dalam hitungan, tetapi ia tidak ada di sungainya. Inilah sebabnya rantai makanan sungai jarang melebihi empat tingkat, dan mengapa pemangsa puncak seperti sidat besar atau burung pemakan ikan menuntut daerah jelajah yang luas: mereka harus memanen produksi dasar dari berhektar-hektar sungai untuk menopang satu ekor.",
    note:
      "Piramida ini menghubungkan ekologi dengan hidraulika lewat satu jalur yang sering tidak terlihat. Banyaknya tingkat yang dapat ditopang sebuah sungai ditentukan oleh produksi dasarnya, dan produksi dasar ditentukan oleh cahaya yang menembus air, hara yang terbawa, serta waktu tinggal air yang menentukan berapa lama keduanya dapat dipakai. Membendung sungai mengubah ketiganya sekaligus: kedalaman bertambah sehingga cahaya berkurang di dasar, kecepatan turun sehingga hara mengendap, dan waktu tinggal memanjang sehingga ganggang sempat tumbuh di permukaan tetapi tidak di dasar. Akibatnya bukan sekadar berkurangnya jumlah ikan melainkan berubahnya susunan rantai makanannya. Perhatikan juga piramida biomassa yang digambar berdampingan: pada lembar ini ia ikut menciut, tetapi lebih lambat daripada piramida energinya, karena hewan bertingkat tinggi berumur lebih panjang sehingga biomassanya menumpuk lebih lama untuk aliran energi yang sama.",
  },
  en: {
    title: "Trophic levels",
    sheetTitle: "Energy pyramid of a river food chain",
    dP: "Net primary production",
    dE: "Transfer efficiency between levels",
    dN: "Number of levels shown",
    pJernih: "Clear stony river",
    pSubur: "Fertile lowland river",
    pWaduk: "Deep reservoir, limited light",
    rTop: "Energy at the top level",
    rFrac: "Fraction of production reaching the top",
    rSupported: "Levels still supported",
    rBio: "Standing biomass at the top level",
    rLoss: "Energy lost at each step",
    melampaui: "The requested level is not supported",
    tertopang: "All levels supported",
    satE: "kJ/m²·y",
    axE: "energy flow, kJ/m²·y",
    bTak: "Not supported",
    bYa: "Supported",
    dK: "Producer carrying capacity K (dynamic model)",
    dF: "Disturbance factor",
    dT: "Time cursor, year",
    gT: "Time cursor t, drag the time line on the chart left or right",
    blkGanggu: "Disturb one level",
    gangguTingkat: "Disturb level",
    jenisDenyut: "Pulse (once)",
    jenisTekan: "Press (sustained)",
    jenisLabel: "Kind",
    namaTingkat: ["T1 producers", "T2 herbivores", "T3 carnivores", "T{i} carnivores"],
    tidakE: "dashed outline: energy below 1 kJ/m²·y",
    tidakD: "no fill: not supported in the dynamic model",
    diganggu: "disturbed",
    axRasio: "biomass / equilibrium",
    axTahun: "time, years",
    rLagT: "Response lag of each level",
    rEqT: "Equilibrium biomass (dynamic)",
    rPersist: "Levels supported in the dynamic model",
    hEq: "Equilibrium of the dynamic chain",
    hLag: "Response lag (10 % of the largest deviation)",
    motionNote:
      "Time is sped up: one screen second = 4 years. The disturbance happens in year 2. Brick-red outline = energy flow (pyramid model); grey fill = dynamic chain biomass divided by its equilibrium; filled dot = that level has responded.",
    dinamisNote:
      "The dynamic model is a linear Lotka–Volterra chain with logistic producers (Oksanen et al. 1981; Carpenter et al. 1985). The feeding and mortality rates of each level are this sheet's fixed figures, not from a source, so the lags and the size of the swings show the pattern, not a field forecast. The same efficiency ε is used by both models.",
    hE: "Energy at each level",
    hEn: "Energy at the top level",
    hFrac: "Fraction reaching the top",
    hSup: "Levels with E of at least 1 kJ/m²·y",
    hB: "Biomass at the top level",
    faktor16:
      "The factor of 1.6 per level in the biomass is this sheet's own figure and has no source yet; biomass is shown as an illustration, not a reference.",
    melampauiNote:
      "The energy flow at the top level falls below one kilojoule per square metre per year, and below that no population can persist over any reasonable area. The level drawn still exists in the arithmetic, but it does not exist in the river. This is why river food chains rarely exceed four levels, and why top predators such as large eels or fish-eating birds demand wide ranges: they must harvest the base production of hectares of river to support a single individual.",
    note:
      "This pyramid links ecology to hydraulics along a path that is often invisible. The number of levels a river can support is set by its base production, and base production is set by the light reaching through the water, the nutrients carried past, and the residence time that decides how long both can be used. Damming a river changes all three at once: depth increases so light dims at the bed, velocity falls so nutrients settle, and residence time lengthens so algae grow at the surface but not on the bottom. The consequence is not merely fewer fish but a different arrangement of the food chain. Note also the biomass pyramid drawn alongside: on this sheet it narrows too, but more slowly than the energy pyramid, because higher-level animals live longer, so their biomass accumulates for longer at the same energy flow.",
  },
} as const;

const REFS = {
  id: [
    "Lindeman, R.L. (1942). The trophic-dynamic aspect of ecology. Ecology, vol. 23.",
    "Pauly, D. & Christensen, V. (1995). Primary production required to sustain global fisheries. Nature, vol. 374.",
    "Allan, J.D. & Castillo, M.M. (2007). Stream Ecology, edisi ke-2. Springer, Bab 12.",
    "Vannote, R.L. et al. (1980). The river continuum concept. Canadian Journal of Fisheries and Aquatic Sciences, vol. 37.",
  ],
  en: [
    "Lindeman, R.L. (1942). The trophic-dynamic aspect of ecology. Ecology, vol. 23.",
    "Pauly, D. & Christensen, V. (1995). Primary production required to sustain global fisheries. Nature, vol. 374.",
    "Allan, J.D. & Castillo, M.M. (2007). Stream Ecology, 2nd ed. Springer, Chapter 12.",
    "Vannote, R.L. et al. (1980). The river continuum concept. Canadian Journal of Fisheries and Aquatic Sciences, vol. 37.",
  ],
} as const;

/** Lama simulasi dan saat gangguan, tahun */
const TAHUN = 60;
const T_GANGGU = 2;
/** Kursor waktu: satu definisi untuk penggeser dan pegangan di grafik */
const P_TAHUN: ParamDef = { min: 0, max: TAHUN, step: 0.5, digits: 1 };
/**
 * Laju makan a_i (per biomassa·tahun) dan kematian m_i (per tahun) model
 * dinamis. Angka lembar ini, bukan dari sumber (lihat catatan). Empat yang
 * pertama sama dengan uji rantaiTrofik.test.ts (hitungan tangan).
 */
const GRAZING = [0.01, 0.05, 0.1, 0.2, 0.4, 0.8];
const MORTALITY = [0, 0.5, 0.2, 0.1, 0.05, 0.025, 0.0125];

export function TingkatTrofikClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [P, setP] = useState(2000);
  const [eff, setEff] = useState(0.1);
  const [n, setN] = useState(4);

  const r = trophicPyramid(P, eff, n);
  const atas = r.levels[r.levels.length - 1];
  const nada: Tone = r.overreach ? "caution" : "pass";
  /* Angka energi yang kecil ditulis berpangkat sepuluh, sama di tabel dan
     Hitungan. */
  const fmtE = (v: number) => (v > 0 && v < 1e-2 ? fmtSci(v) : fmt(v, 3));

  /* Dipakai pada gambar dan kop: yang kecil ditulis berpangkat sepuluh. */
  const fmtEnergi = (v: number) =>
    v > 0 && v < 1e-2 ? fmtSci(v) : fmtPlain(v, 2);

  /* ---------------- model rantai dinamis (M9) ----------------
     Gangguan satu tingkat pada tahun ke-2; deret 60 tahun dihitung sekali
     per perubahan masukan (bukan per bingkai). */
  const [K, setK] = useState(5000);
  const [tingkat, setTingkat] = useState(4);
  const [faktor, setFaktor] = useState(0.5);
  const [jenis, setJenis] = useState<"denyut" | "tekan">("denyut");
  const [kursor, setKursor] = useState(12);
  const lv = Math.min(tingkat, n);
  const param: ParamRantai = useMemo(
    () => ({
      production: K,
      growth: 1,
      efficiency: eff,
      grazing: GRAZING.slice(0, Math.max(n - 1, 0)),
      mortality: MORTALITY.slice(0, n),
    }),
    [K, eff, n]
  );
  const kas = useMemo(
    () => trophicCascade(n, param, { level: lv, factor: faktor, at: T_GANGGU, jenis }, TAHUN),
    [n, param, lv, faktor, jenis]
  );
  const rasioMaks = useMemo(() => {
    let m = 1;
    for (const row of kas.biomass)
      for (let i = 0; i < n; i++) if (kas.equilibrium[i] > 0) m = Math.max(m, row[i] / kas.equilibrium[i]);
    return m;
  }, [kas, n]);

  const { playing, toggle: togglePutar } = usePutar();
  const bergerak = playing;
  const sentuh = useRef<() => void>(() => {});
  const tataRef = useRef<TrophicLayout | null>(null);
  const petaGrafik = useRef<PlateMap | null>(null);
  const mulai = useRef<{ tt: number | null; t: number; kini: number }>({ tt: null, t: 12, kini: 12 });
  const bufN = useRef(new Float64Array(7));
  const bufSudah = useRef(new Uint8Array(7));
  const titik = useRef<[number, string][]>([]);
  /** Tahun model per detik layar */
  const LAJU = 4;

  const labelPiramida = {
    names: [...x.namaTingkat],
    unsupportedEnergy: x.tidakE,
    unsupportedDynamic: x.tidakD,
    energyUnit: x.satE,
    disturbed: `${x.diganggu} ×${fmtPlain(faktor, 2)}`,
  };
  const WARNA = [C.ink, C.ink2, C.ink3, C.ink, C.ink2, C.ink3, C.ink];
  const GARIS = [DASH.solid, DASH.solid, DASH.solid, DASH.hidden, DASH.hidden, DASH.hidden, DASH.axis];

  /** Isi buffer keadaan pada tahun t: biomassa dan tanda sudah menanggapi. */
  const keadaanPada = (t: number) => {
    const N = bufN.current.subarray(0, n);
    readCascade(kas.t, kas.biomass, t, N);
    const sudah = bufSudah.current;
    for (let i = 0; i < n; i++)
      sudah[i] = kas.equilibrium[i] > 0 && t >= T_GANGGU && (i + 1 === lv || (kas.responseSign[i] !== 0 && t - T_GANGGU >= kas.responseLag[i])) ? 1 : 0;
    return N;
  };
  const isiTitik = (N: Float64Array) => {
    const d = titik.current;
    let k = 0;
    for (let i = 0; i < n; i++) {
      if (!(kas.equilibrium[i] > 0)) continue;
      if (!d[k]) d[k] = [0, C.ink];
      d[k][0] = N[i] / kas.equilibrium[i];
      d[k][1] = WARNA[i];
      k++;
    }
    d.length = k;
  };

  const grafik = (ctx: CanvasRenderingContext2D, w: number, ch: number): PlateOut => {
    const deret: ChartSeries[] = [];
    for (let i = 0; i < n; i++) {
      if (!(kas.equilibrium[i] > 0)) continue;
      const e = kas.equilibrium[i];
      deret.push({
        pts: kas.t.map((tt, k) => ({ x: tt, y: kas.biomass[k][i] / e })),
        color: WARNA[i],
        weight: i + 1 === lv ? W.bold : W.thin,
        dash: GARIS[i],
        label: `T${i + 1}`,
        labelAt: 0.92 - 0.06 * i,
        labelDy: -9,
      });
    }
    return drawChart(
      ctx,
      w,
      ch,
      {
        xMin: 0,
        xMax: TAHUN,
        yMin: 0,
        yMax: Math.min(Math.max(2, rasioMaks * 1.08), 6),
        axisX: x.axTahun,
        axisY: x.axRasio,
        series: deret,
        rules: [
          { axis: "y", at: 1, color: C.ink3, dash: DASH.axis },
          { axis: "x", at: T_GANGGU, color: C.ink3, dash: DASH.hidden },
        ],
      },
      lang
    );
  };

  const plate = usePlate(
    (ctx, w, h) => {
      const hPir = Math.round(Math.min(Math.max(h * 0.46, 200), 340));
      const N = keadaanPada(kursor);
      const pir = drawTrophicPyramid(
        ctx,
        w,
        hPir,
        {
          energy: r.levels.map((l) => l.energy),
          biomass: N,
          equilibrium: kas.equilibrium,
          supported: r.supported,
          pulse: [{ level: lv, strength: faktor }],
          responded: bufSudah.current,
        },
        { labels: labelPiramida, minEnergy: TROPHIC_MIN_ENERGY, withState: !bergerak }
      );
      tataRef.current = pir.layout;
      ctx.save();
      ctx.translate(0, hPir);
      const out = grafik(ctx, w, h - hPir);
      ctx.restore();
      const peta = offsetMap(out.map, 0, hPir);
      petaGrafik.current = peta;
      if (!bergerak) {
        isiTitik(N);
        drawTimeCursor(ctx, peta, kursor, titik.current);
      }
      return { map: peta, anchors: { kursor: { x: peta.X(kursor), y: peta.frame.y1 - 10 } } };
    },
    (ctx, w, h, tt) => {
      const tata = tataRef.current;
      const peta = petaGrafik.current;
      if (!tata || !peta) return;
      const m = mulai.current;
      if (m.tt === null) m.tt = tt;
      const t = (m.t + (tt - m.tt) * LAJU) % TAHUN;
      m.kini = t;
      const N = keadaanPada(t);
      drawTrophicState(ctx, tata, N, bufSudah.current, lv, labelPiramida);
      isiTitik(N);
      drawTimeCursor(ctx, peta, t, titik.current);
    },
    [P, eff, n, lang, K, lv, faktor, jenis, kursor, bergerak],
    { playing }
  );

  const putar = () => {
    if (playing) setKursor(Math.round(mulai.current.kini * 2) / 2);
    else {
      mulai.current.tt = null;
      mulai.current.t = kursor;
    }
    togglePutar();
  };
  /* Tombol ganggu: memilih tingkat. Bila animasi berjalan, waktu diulang
     dari awal supaya rambatannya terlihat dari saat gangguan. */
  const ganggu = (i: number) => {
    setTingkat(i);
    sentuh.current();
    if (playing) {
      mulai.current.tt = null;
      mulai.current.t = 0;
    }
  };

  const handles: HandleSpec[] = bergerak
    ? []
    : [
        {
          id: "kursor",
          anchor: "kursor",
          axis: "x",
          label: x.gT,
          param: P_TAHUN,
          value: kursor,
          toValue: (px, _py, m) => m.invX(px),
          onChange: setKursor,
          format: (v) => `${lang === "id" ? "tahun ke-" : "year "}${fmt(v, 1)}`,
        },
      ];

  return (
    <LabShell
      status={
        /* Skala log energi ditulis sebagai log₁₀ En pada skala lurus: En
           membentang dari 2 × 10⁻¹¹ sampai 7000, dan RegimeScale menuliskan
           nilainya dengan desimal tetap, jadi En kecil akan terbaca "0,00".
           Batasnya tetap TROPHIC_MIN_ENERGY (log₁₀ 1 = 0). */
        <RegimeScale
          symbol="log₁₀ En"
          value={atas.energy > 0 ? Math.log10(atas.energy) : NaN}
          digits={2}
          bands={[
            { from: -11, to: Math.log10(TROPHIC_MIN_ENERGY), label: x.bTak, tone: "caution" },
            { from: Math.log10(TROPHIC_MIN_ENERGY), to: 4, label: x.bYa, tone: "pass" },
          ]}
        />
      }
      sheet="EK-01"
      subject={SUBJECTS.EK[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Tiap tingkat rantai makanan hanya meneruskan{" "}
            <Term tint={C.energy}>sebagian kecil</Term> energi yang
            diterimanya. Karena itu panjang rantai bukan urusan selera
            melainkan urusan <Term tint={C.water}>produksi dasar</Term>.
          </p>
        ) : (
          <p>
            Each level of a food chain passes on only a{" "}
            <Term tint={C.energy}>small fraction</Term> of the energy it
            receives. The length of the chain is therefore not a matter of
            taste but of <Term tint={C.water}>base production</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="EK-01"
          title={x.sheetTitle}
          rev="A"
          height="clamp(560px, 82vh, 860px)"
          motion={{ playing, onToggle: putar, allowed: plate.motionAllowed, note: x.motionNote }}
          cells={[
            { label: t.tbUnit, value: `SI (${x.satE})` },
            { label: "P", value: `${fmt(P, 0)}` },
            { label: "ε", value: fmt(eff, 3) },
            { label: "n", value: fmt(n, 0), tint: r.overreach ? C.caution : undefined },
            { label: "En", value: fmtEnergi(atas.energy), tint: r.overreach ? C.caution : C.energy },
          ]}
        >
          <canvas ref={plate.ref} className="block h-full w-full" />
          <canvas ref={plate.motionRef} />
          <DragLayer out={plate.outRef.current} handles={handles} touch={() => sentuh.current()} />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="P" label={x.dP} value={P} min={20} max={20000} step={20} digits={0} unit={x.satE} onChange={setP} tint={C.water} />
              <InputRow symbol="ε" label={x.dE} value={eff} min={0.01} max={0.35} step={0.005} digits={3} onChange={setEff} tint={C.energy} />
              <InputRow symbol="n" label={x.dN} value={n} min={2} max={7} step={1} digits={0} onChange={setN} />
              <InputRow symbol="K" label={x.dK} value={K} min={200} max={20000} step={100} digits={0} unit="g/m²" onChange={setK} />
              <InputRow symbol="t" label={x.dT} value={kursor} {...P_TAHUN} unit={lang === "id" ? "th" : "y"} onChange={setKursor} />
            </InputTable>
            <SentuhContoh sentuh={sentuh} />

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pJernih, apply: () => { setP(800); setEff(0.12); setN(4); setK(2000); } },
                  { label: x.pSubur, apply: () => { setP(6000); setEff(0.1); setN(5); setK(15000); } },
                  { label: x.pWaduk, apply: () => { setP(200); setEff(0.08); setN(5); setK(700); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={x.blkGanggu}>
            <div role="radiogroup" aria-label={x.blkGanggu} className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
              {Array.from({ length: n }, (_, i) => i + 1).map((i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={lv === i}
                  onClick={() => ganggu(i)}
                  className={`label pb-px text-[0.8rem] transition-colors ${
                    lv === i
                      ? "border-b-2 border-ink font-semibold text-ink"
                      : "border-b border-rule-strong text-ink-2 hover:border-ink hover:text-ink"
                  }`}
                >
                  {x.gangguTingkat} {i}
                </button>
              ))}
            </div>
            <div role="radiogroup" aria-label={x.jenisLabel} className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
              <span className="stencil">{x.jenisLabel}</span>
              {(["denyut", "tekan"] as const).map((j) => (
                <button
                  key={j}
                  type="button"
                  role="radio"
                  aria-checked={jenis === j}
                  onClick={() => { setJenis(j); sentuh.current(); }}
                  className={`label pb-px text-[0.8rem] transition-colors ${
                    jenis === j
                      ? "border-b-2 border-ink font-semibold text-ink"
                      : "border-b border-rule-strong text-ink-2 hover:border-ink hover:text-ink"
                  }`}
                >
                  {j === "denyut" ? x.jenisDenyut : x.jenisTekan}
                </button>
              ))}
            </div>
            <div className="mt-2.5">
              <InputTable>
                <InputRow symbol="f" label={x.dF} value={faktor} min={0.1} max={3} step={0.05} digits={2} onChange={setFaktor} />
              </InputTable>
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "—", label: x.rSupported, value: fmt(r.supported, 0), strong: true },
                { symbol: "En", label: x.rTop, value: fmtE(atas.energy), unit: x.satE, tint: r.overreach ? C.caution : C.energy, strong: true },
                { symbol: "En/P", label: x.rFrac, value: fmtSci(r.topFraction), tint: C.critical },
                { symbol: "Bn", label: x.rBio, value: atas.biomass > 0 && atas.biomass < 1e-2 ? fmtSci(atas.biomass) : fmt(atas.biomass, 3), unit: "g/m²", tint: C.water },
                { symbol: "—", label: x.rLoss, value: fmt((1 - eff) * 100, 1), unit: "%" },
                { symbol: "—", label: x.rPersist, value: fmt(kas.persisting, 0), strong: true },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hE,
                    rumus: <span>E(i) = P · ε^(i−1)</span>,
                    isi: r.levels.map((l) => `E${l.level} ${fmtE(l.energy)}`).join(" ;  "),
                    hasil: `${fmt(r.levels.length, 0)} ${lang === "id" ? "tingkat" : "levels"}`,
                  },
                  {
                    judul: x.hEn,
                    rumus: <span>En = P · ε^(n−1)</span>,
                    isi: `${fmt(P, 0)} · ${fmt(eff, 3)}^${fmt(n - 1, 0)}`,
                    hasil: fmtE(atas.energy),
                    satuan: x.satE,
                    tint: r.overreach ? C.caution : C.energy,
                  },
                  {
                    judul: x.hFrac,
                    rumus: (<><Frac num="En" den="P" /><span>= ε^(n−1)</span></>),
                    isi: `${fmt(eff, 3)}^${fmt(n - 1, 0)}`,
                    hasil: fmtSci(r.topFraction),
                    tint: C.critical,
                  },
                  {
                    judul: x.hSup,
                    rumus: <span>E(i) ≥ {fmtPlain(TROPHIC_MIN_ENERGY, 0)}</span>,
                    isi: r.levels.map((l) => `E${l.level} ${l.energy >= TROPHIC_MIN_ENERGY ? "≥" : "<"} ${fmtPlain(TROPHIC_MIN_ENERGY, 0)}`).join(" ;  "),
                    hasil: `${fmt(r.supported, 0)} / ${fmt(n, 0)}`,
                  },
                  {
                    judul: x.hB,
                    rumus: <span>Bn = En · {fmt(0.02, 2)} · {fmt(1.6, 1)}^(n−1)</span>,
                    isi: `${fmtE(atas.energy)} · ${fmt(0.02, 2)} · ${fmt(1.6, 1)}^${fmt(n - 1, 0)}`,
                    hasil: atas.biomass > 0 && atas.biomass < 1e-2 ? fmtSci(atas.biomass) : fmt(atas.biomass, 3),
                    satuan: "g/m²",
                    tint: C.water,
                  },
                  {
                    judul: x.hEq,
                    rumus: <span>dN₁/dt = r N₁ (1 − N₁/K) − a₁ N₁ N₂;  dNᵢ/dt = ε aᵢ₋₁ Nᵢ₋₁ Nᵢ − mᵢ Nᵢ − aᵢ Nᵢ Nᵢ₊₁ = 0</span>,
                    isi: kas.equilibrium.map((v, i) => `N${i + 1} ${v > 0 ? fmt(v, v < 10 ? 2 : 0) : "0"}`).join(" ;  "),
                    hasil: `${fmt(kas.persisting, 0)} / ${fmt(n, 0)}`,
                  },
                  {
                    judul: `${x.hLag}, ${x.gangguTingkat.toLowerCase()} ${lv} ×${fmt(faktor, 2)}`,
                    rumus: <span>|Nᵢ(t) − Nᵢ*| ≥ {fmt(0.1, 1)} · {lang === "id" ? "maks" : "max"} |Nᵢ − Nᵢ*|</span>,
                    isi: kas.responseLag
                      .map((v, i) => (kas.equilibrium[i] > 0 ? `T${i + 1} ${fmt(v, 2)} ${kas.responseSign[i] > 0 ? "▲" : kas.responseSign[i] < 0 ? "▼" : "·"}` : `T${i + 1} —`))
                      .join(" ;  "),
                    hasil: lang === "id" ? "tahun" : "years",
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={nada}
            badge={r.overreach ? x.melampaui : x.tertopang}
            {...gabung(notice(P, eff, n, r.topFraction, r.supported, r.overreach, lang), x.dinamisNote)}
          />
        </>
      }
      verification={<Verification checks={checksTrophic(P, eff, n)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>E(i) = P · ε^(i−1)</span>
                <span className="ml-6">
                  {lang === "id" ? "bagian ke puncak" : "fraction to the top"} = ε^(n−1)
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "satu tingkat dianggap tertopang bila alirannya sedikitnya 1 kJ/m² per tahun"
                    : "a level counts as supported when its flow is at least 1 kJ/m² per year"}
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

function gabung(n: { state: string; notice: string[] }, tambah: string) {
  return { state: n.state, notice: [...n.notice, tambah] };
}

function notice(
  P: number,
  eff: number,
  n: number,
  topFraction: number,
  supported: number,
  overreach: boolean,
  lang: Lang
): { state: string; notice: string[] } {
  const x = TXT[lang];
  /* Tanpa penjepitan: ε × 1,5 paling besar 0,525, masih sah secara
     aritmetik. Dulu dijepit diam-diam ke 0,5 sementara kalimatnya tetap
     menulis "setengah kali lipat". */
  const effNaik = eff * 1.5;
  const naik = trophicPyramid(P, effNaik, n);
  const kali = naik.topFraction / Math.max(topFraction, 1e-30);

  if (lang === "en")
    return {
      state: `${fmtPlain(supported, 0)} of the ${fmtPlain(n, 0)} levels shown are supported; the top receives ${fmtSci(topFraction)} of the base production.`,
      notice: [
        overreach ? x.melampauiNote : "",
        `Raise the transfer efficiency by half, from ${fmt(eff * 100, 1)} to ${fmt(effNaik * 100, 1)} per cent, and the fraction reaching level ${fmtPlain(n, 0)} becomes ${fmtSci(naik.topFraction)}, ${fmt(kali, 1)} times as much; ${fmtPlain(naik.supported, 0)} of the ${fmtPlain(n, 0)} levels are then supported.`,
        "A modest change in efficiency compounds through every step, which is why arguments about food-chain length turn on numbers that look small.",
        x.faktor16,
      ],
    };
  return {
    state: `${fmtPlain(supported, 0)} dari ${fmtPlain(n, 0)} tingkat yang dilihat tertopang; puncak menerima ${fmtSci(topFraction)} dari produksi dasar.`,
    notice: [
      overreach ? x.melampauiNote : "",
      `Naikkan efisiensi peralihannya setengah kali lipat, dari ${fmt(eff * 100, 1)} menjadi ${fmt(effNaik * 100, 1)} persen, dan bagian yang sampai ke tingkat ${fmtPlain(n, 0)} menjadi ${fmtSci(naik.topFraction)}, ${fmt(kali, 1)} kali lipat; ${fmtPlain(naik.supported, 0)} dari ${fmtPlain(n, 0)} tingkat lalu tertopang.`,
      "Perubahan kecil pada efisiensi berlipat ganda melewati tiap selang, dan itulah sebabnya perdebatan tentang panjang rantai makanan berkisar pada angka yang tampak sepele.",
      x.faktor16,
    ],
  };
}
