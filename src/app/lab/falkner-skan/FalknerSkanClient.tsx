"use client";

import { useState } from "react";
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
import { useCanvas } from "@/lib/useCanvas";
import { drawField, type FieldLine, type FieldMarker } from "@/lib/drawField";
import {
  FALKNER_SKAN_SEPARATION,
  falknerSkan,
  fmt,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";

/* Pita β: ambang terlepas dan Blasius diberi pita sempit ±0,001 (setengah
   langkah penggeser 0,002). Pita pertama di luar penggeser, hanya
   menunjukkan bahwa di bawah ambang tidak ada penyelesaian menempel. */
const SEP = FALKNER_SKAN_SEPARATION;
const PITA = 0.001;
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksFalknerSkan } from "@/lib/checks";

const TXT = {
  id: {
    title: "Silinder Falkner–Skan",
    sheetTitle: "Profil kecepatan lapisan batas pada gradien tekanan yang dipilih",
    dB: "Parameter gradien tekanan",
    pBlasius: "Pelat datar, tanpa gradien sama sekali",
    pMenguntungkan: "Gradien menguntungkan, aliran dipercepat",
    pMerugikan: "Gradien merugikan, aliran diperlambat",
    pLepas: "Tepat pada ambang terlepasnya",
    rSlope: "Kemiringan profil di dinding",
    rTepi: "Tebal lapisan batas, yaitu η saat u mencapai 0,99 U",
    rDesak: "Tebal desakan",
    rMomen: "Tebal momentum",
    rBentuk: "Faktor bentuk",
    rBaji: "Sudut baji setara",
    untung: "Gradien menguntungkan, alirannya dipercepat",
    rugi: "Gradien merugikan, alirannya diperlambat",
    datar: "Tanpa gradien, lapisan batas pelat datar Blasius",
    lepas: "Tepat di ambang terlepas, tegangan geser dinding nol",
    bTiada: "Tidak ada penyelesaian menempel",
    bAmbang: "Ambang terlepas, f″(0) = 0",
    bRugi: "Gradien merugikan",
    bBlasius: "Blasius",
    bUntung: "Menguntungkan, baji sampai 180°",
    bAtas: "Menguntungkan, di atas titik henti",
    hSlope: "Persamaan Falkner–Skan, ditembak dari dinding",
    hTepi: "Tebal lapisan batas",
    hTebal: "Tebal desakan dan tebal momentum (integral numerik profil)",
    hH: "Faktor bentuk",
    hBaji: "Sudut baji setara",
    hBajiTak: "Sudut baji setara: tidak ada baji untuk β di atas 1",
    sempit: "Rentang gradien merugikan sangat sempit: dari 0 sampai −0,19884 saja, sedangkan sisi menguntungkan membentang sampai 2 dan lebih jauh. Lapisan batas menerima percepatan hampir berapa pun dan perlambatan hampir tidak sama sekali.",
    lepasNote:
      "Kemiringan profil di dinding tepat nol: lapisan batasnya berada tepat di ambang terlepas. Tegangan geser di dinding habis, dan sedikit lebih jauh ke hilir aliran di dekat dinding akan berbalik arah. Penyelesaian ini sendiri masih sah, yaitu profil pemisahan Hartree yang tepat. Yang perlu dilihat pada gambarnya bukan angkanya melainkan bentuknya, yaitu profil yang menempel tegak lurus pada dindingnya. Sesudah titik ini lapisan batas tidak lagi dapat dihitung dengan persamaan yang sama, karena persamaannya sendiri menganggap alirannya hanya berjalan ke satu arah. Seluruh rekayasa bentuk benda yang dialiri, dari sayap pesawat sampai pilar jembatan, adalah usaha menunda titik ini sejauh mungkin ke belakang.",
    note:
      "Persamaan Falkner–Skan memberikan satu hal yang jarang diberikan mekanika fluida: satu keluarga penyelesaian tepat, bukan hampiran, untuk lapisan batas pada gradien tekanan yang berubah-ubah. Satu bilangan mengatur seluruhnya. Pada nol, ia menjadi penyelesaian Blasius untuk pelat datar, dan kemiringan dindingnya nol koma empat enam sembilan enam, yaitu angka yang muncul di seluruh rumus gesekan pelat datar yang pernah dipakai. Menaikkannya berarti mempercepat aliran luarnya, dan profilnya menjadi lebih penuh: kemiringan dindingnya naik, faktor bentuknya turun, dan lapisan batasnya semakin sulit terlepas. Menurunkannya berarti memperlambat aliran luarnya, dan yang terjadi kebalikannya sampai pada nilai minus nol koma satu sembilan delapan delapan empat, tempat kemiringan dindingnya mencapai nol dan lapisan batasnya terlepas. Yang pantas diperhatikan adalah betapa sempitnya rentang itu. Seluruh gradien merugikan yang dapat ditanggung lapisan batas laminar hanya sepersepuluh gradien menguntungkan yang lazim, dan itulah sebabnya benda bergaris ramping dibuat dengan bagian belakang yang panjang dan landai sementara bagian depannya boleh tumpul. Bukan bagian depan yang menentukan seretannya, melainkan seberapa lambat bagian belakangnya berani memperlambat alirannya.",
  },
  en: {
    title: "Falkner–Skan cylinder",
    sheetTitle: "Boundary-layer velocity profile at the chosen pressure gradient",
    dB: "Pressure-gradient parameter",
    pBlasius: "Flat plate, no gradient at all",
    pMenguntungkan: "Favourable gradient, the flow accelerates",
    pMerugikan: "Adverse gradient, the flow decelerates",
    pLepas: "Exactly at the separation threshold",
    rSlope: "Slope of the profile at the wall",
    rTepi: "Boundary-layer thickness, the η at which u reaches 0.99 U",
    rDesak: "Displacement thickness",
    rMomen: "Momentum thickness",
    rBentuk: "Shape factor",
    rBaji: "Equivalent wedge angle",
    untung: "Favourable gradient, the flow accelerates",
    rugi: "Adverse gradient, the flow decelerates",
    datar: "No gradient, the Blasius flat-plate layer",
    lepas: "Exactly at incipient separation, zero wall shear",
    bTiada: "No attached solution",
    bAmbang: "Separation threshold, f″(0) = 0",
    bRugi: "Adverse gradient",
    bBlasius: "Blasius",
    bUntung: "Favourable, wedge up to 180°",
    bAtas: "Favourable, beyond the stagnation point",
    hSlope: "Falkner–Skan equation, shot from the wall",
    hTepi: "Boundary-layer thickness",
    hTebal: "Displacement and momentum thickness (numerical integral of the profile)",
    hH: "Shape factor",
    hBaji: "Equivalent wedge angle",
    hBajiTak: "Equivalent wedge angle: no wedge for β above 1",
    sempit: "The adverse range is very narrow: from 0 down to −0.19884 only, while the favourable side runs to 2 and beyond. A boundary layer will take almost any acceleration and almost no deceleration.",
    lepasNote:
      "The slope of the profile at the wall is exactly zero: the boundary layer is exactly at incipient separation. The wall shear stress is gone, and a little farther downstream the flow near the wall will reverse. The solution itself is still valid, it is Hartree's exact separation profile. What to look at in the drawing is not the number but the shape, a profile standing perpendicular to its own wall. Past this point the boundary layer can no longer be computed with the same equations, because those equations assume the flow goes one way only. The whole engineering of shapes in a flow, from an aircraft wing to a bridge pier, is an effort to push this point as far back as possible.",
    note:
      "The Falkner–Skan equation gives something fluid mechanics rarely gives: a family of exact solutions, not approximations, for a boundary layer under a varying pressure gradient. One number governs it all. At zero it becomes the Blasius solution for a flat plate, and its wall slope is 0.4696, the number appearing in every flat-plate friction formula ever used. Raising it accelerates the outer flow and the profile becomes fuller: the wall slope rises, the shape factor falls, and the boundary layer becomes harder to separate. Lowering it decelerates the outer flow, and the opposite happens, down to −0.19884, where the wall slope reaches zero and the layer separates. What deserves attention is how narrow that range is. The whole adverse gradient a laminar boundary layer can bear is a tenth of an ordinary favourable one, and that is why streamlined bodies are built with a long, gentle rear while their front may be blunt. It is not the front that sets the drag but how slowly the rear dares to decelerate the flow.",
  },
} as const;

const REFS = {
  id: [
    "Falkner, V.M. & Skan, S.W. (1931). Some approximate solutions of the boundary layer equations. Phil. Mag. 12, 865–896.",
    "Blasius, H. (1908). Grenzschichten in Flüssigkeiten mit kleiner Reibung. Z. Math. Phys. 56, 1–37.",
    "Hartree, D.R. (1937). On an equation occurring in Falkner and Skan's approximate treatment. Proc. Camb. Phil. Soc. 33, 223–239.",
    "Schlichting, H. (1979). Boundary-Layer Theory, edisi ke-7, bab 9, tabel 9.1.",
  ],
  en: [
    "Falkner, V.M. & Skan, S.W. (1931). Some approximate solutions of the boundary layer equations. Phil. Mag. 12, 865–896.",
    "Blasius, H. (1908). Grenzschichten in Flüssigkeiten mit kleiner Reibung. Z. Math. Phys. 56, 1–37.",
    "Hartree, D.R. (1937). On an equation occurring in Falkner and Skan's approximate treatment. Proc. Camb. Phil. Soc. 33, 223–239.",
    "Schlichting, H. (1979). Boundary-Layer Theory, 7th ed., ch. 9, table 9.1.",
  ],
} as const;

export function FalknerSkanClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [beta, setBeta] = useState(0);

  const r = falknerSkan(beta);
  /*
   * Pelat datar punya keadaannya sendiri. Sebelumnya β = 0 tepat, yaitu
   * tombol pelat datar, jatuh ke "gradien merugikan" karena yang diperiksa
   * hanya β > 0. Ambangnya setengah langkah penggeser, karena langkahnya
   * berpangkal di ambang terlepas dan titik terdekatnya ke nol −0,00084.
   */
  const datar = Math.abs(beta) < 0.001;
  const keadaan = r.separated
    ? x.lepas
    : datar
      ? x.datar
      : r.favourable
        ? x.untung
        : x.rugi;
  const warnaKeadaan = r.separated
    ? C.critical
    : datar
      ? C.ink2
      : r.favourable
        ? C.water
        : C.caution;
  const nada: Tone = r.separated
    ? "critical"
    : datar
      ? "neutral"
      : r.favourable
        ? beta <= 1
          ? "water"
          : "neutral"
        : "caution";
  const blasius = falknerSkan(0);

  const ref = useCanvas(
    (ctx, w, ch) => {
      const garis: FieldLine[] = [
        {
          /* Blasius sebagai pembanding tetap, supaya perubahannya terlihat
             terhadap sesuatu dan bukan terhadap ingatan. */
          pts: blasius.profile.map((p) => ({ x: p.u, y: p.eta })),
          color: C.ink3,
          weight: W.hair,
          dash: DASH.hidden,
          label: "β = 0",
          labelAt: 0.62,
          labelDy: -9,
          labelAlign: "right",
        },
        {
          pts: r.profile.map((p) => ({ x: p.u, y: p.eta })),
          color: r.separated ? C.critical : r.favourable ? C.water : C.caution,
          weight: W.bold,
          dash: DASH.solid,
          label: `β = ${fmt(beta, 3)}`,
          labelAt: 0.5,
          labelDy: 16,
          labelAlign: "left",
        },
        {
          /* Dinding, yaitu η nol. */
          pts: [
            { x: 0, y: 0 },
            { x: 1.15, y: 0 },
          ],
          color: C.ink,
          weight: W.bold,
          dash: DASH.solid,
          label: T.wallLabel,
          labelAt: 0.9,
          labelDy: 14,
          labelAlign: "right",
        },
        {
          /* Tepi lapisan batas pada lembar ini. */
          pts: [
            { x: 0, y: r.edge },
            { x: 1.15, y: r.edge },
          ],
          color: C.ink3,
          weight: W.hair,
          dash: DASH.axis,
          label: T.boundaryLayerEdge,
          labelAt: 0.06,
          labelDy: -9,
          labelAlign: "left",
        },
      ];

      const titik: FieldMarker[] = [
        { x: 0, y: 0, color: r.separated ? C.critical : C.energy, size: 5, filled: true },
      ];

      drawField(
        ctx,
        w,
        ch,
        {
          xMin: -0.06,
          xMax: 1.18,
          yMin: 0,
          yMax: Math.max(r.edge, blasius.edge) * 1.25,
          equalScale: false,
          lines: garis,
          markers: titik,
          heading: keadaan,
          headingColor: warnaKeadaan,
          axisX: T.axVelocityRatio,
          axisY: T.axEta,
        },
        lang
      );
    },
    [beta, lang]
  );

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="β"
          value={beta}
          digits={3}
          bands={[
            { from: -0.2, to: SEP - 1e-6, label: x.bTiada, tone: "invalid" },
            { from: SEP - 1e-6, to: SEP + PITA, label: x.bAmbang, tone: "critical" },
            { from: SEP + PITA, to: -PITA, label: x.bRugi, tone: "caution" },
            { from: -PITA, to: PITA, label: x.bBlasius, tone: "neutral" },
            { from: PITA, to: 1, label: x.bUntung, tone: "water" },
            { from: 1, to: 2, label: x.bAtas, tone: "neutral" },
          ]}
        />
      }
      sheet="FP-05"
      subject={SUBJECTS.FP[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Satu bilangan mengatur seluruh keluarga penyelesaiannya. Di nol ia
            menjadi <Term tint={C.water}>Blasius</Term>; di{" "}
            <Term tint={C.critical}>minus nol koma satu sembilan sembilan</Term>{" "}
            lapisan batasnya terlepas.
          </p>
        ) : (
          <p>
            One number governs the whole family of solutions. At zero it becomes{" "}
            <Term tint={C.water}>Blasius</Term>; at{" "}
            <Term tint={C.critical}>−0.199</Term> the boundary layer separates.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FP-05"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: lang === "id" ? "tanpa dimensi" : "dimensionless" },
            {
              label: "f″(0)",
              value: fmt(r.wallSlope, 4),
              tint: r.separated ? C.critical : C.energy,
            },
            { label: "H", value: fmt(r.shapeFactor, 3), tint: C.critical },
            { label: "δ*", value: fmt(r.displacement, 3) },
            { label: "θ", value: fmt(r.momentum, 3) },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="β" label={x.dB} value={beta} min={FALKNER_SKAN_SEPARATION} max={2} step={0.002} digits={3} onChange={setBeta} tint={C.critical} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pBlasius, apply: () => setBeta(0) },
                  { label: x.pMenguntungkan, apply: () => setBeta(1) },
                  { label: x.pMerugikan, apply: () => setBeta(-0.14) },
                  { label: x.pLepas, apply: () => setBeta(FALKNER_SKAN_SEPARATION) },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "f″(0)", label: x.rSlope, value: fmt(r.wallSlope, 5), tint: r.separated ? C.critical : C.energy, strong: true },
                { symbol: "H", label: x.rBentuk, value: fmt(r.shapeFactor, 4), tint: C.critical, strong: true },
                { symbol: "η₉₉", label: x.rTepi, value: fmt(r.edge, 3) },
                { symbol: "δ*", label: x.rDesak, value: fmt(r.displacement, 4) },
                { symbol: "θ", label: x.rMomen, value: fmt(r.momentum, 4) },
                /* Di atas β = 1 (titik stagnasi, baji 180°) tidak ada baji yang
                   sesuai; 360° pada β = 2 bukan sudut benda apa pun. */
                { symbol: "α", label: x.rBaji, value: beta <= 1 ? fmt(r.wedgeAngle, 1) : "—", unit: beta <= 1 ? "°" : undefined },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hSlope,
                    rumus: <span>f‴ + f f″ + β ( 1 − f′² ) = 0;  f(0) = f′(0) = 0, f′(∞) = 1</span>,
                    isi: `β = ${fmt(beta, 3)}: f″(0) ${lang === "id" ? "dicari sampai" : "found such that"} f′(η → ∞) = 1`,
                    hasil: fmt(r.wallSlope, 5),
                    tint: r.separated ? C.critical : C.energy,
                  },
                  {
                    judul: x.hTepi,
                    rumus: <span>f′( η₉₉ ) = {fmt(0.99, 2)}</span>,
                    isi: `η₉₉ = ${fmt(r.edge, 3)}`,
                    hasil: fmt(r.edge, 3),
                  },
                  {
                    judul: x.hTebal,
                    rumus: <span>δ* = ∫ ( 1 − f′ ) dη,  θ = ∫ f′ ( 1 − f′ ) dη</span>,
                    isi: `δ* = ${fmt(r.displacement, 4)};  θ = ${fmt(r.momentum, 4)}`,
                    hasil: `${fmt(r.displacement, 4)}; ${fmt(r.momentum, 4)}`,
                  },
                  {
                    judul: x.hH,
                    rumus: (<><span>H =</span><Frac num="δ*" den="θ" /></>),
                    isi: `${fmt(r.displacement, 5)} / ${fmt(r.momentum, 5)}`,
                    hasil: fmt(r.shapeFactor, 4),
                    tint: C.critical,
                  },
                  {
                    judul: beta <= 1 ? x.hBaji : x.hBajiTak,
                    rumus: <span>α = 180° · β</span>,
                    isi: beta <= 1 ? `180 · ${fmt(beta, 3)}` : "—",
                    hasil: beta <= 1 ? fmt(r.wedgeAngle, 1) : "—",
                    satuan: beta <= 1 ? "°" : undefined,
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard tone={nada} badge={keadaan} {...notice(beta, lang)} />
        </>
      }
      verification={<Verification checks={checksFalknerSkan(beta)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>f‴ + f f″ + β(1 − f′²) = 0</span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "f(0) = 0, f′(0) = 0, f′(∞) = 1; diselesaikan dengan menembak dari dinding"
                    : "f(0) = 0, f′(0) = 0, f′(∞) = 1; solved by shooting from the wall"}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `β = 0 memberi Blasius, f″(0) = ${fmt(blasius.wallSlope, 4)}; terlepas di β = ${fmt(FALKNER_SKAN_SEPARATION, 5)}`
                    : `β = 0 gives Blasius, f″(0) = ${fmt(blasius.wallSlope, 4)}; separation at β = ${fmt(FALKNER_SKAN_SEPARATION, 5)}`}
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
 * keadaan, sisanya butir: pembanding Blasius dan β = 1, lalu rentang
 * merugikan yang sempit.
 */
function notice(beta: number, lang: Lang): { state: string; notice: string[] } {
  const x = TXT[lang];
  const a = falknerSkan(beta);
  const datar = falknerSkan(0);
  const cepat = falknerSkan(1);
  const lepas = falknerSkan(FALKNER_SKAN_SEPARATION);
  const isDatar = Math.abs(beta) < 0.001;
  const keadaan = a.separated ? x.lepas : isDatar ? x.datar : a.favourable ? x.untung : x.rugi;

  if (lang === "en")
    return {
      state: `β = ${fmt(beta, 3)}: ${keadaan.toLowerCase()}; f″(0) = ${fmt(a.wallSlope, 4)}, H = ${fmt(a.shapeFactor, 3)}.`,
      notice: [
        a.separated ? x.lepasNote : "",
        `The flat plate gives f″(0) = ${fmt(datar.wallSlope, 4)} and H = ${fmt(datar.shapeFactor, 3)}; a stagnation-point flow at β = 1 gives ${fmt(cepat.wallSlope, 4)} and ${fmt(cepat.shapeFactor, 3)}, a fuller profile that resists separation; and at β = ${fmt(FALKNER_SKAN_SEPARATION, 5)} the slope reaches ${fmt(lepas.wallSlope, 4)} and the shape factor climbs to ${fmt(lepas.shapeFactor, 2)}.`,
        x.sempit,
      ],
    };
  return {
    state: `β = ${fmt(beta, 3)}: ${keadaan.toLowerCase()}; f″(0) = ${fmt(a.wallSlope, 4)}, H = ${fmt(a.shapeFactor, 3)}.`,
    notice: [
      a.separated ? x.lepasNote : "",
      `Pelat datar memberi f″(0) = ${fmt(datar.wallSlope, 4)} dan H = ${fmt(datar.shapeFactor, 3)}; aliran titik henti pada β = 1 memberi ${fmt(cepat.wallSlope, 4)} dan ${fmt(cepat.shapeFactor, 3)}, yaitu profil yang lebih penuh dan lebih tahan terhadap terlepasnya; dan pada β = ${fmt(FALKNER_SKAN_SEPARATION, 5)} kemiringannya mencapai ${fmt(lepas.wallSlope, 4)} sementara faktor bentuknya naik ke ${fmt(lepas.shapeFactor, 2)}.`,
      x.sempit,
    ],
  };
}
