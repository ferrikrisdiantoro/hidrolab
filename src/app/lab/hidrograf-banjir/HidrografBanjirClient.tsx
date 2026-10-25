"use client";

import { useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  Block,
  Hitungan,
  InputRow,
  InputTable,
  PresetRow,
  ResultTable,
  Sheet,
  StateCard,
  Term,
} from "@/components/ui";
import { useCanvas } from "@/lib/useCanvas";
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import {
  fmt,
  fmtPlain,
  floodHydrograph,
  scsStorage,
  scsUnitHydrograph,
} from "@/lib/hydraulics";
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

export function HidrografBanjirClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [P, setP] = useState(80);
  const [dur, setDur] = useState(6);
  const [CN, setCN] = useState(75);
  const [A, setA] = useState(50);
  const [tc, setTc] = useState(4);

  const r = floodHydrograph(P, dur, CN, A, tc);
  const hilang = P - r.effectiveRain;
  const S = scsStorage(CN);
  const Ia = 0.2 * S;
  const adaLimpas = r.effectiveRain > 0;
  // Pias ΔD dibulatkan model supaya bilangan bulat pias mengisi D tepat.
  const nPias = Math.round(dur / r.blockLength);

  const ref = useCanvas(
    (ctx, w, h) => {
      const tMax = r.points[r.points.length - 1].t;
      const qMax = Math.max(r.peak * 1.25, 1e-6);

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

      drawChart(
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
          bands: [{ axis: "x", from: 0, to: dur, label: T.rainBurst }],
          point: {
            x: r.peakTime,
            y: r.peak,
            label: `${fmtPlain(r.peak, 1)} m³/s`,
          },
        },
        lang
      );
    },
    [P, dur, CN, A, tc, lang]
  );

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
          cells={[
            { label: t.tbUnit, value: "SI (mm, m³/s)" },
            { label: "P", value: `${fmt(P, 0)} mm` },
            { label: "Pe", value: `${fmt(r.effectiveRain, 1)} mm`, tint: C.water },
            { label: "Qp", value: `${fmt(r.peak, 1)} m³/s`, tint: C.water },
            { label: "tpk", value: `${fmt(r.peakTime, 2)} h`, tint: C.energy },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="P" label={x.dP} value={P} min={5} max={400} step={5} digits={0} unit="mm" onChange={setP} tint={C.water} />
              <InputRow symbol="D" label={x.dDur} value={dur} min={1} max={36} step={1} digits={0} unit="h" onChange={setDur} />
              <InputRow symbol="CN" label={x.dCN} value={CN} min={30} max={100} step={1} digits={0} onChange={setCN} tint={C.critical} />
              <InputRow symbol="A" label={x.dA} value={A} min={1} max={1000} step={1} digits={0} unit="km²" onChange={setA} />
              <InputRow symbol="tc" label={x.dTc} value={tc} min={0.3} max={24} step={0.1} digits={1} unit="h" onChange={setTc} tint={C.energy} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pSawah, apply: () => { setP(80); setDur(6); setCN(75); setA(50); setTc(4); } },
                  { label: x.pKota, apply: () => { setP(150); setDur(3); setCN(92); setA(12); setTc(1.2); } },
                  { label: x.pHutan, apply: () => { setP(60); setDur(18); setCN(55); setA(300); setTc(14); } },
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
                    rumus: <span>ΔD = D / ⌈ D / min( 1; {fmt(0.133, 3)} · tc ) ⌉</span>,
                    isi: `${fmt(dur, 0)} / ⌈ ${fmt(dur, 0)} / ${fmt(Math.min(1, 0.133 * tc), 4)} ⌉ = ${fmt(dur, 0)} / ${nPias}`,
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
                    rumus: (<><span>Qp = {lang === "id" ? "maks" : "max"} Σ</span><Frac num="Pe" den="n" /><span>· qp · u( t − k · ΔD )</span></>),
                    isi: adaLimpas
                      ? `${lang === "id" ? "maks" : "max"} Σ ( ${fmt(r.effectiveRain, 3)} / ${nPias} ) · ${fmt(r.qp, 4)} · u( t − k · ${fmt(r.blockLength, 4)} )`
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
          </Block>

          <StateCard
            tone={r.blockTooCoarse ? "caution" : adaLimpas ? "water" : "neutral"}
            badge={r.blockTooCoarse ? x.kasar : adaLimpas ? x.adaLimpas : x.tanpaLimpas}
            {...notice(P, dur, CN, A, tc, r.peak, r.peakTime, r.effectiveRain, r.blockTooCoarse, lang)}
          />
        </>
      }
      verification={<Verification checks={checksHydrograph(P, dur, CN, A, tc)} />}
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
          note={x.note}
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
  lang: Lang
): { state: string; notice: string[] } {
  const x = TXT[lang];
  const en = lang === "en";
  const CN2 = Math.min(CN + 10, 100);
  const butir: string[] = [];

  if (kasar) butir.push(x.kasarNote);

  // Kepekaan CN memakai selisih sebenarnya; pada CN 100 tidak ada lagi
  // yang bisa dinaikkan, jadi butirnya ditekan.
  if (CN2 > CN) {
    const naik = floodHydrograph(P, dur, CN2, A, tc);
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
