/*
 * Uji M8 (GW-03): aquiferResponse memulangkan koefisien pengosongan `alpha`
 * dan keluaran tiap titik deret `series[i].outflow`, lalu neraca tampungan
 * tunggal ditutup di seluruh deret.
 *
 * Persamaan dari fungsi itu sendiri (hydraulics.ts, GW-03):
 *     Sy dh/dt = R(t) − P − α h,
 * dengan keluaran Q = α h (umpan balik linear). Rujukan di komentar fungsi:
 * Kraijenhoff van de Leur (1958); Gelhar (1974) WRR 10(3); Cuthbert (2014)
 * WRR 50(3). Satuan deret: head m, recharge dan outflow mm/hari (sama dengan
 * `baseflow` = α·hMean·1000), t hari, α 1/hari.
 *
 * dh/dt didekati beda tengah pada langkah deret dt = 0,25 hari; galatnya
 * O(dt²), jauh di bawah toleransi 1e-4 × skala imbuhan.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { aquiferResponse } from "./hydraulics.ts";

const SETELAN: [number, number, number, number, number][] = [
  // rechargeMean, rechargeSwing, pumping (mm/hari), Sy, alpha (1/hari)
  [1.5, 1.2, 0, 0.15, 0.01],
  [2, 1, 0.5, 0.15, 0.01],
  [1.5, 1, 1.6, 0.15, 0.01], // muka air turun di bawah ambang
  [3, 2.5, 0.3, 0.3, 0.002], // akuifer lambat, tau 150 hari
  [1, 0.8, 0.2, 0.05, 0.05], // akuifer cepat, tau 1 hari
];

describe("M8 aquiferResponse: alpha dan series[i].outflow", () => {
  for (const [R, dR, P, Sy, alpha] of SETELAN) {
    it(`R=${R}, ΔR=${dR}, P=${P}, Sy=${Sy}, α=${alpha}: alpha dipulangkan, outflow = α·h`, () => {
      const r = aquiferResponse(R, dR, P, Sy, alpha);
      assert.equal(r.alpha, alpha);
      for (const p of r.series) {
        assert.equal(typeof p.outflow, "number");
        assert.ok(Math.abs(p.outflow - alpha * p.head * 1000) <= 1e-12 * Math.max(1, Math.abs(p.outflow)));
      }
    });

    it(`R=${R}, ΔR=${dR}, P=${P}, Sy=${Sy}, α=${alpha}: neraca Sy·dh/dt = R − P − α·h di seluruh deret`, () => {
      const r = aquiferResponse(R, dR, P, Sy, alpha);
      const s = r.series;
      assert.ok(s.length > 100);
      const skala = R + Math.abs(dR) + P;
      let residuMaks = 0;
      for (let i = 1; i < s.length - 1; i++) {
        const dt = s[i + 1].t - s[i - 1].t;
        /* mm/hari */
        const simpan = (Sy * (s[i + 1].head - s[i - 1].head) * 1000) / dt;
        const neraca = s[i].recharge - P - s[i].outflow;
        residuMaks = Math.max(residuMaks, Math.abs(simpan - neraca));
      }
      assert.ok(residuMaks < 1e-4 * skala, `residu terbesar ${residuMaks} mm/hari`);
    });

    it(`R=${R}, ΔR=${dR}, P=${P}, Sy=${Sy}, α=${alpha}: rata-rata outflow semusim = baseflow`, () => {
      const r = aquiferResponse(R, dR, P, Sy, alpha);
      /* Deret memuat titik t = 0 dan t = musim; buang satu ujung supaya
         rata-ratanya tepat satu musim penuh. */
      const s = r.series.slice(0, -1);
      const rata = s.reduce((a, p) => a + p.outflow, 0) / s.length;
      assert.ok(Math.abs(rata - r.baseflow) < 1e-3 * Math.max(1, Math.abs(r.baseflow)), `${rata} vs ${r.baseflow}`);
    });
  }
});
