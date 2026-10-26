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
  type RegimeBand,
} from "@/components/ui";
import { DragLayer, type HandleSpec } from "@/components/DragLayer";
import { usePlate } from "@/lib/usePlate";
import type { ParamDef } from "@/lib/rentang";
import {
  drawStructure,
  type StructureLine,
  type StructureSpec,
} from "@/lib/drawStructure";
import {
  G,
  OGEE_CAVITATION_LIMIT,
  OGEE_CD_DESIGN,
  OGEE_RATIO_MAX,
  OGEE_RATIO_MIN,
  fmt,
  fmtPlain,
  ogeeWeir,
  wesCrest,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksOgee } from "@/lib/checks";

const TXT = {
  id: {
    title: "Bendung ogee",
    sheetTitle: "Bendung ogee — bentuk mercu WES dan kapasitas luapannya",
    dH: "Tinggi muka air di atas mercu",
    dHd: "Tinggi energi rancangan",
    dL: "Panjang mercu",
    dP: "Tinggi mercu di atas dasar hulu",
    pRancang: "Pada tinggi rancangan",
    pRendah: "Jauh di bawah rancangan",
    pBanjir: "Banjir di atas rancangan",
    gH: "Tinggi muka air h, seret muka air hulu naik atau turun",
    gP: "Tinggi mercu P, seret dasar hulu naik atau turun",
    rQ: "Debit",
    rHe: "Tinggi energi",
    rCd: "Koefisien debit",
    rRatio: "Perbandingan He terhadap Hd",
    rVa: "Kecepatan datang",
    rP: "Tekanan di mercu",
    rQperM: "Debit per meter mercu",
    kavitasi: "Risiko kavitasi di mercu",
    kavitasiNote:
      "Tekanan di mercu turun di bawah enam meter kolom air di bawah tekanan udara. Pada tekanan serendah itu gelembung uap terbentuk di permukaan beton, dan runtuhnya gelembung itu menggerus permukaan dengan cepat: pelimpah yang berulang kali dilewati banjir jauh di atas rancangannya dapat kehilangan beberapa sentimeter beton dalam satu musim. Yang perlu diperhatikan, koefisien debitnya justru NAIK pada keadaan ini, sehingga bendungnya tampak bekerja lebih baik tepat ketika ia sedang merusak dirinya sendiri. Naikkan tinggi rancangannya, atau terima bahwa mercunya perlu dilapisi bahan tahan gerus.",
    takKendali: "Mercu tidak mengendalikan aliran",
    takKendaliNote:
      "Tinggi muka air terlalu besar dibanding tinggi mercunya, sehingga kecepatan datang di hulu menjadi sebesar kecepatan di mercu dan tidak ada tinggi energi yang memenuhi persamaannya. Yang ada di sana bukan bendung melainkan penyempitan saluran, dan rumus ambang tidak berlaku sama sekali. Tinggikan mercunya, atau turunkan tinggi muka airnya.",
    luar: "Di luar rentang bagan",
    luarKecil:
      "Tinggi energi kurang dari seperlima tinggi rancangan. Pada tinggi serendah itu tirai menempel erat ke muka mercu dan tegangan permukaan mulai berperan, sehingga koefisien debit yang dihitung dari bagan tidak lagi dapat dipercaya.",
    luarBesar:
      "Tinggi energi lebih dari tiga kali tinggi rancangan. Bagan koefisien debit tidak diterbitkan sejauh itu, dan tekanan negatif di mercu sudah jauh melewati batas yang biasa diterima dalam perancangan.",
    bBawahBagan: "Di bawah rentang bagan",
    bBawahRancang: "Di bawah rancangan, tirai menekan mercu",
    bAtasRancang: "Di atas rancangan, tekanan negatif",
    bKavitasi: "Risiko kavitasi",
    bLuarBagan: "Di luar rentang bagan",
    bRancang: "Pada rancangan",
    sKendali: (ratio: string, pita: string, Q: string, p: string) =>
      `He/Hd = ${ratio}: ${pita}; Q = ${Q} m³/s, p = ${p} m.`,
    sTakKendali: "Mercu tidak mengendalikan aliran: tinggi muka air terlalu besar terhadap P.",
    ekstrapolasi: "Ini ekstrapolasi di luar bagan; angkanya tetap ditulis tetapi tidak dijamin.",
    syaratEnergi: "Syarat tekanan nol berlaku pada tinggi ENERGI, bukan tinggi muka air.",
    hHe: "Tinggi energi dan kecepatan datang (bagi dua)",
    hHeTak: "Tidak ada He yang memenuhi: mercu tidak mengendalikan aliran",
    hRatio: "Perbandingan tinggi energi terhadap rancangan",
    hP: "Tekanan di mercu, dibandingkan dengan batas kavitasi",
    note:
      "Bentuk mercu ogee bukan pilihan gaya melainkan jawaban atas satu pertanyaan yang sangat khusus: bentuk apa yang, bila dialiri air, tidak menekan maupun mengangkat airnya sendiri. Jawabannya ditemukan dengan cara yang mengejutkan sederhana, yaitu mengukur bentuk permukaan bawah tirai luapan bebas dari ambang tajam, lalu mencetak beton persis mengikuti bentuk itu. Karena mercunya menjadi tempat air memang ingin lewat, pada tinggi rancangan tekanan di seluruh permukaannya sama dengan tekanan udara. Yang perlu diingat: syarat itu berlaku pada tinggi ENERGI, bukan pada tinggi muka air. Keduanya berbeda sebesar tinggi kecepatan datang, dan pada bendung rendah dengan tinggi rancangan besar selisihnya sama sekali tidak kecil. Perhatikan pula apa yang terjadi di luar tinggi rancangan: di bawahnya tirai menekan dan koefisien debitnya turun, di atasnya tirai terangkat, tekanan menjadi negatif, dan koefisien debitnya naik. Kenaikan itu tampak menguntungkan dan justru merupakan tanda bahaya.",
  },
  en: {
    title: "Ogee weir",
    sheetTitle: "Ogee weir — the WES crest profile and its spillway capacity",
    dH: "Water level above the crest",
    dHd: "Design energy head",
    dL: "Crest length",
    dP: "Crest height above the upstream bed",
    pRancang: "At the design head",
    pRendah: "Far below the design head",
    pBanjir: "Flood above the design head",
    gH: "Water level h, drag the upstream water surface up or down",
    gP: "Crest height P, drag the upstream bed up or down",
    rQ: "Discharge",
    rHe: "Energy head",
    rCd: "Discharge coefficient",
    rRatio: "Ratio of He to Hd",
    rVa: "Approach velocity",
    rP: "Crest pressure",
    rQperM: "Discharge per metre of crest",
    kavitasi: "Cavitation risk at the crest",
    kavitasiNote:
      "The crest pressure has fallen more than six metres of water below atmospheric. At that pressure vapour bubbles form against the concrete surface, and their collapse erodes it quickly: a spillway repeatedly passing floods far above its design head can lose centimetres of concrete in a single season. Note that the discharge coefficient actually RISES in this state, so the weir appears to work better exactly while it is damaging itself. Raise the design head, or accept that the crest needs an erosion-resistant lining.",
    takKendali: "The crest does not control the flow",
    takKendaliNote:
      "The water level is too large compared with the crest height, so the approach velocity becomes as large as the velocity over the crest and no energy head satisfies the equation. What stands there is not a weir but a channel constriction, and the weir formula does not apply at all. Raise the crest, or lower the water level.",
    luar: "Outside the chart range",
    luarKecil:
      "The energy head is less than one fifth of the design head. At heads that low the nappe clings tightly to the crest face and surface tension begins to matter, so the discharge coefficient read from the chart can no longer be trusted.",
    luarBesar:
      "The energy head exceeds three times the design head. The discharge coefficient chart is not published that far, and the negative crest pressure is already well past what design practice accepts.",
    bBawahBagan: "Below chart range",
    bBawahRancang: "Below design, nappe presses on crest",
    bAtasRancang: "Above design, negative pressure",
    bKavitasi: "Cavitation risk",
    bLuarBagan: "Beyond chart range",
    bRancang: "At design",
    sKendali: (ratio: string, pita: string, Q: string, p: string) =>
      `He/Hd = ${ratio}: ${pita}; Q = ${Q} m³/s, p = ${p} m.`,
    sTakKendali: "The crest does not control the flow: the water level is too large relative to P.",
    ekstrapolasi: "This is an extrapolation beyond the chart; the figures are still shown but not guaranteed.",
    syaratEnergi: "The zero-pressure condition applies to the ENERGY head, not the water level.",
    hHe: "Energy head and approach velocity (bisection)",
    hHeTak: "No He satisfies the equation: the crest does not control the flow",
    hRatio: "Ratio of energy head to design head",
    hP: "Crest pressure, compared with the cavitation limit",
    note:
      "The ogee crest shape is not a matter of style but the answer to one very specific question: what shape, when water flows over it, neither presses on nor lifts away from its own flow. The answer was found in a surprisingly simple way, by measuring the underside of the nappe falling freely from a sharp-crested weir and then casting concrete to exactly that shape. Because the crest becomes the place the water wanted to go anyway, at the design head the pressure over its whole surface equals atmospheric. Keep this in mind: that condition applies to the ENERGY head, not the water level. The two differ by the approach velocity head, and on a low weir with a large design head that difference is not small at all. Notice too what happens either side of the design head: below it the nappe presses down and the discharge coefficient falls; above it the nappe lifts, the pressure goes negative, and the coefficient rises. That rise looks like a gain and is in fact a warning.",
  },
} as const;

const REFS = {
  id: [
    "US Army Corps of Engineers (1987). Hydraulic Design Criteria, lembar 111-1 sampai 111-18.",
    "USBR (1987). Design of Small Dams, edisi ke-3, Bab 9: pelimpah.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill, Bab 14.",
    "Falvey, H.T. (1990). Cavitation in Chutes and Spillways. USBR Engineering Monograph 42.",
  ],
  en: [
    "US Army Corps of Engineers (1987). Hydraulic Design Criteria, sheets 111-1 to 111-18.",
    "USBR (1987). Design of Small Dams, 3rd ed., Chapter 9: spillways.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill, Chapter 14.",
    "Falvey, H.T. (1990). Cavitation in Chutes and Spillways. USBR Engineering Monograph 42.",
  ],
} as const;

/*
 * Rentang h dan P: satu definisi untuk penggeser, kotak angka, dan pegangan
 * seret di gambar (aturan 4, satu sumber nilai).
 */
const P_H: ParamDef = { min: 0.05, max: 12, step: 0.05, digits: 2 };
const P_P: ParamDef = { min: 0.5, max: 40, step: 0.5, digits: 1 };

/** Batas bidang gambar dalam meter, dikunci selama pegangan diseret. */
type Bidang = { xMin: number; xMax: number; zMin: number; zMax: number };

export function BendungOgeeClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [h, setH] = useState(2);
  const [Hd, setHd] = useState(2);
  const [L, setL] = useState(20);
  const [P, setP] = useState(8);

  const r = ogeeWeir(h, Hd, L, P);
  const takKendali = !r.controlled;

  const sentuh = useRef<() => void>(() => {});
  /*
   * Batas bidang dikunci selama pegangan diseret. Tanpa kunci, ujung atas
   * sumbu tegak mengikuti h (zMax = max(He, h) + 0,6 Hd) dan ujung bawahnya
   * serta ujung kanannya mengikuti P (kaki muka WES), sedangkan skala
   * dijaga sama di kedua sumbu: tiap piksel geseran mengubah skala, titik
   * yang ditunjuk jari berganti nilai, dan pegangan saling kejar dengan
   * sumbunya. Dilepas = bidang kembali dihitung dari nilainya.
   */
  const [kunci, setKunci] = useState<Bidang | null>(null);
  const bidangRef = useRef<Bidang | null>(null);

  const plate = usePlate(
    (ctx, w, ch) => {
      /* Geometri, dengan puncak mercu di titik asal:
         hulu di x negatif, muka hilir mengikuti bentuk WES ke kanan. */
      const xHulu = -Math.max(3 * Hd, 4);
      const xHilir = Math.max(3.2 * Hd, 5);

      /*
       * Muka hilir WES dihentikan di kaki bendungnya, yaitu ketika turun
       * sedalam tinggi mercunya sendiri.
       *
       * Tanpa penghentian itu, mercu rancangan tiga puluh sentimeter yang
       * digambar selebar lima meter menjulur dua puluh tujuh meter ke bawah,
       * jauh melewati dasar sungainya, dan bendung setinggi delapan meter
       * tergambar sebagai taji setinggi dua puluh tujuh meter.
       */
      const mukaHilir: { x: number; z: number }[] = [];
      for (let i = 0; i <= 60; i++) {
        const xx = (xHilir * i) / 60;
        const zz = wesCrest(xx, Hd);
        mukaHilir.push({ x: xx, z: Math.max(zz, -P) });
        if (zz <= -P) break;
      }
      const xKaki = mukaHilir[mukaHilir.length - 1].x;
      const zKaki = mukaHilir[mukaHilir.length - 1].z;
      const zDasar = zKaki - 1.2;

      // Badan bendung: dinding hulu tegak, puncak, muka hilir WES, lalu dasar.
      const badan: { x: number; z: number }[] = [
        { x: -0.35 * Math.max(Hd, 0.5), z: -P },
        { x: -0.35 * Math.max(Hd, 0.5), z: -0.28 * Math.max(Hd, 0.5) },
        { x: -0.18 * Math.max(Hd, 0.5), z: 0 },
        ...mukaHilir,
        { x: xKaki, z: zDasar },
        { x: -0.35 * Math.max(Hd, 0.5), z: zDasar },
      ];

      const garis: StructureLine[] = [];

      if (!takKendali) {
        // Garis energi hulu, mendatar pada He di atas mercu.
        garis.push({
          pts: [
            { x: xHulu, z: r.He },
            { x: 0.4 * Hd, z: r.He },
          ],
          color: C.energy,
          weight: W.thin,
          dash: DASH.hidden,
          label: `He ${fmtPlain(r.He, 3)} m`,
          labelAt: 0.25,
          labelDy: -10,
        });

        // Tirai pada tinggi rancangan, sebagai pembanding tetap terhadap
        // muka mercu: pada tinggi rancangan keduanya berimpit.
        const tirai: { x: number; z: number }[] = [];
        for (let i = 0; i <= 60; i++) {
          const xx = (xKaki * i) / 60;
          tirai.push({
            x: xx,
            z: Math.max(wesCrest(xx, Hd), -P) + Math.max(r.He - Hd, 0) * 0.55,
          });
        }
        garis.push({
          pts: tirai,
          color: C.critical,
          weight: W.thin,
          dash: DASH.phantom,
          label: T.designNappe,
          labelAt: 0.75,
          labelDy: -11,
        });
      }

      const bebas: Bidang = {
        xMin: xHulu,
        xMax: xKaki,
        zMin: zDasar,
        zMax: Math.max(r.He, h) + 0.6 * Math.max(Hd, 0.5),
      };
      bidangRef.current = bebas;
      const bidang = kunci ?? bebas;
      /* Selama dikunci, garis ukur dipotong ke bidang supaya tidak menembus
         bingkai; teksnya tetap nilai sebenarnya. Tanpa kunci tidak berubah. */
      const potongZ = (z: number) =>
        kunci ? Math.min(Math.max(z, kunci.zMin), kunci.zMax) : z;

      const spec: StructureSpec = {
        ...bidang,
        bodies: [{ pts: badan }],
        waters: takKendali
          ? [
              {
                surface: [
                  { x: xHulu, z: h },
                  { x: xKaki, z: h },
                ],
                invalid: true,
              },
            ]
          : [
              {
                surface: [
                  { x: xHulu, z: h },
                  { x: -0.6 * Math.max(Hd, 0.5), z: h * 0.97 },
                  { x: 0, z: h * 0.72 },
                  ...mukaHilir.map((p) => ({
                    x: p.x,
                    z: p.z + Math.max(h * 0.28, 0.05),
                  })),
                ],
                bed: [
                  { x: xKaki, z: zDasar },
                  { x: -0.35 * Math.max(Hd, 0.5), z: zDasar },
                  { x: -0.35 * Math.max(Hd, 0.5), z: -P },
                  { x: xHulu, z: -P },
                ],
              },
            ],
        lines: garis,
        dims: [
          {
            axis: "v",
            at: xHulu * 0.75,
            from: 0,
            to: potongZ(h),
            text: `h ${fmtPlain(h, 2)} m`,
            color: C.water,
            offset: 0,
          },
          {
            axis: "v",
            at: xHulu * 0.35,
            from: potongZ(-P),
            to: 0,
            text: `P ${fmtPlain(P, 1)} m`,
            color: C.ink,
            offset: 0,
          },
        ],
        callouts: [
          {
            x: xKaki * 0.42,
            z: Math.max(wesCrest(xKaki * 0.42, Hd), -P),
            dx: 34,
            dy: 26,
            text: T.crestProfile,
          },
        ],
        arrows: [{ x: xHulu * 0.6, z: -P * 0.45, length: 26 }],
        heading: takKendali
          ? T.noControl
          : r.cavitationRisk
            ? T.cavitation
            : undefined,
        // Merah sinyal hanya untuk mercu tak terkendali; kavitasi adalah
        // batas rancangan pada hasil yang sah, jadi oker.
        headingColor: takKendali ? C.signal : C.caution,
        axisX: T.axHoriz,
        axisZ: T.axLevel,
        /*
         * Tempat pegangan, tidak digambar. Keduanya di tengah sisi hulu,
         * di antara garis ukur h dan garis ukur P, pada muka air hulu yang
         * datar (z = h) dan pada dasar hulu (z = −P).
         */
        anchors: {
          muka: { x: xHulu * 0.55, z: h },
          dasar: { x: xHulu * 0.55, z: -P },
        },
      };

      return drawStructure(ctx, w, ch, spec, lang);
    },
    null,
    [
      h,
      Hd,
      L,
      P,
      lang,
      kunci ? kunci.xMin : NaN,
      kunci ? kunci.xMax : NaN,
      kunci ? kunci.zMin : NaN,
      kunci ? kunci.zMax : NaN,
    ]
  );

  /*
   * Pemetaan balik:
   * - muka: sumbu tegak adalah elevasi dengan mercu di z = 0, jadi tinggi
   *   muka air di atas mercu h = z jari langsung. Hanya tegak.
   * - dasar: dasar hulu berada di z = −P, jadi P = −z jari (seret ke bawah
   *   meninggikan mercu). Hanya tegak.
   */
  const handles: HandleSpec[] = [
    {
      id: "muka",
      anchor: "muka",
      axis: "y",
      label: x.gH,
      tint: C.water,
      param: P_H,
      value: h,
      toValue: (_px, py, m) => m.invY(py),
      onChange: setH,
      format: (v) => `h ${fmt(v, 2)} m`,
    },
    {
      id: "dasar",
      anchor: "dasar",
      axis: "y",
      label: x.gP,
      param: P_P,
      value: P,
      toValue: (_px, py, m) => -m.invY(py),
      onChange: setP,
      format: (v) => `P ${fmt(v, 1)} m`,
    },
  ];
  const lepasKunci = () => setKunci(null);

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="He/Hd"
          value={r.ratio}
          scale="log"
          digits={2}
          invalid={takKendali || r.outOfRange}
          pesan={takKendali ? x.takKendali : undefined}
          bands={takKendali ? [{ from: 0.005, to: 50, label: x.takKendali, tone: "invalid" }] : pitaRasio(Hd, lang)}
        />
      }
      sheet="HS-01"
      subject={SUBJECTS.HS[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Mercunya dibentuk mengikuti{" "}
            <Term tint={C.critical}>jejak tirai luapan bebas</Term>, sehingga
            pada tinggi rancangan air menyentuhnya tanpa menekan dan tanpa
            terangkat. Di luar tinggi itu, keduanya terjadi.
          </p>
        ) : (
          <p>
            The crest is shaped to follow the{" "}
            <Term tint={C.critical}>trace of a free nappe</Term>, so that at the
            design head the water touches it without pressing and without
            lifting. Away from that head, both happen.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HS-01"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "He/Hd", value: fmt(r.ratio, 3), tint: r.outOfRange ? C.signal : undefined },
            { label: "Cd", value: takKendali ? "—" : fmt(r.Cd, 3), tint: C.energy },
            { label: "Q", value: takKendali ? "—" : `${fmt(r.Q, 1)} m³/s`, tint: takKendali ? C.signal : C.water },
            {
              label: "p",
              value: takKendali ? "—" : `${fmt(r.crestPressure, 2)} m`,
              tint: r.cavitationRisk ? C.caution : undefined,
            },
          ]}
        >
          <canvas ref={plate.ref} className="block h-full w-full" />
          {/* display: contents, jadi pembungkus tidak membuat kotak; hanya
              menangkap pointerdown/lepas yang menggelembung dari pegangan
              untuk mengunci bidang. */}
          <div
            className="contents"
            onPointerDown={(e) => {
              // Hanya tombol utama: DragLayer mengabaikan klik lain, jadi tanpa
              // capture tidak ada pelepas dan kunci akan tertinggal.
              if (e.pointerType === "mouse" && e.button !== 0) return;
              if (bidangRef.current) setKunci(bidangRef.current);
            }}
            onPointerUp={lepasKunci}
            onPointerCancel={lepasKunci}
            onLostPointerCapture={lepasKunci}
          >
            <DragLayer out={plate.outRef.current} handles={handles} touch={() => sentuh.current()} />
          </div>
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="h" label={x.dH} value={h} {...P_H} unit="m" onChange={setH} tint={C.water} />
              <InputRow symbol="Hd" label={x.dHd} value={Hd} min={0.3} max={8} step={0.1} digits={1} unit="m" onChange={setHd} tint={C.critical} />
              <InputRow symbol="L" label={x.dL} value={L} min={2} max={120} step={1} digits={0} unit="m" onChange={setL} />
              <InputRow symbol="P" label={x.dP} value={P} {...P_P} unit="m" onChange={setP} />
            </InputTable>

            <SentuhContoh sentuh={sentuh} />
            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pRancang, apply: () => { setH(2); setHd(2); setL(20); setP(8); } },
                  { label: x.pRendah, apply: () => { setH(0.4); setHd(2); setL(20); setP(8); } },
                  { label: x.pBanjir, apply: () => { setH(5); setHd(2); setL(20); setP(8); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "Q", label: x.rQ, value: takKendali ? "—" : fmt(r.Q, 2), unit: takKendali ? undefined : "m³/s", tint: C.water, strong: true },
                { symbol: "p", label: x.rP, value: takKendali ? "—" : fmt(r.crestPressure, 3), unit: takKendali ? undefined : "m", tint: r.cavitationRisk ? C.caution : undefined, strong: true },
                { symbol: "He", label: x.rHe, value: takKendali ? "—" : fmt(r.He, 4), unit: takKendali ? undefined : "m", tint: C.energy },
                { symbol: "Cd", label: x.rCd, value: takKendali ? "—" : fmt(r.Cd, 4), unit: takKendali ? undefined : "m^½/s", tint: C.energy },
                { symbol: "He/Hd", label: x.rRatio, value: fmt(r.ratio, 4), tint: r.outOfRange ? C.signal : undefined },
                { symbol: "Va", label: x.rVa, value: takKendali ? "—" : fmt(r.Va, 4), unit: takKendali ? undefined : "m/s" },
                { symbol: "q", label: x.rQperM, value: takKendali ? "—" : fmt(r.Q / L, 3), unit: takKendali ? undefined : "m³/s·m" },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={
                  takKendali
                    ? [
                        {
                          judul: x.hHeTak,
                          rumus: (<><span>He = h +</span><Frac num="Va²" den="2g" /><span className="ml-3">Va =</span><Frac num="Q" den="L · ( h + P )" /></>),
                          isi: `h = ${fmt(h, 2)} m, P = ${fmt(P, 1)} m, L = ${fmt(L, 0)} m`,
                          hasil: "—",
                        },
                      ]
                    : [
                        {
                          judul: x.hHe,
                          rumus: (<><span>He = h +</span><Frac num="Va²" den="2g" /><span className="ml-3">Va =</span><Frac num="Q" den="L · ( h + P )" /></>),
                          isi: `Va = ${fmt(r.Q, 3)} / ( ${fmt(L, 0)} · ( ${fmt(h, 2)} + ${fmt(P, 1)} ) ) = ${fmt(r.Va, 5)} m/s; He = ${fmt(h, 2)} + ${fmt(r.Va, 5)}² / ( 2 · ${fmt(G, 2)} )`,
                          hasil: fmt(r.He, 4),
                          satuan: "m",
                          tint: C.energy,
                        },
                        {
                          judul: x.hRatio,
                          rumus: (<><span>He/Hd =</span><Frac num="He" den="Hd" /></>),
                          isi: `${fmt(r.He, 5)} / ${fmt(Hd, 1)}`,
                          hasil: fmt(r.ratio, 4),
                          tint: r.outOfRange ? C.signal : undefined,
                        },
                        {
                          judul: x.rCd,
                          rumus: <span>Cd = {fmt(OGEE_CD_DESIGN, 1)} · ( He/Hd )^{fmt(0.12, 2)}</span>,
                          isi: `${fmt(OGEE_CD_DESIGN, 1)} · ${fmt(r.ratio, 5)}^${fmt(0.12, 2)}`,
                          hasil: fmt(r.Cd, 4),
                          satuan: "m^½/s",
                          tint: C.energy,
                        },
                        {
                          judul: x.rQ,
                          rumus: <span>Q = Cd · L · He^{fmt(1.5, 1)}; q = Q / L</span>,
                          isi: `${fmt(r.Cd, 5)} · ${fmt(L, 0)} · ${fmt(r.He, 5)}^${fmt(1.5, 1)} ; q = ${fmt(r.Q / L, 4)} m³/s·m`,
                          hasil: fmt(r.Q, 2),
                          satuan: "m³/s",
                          tint: C.water,
                        },
                        {
                          judul: x.hP,
                          rumus:
                            r.He > Hd ? (
                              <span>p = −{fmt(1.4, 1)} · ( He − Hd )</span>
                            ) : (
                              <span>p = {fmt(0.35, 2)} · ( Hd − He )</span>
                            ),
                          isi:
                            (r.He > Hd
                              ? `−${fmt(1.4, 1)} · ( ${fmt(r.He, 5)} − ${fmt(Hd, 1)} )`
                              : `${fmt(0.35, 2)} · ( ${fmt(Hd, 1)} − ${fmt(r.He, 5)} )`) +
                            ` ; ${r.cavitationRisk ? "<" : "≥"} ${fmt(OGEE_CAVITATION_LIMIT, 0)} m`,
                          hasil: fmt(r.crestPressure, 3),
                          satuan: "m",
                          tint: r.cavitationRisk ? C.caution : undefined,
                        },
                      ]
                }
              />
            </div>
          </Block>

          <StateCard {...keadaan(r, Hd, lang)} />
        </>
      }
      verification={<Verification checks={checksOgee(h, Hd, L, P)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <Frac num="y" den="Hd" />
                <span>= −{fmt(0.5, 1)}</span>
                <span className="ml-1">(</span>
                <Frac num="x" den="Hd" />
                <span>)^{fmt(1.85, 2)}</span>
                <span className="ml-4 text-ink-3">
                  {lang === "id" ? "bentuk WES" : "the WES profile"}
                </span>
              </Eq>
              <Eq>
                <span>Q = Cd L He^{fmt(1.5, 1)}</span>
                <span className="ml-5">He = h +</span>
                <Frac num="Va²" den="2g" />
                <span className="ml-5">Cd₀ = {fmtPlain(OGEE_CD_DESIGN, 1)}</span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `tekanan mercu nol bila He sama dengan Hd; kavitasi bila di bawah ${fmtPlain(OGEE_CAVITATION_LIMIT, 0)} m`
                    : `crest pressure is zero when He equals Hd; cavitation below ${fmtPlain(OGEE_CAVITATION_LIMIT, 0)} m`}
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
 * Pita He/Hd dari batas yang dipakai ogeeWeir: OGEE_RATIO_MIN dan
 * OGEE_RATIO_MAX (bagan), He = Hd (tekanan nol), dan rasio kavitasi
 * Rk = 1 + |plim| / (1,4 Hd), tempat p = −1,4 (He − Hd) mencapai
 * OGEE_CAVITATION_LIMIT. Pita kavitasi hanya ada bila Rk < 3, yaitu
 * Hd > 2,14 m. Sumber: USACE HDC 111-1..18; USBR 1987 Bab 9.
 */
function rasioKavitasi(Hd: number) {
  return 1 + -OGEE_CAVITATION_LIMIT / (1.4 * Hd);
}

function pitaRasio(Hd: number, lang: Lang): RegimeBand[] {
  const x = TXT[lang];
  const Rk = rasioKavitasi(Hd);
  const pita: RegimeBand[] = [
    { from: 0.005, to: OGEE_RATIO_MIN, label: x.bBawahBagan, tone: "invalid" },
    { from: OGEE_RATIO_MIN, to: 1, label: x.bBawahRancang, tone: "water" },
  ];
  if (Rk < OGEE_RATIO_MAX) {
    pita.push({ from: 1, to: Rk, label: x.bAtasRancang, tone: "neutral" });
    pita.push({ from: Rk, to: OGEE_RATIO_MAX, label: x.bKavitasi, tone: "caution" });
  } else {
    pita.push({ from: 1, to: OGEE_RATIO_MAX, label: x.bAtasRancang, tone: "neutral" });
  }
  pita.push({ from: OGEE_RATIO_MAX, to: 50, label: x.bLuarBagan, tone: "invalid" });
  return pita;
}

function keadaan(
  r: ReturnType<typeof ogeeWeir>,
  Hd: number,
  lang: Lang
): { tone: Tone; badge: string; state: string; notice: string[] } {
  const x = TXT[lang];
  const en = lang === "en";
  if (!r.controlled) {
    return {
      tone: "invalid",
      badge: x.takKendali,
      state: x.sTakKendali,
      notice: [
        x.takKendaliNote,
        en
          ? "While the crest does not control the flow there is no spillway capacity to read. Raise the crest until the approach velocity is again small compared with the velocity over it."
          : "Selama mercunya tidak mengendalikan aliran, tidak ada kapasitas luapan untuk dibaca. Tinggikan mercunya sampai kecepatan datang kembali kecil dibanding kecepatan di mercu.",
      ],
    };
  }

  const pita = pitaRasio(Hd, lang).find((b) => r.ratio >= b.from && r.ratio <= b.to);
  const namaPita = pita?.label ?? x.bLuarBagan;
  const tone: Tone = r.outOfRange
    ? "invalid"
    : r.cavitationRisk
      ? "caution"
      : r.ratio <= 1
        ? "water"
        : "neutral";
  const badge = r.outOfRange ? x.luar : r.cavitationRisk ? x.kavitasi : namaPita;

  /* Pembanding "nilai pada tinggi rancangan" adalah Cd pada He = Hd, yaitu
     CdDesign. Versi lama memanggil ogeeWeir(Hd, Hd, ...), yang memberi
     h = Hd, bukan He = Hd (spesifikasi B2, HS-01 CACAT 1). */
  const bedaCd = r.CdDesign > 0 ? ((r.Cd - r.CdDesign) / r.CdDesign) * 100 : 0;
  const lawan = en
    ? `The discharge coefficient here is ${fmt(r.Cd, 3)} m^½/s, ${fmt(bedaCd, 1)} per cent away from its design-head value of ${fmt(r.CdDesign, 1)}, while the crest pressure sits at ${fmt(r.crestPressure, 2)} m of water. Sweep the water level from one end to the other and watch the two move in opposite senses: the coefficient climbs steadily while the pressure falls steadily. There is no head at which both improve.`
    : `Koefisien debitnya di sini ${fmt(r.Cd, 3)} m^½/s, terpaut ${fmt(bedaCd, 1)} persen dari nilainya pada tinggi rancangan (${fmt(r.CdDesign, 1)}), sementara tekanan mercunya ${fmt(r.crestPressure, 2)} m kolom air. Geser tinggi muka airnya dari ujung ke ujung lalu perhatikan keduanya bergerak berlawanan arah: koefisiennya naik terus sementara tekanannya turun terus. Tidak ada satu tinggi pun yang membuat keduanya membaik.`;

  const alasan = r.reason === "He-kecil" ? x.luarKecil : r.reason === "He-besar" ? x.luarBesar : null;

  return {
    tone,
    badge,
    state: x.sKendali(fmt(r.ratio, 3), namaPita.toLowerCase(), fmt(r.Q, 2), fmt(r.crestPressure, 2)),
    notice: [
      ...(alasan ? [alasan, x.ekstrapolasi] : []),
      ...(r.cavitationRisk ? [x.kavitasiNote] : []),
      lawan,
      x.syaratEnergi,
    ],
  };
}
