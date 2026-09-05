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
import { drawNotch } from "@/lib/drawNotch";
import { NOTCH_H_MIN, fmt, notchDischarge } from "@/lib/hydraulics";
import { C } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksNotch } from "@/lib/checks";

const TXT = {
  id: {
    title: "Ambang ukur V",
    sheetTitle: "Ambang ukur V berdinding tipis — tampak muka dan kurva debit",
    dH: "Tinggi muka air di atas takik",
    dT: "Sudut takik",
    p90: "90° (paling umum)",
    p60: "60°",
    p30: "30° (debit kecil)",
    p120: "120° (debit besar)",
    rQ: "Debit",
    rQls: "Debit",
    rCe: "Koefisien debit efektif",
    rHe: "Tinggi efektif",
    rRatio: "Kepekaan dQ/Q per 1 mm",
    inRange: "Dalam rentang",
    outRange: "Di luar rentang",
    note: "Rumus ambang V berdinding tipis berlaku untuk kontraksi penuh, yaitu bila jarak takik ke dasar dan ke dinding saluran cukup besar sehingga aliran mendekat tidak terganggu. Tinggi efektif memakai tambahan kh sebesar 0,85 mm yang memperhitungkan tegangan permukaan dan kekentalan; koreksi kecil ini nyaris tidak berpengaruh pada tinggi muka air besar, tetapi menjadi penting pada tinggi kecil. Di bawah sekitar 5 cm, tegangan permukaan mulai menguasai dan rumus pangkat lima per dua berhenti berlaku — daerah itu digambar dengan garis titik rapat, bukan disembunyikan.",
  },
  en: {
    title: "V-notch weir",
    sheetTitle: "Thin-plate V-notch weir — front view and rating curve",
    dH: "Head over the notch",
    dT: "Notch angle",
    p90: "90° (most common)",
    p60: "60°",
    p30: "30° (small flows)",
    p120: "120° (large flows)",
    rQ: "Discharge",
    rQls: "Discharge",
    rCe: "Effective discharge coefficient",
    rHe: "Effective head",
    rRatio: "Sensitivity dQ/Q per 1 mm",
    inRange: "Within range",
    outRange: "Below valid range",
    note: "The thin-plate V-notch formula applies to fully contracted conditions, that is when the notch sits far enough from the channel bed and walls for the approach flow to be undisturbed. The effective head includes a correction kh of 0.85 mm accounting for surface tension and viscosity; this small correction barely matters at large heads but becomes significant at small ones. Below about 5 cm, surface tension begins to dominate and the five-halves power law stops holding — that region is drawn with fine dots rather than hidden.",
  },
} as const;

const REFS = {
  id: [
    "ISO 1438:2017. Hydrometry — Open channel flow measurement using thin-plate weirs.",
    "Kindsvater, C.E. & Carter, R.W. (1957). Discharge Characteristics of Rectangular Thin-Plate Weirs. Journal of the Hydraulics Division 83(6).",
    "Shen, J. (1981). Discharge Characteristics of Triangular-Notch Thin-Plate Weirs. USGS Water Supply Paper 1617-B.",
    "Bos, M.G. (1989). Discharge Measurement Structures, edisi ke-3. ILRI Publication 20.",
  ],
  en: [
    "ISO 1438:2017. Hydrometry — Open channel flow measurement using thin-plate weirs.",
    "Kindsvater, C.E. & Carter, R.W. (1957). Discharge Characteristics of Rectangular Thin-Plate Weirs. Journal of the Hydraulics Division 83(6).",
    "Shen, J. (1981). Discharge Characteristics of Triangular-Notch Thin-Plate Weirs. USGS Water Supply Paper 1617-B.",
    "Bos, M.G. (1989). Discharge Measurement Structures, 3rd ed. ILRI Publication 20.",
  ],
} as const;

export function AmbangVClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [H, setH] = useState(0.2);
  const [theta, setTheta] = useState(90);

  const { Q, Ce, he, outOfRange } = notchDischarge(H, theta);

  // Kepekaan: seberapa besar galat debit akibat salah baca 1 mm.
  const dQ = notchDischarge(H + 0.001, theta).Q - Q;
  const sensitivity = Q > 0 ? (dQ / Q) * 100 : 0;

  const ref = useCanvas(
    (ctx, w, h) => drawNotch(ctx, w, h, { H, theta, Q, outOfRange }, lang),
    [H, theta, lang]
  );

  return (
    <LabShell
      sheet="FM-01"
      subject={SUBJECTS.FM[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Takik segitiga mengubah satu pembacaan{" "}
            <Term tint={C.water}>tinggi muka air</Term> menjadi debit. Karena
            lebar alirannya ikut mengecil saat muka air turun, alat ini tetap
            peka pada debit kecil — dan itulah sebabnya ia dipakai di saluran
            irigasi kecil dan bangunan ukur lapangan.
          </p>
        ) : (
          <p>
            A triangular notch turns a single reading of{" "}
            <Term tint={C.water}>head</Term> into a discharge. Because the flow
            width narrows as the water level drops, it stays sensitive at low
            flows — which is why it is used in small irrigation canals and field
            gauging structures.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FM-01"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "θ", value: `${theta.toFixed(0)}°`, tint: C.critical },
            { label: "H", value: `${fmt(H, 3)} m`, tint: outOfRange ? C.signal : C.water },
            { label: "Ce", value: fmt(Ce, 4) },
            { label: "Q", value: `${fmt(Q, 4)} m³/s` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="H" label={x.dH} value={H} min={0.005} max={0.45} step={0.001} digits={3} unit="m" onChange={setH} tint={outOfRange ? C.signal : C.water} />
              <InputRow symbol="θ" label={x.dT} value={theta} min={20} max={120} step={1} digits={0} unit="°" onChange={setTheta} tint={C.critical} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.p90, apply: () => setTheta(90) },
                  { label: x.p60, apply: () => setTheta(60) },
                  { label: x.p30, apply: () => setTheta(30) },
                  { label: x.p120, apply: () => setTheta(120) },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5">
              <Flag alert={outOfRange}>
                {outOfRange ? x.outRange : x.inRange}
              </Flag>
            </div>
            <ResultTable
              rows={[
                { symbol: "Q", label: x.rQ, value: fmt(Q, 5), unit: "m³/s", tint: C.water, strong: true },
                { symbol: "Q", label: x.rQls, value: fmt(Q * 1000, 2), unit: "L/s", tint: C.water },
                { symbol: "Ce", label: x.rCe, value: fmt(Ce, 4) },
                { symbol: "he", label: x.rHe, value: fmt(he, 4), unit: "m" },
                { symbol: "—", label: x.rRatio, value: fmt(sensitivity, 2), unit: "%", tint: C.energy },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(H, theta, sensitivity, outOfRange, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksNotch(H, theta)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Q =</span>
                <Frac num="8" den="15" />
                <span>· Ce · √(2g) · tan</span>
                <Frac num="θ" den="2" />
                <span>· he^(5/2)</span>
              </Eq>
              <Eq>
                <span>he = H + kh</span>
                <span className="ml-5 text-ink-3">kh = 0,85 mm</span>
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
  theta: number,
  sensitivity: number,
  outOfRange: boolean,
  lang: Lang
): string {
  const s = sensitivity.toFixed(2);
  const mm = (H * 1000).toFixed(0);

  if (lang === "en") {
    if (outOfRange)
      return `The head is only ${mm} mm, below the ${(NOTCH_H_MIN * 1000).toFixed(0)} mm limit of the formula. Surface tension now holds the nappe against the plate and the discharge no longer follows the five-halves power law. The rating curve is drawn dotted here for exactly that reason — the number is still shown, but it should not be trusted.`;
    if (H < 0.1)
      return `A misreading of just 1 mm changes the discharge by ${s} per cent. At low heads a V-notch is very sensitive, which is its strength for measuring small flows and at the same time the reason the gauge must be read carefully and set truly level.`;
    if (theta > 100)
      return `A wide notch passes much more flow at the same head, but sensitivity drops: 1 mm of reading error is now worth ${s} per cent. Wide notches suit large flows; for small canals a narrower angle gives a better reading.`;
    return `At this head a 1 mm reading error costs ${s} per cent in discharge. Note how steeply the rating curve rises: because discharge follows the five-halves power of head, doubling the head multiplies the flow by about 5.7 times.`;
  }

  if (outOfRange)
    return `Tinggi muka airnya hanya ${mm} mm, di bawah batas ${(NOTCH_H_MIN * 1000).toFixed(0)} mm yang menjadi rentang keberlakuan rumus. Pada tinggi sekecil ini tegangan permukaan menahan tirai air menempel pada pelat, dan debitnya tidak lagi mengikuti pangkat lima per dua. Kurva debit di daerah itu digambar titik rapat justru karena itu — angkanya tetap ditampilkan, tetapi tidak boleh dipercaya.`;
  if (H < 0.1)
    return `Salah baca 1 mm saja sudah mengubah debit sebesar ${s} persen. Pada tinggi muka air rendah ambang V sangat peka, dan itu sekaligus kekuatannya untuk mengukur debit kecil serta alasan mengapa alat ukurnya harus dibaca teliti dan dipasang benar-benar datar.`;
  if (theta > 100)
    return `Takik yang lebar meloloskan debit jauh lebih besar pada tinggi muka air yang sama, tetapi kepekaannya turun: galat baca 1 mm kini bernilai ${s} persen. Takik lebar cocok untuk debit besar; untuk saluran kecil, sudut yang lebih sempit memberi pembacaan yang lebih baik.`;
  return `Pada tinggi muka air ini, galat baca 1 mm berarti ${s} persen pada debit. Perhatikan betapa curam kurva debitnya naik: karena debit mengikuti pangkat lima per dua dari tinggi muka air, melipatduakan tinggi berarti melipatgandakan debit sekitar 5,7 kali.`;
}
