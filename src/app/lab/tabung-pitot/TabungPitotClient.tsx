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
} from "@/components/ui";
import { DragLayer, type HandleSpec } from "@/components/DragLayer";
import { usePlate } from "@/lib/usePlate";
import type { ParamDef } from "@/lib/rentang";
import { drawPitot } from "@/lib/drawPitot";
import {
  G,
  fmt,
  pitotHead,
  pitotVelocity,
  powerLawMeanRadius,
  powerLawMeanRatio,
  powerLawVelocity,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksPitot } from "@/lib/checks";
import { LembarPraktikum } from "@/components/Praktikum";
import { GrafikPraktikum } from "@/components/GrafikPraktikum";
import type { LangkahHitung, ResultRow } from "@/components/ui";
import type { ChartSpec } from "@/lib/drawChart";
import {
  KOLOM_EKSPOR_FM03,
  KOLOM_FM03,
  M_DINDING,
  R_DINDING_MAKS,
  catatFm03,
  ringkasFm03,
  tolakFm03,
  type BacaanFm03,
} from "@/data/praktikum/fm03";

const TXT = {
  id: {
    title: "Tabung Pitot",
    sheetTitle: "Tabung Pitot statik di dalam pipa — potongan dan profil kecepatan",
    gR: "Ujung tabung Pitot, seret naik atau turun untuk mengubah letaknya r/R",
    ddh: "Beda tinggi tekan terbaca di sumbu",
    dD: "Diameter pipa",
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
    bandPangkat: "Profil pangkat berlaku",
    bandAcuan: "Jari-jari acuan",
    bandDinding: "Dekat dinding",
    diAcuan: "Di jari-jari acuan",
    diSumbu: "Di sumbu pipa",
    setempat: "Bacaan setempat",
    hU0: "Kecepatan di sumbu dari beda tinggi tekan",
    hRasio: "Perbandingan rata-rata terhadap sumbu",
    hQ: "Debit",
    hU: "Kecepatan dan beda tinggi tekan di ujung tabung",
    hR: "Jari-jari acuan dan kesalahan bacaan sumbu",
    pAtur: "Letak ujung tabung (geser di sini atau seret di gambar)",
    pTolak:
      "Ujung tabung di luar 0,95 R, terlalu dekat dinding: hukum pangkat tidak berlaku di sana dan bacaannya tidak boleh dipakai. Tarik tabung ke arah sumbu dulu.",
    pQ: "Debit cara kecepatan-luas, zona dinding m = 7",
    pQm: "Debit model lembar",
    pSelisih: "Selisih terhadap debit model",
    pQnol: "Debit bila profil ditutup u = 0 di dinding",
    pSelisihNol: "Selisih cara tutup nol terhadap model",
    pV: "Kecepatan rata-rata penampang, Q/A",
    pN: "Jumlah titik",
    pNVal: (k: number, sisi: number) => `${k} titik, ${sisi} sisi`,
    pSedikit:
      "Titiknya baru satu atau dua, jadi profil belum terbentuk dan debit ini hampir seluruhnya bersandar pada anggapan zona dinding. Catat paling sedikit lima letak dari sumbu sampai 0,95 R.",
    pSatuSisi:
      "Baru satu sisi garis tengah yang dibaca, jadi profil dianggap simetri putar. Baca juga sisi seberang; bila kedua sisi berbeda, debitnya diambil dari rata-rata kedua sisi.",
    pTanpaSumbu:
      "Sumbu pipa belum dibaca. Dari sumbu sampai titik terdekat kecepatan dianggap sama dengan kecepatan titik itu.",
    pJauh: (sm: string) =>
      `Titik terjauh baru di ${sm} R. Zona dinding yang dihitung dengan anggapan m/(m+1) masih lebar; baca sampai 0,9 atau 0,95 R.`,
    pCampur:
      "Baris di tabel dicatat pada lebih dari satu keadaan aliran (Δh di sumbu, D, atau n berubah). Satu traverse harus satu keadaan; kosongkan tabel untuk seri baru. Debit model diambil dari baris terakhir.",
    pNol: (z: string, nol: string) =>
      `Menutup profil dengan garis lurus ke u = 0 di dinding memberi selisih ${nol} % terhadap model, cara zona dinding ${z} %. Profil turbulen menukik tajam di dekat dinding, jadi garis lurus memotong sebagian luasnya.`,
    hDhT: "Beda tinggi tekan dari dua tabung",
    hUT: "Kecepatan setempat di titik ini",
    hZona: (no: number) => `Zona dinding, sisi ${no}`,
    hInti: (no: number) => `Inti, sisi ${no}: trapesium atas r·u`,
    hQT: "Debit cara kecepatan-luas, rata-rata sisi",
    hQRumus: "Q = rata-rata sisi ( Qᵢ + Q_z )",
    titik: "titik",
    sisiNama: ["kanan, r ≥ 0", "kiri, r ≤ 0"],
    axU: "kecepatan setempat u, m/s",
    axR: "letak ujung tabung r/R",
    gBacaan: "bacaan",
    gModel: "profil model",
    gDinding: "dekat dinding",
    gRingkas: (k: number) =>
      k === 0
        ? "Grafik profil kecepatan: belum ada titik terukur; garis putus-putus adalah profil model lembar."
        : `Grafik profil kecepatan: ${k} titik terukur dari tabel pengamatan, dibandingkan dengan profil model lembar.`,
    langkahP: [
      "Catat diameter pipa D. Selama satu traverse bukaan katup tetap, jadi Δh di sumbu, D, dan n tidak diubah.",
      "Pasang tabung Pitot statik pada garis tengah pipa, lubang depan menghadap aliran, lalu keluarkan gelembung udara dari selang manometer.",
      "Letakkan ujung tabung di sumbu (r/R = 0) dan tekan Catat bacaan: tabung tekanan total hₜ dan tabung statik hₛ dibaca terpisah.",
      "Pindahkan ujung tabung ke letak berikutnya dan catat lagi. Letak yang disarankan 0,3; 0,5; 0,7; 0,8; 0,9; 0,95 R di kedua sisi sumbu, makin rapat ke dinding karena profil berubah cepat di sana.",
      "Perhatikan profil terbangun di grafik. Titik yang keluar dari pola diperiksa, lalu dihapus bila salah catat.",
      "Bandingkan debit cara kecepatan-luas dengan debit model, lalu unduh tabel sebelum menutup halaman.",
    ],
    aManometer:
      "Manometer: tabung tekanan total dan tabung statik dibaca terpisah pada skala bergaris 1 mm (Armfield H12). Galat baca σ = 0,5 mm per tabung (usulan, belum ditelaah), jadi galat Δh sekitar 0,8 mm. Muka air tabung statik diletakkan 100 mm di atas nol skala.",
    aCp:
      "Koefisien tabung Pitot statik dianggap 1, sama dengan lembar. Ukuran ujung tabung, pengaruh gradien kecepatan, dan turbulensi tidak dimodelkan.",
    aProfil:
      "Nilai benar di tiap letak diambil dari profil hukum pangkat lembar, u = u₀ (1 − |r|/R)^(1/n). Bacaan di luar 0,95 R tidak dibuat karena hukum pangkat tidak berlaku di sana.",
    aZona:
      "Anggapan lembar untuk debit: trapesium atas r·u di antara titik terukur, dan zona dinding dengan kecepatan rata-rata m/(m+1) kali kecepatan titik terakhir, m = 7 (bentuk zona tepi pada ISO 748; naskah ISO 3966 tidak dapat dibuka). Juru ukur tidak tahu n lembar, jadi m tidak ikut penggeser n.",
    dekatDindingNote:
      "Hukum pangkat tidak berlaku di dekat dinding. Turunan profilnya di dinding menjadi tak hingga, padahal kenyataannya di sana ada lapisan tipis tempat kekentalan menguasai dan kecepatannya turun mulus ke nol. Bacaan pada kedalaman ini tidak boleh dipakai. Tarik tabungnya menjauh dari dinding.",
    note:
      "Alat ini mengukur satu titik, dan seluruh persoalannya berasal dari kenyataan itu. Lubang depan menghadap aliran dan menahannya sampai berhenti, sehingga ia membaca tekanan stagnasi; lubang samping membaca tekanan statik. Selisih keduanya persis tinggi kecepatan, tanpa koefisien yang perlu dikalibrasi, dan itulah kekuatan tabung Pitot. Kelemahannya juga persis di situ: yang terbaca kecepatan di satu titik, bukan debit. Mengubah satu bacaan menjadi debit memerlukan pengetahuan tentang bentuk profilnya. Pada aliran turbulen di pipa licin, profil itu mengikuti hukum pangkat, dan dari bentuk itu dapat diturunkan dua angka yang menyelesaikan persoalan. Pertama, kecepatan rata-rata penampang selalu 0,8167 kali kecepatan di sumbu untuk pangkat satu per tujuh. Kedua, ada satu jari-jari tempat kecepatan setempat kebetulan sama dengan kecepatan rata-rata, dan letaknya sekitar 0,758 kali jari-jari pipa. Meletakkan tabung di situ membuat satu bacaan langsung menjadi kecepatan rata-rata tanpa faktor koreksi apa pun, dan itulah yang dilakukan juru ukur yang hanya sempat mengambil satu titik.",
  },
  en: {
    gR: "Pitot tube tip, drag up or down to change its position r/R",
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
    bandPangkat: "Power law holds",
    bandAcuan: "Reference radius",
    bandDinding: "Near the wall",
    diAcuan: "At the reference radius",
    diSumbu: "On the pipe axis",
    setempat: "Local reading",
    hU0: "Centreline velocity from the head difference",
    hRasio: "Ratio of mean to centreline",
    hQ: "Discharge",
    hU: "Velocity and head difference at the probe tip",
    hR: "Reference radius and the error of an axis reading",
    pAtur: "Probe tip position (move here or drag on the drawing)",
    pTolak:
      "The probe tip is beyond 0.95 R, too close to the wall: the power law does not hold there and the reading must not be used. Pull the probe back toward the axis first.",
    pQ: "Velocity-area discharge, wall zone m = 7",
    pQm: "Sheet model discharge",
    pSelisih: "Difference from the model discharge",
    pQnol: "Discharge if the profile is closed at u = 0 on the wall",
    pSelisihNol: "Difference of the closed-to-zero method from the model",
    pV: "Mean velocity over the section, Q/A",
    pN: "Number of points",
    pNVal: (k: number, sisi: number) => `${k} points, ${sisi} ${sisi === 1 ? "side" : "sides"}`,
    pSedikit:
      "There are only one or two points, so the profile has not formed yet and this discharge rests almost entirely on the wall-zone assumption. Record at least five positions from the axis out to 0.95 R.",
    pSatuSisi:
      "Only one side of the diameter has been read, so the profile is taken as axisymmetric. Read the opposite side too; if the two sides differ, the discharge is the mean of both.",
    pTanpaSumbu:
      "The pipe axis has not been read. From the axis to the nearest point the velocity is taken equal to that point.",
    pJauh: (sm: string) =>
      `The outermost point is only at ${sm} R. The wall zone computed with the m/(m+1) assumption is still wide; read out to 0.9 or 0.95 R.`,
    pCampur:
      "The rows were recorded at more than one flow state (axis head difference, D, or n changed). One traverse must be one state; clear the table for a new series. The model discharge is taken from the last row.",
    pNol: (z: string, nol: string) =>
      `Closing the profile with a straight line to u = 0 on the wall gives ${nol} % against the model, the wall-zone method ${z} %. A turbulent profile drops steeply near the wall, so the straight line cuts away part of the area.`,
    hDhT: "Head difference from the two tubes",
    hUT: "Local velocity at this point",
    hZona: (no: number) => `Wall zone, side ${no}`,
    hInti: (no: number) => `Core, side ${no}: trapezium on r·u`,
    hQT: "Velocity-area discharge, mean of the sides",
    hQRumus: "Q = mean over sides ( Qᵢ + Q_z )",
    titik: "points",
    sisiNama: ["right, r ≥ 0", "left, r ≤ 0"],
    axU: "local velocity u, m/s",
    axR: "probe tip position r/R",
    gBacaan: "readings",
    gModel: "model profile",
    gDinding: "near the wall",
    gRingkas: (k: number) =>
      k === 0
        ? "Velocity profile chart: no measured points yet; the dashed line is the sheet's model profile."
        : `Velocity profile chart: ${k} measured points from the observation table, compared with the sheet's model profile.`,
    langkahP: [
      "Note the pipe diameter D. Keep the valve opening fixed for one traverse, so the axis head difference, D, and n do not change.",
      "Mount the Pitot-static tube on a pipe diameter with the forward port facing the flow, and bleed air from the manometer lines.",
      "Put the probe tip on the axis (r/R = 0) and press Record reading: the total-pressure tube hₜ and the static tube hₛ are read separately.",
      "Move the probe tip to the next position and record again. Suggested positions are 0.3, 0.5, 0.7, 0.8, 0.9, 0.95 R on both sides of the axis, closer together toward the wall where the profile changes fast.",
      "Watch the profile build on the chart. Check any point that leaves the pattern and delete it if it was mis-recorded.",
      "Compare the velocity-area discharge with the model discharge, then download the table before closing the page.",
    ],
    aManometer:
      "Manometer: the total-pressure tube and the static tube are read separately on a scale graduated in 1 mm (Armfield H12). Reading error σ = 0.5 mm per tube (proposed, not yet reviewed), so the error in Δh is about 0.8 mm. The static tube level sits 100 mm above the scale zero.",
    aCp:
      "The Pitot-static tube coefficient is taken as 1, as on the sheet. Probe size, velocity-gradient effects, and turbulence are not modelled.",
    aProfil:
      "The true value at each position comes from the sheet's power-law profile, u = u₀ (1 − |r|/R)^(1/n). No readings are made beyond 0.95 R because the power law does not hold there.",
    aZona:
      "Sheet assumption for the discharge: a trapezium on r·u between measured points, and a wall zone whose mean velocity is m/(m+1) times the last point's velocity, m = 7 (the edge-zone form of ISO 748; the ISO 3966 text could not be opened). The gauger does not know the sheet's n, so m does not follow the n slider.",
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

/*
 * Letak ujung tabung r/R: satu definisi untuk penggeser, kotak angka, dan
 * pegangan seret di ujung tabung (aturan 4, satu sumber nilai).
 */
const P_R: ParamDef = { min: -1, max: 1, step: 0.01, digits: 2 };

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
  const rStar = rMean / R;
  const salah = (1 / rasio - 1) * 100;
  const diAcuan = Math.abs(Math.abs(rFrac) - rStar) < 0.02;
  const diSumbu = Math.abs(rFrac) < 0.02;
  const A = Math.PI * R * R;

  const sentuh = useRef<() => void>(() => {});
  const plate = usePlate(
    (ctx, w, h) =>
      drawPitot(
        ctx,
        w,
        h,
        { D, uMax, uMean, n, rProbe, rMean, uProbe },
        lang
      ),
    null,
    [dh, D, n, rFrac, lang]
  );

  /*
   * Pegangan ujung tabung (anchor `probe`, titik stagnasi). Sumbu tegak
   * potongan pipa adalah jari-jari, dan skalanya hanya bergantung pada D
   * (rMax = 1,5 R), bukan pada letak tabung: tanpa kunci skala, jari
   * memberi r = invY(py) langsung, r/R = invY(py)/R. Hanya tegak.
   */
  const handles: HandleSpec[] = [
    {
      id: "ujung",
      anchor: "probe",
      axis: "y",
      label: x.gR,
      // Sama dengan tint baris r/R: merah sinyal hanya saat terlalu dekat dinding.
      tint: dekatDinding ? C.signal : undefined,
      param: P_R,
      value: rFrac,
      toValue: (_px, py, m) => m.invY(py) / R,
      onChange: setRFrac,
      format: (v) => `r/R ${fmt(v, 2)}`,
    },
  ];

  const langkah = [
    {
      judul: x.hU0,
      rumus: <span>u₀ = √( 2 g Δh )</span>,
      isi: `√( 2 · ${fmt(G, 2)} · ${fmt(dh, 3)} )`,
      hasil: fmt(uMax, 4),
      satuan: "m/s",
      tint: C.water,
    },
    {
      judul: x.hRasio,
      rumus: (<><span>V / u₀ =</span><Frac num="2 n²" den="( n + 1 )( 2n + 1 )" /><span className="ml-3">V = u₀ · ( V / u₀ )</span></>),
      isi: `2 · ${fmt(n, 0)}² / ( ${fmt(n + 1, 0)} · ${fmt(2 * n + 1, 0)} ) = ${fmt(rasio, 4)} ;  ${fmt(uMax, 4)} · ${fmt(rasio, 4)}`,
      hasil: fmt(uMean, 4),
      satuan: "m/s",
      tint: C.energy,
    },
    {
      judul: x.hQ,
      rumus: <span>Q = V · π R²</span>,
      isi: `${fmt(uMean, 4)} · π · ${fmt(R, 4)}² = ${fmt(uMean, 4)} · ${fmt(A, 5)}`,
      hasil: fmt(Q * 1000, 2),
      satuan: "l/s",
      tint: C.water,
    },
    {
      judul: x.hU,
      rumus: <span>u = u₀ ( 1 − |r| / R )^( 1/n ) ;  Δhᵣ = u² / ( 2 g )</span>,
      isi: `${fmt(uMax, 4)} · ( 1 − ${fmt(Math.abs(rFrac), 2)} )^( 1/${fmt(n, 0)} ) = ${fmt(uProbe, 4)} m/s ;  ${fmt(uProbe, 4)}² / ( 2 · ${fmt(G, 2)} )`,
      hasil: fmt(pitotHead(uProbe), 4),
      satuan: "m",
      tint: C.energy,
    },
    {
      judul: x.hR,
      rumus: <span>r* / R = 1 − ( V / u₀ )ⁿ ;  ε = 1 / ( V / u₀ ) − 1</span>,
      isi: `1 − ${fmt(rasio, 4)}^${fmt(n, 0)} = ${fmt(rStar, 4)} ;  1 / ${fmt(rasio, 4)} − 1`,
      hasil: fmt(salah, 1),
      satuan: "%",
    },
  ];

  /* Batas dekat dinding 0,95 R (dekatDinding) dan pita jari-jari acuan
     r* per R ± 0,02, toleransi yang sama dengan kalimat "di jari-jari acuan".
     r* per R dari powerLawMeanRadius: 0,7505 sampai 0,7633 untuk n 5 sampai 10. */
  const bandsR = [
    { from: 0, to: rStar - 0.02, label: x.bandPangkat, tone: "neutral" as const },
    { from: rStar - 0.02, to: rStar + 0.02, label: x.bandAcuan, tone: "pass" as const },
    { from: rStar + 0.02, to: 0.95, label: x.bandPangkat, tone: "neutral" as const },
    { from: 0.95, to: 1, label: x.bandDinding, tone: "invalid" as const },
  ];

  return (
    <LabShell
      status={
        <RegimeScale symbol="|r/R|" value={Math.abs(rFrac)} invalid={dekatDinding} digits={2} bands={bandsR} />
      }
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
          <canvas ref={plate.ref} className="block h-full w-full" />
          <DragLayer out={plate.outRef.current} handles={handles} touch={() => sentuh.current()} />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Δh" label={x.ddh} value={dh} min={0.005} max={2} step={0.005} digits={3} unit="m" onChange={setDh} tint={C.energy} />
              <InputRow symbol="D" label={x.dD} value={D * 1000} min={25} max={800} step={5} digits={0} unit="mm" onChange={(v) => setD(v / 1000)} />
              <InputRow symbol="n" label={x.dn} value={n} min={5} max={10} step={1} digits={0} onChange={setN} />
              <InputRow symbol="r/R" label={x.dr} value={rFrac} {...P_R} onChange={setRFrac} tint={dekatDinding ? C.signal : undefined} />
            </InputTable>

            <SentuhContoh sentuh={sentuh} />
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
            <ResultTable
              rows={[
                { symbol: "u", label: x.rU, value: fmt(uProbe, 4), unit: "m/s", tint: dekatDinding ? C.signal : C.water, strong: true },
                { symbol: "Δhᵣ", label: x.rDh, value: fmt(pitotHead(uProbe), 4), unit: "m", tint: C.energy },
                { symbol: "u₀", label: x.rUmax, value: fmt(uMax, 4), unit: "m/s", tint: C.water },
                { symbol: "V", label: x.rUmean, value: fmt(uMean, 4), unit: "m/s", tint: C.energy, strong: true },
                { symbol: "V/u₀", label: x.rRasio, value: fmt(rasio, 4) },
                { symbol: "r*", label: x.rRmean, value: fmt(rStar, 4), unit: "R", tint: C.critical },
                { symbol: "Q", label: x.rQ, value: fmt(Q * 1000, 2), unit: "l/s", tint: C.water },
                { symbol: "ε", label: x.rSalah, value: fmt(salah, 1), unit: "%" },
              ]}
            />
            <div className="mt-3">
              <Hitungan langkah={langkah} />
            </div>
          </Block>

          <StateCard
            tone={dekatDinding ? "invalid" : diAcuan ? "pass" : "neutral"}
            badge={dekatDinding ? x.dekatDinding : diAcuan ? x.diAcuan : diSumbu ? x.diSumbu : x.setempat}
            state={
              lang === "id"
                ? `Ujung tabung di r/R ${fmt(rFrac, 2)}: u ${fmt(uProbe, 3)} m/s; rata-rata penampang ${fmt(uMean, 3)} m/s.`
                : `Probe tip at r/R ${fmt(rFrac, 2)}: u ${fmt(uProbe, 3)} m/s; section mean ${fmt(uMean, 3)} m/s.`
            }
            notice={[...(dekatDinding ? [x.dekatDindingNote] : []), notice(rFrac, rStar, rasio, n, lang)]}
          />
        </>
      }
      verification={<Verification checks={checksPitot(dh, D, n)} />}
      below={
        <>
        <div className="mb-9">
          <LembarPraktikum<BacaanFm03>
            kode="FM-03"
            kolom={KOLOM_FM03}
            kolomEkspor={KOLOM_EKSPOR_FM03}
            catat={(rng) => catatFm03({ dh0: dh, D, n, rR: rFrac }, rng)}
            tolak={tolakFm03({ dh0: dh, D, n, rR: rFrac }) ? x.pTolak : null}
            masukan={
              <table className="data">
                <tbody>
                  <InputRow
                    symbol="r/R"
                    label={x.pAtur}
                    value={rFrac}
                    {...P_R}
                    onChange={(v) => {
                      sentuh.current();
                      setRFrac(v);
                    }}
                    tint={dekatDinding ? C.signal : undefined}
                  />
                </tbody>
              </table>
            }
            grafik={(rows) => (
              <GrafikPraktikum spec={grafikFm03(rows, { dh0: dh, D, n }, lang)} ringkasan={x.gRingkas(rows.length)} />
            )}
            ringkasan={(rows) => ringkasanFm03(rows, lang)}
            penanda={(rows) => penandaFm03(rows, lang)}
            hitungan={(b, rows) => hitunganFm03(b, rows, lang)}
            langkah={TXT.id.langkahP.map((id, i) => ({ id, en: TXT.en.langkahP[i] }))}
            alat={
              <>
                <p>{x.aManometer}</p>
                <p>{x.aCp}</p>
                <p>{x.aProfil}</p>
                <p>{x.aZona}</p>
              </>
            }
            namaBerkas="fm03-pitot-traverse"
            maks={40}
          />
        </div>
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
        </>
      }
    />
  );
}

/* Lembar pengamatan FM-03 (mode traverse): ringkasan, penanda, langkah
   hitung, dan grafik profil dari src/data/praktikum/fm03.ts. */

const lps = (lang: Lang) => (lang === "en" ? "L/s" : "L/dtk");

function ringkasanFm03(rows: BacaanFm03[], lang: Lang): ResultRow[] {
  const x = TXT[lang];
  const s = ringkasFm03(rows);
  return [
    { symbol: "Q", label: x.pQ, value: fmt(s.Q * 1000, 3), unit: lps(lang), tint: C.water, strong: true },
    { symbol: "Qₘ", label: x.pQm, value: fmt(s.Qmodel * 1000, 3), unit: lps(lang) },
    { symbol: "ΔQ", label: x.pSelisih, value: fmt(s.selisih, 2), unit: "%", strong: true },
    { symbol: "Q₀", label: x.pQnol, value: fmt(s.Qnol * 1000, 3), unit: lps(lang), tint: C.ink3 },
    { symbol: "ΔQ₀", label: x.pSelisihNol, value: fmt(s.selisihNol, 2), unit: "%" },
    { symbol: "V", label: x.pV, value: fmt(s.V, 4), unit: "m/s", tint: C.energy },
    { symbol: "k", label: x.pN, value: x.pNVal(s.nTitik, s.sisi) },
  ];
}

function penandaFm03(rows: BacaanFm03[], lang: Lang): string[] {
  const x = TXT[lang];
  const s = ringkasFm03(rows);
  const out: string[] = [];
  if (s.nTitik < 3) out.push(x.pSedikit);
  if (s.sisi === 1 && s.nTitik >= 2) out.push(x.pSatuSisi);
  if (!s.adaSumbu) out.push(x.pTanpaSumbu);
  if (s.sMaks < 0.85 && s.nTitik >= 2) out.push(x.pJauh(fmt(s.sMaks, 2)));
  if (s.campur) out.push(x.pCampur);
  if (s.nTitik >= 3) out.push(x.pNol(fmt(s.selisih, 2), fmt(s.selisihNol, 2)));
  return out;
}

function hitunganFm03(b: BacaanFm03, rows: BacaanFm03[], lang: Lang): LangkahHitung[] {
  const x = TXT[lang];
  const s = ringkasFm03(rows);
  const R = b.D / 2;
  const m = M_DINDING;
  const out: LangkahHitung[] = [
    {
      judul: x.hDhT,
      rumus: <span>Δh = hₜ − hₛ</span>,
      isi: `${fmt(b.ht * 1000, 0)} − ${fmt(b.hs * 1000, 0)}`,
      hasil: fmt(b.dh * 1000, 0),
      satuan: "mm",
      tint: C.energy,
    },
    {
      judul: x.hUT,
      rumus: <span>u = √( 2 g Δh )</span>,
      isi: `√( 2 · ${fmt(G, 2)} · ${fmt(b.dh, 3)} )`,
      hasil: fmt(b.u, 3),
      satuan: "m/s",
      tint: C.water,
    },
  ];
  s.rinci.forEach((ri, i) => {
    const p = s.profil[i];
    const k = p[p.length - 1];
    const no = i + 1;
    const nama = s.sisi === 2 ? ` (${x.sisiNama[i]})` : "";
    out.push({
      judul: `${x.hInti(no)}${nama}`,
      rumus: <span>Qᵢ = Σ 2π · ½ ( rⱼ uⱼ + rⱼ₊₁ uⱼ₊₁ ) ( rⱼ₊₁ − rⱼ )</span>,
      isi: `${p.length} ${x.titik}, r/R ${fmt(p[0].s, 2)} … ${fmt(k.s, 2)}`,
      hasil: fmt(ri.inti * 1000, 3),
      satuan: lps(lang),
    });
    out.push({
      judul: `${x.hZona(no)}${nama}`,
      rumus: (<><span>Q_z =</span><Frac num="m" den="m + 1" /><span>u_k · π ( R² − r_k² )</span></>),
      isi: `${m}/${m + 1} · ${fmt(k.u, 3)} · π · ( ${fmt(R, 4)}² − ${fmt(k.s * R, 4)}² ) × 1000`,
      hasil: fmt(ri.zona * 1000, 3),
      satuan: lps(lang),
      tint: C.energy,
    });
  });
  const total = s.rinci.map((ri) => fmt((ri.inti + ri.zona) * 1000, 3));
  out.push({
    judul: x.hQT,
    rumus: <span>{x.hQRumus}</span>,
    isi: total.length === 2 ? `( ${total[0]} + ${total[1]} ) / 2` : (total[0] ?? "—"),
    hasil: fmt(s.Q * 1000, 3),
    satuan: lps(lang),
    tint: C.water,
  });
  return out;
}

function grafikFm03(rows: BacaanFm03[], st: { dh0: number; D: number; n: number }, lang: Lang): ChartSpec {
  const x = TXT[lang];
  const R = st.D / 2;
  const u0 = pitotVelocity(st.dh0);
  const model = Array.from({ length: 81 }, (_, i) => {
    const rR = -1 + i / 40;
    return { x: powerLawVelocity(rR * R, R, u0, st.n), y: rR };
  });
  const ukur = [...rows].sort((a, b) => a.rR - b.rR).map((r) => ({ x: r.u, y: r.rR }));
  const uMaks = Math.max(u0, ...rows.map((r) => r.u));
  const s = rows.length > 0 ? ringkasFm03(rows) : null;
  return {
    xMin: 0,
    xMax: uMaks * 1.15,
    yMin: -1,
    yMax: 1,
    axisX: x.axU,
    axisY: x.axR,
    series: [
      { pts: model, color: C.ink3, weight: W.thin, dash: DASH.hidden, label: x.gModel, labelAt: 0.3, labelAlign: "left" },
      ...(ukur.length >= 2 ? [{ pts: ukur, color: C.water, weight: W.thin, label: x.gBacaan, labelAt: 0.4, labelAlign: "left" as const }] : []),
    ],
    markers: ukur.map((p) => ({ ...p, color: C.water })),
    bands: [
      { axis: "y", from: R_DINDING_MAKS, to: 1, label: x.gDinding },
      { axis: "y", from: -1, to: -R_DINDING_MAKS },
    ],
    rules: s && Number.isFinite(s.V) ? [{ axis: "x", at: s.V, color: C.energy, dash: DASH.axis, label: `V ${fmt(s.V, 3)}` }] : [],
  };
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
      return `The probe now sits at the reference radius, ${fmt(rMeanFrac, 3)} of the pipe radius, and the reading at the tip has become the mean velocity itself. No correction factor is applied and none is needed. Notice that this radius depends only on the exponent, not on the velocity or the pipe size, so it can be marked on the probe once and used again.`;
    if (diSumbu)
      return `The probe sits on the axis, where the reading is largest and easiest to take. Taking that reading as the mean would overstate the discharge by ${fmt(((1 / rasio - 1) * 100), 1)} per cent, which is why the ratio ${fmt(rasio, 4)} exists. Move the probe out to the reference radius and watch the correction disappear.`;
    return `The reading here is a local velocity and nothing more. To turn it into a discharge you would need either the whole profile or one of the two shortcuts: the ratio ${fmt(rasio, 4)} applied to a centreline reading, or a single reading taken at ${fmt(rMeanFrac, 3)} of the radius. Change the exponent from ${n} and watch both shortcuts move together, because both come from the same integral.`;
  }

  if (diAcuan)
    return `Tabungnya sekarang berada di jari-jari acuan, ${fmt(rMeanFrac, 3)} kali jari-jari pipa, dan bacaan di ujungnya sudah menjadi kecepatan rata-rata itu sendiri. Tidak ada faktor koreksi yang dipakai, dan memang tidak diperlukan. Perhatikan jari-jari ini hanya bergantung pada pangkatnya, bukan pada kecepatan maupun ukuran pipa, sehingga cukup ditandai sekali pada batang tabungnya lalu dipakai berulang.`;
  if (diSumbu)
    return `Tabungnya berada di sumbu pipa, tempat bacaannya paling besar dan paling mudah diambil. Menganggap bacaan itu sebagai kecepatan rata-rata akan membesarkan debit sebesar ${fmt(((1 / rasio - 1) * 100), 1)} persen, dan itulah sebabnya perbandingan ${fmt(rasio, 4)} ada. Geser tabungnya ke jari-jari acuan, lalu perhatikan koreksinya lenyap.`;
  return `Bacaan di sini kecepatan setempat, tidak lebih. Mengubahnya menjadi debit memerlukan seluruh profilnya, atau salah satu dari dua jalan pintas: perbandingan ${fmt(rasio, 4)} yang dikenakan pada bacaan di sumbu, atau satu bacaan yang diambil pada ${fmt(rMeanFrac, 3)} kali jari-jari. Ubah pangkatnya dari ${n}, lalu perhatikan kedua jalan pintas itu bergerak bersamaan, karena keduanya datang dari integral yang sama.`;
}
