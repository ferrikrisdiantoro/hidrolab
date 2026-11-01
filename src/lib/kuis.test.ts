import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  acakKisi,
  buangDuplikat,
  dataBerderau,
  fmtL,
  kisi,
  kocok,
  nilaiJawab,
  normal,
  prng,
  turunan,
  type Soal,
} from "./kuis.ts";
import { BANK_KUIS } from "../data/kuis/index.ts";
import { G, classifyJump, conjugateDepth, fmt, froude, jumpEnergyLoss, setNumberLocale } from "./hydraulics.ts";

/**
 * Uji kuis (K3). Setiap bank dibangkitkan dengan 1000 benih. Yang dijaga:
 *  - kunci sama dengan keluaran fungsi lib dari masukan soal itu sendiri
 *  - tepat satu pilihan benar, dan teks pilihan berbeda SESUDAH fmt ID/EN
 *  - kesalahan umum soal hitung berjarak ≥ 2× toleransi dan beda sesudah fmt
 *  - toleransi hitung lebih besar daripada galat pembulatan tampilan
 *  - soal atur punya ≥ 3 langkah penggeser yang memenuhi, dan keadaan awal
 *    yang dipasang belum memenuhi
 *  - soal klasifikasi OC-01 tidak berada di margin batas pita
 */

const BENIH = 1000;

describe("pembantu kuis", () => {
  it("prng berbenih: benih sama memberi deret sama, benih beda memberi deret beda", () => {
    const a = prng(42), b = prng(42), c = prng(43);
    const da = [a(), a(), a()], db = [b(), b(), b()], dc = [c(), c(), c()];
    assert.deepEqual(da, db);
    assert.notDeepEqual(da, dc);
    for (const v of da) assert.ok(v >= 0 && v < 1);
  });
  it("prng tersebar kira-kira seragam", () => {
    const r = prng(7);
    let n = 0;
    for (let i = 0; i < 10000; i++) if (r() < 0.5) n++;
    assert.ok(n > 4800 && n < 5200, `separuh bawah ${n}`);
  });
  it("turunan memberi benih berbeda per kunci", () => {
    const s = new Set([turunan(1, 1), turunan(1, 2), turunan(2, 1), turunan(1, 1, 1)]);
    assert.equal(s.size, 4);
    assert.equal(turunan(5, 3), turunan(5, 3));
  });
  it("acakKisi jatuh di kelipatan langkah dan di dalam batas", () => {
    const r = prng(3);
    const p = { min: 0.08, max: 1.2, step: 0.01 };
    for (let i = 0; i < 500; i++) {
      const v = acakKisi(r, p, 0.1, 0.8);
      assert.ok(v >= 0.1 - 1e-12 && v <= 0.8 + 1e-12, String(v));
      assert.equal(v, Number(v.toFixed(2)));
    }
  });
  it("kisi menelusuri semua langkah penggeser", () => {
    const k = kisi({ min: 0.5, max: 16, step: 0.1 });
    assert.equal(k.length, 156);
    assert.equal(k[0], 0.5);
    assert.equal(k[k.length - 1], 16);
  });
  it("kocok tidak menghilangkan butir", () => {
    const r = prng(9);
    assert.deepEqual([...kocok(r, [1, 2, 3, 4, 5])].sort(), [1, 2, 3, 4, 5]);
  });
  it("fmtL sama dengan fmt pada locale yang dipasang", () => {
    for (const lang of ["id", "en"] as const) {
      setNumberLocale(lang);
      for (const v of [0, -0.0004, 1.005, 1234.5, 2.345, -7.25])
        for (const d of [0, 1, 2, 3]) assert.equal(fmtL(v, d, lang), fmt(v, d));
    }
    setNumberLocale("id");
  });
  it("buangDuplikat membuang yang sama dengan kunci menurut key dan dalam 2× toleransi", () => {
    const hasil = buangDuplikat(
      { key: "a", nilai: 10 },
      [
        { key: "a", nilai: 20 },
        { key: "b", nilai: 10.1 },
        { key: "c", nilai: 13 },
        { key: "c", nilai: 30 },
        { key: "d", nilai: 13.001 },
        { key: "e", nilai: 30 },
      ],
      { toleransi: 0.5, digits: 0 }
    );
    assert.deepEqual(hasil.map((h) => h.key), ["c", "e"]);
  });
  it("normal: rata-rata dekat 0 dan simpangan dekat 1", () => {
    const r = prng(11);
    const xs = Array.from({ length: 4000 }, () => normal(r));
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    const s = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
    assert.ok(Math.abs(m) < 0.06 && Math.abs(s - 1) < 0.06, `${m} ${s}`);
  });
  it("dataBerderau: derau relatif dalam batas yang diminta", () => {
    const r = prng(12);
    const f = (h: number) => 3 * Math.pow(h, 2);
    const d = dataBerderau(r, [0.2, 0.5, 1, 1.5], f, 0.05);
    for (const p of d) assert.ok(Math.abs(p.y / f(p.x) - 1) <= 0.05 + 1e-12);
  });
});

describe("nilaiJawab", () => {
  const pilih: Soal = {
    jenis: "pilih", id: "p", tanya: { id: "", en: "" }, bahas: { id: "", en: "" },
    pilihan: [{ id: "a", teks: { id: "A", en: "A" } }, { id: "b", teks: { id: "B", en: "B" } }],
    kunci: "b",
  };
  const hitung: Soal = {
    jenis: "hitung", id: "h", tanya: { id: "", en: "" }, bahas: { id: "", en: "" },
    kunci: 2.5, toleransi: 0.05, digits: 2, satuan: { id: "m", en: "m" },
  };
  const atur: Soal = {
    jenis: "atur", id: "t", tanya: { id: "", en: "" }, bahas: { id: "", en: "" },
    ukur: (k) => k.a * 2, target: { min: 4, max: 6 }, geser: { kunci: "a", p: { min: 0, max: 10, step: 1 } },
    tetap: { b: 3 },
  };
  it("pilih", () => {
    assert.equal(nilaiJawab(pilih, "b").benar, true);
    assert.equal(nilaiJawab(pilih, "a").benar, false);
  });
  it("hitung: batas toleransi termasuk, di luar salah, selisih dilaporkan", () => {
    assert.equal(nilaiJawab(hitung, 2.55).benar, true);
    assert.equal(nilaiJawab(hitung, 2.56).benar, false);
    assert.ok(Math.abs((nilaiJawab(hitung, 2.4).selisih ?? 0) + 0.1) < 1e-12);
    assert.equal(nilaiJawab(hitung, Number.NaN).benar, false);
  });
  it("atur membaca keadaan lembar dan menolak bila masukan tetap diubah", () => {
    assert.equal(nilaiJawab(atur, 0, { a: 2.5, b: 3 }).benar, true);
    assert.equal(nilaiJawab(atur, 0, { a: 4, b: 3 }).benar, false);
    const ubah = nilaiJawab(atur, 0, { a: 2.5, b: 4 });
    assert.equal(ubah.benar, false);
    assert.equal(ubah.tetapDiubah, "b");
  });
});

/* ---------------------------------------------------------------- *
 * Semua bank
 * ---------------------------------------------------------------- */

const LANGS = ["id", "en"] as const;

for (const bank of Object.values(BANK_KUIS)) {
  describe(`bank ${bank.kode}: ${BENIH} benih`, () => {
    const semua: Soal[][] = [];
    for (let b = 1; b <= BENIH; b++) semua.push(bank.buat(b));

    it(`tiap benih memberi ${bank.jumlah} soal dengan id unik`, () => {
      for (const s of semua) {
        assert.equal(s.length, bank.jumlah);
        assert.equal(new Set(s.map((q) => q.id)).size, s.length);
      }
    });

    it("benih yang sama memberi soal yang sama; benih berbeda mengganti soal", () => {
      const teks = (ss: Soal[]) => ss.map((q) => q.tanya.id).join("|");
      assert.equal(teks(bank.buat(17)), teks(bank.buat(17)));
      const beda = new Set(semua.slice(0, 50).map(teks));
      assert.ok(beda.size >= 45, `hanya ${beda.size} set berbeda dari 50 benih`);
    });

    it("teks dua bahasa terisi", () => {
      for (const ss of semua.slice(0, 50))
        for (const q of ss)
          for (const l of LANGS) {
            assert.ok(q.tanya[l].length > 10, `${q.id} tanya ${l}`);
            assert.ok(q.bahas[l].length > 10, `${q.id} bahas ${l}`);
          }
    });

    it("pilih/tebak: tepat satu pilihan benar, teks berbeda sesudah fmt di ID dan EN", () => {
      for (const ss of semua)
        for (const q of ss) {
          if (q.jenis !== "pilih" && q.jenis !== "tebak") continue;
          const benar = q.pilihan.filter((p) => nilaiJawab(q, p.id).benar);
          assert.equal(benar.length, 1, `${q.id}: ${benar.length} benar`);
          assert.ok(q.pilihan.length >= 3, `${q.id}: ${q.pilihan.length} pilihan`);
          assert.equal(new Set(q.pilihan.map((p) => p.id)).size, q.pilihan.length);
          for (const l of LANGS)
            assert.equal(new Set(q.pilihan.map((p) => p.teks[l])).size, q.pilihan.length, `${q.id} ${l}`);
        }
    });

    it("hitung: toleransi > galat pembulatan tampilan; kesalahan umum ≥ 2× toleransi dan beda sesudah fmt", () => {
      for (const ss of semua)
        for (const q of ss) {
          if (q.jenis !== "hitung") continue;
          assert.ok(Number.isFinite(q.kunci), q.id);
          assert.ok(q.toleransi > 0.5 * Math.pow(10, -q.digits), `${q.id} tol ${q.toleransi}`);
          assert.equal(nilaiJawab(q, Number(q.kunci.toFixed(q.digits))).benar, true, `${q.id} kunci tampil`);
          const tampil = new Set(LANGS.map((l) => `${l}:${fmtL(q.kunci, q.digits, l)}`));
          for (const k of q.kesalahan ?? []) {
            assert.ok(Math.abs(k.nilai - q.kunci) >= 2 * q.toleransi, `${q.id}: kesalahan ${k.nilai} vs ${q.kunci}`);
            assert.equal(nilaiJawab(q, k.nilai).benar, false);
            for (const l of LANGS) {
              const t = `${l}:${fmtL(k.nilai, q.digits, l)}`;
              assert.ok(!tampil.has(t), `${q.id}: ${t} sama`);
              tampil.add(t);
            }
          }
        }
    });

    it("atur: ≥ 3 langkah penggeser memenuhi, keadaan awal belum memenuhi", () => {
      for (const ss of semua)
        for (const q of ss) {
          if (q.jenis !== "atur") continue;
          const dasar = { ...(q.siapkan ?? {}), ...(q.tetap ?? {}) };
          const lolos = kisi(q.geser.p).filter((v) => nilaiJawab(q, 0, { ...dasar, [q.geser.kunci]: v }).benar);
          assert.ok(lolos.length >= 3, `${q.id}: ${lolos.length} langkah`);
          assert.equal(nilaiJawab(q, 0, dasar).benar, false, `${q.id}: awal sudah memenuhi`);
        }
    });
  });
}

/* ---------------------------------------------------------------- *
 * OC-01: kunci = keluaran lib, margin pita
 * ---------------------------------------------------------------- */

describe(`OC-01 loncatan air: kunci dari lib, ${BENIH} benih`, () => {
  const bank = BANK_KUIS["OC-01"];
  const BATAS = [1, 1.7, 2.5, 4.5, 9];
  const Y1 = { min: 0.08, max: 1.2, step: 0.01 };
  const V1 = { min: 0.5, max: 16, step: 0.1 };
  const diKisi = (v: number, p: { min: number; max: number; step: number }) =>
    v >= p.min - 1e-12 && v <= p.max + 1e-12 && Math.abs(v / p.step - Math.round(v / p.step)) < 1e-9;
  const soal = (b: number, id: string) => bank.buat(b).find((q) => q.id === id)!;

  it("masukan tiap soal ada di kisi penggeser lembar", () => {
    for (let b = 1; b <= BENIH; b++)
      for (const q of bank.buat(b)) {
        const m = q.jenis === "atur" ? q.siapkan : q.masukan;
        assert.ok(m, q.id);
        assert.ok(diKisi(m.y1, Y1), `${q.id} y1 ${m.y1}`);
        assert.ok(diKisi(m.V1, V1), `${q.id} V1 ${m.V1}`);
      }
  });

  it("B1: kunci = classifyJump(froude(V1, y1)).key, Fr₁ berjarak ≥ 8 % dari tiap batas pita", () => {
    const kena = new Map<string, number>();
    for (let b = 1; b <= BENIH; b++) {
      const q = soal(b, "oc01-1");
      assert.equal(q.jenis, "pilih");
      if (q.jenis !== "pilih") continue;
      const Fr = froude(q.masukan!.V1, q.masukan!.y1);
      assert.equal(q.kunci, classifyJump(Fr).key);
      for (const bt of BATAS) assert.ok(Math.max(Fr / bt, bt / Fr) >= 1.08 - 1e-12, `Fr ${Fr} dekat ${bt}`);
      kena.set(q.kunci, (kena.get(q.kunci) ?? 0) + 1);
    }
    assert.equal(kena.size, 6, `kelas yang muncul: ${[...kena.keys()]}`);
    // Keenam kelas muncul kira-kira sama sering (1/6 ≈ 167 dari 1000).
    for (const [k, n] of kena) assert.ok(n >= 120, `${k} hanya ${n} kali`);
  });

  it("B2: kunci = conjugateDepth, Fr₁ ∈ [1,7; 9]", () => {
    for (let b = 1; b <= BENIH; b++) {
      const q = soal(b, "oc01-2");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const { y1, V1 } = q.masukan!;
      const Fr = froude(V1, y1);
      assert.ok(Fr >= 1.7 && Fr <= 9, String(Fr));
      assert.equal(q.kunci, conjugateDepth(y1, Fr));
    }
  });

  it("B3: atur V₁ sampai Fr₁ ∈ [5; 6] dengan y₁ ∈ [0,08; 0,8] tetap", () => {
    for (let b = 1; b <= BENIH; b++) {
      const q = soal(b, "oc01-3");
      if (q.jenis !== "atur") assert.fail("jenis");
      assert.deepEqual(q.target, { min: 5, max: 6 });
      assert.equal(q.geser.kunci, "V1");
      const y1 = q.tetap!.y1;
      assert.ok(y1 >= 0.08 && y1 <= 0.8);
      assert.equal(q.ukur({ y1, V1: 7 }), froude(7, y1));
    }
  });

  it("B4: kunci = perubahan yang menaikkan Fr₁ lebih banyak menurut froude()", () => {
    for (let b = 1; b <= BENIH; b++) {
      const q = soal(b, "oc01-4");
      if (q.jenis !== "pilih") assert.fail("jenis");
      const { y1, V1 } = q.masukan!;
      const naikV = froude(1.1 * V1, y1), turunY = froude(V1, 0.9 * y1);
      assert.equal(q.kunci, naikV > turunY ? "V" : "y");
    }
  });

  it("B5: kunci = jumpEnergyLoss / E₁ · 100, Fr₁ ∈ [2,5; 9], tol 1 poin", () => {
    for (let b = 1; b <= BENIH; b++) {
      const q = soal(b, "oc01-5");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const { y1, V1 } = q.masukan!;
      const Fr = froude(V1, y1);
      assert.ok(Fr >= 2.5 && Fr <= 9, String(Fr));
      const y2 = conjugateDepth(y1, Fr);
      const E1 = y1 + (V1 * V1) / (2 * G);
      assert.equal(q.kunci, (jumpEnergyLoss(y1, y2) / E1) * 100);
      assert.equal(q.toleransi, 1);
    }
  });
});
