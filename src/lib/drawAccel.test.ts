import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ACCEL_SWEEP,
  accelRange,
  accelTerms,
  createAccelMotion,
  drawAccelMotion,
  ductArrowPx,
  ductSpan,
  sweepTime,
} from "./drawAccel.ts";
import { acceleration } from "./hydraulics.ts";
import { linearMap, type PlateOut } from "./plateOut.ts";

/*
 * FF-07 kursor waktu. Yang diuji: suku yang digambar lapis gerak pada saat
 * τ sama dengan acceleration() pada t = τ, dan ketiga bidang membaca τ yang
 * sama.
 */

const dekat = (a: number, b: number, tol: number, pesan?: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${pesan ?? ""} ${a} lawan ${b}`);

const D1 = 0.2;
const L = 0.5;
const KASUS = [
  [0.1, 0.3, 1, 0.08],
  [0.05, 0.8, 6, 0.19],
  [0.02, 0.5, 6, 0.17],
  [0.5, 0.9, 10, 0.03],
  [0.1, 0, 1, 0.06],
] as const;

function konteks() {
  const rekam = { arc: [] as number[][], ruas: [] as number[][] };
  let titik: number[] | null = null;
  const nop = () => {};
  const ctx: Record<string, unknown> = {
    font: "",
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: "left",
    textBaseline: "alphabetic",
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    moveTo: (x: number, y: number) => {
      titik = [x, y];
    },
    lineTo: (x: number, y: number) => {
      if (titik) rekam.ruas.push([...titik, x, y]);
      titik = [x, y];
    },
    arc: (x: number, y: number, r: number) => rekam.arc.push([x, y, r]),
  };
  for (const m of ["beginPath", "fill", "rect", "clip", "save", "restore", "closePath", "stroke", "fillText", "fillRect", "setLineDash"])
    ctx[m] = nop;
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rekam };
}

describe("FF-07 accelTerms = acceleration()", () => {
  it("u, lokal, konvektif sama dengan model di banyak x dan t", () => {
    const o = new Float64Array(3);
    for (const [Q0, s, om, D2] of KASUS)
      for (const x of [0, 0.13, 0.25, 0.5])
        for (const t of [0, 0.4, 1.7, 5.95]) {
          const r = acceleration(Q0, s, om, D1, D2, L, x, t);
          accelTerms(Q0, s, om, D1, D2, L, x, t, o);
          dekat(o[0], r.velocity, 1e-12 * Math.max(1, Math.abs(r.velocity)), "u");
          dekat(o[1], r.local, 1e-12 * Math.max(1, Math.abs(r.local)), "lokal");
          dekat(o[2], r.convective, 1e-12 * Math.max(1, Math.abs(r.convective)), "konv");
        }
  });

  it("profil model pada saat t = accelTerms di titik profilnya", () => {
    const o = new Float64Array(3);
    const r = acceleration(0.05, 0.8, 6, D1, 0.19, L, 0.25, 2.2);
    for (const p of r.profile) {
      accelTerms(0.05, 0.8, 6, D1, 0.19, L, p.x, 2.2, o);
      dekat(o[1], p.local, 1e-12 * Math.max(1, Math.abs(p.local)));
      dekat(o[2], p.convective, 1e-12 * Math.max(1, Math.abs(p.convective)));
    }
  });

  it("lokal = ∂u/∂t (beda hingga), sesuai definisi suku lokal", () => {
    const a = new Float64Array(3);
    const b = new Float64Array(3);
    const c = new Float64Array(3);
    for (const t of [0.3, 2.9]) {
      const h = 1e-6;
      accelTerms(0.05, 0.8, 6, D1, 0.19, L, 0.3, t - h, a);
      accelTerms(0.05, 0.8, 6, D1, 0.19, L, 0.3, t + h, b);
      accelTerms(0.05, 0.8, 6, D1, 0.19, L, 0.3, t, c);
      dekat((b[0] - a[0]) / (2 * h), c[1], 1e-5 * Math.max(1, Math.abs(c[1])));
    }
  });
});

describe("FF-07 kursor waktu", () => {
  it("ductSpan menyisakan satu panjang panah di kedua sisi kanvas", () => {
    for (const w of [340, 830, 1200]) {
      const [a, b] = ductSpan(w);
      dekat(a - ductArrowPx(w), 20, 1e-12);
      dekat(w - b - ductArrowPx(w), 20, 1e-12);
      assert.ok(b > a);
    }
  });

  it("sweepTime menyapu 0..6 s (rentang penggeser t) lalu ulang", () => {
    assert.equal(ACCEL_SWEEP, 6);
    dekat(sweepTime(2.5), 2.5, 1e-12);
    dekat(sweepTime(7.25), 1.25, 1e-12);
    assert.equal(sweepTime(0), 0);
  });

  it("accelRange memuat setiap suku di setiap saat sapuan", () => {
    const o = new Float64Array(3);
    for (const [Q0, s, om, D2] of KASUS) {
      const g = accelRange(Q0, s, om, D1, D2, L, null);
      const di = accelRange(Q0, s, om, D1, D2, L, 0.25);
      for (let t = 0; t <= 6; t += 0.0137) {
        for (const x of [0, 0.25, 0.5]) {
          accelTerms(Q0, s, om, D1, D2, L, x, t, o);
          for (const v of [o[1], o[2], o[1] + o[2]]) {
            const tol = 2e-3 * g.absMax;
            assert.ok(v >= g.min - tol && v <= g.max + tol, `profil ${v} di luar [${g.min}, ${g.max}]`);
            if (x === 0.25) assert.ok(Math.abs(v) <= di.absMax * 1.002 + 1e-12);
          }
        }
      }
    }
  });

  it("ketiga bidang membaca τ yang sama dan titiknya = model pada t = τ", () => {
    const [Q0, s, om, D2] = KASUS[1];
    const prof = linearMap({ x0: 60, y0: 120, x1: 760, y1: 420 }, [0, L], [-40, 60]);
    const ct = linearMap({ x0: 62, y0: 470, x1: 770, y1: 600 }, [0, 6], [-40, 60]);
    const duct = linearMap({ x0: 60, y0: 10, x1: 760, y1: 100 }, [0, L], [-0.1, 0.1]);
    const out: PlateOut = { map: prof, maps: { ct, duct } };
    const st = createAccelMotion();
    const absMax = accelRange(Q0, s, om, D1, D2, L, 0.25).absMax;
    for (const tt of [0.37, 2.2, 6.9, 11.3]) {
      const { ctx, rekam } = konteks();
      drawAccelMotion(ctx, tt, out, { Q0, swing: s, omega: om, D1, D2, L, x: 0.25, absMax }, st);
      const tau = sweepTime(tt);
      const r = acceleration(Q0, s, om, D1, D2, L, 0.25, tau);
      const px = ct.X(tau);
      assert.ok(rekam.ruas.some(([x0, y0, x1, y1]) => x0 === px && x1 === px && y0 === ct.frame.y0 && y1 === ct.frame.y1), "kursor");
      for (const v of [r.local, r.convective, r.total])
        assert.ok(rekam.arc.some(([x, y]) => x === px && Math.abs(y - ct.Y(v)) < 1e-6), `titik a(t) ${v}`);
      assert.ok(rekam.arc.some(([x, y]) => x === prof.X(0.25) && Math.abs(y - prof.Y(r.total)) < 1e-6), "titik profil");
      // Panah total di sketsa: dari garis penampang, panjang sebanding a/absMax.
      const xp = duct.X(0.25);
      const yT = duct.Y(0) + 14;
      const panah = rekam.ruas.find(([x0, y0, , y1]) => x0 === xp && y0 === yT && y1 === yT);
      assert.ok(panah, "panah total");
      const panjang = duct.frame.x0 - 20;
      dekat(panah![2] - xp, (r.total / absMax) * panjang, 1e-6, "panjang panah total");
    }
  });
});
