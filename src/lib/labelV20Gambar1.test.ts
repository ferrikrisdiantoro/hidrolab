import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { drawStructure, type StructureSpec } from "./drawStructure.ts";
import { C } from "./theme.ts";

/*
 * Letak tulisan, temuan uji rekan V20 (11 Nov) kelompok gambar 1.
 *
 * Konteks perekam: tiap huruf stensil (fillText satu huruf) dicatat beserta
 * warnanya, tiap fillRect dicatat beserta warnanya dan urutannya, jadi uji
 * dapat menanyakan "apakah tulisan ini beralas kertas" dan "di baris mana".
 * measureText memberi 6,5 px per huruf seperti plateOutDraw.test.
 */

type Huruf = { c: string; x: number; y: number; warna: string; urut: number };
type Kotak = { x: number; y: number; w: number; h: number; warna: string; urut: number };

function perekam(w: number, h: number) {
  const huruf: Huruf[] = [];
  const kotak: Kotak[] = [];
  let urut = 0;
  const nop = () => {};
  const ctx: Record<string, unknown> = {
    canvas: { width: w, height: h },
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
  };
  for (const m of [
    "beginPath", "moveTo", "lineTo", "stroke", "fill", "rect", "clip", "save",
    "restore", "arc", "closePath", "strokeRect", "strokeText", "setLineDash",
    "setTransform", "translate", "rotate", "scale", "clearRect",
    "quadraticCurveTo", "bezierCurveTo", "ellipse",
  ])
    ctx[m] = nop;
  ctx.fillText = (c: string, x: number, y: number) =>
    huruf.push({ c, x, y, warna: String(ctx.fillStyle), urut: urut++ });
  ctx.fillRect = (x: number, y: number, ww: number, hh: number) =>
    kotak.push({ x, y, w: ww, h: hh, warna: String(ctx.fillStyle), urut: urut++ });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, huruf, kotak };
}

/** Huruf-huruf satu tulisan (tanpa spasi), dicari berurutan dalam catatan. */
function cariTulisan(huruf: Huruf[], teks: string): Huruf[] {
  const t = teks.toUpperCase().replace(/ /g, "");
  const isi = huruf.filter((h) => h.c !== " ");
  for (let i = 0; i + t.length <= isi.length; i++) {
    if ([...t].every((c, k) => isi[i + k].c === c)) return isi.slice(i, i + t.length);
  }
  return [];
}

const specDasar = (): StructureSpec => ({
  xMin: 0,
  xMax: 10,
  zMin: -2,
  zMax: 4,
  bodies: [
    {
      pts: [
        { x: 2, z: -2 },
        { x: 8, z: -2 },
        { x: 8, z: 3 },
        { x: 2, z: 3 },
      ],
    },
  ],
  axisX: "x",
  axisZ: "z",
});

describe("drawStructure: opsi alas dan baris atas nama bagian (V20)", () => {
  it("paper: tulisan yang muat tetap di tempatnya dan diberi alas kertas sebelum hurufnya", () => {
    const tanpa = perekam(820, 504);
    drawStructure(tanpa.ctx, 820, 504, { ...specDasar(), callouts: [{ x: 5, z: 1, dx: 20, dy: -30, text: "sirip penahan" }] }, "id");
    const pakai = perekam(820, 504);
    drawStructure(pakai.ctx, 820, 504, { ...specDasar(), callouts: [{ x: 5, z: 1, dx: 20, dy: -30, text: "sirip penahan", paper: true }] }, "id");
    const a = cariTulisan(tanpa.huruf, "sirip penahan");
    const b = cariTulisan(pakai.huruf, "sirip penahan");
    assert.ok(a.length > 0 && b.length === a.length);
    // Tempat tulisan tidak berubah.
    assert.deepEqual(b.map((h) => [h.x, h.y]), a.map((h) => [h.x, h.y]));
    // Ada alas kertas yang menutup seluruh huruf dan digambar sebelumnya.
    const alas = pakai.kotak.find(
      (k) =>
        k.warna === C.sheet && k.w < 300 &&
        k.urut < b[0].urut &&
        b.every((h) => h.x >= k.x - 1 && h.x + 6.5 <= k.x + k.w + 1 && h.y >= k.y && h.y <= k.y + k.h)
    );
    assert.ok(alas, "tulisan sirip penahan tanpa alas kertas");
  });

  it("rowTop: baris pertama di padT + 14, baris kedua 11 px di bawahnya", () => {
    const r = perekam(358, 600);
    drawStructure(r.ctx, 358, 600, {
      ...specDasar(),
      callouts: [{ x: 5, z: 1, dx: 16, dy: 0, text: "tirai pada\ntinggi rancangan", rowTop: true, paper: true }],
    }, "id");
    const satu = cariTulisan(r.huruf, "tirai pada");
    const dua = cariTulisan(r.huruf, "tinggi rancangan");
    assert.ok(satu.length && dua.length);
    assert.ok(Math.abs(satu[0].y - (26 + 14 - 0.5)) < 0.01, `baris 1 di ${satu[0].y}`);
    assert.ok(Math.abs(dua[0].y - satu[0].y - 11) < 0.01);
  });

  it("tanpa opsi baru keluaran tidak berubah (urutan dan letak huruf)", () => {
    const r1 = perekam(820, 504);
    drawStructure(r1.ctx, 820, 504, { ...specDasar(), callouts: [{ x: 5, z: 1, dx: 34, dy: 26, text: "muka mercu" }] }, "id");
    const h = cariTulisan(r1.huruf, "muka mercu");
    assert.ok(h.length);
    // Tulisan yang muat tidak diberi alas (perilaku lama).
    assert.ok(!r1.kotak.some((k) => k.warna === C.sheet && k.w < 300 && k.urut < h[0].urut && k.y <= h[0].y && k.y + k.h >= h[0].y && k.x <= h[0].x && k.x + k.w >= h[0].x));
  });
});
