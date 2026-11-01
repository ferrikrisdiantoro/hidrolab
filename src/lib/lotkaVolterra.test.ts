import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { invarianLV, lotkaVolterra, titikSeimbangLV, type ParamLV } from "./lotkaVolterra.ts";

// Parameter uji sembarang (bukan data lapangan)
const p: ParamLV = { alpha: 1.1, beta: 0.4, gamma: 0.4, delta: 0.1 };

describe("lotkaVolterra (Lotka 1925, Volterra 1926)", () => {
  it("titik seimbang (γ/δ, α/β): turunan nol, lintasan diam", () => {
    const e = titikSeimbangLV(p);
    assert.ok(Math.abs(e.x - 4) < 1e-12 && Math.abs(e.y - 2.75) < 1e-12);
    const r = lotkaVolterra(p, e.x, e.y, 20);
    assert.ok(r.x.every((v) => Math.abs(v - e.x) < 1e-9));
    assert.ok(r.y.every((v) => Math.abs(v - e.y) < 1e-9));
  });

  it("invarian δx − γ ln x + βy − α ln y terjaga (Koshkin & Meyers 2022 pers. 4): drift < 1e-7 dalam ±10 periode", () => {
    const r = lotkaVolterra(p, 10, 10, 60);
    const V0 = invarianLV(p, 10, 10);
    assert.ok(Math.abs(r.invarian[0] - V0) < 1e-15);
    for (const V of r.invarian) assert.ok(Math.abs(V - V0) / Math.abs(V0) < 1e-7);
    assert.ok(r.drift < 1e-7);
  });

  it("invarian memang tetap secara analitik: dV/dt = 0 di titik sembarang", () => {
    // dV/dt = (δ − γ/x) dx/dt + (β − α/y) dy/dt
    for (const [x, y] of [[1, 1], [7, 0.3], [0.2, 9]]) {
      const dx = p.alpha * x - p.beta * x * y;
      const dy = p.delta * x * y - p.gamma * y;
      const dV = (p.delta - p.gamma / x) * dx + (p.beta - p.alpha / y) * dy;
      assert.ok(Math.abs(dV) < 1e-12);
    }
  });

  it("orbit kecil: periode → 2π/√(αγ) (linearisasi di titik seimbang)", () => {
    const e = titikSeimbangLV(p);
    const r = lotkaVolterra(p, e.x * 1.01, e.y, 80);
    const Tlin = (2 * Math.PI) / Math.sqrt(p.alpha * p.gamma);
    assert.ok(Math.abs(r.periodeLinear - Tlin) < 1e-12);
    assert.ok(r.periode !== null && Math.abs(r.periode - Tlin) / Tlin < 5e-3, `${r.periode} vs ${Tlin}`);
  });

  it("rata-rata satu periode = titik seimbang (integral d ln x/dt dan d ln y/dt satu putaran = 0)", () => {
    const r = lotkaVolterra(p, 10, 10, 60, { titikKeluar: 60000 });
    assert.ok(r.periode !== null);
    const e = titikSeimbangLV(p);
    // rata-rata trapesium di antara dua puncak mangsa berurutan
    const [a, b] = r.puncakMangsa.slice(0, 2);
    let sx = 0;
    let sy = 0;
    for (let k = a + 1; k <= b; k++) {
      const dt = r.t[k] - r.t[k - 1];
      sx += 0.5 * (r.x[k] + r.x[k - 1]) * dt;
      sy += 0.5 * (r.y[k] + r.y[k - 1]) * dt;
    }
    const T = r.t[b] - r.t[a];
    assert.ok(Math.abs(sx / T - e.x) / e.x < 2e-3, `x̄ ${sx / T}`);
    assert.ok(Math.abs(sy / T - e.y) / e.y < 2e-3, `ȳ ${sy / T}`);
  });

  it("puncak pemangsa tertinggal dari puncak mangsa (seperempat putaran pada orbit kecil)", () => {
    const e = titikSeimbangLV(p);
    const r = lotkaVolterra(p, e.x * 1.02, e.y, 40, { titikKeluar: 8000 });
    assert.ok(r.tundaanPemangsa !== null);
    const T = r.periode!;
    assert.ok(Math.abs(r.tundaanPemangsa! / T - 0.25) < 0.02, `${r.tundaanPemangsa! / T}`);
  });

  it("deret selaras, t naik, populasi positif; awal nol ditandai", () => {
    const r = lotkaVolterra(p, 10, 10, 30);
    assert.equal(r.t.length, r.x.length);
    assert.equal(r.t.length, r.y.length);
    assert.equal(r.t[r.t.length - 1], 30);
    assert.ok(r.x.every((v) => v > 0) && r.y.every((v) => v > 0));
    const nol = lotkaVolterra(p, 5, 0, 5);
    assert.equal(nol.tanpaPemangsa, true);
    assert.ok(Number.isNaN(nol.drift));
    assert.ok(nol.y.every((v) => v === 0));
  });
});
