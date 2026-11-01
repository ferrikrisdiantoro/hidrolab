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
import { usePlate, usePutar } from "@/lib/usePlate";
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import { tintCurveSide } from "@/lib/chartTint";
import {
  createGrainSwarm,
  drawGrainPanel,
  drawGrainSwarm,
  grainDomain,
  grainTimeScale,
  rouseNumber,
  stepGrains,
  type GrainStep,
  type GrainSwarm,
} from "@/lib/drawGrain";
import { grainMotion } from "@/lib/sedimenGerak";
import { DragLayer, type HandleSpec } from "@/components/DragLayer";
import type { ParamDef } from "@/lib/rentang";
import {
  G,
  SEDIMENT_S,
  SHIELDS_PLATEAU,
  dimensionlessGrain,
  fmt,
  fmtPlain,
  fmtSci,
  shieldsCritical,
  settlingVelocity,
  shieldsState,
  waterViscosity,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksShields } from "@/lib/checks";

const TXT = {
  id: {
    title: "Kurva Shields",
    sheetTitle: "Kurva Shields — ambang gerak butir dasar",
    dD: "Diameter butir",
    dR: "Jari-jari hidrolik atau kedalaman",
    dS: "Kemiringan dasar",
    dRho: "Berat jenis relatif butir (Gs)",
    dT: "Suhu air",
    pPasir: "Pasir sedang di saluran datar",
    pKerikil: "Kerikil di sungai pegunungan",
    pLanau: "Lanau halus di waduk",
    rTheta: "Tegangan geser tak berdimensi",
    rThetaCr: "Ambangnya pada ukuran butir ini",
    rTau: "Tegangan geser dasar",
    rTauCr: "Tegangan yang baru menggerakkan",
    rDstar: "Ukuran butir tak berdimensi",
    rRcr: "Kedalaman yang baru menggerakkan",
    rCadangan: "Perbandingan terhadap ambang",
    bergerak: "Butir bergerak",
    diam: "Butir diam",
    halus: "Butir sehalus ini tidak lagi lepas satu per satu",
    kohesifPita: "Butir kohesif, kurva Shields tidak berlaku",
    kohesifIsi: "d < 0,06 mm: ambang butir lepas tidak berlaku",
    hTheta: "Tegangan tak berdimensi dan perbandingannya",
    gDiam: "Butir diam",
    gDasar: "Menggelinding",
    gLayang: "Melayang",
    gKohesif: "Kohesif: tidak berlaku",
    gAliran: "aliran",
    hdlPoint: "Titik kerja: geser mendatar mengubah diameter butir, tegak mengubah jari-jari hidrolik",
    motionReal: "waktu nyata",
    motionFast: (n: string) => `waktu dipercepat ×${n}`,
    motionSlow: (n: string) => `waktu diperlambat ×${n}`,
    motionDasar: "butir maju dengan laju butir dasar Fernandez Luque dan van Beek, us = 11,5 (u* − 0,7 u*cr)",
    motionLayang:
      "tegak: turun dengan kecepatan endap ws, diaduk pusaran sebesar 1,25 u* (Bagnold). Mendatar digambar sama dengan laju butir dasar, batas bawah; laju butir melayang yang sebenarnya mendekati kecepatan aliran dan tidak dihitung lembar ini",
    halusNote:
      "Di bawah kira-kira 0,06 mm butirnya masuk golongan lanau dan lempung, dan yang menahannya di dasar bukan lagi beratnya sendiri melainkan gaya tarik antar butir. Kurva Shields diturunkan untuk butir yang lepas, jadi ambang yang ditampilkan di sini tidak berlaku: lempung padat dapat bertahan pada tegangan berkali lipat dari yang diramalkan, sedangkan lumpur yang baru mengendap justru lepas jauh lebih awal. Yang menentukan di daerah ini sejarah pengendapannya, bukan ukuran butirnya.",
    note:
      "Sumbu mendatar lembar ini sengaja bukan bilangan Reynolds butir seperti pada kurva Shields aslinya. Bentuk asli itu memuat kecepatan gesek di kedua sumbunya, sehingga memakainya menuntut menebak dulu jawabannya lalu mengulang sampai cocok; itulah sebabnya kurva aslinya selalu disertai keluarga garis bantu yang membuat halamannya penuh. Ukuran butir tak berdimensi menyingkirkan masalah itu sama sekali karena ia hanya memuat besaran yang sudah diketahui sejak awal: ukuran butir, rapat massanya, dan kekentalan airnya. Titik kerja karena itu dapat diletakkan langsung tanpa iterasi, dan pembacaannya menjadi satu langkah. Yang perlu diingat, kurva ini menyatakan ambang gerak butir tunggal di dasar yang rata, bukan laju angkutan; di atas ambang ia tidak mengatakan berapa banyak yang terangkut, hanya bahwa angkutannya sudah dimulai.",
  },
  en: {
    title: "Shields curve",
    sheetTitle: "Shields curve — threshold of motion for bed grains",
    dD: "Grain diameter",
    dR: "Hydraulic radius or depth",
    dS: "Bed slope",
    dRho: "Specific gravity of the grains (Gs)",
    dT: "Water temperature",
    pPasir: "Medium sand in a flat channel",
    pKerikil: "Gravel in a mountain river",
    pLanau: "Fine silt in a reservoir",
    rTheta: "Dimensionless shear stress",
    rThetaCr: "Its threshold at this grain size",
    rTau: "Bed shear stress",
    rTauCr: "Stress that just starts motion",
    rDstar: "Dimensionless grain size",
    rRcr: "Depth that just starts motion",
    rCadangan: "Ratio to the threshold",
    bergerak: "Grain moves",
    diam: "Grain at rest",
    halus: "Grains this fine no longer come loose one by one",
    kohesifPita: "Cohesive grain, Shields curve does not apply",
    kohesifIsi: "d < 0.06 mm: loose-grain threshold does not apply",
    hTheta: "Dimensionless stress and its ratio",
    gDiam: "Grain at rest",
    gDasar: "Rolling",
    gLayang: "Suspended",
    gKohesif: "Cohesive: does not apply",
    gAliran: "flow",
    hdlPoint: "Operating point: drag sideways to change grain diameter, up or down to change hydraulic radius",
    motionReal: "real time",
    motionFast: (n: string) => `time sped up ×${n}`,
    motionSlow: (n: string) => `time slowed ×${n}`,
    motionDasar: "grains advance at the Fernandez Luque and van Beek bed-load grain velocity, us = 11.5 (u* − 0.7 u*cr)",
    motionLayang:
      "vertical: falling at the settling velocity ws, stirred by eddies of 1.25 u* (Bagnold). Horizontal is drawn equal to the bed-load grain velocity, a lower bound; the true speed of a suspended grain approaches the flow velocity and is not computed on this sheet",
    halusNote:
      "Below about 0.06 mm the grains fall into the silt and clay class, and what holds them on the bed is no longer their own weight but cohesion between grains. The Shields curve was derived for loose grains, so the threshold shown here does not apply: firm clay can survive stresses many times the predicted value, while freshly settled mud comes loose far earlier. What decides in this region is the deposition history, not the grain size.",
    note:
      "The horizontal axis of this sheet is deliberately not the grain Reynolds number of the original Shields curve. That original form carries the friction velocity on both axes, so using it means guessing the answer first and iterating until it fits; that is why the original is always printed with a family of guide lines that crowd the page. The dimensionless grain size removes the problem entirely, because it contains only quantities known from the start: grain size, density, and the viscosity of the water. The operating point can therefore be placed directly without iteration, and reading it becomes a single step. Keep in mind that this curve states the threshold of motion for a single grain on a flat bed, not a transport rate; above the threshold it does not say how much moves, only that movement has begun.",
  },
} as const;

const REFS = {
  id: [
    "Shields, A. (1936). Anwendung der Ähnlichkeitsmechanik und der Turbulenzforschung auf die Geschiebebewegung. Mitteilungen der Preussischen Versuchsanstalt für Wasserbau 26.",
    "Soulsby, R.L. & Whitehouse, R.J.S. (1997). Threshold of sediment motion in coastal environments. Pacific Coasts and Ports Conference.",
    "Van Rijn, L.C. (1993). Principles of Sediment Transport in Rivers, Estuaries and Coastal Seas. Aqua Publications, Bab 4.",
    "Buffington, J.M. & Montgomery, D.R. (1997). A systematic analysis of eight decades of incipient motion studies. Water Resources Research, vol. 33.",
  ],
  en: [
    "Shields, A. (1936). Anwendung der Ähnlichkeitsmechanik und der Turbulenzforschung auf die Geschiebebewegung. Mitteilungen der Preussischen Versuchsanstalt für Wasserbau 26.",
    "Soulsby, R.L. & Whitehouse, R.J.S. (1997). Threshold of sediment motion in coastal environments. Pacific Coasts and Ports Conference.",
    "Van Rijn, L.C. (1993). Principles of Sediment Transport in Rivers, Estuaries and Coastal Seas. Aqua Publications, Chapter 4.",
    "Buffington, J.M. & Montgomery, D.R. (1997). A systematic analysis of eight decades of incipient motion studies. Water Resources Research, vol. 33.",
  ],
} as const;

/*
 * Rentang masukan yang dipakai bersama oleh penggeser, kotak angka, dan
 * pegangan seret titik kerja (aturan 4: satu sumber nilai).
 */
const P_D: ParamDef = { min: 0.004, max: 300, step: 0.002, digits: 3 };
const P_R: ParamDef = { min: 0.02, max: 10, step: 0.02, digits: 2 };
/** Banyak butir lepas di panel sketsa butir. */
const N_BUTIR = 8;

const DSTAR_MIN = 0.3;
const DSTAR_MAX = 3000;
/** Batas bawah butir lepas; di bawahnya gaya tarik antar butir menguasai. */
const D_KOHESIF = 0.00006;

export function KurvaShieldsClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [dMm, setDMm] = useState(20);
  const [R, setR] = useState(1);
  const [S, setS] = useState(0.001);
  const [s, setS_] = useState(SEDIMENT_S);
  const [suhu, setSuhu] = useState(15);
  // Pemadam tanda contoh untuk pegangan seret (lihat SentuhContoh).
  const sentuh = useRef<() => void>(() => {});
  // Lapis gerak panel butir berjalan sejak awal kecuali peramban meminta
  // pengurangan gerak; tombol putar/jeda ada di pojok panel butir.
  const { playing, toggle: togglePutar } = usePutar();
  const gerak = useRef<GrainSwarm | null>(null);
  if (gerak.current === null) gerak.current = createGrainSwarm(N_BUTIR);

  const nu = waterViscosity(suhu);
  const d = dMm / 1000;
  const r = shieldsState(R, S, d, s, nu);
  const kohesif = d < D_KOHESIF;
  const cadangan = r.thetaCritical > 0 ? r.theta / r.thetaCritical : 0;

  /*
   * Tegangan geser tak berdimensi membentang dari sepersejuta sampai ratusan
   * di dalam rentang penggeser lembar ini. Jumlah desimal yang tetap
   * menuliskan ujung bawahnya sebagai "0,0000", yaitu angka nol untuk besaran
   * yang bukan nol, dan pengumuman titik di luar diagram menjadi tidak
   * berguna karena ia mengumumkan angka nol. Yang kecil ditulis berpangkat.
   */
  const fTheta = (v: number) => (v > 0 && v < 1e-3 ? fmtSci(v) : fmt(v, 4));

  const plate = usePlate(
    (ctx, w, h) => {
      const ambang: { x: number; y: number }[] = [];
      for (let lg = Math.log10(DSTAR_MIN); lg <= Math.log10(DSTAR_MAX) + 1e-9; lg += 0.02) {
        const D = Math.pow(10, lg);
        ambang.push({ x: D, y: shieldsCritical(D) });
      }

      const deret: ChartSeries[] = [
        {
          pts: ambang,
          color: C.critical,
          weight: W.bold,
          label: T.thresholdCurve,
          labelAt: 0.62,
          labelDy: -12,
        },
      ];

      const out = drawChart(
        ctx,
        w,
        h,
        {
          xMin: DSTAR_MIN,
          xMax: DSTAR_MAX,
          yMin: 0.01,
          yMax: 3,
          xLog: true,
          yLog: true,
          axisX: T.axGrainSize,
          axisY: T.axShields,
          series: deret,
          rules: [
            {
              axis: "y",
              at: SHIELDS_PLATEAU,
              color: C.ink3,
              dash: DASH.phantom,
              label: `θ ${fmtPlain(SHIELDS_PLATEAU, 3)}`,
              labelAlign: "right",
            },
          ],
          regions: [
            /* Ungu, warna keadaan kritis, sama dengan kurva ambangnya.
               Bukan merah sinyal: butir yang bergerak adalah keadaan yang
               sah, bukan keadaan di luar rentang berlakunya rumus. */
            { x: 3, y: 1.5, text: T.grainMoves, color: C.critical },
            { x: 400, y: 0.014, text: T.grainRests, color: C.ink3 },
          ],
          /* Anchor pegangan selalu ada, juga saat titik kerja lepas sumbu
             (DragLayer menjepitnya ke tepi bidang), supaya pegangan tidak
             hilang di tengah seret dan penanda "dibatasi" tetap tampil. */
          anchors: { titik: { x: r.dStar, y: r.theta } },
          point: {
            x: r.dStar,
            y: r.theta,
            label: `θ ${fTheta(r.theta)}`,
            invalid: kohesif,
          },
          heading: kohesif ? T.noLawHere : undefined,
          headingColor: C.signal,
        },
        lang
      );
      /* Zona berwarna (permintaan klien): di atas kurva ambang butir
         bergerak, ungu keadaan kritis seperti kurvanya; di bawahnya butir
         diam, biru seperti pita "butir diam" di skala keadaan. */
      tintCurveSide(ctx, out.map, ambang, "above", C.criticalFill);
      tintCurveSide(ctx, out.map, ambang, "below", C.waterFill);
      return out;
    },
    null,
    [dMm, R, S, s, suhu, lang]
  );

  /*
   * Pegangan seret titik kerja (R4: pemetaan balik harus unik). Sumbu
   * mendatar lembar ini D*, bukan Re*, dan D* = d [(Gs − 1) g / ν²]^(1/3)
   * naik lurus dengan d pada Gs dan T tetap, jadi x → d unik. Sumbu tegak
   * θ = R S / ((Gs − 1) d), jadi pada S dan Gs tetap y → R = θ (Gs − 1) d / S
   * juga unik. Dua masukan yang dikendalikan: d dan R; S, Gs, T tidak
   * disentuh. ParamDef sama dengan InputRow d dan R, setter sama.
   */
  const perD = dimensionlessGrain(1, s, nu);
  const handles: HandleSpec[] = [
    {
      id: "titik",
      anchor: "titik",
      axis: "xy",
      label: x.hdlPoint,
      hollow: true,
      tint: C.critical,
      param: [P_D, P_R],
      value: [dMm, R],
      toValue: (px, py, m) => {
        const dBaru = m.invX(px) / perD;
        return [dBaru * 1000, (m.invY(py) * (s - 1) * dBaru) / S];
      },
      onChange: ([a, b]) => {
        setDMm(a);
        setR(b);
      },
      format: (v) => `d ${fmt(v[0], 3)} mm, R ${fmt(v[1], 2)} m`,
    },
  ];

  /* Panel sketsa butir: keadaan dan laju dari M1 (grainMotion), ambang
     melayang Bagnold u* = 0,8 ws (bawaan sedimenGerak). */
  const ws = settlingVelocity(d, s, nu);
  const gm = grainMotion(r, ws);
  const modeButir = kohesif ? "diam" : gm.mode;
  const langkahButir: GrainStep = { mode: modeButir, us: gm.us, ustar: gm.ustar, ws, dM: d };
  const skalaWaktu = grainTimeScale(langkahButir);
  const faktor = (v: number) => Math.round(v).toLocaleString(lang === "id" ? "id-ID" : "en-US");
  const catatanWaktu =
    skalaWaktu === 1
      ? x.motionReal
      : skalaWaktu > 1
        ? x.motionFast(faktor(skalaWaktu))
        : x.motionSlow(faktor(1 / skalaWaktu));
  const catatanGerak = kohesif
    ? undefined
    : modeButir === "melayang"
      ? `${catatanWaktu}; ${x.motionLayang}`
      : modeButir === "dasar"
        ? `${catatanWaktu}; ${x.motionDasar}`
        : undefined;
  const judulButir = kohesif
    ? x.gKohesif
    : modeButir === "diam"
      ? x.gDiam
      : modeButir === "dasar"
        ? x.gDasar
        : x.gLayang;
  const fV = (v: number) => (v > 0 && v < 1e-3 ? fmtSci(v) : fmt(v, 3));
  const nilaiButir =
    modeButir === "dasar"
      ? `us = ${fV(gm.us)} m/s; u* = ${fV(gm.ustar)} m/s`
      : modeButir === "melayang"
        ? `ws/u* = ${fmt(gm.ratio, 2)}; us = ${fV(gm.us)} m/s`
        : `u* = ${fV(gm.ustar)} m/s; ws = ${fV(ws)} m/s`;
  const butir = usePlate(
    (ctx, w, h) =>
      drawGrainPanel(ctx, w, h, {
        dM: d,
        mode: modeButir,
        title: judulButir,
        tint: modeButir === "diam" ? C.water : C.critical,
        values: nilaiButir,
        flowLabel: x.gAliran,
        flowing: gm.ustar > 0,
        animating: playing,
        invalid: kohesif,
        n: N_BUTIR,
        rouseP: rouseNumber(ws, gm.ustar),
      }),
    /* Butir kohesif: kurva tidak berlaku, jadi tidak ada gerak (tanpa
       tombol); butir digambar diam di lapis statis. */
    kohesif
      ? null
      : (ctx, _w, _h, _t, dt, out) => {
          if (!out) return;
          stepGrains(gerak.current!, dt, langkahButir, grainDomain(out.map));
          drawGrainSwarm(ctx, gerak.current!, out, d, skalaWaktu);
        },
    [d, modeButir, judulButir, nilaiButir, gm.ustar, ws, playing, kohesif, lang],
    { playing, timeScale: skalaWaktu }
  );

  /* D* jatuh sampai sekitar 0,02 pada butir terhalus, air dingin, dan Gs
     kecil; dua desimal menulisnya "0,02" dan satu desimal "0,0". Di bawah
     0,1 ditulis berpangkat, sama di kop dan di tabel. */
  const fDstar = (v: number) => (v > 0 && v < 0.1 ? fmtSci(v) : fmt(v, 2));
  const fCadangan = (v: number) => (v > 0 && v < 1e-3 ? fmtSci(v) : fmt(v, 3));
  const RcrAda = !kohesif && Number.isFinite(r.RCritical);
  const kosong = "—";

  return (
    <LabShell
      status={
        kohesif ? (
          <RegimeScale
            symbol="τ/τcr"
            value={NaN}
            invalid
            pesan={x.kohesifPita}
            scale="log"
            digits={3}
            bands={[{ from: 0.001, to: 1000, label: x.kohesifPita, tone: "invalid" }]}
          />
        ) : (
          /* Batas 1 dari shieldsState: moving = τ > τcr. Rentang penggeser
             memberi τ/τcr 8·10⁻⁶ sampai 10⁷, jadi kedua ujung bisa lewat
             skala; itu bukan keadaan tidak berlaku, penandanya netral. */
          <RegimeScale
            symbol="τ/τcr"
            value={cadangan}
            scale="log"
            digits={3}
            bands={[
              { from: 0.001, to: 1, label: x.diam, tone: "water" },
              { from: 1, to: 1000, label: x.bergerak, tone: "critical" },
            ]}
          />
        )
      }
      sheet="SD-01"
      subject={SUBJECTS.SD[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Satu butir di dasar sungai bertahan selama{" "}
            <Term tint={C.critical}>beratnya</Term> masih melebihi{" "}
            <Term tint={C.energy}>seretan aliran</Term>. Perbandingan keduanya
            tidak bersatuan, dan itulah yang membuat satu kurva berlaku untuk
            pasir maupun bongkah.
          </p>
        ) : (
          <p>
            A grain on a river bed holds while its{" "}
            <Term tint={C.critical}>weight</Term> still exceeds the{" "}
            <Term tint={C.energy}>drag of the flow</Term>. The ratio of the two
            has no units, and that is what lets one curve serve both sand and
            boulders.
          </p>
        )
      }
      drawing={
        <Sheet
          number="SD-01"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, Pa)" },
            { label: "d", value: `${fmt(dMm, 2)} mm`, tint: kohesif ? C.signal : undefined },
            { label: "D*", value: fDstar(r.dStar) },
            { label: "θ", value: fTheta(r.theta), tint: kohesif ? undefined : C.critical },
            { label: "θcr", value: kohesif ? kosong : fmt(r.thetaCritical, 4), tint: C.critical },
          ]}
          height="auto"
          motion={{
            playing,
            onToggle: togglePutar,
            allowed: butir.motionAllowed,
            note: catatanGerak,
          }}
        >
          {/* Panel sketsa butir di samping diagram (permintaan klien): kanan
              mulai lebar lg, di atas diagram pada layar sempit, jadi tombol
              putar/jeda di pojok kanan atas selalu duduk di panel butir.
              Panel lebih dulu di DOM supaya kanvas gerak menjadi kanvas
              kedua di figure, seperti lembar beranimasi lain. */}
          <div className="flex flex-col lg:h-[clamp(360px,56vh,620px)] lg:flex-row-reverse">
            <div className="relative h-[200px] min-w-0 border-b border-rule lg:h-auto lg:flex-1 lg:border-b-0 lg:border-l">
              <canvas ref={butir.ref} className="block h-full w-full" />
              <canvas ref={butir.motionRef} />
            </div>
            <div className="relative h-[clamp(360px,56vh,620px)] min-w-0 lg:h-auto lg:flex-[2.1]">
              <canvas ref={plate.ref} className="block h-full w-full" />
              {/* usePlate menaikkan `version` tiap lapis statis digambar
                  ulang, jadi pegangan membaca anchor baru dari outRef. */}
              <DragLayer out={plate.outRef.current} handles={handles} touch={() => sentuh.current()} />
            </div>
          </div>
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <SentuhContoh sentuh={sentuh} />
            <InputTable>
              <InputRow symbol="d" label={x.dD} value={dMm} {...P_D} unit="mm" onChange={setDMm} tint={C.critical} />
              <InputRow symbol="R" label={x.dR} value={R} {...P_R} unit="m" onChange={setR} tint={C.water} />
              <InputRow symbol="S" label={x.dS} value={S * 1000} min={0.02} max={60} step={0.02} digits={2} unit="‰" onChange={(v) => setS(v / 1000)} />
              <InputRow symbol="Gs" label={x.dRho} value={s} min={1.05} max={4} step={0.05} digits={2} onChange={setS_} />
              <InputRow symbol="T" label={x.dT} value={suhu} min={4} max={40} step={0.5} digits={1} unit="°C" onChange={setSuhu} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pPasir, apply: () => { setDMm(0.5); setR(1); setS(0.001); setS_(SEDIMENT_S); setSuhu(15); } },
                  { label: x.pKerikil, apply: () => { setDMm(40); setR(0.8); setS(0.02); setS_(SEDIMENT_S); setSuhu(15); } },
                  { label: x.pLanau, apply: () => { setDMm(0.02); setR(3); setS(0.00005); setS_(SEDIMENT_S); setSuhu(15); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            {/* Keadaan diam/bergerak dan catatan kohesif kini satu tempat
                saja, di kartu keadaan. Saat kohesif, angka ambang ditulis
                "—": kurva Shields tidak berlaku, jadi θcr, τcr, Rcr, dan
                τ/τcr bukan hasil yang sah. */}
            <ResultTable
              rows={[
                {
                  symbol: "τ/τcr",
                  label: x.rCadangan,
                  value: kohesif ? kosong : fCadangan(cadangan),
                  tint: !kohesif && r.moving ? C.critical : undefined,
                  strong: true,
                },
                /* θ tetap terhitung saat kohesif (hanya ambangnya yang
                   gugur), jadi angka besarnya tidak bernada sinyal. */
                { symbol: "θ", label: x.rTheta, value: fTheta(r.theta), tint: kohesif ? undefined : C.critical, strong: true },
                { symbol: "τcr", label: x.rTauCr, value: kohesif ? kosong : fmt(r.tauCritical, 3), unit: kohesif ? undefined : "Pa", tint: C.critical, strong: true },
                { symbol: "τ", label: x.rTau, value: fmt(r.tau, 3), unit: "Pa", tint: C.energy },
                { symbol: "θcr", label: x.rThetaCr, value: kohesif ? kosong : fmt(r.thetaCritical, 5), tint: C.critical },
                { symbol: "D*", label: x.rDstar, value: fDstar(r.dStar) },
                { symbol: "Rcr", label: x.rRcr, value: RcrAda ? fmt(r.RCritical, 3) : kosong, unit: RcrAda ? "m" : undefined, tint: C.water },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.rTau,
                    rumus: <span>τ = ρ · g · R · S</span>,
                    isi: `1000 · ${fmt(G, 2)} · ${fmt(R, 2)} · ${fmt(S, 5)}`,
                    hasil: fmt(r.tau, 3),
                    satuan: "Pa",
                    tint: C.energy,
                  },
                  {
                    judul: x.rDstar,
                    rumus: (<><span>D* = d · [</span><Frac num="(Gs − 1) · g" den="ν²" /><span>]^(1/3)</span></>),
                    isi: `${fmtSci(d)} · [ (${fmt(s, 2)} − 1) · ${fmt(G, 2)} / (${fmtSci(nu)})² ]^(1/3)`,
                    hasil: fDstar(r.dStar),
                  },
                  {
                    judul: x.rTauCr,
                    rumus: (<><span>θcr =</span><Frac num="0,30" den="1 + 1,2 D*" /><span>+ 0,055 [1 − e^(−0,02 D*)] ; τcr = θcr (Gs − 1) ρ g d</span></>),
                    isi: kohesif
                      ? x.kohesifIsi
                      : `θcr = ${fmt(r.thetaCritical, 5)} ; ${fmt(r.thetaCritical, 5)} · (${fmt(s, 2)} − 1) · 1000 · ${fmt(G, 2)} · ${fmtSci(d)}`,
                    hasil: kohesif ? kosong : fmt(r.tauCritical, 3),
                    satuan: kohesif ? undefined : "Pa",
                    tint: C.critical,
                  },
                  {
                    judul: x.hTheta,
                    rumus: (<><span>θ =</span><Frac num="τ" den="(Gs − 1) ρ g d" /><span>; τ/τcr</span></>),
                    isi: kohesif
                      ? x.kohesifIsi
                      : `θ = ${fmt(r.tau, 3)} / [ (${fmt(s, 2)} − 1) · 1000 · ${fmt(G, 2)} · ${fmtSci(d)} ] = ${fTheta(r.theta)} ; ${fmt(r.tau, 3)} / ${fmt(r.tauCritical, 3)}`,
                    hasil: kohesif ? kosong : fCadangan(cadangan),
                    tint: C.critical,
                  },
                  {
                    judul: x.rRcr,
                    rumus: (<><span>Rcr =</span><Frac num="τcr" den="ρ · g · S" /></>),
                    isi: kohesif
                      ? x.kohesifIsi
                      : `${fmt(r.tauCritical, 3)} / ( 1000 · ${fmt(G, 2)} · ${fmt(S, 5)} )`,
                    hasil: RcrAda ? fmt(r.RCritical, 3) : kosong,
                    satuan: RcrAda ? "m" : undefined,
                    tint: C.water,
                  },
                ]}
              />
            </div>
          </Block>

          {kohesif ? (
            <StateCard
              tone="invalid"
              badge={x.halus}
              {...notice(r.dStar, r.theta, r.thetaCritical, cadangan, r.RCritical, true, dMm, lang)}
            />
          ) : (
            <StateCard
              tone={r.moving ? "critical" : "water"}
              badge={r.moving ? x.bergerak : x.diam}
              {...notice(r.dStar, r.theta, r.thetaCritical, cadangan, r.RCritical, false, dMm, lang)}
            />
          )}
        </>
      }
      verification={<Verification checks={checksShields(R, S, d, s, nu)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>θ =</span>
                <Frac num="τ" den="(s − 1) ρ g d" />
                <span className="ml-6">τ = ρ g R S</span>
              </Eq>
              <Eq>
                <span>D* = d</span>
                <span className="ml-1">[</span>
                <Frac num="(s − 1) g" den="ν²" />
                <span>]^(1/3)</span>
              </Eq>
              <Eq>
                <span>θcr =</span>
                <Frac num="0,30" den="1 + 1,2 D*" />
                <span>+ 0,055 [ 1 − e^(−0,02 D*) ]</span>
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
 * Isi kalimatnya sama dengan catatan lama satu paragraf, dipecah: kalimat
 * keadaan, lalu butir. Cabang "kemiringannya nol" dibuang karena S paling
 * kecil di penggeser 0,02 ‰, jadi Rcr selalu terhingga.
 */
function notice(
  dStar: number,
  theta: number,
  thetaCr: number,
  cadangan: number,
  Rcr: number,
  kohesif: boolean,
  dMm: number,
  lang: Lang
): { state: string; notice: string[] } {
  const fTh = (v: number) => (v > 0 && v < 1e-3 ? fmtSci(v) : fmt(v, 4));
  const fD = (v: number) => (v > 0 && v < 0.1 ? fmtSci(v) : fmt(v, 2));
  if (kohesif) {
    return lang === "id"
      ? {
          state: `d = ${fmt(dMm, 3)} mm < 0,06 mm: butir kohesif, ambang Shields tidak berlaku.`,
          notice: [
            "Di bawah kira-kira 0,06 mm butirnya masuk golongan lanau dan lempung, dan yang menahannya di dasar bukan lagi beratnya sendiri melainkan gaya tarik antar butir.",
            "Kurva Shields diturunkan untuk butir yang lepas: lempung padat dapat bertahan pada tegangan berkali lipat dari yang diramalkan, sedangkan lumpur yang baru mengendap justru lepas jauh lebih awal. Yang menentukan sejarah pengendapannya, bukan ukuran butirnya.",
            "Perbesar butirnya melewati 0,06 mm, dan ambang yang digambar kembali berarti.",
          ],
        }
      : {
          state: `d = ${fmt(dMm, 3)} mm < 0.06 mm: cohesive grain, the Shields threshold does not apply.`,
          notice: [
            "Below about 0.06 mm the grains fall into the silt and clay class, and what holds them on the bed is no longer their own weight but cohesion between grains.",
            "The Shields curve was derived for loose grains: firm clay can survive stresses many times the predicted value, while freshly settled mud comes loose far earlier. What decides is the deposition history, not the grain size.",
            "Raise the grain size past 0.06 mm and the threshold drawn becomes meaningful again.",
          ],
        };
  }

  const rasio = cadangan > 0 && cadangan < 1e-3 ? fmtSci(cadangan) : fmt(cadangan, 3);
  if (lang === "en")
    return {
      state: `τ/τcr = ${rasio}: ${cadangan > 1 ? "the grain moves" : "the grain is at rest"}; θ = ${fTh(theta)} against the threshold θcr = ${fmt(thetaCr, 4)} at D* = ${fD(dStar)}.`,
      notice: [
        `The threshold here is ${fmt(thetaCr, 4)}, against the coarse-grain plateau of ${fmtPlain(SHIELDS_PLATEAU, 3)}. At its left end the curve rises: fine grains need a larger dimensionless stress, not a smaller one, because they hide inside the viscous sublayer where the flow barely reaches them. That is why a bed of fine sand can be harder to start than one of coarse sand.`,
        `The depth that would just start motion at this slope is ${fmt(Rcr, 3)} m.`,
      ],
    };
  return {
    state: `τ/τcr = ${rasio}: ${cadangan > 1 ? "butir bergerak" : "butir diam"}; θ = ${fTh(theta)} terhadap ambang θcr = ${fmt(thetaCr, 4)} pada D* = ${fD(dStar)}.`,
    notice: [
      `Ambangnya di sini ${fmt(thetaCr, 4)}, berbanding dataran butir kasar ${fmtPlain(SHIELDS_PLATEAU, 3)}. Di ujung kirinya kurva naik: butir halus justru menuntut tegangan tak berdimensi yang lebih besar, bukan lebih kecil, karena ia bersembunyi di dalam lapisan kental tempat aliran hampir tidak menjangkaunya. Itu sebabnya dasar berpasir halus dapat lebih sulit digerakkan daripada dasar berpasir kasar.`,
      `Kedalaman yang baru menggerakkan butir pada kemiringan ini ${fmt(Rcr, 3)} m.`,
    ],
  };
}
