import type { Check } from "./verify.ts";
import {
  FLUME_C,
  G,
  ORIFICE_CC_SLOT,
  VENTURI_C_MACHINED,
  dilutionDischarge,
  flumeDischarge,
  orificeJet,
  orificeTrajectory,
  pitotHead,
  pitotVelocity,
  powerLawMeanRadius,
  powerLawMeanRatio,
  powerLawVelocity,
  tracerCurve,
  venturiDischarge,
  venturiHead,
  backwaterExtent,
  conjugateFromMomentum,
  momentumFunction,
  reachEnergy,
  sideChannelProfile,
  svfProfile,
  svfSlope,
  type TroughResult,
  NOTCH_KH,
  colebrookFriction,
  conjugateDepth,
  criticalDepth,
  depthFromEnergy,
  frictionSlope,
  froude,
  gvfDistanceDirectStep,
  gvfProfile,
  gvfSlope,
  jetTrajectory,
  jumpEnergyLoss,
  manningDischarge,
  normalDepth,
  notchCe,
  notchDischarge,
  rectWeirCe,
  rectWeirDischarge,
  slopeBreak,
  wesNappe,
  specificEnergy,
  transition,
  wideChannelNormalDepth,
  KARMAN,
  SEDIMENT_S,
  SHIELDS_PLATEAU,
  chezyFromDarcy,
  chezyFromManning,
  chezyVelocity,
  darcyFromChezy,
  shieldsCritical,
  shieldsState,
  stricklerN,
  viscousSublayer,
  wallLaw,
  wallingfordVelocity,
  hazenEfficiency,
  hjulstrom,
  rouseConcentration,
  rouseNumber,
  rouseState,
  settlingBasin,
  settlingVelocity,
  floodHydrograph,
  reservoirRouting,
  scsEffectiveRain,
  scsStorage,
  scsUnitHydrograph,
  SWIM_BURST_BL,
  SWIM_BURST_TIME,
  SWIM_SUSTAINED_BL,
  fishPassage,
  fishSwim,
  markRecapture,
  schaeferHarvest,
  trophicPyramid,
  OGEE_CD_DESIGN,
  LABYRINTH_HP_MAX,
  labyrinthWeir,
  ogeeCd,
  ogeeCrestPressure,
  ogeeWeir,
  wesCrest,
  CASCADE_POOL_RATIO,
  CULVERT_FISH_VELOCITY,
  FISHWAY_POWER_GENERAL,
  ISBASH_EMBEDDED,
  ISBASH_EXPOSED,
  bridgePiers,
  cascadePassage,
  culvert,
  denilFishway,
  poolFishway,
  riprapSize,
  sluiceGate,
  CONCRETE_UNIT_WEIGHT,
  PORE_RE_DARCY,
  SLEEP_H0,
  SLEEP_L0,
  SLEEP_TAU_RISE,
  WATER_UNIT_WEIGHT,
  aquiferResponse,
  filterDesign,
  gravityDam,
  passingAt,
  pumpingWell,
  rockfillFlow,
  rockfillGradient,
  seepageLine,
  sleepFall,
  sleepRegulation,
  sleepRise,
  wakeTimeTo,
  waterViscosity,
  wellDrawdownAt,
  ATM_HEAD,
  FALKNER_SKAN_SEPARATION,
  HYDROSTATIC_TOLERANCE,
  MEANDER_PEAK_RATIO,
  acceleration,
  advectionDiffusion,
  curvaturePressure,
  deformation,
  ductEnergy,
  falknerSkan,
  flowLines,
  fmtPlain,
  linearWave,
  meanderPath,
  momentumForce,
  reynoldsExperiment,
  riverHabitat,
  shoal,
  vortexPair,
  vortexStreet,
  type DuctStation,
} from "./hydraulics.ts";

/**
 * Pemeriksaan yang ditampilkan pada blok verifikasi tiap lembar.
 *
 * Nilai acuan diambil dari sumber di luar aplikasi ini. Sebagiannya bergantung
 * pada masukan yang sedang dipakai pengguna, dan itu disengaja: pemeriksaan
 * konsistensi silang justru paling berguna kalau ikut bergerak.
 *
 * Sumber ditulis apa adanya sampai tingkat bab, tanpa nomor persamaan, supaya
 * pembaca dapat menelusurinya tanpa menemukan rujukan yang salah.
 */

/* ------------------------------------------------------------------ *
 * OC-01 Loncatan air
 * ------------------------------------------------------------------ */

export function checksJump(y1: number, V1: number): Check[] {
  const Fr1 = froude(V1, y1);
  const y2 = Fr1 > 1 ? conjugateDepth(y1, Fr1) : y1;
  const q = V1 * y1;
  const V2 = q / y2;
  const Fr2 = froude(V2, y2);
  const E1 = specificEnergy(y1, q);
  const E2 = specificEnergy(y2, q);

  return [
    {
      label: {
        id: "Kedalaman konjugat pada Fr₁ = 5, y₁ = 1 m",
        en: "Conjugate depth at Fr₁ = 5, y₁ = 1 m",
      },
      source: "Belanger, dikutip Chow (1959) Bab 15",
      kind: "terbitan",
      expected: 6.588723,
      actual: conjugateDepth(1, 5),
      tol: 1e-6,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Pada Fr₁ = 1 kedalaman tidak berubah",
        en: "At Fr₁ = 1 the depth does not change",
      },
      source: "Batas keberlakuan persamaan Belanger",
      kind: "sifat",
      expected: y1,
      actual: conjugateDepth(y1, 1),
      tol: 1e-9,
      unit: "m",
    },
    {
      label: {
        id: "Pada Fr₁ = 1 tidak ada energi yang teredam",
        en: "At Fr₁ = 1 no energy is dissipated",
      },
      source: "Sifat loncatan: tanpa lompatan tidak ada kehilangan",
      kind: "sifat",
      expected: 0,
      actual: jumpEnergyLoss(y1, conjugateDepth(y1, 1)),
      tol: 0,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Energi teredam sama dengan selisih energi spesifik",
        en: "Dissipated energy equals the specific energy difference",
      },
      source: "Dua jalur perhitungan yang harus bertemu",
      kind: "silang",
      expected: E1 - E2,
      actual: Fr1 > 1 ? jumpEnergyLoss(y1, y2) : 0,
      tol: 1e-9,
      unit: "m",
      digits: 5,
    },
    {
      label: {
        id: "Menghitung balik dari hilir mengembalikan kedalaman hulu",
        en: "Computing back from downstream returns the upstream depth",
      },
      source: "Persamaan Belanger berlaku dua arah",
      kind: "pulang-pergi",
      expected: y1,
      actual: Fr1 > 1 ? conjugateDepth(y2, Fr2) : y1,
      tol: 1e-9,
      unit: "m",
      digits: 5,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * OC-02 Energi spesifik
 * ------------------------------------------------------------------ */

export function checksEnergy(
  Q: number,
  b: number,
  n: number,
  S: number
): Check[] {
  const q = Q / b;
  const yc = criticalDepth(q);
  // Kedalaman uji dipilih dari geometri, bukan dari debit yang diminta, supaya
  // pemeriksaan pulang pergi tetap sah meski salurannya tidak sanggup
  // mengalirkan debit itu sama sekali.
  const yUji = Math.max(0.2, yc);

  return [
    {
      label: {
        id: "Energi spesifik minimum sama dengan 1,5 kali kedalaman kritis",
        en: "Minimum specific energy equals 1.5 times critical depth",
      },
      source: "Chow (1959) Bab 3, penampang persegi",
      kind: "terbitan",
      expected: 1.5 * yc,
      actual: specificEnergy(yc, q),
      tol: 1e-9,
      unit: "m",
      digits: 5,
    },
    {
      label: {
        id: "Bilangan Froude bernilai satu pada kedalaman kritis",
        en: "The Froude number equals one at critical depth",
      },
      source: "Definisi kondisi kritis",
      kind: "sifat",
      expected: 1,
      actual: froude(q / yc, yc),
      tol: 1e-9,
      digits: 6,
    },
    {
      label: {
        id: "Tinggi kecepatan pada kondisi kritis sama dengan setengah kedalaman kritis",
        en: "Velocity head at critical equals half the critical depth",
      },
      source: "Henderson (1966) Bab 2, penampang persegi",
      kind: "terbitan",
      expected: yc / 2,
      actual: (q * q) / (2 * G * yc * yc),
      tol: 1e-9,
      unit: "m",
      digits: 5,
    },
    {
      label: {
        id: "Membalik lalu menghitung maju mengembalikan kedalaman semula",
        en: "Inverting then computing forward returns the original depth",
      },
      source: "Persamaan Manning dibalik dengan metode bagi dua",
      kind: "pulang-pergi",
      expected: yUji,
      actual: normalDepth(manningDischarge(b, yUji, n, S), b, n, S),
      tol: 1e-6,
      unit: "m",
      digits: 5,
    },
    {
      label: {
        id: "Energi spesifik di atas kedalaman kritis lebih besar dari minimum",
        en: "Specific energy above critical depth exceeds the minimum",
      },
      source: "Bentuk kurva energi spesifik",
      kind: "perilaku",
      expected: 1,
      actual: specificEnergy(yc * 1.4, q) > specificEnergy(yc, q) ? 1 : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * OC-03 Profil aliran berubah lambat
 * ------------------------------------------------------------------ */

export function checksGvf(
  Q: number,
  b: number,
  n: number,
  S0: number
): Check[] {
  const q = Q / b;
  const yc = criticalDepth(q);

  // Pemeriksaan profil dibangun dari pasangan kedalaman dan debit yang PASTI
  // saling bersesuaian, bukan dari debit yang sedang dipilih pengguna. Saluran
  // sempit dengan kemiringan sangat kecil punya batas atas debit yang dapat
  // dialirkannya, dan di luar batas itu tidak ada kedalaman normal sama sekali.
  // Blok ini membuktikan modelnya benar, jadi ia tidak boleh ikut gagal hanya
  // karena penggeser berada di kombinasi yang mustahil secara fisik. Keadaan
  // mustahil itu ditandai tersendiri di antarmuka.
  const yn = Math.max(0.3, yc);
  const Qn = manningDischarge(b, yn, n, S0);
  const qn = Qn / b;
  const ycn = criticalDepth(qn);
  const yUji = Math.max(0.2, ycn);

  // Titik awal penelusuran WAJIB berada di sisi kedalaman kritis yang sama
  // dengan kedalaman normal. Kalau tidak, profilnya harus menembus kondisi
  // kritis untuk mencapai targetnya, dan itu tidak pernah terjadi karena
  // penyebut persamaan menuju nol di sana.
  const landai = yn > ycn;
  const yAwal = landai ? yn * 1.6 : (yn + ycn) / 2;
  const yTarget = (yAwal + yn) / 2;

  // Jarak menurut metode langkah langsung dihitung LEBIH DULU, lalu dipakai
  // menentukan panjang bentang penelusuran. Tanpa itu, saluran curam yang
  // profilnya selesai dalam hitungan sentimeter akan ditelusuri di atas bentang
  // ribuan meter, dan seluruh perjalanannya lebih pendek daripada satu langkah.
  const jarakLangsung = Math.abs(
    gvfDistanceDirectStep(Qn, b, n, S0, yAwal, yTarget, 400)
  );
  const bentang = Number.isFinite(jarakLangsung)
    ? Math.max(1, jarakLangsung * 4)
    : 4000;
  const jauh = gvfProfile(Qn, b, n, S0, yAwal, bentang, 2000);

  // Arah pembacaan mengikuti fisika. Aliran subkritis dikendalikan dari hilir,
  // superkritis dari hulu.
  const dariHilir = jauh.direction === "hulu";
  const urut = dariHilir ? [...jauh.points].reverse() : jauh.points;
  const kendaliX = urut[0].x;

  // Titik potong diinterpolasi di antara dua titik yang mengapitnya.
  let titik = urut[urut.length - 1];
  const lewat = (y: number) => (yAwal > yn ? y <= yTarget : y >= yTarget);
  for (let i = 1; i < urut.length; i++) {
    if (lewat(urut[i].y) && !lewat(urut[i - 1].y)) {
      const a = urut[i - 1];
      const c = urut[i];
      const beda = c.y - a.y;
      const f = Math.abs(beda) < 1e-12 ? 0 : (yTarget - a.y) / beda;
      titik = {
        x: a.x + (c.x - a.x) * f,
        y: yTarget,
        nearCritical: false,
        rapid: false,
      };
      break;
    }
  }
  const jarakRk = Math.abs(kendaliX - titik.x);

  return [
    {
      label: {
        id: "Pada kedalaman normal, kemiringan gesek sama dengan kemiringan dasar",
        en: "At normal depth the friction slope equals the bed slope",
      },
      source: "Definisi aliran seragam",
      kind: "sifat",
      expected: S0,
      actual: frictionSlope(Qn, b, yn, n),
      tol: 1e-7,
      digits: 6,
    },
    {
      label: {
        id: "Pada kedalaman normal, kemiringan muka air nol",
        en: "At normal depth the water surface slope is zero",
      },
      source: "Akibat langsung dari aliran seragam",
      kind: "sifat",
      expected: 0,
      actual: gvfSlope(Qn, b, yn, n, S0),
      tol: 0,
      absTol: 1e-7,
      digits: 8,
    },
    {
      label: {
        id: "Jarak penelusuran cocok dengan metode langkah langsung",
        en: "Computed distance agrees with the direct step method",
      },
      source: "Metode langkah langsung, Chow (1959) Bab 10",
      kind: "terbitan",
      expected: jarakLangsung,
      actual: jarakRk,
      tol: 0.03,
      tolReason: {
        id: "Toleransi 3 persen karena kedua metode memakai langkah berhingga yang berbeda arah: satu melangkah pada jarak, satunya pada kedalaman.",
        en: "A 3 per cent tolerance is used because the two methods take finite steps in different directions: one steps in distance, the other in depth.",
      },
      unit: "m",
      digits: 1,
    },
    {
      label: {
        id: "Profil bergerak mendekati kedalaman normal, bukan menjauhinya",
        en: "The profile moves toward normal depth rather than away from it",
      },
      source: "Chow (1959) Bab 9, sifat asimtotik profil M1",
      kind: "perilaku",
      expected: 1,
      actual:
        Math.abs(jauh.points[0].y - yn) <= Math.abs(yAwal - yn) + 1e-9 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Membalik lalu menghitung maju mengembalikan kedalaman semula",
        en: "Inverting then computing forward returns the original depth",
      },
      source: "Persamaan Manning dibalik dengan metode bagi dua",
      kind: "pulang-pergi",
      expected: yUji,
      actual: normalDepth(manningDischarge(b, yUji, n, S0), b, n, S0),
      tol: 1e-6,
      unit: "m",
      digits: 5,
    },
    {
      label: {
        id: "Bilangan Froude bernilai satu pada kedalaman kritis",
        en: "The Froude number equals one at critical depth",
      },
      source: "Definisi kondisi kritis",
      kind: "sifat",
      expected: 1,
      actual: froude(qn / ycn, ycn),
      tol: 1e-9,
      digits: 6,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * PI-01 Diagram Moody
 * ------------------------------------------------------------------ */

export function checksMoody(Re: number, relRough: number): Check[] {
  const f = colebrookFriction(Math.max(Re, 4000), relRough);
  const x = 1 / Math.sqrt(f);
  const sisa =
    -2 * Math.log10(relRough / 3.7 + 2.51 / (Math.max(Re, 4000) * Math.sqrt(f)));

  return [
    {
      label: {
        id: "Faktor gesekan pada Re 10⁵ dan ε/D 10⁻⁴",
        en: "Friction factor at Re 10⁵ and ε/D 10⁻⁴",
      },
      source: "Pembacaan diagram Moody (1944)",
      kind: "terbitan",
      expected: 0.0182,
      actual: colebrookFriction(1e5, 1e-4),
      tol: 0.02,
      tolReason: {
        id: "Toleransi 2 persen mencerminkan ketelitian membaca diagram terbitan, bukan longgarnya perhitungan. Terhadap persamaan aslinya, hasilnya tepat sampai ketelitian mesin.",
        en: "The 2 per cent tolerance reflects the precision of reading a published chart, not looseness in the computation. Against the equation itself the result is exact to machine precision.",
      },
      digits: 5,
    },
    {
      label: {
        id: "Faktor gesekan pada Re 10⁶ dan ε/D 0,01",
        en: "Friction factor at Re 10⁶ and ε/D 0.01",
      },
      source: "Pembacaan diagram Moody (1944)",
      kind: "terbitan",
      expected: 0.038,
      actual: colebrookFriction(1e6, 0.01),
      tol: 0.02,
      tolReason: {
        id: "Sama seperti di atas, toleransinya mengikuti ketelitian membaca diagram, bukan ketelitian hitungan.",
        en: "As above, the tolerance follows the precision of reading the chart, not the precision of the computation.",
      },
      digits: 5,
    },
    {
      label: {
        id: "Akar yang ditemukan memenuhi persamaan Colebrook-White",
        en: "The root found satisfies the Colebrook-White equation",
      },
      source: "Sisa persamaan implisit pada akarnya",
      kind: "sifat",
      expected: x,
      actual: sisa,
      tol: 1e-9,
      digits: 6,
    },
    {
      label: {
        id: "Aliran laminar mengikuti f = 64/Re pada Re 1000",
        en: "Laminar flow follows f = 64/Re at Re 1000",
      },
      source: "Penyelesaian Hagen-Poiseuille",
      kind: "terbitan",
      expected: 0.064,
      actual: 64 / 1000,
      tol: 1e-12,
      digits: 5,
    },
    {
      label: {
        id: "Pada turbulen penuh, f berhenti bergantung pada Reynolds",
        en: "In the fully rough regime f stops depending on Reynolds",
      },
      source: "Bentuk mendatar kurva Moody di sisi kanan",
      kind: "perilaku",
      expected: colebrookFriction(1e7, 0.05),
      actual: colebrookFriction(1e8, 0.05),
      tol: 0.01,
      tolReason: {
        id: "Toleransi 1 persen dipakai karena kurvanya mendatar, bukan benar-benar datar. Pengaruh Reynolds mengecil tetapi tidak pernah hilang sama sekali.",
        en: "A 1 per cent tolerance is used because the curve flattens rather than becoming truly flat. The influence of Reynolds shrinks but never disappears entirely.",
      },
      digits: 5,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * FM-01 Ambang ukur V
 * ------------------------------------------------------------------ */

export function checksNotch(H: number, theta: number): Check[] {
  // Pendekatan lapangan yang lazim dikutip untuk takik 90 derajat.
  const kindsvater = 1.34 * Math.pow(0.2, 2.48);

  return [
    {
      label: {
        id: "Koefisien debit efektif untuk takik 90 derajat",
        en: "Effective discharge coefficient for a 90 degree notch",
      },
      source: "ISO 1438:2017, rentang 0,578 sampai 0,581",
      kind: "terbitan",
      expected: 0.5795,
      actual: notchCe(90),
      tol: 0.005,
      tolReason: {
        id: "Toleransi 0,5 persen dipakai karena standarnya sendiri menyebut rentang, bukan satu angka tunggal.",
        en: "A 0.5 per cent tolerance is used because the standard itself gives a range rather than a single figure.",
      },
      digits: 4,
    },
    {
      label: {
        id: "Debit pada H 0,20 m dan takik 90 derajat",
        en: "Discharge at H 0.20 m for a 90 degree notch",
      },
      source: "Pendekatan Kindsvater-Shen, Q = 1,34 H^2,48",
      kind: "terbitan",
      expected: kindsvater,
      actual: notchDischarge(0.2, 90).Q,
      tol: 0.02,
      tolReason: {
        id: "Toleransi 2 persen karena rumus pendekatan itu sendiri membulatkan pangkat dan koefisiennya.",
        en: "A 2 per cent tolerance is used because the approximation itself rounds both its exponent and coefficient.",
      },
      unit: "m³/s",
      digits: 5,
    },
    {
      label: {
        id: "Debit mengikuti pangkat lima per dua terhadap tinggi muka air",
        en: "Discharge follows the five halves power of head",
      },
      source: "Bentuk baku rumus ambang segitiga",
      kind: "sifat",
      expected: Math.pow(2, 2.5),
      actual: notchDischarge(0.4, 90).Q / notchDischarge(0.2, 90).Q,
      tol: 0.01,
      tolReason: {
        id: "Toleransi 1 persen karena tinggi efektif memakai koreksi 0,85 mm, sehingga perbandingannya tidak persis pangkat lima per dua pada tinggi muka air kecil.",
        en: "A 1 per cent tolerance is used because the effective head includes a 0.85 mm correction, so the ratio is not exactly the five halves power at small heads.",
      },
      digits: 4,
    },
    {
      label: {
        id: "Tinggi efektif adalah tinggi muka air ditambah 0,85 mm",
        en: "Effective head is the head plus 0.85 mm",
      },
      source: "Koreksi tegangan permukaan dan kekentalan, ISO 1438",
      kind: "sifat",
      expected: H + NOTCH_KH,
      actual: notchDischarge(H, theta).he,
      tol: 1e-12,
      unit: "m",
      digits: 5,
    },
    {
      label: {
        id: "Di luar 5 sampai 38 cm dan 20 sampai 100 derajat ditandai di luar rentang",
        en: "Outside 5 to 38 cm and 20 to 100 degrees is flagged outside the valid range",
      },
      source: "Batas keberlakuan pada ISO 1438:2017",
      kind: "perilaku",
      expected: 1,
      actual:
        notchDischarge(0.03, 90).outOfRange &&
        notchDischarge(0.40, 90).outOfRange &&
        notchDischarge(0.2, 110).outOfRange &&
        !notchDischarge(0.05, 90).outOfRange &&
        !notchDischarge(0.38, 100).outOfRange
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * OC-04, OC-05, OC-07 Transisi pada saluran persegi
 * ------------------------------------------------------------------ */

export function checksTransition(
  Q: number,
  b1: number,
  y1: number,
  b2: number,
  dz: number
): Check[] {
  const r = transition({ Q, b1, y1, b2, dz });

  // Keadaan pada ambang tersendat, dipakai beberapa pemeriksaan sekaligus.
  const dasar = transition({ Q, b1, y1, b2, dz: 0 });
  const diAmbang = transition({ Q, b1, y1, b2, dz: dasar.dzMax });

  return [
    {
      label: {
        id: "Kenaikan dasar terbesar sama dengan E₁ dikurangi 1,5 kali kedalaman kritis",
        en: "Maximum bed rise equals E₁ minus 1.5 times critical depth",
      },
      source: "Chow (1959) Bab 3, syarat aliran tersendat",
      kind: "terbitan",
      expected: dasar.E1 - 1.5 * dasar.yc2,
      actual: dasar.dzMax,
      tol: 1e-9,
      unit: "m",
      digits: 5,
    },
    {
      label: {
        id: "Tepat pada kenaikan dasar terbesar, bilangan Froude menjadi satu",
        en: "At the maximum bed rise the Froude number becomes one",
      },
      source: "Definisi kondisi kritis pada penampang tersendat",
      kind: "sifat",
      expected: 1,
      actual: diAmbang.Fr2,
      tol: 1e-4,
      digits: 5,
    },
    {
      label: {
        id: "Energi spesifik kekal dikurangi kenaikan dasar",
        en: "Specific energy is conserved less the bed rise",
      },
      source: "Kekekalan energi pada transisi tanpa gesekan",
      kind: "silang",
      expected: r.E1,
      actual: r.choked
        ? r.E1
        : specificEnergy(r.y2, r.q2) + dz,
      tol: 1e-9,
      unit: "m",
      digits: 5,
    },
    {
      label: {
        id: "Tanpa perubahan apa pun, kedalaman hilir sama dengan hulu",
        en: "With no change at all the downstream depth equals the upstream depth",
      },
      source: "Keadaan batas yang harus dipenuhi model",
      kind: "sifat",
      expected: y1,
      actual: transition({ Q, b1, y1, b2: b1, dz: 0 }).y2,
      tol: 1e-9,
      unit: "m",
      digits: 5,
    },
    {
      label: {
        id: "Mencari kedalaman dari energi lalu kembali menghasilkan angka semula",
        en: "Solving depth from energy and back returns the original figure",
      },
      source: "Persamaan energi spesifik dibalik dengan metode bagi dua",
      kind: "pulang-pergi",
      expected: y1,
      actual: depthFromEnergy(specificEnergy(y1, r.q1), r.q1, r.branch),
      tol: 1e-6,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Aliran tetap pada cabangnya selama belum tersendat",
        en: "The flow stays on its branch while it is not choked",
      },
      source: "Aliran tidak dapat berpindah cabang tanpa melewati kondisi kritis",
      kind: "perilaku",
      expected: 1,
      actual:
        r.choked ||
        (r.branch === "subkritis" ? r.y2 > r.yc2 : r.y2 <= r.yc2 + 1e-9)
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
  ];
}


/* ------------------------------------------------------------------ *
 * OC-06 Transisi kemiringan
 * ------------------------------------------------------------------ */

/**
 * Kemiringan kritis: kemiringan yang membuat kedalaman normal persis sama
 * dengan kedalaman kritis. Dipakai di sini untuk menyusun kasus uji yang
 * dijamin landai atau dijamin curam, apa pun masukan yang sedang dipakai.
 */
function kemiringanKritis(Q: number, b: number, n: number): number {
  const yc = criticalDepth(Q / b);
  const A = b * yc;
  const R = A / (b + 2 * yc);
  return Math.pow((Q * n) / (A * Math.pow(R, 2 / 3)), 2);
}

export function checksSlopeBreak(
  Q: number,
  b: number,
  n: number,
  Sa: number
): Check[] {
  const q = Q / b;
  const yc = criticalDepth(q);
  const Sc = kemiringanKritis(Q, b, n);

  // Saluran uji yang sangat lebar, dipakai membandingkan pencari akar kami
  // dengan rumus tertutup yang berlaku bila jari-jari hidrolik mendekati
  // kedalaman.
  const bLebar = 2000;

  const landai = slopeBreak(Q, b, n, Sc / 4, Sc * 4, 600);
  const curam = slopeBreak(Q, b, n, Sc * 4, Sc * 0.85, 400);
  const y0a = normalDepth(Q, b, n, Sa);

  return [
    {
      label: {
        id: "Kedalaman normal saluran sangat lebar, dibanding rumus tertutup",
        en: "Normal depth in a very wide channel, against the closed form",
      },
      source: "Rumus saluran sangat lebar, Chow (1959) Bab 6",
      kind: "terbitan",
      expected: wideChannelNormalDepth(q, n, Sa),
      actual: normalDepth(q * bLebar, bLebar, n, Sa),
      tol: 0.01,
      tolReason: {
        id: "Saluran uji lebarnya 2.000 m, jadi jari-jari hidroliknya belum persis sama dengan kedalaman. Sisa selisih itu memang sifat pendekatannya, bukan galat pencari akar.",
        en: "The test channel is 2,000 m wide, so its hydraulic radius is not yet exactly equal to the depth. The remaining difference belongs to the approximation, not to the root finder.",
      },
      unit: "m",
      digits: 4,
    },
    {
      label: {
        id: "Pada kemiringan kritis, kedalaman normal sama dengan kedalaman kritis",
        en: "At the critical slope, normal depth equals critical depth",
      },
      source: "Definisi kemiringan kritis, Chow (1959) Bab 6",
      kind: "terbitan",
      expected: yc,
      actual: normalDepth(Q, b, n, Sc),
      tol: 1e-6,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Patahan landai ke curam memaksa kedalaman kritis tepat di patahan",
        en: "A mild-to-steep break forces critical depth exactly at the break",
      },
      source: "Letak kendali pada patahan kemiringan, Chow (1959) Bab 9",
      kind: "terbitan",
      expected: yc,
      actual: landai.yBreak,
      tol: 1e-9,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Kedalaman normal dikembalikan ke Manning menghasilkan debit semula",
        en: "Feeding normal depth back into Manning returns the original discharge",
      },
      source: "Pembalikan persamaan Manning harus dapat dibalik lagi",
      kind: "pulang-pergi",
      expected: Q,
      actual: manningDischarge(b, y0a, n, Sa),
      tol: 1e-7,
      unit: "m³/s",
      digits: 6,
    },
    {
      label: {
        id: "Kedalaman konjugat di titik loncatan sama dengan kedalaman normal hilir",
        en: "The conjugate depth at the jump equals the downstream normal depth",
      },
      source: "Syarat letak loncatan air, Chow (1959) Bab 15",
      kind: "silang",
      expected: curam.jumpTo ?? 0,
      actual:
        curam.jumpFrom !== null
          ? conjugateDepth(
              curam.jumpFrom,
              froude(q / curam.jumpFrom, curam.jumpFrom)
            )
          : (curam.jumpTo ?? 0),
      tol: 0.005,
      tolReason: {
        id: "Letak loncatan dibaca dengan menyisipkan di antara dua titik penelusuran, jadi ketelitiannya dibatasi lebar langkah, bukan oleh persamaannya.",
        en: "The jump location is read by interpolating between two computed points, so its precision is limited by the step width rather than by the equation.",
      },
      unit: "m",
      digits: 4,
    },
    {
      label: {
        id: "Kemiringan yang lebih curam memberi kedalaman normal yang lebih kecil",
        en: "A steeper slope gives a smaller normal depth",
      },
      source: "Perilaku yang harus berlaku pada persamaan Manning",
      kind: "perilaku",
      expected: 1,
      actual:
        normalDepth(Q, b, n, Sa * 4) < normalDepth(Q, b, n, Sa) ? 1 : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * OC-09 Persamaan energi saluran terbuka
 * ------------------------------------------------------------------ */

export function checksReachEnergy(
  Q: number,
  b: number,
  n: number,
  S0: number,
  yControl: number,
  L: number
): Check[] {
  const q = Q / b;
  const yc = criticalDepth(q);
  const r = reachEnergy(Q, b, n, S0, yControl, L);
  const tengah = r.points[Math.floor(r.points.length / 2)];
  const y0 = normalDepth(Q, b, n, S0);
  const seragam = reachEnergy(Q, b, n, S0, y0, L);

  return [
    {
      label: {
        id: "Kedalaman normal saluran sangat lebar, dibanding rumus tertutup",
        en: "Normal depth in a very wide channel, against the closed form",
      },
      source: "Rumus saluran sangat lebar, Chow (1959) Bab 6",
      kind: "terbitan",
      expected: wideChannelNormalDepth(q, n, S0),
      actual: normalDepth(q * 2000, 2000, n, S0),
      tol: 0.01,
      tolReason: {
        id: "Saluran uji lebarnya 2.000 m, sehingga jari-jari hidroliknya belum persis sama dengan kedalaman. Sisa selisihnya milik pendekatan itu, bukan milik pencari akar.",
        en: "The test channel is 2,000 m wide, so its hydraulic radius is not yet exactly equal to the depth. The remaining difference belongs to that approximation, not to the root finder.",
      },
      unit: "m",
      digits: 4,
    },
    {
      label: {
        id: "Energi minimum sama dengan satu setengah kali kedalaman kritis",
        en: "Minimum specific energy equals one and a half times critical depth",
      },
      source: "Hasil tertutup untuk penampang persegi, Chow (1959) Bab 3",
      kind: "terbitan",
      expected: 1.5 * yc,
      actual: specificEnergy(yc, q),
      tol: 1e-9,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Penurunan tinggi energi total sama dengan integral kemiringan gesek",
        en: "The drop in total energy equals the integral of the friction slope",
      },
      source: "Persamaan energi dan persamaan aliran berubah lambat harus sepakat",
      kind: "silang",
      expected: r.hf,
      actual: r.dE,
      tol: 0.002,
      tolReason: {
        id: "Profilnya diintegrasikan dari dy/dx dengan Runge-Kutta, sedangkan kehilangan gesekan dijumlahkan dengan aturan trapesium. Dua cara penjumlahan yang berbeda menyisakan selisih sebesar lebar langkahnya.",
        en: "The profile is integrated from dy/dx with Runge-Kutta while the friction loss is summed with the trapezoidal rule. Two different summations leave a difference of the order of the step width.",
      },
      unit: "m",
      digits: 5,
    },
    {
      label: {
        id: "Jarak tegak garis energi ke muka air sama dengan tinggi kecepatan",
        en: "The gap between the energy line and the water surface is the velocity head",
      },
      source: "Definisi garis energi",
      kind: "sifat",
      expected: tengah.vHead,
      actual: tengah.egl - tengah.wsl,
      tol: 1e-12,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Pada aliran seragam, kemiringan gesek sama dengan kemiringan dasar",
        en: "In uniform flow the friction slope equals the bed slope",
      },
      source: "Definisi aliran seragam",
      kind: "sifat",
      expected: S0,
      actual: seragam.points[Math.floor(seragam.points.length / 2)].Sf,
      tol: 1e-6,
      digits: 6,
    },
    {
      label: {
        id: "Kedalaman normal dikembalikan ke Manning menghasilkan debit semula",
        en: "Feeding normal depth back into Manning returns the original discharge",
      },
      source: "Pembalikan persamaan Manning harus dapat dibalik lagi",
      kind: "pulang-pergi",
      expected: Q,
      actual: manningDischarge(b, y0, n, S0),
      tol: 1e-7,
      unit: "m³/s",
      digits: 6,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * HS-09 Pengaruh hilir
 * ------------------------------------------------------------------ */

export function checksBackwater(
  Q: number,
  b: number,
  n: number,
  S0: number,
  yControl: number
): Check[] {
  const q = Q / b;
  const yc = criticalDepth(q);
  const y0 = normalDepth(Q, b, n, S0);
  const r = backwaterExtent(Q, b, n, S0, yControl);

  // Kemiringan kritis dipakai sebagai kasus uji yang nilainya sudah diketahui
  // lebih dulu dari definisinya, bukan dari hitungan ini.
  const A = b * yc;
  const R = A / (b + 2 * yc);
  const Sc = Math.pow((Q * n) / (A * Math.pow(R, 2 / 3)), 2);

  // Dua metode penelusuran yang sama sekali berbeda, dibandingkan pada
  // perjalanan yang sama dan seluruhnya di satu sisi kedalaman kritis.
  const yA = y0 * 1.5;
  const yB = y0 * 1.15;
  const langsung = Math.abs(gvfDistanceDirectStep(Q, b, n, S0, yA, yB, 4000));
  const rk = jarakDariProfil(Q, b, n, S0, yA, yB);

  return [
    {
      label: {
        id: "Kedalaman normal saluran sangat lebar, dibanding rumus tertutup",
        en: "Normal depth in a very wide channel, against the closed form",
      },
      source: "Rumus saluran sangat lebar, Chow (1959) Bab 6",
      kind: "terbitan",
      expected: wideChannelNormalDepth(q, n, S0),
      actual: normalDepth(q * 2000, 2000, n, S0),
      tol: 0.01,
      tolReason: {
        id: "Saluran uji lebarnya 2.000 m, sehingga jari-jari hidroliknya belum persis sama dengan kedalaman.",
        en: "The test channel is 2,000 m wide, so its hydraulic radius is not yet exactly equal to the depth.",
      },
      unit: "m",
      digits: 4,
    },
    {
      label: {
        id: "Pada kemiringan kritis, kedalaman normal sama dengan kedalaman kritis",
        en: "At the critical slope, normal depth equals critical depth",
      },
      source: "Definisi kemiringan kritis, Chow (1959) Bab 6",
      kind: "terbitan",
      expected: yc,
      actual: normalDepth(Q, b, n, Sc),
      tol: 1e-6,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Metode langkah langsung memberi jarak yang sama dengan Runge-Kutta",
        en: "The direct-step method gives the same distance as Runge-Kutta",
      },
      source: "Dua metode penelusuran yang berbeda pada perjalanan yang sama",
      kind: "silang",
      expected: langsung,
      actual: rk,
      tol: 0.02,
      tolReason: {
        id: "Metode langkah langsung membagi rentang kedalaman, sedangkan Runge-Kutta membagi jarak. Titik bacanya tidak pernah persis berimpit, dan sisa selisihnya berasal dari situ.",
        en: "The direct-step method divides the depth range while Runge-Kutta divides the distance. Their sample points never coincide exactly, and the remaining difference comes from that.",
      },
      unit: "m",
      digits: 1,
    },
    {
      label: {
        id: "Tanpa kenaikan muka air, tidak ada pengaruh yang menjalar",
        en: "With no rise in water level, no influence propagates",
      },
      source: "Sifat yang harus berlaku: bendung setinggi nol tidak mengubah apa pun",
      kind: "sifat",
      expected: 0,
      actual: backwaterExtent(Q, b, n, S0, y0).distance,
      tol: 0,
      absTol: 1e-6,
      unit: "m",
      digits: 3,
    },
    {
      label: {
        id: "Kenaikan yang lebih besar menjalar lebih jauh ke hulu",
        en: "A larger rise propagates further upstream",
      },
      source: "Perilaku yang harus berlaku pada kurva pembendungan",
      kind: "perilaku",
      expected: 1,
      actual:
        backwaterExtent(Q, b, n, S0, y0 + (yControl - y0) * 2).distance >=
        r.distance
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Batas satu persen selalu lebih jauh daripada batas sepuluh persen",
        en: "The one per cent limit always lies further than the ten per cent limit",
      },
      source: "Sifat kurva pembendungan yang mendekati kedalaman normal secara asimtotik",
      kind: "perilaku",
      expected: 1,
      actual:
        backwaterExtent(Q, b, n, S0, yControl, 0.01).distance >=
        backwaterExtent(Q, b, n, S0, yControl, 0.1).distance
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/**
 * Jarak antara dua kedalaman, dibaca dari profil Runge-Kutta.
 *
 * Dipakai hanya untuk membandingkan dengan metode langkah langsung. Titik
 * perlintasan disisipkan di antara dua langkah, bukan dibaca per langkah,
 * supaya perbandingannya tidak dibatasi lebar langkah lebih dari perlunya.
 */
function jarakDariProfil(
  Q: number,
  b: number,
  n: number,
  S0: number,
  yFrom: number,
  yTo: number
): number {
  // Penampang kendali ditaruh pada kedalaman yang lebih besar. Pada kurva
  // pembendungan, kedalaman berkurang ke arah hulu, jadi kendali di kedalaman
  // yang lebih kecil tidak akan pernah sampai ke kedalaman yang lebih besar.
  const r = gvfProfile(Q, b, n, S0, Math.max(yFrom, yTo), 20000, 4000);
  const pts = [...r.points].sort((a, c) => a.x - c.x);
  const cari = (target: number): number | null => {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const c = pts[i];
      if ((a.y - target) * (c.y - target) <= 0 && Math.abs(c.y - a.y) > 1e-12) {
        return a.x + ((target - a.y) / (c.y - a.y)) * (c.x - a.x);
      }
    }
    return null;
  };
  const xa = cari(yFrom);
  const xb = cari(yTo);
  return xa !== null && xb !== null ? Math.abs(xb - xa) : 0;
}

/* ------------------------------------------------------------------ *
 * OC-12 Aliran masuk lateral
 * ------------------------------------------------------------------ */

export function checksSvf(
  Q0: number,
  qStar: number,
  b: number,
  n: number,
  S0: number,
  L: number,
  yEnd: number
): Check[] {
  const Qend = Q0 + qStar * L;
  const qEnd = Qend / b;
  const ycEnd = criticalDepth(qEnd);
  const r = svfProfile(Q0, qStar, b, n, S0, L, yEnd);
  const tengah = r.points[Math.floor(r.points.length / 2)];

  // Keadaan uji untuk pemeriksaan pembanding.
  //
  // Penelusuran ini mengandaikan kendali di ujung hilir, dan andaian itu hanya
  // berlaku pada aliran subkritis. Kalau masukan yang sedang dipakai membuat
  // ujung hilirnya superkritis, pembandingnya diambil pada kedalaman subkritis
  // terdekat, bukan dibiarkan membandingkan dua perjalanan yang arahnya
  // berlawanan. Yang diperiksa memang kesepakatan dua penyelesai, bukan
  // kelayakan masukannya.
  const yUji = Math.max(yEnd, ycEnd * 1.15);

  // Pembandingnya memakai debit ujung hilir, bukan debit masuk. Debit masuk
  // boleh saja nol, misalnya pada saluran tepi jalan yang seluruh airnya datang
  // dari samping, dan penelusuran pada debit nol tidak membandingkan apa pun.
  const svfTanpa = svfProfile(Qend, 0, b, n, S0, L, yUji);
  const gvf = [...gvfProfile(Qend, b, n, S0, yUji, L, 400).points].sort(
    (a, c) => a.x - c.x
  );

  return [
    {
      label: {
        id: "Tanpa aliran masuk, persamaannya kembali menjadi aliran berubah lambat",
        en: "With no inflow, the equation reduces to gradually varied flow",
      },
      source: "Chow (1959) Bab 12 memuat Bab 9 sebagai kasus khususnya",
      kind: "silang",
      expected: gvfSlope(tengah.Q, b, yUji, n, S0),
      actual: svfSlope(tengah.Q, 0, b, yUji, n, S0),
      tol: 1e-12,
      digits: 8,
    },
    {
      label: {
        id: "Penelusuran tanpa aliran masuk berhimpit dengan penelusuran biasa",
        en: "The traverse with no inflow coincides with the ordinary traverse",
      },
      source: "Dua penyelesai yang harus memberi profil yang sama",
      kind: "silang",
      expected: gvf[0].y,
      actual: svfTanpa.points[0].y,
      tol: 1e-4,
      tolReason: {
        id: "Kedua penyelesai memakai Runge-Kutta orde empat, tetapi yang satu membagi langkahnya lagi secara adaptif. Sisa selisihnya sebesar galat pemotongan langkah, bukan perbedaan persamaan.",
        en: "Both solvers use fourth-order Runge-Kutta, but one subdivides its steps adaptively. The remaining difference is step truncation error, not a difference of equations.",
      },
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Energi minimum di ujung hilir sama dengan satu setengah kali kedalaman kritis",
        en: "Minimum energy at the outlet equals one and a half times critical depth",
      },
      source: "Hasil tertutup untuk penampang persegi, Chow (1959) Bab 3",
      kind: "terbitan",
      expected: 1.5 * ycEnd,
      actual: specificEnergy(ycEnd, qEnd),
      tol: 1e-9,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Debit di ujung hilir sama dengan debit masuk ditambah seluruh aliran lateral",
        en: "The outlet discharge equals the inflow plus all the lateral inflow",
      },
      source: "Kekekalan massa, dihitung dengan tangan",
      kind: "sifat",
      expected: Qend,
      actual: r.Qend,
      tol: 1e-9,
      unit: "m³/s",
      digits: 5,
    },
    {
      label: {
        id: "Suku aliran masuk lateral selalu menurunkan kemiringan muka air",
        en: "The lateral inflow term always lowers the water surface slope",
      },
      source: "Air yang masuk dari samping harus dipercepat oleh aliran yang sudah ada",
      kind: "perilaku",
      expected: 1,
      // Diperiksa pada debit di tengah bentang, bukan pada debit masuk. Kalau
      // debit yang lewat nol, tidak ada apa pun yang perlu dipercepat dan
      // pemeriksaannya kehilangan arti, bukan gagal.
      actual:
        svfSlope(Math.max(tengah.Q, 1e-3), Math.max(qStar, 1e-4), b, yUji, n, S0) <
        svfSlope(Math.max(tengah.Q, 1e-3), 0, b, yUji, n, S0)
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Kedalaman normal saluran sangat lebar, dibanding rumus tertutup",
        en: "Normal depth in a very wide channel, against the closed form",
      },
      source: "Rumus saluran sangat lebar, Chow (1959) Bab 6",
      kind: "terbitan",
      expected: wideChannelNormalDepth(qEnd, n, S0),
      actual: normalDepth(qEnd * 2000, 2000, n, S0),
      tol: 0.01,
      tolReason: {
        id: "Saluran uji lebarnya 2.000 m, sehingga jari-jari hidroliknya belum persis sama dengan kedalaman.",
        en: "The test channel is 2,000 m wide, so its hydraulic radius is not yet exactly equal to the depth.",
      },
      unit: "m",
      digits: 4,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * HS-10 Pelimpah samping
 * ------------------------------------------------------------------ */

export function checksSideChannel(
  Qtotal: number,
  b: number,
  n: number,
  S0: number,
  L: number
): Check[] {
  const r = sideChannelProfile(Qtotal, b, n, S0, L);
  const keluar = r.points[r.points.length - 1];
  const q = Qtotal / b;
  const yc = criticalDepth(q);
  // Titik yang paling dekat ke separuh panjang. Bila senarainya terpotong
  // karena bagian hulu superkritis, yang dibandingkan tetap titik yang ada,
  // dengan debit yang diharapkan pada absisnya sendiri.
  const tengah = r.points.reduce((a, p) =>
    Math.abs(p.x - L / 2) < Math.abs(a.x - L / 2) ? p : a
  );

  return [
    {
      label: {
        id: "Energi minimum di ujung keluar sama dengan satu setengah kali kedalaman kritis",
        en: "Minimum energy at the outlet equals one and a half times critical depth",
      },
      source: "Hasil tertutup untuk penampang persegi, Chow (1959) Bab 3",
      kind: "terbitan",
      expected: 1.5 * yc,
      actual: specificEnergy(keluar.y, q),
      tol: 1e-6,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Fungsi momentum di ujung keluar sama dengan satu setengah kali kuadrat kedalaman kritis",
        en: "The momentum function at the outlet equals one and a half times the square of critical depth",
      },
      source: "Hasil tertutup untuk penampang persegi, Chow (1959) Bab 3",
      kind: "terbitan",
      expected: 1.5 * yc * yc,
      actual: momentumFunction(keluar.y, q),
      tol: 1e-6,
      unit: "m³/m",
      digits: 6,
    },
    {
      label: {
        id: "Bilangan Froude di ujung keluar sama dengan satu",
        en: "The Froude number at the outlet equals one",
      },
      source: "Letak kendali saluran pengumpul, Chow (1959) Bab 12",
      kind: "sifat",
      expected: 1,
      actual: keluar.Fr,
      tol: 1e-6,
      digits: 6,
    },
    {
      label: {
        id: "Separuh panjang saluran mengumpulkan separuh debit",
        en: "Half the channel length collects half the discharge",
      },
      source: "Limpasan merata sepanjang mercu, dihitung dengan tangan",
      kind: "sifat",
      expected: (Qtotal * tengah.x) / L,
      actual: tengah.Q,
      tol: 1e-9,
      unit: "m³/s",
      digits: 4,
    },
    {
      label: {
        id: "Muka air di pangkal lebih tinggi daripada di ujung keluar",
        en: "The water surface at the head is higher than at the outlet",
      },
      source: "Perilaku yang harus berlaku pada saluran pengumpul",
      kind: "perilaku",
      expected: 1,
      actual: r.rise > 0 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Iterasi tiap langkah benar-benar memenuhi persamaan momentumnya",
        en: "The iteration at each step really does satisfy its momentum equation",
      },
      source: "Bentuk beda hingga Hinds (1926), dikutip Chow (1959) Bab 12",
      kind: "silang",
      expected: 0,
      actual: sisaMomentumTerbesar(r, b, n, L),
      tol: 0,
      absTol: 1e-6,
      unit: "m",
      digits: 8,
    },
  ];
}

/**
 * Sisa terbesar persamaan momentum di sepanjang saluran pengumpul.
 *
 * Nilai yang tersimpan dimasukkan kembali ke persamaan yang seharusnya
 * dipenuhinya. Kalau iterasinya berhenti terlalu cepat, sisa ini tidak nol,
 * dan itu tidak akan terlihat dari gambarnya.
 */
function sisaMomentumTerbesar(
  r: TroughResult,
  b: number,
  n: number,
  L: number
): number {
  let terbesar = 0;
  for (let i = 1; i < r.points.length; i++) {
    const p1 = r.points[i - 1];
    const p2 = r.points[i];
    // Jarak dibaca dari titiknya sendiri, bukan dari L dibagi jumlah titik:
    // senarainya bisa terpotong bila ada bagian hulu yang superkritis.
    const dx = p2.x - p1.x;
    const jumlahQ = p1.Q + p2.Q;
    if (jumlahQ <= 0) continue;
    const dyMomentum =
      ((p1.V + p2.V) / (G * jumlahQ)) *
      (p1.Q * (p2.V - p1.V) + p2.V * (p2.Q - p1.Q));
    const hf =
      ((frictionSlope(p1.Q, b, p1.y, n) + frictionSlope(p2.Q, b, p2.y, n)) / 2) *
      dx;
    terbesar = Math.max(terbesar, Math.abs(p1.ws - (p2.ws + dyMomentum + hf)));
  }
  return terbesar;
}


/* ------------------------------------------------------------------ *
 * OC-08 Energi dan momentum
 * ------------------------------------------------------------------ */

export function checksEnergyMomentum(y1: number, V1: number): Check[] {
  const Fr1 = froude(V1, y1);
  const q = V1 * y1;
  const yc = criticalDepth(q);
  const y2 = Fr1 > 1 ? conjugateDepth(y1, Fr1) : y1;
  const E1 = specificEnergy(y1, q);
  const E2 = specificEnergy(y2, q);

  // Rumus tertutup kehilangan energi pada loncatan air. Ia diterbitkan
  // terpisah dari persamaan konjugatnya, jadi membandingkan keduanya benar
  // benar membandingkan dua hal.
  const hilangTerbitan = Math.pow(y2 - y1, 3) / (4 * y1 * y2);

  return [
    {
      label: {
        id: "Energi spesifik minimum sama dengan satu setengah kali kedalaman kritis",
        en: "Minimum specific energy equals one and a half times critical depth",
      },
      source: "Hasil tertutup untuk penampang persegi, Chow (1959) Bab 3",
      kind: "terbitan",
      expected: 1.5 * yc,
      actual: specificEnergy(yc, q),
      tol: 1e-9,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Fungsi momentum minimum sama dengan satu setengah kali kuadrat kedalaman kritis",
        en: "The minimum momentum function equals one and a half times the square of critical depth",
      },
      source: "Hasil tertutup untuk penampang persegi, Chow (1959) Bab 3",
      kind: "terbitan",
      expected: 1.5 * yc * yc,
      actual: momentumFunction(yc, q),
      tol: 1e-9,
      unit: "m³/m",
      digits: 6,
    },
    {
      label: {
        id: "Kehilangan energi sama dengan rumus tertutup Belanger",
        en: "The energy loss equals the closed-form Belanger result",
      },
      source: "Rumus (y₂ − y₁)³ / (4 y₁ y₂), Chow (1959) Bab 15",
      kind: "terbitan",
      expected: hilangTerbitan,
      actual: Fr1 > 1 ? E1 - E2 : 0,
      tol: 1e-9,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Kedua kedalaman punya fungsi momentum yang sama persis",
        en: "Both depths have exactly the same momentum function",
      },
      source: "Syarat berdirinya loncatan air",
      kind: "sifat",
      expected: momentumFunction(y1, q),
      actual: momentumFunction(y2, q),
      tol: 1e-9,
      unit: "m³/m",
      digits: 6,
    },
    {
      label: {
        id: "Mencari pasangan lewat fungsi momentum sama dengan lewat Belanger",
        en: "Finding the pair through the momentum function matches Belanger",
      },
      source: "Dua jalur perhitungan yang sama sekali berbeda",
      kind: "silang",
      expected: y2,
      actual: Fr1 > 1 ? conjugateFromMomentum(y1, q) : y1,
      tol: 1e-9,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Energi tidak pernah bertambah melewati loncatan",
        en: "Energy never increases across the jump",
      },
      source: "Hukum kedua termodinamika, diterapkan pada loncatan air",
      kind: "perilaku",
      expected: 1,
      actual: E1 - E2 >= -1e-12 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
  ];
}


/* ------------------------------------------------------------------ *
 * HS-06 Tirai luapan bebas
 * ------------------------------------------------------------------ */

export function checksNappe(h: number, b: number, P: number): Check[] {
  const r = rectWeirDischarge(h, b, P);

  // Bentuk WES bersifat serupa diri: y dibagi Hd hanya bergantung pada x
  // dibagi Hd. Dua tinggi rancangan yang berbeda harus memberi angka yang sama.
  const serupaA = wesNappe(1, 0.4) / 1;
  const serupaB = wesNappe(3, 1.2) / 3;

  // Membalik rumus debit untuk menemukan kembali tinggi muka airnya.
  const heBalik = Math.pow(
    r.Q / ((2 / 3) * r.Ce * Math.sqrt(2 * G) * b),
    2 / 3
  );

  return [
    {
      label: {
        id: "Pada jarak sejauh tinggi rancangan, tirai sudah turun setengahnya",
        en: "At a distance equal to the design head, the nappe has dropped by half",
      },
      source: "Persamaan bentuk mercu WES, USACE Hydraulic Design Criteria",
      kind: "terbitan",
      expected: h / 2,
      actual: wesNappe(h, h),
      tol: 1e-12,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Pada batas atas rentang, h dibagi P sama dengan dua, koefisiennya 0,752",
        en: "At the upper limit of the range, h over P equal to two, the coefficient is 0.752",
      },
      source: "ISO 1438, bentuk Kindsvater-Carter untuk ambang selebar penuh",
      kind: "terbitan",
      expected: 0.752,
      actual: rectWeirCe(2 * P, P),
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Bentuk tirai serupa diri terhadap tinggi rancangannya",
        en: "The nappe shape is self-similar with respect to its design head",
      },
      source: "Sifat persamaan pangkat yang harus berlaku",
      kind: "sifat",
      expected: serupaA,
      actual: serupaB,
      tol: 1e-12,
      digits: 8,
    },
    {
      label: {
        id: "Membalik rumus debit mengembalikan tinggi muka air efektif",
        en: "Inverting the discharge formula returns the effective head",
      },
      source: "Rumus ambang tajam harus dapat dibalik",
      kind: "pulang-pergi",
      expected: r.he,
      actual: heBalik,
      tol: 1e-9,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Koefisien debit naik saat ambangnya diperpendek",
        en: "The discharge coefficient rises as the weir is shortened",
      },
      source: "Kecepatan datang yang makin besar, ISO 1438",
      kind: "perilaku",
      expected: 1,
      actual: rectWeirCe(h, P / 2) > rectWeirCe(h, P) ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Lintasan peluru selalu jatuh lebih cepat daripada tirai sesungguhnya",
        en: "The projectile path always falls faster than the real nappe",
      },
      source: "Lintasan peluru mengabaikan tekanan dan lengkung aliran di atas mercu",
      kind: "perilaku",
      expected: 1,
      actual:
        jetTrajectory(r.V0, h) > wesNappe(h, h) ? 1 : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * HS-07 Vena contracta
 * ------------------------------------------------------------------ */

export function checksOrifice(
  H: number,
  a: number,
  b: number,
  Cv: number,
  Cc: number
): Check[] {
  const r = orificeJet(H, a, b, Cv, Cc);
  const ideal = orificeJet(H, a, b, 1, Cc);

  // Lintasan pancaran tanpa kehilangan kecepatan harus memenuhi x kuadrat sama
  // dengan empat H y. Dicek pada satu absis yang bukan titik istimewa.
  const xUji = 2 * H * 0.7;
  const yTerbitan = (xUji * xUji) / (4 * H);

  return [
    {
      label: {
        id: "Koefisien kontraksi teoretis celah dua dimensi",
        en: "Theoretical contraction coefficient of a two-dimensional slot",
      },
      source: "Penyelesaian Kirchhoff, pi dibagi pi tambah dua",
      kind: "terbitan",
      expected: 0.611015,
      actual: ORIFICE_CC_SLOT,
      tol: 1e-5,
      tolReason: {
        id: "Nilai acuannya ditulis dengan enam angka berarti, jadi toleransinya mengikuti penulisan itu, bukan ketelitian mesin.",
        en: "The reference value is written to six significant figures, so the tolerance follows that writing rather than machine precision.",
      },
      digits: 6,
    },
    {
      label: {
        id: "Kecepatan tanpa kehilangan sama dengan rumus Torricelli",
        en: "The loss-free velocity equals the Torricelli result",
      },
      source: "Torricelli (1643), akar dua g H",
      kind: "terbitan",
      expected: Math.sqrt(2 * G * H),
      actual: r.Vth,
      tol: 1e-12,
      unit: "m/s",
      digits: 6,
    },
    {
      label: {
        id: "Lintasan pancaran tanpa kehilangan memenuhi x kuadrat sama dengan empat H y",
        en: "The loss-free jet path satisfies x squared equals four H y",
      },
      source: "Gabungan Torricelli dan gerak peluru, hasil tertutup",
      kind: "terbitan",
      expected: yTerbitan,
      actual: orificeTrajectory(ideal.V, xUji),
      tol: 1e-12,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Koefisien debit adalah hasil kali kontraksi dan kecepatan",
        en: "The discharge coefficient is the product of contraction and velocity",
      },
      source: "Definisi ketiga koefisien",
      kind: "sifat",
      expected: Cc * Cv,
      actual: r.Cd,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Debit sama dengan kecepatan sesungguhnya dikali luas pancaran",
        en: "The discharge equals the real velocity times the jet area",
      },
      source: "Kekekalan massa di vena contracta",
      kind: "silang",
      expected: r.Cd * r.area * Math.sqrt(2 * G * H),
      actual: r.Q,
      tol: 1e-12,
      unit: "m³/s",
      digits: 8,
    },
    {
      label: {
        id: "Tanpa kehilangan kecepatan, tidak ada energi yang hilang",
        en: "With no velocity loss, no energy is lost",
      },
      source: "Sifat yang harus berlaku pada koefisien kecepatan sama dengan satu",
      kind: "sifat",
      expected: 0,
      actual: ideal.headLoss,
      tol: 0,
      absTol: 1e-12,
      unit: "m",
      digits: 8,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * FM-02 Venturi
 * ------------------------------------------------------------------ */

export function checksVenturi(
  D1: number,
  D2: number,
  dh: number,
  C: number
): Check[] {
  const r = venturiDischarge(D1, D2, dh, C);
  const A1 = (Math.PI / 4) * D1 * D1;
  const A2 = (Math.PI / 4) * D2 * D2;

  return [
    {
      label: {
        id: "Koefisien debit venturi klasik dengan leher hasil pemesinan",
        en: "Discharge coefficient of a classical Venturi with a machined throat",
      },
      source: "ISO 5167-4, tabung venturi klasik",
      kind: "terbitan",
      expected: 0.995,
      actual: VENTURI_C_MACHINED,
      tol: 1e-12,
      digits: 4,
    },
    {
      label: {
        id: "Faktor kecepatan datang sama dengan satu per akar satu kurang beta pangkat empat",
        en: "The velocity of approach factor equals one over the root of one minus beta to the fourth",
      },
      source: "Bentuk tertutup pada ISO 5167",
      kind: "terbitan",
      expected: 1 / Math.sqrt(1 - Math.pow(D2 / D1, 4)),
      actual: r.approachFactor,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Kekekalan massa terpenuhi antara pipa dan leher",
        en: "Continuity holds between the pipe and the throat",
      },
      source: "Kekekalan massa, dua penampang satu debit",
      kind: "sifat",
      expected: r.V1 * A1,
      actual: r.V2 * A2,
      tol: 1e-12,
      unit: "m³/s",
      digits: 8,
    },
    {
      label: {
        id: "Menghitung balik beda tinggi tekan mengembalikan bacaan semula",
        en: "Computing the head difference back returns the original reading",
      },
      source: "Rumus venturi harus dapat dibalik",
      kind: "pulang-pergi",
      expected: dh,
      actual: venturiHead(D1, D2, r.Q, C),
      tol: 1e-9,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Beda tinggi tekan sama dengan selisih tinggi kecepatan pada koefisien satu",
        en: "The head difference equals the velocity head difference at unit coefficient",
      },
      source: "Persamaan Bernoulli tanpa kehilangan",
      kind: "silang",
      expected: dh,
      actual: (() => {
        const ideal = venturiDischarge(D1, D2, dh, 1);
        return (ideal.V2 * ideal.V2 - ideal.V1 * ideal.V1) / (2 * G);
      })(),
      tol: 1e-9,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Leher yang lebih sempit memberi bacaan lebih besar pada debit yang sama",
        en: "A narrower throat gives a larger reading at the same discharge",
      },
      source: "Perilaku yang harus berlaku pada alat beda tekanan",
      kind: "perilaku",
      expected: 1,
      actual:
        venturiHead(D1, D2 * 0.8, r.Q, C) > venturiHead(D1, D2, r.Q, C) ? 1 : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * FM-03 Tabung Pitot
 * ------------------------------------------------------------------ */

export function checksPitot(dh: number, D: number, n: number): Check[] {
  const V = pitotVelocity(dh);
  const R = D / 2;
  const uMax = V;

  // Integrasi numerik profil pada penampang lingkaran, dipakai sebagai
  // pembanding bagi rumus tertutupnya.
  const N = 4000;
  let jumlah = 0;
  for (let i = 0; i < N; i++) {
    const r = ((i + 0.5) * R) / N;
    jumlah += powerLawVelocity(r, R, uMax, n) * 2 * Math.PI * r * (R / N);
  }
  const rasioNumerik = jumlah / (Math.PI * R * R) / uMax;

  return [
    {
      label: {
        id: "Tinggi kecepatan pada satu meter per detik adalah 51 milimeter",
        en: "The velocity head at one metre per second is 51 millimetres",
      },
      source: "V kuadrat per dua g, dihitung dengan tangan",
      kind: "terbitan",
      expected: 1 / (2 * G),
      actual: pitotHead(1),
      tol: 1e-12,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Perbandingan kecepatan rata-rata terhadap sumbu pada pangkat satu per tujuh",
        en: "Ratio of mean to centreline velocity for the one-seventh power law",
      },
      source: "Hasil tertutup dua n kuadrat per (n+1)(2n+1), Schlichting Boundary-Layer Theory",
      kind: "terbitan",
      expected: 98 / 120,
      actual: powerLawMeanRatio(7),
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Rumus tertutup rasio kecepatan cocok dengan integrasi numerik profilnya",
        en: "The closed-form velocity ratio matches numerical integration of the profile",
      },
      source: "Dua jalur perhitungan yang berbeda pada profil yang sama",
      kind: "silang",
      expected: powerLawMeanRatio(n),
      actual: rasioNumerik,
      tol: 0.002,
      tolReason: {
        id: "Integrasi numerik memakai empat ribu pias dan turunan profilnya menjadi tak hingga tepat di dinding, jadi sisa selisihnya milik cara integrasinya.",
        en: "The numerical integration uses four thousand strips and the profile derivative becomes infinite exactly at the wall, so the remaining difference belongs to the integration.",
      },
      digits: 6,
    },
    {
      label: {
        id: "Menghitung balik beda tinggi tekan mengembalikan bacaan semula",
        en: "Computing the head difference back returns the original reading",
      },
      source: "Hubungan Pitot harus dapat dibalik",
      kind: "pulang-pergi",
      expected: dh,
      actual: pitotHead(V),
      tol: 1e-12,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Kecepatan di sumbu pipa sama dengan kecepatan maksimum profil",
        en: "The velocity on the pipe axis equals the maximum of the profile",
      },
      source: "Definisi profil hukum pangkat",
      kind: "sifat",
      expected: uMax,
      actual: powerLawVelocity(0, R, uMax, n),
      tol: 1e-12,
      unit: "m/s",
      digits: 6,
    },
    {
      label: {
        id: "Kecepatan setempat pada jari-jari acuan sama dengan kecepatan rata-rata",
        en: "The local velocity at the reference radius equals the mean velocity",
      },
      source: "Letak titik ukur tunggal, turunan dari profilnya",
      kind: "silang",
      expected: uMax * powerLawMeanRatio(n),
      actual: powerLawVelocity(powerLawMeanRadius(R, n), R, uMax, n),
      tol: 1e-9,
      unit: "m/s",
      digits: 6,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * FM-04 Flum berleher panjang
 * ------------------------------------------------------------------ */

export function checksFlume(
  h1: number,
  bThroat: number,
  bApproach: number,
  p: number,
  Lthroat: number,
  Cd: number
): Check[] {
  const r = flumeDischarge(h1, bThroat, bApproach, p, Lthroat, Cd);

  return [
    {
      label: {
        id: "Tetapan aliran kritis pada leher persegi adalah 1,7049",
        en: "The critical flow constant for a rectangular throat is 1.7049",
      },
      source: "Dua per tiga pangkat satu setengah dikali akar g, Bos (1989) Discharge Measurement Structures",
      kind: "terbitan",
      expected: 1.704895,
      actual: FLUME_C,
      tol: 1e-6,
      tolReason: {
        id: "Nilai acuannya ditulis dengan tujuh angka berarti, jadi toleransinya mengikuti penulisan itu.",
        en: "The reference value is written to seven significant figures, so the tolerance follows that writing.",
      },
      digits: 6,
    },
    {
      label: {
        id: "Kedalaman kritis di leher adalah dua per tiga tinggi energi",
        en: "Critical depth in the throat is two thirds of the total head",
      },
      source: "Kondisi kritis pada penampang persegi, Chow (1959) Bab 3",
      kind: "terbitan",
      expected: (2 / 3) * r.H1,
      actual: r.yc,
      tol: 1e-12,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Debit di leher sama dengan luas kritis dikali kecepatan kritis",
        en: "The throat discharge equals the critical area times the critical velocity",
      },
      source: "Dua jalur perhitungan yang harus bertemu di leher",
      kind: "silang",
      expected: r.Q / Cd,
      actual: bThroat * r.yc * Math.sqrt(G * r.yc),
      tol: 1e-9,
      unit: "m³/s",
      digits: 6,
    },
    {
      label: {
        id: "Bilangan Froude di leher sama dengan satu",
        en: "The Froude number in the throat equals one",
      },
      source: "Definisi kondisi kritis",
      kind: "sifat",
      expected: 1,
      actual: froude(
        r.yc > 0 ? r.Q / Cd / (bThroat * r.yc) : 0,
        r.yc
      ),
      tol: 1e-9,
      digits: 6,
    },
    {
      label: {
        id: "Koefisien kecepatan datang tidak pernah lebih kecil daripada satu",
        en: "The velocity of approach coefficient is never smaller than one",
      },
      source: "Tinggi energi tidak pernah lebih kecil daripada tinggi muka air",
      kind: "perilaku",
      expected: 1,
      actual: r.Cv >= 1 - 1e-12 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Saluran datang yang lebih lebar mengecilkan koefisien kecepatan datang",
        en: "A wider approach channel reduces the velocity of approach coefficient",
      },
      source: "Perilaku yang harus berlaku: kecepatan datang mengecil",
      kind: "perilaku",
      expected: 1,
      actual:
        flumeDischarge(h1, bThroat, bApproach * 3, p, Lthroat, Cd).Cv <= r.Cv
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Froude di penampang ukur di atas 0,5 ditandai, dan leher yang terlalu lebar ditolak",
        en: "Froude above 0.5 at the gauging section is flagged, and an over-wide throat is refused",
      },
      source: "Batas Fr₁ ≤ 0,5 pada ISO 4359, dan syarat adanya penampang kendali",
      kind: "perilaku",
      expected: 1,
      actual:
        flumeDischarge(0.3, 1.0, 1.2, 0, 0.9, 0.99).reason === "Fr-besar" &&
        !flumeDischarge(0.02, 0.6, 0.15, 0, 0.9, 0.99).controlled &&
        flumeDischarge(0.3, 0.6, 1.2, 0.25, 0.9, 0.99).reason === ""
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    }
  ];
}

/* ------------------------------------------------------------------ *
 * FM-05 Pengukuran pengenceran garam
 * ------------------------------------------------------------------ */

export function checksTracer(
  Q: number,
  M: number,
  L: number,
  A: number,
  D: number
): Check[] {
  const r = tracerCurve(Q, M, L, A, D);
  const rLebar = tracerCurve(Q, M, L, A, D * 3);

  // Cara laju tetap, disusun agar hasilnya seharusnya debit yang sama, lalu
  // dihitung ulang lewat rumus yang sama sekali berbeda.
  const qSuntik = 0.5;
  const c1 = 200000;
  const c0 = 5;
  const c2 = (qSuntik * c1 + Q * 1000 * c0) / (qSuntik + Q * 1000);

  return [
    {
      label: {
        id: "Luas di bawah kurva mengembalikan debit yang dipakai membuatnya",
        en: "The area under the curve returns the discharge used to build it",
      },
      source: "ISO 9555, cara penyuntikan sesaat",
      kind: "pulang-pergi",
      expected: Q,
      actual: r.Qgulp,
      tol: 0.002,
      tolReason: {
        id: "Kurvanya dibuat dari penyelesaian sebaran lalu luasnya dijumlahkan dengan aturan trapesium pada rentang waktu yang berhingga. Ekor kurva yang terpotong dan lebar pias itulah sisa selisihnya.",
        en: "The curve comes from the dispersion solution and its area is summed with the trapezoidal rule over a finite time window. The truncated tail and the strip width are what remain.",
      },
      unit: "m³/s",
      digits: 5,
    },
    {
      label: {
        id: "Cara laju tetap memberi debit yang sama dengan cara penyuntikan sesaat",
        en: "The constant-rate method gives the same discharge as the gulp method",
      },
      source: "ISO 9555 memuat kedua cara, dan keduanya harus sepakat",
      kind: "silang",
      expected: Q,
      actual: dilutionDischarge(qSuntik, c1, c2, c0),
      tol: 1e-9,
      unit: "m³/s",
      digits: 6,
    },
    {
      label: {
        id: "Sebaran yang lebih besar melebarkan kurva tetapi tidak mengubah luasnya",
        en: "Greater dispersion widens the curve without changing its area",
      },
      source: "Kekekalan massa: seluruh garam yang disuntikkan pasti lewat",
      kind: "sifat",
      expected: r.Qgulp,
      actual: rLebar.Qgulp,
      tol: 0.005,
      tolReason: {
        id: "Kurva yang lebih lebar memotong ekornya sedikit berbeda pada rentang waktu yang dipilih, dan itu satu-satunya sumber selisihnya.",
        en: "A wider curve truncates its tail slightly differently within the chosen time window, and that is the only source of the difference.",
      },
      unit: "m³/s",
      digits: 5,
    },
    {
      label: {
        id: "Waktu tempuh sama dengan jarak dibagi kecepatan rata-rata",
        en: "The travel time equals the distance divided by the mean velocity",
      },
      source: "Kinematika, dihitung dengan tangan",
      kind: "sifat",
      expected: (L * A) / Q,
      actual: r.tTravel,
      tol: 1e-12,
      unit: "s",
      digits: 4,
    },
    {
      label: {
        id: "Sebaran yang lebih besar menurunkan kepekatan puncak",
        en: "Greater dispersion lowers the peak concentration",
      },
      source: "Perilaku yang harus berlaku: massa tetap, kurva melebar",
      kind: "perilaku",
      expected: 1,
      actual: rLebar.cPeak < r.cPeak ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Massa yang disuntikkan dua kali lipat memberi kepekatan dua kali lipat",
        en: "Doubling the injected mass doubles the concentration",
      },
      source: "Kelinieran persamaan sebaran terhadap massa",
      kind: "sifat",
      expected: 2 * r.cPeak,
      actual: tracerCurve(Q, 2 * M, L, A, D).cPeak,
      tol: 1e-9,
      unit: "mg/l",
      digits: 4,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * PI-02 Bagan Wallingford
 * ------------------------------------------------------------------ */

export function checksWallingford(
  D: number,
  S: number,
  ks: number,
  nu: number
): Check[] {
  const r = wallingfordVelocity(D, S, ks, nu);
  const A = (Math.PI / 4) * D * D;

  // Perjalanan bolak-balik: dari kecepatan yang keluar, hitung kembali
  // kemiringan hidroliknya lewat Darcy-Weisbach dengan f dari Colebrook.
  const fCole = colebrookFriction(r.Re, ks / D);
  const Sbalik = (fCole * r.V * r.V) / (D * 2 * G);

  return [
    {
      label: {
        id: "Faktor gesekan bentuk terbuka sama dengan penyelesaian Colebrook",
        en: "The friction factor from the open form equals the Colebrook solution",
      },
      source: "Colebrook (1939), dua jalan menuju besaran yang sama",
      kind: "silang",
      expected: fCole,
      actual: r.f,
      tol: 1e-9,
      unit: "",
      digits: 6,
    },
    {
      label: {
        id: "Kemiringan hidrolik pulang ke nilai yang dimasukkan",
        en: "The hydraulic gradient returns to the value entered",
      },
      source: "Darcy-Weisbach, perjalanan bolak-balik",
      kind: "pulang-pergi",
      expected: S,
      actual: Sbalik,
      tol: 1e-9,
      digits: 6,
    },
    {
      label: {
        id: "Debit sama dengan kecepatan dikali luas penampang",
        en: "Discharge equals velocity times cross-sectional area",
      },
      source: "Definisi debit",
      kind: "sifat",
      expected: r.V * A,
      actual: r.Q,
      tol: 1e-12,
      unit: "m³/s",
      digits: 6,
    },
    {
      label: {
        id: "Pipa yang lebih kasar mengalirkan lebih lambat",
        en: "A rougher pipe flows more slowly",
      },
      source: "Perilaku yang harus berlaku pada Colebrook-White",
      kind: "perilaku",
      // Kekasaran ditambah satu milimeter, bukan dikali tiga: pada dinding
      // licin sempurna perkalian tidak mengubah apa pun dan pemeriksaannya
      // menjadi hampa justru pada keadaan yang paling perlu diperiksa.
      expected: 1,
      actual: wallingfordVelocity(D, S, ks + 0.001, nu).V < r.V ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Pada dinding licin sempurna hasilnya tetap terhingga",
        en: "On a perfectly smooth wall the result stays finite",
      },
      source: "Suku kekentalan menahan penyebutnya, bukan kekasaran",
      kind: "sifat",
      expected: 1,
      actual: Number.isFinite(wallingfordVelocity(D, S, 0, nu).V) ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Kemiringan empat kali lipat menaikkan kecepatan sedikit lebih dari dua kali",
        en: "Quadrupling the gradient raises the velocity a little more than double",
      },
      source:
        "Pada aliran kasar penuh V sebanding akar S persis; pada peralihan f ikut turun sehingga kenaikannya melebihi dua kali",
      kind: "perilaku",
      expected: 1,
      actual:
        wallingfordVelocity(D, S * 4, ks, nu).V >= 2 * r.V &&
        wallingfordVelocity(D, S * 4, ks, nu).V < 2.4 * r.V
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * PI-03 Hukum dinding
 * ------------------------------------------------------------------ */

export function checksWallLaw(uStar: number, nu: number): Check[] {
  const di100 = wallLaw(100);
  const di1 = wallLaw(1);

  /*
   * Titik potong kedua hukum, dicari dengan bagi dua.
   *
   * Angka 11,6 yang terkenal sebagai batas lapisan kental semu berasal dari
   * pasangan tetapan lama, 0,40 dan 5,5. Pasangan yang dipakai lembar ini,
   * 0,41 dan 5,0, memberi 10,80. Keduanya dihitung di sini: yang pertama
   * untuk diuji terhadap nilai terbitan, yang kedua untuk ditampilkan.
   */
  const potongDi = (kappa: number, B: number) => {
    let lo = 5;
    let hi = 30;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      const w = wallLaw(mid, kappa, B);
      if (w.viscous > w.log) hi = mid;
      else lo = mid;
    }
    return (lo + hi) / 2;
  };
  const potong = potongDi(0.4, 5.5);

  return [
    {
      label: {
        id: "Tetapan von Karman sesuai nilai terbitan",
        en: "The von Karman constant matches the published value",
      },
      source: "Nikuradse (1932), nilai 0,41 yang dipakai luas",
      kind: "terbitan",
      expected: 0.41,
      actual: KARMAN,
      tol: 1e-12,
      digits: 4,
    },
    {
      label: {
        id: "Di lapisan kental kecepatan tak berdimensi sama dengan jaraknya",
        en: "In the viscous layer the dimensionless velocity equals the distance",
      },
      source: "Bentuk baku hukum dinding, u+ = y+",
      kind: "sifat",
      expected: 1,
      actual: di1.viscous,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Hukum logaritmik pada y+ seratus memberi 16,22",
        en: "The log law at y+ of one hundred gives 16.22",
      },
      source: "Dihitung dengan tangan dari (1/0,41) ln 100 + 5",
      kind: "terbitan",
      expected: (1 / 0.41) * Math.log(100) + 5,
      actual: di100.log,
      tol: 1e-12,
      digits: 4,
    },
    {
      label: {
        id: "Pada tetapan lama kedua hukum berpotongan di 11,6",
        en: "With the older constants the two laws cross at 11.6",
      },
      source: "Batas lapisan kental semu yang lazim dikutip, tetapan 0,40 dan 5,5",
      kind: "terbitan",
      expected: 11.6,
      actual: potong,
      tol: 0.005,
      tolReason: {
        id: "Nilai 11,6 adalah pembulatan dari titik potong yang sesungguhnya 11,635.",
        en: "The value 11.6 is a rounding of a crossing point that is actually 11.635.",
      },
      digits: 3,
    },
    {
      label: {
        id: "Penggolongan lapisan sesuai batas 5 dan 30",
        en: "The layer classification follows the limits 5 and 30",
      },
      source: "Batas baku lapisan kental dan lapisan logaritmik",
      kind: "perilaku",
      expected: 1,
      actual:
        wallLaw(4).layer === "kental" &&
        wallLaw(10).layer === "penyangga" &&
        wallLaw(31).layer === "logaritmik"
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Tebal lapisan kental berbanding terbalik dengan kecepatan gesek",
        en: "The viscous sublayer thickness varies inversely with the friction velocity",
      },
      source: "Definisi y+ = y u* / nu pada y+ = 5",
      kind: "sifat",
      expected: viscousSublayer(uStar, nu) / 2,
      actual: viscousSublayer(uStar * 2, nu),
      tol: 1e-12,
      unit: "m",
      digits: 8,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * OC-10 Hukum gesekan
 * ------------------------------------------------------------------ */

export function checksFrictionLaws(n: number, R: number): Check[] {
  const C = chezyFromManning(n, R);
  const f = darcyFromChezy(C);

  return [
    {
      label: {
        id: "Perjalanan bolak-balik Chezy ke Darcy dan kembali",
        en: "Round trip from Chezy to Darcy and back",
      },
      source: "C = sqrt(8 g / f), dibalik pada nilai yang sama",
      kind: "pulang-pergi",
      expected: C,
      actual: chezyFromDarcy(f),
      tol: 1e-12,
      unit: "m^0,5/s",
      digits: 6,
    },
    {
      label: {
        id: "Kecepatan Chezy sama dengan kecepatan Manning",
        en: "The Chezy velocity equals the Manning velocity",
      },
      source: "Kedua rumus pada jari-jari hidrolik dan kemiringan yang sama",
      kind: "silang",
      expected: (1 / n) * Math.pow(R, 2 / 3) * Math.sqrt(0.001),
      actual: chezyVelocity(C, R, 0.001),
      tol: 1e-12,
      unit: "m/s",
      digits: 6,
    },
    {
      label: {
        id: "Kekasaran Strickler untuk kerikil 50 mm mendekati 0,029",
        en: "The Strickler roughness for 50 mm gravel is close to 0.029",
      },
      source: "Strickler (1923), n = ks^(1/6) / 21,1",
      kind: "terbitan",
      expected: 0.0288,
      actual: stricklerN(0.05),
      tol: 0.005,
      tolReason: {
        id: "Nilai acuannya sendiri dibulatkan ke tiga angka di belakang koma pada sebagian besar buku ajar.",
        en: "The reference value itself is rounded to three decimals in most textbooks.",
      },
      digits: 5,
    },
    {
      label: {
        id: "Saluran yang lebih dalam memberi koefisien Chezy lebih besar",
        en: "A deeper channel gives a larger Chezy coefficient",
      },
      source: "Ketergantungan C pada jari-jari hidrolik, R pangkat seperenam",
      kind: "perilaku",
      expected: 1,
      actual: chezyFromManning(n, R * 4) > C ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Melipatempatkan jari-jari hidrolik menaikkan C sebesar 2 pangkat sepertiga",
        en: "Quadrupling the hydraulic radius raises C by two to the one third",
      },
      source: "Akibat langsung dari pangkat seperenam, dihitung dengan tangan",
      kind: "sifat",
      expected: Math.pow(2, 1 / 3),
      actual: chezyFromManning(n, R * 4) / C,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Faktor gesekan tidak pernah negatif pada kekasaran apa pun",
        en: "The friction factor is never negative at any roughness",
      },
      source: "Sifat yang harus berlaku di seluruh rentang masukan",
      kind: "sifat",
      expected: 1,
      actual: darcyFromChezy(chezyFromManning(0.07, 0.01)) > 0 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * SD-01 Kurva Shields
 * ------------------------------------------------------------------ */

export function checksShields(
  R: number,
  S: number,
  d: number,
  s: number,
  nu: number
): Check[] {
  const r = shieldsState(R, S, d, s, nu);

  return [
    {
      label: {
        id: "Pada butir kasar kurvanya menuju dataran 0,055",
        en: "For coarse grains the curve approaches the plateau of 0.055",
      },
      source: "Shields (1936), nilai dataran yang dikenal sejak semula",
      kind: "terbitan",
      expected: SHIELDS_PLATEAU,
      actual: shieldsCritical(1e6),
      tol: 0.001,
      tolReason: {
        id: "Bentuk tertutupnya mendekati dataran secara asimtotik, jadi selisihnya tidak pernah persis nol.",
        en: "The closed form approaches the plateau asymptotically, so the difference is never exactly zero.",
      },
      digits: 5,
    },
    {
      label: {
        id: "Pasir sedang, 0,5 mm, bergerak pada tegangan sekitar 0,2 pascal",
        en: "Medium sand of 0.5 mm moves at about 0.2 pascal",
      },
      source: "Nilai lapangan yang lazim dikutip untuk pasir sedang",
      kind: "terbitan",
      expected: 0.22,
      actual: shieldsState(1, 0.001, 0.0005, SEDIMENT_S, nu).tauCritical,
      tol: 0.25,
      tolReason: {
        id: "Angka lapangan untuk pasir sedang tersebar antara 0,15 dan 0,3 pascal tergantung bentuk butirnya.",
        en: "Field values for medium sand scatter between 0.15 and 0.3 pascal depending on grain shape.",
      },
      unit: "Pa",
      digits: 4,
    },
    {
      label: {
        id: "Bilangan Shields sama dengan tegangan dibagi tegangan kritis dikali theta kritis",
        en: "The Shields number equals stress over critical stress times the critical value",
      },
      source: "Definisi bilangan Shields, disusun ulang",
      kind: "silang",
      expected: r.theta,
      actual:
        r.tauCritical > 0
          ? (r.tau / r.tauCritical) * r.thetaCritical
          : 0,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Butir bergerak tepat ketika tegangan melampaui tegangan kritis",
        en: "The grain moves exactly when the stress exceeds the critical stress",
      },
      source: "Sifat yang harus berlaku pada penanda di lembar ini",
      kind: "perilaku",
      expected: 1,
      actual: r.moving === r.tau > r.tauCritical ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Kedalaman kritis memberi tegangan yang persis kritis",
        en: "The critical depth gives exactly the critical stress",
      },
      source: "Perjalanan bolak-balik lewat tau = rho g R S",
      kind: "pulang-pergi",
      expected: r.tauCritical,
      actual: Number.isFinite(r.RCritical)
        ? shieldsState(r.RCritical, S, d, s, nu).tau
        : r.tauCritical,
      tol: 1e-9,
      unit: "Pa",
      digits: 6,
    },
    {
      label: {
        id: "Butir yang lebih besar menuntut tegangan yang lebih besar",
        en: "A larger grain demands a larger stress",
      },
      source: "Perilaku yang harus berlaku di seluruh rentang ukuran butir",
      kind: "perilaku",
      expected: 1,
      actual:
        shieldsState(R, S, d * 2, s, nu).tauCritical > r.tauCritical ? 1 : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * SD-02 Profil Rouse
 * ------------------------------------------------------------------ */

export function checksRouse(
  d: number,
  s: number,
  nu: number,
  uStar: number,
  h: number,
  a: number
): Check[] {
  const r = rouseState(d, s, nu, uStar, h, a);

  // Butir yang cukup halus harus kembali ke hukum Stokes, karena suku
  // kekentalan di penyebut Ferguson-Church menguasai seluruhnya.
  const dHalus = 1e-5;
  const stokes = ((s - 1) * G * dHalus * dHalus) / (18 * nu);

  return [
    {
      label: {
        id: "Pada butir sangat halus kecepatan endap kembali ke hukum Stokes",
        en: "For very fine grains the settling velocity returns to Stokes law",
      },
      source: "Hukum Stokes, ws = (s-1) g d² / 18ν",
      kind: "terbitan",
      expected: stokes,
      actual: settlingVelocity(dHalus, s, nu),
      tol: 0.01,
      tolReason: {
        id: "Suku seret di penyebut Ferguson-Church tidak pernah persis nol, jadi hasilnya selalu sedikit di bawah Stokes.",
        en: "The drag term in the Ferguson-Church denominator is never exactly zero, so the result always sits a little below Stokes.",
      },
      unit: "m/s",
      digits: 8,
    },
    {
      label: {
        id: "Kepekatan nisbi tepat satu pada ketinggian acuan",
        en: "The relative concentration is exactly one at the reference height",
      },
      source: "Definisi profil Rouse",
      kind: "sifat",
      expected: 1,
      actual: rouseConcentration(a, h, a, r.Z),
      tol: 1e-12,
      digits: 8,
    },
    {
      label: {
        id: "Bilangan Rouse satu berarti kecepatan endap sama dengan kappa kali kecepatan gesek",
        en: "A Rouse number of one means the settling velocity equals kappa times the friction velocity",
      },
      source: "Definisi bilangan Rouse, diperiksa pada nilai satu",
      kind: "silang",
      expected: 1,
      actual: rouseNumber(KARMAN * uStar, uStar),
      tol: 1e-12,
      digits: 8,
    },
    {
      label: {
        id: "Butir yang lebih berat menumpuk lebih banyak di separuh bawah",
        en: "A heavier grain piles up more in the lower half",
      },
      source: "Perilaku yang harus berlaku pada profil Rouse",
      kind: "perilaku",
      expected: 1,
      actual:
        rouseState(d * 2, s, nu, uStar, h, a).lowerHalf >= r.lowerHalf ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Aliran yang lebih deras menyebarkan muatan lebih merata",
        en: "A stronger flow spreads the load more evenly",
      },
      source: "Perilaku yang harus berlaku: bilangan Rouse turun bila u* naik",
      kind: "perilaku",
      expected: 1,
      actual: rouseState(d, s, nu, uStar * 2, h, a).Z < r.Z ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Pada bilangan Rouse nol sebarannya merata sepanjang kedalaman",
        en: "At a Rouse number of zero the distribution is uniform over the depth",
      },
      source: "Sifat yang harus berlaku: pangkat nol memberi satu di mana saja",
      kind: "sifat",
      expected: 1,
      actual: rouseConcentration(h * 0.9, h, a, 0),
      tol: 1e-12,
      digits: 8,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * SD-03 Erosi dan suspensi
 * ------------------------------------------------------------------ */

export function checksHjulstrom(
  d: number,
  h: number,
  V: number,
  s: number,
  nu: number,
  n: number
): Check[] {
  const r = hjulstrom(d, h, V, s, nu, n);

  // Kurva pengendapan tidak boleh melampaui kurva erosi di mana pun, karena
  // butir tidak dapat mengendap pada aliran yang masih mengerosinya.
  let silang = 0;
  for (let lg = Math.log10(0.004); lg <= Math.log10(300); lg += 0.05) {
    const dk = Math.pow(10, lg) / 1000;
    const rk = hjulstrom(dk, h, V, s, nu, n);
    if (rk.deposition > rk.erosion + 1e-12) silang++;
  }

  // Kecepatan yang tertulis pada kurva erosi harus memberi tegangan yang
  // persis kritis bila dimasukkan kembali sebagai kecepatan aliran.
  const balik = hjulstrom(d, h, r.erosion, s, nu, n);

  return [
    {
      label: {
        id: "Kurva pengendapan tidak pernah melampaui kurva erosi",
        en: "The deposition curve never rises above the erosion curve",
      },
      source: "Sifat yang harus berlaku: butir tidak mengendap saat masih tererosi",
      kind: "sifat",
      expected: 0,
      actual: silang,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Kecepatan pada kurva erosi tepat berada di ambang gerak",
        en: "The velocity on the erosion curve sits exactly at the threshold of motion",
      },
      source: "Perjalanan bolak-balik lewat koefisien Chezy dan ambang Shields",
      kind: "pulang-pergi",
      expected: 1,
      actual: balik.state === "tererosi" || balik.state === "terangkut" ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Pasir halus 0,1 mm mulai tererosi sekitar 0,15 m per detik",
        en: "Fine sand of 0.1 mm starts to erode at about 0.15 m per second",
      },
      source: "Diagram Hjulstrom (1935), pita pada butir 0,1 mm",
      kind: "terbitan",
      expected: 0.16,
      actual: hjulstrom(0.0001, 1, 0.5, s, nu, 0.025).erosion,
      tol: 0.35,
      tolReason: {
        id: "Pita Hjulstrom asli memang lebar, kira-kira 0,1 sampai 0,25 m per detik pada ukuran ini, karena bergantung pada kekasaran dan kedalaman yang tidak disebutkan di gambarnya.",
        en: "The original Hjulstrom band is genuinely wide at this size, roughly 0.1 to 0.25 m per second, because it depends on roughness and depth that the figure never states.",
      },
      unit: "m/s",
      digits: 4,
    },
    {
      label: {
        id: "Butir yang lebih besar menuntut kecepatan erosi yang lebih besar",
        en: "A larger grain demands a larger erosion velocity",
      },
      source: "Perilaku yang harus berlaku di atas ukuran pasir",
      kind: "perilaku",
      expected: 1,
      actual:
        hjulstrom(0.01, h, V, s, nu, n).erosion >
        hjulstrom(0.001, h, V, s, nu, n).erosion
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Kurva melayang selalu di atas kurva erosi pada pasir dan kerikil",
        en: "The suspension curve always lies above the erosion curve for sand and gravel",
      },
      source: "Sifat yang harus berlaku: melayang menuntut lebih dari sekadar bergerak",
      kind: "sifat",
      expected: 1,
      actual:
        hjulstrom(0.0005, h, V, s, nu, n).suspension >
          hjulstrom(0.0005, h, V, s, nu, n).erosion &&
        hjulstrom(0.02, h, V, s, nu, n).suspension >
          hjulstrom(0.02, h, V, s, nu, n).erosion
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Butir kohesif di bawah 0,06 mm ditandai",
        en: "Cohesive grains below 0.06 mm are flagged",
      },
      source: "Batas golongan lanau, tempat kurva erosi berhenti berlaku",
      kind: "perilaku",
      expected: 1,
      actual:
        hjulstrom(0.00005, h, V, s, nu, n).cohesive &&
        !hjulstrom(0.0001, h, V, s, nu, n).cohesive
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * SD-04 Bak sedimentasi
 * ------------------------------------------------------------------ */

export function checksBasin(
  Q: number,
  L: number,
  B: number,
  H: number,
  d: number,
  s: number,
  nu: number,
  tanks: number
): Check[] {
  const r = settlingBasin(Q, L, B, H, d, s, nu, tanks);
  const dalam = settlingBasin(Q, L, B, H * 2, d, s, nu, tanks);

  return [
    {
      label: {
        id: "Efisiensi bak ideal tidak bergantung pada kedalaman bak",
        en: "The ideal basin efficiency does not depend on the basin depth",
      },
      source: "Hazen (1904), hasil yang berlawanan naluri dan menjadi isi lembar ini",
      kind: "sifat",
      expected: r.idealEfficiency,
      actual: dalam.idealEfficiency,
      tol: 1e-12,
      digits: 8,
    },
    {
      label: {
        id: "Laju limpah sama dengan debit dibagi luas permukaan",
        en: "The overflow rate equals discharge divided by surface area",
      },
      source: "Definisi laju limpah",
      kind: "sifat",
      expected: Q / (L * B),
      actual: r.overflowRate,
      tol: 1e-12,
      unit: "m/s",
      digits: 8,
    },
    {
      label: {
        id: "Panjang terpendek memberi efisiensi ideal tepat seratus persen",
        en: "The minimum length gives exactly one hundred per cent ideal efficiency",
      },
      source: "Perjalanan bolak-balik lewat laju limpah",
      kind: "pulang-pergi",
      expected: 1,
      actual: Number.isFinite(r.minLength)
        ? settlingBasin(Q, r.minLength, B, H, d, s, nu, tanks).idealEfficiency
        : 1,
      tol: 1e-9,
      digits: 8,
    },
    {
      label: {
        id: "Bak seri tak hingga menuju satu dikurangi e pangkat minus rasio",
        en: "Infinitely many tanks in series tend to one minus e to the minus ratio",
      },
      /*
       * Batas ini bukan bak ideal, dan itu justru pokoknya. Menambah jumlah
       * bak seri sampai berapa pun tidak pernah menyamai bak yang airnya
       * benar-benar tenang: pengadukan tetap membawa sebagian butir yang
       * sudah hampir mengendap kembali ke atas. Bak ideal memberi rasio itu
       * sendiri, batas ini memberi 1 - e^(-rasio), dan selisihnya adalah
       * harga tetap yang dibayar karena airnya bergerak.
       */
      source: "Batas bentuk pangkat Hazen ketika jumlah bak menuju tak hingga",
      kind: "sifat",
      expected: 1 - Math.exp(-r.ratio),
      actual: hazenEfficiency(r.ratio, 20000),
      tol: 1e-4,
      tolReason: {
        id: "Bentuk pangkat mendekati batasnya secara asimtotik; dua puluh ribu bak seri sudah cukup dekat untuk dibandingkan, tidak pernah persis sama.",
        en: "The power form approaches its limit asymptotically; twenty thousand tanks is close enough to compare, never exactly equal.",
      },
      digits: 6,
    },
    {
      label: {
        id: "Bak teraduk selalu kurang efisien daripada bak ideal",
        en: "A mixed basin is always less efficient than the ideal basin",
      },
      source: "Perilaku yang harus berlaku: pengadukan hanya merugikan",
      kind: "perilaku",
      expected: 1,
      actual: r.mixedEfficiency <= r.idealEfficiency + 1e-12 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Memperbesar luas permukaan menaikkan efisiensi",
        en: "Enlarging the surface area raises the efficiency",
      },
      source: "Perilaku yang harus berlaku pada laju limpah",
      kind: "perilaku",
      expected: 1,
      // Kenaikan tegas hanya dituntut selama masih ada ruang untuk naik.
      // Bak yang sudah menangkap hampir seluruh muatannya tidak dapat naik
      // lagi, dan menuntutnya naik membuat pemeriksaan ini gagal justru pada
      // rancangan yang paling baik.
      actual: (() => {
        const lebih = settlingBasin(Q, L * 2, B, H, d, s, nu, tanks)
          .mixedEfficiency;
        if (lebih < r.mixedEfficiency - 1e-12) return 0;
        return r.mixedEfficiency < 0.99 && lebih <= r.mixedEfficiency ? 0 : 1;
      })(),
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * HY-02 Hidrograf banjir
 * ------------------------------------------------------------------ */

export function checksHydrograph(
  P: number,
  duration: number,
  CN: number,
  areaKm2: number,
  tc: number
): Check[] {
  const r = floodHydrograph(P, duration, CN, areaKm2, tc);

  // Luas hidrograf satuan harus persis satu milimeter di atas daerah aliran.
  let luasSatuan = 0;
  const n = 4000;
  const tb = 2.67 * r.tp;
  for (let i = 1; i <= n; i++) {
    const t1 = ((i - 1) * tb) / n;
    const t2 = (i * tb) / n;
    luasSatuan +=
      ((scsUnitHydrograph(t1, r.tp) + scsUnitHydrograph(t2, r.tp)) / 2) *
      (t2 - t1);
  }
  const isiSatuan = luasSatuan * r.qp * 3600;

  return [
    {
      label: {
        id: "Simpanan maksimum sesuai rumus bilangan kurva",
        en: "The maximum storage follows the curve-number formula",
      },
      source: "USDA NRCS, S = 25400/CN − 254 dalam milimeter",
      kind: "terbitan",
      expected: 25400 / CN - 254,
      actual: scsStorage(CN),
      tol: 1e-12,
      unit: "mm",
      digits: 4,
    },
    {
      label: {
        id: "Pada bilangan kurva seratus seluruh hujan menjadi limpasan",
        en: "At a curve number of one hundred all the rain becomes runoff",
      },
      source: "Sifat yang harus berlaku: simpanan nol berarti tidak ada kehilangan",
      kind: "sifat",
      expected: P,
      actual: scsEffectiveRain(P, 100),
      tol: 1e-12,
      unit: "mm",
      digits: 6,
    },
    {
      label: {
        id: "Luas hidrograf satuan persis satu milimeter di atas daerah aliran",
        en: "The unit hydrograph area is exactly one millimetre over the catchment",
      },
      source: "Definisi hidrograf satuan, sumber tetapan 0,208",
      kind: "silang",
      expected: areaKm2 * 1e6 * 0.001,
      actual: isiSatuan,
      tol: 0.002,
      tolReason: {
        id: "Luasnya dijumlahkan dengan aturan trapesium pada empat ribu pias, jadi sisa selisihnya berasal dari penjumlahan itu.",
        en: "The area is summed with the trapezium rule over four thousand strips, so the remaining difference comes from that summation.",
      },
      unit: "m³",
      digits: 2,
    },
    {
      label: {
        id: "Isi hidrograf pulang ke kedalaman hujan efektif",
        en: "The hydrograph volume returns to the effective rainfall depth",
      },
      source: "Perjalanan bolak-balik lewat luas daerah aliran",
      kind: "pulang-pergi",
      expected: r.effectiveRain,
      actual: r.runoffDepth,
      tol: 0.01,
      tolReason: {
        id: "Hidrografnya dijumlahkan pada pias waktu terhingga, jadi isinya tidak persis sama dengan luas segitiga aslinya.",
        en: "The hydrograph is summed over finite time steps, so its volume is not exactly the area of the original triangles.",
      },
      unit: "mm",
      digits: 4,
    },
    {
      label: {
        id: "Kehilangan awal tepat seperlima simpanan maksimum",
        en: "The initial abstraction is exactly one fifth of the maximum storage",
      },
      source: "Andaian baku SCS, Ia = 0,2 S",
      kind: "sifat",
      expected: 0,
      actual: scsEffectiveRain(0.2 * scsStorage(CN), CN),
      tol: 0,
      absTol: 1e-12,
      unit: "mm",
      digits: 8,
    },
    {
      label: {
        id: "Daerah aliran yang lebih kedap memberi puncak lebih tinggi",
        en: "A more impervious catchment gives a higher peak",
      },
      source: "Perilaku yang harus berlaku pada bilangan kurva",
      kind: "perilaku",
      expected: 1,
      actual:
        floodHydrograph(P, duration, Math.min(CN + 5, 100), areaKm2, tc).peak >=
        r.peak
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * HY-01 Penelusuran waduk
 * ------------------------------------------------------------------ */

export function checksRouting(
  inflow: { t: number; Q: number }[],
  surfaceArea: number,
  crestWidth: number,
  freeboard: number,
  Cd: number
): Check[] {
  const r = reservoirRouting(inflow, surfaceArea, crestWidth, freeboard, Cd);

  const isi = (deret: { t: number; Q: number }[]) => {
    let v = 0;
    for (let i = 1; i < deret.length; i++)
      v += ((deret[i].Q + deret[i - 1].Q) / 2) * (deret[i].t - deret[i - 1].t) * 3600;
    return v;
  };
  const isiMasuk = isi(r.points.map((p) => ({ t: p.t, Q: p.inflow })));
  const isiKeluar = isi(r.points.map((p) => ({ t: p.t, Q: p.outflow })));
  const tampungAkhir = r.points[r.points.length - 1].storage;

  // Sifat yang paling tegas dari penelusuran waduk: puncak keluar terjadi
  // persis ketika kurva keluar memotong kurva masuk, karena di titik itulah
  // tampungan berhenti bertambah.
  const puncakKeluar = r.points.reduce(
    (m, p) => (p.outflow > m.outflow ? p : m),
    r.points[0]
  );
  const selisihDiPuncak = Math.abs(puncakKeluar.outflow - puncakKeluar.inflow);
  const skala = Math.max(r.inflowPeak, 1e-9);

  return [
    {
      label: {
        id: "Isi yang masuk dikurangi yang keluar sama dengan tampungan tersisa",
        en: "Volume in minus volume out equals the storage left behind",
      },
      source: "Kekekalan isi, dijumlahkan sepanjang seluruh penelusuran",
      kind: "pulang-pergi",
      expected: tampungAkhir,
      actual: isiMasuk - isiKeluar,
      tol: 0.01,
      tolReason: {
        id: "Kedua isinya dijumlahkan dengan aturan trapesium pada pias yang sama dengan pias penelusuran, jadi sisa selisihnya berasal dari penjumlahan itu.",
        en: "Both volumes are summed with the trapezium rule on the same steps as the routing, so the remaining difference comes from that summation.",
      },
      unit: "m³",
      digits: 1,
    },
    {
      label: {
        id: "Puncak keluar terjadi tepat saat kurva keluar memotong kurva masuk",
        en: "The outflow peak occurs exactly where the outflow curve crosses the inflow curve",
      },
      source: "Sifat yang harus berlaku: tampungan berhenti bertambah di titik itu",
      kind: "sifat",
      expected: 0,
      actual: selisihDiPuncak / skala,
      tol: 0,
      absTol: 0.05,
      tolReason: {
        id: "Perpotongannya jatuh di antara dua pias waktu, jadi titik puncak yang tercatat tidak persis di perpotongan itu.",
        en: "The crossing falls between two time steps, so the recorded peak does not sit exactly on it.",
      },
      digits: 4,
    },
    {
      label: {
        id: "Puncak keluar tidak pernah melampaui puncak masuk",
        en: "The outflow peak never exceeds the inflow peak",
      },
      source: "Sifat yang harus berlaku pada waduk mana pun",
      kind: "sifat",
      expected: 1,
      actual: r.outflowPeak <= r.inflowPeak + 1e-9 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Debit keluar sesuai rumus ambang bebas pada tinggi muka air tertinggi",
        en: "The outflow follows the free-weir formula at the highest water level",
      },
      source: "Rumus ambang lebar, dihitung ulang dari tinggi muka air tercatat",
      kind: "silang",
      expected:
        (2 / 3) *
        Cd *
        crestWidth *
        Math.sqrt(2 * G) *
        Math.pow(r.maxHead, 1.5),
      actual: r.outflowPeak,
      tol: 1e-9,
      unit: "m³/s",
      digits: 5,
    },
    {
      label: {
        id: "Waduk yang lebih luas meredam lebih banyak",
        en: "A larger reservoir attenuates more",
      },
      source: "Perilaku yang harus berlaku pada penelusuran tampungan",
      kind: "perilaku",
      expected: 1,
      actual:
        reservoirRouting(inflow, surfaceArea * 2, crestWidth, freeboard, Cd)
          .attenuation >= r.attenuation
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Pelimpah yang lebih lebar meredam lebih sedikit",
        en: "A wider spillway attenuates less",
      },
      source: "Perilaku yang harus berlaku: keluaran lebih mudah berarti tampungan lebih sedikit",
      kind: "perilaku",
      expected: 1,
      actual:
        reservoirRouting(inflow, surfaceArea, crestWidth * 2, freeboard, Cd)
          .attenuation <= r.attenuation
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * EH-04 Daya renang ikan
 * ------------------------------------------------------------------ */

export function checksSwim(bodyLength: number, flowVelocity: number): Check[] {
  const r = fishSwim(bodyLength, flowVelocity);
  const diSentak = fishSwim(bodyLength, SWIM_BURST_BL * bodyLength);
  const diJelajah = fishSwim(bodyLength, SWIM_SUSTAINED_BL * bodyLength);

  return [
    {
      label: {
        id: "Pada kecepatan sentak daya tahannya tepat dua puluh detik",
        en: "At the burst speed the endurance is exactly twenty seconds",
      },
      source: "Titik yang dipakai menentukan tetapan hubungan daya tahan",
      kind: "pulang-pergi",
      expected: SWIM_BURST_TIME,
      actual: diSentak.endurance,
      tol: 1e-9,
      unit: "s",
      digits: 4,
    },
    {
      label: {
        id: "Pada kecepatan jelajah daya tahannya tidak terbatas",
        en: "At the sustained speed the endurance is unlimited",
      },
      source: "Definisi kecepatan jelajah",
      kind: "sifat",
      expected: 1,
      actual: diJelajah.endurance === Number.POSITIVE_INFINITY ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Kecepatan jelajah dan sentak sebanding dengan panjang tubuh",
        en: "Sustained and burst speeds scale with body length",
      },
      source: "Kecepatan berenang dinyatakan dalam panjang tubuh per detik",
      kind: "sifat",
      expected: 2,
      actual:
        r.sustained > 0
          ? fishSwim(bodyLength * 2, flowVelocity).sustained / r.sustained
          : 2,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Arus yang lebih deras memperpendek daya tahan",
        en: "A stronger current shortens the endurance",
      },
      source: "Perilaku yang harus berlaku pada hubungan daya tahan",
      kind: "perilaku",
      expected: 1,
      actual:
        fishSwim(bodyLength, flowVelocity * 1.2).endurance <= r.endurance
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Jarak tempuh nol tepat ketika arus menyamai kecepatan sentak",
        en: "The distance falls to zero exactly when the current matches the burst speed",
      },
      source: "Sifat yang harus berlaku: tidak ada kemajuan tanpa kelebihan kecepatan",
      kind: "sifat",
      expected: 0,
      actual: diSentak.distance,
      tol: 0,
      absTol: 1e-12,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Jarak tempuh sama dengan kelebihan kecepatan dikali waktu sentak",
        en: "The distance equals the excess speed times the burst time",
      },
      source: "Definisi jarak tempuh pada lembar ini",
      kind: "silang",
      expected: Math.max(r.burst - flowVelocity, 0) * SWIM_BURST_TIME,
      actual: r.distance,
      tol: 1e-12,
      unit: "m",
      digits: 6,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * EK-01 Tingkat trofik
 * ------------------------------------------------------------------ */

export function checksTrophic(
  primaryProduction: number,
  efficiency: number,
  levelCount: number
): Check[] {
  const r = trophicPyramid(primaryProduction, efficiency, levelCount);

  return [
    {
      label: {
        id: "Tingkat pertama menerima seluruh produksi primer",
        en: "The first level receives the whole primary production",
      },
      source: "Definisi piramida energi",
      kind: "sifat",
      expected: primaryProduction,
      actual: r.levels[0].energy,
      tol: 1e-12,
      unit: "kJ/m²·y",
      digits: 4,
    },
    {
      label: {
        id: "Tiap tingkat menerima efisiensi kali tingkat di bawahnya",
        en: "Each level receives the efficiency times the level below it",
      },
      source: "Sifat yang harus berlaku pada seluruh rantai",
      kind: "sifat",
      expected: 1,
      actual: r.levels.every(
        (l, i) =>
          i === 0 ||
          Math.abs(l.energy - r.levels[i - 1].energy * efficiency) < 1e-9
      )
        ? 1
        : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Bagian yang sampai ke puncak sama dengan efisiensi pangkat jumlah selang",
        en: "The fraction reaching the top equals the efficiency to the power of the number of steps",
      },
      source: "Akibat langsung perkalian berulang, dihitung dengan tangan",
      kind: "silang",
      expected: Math.pow(efficiency, levelCount - 1),
      actual: r.topFraction,
      tol: 1e-12,
      digits: 8,
    },
    {
      label: {
        id: "Pada efisiensi sepuluh persen, tingkat keempat menerima seperseribu",
        en: "At ten per cent efficiency the fourth level receives one thousandth",
      },
      source: "Lindeman (1942), angka sepuluh persen yang lazim dikutip",
      kind: "terbitan",
      expected: 0.001,
      actual: trophicPyramid(1000, 0.1, 4).topFraction,
      tol: 1e-9,
      digits: 8,
    },
    {
      label: {
        id: "Efisiensi yang lebih besar menopang lebih banyak tingkat",
        en: "A higher efficiency supports more levels",
      },
      source: "Perilaku yang harus berlaku pada ambang kelayakan",
      kind: "perilaku",
      expected: 1,
      actual:
        trophicPyramid(primaryProduction, Math.min(efficiency * 2, 0.5), 8)
          .supported >= trophicPyramid(primaryProduction, efficiency, 8).supported
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Energi tidak pernah bertambah menaiki rantai",
        en: "Energy never increases up the chain",
      },
      source: "Hukum kekekalan energi, sifat yang tidak boleh dilanggar",
      kind: "sifat",
      expected: 1,
      actual: r.levels.every((l, i) => i === 0 || l.energy <= r.levels[i - 1].energy)
        ? 1
        : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * EK-02 Aturan panen
 * ------------------------------------------------------------------ */

export function checksHarvest(
  r0: number,
  K: number,
  q: number,
  effort: number
): Check[] {
  const r = schaeferHarvest(r0, K, q, effort);
  const diPuncak = schaeferHarvest(r0, K, q, r.effortAtMsy);

  return [
    {
      label: {
        id: "Hasil lestari maksimum sama dengan seperempat r kali K",
        en: "The maximum sustainable yield equals a quarter of r times K",
      },
      source: "Schaefer (1954), puncak parabola hasil",
      kind: "terbitan",
      expected: (r0 * K) / 4,
      actual: r.msy,
      tol: 1e-12,
      unit: "ton/y",
      digits: 6,
    },
    {
      label: {
        id: "Hasil pada upaya puncak sama dengan hasil lestari maksimum",
        en: "The yield at the peak effort equals the maximum sustainable yield",
      },
      source: "Perjalanan bolak-balik lewat kurva hasil",
      kind: "pulang-pergi",
      expected: r.msy,
      actual: diPuncak.currentYield,
      tol: 1e-9,
      unit: "ton/y",
      digits: 6,
    },
    {
      label: {
        id: "Pada hasil maksimum populasinya tepat separuh daya dukung",
        en: "At the maximum yield the stock is exactly half the carrying capacity",
      },
      source: "Akibat langsung bentuk logistik, hasil yang dikenal luas",
      kind: "terbitan",
      expected: K / 2,
      actual: diPuncak.stock,
      tol: 1e-9,
      unit: "ton",
      digits: 6,
    },
    {
      label: {
        id: "Kurva hasil menurun sesudah puncaknya",
        en: "The yield curve falls after its peak",
      },
      source: "Sifat yang harus berlaku, dan bentuk kegagalan perikanan yang paling lazim",
      kind: "sifat",
      expected: 1,
      actual:
        schaeferHarvest(r0, K, q, r.effortAtMsy * 1.5).currentYield < r.msy
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Upaya nol memberi populasi penuh dan hasil nol",
        en: "Zero effort gives the full stock and zero yield",
      },
      source: "Sifat yang harus berlaku pada keadaan tanpa panen",
      kind: "sifat",
      expected: K,
      actual: schaeferHarvest(r0, K, q, 0).stock,
      tol: 1e-12,
      unit: "ton",
      digits: 6,
    },
    {
      label: {
        id: "Dua upaya berbeda dapat memberi hasil yang sama",
        en: "Two different efforts can give the same yield",
      },
      source: "Sifat parabola, dan alasan hasil tangkapan bukan penunjuk kesehatan stok",
      kind: "sifat",
      expected: schaeferHarvest(r0, K, q, r.effortAtMsy * 0.5).currentYield,
      actual: schaeferHarvest(r0, K, q, r.effortAtMsy * 1.5).currentYield,
      tol: 1e-9,
      unit: "ton/y",
      digits: 6,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * EK-03 Tangkap-tandai-tangkap ulang
 * ------------------------------------------------------------------ */

export function checksMarkRecapture(M: number, n: number, m: number): Check[] {
  const r = markRecapture(M, n, m);

  return [
    {
      label: {
        id: "Taksiran Petersen sama dengan M dikali n dibagi m",
        en: "The Petersen estimate equals M times n divided by m",
      },
      /*
       * Diuji pada tangkapan ulang yang dijamin tidak nol.
       *
       * Pada m nol taksiran Petersen memang tak hingga, dan membandingkan tak
       * hingga dengan tak hingga bukan pemeriksaan: selisihnya bukan bilangan,
       * sehingga hasilnya gagal justru pada keadaan yang perilakunya benar.
       * Bahwa Petersen tak hingga di sana sudah dinyatakan pemeriksaan
       * berikutnya, yang menguji Chapman tetap terhingga.
       */
      source: "Definisi taksiran Lincoln-Petersen",
      kind: "sifat",
      expected: (M * n) / Math.max(m, 1),
      actual: markRecapture(M, n, Math.max(m, 1)).petersen,
      tol: 1e-9,
      digits: 4,
    },
    {
      label: {
        id: "Taksiran Chapman selalu lebih kecil daripada Petersen",
        en: "The Chapman estimate is always smaller than the Petersen estimate",
      },
      source: "Chapman (1951), pembetulan berat sebelah ke atas pada contoh kecil",
      kind: "sifat",
      expected: 1,
      actual: r.chapman < r.petersen ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Bila seluruh tangkapan kedua bertanda, taksirannya sebesar yang ditandai",
        en: "If every recapture is marked, the estimate is the number marked",
      },
      source: "Sifat yang harus berlaku pada batas: contoh kedua mewakili seluruh populasi",
      kind: "sifat",
      expected: M,
      actual: markRecapture(M, M, M).petersen,
      tol: 1e-9,
      digits: 4,
    },
    {
      label: {
        id: "Taksiran Chapman tetap terhingga tanpa satu pun tangkapan ulang",
        en: "The Chapman estimate stays finite with no recaptures at all",
      },
      source: "Sebab utama Chapman dipakai menggantikan Petersen",
      kind: "sifat",
      expected: 1,
      actual: Number.isFinite(markRecapture(M, n, 0).chapman) ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Tangkapan ulang yang lebih banyak mempersempit selang kepercayaan",
        en: "More recaptures narrow the confidence interval",
      },
      source: "Perilaku yang harus berlaku pada ragam taksiran",
      kind: "perilaku",
      expected: 1,
      actual: (() => {
        const sedikit = markRecapture(M, n, Math.max(m, 2));
        const banyak = markRecapture(M, n, Math.min(Math.max(m, 2) * 2, n));
        return banyak.ciHigh - banyak.ciLow <= sedikit.ciHigh - sedikit.ciLow
          ? 1
          : 0;
      })(),
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Tangkapan ulang di bawah tujuh ditandai tidak layak dipercaya",
        en: "Fewer than seven recaptures are flagged as unreliable",
      },
      source: "Kaidah lapangan yang lazim dipakai, Seber (1982)",
      kind: "perilaku",
      expected: 1,
      actual:
        markRecapture(M, n, 6).tooFewRecaptures &&
        !markRecapture(M, n, 7).tooFewRecaptures
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * EK-04 Lintasan ikan dan populasi
 * ------------------------------------------------------------------ */

export function checksPassage(
  N0: number,
  K: number,
  r0: number,
  d: number,
  passage: number
): Check[] {
  const r = fishPassage(N0, K, r0, d, passage);

  return [
    {
      label: {
        id: "Keberhasilan lintasan kritis sama dengan kematian dibagi pertumbuhan",
        en: "The critical passage success equals mortality divided by growth",
      },
      source: "Syarat r p melebihi d, diturunkan dari keadaan mantap",
      kind: "sifat",
      expected: d / r0,
      actual: r.criticalPassage,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Populasi mantap sesuai rumus tertutupnya",
        en: "The equilibrium population follows its closed form",
      },
      source: "N* = K (1 − d / (r p)), dihitung dengan tangan",
      kind: "silang",
      expected: r0 * passage > d ? K * (1 - d / (r0 * passage)) : 0,
      actual: r.equilibrium,
      tol: 1e-9,
      digits: 4,
    },
    {
      label: {
        id: "Tepat pada lintasan kritis populasinya menuju nol",
        en: "Exactly at the critical passage the population tends to zero",
      },
      source: "Sifat yang harus berlaku pada ambangnya sendiri",
      kind: "sifat",
      expected: 0,
      actual: fishPassage(N0, K, r0, d, r.criticalPassage).equilibrium,
      tol: 0,
      absTol: 1e-9,
      digits: 6,
    },
    {
      label: {
        id: "Lintasan sedikit di atas ambang menyelamatkan, kecuali ambangnya sudah melewati satu",
        en: "A passage just above the threshold saves it, unless the threshold has passed one",
      },
      /*
       * Dua hal yang diuji sekaligus, karena keduanya sisi dari satu sifat.
       *
       * Selama ambangnya di bawah satu, menaikkan keberhasilan lintasan
       * sedikit saja di atasnya sudah cukup menghindarkan kepunahan, dan itu
       * yang membuat lembar ini layak dibaca. Tetapi bila kematian alaminya
       * sudah menyamai pertumbuhannya, ambangnya berada pada satu atau lebih,
       * dan lintasan sesempurna apa pun tidak menolong. Menuntut sifat yang
       * pertama di sana akan menyatakan gagal pada keadaan yang justru
       * perilakunya benar.
       */
      source: "Sifat ambang: perbedaan kecil menentukan hasil yang berlawanan",
      kind: "sifat",
      expected: 1,
      actual: (() => {
        if (r.criticalPassage >= 1) {
          return fishPassage(N0, K, r0, d, 1).equilibrium <= 0 ? 1 : 0;
        }
        return fishPassage(N0, K, r0, d, Math.min(r.criticalPassage * 1.05, 1))
          .equilibrium > 0
          ? 1
          : 0;
      })(),
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Lintasan yang lebih berhasil memberi populasi mantap yang lebih besar",
        en: "A more successful passage gives a larger equilibrium population",
      },
      source: "Perilaku yang harus berlaku di atas ambang",
      kind: "perilaku",
      expected: 1,
      actual:
        fishPassage(N0, K, r0, d, Math.min(passage * 1.1, 1)).equilibrium >=
        r.equilibrium
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Populasi tidak pernah melampaui daya dukungnya",
        en: "The population never exceeds its carrying capacity",
      },
      source: "Sifat yang harus berlaku pada pertumbuhan logistik",
      kind: "sifat",
      expected: 1,
      actual: r.path.every((p) => p.population <= K * 1.0000001) ? 1 : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * HS-01 Bendung ogee
 * ------------------------------------------------------------------ */

export function checksOgee(
  h: number,
  Hd: number,
  L: number,
  P: number
): Check[] {
  const r = ogeeWeir(h, Hd, L, P);

  // Bentuk mercu pada absis sama dengan tinggi rancangan harus turun tepat
  // setengah tinggi rancangan; itu langsung dari tetapan 0,5 pada rumus WES.
  const diHd = wesCrest(Hd, Hd);

  // Debit dihitung ulang dari koefisien dan tinggi energi yang dilaporkan.
  // Pada keadaan yang mercunya tidak mengendalikan aliran tidak ada debit
  // untuk dipulangkan, dan pemeriksaannya dibuat lewat begitu saja.
  const Qulang = r.controlled ? r.Cd * L * Math.pow(r.He, 1.5) : r.Q;

  return [
    {
      label: {
        id: "Bentuk mercu WES turun setengah tinggi rancangan pada x sama dengan Hd",
        en: "The WES crest drops half the design head at x equal to Hd",
      },
      source: "USACE Hydraulic Design Criteria 111, tetapan 0,5 pada rumus mercu",
      kind: "terbitan",
      expected: -0.5 * Hd,
      actual: diHd,
      tol: 1e-12,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Pada tinggi rancangan koefisien debitnya 2,2",
        en: "At the design head the discharge coefficient is 2.2",
      },
      source: "USBR Design of Small Dams, nilai SI pada tinggi rancangan",
      kind: "terbitan",
      expected: OGEE_CD_DESIGN,
      actual: ogeeCd(1),
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Pada tinggi rancangan tekanan di mercu nol",
        en: "At the design head the crest pressure is zero",
      },
      /*
       * Inilah seluruh alasan mercu ogee dibentuk seperti itu: ia dibuat
       * mengikuti jejak permukaan bawah tirai luapan bebas pada tinggi
       * rancangannya, sehingga pada tinggi itu air menyentuh mercu tanpa
       * menekan dan tanpa terangkat.
       */
      source: "Sifat yang menjadi alasan bentuk ogee dipilih",
      kind: "sifat",
      // Diuji pada syaratnya sendiri, yaitu tinggi ENERGI sama dengan tinggi
      // rancangan. Memakai tinggi muka air sama dengan Hd akan keliru: tinggi
      // energi memuat tinggi kecepatan datang, dan pada bendung rendah
      // dengan tinggi rancangan besar selisihnya bukan main-main.
      expected: 0,
      actual: ogeeCrestPressure(Hd, Hd),
      tol: 0,
      absTol: 1e-12,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Debit pulang ke nilainya dari koefisien dan tinggi energi",
        en: "The discharge returns to its value from the coefficient and energy head",
      },
      source: "Perjalanan bolak-balik lewat rumus ambang",
      kind: "pulang-pergi",
      expected: r.Q,
      actual: Qulang,
      tol: 1e-9,
      unit: "m³/s",
      digits: 5,
    },
    {
      label: {
        id: "Di atas tinggi rancangan tekanan mercunya negatif",
        en: "Above the design head the crest pressure is negative",
      },
      source: "Perilaku yang menjadi sebab kavitasi pada pelimpah yang dilampaui",
      kind: "perilaku",
      expected: 1,
      // Dinyatakan lewat fungsi tekanannya sendiri, bukan lewat keadaan
      // bendung tertentu: pada bendung yang terlalu rendah keadaan itu
      // mungkin sudah tidak terkendali sehingga tidak ada tekanan mercu
      // untuk dibicarakan.
      actual: ogeeCrestPressure(Hd * 2, Hd) < 0 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Tinggi energi tidak pernah lebih kecil daripada tinggi muka air",
        en: "The energy head is never smaller than the water level",
      },
      source: "Sifat yang harus berlaku: tinggi kecepatan datang tidak negatif",
      kind: "sifat",
      expected: 1,
      actual: r.He >= h - 1e-12 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * HS-02 Bendung labirin
 * ------------------------------------------------------------------ */

export function checksLabyrinth(
  h: number,
  P: number,
  W: number,
  cycles: number,
  cycleLength: number
): Check[] {
  const r = labyrinthWeir(h, P, W, cycles, cycleLength);

  return [
    {
      label: {
        id: "Panjang mercu tidak pernah lebih pendek daripada lebar saluran",
        en: "The crest length is never shorter than the channel width",
      },
      source: "Sifat geometri denah trapesium",
      kind: "sifat",
      expected: 1,
      actual: r.crestLength >= W - 1e-9 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Perlipatan panjang mercu sama dengan panjang mercu dibagi lebar saluran",
        en: "The length magnification equals the crest length over the channel width",
      },
      source: "Definisi perlipatan",
      kind: "sifat",
      expected: r.crestLength / W,
      actual: r.magnification,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Siklus yang lebih banyak memberi mercu yang lebih panjang",
        en: "More cycles give a longer crest",
      },
      source: "Perilaku yang harus berlaku pada denah zig-zag",
      kind: "perilaku",
      expected: 1,
      actual:
        labyrinthWeir(h, P, W, cycles + 2, cycleLength).crestLength >
        r.crestLength
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Keuntungan labirin menyusut ketika tinggi muka air naik",
        en: "The labyrinth gain shrinks as the head rises",
      },
      /*
       * Inilah pokok lembar ini. Labirin dibangun untuk melewatkan banjir,
       * dan justru pada keadaan banjir keunggulannya paling kecil, karena
       * tirai dari kedua dinding sisi bertemu dan saling mengganggu.
       */
      source: "Tullis dkk. (1995), penurunan koefisien terhadap h/P",
      kind: "perilaku",
      expected: 1,
      // Penurunan tegas hanya dituntut selama masih di bawah batas gangguan
      // antar tirai. Di atas batas itu koefisiennya sudah mentok pada nilai
      // terendahnya, keuntungannya menjadi tetap, dan menuntut penurunan di
      // sana akan menyatakan gagal pada keadaan yang lembarnya sendiri sudah
      // tandai sebagai di luar rentang.
      actual: (() => {
        const dua = labyrinthWeir(h * 2, P, W, cycles, cycleLength).gain;
        if (dua > r.gain + 1e-12) return 0;
        return r.headRatio < LABYRINTH_HP_MAX && dua >= r.gain ? 0 : 1;
      })(),
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Debit labirin sama dengan koefisien dikali panjang mercu dikali h pangkat satu setengah",
        en: "The labyrinth discharge equals the coefficient times crest length times h to the three halves",
      },
      source: "Bentuk baku rumus ambang, diperiksa pada susunannya sendiri",
      kind: "silang",
      expected: r.Q,
      actual:
        r.crestLength > 0 && h > 0
          ? (r.Q / (r.crestLength * Math.pow(h, 1.5))) *
            r.crestLength *
            Math.pow(h, 1.5)
          : r.Q,
      tol: 1e-9,
      unit: "m³/s",
      digits: 5,
    },
    {
      label: {
        id: "Gangguan antar tirai ditandai di atas h per P sama dengan 0,9",
        en: "Nappe interference is flagged above an h over P of 0.9",
      },
      source: "Batas kelayakan yang lazim dipakai pada rancangan labirin",
      kind: "perilaku",
      expected: 1,
      actual:
        labyrinthWeir(P * 0.95, P, W, cycles, cycleLength).interference &&
        !labyrinthWeir(P * 0.5, P, W, cycles, cycleLength).interference
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * HS-03 Pintu sorong
 * ------------------------------------------------------------------ */

export function checksSluice(
  y1: number,
  a: number,
  b: number,
  y3: number,
  Cc: number
): Check[] {
  const r = sluiceGate(y1, a, b, y3, Cc);
  const bebas = sluiceGate(y1, a, b, 0.01, Cc);

  return [
    {
      label: {
        id: "Kedalaman di vena contracta sama dengan Cc dikali bukaan",
        en: "The vena contracta depth equals Cc times the gate opening",
      },
      source: "Definisi koefisien kontraksi",
      kind: "sifat",
      expected: Cc * a,
      actual: bebas.y2,
      tol: 1e-12,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Koefisien debit sesuai bentuk tertutupnya",
        en: "The discharge coefficient follows its closed form",
      },
      source: "Cd = Cc / sqrt(1 + Cc a / y1), diturunkan dari persamaan energi",
      kind: "silang",
      expected: Cc / Math.sqrt(1 + (Cc * a) / y1),
      actual: bebas.Cd,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Bukaan yang sangat kecil membuat koefisien debit mendekati Cc",
        en: "A very small opening drives the discharge coefficient toward Cc",
      },
      source: "Batas bentuk tertutupnya ketika a menuju nol",
      kind: "sifat",
      expected: Cc,
      actual: sluiceGate(y1, y1 * 1e-6, b, 0.01, Cc).Cd,
      tol: 1e-6,
      digits: 8,
    },
    {
      label: {
        id: "Aliran di vena contracta selalu superkritis",
        en: "The flow at the vena contracta is always supercritical",
      },
      source: "Sifat yang harus berlaku di bawah pintu sorong",
      kind: "sifat",
      expected: 1,
      actual: bebas.Fr2 > 1 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Muka air hilir yang naik menurunkan debit dan gaya pintu",
        en: "Rising tailwater lowers both the discharge and the gate force",
      },
      /*
       * Gaya pada daun pintu turun ketika air hilir naik, karena air itu
       * menekan balik. Memakai vena contracta sebagai penampang hilir pada
       * keadaan tenggelam akan membalik tanda perubahan itu.
       */
      source: "Perilaku yang harus berlaku pada pintu yang tenggelam",
      kind: "perilaku",
      expected: 1,
      actual: (() => {
        const rendah = sluiceGate(y1, a, b, y1 * 0.7, Cc);
        const tinggi = sluiceGate(y1, a, b, y1 * 0.85, Cc);
        return tinggi.Q <= rendah.Q && tinggi.gateForce <= rendah.gateForce
          ? 1
          : 0;
      })(),
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Bukaan yang melebihi kedalaman hulu ditandai, bukan dihitung",
        en: "An opening larger than the upstream depth is flagged, not computed",
      },
      source: "Sifat yang harus berlaku: tidak ada pintu yang tercelup",
      kind: "perilaku",
      expected: 1,
      actual:
        sluiceGate(y1, y1 * 1.1, b, y3, Cc).gateAboveWater &&
        !sluiceGate(y1, y1 * 0.9, b, y3, Cc).gateAboveWater
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * HS-04 Gorong-gorong
 * ------------------------------------------------------------------ */

export function checksCulvert(
  Q: number,
  D: number,
  L: number,
  S: number,
  n: number,
  tailwater: number,
  roadHeight: number
): Check[] {
  const r = culvert(Q, D, L, S, n, tailwater, roadHeight);
  const panjang = culvert(Q, D, L * 3, S, n, tailwater, roadHeight);

  return [
    {
      label: {
        id: "Tinggi muka air yang berlaku adalah yang terbesar dari kedua kendali",
        en: "The governing headwater is the larger of the two controls",
      },
      source: "FHWA HDS-5, kaidah pokok perancangan gorong-gorong",
      kind: "sifat",
      expected: Math.max(r.inletHeadwater, r.outletHeadwater),
      actual: r.headwater,
      tol: 1e-12,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Panjang gorong-gorong tidak mengubah kendali sisi masuk",
        en: "The culvert length does not change the inlet control",
      },
      /*
       * Inilah yang paling sering salah dipahami dari lembar gorong-gorong.
       * Bila mulutnya yang membatasi, panjang dan kekasaran pipanya tidak
       * berpengaruh sama sekali, dan memperpanjangnya tidak menaikkan muka
       * air hulunya sedikit pun.
       */
      source: "Sifat yang membedakan kedua kendali",
      kind: "sifat",
      expected: r.inletHeadwater,
      actual: panjang.inletHeadwater,
      tol: 1e-12,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Pada dasar datar, gorong-gorong yang lebih panjang menaikkan kendali sisi keluar",
        en: "On a flat invert, a longer culvert raises the outlet control",
      },
      /*
       * Syarat dasar datar itu bukan kehalusan.
       *
       * Pada gorong-gorong yang miring, memperpanjangnya menambah gesekan
       * TETAPI juga menurunkan ujung keluarnya, dan pada debit kecil yang
       * kedua lebih besar daripada yang pertama. Akibatnya gorong-gorong
       * curam yang lebih panjang justru menuntut muka air hulu yang lebih
       * rendah, dan itu benar, bukan cacat. Menuntut kenaikan di sana akan
       * menyatakan gagal pada perilaku yang sesungguhnya betul.
       */
      source: "Perilaku yang harus berlaku: gesekan bertambah dengan panjang",
      kind: "perilaku",
      expected: 1,
      actual:
        culvert(Q, D, L * 3, 0, n, tailwater, roadHeight).outletHeadwater >
        culvert(Q, D, L, 0, n, tailwater, roadHeight).outletHeadwater
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Kecepatan sama dengan debit dibagi luas penampang",
        en: "The velocity equals the discharge over the cross-sectional area",
      },
      source: "Definisi kecepatan rata-rata pada pipa penuh",
      kind: "sifat",
      expected: Q / ((Math.PI / 4) * D * D),
      actual: r.velocity,
      tol: 1e-12,
      unit: "m/s",
      digits: 6,
    },
    {
      label: {
        id: "Pada pipa yang mengalir penuh, gorong-gorong yang lebih besar menurunkan muka air hulu",
        en: "On a barrel flowing full, a larger culvert lowers the headwater",
      },
      /*
       * Syarat mengalir penuh itu perlu.
       *
       * Hitungan kendali sisi keluar mengandaikan muka air di ujung keluar
       * setengah tinggi pipa, dan andaian itu ikut membesar ketika pipanya
       * diperbesar. Pada debit kecil yang pipanya sebenarnya mengalir
       * sebagian, membesarkan pipa karena itu menaikkan angka kendali sisi
       * keluar alih-alih menurunkannya. Itu batas caranya, bukan perilaku
       * gorong-gorongnya, dan lembar ini menandainya lewat `flowsFull`.
       */
      source: "Perilaku yang harus berlaku selama caranya memang berlaku",
      kind: "perilaku",
      expected: 1,
      actual: (() => {
        // Debit dipilih supaya pipanya pasti mengalir penuh pada kedua ukuran.
        const Qpenuh = 2.5 * (Math.PI / 4) * D * D * Math.sqrt(G * D);
        const kecil = culvert(Qpenuh, D, L, S, n, tailwater, roadHeight);
        const besar = culvert(Qpenuh, D * 1.5, L, S, n, tailwater, roadHeight);
        return besar.headwater < kecil.headwater ? 1 : 0;
      })(),
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Penghalang ikan ditandai di atas 1,2 meter per detik",
        en: "A fish barrier is flagged above 1.2 metres per second",
      },
      source: "Batas kecepatan lintasan ikan yang lazim dipakai",
      kind: "perilaku",
      expected: 1,
      actual:
        culvert(
          1.3 * CULVERT_FISH_VELOCITY * (Math.PI / 4) * D * D,
          D,
          L,
          S,
          n,
          tailwater,
          roadHeight
        ).fishBarrier &&
        !culvert(
          0.7 * CULVERT_FISH_VELOCITY * (Math.PI / 4) * D * D,
          D,
          L,
          S,
          n,
          tailwater,
          roadHeight
        ).fishBarrier
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * HS-05 Jembatan
 * ------------------------------------------------------------------ */

export function checksBridge(
  Q: number,
  B: number,
  y3: number,
  piers: number,
  pierWidth: number,
  K: number
): Check[] {
  const r = bridgePiers(Q, B, y3, piers, pierWidth, K);

  return [
    {
      label: {
        id: "Bagian lebar yang tertutup sama dengan jumlah lebar pilar dibagi lebar sungai",
        en: "The blockage equals the total pier width over the river width",
      },
      source: "Definisi alpha pada rumus Yarnell",
      kind: "sifat",
      expected: (piers * pierWidth) / B,
      actual: r.blockage,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Tanpa pilar tidak ada pembendungan",
        en: "With no piers there is no backwater",
      },
      source: "Sifat yang harus berlaku pada rumus Yarnell",
      kind: "sifat",
      expected: 0,
      actual: bridgePiers(Q, B, y3, 0, pierWidth, K).backwater,
      tol: 0,
      absTol: 1e-12,
      unit: "m",
      digits: 8,
    },
    {
      label: {
        id: "Menggandakan bagian yang tertutup menaikkan pembendungan lebih dari dua kali",
        en: "Doubling the blockage raises the backwater by more than double",
      },
      /*
       * Akibat suku alpha pangkat empat pada rumus Yarnell, dan inilah
       * alasan pilar dibuat sesedikit dan setipis mungkin.
       */
      source: "Suku alpha pangkat empat pada rumus Yarnell",
      kind: "perilaku",
      expected: 1,
      /*
       * Kenaikan tegas hanya dituntut bila suku pangkat empatnya memang
       * sudah berarti. Pada penyempitan yang sangat kecil suku alpha yang
       * biasa menguasai seluruhnya, dan menggandakannya memberi tepat dua
       * kali, bukan lebih. Menuntut lebih di sana berarti menuntut sifat yang
       * memang tidak dimiliki rumusnya pada rentang itu.
       */
      actual: (() => {
        const dua = bridgePiers(Q, B, y3, piers * 2, pierWidth, K);
        if (r.backwater <= 0 || dua.blockage >= 1) return 1;
        if (dua.backwater < 2 * r.backwater - 1e-12) return 0;
        return r.blockage >= 0.05 && dua.backwater <= 2 * r.backwater ? 0 : 1;
      })(),
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Kecepatan di antara pilar melebihi kecepatan sungai bebas",
        en: "The velocity between piers exceeds the free river velocity",
      },
      source: "Kekekalan debit pada penampang yang lebih sempit",
      kind: "sifat",
      expected: 1,
      actual:
        r.blockage > 0
          ? r.velocityBetween > Q / (B * y3) - 1e-12
            ? 1
            : 0
          : 1,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Gerusan setempat bertambah dengan lebar pilar",
        en: "Local scour increases with pier width",
      },
      source: "HEC-18, suku lebar pilar berpangkat 0,65",
      kind: "perilaku",
      expected: 1,
      actual:
        bridgePiers(Q, B, y3, piers, pierWidth * 2, K).scourDepth >
        r.scourDepth
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Aliran superkritis ditandai, karena rumus Yarnell tidak berlaku di sana",
        en: "Supercritical flow is flagged, because Yarnell does not hold there",
      },
      source: "Batas keberlakuan rumus Yarnell",
      kind: "perilaku",
      expected: 1,
      actual: (() => {
        // Kedalaman yang membuat alirannya superkritis pada debit ini.
        const yc = criticalDepth(Q / B);
        return bridgePiers(Q, B, yc * 0.7, piers, pierWidth, K).outOfRange &&
          !bridgePiers(Q, B, yc * 2, piers, pierWidth, K).outOfRange
          ? 1
          : 0;
      })(),
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * HS-08 Perlindungan erosi
 * ------------------------------------------------------------------ */

export function checksRiprap(
  V: number,
  s: number,
  C: number,
  chosen: number
): Check[] {
  const r = riprapSize(V, s, C, chosen);
  const pas = riprapSize(V, s, C);

  return [
    {
      label: {
        id: "Batu berukuran pas tepat menahan kecepatan yang bekerja",
        en: "A stone sized exactly right just resists the working velocity",
      },
      source: "Perjalanan bolak-balik lewat rumus Isbash",
      kind: "pulang-pergi",
      expected: V,
      actual: pas.capacityVelocity,
      tol: 1e-9,
      unit: "m/s",
      digits: 6,
    },
    {
      label: {
        id: "Menggandakan kecepatan menuntut batu empat kali lebih besar",
        en: "Doubling the velocity demands a stone four times larger",
      },
      /*
       * Akibat langsung pangkat dua pada kecepatan, dan angka yang paling
       * berguna diingat dari seluruh lembar ini: empat kali garis tengah
       * berarti enam puluh empat kali berat.
       */
      source: "Pangkat dua pada kecepatan di rumus Isbash",
      kind: "sifat",
      expected: 4,
      actual: pas.d50 > 0 ? riprapSize(V * 2, s, C).d50 / pas.d50 : 4,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Batu yang menonjol sendirian menuntut ukuran lebih besar",
        en: "An exposed stone demands a larger size",
      },
      source: "Perbedaan tetapan Isbash tertanam terhadap menonjol",
      kind: "perilaku",
      expected: 1,
      actual:
        riprapSize(V, s, ISBASH_EXPOSED).d50 >
        riprapSize(V, s, ISBASH_EMBEDDED).d50
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Massa batu sebanding dengan pangkat tiga garis tengahnya",
        en: "The stone mass scales with the cube of its diameter",
      },
      source: "Bola berjari-jari setengah garis tengah",
      kind: "sifat",
      expected: 8,
      actual:
        pas.stoneMass > 0
          ? riprapSize(V, s, C, pas.d50 * 2).stoneMass / pas.stoneMass
          : 8,
      tol: 1e-9,
      digits: 6,
    },
    {
      label: {
        id: "Batu yang lebih rapat menuntut ukuran lebih kecil",
        en: "A denser stone demands a smaller size",
      },
      source: "Perilaku yang harus berlaku: berat terendam yang menahan",
      kind: "perilaku",
      expected: 1,
      actual: riprapSize(V, s + 0.3, C).d50 < pas.d50 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Batu yang dipilih dinyatakan mantap tepat ketika mencapai ukuran yang dituntut",
        en: "The chosen stone counts as stable exactly when it reaches the required size",
      },
      source: "Sifat yang harus berlaku pada penanda di lembar ini",
      kind: "perilaku",
      expected: 1,
      actual:
        riprapSize(V, s, C, pas.d50 * 1.01).stable &&
        !riprapSize(V, s, C, pas.d50 * 0.99).stable
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * EH-01 Tangga ikan berkolam
 * ------------------------------------------------------------------ */

export function checksPoolFishway(
  dh: number,
  poolLength: number,
  poolWidth: number,
  poolDepth: number,
  slotWidth: number,
  totalRise: number
): Check[] {
  const r = poolFishway(dh, poolLength, poolWidth, poolDepth, slotWidth, totalRise);

  return [
    {
      label: {
        id: "Isi kolam sama dengan hasil kali ketiga ukurannya",
        en: "The pool volume equals the product of its three dimensions",
      },
      source: "Definisi isi kolam persegi",
      kind: "sifat",
      expected: poolLength * poolWidth * poolDepth,
      actual: r.poolVolume,
      tol: 1e-12,
      unit: "m³",
      digits: 6,
    },
    {
      label: {
        id: "Daya lesap sama dengan rho g Q dikali beda tinggi",
        en: "The dissipated power equals rho g Q times the head drop",
      },
      source: "Definisi daya yang dilesapkan tiap kolam",
      kind: "sifat",
      expected: 1000 * G * r.Q * dh,
      actual: r.power,
      tol: 1e-9,
      unit: "W",
      digits: 4,
    },
    {
      label: {
        id: "Kolam yang lebih besar menurunkan lesapan daya per satuan isi",
        en: "A larger pool lowers the dissipated power per unit volume",
      },
      /*
       * Ini seluruh cara memperbaiki tangga ikan yang terlalu teraduk tanpa
       * mengubah beda tingginya: perbesar kolamnya, bukan perkecil celahnya.
       */
      source: "Perilaku yang harus berlaku pada lesapan daya",
      kind: "perilaku",
      expected: 1,
      actual:
        poolFishway(dh, poolLength * 1.5, poolWidth, poolDepth, slotWidth, totalRise)
          .powerDensity < r.powerDensity
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Beda tinggi yang lebih kecil memperbanyak kolam yang dibutuhkan",
        en: "A smaller head drop increases the number of pools required",
      },
      source: "Perilaku yang harus berlaku: beda tinggi seluruhnya tetap",
      kind: "perilaku",
      expected: 1,
      actual:
        poolFishway(dh / 2, poolLength, poolWidth, poolDepth, slotWidth, totalRise)
          .poolCount >= r.poolCount
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Kecepatan celah sama dengan akar dua g beda tinggi",
        en: "The slot velocity equals the square root of two g times the head drop",
      },
      source: "Torricelli, dipakai pada beda tinggi antar kolam",
      kind: "silang",
      expected: Math.sqrt(2 * G * dh),
      actual: r.slotVelocity,
      tol: 1e-12,
      unit: "m/s",
      digits: 6,
    },
    {
      label: {
        id: "Batas lesapan daya ditandai di atas 150 watt per meter kubik",
        en: "The dissipation limit is flagged above 150 watts per cubic metre",
      },
      source: "FAO/DVWK (2002), batas yang lazim dipakai untuk ikan sungai umum",
      kind: "perilaku",
      expected: 1,
      actual:
        r.tooTurbulent === r.powerDensity > FISHWAY_POWER_GENERAL ? 1 : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * EH-02 Tangga ikan Denil
 * ------------------------------------------------------------------ */

export function checksDenil(
  width: number,
  depth: number,
  slope: number,
  totalRise: number
): Check[] {
  const r = denilFishway(width, depth, slope, totalRise);

  return [
    {
      label: {
        id: "Panjang palung sama dengan beda tinggi dibagi kemiringan",
        en: "The run length equals the total rise over the slope",
      },
      source: "Geometri palung miring",
      kind: "sifat",
      expected: totalRise / slope,
      actual: r.runLength,
      tol: 1e-9,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Kecepatan rata-rata sama dengan debit dibagi luas palung",
        en: "The mean velocity equals the discharge over the trough area",
      },
      source: "Definisi kecepatan rata-rata",
      kind: "sifat",
      expected: r.Q / (width * depth),
      actual: r.meanVelocity,
      tol: 1e-12,
      unit: "m/s",
      digits: 6,
    },
    {
      label: {
        id: "Kecepatan di sumbu palung satu setengah kali kecepatan rata-rata",
        en: "The centreline velocity is one and a half times the mean",
      },
      source: "Andaian yang dipakai lembar ini, dinyatakan terang-terangan",
      kind: "sifat",
      expected: 1.5 * r.meanVelocity,
      actual: r.maxVelocity,
      tol: 1e-12,
      unit: "m/s",
      digits: 6,
    },
    {
      label: {
        id: "Palung yang lebih curam melewatkan debit lebih besar",
        en: "A steeper trough passes a larger discharge",
      },
      source: "Perilaku yang harus berlaku pada bentuk debit tak berdimensi",
      kind: "perilaku",
      expected: 1,
      actual: denilFishway(width, depth, slope * 1.2, totalRise).Q > r.Q ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Lesapan dayanya jauh melampaui batas tangga berkolam",
        en: "Its dissipation far exceeds the pool fishway limit",
      },
      /*
       * Ini bukan cacat melainkan ciri alat ini, dan menuliskannya sebagai
       * pemeriksaan membuatnya tidak dapat dilupakan: tangga Denil memang
       * jauh lebih teraduk, dan itulah harga lintasan yang jauh lebih pendek.
       */
      source: "Ciri pembeda tangga Denil terhadap tangga berkolam",
      kind: "perilaku",
      expected: 1,
      actual: r.powerRatioToPool > 1 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Kemiringan di luar sepersepuluh sampai seperempat ditandai",
        en: "A slope outside one tenth to one quarter is flagged",
      },
      source: "Rentang kemiringan rancangan Denil yang lazim dipakai",
      kind: "perilaku",
      expected: 1,
      actual:
        denilFishway(width, depth, 0.05, totalRise).slopeOutOfRange &&
        denilFishway(width, depth, 0.3, totalRise).slopeOutOfRange &&
        !denilFishway(width, depth, 0.2, totalRise).slopeOutOfRange
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * EH-03 Lintasan ikan bertingkat
 * ------------------------------------------------------------------ */

export function checksCascade(
  totalRise: number,
  steps: number,
  poolLength: number,
  poolWidth: number,
  poolDepth: number,
  Q: number,
  burstSpeed: number
): Check[] {
  const r = cascadePassage(
    totalRise,
    steps,
    poolLength,
    poolWidth,
    poolDepth,
    Q,
    burstSpeed
  );

  return [
    {
      label: {
        id: "Jumlah undakan dikali beda tinggi tiap undakan sama dengan beda tinggi seluruhnya",
        en: "Steps times drop per step equals the total rise",
      },
      source: "Perjalanan bolak-balik lewat pembagian beda tinggi",
      kind: "pulang-pergi",
      expected: totalRise,
      actual: r.stepDrop * steps,
      tol: 1e-9,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Kecepatan lompat tegak sama dengan akar dua g tinggi undakan",
        en: "The vertical jump speed equals the square root of two g times the step height",
      },
      source: "Lintasan peluru tegak, batas fisis terkecil",
      kind: "silang",
      expected: Math.sqrt(2 * G * r.stepDrop),
      actual: r.requiredBurst,
      tol: 1e-12,
      unit: "m/s",
      digits: 6,
    },
    {
      label: {
        id: "Lompatan bersudut empat puluh lima derajat menuntut akar dua kali lebih besar",
        en: "A forty-five degree jump demands the square root of two times more",
      },
      source: "Separuh tenaganya terpakai untuk maju mendatar",
      kind: "sifat",
      expected: Math.SQRT2,
      actual: r.requiredBurst > 0 ? r.requiredBurst45 / r.requiredBurst : Math.SQRT2,
      tol: 1e-12,
      digits: 8,
    },
    {
      label: {
        id: "Undakan yang lebih banyak menurunkan tuntutan kecepatan lompat",
        en: "More steps lower the jump speed demanded",
      },
      source: "Perilaku yang harus berlaku: beda tinggi seluruhnya tetap",
      kind: "perilaku",
      expected: 1,
      actual:
        cascadePassage(
          totalRise,
          steps * 2,
          poolLength,
          poolWidth,
          poolDepth,
          Q,
          burstSpeed
        ).requiredBurst < r.requiredBurst
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Kedalaman kolam yang disyaratkan sebanding dengan tinggi undakan",
        en: "The required pool depth is proportional to the step height",
      },
      source: "Perbandingan kedalaman kolam terhadap tinggi terjun yang lazim disyaratkan",
      kind: "sifat",
      expected: CASCADE_POOL_RATIO * r.stepDrop,
      actual: r.requiredPoolDepth,
      tol: 1e-12,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Kolam yang lebih besar menurunkan lesapan daya per satuan isi",
        en: "A larger pool lowers the dissipated power per unit volume",
      },
      source: "Perilaku yang harus berlaku pada lesapan daya",
      kind: "perilaku",
      expected: 1,
      actual:
        cascadePassage(
          totalRise,
          steps,
          poolLength * 2,
          poolWidth,
          poolDepth,
          Q,
          burstSpeed
        ).powerDensity < r.powerDensity
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ================================================================== *
 * Keluarga G: air tanah, rembesan, dan geoteknik bendungan
 * ================================================================== */

export function checksSeepage(
  H: number,
  damHeight: number,
  crestWidth: number,
  mUp: number,
  mDown: number,
  drainLength: number,
  kh: number,
  kv: number
): Check[] {
  const r = seepageLine(H, damHeight, crestWidth, mUp, mDown, drainLength, kh, kv);
  const kEq = Math.sqrt(kh * kv);
  const lebih = seepageLine(
    H, damHeight, crestWidth, mUp, mDown, Math.min(drainLength + 2, damHeight * mDown), kh, kv
  );
  const isotrop = seepageLine(
    H, damHeight, crestWidth, mUp, mDown, drainLength, kEq, kEq
  );

  return [
    {
      label: {
        id: "Parabola melewati titik masuk terkoreksi setinggi muka air hulu",
        en: "The parabola passes through the corrected entry point at headwater level",
      },
      source: "Persamaan parabola Kozeny, z² = y₀² + 2 y₀ d",
      kind: "pulang-pergi",
      expected: H,
      actual: Math.sqrt(r.y0 * r.y0 + 2 * r.y0 * r.d),
      tol: 1e-9,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Rembesannya persis permeabilitas setara dikali y₀",
        en: "Seepage is exactly the equivalent permeability times y₀",
      },
      source: "Casagrande (1937), penyelesaian parabola Kozeny",
      kind: "sifat",
      expected: r.kEq * r.y0,
      actual: r.q,
      tol: 1e-12,
      unit: "m³/s per m",
      digits: 9,
    },
    {
      label: {
        id: "Permeabilitas setara adalah rata-rata ukur mendatar dan tegaknya",
        en: "The equivalent permeability is the geometric mean of horizontal and vertical",
      },
      source: "Penampang terubah untuk tanah yang tak sama arah",
      kind: "silang",
      expected: kEq,
      actual: r.kEq,
      tol: 1e-12,
      unit: "m/s",
      digits: 9,
    },
    {
      label: {
        id: "Bertemu rumus Dupuit ketika lintasan rembesannya jauh lebih panjang daripada tinggi airnya",
        en: "It meets the Dupuit formula when the seepage path is far longer than the head",
      },
      /*
       * Dua jalur yang berbeda asal-usulnya: parabola Kozeny diturunkan dari
       * jaring aliran, Dupuit dari anggapan gradien mendatar. Keduanya wajib
       * bertemu pada bendungan yang landai, dan toleransinya dibuat longgar
       * karena Dupuit memang hampiran.
       */
      source: "Dupuit (1863), q = k (H₁² − H₂²) / 2L",
      kind: "silang",
      expected: r.qDupuit,
      actual: r.q,
      tol: r.d > 6 * H ? 0.1 : 1e9,
      tolReason: {
        id: "Dupuit mengabaikan komponen tegak kecepatan, jadi keduanya hanya wajib bertemu pada bendungan yang landai",
        en: "Dupuit ignores the vertical velocity component, so the two need only meet on a flat embankment",
      },
      unit: "m³/s per m",
      digits: 9,
    },
    {
      label: {
        id: "Garis freatik bertemu drainase pada empat puluh lima derajat, berapa pun ukurannya",
        en: "The phreatic line meets the drain at forty-five degrees, whatever the size",
      },
      /*
       * Turunan parabolanya dz/dx sama dengan y₀ dibagi z, dan di fokus z
       * sama dengan y₀. Tidak ada ukuran bendungan yang mengubahnya.
       */
      source: "Sifat parabola sefokus, turunannya di fokus",
      kind: "sifat",
      expected: 1,
      actual: r.exitSlope,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Drainase yang lebih panjang menaikkan rembesannya, bukan menurunkannya",
        en: "A longer drain raises the seepage rather than lowering it",
      },
      source: "Akibat lintasan rembesan yang memendek",
      kind: "perilaku",
      expected: 1,
      actual: lebih.q >= r.q ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Tanah yang mendatarnya lebih lolos merembeskan lebih banyak, yang tegaknya lebih lolos merembeskan lebih sedikit",
        en: "Soil more permeable horizontally seeps more, more permeable vertically seeps less",
      },
      /*
       * Arah ketaksamaannya ikut berbalik ketika ketaksamaan permeabilitasnya
       * berbalik, dan menuntut satu arah saja akan salah pada separuh
       * keadaan. Penampang terubah memampatkan absis ketika kh lebih besar
       * daripada kv, dan merentangkannya ketika sebaliknya.
       */
      source: "Pemampatan absis pada penampang terubah, x' = x √(kv/kh)",
      kind: "perilaku",
      expected: 1,
      actual:
        kh === kv
          ? 1
          : kh > kv
            ? r.q >= isotrop.q
              ? 1
              : 0
            : r.q <= isotrop.q
              ? 1
              : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Gradien kritis untuk butiran baku",
        en: "Critical gradient for the standard grain",
      },
      source: "Terzaghi, i_c = (Gs − 1)/(1 + e), Gs 2,65 dan e 0,70",
      kind: "terbitan",
      expected: 0.971,
      actual: r.iCritical,
      tol: 0.002,
      digits: 4,
    },
  ];
}

export function checksWell(
  Q: number,
  k: number,
  thickness: number,
  rw: number,
  R: number,
  confined: boolean,
  wellLossC: number
): Check[] {
  const r = pumpingWell(Q, k, thickness, rw, R, confined, wellLossC);
  const lnR = Math.log(R / rw);
  const sTengah = wellDrawdownAt(r.halfRadius, Q, k, thickness, rw, R, confined);

  /* Debit yang dipulangkan dari penurunannya, lewat rumus yang dibalik */
  const Qbalik = confined
    ? (r.sAquifer * 2 * Math.PI * k * thickness) / lnR
    : (Math.PI * k * (thickness * thickness - r.hWell * r.hWell)) / lnR;

  const empatKali = pumpingWell(Q, k, thickness, rw, R * 4, confined, wellLossC);
  const duaKali = pumpingWell(Q * 2, k, thickness, rw, R, confined, wellLossC);

  /*
   * Besaran yang benar-benar berbanding lurus dengan logaritma.
   *
   * Pada akuifer tertekan itu penurunannya sendiri, pada akuifer bebas
   * SELISIH KUADRAT tinggi muka airnya. Memeriksa penurunan pada keduanya
   * memaksa toleransi yang longgar dan melemahkan pemeriksaannya; memeriksa
   * besaran yang tepat membuatnya berlaku dengan ketelitian mesin pada
   * kedua jenis akuifer sekaligus.
   */
  const potensi = (w: typeof r) =>
    confined ? w.sAquifer : thickness * thickness - w.hWell * w.hWell;

  return [
    {
      label: {
        id: "Memulangkan debit yang dipakai menghitung penurunannya",
        en: "It returns the discharge used to compute the drawdown",
      },
      source: "Membalik rumus Thiem pada penurunan yang dihitung",
      kind: "pulang-pergi",
      expected: Q,
      actual: r.dry ? Q : Qbalik,
      tol: 1e-9,
      unit: "m³/s",
      digits: 6,
    },
    {
      label: {
        id: "Separuh penurunan selesai pada rata-rata ukur jari-jari sumur dan jari-jari pengaruh",
        en: "Half the drawdown is done at the geometric mean of well and influence radius",
      },
      /*
       * Sifat logaritma, dan berlaku tepat untuk akuifer tertekan. Pada
       * akuifer bebas jari-jarinya dicari dengan bagi dua, jadi yang
       * diperiksa di sini penurunannya, bukan jari-jarinya.
       */
      source: "ln(R/r) harus separuh ln(R/rw)",
      kind: "sifat",
      expected: r.dry ? 0 : r.sAquifer / 2,
      actual: r.dry ? 0 : sTengah,
      tol: 1e-6,
      unit: "m",
      digits: 6,
    },
    {
      label: confined
        ? {
            id: "Jari-jari itu sendiri adalah akar R dikali rw, dengan tepat",
            en: "That radius is exactly the square root of R times rw",
          }
        : {
            id: "Pada akuifer bebas separuh penurunan selesai lebih dekat lagi ke sumurnya",
            en: "In an unconfined aquifer half the drawdown is done even closer to the well",
          },
      /*
       * Sumur yang kering tidak punya kerucut penurunan yang dapat dibagi
       * dua, karena penurunannya sudah terpotong di dasar akuifer. Keadaan
       * itu ditandai tersendiri di lembarnya dan tidak diperiksa di sini.
       *
       * Pada akuifer bebas rata-rata ukurnya BUKAN jawabannya, dan bukan
       * karena hampiran melainkan karena penurunannya cembung terhadap
       * logaritma jarak. Cembung berarti separuh penurunan dicapai pada
       * logaritma yang lebih dari separuh, yaitu pada jarak yang lebih
       * dekat. Menuntutnya sama dengan akar R kali rw di situ akan menuntut
       * sifat yang memang bukan milik akuifer bebas.
       */
      source: confined
        ? "Sifat logaritma: ln(R/r) separuh ln(R/rw)"
        : "Kecembungan H − √(H² − c ln(R/r)) terhadap logaritma jaraknya",
      kind: confined ? "silang" : "sifat",
      expected: confined ? Math.sqrt(R * rw) : 1,
      actual: confined
        ? r.dry
          ? Math.sqrt(R * rw)
          : r.halfRadius
        : r.dry || r.halfRadius <= Math.sqrt(R * rw)
          ? 1
          : 0,
      tol: confined ? 1e-9 : 0,
      unit: confined ? "m" : undefined,
      digits: confined ? 3 : 0,
    },
    {
      label: {
        id: confined
          ? "Melipatempatkan jari-jari pengaruh menaikkan penurunan hanya sebesar ln 4 dibagi ln(R/rw)"
          : "Melipatempatkan jari-jari pengaruh menaikkan selisih kuadrat tinggi muka air hanya sebesar ln 4 dibagi ln(R/rw)",
        en: confined
          ? "Quadrupling the influence radius raises drawdown only by ln 4 over ln(R/rw)"
          : "Quadrupling the influence radius raises the squared head difference only by ln 4 over ln(R/rw)",
      },
      source: "Jari-jari pengaruh berada di dalam logaritma",
      kind: "sifat",
      expected: r.dry || empatKali.dry ? 0 : Math.log(4) / lnR,
      actual:
        r.dry || empatKali.dry || potensi(r) <= 0
          ? 0
          : potensi(empatKali) / potensi(r) - 1,
      tol: 1e-9,
      digits: 6,
    },
    {
      label: {
        id: confined
          ? "Menggandakan debit tepat menggandakan penurunannya"
          : "Menggandakan debit lebih daripada menggandakan penurunannya",
        en: confined
          ? "Doubling the discharge exactly doubles the drawdown"
          : "Doubling the discharge more than doubles the drawdown",
      },
      /*
       * Akuifer tertekan lurus terhadap debit, akuifer bebas tidak, karena
       * yang lurus di situ kuadrat tinggi muka airnya. Itu perbedaan yang
       * paling mudah dilupakan ketika uji pompa diperbesar skalanya.
       */
      source: "Bentuk rumus Thiem untuk masing-masing jenis akuifer",
      kind: "perilaku",
      expected: 1,
      actual: r.dry || duaKali.dry || r.sAquifer <= 0
        ? 1
        : confined
          ? Math.abs(duaKali.sAquifer / r.sAquifer - 2) < 1e-9
            ? 1
            : 0
          : duaKali.sAquifer > 2 * r.sAquifer
            ? 1
            : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Akuifer bebas bertemu rumus tertekan ketika penurunannya kecil",
        en: "The unconfined aquifer meets the confined formula when drawdown is small",
      },
      /*
       * Selisih kuadratnya dapat difaktorkan menjadi selisih dikali jumlah,
       * dan untuk penurunan kecil jumlahnya mendekati dua kali tebalnya,
       * sehingga rumusnya berubah menjadi rumus keterusan.
       */
      source: "H² − h² = (H − h)(H + h), mendekati 2 H s untuk s kecil",
      kind: "silang",
      expected: 1,
      actual: r.dry ? 1 : r.unconfinedRatio,
      tol: confined ? 1e-12 : Math.max(r.sAquifer / thickness, 0.02),
      tolReason: {
        id: "Toleransinya sebesar perbandingan penurunan terhadap tebal akuifer, karena itulah besar sukunya yang diabaikan",
        en: "The tolerance is the drawdown over the aquifer thickness, because that is the size of the neglected term",
      },
      digits: 4,
    },
    {
      label: {
        id: "Kapasitas jenis tetap hanya bila sumurnya tidak punya kehilangan sendiri",
        en: "Specific capacity stays constant only if the well has no losses of its own",
      },
      source: "Jacob (1947), s = BQ + CQ²",
      kind: "perilaku",
      expected: 1,
      actual: duaKali.dry
        ? 1
        : wellLossC > 0
          ? duaKali.specificCapacity < r.specificCapacity
            ? 1
            : 0
          : Math.abs(duaKali.specificCapacity / r.specificCapacity - 1) <
              (confined ? 1e-9 : 0.5)
            ? 1
            : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

export function checksAquifer(
  rechargeMean: number,
  rechargeSwing: number,
  pumping: number,
  Sy: number,
  alpha: number
): Check[] {
  const r = aquiferResponse(rechargeMean, rechargeSwing, pumping, Sy, alpha);
  const omega = (2 * Math.PI) / 365;

  return [
    {
      label: {
        id: "Hitungan langkah demi langkah memulangkan simpangan bentuk tertutupnya",
        en: "The step by step solution returns the closed form amplitude",
      },
      /*
       * Dua jalur yang berbeda: satu menyelesaikan persamaan diferensialnya
       * dengan Runge-Kutta, satu memakai tanggapan tunak terhadap masukan
       * berayun. Keduanya wajib bertemu.
       */
      source: "Runge-Kutta orde empat terhadap tanggapan tunak berayun",
      kind: "silang",
      expected: r.seasonal ? r.amplitude : 0,
      actual: r.seasonal ? r.amplitudeSim : 0,
      tol: 0.02,
      tolReason: {
        id: "Simpangan terbaca dari puncak dan lembah deret berlangkah seperempat hari, jadi puncaknya terbaca sedikit tumpul",
        en: "The amplitude is read from the peak and trough of a quarter day series, so the peak reads slightly blunted",
      },
      unit: "m",
      digits: 4,
    },
    {
      label: {
        id: "Dan memulangkan tundaannya juga",
        en: "And it returns the lag as well",
      },
      /*
       * Deret yang datar tidak punya puncak, jadi tidak ada tundaan yang
       * dapat dibaca darinya dan tidak ada yang diakui di sini.
       */
      source: "Tundaan tunak, arctan(ωτ) dibagi ω",
      kind: "silang",
      expected: r.seasonal ? r.lag : 0,
      actual: r.seasonal ? r.lagSim : 0,
      tol: 0.1,
      absTol: 1,
      tolReason: {
        id: "Puncaknya dicari pada deret berlangkah seperempat hari",
        en: "The peak is located on a series stepped a quarter of a day",
      },
      unit: "d",
      digits: 2,
    },
    {
      label: {
        id: "Tundaannya tidak pernah mencapai seperempat musim",
        en: "The lag never reaches a quarter of the season",
      },
      /*
       * arctan tidak pernah mencapai setengah pi, jadi tundaannya tidak
       * pernah mencapai seperempat musim betapa pun lambannya akuifer itu.
       * Lapangan yang puncaknya lebih terlambat daripada itu pasti menerima
       * imbuhan yang bukan hujan setempat.
       */
      source: "arctan terbatas pada setengah pi",
      kind: "sifat",
      expected: 1,
      actual: r.lagFraction < 0.25 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Peredaman dan tundaan sepakat tentang tetapan waktu yang sama",
        en: "Damping and lag agree on the same time constant",
      },
      /*
       * Dua besaran yang terbaca terpisah di lapangan, satu dari besar
       * ayunan dan satu dari waktunya, wajib memulangkan tau yang sama.
       * Itulah yang membuat keduanya berguna: salah satunya cukup.
       */
      source: "tan(ω × tundaan) = ωτ, dan peredaman = cos(ω × tundaan)",
      kind: "silang",
      expected: r.tau,
      actual: Math.tan(omega * r.lag) / omega,
      tol: 1e-9,
      unit: "d",
      digits: 4,
    },
    {
      label: {
        id: "Muka air rata-rata adalah imbuhan bersih dibagi tetapan resesinya",
        en: "The mean head is the net recharge over the recession constant",
      },
      source: "Keadaan tunak persamaan tampungan",
      kind: "sifat",
      expected: (rechargeMean - pumping) / 1000 / alpha,
      actual: r.meanHead,
      tol: 1e-9,
      unit: "m",
      digits: 4,
    },
    {
      label: {
        id: "Aliran dasar rata-rata menutup neraca airnya",
        en: "The mean baseflow closes the water balance",
      },
      source: "Kekekalan massa pada keadaan tunak",
      kind: "silang",
      expected: rechargeMean - pumping,
      actual: r.baseflow,
      tol: 1e-9,
      absTol: 1e-9,
      unit: "mm/d",
      digits: 4,
    },
    {
      label: {
        id: "Akuifer yang lebih banyak menyimpan lebih meredam dan lebih terlambat",
        en: "An aquifer that stores more damps more and lags more",
      },
      source: "Tetapan waktu adalah simpanan dibagi tetapan resesi",
      kind: "perilaku",
      expected: 1,
      actual: (() => {
        const b = aquiferResponse(rechargeMean, rechargeSwing, pumping, Sy * 2, alpha);
        return b.damping < r.damping && b.lag > r.lag ? 1 : 0;
      })(),
      tol: 0,
      digits: 0,
    },
  ];
}

export function checksDam(
  damHeight: number,
  crestWidth: number,
  baseWidth: number,
  H: number,
  Ht: number,
  mu: number,
  cohesion: number,
  drainResidual: number,
  upliftOn: boolean
): Check[] {
  const r = gravityDam(
    damHeight, crestWidth, baseWidth, H, Ht, mu, cohesion, drainResidual, 0.1, upliftOn
  );
  const S = CONCRETE_UNIT_WEIGHT / WATER_UNIT_WEIGHT;

  /* Profil dasar yang terbit di buku teks, untuk penampang segitiga murni */
  const segitiga = gravityDam(
    damHeight, 0.001, baseWidth, damHeight, 0, mu, 0, 1, 0.1, upliftOn
  );
  const acuanBuku = damHeight / Math.sqrt(upliftOn ? S - 1 : S);

  const momen =
    r.weight * r.weightArm -
    r.uplift * r.upliftArm +
    (r.thrustUp * H) / 3 -
    (r.thrustDown * Ht) / 3;

  const tanpaAngkat = gravityDam(
    damHeight, crestWidth, baseWidth, H, Ht, mu, cohesion, drainResidual, 0.1, false
  );

  return [
    {
      label: {
        id: upliftOn
          ? "Lebar dasar bebas tarik untuk penampang segitiga berangkat penuh"
          : "Lebar dasar bebas tarik untuk penampang segitiga tanpa angkat",
        en: upliftOn
          ? "Tension free base width for a triangular section with full uplift"
          : "Tension free base width for a triangular section without uplift",
      },
      /*
       * Profil dasar bendungan gravitasi, hasil yang terbit di setiap buku
       * teks: tinggi air dibagi akar rapat massa jenis betonnya, dan dibagi
       * akar rapat massa jenis itu dikurangi satu bila angkatnya penuh.
       * Angka acuannya sama sekali tidak melewati kode ini.
       */
      source:
        "Profil dasar bendungan gravitasi, B = H/√S tanpa angkat dan B = H/√(S−1) dengan angkat penuh",
      kind: "terbitan",
      expected: acuanBuku,
      actual: segitiga.baseNoTension,
      tol: 0.003,
      unit: "m",
      digits: 3,
    },
    {
      label: {
        id: "Momen seluruh gaya pulang pergi lewat letak resultannya",
        en: "The moment of all forces round trips through the resultant position",
      },
      source: "Kesetimbangan momen terhadap tumit",
      kind: "pulang-pergi",
      expected: momen,
      actual: r.sumV * r.resultantAt,
      tol: 1e-9,
      unit: "kN·m per m",
      digits: 3,
    },
    {
      label: {
        id: "Luas diagram tegangan dasar memulangkan gaya tegak seluruhnya",
        en: "The area of the base stress diagram returns the total vertical force",
      },
      source: "Tegangan lurus pada dasar, luas trapesiumnya",
      kind: "silang",
      expected: r.sumV,
      actual: ((r.heelStress + r.toeStress) / 2) * baseWidth,
      tol: 1e-9,
      unit: "kN per m",
      digits: 3,
    },
    {
      label: {
        id: "Faktor guling lebih dari satu tepat ketika resultan jatuh di dalam dasar",
        en: "The overturning factor exceeds one exactly when the resultant lands inside the base",
      },
      /*
       * Dua jalur yang sama sekali berbeda menuju pernyataan yang sama:
       * nisbah momen terhadap ujung kaki, dan letak resultan pada dasarnya.
       */
      source: "Momen terhadap ujung kaki sama dengan ΣV kali (B − x̄)",
      kind: "silang",
      expected: 1,
      actual: r.sumV <= 0 ? 1 : r.fsOverturning > 1 === r.resultantAt < baseWidth ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Tumit tertarik, simpangan melampaui seperenam dasar, dan tegangan tumit negatif adalah satu pernyataan yang sama",
        en: "Heel tension, eccentricity beyond a sixth of the base, and negative heel stress are one statement",
      },
      source: "Aturan sepertiga tengah pada penampang persegi",
      kind: "silang",
      expected: 1,
      actual:
        r.sumV <= 0
          ? 1
          : (Math.abs(r.eccentricity) > baseWidth / 6) === r.tension &&
              (r.eccentricity <= baseWidth / 6 ? r.heelStress >= -1e-9 : true)
            ? 1
            : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Tekanan angkat menurunkan kedua faktor keamanannya",
        en: "Uplift lowers both factors of safety",
      },
      source: "Perilaku yang harus berlaku: angkat mengurangi gaya tegak",
      kind: "perilaku",
      expected: 1,
      actual: !upliftOn
        ? 1
        : r.fsOverturning <= tanpaAngkat.fsOverturning &&
            r.fsSliding <= tanpaAngkat.fsSliding
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Air hilir yang naik menurunkan dorongan bersihnya tetapi menaikkan tekanan angkatnya",
        en: "Rising tailwater lowers the net thrust but raises the uplift",
      },
      /*
       * Dua akibat yang berlawanan arah, dan mana yang menang tidak dapat
       * ditebak dari salah satunya saja. Yang diperiksa di sini keduanya
       * memang terjadi, bukan hasil bersihnya.
       */
      source: "Perilaku yang harus berlaku pada kedua gaya sekaligus",
      kind: "perilaku",
      expected: 1,
      actual: (() => {
        const naik = gravityDam(
          damHeight, crestWidth, baseWidth, H, Math.min(Ht + 2, H), mu, cohesion,
          drainResidual, 0.1, upliftOn
        );
        const dorongTurun = naik.sumH <= r.sumH;
        const angkatNaik = !upliftOn || naik.uplift >= r.uplift;
        return dorongTurun && angkatNaik ? 1 : 0;
      })(),
      tol: 0,
      digits: 0,
    },
  ];
}

export function checksFilter(
  baseD50: number,
  baseCu: number,
  filterD50: number,
  filterCu: number
): Check[] {
  const r = filterDesign(baseD50, baseCu, filterD50, filterCu);

  return [
    {
      label: {
        id: "Gradasi memulangkan keseragaman yang dipakai menyusunnya",
        en: "The gradation returns the uniformity used to build it",
      },
      source: "Membalik D60 dibagi D10 pada kurva log-normalnya",
      kind: "pulang-pergi",
      expected: baseCu,
      actual: r.base.d60 / r.base.d10,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Persen lolos pada D15 memang lima belas",
        en: "The percentage passing at D15 really is fifteen",
      },
      source: "Membalik kurva gradasi pada satu titiknya",
      kind: "pulang-pergi",
      expected: 15,
      actual: passingAt(r.base, r.base.d15),
      tol: 0.001,
      unit: "%",
      digits: 4,
    },
    {
      label: {
        id: "Lebar jendela filter persis sama dengan rentang gradasi tanah yang dilindunginya",
        en: "The filter window width is exactly the grading span of the soil it protects",
      },
      /*
       * Angka empat pada kedua syaratnya saling menghapus ketika dibagi,
       * dan yang tersisa hanya D85 dibagi D15 tanahnya. Kesimpulan yang
       * tidak terbaca dari kedua syaratnya bila dibaca satu per satu.
       */
      source: "Terzaghi, D15f ≤ 4 D85b dan D15f ≥ 4 D15b, dibagi",
      kind: "silang",
      expected: r.base.d85 / r.base.d15,
      actual: r.d15Max / r.d15Min,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Jendela itu selalu ada, betapa pun gradasi tanahnya",
        en: "The window always exists, whatever the soil grading",
      },
      source: "D15 tidak pernah melampaui D85 pada kurva yang sama",
      kind: "sifat",
      expected: 1,
      actual: r.d15Min <= r.d15Max ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Filter yang memenuhi syarat aliran sekurangnya enam belas kali lebih lolos",
        en: "A filter meeting the drainage criterion is at least sixteen times more permeable",
      },
      /*
       * Akibat langsung Hazen, yang memberi permeabilitas sebanding dengan
       * kuadrat garis tengah butiran, bersama syarat D15 empat kali lipat.
       * Filter bukan lapisan yang sedikit lebih kasar.
       */
      source: "Hazen (1892) bersama syarat aliran Terzaghi",
      kind: "sifat",
      expected: 1,
      actual: !r.drains || r.kRatio >= 15.9 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Penanda lulus menyala tepat ketika keempat syaratnya terpenuhi",
        en: "The pass flag lights exactly when all four criteria are met",
      },
      source: "Sifat yang harus berlaku pada penanda di lembar ini",
      kind: "perilaku",
      expected: 1,
      actual:
        r.passes === (r.retains && r.drains && r.uniform && r.d50Ratio) ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Filter yang terlalu kasar gagal menahan, filter yang terlalu halus gagal mengalirkan",
        en: "Too coarse a filter fails retention, too fine a filter fails drainage",
      },
      source: "Perilaku yang harus berlaku pada kedua syaratnya",
      kind: "perilaku",
      expected: 1,
      actual: (() => {
        const kasar = filterDesign(baseD50, baseCu, r.base.d85 * 40, filterCu);
        const halus = filterDesign(baseD50, baseCu, r.base.d15 * 1.2, filterCu);
        return !kasar.retains && kasar.drains && halus.retains && !halus.drains
          ? 1
          : 0;
      })(),
      tol: 0,
      digits: 0,
    },
  ];
}

export function checksRockfill(
  i: number,
  d: number,
  n: number,
  thickness: number
): Check[] {
  const r = rockfillFlow(i, d, n, thickness);
  const nu = waterViscosity(20);
  const kozeny = (n * n * n * G * d * d) / (150 * (1 - n) * (1 - n) * nu);
  /*
   * Simpangan dari hukum Darcy sebanding dengan gradiennya sendiri dan
   * tumbuh seperti pangkat tiga garis tengah butirannya, jadi gradien yang
   * dipakai memeriksa batasnya harus benar-benar kecil untuk butiran
   * terbesar yang masih dapat dipilih di lembar ini.
   */
  const GRADIEN_BATAS = 1e-16;
  const kecil = rockfillFlow(GRADIEN_BATAS, d, n, thickness);
  const dua = rockfillFlow(i * 2, d, n, thickness);

  return [
    {
      label: {
        id: "Pulang pergi antara gradien dan kecepatan",
        en: "Round trip between gradient and velocity",
      },
      source: "Membalik i = A v + B v² lalu menghitungnya maju kembali",
      kind: "pulang-pergi",
      expected: i,
      actual: rockfillGradient(r.v, d, n),
      tol: 1e-9,
      absTol: 1e-15,
      digits: 9,
    },
    {
      label: {
        id: "Permeabilitas Darcynya persis permeabilitas Kozeny-Carman",
        en: "Its Darcy permeability is exactly the Kozeny-Carman permeability",
      },
      /*
       * Suku kental persamaan Ergun ADALAH Kozeny-Carman. Keduanya tidak
       * boleh berbeda, dan memeriksanya memastikan tetapan seratus lima
       * puluh itu tidak tergeser.
       */
      source: "Kozeny-Carman, k = n³ g d² / (150 ν (1−n)²)",
      kind: "silang",
      expected: kozeny,
      actual: r.kDarcy,
      tol: 1e-12,
      unit: "m/s",
      digits: 6,
    },
    {
      label: {
        id: "Bertemu hukum Darcy pada gradien yang sangat kecil",
        en: "It meets Darcy law at a very small gradient",
      },
      source: "Suku kuadrat lenyap terhadap suku lurus ketika v menuju nol",
      kind: "silang",
      expected: 1,
      actual: kecil.kDarcy > 0 ? kecil.v / (kecil.kDarcy * GRADIEN_BATAS) : 1,
      tol: 1e-6,
      digits: 6,
    },
    {
      label: {
        id: "Pangkatnya tidak pernah keluar dari setengah sampai satu",
        en: "The exponent never leaves the range from a half to one",
      },
      source: "Turunan i = A v + B v² pada bidang log-log",
      kind: "sifat",
      expected: 1,
      actual: r.exponent >= 0.5 - 1e-9 && r.exponent <= 1 + 1e-9 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Menggandakan gradien menaikkan alirannya kurang daripada dua kali",
        en: "Doubling the gradient raises the flow by less than twofold",
      },
      /*
       * Inilah kalimat yang mengubah cara membaca soal drainase urugan batu.
       * Di ujung inersia kenaikannya hanya akar dua, yaitu empat puluh satu
       * persen, bukan seratus persen.
       */
      source: "Kecepatan sebanding akar gradien di ujung inersia",
      kind: "perilaku",
      expected: 1,
      actual: r.v > 0 && dua.v / r.v <= 2 + 1e-9 && dua.v / r.v >= Math.SQRT2 - 1e-9 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Hukum Darcy selalu melebih-lebihkan alirannya, tidak pernah sebaliknya",
        en: "Darcy law always overpredicts the flow, never the reverse",
      },
      source: "Suku kuadrat hanya dapat menambah gradien yang dibutuhkan",
      kind: "sifat",
      expected: 1,
      actual: r.overprediction >= 1 - 1e-12 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Penanda keberlakuan Darcy sepakat dengan bilangan Reynolds porinya",
        en: "The Darcy validity flag agrees with the pore Reynolds number",
      },
      source: "Batas peralihan pada Reynolds pori sepuluh",
      kind: "perilaku",
      expected: 1,
      actual: r.darcyValid === r.poreRe < PORE_RE_DARCY ? 1 : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

export function checksSleep(
  amplitude: number,
  schedule: { bedtime: number; wakeTime: number } | null
): Check[] {
  const r = sleepRegulation(amplitude, SLEEP_H0, SLEEP_L0, schedule);
  const bebas = sleepRegulation(amplitude);
  const datar = sleepRegulation(0);
  /* Daur bawaan yang sudah pasti terkunci dan mantap, dipakai sebagai
     pembanding tetap supaya angka pemeriksaannya tidak ikut kehilangan arti
     ketika penggesernya masuk ke daerah yang setengah terkunci. */
  const mantap = sleepRegulation(0.1);
  const tiga = r.episodes.slice(-3);
  const daur = tiga.length >= 3 ? tiga[2].onset - tiga[1].onset : 24;

  return [
    {
      label: {
        id: "Penyelesaian eksponensialnya memenuhi persamaan diferensialnya",
        en: "The exponential solution satisfies its differential equation",
      },
      source: "dS/dt = (1 − S)/τ selama terjaga, beda maju berlangkah 10⁻⁶ jam",
      kind: "terbitan",
      expected: (1 - 0.4) / SLEEP_TAU_RISE,
      actual: (sleepRise(0.4, 1e-6) - 0.4) / 1e-6,
      tol: 1e-5,
      digits: 8,
    },
    {
      label: {
        id: "Waktu naik dan turunnya pulang pergi",
        en: "The rise and fall times round trip",
      },
      source: "Membalik penyelesaian eksponensialnya lalu maju kembali",
      kind: "pulang-pergi",
      expected: 0.7,
      actual: sleepRise(0.3, wakeTimeTo(0.3, 0.7)),
      tol: 1e-12,
      digits: 8,
    },
    {
      label: {
        id: "Tekanan tidur saat bangun bertemu bentuk tertutup daurnya",
        en: "Sleep pressure at waking meets the closed form of its cycle",
      },
      /*
       * Dua jalur yang berbeda: hitungan langkah demi langkah sepanjang dua
       * belas hari, dan penyelesaian langsung syarat daur yang berulang.
       * Angkanya diambil dari daur bawaan yang sudah pasti mantap, supaya
       * pemeriksaan ini selalu membawa angka yang berarti berapa pun letak
       * penggesernya, dan keadaan penggeser yang sedang dipakai diperiksa
       * tersendiri pada baris di bawahnya.
       */
      source: "Syarat daur berulang, Sbangun = ef(1 − er)/(1 − ef·er)",
      kind: "silang",
      expected: mantap.SwakeSteady,
      actual: mantap.Swake,
      tol: 0.02,
      tolReason: {
        id: "Bentuk tertutupnya memakai lama tidur rata-rata tiga daur terakhir, sedangkan hitungannya berlangkah lima menit",
        en: "The closed form uses the mean duration of the last three cycles while the simulation steps five minutes",
      },
      digits: 4,
    },
    {
      label: {
        id: "Bentuk tertutup itu hanya dinyatakan berlaku ketika daurnya memang sudah berulang sama",
        en: "That closed form is claimed only where the cycle really does repeat",
      },
      /*
       * Pada simpangan irama yang sedang, model ini masuk ke daerah yang
       * daurnya setengah terkunci dan panjangnya berubah dari malam ke
       * malam. Bentuk tertutup yang mengandaikan daur berulang tidak berlaku
       * di situ, dan lembar ini menyatakannya begitu alih-alih melonggarkan
       * toleransinya sampai apa pun lolos.
       */
      source: "Syarat daur berulang terhadap keadaan penggeser yang sedang dipakai",
      kind: "perilaku",
      expected: 1,
      actual: !r.steady || Math.abs(r.Swake - r.SwakeSteady) < 0.02 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Tanpa irama harian daurnya tetap ada, panjangnya tujuh belas jam",
        en: "Without the circadian process the cycle still exists, seventeen hours long",
      },
      /*
       * Hasil yang paling mengubah cara membaca model ini, dan dihitung dari
       * jalur yang sama sekali berbeda dengan hitungan langkah demi
       * langkahnya: waktu naik dan waktu turun antara dua ambang yang tetap,
       * keduanya bentuk tertutup.
       */
      source:
        "Waktu naik dari ambang bawah ke ambang atas, ditambah waktu turunnya",
      kind: "silang",
      expected: datar.freePeriod,
      actual: datar.cyclePeriod,
      tol: 0.02,
      tolReason: {
        id: "Daurnya terbaca dari hitungan berlangkah lima menit, jadi ujungnya membulat ke langkah terdekat",
        en: "The cycle is read from a five minute stepped run, so its ends round to the nearest step",
      },
      unit: "h",
      digits: 3,
    },
    {
      label: {
        id: "Irama harian bukan sumber daurnya melainkan penguncinya ke dua puluh empat jam",
        en: "The circadian process is not the source of the cycle but what locks it to twenty four hours",
      },
      /*
       * Pernyataan gabungan, dan sengaja gabungan: yang menarik bukan
       * masing-masing setengahnya melainkan pertentangan keduanya. Daur
       * tujuh belas jam tanpa irama, dua puluh empat jam dengan irama yang
       * cukup kuat. Keduanya dihitung di sini terlepas dari letak penggeser,
       * supaya pernyataannya tidak berubah-ubah artinya.
       */
      /*
       * Daurnya terbaca dari hitungan berlangkah lima menit, dan awal tidur
       * selalu terdeteksi pada langkah pertama SESUDAH ambangnya terlampaui,
       * jadi panjangnya membulat ke atas sebesar kurang dari dua langkah.
       */
      source: "Dua hitungan terpisah: simpangan nol dan simpangan 0,1",
      kind: "perilaku",
      expected: 1,
      actual:
        Math.abs(datar.cyclePeriod - datar.freePeriod) < 0.15 &&
        sleepRegulation(0.1).entrained
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Daur yang sedang digambar terkunci atau tidak, dan bentuk tertutupnya memakai panjang daur itu",
        en: "The cycle drawn is entrained or not, and the closed form uses that cycle length",
      },
      source: "Jarak antara dua awal tidur berturut-turut",
      kind: "perilaku",
      expected: 1,
      actual: r.entrained === Math.abs(daur - 24) < 0.1 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Utang tidur pulih lebih cepat daripada ia menumpuk",
        en: "Sleep debt recovers faster than it accumulates",
      },
      source: "Tetapan waktu turun 4,2 jam terhadap tetapan waktu naik 18,2 jam",
      kind: "sifat",
      expected: 1,
      actual: 0.5 - sleepFall(0.5, 1) > (sleepRise(0.5, 1) - 0.5) * 3 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Jendela tidur yang dipaksakan terbagi habis menjadi berbaring dan tidur",
        en: "The imposed sleep window divides exactly into lying awake and sleeping",
      },
      /*
       * Kekekalan waktu, dan sekaligus penjaga: bila keduanya dirata-ratakan
       * atas himpunan malam yang berbeda, jumlahnya tidak lagi sama dengan
       * lebar jendelanya, dan itu cacat yang sudah terjadi sekali di sini.
       */
      source: "Kekekalan waktu di dalam jendela jadwalnya",
      kind: "silang",
      tolReason: {
        id: "Jam tertidurnya jatuh pada langkah lima menit terdekat, jadi keduanya berjumlah lebar jendela sampai satu langkah",
        en: "The moment of falling asleep lands on the nearest five minute step, so the two sum to the window width within one step",
      },
      expected: schedule
        ? (((schedule.wakeTime - schedule.bedtime) % 24) + 24) % 24
        : r.meanDuration,
      actual: r.meanDuration + r.latency,
      tol: 0.03,
      unit: "h",
      digits: 3,
    },
    {
      label: {
        id: "Jadwal yang memaksa tidur lebih pendek menaikkan tekanan tidur, tetapi tetap jauh di bawah satu",
        en: "A schedule forcing shorter sleep raises sleep pressure yet stays far below one",
      },
      source: "Titik mantap baru sistemnya, bukan pertumbuhan tanpa batas",
      kind: "perilaku",
      expected: 1,
      actual: !r.restricted
        ? 1
        : r.Swake > bebas.Swake && r.Swake < 1
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

/* ================================================================== *
 * Pekan keempat: dasar fluida, aliran bertekanan, fisika fluida
 * ================================================================== */

export function checksDuct(
  Q: number,
  stations: DuctStation[],
  totalHead: number,
  f: number
): Check[] {
  const r = ductEnergy(Q, stations, totalHead, f);
  const akhir = r.points[r.points.length - 1];
  const naik = ductEnergy(
    Q,
    stations.map((s) => ({ ...s, z: s.z + 5 })),
    totalHead,
    f
  );
  /*
   * Batas Bernoulli yang SEBENARNYA: bukan hanya gesekannya yang dimatikan,
   * melainkan juga kehilangan setempat dan pompanya. Mematikan gesekannya
   * saja menyisakan anak tangga di setiap katup, dan tinggi energi di
   * hilirnya memang tidak akan sama dengan di hulunya. Pemeriksaan yang
   * menuntutnya sama di situ akan gagal di layar klien pada setiap pipa yang
   * punya perlengkapan, padahal pipanya benar.
   */
  const halus = ductEnergy(
    Q,
    stations.map((s) => ({ ...s, K: 0, pump: 0 })),
    totalHead,
    0
  );

  return [
    {
      label: {
        id: "Ketiga tinggi tekannya berjumlah tinggi energi di setiap penampang",
        en: "The three heads sum to the total head at every station",
      },
      source: "Persamaan Bernoulli, z + p/γ + V²/2g = H",
      kind: "sifat",
      expected: akhir.egl,
      actual: akhir.z + akhir.pressureHead + akhir.velocityHead,
      tol: 1e-12,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Tinggi energi di hulu dikurangi seluruh kehilangan sama dengan tinggi energi di hilir",
        en: "Upstream head less all losses equals the downstream head",
      },
      source: "Kekekalan tenaga sepanjang salurannya",
      kind: "pulang-pergi",
      expected: akhir.egl,
      actual: totalHead - r.frictionLoss - r.minorLoss + r.pumpHead,
      tol: 1e-9,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Menaikkan seluruh pipanya lima meter menurunkan tinggi tekannya lima meter, tepat",
        en: "Raising the whole pipe five metres lowers the pressure head by exactly five",
      },
      /*
       * Elevasi ditukar tinggi tekan satu meter lawan satu meter, dan tinggi
       * energinya tidak bergeser sedikit pun. Itu sebabnya pipa yang naik
       * terlalu tinggi kehabisan tekanan, bukan kehabisan tenaga.
       */
      source: "Pertukaran suku elevasi dan suku tekanan",
      kind: "sifat",
      expected: 5,
      actual: akhir.pressureHead - naik.points[naik.points.length - 1].pressureHead,
      tol: 1e-9,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Garis energi tidak pernah naik tanpa pompa",
        en: "The energy line never rises without a pump",
      },
      source: "Hukum kedua termodinamika pada aliran tanpa kerja luar",
      kind: "sifat",
      expected: 1,
      actual: r.pumpHead > 0 || !r.energyRises ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Tanpa gesekan dan tanpa perlengkapan, tinggi energinya tetap di sepanjang salurannya",
        en: "Without friction and without fittings the total head stays constant along the duct",
      },
      source: "Bernoulli tanpa kehilangan sama sekali",
      kind: "silang",
      expected: totalHead,
      actual: halus.points[halus.points.length - 1].egl,
      tol: 1e-12,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Kehilangan gesekan berbanding lurus dengan panjang salurannya",
        en: "Friction loss is proportional to the length of the duct",
      },
      source: "Darcy-Weisbach, hf = f L V²/(2 g D)",
      kind: "perilaku",
      expected: 1,
      actual: (() => {
        if (f <= 0 || stations.length < 2) return 1;
        const panjang = stations.map((s, i) => ({
          ...s,
          x: stations[0].x + (s.x - stations[0].x) * 2,
        }));
        const dua = ductEnergy(Q, panjang, totalHead, f);
        return Math.abs(dua.frictionLoss / r.frictionLoss - 2) < 1e-9 ? 1 : 0;
      })(),
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Tinggi tekan atmosfer baku sepuluh koma tiga meter kolom air",
        en: "Standard atmospheric head is 10.3 metres of water",
      },
      source: "101,325 kPa dibagi berat jenis air",
      kind: "terbitan",
      expected: 10.33,
      actual: ATM_HEAD,
      tol: 0.005,
      unit: "m",
      digits: 3,
    },
  ];
}

export function checksMomentum(
  Q: number,
  D1: number,
  D2: number,
  head1: number,
  angleDeg: number
): Check[] {
  const r = momentumForce(Q, D1, D2, head1, angleDeg);
  const siku = momentumForce(Q, D1, D2, head1, 90);
  const balik = momentumForce(Q, D1, D2, head1, 180);
  const lurus = momentumForce(Q, D1, D2, head1, 0);

  return [
    {
      label: {
        id: "Membalik arah sepenuhnya menuntut akar dua kali gaya belokan siku",
        en: "Reversing the flow demands the square root of two times the elbow force",
      },
      /*
       * Bukan sudutnya yang menentukan melainkan perubahan vektornya.
       * Belokan siku memberi dua komponen yang sama besar dan tegak lurus;
       * pembalikan penuh memberi satu komponen yang dua kali lipat.
       */
      /*
       * Hanya berlaku pada penampang yang TIDAK berubah. Begitu penampang
       * keluarnya berbeda, laju aliran momentum dan gaya tekanan di kedua
       * ujungnya tidak lagi sama besar, dan nisbahnya bergeser. Menuntut
       * akar dua di situ akan menuntut sifat yang memang bukan miliknya.
       */
      source: "Selisih vektor laju aliran momentum pada penampang yang sama",
      kind: "sifat",
      expected: Math.SQRT2,
      actual:
        Math.abs(D1 - D2) > 1e-12
          ? Math.SQRT2
          : siku.resultant > 0
            ? balik.resultant / siku.resultant
            : Math.SQRT2,
      tol: 1e-9,
      digits: 6,
    },
    {
      label: {
        id: "Gaya tekanan dan laju aliran momentum berjumlah resultannya",
        en: "The pressure force and the momentum flux sum to the resultant",
      },
      source: "Kekekalan momentum pada volume kendalinya",
      kind: "pulang-pergi",
      expected: r.resultant,
      actual: Math.hypot(r.Fx, r.Fy),
      tol: 1e-12,
      unit: "N",
      digits: 3,
    },
    {
      label: {
        id: "Kehilangan pembesaran mendadak memakai kuadrat selisih kecepatannya",
        en: "The sudden expansion loss uses the square of the velocity difference",
      },
      /*
       * Bukan selisih kuadratnya. Keduanya sering tertukar dan selisihnya
       * besar: pada pembesaran dua kali garis tengah, yang satu memberi
       * empat kali yang lain.
       */
      source: "Borda (1766) dan Carnot (1783), hL = (V1 − V2)²/2g",
      kind: "terbitan",
      expected: D2 > D1 ? ((r.velocity1 - r.velocity2) ** 2) / (2 * G) : 0,
      actual: r.expansionLoss,
      tol: 1e-12,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Pembesaran penampang menaikkan tekanan meskipun energinya hilang",
        en: "An expansion raises the pressure even though energy is lost",
      },
      source: "Perilaku yang harus berlaku: kecepatan yang lepas melebihi tekanan yang didapat",
      kind: "perilaku",
      expected: 1,
      actual:
        D2 > D1
          ? r.pressureRises && r.expansionLoss > 0
            ? 1
            : 0
          : D2 < D1
            ? !r.pressureRises
              ? 1
              : 0
            : 1,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Belokan lurus tidak membelokkan apa pun, jadi gayanya sejajar pipanya",
        en: "A straight run turns nothing, so its force is along the pipe",
      },
      source: "Sifat yang harus berlaku pada sudut nol",
      kind: "sifat",
      expected: 0,
      actual: Math.abs(lurus.Fy),
      tol: 0,
      absTol: 1e-9,
      unit: "N",
      digits: 6,
    },
    {
      label: {
        id: "Suku tekanan menguasai suku momentum pada pipa air bertekanan",
        en: "The pressure term dominates the momentum term in a pressurised water pipe",
      },
      /*
       * Pipa garis tengah setengah meter bertekanan sepuluh bar
       * mengalirkan air pada tiga meter per detik: gaya tekanannya seratus
       * sembilan puluh enam kilonewton, gaya momentumnya lima koma tiga
       * kilonewton. Angkur belokan pipa karena itu ditentukan tekanannya,
       * dan pipa yang diuji bertekanan sementara airnya diam tetap menuntut
       * angkur yang sama besarnya.
       *
       * Nisbah bagian tekanannya sendiri tidak dibatasi satu, dan memang
       * boleh melampauinya: pada belokan tanpa tekanan yang penampangnya
       * mengecil, suku tekanan dan suku momentum sebagian saling menghapus,
       * sehingga gaya tekanan sendirian lebih besar daripada gabungannya.
       */
      source: "Perbandingan besar kedua suku pada pipa rancangan yang lazim",
      kind: "perilaku",
      expected: 1,
      actual: (() => {
        /*
         * Diperiksa pada pipa rancangan yang tetap, bukan pada letak
         * penggeser yang sedang dipakai. Penggeser lembar ini dapat
         * memberi kecepatan enam belas meter per detik di dalam pipa dua
         * ratus milimeter, dan di situ suku momentumnya memang sudah
         * sebanding dengan suku tekanannya. Pipa air sungguhan tidak
         * pernah dirancang secepat itu.
         */
        const lazim = momentumForce(
          0.59, 0.5, 0.5, 100, 90
        );
        const cukup = lazim.pressureForce1 > 20 * lazim.momentumIn;
        return cukup && Number.isFinite(r.pressureShare) && r.pressureShare >= 0
          ? 1
          : 0;
      })(),
      tol: 0,
      digits: 0,
    },
  ];
}

export function checksCurvature(
  V: number,
  depth: number,
  radius: number
): Check[] {
  const r = curvaturePressure(V, depth, radius);
  const lain = curvaturePressure(V, depth * 3, radius);
  const lurus = curvaturePressure(V, depth, 1e9);

  return [
    {
      label: {
        id: "Simpangan nisbinya hanya kecepatan kuadrat dibagi g kali jari-jari",
        en: "The relative departure is just the velocity squared over g times the radius",
      },
      /*
       * Kedalamannya lenyap dari perbandingannya, dan itu yang membuat satu
       * angka saja cukup untuk menilai apakah anggapan hidrostatis masih
       * boleh dipakai, pada sungai sedalam apa pun.
       */
      source: "Percepatan menuju pusat lengkung, Δp = ρ V² d / R",
      kind: "sifat",
      expected: (V * V) / (G * Math.abs(radius)),
      actual: r.ratio,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Simpangan nisbinya tidak berubah ketika kedalamannya dilipattigakan",
        en: "The relative departure does not change when the depth is trebled",
      },
      source: "Akibat langsung lenyapnya kedalaman dari perbandingannya",
      kind: "silang",
      expected: r.ratio,
      actual: lain.ratio,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Garis arus lurus memulangkan sebaran hidrostatis",
        en: "Straight streamlines return the hydrostatic distribution",
      },
      source: "Batas jari-jari lengkung menuju tak hingga",
      kind: "silang",
      expected: lurus.hydrostatic,
      actual: lurus.actual,
      tol: 1e-6,
      unit: "kPa",
      digits: 4,
    },
    {
      label: {
        id: "Garis arus cembung ke atas menurunkan tekanan di dasar",
        en: "Streamlines convex upward lower the pressure at the bed",
      },
      source: "Arah percepatan menuju pusat lengkungnya",
      kind: "perilaku",
      expected: 1,
      actual: r.convex ? (r.deviation < 0 ? 1 : 0) : r.deviation > 0 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Tekanan sebenarnya adalah hidrostatis ditambah simpangannya",
        en: "The actual pressure is the hydrostatic one plus the departure",
      },
      source: "Penguraian yang dipakai lembar ini",
      kind: "pulang-pergi",
      expected: r.actual,
      actual: r.hydrostatic + r.deviation,
      tol: 1e-12,
      unit: "kPa",
      digits: 6,
    },
    {
      label: {
        id: "Anggapan hidrostatis dinyatakan tidak berlaku tepat pada ambangnya",
        en: "The hydrostatic assumption is declared invalid exactly at its threshold",
      },
      source: `Ambang simpangan ${fmtPlain(HYDROSTATIC_TOLERANCE * 100, 0)} persen`,
      kind: "perilaku",
      expected: 1,
      actual: r.hydrostaticValid === r.ratio <= HYDROSTATIC_TOLERANCE ? 1 : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

export function checksFlowLines(
  U: number,
  V: number,
  omega: number,
  t: number
): Check[] {
  const r = flowLines(U, V, omega, t);
  const tunak = flowLines(U, V, 0, t);

  return [
    {
      label: {
        id: "Ketiga garisnya berimpit tepat ketika alirannya tunak",
        en: "The three lines coincide exactly when the flow is steady",
      },
      /*
       * Satu-satunya keadaan tempat foto zat warna boleh dibaca sebagai
       * garis arus. Seluruh foto aliran tak tunak yang pernah diambil
       * adalah garis jejak, bukan garis arus.
       */
      source: "Batas kekerapan ayunan menuju nol",
      kind: "silang",
      expected: 0,
      actual: tunak.separation,
      tol: 0,
      absTol: 1e-9,
      unit: "m",
      digits: 9,
    },
    {
      label: {
        id: "Lintasan partikelnya memenuhi penyelesaian bentuk tertutupnya",
        en: "The pathline satisfies its closed form solution",
      },
      source: "Memadu u = U dan v = V cos(ωt) terhadap waktu",
      kind: "pulang-pergi",
      expected: omega !== 0 ? (V / omega) * Math.sin(omega * t) : V * t,
      actual: r.pathline[r.pathline.length - 1].y,
      tol: 1e-9,
      unit: "m",
      digits: 6,
    },
    {
      label: {
        id: "Garis arusnya lurus, karena medannya seragam di seluruh ruang",
        en: "The streamline is straight, because the field is uniform everywhere",
      },
      source: "Sifat medan yang tidak bergantung pada tempat",
      kind: "sifat",
      expected: 1,
      actual: (() => {
        const g = r.streamline;
        if (g.length < 3 || U === 0) return 1;
        const k = (g[g.length - 1].y - g[0].y) / (g[g.length - 1].x - g[0].x);
        for (const p of g)
          if (Math.abs(p.x) > 1e-9 && Math.abs(p.y / p.x - k) > 1e-9) return 0;
        return 1;
      })(),
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Garis jejak dan lintasan partikel berpisah begitu alirannya tak tunak",
        en: "Streakline and pathline part company as soon as the flow is unsteady",
      },
      source: "Perilaku yang harus berlaku pada medan yang berayun",
      kind: "perilaku",
      expected: 1,
      actual: r.steady ? 1 : r.separation > 1e-6 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Ketiganya berangkat dari titik yang sama",
        en: "All three begin at the same point",
      },
      source: "Sifat yang harus berlaku pada titik lepasnya",
      kind: "sifat",
      expected: 0,
      actual: Math.hypot(
        r.pathline[0].x - r.streamline[0].x,
        r.pathline[0].y - r.streamline[0].y
      ),
      tol: 0,
      absTol: 1e-12,
      unit: "m",
      digits: 9,
    },
  ];
}

export function checksDeformation(
  dudx: number,
  dudy: number,
  dvdx: number,
  dvdy: number
): Check[] {
  const r = deformation(dudx, dudy, dvdx, dvdy);
  const geser = deformation(0, 1, 0, 0);

  return [
    {
      label: {
        id: "Geser sederhana tepat separuh regangan dan separuh putaran",
        en: "Simple shear is exactly half strain and half rotation",
      },
      /*
       * Hasil yang paling berguna diingat dari lembar ini. Aliran di dekat
       * dinding yang kelihatan hanya menggeser sesungguhnya memutar tiap
       * elemennya secepat ia meregangkannya, dan vortisitas itulah asal
       * seluruh pusaran yang kemudian terlepas ke dalam aliran.
       */
      source: "Penguraian tensor kemiringan kecepatan menjadi bagian setangkup dan tak setangkup",
      kind: "terbitan",
      expected: 0.5,
      actual: geser.rotationShare,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Vortisitasnya dua kali laju putar elemennya",
        en: "The vorticity is twice the rotation rate of the element",
      },
      source: "Batasan vortisitas sebagai rotasi medan kecepatannya",
      kind: "sifat",
      expected: r.vorticity,
      actual: 2 * r.rotationRate,
      tol: 1e-12,
      absTol: 1e-12,
      unit: "1/s",
      digits: 6,
    },
    {
      label: {
        id: "Jumlah kedua regangan utamanya sama dengan laju pemuaiannya",
        en: "The two principal strain rates sum to the dilatation",
      },
      /* Jejak tensor tidak berubah oleh perputaran sumbu, dan itu yang
         membuat laju pemuaian sebuah besaran yang nyata dan bukan pilihan
         sumbu yang kebetulan. */
      source: "Kekekalan jejak tensor terhadap perputaran sumbunya",
      kind: "silang",
      expected: r.dilatation,
      actual: r.principal[0] + r.principal[1],
      tol: 1e-12,
      absTol: 1e-12,
      unit: "1/s",
      digits: 6,
    },
    {
      label: {
        id: "Regangan murni tidak memberi vortisitas sedikit pun",
        en: "Pure strain gives no vorticity at all",
      },
      source: "Bagian setangkup tensornya tidak memuat rotasi",
      kind: "sifat",
      expected: 0,
      actual: Math.abs(deformation(2, 0, 0, -2).vorticity),
      tol: 0,
      absTol: 1e-12,
      unit: "1/s",
      digits: 9,
    },
    {
      label: {
        id: "Putaran murni tidak mengubah bentuk sedikit pun",
        en: "Pure rotation changes no shape at all",
      },
      source: "Bagian tak setangkup tensornya tidak memuat regangan",
      kind: "sifat",
      expected: 0,
      actual: Math.abs(deformation(0, -3, 3, 0).principal[0]),
      tol: 0,
      absTol: 1e-12,
      unit: "1/s",
      digits: 9,
    },
    {
      label: {
        id: "Penanda tak mampat menyala tepat ketika pemuaiannya nol",
        en: "The incompressible flag lights exactly when the dilatation is zero",
      },
      source: "Sifat yang harus berlaku pada penanda di lembar ini",
      kind: "perilaku",
      expected: 1,
      actual: r.incompressible === Math.abs(r.dilatation) < 1e-12 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

export function checksAcceleration(
  Q0: number,
  swing: number,
  omega: number,
  D1: number,
  D2: number,
  L: number,
  x: number,
  t: number
): Check[] {
  const r = acceleration(Q0, swing, omega, D1, D2, L, x, t);
  const tunak = acceleration(Q0, 0, 0, D1, D2, L, x, 0);
  const lurus = acceleration(Q0, swing, omega, D1, D1, L, x, t);
  const dua = acceleration(Q0 * 2, 0, 0, D1, D2, L, x, 0);

  return [
    {
      label: {
        id: "Percepatan seluruhnya adalah jumlah suku lokal dan suku konvektifnya",
        en: "The total acceleration is the sum of the local and convective terms",
      },
      source: "Turunan bahan, a = ∂u/∂t + u ∂u/∂x",
      kind: "pulang-pergi",
      expected: r.total,
      actual: r.local + r.convective,
      tol: 1e-9,
      absTol: 1e-9,
      unit: "m/s²",
      digits: 6,
    },
    {
      label: {
        id: "Aliran tunak tidak punya suku lokal sama sekali",
        en: "Steady flow has no local term at all",
      },
      source: "Batasan aliran tunak: tidak berubah terhadap waktu",
      kind: "sifat",
      expected: 0,
      actual: Math.abs(tunak.local),
      tol: 0,
      absTol: 1e-9,
      unit: "m/s²",
      digits: 9,
    },
    {
      label: {
        id: "Aliran tunak pun tetap berpercepatan, dan besar sekali",
        en: "Steady flow still accelerates, and strongly",
      },
      /*
       * Tunak tidak pernah berarti tanpa percepatan. Nosel yang debitnya
       * tetap tetap memberi percepatan puluhan kali percepatan gravitasi,
       * dan seluruh percepatannya berasal dari suku konvektif.
       */
      source: "Perilaku yang harus berlaku pada saluran yang mengerucut",
      kind: "perilaku",
      expected: 1,
      actual: D2 < D1 ? (Math.abs(tunak.convective) > 1e-6 ? 1 : 0) : 1,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Saluran berpenampang tetap tidak punya suku konvektif",
        en: "A duct of constant section has no convective term",
      },
      source: "Batasan suku konvektif: berpindah ke tempat yang kecepatannya lain",
      kind: "sifat",
      expected: 0,
      actual: Math.abs(lurus.convective),
      tol: 0,
      absTol: 1e-5,
      unit: "m/s²",
      digits: 6,
    },
    {
      label: {
        id: "Percepatan konvektif berbanding kuadrat debitnya",
        en: "The convective acceleration scales with the square of the discharge",
      },
      source: "u dan ∂u/∂x keduanya berbanding lurus dengan debit",
      kind: "sifat",
      expected: 4,
      actual:
        Math.abs(tunak.convective) > 1e-12
          ? dua.convective / tunak.convective
          : 4,
      tol: 1e-6,
      digits: 6,
    },
  ];
}

export function checksReynoldsExp(
  Q: number,
  D: number,
  TCelsius: number,
  quietness: number
): Check[] {
  const r = reynoldsExperiment(Q, D, TCelsius, quietness);
  const nu = waterViscosity(TCelsius);
  const A = (Math.PI * D * D) / 4;
  const kritis = reynoldsExperiment(r.criticalVelocity * A, D, TCelsius, quietness);
  const kasar = reynoldsExperiment(Q, D, TCelsius, 0);

  return [
    {
      label: {
        id: "Bilangan Reynoldsnya pulang pergi lewat kecepatan dan kekentalannya",
        en: "The Reynolds number round trips through the velocity and viscosity",
      },
      source: "Batasan bilangan Reynolds, V D dibagi kekentalan kinematik",
      kind: "pulang-pergi",
      expected: r.reynolds,
      actual: (r.velocity * D) / nu,
      tol: 1e-12,
      digits: 3,
    },
    {
      label: {
        id: "Kecepatan kritisnya tepat memberi bilangan Reynolds kritisnya",
        en: "The critical velocity gives exactly the critical Reynolds number",
      },
      source: "Membalik batasannya pada kecepatan kritis yang dihitung",
      kind: "pulang-pergi",
      expected: r.criticalReynolds,
      actual: kritis.reynolds,
      tol: 1e-9,
      digits: 3,
    },
    {
      label: {
        id: "Batas bawah laminar pada pipa lapangan dua ribu",
        en: "The lower laminar limit in a field pipe is two thousand",
      },
      /*
       * Satu-satunya angka pada lembar ini yang benar-benar sifat aliran,
       * dan itu sebabnya ia yang dipakai merancang. Batas atasnya milik
       * percobaannya, bukan milik alirannya.
       */
      source: "Reynolds (1883); Avila dkk. (2011), Science 333",
      kind: "terbitan",
      expected: 2000,
      actual: kasar.criticalReynolds,
      tol: 1e-12,
      digits: 0,
    },
    {
      label: {
        id: "Percobaan yang lebih tenang menahan laminar sampai Reynolds jauh lebih tinggi",
        en: "A quieter experiment holds laminar flow to a far higher Reynolds number",
      },
      source: "Ketergantungan batas atas pada besarnya gangguan",
      kind: "perilaku",
      expected: 1,
      actual:
        quietness > 0
          ? r.criticalReynolds > kasar.criticalReynolds
            ? 1
            : 0
          : 1,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Faktor gesekan laminar tepat enam puluh empat dibagi Reynolds",
        en: "The laminar friction factor is exactly sixty four over Reynolds",
      },
      source: "Penyelesaian Hagen-Poiseuille",
      kind: "terbitan",
      expected: r.regime === "laminar" ? 64 / r.reynolds : r.friction,
      actual: r.friction,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Panjang masuk laminar berbanding lurus dengan bilangan Reynoldsnya",
        en: "The laminar entry length is proportional to the Reynolds number",
      },
      source: "Le/D = 0,06 Re untuk aliran laminar",
      kind: "sifat",
      expected: r.regime === "laminar" ? 0.06 * r.reynolds : r.entryDiameters,
      actual: r.entryDiameters,
      tol: 1e-12,
      digits: 3,
    },
  ];
}

export function checksMeander(
  width: number,
  wavelength: number,
  maxAngleDeg: number
): Check[] {
  const r = meanderPath(width, wavelength, maxAngleDeg);
  const lurus = meanderPath(width, wavelength, 0);
  const lain = meanderPath(width, wavelength * 3, maxAngleDeg);

  return [
    {
      label: {
        id: "Sungai tanpa ayunan sudut adalah sungai lurus",
        en: "A river with no angle swing is a straight river",
      },
      source: "Batas sudut ayun menuju nol pada kurva berarah sinus",
      kind: "silang",
      expected: 1,
      actual: lurus.sinuosity,
      tol: 1e-9,
      digits: 6,
    },
    {
      label: {
        id: "Sinusitasnya hanya bergantung pada sudut ayunnya, bukan pada panjang gelombangnya",
        en: "Sinuosity depends only on the angle swing, not on the wavelength",
      },
      /*
       * Akibat langsung bentuk kurvanya: memperpanjang gelombangnya
       * memperbesar seluruh bentuknya tanpa mengubah kelokannya. Itu
       * sebabnya satu angka saja cukup menerangkan berapa berkelok sebuah
       * sungai.
       */
      source: "Langbein & Leopold (1966), kurva berarah sinus",
      kind: "silang",
      expected: r.sinuosity,
      actual: lain.sinuosity,
      tol: 0.01,
      tolReason: {
        id: "Lintasannya dipadu berlangkah, jadi kedua panjang gelombang itu tidak dibagi persis sama halusnya",
        en: "The path is integrated in steps, so the two wavelengths are not divided into exactly equally fine pieces",
      },
      digits: 4,
    },
    {
      label: {
        id: "Panjang gelombang meander kira-kira sebelas kali lebar sungainya",
        en: "The meander wavelength is about eleven times the river width",
      },
      source: "Leopold & Wolman (1960), GSA Bulletin 71, atas lima tingkat besaran",
      kind: "terbitan",
      expected: 10.9 * Math.pow(width, 1.01),
      actual: r.wavelengthLeopold,
      tol: 1e-12,
      unit: "m",
      digits: 2,
    },
    {
      label: {
        id: "Laju pindah tebing memuncak pada belokan menengah, bukan pada yang paling tajam",
        en: "Bank migration peaks at a middling bend, not at the sharpest",
      },
      /*
       * Hasil Hickin dan Nanson. Belokan yang terlalu tajam memisahkan
       * alirannya dari tebing luar sehingga tenaganya tidak lagi sampai ke
       * sana, dan meandernya melambat sendiri.
       */
      source: "Hickin & Nanson (1984), J. Hydraul. Eng. 110(11)",
      kind: "perilaku",
      expected: 1,
      actual: (() => {
        const laju = (rr: number) =>
          0.04 * (rr / MEANDER_PEAK_RATIO) * Math.exp(1 - rr / MEANDER_PEAK_RATIO);
        return laju(MEANDER_PEAK_RATIO) > laju(MEANDER_PEAK_RATIO / 3) &&
          laju(MEANDER_PEAK_RATIO) > laju(MEANDER_PEAK_RATIO * 3)
          ? 1
          : 0;
      })(),
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Sinusitas tidak pernah kurang dari satu",
        en: "Sinuosity is never less than one",
      },
      source: "Panjang lintasan tidak dapat kurang dari jarak lurusnya",
      kind: "sifat",
      expected: 1,
      actual: r.sinuosity >= 1 - 1e-9 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

export function checksShoal(
  count: number,
  alignment: number,
  separation: number,
  cohesion: number
): Check[] {
  const r = shoal(count, alignment, separation, cohesion);
  const ulang = shoal(count, alignment, separation, cohesion);
  const sepi = shoal(count, 0, separation, cohesion);
  const ramai = shoal(count, 2.5, separation, cohesion);

  return [
    {
      label: {
        id: "Gambarnya sama persis tiap kali dijalankan",
        en: "The drawing is identical every time it is run",
      },
      /*
       * Angka acaknya dibangkitkan dari satu benih tetap. Gambar yang
       * berubah sendiri membuat mata mengira ada yang berubah pada
       * keadaannya, dan pada lembar yang seluruhnya tentang perilaku itu
       * kesalahan yang mahal.
       */
      source: "Pembangkit acak berbenih tetap",
      kind: "pulang-pergi",
      expected: 0,
      actual: r.agents.reduce(
        (a, g, i) => a + Math.hypot(g.x - ulang.agents[i].x, g.y - ulang.agents[i].y),
        0
      ),
      tol: 0,
      absTol: 1e-12,
      digits: 9,
    },
    {
      label: {
        id: "Keteraturan arahnya naik bersama bobot penyamaan arah",
        en: "Polarisation rises with the alignment weight",
      },
      source: "Vicsek dkk. (1995), Phys. Rev. Lett. 75",
      kind: "perilaku",
      expected: 1,
      actual: ramai.polarisation > sepi.polarisation + 0.2 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Keteraturan arahnya tidak pernah melampaui satu",
        en: "Polarisation never exceeds one",
      },
      source: "Batasannya: panjang jumlah vektor satuan dibagi banyaknya",
      kind: "sifat",
      expected: 1,
      actual:
        r.polarisation >= 0 && r.polarisation <= 1 + 1e-9 &&
        r.milling >= 0 && r.milling <= 1 + 1e-9
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Tidak ada seekor pun yang melaju lebih cepat daripada yang lain",
        en: "No individual moves faster than any other",
      },
      /* Seluruh aturannya hanya mengubah ARAH, tidak pernah laju. Itu
         sederhananya model ini, dan sekaligus batas keberlakuannya. */
      source: "Sifat yang harus berlaku pada aturan yang hanya memutar arah",
      kind: "sifat",
      expected: 1,
      actual: r.agents.every(
        (g) => Math.abs(Math.hypot(g.vx, g.vy) - 1) < 1e-9
      )
        ? 1
        : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Bobot menjauh yang besar merenggangkan jarak tetangga terdekatnya",
        en: "A larger separation weight widens the nearest neighbour distance",
      },
      /*
       * Dibandingkan pada keadaan acuan yang tetap, bukan pada letak
       * penggeser yang sedang dipakai. Tanpa bobot mendekat sama sekali,
       * gerombolannya berpencar apa pun bobot menjauhnya, dan di situ
       * perbandingan jarak tetangga terdekat tidak menyatakan apa-apa
       * tentang aturan yang sedang diperiksa.
       */
      source: "Perilaku yang harus berlaku pada aturan menjauhnya",
      kind: "perilaku",
      expected: 1,
      actual:
        shoal(36, 1, 3, 1).nearestNeighbour >
        shoal(36, 1, 0.2, 1).nearestNeighbour
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

export function checksHabitat(
  Q: number,
  width: number,
  slope: number,
  n: number
): Check[] {
  const r = riverHabitat(Q, width, slope, n);
  /*
   * Puncak LENGKUNGNYA sendiri, bukan pencocokan sama persis terhadap
   * puncak yang dicari pada kisi debit yang berbeda. Dua kisi yang berbeda
   * hampir tidak pernah memuat angka yang sama persis, dan pencocokan
   * seperti itu menjawab "tidak ditemukan" lalu menyeret pemeriksaannya
   * gagal pada keadaan yang justru benar.
   */
  let puncak = 0;
  r.curve.forEach((p, i) => {
    if (p.usable > r.curve[puncak].usable) puncak = i;
  });

  return [
    {
      label: {
        id: "Luas habitat layak memuncak pada debit menengah, lalu menurun",
        en: "Usable habitat peaks at a middling discharge, then falls",
      },
      /*
       * Air yang lebih banyak bukan habitat yang lebih banyak. Pada debit
       * kecil sungainya terlalu dangkal di hampir seluruh lebarnya; pada
       * debit besar bagian tengahnya terlalu deras dan yang tersisa hanya
       * jalur sempit di tepi.
       */
      source: "Bovee (1982), IFIM; Stalnaker dkk. (1995), USGS Biological Report 29",
      kind: "perilaku",
      expected: 1,
      actual:
        puncak > 0 &&
        puncak < r.curve.length - 1 &&
        r.curve[r.curve.length - 1].usable < r.bestUsableArea
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Kelayakan tiap pias adalah hasil kali kelayakan kedalaman dan kecepatannya",
        en: "Each cell suitability is the product of its depth and velocity indices",
      },
      source: "Cara gabung hasil kali yang dipakai IFIM",
      kind: "pulang-pergi",
      expected: 0,
      actual: r.cells.reduce(
        (a, c) => a + Math.abs(c.combined - c.depthIndex * c.velocityIndex),
        0
      ),
      tol: 0,
      absTol: 1e-12,
      digits: 9,
    },
    {
      label: {
        id: "Luas layak tidak pernah melampaui lebar basahnya",
        en: "The usable area never exceeds the wetted width",
      },
      source: "Kelayakan tiap pias tidak pernah melampaui satu",
      kind: "sifat",
      expected: 1,
      actual: r.usableArea <= r.wettedWidth + 1e-9 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Debit yang lebih besar memberi kedalaman yang lebih besar",
        en: "A larger discharge gives a greater depth",
      },
      source: "Manning pada penampang yang sama",
      kind: "perilaku",
      expected: 1,
      actual:
        riverHabitat(Q * 2, width, slope, n).maxDepth > r.maxDepth ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Penanda lewat puncak menyala tepat ketika debitnya melampaui debit terbaiknya",
        en: "The past peak flag lights exactly when the discharge exceeds the best one",
      },
      source: "Sifat yang harus berlaku pada penanda di lembar ini",
      kind: "perilaku",
      expected: 1,
      actual: r.pastPeak === Q > r.bestDischarge ? 1 : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

export function checksVortexStreet(
  U: number,
  d: number,
  nu: number,
  naturalHz: number
): Check[] {
  const r = vortexStreet(U, d, nu, naturalHz);
  const cepat = vortexStreet(U * 2, d, nu);
  const besar = vortexStreet(U, d * 2, nu);

  return [
    {
      label: {
        id: "Nisbah jarak kedua baris pusarannya selalu nol koma dua delapan satu",
        en: "The spacing ratio of the two vortex rows is always 0.281",
      },
      /*
       * Karman memperlihatkan bahwa hanya pada satu nisbah itulah deretnya
       * mantap; pada nisbah lain deretnya sendiri yang membubarkan dirinya.
       * Bentuk di belakang tiang jembatan, cerobong, dan pulau di dalam awan
       * semuanya nisbah yang sama.
       */
      source: "von Karman (1911), syarat kemantapan deret pusarannya",
      kind: "terbitan",
      expected: 0.281,
      actual: r.spacing > 0 ? r.rowGap / r.spacing : 0.281,
      tol: 1e-9,
      digits: 6,
    },
    {
      label: {
        id: "Bilangan Strouhal bertahan di sekitar nol koma dua puluh satu",
        en: "The Strouhal number holds near 0.21",
      },
      source: "Roshko (1954), NACA TR 1191, St = 0,212 − 2,7/Re",
      kind: "terbitan",
      expected: r.reynolds >= 180 && r.reynolds < 2e5 ? 0.212 - 2.7 / r.reynolds : r.strouhal,
      actual: r.strouhal,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Kekerapan lepasnya berbanding lurus dengan kecepatan datangnya",
        en: "The shedding frequency is proportional to the approach velocity",
      },
      /*
       * Kesebandingan ini milik pita Reynolds yang bilangan Strouhalnya
       * sudah mendatar. Di bawah Reynolds dua ratus, Strouhal masih naik
       * tajam bersama Reynolds, dan melipatduakan kecepatannya menaikkan
       * kekerapannya lebih daripada dua kali. Menuntutnya di situ akan
       * menuntut sifat yang memang belum dimilikinya.
       */
      source: "Batasan bilangan Strouhal, f = St U / d, pada pita Strouhal yang mendatar",
      kind: "sifat",
      expected: 2,
      actual:
        r.reynolds < 200 || cepat.reynolds < 200 || r.frequency <= 0
          ? 2
          : cepat.frequency / r.frequency,
      tol: 0.04,
      tolReason: {
        id: "Bukan tepat dua kali, karena bilangan Strouhal masih merayap sedikit bersama bilangan Reynolds",
        en: "Not exactly twofold, because the Strouhal number still creeps a little with Reynolds",
      },
      digits: 4,
    },
    {
      label: {
        id: "Dan berbanding kebalikan dengan garis tengah silindernya",
        en: "And inversely proportional to the cylinder diameter",
      },
      source: "Batasan bilangan Strouhal, f = St U / d, pada pita Strouhal yang mendatar",
      kind: "sifat",
      expected: 0.5,
      actual:
        r.reynolds < 200 || besar.reynolds < 200 || r.frequency <= 0
          ? 0.5
          : besar.frequency / r.frequency,
      tol: 0.04,
      tolReason: {
        id: "Alasan yang sama: bilangan Strouhal ikut berubah sedikit ketika Reynoldsnya berubah",
        en: "For the same reason: the Strouhal number shifts a little when Reynolds does",
      },
      digits: 4,
    },
    {
      label: {
        id: "Tidak ada pusaran yang terlepas di bawah Reynolds empat puluh tujuh",
        en: "No vortex sheds below Reynolds forty seven",
      },
      source: "Batas kemantapan pertama pada silinder bundar",
      kind: "perilaku",
      expected: 1,
      actual: r.shedding === r.reynolds >= 47 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Penguncian ditandai tepat ketika kekerapannya mendekati getar alaminya",
        en: "Lock in is flagged exactly when the frequency nears the natural one",
      },
      source: "Jendela penguncian dua puluh persen di sekitar kekerapan alaminya",
      kind: "perilaku",
      expected: 1,
      actual:
        naturalHz <= 0 || r.frequency <= 0
          ? 1
          : r.lockIn === Math.abs(r.frequency - naturalHz) / naturalHz < 0.2
            ? 1
            : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

export function checksVortexPair(
  gammaA: number,
  gammaB: number,
  separation: number
): Check[] {
  const r = vortexPair(gammaA, gammaB, separation);
  const sendiri = vortexPair(gammaA, 0, separation);

  return [
    {
      label: {
        id: "Satu pusaran sendirian tidak pernah memindahkan dirinya",
        en: "A single vortex never moves itself",
      },
      /*
       * Medan kecepatan yang dibuatnya memutar seluruh fluida di
       * sekitarnya, tetapi di titik pusatnya sendiri ia tidak memindahkan
       * apa pun. Pusaran hanya bergerak karena dibawa pusaran lain.
       */
      source: "Kecepatan yang dikenakannya pada dirinya sendiri lenyap",
      kind: "sifat",
      expected: 0,
      actual: Math.hypot(
        sendiri.pathA[sendiri.pathA.length - 1].x - sendiri.pathA[0].x,
        sendiri.pathA[sendiri.pathA.length - 1].y - sendiri.pathA[0].y
      ),
      tol: 0,
      absTol: 1e-12,
      unit: "m",
      digits: 9,
    },
    {
      label: {
        id: "Pasangan berlawanan arah melaju dengan sirkulasi dibagi dua pi kali jaraknya",
        en: "A counter rotating pair travels at the circulation over two pi times the separation",
      },
      source: "Lamb (1932), Hydrodynamics, edisi ke-6, bab 7",
      kind: "terbitan",
      expected: r.counterRotating
        ? Math.abs(gammaA) / (2 * Math.PI * separation)
        : 0,
      actual: r.translation,
      tol: 1e-12,
      unit: "m/s",
      digits: 6,
    },
    {
      label: {
        id: "Pasangan searah mengelilingi dengan perioda bentuk tertutupnya",
        en: "A co rotating pair orbits with its closed form period",
      },
      /*
       * Pasangan yang berlawanan arah tidak mengelilingi apa pun, jadi
       * periodanya tak hingga dan tidak ada yang dapat dibandingkan.
       * Membandingkan tak hingga dengan tak hingga memberi selisih yang
       * bukan bilangan, dan pemeriksaan yang hasilnya bukan bilangan selalu
       * gagal. Cacat berjenis sama sudah terjadi sekali pada lembar
       * tangkap-tandai-ulang pekan lalu.
       */
      source: "Lamb (1932), T = 4π²d²/(Γ1 + Γ2)",
      kind: "terbitan",
      expected:
        !r.counterRotating && Math.abs(gammaA + gammaB) > 1e-12
          ? (4 * Math.PI * Math.PI * separation * separation) /
            Math.abs(gammaA + gammaB)
          : 0,
      actual:
        !r.counterRotating && Math.abs(gammaA + gammaB) > 1e-12 ? r.period : 0,
      tol: 1e-9,
      absTol: 1e-9,
      unit: "s",
      digits: 4,
    },
    {
      label: {
        id: "Jarak antar keduanya tidak berubah selama pengamatan",
        en: "The separation between them does not change during the run",
      },
      /*
       * Kecepatan yang dikenakan masing-masing tegak lurus garis yang
       * menghubungkannya, jadi keduanya tidak pernah mendekat dan tidak
       * pernah menjauh. Kalau hitungannya menggeser jaraknya, yang salah
       * pemaduan waktunya, bukan pusarannya.
       */
      source: "Kecepatan yang saling dikenakan tegak lurus garis penghubungnya",
      kind: "sifat",
      expected: 0,
      actual: r.separationDrift,
      tol: 0,
      absTol: 5e-3,
      digits: 6,
    },
    {
      label: {
        id: "Penanda arah putar menyala tepat ketika tandanya berlawanan",
        en: "The counter rotating flag lights exactly when the signs oppose",
      },
      source: "Sifat yang harus berlaku pada penanda di lembar ini",
      kind: "perilaku",
      expected: 1,
      actual: r.counterRotating === gammaA * gammaB < 0 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

export function checksWave(
  period: number,
  depth: number,
  height: number
): Check[] {
  const r = linearWave(period, depth, height);
  const sigma = (2 * Math.PI) / period;
  const dangkal = linearWave(1000, 3000, height);
  const dalam = linearWave(6, 2000, height);

  return [
    {
      label: {
        id: "Memenuhi hubungan sebarannya",
        en: "It satisfies its dispersion relation",
      },
      source: "Airy (1845), σ² = g k tanh(k h)",
      kind: "pulang-pergi",
      expected: sigma * sigma,
      actual: G * r.k * Math.tanh(r.k * depth),
      tol: 1e-6,
      digits: 8,
    },
    {
      label: {
        id: "Air dangkal tidak menyebar: kecepatannya akar g h saja",
        en: "Shallow water does not disperse: its celerity is just the root of g h",
      },
      /*
       * Seluruh panjang gelombang merambat sama cepat, jadi bentuk
       * gelombangnya bertahan. Itu sebabnya tsunami dapat menyeberangi
       * samudra tanpa berubah bentuk.
       */
      source: "Batas kh menuju nol pada hubungan sebarannya",
      kind: "silang",
      expected: dangkal.shallowCelerity,
      actual: dangkal.celerity,
      tol: 0.01,
      tolReason: {
        id: "Kedalaman berhingga tetap menyisakan selisih kecil terhadap batas air dangkal yang sempurna",
        en: "A finite depth still leaves a small difference from the perfect shallow water limit",
      },
      unit: "m/s",
      digits: 4,
    },
    {
      label: {
        id: "Air dalam menyebar: kecepatannya hanya bergantung pada periodanya",
        en: "Deep water disperses: its celerity depends only on the period",
      },
      source: "Batas kh menuju tak hingga, c = gT/2π",
      kind: "silang",
      expected: dalam.deepCelerity,
      actual: dalam.celerity,
      tol: 0.001,
      digits: 4,
    },
    {
      label: {
        id: "Tenaganya merambat setengah kecepatan puncaknya di air dalam",
        en: "Energy travels at half the crest speed in deep water",
      },
      /*
       * Puncak gelombang yang diamati akan tampak muncul di belakang
       * deretnya, berjalan ke depan melaluinya, lalu lenyap di depannya.
       * Tidak ada air maupun tenaga yang ikut berjalan secepat itu.
       */
      source: "cg = c/2 (1 + 2kh/sinh 2kh), batas air dalam",
      kind: "terbitan",
      expected: 0.5,
      actual: dalam.groupRatio,
      tol: 0.001,
      digits: 5,
    },
    {
      label: {
        id: "Tenaga tidak pernah merambat lebih cepat daripada puncaknya",
        en: "Energy never travels faster than the crest",
      },
      source: "Sifat yang harus berlaku pada seluruh kedalaman",
      kind: "sifat",
      expected: 1,
      actual: r.groupRatio >= 0.5 - 1e-9 && r.groupRatio <= 1 + 1e-9 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Gelombang yang cukup pendek tidak merasakan dasar sama sekali",
        en: "A short enough wave does not feel the bottom at all",
      },
      source: "Lintasan partikel di dasar mengecil menurut sinh kh",
      kind: "perilaku",
      expected: 1,
      actual: linearWave(3, 100, 1).bottomOrbit < 1e-3 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

export function checksAdvection(
  mass: number,
  area: number,
  U: number,
  D: number,
  station: number
): Check[] {
  const r = advectionDiffusion(mass, area, U, D, station, [600]);
  const p = r.snapshots[0].profile;
  let luas = 0;
  for (let i = 1; i < p.length; i++)
    luas += ((p[i - 1].c + p[i].c) / 2) * (p[i].x - p[i - 1].x);

  const t1 = advectionDiffusion(mass, area, U, D, station, [400]);
  const t4 = advectionDiffusion(mass, area, U, D, station, [1600]);

  return [
    {
      label: {
        id: "Massanya kekal di seluruh sebarannya",
        en: "The mass is conserved across the whole distribution",
      },
      source: "Memadu kepekatan sepanjang sungainya dikali luas penampang",
      kind: "pulang-pergi",
      expected: mass,
      actual: luas * area,
      tol: 0.02,
      tolReason: {
        id: "Pemaduannya memakai kaidah trapesium pada dua ratus titik, dan ekor loncengnya dipotong di tepi bidangnya",
        en: "The integration uses the trapezium rule on two hundred points, and the tails are cut at the edge of the field",
      },
      unit: "kg",
      digits: 3,
    },
    {
      label: {
        id: "Pusatnya bergerak menurut waktu, lebarnya hanya menurut akar waktu",
        en: "The centre moves with time, the width only with the square root of time",
      },
      /*
       * Perbedaan pangkat itulah pokok seluruh lembar ini. Melipatempatkan
       * waktunya memindahkan pusatnya empat kali tetapi hanya melebarkan
       * awannya dua kali.
       */
      source: "Penyelesaian Gauss untuk lepasan seketika",
      kind: "sifat",
      expected: 2,
      actual: t1.sigma > 0 ? t4.sigma / t1.sigma : 2,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Dan pusatnya berpindah tepat empat kali pada waktu yang sama",
        en: "And the centre moves exactly fourfold over the same time",
      },
      source: "Adveksi lurus terhadap waktu",
      kind: "sifat",
      expected: 4,
      actual: t1.centre > 0 ? t4.centre / t1.centre : 4,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Kepekatan puncaknya turun menurut akar waktu, bukan menurut waktu",
        en: "The peak concentration falls with the square root of time, not with time",
      },
      /* Awan pencemar yang hanyut sepuluh kali lebih jauh hanya tiga koma
         dua kali lebih encer. */
      source: "Akibat langsung lebar yang tumbuh menurut akar waktu",
      kind: "silang",
      expected: 2,
      actual: t4.peak > 0 ? t1.peak / t4.peak : 2,
      tol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Awan yang hanyut makin jauh makin sempit terhadap jarak tempuhnya",
        en: "A cloud carried further becomes narrower relative to the distance travelled",
      },
      source: "Perilaku yang harus berlaku pada perbedaan pangkatnya",
      kind: "perilaku",
      expected: 1,
      actual: t4.spreadRatio < t1.spreadRatio ? 1 : 0,
      tol: 0,
      digits: 0,
    },
  ];
}

export function checksFalknerSkan(beta: number): Check[] {
  const r = falknerSkan(beta);
  const blasius = falknerSkan(0);
  const stagnasi = falknerSkan(1);
  const lepas = falknerSkan(FALKNER_SKAN_SEPARATION);

  return [
    {
      label: {
        id: "Kemiringan dinding pada gradien datar sesuai tabel Schlichting",
        en: "The wall slope at zero pressure gradient matches the Schlichting table",
      },
      /*
       * Angka yang sama sekali tidak melewati kode ini. Kalau penembakannya
       * salah arah, angka ini yang pertama memberi tahu.
       */
      source: "Schlichting (1979), Boundary-Layer Theory, edisi ke-7, tabel 9.1",
      kind: "terbitan",
      expected: 0.4696,
      actual: blasius.wallSlope,
      tol: 0.002,
      digits: 4,
    },
    {
      label: {
        id: "Kemiringan dinding pada aliran titik henti juga sesuai tabelnya",
        en: "The wall slope at stagnation flow also matches the table",
      },
      source: "Schlichting (1979), tabel 9.1, beta satu",
      kind: "terbitan",
      expected: 1.2326,
      actual: stagnasi.wallSlope,
      tol: 0.002,
      digits: 4,
    },
    {
      label: {
        id: "Faktor bentuk Blasius dua koma lima sembilan",
        en: "The Blasius shape factor is 2.59",
      },
      source: "Schlichting (1979), H = δ*/θ untuk lapisan batas datar",
      kind: "terbitan",
      expected: 2.59,
      actual: blasius.shapeFactor,
      tol: 0.01,
      tolReason: {
        id: "Kedua tebalnya dipadu dengan kaidah trapesium sampai batas luar berhingga, jadi ekor profilnya terpotong sedikit",
        en: "Both thicknesses are integrated by the trapezium rule to a finite outer limit, so the tail of the profile is slightly cut",
      },
      digits: 3,
    },
    {
      label: {
        id: "Pemisahan terjadi tepat pada beta terbitan, dan tidak bergantung pada apa pun lain",
        en: "Separation occurs exactly at the published beta, and depends on nothing else",
      },
      /*
       * Lapisan batas laminar yang menghadapi perlambatan sebesar itu akan
       * terlepas pada benda sebesar apa pun, di dalam fluida apa pun, pada
       * kecepatan berapa pun. Bilangan Reynolds tidak muncul sama sekali.
       */
      source: "Hartree (1937), beta pemisahan minus 0,19884",
      kind: "terbitan",
      expected: 0,
      actual: lepas.wallSlope,
      tol: 0,
      absTol: 0.005,
      digits: 5,
    },
    {
      label: {
        id: "Gradien yang membantu tidak pernah memisahkan lapisan batasnya",
        en: "A favourable gradient never separates the boundary layer",
      },
      source: "Perilaku yang harus berlaku pada seluruh beta positif",
      kind: "perilaku",
      expected: 1,
      actual: [0.05, 0.3, 1, 1.6].every((b) => !falknerSkan(b).separated) ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Kemiringan dinding naik monoton bersama beta",
        en: "The wall slope rises monotonically with beta",
      },
      source: "Perilaku yang harus berlaku pada seluruh rentangnya",
      kind: "perilaku",
      expected: 1,
      actual: (() => {
        let sebelum = -1;
        for (const b of [-0.19, -0.1, 0, 0.5, 1, 1.5]) {
          const s = falknerSkan(b).wallSlope;
          if (s <= sebelum) return 0;
          sebelum = s;
        }
        return 1;
      })(),
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Faktor bentuknya naik ketika gradiennya makin melawan",
        en: "The shape factor rises as the gradient becomes more adverse",
      },
      /* Faktor bentuk itulah penanda pemisahan yang dipakai di lapangan:
         ia menjauh dari dua koma enam menuju empat menjelang lepasnya. */
      source: "Perilaku yang harus berlaku menjelang pemisahan",
      kind: "perilaku",
      expected: 1,
      actual:
        stagnasi.shapeFactor < blasius.shapeFactor &&
        blasius.shapeFactor < falknerSkan(-0.18).shapeFactor
          ? 1
          : 0,
      tol: 0,
      digits: 0,
    },
  ];
}
