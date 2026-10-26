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
  SentuhContoh,
} from "@/components/ui";
import { DragLayer, type HandleSpec } from "@/components/DragLayer";
import { usePlate } from "@/lib/usePlate";
import type { ParamDef } from "@/lib/rentang";
import {
  drawStructure,
  type StructureBody,
  type StructureCallout,
  type StructureDim,
  type StructureLine,
} from "@/lib/drawStructure";
import {
  CASAGRANDE_ENTRY,
  SOIL_GS,
  SOIL_VOID_RATIO,
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

/*
 * Rentang panjang drainase kaki: satu definisi untuk penggeser, kotak angka,
 * dan pegangan seret di ujung hulu drainase (aturan 4, satu sumber nilai).
 */
const P_LD: ParamDef = { min: 0, max: 30, step: 0.5, digits: 1 };

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
    gLd: "Panjang drainase kaki Ld, seret ujung hulu drainase ke kiri atau kanan",
    rY0: "Setengah parameter parabola",
    rQ: "Rembesan tiap meter panjang",
    rQday: "Rembesan tiap meter panjang (liter)",
    rNeeded: "Panjang drainase terpendek yang menahan",
    rIMean: "Gradien rata-rata sepanjang badan",
    rICrit: "Gradien kritis butirannya",
    rD: "Jarak masuk terkoreksi ke fokus",
    aman: "Garis freatik tertahan di dalam badan",
    bKeluar: "Garis freatik keluar di lereng",
    bTahan: "Tertahan di dalam badan",
    luar: "Di luar rentang lembar",
    luarNote:
      "Drainase kaki sepanjang ini melampaui kaki lereng hilir sampai ke bawah mercu: pangkal drainasenya, yang menjadi fokus parabola Kozeny, tidak lagi berada di bawah lereng hilir. Hitungan parabola tidak punya arti di situ, jadi y₀, q, dan gradiennya ditulis “—”. Perpendek drainasenya.",
    entry: "koreksi masuk Casagrande",
    lhm: "l/hari per m",
    m3sm: "m³/s per m",
    rQs: "Rembesan tiap meter panjang (m³/s)",
    hD: "Titik masuk terkoreksi, fokus, dan jarak terubah",
    hY0: "Setengah parameter parabola",
    hQ: "Rembesan, q = k y₀",
    hI: "Gradien rata-rata dan gradien kritis",
    hLd: "Drainase terpendek, bagi dua dengan uji keluar yang sama",
    hLdIsi: "Ld dicari sampai parabola tidak memotong lereng hilir",
    takAda: "tidak ada panjang yang menahan",
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
    gLd: "Toe drain length Ld, drag the upstream end of the drain left or right",
    rY0: "Half the parabola parameter",
    rQ: "Seepage per metre of dam",
    rQday: "Seepage per metre of dam (litres)",
    rNeeded: "Shortest drain that holds the line in",
    rIMean: "Mean gradient across the body",
    rICrit: "Critical gradient of the grain",
    rD: "Corrected entry to focus distance",
    aman: "The phreatic line stays inside the body",
    bKeluar: "Line daylights on the slope",
    bTahan: "Held inside the body",
    luar: "Outside the range of this sheet",
    luarNote:
      "A toe drain this long runs past the downstream slope to beneath the crest: its upstream end, the focus of the Kozeny parabola, no longer lies under the downstream slope. The parabola has no meaning there, so y₀, q and the gradients are shown as “—”. Shorten the drain.",
    entry: "Casagrande entry correction",
    lhm: "l/day per m",
    m3sm: "m³/s per m",
    rQs: "Seepage per metre of dam (m³/s)",
    hD: "Corrected entry point, focus, and transformed distance",
    hY0: "Half the parabola parameter",
    hQ: "Seepage, q = k y₀",
    hI: "Mean gradient and critical gradient",
    hLd: "Shortest drain, bisection with the same daylight test",
    hLdIsi: "Ld is searched until the parabola no longer cuts the downstream slope",
    takAda: "no length holds it",
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
  /* r.valid salah bila drainase melampaui kaki lereng hilir (Ld ≥ md·Hd):
     fokus parabola jatuh di bawah mercu atau di hulu tumit, dan y₀, q,
     gradien tidak bermakna. Angka turunannya ditulis "—". */
  const sah = r.valid;
  const tampil = (v: number) => (sah ? v : NaN);
  const kosong = "—";
  /* Bila drainase sepanjang lereng hilir pun tidak menahan, bagi dua
     model berhenti di ujung atas; tidak ada panjang yang menahan. */
  const lerengHilir = g.toeDown - g.crestTo;
  const LdAda = sah && r.drainNeeded < lerengHilir - 1e-6;
  const rasioLd = r.drainNeeded > 0 ? Ld / r.drainNeeded : NaN;
  /* Rembesan dapat jatuh di bawah satu liter sehari; nol desimal menulis
     "0". Di bawah 1 berpangkat. */
  const fQd = (v: number) => (!Number.isFinite(v) ? kosong : v > 0 && v < 1 ? fmtSci(v) : fmt(v, 1));
  const Hp = Math.min(H, Hd);
  const masukKoreksi = mUp * Hp * (1 - CASAGRANDE_ENTRY);
  const akarKvKh = Math.sqrt(kv / kh);

  const sentuh = useRef<() => void>(() => {});

  const plate = usePlate(
    (ctx, w, ch) => {
      /*
       * Layar sempit (HP): penampang selebar tujuh puluh meter dengan skala
       * sama di kedua sumbu tinggal garis setebal empat puluh piksel. Skala
       * tegak boleh dipertinggi (faktornya ditulis di judul sumbu tegak),
       * dan pinggir kiri kanan dilebarkan supaya dimensi H dan y₀ beserta
       * angkanya tidak menempel atau terpotong bingkai.
       */
      const sempit = w < 600;
      const pinggir = Math.max(g.toeDown * (sempit ? 0.2 : 0.12), 6);
      /* Sisi kanan diberi ruang lebih: dimensi y₀ dan nama drainase kaki
         dulu menempel atau terpotong di bingkai kanan. */
      const pinggirKanan = Math.max(g.toeDown * (sempit ? 0.2 : 0.16), 8);

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
          /* Bukan "muka rembesan" (itu tempat keluar di hilir) dan 0,3
             bukan meter: ini faktor koreksi titik masuk Casagrande.
             Rata kanan, menjulur ke atas genangan hulu, supaya tidak
             bertumpuk dengan nama garis freatik. */
          label: `${x.entry} ${fmtPlain(CASAGRANDE_ENTRY, 1)} mu H`,
          labelAt: 0,
          labelDy: -12,
          labelAlign: "right",
        },
      ];
      /* Nama garis freatik ditulis sebagai label garis, bukan penunjuk:
         label garis lewat penempat label yang sama dengan label koreksi
         masuk, jadi keduanya tidak dapat bertumpuk. Garisnya sendiri
         selebar nol (satu titik), garis freatik sudah digambar sebagai
         muka zona jenuh. */
      const titikF = r.phreatic[Math.floor(r.phreatic.length * 0.4)];
      garis.push({
        pts: [titikF, titikF],
        color: C.water,
        weight: W.thin,
        dash: DASH.solid,
        label: T.phreaticLine,
        labelAt: 0,
        labelDy: -14,
      });

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
          at: g.toeDown + pinggirKanan * 0.6,
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

      const penunjuk: StructureCallout[] = [];
      /* Penunjuk ke kiri: ke kanan teksnya terpotong bingkai kanan. */
      if (Ld > 0)
        penunjuk.push({
          x: (r.focus + g.toeDown) / 2,
          z: 0.2,
          dx: -12,
          dy: -30,
          text: T.toeDrain,
        });

      return drawStructure(
        ctx,
        w,
        ch,
        {
          xMin: -pinggir,
          xMax: g.toeDown + pinggirKanan,
          zMin: 0,
          zMax: Hd * 1.3,
          bodies: badan,
          waters: [airHulu, jenuh],
          lines: garis,
          dims,
          callouts: penunjuk,
          arrows: [
            { x: r.phreatic[0].x + (r.focus - r.phreatic[0].x) * 0.45, z: r.y0 * 0.45, length: 18, rise: 4 },
          ],
          heading: !sah ? x.luar : limpas ? x.limpas : r.daylights ? x.keluar : undefined,
          headingColor: C.signal,
          imperviousFloor: true,
          maxExaggeration: sempit ? 5 : 1,
          axisX: T.axSection,
          axisZ: T.elevation,
          /* Ujung hulu drainase kaki (fokus parabola), tempat pegangan Ld.
             Tidak digambar. */
          anchors: { drainase: { x: g.toeDown - Ld, z: 0 } },
        },
        lang
      );
    },
    null,
    [H, Hd, mUp, mDown, Ld, kMikro, aniso, lang]
  );

  /*
   * Pemetaan balik: drainase membentang dari fokus x = kaki hilir − Ld
   * sampai kaki hilir (seepageLine), jadi Ld = kaki hilir − x jari. Hanya
   * mendatar; seret ke kiri (ke hulu) memperpanjang drainase.
   *
   * Tanpa kunci sumbu: batas bidang dihitung dari kaki hilir dan tinggi
   * bendungan saja, yang tidak bergantung pada Ld, jadi pegangan tidak
   * saling kejar dengan sumbunya.
   */
  const handles: HandleSpec[] = [
    {
      id: "drainase",
      anchor: "drainase",
      axis: "x",
      label: x.gLd,
      tint: C.critical,
      param: P_LD,
      value: Ld,
      toValue: (px, _py, m) => g.toeDown - m.invX(px),
      onChange: setLd,
      format: (v) => `Ld ${fmt(v, 1)} m`,
    },
  ];

  return (
    <LabShell
      status={
        !sah || limpas ? (
          <RegimeScale
            symbol="Ld/Ld,min"
            value={NaN}
            invalid
            pesan={!sah ? x.luar : x.limpas}
            digits={2}
            bands={[{ from: 0, to: 3, label: x.luar, tone: "invalid" }]}
          />
        ) : (
          /* Batas 1 dari uji keluar seepageLine dan bagi dua drainNeeded
             (uji yang sama), Casagrande 1937. Di bawah 1 parabola Kozeny
             memotong muka lereng hilir: bukan keadaan fisik, jadi pitanya
             di luar rentang berlaku. */
          <RegimeScale
            symbol="Ld/Ld,min"
            value={rasioLd}
            invalid={r.daylights}
            digits={2}
            bands={[
              { from: 0, to: 1, label: x.bKeluar, tone: "invalid" },
              { from: 1, to: 3, label: x.bTahan, tone: "pass" },
            ]}
          />
        )
      }
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
          /* Di HP bingkai setinggi 56vh menyisakan bidang kosong di atas
             penampang yang lebar dan pendek; dibatasi 80vw. Di layar lebar
             56vh tetap yang menentukan, jadi tingginya sama seperti dulu. */
          height="clamp(300px, min(56vh, 80vw), 620px)"
          cells={[
            { label: t.tbUnit, value: "SI (m, m/s)" },
            { label: "H", value: `${fmt(Math.min(H, Hd), 2)} m`, tint: C.water },
            { label: "y₀", value: sah ? `${fmt(r.y0, 3)} m` : kosong, tint: C.critical },
            { label: "q", value: sah ? `${fmtSci(r.q)} ${x.m3sm}` : kosong },
            { label: "k", value: `${fmtSci(r.kEq)} m/s` },
          ]}
        >
          <canvas ref={plate.ref} className="block h-full w-full" />
          <DragLayer out={plate.outRef.current} handles={handles} touch={() => sentuh.current()} />
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
              <InputRow symbol="Ld" label={x.dLd} value={Ld} {...P_LD} unit="m" onChange={setLd} tint={C.critical} />
              <InputRow symbol="k" label={x.dK} value={kMikro} min={0.05} max={20} step={0.05} digits={2} unit="µm/s" onChange={setKMikro} />
              <InputRow symbol="kh/kv" label={x.dAniso} value={aniso} min={1} max={25} step={0.5} digits={1} onChange={setAniso} tint={C.critical} />
            </InputTable>

            <SentuhContoh sentuh={sentuh} />
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
            <ResultTable
              rows={[
                { symbol: "q", label: x.rQday, value: fQd(tampil(r.qLitreDay)), unit: sah ? x.lhm : undefined, tint: C.water, strong: true },
                { symbol: "Ld,min", label: x.rNeeded, value: LdAda ? fmt(r.drainNeeded, 2) : kosong, unit: LdAda ? "m" : undefined, tint: C.critical, strong: true },
                { symbol: "y₀", label: x.rY0, value: fmt(tampil(r.y0), 4), unit: sah ? "m" : undefined, tint: C.critical },
                { symbol: "q", label: x.rQs, value: sah ? fmtSci(r.q) : kosong, unit: sah ? x.m3sm : undefined },
                { symbol: "d", label: x.rD, value: fmt(tampil(r.d), 2), unit: sah ? "m" : undefined },
                { symbol: "ī", label: x.rIMean, value: fmt(tampil(r.iMean), 4) },
                { symbol: "ic", label: x.rICrit, value: fmt(r.iCritical, 3) },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hD,
                    rumus: <span>x_m = (1 − 0,3) · mu · H ; f = x_kaki − Ld ; d = (f − x_m) · √(kv/kh)</span>,
                    isi: sah
                      ? `x_m = ${fmt(1 - CASAGRANDE_ENTRY, 1)} · ${fmt(mUp, 2)} · ${fmt(Hp, 1)} = ${fmt(masukKoreksi, 2)} ; f = ${fmt(g.toeDown, 1)} − ${fmt(Ld, 1)} = ${fmt(r.focus, 2)} ; d = ( ${fmt(r.focus, 2)} − ${fmt(masukKoreksi, 2)} ) · ${fmt(akarKvKh, 4)}`
                      : x.luar,
                    hasil: fmt(tampil(r.d), 2),
                    satuan: sah ? "m" : undefined,
                  },
                  {
                    judul: x.hY0,
                    rumus: <span>y₀ = √( d² + H² ) − d</span>,
                    isi: sah ? `√( ${fmt(r.d, 2)}² + ${fmt(Hp, 1)}² ) − ${fmt(r.d, 2)}` : x.luar,
                    hasil: fmt(tampil(r.y0), 4),
                    satuan: sah ? "m" : undefined,
                    tint: C.critical,
                  },
                  {
                    judul: x.hQ,
                    rumus: <span>k = √( kh · kv ) ; q = k · y₀ · 1000 · 86400</span>,
                    isi: sah ? `${fmtSci(r.kEq)} · ${fmt(r.y0, 4)} = ${fmtSci(r.q)} ${x.m3sm} ; · 1000 · 86400` : x.luar,
                    hasil: fQd(tampil(r.qLitreDay)),
                    satuan: sah ? x.lhm : undefined,
                    tint: C.water,
                  },
                  {
                    judul: x.hI,
                    rumus: (<><span>ī =</span><Frac num="H" den="d / √(kv/kh)" /><span>; ic =</span><Frac num="Gs − 1" den="1 + e" /></>),
                    isi: sah
                      ? `ī = ${fmt(Hp, 1)} / ( ${fmt(r.d, 2)} / ${fmt(akarKvKh, 4)} ) = ${fmt(r.iMean, 4)} ; ic = ( ${fmt(SOIL_GS, 2)} − 1 ) / ( 1 + ${fmt(SOIL_VOID_RATIO, 2)} )`
                      : `ic = ( ${fmt(SOIL_GS, 2)} − 1 ) / ( 1 + ${fmt(SOIL_VOID_RATIO, 2)} )`,
                    hasil: fmt(r.iCritical, 3),
                  },
                  {
                    judul: x.hLd,
                    rumus: <span>{x.hLdIsi}</span>,
                    isi: sah ? `0 ≤ Ld ≤ ${fmt(lerengHilir, 1)} m` : x.luar,
                    hasil: LdAda ? fmt(r.drainNeeded, 2) : sah ? x.takAda : kosong,
                    satuan: LdAda ? "m" : undefined,
                    tint: C.critical,
                  },
                ]}
              />
            </div>
          </Block>

          {!sah ? (
            <StateCard tone="invalid" badge={x.luar} state={x.luarNote} />
          ) : (
            <StateCard
              tone={limpas || r.daylights ? "invalid" : "pass"}
              badge={limpas ? x.limpas : r.daylights ? x.keluar : x.aman}
              {...notice(H, Hd, mUp, mDown, Ld, kEq, aniso, limpas, x.limpasNote, x.keluarNote, lang)}
            />
          )}
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

/*
 * Kalimat keadaan, lalu butir: (a) drainase lebih panjang menaikkan q,
 * hanya bila Ld + 6 masih di dalam lereng hilir; cabang tersendiri bila
 * garis freatik keluar; (b) anisotropi, hanya bila kh/kv > 1; (c) limpas.
 */
function notice(
  H: number,
  Hd: number,
  mUp: number,
  mDown: number,
  Ld: number,
  kEq: number,
  aniso: number,
  limpas: boolean,
  limpasNote: string,
  keluarNote: string,
  lang: Lang
): { state: string; notice: string[] } {
  const en = lang === "en";
  const Hp = Math.min(H, Hd);
  const kh = kEq * Math.sqrt(aniso);
  const kv = kEq / Math.sqrt(aniso);
  const r = seepageLine(Hp, Hd, CREST, mUp, mDown, Ld, kh, kv);
  const lereng = r.geometry.toeDown - r.geometry.crestTo;
  const fq = (v: number) => (v > 0 && v < 1 ? fmtSci(v) : fmt(v, 1));
  const butir: string[] = [];

  const state = en
    ? `The phreatic line ${r.daylights ? "daylights on the downstream slope" : "is held inside the body"}; q = ${fq(r.qLitreDay)} l/day per m.`
    : `Garis freatik ${r.daylights ? "keluar di lereng hilir" : "tertahan di dalam badan"}; q = ${fq(r.qLitreDay)} l/hari per m.`;

  if (limpas) butir.push(limpasNote);

  if (r.daylights) {
    butir.push(keluarNote);
    const tahan = r.drainNeeded < lereng - 1e-6;
    butir.push(
      tahan
        ? en
          ? `A toe drain of at least ${fmt(r.drainNeeded, 2)} m would hold the line inside the body. It would raise the seepage a little, not lower it: what it buys is the place where the water leaves.`
          : `Drainase kaki sekurangnya ${fmt(r.drainNeeded, 2)} m akan menahan garis freatik di dalam badan. Rembesannya justru naik sedikit, bukan turun: yang dibeli drainase itu tempat keluarnya air.`
        : en
          ? "Even a drain running the whole length of the downstream slope does not hold the line in; flatten the downstream slope or lower the headwater."
          : "Drainase sepanjang seluruh lereng hilir pun tidak menahannya; landaikan lereng hilir atau turunkan muka air hulu."
    );
  } else if (Ld + 6 < lereng) {
    const panjang = seepageLine(Hp, Hd, CREST, mUp, mDown, Ld + 6, kh, kv);
    const naik = r.q > 0 ? (panjang.q / r.q - 1) * 100 : 0;
    butir.push(
      en
        ? `Lengthen the drain by six metres and the seepage rises ${fmt(naik, 1)} per cent, to ${fq(panjang.qLitreDay)} l/day per m: the drain shortened the seepage path, so the gradient rose. What the drain bought is on the drawing rather than in the table, namely that the line stays inside the body.`
        : `Panjangkan drainasenya enam meter dan rembesannya naik ${fmt(naik, 1)} persen, menjadi ${fq(panjang.qLitreDay)} l/hari per m: drainase memendekkan lintasan rembesannya, jadi gradiennya naik. Yang dibeli drainase itu ada di gambarnya, bukan di tabelnya, yaitu garis freatik yang tetap tertahan di dalam badan.`
    );
  } else {
    butir.push(
      en
        ? `The drain already runs nearly the whole downstream slope (${fmt(lereng, 1)} m); six metres more would pass the toe of the slope, outside this sheet. Shorter drains would carry slightly less seepage, as long as the line stays inside the body.`
        : `Drainasenya sudah hampir sepanjang lereng hilir (${fmt(lereng, 1)} m); enam meter lagi melewati kaki lerengnya, di luar rentang lembar. Drainase yang lebih pendek meloloskan sedikit lebih kecil rembesan, selama garis freatiknya tetap tertahan.`
    );
  }

  if (aniso > 1) {
    const seragam = seepageLine(Hp, Hd, CREST, mUp, mDown, Ld, kEq, kEq);
    const naikAniso = seragam.q > 0 ? (r.q / seragam.q - 1) * 100 : 0;
    butir.push(
      en
        ? `At a permeability ratio of ${fmt(aniso, 1)} the same geometric mean permeability passes ${fmt(naikAniso, 1)} per cent more water than uniform soil would, because the transformed section is shorter and its gradient higher.`
        : `Pada perbandingan permeabilitas ${fmt(aniso, 1)}, permeabilitas rata-rata ukur yang sama meloloskan ${fmt(naikAniso, 1)} persen lebih banyak air daripada tanah seragam, karena penampang terubahnya lebih pendek dan gradiennya lebih tinggi.`
    );
  }

  return { state, notice: butir };
}
