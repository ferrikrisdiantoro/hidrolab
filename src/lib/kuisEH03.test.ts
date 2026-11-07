import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { kisi, nilaiJawab, type Soal } from "./kuis.ts";
import { BANK_KUIS } from "../data/kuis/index.ts";
import { FISHWAY_POWER_GENERAL, G, cascadePassage } from "./hydraulics.ts";

/**
 * Bank EH-03 Lintasan ikan bertingkat (KUIS.md + revisi insinyur 1 November):
 * kunci = keluaran cascadePassage dengan masukan di kisi penggeser lembar.
 * B4 diganti: ε = ρgQΔh/(LBy) = .powerDensity, banding 150 W/m³ (Larinier
 * 2002); tidak ada cascadeOverallPassage.
 */

const BENIH = 1000;
const P = {
  H: { min: 0.3, max: 12, step: 0.1 },
  N: { min: 2, max: 60, step: 1 },
  L: { min: 1, max: 8, step: 0.2 },
  B: { min: 0.8, max: 8, step: 0.2 },
  y: { min: 0.1, max: 3, step: 0.05 },
  Q: { min: 0.02, max: 5, step: 0.02 },
  Ub: { min: 0.5, max: 6, step: 0.1 },
};
const diKisi = (v: number, p: { min: number; max: number; step: number }) =>
  v >= p.min - 1e-12 && v <= p.max + 1e-12 && Math.abs(v / p.step - Math.round(v / p.step)) < 1e-9;
const lintas = (k: Record<string, number>) => cascadePassage(k.H, k.N, k.L, k.B, k.y, k.Q, k.Ub);

describe("EH-03 angka acuan insinyur", () => {
  it("H 3, N 10, L 2, B 1,5, y 0,6, Q 0,1 → ε 163,5 W/m³", () => {
    const r = cascadePassage(3, 10, 2, 1.5, 0.6, 0.1, 2.5);
    assert.ok(Math.abs(r.powerDensity - 163.5) < 0.05, String(r.powerDensity));
  });
});

describe(`EH-03 lintasan bertingkat: kunci dari lib, ${BENIH} benih`, () => {
  const bank = BANK_KUIS["EH-03"];
  it("bank terdaftar dengan lima butir", () => {
    assert.ok(bank, "EH-03 belum terdaftar di BANK_KUIS");
    assert.equal(bank.jumlah, 5);
  });
  const semua: Soal[][] = [];
  for (let b = 1; b <= BENIH; b++) semua.push(bank ? bank.buat(b) : []);
  const soal = (i: number, id: string) => semua[i].find((q) => q.id === id)!;

  it("masukan tiap soal lengkap dan ada di kisi penggeser lembar", () => {
    for (const ss of semua)
      for (const q of ss) {
        const ms = q.jenis === "atur" ? [{ ...q.siapkan, ...q.tetap }] : [q.masukan!];
        for (const m of ms) {
          assert.ok(m, q.id);
          for (const k of Object.keys(P) as (keyof typeof P)[])
            assert.ok(diKisi(m[k], P[k]), `${q.id} ${k} ${m[k]}`);
        }
      }
  });

  it("B1: kunci = .requiredBurst = √(2gH/N), tol 2 %", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "eh03-1");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const r = lintas(q.masukan!);
      assert.equal(q.kunci, r.requiredBurst);
      assert.ok(Math.abs(r.requiredBurst - Math.sqrt((2 * G * q.masukan!.H) / q.masukan!.N)) < 1e-9);
      assert.ok(Math.abs(q.toleransi - 0.02 * r.requiredBurst) < 1e-12);
    }
  });

  it("B2: atur N paling sedikit; sasaran [Nmin; Nmin+1], Nmin dari telusur kisi !tooHigh && !poolTooShallow", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "eh03-2");
      if (q.jenis !== "atur") assert.fail("jenis");
      assert.equal(q.geser.kunci, "N");
      const tetap = q.tetap!;
      const sah = kisi(q.geser.p).filter((N) => {
        const r = lintas({ ...tetap, N });
        return !r.tooHigh && !r.poolTooShallow;
      });
      const Nmin = sah[0];
      assert.ok(Nmin !== undefined && Nmin + 1 <= 60);
      assert.deepEqual(q.target, { min: Nmin, max: Nmin + 1 });
      for (const N of kisi(q.geser.p))
        assert.equal(nilaiJawab(q, 0, { ...tetap, N }).benar, N === Nmin || N === Nmin + 1, `N ${N}`);
      const awal = lintas({ ...q.siapkan!, ...tetap });
      assert.ok(awal.tooHigh || awal.poolTooShallow, "awal sudah sah");
    }
  });

  it("B3: Q ×2 tidak mengubah tooHigh, ε berlipat dua; 2Q di kisi", () => {
    let tinggi = 0;
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "eh03-3");
      if (q.jenis !== "pilih") assert.fail("jenis");
      const m = { ...q.masukan!, Q: q.masukan!.Q / 2 };
      assert.ok(diKisi(m.Q, P.Q));
      const r1 = lintas(m), r2 = lintas(q.masukan!);
      assert.equal(r1.tooHigh, r2.tooHigh);
      assert.ok(Math.abs(r2.powerDensity / r1.powerDensity - 2) < 1e-9);
      assert.equal(q.kunci, "tetap");
      if (r1.tooHigh) tinggi++;
      assert.ok(q.bahas.id.includes("ε") && q.bahas.en.includes("ε"));
    }
    assert.ok(tinggi > 300 && tinggi < 700, `terlalu tinggi ${tinggi}`);
  });

  it("B4: kunci = .powerDensity, tol 2 %, pengecoh H ganti Δh, tanpa y, tanpa g; bahas membandingkan 150", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "eh03-4");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const m = q.masukan!;
      const r = lintas(m);
      assert.equal(q.kunci, r.powerDensity);
      assert.ok(Math.abs(q.toleransi - 0.02 * r.powerDensity) < 1e-12);
      const pakaiH = r.powerDensity * m.N;
      const tanpaY = r.powerDensity * m.y;
      const tanpaG = r.powerDensity / G;
      for (const k of q.kesalahan ?? [])
        assert.ok([pakaiH, tanpaY, tanpaG].some((v) => Math.abs(v - k.nilai) < 1e-9), String(k.nilai));
      assert.ok((q.kesalahan ?? []).length >= 2);
      assert.ok(q.bahas.id.includes(String(FISHWAY_POWER_GENERAL)) && q.bahas.en.includes(String(FISHWAY_POWER_GENERAL)));
    }
  });

  it("B5: N naik → Δz dan u turun, lintasan N·L memanjang", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "eh03-5");
      if (q.jenis !== "pilih") assert.fail("jenis");
      assert.equal(q.kunci, "turun-panjang");
    }
  });
});
