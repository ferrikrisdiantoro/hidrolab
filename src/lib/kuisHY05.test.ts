import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { kisi, nilaiJawab, type Soal } from "./kuis.ts";
import { BANK_KUIS } from "../data/kuis/index.ts";
import { dataSoal, sidikData } from "../data/kuis/dataSoal.ts";
import { fitRegression, formulaValue, type RegKind } from "./regression.ts";

/**
 * Bank HY-05 Regresi (KUIS.md putaran 2 + revisi insinyur 1 November):
 * kunci = fitRegression/formulaValue pada data soal yang DIMUAT ke tabel.
 * Derajat 1 berarti garis lurus (bentuk linear lembar), 2–6 polinomial.
 */

const BENIH = 1000;
const KINDS: RegKind[] = ["linear", "polinomial", "eksponensial", "pangkat", "logaritmik", "rata-bergerak"];
const r2Derajat = (d: { x: number; y: number }[], deg: number) =>
  (deg === 1 ? fitRegression(d, "linear") : fitRegression(d, "polinomial", deg))!.r2!;

describe(`HY-05 regresi: kunci dari lib, ${BENIH} benih`, () => {
  const bank = BANK_KUIS["HY-05"];
  it("bank terdaftar dengan lima butir", () => {
    assert.ok(bank, "HY-05 belum terdaftar di BANK_KUIS");
    assert.equal(bank.jumlah, 5);
  });
  const semua: Soal[][] = [];
  for (let b = 1; b <= BENIH; b++) semua.push(bank ? bank.buat(b) : []);
  const soal = (i: number, id: string) => semua[i].find((q) => q.id === id)!;

  it("tiap soal membawa datanya, x unik, dan sidik di masukan/siapkan", () => {
    for (const ss of semua)
      for (const q of ss) {
        const d = dataSoal(q);
        assert.ok(d && d.length >= 5 && d.length <= 15, `${q.id} n ${d?.length}`);
        assert.equal(new Set(d.map((p) => p.x)).size, d.length);
        for (const p of d) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
        const m = q.jenis === "atur" ? q.siapkan! : q.masukan!;
        assert.equal(m.data, sidikData(d), `${q.id} sidik`);
      }
  });

  it("B1: R² linear > 0,85; kunci lengkung bila RMSE poli-2 < 0,6·RMSE linear, cukup bila > 0,9·", () => {
    const kena = new Map<string, number>();
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "hy05-1");
      if (q.jenis !== "tebak") assert.fail("jenis");
      const d = dataSoal(q)!;
      const lin = fitRegression(d, "linear")!;
      const p2 = fitRegression(d, "polinomial", 2)!;
      assert.ok(lin.r2! > 0.85, `R² ${lin.r2}`);
      const rasio = p2.rmse / lin.rmse;
      assert.ok(rasio < 0.6 || rasio > 0.9, `rasio ${rasio}`);
      assert.equal(q.kunci, rasio < 0.6 ? "lengkung" : "cukup");
      assert.equal(q.masukan!.deg, 2);
      kena.set(q.kunci, (kena.get(q.kunci) ?? 0) + 1);
    }
    for (const k of ["lengkung", "cukup"]) assert.ok((kena.get(k) ?? 0) > 300, `${k} ${kena.get(k)}`);
  });

  it("B2: kunci = bentuk terdekat ke y sebenarnya di 1,3·xMax, margin 5 %", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "hy05-2");
      if (q.jenis !== "pilih") assert.fail("jenis");
      const d = dataSoal(q)!;
      const xMax = Math.max(...d.map((p) => p.x));
      const xs = 1.3 * xMax;
      const benar = (q as Soal & { benar: (x: number) => number }).benar;
      const yT = benar(xs);
      const bentuk = ["linear", "polinomial", "eksponensial", "pangkat", "logaritmik"] as const;
      const galat = bentuk.map((k) => Math.abs(fitRegression(d, k, 2)!.predict!(xs) - yT));
      const urut = galat.slice().sort((a, b) => a - b);
      assert.ok(urut[1] - urut[0] >= 0.05 * Math.abs(yT), `margin ${galat} ${yT}`);
      assert.equal(q.kunci, bentuk[galat.indexOf(urut[0])]);
      const m = q.masukan!;
      if (q.kunci === "linear") assert.equal(m.deg, 1);
      else if (q.kunci === "polinomial") assert.equal(m.deg, 2);
      else assert.equal(KINDS[m.bentuk], q.kunci);
    }
  });

  it("B3: 5 titik bulat, kunci = R² linear ∈ [0,4; 0,92], tol 0,01; r, SSres/SStot, SSres/n sebagai kesalahan", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "hy05-3");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const d = dataSoal(q)!;
      assert.equal(d.length, 5);
      for (const p of d) assert.ok(Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x <= 12 && p.y <= 15);
      const f = fitRegression(d, "linear")!;
      assert.equal(q.kunci, f.r2);
      assert.ok(f.r2! >= 0.4 && f.r2! <= 0.92, `R² ${f.r2}`);
      assert.equal(q.toleransi, 0.01);
      assert.equal(q.masukan!.deg, 1);
      assert.ok((q.kesalahan ?? []).length >= 2, `kesalahan ${q.kesalahan?.length}`);
    }
  });

  it("B4: R²(degMin) ≥ target + 0,005 dan R²(degMin − 1) ≤ target − 0,005; degMin ∈ 2..4; dinilai di seluruh kisi derajat", () => {
    const kena = new Map<number, number>();
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "hy05-4");
      if (q.jenis !== "atur") assert.fail("jenis");
      const d = dataSoal(q)!;
      const T = q.target.min;
      assert.equal(q.target.max, 1);
      assert.equal(q.geser.kunci, "deg");
      assert.deepEqual(kisi(q.geser.p), [1, 2, 3, 4, 5, 6]);
      let degMin = 0;
      for (const deg of kisi(q.geser.p)) {
        const r2 = r2Derajat(d, deg);
        if (!degMin && r2 >= T) degMin = deg;
        assert.equal(nilaiJawab(q, 0, { ...q.siapkan, deg }).benar, r2 >= T, `deg ${deg}`);
      }
      assert.ok(degMin >= 2 && degMin <= 4, `degMin ${degMin}`);
      assert.ok(r2Derajat(d, degMin) >= T + 0.005 && r2Derajat(d, degMin - 1) <= T - 0.005);
      assert.equal(q.siapkan!.deg, 1);
      // Tabel berisi data lain: belum dijawab.
      assert.equal(nilaiJawab(q, 0, { ...q.siapkan, deg: 6, data: q.siapkan!.data + 1 }).benar, false);
      kena.set(degMin, (kena.get(degMin) ?? 0) + 1);
    }
    for (const d of [2, 3, 4]) assert.ok((kena.get(d) ?? 0) > 150, `degMin ${d}: ${kena.get(d)}`);
  });

  it("B5: kunci = formulaValue(fitRegression(data, linear), x), tol 1 %", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "hy05-5");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const d = dataSoal(q)!;
      const f = fitRegression(d, "linear")!;
      const x = (q as Soal & { x: number }).x;
      assert.equal(q.kunci, formulaValue(f, x));
      assert.ok(Math.abs(q.kunci) >= 1);
      assert.ok(Math.abs(q.toleransi - 0.01 * Math.abs(q.kunci)) < 1e-12);
      assert.equal(q.masukan!.deg, 1);
    }
  });
});
