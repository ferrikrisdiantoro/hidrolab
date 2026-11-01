import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { drawIsoLabirin, mukaLabirin, ruasLabirin, tebalDinding } from "./drawIsoLabirin.ts";
import { labyrinthWeir } from "./hydraulics.ts";
import { anchor3, normalMuka } from "./proyeksi.ts";

/*
 * HS-02 pilot 3D: geometri dinding dari denah model, bukan karangan, dan
 * gambar memuat seluruh benda di kanvas.
 */

function kanvas() {
  const pts: [number, number][] = [];
  const st: Record<string, unknown> = { fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "left" };
  const nop = () => {};
  const ctx = new Proxy(st, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k === "measureText") return () => ({ width: 6 });
      if (k === "moveTo" || k === "lineTo") return (x: number, y: number) => pts.push([x, y]);
      return nop;
    },
    set(t, k: string, v) {
      t[k] = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, pts };
}

const S = { h: 0.8, P: 2, W: 30, cycles: 6, B: 6, outOfRange: false };

describe("drawIsoLabirin geometri", () => {
  it("panjang garis tengah dinding = crestLength model", () => {
    for (const [W, n, B] of [
      [30, 6, 6],
      [12, 3, 4],
      [50, 10, 8],
    ]) {
      const r = labyrinthWeir(0.8, 2, W, n, B);
      const L = ruasLabirin(W, n, B).reduce((s, g) => s + Math.hypot(g.b.x - g.a.x, g.b.y - g.a.y), 0);
      assert.ok(Math.abs(L - r.crestLength) < 1e-9, `${L} vs ${r.crestLength}`);
    }
  });

  it("tiga ruas per siklus, menutup lebar saluran 0..W", () => {
    const g = ruasLabirin(30, 6, 6);
    assert.equal(g.length, 18);
    assert.equal(g[0].a.y, 0);
    assert.ok(Math.abs(g[g.length - 1].b.y - 30) < 1e-9);
  });

  it("dinding setinggi P, muka air hulu di P + h", () => {
    const { muka, batas } = mukaLabirin(S);
    const zDinding = muka.filter((m) => m.garis === "#3d4644").flatMap((m) => m.pts.map((p) => p[2]));
    assert.ok(zDinding.includes(S.P));
    assert.equal(batas.max[2], S.P + S.h);
    assert.ok(tebalDinding(30, 6) >= 0.12);
  });

  it("muka dinding: atas menghadap ke atas, samping mendatar ke luar ruas", () => {
    const { muka } = mukaLabirin(S);
    const dinding = muka.filter((m) => m.garis === "#3d4644" && m.pts.every((p) => p[2] >= 0));
    let atas = 0;
    for (const m of dinding) {
      const n = normalMuka(m.pts);
      if (m.pts.every((p) => p[2] === S.P)) {
        assert.ok(n[2] > 0.999);
        atas++;
      } else if (m.pts.some((p) => p[2] === S.P)) {
        assert.ok(Math.abs(n[2]) < 1e-9);
      }
    }
    assert.equal(atas, 18, "satu muka atas per ruas");
  });
});

describe("drawIsoLabirin gambar", () => {
  for (const [w, h] of [
    [960, 520],
    [390, 300],
  ]) {
    it(`seluruh titik gambar di dalam kanvas ${w}×${h}`, () => {
      const { ctx, pts: jejak } = kanvas();
      const out = drawIsoLabirin(ctx, w, h, S, { heading: "uji" });
      assert.ok(jejak.length > 100);
      // Titik muka terproyeksi (garis arsir sengaja melewati muka lalu dipotong clip).
      const pts = mukaLabirin(S).muka.flatMap((m) =>
        m.pts.map((p) => {
          const a = anchor3(p, out.kamera);
          return [a.x, a.y] as [number, number];
        })
      );
      for (const [x, y] of pts) assert.ok(x >= -1e-6 && x <= w + 1e-6 && y >= -1e-6 && y <= h + 1e-6, `${x},${y}`);
      assert.deepEqual(out.anchors!.puncak, anchor3([S.B, S.W / S.cycles / 2, S.P], out.kamera));
    });
  }
});
