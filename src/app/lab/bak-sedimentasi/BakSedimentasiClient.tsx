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
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import {
  SEDIMENT_S,
  fmt,
  fmtPlain,
  fmtSci,
  hazenEfficiency,
  settlingBasin,
  waterViscosity,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksBasin } from "@/lib/checks";

const TXT = {
  id: {
    title: "Bak sedimentasi",
    sheetTitle: "Bak sedimentasi aliran mendatar — efisiensi terhadap laju limpah",
    dQ: "Debit masuk",
    dL: "Panjang bak searah aliran",
    dB: "Lebar bak",
    dH: "Kedalaman air",
    dD: "Diameter butir rancangan",
    dTanks: "Banyaknya bak seri semu",
    dT: "Suhu air",
    pIrigasi: "Kantong lumpur irigasi",
    pAirMinum: "Bak pengendap air minum",
    pTambang: "Kolam pengendap tambang",
    rEta: "Bagian tertangkap, bak teraduk",
    rEtaIdeal: "Bagian tertangkap, bak ideal",
    rVo: "Laju limpah",
    rWs: "Kecepatan endap butir",
    rRatio: "Perbandingan endap terhadap limpah",
    rTinggal: "Waktu tinggal rata-rata",
    rLmin: "Panjang terpendek untuk menangkap seluruhnya",
    rVmendatar: "Kecepatan mendatar di bak",
    tergerus: "Vh > 20 ws (batas gerus kasar)",
    tergerusNote:
      "Kecepatan mendatar di dalam bak melampaui dua puluh kali kecepatan endap butir rancangan, batas kasar yang dipakai model lembar ini. Bila endapan benar tergerus, butir yang sudah mencapai dasar terangkat lagi oleh arus, dan efisiensi di sini menjadi terlalu tinggi karena hitungannya mengandaikan sekali mendarat berarti tertangkap.",
    tergerusJujur:
      "Batas 20 ws ini jauh lebih ketat daripada kecepatan gerus Camp (1946); penanda ini dapat muncul pada bak yang sebenarnya tidak tergerus, misalnya kolam pengendap butir sangat halus. Penggantian dengan rumus Camp menunggu nilai β dan f diperiksa ke sumbernya, jadi baca penanda ini sebagai peringatan, bukan putusan.",
    bSebagian: "Bak ideal menangkap sebagian",
    bSeluruh: "Bak ideal menangkap seluruhnya",
    menit: "menit",
    mJam: "m/jam",
    hVo: "Laju limpah",
    hRasio: "Perbandingan endap terhadap limpah dan bak ideal",
    hEta: "Bak teraduk, n bak seri semu",
    hTr: "Waktu tinggal dan panjang terpendek",
    hVh: "Kecepatan mendatar terhadap batas gerus 20 ws",
    note:
      "Hasil paling berguna dari lembar ini berlawanan dengan naluri hampir semua orang yang pertama kali merancang bak: efisiensi bak ideal sama sekali tidak bergantung pada kedalamannya. Memperdalam bak memang menambah waktu tinggal, tetapi ia juga menambah jarak yang harus ditempuh butir untuk sampai ke dasar, dan keduanya persis saling menghapus. Yang menentukan hanya luas permukaan, dan itulah sebabnya bak pengendap dibuat lebar dan dangkal, bukan sempit dan dalam. Cobalah sendiri: geser kedalamannya dari ujung ke ujung dan perhatikan kurva bak ideal tidak bergerak sedikit pun, sementara waktu tinggalnya berubah berkali lipat. Kedalaman tetap punya peran, tetapi bukan lewat efisiensi: ia menentukan kecepatan mendatar, dan kecepatan mendatar yang terlalu besar menggerus kembali endapan yang sudah terkumpul. Itu sebabnya lembar ini tetap memeriksanya dan menandainya bila terlampaui.",
  },
  en: {
    title: "Settling basin",
    sheetTitle: "Horizontal-flow settling basin — efficiency against overflow rate",
    dQ: "Inflow discharge",
    dL: "Basin length along the flow",
    dB: "Basin width",
    dH: "Water depth",
    dD: "Design grain diameter",
    dTanks: "Number of notional tanks in series",
    dT: "Water temperature",
    pIrigasi: "Irrigation sand trap",
    pAirMinum: "Drinking-water sedimentation tank",
    pTambang: "Mine settling pond",
    rEta: "Fraction captured, mixed basin",
    rEtaIdeal: "Fraction captured, ideal basin",
    rVo: "Overflow rate",
    rWs: "Grain settling velocity",
    rRatio: "Ratio of settling to overflow",
    rTinggal: "Mean residence time",
    rLmin: "Shortest length that captures everything",
    rVmendatar: "Horizontal velocity in the basin",
    tergerus: "Vh > 20 ws (rough scour limit)",
    tergerusNote:
      "The horizontal velocity in the basin exceeds twenty times the settling velocity of the design grain, the rough limit used by this sheet's model. If the deposit really is scoured, grains that have already reached the floor are lifted again by the current, and the efficiency here becomes too high, because the calculation assumes that landing once means captured.",
    tergerusJujur:
      "This 20 ws limit is much stricter than Camp's (1946) scour velocity; the flag can appear on a basin that is not actually scoured, for instance a pond settling very fine grains. Replacing it with Camp's formula waits until the values of β and f are checked against the source, so read this flag as a warning, not a verdict.",
    bSebagian: "Ideal basin captures part",
    bSeluruh: "Ideal basin captures all",
    menit: "min",
    mJam: "m/h",
    hVo: "Overflow rate",
    hRasio: "Ratio of settling to overflow, and the ideal basin",
    hEta: "Mixed basin, n notional tanks in series",
    hTr: "Residence time and shortest length",
    hVh: "Horizontal velocity against the 20 ws scour limit",
    note:
      "The most useful result on this sheet runs against the instinct of almost everyone designing a basin for the first time: the efficiency of an ideal basin does not depend on its depth at all. Deepening the basin does add residence time, but it also adds to the distance a grain must fall to reach the floor, and the two cancel exactly. Only the surface area matters, and that is why settling basins are built wide and shallow rather than narrow and deep. Try it: sweep the depth from end to end and watch the ideal-basin curve refuse to move, while the residence time changes several times over. Depth still has a role, but not through efficiency: it sets the horizontal velocity, and a horizontal velocity that is too high scours back up the deposit already collected. That is why this sheet still checks it and flags it when exceeded.",
  },
} as const;

const REFS = {
  id: [
    "Hazen, A. (1904). On sedimentation. Transactions ASCE, vol. 53.",
    "Camp, T.R. (1946). Sedimentation and the design of settling tanks. Transactions ASCE, vol. 111.",
    "Metcalf & Eddy (2013). Wastewater Engineering: Treatment and Resource Recovery, edisi ke-5. McGraw-Hill, Bab 5.",
    "Vanoni, V.A. (1975). Sedimentation Engineering. ASCE Manual 54, Bab 4.",
  ],
  en: [
    "Hazen, A. (1904). On sedimentation. Transactions ASCE, vol. 53.",
    "Camp, T.R. (1946). Sedimentation and the design of settling tanks. Transactions ASCE, vol. 111.",
    "Metcalf & Eddy (2013). Wastewater Engineering: Treatment and Resource Recovery, 5th ed. McGraw-Hill, Chapter 5.",
    "Vanoni, V.A. (1975). Sedimentation Engineering. ASCE Manual 54, Chapter 4.",
  ],
} as const;

/** Sumbu mendatar dalam meter per jam, satuan yang dipakai di lapangan. */
const VO_MIN = 0.2;
const VO_MAX = 200;

export function BakSedimentasiClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Q, setQ] = useState(0.05);
  const [L, setL] = useState(12);
  const [B, setB] = useState(3);
  const [H, setH] = useState(2);
  const [dMm, setDMm] = useState(0.05);
  const [tanks, setTanks] = useState(4);
  const [suhu, setSuhu] = useState(15);

  const nu = waterViscosity(suhu);
  const d = dMm / 1000;
  const r = settlingBasin(Q, L, B, H, d, SEDIMENT_S, nu, tanks);
  const Vmendatar = B * H > 0 ? Q / (B * H) : 0;
  const voJam = r.overflowRate * 3600;
  const wsJam = r.ws * 3600;

  const ref = useCanvas(
    (ctx, w, ch) => {
      const ideal: { x: number; y: number }[] = [];
      const teraduk: { x: number; y: number }[] = [];
      const satu: { x: number; y: number }[] = [];
      for (let lg = Math.log10(VO_MIN); lg <= Math.log10(VO_MAX) + 1e-9; lg += 0.02) {
        const vo = Math.pow(10, lg);
        const rasio = wsJam / vo;
        ideal.push({ x: vo, y: Math.min(rasio, 1) });
        teraduk.push({ x: vo, y: hazenEfficiency(rasio, tanks) });
        satu.push({ x: vo, y: hazenEfficiency(rasio, 1) });
      }

      const deret: ChartSeries[] = [
        {
          pts: ideal,
          color: C.critical,
          weight: W.thin,
          dash: DASH.hidden,
          label: T.idealBasin,
          labelAt: 0.3,
          labelDy: -11,
        },
        {
          pts: satu,
          color: C.ink3,
          weight: W.hair,
          label: "n 1",
          labelAt: 0.22,
          labelDy: 13,
        },
        {
          /* Tidak lagi merah sinyal saat Vh > 20 ws: batas itu kasar dan
             belum diperiksa (lihat tergerusJujur), dan efisiensinya tetap
             hasil sah rumus Hazen. Penilaiannya di kartu keadaan. */
          pts: teraduk,
          color: C.water,
          weight: W.bold,
          dash: DASH.solid,
          label: `${T.mixedBasin} n ${fmtPlain(tanks, 0)}`,
          labelAt: 0.52,
          labelDy: -11,
        },
      ];

      drawChart(
        ctx,
        w,
        ch,
        {
          xMin: VO_MIN,
          xMax: VO_MAX,
          yMin: 0,
          yMax: 1,
          xLog: true,
          axisX: T.axOverflow,
          axisY: T.axEfficiency,
          series: deret,
          point: {
            x: voJam,
            y: r.mixedEfficiency,
            label: `${fmtPlain(r.mixedEfficiency * 100, 1)} %`,
            invalid: false,
          },
        },
        lang
      );
    },
    [Q, L, B, H, dMm, tanks, suhu, lang]
  );

  return (
    <LabShell
      status={
        /* Batas 1 dari idealEfficiency = min(ws/vo, 1) (Hazen 1904).
           Rentang penggeser memberi ws/vo 4,6·10⁻⁶ sampai 1,6·10⁵, jadi
           kedua ujung bisa lewat skala; penandanya netral. */
        <RegimeScale
          symbol="ws/vo"
          value={r.ratio}
          scale="log"
          digits={3}
          bands={[
            { from: 0.001, to: 1, label: x.bSebagian, tone: "water" },
            { from: 1, to: 1000, label: x.bSeluruh, tone: "pass" },
          ]}
        />
      }
      sheet="SD-04"
      subject={SUBJECTS.SD[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Yang menentukan seberapa banyak butir tertangkap bukan{" "}
            <Term tint={C.energy}>waktu tinggalnya</Term>, melainkan{" "}
            <Term tint={C.water}>luas permukaan baknya</Term>. Memperdalam bak
            tidak menolong sama sekali, dan itu dapat dibuktikan di layar ini.
          </p>
        ) : (
          <p>
            What decides how much sediment is caught is not the{" "}
            <Term tint={C.energy}>residence time</Term> but the{" "}
            <Term tint={C.water}>surface area of the basin</Term>. Deepening the
            basin does not help at all, and you can prove that on this screen.
          </p>
        )
      }
      drawing={
        <Sheet
          number="SD-04"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "vo", value: `${fmt(voJam, 2)} ${x.mJam}`, tint: C.water },
            { label: "ws", value: `${fmtSci(r.ws)} m/s`, tint: C.critical },
            { label: "η", value: `${fmt(r.mixedEfficiency * 100, 1)} %`, tint: C.water },
            { label: "A", value: `${fmt(L * B, 0)} m²` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q * 1000} min={1} max={2000} step={1} digits={0} unit="l/s" onChange={(v) => setQ(v / 1000)} tint={C.water} />
              <InputRow symbol="L" label={x.dL} value={L} min={2} max={60} step={0.5} digits={1} unit="m" onChange={setL} />
              <InputRow symbol="B" label={x.dB} value={B} min={0.5} max={20} step={0.5} digits={1} unit="m" onChange={setB} />
              <InputRow symbol="H" label={x.dH} value={H} min={0.3} max={8} step={0.1} digits={1} unit="m" onChange={setH} tint={C.energy} />
              <InputRow symbol="d" label={x.dD} value={dMm} min={0.004} max={1} step={0.002} digits={3} unit="mm" onChange={setDMm} tint={C.critical} />
              <InputRow symbol="n" label={x.dTanks} value={tanks} min={1} max={20} step={1} digits={0} onChange={setTanks} />
              <InputRow symbol="T" label={x.dT} value={suhu} min={4} max={40} step={0.5} digits={1} unit="°C" onChange={setSuhu} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pIrigasi, apply: () => { setQ(0.5); setL(30); setB(6); setH(1.5); setDMm(0.07); setTanks(4); setSuhu(25); } },
                  { label: x.pAirMinum, apply: () => { setQ(0.05); setL(12); setB(3); setH(3); setDMm(0.02); setTanks(8); setSuhu(25); } },
                  { label: x.pTambang, apply: () => { setQ(0.1); setL(40); setB(15); setH(2); setDMm(0.01); setTanks(2); setSuhu(25); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "η", label: x.rEta, value: fmt(r.mixedEfficiency * 100, 2), unit: "%", tint: C.water, strong: true },
                { symbol: "η₀", label: x.rEtaIdeal, value: fmt(r.idealEfficiency * 100, 2), unit: "%", tint: C.critical, strong: true },
                { symbol: "vo", label: x.rVo, value: fmt(voJam, 3), unit: x.mJam },
                { symbol: "ws", label: x.rWs, value: fmtSci(r.ws), unit: "m/s", tint: C.critical },
                { symbol: "ws/vo", label: x.rRatio, value: fmt(r.ratio, 4) },
                { symbol: "tr", label: x.rTinggal, value: fmt(r.residence / 60, 1), unit: x.menit, tint: C.energy },
                { symbol: "Lmin", label: x.rLmin, value: Number.isFinite(r.minLength) ? fmt(r.minLength, 2) : "—", unit: Number.isFinite(r.minLength) ? "m" : undefined },
                { symbol: "Vh", label: x.rVmendatar, value: fmt(Vmendatar, 4), unit: "m/s", tint: r.scouring ? C.caution : undefined },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hVo,
                    rumus: (<><span>vo =</span><Frac num="Q" den="L · B" /><span>· 3600</span></>),
                    isi: `${fmt(Q, 3)} / ( ${fmt(L, 1)} · ${fmt(B, 1)} ) · 3600`,
                    hasil: fmt(voJam, 3),
                    satuan: x.mJam,
                    tint: C.water,
                  },
                  {
                    judul: x.hRasio,
                    rumus: (<><span>ws/vo ; η₀ = min(</span><Frac num="ws" den="vo" /><span>, 1)</span></>),
                    isi: `${fmtSci(r.ws)} / ${fmtSci(r.overflowRate)} = ${fmt(r.ratio, 4)} ; min( ${fmt(r.ratio, 4)} , 1 )`,
                    hasil: fmt(r.idealEfficiency * 100, 2),
                    satuan: "%",
                    tint: C.critical,
                  },
                  {
                    judul: x.hEta,
                    rumus: (<><span>η = 1 − ( 1 +</span><Frac num="ws/vo" den="n" /><span>)^(−n)</span></>),
                    isi: `1 − ( 1 + ${fmt(r.ratio, 4)} / ${fmt(tanks, 0)} )^(−${fmt(tanks, 0)})`,
                    hasil: fmt(r.mixedEfficiency * 100, 2),
                    satuan: "%",
                    tint: C.water,
                  },
                  {
                    judul: x.hTr,
                    rumus: (<><span>tr =</span><Frac num="L · B · H" den="Q" /><span>; Lmin =</span><Frac num="Q" den="B · ws" /><span>=</span><Frac num="H · Vh" den="ws" /></>),
                    isi: `tr = ${fmt(L, 1)} · ${fmt(B, 1)} · ${fmt(H, 1)} / ${fmt(Q, 3)} / 60 = ${fmt(r.residence / 60, 1)} ${x.menit} ; Lmin = ${fmt(Q, 3)} / ( ${fmt(B, 1)} · ${fmtSci(r.ws)} )`,
                    hasil: Number.isFinite(r.minLength) ? fmt(r.minLength, 2) : "—",
                    satuan: Number.isFinite(r.minLength) ? "m" : undefined,
                  },
                  {
                    judul: x.hVh,
                    rumus: (<><span>Vh =</span><Frac num="Q" den="B · H" /><span>; 20 · ws</span></>),
                    isi: `${fmt(Q, 3)} / ( ${fmt(B, 1)} · ${fmt(H, 1)} ) ${r.scouring ? ">" : "≤"} 20 · ${fmtSci(r.ws)} = ${fmt(20 * r.ws, 4)}`,
                    hasil: fmt(Vmendatar, 4),
                    satuan: "m/s",
                    tint: r.scouring ? C.caution : undefined,
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={r.scouring ? "caution" : r.ratio >= 1 ? "pass" : "water"}
            badge={r.scouring ? x.tergerus : r.ratio >= 1 ? x.bSeluruh : x.bSebagian}
            {...notice(Q, L, B, H, d, nu, tanks, r.residence, r.scouring, [x.tergerusNote, x.tergerusJujur], lang)}
          />
        </>
      }
      verification={<Verification checks={checksBasin(Q, L, B, H, d, SEDIMENT_S, nu, tanks)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>vo =</span>
                <Frac num="Q" den="L B" />
                <span className="ml-5">η₀ = min</span>
                <span className="ml-1">(</span>
                <Frac num="ws" den="vo" />
                <span>, 1)</span>
                <span className="ml-3 text-ink-3">
                  {lang === "id" ? "tanpa H sama sekali" : "with no H at all"}
                </span>
              </Eq>
              <Eq>
                <span>η = 1 −</span>
                <span className="ml-1">(</span>
                <span>1 +</span>
                <Frac num="ws" den="n vo" />
                <span>)^(−n)</span>
                <span className="ml-4 text-ink-3">
                  {lang === "id"
                    ? "n bak seri semu, bukan angka Manning"
                    : "n notional tanks in series, not the Manning value"}
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
 * Kalimat keadaan, lalu butir: (a) lipat dua kedalaman tidak mengubah η,
 * lipat dua lebar mengubahnya (dengan cabang bila bak sudah menangkap
 * hampir seluruhnya); (b) catatan gerus, bila ada.
 */
function notice(
  Q: number,
  L: number,
  B: number,
  H: number,
  d: number,
  nu: number,
  tanks: number,
  residence: number,
  scouring: boolean,
  gerus: [string, string],
  lang: Lang
): { state: string; notice: string[] } {
  const dalam = settlingBasin(Q, L, B, H * 2, d, SEDIMENT_S, nu, tanks);
  const lebar = settlingBasin(Q, L, B * 2, H, d, SEDIMENT_S, nu, tanks);
  const asli = settlingBasin(Q, L, B, H, d, SEDIMENT_S, nu, tanks);
  const eta = fmt(asli.mixedEfficiency * 100, 1);
  const eta0 = fmt(asli.idealEfficiency * 100, 1);
  /* Selisih kurang dari 0,1 titik persen: bak sudah menangkap hampir
     seluruhnya, dan kalimat "membeli seluruh perbaikannya" tidak benar. */
  const jenuh = (lebar.mixedEfficiency - asli.mixedEfficiency) * 100 < 0.1;

  if (lang === "en") {
    const banding = jenuh
      ? `Double the depth and the residence time doubles from ${fmt(residence / 60, 1)} to ${fmt((residence * 2) / 60, 1)} minutes, yet the captured fraction stays at ${eta} per cent. This basin already catches almost everything; widening it adds nothing.`
      : `Double the depth and the captured fraction goes from ${eta} to ${fmt(dalam.mixedEfficiency * 100, 1)} per cent, while the residence time doubles from ${fmt(residence / 60, 1)} to ${fmt((residence * 2) / 60, 1)} minutes. Double the width instead, which costs the same volume of excavation, and it goes to ${fmt(lebar.mixedEfficiency * 100, 1)} per cent. The same concrete, spent on the other dimension, buys the whole improvement. That is Hazen's result in one comparison, and it is the reason a settling basin is judged by its plan area rather than its volume.`;
    return {
      state: `η = ${eta} %: a mixed basin of n = ${fmt(tanks, 0)} captures ${eta} % of the design grain; an ideal basin would capture ${eta0} %.`,
      notice: scouring ? [banding, ...gerus] : [banding],
    };
  }
  const banding = jenuh
    ? `Lipatduakan kedalamannya dan waktu tinggalnya berlipat dua dari ${fmt(residence / 60, 1)} ke ${fmt((residence * 2) / 60, 1)} menit, tetapi bagian yang tertangkap tetap ${eta} persen. Bak ini sudah menangkap hampir seluruhnya; memperlebar tidak menambah apa pun.`
    : `Lipatduakan kedalamannya dan bagian yang tertangkap berubah dari ${eta} ke ${fmt(dalam.mixedEfficiency * 100, 1)} persen, sementara waktu tinggalnya berlipat dua dari ${fmt(residence / 60, 1)} ke ${fmt((residence * 2) / 60, 1)} menit. Lipatduakan lebarnya, yang menghabiskan galian sama banyak, dan angkanya menjadi ${fmt(lebar.mixedEfficiency * 100, 1)} persen. Beton yang sama, dibelanjakan pada ukuran yang lain, membeli seluruh perbaikannya. Itulah hasil Hazen dalam satu perbandingan, dan itu sebabnya bak pengendap dinilai dari luas denahnya, bukan dari isinya.`;
  return {
    state: `η = ${eta} %: bak teraduk n = ${fmt(tanks, 0)} menangkap ${eta} % butir rancangan; bak ideal menangkap ${eta0} %.`,
    notice: scouring ? [banding, ...gerus] : [banding],
  };
}
