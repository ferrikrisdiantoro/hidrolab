import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { DAM_SLIDE_FRACTION, DAM_TILT_DEG, damFailedOutline, damFailureMode } from "./damFailure.ts";
import { gravityDam } from "./hydraulics.ts";

describe("DM-01 posisi gagal (phantom)", () => {
  it("cara gagal hanya bila FS < 1; guling didahulukan; tanpa phantom di antara 1 dan 1,5", () => {
    assert.equal(damFailureMode(0.9, 0.8, 100), "guling");
    assert.equal(damFailureMode(1.2, 0.8, 100), "geser");
    assert.equal(damFailureMode(1.4, 1.4, 100), null);
    assert.equal(damFailureMode(0.9, 2, -5), null, "ΣV ≤ 0: mengapung, bukan terguling");
  });

  it("FS guling < 1 sama dengan resultan di luar ujung kaki (model)", () => {
    // Bendungan ramping tanpa air hilir, angkat penuh: terguling.
    const r = gravityDam(40, 2, 12, 40, 0, 0.7, 0, 1, 0.1, true);
    assert.ok(r.sumV > 0);
    assert.ok(r.fsOverturning < 1);
    assert.ok(r.resultantAt > 12, `resultan di ${r.resultantAt}`);
    // Nilai awal lembar: berdiri.
    const k = gravityDam(40, 6, 30, 38, 3, 0.7, 100, 1, 0.1, true);
    assert.ok(k.fsOverturning >= 1 && k.resultantAt <= 30);
  });

  it("terguling: ujung kaki diam, tumit terangkat B·sin θ, bentuk tidak berubah", () => {
    const sec = [
      { x: 0, z: 0 },
      { x: 0, z: 40 },
      { x: 6, z: 40 },
      { x: 30, z: 0 },
    ];
    const o = damFailedOutline(sec, 30, "guling");
    assert.equal(o.length, 5);
    assert.deepEqual(o[4], o[0]);
    const th = (DAM_TILT_DEG * Math.PI) / 180;
    assert.ok(Math.abs(o[3].x - 30) < 1e-12 && Math.abs(o[3].z) < 1e-12, "ujung kaki");
    assert.ok(Math.abs(o[0].z - 30 * Math.sin(th)) < 1e-12, "tumit naik");
    assert.ok(o[2].x > 6, "mercu condong ke hilir");
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const a = Math.hypot(sec[j].x - sec[i].x, sec[j].z - sec[i].z);
      const b = Math.hypot(o[j].x - o[i].x, o[j].z - o[i].z);
      assert.ok(Math.abs(a - b) < 1e-9, "sisi tetap");
    }
  });

  it("bergeser: semua titik maju 0,06 B ke hilir, tinggi tetap", () => {
    const sec = [
      { x: 0, z: 0 },
      { x: 0, z: 40 },
      { x: 30, z: 0 },
    ];
    const o = damFailedOutline(sec, 30, "geser");
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(o[i].x - sec[i].x - DAM_SLIDE_FRACTION * 30) < 1e-12);
      assert.equal(o[i].z, sec[i].z);
    }
  });
});
