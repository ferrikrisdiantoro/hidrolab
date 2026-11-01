import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { triangularInflow } from "./hydraulics.ts";
import {
  hidrografDariTitik,
  nilaiHidrograf,
  rapikanTitik,
  titikDariSegitiga,
  volumeHidrograf,
} from "./hidrografKendali.ts";

describe("rapikanTitik", () => {
  it("urutan indeks dijaga, jarak minimum ditegakkan, penanda hanya pada titik yang diubah", () => {
    const r = rapikanTitik(
      [
        { t: 0, Q: 0 },
        { t: 2, Q: 50 },
        { t: 1.95, Q: 120 }, // diseret melewati titik sebelumnya
        { t: 8, Q: -5 }, // Q negatif
        { t: 12, Q: 0 },
      ],
      0.25
    );
    assert.deepEqual(r.dibatasi, [false, false, true, true, false]);
    assert.equal(r.titik[2].t, 2.25);
    assert.equal(r.titik[2].Q, 120);
    assert.equal(r.titik[3].Q, 0);
    for (let i = 1; i < r.titik.length; i++) {
      assert.ok(r.titik[i].t - r.titik[i - 1].t >= 0.25 - 1e-12);
    }
  });

  it("batas t dan Q: titik akhir tidak terdorong keluar tMax", () => {
    const r = rapikanTitik(
      [
        { t: 0, Q: 0 },
        { t: 9.9, Q: 10 },
        { t: 10, Q: 500 },
      ],
      0.5,
      { tMin: 0, tMax: 10, QMax: 300 }
    );
    assert.equal(r.titik[1].t, 9.5);
    assert.equal(r.titik[2].t, 10);
    assert.equal(r.titik[2].Q, 300);
    assert.deepEqual(r.dibatasi, [false, true, true]);
  });

  it("masukan tidak diubah di tempat", () => {
    const p = [
      { t: 0, Q: 0 },
      { t: -1, Q: 1 },
    ];
    rapikanTitik(p, 0.1);
    assert.equal(p[1].t, -1);
  });
});

describe("hidrografDariTitik (Fritsch & Carlson 1980)", () => {
  const titik = [
    { t: 0, Q: 0 },
    { t: 2, Q: 15 },
    { t: 4, Q: 120 },
    { t: 5, Q: 118 },
    { t: 9, Q: 30 },
    { t: 16, Q: 0 },
  ];

  it("melewati semua titik kendali tepat dan mencatatnya di deret", () => {
    const d = hidrografDariTitik(titik, 0.37);
    for (const p of titik) {
      const ada = d.find((x) => Math.abs(x.t - p.t) < 1e-12);
      assert.ok(ada, `t=${p.t} tercatat`);
      assert.ok(Math.abs(ada!.Q - p.Q) < 1e-12);
    }
    assert.equal(d[0].t, 0);
    assert.equal(d[d.length - 1].t, 16);
    for (let i = 1; i < d.length; i++) assert.ok(d[i].t > d[i - 1].t);
  });

  it("monoton per ruas: tidak melampaui dan tidak turun di bawah kedua ujung ruas", () => {
    const d = hidrografDariTitik(titik, 0.01);
    for (let k = 0; k + 1 < titik.length; k++) {
      const lo = Math.min(titik[k].Q, titik[k + 1].Q);
      const hi = Math.max(titik[k].Q, titik[k + 1].Q);
      for (const p of d) {
        if (p.t < titik[k].t || p.t > titik[k + 1].t) continue;
        assert.ok(p.Q >= lo - 1e-9 && p.Q <= hi + 1e-9, `t=${p.t} Q=${p.Q} di luar [${lo},${hi}]`);
      }
    }
  });

  it("data lurus dihasilkan lurus", () => {
    const lurus = [
      { t: 0, Q: 10 },
      { t: 1, Q: 20 },
      { t: 3, Q: 40 },
    ];
    for (const tt of [0.3, 1.7, 2.9]) {
      assert.ok(Math.abs(nilaiHidrograf(lurus, tt) - (10 + 10 * tt)) < 1e-12);
    }
  });

  it("metode linear + titikDariSegitiga = triangularInflow", () => {
    const Ip = 120;
    const tp = 6;
    const ref = triangularInflow(Ip, tp);
    const p = titikDariSegitiga(Ip, tp);
    for (const r of ref) {
      assert.ok(Math.abs(nilaiHidrograf(p, r.t, "linear") - r.Q) < 1e-9, `t=${r.t}`);
    }
    // ujung akhir sama: 1,6 tb
    assert.ok(Math.abs(p[p.length - 1].t - ref[ref.length - 1].t) < 1e-12);
  });

  it("volumeHidrograf: segitiga Ip, tb memberi ½ Ip tb × 3600", () => {
    const d = hidrografDariTitik(titikDariSegitiga(100, 3), 0.01, "linear");
    const harapan = 0.5 * 100 * 2.67 * 3 * 3600;
    assert.ok(Math.abs(volumeHidrograf(d) - harapan) / harapan < 1e-9);
  });

  it("nilai di luar rentang titik = nilai ujung terdekat", () => {
    assert.equal(nilaiHidrograf(titik, -3), 0);
    assert.equal(nilaiHidrograf(titik, 99), 0);
  });
});
