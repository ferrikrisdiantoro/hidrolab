import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  advect,
  createPool,
  drawStreaks,
  respawnInlet,
  scatter,
  type Domain,
  type VelocityField,
} from "./motion.ts";
import { linearMap } from "./plateOut.ts";

const dom: Domain = { x0: 0, x1: 10, y0: 0, y1: 2 };
const seragam = (u: number, v = 0): VelocityField => (_x, _y, out) => {
  out[0] = u;
  out[1] = v;
};

describe("motion: advect", () => {
  it("memajukan partikel sejauh u·dt (Float32)", () => {
    const p = createPool(50);
    scatter(p, { x0: 1, x1: 5, y0: 0.2, y1: 1.8 });
    const x0 = Float32Array.from(p.x);
    const y0 = Float32Array.from(p.y);
    advect(p, seragam(2.5, -0.4), 0.1, dom);
    for (let i = 0; i < p.n; i++) {
      assert.ok(Math.abs(p.x[i] - (x0[i] + 0.25)) < 1e-5, `x ${i}`);
      assert.ok(Math.abs(p.y[i] - (y0[i] - 0.04)) < 1e-5, `y ${i}`);
      assert.ok(Math.abs(p.u[i] - 2.5) < 1e-6);
      assert.ok(Math.abs(p.v[i] + 0.4) < 1e-6);
      assert.ok(Math.abs(p.age[i] - 0.1) < 1e-6);
    }
  });

  it("kecepatan berbeda per tempat diikuti (medan, bukan konstanta)", () => {
    const p = createPool(2);
    p.x[0] = 1; p.y[0] = 0.5;
    p.x[1] = 1; p.y[1] = 1.5;
    // u = y: lapisan atas dua kali lebih cepat dari 0,75 m
    advect(p, (_x, y, out) => { out[0] = y; out[1] = 0; }, 0.2, dom);
    assert.ok(Math.abs(p.x[0] - 1.1) < 1e-6);
    assert.ok(Math.abs(p.x[1] - 1.3) < 1e-6);
  });

  it("partikel yang keluar domain lahir ulang di tepi hulu", () => {
    const p = createPool(3);
    p.x[0] = 9.9; p.y[0] = 1;   // keluar kanan
    p.x[1] = 5; p.y[1] = 1;     // tetap di dalam
    p.x[2] = 5; p.y[2] = 1.99;  // keluar atas karena v
    p.age.fill(3);
    advect(p, (_x, y, out) => { out[0] = 1; out[1] = y > 1.9 ? 1 : 0; }, 0.2, dom);
    assert.equal(p.x[0], dom.x0);
    assert.equal(p.age[0], 0);
    assert.ok(p.y[0] >= dom.y0 && p.y[0] <= dom.y1);
    assert.ok(Math.abs(p.x[1] - 5.2) < 1e-6);
    assert.ok(Math.abs(p.age[1] - 3.2) < 1e-6);
    assert.equal(p.x[2], dom.x0);
  });

  it("aliran ke kiri lahir ulang di tepi kanan", () => {
    const p = createPool(1);
    p.x[0] = 0.05; p.y[0] = 1;
    advect(p, seragam(-1), 0.1, dom, respawnInlet);
    assert.equal(p.x[0], dom.x1);
  });

  it("kecepatan NaN dari medan: partikel lahir ulang, bukan hilang", () => {
    const p = createPool(1);
    p.x[0] = 5; p.y[0] = 1;
    advect(p, seragam(NaN), 0.1, dom);
    assert.ok(Number.isFinite(p.x[0]) && Number.isFinite(p.y[0]));
    assert.ok(p.x[0] >= dom.x0 && p.x[0] <= dom.x1);
  });

  it("tanpa alokasi baru: larik yang sama, panjang tetap, 10 000 langkah", () => {
    const p = createPool(200);
    scatter(p, dom);
    const ref = [p.x, p.y, p.age, p.seed, p.u, p.v];
    const f = seragam(3, 0.1);
    for (let k = 0; k < 10000; k++) advect(p, f, 1 / 60, dom);
    const now = [p.x, p.y, p.age, p.seed, p.u, p.v];
    for (let j = 0; j < ref.length; j++) {
      assert.equal(now[j], ref[j], "larik diganti");
      assert.equal(now[j].length, 200);
    }
    assert.equal(p.n, 200);
    for (let i = 0; i < p.n; i++) {
      assert.ok(p.x[i] >= dom.x0 && p.x[i] <= dom.x1);
      assert.ok(p.y[i] >= dom.y0 && p.y[i] <= dom.y1);
    }
  });
});

describe("motion: drawStreaks", () => {
  // Konteks tiruan pencatat moveTo/lineTo.
  function rekam() {
    const seg: number[] = [];
    let mx = 0, my = 0;
    const ctx = {
      save() {}, restore() {}, clip() {}, setLineDash() {},
      beginPath() {}, closePath() {}, stroke() {},
      moveTo(x: number, y: number) { mx = x; my = y; },
      lineTo(x: number, y: number) { seg.push(Math.hypot(x - mx, y - my)); },
      lineWidth: 0, strokeStyle: "", globalAlpha: 1, lineCap: "",
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, seg };
  }

  it("panjang goresan sebanding kecepatan (lenPerMps)", () => {
    const map = linearMap({ x0: 0, y0: 0, x1: 1000, y1: 200 }, [0, 10], [0, 2]);
    const p = createPool(2);
    p.x[0] = 5; p.y[0] = 1; p.u[0] = 1;
    p.x[1] = 5; p.y[1] = 1; p.u[1] = 3;
    const { ctx, seg } = rekam();
    drawStreaks(ctx, p, map, { lenPerMps: 0.2, minPx: 0 });
    // 100 px per m; 1 m/s · 0,2 s = 0,2 m = 20 px
    assert.ok(Math.abs(seg[0] - 20) < 1e-3);
    assert.ok(Math.abs(seg[1] - 60) < 1e-3);
  });

  it("partikel diam tetap tampak minPx", () => {
    const map = linearMap({ x0: 0, y0: 0, x1: 1000, y1: 200 }, [0, 10], [0, 2]);
    const p = createPool(1);
    p.x[0] = 5; p.y[0] = 1;
    const { ctx, seg } = rekam();
    drawStreaks(ctx, p, map, { lenPerMps: 0.2, minPx: 2 });
    assert.ok(Math.abs(seg[0] - 2) < 1e-6);
  });
});
