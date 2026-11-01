import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createJetMotion, jetAt, jetTransitTime } from "./jetMotion.ts";
import {
  EDDY_SPEED_RATIO,
  coreSpeed,
  eddySpeed,
  expansionTransitTime,
  fillExpansionPath,
  jetRadius,
  placeEddy,
  reattachLength,
} from "./expansionMotion.ts";
import { momentumForce } from "./hydraulics.ts";
import { createPool } from "./motion.ts";

describe("PI-06 lapis gerak: laju inti dari model momentumForce", () => {
  // Nilai awal lembar: Q 0,25, D1 0,25, D2 0,45, H 30.
  const Q = 0.25;
  const D1 = 0.25;
  const D2 = 0.45;
  const r = momentumForce(Q, D1, D2, 30, 0);
  const s = { Q, D1, D2, L: Math.max(D1, D2) * 2.6 };

  it("hulu = V1 model, sesudah menempel = V2 model, di antaranya turun monoton", () => {
    assert.ok(Math.abs(coreSpeed(s, -0.3) - r.velocity1) < 1e-12);
    const Lr = reattachLength(D1, D2);
    assert.ok(Math.abs(Lr - 8 * 0.1) < 1e-12);
    assert.ok(Math.abs(coreSpeed(s, Lr) - r.velocity2) < 1e-12);
    assert.ok(Math.abs(coreSpeed(s, s.L) - r.velocity2) < 1e-12);
    let u0 = Infinity;
    for (let k = 0; k <= 40; k++) {
      const u = coreSpeed(s, (Lr * k) / 40);
      assert.ok(u <= u0 + 1e-12);
      u0 = u;
    }
  });

  it("debit inti tetap Q di setiap x (zona pusaran tanpa debit bersih)", () => {
    for (let k = -10; k <= 40; k++) {
      const x = (s.L * k) / 40;
      const rj = jetRadius(s, x);
      assert.ok(Math.abs(coreSpeed(s, x) * Math.PI * rj * rj - Q) < 1e-12);
    }
  });

  it("tabel: laju butir = u(x) di letaknya, butir di dalam pancaran; waktu tempuh = rumus", () => {
    const m = createJetMotion(10, "vertical");
    m.vMax = fillExpansionPath(m.path, s);
    assert.ok(Math.abs(m.vMax - r.velocity1) < 1e-12);
    const out = new Float64Array(6);
    const T = jetTransitTime(m.path);
    for (let k = 0; k <= 400; k++) {
      jetAt(m.path, (T * k) / 400, (k % 7) / 6, out);
      const u = coreSpeed(s, out[0]);
      assert.ok(Math.abs(out[4] - u) / u < 2e-3, `laju ${out[4]} vs ${u} di x ${out[0]}`);
      assert.ok(Math.abs(out[1]) <= jetRadius(s, out[0]) + 1e-9);
    }
    const Tr = expansionTransitTime(s);
    assert.ok(Math.abs(T - Tr) / Tr < 1e-3, `T tabel ${T} vs ${Tr}`);
  });

  it("pembesaran yang lebih panjang dari gambar: lintasan berhenti di ujung gambar", () => {
    const b = { Q: 0.1, D1: 0.05, D2: 1.6, L: 1.6 * 2.6 };
    assert.ok(reattachLength(b.D1, b.D2) > b.L);
    const m = createJetMotion(4, "vertical");
    fillExpansionPath(m.path, b);
    assert.ok(Math.abs(m.path.x[m.path.n - 1] - b.L) < 1e-12);
    const Tr = expansionTransitTime(b);
    assert.ok(Math.abs(jetTransitTime(m.path) - Tr) / Tr < 5e-3);
  });

  it("penyempitan dan penampang tetap: tanpa lintasan", () => {
    const m = createJetMotion(4, "vertical");
    assert.equal(fillExpansionPath(m.path, { Q, D1: 0.45, D2: 0.25, L: 1 }), 0);
    assert.equal(fillExpansionPath(m.path, { Q, D1: 0.3, D2: 0.3, L: 1 }), 0);
    assert.equal(expansionTransitTime({ Q, D1: 0.45, D2: 0.25, L: 1 }), 0);
  });

  it("laju edar pusaran = 0,2 (V1 − V2), nol tanpa loncatan kecepatan", () => {
    assert.equal(EDDY_SPEED_RATIO, 0.2);
    assert.ok(Math.abs(eddySpeed(r.velocity1, r.velocity2) - 0.2 * (r.velocity1 - r.velocity2)) < 1e-12);
    assert.equal(eddySpeed(1, 1), 0);
    assert.equal(eddySpeed(1, 2), 0);
  });

  it("butir pusaran selalu di zona sudut (antara pancaran dan dinding), laju keliling rata-rata ≈ U", () => {
    const r1 = D1 / 2;
    const r2 = D2 / 2;
    const Lr = reattachLength(D1, D2);
    const U = eddySpeed(r.velocity1, r.velocity2);
    const p = createPool(24);
    let jumlah = 0;
    let n = 0;
    for (let k = 0; k < 200; k++) {
      placeEddy(p, k * 0.037, r1, r2, Lr, U);
      for (let i = 0; i < 24; i++) {
        const z = Math.abs(p.y[i]);
        assert.ok(p.x[i] >= -1e-9 && p.x[i] <= Lr + 1e-9, "x di zona");
        assert.ok(z <= r2 + 1e-9, "di dalam dinding");
        assert.ok(z >= jetRadius(s, p.x[i]) - 1e-9, "di luar pancaran");
        jumlah += Math.hypot(p.u[i], p.v[i]);
        n++;
      }
    }
    const rata = jumlah / n;
    assert.ok(Math.abs(rata - U) / U < 0.25, `rata ${rata} vs ${U}`);
  });
});
