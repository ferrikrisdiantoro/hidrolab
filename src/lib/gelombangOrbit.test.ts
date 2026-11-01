import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { orbitRatioCosh, orbitRatioSinh, waveOrbitAxes, waveParticle, waveSurface, waveVelocity } from "./gelombangOrbit.ts";
import { G, linearWave } from "./hydraulics.ts";

/*
 * Acuan: Coastal Engineering Manual II-1 Tabel II-1-1 dan Dean & Dalrymple
 * (1991) bab 4. Bentuk yang diuji di sini sengaja ditulis ulang langsung
 * dari tabel (cosh/sinh biasa, kh kecil) supaya bentuk eksponen di berkas
 * model tidak menguji dirinya sendiri.
 */

const dekat = (a: number, b: number, tol: number, pesan?: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${pesan ?? ""} ${a} lawan ${b}`);

describe("FP-03 orbit partikel Airy pada kedalaman z", () => {
  it("nisbah eksponen = cosh k(h+z)/sinh kh dan sinh k(h+z)/sinh kh (kh sedang)", () => {
    for (const [k, h, z] of [[0.07, 20, -5], [0.3, 3, -2.9], [0.01, 50, 0], [1.2, 2, -1]]) {
      dekat(orbitRatioCosh(k, h, z), Math.cosh(k * (h + z)) / Math.sinh(k * h), 1e-12);
      dekat(orbitRatioSinh(k, h, z), Math.sinh(k * (h + z)) / Math.sinh(k * h), 1e-12);
    }
  });

  it("di dasar: A = bottomOrbit model, B = 0; di muka air: B = H/2", () => {
    const o = new Float64Array(2);
    for (const [T, h, H] of [[8, 20, 1], [8, 1.2, 0.5], [20, 40, 1.5], [60, 0.5, 0.1]]) {
      const w = linearWave(T, h, H);
      waveOrbitAxes(H, w.k, h, -h, o);
      dekat(o[0], w.bottomOrbit, 1e-9 * Math.max(1, w.bottomOrbit), "A dasar");
      dekat(o[1], 0, 1e-12, "B dasar");
      waveOrbitAxes(H, w.k, h, 0, o);
      dekat(o[1], H / 2, 1e-12, "B muka air");
    }
  });

  it("air dalam: lingkaran berjari-jari (H/2) e^{kz}, tanpa meluap pada kh besar", () => {
    const o = new Float64Array(2);
    const w = linearWave(1, 500, 0.1); // kh ≈ 2000
    for (const z of [0, -0.1, -0.4, -0.78]) {
      waveOrbitAxes(0.1, w.k, 500, z, o);
      assert.ok(Number.isFinite(o[0]) && Number.isFinite(o[1]));
      dekat(o[0], 0.05 * Math.exp(w.k * z), 1e-12);
      dekat(o[1], 0.05 * Math.exp(w.k * z), 1e-12);
    }
    // pada z = −L/2 tinggal e^{−π} ≈ 4 % (batas air dalam h/L = 0,5)
    waveOrbitAxes(0.1, w.k, 500, -w.length / 2, o);
    dekat(o[0] / 0.05, Math.exp(-Math.PI), 1e-9);
  });

  it("air dangkal: A hampir tetap terhadap z, mendekati H/(2kh) (Dean & Dalrymple)", () => {
    const o = new Float64Array(2);
    const h = 0.5;
    const w = linearWave(60, h, 0.1); // kh ≈ 0,024
    waveOrbitAxes(0.1, w.k, h, 0, o);
    const aMuka = o[0];
    waveOrbitAxes(0.1, w.k, h, -h, o);
    dekat(o[0] / aMuka, 1, 1e-3, "A muka/dasar");
    dekat(o[0], 0.1 / (2 * w.k * h), 0.1 / (2 * w.k * h) * 1e-3, "A ≈ H/2kh");
  });

  it("muka air = perpindahan tegak partikel muka air; u, w = turunan waktu ξ, ζ", () => {
    const w = linearWave(8, 20, 1);
    const sig = (2 * Math.PI) / 8;
    const a = new Float64Array(2);
    const b = new Float64Array(2);
    const v = new Float64Array(2);
    for (const [x0, z0, t] of [[3, 0, 0.4], [40, -7, 2.2], [70, -19, 6.1]]) {
      waveParticle(1, w.k, sig, 20, x0, 0, t, a);
      dekat(a[1], waveSurface(1, w.k, sig, x0, t), 1e-12, "η");
      const d = 1e-6;
      waveParticle(1, w.k, sig, 20, x0, z0, t - d, a);
      waveParticle(1, w.k, sig, 20, x0, z0, t + d, b);
      waveVelocity(1, w.k, sig, 20, x0, z0, t, v);
      dekat((b[0] - a[0]) / (2 * d), v[0], 1e-6, "u");
      dekat((b[1] - a[1]) / (2 * d), v[1], 1e-6, "w");
    }
  });

  it("u memakai bentuk Tabel II-1-1: (H/2)(gT/L) cosh k(h+z)/cosh kh · cos θ", () => {
    const T = 8;
    const h = 20;
    const H = 1;
    const w = linearWave(T, h, H);
    const sig = (2 * Math.PI) / T;
    const v = new Float64Array(2);
    for (const z of [0, -6, -15]) {
      waveVelocity(H, w.k, sig, h, 0, z, 0, v);
      const cem = (H / 2) * ((G * T) / w.length) * (Math.cosh(w.k * (h + z)) / Math.cosh(w.k * h));
      // sama sebatas sisa bagi dua hubungan sebaran linearWave
      dekat(v[0], cem, 1e-6 * cem, `z ${z}`);
    }
  });

  it("partikel kembali ke tempatnya sesudah satu periode (orbit tertutup)", () => {
    const w = linearWave(8, 5, 0.5);
    const sig = (2 * Math.PI) / 8;
    const a = new Float64Array(2);
    const b = new Float64Array(2);
    waveParticle(0.5, w.k, sig, 5, 12, -2, 1.3, a);
    waveParticle(0.5, w.k, sig, 5, 12, -2, 9.3, b);
    dekat(a[0], b[0], 1e-12);
    dekat(a[1], b[1], 1e-12);
  });
});
