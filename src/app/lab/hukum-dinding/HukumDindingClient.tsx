"use client";

import { useRef, useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  Block,
  Hitungan,
  InputRow,
  InputTable,
  PresetRow,
  RegimeScale,
  ResultTable,
  SentuhContoh,
  Sheet,
  StateCard,
  Term,
} from "@/components/ui";
import { usePlate } from "@/lib/usePlate";
import { DragLayer, type HandleSpec } from "@/components/DragLayer";
import type { ParamDef } from "@/lib/rentang";
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
import { C, DASH, W, type Tone } from "@/lib/theme";
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
    bKental: "Lapisan kental, u⁺ = y⁺",
    bPenyangga: "Lapisan penyangga, tidak ada hukum sederhana",
    bLog: "Lapisan logaritmik",
    hUstar: "Kecepatan gesek",
    hYplus: "Kekentalan kinematik dan jarak tak berdimensi",
    hUplus: "Kecepatan tak berdimensi",
    hUplusNone: "Kecepatan tak berdimensi: daerah penyangga, tidak ada hukum",
    hU: "Kecepatan setempat",
    hDelta: "Tebal lapisan kental",
    hdlProbe: "Probe titik amat: geser mendatar untuk mengubah jarak y dari dinding",
    pindah: "Geser tegangan gesernya atau jarak titik amatnya, lalu perhatikan titik itu keluar dari arsiran dan salah satu hukum kembali berlaku.",
    wake: "Hukum logaritmik di model tidak punya batas atas. Jauh dari dinding, kira-kira di atas y/δ ≈ 0,2 (δ tebal lapisan batas), kecepatan mulai menyimpang ke atas garis log (daerah wake, Pope 2000 Bab 7); daerah itu tidak dimodelkan di lembar ini.",
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
      "Titik amatnya jatuh di antara y⁺ sama dengan lima dan tiga puluh. Di daerah ini hukum kental sudah tidak berlaku dan hukum logaritmik belum berlaku, dan tidak ada rumus sederhana yang menggantikan keduanya. Karena itu u⁺ dan u ditulis “—”: memaksakan salah satu hukum hanya memberi angka yang tampak pasti padahal tidak. Yang benar di daerah ini hanya hasil pengukuran atau penyelesaian numerik. Geser titik amatnya lebih dekat ke dinding atau lebih jauh darinya.",
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
    bKental: "Viscous sublayer, u⁺ = y⁺",
    bPenyangga: "Buffer layer, no simple law",
    bLog: "Log layer",
    hUstar: "Friction velocity",
    hYplus: "Kinematic viscosity and dimensionless distance",
    hUplus: "Dimensionless velocity",
    hUplusNone: "Dimensionless velocity: buffer layer, no law applies",
    hU: "Local velocity",
    hDelta: "Viscous sublayer thickness",
    hdlProbe: "Observation probe: drag sideways to change the distance y from the wall",
    pindah: "Move the shear stress or the observation distance and watch the point leave the shading as one of the two laws takes over again.",
    wake: "The log law in the model has no upper limit. Far from the wall, roughly above y/δ ≈ 0.2 (δ the boundary-layer thickness), the velocity starts to rise above the log line (the wake region, Pope 2000 Chapter 7); that region is not modelled on this sheet.",
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
      "The observation point falls between y⁺ of five and thirty. Here the viscous law no longer holds and the logarithmic law does not hold yet, and no simple formula replaces either. That is why u⁺ and u are shown as “—”: forcing either law would only give a number that looks certain but is not. Only measurement or a numerical solution is correct in this region. Move the point closer to the wall or further from it.",
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

/* Sumbu memuat seluruh penggeser (aturan §5): y⁺ 0,045 pada τ 0,05,
   y 0,01 mm, T 4; 60 353 pada τ 40, y 200 mm, T 40 (u⁺ 31,8). Dulu
   0,3–3000 dan u⁺ 0–26, titik jatuh di luar bidang. */
const YP_MIN = 0.03;
const YP_MAX = 1e5;
const UP_MAX = 34;

/* Rentang jarak y, dipakai bersama penggeser, kotak angka, dan pegangan
   probe (aturan 4: satu sumber nilai). */
const P_Y: ParamDef = { min: 0.01, max: 200, step: 0.01, digits: 2 };

const NADA_LAPIS: Record<string, Tone> = {
  kental: "water",
  penyangga: "invalid",
  logaritmik: "energy",
};

export function HukumDindingClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [tau, setTau] = useState(2);
  const [yMm, setYMm] = useState(2);
  const [suhu, setSuhu] = useState(15);
  // Pemadam tanda contoh untuk pegangan seret (lihat SentuhContoh).
  const sentuh = useRef<() => void>(() => {});

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

  const plate = usePlate(
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

      return drawChart(
        ctx,
        cw,
        ch,
        {
          xMin: YP_MIN,
          xMax: YP_MAX,
          yMin: 0,
          yMax: UP_MAX,
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
            { x: 0.12, y: 30, text: T.viscousLayer, color: C.ink3 },
            { x: 12, y: 3.2, text: T.noLawHere, color: C.signal },
          ],
          point: {
            x: yPlus,
            y: uPlus,
            label: `u⁺ ${fmtPlain(uPlus, 2)}`,
            invalid: diPenyangga,
          },
          // Probe sendiri (bukan `point`, yang hilang di luar bidang):
          // DragLayer menjepitnya ke tepi bidang.
          anchors: { probe: { x: yPlus, y: uPlus } },
        },
        lang
      );
    },
    null,
    [tau, yMm, suhu, lang]
  );

  /*
   * Probe y⁺. Posisi tegak (u⁺) adalah HASIL hukum dinding, jadi probe
   * hanya diseret mendatar. y⁺ bukan masukan; yang diubah adalah jarak y,
   * dengan τ₀ dan T tetap:
   *   y = y⁺ · ν / u*   (mm = · 1000)
   * Sumbu y⁺ logaritmik dan tetap, jadi tidak ada saling kejar dengan skala.
   */
  const handles: HandleSpec[] = [
    {
      id: "probe",
      anchor: "probe",
      axis: "x",
      label: x.hdlProbe,
      hollow: true,
      param: P_Y,
      value: yMm,
      toValue: (px, _py, m) => (uStar > 0 ? ((m.invX(px) * nu) / uStar) * 1000 : yMm),
      onChange: setYMm,
      format: (v) => `y ${fmt(v, 2)} mm, y⁺ ${fmt(((v / 1000) * uStar) / nu, 2)}`,
    },
  ];

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="y⁺"
          value={yPlus}
          scale="log"
          digits={2}
          invalid={diPenyangga}
          bands={[
            { from: YP_MIN, to: WALL_VISCOUS_MAX, label: x.bKental, tone: "water" },
            { from: WALL_VISCOUS_MAX, to: WALL_LOG_MIN, label: x.bPenyangga, tone: "invalid" },
            { from: WALL_LOG_MIN, to: YP_MAX, label: x.bLog, tone: "energy" },
          ]}
        />
      }
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
          <canvas ref={plate.ref} className="block h-full w-full" />
          <DragLayer out={plate.outRef.current} handles={handles} touch={() => sentuh.current()} />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <SentuhContoh sentuh={sentuh} />
            <InputTable>
              <InputRow symbol="τ₀" label={x.dTau} value={tau} min={0.05} max={40} step={0.05} digits={2} unit="Pa" onChange={setTau} tint={C.energy} />
              <InputRow symbol="y" label={x.dY} value={yMm} {...P_Y} unit="mm" onChange={setYMm} />
              <InputRow symbol="T" label={x.dT} value={suhu} min={4} max={40} step={0.5} digits={1} unit="°C" onChange={setSuhu} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pSungai, apply: () => { setTau(2); setYMm(2); setSuhu(15); } },
                  { label: x.pPipa, apply: () => { setTau(0.2); setYMm(3); setSuhu(15); } },
                  { label: x.pBanjir, apply: () => { setTau(20); setYMm(20); setSuhu(15); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            {/* y⁺ sudah di pita; angka besar u dan u* (u* diminta dengan angka). */}
            <ResultTable
              rows={[
                { symbol: "u", label: x.rU, value: diPenyangga ? "—" : fmt(u, 4), unit: diPenyangga ? undefined : "m/s", tint: C.water, strong: true },
                { symbol: "u*", label: x.rUstar, value: fmt(uStar, 5), unit: "m/s", tint: C.energy, strong: true },
                { symbol: "u⁺", label: x.rUplus, value: diPenyangga ? "—" : fmt(uPlus, 3), tint: C.water },
                { symbol: "y⁺", label: x.rYplus, value: fmt(yPlus, 3), tint: diPenyangga ? C.signal : undefined },
                { symbol: "δv", label: x.rDelta, value: fmt(delta * 1000, 3), unit: "mm", tint: C.critical },
                { symbol: "—", label: x.rLapis, value: lapisNama },
                { symbol: "ν", label: x.rNu, value: fmtSci(nu), unit: "m²/s" },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hUstar,
                    rumus: <span>u* = √( τ₀ / ρ )</span>,
                    isi: `√( ${fmt(tau, 2)} / ${fmt(1000, 0)} )`,
                    hasil: fmt(uStar, 5),
                    satuan: "m/s",
                    tint: C.energy,
                  },
                  {
                    judul: x.hYplus,
                    rumus: (<><span>ν = ν(T),</span><span className="ml-2">y⁺ =</span><Frac num="y · u*" den="ν" /></>),
                    isi: `ν(${fmt(suhu, 1)} °C) = ${fmtSci(nu)};  ${fmt(y, 5)} · ${fmt(uStar, 6)} / ${fmtSci(nu)}`,
                    hasil: fmt(yPlus, 3),
                  },
                  diPenyangga
                    ? {
                        judul: x.hUplusNone,
                        rumus: <span>{fmt(WALL_VISCOUS_MAX, 0)} ≤ y⁺ &lt; {fmt(WALL_LOG_MIN, 0)}</span>,
                        isi: "—",
                        hasil: "—",
                        tint: C.signal,
                      }
                    : w.layer === "kental"
                      ? {
                          judul: `${x.hUplus} (${x.lKental})`,
                          rumus: <span>u⁺ = y⁺</span>,
                          isi: fmt(yPlus, 4),
                          hasil: fmt(uPlus, 3),
                          tint: C.water,
                        }
                      : {
                          judul: `${x.hUplus} (${x.lLog})`,
                          rumus: (<><span>u⁺ =</span><Frac num="1" den="κ" /><span>ln y⁺ + B</span></>),
                          isi: `( 1 / ${fmt(KARMAN, 2)} ) · ln ${fmt(yPlus, 4)} + ${fmt(WALL_B, 1)}`,
                          hasil: fmt(uPlus, 3),
                          tint: C.water,
                        },
                  {
                    judul: x.hU,
                    rumus: <span>u = u⁺ · u*</span>,
                    isi: diPenyangga ? "—" : `${fmt(uPlus, 4)} · ${fmt(uStar, 6)}`,
                    hasil: diPenyangga ? "—" : fmt(u, 4),
                    satuan: diPenyangga ? undefined : "m/s",
                    tint: C.water,
                  },
                  {
                    judul: x.hDelta,
                    rumus: (<><span>δv =</span><Frac num={`${fmt(WALL_VISCOUS_MAX, 0)} · ν`} den="u*" /></>),
                    isi: `${fmt(WALL_VISCOUS_MAX, 0)} · ${fmtSci(nu)} / ${fmt(uStar, 6)} · 1000`,
                    hasil: fmt(delta * 1000, 3),
                    satuan: "mm",
                    tint: C.critical,
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={NADA_LAPIS[w.layer]}
            badge={lapisNama}
            {...notice(yPlus, u, uStar, delta, w.layer, lang)}
          />
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

/*
 * Isi kalimatnya sama dengan catatan lama; kalimat pertama menyatakan
 * keadaan, sisanya butir.
 */
function notice(
  yPlus: number,
  u: number,
  uStar: number,
  delta: number,
  layer: string,
  lang: Lang
): { state: string; notice: string[] } {
  const x = TXT[lang];
  if (layer === "penyangga") {
    return {
      state:
        lang === "id"
          ? `y⁺ = ${fmt(yPlus, 1)} berada di daerah penyangga: tidak ada hukum sederhana, kecepatan tidak ditulis.`
          : `y⁺ = ${fmt(yPlus, 1)} lies in the buffer layer: no simple law applies, so no velocity is given.`,
      notice: [x.penyanggaNote, x.pindah],
    };
  }
  const nama = layer === "kental" ? x.lKental : x.lLog;
  const tebal =
    lang === "en"
      ? `The viscous sublayer is ${fmt(delta * 1000, 3)} mm thick here, and that single number explains why roughness matters at all. A grain smaller than this layer is buried inside it and the flow never feels it; a grain larger than it pokes through into the turbulent stream and starts to shed eddies.`
      : `Lapisan kentalnya setebal ${fmt(delta * 1000, 3)} mm di sini, dan angka tunggal itu menjelaskan mengapa kekasaran bisa berarti sama sekali. Butir yang lebih kecil daripada lapisan ini terkubur di dalamnya dan alirannya tidak pernah merasakannya; butir yang lebih besar menyembul ke arus turbulen dan mulai melepas pusaran.`;
  const naik =
    lang === "en"
      ? `Raise the shear stress and watch the layer thin out: at ${fmt(uStar, 4)} m/s of friction velocity a wall that was hydraulically smooth can become rough without a single grain being added to it.`
      : `Naikkan tegangan gesernya lalu perhatikan lapisan itu menipis: pada kecepatan gesek ${fmt(uStar, 4)} m/s, dinding yang tadinya licin secara hidrolik dapat berubah menjadi kasar tanpa satu butir pun ditambahkan padanya.`;
  return {
    state: `y⁺ = ${fmt(yPlus, 1)}: ${nama.toLowerCase()}; u = ${fmt(u, 4)} m/s.`,
    notice: layer === "logaritmik" ? [tebal, naik, x.wake] : [tebal, naik],
  };
}
