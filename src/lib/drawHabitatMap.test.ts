import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  HABITAT_SUITABLE_MIN,
  drawHabitatPlate,
  habitatKind,
  habitatLegendText,
  habitatLimit,
  habitatShares,
  habitatStats,
  type HabitatWords,
} from "./drawHabitatMap.ts";
import { HABITAT_BEST_DEPTH, HABITAT_BEST_VELOCITY, riverHabitat } from "./hydraulics.ts";

function konteksPalsu(w: number, teks: string[] = []): CanvasRenderingContext2D {
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
  ctx.fillText = (t: string) => teks.push(String(t));
  return ctx as unknown as CanvasRenderingContext2D;
}

const KATA: HabitatWords = {
  suitable: "Layak (f ≥ 0,5)",
  shallow: { depth: "Terlalu dangkal", velocity: "Terlalu lambat", none: "Terlalu dangkal atau lambat" },
  fast: { depth: "Terlalu dalam", velocity: "Terlalu deras", none: "Terlalu dalam atau deras" },
};
const persen = (f: number) => `${Math.round(f * 100)} %`;

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
          words: KATA,
          share: persen,
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

describe("EH-06 nama kelas menurut variabel pembatas dan sisinya", () => {
  const D = HABITAT_BEST_DEPTH;
  const V = HABITAT_BEST_VELOCITY;

  it("sungai landai dan kasar (Q 5, W 20, S 0,2 ‰, n 0,08): alur tengah terlalu DALAM, bukan deras", () => {
    const r = riverHabitat(5, 20, 0.0002, 0.08);
    const c = r.cells[30];
    assert.ok(c.depth > D && c.velocity < V, `d ${c.depth} V ${c.velocity}`);
    assert.equal(habitatKind(c, D, V), "fast");
    assert.equal(habitatLimit(c), "depth");
    const st = habitatStats(r.cells, D, V);
    assert.equal(st.fast.velocity, 0, "tidak ada pias terlalu deras");
    assert.ok(Math.abs(st.fast.depth - 46 / 60) < 1e-12, `dalam ${st.fast.depth}`);
    assert.equal(st.shallow.depth, 0);
    assert.ok(Math.abs(st.shallow.velocity - 14 / 60) < 1e-12, `lambat ${st.shallow.velocity}`);
    assert.equal(habitatLegendText("fast", st.fast, KATA, persen), "Terlalu dalam 77 %");
    assert.equal(habitatLegendText("shallow", st.shallow, KATA, persen), "Terlalu lambat 23 %");
  });

  it("bawaan (Q 5, W 20, S 2 ‰, n 0,035): tepi terlalu dangkal, alur terlalu deras", () => {
    const r = riverHabitat(5, 20, 0.002, 0.035);
    const st = habitatStats(r.cells, D, V);
    assert.ok(Math.abs(st.shallow.depth - 10 / 60) < 1e-12);
    assert.equal(st.shallow.velocity, 0);
    assert.ok(Math.abs(st.fast.velocity - 32 / 60) < 1e-12);
    assert.equal(st.fast.depth, 0);
    assert.equal(habitatLegendText("shallow", st.shallow, KATA, persen), "Terlalu dangkal 17 %");
    assert.equal(habitatLegendText("fast", st.fast, KATA, persen), "Terlalu deras 53 %");
    assert.equal(habitatLegendText("suitable", st.suitable, KATA, persen), "Layak (f ≥ 0,5) 30 %");
  });

  it("kelas campuran menyebut keduanya; kelas kosong memakai nama umum", () => {
    const r = riverHabitat(90, 20, 0.002, 0.035);
    const st = habitatStats(r.cells, D, V);
    assert.ok(st.fast.depth > 0 && st.fast.velocity > 0);
    assert.equal(habitatLegendText("fast", st.fast, KATA, persen), "Terlalu dalam 7 %, terlalu deras 87 %");
    const kecil = habitatStats(riverHabitat(0.3, 20, 0.002, 0.035).cells, D, V);
    assert.equal(habitatLegendText("fast", kecil.fast, KATA, persen), "Terlalu dalam atau deras 0 %");
  });

  it("jumlah bagian tiap kelas = bagian pada habitatShares", () => {
    for (const [Q, S, n] of [[5, 0.0002, 0.08], [5, 0.002, 0.035], [90, 0.002, 0.035]] as const) {
      const r = riverHabitat(Q, 20, S, n);
      const st = habitatStats(r.cells, D, V);
      const b = habitatShares(r.cells, D, V);
      for (const k of ["shallow", "suitable", "fast"] as const)
        assert.ok(Math.abs(st[k].total - b[k]) < 1e-12 && Math.abs(st[k].depth + st[k].velocity - b[k]) < 1e-12);
    }
  });

  it("legenda tergambar menyebut variabel pembatas yang benar", () => {
    const r = riverHabitat(5, 20, 0.0002, 0.08);
    const teks: string[] = [];
    drawHabitatPlate(
      konteksPalsu(820, teks),
      820,
      576,
      { xMin: 0, xMax: 20, yMin: 0, yMax: 20, equalScale: false, axisX: "Q", axisY: "WUA" },
      {
        cells: r.cells,
        width: 20,
        bestDepth: D,
        bestVelocity: V,
        title: "Peta",
        widthText: "W = 20 m",
        flowText: "Aliran",
        words: KATA,
        share: persen,
      },
      "id"
    );
    // stencil menulis per huruf dalam kapital.
    const semua = teks.join("").toUpperCase();
    assert.ok(!semua.includes("DERAS"), semua);
    assert.ok(semua.includes("TERLALU DALAM 77 %") && semua.includes("TERLALU LAMBAT 23 %"), semua);
  });
});
