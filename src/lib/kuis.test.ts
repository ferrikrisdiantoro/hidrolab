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
import {
  G,
  classifyJump,
  conjugateDepth,
  criticalDepth,
  ductEnergy,
  fmt,
  froude,
  gvfProfile,
  jumpEnergyLoss,
  normalDepth,
  normalDepthReachable,
  setNumberLocale,
  transition,
} from "./hydraulics.ts";
import { ff01Kasus2, stasiunBernoulli } from "../data/kuis/ff01.ts";

/**
 * Uji kuis (K3). Setiap bank dibangkitkan dengan 1000 benih. Yang dijaga:
 *  - kunci sama dengan keluaran fungsi lib dari masukan soal itu sendiri
 *  - tepat satu pilihan benar, dan teks pilihan berbeda SESUDAH fmt ID/EN
 *  - kesalahan umum soal hitung berjarak ≥ 2× toleransi dan beda sesudah fmt
 *  - toleransi hitung lebih besar daripada galat pembulatan tampilan
 *  - soal atur punya ≥ 3 langkah penggeser yang memenuhi (atau langkahMin
 *    soalnya; FF-01 B4: 2 menurut revisi insinyur), dan keadaan awal yang
 *    dipasang belum memenuhi
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
          assert.ok(lolos.length >= (q.langkahMin ?? 3), `${q.id}: ${lolos.length} langkah`);
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

/* ---------------------------------------------------------------- *
 * Pembantu uji bank K-A1
 * ---------------------------------------------------------------- */

type Kisi = { min: number; max: number; step: number };
const diKisiP = (v: number, p: Kisi) =>
  v >= p.min - 1e-12 && v <= p.max + 1e-12 && Math.abs(v / p.step - Math.round(v / p.step)) < 1e-9;
const kisiUji = (p: Kisi) => {
  const out: number[] = [];
  for (let k = Math.ceil(p.min / p.step - 1e-9); k <= Math.floor(p.max / p.step + 1e-9); k++)
    out.push(Number((k * p.step).toFixed(6)));
  return out;
};

/* ---------------------------------------------------------------- *
 * OC-03: kunci = gvfProfile, huruf dari .mild, margin zona
 * ---------------------------------------------------------------- */

describe(`OC-03 profil GVF: kunci dari lib, ${BENIH} benih`, () => {
  const bank = BANK_KUIS["OC-03"];
  const P = {
    Q: { min: 0.5, max: 120, step: 0.5 },
    b: { min: 0.5, max: 25, step: 0.1 },
    n: { min: 0.01, max: 0.07, step: 0.001 },
    S0: { min: 0.05, max: 40, step: 0.05 },
    y: { min: 0.1, max: 6, step: 0.05 },
    L: { min: 100, max: 4000, step: 50 },
  };
  const soal = (b: number, id: string) => bank.buat(b).find((q) => q.id === id)!;
  const gvf = (m: Record<string, number>, L = m.L) => gvfProfile(m.Q, m.b, m.n, m.S0 / 1000, m.y, L, 400);
  const margin = (m: Record<string, number>) => {
    const yc = criticalDepth(m.Q / m.b);
    const y0 = normalDepth(m.Q, m.b, m.n, m.S0 / 1000);
    assert.ok(normalDepthReachable(m.Q, m.b, m.n, m.S0 / 1000));
    assert.ok(Math.abs(y0 / yc - 1) > 0.15, `y0 ${y0} yc ${yc}`);
    for (const d of [y0, yc]) {
      assert.ok(Math.abs(m.y - d) >= 0.05 - 1e-12, `y ${m.y} dekat ${d}`);
      assert.ok(Math.abs(m.y / d - 1) >= 0.1 - 1e-12, `y ${m.y} dekat ${d}`);
    }
  };

  it("masukan tiap soal ada di kisi penggeser lembar", () => {
    for (let b = 1; b <= BENIH; b++)
      for (const q of bank.buat(b)) {
        const m = q.jenis === "atur" ? { ...q.siapkan, ...q.tetap } : q.masukan;
        assert.ok(m, q.id);
        for (const k of Object.keys(P) as (keyof typeof P)[]) assert.ok(diKisiP(m[k], P[k]), `${q.id} ${k} ${m[k]}`);
      }
  });

  it("B1 tebak: kunci = gvfProfile().profile, huruf dari .mild, keenam profil muncul", () => {
    const kena = new Map<string, number>();
    for (let b = 1; b <= BENIH; b++) {
      const q = soal(b, "oc03-1");
      assert.equal(q.jenis, "tebak");
      if (q.jenis !== "tebak") continue;
      const r = gvf(q.masukan!);
      assert.equal(q.kunci, r.profile);
      assert.equal(q.kunci[0], r.mild ? "M" : "S");
      margin(q.masukan!);
      kena.set(q.kunci, (kena.get(q.kunci) ?? 0) + 1);
    }
    assert.equal(kena.size, 6, `profil: ${[...kena.keys()]}`);
    for (const [k, n] of kena) assert.ok(n >= 100, `${k} hanya ${n}`);
  });

  it("B2 tebak: kunci mengikuti gvfProfile().direction", () => {
    for (let b = 1; b <= BENIH; b++) {
      const q = soal(b, "oc03-2");
      if (q.jenis !== "tebak") assert.fail("jenis");
      const r = gvf(q.masukan!);
      assert.equal(q.kunci, r.direction === "hulu" ? "hulu-sub" : "hilir-sup");
      margin(q.masukan!);
    }
  });

  it("B3: kunci = endsAtCritical dengan margin panjang (≤ 0,8 L bila benar, 1,25 L tetap salah)", () => {
    let benar = 0;
    for (let b = 1; b <= BENIH; b++) {
      const q = soal(b, "oc03-3");
      if (q.jenis !== "pilih") assert.fail("jenis");
      const m = q.masukan!;
      const r = gvf(m);
      assert.equal(q.kunci, r.endsAtCritical ? "berhenti-yc" : "menuju-y0");
      if (r.endsAtCritical) {
        benar++;
        const xs = r.points.map((p) => p.x);
        assert.ok(Math.max(...xs) - Math.min(...xs) <= 0.8 * m.L + 1e-9);
      } else {
        assert.equal(gvf(m, 1.25 * m.L).endsAtCritical, false);
      }
    }
    assert.ok(benar > 300 && benar < 700, `berhenti di yc ${benar} dari ${BENIH}`);
  });

  it("B4 hitung: kunci = criticalDepth(Q/b), toleransi 1 %", () => {
    for (let b = 1; b <= BENIH; b++) {
      const q = soal(b, "oc03-4");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const m = q.masukan!;
      assert.equal(q.kunci, criticalDepth(m.Q / m.b));
      assert.ok(q.toleransi >= 0.01 * q.kunci - 1e-12);
    }
  });

  it("B5 atur: sasaran = langkah y yang memberi M2 menurut gvfProfile, ≥ 4 langkah, Q b n S₀ tetap", () => {
    for (let b = 1; b <= BENIH; b++) {
      const q = soal(b, "oc03-5");
      if (q.jenis !== "atur") assert.fail("jenis");
      assert.equal(q.geser.kunci, "y");
      const m = { ...q.siapkan!, ...q.tetap! };
      for (const k of ["Q", "b", "n", "S0"]) assert.ok(k in q.tetap!, k);
      const m2 = kisiUji(P.y).filter((y) => gvfProfile(m.Q, m.b, m.n, m.S0 / 1000, y, m.L, 1).profile === "M2");
      assert.ok(m2.length >= 4, `${m2.length}`);
      assert.equal(q.target.min, m2[0]);
      assert.equal(q.target.max, m2[m2.length - 1]);
      assert.notEqual(gvf(m).profile, "M2");
    }
  });
});

/* ---------------------------------------------------------------- *
 * OC-05: kunci = transition (Δz = 0)
 * ---------------------------------------------------------------- */

describe(`OC-05 transisi lebar: kunci dari lib, ${BENIH} benih`, () => {
  const bank = BANK_KUIS["OC-05"];
  const P = {
    Q: { min: 0.5, max: 80, step: 0.5 },
    b1: { min: 1, max: 20, step: 0.1 },
    y1: { min: 0.1, max: 5, step: 0.01 },
    b2: { min: 0.5, max: 20, step: 0.1 },
  };
  const soal = (b: number, id: string) => bank.buat(b).find((q) => q.id === id)!;
  const tr = (m: Record<string, number>, b2 = m.b2) => transition({ Q: m.Q, b1: m.b1, y1: m.y1, b2, dz: 0 });

  it("masukan tiap soal ada di kisi penggeser lembar", () => {
    for (let b = 1; b <= BENIH; b++)
      for (const q of bank.buat(b)) {
        const m = q.jenis === "atur" ? { ...q.siapkan, ...q.tetap } : q.masukan;
        assert.ok(m, q.id);
        for (const k of Object.keys(P) as (keyof typeof P)[]) assert.ok(diKisiP(m[k], P[k]), `${q.id} ${k} ${m[k]}`);
      }
  });

  it("B1 atur: sasaran [b₂min kisi; +0,2], b₂min kisi = langkah tersempit yang tidak tersendat, Fr₁ < 0,6", () => {
    for (let b = 1; b <= BENIH; b++) {
      const q = soal(b, "oc05-1");
      if (q.jenis !== "atur") assert.fail("jenis");
      const m = { ...q.siapkan!, ...q.tetap! };
      assert.ok(tr(m).Fr1 < 0.6);
      const lolos = kisiUji(P.b2).filter((v) => !tr(m, v).choked);
      assert.equal(q.target.min, lolos[0]);
      assert.ok(Math.abs(q.target.max - (lolos[0] + 0.2)) < 1e-9);
      assert.equal(tr(m, Number((lolos[0] - 0.1).toFixed(1))).choked, true);
      for (const k of ["Q", "b1", "y1"]) assert.ok(k in q.tetap!, k);
    }
  });

  it("B2 hitung: kunci = transition().b2Min, toleransi 2 %", () => {
    for (let b = 1; b <= BENIH; b++) {
      const q = soal(b, "oc05-2");
      if (q.jenis !== "hitung") assert.fail("jenis");
      assert.equal(q.kunci, tr(q.masukan!).b2Min);
      assert.ok(q.toleransi >= 0.02 * q.kunci - 1e-12);
    }
  });

  it("B3 pilih: kunci = tanda y₂ − y₁, tidak tersendat, chokeRatio < 0,9, pita Fr₁ per cabang", () => {
    const cabang = new Set<string>();
    for (let b = 1; b <= BENIH; b++) {
      const q = soal(b, "oc05-3");
      if (q.jenis !== "pilih") assert.fail("jenis");
      const r = tr(q.masukan!);
      assert.equal(r.choked, false);
      assert.ok(r.chokeRatio < 0.9);
      if (r.branch === "subkritis") assert.ok(r.Fr1 >= 0.2 && r.Fr1 <= 0.7, String(r.Fr1));
      else assert.ok(r.Fr1 >= 1.5 && r.Fr1 <= 3, String(r.Fr1));
      cabang.add(r.branch);
      assert.equal(q.kunci, r.y2 > q.masukan!.y1 ? "naik" : "turun");
    }
    assert.equal(cabang.size, 2);
  });

  it("B4 hitung: kunci = transition().y2, toleransi 1 %", () => {
    for (let b = 1; b <= BENIH; b++) {
      const q = soal(b, "oc05-4");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const r = tr(q.masukan!);
      assert.equal(r.choked, false);
      assert.equal(q.kunci, r.y2);
      assert.ok(q.toleransi >= 0.01 * q.kunci - 1e-12);
    }
  });

  it("B5 pilih: debit dipasok tetap, cabang subkritis, tersendat; debit berkurang = pengecoh dengan syarat waduk", () => {
    for (let b = 1; b <= BENIH; b++) {
      const q = soal(b, "oc05-5");
      if (q.jenis !== "pilih") assert.fail("jenis");
      const r = tr(q.masukan!);
      assert.equal(r.choked, true);
      assert.equal(r.branch, "subkritis");
      assert.match(q.tanya.id, /[Dd]ebit dipasok tetap dari hulu/);
      assert.match(q.tanya.en, /supplied at a constant rate from upstream/);
      assert.equal(q.kunci, "hulu-naik");
      const p = q.pilihan.find((x) => x.id === "debit-berkurang");
      assert.ok(p?.alasan);
      assert.match(p!.alasan!.id, /waduk/);
      assert.match(p!.alasan!.en, /reservoir/);
    }
  });
});

/* ---------------------------------------------------------------- *
 * FF-01: kunci = ductEnergy
 * ---------------------------------------------------------------- */

describe(`FF-01 Bernoulli: kunci dari lib, ${BENIH} benih`, () => {
  const bank = BANK_KUIS["FF-01"];
  const P = {
    Q: { min: 5, max: 600, step: 5 },
    H: { min: 2, max: 40, step: 0.5 },
    D1: { min: 100, max: 800, step: 10 },
    D2: { min: 40, max: 800, step: 10 },
    dz: { min: -8, max: 25, step: 0.5 },
  };
  const soal = (b: number, id: string) => bank.buat(b).find((q) => q.id === id)!;
  const de = (m: Record<string, number>) =>
    ductEnergy(m.Q / 1000, stasiunBernoulli(m.D1 / 1000, m.D2 / 1000, m.dz), m.H, 0);

  it("masukan tiap soal ada di kisi penggeser lembar", () => {
    for (let b = 1; b <= BENIH; b++)
      for (const q of bank.buat(b)) {
        const m = q.jenis === "atur" ? { ...q.siapkan, ...q.tetap } : q.masukan;
        assert.ok(m, q.id);
        for (const k of Object.keys(P) as (keyof typeof P)[]) assert.ok(diKisiP(m[k], P[k]), `${q.id} ${k} ${m[k]}`);
      }
  });

  it("B1 hitung: kunci = points[2].pressureHead, Δz ∈ [1; 10], hv₂ ≥ 0,2 m, D₂ < 0,8 D₁, tanpa kavitasi", () => {
    for (let b = 1; b <= BENIH; b++) {
      const q = soal(b, "ff01-1");
      if (q.jenis !== "hitung") assert.fail("jenis");
      const m = q.masukan!;
      const r = de(m);
      assert.equal(q.kunci, r.points[2].pressureHead);
      assert.ok(m.dz >= 1 && m.dz <= 10, String(m.dz));
      assert.ok(r.points[2].velocityHead >= 0.2, String(r.points[2].velocityHead));
      assert.ok(m.D2 < 0.8 * m.D1);
      assert.equal(r.cavitates, false);
      assert.ok(q.toleransi >= Math.max(0.02, 0.01 * Math.abs(q.kunci)) - 1e-12);
    }
  });

  it("B2 pilih: kunci = penurunan p/γ dari dua panggilan ductEnergy, keduanya tanpa kavitasi", () => {
    for (let b = 1; b <= BENIH; b++) {
      const k = ff01Kasus2(b);
      const q = soal(b, "ff01-2");
      if (q.jenis !== "pilih") assert.fail("jenis");
      const ra = de({ ...k.m, D2: k.D2a }), rb = de(k.m);
      assert.equal(ra.cavitates || rb.cavitates, false);
      assert.ok(k.D2a > k.m.D2);
      assert.deepEqual(q.masukan, k.m);
      const turun = ra.points[2].pressureHead - rb.points[2].pressureHead;
      assert.ok(Math.abs(turun - k.turun) < 1e-12);
      const kunci = q.pilihan.find((p) => p.id === q.kunci)!;
      for (const l of LANGS) assert.ok(kunci.teks[l].includes(fmtL(turun, 2, l)), `${kunci.teks[l]} ${turun}`);
    }
  });

  it("B3 pilih: leher naik 1 m menurunkan p/γ tepat 1 m menurut ductEnergy", () => {
    for (let b = 1; b <= BENIH; b++) {
      const q = soal(b, "ff01-3");
      if (q.jenis !== "pilih") assert.fail("jenis");
      const m = q.masukan!;
      const r0 = de(m), r1 = de({ ...m, dz: m.dz + 1 });
      assert.equal(r0.cavitates || r1.cavitates, false);
      assert.ok(Math.abs(r0.points[2].pressureHead - r1.points[2].pressureHead - 1) < 1e-9);
      assert.equal(q.kunci, "tepat");
    }
  });

  it("B4 atur: kunci = Δz terbesar di kisi tanpa kavitasi; diterima kunci dan satu langkah di bawahnya", () => {
    for (let b = 1; b <= BENIH; b++) {
      const q = soal(b, "ff01-4");
      if (q.jenis !== "atur") assert.fail("jenis");
      const m = { ...q.siapkan!, ...q.tetap! };
      assert.ok(m.D2 <= 0.8 * m.D1);
      const aman = kisiUji(P.dz).filter((dz) => !de({ ...m, dz }).cavitates);
      const kunci = aman[aman.length - 1];
      assert.ok(kunci >= 0.5 && kunci <= 24.5, String(kunci));
      assert.equal(de({ ...m, dz: kunci + 0.5 }).cavitates, true);
      assert.equal(q.target.max, kunci);
      assert.equal(q.target.min, kunci - 0.5);
      const lolos = kisiUji(P.dz).filter((dz) => nilaiJawab(q, 0, { ...m, dz }).benar);
      assert.deepEqual(lolos, [kunci - 0.5, kunci]);
      assert.equal(q.langkahMin, 2);
      for (const k of ["Q", "H", "D1", "D2"]) assert.ok(k in q.tetap!, k);
    }
  });
});
