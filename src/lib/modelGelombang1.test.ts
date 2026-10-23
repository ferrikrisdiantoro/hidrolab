import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fishPassage,
  markRecapture,
  bridgePiers,
  culvert,
  backwaterExtent,
  broadCrestControlDepth,
  flumeDischarge,
  rouseState,
  waterViscosity,
  floodHydrograph,
  vortexPair,
  deformation,
  linearWave,
  reynoldsExperiment,
  colebrookFriction,
  reservoirRouting,
  riverHabitat,
  triangularInflow,
} from "./hydraulics.ts";
import {
  checksHabitat,
  checksMarkRecapture,
  checksPassage,
  checksRouting,
  checksBridge,
  checksCulvert,
  checksBackwater,
  checksFlume,
  checksHydrograph,
  checksReynoldsExp,
} from "./checks.ts";
import { evaluate } from "./verify.ts";
import { sectionFlow } from "./discharge.ts";

/*
 * Gelombang 1 perbaikan model (23 Okt 2026). Sumber temuan:
 * Spesifikasi Phase 1/B2..B8, bagian "Perlu perbaikan model".
 */

const gagal = (cs: { label: { id: string } }[]) =>
  (cs as Parameters<typeof evaluate>[0][])
    .filter((c) => !evaluate(c).pass)
    .map((c) => c.label.id);

/** Kisi masuk lama Client HY-01 (PenelusuranWadukClient.tsx:116-127) */
const kisiLama = (Qp: number, tPeak: number) => {
  const tb = 2.67 * tPeak;
  const pts: { t: number; Q: number }[] = [];
  for (let i = 0; i <= 160; i++) {
    const tt = (tb * 1.6 * i) / 160;
    const f = tt <= 0 || tt >= tb ? 0 : tt <= tPeak ? tt / tPeak : (tb - tt) / (tb - tPeak);
    pts.push({ t: tt, Q: Qp * f });
  }
  return pts;
};

/*
 * HY-01. Waduk dengan tampungan hampir nol memberi O ≈ I dan tidak pernah
 * O > I (Chow, Maidment & Mays 1988, Applied Hydrology §8.2: puncak keluar
 * jatuh di perpotongan kurva masuk dan keluar, pada sisi turun hidrograf
 * masuk). Trapesium satu langkah berosilasi bila Δt jauh di atas tetapan
 * waktu waduk K = dS/dO.
 */
describe("HY-01 penelusuran waduk tidak melampaui puncak masuk", () => {
  for (const [Qp, tp, ha, b, f, Cd] of [
    [120, 6, 1, 30, 3, 0.6],
    [120, 6, 1, 200, 3, 0.6],
    [120, 6, 2, 30, 3, 0.6],
    [120, 6, 5, 200, 3, 0.6],
    [2000, 0.5, 1, 200, 15, 0.75],
  ] as const) {
    it(`Ip ${Qp}, tp ${tp}, As ${ha} ha, b ${b}, Cd ${Cd}: keenam cek lolos, redam ≥ 0`, () => {
      for (const m of [kisiLama(Qp, tp), triangularInflow(Qp, tp)]) {
        const r = reservoirRouting(m, ha * 1e4, b, f, Cd);
        assert.ok(r.outflowPeak <= r.inflowPeak, `Omax ${r.outflowPeak} > Imax ${r.inflowPeak}`);
        assert.ok(r.attenuation >= 0 && r.attenuation < 0.01, `redam ${r.attenuation}`);
        assert.deepEqual(gagal(checksRouting(m, ha * 1e4, b, f, Cd)), []);
      }
    });
  }

  it("kasus default (As 200 ha) tetap Omax 53,88 m³/s ± 0,1 %", () => {
    const r = reservoirRouting(kisiLama(120, 6), 200e4, 30, 3, 0.6);
    assert.ok(Math.abs(r.outflowPeak / 53.88 - 1) < 1e-3, `Omax ${r.outflowPeak}`);
  });

  it("kisi masuk segitiga memuat titik t = tp, jadi puncaknya persis Ip", () => {
    const m = triangularInflow(120, 6);
    const r = reservoirRouting(m, 200e4, 30, 3, 0.6);
    assert.equal(r.inflowPeak, 120);
    assert.ok(m.some((p) => p.t === 6));
    for (let i = 1; i < m.length; i++) assert.ok(m[i].t > m[i - 1].t);
    assert.equal(m[0].t, 0);
    assert.ok(Math.abs(m[m.length - 1].t - 1.6 * 2.67 * 6) < 1e-12);
    assert.deepEqual(gagal(checksRouting(m, 200e4, 30, 3, 0.6)), []);
  });
});

/*
 * EH-06. Kedalaman dicari dengan bagi dua; batas atas tetap 20 m memotong
 * kedalaman diam-diam pada sungai sempit yang landai dan kasar (Q 30 sampai
 * 120, W 2, S 0,2 permil, n 0,08, semuanya di dalam rentang penggeser).
 * Manning: debit naik monoton terhadap kedalaman pada penampang yang sama.
 */
describe("EH-06 kedalaman habitat sungai tidak terpotong", () => {
  it("Q 60 lebih dalam daripada Q 30 (W 2, S 0,2 permil, n 0,08)", () => {
    const a = riverHabitat(30, 2, 0.0002, 0.08);
    const b = riverHabitat(60, 2, 0.0002, 0.08);
    assert.ok(b.maxDepth > a.maxDepth, `${b.maxDepth} <= ${a.maxDepth}`);
    assert.ok(a.maxDepth > 20, `kedalaman ${a.maxDepth}`);
    assert.equal(a.depthCapped, false);
  });
  it("debit hasil kedalaman itu sama dengan debit yang diminta", () => {
    const r = riverHabitat(120, 2, 0.0002, 0.08);
    let q = 0;
    for (const c of r.cells) q += c.velocity * c.depth * (2 / 60);
    assert.ok(Math.abs(q / 120 - 1) < 1e-6, `q ${q}`);
  });
  for (const Q of [30, 60, 120]) {
    it(`blok verifikasi lolos pada Q ${Q}, W 2, S 0,2 permil, n 0,08`, () => {
      assert.deepEqual(gagal(checksHabitat(Q, 2, 0.0002, 0.08)), []);
    });
  }
  it("kasus bawaan lembar tidak berubah", () => {
    assert.deepEqual(gagal(checksHabitat(5, 20, 0.002, 0.035)), []);
  });
});

/*
 * EK-03. Tangkapan ulang bertanda m tidak dapat melebihi yang ditandai M
 * maupun tangkapan kedua n. Pada m = n, Chapman (M+1)(n+1)/(m+1) − 1 = M =
 * Petersen M n / m persis (identitas aljabar dua rumus yang dipakai lib), jadi
 * sifatnya "tidak pernah lebih besar", bukan "selalu lebih kecil".
 */
describe("EK-03 tangkap-tandai-ulang pada batas masukan", () => {
  it("m > M ditandai mustahil", () => {
    assert.equal(markRecapture(5, 150, 30).impossible, true);
    assert.equal(markRecapture(5, 5, 6).impossible, true);
    assert.equal(markRecapture(200, 150, 20).impossible, false);
    assert.equal(markRecapture(5, 5, 5).impossible, false);
  });
  it("pada m = n, Chapman sama dengan Petersen", () => {
    const r = markRecapture(100, 100, 100);
    assert.ok(Math.abs(r.chapman - r.petersen) < 1e-9);
  });
  for (const [M, n, m] of [
    [5, 5, 5],
    [100, 100, 100],
    [5, 150, 5],
    [5, 150, 30],
    [2000, 5, 5],
    [200, 150, 20],
  ] as const) {
    it(`blok verifikasi lolos pada M ${M}, n ${n}, m ${Math.min(m, n)}`, () => {
      assert.deepEqual(gagal(checksMarkRecapture(M, n, Math.min(m, n))), []);
    });
  }
});

/*
 * EK-04. dN/dt = r p N (1 − N/K) − d N bernilai negatif untuk setiap N > K,
 * jadi populasi yang dimulai di atas K turun tanpa naik lagi dan yang
 * dimulai di bawah K tidak pernah melampauinya (tanda laju persamaan yang
 * dipakai fishPassage sendiri). Penggeser N0 sampai 20 000, K mulai 500.
 */
describe("EK-04 populasi di atas daya dukung", () => {
  for (const [N0, K] of [
    [1200, 1000],
    [20000, 10000],
    [20000, 500],
    [1000, 5000],
  ] as const) {
    it(`blok verifikasi lolos pada N0 ${N0}, K ${K}`, () => {
      assert.deepEqual(gagal(checksPassage(N0, K, 0.6, 0.1, 0.7)), []);
    });
  }
  it("N0 > K turun monoton", () => {
    const r = fishPassage(20000, 500, 0.6, 0.1, 0.7);
    for (let i = 1; i < r.path.length; i++)
      assert.ok(r.path[i].population <= r.path[i - 1].population);
  });
});

/*
 * PI-04. Blasius f = 0,316 Re^-1/4 berlaku sampai Re 100 000 (Blasius 1913,
 * lewat Wikipedia "Darcy friction factor formulae", dibuka 23 Okt 2026).
 * Di atasnya dipakai kurva licin Colebrook-White (Moody 1944 ≈ 0,0115 pada
 * Re 10⁶).
 */
describe("PI-04 faktor gesekan dan lapisan kental", () => {
  it("Q 0,02, D 0,02, T 15: f kurva licin 0,01145, bukan Blasius 0,00974", () => {
    const r = reynoldsExperiment(0.02, 0.02, 15, 0);
    assert.equal(r.regime, "turbulen");
    assert.ok(Math.abs(r.friction - 0.01145) < 0.0001, `f ${r.friction}`);
    assert.ok(Math.abs(r.friction - colebrookFriction(r.reynolds, 0)) < 1e-15);
  });
  it("laminar: tebal lapisan kental tidak terdefinisi", () => {
    const r = reynoldsExperiment(1e-6, 0.2, 0, 0);
    assert.equal(r.regime, "laminar");
    assert.ok(Number.isNaN(r.viscousThickness));
  });
  it("turbulen: tebal lapisan kental tetap berhingga dan positif", () => {
    const r = reynoldsExperiment(0.02, 0.02, 15, 0);
    assert.ok(Number.isFinite(r.viscousThickness) && r.viscousThickness > 0);
  });
  for (const [Q, D, T, q] of [
    [0.02, 0.02, 15, 0],
    [1e-6, 0.2, 0, 0],
    [0.0005, 0.05, 15, 1],
  ] as const) {
    it(`blok verifikasi lolos pada Q ${Q}, D ${D}, T ${T}, ketenangan ${q}`, () => {
      assert.deepEqual(gagal(checksReynoldsExp(Q, D, T, q)), []);
    });
  }
});

/*
 * FP-03. Batas pecah: Miche (1944) [H/L]maks = 0,142 tanh(kh) dan indeks
 * pecah γ = H/h ≈ 0,78 (Bosboom & Stive, Coastal Dynamics §5.2.5, pers.
 * 5.2.5.1). a₀ = H/(2 sinh kh) adalah setengah sumbu mendatar di dasar.
 */
describe("FP-03 batas pecah gelombang linear", () => {
  it("tombol Gelombang pantai (T 8, h 1,2, H 1): H/h 0,833, pecah", () => {
    const r = linearWave(8, 1.2, 1);
    assert.ok(Math.abs(r.heightDepthRatio - 0.8333) < 1e-3);
    assert.equal(r.breaking, true);
  });
  it("T 1, h 500, H 6: H/L 3,84, pecah", () => {
    const r = linearWave(1, 500, 6);
    assert.ok(Math.abs(r.steepness - 3.84) < 0.01, `H/L ${r.steepness}`);
    assert.equal(r.breaking, true);
  });
  it("T 8, h 20, H 1: tidak pecah", () => {
    const r = linearWave(8, 20, 1);
    assert.equal(r.breaking, false);
  });
  it("a₀ = H / (2 sinh kh), di air dangkal mendekati H/(2kh) bukan H/2", () => {
    const r = linearWave(8, 1.2, 1);
    assert.ok(Math.abs(r.bottomOrbit - 1 / (2 * Math.sinh(r.k * 1.2))) < 1e-12);
    assert.ok(Math.abs(r.bottomOrbit - 1.774) < 0.001, `a0 ${r.bottomOrbit}`);
  });
});

/*
 * FF-06. x' = e^{tA} x adalah penyelesaian tepat dx/dt = A x; luasnya
 * det e^{tA} = e^{t tr A} (rumus Liouville), jadi medan tak mampat tidak
 * mengubah luas.
 */
describe("FF-06 elemen fluida tidak berubah luas bila tak mampat", () => {
  const luas = (p: { x: number; y: number }[]) => {
    let a = 0;
    for (let i = 0; i < p.length; i++) {
      const q = p[(i + 1) % p.length];
      a += p[i].x * q.y - q.x * p[i].y;
    }
    return Math.abs(a) / 2;
  };
  for (const [A, t, L] of [
    [[0, -1, 1, 0], 0.5, 1],
    [[1, 0, 0, -1], 0.5, 1],
    [[1, 0, 0, 1], 0.5, Math.E],
    [[0, 1, 0, 0], 0.5, 1],
  ] as const) {
    it(`(${A.join(", ")}), t ${t}: luas ${L.toFixed(4)}`, () => {
      const r = deformation(A[0], A[1], A[2], A[3], t);
      assert.ok(Math.abs(luas(r.deformed) - L) < 1e-9, `luas ${luas(r.deformed)}`);
      assert.ok(Math.abs(r.deformedArea - L) < 1e-9);
    });
  }
  it("putaran murni: persegi diputar 0,5 rad", () => {
    const r = deformation(0, -1, 1, 0, 0.5);
    const sudut = Math.atan2(r.deformed[1].y, r.deformed[1].x) - Math.atan2(-0.5, 0.5);
    assert.ok(Math.abs(sudut - 0.5) < 1e-12);
  });
  it("geser sederhana sama dengan hampiran lama (A nilpoten)", () => {
    const r = deformation(0, 1, 0, 0, 0.5);
    assert.ok(Math.abs(r.deformed[1].x - (0.5 - 0.25)) < 1e-12);
  });
  it("pengembangan murni dan diam", () => {
    assert.equal(deformation(1, 0, 0, 1).pureDilatation, true);
    assert.equal(deformation(1, 0, 0, -1).pureDilatation, false);
    assert.equal(deformation(0, 0, 0, 0).still, true);
    assert.equal(deformation(0, 0, 0, 0).pureDilatation, false);
  });
});

/*
 * FP-02. Dua pusaran titik berputar kaku mengelilingi pusat sirkulasinya
 * dengan Ω = (Γ1 + Γ2)/(2π d²), atau melaju lurus Γ/(2π d) bila ΣΓ = 0
 * (Lamb 1932 §155).
 */
describe("FP-02 lintasan pasangan pusaran sefase dengan Ω", () => {
  it("Γ 40/40, d 0,5, 20 s: sudut A terhadap pusat = Ω·20 = 1018,59 rad", () => {
    const r = vortexPair(40, 40, 0.5, 20);
    const Om = 80 / (2 * Math.PI * 0.25);
    assert.ok(Math.abs(Om * 20 - 1018.59) < 0.01);
    let sudut = 0;
    for (let i = 1; i < r.pathA.length; i++) {
      const a0 = Math.atan2(r.pathA[i - 1].y, r.pathA[i - 1].x);
      const a1 = Math.atan2(r.pathA[i].y, r.pathA[i].x);
      let da = a1 - a0;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      sudut += da;
    }
    assert.ok(Math.abs(sudut / (Om * 20) - 1) < 1e-3, `sudut ${sudut}`);
    assert.ok(Math.abs(r.finalSeparation - 0.5) < 1e-9);
  });
  it("Γ 10/−10, d 2: lajuan lurus 0,7958 m/s, jarak tetap", () => {
    const r = vortexPair(10, -10, 2, 20);
    assert.ok(Math.abs(r.translation - 0.7958) < 1e-4);
    const akhir = r.pathA[r.pathA.length - 1];
    assert.ok(Math.abs(Math.abs(akhir.y) - 0.7958 * 20) < 0.01);
    assert.ok(r.separationDrift < 1e-12);
  });
});

/*
 * HY-02. Hujan efektif tetap i selama lama hujan jauh melampaui tc memberi
 * debit kesetimbangan i A (Chow, Maidment & Mays 1988 bab 7). Pias hujan
 * ΔD = 0,133 Tc dan Tp = ΔD/2 + 0,6 Tc (NEH 630 Bab 16, pers. 16A-7 dan
 * 16A-13).
 */
describe("HY-02 pias hujan mengikuti waktu konsentrasi", () => {
  const iA = (10 / 3600 / 1000) * 100e6;
  for (const tc of [0.3, 0.5, 1, 2, 4]) {
    it(`P 360, D 36, CN 100, A 100, tc ${tc}: datar di i A = 277,8 m³/s ± 2 %`, () => {
      const r = floodHydrograph(360, 36, 100, 100, tc);
      assert.ok(Math.abs(iA - 277.78) < 0.01);
      for (const p of r.points.filter((q) => q.t >= 20 && q.t <= 30))
        assert.ok(Math.abs(p.Q / iA - 1) < 0.02, `t ${p.t}: Q ${p.Q}`);
      assert.ok(r.peak / iA - 1 < 0.02, `puncak ${r.peak}`);
      assert.ok(r.blockLength <= 0.133 * tc + 1e-12);
      assert.equal(r.blockTooCoarse, false);
    });
  }
  it("Tp = ΔD/2 + 0,6 tc", () => {
    const r = floodHydrograph(80, 6, 75, 50, 4);
    assert.ok(Math.abs(r.tp - (r.blockLength / 2 + 2.4)) < 1e-12);
    assert.ok(Math.abs(r.blockLength - 6 / Math.ceil(6 / 0.532)) < 1e-12);
  });
  for (const [P, D, CN, A, tc] of [
    [80, 6, 75, 50, 4],
    [360, 36, 100, 100, 0.3],
    [5, 1, 30, 1, 24],
    [400, 36, 100, 1000, 0.3],
    [20, 2, 70, 50, 24],
  ] as const) {
    it(`blok verifikasi lolos pada P ${P}, D ${D}, CN ${CN}, A ${A}, tc ${tc}`, () => {
      assert.deepEqual(gagal(checksHydrograph(P, D, CN, A, tc)), []);
    });
  }
});

/*
 * HY-03. Hitungan per ruas mengandaikan x naik (Chow 1959 §2-2, geometri
 * trapesium per ruas). Pipa penuh: T = 0, Fr tak terdefinisi.
 */
describe("HY-03 penampang alam tak berurut dan pipa penuh", () => {
  const pts = [
    { x: 0, y: 2.5 },
    { x: 8, y: 0 },
    { x: 4, y: 0.5 },
    { x: 16, y: 3 },
  ];
  const res = { method: "manning" as const, n: 0.03 };
  it("x tidak naik monoton ditandai unordered, tidak diurutkan diam-diam", () => {
    const f = sectionFlow({ shape: "alam", pts }, 1, 0.001, res);
    assert.equal(f.unordered, true);
    assert.ok(Math.abs(f.discharge - 3.5839) < 1e-3, "hasil tidak diubah");
  });
  it("versi terurut: Q 3,3334 m³/s, T 7,667 m, unordered salah", () => {
    const urut = [...pts].sort((a, b) => a.x - b.x);
    const f = sectionFlow({ shape: "alam", pts: urut }, 1, 0.001, res);
    assert.equal(f.unordered, false);
    assert.ok(Math.abs(f.discharge - 3.3334) < 1e-4, `Q ${f.discharge}`);
    assert.ok(Math.abs(f.topWidth - 7.667) < 1e-3, `T ${f.topWidth}`);
  });
  it("pipa penuh D 1, y 1,1: Froude bukan angka berhingga", () => {
    const f = sectionFlow({ shape: "lingkaran", D: 1 }, 1.1, 0.001, { method: "manning", n: 0.013 });
    assert.equal(Number.isFinite(f.froude), false);
  });
  it("pipa setengah penuh tetap Fr 0,492", () => {
    const f = sectionFlow({ shape: "lingkaran", D: 1 }, 0.5, 0.001, { method: "manning", n: 0.013 });
    assert.ok(Math.abs(f.froude - 0.492) < 1e-3, `Fr ${f.froude}`);
  });
});

/*
 * SD-02. Golongan bilangan Rouse (Wikipedia "Rouse number", mengutip
 * Whipple 2004, MIT OCW 12.163): < 0,8 muatan bilas; 0,8-1,2 melayang
 * penuh; 1,2-2,5 melayang sebagian; > 2,5 angkutan dasar.
 */
describe("SD-02 nama golongan Rouse (field transport)", () => {
  const nu = waterViscosity(15);
  it("d 0,1 mm, u* 0,05: Z 0,3262, muatan bilas", () => {
    const r = rouseState(0.0001, 2.65, nu, 0.05, 2, 0.05);
    assert.ok(Math.abs(r.Z - 0.3262) < 1e-3, `Z ${r.Z}`);
    assert.equal(r.transport, "muatan-bilas");
  });
  it("d 0,5 mm, u* 0,05: Z 3,308, angkutan dasar", () => {
    const r = rouseState(0.0005, 2.65, nu, 0.05, 2, 0.05);
    assert.ok(Math.abs(r.Z - 3.308) < 2e-3, `Z ${r.Z}`);
    assert.equal(r.transport, "dasar");
  });
  it("di sekitar batas 0,8 / 1,2 / 2,5", () => {
    for (const [Z, nama] of [
      [0.79, "muatan-bilas"],
      [0.81, "melayang-penuh"],
      [1.19, "melayang-penuh"],
      [1.21, "melayang-sebagian"],
      [2.49, "melayang-sebagian"],
      [2.51, "dasar"],
    ] as const) {
      // Z berbanding terbalik dengan u*, jadi u* = Z(u* 1) / Z
      const Z1 = rouseState(0.0002, 2.65, nu, 1, 2, 0.05).Z;
      const r = rouseState(0.0002, 2.65, nu, Z1 / Z, 2, 0.05);
      assert.equal(r.transport, nama, `Z ${r.Z}`);
    }
  });
});

/*
 * FM-04. Flum adalah penyempitan; leher lebih lebar daripada saluran datang
 * ditolak. b = B sah (penyempitan dasar saja, Bos 1989 bab 7).
 */
describe("FM-04 leher flum tidak lebih lebar daripada saluran", () => {
  it("h1 0,3, b 5, B 1: tidak terkendali, Q 0", () => {
    const r = flumeDischarge(0.3, 5, 1, 1.5, 1, 0.99);
    assert.equal(r.controlled, false);
    assert.equal(r.reason, "leher-lebar");
    assert.equal(r.Q, 0);
  });
  it("h1 0,1, b 2, B 1: ditolak", () => {
    assert.equal(flumeDischarge(0.1, 2, 1, 0.5, 0.5, 0.99).reason, "leher-lebar");
  });
  it("preset (0,3; 0,6; 1,2; 0,25; 0,9; 0,99) tidak berubah, Q 0,1692", () => {
    const r = flumeDischarge(0.3, 0.6, 1.2, 0.25, 0.9, 0.99);
    assert.equal(r.controlled, true);
    assert.ok(Math.abs(r.Q - 0.1692) < 1e-4, `Q ${r.Q}`);
  });
  it("b = B tetap sah", () => {
    assert.equal(flumeDischarge(0.3, 1, 1, 0.5, 1, 0.99).reason === "leher-lebar", false);
  });
  it("blok verifikasi lolos pada b > B", () => {
    assert.deepEqual(gagal(checksFlume(0.3, 5, 1, 1.5, 1, 0.99)), []);
  });
  it("blok verifikasi lolos pada leher tak terkendali (h1 0,02, b 0,6, B 0,15, p 0)", () => {
    assert.deepEqual(gagal(checksFlume(0.02, 0.6, 0.15, 0, 0.9, 0.99)), []);
  });
});

/*
 * HS-09. Di saluran curam pengaruh bangunan berhenti di loncatan air, tempat
 * kedalaman S1 sama dengan konjugat y0 (Belanger; Chow 1959 Bab 9).
 */
describe("HS-09 jangkauan pengaruh pada saluran curam berakhir di loncatan", () => {
  it("Q 80, b 25, n 0,010, S0 0,010, mercu 1,0: loncatan ≈ 58,6 m", () => {
    const yC = broadCrestControlDepth(1.0, 3.2);
    assert.ok(Math.abs(yC - 2.433) < 1e-3, `yControl ${yC}`);
    const r = backwaterExtent(80, 25, 0.01, 0.01, yC);
    assert.ok(Math.abs(r.y0 - 0.513) < 1e-3);
    assert.equal(r.endsInJump, true);
    assert.equal(r.beyondSearch, false);
    assert.ok(Math.abs(r.distance - 58.6) < 2, `jarak ${r.distance}`);
  });
  it("saluran landai tidak berubah (endsInJump salah)", () => {
    const r = backwaterExtent(12, 5, 0.025, 0.0005, 3);
    assert.equal(r.endsInJump, false);
  });
  for (const [Q, b, n, S0, P] of [
    [80, 25, 0.01, 0.01, 1.0],
    [12, 5, 0.025, 0.01, 1.4],
  ] as const) {
    it(`blok verifikasi lolos pada Q ${Q}, b ${b}, n ${n}, S0 ${S0}, P ${P}`, () => {
      const yC = broadCrestControlDepth(P, Q / b);
      assert.deepEqual(gagal(checksBackwater(Q, b, n, S0, yC)), []);
    });
  }
});

/*
 * HS-04. FHWA HDS-5 edisi ke-3 (2012), Lampiran A pers. A.1 dan A.3, Tabel
 * A.1 Chart 1 skala 1 (beton bulat, mulut persegi berdinding kepala); ho =
 * maks(TW, (dc + D)/2), §3.3.3.
 */
describe("HS-04 gorong-gorong menurut HDS-5", () => {
  it("Q 2, D 1,2, S 0,01: X 2,92, yc 0,778, Hc 1,117, HWi 1,211 m", () => {
    const r = culvert(2, 1.2, 30, 0.01, 0.013, 0, 10);
    const X = (1.811 * 2) / ((Math.PI / 4) * 1.44 * Math.sqrt(1.2));
    assert.ok(Math.abs(X - 2.92) < 0.01);
    assert.ok(Math.abs(r.inletHeadwater - 1.211) < 0.002, `HWi ${r.inletHeadwater}`);
  });
  it("Q 2, D 1, S 0,02: X 4,61, terendam, HWi 1,506 m", () => {
    const r = culvert(2, 1, 30, 0.02, 0.013, 0, 10);
    assert.ok(Math.abs(r.inletHeadwater - 1.506) < 0.002, `HWi ${r.inletHeadwater}`);
  });
  it("HWi ≥ Hc − 0,5 S D untuk semua debit (air tidak masuk di bawah energi kritis)", () => {
    for (const D of [0.3, 1.2, 4]) {
      for (const Q of [0.05, 0.2, 0.5, 1, 2, 5, 10, 30]) {
        const r = culvert(Q, D, 30, 0.01, 0.013, 0, 10);
        assert.ok(r.criticalDepth < D);
        assert.ok(
          r.inletHeadwater >= r.criticalHead - 0.5 * 0.01 * D - 1e-12,
          `Q ${Q}, D ${D}: HWi ${r.inletHeadwater} < Hc ${r.criticalHead}`
        );
      }
    }
  });
  it("Q 2, D 1,2: yc 0,778 m, Hc 1,117 m", () => {
    const r = culvert(2, 1.2, 30, 0.01, 0.013, 0, 10);
    assert.ok(Math.abs(r.criticalDepth - 0.778) < 0.001, `dc ${r.criticalDepth}`);
    assert.ok(Math.abs(r.criticalHead - 1.117) < 0.001, `Hc ${r.criticalHead}`);
    assert.equal(r.inletForm, "tak-terendam");
  });
  it("ho = maks(TW, (dc + D)/2): Q 2, D 1, TW 0,4 → ho 0,906 m", () => {
    const L = 30;
    const n = 0.013;
    const S = 0.01;
    const r = culvert(2, 1, L, S, n, 0.4, 10);
    const V = 2 / (Math.PI / 4);
    const hf = ((0.5 + (2 * 9.81 * n * n * L) / Math.pow(0.25, 4 / 3) + 1) * V * V) / (2 * 9.81);
    const ho = r.outletHeadwater - hf + S * L;
    assert.ok(Math.abs(ho - 0.906) < 0.002, `ho ${ho}`);
  });
  for (const [Q, D, L, S, n, tw, road] of [
    [2, 1.2, 30, 0.01, 0.013, 0, 10],
    [0.05, 4, 120, 0.08, 0.035, 0, 0.5],
    [30, 0.3, 4, 0.0005, 0.009, 5, 12],
    [5, 1.5, 40, 0.005, 0.013, 0.8, 4],
  ] as const) {
    it(`blok verifikasi lolos pada Q ${Q}, D ${D}, L ${L}, S ${S}, TW ${tw}`, () => {
      assert.deepEqual(gagal(checksCulvert(Q, D, L, S, n, tw, road)), []);
    });
  }
});

/*
 * HS-05. Celah antar pilar tersendat bila E3 < 1,5 yc(qc), qc = Q/(B − N a)
 * (energi spesifik minimum penampang persegi, Henderson 1966 bab 2).
 */
describe("HS-05 jembatan tersendat ditandai", () => {
  it("Q 600, B 50, y3 3, N 4, a 3: tersendat, di luar rentang Yarnell", () => {
    const r = bridgePiers(600, 50, 3, 4, 3);
    assert.ok(Math.abs(r.blockage - 0.24) < 1e-12);
    assert.equal(r.choked, true);
    assert.equal(r.outOfRange, true);
    const E3 = 3 + Math.pow(600 / 150, 2) / (2 * 9.81);
    assert.ok(Math.abs(E3 - 3.815) < 1e-3);
    assert.ok(Math.abs(1.5 * Math.cbrt(Math.pow(600 / 38, 2) / 9.81) - 4.41) < 1e-2);
  });
  it("Q 600, B 50, y3 3,2, N 2, a 1,5: tidak tersendat", () => {
    const r = bridgePiers(600, 50, 3.2, 2, 1.5);
    assert.equal(r.choked, false);
    assert.equal(r.outOfRange, false);
  });
  for (const [Q, B, y, N, a] of [
    [600, 50, 3, 4, 3],
    [600, 50, 3.2, 2, 1.5],
  ] as const) {
    it(`blok verifikasi lolos pada Q ${Q}, B ${B}, y3 ${y}, N ${N}, a ${a}`, () => {
      assert.deepEqual(gagal(checksBridge(Q, B, y, N, a, 0.9)), []);
    });
  }
});

/*
 * HS-05 gerusan. HEC-18 ed. 5 (2012) pers. 7.1 dengan K3 = 1,1 (Tabel 7.3)
 * dan batas pers. 7.2 (2,4 a pada Fr <= 0,8).
 */
describe("HS-05 gerusan pilar menurut HEC-18", () => {
  it("Q 3000, B 300, y3 15, N 2, a 0,2: Fr 0,055, dipotong ke 2,4 a = 0,48 m", () => {
    const r = bridgePiers(3000, 300, 15, 2, 0.2);
    assert.ok(Math.abs(r.Fr - 0.055) < 1e-3, `Fr ${r.Fr}`);
    assert.equal(r.scourCapped, true);
    assert.ok(Math.abs(r.scourDepth - 0.48) < 1e-12);
  });
  it("tanpa batas: ys = 2,0 · 1,1 · a^0,65 y^0,35 Fr^0,43", () => {
    const r = bridgePiers(100, 50, 3, 2, 1.5);
    const ys = 2.2 * Math.pow(1.5, 0.65) * Math.pow(3, 0.35) * Math.pow(r.Fr, 0.43);
    assert.equal(r.scourCapped, false);
    assert.ok(Math.abs(r.scourDepth - ys) < 1e-12);
  });
  it("tanpa pilar dan pada penutupan penuh blok verifikasi tetap lolos", () => {
    assert.deepEqual(gagal(checksBridge(5, 10, 0.5, 0, 0.2, 0.9)), []);
    assert.deepEqual(gagal(checksBridge(5, 10, 0.5, 4, 3, 0.9)), []);
  });
});

import { culvert as culvertBawah } from "./hydraulics.ts";

describe("HS-04: HW kendali masuk di bawah bagan HDS-5 ditandai", () => {
  it("Q 0,05, D 4, S 80 permil: HW masuk di bawah dc, ditandai", () => {
    const r = culvertBawah(0.05, 4, 30, 0.08, 0.013, 0, 5);
    assert.ok(r.inletHeadwater < r.criticalDepth);
    assert.equal(r.inletBelowChart, true);
  });
  it("keadaan lazim tidak ditandai", () => {
    const r = culvertBawah(2, 1.2, 30, 0.01, 0.013, 0, 3);
    assert.equal(r.inletBelowChart, false);
  });
});
