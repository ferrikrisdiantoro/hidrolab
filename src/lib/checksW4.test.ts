import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  checksAcceleration,
  checksAdvection,
  checksCurvature,
  checksDeformation,
  checksDuct,
  checksFalknerSkan,
  checksFlowLines,
  checksHabitat,
  checksMeander,
  checksMomentum,
  checksReynoldsExp,
  checksShoal,
  checksVortexPair,
  checksVortexStreet,
  checksWave,
} from "./checks.ts";
import { evaluate, type Check } from "./verify.ts";

/**
 * Uji blok verifikasi pekan keempat.
 *
 * Aturannya sama sejak pekan pertama: blok verifikasi ikut bergerak saat
 * penggeser diubah, jadi seluruh pemeriksaan harus lolos di seluruh
 * rentangnya. Satu yang gagal pada satu posisi penggeser akan terlihat
 * klien di layarnya sendiri.
 */

function semuaLolos(checks: Check[], konteks: string) {
  for (const c of checks) {
    const r = evaluate(c);
    assert.ok(
      r.pass,
      `${konteks} | ${c.label.id}: acuan ${c.expected}, hitungan ${c.actual}, selisih ${r.pct.toFixed(4)}%`
    );
  }
}

const pipa = (D2: number, z2: number) => [
  { x: 0, z: 0, D: 0.3 },
  { x: 25, z: z2 / 2, D: (0.3 + D2) / 2 },
  { x: 50, z: z2, D: D2 },
];

/*
 * Pipa yang punya perlengkapan dan pompa.
 *
 * Disapu terpisah karena dua lembar memakainya begitu, dan karena
 * pemeriksaan yang hanya pernah melihat pipa telanjang sempat menuntut
 * tinggi energi hilir sama dengan hulu pada pipa yang punya katup.
 */
const pipaLengkap = (D2: number, z2: number, K: number, pompa: number) => [
  { x: 0, z: 0, D: 0.3, K: 0.5, pump: pompa },
  { x: 25, z: z2 / 2, D: (0.3 + D2) / 2, K },
  { x: 50, z: z2, D: D2, K: 0.3 },
];

const SEMUA: [string, Check[]][] = [
  ["FF-01/02/PI-07", checksDuct(0.2, pipa(0.3, 0), 25, 0.02)],
  ["FF-03/PI-05/06", checksMomentum(0.5, 0.4, 0.4, 60, 90)],
  ["FF-04", checksCurvature(3, 1, 5)],
  ["FF-05", checksFlowLines(2, 1, 1, 5)],
  ["FF-06", checksDeformation(0, 1, 0, 0)],
  ["FF-07", checksAcceleration(0.1, 0.3, 1, 0.2, 0.08, 0.5, 0.25, 0.4)],
  ["PI-04", checksReynoldsExp(0.0006, 0.05, 15, 0)],
  ["OC-11", checksMeander(30, 330, 70)],
  ["EH-05", checksShoal(40, 1, 1, 0.5)],
  ["EH-06", checksHabitat(5, 20, 0.002, 0.035)],
  ["FP-01", checksVortexStreet(10, 0.05, 1e-6, 0)],
  ["FP-02", checksVortexPair(10, -10, 2)],
  ["FP-03", checksWave(8, 20, 1)],
  ["FP-04", checksAdvection(50, 12, 0.4, 5, 800)],
  ["FP-05", checksFalknerSkan(0)],
];

describe("Blok verifikasi pekan keempat memenuhi aturan PRD", () => {
  it("tiap lembar punya minimal lima pemeriksaan", () => {
    for (const [nama, cs] of SEMUA)
      assert.ok(cs.length >= 5, `${nama} baru punya ${cs.length} pemeriksaan`);
  });

  it("tiap lembar punya minimal satu acuan di luar dirinya sendiri", () => {
    for (const [nama, cs] of SEMUA)
      assert.ok(
        cs.some(
          (c) =>
            c.kind === "terbitan" ||
            c.kind === "silang" ||
            c.kind === "pulang-pergi"
        ),
        `${nama} belum punya pemeriksaan terhadap sesuatu di luar dirinya`
      );
  });

  it("tiap pemeriksaan menyebut sumbernya", () => {
    for (const [nama, cs] of SEMUA)
      for (const c of cs)
        assert.ok(c.source.length > 8, `${nama}: sumber "${c.source}" terlalu pendek`);
  });

  it("tiap toleransi yang longgar menyebut alasannya", () => {
    for (const [nama, cs] of SEMUA)
      for (const c of cs)
        if (c.tol > 0.005 && c.tol < 1)
          assert.ok(
            c.tolReason,
            `${nama}: "${c.label.id}" bertoleransi ${c.tol} tanpa alasan`
          );
  });

  it("label kedua bahasanya benar-benar berbeda", () => {
    for (const [nama, cs] of SEMUA)
      for (const c of cs)
        assert.notEqual(
          c.label.id,
          c.label.en,
          `${nama}: "${c.label.id}" tidak diterjemahkan`
        );
  });

  it("FF-01, FF-02, PI-07 garis energi", () => {
    for (const Q of [0.02, 0.2, 0.8])
      for (const D2 of [0.1, 0.3, 0.8])
        for (const z2 of [-10, 0, 9])
          for (const f of [0, 0.015, 0.05])
            for (const H of [12, 25, 60])
              semuaLolos(
                checksDuct(Q, pipa(D2, z2), H, f),
                `Q=${Q} D2=${D2} z2=${z2} f=${f} H=${H}`
              );
  });

  it("FF-02, PI-07 garis energi dengan katup dan pompa", () => {
    for (const Q of [0.02, 0.2, 0.8])
      for (const D2 of [0.1, 0.3, 0.8])
        for (const z2 of [-10, 0, 9])
          for (const f of [0, 0.015, 0.05])
            for (const K of [0, 2, 30])
              for (const pompa of [0, 12, 60])
                semuaLolos(
                  checksDuct(Q, pipaLengkap(D2, z2, K, pompa), 25, f),
                  `Q=${Q} D2=${D2} z2=${z2} f=${f} K=${K} pompa=${pompa}`
                );
  });

  it("FF-03, PI-05, PI-06 gaya momentum", () => {
    for (const Q of [0.05, 0.5, 2])
      for (const D1 of [0.2, 0.5])
        for (const D2 of [0.1, 0.2, 0.5, 0.9])
          for (const head of [0, 30, 100])
            for (const sudut of [0, 30, 90, 135, 180])
              semuaLolos(
                checksMomentum(Q, D1, D2, head, sudut),
                `Q=${Q} D1=${D1} D2=${D2} h=${head} sudut=${sudut}`
              );
  });

  it("FF-04 anggapan hidrostatis", () => {
    for (const V of [0.2, 1, 3, 8])
      for (const d of [0.2, 1, 5])
        for (const R of [1, 5, 40, 1000, -2, -20])
          semuaLolos(checksCurvature(V, d, R), `V=${V} d=${d} R=${R}`);
  });

  it("FF-05 garis arus, jejak, lintasan", () => {
    for (const U of [0.5, 2, 6])
      for (const V of [0, 0.5, 2])
        for (const w of [0, 0.4, 2])
          for (const t of [1, 5, 12])
            semuaLolos(checksFlowLines(U, V, w, t), `U=${U} V=${V} w=${w} t=${t}`);
  });

  it("FF-06 deformasi", () => {
    for (const a of [-2, 0, 1.5])
      for (const b of [-3, 0, 2])
        for (const c of [-1, 0, 2.5])
          for (const d of [-1.5, 0, 2])
            semuaLolos(checksDeformation(a, b, c, d), `${a} ${b} ${c} ${d}`);
  });

  it("FF-07 percepatan", () => {
    for (const Q0 of [0.02, 0.1, 0.5])
      for (const swing of [0, 0.3, 0.8])
        for (const w of [0, 1, 5])
          for (const D2 of [0.05, 0.12, 0.2])
            for (const x of [0.05, 0.25, 0.45])
              for (const t of [0, 0.7])
                semuaLolos(
                  checksAcceleration(Q0, swing, w, 0.2, D2, 0.5, x, t),
                  `Q0=${Q0} s=${swing} w=${w} D2=${D2} x=${x} t=${t}`
                );
  });

  it("PI-04 percobaan Reynolds", () => {
    for (const Q of [0.00001, 0.0002, 0.002, 0.02])
      for (const D of [0.01, 0.05, 0.2])
        for (const T of [5, 20, 35])
          for (const q of [0, 0.5, 1])
            semuaLolos(
              checksReynoldsExp(Q, D, T, q),
              `Q=${Q} D=${D} T=${T} tenang=${q}`
            );
  });

  it("OC-11 meander", () => {
    for (const W of [2, 30, 300])
      for (const L of [50, 330, 2000])
        for (const sudut of [0, 20, 70, 110, 140])
          semuaLolos(checksMeander(W, L, sudut), `W=${W} L=${L} sudut=${sudut}`);
  });

  it("EH-05 gerombolan ikan", () => {
    for (const a of [0, 1, 2.5])
      for (const s of [0.2, 1, 3])
        for (const c of [0, 0.5, 1.5])
          semuaLolos(checksShoal(36, a, s, c), `a=${a} s=${s} c=${c}`);
  });

  it("EH-06 habitat sungai", () => {
    for (const Q of [0.2, 2, 12, 60])
      for (const W of [5, 20, 80])
        for (const S of [0.0005, 0.005])
          for (const n of [0.025, 0.06])
            semuaLolos(checksHabitat(Q, W, S, n), `Q=${Q} W=${W} S=${S} n=${n}`);
  });

  it("FP-01 deret vorteks", () => {
    for (const U of [0.02, 1, 10, 40])
      for (const d of [0.001, 0.02, 0.5])
        for (const nu of [1e-6, 1.5e-5])
          for (const alam of [0, 50, 2000])
            semuaLolos(
              checksVortexStreet(U, d, nu, alam),
              `U=${U} d=${d} nu=${nu} alam=${alam}`
            );
  });

  it("FP-02 kinematika vorteks", () => {
    for (const a of [2, 10, 40])
      for (const b of [-40, -10, -2, 2, 10, 40])
        for (const d of [0.5, 2, 6])
          semuaLolos(checksVortexPair(a, b, d), `a=${a} b=${b} d=${d}`);
  });

  it("FP-03 gelombang linear", () => {
    for (const T of [1.5, 6, 15, 60, 600])
      for (const h of [0.5, 5, 50, 500, 4000])
        for (const H of [0.2, 1, 4])
          semuaLolos(checksWave(T, h, H), `T=${T} h=${h} H=${H}`);
  });

  it("FP-04 adveksi difusi", () => {
    for (const M of [1, 50, 500])
      for (const A of [1, 12, 80])
        for (const U of [0.05, 0.4, 2])
          for (const D of [0.5, 5, 50])
            semuaLolos(
              checksAdvection(M, A, U, D, 800),
              `M=${M} A=${A} U=${U} D=${D}`
            );
  });

  it("FP-05 Falkner-Skan", () => {
    for (const beta of [-0.19, -0.1, 0, 0.3, 1, 1.8])
      semuaLolos(checksFalknerSkan(beta), `beta=${beta}`);
  });
});
