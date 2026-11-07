import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { kisi, nilaiJawab, type Soal } from "./kuis.ts";
import { BANK_KUIS } from "../data/kuis/index.ts";
import { G, linearWave } from "./hydraulics.ts";

/**
 * Bank FP-03 Gelombang linear (KUIS.md + revisi insinyur 1 November):
 * kunci = keluaran linearWave(T, h, H), masukan di kisi penggeser lembar,
 * margin pita h/L (batas 1/20 dan 1/2, Dean & Dalrymple 1991 Tab. 3.1).
 */

const BENIH = 1000;
const P = {
  T: { min: 1, max: 60, step: 0.5 },
  h: { min: 0.5, max: 500, step: 0.5 },
  H: { min: 0.1, max: 6, step: 0.1 },
};
const diKisi = (v: number, p: { min: number; max: number; step: number }) =>
  v >= p.min - 1e-12 && v <= p.max + 1e-12 && Math.abs(v / p.step - Math.round(v / p.step)) < 1e-9;
const gel = (k: Record<string, number>) => linearWave(k.T, k.h, k.H);

describe(`FP-03 gelombang linear: kunci dari lib, ${BENIH} benih`, () => {
  const bank = BANK_KUIS["FP-03"];
  it("bank terdaftar dengan lima butir", () => {
    assert.ok(bank, "FP-03 belum terdaftar di BANK_KUIS");
    assert.equal(bank.jumlah, 5);
  });
  const semua: Soal[][] = [];
  for (let b = 1; b <= BENIH; b++) semua.push(bank ? bank.buat(b) : []);
  const soal = (i: number, id: string) => semua[i].find((q) => q.id === id)!;

  it("masukan tiap soal ada di kisi penggeser dan gelombangnya tidak pecah", () => {
    for (const ss of semua)
      for (const q of ss) {
        const m = q.jenis === "atur" ? { ...q.siapkan, ...q.tetap } : q.masukan!;
        assert.ok(m, q.id);
        for (const k of ["T", "h", "H"] as const) assert.ok(diKisi(m[k], P[k]), `${q.id} ${k} ${m[k]}`);
        assert.equal(gel(m).breaking, false, `${q.id} pecah`);
      }
  });

  it("B1: kunci = linearWave().regime, h/L di luar [0,04; 0,06] dan [0,40; 0,60]; ketiga rezim muncul", () => {
    const kena = new Map<string, number>();
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "fp03-1");
      if (q.jenis !== "pilih") assert.fail("jenis");
      const w = gel(q.masukan!);
      assert.equal(q.kunci, w.regime);
      const r = w.relativeDepth;
      assert.ok(!(r >= 0.04 && r <= 0.06) && !(r >= 0.4 && r <= 0.6), `h/L ${r}`);
      assert.ok(q.tanya.id.includes("h/L") && q.tanya.en.includes("h/L"));
      kena.set(q.kunci, (kena.get(q.kunci) ?? 0) + 1);
    }
    assert.equal(kena.size, 3);
    for (const [k, n] of kena) assert.ok(n >= 250, `${k} hanya ${n}`);
  });

  it("B2: kunci = .length di kedalaman menengah, tol 2 %, L₀ dan T√(gh) berbeda > 5 %", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "fp03-2");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const w = gel(q.masukan!);
      assert.equal(w.regime, "menengah");
      assert.equal(q.kunci, w.length);
      assert.ok(Math.abs(q.toleransi - 0.02 * w.length) < 1e-12);
      const { T, h } = q.masukan!;
      assert.ok(Math.abs(w.deepLength / w.length - 1) > 0.05);
      assert.ok(Math.abs((T * Math.sqrt(G * h)) / w.length - 1) > 0.05);
    }
  });

  it("B3: kunci = .celerity, tol 2 %", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "fp03-3");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const w = gel(q.masukan!);
      assert.equal(q.kunci, w.celerity);
      assert.ok(Math.abs(q.toleransi - 0.02 * w.celerity) < 1e-12);
    }
  });

  it("B4: tebak T ×2; air dalam bila h ≥ g(2T)²/(4π), kunci dari rasio celerity lib", () => {
    let dalam = 0;
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "fp03-4");
      if (q.jenis !== "tebak") assert.fail("jenis");
      const m = q.masukan!;
      assert.ok(2 * m.T <= 60);
      const rasio = gel({ ...m, T: 2 * m.T }).celerity / gel(m).celerity;
      if (q.kunci === "dua") {
        dalam++;
        assert.ok(m.h >= (G * (2 * m.T) ** 2) / (4 * Math.PI), `h ${m.h} T ${m.T}`);
        assert.ok(rasio > 1.9, String(rasio));
      } else {
        assert.equal(q.kunci, "tetap");
        assert.equal(gel(m).regime, "dangkal");
        assert.ok(rasio < 1.1, String(rasio));
      }
      assert.equal(gel({ ...m, T: 2 * m.T }).breaking, false);
    }
    assert.ok(dalam > 300 && dalam < 700, `air dalam ${dalam}`);
  });

  it("B5: atur h sampai h/L ∈ [0,5; 0,6], T ∈ [3,5; 22] s tetap, sasaran diterima di seluruh kisi h", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "fp03-5");
      if (q.jenis !== "atur") assert.fail("jenis");
      assert.deepEqual(q.target, { min: 0.5, max: 0.6 });
      assert.equal(q.geser.kunci, "h");
      const tetap = q.tetap!;
      assert.ok(tetap.T >= 3.5 && tetap.T <= 22);
      let n = 0;
      for (const h of kisi(q.geser.p)) {
        const r: number = gel({ ...tetap, h }).relativeDepth;
        const di: boolean = r >= 0.5 && r <= 0.6;
        if (di) n++;
        assert.equal(nilaiJawab(q, 0, { ...tetap, h }).benar, di);
      }
      assert.ok(n >= 3);
    }
  });
});
