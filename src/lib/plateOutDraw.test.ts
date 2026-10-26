import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { PlateMap, PlateOut } from "./plateOut.ts";
import { drawChart } from "./drawChart.ts";
import { drawStructure } from "./drawStructure.ts";
import { drawField } from "./drawField.ts";
import { drawReach } from "./drawReach.ts";
import { drawJump } from "./drawJump.ts";
import { drawTransition } from "./drawTransition.ts";
import { drawEnergy } from "./drawEnergy.ts";
import { drawGvf } from "./drawGvf.ts";
import { drawNappe } from "./drawNappe.ts";
import { drawOrifice } from "./drawOrifice.ts";
import { drawNotch } from "./drawNotch.ts";
import { drawVenturi } from "./drawVenturi.ts";
import { drawPitot } from "./drawPitot.ts";
import { drawTracer } from "./drawTracer.ts";
import { drawMoody } from "./drawMoody.ts";
import {
  VENTURI_C_MACHINED,
  criticalDepth,
  frictionFactor,
  gvfProfile,
  normalDepth,
  normalDepthReachable,
  notchDischarge,
  orificeJet,
  pitotVelocity,
  powerLawMeanRadius,
  powerLawMeanRatio,
  powerLawVelocity,
  rectWeirDischarge,
  reynolds,
  tracerCurve,
  transition,
  venturiDischarge,
} from "./hydraulics.ts";

/*
 * PlateOut penggambar (Phase 2 tahap S2).
 *
 * Konteks palsu: semua perintah gambar tidak berbuat apa-apa, measureText
 * memberi lebar 6,5 px per huruf. Yang diuji hanya keluaran PlateOut:
 * invX(X(v)) = v dan invY(Y(v)) = v pada peta setiap panel, dan setiap
 * titik bernama berada di dalam bingkai salah satu panel untuk keadaan
 * awal lembar (nilai bawaan penggeser di Client), pada lebar layar lebar
 * (820 x 504, kira-kira bidang gambar di 1280) dan HP (358 x 360).
 */

function konteksPalsu(w: number): CanvasRenderingContext2D {
  const nop = () => {};
  const ctx: Record<string, unknown> = {
    canvas: { width: w, height: 600 },
    font: "10px sans-serif",
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: "left",
    textBaseline: "alphabetic",
    lineCap: "butt",
    lineJoin: "miter",
    measureText: (t: string) => ({ width: [...String(t)].length * 6.5 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    getLineDash: () => [],
  };
  for (const m of [
    "beginPath", "moveTo", "lineTo", "stroke", "fill", "rect", "clip", "save",
    "restore", "arc", "closePath", "fillRect", "strokeRect", "fillText",
    "strokeText", "setLineDash", "setTransform", "translate", "rotate",
    "scale", "clearRect", "quadraticCurveTo", "bezierCurveTo", "ellipse",
  ])
    ctx[m] = nop;
  return ctx as unknown as CanvasRenderingContext2D;
}

const UKURAN: [number, number][] = [
  [820, 504],
  [358, 360],
];

function cekPeta(nama: string, m: PlateMap) {
  const { x0, x1, y0, y1 } = m.frame;
  assert.ok(x1 > x0 && y1 > y0, `${nama}: bingkai kosong`);
  // Nilai di beberapa piksel sepanjang bingkai: X(invX(px)) = px, lalu
  // invX(X(v)) = v untuk nilai v itu.
  for (const f of [0, 0.25, 0.5, 0.9, 1]) {
    const px = x0 + f * (x1 - x0);
    const vx = m.invX(px);
    assert.ok(Number.isFinite(vx), `${nama}: invX tak hingga`);
    assert.ok(Math.abs(m.X(vx) - px) < 1e-6, `${nama}: X(invX(${px})) = ${m.X(vx)}`);
    const balikX = m.invX(m.X(vx));
    assert.ok(Math.abs(balikX - vx) <= 1e-9 * Math.max(1, Math.abs(vx)), `${nama}: invX(X(${vx})) = ${balikX}`);

    const py = y0 + f * (y1 - y0);
    const vy = m.invY(py);
    assert.ok(Number.isFinite(vy), `${nama}: invY tak hingga`);
    assert.ok(Math.abs(m.Y(vy) - py) < 1e-6, `${nama}: Y(invY(${py})) = ${m.Y(vy)}`);
    const balikY = m.invY(m.Y(vy));
    assert.ok(Math.abs(balikY - vy) <= 1e-9 * Math.max(1, Math.abs(vy)), `${nama}: invY(Y(${vy})) = ${balikY}`);
  }
}

function cek(nama: string, out: PlateOut, wajib: string[]) {
  const peta: [string, PlateMap][] = [["map", out.map], ...Object.entries(out.maps ?? {})];
  for (const [k, m] of peta) cekPeta(`${nama} ${k}`, m);
  const anchors = out.anchors ?? {};
  for (const k of wajib) assert.ok(k in anchors, `${nama}: titik ${k} tidak ada`);
  for (const [k, a] of Object.entries(anchors)) {
    assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y), `${nama}: ${k} tak hingga`);
    const dalam = peta.some(
      ([, m]) => a.x >= m.frame.x0 - 0.5 && a.x <= m.frame.x1 + 0.5 && a.y >= m.frame.y0 - 0.5 && a.y <= m.frame.y1 + 0.5
    );
    assert.ok(dalam, `${nama}: ${k} (${a.x.toFixed(1)}, ${a.y.toFixed(1)}) di luar bingkai`);
  }
  for (const poli of out.waters ?? (out.water ? [out.water] : [])) {
    assert.ok(poli.length >= 6 && poli.length % 2 === 0, `${nama}: poligon air rusak`);
    for (let i = 0; i < poli.length; i++) assert.ok(Number.isFinite(poli[i]), `${nama}: poligon air tak hingga`);
  }
  if (out.water && out.waters) assert.equal(out.water, out.waters[0], `${nama}: water bukan waters[0]`);
}

function keDua(nama: string, gambar: (ctx: CanvasRenderingContext2D, w: number, h: number) => PlateOut, wajib: string[]) {
  for (const [w, h] of UKURAN) {
    it(`${nama} ${w}x${h}`, () => cek(`${nama} ${w}`, gambar(konteksPalsu(w), w, h), wajib));
  }
}

describe("PlateOut penggambar bersama", () => {
  keDua(
    "drawChart linier",
    (ctx, w, h) =>
      drawChart(
        ctx,
        w,
        h,
        {
          xMin: 0,
          xMax: 10,
          yMin: 0,
          yMax: 5,
          axisX: "x",
          axisY: "y",
          series: [{ pts: [{ x: 0, y: 0 }, { x: 10, y: 4 }], label: "kurva" }],
          regions: [{ x: 2, y: 4, text: "wilayah" }],
          point: { x: 6, y: 2.4, label: "titik" },
        },
        "id"
      ),
    ["point"]
  );
  keDua(
    "drawChart log (Shields)",
    (ctx, w, h) =>
      drawChart(
        ctx,
        w,
        h,
        {
          xMin: 0.1,
          xMax: 1000,
          yMin: 0.01,
          yMax: 1,
          xLog: true,
          yLog: true,
          axisX: "D*",
          axisY: "θ",
          series: [{ pts: [{ x: 0.1, y: 0.3 }, { x: 1000, y: 0.05 }] }],
          point: { x: 25, y: 0.12 },
          anchors: { curveStart: { x: 1, y: 0.2 } },
        },
        "id"
      ),
    ["point", "curveStart"]
  );
  keDua(
    "drawStructure bendung",
    (ctx, w, h) =>
      drawStructure(
        ctx,
        w,
        h,
        {
          xMin: -6,
          xMax: 10,
          zMin: 0,
          zMax: 5,
          bodies: [{ pts: [{ x: 0, z: 0 }, { x: 0, z: 3 }, { x: 1, z: 3.2 }, { x: 4, z: 0 }] }],
          waters: [
            { surface: [{ x: -6, z: 4.2 }, { x: 0.5, z: 3.9 }], bed: [{ x: 0, z: 0 }, { x: -6, z: 0 }] },
            { surface: [{ x: 4, z: 0.8 }, { x: 10, z: 0.8 }] },
          ],
          vectors: [{ x: 2, z: 1, dx: 20, dy: -10, text: "W" }],
          anchors: { headwater: { x: -3, z: 4.2 } },
          axisX: "x",
          axisZ: "z",
        },
        "id"
      ),
    ["crest", "upstreamSurface", "downstreamSurface", "water0Start", "water1End", "vector0", "headwater"]
  );
  keDua(
    "drawField medan",
    (ctx, w, h) =>
      drawField(
        ctx,
        w,
        h,
        {
          xMin: -2,
          xMax: 2,
          yMin: -1,
          yMax: 1,
          axisX: "x",
          axisY: "y",
          bodies: [{ pts: [{ x: -0.2, y: -0.2 }, { x: 0.2, y: -0.2 }, { x: 0.2, y: 0.2 }, { x: -0.2, y: 0.2 }] }],
          arrows: [{ x: -1.5, y: 0.5, dx: 0.4, dy: 0 }],
          markers: [{ x: 1, y: 0, heading: 0 }],
          lines: [{ pts: [{ x: -2, y: 0.6 }, { x: 2, y: 0.6 }], label: "garis arus" }],
        },
        "id"
      ),
    ["marker0", "arrow0", "arrow0Tip", "body0"]
  );
  keDua(
    "drawReach saluran",
    (ctx, w, h) =>
      drawReach(ctx, w, h, {
        length: 1000,
        bed: [{ x: 0, z: 2 }, { x: 1000, z: 0 }],
        water: [{ x: 0, z: 3.5 }, { x: 500, z: 2.4 }, { x: 1000, z: 1.2 }],
        markers: [{ x: 500, label: "penampang", color: "#000" }],
        regions: [{ x: 500, z: 3.5, text: "M2", big: true }],
        axisX: "x",
        axisZ: "z",
      }),
    ["upstreamSurface", "downstreamSurface", "upstreamBed", "downstreamBed", "marker0"]
  );
});

describe("PlateOut penggambar tunggal, keadaan awal lembar", () => {
  // OC-01: y1 0,3 m, V1 7 m/s, garis energi dan goresan tampil
  keDua(
    "drawJump OC-01",
    (ctx, w, h) => drawJump(ctx, w, h, { y1: 0.3, V1: 7 }, { lang: "id", showEnergy: true }),
    ["upstreamSurface", "downstreamSurface", "toe", "jumpEnd", "energyUpstream"]
  );
  keDua(
    "drawJump pembuka (compact)",
    (ctx, w, h) => drawJump(ctx, w, h, { y1: 0.3, V1: 7 }, { compact: true, showDims: false }),
    ["toe", "jumpEnd"]
  );

  // OC-04/05/07 (TransitionSheet)
  for (const [kode, awal] of [
    ["OC-04", { Q: 12, b1: 5, y1: 1.5, b2: 4.2, dz: 0.12 }],
    ["OC-05", { Q: 12, b1: 5, y1: 1.5, b2: 4.2, dz: 0 }],
    ["OC-07", { Q: 12, b1: 5, y1: 1.5, b2: 5, dz: 0.15 }],
  ] as const) {
    const r = transition(awal);
    keDua(
      `drawTransition ${kode}`,
      (ctx, w, h) => drawTransition(ctx, w, h, { r, b1: awal.b1, b2: awal.b2, y1: awal.y1, dz: awal.dz }, "id"),
      ["upstreamSurface", "downstreamSurface", "step", "b1Edge", "b2Edge"]
    );
  }

  // OC-02: Q 12, b 5, n 0,025, S 0,0015
  {
    const q = 12 / 5;
    const y0 = normalDepth(12, 5, 0.025, 0.0015);
    const ok = normalDepthReachable(12, 5, 0.025, 0.0015);
    keDua(
      "drawEnergy OC-02",
      (ctx, w, h) => drawEnergy(ctx, w, h, { q, b: 5, yc: criticalDepth(q), y0: ok ? y0 : NaN }, "id"),
      ["critical", "normal"]
    );
  }

  // OC-03: Q 12, b 5, n 0,025, S0 0,0015, kendali 2,5 m, L 1200 m
  keDua(
    "drawGvf OC-03",
    (ctx, w, h) =>
      drawGvf(
        ctx,
        w,
        h,
        {
          result: gvfProfile(12, 5, 0.025, 0.0015, 2.5, 1200, 400),
          length: 1200,
          S0: 0.0015,
          normalUnreachable: !normalDepthReachable(12, 5, 0.025, 0.0015),
        },
        "id"
      ),
    ["control", "controlBed", "upstreamBed", "downstreamBed", "normalDepth", "criticalDepth"]
  );

  // HS-06: h 0,3, P 0,6, b 2, hilir 0,2, berudara
  {
    const r = rectWeirDischarge(0.3, 2, 0.6);
    keDua(
      "drawNappe HS-06",
      (ctx, w, h) =>
        drawNappe(ctx, w, h, { h: 0.3, P: 0.6, V0: r.V0, q: r.Q / 2, tail: 0.2, outOfRange: r.outOfRange, aerated: true }, "id"),
      ["crest", "headwater", "tailwater", "nappeLanding"]
    );
  }

  // HS-07: H 1,5, a 0,05, b 0,1, z0 0,6, Cv 0,98, Cc 0,62
  {
    const r = orificeJet(1.5, 0.05, 0.1, 0.98, 0.62);
    keDua(
      "drawOrifice HS-07",
      (ctx, w, h) =>
        drawOrifice(
          ctx,
          w,
          h,
          { H: 1.5, a: 0.05, z0: 0.6, Cc: 0.62, V: r.V, Vth: r.Vth, xVena: r.xVena, notSubmerged: !r.submerged },
          "id"
        ),
      ["surface", "orifice", "orificeTop", "vena", "jetEnd"]
    );
  }

  // FM-01: H 0,2, θ 90
  {
    const n = notchDischarge(0.2, 90);
    keDua(
      "drawNotch FM-01",
      (ctx, w, h) =>
        drawNotch(ctx, w, h, { H: 0.2, theta: 90, Q: n.Q, outOfRange: n.outOfRange, angleOutOfRange: n.reason === "sudut" }, "id"),
      ["surface", "apex", "notchEdge"]
    );
    it("drawNotch FM-01 layar lebar punya titik kerja kurva debit", () => {
      const out = drawNotch(konteksPalsu(820), 820, 504, { H: 0.2, theta: 90, Q: n.Q, outOfRange: false, angleOutOfRange: false }, "id");
      assert.ok(out.anchors?.point && out.maps?.rating);
    });
  }

  // FM-02: D1 0,2, D2 0,1, Δh 0,5
  {
    const r = venturiDischarge(0.2, 0.1, 0.5, VENTURI_C_MACHINED);
    keDua(
      "drawVenturi FM-02",
      (ctx, w, h) =>
        drawVenturi(
          ctx,
          w,
          h,
          {
            D1: 0.2,
            D2: 0.1,
            V1: r.V1,
            V2: r.V2,
            dh: 0.5,
            permanentLoss: r.permanentLoss,
            outOfRange: r.outOfRange,
            notVenturi: r.reason === "bukan-venturi",
          },
          "id"
        ),
      ["pipeWall", "throatWall", "headInlet", "headThroat"]
    );
  }

  // FM-03: Δh 0,3, D 0,2, n 7, tabung di sumbu
  {
    const R = 0.1;
    const uMax = pitotVelocity(0.3);
    keDua(
      "drawPitot FM-03",
      (ctx, w, h) =>
        drawPitot(
          ctx,
          w,
          h,
          {
            D: 0.2,
            uMax,
            uMean: uMax * powerLawMeanRatio(7),
            n: 7,
            rProbe: 0,
            rMean: powerLawMeanRadius(R, 7),
            uProbe: powerLawVelocity(0, R, uMax, 7),
          },
          "id"
        ),
      ["probe", "probeReading", "meanRadius", "wall"]
    );
  }

  // FM-05: Q 1,2, M 2, L 120, A 1,5, D 3, B 4
  {
    const r = tracerCurve(1.2, 2, 120, 1.5, 3);
    const lebar = tracerCurve(1.2, 2, 120, 1.5, 9);
    const c2 = (0.5 * 200000 + 1.2 * 1000 * 5) / (0.5 + 1.2 * 1000);
    keDua(
      "drawTracer FM-05",
      (ctx, w, h) =>
        drawTracer(
          ctx,
          w,
          h,
          {
            points: r.points,
            cPeak: r.cPeak,
            tPeak: r.tPeak,
            tTravel: r.tTravel,
            area: r.area,
            Qgulp: r.Qgulp,
            compare: lebar.points,
            plateau: c2 - 5,
            outOfRange: false,
          },
          "id"
        ),
      ["peak"]
    );
  }

  // PI-01: V 2, D 0,3, ε 0,26 mm, T 20 °C
  {
    const nu = 1.79e-6 / (1 + 0.03368 * 20 + 0.000221 * 400);
    const Re = reynolds(2, 0.3, nu);
    const relRough = 0.26e-3 / 0.3;
    const { f, regime } = frictionFactor(Re, relRough);
    keDua(
      "drawMoody PI-01",
      (ctx, w, h) => drawMoody(ctx, w, h, { Re, relRough, f, regime }, "id"),
      ["point", "roughnessEnd"]
    );
    it("drawMoody: invX membaca Re titik kerja kembali (sumbu log)", () => {
      const out = drawMoody(konteksPalsu(820), 820, 504, { Re, relRough, f, regime }, "id");
      const a = out.anchors!.point;
      assert.ok(Math.abs(out.map.invX(a.x) / Re - 1) < 1e-9);
      assert.ok(Math.abs(out.map.invY(a.y) / f - 1) < 1e-9);
    });
  }
});
