import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { drawHidrostatika, type HidroDrawState } from "./drawHidrostatika.ts";
import { hydrostaticPressure, inclinedRectangle } from "./hidrostatika.ts";
import { snap } from "./rentang.ts";

/* Konteks palsu seperti drawCurvature.test.ts: perintah gambar kosong,
   measureText 6,5 px per huruf. */
function konteksPalsu(w: number): CanvasRenderingContext2D {
  const nop = () => {};
  const ctx: Record<string, unknown> = {
    canvas: { width: w, height: 600 },
    font: "10px sans-serif",
    measureText: (t: string) => ({ width: [...String(t)].length * 6.5 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    getLineDash: () => [],
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

/* ParamDef yang sama dengan TekananHidrostatisClient. */
const P_PROBE = { min: 0, max: 20, step: 0.05, digits: 2 };
const P_TOP = { min: -3, max: 15, step: 0.05, digits: 2 };

function keadaan(H: number, probe: number, top: number, L: number, a: number): HidroDrawState {
  const angle = (a * Math.PI) / 180;
  const r = inclinedRectangle(2, L, top, angle, 1000);
  return {
    rho: 1000,
    H,
    probe,
    pProbe: hydrostaticPressure(probe, 1000),
    pa: 0,
    absolute: false,
    angle,
    top,
    L,
    b: 2,
    force: r.force,
    depthCG: r.depthCG,
    depthCP: r.depthCP,
    wettedLength: r.wettedLength,
    gateInvalid: top + L * Math.sin(angle) > H,
    probeInvalid: probe > H,
  };
}

describe("FF-08 drawHidrostatika", () => {
  for (const [w, h] of [
    [820, 520],
    [358, 380],
  ] as const)
    for (const a of [10, 60, 90])
      for (const H of [0.5, 6, 20])
        it(`${w}×${h} θ ${a} H ${H}: pegangan pulang-pergi, diagram di kanan`, () => {
          const probe = H / 2;
          const top = H * 0.2;
          const out = drawHidrostatika(konteksPalsu(w), w, h, keadaan(H, probe, top, 1, a), "id");
          const f = out.map.frame;
          const pr = out.anchors?.probe;
          const gt = out.anchors?.gateTop;
          assert.ok(pr && gt, "kedua titik pegangan ada");
          for (const p of [pr, gt])
            assert.ok(p.x >= f.x0 && p.x <= f.x1 && p.y >= f.y0 && p.y <= f.y1, "di dalam bidang kiri");
          assert.ok(Math.abs(snap(out.map.invY(pr.y), P_PROBE).value - snap(probe, P_PROBE).value) < 1e-9, "probe pulang-pergi");
          assert.ok(Math.abs(snap(out.map.invY(gt.y), P_TOP).value - snap(top, P_TOP).value) < 1e-9, "tepi atas pulang-pergi");
          const d = out.maps?.tekanan;
          assert.ok(d && d.frame.x0 >= f.x1, "diagram berdampingan di kanan");
          // satu garis mendatar: kedalaman yang sama, piksel tegak yang sama
          assert.equal(d.Y(probe), out.map.Y(probe));
        });

  it("skala tidak bergantung pada probe dan tepi atas pintu (yang diseret)", () => {
    const a = drawHidrostatika(konteksPalsu(820), 820, 520, keadaan(6, 1, 0, 3, 60), "id");
    const b = drawHidrostatika(konteksPalsu(820), 820, 520, keadaan(6, 5, 2.5, 3, 60), "id");
    assert.equal(a.map.Y(2), b.map.Y(2));
    assert.equal(a.map.X(1), b.map.X(1));
  });

  it("pegangan dijepit ke bidang saat nilainya di luar gambar, tanpa NaN", () => {
    const out = drawHidrostatika(konteksPalsu(358), 358, 380, keadaan(0.5, 20, -3, 10, 10), "en");
    const f = out.map.frame;
    for (const p of Object.values(out.anchors ?? {})) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      assert.ok(p.y >= f.y0 && p.y <= f.y1);
    }
  });
});
