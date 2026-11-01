import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  JEDA_ULANG,
  KIBAS_TAMPIL_MAKS,
  renangKeadaan,
  renangPada,
  renangSiklus,
  renangSkalaWaktu,
} from "./drawRenang.ts";
import { SWIM_BURST_TIME, fishSwim } from "./hydraulics.ts";
import { tailBeat } from "./renangGerak.ts";

const dekat = (a: number, b: number, tol: number, pesan = "") =>
  assert.ok(Math.abs(a - b) <= tol, `${pesan} ${a} != ${b} (tol ${tol})`);

describe("EH-04 lajur renang = fishSwim", () => {
  it("arus di bawah sentak: ikan menahan diri, renang = V, tahan = ketahanan model", () => {
    for (const [L, V] of [
      [0.2, 0.8],
      [0.08, 0.4],
      [0.7, 2.5],
      [0.2, 0.3],
    ]) {
      const r = fishSwim(L, V, 2, 10);
      const k = renangKeadaan(L, V, 2, 10);
      assert.equal(k.gagal, false);
      assert.equal(k.maju, 0);
      assert.equal(k.renang, V);
      assert.equal(k.tahan, r.endurance);
      const tb = tailBeat(V, L);
      assert.equal(k.kibas.frequency, tb.frequency);
      assert.equal(k.kibas.amplitude, tb.amplitude);
      assert.equal(k.kibas.outOfRange, tb.outOfRange);
    }
  });

  it("tidak mampu: renang = Ub, maju = Ub - V (<= 0) selama 20 s, kibasan pada Ub", () => {
    const L = 0.2;
    for (const V of [2, 2.5, 4]) {
      const r = fishSwim(L, V, 2, 10);
      assert.equal(r.mode, "tidak-mampu");
      const k = renangKeadaan(L, V, 2, 10);
      assert.equal(k.gagal, true);
      assert.equal(k.renang, r.burst);
      assert.equal(k.maju, r.groundSpeed);
      assert.ok(k.maju <= 0);
      assert.equal(k.tahan, SWIM_BURST_TIME);
      assert.equal(k.kibas.frequency, tailBeat(r.burst, L).frequency);
    }
  });

  it("keputusan gagal sama dengan mode model di seluruh rentang penggeser", () => {
    for (let Lcm = 2; Lcm <= 150; Lcm += 7)
      for (let V = 0.02; V <= 6; V += 0.29)
        for (const [s, b] of [
          [2, 10],
          [0.5, 4],
          [5, 20],
        ]) {
          const r = fishSwim(Lcm / 100, V, s, b);
          const k = renangKeadaan(Lcm / 100, V, s, b);
          assert.equal(k.gagal, r.mode === "tidak-mampu");
          assert.equal(k.berlaku, !r.impossible);
        }
  });

  it("keadaan mustahil tidak berlaku", () => {
    assert.equal(renangKeadaan(0.2, 0.8, 5, 4).berlaku, false);
  });

  it("posisi: diam selama tahan, fase = 2 pi f t; sesudahnya hanyut dengan V tanpa kibasan", () => {
    const k = renangKeadaan(0.2, 1.5, 2, 10); // sentak, tahan berhingga
    assert.ok(Number.isFinite(k.tahan));
    const f = k.kibas.frequency;
    const p1 = renangPada(k, k.tahan * 0.5);
    assert.equal(p1.x, 0);
    assert.equal(p1.lelah, false);
    dekat(p1.phase, 2 * Math.PI * f * k.tahan * 0.5, 1e-9);
    const p2 = renangPada(k, k.tahan + 2);
    assert.equal(p2.lelah, true);
    dekat(p2.x, -1.5 * 2, 1e-9, "hanyut 2 s pada 1,5 m/s");
    dekat(p2.phase, 2 * Math.PI * f * k.tahan, 1e-9);
  });

  it("tidak mampu: terdorong mundur dengan Ub - V", () => {
    const k = renangKeadaan(0.2, 3, 2, 10); // Ub 2, V 3
    const p = renangPada(k, 4);
    dekat(p.x, (2 - 3) * 4, 1e-9);
  });

  it("jelajah tidak pernah lelah: siklus tak hingga", () => {
    const k = renangKeadaan(0.2, 0.3, 2, 10);
    assert.equal(k.tahan, Infinity);
    assert.equal(renangSiklus(k, 1), Infinity);
    assert.equal(renangPada(k, 1e6).lelah, false);
  });

  it("siklus berakhir tepat saat ekor keluar tepi hilir, ditambah jeda", () => {
    const k = renangKeadaan(0.2, 1.5, 2, 10);
    const separuh = 1;
    const T = renangSiklus(k, separuh);
    const p = renangPada(k, T - JEDA_ULANG);
    dekat(p.x, -(separuh + k.L / 2), 1e-9);
    const g = renangKeadaan(0.2, 4, 2, 10); // terdorong 2 m/s, keluar sebelum 20 s
    const Tg = renangSiklus(g, separuh);
    dekat(renangPada(g, Tg - JEDA_ULANG).x, -(separuh + g.L / 2), 1e-9);
    assert.ok(Tg - JEDA_ULANG < SWIM_BURST_TIME);
  });

  it("skala waktu: waktu nyata bila kibasan <= batas tampil, selain itu f x skala = batas", () => {
    const pelan = renangKeadaan(1, 0.5, 2, 10); // f = 2
    assert.equal(renangSkalaWaktu(pelan), 1);
    const cepat = renangKeadaan(0.2, 1.5, 2, 10);
    const s = renangSkalaWaktu(cepat);
    assert.ok(s < 1);
    dekat(cepat.kibas.frequency * s, KIBAS_TAMPIL_MAKS, 1e-12);
  });
});
