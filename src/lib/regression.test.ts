import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SAMPLE_REGRESSION,
  fitRegression,
  formulaValue,
  type XY,
} from "./regression.ts";
import { NIST_NORRIS, NIST_PONTIUS } from "./nistData.ts";

const rel = (a: number, b: number, tol: number, pesan = "") =>
  assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${pesan} ${a} bukan ${b}`);

const titik = (d: [number, number][]): XY[] => d.map(([x, y]) => ({ x, y }));

describe("HY-05 terhadap dataset acuan NIST", () => {
  it("Norris, linear: koefisien dan R² bersertifikat", () => {
    const f = fitRegression(titik(NIST_NORRIS), "linear")!;
    rel(f.coeffs[0], -0.262323073774029, 1e-9, "B0");
    rel(f.coeffs[1], 1.00211681802045, 1e-12, "B1");
    rel(f.r2!, 0.999993745883712, 1e-12, "R²");
  });

  it("Pontius, kuadrat dengan x sampai tiga juta", () => {
    /* x^4 di matriks normalnya sekitar 8e25; x dinormalkan dulu */
    const f = fitRegression(titik(NIST_PONTIUS), "polinomial", 2)!;
    rel(f.coeffs[0], 0.673565789473684e-3, 1e-7, "B0");
    rel(f.coeffs[1], 0.732059160401003e-6, 1e-8, "B1");
    rel(f.coeffs[2], -0.316081871345029e-14, 1e-6, "B2");
    rel(f.r2!, 0.999999900178537, 1e-12, "R²");
  });
});

describe("HY-05 bentuk-bentuk Excel", () => {
  const xs = [0.5, 1, 1.5, 2.5, 3, 4.2, 5];
  it("eksponensial, pangkat, logaritmik mengembalikan hukum buatannya", () => {
    const e = fitRegression(xs.map((x) => ({ x, y: 1.7 * Math.exp(0.42 * x) })), "eksponensial")!;
    rel(e.coeffs[0], 1.7, 1e-10);
    rel(e.coeffs[1], 0.42, 1e-10);
    const p = fitRegression(xs.map((x) => ({ x, y: 2.2 * Math.pow(x, 1.35) })), "pangkat")!;
    rel(p.coeffs[0], 2.2, 1e-10);
    rel(p.coeffs[1], 1.35, 1e-10);
    const l = fitRegression(xs.map((x) => ({ x, y: 3 + 0.8 * Math.log(x) })), "logaritmik")!;
    rel(l.coeffs[0], 3, 1e-10);
    rel(l.coeffs[1], 0.8, 1e-10);
  });

  it("R² eksponensial ditulis seperti Excel, di ruang ln y", () => {
    const d = [1, 2, 3, 4, 5, 6].map((x, i) => ({ x, y: Math.exp(0.5 * x) * (1 + (i % 2 ? 0.2 : -0.2)) }));
    const f = fitRegression(d, "eksponensial")!;
    assert.notEqual(f.r2Excel, f.r2);
    const ly = d.map((p) => Math.log(p.y));
    const m = ly.reduce((a, b) => a + b, 0) / ly.length;
    const res = d.reduce((s, p, i) => s + (ly[i] - Math.log(f.predict!(p.x))) ** 2, 0);
    const tot = ly.reduce((s, v) => s + (v - m) ** 2, 0);
    rel(f.r2Excel!, 1 - res / tot, 1e-12);
  });

  it("rata-rata bergerak seperti Excel: kosong sebelum jendelanya penuh", () => {
    const d = [5, 1, 4, 2, 3].map((x) => ({ x, y: x * 10 }));
    const f = fitRegression(d, "rata-bergerak", 2, 3)!;
    assert.equal(f.maLine.length, 3);
    assert.deepEqual(f.maLine[0], { x: 3, y: 20 });
    assert.deepEqual(f.maLine[2], { x: 5, y: 40 });
  });

  it("metrik hanya atas pasangan yang dipakai; yang dibuang dihitung", () => {
    const d = [{ x: 0, y: 1 }, { x: -1, y: 2 }, ...xs.map((x) => ({ x, y: 2 * Math.pow(x, 1.5) }))];
    const f = fitRegression(d, "pangkat")!;
    assert.equal(f.dropped, 2);
    assert.equal(f.n, xs.length);
    rel(f.r2!, 1, 1e-12);
  });

  it("y yang semuanya sama: R² tidak terdefinisi, bukan tak hingga negatif", () => {
    const f = fitRegression([1, 2, 3].map((x) => ({ x, y: 4 })), "linear")!;
    assert.equal(f.r2, null);
  });
});

describe("HY-05 polinomial derajat tinggi pada data contoh cl42", () => {
  it("rumus yang ditulis sama dengan kurva yang digambar, derajat 2 sampai 6", () => {
    for (let d = 2; d <= 6; d++) {
      const f = fitRegression(SAMPLE_REGRESSION, "polinomial", d)!;
      for (const x of [33262.03, 80000, 133181.13])
        rel(formulaValue(f, x), f.predict!(x), 1e-7, `derajat ${d} x ${x}`);
    }
  });
  it("R² tidak pernah turun ketika derajatnya dinaikkan", () => {
    let sebelum = -Infinity;
    for (let d = 1; d <= 6; d++) {
      const r2 = fitRegression(SAMPLE_REGRESSION, "polinomial", d)!.r2!;
      assert.ok(r2 >= sebelum - 1e-12, `derajat ${d}: ${r2} < ${sebelum}`);
      sebelum = r2;
    }
  });
});

import { checksRegression } from "./checksRegression.ts";
import { evaluate } from "./verify.ts";

describe("Blok verifikasi HY-05 lolos di seluruh pilihan", () => {
  it("keenam bentuk, derajat 1 sampai 6, jendela 2 sampai 10, data contoh dan data janggal", () => {
    const himpunan: XY[][] = [
      SAMPLE_REGRESSION,
      SAMPLE_REGRESSION.slice(0, 3),
      [{ x: -2, y: 3 }, { x: 0, y: 0 }, { x: 1, y: -1 }, { x: 2, y: 5 }, { x: 4, y: 7 }, { x: 5, y: 2 }],
      [3, 1, 2, 5, 4].map((x) => ({ x, y: 7 })),
      [{ x: 1, y: 1 }],
    ];
    const kinds = ["linear", "polinomial", "eksponensial", "pangkat", "logaritmik", "rata-bergerak"] as const;
    for (const d of himpunan)
      for (const k of kinds)
        for (const deg of [1, 2, 4, 6])
          for (const w of [2, 3, 10])
            for (const c of checksRegression(d, k, deg, w)) {
              const r = evaluate(c);
              assert.ok(r.pass, `${k} deg ${deg} w ${w} n=${d.length} | ${c.label.id}: acuan ${c.expected}, hitungan ${c.actual}`);
            }
  });
});
