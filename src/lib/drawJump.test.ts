import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createJumpMotion, drawJump, drawJumpMotion, jumpLayout } from "./drawJump.ts";
import { conjugateDepth, froude } from "./hydraulics.ts";

/*
 * OC-01 (Phase 2 pilot): temuan insinyur-hidraulika G1 sampai G4 dan lapis
 * gerak. Konteks palsu mencatat teks yang ditulis dan ruas garis yang
 * digambar, supaya isi gambar bisa diperiksa tanpa peramban.
 */

type Rekam = { teks: string[]; ruas: number[][]; alpha: number[] };

function konteks(w: number): { ctx: CanvasRenderingContext2D; rekam: Rekam } {
  const rekam: Rekam = { teks: [], ruas: [], alpha: [] };
  let titik: number[] | null = null;
  const nop = () => {};
  const ctx: Record<string, unknown> = {
    canvas: { width: w, height: 600 },
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
    fillText: (t: string) => rekam.teks.push(String(t)),
    moveTo: (x: number, y: number) => {
      titik = [x, y];
    },
    lineTo: (x: number, y: number) => {
      if (titik) rekam.ruas.push([...titik, x, y]);
      titik = [x, y];
    },
    stroke: () => rekam.alpha.push(ctx.globalAlpha as number),
  };
  for (const m of [
    "beginPath", "fill", "rect", "clip", "save", "restore", "arc", "closePath",
    "fillRect", "strokeRect", "strokeText", "setLineDash", "setTransform",
    "translate", "rotate", "scale", "clearRect", "quadraticCurveTo",
    "bezierCurveTo", "ellipse",
  ])
    ctx[m] = nop;
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rekam };
}

// stencil() menulis per huruf atau per kata; gabungkan untuk dicari.
const semuaTeks = (r: Rekam) => r.teks.join("").toLowerCase().replace(/\s+/g, "");
const cari = (r: Rekam, s: string) => semuaTeks(r).includes(s.toLowerCase().replace(/\s+/g, ""));

describe("drawJump: label wilayah (G1)", () => {
  it("Fr₁ ≤ 1 tidak menulis superkritis; satu wilayah subkritis · tak ada loncatan", () => {
    for (const w of [820, 358]) {
      const { ctx, rekam } = konteks(w);
      drawJump(ctx, w, 504, { y1: 0.3, V1: 0.5 }, { lang: "id", flow: true });
      assert.ok(!cari(rekam, "superkritis"), `lebar ${w}: masih ada "superkritis"`);
      assert.ok(cari(rekam, "subkritis · tidak terbentuk loncatan"), `lebar ${w}`);
    }
  });

  it("dengan loncatan ketiga wilayah tetap tertulis", () => {
    const { ctx, rekam } = konteks(820);
    drawJump(ctx, 820, 504, { y1: 0.3, V1: 7 }, { lang: "en", flow: true });
    for (const s of ["supercritical", "jump", "subcritical"]) assert.ok(cari(rekam, s), s);
  });
});

describe("drawJump: loncatan berombak (G2) dan posisi skematik (G4)", () => {
  const y1 = 0.3;
  const V1 = 2.2; // Fr₁ ≈ 1,28
  it("label Lj ditulis sebagai pendekatan, dua bahasa", () => {
    assert.ok(froude(V1, y1) > 1 && froude(V1, y1) < 1.7);
    for (const [lang, kata] of [["id", "(pendekatan)"], ["en", "(approximate)"]] as const) {
      const { ctx, rekam } = konteks(820);
      drawJump(ctx, 820, 504, { y1, V1 }, { lang, flow: true });
      assert.ok(cari(rekam, `Lj ≈ 6 y₂ ${kata}`), lang);
    }
  });

  it("muka air bergelombang dengan amplitudo sebanding y₂ − y₁, ujungnya y₁ dan y₂", () => {
    const L = jumpLayout(820, 504, { y1, V1 });
    assert.ok(L.undular);
    const y2 = conjugateDepth(y1, froude(V1, y1));
    let maks = -Infinity;
    let min = Infinity;
    let naikTurun = 0;
    let lalu = L.depthAt(L.xJump);
    let arah = 0;
    for (let i = 1; i <= 400; i++) {
      const d = L.depthAt(L.xJump + (L.Lj * i) / 400);
      maks = Math.max(maks, d);
      min = Math.min(min, d);
      const a = Math.sign(d - lalu);
      if (a && arah && a !== arah) naikTurun++;
      if (a) arah = a;
      lalu = d;
    }
    assert.ok(Math.abs(L.depthAt(L.xJump + L.Lj) - y2) < 1e-9);
    assert.ok(maks > y2 && maks - y2 < 0.4 * (y2 - y1), `puncak ${maks}`);
    assert.ok(min >= y1 - 1e-9, "lembah tidak di bawah y₁");
    assert.ok(naikTurun >= 2, `gelombang ${naikTurun}`);
  });

  it("keterangan posisi skematik ada bila ada loncatan, tidak ada tanpa loncatan", () => {
    const a = konteks(820);
    drawJump(a.ctx, 820, 504, { y1: 0.3, V1: 7 }, { lang: "id", flow: true });
    assert.ok(a.rekam.teks.includes("posisi loncatan skematik"));
    const b = konteks(820);
    drawJump(b.ctx, 820, 504, { y1: 0.3, V1: 0.5 }, { lang: "en", flow: true });
    assert.ok(!b.rekam.teks.includes("jump position schematic"));
  });
});

describe("drawJumpMotion: laju dan goresan dari model (G3)", () => {
  // Panjang mendatar ruas goresan (kepala − ekor), px.
  const panjang = (r: Rekam) => r.ruas.map((s) => s[2] - s[0]);

  it("partikel hulu maju V₁·dt, goresan sebanding V₁ sampai 16 m/s", () => {
    const hasil: number[] = [];
    for (const V1 of [8, 16]) {
      const st = createJumpMotion(150);
      const { ctx, rekam } = konteks(820);
      const p = { y1: 0.08, V1 };
      drawJumpMotion(ctx, 820, 504, 0, 0, p, {}, st);
      const L = st.lay!;
      // Partikel 0 di x = 0 (hulu): sesudah dt maju V₁·dt meter.
      const x0 = st.pool.x[0] * L.bentang;
      const r2 = konteks(820);
      drawJumpMotion(r2.ctx, 820, 504, 0.01, 0.01, p, {}, st);
      assert.ok(Math.abs(st.pool.x[0] * L.bentang - x0 - V1 * 0.01) < 1e-4, `V1 ${V1}`);
      hasil.push(Math.max(...panjang(rekam)));
    }
    // Tidak jenuh: dua kali V₁ memberi dua kali panjang goresan hulu.
    assert.ok(Math.abs(hasil[1] / hasil[0] - 2) < 1e-6, `rasio ${hasil[1] / hasil[0]}`);
  });

  it("partikel hilir maju q/y₂·dt", () => {
    const p = { y1: 0.3, V1: 7 };
    const st = createJumpMotion(150);
    const { ctx } = konteks(820);
    drawJumpMotion(ctx, 820, 504, 0, 0, p, {}, st);
    const L = st.lay!;
    const i = st.pool.n - 1; // paling hilir
    const x0 = st.pool.x[i] * L.bentang;
    assert.ok(x0 > L.xJump + L.Lj);
    drawJumpMotion(konteks(820).ctx, 820, 504, 0.01, 0.01, p, {}, st);
    const V2 = (p.V1 * p.y1) / L.y2;
    assert.ok(Math.abs(st.pool.x[i] * L.bentang - x0 - V2 * 0.01) < 1e-4);
  });

  it("loncatan berombak: tanpa lintasan gulungan (satu stroke)", () => {
    const st = createJumpMotion(150);
    const { ctx, rekam } = konteks(820);
    drawJumpMotion(ctx, 820, 504, 1, 0.016, { y1: 0.3, V1: 2.2 }, {}, st);
    assert.equal(rekam.alpha.length, 1);
    const b = konteks(820);
    drawJumpMotion(b.ctx, 820, 504, 1, 0.016, { y1: 0.3, V1: 7 }, {}, createJumpMotion(150));
    assert.deepEqual(b.rekam.alpha, [0.34, 0.5]);
  });

  it("tata letak lapis gerak sama dengan lapis statis (badan air yang sama)", () => {
    const p = { y1: 0.25, V1: 8.5 };
    const st = createJumpMotion(10);
    drawJumpMotion(konteks(820).ctx, 820, 504, 0, 0, p, { showEnergy: false }, st);
    const L = jumpLayout(820, 504, p, { showEnergy: false });
    assert.deepEqual(st.lay!.pts, L.pts);
  });
});
