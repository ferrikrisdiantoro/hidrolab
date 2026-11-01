/*
 * Uji M4 gerombolan.ts: gerombolan ikan Couzin dkk. (2002) dengan rintangan
 * Reynolds (1999).
 *
 * Acuan yang dibuka:
 * - Couzin, I.D., Krause, J., James, R., Ruxton, G.D. & Franks, N.R. (2002).
 *   Collective memory and spatial sorting in animal groups. J. theor. Biol.
 *   218, 1-11 (PDF salinan kuliah Princeton COS597C). Hlm. 2-3: zona tolak
 *   berprioritas mutlak; bila tidak ada, d = ½(do + da) atau salah satunya;
 *   vektor nol atau tanpa tetangga: d = v; belok paling besar θτ per langkah;
 *   sudut buta (360 − α). Hlm. 4 pers. (4)-(6): p_group, m_group, c_group.
 * - Reynolds, C.W. (1999). Steering behaviors for autonomous characters.
 *   GDC 99 (red3d.com/cwr/steer/gdc99). Obstacle avoidance: silinder ruang
 *   bebas di depan; untuk rintangan paling mengancam, kemudi = negatif
 *   proyeksi lateral pusat rintangan. Flee = kebalikan seek.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SHOAL_DT,
  SHOAL_SEED,
  addObstacle,
  clearObstacles,
  createShoal,
  createShoalRng,
  setShoalWeights,
  shoalMetrics,
  simulateShoal,
  stepShoal,
} from "./gerombolan.ts";
import { shoal } from "./hydraulics.ts";

describe("gerombolan: kesetaraan dengan shoal() yang dipakai EH-05 (siap untuk M5)", () => {
  const setelan: [number, number, number, number, number?, number?][] = [
    [40, 1, 1, 0.5],
    [40, 0, 1, 0.5],
    [40, 3, 1, 0.5],
    [25, 0.4, 0.2, 1.2, 0.1, 150],
    [120, 2.5, 3, 2],
    [5, 0, 0, 0, 0.3, 80],
  ];
  for (const [n, a, s, c, noise, steps] of setelan) {
    it(`shoal(${n}, ${a}, ${s}, ${c}, ${noise ?? "-"}, ${steps ?? "-"}) identik bit demi bit`, () => {
      const acuan = shoal(n, a, s, c, noise, steps);
      const baru = simulateShoal(n, a, s, c, noise, steps);
      assert.deepStrictEqual(baru, acuan);
    });
  }

  it("simulateShoal = createShoal + N kali stepShoal + shoalMetrics dengan benih sama", () => {
    const rng = createShoalRng(SHOAL_SEED);
    const st = createShoal(40, 1, 1, 0.5, 0.1, rng);
    for (let k = 0; k < 300; k++) stepShoal(st, SHOAL_DT, rng);
    const m = shoalMetrics(st);
    const ref = shoal(40, 1, 1, 0.5);
    assert.equal(m.polarisation, ref.polarisation);
    assert.equal(m.milling, ref.milling);
    assert.equal(m.nearestNeighbour, ref.nearestNeighbour);
    assert.equal(m.spread, ref.spread);
    assert.equal(m.state, ref.state);
    for (let i = 0; i < 40; i++) {
      assert.equal(st.x[i], ref.agents[i].x);
      assert.equal(st.y[i], ref.agents[i].y);
    }
  });
});

describe("gerombolan: aturan Couzin dkk. (2002)", () => {
  it("benih sama memberi hasil sama; benih lain memberi hasil lain", () => {
    const jalan = (seed: number) => {
      const rng = createShoalRng(seed);
      const st = createShoal(30, 1, 1, 0.5, 0.1, rng);
      for (let k = 0; k < 50; k++) stepShoal(st, SHOAL_DT, rng);
      return Array.from(st.x);
    };
    assert.deepStrictEqual(jalan(7), jalan(7));
    assert.notDeepStrictEqual(jalan(7), jalan(8));
  });

  it("zona tolak berprioritas: dua ekor yang terlalu rapat saling menjauh", () => {
    const rng = createShoalRng(1);
    const st = createShoal(2, 1, 1, 1, 0, rng);
    /* berdampingan searah, jarak 0,2 m (di dalam zona tolak 0,8 m). Tanpa
       aturan tolak keduanya akan tetap berjarak 0,2 m selamanya. */
    st.x[0] = 0;
    st.y[0] = 0;
    st.heading[0] = 0;
    st.x[1] = 0;
    st.y[1] = 0.2;
    st.heading[1] = 0;
    stepShoal(st, SHOAL_DT, rng);
    /* langkah pertama: masing-masing berbelok menjauhi yang lain sebesar θτ */
    assert.equal(st.heading[0], -st.turnRate * SHOAL_DT);
    assert.equal(st.heading[1], st.turnRate * SHOAL_DT);
    for (let k = 0; k < 5; k++) stepShoal(st, SHOAL_DT, rng);
    assert.ok(Math.hypot(st.x[1] - st.x[0], st.y[1] - st.y[0]) > 0.8);
  });

  it("belok tiap langkah tidak melebihi laju belok × dt bila ada tetangga", () => {
    const rng = createShoalRng(3);
    const st = createShoal(30, 1, 1, 0.5, 0.1, rng);
    for (let k = 0; k < 20; k++) stepShoal(st, SHOAL_DT, rng);
    const sebelum = Float64Array.from(st.heading);
    stepShoal(st, SHOAL_DT, rng);
    const maks = st.turnRate * SHOAL_DT;
    let ada = 0;
    for (let i = 0; i < 30; i++) {
      if (!st.lastSeen[i]) continue;
      ada++;
      assert.ok(Math.abs(st.heading[i] - sebelum[i]) <= maks + 1e-15);
    }
    assert.ok(ada > 0);
  });

  it("setShoalWeights mengganti lebar zona tanpa mengulang posisi", () => {
    const rng = createShoalRng(5);
    const st = createShoal(20, 1, 1, 0.5, 0.1, rng);
    const x0 = st.x[3];
    setShoalWeights(st, 2, 1, 0.5, 0.1);
    assert.equal(st.x[3], x0);
    assert.equal(st.zoneOrient, 0.8 + 2 * 5);
  });
});

describe("gerombolan: rintangan (Reynolds 1999, obstacle avoidance)", () => {
  /* Dua ekor berjauhan (di luar zona tarik) supaya hanya rintangan yang bekerja */
  const siapkan = () => {
    const rng = createShoalRng(11);
    const st = createShoal(2, 0, 0, 0, 0, rng, { obstacleCapacity: 4 });
    st.x[0] = 0;
    st.y[0] = 0.05;
    st.heading[0] = 0;
    st.x[1] = -500;
    st.y[1] = 0;
    st.heading[1] = Math.PI;
    return { st, rng };
  };

  it("tanpa rintangan ikan lurus menembus tempat rintangan (kontrol)", () => {
    const { st, rng } = siapkan();
    let dMin = Infinity;
    for (let k = 0; k < 60; k++) {
      stepShoal(st, SHOAL_DT, rng);
      dMin = Math.min(dMin, Math.hypot(st.x[0] - 8, st.y[0]));
    }
    assert.ok(dMin < 1);
  });

  it("dengan rintangan jari-jari 1 m di depannya ikan tidak pernah masuk", () => {
    const { st, rng } = siapkan();
    assert.equal(addObstacle(st, 8, 0, 1), true);
    let dMin = Infinity;
    for (let k = 0; k < 60; k++) {
      stepShoal(st, SHOAL_DT, rng);
      dMin = Math.min(dMin, Math.hypot(st.x[0] - 8, st.y[0]));
    }
    assert.ok(dMin >= 1, `jarak terdekat ${dMin}`);
    /* dan ia benar-benar melewatinya, bukan berbalik */
    assert.ok(st.x[0] > 8);
  });

  it("kapasitas rintangan dihormati dan clearObstacles mengosongkan", () => {
    const { st } = siapkan();
    for (let k = 0; k < 4; k++) assert.equal(addObstacle(st, k, 0, 0.5), true);
    assert.equal(addObstacle(st, 9, 9, 0.5), false);
    assert.equal(st.obstacleCount, 4);
    clearObstacles(st);
    assert.equal(st.obstacleCount, 0);
  });
});

describe("gerombolan: tanpa alokasi per langkah dan jejak ekor", () => {
  it("larik keadaan tetap objek yang sama sesudah langkah", () => {
    const rng = createShoalRng(2);
    const st = createShoal(10, 1, 1, 0.5, 0.1, rng, { trailLength: 8 });
    const larik = [st.x, st.y, st.heading, st.trailX, st.trailY];
    for (let k = 0; k < 20; k++) stepShoal(st, SHOAL_DT, rng);
    assert.deepStrictEqual([st.x, st.y, st.heading, st.trailX, st.trailY], larik);
    for (let k = 0; k < 5; k++) assert.equal(larik[k], [st.x, st.y, st.heading, st.trailX, st.trailY][k]);
  });

  it("jejak ekor menyimpan posisi terakhir tiap ekor (cincin)", () => {
    const rng = createShoalRng(2);
    const st = createShoal(10, 1, 1, 0.5, 0.1, rng, { trailLength: 8 });
    for (let k = 0; k < 20; k++) stepShoal(st, SHOAL_DT, rng);
    assert.equal(st.trailCount, 8);
    const terakhir = (st.trailHead + 8 - 1) % 8;
    assert.equal(st.trailX[3 * 8 + terakhir], st.x[3]);
    assert.equal(st.trailY[3 * 8 + terakhir], st.y[3]);
  });
});
