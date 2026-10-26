import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  VENTURI_ETA_MAX,
  VENTURI_PATH_N,
  createVenturiMotion,
  drawVenturi,
  drawVenturiMotion,
  fillVenturiPath,
  venturiGeometry,
  venturiParticleAt,
  venturiRadius,
  venturiSpeed,
  venturiTimeScale,
  venturiTransitTime,
} from "./drawVenturi.ts";
import { VENTURI_C_MACHINED, venturiDischarge } from "./hydraulics.ts";

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

describe("FM-02 lapis gerak: u(x) = Q/A(x) dari venturiDischarge", () => {
  // Nilai awal lembar: D1 200 mm, D2 100 mm, Δh 0,5 m, C pemesinan.
  const D1 = 0.2;
  const D2 = 0.1;
  const r = venturiDischarge(D1, D2, 0.5, VENTURI_C_MACHINED);
  const g = venturiGeometry(D1, D2);

  it("di pipa u = V1 model, di leher u = V2 model, di antaranya monoton", () => {
    assert.ok(Math.abs(venturiSpeed(D1, D2, r.Q, g.a1 * 0.5) - r.V1) < 1e-12);
    assert.ok(Math.abs(venturiSpeed(D1, D2, r.Q, (g.a2 + g.a3) / 2) - r.V2) < 1e-12);
    assert.ok(Math.abs(venturiSpeed(D1, D2, r.Q, g.L - 1e-6) - r.V1) < 1e-12);
    let u0 = 0;
    for (let k = 0; k <= 20; k++) {
      const u = venturiSpeed(D1, D2, r.Q, g.a1 + ((g.a2 - g.a1) * k) / 20);
      assert.ok(u >= u0 - 1e-12, "menyempit: makin cepat");
      u0 = u;
    }
  });

  it("waktu tempuh = ∫ A/Q dx (jumlah halus terpisah) dan sama dengan venturiTransitTime", () => {
    const m = createVenturiMotion(10);
    fillVenturiPath(m, D1, D2, r.Q);
    let Tref = 0;
    const N = 200000;
    for (let i = 0; i < N; i++) {
      const xm = ((i + 0.5) / N) * g.L;
      const rr = venturiRadius(D1, D2, xm);
      Tref += ((Math.PI * rr * rr) / r.Q) * (g.L / N);
    }
    assert.ok(Math.abs(m.T - Tref) / Tref < 1e-6, `T ${m.T} vs ${Tref}`);
    assert.ok(Math.abs(venturiTransitTime(D1, D2, r.Q) - m.T) / m.T < 1e-12);
    assert.equal(m.x[VENTURI_PATH_N - 1], g.L);
    assert.ok(Math.abs(m.uMax - r.V2) < 1e-12);
  });

  it("butir: laju u = Q/A di letaknya, di dalam pipa, mengikuti garis arus y = η·r(x)", () => {
    const m = createVenturiMotion(10);
    fillVenturiPath(m, D1, D2, r.Q);
    const out = new Float64Array(4);
    for (let k = 0; k <= 200; k++) {
      const tau = (m.T * k) / 200;
      for (const eta of [-VENTURI_ETA_MAX, -0.3, 0, 0.5, VENTURI_ETA_MAX]) {
        venturiParticleAt(m, tau, eta, out);
        const rr = venturiRadius(D1, D2, out[0]);
        assert.ok(Math.abs(out[2] - r.Q / (Math.PI * rr * rr)) < 1e-9, `u τ ${tau}`);
        assert.ok(Math.abs(out[1]) <= rr + 1e-12, "di dalam pipa");
        assert.ok(Math.abs(out[1] - eta * rr) < 1e-12);
      }
    }
    // Di bagian menyempit garis arus atas turun: v < 0 untuk η > 0.
    venturiParticleAt(m, (m.tau[8] + m.tau[48]) / 2, 0.5, out);
    assert.ok(out[0] > g.a1 && out[0] < g.a2 && out[3] < 0);
    // dx/dt pada tabel = u: beda τ kecil di pipa masuk.
    venturiParticleAt(m, 0.01, 0, out);
    const x1 = out[0];
    venturiParticleAt(m, 0.02, 0, out);
    assert.ok(Math.abs((out[0] - x1) / 0.01 - r.V1) < 1e-9);
  });

  it("skala waktu: anak tangga 1-2-5 terdekat ke T/6 s", () => {
    assert.equal(venturiTimeScale(6), 1);
    assert.equal(venturiTimeScale(1.2), 0.2);
    assert.equal(venturiTimeScale(60), 10);
    assert.equal(venturiTimeScale(0), 1);
    const T = venturiTransitTime(D1, D2, r.Q);
    const s = venturiTimeScale(T);
    // Tempuh di layar dalam rentang 2,5..15 s untuk awal lembar.
    assert.ok(T / s > 2.5 && T / s < 15, `layar ${T / s}`);
  });

  it("drawVenturiMotion: butir di dalam pipa, tanpa NaN; bukan venturi tanpa butir", () => {
    const ctx = konteksPalsu();
    const out = drawVenturi(
      ctx,
      820,
      504,
      { D1, D2, V1: r.V1, V2: r.V2, dh: 0.5, permanentLoss: r.permanentLoss, outOfRange: false, notVenturi: false, flow: true },
      "id"
    );
    const m = createVenturiMotion(70);
    for (const t of [0, 0.37, 5.1, 123.4]) {
      drawVenturiMotion(ctx, t, out, { D1, D2, Q: r.Q, notVenturi: false }, m);
      for (let i = 0; i < m.pool.n; i++) {
        const x = m.pool.x[i];
        const y = m.pool.y[i];
        assert.ok(Number.isFinite(x) && Number.isFinite(y));
        assert.ok(x >= 0 && x <= g.L + 1e-9);
        assert.ok(Math.abs(y) <= venturiRadius(D1, D2, x) * VENTURI_ETA_MAX + 1e-6);
      }
    }
    const m2 = createVenturiMotion(5);
    drawVenturiMotion(ctx, 1, out, { D1, D2: 0.3, Q: 0, notVenturi: true }, m2);
    assert.ok(Number.isNaN(m2.D1), "tabel tidak diisi");
  });
});
