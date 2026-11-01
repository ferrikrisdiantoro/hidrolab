/*
 * Uji lapis gerak kawanan (swarmMotion.ts), batch B5b-2.
 *
 * FP-02: posisi pusaran yang digambar = model (vortexPair untuk dua
 * pusaran, M3 untuk tiga atau lebih), besaran kekal Lamb Art. 154/167
 * terjaga sepanjang gerak, pelacak dibawa medan Γ/(2πr).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  VORTEX_CORE,
  advectTracers,
  createVortexMotion,
  drawVortexMotion,
  fieldReferenceSpeed,
  loadVortices,
  trackPositionAt,
  vortexTimeScale,
  vortexTrack,
} from "./swarmMotion.ts";
import {
  SHOAL_STEPS,
  advanceShoalMotion,
  createShoalMotion,
  drawShoalMotion,
  shoalScene,
} from "./swarmMotion.ts";
import { vortexInvariants } from "./vorteksTitik.ts";
import { shoal, vortexPair } from "./hydraulics.ts";
import { SHOAL_DT } from "./gerombolan.ts";
import type { PlateMap } from "./plateOut.ts";

const dekat = (a: number, b: number, tol: number, pesan?: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${pesan ?? ""} ${a} vs ${b} (tol ${tol})`);

/** Konteks kanvas tiruan: semua panggilan diabaikan, measureText memberi lebar. */
function ctxTiruan(): CanvasRenderingContext2D {
  const target = {
    measureText: (s: string) => ({ width: 6 * s.length }),
  } as Record<string, unknown>;
  return new Proxy(target, {
    get: (o, k) => (k in o ? o[k as string] : () => {}),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
}

/** Peta linear 800 × 500 px untuk x ∈ [−10, 10], y ∈ [−6, 6]. */
function peta(): PlateMap {
  const f = { x0: 60, y0: 26, x1: 860, y1: 526 };
  const sx = (f.x1 - f.x0) / 20;
  const sy = (f.y1 - f.y0) / 12;
  return {
    X: (v) => f.x0 + (v + 10) * sx,
    Y: (v) => f.y1 - (v + 6) * sy,
    invX: (p) => (p - f.x0) / sx - 10,
    invY: (p) => (f.y1 - p) / sy - 6,
    frame: f,
  };
}

const gaya = {
  colors: ["a", "b", "c", "c", "c", "c"],
  dashes: [[], [], [], [], [], []],
  clockPrefix: "t = ",
  legendPrefix: "≥ ",
  uRef: 1,
  hold: 0,
};

describe("FP-02 jejak pusaran = vortexPair untuk dua pusaran", () => {
  for (const [gA, gB, d] of [
    [10, -10, 2],
    [10, 10, 2],
    [30, 5, 2],
    [-7, 3, 1.3],
    [40, 40, 0.5],
  ] as const) {
    it(`Γ ${gA}/${gB}, d ${d}: posisi di 0, 5, 10, 20 s`, () => {
      const p = vortexPair(gA, gB, d);
      const tr = vortexTrack(
        [
          { x: -d / 2, y: 0, gamma: gA },
          { x: d / 2, y: 0, gamma: gB },
        ],
        20,
        VORTEX_CORE
      );
      /* Acuan tepat: vortexPair (bentuk tertutup) dengan lama pengamatan t
         memberi posisi pada saat t di titik terakhirnya. */
      const ox = new Float64Array(2);
      const oy = new Float64Array(2);
      for (const t of [0, 1.7, 5, 10, 13.3, 20]) {
        const q = t === 0 ? p : vortexPair(gA, gB, d, t);
        const A = t === 0 ? q.pathA[0] : q.pathA[q.pathA.length - 1];
        const B = t === 0 ? q.pathB[0] : q.pathB[q.pathB.length - 1];
        trackPositionAt(tr, t, ox, oy);
        /* M3 = RK4 0,01 rad per langkah; Hermite antar sampel 0,05 rad */
        const tol = 2e-6 * Math.max(1, d);
        dekat(ox[0], A.x, tol, `xA t=${t}`);
        dekat(oy[0], A.y, tol, `yA t=${t}`);
        dekat(ox[1], B.x, tol, `xB t=${t}`);
        dekat(oy[1], B.y, tol, `yB t=${t}`);
      }
      /* Jarak tetap (Lamb Art. 155) di sepanjang jejak */
      for (let k = 0; k <= tr.K; k += Math.max(1, Math.floor(tr.K / 50))) {
        const r = Math.hypot(tr.x[2 * k + 1] - tr.x[2 * k], tr.y[2 * k + 1] - tr.y[2 * k]);
        dekat(r, d, 1e-7 * d, `jarak sampel ${k}`);
      }
    });
  }
});

describe("FP-02 besaran kekal terjaga sepanjang jejak (Lamb Art. 154, 167)", () => {
  for (const vs of [
    [
      { x: -1, y: 0, gamma: 10 },
      { x: 1, y: 0, gamma: 10 },
      { x: 0, y: 1.7, gamma: 10 },
    ],
    [
      { x: -1, y: 0, gamma: 10 },
      { x: 1, y: 0, gamma: -10 },
      { x: 0.3, y: 2, gamma: 5 },
      { x: -2, y: -1.5, gamma: -8 },
    ],
  ]) {
    it(`${vs.length} pusaran: ΣΓ, pusat, H, ΣΓr²`, () => {
      const tr = vortexTrack(vs, 20, VORTEX_CORE);
      const a = tr.start;
      const b = tr.end;
      assert.equal(b.circulation, a.circulation);
      const sk = Math.max(1, Math.abs(a.impulseX), Math.abs(a.impulseY));
      dekat(b.impulseX, a.impulseX, 1e-8 * sk, "ΣΓx");
      dekat(b.impulseY, a.impulseY, 1e-8 * sk, "ΣΓy");
      /* Selisih kecil H dan ΣΓr² = galat RK4 saat dua pusaran berpapasan
         dekat; ditampilkan jujur sebagai ΔH di lembar. */
      dekat(b.hamiltonian, a.hamiltonian, 1e-4 * Math.max(1, Math.abs(a.hamiltonian)), "H");
      dekat(b.angularImpulse, a.angularImpulse, 1e-4 * Math.max(1, Math.abs(a.angularImpulse)), "ΣΓr²");
    });
  }
});

describe("FP-02 lapis gerak membaca posisi dari model", () => {
  it("posisi pusaran yang digambar = jejak pada saat τ; invarian sistem gerak = model", () => {
    const vs = [
      { x: -1, y: 0, gamma: 10 },
      { x: 1, y: 0, gamma: -6 },
      { x: 0, y: 1.5, gamma: 4 },
    ];
    const tr = vortexTrack(vs, 20, VORTEX_CORE);
    const mo = createVortexMotion(40, 6);
    const ctx = ctxTiruan();
    const map = peta();
    const sysX = mo.sys.x;
    const ox = new Float64Array(3);
    const oy = new Float64Array(3);
    let t = 0;
    for (let f = 0; f < 600; f++) {
      const dt = 1 / 60;
      t += dt;
      drawVortexMotion(ctx, map, t, dt, tr, mo, gaya);
      if (f % 97 === 0) {
        trackPositionAt(tr, t, ox, oy);
        for (let i = 0; i < 3; i++) {
          assert.equal(mo.sys.x[i], ox[i]);
          assert.equal(mo.sys.y[i], oy[i]);
        }
        /* slot kosong tanpa sirkulasi: invarian sistem 6 slot = 3 pusaran */
        const inv = vortexInvariants(mo.sys);
        dekat(inv.circulation, tr.start.circulation, 1e-12);
        dekat(inv.impulseX, tr.start.impulseX, 1e-6);
        dekat(inv.impulseY, tr.start.impulseY, 1e-6);
        dekat(inv.hamiltonian, tr.start.hamiltonian, 1e-6 * Math.abs(tr.start.hamiltonian));
      }
    }
    /* larik tidak dibuat ulang per frame */
    assert.equal(mo.sys.x, sysX);
  });

  it("jeda di ujung: posisi diam di t = span selama hold, lalu mulai lagi", () => {
    const tr = vortexTrack(
      [
        { x: -1, y: 0, gamma: 10 },
        { x: 1, y: 0, gamma: 10 },
      ],
      20,
      VORTEX_CORE
    );
    const mo = createVortexMotion(0, 1);
    const ctx = ctxTiruan();
    drawVortexMotion(ctx, peta(), 21, 0.01, tr, mo, { ...gaya, hold: 2 });
    const ox = new Float64Array(2);
    const oy = new Float64Array(2);
    trackPositionAt(tr, 20, ox, oy);
    assert.equal(mo.sys.x[0], ox[0]);
    drawVortexMotion(ctx, peta(), 22.5, 0.01, tr, mo, { ...gaya, hold: 2 });
    trackPositionAt(tr, 0.5, ox, oy);
    dekat(mo.sys.x[0], ox[0], 1e-12);
    assert.ok(Math.abs(mo.sys.x[0] - -1) > 1e-3, "sudah bergerak lagi");
  });
});

describe("FP-02 pelacak dibawa medan Γ/(2πr) (Lamb Art. 154)", () => {
  it("satu pusaran: pelacak berputar ω = Γ/(2πr²), jari-jari tetap", () => {
    const tr = vortexTrack([{ x: 0, y: 0, gamma: 10 }], 20, VORTEX_CORE);
    const mo = createVortexMotion(1, 2);
    loadVortices(mo, tr, 0);
    const r = 2;
    mo.px[0] = r;
    mo.py[0] = 0;
    const w = 10 / (2 * Math.PI * r * r);
    const T = 1;
    for (let k = 0; k < 600; k++) advectTracers(mo, T / 600, 10 / (2 * Math.PI * VORTEX_CORE));
    dekat(Math.hypot(mo.px[0], mo.py[0]), r, 1e-6, "jari-jari");
    dekat(Math.atan2(mo.py[0], mo.px[0]), w * T, 1e-6, "sudut");
  });

  it("di dalam inti Rankine laju sebanding jarak (Lamb Art. 27)", () => {
    const tr = vortexTrack([{ x: 0, y: 0, gamma: 10 }], 20, VORTEX_CORE);
    const mo = createVortexMotion(1, 2);
    loadVortices(mo, tr, 0);
    const r = VORTEX_CORE / 2;
    mo.px[0] = r;
    mo.py[0] = 0;
    const w = 10 / (2 * Math.PI * VORTEX_CORE * VORTEX_CORE);
    const T = 0.01;
    for (let k = 0; k < 400; k++) advectTracers(mo, T / 400, 10 / (2 * Math.PI * VORTEX_CORE));
    dekat(Math.atan2(mo.py[0], mo.px[0]), w * T, 1e-5, "sudut inti");
  });
});

describe("FP-02 skala waktu dan panah", () => {
  it("waktu nyata sampai setengah putaran per detik, lalu per pangkat sepuluh", () => {
    assert.equal(vortexTimeScale(0), 1);
    assert.equal(vortexTimeScale(2 * Math.PI * 0.5), 1);
    assert.equal(vortexTimeScale(2 * Math.PI * 0.6), 0.1);
    assert.equal(vortexTimeScale(2 * Math.PI * 5), 0.1);
    assert.equal(vortexTimeScale(2 * Math.PI * 5.01), 0.01);
    /* Γ 40/40, d 0,5: ΣΓ/(2π d²) = 50,9 rad/s → 8,1 putaran/s → ×0,01 */
    const tr = vortexTrack(
      [
        { x: -0.25, y: 0, gamma: 40 },
        { x: 0.25, y: 0, gamma: 40 },
      ],
      20,
      VORTEX_CORE
    );
    assert.equal(vortexTimeScale(tr.maxPairRate), 0.01);
    /* tampil paling banyak satu putaran tiap detik layar */
    assert.ok((tr.maxPairRate / (2 * Math.PI)) * vortexTimeScale(tr.maxPairRate) <= 0.5 + 1e-12);
  });

  it("laju penuh panah = 1, 2, 5 × 10ⁿ dari Γ/(2π · 2 kisi)", () => {
    const u = fieldReferenceSpeed(10, 0.02);
    const mentah = 10 / (2 * Math.PI * 88 * 0.02);
    assert.ok([0.1, 0.2, 0.5, 1, 2, 5, 10].some((v) => Math.abs(v - u) < 1e-12), `${u}`);
    assert.ok(u / mentah > 0.5 && u / mentah < 2, `${u} vs ${mentah}`);
    assert.equal(fieldReferenceSpeed(0, 0.02), 0);
  });
});

/* ------------------------------------------------------------------ *
 * EH-05: ikan yang bergerak = simulasi M4 yang sama dengan hasil lembar
 * ------------------------------------------------------------------ */

describe("EH-05 shoalScene tanpa rintangan = shoal() (M5)", () => {
  for (const [n, a, s, c] of [
    [40, 1, 1, 0.5],
    [40, 2.5, 1, 0.6],
    [17, 0.3, 1, 1],
  ] as const) {
    it(`N ${n}, a ${a}, s ${s}, c ${c}: agen, jejak, ukuran identik`, () => {
      const g = shoal(n, a, s, c);
      const h = shoalScene(n, a, s, c);
      assert.deepEqual(h.agents, g.agents);
      assert.deepEqual(h.trails, g.trails);
      assert.equal(h.polarisation, g.polarisation);
      assert.equal(h.milling, g.milling);
      assert.equal(h.state, g.state);
      for (const p of g.agents) assert.ok(p.x >= h.xMin && p.x <= h.xMax && p.y >= h.yMin && p.y <= h.yMax);
    });
  }
  it("rintangan memang dipakai: hasil berbeda bila rintangan di jalur", () => {
    const g = shoalScene(40, 2.5, 1, 0.6);
    const ox = g.agents.reduce((s, p) => s + p.x, 0) / 40;
    const oy = g.agents.reduce((s, p) => s + p.y, 0) / 40;
    const h = shoalScene(40, 2.5, 1, 0.6, [{ x: ox * 0.5, y: oy * 0.5, r: 3 }]);
    assert.notDeepEqual(h.agents, g.agents);
  });
});

describe("EH-05 lapis gerak membaca simulasi yang sama", () => {
  for (const obs of [[], [{ x: 4, y: 2, r: 2 }, { x: -6, y: -3, r: 1.5 }]]) {
    it(`${obs.length} rintangan: sesudah ${SHOAL_STEPS} langkah posisi = shoalScene`, () => {
      const g = shoalScene(30, 1, 1, 0.5, obs);
      const mo = createShoalMotion(30, 1, 1, 0.5, obs);
      const px = mo.px;
      const ctx = ctxTiruan();
      const map = peta();
      const gaya2 = { color: "x", bodyLength: 0.8, minBodyPx: 9, clockPrefix: "t = ", clockStep: (k: number) => ` s, ${k}` };
      let t = 0;
      /* frame tak rata: 1/60 s dan 1/24 s bergantian, waktu fisik */
      let f = 0;
      while (mo.st.steps < SHOAL_STEPS && f < 20000) {
        const dt = f % 2 ? 1 / 60 : 1 / 24;
        t += dt;
        drawShoalMotion(ctx, map, t, dt, mo, gaya2, 1);
        f++;
      }
      assert.equal(mo.st.steps, SHOAL_STEPS);
      /* langkah ke-k terjadi sesudah k·0,3 s fisik */
      assert.ok(Math.abs(t - SHOAL_STEPS * SHOAL_DT) < 0.05, `t ${t}`);
      for (let i = 0; i < 30; i++) {
        assert.equal(mo.st.x[i], g.agents[i].x);
        assert.equal(mo.st.y[i], g.agents[i].y);
      }
      assert.equal(mo.px, px, "larik sisipan tidak dibuat ulang");
      /* diam selama hold, lalu kembali ke langkah 0 */
      advanceShoalMotion(mo, 0.5, 1);
      assert.equal(mo.st.steps, SHOAL_STEPS);
      advanceShoalMotion(mo, 0.6, 1);
      assert.equal(mo.st.steps, 0);
      const awal = createShoalMotion(30, 1, 1, 0.5, obs);
      assert.deepEqual(Array.from(mo.st.x), Array.from(awal.st.x));
    });
  }
});
