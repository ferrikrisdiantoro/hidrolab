import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { schaeferHarvest } from "./hydraulics.ts";
import { kisi, prng } from "./kuis.ts";
import {
  AMBANG_RUNTUH,
  P_E,
  TAHUN,
  awalPermainan,
  majuSetahun,
  mainkan,
  nilaiPermainan,
  type ParamPanen,
} from "./permainanPanen.ts";

/**
 * Permainan EK-02 (Phase 3 K-C). Satu langkah permainan = model lembar
 * dN/dt = r N (1 − N/K) − q E N dijalankan satu tahun dengan E tetap.
 * Pembanding bebas: Runge-Kutta orde empat dengan langkah halus, ditulis di
 * sini, bukan diambil dari berkas yang diuji.
 */

const BAWAAN: ParamPanen = { r: 0.5, K: 1000, q: 0.01 };

function rk4Setahun(p: ParamPanen, N0: number, E: number, n = 4000) {
  const f = (N: number) => p.r * N * (1 - N / p.K) - p.q * E * N;
  const h = 1 / n;
  let N = N0;
  let tangkap = 0;
  for (let i = 0; i < n; i++) {
    const k1 = f(N);
    const k2 = f(N + (h / 2) * k1);
    const k3 = f(N + (h / 2) * k2);
    const k4 = f(N + h * k3);
    // Tangkapan = ∫ q E N dt, Simpson pada titik-titik RK4 yang sama.
    const Nm = N + (h / 2) * k2;
    const N1 = N + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    tangkap += (h / 6) * p.q * E * (N + 4 * Nm + N1);
    N = N1;
  }
  return { N1: N, tangkap };
}

const relatif = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-9);

describe("Permainan EK-02: satu langkah = model lembar satu tahun", () => {
  it("cocok dengan integrasi RK4 halus untuk berbagai r, K, q, E, N0", () => {
    const r = prng(42);
    for (let i = 0; i < 300; i++) {
      const p: ParamPanen = {
        r: 0.05 + 1.95 * r(),
        K: 50 + 19950 * r(),
        q: (1 + 49 * r()) / 1000,
      };
      const E = kisi(P_E)[Math.floor(r() * kisi(P_E).length)];
      const N0 = p.K * (0.01 + 1.2 * r());
      const a = majuSetahun(p, N0, E);
      const b = rk4Setahun(p, N0, E);
      assert.ok(relatif(a.N1, b.N1) < 1e-6, `N1 ${a.N1} vs ${b.N1} (r ${p.r}, q ${p.q}, E ${E})`);
      assert.ok(Math.abs(a.tangkap - b.tangkap) < 1e-6 * Math.max(b.tangkap, p.K), `C ${a.tangkap} vs ${b.tangkap}`);
    }
  });

  it("titik pertumbuhan nol (qE = r) memakai bentuk batasnya, tetap cocok RK4", () => {
    const E = 50; // q E = 0,01 · 50 = 0,5 = r
    const a = majuSetahun(BAWAAN, 400, E);
    const b = rk4Setahun(BAWAAN, 400, E);
    assert.ok(relatif(a.N1, b.N1) < 1e-6);
    assert.ok(relatif(a.tangkap, b.tangkap) < 1e-6);
  });

  it("pada keadaan mantap lembar, populasi tetap dan tangkapan = Y lembar", () => {
    for (const E of [0, 5, 15, 25, 40, 49]) {
      const h = schaeferHarvest(BAWAAN.r, BAWAAN.K, BAWAAN.q, E);
      const s = majuSetahun(BAWAAN, h.stock, E);
      assert.ok(relatif(s.N1, h.stock) < 1e-12, `E ${E}`);
      assert.ok(Math.abs(s.tangkap - h.currentYield) < 1e-9 * BAWAAN.K, `E ${E}`);
    }
  });

  it("ambang runtuh sama dengan tanda collapsed model lembar", () => {
    const { r, K, q } = BAWAAN;
    // E yang membuat N* tepat di ambang: K (1 − qE/r) = AMBANG · K
    const eAmbang = (r / q) * (1 - AMBANG_RUNTUH);
    assert.equal(schaeferHarvest(r, K, q, eAmbang + 1e-6).collapsed, true);
    assert.equal(schaeferHarvest(r, K, q, eAmbang - 1e-3).collapsed, false);
  });

  it("mainkan menyambung langkah: N awal tahun t+1 = N akhir tahun t", () => {
    const efforts = [10, 30, 60, 0, 25];
    const th = mainkan(BAWAAN, efforts);
    assert.equal(th.length, efforts.length);
    assert.equal(th[0].N0, awalPermainan(BAWAAN));
    for (let i = 1; i < th.length; i++) assert.equal(th[i].N0, th[i - 1].N1);
    for (const t of th) {
      const s = majuSetahun(BAWAAN, t.N0, t.E);
      assert.equal(t.N1, s.N1);
      assert.equal(t.tangkap, s.tangkap);
      assert.equal(t.runtuh, t.N1 <= AMBANG_RUNTUH * BAWAAN.K);
    }
  });

  it("menolak upaya di luar rentang penggeser atau bukan kelipatan langkah", () => {
    assert.throws(() => mainkan(BAWAAN, [151]));
    assert.throws(() => mainkan(BAWAAN, [-1]));
    assert.throws(() => mainkan(BAWAAN, [12.5]));
    assert.throws(() => mainkan(BAWAAN, new Array(TAHUN + 1).fill(10)));
  });
});

describe("Permainan EK-02: skor", () => {
  it("skor = Σ tangkapan − max(0, N0 − N_T) − MSY · tahun runtuh", () => {
    const efforts = [40, 40, 10, 150, 150, 150, 150, 0, 0, 5];
    const th = mainkan(BAWAAN, efforts);
    const v = nilaiPermainan(BAWAAN, th);
    const msy = (BAWAAN.r * BAWAAN.K) / 4;
    const total = th.reduce((s, t) => s + t.tangkap, 0);
    const N0 = awalPermainan(BAWAAN);
    const NT = th[th.length - 1].N1;
    const nRuntuh = th.filter((t) => t.N1 <= 0.05 * BAWAAN.K).length;
    assert.ok(nRuntuh > 0, "contoh ini harus memuat tahun runtuh");
    assert.equal(v.msy, msy);
    assert.equal(v.tangkapTotal, total);
    assert.equal(v.kurasan, Math.max(0, N0 - NT));
    assert.equal(v.nRuntuh, nRuntuh);
    assert.equal(v.penalti, msy * nRuntuh);
    assert.equal(v.skor, total - Math.max(0, N0 - NT) - msy * nRuntuh);
    assert.equal(v.batas, msy * th.length);
  });

  it("tanpa upaya: tangkapan nol, stok naik, skor nol (tidak ada kredit stok)", () => {
    const v = nilaiPermainan(BAWAAN, mainkan(BAWAAN, new Array(TAHUN).fill(0)));
    assert.equal(v.tangkapTotal, 0);
    assert.equal(v.kurasan, 0);
    assert.equal(v.skor, 0);
  });

  it("strategi MSY (E tetap = Emsy) mencapai batas MSY · T", () => {
    const eMsy = BAWAAN.r / (2 * BAWAAN.q); // 25, di kisi penggeser
    const v = nilaiPermainan(BAWAAN, mainkan(BAWAAN, new Array(TAHUN).fill(eMsy)));
    assert.equal(v.nRuntuh, 0);
    assert.ok(relatif(v.skor, v.batas) < 1e-9, `${v.skor} vs ${v.batas}`);
  });

  it("Emsy di luar kisi: upaya kisi terdekat tetap ≥ 99 % batas", () => {
    for (const p of [
      { r: 0.55, K: 1000, q: 0.01 },
      { r: 0.37, K: 5000, q: 0.0035 },
      { r: 1.3, K: 250, q: 0.021 },
    ]) {
      const e = Math.round(p.r / (2 * p.q));
      const v = nilaiPermainan(p, mainkan(p, new Array(TAHUN).fill(e)));
      assert.ok(v.skor >= 0.99 * v.batas, `${JSON.stringify(p)} ${v.skor} / ${v.batas}`);
    }
  });

  it("tidak ada strategi yang melampaui batas MSY · T (1000 strategi acak)", () => {
    const r = prng(7);
    const g = kisi(P_E);
    for (let i = 0; i < 1000; i++) {
      const p: ParamPanen = { r: 0.05 + 1.95 * r(), K: 50 + 19950 * r(), q: (1 + 49 * r()) / 1000 };
      const efforts = Array.from({ length: TAHUN }, () => g[Math.floor(r() * g.length)]);
      const v = nilaiPermainan(p, mainkan(p, efforts));
      assert.ok(v.skor <= v.batas * (1 + 1e-9), `${v.skor} > ${v.batas}`);
    }
  });

  it("strategi rakus (upaya maksimum tiap tahun) meruntuhkan populasi dan skornya negatif", () => {
    const th = mainkan(BAWAAN, new Array(TAHUN).fill(P_E.max));
    const v = nilaiPermainan(BAWAAN, th);
    assert.ok(th[TAHUN - 1].N1 < AMBANG_RUNTUH * BAWAAN.K);
    assert.ok(v.nRuntuh >= TAHUN - 3, `runtuh ${v.nRuntuh} tahun`);
    assert.ok(v.skor < 0);
    // Tangkapan kotornya pun di bawah strategi MSY: panen besar hanya sekali.
    assert.ok(v.tangkapTotal < 0.5 * v.batas);
  });

  it("rakus sesaat lalu MSY: tangkapan kotor naik tetapi kurasan membuat skor < batas", () => {
    const efforts = [...new Array(TAHUN - 1).fill(25), 150];
    const v = nilaiPermainan(BAWAAN, mainkan(BAWAAN, efforts));
    const msy = nilaiPermainan(BAWAAN, mainkan(BAWAAN, new Array(TAHUN).fill(25)));
    assert.ok(v.tangkapTotal > msy.tangkapTotal);
    assert.ok(v.skor < msy.skor);
  });
});
