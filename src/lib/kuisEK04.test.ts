import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { kisi, nilaiJawab, type Soal } from "./kuis.ts";
import { BANK_KUIS } from "../data/kuis/index.ts";
import { fishPassage } from "./hydraulics.ts";

/**
 * Bank EK-04 Lintasan ikan dan populasi (KUIS.md + revisi insinyur
 * 1 November): kunci = keluaran fishPassage dengan p dalam persen seperti
 * penggeser lembar. B2 pmin = p bulat terkecil dengan !extinct (telusur
 * 0..100), sasaran [pmin; pmin+2]; B4 r·p ≥ 1,2 d.
 */

const BENIH = 1000;
const P = {
  N0: { min: 100, max: 20000, step: 100 },
  K: { min: 500, max: 50000, step: 500 },
  r: { min: 0.05, max: 2, step: 0.05 },
  d: { min: 0.02, max: 1, step: 0.02 },
  p: { min: 0, max: 100, step: 1 },
};
const diKisi = (v: number, p: { min: number; max: number; step: number }) =>
  v >= p.min - 1e-12 && v <= p.max + 1e-12 && Math.abs(v / p.step - Math.round(v / p.step)) < 1e-9;
/** Panggilan yang sama dengan lembar: p penggeser dalam persen, 60 tahun. */
const popLembar = (k: Record<string, number>) => fishPassage(k.N0, k.K, k.r, k.d, k.p / 100);
/** Tanpa lintasan tahunan (years = 0), seperti pembangkit; disamakan di bawah. */
const pop = (k: Record<string, number>) => fishPassage(k.N0, k.K, k.r, k.d, k.p / 100, 0);

describe(`EK-04 lintasan ikan dan populasi: kunci dari lib, ${BENIH} benih`, () => {
  const bank = BANK_KUIS["EK-04"];
  it("bank terdaftar dengan lima butir", () => {
    assert.ok(bank, "EK-04 belum terdaftar di BANK_KUIS");
    assert.equal(bank.jumlah, 5);
  });
  const semua: Soal[][] = [];
  for (let b = 1; b <= BENIH; b++) semua.push(bank ? bank.buat(b) : []);
  const soal = (i: number, id: string) => semua[i].find((q) => q.id === id)!;

  it("years = 0 memberi extinct, criticalPassage, equilibrium yang sama dengan panggilan lembar (200 benih)", () => {
    for (const ss of semua.slice(0, 200))
      for (const q of ss) {
        const m = q.jenis === "atur" ? { ...q.siapkan, ...q.tetap } : q.masukan!;
        const a = pop(m), b = popLembar(m);
        assert.equal(a.extinct, b.extinct);
        assert.equal(a.criticalPassage, b.criticalPassage);
        assert.equal(a.equilibrium, b.equilibrium);
      }
  });

  it("masukan tiap soal lengkap dan ada di kisi penggeser lembar; tidak tanpa harapan", () => {
    for (const ss of semua)
      for (const q of ss) {
        const m = q.jenis === "atur" ? { ...q.siapkan, ...q.tetap } : q.masukan!;
        assert.ok(m, q.id);
        for (const k of Object.keys(P) as (keyof typeof P)[]) assert.ok(diKisi(m[k], P[k]), `${q.id} ${k} ${m[k]}`);
        assert.equal(pop(m).hopeless, false, q.id);
      }
  });

  it("B1: kunci = criticalPassage·100, d/r ∈ [0,1; 0,9], tol 0,5 poin", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "ek04-1");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const m = q.masukan!;
      assert.equal(q.kunci, pop(m).criticalPassage * 100);
      assert.ok(m.d / m.r >= 0.1 - 1e-12 && m.d / m.r <= 0.9 + 1e-12);
      assert.equal(q.toleransi, 0.5);
    }
  });

  it("B2: sasaran [pmin; pmin+2], pmin = p bulat terkecil dengan !extinct menurut lib", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "ek04-2");
      if (q.jenis !== "atur") assert.fail("jenis");
      assert.equal(q.geser.kunci, "p");
      const tetap = q.tetap!;
      // Telusur dengan years = 0 (extinct tidak bergantung pada lintasannya),
      // lalu batasnya dicek ulang dengan panggilan lembar yang lengkap.
      const pmin = kisi(q.geser.p).find((p) => !fishPassage(tetap.N0, tetap.K, tetap.r, tetap.d, p / 100, 0).extinct);
      assert.ok(pmin !== undefined && pmin >= 1 && pmin + 2 <= 100);
      const cek = i < 100 ? popLembar : pop;
      assert.equal(cek({ ...tetap, p: pmin }).extinct, false);
      assert.equal(cek({ ...tetap, p: pmin - 1 }).extinct, true);
      assert.deepEqual(q.target, { min: pmin, max: pmin + 2 });
      for (const p of kisi(q.geser.p))
        assert.equal(nilaiJawab(q, 0, { ...tetap, p }).benar, p >= pmin && p <= pmin + 2, `p ${p}`);
      assert.equal(pop({ ...q.siapkan!, ...tetap }).extinct, true, "awal sudah lestari");
    }
  });

  it("B2: ambang 100·d/r tidak pernah bilangan bulat; pmin = ⌊100·d/r⌋ + 1 secara eksak", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "ek04-2");
      if (q.jenis !== "atur") assert.fail("jenis");
      const t = q.tetap!;
      const a = (100 * t.d) / t.r;
      assert.ok(Math.abs(a - Math.round(a)) >= 1e-9, `benih ${i + 1}: ambang bulat ${a}`);
      assert.equal(q.target!.min, Math.floor(a) + 1, `benih ${i + 1}`);
    }
  });

  it("B2: benih pemicu 29, 140, 150 tidak lagi memakai ambang bulat (r 1,55 d 0,62; r 1,25 d 0,7; r 1,6 d 0,32)", () => {
    for (const b of [29, 140, 150]) {
      const q = bank.buat(b).find((s) => s.id === "ek04-2")!;
      if (q.jenis !== "atur") assert.fail("jenis");
      const t = q.tetap!;
      const a = (100 * t.d) / t.r;
      assert.ok(Math.abs(a - Math.round(a)) >= 1e-9, `benih ${b}: r ${t.r} d ${t.d}`);
      assert.equal(q.target!.min, Math.floor(a) + 1);
    }
  });

  it("B3: kunci = extinct, margin |r·p − d| > 0,05 d; kedua jawaban muncul", () => {
    let punah = 0;
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "ek04-3");
      if (q.jenis !== "pilih") assert.fail("jenis");
      const m = q.masukan!;
      const ex = pop(m).extinct;
      assert.equal(q.kunci, ex ? "punah" : "lestari");
      assert.ok(Math.abs((m.r * m.p) / 100 - m.d) > 0.05 * m.d);
      if (ex) punah++;
    }
    assert.ok(punah > 300 && punah < 700, `punah ${punah}`);
  });

  it("B4: kunci = .equilibrium, tol 1 %, r·p ≥ 1,2 d", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "ek04-4");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const m = q.masukan!;
      const r = pop(m);
      assert.equal(q.kunci, r.equilibrium);
      // Di bawah 1000: kotak jawaban tidak membaca pemisah ribuan.
      assert.ok(q.kunci >= 100 && q.kunci < 999.5, String(q.kunci));
      assert.ok((m.r * m.p) / 100 >= 1.2 * m.d - 1e-12);
      assert.ok(Math.abs(q.toleransi - 0.01 * r.equilibrium) < 1e-9);
    }
  });

  it("B5: tebak N₀ ×2 → N* tetap", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "ek04-5");
      if (q.jenis !== "tebak") assert.fail("jenis");
      const m = q.masukan!;
      assert.equal(q.kunci, "tetap");
      assert.ok(diKisi(m.N0 / 2, P.N0));
      assert.equal(pop(m).equilibrium, pop({ ...m, N0: m.N0 / 2 }).equilibrium);
      assert.equal(pop(m).extinct, false);
    }
  });
});
