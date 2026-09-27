import type { Check } from "./verify.ts";
import {
  fitRating,
  maxDischargeDepth,
  normalDepth,
  ratingValue,
  sectionFlow,
  sectionHeight,
  type Pt,
  type RatingKind,
  type Resistance,
  type SectionInput,
} from "./discharge.ts";

/**
 * Blok verifikasi modul debit, HY-03 dan HY-04.
 *
 * Aturannya sama dengan enam puluh sembilan lembar lain: acuan datang dari
 * luar fungsi yang diperiksa. Pada penampang, luas dan keliling basah
 * diperiksa lewat jalur kedua yang sama sekali lain, yaitu poligon basahnya
 * sendiri dan rumus Shoelace. Pada lengkung debit, cara pencocokannya
 * diperiksa pada data buatan yang hukumnya sudah diketahui, supaya yang diuji
 * caranya dan bukan kebetulan data ukurnya.
 */

/** Luas poligon, rumus Shoelace */
function shoelace(p: Pt[]) {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/** Panjang garis basah: seluruh sisi poligon kecuali sisi muka airnya */
function panjangDasar(p: Pt[]) {
  let s = 0;
  for (let i = 0; i < p.length - 1; i++) s += Math.hypot(p[i + 1].x - p[i].x, p[i + 1].y - p[i].y);
  return s;
}

export function checksSection(
  s: SectionInput,
  H: number,
  S: number,
  r: Resistance
): Check[] {
  const f = sectionFlow(s, H, S, r);
  const lingkaran = s.shape === "lingkaran";
  /* Poligon lingkaran didekati 96 ruas; galat tali busurnya sekitar
     seperlima ribu, jadi toleransinya dilonggarkan untuk bentuk itu saja. */
  const tolPoligon = lingkaran ? 1e-3 : 1e-9;
  const alasanPoligon = lingkaran
    ? {
        id: "Busur lingkaran didekati 96 tali busur untuk digambar",
        en: "The circular arc is approximated by 96 chords for drawing",
      }
    : undefined;

  const empat = sectionFlow(s, H, 4 * S, r);
  const puncak = maxDischargeDepth(s, S, r);
  const balik = normalDepth(s, f.discharge, S, r);
  const qBalik = balik === null ? 0 : sectionFlow(s, balik, S, r).discharge;

  const pembanding: Check =
    r.method === "manning"
      ? {
          label: {
            id: "Chezy dengan C = R^(1/6)/n memberi debit yang sama dengan Manning",
            en: "Chezy with C = R^(1/6)/n gives the same discharge as Manning",
          },
          source: "Chow (1959), Open-Channel Hydraulics, pasal 5-6",
          kind: "silang",
          expected: f.discharge,
          actual: sectionFlow(s, H, S, {
            method: "chezy",
            C: f.radius > 0 ? Math.pow(f.radius, 1 / 6) / r.n : 0,
          }).discharge,
          tol: 1e-10,
          absTol: 1e-12,
          unit: "m³/s",
          digits: 5,
        }
      : {
          label: {
            id: "Manning dengan n = R^(1/6)/C memberi debit yang sama dengan Chezy",
            en: "Manning with n = R^(1/6)/C gives the same discharge as Chezy",
          },
          source: "Chow (1959), Open-Channel Hydraulics, pasal 5-6",
          kind: "silang",
          expected: f.discharge,
          actual:
            f.radius > 0
              ? sectionFlow(s, H, S, { method: "manning", n: Math.pow(f.radius, 1 / 6) / r.C }).discharge
              : 0,
          tol: 1e-10,
          absTol: 1e-12,
          unit: "m³/s",
          digits: 5,
        };

  const terbitan: Check =
    s.shape === "lingkaran"
      ? {
          /* 0,938 D milik Manning (V sebanding R^(2/3)); pada Chezy
             (V sebanding R^(1/2)) puncaknya bergeser ke 0,95 D. */
          label: {
            id:
              r.method === "manning"
                ? "Debit pipa terbesar terjadi pada kedalaman 0,938 D, bukan saat penuh"
                : "Dengan Chezy, debit pipa terbesar terjadi pada kedalaman 0,95 D",
            en:
              r.method === "manning"
                ? "The largest pipe discharge occurs at 0.938 D, not when full"
                : "With Chezy, the largest pipe discharge occurs at 0.95 D",
          },
          source: "Chow (1959), Open-Channel Hydraulics, saluran tertutup terisi sebagian; Butler & Davies (2011), Urban Drainage",
          kind: "terbitan",
          expected: r.method === "manning" ? 0.938 : 0.95,
          actual: puncak / s.D,
          tol: 0.003,
          tolReason: {
            id: "Nilai terbitan ditulis tiga angka",
            en: "The published value is given to three figures",
          },
          digits: 4,
        }
      : s.shape === "persegi"
        ? {
            label: {
              id: "Penampang persegi terbaik, lebar dua kali kedalaman, berjari-jari hidraulis y/2",
              en: "The best rectangular section, width twice the depth, has hydraulic radius y/2",
            },
            source: "Chow (1959), tabel 7-1",
            kind: "terbitan",
            expected: s.W / 4,
            actual: sectionFlow({ shape: "persegi", W: s.W, Hc: Math.max(s.Hc, s.W) }, s.W / 2, S, r).radius,
            tol: 1e-12,
            unit: "m",
            digits: 4,
          }
        : {
            label: {
              id: "Saluran sangat lebar: debit sebanding kedalaman pangkat 5/3",
              en: "A very wide channel: discharge in proportion to depth to the power 5/3",
            },
            source: "Chow (1959), pasal 6-2, R mendekati y bila B jauh lebih besar",
            kind: "terbitan",
            expected: 5 / 3,
            actual: (() => {
              const lebar: SectionInput = { shape: "persegi", W: 5000, Hc: 10 };
              const m: Resistance = { method: "manning", n: 0.03 };
              const q1 = sectionFlow(lebar, 1, S, m).discharge;
              const q2 = sectionFlow(lebar, 2, S, m).discharge;
              return Math.log(q2 / q1) / Math.log(2);
            })(),
            tol: 1e-3,
            tolReason: {
              id: "Lebar 5000 m: dinding sisi masih menyumbang seperseribu keliling",
              en: "At 5000 m width the side walls still contribute a thousandth of the perimeter",
            },
            digits: 4,
          };

  const monoton = (() => {
    const atas = lingkaran ? puncak : sectionHeight(s);
    let q0 = -1;
    for (let i = 1; i <= 100; i++) {
      const q = sectionFlow(s, (atas * i) / 100, S, r).discharge;
      if (q < q0 - 1e-12) return 0;
      q0 = q;
    }
    return 1;
  })();

  return [
    {
      label: {
        id: "Luas basah sama dengan luas poligon basahnya, rumus Shoelace",
        en: "The wetted area equals the area of its wetted polygon, shoelace formula",
      },
      source: "Rumus luas poligon Gauss (Shoelace), jalur hitung terpisah",
      kind: "silang",
      expected: f.wetted.reduce((a, p) => a + shoelace(p), 0),
      actual: f.area,
      tol: tolPoligon,
      absTol: 1e-12,
      tolReason: alasanPoligon,
      unit: "m²",
      digits: 4,
    },
    {
      label: {
        id: "Keliling basah sama dengan panjang garis dasar poligon basahnya",
        en: "The wetted perimeter equals the bed length of its wetted polygon",
      },
      source: "Panjang ruas satu per satu, jalur hitung terpisah",
      kind: "silang",
      expected: f.wetted.reduce(
        (a, p) => a + (lingkaran && f.depth >= s.D ? panjangDasar([...p, p[0]]) : panjangDasar(p)),
        0
      ),
      actual: f.perimeter,
      tol: tolPoligon,
      absTol: 1e-12,
      tolReason: alasanPoligon,
      unit: "m",
      digits: 4,
    },
    pembanding,
    {
      label: {
        id: "Kemiringan empat kali lipat melipatduakan debit",
        en: "Four times the slope doubles the discharge",
      },
      source: "Manning dan Chezy: V sebanding S^(1/2)",
      kind: "sifat",
      expected: 2 * f.discharge,
      actual: empat.discharge,
      tol: 1e-10,
      absTol: 1e-12,
      unit: "m³/s",
      digits: 5,
    },
    {
      label: {
        id: "Kedalaman normal dari debit ini mengalirkan debit yang sama kembali",
        en: "The normal depth for this discharge carries the same discharge back",
      },
      source: "Pembalikan dengan pembagian dua pada cabang naik",
      kind: "pulang-pergi",
      expected: f.discharge,
      actual: qBalik,
      tol: 1e-7,
      absTol: 1e-10,
      unit: "m³/s",
      digits: 5,
    },
    terbitan,
    {
      label: {
        id: lingkaran
          ? "Debit naik terus sampai kedalaman debit terbesar"
          : "Debit naik terus bersama kedalaman sampai tepi saluran",
        en: lingkaran
          ? "Discharge keeps rising up to the depth of largest discharge"
          : "Discharge keeps rising with depth up to the channel rim",
      },
      source: "Perilaku yang harus berlaku pada aliran seragam",
      kind: "perilaku",
      expected: 1,
      actual: monoton,
      tol: 0,
      digits: 0,
    },
  ];
}

export function checksRating(data: Pt[], kind: RatingKind, degree: number): Check[] {
  const f = fitRating(data, kind, degree);

  /* Data buatan dengan hukum yang sudah diketahui. Tidak bergantung pada data
     ukur pengguna, jadi selalu dapat dihitung. */
  const Hbuat = [0.3, 0.5, 0.8, 1.1, 1.5, 2, 2.6];
  const hukum = fitRating(
    Hbuat.map((h) => ({ x: h, y: 2.4 * Math.pow(h - (kind === "pangkat-h0" ? 0.15 : 0), 1.6) })),
    kind === "polinomial" ? "pangkat" : kind
  );
  const lebar = fitRating(
    [0.4, 0.7, 1, 1.5, 2, 3].map((h) => ({
      x: h,
      y: sectionFlow({ shape: "persegi", W: 5000, Hc: 10 }, h, 0.001, { method: "manning", n: 0.03 }).discharge,
    })),
    "pangkat"
  );
  const kuadrat = fitRating(
    [0.2, 0.5, 0.9, 1.3, 1.8, 2.4].map((h) => ({ x: h, y: 0.3 + 1.1 * h + 0.7 * h * h })),
    "polinomial",
    2
  );

  const bebas: Check[] = [
    kind === "polinomial"
      ? {
          label: {
            id: "Polinomial derajat dua mengembalikan koefisien kuadrat 0,7 dari data buatan",
            en: "A degree-two polynomial recovers the quadratic coefficient 0.7 from synthetic data",
          },
          source: "Data buatan Q = 0,3 + 1,1 H + 0,7 H²",
          kind: "silang",
          expected: 0.7,
          actual: kuadrat ? kuadrat.coeffs[2] : 0,
          tol: 1e-9,
          digits: 6,
        }
      : {
          label: {
            id: "Cara pencocokan ini mengembalikan pangkat 1,6 dari data buatan",
            en: "This fitting method recovers the exponent 1.6 from synthetic data",
          },
          source:
            kind === "pangkat-h0"
              ? "Data buatan Q = 2,4 (H − 0,15)^1,6"
              : "Data buatan Q = 2,4 H^1,6",
          kind: "silang",
          expected: 1.6,
          actual: hukum ? hukum.b : 0,
          tol: 1e-4,
          tolReason: {
            id: "Tinggi aliran nol dicari dengan penyempitan emas, bukan rumus tertutup",
            en: "The zero-flow stage is found by golden-section search, not in closed form",
          },
          digits: 5,
        },
    {
      label: {
        id: "Lengkung dari aliran Manning di saluran sangat lebar berpangkat 5/3",
        en: "A rating from Manning flow in a very wide channel has exponent 5/3",
      },
      source: "Chow (1959), pasal 6-2; ISO 18320:2020, lampiran tentang kendali saluran",
      kind: "terbitan",
      expected: 5 / 3,
      actual: lebar ? lebar.b : 0,
      tol: 2e-3,
      tolReason: {
        id: "Dinding sisi selebar 5000 m masih menyumbang sedikit keliling",
        en: "The side walls of a 5000 m channel still add a little perimeter",
      },
      digits: 4,
    },
  ];

  if (!f) return bebas;

  const Hs = data.filter((p) => kind === "polinomial" || (p.x > 0 && p.y > 0)).map((p) => p.x);
  const Qs = data.filter((p) => kind === "polinomial" || (p.x > 0 && p.y > 0)).map((p) => p.y);
  const n = Hs.length;
  const rata = Qs.reduce((a, q) => a + q, 0) / n;
  const ssTot = Qs.reduce((a, q) => a + (q - rata) ** 2, 0);

  /* Sisa kuadrat terkecil berjumlah nol bila ada suku tetapnya. Pada bentuk
     pangkat sukunya ln a, di ruang logaritma. */
  const jumlahSisa =
    kind === "polinomial"
      ? Qs.reduce((a, q, i) => a + (q - ratingValue(f, Hs[i])), 0)
      : Qs.reduce((a, q, i) => a + (Math.log(q) - Math.log(ratingValue(f, Hs[i]))), 0);

  /* Pembalikan: H di tengah rentang, Q dari lengkungnya, lalu H dicari lagi */
  const hTengah = (f.hMin + f.hMax) / 2;
  const qTengah = ratingValue(f, hTengah);
  let lo = f.hMin;
  let hi = f.hMax;
  const naik = ratingValue(f, f.hMax) >= ratingValue(f, f.hMin);
  for (let i = 0; i < 100; i++) {
    const m = (lo + hi) / 2;
    if (ratingValue(f, m) < qTengah === naik) lo = m;
    else hi = m;
  }

  return [
    {
      label: {
        id:
          kind === "polinomial"
            ? "Sisa kuadrat terkecil berjumlah nol"
            : "Sisa kuadrat terkecil di ruang logaritma berjumlah nol",
        en:
          kind === "polinomial"
            ? "Least-squares residuals sum to zero"
            : "Least-squares residuals in log space sum to zero",
      },
      source: "Persamaan normal untuk suku tetap",
      kind: "sifat",
      expected: 0,
      actual: jumlahSisa,
      tol: 0,
      absTol: 1e-8 * Math.max(1, Math.abs(rata) * n),
      digits: 8,
    },
    {
      label: {
        id: "R² sama dengan satu dikurangi n·RMSE² dibagi ragam totalnya",
        en: "R² equals one minus n·RMSE² over the total sum of squares",
      },
      source: "Definisi R² dan RMSE pada data yang sama",
      kind: "silang",
      expected: ssTot > 0 ? 1 - (n * f.rmse * f.rmse) / ssTot : 0,
      actual: f.r2,
      tol: 1e-10,
      absTol: 1e-12,
      digits: 6,
    },
    {
      label: {
        id: "Membaca H kembali dari debit di tengah rentang data",
        en: "Reading H back from the discharge at mid-range",
      },
      source: "Pembalikan lengkung dengan pembagian dua",
      kind: "pulang-pergi",
      expected: hTengah,
      actual: (lo + hi) / 2,
      tol: 1e-8,
      unit: "m",
      digits: 5,
    },
    ...bebas,
    {
      label: {
        id: "Tanda lengkung turun menyala tepat ketika lengkungnya turun di dalam rentang data",
        en: "The falling-curve flag lights exactly when the curve falls inside the data range",
      },
      source: "Sifat yang harus berlaku pada penanda di lembar ini",
      kind: "perilaku",
      expected: 1,
      actual: (() => {
        let turun = false;
        let q0 = ratingValue(f, f.hMin);
        for (let i = 1; i <= 200; i++) {
          const q = ratingValue(f, f.hMin + ((f.hMax - f.hMin) * i) / 200);
          if (q < q0 - 1e-9 * Math.max(1, Math.abs(q0))) turun = true;
          q0 = q;
        }
        return turun === f.nonMonotone ? 1 : 0;
      })(),
      tol: 0,
      digits: 0,
    },
  ];
}
