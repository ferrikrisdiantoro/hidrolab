import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  circleSection,
  hydrostaticPressure,
  inclinedRectangle,
  planeSurfaceForce,
  rectangleSection,
} from "./hidrostatika.ts";
import { G } from "./hydraulics.ts";

const dekat = (a: number, b: number, tol: number) =>
  assert.ok(Math.abs(a - b) <= tol, `${a} != ${b} (tol ${tol})`);
const deg = (d: number) => (d * Math.PI) / 180;

describe("M12 tekanan hidrostatik p = pa + rho g h", () => {
  it("10 m air: 98,1 kPa ukur", () => {
    dekat(hydrostaticPressure(10), 98100, 1e-9);
    dekat(hydrostaticPressure(10, 1000, G, 101325), 199425, 1e-9);
  });
});

describe("M12 gaya dan pusat tekanan, White bab 2 (F = pCG A, yCP = -rho g sin(theta) Ixx / (pCG A))", () => {
  it("contoh FE (autarkaw, Fluids X-9): pintu tegak 1 m x 1 m, puncak di muka air, g = 9,8: F = 4900 N, kedalaman CP 0,67 m", () => {
    const r = inclinedRectangle(1, 1, 0, deg(90), 1000, 9.8);
    dekat(r.force, 4900, 1e-9);
    dekat(r.depthCP, 2 / 3, 1e-12);
    assert.equal(r.clipped, false);
  });

  it("contoh Crowe 3.78 (salindia McKinney CE 319F): 4 m x 6 m, 60 derajat, hCG = 3 + 3 cos 30: F = 1 318 000 N, CP 0,4641 m di bawah titik berat", () => {
    const r = inclinedRectangle(4, 6, 3, deg(60), 1000, 9.81);
    dekat(r.depthCG, 3 + 3 * Math.cos(deg(30)), 1e-12);
    dekat(r.force, 1.318e6, 1000); // salindia membulatkan ke ribuan newton
    dekat(-r.yCP, 0.4641, 5e-5);
  });

  it("pelat tegak dari muka air sedalam H: CP di 2H/3", () => {
    for (const H of [0.5, 2, 7]) {
      const r = inclinedRectangle(3, H, 0, deg(90));
      dekat(r.depthCP, (2 * H) / 3, 1e-12);
      dekat(r.force, (1000 * G * 3 * H * H) / 2, 1e-6);
    }
  });

  it("pelat datar (theta = 0): CP tepat di titik berat", () => {
    const r = planeSurfaceForce(rectangleSection(2, 3), 4, 0);
    dekat(r.yCP, 0, 1e-15);
    dekat(r.depthCP, 4, 1e-12);
    dekat(r.force, 1000 * G * 4 * 6, 1e-6);
  });

  it("lingkaran tegak: CP di bawah titik berat sejauh R^2/(4 hCG)", () => {
    const R = 0.5;
    const h = 3;
    const r = planeSurfaceForce(circleSection(R), h, deg(90));
    dekat(-r.yCP, (R * R) / (4 * h), 1e-12);
    dekat(r.force, 1000 * G * h * Math.PI * R * R, 1e-6);
  });

  it("tekanan atmosfer di muka air menggeser CP mendekati titik berat", () => {
    const sec = rectangleSection(1, 2);
    const ukur = planeSurfaceForce(sec, 2, deg(90));
    const mutlak = planeSurfaceForce(sec, 2, deg(90), 1000, G, 101325);
    assert.ok(Math.abs(mutlak.yCP) < Math.abs(ukur.yCP));
    dekat(mutlak.force - ukur.force, 101325 * 2, 1e-6);
  });

  it("hasil kali inersia Ixy menggeser CP menyamping: xCP = -rho g sin(theta) Ixy / (pCG A)", () => {
    const sec = { area: 2, Ixx: 0.5, Ixy: 0.1 };
    const r = planeSurfaceForce(sec, 3, deg(30));
    const pCG = 1000 * G * 3;
    dekat(r.xCP, (-1000 * G * 0.5 * 0.1) / (pCG * 2), 1e-12);
  });

  it("CP selalu lebih dalam dari titik berat bila tercelup penuh", () => {
    for (const a of [10, 30, 45, 75, 90]) {
      const r = inclinedRectangle(1, 2, 0.5, deg(a));
      assert.ok(r.depthCP > r.depthCG);
      assert.ok(r.yCP < 0);
    }
  });
});

describe("M12 pelat yang menembus muka air", () => {
  it("puncak 1 m di atas air, pelat tegak 3 m: sama dengan pelat basah 2 m dari muka air, ditandai", () => {
    const r = inclinedRectangle(1.5, 3, -1, deg(90));
    const basah = inclinedRectangle(1.5, 2, 0, deg(90));
    assert.equal(r.clipped, true);
    dekat(r.wettedLength, 2, 1e-12);
    dekat(r.force, basah.force, 1e-9);
    dekat(r.depthCP, basah.depthCP, 1e-12);
  });

  it("pelat miring 30 derajat, 1 m di atas air: panjang basah dikurangi 1/sin 30 = 2 m", () => {
    const r = inclinedRectangle(1, 5, -1, deg(30));
    dekat(r.wettedLength, 3, 1e-12);
  });

  it("pelat seluruhnya di atas air: gaya nol, tanpa NaN", () => {
    for (const r of [inclinedRectangle(1, 1, -2, deg(45)), inclinedRectangle(1, 1, -0.1, 0)]) {
      assert.equal(r.force, 0);
      assert.equal(r.clipped, true);
      assert.ok(Number.isFinite(r.depthCP));
      assert.ok(Number.isFinite(r.yCP));
    }
  });
});
