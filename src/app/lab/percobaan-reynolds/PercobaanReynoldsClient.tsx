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
  drawField,
  type FieldDim,
  type FieldLine,
  type FieldMarker,
} from "@/lib/drawField";
import { fmt, fmtSci, reynoldsExperiment } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksReynoldsExp } from "@/lib/checks";

/** Panjang tabung kaca yang digambar, meter. */
const PANJANG = 2;

const TXT = {
  id: {
    title: "Percobaan Reynolds",
    sheetTitle: "Benang zat warna di dalam tabung kaca, sepanjang dua meter",
    dQ: "Debit",
    dD: "Garis tengah tabung",
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
    rMasukD: "Panjang masuk itu dalam kelipatan garis tengah",
    rF: "Faktor gesekan",
    rTebal: "Tebal lapisan kental di dinding",
    laminar: "Laminar",
    peralihan: "Peralihan",
    turbulen: "Turbulen",
    tenangNote:
      "Bilangan Reynolds sudah jauh melewati dua ribu, dan alirannya tetap laminar. Ini bukan cacat hitungan melainkan kenyataan percobaan: batas dua ribu bukan sifat air melainkan sifat gangguan yang ada di sekitarnya. Reynolds sendiri mencapai tiga belas ribu pada tabung kaca yang didiamkan berhari-hari sebelum percobaannya, dan percobaan berikutnya mencapai seratus ribu. Yang dua ribu itu batas bawah, yaitu bilangan tempat aliran laminar berhenti mampu meredam gangguan sekecil apa pun, dan itulah yang dipakai merancang pipa lapangan karena pipa lapangan memang tidak pernah tenang.",
    note:
      "Percobaan Reynolds tahun 1883 masih dipakai seperti hari pertama karena ia bukan mengukur satu angka melainkan memperlihatkan satu peralihan. Yang diperlihatkannya sederhana: benang zat warna yang utuh sepanjang tabung, lalu mulai berayun, lalu membaur seluruhnya, dan ketiganya diatur satu bilangan tak berdimensi saja. Dua hal yang jarang disebut pantas diperhatikan di sini. Pertama, batas dua ribu yang selalu dihafalkan bukan sifat air melainkan sifat gangguan. Kalau tabungnya didiamkan sampai benar-benar tenang, alirannya tetap laminar sampai puluhan ribu, dan Reynolds sendiri mencapai tiga belas ribu. Yang dua ribu adalah batas bawah, tempat aliran laminar tidak lagi sanggup meredam gangguan sekecil apa pun, dan justru batas bawah itulah yang berguna untuk merancang, karena tidak ada pipa lapangan yang tenang. Kedua, peralihannya tidak setangkup: aliran yang sudah turbulen tetap turbulen sampai bilangan Reynolds jauh lebih rendah daripada tempat ia pertama kali menjadi turbulen. Aliran punya ingatan, dan ingatan itu tidak muncul di rumus mana pun yang ditulis dengan satu bilangan kritis.",
  },
  en: {
    title: "Reynolds experiment",
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

  const ref = useCanvas(
    (ctx, w, ch) => {
      const R = D / 2;

      /*
       * Benang zat warnanya digambar dengan ayunan yang tumbuh sepanjang
       * tabung, dan besar ayunannya ditentukan seberapa jauh bilangan
       * Reynolds sudah melewati bilangan kritisnya. Bentuknya dihitung dari
       * deret tetap, bukan dari bilangan acak, supaya gambarnya tidak
       * berkedip sendiri setiap kali lembar ini digambar ulang.
       */
      const lewat = r.criticalReynolds > 0 ? r.reynolds / r.criticalReynolds : 0;
      const kacau = Math.min(Math.max(lewat - 1, 0), 3) / 3;
      const benang: { x: number; y: number }[] = [];
      const n = 240;
      for (let i = 0; i <= n; i++) {
        const s = i / n;
        const xx = PANJANG * s;
        /* Ayunannya tumbuh ke hilir, karena gangguannya perlu waktu tumbuh. */
        const tumbuh = kacau * s * s;
        const y =
          R *
          0.34 *
          tumbuh *
          (Math.sin(28 * s) + 0.6 * Math.sin(61 * s + 1.1) + 0.35 * Math.sin(133 * s + 2.3));
        benang.push({ x: xx, y: Math.max(-R * 0.94, Math.min(R * 0.94, y)) });
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

      drawField(
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
    [Q, D, suhu, tenang, lang]
  );

  return (
    <LabShell
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
        >
          <canvas ref={ref} className="block h-full w-full" />
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
            <div className="mb-2.5">
              <Flag tint={warna}>{nama}</Flag>
            </div>
            {r.quietLaminar && (
              <div className="mb-2.5">
                <Note>{x.tenangNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "Re", label: x.rRe, value: fmtSci(r.reynolds), tint: warna, strong: true },
                { symbol: "V", label: x.rV, value: fmt(r.velocity, 4), unit: "m/s", tint: C.water },
                { symbol: "Vkr", label: x.rVkrit, value: fmt(r.criticalVelocity, 4), unit: "m/s", tint: C.critical },
                { symbol: "Rekr", label: x.rRekrit, value: fmtSci(r.criticalReynolds), tint: C.critical, strong: true },
                { symbol: "Le", label: x.rMasuk, value: fmt(r.entryLength, 3), unit: "m" },
                { symbol: "Le/D", label: x.rMasukD, value: fmt(r.entryDiameters, 1) },
                { symbol: "f", label: x.rF, value: fmt(r.friction, 5) },
                { symbol: "δv", label: x.rTebal, value: fmt(r.viscousThickness, 3), unit: "mm" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(Q, D, suhu, tenang, lang)}</Note>
          </Block>
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

function notice(Q: number, D: number, suhu: number, tenang: number, lang: Lang) {
  const a = reynoldsExperiment(Q, D, suhu, tenang);
  const kasar = reynoldsExperiment(Q, D, suhu, 0);
  const sunyi = reynoldsExperiment(Q, D, suhu, 1);
  const dingin = reynoldsExperiment(Q, D, 5, tenang);
  const panas = reynoldsExperiment(Q, D, 35, tenang);

  if (lang === "en")
    return `At this discharge the Reynolds number is ${fmtSci(a.reynolds)}. Drag the quietness to zero, the state of a field pipe that vibrates, and the flow leaves laminar at ${fmtSci(kasar.criticalReynolds)}; drag it to one and it holds out to ${fmtSci(sunyi.criticalReynolds)}. The water has not changed at all, only its surroundings. Temperature is the other lever and it works through viscosity alone: the same discharge gives ${fmtSci(dingin.reynolds)} at five degrees and ${fmtSci(panas.reynolds)} at thirty-five, so a pipe that is laminar in winter can be turbulent in summer.`;
  return `Pada debit ini bilangan Reynoldsnya ${fmtSci(a.reynolds)}. Tarik ketenangannya ke nol, yaitu keadaan pipa lapangan yang bergetar, dan alirannya meninggalkan laminar pada ${fmtSci(kasar.criticalReynolds)}; tarik ke satu dan ia bertahan sampai ${fmtSci(sunyi.criticalReynolds)}. Airnya sama sekali tidak berubah, yang berubah hanya sekelilingnya. Suhu tuas yang satu lagi dan ia bekerja lewat kekentalan saja: debit yang sama memberi ${fmtSci(dingin.reynolds)} pada lima derajat dan ${fmtSci(panas.reynolds)} pada tiga puluh lima, jadi pipa yang laminar pada musim dingin dapat menjadi turbulen pada musim panas.`;
}
