import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { wellDrawdownAt } from "./hydraulics.ts";
import {
  drawdownField,
  gridPenurunan,
  medanSumur,
  periksaSumur,
  sumurBayangan,
  type AkuiferSumur,
  type Sumur,
} from "./sumurBanyak.ts";

const tertekan: AkuiferSumur = { k: 2e-4, thickness: 20, rw: 0.15, R: 400, confined: true };
const bebas: AkuiferSumur = { k: 5e-4, thickness: 25, rw: 0.15, R: 400, confined: false };
const jarak = (a: { x: number; y: number }, x: number, y: number) => Math.hypot(a.x - x, a.y - y);

describe("drawdownField: satu sumur = wellDrawdownAt (model GW-02 sekarang, Thiem)", () => {
  it("tertekan dan bebas, termasuk di dalam rw dan di luar R", () => {
    const w: Sumur = { x: 10, y: -5, Q: 0.02 };
    for (const aq of [tertekan, bebas]) {
      for (const [x, y] of [[10, -5], [10.1, -5], [30, 7], [200, 100], [600, 0]]) {
        const r = jarak(w, x, y);
        const harap = wellDrawdownAt(r, w.Q, aq.k, aq.thickness, aq.rw, aq.R, aq.confined);
        assert.ok(Math.abs(drawdownField([w], x, y, aq) - harap) < 1e-12, `${aq.confined} (${x},${y})`);
      }
    }
  });

  it("Thiem dua sumur pantau (Ferris dkk. 1962 hlm. 91–92 pers. 1): T kembali dari s1 − s2", () => {
    const w: Sumur = { x: 0, y: 0, Q: 0.03 };
    const r1 = 12;
    const r2 = 85;
    const s1 = drawdownField([w], r1, 0, tertekan);
    const s2 = drawdownField([w], r2, 0, tertekan);
    const T = (w.Q * Math.log(r2 / r1)) / (2 * Math.PI * (s1 - s2));
    assert.ok(Math.abs(T - tertekan.k * tertekan.thickness) < 1e-12);
  });
});

describe("superposisi banyak sumur (Strack 1989 lewat potensial debit)", () => {
  const wells: Sumur[] = [
    { x: 0, y: 0, Q: 0.015 },
    { x: 60, y: 10, Q: 0.01 },
    { x: -30, y: 70, Q: 0.02 },
  ];

  it("tertekan: penurunan = jumlah penurunan tiap sumur", () => {
    for (const [x, y] of [[5, 5], [30, 40], [-100, -50]]) {
      const jumlah = wells.reduce(
        (a, w) => a + wellDrawdownAt(jarak(w, x, y), w.Q, tertekan.k, tertekan.thickness, tertekan.rw, tertekan.R, true),
        0
      );
      assert.ok(Math.abs(drawdownField(wells, x, y, tertekan) - jumlah) < 1e-12);
    }
  });

  it("bebas: yang dijumlah H² − h², bukan s; sama dengan koreksi Jacob s − s²/2m (Ferris hlm. 102–103)", () => {
    const H = bebas.thickness;
    for (const [x, y] of [[5, 5], [30, 40], [-100, -50]]) {
      const s = drawdownField(wells, x, y, bebas);
      const koreksi = (v: number) => v - (v * v) / (2 * H);
      const jumlahKoreksi = wells.reduce(
        (a, w) => a + koreksi(wellDrawdownAt(jarak(w, x, y), w.Q, bebas.k, H, bebas.rw, bebas.R, false)),
        0
      );
      assert.ok(Math.abs(koreksi(s) - jumlahKoreksi) < 1e-10, `(${x},${y})`);
      // dan bukan jumlah s biasa: penurunan bebas lebih besar daripada jumlahnya
      const jumlahS = wells.reduce(
        (a, w) => a + wellDrawdownAt(jarak(w, x, y), w.Q, bebas.k, H, bebas.rw, bebas.R, false),
        0
      );
      assert.ok(s > jumlahS);
    }
  });

  it("bebas: kering ditandai dan penurunan dibatasi tebal akuifer (seperti wellDrawdownAt)", () => {
    const deras: Sumur[] = [
      { x: 0, y: 0, Q: 0.1 },
      { x: 3, y: 0, Q: 0.1 },
    ];
    const m = medanSumur(deras, 1.5, 0, bebas);
    assert.equal(m.dry, true);
    assert.equal(m.s, bebas.thickness);
    assert.equal(m.h, 0);
  });

  it("sumur imbuh (Q < 0) menaikkan muka air", () => {
    const m = medanSumur([{ x: 0, y: 0, Q: -0.01 }], 20, 0, tertekan);
    assert.ok(m.s < 0 && m.h > tertekan.thickness);
  });
});

describe("sumur bayangan dekat sungai (Ferris dkk. 1962 hlm. 146–147, gb. 35)", () => {
  const sungai = { x: 100 };
  const w: Sumur = { x: 40, y: 0, Q: 0.02 };

  it("bayangan: jarak sama di seberang sungai, debit berlawanan (sumur imbuh)", () => {
    const b = sumurBayangan([w], sungai);
    assert.deepEqual(b, [{ x: 160, y: 0, Q: -0.02 }]);
  });

  it("penurunan nol di sepanjang garis sungai", () => {
    for (const aq of [tertekan, bebas]) {
      for (const y of [-300, -50, 0, 20, 250]) {
        assert.ok(Math.abs(drawdownField([w], 100, y, aq, sungai)) < 1e-12, `${aq.confined} y=${y}`);
      }
    }
  });

  it("tertekan: s = Q ln(r'/r)/(2πT), tidak bergantung R selama kedua jarak di dalam R", () => {
    const T = tertekan.k * tertekan.thickness;
    for (const [x, y] of [[20, 10], [70, -30], [0, 50]]) {
      const r = jarak(w, x, y);
      const rb = Math.hypot(160 - x, y);
      const harap = (w.Q * Math.log(rb / r)) / (2 * Math.PI * T);
      assert.ok(Math.abs(drawdownField([w], x, y, tertekan, sungai) - harap) < 1e-12);
    }
  });

  it("kerucut lebih landai di sisi darat, lebih curam di sisi sungai (hlm. 147)", () => {
    const d = 15;
    const sDarat = drawdownField([w], w.x - d, 0, tertekan, sungai);
    const sSungai = drawdownField([w], w.x + d, 0, tertekan, sungai);
    const s0 = drawdownField([w], w.x - 1, 0, tertekan, sungai);
    assert.ok(s0 - sDarat < s0 - sSungai);
    // dan penurunan di mana pun lebih kecil daripada tanpa sungai
    assert.ok(sDarat < drawdownField([w], w.x - d, 0, tertekan));
  });

  it("titik di seberang sungai tidak dihitung (s = 0, ditandai)", () => {
    const m = medanSumur([w], 130, 0, tertekan, sungai);
    assert.equal(m.beyondRiver, true);
    assert.equal(m.s, 0);
  });

  it("periksaSumur menandai sumur di seberang sungai", () => {
    const r = periksaSumur([w, { x: 140, y: 0, Q: 0.01 }, { x: 10, y: 5, Q: 0.01 }], sungai);
    assert.equal(r.sisiAkuifer, -1);
    assert.deepEqual(r.salahSisi, [false, true, false]);
  });
});

describe("gridPenurunan", () => {
  it("baris-utama ny × nx, sama dengan drawdownField di tiap simpul", () => {
    const wells: Sumur[] = [
      { x: 0, y: 0, Q: 0.015 },
      { x: 50, y: 20, Q: 0.01 },
    ];
    const area = { x0: -100, x1: 100, y0: -80, y1: 80 };
    const g = gridPenurunan(wells, bebas, area, 21, 17, { x: 90 });
    assert.equal(g.s.length, 21 * 17);
    let maks = -Infinity;
    for (let j = 0; j < 17; j++) {
      for (let i = 0; i < 21; i++) {
        const x = area.x0 + ((area.x1 - area.x0) * i) / 20;
        const y = area.y0 + ((area.y1 - area.y0) * j) / 16;
        const v = drawdownField(wells, x, y, bebas, { x: 90 });
        assert.ok(Math.abs(g.s[j * 21 + i] - v) < 1e-12);
        maks = Math.max(maks, v);
      }
    }
    assert.equal(g.sMax, maks);
  });
});
