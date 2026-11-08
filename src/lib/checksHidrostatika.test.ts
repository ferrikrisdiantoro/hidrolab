import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { P_ATM, checksHidrostatika } from "./checksHidrostatika.ts";
import { evaluate, type Check } from "./verify.ts";

/**
 * Blok verifikasi FF-08 ikut bergerak saat penggeser diubah, jadi seluruh
 * pemeriksaannya disapu melintasi rentang penggeser lembar (rho 600 sampai
 * 14 000, b dan L 0,1 sampai 10 m, tepi atas −3 sampai 15 m, sudut 10
 * sampai 90 derajat, probe 0 sampai 20 m, ukur dan mutlak).
 */

function semuaLolos(checks: Check[], konteks: string) {
  for (const c of checks) {
    const r = evaluate(c);
    assert.ok(
      r.pass,
      `${konteks} | ${c.label.id}: acuan ${c.expected}, hitungan ${c.actual}, selisih ${r.pct.toFixed(6)}%`
    );
  }
}

const deg = (d: number) => (d * Math.PI) / 180;

describe("FF-08 blok verifikasi", () => {
  const bawaan = checksHidrostatika(1000, 2, 3, 1, deg(60), 3, 0);

  it("minimal lima pemeriksaan, ada nilai terbitan, sumber tertulis, dua bahasa", () => {
    assert.ok(bawaan.length >= 5);
    assert.ok(bawaan.some((c) => c.kind === "terbitan"));
    for (const c of bawaan) {
      assert.ok(c.source.length > 8, c.source);
      assert.notEqual(c.label.id, c.label.en);
      if (c.tol > 0.005 && c.tol < 1) assert.ok(c.tolReason, c.label.id);
    }
  });

  it("lolos semua pada keadaan bawaan", () => semuaLolos(bawaan, "bawaan"));

  it("lolos semua di seluruh rentang penggeser", () => {
    for (const rho of [600, 891, 1000, 13550, 14000])
      for (const b of [0.1, 2, 10])
        for (const L of [0.1, 3, 10])
          for (const top of [-3, -1, -0.05, 0, 1, 15])
            for (const a of [10, 37, 60, 90])
              for (const h of [0, 3, 20])
                for (const pa of [0, P_ATM])
                  semuaLolos(
                    checksHidrostatika(rho, b, L, top, deg(a), h, pa),
                    `rho ${rho} b ${b} L ${L} top ${top} θ ${a} h ${h} pa ${pa}`
                  );
  });
});
