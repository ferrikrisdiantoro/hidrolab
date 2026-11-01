import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  POCKET_Y,
  bedContour,
  createGrainSwarm,
  drawGrainPanel,
  grainDomain,
  grainFill,
  grainPanelMap,
  grainTimeScale,
  restX,
  stepGrains,
  visibleGrains,
  wrapWidth,
  type GrainStep,
} from "./drawGrain.ts";
import { grainMotion } from "./sedimenGerak.ts";
import { settlingVelocity, shieldsState } from "./hydraulics.ts";
import { C } from "./theme.ts";

/*
 * Sketsa butir B4 (SD-01, SD-03): laju butir di lapis gerak harus sama
 * dengan laju dari model M1, butir diam benar-benar diam, dan butir
 * melayang tetap di dalam jendela.
 */

function konteks(): { ctx: CanvasRenderingContext2D; teks: string[] } {
  const teks: string[] = [];
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
  };
  for (const m of [
    "beginPath", "fill", "stroke", "rect", "clip", "save", "restore", "arc", "closePath",
    "fillRect", "strokeRect", "setLineDash", "moveTo", "lineTo", "translate", "rotate", "ellipse",
  ])
    ctx[m] = nop;
  return { ctx: ctx as unknown as CanvasRenderingContext2D, teks };
}

const DOM = { w: 14.3, h: 20 };

function langkah(mode: GrainStep["mode"], us: number, ws = 0.02, ustar = 0.03, dM = 0.0005): GrainStep {
  return { mode, us, ws, ustar, dM };
}

describe("drawGrain: geometri dasar", () => {
  it("butir di kantong berpusat 1,366 d; busur dasar antara kantong dan puncak bola", () => {
    assert.ok(Math.abs(POCKET_Y - 1.3660254) < 1e-6);
    assert.ok(Math.abs(bedContour(0) - POCKET_Y) < 1e-9);
    assert.ok(Math.abs(bedContour(0.5) - 1.5) < 1e-9);
    for (let x = 0; x < 3; x += 0.07) {
      const y = bedContour(x);
      assert.ok(y >= POCKET_Y - 1e-9 && y <= 1.5 + 1e-9);
    }
  });

  it("warna isian mengikuti golongan ukuran", () => {
    assert.equal(grainFill(0.00002), C.soil);
    assert.equal(grainFill(0.0005), C.grainSand);
    assert.equal(grainFill(0.02), C.grainGravel);
    assert.equal(grainFill(0.3), C.rock);
  });
});

describe("drawGrain: laju butir = model", () => {
  it("menggelinding: maju us/d per detik dan pusat di busur dasar", () => {
    const m = createGrainSwarm(6);
    const us = 0.12;
    const dM = 0.0005;
    stepGrains(m, 0, langkah("dasar", us, 0.02, 0.03, dM), DOM);
    const x0 = m.x[0];
    const dt = 0.001;
    stepGrains(m, dt, langkah("dasar", us, 0.02, 0.03, dM), DOM);
    const maju = m.x[0] - x0;
    assert.ok(Math.abs(maju - (us / dM) * dt) < 1e-4, `maju ${maju}`);
    assert.ok(Math.abs(m.y[0] - bedContour(m.x[0])) < 1e-6);
    assert.ok(Math.abs(m.vx[0] - us / dM) < 0.1);
  });

  it("laju dari grainMotion (shieldsState + FLvB) dipakai apa adanya", () => {
    const d = 0.02;
    const sh = shieldsState(1, 0.005, d, 2.65, 1e-6);
    const ws = settlingVelocity(d, 2.65, 1e-6);
    const g = grainMotion(sh, ws);
    assert.equal(g.mode, "dasar");
    const m = createGrainSwarm(4);
    const p: GrainStep = { mode: g.mode, us: g.us, ws, ustar: g.ustar, dM: d };
    stepGrains(m, 0, p, DOM);
    const x0 = m.x[1];
    const dt = 0.002;
    stepGrains(m, dt, p, DOM);
    assert.ok(Math.abs(m.x[1] - x0 - (g.us / d) * dt) < 1e-4);
  });

  it("diam: butir di kantong tidak bergerak sedikit pun", () => {
    const m = createGrainSwarm(6);
    const p = langkah("diam", 0);
    stepGrains(m, 0, p, DOM);
    const n = m.active;
    for (let k = 0; k < 500; k++) stepGrains(m, 0.016, p, DOM);
    for (let i = 0; i < n; i++) {
      assert.equal(m.x[i], Math.fround(restX(i)));
      assert.equal(m.y[i], Math.fround(POCKET_Y));
      assert.equal(m.vx[i], 0);
      assert.equal(m.vy[i], 0);
    }
  });

  it("diam sesudah melayang: turun dengan ws lalu berhenti di dasar", () => {
    const m = createGrainSwarm(3);
    const ws = 0.02;
    const dM = 0.0005;
    stepGrains(m, 0, langkah("diam", 0, ws, 0.03, dM), DOM);
    m.y[0] = 8;
    const dt = 0.001;
    stepGrains(m, dt, langkah("diam", 0, ws, 0.03, dM), DOM);
    assert.ok(Math.abs(8 - m.y[0] - (ws / dM) * dt) < 1e-4);
    for (let k = 0; k < 2000; k++) stepGrains(m, dt, langkah("diam", 0, ws, 0.03, dM), DOM);
    const x = m.x[0];
    const y = m.y[0];
    assert.ok(Math.abs(y - bedContour(x)) < 1e-6);
    stepGrains(m, dt, langkah("diam", 0, ws, 0.03, dM), DOM);
    assert.equal(m.x[0], x);
    assert.equal(m.y[0], y);
  });

  it("melayang: mendatar us/d, tegak tetap di antara dasar dan tepi atas", () => {
    const m = createGrainSwarm(6);
    const us = 0.1;
    const dM = 0.0002;
    const p = langkah("melayang", us, 0.01, 0.04, dM);
    stepGrains(m, 0, p, DOM);
    let naik = 0;
    for (let k = 0; k < 3000; k++) {
      const x0 = m.x[2];
      stepGrains(m, 0.00002, p, DOM);
      let dx = m.x[2] - x0;
      if (dx < 0) dx += wrapWidth(DOM.w);
      assert.ok(Math.abs(dx - (us / dM) * 0.00002) < 1e-3);
      for (let i = 0; i < m.active; i++) {
        assert.ok(m.y[i] >= bedContour(m.x[i]) - 1e-4);
        assert.ok(m.y[i] <= DOM.h - 0.5 + 1e-4);
      }
      naik = Math.max(naik, m.y[2]);
    }
    assert.ok(naik > POCKET_Y + 1, "butir melayang harus lepas dari dasar");
  });

  it("melayang: butir lebih halus (ws/u* kecil) naik lebih tinggi, seperti profil Rouse", () => {
    const tinggiRata = (ws: number) => {
      const m = createGrainSwarm(10);
      const p = langkah("melayang", 0.05, ws, 0.04, 0.0002);
      stepGrains(m, 0, p, DOM);
      let jumlah = 0;
      let n = 0;
      for (let k = 0; k < 40000; k++) {
        stepGrains(m, 0.00005, p, DOM);
        if (k > 10000 && k % 50 === 0) {
          for (let i = 0; i < m.active; i++) jumlah += m.y[i];
          n += m.active;
        }
      }
      return jumlah / n;
    };
    const halus = tinggiRata(0.01);
    const kasar = tinggiRata(0.04);
    assert.ok(halus > kasar + 1, `halus ${halus}, kasar ${kasar}`);
  });

  it("dt nol atau negatif tidak memindahkan butir", () => {
    const m = createGrainSwarm(4);
    stepGrains(m, 0, langkah("dasar", 0.1), DOM);
    const x = m.x[0];
    stepGrains(m, -1, langkah("dasar", 0.1), DOM);
    assert.equal(m.x[0], x);
  });
});

describe("drawGrain: pengali waktu dan tata letak", () => {
  it("pengali waktu pangkat sepuluh, lintasan 12 d dalam 1 sampai 10 detik layar", () => {
    for (const [us, dM] of [
      [0.3, 0.0002],
      [0.05, 0.002],
      [1.2, 0.05],
      [2, 0.3],
    ]) {
      const s = grainTimeScale(langkah("dasar", us, 0.01, 0.03, dM));
      const e = Math.log10(s);
      assert.ok(Math.abs(e - Math.round(e)) < 1e-9);
      const detik = 12 / ((us / dM) * s);
      assert.ok(detik > 1 - 1e-9 && detik <= 10 + 1e-9, `${detik}`);
    }
  });

  it("jumlah butir tampak ikut lebar jendela, tidak pernah melewati lebar ulang", () => {
    for (const [w, h] of [
      [280, 560],
      [370, 200],
      [200, 120],
    ]) {
      const dom = grainDomain(grainPanelMap(w, h));
      const n = visibleGrains(10, dom.w);
      assert.ok(n >= 1);
      assert.ok(restX(n - 1) + 0.5 <= wrapWidth(dom.w));
    }
  });

  it("panel menulis judul dan garis ukur dengan panjang fisik", () => {
    const { ctx, teks } = konteks();
    drawGrainPanel(ctx, 300, 400, {
      dM: 0.002,
      mode: "dasar",
      title: "menggelinding",
      tint: C.critical,
      values: "us 0,10 m/s",
      flowLabel: "aliran",
      flowing: true,
      animating: false,
      n: 8,
    });
    const semua = teks.join("").replace(/\s+/g, "");
    assert.ok(semua.includes("MENGGELINDING"));
    // Satuan dan simbol d tidak dikapitalkan (stensil mengubah d menjadi D).
    assert.ok(semua.includes("5d=10,0mm") || semua.includes("5d=10.0mm"), semua);
  });
});
