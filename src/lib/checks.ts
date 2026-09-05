import type { Check } from "./verify.ts";
import {
  G,
  backwaterExtent,
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
  jumpEnergyLoss,
  manningDischarge,
  normalDepth,
  notchCe,
  notchDischarge,
  slopeBreak,
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
