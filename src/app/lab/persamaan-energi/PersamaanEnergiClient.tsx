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
  type StructureDim,
  type StructureLine,
} from "@/lib/drawStructure";
import { G, ductEnergy, fmt, fmtPlain, type DuctStation } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksDuct } from "@/lib/checks";

const TXT = {
  id: {
    title: "Persamaan energi",
    sheetTitle: "Ke mana tinggi energi pergi di sepanjang pipa penghubung",
    dH: "Beda muka air kedua kolam",
    dL: "Panjang pipa",
    dD: "Diameter pipa",
    dF: "Faktor gesekan Darcy",
    dK: "Koefisien kehilangan katup",
    pPendek: "Pipa pendek, kehilangan setempat berkuasa",
    pPanjang: "Pipa panjang, gesekan berkuasa",
    pKatup: "Katup setengah tertutup",
    rQ: "Debit yang terjadi",
    rV: "Kecepatan aliran",
    rHf: "Kehilangan gesekan",
    rHk: "Kehilangan setempat",
    rHv: "Tinggi kecepatan di ujung",
    rBagi: "Bagian gesekan dari seluruh tinggi",
    gesekanKuasa: "Gesekan sepanjang pipa yang berkuasa",
    setempatKuasa: "Kehilangan setempat yang berkuasa",
    labelEntry: "kehilangan masuk",
    labelValve: "katup",
    labelBend: "belokan",
    unitCell: "SI (m, l/s)",
    bandSetempat: "Kehilangan setempat berkuasa",
    bandGesekan: "Gesekan berkuasa",
    kavitasi: "Kavitasi di pipa",
    sState: (judul: string, hf: string, hk: string, H: string, Q: string) =>
      `${judul}: hf ${hf} m dan ΣhK ${hk} m dari ΔH ${H} m, Q ${Q} l/s.`,
    sKav: (xm: string) =>
      `Tekanan mutlak di pipa (x = ${xm} m) turun sampai tekanan uap, jadi air mendidih di sana. Debit yang dituntut beda muka air ini tidak dapat terjadi karena kavitasi membatasinya, maka debit, kecepatan, dan kehilangannya ditulis “—”.`,
    kavNote:
      "Tekanan terendah ada di mulut pipa, tempat tinggi kecepatan dan kehilangan masuk diambil dari tinggi tekan. Kecilkan beda muka air, perpanjang pipa, atau tambah kehilangan katup supaya kecepatannya turun.",
    nPendek: (L: string, b: string, kuasa: boolean) =>
      `Pendekkan pipa menjadi ${L} m: bagian gesekan menjadi ${b} %, ${kuasa ? "gesekan masih berkuasa" : "sekarang kehilangan setempat yang berkuasa"}.`,
    nPanjang: (L: string, b: string, Q: string, kuasa: boolean) =>
      `Panjangkan pipa menjadi ${L} m: bagian gesekan menjadi ${b} % dan debitnya ${Q} l/s, ${kuasa ? "gesekan yang berkuasa" : "kehilangan setempat masih berkuasa"}.`,
    nKav: (L: string) => `Pada panjang ${L} m pipanya berkavitasi, jadi perbandingannya tidak ditulis.`,
    nTetap:
      "Nisbah hf terhadap ΣhK tidak bergantung pada debit, karena keduanya sebanding dengan tinggi kecepatan yang sama.",
    jK: "Jumlah koefisien kehilangan setempat (masuk + katup + belokan)",
    jV: "Kecepatan dari beda muka air",
    jQ: "Debit",
    jHf: "Kehilangan gesekan",
    jHk: "Kehilangan setempat",
    jCek: "Pemeriksaan: kehilangan ditambah tinggi kecepatan di ujung sama dengan ΔH",
    jBagi: "Bagian gesekan",
    note:
      "Persamaan energi tidak lain persamaan Bernoulli yang jujur, yaitu Bernoulli dengan satu suku tambahan untuk energi yang tidak dapat dikembalikan. Suku tambahan itulah yang membuat lembar ini berbeda dari lembar sebelumnya: di sana garis energinya mendatar sempurna, di sini ia hanya boleh turun. Dua bentuk penurunannya perlu dibedakan karena keduanya menuntut perlakuan yang berbeda. Gesekan dinding menurunkannya sebagai kemiringan yang tetap, sebanding dengan panjang, jadi memperpanjang pipa selalu menambah biayanya. Kehilangan setempat menurunkannya sebagai anak tangga di satu titik, tidak peduli panjang pipanya, jadi pada pipa pendek justru anak tangga itulah yang menghabiskan hampir seluruh tinggi yang tersedia. Yang menyesatkan pada perhitungan yang tergesa adalah anggapan bahwa kehilangan setempat selalu kecil dan pantas diabaikan. Coba pendekkan pipanya di lembar ini sampai sepuluh meter dan perhatikan bagiannya. Keduanya kebetulan sebanding dengan tinggi kecepatan yang sama, jadi nisbah keduanya sama sekali tidak bergantung pada debit: sekali pipanya dikuasai kehilangan setempat, ia akan tetap begitu pada debit berapa pun.",
  },
  en: {
    title: "Energy equation",
    sheetTitle: "Where the total head goes along a connecting pipe",
    dH: "Difference between the two pool levels",
    dL: "Pipe length",
    dD: "Pipe diameter",
    dF: "Darcy friction factor",
    dK: "Valve loss coefficient",
    pPendek: "Short pipe, minor losses rule",
    pPanjang: "Long pipe, friction rules",
    pKatup: "Valve half closed",
    rQ: "Resulting discharge",
    rV: "Flow velocity",
    rHf: "Friction loss",
    rHk: "Minor losses",
    rHv: "Velocity head at the outlet",
    rBagi: "Share of the whole head taken by friction",
    gesekanKuasa: "Pipe friction rules",
    setempatKuasa: "Minor losses rule",
    labelEntry: "entry loss",
    labelValve: "valve",
    labelBend: "bend",
    unitCell: "SI (m, l/s)",
    bandSetempat: "Minor losses dominate",
    bandGesekan: "Friction dominates",
    kavitasi: "Cavitation in the pipe",
    sState: (judul: string, hf: string, hk: string, H: string, Q: string) =>
      `${judul}: hf ${hf} m and ΣhK ${hk} m out of ΔH ${H} m, Q ${Q} l/s.`,
    sKav: (xm: string) =>
      `The absolute pressure in the pipe (x = ${xm} m) falls to vapour pressure, so the water boils there. The discharge this level difference demands cannot occur because cavitation limits it, so discharge, velocity and losses are shown as “—”.`,
    kavNote:
      "The lowest pressure is at the pipe mouth, where the velocity head and the entry loss are taken out of the pressure head. Reduce the level difference, lengthen the pipe, or add valve loss so the velocity falls.",
    nPendek: (L: string, b: string, kuasa: boolean) =>
      `Shorten the pipe to ${L} m: friction's share becomes ${b} %, ${kuasa ? "friction still dominates" : "now the minor losses dominate"}.`,
    nPanjang: (L: string, b: string, Q: string, kuasa: boolean) =>
      `Lengthen the pipe to ${L} m: friction's share becomes ${b} % and the discharge ${Q} l/s, ${kuasa ? "friction dominates" : "minor losses still dominate"}.`,
    nKav: (L: string) => `At a length of ${L} m the pipe cavitates, so the comparison is not given.`,
    nTetap:
      "The ratio of hf to ΣhK does not depend on discharge, because both are proportional to the same velocity head.",
    jK: "Sum of minor loss coefficients (entry + valve + bend)",
    jV: "Velocity from the level difference",
    jQ: "Discharge",
    jHf: "Friction loss",
    jHk: "Minor losses",
    jCek: "Check: losses plus outlet velocity head equal ΔH",
    jBagi: "Friction share",
    note:
      "The energy equation is nothing but an honest Bernoulli, that is Bernoulli with one extra term for the energy that cannot be given back. That term is what separates this sheet from the last one: there the energy line was perfectly level, here it may only fall. Two forms of fall need to be told apart, because they ask for different treatment. Wall friction lowers it as a steady slope, proportional to length, so lengthening the pipe always adds to the bill. A minor loss lowers it as a step at one point, whatever the length, so on a short pipe it is the steps that consume nearly all the head available. What misleads a hurried calculation is the assumption that minor losses are always small and safely ignored. Try shortening the pipe on this sheet to ten metres and watch the share. Both happen to be proportional to the same velocity head, so their ratio does not depend on discharge at all: once a pipe is dominated by its fittings, it stays that way at every discharge.",
  },
} as const;

const REFS = {
  id: [
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, edisi ke-8, bab 5.",
    "Idelchik, I.E. (1996). Handbook of Hydraulic Resistance, edisi ke-3.",
    "Miller, D.S. (1990). Internal Flow Systems, edisi ke-2.",
    "Colebrook, C.F. (1939). Turbulent flow in pipes. J. Inst. Civ. Eng. 11, 133–156.",
  ],
  en: [
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, 8th ed., ch. 5.",
    "Idelchik, I.E. (1996). Handbook of Hydraulic Resistance, 3rd ed.",
    "Miller, D.S. (1990). Internal Flow Systems, 2nd ed.",
    "Colebrook, C.F. (1939). Turbulent flow in pipes. J. Inst. Civ. Eng. 11, 133–156.",
  ],
} as const;

const K_MASUK = 0.5;
const K_BELOK = 0.3;

/** Penampang-penampang pipanya, dengan katup di tengah dan belokan di tiga perempat. */
function pipa(L: number, D: number, H: number, Kv: number): DuctStation[] {
  /*
   * Pipa berangkat dari BAWAH muka air kolam hulu, menurun, lalu mendatar
   * di BAWAH muka air kolam hilir.
   *
   * Debitnya dicari dengan syarat garis tekanan di ujung pipa jatuh tepat di
   * muka air kolam hilir, dan syarat itu hanya berlaku bila ujungnya
   * terendam. Sebelumnya pipanya berakhir di tengah beda tinggi, tiga meter
   * DI ATAS muka air hilir, sehingga ujungnya sebenarnya mencurah bebas
   * sementara hitungannya menganggapnya terendam, dan separuh hilir pipanya
   * tergambar menghisap.
   */
  const zMasuk = -D * 1.5;
  const zKeluar = -H - D * 1.5;
  const z = (s: number) => zMasuk + (zKeluar - zMasuk) * Math.min(1, s * 1.6);
  return [
    { x: 0, z: z(0), D, K: K_MASUK },
    { x: L * 0.25, z: z(0.25), D },
    { x: L * 0.5, z: z(0.5), D, K: Kv },
    { x: L * 0.75, z: z(0.75), D, K: K_BELOK },
    { x: L, z: z(1), D },
  ];
}

/**
 * Debit yang benar-benar terjadi pada beda tinggi yang diberikan.
 *
 * Bukan penggeser. Debitnya TERIKAT oleh beda muka airnya, dan membiarkan
 * orang memilih debit sendiri akan membiarkannya memilih keadaan yang tidak
 * pernah ada. Dicari dengan membagi dua sampai garis tekanan di ujung
 * pipanya jatuh tepat di muka air kolam hilir.
 */
function debitAlami(L: number, D: number, H: number, Kv: number, f: number) {
  let lo = 0;
  let hi = 50;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const r = ductEnergy(mid, pipa(L, D, H, Kv), 0, f);
    const ujung = r.points[r.points.length - 1];
    /* Muka air hulu dijadikan acuan nol, jadi ujungnya harus mencapai −H. */
    if (ujung.hgl > -H) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function PersamaanEnergiClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [H, setH] = useState(6);
  const [L, setL] = useState(120);
  const [D, setD] = useState(0.25);
  const [f, setF] = useState(0.022);
  const [Kv, setKv] = useState(2);

  const stations = pipa(L, D, H, Kv);
  const Q = debitAlami(L, D, H, Kv, f);
  const r = ductEnergy(Q, stations, 0, f);
  const ujung = r.points[r.points.length - 1];
  const total = r.frictionLoss + r.minorLoss + ujung.velocityHead;
  const bagiGesekan = total > 0 ? r.frictionLoss / total : 0;
  /* Kavitasi: tekanan mutlak di suatu tempat (biasanya mulut pipa) jatuh
     ke tekanan uap. Debit yang dituntut ΔH tidak dapat terjadi, jadi semua
     besaran yang bergantung padanya ditulis "—" lewat NaN. Nisbah hf/ΣhK
     tidak bergantung debit, tetapi pitanya juga dipadamkan (spesifikasi). */
  const kav = r.cavitates;
  const tampil = (v: number) => (kav ? NaN : v);
  const satuan = (u: string) => (kav ? undefined : u);
  const SK = K_MASUK + Kv + K_BELOK;
  const gesekKuasa = bagiGesekan >= 0.5;

  /*
   * Kedua garis digambar bertangga: di penampang yang punya perlengkapan,
   * satu titik sebelum kehilangannya dan satu titik sesudahnya, pada absis
   * yang sama.
   *
   * Sebelumnya garisnya menghubungkan nilai sesudah-kehilangan dari satu
   * penampang ke penampang berikutnya, sehingga setiap anak tangga tergambar
   * sebagai kemiringan yang menyatu dengan kemiringan gesekan. Padahal
   * membedakan keduanya justru satu-satunya pokok lembar ini, dan kalimat
   * pengantarnya sendiri menyebut anak tangga.
   */
  const bertangga = (pilih: "egl" | "hgl") => {
    const out: { x: number; z: number }[] = [];
    r.points.forEach((p, i) => {
      const hk = (stations[i].K ?? 0) * p.velocityHead;
      if (hk > 0) out.push({ x: p.x, z: p[pilih] + hk });
      out.push({ x: p.x, z: p[pilih] });
    });
    return out;
  };

  const ref = useCanvas(
    (ctx, w, ch) => {
      const atas = r.points.map((p) => ({ x: p.x, z: p.z + p.D / 2 }));
      const bawah = r.points.map((p) => ({ x: p.x, z: p.z - p.D / 2 }));

      const garis: StructureLine[] = [
        {
          pts: [
            { x: -L * 0.06, z: 0 },
            { x: L * 1.06, z: 0 },
          ],
          color: C.ink3,
          weight: W.hair,
          dash: DASH.axis,
          label: T.upstream,
          labelAt: 0.02,
          labelDy: -9,
          labelAlign: "left",
        },
        /* Muka air kolam hilir, tempat garis tekanan di ujung pipa jatuh. */
        {
          pts: [
            { x: L * 0.86, z: -H },
            { x: L * 1.06, z: -H },
          ],
          color: C.ink3,
          weight: W.hair,
          dash: DASH.axis,
          label: T.downstream,
          labelAt: 1,
          labelDy: -9,
          labelAlign: "right",
        },
        {
          pts: bertangga("egl"),
          color: C.energy,
          weight: W.bold,
          dash: DASH.solid,
          label: T.energyGrade,
          labelAt: 0.42,
          labelDy: -10,
          labelAlign: "center",
        },
        {
          pts: bertangga("hgl"),
          color: C.water,
          weight: W.bold,
          dash: DASH.hidden,
          label: T.hydraulicGrade,
          labelAt: 0.74,
          labelDy: 15,
          labelAlign: "center",
        },
        { pts: atas, color: C.ink, weight: W.bold, dash: DASH.solid },
        { pts: bawah, color: C.ink, weight: W.bold, dash: DASH.solid },
      ];

      /* Kehilangan gesekan dan kehilangan setempat, masing-masing diukur di
         tempat kejadiannya sendiri: gesekan sebagai selisih seluruh garis
         energi yang bukan anak tangga, kehilangan setempat pada anak
         tangganya di katup. */
      const dims: StructureDim[] = [
        {
          axis: "v",
          at: L,
          from: ujung.egl,
          to: ujung.egl + r.frictionLoss,
          text: `hf ${fmtPlain(r.frictionLoss, 2)} m`,
          color: C.energy,
          offset: 30,
        },
        {
          axis: "v",
          at: L * 0.5,
          from: r.points[2].egl,
          to: r.points[2].egl + Kv * r.points[2].velocityHead,
          text: `hK ${fmtPlain(Kv * r.points[2].velocityHead, 2)} m`,
          color: C.critical,
          offset: 26,
        },
      ];

      const zMin =
        Math.min(ujung.z - D, ujung.egl, -H) - Math.max(0.6, H * 0.14);
      drawStructure(
        ctx,
        w,
        ch,
        {
          xMin: -L * 0.08,
          xMax: L * 1.1,
          zMin,
          zMax: Math.max(0.6, H * 0.18),
          equalScale: false,
          bodies: [],
          lines: garis,
          callouts: [
            { x: 0, z: 0, dx: 18, dy: 22, text: x.labelEntry },
            { x: L * 0.5, z: r.points[2].egl, dx: -12, dy: -24, text: x.labelValve },
            { x: L * 0.75, z: r.points[3].z, dx: 14, dy: 24, text: x.labelBend },
          ],
          dims,
          heading: kav ? x.kavitasi : gesekKuasa ? x.gesekanKuasa : x.setempatKuasa,
          /* Merah sinyal hanya saat kavitasi: di luar rentang berlaku. */
          headingColor: kav ? C.signal : undefined,
          axisX: T.axAlongDuct,
          axisZ: T.axHeadM,
        },
        lang
      );
    },
    [H, L, D, f, Kv, lang]
  );

  return (
    <LabShell
      status={
        /* Batas 50 % adalah batas definisi "berkuasa" (tanpa sumber
           literatur), sama dengan yang dipakai judul gambar. */
        <RegimeScale
          symbol="hf/ΔH"
          value={kav ? NaN : bagiGesekan * 100}
          invalid={kav}
          pesan={kav ? x.kavitasi : undefined}
          digits={1}
          bands={
            kav
              ? [{ from: 0, to: 100, label: x.kavitasi, tone: "invalid" }]
              : [
                  { from: 0, to: 50, label: x.bandSetempat, tone: "critical" },
                  { from: 50, to: 100, label: x.bandGesekan, tone: "energy" },
                ]
          }
        />
      }
      sheet="FF-02"
      subject={SUBJECTS.FF[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Garis energi di sini <Term tint={C.energy}>hanya boleh turun</Term>,
            dan turunnya dengan dua cara: sebagai{" "}
            <Term tint={C.energy}>kemiringan tetap</Term> karena gesekan, dan
            sebagai <Term tint={C.critical}>anak tangga</Term> di setiap katup
            dan belokan.
          </p>
        ) : (
          <p>
            The energy line here <Term tint={C.energy}>may only fall</Term>, and
            it falls in two ways: as a{" "}
            <Term tint={C.energy}>steady slope</Term> from friction, and as a{" "}
            <Term tint={C.critical}>step</Term> at every valve and bend.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FF-02"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: x.unitCell },
            { label: "Q", value: kav ? "—" : `${fmt(Q * 1000, 1)} l/s`, tint: kav ? C.signal : C.water },
            { label: "hf", value: kav ? "—" : `${fmt(r.frictionLoss, 2)} m`, tint: C.energy },
            { label: "ΣhK", value: kav ? "—" : `${fmt(r.minorLoss, 2)} m`, tint: C.critical },
            { label: "V²/2g", value: kav ? "—" : `${fmt(ujung.velocityHead, 3)} m` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="ΔH" label={x.dH} value={H} min={0.5} max={40} step={0.5} digits={1} unit="m" onChange={setH} tint={C.energy} />
              <InputRow symbol="L" label={x.dL} value={L} min={10} max={2000} step={10} digits={0} unit="m" onChange={setL} />
              <InputRow symbol="D" label={x.dD} value={D * 1000} min={50} max={900} step={10} digits={0} unit="mm" onChange={(v) => setD(v / 1000)} />
              <InputRow symbol="f" label={x.dF} value={f} min={0.008} max={0.08} step={0.001} digits={3} onChange={setF} />
              <InputRow symbol="K" label={x.dK} value={Kv} min={0} max={40} step={0.5} digits={1} onChange={setKv} tint={C.critical} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pPendek, apply: () => { setH(6); setL(10); setD(0.25); setF(0.022); setKv(2); } },
                  { label: x.pPanjang, apply: () => { setH(6); setL(1200); setD(0.25); setF(0.022); setKv(2); } },
                  { label: x.pKatup, apply: () => { setH(6); setL(120); setD(0.25); setF(0.022); setKv(30); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "Q", label: x.rQ, value: fmt(tampil(Q * 1000), 2), unit: satuan("l/s"), tint: kav ? C.signal : C.water, strong: true },
                { symbol: "V", label: x.rV, value: fmt(tampil(ujung.velocity), 3), unit: satuan("m/s") },
                { symbol: "hf", label: x.rHf, value: fmt(tampil(r.frictionLoss), 3), unit: satuan("m"), tint: C.energy, strong: true },
                { symbol: "ΣhK", label: x.rHk, value: fmt(tampil(r.minorLoss), 3), unit: satuan("m"), tint: C.critical, strong: true },
                { symbol: "V²/2g", label: x.rHv, value: fmt(tampil(ujung.velocityHead), 4), unit: satuan("m") },
                { symbol: "hf/ΔH", label: x.rBagi, value: fmt(tampil(bagiGesekan * 100), 1), unit: satuan("%") },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.jK,
                    rumus: <span>ΣK = {fmt(K_MASUK, 1)} + K + {fmt(K_BELOK, 1)}</span>,
                    isi: `${fmt(K_MASUK, 1)} + ${fmt(Kv, 1)} + ${fmt(K_BELOK, 1)}`,
                    hasil: fmt(SK, 2),
                    tint: C.critical,
                  },
                  {
                    judul: x.jV,
                    rumus: (<><span>V =</span><Frac num="√( 2 · g · ΔH )" den="√( 1 + ΣK + f · L / D )" /></>),
                    isi: kav
                      ? "—"
                      : `√( 2 · ${fmt(G, 2)} · ${fmt(H, 1)} / ( 1 + ${fmt(SK, 2)} + ${fmt(f, 3)} · ${fmt(L, 0)} / ${fmt(D, 2)} ) )`,
                    hasil: fmt(tampil(ujung.velocity), 3),
                    satuan: satuan("m/s"),
                  },
                  {
                    judul: x.jQ,
                    rumus: <span>Q = V · π · D² / 4</span>,
                    isi: kav ? "—" : `${fmt(ujung.velocity, 4)} · π · ${fmt(D, 2)}² / 4 = ${fmt(Q, 5)} m³/s`,
                    hasil: fmt(tampil(Q * 1000), 2),
                    satuan: satuan("l/s"),
                    tint: kav ? C.signal : C.water,
                  },
                  {
                    judul: x.jHf,
                    rumus: (<><span>hf = f ·</span><Frac num="L" den="D" /><span>·</span><Frac num="V²" den="2 · g" /></>),
                    isi: kav ? "—" : `${fmt(f, 3)} · ${fmt(L, 0)} / ${fmt(D, 2)} · ${fmt(ujung.velocityHead, 4)}`,
                    hasil: fmt(tampil(r.frictionLoss), 3),
                    satuan: satuan("m"),
                    tint: C.energy,
                  },
                  {
                    judul: x.jHk,
                    rumus: (<><span>ΣhK = ΣK ·</span><Frac num="V²" den="2 · g" /></>),
                    isi: kav ? "—" : `${fmt(SK, 2)} · ${fmt(ujung.velocityHead, 4)}`,
                    hasil: fmt(tampil(r.minorLoss), 3),
                    satuan: satuan("m"),
                    tint: C.critical,
                  },
                  {
                    judul: x.jCek,
                    rumus: <span>hf + ΣhK + V²/2g = ΔH</span>,
                    isi: kav
                      ? "—"
                      : `${fmt(r.frictionLoss, 4)} + ${fmt(r.minorLoss, 4)} + ${fmt(ujung.velocityHead, 4)}`,
                    hasil: fmt(tampil(total), 3),
                    satuan: satuan("m"),
                    tint: C.energy,
                  },
                  {
                    judul: x.jBagi,
                    rumus: <span>hf / ΔH · 100</span>,
                    isi: kav ? "—" : `${fmt(r.frictionLoss, 4)} / ${fmt(total, 4)} · 100`,
                    hasil: fmt(tampil(bagiGesekan * 100), 1),
                    satuan: satuan("%"),
                  },
                ]}
              />
            </div>
          </Block>

          {kav ? (
            <StateCard
              tone="invalid"
              badge={x.kavitasi}
              state={x.sKav(fmt(r.minPressureAt, 0))}
              notice={[x.kavNote]}
            />
          ) : (
            <StateCard
              tone={gesekKuasa ? "energy" : "critical"}
              badge={gesekKuasa ? x.gesekanKuasa : x.setempatKuasa}
              state={x.sState(
                gesekKuasa ? x.gesekanKuasa : x.setempatKuasa,
                fmt(r.frictionLoss, 2),
                fmt(r.minorLoss, 2),
                fmt(H, 1),
                fmt(Q * 1000, 1)
              )}
              notice={[...notice(H, L, D, f, Kv, lang), x.nTetap]}
            />
          )}
        </>
      }
      verification={<Verification checks={checksDuct(Q, stations, 0, f)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>ΔH = f</span>
                <Frac num="L" den="D" />
                <Frac num="V²" den="2g" />
                <span>+ ΣK</span>
                <Frac num="V²" den="2g" />
                <span>+</span>
                <Frac num="V²" den="2g" />
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "gesekan sebanding panjang, kehilangan setempat tidak; keduanya sebanding tinggi kecepatan yang sama"
                    : "friction scales with length, minor losses do not; both scale with the same velocity head"}
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
 * Perbandingan dengan pipa sepersepuluh dan sepuluh kali panjangnya.
 * Kalimatnya dibangun dari bagian yang dihitung (>= 50 % berarti gesekan
 * berkuasa), dan cabang yang jatuh di ujung penggeser (10 m atau 2000 m,
 * yaitu keadaan saat ini sendiri) dilewati.
 */
function notice(
  H: number,
  L: number,
  D: number,
  f: number,
  Kv: number,
  lang: Lang
): string[] {
  const x = TXT[lang];
  const bagi = (Lx: number) => {
    const q = debitAlami(Lx, D, H, Kv, f);
    const rr = ductEnergy(q, pipa(Lx, D, H, Kv), 0, f);
    const uj = rr.points[rr.points.length - 1];
    const tot = rr.frictionLoss + rr.minorLoss + uj.velocityHead;
    return { q, kav: rr.cavitates, bagian: tot > 0 ? (rr.frictionLoss / tot) * 100 : 0 };
  };
  const out: string[] = [];
  const pendek = Math.max(10, L / 10);
  const panjang = Math.min(2000, L * 10);
  if (pendek < L) {
    const b = bagi(pendek);
    out.push(
      b.kav
        ? x.nKav(fmt(pendek, 0))
        : x.nPendek(fmt(pendek, 0), fmt(b.bagian, 0), b.bagian >= 50)
    );
  }
  if (panjang > L) {
    const c = bagi(panjang);
    out.push(
      c.kav
        ? x.nKav(fmt(panjang, 0))
        : x.nPanjang(fmt(panjang, 0), fmt(c.bagian, 0), fmt(c.q * 1000, 1), c.bagian >= 50)
    );
  }
  return out;
}
