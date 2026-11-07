import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  PANJANG_GAMBAR_MAKS,
  drawIsoDenil,
  mukaDenil,
  rasioIsoDenil,
  siripDenil,
  type IsoDenilState,
} from "./drawIsoDenil.ts";
import { denilFishway } from "./hydraulics.ts";
import { ISO, anchor3, arahPandang, gambarMuka, urutMuka, type Kamera } from "./proyeksi.ts";

/*
 * EH-02 isometrik: palung miring dari denilFishway (b, y, S, L = H/S),
 * sirip dari aturan gambar potongan yang sama, muka air sejajar lantai
 * pada kedalaman model, aliran sekunder TIDAK digambar.
 */

function kanvas() {
  const st: Record<string, unknown> = { fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "left" };
  const nop = () => {};
  const ctx = new Proxy(st, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k === "measureText") return () => ({ width: 6 });
      return nop;
    },
    set(t, k: string, v) {
      t[k] = v;
      return true;
    },
  });
  return ctx as unknown as CanvasRenderingContext2D;
}

const DASAR: IsoDenilState = { b: 0.6, y: 0.7, S: 0.2, rise: 3, burst: 2.5 };
const KASUS: IsoDenilState[] = [
  DASAR,
  { b: 0.25, y: 0.2, S: 0.04, rise: 0.5, burst: 0.5 },
  { b: 1.5, y: 2, S: 0.4, rise: 12, burst: 6 },
  { b: 0.6, y: 1.2, S: 0.12, rise: 3, burst: 2.5 }, // L 25 m: digambar 8 m
];

/** Salinan loop sirip potongan lama TanggaIkanDenilClient (sebelum 3D). */
function siripLama(b: number, y: number, panjang: number) {
  const jarakSirip = Math.max(b * 0.6, 0.25);
  const jumlah = Math.max(2, Math.floor(panjang / jarakSirip));
  const tebal = Math.max(b * 0.06, 0.03);
  const tinggi = y * 0.62;
  const miring = tinggi * 0.45;
  const iPertama = Math.max(1, Math.ceil((miring - 1e-9) / jarakSirip));
  const xs: number[] = [];
  for (let i = iPertama; i <= jumlah; i++) {
    const xx = i * jarakSirip;
    if (xx > panjang) break;
    xs.push(xx);
  }
  return { jarakSirip, tebal, tinggi, miring, xs };
}

describe("EH-02 isometrik: aturan sirip sama dengan potongan", () => {
  for (const s of KASUS)
    it(`siripDenil = loop potongan lama (b ${s.b}, y ${s.y}, S ${s.S})`, () => {
      const r = denilFishway(s.b, s.y, s.S, s.rise);
      const panjang = Math.min(r.runLength, 8);
      const lama = siripLama(s.b, s.y, panjang);
      const baru = siripDenil(s.b, s.y, panjang);
      assert.deepEqual(baru, lama);
    });
});

describe("EH-02 isometrik: geometri = model", () => {
  for (const s of KASUS)
    it(`lantai z = −S x, muka air tegak lurus lantai sejauh y, lebar b (b ${s.b}, y ${s.y}, S ${s.S})`, () => {
      const r = denilFishway(s.b, s.y, s.S, s.rise);
      const g = mukaDenil(s, -1);
      const yT = s.y * Math.sqrt(1 + s.S * s.S);
      let nL = 0, nA = 0, nD = 0;
      for (let i = 0; i < g.muka.length; i++) {
        for (const q of g.muka[i].pts) {
          if (g.peran[i] === "lantai") {
            assert.ok(Math.abs(q[2] + s.S * q[0]) < 1e-9, `lantai ${q}`);
            assert.ok(Math.abs(Math.abs(q[1]) - s.b / 2) < 1e-9);
            nL++;
          }
          if (g.peran[i] === "air-atas") {
            assert.ok(Math.abs(q[2] - (-s.S * q[0] + yT)) < 1e-9, `air ${q}`);
            // Jarak tegak lurus ke bidang lantai z + S x = 0 sama dengan y model.
            const d = (q[2] + s.S * q[0]) / Math.sqrt(1 + s.S * s.S);
            assert.ok(Math.abs(d - r.depth) < 1e-9);
            nA++;
          }
          if (g.peran[i] === "dinding-dalam") {
            assert.ok(Math.abs(Math.abs(q[1]) - s.b / 2) < 1e-9);
            nD++;
          }
        }
      }
      assert.ok(nL > 0 && nA > 0 && nD > 0);
      // Panjang palung tergambar = min(L model, 8 m).
      assert.ok(Math.abs(g.panjang - Math.min(r.runLength, PANJANG_GAMBAR_MAKS)) < 1e-12);
      assert.equal(g.terpotong, r.runLength > PANJANG_GAMBAR_MAKS);
    });

  it("sirip: posisi, tinggi 0,62 y, miring ke hulu, selebar palung", () => {
    const g = mukaDenil(DASAR, -1);
    const r = denilFishway(DASAR.b, DASAR.y, DASAR.S, DASAR.rise);
    const aturan = siripDenil(DASAR.b, DASAR.y, Math.min(r.runLength, 8));
    assert.equal(g.sirip.length, aturan.xs.length);
    for (let k = 0; k < g.sirip.length; k++) {
      const sr = g.sirip[k];
      assert.ok(Math.abs(sr.x - aturan.xs[k]) < 1e-12);
      // Puncak di hulu kaki (miring ke hulu), tinggi tegak 0,62 y.
      assert.ok(sr.puncakX < sr.x);
      assert.ok(Math.abs(sr.puncakZ - (-DASAR.S * sr.x + 0.62 * DASAR.y)) < 1e-9);
    }
    for (let i = 0; i < g.muka.length; i++)
      if (g.peran[i] === "sirip")
        for (const q of g.muka[i].pts) assert.ok(Math.abs(q[1]) <= DASAR.b / 2 + 1e-12);
  });

  it("aliran sekunder tidak digambar: tidak ada muka atau tulisan aliran sekunder", () => {
    const g = mukaDenil(DASAR, -1);
    assert.ok(!g.peran.some((p) => p.includes("sekunder")));
  });

  it("dinding dekat dibuang: dinding utuh hanya di sisi jauh", () => {
    for (const sisi of [-1, 1] as const) {
      const g = mukaDenil(DASAR, sisi);
      for (let i = 0; i < g.muka.length; i++)
        if (g.peran[i] === "dinding-dalam")
          for (const q of g.muka[i].pts) assert.equal(Math.sign(q[1]), -sisi);
    }
  });
});

describe("EH-02 isometrik: muka menghadap pengamat", () => {
  for (const yaw of [-ISO.yaw, ISO.yaw, -2.4, 2.4])
    it(`muka yang menghadap terlihat, ujung belakang dibuang (yaw ${yaw.toFixed(2)})`, () => {
      const out = drawIsoDenil(kanvas(), 960, 520, DASAR, { yaw, pitch: ISO.pitch });
      const sisi = arahPandang(out.kamera)[1] >= 0 ? -1 : 1;
      const g = mukaDenil(DASAR, sisi as -1 | 1);
      const tampak = new Set(urutMuka(g.muka, out.kamera));
      const ujungDepan = arahPandang(out.kamera)[0] < 0 ? g.panjang : 0;
      for (let i = 0; i < g.muka.length; i++) {
        const p = g.peran[i];
        if (p === "lantai" || p === "dinding-dalam" || p === "dinding-atas" || p === "potong-lantai" || p === "potong-air" || p === "sirip-potong")
          assert.ok(tampak.has(i), `${p} ${i} dibuang`);
        if (p === "ujung" || p === "air-ujung")
          assert.equal(tampak.has(i), Math.abs(g.muka[i].pts[0][0] - ujungDepan) < 1e-9, `${p} x ${g.muka[i].pts[0][0]}`);
      }
    });
});

describe("EH-02 isometrik: di dalam kanvas dan anggaran bingkai", () => {
  for (const s of KASUS)
    for (const [w, h] of [
      [960, 520],
      [390, 300],
    ])
      it(`semua titik di dalam ${w}×${h} (b ${s.b}, y ${s.y}, S ${s.S})`, () => {
        const out = drawIsoDenil(kanvas(), w, h, s, {
          heading: "uji",
          teks: { sirip: "sirip penahan", terpotong: (L: string) => `L ${L}` },
        });
        for (const sisi of [-1, 1] as const)
          for (const m of mukaDenil(s, sisi).muka)
            for (const p of m.pts) {
              const a = anchor3(p, out.kamera);
              assert.ok(a.x >= -1e-6 && a.x <= w + 1e-6 && a.y >= -1e-6 && a.y <= h + 1e-6, `${a.x},${a.y}`);
            }
        for (const b of out.labels ?? []) assert.ok(b.x >= 0 && b.x + b.w <= w && b.y >= 0 && b.y + b.h <= h);
      });

  it("rasio tinggi bidang positif dan wajar", () => {
    const r = rasioIsoDenil(DASAR);
    assert.ok(r > 0.1 && r < 1.5, `${r}`);
  });

  it("anggaran bingkai: memutar gambar jauh di bawah 16,7 ms, muka di-cache", (t) => {
    const s = { b: 0.25, y: 2, S: 0.04, rise: 12, burst: 2 }; // sirip terbanyak: jarak 0,25 m, 8 m
    const { muka } = mukaDenil(s, -1);
    const kosong = kanvas();
    const kam: Kamera = { yaw: -ISO.yaw, pitch: ISO.pitch, skala: 60, cx: 480, cy: 260 };
    for (let i = 0; i < 20; i++) gambarMuka(kosong, muka, kam);
    let per = Infinity;
    for (let batch = 0; batch < 6; batch++) {
      const t0 = performance.now();
      for (let i = 0; i < 20; i++) {
        const yaw = -ISO.yaw + (batch * 20 + i) * 0.02;
        drawIsoDenil(kosong, 960, 520, s, { yaw, pitch: ISO.pitch });
      }
      per = Math.min(per, (performance.now() - t0) / 20);
    }
    t.diagnostic(`${muka.length} muka: ${per.toFixed(2)} ms kerja JS per bingkai`);
    assert.ok(per < 4, `${per.toFixed(2)} ms`);
    assert.equal(mukaDenil(s, -1).muka, muka);
  });
});
