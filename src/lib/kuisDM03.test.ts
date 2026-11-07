import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { kisi, nilaiJawab, type Soal } from "./kuis.ts";
import { BANK_KUIS } from "../data/kuis/index.ts";
import { rockfillFlow, waterViscosity } from "./hydraulics.ts";

/**
 * Bank DM-03 Drainase urugan batu (KUIS.md putaran 2; revisi insinyur:
 * LULUS apa adanya). Kunci = keluaran rockfillFlow(Δh/L, d, n, t) pada
 * 20 °C, panggilan yang sama dengan lembar.
 */

const BENIH = 1000;
const P = {
  dh: { min: 0.02, max: 20, step: 0.02 },
  L: { min: 1, max: 120, step: 1 },
  d: { min: 0.005, max: 1.2, step: 0.005 },
  n: { min: 0.2, max: 0.5, step: 0.01 },
  t: { min: 0.2, max: 30, step: 0.2 },
};
const diKisi = (v: number, p: { min: number; max: number; step: number }) =>
  v >= p.min - 1e-12 && v <= p.max + 1e-12 && Math.abs(v / p.step - Math.round(v / p.step)) < 1e-9;
const alir = (k: Record<string, number>) => rockfillFlow(k.dh / Math.max(k.L, 1e-6), k.d, k.n, k.t);

describe(`DM-03 drainase urugan batu: kunci dari lib, ${BENIH} benih`, () => {
  const bank = BANK_KUIS["DM-03"];
  it("bank terdaftar dengan lima butir", () => {
    assert.ok(bank, "DM-03 belum terdaftar di BANK_KUIS");
    assert.equal(bank.jumlah, 5);
  });
  const semua: Soal[][] = [];
  for (let b = 1; b <= BENIH; b++) semua.push(bank ? bank.buat(b) : []);
  const soal = (i: number, id: string) => semua[i].find((q) => q.id === id)!;

  it("masukan tiap soal lengkap dan ada di kisi penggeser lembar", () => {
    for (const ss of semua)
      for (const q of ss) {
        const m = q.jenis === "atur" ? { ...q.siapkan, ...q.tetap } : q.masukan!;
        assert.ok(m, q.id);
        for (const k of Object.keys(P) as (keyof typeof P)[]) assert.ok(diKisi(m[k], P[k]), `${q.id} ${k} ${m[k]}`);
      }
  });

  it("B1: kunci = darcyValid, Rep di luar [7; 14]; kedua jawaban muncul", () => {
    let darcy = 0;
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "dm03-1");
      if (q.jenis !== "pilih") assert.fail("jenis");
      const r = alir(q.masukan!);
      assert.equal(q.kunci, r.darcyValid ? "darcy" : "inersia");
      assert.ok(r.poreRe < 7 || r.poreRe > 14, String(r.poreRe));
      if (r.darcyValid) darcy++;
    }
    assert.ok(darcy > 300 && darcy < 700, `darcy ${darcy}`);
  });

  it("B2: kunci = .poreRe, tol 3 %; kesalahan lupa (1 − n), vDarcy, ν", () => {
    const nu = waterViscosity(20);
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "dm03-2");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const m = q.masukan!;
      const r = alir(m);
      assert.equal(q.kunci, r.poreRe);
      assert.ok(q.kunci < 999.5, "tanpa pemisah ribuan");
      assert.ok(Math.abs(q.toleransi - 0.03 * r.poreRe) < 1e-12);
      const calon = [r.v * m.d / nu, r.vDarcy * m.d / (nu * (1 - m.n)), r.v * m.d / (1e-3 * (1 - m.n))];
      for (const k of q.kesalahan ?? []) assert.ok(calon.some((v) => Math.abs(v - k.nilai) < 1e-9 * Math.max(1, v)), String(k.nilai));
      assert.ok((q.kesalahan ?? []).length >= 2);
    }
  });

  it("B3: kunci = .q = v·t, turbulentShare > 0,5, tol 2 %; kesalahan kDarcy·i·t dan lupa t", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "dm03-3");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const m = q.masukan!;
      const r = alir(m);
      assert.equal(q.kunci, r.q);
      assert.ok(Math.abs(r.q - r.v * m.t) < 1e-12 * Math.max(1, r.q));
      assert.ok(r.turbulentShare > 0.5);
      assert.ok(Math.abs(q.toleransi - 0.02 * r.q) < 1e-12);
      const calon = [r.vDarcy * m.t, r.v];
      for (const k of q.kesalahan ?? []) assert.ok(calon.some((v) => Math.abs(v - k.nilai) < 1e-12 * Math.max(1, v)), String(k.nilai));
      assert.ok((q.kesalahan ?? []).some((k) => Math.abs(k.nilai - r.vDarcy * m.t) < 1e-9 * r.vDarcy * m.t), "kDarcy·i·t");
    }
  });

  it("B3: vD/v ≤ 100 di semua benih, jawaban < 1000, cadangan < 20 % benih", () => {
    let cadangan = 0;
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "dm03-3");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const m = q.masukan!;
      const r = alir(m);
      assert.ok(r.overprediction <= 100, `benih ${i + 1}: vD/v ${r.overprediction}`);
      assert.ok(q.kunci < 1000, `benih ${i + 1}: kunci ${q.kunci}`);
      for (const k of q.kesalahan ?? []) assert.ok(k.nilai < 1000, `benih ${i + 1}: pengecoh ${k.nilai}`);
      if (m.dh === 2 && m.L === 20 && m.d === 0.05 && m.n === 0.4 && m.t === 2) cadangan++;
    }
    assert.ok(cadangan < 0.2 * BENIH, `cadangan ${cadangan}`);
  });

  it("B3 cadangan (Δh 2, L 20, d 0,05, n 0,4, t 2) → vD/v ≈ 52,8, inersia menguasai", () => {
    const r = alir({ dh: 2, L: 20, d: 0.05, n: 0.4, t: 2 });
    assert.ok(Math.abs(r.overprediction - 52.8) < 0.05, String(r.overprediction));
    assert.ok(r.turbulentShare > 0.5 && r.q >= 0.01 && r.q <= 20, `${r.turbulentShare} ${r.q}`);
  });

  it("B4: Δh ×2; kerikil halus exponent > 0,97 atau batu < 0,53; kunci = pilihan terdekat ke rasio lib", () => {
    const nilai: Record<string, number> = { dua: 2, akar: Math.SQRT2, empat: 4, tetap: 1 };
    let halus = 0;
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "dm03-4");
      if (q.jenis !== "pilih") assert.fail("jenis");
      // masukan = keadaan sesudah Δh dilipatduakan (dipasang ke lembar).
      const m = { ...q.masukan!, dh: q.masukan!.dh / 2 };
      assert.ok(diKisi(m.dh, P.dh) && diKisi(2 * m.dh, P.dh));
      const r1 = alir(m), r2 = alir({ ...m, dh: 2 * m.dh });
      assert.ok(r1.exponent > 0.97 || r1.exponent < 0.53, String(r1.exponent));
      if (r1.exponent > 0.97) halus++;
      const rasio = r2.q / r1.q;
      const dekat = Object.entries(nilai).sort((a, b) => Math.abs(a[1] - rasio) - Math.abs(b[1] - rasio))[0][0];
      assert.equal(q.kunci, dekat);
    }
    assert.ok(halus > 300 && halus < 700, `halus ${halus}`);
  });

  it("B5: atur Δh sampai q dalam ±5 % sasaran, ≥ 3 langkah; L, d, n, t tetap", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "dm03-5");
      if (q.jenis !== "atur") assert.fail("jenis");
      assert.equal(q.geser.kunci, "dh");
      const tetap = q.tetap!;
      assert.deepEqual(Object.keys(tetap).sort(), ["L", "d", "n", "t"]);
      const mid = (q.target.min + q.target.max) / 2;
      assert.ok(Math.abs(q.target.min / mid - 0.95) < 1e-9 && Math.abs(q.target.max / mid - 1.05) < 1e-9);
      let n = 0;
      for (const dh of kisi(q.geser.p)) {
        const u: number = alir({ ...tetap, dh }).q;
        const di: boolean = u >= q.target.min && u <= q.target.max;
        if (di) n++;
        assert.equal(nilaiJawab(q, 0, { ...tetap, dh }).benar, di);
      }
      assert.ok(n >= 3, `${n} langkah`);
    }
  });
});
