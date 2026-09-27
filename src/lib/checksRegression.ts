import type { Check } from "./verify.ts";
import { fitRegression, formulaValue, type RegKind, type XY } from "./regression.ts";
import { NIST_NORRIS, NIST_PONTIUS } from "./nistData.ts";

/**
 * Blok verifikasi HY-05.
 *
 * Dua pemeriksaan tidak bergantung pada data pengguna sama sekali: koefisien
 * bersertifikat NIST StRD untuk regresi linear (Norris) dan kuadrat
 * (Pontius). Acuan itu dari luar aplikasi dalam arti yang paling ketat,
 * dihitung NIST dengan aritmetika presisi tinggi.
 *
 * Sisanya memeriksa data yang sedang dipakai. Yang terpenting yang pertama:
 * rumus yang ditulis, dan yang disalin pengguna ke laporannya, harus memberi
 * nilai yang sama dengan kurva yang digambar. Di cl42 keduanya pernah tidak
 * sama.
 */

const titik = (d: [number, number][]): XY[] => d.map(([x, y]) => ({ x, y }));

export function checksRegression(data: XY[], kind: RegKind, degree: number, window: number): Check[] {
  const norris = fitRegression(titik(NIST_NORRIS), "linear");
  const pontius = fitRegression(titik(NIST_PONTIUS), "polinomial", 2);

  const bebas: Check[] = [
    {
      label: {
        id: "Regresi linear lembar ini mengembalikan kemiringan bersertifikat NIST Norris",
        en: "This sheet's linear regression recovers the NIST Norris certified slope",
      },
      source: "NIST StRD, Norris (kalibrasi pemantau ozon), B1 = 1,00211681802045",
      kind: "terbitan",
      expected: 1.00211681802045,
      actual: norris ? norris.coeffs[1] : 0,
      tol: 1e-12,
      tolReason: {
        id: "NIST menjamin 15 angka bermakna; aritmetika ganda memberi sekitar 13",
        en: "NIST certifies 15 significant digits; double arithmetic gives about 13",
      },
      digits: 12,
    },
    {
      label: {
        id: "Regresi polinomial lembar ini mengembalikan koefisien x² bersertifikat NIST Pontius",
        en: "This sheet's polynomial regression recovers the NIST Pontius certified x² coefficient",
      },
      source: "NIST StRD, Pontius (kalibrasi sel beban), B2 = −0,316081871345029e−14",
      kind: "terbitan",
      expected: -0.316081871345029e-14,
      actual: pontius ? pontius.coeffs[2] : 0,
      tol: 1e-6,
      tolReason: {
        id: "x sampai tiga juta; koefisien x² sepuluh pangkat minus lima belas",
        en: "x reaches three million; the x² coefficient is ten to the minus fifteen",
      },
      digits: 20,
    },
  ];

  const f = fitRegression(data, kind, degree, window);
  if (!f) return bebas;

  const semua = data.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const dibuang = semua.filter((p) =>
    kind === "eksponensial"
      ? !(p.y > 0)
      : kind === "pangkat"
        ? !(p.x > 0 && p.y > 0)
        : kind === "logaritmik"
          ? !(p.x > 0)
          : false
  ).length;

  const out: Check[] = [];

  if (f.predict) {
    const xs = [f.xMin, (f.xMin + f.xMax) / 2, f.xMax];
    let beda = 0;
    let skala = 0;
    for (const x of xs) {
      beda = Math.max(beda, Math.abs(formulaValue(f, x) - f.predict(x)));
      skala = Math.max(skala, Math.abs(f.predict(x)));
    }
    out.push({
      label: {
        id: "Rumus yang ditulis memberi nilai yang sama dengan kurva yang digambar",
        en: "The formula as written gives the same values as the curve drawn",
      },
      source: "Koefisien rumus dievaluasi terpisah di x terkecil, tengah, dan terbesar",
      kind: "silang",
      expected: 0,
      actual: beda,
      tol: 0,
      absTol: 1e-7 * Math.max(1, skala),
      digits: 10,
    });

    const pakai = semua.filter((p) =>
      kind === "eksponensial" ? p.y > 0 : kind === "pangkat" ? p.x > 0 && p.y > 0 : kind === "logaritmik" ? p.x > 0 : true
    );
    const logY = kind === "eksponensial" || kind === "pangkat";
    const sisa = pakai.reduce(
      (s, p) => s + (logY ? Math.log(p.y) - Math.log(f.predict!(p.x)) : p.y - f.predict!(p.x)),
      0
    );
    const skalaY = pakai.reduce((s, p) => s + Math.abs(logY ? Math.log(p.y) : p.y), 0);
    out.push({
      label: {
        id: logY
          ? "Sisa kuadrat terkecil di ruang ln y berjumlah nol"
          : "Sisa kuadrat terkecil berjumlah nol",
        en: logY ? "Least-squares residuals in ln y space sum to zero" : "Least-squares residuals sum to zero",
      },
      source: "Persamaan normal untuk suku tetap",
      kind: "sifat",
      expected: 0,
      actual: sisa,
      tol: 0,
      absTol: 1e-9 * Math.max(1, skalaY),
      digits: 10,
    });
  } else {
    const urut = semua.slice().sort((a, b) => a.x - b.x);
    const w = f.coeffs[0];
    const akhir = urut.slice(-w).reduce((s, p) => s + p.y, 0) / w;
    out.push({
      label: {
        id: "Titik terakhir garis rata-rata bergerak sama dengan rata-rata jendela terakhirnya",
        en: "The last moving-average point equals the mean of its last window",
      },
      source: "Definisi rata-rata bergerak garis tren Excel",
      kind: "silang",
      expected: akhir,
      actual: f.maLine[f.maLine.length - 1].y,
      tol: 1e-12,
      absTol: 1e-12,
      digits: 6,
    });
  }

  if (f.r2 !== null) {
    const yUsed = f.predict
      ? semua
          .filter((p) =>
            kind === "eksponensial" ? p.y > 0 : kind === "pangkat" ? p.x > 0 && p.y > 0 : kind === "logaritmik" ? p.x > 0 : true
          )
          .map((p) => p.y)
      : semua
          .slice()
          .sort((a, b) => a.x - b.x)
          .slice(f.coeffs[0] - 1)
          .map((p) => p.y);
    const m = yUsed.reduce((s, v) => s + v, 0) / yUsed.length;
    const ssTot = yUsed.reduce((s, v) => s + (v - m) ** 2, 0);
    out.push({
      label: {
        id: "R² sama dengan satu dikurangi n·RMSE² dibagi ragam totalnya",
        en: "R² equals one minus n·RMSE² over the total sum of squares",
      },
      source: "Definisi R² dan RMSE pada pasangan yang sama",
      kind: "silang",
      expected: 1 - (f.n * f.rmse * f.rmse) / ssTot,
      actual: f.r2,
      tol: 1e-10,
      absTol: 1e-10,
      digits: 6,
    });
  }

  out.push(
    {
      label: {
        id: "MAE tidak pernah melebihi RMSE",
        en: "MAE never exceeds RMSE",
      },
      source: "Ketaksamaan rata-rata kuadrat",
      kind: "sifat",
      expected: 1,
      actual: f.mae <= f.rmse * (1 + 1e-12) + 1e-15 ? 1 : 0,
      tol: 0,
      digits: 0,
    },
    {
      label: {
        id: "Jumlah pasangan yang dibuang sama dengan hitungan terpisah",
        en: "The count of dropped pairs matches a separate count",
      },
      source: "Syarat rumus: y positif untuk eksponensial, x dan y positif untuk pangkat, x positif untuk logaritmik",
      kind: "perilaku",
      expected: dibuang,
      actual: f.dropped,
      tol: 0,
      digits: 0,
    }
  );

  return [...out, ...bebas];
}
