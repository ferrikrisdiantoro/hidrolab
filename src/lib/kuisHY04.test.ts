import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { kisi, nilaiJawab, type Soal } from "./kuis.ts";
import { BANK_KUIS } from "../data/kuis/index.ts";
import { dataSoal, sidikData } from "../data/kuis/dataSoal.ts";
import { fitRating, ratingValue } from "./discharge.ts";

/**
 * Bank HY-04 Lengkung debit (KUIS.md putaran 2 + revisi insinyur 1 November):
 * kunci = fitRating/ratingValue pada data soal yang DIMUAT ke tabel (sudah
 * dibulatkan), H di kisi penggeser lembar (0 … 1,5·hDataMax, langkah 0,01).
 */

const BENIH = 1000;
const diKisi = (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
const maksPenggeser = (hDataMax: number) => Math.ceil(Math.max(0.1, hDataMax * 1.5) * 100 - 1e-9) / 100;

describe(`HY-04 lengkung debit: kunci dari lib, ${BENIH} benih`, () => {
  const bank = BANK_KUIS["HY-04"];
  it("bank terdaftar dengan lima butir", () => {
    assert.ok(bank, "HY-04 belum terdaftar di BANK_KUIS");
    assert.equal(bank.jumlah, 5);
  });
  const semua: Soal[][] = [];
  for (let b = 1; b <= BENIH; b++) semua.push(bank ? bank.buat(b) : []);
  const soal = (i: number, id: string) => semua[i].find((q) => q.id === id)!;

  it("tiap soal membawa 8–12 pasangan positif, H di kisi 0,01, Q tiga desimal, dan sidiknya", () => {
    for (const ss of semua)
      for (const q of ss) {
        const d = dataSoal(q);
        assert.ok(d, `${q.id} tanpa data`);
        assert.ok(d.length >= 8 && d.length <= 12, `${q.id} n ${d.length}`);
        for (const p of d) {
          assert.ok(p.x > 0 && p.y > 0 && diKisi(p.x), `${q.id} ${p.x} ${p.y}`);
          assert.equal(p.y, Number(p.y.toFixed(3)));
        }
        const m = q.jenis === "atur" ? q.siapkan! : q.masukan!;
        assert.equal(m.data, sidikData(d), `${q.id} sidik`);
        const hMax = Math.max(...d.map((p) => p.x));
        assert.ok(diKisi(m.H) && m.H >= 0 && m.H <= maksPenggeser(hMax) + 1e-9, `${q.id} H ${m.H}`);
      }
  });

  it("B1: kunci = ratingValue(fitRating(data, pangkat), H), tol 1 %", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "hy04-1");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const f = fitRating(dataSoal(q)!, "pangkat")!;
      assert.equal(q.kunci, ratingValue(f, q.masukan!.H));
      assert.ok(Math.abs(q.toleransi - 0.01 * q.kunci) < 1e-12);
      assert.equal(q.masukan!.bentuk, 0);
    }
  });

  it("B2: Hx ∈ [1,3; 1,5]·hMax, kedua lengkung R² > 0,99, selisih > 10 %, kunci dari lib", () => {
    const kena = new Map<string, number>();
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "hy04-2");
      if (q.jenis !== "tebak") assert.fail("jenis");
      const d = dataSoal(q)!;
      const m = q.masukan!;
      const pk = fitRating(d, "pangkat")!;
      const po = fitRating(d, "polinomial", m.deg)!;
      assert.equal(m.bentuk, 2);
      assert.ok([2, 3, 4].includes(m.deg));
      assert.ok(m.H >= 1.3 * pk.hMax - 1e-9 && m.H <= 1.5 * pk.hMax + 1e-9, `Hx ${m.H} hMax ${pk.hMax}`);
      assert.ok(pk.r2 > 0.99 && po.r2 > 0.99, `R² ${pk.r2} ${po.r2}`);
      const qPk = ratingValue(pk, m.H);
      const qPo = ratingValue(po, m.H);
      assert.ok(Math.abs(qPo - qPk) / qPk > 0.1, `selisih ${qPo} ${qPk}`);
      let turun = qPo < 0;
      for (let k = 0; k <= 200 && !turun; k++) {
        const h1 = pk.hMax + ((m.H - pk.hMax) * k) / 200;
        const h2 = pk.hMax + ((m.H - pk.hMax) * (k + 1)) / 200;
        if (ratingValue(po, h2) < ratingValue(po, h1)) turun = true;
      }
      const kunci = turun ? "turun" : qPo > qPk ? "lebih" : "kurang";
      assert.equal(q.kunci, kunci);
      kena.set(kunci, (kena.get(kunci) ?? 0) + 1);
    }
    assert.ok((kena.get("lebih") ?? 0) > 100 && (kena.get("kurang") ?? 0) > 100, JSON.stringify([...kena]));
  });

  it("B3: kunci = bentuk terdekat ke Q sebenarnya di 1,5·hMax, margin 5 % ke runner-up", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "hy04-3");
      if (q.jenis !== "pilih") assert.fail("jenis");
      const d = dataSoal(q)!;
      const m = q.masukan!;
      const hMax = Math.max(...d.map((p) => p.x));
      assert.ok(m.H <= 1.5 * hMax + 1e-9 && m.H > 1.5 * hMax - 0.01 - 1e-9);
      const benar = (q as Soal & { benar: { a: number; b: number; h0: number } }).benar;
      const qT = benar.a * Math.pow(m.H - benar.h0, benar.b);
      const galat = [
        Math.abs(ratingValue(fitRating(d, "pangkat")!, m.H) - qT),
        Math.abs(ratingValue(fitRating(d, "pangkat-h0")!, m.H) - qT),
        Math.abs(ratingValue(fitRating(d, "polinomial", 2)!, m.H) - qT),
      ];
      const urut = galat.slice().sort((a, b) => a - b);
      assert.ok(urut[1] - urut[0] >= 0.05 * qT, `margin ${galat}`);
      assert.equal(q.kunci, ["pangkat", "pangkat-h0", "polinomial"][galat.indexOf(urut[0])]);
    }
  });

  it("B4: hMax ≥ 1 m; sasaran = zona terbatas lembar (hMax < H ≤ 1,2·hMax) di seluruh kisi H", () => {
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "hy04-4");
      if (q.jenis !== "atur") assert.fail("jenis");
      const d = dataSoal(q)!;
      const f = fitRating(d, "pangkat")!;
      assert.ok(f.hMax >= 1, `hMax ${f.hMax}`);
      assert.equal(q.geser.kunci, "H");
      assert.equal(q.geser.p.max, maksPenggeser(f.hMax));
      for (const H of kisi(q.geser.p)) {
        const terbatas = H > f.hMax && H <= 1.2 * f.hMax;
        assert.equal(nilaiJawab(q, 0, { ...q.siapkan, H }).benar, terbatas, `H ${H} hMax ${f.hMax}`);
      }
      // Tabel berisi data lain: belum dijawab.
      const H = Math.round(1.1 * f.hMax * 100) / 100;
      assert.equal(nilaiJawab(q, 0, { ...q.siapkan, H, data: q.siapkan!.data + 1 }).benar, false);
      assert.ok(!/ISO/.test(q.tanya.id + q.tanya.en + q.bahas.id + q.bahas.en));
    }
  });

  it("B5: kunci = ratingValue(fitRating(data, pangkat-h0), H), |h0| ≥ 0,05 m, H di bagian bawah data", () => {
    let n = 0;
    for (let i = 0; i < BENIH; i++) {
      const q = soal(i, "hy04-5");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const d = dataSoal(q)!;
      const f = fitRating(d, "pangkat-h0")!;
      const H = q.masukan!.H;
      assert.equal(q.masukan!.bentuk, 1);
      assert.ok(Math.abs(f.h0) >= 0.05, `h0 ${f.h0}`);
      assert.ok(H >= f.hMin && H <= f.hMin + 0.3 * (f.hMax - f.hMin) + 1e-9, `H ${H}`);
      assert.equal(q.kunci, ratingValue(f, H));
      assert.ok(Math.abs(q.toleransi - 0.01 * q.kunci) < 1e-12);
      // Kesalahan tanpa H0 dan tanda H0 terbalik ikut sebagai umpan balik.
      if ((q.kesalahan ?? []).length === 2) n++;
    }
    assert.ok(n > 900, `kesalahan lengkap hanya ${n}`);
  });
});
