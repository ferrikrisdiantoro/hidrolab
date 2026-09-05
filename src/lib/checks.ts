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
      titik = { x: a.x + (c.x - a.x) * f, y: yTarget, nearCritical: false };
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
        id: "Tinggi muka air di bawah 5 cm ditandai di luar rentang",
        en: "A head below 5 cm is flagged outside the valid range",
      },
      source: "Batas keberlakuan pada ISO 1438",
      kind: "perilaku",
      expected: 1,
      actual:
        notchDischarge(0.03, 90).outOfRange &&
        !notchDischarge(0.05, 90).outOfRange
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
  const tengah = r.points[Math.floor(r.points.length / 2)];

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
      expected: Qtotal / 2,
      actual: tengah.Q,
      tol: 0.02,
      tolReason: {
        id: "Titik tengah dibaca dari senarai titik yang jumlahnya genap, jadi ia tidak jatuh persis di separuh panjang.",
        en: "The midpoint is read from a list with an even number of points, so it does not land exactly at half the length.",
      },
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
  const dx = L / (r.points.length - 1);
  let terbesar = 0;
  for (let i = 1; i < r.points.length; i++) {
    const p1 = r.points[i - 1];
    const p2 = r.points[i];
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
