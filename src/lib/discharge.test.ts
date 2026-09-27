import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SAMPLE_RATING,
  SAMPLE_SECTION,
  fitRating,
  maxDischargeDepth,
  normalDepth,
  parsePairs,
  ratingValue,
  sectionFlow,
  type Resistance,
  type SectionInput,
} from "./discharge.ts";

const dekat = (a: number, b: number, tol: number, pesan = "") =>
  assert.ok(Math.abs(a - b) <= tol, `${pesan} ${a} bukan ${b}`);

const M: Resistance = { method: "manning", n: 0.013 };
const S = 0.001;

describe("HY-03 geometri penampang", () => {
  it("pipa setengah penuh: A = πD²/8, P = πD/2, lebar muka air = D", () => {
    const r = sectionFlow({ shape: "lingkaran", D: 2 }, 1, S, M);
    dekat(r.area, Math.PI / 2, 1e-12, "A");
    dekat(r.perimeter, Math.PI, 1e-12, "P");
    dekat(r.topWidth, 2, 1e-12, "T");
  });

  it("pipa penuh: A = πD²/4 dan tanda penuh menyala bila air di atas puncak", () => {
    const r = sectionFlow({ shape: "lingkaran", D: 1 }, 1.4, S, M);
    dekat(r.area, Math.PI / 4, 1e-12);
    assert.equal(r.overtopped, true);
    assert.equal(r.depth, 1);
  });

  it("debit pipa terbesar di sekitar 0,938 D, bukan saat penuh", () => {
    const s: SectionInput = { shape: "lingkaran", D: 1 };
    const y = maxDischargeDepth(s, S, M);
    dekat(y, 0.938, 0.002, "kedalaman debit terbesar");
    assert.ok(
      sectionFlow(s, y, S, M).discharge > sectionFlow(s, 1, S, M).discharge * 1.07
    );
  });

  it("saluran persegi: A = W y, P = W + 2y", () => {
    const r = sectionFlow({ shape: "persegi", W: 3, Hc: 2 }, 0.8, S, M);
    dekat(r.area, 2.4, 1e-12);
    dekat(r.perimeter, 4.6, 1e-12);
    assert.equal(r.overtopped, false);
  });

  it("penampang alam berbentuk persegi memberi hasil yang sama dengan persegi", () => {
    const alam = sectionFlow(
      { shape: "alam", pts: [{ x: 0, y: 2 }, { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }] },
      0.8,
      S,
      M
    );
    const kotak = sectionFlow({ shape: "persegi", W: 3, Hc: 2 }, 0.8, S, M);
    dekat(alam.area, kotak.area, 1e-12);
    dekat(alam.perimeter, kotak.perimeter, 1e-12);
    dekat(alam.discharge, kotak.discharge, 1e-12);
  });

  it("penampang segitiga: A = z y², P = 2y√(1+z²)", () => {
    const z = 2;
    const r = sectionFlow(
      { shape: "alam", pts: [{ x: -6, y: 3 }, { x: 0, y: 0 }, { x: 6, y: 3 }] },
      1.5,
      S,
      M
    );
    dekat(r.area, z * 1.5 * 1.5, 1e-12);
    dekat(r.perimeter, 2 * 1.5 * Math.sqrt(1 + z * z), 1e-12);
  });

  it("gundukan yang muncul di atas air memisahkan dua genangan", () => {
    const r = sectionFlow(
      {
        shape: "alam",
        pts: [
          { x: 0, y: 3 }, { x: 2, y: 0 }, { x: 4, y: 2 }, { x: 6, y: 0 }, { x: 8, y: 3 },
        ],
      },
      1,
      S,
      M
    );
    assert.equal(r.wetted.length, 2);
    /* Dua segitiga sebangun, masing-masing luas 1 · 1 · (2/3 + 1) / 2 */
    dekat(r.area, 2 * (1 * (2 / 3 + 1)) / 2, 1e-12);
  });

  it("penampang contoh cl42 meluap di atas tebing terendahnya", () => {
    const s: SectionInput = { shape: "alam", pts: SAMPLE_SECTION };
    assert.equal(sectionFlow(s, 2.4, S, M).overtopped, false);
    assert.equal(sectionFlow(s, 2.6, S, M).overtopped, true);
  });

  it("Chezy dengan C = R^(1/6)/n sama dengan Manning", () => {
    const s: SectionInput = { shape: "persegi", W: 4, Hc: 3 };
    const man = sectionFlow(s, 1.2, S, M);
    const C = Math.pow(man.radius, 1 / 6) / M.n;
    const che = sectionFlow(s, 1.2, S, { method: "chezy", C });
    dekat(che.discharge, man.discharge, 1e-10);
  });
});

describe("HY-03 kedalaman normal", () => {
  const bentuk: SectionInput[] = [
    { shape: "lingkaran", D: 1.2 },
    { shape: "persegi", W: 2, Hc: 1.5 },
    { shape: "alam", pts: SAMPLE_SECTION },
  ];
  it("pulang-pergi: debit pada kedalaman y memberi kembali y", () => {
    for (const s of bentuk)
      for (const f of [0.1, 0.4, 0.8]) {
        const y = f * (s.shape === "lingkaran" ? 1.2 : s.shape === "persegi" ? 1.5 : 2.5);
        const Q = sectionFlow(s, y, S, M).discharge;
        const kembali = normalDepth(s, Q, S, M);
        assert.ok(kembali !== null);
        dekat(kembali as number, y, 1e-6, s.shape);
      }
  });
  it("debit di atas kapasitas pipa tidak punya kedalaman normal", () => {
    const s: SectionInput = { shape: "lingkaran", D: 0.5 };
    const puncak = sectionFlow(s, maxDischargeDepth(s, S, M), S, M).discharge;
    assert.equal(normalDepth(s, puncak * 1.01, S, M), null);
  });
});

describe("Membaca berkas dua kolom", () => {
  it("koma sebagai pemisah kolom, dengan judul", () => {
    const r = parsePairs("H,Q\n0.2,0.12\n0.35,0.38\n");
    assert.deepEqual(r.pts, [{ x: 0.2, y: 0.12 }, { x: 0.35, y: 0.38 }]);
  });
  it("titik koma dan koma desimal dari Excel berbahasa Indonesia", () => {
    const r = parsePairs("H;Q\r\n0,2;0,12\r\n0,35;0,38\r\n");
    assert.deepEqual(r.pts, [{ x: 0.2, y: 0.12 }, { x: 0.35, y: 0.38 }]);
  });
  it("tab, dan baris rusak dihitung, bukan dibuang diam-diam", () => {
    const r = parsePairs("0.2\t0.12\nabc\tdef\n0.35\t0.38");
    assert.equal(r.pts.length, 2);
    assert.equal(r.skipped, 1);
  });
});

describe("HY-04 lengkung debit", () => {
  const buat = (f: (h: number) => number) =>
    [0.2, 0.4, 0.6, 0.9, 1.2, 1.6, 2].map((h) => ({ x: h, y: f(h) }));

  it("pangkat tepat: Q = 2 H^1,5 kembali utuh", () => {
    const f = fitRating(buat((h) => 2 * Math.pow(h, 1.5)), "pangkat");
    assert.ok(f);
    dekat(f!.a, 2, 1e-9);
    dekat(f!.b, 1.5, 1e-9);
    dekat(f!.r2, 1, 1e-12);
  });

  it("pangkat dengan tinggi aliran nol menemukan h0 = 0,3", () => {
    const data = [0.5, 0.7, 0.9, 1.2, 1.6, 2, 2.5].map((h) => ({
      x: h,
      y: 3 * Math.pow(h - 0.3, 1.7),
    }));
    const f = fitRating(data, "pangkat-h0");
    assert.ok(f);
    dekat(f!.h0, 0.3, 1e-4, "h0");
    dekat(f!.b, 1.7, 1e-3, "b");
    /* Bentuk tanpa h0 pada data yang sama jelas lebih buruk */
    const tanpa = fitRating(data, "pangkat")!;
    assert.ok(tanpa.rmse > f!.rmse * 50);
  });

  it("polinomial tepat pada kuadrat, dan kurvanya MEMAKAI koefisiennya", () => {
    /* Cacat cl42: kurva polinomial tergambar sebagai q = h */
    const f = fitRating(buat((h) => 0.5 + 1.2 * h + 0.8 * h * h), "polinomial", 2);
    assert.ok(f);
    dekat(f!.coeffs[0], 0.5, 1e-9);
    dekat(f!.coeffs[1], 1.2, 1e-9);
    dekat(f!.coeffs[2], 0.8, 1e-9);
    dekat(ratingValue(f!, 1.37), 0.5 + 1.2 * 1.37 + 0.8 * 1.37 * 1.37, 1e-9);
  });

  it("polinomial yang turun di dalam rentang data ditandai", () => {
    const data = [0, 0.5, 1, 1.5, 2].map((h) => ({ x: h, y: 4 * h - 2 * h * h + 0.1 }));
    assert.equal(fitRating(data, "polinomial", 2)!.nonMonotone, true);
    assert.equal(fitRating(SAMPLE_RATING, "polinomial", 2)!.nonMonotone, false);
  });

  it("data contoh cl42 cocok dengan pangkat, R² di atas 0,99", () => {
    const f = fitRating(SAMPLE_RATING, "pangkat")!;
    assert.ok(f.r2 > 0.99, `R² ${f.r2}`);
    assert.equal(f.hMin, 0.2);
    assert.equal(f.hMax, 1.75);
  });

  it("titik nol dan negatif dibuang dari bentuk pangkat, dan jumlahnya dicatat", () => {
    const f = fitRating([...SAMPLE_RATING, { x: 0, y: 0 }, { x: 0.1, y: -1 }], "pangkat")!;
    assert.equal(f.dropped, 2);
    assert.equal(f.n, SAMPLE_RATING.length);
  });

  it("data terlalu sedikit tidak menghasilkan lengkung", () => {
    assert.equal(fitRating([{ x: 1, y: 1 }], "pangkat"), null);
    assert.equal(fitRating(SAMPLE_RATING.slice(0, 3), "polinomial", 4), null);
  });
});

import { checksRating, checksSection } from "./checksDischarge.ts";
import { evaluate, type Check } from "./verify.ts";

function semuaLolos(checks: Check[], konteks: string) {
  for (const c of checks) {
    const r = evaluate(c);
    assert.ok(
      r.pass,
      `${konteks} | ${c.label.id}: acuan ${c.expected}, hitungan ${c.actual}, selisih ${r.pct.toFixed(5)}%`
    );
  }
}

describe("Blok verifikasi HY-03 dan HY-04 lolos di seluruh rentang penggeser", () => {
  it("HY-03 ketiga bentuk, kedua rumus, dari kosong sampai meluap", () => {
    const bentuk: SectionInput[] = [
      { shape: "lingkaran", D: 0.3 },
      { shape: "lingkaran", D: 1 },
      { shape: "lingkaran", D: 4 },
      { shape: "persegi", W: 0.5, Hc: 0.4 },
      { shape: "persegi", W: 8, Hc: 3 },
      { shape: "alam", pts: SAMPLE_SECTION },
    ];
    const tahanan: Resistance[] = [
      { method: "manning", n: 0.01 },
      { method: "manning", n: 0.08 },
      { method: "chezy", C: 15 },
      { method: "chezy", C: 90 },
    ];
    for (const s of bentuk)
      for (const r of tahanan)
        for (const f of [0.02, 0.3, 0.7, 0.95, 1, 1.3])
          for (const S of [0.0001, 0.001, 0.03]) {
            const H = f * (s.shape === "lingkaran" ? s.D : s.shape === "persegi" ? s.Hc : 2.5);
            const cs = checksSection(s, H, S, r);
            assert.ok(cs.length >= 5);
            semuaLolos(cs, `${s.shape} ${r.method} H=${H} S=${S}`);
          }
  });

  it("HY-04 ketiga bentuk lengkung, dengan data contoh dan data yang janggal", () => {
    const himpunan = [
      SAMPLE_RATING,
      SAMPLE_RATING.slice(0, 4),
      [0, 0.5, 1, 1.5, 2].map((h) => ({ x: h, y: 4 * h - 2 * h * h + 0.1 })),
      [0.5, 0.7, 0.9, 1.2, 1.6, 2, 2.5].map((h) => ({ x: h, y: 3 * Math.pow(h - 0.3, 1.7) })),
      [{ x: 1, y: 1 }],
    ];
    for (const d of himpunan)
      for (const k of ["pangkat", "pangkat-h0", "polinomial"] as const)
        for (const deg of [2, 3, 4]) semuaLolos(checksRating(d, k, deg), `${k} derajat ${deg} n=${d.length}`);
  });
});
