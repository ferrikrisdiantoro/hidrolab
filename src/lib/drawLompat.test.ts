import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  lompatHasil,
  lompatNada,
  lompatPada,
  rencanaLompat,
  sudutLompat,
  undakanUkuran,
  type LompatMasukan,
} from "./drawLompat.ts";
import { FISHWAY_POWER_GENERAL, G, SWIM_BURST_BL, cascadePassage } from "./hydraulics.ts";
import { tailBeat } from "./renangGerak.ts";

const dekat = (a: number, b: number, tol: number, pesan = "") =>
  assert.ok(Math.abs(a - b) <= tol, `${pesan} ${a} != ${b} (tol ${tol})`);

// Bawaan lembar (Q 0,5) teraduk: 163 W/m³. Uji lolos memakai Q 0,4 (131 W/m³).
const awal: LompatMasukan = { rise: 3, steps: 15, L: 3, B: 2, D: 1, Q: 0.4, burst: 2.5 };
const m = (p: Partial<LompatMasukan>): LompatMasukan => ({ ...awal, ...p });

describe("EH-03 keputusan lolos/gagal = cascadePassage", () => {
  it("urutan sama dengan badge lembar di seluruh rentang penggeser", () => {
    let n = 0;
    for (const rise of [0.3, 3, 12])
      for (const steps of [2, 6, 15, 60])
        for (const D of [0.1, 0.5, 1, 3])
          for (const Q of [0.02, 0.5, 5])
            for (const burst of [0.5, 2.5, 6]) {
              const q = m({ rise, steps, D, Q, burst });
              const r = cascadePassage(q.rise, q.steps, q.L, q.B, q.D, q.Q, q.burst);
              const harap = r.tooHigh
                ? "terlalu-tinggi"
                : r.poolTooShallow
                  ? "dangkal"
                  : r.powerDensity > FISHWAY_POWER_GENERAL
                    ? "teraduk"
                    : "lolos";
              assert.equal(lompatHasil(q), harap);
              assert.equal(rencanaLompat(q).hasil, harap);
              n++;
            }
    assert.ok(n > 400);
  });

  it("nada: lolos = pass, gagal = caution (bukan merah sinyal)", () => {
    assert.equal(lompatNada("lolos"), "pass");
    for (const h of ["terlalu-tinggi", "dangkal", "teraduk"] as const) assert.equal(lompatNada(h), "caution");
  });
});

describe("EH-03 lompatan = fisika model", () => {
  it("ikan rancangan: L = Ub / 10, kibasan = tailBeat(Ub, L)", () => {
    const p = rencanaLompat(awal);
    dekat(p.Lf, awal.burst / SWIM_BURST_BL, 1e-12);
    assert.equal(p.f, tailBeat(awal.burst, p.Lf).frequency);
    assert.equal(p.v0, awal.burst);
  });

  it("lolos: tiap lompatan berkecepatan awal Ub, komponen tegak >= u, mencapai mercu tepat di muka hilir undakan", () => {
    for (const q of [awal, m({ steps: 6, D: 1.2, Q: 0.2, burst: 4 }), m({ burst: 6 }), m({ steps: 20 }), m({ L: 1, burst: 6, Q: 0.1 })]) {
      const p = rencanaLompat(q);
      assert.equal(p.hasil, "lolos");
      const r = cascadePassage(q.rise, q.steps, q.L, q.B, q.D, q.Q, q.burst);
      const lompat = p.ruas.filter((s) => s.jenis === 1);
      const { tampil } = undakanUkuran(q.steps, q.L);
      assert.equal(lompat.length, tampil - 1);
      lompat.forEach((s, idx) => {
        dekat(Math.hypot(s.a, s.b), q.burst, 1e-9, "kecepatan awal");
        assert.ok(s.b >= r.requiredBurst - 1e-9, "komponen tegak >= u");
        // Akhir ruas: tinggi naik = Δz.
        const naik = s.b * s.dur - 0.5 * G * s.dur * s.dur;
        dekat(naik, r.stepDrop, 1e-9, "naik setinggi undakan");
        const j = tampil - 2 - idx;
        const xAkhir = s.x0 + s.a * s.dur;
        assert.ok(xAkhir <= (j + 1) * q.L + 1e-9 + 0.02 * p.Lf + 1e-9, "sampai mercu di atas muka hilir");
      });
      // Ikan keluar tepi hulu di akhir.
      const akhir = lompatPada(p, p.durasi - 1e-6);
      assert.ok(akhir.x < 0);
    }
  });

  it("sudut 45° bila Ub >= u45 dan muat; selain itu sin θ = u / Ub", () => {
    const u = Math.sqrt(2 * G * 0.2);
    const s45 = sudutLompat(u * 1.6, 0.2, 10)!;
    dekat(s45.sudut, Math.PI / 4, 1e-12);
    const sT = sudutLompat(u * 1.2, 0.2, 10)!;
    dekat(Math.sin(sT.sudut), 1 / 1.2, 1e-12);
    assert.equal(sudutLompat(u * 0.99, 0.2, 10), null);
  });

  it("terlalu tinggi: lompatan tegak dengan Ub, puncak Ub²/2g < Δz, jatuh kembali", () => {
    const q = m({ steps: 2 }); // Δz 1,5 m, u 5,4 > 2,5
    const p = rencanaLompat(q);
    assert.equal(p.hasil, "terlalu-tinggi");
    const r = cascadePassage(q.rise, q.steps, q.L, q.B, q.D, q.Q, q.burst);
    const s = p.ruas.find((x) => x.jenis === 1)!;
    assert.equal(s.a, 0);
    assert.equal(s.b, q.burst);
    dekat(p.puncak, (q.burst * q.burst) / (2 * G), 1e-12);
    assert.ok(p.puncak < r.stepDrop);
    const atas = lompatPada(p, s.t0 + s.dur / 2);
    dekat(atas.z - s.z0, p.puncak, 1e-9);
    const turun = lompatPada(p, s.t0 + s.dur);
    dekat(turun.z, s.z0, 1e-9, "kembali ke muka air bawah");
  });

  it("dangkal/teraduk: tidak melompat, berhenti tanpa kibasan", () => {
    for (const q of [m({ steps: 10, D: 0.2 }), m({ Q: 5, D: 0.5, steps: 30, B: 0.8, L: 1 })]) {
      const p = rencanaLompat(q);
      assert.ok(p.hasil === "dangkal" || p.hasil === "teraduk", p.hasil);
      assert.equal(p.ruas.filter((s) => s.jenis === 1).length, 0);
      const a = lompatPada(p, p.durasi - 1);
      const b = lompatPada(p, p.durasi - 0.1);
      assert.equal(a.x, b.x);
      assert.equal(a.phase, b.phase);
    }
  });

  it("berenang: laju sepanjang lintasan = Ub, fase = 2 pi f t", () => {
    const p = rencanaLompat(awal);
    const s = p.ruas[0];
    assert.equal(s.jenis, 0);
    const a = lompatPada(p, s.dur * 0.2);
    const b = lompatPada(p, s.dur * 0.7);
    dekat(Math.hypot(b.x - a.x, b.z - a.z) / (s.dur * 0.5), awal.burst, 1e-9);
    dekat(b.phase - a.phase, 2 * Math.PI * p.f * s.dur * 0.5, 1e-9);
  });
});

describe("EH-03 lompatan muat di ruang ancang-ancang (tidak menembus badan bendung)", () => {
  /** Periksa tiap lompatan rencana lolos: geseran mendatar <= ruang, tiba di muka hilir mercu. */
  const periksa = (q: LompatMasukan) => {
    const p = rencanaLompat(q);
    if (p.hasil !== "lolos") return false;
    const { tampil, tebal } = undakanUkuran(q.steps, q.L);
    const ruang = Math.max(0, q.L - tebal - 3 * p.Lf);
    p.ruas
      .filter((s) => s.jenis === 1)
      .forEach((s, idx) => {
        const xNaik = -s.a * s.dur;
        const pesan = `${JSON.stringify(q)} lompatan ${idx}`;
        assert.ok(xNaik <= ruang + 1e-9, `${pesan}: xNaik ${xNaik} > ruang ${ruang}`);
        const kanan = (tampil - 1 - idx) * q.L;
        const xAkhir = s.x0 + s.a * s.dur;
        assert.ok(xAkhir >= kanan - 1e-9, `${pesan}: tiba di ${xAkhir}, di balik muka ${kanan}`);
      });
    return true;
  };

  it("empat kasus pemicu dari tinjauan", () => {
    for (const q of [
      m({ rise: 3, steps: 15, L: 1, D: 1, Q: 0.1, burst: 2.5 }),
      m({ rise: 3, steps: 15, L: 1, D: 1, Q: 0.1, burst: 4 }),
      m({ rise: 3, steps: 10, L: 1, D: 1, Q: 0.1, burst: 6 }),
      m({ rise: 3, steps: 15, L: 2, D: 1, Q: 0.1, burst: 6 }),
    ])
      assert.ok(periksa(q), `${JSON.stringify(q)} harus lolos`);
  });

  it("kisi rentang penggeser", () => {
    let n = 0;
    for (const rise of [0.3, 1, 3, 6, 12])
      for (const steps of [2, 3, 5, 10, 15, 30, 60])
        for (const L of [1, 1.4, 2, 3, 5, 8])
          for (const D of [0.1, 0.5, 1, 3])
            for (const Q of [0.02, 0.2, 1])
              for (let burst = 0.5; burst <= 6 + 1e-9; burst += 0.5)
                if (periksa(m({ rise, steps, L, D, Q, burst }))) n++;
    assert.ok(n > 1000, `keadaan lolos ${n}`);
  });

  it("sudutLompat: ruang nol memberi lompatan tegak, xNaik selalu <= ruang", () => {
    const u = Math.sqrt(2 * G * 0.2);
    const s0 = sudutLompat(u * 2, 0.2, 0)!;
    dekat(s0.sudut, Math.PI / 2, 1e-12);
    for (const k of [1, 1.05, 1.3, 2, 4])
      for (const ruang of [0, 0.01, 0.05, 0.17, 0.5, 2]) {
        const s = sudutLompat(u * k, 0.2, ruang)!;
        assert.ok(s.xNaik <= ruang + 1e-12, `k ${k} ruang ${ruang}: ${s.xNaik}`);
        assert.ok(u * k * Math.sin(s.sudut) >= u - 1e-9, "komponen tegak >= u");
      }
  });
});
