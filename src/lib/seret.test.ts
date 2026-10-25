import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { samaNilai, snapSeret, titikSeret, tombolKeNilai } from "./seret.ts";
import type { ParamDef } from "./rentang.ts";

/**
 * Uji logika pegangan seret. Pegangan harus berpijak dan berbatas persis
 * seperti penggeser InputRow (rentang.ts), karena keduanya mengubah nilai
 * yang sama.
 */

const H: ParamDef = { min: 0.1, max: 3, step: 0.05, digits: 2 };
// Min bukan kelipatan langkah (Falkner-Skan).
const FS: ParamDef = { min: -0.19884, max: 2, step: 0.002, digits: 3 };
const Q: ParamDef = { min: 0, max: 50, step: 1, digits: 0 };

describe("snapSeret: satu sumbu", () => {
  it("di dalam rentang: dibulatkan ke langkah, tidak dipotong", () => {
    assert.deepEqual(snapSeret(1.234, H), { value: 1.25, clamped: false });
  });
  it("lewat ujung atas: dipotong ke max dan ditandai", () => {
    assert.deepEqual(snapSeret(7, H), { value: 3, clamped: true });
  });
  it("lewat ujung bawah: dipotong ke min dan ditandai", () => {
    assert.deepEqual(snapSeret(-1, H), { value: 0.1, clamped: true });
  });
  it("min bukan kelipatan langkah: 0 tetap 0", () => {
    assert.deepEqual(snapSeret(0.0004, FS), { value: 0, clamped: false });
  });
  it("tepat di ujung tidak dihitung dipotong", () => {
    assert.deepEqual(snapSeret(3, H), { value: 3, clamped: false });
  });
});

describe("snapSeret: dua sumbu", () => {
  it("tiap sumbu memakai rentangnya sendiri", () => {
    assert.deepEqual(snapSeret([1.234, 12.6], [H, Q]), { value: [1.25, 13], clamped: false });
  });
  it("satu sumbu dipotong cukup untuk menyalakan tanda", () => {
    assert.deepEqual(snapSeret([1.234, 80], [H, Q]), { value: [1.25, 50], clamped: true });
  });
});

describe("tombolKeNilai: satu sumbu", () => {
  it("panah kanan dan atas = +1 langkah", () => {
    assert.equal(tombolKeNilai("ArrowRight", false, 1, H), 1.05);
    assert.equal(tombolKeNilai("ArrowUp", false, 1, H), 1.05);
  });
  it("panah kiri dan bawah = -1 langkah", () => {
    assert.equal(tombolKeNilai("ArrowLeft", false, 1, H), 0.95);
    assert.equal(tombolKeNilai("ArrowDown", false, 1, H), 0.95);
  });
  it("PageUp/PageDown = 10 langkah", () => {
    assert.equal(tombolKeNilai("PageUp", false, 1, H), 1.5);
    assert.equal(tombolKeNilai("PageDown", false, 1, H), 0.5);
  });
  it("Shift + panah = 10 langkah, sama dengan kotak angka", () => {
    assert.equal(tombolKeNilai("ArrowUp", true, 1, H), 1.5);
  });
  it("Home/End = min/max persis, walau bukan kelipatan langkah", () => {
    assert.equal(tombolKeNilai("Home", false, 1, FS), -0.19884);
    assert.equal(tombolKeNilai("End", false, 1, FS), 2);
  });
  it("berhenti di ujung rentang", () => {
    assert.equal(tombolKeNilai("PageUp", false, 2.9, H), 3);
    assert.equal(tombolKeNilai("ArrowLeft", false, 0.1, H), 0.1);
    assert.equal(tombolKeNilai("ArrowLeft", false, -0.19884, FS), -0.19884);
  });
  it("langkah dari min yang bukan kelipatan kembali ke pijakan dari nol", () => {
    assert.equal(tombolKeNilai("ArrowRight", false, -0.19884, FS), -0.196);
  });
  it("tanpa sisa biner", () => {
    assert.equal(tombolKeNilai("ArrowRight", false, 0.15, H), 0.2);
  });
  it("tombol lain tidak diambil", () => {
    assert.equal(tombolKeNilai("Tab", false, 1, H), null);
    assert.equal(tombolKeNilai("Enter", false, 1, H), null);
    assert.equal(tombolKeNilai("a", false, 1, H), null);
  });
});

describe("tombolKeNilai: dua sumbu", () => {
  const v = [1, 10] as const;
  it("kiri/kanan = sumbu 1", () => {
    assert.deepEqual(tombolKeNilai("ArrowRight", false, v, [H, Q]), [1.05, 10]);
    assert.deepEqual(tombolKeNilai("ArrowLeft", false, v, [H, Q]), [0.95, 10]);
  });
  it("atas/bawah = sumbu 2", () => {
    assert.deepEqual(tombolKeNilai("ArrowUp", false, v, [H, Q]), [1, 11]);
    assert.deepEqual(tombolKeNilai("ArrowDown", false, v, [H, Q]), [1, 9]);
  });
  it("Shift + panah = 10 langkah di sumbunya", () => {
    assert.deepEqual(tombolKeNilai("ArrowRight", true, v, [H, Q]), [1.5, 10]);
    assert.deepEqual(tombolKeNilai("ArrowDown", true, v, [H, Q]), [1, 0]);
  });
  it("PageUp/PageDown = 10 langkah sumbu 2", () => {
    assert.deepEqual(tombolKeNilai("PageUp", false, v, [H, Q]), [1, 20]);
    assert.deepEqual(tombolKeNilai("PageDown", false, [1, 4], [H, Q]), [1, 0]);
  });
  it("Home/End = min/max sumbu 1", () => {
    assert.deepEqual(tombolKeNilai("Home", false, v, [H, Q]), [0.1, 10]);
    assert.deepEqual(tombolKeNilai("End", false, v, [H, Q]), [3, 10]);
  });
  it("tombol lain tidak diambil", () => {
    assert.equal(tombolKeNilai("Escape", false, v, [H, Q]), null);
  });
});

describe("titikSeret", () => {
  const awal = { x: 100, y: 50 };
  const geser = { x: 3, y: -2 };
  it("sumbu x: y dikunci di posisi awal, selisih pegang dipertahankan", () => {
    assert.deepEqual(titikSeret({ x: 140, y: 90 }, geser, awal, "x"), { x: 143, y: 50 });
  });
  it("sumbu y: x dikunci", () => {
    assert.deepEqual(titikSeret({ x: 140, y: 90 }, geser, awal, "y"), { x: 100, y: 88 });
  });
  it("dua sumbu: keduanya ikut", () => {
    assert.deepEqual(titikSeret({ x: 140, y: 90 }, geser, awal, "xy"), { x: 143, y: 88 });
  });
});

describe("samaNilai", () => {
  it("angka dan pasangan", () => {
    assert.equal(samaNilai(1, 1), true);
    assert.equal(samaNilai(1, 1.05), false);
    assert.equal(samaNilai([1, 2], [1, 2]), true);
    assert.equal(samaNilai([1, 2], [1, 3]), false);
  });
});
