import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { rk4, rk4Adaptif, rk4Step } from "./ode.ts";

const eksponen = (_t: number, y: Float64Array, dy: Float64Array) => {
  dy[0] = y[0];
};

describe("rk4 (RK4 klasik)", () => {
  it("satu langkah = rumus k1..k4 (y' = y, h = 0,1)", () => {
    // Untuk y' = y: y1 = 1 + h + h²/2 + h³/6 + h⁴/24 persis
    const out = new Float64Array(1);
    rk4Step(eksponen, 0, new Float64Array([1]), 0.1, out);
    const h = 0.1;
    assert.ok(Math.abs(out[0] - (1 + h + h * h / 2 + h ** 3 / 6 + h ** 4 / 24)) < 1e-15);
  });

  it("orde 4: galat turun ±16 kali bila langkah separuh", () => {
    const galat = (n: number) => Math.abs(rk4(eksponen, new Float64Array([1]), 0, 1, n).y[n][0] - Math.E);
    const rasio = galat(20) / galat(40);
    assert.ok(rasio > 14 && rasio < 18, `rasio ${rasio}`);
  });

  it("keluaran: steps+1 titik, t ujung tepat, y0 tidak diubah", () => {
    const y0 = new Float64Array([2]);
    const r = rk4(eksponen, y0, 1, 3, 50);
    assert.equal(r.t.length, 51);
    assert.equal(r.y.length, 51);
    assert.equal(r.t[0], 1);
    assert.equal(r.t[50], 3);
    assert.equal(y0[0], 2);
    assert.notEqual(r.y[0], y0);
  });

  it("osilator harmonik: energi terjaga 1e-8 dalam 10 periode", () => {
    const f = (_t: number, y: Float64Array, dy: Float64Array) => {
      dy[0] = y[1];
      dy[1] = -y[0];
    };
    const r = rk4(f, new Float64Array([1, 0]), 0, 20 * Math.PI, 20000);
    const e = r.y[20000][0] ** 2 + r.y[20000][1] ** 2;
    assert.ok(Math.abs(e - 1) < 1e-8);
  });
});

describe("rk4Adaptif (penggandaan langkah)", () => {
  it("y' = −2ty → exp(−t²), tiba tepat di t1 dengan galat kecil", () => {
    const f = (t: number, y: Float64Array, dy: Float64Array) => {
      dy[0] = -2 * t * y[0];
    };
    const r = rk4Adaptif(f, new Float64Array([1]), 0, 3, { tol: 1e-9 });
    assert.equal(r.selesai, true);
    assert.equal(r.t[r.t.length - 1], 3);
    for (let i = 0; i < r.t.length; i++) {
      assert.ok(Math.abs(r.y[i][0] - Math.exp(-(r.t[i] ** 2))) < 1e-7, `t=${r.t[i]}`);
    }
  });

  it("langkah melebar di bagian yang landai (lebih sedikit langkah daripada kisi rata setara)", () => {
    const f = (t: number, y: Float64Array, dy: Float64Array) => {
      dy[0] = -50 * (y[0] - Math.cos(t));
    };
    const r = rk4Adaptif(f, new Float64Array([0]), 0, 10, { tol: 1e-6 });
    assert.equal(r.selesai, true);
    assert.ok(r.t.length < 2000, `${r.t.length} langkah`);
  });
});
