import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createJetMotion, createJetPath, finishJetPath, jetAt, jetTransitTime } from "./jetMotion.ts";
import { drawNappe, drawNappeMotion, fillNappePath, nappeSpeed } from "./drawNappe.ts";
import { G, orificeJet, orificeTrajectory, rectWeirDischarge, wesNappe } from "./hydraulics.ts";
import { fillOrificePath, jetAxis, jetVelocity } from "./drawOrifice.ts";

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
  const s = { h, P, q: r.Q / b, tail: 0.2 };
  // Bernoulli dari genangan hulu: kecepatan DATANG Va = q/(h + P), bukan
  // V₀ = q/h di atas mercu (Henderson 1966 §6).
  const Va = s.q / (h + P);
  const E = P + h + (Va * Va) / (2 * G);

  it("E memakai kecepatan datang Va = q/(h + P): laju di mercu 2,451 m/s (bukan 2,639 dari V₀)", () => {
    assert.ok(Math.abs(nappeSpeed(s, P) - Math.sqrt(2 * G * (h + (Va * Va) / (2 * G)))) < 1e-12);
    assert.ok(Math.abs(nappeSpeed(s, P) - 2.451) < 5e-4, `${nappeSpeed(s, P)}`);
    assert.ok(Math.abs(nappeSpeed(s, P) - 2.639) > 0.1);
  });

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

  it("laju tiap titik = √(2g(E − z)), E dari h dan Va = q/(h + P); tebal × laju = q", () => {
    const p = createJetPath("normal");
    fillNappePath(p, s);
    for (let k = 0; k < p.n; k++) {
      const v = Math.sqrt(2 * G * (E - p.z[k]));
      assert.ok(Math.abs(p.v[k] - v) < 1e-9, `v ${k}`);
      assert.ok(Math.abs(p.v[k] - nappeSpeed(s, p.z[k])) < 1e-12);
      assert.ok(Math.abs(p.off1[k] * p.v[k] - s.q) < 1e-9, `q ${k}`);
    }
    // Di bibir mercu laju = √(2g(h + Va²/2g)).
    assert.ok(Math.abs(p.v[0] - Math.sqrt(2 * G * (h + (Va * Va) / (2 * G)))) < 1e-9);
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

describe("HS-07 lapis gerak pancaran: laju dari orificeJet", () => {
  // Nilai awal lembar: H 1,5 m, a 50 mm, b 50 mm, Cv 0,98, Cc 0,62, z0 0,6 m.
  const H = 1.5;
  const a = 0.05;
  const Cv = 0.98;
  const Cc = 0.62;
  const z0 = 0.6;
  const r = orificeJet(H, a, 0.05, Cv, Cc);
  const s = { a, Cc, xVena: r.xVena, z0, V: r.V, notSubmerged: false };
  const out = new Float64Array(2);

  it("V model = Cv·√(2gH)", () => {
    assert.ok(Math.abs(r.V - Cv * Math.sqrt(2 * G * H)) < 1e-12);
  });

  it("di bibir lubang u = Cc·V (= Q/luas lubang), naik monoton sampai V di vena contracta", () => {
    jetVelocity(s, 0, out);
    assert.ok(Math.abs(out[0] - Cc * r.V) < 1e-12, `u bibir ${out[0]}`);
    assert.ok(Math.abs(out[0] - r.Q / r.area) < 1e-12, "u bibir = Q/(a·b)");
    assert.equal(out[1], 0);
    let u0 = out[0];
    for (let k = 1; k <= 20; k++) {
      jetVelocity(s, (r.xVena * k) / 20, out);
      assert.ok(out[0] >= u0 - 1e-12, `monoton ${k}`);
      u0 = out[0];
    }
    jetVelocity(s, r.xVena, out);
    assert.ok(Math.abs(out[0] - r.V) < 1e-12, "u vena contracta = V");
  });

  it("sesudah vena contracta: kecepatan = turunan lintasan peluru dari V (u = V, w = −g·Δx/V)", () => {
    for (const dx of [0.01, 0.2, 0.7, 1.3]) {
      const x = r.xVena + dx;
      jetVelocity(s, x, out);
      assert.ok(Math.abs(out[0] - r.V) < 1e-12, `u ${dx}`);
      // dz/dx dari orificeTrajectory (beda tengah) × u = w.
      const e = 1e-6;
      const dzdx = -(orificeTrajectory(r.V, dx + e) - orificeTrajectory(r.V, dx - e)) / (2 * e);
      assert.ok(Math.abs(out[1] - dzdx * r.V) < 1e-6, `w ${dx}: ${out[1]} vs ${dzdx * r.V}`);
      assert.ok(Math.abs(jetAxis(s, x) - (z0 - orificeTrajectory(r.V, dx))) < 1e-12);
    }
  });

  it("tabel: laju = besar kecepatan; butir pada waktu tempuh τ di sumbu pancaran = lintasan peluru", () => {
    const p = createJetPath("vertical");
    const vMax = fillOrificePath(p, s);
    assert.equal(p.n, 241);
    for (let k = 0; k < p.n; k++) {
      jetVelocity(s, p.x[k], out);
      assert.ok(Math.abs(p.v[k] - Math.hypot(out[0], out[1])) < 1e-12);
    }
    assert.ok(Math.abs(p.v[0] - Cc * r.V) < 1e-12);
    // Pada bagian peluru, waktu dari vena contracta = Δx / V (mendatar tetap V).
    const kV = p.x.findIndex((x, i) => i < p.n && x >= r.xVena);
    const o = new Float64Array(6);
    for (const dt of [0.05, 0.15, 0.25]) {
      jetAt(p, p.tau[kV] + dt, 0.5, o);
      const xExp = r.xVena + r.V * dt;
      assert.ok(Math.abs(o[0] - xExp) / (r.V * dt) < 0.01, `x ${dt}: ${o[0]} vs ${xExp}`);
      const zExp = z0 - 0.5 * G * dt * dt;
      assert.ok(Math.abs(o[1] - zExp) < 2e-3, `z ${dt}: ${o[1]} vs ${zExp}`);
    }
    assert.ok(vMax >= r.V);
  });

  it("lubang tak terendam: tanpa butir", () => {
    const p = createJetPath("vertical");
    assert.equal(fillOrificePath(p, { ...s, notSubmerged: true }), 0);
    assert.equal(p.n, 0);
  });
});
