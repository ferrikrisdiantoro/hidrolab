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
import { drawNotch } from "@/lib/drawNotch";
import {
  G,
  NOTCH_H_MAX,
  NOTCH_H_MIN,
  NOTCH_KH,
  NOTCH_THETA_MAX,
  NOTCH_THETA_MIN,
  fmt,
  notchDischarge,
  type NotchOutOfRange,
} from "@/lib/hydraulics";
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
    p120: "100° (debit besar)",
    rQ: "Debit",
    rQls: "Debit dalam liter per detik",
    rCe: "Koefisien debit efektif",
    rHe: "Tinggi efektif",
    rRatio: "Kepekaan dQ/Q per 1 mm",
    inRange: "Dalam rentang",
    outRange: "Di luar rentang",
    outLow: "Tinggi di bawah 5 cm",
    outHigh: "Tinggi di atas 38 cm",
    outAngle: "Sudut di luar 20° sampai 100°",
    indikatif: "indikatif",
    bandTegang: "Tegangan permukaan menguasai",
    bandKalibrasi: "Rentang kalibrasi",
    bandAtas: "Di atas kalibrasi",
    bandCe: "Ce terbitan",
    bandCeEks: "Ce ekstrapolasi",
    hHe: "Tinggi efektif",
    hCe: "Koefisien debit efektif, fungsi sudut",
    hQ: "Debit",
    hS: "Kepekaan terhadap salah baca 1 mm",
    hRendah: "H di bawah 5 cm: rumus pangkat 5/2 tidak berlaku",
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
    p120: "100° (large flows)",
    rQ: "Discharge",
    rQls: "Discharge in litres per second",
    rCe: "Effective discharge coefficient",
    rHe: "Effective head",
    rRatio: "Sensitivity dQ/Q per 1 mm",
    inRange: "Within range",
    outRange: "Outside valid range",
    outLow: "Head below 5 cm",
    outHigh: "Head above 38 cm",
    outAngle: "Angle outside 20° to 100°",
    indikatif: "indicative",
    bandTegang: "Surface tension dominates",
    bandKalibrasi: "Calibrated range",
    bandAtas: "Above calibration",
    bandCe: "Published Ce",
    bandCeEks: "Ce extrapolated",
    hHe: "Effective head",
    hCe: "Effective discharge coefficient, a function of angle",
    hQ: "Discharge",
    hS: "Sensitivity to a 1 mm misreading",
    hRendah: "H below 5 cm: the five-halves power law does not hold",
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

  const { Q, Ce, he, outOfRange, reason } = notchDischarge(H, theta);
  /* Model memberi satu sebab saja, berurutan tinggi lalu sudut. Sudut
     diperiksa sendiri supaya H di luar rentang tidak menyembunyikan Ce
     yang juga ekstrapolasi. */
  const hRendah = reason === "tinggi-rendah";
  const hTinggi = reason === "tinggi-tinggi";
  const sudutLuar = theta < NOTCH_THETA_MIN || theta > NOTCH_THETA_MAX;
  const sebutan = hRendah ? x.outLow : hTinggi ? x.outHigh : sudutLuar ? x.outAngle : x.inRange;

  // Kepekaan: seberapa besar galat debit akibat salah baca 1 mm.
  const dQ = notchDischarge(H + 0.001, theta).Q - Q;
  const sensitivity = Q > 0 ? (dQ / Q) * 100 : 0;
  const Q1mm = Q + dQ;
  /* Di bawah 5 cm rumusnya tidak berlaku sama sekali: debit "—". Di atas
     kalibrasi atau dengan Ce ekstrapolasi angkanya tetap ditulis, bertanda
     indikatif dengan merah sinyal. */
  const sah = (v: number) => (hRendah ? NaN : v);
  const tintQ = outOfRange ? C.signal : C.water;
  const tandaQ = outOfRange && !hRendah ? ` (${x.indikatif})` : "";

  const ref = useCanvas(
    (ctx, w, h) => drawNotch(ctx, w, h, { H, theta, Q, outOfRange, angleOutOfRange: reason === "sudut" }, lang),
    [H, theta, lang]
  );

  const tan2 = Math.tan((theta * Math.PI) / 360);
  const langkah = [
    {
      judul: x.hHe,
      rumus: <span>he = H + kh</span>,
      isi: `${fmt(H, 3)} + ${fmt(NOTCH_KH, 5)}`,
      hasil: fmt(he, 4),
      satuan: "m",
    },
    {
      judul: x.hCe,
      rumus: <span>Ce = {fmt(0.6072, 4)} − {fmt(0.000874, 6)} θ + {fmt(0.0000061, 7)} θ²</span>,
      isi: `${fmt(0.6072, 4)} − ${fmt(0.000874, 6)} · ${fmt(theta, 0)} + ${fmt(0.0000061, 7)} · ${fmt(theta, 0)}²`,
      hasil: fmt(Ce, 4),
      tint: sudutLuar ? C.signal : undefined,
    },
    {
      judul: hRendah ? `${x.hQ}: ${x.hRendah}` : `${x.hQ}${tandaQ}`,
      rumus: (<><span>Q =</span><Frac num="8" den="15" /><span>· Ce · √(2g) · tan( θ/2 ) · he^{fmt(2.5, 1)}</span></>),
      isi: hRendah
        ? "—"
        : `8/15 · ${fmt(Ce, 4)} · √( 2 · ${fmt(G, 2)} ) · ${fmt(tan2, 4)} · ${fmt(he, 4)}^${fmt(2.5, 1)} = ${fmt(Q, 5)} m³/s`,
      hasil: fmt(sah(Q * 1000), 2),
      satuan: hRendah ? undefined : "l/s",
      tint: tintQ,
    },
    {
      judul: x.hS,
      rumus: (<><span>s =</span><Frac num="Q( H + 1 mm ) − Q" den="Q" /></>),
      isi: hRendah ? "—" : `( ${fmt(Q1mm * 1000, 3)} − ${fmt(Q * 1000, 3)} ) / ${fmt(Q * 1000, 3)}`,
      hasil: fmt(sah(sensitivity), 2),
      satuan: hRendah ? undefined : "%",
      tint: C.energy,
    },
  ];

  const kartu = keadaan(H, theta, Q, sensitivity, reason, sudutLuar, sebutan, lang);

  return (
    <LabShell
      status={
        /* Batas pita dari NOTCH_H_MIN/MAX dan NOTCH_THETA_MIN/MAX
           (ISO 1438:2017). Sumbu H 0,005 sampai 0,45 m dan θ 20 sampai 120°
           sama dengan rentang penggeser. */
        <div className="flex flex-col gap-2">
          <RegimeScale
            symbol="H"
            value={H}
            invalid={hRendah || hTinggi}
            scale="log"
            digits={3}
            bands={[
              { from: 0.005, to: NOTCH_H_MIN, label: x.bandTegang, tone: "invalid" },
              { from: NOTCH_H_MIN, to: NOTCH_H_MAX, label: x.bandKalibrasi, tone: "water" },
              { from: NOTCH_H_MAX, to: 0.45, label: x.bandAtas, tone: "invalid" },
            ]}
          />
          <RegimeScale
            symbol="θ"
            value={theta}
            invalid={sudutLuar}
            digits={0}
            bands={[
              { from: 20, to: NOTCH_THETA_MAX, label: x.bandCe, tone: "neutral" },
              { from: NOTCH_THETA_MAX, to: 120, label: x.bandCeEks, tone: "invalid" },
            ]}
          />
        </div>
      }
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
            { label: "θ", value: `${fmt(theta, 0)}°`, tint: sudutLuar ? C.signal : C.critical },
            /* Merah hanya bila H sendiri di luar rentang, bukan bila sudutnya. */
            { label: "H", value: `${fmt(H, 3)} m`, tint: hRendah || hTinggi ? C.signal : C.water },
            { label: "Ce", value: fmt(Ce, 4) },
            { label: "Q", value: hRendah ? "—" : `${fmt(Q, 4)} m³/s` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="H" label={x.dH} value={H} min={0.005} max={0.45} step={0.001} digits={3} unit="m" onChange={setH} tint={hRendah || hTinggi ? C.signal : C.water} />
              <InputRow symbol="θ" label={x.dT} value={theta} min={20} max={120} step={1} digits={0} unit="°" onChange={setTheta} tint={C.critical} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.p90, apply: () => setTheta(90) },
                  { label: x.p60, apply: () => setTheta(60) },
                  { label: x.p30, apply: () => setTheta(30) },
                  { label: x.p120, apply: () => setTheta(100) },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                /* Angka besar dalam l/s, lebih terbaca daripada m³/s lima desimal. */
                { symbol: "Q", label: `${x.rQls}${tandaQ}`, value: fmt(sah(Q * 1000), 2), unit: hRendah ? undefined : "l/s", tint: tintQ, strong: true },
                { symbol: "Q", label: x.rQ, value: fmt(sah(Q), 5), unit: hRendah ? undefined : "m³/s", tint: tintQ },
                { symbol: "Ce", label: x.rCe, value: fmt(Ce, 4), tint: sudutLuar ? C.signal : undefined },
                { symbol: "he", label: x.rHe, value: fmt(he, 4), unit: "m" },
                { symbol: "s", label: x.rRatio, value: fmt(sah(sensitivity), 2), unit: hRendah ? undefined : "%", tint: C.energy },
              ]}
            />
            <div className="mt-3">
              <Hitungan langkah={langkah} />
            </div>
          </Block>

          <StateCard tone={outOfRange || sudutLuar ? "invalid" : "water"} badge={sebutan} state={kartu.state} notice={kartu.notice} />
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
                <span className="ml-5 text-ink-3">kh = {fmt(NOTCH_KH * 1000, 2)} mm</span>
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
 * Kalimat keadaan dan butir. Cabang lama "theta > 100" tidak pernah
 * tercapai (θ di atas 100° sudah menjadi reason "sudut" lebih dulu), jadi
 * dihapus; sudut di luar rentang kini menjadi butir sendiri dan ikut
 * tampil bila H juga di luar rentang.
 */
function keadaan(
  H: number,
  theta: number,
  Q: number,
  sensitivity: number,
  reason: NotchOutOfRange,
  sudutLuar: boolean,
  sebutan: string,
  lang: Lang
): { state: string; notice: string[] } {
  const en = lang === "en";
  const s = fmt(sensitivity, 2);
  const mm = fmt(H * 1000, 0);
  const notice: string[] = [];

  if (reason === "tinggi-rendah")
    notice.push(
      en
        ? `The head is only ${mm} mm, below the ${fmt(NOTCH_H_MIN * 1000, 0)} mm limit of the formula. Surface tension now holds the nappe against the plate and the discharge no longer follows the five-halves power law, so the discharge is shown as “—” and the rating curve is drawn dotted there.`
        : `Tinggi muka airnya hanya ${mm} mm, di bawah batas ${fmt(NOTCH_H_MIN * 1000, 0)} mm yang menjadi rentang keberlakuan rumus. Pada tinggi sekecil ini tegangan permukaan menahan tirai air menempel pada pelat, dan debitnya tidak lagi mengikuti pangkat lima per dua, jadi debitnya ditulis “—” dan kurva debit di daerah itu digambar titik rapat.`
    );
  if (reason === "tinggi-tinggi")
    notice.push(
      en
        ? `The head is ${mm} mm, above the ${fmt(NOTCH_H_MAX * 1000, 0)} mm limit of the calibration behind the formula. Nothing dramatic happens to the physics up there, but no published measurement backs the number, so the curve is drawn dotted and the discharge is indicative: check it against a rating obtained on site.`
        : `Tinggi muka airnya ${mm} mm, di atas batas ${fmt(NOTCH_H_MAX * 1000, 0)} mm dari kalibrasi yang mendasari rumus. Fisikanya tidak berubah drastis di sana, tetapi tidak ada pengukuran terbitan yang mendukung angkanya, jadi kurvanya digambar titik rapat dan debitnya indikatif: cocokkan dengan lengkung debit yang diukur di lapangan.`
    );
  if (sudutLuar)
    notice.push(
      en
        ? `The notch angle is ${fmt(theta, 0)}°, outside the ${fmt(NOTCH_THETA_MIN, 0)}° to ${fmt(NOTCH_THETA_MAX, 0)}° range for which Ce has been published. The coefficient shown is an extrapolation of the curve, so the discharge is indicative only.`
        : `Sudut takiknya ${fmt(theta, 0)}°, di luar rentang ${fmt(NOTCH_THETA_MIN, 0)}° sampai ${fmt(NOTCH_THETA_MAX, 0)}° tempat koefisien Ce diterbitkan. Koefisien yang tampil adalah ekstrapolasi kurvanya, jadi debitnya hanya indikatif.`
    );

  if (reason === "tinggi-rendah")
    return {
      state: en
        ? `${sebutan}: H ${mm} mm, the formula does not apply.`
        : `${sebutan}: H ${mm} mm, rumusnya tidak berlaku.`,
      notice,
    };

  if (H < 0.1)
    notice.push(
      en
        ? `At low heads a V-notch is very sensitive, which is its strength for measuring small flows and at the same time the reason the gauge must be read carefully and set truly level.`
        : `Pada tinggi muka air rendah ambang V sangat peka, dan itu sekaligus kekuatannya untuk mengukur debit kecil serta alasan mengapa alat ukurnya harus dibaca teliti dan dipasang benar-benar datar.`
    );
  notice.push(
    en
      ? `Note how steeply the rating curve rises: because discharge follows the five-halves power of head, doubling the head multiplies the flow by about ${fmt(Math.pow(2, 2.5), 1)} times.`
      : `Perhatikan betapa curam kurva debitnya naik: karena debit mengikuti pangkat lima per dua dari tinggi muka air, melipatduakan tinggi berarti melipatgandakan debit sekitar ${fmt(Math.pow(2, 2.5), 1)} kali.`
  );

  if (reason !== null || sudutLuar)
    return {
      state: en
        ? `${sebutan}: H ${mm} mm, Q ${fmt(Q * 1000, 2)} l/s (indicative).`
        : `${sebutan}: H ${mm} mm, Q ${fmt(Q * 1000, 2)} l/s (indikatif).`,
      notice,
    };

  return {
    state: en
      ? `H ${mm} mm: Q ${fmt(Q * 1000, 2)} l/s; a 1 mm misreading = ${s} %.`
      : `H ${mm} mm: Q ${fmt(Q * 1000, 2)} l/s; salah baca 1 mm = ${s} %.`,
    notice,
  };
}
