"use client";

import { useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  Block,
  Hitungan,
  InputRow,
  InputTable,
  PresetRow,
  ResultTable,
  Sheet,
  StateCard,
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
    satuNol: "Satu pusaran tanpa sirkulasi",
    tanpa: "Tanpa pusaran",
    sLaju: (k: string, u: string) => `${k}: U = ${u} m/s.`,
    sPutar: (k: string, w: string, T: string) => `${k}: Ω = ${w} rad/s, satu putaran tiap ${T} s.`,
    sSatu: (k: string, pasif: string, aktif: string, w: string, T: string) =>
      `${k}: pusaran ${pasif} hanya terbawa dan mengelilingi pusaran ${aktif}, yang diam karena tidak ada yang membawanya. Ω = ${w} rad/s, satu putaran tiap ${T} s.`,
    sTanpa: "Tanpa pusaran: kedua sirkulasi nol, jadi tidak ada kecepatan yang ditimbulkan dan tidak ada yang bergerak.",
    nDekatLaju: (d1: string, d2: string, a: string, b: string) =>
      `Separuhkan jaraknya dari ${d1} ke ${d2} m: kecepatan pindahnya naik dari ${a} ke ${b} m/s, dua kali.`,
    nDekatPutar: (d1: string, d2: string, a: string, b: string) =>
      `Separuhkan jaraknya dari ${d1} ke ${d2} m: kecepatan sudutnya naik dari ${a} ke ${b} rad/s, empat kali.`,
    nBanding: (u: string, T: string) =>
      `Dengan kekuatan sama besar berlawanan arah, pasangannya berpindah ${u} m/s dan tidak pernah berputar; dengan kekuatan sama besar searah ia tidak berpindah dan berputar satu kali tiap ${T} s.`,
    nJarak: (dd: string) => `Jarak keduanya hanya bergeser ${dd} m selama pengamatan: pusaran titik menjaga jaraknya.`,
    jSum: "Jumlah sirkulasi",
    jU: "Kecepatan pindah (jumlah sirkulasi nol)",
    jW: "Kecepatan sudut putaran",
    jT: "Waktu satu putaran",
    jXc: "Titik berat sirkulasi, tempat keduanya berputar",
    jD: "Pemeriksaan: jarak di akhir pengamatan",
    note:
      "Pusaran titik adalah salah satu benda pikiran yang paling jujur dalam mekanika fluida: ia tidak punya inti, tidak punya kekentalan, dan tidak punya massa, tetapi gerakannya meramalkan gerak pusaran sungguhan dengan ketepatan yang mengejutkan selama intinya masih rapat. Aturannya satu kalimat: setiap pusaran hanyut terbawa kecepatan yang ditimbulkan pusaran lain di tempatnya berada, dan tidak terbawa kecepatannya sendiri. Dari satu kalimat itu lahir dua perilaku yang sama sekali berbeda. Sepasang pusaran yang berlawanan arah saling mendorong ke arah yang sama, sehingga keduanya berpindah lurus sebagai satu pasangan sambil menjaga jaraknya; itulah yang membuat cincin asap melaju dan membuat pusaran ujung sayap pesawat turun perlahan di belakangnya. Sepasang yang searah sebaliknya saling memutar mengelilingi titik berat sirkulasinya, yang tepat di tengah hanya bila keduanya sama kuat, dan makin dekat keduanya makin cepat putarannya. Yang pantas diingat: jarak antar keduanya tidak berubah pada kedua keadaan itu, dan pusaran yang tampak saling mendekat pada aliran sungguhan sedang melakukan sesuatu yang lain, biasanya menyatu karena kekentalan, yang sama sekali tidak ada di dalam model ini.",
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
    satuNol: "One vortex without circulation",
    tanpa: "No vortices",
    sLaju: (k: string, u: string) => `${k}: U = ${u} m/s.`,
    sPutar: (k: string, w: string, T: string) => `${k}: Ω = ${w} rad/s, one revolution every ${T} s.`,
    sSatu: (k: string, pasif: string, aktif: string, w: string, T: string) =>
      `${k}: vortex ${pasif} is only carried and orbits vortex ${aktif}, which stays still because nothing carries it. Ω = ${w} rad/s, one revolution every ${T} s.`,
    sTanpa: "No vortices: both circulations are zero, so no velocity is induced and nothing moves.",
    nDekatLaju: (d1: string, d2: string, a: string, b: string) =>
      `Halve the separation from ${d1} to ${d2} m: the translation speed rises from ${a} to ${b} m/s, twice.`,
    nDekatPutar: (d1: string, d2: string, a: string, b: string) =>
      `Halve the separation from ${d1} to ${d2} m: the angular speed rises from ${a} to ${b} rad/s, four times.`,
    nBanding: (u: string, T: string) =>
      `With equal and opposite strengths the pair translates at ${u} m/s and never turns; with equal like strengths it does not translate and orbits once every ${T} s.`,
    nJarak: (dd: string) => `The separation drifts by only ${dd} m over the observation: point vortices keep their distance.`,
    jSum: "Total circulation",
    jU: "Translation speed (zero total circulation)",
    jW: "Angular speed of the orbit",
    jT: "Time for one revolution",
    jXc: "Centre of circulation, about which both turn",
    jD: "Check: separation at the end of the observation",
    note:
      "The point vortex is one of the most honest thought-objects in fluid mechanics: it has no core, no viscosity, and no mass, yet its motion predicts the motion of real vortices with surprising accuracy as long as their cores stay compact. Its rule is one sentence: each vortex drifts with the velocity that the others induce at its own position, and not with its own. From that one sentence two completely different behaviours are born. A counter-rotating pair pushes itself the same way at both ends, so the two translate in a straight line as one pair while keeping their distance; this is what drives a smoke ring forward and what makes an aircraft's wingtip vortices sink slowly behind it. A co-rotating pair instead turns about its centre of circulation, which lies at the midpoint only when the two are equally strong, and the closer they are the faster they turn. Worth remembering: the separation does not change in either case, and vortices that appear to approach each other in a real flow are doing something else, usually merging under viscosity, which is entirely absent from this model.",
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
  const sum = gA + gB;
  const tanpa = gA === 0 && gB === 0;
  const satuNol = !tanpa && (gA === 0 || gB === 0);
  const berputar = !r.translates && !tanpa;
  const keadaan = tanpa
    ? x.tanpa
    : satuNol
      ? x.satuNol
      : r.translates
        ? x.lawan
        : r.counterRotating
          ? x.lawanTimpang
          : x.searah;
  /* Titik berat sirkulasi, dari susunan awal (−d/2, 0) dan (d/2, 0). */
  const xc = sum !== 0 ? (gA * (-jarak / 2) + gB * (jarak / 2)) / sum : NaN;
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
          /* Ruang di atas untuk judul keadaannya, yang selalu tampil; tanpa
             itu lintasan yang melaju lurus ke atas menembus judulnya. */
          yMax:
            Math.max(...ys) +
            margin +
            (Math.max(...ys) - Math.min(...ys) + 2 * margin) * 0.16,
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
            <ResultTable
              rows={[
                /* Angka besar bersyarat: U bila pasangannya melaju, Ω dan T
                   bila berputar. Dulu U dan Ω selalu besar, salah satunya nol. */
                { symbol: "U", label: x.rPindah, value: fmt(r.translation, 4), unit: "m/s", tint: C.water, strong: r.translates },
                { symbol: "Ω", label: x.rSudut, value: fmt(r.angular, 4), unit: "rad/s", tint: C.critical, strong: berputar },
                {
                  symbol: "T",
                  label: x.rPeriode,
                  value: Number.isFinite(r.period) ? fmt(r.period, 3) : "∞",
                  unit: "s",
                  strong: berputar,
                },
                { symbol: "d", label: x.rAkhir, value: fmt(r.finalSeparation, 4), unit: "m" },
                { symbol: "Δd", label: x.rHanyut, value: fmt(r.separationDrift, 5), unit: "m" },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.jSum,
                    rumus: <span>ΣΓ = Γ₁ + Γ₂</span>,
                    isi: `${fmt(gA, 0)} + ${kurung(gB, 0)}`,
                    hasil: fmt(sum, 0),
                    satuan: "m²/s",
                  },
                  ...(r.translates
                    ? [
                        {
                          judul: x.jU,
                          rumus: (<><span>U =</span><Frac num="|Γ₁|" den="2π · d" /></>),
                          isi: `${fmt(Math.abs(gA), 0)} / ( 2π · ${fmt(jarak, 1)} )`,
                          hasil: fmt(r.translation, 4),
                          satuan: "m/s",
                          tint: C.water,
                        },
                      ]
                    : berputar
                      ? [
                          {
                            judul: x.jW,
                            rumus: (<><span>Ω =</span><Frac num="ΣΓ" den="2π · d²" /></>),
                            isi: `${fmt(sum, 0)} / ( 2π · ${fmt(jarak, 1)}² )`,
                            hasil: fmt(r.angular, 4),
                            satuan: "rad/s",
                            tint: C.critical,
                          },
                          {
                            judul: x.jT,
                            rumus: (<><span>T =</span><Frac num="4π² · d²" den="|ΣΓ|" /></>),
                            isi: `4π² · ${fmt(jarak, 1)}² / ${fmt(Math.abs(sum), 0)}`,
                            hasil: fmt(r.period, 3),
                            satuan: "s",
                          },
                          {
                            judul: x.jXc,
                            rumus: (<><span>x_c =</span><Frac num="Γ₁ · (−d/2) + Γ₂ · (d/2)" den="ΣΓ" /></>),
                            isi: `( ${fmt(gA, 0)} · ${kurung(-jarak / 2, 2)} + ${kurung(gB, 0)} · ${fmt(jarak / 2, 2)} ) / ${fmt(sum, 0)}`,
                            hasil: fmt(xc, 3),
                            satuan: "m",
                          },
                        ]
                      : []),
                  {
                    judul: x.jD,
                    rumus: <span>d akhir = d</span>,
                    isi: fmt(jarak, 1),
                    hasil: fmt(r.finalSeparation, 4),
                    satuan: "m",
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={r.translates ? "water" : "neutral"}
            badge={keadaan}
            state={
              tanpa
                ? x.sTanpa
                : satuNol
                  ? x.sSatu(keadaan, gA === 0 ? "1" : "2", gA === 0 ? "2" : "1", fmt(r.angular, 3), fmt(r.period, 2))
                  : r.translates
                    ? x.sLaju(keadaan, fmt(r.translation, 3))
                    : x.sPutar(keadaan, fmt(r.angular, 3), fmt(r.period, 2))
            }
            notice={notice(gA, gB, jarak, lang)}
          />
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

/** Angka negatif dalam substitusi ditulis berkurung. */
function kurung(v: number, dg: number) {
  const t = fmt(v, dg);
  return v < 0 && t !== fmt(0, dg) ? `(${t})` : t;
}

/*
 * Butir: (a) jarak separuh → U ×2 atau Ω ×4, (b) perbandingan lawan dan
 * searah dengan kekuatan sama, (c) jarak tetap. Tanpa pusaran tidak ada
 * yang dibandingkan.
 */
function notice(gA: number, gB: number, jarak: number, lang: Lang): string[] {
  const x = TXT[lang];
  if (gA === 0 && gB === 0) return [];
  const a = vortexPair(gA, gB, jarak);
  const dekat = vortexPair(gA, gB, jarak / 2);
  const g = Math.abs(gA) > 0 ? Math.abs(gA) : Math.abs(gB);
  const lawan = vortexPair(g, -g, jarak);
  const searah = vortexPair(g, g, jarak);
  return [
    a.translates
      ? x.nDekatLaju(fmt(jarak, 1), fmt(jarak / 2, 2), fmt(a.translation, 3), fmt(dekat.translation, 3))
      : x.nDekatPutar(fmt(jarak, 1), fmt(jarak / 2, 2), fmt(a.angular, 3), fmt(dekat.angular, 3)),
    x.nBanding(fmt(lawan.translation, 3), fmt(searah.period, 2)),
    x.nJarak(fmt(a.separationDrift, 5)),
  ];
}
