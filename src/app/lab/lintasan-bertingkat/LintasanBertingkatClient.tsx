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
  CASCADE_POOL_RATIO,
  FISHWAY_POWER_GENERAL,
  cascadePassage,
  fmt,
  fmtPlain,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksCascade } from "@/lib/checks";

const TXT = {
  id: {
    title: "Lintasan ikan bertingkat",
    sheetTitle: "Rangkaian bendung bertingkat — tinggi undakan, kedalaman kolam, dan lompatan",
    dRise: "Beda tinggi seluruhnya",
    dSteps: "Banyaknya undakan",
    dL: "Panjang kolam searah aliran",
    dB: "Lebar kolam",
    dD: "Kedalaman kolam yang direncanakan",
    dQ: "Debit yang lewat",
    dU: "Kecepatan sentak ikan rancangan",
    pLandai: "Banyak undakan rendah",
    pCuram: "Sedikit undakan tinggi",
    pDangkal: "Kolam terlalu dangkal",
    rDrop: "Beda tinggi tiap undakan",
    rPerlu: "Kedalaman kolam yang disyaratkan",
    rBurst: "Kecepatan lompat tegak yang dituntut",
    rBurst45: "Bila melompat pada sudut 45 derajat",
    rEps: "Lesapan daya per satuan isi kolam",
    rPanjang: "Panjang lintasan seluruhnya",
    tinggi: "Undakan terlalu tinggi untuk dilompati",
    tinggiNote:
      "Kecepatan lompat yang dituntut melampaui kecepatan sentak ikan rancangan, bahkan pada lompatan tegak yang merupakan batas fisis terkecil. Ikan tidak akan melewatinya, dan menambah debit tidak menolong karena yang menghalangi tinggi undakannya, bukan alirannya. Perbanyak undakannya sehingga tiap undakan menjadi lebih rendah. Perhatikan bahwa memperbanyak undakan memperpanjang seluruh lintasan dalam perbandingan yang sama, dan panjang itulah yang biasanya menjadi batas lahan dan anggaran.",
    dangkal: "Kolam terlalu dangkal",
    dangkalNote:
      "Kedalaman kolam kurang dari satu seperempat kali tinggi terjunannya, sehingga terjunan tidak sempat terlesap sebelum mencapai dasar kolam. Akibatnya dua dan keduanya buruk: dasar kolam tergerus sehingga undakannya kehilangan tumpuan, dan ikan yang mencoba melompat tidak menemukan air yang cukup dalam untuk mengambil ancang-ancang. Perdalam kolamnya, atau perendah undakannya.",
    teraduk: "Kolam terlalu teraduk",
    teradukNote:
      "Lesapan daya per satuan isi kolam melampaui 150 watt per meter kubik. Sama seperti pada tangga ikan berkolam, yang menghalangi ikan pada keadaan ini bukan tinggi undakannya melainkan putaran air di dalam kolam yang membuatnya kehilangan arah. Perbesar kolamnya, atau kurangi debit yang dialirkan lewat lintasan ini dengan membaginya ke lebih dari satu jalur.",
    note:
      "Bentuk lintasan ini yang paling sering dipakai di sungai kecil karena dapat dibuat dari batu setempat tanpa beton dan tanpa alat berat. Yang menentukan keberhasilannya dua hal yang saling bertentangan. Undakan harus cukup rendah untuk dilompati atau direnangi ikan, dan kolam di bawahnya harus cukup dalam untuk melesapkan terjunannya. Menurunkan tinggi undakan memenuhi syarat pertama dan memperbanyak jumlah undakan, dan itu memperpanjang seluruh lintasan dalam perbandingan yang sama; panjang itulah yang menjadi batas lahan maupun anggaran. Satu hal lagi yang perlu diperhatikan tentang angka lompat: tuntutan yang ditampilkan di sini dihitung untuk lompatan tegak, yang merupakan batas fisis terkecil dan tidak dapat dikurangi oleh sudut lompat mana pun. Lompatan pada sudut empat puluh lima derajat menuntut akar dua kali lebih besar, empat puluh satu persen lebih, karena separuh tenaganya terpakai untuk maju mendatar. Rancangan yang ketat sebaiknya memenuhi angka yang kedua, bukan yang pertama.",
  },
  en: {
    title: "Cascade fish passage",
    sheetTitle: "A series of stepped weirs — step height, pool depth, and the jump",
    dRise: "Total rise",
    dSteps: "Number of steps",
    dL: "Pool length along the flow",
    dB: "Pool width",
    dD: "Pool depth planned",
    dQ: "Discharge passing",
    dU: "Burst speed of the design fish",
    pLandai: "Many low steps",
    pCuram: "Few tall steps",
    pDangkal: "Pool too shallow",
    rDrop: "Drop per step",
    rPerlu: "Pool depth required",
    rBurst: "Vertical jump speed demanded",
    rBurst45: "If jumping at forty-five degrees",
    rEps: "Power dissipated per unit pool volume",
    rPanjang: "Total passage length",
    tinggi: "Step too tall to jump",
    tinggiNote:
      "The jump speed demanded exceeds the burst speed of the design fish, even for a vertical jump, which is the smallest physically possible. The fish will not pass, and adding discharge does not help because what blocks it is the height of the step, not the flow. Add steps so that each becomes lower. Note that adding steps lengthens the whole passage in the same proportion, and that length is usually what limits land and budget.",
    dangkal: "Pool too shallow",
    dangkalNote:
      "The pool depth is less than one and a quarter times the drop, so the falling jet does not dissipate before reaching the pool floor. Two consequences follow and both are bad: the floor scours and the step loses its footing, and a fish attempting to jump finds no water deep enough to take a run from. Deepen the pool, or lower the step.",
    teraduk: "Pool too turbulent",
    teradukNote:
      "The power dissipated per unit pool volume exceeds 150 watts per cubic metre. As in a pool fishway, what stops the fish in this state is not the height of the step but the churning of the pool that leaves it disoriented. Enlarge the pool, or reduce the discharge sent down this route by splitting it between more than one path.",
    note:
      "This is the form most often used on small streams, because it can be built from local stone without concrete and without machinery. Two things decide whether it works, and they pull against each other. The step must be low enough to be jumped or swum, and the pool below it must be deep enough to dissipate the falling jet. Lowering the step satisfies the first and increases the number of steps, which lengthens the whole passage in the same proportion; that length is what limits land and budget. One more thing to watch in the jump figures: the demand shown here is computed for a vertical jump, which is the smallest physically possible and cannot be reduced by any launch angle. A jump at forty-five degrees demands the square root of two times more, forty-one per cent above it, because half the energy goes into moving forward. A careful design should meet the second figure rather than the first.",
  },
} as const;

const REFS = {
  id: [
    "FAO/DVWK (2002). Fish Passes: Design, Dimensions and Monitoring. FAO, Roma.",
    "Larinier, M. (2002). Pool fishways, pre-barrages and natural bypass channels. Bulletin Francais de la Peche et de la Pisciculture 364.",
    "Powers, P.D. & Orsborn, J.F. (1985). Analysis of barriers to upstream fish migration. Bonneville Power Administration.",
    "Katopodis, C. (1992). Introduction to Fishway Design. Freshwater Institute, Winnipeg.",
  ],
  en: [
    "FAO/DVWK (2002). Fish Passes: Design, Dimensions and Monitoring. FAO, Rome.",
    "Larinier, M. (2002). Pool fishways, pre-barrages and natural bypass channels. Bulletin Francais de la Peche et de la Pisciculture 364.",
    "Powers, P.D. & Orsborn, J.F. (1985). Analysis of barriers to upstream fish migration. Bonneville Power Administration.",
    "Katopodis, C. (1992). Introduction to Fishway Design. Freshwater Institute, Winnipeg.",
  ],
} as const;

export function LintasanBertingkatClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [rise, setRise] = useState(3);
  const [steps, setSteps] = useState(15);
  const [L, setL] = useState(3);
  const [B, setB] = useState(2);
  const [D, setD] = useState(1);
  const [Q, setQ] = useState(0.5);
  const [burst, setBurst] = useState(2.5);

  const r = cascadePassage(rise, steps, L, B, D, Q, burst);
  const teraduk = r.powerDensity > FISHWAY_POWER_GENERAL;

  const ref = useCanvas(
    (ctx, w, ch) => {
      const tampil = Math.min(steps, 5);
      const tebal = Math.max(L * 0.07, 0.08);
      const badan: StructureBody[] = [];
      const muka: { x: number; z: number }[] = [];
      const dasar: { x: number; z: number }[] = [];

      for (let i = 0; i < tampil; i++) {
        const x0 = i * L;
        const zMuka = (tampil - 1 - i) * r.stepDrop;
        const zLantai = zMuka - D;
        // Ambang batu di ujung hilir tiap kolam.
        badan.push({
          pts: [
            { x: x0 + L - tebal, z: zLantai },
            { x: x0 + L, z: zLantai },
            { x: x0 + L, z: zMuka },
            { x: x0 + L - tebal, z: zMuka },
          ],
        });
        // Lantai kolam.
        badan.push({
          pts: [
            { x: x0, z: zLantai },
            { x: x0 + L, z: zLantai },
            { x: x0 + L, z: zLantai - tebal },
            { x: x0, z: zLantai - tebal },
          ],
        });
        muka.push({ x: x0, z: zMuka });
        muka.push({ x: x0 + L - tebal, z: zMuka });
        dasar.push({ x: x0, z: zLantai });
        dasar.push({ x: x0 + L, z: zLantai });
      }

      const zBawah = -D - tebal * 2;

      const spec: StructureSpec = {
        xMin: -L * 0.1,
        xMax: tampil * L + L * 0.1,
        zMin: zBawah,
        zMax: (tampil - 1) * r.stepDrop + r.stepDrop * 1.5,
        bodies: badan,
        waters: [
          {
            surface: muka,
            bed: [...dasar].reverse(),
            invalid: r.tooHigh || r.poolTooShallow,
          },
        ],
        lines: [
          {
            pts: [
              { x: L * 0.1, z: (tampil - 1) * r.stepDrop - r.requiredPoolDepth },
              { x: L * 0.95, z: (tampil - 1) * r.stepDrop - r.requiredPoolDepth },
            ],
            color: r.poolTooShallow ? C.signal : C.critical,
            weight: W.thin,
            dash: DASH.phantom,
            label: `${fmtPlain(r.requiredPoolDepth, 2)} m`,
            labelAt: 0.5,
            labelDy: 14,
          },
        ],
        dims: [
          {
            axis: "v",
            at: L * 1.02,
            from: (tampil - 2) * r.stepDrop,
            to: (tampil - 1) * r.stepDrop,
            text: `${fmtPlain(r.stepDrop, 2)} m`,
            color: C.energy,
            offset: 22,
          },
        ],
        callouts: [
          {
            x: L - tebal / 2,
            z: (tampil - 1) * r.stepDrop,
            dx: 40,
            dy: -26,
            text: T.stepLabel,
          },
          {
            x: L * 0.5,
            z: (tampil - 1) * r.stepDrop - D * 0.55,
            dx: -6,
            dy: 30,
            text: T.poolLabel,
          },
        ],
        arrows: [{ x: L * 1.5, z: (tampil - 2) * r.stepDrop - D * 0.3, length: -26 }],
        heading: r.tooHigh
          ? x.tinggi
          : r.poolTooShallow
            ? x.dangkal
            : teraduk
              ? x.teraduk
              : undefined,
        headingColor: C.signal,
        axisX: T.axHoriz,
        axisZ: T.axLevel,
      };

      drawStructure(ctx, w, ch, spec, lang);
    },
    [rise, steps, L, B, D, Q, burst, lang]
  );

  return (
    <LabShell
      sheet="EH-03"
      subject={SUBJECTS.EH[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Dua syarat yang menarik ke arah berlawanan:{" "}
            <Term tint={C.energy}>undakan rendah</Term> supaya dapat dilompati,
            dan <Term tint={C.critical}>kolam dalam</Term> supaya terjunannya
            terlesap. Menurunkan undakan memanjangkan seluruh lintasan.
          </p>
        ) : (
          <p>
            Two conditions pulling opposite ways:{" "}
            <Term tint={C.energy}>low steps</Term> so they can be jumped, and{" "}
            <Term tint={C.critical}>deep pools</Term> so the falling jet
            dissipates. Lowering the steps lengthens the whole passage.
          </p>
        )
      }
      drawing={
        <Sheet
          number="EH-03"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "Δz", value: `${fmt(r.stepDrop, 3)} m`, tint: r.tooHigh ? C.signal : C.energy },
            { label: "ymin", value: `${fmt(r.requiredPoolDepth, 2)} m`, tint: r.poolTooShallow ? C.signal : C.critical },
            { label: "u", value: `${fmt(r.requiredBurst, 2)} m/s`, tint: r.tooHigh ? C.signal : undefined },
            { label: "ε", value: `${fmt(r.powerDensity, 0)} W/m³`, tint: teraduk ? C.signal : undefined },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="H" label={x.dRise} value={rise} min={0.3} max={12} step={0.1} digits={1} unit="m" onChange={setRise} />
              <InputRow symbol="N" label={x.dSteps} value={steps} min={2} max={60} step={1} digits={0} onChange={setSteps} tint={C.energy} />
              <InputRow symbol="L" label={x.dL} value={L} min={1} max={8} step={0.2} digits={1} unit="m" onChange={setL} />
              <InputRow symbol="B" label={x.dB} value={B} min={0.8} max={8} step={0.2} digits={1} unit="m" onChange={setB} />
              <InputRow symbol="y" label={x.dD} value={D} min={0.1} max={3} step={0.05} digits={2} unit="m" onChange={setD} tint={C.critical} />
              <InputRow symbol="Q" label={x.dQ} value={Q} min={0.02} max={5} step={0.02} digits={2} unit="m³/s" onChange={setQ} tint={C.water} />
              <InputRow symbol="Ub" label={x.dU} value={burst} min={0.5} max={6} step={0.1} digits={1} unit="m/s" onChange={setBurst} tint={C.signal} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pLandai, apply: () => { setRise(3); setSteps(20); setL(3); setB(2); setD(0.5); setQ(0.5); setBurst(2.5); } },
                  { label: x.pCuram, apply: () => { setRise(3); setSteps(6); setL(3); setB(2); setD(1); setQ(0.5); setBurst(2.5); } },
                  { label: x.pDangkal, apply: () => { setRise(3); setSteps(10); setL(3); setB(2); setD(0.2); setQ(0.5); setBurst(2.5); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={r.tooHigh ? undefined : C.water} alert={r.tooHigh}>
                {`${fmt(r.stepDrop * 1000, 0)} mm`}
              </Flag>
              {r.tooHigh && <Flag alert>{x.tinggi}</Flag>}
              {r.poolTooShallow && <Flag alert>{x.dangkal}</Flag>}
              {teraduk && <Flag alert>{x.teraduk}</Flag>}
            </div>
            {r.tooHigh && (
              <div className="mb-2.5">
                <Note>{x.tinggiNote}</Note>
              </div>
            )}
            {r.poolTooShallow && (
              <div className="mb-2.5">
                <Note>{x.dangkalNote}</Note>
              </div>
            )}
            {teraduk && (
              <div className="mb-2.5">
                <Note>{x.teradukNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "Δz", label: x.rDrop, value: fmt(r.stepDrop, 4), unit: "m", tint: r.tooHigh ? C.signal : C.energy, strong: true },
                { symbol: "u", label: x.rBurst, value: fmt(r.requiredBurst, 3), unit: "m/s", tint: r.tooHigh ? C.signal : undefined, strong: true },
                { symbol: "u45", label: x.rBurst45, value: fmt(r.requiredBurst45, 3), unit: "m/s", tint: r.requiredBurst45 > burst ? C.signal : undefined },
                { symbol: "ymin", label: x.rPerlu, value: fmt(r.requiredPoolDepth, 3), unit: "m", tint: r.poolTooShallow ? C.signal : C.critical },
                { symbol: "ε", label: x.rEps, value: fmt(r.powerDensity, 1), unit: "W/m³", tint: teraduk ? C.signal : undefined },
                { symbol: "Ltot", label: x.rPanjang, value: fmt(steps * L, 1), unit: "m" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(rise, steps, L, B, D, Q, burst, r.stepDrop, r.requiredBurst, r.requiredBurst45, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksCascade(rise, steps, L, B, D, Q, burst)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Δz =</span>
                <Frac num="H" den="N" />
                <span className="ml-5">u = √(2 g Δz)</span>
                <span className="ml-5">u₄₅ = √2 · u</span>
              </Eq>
              <Eq>
                <span>ymin = {fmtPlain(CASCADE_POOL_RATIO, 2)} Δz</span>
                <span className="ml-5">ε =</span>
                <Frac num="ρ g Q Δz" den="L B y" />
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "lompatan tegak batas fisis terkecil, tidak dapat dikurangi sudut mana pun"
                    : "a vertical jump is the smallest physical demand, no angle reduces it"}
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
  rise: number,
  steps: number,
  L: number,
  B: number,
  D: number,
  Q: number,
  burst: number,
  stepDrop: number,
  u: number,
  u45: number,
  lang: Lang
): string {
  // Jumlah undakan terkecil yang masih memenuhi tuntutan lompat tegak.
  const dzMampu = (burst * burst) / (2 * 9.81);
  const perlu = Math.ceil(rise / Math.max(dzMampu, 1e-9));

  if (lang === "en")
    return `A step of ${fmt(stepDrop * 1000, 0)} mm demands ${fmt(u, 2)} m/s for a vertical jump and ${fmt(u45, 2)} m/s at forty-five degrees, against a design burst of ${fmt(burst, 2)} m/s. For the vertical figure alone this rise needs at least ${fmtPlain(perlu, 0)} steps, which is ${fmt(perlu * L, 0)} m of passage at the present pool length. Sweep the number of steps and watch the length and the jump demand move in opposite directions: there is no setting that shortens the passage and lowers the jump at the same time, and choosing between them is the whole design decision.`;
  return `Undakan setinggi ${fmt(stepDrop * 1000, 0)} mm menuntut ${fmt(u, 2)} m/s untuk lompatan tegak dan ${fmt(u45, 2)} m/s pada sudut empat puluh lima derajat, berbanding kecepatan sentak rancangan ${fmt(burst, 2)} m/s. Untuk angka lompatan tegak saja, beda tinggi ini menuntut sedikitnya ${fmtPlain(perlu, 0)} undakan, yaitu ${fmt(perlu * L, 0)} m lintasan pada panjang kolam yang sekarang. Geser jumlah undakannya lalu perhatikan panjang dan tuntutan lompat bergerak berlawanan arah: tidak ada setelan yang memendekkan lintasan sekaligus merendahkan lompatannya, dan memilih di antara keduanya adalah seluruh keputusan perancangannya.`;
}
