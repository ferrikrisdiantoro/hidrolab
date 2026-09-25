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
  type StructureLine,
  type StructureVector,
} from "@/lib/drawStructure";
import {
  CONCRETE_UNIT_WEIGHT,
  UPLIFT_DRAIN_RESIDUAL,
  WATER_UNIT_WEIGHT,
  fmt,
  fmtPlain,
  gravityDam,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksDam } from "@/lib/checks";

const DRAIN_AT = 0.1;
const FS_SLIDE_MIN = 1.5;
const FS_OVER_MIN = 1.5;

const TXT = {
  id: {
    title: "Stabilitas bendungan",
    sheetTitle: "Bendungan beton gravitasi — guling, geser, dan daya dukung",
    dHd: "Tinggi bendungan",
    dCrest: "Lebar mercu",
    dBase: "Lebar dasar",
    dH: "Kedalaman air hulu",
    dHt: "Kedalaman air hilir",
    dMu: "Koefisien gesek dasar",
    dCoh: "Kohesi dasar",
    dDrain: "Sisa tekanan angkat di garis tirisan",
    mode: "Tekanan angkat",
    mAda: "Diperhitungkan",
    mTanpa: "Ditiadakan",
    pPenuh: "Waduk penuh, tirisan bekerja",
    pTanpaTiris: "Waduk penuh, tirisan tersumbat",
    pHilir: "Air hilir tinggi",
    rW: "Berat badan bendungan",
    rU: "Gaya angkat",
    rPu: "Dorongan air hulu",
    rPd: "Dorongan air hilir",
    rV: "Jumlah gaya tegak",
    rHh: "Jumlah gaya mendatar",
    rX: "Letak resultan dari tumit",
    rE: "Simpangan dari tengah dasar",
    rHeel: "Tegangan di tumit",
    rToe: "Tegangan di ujung kaki",
    rFsO: "Faktor keamanan guling",
    rFsS: "Faktor keamanan geser",
    rBase: "Lebar dasar terkecil yang bebas tarik",
    aman: "Memenuhi ketiganya",
    dipotong: "Muka air melampaui tinggi bendungan",
    dipotongNote:
      "Kedalaman air yang dipilih melewati tinggi bendungannya, atau muka air hilirnya melewati muka air hulunya. Keduanya keadaan yang tidak dihitung lembar ini, jadi angkanya dipotong pada batas yang masuk akal sebelum dipakai: air hulu setinggi mercu, dan air hilir setinggi air hulu. Yang tertulis di tabel karena itu bukan keadaan yang sedang dipilih penggesernya. Bendungan beton gravitasi memang boleh dilimpasi pada bagian pelimpahnya, tetapi tekanan air pada bagian yang tidak melimpas tetap berhenti di mercu, dan lembar ini menghitung bagian yang tidak melimpas.",
    tarik: "Tumit tertarik, resultan keluar dari sepertiga tengah",
    geser: "Faktor geser di bawah syarat",
    guling: "Faktor guling di bawah syarat",
    tarikNote:
      "Resultan jatuh di luar sepertiga tengah dasar, jadi tumitnya tertarik. Yang perlu diperhatikan tentang keadaan ini bukan besarnya tegangan tarik itu melainkan umpan balik yang dimulainya. Beton tidak menahan tarik, jadi tumitnya retak. Retakan itu terhubung dengan waduk, jadi ia terisi air bertekanan penuh. Tekanan angkat karena itu bekerja penuh sepanjang retakan, bukan lagi menurun landai dari tumit ke kaki. Gaya angkat yang naik menggeser resultan lebih jauh lagi ke arah kaki, yang memperpanjang retakan, yang menaikkan angkat lagi. Itu sebabnya aturan sepertiga tengah tidak diperlakukan sebagai batas kenyamanan melainkan sebagai batas mutlak: di sebelah luarnya, kegagalannya memberi makan dirinya sendiri.",
    note:
      "Dua hal pada lembar ini yang paling sering mengejutkan orang yang baru pertama menghitungnya. Pertama, yang paling sering menjatuhkan hitungan ini bukan dorongan airnya melainkan tekanan angkat di bawah dasarnya. Air yang mendorong muka hulu terlihat dan terasa berbahaya; air yang mengangkat dari bawah tidak terlihat sama sekali, dan pada bendungan tinggi ia menghapus seperempat sampai sepertiga berat betonnya. Matikan tekanan angkatnya di lembar ini dan lihat kedua faktor keamanannya melompat. Itu sebabnya tirisan di dekat tumit, yang biayanya kecil dibandingkan beton, sering menaikkan faktor geser lebih banyak daripada melebarkan dasarnya satu meter. Kedua, menaikkan air hilir tidak selalu menolong, dan sering justru merugikan. Air hilir memang mendorong balik dan mengurangi dorongan mendatar bersihnya, tetapi ia juga menaikkan tekanan angkat di sepanjang dasar. Pada dasar tanpa kohesi, perlawanan gesek yang hilang karena gaya tegak berkurang lebih besar daripada dorongan yang dihemat, sehingga faktor gesernya turun. Yang membalik arahnya adalah kohesi, karena kohesi memberi perlawanan yang tidak bergantung pada gaya tegak sama sekali. Jadi jawaban atas pertanyaan apakah air hilir menolong bukan ya atau tidak, melainkan tergantung pada apa yang menahan dasarnya.",
  },
  en: {
    title: "Dam stability",
    sheetTitle: "Concrete gravity dam — overturning, sliding, and bearing",
    dHd: "Dam height",
    dCrest: "Crest width",
    dBase: "Base width",
    dH: "Upstream water depth",
    dHt: "Tailwater depth",
    dMu: "Base friction coefficient",
    dCoh: "Base cohesion",
    dDrain: "Residual uplift at the drain line",
    mode: "Uplift",
    mAda: "Counted",
    mTanpa: "Left out",
    pPenuh: "Full reservoir, drains working",
    pTanpaTiris: "Full reservoir, drains blocked",
    pHilir: "High tailwater",
    rW: "Weight of the dam body",
    rU: "Uplift force",
    rPu: "Upstream thrust",
    rPd: "Tailwater thrust",
    rV: "Sum of vertical forces",
    rHh: "Sum of horizontal forces",
    rX: "Resultant position from the heel",
    rE: "Eccentricity from the base centre",
    rHeel: "Stress at the heel",
    rToe: "Stress at the toe",
    rFsO: "Factor of safety against overturning",
    rFsS: "Factor of safety against sliding",
    rBase: "Smallest tension free base width",
    aman: "All three are satisfied",
    dipotong: "The water level exceeds the dam height",
    dipotongNote:
      "The chosen water depth passes the height of the dam, or the tailwater passes the headwater. Neither state is computed on this sheet, so the figures are clipped to sensible limits before use: headwater at crest level, tailwater at headwater level. What the table shows is therefore not the state the sliders are set to. A concrete gravity dam may indeed be overtopped across its spillway section, but the water load on a non-spillway section still stops at the crest, and this sheet computes a non-spillway section.",
    tarik: "The heel is in tension, the resultant leaves the middle third",
    geser: "The sliding factor is below requirement",
    guling: "The overturning factor is below requirement",
    tarikNote:
      "The resultant falls outside the middle third of the base, so the heel is in tension. What matters about this state is not the size of that tensile stress but the feedback it starts. Concrete does not take tension, so the heel cracks. The crack connects to the reservoir, so it fills with water at full pressure. Uplift therefore acts in full along the crack rather than tapering from heel to toe. The increased uplift pushes the resultant further towards the toe, which lengthens the crack, which raises the uplift again. That is why the middle third rule is treated not as a comfort margin but as an absolute limit: beyond it, the failure feeds itself.",
    note:
      "Two things on this sheet most often surprise someone computing it for the first time. First, what most often fails this calculation is not the water pushing on the face but the uplift beneath the base. Water pushing on the upstream face is visible and feels dangerous; water lifting from below is not visible at all, and on a tall dam it cancels a quarter to a third of the concrete weight. Switch the uplift off on this sheet and watch both factors of safety jump. That is why drains near the heel, cheap compared with concrete, often raise the sliding factor more than widening the base by a metre. Second, raising the tailwater does not always help, and often hurts. Tailwater does push back and reduce the net horizontal thrust, but it also raises the uplift along the whole base. On a base without cohesion, the frictional resistance lost to the reduced vertical force exceeds the thrust saved, so the sliding factor falls. What reverses the direction is cohesion, because cohesion supplies resistance that does not depend on the vertical force at all. So the answer to whether tailwater helps is not yes or no but depends on what holds the base.",
  },
} as const;

const REFS = {
  id: [
    "USBR (1976). Design of Gravity Dams. Denver.",
    "USACE (1995). Gravity Dam Design, EM 1110-2-2200.",
    "Novak, P., Moffat, A.I.B., Nalluri, C. & Narayanan, R. (2007). Hydraulic Structures, edisi ke-4, bab 4.",
    "ICOLD (2005). Bulletin 117: The gravity dam, a dam for the future.",
  ],
  en: [
    "USBR (1976). Design of Gravity Dams. Denver.",
    "USACE (1995). Gravity Dam Design, EM 1110-2-2200.",
    "Novak, P., Moffat, A.I.B., Nalluri, C. & Narayanan, R. (2007). Hydraulic Structures, 4th ed., ch. 4.",
    "ICOLD (2005). Bulletin 117: The gravity dam, a dam for the future.",
  ],
} as const;

export function StabilitasBendunganClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Hd, setHd] = useState(40);
  const [crest, setCrest] = useState(6);
  const [B, setB] = useState(30);
  const [H, setH] = useState(38);
  const [Ht, setHt] = useState(3);
  const [mu, setMu] = useState(0.7);
  const [coh, setCoh] = useState(100);
  const [residual, setResidual] = useState(UPLIFT_DRAIN_RESIDUAL);
  const [upliftOn, setUpliftOn] = useState(true);

  /*
   * Kedua muka air dipotong sebelum dipakai: air hulu di mercu, air hilir
   * di air hulu. Pemotongannya benar, tetapi sebelumnya DIAM-DIAM, sehingga
   * penggeser menunjuk seratus meter sementara seluruh lembar menjawab
   * empat puluh meter tanpa satu pun tanda bahwa keduanya berbeda.
   */
  const Hp = Math.min(H, Hd);
  const Htp = Math.min(Ht, Hp);
  const dipotong = H > Hd || Ht > Hp;
  const r = gravityDam(Hd, crest, B, Hp, Htp, mu, coh, residual, DRAIN_AT, upliftOn);

  const gagal = r.tension || r.fsSliding < FS_SLIDE_MIN || r.fsOverturning < FS_OVER_MIN;

  const ref = useCanvas(
    (ctx, w, ch) => {
      const pinggir = Math.max(B * 0.42, 8);

      /* Panah gaya diskalakan terhadap gaya terbesar di lembar ini, supaya
         panjangnya membawa data dan bukan hiasan. */
      const terbesar = Math.max(r.weight, r.uplift, r.thrustUp, 1);
      const px = (gaya: number) => (gaya / terbesar) * 62;

      const vektor: StructureVector[] = [
        {
          x: r.weightArm,
          z: Hd * 0.42,
          dx: 0,
          dy: px(r.weight),
          text: `W ${fmtPlain(r.weight, 0)} kN`,
          color: C.ink,
          root: true,
        },
        {
          x: 0,
          z: Hp / 3,
          dx: px(r.thrustUp),
          dy: 0,
          text: `Pu ${fmtPlain(r.thrustUp, 0)} kN`,
          color: C.water,
          root: true,
        },
      ];
      if (Htp > 0)
        vektor.push({
          x: B,
          z: Htp / 3,
          dx: -px(r.thrustDown),
          dy: 0,
          text: `Pd ${fmtPlain(r.thrustDown, 0)} kN`,
          color: C.water,
          root: true,
        });
      if (upliftOn)
        vektor.push({
          x: r.upliftArm,
          z: 0,
          dx: 0,
          dy: -px(r.uplift),
          text: `U ${fmtPlain(r.uplift, 0)} kN`,
          color: C.critical,
          root: true,
        });

      /* Diagram tekanan angkat di bawah dasar, diskalakan ke ketinggian
         gambar supaya bentuk berkaitnya di garis tirisan terbaca */
      const angkatMaks = Math.max(
        ...r.upliftShape.map((p) => Math.abs(p.z)),
        1e-9
      );
      const tinggiDiagram = Hd * 0.2;
      const diagram: StructureLine[] = upliftOn
        ? [
            {
              pts: r.upliftShape.map((p) => ({
                x: p.x,
                z: (p.z / angkatMaks) * tinggiDiagram,
              })),
              color: C.critical,
              weight: W.thin,
              dash: DASH.solid,
              label: T.upliftLabel,
              labelAt: 0.3,
              labelDy: 34,
            },
          ]
        : [];

      const garis: StructureLine[] = [
        ...diagram,
        {
          /* Sepertiga tengah dasar, batas yang menentukan segalanya */
          pts: [
            { x: B / 3, z: 0 },
            { x: B / 3, z: -tinggiDiagram * 0.35 },
          ],
          color: C.critical,
          weight: W.hair,
          dash: DASH.axis,
        },
        {
          pts: [
            { x: (2 * B) / 3, z: 0 },
            { x: (2 * B) / 3, z: -tinggiDiagram * 0.35 },
          ],
          color: C.critical,
          weight: W.hair,
          dash: DASH.axis,
          label: T.middleThird,
          labelAt: 1,
          labelDy: 34,
        },
        {
          /* Garis kerja resultan pada dasarnya */
          pts: [
            { x: r.resultantAt, z: Hd * 0.34 },
            { x: r.resultantAt, z: -tinggiDiagram * 0.55 },
          ],
          color: r.tension ? C.signal : C.energy,
          weight: W.thin,
          dash: DASH.phantom,
          label: `${T.resultantLabel} ${fmtPlain(r.resultantAt, 2)} m`,
          labelAt: 0,
          labelDy: -12,
        },
      ];
      if (residual < 1 && upliftOn)
        garis.push({
          pts: [
            { x: DRAIN_AT * B, z: Hd * 0.1 },
            { x: DRAIN_AT * B, z: 0 },
          ],
          color: C.ink3,
          weight: W.hair,
          dash: DASH.axis,
          label: T.drainLine,
          labelAt: 0,
          labelDy: -26,
        });

      drawStructure(
        ctx,
        w,
        ch,
        {
          xMin: -pinggir,
          xMax: B + pinggir,
          /*
           * Ruang di bawah dasar dilebarkan dari satu setengah kali tinggi
           * diagram menjadi dua kali.
           *
           * Di jalur setipis itu berdesakan ENAM tulisan sekaligus: tumit,
           * ujung kaki, garis tirisan, tekanan angkat, sepertiga tengah,
           * dan ukuran lebar dasar. Penempat tulisan memang menjaga
           * keenamnya tidak bertindih, tetapi tidak dapat menciptakan jarak
           * yang tidak ada, jadi hasilnya enam tulisan yang saling
           * bersentuhan dan terbaca sebagai satu kalimat panjang. Yang
           * kurang bukan aturan penempatannya melainkan ruangnya.
           */
          zMin: -tinggiDiagram * 2,
          zMax: Hd * 1.16,
          bodies: [{ pts: r.section, hatch: "concrete" }],
          waters: [
            {
              surface: [
                { x: -pinggir, z: Hp },
                { x: 0, z: Hp },
              ],
            },
            ...(Htp > 0
              ? [
                  {
                    surface: [
                      { x: B, z: Htp },
                      { x: B + pinggir, z: Htp },
                    ],
                  },
                ]
              : []),
          ],
          lines: garis,
          vectors: vektor,
          dims: [
            { axis: "h", at: 0, from: 0, to: B, text: `B ${fmtPlain(B, 1)} m`, offset: 66 },
          ],
          callouts: [
            { x: 0, z: 0, dx: -24, dy: 16, text: T.heelLabel },
            { x: B, z: 0, dx: 22, dy: 16, text: T.toeLabelDam },
          ],
          heading: dipotong ? x.dipotong : r.tension ? x.tarik : undefined,
          headingColor: C.signal,
          axisX: T.axSection,
          axisZ: T.elevation,
        },
        lang
      );
    },
    [Hd, crest, B, H, Ht, mu, coh, residual, upliftOn, lang]
  );

  return (
    <LabShell
      sheet="DM-01"
      subject={SUBJECTS.DM[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Yang paling sering menjatuhkan hitungan ini bukan dorongan airnya
            melainkan <Term tint={C.critical}>tekanan angkat</Term> di bawah
            dasarnya, yang menghapus{" "}
            <Term tint={C.critical}>
              {fmt((r.uplift / Math.max(r.weight, 1e-9)) * 100, 0)} persen
            </Term>{" "}
            berat betonnya.
          </p>
        ) : (
          <p>
            What most often fails this calculation is not the water pushing on
            the face but the <Term tint={C.critical}>uplift</Term> beneath the
            base, which cancels{" "}
            <Term tint={C.critical}>
              {fmt((r.uplift / Math.max(r.weight, 1e-9)) * 100, 0)} per cent
            </Term>{" "}
            of the concrete weight.
          </p>
        )
      }
      drawing={
        <Sheet
          number="DM-01"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, kN, kPa)" },
            { label: "e", value: `${fmt(r.eccentricity, 2)} m`, tint: r.tension ? C.signal : C.critical },
            { label: "FSg", value: fmt(r.fsOverturning, 2) },
            { label: "FSs", value: fmt(r.fsSliding, 2), tint: r.fsSliding < FS_SLIDE_MIN ? C.signal : undefined },
            { label: "γc", value: `${fmtPlain(CONCRETE_UNIT_WEIGHT, 0)} kN/m³` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <div className="mb-3">
              <PresetRow
                label={x.mode}
                active={upliftOn ? 0 : 1}
                presets={[
                  { label: x.mAda, apply: () => setUpliftOn(true) },
                  { label: x.mTanpa, apply: () => setUpliftOn(false) },
                ]}
              />
            </div>
            <InputTable>
              <InputRow symbol="Hd" label={x.dHd} value={Hd} min={10} max={100} step={1} digits={0} unit="m" onChange={setHd} />
              <InputRow symbol="a" label={x.dCrest} value={crest} min={2} max={14} step={0.5} digits={1} unit="m" onChange={setCrest} />
              <InputRow symbol="B" label={x.dBase} value={B} min={6} max={90} step={0.5} digits={1} unit="m" onChange={setB} tint={C.critical} />
              <InputRow symbol="H" label={x.dH} value={H} min={1} max={100} step={0.5} digits={1} unit="m" onChange={setH} tint={C.water} />
              <InputRow symbol="Ht" label={x.dHt} value={Ht} min={0} max={40} step={0.5} digits={1} unit="m" onChange={setHt} tint={C.water} />
              <InputRow symbol="μ" label={x.dMu} value={mu} min={0.4} max={1} step={0.02} digits={2} onChange={setMu} />
              <InputRow symbol="c" label={x.dCoh} value={coh} min={0} max={600} step={10} digits={0} unit="kPa" onChange={setCoh} />
              <InputRow symbol="ku" label={x.dDrain} value={residual} min={0} max={1} step={0.05} digits={2} onChange={setResidual} tint={C.critical} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pPenuh, apply: () => { setHd(40); setCrest(6); setB(30); setH(38); setHt(3); setMu(0.7); setCoh(100); setResidual(UPLIFT_DRAIN_RESIDUAL); setUpliftOn(true); } },
                  { label: x.pTanpaTiris, apply: () => { setHd(40); setCrest(6); setB(30); setH(38); setHt(3); setMu(0.7); setCoh(100); setResidual(1); setUpliftOn(true); } },
                  { label: x.pHilir, apply: () => { setHd(40); setCrest(6); setB(26); setH(38); setHt(12); setMu(0.7); setCoh(0); setResidual(1); setUpliftOn(true); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={gagal ? undefined : C.water} alert={gagal}>
                {r.tension
                  ? x.tarik
                  : r.fsSliding < FS_SLIDE_MIN
                    ? x.geser
                    : r.fsOverturning < FS_OVER_MIN
                      ? x.guling
                      : x.aman}
              </Flag>
              {dipotong && <Flag alert>{x.dipotong}</Flag>}
            </div>
            {dipotong && (
              <div className="mb-2.5">
                <Note>{x.dipotongNote}</Note>
              </div>
            )}
            {r.tension && (
              <div className="mb-2.5">
                <Note>{x.tarikNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "W", label: x.rW, value: fmt(r.weight, 0), unit: "kN per m" },
                { symbol: "U", label: x.rU, value: fmt(r.uplift, 0), unit: "kN per m", tint: upliftOn ? C.critical : undefined },
                { symbol: "Pu", label: x.rPu, value: fmt(r.thrustUp, 0), unit: "kN per m", tint: C.water },
                { symbol: "Pd", label: x.rPd, value: fmt(r.thrustDown, 0), unit: "kN per m", tint: C.water },
                { symbol: "ΣV", label: x.rV, value: fmt(r.sumV, 0), unit: "kN per m", strong: true },
                { symbol: "ΣH", label: x.rHh, value: fmt(r.sumH, 0), unit: "kN per m", strong: true },
                { symbol: "x̄", label: x.rX, value: fmt(r.resultantAt, 3), unit: "m" },
                { symbol: "e", label: x.rE, value: fmt(r.eccentricity, 3), unit: "m", tint: r.tension ? C.signal : C.critical },
                { symbol: "σt", label: x.rHeel, value: fmt(r.heelStress, 1), unit: "kPa", tint: r.heelStress < 0 ? C.signal : undefined },
                { symbol: "σk", label: x.rToe, value: fmt(r.toeStress, 1), unit: "kPa" },
                { symbol: "FSg", label: x.rFsO, value: fmt(r.fsOverturning, 3), tint: r.fsOverturning < FS_OVER_MIN ? C.signal : undefined, strong: true },
                { symbol: "FSs", label: x.rFsS, value: fmt(r.fsSliding, 3), tint: r.fsSliding < FS_SLIDE_MIN ? C.signal : undefined, strong: true },
                { symbol: "Bmin", label: x.rBase, value: fmt(r.baseNoTension, 2), unit: "m" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(Hd, crest, B, Hp, Htp, mu, coh, residual, upliftOn, lang)}</Note>
          </Block>
        </>
      }
      verification={
        <Verification checks={checksDam(Hd, crest, B, Hp, Htp, mu, coh, residual, upliftOn)} />
      }
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>x̄ =</span>
                <Frac num="W x̄w − U x̄u + Pu H/3 − Pd Ht/3" den="W − U" />
                <span className="ml-5">e = x̄ −</span>
                <Frac num="B" den="2" />
              </Eq>
              <Eq>
                <span>σ =</span>
                <Frac num="ΣV" den="B" />
                <span>(1 ± 6e/B)</span>
                <span className="ml-5">FSs =</span>
                <Frac num="μ ΣV + c B" den="ΣH" />
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `tirisan di ${fmtPlain(DRAIN_AT * 100, 0)} persen lebar dasar dari tumit, air ${fmtPlain(WATER_UNIT_WEIGHT, 2)} kN/m³, beton ${fmtPlain(CONCRETE_UNIT_WEIGHT, 0)} kN/m³, berat air di atas muka hilir diabaikan sebagai cadangan`
                    : `drain at ${fmtPlain(DRAIN_AT * 100, 0)} per cent of the base from the heel, water ${fmtPlain(WATER_UNIT_WEIGHT, 2)} kN/m³, concrete ${fmtPlain(CONCRETE_UNIT_WEIGHT, 0)} kN/m³, the weight of water on the downstream face is left out as a margin`}
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
  Hd: number,
  crest: number,
  B: number,
  H: number,
  Ht: number,
  mu: number,
  coh: number,
  residual: number,
  upliftOn: boolean,
  lang: Lang
): string {
  const r = gravityDam(Hd, crest, B, H, Ht, mu, coh, residual, DRAIN_AT, upliftOn);
  const tanpa = gravityDam(Hd, crest, B, H, Ht, mu, coh, residual, DRAIN_AT, false);
  const hilirNaik = gravityDam(
    Hd, crest, B, H, Math.min(Ht + 6, H), mu, coh, residual, DRAIN_AT, upliftOn
  );
  const lebar = gravityDam(Hd, crest, B + 1, H, Ht, mu, coh, residual, DRAIN_AT, upliftOn);
  const tiris = gravityDam(Hd, crest, B, H, Ht, mu, coh, UPLIFT_DRAIN_RESIDUAL, DRAIN_AT, upliftOn);

  const naikTiris = tiris.fsSliding - r.fsSliding;
  const naikLebar = lebar.fsSliding - r.fsSliding;
  const arah = hilirNaik.fsSliding > r.fsSliding;

  if (lang === "en")
    return `Uplift removes ${fmt(r.uplift, 0)} kilonewtons per metre, ${fmt((r.uplift / Math.max(r.weight, 1e-9)) * 100, 0)} per cent of the concrete weight. Switch it off and the sliding factor goes from ${fmt(r.fsSliding, 2)} to ${fmt(tanpa.fsSliding, 2)}. Widening the base by one metre buys ${fmt(naikLebar, 3)}${residual > UPLIFT_DRAIN_RESIDUAL ? `, while making the drains work buys ${fmt(naikTiris, 3)} and costs far less concrete` : ""}. Now raise the tailwater by six metres: the net thrust falls, yet the sliding factor ${arah ? `rises to ${fmt(hilirNaik.fsSliding, 2)}, because the cohesion on this base does not care about the vertical force` : `FALLS to ${fmt(hilirNaik.fsSliding, 2)}, because the friction lost to the extra uplift exceeds the thrust saved`}.`;
  return `Tekanan angkat menghapus ${fmt(r.uplift, 0)} kilonewton tiap meter, ${fmt((r.uplift / Math.max(r.weight, 1e-9)) * 100, 0)} persen berat betonnya. Matikan ia dan faktor gesernya berpindah dari ${fmt(r.fsSliding, 2)} ke ${fmt(tanpa.fsSliding, 2)}. Melebarkan dasarnya satu meter membeli ${fmt(naikLebar, 3)}${residual > UPLIFT_DRAIN_RESIDUAL ? `, sedangkan membuat tirisannya bekerja membeli ${fmt(naikTiris, 3)} dan jauh lebih sedikit betonnya` : ""}. Sekarang naikkan air hilirnya enam meter: dorongan bersihnya turun, tetapi faktor gesernya ${arah ? `justru naik menjadi ${fmt(hilirNaik.fsSliding, 2)}, karena kohesi pada dasar ini tidak peduli pada gaya tegaknya` : `TURUN menjadi ${fmt(hilirNaik.fsSliding, 2)}, karena gesekan yang hilang akibat tambahan tekanan angkat lebih besar daripada dorongan yang dihemat`}.`;
}
