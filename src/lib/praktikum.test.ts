/*
 * Uji M11 praktikum.ts: bacaan alat bergalat acak berbenih, ringkasan
 * statistik, kalibrasi Cd, integrasi trapesium, baris ekspor.
 *
 * Acuan yang dibuka:
 * - JCGM 100:2008 (GUM) F.2.2.1: resolusi δx memberi sebaran persegi dengan
 *   varians δx²/12 (u = 0,29 δx). Dipakai untuk sebaran bacaan yang sudah
 *   dibulatkan: σ_teramati² ≈ σ² + δx²/12.
 * - Armfield F1-13 datasheet v2b: hook & point gauge 0-150 mm, accuracy 0,1 mm.
 * - Armfield H12 (halaman produk): skala manometer bergaris 1 mm.
 * - USBR Water Measurement Manual bab 8, tabel 8-1: point gage dalam sumur
 *   peredam, galat baca 0,0015 ft.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";

import {
  ALAT_MANOMETER,
  ALAT_PENGUKUR_TITIK,
  ALAT_DEBIT_VOLUMETRIK,
  bacaAlat,
  barisEkspor,
  buatRng,
  cdAmbangV,
  cdVenturi,
  debitGulp,
  integrasiTrapesium,
  kalibrasiAmbangV,
  kalibrasiCd,
  kalibrasiPangkat,
  kalibrasiVenturi,
  qTeoriAmbangV,
  qTeoriVenturi,
  ringkasan,
} from "./praktikum.ts";
import { NOTCH_KH, notchCe, notchDischarge, notchKh, tracerCurve, venturiDischarge } from "./hydraulics.ts";
import { xlsxBytes } from "./xlsx.ts";

describe("PRNG berbenih", () => {
  it("benih sama memberi deret sama, benih beda memberi deret beda", () => {
    const a = buatRng(42);
    const b = buatRng(42);
    const c = buatRng(43);
    const da = Array.from({ length: 50 }, () => a());
    const db = Array.from({ length: 50 }, () => b());
    const dc = Array.from({ length: 50 }, () => c());
    assert.deepEqual(da, db);
    assert.notDeepEqual(da, dc);
    for (const u of da) assert.ok(u >= 0 && u < 1);
  });
  it("seragam: rerata ≈ 1/2, varians ≈ 1/12 pada 20.000 tarikan", () => {
    const r = buatRng(7);
    const xs = Array.from({ length: 20000 }, () => r());
    const s = ringkasan(xs);
    assert.ok(Math.abs(s.rerata - 0.5) < 3 * Math.sqrt(1 / 12 / 20000));
    assert.ok(Math.abs(s.sd * s.sd - 1 / 12) < 0.003);
  });
});

describe("bacaAlat: galat baca acak dibulatkan ke resolusi", () => {
  const benar = 0.123456;
  const alat = { resolusi: 0.0001, sigma: 0.0005 };
  const n = 10000;
  const rng = buatRng(20261101);
  const xs = Array.from({ length: n }, () => bacaAlat(benar, alat, rng));
  const s = ringkasan(xs);

  it("rerata 10.000 bacaan berada dalam 3σ/√n dari nilai benar", () => {
    const sTot = Math.sqrt(alat.sigma ** 2 + alat.resolusi ** 2 / 12);
    assert.ok(Math.abs(s.rerata - benar) < (3 * sTot) / Math.sqrt(n), `rerata ${s.rerata}`);
  });
  it("simpangan baku ≈ √(σ² + δx²/12) (GUM F.2.2.1), dalam 3 %", () => {
    const harap = Math.sqrt(alat.sigma ** 2 + alat.resolusi ** 2 / 12);
    assert.ok(Math.abs(s.sd / harap - 1) < 0.03, `sd ${s.sd} vs ${harap}`);
  });
  it("tiap bacaan kelipatan resolusi dan tertulis bersih", () => {
    for (const x of xs) {
      const k = x / alat.resolusi;
      assert.ok(Math.abs(k - Math.round(k)) < 1e-9, `${x}`);
      assert.ok(String(x).length <= 8, `angka kotor ${x}`);
    }
  });
  it("benih sama memberi bacaan sama", () => {
    const r1 = buatRng(5);
    const r2 = buatRng(5);
    const a = Array.from({ length: 100 }, () => bacaAlat(benar, alat, r1));
    const b = Array.from({ length: 100 }, () => bacaAlat(benar, alat, r2));
    assert.deepEqual(a, b);
  });
  it("sigma nol: bacaan = nilai benar dibulatkan; sigmaRel menambah galat sebanding nilai", () => {
    assert.equal(bacaAlat(0.12346, { resolusi: 0.001, sigma: 0 }, buatRng(1)), 0.123);
    assert.equal(bacaAlat(0.1235, { resolusi: 0.01, sigma: 0 }, buatRng(1)), 0.12);
    const r = buatRng(9);
    const q = Array.from({ length: 10000 }, () => bacaAlat(2, { resolusi: 0, sigmaRel: 0.01 }, r));
    const sq = ringkasan(q);
    assert.ok(Math.abs(sq.sd / 0.02 - 1) < 0.03, `sd ${sq.sd}`);
  });
  it("resolusi 0,5 tetap kelipatan 0,5", () => {
    const r = buatRng(3);
    for (let i = 0; i < 200; i++) {
      const x = bacaAlat(10.3, { resolusi: 0.5, sigma: 1 }, r);
      assert.equal(x * 2, Math.round(x * 2));
    }
  });
  it("prasetel alat bersumber: pengukur titik 0,1 mm, manometer 1 mm", () => {
    assert.equal(ALAT_PENGUKUR_TITIK.resolusi, 0.0001);
    assert.equal(ALAT_MANOMETER.resolusi, 0.001);
    assert.ok(ALAT_DEBIT_VOLUMETRIK.sigmaRel! > 0);
  });
});

describe("ringkasan statistik", () => {
  it("rerata, simpangan baku sampel (n − 1), n", () => {
    const s = ringkasan([2, 4, 4, 4, 5, 5, 7, 9]);
    assert.equal(s.n, 8);
    assert.equal(s.rerata, 5);
    assert.ok(Math.abs(s.sd - Math.sqrt(32 / 7)) < 1e-12);
    assert.ok(Math.abs(s.seRerata - Math.sqrt(32 / 7) / Math.sqrt(8)) < 1e-12);
  });
  it("satu data: sd NaN, kosong: rerata NaN; bukan angka dibuang", () => {
    assert.equal(ringkasan([3]).n, 1);
    assert.ok(Number.isNaN(ringkasan([3]).sd));
    assert.ok(Number.isNaN(ringkasan([]).rerata));
    assert.equal(ringkasan([1, NaN, 3]).n, 2);
  });
});

describe("kalibrasi Cd", () => {
  it("kalibrasiCd (kuadrat terkecil lewat titik asal) pada Q = Cd·Qt tepat", () => {
    const qt = [0.001, 0.002, 0.004, 0.008];
    const k = kalibrasiCd(qt.map((t) => ({ qUkur: 0.62 * t, qTeori: t })));
    assert.ok(Math.abs(k.cd - 0.62) < 1e-12);
    assert.ok(Math.abs(k.cdRerata - 0.62) < 1e-12);
    assert.ok(k.seCd < 1e-12);
    assert.equal(k.n, 4);
  });
  it("FM-01: data notchDischarge(H, θ) kembali ke Ce = notchCe(θ)", () => {
    for (const theta of [30, 60, 90]) {
      const titik = [0.06, 0.1, 0.15, 0.2, 0.25].map((H) => ({ H, Q: notchDischarge(H, theta).Q }));
      const k = kalibrasiAmbangV(titik, theta);
      assert.ok(Math.abs(k.cd - notchCe(theta)) < 1e-12, `θ=${theta}: ${k.cd}`);
      for (const p of titik) assert.ok(Math.abs(cdAmbangV(p.H, p.Q, theta) - notchCe(theta)) < 1e-12);
    }
    // qTeori dengan Cd = 1 dan kh sama dengan model
    const H = 0.1;
    assert.ok(Math.abs(qTeoriAmbangV(H, 90) * notchCe(90) - notchDischarge(H, 90).Q) < 1e-15);
    assert.ok(qTeoriAmbangV(H, 90, 0) < qTeoriAmbangV(H, 90, NOTCH_KH));
  });
  it("FM-01: kh bawaan qTeoriAmbangV/kalibrasiAmbangV = notchKh(θ) (USBR WMM Gb. 7-6a)", () => {
    const H = 0.1;
    for (const theta of [30, 60, 90]) {
      assert.equal(qTeoriAmbangV(H, theta), qTeoriAmbangV(H, theta, notchKh(theta)));
      assert.ok(Math.abs(qTeoriAmbangV(H, theta) * notchCe(theta) - notchDischarge(H, theta).Q) < 1e-15);
    }
    assert.ok(qTeoriAmbangV(H, 30) > qTeoriAmbangV(H, 30, NOTCH_KH), "kh 30° lebih besar dari 0,85 mm");
  });
  it("FM-02: data venturiDischarge(D1, D2, Δh, C) kembali ke C", () => {
    const D1 = 0.026, D2 = 0.014; // Armfield F1-15: 26 mm dan 14 mm
    for (const C of [0.95, 0.984]) {
      const titik = [0.02, 0.05, 0.1, 0.2, 0.3].map((dh) => ({ dh, Q: venturiDischarge(D1, D2, dh, C).Q }));
      const k = kalibrasiVenturi(titik, D1, D2);
      assert.ok(Math.abs(k.cd - C) < 1e-12, `${k.cd}`);
      for (const p of titik) assert.ok(Math.abs(cdVenturi(p.dh, p.Q, D1, D2) - C) < 1e-12);
    }
    assert.ok(Math.abs(qTeoriVenturi(0.1, D1, D2) * 0.98 - venturiDischarge(D1, D2, 0.1, 0.98).Q) < 1e-15);
  });
  it("FM-02 dengan galat baca: Cd kembali dalam 3·seCd", () => {
    const D1 = 0.026, D2 = 0.014, C = 0.98;
    const rng = buatRng(11);
    const titik = [];
    for (let i = 0; i < 40; i++) {
      const dh = 0.02 + (0.3 * i) / 39;
      const Q = venturiDischarge(D1, D2, dh, C).Q;
      titik.push({ dh: bacaAlat(dh, ALAT_MANOMETER, rng), Q: bacaAlat(Q, ALAT_DEBIT_VOLUMETRIK, rng) });
    }
    const k = kalibrasiVenturi(titik, D1, D2);
    assert.ok(Math.abs(k.cd - C) < 3 * k.seCd, `${k.cd} ± ${k.seCd}`);
  });
  it("kalibrasiPangkat: Q = K·x^m pada data tepat (m = 2,5 ambang V, 0,5 venturi)", () => {
    const xs = [0.05, 0.1, 0.2, 0.3];
    const k1 = kalibrasiPangkat(xs.map((x) => ({ x, y: 1.37 * x ** 2.5 })));
    assert.ok(Math.abs(k1.m - 2.5) < 1e-12 && Math.abs(k1.K - 1.37) < 1e-12 && Math.abs(k1.r2 - 1) < 1e-12);
    const k2 = kalibrasiPangkat(xs.map((x) => ({ x, y: 0.0007 * x ** 0.5 })));
    assert.ok(Math.abs(k2.m - 0.5) < 1e-12 && Math.abs(k2.K - 0.0007) < 1e-15);
  });
  it("kurang dari satu titik sah: hasil NaN, bukan lempar galat", () => {
    assert.ok(Number.isNaN(kalibrasiCd([]).cd));
    assert.ok(Number.isNaN(kalibrasiCd([{ qUkur: 1, qTeori: 0 }]).cd));
  });
});

describe("integrasi trapesium", () => {
  it("tepat pada fungsi linear, galat O(h²) pada sin", () => {
    const t = [0, 1, 2, 3, 4];
    assert.equal(integrasiTrapesium(t, t.map((x) => 2 * x + 1)), 20);
    const n = 1000;
    const ts = Array.from({ length: n + 1 }, (_, i) => (Math.PI * i) / n);
    const I = integrasiTrapesium(ts, ts.map(Math.sin));
    assert.ok(Math.abs(I - 2) < (Math.PI ** 3 / (12 * n * n)) * 1.01);
  });
  it("latar dikurangkan; langkah tak seragam", () => {
    assert.equal(integrasiTrapesium([0, 1, 3], [5, 7, 5], 5), 3);
  });
  it("FM-05: luas kurva tracerCurve memberi debit model lewat debitGulp", () => {
    const r = tracerCurve(0.5, 2, 100, 1, 1);
    const I = integrasiTrapesium(r.points.map((p) => p.t), r.points.map((p) => p.c));
    assert.ok(Math.abs(I - r.area) < 1e-9 * r.area);
    assert.ok(Math.abs(debitGulp(2, I) - r.Qgulp) < 1e-12);
    assert.ok(Math.abs(debitGulp(2, I) / 0.5 - 1) < 0.01);
  });
});

/** Baca arsip zip lewat direktori pusat (salinan dari xlsx.test.ts) */
function bukaZip(b: Uint8Array): Map<string, string> {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const akhir = b.length - 22;
  const jumlah = v.getUint16(akhir + 10, true);
  let p = v.getUint32(akhir + 16, true);
  const hasil = new Map<string, string>();
  const dec = new TextDecoder();
  for (let i = 0; i < jumlah; i++) {
    const metode = v.getUint16(p + 10, true);
    const besar = v.getUint32(p + 20, true);
    const nNama = v.getUint16(p + 28, true);
    const lokal = v.getUint32(p + 42, true);
    const nama = dec.decode(b.subarray(p + 46, p + 46 + nNama));
    const mulai = lokal + 30 + v.getUint16(lokal + 26, true) + v.getUint16(lokal + 28, true);
    const data = b.subarray(mulai, mulai + besar);
    hasil.set(nama, dec.decode(metode === 0 ? data : inflateRawSync(data)));
    p += 46 + nNama + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return hasil;
}

/** Sel lembar 1 sebagai tabel; angka sebagai number, teks sebagai string */
function bacaLembar(b: Uint8Array): (string | number | null)[][] {
  const xml = bukaZip(b).get("xl/worksheets/sheet1.xml")!;
  const unesc = (s: string) =>
    s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const baris: (string | number | null)[][] = [];
  for (const m of xml.matchAll(/<row r="(\d+)">(.*?)<\/row>/g)) {
    const r: (string | number | null)[] = [];
    for (const c of m[2].matchAll(/<c r="([A-Z]+)\d+"[^>]*>(.*?)<\/c>/g)) {
      const kol = [...c[1]].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const t = c[2].match(/<t[^>]*>(.*?)<\/t>/);
      r[kol] = t ? unesc(t[1]) : Number(c[2].match(/<v>(.*?)<\/v>/)![1]);
    }
    baris[Number(m[1]) - 1] = Array.from(r, (x) => x ?? null);
  }
  return baris;
}

describe("baris ekspor", () => {
  type R = { H: number; Q: number };
  const kolom = [
    { key: "H" as const, judul: { id: "Tinggi muka air", en: "Head" }, satuan: { id: "m", en: "m" }, digits: 4 },
    { key: "Q" as const, judul: { id: "Debit ukur", en: "Measured discharge" }, satuan: { id: "m³/dtk", en: "m³/s" }, digits: 6 },
    {
      key: "Cd",
      judul: { id: "Cd", en: "Cd" },
      digits: 3,
      hitung: (r: R) => cdAmbangV(r.H, r.Q, 90),
    },
  ];
  const rows: R[] = [
    { H: 0.1, Q: notchDischarge(0.1, 90).Q },
    { H: 0.2, Q: notchDischarge(0.2, 90).Q },
  ];

  it("kepala ikut bahasa dan satuan; nilai dibulatkan ke digits; kolom hitung", () => {
    const id = barisEkspor(kolom, rows, "id");
    assert.deepEqual(id.kepala, ["Tinggi muka air (m)", "Debit ukur (m³/dtk)", "Cd"]);
    const en = barisEkspor(kolom, rows, "en");
    assert.deepEqual(en.kepala, ["Head (m)", "Measured discharge (m³/s)", "Cd"]);
    assert.equal(id.baris.length, 2);
    assert.equal(id.baris[0][0], 0.1);
    assert.equal(id.baris[0][2], Number(notchCe(90).toFixed(3)));
    assert.equal(id.baris[1][1], Number(notchDischarge(0.2, 90).Q.toFixed(6)));
  });
  it("nilai tak hingga atau NaN menjadi sel kosong (null)", () => {
    const e = barisEkspor(kolom, [{ H: NaN, Q: Infinity }], "id");
    assert.deepEqual(e.baris[0], [null, null, null]);
  });
  it("bolak-balik lewat xlsxBytes: kepala dan angka terbaca ulang sama", () => {
    const e = barisEkspor(kolom, rows, "id");
    const tabel = bacaLembar(xlsxBytes([e.kepala, ...e.baris]));
    assert.deepEqual(tabel, [e.kepala, ...e.baris]);
  });
});
