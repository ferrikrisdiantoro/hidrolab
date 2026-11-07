/*
 * Uji lembar pengamatan FM-02 venturi (Phase 3, P-A): pencatatan bacaan dari
 * keadaan lembar, ringkasan, dan baris ekspor. Logika tanpa React di
 * src/data/praktikum/fm02.ts; komponen Praktikum.tsx hanya menampilkan.
 *
 * Catatan insinyur yang diuji:
 * - Δh = h₁ − h₂ dari dua bacaan tabung terpisah (ALAT_MANOMETER), bukan
 *   bacaAlat(Δh) sekali
 * - debit volumetrik memakai ALAT_DEBIT_VOLUMETRIK
 * - benih sama + urutan keadaan sama = bacaan sama
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ALAT_DEBIT_VOLUMETRIK,
  ALAT_MANOMETER,
  bacaAlat,
  buatRng,
  kalibrasiCd,
  kalibrasiVenturi,
  qTeoriVenturi,
  barisEkspor,
} from "./praktikum.ts";
import { venturiDischarge } from "./hydraulics.ts";
import {
  H2_DATUM,
  KOLOM_EKSPOR_FM02,
  KOLOM_FM02,
  catatFm02,
  geometriCampur,
  ringkasFm02,
  tolakFm02,
  volumeTampungMin,
  type BacaanFm02,
} from "../data/praktikum/fm02.ts";

const awal = { D1: 0.2, D2: 0.1, dh: 0.5, C: 0.995 };

describe("FM-02 catat bacaan", () => {
  it("benih sama memberi bacaan sama, benih lain berbeda", () => {
    const a = buatRng(42), b = buatRng(42), c = buatRng(43);
    const ra = [catatFm02(awal, a), catatFm02({ ...awal, dh: 0.3 }, a)];
    const rb = [catatFm02(awal, b), catatFm02({ ...awal, dh: 0.3 }, b)];
    const rc = [catatFm02(awal, c), catatFm02({ ...awal, dh: 0.3 }, c)];
    assert.deepEqual(ra, rb);
    assert.notDeepEqual(ra, rc);
  });

  it("dua tabung dibaca terpisah lalu dikurangkan, dengan urutan tarikan h1, h2, Q", () => {
    const rng = buatRng(7);
    const r = catatFm02(awal, rng);
    const ref = buatRng(7);
    const h1 = bacaAlat(H2_DATUM + awal.dh, ALAT_MANOMETER, ref);
    const h2 = bacaAlat(H2_DATUM, ALAT_MANOMETER, ref);
    const Q = bacaAlat(venturiDischarge(awal.D1, awal.D2, awal.dh, awal.C).Q, ALAT_DEBIT_VOLUMETRIK, ref);
    assert.equal(r.h1, h1);
    assert.equal(r.h2, h2);
    assert.equal(r.Q, Q);
    // Δh dibulatkan ke 1 mm, tanpa ekor biner
    assert.equal(r.dh, Number((h1 - h2).toFixed(3)));
    assert.equal(r.D1, awal.D1);
    assert.equal(r.D2, awal.D2);
  });

  it("bacaan tabung jatuh di kisi 1 mm dan sebaran Δh ≈ √2 × sebaran satu tabung", () => {
    const rng = buatRng(2026);
    const dhs: number[] = [];
    for (let i = 0; i < 4000; i++) {
      const r = catatFm02(awal, rng);
      assert.equal(Math.round(r.h1 * 1000), r.h1 * 1000);
      assert.equal(Math.round(r.h2 * 1000), r.h2 * 1000);
      dhs.push(r.dh);
    }
    const m = dhs.reduce((s, v) => s + v, 0) / dhs.length;
    const sd = Math.sqrt(dhs.reduce((s, v) => s + (v - m) ** 2, 0) / (dhs.length - 1));
    // σ satu tabung teramati = √(0,5² + 1²/12) mm = 0,577 mm; Δh: × √2 = 0,816 mm
    const harap = Math.SQRT2 * Math.hypot(0.5, 1 / Math.sqrt(12)) / 1000;
    assert.ok(Math.abs(m - awal.dh) < 0.0001, `rerata ${m}`);
    assert.ok(Math.abs(sd / harap - 1) < 0.08, `sd ${sd} vs ${harap}`);
  });

  it("Cd per titik mendekati C lembar", () => {
    const rng = buatRng(11);
    const rows: BacaanFm02[] = [];
    for (let i = 0; i < 400; i++) rows.push(catatFm02(awal, rng));
    const s = ringkasFm02(rows);
    assert.ok(Math.abs(s.kal.cdRerata - awal.C) < 0.003, `${s.kal.cdRerata}`);
    assert.ok(Math.abs(s.kal.cd - awal.C) < 0.003, `${s.kal.cd}`);
  });
});

describe("FM-02 tolak catat", () => {
  it("β ≥ 1 ditolak, β < 1 diterima", () => {
    assert.equal(tolakFm02({ ...awal, D2: 0.2 }), "bukan-venturi");
    assert.equal(tolakFm02({ ...awal, D2: 0.3 }), "bukan-venturi");
    assert.equal(tolakFm02(awal), null);
  });
});

describe("FM-02 ringkasan", () => {
  it("satu geometri memakai kalibrasiVenturi", () => {
    const rng = buatRng(5);
    const rows = [0.2, 0.35, 0.5, 0.8, 1.2].map((dh) => catatFm02({ ...awal, dh }, rng));
    const s = ringkasFm02(rows);
    const k = kalibrasiVenturi(rows.map((r) => ({ dh: r.dh, Q: r.Q })), awal.D1, awal.D2);
    assert.deepEqual(s.kal, k);
    assert.equal(s.campur, false);
    assert.equal(s.kal.n, 5);
    assert.ok(Number.isFinite(s.kal.seCd));
  });

  it("geometri campur memakai Q teori per baris dan ditandai", () => {
    const rng = buatRng(5);
    const rows = [catatFm02(awal, rng), catatFm02({ ...awal, D2: 0.12 }, rng)];
    assert.equal(geometriCampur(rows), true);
    const s = ringkasFm02(rows);
    const k = kalibrasiCd(rows.map((r) => ({ qUkur: r.Q, qTeori: qTeoriVenturi(r.dh, r.D1, r.D2) })));
    assert.deepEqual(s.kal, k);
    assert.equal(s.campur, true);
  });

  it("kosong dan satu baris tidak melempar; simpangan NaN", () => {
    assert.equal(ringkasFm02([]).kal.n, 0);
    const s = ringkasFm02([catatFm02(awal, buatRng(1))]);
    assert.equal(s.kal.n, 1);
    assert.ok(Number.isNaN(s.kal.cdSd));
    assert.ok(Number.isNaN(s.kal.seCd));
  });

  it("h₁ di atas skala bangku 400 mm ditandai, tidak dipotong", () => {
    const rng = buatRng(3);
    const r = catatFm02({ ...awal, dh: 2 }, rng);
    assert.ok(r.h1 > 2);
    assert.equal(ringkasFm02([r]).luarSkala, 1);
    assert.equal(ringkasFm02([catatFm02({ ...awal, dh: 0.2 }, rng)]).luarSkala, 0);
  });
});

describe("FM-02 volume tampung", () => {
  it("paling sedikit 10 L dan paling sedikit Q·30 s", () => {
    assert.equal(volumeTampungMin(0.0001), 10); // 0,1 L/s · 30 s = 3 L < 10 L
    assert.ok(Math.abs(volumeTampungMin(0.001) - 30) < 1e-9); // 1 L/s · 30 s
  });
});

describe("FM-02 kolom dan ekspor", () => {
  it("kolom layar: h dan Δh dalam mm, Q dalam L/s, Cd = Q ukur / Q teori", () => {
    const r = catatFm02(awal, buatRng(9));
    const nilai = Object.fromEntries(KOLOM_FM02.map((k) => [k.key, k.hitung ? k.hitung(r) : (r as Record<string, unknown>)[k.key]]));
    assert.equal(nilai.h1, r.h1 * 1000);
    assert.equal(nilai.dh, r.dh * 1000);
    assert.equal(nilai.Q, r.Q * 1000);
    assert.ok(Math.abs((nilai.cd as number) - r.Q / qTeoriVenturi(r.dh, r.D1, r.D2)) < 1e-12);
  });

  it("ekspor memuat diameter dan judul ikut bahasa", () => {
    const rows = [catatFm02(awal, buatRng(9))];
    const id = barisEkspor(KOLOM_EKSPOR_FM02, rows, "id");
    const en = barisEkspor(KOLOM_EKSPOR_FM02, rows, "en");
    assert.equal(id.kepala.length, KOLOM_EKSPOR_FM02.length);
    assert.ok(id.kepala.some((h) => h.startsWith("D₁")));
    assert.notDeepEqual(id.kepala, en.kepala);
    assert.equal(id.baris[0].length, id.kepala.length);
    assert.ok(id.baris[0].every((v) => typeof v === "number"));
  });
});
