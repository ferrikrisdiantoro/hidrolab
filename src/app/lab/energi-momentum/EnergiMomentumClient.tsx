"use client";

import { useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  Block,
  Flag,
  InputRow,
  InputTable,
  Note,
  PresetRow,
  ResultTable,
  Sheet,
  Term,
} from "@/components/ui";
import { useCanvas } from "@/lib/useCanvas";
import { drawEnergyMomentum } from "@/lib/drawEnergyMomentum";
import {
  conjugateDepth,
  conjugateFromMomentum,
  criticalDepth,
  fmt,
  froude,
  momentumFunction,
  specificEnergy,
} from "@/lib/hydraulics";
import { C } from "@/lib/theme";
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
      "Aliran belum superkritis, jadi tidak ada loncatan yang perlu digambar. Kurvanya tetap ditampilkan karena keduanya berlaku pada sembarang aliran, tetapi garis tegak pada panel momentum baru punya arti bila ada dua kedalaman yang berbagi satu nilai momentum. Naikkan kecepatan sampai bilangan Froude melewati satu.",
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
      "The flow is not supercritical, so there is no jump to draw. The curves are still shown because both hold for any flow, but the vertical line on the momentum panel only means something when two depths share one momentum value. Raise the velocity until the Froude number passes one.",
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

  const ref = useCanvas(
    (ctx, w, h) => drawEnergyMomentum(ctx, w, h, { q, y1, y2, yc, noJump }, lang),
    [y1, V1, lang]
  );

  return (
    <LabShell
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
            { label: "Fr₁", value: fmt(Fr1, 3), tint: Fr1 > 1 ? C.signal : undefined },
            { label: "ΔE", value: `${fmt(hilang, 4)} m`, tint: C.energy },
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
                  { label: x.pMantap, apply: () => { setY1(0.35); setV1(4.2); } },
                  { label: x.pKuat, apply: () => { setY1(0.2); setV1(6.5); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={C.critical}>{`Fr₁ ${fmt(Fr1, 2)}`}</Flag>
              {noJump && <Flag alert>{x.noJump}</Flag>}
            </div>
            {noJump && (
              <div className="mb-2.5">
                <Note>{x.noJumpNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "Fr₁", label: x.rFr1, value: fmt(Fr1, 3), tint: Fr1 > 1 ? C.signal : undefined, strong: true },
                { symbol: "y₂", label: x.rY2, value: fmt(y2, 4), unit: "m", tint: C.water, strong: true },
                { symbol: "yc", label: x.rYc, value: fmt(yc, 4), unit: "m", tint: C.critical },
                { symbol: "E₁", label: x.rE1, value: fmt(E1, 4), unit: "m", tint: C.energy },
                { symbol: "E₂", label: x.rE2, value: fmt(E2, 4), unit: "m", tint: C.energy },
                { symbol: "ΔE", label: x.rDE, value: fmt(hilang, 4), unit: "m", tint: C.signal },
                { symbol: "%", label: x.rPersen, value: fmt(E1 > 0 ? (hilang / E1) * 100 : 0, 1), unit: "%" },
                { symbol: "M", label: x.rM, value: fmt(M, 4), unit: "m³/m" },
                { symbol: "y₂ᴹ", label: x.rM2, value: fmt(noJump ? y1 : conjugateFromMomentum(y1, q), 4), unit: "m" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(Fr1, hilang, E1, lang)}</Note>
          </Block>
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

function notice(Fr1: number, hilang: number, E1: number, lang: Lang): string {
  if (Fr1 <= 1) {
    return lang === "id"
      ? "Tanpa aliran superkritis, kedua kurva hanya memperlihatkan bentuknya. Yang tetap dapat dibaca sekarang: keduanya mencapai titik terkecil pada kedalaman yang sama, dan kedua nilai terkecil itu punya rumus tertutup yang berbeda, satu setengah kali kedalaman kritis untuk energi dan satu setengah kali kuadratnya untuk momentum. Kedua rumus itu diperiksa terhadap hitungan kami di blok verifikasi."
      : "Without supercritical flow, the two curves only show their shape. What can still be read: both reach their smallest value at the same depth, and those two minima have different closed forms, one and a half times critical depth for energy and one and a half times its square for momentum. Both are checked against our own computation in the verification block.";
  }

  const persen = E1 > 0 ? (hilang / E1) * 100 : 0;

  if (lang === "en")
    return `The jump throws away ${hilang.toFixed(3)} m of head, which is ${persen.toFixed(1)} per cent of what arrived. Follow the two panels together as you raise the velocity: on the momentum panel the two touching points spread apart while staying on one vertical line, and on the energy panel the horizontal gap widens. That widening gap is the whole reason a stilling basin is built, and its cost is paid in the length needed to contain the turbulence.`;
  return `Loncatan itu membuang ${hilang.toFixed(3)} m tinggi tekan, yaitu ${persen.toFixed(1)} persen dari yang datang. Ikuti kedua panel bersamaan sambil menaikkan kecepatan: pada panel momentum kedua titik singgungnya menjauh tetapi tetap berada pada satu garis tegak, sementara pada panel energi jarak mendatarnya melebar. Pelebaran itulah seluruh alasan sebuah kolam olak dibangun, dan harganya dibayar dengan panjang yang dibutuhkan untuk menampung pusarannya.`;
}
