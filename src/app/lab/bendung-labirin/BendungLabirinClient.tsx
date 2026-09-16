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
  type StructureSpec,
} from "@/lib/drawStructure";
import {
  LABYRINTH_HP_MAX,
  fmt,
  fmtPlain,
  labyrinthWeir,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
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
            { label: "Q", value: `${fmt(r.Q, 1)} m³/s`, tint: C.water },
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
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={sempit || r.interference ? undefined : C.water} alert={sempit || r.interference}>
                {`${fmt(r.gain, 2)} ×`}
              </Flag>
              {sempit && <Flag alert>{x.tajam}</Flag>}
              {r.interference && <Flag alert>{x.bertemu}</Flag>}
            </div>
            {sempit && (
              <div className="mb-2.5">
                <Note>{x.tajamNote}</Note>
              </div>
            )}
            {r.interference && (
              <div className="mb-2.5">
                <Note>{x.bertemuNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "Q", label: x.rQ, value: fmt(r.Q, 2), unit: "m³/s", tint: C.water, strong: true },
                { symbol: "—", label: x.rGain, value: fmt(r.gain, 3), unit: "×", tint: sempit || r.interference ? C.signal : C.energy, strong: true },
                { symbol: "Ql", label: x.rQl, value: fmt(r.QLinear, 2), unit: "m³/s", tint: C.ink3 },
                { symbol: "L", label: x.rL, value: fmt(r.crestLength, 2), unit: "m", tint: C.critical },
                { symbol: "L/W", label: x.rMag, value: fmt(r.magnification, 3) },
                { symbol: "h/P", label: x.rHp, value: fmt(r.headRatio, 4), tint: r.interference ? C.signal : undefined },
                { symbol: "α", label: x.rAngle, value: fmt(r.sidewallAngle, 2), unit: "°" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(h, P, Wch, cycles, B, r.gain, r.magnification, r.interference, lang)}</Note>
          </Block>
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
                <span>Q = Cd L h^1,5</span>
                <span className="ml-5">Cd = Cd₀</span>
                <span className="ml-1">(</span>
                <span>1 − 0,55</span>
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

function notice(
  h: number,
  P: number,
  Wch: number,
  cycles: number,
  B: number,
  gain: number,
  magnification: number,
  interference: boolean,
  lang: Lang
): string {
  const kecil = labyrinthWeir(h * 0.3, P, Wch, cycles, B);
  const banyak = labyrinthWeir(h, P, Wch, Math.min(cycles * 2, 16), B);

  if (lang === "en")
    return `The crest is ${fmt(magnification, 2)} times as long as the channel is wide, yet the discharge is only ${fmt(gain, 2)} times that of a straight weir. At one third of this head the gain would be ${fmt(kecil.gain, 2)} times instead. The difference between those two numbers is the whole design problem: length multiplies cheaply, but the coefficient falls as the head rises, and the two work against each other. Doubling the number of cycles here would give ${fmt(banyak.gain, 2)} times while dropping the sidewall angle to ${fmt(banyak.sidewallAngle, 1)} degrees, which brings the nappes together sooner.`;
  return `Mercunya ${fmt(magnification, 2)} kali lebih panjang daripada lebar salurannya, tetapi debitnya hanya ${fmt(gain, 2)} kali debit bendung lurus. Pada sepertiga tinggi muka air ini keuntungannya justru ${fmt(kecil.gain, 2)} kali. Selisih kedua angka itulah seluruh persoalan perancangannya: panjang mercu berlipat dengan murah, tetapi koefisiennya turun ketika tinggi muka air naik, dan keduanya bekerja berlawanan. Melipatduakan jumlah siklus di sini akan memberi ${fmt(banyak.gain, 2)} kali sambil menurunkan sudut dinding sisi ke ${fmt(banyak.sidewallAngle, 1)} derajat, dan sudut yang lebih kecil membuat tirainya bertemu lebih awal.`;
}
