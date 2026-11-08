import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  drawIsoFlum,
  mukaFlum,
  pelebihanTegak,
  profilFlum,
  rasioIsoFlum,
  stasiunFlum,
  sumbuLeherFlum,
  type IsoFlumState,
} from "./drawIsoFlum.ts";
import { flumeDischarge, type FlumeResult } from "./hydraulics.ts";
import {
  ISO,
  anchor3,
  arahPandang,
  balikDiGarisSumbu,
  gambarMuka,
  proyeksi,
  sumbuGaris,
  urutMuka,
  type Kamera,
} from "./proyeksi.ts";

/*
 * FM-04 isometrik: geometri flum dan muka air dari model flumeDischarge,
 * profil sama dengan potongan memanjang, pegangan lebar leher = penggeser.
 */

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

const DASAR: IsoFlumState = { h1: 0.3, b: 0.6, B: 1.2, p: 0.25, Lt: 0.9, Cd: 0.99, tail: 0.25 };
const tol = 1e-9;

/** Salinan susun() lama FlumLeherPanjangClient (sebelum 3D), untuk bukti potongan tidak berubah. */
function susunLama(r: FlumeResult, h1: number, p: number, Lt: number, tail: number, tenggelam: boolean) {
  const xDatang = 2.5 * Lt;
  const a1 = xDatang;
  const a2 = a1 + 1.0 * Lt;
  const a3 = a2 + Lt;
  const a4 = a3 + 2.0 * Lt;
  const L = a4 + 1.5 * Lt;
  const bed = [
    { x: 0, z: 0 },
    { x: a1, z: 0 },
    { x: a2, z: p },
    { x: a3, z: p },
    { x: a4, z: 0 },
    { x: L, z: 0 },
  ];
  const xUkur = Math.max(0.4 * Lt, a1 - 2.5 * h1);
  const zUkur = p + h1;
  const zKritis = p + r.yc;
  const air: { x: number; z: number; invalid?: boolean }[] = [{ x: 0, z: zUkur }, { x: xUkur, z: zUkur }];
  for (let i = 1; i <= 20; i++) {
    const f = i / 20;
    const xx = xUkur + (a2 - xUkur) * f;
    air.push({ x: xx, z: zUkur - (zUkur - zKritis) * f * f, invalid: tenggelam || undefined });
  }
  air.push({ x: a3, z: zKritis, invalid: tenggelam || undefined });
  const zAkhir = Math.max(tail, 0.02);
  for (let i = 1; i <= 16; i++) {
    const f = i / 16;
    const xx = a3 + (a4 - a3) * f;
    air.push({ x: xx, z: zKritis - (zKritis - zAkhir) * Math.sqrt(f), invalid: true });
  }
  air.push({ x: L, z: zAkhir, invalid: true });
  const water = r.controlled
    ? air
    : [
        { x: 0, z: zUkur, invalid: true },
        { x: L, z: zUkur, invalid: true },
      ];
  return { L, bed, water };
}

const KASUS: IsoFlumState[] = [
  DASAR,
  { h1: 0.12, b: 0.3, B: 0.6, p: 0.2, Lt: 0.4, Cd: 0.99, tail: 0.18 },
  { h1: 0.5, b: 1.5, B: 3, p: 0.4, Lt: 1.5, Cd: 0.99, tail: 0.4 },
  { ...DASAR, tail: 0.9 }, // tenggelam
  { ...DASAR, b: 1.2, p: 0 }, // tak terkendali / pita lebar
  { ...DASAR, b: 2 }, // leher lebih lebar dari saluran
];

function model(s: IsoFlumState) {
  const r = flumeDischarge(s.h1, s.b, s.B, s.p, s.Lt, s.Cd);
  return { r, tenggelam: r.controlled && s.tail > r.tailLimit };
}

/** Elevasi polyline muka air di x (interpolasi linear, seperti garis 2D). */
function zDi(pts: readonly { x: number; z: number }[], x: number): number {
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (x >= a.x - 1e-12 && x <= b.x + 1e-12) {
      if (b.x - a.x < 1e-15) return b.z;
      return a.z + ((b.z - a.z) * (x - a.x)) / (b.x - a.x);
    }
  }
  return NaN;
}

describe("FM-04 isometrik: profil sama dengan potongan (tampak Potongan tidak berubah)", () => {
  for (const s of KASUS)
    it(`profilFlum = susun lama (b ${s.b}, p ${s.p}, y_h ${s.tail})`, () => {
      const { r, tenggelam } = model(s);
      const lama = susunLama(r, s.h1, s.p, s.Lt, s.tail, tenggelam);
      const baru = profilFlum(r, s.h1, s.p, s.Lt, s.tail, tenggelam);
      assert.deepEqual(baru.bed, lama.bed);
      assert.deepEqual(baru.water, lama.water);
      assert.equal(stasiunFlum(s.Lt).L, lama.L);
    });
});

describe("FM-04 isometrik: geometri = model", () => {
  for (const s of KASUS)
    it(`lebar, panjang, mercu, dan muka air dari model (b ${s.b}, B ${s.B}, p ${s.p})`, () => {
      const { r, tenggelam } = model(s);
      const g = mukaFlum(s, -1);
      const ex = g.ex;
      const st = stasiunFlum(s.Lt);
      // Leher: sepanjang Lt, lebar b, mercu di p.
      assert.ok(Math.abs(st.a3 - st.a2 - s.Lt) < tol);
      const dindingLeher = g.peran
        .map((p, i) => (p === "dinding-dalam" ? g.muka[i] : null))
        .filter((m) => m !== null)
        .flatMap((m) => m!.pts)
        .filter((q) => q[0] >= st.a2 - 1e-9 && q[0] <= st.a3 + 1e-9);
      for (const q of dindingLeher) assert.ok(Math.abs(Math.abs(q[1]) - s.b / 2) < tol, `y ${q[1]}`);
      const dindingHulu = g.peran
        .map((p, i) => (p === "dinding-dalam" ? g.muka[i] : null))
        .filter((m) => m !== null)
        .flatMap((m) => m!.pts)
        .filter((q) => q[0] <= st.a1 + 1e-9);
      assert.ok(dindingHulu.length > 0);
      for (const q of dindingHulu) assert.ok(Math.abs(Math.abs(q[1]) - s.B / 2) < tol);
      // Lantai: mercu leher di p (dikali pelebihan tegak), hulu di 0.
      for (let i = 0; i < g.muka.length; i++) {
        if (g.peran[i] !== "lantai") continue;
        for (const q of g.muka[i].pts) {
          const zBed = q[0] <= st.a1 ? 0 : q[0] >= st.a2 && q[0] <= st.a3 ? s.p : NaN;
          if (!Number.isNaN(zBed)) assert.ok(Math.abs(q[2] - zBed * ex) < tol, `lantai x ${q[0]} z ${q[2]}`);
        }
      }
      // Muka air: tiap titik muka atas = polyline profil model (dikali ex).
      const prof = profilFlum(r, s.h1, s.p, s.Lt, s.tail, tenggelam);
      let n = 0;
      for (let i = 0; i < g.muka.length; i++) {
        if (g.peran[i] !== "air-atas") continue;
        for (const q of g.muka[i].pts) {
          assert.ok(Math.abs(q[2] - zDi(prof.water, q[0]) * ex) < 1e-9, `air x ${q[0]}`);
          n++;
        }
      }
      assert.ok(n > 0);
      if (r.controlled) {
        // Penampang ukur p + h1, leher p + yc (kritis, yc = 2/3 H1).
        const xUkur = prof.water[1].x;
        assert.ok(Math.abs(zDi(prof.water, xUkur) - (s.p + s.h1)) < tol);
        assert.ok(Math.abs(zDi(prof.water, (st.a2 + st.a3) / 2) - (s.p + r.yc)) < tol);
        assert.ok(Math.abs(r.yc - (2 / 3) * r.H1) < 1e-12);
      }
    });

  it("garis kritis dan garis energi hanya bila leher mengendalikan; tak terkendali tanpa keduanya", () => {
    const ada = mukaFlum(DASAR, -1);
    assert.ok(ada.peran.includes("garis-kritis") && ada.peran.includes("garis-energi"));
    const tak = mukaFlum({ ...DASAR, b: 2 }, -1);
    assert.ok(!tak.peran.includes("garis-kritis") && !tak.peran.includes("garis-energi"));
    const tg = mukaFlum({ ...DASAR, tail: 0.9 }, -1);
    assert.ok(!tg.peran.includes("garis-kritis"), "tenggelam: kondisi kritis hilang");
    assert.ok(tg.peran.includes("garis-energi"));
  });

  it("dinding dekat dipotong setinggi lantai, dinding jauh setinggi dinding skematik", () => {
    for (const sisi of [-1, 1] as const) {
      const g = mukaFlum(DASAR, sisi);
      for (let i = 0; i < g.muka.length; i++) {
        if (g.peran[i] !== "dinding-dalam") continue;
        for (const q of g.muka[i].pts) assert.ok(Math.sign(q[1]) === -sisi, "dinding utuh hanya di sisi jauh");
      }
    }
  });

  it("pelebihan tegak 1 pada bawaan, dilebihkan dan bulat bila flum sangat pipih", () => {
    assert.equal(pelebihanTegak(DASAR), 1);
    const pipih = { ...DASAR, h1: 0.02, p: 0, Lt: 5, b: 0.1, B: 0.15 };
    const ex = pelebihanTegak(pipih);
    assert.ok(ex > 1 && [2, 5, 10, 20, 50, 100].includes(ex), `ex ${ex}`);
  });
});

describe("FM-04 isometrik: muka menghadap pengamat", () => {
  for (const yaw of [-ISO.yaw, ISO.yaw, -2.4, 2.4])
    it(`muka yang menghadap terlihat, ujung belakang dibuang (yaw ${yaw.toFixed(2)})`, () => {
      const out = drawIsoFlum(kanvas(), 960, 520, DASAR, { yaw, pitch: ISO.pitch });
      const sisi = arahPandang(out.kamera)[1] >= 0 ? -1 : 1;
      const g = mukaFlum(DASAR, sisi as -1 | 1, out.ex);
      const tampak = new Set(urutMuka(g.muka, out.kamera));
      const ujungDepan = arahPandang(out.kamera)[0] < 0 ? stasiunFlum(DASAR.Lt).L : 0;
      for (let i = 0; i < g.muka.length; i++) {
        const p = g.peran[i];
        if (p === "lantai" || p === "dinding-dalam" || p === "dinding-atas" || p === "potong-lantai" || p === "potong-air")
          assert.ok(tampak.has(i), `${p} ${i} dibuang`);
        if (p === "ujung" || p === "air-ujung")
          assert.equal(tampak.has(i), Math.abs(g.muka[i].pts[0][0] - ujungDepan) < 1e-9, `${p} x ${g.muka[i].pts[0][0]}`);
      }
    });
});

describe("FM-04 isometrik: pegangan lebar leher = penggeser", () => {
  const kamera: [number, number][] = [
    [-ISO.yaw, ISO.pitch],
    [0, ISO.pitch],
    [ISO.yaw, 1.2],
    [-1.2, 0.3],
  ];
  for (const [yaw, pitch] of kamera)
    for (const b of [0.1, 0.6, 1.1, 2.5])
      it(`balik dari proyeksi memberi b (yaw ${yaw.toFixed(2)}, pitch ${pitch.toFixed(2)}, b ${b})`, () => {
        const s = { ...DASAR, b };
        const out = drawIsoFlum(kanvas(), 960, 520, s, { yaw, pitch });
        const a = out.anchors?.leher;
        assert.ok(a, "anchor leher ada");
        const { a: ga, b: gb } = out.garisLeher;
        assert.equal(out.sumbuLeher, sumbuGaris(out.kamera, ga, gb));
        const v = balikDiGarisSumbu(a.x, a.y, out.kamera, ga, gb, out.sumbuLeher);
        assert.ok(Math.abs(v - b) < 1e-9, `${v} vs ${b}`);
        // Jari bergerak hanya di sumbu seret (DragLayer menahan sumbu lain):
        // pegangan b' jatuh di koordinat jari pada sumbu itu.
        for (const b2 of [0.15, 0.9, 4.8]) {
          const q = anchor3([ga[0] + (gb[0] - ga[0]) * b2, ga[1] + (gb[1] - ga[1]) * b2, ga[2]], out.kamera);
          const px = out.sumbuLeher === "x" ? q.x : a.x;
          const py = out.sumbuLeher === "y" ? q.y : a.y;
          const v2 = balikDiGarisSumbu(px, py, out.kamera, ga, gb, out.sumbuLeher);
          assert.ok(Math.abs(v2 - b2) < 1e-9, `${v2} vs ${b2}`);
        }
      });

  it("sumbu seret dihitung dari yaw/pitch saja, sama dengan hasil gambar (Client tidak menunggu ref)", () => {
    for (let yaw = -3.1; yaw <= 3.1; yaw += 0.173)
      for (const pitch of [0.05, 0.3, ISO.pitch, 0.9, 1.2, 1.5])
        for (const b of [0.1, 1.1]) {
          const out = drawIsoFlum(kanvas(), 390, 300, { ...DASAR, b }, { yaw, pitch });
          assert.equal(sumbuLeherFlum(yaw, pitch), out.sumbuLeher, `yaw ${yaw.toFixed(3)}, pitch ${pitch}`);
        }
    // Kamera terkunci (skala, cx, cy lain) tidak mengubah sumbu.
    const k: Kamera = { yaw: 0.4, pitch: 0.7, skala: 37, cx: 11, cy: 300 };
    const out = drawIsoFlum(kanvas(), 960, 520, DASAR, { kunci: { kamera: k, ex: 3 } });
    assert.equal(sumbuLeherFlum(k.yaw, k.pitch), out.sumbuLeher);
  });

  it("pandangan bawaan: sumbu seret mendatar, pegangan di tepi leher sisi dekat setinggi mercu", () => {
    const out = drawIsoFlum(kanvas(), 960, 520, DASAR, {});
    assert.equal(out.sumbuLeher, "x");
    const st = stasiunFlum(DASAR.Lt);
    const p3 = proyeksi([(st.a2 + st.a3) / 2, -DASAR.b / 2, DASAR.p * out.ex], out.kamera);
    assert.ok(Math.abs(out.anchors!.leher.x - p3.x) < 1e-9 && Math.abs(out.anchors!.leher.y - p3.y) < 1e-9);
  });

  it("kamera dikunci selama seret: gambar memakai kamera yang diberikan", () => {
    const awal = drawIsoFlum(kanvas(), 960, 520, DASAR, {});
    const out = drawIsoFlum(kanvas(), 960, 520, { ...DASAR, b: 1.15 }, { kunci: { kamera: awal.kamera, ex: awal.ex } });
    assert.deepEqual(out.kamera, awal.kamera);
  });
});

describe("FM-04 isometrik: di dalam kanvas dan anggaran bingkai", () => {
  for (const s of KASUS)
    for (const [w, h] of [
      [960, 520],
      [390, 300],
    ])
      it(`semua titik di dalam ${w}×${h} (b ${s.b}, B ${s.B}, y_h ${s.tail})`, () => {
        const out = drawIsoFlum(kanvas(), w, h, s, { heading: "uji" });
        for (const sisi of [-1, 1] as const)
          for (const m of mukaFlum(s, sisi).muka)
            for (const p of m.pts) {
              const a = anchor3(p, out.kamera);
              assert.ok(a.x >= -1e-6 && a.x <= w + 1e-6 && a.y >= -1e-6 && a.y <= h + 1e-6, `${a.x},${a.y}`);
            }
        for (const b of out.labels ?? []) assert.ok(b.x >= 0 && b.x + b.w <= w && b.y >= 0 && b.y + b.h <= h);
      });

  it("rasio tinggi bidang positif dan wajar", () => {
    const r = rasioIsoFlum(DASAR);
    assert.ok(r > 0.15 && r < 1.2, `${r}`);
  });

  it("anggaran bingkai: memutar gambar jauh di bawah 16,7 ms, muka di-cache", (t) => {
    const { muka } = mukaFlum(DASAR, -1);
    const nop = () => {};
    const kosong = new Proxy({} as Record<string, unknown>, {
      get: (o, k: string) => (k in o ? o[k] : k === 'measureText' ? () => ({ width: 6 }) : nop),
      set: (o, k: string, v) => ((o[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    const kam: Kamera = { yaw: -ISO.yaw, pitch: ISO.pitch, skala: 60, cx: 480, cy: 260 };
    for (let i = 0; i < 20; i++) gambarMuka(kosong, muka, kam);
    let per = Infinity;
    for (let batch = 0; batch < 6; batch++) {
      const t0 = performance.now();
      for (let i = 0; i < 20; i++) {
        kam.yaw = -ISO.yaw + (batch * 20 + i) * 0.02;
        drawIsoFlum(kosong, 960, 520, DASAR, { yaw: kam.yaw, pitch: kam.pitch });
      }
      per = Math.min(per, (performance.now() - t0) / 20);
    }
    t.diagnostic(`${muka.length} muka: ${per.toFixed(2)} ms kerja JS per bingkai`);
    assert.ok(per < 4, `${per.toFixed(2)} ms`);
    assert.equal(mukaFlum(DASAR, -1).muka, muka);
  });
});
