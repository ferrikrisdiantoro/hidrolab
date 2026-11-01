import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createJetMotion, jetAt, jetTransitTime } from "./jetMotion.ts";
import {
  CAR_HEIGHT,
  CULVERT_LANE0,
  CULVERT_LANE1,
  carBox,
  culvertTransitTime,
  fillCulvertPath,
} from "./culvertMotion.ts";
import { mapFrom } from "./plateOut.ts";
import { culvert } from "./hydraulics.ts";

describe("HS-04 lapis gerak: laju butir = V model pipa penuh", () => {
  // Tombol contoh "kendali keluar": Q 1,5, D 1, L 80, S 0,002, n 0,013, TW 0,9, Hj 2,5.
  const r = culvert(1.5, 1, 80, 0.002, 0.013, 0.9, 2.5);
  const s = { L: 80, S: 0.002, D: 1, V: r.velocity };

  it("tombol kendali keluar memang pipa penuh di bawah kendali keluar", () => {
    assert.equal(r.control, "keluar");
    assert.equal(r.flowsFull, true);
    assert.equal(r.overtops, false);
    assert.ok(Math.abs(r.velocity - 1.5 / ((Math.PI / 4) * 1 * 1)) < 1e-12);
  });

  it("laju di setiap titik dan lajur = V model; butir di dalam rongga pipa", () => {
    const m = createJetMotion(10, "vertical");
    m.vMax = fillCulvertPath(m.path, s);
    assert.ok(Math.abs(m.vMax - r.velocity) < 1e-12);
    const out = new Float64Array(6);
    const T = jetTransitTime(m.path);
    for (let k = 0; k <= 50; k++) {
      for (const eta of [0, 0.37, 1]) {
        jetAt(m.path, (T * k) / 50, eta, out);
        assert.ok(Math.abs(out[4] - r.velocity) < 1e-12, "laju");
        assert.ok(Math.abs(Math.hypot(out[2], out[3]) - r.velocity) < 1e-12, "|u,w|");
        const dasar = -s.S * out[0];
        assert.ok(out[0] >= -1e-12 && out[0] <= s.L + 1e-12, "x di pipa");
        assert.ok(out[1] >= dasar + CULVERT_LANE0 * s.D - 1e-9, "di atas dasar");
        assert.ok(out[1] <= dasar + CULVERT_LANE1 * s.D + 1e-9, "di bawah punggung");
      }
    }
  });

  it("waktu tempuh = L√(1+S²)/V, sama dengan tabel", () => {
    const m = createJetMotion(10, "vertical");
    fillCulvertPath(m.path, s);
    const Tref = (80 * Math.sqrt(1 + 0.002 * 0.002)) / r.velocity;
    assert.ok(Math.abs(jetTransitTime(m.path) - Tref) / Tref < 1e-12);
    assert.ok(Math.abs(culvertTransitTime(s) - Tref) / Tref < 1e-12);
  });

  it("tanpa debit: tanpa lintasan", () => {
    const m = createJetMotion(4, "vertical");
    assert.equal(fillCulvertPath(m.path, { ...s, V: 0 }), 0);
    assert.equal(m.path.n, 0);
    assert.equal(culvertTransitTime({ ...s, V: 0 }), 0);
  });
});

describe("HS-04 skala mobil", () => {
  // Bidang 1000 × 400 px, x −10..30 m, z −2..6 m (skala tegak dilebihkan).
  const X = (x: number) => 50 + ((x + 10) / 40) * 1000;
  const Y = (z: number) => 20 + ((6 - z) / 8) * 400;
  const map = mapFrom(X, Y, { x0: 50, y0: 20, x1: 1050, y1: 420 }, [-10, 30], [-2, 6]);

  it("tinggi = 1,5 m pada skala tegak, berdiri di permukaan jalan, di punggung jalan", () => {
    const b = carBox(map, 3.6, 16.4, 2.5, []);
    assert.ok(b);
    assert.ok(Math.abs(b.h - (CAR_HEIGHT / 8) * 400) < 1e-9);
    assert.ok(Math.abs(b.y + b.h - Y(2.5)) < 1e-9);
    assert.ok(b.x >= X(3.6) && b.x + b.w <= X(16.4));
  });

  it("menghindari tulisan yang sudah ditempatkan", () => {
    const bebas = carBox(map, 3.6, 16.4, 2.5, [])!;
    const tulisan = { x: bebas.x - 5, y: bebas.y + 10, w: 40, h: 12 };
    const b = carBox(map, 3.6, 16.4, 2.5, [tulisan]);
    assert.ok(b);
    assert.ok(b.x >= tulisan.x + tulisan.w, "bergeser ke kanan tulisan");
  });

  it("tampak belakang: lebar 1,2 × tinggi bila lapang, dipersempit sampai 0,7 × tinggi bila tidak", () => {
    const lapang = carBox(map, 3.6, 16.4, 2.5, [])!;
    assert.ok(Math.abs(lapang.w - 1.2 * lapang.h) < 1e-9);
    // Punggung 4 m = 100 px; tinggi mobil 75 px; muat 0,9 × 100 = 90 px.
    const sempit = carBox(map, 3.6, 7.6, 2.5, [])!;
    assert.ok(sempit, "masih digambar");
    assert.ok(Math.abs(sempit.w - 90) < 1e-9);
    assert.ok(sempit.x >= X(3.6) && sempit.x + sempit.w <= X(7.6) + 1e-9);
  });

  it("punggung jalan sempit di layar: tidak digambar", () => {
    assert.equal(carBox(map, 3.6, 4.0, 2.5, []), null);
  });
});
