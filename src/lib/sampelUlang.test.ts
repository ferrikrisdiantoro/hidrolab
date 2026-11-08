/*
 * Uji sampelUlang.ts (EK-03 "ambil sampel lagi").
 *
 * Acuan: banyaknya bertanda m di dalam tangkapan kedua n, dari populasi
 * tertutup N yang M di antaranya bertanda, berdistribusi hipergeometrik
 * (Chapman 1951; Seber 1982 §3.1.1):
 *   E[m]   = n M / N
 *   Var[m] = n (M/N) (1 − M/N) (N − n) / (N − 1)
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ambilSampel,
  histogram,
  momenHipergeometrik,
  rngBerbenih,
  tangkapanBertanda,
} from "./sampelUlang.ts";

describe("rngBerbenih", () => {
  it("benih sama memberi deret sama, benih beda memberi deret beda", () => {
    const a = rngBerbenih(7);
    const b = rngBerbenih(7);
    const c = rngBerbenih(8);
    const da = [a(), a(), a()];
    assert.deepEqual(da, [b(), b(), b()]);
    assert.notDeepEqual(da, [c(), c(), c()]);
    for (const v of da) assert.ok(v >= 0 && v < 1);
  });
});

describe("tangkapanBertanda: sebaran hipergeometrik", () => {
  const kasus = [
    { N: 1000, M: 200, n: 150 },
    { N: 300, M: 80, n: 120 },
    { N: 50, M: 45, n: 40 },
  ];
  for (const { N, M, n } of kasus) {
    it(`rerata dan ragam pada 20000 benih, N ${N} M ${M} n ${n}`, () => {
      const K = 20000;
      let s = 0;
      let s2 = 0;
      for (let k = 1; k <= K; k++) {
        const m = tangkapanBertanda(N, M, n, k);
        assert.ok(Number.isInteger(m));
        assert.ok(m >= Math.max(0, n - (N - M)) && m <= Math.min(M, n));
        s += m;
        s2 += m * m;
      }
      const rerata = s / K;
      const ragam = s2 / K - rerata * rerata;
      const teori = momenHipergeometrik(N, M, n);
      assert.ok(Math.abs(teori.mean - (n * M) / N) < 1e-12);
      // galat baku rerata = √(Var/K); toleransi 4 galat baku
      const gb = Math.sqrt(teori.variance / K);
      assert.ok(Math.abs(rerata - teori.mean) < 4 * gb + 1e-9, `rerata ${rerata} vs ${teori.mean}`);
      // ragam sampel: toleransi relatif 5 %
      assert.ok(Math.abs(ragam - teori.variance) / teori.variance < 0.05, `ragam ${ragam} vs ${teori.variance}`);
    });
  }

  it("sampel seluruh populasi selalu memuat semua yang bertanda", () => {
    for (let k = 1; k <= 50; k++) assert.equal(tangkapanBertanda(120, 30, 120, k), 30);
  });

  it("benih sama memberi tangkapan sama", () => {
    assert.equal(tangkapanBertanda(1000, 200, 150, 42), tangkapanBertanda(1000, 200, 150, 42));
  });
});

describe("ambilSampel", () => {
  it("taksiran dihitung dari m hasil tarikan dan benih ikut dicatat", () => {
    const s = ambilSampel(1000, 200, 150, 9);
    assert.equal(s.benih, 9);
    assert.equal(s.m, tangkapanBertanda(1000, 200, 150, 9));
    assert.ok(Math.abs(s.chapman - ((201 * 151) / (s.m + 1) - 1)) < 1e-9);
    assert.equal(s.petersen, s.m > 0 ? (200 * 150) / s.m : Infinity);
  });

  it("rerata Chapman dari banyak benih dekat N (hampir tak bias bila M + n ≥ N)", () => {
    const N = 300;
    let s = 0;
    const K = 5000;
    for (let k = 1; k <= K; k++) s += ambilSampel(N, 120, 200, k).chapman;
    assert.ok(Math.abs(s / K - N) < 3, `rerata ${s / K}`);
  });
});

describe("histogram", () => {
  it("menghitung semua nilai, termasuk di tepi atas, dan mencatat yang di luar", () => {
    const h = histogram([0, 1, 1.5, 2, 9.99, 10, 12, -1, Infinity], 0, 10, 5);
    assert.equal(h.bins.length, 5);
    assert.deepEqual(h.bins.map((b) => b.count), [3, 1, 0, 0, 2]);
    assert.equal(h.bins[0].x0, 0);
    assert.equal(h.bins[4].x1, 10);
    assert.equal(h.diAtas, 2);
    assert.equal(h.diBawah, 1);
  });
});
