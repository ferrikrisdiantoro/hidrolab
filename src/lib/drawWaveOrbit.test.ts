import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { niceFloor, waveLayout, waveTimeScale, waveWindow } from "./drawWaveOrbit.ts";
import { linearWave } from "./hydraulics.ts";

/*
 * FP-03 panel ruang fisik: skala simpangan satu untuk kedua arah, orbit
 * tidak tumpang, muka air tidak melipat, pengali waktu jujur.
 */

const KASUS = [
  [8, 20, 1],
  [8, 1.2, 0.5],
  [8, 200, 2],
  [20, 40, 1.5],
  [60, 0.5, 0.1],
  [1, 500, 0.1],
  [60, 500, 6],
] as const;

describe("FP-03 tata letak panel orbit", () => {
  it("orbit muka air ≤ 0,4 jarak kolom dan muka air tidak melipat, di 1280 dan 390", () => {
    for (const [T, h, H] of KASUS)
      for (const [w, hp] of [[830, 300], [340, 260]]) {
        const r = linearWave(T, h, H);
        const lay = waveLayout(w, hp, { H, L: r.length, zWin: waveWindow(h, r.length), k: r.k, h });
        const A0 = (H / 2) / Math.tanh(r.k * h);
        const sx = Math.abs(lay.map.X(1) - lay.map.X(0));
        const kolom = sx * (lay.cols[1] - lay.cols[0]);
        assert.ok(A0 * lay.E <= 0.4 * kolom + 1e-9, `T ${T} h ${h} w ${w}: ${A0 * lay.E} > ${0.4 * kolom}`);
        assert.ok((r.k * A0 * lay.E) / sx <= 0.6 + 1e-9, `lipat T ${T} h ${h}`);
        assert.ok((H / 2) * lay.E <= 20 + 1e-9, "simpangan tegak");
        // E = M × skala tegak, M angka 1-2-5
        const sy = Math.abs(lay.map.Y(-1) - lay.map.Y(0));
        assert.ok(Math.abs(lay.E / sy - lay.M) < 1e-9 * lay.M);
        assert.equal(niceFloor(lay.M), lay.M);
        // satu panjang gelombang selalu tampak
        assert.ok(lay.span >= r.length - 1e-9);
      }
  });

  it("jendela: 1,2 · min(h, L/2); dasar di luar gambar hanya di air dalam", () => {
    assert.equal(waveWindow(20, 88.8), 24);
    assert.equal(waveWindow(200, 99.9), 1.2 * 49.95);
  });

  it("pengali waktu: satu orbit 0,95 sampai 9,5 detik layar, ×1 sampai T 9,5 s", () => {
    for (const T of [1, 4, 8, 9.5, 10, 20, 60]) {
      const k = waveTimeScale(T);
      const layar = T / k;
      assert.ok(layar >= 0.95 - 1e-9 && layar <= 9.5 + 1e-9, `T ${T}: ${layar}`);
    }
    assert.equal(waveTimeScale(8), 1);
    assert.equal(waveTimeScale(60), 10);
  });
});
