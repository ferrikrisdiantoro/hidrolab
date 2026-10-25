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
  type LangkahHitung,
} from "@/components/ui";
import { useCanvas } from "@/lib/useCanvas";
import { drawEnergyMomentum } from "@/lib/drawEnergyMomentum";
import {
  G,
  classifyJump,
  conjugateDepth,
  conjugateFromMomentum,
  criticalDepth,
  fmt,
  froude,
  momentumFunction,
  specificEnergy,
} from "@/lib/hydraulics";
import { C, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksEnergyMomentum } from "@/lib/checks";

const TXT = {
  id: {
    title: "Energi dan momentum",
    sheetTitle: "Kurva energi spesifik dan kurva fungsi momentum — satu sumbu kedalaman",
    dy: "Kedalaman sebelum loncatan",
    dV: "Kecepatan sebelum loncatan",
    pLemah: "Loncatan lemah",
    pMantap: "Loncatan mantap",
    pKuat: "Loncatan kuat",
    rFr1: "Bilangan Froude sebelum loncatan",
    rY2: "Kedalaman konjugat",
    rYc: "Kedalaman kritis",
    rE1: "Energi spesifik sebelum",
    rE2: "Energi spesifik sesudah",
    rDE: "Energi yang teredam",
    rM: "Fungsi momentum, keduanya",
    rPersen: "Bagian energi yang hilang",
    rM2: "Pasangan lewat fungsi momentum",
    noJump: "Tidak terbentuk loncatan",
    noJumpNote:
      "Kurvanya tetap ditampilkan karena keduanya berlaku pada sembarang aliran, tetapi garis tegak pada panel momentum baru punya arti bila ada dua kedalaman yang berbagi satu nilai momentum. Naikkan kecepatan sampai bilangan Froude melewati satu.",
    bNo: "Tak ada loncatan",
    bUnd: "Berombak",
    bWeak: "Lemah",
    bOsc: "Berosilasi",
    bSteady: "Mantap",
    bStrong: "Kuat",
    hq: "Debit satuan",
    hNoBel: "Fr₁ ≤ 1: persamaan Belanger tidak berlaku",
    hM: "Fungsi momentum: M(y₁) harus sama dengan M(y₂)",
    note:
      "Dua kurva ini menjawab dua pertanyaan yang sering tertukar. Energi spesifik menjawab berapa tinggi tekan yang tersedia, dan momentum menjawab berapa gaya yang bekerja. Keduanya minimum pada kedalaman yang sama, yaitu kedalaman kritis, dan itu bukan kebetulan melainkan akibat keduanya turun dari kondisi yang sama. Perbedaannya muncul justru pada loncatan air. Melewati loncatan, momentum kekal karena gaya luar yang bekerja pada badan air memang dapat diabaikan, sedangkan energi tidak kekal karena sebagian berubah menjadi pusaran dan panas. Itulah sebabnya kedalaman konjugat harus dicari lewat fungsi momentum, bukan lewat energi. Mencarinya lewat energi akan memberi jawaban yang tampak masuk akal tetapi salah, karena mengandaikan tidak ada yang hilang. Perhatikan pada gambar: satu garis tegak pada panel momentum menyentuh kurva dua kali, sedangkan kedua kedalaman yang sama itu jatuh pada dua nilai energi yang berbeda. Jarak mendatar di antaranya adalah energi yang teredam, dan itulah yang dimanfaatkan kolam olak untuk melindungi dasar saluran di hilirnya.",
  },
  en: {
    title: "Energy and momentum",
    sheetTitle: "Specific energy and momentum function curves — one depth axis",
    dy: "Depth before the jump",
    dV: "Velocity before the jump",
    pLemah: "Weak jump",
    pMantap: "Steady jump",
    pKuat: "Strong jump",
    rFr1: "Froude number before the jump",
    rY2: "Conjugate depth",
    rYc: "Critical depth",
    rE1: "Specific energy before",
    rE2: "Specific energy after",
    rDE: "Energy dissipated",
    rM: "Momentum function, both depths",
    rPersen: "Fraction of energy lost",
    rM2: "Pair found through the momentum function",
    noJump: "No jump forms",
    noJumpNote:
      "The curves are still shown because both hold for any flow, but the vertical line on the momentum panel only means something when two depths share one momentum value. Raise the velocity until the Froude number passes one.",
    bNo: "No jump",
    bUnd: "Undular",
    bWeak: "Weak",
    bOsc: "Oscillating",
    bSteady: "Steady",
    bStrong: "Strong",
    hq: "Unit discharge",
    hNoBel: "Fr₁ ≤ 1: the Bélanger equation does not apply",
    hM: "Momentum function: M(y₁) must equal M(y₂)",
    note:
      "These two curves answer two questions that are often confused. Specific energy answers how much head is available; momentum answers how much force is at work. Both are minimum at the same depth, the critical depth, and that is not a coincidence but a consequence of both descending from the same condition. The difference appears precisely at a hydraulic jump. Across the jump, momentum is conserved because the external forces on the body of water really are negligible, while energy is not, because part of it turns into turbulence and heat. That is why the conjugate depth must be found through the momentum function and not through energy. Finding it through energy gives an answer that looks reasonable and is wrong, because it assumes nothing is lost. Notice on the drawing: one vertical line on the momentum panel touches the curve twice, while those same two depths fall on two different energy values. The horizontal gap between them is the energy dissipated, and it is exactly what a stilling basin exploits to protect the bed downstream.",
  },
} as const;

const REFS = {
  id: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Bab 3 untuk energi spesifik dan Bab 15 untuk loncatan air.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Bab 2 dan Bab 3.",
    "Belanger, J.B. (1841). Notes sur l'Hydraulique. Ecole Royale des Ponts et Chaussees.",
    "Sturm, T.W. (2010). Open Channel Hydraulics, edisi ke-2. McGraw-Hill. Bab 2.",
  ],
  en: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Chapter 3 for specific energy and Chapter 15 for the hydraulic jump.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Chapters 2 and 3.",
    "Belanger, J.B. (1841). Notes sur l'Hydraulique. Ecole Royale des Ponts et Chaussees.",
    "Sturm, T.W. (2010). Open Channel Hydraulics, 2nd ed. McGraw-Hill. Chapter 2.",
  ],
} as const;

export function EnergiMomentumClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [y1, setY1] = useState(0.35);
  const [V1, setV1] = useState(4.2);

  const q = y1 * V1;
  const Fr1 = froude(V1, y1);
  const yc = criticalDepth(q);
  const noJump = Fr1 <= 1;
  const y2 = noJump ? y1 : conjugateDepth(y1, Fr1);

  const E1 = specificEnergy(y1, q);
  const E2 = specificEnergy(y2, q);
  const M = momentumFunction(y1, q);
  const hilang = E1 - E2;
  const M2 = momentumFunction(y2, q);
  const klas = classifyJump(Fr1);
  const persen = E1 > 0 ? (hilang / E1) * 100 : 0;
  // Tanpa loncatan, y₂ dan besaran turunannya tidak ada; ditulis "—".
  const ada = (v: number) => (noJump ? NaN : v);
  const satuan = (u: string) => (noJump ? undefined : u);

  /* Batas pita sama dengan classifyJump (Chow 1959 §15-3, Peterka 1978
     EM-25). Sumbu 0,04 sampai 25 memuat seluruh jangkauan penggeser: Fr₁
     0,045 pada y₁ 2 m dan V₁ 0,2 m/s, 22,8 pada y₁ 0,05 m dan V₁ 16 m/s. */
  const NADA: Record<string, Tone> = {
    subkritis: "invalid",
    berombak: "neutral",
    lemah: "water",
    berosilasi: "caution",
    mantap: "pass",
    kuat: "caution",
  };

  const langkah: LangkahHitung[] = [
    {
      judul: x.hq,
      rumus: <span>q = y₁ · V₁</span>,
      isi: `${fmt(y1, 2)} · ${fmt(V1, 1)}`,
      hasil: fmt(q, 3),
      satuan: "m²/s",
      tint: C.water,
    },
    {
      judul: x.rFr1,
      rumus: (<><span>Fr₁ =</span><Frac num="V₁" den="√( g · y₁ )" /></>),
      isi: `${fmt(V1, 1)} / √( ${fmt(G, 2)} · ${fmt(y1, 2)} )`,
      hasil: fmt(Fr1, 3),
    },
    {
      judul: x.rYc,
      rumus: (<><span>yc =</span><Frac num="∛( q² )" den="∛g" /></>),
      isi: `∛( ${fmt(q, 4)}² / ${fmt(G, 2)} )`,
      hasil: fmt(yc, 4),
      satuan: "m",
      tint: C.critical,
    },
    ...(noJump
      ? [
          {
            judul: x.hNoBel,
            rumus: (<><span>y₂ =</span><Frac num="y₁" den="2" /><span>· ( √( 1 + 8 · Fr₁² ) − 1 )</span></>),
            isi: "—",
            hasil: "—",
          },
        ]
      : [
          {
            judul: x.rY2,
            rumus: (<><span>y₂ =</span><Frac num="y₁" den="2" /><span>· ( √( 1 + 8 · Fr₁² ) − 1 )</span></>),
            isi: `${fmt(y1, 2)} / 2 · ( √( 1 + 8 · ${fmt(Fr1, 4)}² ) − 1 )`,
            hasil: fmt(y2, 4),
            satuan: "m",
            tint: C.water,
          },
          {
            judul: x.hM,
            rumus: (<><span>M =</span><Frac num="y²" den="2" /><span>+</span><Frac num="q²" den="g · y" /></>),
            isi: `M(y₁) = ${fmt(y1, 2)}² / 2 + ${fmt(q, 4)}² / ( ${fmt(G, 2)} · ${fmt(y1, 2)} );  M(y₂) = ${fmt(y2, 5)}² / 2 + ${fmt(q, 4)}² / ( ${fmt(G, 2)} · ${fmt(y2, 5)} ) = ${fmt(M2, 4)}`,
            hasil: fmt(M, 4),
            satuan: "m³/m",
          },
          {
            judul: x.rDE,
            rumus: <span>ΔE = E₁ − E₂</span>,
            isi: `${fmt(E1, 4)} − ${fmt(E2, 4)}`,
            hasil: fmt(hilang, 4),
            satuan: "m",
            tint: C.energy,
          },
        ]),
  ];

  const ref = useCanvas(
    (ctx, w, h) => drawEnergyMomentum(ctx, w, h, { q, y1, y2, yc, noJump }, lang),
    [y1, V1, lang]
  );

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="Fr₁"
          value={Fr1}
          scale="log"
          digits={2}
          bands={[
            { from: 0.04, to: 1, label: x.bNo, tone: "invalid" },
            { from: 1, to: 1.7, label: x.bUnd, tone: "neutral" },
            { from: 1.7, to: 2.5, label: x.bWeak, tone: "water" },
            { from: 2.5, to: 4.5, label: x.bOsc, tone: "caution" },
            { from: 4.5, to: 9, label: x.bSteady, tone: "pass" },
            { from: 9, to: 25, label: x.bStrong, tone: "caution" },
          ]}
        />
      }
      sheet="OC-08"
      subject={SUBJECTS.OC[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            <Term tint={C.energy}>Energi</Term> dan{" "}
            <Term tint={C.ink}>momentum</Term> mencapai nilai terkecilnya pada
            kedalaman yang sama, dan karena itu sering dianggap saling
            menggantikan. Melewati loncatan air, keduanya berpisah: yang satu
            kekal, yang lain tidak.
          </p>
        ) : (
          <p>
            <Term tint={C.energy}>Energy</Term> and{" "}
            <Term tint={C.ink}>momentum</Term> reach their smallest values at the
            same depth, which is why they are so often treated as
            interchangeable. Across a hydraulic jump they part company: one is
            conserved, the other is not.
          </p>
        )
      }
      drawing={
        <Sheet
          number="OC-08"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "q", value: `${fmt(q, 3)} m²/s`, tint: C.water },
            { label: "Fr₁", value: fmt(Fr1, 3) },
            { label: "ΔE", value: noJump ? "—" : `${fmt(hilang, 4)} m`, tint: C.energy },
            { label: "M", value: `${fmt(M, 4)} m³/m` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="y₁" label={x.dy} value={y1} min={0.05} max={2} step={0.01} unit="m" onChange={setY1} tint={C.water} />
              <InputRow symbol="V₁" label={x.dV} value={V1} min={0.2} max={16} step={0.1} digits={1} unit="m/s" onChange={setV1} tint={C.water} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pLemah, apply: () => { setY1(0.6); setV1(4.2); } },
                  // Fr₁ 5,43 (mantap 4,5 sampai 9) dan 9,89 (kuat di atas 9).
                  // Nilai lama 0,35/4,2 dan 0,20/6,5 memberi Fr₁ 2,27 (lemah)
                  // dan 4,64 (mantap), tidak sesuai label tombolnya.
                  { label: x.pMantap, apply: () => { setY1(0.25); setV1(8.5); } },
                  { label: x.pKuat, apply: () => { setY1(0.15); setV1(12); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "Fr₁", label: x.rFr1, value: fmt(Fr1, 3), strong: true },
                { symbol: "y₂", label: x.rY2, value: fmt(ada(y2), 4), unit: satuan("m"), tint: C.water, strong: true },
                { symbol: "yc", label: x.rYc, value: fmt(yc, 4), unit: "m", tint: C.critical },
                { symbol: "E₁", label: x.rE1, value: fmt(E1, 4), unit: "m", tint: C.energy },
                { symbol: "E₂", label: x.rE2, value: fmt(ada(E2), 4), unit: satuan("m"), tint: C.energy },
                { symbol: "ΔE", label: x.rDE, value: fmt(ada(hilang), 4), unit: satuan("m"), tint: C.energy },
                { symbol: "%", label: x.rPersen, value: fmt(ada(persen), 1), unit: satuan("%") },
                { symbol: "M", label: x.rM, value: fmt(M, 4), unit: "m³/m" },
                { symbol: "y₂ᴹ", label: x.rM2, value: fmt(ada(noJump ? y1 : conjugateFromMomentum(y1, q)), 4), unit: satuan("m") },
              ]}
            />
            <div className="mt-3">
              <Hitungan langkah={langkah} />
            </div>
          </Block>

          <StateCard
            tone={NADA[klas.key]}
            badge={klas.label[lang]}
            {...notice(Fr1, hilang, persen, klas, x.noJumpNote, lang)}
          />
        </>
      }
      verification={<Verification checks={checksEnergyMomentum(y1, V1)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>E = y +</span>
                <Frac num="q²" den="2 g y²" />
                <span className="ml-6">M =</span>
                <Frac num="y²" den="2" />
                <span>+</span>
                <Frac num="q²" den="g y" />
              </Eq>
              <Eq>
                <span>M(y₁) = M(y₂)</span>
                <span className="ml-6">ΔE =</span>
                <Frac num="(y₂ − y₁)³" den="4 y₁ y₂" />
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
  Fr1: number,
  hilang: number,
  persen: number,
  klas: ReturnType<typeof classifyJump>,
  noJumpNote: string,
  lang: Lang
): { state: string; notice: string[] } {
  // Dekat Fr₁ = 1 dua angka menulis "1,00 < 1"; tambah angka seperlunya.
  let digFr = 2;
  while (digFr < 4 && Number(Fr1.toFixed(digFr)) === 1 && Fr1 !== 1) digFr++;
  const fr = fmt(Fr1, digFr);
  // Rentang di classifyJump ditulis dengan koma desimal; EN memakai titik.
  const rentang = lang === "en" ? klas.range.replace(/,/g, ".") : klas.range;

  if (Fr1 <= 1) {
    return lang === "id"
      ? {
          state: `Fr₁ = ${fr} ≤ 1: aliran belum superkritis, jadi tidak ada loncatan yang perlu digambar.`,
          notice: [
            noJumpNote,
            "Yang tetap dapat dibaca sekarang: keduanya mencapai titik terkecil pada kedalaman yang sama, dan kedua nilai terkecil itu punya rumus tertutup yang berbeda, satu setengah kali kedalaman kritis untuk energi dan satu setengah kali kuadratnya untuk momentum. Kedua rumus itu diperiksa terhadap hitungan kami di blok verifikasi.",
          ],
        }
      : {
          state: `Fr₁ = ${fr} ≤ 1: the flow is not yet supercritical, so there is no jump to draw.`,
          notice: [
            noJumpNote,
            "What can still be read: both curves reach their smallest value at the same depth, and those two minima have different closed forms, one and a half times critical depth for energy and one and a half times its square for momentum. Both are checked against our own computation in the verification block.",
          ],
        };
  }

  if (lang === "en")
    return {
      state: `Fr₁ = ${fr}: ${klas.label.en} (${rentang}); the jump throws away ${fmt(hilang, 3)} m of head, which is ${fmt(persen, 1)} per cent of what arrived.`,
      notice: [
        "Follow the two panels together as you raise the velocity: on the momentum panel the two touching points spread apart while staying on one vertical line, and on the energy panel the horizontal gap widens.",
        "That widening gap is the whole reason a stilling basin is built, and its cost is paid in the length needed to contain the turbulence.",
      ],
    };
  return {
    state: `Fr₁ = ${fr}: ${klas.label.id} (${rentang}); loncatan membuang ${fmt(hilang, 3)} m tinggi tekan, yaitu ${fmt(persen, 1)} persen dari yang datang.`,
    notice: [
      "Ikuti kedua panel bersamaan sambil menaikkan kecepatan: pada panel momentum kedua titik singgungnya menjauh tetapi tetap berada pada satu garis tegak, sementara pada panel energi jarak mendatarnya melebar.",
      "Pelebaran itulah seluruh alasan sebuah kolam olak dibangun, dan harganya dibayar dengan panjang yang dibutuhkan untuk menampung pusarannya.",
    ],
  };
}
