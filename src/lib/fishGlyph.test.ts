import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  FISH_STATIONS,
  drawFish,
  fishHalfWidth,
  fishOutline,
  fishOutlineLength,
  type FishPose,
} from "./fishGlyph.ts";
import type { PlateMap } from "./plateOut.ts";
import { bodyAmplitude } from "./renangGerak.ts";
import { C, TONE } from "./theme.ts";

const dekat = (a: number, b: number, tol: number, pesan = "") =>
  assert.ok(Math.abs(a - b) <= tol, `${pesan} ${a} != ${b} (tol ${tol})`);

const pose = (p: Partial<FishPose> = {}): FishPose => ({
  x: 3,
  y: -1.5,
  heading: 0.7,
  length: 0.4,
  phase: 1.1,
  ...p,
});

/** Proyeksi titik k ke arah kepala dan ke normal kirinya, relatif titik tengah. */
function proyeksi(o: Float32Array, k: number, f: FishPose) {
  const dx = o[2 * k] - f.x;
  const dy = o[2 * k + 1] - f.y;
  const c = Math.cos(f.heading);
  const s = Math.sin(f.heading);
  return { maju: dx * c + dy * s, samping: -dx * s + dy * c };
}

describe("S8 fishOutline", () => {
  it("poligon tertutup: titik terakhir sama dengan titik pertama (moncong)", () => {
    for (const n of [6, 12, FISH_STATIONS, 40]) {
      const f = pose();
      const o = fishOutline(f, n);
      const m = o.length / 2;
      assert.equal(o.length, fishOutlineLength(n));
      assert.equal(m, 2 * n + 1);
      assert.equal(o[0], o[2 * (m - 1)]);
      assert.equal(o[1], o[2 * (m - 1) + 1]);
    }
  });

  it("rentang sepanjang arah kepala = length pada fase dan arah berapa pun", () => {
    for (const heading of [0, 0.7, Math.PI / 2, 2.5, -2.2]) {
      for (const phase of [0, 1, 2.4, 4, 5.9]) {
        for (const length of [0.05, 0.4, 1.2]) {
          const f = pose({ heading, phase, length, amp: 0.13 });
          const o = fishOutline(f);
          let lo = Infinity;
          let hi = -Infinity;
          for (let k = 0; k < o.length / 2; k++) {
            const { maju } = proyeksi(o, k, f);
            lo = Math.min(lo, maju);
            hi = Math.max(hi, maju);
          }
          dekat(hi - lo, length, 1e-5 * Math.max(1, Math.abs(f.x) + Math.abs(f.y)), "panjang");
        }
      }
    }
  });

  it("kepala di depan arah heading, ekor di belakang, titik (x, y) di tengah", () => {
    const n = FISH_STATIONS;
    for (const heading of [0, 1, Math.PI, -1.9]) {
      const f = pose({ heading });
      const o = fishOutline(f, n);
      const moncong = proyeksi(o, 0, f);
      dekat(moncong.maju, f.length / 2, 1e-5, "moncong");
      /* Ujung sirip atas (n - 1) dan bawah (n + 1) */
      const a = proyeksi(o, n - 1, f);
      const b = proyeksi(o, n + 1, f);
      dekat(a.maju, -f.length / 2, 1e-5, "ekor atas");
      dekat(b.maju, -f.length / 2, 1e-5, "ekor bawah");
      assert.ok(moncong.maju > a.maju);
    }
  });

  it("simpangan ekor terbesar sepanjang satu kibasan = amp x length", () => {
    const n = FISH_STATIONS;
    for (const amp of [undefined, 0.05, 0.1, 0.15]) {
      const f = pose({ amp, length: 0.6 });
      const harap = (amp ?? bodyAmplitude(1)) * f.length;
      let maks = 0;
      const wadah = new Float32Array(fishOutlineLength(n));
      for (let i = 0; i < 720; i++) {
        f.phase = (i / 720) * 2 * Math.PI;
        const o = fishOutline(f, n, wadah);
        const a = proyeksi(o, n - 1, f);
        const b = proyeksi(o, n + 1, f);
        maks = Math.max(maks, Math.abs(0.5 * (a.samping + b.samping)));
      }
      dekat(maks, harap, 1e-4 * f.length, `amp ${amp}`);
    }
  });

  it("gelombang merambat dari kepala ke ekor saat fase bertambah", () => {
    /* Puncak sin(2 pi xi - phase) ada di xi = (phase + pi/2) / 2 pi:
       fase lebih besar, puncak lebih ke belakang. */
    const n = 41;
    const puncak = (phase: number) => {
      const f = pose({ phase, heading: 0, x: 0, y: 0, length: 1 });
      const o = fishOutline(f, n);
      let best = -Infinity;
      let xi = 0;
      for (let i = Math.floor(0.3 * (n - 1)); i < Math.floor(0.8 * (n - 1)); i++) {
        const atas = proyeksi(o, i, f).samping;
        const bawah = proyeksi(o, 2 * n - i, f).samping;
        const tengah = 0.5 * (atas + bawah);
        if (tengah > best) {
          best = tengah;
          xi = i / (n - 1);
        }
      }
      return xi;
    };
    assert.ok(puncak(1.2) > puncak(0.2));
  });

  it("memakai wadah keluaran tanpa membuat array baru", () => {
    const wadah = new Float32Array(fishOutlineLength(FISH_STATIONS) + 10);
    const o = fishOutline(pose(), FISH_STATIONS, wadah);
    assert.equal(o, wadah);
    assert.throws(() => fishOutline(pose(), FISH_STATIONS, new Float32Array(4)), RangeError);
  });

  it("lebar nol di moncong, menyempit di batang ekor, melebar di sirip", () => {
    assert.equal(fishHalfWidth(0), 0);
    assert.ok(fishHalfWidth(0.3) > fishHalfWidth(0.84));
    assert.ok(fishHalfWidth(1) > fishHalfWidth(0.84));
  });
});

describe("S8 drawFish", () => {
  const map: PlateMap = {
    X: (v) => 100 + 200 * v,
    Y: (v) => 300 - 200 * v,
    invX: (p) => (p - 100) / 200,
    invY: (p) => (300 - p) / 200,
    frame: { x0: 0, y0: 0, x1: 400, y1: 400 },
  };

  function rekam() {
    const log: string[] = [];
    const ctx: Record<string, unknown> = {
      fillStyle: "#000",
      strokeStyle: "#000",
      lineWidth: 1,
      lineJoin: "miter",
      lineCap: "butt",
    };
    for (const nama of ["save", "restore", "beginPath", "moveTo", "lineTo", "closePath", "arc", "setLineDash"]) {
      ctx[nama] = () => log.push(nama);
    }
    ctx.fill = () => log.push(`fill ${ctx.fillStyle}`);
    ctx.stroke = () => log.push(`stroke ${ctx.strokeStyle} ${ctx.lineWidth}`);
    return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
  }

  it("bawaan: garis tinta tipis, isian kertas, mata pada ikan besar", () => {
    const { ctx, log } = rekam();
    drawFish(ctx, map, pose());
    assert.ok(log.includes(`stroke ${C.ink} 1`));
    assert.ok(log.includes(`fill ${C.sheet}`));
    assert.ok(log.includes("arc"));
    assert.equal(log.filter((l) => l === "lineTo").length, 2 * FISH_STATIONS - 1);
    assert.equal(log[0], "save");
    assert.equal(log[log.length - 1], "restore");
  });

  it("tone pass memakai TONE.pass; hollow tanpa isian tubuh", () => {
    const a = rekam();
    drawFish(a.ctx, map, pose(), { tone: "pass" });
    assert.ok(a.log.includes(`stroke ${TONE.pass.line} 1`));
    assert.ok(a.log.includes(`fill ${TONE.pass.fill}`));

    const b = rekam();
    drawFish(b.ctx, map, pose(), { hollow: true, color: C.water });
    assert.ok(b.log.includes(`stroke ${C.water} 1`));
    assert.ok(!b.log.includes(`fill ${C.sheet}`));
  });

  it("ikan kecil di layar tanpa mata", () => {
    const { ctx, log } = rekam();
    drawFish(ctx, map, pose({ length: 0.05 }));
    assert.ok(!log.includes("arc"));
  });
});
