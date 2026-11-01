import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  HABITAT_SUITABLE_MIN,
  drawHabitatPlate,
  habitatKind,
  habitatShares,
} from "./drawHabitatMap.ts";
import { HABITAT_BEST_DEPTH, HABITAT_BEST_VELOCITY, riverHabitat } from "./hydraulics.ts";

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

const kelas = (Q: number) => {
  const r = riverHabitat(Q, 20, 0.002, 0.035);
  return { r, k: r.cells.map((c) => habitatKind(c, HABITAT_BEST_DEPTH, HABITAT_BEST_VELOCITY)) };
};

describe("EH-06 kelas peta habitat", () => {
  it("layak tepat bila f(d)·f(V) ≥ ambang", () => {
    const { r, k } = kelas(2.1);
    r.cells.forEach((c, i) =>
      assert.equal(k[i] === "suitable", c.combined >= HABITAT_SUITABLE_MIN, `pias ${i}`)
    );
  });

  it("debit kecil: seluruh lebar terlalu dangkal; debit besar: alur tengah terlalu deras", () => {
    assert.ok(kelas(0.3).k.every((x) => x === "shallow"));
    const { k } = kelas(90);
    assert.equal(k[30], "fast");
    assert.equal(k[0], "shallow");
  });

  it("simetris terhadap tengah penampang (parabola)", () => {
    for (const Q of [0.3, 2.1, 5, 90]) {
      const { k } = kelas(Q);
      for (let i = 0; i < k.length; i++) assert.equal(k[i], k[k.length - 1 - i], `Q ${Q} pias ${i}`);
    }
  });

  it("bagian lebar berjumlah satu", () => {
    const { r } = kelas(5);
    const b = habitatShares(r.cells, HABITAT_BEST_DEPTH, HABITAT_BEST_VELOCITY);
    assert.ok(Math.abs(b.shallow + b.suitable + b.fast - 1) < 1e-12);
  });
});

describe("EH-06 drawHabitatPlate", () => {
  for (const [w, h] of [
    [820, 576],
    [358, 440],
  ] as const) {
    it(`${w}×${h}: titik kerja di bidang lengkung, peta di bawahnya`, () => {
      const r = riverHabitat(5, 20, 0.002, 0.035);
      const out = drawHabitatPlate(
        konteksPalsu(w),
        w,
        h,
        {
          xMin: 0,
          xMax: 20,
          yMin: 0,
          yMax: 20,
          equalScale: false,
          axisX: "Q",
          axisY: "WUA",
          anchors: { kerja: { x: 5, y: r.usableArea } },
        },
        {
          cells: r.cells,
          width: 20,
          bestDepth: HABITAT_BEST_DEPTH,
          bestVelocity: HABITAT_BEST_VELOCITY,
          title: "Peta habitat, reach seragam",
          widthText: "W = 20 m",
          flowText: "Aliran",
          kinds: { shallow: "Terlalu dangkal", suitable: "Layak (f ≥ 0,5)", fast: "Terlalu deras" },
          share: (f) => `${Math.round(f * 100)} %`,
        },
        "id"
      );
      const a = out.anchors?.kerja;
      assert.ok(a);
      const f = out.map.frame;
      assert.ok(a.x >= f.x0 && a.x <= f.x1 && a.y >= f.y0 && a.y <= f.y1);
      assert.ok(Math.abs(out.map.invX(a.x) - 5) < 1e-9, "Q = invX(px)");
      const p = out.maps?.peta;
      assert.ok(p);
      assert.ok(p.frame.y0 > f.y1, "peta di bawah lengkung");
      assert.ok(p.frame.y1 <= h && p.frame.y1 - p.frame.y0 > 30, `tinggi peta ${p.frame.y1 - p.frame.y0}`);
      assert.ok(Math.abs(p.invY(p.Y(20)) - 20) < 1e-9);
    });
  }
});
