import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { desimal, keLangkah, sliderBounds, snap, type ParamDef } from "./rentang.ts";

/**
 * Uji rentang masukan. Perilakunya harus sama persis dengan kotak angka
 * InputRow sebelum dipindah ke sini: pijakan kelipatan langkah dari nol,
 * ketikan di luar rentang dipotong ke ujung tanpa dibulatkan.
 */

const dekat = (a: number, b: number) => Math.abs(a - b) < 1e-12;

describe("snap: Falkner-Skan (min -0,19884, langkah 0,002)", () => {
  const p: ParamDef = { min: -0.19884, max: 2, step: 0.002, digits: 3 };

  it("0 tetap 0, tidak dibulatkan", () => {
    assert.deepEqual(snap(0, p), { value: 0, clamped: 0, rounded: false });
  });
  it("0,1235 dibulatkan ke 0,124", () => {
    assert.deepEqual(snap(0.1235, p), { value: 0.124, clamped: 0, rounded: true });
  });
  it("-5 dipotong ke min", () => {
    assert.deepEqual(snap(-5, p), { value: -0.19884, clamped: -1, rounded: false });
  });
  it("9 dipotong ke max", () => {
    assert.deepEqual(snap(9, p), { value: 2, clamped: 1, rounded: false });
  });
  it("min yang diketik persis dibulatkan ke kelipatan langkah di dalam rentang", () => {
    // Perilaku lama: -0,19884 / 0,002 = -99,42 -> -99 -> -0,198.
    assert.deepEqual(snap(-0.19884, p), { value: -0.198, clamped: 0, rounded: true });
  });
  it("ujung penggeser dilebarkan ke kelipatan langkah", () => {
    assert.deepEqual(sliderBounds(p), { min: -0.2, max: 2 });
  });
});

describe("snap: DebitPenampang (min 0,01, langkah 0,05)", () => {
  const p: ParamDef = { min: 0.01, max: 3, step: 0.05 };

  it("ujung bawah penggeser 0, ujung atas tetap", () => {
    assert.deepEqual(sliderBounds(p), { min: 0, max: 3 });
  });
  it("0,02 dibulatkan ke 0 lalu dipotong ke min 0,01", () => {
    assert.deepEqual(snap(0.02, p), { value: 0.01, clamped: 0, rounded: true });
  });
  it("0,5 pas di kelipatan", () => {
    assert.deepEqual(snap(0.5, p), { value: 0.5, clamped: 0, rounded: false });
  });
  it("0,124 dibulatkan ke 0,1 tanpa sisa biner", () => {
    const r = snap(0.124, p);
    assert.equal(r.value, 0.1);
    assert.equal(r.rounded, true);
  });
  it("0 di luar rentang dipotong ke min", () => {
    assert.deepEqual(snap(0, p), { value: 0.01, clamped: -1, rounded: false });
  });
});

describe("snap: max dinamis bukan kelipatan langkah (2,625, langkah 0,01)", () => {
  const p: ParamDef = { min: 0, max: 2.625, step: 0.01 };

  it("ujung atas penggeser dilebarkan ke 2,63", () => {
    assert.deepEqual(sliderBounds(p), { min: 0, max: 2.63 });
  });
  it("2,625 diketik: hasil 2,625 tanpa tanda bulat", () => {
    assert.deepEqual(snap(2.625, p), { value: 2.625, clamped: 0, rounded: false });
  });
  it("2,624 dibulatkan ke 2,62", () => {
    assert.deepEqual(snap(2.624, p), { value: 2.62, clamped: 0, rounded: true });
  });
  it("2,7 dipotong ke 2,625", () => {
    assert.deepEqual(snap(2.7, p), { value: 2.625, clamped: 1, rounded: false });
  });
  it("tombol panah dari max tetap di max", () => {
    assert.equal(keLangkah(2.625 + 0.01, p), 2.625);
    assert.equal(keLangkah(2.625 - 0.01, p), 2.62);
  });
});

describe("snap: nilai negatif", () => {
  const p: ParamDef = { min: -3.3, max: -0.25, step: 0.1 };

  it("ujung penggeser dilebarkan ke luar rentang", () => {
    assert.deepEqual(sliderBounds(p), { min: -3.3, max: -0.2 });
  });
  it("-1,26 dibulatkan ke -1,3", () => {
    assert.deepEqual(snap(-1.26, p), { value: -1.3, clamped: 0, rounded: true });
  });
  it("-0,26 dibulatkan ke -0,3", () => {
    assert.deepEqual(snap(-0.26, p), { value: -0.3, clamped: 0, rounded: true });
  });
  it("-0,25 tetap (dibulatkan ke -0,2 lalu dipotong ke max)", () => {
    // Math.round(-2,5) = -2 -> -0,2 -> dipotong -0,25: sama dengan v, tanpa tanda.
    assert.deepEqual(snap(-0.25, p), { value: -0.25, clamped: 0, rounded: false });
  });
  it("-4 dan 0 dipotong", () => {
    assert.equal(snap(-4, p).clamped, -1);
    assert.equal(snap(0, p).clamped, 1);
  });
});

describe("snap: digits dan langkah kecil", () => {
  it("digits hanya untuk tampilan, tidak memengaruhi nilai", () => {
    const a = snap(0.1235, { min: 0, max: 1, step: 0.002, digits: 1 });
    const b = snap(0.1235, { min: 0, max: 1, step: 0.002 });
    assert.deepEqual(a, b);
    assert.equal(a.value, 0.124);
  });
  it("langkah 1e-7 tanpa sisa biner", () => {
    assert.equal(desimal(1e-7), 7);
    const r = snap(0.00000034, { min: 0, max: 1e-5, step: 1e-7, digits: 7 });
    assert.ok(dekat(r.value, 3e-7));
    assert.equal(r.value, Number((3 * 1e-7).toFixed(7)));
  });
  it("langkah bulat (5) dan desimal()", () => {
    assert.equal(desimal(5), 0);
    assert.equal(desimal(0.05), 2);
    assert.deepEqual(snap(12, { min: 0, max: 100, step: 5 }), {
      value: 10,
      clamped: 0,
      rounded: true,
    });
  });
});
