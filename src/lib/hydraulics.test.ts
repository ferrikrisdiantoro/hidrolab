import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  G,
  NOTCH_H_MIN,
  RE_LAMINAR_MAX,
  RE_TURBULENT_MIN,
  classifyJump,
  classifyRegime,
  colebrookFriction,
  conjugateDepth,
  criticalDepth,
  frictionFactor,
  frictionSlope,
  froude,
  gvfProfile,
  gvfSlope,
  headLoss,
  jumpEnergyLoss,
  jumpLength,
  manningDischarge,
  normalDepth,
  notchCe,
  notchDischarge,
  rectGeometry,
  reynolds,
  slopeType,
  specificEnergy,
} from "./hydraulics.ts";

/**
 * Uji mesin perhitungan hidraulika.
 *
 * Nilai acuan diambil dari literatur baku, bukan dari keluaran program
 * ini sendiri. Uji yang membandingkan sebuah fungsi dengan hasilnya
 * sendiri tidak membuktikan apa pun, jadi setiap angka pembanding di
 * bawah ini berasal dari buku teks, diagram terbitan, atau standar.
 */

/**
 * Pembanding dengan toleransi relatif, ditambah lantai mutlak agar
 * perbandingan terhadap nol tetap masuk akal — toleransi relatif dari
 * nol selalu nol, dan itu bukan yang dimaksud.
 */
function close(
  actual: number,
  expected: number,
  relTol: number,
  msg: string,
  absTol = 1e-12
) {
  const diff = Math.abs(actual - expected);
  const tol = Math.abs(expected) * relTol + absTol;
  assert.ok(
    diff <= tol,
    `${msg}: dapat ${actual}, harap ${expected} (selisih ${diff.toExponential(2)} > toleransi ${tol.toExponential(2)})`
  );
}

/* ------------------------------------------------------------------ */

describe("Besaran dasar", () => {
  it("bilangan Froude sesuai definisi V/sqrt(g*y)", () => {
    close(froude(7, 0.3), 7 / Math.sqrt(G * 0.3), 1e-12, "Fr");
    close(froude(7, 0.3), 4.080402, 1e-6, "Fr numerik");
  });

  it("Froude bernilai satu tepat pada kondisi kritis", () => {
    const q = 2.4;
    const yc = criticalDepth(q);
    close(froude(q / yc, yc), 1, 1e-9, "Fr pada yc");
  });

  it("kedalaman kritis memenuhi yc = (q^2/g)^(1/3)", () => {
    for (const q of [0.5, 2.4, 8, 20]) {
      close(criticalDepth(q), Math.cbrt((q * q) / G), 1e-12, `yc q=${q}`);
    }
  });

  it("energi spesifik minimum tepat 1,5 kali kedalaman kritis", () => {
    // Sifat baku penampang persegi: Emin = 1,5 yc, terjadi pada y = yc.
    for (const q of [0.8, 2.4, 6]) {
      const yc = criticalDepth(q);
      close(specificEnergy(yc, q), 1.5 * yc, 1e-9, `Emin q=${q}`);
    }
  });

  it("energi spesifik memang minimum di kedalaman kritis", () => {
    const q = 2.4;
    const yc = criticalDepth(q);
    const E = specificEnergy(yc, q);
    for (const d of [0.7, 0.85, 1.15, 1.4]) {
      assert.ok(
        specificEnergy(yc * d, q) > E,
        `E(${d}·yc) harus lebih besar dari Emin`
      );
    }
  });
});

/* ------------------------------------------------------------------ */

describe("Loncatan air — persamaan Belanger", () => {
  it("nilai acuan Fr1 = 5 menghasilkan y2/y1 = 6,588", () => {
    // 0,5 (sqrt(1+8·25) − 1) = 0,5 (sqrt(201) − 1) = 6,588723…
    close(conjugateDepth(1, 5), 6.588723, 1e-6, "y2 pada Fr=5");
  });

  it("pada Fr1 = 1 kedalaman tidak berubah", () => {
    close(conjugateDepth(1.37, 1), 1.37, 1e-9, "y2 pada Fr=1");
  });

  it("bersifat timbal balik: dari y2 kembali ke y1", () => {
    // Persamaan Belanger berlaku dua arah; menghitung balik dari hilir
    // harus mengembalikan kedalaman hulu semula.
    const y1 = 0.3;
    const Fr1 = froude(7, y1);
    const y2 = conjugateDepth(y1, Fr1);
    const V2 = (7 * y1) / y2;
    const Fr2 = froude(V2, y2);
    close(conjugateDepth(y2, Fr2), y1, 1e-9, "kembali ke y1");
    assert.ok(Fr2 < 1, "aliran hilir harus subkritis");
  });

  it("kehilangan energi sama dengan selisih energi spesifik", () => {
    // Dua jalur perhitungan berbeda harus bertemu di angka yang sama.
    const y1 = 0.25;
    const V1 = 8.5;
    const Fr1 = froude(V1, y1);
    const y2 = conjugateDepth(y1, Fr1);
    const q = V1 * y1;
    const E1 = specificEnergy(y1, q);
    const E2 = specificEnergy(y2, q);
    close(jumpEnergyLoss(y1, y2), E1 - E2, 1e-9, "ΔE");
  });

  it("kehilangan energi selalu positif untuk aliran superkritis", () => {
    for (const Fr of [1.2, 2, 4, 7, 12]) {
      const y1 = 0.3;
      const y2 = conjugateDepth(y1, Fr);
      assert.ok(jumpEnergyLoss(y1, y2) > 0, `ΔE harus positif pada Fr=${Fr}`);
    }
  });

  it("panjang loncatan memakai pendekatan L = 6 y2", () => {
    close(jumpLength(1.4), 8.4, 1e-12, "Lj");
  });

  it("klasifikasi mengikuti batas Froude baku", () => {
    // Batas menurut Chow (1959) dan USBR Monograph 25.
    assert.equal(classifyJump(0.8).key, "subkritis");
    assert.equal(classifyJump(1.4).key, "berombak");
    assert.equal(classifyJump(2.0).key, "lemah");
    assert.equal(classifyJump(3.5).key, "berosilasi");
    assert.equal(classifyJump(6.0).key, "mantap");
    assert.equal(classifyJump(11).key, "kuat");
  });

  it("tepat di batas kelas, kelas berikutnya yang berlaku", () => {
    assert.equal(classifyJump(1.7).key, "lemah");
    assert.equal(classifyJump(2.5).key, "berosilasi");
    assert.equal(classifyJump(4.5).key, "mantap");
    assert.equal(classifyJump(9).key, "kuat");
  });
});

/* ------------------------------------------------------------------ */

describe("Gesekan pipa — Colebrook-White", () => {
  it("cocok dengan pembacaan diagram Moody", () => {
    // Nilai pembanding dibaca dari diagram Moody terbitan; toleransi 2%
    // mencerminkan ketelitian pembacaan grafis, bukan longgarnya hitungan.
    close(colebrookFriction(1e5, 1e-4), 0.0182, 0.02, "f pada Re=1e5, ε/D=1e-4");
    close(colebrookFriction(1e6, 0.01), 0.0380, 0.02, "f pada Re=1e6, ε/D=0,01");
    close(colebrookFriction(1e8, 0.05), 0.0716, 0.02, "f turbulen penuh ε/D=0,05");
  });

  it("memenuhi persamaan aslinya, bukan sekadar mendekati", () => {
    // Sisa persamaan implisit harus nol pada akar yang ditemukan.
    for (const [Re, rr] of [
      [1e4, 0],
      [1e5, 1e-4],
      [1e6, 0.01],
      [1e7, 0.002],
      [1e8, 0.05],
    ] as [number, number][]) {
      const f = colebrookFriction(Re, rr);
      const lhs = 1 / Math.sqrt(f);
      const rhs = -2 * Math.log10(rr / 3.7 + 2.51 / (Re * Math.sqrt(f)));
      close(lhs, rhs, 1e-9, `sisa Colebrook Re=${Re} rr=${rr}`);
    }
  });

  it("pipa licin memberi gesekan lebih kecil daripada pipa kasar", () => {
    const Re = 1e6;
    let prev = Infinity;
    for (const rr of [0, 1e-5, 1e-4, 1e-3, 0.01, 0.05]) {
      const f = colebrookFriction(Re, rr);
      assert.ok(f > 0 && f < 0.12, `f wajar untuk rr=${rr}`);
      assert.ok(f > (prev === Infinity ? 0 : 0), "f positif");
      if (prev !== Infinity) assert.ok(f > prev, `f naik seiring kekasaran`);
      prev = f;
    }
  });

  it("pada turbulen penuh, f berhenti bergantung pada Reynolds", () => {
    const rr = 0.05;
    const a = colebrookFriction(1e7, rr);
    const b = colebrookFriction(1e8, rr);
    close(a, b, 0.01, "f mendatar di turbulen penuh");
  });

  it("aliran laminar memakai f = 64/Re", () => {
    const r = frictionFactor(1000, 0.01);
    assert.equal(r.regime, "laminar");
    close(r.f, 0.064, 1e-12, "f laminar");
  });

  it("kekasaran tidak berpengaruh pada aliran laminar", () => {
    const a = frictionFactor(1500, 0);
    const b = frictionFactor(1500, 0.05);
    close(a.f, b.f, 1e-12, "f laminar tidak bergantung kekasaran");
  });

  it("menandai zona kritis di antara Re 2000 dan 4000", () => {
    assert.equal(frictionFactor(RE_LAMINAR_MAX + 1, 1e-3).regime, "transisi");
    assert.equal(frictionFactor(3000, 1e-3).regime, "transisi");
    assert.equal(frictionFactor(RE_TURBULENT_MIN, 1e-3).regime, "turbulen");
    assert.equal(frictionFactor(RE_LAMINAR_MAX - 1, 1e-3).regime, "laminar");
  });

  it("kehilangan tinggi tekan mengikuti Darcy-Weisbach", () => {
    // hf = f (L/D) V²/2g — dihitung ulang di sini secara terpisah.
    const f = 0.02, L = 100, D = 0.3, V = 2;
    close(headLoss(f, L, D, V), (f * L * V * V) / (D * 2 * G), 1e-12, "hf");
    close(headLoss(f, L, D, V), 1.3592, 1e-3, "hf numerik");
  });

  it("bilangan Reynolds sesuai definisi", () => {
    close(reynolds(2, 0.3, 1.004e-6), 597609.56, 1e-4, "Re");
  });
});

/* ------------------------------------------------------------------ */

describe("Saluran persegi — Manning", () => {
  it("geometri basah dihitung benar", () => {
    const g = rectGeometry(5, 2);
    close(g.A, 10, 1e-12, "A");
    close(g.P, 9, 1e-12, "P");
    close(g.R, 10 / 9, 1e-12, "R");
  });

  it("kedalaman normal mengembalikan debit semula", () => {
    // Uji pulang-pergi: membalik Manning lalu menghitung maju kembali.
    for (const [Q, b, n, S] of [
      [12, 5, 0.025, 0.0015],
      [1.2, 1.5, 0.013, 0.004],
      [80, 12, 0.03, 0.0008],
      [45, 8, 0.05, 0.02],
    ] as number[][]) {
      const y0 = normalDepth(Q, b, n, S);
      close(manningDischarge(b, y0, n, S), Q, 1e-6, `Q pada y0 (Q=${Q})`);
    }
  });

  it("nilai acuan yang sudah dihitung tangan", () => {
    close(normalDepth(12, 5, 0.025, 0.0015), 1.5821, 1e-3, "y0");
  });

  it("debit naik monoton terhadap kedalaman", () => {
    let prev = -1;
    for (let y = 0.1; y <= 5; y += 0.1) {
      const Q = manningDischarge(5, y, 0.025, 0.0015);
      assert.ok(Q > prev, `Q harus naik pada y=${y.toFixed(1)}`);
      prev = Q;
    }
  });

  it("kemiringan lebih curam memberi kedalaman lebih dangkal", () => {
    const landai = normalDepth(12, 5, 0.025, 0.0008);
    const curam = normalDepth(12, 5, 0.025, 0.02);
    assert.ok(curam < landai, "y0 pada saluran curam harus lebih kecil");
  });

  it("setiap kelas punya label dan catatan dalam dua bahasa", () => {
    for (const Fr of [0.8, 1.4, 2.0, 3.5, 6.0, 11]) {
      const k = classifyJump(Fr);
      for (const lang of ["id", "en"] as const) {
        assert.ok(k.label[lang].length > 0, `label ${lang} pada Fr=${Fr}`);
        assert.ok(k.note[lang].length > 20, `catatan ${lang} pada Fr=${Fr}`);
      }
      assert.notEqual(k.label.id, k.label.en, "label harus benar-benar diterjemahkan");
    }
  });

  it("menggolongkan regime terhadap kedalaman kritis", () => {
    const yc = 0.8374;
    assert.equal(classifyRegime(1.58, yc), "subkritis");
    assert.equal(classifyRegime(0.4, yc), "superkritis");
    assert.equal(classifyRegime(yc, yc), "kritis");
  });

  it("menamai jenis kemiringan dengan benar", () => {
    assert.match(slopeType(1.58, 0.84).id, /Landai/);
    assert.match(slopeType(1.58, 0.84).en, /Mild/);
    assert.match(slopeType(0.5, 0.84).id, /Curam/);
    assert.match(slopeType(0.84, 0.84).id, /Kritis/);
  });
});

/* ------------------------------------------------------------------ */

describe("Aliran berubah lambat", () => {
  const Q = 12, b = 5, n = 0.025, S0 = 0.0015;

  it("pada kedalaman normal, kemiringan gesek sama dengan kemiringan dasar", () => {
    // Ini definisi aliran seragam, dan syarat agar dy/dx bernilai nol.
    const y0 = normalDepth(Q, b, n, S0);
    close(frictionSlope(Q, b, y0, n), S0, 1e-9, "Sf pada y0");
    close(gvfSlope(Q, b, y0, n, S0), 0, 0, "dy/dx pada y0", 1e-9);
  });

  it("kemiringan muka air berlawanan tanda di kedua sisi kedalaman normal", () => {
    const y0 = normalDepth(Q, b, n, S0);
    assert.ok(gvfSlope(Q, b, y0 * 1.4, n, S0) > 0, "dy/dx positif di atas y0");
    const yc = criticalDepth(Q / b);
    const yTengah = (y0 + yc) / 2;
    assert.ok(gvfSlope(Q, b, yTengah, n, S0) < 0, "dy/dx negatif antara yc dan y0");
  });

  it("menamai profil sesuai penggolongan baku", () => {
    const L = 800;
    assert.equal(gvfProfile(Q, b, n, S0, 2.5, L).profile, "M1");
    assert.equal(gvfProfile(Q, b, n, S0, 1.2, L).profile, "M2");
    assert.equal(gvfProfile(Q, b, n, 0.02, 0.9, L).profile, "S1");
  });

  it("profil M1 menuju kedalaman normal ke arah hulu", () => {
    const r = gvfProfile(Q, b, n, S0, 2.5, 3000, 900);
    const hulu = r.points[0].y;
    assert.ok(
      Math.abs(hulu - r.y0) < Math.abs(2.5 - r.y0) * 0.25,
      `profil harus mendekati y0: hulu=${hulu.toFixed(3)}, y0=${r.y0.toFixed(3)}`
    );
    assert.equal(r.direction, "hulu");
    assert.equal(r.mild, true);
  });

  it("aliran superkritis ditelusuri ke arah hilir", () => {
    const r = gvfProfile(Q, b, n, 0.02, 0.35, 400);
    assert.equal(r.direction, "hilir");
    assert.equal(r.mild, false);
  });

  it("seluruh kedalaman tetap positif dan terbatas", () => {
    for (const yCtl of [0.3, 0.9, 1.6, 2.5, 4]) {
      const r = gvfProfile(Q, b, n, S0, yCtl, 2000);
      for (const p of r.points) {
        assert.ok(
          Number.isFinite(p.y) && p.y > 0 && p.y < 60,
          `kedalaman wajar pada x=${p.x}`
        );
      }
    }
  });

  it("titik dekat kondisi kritis ditandai, bukan disembunyikan", () => {
    const r = gvfProfile(Q, b, n, S0, criticalDepth(Q / b) * 1.01, 300);
    assert.ok(
      r.points.some((p) => p.nearCritical),
      "harus ada titik bertanda nearCritical"
    );
  });
});

/* ------------------------------------------------------------------ */

describe("Ambang ukur V", () => {
  it("koefisien debit 90 derajat sesuai rentang ISO 1438", () => {
    // ISO 1438 dan Kindsvater-Shen memberi Ce sekitar 0,578–0,581.
    const Ce = notchCe(90);
    assert.ok(Ce > 0.577 && Ce < 0.582, `Ce=${Ce} harus di rentang ISO 1438`);
  });

  it("takik lebih lancip memberi koefisien lebih besar", () => {
    assert.ok(notchCe(30) > notchCe(90), "Ce naik pada sudut lancip");
  });

  it("debit mengikuti pangkat lima per dua terhadap tinggi muka air", () => {
    // Pada tinggi besar, pengaruh koreksi kh dapat diabaikan dan
    // perbandingan debit harus mendekati 2^2,5.
    const a = notchDischarge(0.4, 90).Q;
    const b2 = notchDischarge(0.2, 90).Q;
    close(a / b2, Math.pow(2, 2.5), 0.01, "rasio pangkat 5/2");
  });

  it("cocok dengan hitungan tangan pada H = 0,2 m dan θ = 90°", () => {
    const { Q } = notchDischarge(0.2, 90);
    const Ce = notchCe(90);
    const he = 0.2 + 0.00085;
    const manual =
      (8 / 15) * Ce * Math.sqrt(2 * G) * Math.tan(Math.PI / 4) * Math.pow(he, 2.5);
    close(Q, manual, 1e-12, "Q hitung tangan");
  });

  it("menandai tinggi muka air di bawah rentang keberlakuan", () => {
    assert.equal(notchDischarge(0.03, 90).outOfRange, true);
    assert.equal(notchDischarge(NOTCH_H_MIN, 90).outOfRange, false);
    assert.equal(notchDischarge(0.2, 90).outOfRange, false);
  });

  it("debit naik monoton terhadap tinggi muka air", () => {
    let prev = -1;
    for (let H = 0.01; H <= 0.5; H += 0.01) {
      const { Q } = notchDischarge(H, 90);
      assert.ok(Q > prev, `Q harus naik pada H=${H.toFixed(2)}`);
      prev = Q;
    }
  });

  it("tidak menghasilkan nilai negatif pada tinggi muka air nol", () => {
    const { Q } = notchDischarge(0, 90);
    assert.ok(Q >= 0 && Number.isFinite(Q), "Q pada H=0 harus wajar");
  });
});
