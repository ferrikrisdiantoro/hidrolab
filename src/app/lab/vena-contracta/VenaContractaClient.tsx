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
  Sheet,
  StateCard,
  Term,
} from "@/components/ui";
import { usePlate, usePutar } from "@/lib/usePlate";
import { drawOrifice, drawOrificeMotion } from "@/lib/drawOrifice";
import { createJetMotion, type JetMotion } from "@/lib/jetMotion";
import {
  G,
  ORIFICE_CC_SLOT,
  fmt,
  orificeJet,
} from "@/lib/hydraulics";
import { C } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksOrifice } from "@/lib/checks";

const TXT = {
  id: {
    motionNote: "butir air di pancaran: dari Cc·V di bibir naik ke V di vena contracta, lalu jatuh bebas; waktu diperlambat ×4",
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
    takRendam: "Lubang tidak terendam penuh",
    rendam: "Lubang terendam",
    bandTak: "Bukaan tidak terendam",
    bandRendam: "Lubang terendam",
    takRumus: "bibir atas di atas muka air, rumus lubang tidak berlaku",
    takRendamNote:
      "Tinggi muka air di atas titik berat lubang lebih kecil daripada setengah tinggi bukaannya, jadi bibir atas lubang muncul di atas permukaan. Yang terjadi bukan lagi aliran lubang melainkan luapan di atas ambang, dan seluruh rumus di lembar ini berdiri di atas andaian bahwa bukaan terendam penuh. Karena itu debit, laju, dan pancaran ditulis “—”. Turunkan tinggi bukaan, atau naikkan muka airnya melewati",
    note:
      "Dua koefisien bekerja berurutan di sini, dan menukarnya adalah kesalahan yang paling sering terjadi pada perhitungan lubang. Kontraksi mengurangi LUAS pancaran, bukan lajunya. Sebabnya bentuk geometri, bukan gesekan: air yang mendekati lubang dari atas dan dari bawah tidak dapat berbelok tajam tepat di bibirnya, sehingga garis arusnya masih melengkung sebentar setelah keluar. Di tempat lengkungan itu selesai, pancaran paling sempit dan garis arusnya sejajar, dan hanya di situ tekanannya nol. Itulah sebabnya penampang acuan bukan bibir lubang melainkan vena contracta, kira-kira setengah tinggi bukaan di hilirnya. Koefisien kecepatan mengurangi LAJU, dan inilah yang berasal dari gesekan di bibir lubang. Nilainya dekat sekali dengan satu, biasanya 0,97 sampai 0,99, jauh lebih dekat daripada koefisien kontraksinya. Hasil kali keduanya adalah koefisien debit, dan hanya hasil kali itulah yang dapat dibaca dari pengukuran debit. Untuk memisahkan keduanya diperlukan pengukuran kedua, dan yang paling murah bukan mengukur kecepatan melainkan mengukur lintasan pancarannya dengan meteran, karena lintasan tanpa kehilangan memenuhi hubungan x kuadrat sama dengan empat H y.",
  },
  en: {
    motionNote: "water particles in the jet: from Cc·V at the lip to V at the vena contracta, then free fall; time slowed ×4",
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
    takRendam: "Opening not fully submerged",
    rendam: "Submerged orifice",
    bandTak: "Opening not submerged",
    bandRendam: "Submerged orifice",
    takRumus: "top lip above the water surface, orifice formula does not apply",
    takRendamNote:
      "The head above the centroid is less than half the opening height, so the top lip stands above the water surface. What happens then is not orifice flow but flow over a weir, and every formula on this sheet assumes a fully submerged opening. So discharge, velocity, and jet values are shown as “—”. Reduce the opening height, or raise the head past",
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

/** Lapis gerak: waktu diperlambat empat kali (pancaran jatuh dalam sepersekian detik). */
const SKALA_WAKTU = 0.25;

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
  const jangkau = r.V * Math.sqrt((2 * z0) / G);
  const dekatTeori = Math.abs(Cc - ORIFICE_CC_SLOT) < 0.002;
  const takRendam = !r.submerged;
  /* Saat bukaan tidak terendam, rumus lubang tidak berlaku: angka yang
     keluar dari persamaannya ditulis "—", bukan angka seolah sah. */
  const sah = (v: number) => (takRendam ? NaN : v);
  const susut = (1 - Cc) * 100;
  const lambat = (1 - r.Cv) * 100;

  const langkahV0 = {
    judul: x.rVth,
    rumus: <span>V₀ = √( 2 g H )</span>,
    isi: `√( 2 · ${fmt(G, 2)} · ${fmt(H, 2)} )`,
    hasil: fmt(r.Vth, 3),
    satuan: "m/s",
    tint: C.ink3,
  };

  /* Lapis gerak (Phase 2): butir air di pancaran dengan kecepatan dari
     orificeJet (V = Cv·√(2gH)): kontinuitas sampai vena contracta, lalu
     gerak peluru yang sama dengan lintasan yang digambar. Lapis statis
     tanpa penanda arah, jadi sama saat berputar maupun dijeda. Lubang
     yang tidak terendam tidak dianimasikan (bukan pancaran lubang). */
  const { playing, toggle: togglePutar } = usePutar();
  const gerak = useRef<JetMotion | null>(null);
  if (gerak.current === null) gerak.current = createJetMotion(60, "vertical");
  const plate = usePlate(
    (ctx, w, h) =>
      drawOrifice(
        ctx,
        w,
        h,
        { H, a, z0, Cc, V: r.V, Vth: r.Vth, xVena: r.xVena, notSubmerged: takRendam },
        lang
      ),
    (ctx, _w, _h, tt, _dt, out) =>
      drawOrificeMotion(
        ctx,
        tt,
        out,
        { a, Cc, xVena: r.xVena, z0, V: r.V, notSubmerged: takRendam },
        gerak.current!
      ),
    [H, a, bLubang, z0, Cv, Cc, lang],
    { playing, timeScale: SKALA_WAKTU }
  );

  return (
    <LabShell
      status={
        /* Batas pita dari orificeJet: submerged bila H ≥ a/2, jadi H/a = 0,5.
           Sumbu 0,3 sampai 1 200 memuat seluruh rentang penggeser
           (0,10/0,300 = 0,333 sampai 6/0,005 = 1 200). */
        <RegimeScale
          symbol="H/a"
          value={H / a}
          invalid={takRendam}
          scale="log"
          digits={2}
          bands={[
            { from: 0.3, to: 0.5, label: x.bandTak, tone: "invalid" },
            { from: 0.5, to: 1200, label: x.bandRendam, tone: "water" },
          ]}
        />
      }
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
            { label: "Cc", value: fmt(Cc, 4), tint: C.water },
            { label: "Cv", value: fmt(Cv, 4) },
            { label: "Cd", value: fmt(r.Cd, 4) },
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
              <InputRow symbol="H" label={x.dH} value={H} min={0.1} max={6} step={0.05} digits={2} unit="m" onChange={setH} tint={C.water} />
              <InputRow symbol="a" label={x.da} value={a * 1000} min={5} max={300} step={5} digits={0} unit="mm" onChange={(v) => setA(v / 1000)} />
              <InputRow symbol="b" label={x.db} value={bLubang * 1000} min={10} max={800} step={10} digits={0} unit="mm" onChange={(v) => setBLubang(v / 1000)} />
              <InputRow symbol="z₀" label={x.dz} value={z0} min={0.1} max={3} step={0.05} unit="m" onChange={setZ0} />
              <InputRow symbol="Cv" label={x.dCv} value={Cv} min={0.9} max={1} step={0.005} digits={3} onChange={setCv} />
              <InputRow symbol="Cc" label={x.dCc} value={Cc} min={0.5} max={1} step={0.005} digits={3} onChange={setCc} tint={C.water} />
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
            <ResultTable
              rows={[
                { symbol: "Q", label: x.rQ, value: fmt(sah(r.Q * 1000), 3), unit: "l/s", tint: C.water, strong: true },
                { symbol: "Cd", label: x.rCd, value: fmt(r.Cd, 4), strong: true },
                { symbol: "V₀", label: x.rVth, value: fmt(r.Vth, 3), unit: "m/s", tint: C.ink3 },
                { symbol: "V", label: x.rV, value: fmt(sah(r.V), 3), unit: "m/s", tint: C.water },
                { symbol: "A", label: x.rArea, value: fmt(r.area * 1e4, 2), unit: "cm²" },
                { symbol: "Ac", label: x.rVena, value: fmt(sah(r.areaVena * 1e4), 2), unit: "cm²", tint: C.water },
                { symbol: "xc", label: x.rX, value: fmt(sah(r.xVena * 1000), 1), unit: "mm" },
                { symbol: "hL", label: x.rLoss, value: fmt(sah(r.headLoss), 4), unit: "m", tint: C.energy },
                { symbol: "R", label: x.rJangkau, value: fmt(sah(jangkau), 3), unit: "m" },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={
                  takRendam
                    ? [
                        langkahV0,
                        {
                          judul: x.takRendam,
                          rumus: <span>H &lt; a/2</span>,
                          isi: `${fmt(H, 2)} < ${fmt(r.minHead, 3)} m: ${x.takRumus}`,
                          hasil: "—",
                        },
                      ]
                    : [
                        langkahV0,
                        {
                          judul: x.rV,
                          rumus: <span>V = Cv · V₀</span>,
                          isi: `${fmt(Cv, 3)} · ${fmt(r.Vth, 4)}`,
                          hasil: fmt(r.V, 3),
                          satuan: "m/s",
                          tint: C.water,
                        },
                        {
                          judul: x.rLoss,
                          rumus: (<><span>hL =</span><Frac num="V₀² − V²" den="2g" /></>),
                          isi: `( ${fmt(r.Vth, 4)}² − ${fmt(r.V, 4)}² ) / ( 2 · ${fmt(G, 2)} )`,
                          hasil: fmt(r.headLoss, 4),
                          satuan: "m",
                          tint: C.energy,
                        },
                        {
                          judul: x.rArea,
                          rumus: <span>A = a · b</span>,
                          isi: `${fmt(a * 1000, 0)} mm · ${fmt(bLubang * 1000, 0)} mm`,
                          hasil: fmt(r.area * 1e4, 2),
                          satuan: "cm²",
                        },
                        {
                          judul: x.rVena,
                          rumus: <span>Ac = Cc · A</span>,
                          isi: `${fmt(Cc, 3)} · ${fmt(r.area * 1e4, 3)}`,
                          hasil: fmt(r.areaVena * 1e4, 2),
                          satuan: "cm²",
                          tint: C.water,
                        },
                        {
                          judul: x.rX,
                          rumus: <span>xc = a / 2</span>,
                          isi: `${fmt(a * 1000, 0)} / 2`,
                          hasil: fmt(r.xVena * 1000, 1),
                          satuan: "mm",
                        },
                        {
                          judul: x.rCd,
                          rumus: <span>Cd = Cc · Cv</span>,
                          isi: `${fmt(Cc, 3)} · ${fmt(Cv, 3)}`,
                          hasil: fmt(r.Cd, 4),
                        },
                        {
                          judul: x.rQ,
                          rumus: <span>Q = V · Ac</span>,
                          isi: `${fmt(r.V, 4)} m/s · ${fmt(r.areaVena * 1e4, 3)} cm²`,
                          hasil: fmt(r.Q * 1000, 3),
                          satuan: "l/s",
                          tint: C.water,
                        },
                        {
                          judul: x.rJangkau,
                          rumus: <span>R = V · √( 2 z₀ / g )</span>,
                          isi: `${fmt(r.V, 4)} · √( 2 · ${fmt(z0, 2)} / ${fmt(G, 2)} )`,
                          hasil: fmt(jangkau, 3),
                          satuan: "m",
                        },
                      ]
                }
              />
            </div>
          </Block>

          {takRendam ? (
            <StateCard
              tone="invalid"
              badge={x.takRendam}
              state={
                lang === "id"
                  ? `Bukaan tidak terendam: H ${fmt(H, 2)} m < a/2 ${fmt(r.minHead, 3)} m.`
                  : `Opening not submerged: H ${fmt(H, 2)} m < a/2 ${fmt(r.minHead, 3)} m.`
              }
              notice={[`${x.takRendamNote} ${fmt(r.minHead, 3)} m.`]}
            />
          ) : (
            <StateCard
              tone="water"
              badge={dekatTeori ? x.teori : x.rendam}
              state={
                lang === "id"
                  ? `Cd = ${fmt(r.Cd, 3)}: kontraksi mengambil ${fmt(susut, 1)} % luas, gesekan ${fmt(lambat, 1)} % laju.`
                  : `Cd = ${fmt(r.Cd, 3)}: contraction takes ${fmt(susut, 1)} % of the area, friction ${fmt(lambat, 1)} % of the speed.`
              }
              notice={butir(susut, lambat, H, Cv, lang)}
            />
          )}
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

/*
 * Butir yang perlu diperhatikan. Kalimat perbandingan dibangun dari angka
 * lembar, bukan dipatok: pada Cv 0,900 dan Cc 0,950 gesekan mengambil lebih
 * banyak daripada kontraksi, dan kalimat lama ("gesekan hanya mengambil …")
 * menjadi salah. Klaim lintasan dan klaim Cc dipisah karena
 * orificeTrajectory hanya bergantung V: lintasan berimpit cukup dengan
 * Cv = 1, sedangkan Cc 0,611 hanya membuat Cd sama dengan nilai teoretis.
 */
function butir(susut: number, lambat: number, H: number, Cv: number, lang: Lang): string[] {
  const cc = fmt(ORIFICE_CC_SLOT, 3);
  const berimpit = Math.abs(Cv - 1) < 1e-9;
  if (lang === "en")
    return [
      lambat >= susut
        ? "Here friction takes more than contraction, the reverse of a sharp-edged orifice (Cc ≈ 0.62, Cv ≈ 0.98)."
        : `Contraction takes ${fmt(susut, 1)} per cent of the area, while friction takes only ${fmt(lambat, 1)} per cent of the speed: almost everything that separates the ideal discharge from the real one is geometry, not friction.`,
      berimpit
        ? `With Cv at one the real jet path falls on the phantom loss-free path, x² = 4Hy with H at ${fmt(H, 2)} m. Cc does not move the path, it only narrows the jet.`
        : "The real path falls on the phantom loss-free path x² = 4Hy only when Cv is one. Cc does not move the path, it only narrows the jet.",
      `Cc = ${cc} (π/(π + 2)) is the exact two-dimensional slot solution; with Cv at one it makes Cd equal that theoretical value.`,
    ];
  return [
    lambat >= susut
      ? "Di sini gesekan mengambil lebih banyak daripada kontraksi, kebalikan dari lubang berbibir tajam (Cc ≈ 0,62, Cv ≈ 0,98)."
      : `Kontraksi mengambil ${fmt(susut, 1)} persen dari luasnya, sedangkan gesekan hanya ${fmt(lambat, 1)} persen dari lajunya: hampir seluruh yang memisahkan debit ideal dari debit nyata adalah geometri, bukan gesekan.`,
    berimpit
      ? `Dengan Cv sama dengan satu, lintasan sesungguhnya berimpit dengan garis khayal tanpa kehilangan, x² = 4Hy dengan H sebesar ${fmt(H, 2)} m. Cc tidak menggeser lintasan, hanya menyempitkan pancaran.`
      : "Lintasan sesungguhnya berimpit dengan garis khayal x² = 4Hy hanya bila Cv sama dengan satu. Cc tidak menggeser lintasan, hanya menyempitkan pancaran.",
    `Cc = ${cc} (π/(π + 2)) adalah penyelesaian tepat celah dua dimensi; bersama Cv satu, nilai itu membuat Cd sama dengan nilai teoretisnya.`,
  ];
}
