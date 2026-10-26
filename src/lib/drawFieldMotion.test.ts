import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  beadEta,
  beadLane,
  createDeformMotion,
  createFlowLinesMotion,
  createPlumeMotion,
  createReynoldsMotion,
  decadeTimeScale,
  deformMatrix,
  drawDeformMotion,
  drawFlowLinesMotion,
  drawKarmanMotion,
  drawPlumeMotion,
  drawReynoldsMotion,
  filamentY,
  karmanDrift,
  karmanTimeScale,
  karmanVortex,
  pathlinePoint,
  plumeConcentration,
  replayTime,
  reynoldsAxisVelocity,
  reynoldsProfile,
  reynoldsTimeScale,
  stepPlume,
  streakPoint,
} from "./drawFieldMotion.ts";
import { createPool } from "./motion.ts";
import { linearMap, type PlateOut } from "./plateOut.ts";
import {
  advectionDiffusion,
  deformation,
  flowLines,
  reynoldsExperiment,
  vortexStreet,
} from "./hydraulics.ts";

/*
 * Lapis gerak batch B5a. Yang diuji: laju setiap tanda yang bergerak sama
 * dengan medan kecepatan model lembarnya, dan tidak ada tanda di tempat
 * yang bukan fluida (di dalam silinder, di luar dinding tabung).
 */

type Rekam = { arc: number[][]; ruas: number[][]; rect: number[][] };

function konteks(): { ctx: CanvasRenderingContext2D; rekam: Rekam } {
  const rekam: Rekam = { arc: [], ruas: [], rect: [] };
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
    lineCap: "butt",
    lineJoin: "miter",
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    moveTo: (x: number, y: number) => {
      titik = [x, y];
    },
    lineTo: (x: number, y: number) => {
      if (titik) rekam.ruas.push([...titik, x, y]);
      titik = [x, y];
    },
    arc: (x: number, y: number, r: number) => rekam.arc.push([x, y, r]),
    fillRect: (x: number, y: number, w: number, h: number) => rekam.rect.push([x, y, w, h]),
  };
  for (const m of [
    "beginPath", "fill", "rect", "clip", "save", "restore", "closePath", "stroke",
    "strokeRect", "fillText", "setLineDash", "clearRect",
  ])
    ctx[m] = nop;
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rekam };
}

function keluaran(x0: number, x1: number, y0: number, y1: number): PlateOut {
  return { map: linearMap({ x0: 60, y0: 26, x1: 760, y1: 426 }, [x0, x1], [y0, y1]) };
}

const dekat = (a: number, b: number, tol: number, pesan?: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${pesan ?? ""} ${a} lawan ${b}`);

describe("jam putar ulang dan pengali waktu", () => {
  it("replayTime naik 0..tEnd, diam selama hold, lalu mulai lagi", () => {
    assert.equal(replayTime(0, 5, 1), 0);
    dekat(replayTime(2.5, 5, 1), 2.5, 1e-12);
    assert.equal(replayTime(5.5, 5, 1), 5);
    dekat(replayTime(6.5, 5, 1), 0.5, 1e-12);
  });

  it("decadeTimeScale: pangkat sepuluh, peristiwa di layar antara lo dan 10·lo", () => {
    for (const f of [0.002, 0.04, 0.42, 3, 870, 8400]) {
      const k = decadeTimeScale(f, 0.3);
      assert.ok(Number.isInteger(Math.round(Math.log10(k) * 1e9) / 1e9));
      const layar = f * k;
      assert.ok(layar >= 0.3 - 1e-9 && layar < 3 + 1e-9, `f ${f}: ${layar}`);
    }
    assert.equal(karmanTimeScale(0.42), 1);
  });
});

describe("FF-05 garis aliran: laju = medan flowLines", () => {
  const U = 2;
  const V = 1.5;
  const om = 3;
  const t = 12;
  const r = flowLines(U, V, om, t, Math.max(10, U * t));

  it("kepala lintasan dan butir garis jejak sama dengan titik model", () => {
    const o = new Float64Array(2);
    const n = r.pathline.length - 1;
    for (const i of [0, 17, 80, 160]) {
      pathlinePoint(U, V, om, (t * i) / n, o);
      dekat(o[0], r.pathline[i].x, 1e-9, "x lintasan");
      dekat(o[1], r.pathline[i].y, 1e-9, "y lintasan");
      streakPoint(U, V, om, t, (t * i) / n, o);
      dekat(o[0], r.streakline[i].x, 1e-9, "x jejak");
      dekat(o[1], r.streakline[i].y, 1e-9, "y jejak");
    }
  });

  it("kecepatan kepala lintasan (beda hingga) = (U, V cos ωτ)", () => {
    const a = new Float64Array(2);
    const b = new Float64Array(2);
    for (const tau of [0.3, 2.1, 7.7]) {
      const h = 1e-6;
      pathlinePoint(U, V, om, tau - h, a);
      pathlinePoint(U, V, om, tau + h, b);
      dekat((b[0] - a[0]) / (2 * h), U, 1e-6, "u");
      dekat((b[1] - a[1]) / (2 * h), V * Math.cos(om * tau), 1e-5, "v");
    }
  });

  it("pelacak bergerak dengan (U, V cos ωτ) dan tetap di dalam bidang", () => {
    const st = createFlowLinesMotion(60);
    const out = keluaran(-1.44, 26.4, -8, 8);
    const { ctx } = konteks();
    let tt = 0;
    for (let k = 0; k < 200; k++) {
      const dt = 1 / 60;
      tt += dt;
      drawFlowLinesMotion(ctx, tt, dt, out, { U, V, omega: om, waktu: t, panjang: 24 }, st);
      const tau = replayTime(tt, t, 1.5);
      for (let i = 0; i < st.pool.n; i++) {
        assert.equal(st.pool.u[i], U);
        dekat(st.pool.v[i], V * Math.cos(om * tau), 1e-6, "v pelacak");
        assert.ok(st.pool.x[i] >= -1.44 - 1e-5 && st.pool.x[i] <= 26.4 + 1e-5);
        assert.ok(st.pool.y[i] >= -8 - 1e-5 && st.pool.y[i] <= 8 + 1e-5);
      }
    }
  });
});

describe("FF-06 deformasi: elemen = e^{τA}, pelacak u = A x", () => {
  it("deformMatrix memetakan pojok sama dengan deformation()", () => {
    const m = new Float64Array(4);
    const kasus = [
      [0, 1, 0, 0],
      [0, -1, 1, 0],
      [1, 0, 0, -1],
      [0.5, 1.2, -0.7, 0.3],
      [2, 0, 0, 2],
      [-3, 2.5, -1.5, 3],
    ];
    for (const [a, b, c, d] of kasus)
      for (const t of [0.05, 0.5, 1]) {
        deformMatrix(a, b, c, d, t, m);
        const r = deformation(a, b, c, d, t);
        const pojok = [
          [-0.5, -0.5],
          [0.5, -0.5],
          [0.5, 0.5],
          [-0.5, 0.5],
        ];
        pojok.forEach(([x, y], i) => {
          dekat(m[0] * x + m[1] * y, r.deformed[i].x, 1e-12, `x ${a},${b},${c},${d} t ${t}`);
          dekat(m[2] * x + m[3] * y, r.deformed[i].y, 1e-12, `y ${a},${b},${c},${d} t ${t}`);
        });
      }
  });

  it("pelacak memakai u = a x + b y, v = c x + d y dan tetap di dalam bidang", () => {
    const st = createDeformMotion(80);
    const out = keluaran(-1.3, 1.3, -1.3, 1.3);
    const { ctx } = konteks();
    const p = { a: 0.5, b: 1.2, c: -0.7, d: -0.5, waktu: 0.5, invalid: false };
    for (let k = 0; k < 120; k++) {
      // posisi SEBELUM langkah = tempat kecepatannya dievaluasi
      const x0 = Float32Array.from(st.pool.x);
      const y0 = Float32Array.from(st.pool.y);
      const siap = st.siap;
      drawDeformMotion(ctx, k / 240, 1 / 240, out, p, st);
      if (!siap) continue;
      for (let i = 0; i < st.pool.n; i++) {
        dekat(st.pool.u[i], p.a * x0[i] + p.b * y0[i], 1e-5, "u");
        dekat(st.pool.v[i], p.c * x0[i] + p.d * y0[i], 1e-5, "v");
        assert.ok(Math.abs(st.pool.x[i]) <= 1.3 + 1e-6 && Math.abs(st.pool.y[i]) <= 1.3 + 1e-6);
      }
    }
  });
});

describe("FP-01 deret Kármán: hanyut a·f dari vortexStreet", () => {
  const U = 1.2;
  const d = 0.6;
  const r = vortexStreet(U, d, 1.0e-6, 0);
  const p = { d, spacing: r.spacing, rowGap: r.rowGap, frequency: r.frequency, count: 8 };

  it("kecepatan hanyut = 0,87 U, sama dengan a = 0,87 U / f di model", () => {
    dekat(karmanDrift(p), 0.87 * U, 1e-12);
  });

  it("pada t = 0 pusaran sama dengan street model, dan bergeser U_v·t", () => {
    const o = new Float64Array(3);
    for (let j = 0; j < r.street.length; j++) {
      const k = j + 2;
      assert.ok(karmanVortex(p, 0, k, o));
      dekat(o[0], r.street[j].x, 1e-12);
      dekat(o[1], r.street[j].y, 1e-12);
      assert.equal(o[2], r.street[j].sign);
    }
    const t = 0.3 / r.frequency;
    karmanVortex(p, t, 4, o);
    dekat(o[0], r.street[2].x + karmanDrift(p) * t, 1e-9);
  });

  it("tidak ada pusaran yang tergambar di dalam atau di hulu silinder", () => {
    const out = keluaran(-d * 1.6, 30, -2, 2);
    for (const t of [0, 0.4, 1.1, 2.37, 9.9]) {
      const { ctx, rekam } = konteks();
      drawKarmanMotion(ctx, t, out, p);
      assert.ok(rekam.arc.length > 0);
      for (const [px] of rekam.arc) assert.ok(out.map.invX(px) >= d - 1e-9, `x ${out.map.invX(px)}`);
    }
  });

  it("satu pusaran baru per baris per 1/f detik", () => {
    const out = keluaran(-d * 1.6, 1e6, -2, 2);
    const hitung = (t: number) => {
      const { ctx, rekam } = konteks();
      drawKarmanMotion(ctx, t, out, { ...p, count: 2000 });
      return rekam.arc.length;
    };
    // jumlah yang sudah lahir tidak berubah dalam satu periode penuh
    // (yang lahir = yang melewati batas kanan, karena deretnya periodik)
    assert.equal(hitung(0.1 / r.frequency), hitung(1.1 / r.frequency));
  });
});

describe("FP-04 adveksi dan difusi: kepekatan dan jalan acak", () => {
  const M = 50;
  const A = 12;
  const U = 0.4;
  const D = 5;

  it("plumeConcentration = profil advectionDiffusion", () => {
    const r = advectionDiffusion(M, A, U, D, 800, [60, 300, 900, 1800]);
    for (const s of r.snapshots)
      for (const i of [0, 60, 120, 200, 240]) {
        const q = s.profile[i];
        dekat(plumeConcentration(M, A, U, D, q.x, s.t), q.c, 1e-15 + q.c * 1e-12);
      }
  });

  it("partikel: rerata U t dan ragam 2 D t (penyelesaian model)", () => {
    const pool = createPool(4000);
    const dt = 1;
    for (let k = 0; k < 600; k++) stepPlume(pool, U, D, dt, k);
    let s = 0;
    for (let i = 0; i < pool.n; i++) s += pool.x[i];
    const m = s / pool.n;
    let v = 0;
    for (let i = 0; i < pool.n; i++) v += (pool.x[i] - m) ** 2;
    v /= pool.n;
    dekat(m, U * 600, 3 * Math.sqrt((2 * D * 600) / pool.n) + 0.5, "rerata");
    assert.ok(Math.abs(v / (2 * D * 600) - 1) < 0.08, `ragam ${v} lawan ${2 * D * 600}`);
  });

  it("titik zat selalu di bawah kurva kepekatan dan di atas nol", () => {
    const st = createPlumeMotion(300);
    const out = keluaran(-300, 1040, 0, 0.05);
    const { ctx, rekam } = konteks();
    let tt = 0;
    for (let k = 0; k < 50; k++) {
      tt += 3;
      rekam.rect.length = 0;
      drawPlumeMotion(ctx, tt, 3, out, { mass: M, area: A, U, D, tEnd: 1800 }, st);
      const tau = replayTime(tt, 1800, 90);
      rekam.rect.slice(0, -1).forEach(([px, py, w, h], i) => {
        const x = out.map.invX(px + w / 2);
        const c = out.map.invY(py + h / 2);
        assert.ok(c >= 0 && c <= plumeConcentration(M, A, U, D, x, tau) + 1e-9, `partikel ${i}`);
      });
    }
  });
});

describe("PI-04 percobaan Reynolds: manik bergerak u(r), di dalam dinding", () => {
  const D = 0.05;
  const R = D / 2;
  const PANJANG = 2;

  it("filamentY tanpa geser sama dengan bentuk benang lama", () => {
    for (const kacau of [0, 0.4, 1])
      for (const s of [0, 0.13, 0.5, 0.91, 1]) {
        const tumbuh = kacau * s * s;
        const y0 =
          R * 0.34 * tumbuh * (Math.sin(28 * s) + 0.6 * Math.sin(61 * s + 1.1) + 0.35 * Math.sin(133 * s + 2.3));
        assert.equal(filamentY(s, R, kacau), Math.max(-R * 0.94, Math.min(R * 0.94, y0)));
      }
  });

  it("profil: laminar 2V di sumbu, turbulen u_c = V(1 + 1,3√f), nol di dinding", () => {
    const V = 0.3;
    dekat(reynoldsAxisVelocity(V, true, 0.1), 2 * V, 1e-15);
    dekat(reynoldsProfile(0, 2 * V, true), 2 * V, 1e-15);
    dekat(reynoldsProfile(0.5, 2 * V, true), 1.5 * V, 1e-15);
    const f = 0.025;
    const uc = reynoldsAxisVelocity(V, false, f);
    dekat(uc, V * (1 + 1.3 * Math.sqrt(f)), 1e-15);
    dekat(reynoldsAxisVelocity(V, false, NaN), 1.224 * V, 1e-3 * V, "tanpa f: hukum pangkat n = 7");
    dekat(reynoldsProfile(0, uc, false), uc, 1e-15);
    for (const lam of [true, false]) {
      assert.equal(reynoldsProfile(1, uc, lam), 0);
      assert.equal(reynoldsProfile(-1.2, uc, lam), 0);
      assert.ok(reynoldsProfile(0.9, uc, lam) < reynoldsProfile(0.2, uc, lam));
    }
    // Turbulen lebih pepat: di η = 0,8 nisbah u/u_c jauh di atas laminar.
    assert.ok(reynoldsProfile(0.8, 1, false) > 2 * reynoldsProfile(0.8, 1, true));
  });

  it("lajur sama luas: rerata u(r) = V (laminar tepat, turbulen ≈)", () => {
    const n = 46;
    const V = 0.2;
    let lam = 0;
    let tur = 0;
    const uc = reynoldsAxisVelocity(V, false, 0.03);
    for (let i = 0; i < n; i++) {
      lam += reynoldsProfile(beadLane(i, n), 2 * V, true);
      tur += reynoldsProfile(beadLane(i, n), uc, false);
    }
    dekat(lam / n, V, 1e-12, "laminar");
    dekat(tur / n, V, 0.06 * V, "turbulen");
  });

  for (const [nama, Q] of [
    ["laminar", 0.00006],
    ["peralihan", 0.0006],
    ["turbulen", 0.02],
  ] as const) {
    it(`${nama}: laju manik = u(r) di letaknya, rerata awan ≈ V, di dalam |y| < R`, () => {
      const r = reynoldsExperiment(Q, D, 15, 0.4);
      assert.equal(r.regime, nama);
      const laminar = r.regime === "laminar";
      const lewat = r.reynolds / r.criticalReynolds;
      const kacau = Math.min(Math.max(lewat - 1, 0), 3) / 3;
      const ts = reynoldsTimeScale(r.velocity, PANJANG);
      const layar = PANJANG / (r.velocity * ts);
      assert.ok(layar > 3 - 1e-9 && layar <= 30 + 1e-9, `lintasan layar ${layar}`);
      const st = createReynoldsMotion();
      const out = keluaran(-0.08, 2.08, -R * 1.9, R * 1.5);
      const { ctx, rekam } = konteks();
      const V = r.velocity;
      const p = { V, R, length: PANJANG, kacau, laminar, friction: r.friction, color: "#000", timeScale: ts };
      const uc = reynoldsAxisVelocity(V, laminar, r.friction);
      drawReynoldsMotion(ctx, 0, 0, out, p, st);
      let tt = 0;
      const dt = 0.004 / Math.max(V, 1e-9);
      for (let k = 0; k < 40; k++) {
        const x0 = Float32Array.from(st.pool.x);
        const eta0 = Float32Array.from(st.pool.y);
        tt += dt;
        rekam.ruas.length = 0;
        drawReynoldsMotion(ctx, tt, dt, out, p, st);
        let jumlah = 0;
        for (let i = 0; i < st.pool.n; i++) {
          const harap = reynoldsProfile(eta0[i], uc, laminar);
          dekat(st.pool.u[i], harap, 1e-6 * uc, "u manik = profil di letaknya");
          jumlah += st.pool.u[i];
          assert.ok(Math.abs(st.pool.y[i]) < 1, `η ${st.pool.y[i]}`);
          if (st.pool.x[i] < x0[i]) continue; // lahir ulang di pangkal
          dekat((st.pool.x[i] - x0[i]) / dt, harap, harap * 1e-3 + 1e-9, "laju manik");
        }
        // Rerata awan ≈ V. Laminar tepat (lajur sama luas, letaknya tetap);
        // di luar laminar ayunan menggeser lajur, jadi toleransinya lebar.
        dekat(jumlah / st.pool.n, V, (laminar ? 1e-3 : 0.12) * V, "rerata awan");
        for (const [, y0, , y1] of rekam.ruas)
          assert.ok(Math.abs(out.map.invY(y0)) < R && Math.abs(out.map.invY(y1)) < R, "goresan di dalam dinding");
      }
      // Manik di sumbu (η = 0) bergerak u_c: 2V laminar, V(1 + 1,3√f)
      // di luar laminar. Manik lajur terluar jauh lebih lambat.
      st.pool.y[0] = 0;
      if (st.pool.x[0] > PANJANG - 0.01) st.pool.x[0] = 0;
      drawReynoldsMotion(ctx, tt + dt, dt, out, p, st);
      dekat(st.pool.u[0], laminar ? 2 * V : V * (1 + 1.3 * Math.sqrt(r.friction)), 1e-6 * uc, "manik sumbu");
      const luar = st.pool.n - 1;
      assert.ok(st.pool.u[luar] < 0.6 * uc, `manik dekat dinding ${st.pool.u[luar]} lawan u_c ${uc}`);
    });
  }

  it("beadEta selalu di dalam dinding untuk semua lajur dan ayunan", () => {
    for (let i = 0; i < 46; i++)
      for (const s of [0, 0.3, 0.77, 0.99, 1])
        for (const seed of [0, 0.5, 1])
          for (const g of [0, 0.37, 5.1]) assert.ok(Math.abs(beadEta(beadLane(i, 46), s, 1, g, seed)) < 1);
  });
});
