/*
 * Uji lapis gerak OC-11 (drawMeanderMotion.ts): bentuk alur yang digambar
 * = lini masa M6 (meanderFrameAt + meanderFramePath), danau oxbow =
 * meanderOxbow, jam lapis gerak mengikuti tahun model.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  centrelineLength,
  createMeanderMotion,
  createMeanderShape,
  drawMeanderMotion,
  flushMeanderTime,
  meanderCentreline,
  meanderShapeAt,
  oxbowSet,
} from "./drawMeanderMotion.ts";
import {
  meanderFrameAt,
  meanderFramePath,
  meanderOxbow,
  meanderTimeline,
} from "./meanderWaktu.ts";
import type { PlateMap } from "./plateOut.ts";

const dekat = (a: number, b: number, tol: number, pesan?: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${pesan ?? ""} ${a} vs ${b} (tol ${tol})`);

function ctxTiruan(): CanvasRenderingContext2D {
  const target = { measureText: (s: string) => ({ width: 6 * s.length }) } as Record<string, unknown>;
  return new Proxy(target, {
    get: (o, k) => (k in o ? o[k as string] : () => {}),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
}

const peta: PlateMap = {
  X: (v) => v,
  Y: (v) => -v,
  invX: (p) => p,
  invY: (p) => -p,
  frame: { x0: 0, y0: 0, x1: 800, y1: 500 },
};

const tl = meanderTimeline(30, 330, 40);

describe("OC-11 bentuk alur = lini masa M6", () => {
  it("lini masa preset 30/330/40 terpotong di waktu terhingga", () => {
    assert.equal(tl.cutoffAtStart, false);
    assert.ok(tl.timeToCutoff > 0 && Number.isFinite(tl.timeToCutoff));
  });

  for (const frac of [0, 0.13, 0.5, 0.77, 1]) {
    it(`t = ${frac} · T potong: ω, M, A dan garis tengah sama dengan meanderFramePath`, () => {
      const t = frac * tl.timeToCutoff;
      const f = meanderFrameAt(tl, t);
      const sh = meanderShapeAt(tl, t, createMeanderShape());
      dekat(sh.omegaDeg, f.omegaDeg, 1e-12, "ω");
      dekat(sh.pathWavelength, f.pathWavelength, 1e-4 * f.pathWavelength, "M");
      dekat(sh.amplitude, f.amplitude, 1e-4 * f.amplitude, "A");
      const n = 400;
      const c = meanderCentreline(sh, 2, n, new Float64Array(centrelineLength(n)));
      const ref = meanderFramePath(f, 2, n);
      let maks = 0;
      for (let i = 0; i <= n; i++) maks = Math.max(maks, Math.hypot(c[2 * i] - ref[i].x, c[2 * i + 1] - ref[i].y));
      /* selisih hanya dari sisipan M dan A antar bingkai 0,5° */
      /* < 0,06 m pada alur sepanjang ~700 m (satu piksel ≈ 1 m) */
      assert.ok(maks < 2e-3 * tl.width, `selisih terbesar ${maks} m`);
    });
  }

  it("dijepit di luar [0, T potong]", () => {
    const a = meanderShapeAt(tl, -5, createMeanderShape());
    const b = meanderShapeAt(tl, 1e9, createMeanderShape());
    assert.equal(a.omegaDeg, tl.frames[0].omegaDeg);
    assert.equal(b.omegaDeg, tl.frames[tl.frames.length - 1].omegaDeg);
  });
});

describe("OC-11 danau oxbow = meanderOxbow", () => {
  const fc = tl.frames[tl.frames.length - 1];
  const up = meanderOxbow(fc);
  const set = oxbowSet(up, tl.valleyWavelength, tl.width, 2);
  it("kelokan atas pertama tepat meanderOxbow; tiga danau muat dalam dua gelombang", () => {
    assert.ok(up.length > 10);
    assert.equal(set.lines.length, 3);
    for (let i = 0; i < up.length; i++) {
      assert.equal(set.lines[0][2 * i], up[i].x);
      assert.equal(set.lines[0][2 * i + 1], up[i].y);
    }
  });
  it("danau atas kedua = digeser λ; danau bawah = dicerminkan dan digeser λ/2, berimpit dengan garis tengah", () => {
    const n = 800;
    const path = meanderFramePath(fc, 2, n);
    /* titik tengah tiap danau harus terletak pada garis tengah bingkai potong */
    for (const L of set.lines) {
      const m = Math.floor(L.length / 4);
      const px = L[2 * m];
      const py = L[2 * m + 1];
      let d = Infinity;
      for (const q of path) d = Math.min(d, Math.hypot(q.x - px, q.y - py));
      assert.ok(d < 0.01 * tl.width, `jarak ke garis tengah ${d}`);
    }
  });
});

describe("OC-11 jam lapis gerak", () => {
  it("t maju dt tahun per frame, diam di T potong selama hold, lalu ulang; kirim ke lembar ≤ 4 kali/s", () => {
    const mo = createMeanderMotion(200, 2);
    const ctx = ctxTiruan();
    const Tc = tl.timeToCutoff;
    const yps = Tc / 10;
    const kiriman: number[] = [];
    const op = {
      width: 30,
      oxbows: oxbowSet(meanderOxbow(tl.frames[tl.frames.length - 1]), tl.valleyWavelength, 30, 2),
      oxbowLabel: "oxbow",
      ghostStep: Tc / 8,
      tProp: 0,
      onTime: (t: number) => kiriman.push(t),
      yearsPerSecond: yps,
      holdSeconds: 2,
    };
    const c0 = mo.c;
    /* 5 s layar pada 60 fps */
    for (let f = 0; f < 300; f++) drawMeanderMotion(ctx, peta, yps / 60, tl, mo, op);
    /* frame pertama membaca tProp = 0 (penggeser), 299 frame berikutnya maju */
    dekat(mo.t, (299 * yps) / 60, 1e-9 * Tc, "t sesudah 5 s");
    assert.ok(kiriman.length >= 18 && kiriman.length <= 21, `kiriman ${kiriman.length}`);
    /* kiriman yang kembali lewat tProp tidak memundurkan jam */
    op.tProp = kiriman[kiriman.length - 1];
    drawMeanderMotion(ctx, peta, yps / 60, tl, mo, op);
    dekat(mo.t, (300 * yps) / 60, 1e-9 * Tc, "kiriman kembali diabaikan");
    /* geseran pengguna diikuti */
    op.tProp = 0.9 * Tc;
    drawMeanderMotion(ctx, peta, yps / 60, tl, mo, op);
    dekat(mo.t, 0.9 * Tc, 1e-12, "geseran diikuti");
    /* sampai T potong lalu diam 2 s */
    for (let f = 0; f < 70; f++) drawMeanderMotion(ctx, peta, yps / 60, tl, mo, op);
    assert.equal(mo.t, Tc);
    for (let f = 0; f < 110; f++) drawMeanderMotion(ctx, peta, yps / 60, tl, mo, op);
    assert.equal(mo.t, Tc, "masih diam");
    for (let f = 0; f < 15; f++) drawMeanderMotion(ctx, peta, yps / 60, tl, mo, op);
    /* diam 120 frame (2 s), lalu mulai lagi dari 0 dan maju sisa framenya */
    assert.ok(mo.t <= (15 * yps) / 60 && mo.t < 0.05 * Tc, `ulang dari 0, t ${mo.t}`);
    assert.equal(mo.c, c0, "larik tidak dibuat ulang");
  });
});

describe("OC-11 jeda mengirim t terakhir ke lembar", () => {
  it("t lapis gerak yang belum terkirim (< 0,25 s) dikirim saat dijeda, dan kiriman itu tidak dianggap geseran", () => {
    const mo = createMeanderMotion(200, 2);
    const ctx = ctxTiruan();
    const Tc = tl.timeToCutoff;
    const yps = Tc / 10;
    const kiriman: number[] = [];
    const op = {
      width: 30,
      oxbows: oxbowSet(meanderOxbow(tl.frames[tl.frames.length - 1]), tl.valleyWavelength, 30, 2),
      oxbowLabel: "oxbow",
      ghostStep: Tc / 8,
      tProp: 0,
      onTime: (t: number) => kiriman.push(t),
      yearsPerSecond: yps,
      holdSeconds: 2,
    };
    /* 20 frame = 0,33 s: satu kiriman di 0,25 s, lalu 5 frame tertinggal */
    for (let f = 0; f < 20; f++) drawMeanderMotion(ctx, peta, yps / 60, tl, mo, op);
    assert.ok(kiriman[kiriman.length - 1] < mo.t, "kiriman terakhir tertinggal");
    flushMeanderTime(mo, op.onTime);
    assert.equal(kiriman[kiriman.length - 1], mo.t, "jeda: t terakhir terkirim");
    const n = kiriman.length;
    flushMeanderTime(mo, op.onTime);
    assert.equal(kiriman.length, n, "tidak dikirim dua kali");
    /* lembar menulis kiriman itu ke tProp; diputar lagi: jam tidak mundur */
    const t0 = mo.t;
    op.tProp = mo.t;
    drawMeanderMotion(ctx, peta, yps / 60, tl, mo, op);
    dekat(mo.t, t0 + yps / 60, 1e-9 * Tc, "jalan terus dari t terakhir");
  });
});
