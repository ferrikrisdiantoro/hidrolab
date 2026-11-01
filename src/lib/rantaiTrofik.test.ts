import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { trophicCascade, trophicEquilibrium, type ParamRantai } from "./rantaiTrofik.ts";

/*
 * Parameter uji (bukan angka lapangan): dipilih supaya ambang panjang rantai
 * bisa dihitung tangan dari keseimbangan.
 *   2 tingkat: N1 = m2/(e a1) = 0,5/(0,1·0,01) = 500, perlu K > 500
 *   3 tingkat: N2 = m3/(e a2) = 0,2/(0,1·0,05) = 40, N1 = 0,6 K, perlu K > 833,3
 *   4 tingkat: N3 = m4/(e a3) = 10, N1 = 1000, N2 = 100(1 − 1000/K),
 *              N4 = (0,005 N2 − 0,2)/0,1, perlu K > 1666,7
 */
const dasar = (K: number): ParamRantai => ({
  production: K,
  growth: 1,
  efficiency: 0.1,
  grazing: [0.01, 0.05, 0.1],
  mortality: [0, 0.5, 0.2, 0.1],
});

describe("trophicEquilibrium (Oksanen dkk. 1981, ringkasan Aunapuu dkk. 2008 gb. 1)", () => {
  it("panjang rantai naik bertahap dengan produktivitas", () => {
    assert.equal(trophicEquilibrium(4, dasar(400)).persisting, 1);
    assert.equal(trophicEquilibrium(4, dasar(700)).persisting, 2);
    assert.equal(trophicEquilibrium(4, dasar(1200)).persisting, 3);
    assert.equal(trophicEquilibrium(4, dasar(5000)).persisting, 4);
  });

  it("nilai keseimbangan sesuai hitungan tangan (K = 5000)", () => {
    const r = trophicEquilibrium(4, dasar(5000));
    const harapan = [1000, 80, 10, 2];
    for (let i = 0; i < 4; i++) assert.ok(Math.abs(r.biomass[i] - harapan[i]) < 1e-9, `tingkat ${i + 1}`);
    assert.ok(r.residual < 1e-9);
  });

  it("2 tingkat: tumbuhan terkunci, herbivora naik dengan produktivitas", () => {
    const a = trophicEquilibrium(4, dasar(600));
    const b = trophicEquilibrium(4, dasar(800));
    assert.ok(Math.abs(a.biomass[0] - 500) < 1e-9 && Math.abs(b.biomass[0] - 500) < 1e-9);
    assert.ok(b.biomass[1] > a.biomass[1]);
    assert.equal(a.biomass[2], 0);
  });

  it("3 tingkat: herbivora terkunci, tumbuhan dan karnivora naik", () => {
    const a = trophicEquilibrium(4, dasar(1000));
    const b = trophicEquilibrium(4, dasar(1500));
    assert.ok(Math.abs(a.biomass[1] - 40) < 1e-9 && Math.abs(b.biomass[1] - 40) < 1e-9);
    assert.ok(b.biomass[0] > a.biomass[0]);
    assert.ok(b.biomass[2] > a.biomass[2]);
  });

  it("4 tingkat: tingkat 1 dan 3 terkunci, tingkat 2 dan 4 naik", () => {
    const a = trophicEquilibrium(4, dasar(3000));
    const b = trophicEquilibrium(4, dasar(6000));
    assert.ok(Math.abs(a.biomass[0] - b.biomass[0]) < 1e-9);
    assert.ok(Math.abs(a.biomass[2] - b.biomass[2]) < 1e-9);
    assert.ok(b.biomass[1] > a.biomass[1] && b.biomass[3] > a.biomass[3]);
  });
});

describe("trophicCascade (Carpenter, Kitchell & Hodgson 1985)", () => {
  it("tanpa gangguan: tetap di keseimbangan", () => {
    const r = trophicCascade(4, dasar(5000), { level: 4, factor: 1, at: 5 }, 50);
    const eq = trophicEquilibrium(4, dasar(5000)).biomass;
    const akhir = r.biomass[r.biomass.length - 1];
    for (let i = 0; i < 4; i++) assert.ok(Math.abs(akhir[i] - eq[i]) / eq[i] < 1e-6);
  });

  it("predator puncak berkurang separuh: tanda tanggapan berselang-seling ke bawah (hlm. 634)", () => {
    // "a rise in piscivore biomass brings decreased planktivore biomass,
    // increased herbivore biomass, and decreased phytoplankton biomass";
    // penurunan predator memberi kebalikannya.
    const r = trophicCascade(4, dasar(5000), { level: 4, factor: 0.5, at: 5 }, 300);
    assert.deepEqual(r.responseSign, [1, -1, 1, -1]);
    assert.deepEqual(r.signFlip, [true, true, true, false]);
  });

  it("predator puncak bertambah: kebalikannya", () => {
    const r = trophicCascade(4, dasar(5000), { level: 4, factor: 2, at: 5 }, 300);
    assert.deepEqual(r.responseSign, [-1, 1, -1, 1]);
  });

  it("tanggapan merambat dengan tundaan: makin jauh dari tingkat yang diganggu, makin lambat (hlm. 636)", () => {
    const r = trophicCascade(4, dasar(5000), { level: 4, factor: 0.5, at: 5 }, 300);
    assert.equal(r.responseLag[3], 0);
    assert.ok(r.responseLag[2] > 0);
    assert.ok(r.responseLag[1] > r.responseLag[2], `${r.responseLag}`);
    assert.ok(r.responseLag[0] > r.responseLag[1], `${r.responseLag}`);
    assert.ok(r.peakLag.every((x, i) => x >= r.responseLag[i]));
  });

  it("gangguan denyut: kembali ke keadaan yang sama (hlm. 636)", () => {
    const r = trophicCascade(4, dasar(5000), { level: 4, factor: 0.5, at: 5 }, 600);
    const eq = trophicEquilibrium(4, dasar(5000)).biomass;
    const akhir = r.biomass[r.biomass.length - 1];
    for (let i = 0; i < 4; i++) assert.ok(Math.abs(akhir[i] - eq[i]) / eq[i] < 0.01, `tingkat ${i + 1}: ${akhir[i]} vs ${eq[i]}`);
  });

  it("deret: t tidak turun (berulang hanya di saat denyut), biomassa tak negatif, larik selaras", () => {
    const r = trophicCascade(3, dasar(1200), { level: 1, factor: 0.3, at: 2 }, 40);
    assert.equal(r.t.length, r.biomass.length);
    let ulang = 0;
    for (let k = 1; k < r.t.length; k++) {
      assert.ok(r.t[k] >= r.t[k - 1]);
      if (r.t[k] === r.t[k - 1]) {
        ulang++;
        assert.equal(r.t[k], 2);
        assert.ok(Math.abs(r.biomass[k][0] - 0.3 * r.biomass[k - 1][0]) < 1e-9);
      }
    }
    assert.equal(ulang, 1);
    assert.ok(r.biomass.every((row) => row.length === 3 && row.every((x) => x >= 0)));
    assert.equal(r.t[r.t.length - 1], 40);
  });

  it("tingkat yang tidak tertopang tetap nol dan ditandai", () => {
    const r = trophicCascade(4, dasar(700), { level: 4, factor: 0.5, at: 2 }, 30);
    assert.equal(r.persisting, 2);
    assert.ok(r.biomass.every((row) => row[2] === 0 && row[3] === 0));
    assert.equal(r.responseSign[3], 0);
  });
});
