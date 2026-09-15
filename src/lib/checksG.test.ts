import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  checksAquifer,
  checksDam,
  checksFilter,
  checksRockfill,
  checksSeepage,
  checksSleep,
  checksWell,
} from "./checks.ts";
import { evaluate, type Check } from "./verify.ts";

/**
 * Uji blok verifikasi keluarga G.
 *
 * Aturannya sama dengan pekan pertama: blok verifikasi ditampilkan kepada
 * klien dan ikut bergerak saat penggeser diubah, jadi seluruh pemeriksaan
 * harus lolos di SELURUH rentang penggesernya, bukan hanya pada nilai
 * bawaannya. Satu pemeriksaan yang gagal pada satu posisi penggeser akan
 * terlihat oleh klien di layarnya sendiri.
 */

function semuaLolos(checks: Check[], konteks: string) {
  for (const c of checks) {
    const r = evaluate(c);
    assert.ok(
      r.pass,
      `${konteks} | ${c.label.id}: acuan ${c.expected}, hitungan ${c.actual}, selisih ${r.pct.toFixed(4)}%`
    );
  }
}

const SEMUA: [string, Check[]][] = [
  ["GW-01", checksSeepage(8, 12, 6, 3, 2.5, 10, 1e-6, 1e-6)],
  ["GW-02", checksWell(0.02, 1e-4, 25, 0.15, 400, true, 0)],
  ["GW-03", checksAquifer(1.5, 1.2, 0, 0.15, 0.01)],
  ["DM-01", checksDam(40, 6, 30, 38, 3, 0.7, 100, 1 / 3, true)],
  ["DM-02", checksFilter(0.2, 6, 3, 6)],
  ["DM-03", checksRockfill(0.1, 0.2, 0.4, 2)],
  ["SY-01", checksSleep(0.1, null)],
];

describe("Blok verifikasi keluarga G memenuhi aturan PRD", () => {
  it("tiap lembar punya minimal lima pemeriksaan", () => {
    for (const [nama, cs] of SEMUA)
      assert.ok(cs.length >= 5, `${nama} baru punya ${cs.length} pemeriksaan`);
  });

  it("tiap lembar punya minimal satu acuan terbitan, silang, atau pulang pergi", () => {
    for (const [nama, cs] of SEMUA)
      assert.ok(
        cs.some(
          (c) =>
            c.kind === "terbitan" ||
            c.kind === "silang" ||
            c.kind === "pulang-pergi"
        ),
        `${nama} belum punya pemeriksaan terhadap sesuatu di luar dirinya`
      );
  });

  it("tiap pemeriksaan menyebut sumbernya", () => {
    for (const [nama, cs] of SEMUA)
      for (const c of cs)
        assert.ok(c.source.length > 8, `${nama}: sumber "${c.source}" terlalu pendek`);
  });

  it("tiap toleransi yang longgar menyebut alasannya", () => {
    for (const [nama, cs] of SEMUA)
      for (const c of cs)
        if (c.tol > 0.005 && c.tol < 1)
          assert.ok(
            c.tolReason,
            `${nama}: "${c.label.id}" bertoleransi ${c.tol} tanpa alasan`
          );
  });

  it("GW-01 rembesan", () => {
    for (const H of [2, 6, 11])
      for (const mUp of [2, 3, 4])
        for (const mDown of [2, 2.5, 3])
          for (const Ld of [0, 4, 12, 24])
            for (const [kh, kv] of [
              [1e-6, 1e-6],
              [4e-6, 1e-6],
              [1e-7, 4e-7],
            ])
              semuaLolos(
                checksSeepage(H, 12, 6, mUp, mDown, Ld, kh, kv),
                `H=${H} mUp=${mUp} mDown=${mDown} Ld=${Ld} kh=${kh} kv=${kv}`
              );
  });

  it("GW-02 pemompaan air tanah", () => {
    for (const confined of [true, false])
      for (const Q of [0.002, 0.01, 0.03, 0.08])
        for (const k of [1e-5, 1e-4, 1e-3])
          for (const b of [10, 25, 60])
            for (const R of [100, 400, 1500])
              for (const Cw of [0, 2000])
                semuaLolos(
                  checksWell(Q, k, b, 0.15, R, confined, Cw),
                  `${confined} Q=${Q} k=${k} b=${b} R=${R} C=${Cw}`
                );
  });

  it("GW-03 tanggapan air tanah", () => {
    for (const rata of [0.5, 1.5, 4])
      for (const ayun of [0, 0.2, 1, 3])
        for (const pompa of [0, 0.4, 1.2])
          for (const Sy of [0.03, 0.15, 0.35])
            for (const alpha of [0.002, 0.01, 0.06])
              semuaLolos(
                checksAquifer(rata, ayun, pompa, Sy, alpha),
                `R=${rata} A=${ayun} P=${pompa} Sy=${Sy} alfa=${alpha}`
              );
  });

  it("DM-01 stabilitas bendungan", () => {
    for (const tinggi of [15, 40, 80])
      for (const B of [tinggi * 0.5, tinggi * 0.75, tinggi * 1.1])
        for (const H of [tinggi * 0.4, tinggi * 0.95])
          for (const Ht of [0, Math.min(4, H), H * 0.4])
            for (const residual of [1, 1 / 3, 0])
              for (const angkat of [true, false])
                semuaLolos(
                  checksDam(tinggi, 6, B, H, Ht, 0.7, 100, residual, angkat),
                  `Hd=${tinggi} B=${B} H=${H} Ht=${Ht} sisa=${residual} angkat=${angkat}`
                );
  });

  it("DM-02 filter bendungan", () => {
    for (const bD50 of [0.02, 0.2, 2])
      for (const bCu of [1.5, 4, 12, 25])
        for (const fD50 of [bD50 * 2, bD50 * 15, bD50 * 80])
          for (const fCu of [2, 6, 18, 30])
            semuaLolos(
              checksFilter(bD50, bCu, fD50, fCu),
              `bD50=${bD50} bCu=${bCu} fD50=${fD50} fCu=${fCu}`
            );
  });

  it("DM-03 urugan batu", () => {
    for (const i of [0.001, 0.02, 0.2, 1, 4])
      for (const d of [0.01, 0.08, 0.4, 1.2])
        for (const n of [0.2, 0.35, 0.5])
          for (const t of [0.5, 3, 20])
            semuaLolos(checksRockfill(i, d, n, t), `i=${i} d=${d} n=${n} t=${t}`);
  });

  it("SY-01 regulasi tidur", () => {
    for (const amp of [0, 0.04, 0.1, 0.16])
      for (const jadwal of [
        null,
        { bedtime: 23, wakeTime: 5 },
        { bedtime: 20, wakeTime: 6 },
        { bedtime: 1, wakeTime: 9 },
      ])
        semuaLolos(
          checksSleep(amp, jadwal),
          `amp=${amp} jadwal=${jadwal ? `${jadwal.bedtime}-${jadwal.wakeTime}` : "bebas"}`
        );
  });
});
