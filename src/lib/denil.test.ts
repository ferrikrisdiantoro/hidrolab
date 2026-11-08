import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DENIL_YB_MAX,
  DENIL_YB_MIN,
  G,
  denilFishway,
} from "./hydraulics.ts";
import { checksDenil } from "./checks.ts";
import { summarise } from "./verify.ts";

/*
 * EH-02 tangga ikan Denil, kurva debit acuan.
 *
 * Sumber (dibuka 8 Nov 2026, PDF 1992 Katopodis "Introduction to Fishway
 * Design", Freshwater Institute Winnipeg, salinan CSU
 * engr.colostate.edu/~pierre/ce_old/classes/ce717/Manuals/...):
 * - hlm. 16 pers. 5.1: Q* = Q / sqrt(g S0 b0^5), b0 = lebar khas
 *   (bukaan lintasan ikan)
 * - hlm. 20 Gbr. 5.3: plain Denil, B = lebar dalam palung antar dinding,
 *   b0 = lebar bukaan antar sirip samping, L = jarak antar sirip
 * - hlm. 21 Tabel 5.2, Denil 2 (standard Denil): B/b0 = 1,58,
 *   L/b0 = 0,715, y0/b0 = 0,5 sampai 5,8, Q* = 0,94 (y0/b0)^2
 *   (berasal dari Rajaratnam & Katopodis 1984, J. Hydraul. Eng. 110(9))
 */

const close = (a: number, b: number, rel: number, pesan: string) =>
  assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${pesan}: ${a} vs ${b}`);

describe("denilFishway: kurva debit Katopodis (1992) Tabel 5.2 Denil 2", () => {
  it("Q = 0,94 (y/b)^2 sqrt(g S b^5) pada titik hitung tangan", () => {
    // b0 = 1 m, y0 = 1 m, S = 0,16: Q = 0,94 · sqrt(9,81 · 0,16) = 1,1774 m³/s
    const r = denilFishway(1, 1, 0.16, 3);
    close(r.Q, 0.94 * Math.sqrt(G * 0.16), 1e-12, "Q");
  });

  it("Q* sesuai definisi pers. 5.1 dan sama dengan 0,94 (y/b)^2", () => {
    for (const [b, y, S] of [
      [0.6, 0.7, 0.2],
      [0.3, 1.2, 0.12],
      [1.2, 0.8, 0.25],
    ]) {
      const r = denilFishway(b, y, S, 3);
      close(r.Qstar, r.Q / Math.sqrt(G * S * b ** 5), 1e-12, "definisi Q*");
      close(r.Qstar, 0.94 * (y / b) ** 2, 1e-12, "Q* = 0,94 (y/b)^2");
    }
  });

  it("debit sebanding kuadrat kedalaman dan akar kemiringan", () => {
    const a = denilFishway(0.5, 0.5, 0.1, 3).Q;
    close(denilFishway(0.5, 1.0, 0.1, 3).Q / a, 4, 1e-12, "y dua kali");
    close(denilFishway(0.5, 0.5, 0.2, 3).Q / a, Math.SQRT2, 1e-12, "S dua kali");
  });

  it("y/b di luar 0,5 sampai 5,8 ditandai", () => {
    assert.equal(DENIL_YB_MIN, 0.5);
    assert.equal(DENIL_YB_MAX, 5.8);
    assert.equal(denilFishway(1, 0.4, 0.15, 3).relDepthOutOfRange, true);
    assert.equal(denilFishway(0.25, 1.5, 0.15, 3).relDepthOutOfRange, true);
    assert.equal(denilFishway(1, 1, 0.15, 3).relDepthOutOfRange, false);
    assert.equal(denilFishway(1, 0.5, 0.15, 3).relDepthOutOfRange, false);
    assert.equal(denilFishway(0.5, 2.9, 0.15, 3).relDepthOutOfRange, false);
  });
});

describe("checksDenil lolos di seluruh rentang penggeser lembar EH-02", () => {
  it("b 0,25..1,5; y 0,2..2; S 4..40 %", () => {
    const gagal: string[] = [];
    for (let i = 0; i <= 25; i++)
      for (let j = 0; j <= 36; j++)
        for (let s = 4; s <= 40; s += 2) {
          const b = 0.25 + 0.05 * i;
          const y = 0.2 + 0.05 * j;
          const { allPass } = summarise(checksDenil(b, y, s / 100, 3));
          if (!allPass) gagal.push(`b ${b} y ${y} S ${s}`);
        }
    assert.deepEqual(gagal.slice(0, 5), []);
  });
});
