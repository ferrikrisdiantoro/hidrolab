/*
 * Uji lembar pengamatan FM-01 ambang V (Phase 3, P-A): pencatatan bacaan dari
 * keadaan lembar, ringkasan, dan baris ekspor. Logika tanpa React di
 * src/data/praktikum/fm01.ts; komponen Praktikum.tsx hanya menampilkan.
 *
 * Yang diuji:
 * - H dibaca dengan ALAT_PENGUKUR_TITIK (kelipatan 0,1 mm), Q dengan
 *   ALAT_DEBIT_VOLUMETRIK, nilai benar dari notchDischarge(H, θ)
 * - nol datum bergeser tetap per deret benih (galat sistematik usulan)
 * - Cd hasil mendekati Ce model lembar, m kalibrasi pangkat ≈ 2,5
 * - benih sama + urutan keadaan sama = bacaan sama
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ALAT_DEBIT_VOLUMETRIK,
  ALAT_PENGUKUR_TITIK,
  bacaAlat,
  barisEkspor,
  buatRng,
  kalibrasiAmbangV,
  kalibrasiCd,
  normalBaku,
  qTeoriAmbangV,
} from "./praktikum.ts";
import { NOTCH_H_MIN, notchCe, notchDischarge } from "./hydraulics.ts";
import {
  KOLOM_EKSPOR_FM01,
  KOLOM_FM01,
  SIGMA_NOL,
  SKALA_PENGUKUR,
  catatFm01,
  offsetNol,
  ringkasFm01,
  sudutCampur,
  volumeTampungMin,
  type BacaanFm01,
} from "../data/praktikum/fm01.ts";

const awal = { H: 0.2, theta: 90 };
const seri = [0.06, 0.08, 0.1, 0.12, 0.14];

describe("FM-01 catat bacaan", () => {
  it("benih sama memberi bacaan sama, benih lain berbeda", () => {
    const a = buatRng(42), b = buatRng(42), c = buatRng(43);
    const ra = seri.map((H) => catatFm01({ ...awal, H }, a));
    const rb = seri.map((H) => catatFm01({ ...awal, H }, b));
    const rc = seri.map((H) => catatFm01({ ...awal, H }, c));
    assert.deepEqual(ra, rb);
    assert.notDeepEqual(ra, rc);
  });

  it("urutan tarikan: nol datum sekali per deret, lalu H, lalu Q", () => {
    const rng = buatRng(7);
    const r1 = catatFm01(awal, rng);
    const r2 = catatFm01({ ...awal, H: 0.1 }, rng);
    const ref = buatRng(7);
    const nol = SIGMA_NOL * normalBaku(ref);
    const H1 = bacaAlat(awal.H + nol, ALAT_PENGUKUR_TITIK, ref);
    const Q1 = bacaAlat(notchDischarge(awal.H, 90).Q, ALAT_DEBIT_VOLUMETRIK, ref);
    const H2 = bacaAlat(0.1 + nol, ALAT_PENGUKUR_TITIK, ref);
    const Q2 = bacaAlat(notchDischarge(0.1, 90).Q, ALAT_DEBIT_VOLUMETRIK, ref);
    assert.deepEqual(r1, { theta: 90, H: H1, Q: Q1 });
    assert.deepEqual(r2, { theta: 90, H: H2, Q: Q2 });
    assert.equal(offsetNol(rng), nol);
  });

  it("nol datum tetap dalam satu deret, berbeda antarbenih, sebaran ≈ σ 0,2 mm", () => {
    const rng = buatRng(3);
    const o = offsetNol(rng);
    catatFm01(awal, rng);
    assert.equal(offsetNol(rng), o);
    const os: number[] = [];
    for (let b = 1; b <= 3000; b++) os.push(offsetNol(buatRng(b)));
    const m = os.reduce((s, v) => s + v, 0) / os.length;
    const sd = Math.sqrt(os.reduce((s, v) => s + (v - m) ** 2, 0) / (os.length - 1));
    assert.equal(SIGMA_NOL, 0.0002);
    assert.ok(Math.abs(m) < 0.00002, `rerata ${m}`);
    assert.ok(Math.abs(sd / SIGMA_NOL - 1) < 0.06, `sd ${sd}`);
  });

  it("bacaan H jatuh di kisi 0,1 mm, Q di kisi 0,001 L/dtk", () => {
    const rng = buatRng(2026);
    for (let i = 0; i < 2000; i++) {
      const r = catatFm01({ H: 0.05 + (i % 30) * 0.01, theta: 20 + (i % 81) }, rng);
      assert.equal(Math.round(r.H * 1e4), Number((r.H * 1e4).toFixed(9)), `H ${r.H}`);
      assert.equal(Math.round(r.Q * 1e6), Number((r.Q * 1e6).toFixed(9)), `Q ${r.Q}`);
    }
  });

  it("Cd hasil mendekati Ce model lembar (90° dan 60°)", () => {
    for (const theta of [90, 60]) {
      // Banyak benih, supaya galat nol datum (sistematik per benih) ikut rata.
      const cds: number[] = [];
      for (let b = 1; b <= 60; b++) {
        const rng = buatRng(b);
        const rows = seri.map((H) => catatFm01({ H, theta }, rng));
        cds.push(ringkasFm01(rows).kal.cd);
      }
      const m = cds.reduce((s, v) => s + v, 0) / cds.length;
      assert.ok(Math.abs(m / notchCe(theta) - 1) < 0.004, `θ ${theta}: ${m} vs ${notchCe(theta)}`);
      // Satu seri lima bacaan pun dekat (galat 1 % debit + nol datum)
      assert.ok(cds.every((c) => Math.abs(c / notchCe(theta) - 1) < 0.03), `θ ${theta}`);
    }
  });

  it("kalibrasi pangkat Q = K·H^m memberi m ≈ 2,5", () => {
    const rng = buatRng(11);
    const rows = [0.05, 0.08, 0.11, 0.14, 0.18, 0.22, 0.26, 0.3].map((H) => catatFm01({ H, theta: 90 }, rng));
    const s = ringkasFm01(rows);
    assert.ok(Math.abs(s.pangkat.m - 2.5) < 0.05, `m ${s.pangkat.m}`);
    assert.ok(s.pangkat.r2 > 0.999, `r² ${s.pangkat.r2}`);
    assert.equal(s.pangkat.n, 8);
  });
});

describe("FM-01 ringkasan", () => {
  it("satu sudut memakai kalibrasiAmbangV", () => {
    const rng = buatRng(5);
    const rows = seri.map((H) => catatFm01({ ...awal, H }, rng));
    const s = ringkasFm01(rows);
    assert.deepEqual(s.kal, kalibrasiAmbangV(rows.map((r) => ({ H: r.H, Q: r.Q })), 90));
    assert.equal(s.campur, false);
    assert.equal(s.kal.n, 5);
    assert.ok(Number.isFinite(s.kal.seCd));
    assert.equal(s.ce, notchCe(90));
  });

  it("sudut berganti dalam satu seri ditandai; Q teori per baris, tanpa pangkat", () => {
    const rng = buatRng(5);
    const rows = [catatFm01(awal, rng), catatFm01({ ...awal, theta: 60 }, rng), catatFm01({ H: 0.1, theta: 60 }, rng)];
    assert.equal(sudutCampur(rows), true);
    const s = ringkasFm01(rows);
    assert.deepEqual(s.kal, kalibrasiCd(rows.map((r) => ({ qUkur: r.Q, qTeori: qTeoriAmbangV(r.H, r.theta) }))));
    assert.equal(s.campur, true);
    assert.ok(Number.isNaN(s.pangkat.m));
    assert.ok(Number.isNaN(s.ce));
  });

  it("kosong dan satu baris tidak melempar; simpangan NaN", () => {
    assert.equal(ringkasFm01([]).kal.n, 0);
    const s = ringkasFm01([catatFm01(awal, buatRng(1))]);
    assert.equal(s.kal.n, 1);
    assert.ok(Number.isNaN(s.kal.cdSd));
    assert.ok(Number.isNaN(s.pangkat.m));
  });

  it("H di bawah batas rumus dan di atas skala pengukur titik ditandai, tidak dipotong", () => {
    const rng = buatRng(3);
    const rendah = catatFm01({ H: 0.02, theta: 90 }, rng);
    const tinggi = catatFm01({ H: 0.3, theta: 90 }, rng);
    const biasa = catatFm01({ H: 0.1, theta: 90 }, rng);
    assert.ok(rendah.H < NOTCH_H_MIN && rendah.H > 0.019);
    assert.ok(tinggi.H > SKALA_PENGUKUR && tinggi.H > 0.299);
    const s = ringkasFm01([rendah, tinggi, biasa]);
    assert.equal(s.rendah, 1);
    assert.equal(s.luarSkala, 1);
    assert.equal(s.kal.n, 3);
  });
});

describe("FM-01 volume tampung", () => {
  it("paling sedikit 10 L dan paling sedikit Q·30 s", () => {
    assert.equal(volumeTampungMin(0.0001), 10);
    assert.ok(Math.abs(volumeTampungMin(0.002) - 60) < 1e-9);
  });
});

describe("FM-01 kolom dan ekspor", () => {
  it("kolom layar: H dalam mm, Q dalam L/s, Cd = Q ukur / Q teori", () => {
    const r = catatFm01(awal, buatRng(9));
    const nilai = Object.fromEntries(KOLOM_FM01.map((k) => [k.key, k.hitung ? k.hitung(r) : (r as Record<string, unknown>)[k.key]]));
    assert.equal(nilai.H, r.H * 1000);
    assert.equal(nilai.Q, r.Q * 1000);
    assert.ok(Math.abs((nilai.qt as number) - qTeoriAmbangV(r.H, 90) * 1000) < 1e-12);
    assert.ok(Math.abs((nilai.cd as number) - r.Q / qTeoriAmbangV(r.H, 90)) < 1e-12);
  });

  it("ekspor memuat sudut takik dan judul ikut bahasa", () => {
    const rows: BacaanFm01[] = [catatFm01(awal, buatRng(9))];
    const id = barisEkspor(KOLOM_EKSPOR_FM01, rows, "id");
    const en = barisEkspor(KOLOM_EKSPOR_FM01, rows, "en");
    assert.equal(id.kepala.length, KOLOM_EKSPOR_FM01.length);
    assert.ok(id.kepala[0].startsWith("θ"));
    assert.notDeepEqual(id.kepala, en.kepala);
    assert.equal(id.baris[0][0], 90);
    assert.ok(id.baris[0].every((v) => typeof v === "number"));
  });
});
