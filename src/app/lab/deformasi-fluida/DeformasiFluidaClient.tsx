"use client";

import { useRef, useState } from "react";
import { Basis, Eq, LabShell } from "@/components/LabShell";
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
import { usePlate, usePutar } from "@/lib/usePlate";
import {
  createDeformMotion,
  drawDeformMotion,
  type DeformMotion,
} from "@/lib/drawFieldMotion";
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

/** Lapis gerak: waktu diperlambat empat kali (t paling lama 1 s). */
const SKALA_WAKTU = 0.25;

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
    muaiMerata: "Muai merata",
    diam: "Tanpa gerak relatif",
    rLuas: "Luas elemen satuan sesudah t",
    bandRegang: "Regangan lebih besar",
    bandPutar: "Putaran lebih besar",
    tanpaBagian: "Tidak ada putaran maupun regangan geser",
    sState: (k: string, pct: string, w: string, e1: string) =>
      `${k}: ${pct} % putaran, ω = ${w} 1/s, ε₁ = ${e1} 1/s.`,
    sDiam: (k: string) =>
      `${k}: keempat kemiringan kecepatan nol, jadi elemennya hanya berpindah tanpa berputar dan tanpa berubah bentuk.`,
    sMuai: (k: string, dil: string, luas: string) =>
      `${k}: elemennya mengembang sama ke segala arah (∇·u = ${dil} 1/s, luas menjadi ${luas}), tanpa putaran dan tanpa regangan geser.`,
    nGeser: (pct: string) =>
      `Geser sederhana, keadaan yang paling dekat dengan dinding, selalu ${pct} % putaran: tepat separuh, jadi ia tidak pernah dapat disebut menggeser saja.`,
    nPutar: (pct: string, e1: string, e2: string) =>
      `Putaran murni mencapai ${pct} % dengan ε₁ = ${e1} dan ε₂ = ${e2} 1/s: elemennya berputar tanpa berubah bentuk, dan tidak merasakan tegangan kental sedikit pun.`,
    nLuas: (luas: string) =>
      `Luas elemen sesudah t tetap ${luas}: syarat tak mampat ∇·u = 0 yang menjaganya.`,
    jMuai: "Laju pemuaian",
    jVort: "Vortisitas",
    jPutar: "Laju putar elemen",
    jGeser: "Laju regangan geser",
    jUtama: "Laju regangan utama",
    jSudut: "Arah regangan utama terbesar",
    jBagi: "Bagian gerak yang berupa putaran",
    jLuas: "Luas elemen satuan sesudah t (Liouville)",
    motionNote: "diputar ulang 0 sampai t, waktu diperlambat ×4",
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
    muaiMerata: "Uniform expansion",
    diam: "No relative motion",
    rLuas: "Area of the unit element after t",
    bandRegang: "Strain dominates",
    bandPutar: "Rotation dominates",
    tanpaBagian: "Neither rotation nor shear strain",
    sState: (k: string, pct: string, w: string, e1: string) =>
      `${k}: ${pct} % rotation, ω = ${w} 1/s, ε₁ = ${e1} 1/s.`,
    sDiam: (k: string) =>
      `${k}: all four velocity gradients are zero, so the element only translates, without rotating and without changing shape.`,
    sMuai: (k: string, dil: string, luas: string) =>
      `${k}: the element grows equally in every direction (∇·u = ${dil} 1/s, area becomes ${luas}), with no rotation and no shear strain.`,
    nGeser: (pct: string) =>
      `Simple shear, the state nearest a wall, is always ${pct} % rotation: exactly half, so it can never be described as shearing alone.`,
    nPutar: (pct: string, e1: string, e2: string) =>
      `Pure rotation reaches ${pct} % with ε₁ = ${e1} and ε₂ = ${e2} 1/s: the element turns without changing shape and feels no viscous stress at all.`,
    nLuas: (luas: string) =>
      `The element's area after t stays ${luas}: the incompressibility condition ∇·u = 0 is what keeps it.`,
    jMuai: "Rate of dilatation",
    jVort: "Vorticity",
    jPutar: "Rotation rate of the element",
    jGeser: "Shear strain rate",
    jUtama: "Principal strain rates",
    jSudut: "Direction of the larger principal strain",
    jBagi: "Share of the motion that is rotation",
    jLuas: "Area of the unit element after t (Liouville)",
    motionNote: "replayed from 0 to t, time slowed ×4",
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
  /*
   * Sumbu regangan utama hanya ada bila kedua regangan utamanya berbeda.
   * Pada putaran murni keduanya nol dan pada muai merata keduanya sama,
   * sehingga SETIAP arah sama utamanya. Sebelumnya lembar ini tetap
   * menggambar satu sumbu dan menulis sudutnya 0°, arah yang sepenuhnya
   * ditentukan oleh atan2(0, 0) dan bukan oleh alirannya.
   */
  const adaSumbu = r.principal[0] - r.principal[1] > 1e-9;

  /* Lapis gerak (Phase 2): elemen berkisi dibawa medan dari 0 sampai t,
     dan pelacak yang mengikuti u = A x. Selagi bergerak, panah kecepatan
     di lapis statis diganti goresan pelacaknya. */
  const { playing, toggle: togglePutar } = usePutar();
  const gerak = useRef<DeformMotion | null>(null);
  if (gerak.current === null) gerak.current = createDeformMotion();
  const bergerak = playing;

  const plate = usePlate(
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
      const garis: FieldLine[] = [];
      if (adaSumbu)
        garis.push({
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
        });

      /*
       * Bingkai mengikuti bentuk sesudahnya. Dengan bingkai tetap ±1,35,
       * elemen yang memanjang pada muai atau geser besar terpotong di tepi
       * dan menabrak judulnya. Ruang di atas ditambah bila judulnya tampil.
       */
      const jangkau = Math.max(
        0.95,
        ...r.deformed.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y)))
      );
      const tepi = jangkau * 1.3;
      const atasJudul = r.incompressible ? 0 : tepi * 0.22;

      /* Nama bentuk ditaruh menempel pada bentuknya sendiri: nama elemen
         asal di dalam persegi putus-putus, nama bentuk sesudahnya di bawah
         titik terendahnya, tempat yang pasti kosong dari bentuk itu. */
      const terendah = r.deformed.reduce((m, p) => (p.y < m.y ? p : m));

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

      return drawField(
        ctx,
        w,
        ch,
        {
          xMin: -tepi,
          xMax: tepi,
          yMin: -tepi,
          yMax: tepi + atasJudul,
          patches: bidang,
          lines: garis,
          arrows: bergerak ? [] : panah,
          regions: [
            { x: 0, y: 0.34, text: T.fluidElement, color: C.ink3 },
            {
              x: terendah.x,
              y: terendah.y - tepi * 0.12,
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
    (ctx, _w, _h, tt, dt, out) =>
      drawDeformMotion(
        ctx,
        tt,
        dt,
        out,
        { a, b, c, d, waktu, invalid: !r.incompressible },
        gerak.current!
      ),
    [a, b, c, d, waktu, lang, bergerak],
    { playing, timeScale: SKALA_WAKTU }
  );

  const keadaan = r.still
    ? x.diam
    : r.pureDilatation
      ? x.muaiMerata
      : r.pureRotation
        ? x.putarMurni
        : r.pureStrain
          ? x.regangMurni
          : x.campur;
  /* Bagian putaran tidak bermakna bila tidak ada putaran maupun regangan
     geser (muai merata atau diam): model memberi 0, bukan "tidak ada". */
  const adaBagian = !r.still && !r.pureDilatation;
  const mampat = !r.incompressible;
  const ex = (a - d) / 2;
  const exy = (b + c) / 2;

  return (
    <LabShell
      status={
        /* Bagian putaran |Ω| / (|Ω| + √(((εxx − εyy)/2)² + (γ̇/2)²)) dari
           deformation. Acuan: 0 regangan murni, 50 geser sederhana, 100
           putaran murni (Helmholtz 1858; Batchelor 1967 §2.3). Merah sinyal
           untuk medan memuai sah: air tak mampat, di luar rentang lembar. */
        <RegimeScale
          symbol={lang === "id" ? "bagian putaran" : "rotation share"}
          value={adaBagian ? r.rotationShare * 100 : NaN}
          invalid={mampat}
          pesan={mampat ? x.mampat : adaBagian ? undefined : x.tanpaBagian}
          digits={1}
          bands={[
            { from: 0, to: 50, label: x.bandRegang, tone: "critical" },
            { from: 50, to: 100, label: x.bandPutar, tone: "water" },
          ]}
        />
      }
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
            { label: "θ", value: adaSumbu ? `${fmt(r.principalAngle, 1)}°` : "—" },
            {
              label: "∇·u",
              value: `${fmt(r.dilatation, 2)} 1/s`,
              tint: r.incompressible ? undefined : C.signal,
            },
          ]}
          motion={{
            playing,
            onToggle: togglePutar,
            allowed: plate.motionAllowed,
            note: x.motionNote,
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
            <ResultTable
              rows={[
                { symbol: "ε₁", label: x.rE1, value: fmt(r.principal[0], 3), unit: "1/s", tint: C.critical, strong: true },
                { symbol: "ε₂", label: x.rE2, value: fmt(r.principal[1], 3), unit: "1/s", tint: C.critical },
                { symbol: "θ", label: x.rSudut, value: adaSumbu ? fmt(r.principalAngle, 2) : "—", unit: adaSumbu ? "°" : undefined },
                { symbol: "ω", label: x.rVort, value: fmt(r.vorticity, 3), unit: "1/s", tint: C.water, strong: true },
                { symbol: "Ω", label: x.rPutar, value: fmt(r.rotationRate, 3), unit: "1/s", tint: C.water },
                { symbol: "∇·u", label: x.rMuai, value: fmt(r.dilatation, 3), unit: "1/s", tint: mampat ? C.signal : undefined },
                { symbol: "γ̇", label: x.rGeser, value: fmt(r.shearRate, 3), unit: "1/s" },
                { symbol: "Ω/Σ", label: x.rBagi, value: adaBagian ? fmt(r.rotationShare * 100, 1) : "—", unit: adaBagian ? "%" : undefined, strong: true },
                { symbol: "A", label: x.rLuas, value: fmt(r.deformedArea, 4), tint: mampat ? C.signal : undefined },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.jMuai,
                    rumus: <span>∇·u = ∂u/∂x + ∂v/∂y</span>,
                    isi: `${fmt(a, 1)} + ${kurung(d, 1)}`,
                    hasil: fmt(r.dilatation, 3),
                    satuan: "1/s",
                    tint: mampat ? C.signal : undefined,
                  },
                  {
                    judul: x.jVort,
                    rumus: <span>ω = ∂v/∂x − ∂u/∂y</span>,
                    isi: `${fmt(c, 1)} − ${kurung(b, 1)}`,
                    hasil: fmt(r.vorticity, 3),
                    satuan: "1/s",
                    tint: C.water,
                  },
                  {
                    judul: x.jPutar,
                    rumus: <span>Ω = ω / 2</span>,
                    isi: `${fmt(r.vorticity, 3)} / 2`,
                    hasil: fmt(r.rotationRate, 3),
                    satuan: "1/s",
                    tint: C.water,
                  },
                  {
                    judul: x.jGeser,
                    rumus: <span>γ̇ = ∂u/∂y + ∂v/∂x</span>,
                    isi: `${fmt(b, 1)} + ${kurung(c, 1)}`,
                    hasil: fmt(r.shearRate, 3),
                    satuan: "1/s",
                  },
                  {
                    judul: x.jUtama,
                    rumus: <span>ε₁,₂ = (εxx + εyy)/2 ± √( ((εxx − εyy)/2)² + (γ̇/2)² )</span>,
                    isi: `( ${fmt(a, 1)} + ${kurung(d, 1)} ) / 2 ± √( ${kurung(ex, 2)}² + ${kurung(exy, 2)}² )`,
                    hasil: `${fmt(r.principal[0], 3)} ; ${fmt(r.principal[1], 3)}`,
                    satuan: "1/s",
                    tint: C.critical,
                  },
                  {
                    judul: x.jSudut,
                    rumus: <span>θ = ½ · atan2( γ̇, εxx − εyy )</span>,
                    isi: adaSumbu ? `½ · atan2( ${fmt(r.shearRate, 3)}, ${fmt(a - d, 1)} )` : "—",
                    hasil: adaSumbu ? fmt(r.principalAngle, 2) : "—",
                    satuan: adaSumbu ? "°" : undefined,
                  },
                  {
                    judul: x.jBagi,
                    rumus: <span>|Ω| / ( |Ω| + √( ((εxx − εyy)/2)² + (γ̇/2)² ) ) · 100</span>,
                    isi: adaBagian
                      ? `${fmt(Math.abs(r.rotationRate), 3)} / ( ${fmt(Math.abs(r.rotationRate), 3)} + ${fmt(Math.hypot(ex, exy), 4)} ) · 100`
                      : "—",
                    hasil: adaBagian ? fmt(r.rotationShare * 100, 1) : "—",
                    satuan: adaBagian ? "%" : undefined,
                  },
                  {
                    judul: x.jLuas,
                    rumus: <span>A = e^( t · ∇·u )</span>,
                    isi: `e^( ${fmt(waktu, 2)} · ${kurung(r.dilatation, 1)} )`,
                    hasil: fmt(r.deformedArea, 4),
                    tint: mampat ? C.signal : undefined,
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={mampat ? "invalid" : r.still ? "neutral" : r.rotationShare >= 0.5 ? "water" : "critical"}
            badge={mampat ? x.mampat : keadaan}
            state={
              r.still
                ? x.sDiam(keadaan)
                : r.pureDilatation
                  ? x.sMuai(keadaan, fmt(r.dilatation, 2), fmt(r.deformedArea, 3))
                  : x.sState(keadaan, fmt(r.rotationShare * 100, 1), fmt(r.vorticity, 2), fmt(r.principal[0], 2))
            }
            notice={notice(waktu, r.incompressible ? r.deformedArea : NaN, lang, mampat)}
          />
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
                    ? "geser: γ̇ = ∂u/∂y + ∂v/∂x; tegangan kental lahir dari laju regangan (ε₁, ε₂), tidak dari putaran"
                    : "shear: γ̇ = ∂u/∂y + ∂v/∂x; viscous stress arises from the rate of strain (ε₁, ε₂), not from rotation"}
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

/** Angka negatif dalam substitusi ditulis berkurung: 1,0 + (−1,0). */
function kurung(v: number, dg: number) {
  const t = fmt(v, dg);
  return v < 0 && t !== fmt(0, dg) ? `(${t})` : t;
}

/*
 * Butir tetap: geser sederhana 50 % dan putaran murni 100 % dengan
 * ε₁ = ε₂ = 0, dihitung dari model. Bila medannya memuai, catatan tak
 * mampat menggantikan butir luas.
 */
function notice(waktu: number, luas: number, lang: Lang, mampat: boolean): string[] {
  const x = TXT[lang];
  const geser = deformation(0, 1, 0, 0, waktu);
  const putar = deformation(0, -1, 1, 0, waktu);
  return [
    mampat ? x.mampatNote : x.nLuas(fmt(luas, 4)),
    x.nGeser(fmt(geser.rotationShare * 100, 0)),
    x.nPutar(fmt(putar.rotationShare * 100, 0), fmt(putar.principal[0], 2), fmt(putar.principal[1], 2)),
  ];
}
