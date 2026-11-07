import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { kisi, nilaiJawab, type Soal } from "./kuis.ts";
import { BANK_KUIS } from "../data/kuis/index.ts";
import { CASAGRANDE_ENTRY, seepageLine } from "./hydraulics.ts";
import { gw01Kasus2 } from "../data/kuis/gw01.ts";

/**
 * Bank GW-01 Rembesan (KUIS.md + revisi insinyur 1 November): kunci =
 * keluaran seepageLine dengan panggilan yang sama dengan lembar (lebar mercu
 * 6 m, k dalam µm/s, kh = k·√a, kv = k/√a). B4 lama (gradien keluar)
 * dibuang; penggantinya kh/kv naik pada k tetap → q naik, kh/kv ≤ 9.
 */

const BENIH = 1000;
const CREST = 6;
const P = {
  H: { min: 1, max: 20, step: 0.5 },
  Hd: { min: 4, max: 24, step: 0.5 },
  mu: { min: 1.5, max: 5, step: 0.25 },
  md: { min: 1.5, max: 4, step: 0.25 },
  Ld: { min: 0, max: 30, step: 0.5 },
  k: { min: 0.05, max: 20, step: 0.05 },
  a: { min: 1, max: 25, step: 0.5 },
};
const diKisi = (v: number, p: { min: number; max: number; step: number }) =>
  v >= p.min - 1e-12 && v <= p.max + 1e-12 && Math.abs(v / p.step - Math.round(v / p.step)) < 1e-9;
const rembes = (m: Record<string, number>) => {
  const kEq = m.k * 1e-6;
  return seepageLine(Math.min(m.H, m.Hd), m.Hd, CREST, m.mu, m.md, m.Ld, kEq * Math.sqrt(m.a), kEq / Math.sqrt(m.a));
};

describe("GW-01 angka acuan insinyur", () => {
  it("kh/kv 1, 4, 9 pada k tetap → 71,6 / 138,9 / 199,1 l/hari/m (H 8, Hd 12, mu 3, md 2,5, Ld 17, k 1)", () => {
    const q = [1, 4, 9].map((a) => rembes({ H: 8, Hd: 12, mu: 3, md: 2.5, Ld: 17, k: 1, a }).qLitreDay);
    assert.deepEqual(q.map((v) => v.toFixed(1)), ["71.6", "138.9", "199.1"]);
  });
});

describe(`GW-01 rembesan: kunci dari lib, ${BENIH} benih`, () => {
  const bank = BANK_KUIS["GW-01"];
  it("bank terdaftar dengan empat butir", () => {
    assert.ok(bank, "GW-01 belum terdaftar di BANK_KUIS");
    assert.equal(bank.jumlah, 4);
  });
  const semua: Soal[][] = [];
  for (let b = 1; b <= BENIH; b++) semua.push(bank ? bank.buat(b) : []);
  const soal = (i: number, id: string) => semua[i].find((q) => q.id === id)!;

  it("masukan tiap soal lengkap, di kisi penggeser, H < Hd, valid", () => {
    for (const ss of semua)
      for (const q of ss) {
        const m = q.jenis === "atur" ? { ...q.siapkan, ...q.tetap } : q.masukan!;
        assert.ok(m, q.id);
        for (const k of Object.keys(P) as (keyof typeof P)[]) assert.ok(diKisi(m[k], P[k]), `${q.id} ${k} ${m[k]}`);
        assert.ok(m.H < m.Hd, q.id);
        assert.equal(rembes(m).valid, true, q.id);
        assert.ok(m.a <= 9, q.id);
      }
  });

  it("B1: kunci = .qLitreDay, tol 2 %; pengecoh tanpa koreksi 0,3·mu·H dan lupa konversi liter", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "gw01-1");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const m = q.masukan!;
      const r = rembes(m);
      assert.equal(q.kunci, r.qLitreDay);
      assert.ok(q.kunci < 999.95, "tanpa pemisah ribuan");
      assert.equal(r.daylights, false);
      assert.ok(Math.abs(q.toleransi - 0.02 * r.qLitreDay) < 1e-12);
      // Tanpa koreksi Casagrande: titik masuk di mu·H, bukan (1 − 0,3)·mu·H.
      const dd = (r.focus - m.mu * m.H) * r.squeeze;
      const tanpa = r.kEq * (Math.sqrt(dd * dd + m.H * m.H) - dd) * 1000 * 86400;
      assert.ok(CASAGRANDE_ENTRY === 0.3);
      const nilai = (q.kesalahan ?? []).map((k) => k.nilai);
      assert.ok(nilai.some((v) => Math.abs(v - tanpa) < 1e-9), "pengecoh tanpa koreksi");
      assert.ok(nilai.some((v) => Math.abs(v - r.q * 86400) < 1e-12), "pengecoh lupa liter");
    }
  });

  it("B2: drainase diperpanjang → q naik (lib), keduanya tidak keluar lereng", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "gw01-2");
      if (q.jenis !== "pilih") assert.fail("jenis");
      assert.equal(q.kunci, "naik");
      const { m, Ld2 } = gw01Kasus2(i + 1);
      assert.deepEqual(q.masukan, { ...m, Ld: Ld2 });
      assert.ok(Ld2 > m.Ld && diKisi(Ld2, P.Ld));
      const r1 = rembes(m), r2 = rembes({ ...m, Ld: Ld2 });
      assert.equal(r1.daylights, false);
      assert.equal(r2.daylights, false);
      assert.ok(r2.q > r1.q * 1.01, `${r1.q} → ${r2.q}`);
    }
  });

  it("B3: atur Ld; sasaran [drainNeeded; drainNeeded + 1], drainNeeded ≤ 29, Ld < md·Hd; awal keluar lereng", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "gw01-3");
      if (q.jenis !== "atur") assert.fail("jenis");
      assert.equal(q.geser.kunci, "Ld");
      const tetap = q.tetap!;
      const r0 = rembes({ ...q.siapkan!, ...tetap });
      assert.equal(r0.daylights, true, "awal tidak keluar");
      assert.ok(r0.drainNeeded <= 29);
      assert.ok(Math.abs(q.target.min - r0.drainNeeded) < 1e-12);
      assert.ok(Math.abs(q.target.max - (r0.drainNeeded + 1)) < 1e-12);
      assert.ok(q.target.max < tetap.md * tetap.Hd);
      let n = 0;
      for (const Ld of kisi(q.geser.p)) {
        const benar = nilaiJawab(q, 0, { ...tetap, Ld }).benar;
        if (benar) {
          n++;
          const r = rembes({ ...tetap, Ld });
          assert.equal(r.daylights, false, `Ld ${Ld} keluar`);
          assert.equal(r.valid, true);
        }
      }
      assert.ok(n >= 2);
    }
  });

  it("B4: k tetap, kh/kv naik dari 1 ke ≤ 9 → q naik (lib)", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "gw01-4");
      if (q.jenis !== "pilih") assert.fail("jenis");
      assert.equal(q.kunci, "naik");
      const m2 = q.masukan!;
      assert.ok(m2.a > 1 && m2.a <= 9);
      const r1 = rembes({ ...m2, a: 1 }), r2 = rembes(m2);
      assert.ok(r2.q > r1.q * 1.05, `${r1.q} → ${r2.q}`);
      assert.ok(Math.abs(r1.kEq / r2.kEq - 1) < 1e-12);
    }
  });
});
