import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { Soal } from "./kuis.ts";
import { BANK_KUIS } from "../data/kuis/index.ts";
import { deretSoal } from "../data/kuis/dataSoal.ts";
import { score } from "./forecast.ts";
import { fitArima, forecastArima } from "./arima.ts";
import { DERET_HY06 } from "../data/kuis/hy06Deret.ts";
import { ORDE_HY06, PRESET_HY06, kelasBentuk } from "../data/kuis/hy06Bentuk.ts";

/**
 * Bank HY-06 Prediksi curah hujan (KUIS.md putaran 2 + revisi insinyur
 * 1 November). Kunci dari score() (forecast.ts) dan arima.ts; TIDAK ada
 * keluaran ONNX sebagai kunci.
 */

const BENIH = 1000;
type YP = { y: number[]; p: number[] };
const yp = (q: Soal) => (q as Soal & YP);

describe("HY-06 kumpulan deret butir 5: diperiksa ulang dengan lib", () => {
  it("≥ 12 deret ≥ 30 hari, 0,1 mm, keempat preset dan ketiga bentuk hadir", () => {
    assert.ok(DERET_HY06.length >= 12);
    for (const d of DERET_HY06) {
      assert.ok(d.y.length >= 30);
      for (const v of d.y) assert.ok(v >= 0 && Math.abs(v * 10 - Math.round(v * 10)) < 1e-9);
    }
    for (const p of PRESET_HY06) assert.ok(DERET_HY06.some((d) => d.preset === p), p);
    for (const b of ["mendatar", "tren", "mingguan"]) assert.ok(DERET_HY06.some((d) => d.bentuk === b), b);
  });
  it("kelas bentuk = kelasBentuk(forecastArima(fitArima(y, orde), 30)), tepat satu, ramalan terendah > 0", () => {
    for (const d of DERET_HY06) {
      const fit = fitArima(d.y, ORDE_HY06[d.preset]);
      assert.ok(fit);
      const f = forecastArima(fit, 30);
      assert.ok(Math.min(...f) > 0, `${d.preset} min ${Math.min(...f)}`);
      assert.deepEqual(kelasBentuk(d.y, f), [d.bentuk], `${d.pola} ${d.preset}`);
    }
  });
});

describe(`HY-06 prediksi hujan: kunci dari score(), ${BENIH} benih`, () => {
  const bank = BANK_KUIS["HY-06"];
  it("bank terdaftar dengan lima butir", () => {
    assert.ok(bank, "HY-06 belum terdaftar di BANK_KUIS");
    assert.equal(bank.jumlah, 5);
  });
  const semua: Soal[][] = [];
  for (let b = 1; b <= BENIH; b++) semua.push(bank ? bank.buat(b) : []);
  const soal = (i: number, id: string) => semua[i].find((q) => q.id === id)!;

  it("B1–B4: y 6–8 hari bulat 0–40 mm dengan hari kering, p ≥ 0 berkisi 0,1", () => {
    for (const ss of semua)
      for (const q of ss.slice(0, 4)) {
        const { y, p } = yp(q);
        assert.ok(y.length >= 6 && y.length <= 8 && p.length === y.length, q.id);
        for (const v of y) assert.ok(Number.isInteger(v) && v >= 0 && v <= 40);
        assert.ok(y.some((v) => v === 0), `${q.id} tanpa hari kering`);
        for (const v of p) assert.ok(v >= 0 && Math.abs(v * 10 - Math.round(v * 10)) < 1e-9);
        assert.ok(!/ONNX|LSTM/.test(q.tanya.id + q.tanya.en));
      }
  });

  it("B1: kunci = score(y, p).nse, tol 0,02", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "hy06-1");
      if (q.jenis !== "hitung") assert.fail("jenis");
      assert.equal(q.kunci, score(yp(q).y, yp(q).p).nse);
      assert.equal(q.toleransi, 0.02);
    }
  });

  it("B2: kunci = MAE persistensi score(y.slice(1), y.slice(0, −1)).mae, tol max(0,06; 1 %)", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "hy06-2");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const { y } = yp(q);
      const k = score(y.slice(1), y.slice(0, -1)).mae;
      assert.equal(q.kunci, k);
      assert.ok(Math.abs(q.toleransi - Math.max(0.06, 0.01 * k)) < 1e-12);
    }
  });

  it("B3: banding pada hari yang sama; kunci dari MAE model lawan persistensi dan tanda NSE, bermargin", () => {
    const kena = new Map<string, number>();
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "hy06-3");
      if (q.jenis !== "pilih") assert.fail("jenis");
      const { y, p } = yp(q);
      const m = score(y.slice(1), p.slice(1));
      const ps = score(y.slice(1), y.slice(0, -1));
      assert.ok(Math.abs(m.mae - ps.mae) >= 0.1 * ps.mae, `MAE ${m.mae} ${ps.mae}`);
      assert.ok(Math.abs(m.nse) >= 0.05, `NSE ${m.nse}`);
      const kunci = `${m.mae < ps.mae ? "baik" : "buruk"}-${m.nse > 0 ? "rata" : "bawah"}`;
      assert.equal(q.kunci, kunci);
      assert.ok(/MAE/.test(q.bahas.id) && /kuadrat/.test(q.bahas.id));
      kena.set(kunci, (kena.get(kunci) ?? 0) + 1);
    }
    assert.ok((kena.get("baik-bawah") ?? 0) > 150, JSON.stringify([...kena]));
    assert.equal(kena.size, 4, JSON.stringify([...kena]));
  });

  it("B4: kunci = score(y, p).auc (ambang 1 mm), ≥ 2 hari hujan dan ≥ 2 kering, tol 0,02", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "hy06-4");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const { y, p } = yp(q);
      assert.ok(y.filter((v) => v >= 1).length >= 2 && y.filter((v) => v < 1).length >= 2);
      assert.equal(q.kunci, score(y, p).auc);
      assert.equal(q.toleransi, 0.02);
    }
  });

  it("B5: deret dari kumpulan, h = 30, preset tetap, kunci = bentuk tercatat", () => {
    const pakai = new Set<number>();
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "hy06-5");
      if (q.jenis !== "tebak") assert.fail("jenis");
      const y = deretSoal(q)!;
      const j = DERET_HY06.findIndex((d) => d.y === y);
      assert.ok(j >= 0);
      pakai.add(j);
      assert.equal(q.kunci, DERET_HY06[j].bentuk);
      assert.equal(q.masukan!.h, 30);
      assert.equal(PRESET_HY06[q.masukan!.preset], DERET_HY06[j].preset);
    }
    assert.equal(pakai.size, DERET_HY06.length);
  });
});
