import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  BAGNOLD_SUSPENSION,
  FLVB_A,
  FLVB_B,
  bedloadGrainVelocity,
  grainMotion,
  suspensionState,
  type GrainMotion,
} from "./sedimenGerak.ts";
import { G, settlingVelocity, shieldsState } from "./hydraulics.ts";

const NU = 1.0e-6;

describe("M1 laju butir dasar, Fernandez Luque & van Beek (1976)", () => {
  it("koefisien sesuai rumus yang dikutip: us = 11,5 (u* - 0,7 u*c)", () => {
    // Dikutip oleh Penteado & Franklin (2016), arXiv:1608.04412, bagian 1:
    // "vx = 11.5(u* - 0.7 u*,th)".
    assert.equal(FLVB_A, 11.5);
    assert.equal(FLVB_B, 0.7);
  });

  it("theta = 4 theta_c berarti u*c = u*/2, jadi us = 11,5 (1 - 0,35) u*", () => {
    const ustar = 0.04;
    const r = bedloadGrainVelocity(0.2, 0.05, ustar);
    assert.equal(r.moving, true);
    assert.ok(Math.abs(r.us - 11.5 * 0.65 * ustar) < 1e-12);
  });

  it("di bawah ambang Shields butir diam, laju nol", () => {
    const r = bedloadGrainVelocity(0.03, 0.05, 0.02);
    assert.deepEqual(r, { us: 0, moving: false });
  });

  it("laju naik monoton dengan theta di atas ambang", () => {
    let lalu = 0;
    for (let th = 0.051; th < 1; th += 0.01) {
      const ustar = Math.sqrt(th); // skala sembarang, u* sebanding akar theta
      const { us } = bedloadGrainVelocity(th, 0.05, ustar);
      assert.ok(us > lalu);
      lalu = us;
    }
  });

  it("masukan rusak tidak menghasilkan NaN", () => {
    for (const [th, thc, u] of [
      [0, 0.05, 0],
      [Number.NaN, 0.05, 0.1],
      [0.1, 0, 0.1],
      [-1, 0.05, 0.1],
    ]) {
      const r = bedloadGrainVelocity(th, thc, u);
      assert.ok(Number.isFinite(r.us));
    }
  });
});

describe("M1 ambang melayang, Bagnold (1966) USGS PP 422-I hlm. I15-I16 pers. 18a", () => {
  it("v' = 1,25 u*, jadi melayang mulai pada u* = 0,8 ws", () => {
    assert.ok(Math.abs(BAGNOLD_SUSPENSION - 1 / 1.25) < 1e-12);
  });

  it("theta_s = 0,4 V^2/(gD) untuk kuarsa; D = 2 mm, V = 20 cm/s memberi theta_s sekitar 0,8", () => {
    // Bagnold: "V being 20 centimeters per second for D=2 mm, theta_s ~ 0.8".
    // Turunkan ulang dari kriteria u* = 0,8 ws dengan s = 2,65.
    const ws = 0.2;
    const d = 0.002;
    const ustarS = BAGNOLD_SUSPENSION * ws;
    const thetaS = (ustarS * ustarS) / ((2.65 - 1) * G * d);
    assert.ok(Math.abs(thetaS - 0.79) < 0.02, `theta_s = ${thetaS}`);
    // dan tetapan 0,4 di pers. 18a (dibulatkan dari 1/(1,25^2 x 1,65) = 0,388)
    assert.ok(Math.abs(1 / (1.25 * 1.25 * 1.65) - 0.4) < 0.015);
  });

  it("ratio = ws/u*, melayang bila ratio <= 1,25", () => {
    const a = suspensionState(0.1, 0.12);
    assert.ok(Math.abs(a.ratio - 1.2) < 1e-12);
    assert.equal(a.suspended, true);
    const b = suspensionState(0.1, 0.13);
    assert.equal(b.suspended, false);
  });

  it("kriteria dapat diganti, mis. ws = u* yang dipakai hjulstrom()", () => {
    assert.equal(suspensionState(0.1, 0.12, 1).suspended, false);
    assert.equal(suspensionState(0.1, 0.1, 1).suspended, true);
  });

  it("aliran diam: tidak melayang, ratio tak hingga", () => {
    const r = suspensionState(0, 0.01);
    assert.equal(r.suspended, false);
    assert.equal(r.ratio, Number.POSITIVE_INFINITY);
  });
});

describe("M1 grainMotion: diam / dasar / melayang dari shieldsState", () => {
  it("pasir 2 mm, kedalaman kecil: diam", () => {
    const sh = shieldsState(0.05, 0.001, 0.002, 2.65, NU);
    const ws = settlingVelocity(0.002, 2.65, NU);
    const m = grainMotion(sh, ws);
    assert.equal(sh.moving, false);
    assert.equal(m.mode, "diam");
    assert.equal(m.us, 0);
  });

  it("pasir 2 mm, kedalaman sedang: menggelinding di dasar", () => {
    const sh = shieldsState(0.5, 0.002, 0.002, 2.65, NU);
    const ws = settlingVelocity(0.002, 2.65, NU);
    const m = grainMotion(sh, ws);
    assert.equal(sh.moving, true);
    assert.equal(m.mode, "dasar");
    assert.ok(m.us > 0);
    assert.ok(m.ratio > 1 / BAGNOLD_SUSPENSION);
  });

  it("pasir halus 0,1 mm di atas ambang: melayang (Bagnold: d <= 0,1 mm melayang sejak ambang gerak)", () => {
    const d = 0.0001;
    const sh = shieldsState(0.3, 0.001, d, 2.65, NU);
    const ws = settlingVelocity(d, 2.65, NU);
    const m = grainMotion(sh, ws);
    assert.equal(sh.moving, true);
    assert.equal(m.mode, "melayang");
  });

  it("memakai ulang objek out tanpa alokasi baru", () => {
    const out: GrainMotion = { mode: "diam", us: 0, ustar: 0, ratio: 0 };
    const sh = shieldsState(0.5, 0.002, 0.002, 2.65, NU);
    const r = grainMotion(sh, 0.2, 1000, BAGNOLD_SUSPENSION, out);
    assert.equal(r, out);
    assert.ok(Math.abs(out.ustar - Math.sqrt(sh.tau / 1000)) < 1e-12);
  });
});
