import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  KISI_MAKS,
  anchorSumur,
  balikSumur,
  digitLevel,
  drawIsoSumur,
  kameraSumur,
  konturSumur,
  levelKontur,
  medanIso,
  mukaSumur,
  simpulSumbu,
  skalaTegak,
  type IsoSumurState,
  type IsoSumurTeks,
} from "./drawIsoSumur.ts";
import { wellDrawdownAt } from "./hydraulics.ts";
import { medanSumur, type AkuiferSumur, type Sumur } from "./sumurBanyak.ts";
import { ISO, gambarMuka, proyeksi, type Kamera, type Muka } from "./proyeksi.ts";
import { W } from "./theme.ts";

/*
 * GW-02 3D: permukaan dan kontur dari model yang SAMA dengan lembar
 * (medanSumur, M10), superposisi benar, dan menggambar cukup murah untuk
 * diputar.
 */

const b = 25;
const tertekan: AkuiferSumur = { k: 1e-4, thickness: b, rw: 0.15, R: 400, confined: true };
const bebas: AkuiferSumur = { k: 1e-4, thickness: b, rw: 0.15, R: 400, confined: false };

const keadaanTertekan = (wells: Sumur[]): IsoSumurState => ({
  wells,
  aq: tertekan,
  zAwal: 1.5 * b,
  zAtap: b,
  tebalPenutup: 0.18 * b,
  L: 400,
});
const keadaanBebas = (wells: Sumur[]): IsoSumurState => ({ wells, aq: bebas, zAwal: b, L: 400 });

const SATU: Sumur[] = [{ x: 0, y: 0, Q: 0.02 }];
const TIGA: Sumur[] = [
  { x: 0, y: 0, Q: 0.02 },
  { x: 130.5, y: -60.25, Q: 0.02 },
  { x: -210, y: 175.3, Q: 0.02 },
];

const TEKS: IsoSumurTeks = {
  heading: "tampak isometrik",
  sumur: "sumur",
  skalaTegak: (v) => `skala tegak ×${v}`,
  mukaAwal: "muka air awal",
};

function kanvas() {
  const teks: string[] = [];
  const garis: [number, number][] = [];
  const nop = () => {};
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    save: nop,
    restore: nop,
    beginPath: nop,
    moveTo: (x: number, y: number) => garis.push([x, y]),
    lineTo: (x: number, y: number) => garis.push([x, y]),
    closePath: nop,
    fill: nop,
    stroke: nop,
    rect: nop,
    clip: nop,
    arc: nop,
    fillRect: nop,
    strokeRect: nop,
    setLineDash: nop,
    measureText: (t: string) => ({ width: 6 * t.length }),
    fillText: (t: string) => teks.push(t),
    translate: nop,
    rotate: nop,
    scale: nop,
    setTransform: nop,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, teks, garis };
}

describe("drawIsoSumur: permukaan = model lembar", () => {
  for (const [nama, st] of [
    ["tertekan, tiga sumur", keadaanTertekan(TIGA)],
    ["bebas, tiga sumur", keadaanBebas(TIGA)],
    ["tertekan, satu sumur", keadaanTertekan(SATU)],
  ] as const) {
    it(`${nama}: tiap titik muka permukaan = zAwal − medanSumur (tol 1e-9)`, () => {
      const ms = mukaSumur(st);
      let n = 0;
      for (const f of ms.permukaan)
        for (const p of f.pts) {
          const harap = st.zAwal - medanSumur(st.wells as Sumur[], p[0], p[1], st.aq).s;
          assert.ok(Math.abs(p[2] / ms.VE - harap) < 1e-9, `(${p[0]}, ${p[1]}): ${p[2] / ms.VE} vs ${harap}`);
          n++;
        }
      assert.ok(n > 0);
    });
  }

  it("satu sumur = wellDrawdownAt (fungsi tampak Potongan), di tiap titik kisi", () => {
    const st = keadaanTertekan(SATU);
    const m = medanIso(st);
    for (let j = 0; j < m.ny; j++)
      for (let i = 0; i < m.nx; i++) {
        const r = Math.hypot(m.xs[i], m.ys[j]);
        const harap = wellDrawdownAt(r, 0.02, tertekan.k, b, tertekan.rw, tertekan.R, true);
        assert.ok(Math.abs(m.s[j * m.nx + i] - harap) < 1e-12);
      }
  });

  it("kisi paling banyak 41 × 41 (40 × 40 muka), memuat letak tiap sumur", () => {
    for (const st of [keadaanTertekan(SATU), keadaanTertekan(TIGA)]) {
      const m = medanIso(st);
      assert.ok(m.nx <= KISI_MAKS && m.ny <= KISI_MAKS);
      assert.ok(mukaSumur(st).permukaan.length <= 1600);
      for (const w of st.wells) {
        assert.ok(m.xs.includes(w.x), `x ${w.x}`);
        assert.ok(m.ys.includes(w.y), `y ${w.y}`);
      }
      assert.equal(m.xs[0], -st.L);
      assert.equal(m.xs[m.nx - 1], st.L);
    }
    // Lima sumur tetap dalam anggaran.
    const lima = simpulSumbu([0, 100, -100, 250, -300], 400, 4.8, 400);
    assert.ok(lima.length <= KISI_MAKS);
    for (let i = 1; i < lima.length; i++) assert.ok(lima[i] > lima[i - 1]);
  });

  it("sumur utama: muka air di pipa = zAwal − s(rw) model", () => {
    const st = keadaanTertekan(SATU);
    const m = medanIso(st);
    const i = m.xs.indexOf(0);
    const j = m.ys.indexOf(0);
    const s = wellDrawdownAt(0.15, 0.02, tertekan.k, b, 0.15, 400, true);
    assert.ok(Math.abs(m.z[j * m.nx + i] - (st.zAwal - s)) < 1e-12);
  });
});

describe("drawIsoSumur: kontur pada level yang benar", () => {
  it("level k·langkah bulat, semua di bawah s terbesar", () => {
    assert.deepEqual(levelKontur(10.05), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.deepEqual(levelKontur(0.9), [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
    assert.deepEqual(levelKontur(0), []);
    assert.equal(digitLevel(2), 0);
    assert.equal(digitLevel(0.5), 1);
    assert.equal(digitLevel(0.25), 2);
  });

  for (const [nama, st] of [
    ["tertekan", keadaanTertekan(TIGA)],
    ["bebas", keadaanBebas(TIGA)],
  ] as const) {
    it(`${nama}: ujung ruas di tepi sel, nilai interpolasi tepi = level, z = zAwal − level`, () => {
      const m = medanIso(st);
      const ruas = konturSumur(st, m);
      assert.ok(ruas.length > 50);
      const di = (v: number, arr: number[]) => arr.indexOf(v);
      for (const r of ruas) {
        for (const p of [r.a, r.b]) {
          assert.ok(Math.abs(p[2] - (st.zAwal - r.level)) < 1e-12);
          const i = di(p[0], m.xs);
          const j = di(p[1], m.ys);
          assert.ok(i >= 0 || j >= 0, "ujung ruas di garis kisi");
          // Nilai di sepanjang tepi: interpolasi linear dua titik kisi tepi itu.
          let v: number;
          if (i >= 0 && j >= 0) v = m.s[j * m.nx + i];
          else if (i >= 0) {
            let jj = 0;
            while (m.ys[jj + 1] < p[1]) jj++;
            const t = (p[1] - m.ys[jj]) / (m.ys[jj + 1] - m.ys[jj]);
            v = m.s[jj * m.nx + i] + (m.s[(jj + 1) * m.nx + i] - m.s[jj * m.nx + i]) * t;
          } else {
            let ii = 0;
            while (m.xs[ii + 1] < p[0]) ii++;
            const t = (p[0] - m.xs[ii]) / (m.xs[ii + 1] - m.xs[ii]);
            v = m.s[j * m.nx + ii] + (m.s[j * m.nx + ii + 1] - m.s[j * m.nx + ii]) * t;
          }
          assert.ok(Math.abs(v - r.level) < 1e-9, `${v} vs ${r.level}`);
        }
      }
    });
  }

  it("kontur satu sumur tertekan: jari-jari tiap ruas mendekati r Thiem untuk level itu", () => {
    const st = keadaanTertekan(SATU);
    const T = tertekan.k * b;
    for (const r of konturSumur(st)) {
      const rHarap = 400 * Math.exp((-r.level * 2 * Math.PI * T) / 0.02);
      const rr = Math.hypot(r.a[0], r.a[1]);
      // Interpolasi linear pada kurva ln r: galat relatif terbatas oleh lebar sel.
      if (rHarap > 30) assert.ok(Math.abs(rr - rHarap) / rHarap < 0.12, `${rr} vs ${rHarap}`);
    }
  });

  it("ruas kontur digambar di muka permukaan selnya (garisDalam), bukan muka lepas", () => {
    const st = keadaanTertekan(TIGA);
    const ms = mukaSumur(st);
    const jumlah = ms.permukaan.reduce((n, f) => n + (f.garisDalam?.length ?? 0), 0);
    assert.ok(jumlah >= ms.kontur.length);
  });
});

describe("drawIsoSumur: superposisi", () => {
  it("tertekan: s di tiap titik kisi = jumlah s tiap sumur sendiri", () => {
    const st = keadaanTertekan(TIGA);
    const m = medanIso(st);
    for (let j = 0; j < m.ny; j += 3)
      for (let i = 0; i < m.nx; i += 3) {
        const jumlah = TIGA.reduce((a, w) => a + medanSumur([w], m.xs[i], m.ys[j], tertekan).s, 0);
        assert.ok(Math.abs(m.s[j * m.nx + i] - jumlah) < 1e-9);
      }
  });

  it("bebas: H² − h² di tiap titik kisi = jumlah H² − h² tiap sumur sendiri", () => {
    const st = keadaanBebas(TIGA);
    const m = medanIso(st);
    for (let j = 0; j < m.ny; j += 3)
      for (let i = 0; i < m.nx; i += 3) {
        const k = j * m.nx + i;
        if (m.kering[k]) continue;
        const h = b - m.s[k];
        const jumlah = TIGA.reduce((a, w) => {
          const hw = medanSumur([w], m.xs[i], m.ys[j], bebas).h;
          return a + (b * b - hw * hw);
        }, 0);
        assert.ok(Math.abs(b * b - h * h - jumlah) < 1e-9);
      }
  });

  it("arsir sinyal hanya bila ada titik kering (bebas) atau di bawah atap (tertekan)", () => {
    const aman = mukaSumur(keadaanTertekan(TIGA));
    assert.equal(aman.medan.bawahAtap, false);
    assert.equal(aman.muka.filter((f) => f.arsir === "sinyal").length, 0);
    // Q besar: muka piezometrik turun di bawah atap di sekitar sumur.
    const besar = mukaSumur(keadaanTertekan([{ x: 0, y: 0, Q: 0.03 }, { x: 20, y: 0, Q: 0.03 }]));
    assert.equal(besar.medan.bawahAtap, true);
    assert.ok(besar.muka.some((f) => f.arsir === "sinyal"));
    const kering = mukaSumur(keadaanBebas([{ x: 0, y: 0, Q: 0.03 }, { x: 15, y: 10, Q: 0.03 }]));
    assert.equal(kering.medan.adaKering, true);
    assert.ok(kering.muka.some((f) => f.arsir === "sinyal"));
  });
});

describe("drawIsoSumur: gambar", () => {
  it("skala tegak dari deret dan selalu ditulis di gambar", () => {
    const st = keadaanTertekan(SATU);
    const ve = skalaTegak(st);
    assert.equal(ve, 10);
    const { ctx, teks } = kanvas();
    const out = drawIsoSumur(ctx, 960, 520, st, TEKS);
    assert.equal(out.VE, 10);
    assert.ok(teks.includes("skala tegak ×10"), teks.join(" | "));
    // R lebar, akuifer tipis: dilebihkan lebih banyak, tetap tertulis.
    assert.equal(skalaTegak({ zAwal: 4, L: 2000 }), 500);
    assert.equal(skalaTegak({ zAwal: 1000, L: 50 }), 1);
  });

  it("garis kontur di layar = proyeksi titik dunia (garisDalam ikut kamera)", () => {
    const k: Kamera = { yaw: 0.4, pitch: 0.7, skala: 2, cx: 100, cy: 200 };
    const f: Muka = {
      pts: [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]],
      garis: null,
      garisDalam: [{ pts: [[1, 2, 3], [4, 5, 6]], garis: "#000", bobot: W.thin }],
    };
    const { ctx, garis } = kanvas();
    gambarMuka(ctx, [f], k);
    const a = proyeksi([1, 2, 3], k);
    const c = proyeksi([4, 5, 6], k);
    const ada = (p: { x: number; y: number }) => garis.some(([x, y]) => Math.abs(x - p.x) < 1e-9 && Math.abs(y - p.y) < 1e-9);
    assert.ok(ada(a) && ada(c));
  });

  it("anchor sumur dibalik ke letak sumur (pegangan seret di bidang muka air awal)", () => {
    const st = keadaanTertekan(TIGA);
    for (const [yaw, pitch] of [[-ISO.yaw, ISO.pitch], [0.3, 0.3], [2.5, 1.2]]) {
      const { ctx } = kanvas();
      const out = drawIsoSumur(ctx, 960, 520, st, TEKS, { yaw, pitch });
      st.wells.forEach((w, i) => {
        const A = out.anchors![anchorSumur(i)];
        const v = balikSumur(A.x, A.y, out.kamera, st)!;
        assert.ok(Math.abs(v[0] - w.x) < 1e-6 && Math.abs(v[1] - w.y) < 1e-6, `${v} vs ${w.x},${w.y}`);
      });
    }
  });

  it("seluruh benda di dalam kanvas 960×520 dan 390×300 pada beberapa sudut", () => {
    for (const st of [keadaanTertekan(TIGA), keadaanBebas(SATU)]) {
      const ms = mukaSumur(st);
      for (const [w, h] of [[960, 520], [390, 300]])
        for (const [yaw, pitch] of [[-ISO.yaw, ISO.pitch], [1.2, 0.2], [3, 1.39]]) {
          const k = kameraSumur(st, w, h, yaw, pitch);
          for (const f of ms.muka)
            for (const p of f.pts) {
              const q = proyeksi(p, k);
              assert.ok(q.x >= -1e-6 && q.x <= w + 1e-6 && q.y >= -1e-6 && q.y <= h + 1e-6, `${w}×${h} ${q.x},${q.y}`);
            }
        }
    }
  });

  it("kinerja: kisi 40 × 40 dengan lima sumur di bawah 4 ms per bingkai (kanvas palsu)", (t) => {
    const st = keadaanTertekan([
      ...TIGA,
      { x: 300, y: 300, Q: 0.02 },
      { x: -300, y: -250, Q: 0.02 },
    ]);
    const ms = mukaSumur(st);
    assert.ok(ms.permukaan.length <= 1600);
    const { ctx } = kanvas();
    const nop = () => {};
    // Kanvas tanpa pencatat: hanya kerja JS penggambar.
    const kosong = { ...(ctx as unknown as Record<string, unknown>), moveTo: nop, lineTo: nop, fillText: nop } as unknown as CanvasRenderingContext2D;
    for (let i = 0; i < 20; i++) drawIsoSumur(kosong, 960, 520, st, TEKS, { yaw: i * 0.05 });
    const N = 20;
    let per = Infinity;
    for (let batch = 0; batch < 8; batch++) {
      const t0 = performance.now();
      for (let i = 0; i < N; i++) drawIsoSumur(kosong, 960, 520, st, TEKS, { yaw: -ISO.yaw + (batch * N + i) * 0.02 });
      per = Math.min(per, (performance.now() - t0) / N);
    }
    t.diagnostic(`GW-02 isometrik: ${per.toFixed(2)} ms kerja JS per bingkai, ${ms.muka.length} muka`);
    assert.ok(per < 4, `${per.toFixed(2)} ms`);
  });
});
