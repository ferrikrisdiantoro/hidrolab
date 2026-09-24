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
import {
  bendPlan,
  drawStructure,
  type StructureDim,
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
    title: "Momentum dalam pipa",
    sheetTitle: "Perubahan penampang mendadak: tekanan naik, energi hilang",
    dQ: "Debit",
    dD1: "Garis tengah sebelum perubahan",
    dD2: "Garis tengah sesudah perubahan",
    dH: "Tinggi tekan sebelum perubahan",
    pBesar: "Pembesaran mendadak",
    pBesarSekali: "Pembesaran ke penampang jauh lebih besar",
    pKecil: "Penyempitan mendadak",
    rV1: "Kecepatan sebelum",
    rV2: "Kecepatan sesudah",
    rH2: "Tinggi tekan sesudah",
    rNaik: "Kenaikan tinggi tekan",
    rHilang: "Tinggi energi yang hilang",
    rF: "Gaya mendatar pada dinding anak tangga",
    rBagi: "Bagian tinggi kecepatan yang berhasil dipulihkan",
    tekananNaik: "Tekanan naik meskipun energi hilang",
    tekananTurun: "Tekanan turun, penampang menyempit",
    labelStep: "anak tangga",
    labelGaya: "gaya pada anak tangga",
    note:
      "Dua pernyataan pada lembar ini terdengar bertentangan padahal keduanya benar sekaligus, dan yang membuatnya terdengar bertentangan hanyalah kebiasaan menyamakan tekanan dengan energi. Pada pembesaran mendadak tekanan NAIK, karena air melambat dan sebagian tinggi kecepatannya berubah menjadi tinggi tekan. Pada saat yang sama energi HILANG, karena perlambatannya terjadi dengan olakan yang tidak pernah kembali menjadi apa pun. Yang naik dan yang hilang bukan besaran yang sama: tinggi kecepatan yang dilepas lebih besar daripada tinggi tekan yang didapat, dan selisih keduanya itulah yang hilang. Rumus kehilangannya, kuadrat SELISIH kecepatan dan bukan selisih kuadratnya, adalah tempat kesalahan hitung paling sering terjadi, dan keduanya tidak pernah berbeda jauh sehingga kesalahannya jarang mencolok, tetapi arah kesimpulannya bisa terbalik. Perhatikan pula batasnya: pada pembesaran ke penampang yang jauh lebih besar, seluruh tinggi kecepatan hilang dan tidak ada yang dipulihkan sama sekali. Itulah sebabnya pipa yang bermuara ke waduk kehilangan satu tinggi kecepatan penuh, tidak peduli sebesar apa waduknya.",
  },
  en: {
    title: "Pipe momentum",
    sheetTitle: "A sudden change of section: the pressure rises, the energy goes",
    dQ: "Discharge",
    dD1: "Diameter before the change",
    dD2: "Diameter after the change",
    dH: "Pressure head before the change",
    pBesar: "Sudden enlargement",
    pBesarSekali: "Enlargement into a far larger section",
    pKecil: "Sudden contraction",
    rV1: "Velocity before",
    rV2: "Velocity after",
    rH2: "Pressure head after",
    rNaik: "Rise in pressure head",
    rHilang: "Head lost",
    rF: "Horizontal force on the step wall",
    rBagi: "Share of the velocity head actually recovered",
    tekananNaik: "The pressure rises although energy is lost",
    tekananTurun: "The pressure falls, the section narrows",
    labelStep: "step",
    labelGaya: "force on the step",
    note:
      "Two statements on this sheet sound contradictory although both are true at once, and what makes them sound so is only the habit of treating pressure as energy. Across a sudden enlargement the pressure RISES, because the water slows and part of its velocity head turns into pressure head. At the same moment energy is LOST, because the slowing happens through eddies that never turn back into anything. What rises and what is lost are not the same quantity: the velocity head given up is larger than the pressure head gained, and the difference between them is what is lost. The loss formula, the square of the DIFFERENCE of the velocities rather than the difference of their squares, is where the arithmetic most often goes wrong, and the two are never far apart so the error rarely stands out, although the direction of the conclusion can invert. Notice the limit as well: enlarging into a far larger section loses the whole velocity head and recovers nothing at all. That is why a pipe discharging into a reservoir loses one full velocity head, however large the reservoir is.",
  },
} as const;

const REFS = {
  id: [
    "Borda, J.-C. (1766). Mémoire sur l'écoulement des fluides par les orifices des vases.",
    "Carnot, L. (1783). Essai sur les machines en général.",
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, edisi ke-8, bab 3 dan 5.",
    "Idelchik, I.E. (1996). Handbook of Hydraulic Resistance, edisi ke-3, diagram 4-1.",
  ],
  en: [
    "Borda, J.-C. (1766). Mémoire sur l'écoulement des fluides par les orifices des vases.",
    "Carnot, L. (1783). Essai sur les machines en général.",
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, 8th ed., ch. 3 and 5.",
    "Idelchik, I.E. (1996). Handbook of Hydraulic Resistance, 3rd ed., diagram 4-1.",
  ],
} as const;

export function MomentumPipaClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Q, setQ] = useState(0.25);
  const [D1, setD1] = useState(0.25);
  const [D2, setD2] = useState(0.45);
  const [head, setHead] = useState(30);

  const r = momentumForce(Q, D1, D2, head, 0);
  const hv1 = (r.velocity1 * r.velocity1) / (2 * G);
  const hv2 = (r.velocity2 * r.velocity2) / (2 * G);
  const naik = r.head2 - head;
  const dilepas = hv1 - hv2;
  const pulih = dilepas > 1e-12 ? naik / dilepas : 0;

  const ref = useCanvas(
    (ctx, w, ch) => {
      /*
       * Bidang ini memakai satu sumbu tegak untuk DUA hal sekaligus: jari-jari
       * pipanya dan tinggi tekan yang diukur dari tinggi tekan hulu. Keduanya
       * memang sebanding: tinggi kecepatan pipa air sehari-hari beberapa puluh
       * sentimeter, sebesar jari-jari pipanya sendiri. Kalau tinggi tekan
       * mutlaknya yang dipakai, puluhan meter itu akan menyisakan pipa
       * setinggi satu piksel.
       */
      const L = Math.max(D1, D2) * 2.6;
      const badan = bendPlan(D1, D2, 0, L, L);

      const garis: StructureLine[] = [
        {
          pts: [
            { x: -L, z: 0 },
            { x: L, z: 0 },
          ],
          color: C.ink3,
          weight: W.hair,
          dash: DASH.axis,
        },
        {
          /* Garis tekanan, diukur dari tinggi tekan hulu. */
          pts: [
            { x: -L, z: 0 },
            { x: 0, z: 0 },
            { x: L * 0.35, z: naik },
            { x: L, z: naik },
          ],
          color: C.water,
          weight: W.bold,
          dash: DASH.hidden,
          label: T.hydraulicGrade,
          labelAt: 0.98,
          labelDy: -10,
          labelAlign: "right",
        },
        {
          /* Garis energi, diukur dari tinggi tekan hulu yang sama. */
          pts: [
            { x: -L, z: hv1 },
            { x: 0, z: hv1 },
            { x: L * 0.35, z: naik + hv2 },
            { x: L, z: naik + hv2 },
          ],
          color: C.energy,
          weight: W.bold,
          dash: DASH.solid,
          label: T.energyGrade,
          labelAt: 0.02,
          labelDy: -10,
          labelAlign: "left",
        },
      ];

      const dims: StructureDim[] = [
        {
          axis: "v",
          at: L * 0.85,
          from: naik + hv2,
          to: hv1,
          text: `hL ${fmtPlain(r.expansionLoss, 3)} m`,
          color: C.energy,
          offset: 26,
        },
        {
          axis: "v",
          at: L * 0.55,
          from: 0,
          to: naik,
          text: `Δp/γ ${fmtPlain(naik, 3)} m`,
          color: naik >= 0 ? C.water : C.critical,
          offset: 26,
        },
      ];

      /* Gaya mendatar pada dinding anak tangganya, digambar di anak tangganya
         sendiri dan bukan di sumbu pipanya. */
      const zStep = (Math.max(D1, D2) + Math.min(D1, D2)) / 4;
      const panah: StructureVector[] =
        Math.abs(r.Fx) > 1
          ? [
              {
                x: 0,
                z: zStep,
                dx: r.Fx > 0 ? 56 : -56,
                dy: 0,
                text: `${x.labelGaya} ${fmtPlain(Math.abs(r.Fx) / 1000, 2)} kN`,
                color: C.energy,
                root: true,
              },
            ]
          : [];

      const tinggi = Math.max(D1, D2) / 2;
      const zMax = Math.max(tinggi, hv1, naik + hv2) * 1.35 + 0.02;
      const zMin = Math.min(-tinggi, naik) * 1.35 - 0.02;
      drawStructure(
        ctx,
        w,
        ch,
        {
          xMin: -L * 1.05,
          xMax: L * 1.12,
          zMin,
          zMax,
          equalScale: false,
          bodies: [{ pts: badan, hatch: "none", outline: true }],
          lines: garis,
          dims,
          vectors: panah,
          callouts: [{ x: 0, z: -zStep, dx: -14, dy: 24, text: x.labelStep }],
          heading: r.pressureRises ? x.tekananNaik : x.tekananTurun,
          headingColor: r.pressureRises ? C.water : C.critical,
          axisX: T.axAlongDuct,
          axisZ: T.axHeadM,
        },
        lang
      );
    },
    [Q, D1, D2, head, lang]
  );

  return (
    <LabShell
      sheet="PI-06"
      subject={SUBJECTS.PI[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Pada pembesaran mendadak,{" "}
            <Term tint={C.water}>tekanannya naik</Term> sementara{" "}
            <Term tint={C.energy}>energinya hilang</Term>. Keduanya benar
            sekaligus, karena yang dilepas lebih besar daripada yang didapat.
          </p>
        ) : (
          <p>
            Across a sudden enlargement the{" "}
            <Term tint={C.water}>pressure rises</Term> while the{" "}
            <Term tint={C.energy}>energy is lost</Term>. Both are true at once,
            because what is given up exceeds what is gained.
          </p>
        )
      }
      drawing={
        <Sheet
          number="PI-06"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s, kN)" },
            { label: "Δp/γ", value: `${fmt(naik, 3)} m`, tint: naik >= 0 ? C.water : C.critical },
            { label: "hL", value: `${fmt(r.expansionLoss, 3)} m`, tint: C.energy },
            { label: "V₁", value: `${fmt(r.velocity1, 2)} m/s` },
            { label: "V₂", value: `${fmt(r.velocity2, 2)} m/s` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q * 1000} min={5} max={1500} step={5} digits={0} unit="l/s" onChange={(v) => setQ(v / 1000)} tint={C.water} />
              <InputRow symbol="D₁" label={x.dD1} value={D1 * 1000} min={50} max={800} step={10} digits={0} unit="mm" onChange={(v) => setD1(v / 1000)} />
              <InputRow symbol="D₂" label={x.dD2} value={D2 * 1000} min={50} max={1600} step={10} digits={0} unit="mm" onChange={(v) => setD2(v / 1000)} tint={C.critical} />
              <InputRow symbol="h₁" label={x.dH} value={head} min={0} max={150} step={1} digits={0} unit="m" onChange={setHead} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pBesar, apply: () => { setQ(0.25); setD1(0.25); setD2(0.45); setHead(30); } },
                  { label: x.pBesarSekali, apply: () => { setQ(0.25); setD1(0.25); setD2(1.6); setHead(30); } },
                  { label: x.pKecil, apply: () => { setQ(0.25); setD1(0.45); setD2(0.25); setHead(30); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5">
              <Flag tint={r.pressureRises ? C.water : C.critical}>
                {r.pressureRises ? x.tekananNaik : x.tekananTurun}
              </Flag>
            </div>
            <ResultTable
              rows={[
                { symbol: "V₁", label: x.rV1, value: fmt(r.velocity1, 3), unit: "m/s" },
                { symbol: "V₂", label: x.rV2, value: fmt(r.velocity2, 3), unit: "m/s" },
                { symbol: "h₂", label: x.rH2, value: fmt(r.head2, 3), unit: "m" },
                { symbol: "Δp/γ", label: x.rNaik, value: fmt(naik, 4), unit: "m", tint: naik >= 0 ? C.water : C.critical, strong: true },
                { symbol: "hL", label: x.rHilang, value: fmt(r.expansionLoss, 4), unit: "m", tint: C.energy, strong: true },
                { symbol: "Fx", label: x.rF, value: fmt(r.Fx / 1000, 2), unit: "kN" },
                { symbol: "—", label: x.rBagi, value: fmt(pulih * 100, 1), unit: "%" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(Q, D1, D2, head, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksMomentum(Q, D1, D2, head, 0)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>hL =</span>
                <Frac num="(V₁ − V₂)²" den="2g" />
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "kuadrat selisihnya, bukan selisih kuadratnya"
                    : "the square of the difference, not the difference of the squares"}
                </span>
              </Eq>
              <Eq>
                <Frac num="Δp" den="γ" />
                <span>=</span>
                <Frac num="V₁² − V₂²" den="2g" />
                <span>− hL =</span>
                <Frac num="V₂(V₁ − V₂)" den="g" />
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
  Q: number,
  D1: number,
  D2: number,
  head: number,
  lang: Lang
): string {
  const a = momentumForce(Q, D1, D2, head, 0);
  const hv1 = (a.velocity1 * a.velocity1) / (2 * G);
  const hv2 = (a.velocity2 * a.velocity2) / (2 * G);
  const naik = a.head2 - head;
  /* Kehilangan yang keliru: selisih kuadrat, bukan kuadrat selisih. */
  const salah = hv1 - hv2;
  const besar = momentumForce(Q, D1, D1 * 8, head, 0);
  const hvBesar = (besar.velocity1 * besar.velocity1) / (2 * G);

  if (lang === "en")
    return `The water gives up ${fmt(hv1 - hv2, 3)} metres of velocity head here and gets back ${fmt(naik, 3)} metres of pressure head, so ${fmt(a.expansionLoss, 3)} metres are simply gone. Computing the loss as the difference of the squares rather than the square of the difference would have given ${fmt(salah, 3)} metres, which is the whole of what was given up, and would have left no pressure rise at all. Now push the downstream diameter to eight times the upstream one: the recovered head falls to ${fmt(besar.head2 - head, 4)} metres while the loss climbs to ${fmt(besar.expansionLoss, 3)}, that is the full velocity head of ${fmt(hvBesar, 3)} metres. That limit is the reason a pipe ending in a reservoir loses one whole velocity head.`;
  return `Airnya melepas ${fmt(hv1 - hv2, 3)} meter tinggi kecepatan di sini dan mendapat kembali ${fmt(naik, 3)} meter tinggi tekan, jadi ${fmt(a.expansionLoss, 3)} meter memang hilang. Menghitung kehilangannya sebagai selisih kuadrat dan bukan kuadrat selisih akan memberi ${fmt(salah, 3)} meter, yaitu seluruh yang dilepas, dan tidak akan menyisakan kenaikan tekanan sama sekali. Sekarang dorong garis tengah hilirnya sampai delapan kali garis tengah hulunya: tinggi yang dipulihkan turun ke ${fmt(besar.head2 - head, 4)} meter sementara kehilangannya naik ke ${fmt(besar.expansionLoss, 3)}, yaitu tinggi kecepatan penuh sebesar ${fmt(hvBesar, 3)} meter. Batas itulah sebabnya pipa yang bermuara ke waduk kehilangan satu tinggi kecepatan utuh.`;
}
