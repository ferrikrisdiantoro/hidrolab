import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CURVATURE_CHORD,
  drawCurvaturePlate,
  radiusFromSagitta,
  sagittaFromRadius,
} from "./drawCurvature.ts";
import { shiftMap, shiftPlateOut } from "./plateShift.ts";
import { mapFrom } from "./plateOut.ts";
import { snap } from "./rentang.ts";

/* Konteks palsu seperti plateOutDraw.test.ts: perintah gambar kosong,
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

const P_R = { min: 0.2, max: 200, step: 0.2, digits: 1 };
const c = CURVATURE_CHORD;

describe("FF-04 geometri busur", () => {
  it("R = (c²/4 + s²)/(2s) dan kebalikannya pulang-pergi", () => {
    for (const R of [0.2, 0.25, 0.8, 3, 6, 50, 200]) {
      const s = sagittaFromRadius(R, c);
      const balik = radiusFromSagitta(s, c);
      assert.ok(Math.abs(balik - R) <= 1e-9 * R, `R ${R} → s ${s} → ${balik}`);
    }
  });

  it("setengah lingkaran: s = c/2 tepat pada R terkecil penggeser", () => {
    assert.equal(c, 2 * P_R.min);
    assert.ok(Math.abs(sagittaFromRadius(P_R.min, c) - c / 2) < 1e-12);
  });

  it("tinggi busur dihitung tanpa kehilangan angka pada R besar", () => {
    // s ≈ c²/(8R) untuk R ≫ c
    const s = sagittaFromRadius(200, c);
    assert.ok(Math.abs(s - (c * c) / (8 * 200)) / s < 1e-5, `${s}`);
  });

  it("garis lurus dan lewat tali: tak hingga, dijepit ke maks dengan penanda", () => {
    assert.equal(radiusFromSagitta(0, c), Infinity);
    assert.equal(radiusFromSagitta(-0.01, c), Infinity);
    const r = snap(radiusFromSagitta(0, c), P_R);
    assert.equal(r.value, 200);
    assert.equal(r.clamped, 1);
  });

  it("lewat setengah lingkaran: terus turun di bawah R terkecil, dijepit dengan penanda", () => {
    let lalu = radiusFromSagitta(c / 2, c);
    assert.ok(Math.abs(lalu - c / 2) < 1e-12);
    for (const s of [0.21, 0.25, 0.4, 1]) {
      const R = radiusFromSagitta(s, c);
      assert.ok(R < lalu, `tidak turun di s ${s}`);
      lalu = R;
    }
    const r = snap(radiusFromSagitta(0.3, c), P_R);
    assert.equal(r.value, 0.2);
    assert.equal(r.clamped, -1);
  });

  it("monoton turun pada 0 < s ≤ c/2 (seret menjauhi tali = lebih melengkung)", () => {
    let lalu = Infinity;
    for (let i = 1; i <= 200; i++) {
      const R = radiusFromSagitta((c / 2) * (i / 200), c);
      assert.ok(R < lalu);
      lalu = R;
    }
  });
});

describe("FF-04 drawCurvaturePlate", () => {
  const tekanan = {
    xMin: 0,
    xMax: 12,
    yMin: 0,
    yMax: 1.2,
    equalScale: false,
    axisX: "p",
    axisY: "z",
  };
  for (const [w, h] of [
    [820, 504],
    [358, 360],
  ] as const) {
    for (const convex of [true, false]) {
      for (const R of [0.2, 6, 200]) {
        it(`${w}×${h} ${convex ? "cembung" : "cekung"} R ${R}: pegangan di puncak, peta busur pulang-pergi`, () => {
          const out = drawCurvaturePlate(
            konteksPalsu(w),
            w,
            h,
            { R, convex, chord: c, title: "t", radiusText: "R", sagittaText: "s", chordText: "c" },
            tekanan,
            "id"
          );
          const m = out.maps?.busur;
          assert.ok(m, "peta busur ada");
          const a = out.anchors?.apex;
          assert.ok(a, "titik puncak ada");
          const f = m.frame;
          assert.ok(a.x >= f.x0 && a.x <= f.x1 && a.y >= f.y0 && a.y <= f.y1, "puncak di dalam panel");
          // pemetaan balik dari piksel puncak memberi R kembali
          const s = (convex ? 1 : -1) * m.invY(a.y);
          const balik = radiusFromSagitta(s, c);
          assert.ok(Math.abs(snap(balik, P_R).value - R) < 1e-9, `R ${R} → ${balik}`);
          // panel tekanan tidak menimpa panel busur
          const p = out.map.frame;
          if (w >= 600) assert.ok(p.x0 >= f.x1, "berdampingan");
          else assert.ok(p.y0 >= f.y1, "bertumpuk");
        });
      }
    }
  }
});

describe("plateShift", () => {
  it("geser peta: X, Y bergeser, kebalikannya tetap pulang-pergi", () => {
    const m = mapFrom((v) => 10 + v * 2, (v) => 100 - v * 4, { x0: 10, y0: 20, x1: 50, y1: 100 }, [0, 20], [0, 20]);
    const g = shiftMap(m, 30, 7);
    assert.equal(g.X(3), m.X(3) + 30);
    assert.equal(g.Y(3), m.Y(3) + 7);
    assert.ok(Math.abs(g.invX(g.X(5.5)) - 5.5) < 1e-12);
    assert.ok(Math.abs(g.invY(g.Y(5.5)) - 5.5) < 1e-12);
    assert.deepEqual(g.frame, { x0: 40, y0: 27, x1: 80, y1: 107 });
  });
  it("geser keluaran: titik bernama, poligon air, kotak label", () => {
    const m = mapFrom((v) => v, (v) => v, { x0: 0, y0: 0, x1: 10, y1: 10 }, [0, 10], [0, 10]);
    const o = shiftPlateOut(
      { map: m, anchors: { a: { x: 1, y: 2 } }, water: [0, 0, 1, 1], labels: [{ x: 1, y: 1, w: 2, h: 2 }] },
      5,
      -3
    );
    assert.deepEqual(o.anchors?.a, { x: 6, y: -1 });
    assert.deepEqual([...(o.water as Float64Array)], [5, -3, 6, -2]);
    assert.deepEqual(o.labels?.[0], { x: 6, y: -2, w: 2, h: 2 });
  });
});
