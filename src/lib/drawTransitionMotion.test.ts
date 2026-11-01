import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  advanceTransition,
  createTransitionMotion,
  drawTransitionMotion,
  panjangDenah,
  scatterTransition,
  tingkatLaju,
  transitionFlow,
  transitionVelocity,
} from "./drawTransitionMotion.ts";
import { drawTransition, profilTransisi } from "./drawTransition.ts";
import { transition } from "./hydraulics.ts";

/*
 * Lapis gerak B8 (OC-05): laju partikel HARUS sama dengan V = Q/(b·y) yang
 * dihitung model di penampang 1 dan 2, dan aliran tersendat tidak boleh
 * diberi gerak. Masukan disusun seperti TransitionSheet mode "width"
 * (Δz dikunci 0).
 */

const dekat = (a: number, b: number, tol: number, pesan?: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${pesan ?? ""} ${a} lawan ${b}`);

function keadaan(Q: number, b1: number, y1: number, b2: number, dz = 0) {
  const r = transition({ Q, b1, y1, b2, dz });
  return { r, s: { r, b1, b2, y1, dz } };
}

function konteksPalsu(w: number, catat?: number[][]): CanvasRenderingContext2D {
  const nop = () => {};
  let titik: number[] | null = null;
  const ctx: Record<string, unknown> = {
    canvas: { width: w, height: 600 },
    font: "10px sans-serif",
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: "left",
    textBaseline: "alphabetic",
    lineCap: "butt",
    lineJoin: "miter",
    measureText: (t: string) => ({ width: [...String(t)].length * 6.5 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    getLineDash: () => [],
    moveTo: (x: number, y: number) => { titik = [x, y]; },
    lineTo: (x: number, y: number) => {
      if (catat && titik) catat.push([...titik, x, y]);
      titik = [x, y];
    },
  };
  for (const m of [
    "beginPath", "stroke", "fill", "rect", "clip", "save",
    "restore", "arc", "closePath", "fillRect", "strokeRect", "fillText",
    "strokeText", "setLineDash", "setTransform", "translate", "rotate",
    "scale", "clearRect", "quadraticCurveTo", "bezierCurveTo", "ellipse",
  ])
    ctx[m] = nop;
  return ctx as unknown as CanvasRenderingContext2D;
}

describe("transitionFlow: laju = model", () => {
  it("V di penampang 1 dan 2 = Q/(b·y) model, subkritis dan superkritis", () => {
    for (const [Q, b1, y1, b2] of [
      [12, 5, 1.5, 4.2],
      [12, 5, 1.5, 3.45],
      [12, 5, 0.45, 4.5],
      [40, 12, 2.4, 9],
      [12, 5, 1.5, 6.5],
    ]) {
      const { r, s } = keadaan(Q, b1, y1, b2);
      assert.ok(!r.choked);
      const f = transitionFlow(s, Q, 15)!;
      assert.ok(f);
      dekat(transitionVelocity(f, 0), Q / (b1 * y1), 1e-12, "V₁");
      dekat(transitionVelocity(f, 1), Q / (b2 * r.y2), 1e-12, "V₂");
      dekat(f.V1, Q / (b1 * y1), 1e-12);
      dekat(f.V2, Q / (b2 * r.y2), 1e-12);
      // Di seluruh bentang: kontinuitas pada geometri yang digambar.
      const p = profilTransisi(s);
      for (let k = 0; k <= 50; k++) {
        const x = k / 50;
        dekat(transitionVelocity(f, x) * p.bAt(x) * p.depthAt(x), Q, 1e-9, `Q di f ${x}`);
      }
    }
  });

  it("tersendat: tanpa aliran (tanpa gerak, tanpa tombol)", () => {
    const { r, s } = keadaan(12, 5, 1.5, 2.8);
    assert.ok(r.choked);
    assert.equal(transitionFlow(s, 12, 15), null);
  });

  it("waktu tempuh = ∫ L df / V; aliran seragam: L / V", () => {
    const { s } = keadaan(12, 5, 1.5, 5);
    const f = transitionFlow(s, 12, 15)!;
    dekat(f.crossTime, 15 / (12 / 7.5), 1e-9);
    const { s: s2 } = keadaan(12, 5, 1.5, 4.2);
    const f2 = transitionFlow(s2, 12, 15)!;
    assert.ok(f2.crossTime < f.crossTime, "penyempitan subkritis mempercepat");
  });

  it("advance: partikel maju V·dt/L dalam pecahan bentang", () => {
    const { s } = keadaan(12, 5, 1.5, 4.2);
    const f = transitionFlow(s, 12, 15)!;
    const st = createTransitionMotion(40);
    scatterTransition(st, f);
    const f0 = Float32Array.from(st.pool.x);
    advanceTransition(st, f, 0.01);
    for (let i = 0; i < 40; i++) {
      if (st.pool.age[i] === 0) continue; // lahir ulang
      const harap = f0[i] + (transitionVelocity(f, f0[i]) / 15) * 0.01;
      dekat(st.pool.x[i], harap, 1e-6, `partikel ${i}`);
    }
  });

  it("tingkat warna: tengah = V₁, satu tingkat per 20 %", () => {
    assert.equal(tingkatLaju(2, 2), 2);
    assert.equal(tingkatLaju(2.4, 2), 3);
    assert.equal(tingkatLaju(2 * 1.44, 2), 4);
    assert.equal(tingkatLaju(20, 2), 4);
    assert.equal(tingkatLaju(2 / 1.2, 2), 1);
    assert.equal(tingkatLaju(0.1, 2), 0);
  });
});

describe("drawTransitionMotion: frame lengkap", () => {
  it("panjang denah dari peta tampak atas; goresan terhingga di dalam bidang", () => {
    const { s } = keadaan(12, 5, 1.5, 4.2);
    for (const [w, h] of [[820, 504], [358, 360]]) {
      const out = drawTransition(konteksPalsu(w), w, h, s, "id");
      const L = panjangDenah(out)!;
      assert.ok(L > 5 && L < 200, `L ${L}`);
      const f = transitionFlow(s, 12, L)!;
      const ruas: number[][] = [];
      const ctx = konteksPalsu(w, ruas);
      const st = createTransitionMotion(60);
      drawTransitionMotion(ctx, 0.016, out, f, 1, st);
      assert.ok(ruas.length >= 120, `${ruas.length}`);
      assert.ok(ruas.every((r) => r.every(Number.isFinite)));
      for (const r of ruas) {
        assert.ok(r[0] >= 0 && r[2] <= w && r[1] >= 0 && r[3] <= h, `di luar kanvas ${r}`);
      }
    }
  });

  it("panah diam dan kunci skala tidak mengubah peta potongan memanjang", () => {
    const { s } = keadaan(12, 5, 1.5, 4.2);
    const a = drawTransition(konteksPalsu(820), 820, 504, s, "id");
    const b = drawTransition(konteksPalsu(820), 820, 504, s, "id", { panah: true, bMaxKunci: 5 });
    assert.equal(a.map.X(0.5), b.map.X(0.5));
    assert.equal(a.map.Y(1), b.map.Y(1));
    assert.equal(a.maps!.plan.Y(1), b.maps!.plan.Y(1), "kunci = max(b₁, b₂) sama dengan tanpa kunci");
    const c = drawTransition(konteksPalsu(820), 820, 504, s, "id", { bMaxKunci: 10 });
    assert.ok(c.maps!.plan.Y(0) - c.maps!.plan.Y(1) < a.maps!.plan.Y(0) - a.maps!.plan.Y(1));
    // Pegangan dinding: invY tepi atas = b/2.
    dekat(2 * a.maps!.plan.invY(a.anchors!.b1Grip.y), 5, 1e-9);
    dekat(2 * a.maps!.plan.invY(a.anchors!.b2Grip.y), 4.2, 1e-9);
  });
});
