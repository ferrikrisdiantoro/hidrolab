/*
 * Uji lembar pengamatan FM-05 pengenceran garam (Phase 3, P-B). Logika tanpa
 * React di src/data/praktikum/fm05.ts.
 *
 * Yang diuji:
 * - bacaan konduktivitas = latar + k·c(t) dari kurva model, dengan galat alat
 * - benih sama + urutan keadaan sama = bacaan sama
 * - latar dari bacaan sebelum suntik dikurangkan, integrasiTrapesium, lalu
 *   Q = M/∫(c − c₀)dt (debitGulp) mendekati Q model
 * - ekor yang terpotong ditandai
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { bacaAlat, buatRng } from "./praktikum.ts";
import { tracerCurve } from "./hydraulics.ts";
import {
  ALAT_KONDUKTIVITAS,
  EC_LATAR,
  K_GARAM,
  catatFm05,
  kepekatanPada,
  ringkasFm05,
  type BacaanFm05,
  type KeadaanFm05,
} from "../data/praktikum/fm05.ts";

const awal: Omit<KeadaanFm05, "t"> = { Q: 1.2, M: 2, L: 120, A: 1.5, D: 3 };

function seri(rng: ReturnType<typeof buatRng>, dari: number, sampai: number, dt: number, s = awal): BacaanFm05[] {
  const out: BacaanFm05[] = [];
  for (let t = dari; t <= sampai + 1e-9; t += dt) out.push(catatFm05({ ...s, t }, rng));
  return out;
}

/** Bacaan tanpa galat: konduktivitas benar. */
function seriBenar(dari: number, sampai: number, dt: number, s = awal): BacaanFm05[] {
  const pts = tracerCurve(s.Q, s.M, s.L, s.A, s.D).points;
  const out: BacaanFm05[] = [];
  for (let t = dari; t <= sampai + 1e-9; t += dt) out.push({ ...s, t, ec: EC_LATAR + K_GARAM * kepekatanPada(pts, t) });
  return out;
}

describe("FM-05 kurva model", () => {
  it("kepekatanPada sama dengan titik kurva model di kisi, nol di luar jendela dan sebelum suntik", () => {
    const r = tracerCurve(awal.Q, awal.M, awal.L, awal.A, awal.D);
    for (const i of [0, 100, 300, 599]) assert.ok(Math.abs(kepekatanPada(r.points, r.points[i].t) - r.points[i].c) < 1e-12);
    assert.equal(kepekatanPada(r.points, -5), 0);
    assert.equal(kepekatanPada(r.points, r.points[600].t + 10), 0);
    // di antara dua titik kisi: interpolasi lurus
    const a = r.points[250], b = r.points[251];
    assert.ok(Math.abs(kepekatanPada(r.points, (a.t + b.t) / 2) - (a.c + b.c) / 2) < 1e-12);
  });
});

describe("FM-05 catat bacaan", () => {
  it("benih sama memberi bacaan sama, benih lain berbeda", () => {
    assert.deepEqual(seri(buatRng(4), -30, 300, 10), seri(buatRng(4), -30, 300, 10));
    assert.notDeepEqual(seri(buatRng(4), -30, 300, 10), seri(buatRng(5), -30, 300, 10));
  });

  it("bacaan = bacaAlat(latar + k·c(t)) dengan ALAT_KONDUKTIVITAS", () => {
    const s = { ...awal, t: 150 };
    const r = catatFm05(s, buatRng(8));
    const c = kepekatanPada(tracerCurve(s.Q, s.M, s.L, s.A, s.D).points, 150);
    assert.equal(r.ec, bacaAlat(EC_LATAR + K_GARAM * c, ALAT_KONDUKTIVITAS, buatRng(8)));
    assert.equal(r.t, 150);
    assert.equal(r.M, 2);
    assert.ok(c > 1, `c ${c}`);
  });

  it("bacaan jatuh di kisi resolusi 0,1 µS/cm", () => {
    for (const r of seri(buatRng(1), -30, 400, 5)) assert.equal(Math.round(r.ec * 10), Number((r.ec * 10).toFixed(6)));
  });
});

describe("FM-05 ringkasan", () => {
  it("tanpa galat, Δt 10 s: Q dari luas kurva dalam 0,5 % dari Q model", () => {
    const s = ringkasFm05(seriBenar(-30, 420, 10));
    assert.ok(Math.abs(s.latar - EC_LATAR) < 1e-9, `latar ${s.latar}`);
    assert.equal(s.nLatar, 4);
    assert.ok(Math.abs(s.Q / s.Qmodel - 1) < 0.005, `Q ${s.Q} vs ${s.Qmodel}`);
    assert.equal(s.ekorTerpotong, false);
  });

  it("dengan galat baca, beberapa benih: Q dalam 5 % dari Q model", () => {
    for (const benih of [1, 2, 3, 42, 2026]) {
      const s = ringkasFm05(seri(buatRng(benih), -30, 420, 10));
      assert.ok(Math.abs(s.Q / s.Qmodel - 1) < 0.05, `benih ${benih}: ${s.Q} vs ${s.Qmodel}`);
    }
  });

  it("luas = integrasiTrapesium atas t ≥ 0 dengan latar dikurangkan, dibagi k", () => {
    const rows: BacaanFm05[] = [
      { ...awal, t: -10, ec: 50 },
      { ...awal, t: 0, ec: 52 },
      { ...awal, t: 10, ec: 70 },
      { ...awal, t: 20, ec: 54 },
      { ...awal, t: 30, ec: 50 },
    ];
    const s = ringkasFm05(rows);
    // latar = rerata bacaan t ≤ 0 = 51
    assert.equal(s.latar, 51);
    // trapesium (t 0..30): (1+19)/2·10 + (19+3)/2·10 + (3−1)/2·10 = 100 + 110 + 10 = 220
    assert.ok(Math.abs(s.luasEc - 220) < 1e-9, `luasEc ${s.luasEc}`);
    assert.ok(Math.abs(s.luasC - 220 / K_GARAM) < 1e-9);
    assert.ok(Math.abs(s.Q - (2 * 1e6) / (220 / K_GARAM) / 1000) < 1e-9);
  });

  it("baris tidak urut waktu diurutkan dulu", () => {
    const a = seriBenar(-30, 420, 10);
    const b = [...a].reverse();
    assert.equal(ringkasFm05(a).Q, ringkasFm05(b).Q);
  });

  it("tanpa bacaan sebelum suntik (t ≤ 0): latar = bacaan paling awal", () => {
    const s = ringkasFm05(seriBenar(10, 420, 10));
    assert.equal(s.nLatar, 0);
    assert.ok(Math.abs(s.latar - EC_LATAR) < 1e-6);
  });

  it("ekor terpotong: ditandai dan Q kebesaran", () => {
    const s = ringkasFm05(seriBenar(-30, 180, 10));
    assert.equal(s.ekorTerpotong, true);
    assert.ok(s.Q > s.Qmodel * 1.05, `Q ${s.Q}`);
  });

  it("puncak kecil: kelebihan ekor sebatas galat alat tidak memicu penanda", () => {
    const rows: BacaanFm05[] = [
      { ...awal, t: -10, ec: 50 },
      { ...awal, t: 0, ec: 50 },
      { ...awal, t: 10, ec: 51 },
      { ...awal, t: 20, ec: 50.5 },
    ];
    // 0,5 > 3 % puncak (0,03), tetapi di bawah 3σ alat (≈ 0,8 µS/cm)
    assert.equal(ringkasFm05(rows).ekorTerpotong, false);
  });

  it("keadaan berubah di tengah seri ditandai campur", () => {
    const rows = [...seriBenar(-30, 0, 10), ...seriBenar(10, 420, 10, { ...awal, M: 3 })];
    assert.equal(ringkasFm05(rows).campur, true);
    assert.equal(ringkasFm05(seriBenar(-30, 420, 10)).campur, false);
  });
});
