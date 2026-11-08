/*
 * Uji titikPenampang.ts (HY-03): titik penampang alam yang diseret, ditaruh,
 * dan dikeluarkan di gambar menulis ke baris DataEntry yang sama (satu
 * sumber nilai), dan titik baru disisipkan menurut urutan x.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  bacaBaris,
  keluarkanTitik,
  langkahRapi,
  pindahTitik,
  sisipTitik,
  type Baris,
} from "./titikPenampang.ts";
import { sectionFlow, SAMPLE_SECTION } from "./discharge.ts";

const dariPts = (pts: { x: number; y: number }[]): Baris[] =>
  pts.map((p) => ({ x: String(p.x), y: String(p.y), on: true }));

/* Tabel dengan baris kosong, baris tidak dicentang, dan baris rusak di
   tengah: indeks titik ≠ indeks baris. */
const campur: Baris[] = [
  { x: "0", y: "2", on: true },
  { x: "", y: "" },
  { x: "2", y: "1", on: false },
  { x: "4", y: "0,5", on: true },
  { x: "abc", y: "1", on: true },
  { x: "6", y: "0", on: true },
  { x: "8", y: "2", on: true },
];

describe("bacaBaris", () => {
  it("sama dengan aturan ptsFromRows: koma desimal, kosong dilewati, tak dicentang dan rusak dihitung", () => {
    const r = bacaBaris(campur);
    assert.deepEqual(r.pts, [
      { x: 0, y: 2 },
      { x: 4, y: 0.5 },
      { x: 6, y: 0 },
      { x: 8, y: 2 },
    ]);
    assert.deepEqual(r.idx, [0, 3, 5, 6]);
    assert.equal(r.off, 1);
    assert.equal(r.bad, 1);
  });
});

describe("pindahTitik: satu sumber", () => {
  it("menulis ke baris yang benar dan baris lain tidak berubah", () => {
    const baru = pindahTitik(campur, 1, [4.5, 0.25]);
    assert.deepEqual(baru[3], { x: "4.5", y: "0.25", on: true });
    for (const i of [0, 1, 2, 4, 5, 6]) assert.equal(baru[i], campur[i]);
    assert.deepEqual(bacaBaris(baru).pts[1], { x: 4.5, y: 0.25 });
    // tabel asal tidak diubah di tempat
    assert.equal(campur[3].x, "4");
  });

  it("tanpa sisa biner pada teks baris", () => {
    const baru = pindahTitik(campur, 0, [0.1 + 0.2, 1.1 * 3]);
    assert.equal(baru[0].x, "0.3");
    assert.equal(baru[0].y, "3.3");
  });

  it("hasil hitungan model dari baris sama dengan dari titik yang diseret", () => {
    const rows = dariPts(SAMPLE_SECTION);
    const baru = pindahTitik(rows, 4, [8, -0.3]);
    const pts = SAMPLE_SECTION.map((p, i) => (i === 4 ? { x: 8, y: -0.3 } : p));
    const a = sectionFlow({ shape: "alam", pts: bacaBaris(baru).pts }, 1.2, 0.0005, { method: "manning", n: 0.035 });
    const b = sectionFlow({ shape: "alam", pts }, 1.2, 0.0005, { method: "manning", n: 0.035 });
    assert.equal(a.discharge, b.discharge);
  });
});

describe("sisipTitik: urutan x", () => {
  it("disisipkan sebelum titik pertama yang x-nya lebih besar", () => {
    const { rows, titik } = sisipTitik(campur, [5, 0.2]);
    assert.equal(titik, 2);
    assert.deepEqual(bacaBaris(rows).pts.map((p) => p.x), [0, 4, 5, 6, 8]);
    // tepat sebelum baris titik x = 6 (baris 5), jadi baris rusak tetap di tempatnya
    assert.deepEqual(rows[5], { x: "5", y: "0.2", on: true });
    assert.equal(rows.length, campur.length + 1);
  });

  it("di ujung kiri dan kanan", () => {
    const kiri = sisipTitik(campur, [-1, 3]);
    assert.equal(kiri.titik, 0);
    assert.deepEqual(bacaBaris(kiri.rows).pts[0], { x: -1, y: 3 });
    const kanan = sisipTitik(campur, [9, 3]);
    assert.equal(kanan.titik, 4);
    assert.deepEqual(bacaBaris(kanan.rows).pts.at(-1), { x: 9, y: 3 });
  });

  it("x sama dengan titik yang ada: sesudahnya (dinding tegak tetap berurut)", () => {
    const { rows, titik } = sisipTitik(campur, [4, 1]);
    assert.equal(titik, 2);
    const xs = bacaBaris(rows).pts.map((p) => p.x);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] >= xs[i - 1]);
  });

  it("penampang berurut tetap berurut sesudah banyak sisipan", () => {
    let rows = dariPts(SAMPLE_SECTION);
    for (const x of [7, 1, 15.5, 3.3, 0, 16, 8]) rows = sisipTitik(rows, [x, 1]).rows;
    const r = sectionFlow({ shape: "alam", pts: bacaBaris(rows).pts }, 1, 0.001, { method: "manning", n: 0.03 });
    assert.equal(r.unordered, false);
  });
});

describe("keluarkanTitik", () => {
  it("baris tidak dihapus, hanya tidak dicentang (permintaan Rev1 cl42)", () => {
    const baru = keluarkanTitik(campur, 2);
    assert.equal(baru.length, campur.length);
    assert.deepEqual(baru[5], { x: "6", y: "0", on: false });
    assert.deepEqual(bacaBaris(baru).pts.map((p) => p.x), [0, 4, 8]);
  });
});

describe("langkahRapi", () => {
  it("1, 2, 5 kali pangkat sepuluh", () => {
    assert.equal(langkahRapi(16), 0.05);
    assert.equal(langkahRapi(4), 0.01);
    assert.equal(langkahRapi(200), 0.5);
    assert.equal(langkahRapi(1000), 2);
  });
});
