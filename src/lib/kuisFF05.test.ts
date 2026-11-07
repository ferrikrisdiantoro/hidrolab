import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { kisi, nilaiJawab, type Soal } from "./kuis.ts";
import { BANK_KUIS } from "../data/kuis/index.ts";
import { flowLines } from "./hydraulics.ts";

/**
 * Bank FF-05 Garis aliran (KUIS.md + revisi insinyur 1 November):
 * kunci = keluaran flowLines dengan panjang gambar lembar, masukan di kisi
 * penggeser, margin butir sesuai rancangan.
 */

const BENIH = 1000;
const P = {
  U: { min: 0.2, max: 8, step: 0.1 },
  V: { min: 0, max: 4, step: 0.1 },
  w: { min: 0, max: 4, step: 0.05 },
  t: { min: 0.5, max: 20, step: 0.5 },
};
const diKisi = (v: number, p: { min: number; max: number; step: number }) =>
  v >= p.min - 1e-12 && v <= p.max + 1e-12 && Math.abs(v / p.step - Math.round(v / p.step)) < 1e-9;
/** Panggilan yang sama dengan GarisAliranClient: panjang = maks(10, U·t). */
const garis = (k: Record<string, number>) => flowLines(k.U, k.V, k.w, k.t, Math.max(10, k.U * k.t));

describe(`FF-05 garis aliran: kunci dari lib, ${BENIH} benih`, () => {
  const bank = BANK_KUIS["FF-05"];
  it("bank terdaftar dengan lima butir", () => {
    assert.ok(bank, "FF-05 belum terdaftar di BANK_KUIS");
    assert.equal(bank.jumlah, 5);
  });
  const semua: Soal[][] = [];
  for (let b = 1; b <= BENIH; b++) semua.push(bank ? bank.buat(b) : []);
  const soal = (i: number, id: string) => semua[i].find((q) => q.id === id)!;

  it("masukan tiap soal ada di kisi penggeser lembar", () => {
    for (const ss of semua)
      for (const q of ss) {
        const m = q.jenis === "atur" ? { ...q.siapkan, ...q.tetap } : q.masukan;
        assert.ok(m, q.id);
        for (const k of ["U", "V", "w", "t"] as const) assert.ok(diKisi(m[k], P[k]), `${q.id} ${k} ${m[k]}`);
      }
  });

  it("B1: tepat satu set tunak menurut flowLines().steady; pengecoh Δ > 0,2 m", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "ff05-1");
      if (q.jenis !== "pilih") assert.fail("jenis");
      assert.equal(garis(q.masukan!).steady, true);
      // Set tiap pilihan tertulis di teksnya; kunci = satu-satunya yang tunak.
      for (const p of q.pilihan) {
        const m = (p as unknown as { set: Record<string, number> }).set;
        assert.ok(m, `${q.id} pilihan ${p.id} tanpa set`);
        const g = garis(m);
        if (p.id === q.kunci) assert.equal(g.steady, true);
        else {
          assert.equal(g.steady, false);
          assert.ok(g.separation > 0.2, `pengecoh Δ ${g.separation}`);
        }
      }
    }
  });

  it("B2: kunci = V·cos(ωt)/U, tol max(0,01; 2 %), |cos ωt| > 0,2", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "ff05-2");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const { U, V, w, t } = q.masukan!;
      const c = Math.cos(w * t);
      assert.ok(Math.abs(c) > 0.2, `cos ${c}`);
      // Garis arus model lurus melewati titik asal: kemiringan = y/x di ujungnya.
      const g = garis(q.masukan!);
      const ujung = g.streamline[g.streamline.length - 1];
      assert.ok(Math.abs(q.kunci - ujung.y / ujung.x) < 1e-12);
      assert.equal(q.kunci, (V * c) / U);
      assert.equal(q.toleransi, Math.max(0.01, 0.02 * Math.abs(q.kunci)));
    }
  });

  it("B3: kunci = simpangan terbesar lintasan lib, ω > 0,2, t ≥ π/(2ω), tol 2 %", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "ff05-3");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const { V, w, t } = q.masukan!;
      assert.ok(w > 0.2 && t >= Math.PI / (2 * w), `ω ${w} t ${t}`);
      const A = Math.max(0, ...garis(q.masukan!).pathline.map((p) => Math.abs(p.y)));
      assert.equal(q.kunci, A);
      assert.ok(Math.abs(A - V / w) / (V / w) < 0.01, "A ≈ V/ω");
      assert.equal(q.toleransi, 0.02 * A);
    }
  });

  it("B4: atur ω, sasaran Δ diterima di SELURUH kisi ω (tidak monoton), awal di luar", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "ff05-4");
      if (q.jenis !== "atur") assert.fail("jenis");
      assert.equal(q.geser.kunci, "w");
      const tetap = q.tetap!;
      for (const w of kisi(q.geser.p)) {
        const s: number = garis({ ...tetap, w }).separation;
        const di: boolean = s >= q.target.min && s <= q.target.max;
        assert.equal(nilaiJawab(q, 0, { ...tetap, w }).benar, di, `ω ${w}`);
      }
      assert.ok(q.target.min > 0, "sasaran tidak memuat aliran tunak");
    }
  });

  it("B5: tebak, kunci garis jejak, masukan tak tunak dengan ketiga garis terpisah", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "ff05-5");
      assert.equal(q.jenis, "tebak");
      if (q.jenis !== "tebak") continue;
      assert.equal(q.kunci, "jejak");
      const g = garis(q.masukan!);
      assert.equal(g.steady, false);
      assert.ok(g.separation > 0.3);
      // Garis jejak titik x = pathline titik n−i; bedanya harus terlihat.
      const n = g.pathline.length - 1;
      const beda = Math.max(...g.pathline.map((p, j) => Math.abs(p.y - g.streakline[n - j].y)));
      assert.ok(beda > 0.3, `jejak vs lintasan ${beda}`);
    }
  });
});
