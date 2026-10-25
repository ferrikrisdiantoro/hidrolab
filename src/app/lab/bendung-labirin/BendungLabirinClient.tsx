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
import {
  drawStructure,
  type StructureBody,
  type StructureSpec,
} from "@/lib/drawStructure";
import {
  LABYRINTH_ALPHA_MIN,
  LABYRINTH_HP_MAX,
  LABYRINTH_WP_MIN,
  fmt,
  fmtPlain,
  labyrinthWeir,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksLabyrinth } from "@/lib/checks";

const TXT = {
  id: {
    title: "Bendung labirin",
    sheetTitle: "Bendung labirin trapesium — tampak atas dan perlipatan panjang mercu",
    dH: "Tinggi muka air di atas mercu",
    dP: "Tinggi mercu",
    dW: "Lebar saluran",
    dN: "Banyaknya siklus",
    dB: "Panjang siklus searah aliran",
    pKecil: "Pelimpah kecil, empat siklus",
    pSedang: "Pelimpah sedang, enam siklus",
    pBanjir: "Banjir besar, tirai bertemu",
    rQ: "Debit labirin",
    rQl: "Debit bendung lurus selebar sama",
    rGain: "Keuntungan terhadap bendung lurus",
    rL: "Panjang mercu seluruhnya",
    rMag: "Perlipatan panjang mercu",
    rHp: "Perbandingan h terhadap P",
    rAngle: "Sudut dinding sisi",
    bertemu: "Tirai dari kedua sisi bertemu",
    tajam: "Siklusnya lebih sempit daripada yang pernah diuji",
    tajamNote:
      "Sudut dinding sisinya turun di bawah enam derajat, atau lebar siklusnya kurang dari dua kali tinggi mercunya. Tidak ada percobaan terbitan yang menjangkau bentuk seperti itu. Rumus perlipatan panjang mercu tetap memberi angka, dan angka itu tumbuh tanpa batas begitu siklusnya dirapatkan: enam belas siklus di dalam saluran selebar lima meter memberi perlipatan hampir tiga puluh kali. Labirin yang sebenarnya berhenti di sekitar empat sampai lima kali, karena tirai dari dinding yang berhadapan saling menekan jauh sebelum itu. Angka di lembar ini tidak lagi menggambarkan apa pun. Kurangi siklusnya, perlebar salurannya, atau rendahkan mercunya.",
    bertemuNote:
      "Perbandingan tinggi muka air terhadap tinggi mercu melewati 0,9. Pada keadaan itu tirai yang jatuh dari kedua dinding sisi bertemu di tengah siklus dan saling menekan, sehingga tambahan panjang mercu berhenti memberi tambahan debit. Yang membuat hal ini penting untuk perancangan: labirin dibangun justru untuk melewatkan banjir, dan pada keadaan banjir itulah keunggulannya paling kecil. Angka keuntungan yang dihitung di sini sudah memperhitungkan penurunan koefisiennya, tetapi di atas batas ini penurunannya sendiri tidak lagi dapat dipercaya. Tinggikan mercunya, atau perlebar siklusnya sehingga tirainya punya ruang.",
    bTerpisah: "Tirai terpisah",
    bBertemu: "Tirai bertemu, di luar uji",
    bSudutKecil: "Di bawah sudut teruji",
    bSudutUji: "Dalam rentang uji",
    sudutSym: "α (°)",
    badgeSah: "Dalam rentang uji",
    sSah: (mag: string, gain: string, hp: string) =>
      `Labirin ${mag} kali panjang, melewatkan ${gain} kali bendung lurus (h/P = ${hp}).`,
    sLuar: (sebab: string) => `Bentuk di luar percobaan terbitan: ${sebab}.`,
    sebabSudut: (a: string) => `α = ${a}° < ${fmt(LABYRINTH_ALPHA_MIN, 0)}°`,
    sebabWP: (wp: string) => `w/P = ${wp} < ${fmt(LABYRINTH_WP_MIN, 0)}`,
    sebabHP: (hp: string) => `h/P = ${hp} > ${fmt(LABYRINTH_HP_MAX, 1)}`,
    ekstrapolasi: "Angka Q dan keuntungan tetap ditulis karena bentuk siklusnya masih di dalam uji, tetapi koefisien debitnya di sini ekstrapolasi dan tidak dijamin.",
    sepertiga: (mag: string, gain: string, kecil: string) =>
      `Mercunya ${mag} kali lebih panjang daripada lebar salurannya, tetapi debitnya hanya ${gain} kali debit bendung lurus. Pada sepertiga tinggi muka air ini keuntungannya ${kecil} kali. Selisih kedua angka itulah persoalan perancangannya: panjang mercu berlipat dengan murah, tetapi koefisiennya turun ketika tinggi muka air naik.`,
    lipatDua: (n: string, gain: string, a: string) =>
      `Melipatduakan jumlah siklus menjadi ${n} akan memberi ${gain} kali dan menurunkan sudut dinding sisi ke ${a} derajat. Model lembar ini belum memasukkan pengaruh sudut pada koefisien debit (Tullis dkk. 1995), jadi angka itu batas atas.`,
    lipatDuaLuar: (n: string) =>
      `Melipatduakan jumlah siklus menjadi ${n} membawa bentuknya ke luar rentang uji, jadi angkanya tidak dikutip.`,
    lipatDuaMaks: "Jumlah siklus tidak dapat dilipatduakan di dalam rentang penggeser (paling banyak 16).",
    hPanjang: "Lebar siklus, panjang sisi, dan panjang mercu",
    hSudut: "Sudut dinding sisi dan lebar siklus terhadap tinggi mercu",
    hCd: "Koefisien debit labirin, turun dengan h/P",
    hQ: "Debit labirin dan bendung lurus selebar sama",
    hGain: "Keuntungan terhadap bendung lurus",
    note:
      "Gagasan bendung labirin dapat dikatakan dalam satu kalimat: debit ambang sebanding dengan panjang mercu, jadi lipat mercunya zig-zag dan panjangnya berlipat tanpa menambah lebar saluran. Yang membuatnya tidak sesederhana itu adalah apa yang terjadi pada tinggi muka air besar. Tirai yang jatuh dari dinding sisi kiri dan kanan sebuah siklus saling mendekat, dan begitu keduanya bertemu di tengah, ruang untuk udara di bawah tirai hilang dan tirai saling menekan. Sejak titik itu tambahan panjang mercu berhenti berguna. Akibatnya bagi perancangan cukup tajam: keuntungan labirin paling besar pada debit kecil dan paling kecil pada debit banjir, padahal debit banjirlah alasan orang membangunnya. Perhatikan pula peran sudut dinding sisi. Siklus yang banyak dan sempit memberi perlipatan panjang yang besar tetapi sudut dinding yang kecil, dan sudut kecil itulah yang membuat tirainya bertemu lebih awal. Geser jumlah siklus dari ujung ke ujung sambil memperhatikan sudut dinding di tabel hasil.",
  },
  en: {
    title: "Labyrinth weir",
    sheetTitle: "Trapezoidal labyrinth weir — plan view and crest length magnification",
    dH: "Water level above the crest",
    dP: "Crest height",
    dW: "Channel width",
    dN: "Number of cycles",
    dB: "Cycle length along the flow",
    pKecil: "Small spillway, four cycles",
    pSedang: "Medium spillway, six cycles",
    pBanjir: "Large flood, nappes meet",
    rQ: "Labyrinth discharge",
    rQl: "Straight weir of the same width",
    rGain: "Gain over the straight weir",
    rL: "Total crest length",
    rMag: "Crest length magnification",
    rHp: "Ratio of h to P",
    rAngle: "Sidewall angle",
    bertemu: "Nappes from both sides meet",
    tajam: "The cycle is narrower than anything tested",
    tajamNote:
      "The sidewall angle has fallen below six degrees, or the cycle width is under twice the crest height. No published experiment reaches a shape like that. The crest length magnification formula still returns a number, and that number grows without limit as the cycles are packed tighter: sixteen cycles in a five metre channel give nearly thirtyfold magnification. Real labyrinths stop at around four or five, because nappes from facing walls press against each other long before that. The figures on this sheet no longer describe anything. Use fewer cycles, widen the channel, or lower the crest.",
    bertemuNote:
      "The ratio of water level to crest height has passed 0.9. At that point the nappes falling from the two sidewalls meet mid-cycle and press against one another, so added crest length stops adding discharge. What makes this matter for design: a labyrinth is built precisely to pass floods, and it is at flood that its advantage is smallest. The gain computed here already accounts for the falling coefficient, but above this limit that fall itself can no longer be trusted. Raise the crest, or widen the cycles so the nappes have room.",
    bTerpisah: "Nappes separate",
    bBertemu: "Nappes meet, beyond tests",
    bSudutKecil: "Below tested angle",
    bSudutUji: "Within tested range",
    sudutSym: "α (°)",
    badgeSah: "Within tested range",
    sSah: (mag: string, gain: string, hp: string) =>
      `The labyrinth is ${mag} times as long and passes ${gain} times a straight weir (h/P = ${hp}).`,
    sLuar: (sebab: string) => `Shape beyond published experiments: ${sebab}.`,
    sebabSudut: (a: string) => `α = ${a}° < ${fmt(LABYRINTH_ALPHA_MIN, 0)}°`,
    sebabWP: (wp: string) => `w/P = ${wp} < ${fmt(LABYRINTH_WP_MIN, 0)}`,
    sebabHP: (hp: string) => `h/P = ${hp} > ${fmt(LABYRINTH_HP_MAX, 1)}`,
    ekstrapolasi: "Q and the gain are still shown because the cycle shape is within the tests, but the discharge coefficient here is an extrapolation and not guaranteed.",
    sepertiga: (mag: string, gain: string, kecil: string) =>
      `The crest is ${mag} times as long as the channel is wide, yet the discharge is only ${gain} times that of a straight weir. At one third of this head the gain would be ${kecil} times. The difference between those two numbers is the design problem: length multiplies cheaply, but the coefficient falls as the head rises.`,
    lipatDua: (n: string, gain: string, a: string) =>
      `Doubling the cycles to ${n} would give ${gain} times and drop the sidewall angle to ${a} degrees. This sheet's model does not yet include the effect of angle on the discharge coefficient (Tullis et al. 1995), so that figure is an upper bound.`,
    lipatDuaLuar: (n: string) =>
      `Doubling the cycles to ${n} takes the shape outside the tested range, so its figure is not quoted.`,
    lipatDuaMaks: "The number of cycles cannot be doubled within the slider range (at most 16).",
    hPanjang: "Cycle width, side length and crest length",
    hSudut: "Sidewall angle and cycle width relative to crest height",
    hCd: "Labyrinth discharge coefficient, falling with h/P",
    hQ: "Labyrinth discharge and a straight weir of the same width",
    hGain: "Gain over the straight weir",
    note:
      "The idea of a labyrinth weir takes one sentence: weir discharge is proportional to crest length, so fold the crest into a zig-zag and its length multiplies without widening the channel. What makes it less simple is what happens at large heads. The nappes falling from the left and right sidewalls of a cycle approach one another, and once they meet in the middle, the space for air beneath them disappears and the nappes press together. From that point added crest length stops helping. The consequence for design is sharp enough: the labyrinth advantage is largest at small discharges and smallest at flood discharges, although flood is the reason one is built. Note too the role of the sidewall angle. Many narrow cycles give a large length magnification but a small sidewall angle, and it is that small angle which makes the nappes meet sooner. Sweep the number of cycles from end to end while watching the sidewall angle in the results table.",
  },
} as const;

const REFS = {
  id: [
    "Tullis, J.P., Amanian, N. & Waldron, D. (1995). Design of labyrinth spillways. Journal of Hydraulic Engineering, vol. 121.",
    "Falvey, H.T. (2003). Hydraulic Design of Labyrinth Weirs. ASCE Press.",
    "Crookston, B.M. & Tullis, B.P. (2013). Hydraulic design and analysis of labyrinth weirs. Journal of Irrigation and Drainage Engineering, vol. 139.",
    "Lux, F. & Hinchliff, D. (1985). Design and construction of labyrinth spillways. 15th ICOLD Congress.",
  ],
  en: [
    "Tullis, J.P., Amanian, N. & Waldron, D. (1995). Design of labyrinth spillways. Journal of Hydraulic Engineering, vol. 121.",
    "Falvey, H.T. (2003). Hydraulic Design of Labyrinth Weirs. ASCE Press.",
    "Crookston, B.M. & Tullis, B.P. (2013). Hydraulic design and analysis of labyrinth weirs. Journal of Irrigation and Drainage Engineering, vol. 139.",
    "Lux, F. & Hinchliff, D. (1985). Design and construction of labyrinth spillways. 15th ICOLD Congress.",
  ],
} as const;

export function BendungLabirinClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [h, setH] = useState(0.8);
  const [P, setP] = useState(2);
  const [Wch, setWch] = useState(30);
  const [cycles, setCycles] = useState(6);
  const [B, setB] = useState(6);

  const r = labyrinthWeir(h, P, Wch, cycles, B);

  /* Bentuk yang di luar segala percobaan terbitan: siklus terlalu rapat,
     atau terlalu sempit terhadap tinggi mercunya sendiri. */
  const sempit = r.sidewallTooSharp || r.cycleTooNarrow;

  /* Nilai antara untuk langkah hitungan. Lib belum menyimpan Cd sebagai
     field (PERMINTAAN ke pengembang-model); Cd di sini dibaca balik dari
     Q yang dihitung lib, jadi sama persis dengan angka di tabel. */
  const w = Wch / cycles;
  const sisi = Math.sqrt(B * B + (w / 4) * (w / 4));
  const Cd = h > 0 && r.crestLength > 0 ? r.Q / (r.crestLength * Math.pow(h, 1.5)) : NaN;

  const ref = useCanvas(
    (ctx, cw, chh) => {
      /* Tampak atas: aliran datang dari bawah gambar ke atas. Tiap siklus
         berbentuk trapesium dengan lebar w dan panjang B searah aliran. */
      const w = Wch / cycles;
      const badan: StructureBody[] = [];

      for (let i = 0; i < cycles; i++) {
        const x0 = i * w;
        // Dinding mercu digambar sebagai pita tipis mengikuti denah zig-zag.
        const tebal = Math.max(w * 0.05, 0.12);
        const luar: { x: number; z: number }[] = [
          { x: x0, z: 0 },
          { x: x0 + w / 4, z: B },
          { x: x0 + (3 * w) / 4, z: B },
          { x: x0 + w, z: 0 },
        ];
        const dalam: { x: number; z: number }[] = [
          { x: x0 + w, z: -tebal },
          { x: x0 + (3 * w) / 4, z: B - tebal },
          { x: x0 + w / 4, z: B - tebal },
          { x: x0, z: -tebal },
        ];
        badan.push({ pts: [...luar, ...dalam] });
      }

      const spec: StructureSpec = {
        xMin: -Wch * 0.04,
        xMax: Wch * 1.04,
        zMin: -B * 0.5,
        zMax: B * 1.35,
        bodies: badan,
        waters: [
          {
            surface: [
              { x: -Wch * 0.04, z: -B * 0.14 },
              { x: Wch * 1.04, z: -B * 0.14 },
            ],
            bed: [
              { x: Wch * 1.04, z: -B * 0.5 },
              { x: -Wch * 0.04, z: -B * 0.5 },
            ],
            invalid: r.interference,
          },
        ],
        dims: [
          {
            axis: "h",
            at: B * 1.16,
            from: 0,
            to: Wch / cycles,
            text: `${fmtPlain(Wch / cycles, 2)} m`,
            color: C.critical,
          },
          {
            axis: "v",
            at: Wch * 1.0,
            from: 0,
            to: B,
            text: `B ${fmtPlain(B, 1)} m`,
            color: C.ink,
            offset: 22,
          },
        ],
        callouts: [
          {
            x: Wch / (2 * cycles),
            z: B * 0.55,
            dx: 30,
            dy: -26,
            text: T.cycleLabel,
            color: C.critical,
          },
        ],
        arrows: [
          { x: Wch * 0.16, z: -B * 0.32, length: 0 },
          { x: Wch * 0.5, z: -B * 0.32, length: 0 },
          { x: Wch * 0.84, z: -B * 0.32, length: 0 },
        ],
        heading: sempit ? x.tajam : r.interference ? T.nappeMeet : T.planView2,
        headingColor: sempit || r.interference ? C.signal : C.ink3,
        axisX: T.axHoriz,
        axisZ: T.axHoriz,
      };

      drawStructure(ctx, cw, chh, spec, lang);
    },
    [h, P, Wch, cycles, B, lang]
  );

  return (
    <LabShell
      status={
        <div className="flex flex-col gap-2">
          <RegimeScale
            symbol="h/P"
            value={r.headRatio}
            scale="log"
            digits={3}
            invalid={r.interference}
            bands={[
              { from: 0.005, to: LABYRINTH_HP_MAX, label: x.bTerpisah, tone: "water" },
              { from: LABYRINTH_HP_MAX, to: 15, label: x.bBertemu, tone: "invalid" },
            ]}
          />
          <RegimeScale
            symbol={x.sudutSym}
            value={r.sidewallAngle}
            scale="log"
            digits={1}
            invalid={r.sidewallTooSharp}
            bands={[
              { from: 0.2, to: LABYRINTH_ALPHA_MIN, label: x.bSudutKecil, tone: "invalid" },
              { from: LABYRINTH_ALPHA_MIN, to: 90, label: x.bSudutUji, tone: "neutral" },
            ]}
          />
        </div>
      }
      sheet="HS-02"
      subject={SUBJECTS.HS[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Debit ambang sebanding dengan{" "}
            <Term tint={C.critical}>panjang mercu</Term>, jadi mercu yang
            dilipat zig-zag melewatkan lebih banyak air pada lebar saluran yang
            sama. Sampai <Term tint={C.signal}>tirainya bertemu</Term>.
          </p>
        ) : (
          <p>
            Weir discharge is proportional to{" "}
            <Term tint={C.critical}>crest length</Term>, so a crest folded into
            a zig-zag passes more water across the same channel width. Until the{" "}
            <Term tint={C.signal}>nappes meet</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HS-02"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "L", value: `${fmt(r.crestLength, 1)} m`, tint: C.critical },
            { label: "L/W", value: fmt(r.magnification, 2) },
            { label: "Q", value: sempit ? "—" : `${fmt(r.Q, 1)} m³/s`, tint: sempit ? C.signal : C.water },
            {
              label: "h/P",
              value: fmt(r.headRatio, 3),
              tint: r.interference ? C.signal : undefined,
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
              <InputRow symbol="h" label={x.dH} value={h} min={0.05} max={4} step={0.05} digits={2} unit="m" onChange={setH} tint={C.water} />
              <InputRow symbol="P" label={x.dP} value={P} min={0.3} max={8} step={0.1} digits={1} unit="m" onChange={setP} />
              <InputRow symbol="W" label={x.dW} value={Wch} min={5} max={120} step={1} digits={0} unit="m" onChange={setWch} />
              <InputRow symbol="N" label={x.dN} value={cycles} min={1} max={16} step={1} digits={0} onChange={setCycles} tint={C.critical} />
              <InputRow symbol="B" label={x.dB} value={B} min={1} max={20} step={0.5} digits={1} unit="m" onChange={setB} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pKecil, apply: () => { setH(0.5); setP(1.5); setWch(14); setCycles(4); setB(4); } },
                  { label: x.pSedang, apply: () => { setH(0.8); setP(2); setWch(30); setCycles(6); setB(6); } },
                  { label: x.pBanjir, apply: () => { setH(2); setP(2); setWch(30); setCycles(6); setB(6); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            {/* Bentuk siklus di luar uji: angka debit dan keuntungan tidak
                lagi menggambarkan apa pun (tajamNote), jadi ditulis "—". */}
            <ResultTable
              rows={[
                { symbol: "Q", label: x.rQ, value: sempit ? "—" : fmt(r.Q, 2), unit: sempit ? undefined : "m³/s", tint: C.water, strong: true },
                { label: x.rGain, value: sempit ? "—" : fmt(r.gain, 3), unit: sempit ? undefined : "×", tint: sempit || r.interference ? C.signal : C.energy, strong: true },
                { symbol: "Ql", label: x.rQl, value: fmt(r.QLinear, 2), unit: "m³/s", tint: C.ink3 },
                { symbol: "L", label: x.rL, value: fmt(r.crestLength, 2), unit: "m", tint: C.critical },
                { symbol: "L/W", label: x.rMag, value: fmt(r.magnification, 3) },
                { symbol: "h/P", label: x.rHp, value: fmt(r.headRatio, 4), tint: r.interference ? C.signal : undefined },
                { symbol: "α", label: x.rAngle, value: fmt(r.sidewallAngle, 2), unit: "°", tint: r.sidewallTooSharp ? C.signal : undefined },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hPanjang,
                    rumus: (<><span>w =</span><Frac num="W" den="N" /><span className="ml-3">L = N · ( 2 · √( B² + ( w/4 )² ) + w/2 )</span></>),
                    isi: `w = ${fmt(Wch, 0)} / ${fmt(cycles, 0)} = ${fmt(w, 4)} m; √( ${fmt(B, 1)}² + ( ${fmt(w, 4)}/4 )² ) = ${fmt(sisi, 4)} m; ${fmt(cycles, 0)} · ( 2 · ${fmt(sisi, 4)} + ${fmt(w, 4)}/2 )`,
                    hasil: fmt(r.crestLength, 2),
                    satuan: "m",
                    tint: C.critical,
                  },
                  {
                    judul: x.rMag,
                    rumus: (<><span>L/W =</span><Frac num="L" den="W" /></>),
                    isi: `${fmt(r.crestLength, 3)} / ${fmt(Wch, 0)}`,
                    hasil: fmt(r.magnification, 3),
                  },
                  {
                    judul: x.hSudut,
                    rumus: <span>α = atan( ( w/4 ) / B ); w/P</span>,
                    isi: `atan( ( ${fmt(w, 4)}/4 ) / ${fmt(B, 1)} ); w/P = ${fmt(w, 4)} / ${fmt(P, 1)} = ${fmt(w / P, 3)}`,
                    hasil: `${fmt(r.sidewallAngle, 2)}°`,
                    tint: r.sidewallTooSharp ? C.signal : undefined,
                  },
                  {
                    judul: x.hCd,
                    rumus: <span>Cd = {fmt(1.85, 2)} · ( 1 − {fmt(0.55, 2)} · min( ( h/P ) / {fmt(LABYRINTH_HP_MAX, 1)} ; 1 ) )</span>,
                    isi: `${fmt(1.85, 2)} · ( 1 − ${fmt(0.55, 2)} · min( ${fmt(r.headRatio, 5)} / ${fmt(LABYRINTH_HP_MAX, 1)} ; 1 ) )`,
                    hasil: fmt(Cd, 4),
                    satuan: "m^½/s",
                    tint: C.energy,
                  },
                  {
                    judul: x.hQ,
                    rumus: <span>Q = Cd · L · h^{fmt(1.5, 1)}; Ql = {fmt(1.85, 2)} · W · h^{fmt(1.5, 1)}</span>,
                    isi: sempit
                      ? "—"
                      : `${fmt(Cd, 5)} · ${fmt(r.crestLength, 3)} · ${fmt(h, 2)}^${fmt(1.5, 1)} ; Ql = ${fmt(1.85, 2)} · ${fmt(Wch, 0)} · ${fmt(h, 2)}^${fmt(1.5, 1)} = ${fmt(r.QLinear, 3)} m³/s`,
                    hasil: sempit ? "—" : fmt(r.Q, 2),
                    satuan: sempit ? undefined : "m³/s",
                    tint: C.water,
                  },
                  {
                    judul: x.hGain,
                    rumus: (<><span>Q / Ql</span></>),
                    isi: sempit ? "—" : `${fmt(r.Q, 3)} / ${fmt(r.QLinear, 3)}`,
                    hasil: sempit ? "—" : `${fmt(r.gain, 3)} ×`,
                    tint: C.energy,
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard {...keadaan(h, P, Wch, cycles, B, r, lang)} />
        </>
      }
      verification={<Verification checks={checksLabyrinth(h, P, Wch, cycles, B)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>L = N (2√(B² + (w/4)²) + w/2)</span>
                <span className="ml-5">w =</span>
                <Frac num="W" den="N" />
              </Eq>
              <Eq>
                <span>Q = Cd L h^{fmt(1.5, 1)}</span>
                <span className="ml-5">Cd = Cd₀</span>
                <span className="ml-1">(</span>
                <span>1 − {fmt(0.55, 2)}</span>
                <Frac num="h/P" den={fmtPlain(LABYRINTH_HP_MAX, 1)} />
                <span>)</span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `tirai bertemu di atas h/P sama dengan ${fmtPlain(LABYRINTH_HP_MAX, 1)}`
                    : `nappes meet above an h/P of ${fmtPlain(LABYRINTH_HP_MAX, 1)}`}
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

function keadaan(
  h: number,
  P: number,
  Wch: number,
  cycles: number,
  B: number,
  r: ReturnType<typeof labyrinthWeir>,
  lang: Lang
): { tone: Tone; badge: string; state: string; notice: string[] } {
  const x = TXT[lang];
  const sempit = r.sidewallTooSharp || r.cycleTooNarrow;
  const w = Wch / cycles;

  if (sempit || r.interference) {
    const sebab: string[] = [];
    if (r.sidewallTooSharp) sebab.push(x.sebabSudut(fmt(r.sidewallAngle, 1)));
    if (r.cycleTooNarrow) sebab.push(x.sebabWP(fmt(w / P, 2)));
    if (r.interference) sebab.push(x.sebabHP(fmt(r.headRatio, 2)));
    return {
      tone: "invalid",
      badge: sempit ? x.tajam : x.bertemu,
      state: x.sLuar(sebab.join("; ")),
      notice: [
        ...(sempit ? [x.tajamNote] : []),
        ...(r.interference ? [x.bertemuNote] : []),
        ...(!sempit ? [x.ekstrapolasi] : []),
      ],
    };
  }

  /* Kalimat lipat dua siklus (CACAT 2): hanya bila 2N masih di dalam
     rentang penggeser dan bentuk hasilnya masih di dalam uji. Versi lama
     memakai min(2N, 16), jadi untuk N ≥ 9 bukan lipat dua, dan mengutip
     angka dari bentuk di luar uji. */
  const n2 = cycles * 2;
  let lipat: string;
  if (n2 > 16) {
    lipat = x.lipatDuaMaks;
  } else {
    const banyak = labyrinthWeir(h, P, Wch, n2, B);
    lipat =
      banyak.sidewallTooSharp || banyak.cycleTooNarrow || banyak.interference
        ? x.lipatDuaLuar(fmt(n2, 0))
        : x.lipatDua(fmt(n2, 0), fmt(banyak.gain, 2), fmt(banyak.sidewallAngle, 1));
  }
  const kecil = labyrinthWeir(h * 0.3, P, Wch, cycles, B);

  return {
    tone: "water",
    badge: x.badgeSah,
    state: x.sSah(fmt(r.magnification, 2), fmt(r.gain, 2), fmt(r.headRatio, 3)),
    notice: [
      x.sepertiga(fmt(r.magnification, 2), fmt(r.gain, 2), fmt(kecil.gain, 2)),
      lipat,
    ],
  };
}
