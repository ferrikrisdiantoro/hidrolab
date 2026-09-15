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
import { drawStructure, type StructureSpec } from "@/lib/drawStructure";
import { ORIFICE_CC_SLOT, fmt, fmtPlain, sluiceGate } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksSluice } from "@/lib/checks";

const TXT = {
  id: {
    title: "Pintu sorong",
    sheetTitle: "Pintu sorong berbibir tajam — aliran bebas dan aliran tenggelam",
    dY1: "Kedalaman hulu",
    dA: "Bukaan pintu",
    dB: "Lebar saluran",
    dY3: "Kedalaman hilir",
    dCc: "Koefisien kontraksi",
    pBebas: "Aliran bebas",
    pTenggelam: "Aliran tenggelam",
    pBukaBesar: "Bukaan besar",
    rQ: "Debit",
    rCd: "Koefisien debit",
    rY2: "Kedalaman di vena contracta",
    rYc: "Kedalaman lawan loncatan",
    rFr2: "Bilangan Froude di vena contracta",
    rGaya: "Gaya mendatar pada daun pintu",
    rGayaTotal: "Gaya pada seluruh lebar pintu",
    tenggelam: "Pintu tenggelam",
    tenggelamNote:
      "Muka air hilir melampaui kedalaman lawan loncatan dari vena contracta. Loncatan air yang seharusnya terbentuk di hilir pintu terdorong balik dan menenggelamkan bukaannya. Sejak titik itu debitnya tidak lagi ditentukan oleh kedalaman hulu sendirian melainkan oleh selisih muka air hulu dan hilir, dan kepekaan pintu sebagai alat ukur menjadi jauh lebih buruk: selisih dua meter pada muka air hilir mengubah debit lebih banyak daripada selisih dua meter pada muka air hulu. Pintu yang dipakai untuk mengukur debit karena itu harus dipastikan bekerja bebas.",
    diAtasAir: "Bukaan melebihi kedalaman hulu",
    diAtasAirNote:
      "Bukaan pintu lebih besar daripada kedalaman air di hulunya, jadi daun pintunya berada seluruhnya di atas muka air dan tidak menyentuh aliran sama sekali. Yang ada di sana saluran terbuka biasa, bukan pintu, dan tidak ada debit pintu untuk dihitung. Turunkan bukaannya di bawah kedalaman hulu.",
    note:
      "Koefisien debit pintu sorong sering disajikan sebagai angka yang harus dicari di tabel, padahal ia dapat diturunkan seluruhnya dari satu besaran saja, yaitu koefisien kontraksi. Persamaan energi antara hulu dan vena contracta memberi Cd sama dengan Cc dibagi akar dari satu ditambah Cc a per y1, dan bentuk itu otomatis mengecil ketika bukaan mendekati kedalaman hulu. Tidak ada tabel yang perlu dihafal. Yang perlu diperhatikan, gaya pada daun pintu bukan sekadar tekanan hidrostatis pada bidang daunnya. Air yang dipercepat lewat bawah pintu membawa momentum, dan momentum itu mengurangi gaya yang harus ditahan batang pengangkatnya. Selisihnya tidak kecil: pada bukaan kecil di saluran dalam, tekanan hidrostatis saja dapat melebihi gaya sesungguhnya beberapa puluh persen. Menghitungnya dari momentum, bukan dari tekanan, adalah perbedaan antara batang yang kelebihan ukuran dan batang yang pas.",
  },
  en: {
    title: "Sluice gate",
    sheetTitle: "Sharp-edged sluice gate — free flow and submerged flow",
    dY1: "Upstream depth",
    dA: "Gate opening",
    dB: "Channel width",
    dY3: "Downstream depth",
    dCc: "Contraction coefficient",
    pBebas: "Free flow",
    pTenggelam: "Submerged flow",
    pBukaBesar: "Large opening",
    rQ: "Discharge",
    rCd: "Discharge coefficient",
    rY2: "Depth at the vena contracta",
    rYc: "Conjugate depth of the jump",
    rFr2: "Froude number at the vena contracta",
    rGaya: "Horizontal force on the gate leaf",
    rGayaTotal: "Force over the full gate width",
    tenggelam: "Gate submerged",
    tenggelamNote:
      "The tailwater exceeds the conjugate depth of the jump from the vena contracta. The hydraulic jump that should form downstream of the gate is pushed back and drowns the opening. From that point the discharge is no longer set by the upstream depth alone but by the difference between upstream and downstream levels, and the gate becomes far worse as a measuring device: two metres of change downstream now alters the discharge more than two metres of change upstream. A gate used to measure discharge must therefore be kept in free flow.",
    diAtasAir: "Opening exceeds the upstream depth",
    diAtasAirNote:
      "The gate opening is larger than the depth of water upstream, so the gate leaf stands entirely above the surface and does not touch the flow at all. What is there is an ordinary open channel, not a gate, and there is no gate discharge to compute. Lower the opening below the upstream depth.",
    note:
      "The discharge coefficient of a sluice gate is often presented as a number to look up, when it can be derived entirely from one quantity, the contraction coefficient. The energy equation between the upstream section and the vena contracta gives Cd as Cc divided by the square root of one plus Cc a over y1, and that form automatically shrinks as the opening approaches the upstream depth. No table needs memorising. Note also that the force on the gate leaf is not simply the hydrostatic pressure on its face. Water accelerated under the gate carries momentum, and that momentum reduces the force the hoist stem must hold. The difference is not small: on a small opening in a deep channel, hydrostatic pressure alone can exceed the true force by tens of per cent. Computing it from momentum rather than from pressure is the difference between an oversized stem and a right-sized one.",
  },
} as const;

const REFS = {
  id: [
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan, Bab 6.",
    "Rajaratnam, N. & Subramanya, K. (1967). Flow equation for the sluice gate. Journal of the Irrigation and Drainage Division, ASCE, vol. 93.",
    "USBR (1974). Design of Small Canal Structures, bab bangunan pengatur.",
    "Swamee, P.K. (1992). Sluice-gate discharge equations. Journal of Irrigation and Drainage Engineering, vol. 118.",
  ],
  en: [
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan, Chapter 6.",
    "Rajaratnam, N. & Subramanya, K. (1967). Flow equation for the sluice gate. Journal of the Irrigation and Drainage Division, ASCE, vol. 93.",
    "USBR (1974). Design of Small Canal Structures, chapters on control structures.",
    "Swamee, P.K. (1992). Sluice-gate discharge equations. Journal of Irrigation and Drainage Engineering, vol. 118.",
  ],
} as const;

export function PintuSorongClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [y1, setY1] = useState(3);
  const [a, setA] = useState(0.5);
  const [b, setB] = useState(4);
  const [y3, setY3] = useState(0.8);
  const [Cc, setCc] = useState(ORIFICE_CC_SLOT);

  const r = sluiceGate(y1, a, b, y3, Cc);
  const takAda = "—";

  const ref = useCanvas(
    (ctx, w, ch) => {
      const xKiri = -Math.max(y1 * 2.2, 3);
      const xKanan = Math.max(y1 * 2.6, 4);
      const tebalPintu = Math.max(y1 * 0.035, 0.06);

      // Daun pintu: bidang tegak dari bukaan ke atas muka air.
      const daun: { x: number; z: number }[] = [
        { x: -tebalPintu / 2, z: a },
        { x: tebalPintu / 2, z: a },
        { x: tebalPintu / 2, z: y1 * 1.25 },
        { x: -tebalPintu / 2, z: y1 * 1.25 },
      ];

      // Muka air: mendatar di hulu, turun tajam lewat bukaan, lalu keadaan
      // hilir menurut bebas atau tenggelam.
      const muka: { x: number; z: number }[] = r.gateAboveWater
        ? [
            { x: xKiri, z: y1 },
            { x: xKanan, z: y1 },
          ]
        : r.submerged
          ? [
              { x: xKiri, z: y1 },
              { x: -tebalPintu, z: y1 * 0.99 },
              { x: tebalPintu * 3, z: y3 * 1.02 },
              { x: xKanan, z: y3 },
            ]
          : [
              { x: xKiri, z: y1 },
              { x: -tebalPintu, z: y1 * 0.98 },
              { x: tebalPintu, z: r.y2 * 1.35 },
              { x: a * 2.2, z: r.y2 },
              { x: a * 5, z: r.y2 },
              { x: a * 6.5, z: r.yConjugate * 0.75 },
              { x: a * 8.5, z: r.yConjugate },
              { x: xKanan, z: Math.max(r.yConjugate, y3) },
            ];

      const spec: StructureSpec = {
        xMin: xKiri,
        xMax: xKanan,
        zMin: -y1 * 0.12,
        zMax: y1 * 1.35,
        bodies: [
          { pts: daun, color: C.ink },
          {
            pts: [
              { x: xKiri, z: 0 },
              { x: xKanan, z: 0 },
              { x: xKanan, z: -y1 * 0.12 },
              { x: xKiri, z: -y1 * 0.12 },
            ],
          },
        ],
        waters: [
          {
            surface: muka,
            bed: [
              { x: xKanan, z: 0 },
              { x: xKiri, z: 0 },
            ],
            invalid: r.gateAboveWater,
          },
        ],
        lines: r.gateAboveWater
          ? []
          : [
              {
                pts: [
                  { x: a * 2.2, z: r.yConjugate },
                  { x: xKanan, z: r.yConjugate },
                ],
                color: C.critical,
                weight: W.thin,
                dash: DASH.phantom,
                label: `y₂′ ${fmtPlain(r.yConjugate, 2)} m`,
                labelAt: 0.15,
                labelDy: -10,
              },
            ],
        dims: r.gateAboveWater
          ? []
          : [
              {
                axis: "v",
                at: xKiri * 0.62,
                from: 0,
                to: y1,
                text: `y₁ ${fmtPlain(y1, 2)} m`,
                color: C.water,
              },
              {
                axis: "v",
                at: tebalPintu * 4,
                from: 0,
                to: a,
                text: `a ${fmtPlain(a, 2)} m`,
                color: C.ink,
              },
            ],
        callouts: r.gateAboveWater
          ? []
          : [
              {
                x: a * 2.2,
                z: r.y2,
                dx: -8,
                dy: -34,
                text: T.venaSection,
                color: C.signal,
              },
              {
                x: 0,
                z: y1 * 1.1,
                dx: 34,
                dy: -18,
                text: T.gateLeaf,
              },
            ],
        arrows: r.gateAboveWater ? [] : [{ x: xKiri * 0.7, z: y1 * 0.45, length: 26 }],
        heading: r.gateAboveWater
          ? x.diAtasAir
          : r.submerged
            ? T.submergedGate
            : undefined,
        headingColor: C.signal,
        axisX: T.axHoriz,
        axisZ: T.axLevel,
      };

      drawStructure(ctx, w, ch, spec, lang);
    },
    [y1, a, b, y3, Cc, lang]
  );

  return (
    <LabShell
      sheet="HS-03"
      subject={SUBJECTS.HS[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Koefisien debitnya tidak perlu dicari di tabel: ia turun seluruhnya
            dari <Term tint={C.signal}>satu koefisien kontraksi</Term>. Dan gaya
            pada daun pintunya bukan tekanan hidrostatis, melainkan{" "}
            <Term tint={C.energy}>selisih momentum</Term>.
          </p>
        ) : (
          <p>
            The discharge coefficient need not be looked up: it follows entirely
            from <Term tint={C.signal}>one contraction coefficient</Term>. And
            the force on the gate leaf is not hydrostatic pressure but a{" "}
            <Term tint={C.energy}>difference of momentum</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HS-03"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "a/y₁", value: fmt(a / y1, 3), tint: r.gateAboveWater ? C.signal : undefined },
            { label: "Cd", value: r.gateAboveWater ? takAda : fmt(r.Cd, 3) },
            { label: "Q", value: r.gateAboveWater ? takAda : `${fmt(r.Q, 2)} m³/s`, tint: C.water },
            {
              label: "F",
              value: r.gateAboveWater ? takAda : `${fmt(r.gateForce / 1000, 1)} kN/m`,
              tint: C.energy,
            },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="y₁" label={x.dY1} value={y1} min={0.2} max={12} step={0.1} digits={1} unit="m" onChange={setY1} tint={C.water} />
              <InputRow symbol="a" label={x.dA} value={a} min={0.02} max={6} step={0.02} digits={2} unit="m" onChange={setA} />
              <InputRow symbol="b" label={x.dB} value={b} min={0.5} max={30} step={0.5} digits={1} unit="m" onChange={setB} />
              <InputRow symbol="y₃" label={x.dY3} value={y3} min={0.02} max={12} step={0.02} digits={2} unit="m" onChange={setY3} tint={C.signal} />
              <InputRow symbol="Cc" label={x.dCc} value={Cc} min={0.55} max={0.75} step={0.005} digits={3} onChange={setCc} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pBebas, apply: () => { setY1(3); setA(0.5); setB(4); setY3(0.8); setCc(ORIFICE_CC_SLOT); } },
                  { label: x.pTenggelam, apply: () => { setY1(3); setA(0.5); setB(4); setY3(2.2); setCc(ORIFICE_CC_SLOT); } },
                  { label: x.pBukaBesar, apply: () => { setY1(3); setA(2.5); setB(4); setY3(0.8); setCc(ORIFICE_CC_SLOT); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              {!r.gateAboveWater && (
                <Flag tint={r.submerged ? undefined : C.water} alert={r.submerged}>
                  {`${fmt(r.Q, 2)} m³/s`}
                </Flag>
              )}
              {r.submerged && <Flag alert>{x.tenggelam}</Flag>}
              {r.gateAboveWater && <Flag alert>{x.diAtasAir}</Flag>}
            </div>
            {r.gateAboveWater && (
              <div className="mb-2.5">
                <Note>{x.diAtasAirNote}</Note>
              </div>
            )}
            {r.submerged && (
              <div className="mb-2.5">
                <Note>{x.tenggelamNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "Q", label: x.rQ, value: r.gateAboveWater ? takAda : fmt(r.Q, 3), unit: r.gateAboveWater ? undefined : "m³/s", tint: C.water, strong: true },
                { symbol: "Cd", label: x.rCd, value: r.gateAboveWater ? takAda : fmt(r.Cd, 4), strong: true },
                { symbol: "y₂", label: x.rY2, value: r.gateAboveWater ? takAda : fmt(r.y2, 4), unit: r.gateAboveWater ? undefined : "m", tint: C.signal },
                { symbol: "y₂′", label: x.rYc, value: r.gateAboveWater ? takAda : fmt(r.yConjugate, 4), unit: r.gateAboveWater ? undefined : "m", tint: C.critical },
                { symbol: "Fr₂", label: x.rFr2, value: r.gateAboveWater ? takAda : fmt(r.Fr2, 3) },
                { symbol: "F", label: x.rGaya, value: r.gateAboveWater ? takAda : fmt(r.gateForce / 1000, 3), unit: r.gateAboveWater ? undefined : "kN/m", tint: C.energy },
                { symbol: "Ftot", label: x.rGayaTotal, value: r.gateAboveWater ? takAda : fmt((r.gateForce * b) / 1000, 2), unit: r.gateAboveWater ? undefined : "kN", tint: C.energy },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(y1, a, b, y3, Cc, r.gateForce, r.gateAboveWater, r.submerged, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksSluice(y1, a, b, y3, Cc)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Q = Cd b a √(2 g y₁)</span>
                <span className="ml-5">Cd =</span>
                <Frac num="Cc" den="√(1 + Cc a / y₁)" />
              </Eq>
              <Eq>
                <span>F = M₁ − M₂</span>
                <span className="ml-4">M =</span>
                <Frac num="ρ g y²" den="2" />
                <span>+</span>
                <Frac num="ρ q²" den="y" />
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "tenggelam bila y₃ melebihi kedalaman lawan loncatan dari vena contracta"
                    : "submerged when y₃ exceeds the conjugate depth from the vena contracta"}
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
  y1: number,
  a: number,
  b: number,
  y3: number,
  Cc: number,
  gateForce: number,
  gateAboveWater: boolean,
  submerged: boolean,
  lang: Lang
): string {
  if (gateAboveWater) {
    return lang === "id"
      ? "Turunkan bukaannya di bawah kedalaman hulu, lalu seluruh angka di atas kembali punya arti."
      : "Lower the opening below the upstream depth and every number above becomes meaningful again.";
  }

  // Tekanan hidrostatis pada bidang daun pintu saja, sebagai pembanding.
  const hidrostatis = (1000 * 9.81 * (y1 - a) * (y1 - a)) / 2;
  const selisih =
    gateForce > 0 ? ((hidrostatis - gateForce) / gateForce) * 100 : 0;

  if (lang === "en")
    return `Hydrostatic pressure on the gate face alone would give ${fmt(hidrostatis / 1000, 1)} kN per metre of width, against ${fmt(gateForce / 1000, 1)} kN from momentum: ${fmt(Math.abs(selisih), 0)} per cent ${selisih > 0 ? "more" : "less"}. The difference is the momentum the flow carries away under the gate, and a stem sized on pressure alone carries that margin for nothing. ${submerged ? "Note that the gate is currently submerged, which lowers both the discharge and the force: the tailwater pushes back." : "Raise the tailwater past the conjugate depth and watch both the discharge and the force fall together."}`;
  return `Tekanan hidrostatis pada bidang daun pintu saja akan memberi ${fmt(hidrostatis / 1000, 1)} kN tiap meter lebar, berbanding ${fmt(gateForce / 1000, 1)} kN dari momentum: ${fmt(Math.abs(selisih), 0)} persen lebih ${selisih > 0 ? "besar" : "kecil"}. Selisih itu adalah momentum yang dibawa pergi aliran di bawah pintu, dan batang pengangkat yang diukur dari tekanan saja memikul kelebihan itu tanpa perlu. ${submerged ? "Perhatikan bahwa pintunya sedang tenggelam, dan itu menurunkan debit maupun gayanya sekaligus: air hilir menekan balik." : "Naikkan muka air hilirnya melewati kedalaman lawan loncatan, lalu perhatikan debit dan gayanya turun bersama-sama."}`;
}
