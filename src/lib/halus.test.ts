import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { langkahHalus } from "./halus.ts";

/* OC-07: easing pada MASUKAN Δz; gambar diam harus tepat sama dengan sasaran. */

const dekat = (a: number, b: number, tol: number, pesan?: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${pesan ?? ""} ${a} lawan ${b}`);

describe("langkahHalus: masukan dianimasikan, bukan gambar", () => {
  it("mendekati sasaran secara eksponensial lalu tepat sama", () => {
    let v = 0;
    let n = 0;
    while (v !== 1 && n < 1000) {
      v = langkahHalus(v, 1, 1 / 60, 0.1, 1e-4);
      n++;
    }
    assert.equal(v, 1);
    assert.ok(n > 20 && n < 80, `${n} frame`);
    // Satu langkah = 1 − e^(−dt/τ) dari sisa.
    dekat(langkahHalus(0, 1, 0.1, 0.1, 1e-6), 1 - Math.exp(-1), 1e-12);
    // dt nol tidak bergerak; sudah sama tetap sama.
    assert.equal(langkahHalus(0.3, 1, 0, 0.1, 1e-4), 0.3);
    assert.equal(langkahHalus(1, 1, 0.02, 0.1, 1e-4), 1);
  });
});
