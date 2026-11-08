/*
 * Uji lembar pengamatan FM-03 tabung Pitot, mode traverse (Phase 3, P-B).
 * Logika tanpa React di src/data/praktikum/fm03.ts.
 *
 * Yang diuji:
 * - bacaan: dua tabung (tekanan total dan statik) dibaca terpisah dengan
 *   ALAT_MANOMETER lalu dikurangkan; u = √(2gΔh) per titik
 * - benih sama + urutan keadaan sama = bacaan sama
 * - integrasi kecepatan-luas pada penampang lingkaran: tepat untuk profil
 *   rata, dan mendekati Q model (hukum pangkat) untuk traverse wajar
 * - zona dinding m/(m+1) lebih dekat ke Q model daripada trapesium yang
 *   ditutup u = 0 di dinding
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { ALAT_MANOMETER, bacaAlat, buatRng } from "./praktikum.ts";
import { G, pitotHead, pitotVelocity, powerLawVelocity } from "./hydraulics.ts";
import {
  H_DATUM,
  M_DINDING,
  POSISI_BAKU,
  catatFm03,
  debitTraverse,
  qModelFm03,
  ringkasFm03,
  tolakFm03,
  type BacaanFm03,
} from "../data/praktikum/fm03.ts";

const awal = { dh0: 0.3, D: 0.2, n: 7, rR: 0 };

function traverse(rng: ReturnType<typeof buatRng>, s = awal, pos: readonly number[] = POSISI_BAKU): BacaanFm03[] {
  return pos.map((rR) => catatFm03({ ...s, rR }, rng));
}

describe("FM-03 catat bacaan", () => {
  it("benih sama memberi bacaan sama, benih lain berbeda", () => {
    const a = traverse(buatRng(11));
    const b = traverse(buatRng(11));
    const c = traverse(buatRng(12));
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, c);
  });

  it("tabung total dan statik dibaca terpisah, urutan tarikan ht lalu hs", () => {
    const s = { ...awal, rR: 0.6 };
    const r = catatFm03(s, buatRng(5));
    const ref = buatRng(5);
    const R = s.D / 2;
    const uBenar = powerLawVelocity(s.rR * R, R, pitotVelocity(s.dh0), s.n);
    const ht = bacaAlat(H_DATUM + pitotHead(uBenar), ALAT_MANOMETER, ref);
    const hs = bacaAlat(H_DATUM, ALAT_MANOMETER, ref);
    assert.equal(r.ht, ht);
    assert.equal(r.hs, hs);
    assert.equal(r.dh, Number((ht - hs).toFixed(3)));
    assert.equal(r.u, Math.sqrt(2 * G * r.dh));
    assert.equal(r.rR, 0.6);
    assert.equal(r.D, s.D);
  });

  it("Δh terbaca negatif memberi u = 0, bukan NaN", () => {
    // Δh benar sangat kecil: galat baca bisa membuatnya negatif
    const rng = buatRng(3);
    for (let i = 0; i < 200; i++) {
      const r = catatFm03({ dh0: 0.0005, D: 0.2, n: 7, rR: 0.9 }, rng);
      assert.ok(Number.isFinite(r.u) && r.u >= 0, `u ${r.u}`);
    }
  });

  it("menolak ujung tabung di luar 0,95 R (batas dekat dinding lembar)", () => {
    assert.equal(tolakFm03({ ...awal, rR: 0.95 }), null);
    assert.equal(tolakFm03({ ...awal, rR: -0.96 }), "dekat-dinding");
    assert.equal(tolakFm03({ ...awal, rR: 1 }), "dekat-dinding");
  });
});

describe("FM-03 integrasi kecepatan-luas", () => {
  it("profil rata sampai dinding (titik terakhir r = R): Q = u·πR² tepat", () => {
    // Profil rata sampai r = R (tanpa zona dinding): integrasi inti harus tepat
    const R = 0.1, u = 2;
    const titik = [0, 0.25, 0.5, 0.75, 1].map((rR) => ({ rR, u }));
    const q = debitTraverse(titik, R);
    assert.ok(Math.abs(q.Q / (u * Math.PI * R * R) - 1) < 1e-12, `Q ${q.Q}`);
  });

  it("profil linear u = 1 − s: trapesium atas r·u tepat pada titik rapat", () => {
    const R = 0.1;
    const s = Array.from({ length: 201 }, (_, i) => i / 200);
    const q = debitTraverse(s.map((v) => ({ rR: v, u: 1 - v })), R);
    // ∫0^R 2πr (1 − r/R) dr = πR²/3
    assert.ok(Math.abs(q.Q / ((Math.PI * R * R) / 3) - 1) < 1e-4, `Q ${q.Q}`);
  });

  it("dua sisi dirata-rata; sisi kiri dan kanan simetri memberi Q sama dengan satu sisi", () => {
    const R = 0.1, uMax = 2;
    const pos = [0, 0.2, 0.4, 0.6, 0.8, 0.9, 0.95];
    const kanan = pos.map((rR) => ({ rR, u: powerLawVelocity(rR * R, R, uMax, 7) }));
    const dua = [...kanan, ...pos.filter((p) => p > 0).map((p) => ({ rR: -p, u: powerLawVelocity(p * R, R, uMax, 7) }))];
    const q1 = debitTraverse(kanan, R);
    const q2 = debitTraverse(dua, R);
    assert.equal(q1.sisi, 1);
    assert.equal(q2.sisi, 2);
    assert.ok(Math.abs(q2.Q / q1.Q - 1) < 1e-12);
  });

  it("bacaan berulang di letak yang sama dirata-rata, bukan dihitung dua kali", () => {
    const R = 0.1;
    const a = debitTraverse([{ rR: 0, u: 2 }, { rR: 0.5, u: 1.8 }, { rR: 0.9, u: 1.4 }], R);
    const b = debitTraverse([{ rR: 0, u: 2 }, { rR: 0.5, u: 1.7 }, { rR: 0.5, u: 1.9 }, { rR: 0.9, u: 1.4 }], R);
    assert.ok(Math.abs(a.Q / b.Q - 1) < 1e-12);
  });

  it("tanpa bacaan: Q NaN", () => {
    assert.ok(Number.isNaN(debitTraverse([], 0.1).Q));
  });

  it("traverse baku tanpa galat: zona dinding m = 7 dalam 1 % dari Q model, tutup u = 0 meleset lebih jauh", () => {
    for (const n of [5, 7, 10]) {
      const s = { dh0: 0.3, D: 0.2, n, rR: 0 };
      const R = s.D / 2;
      const u0 = pitotVelocity(s.dh0);
      const titik = POSISI_BAKU.map((rR) => ({ rR, u: powerLawVelocity(rR * R, R, u0, n) }));
      const q = debitTraverse(titik, R, M_DINDING);
      const qm = qModelFm03(s);
      const galat = Math.abs(q.Q / qm - 1);
      const galatNol = Math.abs(q.Qnol / qm - 1);
      assert.ok(galat < 0.01, `n ${n}: zona dinding ${galat}`);
      assert.ok(galatNol > galat, `n ${n}: tutup nol ${galatNol} vs ${galat}`);
    }
  });

  it("traverse baku dengan galat baca: Q mendekati Q model (dalam 2 %) untuk beberapa benih", () => {
    for (const benih of [1, 2, 3, 42, 2026]) {
      const rows = traverse(buatRng(benih));
      const r = ringkasFm03(rows);
      assert.ok(Math.abs(r.Q / r.Qmodel - 1) < 0.02, `benih ${benih}: ${r.Q} vs ${r.Qmodel}`);
      assert.equal(r.nTitik, POSISI_BAKU.length);
      assert.equal(r.campur, false);
    }
  });
});

describe("FM-03 ringkasan", () => {
  it("Q model = u₀·V/u₀·πR² dari keadaan baris terakhir", () => {
    const s = { dh0: 0.3, D: 0.2, n: 7, rR: 0 };
    const u0 = Math.sqrt(2 * G * 0.3);
    const harap = u0 * (2 * 49 / (8 * 15)) * Math.PI * 0.01;
    assert.ok(Math.abs(qModelFm03(s) / harap - 1) < 1e-12);
  });

  it("keadaan aliran berubah di tengah seri ditandai campur", () => {
    const rng = buatRng(9);
    const rows = [catatFm03({ ...awal, rR: 0 }, rng), catatFm03({ ...awal, dh0: 0.4, rR: 0.5 }, rng)];
    assert.equal(ringkasFm03(rows).campur, true);
  });
});
