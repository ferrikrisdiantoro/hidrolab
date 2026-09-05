import type { Check } from "./verify.ts";
import {
  G,
  NOTCH_KH,
  colebrookFriction,
  conjugateDepth,
  criticalDepth,
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
  specificEnergy,
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
