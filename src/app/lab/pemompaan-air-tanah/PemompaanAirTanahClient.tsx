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
import {
  drawStructure,
  type StructureBody,
  type StructureCallout,
  type StructureLine,
} from "@/lib/drawStructure";
import { SICHARDT_C, fmt, fmtPlain, fmtSci, pumpingWell, wellDrawdownAt } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksWell } from "@/lib/checks";

/**
 * Kenaikan muka piezometrik di atas atap akuifer tertekan, sebagai bagian
 * tebal akuifernya. Dipatok, bukan digeser, supaya lembar ini tidak
 * menambah satu penggeser lagi hanya untuk satu garis gambar. Yang
 * dipersoalkannya tetap terjaga: begitu penurunan melampaui angka ini,
 * muka piezometrik jatuh di bawah atap dan akuifernya berhenti tertekan.
 */
const PIEZO_RISE = 0.5;

/*
 * Batas penurunan dalam akuifer bebas dalam Q/Qmax. Model menandai
 * deepDrawdown bila s > 0,25 b, yaitu hw < 0,75 b. Karena
 * b² − hw² = Q ln(R/rw)/(π k) = (Q/Qmax) b², batas itu setara
 * Q/Qmax = 1 − 0,75² = 0,4375 dengan tepat.
 */
const Q_DALAM = 1 - 0.75 * 0.75;

const TXT = {
  id: {
    title: "Pemompaan air tanah",
    sheetTitle: "Kerucut penurunan di sekitar sumur — rumus Thiem",
    dQ: "Debit pemompaan",
    dK: "Permeabilitas",
    dB: "Tebal akuifer",
    dRw: "Jari-jari sumur",
    dR: "Jari-jari pengaruh",
    dC: "Koefisien kehilangan sumur (C)",
    mode: "Jenis akuifer",
    mTertekan: "Tertekan",
    mBebas: "Bebas",
    pUji: "Uji pompa biasa",
    pDalam: "Penurunan dalam",
    pRugi: "Sumur yang tersumbat",
    rS: "Penurunan akibat akuifernya",
    rLoss: "Kehilangan di sumurnya sendiri",
    rTotal: "Penurunan yang terukur di sumur",
    rH: "Tinggi muka air di dinding sumur",
    rHalf: "Jari-jari tempat separuh penurunan selesai",
    rSpec: "Kapasitas jenis",
    rQmax: "Debit terbesar sebelum sumurnya kering",
    rT: "Keterusan akuifer",
    rSich: "Taksiran Sichardt untuk jari-jari pengaruh",
    aman: "Sumur berjalan",
    dalam: "Penurunan dalam",
    dalamNote:
      "Penurunan melampaui seperempat tebal akuifer; asumsi Dupuit mulai longgar. Rumus akuifer bebas mengandaikan aliran mendatar, dan di dekat sumur yang muka airnya turun sedalam ini aliran mulai menukik, jadi penurunan di dinding sumur yang sebenarnya sedikit berbeda dari yang dihitung.",
    bKecil: "Penurunan kecil, Dupuit berlaku",
    bDalam: "Penurunan dalam",
    bKering: "Sumur kering",
    bTertekan: "Tertekan, Thiem berlaku",
    bBawahAtap: "Muka piezometrik di bawah atap",
    lsm: "l/s per m",
    hT: "Keterusan akuifer",
    hS: "Penurunan di dinding sumur",
    hSw: "Kehilangan sumur, penurunan terukur, dan tinggi muka air",
    hHalf: "Jari-jari separuh penurunan dan kapasitas jenis",
    hHalfBebas: "bebas: dicari dengan bagi dua",
    hQmax: "Debit terbesar dan taksiran Sichardt",
    kering: "Sumur kering pada debit ini",
    bukanTertekan: "Muka piezometrik jatuh di bawah atap akuifer",
    keringNote:
      "Debit yang diminta melampaui yang sanggup dihantarkan akuifer ini menuju sumurnya, jadi muka air di dalam sumur mencapai dasar akuifer dan pompanya menghisap udara. Yang perlu diperhatikan tentang batas ini: ia bukan batas pompa melainkan batas akuifer, dan mengganti pompa dengan yang lebih besar tidak menaikkannya satu liter pun. Yang menaikkannya hanya sumur yang lebih banyak dan berjauhan, atau sumur yang menembus akuifer lebih dalam.",
    bukanTertekanNote:
      "Penurunannya sudah melampaui tinggi muka piezometrik di atas atap akuifer, jadi air di bawah atap tidak lagi bertekanan dan akuifernya berhenti tertekan di sekitar sumur. Rumus yang dipakai lembar ini tidak lagi berlaku di situ: yang berlaku rumus akuifer bebas, dan penurunannya akan lebih dalam daripada yang tergambar. Peralihan ini adalah salah satu sebab paling sering uji pompa memberi keterusan yang lebih kecil daripada yang sebenarnya.",
    note:
      "Dua hal pada lembar ini yang berasal dari logaritma pada rumusnya, dan keduanya mengubah cara membaca hasil uji pompa. Pertama, separuh seluruh penurunan selesai pada jari-jari akar R dikali rw, yaitu rata-rata UKUR jari-jari sumur dan jari-jari pengaruh, bukan rata-rata hitungnya. Pada sumur berjari-jari lima belas sentimeter dengan pengaruh empat ratus meter, separuh penurunan sudah selesai dalam delapan meter pertama, dan sisanya terbagi atas hampir empat ratus meter berikutnya. Itu sebabnya sumur pantau yang dipasang jauh hampir tidak memberi keterangan, dan sebabnya dua sumur yang berjarak sepuluh meter sudah saling mengganggu hampir sepenuhnya. Kedua, jari-jari pengaruh yang ditaksir kasar tidak semerusak yang dikira, justru karena ia berada di dalam logaritma. Melipatempatkannya menaikkan penurunan hanya sebesar ln empat dibagi ln R per rw, yang pada sumur di atas kurang dari delapan belas persen. Jadi taksiran yang meleset dua kali lipat pada jari-jari pengaruh adalah kesalahan yang dapat diterima, sedangkan taksiran yang meleset dua kali lipat pada permeabilitas adalah kesalahan dua kali lipat pada jawabannya.",
  },
  en: {
    title: "Groundwater pumping",
    sheetTitle: "The drawdown cone around a well — the Thiem formula",
    dQ: "Pumping discharge",
    dK: "Permeability",
    dB: "Aquifer thickness",
    dRw: "Well radius",
    dR: "Radius of influence",
    dC: "Well loss coefficient (C)",
    mode: "Aquifer type",
    mTertekan: "Confined",
    mBebas: "Unconfined",
    pUji: "Ordinary pumping test",
    pDalam: "Deep drawdown",
    pRugi: "A clogged well",
    rS: "Drawdown from the aquifer",
    rLoss: "Loss in the well itself",
    rTotal: "Drawdown measured in the well",
    rH: "Water level at the well face",
    rHalf: "Radius where half the drawdown is done",
    rSpec: "Specific capacity",
    rQmax: "Largest discharge before the well runs dry",
    rT: "Aquifer transmissivity",
    rSich: "Sichardt estimate of the influence radius",
    aman: "The well runs",
    dalam: "Deep drawdown",
    dalamNote:
      "Drawdown exceeds a quarter of the aquifer thickness; the Dupuit assumption starts to loosen. The unconfined formula assumes horizontal flow, and near a well whose water level falls this far the flow starts to dip, so the true drawdown at the well face differs somewhat from the computed one.",
    bKecil: "Small drawdown, Dupuit holds",
    bDalam: "Deep drawdown",
    bKering: "Well runs dry",
    bTertekan: "Confined, Thiem holds",
    bBawahAtap: "Piezometric surface below the roof",
    lsm: "l/s per m",
    hT: "Aquifer transmissivity",
    hS: "Drawdown at the well face",
    hSw: "Well loss, measured drawdown, and water level",
    hHalf: "Half-drawdown radius and specific capacity",
    hHalfBebas: "unconfined: found by bisection",
    hQmax: "Largest discharge and the Sichardt estimate",
    kering: "The well runs dry at this discharge",
    bukanTertekan: "The piezometric surface falls below the aquifer roof",
    keringNote:
      "The discharge asked for exceeds what this aquifer can deliver to its well, so the water level inside the well reaches the aquifer base and the pump draws air. What is worth noticing about this limit: it is a limit of the aquifer, not of the pump, and fitting a larger pump does not raise it by a single litre. What raises it is more wells set far apart, or a well that penetrates deeper into the aquifer.",
    bukanTertekanNote:
      "The drawdown now exceeds the height of the piezometric surface above the aquifer roof, so the water below the roof is no longer under pressure and the aquifer stops being confined near the well. The formula this sheet uses no longer holds there: what holds is the unconfined formula, and the drawdown will be deeper than drawn. This transition is one of the commonest reasons a pumping test returns a transmissivity smaller than the true one.",
    note:
      "Two things on this sheet come from the logarithm in the formula, and both change how a pumping test is read. First, half the entire drawdown is done within a radius of the square root of R times rw, the GEOMETRIC mean of the well radius and the radius of influence, not the arithmetic one. For a well of fifteen centimetres radius with four hundred metres of influence, half the drawdown is finished in the first eight metres, and the rest is spread over nearly four hundred more. That is why an observation well set far out tells almost nothing, and why two wells ten metres apart already interfere almost completely. Second, a roughly estimated radius of influence is far less damaging than it seems, precisely because it sits inside the logarithm. Quadrupling it raises the drawdown only by ln four over ln R over rw, which for the well above is under eighteen per cent. So being wrong by a factor of two on the radius of influence is a tolerable error, while being wrong by a factor of two on permeability is a factor of two error in the answer.",
  },
} as const;

const REFS = {
  id: [
    "Thiem, G. (1906). Hydrologische Methoden. Gebhardt, Leipzig.",
    "Kruseman, G.P. & de Ridder, N.A. (1990). Analysis and Evaluation of Pumping Test Data, ILRI Publication 47, edisi ke-2.",
    "Jacob, C.E. (1947). Drawdown test to update potential yield of well. Trans. ASCE 112.",
    "Dupuit, J. (1863). Études théoriques et pratiques sur le mouvement des eaux.",
  ],
  en: [
    "Thiem, G. (1906). Hydrologische Methoden. Gebhardt, Leipzig.",
    "Kruseman, G.P. & de Ridder, N.A. (1990). Analysis and Evaluation of Pumping Test Data, ILRI Publication 47, 2nd ed.",
    "Jacob, C.E. (1947). Drawdown test to update potential yield of well. Trans. ASCE 112.",
    "Dupuit, J. (1863). Études théoriques et pratiques sur le mouvement des eaux.",
  ],
} as const;

export function PemompaanAirTanahClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Q, setQ] = useState(0.02);
  const [k, setK] = useState(1);
  const [b, setB] = useState(25);
  const [rw, setRw] = useState(0.15);
  const [R, setR] = useState(400);
  const [Cw, setCw] = useState(0);
  const [confined, setConfined] = useState(true);

  const kSI = k * 1e-4;
  const r = pumpingWell(Q, kSI, b, rw, R, confined, Cw);

  /* Aras muka air mula-mula di atas dasar akuifer */
  const arasAwal = confined ? b * (1 + PIEZO_RISE) : b;
  const bukanTertekan = confined && r.sAquifer > b * PIEZO_RISE;
  /* Saat kering, model menjepit s pada b (wellDrawdownAt), jadi hw 0,
     Q/s, r½, dan Sichardt bukan hasil yang sah: ditulis "—". */
  const tampil = (v: number) => (r.dry ? NaN : v);
  const satuan = (u: string) => (r.dry ? undefined : u);
  const lnR = Math.log(R / rw);
  const dalam = !confined && !r.dry && r.deepDrawdown;

  const ref = useCanvas(
    (ctx, w, ch) => {
      /* Kerucutnya dicuplik menurut logaritma jarak supaya bagian yang curam
         di dekat sumur ikut terwakili, lalu digambar pada sumbu mendatar
         yang LURUS supaya bentuk kerucutnya terbaca apa adanya. */
      const kanan: { x: number; z: number }[] = [];
      const n = 160;
      for (let i = 0; i <= n; i++) {
        const rr = rw * Math.pow(R / rw, i / n);
        const s = r.dry
          ? Math.min(wellDrawdownAt(rr, Q, kSI, b, rw, R, confined), arasAwal)
          : wellDrawdownAt(rr, Q, kSI, b, rw, R, confined);
        kanan.push({ x: rr, z: arasAwal - s });
      }
      const muka = [
        ...kanan.map((p) => ({ x: -p.x, z: p.z })).reverse(),
        ...kanan,
      ];

      const badan: StructureBody[] = [
        {
          pts: [
            { x: -R, z: 0 },
            { x: R, z: 0 },
            { x: R, z: b },
            { x: -R, z: b },
          ],
          hatch: "soil",
          outline: false,
        },
      ];
      if (confined)
        badan.push({
          pts: [
            { x: -R, z: b },
            { x: R, z: b },
            { x: R, z: b * 1.18 },
            { x: -R, z: b * 1.18 },
          ],
          hatch: "concrete",
        });

      const lebarSumur = Math.max(rw, R * 0.005);
      const garis: StructureLine[] = [
        {
          /* Muka air mula-mula: garis penuh untuk akuifer bebas, putus untuk
             muka piezometrik, karena muka piezometrik bukan permukaan air */
          pts: [
            { x: -R, z: arasAwal },
            { x: R, z: arasAwal },
          ],
          color: C.water,
          weight: W.thin,
          dash: confined ? DASH.axis : DASH.hidden,
          label: T.staticLevel,
          labelAt: 0.08,
          labelDy: -8,
          labelAlign: "left",
        },
        {
          pts: [
            { x: -lebarSumur, z: arasAwal * 1.18 },
            { x: -lebarSumur, z: 0 },
          ],
          color: C.ink,
          weight: W.bold,
          dash: DASH.solid,
        },
        {
          pts: [
            { x: lebarSumur, z: arasAwal * 1.18 },
            { x: lebarSumur, z: 0 },
          ],
          color: C.ink,
          weight: W.bold,
          dash: DASH.solid,
        },
      ];
      if (!r.dry)
        garis.push({
          pts: [
            { x: r.halfRadius, z: 0 },
            { x: r.halfRadius, z: arasAwal - r.sAquifer / 2 },
          ],
          color: C.critical,
          weight: W.hair,
          dash: DASH.axis,
          label: `${T.halfDrawdown} ${fmtPlain(r.halfRadius, 1)} m`,
          labelAt: 1,
          labelDy: -10,
          labelAlign: "left",
        });

      const penunjuk: StructureCallout[] = [
        { x: 0, z: arasAwal * 1.1, dx: 22, dy: -12, text: T.wellLabel },
        {
          x: -R * 0.42,
          z: arasAwal - wellDrawdownAt(R * 0.42, Q, kSI, b, rw, R, confined),
          dx: -18,
          dy: 26,
          text: T.drawdownCone,
          color: C.water,
        },
        { x: R * 0.72, z: b * 0.45, dx: 0, dy: 24, text: T.aquiferLabel },
      ];
      if (confined)
        penunjuk.push({
          x: -R * 0.72,
          z: b * 1.09,
          dx: 0,
          dy: -20,
          text: T.confiningLabel,
        });

      drawStructure(
        ctx,
        w,
        ch,
        {
          xMin: -R,
          xMax: R,
          zMin: 0,
          zMax: arasAwal * 1.3,
          equalScale: false,
          bodies: badan,
          waters: [{ surface: muka, invalid: r.dry || bukanTertekan }],
          lines: garis,
          dims: [
            {
              axis: "v",
              at: lebarSumur,
              from: arasAwal - r.sAquifer,
              to: arasAwal,
              /*
               * Ukurannya digeser ke sisi KIRI sumur. Di sisi kanan ia
               * berebut beberapa piksel dengan nama jari-jari separuh
               * penurunan, yang memang duduk sangat dekat sumurnya karena
               * separuh penurunan selesai pada akar R dikali rw, yaitu
               * delapan meter pada bidang selebar delapan ratus meter.
               */
              text: `s ${fmtPlain(r.sAquifer, 2)} m`,
              color: C.critical,
              offset: -30,
            },
          ],
          callouts: penunjuk,
          arrows: [{ x: 0, z: arasAwal * 1.22, length: 0, rise: -18, color: C.water }],
          heading: r.dry ? x.kering : bukanTertekan ? x.bukanTertekan : undefined,
          headingColor: C.signal,
          imperviousFloor: true,
          axisX: T.axWellRadius,
          axisZ: T.elevation,
        },
        lang
      );
    },
    [Q, k, b, rw, R, Cw, confined, lang]
  );

  return (
    <LabShell
      status={
        confined ? (
          /* Batas 1: muka piezometrik dipatok 0,5 b di atas atap; s yang
             melewatinya membuat akuifer berhenti tertekan (di luar
             rentang Thiem). Rentang penggeser memberi 2,7·10⁻⁵ sampai
             5060, jadi kedua ujung bisa lewat skala. */
          <RegimeScale
            symbol="s/(0,5 b)"
            value={r.sAquifer / (b * PIEZO_RISE)}
            invalid={bukanTertekan}
            scale="log"
            digits={3}
            bands={[
              { from: 0.001, to: 1, label: x.bTertekan, tone: "water" },
              { from: 1, to: 10, label: x.bBawahAtap, tone: "invalid" },
            ]}
          />
        ) : (
          /* Batas dari pumpingWell: deepDrawdown (s > 0,25 b, setara
             Q/Qmax = 0,4375) dan dry (Q ≥ Qmax), Dupuit-Thiem. */
          <RegimeScale
            symbol="Q/Qmax"
            value={Q / r.Qmax}
            invalid={r.dry}
            scale="log"
            digits={3}
            bands={[
              { from: 0.001, to: Q_DALAM, label: x.bKecil, tone: "water" },
              { from: Q_DALAM, to: 1, label: x.bDalam, tone: "caution" },
              { from: 1, to: 10, label: x.bKering, tone: "invalid" },
            ]}
          />
        )
      }
      sheet="GW-02"
      subject={SUBJECTS.GW[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Separuh seluruh penurunan selesai pada{" "}
            <Term tint={C.critical}>rata-rata ukur</Term> jari-jari sumur dan
            jari-jari pengaruh, bukan rata-rata hitungnya.
            {!r.dry && (
              <>
                {" "}Pada sumur ini, separuhnya sudah selesai dalam{" "}
                <Term tint={C.water}>{fmt(r.halfRadius, 1)} meter</Term> pertama.
              </>
            )}
          </p>
        ) : (
          <p>
            Half the entire drawdown is done at the{" "}
            <Term tint={C.critical}>geometric mean</Term> of the well radius and
            the radius of influence, not the arithmetic one.
            {!r.dry && (
              <>
                {" "}For this well half of it is finished within the first{" "}
                <Term tint={C.water}>{fmt(r.halfRadius, 1)} metres</Term>.
              </>
            )}
          </p>
        )
      }
      drawing={
        <Sheet
          number="GW-02"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m/s)" },
            { label: "Q", value: `${fmt(Q * 1000, 1)} l/s`, tint: C.water },
            { label: "s", value: `${fmt(r.sAquifer, 2)} m`, tint: C.critical },
            { label: "k", value: `${fmtSci(kSI)} m/s` },
            { label: confined ? "T" : "kH", value: `${fmtSci(r.T)} m²/s` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <div className="mb-3">
              <PresetRow
                label={x.mode}
                active={confined ? 0 : 1}
                presets={[
                  { label: x.mTertekan, apply: () => setConfined(true) },
                  { label: x.mBebas, apply: () => setConfined(false) },
                ]}
              />
            </div>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q * 1000} min={0.5} max={120} step={0.5} digits={1} unit="l/s" onChange={(v) => setQ(v / 1000)} tint={C.water} />
              <InputRow symbol="k" label={x.dK} value={k} min={0.05} max={40} step={0.05} digits={2} unit="10⁻⁴ m/s" onChange={setK} />
              <InputRow symbol="b" label={x.dB} value={b} min={4} max={80} step={1} digits={0} unit="m" onChange={setB} />
              <InputRow symbol="rw" label={x.dRw} value={rw} min={0.05} max={0.6} step={0.01} digits={2} unit="m" onChange={setRw} />
              <InputRow symbol="R" label={x.dR} value={R} min={50} max={2000} step={25} digits={0} unit="m" onChange={setR} />
              <InputRow symbol="C" label={x.dC} value={Cw} min={0} max={6000} step={100} digits={0} unit="s²/m⁵" onChange={setCw} tint={C.critical} />
            </InputTable>

            <div className="mt-3.5">
              {/* Penurunan dalam: Q 15 l/s, bebas (s 9,24 m = 0,37 b, belum
                  kering; 50 l/s dulu sudah kering). Sumur tersumbat: Q 24
                  l/s, C 3000 (s 12,05 m < 0,5 b; 40 l/s dulu membuat akuifer
                  berhenti tertekan dan menutup pokok tombolnya). */}
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pUji, apply: () => { setQ(0.02); setK(1); setB(25); setRw(0.15); setR(400); setCw(0); setConfined(true); } },
                  { label: x.pDalam, apply: () => { setQ(0.015); setK(1); setB(25); setRw(0.15); setR(400); setCw(0); setConfined(false); } },
                  { label: x.pRugi, apply: () => { setQ(0.024); setK(1); setB(25); setRw(0.15); setR(400); setCw(3000); setConfined(true); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "s", label: x.rS, value: fmt(tampil(r.sAquifer), 3), unit: satuan("m"), tint: C.critical, strong: true },
                { symbol: "sw", label: x.rLoss, value: fmt(r.sWellLoss, 3), unit: "m", tint: Cw > 0 ? C.critical : undefined },
                { symbol: "st", label: x.rTotal, value: fmt(tampil(r.sTotal), 3), unit: satuan("m"), strong: true },
                { symbol: "hw", label: x.rH, value: fmt(tampil(r.hWell), 2), unit: satuan("m"), tint: C.water },
                { symbol: "r½", label: x.rHalf, value: fmt(tampil(r.halfRadius), 2), unit: satuan("m") },
                { symbol: "Q/s", label: x.rSpec, value: fmt(tampil(r.specificCapacity * 1000), 2), unit: satuan(x.lsm) },
                { symbol: "Qmax", label: x.rQmax, value: Number.isFinite(r.Qmax) ? fmt(r.Qmax * 1000, 1) : "—", unit: Number.isFinite(r.Qmax) ? "l/s" : undefined, tint: r.dry ? C.signal : undefined },
                { symbol: "T", label: x.rT, value: fmtSci(r.T), unit: "m²/s" },
                { symbol: "R", label: x.rSich, value: fmt(tampil(r.sichardt), 0), unit: satuan("m") },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hT,
                    rumus: <span>T = k · b</span>,
                    isi: `${fmtSci(kSI)} · ${fmt(b, 0)}`,
                    hasil: fmtSci(r.T),
                    satuan: "m²/s",
                  },
                  confined
                    ? {
                        judul: x.hS,
                        rumus: (<><span>s =</span><Frac num="Q · ln(R/rw)" den="2 π T" /></>),
                        isi: `${fmt(Q, 4)} · ln( ${fmt(R, 0)} / ${fmt(rw, 2)} ) / ( 2π · ${fmtSci(r.T)} )`,
                        hasil: fmt(r.sAquifer, 3),
                        satuan: "m",
                        tint: C.critical,
                      }
                    : {
                        judul: x.hS,
                        rumus: (<><span>s = b − √( b² −</span><Frac num="Q · ln(R/rw)" den="π k" /><span>)</span></>),
                        isi: r.dry
                          ? `${fmt(Q, 4)} · ln( ${fmt(R, 0)} / ${fmt(rw, 2)} ) / ( π · ${fmtSci(kSI)} ) = ${fmt((Q * lnR) / (Math.PI * kSI), 1)} ≥ b² = ${fmt(b * b, 0)}`
                          : `${fmt(b, 0)} − √( ${fmt(b, 0)}² − ${fmt(Q, 4)} · ln( ${fmt(R, 0)} / ${fmt(rw, 2)} ) / ( π · ${fmtSci(kSI)} ) )`,
                        hasil: fmt(tampil(r.sAquifer), 3),
                        satuan: satuan("m"),
                        tint: C.critical,
                      },
                  {
                    judul: x.hSw,
                    rumus: <span>sw = C · Q² ; st = s + sw ; hw = b − s</span>,
                    isi: r.dry
                      ? `sw = ${fmt(Cw, 0)} · ${fmt(Q, 4)}² = ${fmt(r.sWellLoss, 3)} m`
                      : `sw = ${fmt(Cw, 0)} · ${fmt(Q, 4)}² = ${fmt(r.sWellLoss, 3)} ; st = ${fmt(r.sAquifer, 3)} + ${fmt(r.sWellLoss, 3)} = ${fmt(r.sTotal, 3)} m ; hw = ${fmt(b, 0)} − ${fmt(r.sAquifer, 3)}`,
                    hasil: fmt(tampil(r.hWell), 2),
                    satuan: satuan("m"),
                    tint: C.water,
                  },
                  {
                    judul: x.hHalf,
                    rumus: (<><span>r½ = √( R · rw ) ; Q/st</span></>),
                    isi: r.dry
                      ? "—"
                      : confined
                        ? `r½ = √( ${fmt(R, 0)} · ${fmt(rw, 2)} ) = ${fmt(r.halfRadius, 2)} m ; ${fmt(Q * 1000, 1)} / ${fmt(r.sTotal, 3)}`
                        : `r½ (${x.hHalfBebas}) = ${fmt(r.halfRadius, 2)} m ; ${fmt(Q * 1000, 1)} / ${fmt(r.sTotal, 3)}`,
                    hasil: fmt(tampil(r.specificCapacity * 1000), 2),
                    satuan: satuan(x.lsm),
                  },
                  {
                    judul: x.hQmax,
                    rumus: (<><span>Qmax =</span><Frac num="π k b²" den="ln(R/rw)" /><span>; R = {fmt(SICHARDT_C, 0)} · s · √k</span></>),
                    isi: r.dry
                      ? `Qmax = π · ${fmtSci(kSI)} · ${fmt(b, 0)}² / ln( ${fmt(R, 0)} / ${fmt(rw, 2)} ) = ${fmt(r.Qmax * 1000, 1)} l/s`
                      : `${confined ? "" : `Qmax = π · ${fmtSci(kSI)} · ${fmt(b, 0)}² / ln( ${fmt(R, 0)} / ${fmt(rw, 2)} ) = ${fmt(r.Qmax * 1000, 1)} l/s ; `}R = ${fmt(SICHARDT_C, 0)} · ${fmt(r.sAquifer, 3)} · √${fmtSci(kSI)}`,
                    hasil: fmt(tampil(r.sichardt), 0),
                    satuan: satuan("m"),
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={r.dry || bukanTertekan ? "invalid" : dalam ? "caution" : "water"}
            badge={r.dry ? x.kering : bukanTertekan ? x.bukanTertekan : dalam ? x.dalam : x.aman}
            {...notice(Q, kSI, b, rw, R, confined, Cw, bukanTertekan, x, lang)}
          />
        </>
      }
      verification={<Verification checks={checksWell(Q, kSI, b, rw, R, confined, Cw)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>s =</span>
                <Frac num="Q ln(R/r)" den="2 π T" />
                <span className="ml-5">T = k b</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id" ? "akuifer tertekan" : "confined aquifer"}
                </span>
              </Eq>
              <Eq>
                <span>H² − h² =</span>
                <Frac num="Q ln(R/r)" den="π k" />
                <span className="ml-5 text-ink-3">
                  {lang === "id" ? "akuifer bebas" : "unconfined aquifer"}
                </span>
              </Eq>
              <Eq>
                <span>r½ = √(R rw)</span>
                <span className="ml-5">sw = C Q²</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? `muka piezometrik digambar ${fmtPlain(PIEZO_RISE, 1)} kali tebal akuifer di atas atapnya`
                    : `the piezometric surface is drawn ${fmtPlain(PIEZO_RISE, 1)} times the aquifer thickness above its roof`}
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
 * Kalimat keadaan, lalu butir: (a) lipat empat R; (b) lipat dua Q, dengan
 * cabang bila lipat dua itu membuat sumur kering atau akuifernya sudah
 * berhenti tertekan; (c) catatan kering / di bawah atap / penurunan dalam.
 */
function notice(
  Q: number,
  k: number,
  b: number,
  rw: number,
  R: number,
  confined: boolean,
  Cw: number,
  bukanTertekan: boolean,
  x: { keringNote: string; bukanTertekanNote: string; dalamNote: string },
  lang: Lang
): { state: string; notice: string[] } {
  const en = lang === "en";
  const r = pumpingWell(Q, k, b, rw, R, confined, Cw);
  const jenis = confined ? (en ? "Confined" : "Tertekan") : en ? "Unconfined" : "Bebas";

  if (r.dry) {
    return {
      state: en
        ? `${jenis}: the well runs dry; Q = ${fmt(Q * 1000, 1)} l/s is at or above Qmax = ${fmt(r.Qmax * 1000, 1)} l/s.`
        : `${jenis}: sumur kering; Q = ${fmt(Q * 1000, 1)} l/s sudah mencapai atau melampaui Qmax = ${fmt(r.Qmax * 1000, 1)} l/s.`,
      notice: [x.keringNote],
    };
  }

  const empat = pumpingWell(Q, k, b, rw, R * 4, confined, Cw);
  const dua = pumpingWell(Q * 2, k, b, rw, R, confined, Cw);
  const naikR = r.sAquifer > 0 ? (empat.sAquifer / r.sAquifer - 1) * 100 : 0;
  const naikQ = r.sAquifer > 0 ? dua.sAquifer / r.sAquifer : 2;
  const bagian = (r.halfRadius / R) * 100;

  const state = en
    ? `${jenis}: s = ${fmt(r.sAquifer, 3)} m at the well face, half of it done within ${fmt(r.halfRadius, 1)} m.`
    : `${jenis}: s = ${fmt(r.sAquifer, 3)} m di dinding sumur, separuhnya selesai dalam ${fmt(r.halfRadius, 1)} m.`;

  const butir: string[] = [];
  if (bukanTertekan) {
    butir.push(x.bukanTertekanNote);
    return { state, notice: butir };
  }

  butir.push(
    en
      ? `Half the drawdown is done inside ${fmt(r.halfRadius, 1)} metres, ${fmt(bagian, 2)} per cent of the radius of influence. Quadruple that radius and the drawdown rises only ${fmt(naikR, 1)} per cent, because the radius sits inside a logarithm.`
      : `Separuh penurunannya selesai dalam ${fmt(r.halfRadius, 1)} meter, yaitu ${fmt(bagian, 2)} persen dari jari-jari pengaruhnya. Lipatempatkan jari-jari pengaruh itu dan penurunannya naik hanya ${fmt(naikR, 1)} persen, karena jari-jarinya berada di dalam logaritma.`
  );

  if (confined) {
    butir.push(
      dua.sAquifer > b * PIEZO_RISE
        ? en
          ? `Double the discharge and the drawdown doubles to ${fmt(dua.sAquifer, 2)} m, which already takes the piezometric surface below the aquifer roof: the aquifer would stop being confined.`
          : `Gandakan debitnya dan penurunannya menjadi dua kali, ${fmt(dua.sAquifer, 2)} m, yang sudah membawa muka piezometrik ke bawah atap akuifer: akuifernya berhenti tertekan.`
        : en
          ? `Double the discharge and in a confined aquifer the drawdown doubles exactly, to ${fmt(dua.sAquifer, 2)} metres.`
          : `Gandakan debitnya dan pada akuifer tertekan penurunannya tepat menjadi dua kali, ${fmt(dua.sAquifer, 2)} meter.`
    );
  } else {
    butir.push(
      dua.dry
        ? en
          ? `Doubling the discharge would run the well dry: ${fmt(Q * 2000, 1)} l/s is above Qmax = ${fmt(r.Qmax * 1000, 1)} l/s.`
          : `Menggandakan debit membuat sumurnya kering: ${fmt(Q * 2000, 1)} l/s melampaui Qmax = ${fmt(r.Qmax * 1000, 1)} l/s.`
        : en
          ? `Double the discharge and in an unconfined aquifer the drawdown rises by a factor of ${fmt(naikQ, 2)}, not two, because what is proportional to the discharge is the difference of squared heads rather than the drawdown itself.`
          : `Gandakan debitnya dan pada akuifer bebas penurunannya menjadi ${fmt(naikQ, 2)} kali, bukan dua kali, karena yang berbanding lurus dengan debit adalah selisih kuadrat tinggi muka airnya, bukan penurunannya sendiri.`
    );
    if (r.deepDrawdown) butir.push(x.dalamNote);
  }

  return { state, notice: butir };
}
