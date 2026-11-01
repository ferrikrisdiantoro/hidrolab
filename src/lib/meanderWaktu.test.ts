/*
 * Uji M6 meanderWaktu.ts: migrasi meander terhadap waktu untuk OC-11.
 *
 * Acuan yang dibuka:
 * - Langbein, W.B. & Leopold, L.B. (1966). River meanders, theory of minimum
 *   variance. USGS PP 422-H (pubs.usgs.gov/pp/0422h/report.pdf), hlm. H5:
 *   φ = ω sin(2π s/M) (pers. 10); k = kebalikan rata-rata cos φ; tabel ω-k
 *   hasil hitung 24 titik (catatan 1); M = kλ; ω paling besar 125° untuk
 *   meander "gooseneck" pada titik mulai bersilang.
 * - Hickin, E.J. & Nanson, G.C. (1984). Lateral migration rates of river
 *   bends. J. Hydraul. Eng. 110(11), 1557-1567. HANYA abstrak yang terbaca
 *   (lewat cuplikan mesin pencari; ascelibrary 403): laju pindah dirujuk ke
 *   kelengkungan acuan r/w = 2,5. Persamaan lengkapnya TIDAK dibuka; laju
 *   pindah diambil dari meanderPath() yang sudah dipakai OC-11.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  centrelineCrossingDeg,
  cutoffAngleDeg,
  meanderFrameAt,
  meanderFramePath,
  meanderGeometry,
  meanderOxbow,
  meanderTimeline,
  sinuosityFromAngle,
} from "./meanderWaktu.ts";
import { meanderPath } from "./hydraulics.ts";

const dekat = (a: number, b: number, tol: number, pesan?: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${pesan ?? ""} ${a} vs ${b} (tol ${tol})`);

describe("meanderWaktu: geometri kurva sinus Langbein & Leopold (1966)", () => {
  it("sinusitas 1/rata-rata cos φ sama dengan sinusitas lintasan meanderPath", () => {
    for (const deg of [20, 40, 70, 100]) {
      const ref = meanderPath(30, 330, deg);
      dekat(sinuosityFromAngle(deg), ref.sinuosity, 2e-4 * ref.sinuosity, `ω ${deg}°`);
    }
  });

  it("cocok dengan tabel ω-k yang dihitung LL (hlm. H5 catatan 1, 24 titik) dalam 2 %", () => {
    /* ω (rad) → k: 0,5 → 1,06; 1,0 → 1,30; 1,75 → 2,67. Baris ω = 1,5 tidak
       terbaca jelas pada pindaian, jadi tidak dipakai. */
    for (const [w, k] of [
      [0.5, 1.06],
      [1.0, 1.3],
      [1.75, 2.67],
    ]) {
      dekat(sinuosityFromAngle((w * 180) / Math.PI), k, 0.02 * k, `ω ${w}`);
    }
  });

  it("garis tengah mulai bersilang dekat 125° (LL hlm. H5); hitungan tepat 120,9°", () => {
    const w = centrelineCrossingDeg();
    assert.ok(w > 115 && w < 126, `${w}`);
    dekat(w, 120.93, 0.05);
  });

  it("amplitudo dan panjang lintasan cocok dengan lintasan meanderPath", () => {
    const W = 30;
    const deg = 60;
    const M = 330;
    const ref = meanderPath(W, M, deg, 2, 4000);
    const ys = ref.path.map((p) => p.y);
    const A = (Math.max(...ys) - Math.min(...ys)) / 2;
    const lembah = M / sinuosityFromAngle(deg);
    const g = meanderGeometry(W, lembah, deg);
    dekat(g.pathWavelength, M, 1e-9 * M);
    dekat(g.amplitude, A, 1e-3 * A);
    /* di bawah 90° belum ada leher */
    assert.equal(g.neckGap, Infinity);
  });

  it("leher makin sempit dengan sudut; sungai lebar terpotong pada sudut lebih kecil", () => {
    const lembah = 200;
    const a = meanderGeometry(10, lembah, 105).neckGap;
    const b = meanderGeometry(10, lembah, 115).neckGap;
    assert.ok(a > b && b > 0);
    assert.ok(cutoffAngleDeg(40, lembah) < cutoffAngleDeg(10, lembah));
    assert.ok(cutoffAngleDeg(10, lembah) < centrelineCrossingDeg());
    /* tepat pada sudut potong celah garis tengah = satu lebar (tebing bertemu) */
    dekat(meanderGeometry(10, lembah, cutoffAngleDeg(10, lembah)).neckGap, 10, 1e-6);
  });
});

describe("meanderWaktu: lini masa", () => {
  const W = 30;
  const L = 330;
  const w0 = 40;
  const tl = meanderTimeline(W, L, w0);

  it("bingkai pertama sama dengan meanderPath yang dipakai OC-11 sekarang", () => {
    const ref = meanderPath(W, L, w0);
    const f = tl.frames[0];
    assert.equal(f.t, 0);
    dekat(f.omegaDeg, w0, 1e-12);
    dekat(f.migrationRate, ref.migrationRate, 1e-12);
    dekat(f.radiusRatio, ref.radiusRatio, 1e-9);
    dekat(f.pathWavelength, L, 1e-9);
    dekat(f.bankRate, ref.migrationRate * W, 1e-10);
  });

  it("waktu dan sudut naik monoton; panjang gelombang lembah tetap", () => {
    for (let i = 1; i < tl.frames.length; i++) {
      assert.ok(tl.frames[i].t > tl.frames[i - 1].t);
      assert.ok(tl.frames[i].omegaDeg > tl.frames[i - 1].omegaDeg);
      dekat(tl.frames[i].valleyWavelength, tl.valleyWavelength, 1e-9);
    }
  });

  it("puncak kelokan bergeser keluar dengan laju tebing: dA/dt = ṁ·W", () => {
    for (const i of [3, 40, 120]) {
      const a = tl.frames[i];
      const b = tl.frames[i + 1];
      const dAdt = (b.amplitude - a.amplitude) / (b.t - a.t);
      const rata = 0.5 * (a.bankRate + b.bankRate);
      dekat(dAdt, rata, 2e-3 * rata, `bingkai ${i}`);
    }
  });

  it("berakhir pada pemotongan leher: celah leher = lebar, waktu hingga", () => {
    const akhir = tl.frames[tl.frames.length - 1];
    assert.equal(tl.cutoffs.length, 1);
    assert.ok(Number.isFinite(tl.timeToCutoff) && tl.timeToCutoff > 0);
    dekat(akhir.t, tl.timeToCutoff, 1e-9 * tl.timeToCutoff);
    dekat(akhir.neckGap, W, 1e-6 * W);
    dekat(akhir.omegaDeg, tl.cutoffOmegaDeg, 1e-9);
    assert.equal(tl.cutoffAtStart, false);
  });

  it("meanderFrameAt menyisip di antara bingkai dan menjepit di ujung", () => {
    const i = 50;
    const a = tl.frames[i];
    const b = tl.frames[i + 1];
    const m = meanderFrameAt(tl, 0.5 * (a.t + b.t));
    assert.ok(m.omegaDeg > a.omegaDeg && m.omegaDeg < b.omegaDeg);
    assert.equal(meanderFrameAt(tl, -5).omegaDeg, tl.frames[0].omegaDeg);
    assert.equal(meanderFrameAt(tl, 1e12).omegaDeg, tl.cutoffOmegaDeg);
  });

  it("sudut awal di atas sudut potong: terpotong sejak awal, tanpa pertumbuhan", () => {
    const t2 = meanderTimeline(W, L, 130);
    assert.equal(t2.cutoffAtStart, true);
    assert.equal(t2.frames.length, 1);
    assert.equal(t2.timeToCutoff, 0);
  });

  it("batas tahun memotong lini masa sebelum pemotongan", () => {
    const t3 = meanderTimeline(W, L, w0, { years: tl.timeToCutoff / 2 });
    assert.equal(t3.cutoffs.length, 0);
    dekat(t3.frames[t3.frames.length - 1].t, tl.timeToCutoff / 2, 1e-9 * tl.timeToCutoff);
  });

  it("beberapa daur: sesudah terpotong alur kembali ke sudut awal (konvensi tampilan)", () => {
    const t4 = meanderTimeline(W, L, w0, { cutoffs: 2 });
    assert.equal(t4.cutoffs.length, 2);
    dekat(t4.cutoffs[1].t, 2 * tl.timeToCutoff, 1e-9 * tl.timeToCutoff);
    const awalDaur2 = t4.frames.find((f) => f.cycle === 1)!;
    dekat(awalDaur2.omegaDeg, w0, 1e-12);
  });
});

describe("meanderWaktu: lintasan gambar dan oxbow", () => {
  const W = 30;
  const tl = meanderTimeline(W, 330, 40);
  const akhir = tl.frames[tl.frames.length - 1];

  it("lintasan dipusatkan: rata-rata y ≈ 0, bentang x = daur × panjang gelombang lembah", () => {
    const p = meanderFramePath(tl.frames[60], 2, 800);
    const ys = p.map((q) => q.y);
    dekat((Math.max(...ys) + Math.min(...ys)) / 2, 0, 1e-6 * tl.frames[60].amplitude);
    dekat(p[p.length - 1].x - p[0].x, 2 * tl.valleyWavelength, 1e-3 * tl.valleyWavelength);
  });

  it("ujung oxbow berjarak celah leher (satu lebar saat terpotong)", () => {
    const o = meanderOxbow(akhir, 400);
    const a = o[0];
    const b = o[o.length - 1];
    dekat(Math.hypot(b.x - a.x, b.y - a.y), akhir.neckGap, 2e-3 * W);
    /* oxbow menonjol ke atas dari lehernya */
    assert.ok(Math.max(...o.map((q) => q.y)) > a.y);
  });
});
