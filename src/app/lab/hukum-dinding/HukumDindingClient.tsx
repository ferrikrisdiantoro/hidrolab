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
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import {
  KARMAN,
  WALL_B,
  WALL_LOG_MIN,
  WALL_VISCOUS_MAX,
  fmt,
  fmtPlain,
  fmtSci,
  frictionVelocity,
  viscousSublayer,
  wallLaw,
  waterViscosity,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksWallLaw } from "@/lib/checks";

const TXT = {
  id: {
    title: "Hukum dinding",
    sheetTitle: "Hukum dinding — dua hukum dan daerah di antaranya",
    dTau: "Tegangan geser dinding",
    dY: "Jarak titik amat dari dinding",
    dT: "Suhu air",
    pSungai: "Dasar sungai, geser sedang",
    pPipa: "Pipa laboratorium, geser kecil",
    pBanjir: "Banjir, geser besar",
    rUstar: "Kecepatan gesek",
    rYplus: "Jarak tak berdimensi",
    rUplus: "Kecepatan tak berdimensi",
    rU: "Kecepatan setempat",
    rDelta: "Tebal lapisan kental",
    rNu: "Kekentalan kinematik",
    rLapis: "Daerah tempat titik berada",
    lKental: "Lapisan kental",
    lPenyangga: "Lapisan penyangga",
    lLog: "Lapisan logaritmik",
    penyanggaNote:
      "Titik amatnya jatuh di antara y⁺ sama dengan lima dan tiga puluh. Di daerah ini hukum kental sudah tidak berlaku dan hukum logaritmik belum berlaku, dan tidak ada rumus sederhana yang menggantikan keduanya. Angka yang ditampilkan di tabel adalah nilai kedua hukum itu seandainya dipaksakan, bukan kecepatan yang sesungguhnya. Yang benar di daerah ini hanya hasil pengukuran atau penyelesaian numerik. Geser titik amatnya lebih dekat ke dinding atau lebih jauh darinya.",
    note:
      "Yang membuat lembar ini layak dibaca justru daerah kosong di tengahnya. Dua hukum di kiri dan kanan sama-sama sederhana dan sama-sama terbukti: dekat dinding kekentalan menguasai dan kecepatannya naik lurus terhadap jarak; jauh dari dinding pusaran menguasai dan kecepatannya naik menurut logaritma jarak. Di antara keduanya ada daerah tempat kedua sebab bekerja bersama, dan hasilnya tidak berbentuk rumus sederhana apa pun. Kebiasaan buku ajar adalah menggambar satu kurva mulus yang menyambung keduanya, dan kebiasaan itu menyesatkan karena membuat daerah penyangga tampak seperti bagian dari sebuah hukum tunggal. Di sini kedua hukum sengaja digambar sebagai dua garis yang berpotongan dan saling melampaui, dan daerah di antaranya diarsir tanpa kurva. Perhatikan juga bahwa sumbu mendatarnya logaritmik: itulah sebabnya hukum logaritmik tampak sebagai garis lurus, dan hukum kental yang sesungguhnya lurus justru tampak melengkung.",
  },
  en: {
    title: "Law of the wall",
    sheetTitle: "Law of the wall — two laws and the region between them",
    dTau: "Wall shear stress",
    dY: "Distance of the point from the wall",
    dT: "Water temperature",
    pSungai: "River bed, moderate shear",
    pPipa: "Laboratory pipe, low shear",
    pBanjir: "Flood, high shear",
    rUstar: "Friction velocity",
    rYplus: "Dimensionless distance",
    rUplus: "Dimensionless velocity",
    rU: "Local velocity",
    rDelta: "Viscous sublayer thickness",
    rNu: "Kinematic viscosity",
    rLapis: "Region the point falls in",
    lKental: "Viscous layer",
    lPenyangga: "Buffer layer",
    lLog: "Logarithmic layer",
    penyanggaNote:
      "The observation point falls between y⁺ of five and thirty. Here the viscous law no longer holds and the logarithmic law does not hold yet, and no simple formula replaces either. The numbers in the table are what those two laws would give if forced, not the actual velocity. Only measurement or a numerical solution is correct in this region. Move the point closer to the wall or further from it.",
    note:
      "What makes this sheet worth reading is the empty region in its middle. The two laws on either side are both simple and both well established: near the wall viscosity governs and the velocity rises linearly with distance; far from the wall eddies govern and the velocity rises with the logarithm of distance. Between them lies a region where both causes act together, and the result takes no simple closed form at all. The textbook habit is to draw one smooth curve joining the two, and that habit misleads, because it makes the buffer layer look like part of a single law. Here the two laws are deliberately drawn as two lines that cross and overshoot each other, and the region between is shaded with no curve at all. Note too that the horizontal axis is logarithmic: that is why the logarithmic law appears as a straight line, while the viscous law, which is genuinely straight, appears curved.",
  },
} as const;

const REFS = {
  id: [
    "Nikuradse, J. (1932). Gesetzmässigkeiten der turbulenten Strömung in glatten Rohren. VDI-Forschungsheft 356.",
    "Schlichting, H. & Gersten, K. (2017). Boundary-Layer Theory, edisi ke-9. Springer, Bab 17.",
    "Pope, S.B. (2000). Turbulent Flows. Cambridge University Press, Bab 7.",
  ],
  en: [
    "Nikuradse, J. (1932). Gesetzmässigkeiten der turbulenten Strömung in glatten Rohren. VDI-Forschungsheft 356.",
    "Schlichting, H. & Gersten, K. (2017). Boundary-Layer Theory, 9th ed. Springer, Chapter 17.",
    "Pope, S.B. (2000). Turbulent Flows. Cambridge University Press, Chapter 7.",
  ],
} as const;

const YP_MIN = 0.3;
const YP_MAX = 3000;

export function HukumDindingClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [tau, setTau] = useState(2);
  const [yMm, setYMm] = useState(2);
  const [suhu, setSuhu] = useState(15);

  const nu = waterViscosity(suhu);
  const uStar = frictionVelocity(tau);
  const y = yMm / 1000;
  const yPlus = nu > 0 ? (y * uStar) / nu : 0;
  const w = wallLaw(yPlus);
  const delta = viscousSublayer(uStar, nu);

  // Kecepatan tak berdimensi yang dipakai adalah nilai hukum yang memang
  // berlaku di daerah itu. Di daerah penyangga tidak ada yang berlaku, dan
  // lembar menandainya alih-alih diam-diam memilih salah satu.
  const diPenyangga = w.layer === "penyangga";
  const uPlus = w.layer === "kental" ? w.viscous : w.log;
  const u = uPlus * uStar;

  const lapisNama =
    w.layer === "kental" ? x.lKental : w.layer === "logaritmik" ? x.lLog : x.lPenyangga;

  const ref = useCanvas(
    (ctx, cw, ch) => {
      const kental: { x: number; y: number }[] = [];
      const log: { x: number; y: number }[] = [];
      for (let lg = Math.log10(YP_MIN); lg <= Math.log10(YP_MAX) + 1e-9; lg += 0.02) {
        const yp = Math.pow(10, lg);
        const l = wallLaw(yp);
        if (l.viscous <= 30) kental.push({ x: yp, y: l.viscous });
        if (l.log > 0) log.push({ x: yp, y: l.log });
      }

      // Ruas tiap hukum yang berada di luar daerah berlakunya digambar titik
      // rapat: keduanya tetap terlihat justru supaya perpotongannya terbaca.
      const deret: ChartSeries[] = [
        {
          pts: kental.filter((p) => p.x <= WALL_VISCOUS_MAX),
          color: C.water,
          weight: W.bold,
          label: "u⁺ = y⁺",
          labelAt: 0.6,
          labelDy: -10,
        },
        {
          pts: kental.filter((p) => p.x >= WALL_VISCOUS_MAX),
          color: C.water,
          weight: W.thin,
          dash: DASH.invalid,
        },
        {
          pts: log.filter((p) => p.x >= WALL_LOG_MIN),
          color: C.energy,
          weight: W.bold,
          label: T.logLayer,
          labelAt: 0.8,
          labelDy: -10,
        },
        {
          pts: log.filter((p) => p.x <= WALL_LOG_MIN),
          color: C.energy,
          weight: W.thin,
          dash: DASH.invalid,
        },
      ];

      drawChart(
        ctx,
        cw,
        ch,
        {
          xMin: YP_MIN,
          xMax: YP_MAX,
          yMin: 0,
          yMax: 26,
          xLog: true,
          axisX: T.axYPlus,
          axisY: T.axUPlus,
          series: deret,
          bands: [
            {
              axis: "x",
              from: WALL_VISCOUS_MAX,
              to: WALL_LOG_MIN,
              label: T.bufferLayer,
            },
          ],
          regions: [
            { x: 1.1, y: 23, text: T.viscousLayer, color: C.ink3 },
            { x: 12, y: 3.2, text: T.noLawHere, color: C.signal },
          ],
          point: {
            x: yPlus,
            y: uPlus,
            label: `u⁺ ${fmtPlain(uPlus, 2)}`,
            invalid: diPenyangga,
          },
        },
        lang
      );
    },
    [tau, yMm, suhu, lang]
  );

  return (
    <LabShell
      sheet="PI-03"
      subject={SUBJECTS.PI[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Dekat dinding <Term tint={C.water}>kekentalan</Term> yang menentukan
            dan kecepatannya naik lurus. Jauh dari dinding{" "}
            <Term tint={C.energy}>pusaran</Term> yang menentukan dan kecepatannya
            naik menurut logaritma. Di antara keduanya tidak ada hukum sederhana
            sama sekali.
          </p>
        ) : (
          <p>
            Near the wall <Term tint={C.water}>viscosity</Term> decides and the
            velocity rises linearly. Far from it{" "}
            <Term tint={C.energy}>eddies</Term> decide and the velocity rises
            logarithmically. Between the two there is no simple law at all.
          </p>
        )
      }
      drawing={
        <Sheet
          number="PI-03"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m/s, Pa)" },
            { label: "u*", value: `${fmt(uStar, 4)} m/s`, tint: C.energy },
            {
              label: "y⁺",
              value: fmt(yPlus, 2),
              tint: diPenyangga ? C.signal : undefined,
            },
            /*
             * Di daerah penyangga kedua angka ini TIDAK ditampilkan, sama
             * dengan tabel hasilnya. Kop yang menyebut kecepatan sementara
             * tabelnya menolak menyebutnya adalah gambar yang membantah
             * dirinya sendiri, dan itu cacat yang sudah dibayar tiga kali
             * pada pekan pertama.
             */
            {
              label: "u⁺",
              value: diPenyangga ? "—" : fmt(uPlus, 2),
              tint: diPenyangga ? C.signal : C.water,
            },
            {
              label: "u",
              value: diPenyangga ? "—" : `${fmt(u, 4)} m/s`,
              tint: diPenyangga ? C.signal : C.water,
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
              <InputRow symbol="τ₀" label={x.dTau} value={tau} min={0.05} max={40} step={0.05} digits={2} unit="Pa" onChange={setTau} tint={C.energy} />
              <InputRow symbol="y" label={x.dY} value={yMm} min={0.01} max={200} step={0.01} digits={2} unit="mm" onChange={setYMm} tint={C.signal} />
              <InputRow symbol="T" label={x.dT} value={suhu} min={4} max={40} step={0.5} digits={1} unit="°C" onChange={setSuhu} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pSungai, apply: () => { setTau(2); setYMm(2); setSuhu(15); } },
                  { label: x.pPipa, apply: () => { setTau(0.2); setYMm(1); setSuhu(15); } },
                  { label: x.pBanjir, apply: () => { setTau(20); setYMm(20); setSuhu(15); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={diPenyangga ? undefined : C.water} alert={diPenyangga}>
                {lapisNama}
              </Flag>
            </div>
            {diPenyangga && (
              <div className="mb-2.5">
                <Note>{x.penyanggaNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "u", label: x.rU, value: diPenyangga ? "—" : fmt(u, 4), unit: diPenyangga ? undefined : "m/s", tint: C.water, strong: true },
                { symbol: "u⁺", label: x.rUplus, value: diPenyangga ? "—" : fmt(uPlus, 3), tint: C.water },
                { symbol: "y⁺", label: x.rYplus, value: fmt(yPlus, 3), tint: diPenyangga ? C.signal : undefined, strong: true },
                { symbol: "u*", label: x.rUstar, value: fmt(uStar, 5), unit: "m/s", tint: C.energy },
                { symbol: "δv", label: x.rDelta, value: fmt(delta * 1000, 3), unit: "mm", tint: C.critical },
                { symbol: "—", label: x.rLapis, value: lapisNama },
                { symbol: "ν", label: x.rNu, value: fmtSci(nu), unit: "m²/s" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(yPlus, uStar, delta, diPenyangga, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksWallLaw(uStar, nu)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>y⁺ =</span>
                <Frac num="y u*" den="ν" />
                <span className="ml-5">u⁺ =</span>
                <Frac num="u" den="u*" />
                <span className="ml-5">u* = √(τ₀ / ρ)</span>
              </Eq>
              <Eq>
                <span>u⁺ = y⁺</span>
                <span className="ml-3 text-ink-3">
                  {lang === "id" ? "bila y⁺ di bawah 5" : "for y⁺ below 5"}
                </span>
                <span className="ml-6">u⁺ =</span>
                <Frac num="1" den="κ" />
                <span>ln y⁺ + B</span>
                <span className="ml-3 text-ink-3">
                  {lang === "id" ? "bila y⁺ di atas 30" : "for y⁺ above 30"}
                </span>
              </Eq>
              <Eq>
                <span>κ = {fmtPlain(KARMAN, 2)}</span>
                <span className="ml-5">B = {fmtPlain(WALL_B, 1)}</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "pasangan lama 0,40 dan 5,5 memberi titik potong 11,6"
                    : "the older pair 0.40 and 5.5 gives the 11.6 crossing"}
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
  yPlus: number,
  uStar: number,
  delta: number,
  diPenyangga: boolean,
  lang: Lang
): string {
  if (diPenyangga) {
    return lang === "id"
      ? `Titiknya berada pada y⁺ ${fmt(yPlus, 1)}, di dalam daerah yang sengaja dikosongkan. Geser tegangan gesernya atau jarak titik amatnya, lalu perhatikan titik itu keluar dari arsiran dan salah satu hukum kembali berlaku.`
      : `The point sits at y⁺ ${fmt(yPlus, 1)}, inside the region deliberately left empty. Move the shear stress or the observation distance and watch the point leave the shading as one of the two laws takes over again.`;
  }
  if (lang === "en")
    return `The viscous sublayer is ${fmt(delta * 1000, 3)} mm thick here, and that single number explains why roughness matters at all. A grain smaller than this layer is buried inside it and the flow never feels it; a grain larger than it pokes through into the turbulent stream and starts to shed eddies. Raise the shear stress and watch the layer thin out: at ${fmt(uStar, 4)} m/s of friction velocity a wall that was hydraulically smooth can become rough without a single grain being added to it.`;
  return `Lapisan kentalnya setebal ${fmt(delta * 1000, 3)} mm di sini, dan angka tunggal itu menjelaskan mengapa kekasaran bisa berarti sama sekali. Butir yang lebih kecil daripada lapisan ini terkubur di dalamnya dan alirannya tidak pernah merasakannya; butir yang lebih besar menyembul ke arus turbulen dan mulai melepas pusaran. Naikkan tegangan gesernya lalu perhatikan lapisan itu menipis: pada kecepatan gesek ${fmt(uStar, 4)} m/s, dinding yang tadinya licin secara hidrolik dapat berubah menjadi kasar tanpa satu butir pun ditambahkan padanya.`;
}
