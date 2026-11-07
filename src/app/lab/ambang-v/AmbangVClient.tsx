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
  SentuhContoh,
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
  NOTCH_THETA_MAX,
  NOTCH_THETA_MIN,
  fmt,
  notchDischarge,
  notchKh,
  type NotchOutOfRange,
} from "@/lib/hydraulics";
import { C } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksNotch } from "@/lib/checks";
import type { ParamDef } from "@/lib/rentang";
import { LembarPraktikum } from "@/components/Praktikum";
import {
  KOLOM_EKSPOR_FM01,
  KOLOM_FM01,
  SIGMA_NOL,
  SKALA_PENGUKUR,
  VOLUME_MIN_L,
  WAKTU_MIN_S,
  catatFm01,
  ringkasFm01,
  volumeTampungMin,
  type BacaanFm01,
} from "@/data/praktikum/fm01";
import { qTeoriAmbangV } from "@/lib/praktikum";
import type { LangkahHitung, ResultRow } from "@/components/ui";

/** Penggeser H dipakai di blok masukan dan di lembar pengamatan. */
const P_H: ParamDef = { min: 0.005, max: 0.45, step: 0.001, digits: 3 };

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
    pHAtur: "Tinggi muka air di atas takik (atur lewat katup)",
    pCdKal: "Cd kalibrasi, kuadrat terkecil lewat titik asal (± galat baku)",
    pCdRerata: "Cd rerata dari tiap bacaan",
    pSd: "Simpangan baku Cd tiap bacaan",
    pCe: "Ce model lembar pada sudut ini",
    pM: "Pangkat kalibrasi Q = K·Hᵐ (teori 2,5)",
    pK: "Tetapan kalibrasi K (Q dalam m³/s, H dalam m)",
    pR2: "Koefisien determinasi regresi log-log",
    pN: "Jumlah bacaan",
    pSatu: "Simpangan, galat baku, dan pangkat m butuh paling sedikit dua bacaan.",
    pCdBeda:
      "Cd kalibrasi = ΣQₜ·Q / ΣQₜ²: bacaan debit besar lebih berbobot; Cd rerata memberi bobot sama pada tiap bacaan, sehingga bacaan H kecil (galat relatif besar) ikut menarik.",
    pMKh: (kh: string) =>
      `m dihitung dari Q terhadap H bacaan, bukan terhadap he = H + kh. Karena kh = ${kh} mm, kemiringan log-log yang benar sedikit di bawah 2,5, yaitu 2,5·H/(H + kh) (makin dekat ke 2,5 bila H besar). Penyimpangan lain dari nilai itu, ke atas maupun ke bawah, berasal dari galat baca dan nol datum.`,
    pCampur:
      "Baris di tabel memakai lebih dari satu sudut takik. Cd kalibrasi dihitung dengan Q teori tiap baris, tetapi pangkat m tidak dihitung karena titik dari dua pelat tidak berada pada satu lengkung debit; kosongkan tabel untuk seri baru.",
    pRendah: (k: number, s: string) =>
      `${k} bacaan dengan H di bawah ${s} mm, di luar batas rumus lembar ini (ISO 1438). Di laboratorium, pada tinggi sekecil itu tegangan permukaan ikut menahan tirai air sehingga Cd bacaan tidak mewakili alat; model lembar ini tetap memakai rumus yang sama, jadi Cd di tabel tampak wajar. Angkanya tidak dipotong dan tetap masuk ringkasan; hapus barisnya bila ingin kalibrasi hanya dari rentang yang berlaku.`,
    pLuarSkala: (k: number, s: string) =>
      `${k} bacaan dengan H di atas ${s} mm, melewati rentang pengukur titik bangku praktikum (Armfield F1-13). Angkanya tidak dipotong; di laboratorium bacaan ini butuh pengukur yang lebih panjang.`,
    hHeP: "Tinggi efektif dari bacaan H",
    hQt: "Debit teori (Cd = 1)",
    hCdP: "Koefisien debit bacaan ini",
    langkahP: [
      "Pasang pelat takik dan catat sudutnya θ. Jangan ganti pelat selama satu seri, supaya Cd kalibrasi berlaku untuk satu takik.",
      "Alirkan air sampai melimpah, tutup katup, lalu tunggu muka air tenang tepat setinggi puncak takik. Turunkan ujung pengukur titik sampai menyentuh muka air: itulah nol datum H.",
      "Buka katup dan tunggu aliran tunak: muka air hulu tidak lagi berubah dan tirai air lepas bebas dari pelat.",
      "Mulai dari H kecil. Tekan Catat bacaan: H dibaca dengan pengukur titik, lalu debit ditampung di tangki ukur.",
      "Naikkan debit bertahap dan tunggu tunak tiap kali. Catat paling sedikit lima keadaan dari H kecil ke H besar.",
      "Bandingkan Cd tiap baris dengan Cd kalibrasi dan m dengan 2,5. Periksa baris yang menyimpang jauh, hapus bila salah catat, lalu unduh tabel sebelum menutup halaman.",
    ],
    aPengukur:
      "Pengukur titik (Armfield F1-13): rentang 0–150 mm, akurasi 0,1 mm; bacaan dibulatkan ke 0,1 mm. Galat baca σ = 0,1 mm (usulan, belum ditelaah). H diukur dari nol datum di puncak takik.",
    aNol: (s: string) =>
      `Nol datum disetel sekali tiap benih dengan galat tetap σ = ${s} mm, jadi semua bacaan satu seri bergeser sama. Ini galat sistematik: tidak mengecil dengan menambah bacaan. Angkanya usulan tanpa sumber, belum ditelaah.`,
    aVolumetrik: (q: string, v: string) =>
      `Debit cara volumetrik (tangki ukur dan stopwatch): galat σ = 1 % dari debit (usulan, belum ditelaah). Angka ini berlaku bila volume tampung paling sedikit ${VOLUME_MIN_L} L dan waktu tampung paling sedikit ${WAKTU_MIN_S} s. Pada keadaan sekarang Q = ${q} L/dtk, jadi tampung paling sedikit ${v} L.`,
    aPotong:
      "Bacaan tidak dipotong. H di bawah 50 mm (batas rumus lembar) dan H di atas 150 mm (rentang pengukur titik) tetap dicatat dan ditandai di ringkasan.",
    note: "Rumus ambang V berdinding tipis berlaku untuk kontraksi penuh, yaitu bila jarak takik ke dasar dan ke dinding saluran cukup besar sehingga aliran mendekat tidak terganggu. Tinggi efektif memakai tambahan kh yang memperhitungkan tegangan permukaan dan kekentalan, dibaca dari kurva kh terhadap sudut takik (USBR Water Measurement Manual Gb. 7-6a: 0,85 mm pada 90°, 2,1 mm pada 30°); koreksi kecil ini nyaris tidak berpengaruh pada tinggi muka air besar, tetapi menjadi penting pada tinggi kecil. Di bawah sekitar 5 cm, tegangan permukaan mulai menguasai dan rumus pangkat lima per dua berhenti berlaku — daerah itu digambar dengan garis titik rapat, bukan disembunyikan.",
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
    pHAtur: "Head over the notch (set with the valve)",
    pCdKal: "Calibrated Cd, least squares through the origin (± standard error)",
    pCdRerata: "Mean Cd of the individual readings",
    pSd: "Standard deviation of the individual Cd",
    pCe: "Sheet model Ce at this angle",
    pM: "Calibration exponent Q = K·Hᵐ (theory 2.5)",
    pK: "Calibration constant K (Q in m³/s, H in m)",
    pR2: "Coefficient of determination of the log-log fit",
    pN: "Number of readings",
    pSatu: "The spread, standard error and exponent m need at least two readings.",
    pCdBeda:
      "Calibrated Cd = ΣQₜ·Q / ΣQₜ²: readings at large discharge carry more weight; the mean Cd weights every reading equally, so readings at small H (large relative error) pull on it as much as the rest.",
    pMKh: (kh: string) =>
      `m is fitted to Q against the read H, not against he = H + kh. Because kh = ${kh} mm, the true log-log slope is slightly below 2.5, namely 2.5·H/(H + kh) (closer to 2.5 at large H). Any other departure from that value, up or down, comes from reading error and the datum zero.`,
    pCampur:
      "Rows in the table use more than one notch angle. The calibrated Cd uses each row's theoretical Q, but the exponent m is not fitted because points from two plates do not lie on one rating curve; clear the table for a new series.",
    pRendah: (k: number, s: string) =>
      `${k} ${k === 1 ? "reading" : "readings"} with H below ${s} mm, outside the limit of this sheet's formula (ISO 1438). In the laboratory, surface tension helps hold the nappe at such small heads, so the Cd of those readings does not represent the weir; this sheet's model keeps the same formula there, so the Cd in the table looks normal. The numbers are not clipped and stay in the summary; delete those rows to calibrate only over the valid range.`,
    pLuarSkala: (k: number, s: string) =>
      `${k} ${k === 1 ? "reading" : "readings"} with H above ${s} mm, past the range of the bench point gauge (Armfield F1-13). The numbers are not clipped; in the laboratory ${k === 1 ? "this reading needs" : "these readings need"} a longer gauge.`,
    hHeP: "Effective head from the read H",
    hQt: "Theoretical discharge (Cd = 1)",
    hCdP: "Discharge coefficient of this reading",
    langkahP: [
      "Fit the notch plate and note its angle θ. Keep the plate for one series, so the calibrated Cd belongs to one notch.",
      "Run water until it spills, close the valve, and wait until the water settles exactly level with the notch vertex. Lower the point gauge tip until it touches the surface: that is the datum zero for H.",
      "Open the valve and wait for steady flow: the upstream level no longer changes and the nappe springs clear of the plate.",
      "Start at a small H. Press Record reading: H is read with the point gauge, then the flow is collected in the measuring tank.",
      "Raise the flow in steps and wait for steady flow each time. Record at least five states from small H to large H.",
      "Compare each row's Cd with the calibrated Cd and m with 2.5. Check any row far off, delete it if it was misrecorded, then download the table before closing the page.",
    ],
    aPengukur:
      "Point gauge (Armfield F1-13): range 0–150 mm, accuracy 0.1 mm; readings are rounded to 0.1 mm. Reading error σ = 0.1 mm (proposed, not yet reviewed). H is measured from the datum zero at the notch vertex.",
    aNol: (s: string) =>
      `The datum zero is set once per seed with a fixed error σ = ${s} mm, so every reading in one series is shifted by the same amount. This is a systematic error: it does not shrink with more readings. The figure is proposed without a source, not yet reviewed.`,
    aVolumetrik: (q: string, v: string) =>
      `Volumetric discharge (measuring tank and stopwatch): error σ = 1 % of the discharge (proposed, not yet reviewed). The figure holds when at least ${VOLUME_MIN_L} L is collected over at least ${WAKTU_MIN_S} s. At the current state Q = ${q} L/s, so collect at least ${v} L.`,
    aPotong:
      "Readings are not clipped. H below 50 mm (the formula limit of this sheet) and H above 150 mm (the point gauge range) are still recorded and flagged in the summary.",
    note: "The thin-plate V-notch formula applies to fully contracted conditions, that is when the notch sits far enough from the channel bed and walls for the approach flow to be undisturbed. The effective head includes a correction kh for surface tension and viscosity, read from the kh versus notch angle curve (USBR Water Measurement Manual Fig. 7-6a: 0.85 mm at 90°, 2.1 mm at 30°); this small correction barely matters at large heads but becomes significant at small ones. Below about 5 cm, surface tension begins to dominate and the five-halves power law stops holding — that region is drawn with fine dots rather than hidden.",
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
  // Penggeser H di lembar pengamatan memadamkan tanda contoh di blok masukan.
  const sentuh = useRef<() => void>(() => {});

  const { Q, Ce, he, kh, outOfRange, reason } = notchDischarge(H, theta);
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
      isi: `${fmt(H, 3)} + ${fmt(kh, 5)}`,
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
            <SentuhContoh sentuh={sentuh} />
            <InputTable>
              <InputRow symbol="H" label={x.dH} value={H} {...P_H} unit="m" onChange={setH} tint={hRendah || hTinggi ? C.signal : C.water} />
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
        <>
        <div className="mb-9">
          <LembarPraktikum<BacaanFm01>
            kode="FM-01"
            kolom={KOLOM_FM01}
            kolomEkspor={KOLOM_EKSPOR_FM01}
            catat={(rng) => catatFm01({ H, theta }, rng)}
            masukan={
              <table className="data">
                <tbody>
                  <InputRow
                    symbol="H"
                    label={x.pHAtur}
                    value={H}
                    {...P_H}
                    unit="m"
                    onChange={(v) => {
                      sentuh.current();
                      setH(v);
                    }}
                    tint={hRendah || hTinggi ? C.signal : C.water}
                  />
                </tbody>
              </table>
            }
            ringkasan={(rows) => ringkasanFm01(rows, lang)}
            penanda={(rows) => penandaFm01(rows, lang)}
            hitungan={(b) => hitunganFm01(b, lang)}
            langkah={TXT.id.langkahP.map((id, i) => ({ id, en: TXT.en.langkahP[i] }))}
            alat={
              <>
                <p>{x.aPengukur}</p>
                <p>{x.aNol(fmt(SIGMA_NOL * 1000, 1))}</p>
                <p>{x.aVolumetrik(fmt(Q * 1000, 3), fmt(volumeTampungMin(Q), 0))}</p>
                <p>{x.aPotong}</p>
              </>
            }
            namaBerkas="fm01-ambang-v-pengamatan"
          />
        </div>
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
                <span className="ml-5 text-ink-3">kh(θ) = {fmt(kh * 1000, 2)} mm</span>
              </Eq>
            </>
          }
          note={x.note}
          refs={[...REFS[lang]]}
        />
        </>
      }
    />
  );
}

/* Lembar pengamatan FM-01: ringkasan, penanda, dan langkah hitung dari
   fungsi praktikum.ts lewat src/data/praktikum/fm01.ts. */

function ringkasanFm01(rows: BacaanFm01[], lang: Lang): ResultRow[] {
  const x = TXT[lang];
  const { kal, pangkat, ce, campur } = ringkasFm01(rows);
  return [
    { symbol: "Cd", label: x.pCdKal, value: `${fmt(kal.cd, 4)} ± ${fmt(kal.seCd, 4)}`, strong: true },
    { symbol: "C̄d", label: x.pCdRerata, value: fmt(kal.cdRerata, 4), strong: true },
    { symbol: "s", label: x.pSd, value: fmt(kal.cdSd, 4) },
    ...(campur ? [] : [{ symbol: "Ce", label: x.pCe, value: fmt(ce, 4) }]),
    ...(campur
      ? []
      : [
          { symbol: "m", label: x.pM, value: fmt(pangkat.m, 3), strong: true, tint: C.water },
          { symbol: "K", label: x.pK, value: fmt(pangkat.K, 3) },
          { symbol: "r²", label: x.pR2, value: fmt(pangkat.r2, 5) },
        ]),
    { symbol: "n", label: x.pN, value: String(kal.n) },
  ];
}

function penandaFm01(rows: BacaanFm01[], lang: Lang): string[] {
  const x = TXT[lang];
  const s = ringkasFm01(rows);
  return [
    ...(s.kal.n === 1 ? [x.pSatu] : [x.pCdBeda]),
    ...(s.kal.n > 1 && !s.campur ? [x.pMKh(fmt(notchKh(rows[0].theta) * 1000, 2))] : []),
    ...(s.campur ? [x.pCampur] : []),
    ...(s.rendah > 0 ? [x.pRendah(s.rendah, fmt(NOTCH_H_MIN * 1000, 0))] : []),
    ...(s.luarSkala > 0 ? [x.pLuarSkala(s.luarSkala, fmt(SKALA_PENGUKUR * 1000, 0))] : []),
  ];
}

function hitunganFm01(b: BacaanFm01, lang: Lang): LangkahHitung[] {
  const x = TXT[lang];
  const kh = notchKh(b.theta);
  const he = b.H + kh;
  const tan2 = Math.tan((b.theta * Math.PI) / 360);
  const qt = qTeoriAmbangV(b.H, b.theta);
  return [
    {
      judul: x.hHeP,
      rumus: <span>he = H + kh(θ)</span>,
      isi: `${fmt(b.H * 1000, 1)} + ${fmt(kh * 1000, 2)}`,
      hasil: fmt(he * 1000, 2),
      satuan: "mm",
    },
    {
      judul: x.hQt,
      rumus: (<><span>Qₜ =</span><Frac num="8" den="15" /><span>· √(2g) · tan( θ/2 ) · he^{fmt(2.5, 1)}</span></>),
      isi: `8/15 · √( 2 · ${fmt(G, 2)} ) · ${fmt(tan2, 4)} · ${fmt(he, 5)}^${fmt(2.5, 1)} × 1000 ${lang === "en" ? "(he in m)" : "(he dalam m)"}`,
      hasil: fmt(qt * 1000, 3),
      satuan: lang === "en" ? "L/s" : "L/dtk",
      tint: C.water,
    },
    {
      judul: x.hCdP,
      rumus: (<><span>Cd =</span><Frac num={lang === "en" ? "Q measured" : "Q ukur"} den="Qₜ" /></>),
      isi: `${fmt(b.Q * 1000, 3)} / ${fmt(qt * 1000, 3)}`,
      hasil: fmt(b.Q / qt, 4),
    },
  ];
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
