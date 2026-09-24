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
import {
  drawStructure,
  type StructureBody,
  type StructureCallout,
  type StructureDim,
  type StructureLine,
} from "@/lib/drawStructure";
import {
  CASAGRANDE_ENTRY,
  fmt,
  fmtPlain,
  fmtSci,
  seepageLine,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksSeepage } from "@/lib/checks";

const CREST = 6;

const TXT = {
  id: {
    title: "Rembesan",
    sheetTitle: "Garis freatik pada bendungan urugan — parabola Kozeny",
    dH: "Kedalaman air hulu",
    dHd: "Tinggi bendungan",
    dMu: "Kemiringan lereng hulu",
    dMd: "Kemiringan lereng hilir",
    dLd: "Panjang drainase kaki",
    dK: "Permeabilitas rata-rata ukur",
    dAniso: "Perbandingan permeabilitas mendatar terhadap tegak",
    pCukup: "Drainase memadai",
    pTanpa: "Tanpa drainase kaki",
    pAniso: "Tanah berlapis, mendatar sembilan kali",
    rY0: "Setengah parameter parabola",
    rQ: "Rembesan tiap meter panjang",
    rQday: "Rembesan tiap meter panjang",
    rNeeded: "Panjang drainase terpendek yang menahan",
    rIMean: "Gradien rata-rata sepanjang badan",
    rICrit: "Gradien kritis butirannya",
    rD: "Jarak masuk terkoreksi ke fokus",
    aman: "Garis freatik tertahan di dalam badan",
    limpas: "Muka air hulu melampaui puncak bendungan",
    limpasNote:
      "Kedalaman air hulu yang dipilih sudah melewati tinggi bendungannya sendiri, jadi airnya melimpas di atas mercu. Bendungan urugan tidak boleh dilimpasi sama sekali: berbeda dengan bendungan beton yang mercunya memang dirancang basah, urugan tanah tergerus dari sisi hilir begitu air mengalir di atasnya, dan keruntuhannya berlangsung dalam hitungan jam. Itu sebabnya setiap bendungan urugan punya pelimpah terpisah yang kapasitasnya ditentukan banjir rancangan, bukan dibiarkan melimpas lewat mercunya. Garis freatik di bawah ini karena itu dihitung pada muka air setinggi mercu, bukan pada muka air yang dipilih, dan angkanya tidak lagi menyatakan keadaan yang sedang dipilih penggesernya.",
    keluar: "Garis freatik keluar di lereng hilir",
    keluarNote:
      "Garis freatik memotong lereng hilir, dan yang terjadi di situ bukan rembesan yang menetes melainkan lereng yang jenuh sampai ke permukaannya. Tanah jenuh di permukaan lereng kehilangan hampir seluruh tegangan efektifnya, longsor dangkal mulai dari kaki, dan setiap longsoran memperpendek lereng yang tersisa sehingga longsoran berikutnya lebih mudah. Itu sebabnya bendungan urugan hampir tidak pernah dibangun tanpa drainase kaki, dan sebabnya bukan untuk mengurangi rembesan melainkan untuk memindahkan tempat keluarnya.",
    note:
      "Dua hal pada lembar ini yang paling berlawanan dengan dugaan awal. Pertama, drainase kaki yang lebih panjang menaikkan rembesan, bukan menurunkannya. Drainase memindahkan titik keluar air ke arah hulu, lintasan rembesannya karena itu memendek, gradiennya naik, dan debitnya ikut naik. Yang dibeli dengan drainase bukan air yang lebih sedikit melainkan tempat keluar yang terkendali, di dalam lapisan batu bergradasi yang memang dirancang menahan butiran. Membaca drainase sebagai alat pengurang rembesan akan membuat orang merancangnya terlalu pendek dan justru mendapatkan keduanya: rembesan yang hampir sama banyaknya, keluar di tempat yang salah. Kedua, tanah yang permeabilitas mendatarnya lebih besar daripada yang tegak merembeskan LEBIH BANYAK air daripada tanah seragam yang permeabilitas rata-rata ukurnya sama. Bendungan urugan dipadatkan lapis demi lapis, dan pemadatan lapis demi lapis selalu menghasilkan tanah yang mendatarnya lebih lolos. Jadi arah yang dihasilkan cara membangunnya sendiri adalah arah yang merugikan, dan itu sebabnya pengujian permeabilitas di lapangan menuntut arah pengukurannya dicatat.",
  },
  en: {
    title: "Seepage",
    sheetTitle: "The phreatic line in an embankment dam — the Kozeny parabola",
    dH: "Upstream water depth",
    dHd: "Dam height",
    dMu: "Upstream slope",
    dMd: "Downstream slope",
    dLd: "Toe drain length",
    dK: "Geometric mean permeability",
    dAniso: "Horizontal over vertical permeability",
    pCukup: "Adequate drain",
    pTanpa: "No toe drain",
    pAniso: "Layered soil, nine times horizontal",
    rY0: "Half the parabola parameter",
    rQ: "Seepage per metre of dam",
    rQday: "Seepage per metre of dam",
    rNeeded: "Shortest drain that holds the line in",
    rIMean: "Mean gradient across the body",
    rICrit: "Critical gradient of the grain",
    rD: "Corrected entry to focus distance",
    aman: "The phreatic line stays inside the body",
    limpas: "The headwater is above the dam crest",
    limpasNote:
      "The chosen headwater depth has passed the height of the dam itself, so water spills over the crest. An embankment dam must never be overtopped: unlike a concrete dam, whose crest is designed to run wet, an earth embankment erodes from its downstream face as soon as water flows across it, and its failure takes hours. That is why every embankment has a separate spillway sized by the design flood rather than being allowed to spill over its crest. The phreatic line below is therefore computed at a water level equal to the crest, not at the level chosen, and its figures no longer describe the state the sliders are set to.",
    keluar: "The phreatic line daylights on the downstream slope",
    keluarNote:
      "The phreatic line cuts the downstream slope, and what happens there is not a trickle of seepage but a slope saturated right to its face. Saturated soil at a slope face loses almost all its effective stress, shallow slides start at the toe, and every slide shortens the remaining slope so the next one comes easier. That is why embankment dams are almost never built without a toe drain, and the reason is not to reduce the seepage but to move where it comes out.",
    note:
      "Two things on this sheet run hardest against first instinct. First, a longer toe drain raises the seepage rather than lowering it. The drain moves the exit point upstream, the seepage path therefore shortens, the gradient rises, and the discharge rises with it. What a drain buys is not less water but a controlled place for it to leave, inside a graded rock layer designed to hold soil particles back. Reading the drain as a device for reducing seepage leads to designing it too short, and then getting both: nearly the same quantity of water, coming out in the wrong place. Second, soil more permeable horizontally than vertically seeps MORE than uniform soil of the same geometric mean permeability. Embankment dams are compacted layer by layer, and layer by layer compaction always produces soil that is more permeable horizontally. So the direction produced by the method of construction itself is the unfavourable one, and that is why field permeability testing demands that the direction of measurement be recorded.",
  },
} as const;

const REFS = {
  id: [
    "Casagrande, A. (1937). Seepage through dams. J. New England Water Works Assoc. 51(2).",
    "Cedergren, H.R. (1989). Seepage, Drainage and Flow Nets, edisi ke-3. Wiley.",
    "USBR (1987). Design of Small Dams, edisi ke-3, bab 6.",
    "Kozeny, J. (1931). Grundwasserbewegung bei freiem Spiegel. Wasserkraft und Wasserwirtschaft 26.",
  ],
  en: [
    "Casagrande, A. (1937). Seepage through dams. J. New England Water Works Assoc. 51(2).",
    "Cedergren, H.R. (1989). Seepage, Drainage and Flow Nets, 3rd ed. Wiley.",
    "USBR (1987). Design of Small Dams, 3rd ed., ch. 6.",
    "Kozeny, J. (1931). Grundwasserbewegung bei freiem Spiegel. Wasserkraft und Wasserwirtschaft 26.",
  ],
} as const;

export function RembesanClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [H, setH] = useState(8);
  const [Hd, setHd] = useState(12);
  const [mUp, setMUp] = useState(3);
  const [mDown, setMDown] = useState(2.5);
  const [Ld, setLd] = useState(10);
  const [kMikro, setKMikro] = useState(1);
  const [aniso, setAniso] = useState(1);

  const kEq = kMikro * 1e-6;
  const kh = kEq * Math.sqrt(aniso);
  const kv = kEq / Math.sqrt(aniso);

  /*
   * Muka air hulu dipotong di puncak bendungan sebelum dihitung, karena
   * parabola Kozeny tidak punya arti pada bendungan yang dilimpasi.
   *
   * Pemotongan itu sendiri benar. Yang salah sebelumnya, pemotongannya
   * dilakukan DIAM-DIAM: penggeser menunjukkan dua puluh meter sementara
   * seluruh lembar menjawab dua belas meter, tanpa satu pun tanda bahwa
   * keduanya berbeda. Sekarang keadaan itu dinyatakan.
   */
  const limpas = H > Hd;
  const r = seepageLine(Math.min(H, Hd), Hd, CREST, mUp, mDown, Ld, kh, kv);
  const g = r.geometry;

  const ref = useCanvas(
    (ctx, w, ch) => {
      const pinggir = Math.max(g.toeDown * 0.12, 6);

      const badan: StructureBody[] = [
        { pts: g.body, hatch: "soil" },
      ];
      if (Ld > 0)
        badan.push({
          pts: [
            { x: r.focus, z: 0 },
            { x: g.toeDown, z: 0 },
            { x: g.toeDown, z: Math.min(Ld / mDown, Hd * 0.25) },
          ],
          hatch: "rock",
        });

      /* Zona jenuh di dalam badan: di bawah garis freatik */
      const jenuh = {
        surface: r.phreatic,
        bed: [
          { x: r.phreatic[r.phreatic.length - 1].x, z: 0 },
          { x: r.phreatic[0].x, z: 0 },
        ],
        invalid: r.daylights,
      };

      /* Genangan hulu */
      const airHulu = {
        surface: [
          { x: -pinggir, z: Math.min(H, Hd) },
          { x: mUp * Math.min(H, Hd), z: Math.min(H, Hd) },
        ],
      };

      const masuk = mUp * Math.min(H, Hd);
      const garis: StructureLine[] = [
        {
          /* Koreksi titik masuk Casagrande, digambar terpisah karena memang
             bukan bagian parabolanya melainkan peralihan yang dibuat tangan */
          pts: [
            { x: masuk, z: Math.min(H, Hd) },
            { x: (masuk + r.phreatic[0].x) / 2, z: Math.min(H, Hd) * 0.97 },
            r.phreatic[0],
          ],
          color: C.critical,
          weight: W.thin,
          dash: DASH.hidden,
          label: `${T.seepageFace} ${fmtPlain(CASAGRANDE_ENTRY, 1)} m`,
          labelAt: 0,
          labelDy: -12,
          labelAlign: "left",
        },
      ];

      const dims: StructureDim[] = [
        {
          axis: "v",
          at: -pinggir * 0.45,
          from: 0,
          to: Math.min(H, Hd),
          text: `H ${fmtPlain(Math.min(H, Hd), 2)} m`,
          color: C.water,
        },
        {
          axis: "v",
          at: g.toeDown + pinggir * 0.5,
          from: 0,
          to: r.y0,
          text: `y₀ ${fmtPlain(r.y0, 3)} m`,
          color: C.critical,
        },
      ];
      if (Ld > 0)
        dims.push({
          axis: "h",
          at: 0,
          from: r.focus,
          to: g.toeDown,
          text: `${fmtPlain(Ld, 1)} m`,
          offset: 26,
        });

      const penunjuk: StructureCallout[] = [
        {
          x: r.phreatic[Math.floor(r.phreatic.length * 0.55)].x,
          z: r.phreatic[Math.floor(r.phreatic.length * 0.55)].z,
          dx: -6,
          dy: -26,
          text: T.phreaticLine,
          color: C.water,
        },
      ];
      if (Ld > 0)
        penunjuk.push({
          x: (r.focus + g.toeDown) / 2,
          z: 0.2,
          dx: 10,
          dy: -34,
          text: T.toeDrain,
        });

      drawStructure(
        ctx,
        w,
        ch,
        {
          xMin: -pinggir,
          xMax: g.toeDown + pinggir,
          zMin: 0,
          zMax: Hd * 1.22,
          bodies: badan,
          waters: [airHulu, jenuh],
          lines: garis,
          dims,
          callouts: penunjuk,
          arrows: [
            { x: r.phreatic[0].x + (r.focus - r.phreatic[0].x) * 0.45, z: r.y0 * 0.45, length: 18, rise: 4 },
          ],
          heading: limpas ? x.limpas : r.daylights ? x.keluar : undefined,
          headingColor: C.signal,
          imperviousFloor: true,
          axisX: T.axSection,
          axisZ: T.elevation,
        },
        lang
      );
    },
    [H, Hd, mUp, mDown, Ld, kMikro, aniso, lang]
  );

  return (
    <LabShell
      sheet="GW-01"
      subject={SUBJECTS.GW[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Drainase kaki yang lebih panjang{" "}
            <Term tint={C.critical}>menaikkan</Term> rembesannya, bukan
            menurunkannya. Yang dibelinya bukan air yang lebih sedikit
            melainkan <Term tint={C.water}>tempat keluar yang terkendali</Term>.
          </p>
        ) : (
          <p>
            A longer toe drain <Term tint={C.critical}>raises</Term> the seepage
            rather than lowering it. What it buys is not less water but{" "}
            <Term tint={C.water}>a controlled place for it to leave</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="GW-01"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m/s)" },
            { label: "H", value: `${fmt(Math.min(H, Hd), 2)} m`, tint: C.water },
            { label: "y₀", value: `${fmt(r.y0, 3)} m`, tint: C.critical },
            { label: "q", value: `${fmtSci(r.q)} m³/s·m` },
            { label: "k", value: `${fmtSci(r.kEq)} m/s` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="H" label={x.dH} value={H} min={1} max={20} step={0.5} digits={1} unit="m" onChange={setH} tint={C.water} />
              <InputRow symbol="Hd" label={x.dHd} value={Hd} min={4} max={24} step={0.5} digits={1} unit="m" onChange={setHd} />
              <InputRow symbol="mu" label={x.dMu} value={mUp} min={1.5} max={5} step={0.25} digits={2} onChange={setMUp} />
              <InputRow symbol="md" label={x.dMd} value={mDown} min={1.5} max={4} step={0.25} digits={2} onChange={setMDown} />
              <InputRow symbol="Ld" label={x.dLd} value={Ld} min={0} max={30} step={0.5} digits={1} unit="m" onChange={setLd} tint={C.critical} />
              <InputRow symbol="k" label={x.dK} value={kMikro} min={0.05} max={20} step={0.05} digits={2} unit="µm/s" onChange={setKMikro} />
              <InputRow symbol="kh/kv" label={x.dAniso} value={aniso} min={1} max={25} step={0.5} digits={1} onChange={setAniso} tint={C.critical} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pCukup, apply: () => { setH(8); setHd(12); setMUp(3); setMDown(2.5); setLd(10); setKMikro(1); setAniso(1); } },
                  { label: x.pTanpa, apply: () => { setH(8); setHd(12); setMUp(3); setMDown(2.5); setLd(0); setKMikro(1); setAniso(1); } },
                  { label: x.pAniso, apply: () => { setH(8); setHd(12); setMUp(3); setMDown(2.5); setLd(10); setKMikro(1); setAniso(9); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={r.daylights ? undefined : C.water} alert={r.daylights}>
                {r.daylights ? x.keluar : x.aman}
              </Flag>
              {limpas && <Flag alert>{x.limpas}</Flag>}
            </div>
            {limpas && (
              <div className="mb-2.5">
                <Note>{x.limpasNote}</Note>
              </div>
            )}
            {r.daylights && (
              <div className="mb-2.5">
                <Note>{x.keluarNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "y₀", label: x.rY0, value: fmt(r.y0, 4), unit: "m", tint: C.critical, strong: true },
                { symbol: "q", label: x.rQ, value: fmtSci(r.q), unit: "m³/s per m", strong: true },
                { symbol: "q", label: x.rQday, value: fmt(r.qLitreDay, 0), unit: "l/d per m" },
                { symbol: "Ld", label: x.rNeeded, value: fmt(r.drainNeeded, 2), unit: "m", tint: Ld < r.drainNeeded ? C.signal : undefined },
                { symbol: "d", label: x.rD, value: fmt(r.d, 2), unit: "m" },
                { symbol: "ī", label: x.rIMean, value: fmt(r.iMean, 4) },
                { symbol: "ic", label: x.rICrit, value: fmt(r.iCritical, 3) },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(H, Hd, mUp, mDown, Ld, kEq, aniso, lang)}</Note>
          </Block>
        </>
      }
      verification={
        <Verification
          checks={checksSeepage(Math.min(H, Hd), Hd, CREST, mUp, mDown, Ld, kh, kv)}
        />
      }
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>z² = y₀² + 2 y₀ x</span>
                <span className="ml-5">y₀ = √(d² + H²) − d</span>
                <span className="ml-5">q = k y₀</span>
              </Eq>
              <Eq>
                <span>x′ = x</span>
                <Frac num="√kv" den="√kh" />
                <span className="ml-5">k = √(kh kv)</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? `titik masuk dimundurkan ${fmtPlain(CASAGRANDE_ENTRY, 1)} kali proyeksi mendatar lereng hulu yang terendam`
                    : `the entry point is moved back ${fmtPlain(CASAGRANDE_ENTRY, 1)} times the horizontal projection of the submerged upstream slope`}
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
  H: number,
  Hd: number,
  mUp: number,
  mDown: number,
  Ld: number,
  kEq: number,
  aniso: number,
  lang: Lang
): string {
  const Hp = Math.min(H, Hd);
  const r = seepageLine(Hp, Hd, CREST, mUp, mDown, Ld, kEq * Math.sqrt(aniso), kEq / Math.sqrt(aniso));
  const panjang = seepageLine(
    Hp, Hd, CREST, mUp, mDown, Math.min(Ld + 6, mDown * Hd), kEq * Math.sqrt(aniso), kEq / Math.sqrt(aniso)
  );
  const seragam = seepageLine(Hp, Hd, CREST, mUp, mDown, Ld, kEq, kEq);
  const naik = r.q > 0 ? (panjang.q / r.q - 1) * 100 : 0;
  const naikAniso = seragam.q > 0 ? (r.q / seragam.q - 1) * 100 : 0;

  if (lang === "en")
    return `Seepage now runs at ${fmt(r.qLitreDay, 0)} litres a day for every metre of dam length. Lengthen the drain by six metres and it rises ${fmt(naik, 1)} per cent, to ${fmt(panjang.qLitreDay, 0)} litres: the drain shortened the seepage path, so the gradient rose. What the drain bought is on the drawing rather than in the table, namely that the line stays inside the body. Now raise the permeability ratio. At a ratio of ${fmt(aniso, 1)} the same geometric mean permeability passes ${fmt(naikAniso, 1)} per cent more water than uniform soil would, because the transformed section is shorter and its gradient higher.`;
  return `Rembesannya sekarang ${fmt(r.qLitreDay, 0)} liter sehari untuk tiap meter panjang bendungan. Panjangkan drainasenya enam meter dan angkanya naik ${fmt(naik, 1)} persen, menjadi ${fmt(panjang.qLitreDay, 0)} liter: drainase memendekkan lintasan rembesannya, jadi gradiennya naik. Yang dibeli drainase itu ada di gambarnya, bukan di tabelnya, yaitu garis freatik yang tetap tertahan di dalam badan. Sekarang naikkan perbandingan permeabilitasnya. Pada perbandingan ${fmt(aniso, 1)}, permeabilitas rata-rata ukur yang sama meloloskan ${fmt(naikAniso, 1)} persen lebih banyak air daripada tanah seragam, karena penampang terubahnya lebih pendek dan gradiennya lebih tinggi.`;
}
