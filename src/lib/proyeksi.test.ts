import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ISO,
  anchor3,
  arahPandang,
  balikDiBidangZ,
  balikDiGaris,
  gambarMuka,
  kameraPas,
  kotak,
  normalMuka,
  permukaanGrid,
  plateOut3,
  proyeksi,
  urutMuka,
  warnaMuka,
  type Kamera,
  type Muka,
  type V3,
} from "./proyeksi.ts";
import { C, W } from "./theme.ts";

/*
 * D0 proyeksi. Yang diuji: kubus (urutan kedalaman, muka belakang dibuang,
 * anchor3 = proyeksi), kameraPas memuat semua titik, simetri yaw 0/90,
 * balikan piksel ke nilai fisik, dan anggaran kerja kisi 40 x 40.
 */

type Op = { op: string; args: unknown[]; fill?: string; stroke?: string; lw?: number };

/** Kanvas palsu: merekam urutan perintah, cukup untuk menghitung operasi. */
function kanvas(): { ctx: CanvasRenderingContext2D; ops: Op[]; hitung: Record<string, number> } {
  const ops: Op[] = [];
  const hitung: Record<string, number> = {};
  const st: Record<string, unknown> = {
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    globalAlpha: 1,
    lineCap: "butt",
    lineJoin: "miter",
    font: "",
    textAlign: "left",
  };
  const rekam = (op: string) => (...args: unknown[]) => {
    hitung[op] = (hitung[op] ?? 0) + 1;
    ops.push({
      op,
      args,
      fill: st.fillStyle as string,
      stroke: st.strokeStyle as string,
      lw: st.lineWidth as number,
    });
  };
  const ctx = new Proxy(st, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k === "measureText") return () => ({ width: 5 });
      return rekam(k);
    },
    set(t, k: string, v) {
      t[k] = v;
      hitung["set:" + k] = (hitung["set:" + k] ?? 0) + 1;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops, hitung };
}

/** Kubus satuan [0,1]^3, enam muka berlawanan jarum jam dilihat dari luar. */
function kubus(): Muka[] {
  return kotak([0, 0, 0], [1, 1, 1], { satuSisi: true });
}

const K_ISO: Kamera = { yaw: ISO.yaw, pitch: ISO.pitch, skala: 100, cx: 200, cy: 150 };

describe("proyeksi", () => {
  it("titik asal jatuh di pusat kamera dan sumbu tegak naik ke atas layar", () => {
    const p = proyeksi([0, 0, 0], K_ISO);
    assert.equal(p.x, 200);
    assert.equal(p.y, 150);
    const atas = proyeksi([0, 0, 1], K_ISO);
    assert.ok(atas.y < 150, "z naik harus ke atas layar");
    assert.ok(Math.abs(atas.x - 200) < 1e-9, "z murni tidak bergeser mendatar");
  });

  it("tampak depan (yaw 0, pitch 0): x ke kanan, z ke atas, y = kedalaman", () => {
    const k: Kamera = { yaw: 0, pitch: 0, skala: 10, cx: 0, cy: 0 };
    const p = proyeksi([2, 5, 3], k);
    assert.ok(Math.abs(p.x - 20) < 1e-9);
    assert.ok(Math.abs(p.y + 30) < 1e-9);
    assert.ok(Math.abs(p.z - 5) < 1e-9, "kedalaman = jarak sepanjang arah pandang (+y)");
  });

  it("tampak atas (pitch 90): z lebih tinggi lebih dekat ke pengamat", () => {
    const k: Kamera = { yaw: 0, pitch: Math.PI / 2, skala: 1, cx: 0, cy: 0 };
    assert.ok(proyeksi([0, 0, 2], k).z < proyeksi([0, 0, 0], k).z);
  });

  it("isometrik: ketiga sumbu satuan sama panjang di layar", () => {
    const o = proyeksi([0, 0, 0], K_ISO);
    const L = (p: V3) => {
      const q = proyeksi(p, K_ISO);
      return Math.hypot(q.x - o.x, q.y - o.y);
    };
    const lx = L([1, 0, 0]);
    assert.ok(Math.abs(L([0, 1, 0]) - lx) < 1e-9);
    assert.ok(Math.abs(L([0, 0, 1]) - lx) < 1e-9);
  });

  it("simetri yaw 0/90: memutar kamera 90° sama dengan memutar benda -90°", () => {
    const k0: Kamera = { yaw: 0, pitch: 0.4, skala: 50, cx: 100, cy: 80 };
    const k90: Kamera = { ...k0, yaw: Math.PI / 2 };
    const titik: V3[] = [
      [1, 2, 3],
      [-0.5, 0.25, 1],
      [4, -3, -2],
    ];
    for (const [x, y, z] of titik) {
      const a = proyeksi([x, y, z], k90);
      // Rz(+90°) : (x, y) -> (-y, x)
      const b = proyeksi([-y, x, z], k0);
      assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9 && Math.abs(a.z - b.z) < 1e-9);
    }
  });

  it("simetri yaw 0/90: kubus yang simetris memberi siluet sama", () => {
    const sudut: V3[] = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) sudut.push([x, y, z]);
    const kotakLayar = (yaw: number) => {
      const k: Kamera = { yaw, pitch: 0.5, skala: 40, cx: 0, cy: 0 };
      const ps = sudut.map((p) => proyeksi(p, k));
      return [
        Math.min(...ps.map((p) => p.x)),
        Math.max(...ps.map((p) => p.x)),
        Math.min(...ps.map((p) => p.y)),
        Math.max(...ps.map((p) => p.y)),
      ];
    };
    const a = kotakLayar(0.3);
    const b = kotakLayar(0.3 + Math.PI / 2);
    for (let i = 0; i < 4; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-9);
  });
});

describe("anchor3", () => {
  it("anchor3 = proyeksi (x, y), tanpa kedalaman", () => {
    const p: V3 = [0.3, -1.2, 2.5];
    const a = anchor3(p, K_ISO);
    const q = proyeksi(p, K_ISO);
    assert.deepEqual(a, { x: q.x, y: q.y });
  });

  it("plateOut3 membawa anchor terproyeksi dan peta piksel identitas", () => {
    const out = plateOut3(K_ISO, 400, 300, { puncak: [1, 1, 1] });
    assert.deepEqual(out.anchors!.puncak, anchor3([1, 1, 1], K_ISO));
    assert.equal(out.map.X(37), 37);
    assert.equal(out.map.invY(12), 12);
    assert.deepEqual(out.map.frame, { x0: 0, y0: 0, x1: 400, y1: 300 });
  });
});

describe("muka kubus", () => {
  it("normal muka menghadap ke luar", () => {
    const m = kubus();
    for (const f of m) {
      const n = normalMuka(f.pts);
      const c = f.pts.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4, s[2] + p[2] / 4], [0, 0, 0]);
      const keluar = (c[0] - 0.5) * n[0] + (c[1] - 0.5) * n[1] + (c[2] - 0.5) * n[2];
      assert.ok(keluar > 0, "normal harus menjauhi pusat kubus");
    }
  });

  it("muka belakang dibuang: tiga muka terlihat dari sudut isometrik", () => {
    const idx = urutMuka(kubus(), K_ISO);
    assert.equal(idx.length, 3);
    const m = kubus();
    const v = arahPandang(K_ISO);
    for (const i of idx) {
      const n = normalMuka(m[i].pts);
      assert.ok(n[0] * v[0] + n[1] * v[1] + n[2] * v[2] < 0, "muka terlihat menghadap pengamat");
    }
  });

  it("tanpa satuSisi keenam muka tetap digambar", () => {
    const m = kotak([0, 0, 0], [1, 1, 1]);
    assert.equal(urutMuka(m, K_ISO).length, 6);
  });

  it("urutan kedalaman: yang jauh lebih dulu (painter's algorithm)", () => {
    const m = kotak([0, 0, 0], [1, 1, 1]);
    const idx = urutMuka(m, K_ISO);
    const dalam = idx.map((i) => {
      const ps = m[i].pts.map((p) => proyeksi(p, K_ISO).z);
      return ps.reduce((a, b) => a + b, 0) / ps.length;
    });
    for (let i = 1; i < dalam.length; i++) assert.ok(dalam[i - 1] >= dalam[i]);
    // Muka atas (z = 1) dilihat dari atas harus digambar paling akhir di antara atas/bawah.
    const atas = m.findIndex((f) => f.pts.every((p) => p[2] === 1));
    const bawah = m.findIndex((f) => f.pts.every((p) => p[2] === 0));
    assert.ok(idx.indexOf(atas) > idx.indexOf(bawah));
  });

  it("dua kubus berjajar sepanjang arah pandang: kubus dekat menutup kubus jauh", () => {
    const k: Kamera = { yaw: 0, pitch: 0.3, skala: 50, cx: 0, cy: 0 };
    const jauh = kotak([0, 3, 0], [1, 4, 1], { satuSisi: true, isi: "#jauh" });
    const dekat = kotak([0, 0, 0], [1, 1, 1], { satuSisi: true, isi: "#dekat" });
    const semua = [...dekat, ...jauh];
    const idx = urutMuka(semua, k);
    const terakhirJauh = Math.max(...idx.map((i, n) => (semua[i].isi === "#jauh" ? n : -1)));
    const pertamaDekat = Math.min(...idx.map((i, n) => (semua[i].isi === "#dekat" ? n : 1e9)));
    assert.ok(terakhirJauh < pertamaDekat);
  });

  it("gambarMuka: isi, garis, satu path per muka terlihat, bobot dari W", () => {
    const { ctx, hitung, ops } = kanvas();
    gambarMuka(ctx, kubus(), K_ISO);
    assert.equal(hitung.fill, 3);
    assert.equal(hitung.stroke, 3);
    assert.equal(hitung.beginPath, 3);
    for (const o of ops.filter((o) => o.op === "stroke")) assert.equal(o.lw, W.bold);
    for (const o of ops.filter((o) => o.op === "stroke")) assert.equal(o.stroke, C.ink);
  });

  it("gambarMuka memotong ke bingkai bila diberi", () => {
    const { ctx, ops } = kanvas();
    gambarMuka(ctx, kubus(), K_ISO, { bingkai: { x0: 10, y0: 10, x1: 300, y1: 200 } });
    const i = ops.findIndex((o) => o.op === "clip");
    assert.ok(i >= 0);
    assert.ok(ops.findIndex((o) => o.op === "fill") > i);
    assert.equal(ops[ops.length - 1].op, "restore");
  });

  it("bobot di luar tiga bobot dibulatkan ke yang terdekat", () => {
    const { ctx, ops } = kanvas();
    const m = kotak([0, 0, 0], [1, 1, 1], { satuSisi: true, bobot: 1.3 });
    gambarMuka(ctx, m, K_ISO);
    for (const o of ops.filter((o) => o.op === "stroke")) assert.equal(o.lw, W.thin);
  });

  it("garis: null tidak menggaris, isi: null tidak mengisi", () => {
    const { ctx, hitung } = kanvas();
    gambarMuka(ctx, kotak([0, 0, 0], [1, 1, 1], { satuSisi: true, garis: null, isi: null }), K_ISO);
    assert.equal(hitung.fill ?? 0, 0);
    assert.equal(hitung.stroke ?? 0, 0);
  });

  it("arsir memotong ke poligon muka", () => {
    const { ctx, hitung } = kanvas();
    gambarMuka(ctx, kotak([0, 0, 0], [1, 1, 1], { satuSisi: true, arsir: "beton" }), K_ISO);
    assert.ok((hitung.clip ?? 0) >= 3, "tiap muka berarsir dipotong ke poligonnya");
  });
});

describe("pencahayaan", () => {
  it("muka atas = faceLit, muka yang membelakangi cahaya = faceShade", () => {
    assert.equal(warnaMuka([0, 0, 1], K_ISO, "beton"), C.faceLit);
    // Isometrik ISO memandang dari pojok −x −y: muka −x tampak di kiri layar,
    // muka −y di kanan. Cahaya dari kiri atas: kanan membelakangi = bayang.
    const kiri = warnaMuka([-1, 0, 0], K_ISO, "beton");
    const kanan = warnaMuka([0, -1, 0], K_ISO, "beton");
    assert.equal(kanan, C.faceShade);
    assert.notEqual(kiri, C.faceLit);
    assert.notEqual(kiri, C.faceShade);
  });

  it("air memakai token air", () => {
    assert.equal(warnaMuka([0, 0, 1], K_ISO, "air"), C.waterFaceLit);
    assert.equal(warnaMuka([0, 0, -1], K_ISO, "air"), C.waterFaceShade);
    assert.equal(warnaMuka([0, 0, -1], K_ISO, "beton"), C.faceShade);
  });

  it("isi kubus satuSisi diturunkan dari normal: atas terang", () => {
    const { ctx, ops } = kanvas();
    gambarMuka(ctx, kubus(), K_ISO);
    const isi = ops.filter((o) => o.op === "fill").map((o) => o.fill);
    assert.ok(isi.includes(C.faceLit));
    assert.equal(new Set(isi).size, 3, "tiga muka terlihat, tiga nada");
  });
});

describe("kameraPas", () => {
  for (const [yaw, pitch] of [
    [ISO.yaw, ISO.pitch],
    [0, 0],
    [1.1, 0.2],
    [-2.5, 1.2],
  ]) {
    it(`memuat semua sudut kotak batas (yaw ${yaw.toFixed(2)}, pitch ${pitch.toFixed(2)})`, () => {
      const b = { min: [-3, 2, -1] as V3, max: [5, 7, 4] as V3 };
      const w = 480;
      const h = 320;
      const margin = 24;
      const k = kameraPas(b, w, h, yaw, pitch, margin);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const x of [b.min[0], b.max[0]])
        for (const y of [b.min[1], b.max[1]])
          for (const z of [b.min[2], b.max[2]]) {
            const p = proyeksi([x, y, z], k);
            x0 = Math.min(x0, p.x);
            x1 = Math.max(x1, p.x);
            y0 = Math.min(y0, p.y);
            y1 = Math.max(y1, p.y);
          }
      const e = 1e-6;
      assert.ok(x0 >= margin - e && x1 <= w - margin + e && y0 >= margin - e && y1 <= h - margin + e);
      // Pas: salah satu arah menyentuh margin, dan gambar berada di tengah.
      const sentuh = Math.abs(x1 - x0 - (w - 2 * margin)) < 1e-6 || Math.abs(y1 - y0 - (h - 2 * margin)) < 1e-6;
      assert.ok(sentuh, "skala sebesar mungkin");
      assert.ok(Math.abs((x0 + x1) / 2 - w / 2) < 1e-6 && Math.abs((y0 + y1) / 2 - h / 2) < 1e-6);
    });
  }
});

describe("balikan piksel ke nilai fisik", () => {
  it("balikDiBidangZ membalik proyeksi titik di bidang datar", () => {
    const p: V3 = [2.3, -1.7, 0.5];
    const q = proyeksi(p, K_ISO);
    const b = balikDiBidangZ(q.x, q.y, K_ISO, 0.5)!;
    assert.ok(Math.abs(b[0] - p[0]) < 1e-9 && Math.abs(b[1] - p[1]) < 1e-9);
  });

  it("balikDiBidangZ tidak punya jawaban pada tampak depan", () => {
    assert.equal(balikDiBidangZ(10, 10, { yaw: 0, pitch: 0, skala: 1, cx: 0, cy: 0 }, 0), null);
  });

  it("balikDiGaris memberi parameter t titik terdekat di garis", () => {
    const a: V3 = [0, 0, 0];
    const b: V3 = [0, 2, 0];
    for (const t of [0, 0.25, 0.8, 1]) {
      const q = proyeksi([0, 2 * t, 0], K_ISO);
      assert.ok(Math.abs(balikDiGaris(q.x, q.y, K_ISO, a, b) - t) < 1e-9);
    }
    // Di luar ujung tidak dijepit: Client yang menjepit dan memberi penanda.
    const luar = proyeksi([0, 3, 0], K_ISO);
    assert.ok(Math.abs(balikDiGaris(luar.x, luar.y, K_ISO, a, b) - 1.5) < 1e-9);
  });
});

describe("permukaanGrid", () => {
  const kerucut = (x: number, y: number) => -Math.max(0, 2 - Math.hypot(x, y));

  it("membuat nx x ny muka dengan normal ke atas pada bidang datar", () => {
    const m = permukaanGrid(() => 0, 0, 4, 0, 2, 4, 2, { bahan: "air" });
    assert.equal(m.length, 8);
    for (const f of m) {
      const n = normalMuka(f.pts);
      assert.ok(n[2] > 0.999);
      assert.equal(f.bahan, "air");
    }
  });

  it("titik kisi bersama memakai nilai fungsi yang sama", () => {
    const m = permukaanGrid(kerucut, -3, 3, -3, 3, 6, 6, {});
    // muka (0,0) pojok kanan-atas = muka (1,0) pojok kiri-atas
    assert.deepEqual(m[0].pts[1], m[1].pts[0]);
    assert.deepEqual(m[0].pts[2], m[1].pts[3]);
  });

  it("anggaran bingkai: kisi 40 x 40 (1600 muka) jauh di bawah 16,7 ms", (t) => {
    const m = permukaanGrid(kerucut, -3, 3, -3, 3, 40, 40, { bobot: W.hair });
    assert.equal(m.length, 1600);
    const { ctx, hitung } = kanvas();
    gambarMuka(ctx, m, K_ISO);
    // Penghitung operasi: satu path per muka, tanpa perintah tambahan.
    const per = (hitung.lineTo ?? 0) / 1600;
    assert.equal(hitung.beginPath, 1600);
    assert.equal(hitung.fill, 1600);
    assert.equal(hitung.stroke, 1600);
    assert.equal(per, 3);
    assert.ok((hitung["set:lineWidth"] ?? 0) <= 2, "bobot garis diset sekali, bukan per muka");
    assert.ok((hitung["set:fillStyle"] ?? 0) < 1600, "isi hanya diset bila berubah");

    // Waktu kerja JS (proyeksi, urut, perintah) diukur dengan kanvas kosong:
    // objek biasa bermetode kosong, bukan Proxy (Proxy sendiri lebih mahal
    // daripada panggilan kanvas asli).
    const nop = () => {};
    const kosong = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      lineCap: "butt",
      lineJoin: "miter",
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
    const kam: Kamera = { ...K_ISO };
    for (let i = 0; i < 20; i++) gambarMuka(kosong, m, kam); // pemanasan JIT
    const N = 60;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      kam.yaw = ISO.yaw + i * 0.02; // memutar seperti saat diseret
      gambarMuka(kosong, m, kam);
    }
    const perBingkai = (performance.now() - t0) / N;
    t.diagnostic(`kisi 1600 muka: ${perBingkai.toFixed(2)} ms kerja JS per bingkai`);
    assert.ok(perBingkai < 4, `kerja JS ${perBingkai.toFixed(2)} ms per bingkai; sisakan waktu untuk rasterisasi`);
  });
});
