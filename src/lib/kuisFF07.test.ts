import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { kisi, nilaiJawab, type Soal } from "./kuis.ts";
import { BANK_KUIS } from "../data/kuis/index.ts";
import { G, acceleration } from "./hydraulics.ts";

/**
 * Bank FF-07 Percepatan aliran (KUIS.md + revisi insinyur 1 November):
 * kunci = keluaran acceleration() dengan D₁ 0,2 m dan L 0,5 m seperti lembar,
 * masukan di kisi penggeser (Q₀ dalam l/s dan D₂ dalam mm, satuan penggeser).
 */

const BENIH = 1000;
const P = {
  Q: { min: 5, max: 500, step: 5 },
  s: { min: 0, max: 0.9, step: 0.05 },
  w: { min: 0, max: 10, step: 0.25 },
  D2: { min: 30, max: 200, step: 5 },
  x: { min: 0, max: 0.5, step: 0.01 },
  t: { min: 0, max: 6, step: 0.05 },
};
const diKisi = (v: number, p: { min: number; max: number; step: number }) =>
  v >= p.min - 1e-12 && v <= p.max + 1e-12 && Math.abs(v / p.step - Math.round(v / p.step)) < 1e-9;
const aks = (k: Record<string, number>) => acceleration(k.Q / 1000, k.s, k.w, 0.2, k.D2 / 1000, 0.5, k.x, k.t);

describe(`FF-07 percepatan aliran: kunci dari lib, ${BENIH} benih`, () => {
  const bank = BANK_KUIS["FF-07"];
  it("bank terdaftar dengan lima butir", () => {
    assert.ok(bank, "FF-07 belum terdaftar di BANK_KUIS");
    assert.equal(bank.jumlah, 5);
  });
  const semua: Soal[][] = [];
  for (let b = 1; b <= BENIH; b++) semua.push(bank ? bank.buat(b) : []);
  const soal = (i: number, id: string) => semua[i].find((q) => q.id === id)!;
  const SET = (p: unknown) => (p as { set: Record<string, number> }).set;

  it("masukan tiap soal (dan set pilihan B1) ada di kisi penggeser lembar", () => {
    for (const ss of semua)
      for (const q of ss) {
        const ms = [q.jenis === "atur" ? { ...q.siapkan, ...q.tetap } : q.masukan!];
        if (q.id === "ff07-1" && q.jenis === "pilih") ms.push(...q.pilihan.map(SET));
        for (const m of ms) {
          assert.ok(m, q.id);
          for (const k of Object.keys(P) as (keyof typeof P)[])
            assert.ok(diKisi(m[k], P[k]), `${q.id} ${k} ${m[k]}`);
        }
      }
  });

  it("B1: kunci = satu-satunya set tunak (lokal nol di setiap saat); pengecoh cos ωt ≈ 0 dan D₂ = D₁ ada", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "ff07-1");
      if (q.jenis !== "pilih") assert.fail("jenis");
      assert.equal(aks(q.masukan!).steady, true);
      let cosNol = 0, lurus = 0;
      for (const p of q.pilihan) {
        const m = SET(p);
        const a = aks(m);
        if (p.id === q.kunci) assert.equal(a.steady, true);
        else {
          assert.equal(a.steady, false);
          if (Math.abs(Math.cos(m.w * m.t)) < 0.05) cosNol++;
          else assert.ok(Math.abs(a.local) > 0.05, `lokal ${a.local}`);
          if (m.D2 === 200) {
            lurus++;
            assert.ok(Math.abs(a.convective) < 1e-9);
          }
        }
      }
      assert.equal(cosNol, 1, "satu pengecoh cos ωt ≈ 0");
      assert.equal(lurus, 1, "satu pengecoh D₂ = 200 mm");
    }
  });

  it("B2: kunci = konvektif tunak acceleration(Q₀, 0, …), x ≥ 0,15 m, tol 2 %", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "ff07-2");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const m = q.masukan!;
      assert.equal(m.s, 0);
      assert.ok(m.x >= 0.15 && m.D2 < 200);
      assert.equal(q.kunci, aks(m).convective);
      assert.ok(Math.abs(q.toleransi - 0.02 * q.kunci) < 1e-12);
    }
  });

  it("B3: kunci = lokal acceleration(), |cos ωt| > 0,2, tol 2 %", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "ff07-3");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const m = q.masukan!;
      assert.ok(Math.abs(Math.cos(m.w * m.t)) > 0.2);
      assert.equal(q.kunci, aks(m).local);
      assert.ok(Math.abs(q.toleransi - 0.02 * Math.abs(q.kunci)) < 1e-12);
    }
  });

  it("B4: kunci = rasio total Q₀ ×2 dari lib; cos ωt > 0, D₂ < D₁, bagian konvektif 0,2–0,8", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "ff07-4");
      if (q.jenis !== "pilih") assert.fail("jenis");
      const m = q.masukan!;
      assert.ok(Math.cos(m.w * m.t) > 0 && m.D2 < 200);
      const a = aks(m);
      assert.ok(a.convectiveShare >= 0.2 && a.convectiveShare <= 0.8, String(a.convectiveShare));
      const rasio = aks({ ...m, Q: 2 * m.Q }).total / a.total;
      const k = q.pilihan.find((p) => p.id === q.kunci)!;
      assert.ok(k.teks.id.includes(rasio.toFixed(2).replace(".", ",")), `${k.teks.id} vs ${rasio}`);
    }
  });

  it("B5: atur D₂, sasaran a/g diterima di seluruh kisi D₂, awal di luar", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "ff07-5");
      if (q.jenis !== "atur") assert.fail("jenis");
      assert.equal(q.geser.kunci, "D2");
      const tetap = q.tetap!;
      for (const D2 of kisi(q.geser.p)) {
        const g: number = aks({ ...tetap, D2 }).total / G;
        const dalam: boolean = g >= q.target.min && g <= q.target.max;
        assert.equal(nilaiJawab(q, 0, { ...tetap, D2 }).benar, dalam, `D2 ${D2}`);
      }
    }
  });
});
