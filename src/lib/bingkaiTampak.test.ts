import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { hitungDiLuarBingkai } from "./bingkaiTampak.ts";

/*
 * Temuan uji rekan V20 (FP-02): pesan "N pusaran yang ditaruh di luar
 * bingkai" tampil padahal semua pusaran terlihat. Bidang nominal (rentang
 * yang diminta) lebih sempit daripada bingkai yang tergambar karena
 * drawField memakai skala sama di kedua sumbu: ruang sisa di kiri-kanan
 * atau atas-bawah tetap tergambar. Hitungannya harus memakai bingkai.
 */
describe("hitungDiLuarBingkai", () => {
  // Bingkai 400 x 200 px; rentang nominal x -1..1, y -1..1 dengan skala
  // sama 100 px/m: x tampak -2..2, y tampak -1..1.
  const map = {
    X: (x: number) => 200 + x * 100,
    Y: (y: number) => 100 - y * 100,
    frame: { x0: 0, y0: 0, x1: 400, y1: 200 },
  };
  it("titik di luar rentang nominal tetapi di dalam bingkai tidak dihitung", () => {
    assert.equal(hitungDiLuarBingkai([{ x: 1.5, y: 0 }, { x: -1.9, y: 0.5 }], map), 0);
  });
  it("titik di luar bingkai dihitung", () => {
    assert.equal(hitungDiLuarBingkai([{ x: 2.5, y: 0 }, { x: 0, y: 1.2 }, { x: 0, y: 0 }], map), 2);
  });
  it("tepi bingkai dengan toleransi setengah piksel masih di dalam", () => {
    assert.equal(hitungDiLuarBingkai([{ x: 2, y: -1 }, { x: 2.004, y: 0 }], map), 0);
  });
});
