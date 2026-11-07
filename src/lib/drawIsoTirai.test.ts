import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  airSiklusHulu,
  drawIsoLabirin,
  mukaLabirin,
  tebalDinding,
  tiraiLabirin,
  type ElemenTirai,
} from "./drawIsoLabirin.ts";
import { labyrinthWeir, wesNappe, WES_K, WES_N } from "./hydraulics.ts";
import { nappeHeadwater } from "./drawNappe.ts";
import { ISO, anchor3, gambarMuka, type Kamera } from "./proyeksi.ts";
import { W as BOBOT } from "./theme.ts";

/*
 * HS-02 3D putaran 2: tirai luapan (spesifikasi 3D-HS02-TIRAI bagian A-D).
 * Uji D1-D6 dari spesifikasi insinyur, ditambah anggaran bingkai saat
 * gambar diputar.
 */

type St = { h: number; P: number; W: number; cycles: number; B: number; outOfRange: boolean };
const dasar: St = { h: 0.8, P: 2, W: 30, cycles: 6, B: 6, outOfRange: false };
const pada = (hP: number, P = 2): St => ({ ...dasar, P, h: hP * P });

/** Jarak mendatar titik ke garis tengah elemen dindingnya (ruas: tegak lurus, sudut: ke titik sudut). */
function jarak(p: readonly number[], e: ElemenTirai): number {
  if (e.jenis === "ruas") return (p[0] - e.a.x) * e.n.x + (p[1] - e.a.y) * e.n.y;
  return Math.hypot(p[0] - e.v.x, p[1] - e.v.y);
}

const dUjung = (h: number, P: number) => Math.pow(WES_K * Math.pow(h, WES_N - 1) * P, 1 / WES_N);

describe("tirai labirin: lintasan dari wesNappe (D1, D2)", () => {
  for (const hP of [0.4, 0.95]) {
    it(`D1 sisi bawah z = P − wesNappe(h, d), h/P ${hP}`, () => {
      const s = pada(hP);
      const T = tiraiLabirin(s);
      const t = tebalDinding(s.W, s.cycles);
      const bawah = T.lembar.filter((l) => l.sisi === "bawah");
      assert.ok(bawah.length > 0);
      let n = 0;
      for (const l of bawah)
        for (const p of l.pts) {
          const d = jarak(p, l.elemen) - t / 2;
          assert.ok(d > -1e-9, `titik di dalam dinding: d ${d}`);
          const z = Math.max(s.P - wesNappe(s.h, Math.max(d, 0)), 0);
          assert.ok(Math.abs(p[2] - z) < 1e-9, `z ${p[2]} lawan ${z} (d ${d})`);
          n++;
        }
      assert.ok(n > 50);
    });

    it(`D2 jangkauan di lantai = d_end, h/P ${hP}`, () => {
      const s = pada(hP);
      const T = tiraiLabirin(s);
      const t = tebalDinding(s.W, s.cycles);
      const de = dUjung(s.h, s.P);
      assert.ok(Math.abs(T.dEnd - de) < 1e-9);
      let maks = 0;
      let diLantai = 0;
      for (const l of T.lembar)
        if (l.sisi === "bawah")
          for (const p of l.pts) {
            const d = jarak(p, l.elemen) - t / 2;
            maks = Math.max(maks, d);
            if (Math.abs(d - de) < 1e-9 && Math.abs(p[2]) < 1e-9) diLantai++;
          }
      assert.ok(Math.abs(maks - de) < 1e-9, `${maks} vs ${de}`);
      assert.ok(diLantai > 0, "ujung sisi bawah menyentuh lantai di d_end");
    });
  }

  it("tebal lembaran dari nappeThickness dengan q = Q / panjang mercu", () => {
    const s = pada(0.4);
    const r = labyrinthWeir(s.h, s.P, s.W, s.cycles, s.B);
    const T = tiraiLabirin(s);
    assert.ok(Math.abs(T.q - r.Q / r.crestLength) < 1e-12);
  });
});

describe("tirai labirin: penempatan (D3)", () => {
  for (const hP of [0.4, 0.95]) {
    it(`D3 tidak melewati bidang sumbu siklus hilir, tidak di sisi normal kiri, h/P ${hP}`, () => {
      const s = pada(hP);
      const T = tiraiLabirin(s);
      const w = s.W / s.cycles;
      const t = tebalDinding(s.W, s.cycles);
      for (const l of T.lembar) {
        const e = l.elemen;
        const lo = e.siklus * w;
        const hi = (e.siklus + 1) * w;
        for (const p of l.pts) {
          assert.ok(p[1] >= lo - 1e-9 && p[1] <= hi + 1e-9, `y ${p[1]} di luar [${lo}, ${hi}]`);
          assert.ok(p[0] > 0, "tidak ada tirai di kolam hulu");
          if (e.jenis === "ruas") {
            assert.ok(jarak(p, e) >= t / 2 - 1e-9, "sisi normal kanan (hilir)");
          } else {
            const a = (p[0] - e.v.x) * Math.cos(e.th0) + (p[1] - e.v.y) * Math.sin(e.th0);
            const b = (p[0] - e.v.x) * Math.cos(e.th0 + e.dth) + (p[1] - e.v.y) * Math.sin(e.th0 + e.dth);
            assert.ok(a >= -1e-9 && b >= -1e-9, "sudut cembung: di antara kedua normal kanan");
          }
        }
      }
    });
  }

  it("sudut diputar hanya di sudut cembung x = B, tidak ada tirai dari titik V", () => {
    const T = tiraiLabirin(dasar);
    const sudut = new Set<string>();
    for (const l of T.lembar)
      if (l.elemen.jenis === "sudut") {
        assert.equal(l.elemen.v.x, dasar.B);
        assert.ok(l.elemen.dth > 0 && l.elemen.dth < Math.PI);
        sudut.add(`${l.elemen.v.x},${l.elemen.v.y}`);
      }
    assert.equal(sudut.size, 2 * dasar.cycles);
  });

  it("garis temu di tiap bidang sumbu siklus hilir dalam, di y = (i+1)·w", () => {
    const T = tiraiLabirin(dasar);
    const w = dasar.W / dasar.cycles;
    assert.equal(T.temu.length, dasar.cycles - 1);
    T.temu.forEach((g, i) => {
      assert.ok(g.length >= 2);
      for (const p of g) assert.ok(Math.abs(p[1] - (i + 1) * w) < 1e-9);
    });
  });

  it("air siklus hulu dari nappeHeadwater: P + h jauh dari dinding, P + 0,85h di mercu", () => {
    const s = { ...dasar, B: 9 }; // α 7,9°, siklus panjang: ada titik ≥ 2h dari dinding
    const air = airSiklusHulu(s);
    assert.equal(air.length > 0, true);
    for (const m of air) for (const p of m.pts) assert.ok(p[0] >= 0 && p[0] <= s.B);
    const z = air.flatMap((m) => m.pts.map((p) => p[2]));
    const zMaks = Math.max(...z);
    const zMin = Math.min(...z);
    assert.ok(Math.abs(zMaks - (s.P + s.h)) < 1e-9, `${zMaks}`);
    assert.ok(Math.abs(zMin - nappeHeadwater(s.h, s.P, 0)) < 1e-9, `${zMin}`);
  });
});

describe("tirai labirin: arsir bertemu dan keadaan tanpa tirai (D4, D5)", () => {
  const sinyal = (s: St) => mukaLabirin(s).muka.filter((m) => m.arsir === "sinyal").length;

  it("D4 muka arsir > 0 hanya bila interference (h/P 0,5 lawan 0,95)", () => {
    for (const hP of [0.5, 0.95]) {
      const s = pada(hP);
      const r = labyrinthWeir(s.h, s.P, s.W, s.cycles, s.B);
      assert.equal(sinyal(s) > 0, r.interference, `h/P ${hP}`);
    }
    assert.equal(sinyal(pada(0.5)), 0);
    assert.ok(sinyal(pada(0.95)) > 0);
  });

  it("D5 siklus sempit atau h = 0: nol lembaran, nol arsir", () => {
    const sempit = { ...dasar, cycles: 16 }; // w/P 0,94 < 2
    const r = labyrinthWeir(sempit.h, sempit.P, sempit.W, sempit.cycles, sempit.B);
    assert.ok(r.cycleTooNarrow || r.sidewallTooSharp);
    assert.equal(tiraiLabirin(sempit).lembar.length, 0);
    assert.equal(tiraiLabirin({ ...dasar, B: 40 }).lembar.length, 0, "sudut dinding < 6°");
    assert.equal(tiraiLabirin({ ...dasar, h: 0 }).lembar.length, 0);
    assert.equal(sinyal({ ...sempit, h: 1.9 }), 0);
  });
});

function kanvas() {
  const st: Record<string, unknown> = { fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "left" };
  const nop = () => {};
  const ctx = new Proxy(st, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k === "measureText") return () => ({ width: 6 });
      return nop;
    },
    set(t, k: string, v) {
      t[k] = v;
      return true;
    },
  });
  return ctx as unknown as CanvasRenderingContext2D;
}

describe("tirai labirin: di dalam kanvas (D6) dan anggaran bingkai", () => {
  for (const s of [pada(0.4), pada(0.95), { ...dasar, h: 4, P: 8, W: 60, cycles: 3, B: 20 }])
    for (const [w, h] of [
      [960, 520],
      [390, 300],
    ])
      it(`D6 semua titik di dalam ${w}×${h} (h ${s.h}, P ${s.P})`, () => {
        const out = drawIsoLabirin(kanvas(), w, h, s, { heading: "uji", labelBertemu: "tirai bertemu (h/P > 0,9)" });
        let n = 0;
        for (const m of mukaLabirin(s).muka)
          for (const p of m.pts) {
            const a = anchor3(p, out.kamera);
            assert.ok(a.x >= -1e-6 && a.x <= w + 1e-6 && a.y >= -1e-6 && a.y <= h + 1e-6, `${a.x},${a.y}`);
            n++;
          }
        assert.ok(n > 500);
        // Tulisan zona bertemu di dalam bidang juga.
        for (const b of out.labels ?? []) assert.ok(b.x >= 0 && b.x + b.w <= w && b.y >= 0 && b.y + b.h <= h);
        assert.equal((out.labels ?? []).length, s.h / s.P > 0.9 ? 2 : 1, "judul, dan nama zona hanya bila bertemu");
      });

  it("anggaran bingkai: memutar gambar terberat (16 siklus lebar, tirai) jauh di bawah 16,7 ms", (t) => {
    // Siklus terbanyak yang masih bertirai: W 120, N 16 (w 7,5 m, P 2).
    const s = { ...dasar, W: 120, cycles: 16, B: 12, h: 1.9 };
    const r = labyrinthWeir(s.h, s.P, s.W, s.cycles, s.B);
    assert.ok(!(r.cycleTooNarrow || r.sidewallTooSharp));
    const { muka } = mukaLabirin(s);
    const nop = () => {};
    const kosong = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      lineCap: "butt",
      lineJoin: "miter",
      globalAlpha: 1,
      save: nop,
      restore: nop,
      beginPath: nop,
      moveTo: nop,
      lineTo: nop,
      closePath: nop,
      fill: nop,
      stroke: nop,
      rect: nop,
      clip: nop,
      setLineDash: nop,
    } as unknown as CanvasRenderingContext2D;
    const kam: Kamera = { yaw: -ISO.yaw, pitch: ISO.pitch, skala: 8, cx: 480, cy: 260 };
    for (let i = 0; i < 20; i++) gambarMuka(kosong, muka, kam);
    const N = 20;
    let perBingkai = Infinity;
    for (let batch = 0; batch < 8; batch++) {
      const t0 = performance.now();
      for (let i = 0; i < N; i++) {
        kam.yaw = -ISO.yaw + (batch * N + i) * 0.02;
        gambarMuka(kosong, muka, kam);
      }
      perBingkai = Math.min(perBingkai, (performance.now() - t0) / N);
    }
    t.diagnostic(`${muka.length} muka: ${perBingkai.toFixed(2)} ms kerja JS per bingkai`);
    assert.ok(perBingkai < 4, `kerja JS ${perBingkai.toFixed(2)} ms per bingkai`);
    // Muka dibangun sekali per masukan (cache), bukan per bingkai.
    assert.equal(mukaLabirin(s).muka, muka);
    assert.ok(BOBOT.hair > 0);
  });
});
