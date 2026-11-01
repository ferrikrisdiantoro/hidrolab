import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { drawChart, type ChartSpec } from "./drawChart.ts";

/*
 * drawChart S7: batang dari tepi atas (topBars) dan deret tersembunyi
 * (hidden). Konteks palsu mencatat setiap perintah gambar beserta warna
 * goresan dan isian saat itu, jadi uji membaca apa yang benar-benar
 * digambar, bukan hanya PlateOut.
 */

type Catatan = { m: string; a: unknown[]; stroke: string; fill: string; alpha: number };

function konteksRekam(): { ctx: CanvasRenderingContext2D; log: Catatan[] } {
  const log: Catatan[] = [];
  const st: Record<string, unknown> = {
    font: "10px sans-serif",
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: "left",
    textBaseline: "alphabetic",
    lineCap: "butt",
    lineJoin: "miter",
  };
  const ctx: Record<string, unknown> = {
    canvas: { width: 820, height: 504 },
    measureText: (t: string) => ({ width: [...String(t)].length * 6.5 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    getLineDash: () => [],
  };
  for (const k of Object.keys(st))
    Object.defineProperty(ctx, k, {
      get: () => st[k],
      set: (v) => {
        st[k] = v;
      },
    });
  for (const m of [
    "beginPath", "moveTo", "lineTo", "stroke", "fill", "rect", "clip", "save",
    "restore", "arc", "closePath", "fillRect", "strokeRect", "fillText",
    "strokeText", "setLineDash", "setTransform", "translate", "rotate",
    "scale", "clearRect", "quadraticCurveTo", "bezierCurveTo", "ellipse",
  ])
    ctx[m] = (...a: unknown[]) =>
      log.push({
        m,
        a,
        stroke: String(st.strokeStyle),
        fill: String(st.fillStyle),
        alpha: Number(st.globalAlpha),
      });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
}

const W = 820;
const H = 504;

const dasar = (): ChartSpec => ({
  xMin: 0,
  xMax: 10,
  yMin: 0,
  yMax: 100,
  axisX: "waktu",
  axisY: "debit",
  series: [
    { pts: [{ x: 0, y: 5 }, { x: 4, y: 60 }, { x: 10, y: 10 }], label: "HIDROGRAF", color: "#123456", labelAt: 0.5 },
    { pts: [{ x: 0, y: 5 }, { x: 10, y: 5 }], label: "ALIRAN DASAR", color: "#654321" },
  ],
  regions: [{ x: 5, y: 95, text: "PUNCAK" }],
  point: { x: 4, y: 60, label: "Qp" },
});

const BARS = {
  bars: [
    { x0: 0, x1: 1, v: 10 },
    { x0: 1, x1: 2, v: 40 },
    { x0: 2, x1: 3, v: 20 },
  ],
  max: 40,
  label: "HUJAN",
  unit: "mm/jam",
  color: "#00aa55",
};

function gambar(spec: ChartSpec) {
  const { ctx, log } = konteksRekam();
  const out = drawChart(ctx, W, H, spec, "id");
  return { out, log };
}

/** Kotak rect() yang digambar dengan warna batang */
function kotakBatang(log: Catatan[], warna: string) {
  const isi = log.findIndex((c) => c.m === "fill" && c.fill === warna);
  assert.ok(isi > 0, "batang diisi warnanya");
  let mulai = isi;
  while (mulai > 0 && log[mulai - 1].m !== "beginPath") mulai--;
  return log
    .slice(mulai, isi)
    .filter((c) => c.m === "rect")
    .map((c) => c.a as number[]);
}

describe("drawChart topBars", () => {
  it("batang menggantung dari tepi atas bidang, tinggi sebanding v/max", () => {
    const { out, log } = gambar({ ...dasar(), topBars: BARS });
    const f = out.map.frame;
    const kotak = kotakBatang(log, BARS.color);
    assert.equal(kotak.length, 3);
    const plotH = f.y1 - f.y0;
    const pitaH = 0.3 * plotH;
    for (let i = 0; i < 3; i++) {
      const [x, y, w, h] = kotak[i];
      assert.ok(Math.abs(y - f.y0) < 1e-9, "batang mulai di tepi atas");
      assert.ok(Math.abs(h - (BARS.bars[i].v / BARS.max) * pitaH) < 1e-6, "tinggi ∝ v/max");
      assert.ok(Math.abs(x - out.map.X(BARS.bars[i].x0)) < 1e-9);
      assert.ok(Math.abs(w - (out.map.X(BARS.bars[i].x1) - out.map.X(BARS.bars[i].x0))) < 1e-9);
    }
    // peta pita: nol di tepi atas, max di tepi bawah pita
    const mp = out.maps?.topBars;
    assert.ok(mp);
    assert.ok(Math.abs(mp.Y(0) - f.y0) < 1e-9);
    assert.ok(Math.abs(mp.Y(BARS.max) - (f.y0 + pitaH)) < 1e-6);
    assert.ok(Math.abs(mp.invY(mp.Y(25)) - 25) < 1e-9);
  });

  it("heightFrac mengatur tinggi pita, warna bawaan C.water", () => {
    const { out, log } = gambar({
      ...dasar(),
      topBars: { ...BARS, color: undefined, heightFrac: 0.5 },
    });
    const f = out.map.frame;
    const kotak = kotakBatang(log, "#1f5f82");
    assert.ok(Math.abs(kotak[1][3] - 0.5 * (f.y1 - f.y0)) < 1e-6);
  });

  it("label kurva, nama wilayah, dan tulisan titik tidak bertumpuk dengan pita", () => {
    const { out } = gambar({ ...dasar(), topBars: BARS });
    const f = out.map.frame;
    const bawahPita = f.y0 + 0.3 * (f.y1 - f.y0);
    assert.ok(out.labels && out.labels.length >= 3);
    for (const r of out.labels) assert.ok(r.y >= bawahPita, `label di y=${r.y} di atas ${bawahPita}`);
  });

  it("sumbu kanan: nama dan satuan ditulis, ruang kanan bawaan melebar", () => {
    const tanpa = gambar(dasar()).out.map.frame;
    const { out, log } = gambar({ ...dasar(), topBars: BARS });
    assert.equal(out.map.frame.x1, W - 64);
    assert.equal(tanpa.x1, W - 30);
    const teks = log.filter((c) => c.m === "fillText").map((c) => String(c.a[0]));
    assert.ok(teks.includes("40"), "angka max di sumbu kanan");
    assert.ok(teks.join("").includes("MM/JAM") || teks.join("").includes("mm/jam"));
  });
});

describe("drawChart hidden", () => {
  it("deret berlabel yang disembunyikan tidak digambar", () => {
    const tampil = gambar(dasar()).log;
    const sembunyi = gambar({ ...dasar(), hidden: new Set(["HIDROGRAF"]) }).log;
    const goresan = (log: Catatan[], w: string) => log.filter((c) => c.m === "stroke" && c.stroke === w).length;
    assert.ok(goresan(tampil, "#123456") > 0);
    assert.equal(goresan(sembunyi, "#123456"), 0);
    assert.equal(goresan(sembunyi, "#654321"), goresan(tampil, "#654321"));
  });

  it("hidden dengan label topBars menyembunyikan batang, tata letak tetap", () => {
    const a = gambar({ ...dasar(), topBars: BARS });
    const b = gambar({ ...dasar(), topBars: BARS, hidden: new Set(["HUJAN"]) });
    assert.equal(b.log.filter((c) => c.m === "fill" && c.fill === BARS.color).length, 0);
    assert.deepEqual(b.out.map.frame, a.out.map.frame);
    assert.deepEqual(b.out.labels, a.out.labels);
  });

  it("tanpa field baru, keluaran dan perintah gambar sama dengan hidden kosong", () => {
    const a = gambar(dasar());
    const b = gambar({ ...dasar(), hidden: new Set() });
    assert.deepEqual(b.out.labels, a.out.labels);
    assert.deepEqual(b.out.anchors, a.out.anchors);
    assert.equal(a.out.maps, undefined);
    assert.deepEqual(b.log, a.log);
  });
});
