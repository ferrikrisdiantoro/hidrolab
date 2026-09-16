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
  ROUSE_BEDLOAD,
  ROUSE_FULL,
  ROUSE_PARTIAL,
  SEDIMENT_S,
  fmt,
  fmtPlain,
  fmtSci,
  rouseConcentration,
  rouseState,
  waterViscosity,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksRouse } from "@/lib/checks";

const TXT = {
  id: {
    title: "Profil Rouse",
    sheetTitle: "Profil Rouse — sebaran sedimen melayang sepanjang kedalaman",
    dD: "Garis tengah butir",
    dUstar: "Kecepatan gesek",
    dH: "Kedalaman aliran",
    dA: "Ketinggian acuan di atas dasar",
    dRho: "Rapat massa jenis butir terhadap air",
    dT: "Suhu air",
    pLanau: "Lanau di sungai besar",
    pPasirHalus: "Pasir halus, arus sedang",
    pPasirKasar: "Pasir kasar, arus sedang",
    rWs: "Kecepatan endap butir",
    rZ: "Bilangan Rouse",
    rMode: "Cara angkut",
    rMid: "Kepekatan di setengah kedalaman",
    rBawah: "Bagian muatan di separuh bawah",
    rA: "Tinggi acuan di atas dasar",
    rNu: "Kekentalan kinematik",
    mFull: "Melayang penuh",
    mPartial: "Melayang sebagian",
    mBed: "Angkutan dasar",
    mNone: "Tidak terangkut melayang",
    tak: "Tidak terangkut melayang",
    takNote:
      "Bilangan Rouse di atas 2,5, jadi butirnya kalah jauh cepat mengendap dibanding kemampuan pusaran mengangkatnya. Yang terjadi angkutan dasar, yaitu butir menggelinding dan meloncat di sepanjang dasar, dan sebaran melayang yang digambar di sini praktis nol di mana pun kecuali tepat di ketinggian acuan. Kurvanya tetap digambar karena persamaannya tetap berlaku, tetapi yang ia gambarkan adalah muatan yang jumlahnya dapat diabaikan. Perkecil butirnya atau perbesar kecepatan geseknya.",
    note:
      "Satu angka menentukan seluruh bentuk kurva ini, dan angka itu perbandingan dua kecepatan: seberapa cepat butir jatuh terhadap seberapa kuat pusaran mengangkatnya. Karena keduanya sama-sama berdimensi kecepatan, perbandingannya tak bersatuan, dan satu bilangan itu berlaku untuk lanau di sungai besar maupun pasir di parit kecil. Perhatikan bentuk kurvanya pada bilangan Rouse kecil: hampir tegak, artinya muatannya tersebar merata dari dasar sampai permukaan. Pada bilangan besar kurvanya menempel ke sumbu, artinya seluruh muatan berdesakan di lapisan tipis dekat dasar. Yang tidak dikatakan kurva ini adalah berapa banyak sedimen yang ada; ia hanya menyatakan sebarannya terhadap satu nilai acuan yang harus diukur atau ditaksir tersendiri. Itulah keterbatasan terpenting yang perlu diingat saat memakainya.",
  },
  en: {
    title: "Rouse profile",
    sheetTitle: "Rouse profile — suspended sediment over the depth",
    dD: "Grain diameter",
    dUstar: "Friction velocity",
    dH: "Flow depth",
    dA: "Reference height above the bed",
    dRho: "Grain density relative to water",
    dT: "Water temperature",
    pLanau: "Silt in a large river",
    pPasirHalus: "Fine sand, moderate current",
    pPasirKasar: "Coarse sand, moderate current",
    rWs: "Grain settling velocity",
    rZ: "Rouse number",
    rMode: "Transport mode",
    rMid: "Concentration at mid depth",
    rBawah: "Share of the load in the lower half",
    rA: "Reference height above the bed",
    rNu: "Kinematic viscosity",
    mFull: "Fully suspended",
    mPartial: "Partly suspended",
    mBed: "Bed load",
    mNone: "Not carried in suspension",
    tak: "Not carried in suspension",
    takNote:
      "The Rouse number is above 2.5, so the grain settles far faster than the eddies can lift it. What happens is bed load: grains rolling and hopping along the bed, and the suspended distribution drawn here is effectively zero everywhere except right at the reference height. The curve is still drawn because the equation still holds, but what it describes is a load of negligible amount. Reduce the grain size or raise the friction velocity.",
    note:
      "One number sets the whole shape of this curve, and that number is a ratio of two velocities: how fast the grain falls against how strongly the eddies lift it. Because both have the dimensions of velocity, the ratio carries no units, and the single number serves silt in a great river as well as sand in a small ditch. Notice the curve shape at small Rouse numbers: almost vertical, meaning the load is spread evenly from bed to surface. At large numbers the curve hugs the axis, meaning the whole load crowds into a thin layer near the bed. What this curve does not say is how much sediment there is; it only states the distribution relative to one reference value that must be measured or estimated separately. That is the most important limitation to keep in mind when using it.",
  },
} as const;

const REFS = {
  id: [
    "Rouse, H. (1937). Modern conceptions of the mechanics of fluid turbulence. Transactions ASCE, vol. 102.",
    "Vanoni, V.A. (1975). Sedimentation Engineering. ASCE Manual 54, Bab 2.",
    "Ferguson, R.I. & Church, M. (2004). A simple universal equation for grain settling velocity. Journal of Sedimentary Research, vol. 74.",
    "García, M.H. (2008). Sedimentation Engineering. ASCE Manual 110, Bab 2.",
  ],
  en: [
    "Rouse, H. (1937). Modern conceptions of the mechanics of fluid turbulence. Transactions ASCE, vol. 102.",
    "Vanoni, V.A. (1975). Sedimentation Engineering. ASCE Manual 54, Chapter 2.",
    "Ferguson, R.I. & Church, M. (2004). A simple universal equation for grain settling velocity. Journal of Sedimentary Research, vol. 74.",
    "García, M.H. (2008). Sedimentation Engineering. ASCE Manual 110, Chapter 2.",
  ],
} as const;

/** Bilangan Rouse yang digambar sebagai kurva latar. */
const KELUARGA_Z = [0.1, 0.3, 0.6, 1, 2, 4];

export function ProfilRouseClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [dMm, setDMm] = useState(0.1);
  const [uStar, setUStar] = useState(0.05);
  const [h, setH] = useState(2);
  const [aFrac, setAFrac] = useState(0.025);
  const [s, setS] = useState(SEDIMENT_S);
  const [suhu, setSuhu] = useState(15);

  const nu = waterViscosity(suhu);
  const d = dMm / 1000;
  const a = aFrac * h;
  const r = rouseState(d, s, nu, uStar, h, a);
  const tak = r.mode === "tidak-terangkut";

  const modeNama =
    r.mode === "melayang-penuh"
      ? x.mFull
      : r.mode === "melayang-sebagian"
        ? x.mPartial
        : r.mode === "dasar"
          ? x.mBed
          : x.mNone;

  const ref = useCanvas(
    (ctx, w, ch) => {
      const kurva = (Z: number) => {
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i <= 200; i++) {
          const yy = a + ((h - a) * i) / 200;
          pts.push({ x: rouseConcentration(yy, h, a, Z), y: yy / h });
        }
        return pts;
      };

      const deret: ChartSeries[] = KELUARGA_Z.map((Z) => ({
        pts: kurva(Z),
        color: C.ink3,
        weight: W.hair,
        label: `Z ${fmtPlain(Z, 1)}`,
        labelAt: 0.55,
        labelDy: -8,
      }));

      deret.push({
        pts: kurva(r.Z),
        color: tak ? C.signal : C.water,
        weight: W.bold,
        dash: tak ? DASH.invalid : DASH.solid,
      });

      drawChart(
        ctx,
        w,
        ch,
        {
          xMin: 0,
          xMax: 1,
          yMin: 0,
          yMax: 1,
          axisX: T.axRelConc,
          axisY: T.axHeight,
          series: deret,
          rules: [
            {
              axis: "y",
              at: a / h,
              color: C.critical,
              dash: DASH.axis,
              label: `${T.referenceHeight} ${fmtPlain(a, 3)} m`,
              labelAlign: "right",
            },
          ],
          point: {
            x: r.midRatio,
            y: 0.5,
            label: `Z ${fmtPlain(r.Z, 2)}`,
            invalid: tak,
          },
        },
        lang
      );
    },
    [dMm, uStar, h, aFrac, s, suhu, lang]
  );

  return (
    <LabShell
      sheet="SD-02"
      subject={SUBJECTS.SD[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Dua kecepatan bersaing: <Term tint={C.critical}>laju jatuh</Term>{" "}
            butir melawan <Term tint={C.water}>kekuatan angkat pusaran</Term>.
            Perbandingan keduanya tidak bersatuan, dan satu angka itu
            menentukan seluruh bentuk sebarannya.
          </p>
        ) : (
          <p>
            Two velocities compete: the{" "}
            <Term tint={C.critical}>fall rate</Term> of the grain against the{" "}
            <Term tint={C.water}>lifting strength of the eddies</Term>. Their
            ratio has no units, and that single number sets the entire shape of
            the distribution.
          </p>
        )
      }
      drawing={
        <Sheet
          number="SD-02"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m/s)" },
            { label: "d", value: `${fmt(dMm, 3)} mm` },
            { label: "ws", value: `${fmtSci(r.ws)} m/s`, tint: C.critical },
            { label: "Z", value: fmt(r.Z, 3), tint: tak ? C.signal : C.water },
            { label: "h", value: `${fmt(h, 2)} m` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="d" label={x.dD} value={dMm} min={0.004} max={4} step={0.002} digits={3} unit="mm" onChange={setDMm} tint={C.critical} />
              <InputRow symbol="u*" label={x.dUstar} value={uStar} min={0.002} max={0.4} step={0.002} digits={3} unit="m/s" onChange={setUStar} tint={C.water} />
              <InputRow symbol="h" label={x.dH} value={h} min={0.1} max={20} step={0.1} digits={1} unit="m" onChange={setH} />
              <InputRow symbol="a/h" label={x.dA} value={aFrac} min={0.005} max={0.2} step={0.005} digits={3} onChange={setAFrac} />
              <InputRow symbol="s" label={x.dRho} value={s} min={1.05} max={4} step={0.05} digits={2} onChange={setS} />
              <InputRow symbol="T" label={x.dT} value={suhu} min={4} max={40} step={0.5} digits={1} unit="°C" onChange={setSuhu} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pLanau, apply: () => { setDMm(0.02); setUStar(0.06); setH(5); setAFrac(0.02); setS(SEDIMENT_S); setSuhu(15); } },
                  { label: x.pPasirHalus, apply: () => { setDMm(0.1); setUStar(0.05); setH(2); setAFrac(0.025); setS(SEDIMENT_S); setSuhu(15); } },
                  { label: x.pPasirKasar, apply: () => { setDMm(0.5); setUStar(0.05); setH(2); setAFrac(0.025); setS(SEDIMENT_S); setSuhu(15); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={tak ? undefined : C.water} alert={tak}>
                {modeNama}
              </Flag>
            </div>
            {tak && (
              <div className="mb-2.5">
                <Note>{x.takNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "Z", label: x.rZ, value: fmt(r.Z, 4), tint: tak ? C.signal : C.water, strong: true },
                { symbol: "ws", label: x.rWs, value: fmtSci(r.ws), unit: "m/s", tint: C.critical, strong: true },
                { symbol: "—", label: x.rMode, value: modeNama },
                { symbol: "c½/ca", label: x.rMid, value: fmt(r.midRatio, 5) },
                { symbol: "—", label: x.rBawah, value: fmt(r.lowerHalf * 100, 1), unit: "%" },
                /*
                 * Satu-satunya besaran di lembar ini yang bergantung pada
                 * kedalaman. Tanpa baris ini, menggeser kedalaman dari
                 * sepersepuluh meter ke dua puluh meter tidak mengubah apa
                 * pun selain angka di kop, dan pembaca berhak menyimpulkan
                 * lembarnya rusak. Yang sebenarnya terjadi justru pokok
                 * lembar ini, dan sekarang dikatakan di catatan bawah.
                 */
                {
                  symbol: "a",
                  label: x.rA,
                  value: a >= 1 ? fmt(a, 3) : fmt(a * 1000, 1),
                  unit: a >= 1 ? "m" : "mm",
                },
                { symbol: "ν", label: x.rNu, value: fmtSci(nu), unit: "m²/s" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(r.Z, r.lowerHalf, r.midRatio, h, a, tak, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksRouse(d, s, nu, uStar, h, a)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <Frac num="c" den="ca" />
                <span>=</span>
                <span className="ml-1">[</span>
                <Frac num="h − y" den="y" />
                <span>·</span>
                <Frac num="a" den="h − a" />
                <span>]^Z</span>
              </Eq>
              <Eq>
                <span>Z =</span>
                <Frac num="ws" den="β κ u*" />
                <span className="ml-5">β = 1</span>
                <span className="ml-3">κ = {fmtPlain(KARMAN, 2)}</span>
              </Eq>
              <Eq>
                <span>ws =</span>
                <Frac num="(s − 1) g d²" den="18 ν + √(0,75 (s−1) g d³)" />
                <span className="ml-3 text-ink-3">
                  {lang === "id" ? "Ferguson-Church" : "Ferguson-Church"}
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
  Z: number,
  lowerHalf: number,
  mid: number,
  h: number,
  a: number,
  tak: boolean,
  lang: Lang
): string {
  /*
   * Kalimat yang menjelaskan mengapa menggeser kedalaman tidak menggerakkan
   * kurvanya. Bukan penambal melainkan pokok lembarnya: pada sumbu nisbi,
   * kedalaman benar-benar lenyap dari persamaannya.
   */
  const kedalaman =
    lang === "id"
      ? ` Geser kedalamannya dari sepersepuluh meter ke dua puluh meter dan kurvanya tidak bergerak sedikit pun. Itu bukan kerusakan melainkan pokok lembar ini: pada sumbu nisbi, bilangan Rouse tidak mengandung kedalaman sama sekali, jadi flum sedalam sepuluh sentimeter dan sungai sedalam dua puluh meter yang kecepatan geseknya sama membawa sebaran nisbi yang sama persis. Yang diubah kedalaman hanya letak sebenarnya tinggi acuan itu, sekarang ${a >= 1 ? `${fmt(a, 2)} meter` : `${fmt(a * 1000, 0)} milimeter`} di atas dasar, dan itulah satu-satunya baris di tabel yang ikut bergerak.`
      : ` Drag the depth from a tenth of a metre to twenty metres and the curve does not move at all. That is not a fault but the point of this sheet: in relative coordinates the Rouse number contains no depth whatever, so a ten centimetre flume and a twenty metre river at the same friction velocity carry exactly the same relative distribution. All the depth changes is where that reference height actually sits, now ${a >= 1 ? `${fmt(a, 2)} metres` : `${fmt(a * 1000, 0)} millimetres`} above the bed, and that is the only row in the table that moves with it.`;

  if (tak) {
    return lang === "id"
      ? `Bilangan Rouse ${fmt(Z, 2)} sudah melewati ${fmtPlain(ROUSE_BEDLOAD, 1)}, dan di atas itu sebaran melayang tidak lagi menggambarkan apa yang sebenarnya terjadi. Perkecil butirnya atau perbesar kecepatan geseknya sampai bilangan Rouse turun di bawah ${fmtPlain(ROUSE_PARTIAL, 1)}.${kedalaman}`
      : `The Rouse number ${fmt(Z, 2)} has passed ${fmtPlain(ROUSE_BEDLOAD, 1)}, and above that the suspended distribution no longer describes what actually happens. Reduce the grain size or raise the friction velocity until the Rouse number falls below ${fmtPlain(ROUSE_PARTIAL, 1)}.${kedalaman}`;
  }

  if (lang === "en")
    return `At a Rouse number of ${fmt(Z, 2)}, ${fmt(lowerHalf * 100, 0)} per cent of the suspended load sits in the lower half of the depth, and the concentration at mid depth has fallen to ${fmt(mid, 3)} of the reference value. Below ${fmtPlain(ROUSE_FULL, 1)} the load is essentially uniform and a single depth-averaged sample represents the whole column; above it a sample taken near the surface will understate the load by whatever factor this curve says. That is why sediment sampling protocols specify the sampling height rather than leaving it to the field crew.${kedalaman}`;
  return `Pada bilangan Rouse ${fmt(Z, 2)}, sebanyak ${fmt(lowerHalf * 100, 0)} persen muatan melayangnya berada di separuh bawah kedalaman, dan kepekatan di setengah kedalaman sudah turun ke ${fmt(mid, 3)} dari nilai acuannya. Di bawah ${fmtPlain(ROUSE_FULL, 1)} muatannya praktis merata dan satu contoh rata-rata kedalaman mewakili seluruh kolom; di atasnya, contoh yang diambil dekat permukaan akan mengecilkan muatannya sebesar apa pun yang dikatakan kurva ini. Itulah sebabnya tata cara pengambilan contoh sedimen menetapkan ketinggian pengambilannya, bukan menyerahkannya kepada petugas lapangan.${kedalaman}`;
}
