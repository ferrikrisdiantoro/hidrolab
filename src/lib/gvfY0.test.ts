import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gvfProfile, reachEnergy } from "./hydraulics.ts";

/*
 * Profil M1 mendekati kedalaman normal dari atas secara asimtotik dan tidak
 * pernah mencapai kedalaman kritis (Chow 1959, Bab 9). Dekat kemiringan
 * kritis, langkah Runge-Kutta tetap bisa melompati y0 lalu menelusur seperti
 * M2 sampai yc. Kasus dari insinyur-hidraulika, 23 Okt 2026, semua masukan
 * di dalam rentang penggeser OC-03 dan OC-09.
 */
describe("Profil aliran berubah lambat tidak melompati kedalaman normal", () => {
  for (const [S0, y] of [
    [8.95e-3, 6],
    [8.322e-3, 1.03],
  ] as const) {
    it(`M1 pada S0 ${S0 * 1000} permil, y ${y} m`, () => {
      const r = gvfProfile(12, 20, 0.025, S0, y, 1500);
      assert.equal(r.profile, "M1");
      assert.equal(r.endsAtCritical, false, "M1 tidak boleh berakhir di kritis");
      const ymin = Math.min(...r.points.map((p) => p.y));
      assert.ok(ymin >= r.y0 - 1e-9, `kedalaman ${ymin} di bawah y0 ${r.y0}`);
      const e = reachEnergy(12, 20, 0.025, S0, y, 1500);
      assert.equal(e.endsAtCritical, false);
    });
  }
  it("M2 tetap berakhir di kritis bila bentangnya cukup panjang", () => {
    const r = gvfProfile(12, 5, 0.025, 1e-3, 0.95, 3000);
    assert.equal(r.profile.slice(0, 2), "M2");
  });
});

import { slopeBreak } from "./hydraulics.ts";

describe("Patahan curam ke landai: letak loncatan", () => {
  it("loncatan di hilir ujung bentang tidak disebut tenggelam", () => {
    const r = slopeBreak(5, 5, 0.01, 20e-3, 1e-3, 600, 50);
    assert.equal(r.kind, "curam-landai");
    assert.equal(r.jumpAt, null);
    assert.equal(r.jumpDrowned, false);
    assert.equal(r.jumpBeyondReach, true);
  });
  it("contoh lembar curam ke landai tetap punya loncatan di dalam bentang", () => {
    const r = slopeBreak(12, 5, 0.025, 30e-3, 1e-3, 600, 600);
    assert.ok(r.jumpAt !== null || r.jumpDrowned);
    assert.equal(r.jumpBeyondReach, false);
  });
});
