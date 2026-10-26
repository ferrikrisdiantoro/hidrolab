import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  advanceReach,
  createReachMotion,
  drawReachMotion,
  reachFlow,
  reachTimeScale,
  scatterReach,
  velocityAt,
  along,
  type ReachStation,
} from "./drawReachMotion.ts";
import { createPool } from "./motion.ts";
import { linearMap, type PlateOut } from "./plateOut.ts";
import {
  reachEnergy,
  sideChannelProfile,
  slopeBreak,
  svfProfile,
} from "./hydraulics.ts";
import type { ReachPoint } from "./drawReach.ts";

/*
 * Lapis gerak B6 (OC-06, OC-09, OC-12, HS-10): laju partikel HARUS sama
 * dengan V = Q/A yang dihitung model lembarnya. Stasiun disusun persis
 * seperti di Client-nya.
 */

const dekat = (a: number, b: number, tol: number, pesan?: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${pesan ?? ""} ${a} lawan ${b}`);

/** Stasiun OC-12 (aliran masuk lateral), sama dengan AliranMasukLateralClient. */
function stasiunLateral(Q0: number, qStar: number, b: number, n: number, S0: number, L: number, yEnd: number) {
  const r = svfProfile(Q0, qStar, b, n, S0, L, yEnd);
  const zb = (x: number) => (L - x) * S0;
  const st: ReachStation[] = r.points.map((p) => ({ x: p.x, zb: zb(p.x), zs: zb(p.x) + p.y, V: p.V, Q: p.Q }));
  const air: ReachPoint[] = r.points.map((p) => ({ x: p.x, z: zb(p.x) + p.y }));
  const bed: ReachPoint[] = [{ x: 0, z: zb(0) }, { x: L, z: 0 }];
  return { r, st, air, bed };
}

describe("drawReachMotion: laju partikel = V model", () => {
  it("OC-09: di tiap stasiun reachEnergy, velocityAt = p.V", () => {
    const r = reachEnergy(12, 5, 0.025, 0.0015, 2.8, 1500);
    const st = r.points.map((p) => ({ x: p.x, zb: p.zb, zs: p.wsl, V: p.V, egl: p.egl }));
    const f = reachFlow(st, [], [])!;
    for (const p of r.points) dekat(velocityAt(f, p.x), p.V, 1e-9 * Math.max(1, p.V), `x ${p.x}`);
    // Juga sama dengan Q / (b y) model.
    for (const p of r.points) dekat(velocityAt(f, p.x), 12 / (5 * p.y), 1e-6);
    // Tanda energi berjalan di garis energi model.
    for (const p of r.points) dekat(along(f, f.egl!, p.x), p.egl, 1e-9);
  });

  it("OC-12: velocityAt = p.V = Q(x)/(b y), peluang lahir di hulu = Q₀/Q_L", () => {
    const { r, st } = stasiunLateral(4, 0.02, 5, 0.025, 0.0012, 500, 2.2);
    const f = reachFlow(st, [], [])!;
    for (const p of r.points) {
      dekat(velocityAt(f, p.x), p.V, 1e-9);
      dekat(p.V, p.Q / (5 * p.y), 1e-9);
    }
    dekat(f.pInlet, 4 / r.Qend, 1e-12);
  });

  it("HS-10: velocityAt = p.V saluran samping, lahir merata (Q(0) = 0)", () => {
    const r = sideChannelProfile(50, 6, 0.014, 0.005, 60);
    const st = r.points.map((p) => ({ x: p.x, zb: p.zb, zs: p.ws, V: p.V, Q: p.Q }));
    const f = reachFlow(st, [], [])!;
    for (const p of r.points) dekat(velocityAt(f, p.x), Math.max(0, p.V), 1e-9);
    assert.ok(f.pInlet < 1e-6, `pInlet ${f.pInlet}`);
  });

  it("OC-06 curam ke landai: sebelum loncatan V₁ = Q/(b y₁), sesudahnya V₂ = Q/(b y₂)", () => {
    const Q = 12, b = 5, La = 150, Lb = 100;
    const r = slopeBreak(Q, b, 0.025, 0.08, 0.003, La, Lb);
    assert.ok(r.jumpAt !== null && r.jumpFrom !== null && r.jumpTo !== null, "contoh harus berloncatan");
    const zb = (x: number) => (x <= La ? 0.003 * Lb + (La - x) * 0.08 : (La + Lb - x) * 0.003);
    const xj = La + (r.jumpAt as number);
    // Stasiun seperti TransisiKemiringanClient: muka loncatan = dua titik pada xj.
    const air: { x: number; y: number }[] = [
      { x: 0, y: r.hulu.y0 },
      { x: La, y: r.hulu.y0 },
      ...[...r.hilir.profile!.points].sort((a, c) => a.x - c.x).filter((p) => p.x <= (r.jumpAt as number)).map((p) => ({ x: La + p.x, y: p.y })),
      { x: xj, y: r.jumpFrom as number },
      { x: xj, y: r.jumpTo as number },
      { x: La + Lb, y: r.hilir.y0 },
    ];
    const st = air.map((p) => ({ x: p.x, zb: zb(p.x), zs: zb(p.x) + p.y, V: Q / (b * p.y) }));
    const f = reachFlow(st, [], [])!;
    dekat(velocityAt(f, xj - 1e-6), Q / (b * (r.jumpFrom as number)), 1e-3);
    dekat(velocityAt(f, xj + 1e-6), Q / (b * (r.jumpTo as number)), 1e-3);
    assert.ok(velocityAt(f, xj - 1e-6) > 2 * velocityAt(f, xj + 1e-6), "loncatan memperlambat aliran");
  });
});

describe("drawReachMotion: gerak partikel", () => {
  it("advanceReach memajukan x sejauh V(x)·dt", () => {
    const r = reachEnergy(12, 5, 0.025, 0.0015, 2.8, 1500);
    const f = reachFlow(r.points.map((p) => ({ x: p.x, zb: p.zb, zs: p.wsl, V: p.V })), [], [])!;
    const p = createPool(3);
    p.x[0] = 100; p.x[1] = 700; p.x[2] = 1400;
    const x0 = Array.from(p.x);
    advanceReach(p, f, 0.5);
    for (let i = 0; i < 3; i++) dekat(p.x[i] - x0[i], velocityAt(f, x0[i]) * 0.5, 1e-3, `partikel ${i}`);
  });

  it("aliran masuk lateral: partikel yang lewat x per detik ∝ Q(x) = Q₀ + q*·x", () => {
    const L = 500;
    const { r, st } = stasiunLateral(4, 0.02, 5, 0.025, 0.0012, L, 2.2);
    const f = reachFlow(st, [], [])!;
    const p = createPool(3000);
    scatterReach(p, f);
    const dt = f.crossTime / 400;
    let lewatTengah = 0;
    let lewatUjung = 0;
    for (let k = 0; k < 1600; k++) {
      for (let i = 0; i < p.n; i++) {
        const a = p.x[i];
        const v = velocityAt(f, a);
        if (a < L / 2 && a + v * dt >= L / 2) lewatTengah++;
        if (a + v * dt > L) lewatUjung++;
      }
      advanceReach(p, f, dt);
    }
    const harap = (4 + 0.02 * (L / 2)) / r.Qend;
    dekat(lewatTengah / lewatUjung, harap, 0.03, "rasio lewat tengah/ujung");
  });

  it("sebaran awal: partikel per meter ∝ kedalaman (Q/V = A)", () => {
    const r = reachEnergy(12, 5, 0.025, 0.0015, 0.9, 700);
    const f = reachFlow(r.points.map((p) => ({ x: p.x, zb: p.zb, zs: p.wsl, V: p.V })), [], [])!;
    const p = createPool(4000);
    scatterReach(p, f);
    const xm = (f.x[0] + f.x[f.n - 1]) / 2;
    const kiri = Array.from(p.x).filter((x) => x < xm).length / p.n;
    const k = Array.from(f.x).findIndex((x) => x >= xm);
    dekat(kiri, f.cum[k] / f.cum[f.n - 1], 0.01);
  });

  it("reachTimeScale: deret 1-2-5, satu lintasan 6 sampai 16 detik layar", () => {
    for (const T of [3, 40, 170, 555, 1234, 9000, 52000]) {
      const N = reachTimeScale(T);
      const m = N / Math.pow(10, Math.floor(Math.log10(N) + 1e-9));
      assert.ok([1, 2, 5].some((v) => Math.abs(v - m) < 1e-9), `N ${N}`);
      assert.ok(T / N >= 6 && T / N <= 16, `T ${T}: ${T / N} s`);
    }
  });
});

describe("drawReachMotion: frame lengkap", () => {
  it("semua koordinat terhingga, gulungan berputar pada jam waktu nyata", () => {
    const { st, air, bed } = stasiunLateral(4, 0.02, 5, 0.025, 0.0012, 500, 2.2);
    const f = reachFlow(st, air, bed, [{ x: 251.3, omega: 2 }])!;
    const ruas: number[][] = [];
    const busur: number[][] = [];
    let titik: number[] | null = null;
    const nop = () => {};
    const ctx = {
      moveTo: (x: number, y: number) => { titik = [x, y]; },
      lineTo: (x: number, y: number) => { if (titik) ruas.push([...titik, x, y]); titik = [x, y]; },
      arc: (x: number, y: number, r: number, a0: number) => busur.push([x, y, r, a0]),
      beginPath: nop, rect: nop, clip: nop, save: nop, restore: nop, stroke: nop, closePath: nop, setLineDash: nop,
      lineWidth: 1, strokeStyle: "", globalAlpha: 1, lineCap: "butt",
    } as unknown as CanvasRenderingContext2D;
    const out: PlateOut = { map: linearMap({ x0: 60, y0: 28, x1: 760, y1: 400 }, [0, 500], [0, 3.5]) };
    const st0 = createReachMotion(120);
    drawReachMotion(ctx, 0, 0, out, f, 50, st0);
    assert.ok(ruas.length >= 120);
    assert.ok(ruas.every((r) => r.every(Number.isFinite)));
    // Tidak ada titik deret air pada x = 251,3, jadi tanpa gulungan.
    assert.equal(busur.length, 0);

    // Deret air dengan muka loncatan pada x = 250: gulungan digambar, dan
    // sudutnya = π/4 − ω·t_nyata dengan t_nyata = t / timeScale.
    const air2: ReachPoint[] = [{ x: 0, z: 2.6 }, { x: 250, z: 1.3 }, { x: 250, z: 2.4 }, { x: 500, z: 2.2 }];
    const f2 = reachFlow(st, air2, bed, [{ x: 250, omega: 2 }])!;
    const st2 = createReachMotion(10);
    drawReachMotion(ctx, 50, 0, out, f2, 50, st2);
    assert.equal(busur.length, 1);
    dekat(busur[0][3], Math.PI / 4 - 2 * (50 / 50), 1e-9, "sudut gulungan");
  });
});
