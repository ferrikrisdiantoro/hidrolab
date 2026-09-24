"use client";

import { useState } from "react";
import { Basis, Eq, LabShell } from "@/components/LabShell";
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
  drawField,
  type FieldArrow,
  type FieldLine,
  type FieldPatch,
} from "@/lib/drawField";
import { deformation, fmt } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksDeformation } from "@/lib/checks";

const TXT = {
  id: {
    title: "Deformasi fluida",
    sheetTitle: "Satu elemen persegi diurai menjadi putaran, muai, dan geser",
    dA: "∂u/∂x, regangan searah x",
    dB: "∂u/∂y, geser dari kecepatan mendatar",
    dC: "∂v/∂x, geser dari kecepatan tegak",
    dD: "∂v/∂y, regangan searah y",
    dT: "Lama pengamatan",
    pPutar: "Putaran murni, bentuknya tidak berubah",
    pRegang: "Regangan murni, arahnya tidak berputar",
    pGeser: "Geser sederhana, separuh putar separuh regang",
    pMuai: "Memuai, yang mustahil pada air",
    rE1: "Laju regangan utama terbesar",
    rE2: "Laju regangan utama terkecil",
    rSudut: "Arah regangan utama terbesar",
    rVort: "Vortisitas",
    rPutar: "Laju putar elemen",
    rMuai: "Laju pemuaian",
    rGeser: "Laju regangan geser",
    rBagi: "Bagian gerak yang berupa putaran",
    putarMurni: "Putaran murni",
    regangMurni: "Regangan murni",
    campur: "Putaran dan regangan bercampur",
    mampat: "Medan ini memuai, dan air tidak dapat memuai",
    mampatNote:
      "Jumlah kedua regangan searah sumbunya tidak nol, jadi elemen ini berubah volumenya. Air pada tekanan biasa tidak dapat melakukannya: seluruh medan kecepatan air yang benar selalu memenuhi ∂u/∂x + ∂v/∂y = 0. Medan yang sedang digambar sekarang bukan medan yang mustahil dihitung, melainkan medan yang mustahil ada. Nilainya sebagai alat ajar justru di situ: syarat tak mampat bukan rumus tambahan yang dihafal, melainkan satu-satunya yang menjaga luas elemen tetap sepanjang gerakannya, dan di sini luas itu terlihat berubah.",
    note:
      "Gerak sekecil apa pun dari satu elemen fluida selalu dapat diurai menjadi tiga bagian yang tidak bercampur satu sama lain: pemindahan tanpa perubahan, putaran tanpa perubahan bentuk, dan perubahan bentuk tanpa putaran. Yang membuat penguraian ini pantas dipelajari bukan kerapiannya melainkan akibatnya. Tegangan kental fluida hanya lahir dari bagian yang mengubah bentuk, sama sekali bukan dari bagian yang memutar, dan itulah sebabnya air yang berputar sebagai satu benda padat tidak merasakan tegangan geser sedikit pun meskipun setiap butirnya bergerak melingkar. Bagian yang memutar sendiri punya nama sendiri, vortisitas, dan ia dua kali laju putarnya, bukan satu kali. Faktor dua itu sumber kekeliruan yang tidak pernah habis. Perhatikan pula geser sederhana, yaitu keadaan yang paling sering terjadi di dekat dinding: ia tepat separuh putaran dan separuh regangan, tidak pernah salah satunya saja. Itu sebabnya lapisan batas sekaligus membangkitkan vortisitas dan membangkitkan tegangan geser, dan keduanya tidak dapat dipisahkan di sana.",
  },
  en: {
    title: "Fluid deformation",
    sheetTitle: "One square element split into rotation, dilatation, and strain",
    dA: "∂u/∂x, stretching along x",
    dB: "∂u/∂y, shear from the horizontal velocity",
    dC: "∂v/∂x, shear from the vertical velocity",
    dD: "∂v/∂y, stretching along y",
    dT: "Length of observation",
    pPutar: "Pure rotation, the shape does not change",
    pRegang: "Pure strain, the axes do not turn",
    pGeser: "Simple shear, half rotation and half strain",
    pMuai: "Expanding, which water cannot do",
    rE1: "Larger principal strain rate",
    rE2: "Smaller principal strain rate",
    rSudut: "Direction of the larger principal strain",
    rVort: "Vorticity",
    rPutar: "Rotation rate of the element",
    rMuai: "Rate of dilatation",
    rGeser: "Shear strain rate",
    rBagi: "Share of the motion that is rotation",
    putarMurni: "Pure rotation",
    regangMurni: "Pure strain",
    campur: "Rotation and strain mixed",
    mampat: "This field expands, and water cannot expand",
    mampatNote:
      "The two axial strain rates do not sum to zero, so this element changes its volume. Water at ordinary pressures cannot do that: every correct velocity field for water satisfies ∂u/∂x + ∂v/∂y = 0. The field now being drawn is not one that is impossible to compute but one that is impossible to exist. Its worth as a teaching case lies exactly there: the incompressibility condition is not an extra formula to memorise but the one thing that keeps an element's area constant through its motion, and here that area is visibly changing.",
    note:
      "However small the motion of a fluid element, it can always be split into three parts that do not mix: translation without change, rotation without change of shape, and change of shape without rotation. What makes the split worth learning is not its tidiness but its consequence. Viscous stress arises only from the part that changes shape and not at all from the part that rotates, which is why water rotating as a solid body feels no shear stress whatever although every grain of it moves in a circle. The rotating part has its own name, vorticity, and it is twice the rotation rate, not once. That factor of two is an inexhaustible source of error. Notice simple shear as well, the state that occurs most often near a wall: it is exactly half rotation and half strain, never one alone. That is why a boundary layer generates vorticity and shear stress at the same time, and why the two cannot be separated there.",
  },
} as const;

const REFS = {
  id: [
    "Helmholtz, H. von (1858). Über Integrale der hydrodynamischen Gleichungen.",
    "Batchelor, G.K. (1967). An Introduction to Fluid Dynamics, bab 2.",
    "Panton, R.L. (2013). Incompressible Flow, edisi ke-4, bab 4.",
    "Aris, R. (1962). Vectors, Tensors and the Basic Equations of Fluid Mechanics.",
  ],
  en: [
    "Helmholtz, H. von (1858). Über Integrale der hydrodynamischen Gleichungen.",
    "Batchelor, G.K. (1967). An Introduction to Fluid Dynamics, ch. 2.",
    "Panton, R.L. (2013). Incompressible Flow, 4th ed., ch. 4.",
    "Aris, R. (1962). Vectors, Tensors and the Basic Equations of Fluid Mechanics.",
  ],
} as const;

export function DeformasiFluidaClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [a, setA] = useState(0);
  const [b, setB] = useState(1);
  const [c, setC] = useState(0);
  const [d, setD] = useState(0);
  const [waktu, setWaktu] = useState(0.5);

  const r = deformation(a, b, c, d, waktu);

  const ref = useCanvas(
    (ctx, w, ch) => {
      const asli = [
        { x: -0.5, y: -0.5 },
        { x: 0.5, y: -0.5 },
        { x: 0.5, y: 0.5 },
        { x: -0.5, y: 0.5 },
      ];

      const bidang: FieldPatch[] = [
        {
          pts: asli,
          color: C.ink3,
          dash: DASH.hidden,
        },
        {
          pts: r.deformed,
          color: r.incompressible ? C.water : C.signal,
          dash: DASH.solid,
        },
      ];

      /* Sumbu regangan utama, digambar sebagai satu garis lewat titik pusat. */
      const sudut = (r.principalAngle * Math.PI) / 180;
      const garis: FieldLine[] = [
        {
          pts: [
            { x: -0.95 * Math.cos(sudut), y: -0.95 * Math.sin(sudut) },
            { x: 0.95 * Math.cos(sudut), y: 0.95 * Math.sin(sudut) },
          ],
          color: C.critical,
          weight: W.thin,
          dash: DASH.axis,
          label: T.principalAxis,
          labelAt: 0.92,
          labelDy: -9,
          labelAlign: "right",
        },
      ];

      /* Medan kecepatannya sendiri, sebagai panah pada kisi tiga kali tiga. */
      const panah: FieldArrow[] = [];
      const besar = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d), 1e-9);
      const skala = 0.42 / besar;
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++) {
          if (i === 0 && j === 0) continue;
          const px = i * 0.75;
          const py = j * 0.75;
          panah.push({
            x: px,
            y: py,
            dx: (a * px + b * py) * skala,
            dy: (c * px + d * py) * skala,
            color: C.ink3,
            weight: W.hair,
          });
        }

      drawField(
        ctx,
        w,
        ch,
        {
          xMin: -1.35,
          xMax: 1.35,
          yMin: -1.35,
          yMax: 1.35,
          patches: bidang,
          lines: garis,
          arrows: panah,
          regions: [
            { x: -1.1, y: 1.18, text: T.fluidElement, color: C.ink3 },
            {
              x: 1.1,
              y: -1.18,
              text: T.elementAfter,
              color: r.incompressible ? C.water : C.signal,
            },
          ],
          heading: r.incompressible ? undefined : x.mampat,
          headingColor: C.signal,
          axisX: T.axXMetre,
          axisY: T.axYMetre,
        },
        lang
      );
    },
    [a, b, c, d, waktu, lang]
  );

  const keadaan = r.pureRotation
    ? x.putarMurni
    : r.pureStrain
      ? x.regangMurni
      : x.campur;

  return (
    <LabShell
      sheet="FF-06"
      subject={SUBJECTS.FF[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Tegangan kental hanya lahir dari bagian yang{" "}
            <Term tint={C.critical}>mengubah bentuk</Term>, sama sekali bukan
            dari bagian yang <Term tint={C.water}>memutar</Term>.
          </p>
        ) : (
          <p>
            Viscous stress arises only from the part that{" "}
            <Term tint={C.critical}>changes shape</Term>, not at all from the
            part that <Term tint={C.water}>rotates</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FF-06"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (1/s)" },
            { label: "ω", value: `${fmt(r.vorticity, 2)} 1/s`, tint: C.water },
            { label: "ε₁", value: `${fmt(r.principal[0], 2)} 1/s`, tint: C.critical },
            { label: "θ", value: `${fmt(r.principalAngle, 1)}°` },
            {
              label: "∇·u",
              value: `${fmt(r.dilatation, 2)} 1/s`,
              tint: r.incompressible ? undefined : C.signal,
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
              <InputRow symbol="∂u/∂x" label={x.dA} value={a} min={-3} max={3} step={0.1} digits={1} unit="1/s" onChange={setA} />
              <InputRow symbol="∂u/∂y" label={x.dB} value={b} min={-3} max={3} step={0.1} digits={1} unit="1/s" onChange={setB} />
              <InputRow symbol="∂v/∂x" label={x.dC} value={c} min={-3} max={3} step={0.1} digits={1} unit="1/s" onChange={setC} />
              <InputRow symbol="∂v/∂y" label={x.dD} value={d} min={-3} max={3} step={0.1} digits={1} unit="1/s" onChange={setD} />
              <InputRow symbol="t" label={x.dT} value={waktu} min={0.05} max={1} step={0.05} digits={2} unit="s" onChange={setWaktu} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pPutar, apply: () => { setA(0); setB(-1); setC(1); setD(0); setWaktu(0.5); } },
                  { label: x.pRegang, apply: () => { setA(1); setB(0); setC(0); setD(-1); setWaktu(0.5); } },
                  { label: x.pGeser, apply: () => { setA(0); setB(1); setC(0); setD(0); setWaktu(0.5); } },
                  { label: x.pMuai, apply: () => { setA(1); setB(0); setC(0); setD(1); setWaktu(0.5); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={r.pureRotation ? C.water : C.critical}>{keadaan}</Flag>
              {!r.incompressible && <Flag alert>{x.mampat}</Flag>}
            </div>
            {!r.incompressible && (
              <div className="mb-2.5">
                <Note>{x.mampatNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "ε₁", label: x.rE1, value: fmt(r.principal[0], 3), unit: "1/s", tint: C.critical, strong: true },
                { symbol: "ε₂", label: x.rE2, value: fmt(r.principal[1], 3), unit: "1/s", tint: C.critical },
                { symbol: "θ", label: x.rSudut, value: fmt(r.principalAngle, 2), unit: "°" },
                { symbol: "ω", label: x.rVort, value: fmt(r.vorticity, 3), unit: "1/s", tint: C.water, strong: true },
                { symbol: "Ω", label: x.rPutar, value: fmt(r.rotationRate, 3), unit: "1/s", tint: C.water },
                { symbol: "∇·u", label: x.rMuai, value: fmt(r.dilatation, 3), unit: "1/s", tint: r.incompressible ? undefined : C.signal },
                { symbol: "γ̇", label: x.rGeser, value: fmt(r.shearRate, 3), unit: "1/s" },
                { symbol: "—", label: x.rBagi, value: fmt(r.rotationShare * 100, 1), unit: "%" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(a, b, c, d, waktu, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksDeformation(a, b, c, d)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "putaran: Ω = ½(∂v/∂x − ∂u/∂y), vortisitas ω = 2Ω"
                    : "rotation: Ω = ½(∂v/∂x − ∂u/∂y), vorticity ω = 2Ω"}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "muai: ∇·u = ∂u/∂x + ∂v/∂y, yang harus nol pada air"
                    : "dilatation: ∇·u = ∂u/∂x + ∂v/∂y, which must vanish for water"}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "geser: γ̇ = ∂u/∂y + ∂v/∂x, dan hanya inilah yang membangkitkan tegangan kental"
                    : "shear: γ̇ = ∂u/∂y + ∂v/∂x, and this alone generates viscous stress"}
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
  a: number,
  b: number,
  c: number,
  d: number,
  waktu: number,
  lang: Lang
) {
  const r = deformation(a, b, c, d, waktu);
  const geser = deformation(0, 1, 0, 0, waktu);
  const putar = deformation(0, -1, 1, 0, waktu);

  if (lang === "en")
    return `Here ${fmt(r.rotationShare * 100, 0)} per cent of the motion is rotation and the rest is change of shape. Try simple shear, the state nearest a wall: its rotation share is ${fmt(geser.rotationShare * 100, 0)} per cent, exactly half, so it can never be described as shearing alone. Pure rotation, by contrast, reaches ${fmt(putar.rotationShare * 100, 0)} per cent and its principal strain rates are ${fmt(putar.principal[0], 2)} and ${fmt(putar.principal[1], 2)}: the element turns while its shape stays untouched, and a fluid element in that state feels no viscous stress at all.`;
  return `Di sini ${fmt(r.rotationShare * 100, 0)} persen gerakannya berupa putaran dan sisanya perubahan bentuk. Coba geser sederhana, keadaan yang paling dekat dengan dinding: bagian putarnya ${fmt(geser.rotationShare * 100, 0)} persen, tepat separuh, jadi ia tidak pernah dapat disebut menggeser saja. Putaran murni sebaliknya mencapai ${fmt(putar.rotationShare * 100, 0)} persen dan laju regangan utamanya ${fmt(putar.principal[0], 2)} dan ${fmt(putar.principal[1], 2)}: elemennya berputar sementara bentuknya sama sekali tidak tersentuh, dan elemen fluida dalam keadaan itu tidak merasakan tegangan kental sedikit pun.`;
}
