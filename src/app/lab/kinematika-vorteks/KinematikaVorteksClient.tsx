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
import { drawField, type FieldLine, type FieldMarker } from "@/lib/drawField";
import { fmt, vortexPair } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksVortexPair } from "@/lib/checks";

const TXT = {
  id: {
    title: "Kinematika vorteks",
    sheetTitle: "Lintasan sepasang pusaran titik selama dua puluh detik",
    dA: "Sirkulasi pusaran pertama",
    dB: "Sirkulasi pusaran kedua",
    dS: "Jarak awal antar keduanya",
    pLawan: "Berlawanan arah, pasangannya berpindah lurus",
    pSearah: "Searah, keduanya saling mengelilingi",
    pTimpang: "Kuatnya timpang, yang lemah mengelilingi yang kuat",
    rPindah: "Kecepatan pindah pasangan sama kuat berlawanan arah",
    rSudut: "Kecepatan sudut putaran pasangannya",
    rPeriode: "Waktu satu putaran penuh",
    rAkhir: "Jarak keduanya di akhir pengamatan",
    rHanyut: "Perubahan jarak selama pengamatan",
    lawan: "Berlawanan arah, pasangannya berpindah lurus",
    searah: "Searah, keduanya saling mengelilingi",
    lawanTimpang: "Berlawanan tetapi tidak sama kuat, keduanya mengelilingi titik di luar pasangannya",
    note:
      "Pusaran titik adalah salah satu benda pikiran yang paling jujur dalam mekanika fluida: ia tidak punya inti, tidak punya kekentalan, dan tidak punya massa, tetapi gerakannya meramalkan gerak pusaran sungguhan dengan ketepatan yang mengejutkan selama intinya masih rapat. Aturannya satu kalimat: setiap pusaran hanyut terbawa kecepatan yang ditimbulkan pusaran lain di tempatnya berada, dan tidak terbawa kecepatannya sendiri. Dari satu kalimat itu lahir dua perilaku yang sama sekali berbeda. Sepasang pusaran yang berlawanan arah saling mendorong ke arah yang sama, sehingga keduanya berpindah lurus sebagai satu pasangan sambil menjaga jaraknya; itulah yang membuat cincin asap melaju dan membuat pusaran ujung sayap pesawat turun perlahan di belakangnya. Sepasang yang searah sebaliknya saling memutar mengelilingi titik tengahnya, dan makin dekat keduanya makin cepat putarannya. Yang pantas diingat: jarak antar keduanya tidak berubah pada kedua keadaan itu, dan pusaran yang tampak saling mendekat pada aliran sungguhan sedang melakukan sesuatu yang lain, biasanya menyatu karena kekentalan, yang sama sekali tidak ada di dalam model ini.",
  },
  en: {
    title: "Vortex kinematics",
    sheetTitle: "The paths of a point-vortex pair over twenty seconds",
    dA: "Circulation of the first vortex",
    dB: "Circulation of the second",
    dS: "Initial separation",
    pLawan: "Counter-rotating, the pair translates",
    pSearah: "Co-rotating, the two orbit each other",
    pTimpang: "Unequal strengths, the weak orbits the strong",
    rPindah: "Translation speed of an equal and opposite pair",
    rSudut: "Angular speed of the pair's orbit",
    rPeriode: "Time for one full revolution",
    rAkhir: "Separation at the end of the observation",
    rHanyut: "Change in separation over the observation",
    lawan: "Counter-rotating, the pair translates",
    searah: "Co-rotating, the two orbit each other",
    lawanTimpang: "Opposite but unequal, the two orbit a point outside the pair",
    note:
      "The point vortex is one of the most honest thought-objects in fluid mechanics: it has no core, no viscosity, and no mass, yet its motion predicts the motion of real vortices with surprising accuracy as long as their cores stay compact. Its rule is one sentence: each vortex drifts with the velocity that the others induce at its own position, and not with its own. From that one sentence two completely different behaviours are born. A counter-rotating pair pushes itself the same way at both ends, so the two translate in a straight line as one pair while keeping their distance; this is what drives a smoke ring forward and what makes an aircraft's wingtip vortices sink slowly behind it. A co-rotating pair instead turns about the midpoint between them, and the closer they are the faster they turn. Worth remembering: the separation does not change in either case, and vortices that appear to approach each other in a real flow are doing something else, usually merging under viscosity, which is entirely absent from this model.",
  },
} as const;

const REFS = {
  id: [
    "Helmholtz, H. von (1858). Über Integrale der hydrodynamischen Gleichungen.",
    "Lamb, H. (1932). Hydrodynamics, edisi ke-6, bab 7.",
    "Saffman, P.G. (1992). Vortex Dynamics.",
    "Aref, H. (1983). Integrable, chaotic, and turbulent vortex motion. Annu. Rev. Fluid Mech. 15, 345–389.",
  ],
  en: [
    "Helmholtz, H. von (1858). Über Integrale der hydrodynamischen Gleichungen.",
    "Lamb, H. (1932). Hydrodynamics, 6th ed., ch. 7.",
    "Saffman, P.G. (1992). Vortex Dynamics.",
    "Aref, H. (1983). Integrable, chaotic, and turbulent vortex motion. Annu. Rev. Fluid Mech. 15, 345–389.",
  ],
} as const;

export function KinematikaVorteksClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [gA, setGA] = useState(10);
  const [gB, setGB] = useState(-10);
  const [jarak, setJarak] = useState(2);

  const r = vortexPair(gA, gB, jarak);
  /* Hanya pasangan yang jumlah sirkulasinya nol yang melaju lurus. Yang
     berlawanan tetapi tidak sama kuat tetap berputar, dengan pusat di luar
     ruas penghubungnya. */
  const keadaan = r.translates
    ? x.lawan
    : r.counterRotating
      ? x.lawanTimpang
      : x.searah;
  const ujungA = r.pathA[r.pathA.length - 1];
  const ujungB = r.pathB[r.pathB.length - 1];

  const ref = useCanvas(
    (ctx, w, ch) => {
      const garis: FieldLine[] = [
        {
          pts: r.pathA,
          color: C.water,
          weight: W.bold,
          dash: DASH.solid,
          label: T.vortexA,
          labelAt: 0.45,
          labelDy: -11,
          labelAlign: "center",
          arrow: true,
        },
        {
          pts: r.pathB,
          color: C.critical,
          weight: W.bold,
          dash: DASH.hidden,
          label: T.vortexB,
          labelAt: 0.45,
          labelDy: 16,
          labelAlign: "center",
          arrow: true,
        },
        {
          /* Garis penghubung keduanya di akhir, supaya jaraknya terbaca. */
          pts: [ujungA, ujungB],
          color: C.ink3,
          weight: W.hair,
          dash: DASH.axis,
        },
      ];

      const titik: FieldMarker[] = [
        { x: r.pathA[0].x, y: r.pathA[0].y, color: C.water, size: 5, filled: false },
        { x: r.pathB[0].x, y: r.pathB[0].y, color: C.critical, size: 5, filled: false },
        { x: ujungA.x, y: ujungA.y, color: C.water, size: 5, filled: true },
        { x: ujungB.x, y: ujungB.y, color: C.critical, size: 5, filled: true },
      ];

      const xs = [...r.pathA, ...r.pathB].map((p) => p.x);
      const ys = [...r.pathA, ...r.pathB].map((p) => p.y);
      const margin = jarak * 0.4;

      drawField(
        ctx,
        w,
        ch,
        {
          xMin: Math.min(...xs) - margin,
          xMax: Math.max(...xs) + margin,
          yMin: Math.min(...ys) - margin,
          yMax: Math.max(...ys) + margin,
          lines: garis,
          markers: titik,
          heading: keadaan,
          headingColor: C.ink2,
          axisX: T.axXMetre,
          axisY: T.axYMetre,
        },
        lang
      );
    },
    [gA, gB, jarak, lang]
  );

  return (
    <LabShell
      sheet="FP-02"
      subject={SUBJECTS.FP[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Tiap pusaran hanyut terbawa kecepatan yang ditimbulkan{" "}
            <Term tint={C.critical}>pusaran lain</Term>, bukan terbawa
            kecepatannya sendiri. Dari satu aturan itu lahir{" "}
            <Term tint={C.water}>dua perilaku</Term> yang berlawanan.
          </p>
        ) : (
          <p>
            Each vortex drifts with the velocity induced by{" "}
            <Term tint={C.critical}>the others</Term>, not by itself. From that
            one rule come <Term tint={C.water}>two opposite behaviours</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FP-02"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m²/s, m, s)" },
            {
              label: "U",
              value: `${fmt(r.translation, 3)} m/s`,
              tint: C.water,
            },
            {
              label: "Ω",
              value: `${fmt(r.angular, 3)} rad/s`,
              tint: C.critical,
            },
            {
              label: "T",
              value: Number.isFinite(r.period) ? `${fmt(r.period, 2)} s` : "∞",
            },
            { label: "d", value: `${fmt(r.finalSeparation, 3)} m` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Γ₁" label={x.dA} value={gA} min={-40} max={40} step={1} digits={0} unit="m²/s" onChange={setGA} tint={C.water} />
              <InputRow symbol="Γ₂" label={x.dB} value={gB} min={-40} max={40} step={1} digits={0} unit="m²/s" onChange={setGB} tint={C.critical} />
              <InputRow symbol="d" label={x.dS} value={jarak} min={0.5} max={8} step={0.1} digits={1} unit="m" onChange={setJarak} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pLawan, apply: () => { setGA(10); setGB(-10); setJarak(2); } },
                  { label: x.pSearah, apply: () => { setGA(10); setGB(10); setJarak(2); } },
                  { label: x.pTimpang, apply: () => { setGA(30); setGB(5); setJarak(2); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5">
              <Flag tint={r.translates ? C.water : C.critical}>{keadaan}</Flag>
            </div>
            <ResultTable
              rows={[
                { symbol: "U", label: x.rPindah, value: fmt(r.translation, 4), unit: "m/s", tint: C.water, strong: true },
                { symbol: "Ω", label: x.rSudut, value: fmt(r.angular, 4), unit: "rad/s", tint: C.critical, strong: true },
                {
                  symbol: "T",
                  label: x.rPeriode,
                  value: Number.isFinite(r.period) ? fmt(r.period, 3) : "∞",
                  unit: "s",
                },
                { symbol: "d", label: x.rAkhir, value: fmt(r.finalSeparation, 4), unit: "m" },
                { symbol: "Δd", label: x.rHanyut, value: fmt(r.separationDrift, 5), unit: "m" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(gA, gB, jarak, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksVortexPair(gA, gB, jarak)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>u =</span>
                <Frac num="Γ" den="2π r" />
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "kecepatan yang ditimbulkan satu pusaran titik"
                    : "the velocity induced by one point vortex"}
                </span>
              </Eq>
              <Eq>
                <span>U =</span>
                <Frac num="Γ" den="2π d" />
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "pasangan berlawanan arah, berpindah lurus"
                    : "counter-rotating pair, translating"}
                </span>
              </Eq>
              <Eq>
                <span>T =</span>
                <Frac num="4π² d²" den="Γ₁ + Γ₂" />
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "pasangan searah, saling mengelilingi"
                    : "co-rotating pair, orbiting"}
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

function notice(gA: number, gB: number, jarak: number, lang: Lang) {
  const a = vortexPair(gA, gB, jarak);
  const dekat = vortexPair(gA, gB, jarak / 2);
  const lawan = vortexPair(Math.abs(gA), -Math.abs(gA), jarak);
  const searah = vortexPair(Math.abs(gA), Math.abs(gA), jarak);

  if (lang === "en")
    return `Halving the separation from ${fmt(jarak, 1)} to ${fmt(jarak / 2, 1)} metres ${a.translates ? `doubles the translation speed from ${fmt(a.translation, 3)} to ${fmt(dekat.translation, 3)} metres a second` : `quadruples the angular speed from ${fmt(a.angular, 3)} to ${fmt(dekat.angular, 3)} radians a second`}. Flip the sign of the second circulation and the behaviour changes completely: with equal and opposite strengths the pair translates at ${fmt(lawan.translation, 3)} metres a second and never turns, while with equal like strengths it does not translate at all and orbits once every ${fmt(searah.period, 2)} seconds. Notice that the separation drifts by only ${fmt(a.separationDrift, 5)} metres in either case: point vortices keep their distance.`;
  return `Menyeparuhkan jaraknya dari ${fmt(jarak, 1)} ke ${fmt(jarak / 2, 1)} meter ${a.translates ? `melipatduakan kecepatan pindahnya dari ${fmt(a.translation, 3)} ke ${fmt(dekat.translation, 3)} meter tiap detik` : `melipatempatkan kecepatan sudutnya dari ${fmt(a.angular, 3)} ke ${fmt(dekat.angular, 3)} radian tiap detik`}. Balikkan tanda sirkulasi yang kedua dan perilakunya berubah sama sekali: dengan kekuatan sama besar berlawanan arah, pasangannya berpindah ${fmt(lawan.translation, 3)} meter tiap detik dan tidak pernah berputar, sedangkan dengan kekuatan sama besar searah ia sama sekali tidak berpindah dan berputar satu kali tiap ${fmt(searah.period, 2)} detik. Perhatikan bahwa jarak keduanya hanya bergeser ${fmt(a.separationDrift, 5)} meter pada kedua keadaan: pusaran titik menjaga jaraknya.`;
}
