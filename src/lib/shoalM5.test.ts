/*
 * Uji M5 (EH-05): shoal() di hydraulics.ts dijalankan lewat model langkah
 * demi langkah M4 (gerombolan.ts) tanpa mengubah keluarannya.
 *
 * Dua penjaga:
 * 1. shoal(…, steps) = createShoal + steps kali stepShoal + shoalMetrics
 *    dengan benih SHOAL_SEED dan dt SHOAL_DT, KEADAAN PENUH (posisi, arah,
 *    jejak, ukuran keteraturan) identik bit demi bit.
 * 2. Sidik SHA-256 keluaran shoal() yang direkam dari kode SEBELUM M5
 *    (HEAD b5edfc2) untuk enam setelan. Bilangan disidik sebagai 8 bait
 *    Float64 apa adanya, jadi −0 dan 0 dibedakan dan selisih satu ulp pun
 *    mengubah sidiknya.
 *
 * Rujukan model: Couzin dkk. (2002) J. theor. Biol. 218, 1-11, lihat
 * kepala gerombolan.ts. Uji ini tidak memuat angka fisika baru.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  SHOAL_DT,
  SHOAL_SEED,
  createShoal,
  createShoalRng,
  shoalMetrics,
  stepShoal,
} from "./gerombolan.ts";
import { shoal } from "./hydraulics.ts";

/** Sidik kanonik: kunci berurutan, bilangan sebagai bait Float64 */
function sidik(v: unknown): string {
  const h = createHash("sha256");
  const buf = new DataView(new ArrayBuffer(8));
  const jalan = (x: unknown): void => {
    if (typeof x === "number") {
      buf.setFloat64(0, x);
      h.update("n");
      h.update(new Uint8Array(buf.buffer));
    } else if (typeof x === "string") {
      h.update("s" + x.length + ":" + x);
    } else if (typeof x === "boolean") {
      h.update(x ? "T" : "F");
    } else if (Array.isArray(x)) {
      h.update("[" + x.length);
      for (const e of x) jalan(e);
      h.update("]");
    } else if (x && typeof x === "object") {
      const kunci = Object.keys(x).sort();
      h.update("{" + kunci.length);
      for (const k of kunci) {
        h.update("k" + k);
        jalan((x as Record<string, unknown>)[k]);
      }
      h.update("}");
    } else {
      h.update("u");
    }
  };
  jalan(v);
  return h.digest("hex");
}

type Setelan = [number, number, number, number, number?, number?];
const SETELAN: Setelan[] = [
  [40, 1, 1, 0.5],
  [40, 0, 1, 0.5],
  [40, 3, 1, 0.5],
  [25, 0.4, 0.2, 1.2, 0.1, 150],
  [120, 2.5, 3, 2],
  [5, 0, 0, 0, 0.3, 80],
];

/** Direkam dari shoal() pada HEAD b5edfc2, sebelum M5 */
const SIDIK_LAMA: string[] = [
  "11135a639da4ee1a1b6ab65b7ab416e31b1cb1cf5aaa77f6dd18e2d6a48f7938",
  "1d837ae2365b113a8a92f531b2c8db8159a216d0fdf4384fd5a8bb4e92319a4d",
  "9211b5c6408fe55d0f7603268323a3cde500cbc722d4e3d5f8b26bc19ffaa2c6",
  "814089f41f777c2f1db6c4032417e50174a87e813996eb8a2623d8114462f5a3",
  "0a76dc4884de1414307d67d2acbd3aa07c2be52bc06b5f36112d8d2819ef2ab2",
  "ffd6780fab905702cb77b36ee02708dfbce677a090ac1000d9a7d4834b15758c",
];

describe("M5 shoal(): keadaan sama dengan N kali stepShoal berbenih sama", () => {
  for (const [n, a, s, c, noise = 0.1, steps = 300] of SETELAN) {
    it(`shoal(${n}, ${a}, ${s}, ${c}, ${noise}, ${steps})`, () => {
      const r = shoal(n, a, s, c, noise, steps);
      const rng = createShoalRng(SHOAL_SEED);
      const st = createShoal(n, a, s, c, noise, rng, { obstacleCapacity: 0 });
      const trails: { x: number; y: number }[][] = [[], [], [], [], []];
      for (let k = 0; k < steps; k++) {
        stepShoal(st, SHOAL_DT, rng);
        if (k > steps - 60)
          for (let j = 0; j < Math.min(5, st.n); j++) trails[j].push({ x: st.x[j], y: st.y[j] });
      }
      assert.equal(r.agents.length, st.n);
      for (let i = 0; i < st.n; i++) {
        assert.equal(r.agents[i].x, st.x[i]);
        assert.equal(r.agents[i].y, st.y[i]);
        assert.equal(r.agents[i].vx, Math.cos(st.heading[i]) * st.speed);
        assert.equal(r.agents[i].vy, Math.sin(st.heading[i]) * st.speed);
      }
      assert.deepStrictEqual(r.trails, trails);
      const m = shoalMetrics(st);
      assert.deepStrictEqual(
        {
          polarisation: r.polarisation,
          milling: r.milling,
          nearestNeighbour: r.nearestNeighbour,
          spread: r.spread,
          state: r.state,
        },
        m
      );
    });
  }
});

describe("M5 shoal(): keluaran identik dengan sebelum M5 (sidik SHA-256)", () => {
  SETELAN.forEach(([n, a, s, c, noise, steps], i) => {
    it(`shoal(${n}, ${a}, ${s}, ${c}, ${noise ?? "-"}, ${steps ?? "-"})`, () => {
      assert.equal(sidik(shoal(n, a, s, c, noise, steps)), SIDIK_LAMA[i]);
    });
  });
});

