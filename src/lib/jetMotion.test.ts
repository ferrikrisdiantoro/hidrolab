import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createJetMotion, createJetPath, finishJetPath, jetAt, jetTransitTime } from "./jetMotion.ts";
import { drawNappe, drawNappeMotion, fillNappePath, nappeSpeed } from "./drawNappe.ts";
import { G, rectWeirDischarge, wesNappe } from "./hydraulics.ts";

/** Konteks kanvas palsu: semua cara gambar tidak berbuat apa-apa. */
function konteksPalsu(): CanvasRenderingContext2D {
  const nop = () => {};
  const ctx: Record<string, unknown> = {
    canvas: { width: 820, height: 504 },
    font: "10px sans-serif",
    measureText: (t: string) => ({ width: [...String(t)].length * 6.5 }),
    getLineDash: () => [],
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  };
  for (const m of [
    "beginPath", "moveTo", "lineTo", "stroke", "fill", "rect", "clip", "save",
    "restore", "arc", "closePath", "fillRect", "strokeRect", "fillText",
    "strokeText", "setLineDash", "setTransform", "translate", "rotate",
    "scale", "clearRect",
  ])
    ctx[m] = nop;
  return ctx as unknown as CanvasRenderingContext2D;
}

describe("jetMotion: butir berjalan dengan laju tabel", () => {
  it("lintasan lurus laju tetap: waktu tempuh = panjang / laju, letak = laju × τ", () => {
    const p = createJetPath("vertical");
    p.n = 11;
    for (let k = 0; k < p.n; k++) {
      p.x[k] = k * 0.1;
      p.z[k] = 0;
      p.v[k] = 2;
      p.off0[k] = -0.01;
      p.off1[k] = 0.01;
    }
    assert.equal(finishJetPath(p), 2);
    assert.ok(Math.abs(jetTransitTime(p) - 0.5) < 1e-12);
    const out = new Float64Array(6);
    jetAt(p, 0.2, 0.5, out);
    assert.ok(Math.abs(out[0] - 0.4) < 1e-12, `x ${out[0]}`);
    assert.ok(Math.abs(out[1]) < 1e-12);
    assert.ok(Math.abs(out[2] - 2) < 1e-12 && Math.abs(out[3]) < 1e-12);
    jetAt(p, 0.2, 1, out);
    assert.ok(Math.abs(out[1] - 0.01) < 1e-12, "lajur 1 di batas atas");
  });
});

describe("HS-06 lapis gerak tirai: laju = Bernoulli dari model lembar", () => {
  const h = 0.3;
  const P = 0.6;
  const b = 2;
  const r = rectWeirDischarge(h, b, P);
  const s = { h, P, V0: r.V0, q: r.Q / b, tail: 0.2 };
  const E = P + h + (r.V0 * r.V0) / (2 * G);

  it("tabel mengikuti sisi bawah tirai WES yang digambar, sampai muka air hilir", () => {
    const p = createJetPath("normal");
    fillNappePath(p, s);
    assert.ok(p.n > 100);
    for (let k = 0; k < p.n; k++) {
      const zWes = Math.max(P - wesNappe(h, p.x[k]), s.tail);
      assert.ok(Math.abs(p.z[k] - zWes) < 1e-9, `z ${k}`);
    }
    assert.equal(p.x[0], 0);
    assert.ok(Math.abs(p.z[p.n - 1] - s.tail) < 1e-9, "berhenti di muka air hilir");
  });

  it("laju tiap titik = √(2g(E − z)), E dari h dan V₀ rectWeirDischarge; tebal × laju = q", () => {
    const p = createJetPath("normal");
    fillNappePath(p, s);
    for (let k = 0; k < p.n; k++) {
      const v = Math.sqrt(2 * G * (E - p.z[k]));
      assert.ok(Math.abs(p.v[k] - v) < 1e-9, `v ${k}`);
      assert.ok(Math.abs(p.v[k] - nappeSpeed(s, p.z[k])) < 1e-12);
      assert.ok(Math.abs(p.off1[k] * p.v[k] - s.q) < 1e-9, `q ${k}`);
    }
    // Di bibir mercu laju = √(2g(h + V₀²/2g)).
    assert.ok(Math.abs(p.v[0] - Math.sqrt(2 * G * (h + (r.V0 * r.V0) / (2 * G)))) < 1e-9);
  });

  it("butir pada waktu tempuh τ melaju √(2g(E − z)) di letaknya (lajur 0)", () => {
    const p = createJetPath("normal");
    fillNappePath(p, s);
    const T = jetTransitTime(p);
    const out = new Float64Array(6);
    for (const f of [0.05, 0.3, 0.6, 0.95]) {
      jetAt(p, f * T, 0, out);
      const v = Math.sqrt(2 * G * (E - out[1]));
      assert.ok(Math.abs(out[4] - v) / v < 0.01, `τ ${f}: ${out[4]} vs ${v}`);
      assert.ok(Math.abs(Math.hypot(out[2], out[3]) - out[4]) < 1e-9);
      assert.ok(out[3] <= 1e-12, "jatuh, tidak naik");
    }
    // Waktu tempuh = ∫ ds / v, dicek dengan jumlah halus terpisah.
    let Tref = 0;
    const N = 20000;
    const zEnd = s.tail;
    const xEnd = p.x[p.n - 1];
    for (let i = 0; i < N; i++) {
      const xa = (xEnd * i) / N;
      const xb = (xEnd * (i + 1)) / N;
      const za = Math.max(P - wesNappe(h, xa), zEnd);
      const zb = Math.max(P - wesNappe(h, xb), zEnd);
      const zm = (za + zb) / 2;
      Tref += Math.hypot(xb - xa, zb - za) / Math.sqrt(2 * G * (E - zm));
    }
    assert.ok(Math.abs(T - Tref) / Tref < 0.01, `T ${T} vs ${Tref}`);
  });

  it("tirai tenggelam (muka air hilir di atas mercu): tanpa lintasan bebas", () => {
    const p = createJetPath("normal");
    assert.equal(fillNappePath(p, { ...s, tail: 0.7 }), 0);
    assert.equal(p.n, 0);
  });

  it("drawNappeMotion: butir di dalam lembaran, di atas muka air hilir, tanpa NaN", () => {
    const ctx = konteksPalsu();
    const out = drawNappe(ctx, 820, 504, { h, P, V0: r.V0, tail: 0.2, outOfRange: false, aerated: true }, "id");
    const m = createJetMotion(70, "normal");
    for (const t of [0, 0.37, 5.1]) {
      drawNappeMotion(ctx, t, out, s, m);
      for (let i = 0; i < m.pool.n; i++) {
        const x = m.pool.x[i];
        const z = m.pool.y[i];
        assert.ok(Number.isFinite(x) && Number.isFinite(z));
        assert.ok(z >= s.tail - 1e-9 && z <= P + s.q / Math.sqrt(2 * G * h) + 1e-6, `z ${z}`);
        assert.ok(x >= -s.q / Math.sqrt(2 * G * h) && x <= 1, `x ${x}`);
      }
    }
  });
});
