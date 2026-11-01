import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  LANGKAH,
  PER_PIKSEL,
  PITCH_MAX,
  PITCH_MIN,
  bungkusYaw,
  derajat,
  jepitPitch,
  putarPandangan,
  samaPandangan,
  seretPandangan,
  tombolPanah,
} from "./pandangan.ts";
import { ISO } from "./proyeksi.ts";

/* D1 Phase 3: arah pandang gambar 3D, bagian murni usePandangan. */

const DEG = Math.PI / 180;
const awal = { yaw: -ISO.yaw, pitch: ISO.pitch };

describe("Arah pandang 3D", () => {
  it("pitch dijepit 10°..80°, termasuk NaN", () => {
    assert.equal(jepitPitch(0), PITCH_MIN);
    assert.equal(jepitPitch(Math.PI / 2), PITCH_MAX);
    assert.equal(jepitPitch(40 * DEG), 40 * DEG);
    assert.equal(jepitPitch(NaN), PITCH_MIN);
    assert.ok(Math.abs(PITCH_MIN - 10 * DEG) < 1e-12 && Math.abs(PITCH_MAX - 80 * DEG) < 1e-12);
  });

  it("yaw dibungkus ke (−180°, 180°]", () => {
    assert.ok(Math.abs(bungkusYaw(190 * DEG) - -170 * DEG) < 1e-12);
    assert.ok(Math.abs(bungkusYaw(-190 * DEG) - 170 * DEG) < 1e-12);
    assert.ok(Math.abs(bungkusYaw(Math.PI) - Math.PI) < 1e-12);
    assert.ok(Math.abs(bungkusYaw(-Math.PI) - Math.PI) < 1e-12);
    assert.ok(Math.abs(bungkusYaw(4 * Math.PI + 0.1) - 0.1) < 1e-12);
  });

  it("24 tekan panah kiri kembali ke yaw semula (tanpa galat menumpuk)", () => {
    let p = awal;
    for (let i = 0; i < 24; i++) p = putarPandangan(p, LANGKAH, 0);
    assert.ok(samaPandangan(p, awal));
    assert.ok(Math.abs(bungkusYaw(p.yaw - awal.yaw)) < 1e-9);
  });

  it("seret: kanan memutar benda ke kanan (yaw turun), bawah mengangkat pengamat", () => {
    const p = seretPandangan(awal, 20, 0);
    assert.ok(Math.abs(p.yaw - (awal.yaw - 20 * PER_PIKSEL)) < 1e-12);
    assert.equal(p.pitch, awal.pitch);
    const q = seretPandangan(awal, 0, 30);
    assert.ok(Math.abs(q.pitch - (awal.pitch + 30 * PER_PIKSEL)) < 1e-12);
    // seret jauh ke bawah berhenti di batas atas
    assert.equal(seretPandangan(awal, 0, 5000).pitch, PITCH_MAX);
  });

  it("tombol panah papan ketik searah dengan seret dan tombol layar", () => {
    assert.deepEqual(tombolPanah("ArrowLeft"), { dyaw: LANGKAH, dpitch: 0 });
    assert.deepEqual(tombolPanah("ArrowRight"), { dyaw: -LANGKAH, dpitch: 0 });
    assert.deepEqual(tombolPanah("ArrowUp"), { dyaw: 0, dpitch: LANGKAH });
    assert.deepEqual(tombolPanah("ArrowDown", true), { dyaw: 0, dpitch: -3 * LANGKAH });
    assert.equal(tombolPanah("Enter"), null);
  });

  it("derajat tampil bulat dan tidak pernah −0", () => {
    assert.equal(derajat(-ISO.yaw), -45);
    assert.equal(derajat(ISO.pitch), 35);
    assert.ok(Object.is(derajat(-0.001 * DEG), 0));
  });
});
