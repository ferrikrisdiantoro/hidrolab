import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  drawIsoPelimpah,
  geometriPelimpah,
  mukaPelimpah,
  rasioIsoPelimpah,
  skalaTegak,
  MARGIN_ISO_PELIMPAH,
  RUANG_JUDUL_ISO_PELIMPAH,
  type IsoPelimpahState,
} from "./drawIsoPelimpah.ts";
import { sideChannelProfile } from "./hydraulics.ts";
import { ISO, anchor3, gambarMuka, kameraPas, normalMuka, type Kamera } from "./proyeksi.ts";

/*
 * HS-10 3D: pelimpah saluran samping isometrik, STATIS (model tunak).
 * Yang diuji: muka air = profil Hinds model di SETIAP stasiun, geometri =
 * masukan model, keadaan hulu superkritis jujur, gambar di dalam kanvas,
 * dan anggaran bingkai saat diputar.
 */

const dasar: IsoPelimpahState = { Q: 50, b: 6, n: 0.014, S0: 0.005, L: 60, zCrest: 4.5 };
const kecil: IsoPelimpahState = { Q: 20, b: 4, n: 0.014, S0: 0.002, L: 40, zCrest: 3.2 };
const besar: IsoPelimpahState = { Q: 150, b: 10, n: 0.014, S0: 0.008, L: 120, zCrest: 7 };
const sempit: IsoPelimpahState = { Q: 80, b: 3, n: 0.014, S0: 0.005, L: 50, zCrest: 4.5 };
const ekstrem: IsoPelimpahState = { Q: 300, b: 1, n: 0.03, S0: 0.04, L: 200, zCrest: 1 };
const lebar: IsoPelimpahState = { Q: 2, b: 20, n: 0.011, S0: 0.0005, L: 10, zCrest: 15 };
/** Hulu superkritis sebagian (berhenti 49 m dari pangkal) dan seluruhnya. */
const curam: IsoPelimpahState = { Q: 2, b: 1, n: 0.02, S0: 0.03, L: 120, zCrest: 3 };
const seluruh: IsoPelimpahState = { Q: 10, b: 12, n: 0.011, S0: 0.04, L: 120, zCrest: 8 };

const model = (s: IsoPelimpahState) => sideChannelProfile(s.Q, s.b, s.n, s.S0, s.L);
const DEKAT = 1e-9;

function kanvas() {
  const st: Record<string, unknown> = { fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "left" };
  const nop = () => {};
  return new Proxy(st, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k === "measureText") return () => ({ width: 6 });
      return nop;
    },
    set(t, k: string, v) {
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe("HS-10 3D: muka air = sideChannelProfile di semua stasiun", () => {
  for (const s of [dasar, kecil, besar, sempit, ekstrem, lebar]) {
    it(`muka atas air tepat di ws model, Q ${s.Q} b ${s.b} L ${s.L}`, () => {
      const r = model(s);
      const ev = skalaTegak(s);
      const atas = mukaPelimpah(s).muka.filter((m) => m.bagian === "air-atas");
      assert.equal(atas.length, 1, "satu poligon muka air");
      assert.equal(atas[0].pts.length, 2 * r.points.length, "tepat stasiun model di kedua tepi, tanpa sisipan");
      // Tiap stasiun model muncul di kedua tepi saluran, z = ws·ev.
      for (const p of r.points)
        for (const y of [0, s.b]) {
          const ada = atas.some((m) =>
            m.pts.some((q) => Math.abs(q[0] - p.x) < DEKAT && Math.abs(q[1] - y) < DEKAT && Math.abs(q[2] - p.ws * ev) < DEKAT)
          );
          assert.ok(ada, `stasiun x ${p.x} y ${y} tidak di ws ${p.ws}`);
        }
      // Tidak ada titik muka air yang bukan stasiun model.
      for (const m of atas)
        for (const q of m.pts) {
          const p = r.points.find((pp) => Math.abs(pp.x - q[0]) < DEKAT);
          assert.ok(p, `x ${q[0]} bukan stasiun model`);
          assert.ok(Math.abs(q[2] / ev - p.ws) < DEKAT);
        }
    });
  }

  it("penampang kendali di x = L setinggi kedalaman kritis ycOut di atas dasar ujung keluar", () => {
    const r = model(dasar);
    const ev = skalaTegak(dasar);
    const ujung = mukaPelimpah(dasar).muka.find((m) => m.bagian === "air-kendali");
    assert.ok(ujung);
    const zs = ujung.pts.map((q) => q[2] / ev);
    assert.ok(ujung.pts.every((q) => Math.abs(q[0] - dasar.L) < DEKAT));
    assert.ok(Math.abs(Math.max(...zs) - r.ycOut) < DEKAT);
    assert.ok(Math.abs(Math.min(...zs)) < DEKAT);
    // Menghadap hilir (+x).
    assert.ok(normalMuka(ujung.pts)[0] > 0.99);
  });
});

describe("HS-10 3D: geometri = masukan model", () => {
  for (const s of [dasar, besar, ekstrem]) {
    it(`dasar z = zb model, lebar b, mercu sepanjang L pada z_m (Q ${s.Q}, L ${s.L})`, () => {
      const r = model(s);
      const ev = skalaTegak(s);
      const { muka } = mukaPelimpah(s);
      const dasarAtas = muka.filter((m) => m.bagian === "dasar-atas");
      assert.ok(dasarAtas.length > 0);
      for (const m of dasarAtas)
        for (const q of m.pts) {
          assert.ok(q[0] >= -DEKAT && q[0] <= s.L + DEKAT);
          assert.ok(Math.abs(q[2] / ev - s.S0 * (s.L - q[0])) < 1e-9, `dasar x ${q[0]}`);
          assert.ok(Math.abs(q[1]) < DEKAT || Math.abs(q[1] - s.b) < DEKAT);
        }
      // Dasar model di tiap stasiun = garis dasar yang digambar.
      for (const p of r.points) assert.ok(Math.abs(p.zb - s.S0 * (s.L - p.x)) < 1e-9);

      // Air hanya di antara dinding, 0..b.
      for (const m of muka.filter((m) => m.bagian.startsWith("air")))
        for (const q of m.pts) assert.ok(q[1] >= -DEKAT && q[1] <= s.b + DEKAT);

      // Puncak mercu: z_m, dari pangkal x = 0 sampai ujung keluar x = L.
      const puncak = muka.filter((m) => m.bagian === "mercu-puncak");
      assert.ok(puncak.length > 0);
      let x0 = Infinity, x1 = -Infinity;
      for (const m of puncak)
        for (const q of m.pts) {
          assert.ok(Math.abs(q[2] / ev - s.zCrest) < DEKAT);
          assert.ok(q[1] <= DEKAT, "mercu di sisi waduk (y ≤ 0)");
          x0 = Math.min(x0, q[0]);
          x1 = Math.max(x1, q[0]);
        }
      assert.ok(Math.abs(x0) < DEKAT && Math.abs(x1 - s.L) < DEKAT, `panjang mercu ${x1 - x0} lawan L ${s.L}`);

      const g = geometriPelimpah(s);
      assert.equal(g.ev, ev);
      assert.ok(g.chuteLength > 0 && g.chuteDrop > 0);
    });
  }

  it("muka atas (dasar, peluncur, air, arsir) menghadap ke atas, jadi tidak dibuang sebagai muka belakang", () => {
    for (const s of [dasar, curam, { ...dasar, zCrest: 2.5 }]) {
      const atas = mukaPelimpah(s).muka.filter((m) =>
        ["dasar-atas", "dasar-peluncur", "dasar-sinyal", "air-atas", "air-tenggelam"].includes(m.bagian) && !m.tepi
      );
      assert.ok(atas.length >= 3);
      for (const m of atas) assert.ok(normalMuka(m.pts)[2] > 0.5, `${m.bagian} normal ${normalMuka(m.pts)}`);
    }
  });

  it("skala tegak bulat, 1 bila tidak perlu dilebihkan, paling besar 4", () => {
    for (const s of [dasar, kecil, besar, sempit, ekstrem, lebar, curam]) {
      const ev = skalaTegak(s);
      assert.ok(Number.isInteger(ev) && ev >= 1 && ev <= 4, `${ev}`);
    }
    assert.equal(skalaTegak(lebar), 1);
  });

  it("muka dinding dalam tidak turun di bawah muka air (tidak menutupi air dari belakang)", () => {
    const r = model(dasar);
    const ev = skalaTegak(dasar);
    const dalam = mukaPelimpah(dasar).muka.filter((m) => m.bagian === "seberang-dalam");
    assert.ok(dalam.length >= 1);
    for (const m of dalam)
      for (const q of m.pts) {
        const p = r.points.find((pp) => Math.abs(pp.x - q[0]) < DEKAT);
        if (p) assert.ok(q[2] / ev >= p.ws - DEKAT, `x ${q[0]}: ${q[2] / ev} < ws ${p.ws}`);
      }
  });
});

describe("HS-10 3D: hulu superkritis tidak digambar airnya", () => {
  it("contoh curam benar-benar superkritis di hulu", () => {
    const r = model(curam);
    assert.ok(r.supercriticalFrom !== null && r.supercriticalFrom > 0 && r.supercriticalFrom < curam.L);
  });

  it("tidak ada muka air di hulu titik berhenti; arsir sinyal di dasar hulunya", () => {
    const r = model(curam);
    const x0 = r.points[0].x;
    const { muka } = mukaPelimpah(curam);
    for (const m of muka.filter((m) => m.bagian.startsWith("air")))
      for (const q of m.pts) assert.ok(q[0] >= x0 - DEKAT, `air di x ${q[0]} < ${x0}`);
    const sinyal = muka.filter((m) => m.arsir === "sinyal");
    assert.ok(sinyal.length > 0);
    for (const m of sinyal) for (const q of m.pts) assert.ok(q[0] <= x0 + DEKAT);
  });

  it("seluruh saluran superkritis: nol muka air, seluruh dasar diarsir sinyal", () => {
    const r = model(seluruh);
    assert.equal(r.supercriticalFrom, seluruh.L);
    const { muka } = mukaPelimpah(seluruh);
    assert.equal(muka.filter((m) => m.bagian.startsWith("air")).length, 0);
    let x1 = 0;
    for (const m of muka.filter((m) => m.arsir === "sinyal")) for (const q of m.pts) x1 = Math.max(x1, q[0]);
    assert.ok(Math.abs(x1 - seluruh.L) < DEKAT);
  });

  it("aliran normal: tanpa arsir sinyal", () => {
    assert.equal(mukaPelimpah(dasar).muka.filter((m) => m.arsir === "sinyal").length, 0);
  });
});

describe("HS-10 3D: gambar", () => {
  for (const s of [dasar, besar, ekstrem, lebar, curam, seluruh])
    for (const [w, h] of [
      [960, 520],
      [390, 300],
    ])
      it(`semua titik dan tulisan di dalam ${w}×${h} (Q ${s.Q}, L ${s.L})`, () => {
        const out = drawIsoPelimpah(kanvas(), w, h, s, {
          heading: "tampak isometrik",
          label: { crest: "mercu", trough: "saluran pengumpul", control: "kendali", chute: "peluncur", inflow: "aliran masuk", profileEnds: "profil berakhir", exagg: "skala tegak" },
        });
        let n = 0;
        for (const m of mukaPelimpah(s).muka)
          for (const p of m.pts) {
            const a = anchor3(p, out.kamera);
            assert.ok(a.x >= -1e-6 && a.x <= w + 1e-6 && a.y >= -1e-6 && a.y <= h + 1e-6, `${a.x},${a.y}`);
            n++;
          }
        assert.ok(n > 200);
        for (const b of out.labels ?? []) assert.ok(b.x >= -1e-6 && b.x + b.w <= w + 1e-6 && b.y >= -1e-6 && b.y + b.h <= h + 1e-6, JSON.stringify(b));
      });

  it("tinggi bidang dari kotak batas: 342 px lebar mengisi tinggi yang tersedia", () => {
    const r = rasioIsoPelimpah(dasar);
    assert.ok(r > 0.15 && r < 1.5, `rasio ${r}`);
    const w = 342;
    const h = r * (w - 2 * MARGIN_ISO_PELIMPAH) + 2 * MARGIN_ISO_PELIMPAH + RUANG_JUDUL_ISO_PELIMPAH;
    const { batas } = mukaPelimpah(dasar);
    const k = kameraPas(batas, w, h - RUANG_JUDUL_ISO_PELIMPAH, -ISO.yaw, ISO.pitch, MARGIN_ISO_PELIMPAH);
    const kW = kameraPas(batas, w, 1e6, -ISO.yaw, ISO.pitch, MARGIN_ISO_PELIMPAH);
    assert.ok(Math.abs(k.skala - kW.skala) / kW.skala < 1e-6);
  });

  it("anggaran bingkai: memutar gambar terberat jauh di bawah 16,7 ms", (t) => {
    const s = besar;
    const { muka } = mukaPelimpah(s);
    const nop = () => {};
    const kosong = {
      fillStyle: "", strokeStyle: "", lineWidth: 1, lineCap: "butt", lineJoin: "miter", globalAlpha: 1,
      save: nop, restore: nop, beginPath: nop, moveTo: nop, lineTo: nop, closePath: nop,
      fill: nop, stroke: nop, rect: nop, clip: nop, setLineDash: nop,
    } as unknown as CanvasRenderingContext2D;
    const kam: Kamera = { yaw: -ISO.yaw, pitch: ISO.pitch, skala: 4, cx: 480, cy: 260 };
    for (let i = 0; i < 20; i++) gambarMuka(kosong, muka, kam);
    const N = 20;
    let perBingkai = Infinity;
    for (let batch = 0; batch < 8; batch++) {
      const t0 = performance.now();
      for (let i = 0; i < N; i++) {
        kam.yaw = -ISO.yaw + (batch * N + i) * 0.03;
        gambarMuka(kosong, mukaPelimpah(s, kam.yaw).muka, kam);
      }
      perBingkai = Math.min(perBingkai, (performance.now() - t0) / N);
    }
    t.diagnostic(`${muka.length} muka: ${perBingkai.toFixed(2)} ms kerja JS per bingkai`);
    assert.ok(perBingkai < 4, `kerja JS ${perBingkai.toFixed(2)} ms per bingkai`);
    // Dibangun sekali per masukan dan kuadran pandang (cache), bukan per bingkai.
    assert.equal(mukaPelimpah(s).muka, mukaPelimpah(s).muka);
  });

  it("urutan lapis mengikuti sisi pengamat: dinding sisi pengamat sesudah air, sisi jauh sebelum", () => {
    const lapis = (yaw: number, bagian: string) => mukaPelimpah(dasar, yaw).muka.find((m) => m.bagian === bagian)!.lapis ?? 0;
    // yaw −45°: pengamat di sisi waduk (−y) dan hilir (+x).
    const y0 = -ISO.yaw;
    assert.ok(lapis(y0, "mercu-luar") > lapis(y0, "air-atas"));
    assert.ok(lapis(y0, "seberang-luar") < lapis(y0, "air-atas"));
    assert.ok(lapis(y0, "peluncur-luar") > lapis(y0, "air-atas"));
    // Diputar ke seberang (+y) dan hulu (−x).
    const y1 = y0 + Math.PI;
    assert.ok(lapis(y1, "mercu-luar") < lapis(y1, "air-atas"));
    assert.ok(lapis(y1, "seberang-luar") > lapis(y1, "air-atas"));
    assert.ok(lapis(y1, "peluncur-luar") < lapis(y1, "air-atas"));
    assert.ok(lapis(y1, "pangkal-luar") > lapis(y1, "air-atas"));
  });
});

void anchor3;
