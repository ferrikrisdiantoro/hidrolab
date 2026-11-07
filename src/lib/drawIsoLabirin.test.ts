import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MARGIN_ISO,
  RUANG_JUDUL_ISO,
  alasDinding,
  drawIsoLabirin,
  mukaLabirin,
  rasioIsoLabirin,
  ruasLabirin,
  tebalDinding,
} from "./drawIsoLabirin.ts";
import { labyrinthWeir } from "./hydraulics.ts";
import { ISO, anchor3, isometrikBaku, kameraPas, normalMuka } from "./proyeksi.ts";

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
    assert.equal(atas, 18 + 5, "satu muka atas per ruas, ditambah satu baji bevel per V tajam");
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

/* Putaran 2, perbaikan pilot (spesifikasi 3D-HS02-TIRAI, bagian pertama). */
describe("drawIsoLabirin perbaikan pilot", () => {
  for (const [W, n, B] of [
    [30, 6, 6], // α 11,8°, V tajam
    [30, 10, 14], // α 3,1°, di bawah rentang uji
    [12, 1, 2], // α 56°, tanpa V
  ]) {
    it(`tebal dinding penuh t/2 di kedua sisi tiap ruas, juga di V tajam (W ${W}, N ${n}, B ${B})`, () => {
      const t = tebalDinding(W, n);
      const ruas = ruasLabirin(W, n, B);
      const { ruas: alas } = alasDinding(ruas, t, W);
      assert.equal(alas.length, ruas.length);
      alas.forEach((q, j) => {
        const r = ruas[j];
        const L = Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y);
        const nx = -(r.b.y - r.a.y) / L;
        const ny = (r.b.x - r.a.x) / L;
        for (const p of q) {
          const d = Math.abs((p.x - r.a.x) * nx + (p.y - r.a.y) * ny);
          assert.ok(Math.abs(d - t / 2) < 1e-9, `ruas ${j}: jarak ${d} lawan t/2 ${t / 2}`);
        }
      });
    });

    it(`dinding tidak menembus keluar saluran 0..W (W ${W}, N ${n}, B ${B})`, () => {
      const t = tebalDinding(W, n);
      const { ruas: alas, baji } = alasDinding(ruasLabirin(W, n, B), t, W);
      for (const p of [...alas.flat(), ...baji.flat()])
        assert.ok(p.y >= -1e-9 && p.y <= W + 1e-9, `y ${p.y}`);
      // Ujung pertama dan terakhir tepat di dinding saluran.
      assert.ok(Math.abs(alas[0][0].y) < 1e-9 && Math.abs(alas[0][3].y) < 1e-9);
      const akhir = alas[alas.length - 1];
      assert.ok(Math.abs(akhir[1].y - W) < 1e-9 && Math.abs(akhir[2].y - W) < 1e-9);
    });
  }

  it("sambungan V tajam diisi baji bevel, sudut cembung x = B tetap miter", () => {
    const t = tebalDinding(30, 6);
    const { baji } = alasDinding(ruasLabirin(30, 6, 6), t, 30);
    assert.equal(baji.length, 5, "satu baji per V di x = 0 antar siklus");
    // Di kaki siklus (x = 0), bukan di puncak x = B.
    for (const tri of baji) for (const p of tri) assert.ok(p.x < 1, `baji di x ${p.x}`);
    assert.ok(t > 0);
  });

  it("isometrik baku hanya pada angkat 35,26° dan arah 45° + k·90°", () => {
    assert.ok(isometrikBaku(-ISO.yaw, ISO.pitch));
    assert.ok(isometrikBaku(ISO.yaw + Math.PI / 2, ISO.pitch));
    assert.ok(!isometrikBaku(-ISO.yaw + Math.PI / 12, ISO.pitch));
    assert.ok(!isometrikBaku(-ISO.yaw, ISO.pitch + Math.PI / 12));
  });

  it("tinggi bidang dari kotak batas: gambar 342 px lebar mengisi tinggi yang tersedia", () => {
    const r = rasioIsoLabirin(S);
    assert.ok(r > 0.2 && r < 1.5, `rasio ${r}`);
    const w = 342;
    const h = r * (w - 2 * MARGIN_ISO) + 2 * MARGIN_ISO + RUANG_JUDUL_ISO;
    const { batas } = mukaLabirin(S);
    const k = kameraPas(batas, w, h - RUANG_JUDUL_ISO, -ISO.yaw, ISO.pitch, MARGIN_ISO);
    // Lebar dan tinggi sama-sama penuh: skala dari lebar = skala dari tinggi.
    const kW = kameraPas(batas, w, 1e6, -ISO.yaw, ISO.pitch, MARGIN_ISO);
    assert.ok(Math.abs(k.skala - kW.skala) / kW.skala < 1e-6, `${k.skala} vs ${kW.skala}`);
  });
});
