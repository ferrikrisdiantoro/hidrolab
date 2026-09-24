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
  type FieldMarker,
} from "@/lib/drawField";
import { flowLines, fmt } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksFlowLines } from "@/lib/checks";

const SPAN = 10;

const TXT = {
  id: {
    title: "Garis aliran",
    sheetTitle: "Garis arus, garis jejak, dan lintasan partikel pada medan berayun",
    dU: "Kecepatan mendatar",
    dV: "Simpangan kecepatan tegak",
    dW: "Kekerapan ayunan",
    dT: "Saat pengamatan",
    pTunak: "Aliran tunak, ketiganya berimpit",
    pAyun: "Medan berayun perlahan",
    pCepat: "Ayunan cepat, ketiganya jauh berbeda",
    rPisah: "Jarak terjauh garis arus terhadap lintasan",
    rMiring: "Kemiringan garis arus pada saat ini",
    rAmp: "Simpangan terbesar lintasan partikel",
    rPeriode: "Perioda ayunan",
    tunak: "Aliran tunak, ketiga garisnya berimpit",
    takTunak: "Aliran tak tunak, ketiga garisnya berbeda",
    note:
      "Tiga garis ini berbeda meskipun dilahirkan satu medan kecepatan yang sama, dan perbedaannya bukan soal halus melainkan soal yang menentukan cara membaca setiap foto aliran yang pernah diambil. Garis arus menjawab pertanyaan ke mana air menuju pada satu saat, dan ia dibekukan pada saat itu. Lintasan partikel menjawab ke mana satu butir air pergi sepanjang waktu. Garis jejak menjawab di mana semua butir yang pernah lewat satu titik sekarang berada, dan itulah yang terlihat bila zat warna diteteskan terus-menerus dari satu jarum. Yang pertama milik satu saat dan seluruh ruang; yang kedua milik satu butir dan seluruh waktu; yang ketiga milik satu titik dan seluruh waktu. Ketiganya hanya berimpit bila medannya tidak berubah terhadap waktu, dan di situ pula satu-satunya tempat foto zat warna boleh dibaca sebagai garis arus. Setiap foto aliran tak tunak yang pernah dimuat buku teks adalah garis jejak, dan membacanya sebagai garis arus adalah kekeliruan yang jarang diucapkan tetapi sering dilakukan. Perhatikan pula bahwa garis jejak dan lintasan partikel di sini sama-sama sinus tetapi berbeda fase. Keduanya tampak serupa sekilas, dan justru keserupaan itulah yang membuat kekeliruannya bertahan.",
  },
  en: {
    title: "Flow lines",
    sheetTitle: "Streamline, streakline, and pathline in an oscillating field",
    dU: "Horizontal velocity",
    dV: "Vertical velocity amplitude",
    dW: "Oscillation frequency",
    dT: "Time of observation",
    pTunak: "Steady flow, all three coincide",
    pAyun: "A slowly oscillating field",
    pCepat: "Fast oscillation, all three far apart",
    rPisah: "Greatest gap between streamline and pathline",
    rMiring: "Slope of the streamline at this instant",
    rAmp: "Largest excursion of the pathline",
    rPeriode: "Period of the oscillation",
    tunak: "Steady flow, the three lines coincide",
    takTunak: "Unsteady flow, the three lines differ",
    note:
      "These three lines differ although one and the same velocity field gives birth to all of them, and the difference is not a fine point but the thing that decides how every flow photograph ever taken should be read. A streamline answers where the water is heading at one instant, frozen at that instant. A pathline answers where one grain of water went over time. A streakline answers where all the grains that once passed one point are now, and that is what is seen when dye is released continuously from a needle. The first belongs to one instant and all of space; the second to one grain and all of time; the third to one point and all of time. They coincide only when the field does not change with time, and that is also the only case in which a dye photograph may be read as a streamline. Every photograph of an unsteady flow ever printed in a textbook is a streakline, and reading it as a streamline is a mistake seldom spoken of and often made. Notice too that the streakline and the pathline here are both sine curves, differing only in phase. At a glance they look alike, and it is exactly that likeness that keeps the mistake alive.",
  },
} as const;

const REFS = {
  id: [
    "Prandtl, L. & Tietjens, O.G. (1934). Fundamentals of Hydro- and Aeromechanics.",
    "Van Dyke, M. (1982). An Album of Fluid Motion.",
    "Panton, R.L. (2013). Incompressible Flow, edisi ke-4, bab 3.",
    "Batchelor, G.K. (1967). An Introduction to Fluid Dynamics, bab 2.",
  ],
  en: [
    "Prandtl, L. & Tietjens, O.G. (1934). Fundamentals of Hydro- and Aeromechanics.",
    "Van Dyke, M. (1982). An Album of Fluid Motion.",
    "Panton, R.L. (2013). Incompressible Flow, 4th ed., ch. 3.",
    "Batchelor, G.K. (1967). An Introduction to Fluid Dynamics, ch. 2.",
  ],
} as const;

export function GarisAliranClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [U, setU] = useState(2);
  const [V, setV] = useState(1);
  const [omega, setOmega] = useState(1);
  const [waktu, setWaktu] = useState(5);

  const r = flowLines(U, V, omega, waktu, SPAN);
  const miring = U !== 0 ? (V * Math.cos(omega * waktu)) / U : 0;
  const amplitudo = omega !== 0 ? Math.abs(V / omega) : Math.abs(V * waktu);
  const perioda = omega !== 0 ? (2 * Math.PI) / omega : Infinity;

  const ref = useCanvas(
    (ctx, w, ch) => {
      const garis: FieldLine[] = [
        {
          pts: r.streamline,
          color: C.critical,
          weight: W.bold,
          dash: DASH.solid,
          label: T.streamlineLabel,
          labelAt: 0.88,
          labelDy: -10,
          labelAlign: "right",
        },
        {
          pts: r.pathline,
          color: C.water,
          weight: W.bold,
          dash: DASH.hidden,
          label: T.pathlineLabel,
          labelAt: 0.55,
          labelDy: 16,
          labelAlign: "center",
          arrow: true,
        },
        {
          pts: r.streakline,
          color: C.energy,
          weight: W.thin,
          dash: DASH.solid,
          label: T.streaklineLabel,
          labelAt: 0.3,
          labelDy: -12,
          labelAlign: "center",
        },
      ];

      /* Panah kecepatan pada saat ini, seragam di seluruh bidang karena
         medannya memang seragam. Itulah sebabnya garis arusnya lurus. */
      const vSaat = V * Math.cos(omega * waktu);
      const panah: FieldArrow[] = [];
      const jangkau = Math.max(amplitudo, SPAN * 0.18);
      for (let i = 1; i <= 4; i++)
        for (let j = -1; j <= 1; j++)
          panah.push({
            x: (SPAN * i) / 5,
            y: j * jangkau * 0.75,
            dx: U * 0.5,
            dy: vSaat * 0.5,
            color: C.ink3,
            weight: W.hair,
          });

      const titik: FieldMarker[] = [
        { x: 0, y: 0, color: C.ink, size: 4, filled: true },
      ];

      const batas = Math.max(amplitudo * 1.35, SPAN * 0.3);
      drawField(
        ctx,
        w,
        ch,
        {
          xMin: -SPAN * 0.06,
          xMax: SPAN * 1.1,
          yMin: -batas,
          yMax: batas,
          equalScale: false,
          lines: garis,
          arrows: panah,
          markers: titik,
          regions: [{ x: 0.35, y: -batas * 0.82, text: T.releasePoint }],
          heading: r.steady ? x.tunak : undefined,
          axisX: T.axXMetre,
          axisY: T.axYMetre,
        },
        lang
      );
    },
    [U, V, omega, waktu, lang]
  );

  return (
    <LabShell
      sheet="FF-05"
      subject={SUBJECTS.FF[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            <Term tint={C.critical}>Garis arus</Term> milik satu saat,{" "}
            <Term tint={C.water}>lintasan partikel</Term> milik satu butir air,
            dan <Term tint={C.energy}>garis jejak</Term> milik satu titik lepas.
            Ketiganya hanya berimpit pada aliran tunak.
          </p>
        ) : (
          <p>
            A <Term tint={C.critical}>streamline</Term> belongs to one instant, a{" "}
            <Term tint={C.water}>pathline</Term> to one grain of water, and a{" "}
            <Term tint={C.energy}>streakline</Term> to one release point. They
            coincide only in steady flow.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FF-05"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m/s, rad/s)" },
            { label: "t", value: `${fmt(waktu, 1)} s` },
            { label: "U", value: `${fmt(U, 2)} m/s` },
            { label: "v(t)", value: `${fmt(V * Math.cos(omega * waktu), 2)} m/s` },
            {
              label: "Δ",
              value: `${fmt(r.separation, 2)} m`,
              tint: r.steady ? undefined : C.critical,
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
              <InputRow symbol="U" label={x.dU} value={U} min={0.2} max={8} step={0.1} digits={1} unit="m/s" onChange={setU} />
              <InputRow symbol="V" label={x.dV} value={V} min={0} max={4} step={0.1} digits={1} unit="m/s" onChange={setV} tint={C.water} />
              <InputRow symbol="ω" label={x.dW} value={omega} min={0} max={4} step={0.05} digits={2} unit="rad/s" onChange={setOmega} tint={C.critical} />
              <InputRow symbol="t" label={x.dT} value={waktu} min={0.5} max={20} step={0.5} digits={1} unit="s" onChange={setWaktu} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pTunak, apply: () => { setU(2); setV(0); setOmega(1); setWaktu(5); } },
                  { label: x.pAyun, apply: () => { setU(2); setV(1); setOmega(0.5); setWaktu(8); } },
                  { label: x.pCepat, apply: () => { setU(2); setV(1.5); setOmega(3); setWaktu(12); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5">
              <Flag tint={r.steady ? C.water : C.critical}>
                {r.steady ? x.tunak : x.takTunak}
              </Flag>
            </div>
            <ResultTable
              rows={[
                { symbol: "Δ", label: x.rPisah, value: fmt(r.separation, 3), unit: "m", tint: r.steady ? undefined : C.critical, strong: true },
                { symbol: "dy/dx", label: x.rMiring, value: fmt(miring, 4), tint: C.critical },
                { symbol: "A", label: x.rAmp, value: fmt(amplitudo, 3), unit: "m", tint: C.water },
                {
                  symbol: "T",
                  label: x.rPeriode,
                  value: Number.isFinite(perioda) ? fmt(perioda, 2) : "∞",
                  unit: "s",
                },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(U, V, omega, waktu, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksFlowLines(U, V, omega, waktu)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>u = U,</span>
                <span className="ml-4">v = V cos ωt</span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "garis arus: dy/dx = v(t)/U pada t tetap"
                    : "streamline: dy/dx = v(t)/U at fixed t"}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "lintasan: x = Uτ, y = (V/ω) sin ωτ"
                    : "pathline: x = Uτ, y = (V/ω) sin ωτ"}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "garis jejak: x = U(t − t₀), y = (V/ω)(sin ωt − sin ωt₀)"
                    : "streakline: x = U(t − t₀), y = (V/ω)(sin ωt − sin ωt₀)"}
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

function notice(U: number, V: number, omega: number, t: number, lang: Lang) {
  const a = flowLines(U, V, omega, t, SPAN);
  const diam = flowLines(U, 0, omega, t, SPAN);
  const cepat = flowLines(U, V, omega * 3, t, SPAN);

  if (lang === "en")
    return `At this setting the streamline and the pathline stand ${fmt(a.separation, 2)} metres apart at their widest. Drag the vertical amplitude to zero and the gap closes to ${fmt(diam.separation, 2)} metres: the field stops changing with time, and a single line does the work of three. Now triple the frequency instead and the gap becomes ${fmt(cepat.separation, 2)} metres. Nothing about the water changed; only how fast the field changed while a particle travelled through it.`;
  return `Pada setelan ini garis arus dan lintasan partikel terpisah sejauh ${fmt(a.separation, 2)} meter di tempat terlebarnya. Tarik simpangan tegaknya ke nol dan jaraknya menutup ke ${fmt(diam.separation, 2)} meter: medannya berhenti berubah terhadap waktu, dan satu garis mengerjakan tugas tiga garis. Sekarang tigakalikan kekerapannya dan jaraknya menjadi ${fmt(cepat.separation, 2)} meter. Tidak ada yang berubah pada airnya, yang berubah hanya seberapa cepat medannya berubah selama satu partikel menempuhnya.`;
}
