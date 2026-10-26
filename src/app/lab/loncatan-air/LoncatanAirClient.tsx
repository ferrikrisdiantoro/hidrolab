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
  type LangkahHitung,
} from "@/components/ui";
import { usePlate, usePutar } from "@/lib/usePlate";
import {
  createJumpMotion,
  drawJump,
  drawJumpMotion,
  type JumpMotion,
} from "@/lib/drawJump";
import {
  G,
  classifyJump,
  conjugateDepth,
  fmt,
  froude,
  jumpEnergyLoss,
  jumpLength,
} from "@/lib/hydraulics";
import { C, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksJump } from "@/lib/checks";

const TXT = {
  id: {
    title: "Loncatan air",
    sheetTitle: "Loncatan air — saluran persegi mendatar",
    d1: "Kedalaman hulu",
    d2: "Kecepatan hulu",
    pSub: "Subkritis",
    pOsc: "Berosilasi",
    pSteady: "Mantap",
    pStrong: "Kuat",
    showE: "Sembunyikan garis energi",
    hideE: "Tampilkan garis energi",
    rFr1: "Bilangan Froude hulu",
    rY2: "Kedalaman konjugat",
    rV2: "Kecepatan hilir",
    rFr2: "Froude hilir",
    rE1: "Energi spesifik hulu",
    rE2: "Energi spesifik hilir",
    rDE: "Energi teredam",
    rPct: "Persentase teredam",
    rLj: "Panjang loncatan",
    rq: "Debit satuan",
    bNo: "Tak ada loncatan",
    bUnd: "Berombak",
    bWeak: "Lemah",
    bOsc: "Berosilasi",
    bSteady: "Mantap",
    bStrong: "Kuat",
    hPct: "Bagian energi hulu yang teredam",
    hNoBel: "Fr₁ ≤ 1: persamaan Belanger tidak berlaku",
    note: "Persamaan kedua adalah bentuk Belanger, diturunkan dari kekekalan momentum pada saluran persegi mendatar dengan mengabaikan gesekan dasar di sepanjang loncatan. Perlu dicatat bahwa persamaan ini hanya memberi kedalaman di kedua ujung loncatan, bukan bentuk permukaan di antaranya — karena itu bagian dalam loncatan pada gambar digambar dengan titik rapat, bukan garis menerus. Panjang loncatan memakai pendekatan empiris umum L ≈ 6·y₂. Letak loncatan pada gambar bersifat skematik: di saluran sebenarnya posisinya ditentukan muka air hilir, yang tidak dihitung di lembar ini.",
  },
  en: {
    title: "Hydraulic jump",
    sheetTitle: "Hydraulic jump — horizontal rectangular channel",
    d1: "Upstream depth",
    d2: "Upstream velocity",
    pSub: "Subcritical",
    pOsc: "Oscillating",
    pSteady: "Steady",
    pStrong: "Strong",
    showE: "Hide energy line",
    hideE: "Show energy line",
    rFr1: "Upstream Froude number",
    rY2: "Conjugate depth",
    rV2: "Downstream velocity",
    rFr2: "Downstream Froude",
    rE1: "Upstream specific energy",
    rE2: "Downstream specific energy",
    rDE: "Energy dissipated",
    rPct: "Percentage dissipated",
    rLj: "Jump length",
    rq: "Unit discharge",
    bNo: "No jump",
    bUnd: "Undular",
    bWeak: "Weak",
    bOsc: "Oscillating",
    bSteady: "Steady",
    bStrong: "Strong",
    hPct: "Share of upstream energy dissipated",
    hNoBel: "Fr₁ ≤ 1: the Bélanger equation does not apply",
    note: "The second equation is the Bélanger form, derived from momentum conservation in a horizontal rectangular channel with bed friction along the jump neglected. Note that it gives only the depths at the two ends of the jump, not the surface shape in between — which is why the interior of the jump is drawn with fine dots rather than a solid line. Jump length uses the common empirical approximation L ≈ 6·y₂. The jump position in the drawing is schematic: in a real channel it is set by the tailwater level, which this sheet does not compute.",
  },
} as const;

const REFS = {
  id: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Bab 15 — Hydraulic Jump and Its Use as Energy Dissipator.",
    "Peterka, A.J. (1978). Hydraulic Design of Stilling Basins and Energy Dissipators. USBR Engineering Monograph No. 25.",
    "USACE (1992). Hydraulic Design of Spillways, EM 1110-2-1603.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan.",
  ],
  en: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Chapter 15 — Hydraulic Jump and Its Use as Energy Dissipator.",
    "Peterka, A.J. (1978). Hydraulic Design of Stilling Basins and Energy Dissipators. USBR Engineering Monograph No. 25.",
    "USACE (1992). Hydraulic Design of Spillways, EM 1110-2-1603.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan.",
  ],
} as const;

/*
 * Batas pita Fr₁ sama persis dengan batas classifyJump (hydraulics.ts),
 * Chow 1959 §15-3 dan Peterka 1978 EM-25. Sumbu 0,1 sampai 20 memuat seluruh
 * jangkauan penggeser (Fr₁ 0,15 pada y₁ 1,2 dan V₁ 0,5; 18,1 pada y₁ 0,08 dan
 * V₁ 16). Di bawah 1 persamaan Belanger tidak berlaku, jadi pitanya invalid.
 */
const NADA_LONCATAN: Record<string, Tone> = {
  subkritis: "invalid",
  berombak: "neutral",
  lemah: "water",
  berosilasi: "caution",
  mantap: "pass",
  kuat: "caution",
};

export function LoncatanAirClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [y1, setY1] = useState(0.3);
  const [V1, setV1] = useState(7.0);
  const [showEnergy, setShowEnergy] = useState(true);
  // Lapis gerak berjalan sejak awal kecuali peramban meminta pengurangan
  // gerak (usePutar); tombol putar/jeda ada di pojok bidang gambar.
  const { playing, toggle: togglePutar } = usePutar();
  // Keadaan goresan dibuat sekali saja. Nilai awal useRef tetap dihitung
  // ulang pada SETIAP render, jadi pembuatannya dijaga di sini.
  const gerak = useRef<JumpMotion | null>(null);
  if (gerak.current === null) gerak.current = createJumpMotion(150);

  const Fr1 = froude(V1, y1);
  const hasJump = Fr1 > 1;
  const y2 = hasJump ? conjugateDepth(y1, Fr1) : y1;
  const q = V1 * y1;
  const V2 = q / y2;
  const Fr2 = froude(V2, y2);
  const E1 = y1 + (V1 * V1) / (2 * G);
  const E2 = y2 + (V2 * V2) / (2 * G);
  const dE = hasJump ? jumpEnergyLoss(y1, y2) : 0;
  const lossPct = E1 > 0 ? (dE / E1) * 100 : 0;
  const Lj = hasJump ? jumpLength(y2) : 0;
  const klas = classifyJump(Fr1);
  // Dekat Fr₁ = 1 dua angka menulis "1,00 < 1"; tambah angka sampai
  // nilainya tidak lagi terbaca tepat 1.
  let digFr = 2;
  while (digFr < 4 && Number(Fr1.toFixed(digFr)) === 1 && Fr1 !== 1) digFr++;

  /* Hasil tiap langkah adalah variabel yang sama dengan baris tabel hasil,
     dengan jumlah angka yang sama. Masukan ditulis sesuai langkah penggeser
     (y₁ 0,01 m, V₁ 0,1 m/s), nilai antara satu angka lebih banyak. */
  const langkahDasar: LangkahHitung[] = [
    {
      judul: x.rq,
      rumus: <span>q = V₁ · y₁</span>,
      isi: `${fmt(V1, 1)} · ${fmt(y1, 2)}`,
      hasil: fmt(q),
      satuan: "m²/s",
    },
    {
      judul: x.rFr1,
      rumus: (<><span>Fr₁ =</span><Frac num="V₁" den="√( g · y₁ )" /></>),
      isi: `${fmt(V1, 1)} / √( ${fmt(G, 2)} · ${fmt(y1, 2)} )`,
      hasil: fmt(Fr1, digFr),
    },
  ];
  const rumusBelanger = (
    <><span>y₂ =</span><Frac num="y₁" den="2" /><span>· ( √( 1 + 8 · Fr₁² ) − 1 )</span></>
  );
  const langkah: LangkahHitung[] = hasJump
    ? [
        ...langkahDasar,
        {
          judul: x.rY2,
          rumus: rumusBelanger,
          isi: `${fmt(y1, 2)} / 2 · ( √( 1 + 8 · ${fmt(Fr1, 3)}² ) − 1 )`,
          hasil: fmt(y2),
          satuan: "m",
          tint: C.water,
        },
        {
          judul: x.rDE,
          rumus: (<><span>ΔE =</span><Frac num="( y₂ − y₁ )³" den="4 · y₁ · y₂" /></>),
          isi: `( ${fmt(y2, 3)} − ${fmt(y1, 2)} )³ / ( 4 · ${fmt(y1, 2)} · ${fmt(y2, 3)} )`,
          hasil: fmt(dE, 3),
          satuan: "m",
          tint: C.energy,
        },
        {
          judul: x.hPct,
          rumus: (<><Frac num="ΔE" den="E₁" /><span>· 100;  E₁ = y₁ +</span><Frac num="V₁²" den="2 · g" /></>),
          isi: `${fmt(dE, 4)} / ( ${fmt(y1, 2)} + ${fmt(V1, 1)}² / ( 2 · ${fmt(G, 2)} ) ) · 100 = ${fmt(dE, 4)} / ${fmt(E1, 3)} · 100`,
          hasil: fmt(lossPct, 1),
          satuan: "%",
          tint: C.energy,
        },
        {
          judul: x.rLj,
          rumus: <span>Lj ≈ 6 · y₂</span>,
          isi: `6 · ${fmt(y2, 3)}`,
          hasil: fmt(Lj, 1),
          satuan: "m",
          tint: C.critical,
        },
      ]
    : [
        ...langkahDasar,
        { judul: x.hNoBel, rumus: rumusBelanger, isi: "—", hasil: "—" },
      ];

  /* Lapis statis digambar hanya saat masukan berubah; goresan aliran ada
     di lapis gerak. Selagi bergerak lapis statis tanpa panah aliran
     (informasinya dobel dengan goresan). */
  // Saat dijeda lapis gerak kosong; panah aliran diam menggantikan goresan
  // supaya arah dan laju tetap terbaca.
  const bergerak = playing;
  const plate = usePlate(
    (ctx, w, h) => drawJump(ctx, w, h, { y1, V1 }, { showEnergy, flow: bergerak, lang }),
    (ctx, w, h, tt, dt) =>
      drawJumpMotion(ctx, w, h, tt, dt, { y1, V1 }, { showEnergy }, gerak.current!),
    [y1, V1, showEnergy, lang, bergerak],
    { playing }
  );

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="Fr₁"
          value={Fr1}
          scale="log"
          digits={digFr}
          bands={[
            { from: 0.1, to: 1, label: x.bNo, tone: "invalid" },
            { from: 1, to: 1.7, label: x.bUnd, tone: "neutral" },
            { from: 1.7, to: 2.5, label: x.bWeak, tone: "water" },
            { from: 2.5, to: 4.5, label: x.bOsc, tone: "caution" },
            { from: 4.5, to: 9, label: x.bSteady, tone: "pass" },
            { from: 9, to: 20, label: x.bStrong, tone: "caution" },
          ]}
        />
      }
      sheet="OC-01"
      subject={SUBJECTS.OC[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Aliran <Term tint={C.water}>superkritis</Term> yang menabrak air
            tenang di hilir meredam energinya lewat loncatan. Kedalaman melompat
            dari y₁ ke <Term tint={C.water}>y₂</Term>, dan selisih{" "}
            <Term tint={C.energy}>energinya</Term> hilang sebagai turbulensi.
          </p>
        ) : (
          <p>
            <Term tint={C.water}>Supercritical</Term> flow meeting calm water
            downstream dissipates its energy through a jump. The depth leaps
            from y₁ to <Term tint={C.water}>y₂</Term>, and the difference in{" "}
            <Term tint={C.energy}>energy</Term> is lost as turbulence.
          </p>
        )
      }
      drawing={
        <Sheet
          number="OC-01"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbScale, value: "1 : 20" },
            { label: t.tbUnit, value: "SI (m, m/s)" },
            { label: "q", value: `${fmt(q)} m²/s` },
            { label: "Fr₁", value: fmt(Fr1, digFr) },
            { label: t.tbRegime, value: klas.label[lang] },
          ]}
          motion={{
            playing,
            onToggle: togglePutar,
            allowed: plate.motionAllowed,
          }}
        >
          <canvas ref={plate.ref} className="block h-full w-full" />
          <canvas ref={plate.motionRef} />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="y₁" label={x.d1} value={y1} min={0.08} max={1.2} step={0.01} unit="m" onChange={setY1} tint={C.water} />
              <InputRow symbol="V₁" label={x.d2} value={V1} min={0.5} max={16} step={0.1} digits={1} unit="m/s" onChange={setV1} tint={C.water} />
            </InputTable>

            <div className="mt-3.5 flex flex-col gap-2.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pSub, apply: () => { setY1(0.9); setV1(2.0); } },
                  { label: x.pOsc, apply: () => { setY1(0.35); setV1(6.0); } },
                  { label: x.pSteady, apply: () => { setY1(0.25); setV1(8.5); } },
                  { label: x.pStrong, apply: () => { setY1(0.15); setV1(12.0); } },
                ]}
              />
              <PresetRow
                label={t.presetView}
                presets={[
                  { label: showEnergy ? x.showE : x.hideE, apply: () => setShowEnergy((v) => !v) },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "Fr₁", label: x.rFr1, value: fmt(Fr1, digFr), strong: true },
                { symbol: "y₂", label: x.rY2, value: hasJump ? fmt(y2) : "—", unit: "m", tint: C.water, strong: true },
                { symbol: "V₂", label: x.rV2, value: hasJump ? fmt(V2) : "—", unit: "m/s" },
                { symbol: "Fr₂", label: x.rFr2, value: hasJump ? fmt(Fr2) : "—" },
                { symbol: "E₁", label: x.rE1, value: fmt(E1), unit: "m", tint: C.energy },
                { symbol: "E₂", label: x.rE2, value: hasJump ? fmt(E2) : "—", unit: "m", tint: C.energy },
                { symbol: "ΔE", label: x.rDE, value: hasJump ? fmt(dE, 3) : "—", unit: "m", tint: C.energy },
                { label: x.rPct, value: hasJump ? fmt(lossPct, 1) : "—", unit: "%", tint: C.energy },
                { symbol: "Lj", label: x.rLj, value: hasJump ? fmt(Lj, 1) : "—", unit: "m", tint: C.critical },
                { symbol: "q", label: x.rq, value: fmt(q), unit: "m²/s" },
              ]}
            />
            <div className="mt-3">
              <Hitungan langkah={langkah} />
            </div>
          </Block>

          <StateCard
            tone={NADA_LONCATAN[klas.key]}
            badge={klas.label[lang]}
            {...notice({ Fr1, digFr, hasJump, lossPct, Lj, y2, y1, klas }, lang)}
          />
        </>
      }
      verification={<Verification checks={checksJump(y1, V1)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Fr₁ =</span>
                <Frac num="V₁" den={<>√(g · y₁)</>} />
              </Eq>
              <Eq>
                <Frac num="y₂" den="y₁" />
                <span>= ½ · ( √(1 + 8 · Fr₁²) − 1 )</span>
              </Eq>
              <Eq>
                <span>ΔE =</span>
                <Frac num="(y₂ − y₁)³" den="4 · y₁ · y₂" />
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
 * Kalimat pertama menyatakan keadaan (rezim, rentang Fr₁, rasio kedalaman,
 * energi teredam); butir-butirnya akibat yang perlu diperhatikan. Tiap rezim
 * classifyJump punya cabangnya sendiri, termasuk loncatan lemah 1,7 sampai
 * 2,5 yang dulu jatuh ke teks berosilasi.
 */
function notice(
  s: {
    Fr1: number;
    digFr: number;
    hasJump: boolean;
    lossPct: number;
    Lj: number;
    y2: number;
    y1: number;
    klas: ReturnType<typeof classifyJump>;
  },
  lang: Lang
): { state: string; notice: string[] } {
  const rasio = fmt(s.y2 / s.y1, 1);
  const pct = fmt(s.lossPct, s.lossPct < 10 ? 1 : 0);
  const lj = fmt(s.Lj, 1);
  const fr = fmt(s.Fr1, s.digFr);
  const key = s.klas.key;
  // Rentang di classifyJump ditulis dengan koma desimal; EN memakai titik.
  const rentang = lang === "en" ? s.klas.range.replace(/,/g, ".") : s.klas.range;
  const catatan = s.klas.note[lang];

  if (lang === "en") {
    const tetap =
      "Bélanger applies to a horizontal rectangular channel with friction neglected. Lj ≈ 6 y₂ fits best in the steady range (Chow 1959 Fig. 15-4).";
    if (!s.hasJump)
      return {
        state: `Fr₁ = ${fr} ≤ 1: the flow is not supercritical and no jump forms.`,
        notice: [
          "Raise the upstream velocity or reduce the upstream depth until Fr₁ passes 1. Velocity has the larger effect: Fr₁ is proportional to V₁ but only to 1/√y₁, so a 10 per cent rise in V₁ raises Fr₁ by 10 per cent, while a 10 per cent cut in y₁ raises it by only about 5 per cent.",
          "For a jump to form the upstream flow must be supercritical; in the field this happens at the toe of a spillway or below a sluice gate.",
        ],
      };
    const state = `Fr₁ = ${fr}: ${s.klas.label.en} (${rentang}); the depth rises ${rasio} times and ${pct} per cent of the energy is dissipated.`;
    if (key === "berombak")
      return { state, notice: [catatan, "For an energy dissipator this is not yet adequate.", tetap] };
    if (key === "lemah")
      return {
        state,
        notice: [
          catatan,
          "In this range a stilling basin generally needs no baffles or sills (Peterka 1978, EM-25).",
          tetap,
        ],
      };
    if (key === "berosilasi")
      return {
        state,
        notice: [
          "Watch the rollers in the jump: the entering jet oscillates and its waves travel far downstream.",
          "Those residual waves are what usually damage the downstream banks, which is why this range is avoided in stilling basin design.",
          tetap,
        ],
      };
    if (key === "mantap")
      return {
        state,
        notice: [
          "This is the range sought in design: the jump holds its position and does not wander.",
          `The stilling basin needs to be at least ${lj} m long so the jump finishes inside the structure rather than on the natural ground beyond it.`,
          tetap,
        ],
      };
    return {
      state,
      notice: [
        "The surface has become rough and turbulent, and the cost of bed and wall protection rises sharply.",
        "It is often cheaper to lower Fr₁ by changing the basin floor level than to strengthen the structure.",
        tetap,
      ],
    };
  }

  const tetap =
    "Belanger berlaku untuk saluran persegi mendatar dengan gesekan diabaikan. Lj ≈ 6 y₂ paling sesuai pada rentang mantap (Chow 1959 Gbr. 15-4).";
  if (!s.hasJump)
    return {
      state: `Fr₁ = ${fr} ≤ 1: aliran belum superkritis, loncatan tidak terbentuk.`,
      notice: [
        "Naikkan kecepatan hulu atau kurangi kedalaman hulu sampai Fr₁ melewati 1. Kecepatan lebih berpengaruh: Fr₁ sebanding V₁ tetapi hanya sebanding 1/√y₁, jadi menaikkan V₁ 10 persen menaikkan Fr₁ 10 persen, sedangkan mengurangi y₁ 10 persen hanya menaikkannya sekitar 5 persen.",
        "Untuk membentuk loncatan aliran hulu harus superkritis; di lapangan ini dicapai di kaki pelimpah atau di bawah pintu sorong.",
      ],
    };
  const state = `Fr₁ = ${fr}: ${s.klas.label.id} (${rentang}); kedalaman naik ${rasio} kali dan ${pct} persen energi teredam.`;
  if (key === "berombak")
    return { state, notice: [catatan, "Untuk keperluan peredam energi, kondisi ini belum memadai.", tetap] };
  if (key === "lemah")
    return {
      state,
      notice: [
        catatan,
        "Pada rentang ini kolam olak umumnya tidak memerlukan blok atau ambang peredam (Peterka 1978, EM-25).",
        tetap,
      ],
    };
  if (key === "berosilasi")
    return {
      state,
      notice: [
        "Perhatikan gulungan di daerah loncatan: pancaran masuk berosilasi naik-turun dan gelombangnya menjalar jauh ke hilir.",
        "Gelombang sisa inilah yang biasanya merusak tebing di hilir, dan karena itu rentang ini dihindari dalam desain kolam olak.",
        tetap,
      ],
    };
  if (key === "mantap")
    return {
      state,
      notice: [
        "Ini rentang yang dicari dalam desain: posisi loncatan stabil dan tidak berpindah-pindah.",
        `Panjang kolam olak perlu setidaknya ${lj} m agar loncatan selesai di dalam struktur, bukan di atas tanah asli di hilirnya.`,
        tetap,
      ],
    };
  return {
    state,
    notice: [
      "Permukaan menjadi kasar dan bergolak, dan biaya perlindungan dasar serta dinding naik tajam.",
      "Sering kali lebih murah menurunkan Fr₁ dengan mengubah elevasi lantai olak daripada memperkuat strukturnya.",
      tetap,
    ],
  };
}
