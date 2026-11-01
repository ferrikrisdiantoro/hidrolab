import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { floodHydrograph, scsEffectiveRain } from "./hydraulics.ts";
import {
  floodHydrographBlocks,
  hujanEfektifKumulatif,
  konvolusiHidrografSatuan,
} from "./hidrografHujan.ts";

const IN = 25.4; // mm per inci

/*
 * NEH 630 Bab 10 (USDA NRCS, Juli 2004), Contoh 10-6 dan Tabel 10-2 hlm.
 * 10-17 s.d. 10-18: CN 80, hujan kumulatif tiap jam (inci) dan limpasan
 * kumulatif (inci). Langkah 2 contoh itu membolehkan limpasan dibaca dari
 * pers. 10-11, Lampiran A, atau gambar 10-2; dua baris jelas dibaca dari
 * grafik (P 1,01 → 0,08, rumus 0,086; P 1,55 → 0,32, rumus 0,311). Toleransi
 * 0,01 inci (0,25 mm) per baris, rata-rata galat mutlak < 0,003 inci.
 */
const T10_2_P = [0, 0.15, 0.3, 0.62, 1.01, 1.27, 1.36, 1.36, 1.38, 1.38, 1.55, 1.87, 2.25, 2.61, 2.66, 2.68, 3.22, 4.17, 4.82, 4.93, 5.0];
const T10_2_Q = [0, 0, 0, 0, 0.08, 0.18, 0.22, 0.22, 0.23, 0.23, 0.32, 0.48, 0.72, 0.97, 1.0, 1.02, 1.42, 2.18, 2.74, 2.83, 2.89];

/*
 * NEH 630 Bab 16 (USDA NRCS, Maret 2007), Contoh 16-1, Tabel 16-3 hlm.
 * 16-11: CN 85, pias 0,3 jam, hujan kumulatif dan limpasan kumulatif (inci).
 * Langkah 6 contoh itu membaca limpasan dari kurva massa gambar 16-3; satu
 * baris (P 4,08 → 2,54, rumus 2,529) berselisih 0,011 inci. Toleransi
 * kumulatif 0,012 inci (0,3 mm), per pias 0,02 inci, rata-rata < 0,004.
 */
const T16_3_P = [0.37, 0.87, 1.4, 1.89, 2.24, 2.48, 2.63, 2.7, 2.7, 2.7, 2.71, 2.77, 2.91, 3.2, 3.62, 4.08, 4.43, 4.7, 4.9, 5.0];
const T16_3_Q = [0.0, 0.12, 0.39, 0.72, 0.98, 1.16, 1.28, 1.34, 1.34, 1.34, 1.35, 1.4, 1.51, 1.76, 2.12, 2.54, 2.85, 3.09, 3.28, 3.37];
/** Tabel 16-3 kolom 4, limpasan per pias (inci) */
const T16_3_DQ = [0.0, 0.12, 0.27, 0.33, 0.26, 0.18, 0.12, 0.06, 0.0, 0.0, 0.01, 0.05, 0.11, 0.25, 0.36, 0.42, 0.31, 0.24, 0.19, 0.09];
/** Tabel 16-4(a) kolom 2: ordinat hidrograf satuan tiap 0,3 jam (ft³/s per inci), jumlah 9.914 */
const T16_4_UH = [0, 140, 439, 923, 1332, 1455, 1378, 1166, 873, 601, 436, 324, 235, 171, 124, 90, 65, 47, 35, 25, 18, 14, 11, 7, 4, 1, 0];
/** Tabel 16-4(d) kolom 3: hidrograf banjir (ft³/s) t = 0 … 13,5 jam, jumlah 33.409, puncak 2.356 pada 6,3 jam */
const T16_4_Q = [0, 0, 17, 90, 275, 590, 978, 1334, 1566, 1629, 1528, 1310, 1056, 842, 730, 769, 989, 1358, 1783, 2142, 2346, 2356, 2179, 1863, 1494, 1144, 845, 611, 441, 320, 232, 168, 122, 89, 65, 47, 34, 25, 17, 11, 7, 4, 2, 1, 0, 0];

function keBlok(kumulatifInci: number[], mulaiNol: boolean): number[] {
  const kum = mulaiNol ? kumulatifInci : [0, ...kumulatifInci];
  const b: number[] = [];
  for (let i = 1; i < kum.length; i++) b.push((kum[i] - kum[i - 1]) * IN);
  return b;
}

describe("hujanEfektifKumulatif (NEH 630 Bab 10)", () => {
  it("Tabel 10-2 CN 80: limpasan kumulatif per jam", () => {
    const r = hujanEfektifKumulatif(keBlok(T10_2_P, true), 80);
    for (let i = 0; i < r.PeKum.length; i++) {
      assert.ok(
        Math.abs(r.PeKum[i] / IN - T10_2_Q[i + 1]) <= 0.01,
        `jam ${i + 2}: ${(r.PeKum[i] / IN).toFixed(3)} vs ${T10_2_Q[i + 1]}`
      );
    }
    const mae = r.PeKum.reduce((a, q, i) => a + Math.abs(q / IN - T10_2_Q[i + 1]), 0) / r.PeKum.length;
    assert.ok(mae < 0.003, `MAE ${mae}`);
  });

  it("Tabel 16-3 CN 85: kumulatif dan per pias", () => {
    const r = hujanEfektifKumulatif(keBlok(T16_3_P, false), 85);
    for (let i = 0; i < T16_3_Q.length; i++) {
      assert.ok(Math.abs(r.PeKum[i] / IN - T16_3_Q[i]) <= 0.012, `kum ${i}`);
      assert.ok(Math.abs(r.Pe[i] / IN - T16_3_DQ[i]) <= 0.02, `pias ${i}`);
    }
    const mae = r.PeKum.reduce((a, q, i) => a + Math.abs(q / IN - T16_3_Q[i]), 0) / r.PeKum.length;
    assert.ok(mae < 0.004, `MAE ${mae}`);
  });

  it("jumlah per pias = rumus CN pada hujan total; kehilangan tak pernah negatif", () => {
    const blok = [3, 0, 12, 25, 4, 0, 30, 8];
    const r = hujanEfektifKumulatif(blok, 72);
    const total = r.Pe.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total - scsEffectiveRain(82, 72)) < 1e-9);
    for (let i = 0; i < blok.length; i++) {
      assert.ok(r.Pe[i] >= 0 && r.Pe[i] <= blok[i] + 1e-12);
      assert.ok(Math.abs(r.kehilangan[i] - (blok[i] - r.Pe[i])) < 1e-12);
    }
  });
});

describe("konvolusiHidrografSatuan (NEH 630 Bab 16 Contoh 16-1)", () => {
  it("Tabel 16-4(d) direproduksi dari Tabel 16-3 dan 16-4(a)", () => {
    const Q = konvolusiHidrografSatuan(T16_3_DQ, T16_4_UH);
    assert.equal(Q.length, T16_4_Q.length);
    for (let j = 0; j < Q.length; j++) {
      // Tabel membulatkan ke ft³/s bulat
      assert.ok(Math.abs(Q[j] - T16_4_Q[j]) <= 1, `t=${(0.3 * j).toFixed(1)}: ${Q[j]} vs ${T16_4_Q[j]}`);
    }
    const jumlah = Q.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(jumlah - 33409) <= 25, `jumlah ${jumlah}`);
    const iPuncak = Q.indexOf(Math.max(...Q));
    assert.ok(Math.abs(iPuncak * 0.3 - 6.3) < 1e-9);
  });

  it("isi = jumlah hujan efektif × isi hidrograf satuan", () => {
    const Q = konvolusiHidrografSatuan(T16_3_DQ, T16_4_UH);
    const sumQ = Q.reduce((a, b) => a + b, 0);
    const sumE = T16_3_DQ.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sumQ - sumE * 9914) < 1e-6);
  });
});

describe("floodHydrographBlocks", () => {
  it("pias seragam, kehilangan sebanding = floodHydrograph", () => {
    for (const [P, D, CN, A, tc] of [
      [120, 6, 75, 50, 3],
      [80, 3, 85, 12, 0.3],
      [200, 12, 60, 300, 8],
    ]) {
      const ref = floodHydrograph(P, D, CN, A, tc);
      const n = Math.round(D / ref.blockLength);
      const blok = new Array(n).fill(P / n);
      const r = floodHydrographBlocks(blok, ref.blockLength, CN, A, tc, { kehilangan: "sebanding" });
      assert.equal(r.points.length, ref.points.length);
      for (let i = 0; i < r.points.length; i++) {
        assert.ok(Math.abs(r.points[i].t - ref.points[i].t) < 1e-9);
        assert.ok(Math.abs(r.points[i].Q - ref.points[i].Q) <= 1e-9 * Math.max(1, ref.peak));
        assert.ok(Math.abs(r.points[i].rain - ref.points[i].rain) < 1e-9);
      }
      assert.ok(Math.abs(r.tp - ref.tp) < 1e-12);
      assert.ok(Math.abs(r.qp - ref.qp) < 1e-12);
      assert.ok(Math.abs(r.effectiveRain - ref.effectiveRain) < 1e-9);
      assert.equal(r.blockTooCoarse, ref.blockTooCoarse);
    }
  });

  it("kumulatif (bawaan): isi sama, puncak lebih tinggi daripada sebanding pada hujan seragam", () => {
    const blok = new Array(12).fill(10);
    const a = floodHydrographBlocks(blok, 0.5, 75, 50, 3);
    const b = floodHydrographBlocks(blok, 0.5, 75, 50, 3, { kehilangan: "sebanding" });
    assert.equal(a.kehilangan, "kumulatif");
    assert.ok(Math.abs(a.effectiveRain - b.effectiveRain) < 1e-9);
    assert.ok(Math.abs(a.volume - b.volume) / b.volume < 1e-3);
    // Ia terpenuhi dulu: pias awal tanpa limpasan, sisanya lebih basah
    assert.equal(a.pias[0].Pe, 0);
    assert.ok(a.peak > b.peak);
  });

  it("isi = Pe × A (trapesium, galat < 0,5 %)", () => {
    const blok = [0, 5, 20, 40, 15, 5, 0, 10];
    const A = 25;
    const r = floodHydrographBlocks(blok, 1, 80, A, 4);
    const harapan = (r.effectiveRain / 1000) * A * 1e6;
    assert.ok(Math.abs(r.volume - harapan) / harapan < 5e-3, `${r.volume} vs ${harapan}`);
    assert.ok(Math.abs(r.runoffDepth - r.effectiveRain) / r.effectiveRain < 5e-3);
  });

  it("hujan di akhir menghasilkan puncak lebih tinggi daripada hujan di awal (tampungan tanah terisi dulu)", () => {
    const awal = [40, 20, 10, 5, 0, 0];
    const akhir = [0, 0, 5, 10, 20, 40];
    const ra = floodHydrographBlocks(awal, 1, 70, 40, 3);
    const rb = floodHydrographBlocks(akhir, 1, 70, 40, 3);
    assert.ok(Math.abs(ra.effectiveRain - rb.effectiveRain) < 1e-9);
    assert.ok(rb.peak > ra.peak);
  });

  it("pias kasar ditandai: ΔD > 0,25 Tp (NEH 630 Bab 16 hlm. 16A-3)", () => {
    const r = floodHydrographBlocks([10, 10], 1, 80, 10, 0.5);
    // Tp = 0,5 + 0,3 = 0,8 jam; 0,25 Tp = 0,2 < 1
    assert.ok(Math.abs(r.tp - 0.8) < 1e-12);
    assert.equal(r.blockTooCoarse, true);
  });

  it("tanpa hujan: debit nol, tidak NaN", () => {
    const r = floodHydrographBlocks([0, 0, 0], 1, 80, 10, 2);
    assert.equal(r.peak, 0);
    assert.equal(r.effectiveRain, 0);
    assert.ok(r.points.every((p) => p.Q === 0 && Number.isFinite(p.t)));
  });
});
