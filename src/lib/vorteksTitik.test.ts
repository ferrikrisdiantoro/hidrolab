/*
 * Uji M3 vorteksTitik.ts: dinamika titik pusaran 2D.
 *
 * Acuan yang dibuka (teks Internet Archive, dli.ernet.3284, Lamb 1932 ed. 6):
 * - Art. 154 (hlm. 219-220): pusaran berkekuatan κ memberi kecepatan κ/(2πr)
 *   tegak lurus garis penghubung; Σκu = 0, Σκv = 0 sehingga pusat
 *   (Σκx/Σκ, Σκy/Σκ) tetap.
 * - Art. 155 (hlm. 221): dua pusaran berjarak tetap, berputar terhadap pusat
 *   dengan kecepatan sudut (κ1+κ2)/(2π AB²); bila κ1 = −κ2 keduanya melaju
 *   κ/(2π AB) tegak lurus AB ("vortex-pair").
 * - Art. 167 (hlm. 229-230): bentuk Kirchhoff, W ∝ Σ κ1κ2 log r12 tetap,
 *   Σκx, Σκy tetap, dan Σκr² tetap (pers. 7).
 * - Art. 27 dan Art. 168 pers. (1)-(2): inti berpusaran seragam jari-jari a,
 *   kecepatan di dalamnya sebanding r (dipakai untuk inti teredam).
 * Saffman (1992) bab 2 TIDAK dapat dibuka; tidak ada angka yang diambil darinya.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  advanceVortices,
  createVortexSystem,
  pairAngularVelocity,
  pairTranslationSpeed,
  stepVortices,
  vortexInvariants,
  vortexTimeStep,
  vortexVelocityAt,
} from "./vorteksTitik.ts";
import { vortexPair } from "./hydraulics.ts";

const dekat = (a: number, b: number, tol: number, pesan?: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${pesan ?? ""} ${a} vs ${b} (tol ${tol})`);

describe("vorteksTitik: medan satu pusaran (Lamb 1932 Art. 154)", () => {
  it("kecepatan κ/(2πr) tegak lurus jari-jari, berlawanan jarum jam untuk κ > 0", () => {
    const s = createVortexSystem([{ x: 0, y: 0, gamma: 10 }]);
    const v = vortexVelocityAt(s, 2, 0);
    dekat(v.u, 0, 1e-15);
    dekat(v.v, 10 / (2 * Math.PI * 2), 1e-15);
  });

  it("inti Rankine (Lamb Art. 27): di dalam inti sebanding r, di luar sama dengan titik", () => {
    const s = createVortexSystem([{ x: 0, y: 0, gamma: 10 }], { core: 1 });
    const dalam = vortexVelocityAt(s, 0.5, 0);
    dekat(dalam.v, (10 * 0.5) / (2 * Math.PI * 1 * 1), 1e-15);
    const luar = vortexVelocityAt(s, 3, 0);
    dekat(luar.v, 10 / (2 * Math.PI * 3), 1e-15);
    /* sambung di tepi inti */
    dekat(vortexVelocityAt(s, 1, 0).v, 10 / (2 * Math.PI), 1e-15);
    /* tidak tak hingga di pusatnya */
    assert.equal(vortexVelocityAt(s, 0, 0).v, 0);
  });

  it("pusaran sendirian diam (Lamb Art. 155, 1°)", () => {
    const s = createVortexSystem([{ x: 1, y: 2, gamma: 25 }]);
    stepVortices(s, 0.1);
    assert.equal(s.x[0], 1);
    assert.equal(s.y[0], 2);
  });
});

describe("vorteksTitik: kasus analitik dua pusaran (Lamb 1932 Art. 155)", () => {
  it("pasangan berlawanan sama kuat melaju lurus Γ/(2πd) dan jaraknya tetap", () => {
    const G = 10;
    const d = 2;
    const s = createVortexSystem([
      { x: -d / 2, y: 0, gamma: G },
      { x: d / 2, y: 0, gamma: -G },
    ]);
    const T = 5;
    advanceVortices(s, T, 0.02);
    const U = pairTranslationSpeed(G, d);
    dekat(U, G / (2 * Math.PI * d), 1e-15);
    /* B (−Γ, searah jarum jam, di x = +d/2) membawa A ke +y; A (+Γ,
       berlawanan jarum jam) membawa B ke +y juga; keduanya melaju bersama */
    dekat(s.y[0], U * T, 1e-9, "y A");
    dekat(s.y[1], U * T, 1e-9, "y B");
    dekat(s.x[0], -d / 2, 1e-9, "x A tetap");
    dekat(Math.hypot(s.x[1] - s.x[0], s.y[1] - s.y[0]), d, 1e-12, "jarak");
    dekat(s.t, T, 1e-12);
  });

  it("pasangan searah berputar kaku terhadap pusat sirkulasi dengan Ω = (Γ1+Γ2)/(2πd²)", () => {
    const g1 = 30;
    const g2 = 10;
    const d = 1.5;
    const s = createVortexSystem([
      { x: 0, y: 0, gamma: g1 },
      { x: d, y: 0, gamma: g2 },
    ]);
    const Om = pairAngularVelocity(g1, g2, d);
    dekat(Om, (g1 + g2) / (2 * Math.PI * d * d), 1e-15);
    const xc = (g1 * 0 + g2 * d) / (g1 + g2);
    const T = 3;
    advanceVortices(s, T, 0.01);
    const sudut = Om * T;
    /* posisi analitik: putar terhadap (xc, 0) */
    dekat(s.x[0], xc + (0 - xc) * Math.cos(sudut), 1e-8, "x A");
    dekat(s.y[0], (0 - xc) * Math.sin(sudut), 1e-8, "y A");
    dekat(s.x[1], xc + (d - xc) * Math.cos(sudut), 1e-8, "x B");
    dekat(s.y[1], (d - xc) * Math.sin(sudut), 1e-8, "y B");
  });

  it("kasus terberat penggeser FP-02 (Γ 40/40, d 0,5, 20 s, Ω·T ≈ 1019 rad): galat fase kecil dan berorde empat", () => {
    const galatFase = (maxAngle: number) => {
      const s = createVortexSystem([
        { x: -0.25, y: 0, gamma: 40 },
        { x: 0.25, y: 0, gamma: 40 },
      ]);
      advanceVortices(s, 20, maxAngle);
      const sudut = pairAngularVelocity(40, 40, 0.5) * 20;
      const a = Math.atan2(-s.y[0], -s.x[0]);
      return Math.abs(Math.atan2(Math.sin(a - sudut), Math.cos(a - sudut)));
    };
    const e1 = galatFase(0.05);
    const e2 = galatFase(0.025);
    /* 0,05 rad per langkah: tertinggal kurang dari 0,002 rad sesudah 1019 rad */
    assert.ok(e1 < 2e-3, `galat fase ${e1}`);
    /* RK4: separuh langkah memperkecil galat sekitar 2⁴ kali (atau lebih) */
    assert.ok(e1 / e2 > 14, `nisbah ${e1 / e2}`);
  });
});

describe("vorteksTitik: cocok dengan bentuk tertutup vortexPair yang dipakai FP-02 sekarang", () => {
  for (const [gA, gB, d] of [
    [10, -10, 2],
    [30, 10, 1.5],
    [10, -40, 3],
  ] as const) {
    it(`Γ ${gA}/${gB}, d ${d}: posisi akhir sama dengan vortexPair`, () => {
      const T = 6;
      const ref = vortexPair(gA, gB, d, T);
      const s = createVortexSystem([
        { x: -d / 2, y: 0, gamma: gA },
        { x: d / 2, y: 0, gamma: gB },
      ]);
      advanceVortices(s, T, 0.01);
      const a = ref.pathA[ref.pathA.length - 1];
      const b = ref.pathB[ref.pathB.length - 1];
      dekat(s.x[0], a.x, 1e-7, "x A");
      dekat(s.y[0], a.y, 1e-7, "y A");
      dekat(s.x[1], b.x, 1e-7, "x B");
      dekat(s.y[1], b.y, 1e-7, "y B");
    });
  }
});

describe("vorteksTitik: invarian Kirchhoff (Lamb 1932 Art. 154, 167)", () => {
  const susun = (core = 0) =>
    createVortexSystem(
      [
        { x: 0, y: 0, gamma: 12 },
        { x: 1.3, y: 0.2, gamma: -7 },
        { x: -0.4, y: 1.1, gamma: 5 },
        { x: 0.6, y: -0.9, gamma: 9 },
      ],
      { core }
    );

  for (const core of [0, 0.3]) {
    it(`sirkulasi, pusat, impuls sudut, Hamiltonian tetap (inti ${core} m)`, () => {
      const s = susun(core);
      const a = vortexInvariants(s);
      advanceVortices(s, 4, 0.02);
      const b = vortexInvariants(s);
      assert.equal(b.circulation, a.circulation);
      dekat(b.impulseX, a.impulseX, 1e-10, "ΣΓx");
      dekat(b.impulseY, a.impulseY, 1e-10, "ΣΓy");
      dekat(b.centreX, a.centreX, 1e-10, "pusat x");
      dekat(b.centreY, a.centreY, 1e-10, "pusat y");
      dekat(b.angularImpulse, a.angularImpulse, 1e-6 * Math.abs(a.angularImpulse), "ΣΓr²");
      dekat(b.hamiltonian, a.hamiltonian, 1e-6 * Math.abs(a.hamiltonian), "H");
      /* sistem benar-benar bergerak, bukan diam */
      assert.ok(Math.abs(s.x[0]) > 1e-3);
    });
  }

  it("Hamiltonian sama dengan −(1/2π) Σ_{i<j} ΓiΓj ln rij untuk inti nol", () => {
    const s = createVortexSystem([
      { x: 0, y: 0, gamma: 2 },
      { x: 3, y: 4, gamma: 5 },
    ]);
    dekat(vortexInvariants(s).hamiltonian, -(2 * 5 * Math.log(5)) / (2 * Math.PI), 1e-14);
  });

  it("pusat tak tentu bila jumlah sirkulasi nol", () => {
    const s = createVortexSystem([
      { x: 0, y: 0, gamma: 3 },
      { x: 1, y: 0, gamma: -3 },
    ]);
    const inv = vortexInvariants(s);
    assert.ok(Number.isNaN(inv.centreX));
  });
});

describe("vorteksTitik: langkah waktu dan partikel pelacak", () => {
  it("vortexTimeStep membatasi sudut putar pasangan tercepat per langkah", () => {
    const s = createVortexSystem([
      { x: 0, y: 0, gamma: 40 },
      { x: 0.5, y: 0, gamma: 40 },
    ]);
    const dt = vortexTimeStep(s, 0.05);
    dekat(dt * pairAngularVelocity(40, 40, 0.5), 0.05, 1e-12);
  });

  it("partikel pelacak dibawa medan: di dekat pasangan berlawanan ikut melaju", () => {
    const G = 10;
    const d = 2;
    const s = createVortexSystem(
      [
        { x: -d / 2, y: 0, gamma: G },
        { x: d / 2, y: 0, gamma: -G },
      ],
      { tracers: 2 }
    );
    /* titik tengah pasangan: kecepatan 2·Γ/(2π·d/2) ke +y */
    s.tx[0] = 0;
    s.ty[0] = 0;
    /* titik jauh nyaris diam */
    s.tx[1] = 500;
    s.ty[1] = 0;
    const v0 = vortexVelocityAt(s, 0, 0);
    dekat(v0.v, (2 * G) / (2 * Math.PI * (d / 2)), 1e-12);
    stepVortices(s, 0.01);
    assert.ok(s.ty[0] > 0);
    assert.ok(Math.abs(s.ty[1]) < 1e-5);
  });

  it("stepVortices tidak mengalokasi larik baru (larik keadaan tetap sama)", () => {
    const s = createVortexSystem([
      { x: 0, y: 0, gamma: 1 },
      { x: 1, y: 0, gamma: 1 },
    ]);
    const xs = s.x;
    stepVortices(s, 0.1);
    assert.equal(s.x, xs);
  });
});
