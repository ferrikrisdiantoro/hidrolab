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

/* ------------------------------------------------------------------ *
 * DM-02: tulisan diagram gradasi tidak memutus kurva tanah
 * ------------------------------------------------------------------ */

import { drawChart } from "./drawChart.ts";
import { labelGradasi, panjangDalam } from "./labelGradasi.ts";
import { filterDesign, passingAt } from "./hydraulics.ts";

function gambarDM02(w: number, h: number, bD50: number, bCu: number, fD50: number, fCu: number) {
  const r = filterDesign(bD50, bCu, fD50, fCu);
  const kurva = (g: typeof r.base) => {
    const pts: { x: number; y: number }[] = [];
    for (let lg = Math.log10(0.002); lg <= Math.log10(200) + 1e-9; lg += 0.02) {
      const d = Math.pow(10, lg);
      pts.push({ x: d, y: passingAt(g, d) });
    }
    return pts;
  };
  const tanah = kurva(r.base);
  const filter = kurva(r.filter);
  const rk = perekam(w, h);
  const out = drawChart(rk.ctx, w, h, {
    xMin: 0.002, xMax: 200, labelUp: true, yMin: 0, yMax: 100, xLog: true,
    axisX: "d", axisY: "p",
    series: [{ pts: tanah }, { pts: filter, label: "filter", labelAt: 0.5, labelDy: 18 }],
    bands: [{ axis: "x", from: r.d15Min, to: r.d15Max }],
    rules: [
      { axis: "x", at: r.d15Min }, { axis: "x", at: r.d15Max },
      { axis: "y", at: 15, label: "15 %" },
    ],
    anchors: { d50f: { x: fD50, y: 50 }, d15f: { x: r.filter.d15, y: 15 } },
    point: { x: r.filter.d15, y: 15, label: "D15 0,358 mm" },
    padRight: 52,
  }, "id");
  const t0 = performance.now();
  const hasil = labelGradasi(rk.ctx, out, {
    kurva: [tanah, filter],
    nama: { pts: tanah, text: "tanah yang dilindungi", color: C.ink },
    batas: [
      { at: r.d15Min, text: "batas mengalirkan 0,478", short: "D15 ≥ 0,478", side: -1, color: C.critical },
      { at: r.d15Max, text: "batas menahan 0,753", short: "D15 ≤ 0,753", side: 1, color: C.critical },
    ],
    jendela: { from: r.d15Min, to: r.d15Max, text: "jendela filter" },
    judul: r.drains ? undefined : { text: "filter terlalu halus, ia menjadi bendungan kedua", color: C.caution },
  });
  const ms = performance.now() - t0;
  const tanahPx = tanah.map((p) => ({ x: out.map.X(p.x), y: out.map.Y(p.y) }));
  return { r, out, hasil, ms, tanahPx };
}

describe("DM-02 labelGradasi (V20: tanah seragam, jendela sempit)", () => {
  for (const [w, h, nama] of [[562, 530, "1280"], [340, 520, "HP 390"]] as const) {
    it(`${nama}: nama batas di atas bingkai, nama jendela tidak menyeberangi garis batas`, () => {
      const { out, hasil } = gambarDM02(w, h, 0.15, 1.4, 1.2, 6);
      const f = out.map.frame;
      for (const b of hasil.batas) assert.ok(b.y < f.y0, `${b.text} di dalam bidang`);
      const a = out.map.X(0.478);
      const j = hasil.jendela;
      const lebarPita = Math.abs(out.map.X(filterDesign(0.15, 1.4, 1.2, 6).d15Max) - a);
      // Utuh di dalam pita, atau utuh di luar pita.
      const pitaKiri = Math.min(a, a + lebarPita);
      const pitaKanan = pitaKiri + lebarPita;
      const dalam = j.x0 + 3 >= pitaKiri && j.x1 - 3 <= pitaKanan;
      const luar = j.x0 + 3 >= pitaKanan || j.x1 - 3 <= pitaKiri;
      assert.ok(dalam || luar, `jendela ${j.x0}-${j.x1} vs pita ${pitaKiri}-${pitaKanan}`);
    });
  }

  it("1280: tidak satu pun tulisan baru menutup kurva tanah, judul juga tidak", () => {
    const { hasil, tanahPx } = gambarDM02(562, 530, 0.15, 1.4, 1.2, 6);
    const g = [{ pts: tanahPx, bobot: 1 }];
    assert.equal(panjangDalam(hasil.nama, g), 0, "nama tanah menutup kurvanya");
    assert.equal(panjangDalam(hasil.jendela, g), 0, "nama jendela menutup kurva tanah");
    assert.ok(hasil.judul.length > 0);
    for (const k of hasil.judul) assert.equal(panjangDalam(k, g), 0, "judul menutup kurva tanah");
  });

  it("HP 390: kurva tanah tertutup paling banyak sepotong pendek per tulisan", () => {
    const { hasil, tanahPx } = gambarDM02(340, 520, 0.15, 1.4, 1.2, 6);
    const g = [{ pts: tanahPx, bobot: 1 }];
    const total = [hasil.nama, hasil.jendela, ...hasil.judul].reduce((s, k) => s + panjangDalam(k, g), 0);
    // Dulu empat tulisan berurutan memutus kurva dari 100 % sampai ±80 %.
    assert.ok(total <= 60, `tertutup ${total.toFixed(1)} px`);
  });

  it("cukup cepat untuk seret (≤ 16 ms, satu bingkai 60 fps, di mesin uji)", () => {
    // Dipanaskan dulu (JIT), lalu waktu tercepat dari beberapa putaran.
    for (let i = 0; i < 5; i++) gambarDM02(562, 530, 0.15, 1.4, 1.2, 6);
    const ms = Math.min(...Array.from({ length: 8 }, () => gambarDM02(562, 530, 0.15, 1.4, 1.2, 6).ms));
    assert.ok(ms <= 16, `${ms.toFixed(1)} ms`);
  });
});
