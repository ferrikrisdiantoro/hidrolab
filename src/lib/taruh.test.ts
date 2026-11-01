import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  KETUK_GESER,
  KETUK_LAMA,
  apakahKetuk,
  dalamBingkai,
  masihKetuk,
  penuh,
  taruhKlik,
  taruhNilai,
} from "./taruh.ts";
import type { ParamDef } from "./rentang.ts";
import type { PlateMap } from "./plateOut.ts";

/**
 * Uji logika klik-taruh. Titik baru harus berpijak dan berbatas sama dengan
 * penggeser posisinya, dan sentuhan yang menggulir tidak boleh menaruh titik.
 */

const PX: ParamDef = { min: 0, max: 10, step: 0.5, digits: 1 };
const PY: ParamDef = { min: 0, max: 4, step: 0.1, digits: 1 };
const P = [PX, PY] as const;

// Bidang 100..500 x 50..250 px; x 0..20 (lebih lebar dari rentang PX), y 0..4.
const MAP: PlateMap = {
  X: (v) => 100 + v * 20,
  Y: (v) => 250 - v * 50,
  invX: (px) => (px - 100) / 20,
  invY: (py) => (250 - py) / 50,
  frame: { x0: 100, y0: 50, x1: 500, y1: 250 },
};
const toValue = (px: number, py: number, m: PlateMap) => [m.invX(px), m.invY(py)] as const;

describe("pemisah ketuk dan gulir", () => {
  const sentuh = { x: 10, y: 10, t: 1000, jenis: "touch" };
  const tetikus = { x: 10, y: 10, t: 1000, jenis: "mouse" };

  it("ambang yang disepakati: 6 px dan 300 ms", () => {
    assert.equal(KETUK_GESER, 6);
    assert.equal(KETUK_LAMA, 300);
  });
  it("sentuh diam sebentar = ketuk", () => {
    assert.equal(apakahKetuk(sentuh, 12, 13, 1150), true);
  });
  it("geser tepat 6 px masih ketuk, lebih dari itu bukan", () => {
    assert.equal(apakahKetuk(sentuh, 16, 10, 1100), true);
    assert.equal(apakahKetuk(sentuh, 16.1, 10, 1100), false);
  });
  it("geser miring diukur sebagai jarak, bukan per sumbu", () => {
    // 5 px per sumbu = 7,07 px: gulir.
    assert.equal(apakahKetuk(sentuh, 15, 15, 1100), false);
  });
  it("sentuh lebih dari 300 ms = tekan lama, bukan ketuk", () => {
    assert.equal(apakahKetuk(sentuh, 10, 10, 1300), true);
    assert.equal(apakahKetuk(sentuh, 10, 10, 1301), false);
  });
  it("pena diperlakukan seperti sentuh", () => {
    assert.equal(apakahKetuk({ ...sentuh, jenis: "pen" }, 10, 10, 1400), false);
  });
  it("tetikus: klik lama tetap klik, seret lebih dari 6 px bukan", () => {
    assert.equal(apakahKetuk(tetikus, 11, 10, 3000), true);
    assert.equal(apakahKetuk(tetikus, 20, 10, 1050), false);
  });
  it("masihKetuk membuang calon ketuk begitu jari menggulir", () => {
    assert.equal(masihKetuk(sentuh, 10, 14, 1050), true);
    assert.equal(masihKetuk(sentuh, 10, 30, 1080), false);
  });
});

describe("dalamBingkai dan batas jumlah", () => {
  it("tepi bingkai termasuk, satu piksel di luar tidak", () => {
    const f = MAP.frame;
    assert.equal(dalamBingkai({ x: 100, y: 250 }, f), true);
    assert.equal(dalamBingkai({ x: 99, y: 100 }, f), false);
    assert.equal(dalamBingkai({ x: 300, y: 251 }, f), false);
  });
  it("tanpa max tidak pernah penuh; count = max sudah penuh", () => {
    assert.equal(penuh(999), false);
    assert.equal(penuh(2, 3), false);
    assert.equal(penuh(3, 3), true);
  });
});

describe("taruhKlik", () => {
  const o = { param: P, toValue, count: 0 };

  it("di dalam rentang: dibulatkan ke langkah penggeser, tidak dipotong", () => {
    // px 153 → x 2,65 → 2,5; py 140 → y 2,2.
    const h = taruhKlik({ x: 153, y: 140 }, MAP, o);
    assert.equal(h.jenis, "taruh");
    if (h.jenis !== "taruh") return;
    assert.deepEqual(h.value, [2.5, 2.2]);
    assert.equal(h.clamped, false);
  });
  it("di dalam bingkai tetapi lewat max rentang: dipotong dan ditandai", () => {
    // px 400 → x 15 > max 10.
    const h = taruhKlik({ x: 400, y: 150 }, MAP, o);
    assert.equal(h.jenis, "taruh");
    if (h.jenis !== "taruh") return;
    assert.deepEqual(h.value, [10, 2]);
    assert.equal(h.clamped, true);
  });
  it("di luar bingkai: diabaikan, toValue tidak dipanggil", () => {
    let dipanggil = 0;
    const h = taruhKlik({ x: 40, y: 140 }, MAP, {
      ...o,
      toValue: (px, py, m) => {
        dipanggil++;
        return toValue(px, py, m);
      },
    });
    assert.deepEqual(h, { jenis: "luar" });
    assert.equal(dipanggil, 0);
  });
  it("di luar bingkai tetap 'luar' walau jumlah penuh", () => {
    assert.deepEqual(taruhKlik({ x: 40, y: 140 }, MAP, { ...o, count: 5, max: 5 }), { jenis: "luar" });
  });
  it("jumlah sudah max: tidak ditaruh, max dilaporkan", () => {
    assert.deepEqual(taruhKlik({ x: 153, y: 140 }, MAP, { ...o, count: 4, max: 4 }), {
      jenis: "penuh",
      max: 4,
    });
  });
});

describe("taruhNilai (tombol Tambah)", () => {
  it("titik cadangan di-snap sama seperti klik", () => {
    assert.deepEqual(taruhNilai([3.26, 1.04], { param: P, count: 1, max: 3 }), {
      jenis: "taruh",
      value: [3.5, 1],
      clamped: false,
    });
  });
  it("titik cadangan di luar rentang dipotong dan ditandai", () => {
    assert.deepEqual(taruhNilai([12, -1], { param: P, count: 0 }), {
      jenis: "taruh",
      value: [10, 0],
      clamped: true,
    });
  });
  it("penuh: tidak ditaruh", () => {
    assert.deepEqual(taruhNilai([1, 1], { param: P, count: 3, max: 3 }), { jenis: "penuh", max: 3 });
  });
});
