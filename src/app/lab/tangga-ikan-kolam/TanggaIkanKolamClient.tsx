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
import { drawStructure, type StructureBody, type StructureSpec } from "@/lib/drawStructure";
import {
  FISHWAY_POWER_GENERAL,
  FISHWAY_POWER_SALMON,
  FISHWAY_POWER_WEAK,
  fmt,
  fmtPlain,
  poolFishway,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksPoolFishway } from "@/lib/checks";

const TXT = {
  id: {
    title: "Tangga ikan kolam",
    sheetTitle: "Tangga ikan berkolam bercelah tegak — lesapan daya tiap kolam",
    dDh: "Beda tinggi muka air antar kolam",
    dL: "Panjang kolam searah aliran",
    dB: "Lebar kolam",
    dD: "Kedalaman air di kolam",
    dSlot: "Lebar celah tegak",
    dRise: "Beda tinggi seluruhnya",
    pBaik: "Rancangan lapang",
    pSempit: "Kolam terlalu kecil",
    pTinggi: "Beda tinggi antar kolam besar",
    rQ: "Debit yang lewat",
    rEps: "Lesapan daya per satuan isi kolam",
    rPower: "Daya yang dilesapkan tiap kolam",
    rVolume: "Isi satu kolam",
    rCount: "Banyaknya kolam",
    rLength: "Panjang tangga ikan seluruhnya",
    rVslot: "Kecepatan di celah",
    teraduk: "Kolam terlalu teraduk",
    teradukNote:
      "Lesapan daya per satuan isi kolam melampaui 150 watt per meter kubik, batas yang lazim dipakai untuk ikan sungai pada umumnya. Yang menghalangi ikan pada keadaan ini bukan kecepatan celahnya, yang masih dapat dilawan, melainkan putaran air di dalam kolam itu sendiri: gelembung udara dan pusaran membuat ikan kehilangan arah dan tidak menemukan celah berikutnya, lalu terbawa turun. Yang perlu diingat saat memperbaikinya: memperkecil celah tidak menolong, karena itu menurunkan debit sekaligus isi kolam yang teraduk dalam perbandingan yang hampir sama. Yang menolong memperbesar kolamnya atau memperkecil beda tinggi antar kolam.",
    note:
      "Tangga ikan berkolam dinilai dari dua angka yang sering tertukar. Yang pertama kecepatan di celah, dan itu yang harus dilawan ikan untuk berpindah dari satu kolam ke kolam berikutnya; ia ditentukan seluruhnya oleh beda tinggi muka air antar kolam, lewat Torricelli, dan tidak bergantung pada ukuran kolam sama sekali. Yang kedua lesapan daya per satuan isi kolam, dan itu yang menentukan apakah ikan sanggup beristirahat dan menemukan celah berikutnya setelah sampai; ia bergantung pada ukuran kolam maupun debitnya. Keduanya harus dipenuhi bersama, dan keduanya diperbaiki dengan cara yang berbeda: kecepatan celah hanya dapat diturunkan dengan memperkecil beda tinggi antar kolam, sedangkan lesapan daya dapat diturunkan dengan memperbesar kolamnya tanpa menyentuh beda tingginya sama sekali. Rancangan yang gagal biasanya memenuhi yang pertama dan melupakan yang kedua, karena yang pertama mudah dihitung dan yang kedua menuntut memikirkan isi kolam.",
  },
  en: {
    title: "Pool fishway",
    sheetTitle: "Vertical-slot pool fishway — power dissipation per pool",
    dDh: "Head drop between pools",
    dL: "Pool length along the flow",
    dB: "Pool width",
    dD: "Water depth in the pool",
    dSlot: "Vertical slot width",
    dRise: "Total rise",
    pBaik: "Generous design",
    pSempit: "Pool too small",
    pTinggi: "Large drop between pools",
    rQ: "Discharge through the fishway",
    rEps: "Power dissipated per unit pool volume",
    rPower: "Power dissipated in each pool",
    rVolume: "Volume of one pool",
    rCount: "Number of pools",
    rLength: "Total fishway length",
    rVslot: "Velocity in the slot",
    teraduk: "Pool too turbulent",
    teradukNote:
      "The power dissipated per unit pool volume exceeds 150 watts per cubic metre, the limit commonly applied for river fish generally. What stops the fish in this state is not the slot velocity, which they can still beat, but the churning of the pool itself: entrained air and eddies leave the fish disoriented so that it fails to find the next slot and is carried back down. Worth remembering when fixing it: narrowing the slot does not help, because it lowers the discharge and the churned volume in nearly the same proportion. What helps is enlarging the pool or reducing the drop between pools.",
    note:
      "A pool fishway is judged by two numbers that are often confused. The first is the slot velocity, which the fish must beat to move from one pool to the next; it is set entirely by the head drop between pools, through Torricelli, and does not depend on the pool size at all. The second is the power dissipated per unit pool volume, which decides whether the fish can rest and find the next slot after arriving; it depends on the pool size as well as the discharge. Both must be satisfied together, and each is fixed in a different way: the slot velocity can only be lowered by reducing the drop between pools, while the dissipation can be lowered by enlarging the pool without touching the drop at all. A failed design usually meets the first and forgets the second, because the first is easy to compute and the second requires thinking about the volume of the pool.",
  },
} as const;

const REFS = {
  id: [
    "FAO/DVWK (2002). Fish Passes: Design, Dimensions and Monitoring. FAO, Roma.",
    "Larinier, M. (2002). Pool fishways, pre-barrages and natural bypass channels. Bulletin Francais de la Peche et de la Pisciculture 364.",
    "Rajaratnam, N., Van der Vinne, G. & Katopodis, C. (1986). Hydraulics of vertical slot fishways. Journal of Hydraulic Engineering, vol. 112.",
    "Katopodis, C. (1992). Introduction to Fishway Design. Freshwater Institute, Winnipeg.",
  ],
  en: [
    "FAO/DVWK (2002). Fish Passes: Design, Dimensions and Monitoring. FAO, Rome.",
    "Larinier, M. (2002). Pool fishways, pre-barrages and natural bypass channels. Bulletin Francais de la Peche et de la Pisciculture 364.",
    "Rajaratnam, N., Van der Vinne, G. & Katopodis, C. (1986). Hydraulics of vertical slot fishways. Journal of Hydraulic Engineering, vol. 112.",
    "Katopodis, C. (1992). Introduction to Fishway Design. Freshwater Institute, Winnipeg.",
  ],
} as const;

export function TanggaIkanKolamClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [dh, setDh] = useState(0.2);
  const [L, setL] = useState(2.5);
  const [B, setB] = useState(1.8);
  const [D, setD] = useState(1.2);
  const [slot, setSlot] = useState(0.3);
  const [rise, setRise] = useState(4);

  const r = poolFishway(dh, L, B, D, slot, rise);

  const ref = useCanvas(
    (ctx, w, ch) => {
      // Potongan memanjang beberapa kolam berurutan.
      const tampil = Math.min(r.poolCount, 5);
      const tebal = Math.max(L * 0.08, 0.1);
      const badan: StructureBody[] = [];
      const muka: { x: number; z: number }[] = [];
      const dasar: { x: number; z: number }[] = [];

      for (let i = 0; i < tampil; i++) {
        const x0 = i * L;
        const zDasar = (tampil - 1 - i) * dh;
        // Sekat antar kolam, dengan celah di bawahnya digambar sebagai
        // pemutus: sekatnya berhenti di ketinggian dasar kolam.
        badan.push({
          pts: [
            { x: x0 + L - tebal, z: zDasar },
            { x: x0 + L, z: zDasar },
            { x: x0 + L, z: zDasar + D * 1.15 },
            { x: x0 + L - tebal, z: zDasar + D * 1.15 },
          ],
        });
        // Lantai kolam.
        badan.push({
          pts: [
            { x: x0, z: zDasar },
            { x: x0 + L, z: zDasar },
            { x: x0 + L, z: zDasar - tebal },
            { x: x0, z: zDasar - tebal },
          ],
        });
        muka.push({ x: x0, z: zDasar + D });
        muka.push({ x: x0 + L - tebal, z: zDasar + D });
        dasar.push({ x: x0, z: zDasar });
        dasar.push({ x: x0 + L, z: zDasar });
      }

      const spec: StructureSpec = {
        xMin: -L * 0.12,
        xMax: tampil * L + L * 0.12,
        zMin: -tebal * 2,
        zMax: (tampil - 1) * dh + D * 1.3,
        bodies: badan,
        waters: [
          {
            surface: muka,
            bed: [...dasar].reverse(),
            invalid: r.tooTurbulent,
          },
        ],
        dims: [
          {
            axis: "v",
            at: L * 0.98,
            from: (tampil - 2) * dh + D,
            to: (tampil - 1) * dh + D,
            text: `Δh ${fmtPlain(dh, 2)} m`,
            color: C.energy,
            offset: 20,
          },
          {
            axis: "h",
            at: -tebal * 1.2,
            from: 0,
            to: L,
            text: `${fmtPlain(L, 1)} m`,
            color: C.ink,
          },
        ],
        callouts: [
          {
            x: L * 0.5,
            z: (tampil - 1) * dh + D * 0.5,
            dx: 10,
            dy: -30,
            text: T.poolLabel,
          },
          {
            x: L - tebal / 2,
            z: (tampil - 1) * dh + D * 0.12,
            dx: 42,
            dy: 24,
            text: T.slotLabel,
          },
        ],
        arrows: [
          { x: L * 1.3, z: (tampil - 2) * dh + D * 0.5, length: -26 },
        ],
        heading: r.tooTurbulent ? x.teraduk : undefined,
        headingColor: C.signal,
        axisX: T.axHoriz,
        axisZ: T.axLevel,
      };

      drawStructure(ctx, w, ch, spec, lang);
    },
    [dh, L, B, D, slot, rise, lang]
  );

  return (
    <LabShell
      sheet="EH-01"
      subject={SUBJECTS.EH[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Dua syarat yang harus dipenuhi bersama dan diperbaiki dengan cara
            berbeda: <Term tint={C.critical}>kecepatan celah</Term> yang harus
            dilawan, dan <Term tint={C.energy}>keteradukan kolam</Term> yang
            menentukan apakah ikan sanggup beristirahat setelah sampai.
          </p>
        ) : (
          <p>
            Two conditions that must hold together and are fixed in different
            ways: the <Term tint={C.critical}>slot velocity</Term> the fish must
            beat, and the <Term tint={C.energy}>churning of the pool</Term> that
            decides whether it can rest once it arrives.
          </p>
        )
      }
      drawing={
        <Sheet
          number="EH-01"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s, W)" },
            { label: "Q", value: `${fmt(r.Q, 3)} m³/s`, tint: C.water },
            { label: "ε", value: `${fmt(r.powerDensity, 0)} W/m³`, tint: r.tooTurbulent ? C.signal : C.energy },
            { label: "V", value: `${fmt(r.slotVelocity, 2)} m/s`, tint: C.water },
            { label: "n", value: fmt(r.poolCount, 0) },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Δh" label={x.dDh} value={dh} min={0.05} max={0.6} step={0.01} digits={2} unit="m" onChange={setDh} tint={C.energy} />
              <InputRow symbol="L" label={x.dL} value={L} min={0.8} max={6} step={0.1} digits={1} unit="m" onChange={setL} />
              <InputRow symbol="B" label={x.dB} value={B} min={0.6} max={5} step={0.1} digits={1} unit="m" onChange={setB} />
              <InputRow symbol="y" label={x.dD} value={D} min={0.4} max={3} step={0.1} digits={1} unit="m" onChange={setD} />
              <InputRow symbol="b₀" label={x.dSlot} value={slot} min={0.1} max={1} step={0.02} digits={2} unit="m" onChange={setSlot} tint={C.critical} />
              <InputRow symbol="H" label={x.dRise} value={rise} min={0.5} max={20} step={0.5} digits={1} unit="m" onChange={setRise} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pBaik, apply: () => { setDh(0.15); setL(3); setB(2); setD(1.5); setSlot(0.25); setRise(4); } },
                  { label: x.pSempit, apply: () => { setDh(0.2); setL(1.2); setB(1); setD(0.8); setSlot(0.3); setRise(4); } },
                  { label: x.pTinggi, apply: () => { setDh(0.35); setL(2.5); setB(1.8); setD(1.2); setSlot(0.3); setRise(4); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={r.tooTurbulent ? undefined : C.water} alert={r.tooTurbulent}>
                {`${fmt(r.powerDensity, 0)} W/m³`}
              </Flag>
              {r.tooTurbulent && <Flag alert>{x.teraduk}</Flag>}
            </div>
            {r.tooTurbulent && (
              <div className="mb-2.5">
                <Note>{x.teradukNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "ε", label: x.rEps, value: fmt(r.powerDensity, 1), unit: "W/m³", tint: r.tooTurbulent ? C.signal : C.energy, strong: true },
                { symbol: "V", label: x.rVslot, value: fmt(r.slotVelocity, 3), unit: "m/s", tint: C.water, strong: true },
                { symbol: "Q", label: x.rQ, value: fmt(r.Q, 4), unit: "m³/s", tint: C.water },
                { symbol: "P", label: x.rPower, value: fmt(r.power, 0), unit: "W" },
                { symbol: "Vk", label: x.rVolume, value: fmt(r.poolVolume, 2), unit: "m³" },
                { symbol: "n", label: x.rCount, value: fmt(r.poolCount, 0) },
                { symbol: "Ltot", label: x.rLength, value: fmt(r.totalLength, 1), unit: "m" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(dh, L, B, D, slot, rise, r.powerDensity, r.slotVelocity, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksPoolFishway(dh, L, B, D, slot, rise)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Q = Cd b₀ y √(2 g Δh)</span>
                <span className="ml-5">V = √(2 g Δh)</span>
              </Eq>
              <Eq>
                <span>ε =</span>
                <Frac num="ρ g Q Δh" den="L B y" />
                <span className="ml-4 text-ink-3">
                  {lang === "id"
                    ? `batas ${fmtPlain(FISHWAY_POWER_WEAK, 0)} sampai ${fmtPlain(FISHWAY_POWER_SALMON, 0)} W/m³ menurut jenis ikannya`
                    : `limits from ${fmtPlain(FISHWAY_POWER_WEAK, 0)} to ${fmtPlain(FISHWAY_POWER_SALMON, 0)} W/m³ depending on the species`}
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
  dh: number,
  L: number,
  B: number,
  D: number,
  slot: number,
  rise: number,
  eps: number,
  vSlot: number,
  lang: Lang
): string {
  const celahKecil = poolFishway(dh, L, B, D, slot / 2, rise);
  const kolamBesar = poolFishway(dh, L * 1.5, B * 1.5, D, slot, rise);

  if (lang === "en")
    return `Halve the slot width and the dissipation goes from ${fmt(eps, 0)} to ${fmt(celahKecil.powerDensity, 0)} W/m³, while the slot velocity does not move at all: it stays ${fmt(vSlot, 2)} m/s, because it depends only on the drop between pools. Enlarge the pool by half in both plan dimensions instead and the dissipation falls to ${fmt(kolamBesar.powerDensity, 0)} W/m³ for the same discharge. The slot sets the velocity, the pool sets the turbulence, and mixing the two up is the most common way a fishway is designed to the wrong criterion.`;
  return `Kecilkan lebar celahnya menjadi separuh dan lesapan dayanya berubah dari ${fmt(eps, 0)} ke ${fmt(celahKecil.powerDensity, 0)} W/m³, sementara kecepatan celahnya tidak bergerak sama sekali: ia tetap ${fmt(vSlot, 2)} m/s, karena ia hanya bergantung pada beda tinggi antar kolam. Perbesar kolamnya setengah kali lipat pada kedua ukuran denahnya, dan lesapan dayanya turun ke ${fmt(kolamBesar.powerDensity, 0)} W/m³ pada debit yang sama. Celah menentukan kecepatan, kolam menentukan keteradukan, dan menukar keduanya adalah cara paling lazim sebuah tangga ikan dirancang terhadap syarat yang salah.`;
}
