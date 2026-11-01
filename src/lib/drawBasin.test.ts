/*
 * drawBasin: yang digambar animasi = deret model.
 *
 * Lapis gerak membaca keadaan lewat fungsi baca (readAquifer, dst.). Uji
 * ini memastikan fungsi baca tepat sama dengan deret model di titik
 * deretnya, lurus di antara dua titik, dan tidak memotong nilai negatif
 * (keluaran negatif GW-03 harus tampil apa adanya, bertanda).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { aquiferResponse } from "./hydraulics.ts";
import { aquiferTableShape, offsetMap, readAquifer, readRouting } from "./drawBasin.ts";
import { reservoirRouting } from "./hydraulics.ts";
import { hidrografDariTitik } from "./hidrografKendali.ts";
import { linearMap } from "./plateOut.ts";

describe("readAquifer (GW-03)", () => {
  const r = aquiferResponse(1.5, 1.2, 0, 0.15, 0.01);

  it("sama persis dengan deret model di tiap titik deret", () => {
    const k = { head: 0, recharge: 0, outflow: 0 };
    for (const p of r.series) {
      readAquifer(r.series, p.t, k);
      assert.equal(k.head, p.head);
      assert.equal(k.recharge, p.recharge);
      assert.equal(k.outflow, p.outflow);
    }
  });

  it("lurus di antara dua titik deret", () => {
    const k = { head: 0, recharge: 0, outflow: 0 };
    for (let i = 0; i + 1 < r.series.length; i += 37) {
      const a = r.series[i];
      const b = r.series[i + 1];
      readAquifer(r.series, (a.t + b.t) / 2, k);
      assert.ok(Math.abs(k.head - (a.head + b.head) / 2) < 1e-12);
      assert.ok(Math.abs(k.outflow - (a.outflow + b.outflow) / 2) < 1e-9);
    }
  });

  it("neraca yang ditulis lapis gerak = neraca model: Sy·dh/dt·1000 ≈ R − P − q", () => {
    const P = 1.8;
    const m = aquiferResponse(1.5, 1.2, P, 0.15, 0.01);
    const k0 = { head: 0, recharge: 0, outflow: 0 };
    const k1 = { head: 0, recharge: 0, outflow: 0 };
    const k = { head: 0, recharge: 0, outflow: 0 };
    for (const t of [20, 91, 150, 280, 340]) {
      readAquifer(m.series, t - 0.25, k0);
      readAquifer(m.series, t + 0.25, k1);
      readAquifer(m.series, t, k);
      const kiri = (0.15 * ((k1.head - k0.head) / 0.5)) * 1000;
      const kanan = k.recharge - P - k.outflow;
      assert.ok(Math.abs(kiri - kanan) < 1e-3, `t ${t}: ${kiri} vs ${kanan}`);
    }
  });

  it("keluaran negatif saat di bawah ambang tidak dipotong", () => {
    const m = aquiferResponse(1.5, 1.2, 1.8, 0.15, 0.01);
    assert.ok(m.runsDry);
    const k = { head: 0, recharge: 0, outflow: 0 };
    let negatif = false;
    for (let t = 0; t <= 365; t += 5) {
      readAquifer(m.series, t, k);
      if (k.outflow < 0) negatif = true;
    }
    assert.ok(negatif);
  });

  it("lengkung skematik: h di garis pemisah, nol di tepi sungai", () => {
    assert.equal(aquiferTableShape(0.3, 0), 0.3);
    assert.equal(aquiferTableShape(0.3, 1), 0);
    assert.equal(aquiferTableShape(-0.2, 0), -0.2);
  });
});

describe("offsetMap", () => {
  it("geseran bolak-balik tetap sama", () => {
    const m = linearMap({ x0: 10, y0: 20, x1: 210, y1: 120 }, [0, 10], [0, 5]);
    const g = offsetMap(m, 3, 250);
    assert.equal(g.X(4), m.X(4) + 3);
    assert.equal(g.Y(2), m.Y(2) + 250);
    assert.ok(Math.abs(g.invX(g.X(7.5)) - 7.5) < 1e-12);
    assert.ok(Math.abs(g.invY(g.Y(1.25)) - 1.25) < 1e-12);
    assert.equal(g.frame.y0, 270);
  });
});

describe("readRouting (HY-01)", () => {
  const titik = [
    { t: 0, Q: 0 },
    { t: 3, Q: 60 },
    { t: 6, Q: 120 },
    { t: 11, Q: 60 },
    { t: 16, Q: 0 },
    { t: 25.6, Q: 0 },
  ];
  const masuk = hidrografDariTitik(titik, 25.6 / 160, "monoton");
  const r = reservoirRouting(masuk, 200e4, 30, 3, 0.6);

  it("sama persis dengan hasil penelusuran di tiap titik hasil", () => {
    const k = { inflow: 0, outflow: 0, head: 0, storage: 0 };
    for (const p of r.points) {
      readRouting(r.points, p.t, k);
      assert.equal(k.inflow, p.inflow);
      assert.equal(k.outflow, p.outflow);
      assert.equal(k.head, p.head);
      assert.equal(k.storage, p.storage);
    }
  });

  it("tampungan yang digambar = As · h (waduk prismatik model)", () => {
    const k = { inflow: 0, outflow: 0, head: 0, storage: 0 };
    for (const t of [2, 7.3, 11, 20]) {
      readRouting(r.points, t, k);
      assert.ok(Math.abs(k.storage - 200e4 * k.head) < 1e-6 * Math.max(1, k.storage));
    }
  });

  it("titik kendali tercatat persis di deret masuk (puncak 120 tidak hilang)", () => {
    for (const p of titik) assert.ok(masuk.some((m) => m.t === p.t && m.Q === p.Q));
    assert.equal(Math.max(...masuk.map((m) => m.Q)), 120);
  });
});
