import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  checksEnergy,
  checksGvf,
  checksJump,
  checksMoody,
  checksNotch,
  checksTransition,
} from "./checks.ts";
import { evaluate, summarise, type Check } from "./verify.ts";

/**
 * Uji blok verifikasi.
 *
 * Blok verifikasi ditampilkan kepada klien dan sebagiannya ikut bergerak saat
 * penggeser diubah. Kalau ada satu pemeriksaan yang gagal pada posisi penggeser
 * tertentu, klien akan melihat kegagalan itu di layarnya sendiri. Karena itu
 * seluruh pemeriksaan diuji melintasi rentang masukan, bukan hanya pada nilai
 * bawaan.
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

describe("Blok verifikasi memenuhi aturan PRD", () => {
  const semua: [string, Check[]][] = [
    ["OC-01", checksJump(0.3, 7)],
    ["OC-02", checksEnergy(12, 5, 0.025, 0.0015)],
    ["OC-03", checksGvf(12, 5, 0.025, 0.0015)],
    ["PI-01", checksMoody(6e5, 8.667e-4)],
    ["FM-01", checksNotch(0.2, 90)],
    ["OC-04", checksTransition(12, 5, 1.5, 4.2, 0.1)],
    ["OC-05", checksTransition(12, 5, 1.5, 4.0, 0)],
    ["OC-07", checksTransition(12, 5, 1.5, 5.0, 0.2)],
  ];

  it("tiap lembar punya minimal 5 pemeriksaan", () => {
    for (const [nama, cs] of semua) {
      assert.ok(cs.length >= 5, `${nama} baru punya ${cs.length} pemeriksaan`);
    }
  });

  it("tiap lembar punya minimal satu acuan terbitan atau standar", () => {
    for (const [nama, cs] of semua) {
      assert.ok(
        cs.some((c) => c.kind === "terbitan"),
        `${nama} belum punya pemeriksaan terhadap nilai terbitan`
      );
    }
  });

  it("tiap pemeriksaan menyebutkan sumbernya", () => {
    for (const [nama, cs] of semua) {
      for (const c of cs) {
        assert.ok(
          c.source.length > 10,
          `${nama} | ${c.label.id}: sumber terlalu pendek`
        );
      }
    }
  });

  it("tiap pemeriksaan punya label dua bahasa yang benar-benar berbeda", () => {
    for (const [nama, cs] of semua) {
      for (const c of cs) {
        assert.ok(c.label.id.length > 0 && c.label.en.length > 0, nama);
        assert.notEqual(
          c.label.id,
          c.label.en,
          `${nama} | label belum diterjemahkan: ${c.label.id}`
        );
      }
    }
  });

  it("toleransi longgar selalu disertai alasannya", () => {
    for (const [nama, cs] of semua) {
      for (const c of cs) {
        if (c.tol >= 0.005) {
          assert.ok(
            c.tolReason,
            `${nama} | ${c.label.id}: toleransi ${c.tol} tanpa alasan tertulis`
          );
        }
      }
    }
  });

  it("seluruh pemeriksaan lolos pada nilai bawaan", () => {
    for (const [nama, cs] of semua) {
      semuaLolos(cs, nama);
      assert.ok(summarise(cs).allPass, nama);
    }
  });
});

/* ------------------------------------------------------------------ */

describe("Blok verifikasi bertahan di seluruh rentang penggeser", () => {
  it("OC-01 loncatan air", () => {
    for (const y1 of [0.08, 0.2, 0.5, 0.9, 1.2]) {
      for (const V1 of [0.5, 2, 7, 12, 16]) {
        semuaLolos(checksJump(y1, V1), `y1=${y1} V1=${V1}`);
      }
    }
  });

  it("OC-02 energi spesifik", () => {
    for (const Q of [0.5, 12, 60, 120]) {
      for (const b of [0.5, 5, 25]) {
        for (const n of [0.01, 0.025, 0.07]) {
          for (const S of [0.00005, 0.0015, 0.04]) {
            semuaLolos(checksEnergy(Q, b, n, S), `Q=${Q} b=${b} n=${n} S=${S}`);
          }
        }
      }
    }
  });

  it("OC-03 profil aliran berubah lambat", () => {
    for (const Q of [0.5, 12, 60, 120]) {
      for (const b of [0.5, 5, 25]) {
        for (const S0 of [0.00005, 0.0015, 0.04]) {
          semuaLolos(checksGvf(Q, b, 0.025, S0), `Q=${Q} b=${b} S0=${S0}`);
        }
      }
    }
  });

  it("PI-01 diagram Moody", () => {
    for (const Re of [1e3, 2.5e3, 1e4, 1e5, 1e6, 1e7, 1e8]) {
      for (const rr of [0, 1e-5, 1e-4, 1e-3, 0.01, 0.05]) {
        semuaLolos(checksMoody(Re, rr), `Re=${Re} rr=${rr}`);
      }
    }
  });

  it("OC-04, OC-05, OC-07 transisi", () => {
    for (const Q of [1, 12, 60]) {
      for (const b1 of [2, 5, 12]) {
        for (const y1 of [0.3, 0.8, 1.5, 3]) {
          for (const b2 of [b1 * 0.5, b1 * 0.8, b1, b1 * 1.4]) {
            for (const dz of [-0.2, 0, 0.15, 0.5]) {
              semuaLolos(
                checksTransition(Q, b1, y1, b2, dz),
                `Q=${Q} b1=${b1} y1=${y1} b2=${b2} dz=${dz}`
              );
            }
          }
        }
      }
    }
  });

  it("FM-01 ambang ukur V", () => {
    for (const H of [0.005, 0.03, 0.05, 0.2, 0.45]) {
      for (const theta of [20, 60, 90, 120]) {
        semuaLolos(checksNotch(H, theta), `H=${H} theta=${theta}`);
      }
    }
  });
});
