import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { perluSiapkan, statusSiap, type Soal } from "./kuis.ts";
import { BANK_KUIS } from "../data/kuis/index.ts";

/**
 * Perbaikan Kuis.tsx (batch K-B1): soal atur yang tampil tanpa dibuka
 * (soal pertama saat halaman dimuat, sesudah Soal baru) dulu menulis
 * "Masukan awal soal ini sudah dipasang" padahal siapkan belum dipasang.
 *
 * Aturannya sekarang dua fungsi murni yang dipakai komponen:
 *  - perluSiapkan: syarat pemasangan otomatis saat soal DIBUKA (klik kotak
 *    atau Soal berikutnya). Syaratnya sama persis dengan kode lama, jadi
 *    bank yang ada tidak berubah perilaku
 *  - statusSiap: "belum" (tampil tombol Pasang masukan soal), "sudah"
 *    (teks terpasang), "tanpa" (soal tanpa siapkan: tidak ada keduanya)
 */

const atur = (siapkan?: Record<string, number>): Soal => ({
  jenis: "atur",
  id: "t",
  tanya: { id: "", en: "" },
  bahas: { id: "", en: "" },
  ukur: (k) => k.a,
  target: { min: 4, max: 6 },
  geser: { kunci: "a", p: { min: 0, max: 10, step: 1 } },
  siapkan,
});

/** Syarat lama di buka(): atur && siapkan && !dijawab && !disiapkan. */
const syaratLama = (q: Soal, dijawab: boolean, dipasang: ReadonlySet<string>) =>
  q.jenis === "atur" && !!q.siapkan && !dijawab && !dipasang.has(q.id);

describe("statusSiap dan perluSiapkan (Kuis.tsx)", () => {
  it("soal atur bersiapkan yang belum dipasang berstatus belum, bukan sudah", () => {
    assert.equal(statusSiap(atur({ a: 1 }), new Set()), "belum");
    assert.equal(statusSiap(atur({ a: 1 }), new Set(["t"])), "sudah");
  });
  it("soal tanpa siapkan dan soal bukan atur tidak menulis apa pun", () => {
    assert.equal(statusSiap(atur(), new Set()), "tanpa");
    assert.equal(statusSiap(atur(), new Set(["t"])), "tanpa");
  });
  it("pemasangan saat dibuka: sekali, tidak sesudah dijawab", () => {
    assert.equal(perluSiapkan(atur({ a: 1 }), false, new Set()), true);
    assert.equal(perluSiapkan(atur({ a: 1 }), true, new Set()), false);
    assert.equal(perluSiapkan(atur({ a: 1 }), false, new Set(["t"])), false);
    assert.equal(perluSiapkan(atur(), false, new Set()), false);
  });

  for (const bank of Object.values(BANK_KUIS)) {
    it(`bank ${bank.kode}: syarat buka sama dengan kode lama, status per jenis, 200 benih`, () => {
      for (let b = 1; b <= 200; b++)
        for (const q of bank.buat(b)) {
          for (const dijawab of [false, true])
            for (const dip of [new Set<string>(), new Set([q.id])])
              assert.equal(perluSiapkan(q, dijawab, dip), syaratLama(q, dijawab, dip), `${q.id}`);
          const st = statusSiap(q, new Set());
          if (q.jenis === "atur" && q.siapkan) assert.equal(st, "belum", q.id);
          else assert.equal(st, "tanpa", q.id);
        }
    });
  }
});
