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
import { drawOrifice } from "@/lib/drawOrifice";
import {
  ORIFICE_CC_SLOT,
  fmt,
  orificeJet,
  type OrificeResult,
} from "@/lib/hydraulics";
import { C } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksOrifice } from "@/lib/checks";

const TXT = {
  id: {
    title: "Vena contracta",
    sheetTitle: "Lubang berbibir tajam pada dinding tegak — potongan melintang",
    dH: "Tinggi muka air di atas sumbu lubang",
    da: "Tinggi bukaan lubang",
    db: "Lebar lubang",
    dz: "Tinggi sumbu lubang di atas lantai",
    dCv: "Koefisien kecepatan",
    dCc: "Koefisien kontraksi",
    pTajam: "Lubang berbibir tajam",
    pTeori: "Celah dua dimensi, nilai teoretis",
    pBorda: "Mulut Borda",
    rQ: "Debit",
    rVth: "Kecepatan tanpa kehilangan",
    rV: "Kecepatan di vena contracta",
    rCd: "Koefisien debit",
    rArea: "Luas lubang",
    rVena: "Luas pancaran di vena contracta",
    rX: "Jarak vena contracta dari bibir",
    rLoss: "Tinggi energi yang hilang",
    rJangkau: "Jangkauan pancaran sampai lantai",
    teori: "Sama dengan nilai teoretis",
    note:
      "Dua koefisien bekerja berurutan di sini, dan menukarnya adalah kesalahan yang paling sering terjadi pada perhitungan lubang. Kontraksi mengurangi LUAS pancaran, bukan lajunya. Sebabnya bentuk geometri, bukan gesekan: air yang mendekati lubang dari atas dan dari bawah tidak dapat berbelok tajam tepat di bibirnya, sehingga garis arusnya masih melengkung sebentar setelah keluar. Di tempat lengkungan itu selesai, pancaran paling sempit dan garis arusnya sejajar, dan hanya di situ tekanannya nol. Itulah sebabnya penampang acuan bukan bibir lubang melainkan vena contracta, kira-kira setengah tinggi bukaan di hilirnya. Koefisien kecepatan mengurangi LAJU, dan inilah yang berasal dari gesekan di bibir lubang. Nilainya dekat sekali dengan satu, biasanya 0,97 sampai 0,99, jauh lebih dekat daripada koefisien kontraksinya. Hasil kali keduanya adalah koefisien debit, dan hanya hasil kali itulah yang dapat dibaca dari pengukuran debit. Untuk memisahkan keduanya diperlukan pengukuran kedua, dan yang paling murah bukan mengukur kecepatan melainkan mengukur lintasan pancarannya dengan meteran, karena lintasan tanpa kehilangan memenuhi hubungan x kuadrat sama dengan empat H y.",
  },
  en: {
    title: "Vena contracta",
    sheetTitle: "Sharp-edged orifice in a vertical wall — cross section",
    dH: "Head above the orifice axis",
    da: "Orifice opening height",
    db: "Orifice width",
    dz: "Orifice axis above the floor",
    dCv: "Velocity coefficient",
    dCc: "Contraction coefficient",
    pTajam: "Sharp-edged orifice",
    pTeori: "Two-dimensional slot, theoretical value",
    pBorda: "Borda mouthpiece",
    rQ: "Discharge",
    rVth: "Loss-free velocity",
    rV: "Velocity at the vena contracta",
    rCd: "Discharge coefficient",
    rArea: "Orifice area",
    rVena: "Jet area at the vena contracta",
    rX: "Distance from the lip to the vena contracta",
    rLoss: "Head lost",
    rJangkau: "Jet reach to the floor",
    teori: "Equal to the theoretical value",
    note:
      "Two coefficients act in sequence here, and swapping them is the most common error in orifice calculations. Contraction reduces the AREA of the jet, not its speed. The cause is geometry, not friction: water approaching the orifice from above and below cannot turn sharply at the lip, so its streamlines keep curving for a short distance after leaving. Where that curvature ends, the jet is narrowest and its streamlines are parallel, and only there is the pressure zero. That is why the reference section is not the lip but the vena contracta, roughly half an opening height downstream. The velocity coefficient reduces the SPEED, and it is this one that comes from friction at the lip. Its value sits very close to one, usually 0.97 to 0.99, far closer than the contraction coefficient. The product of the two is the discharge coefficient, and only that product can be read from a discharge measurement. Separating them needs a second measurement, and the cheapest is not to measure velocity but to measure the jet path with a tape, because the loss-free path satisfies x squared equals four H y.",
  },
} as const;

const REFS = {
  id: [
    "Vennard, J.K. & Street, R.L. (1982). Elementary Fluid Mechanics, edisi ke-6. Wiley. Bab tentang lubang dan pancaran.",
    "Lamb, H. (1932). Hydrodynamics, edisi ke-6. Cambridge University Press. Penyelesaian Kirchhoff untuk pancaran bebas.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Bab 14, pintu dan lubang.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Bab 6, pintu sorong dan vena contracta.",
  ],
  en: [
    "Vennard, J.K. & Street, R.L. (1982). Elementary Fluid Mechanics, 6th ed. Wiley. Chapter on orifices and jets.",
    "Lamb, H. (1932). Hydrodynamics, 6th ed. Cambridge University Press. Kirchhoff's free-jet solution.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Chapter 14, gates and orifices.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Chapter 6, sluice gates and the vena contracta.",
  ],
} as const;

export function VenaContractaClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [H, setH] = useState(1.5);
  const [a, setA] = useState(0.05);
  const [bLubang, setBLubang] = useState(0.1);
  const [z0, setZ0] = useState(0.6);
  const [Cv, setCv] = useState(0.98);
  const [Cc, setCc] = useState(0.62);

  const r = orificeJet(H, a, bLubang, Cv, Cc);
  const jangkau = r.V * Math.sqrt((2 * z0) / 9.81);
  const dekatTeori = Math.abs(Cc - ORIFICE_CC_SLOT) < 0.002;

  const ref = useCanvas(
    (ctx, w, h) =>
      drawOrifice(
        ctx,
        w,
        h,
        { H, a, z0, Cc, V: r.V, Vth: r.Vth, xVena: r.xVena },
        lang
      ),
    [H, a, bLubang, z0, Cv, Cc, lang]
  );

  return (
    <LabShell
      sheet="HS-07"
      subject={SUBJECTS.HS[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Pancaran yang keluar dari lubang lebih sempit daripada lubangnya
            sendiri, dan penyempitan itu bukan akibat gesekan melainkan akibat{" "}
            <Term tint={C.water}>bentuk geometri</Term>. Air tidak dapat
            berbelok tajam, jadi ia terus melengkung sebentar setelah keluar.
          </p>
        ) : (
          <p>
            The jet leaving an orifice is narrower than the orifice itself, and
            that narrowing is not caused by friction but by{" "}
            <Term tint={C.water}>geometry</Term>. Water cannot turn a sharp
            corner, so it keeps curving for a short distance after it leaves.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HS-07"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "H", value: `${fmt(H, 3)} m`, tint: C.water },
            { label: "Cc", value: fmt(Cc, 4), tint: C.signal },
            { label: "Cv", value: fmt(Cv, 4) },
            { label: "Cd", value: fmt(r.Cd, 4) },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="H" label={x.dH} value={H} min={0.1} max={6} step={0.05} digits={2} unit="m" onChange={setH} tint={C.water} />
              <InputRow symbol="a" label={x.da} value={a * 1000} min={5} max={300} step={5} digits={0} unit="mm" onChange={(v) => setA(v / 1000)} />
              <InputRow symbol="b" label={x.db} value={bLubang * 1000} min={10} max={800} step={10} digits={0} unit="mm" onChange={(v) => setBLubang(v / 1000)} />
              <InputRow symbol="z₀" label={x.dz} value={z0} min={0.1} max={3} step={0.05} unit="m" onChange={setZ0} />
              <InputRow symbol="Cv" label={x.dCv} value={Cv} min={0.9} max={1} step={0.005} digits={3} onChange={setCv} />
              <InputRow symbol="Cc" label={x.dCc} value={Cc} min={0.5} max={1} step={0.005} digits={3} onChange={setCc} tint={C.signal} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pTajam, apply: () => { setH(1.5); setA(0.05); setBLubang(0.1); setZ0(0.6); setCv(0.98); setCc(0.62); } },
                  { label: x.pTeori, apply: () => { setH(1.5); setA(0.05); setBLubang(0.4); setZ0(0.6); setCv(1); setCc(0.611); } },
                  { label: x.pBorda, apply: () => { setH(1.5); setA(0.05); setBLubang(0.1); setZ0(0.6); setCv(0.98); setCc(0.5); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={C.water}>{`${fmt(r.Q * 1000, 2)} l/s`}</Flag>
              {dekatTeori && <Flag tint={C.critical}>{x.teori}</Flag>}
            </div>
            <ResultTable
              rows={[
                { symbol: "Q", label: x.rQ, value: fmt(r.Q * 1000, 3), unit: "l/s", tint: C.water, strong: true },
                { symbol: "Cd", label: x.rCd, value: fmt(r.Cd, 4), strong: true },
                { symbol: "V₀", label: x.rVth, value: fmt(r.Vth, 3), unit: "m/s", tint: C.ink3 },
                { symbol: "V", label: x.rV, value: fmt(r.V, 3), unit: "m/s", tint: C.water },
                { symbol: "A", label: x.rArea, value: fmt(r.area * 1e4, 2), unit: "cm²" },
                { symbol: "Ac", label: x.rVena, value: fmt(r.areaVena * 1e4, 2), unit: "cm²", tint: C.signal },
                { symbol: "xc", label: x.rX, value: fmt(r.xVena * 1000, 1), unit: "mm", tint: C.signal },
                { symbol: "hL", label: x.rLoss, value: fmt(r.headLoss, 4), unit: "m", tint: C.energy },
                { symbol: "R", label: x.rJangkau, value: fmt(jangkau, 3), unit: "m" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(r, H, Cc, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksOrifice(H, a, bLubang, Cv, Cc)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>V₀ = √(2gH)</span>
                <span className="ml-5">V = Cv V₀</span>
                <span className="ml-5">Q = Cc Cv A √(2gH)</span>
              </Eq>
              <Eq>
                <span>x² = 4 H y</span>
                <span className="ml-4 text-ink-3">
                  {lang === "id"
                    ? "lintasan tanpa kehilangan, g saling menghapus"
                    : "the loss-free path, with g cancelling out"}
                </span>
                <span className="ml-5">Cc =</span>
                <Frac num="π" den="π + 2" />
                <span className="ml-1 text-ink-3">
                  {lang === "id" ? "celah dua dimensi" : "two-dimensional slot"}
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

function notice(r: OrificeResult, H: number, Cc: number, lang: Lang): string {
  const susut = (1 - Cc) * 100;
  const lambat = (1 - r.Cv) * 100;

  if (lang === "en")
    return `Compare the two losses side by side. Contraction takes ${susut.toFixed(1)} per cent of the area away, while friction takes only ${lambat.toFixed(1)} per cent of the speed. That imbalance is the point: almost everything that separates the ideal discharge from the real one is geometry, not friction. Set the contraction coefficient to ${ORIFICE_CC_SLOT.toFixed(3)} and the velocity coefficient to one, and the sheet reproduces the exact two-dimensional solution, where the phantom path and the real path fall on top of each other and the jet obeys x² = 4Hy with H at ${H.toFixed(2)} m.`;
  return `Bandingkan kedua kehilangan itu berdampingan. Kontraksi mengambil ${susut.toFixed(1)} persen dari luasnya, sedangkan gesekan hanya mengambil ${lambat.toFixed(1)} persen dari lajunya. Ketimpangan itulah intinya: hampir seluruh yang memisahkan debit ideal dari debit nyata adalah geometri, bukan gesekan. Setel koefisien kontraksi ke ${ORIFICE_CC_SLOT.toFixed(3)} dan koefisien kecepatan ke satu, dan lembar ini mengulang penyelesaian dua dimensi yang tertutup itu: garis khayal dan lintasan sesungguhnya berimpit, dan pancarannya memenuhi x² = 4Hy dengan H sebesar ${H.toFixed(2)} m.`;
}
