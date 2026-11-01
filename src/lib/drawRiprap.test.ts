import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { drawRiprapBank, niceLength, riprapFailedCount } from "./drawRiprap.ts";
import { riprapSize } from "./hydraulics.ts";
import { C } from "./theme.ts";

function konteks(): { ctx: CanvasRenderingContext2D; teks: string[]; dash: number[][] } {
  const teks: string[] = [];
  const dash: number[][] = [];
  const nop = () => {};
  const ctx: Record<string, unknown> = {
    canvas: { width: 300, height: 400 },
    font: "10px sans-serif",
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: "left",
    textBaseline: "alphabetic",
    measureText: (t: string) => ({ width: [...String(t)].length * 6.5 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    fillText: (t: string) => teks.push(String(t)),
    setLineDash: (d: number[]) => dash.push(d),
  };
  for (const m of [
    "beginPath", "fill", "stroke", "rect", "clip", "save", "restore", "arc", "closePath",
    "fillRect", "strokeRect", "moveTo", "lineTo", "translate", "rotate", "ellipse",
  ])
    ctx[m] = nop;
  return { ctx: ctx as unknown as CanvasRenderingContext2D, teks, dash };
}

const dasar = {
  title: "batu",
  tint: C.pass,
  phantomLabel: "posisi gagal (skematik)",
  reqLabel: "d50 perlu",
  slopeLabel: "tebing 1 : 2 (skematik)",
};

describe("drawRiprap HS-08", () => {
  it("batu digambar sebanding d: diameter px = d · skala, lereng 12 d terbesar", () => {
    const { ctx } = konteks();
    const r = riprapSize(2, 2.65);
    const o = drawRiprapBank(ctx, 300, 500, { ...dasar, dUsed: r.d50, dReq: r.d50, chosen: false, stable: true });
    const o2 = drawRiprapBank(ctx, 300, 500, { ...dasar, dUsed: 2 * r.d50, dReq: r.d50, chosen: true, stable: true });
    // Skala mengikuti d terbesar: batu dua kali lebih besar, skala setengahnya,
    // jadi ukuran px tetap dan perbandingan dengan d50 perlu terbaca dari lingkaran.
    assert.ok(Math.abs(o.pxPerM * r.d50 - o2.pxPerM * 2 * r.d50) < 1e-9);
    assert.ok(o.stones > 10);
  });

  it("posisi gagal hanya bila batu dipilih dan tidak stabil, digambar phantom", () => {
    assert.equal(riprapFailedCount(12, false, false), 0);
    assert.equal(riprapFailedCount(12, true, true), 0);
    assert.ok(riprapFailedCount(12, true, false) > 0);
    const a = konteks();
    const o = drawRiprapBank(a.ctx, 300, 500, { ...dasar, dUsed: 0.1, dReq: 0.4, chosen: true, stable: false });
    assert.ok(o.failed > 0);
    assert.ok(a.teks.join(" ").includes("(skematik)"));
    assert.ok(a.dash.some((d) => d.length === 6), "garis phantom dipakai");
    const b = konteks();
    const o2 = drawRiprapBank(b.ctx, 300, 500, { ...dasar, dUsed: 0.5, dReq: 0.4, chosen: true, stable: true });
    assert.equal(o2.failed, 0);
    assert.ok(!b.teks.join(" ").includes("posisi gagal"));
  });

  it("garis ukur bulat dan tidak melebihi batas", () => {
    assert.equal(niceLength(0.73), 0.5);
    assert.equal(niceLength(3.1), 2);
    assert.equal(niceLength(1), 1);
  });
});
