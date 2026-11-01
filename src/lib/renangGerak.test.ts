import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  BAINBRIDGE_F_MIN,
  BODY_WAVELENGTH,
  TAIL_AMPLITUDE_PP,
  bainbridgeSpeed,
  bodyAmplitude,
  bodyMidline,
  tailBeat,
  type TailBeat,
} from "./renangGerak.ts";

const dekat = (a: number, b: number, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

describe("M2 Bainbridge (1958): V = 1/4 L (3f - 4)", () => {
  it("contoh: L = 20 cm, f = 10 /s memberi V = 130 cm/s (satuan cm dan m setara)", () => {
    dekat(bainbridgeSpeed(10, 0.2), 1.3);
    dekat(bainbridgeSpeed(10, 20), 130);
  });

  it("tailBeat membalik rumus: U = 1,3 m/s, L = 0,2 m memberi f = 10 /s", () => {
    const r = tailBeat(1.3, 0.2);
    dekat(r.frequency, 10);
    assert.equal(r.outOfRange, false);
  });

  it("bolak-balik bainbridgeSpeed dan tailBeat", () => {
    for (const L of [0.05, 0.15, 0.3]) {
      for (const f of [5, 8, 12, 20]) {
        dekat(tailBeat(bainbridgeSpeed(f, L), L).frequency, f, 1e-9);
      }
    }
  });

  it("di bawah 5 kibasan/s rumus di luar rentang linier Bainbridge", () => {
    assert.equal(BAINBRIDGE_F_MIN, 5);
    // f = 5 tepat pada U/L = (3*5 - 4)/4 = 2,75 panjang tubuh per detik
    assert.equal(tailBeat(2.75 * 0.1, 0.1).outOfRange, false);
    assert.equal(tailBeat(2.0 * 0.1, 0.1).outOfRange, true);
    assert.equal(tailBeat(0, 0.1).outOfRange, true);
  });

  it("masukan rusak tidak menghasilkan NaN", () => {
    for (const [U, L] of [
      [1, 0],
      [Number.NaN, 0.2],
      [-1, 0.2],
    ]) {
      const r = tailBeat(U, L);
      assert.ok(Number.isFinite(r.frequency));
      assert.ok(Number.isFinite(r.amplitude));
      assert.equal(r.outOfRange, true);
    }
  });
});

describe("M2 amplitudo dan gelombang tubuh", () => {
  it("amplitudo ekor puncak ke puncak 0,21 L (Hunter & Zweifel 1971, gbr. 6)", () => {
    assert.equal(TAIL_AMPLITUDE_PP, 0.21);
  });

  it("selubung Videler (1993), ikan saithe: A(0) = 0,02, A(0,2) = 0,01, A(1) = 0,10", () => {
    dekat(bodyAmplitude(0), 0.02);
    dekat(bodyAmplitude(0.2), 0.01);
    dekat(bodyAmplitude(1), 0.1);
  });

  it("simpangan ekor Videler (0,10 L) cocok dengan separuh 0,21 L Hunter & Zweifel dalam 5 %", () => {
    assert.ok(Math.abs(bodyAmplitude(1) - TAIL_AMPLITUDE_PP / 2) / (TAIL_AMPLITUDE_PP / 2) < 0.05);
  });

  it("tailBeat: amplitudo = 0,10 L (simpangan dari sumbu), panjang gelombang = 1 L", () => {
    const r = tailBeat(1.0, 0.25);
    dekat(r.amplitude, 0.025);
    dekat(r.wavelength, BODY_WAVELENGTH * 0.25);
    dekat(BODY_WAVELENGTH, 1);
  });

  it("tailBeat memakai ulang objek out", () => {
    const out: TailBeat = { frequency: 0, amplitude: 0, wavelength: 0, outOfRange: true };
    assert.equal(tailBeat(1.3, 0.2, out), out);
    dekat(out.frequency, 10);
  });
});

describe("M2 garis tengah tubuh untuk animasi", () => {
  it("mengisi array yang diberikan, kepala di x = 0, ekor di x = L", () => {
    const L = 0.3;
    const out = new Float32Array(2 * 21);
    bodyMidline(L, 8, L, 0.1, out);
    dekat(out[0], 0, 1e-7);
    dekat(out[40], L, 1e-6);
  });

  it("simpangan tidak pernah melebihi selubung", () => {
    const L = 0.3;
    const n = 41;
    const out = new Float32Array(2 * n);
    for (let t = 0; t < 1; t += 0.013) {
      bodyMidline(L, 8, L, t, out);
      for (let i = 0; i < n; i++) {
        const xi = i / (n - 1);
        assert.ok(Math.abs(out[2 * i + 1]) <= bodyAmplitude(xi) * L + 1e-6);
      }
    }
  });

  it("gelombang merambat dari kepala ke ekor dengan laju f x lambda", () => {
    // y(x, t) = A(x) sin(2 pi (x/lambda - f t)): titik fase nol di x = f lambda t
    const L = 0.2;
    const f = 6;
    const lambda = 0.2;
    const n = 201;
    const out = new Float32Array(2 * n);
    const t = 0.05; // fase nol di x = 6 * 0.2 * 0.05 = 0.06 m
    bodyMidline(L, f, lambda, t, out);
    const i = Math.round((0.06 / L) * (n - 1));
    assert.ok(Math.abs(out[2 * i + 1]) < 1e-6);
    // sedikit di belakang titik itu simpangan negatif, sedikit di depan positif
    assert.ok(out[2 * (i + 5) + 1] > 0);
    assert.ok(out[2 * (i - 5) + 1] < 0);
  });

  it("satu periode kemudian bentuknya kembali sama", () => {
    const a = new Float32Array(2 * 31);
    const b = new Float32Array(2 * 31);
    bodyMidline(0.25, 7, 0.25, 0.3, a);
    bodyMidline(0.25, 7, 0.25, 0.3 + 1 / 7, b);
    for (let i = 0; i < a.length; i++) dekat(a[i], b[i], 1e-5);
  });
});
