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
  bendGeometry,
  bendPlan,
  drawStructure,
  type StructureLine,
  type StructureVector,
} from "@/lib/drawStructure";
import { G, fmt, fmtPlain, momentumForce } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksMomentum } from "@/lib/checks";

const TXT = {
  id: {
    title: "Prinsip momentum",
    sheetTitle: "Volume kendali pada belokan pipa, dilihat dari atas",
    dQ: "Debit",
    dD1: "Diameter penampang masuk",
    dD2: "Diameter penampang keluar",
    dH: "Tinggi tekan di penampang masuk",
    dSudut: "Sudut belokan",
    pSiku: "Belokan siku",
    pBalik: "Belokan berbalik arah",
    pKecil: "Pipa tanpa tekanan, hanya momentum",
    rV1: "Kecepatan masuk",
    rV2: "Kecepatan keluar",
    rP1: "Gaya tekanan di penampang masuk",
    rP2: "Gaya tekanan di penampang keluar",
    rM1: "Laju aliran momentum masuk",
    rM2: "Laju aliran momentum keluar",
    rFx: "Gaya tumpuan searah aliran masuk",
    rFy: "Gaya tumpuan tegak lurus aliran masuk",
    rR: "Resultan gaya tumpuan",
    rArah: "Arah resultan terhadap aliran masuk",
    rBagi: "Bagian resultan yang berasal dari tekanan",
    tekananKuasa: "Tekanan yang menentukan",
    momentumKuasa: "Momentum yang menentukan",
    takAda: "Pipa lurus berpenampang tetap, tidak ada gaya",
    labelCV: "volume kendali",
    labelMasuk: "p₁A₁ + ρQV₁",
    labelKeluar: "p₂A₂ + ρQV₂",
    labelGaya: "gaya tumpuan",
    rH2: "Tinggi tekan di penampang keluar",
    bandMom: "Momentum menentukan",
    bandTek: "Tekanan menentukan",
    kavitasi: "Kavitasi di penampang keluar",
    lebih100: "Rp/R lebih dari 100 %",
    sState: (R: string, a: string, k: string) => `Tumpuan menahan R = ${R} kN pada α = ${a}°; ${k}.`,
    sNol: "Tidak ada gaya yang perlu ditahan tumpuan: pipanya lurus dan penampangnya tetap, jadi yang masuk sama dengan yang keluar.",
    sKav: (h2: string) =>
      `Tinggi tekan di penampang keluar yang dituntut hitungan, ${h2} m, berada di bawah tekanan uap. Air mendidih di sana dan gaya tekanannya tidak dapat terjadi, jadi gaya tumpuannya ditulis “—”.`,
    kavNote: "Perbesar diameter keluar, kurangi debit, atau naikkan tinggi tekan masuk supaya tekanan di penampang keluar tetap di atas tekanan uap.",
    nDiam: (R: string, Rd: string, pct: string) =>
      `Hentikan airnya dan biarkan tekanannya tetap: R turun dari ${R} ke ${Rd} kN, masih ${pct} % dari semula. Angkurnya ditentukan uji tekan, bukan alirannya.`,
    nNolTekanan: "Tanpa tekanan di penampang masuk, seluruh gaya tumpuannya berasal dari momentum aliran.",
    nSudut: (siku: string, balik: string, rasio: string) =>
      `Belokan siku menuntut ${siku} kN dan belokan berbalik arah ${balik} kN, ${rasio} kali.`,
    nAkar2: "Pada penampang tetap nisbah itu √2 ≈ 1,41, karena R = 2F sin(θ/2) dengan F = pA + ρQV: berbalik arah menuntut dua kali gaya satu penampang, bukan dua kali gaya belokan siku.",
    nLebih100:
      "Bagian tekanan lebih dari 100 %: resultan tekanan saja lebih besar daripada resultan seluruhnya, karena suku momentum di sini melawan suku tekanan. Definisi bagian ini masih menunggu perbaikan model.",
    jV: "Kecepatan di kedua penampang",
    jH2: "Tinggi tekan di penampang keluar (Borda-Carnot atau penyempitan)",
    jP1: "Gaya tekanan di penampang masuk",
    jP2: "Gaya tekanan di penampang keluar",
    jM1: "Laju aliran momentum masuk",
    jM2: "Laju aliran momentum keluar",
    jFx: "Gaya tumpuan searah aliran masuk",
    jFy: "Gaya tumpuan tegak lurus aliran masuk",
    jR: "Resultan",
    jA: "Arah resultan",
    note:
      "Kekuatan prinsip momentum terletak pada apa yang tidak ditanyakannya. Ia tidak menanyakan bentuk belokannya, kekasaran dindingnya, pusaran yang terjadi di sudutnya, atau berapa energi yang hilang di dalamnya. Yang ditanyakannya hanya apa yang masuk menembus batas dan apa yang keluar menembus batas, dan selisih keduanya adalah gaya. Itu sebabnya prinsip ini masih menjawab pada persoalan yang persamaan energinya sama sekali tidak dapat dipakai, misalnya loncatan air, yang kehilangan energinya justru menjadi pertanyaan, bukan jawaban. Dua hal yang perlu diingat saat memakainya. Pertama, ia persamaan vektor, bukan skalar, jadi arahnya ikut diperhitungkan: belokan berbalik arah menuntut √2 ≈ 1,41 kali gaya belokan siku, dan dua kali gaya satu penampangnya (pA + ρQV). Kedua, pada pipa bertekanan suku tekanan hampir selalu jauh lebih besar daripada suku momentum, sering tiga puluh kali lipat, sehingga angkur belokan sebenarnya ditentukan oleh tekanan ujinya, bukan oleh alirannya. Pipa yang diuji bertekanan sementara airnya diam tetap menuntut angkur yang hampir sama besarnya.",
  },
  en: {
    title: "Momentum principle",
    sheetTitle: "A control volume at a pipe bend, seen from above",
    dQ: "Discharge",
    dD1: "Inlet diameter",
    dD2: "Outlet diameter",
    dH: "Pressure head at the inlet",
    dSudut: "Bend angle",
    pSiku: "Right-angle bend",
    pBalik: "Bend reversing the flow",
    pKecil: "Unpressurized pipe, momentum only",
    rV1: "Inlet velocity",
    rV2: "Outlet velocity",
    rP1: "Pressure force at the inlet",
    rP2: "Pressure force at the outlet",
    rM1: "Momentum flux in",
    rM2: "Momentum flux out",
    rFx: "Support force along the inflow",
    rFy: "Support force across the inflow",
    rR: "Resultant support force",
    rArah: "Direction of the resultant from the inflow",
    rBagi: "Share of the resultant coming from pressure",
    tekananKuasa: "Pressure decides",
    momentumKuasa: "Momentum decides",
    takAda: "Straight pipe of constant section, no force at all",
    labelCV: "control volume",
    labelMasuk: "p₁A₁ + ρQV₁",
    labelKeluar: "p₂A₂ + ρQV₂",
    labelGaya: "support force",
    rH2: "Pressure head at the outlet",
    bandMom: "Momentum decides",
    bandTek: "Pressure decides",
    kavitasi: "Cavitation at the outlet",
    lebih100: "Rp/R above 100 %",
    sState: (R: string, a: string, k: string) => `The support resists R = ${R} kN at α = ${a}°; ${k}.`,
    sNol: "There is no force for the support to resist: the pipe is straight and its section constant, so what enters equals what leaves.",
    sKav: (h2: string) =>
      `The outlet pressure head the calculation demands, ${h2} m, is below vapour pressure. The water boils there and that pressure force cannot occur, so the support force is shown as “—”.`,
    kavNote: "Enlarge the outlet diameter, reduce the discharge, or raise the inlet pressure head so the outlet pressure stays above vapour pressure.",
    nDiam: (R: string, Rd: string, pct: string) =>
      `Stop the water and keep the pressure: R falls from ${R} to ${Rd} kN, still ${pct} % of what it was. The anchor is sized by the pressure test, not by the flow.`,
    nNolTekanan: "With no pressure at the inlet, the whole support force comes from the momentum of the flow.",
    nSudut: (siku: string, balik: string, rasio: string) =>
      `A right-angle bend demands ${siku} kN and a reversing bend ${balik} kN, ${rasio} times as much.`,
    nAkar2: "At constant section that ratio is √2 ≈ 1.41, because R = 2F sin(θ/2) with F = pA + ρQV: reversing demands twice the force of one section, not twice the force of a right-angle bend.",
    nLebih100:
      "The pressure share is above 100 %: the pressure resultant alone is larger than the whole resultant, because the momentum term opposes the pressure term here. The definition of this share is still awaiting a model fix.",
    jV: "Velocity at both sections",
    jH2: "Pressure head at the outlet (Borda-Carnot or contraction)",
    jP1: "Pressure force at the inlet",
    jP2: "Pressure force at the outlet",
    jM1: "Momentum flux in",
    jM2: "Momentum flux out",
    jFx: "Support force along the inflow",
    jFy: "Support force across the inflow",
    jR: "Resultant",
    jA: "Direction of the resultant",
    note:
      "The strength of the momentum principle lies in what it does not ask. It does not ask the shape of the bend, the roughness of its wall, the eddies in its corner, or how much energy is lost inside. All it asks is what crosses the boundary going in and what crosses it going out, and the difference between the two is the force. That is why it still answers problems the energy equation cannot touch at all, the hydraulic jump among them, where the energy lost is the question rather than the answer. Two things to keep in mind when using it. First, it is a vector equation, not a scalar one, so direction counts: a reversing bend demands √2 ≈ 1.41 times the force of a right-angle bend, and twice the force of one section (pA + ρQV). Second, in a pressurized pipe the pressure term is almost always far larger than the momentum term, often thirtyfold, so a bend anchor is really sized by its test pressure and not by its flow. A pipe under a pressure test with the water standing still still demands very nearly the same anchor.",
  },
} as const;

const REFS = {
  id: [
    "Euler, L. (1750). Découverte d'un nouveau principe de mécanique.",
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, edisi ke-8, bab 3.",
    "Chow, V.T. (1959). Open-Channel Hydraulics, bab 3.",
    "Idelchik, I.E. (1996). Handbook of Hydraulic Resistance, edisi ke-3.",
  ],
  en: [
    "Euler, L. (1750). Découverte d'un nouveau principe de mécanique.",
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, 8th ed., ch. 3.",
    "Chow, V.T. (1959). Open-Channel Hydraulics, ch. 3.",
    "Idelchik, I.E. (1996). Handbook of Hydraulic Resistance, 3rd ed.",
  ],
} as const;

export function PrinsipMomentumClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Q, setQ] = useState(0.5);
  const [D1, setD1] = useState(0.5);
  const [D2, setD2] = useState(0.5);
  const [head, setHead] = useState(60);
  const [sudut, setSudut] = useState(90);

  const r = momentumForce(Q, D1, D2, head, sudut);
  const panjang = Math.max(D1, D2) * 3;
  const geo = bendGeometry(D1, D2, sudut, panjang);
  /*
   * Tanpa gaya sama sekali, pertanyaan "tekanan atau momentum yang
   * menentukan" tidak punya jawaban. Bagian tekanannya sendiri jatuh ke
   * seratus persen hanya karena nol dibagi nol diberi nilai satu, dan
   * kepala gambar yang menyatakannya membaca angka itu seolah temuan.
   */
  const adaGaya = r.resultant > 1;
  /* Kavitasi di penampang keluar: tinggi tekan yang dituntut di bawah
     tekanan uap, jadi gaya tekanan p₂A₂ (dan semua gaya sesudahnya) tidak
     dapat terjadi. Ditulis "—" lewat NaN. */
  const kav = r.cavitates;
  const tampil = (v: number) => (kav ? NaN : v);
  const satuan = (u: string) => (kav ? undefined : u);
  const tekananKuasa = r.pressureShare > 0.8;
  const keadaan = kav
    ? x.kavitasi
    : !adaGaya
      ? x.takAda
      : tekananKuasa
        ? x.tekananKuasa
        : x.momentumKuasa;
  const hL = r.expansionLoss + r.contractionLoss;
  const RHO = 1000;

  const ref = useCanvas(
    (ctx, w, ch) => {
      const badan = bendPlan(D1, D2, sudut, panjang, panjang);

      /*
       * Batas volume kendalinya digambar BERSARANG di dalam pipanya, karena
       * volume kendali di sini memang airnya sendiri: dinding pipa sebagai
       * batas sampingnya, dan dua penampang sebagai batas masuk keluarnya.
       * Jari-jari belokannya dipakai ulang supaya kedua bentuk itu benar
       * benar sejajar dan bukan sekadar mirip. Bagian dalamnya sengaja
       * dibiarkan kosong, karena itulah pokok lembar ini.
       */
      const dalam = bendPlan(
        D1 * 0.78,
        D2 * 0.78,
        sudut,
        panjang * 0.9,
        panjang * 0.9,
        geo.radius
      );
      const kotak: StructureLine[] = [
        {
          /* Ditutup kembali ke titik awalnya. Digambar sebagai garis, bentuk
             ini kehilangan ruas penutupnya, dan penampang MASUK volume
             kendalinya, yaitu separuh dari seluruh pokok lembar ini, tidak
             pernah tergambar. */
          pts: [...dalam, dalam[0]],
          color: C.ink3,
          weight: W.thin,
          dash: DASH.hidden,
          label: x.labelCV,
          labelAt: 0.5,
          labelDy: -8,
          labelAlign: "center",
        },
      ];

      /* Panah diskalakan pada yang terbesar di antaranya, supaya
         perbandingan panjangnya benar-benar berarti. */
      const masuk = r.pressureForce1 + r.momentumIn;
      const keluar = r.pressureForce2 + r.momentumOut;
      const besar = Math.max(masuk, keluar, r.resultant, 1e-9);
      const k = 72 / besar;

      /* Titik tengah busur belokannya, tempat resultannya ditangkap. */
      const tengah = bendGeometry(D1, D2, sudut / 2, 0);

      const panah: StructureVector[] = [
        {
          x: -panjang,
          z: 0,
          dx: masuk * k,
          dy: 0,
          text: x.labelMasuk,
          color: C.water,
        },
        {
          x: geo.outlet.x,
          z: geo.outlet.z,
          dx: keluar * k * geo.direction.x,
          dy: -keluar * k * geo.direction.z,
          text: x.labelKeluar,
          color: C.water,
        },
        {
          x: tengah.outlet.x,
          z: tengah.outlet.z,
          dx: r.Fx * k,
          dy: -r.Fy * k,
          text: `${x.labelGaya} ${fmtPlain(r.resultant / 1000, 1)} kN`,
          color: C.energy,
          root: true,
        },
      ];

      /*
       * Bidangnya memuat UJUNG PANAH, bukan hanya pipanya. Panah laju aliran
       * momentum di penampang keluar menjulur searah alirannya, dan pada
       * belokan siku ia menembus bingkai atas bersama namanya, lalu kepala
       * gambar jatuh menimpa ujung pipa.
       */
      const semua = [
        ...badan,
        geo.outlet,
        { x: -panjang, z: 0 },
        {
          x: geo.outlet.x + geo.direction.x * panjang * 0.9,
          z: geo.outlet.z + geo.direction.z * panjang * 0.9,
        },
        { x: -panjang * 1.6, z: 0 },
      ];
      const lebarBidang = Math.max(D1, D2);
      const xs = semua.map((p) => p.x);
      const zs = semua.map((p) => p.z);
      drawStructure(
        ctx,
        w,
        ch,
        {
          xMin: Math.min(...xs) - lebarBidang,
          xMax: Math.max(...xs) + lebarBidang,
          zMin: Math.min(...zs) - lebarBidang,
          zMax: Math.max(...zs) + lebarBidang * 2.2,
          bodies: [{ pts: badan, hatch: "none", outline: true }],
          lines: kotak,
          vectors: panah,
          heading: keadaan,
          /* Merah sinyal hanya saat kavitasi: di luar rentang berlaku. */
          headingColor: kav ? C.signal : undefined,
          axisX: T.planView,
          axisZ: T.planView,
        },
        lang
      );
    },
    [Q, D1, D2, head, sudut, lang]
  );

  return (
    <LabShell
      status={
        /* Batas 80 % adalah batas definisi Client, tanpa sumber
           literatur. pressureShare dari model bisa melewati 100 % (resultan
           tekanan saja dibagi resultan total); skalanya tetap 0 sampai 100
           dan nilai di atasnya ditandai di luar skala dengan alasannya. */
        <RegimeScale
          symbol="Rp/R"
          value={kav || !adaGaya ? NaN : r.pressureShare * 100}
          invalid={kav}
          pesan={kav ? x.kavitasi : !adaGaya ? x.takAda : r.pressureShare > 1 ? x.lebih100 : undefined}
          digits={1}
          bands={
            kav
              ? [{ from: 0, to: 100, label: x.kavitasi, tone: "invalid" }]
              : [
                  { from: 0, to: 80, label: x.bandMom, tone: "water" },
                  { from: 80, to: 100, label: x.bandTek, tone: "energy" },
                ]
          }
        />
      }
      sheet="FF-03"
      subject={SUBJECTS.FF[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Yang menentukan gaya hanya apa yang{" "}
            <Term tint={C.water}>menembus batas</Term> volume kendalinya. Apa
            yang terjadi <Term tint={C.energy}>di dalamnya</Term> tidak pernah
            ditanyakan.
          </p>
        ) : (
          <p>
            The force is set only by what{" "}
            <Term tint={C.water}>crosses the boundary</Term> of the control
            volume. What happens <Term tint={C.energy}>inside it</Term> is never
            asked.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FF-03"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (N, m, m³/s)" },
            { label: "R", value: kav ? "—" : `${fmt(r.resultant / 1000, 1)} kN`, tint: kav ? C.signal : C.energy },
            { label: "θ", value: `${fmt(sudut, 0)}°` },
            { label: "V₁", value: `${fmt(r.velocity1, 2)} m/s`, tint: C.water },
            { label: "Rp/R", value: adaGaya && !kav ? `${fmt(r.pressureShare * 100, 0)} %` : "—" },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q * 1000} min={10} max={3000} step={10} digits={0} unit="l/s" onChange={(v) => setQ(v / 1000)} tint={C.water} />
              <InputRow symbol="D₁" label={x.dD1} value={D1 * 1000} min={100} max={1200} step={25} digits={0} unit="mm" onChange={(v) => setD1(v / 1000)} />
              <InputRow symbol="D₂" label={x.dD2} value={D2 * 1000} min={100} max={1200} step={25} digits={0} unit="mm" onChange={(v) => setD2(v / 1000)} />
              <InputRow symbol="h₁" label={x.dH} value={head} min={0} max={200} step={2} digits={0} unit="m" onChange={setHead} tint={C.energy} />
              <InputRow symbol="θ" label={x.dSudut} value={sudut} min={0} max={180} step={5} digits={0} unit="°" onChange={setSudut} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pSiku, apply: () => { setQ(0.5); setD1(0.5); setD2(0.5); setHead(60); setSudut(90); } },
                  { label: x.pBalik, apply: () => { setQ(0.5); setD1(0.5); setD2(0.5); setHead(60); setSudut(180); } },
                  { label: x.pKecil, apply: () => { setQ(0.5); setD1(0.5); setD2(0.5); setHead(0); setSudut(90); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "V₁", label: x.rV1, value: fmt(r.velocity1, 3), unit: "m/s", tint: C.water },
                { symbol: "V₂", label: x.rV2, value: fmt(r.velocity2, 3), unit: "m/s", tint: C.water },
                { symbol: "h₂", label: x.rH2, value: fmt(tampil(r.head2), 2), unit: satuan("m"), tint: kav ? C.signal : undefined },
                { symbol: "p₁A₁", label: x.rP1, value: fmt(r.pressureForce1 / 1000, 2), unit: "kN" },
                { symbol: "p₂A₂", label: x.rP2, value: fmt(tampil(r.pressureForce2 / 1000), 2), unit: satuan("kN") },
                { symbol: "ρQV₁", label: x.rM1, value: fmt(r.momentumIn / 1000, 3), unit: "kN" },
                { symbol: "ρQV₂", label: x.rM2, value: fmt(r.momentumOut / 1000, 3), unit: "kN" },
                { symbol: "Fx", label: x.rFx, value: fmt(tampil(r.Fx / 1000), 2), unit: satuan("kN") },
                { symbol: "Fy", label: x.rFy, value: fmt(tampil(r.Fy / 1000), 2), unit: satuan("kN") },
                { symbol: "R", label: x.rR, value: fmt(tampil(r.resultant / 1000), 2), unit: satuan("kN"), tint: kav ? C.signal : C.energy, strong: true },
                { symbol: "α", label: x.rArah, value: adaGaya ? fmt(tampil(r.direction), 1) : "—", unit: adaGaya ? satuan("°") : undefined },
                { symbol: "Rp/R", label: x.rBagi, value: adaGaya ? fmt(tampil(r.pressureShare * 100), 1) : "—", unit: adaGaya ? satuan("%") : undefined, strong: true },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.jV,
                    rumus: (<><span>V₁ =</span><Frac num="Q" den="π · D₁² / 4" /><span className="ml-3">V₂ =</span><Frac num="Q" den="π · D₂² / 4" /></>),
                    isi: `${fmt(Q, 2)} / ( π · ${fmt(D1, 3)}² / 4 ) ;  ${fmt(Q, 2)} / ( π · ${fmt(D2, 3)}² / 4 )`,
                    hasil: `${fmt(r.velocity1, 3)} ; ${fmt(r.velocity2, 3)}`,
                    satuan: "m/s",
                    tint: C.water,
                  },
                  {
                    judul: x.jH2,
                    rumus: (<><span>h₂ = h₁ +</span><Frac num="V₁² − V₂²" den="2 · g" /><span>− hL</span></>),
                    isi: `${fmt(head, 0)} + ( ${fmt(r.velocity1, 4)}² − ${fmt(r.velocity2, 4)}² ) / ( 2 · ${fmt(G, 2)} ) − ${fmt(hL, 4)}`,
                    hasil: fmt(tampil(r.head2), 2),
                    satuan: satuan("m"),
                    tint: kav ? C.signal : undefined,
                  },
                  {
                    judul: x.jP1,
                    rumus: <span>p₁A₁ = ρ · g · h₁ · A₁</span>,
                    isi: `${fmt(RHO, 0)} · ${fmt(G, 2)} · ${fmt(head, 0)} · ${fmt(r.area1, 5)} / 1000`,
                    hasil: fmt(r.pressureForce1 / 1000, 2),
                    satuan: "kN",
                  },
                  {
                    judul: x.jP2,
                    rumus: <span>p₂A₂ = ρ · g · h₂ · A₂</span>,
                    isi: kav ? "—" : `${fmt(RHO, 0)} · ${fmt(G, 2)} · ${fmt(r.head2, 3)} · ${fmt(r.area2, 5)} / 1000`,
                    hasil: fmt(tampil(r.pressureForce2 / 1000), 2),
                    satuan: satuan("kN"),
                  },
                  {
                    judul: x.jM1,
                    rumus: <span>ρQV₁</span>,
                    isi: `${fmt(RHO, 0)} · ${fmt(Q, 2)} · ${fmt(r.velocity1, 4)} / 1000`,
                    hasil: fmt(r.momentumIn / 1000, 3),
                    satuan: "kN",
                    tint: C.water,
                  },
                  {
                    judul: x.jM2,
                    rumus: <span>ρQV₂</span>,
                    isi: `${fmt(RHO, 0)} · ${fmt(Q, 2)} · ${fmt(r.velocity2, 4)} / 1000`,
                    hasil: fmt(r.momentumOut / 1000, 3),
                    satuan: "kN",
                    tint: C.water,
                  },
                  {
                    judul: x.jFx,
                    rumus: <span>Fx = p₁A₁ + ρQV₁ − ( p₂A₂ + ρQV₂ ) · cos θ</span>,
                    isi: kav
                      ? "—"
                      : `${fmt(r.pressureForce1 / 1000, 3)} + ${fmt(r.momentumIn / 1000, 4)} − ( ${fmt(r.pressureForce2 / 1000, 3)} + ${fmt(r.momentumOut / 1000, 4)} ) · cos ${fmt(sudut, 0)}°`,
                    hasil: fmt(tampil(r.Fx / 1000), 2),
                    satuan: satuan("kN"),
                  },
                  {
                    judul: x.jFy,
                    rumus: <span>Fy = −( p₂A₂ + ρQV₂ ) · sin θ</span>,
                    isi: kav
                      ? "—"
                      : `−( ${fmt(r.pressureForce2 / 1000, 3)} + ${fmt(r.momentumOut / 1000, 4)} ) · sin ${fmt(sudut, 0)}°`,
                    hasil: fmt(tampil(r.Fy / 1000), 2),
                    satuan: satuan("kN"),
                  },
                  {
                    judul: x.jR,
                    rumus: <span>R = √( Fx² + Fy² )</span>,
                    isi: kav ? "—" : `√( ${fmt(r.Fx / 1000, 3)}² + ${fmt(r.Fy / 1000, 3)}² )`,
                    hasil: fmt(tampil(r.resultant / 1000), 2),
                    satuan: satuan("kN"),
                    tint: kav ? C.signal : C.energy,
                  },
                  {
                    judul: x.jA,
                    rumus: <span>α = atan2( Fy, Fx )</span>,
                    isi: kav || !adaGaya ? "—" : `atan2( ${fmt(r.Fy / 1000, 3)}, ${fmt(r.Fx / 1000, 3)} )`,
                    hasil: adaGaya ? fmt(tampil(r.direction), 1) : "—",
                    satuan: adaGaya ? satuan("°") : undefined,
                  },
                ]}
              />
            </div>
          </Block>

          {kav ? (
            <StateCard
              tone="invalid"
              badge={x.kavitasi}
              state={x.sKav(fmt(r.head2, 1))}
              notice={[x.kavNote]}
            />
          ) : (
            <StateCard
              tone={!adaGaya ? "neutral" : tekananKuasa ? "energy" : "water"}
              badge={keadaan}
              state={
                adaGaya
                  ? x.sState(fmt(r.resultant / 1000, 1), fmt(r.direction, 1), keadaan.charAt(0).toLowerCase() + keadaan.slice(1))
                  : x.sNol
              }
              notice={notice(Q, D1, D2, head, sudut, lang)}
            />
          )}
        </>
      }
      verification={<Verification checks={checksMomentum(Q, D1, D2, head, sudut)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>ΣF = ρQ(V₂ − V₁)</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "persamaan vektor, bukan skalar"
                    : "a vector equation, not a scalar one"}
                </span>
              </Eq>
              <Eq>
                <span>Fx = p₁A₁ + ρQV₁ − (p₂A₂ + ρQV₂) cos θ</span>
              </Eq>
              <Eq>
                <span>Fy = −(p₂A₂ + ρQV₂) sin θ</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "isi volume kendalinya tidak muncul di mana pun"
                    : "nothing inside the control volume appears anywhere"}
                </span>
              </Eq>
              <Eq>
                <Frac num="ρQV" den="pA" />
                <span className="ml-3 text-ink-3">
                  {lang === "id"
                    ? "nisbah inilah yang menentukan mana yang perlu dihitung teliti"
                    : "this ratio decides which term is worth computing carefully"}
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
 * Butir (a) hanya ditulis bila ada tekanan dan tekanan memang menentukan;
 * butir (b) menulis nisbah yang dihitung, bukan "dua kali". Nisbah √2
 * hanya disebut untuk penampang tetap, tempat R = 2F sin(θ/2) berlaku.
 */
function notice(
  Q: number,
  D1: number,
  D2: number,
  head: number,
  sudut: number,
  lang: Lang
): string[] {
  const x = TXT[lang];
  const a = momentumForce(Q, D1, D2, head, sudut);
  const diam = momentumForce(1e-9, D1, D2, head, sudut);
  const balik = momentumForce(Q, D1, D2, head, 180);
  const siku = momentumForce(Q, D1, D2, head, 90);
  const out: string[] = [];
  if (a.resultant > 1 && head > 0 && a.pressureShare >= 0.8)
    out.push(
      x.nDiam(
        fmt(a.resultant / 1000, 1),
        fmt(diam.resultant / 1000, 1),
        fmt((diam.resultant / a.resultant) * 100, 0)
      )
    );
  if (head === 0) out.push(x.nNolTekanan);
  if (siku.resultant > 1)
    out.push(
      x.nSudut(
        fmt(siku.resultant / 1000, 1),
        fmt(balik.resultant / 1000, 1),
        fmt(balik.resultant / siku.resultant, 2)
      )
    );
  if (D1 === D2) out.push(x.nAkar2);
  if (a.resultant > 1 && a.pressureShare > 1) out.push(x.nLebih100);
  return out;
}
