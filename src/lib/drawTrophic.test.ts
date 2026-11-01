/*
 * drawTrophic: biomassa yang digambar animasi = deret model trophicCascade.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { trophicCascade } from "./rantaiTrofik.ts";
import { readCascade } from "./drawTrophic.ts";

const p = {
  production: 5000,
  growth: 1,
  efficiency: 0.1,
  grazing: [0.01, 0.05, 0.1],
  mortality: [0, 0.5, 0.2, 0.1],
};

describe("readCascade (EK-01)", () => {
  const c = trophicCascade(4, p, { level: 4, factor: 0.5, at: 2 }, 60);

  it("sama persis dengan deret model di titik deret (kecuali titik sebelum lompatan denyut)", () => {
    const out = new Float64Array(4);
    for (let k = 0; k < c.t.length; k++) {
      if (k + 1 < c.t.length && c.t[k + 1] === c.t[k]) continue;
      readCascade(c.t, c.biomass, c.t[k], out);
      for (let i = 0; i < 4; i++) assert.ok(Math.abs(out[i] - c.biomass[k][i]) <= 1e-12 * Math.max(1, c.biomass[k][i]), `k ${k} i ${i}`);
    }
  });

  it("saat denyut dibaca nilai sesudah lompatan", () => {
    const out = new Float64Array(4);
    readCascade(c.t, c.biomass, 2, out);
    assert.ok(Math.abs(out[3] - c.equilibrium[3] * 0.5) < 1e-9);
  });

  it("sebelum gangguan = keseimbangan", () => {
    const out = new Float64Array(4);
    readCascade(c.t, c.biomass, 1, out);
    for (let i = 0; i < 4; i++) assert.ok(Math.abs(out[i] - c.equilibrium[i]) / c.equilibrium[i] < 1e-9);
  });
});
