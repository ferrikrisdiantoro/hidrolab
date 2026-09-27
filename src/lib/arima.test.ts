import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { autoArima, fitArima, forecastArima, kpss, oneStepPredictions } from "./arima.ts";

const ACUAN = JSON.parse(readFileSync(new URL("./arimaReference.json", import.meta.url), "utf8"));

const dekat = (a: number, b: number, tol: number, pesan: string) =>
  assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${pesan}: ${a} bukan ${b}`);

describe("HY-06 ARIMA terhadap statsmodels", () => {
  for (const k of ACUAN.kasus) {
    const [p, d, q] = k.order;
    const [P, D, Q, s] = k.seasonal;
    const nama = `${k.deret} (${p},${d},${q})(${P},${D},${Q})${s}`;
    it(nama, () => {
      const y: number[] = ACUAN.deret[k.deret];
      const f = fitArima(y, { p, d, q, P, D, Q, s })!;
      assert.ok(f, "gagal dicocokkan");
      dekat(f.loglik, k.loglik, 1e-4, "kemungkinan log");
      for (let i = 0; i < p; i++) dekat(f.ar[i], k.params[`ar.L${i + 1}`], 2e-3, `ar.L${i + 1}`);
      for (let i = 0; i < q; i++) dekat(f.ma[i], k.params[`ma.L${i + 1}`], 2e-3, `ma.L${i + 1}`);
      if (P) dekat(f.sar[0], k.params[`ar.S.L${s}`], 5e-3, "ar.S");
      if (Q) dekat(f.sma[0], k.params[`ma.S.L${s}`], 5e-3, "ma.S");
      if (k.params.const !== undefined) dekat(f.mean, k.params.const, 2e-3, "rata-rata");
      const ramal = forecastArima(f, 10);
      k.forecast.forEach((v: number, i: number) => dekat(ramal[i], v, 3e-3, `ramalan ${i + 1}`));
    });
  }

  it("KPSS sama dengan statsmodels", () => {
    for (const nama of ["arma", "jalan"]) dekat(kpss(ACUAN.deret[nama]), ACUAN.kpss[nama], 1e-10, nama);
  });

  it("ramalan satu langkah di titik terakhir sama dengan ramalan pertama deret yang dipotong", () => {
    const y: number[] = ACUAN.deret.jalan;
    const f = fitArima(y, { p: 1, d: 1, q: 1 })!;
    const satu = oneStepPredictions(f, y);
    const pendek = { ...f, y: y.slice(0, -1) };
    dekat(satu[satu.length - 1], forecastArima(pendek, 1)[0], 1e-10, "satu langkah");
  });

  it("ARIMA otomatis memilih d = 1 untuk deret acak berjalan dan d = 0 untuk ARMA", () => {
    assert.equal(autoArima(ACUAN.deret.jalan)!.order.d, 1);
    assert.equal(autoArima(ACUAN.deret.arma)!.order.d, 0);
  });
});
