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
import { drawPitot } from "@/lib/drawPitot";
import {
  fmt,
  pitotHead,
  pitotVelocity,
  powerLawMeanRadius,
  powerLawMeanRatio,
  powerLawVelocity,
} from "@/lib/hydraulics";
import { C } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksPitot } from "@/lib/checks";

const TXT = {
  id: {
    title: "Tabung Pitot",
    sheetTitle: "Tabung Pitot statik di dalam pipa — potongan dan profil kecepatan",
    ddh: "Beda tinggi tekan terbaca di sumbu",
    dD: "Garis tengah pipa",
    dn: "Pangkat pada hukum pangkat",
    dr: "Jarak ujung tabung dari sumbu",
    pSumbu: "Bacaan di sumbu",
    pAcuan: "Bacaan di jari-jari acuan",
    pDinding: "Bacaan dekat dinding",
    rU: "Kecepatan setempat di ujung tabung",
    rUmax: "Kecepatan di sumbu pipa",
    rUmean: "Kecepatan rata-rata penampang",
    rRasio: "Perbandingan rata-rata terhadap sumbu",
    rQ: "Debit",
    rRmean: "Jari-jari acuan satu titik",
    rSalah: "Kesalahan bila bacaan sumbu dianggap rata-rata",
    rDh: "Beda tinggi tekan di ujung tabung",
    dekatDinding: "Ujung tabung terlalu dekat dinding",
    dekatDindingNote:
      "Hukum pangkat tidak berlaku di dekat dinding. Turunan profilnya di dinding menjadi tak hingga, padahal kenyataannya di sana ada lapisan tipis tempat kekentalan menguasai dan kecepatannya turun mulus ke nol. Bacaan pada kedalaman ini tidak boleh dipakai. Tarik tabungnya menjauh dari dinding.",
    note:
      "Alat ini mengukur satu titik, dan seluruh persoalannya berasal dari kenyataan itu. Lubang depan menghadap aliran dan menahannya sampai berhenti, sehingga ia membaca tekanan stagnasi; lubang samping membaca tekanan statik. Selisih keduanya persis tinggi kecepatan, tanpa koefisien yang perlu dikalibrasi, dan itulah kekuatan tabung Pitot. Kelemahannya juga persis di situ: yang terbaca kecepatan di satu titik, bukan debit. Mengubah satu bacaan menjadi debit memerlukan pengetahuan tentang bentuk profilnya. Pada aliran turbulen di pipa licin, profil itu mengikuti hukum pangkat, dan dari bentuk itu dapat diturunkan dua angka yang menyelesaikan persoalan. Pertama, kecepatan rata-rata penampang selalu 0,8167 kali kecepatan di sumbu untuk pangkat satu per tujuh. Kedua, ada satu jari-jari tempat kecepatan setempat kebetulan sama dengan kecepatan rata-rata, dan letaknya sekitar 0,758 kali jari-jari pipa. Meletakkan tabung di situ membuat satu bacaan langsung menjadi kecepatan rata-rata tanpa faktor koreksi apa pun, dan itulah yang dilakukan juru ukur yang hanya sempat mengambil satu titik.",
  },
  en: {
    title: "Pitot tube",
    sheetTitle: "Pitot-static tube in a pipe — section and velocity profile",
    ddh: "Head difference read on the axis",
    dD: "Pipe diameter",
    dn: "Exponent of the power law",
    dr: "Probe tip distance from the axis",
    pSumbu: "Reading on the axis",
    pAcuan: "Reading at the reference radius",
    pDinding: "Reading near the wall",
    rU: "Local velocity at the probe tip",
    rUmax: "Velocity on the pipe axis",
    rUmean: "Mean velocity over the section",
    rRasio: "Ratio of mean to centreline",
    rQ: "Discharge",
    rRmean: "Single-point reference radius",
    rSalah: "Error if the axis reading is taken as the mean",
    rDh: "Head difference at the probe tip",
    dekatDinding: "Probe tip too close to the wall",
    dekatDindingNote:
      "The power law does not hold near the wall. Its derivative at the wall becomes infinite, whereas in reality there is a thin layer where viscosity takes over and the velocity falls smoothly to zero. A reading at this depth must not be used. Pull the probe away from the wall.",
    note:
      "This instrument measures a single point, and every difficulty with it comes from that fact. The forward port faces the flow and brings it to rest, so it reads stagnation pressure; the side port reads static pressure. The difference between them is exactly the velocity head, with no coefficient to calibrate, and that is the strength of a Pitot tube. Its weakness sits in the same place: what is read is the velocity at one point, not the discharge. Turning one reading into a discharge requires knowing the shape of the profile. In turbulent flow through a smooth pipe that profile follows a power law, and from its shape two numbers follow that settle the problem. First, the mean velocity over the section is always 0.8167 times the centreline velocity for the one-seventh power. Second, there is one radius where the local velocity happens to equal the mean, and it lies at about 0.758 of the pipe radius. Placing the probe there turns a single reading directly into the mean velocity with no correction factor at all, and that is what a gauger with time for only one point does.",
  },
} as const;

const REFS = {
  id: [
    "ISO 3966. Measurement of fluid flow in closed conduits — Velocity area method using Pitot static tubes.",
    "Schlichting, H. (1979). Boundary-Layer Theory, edisi ke-7. McGraw-Hill. Bab tentang aliran turbulen di pipa.",
    "White, F.M. (2011). Fluid Mechanics, edisi ke-7. McGraw-Hill. Bab 6.",
    "Prandtl, L. (1925). Bericht uber Untersuchungen zur ausgebildeten Turbulenz. ZAMM.",
  ],
  en: [
    "ISO 3966. Measurement of fluid flow in closed conduits — Velocity area method using Pitot static tubes.",
    "Schlichting, H. (1979). Boundary-Layer Theory, 7th ed. McGraw-Hill. Chapter on turbulent pipe flow.",
    "White, F.M. (2011). Fluid Mechanics, 7th ed. McGraw-Hill. Chapter 6.",
    "Prandtl, L. (1925). Bericht uber Untersuchungen zur ausgebildeten Turbulenz. ZAMM.",
  ],
} as const;

export function TabungPitotClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [dh, setDh] = useState(0.3);
  const [D, setD] = useState(0.2);
  const [n, setN] = useState(7);
  const [rFrac, setRFrac] = useState(0);

  const R = D / 2;
  const uMax = pitotVelocity(dh);
  const rasio = powerLawMeanRatio(n);
  const uMean = uMax * rasio;
  const rMean = powerLawMeanRadius(R, n);
  const rProbe = rFrac * R;
  const uProbe = powerLawVelocity(rProbe, R, uMax, n);
  const Q = uMean * Math.PI * R * R;
  const dekatDinding = Math.abs(rFrac) > 0.95;

  const ref = useCanvas(
    (ctx, w, h) =>
      drawPitot(
        ctx,
        w,
        h,
        { D, uMax, uMean, n, rProbe, rMean, uProbe },
        lang
      ),
    [dh, D, n, rFrac, lang]
  );

  return (
    <LabShell
      sheet="FM-03"
      subject={SUBJECTS.FM[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Satu lubang menghadap aliran dan menahannya sampai berhenti, satu
            lubang lagi membaca tekanan di samping. Selisih keduanya persis{" "}
            <Term tint={C.energy}>tinggi kecepatan</Term>, tanpa koefisien yang
            perlu dikalibrasi. Yang sulit bukan mengukurnya, melainkan
            mengubah satu titik menjadi debit.
          </p>
        ) : (
          <p>
            One port faces the flow and brings it to rest, another reads the
            pressure at the side. The difference between them is exactly the{" "}
            <Term tint={C.energy}>velocity head</Term>, with no coefficient to
            calibrate. The hard part is not the measurement but turning one
            point into a discharge.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FM-03"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m/s)" },
            { label: "Δh", value: `${fmt(dh, 4)} m`, tint: C.energy },
            { label: "u_max", value: `${fmt(uMax, 3)} m/s`, tint: C.water },
            { label: "V", value: `${fmt(uMean, 3)} m/s`, tint: C.energy },
            { label: "Q", value: `${fmt(Q * 1000, 1)} l/s`, tint: C.water },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Δh" label={x.ddh} value={dh} min={0.005} max={2} step={0.005} digits={3} unit="m" onChange={setDh} tint={C.energy} />
              <InputRow symbol="D" label={x.dD} value={D * 1000} min={25} max={800} step={5} digits={0} unit="mm" onChange={(v) => setD(v / 1000)} />
              <InputRow symbol="n" label={x.dn} value={n} min={5} max={10} step={1} digits={0} onChange={setN} />
              <InputRow symbol="r/R" label={x.dr} value={rFrac} min={-1} max={1} step={0.01} digits={2} onChange={setRFrac} tint={C.signal} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pSumbu, apply: () => { setDh(0.3); setD(0.2); setN(7); setRFrac(0); } },
                  { label: x.pAcuan, apply: () => { setDh(0.3); setD(0.2); setN(7); setRFrac(0.76); } },
                  { label: x.pDinding, apply: () => { setDh(0.3); setD(0.2); setN(7); setRFrac(0.97); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={C.water}>{`${fmt(uProbe, 3)} m/s`}</Flag>
              {dekatDinding && <Flag alert>{x.dekatDinding}</Flag>}
            </div>
            {dekatDinding && (
              <div className="mb-2.5">
                <Note>{x.dekatDindingNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "u", label: x.rU, value: fmt(uProbe, 4), unit: "m/s", tint: C.signal, strong: true },
                { symbol: "Δhᵣ", label: x.rDh, value: fmt(pitotHead(uProbe), 4), unit: "m", tint: C.energy },
                { symbol: "u₀", label: x.rUmax, value: fmt(uMax, 4), unit: "m/s", tint: C.water },
                { symbol: "V", label: x.rUmean, value: fmt(uMean, 4), unit: "m/s", tint: C.energy, strong: true },
                { symbol: "V/u₀", label: x.rRasio, value: fmt(rasio, 4) },
                { symbol: "r*", label: x.rRmean, value: fmt(rMean / R, 4), unit: "R", tint: C.critical },
                { symbol: "Q", label: x.rQ, value: fmt(Q * 1000, 2), unit: "l/s", tint: C.water },
                { symbol: "ε", label: x.rSalah, value: fmt((1 / rasio - 1) * 100, 1), unit: "%", tint: C.signal },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(rFrac, rMean / R, rasio, n, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksPitot(dh, D, n)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Δh =</span>
                <Frac num="V²" den="2g" />
                <span className="ml-5">V = √(2 g Δh)</span>
                <span className="ml-5">
                  u = u₀ (1 − r/R)^(1/n)
                </span>
              </Eq>
              <Eq>
                <Frac num="V" den="u₀" />
                <span>=</span>
                <Frac num="2 n²" den="(n + 1)(2n + 1)" />
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "hasil integrasi profil pada penampang lingkaran"
                    : "the profile integrated over a circular section"}
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
  rFrac: number,
  rMeanFrac: number,
  rasio: number,
  n: number,
  lang: Lang
): string {
  const diAcuan = Math.abs(Math.abs(rFrac) - rMeanFrac) < 0.02;
  const diSumbu = Math.abs(rFrac) < 0.02;

  if (lang === "en") {
    if (diAcuan)
      return `The probe now sits at the reference radius, ${rMeanFrac.toFixed(3)} of the pipe radius, and the reading at the tip has become the mean velocity itself. No correction factor is applied and none is needed. Notice that this radius depends only on the exponent, not on the velocity or the pipe size, so it can be marked on the probe once and used again.`;
    if (diSumbu)
      return `The probe sits on the axis, where the reading is largest and easiest to take. Taking that reading as the mean would overstate the discharge by ${((1 / rasio - 1) * 100).toFixed(1)} per cent, which is why the ratio ${rasio.toFixed(4)} exists. Move the probe out to the reference radius and watch the correction disappear.`;
    return `The reading here is a local velocity and nothing more. To turn it into a discharge you would need either the whole profile or one of the two shortcuts: the ratio ${rasio.toFixed(4)} applied to a centreline reading, or a single reading taken at ${rMeanFrac.toFixed(3)} of the radius. Change the exponent from ${n} and watch both shortcuts move together, because both come from the same integral.`;
  }

  if (diAcuan)
    return `Tabungnya sekarang berada di jari-jari acuan, ${rMeanFrac.toFixed(3)} kali jari-jari pipa, dan bacaan di ujungnya sudah menjadi kecepatan rata-rata itu sendiri. Tidak ada faktor koreksi yang dipakai, dan memang tidak diperlukan. Perhatikan jari-jari ini hanya bergantung pada pangkatnya, bukan pada kecepatan maupun ukuran pipa, sehingga cukup ditandai sekali pada batang tabungnya lalu dipakai berulang.`;
  if (diSumbu)
    return `Tabungnya berada di sumbu pipa, tempat bacaannya paling besar dan paling mudah diambil. Menganggap bacaan itu sebagai kecepatan rata-rata akan membesarkan debit sebesar ${((1 / rasio - 1) * 100).toFixed(1)} persen, dan itulah sebabnya perbandingan ${rasio.toFixed(4)} ada. Geser tabungnya ke jari-jari acuan, lalu perhatikan koreksinya lenyap.`;
  return `Bacaan di sini kecepatan setempat, tidak lebih. Mengubahnya menjadi debit memerlukan seluruh profilnya, atau salah satu dari dua jalan pintas: perbandingan ${rasio.toFixed(4)} yang dikenakan pada bacaan di sumbu, atau satu bacaan yang diambil pada ${rMeanFrac.toFixed(3)} kali jari-jari. Ubah pangkatnya dari ${n}, lalu perhatikan kedua jalan pintas itu bergerak bersamaan, karena keduanya datang dari integral yang sama.`;
}
