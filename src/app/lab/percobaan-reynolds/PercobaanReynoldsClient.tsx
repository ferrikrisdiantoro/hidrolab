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
  type RegimeBand,
} from "@/components/ui";
import { usePlate, usePutar } from "@/lib/usePlate";
import {
  createReynoldsMotion,
  drawReynoldsMotion,
  filamentY,
  reynoldsTimeScale,
  type ReynoldsMotion,
} from "@/lib/drawFieldMotion";
import {
  drawField,
  type FieldDim,
  type FieldLine,
  type FieldMarker,
} from "@/lib/drawField";
import {
  RE_LAMINAR_MAX,
  fmt,
  fmtSci,
  reynoldsExperiment,
  waterViscosity,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksReynoldsExp } from "@/lib/checks";

/** Panjang tabung kaca yang digambar, meter. */
const PANJANG = 2;

/* Sumbu pita Re 1–10⁷ memuat penggeser (3,56 pada Q 1 ml/s, D 200, T 0;
   7,68·10⁶ pada Q 20 l/s, D 5, T 40). */
const RE_AXIS_MIN = 1;
const RE_AXIS_MAX = 1e7;

/*
 * Ambang kecepatan untuk butir peringatan. BUKAN angka terbitan: hanya
 * penanda bahwa kecepatan di atasnya jauh melampaui air di tabung kaca
 * atau pipa nyata (beberapa m/s). Rumusnya tetap berlaku, jadi nadanya
 * caution, bukan invalid. Ambang akhirnya menunggu keputusan sesi utama.
 */
const V_WASPADA = 10;

const NADA: Record<string, Tone> = {
  laminar: "water",
  peralihan: "critical",
  turbulen: "energy",
};

const TXT = {
  id: {
    title: "Percobaan Reynolds",
    motionReal: "zat warna bergerak dengan V rata-rata, waktu nyata",
    motionFast: (n: string) => `zat warna bergerak dengan V rata-rata, waktu dipercepat ×${n}`,
    motionSlow: (n: string) => `zat warna bergerak dengan V rata-rata, waktu diperlambat ×${n}`,
    sheetTitle: "Benang zat warna di dalam tabung kaca, sepanjang dua meter",
    dQ: "Debit",
    dD: "Diameter tabung",
    dT: "Suhu air",
    dQt: "Ketenangan percobaan",
    pLaminar: "Aliran laminar, benangnya utuh",
    pPeralihan: "Peralihan, benangnya mulai berayun",
    pTurbulen: "Turbulen, benangnya membaur seluruhnya",
    pReynolds: "Percobaan Reynolds sendiri, sangat tenang",
    rRe: "Bilangan Reynolds",
    rV: "Kecepatan rata-rata",
    rVkrit: "Kecepatan saat mulai meninggalkan laminar",
    rRekrit: "Bilangan Reynolds kritis pada ketenangan ini",
    rMasuk: "Panjang masuk sampai profilnya berkembang penuh",
    rMasukD: "Panjang masuk itu dalam kelipatan diameter",
    rF: "Faktor gesekan",
    rTebal: "Tebal lapisan kental di dinding",
    laminar: "Laminar",
    peralihan: "Peralihan",
    turbulen: "Turbulen",
    bLam: "Laminar",
    bLamTenang: "Laminar karena tenang",
    bPeralihan: "Peralihan",
    bTurbulen: "Turbulen",
    hV: "Kekentalan kinematik dan kecepatan rata-rata",
    hRe: "Bilangan Reynolds",
    hKrit: "Batas laminar pada ketenangan ini dan kecepatannya",
    hLe: "Panjang masuk",
    hFLam: "Faktor gesekan, laminar",
    hFTurb: "Faktor gesekan, kurva licin Colebrook (ε = 0)",
    hDelta: "Tebal lapisan kental di dinding",
    tenangBadge: "Laminar tenang",
    leLewat: (le: string) => `Panjang masuknya ${le} m, lebih panjang daripada tabung ${PANJANG} m yang digambar: profil kecepatannya belum berkembang penuh di ujung tabung.`,
    vCepat: (v: string) => `Kecepatan ${v} m/s jauh di atas kecepatan air di tabung kaca atau pipa nyata, yang umumnya beberapa meter per detik. Rumusnya tetap berlaku, tetapi percobaan semacam ini tidak dapat dibuat. Perbesar diameternya atau kurangi debitnya.`,
    tenangNote:
      "Bilangan Reynolds sudah jauh melewati dua ribu, dan alirannya tetap laminar. Ini bukan cacat hitungan melainkan kenyataan percobaan: batas dua ribu bukan sifat air melainkan sifat gangguan yang ada di sekitarnya. Reynolds sendiri mencapai tiga belas ribu pada tabung kaca yang didiamkan berhari-hari sebelum percobaannya, dan percobaan berikutnya mencapai seratus ribu. Yang dua ribu itu batas bawah, yaitu bilangan tempat aliran laminar berhenti mampu meredam gangguan sekecil apa pun, dan itulah yang dipakai merancang pipa lapangan karena pipa lapangan memang tidak pernah tenang.",
    note:
      "Percobaan Reynolds tahun 1883 masih dipakai seperti hari pertama karena ia bukan mengukur satu angka melainkan memperlihatkan satu peralihan. Yang diperlihatkannya sederhana: benang zat warna yang utuh sepanjang tabung, lalu mulai berayun, lalu membaur seluruhnya, dan ketiganya diatur satu bilangan tak berdimensi saja. Dua hal yang jarang disebut pantas diperhatikan di sini. Pertama, batas dua ribu yang selalu dihafalkan bukan sifat air melainkan sifat gangguan. Kalau tabungnya didiamkan sampai benar-benar tenang, alirannya tetap laminar sampai puluhan ribu, dan Reynolds sendiri mencapai tiga belas ribu. Yang dua ribu adalah batas bawah, tempat aliran laminar tidak lagi sanggup meredam gangguan sekecil apa pun, dan justru batas bawah itulah yang berguna untuk merancang, karena tidak ada pipa lapangan yang tenang. Kedua, peralihannya tidak setangkup: aliran yang sudah turbulen tetap turbulen sampai bilangan Reynolds jauh lebih rendah daripada tempat ia pertama kali menjadi turbulen. Aliran punya ingatan, dan ingatan itu tidak muncul di rumus mana pun yang ditulis dengan satu bilangan kritis.",
  },
  en: {
    title: "Reynolds experiment",
    motionReal: "dye moves at the mean velocity V, real time",
    motionFast: (n: string) => `dye moves at the mean velocity V, time sped up ×${n}`,
    motionSlow: (n: string) => `dye moves at the mean velocity V, time slowed ×${n}`,
    sheetTitle: "A dye filament inside a glass tube, two metres long",
    dQ: "Discharge",
    dD: "Tube diameter",
    dT: "Water temperature",
    dQt: "Quietness of the experiment",
    pLaminar: "Laminar flow, the filament stays whole",
    pPeralihan: "Transition, the filament begins to waver",
    pTurbulen: "Turbulent, the filament mixes away entirely",
    pReynolds: "Reynolds' own experiment, very quiet",
    rRe: "Reynolds number",
    rV: "Mean velocity",
    rVkrit: "Velocity at which laminar flow is left behind",
    rRekrit: "Critical Reynolds number at this quietness",
    rMasuk: "Entry length until the profile is fully developed",
    rMasukD: "That entry length in diameters",
    rF: "Friction factor",
    rTebal: "Thickness of the viscous layer at the wall",
    laminar: "Laminar",
    peralihan: "Transition",
    turbulen: "Turbulent",
    bLam: "Laminar",
    bLamTenang: "Laminar because quiet",
    bPeralihan: "Transition",
    bTurbulen: "Turbulent",
    hV: "Kinematic viscosity and mean velocity",
    hRe: "Reynolds number",
    hKrit: "Laminar limit at this quietness and its velocity",
    hLe: "Entry length",
    hFLam: "Friction factor, laminar",
    hFTurb: "Friction factor, Colebrook smooth-pipe curve (ε = 0)",
    hDelta: "Thickness of the viscous layer at the wall",
    tenangBadge: "Quiet laminar",
    leLewat: (le: string) => `The entry length is ${le} m, longer than the ${PANJANG} m tube drawn: the velocity profile is not yet fully developed at the end of the tube.`,
    vCepat: (v: string) => `A velocity of ${v} m/s is far above water in a glass tube or a real pipe, which is usually a few metres per second. The formulas still hold, but no such experiment can be built. Enlarge the diameter or reduce the discharge.`,
    tenangNote:
      "The Reynolds number is far past two thousand and the flow is still laminar. This is not an arithmetic fault but an experimental fact: the limit of two thousand is not a property of water but a property of the disturbances around it. Reynolds himself reached thirteen thousand in a glass tube left standing for days before his experiment, and later experiments reached a hundred thousand. Two thousand is a lower bound, the number at which laminar flow ceases to damp out even the smallest disturbance, and it is that bound which is used to design field pipework, because field pipework is never quiet.",
    note:
      "Reynolds' experiment of 1883 is still used as it was on its first day, because it does not measure one number but shows one transition. What it shows is simple: a dye filament whole along the tube, then beginning to waver, then mixing away entirely, and all three governed by one dimensionless number alone. Two things seldom mentioned deserve attention here. First, the limit of two thousand that everyone memorises is not a property of water but a property of disturbance. Leave the tube standing until it is truly quiet and the flow stays laminar into the tens of thousands; Reynolds himself reached thirteen thousand. Two thousand is a lower bound, where laminar flow can no longer damp even the smallest disturbance, and it is precisely that lower bound which is useful for design, because no field pipe is quiet. Second, the transition is not symmetric: a flow already turbulent stays turbulent down to a Reynolds number far below the one at which it first became turbulent. Flow has memory, and that memory appears in no formula written with a single critical number.",
  },
} as const;

const REFS = {
  id: [
    "Reynolds, O. (1883). An experimental investigation of the circumstances which determine whether the motion of water shall be direct or sinuous. Phil. Trans. R. Soc. 174, 935–982.",
    "Ekman, V.W. (1910). On the change from steady to turbulent motion of liquids. Ark. Mat. Astron. Fys. 6.",
    "Schlichting, H. (1979). Boundary-Layer Theory, edisi ke-7, bab 16.",
    "Avila, K. dkk. (2011). The onset of turbulence in pipe flow. Science 333, 192–196.",
  ],
  en: [
    "Reynolds, O. (1883). An experimental investigation of the circumstances which determine whether the motion of water shall be direct or sinuous. Phil. Trans. R. Soc. 174, 935–982.",
    "Ekman, V.W. (1910). On the change from steady to turbulent motion of liquids. Ark. Mat. Astron. Fys. 6.",
    "Schlichting, H. (1979). Boundary-Layer Theory, 7th ed., ch. 16.",
    "Avila, K. et al. (2011). The onset of turbulence in pipe flow. Science 333, 192–196.",
  ],
} as const;

export function PercobaanReynoldsClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Q, setQ] = useState(0.00006);
  const [D, setD] = useState(0.05);
  const [suhu, setSuhu] = useState(15);
  const [tenang, setTenang] = useState(0.4);

  const r = reynoldsExperiment(Q, D, suhu, tenang);
  const nama =
    r.regime === "laminar"
      ? x.laminar
      : r.regime === "peralihan"
        ? x.peralihan
        : x.turbulen;
  const warna =
    r.regime === "laminar"
      ? C.water
      : r.regime === "peralihan"
        ? C.critical
        : C.energy;
  const laminar = r.regime === "laminar";
  // ν tidak dikembalikan model; dihitung dengan fungsi yang sama.
  const nu = waterViscosity(suhu);
  const Rek = r.criticalReynolds;

  /* Pita dinamis dari reynoldsExperiment: laminar sampai Re_kr, peralihan
     sampai 2 Re_kr, lalu turbulen. Laminar dibelah di 2000 (batas bawah
     yang tetap) supaya tanda 2000 selalu terbaca di skala. */
  const bands: RegimeBand[] = [
    { from: RE_AXIS_MIN, to: Math.min(RE_LAMINAR_MAX, Rek), label: x.bLam, tone: "water" as Tone },
    { from: RE_LAMINAR_MAX, to: Rek, label: x.bLamTenang, tone: "water" as Tone },
    { from: Rek, to: 2 * Rek, label: x.bPeralihan, tone: "critical" as Tone },
    { from: 2 * Rek, to: RE_AXIS_MAX, label: x.bTurbulen, tone: "energy" as Tone },
  ].filter((b) => b.to > b.from);

  // Sisa persamaan Colebrook licin pada f yang dipakai model.
  const sisaCb = laminar
    ? NaN
    : 1 / Math.sqrt(r.friction) + 2 * Math.log10(2.51 / (r.reynolds * Math.sqrt(r.friction)));

  /*
   * Benang zat warnanya digambar dengan ayunan yang tumbuh sepanjang
   * tabung, dan besar ayunannya ditentukan seberapa jauh bilangan
   * Reynolds sudah melewati bilangan kritisnya. Bentuknya dihitung dari
   * deret tetap (filamentY), bukan dari bilangan acak, supaya gambarnya
   * tidak berkedip sendiri setiap kali lembar ini digambar ulang.
   */
  const lewat = r.criticalReynolds > 0 ? r.reynolds / r.criticalReynolds : 0;
  const kacau = Math.min(Math.max(lewat - 1, 0), 3) / 3;

  /* Lapis gerak (Phase 2): manik zat warna bergerak dengan kecepatan
     rata-rata model V = Q/A, dan pola gangguan benangnya hanyut dengan V
     juga. Waktu dibuat pangkat sepuluh supaya zat warna menempuh tabung
     dalam 3 sampai 30 detik layar, dan ditulis di catatan. Selagi bergerak
     benang lapis statis tidak digambar (namanya tetap). */
  const { playing, toggle: togglePutar } = usePutar();
  const gerak = useRef<ReynoldsMotion | null>(null);
  if (gerak.current === null) gerak.current = createReynoldsMotion();
  const bergerak = playing;
  const skalaWaktu = reynoldsTimeScale(r.velocity, PANJANG);
  const faktor = (v: number) =>
    Math.round(v).toLocaleString(lang === "id" ? "id-ID" : "en-US");
  const catatanGerak =
    skalaWaktu === 1
      ? x.motionReal
      : skalaWaktu > 1
        ? x.motionFast(faktor(skalaWaktu))
        : x.motionSlow(faktor(1 / skalaWaktu));

  const plate = usePlate(
    (ctx, w, ch) => {
      const R = D / 2;

      const benang: { x: number; y: number }[] = [];
      const n = 240;
      for (let i = 0; i <= n; i++) {
        const s = i / n;
        /* Ayunannya tumbuh ke hilir, karena gangguannya perlu waktu tumbuh. */
        benang.push({ x: PANJANG * s, y: filamentY(s, R, kacau) });
      }

      const garis: FieldLine[] = [
        {
          pts: [
            { x: 0, y: R },
            { x: PANJANG, y: R },
          ],
          color: C.ink,
          weight: W.bold,
          dash: DASH.solid,
          label: T.pipeWallLabel,
          labelAt: 0.06,
          labelDy: -9,
          labelAlign: "left",
        },
        {
          pts: [
            { x: 0, y: -R },
            { x: PANJANG, y: -R },
          ],
          color: C.ink,
          weight: W.bold,
          dash: DASH.solid,
        },
        {
          pts: [
            { x: 0, y: 0 },
            { x: PANJANG, y: 0 },
          ],
          color: C.ink3,
          weight: W.hair,
          dash: DASH.axis,
        },
        {
          pts: benang,
          color: warna,
          weight: W.bold,
          dash: DASH.solid,
          label: T.dyeFilament,
          labelAt: 0.62,
          labelDy: -12,
          labelAlign: "center",
          noStroke: bergerak,
        },
      ];

      const dims: FieldDim[] =
        r.entryLength < PANJANG
          ? [
              {
                axis: "h",
                at: -R * 1.28,
                from: 0,
                to: r.entryLength,
                text: `${T.entryLengthLabel} ${fmt(r.entryLength, 2)} m`,
                color: C.ink2,
                offset: 0,
              },
            ]
          : [];

      const titik: FieldMarker[] = [
        { x: 0, y: 0, color: warna, size: 4, filled: true },
      ];

      return drawField(
        ctx,
        w,
        ch,
        {
          xMin: -PANJANG * 0.04,
          xMax: PANJANG * 1.04,
          yMin: -R * 1.9,
          yMax: R * 1.5,
          equalScale: false,
          lines: garis,
          dims,
          markers: titik,
          heading: nama,
          headingColor: warna,
          axisX: T.axAlongPipe,
          axisY: T.axRadius,
        },
        lang
      );
    },
    (ctx, _w, _h, tt, dt, out) =>
      drawReynoldsMotion(
        ctx,
        tt,
        dt,
        out,
        { V: r.velocity, R: D / 2, length: PANJANG, kacau, color: warna, timeScale: skalaWaktu },
        gerak.current!
      ),
    [Q, D, suhu, tenang, lang, bergerak],
    { playing, timeScale: skalaWaktu }
  );

  return (
    <LabShell
      status={
        <RegimeScale symbol="Re" value={r.reynolds} scale="log" digits={0} bands={bands} />
      }
      sheet="PI-04"
      subject={SUBJECTS.PI[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Batas <Term tint={C.critical}>dua ribu</Term> bukan sifat air
            melainkan sifat gangguan. Tabung yang benar-benar{" "}
            <Term tint={C.water}>tenang</Term> tetap laminar sampai puluhan
            ribu.
          </p>
        ) : (
          <p>
            The limit of <Term tint={C.critical}>two thousand</Term> is not a
            property of water but of disturbance. A truly{" "}
            <Term tint={C.water}>quiet</Term> tube stays laminar into the tens
            of thousands.
          </p>
        )
      }
      drawing={
        <Sheet
          number="PI-04"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m/s, °C)" },
            { label: "Re", value: fmtSci(r.reynolds), tint: warna },
            { label: "Re,kr", value: fmtSci(r.criticalReynolds) },
            { label: "V", value: `${fmt(r.velocity, 3)} m/s` },
            { label: "f", value: fmt(r.friction, 4) },
          ]}
          motion={{
            playing,
            onToggle: togglePutar,
            allowed: plate.motionAllowed,
            note: catatanGerak,
          }}
        >
          <canvas ref={plate.ref} className="block h-full w-full" />
          <canvas ref={plate.motionRef} />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q * 1e6} min={1} max={20000} step={1} digits={0} unit="ml/s" onChange={(v) => setQ(v / 1e6)} tint={C.water} />
              <InputRow symbol="D" label={x.dD} value={D * 1000} min={5} max={200} step={1} digits={0} unit="mm" onChange={(v) => setD(v / 1000)} />
              <InputRow symbol="T" label={x.dT} value={suhu} min={0} max={40} step={1} digits={0} unit="°C" onChange={setSuhu} />
              <InputRow symbol="q" label={x.dQt} value={tenang} min={0} max={1} step={0.05} digits={2} onChange={setTenang} tint={C.critical} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pLaminar, apply: () => { setQ(0.00003); setD(0.05); setSuhu(15); setTenang(0.4); } },
                  { label: x.pPeralihan, apply: () => { setQ(0.0006); setD(0.05); setSuhu(15); setTenang(0.4); } },
                  { label: x.pTurbulen, apply: () => { setQ(0.002); setD(0.05); setSuhu(15); setTenang(0.4); } },
                  { label: x.pReynolds, apply: () => { setQ(0.0005); setD(0.05); setSuhu(15); setTenang(1); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "Re", label: x.rRe, value: fmtSci(r.reynolds), tint: warna, strong: true },
                { symbol: "Rekr", label: x.rRekrit, value: fmtSci(r.criticalReynolds), tint: C.critical, strong: true },
                { symbol: "V", label: x.rV, value: fmt(r.velocity, 4), unit: "m/s", tint: C.water },
                { symbol: "Vkr", label: x.rVkrit, value: fmt(r.criticalVelocity, 4), unit: "m/s", tint: C.critical },
                { symbol: "Le", label: x.rMasuk, value: fmt(r.entryLength, 3), unit: "m" },
                { symbol: "Le/D", label: x.rMasukD, value: fmt(r.entryDiameters, 1) },
                { symbol: "f", label: x.rF, value: fmt(r.friction, 5) },
                // Lapisan kental hanya ada pada aliran turbulen; laminar NaN → "—".
                { symbol: "δv", label: x.rTebal, value: fmt(r.viscousThickness, 3), unit: laminar ? undefined : "mm" },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hV,
                    rumus: (<><span>ν = ν(T),</span><span className="ml-2">V =</span><Frac num="Q" den="π D² / 4" /></>),
                    isi: `ν(${fmt(suhu, 0)} °C) = ${fmtSci(nu)};  ${fmtSci(Q)} / ( π · ${fmt(D, 3)}² / 4 )`,
                    hasil: fmt(r.velocity, 4),
                    satuan: "m/s",
                    tint: C.water,
                  },
                  {
                    judul: x.hRe,
                    rumus: (<><span>Re =</span><Frac num="V · D" den="ν" /></>),
                    isi: `${fmt(r.velocity, 5)} · ${fmt(D, 3)} / ${fmtSci(nu)}`,
                    hasil: fmtSci(r.reynolds),
                    tint: warna,
                  },
                  {
                    judul: x.hKrit,
                    rumus: (<><span>Re_kr = {fmt(RE_LAMINAR_MAX, 0)} · 50^q,</span><span className="ml-2">V_kr =</span><Frac num="Re_kr · ν" den="D" /></>),
                    isi: `${fmt(RE_LAMINAR_MAX, 0)} · 50^${fmt(tenang, 2)} = ${fmtSci(Rek)};  ${fmtSci(Rek)} · ${fmtSci(nu)} / ${fmt(D, 3)} = ${fmt(r.criticalVelocity, 4)} m/s`,
                    hasil: fmtSci(Rek),
                    tint: C.critical,
                  },
                  {
                    judul: `${x.hLe} (${nama.toLowerCase()})`,
                    rumus: laminar ? <span>Le = {fmt(0.06, 2)} · Re · D</span> : <span>Le = {fmt(4.4, 1)} · Re^(1/6) · D</span>,
                    isi: laminar
                      ? `${fmt(0.06, 2)} · ${fmtSci(r.reynolds)} · ${fmt(D, 3)}`
                      : `${fmt(4.4, 1)} · ( ${fmtSci(r.reynolds)} )^(1/6) · ${fmt(D, 3)}`,
                    hasil: fmt(r.entryLength, 3),
                    satuan: "m",
                  },
                  laminar
                    ? {
                        judul: x.hFLam,
                        rumus: (<><span>f =</span><Frac num="64" den="Re" /></>),
                        isi: `64 / ${fmtSci(r.reynolds)}`,
                        hasil: fmt(r.friction, 5),
                      }
                    : {
                        judul: x.hFTurb,
                        rumus: (<><Frac num="1" den="√f" /><span>+ 2 log₁₀(</span><Frac num={fmt(2.51, 2)} den="Re · √f" /><span>) ≈ 0</span></>),
                        isi: `1/√${fmt(r.friction, 6)} + 2 log₁₀( ${fmt(2.51, 2)} / ( ${fmtSci(r.reynolds)} · √${fmt(r.friction, 6)} ) ) = ${Math.abs(sisaCb) < 1e-9 ? fmt(0, 0) : fmtSci(sisaCb)}`,
                        hasil: fmt(r.friction, 5),
                      },
                  {
                    judul: x.hDelta,
                    rumus: (<><span>δv =</span><Frac num="5 ν" den="u*" /><span className="ml-2">u* = V √( f / 8 )</span></>),
                    isi: laminar ? "—" : `5 · ${fmtSci(nu)} / ( ${fmt(r.velocity, 4)} · √( ${fmt(r.friction, 5)} / 8 ) ) · 1000`,
                    hasil: fmt(r.viscousThickness, 3),
                    satuan: laminar ? undefined : "mm",
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={NADA[r.regime]}
            badge={r.quietLaminar ? x.tenangBadge : nama}
            {...notice(Q, D, suhu, tenang, lang)}
          />
        </>
      }
      verification={<Verification checks={checksReynoldsExp(Q, D, suhu, tenang)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Re =</span>
                <Frac num="V D" den="ν" />
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "nisbah gaya kelembaman terhadap gaya kental"
                    : "the ratio of inertial to viscous forces"}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "panjang masuk: 0,06 Re D pada laminar, 4,4 Re^(1/6) D pada turbulen"
                    : "entry length: 0.06 Re D when laminar, 4.4 Re^(1/6) D when turbulent"}
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
 * Isi kalimatnya sama dengan catatan lama satu paragraf; kalimat pertama
 * menyatakan keadaan, sisanya butir. Dua butir baru: panjang masuk yang
 * melebihi tabung dan kecepatan yang tidak mungkin dibuat.
 */
function notice(
  Q: number,
  D: number,
  suhu: number,
  tenang: number,
  lang: Lang
): { state: string; notice: string[] } {
  const x = TXT[lang];
  const a = reynoldsExperiment(Q, D, suhu, tenang);
  const kasar = reynoldsExperiment(Q, D, suhu, 0);
  const sunyi = reynoldsExperiment(Q, D, suhu, 1);
  const dingin = reynoldsExperiment(Q, D, 5, tenang);
  const panas = reynoldsExperiment(Q, D, 35, tenang);
  const nama =
    a.regime === "laminar" ? x.laminar : a.regime === "peralihan" ? x.peralihan : x.turbulen;

  const tambahan = [
    a.entryLength > PANJANG ? x.leLewat(fmt(a.entryLength, 2)) : "",
    a.velocity > V_WASPADA ? x.vCepat(fmt(a.velocity, 1)) : "",
  ];

  if (lang === "en")
    return {
      state: a.quietLaminar
        ? `Re = ${fmtSci(a.reynolds)} is above 4,000 yet the flow stays laminar because the experiment is quiet; the laminar limit here is ${fmtSci(a.criticalReynolds)}.`
        : `Re = ${fmtSci(a.reynolds)} at quietness ${fmt(tenang, 2)}: ${nama.toLowerCase()}; the laminar limit here is ${fmtSci(a.criticalReynolds)}.`,
      notice: [
        a.quietLaminar ? x.tenangNote : "",
        `Drag the quietness to zero, the state of a field pipe that vibrates, and the flow leaves laminar at ${fmtSci(kasar.criticalReynolds)}; drag it to one and it holds out to ${fmtSci(sunyi.criticalReynolds)}. The water has not changed at all, only its surroundings.`,
        `Temperature is the other lever and it works through viscosity alone: the same discharge gives ${fmtSci(dingin.reynolds)} at five degrees and ${fmtSci(panas.reynolds)} at thirty-five, so a pipe that is laminar in winter can be turbulent in summer.`,
        ...tambahan,
      ],
    };
  return {
    state: a.quietLaminar
      ? `Re = ${fmtSci(a.reynolds)} di atas 4.000 tetapi tetap laminar karena percobaannya tenang; batas laminar di sini ${fmtSci(a.criticalReynolds)}.`
      : `Re = ${fmtSci(a.reynolds)} pada ketenangan ${fmt(tenang, 2)}: ${nama.toLowerCase()}; batas laminar di sini ${fmtSci(a.criticalReynolds)}.`,
    notice: [
      a.quietLaminar ? x.tenangNote : "",
      `Tarik ketenangannya ke nol, yaitu keadaan pipa lapangan yang bergetar, dan alirannya meninggalkan laminar pada ${fmtSci(kasar.criticalReynolds)}; tarik ke satu dan ia bertahan sampai ${fmtSci(sunyi.criticalReynolds)}. Airnya sama sekali tidak berubah, yang berubah hanya sekelilingnya.`,
      `Suhu tuas yang satu lagi dan ia bekerja lewat kekentalan saja: debit yang sama memberi ${fmtSci(dingin.reynolds)} pada lima derajat dan ${fmtSci(panas.reynolds)} pada tiga puluh lima, jadi pipa yang laminar pada musim dingin dapat menjadi turbulen pada musim panas.`,
      ...tambahan,
    ],
  };
}
