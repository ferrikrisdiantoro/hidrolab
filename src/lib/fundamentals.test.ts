import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ATM_HEAD,
  FALKNER_SKAN_SEPARATION,
  G,
  HYDROSTATIC_TOLERANCE,
  KARMAN_SPACING,
  MEANDER_PEAK_RATIO,
  RE_LAMINAR_MAX,
  acceleration,
  advectionDiffusion,
  curvaturePressure,
  deformation,
  ductEnergy,
  falknerSkan,
  flowLines,
  linearWave,
  meanderPath,
  momentumForce,
  reynoldsExperiment,
  riverHabitat,
  shoal,
  vapourHead,
  vortexPair,
  vortexStreet,
  waterViscosity,
} from "./hydraulics.ts";

/* ================================================================== *
 * FF-01, FF-02, PI-07  Garis energi
 * ================================================================== */

const pipa = (D2: number, z2 = 0) => [
  { x: 0, z: 0, D: 0.3 },
  { x: 50, z: z2, D: D2 },
];

describe("Garis energi pada saluran tertutup", () => {
  it("ketiga tinggi tekannya berjumlah tinggi energi di setiap penampang", () => {
    for (const Q of [0.05, 0.2, 0.6])
      for (const D2 of [0.15, 0.3, 0.6])
        for (const z2 of [-5, 0, 8]) {
          const r = ductEnergy(Q, pipa(D2, z2), 25, 0.02);
          for (const p of r.points)
            assert.ok(
              Math.abs(p.z + p.pressureHead + p.velocityHead - p.egl) < 1e-9,
              `Q ${Q} D2 ${D2} z2 ${z2}: jumlahnya ${p.z + p.pressureHead + p.velocityHead}, garis energinya ${p.egl}`
            );
        }
  });

  it("tanpa kehilangan, tinggi energinya tetap di sepanjang salurannya", () => {
    const r = ductEnergy(0.2, pipa(0.15, 8), 25, 0);
    for (const p of r.points) assert.ok(Math.abs(p.egl - 25) < 1e-9);
    assert.equal(r.energyRises, false);
  });

  it("menaikkan pipanya tidak mengubah tinggi energi, hanya pembagiannya", () => {
    /* Satu meter elevasi ditukar satu meter tinggi tekan, tepat. */
    const a = ductEnergy(0.2, pipa(0.3, 0), 25, 0);
    const b = ductEnergy(0.2, pipa(0.3, 6), 25, 0);
    assert.ok(Math.abs(a.points[1].egl - b.points[1].egl) < 1e-9);
    assert.ok(
      Math.abs(
        a.points[1].pressureHead - b.points[1].pressureHead - 6
      ) < 1e-9,
      "selisih tinggi tekannya harus tepat enam meter"
    );
  });

  it("garis energi tidak pernah naik tanpa pompa, di seluruh rentangnya", () => {
    for (const Q of [0.02, 0.2, 0.8])
      for (const D2 of [0.1, 0.3, 0.8])
        for (const f of [0, 0.015, 0.05]) {
          const r = ductEnergy(Q, pipa(D2, 0), 25, f);
          assert.equal(
            r.energyRises,
            false,
            `Q ${Q} D2 ${D2} f ${f} menaikkan garis energinya`
          );
        }
  });

  it("garis tekanan JUSTRU naik pada pembesaran penampang", () => {
    /*
     * Dua garis yang kelihatan serupa dengan dua aturan yang berbeda:
     * yang satu hanya boleh turun, yang lain boleh naik dan memang naik.
     */
    const besar = ductEnergy(0.2, pipa(0.6, 0), 25, 0);
    assert.equal(besar.gradeRises, true);
    assert.equal(besar.energyRises, false);
    const kecil = ductEnergy(0.2, pipa(0.15, 0), 25, 0);
    assert.equal(kecil.gradeRises, false);
  });

  it("tinggi kecepatan berbanding pangkat empat kebalikan garis tengahnya", () => {
    /* Luas berbanding kuadrat garis tengah, kecepatan kebalikan luas,
       tinggi kecepatan kuadrat kecepatan: pangkat empat seluruhnya. */
    const a = ductEnergy(0.2, pipa(0.3), 25, 0).points[1];
    const b = ductEnergy(0.2, pipa(0.15), 25, 0).points[1];
    assert.ok(
      Math.abs(b.velocityHead / a.velocityHead - 16) < 1e-9,
      `nisbahnya ${b.velocityHead / a.velocityHead}, bukan enam belas`
    );
  });

  it("menandai kavitasi tepat ketika tekanan mutlaknya turun ke tekanan uap", () => {
    const uap = vapourHead(15);
    /*
     * Pipa yang naik lebih dari sepuluh meter di atas tinggi energinya.
     * Sepuluh meter itu bukan angka sembarangan: itulah seluruh tinggi
     * tekan atmosfer, dan di atasnya tidak ada tekanan yang tersisa untuk
     * ditahan air.
     */
    const tinggi = ductEnergy(0.05, pipa(0.3, 16), 5, 0);
    assert.ok(tinggi.minPressureHead + ATM_HEAD <= uap + 1e-9);
    assert.equal(tinggi.cavitates, true);
    assert.equal(tinggi.subAtmospheric, true);
    /* Dan tepat di bawah ambangnya, belum */
    assert.equal(ductEnergy(0.05, pipa(0.3, 15), 5, 0).cavitates, false);
    const rendah = ductEnergy(0.05, pipa(0.3, 0), 25, 0);
    assert.equal(rendah.cavitates, false);
  });

  it("kehilangan gesekan berbanding lurus dengan panjangnya", () => {
    const a = ductEnergy(0.2, [
      { x: 0, z: 0, D: 0.3 },
      { x: 50, z: 0, D: 0.3 },
    ], 25, 0.02);
    const b = ductEnergy(0.2, [
      { x: 0, z: 0, D: 0.3 },
      { x: 100, z: 0, D: 0.3 },
    ], 25, 0.02);
    assert.ok(Math.abs(b.frictionLoss / a.frictionLoss - 2) < 1e-9);
  });
});

/* ================================================================== *
 * FF-03, PI-05, PI-06  Gaya momentum
 * ================================================================== */

describe("Gaya momentum pada belokan dan perubahan penampang", () => {
  it("belokan seratus delapan puluh derajat menuntut dua kali gaya belokan sembilan puluh", () => {
    /*
     * Bukan sudutnya yang menentukan melainkan perubahan vektornya:
     * membalik arah sepenuhnya menuntut dua kali membelokkan siku.
     */
    const a = momentumForce(0.5, 0.4, 0.4, 60, 90);
    const b = momentumForce(0.5, 0.4, 0.4, 60, 180);
    const nisbah = b.resultant / a.resultant;
    assert.ok(
      Math.abs(nisbah - Math.SQRT2) < 1e-9,
      `siku memberi resultan akar dua kali gaya satu sisi, nisbahnya ${nisbah}`
    );
  });

  it("suku tekanan menguasai suku momentum pada pipa air bertekanan", () => {
    const r = momentumForce(0.6, 0.5, 0.5, 100, 90);
    assert.ok(r.pressureForce1 > 20 * r.momentumIn);
    assert.ok(r.pressureShare > 0.9, `bagian tekanannya ${r.pressureShare}`);
  });

  it("pembesaran penampang menaikkan tekanan meskipun energinya hilang", () => {
    /* Dua hal yang sering dikira bertentangan, dan keduanya benar. */
    const r = momentumForce(0.3, 0.2, 0.4, 30, 0);
    assert.equal(r.pressureRises, true);
    assert.ok(r.expansionLoss > 0);
    assert.ok(r.velocity2 < r.velocity1);
  });

  it("kehilangan Borda-Carnot memakai kuadrat selisih, bukan selisih kuadrat", () => {
    const r = momentumForce(0.3, 0.2, 0.4, 30, 0);
    const beda = (r.velocity1 - r.velocity2) ** 2 / (2 * G);
    assert.ok(Math.abs(r.expansionLoss - beda) < 1e-12);
    const salah = (r.velocity1 ** 2 - r.velocity2 ** 2) / (2 * G);
    assert.ok(Math.abs(r.expansionLoss - salah) > 1e-3, "keduanya harus berbeda");
  });

  it("penyempitan penampang tidak memberi kehilangan mendadak pada model ini", () => {
    const r = momentumForce(0.3, 0.4, 0.2, 30, 0);
    assert.equal(r.expansionLoss, 0);
    assert.equal(r.pressureRises, false);
  });

  it("belokan tanpa tekanan dan tanpa perubahan penampang memberi gaya momentum murni", () => {
    const r = momentumForce(0.5, 0.4, 0.4, 0, 90);
    assert.ok(Math.abs(r.pressureForce1) < 1e-9);
    assert.ok(
      Math.abs(r.resultant - Math.SQRT2 * r.momentumIn) < 1e-6,
      `resultannya ${r.resultant}, momentumnya ${r.momentumIn}`
    );
  });
});

/* ================================================================== *
 * FF-04  Anggapan hidrostatis
 * ================================================================== */

describe("Sebaran tekanan pada garis arus melengkung", () => {
  it("simpangan nisbinya hanya bergantung pada kecepatan dan jari-jari", () => {
    /* Kedalamannya lenyap dari perbandingannya, dan itu sifat yang harus
       berlaku pada kedalaman berapa pun. */
    for (const V of [0.5, 2, 5])
      for (const R of [2, 10, 50]) {
        const a = curvaturePressure(V, 0.5, R);
        const b = curvaturePressure(V, 4, R);
        assert.ok(
          Math.abs(a.ratio - b.ratio) < 1e-12,
          `V ${V} R ${R}: ${a.ratio} lawan ${b.ratio}`
        );
        assert.ok(Math.abs(a.ratio - (V * V) / (G * R)) < 1e-12);
      }
  });

  it("garis arus cembung ke atas menurunkan tekanan di dasar", () => {
    const mercu = curvaturePressure(3, 1, 4);
    assert.equal(mercu.convex, true);
    assert.ok(mercu.deviation < 0);
    assert.ok(mercu.actual < mercu.hydrostatic);

    const kaki = curvaturePressure(3, 1, -4);
    assert.equal(kaki.convex, false);
    assert.ok(kaki.deviation > 0);
    assert.ok(kaki.actual > kaki.hydrostatic);
  });

  it("anggapan hidrostatis dinyatakan tidak berlaku tepat pada ambangnya", () => {
    for (const V of [0.5, 1, 2, 4]) {
      /* Jari-jari yang membuat simpangannya tepat sebesar ambangnya */
      const Rpas = (V * V) / (G * HYDROSTATIC_TOLERANCE);
      assert.equal(curvaturePressure(V, 1, Rpas * 1.01).hydrostaticValid, true);
      assert.equal(curvaturePressure(V, 1, Rpas * 0.99).hydrostaticValid, false);
    }
  });

  it("garis arus lurus memulangkan hidrostatis dengan tepat", () => {
    const r = curvaturePressure(3, 2, 1e9);
    assert.ok(Math.abs(r.actual - r.hydrostatic) < 1e-3);
    assert.equal(r.hydrostaticValid, true);
  });

  it("menandai keadaan airnya terangkat lepas dari dasar", () => {
    assert.equal(curvaturePressure(10, 1, 1).liftsOff, true);
    assert.equal(curvaturePressure(1, 1, 10).liftsOff, false);
  });
});

/* ================================================================== *
 * FF-05  Garis arus, garis jejak, lintasan partikel
 * ================================================================== */

describe("Tiga garis pada medan tak tunak", () => {
  it("ketiganya berimpit tepat ketika alirannya tunak", () => {
    const U = 2;
    const V = 1;
    const tunak = flowLines(U, V, 0, 5);
    assert.equal(tunak.steady, true);
    assert.ok(tunak.separation < 1e-9);
    /*
     * Yang diperiksa GARISNYA, bukan urutan titiknya. Ketiganya garis yang
     * sama, tetapi lintasan partikel ditelusuri dari titik lepasnya ke
     * depan sedangkan garis jejak ditelusuri dari ujung terjauh kembali ke
     * titik lepasnya, jadi titik keberapanya memang tidak berpasangan.
     */
    for (const garis of [tunak.streamline, tunak.pathline, tunak.streakline])
      for (const p of garis)
        assert.ok(
          Math.abs(p.y - (V / U) * p.x) < 1e-9,
          `titik (${p.x}, ${p.y}) tidak berada pada garis yang sama`
        );
  });

  it("dan berpisah begitu alirannya tak tunak", () => {
    const takTunak = flowLines(2, 1, 1, 5);
    assert.equal(takTunak.steady, false);
    assert.ok(
      takTunak.separation > 0.1,
      `terpisah ${takTunak.separation} meter saja`
    );
  });

  it("garis arusnya lurus, karena medannya seragam di seluruh ruang", () => {
    const r = flowLines(2, 1, 1.5, 3);
    const k =
      (r.streamline[10].y - r.streamline[0].y) /
      (r.streamline[10].x - r.streamline[0].x);
    for (let i = 1; i < r.streamline.length; i++) {
      const ki =
        (r.streamline[i].y - r.streamline[0].y) /
        Math.max(r.streamline[i].x - r.streamline[0].x, 1e-9);
      assert.ok(Math.abs(ki - k) < 1e-9);
    }
  });

  it("lintasan partikelnya memenuhi penyelesaian bentuk tertutupnya", () => {
    const U = 2;
    const V = 1;
    const w = 1.3;
    const r = flowLines(U, V, w, 4);
    for (let i = 0; i < r.pathline.length; i++) {
      const tau = (4 * i) / (r.pathline.length - 1);
      assert.ok(Math.abs(r.pathline[i].x - U * tau) < 1e-9);
      assert.ok(
        Math.abs(r.pathline[i].y - (V / w) * Math.sin(w * tau)) < 1e-9
      );
    }
  });

  it("garis jejak dan lintasan partikel berbeda fase, bukan berbeda bentuk", () => {
    /* Keduanya sinus berperioda sama, tetapi bukan garis yang sama. */
    const r = flowLines(2, 1, 1, 6);
    let beda = 0;
    for (let i = 0; i < r.pathline.length; i++)
      beda = Math.max(beda, Math.abs(r.pathline[i].y - r.streakline[i].y));
    assert.ok(beda > 0.05, `bedanya hanya ${beda}`);
  });
});

/* ================================================================== *
 * FF-06  Deformasi
 * ================================================================== */

describe("Peregangan dan pemutaran elemen fluida", () => {
  it("geser sederhana tepat separuh regangan dan separuh putaran", () => {
    /* Hasil yang paling berguna diingat dari lembar ini. */
    for (const gamma of [0.5, 2, 10]) {
      const r = deformation(0, gamma, 0, 0);
      assert.ok(Math.abs(r.vorticity + gamma) < 1e-12);
      assert.ok(Math.abs(r.rotationRate + gamma / 2) < 1e-12);
      assert.ok(Math.abs(r.principal[0] - gamma / 2) < 1e-12);
      assert.ok(
        Math.abs(r.rotationShare - 0.5) < 1e-12,
        `bagian putarnya ${r.rotationShare}`
      );
    }
  });

  it("regangan murni tidak memberi vortisitas sedikit pun", () => {
    const r = deformation(2, 0, 0, -2);
    assert.ok(Math.abs(r.vorticity) < 1e-12);
    assert.equal(r.pureStrain, true);
    assert.equal(r.incompressible, true);
    assert.ok(Math.abs(r.principal[0] - 2) < 1e-12);
  });

  it("putaran murni tidak mengubah bentuk sedikit pun", () => {
    const w = 3;
    const r = deformation(0, -w, w, 0);
    assert.equal(r.pureRotation, true);
    assert.ok(Math.abs(r.principal[0]) < 1e-12);
    assert.ok(Math.abs(r.vorticity - 2 * w) < 1e-12);
  });

  it("arah regangan utama geser sederhana empat puluh lima derajat", () => {
    const r = deformation(0, 1, 0, 0);
    assert.ok(Math.abs(Math.abs(r.principalAngle) - 45) < 1e-9);
  });

  it("aliran tak mampat ditandai tepat ketika pemuaiannya nol", () => {
    assert.equal(deformation(2, 0, 0, -2).incompressible, true);
    assert.equal(deformation(2, 0, 0, 1).incompressible, false);
    assert.ok(Math.abs(deformation(2, 0, 0, 1).dilatation - 3) < 1e-12);
  });

  it("elemen yang tak mampat menjaga luasnya", () => {
    const luas = (p: { x: number; y: number }[]) => {
      let a = 0;
      for (let i = 0; i < p.length; i++) {
        const q = p[(i + 1) % p.length];
        a += p[i].x * q.y - q.x * p[i].y;
      }
      return Math.abs(a / 2);
    };
    /* Hampiran linearnya menjaga luas sampai suku pangkat dua waktunya,
       jadi diuji pada waktu yang kecil. */
    const r = deformation(2, 0, 0, -2, 0.01);
    assert.ok(Math.abs(luas(r.deformed) - 1) < 1e-3);
  });
});

/* ================================================================== *
 * FF-07  Percepatan
 * ================================================================== */

describe("Percepatan lokal dan konvektif", () => {
  it("aliran tunak tetap berpercepatan, dan besar sekali", () => {
    const r = acceleration(0.1, 0, 0, 0.2, 0.05, 0.5, 0.25);
    assert.equal(r.steady, true);
    assert.ok(Math.abs(r.local) < 1e-9, "suku lokalnya harus nol");
    assert.ok(r.convective > 50, `konvektifnya hanya ${r.convective}`);
    assert.ok(r.inGravities > 5);
    assert.ok(Math.abs(r.convectiveShare - 1) < 1e-12);
  });

  it("saluran berpenampang tetap tidak punya percepatan konvektif", () => {
    const r = acceleration(0.1, 0.3, 1, 0.2, 0.2, 0.5, 0.25, 0);
    assert.ok(Math.abs(r.convective) < 1e-6);
    assert.ok(Math.abs(r.local) > 0);
    assert.ok(Math.abs(r.convectiveShare) < 1e-6);
  });

  it("percepatan seluruhnya adalah jumlah kedua sukunya", () => {
    for (const x of [0.1, 0.25, 0.4])
      for (const t of [0, 0.4, 1.1]) {
        const r = acceleration(0.1, 0.4, 2, 0.2, 0.08, 0.5, x, t);
        assert.ok(Math.abs(r.total - (r.local + r.convective)) < 1e-9);
      }
  });

  it("percepatan konvektif sebanding dengan kuadrat debitnya", () => {
    const a = acceleration(0.1, 0, 0, 0.2, 0.05, 0.5, 0.25);
    const b = acceleration(0.2, 0, 0, 0.2, 0.05, 0.5, 0.25);
    assert.ok(
      Math.abs(b.convective / a.convective - 4) < 1e-6,
      `nisbahnya ${b.convective / a.convective}`
    );
  });
});

/* ================================================================== *
 * PI-04  Percobaan Reynolds
 * ================================================================== */

describe("Percobaan Reynolds", () => {
  it("bilangan Reynolds pulang pergi lewat kecepatan kritisnya", () => {
    for (const D of [0.01, 0.05, 0.2])
      for (const T of [5, 20, 35]) {
        const nu = waterViscosity(T);
        const r = reynoldsExperiment(0.001, D, T, 0);
        const A = (Math.PI * D * D) / 4;
        const Qkritis = r.criticalVelocity * A;
        const cek = reynoldsExperiment(Qkritis, D, T, 0);
        assert.ok(
          Math.abs(cek.reynolds - RE_LAMINAR_MAX) / RE_LAMINAR_MAX < 1e-9,
          `D ${D} T ${T} memberi ${cek.reynolds}`
        );
        assert.ok(nu > 0);
      }
  });

  it("percobaan yang lebih tenang menahan laminar sampai Reynolds jauh lebih tinggi", () => {
    const kasar = reynoldsExperiment(0.0005, 0.05, 15, 0);
    const tenang = reynoldsExperiment(0.0005, 0.05, 15, 1);
    assert.ok(tenang.criticalReynolds > 40 * kasar.criticalReynolds);
    assert.equal(kasar.criticalReynolds, RE_LAMINAR_MAX);
  });

  it("aliran yang sama dapat laminar atau turbulen bergantung pada ketenangannya", () => {
    /* Inilah pokok percobaan Reynolds, dan yang paling sering hilang
       ketika ia diringkas menjadi satu angka dua ribu. */
    const Q = 0.0006;
    assert.equal(reynoldsExperiment(Q, 0.05, 15, 0).regime, "turbulen");
    assert.equal(reynoldsExperiment(Q, 0.05, 15, 1).regime, "laminar");
    assert.equal(reynoldsExperiment(Q, 0.05, 15, 1).quietLaminar, true);
  });

  it("panjang masuk laminar berbanding lurus dengan Reynolds, yang turbulen hampir tidak", () => {
    const l1 = reynoldsExperiment(0.00002, 0.05, 15, 0);
    const l2 = reynoldsExperiment(0.00004, 0.05, 15, 0);
    assert.equal(l1.regime, "laminar");
    assert.ok(Math.abs(l2.entryDiameters / l1.entryDiameters - 2) < 1e-9);

    const t1 = reynoldsExperiment(0.002, 0.05, 15, 0);
    const t2 = reynoldsExperiment(0.004, 0.05, 15, 0);
    assert.ok(t2.entryDiameters / t1.entryDiameters < 1.15);
  });

  it("faktor gesekan laminar tepat enam puluh empat dibagi Reynolds", () => {
    const r = reynoldsExperiment(0.00002, 0.05, 15, 0);
    assert.ok(Math.abs(r.friction - 64 / r.reynolds) < 1e-12);
  });
});

/* ================================================================== *
 * OC-11  Meander
 * ================================================================== */

describe("Perkembangan meander", () => {
  it("sungai tanpa ayunan sudut sama sekali adalah sungai lurus", () => {
    const r = meanderPath(30, 300, 0);
    assert.ok(Math.abs(r.sinuosity - 1) < 1e-9);
    assert.ok(!Number.isFinite(r.minRadius));
  });

  it("sinusitasnya naik monoton bersama sudut ayunnya, dan hanya bergantung padanya", () => {
    let sebelum = 0;
    for (const sudut of [10, 30, 50, 70, 90, 110]) {
      const r = meanderPath(30, 300, sudut);
      assert.ok(r.sinuosity > sebelum, `sudut ${sudut}`);
      sebelum = r.sinuosity;
      /* Panjang gelombangnya tidak boleh ikut mengubah sinusitasnya */
      const lain = meanderPath(30, 900, sudut);
      assert.ok(
        Math.abs(lain.sinuosity - r.sinuosity) / r.sinuosity < 0.01,
        `sudut ${sudut}: ${r.sinuosity} lawan ${lain.sinuosity}`
      );
    }
  });

  it("panjang gelombangnya sesuai hubungan terbitan Leopold dan Wolman", () => {
    /* Sebelas kali lebar sungainya, dari parit sampai sungai besar. */
    for (const W of [0.5, 5, 50, 500]) {
      const r = meanderPath(W, 11 * W, 70);
      assert.ok(
        Math.abs(r.wavelengthLeopold / W - 10.9 * Math.pow(W, 0.01)) < 1e-9
      );
    }
  });

  it("laju pindah tebing memuncak pada belokan menengah, bukan pada yang paling tajam", () => {
    /*
     * Hasil Hickin dan Nanson, dan yang paling berlawanan dengan naluri:
     * belokan yang lebih tajam justru berpindah lebih lambat.
     */
    const puncak = MEANDER_PEAK_RATIO;
    let tercepat = 0;
    let rrTercepat = 0;
    for (let rr = 0.3; rr < 12; rr += 0.05) {
      const laju =
        0.04 * (rr / puncak) * Math.exp(1 - rr / puncak);
      if (laju > tercepat) {
        tercepat = laju;
        rrTercepat = rr;
      }
    }
    assert.ok(Math.abs(rrTercepat - puncak) < 0.1, `puncaknya di ${rrTercepat}`);

    /* Dan pada lembarnya: belokan lebih tajam daripada puncak itu lebih lambat */
    const tajam = meanderPath(30, 200, 110);
    const sedang = meanderPath(30, 400, 60);
    if (tajam.radiusRatio < puncak && sedang.radiusRatio > tajam.radiusRatio)
      assert.ok(
        tajam.radiusRatio < sedang.radiusRatio,
        "yang tajam harus bernisbah lebih kecil"
      );
  });

  it("menandai leher yang sudah cukup sempit untuk terpotong", () => {
    assert.equal(meanderPath(30, 300, 30).cutoff, false);
    assert.equal(meanderPath(30, 300, 125).cutoff, true);
  });
});

/* ================================================================== *
 * EH-05, EH-06
 * ================================================================== */

describe("Gerombolan ikan", () => {
  it("memberi gambar yang sama tiap kali dijalankan", () => {
    const a = shoal(40, 1, 1, 0.5);
    const b = shoal(40, 1, 1, 0.5);
    for (let i = 0; i < a.agents.length; i++) {
      assert.ok(Math.abs(a.agents[i].x - b.agents[i].x) < 1e-12);
      assert.ok(Math.abs(a.agents[i].y - b.agents[i].y) < 1e-12);
    }
  });

  it("keteraturan arahnya naik bersama bobot penyamaan arah", () => {
    const rendah = shoal(50, 0, 1, 0.4).polarisation;
    const tinggi = shoal(50, 2.5, 1, 0.4).polarisation;
    assert.ok(tinggi > rendah + 0.2, `${rendah} lalu ${tinggi}`);
    assert.ok(tinggi <= 1 + 1e-9);
  });

  it("bobot menjauh yang besar merenggangkan jarak tetangga terdekatnya", () => {
    const rapat = shoal(50, 1, 0.2, 0.6).nearestNeighbour;
    const renggang = shoal(50, 1, 3, 0.6).nearestNeighbour;
    assert.ok(renggang > rapat, `${rapat} lalu ${renggang}`);
  });

  it("seluruh ukurannya berada di dalam batas yang mungkin", () => {
    for (const a of [0, 1, 2.5])
      for (const s of [0.2, 1, 3])
        for (const c of [0, 0.5, 1.5]) {
          const r = shoal(40, a, s, c);
          assert.ok(r.polarisation >= 0 && r.polarisation <= 1 + 1e-9);
          assert.ok(r.milling >= 0 && r.milling <= 1 + 1e-9);
          assert.ok(Number.isFinite(r.spread) && r.spread >= 0);
          for (const ag of r.agents)
            assert.ok(Number.isFinite(ag.x) && Number.isFinite(ag.y));
        }
  });
});

describe("Habitat sungai", () => {
  it("luas habitat layak memuncak pada debit menengah, lalu menurun", () => {
    /* Air yang lebih banyak bukan habitat yang lebih banyak. */
    const r = riverHabitat(5, 20, 0.002, 0.035);
    assert.ok(r.bestDischarge > 0);
    assert.ok(r.bestUsableArea > 0);
    /* Puncak lengkungnya sendiri, bukan pencocokan sama persis terhadap
       puncak yang dicari pada kisi debit yang lain. */
    let puncak = 0;
    r.curve.forEach((p, i) => {
      if (p.usable > r.curve[puncak].usable) puncak = i;
    });
    assert.ok(puncak > 0, "puncaknya tidak boleh di debit terkecil");
    assert.ok(
      puncak < r.curve.length - 1,
      "puncaknya tidak boleh di debit terbesar"
    );
    assert.ok(
      r.curve[r.curve.length - 1].usable < r.curve[puncak].usable,
      "sesudah puncaknya harus menurun"
    );
  });

  it("debit yang lebih besar memberi kedalaman yang lebih besar", () => {
    let sebelum = 0;
    for (const Q of [0.5, 2, 5, 20, 60]) {
      const r = riverHabitat(Q, 20, 0.002, 0.035);
      assert.ok(r.maxDepth > sebelum, `Q ${Q}`);
      sebelum = r.maxDepth;
    }
  });

  it("kelayakan tiap pias adalah hasil kali kedua kelayakannya", () => {
    const r = riverHabitat(5, 20, 0.002, 0.035);
    for (const c of r.cells)
      assert.ok(
        Math.abs(c.combined - c.depthIndex * c.velocityIndex) < 1e-12
      );
  });

  it("luas layak tidak pernah melampaui lebar basahnya", () => {
    for (const Q of [0.2, 5, 50])
      for (const W of [5, 20, 80]) {
        const r = riverHabitat(Q, W, 0.002, 0.035);
        assert.ok(r.usableArea <= r.wettedWidth + 1e-9);
        assert.ok(r.usableFraction >= 0 && r.usableFraction <= 1 + 1e-9);
      }
  });

  it("menandai keadaan yang menambah debit justru mengurangi habitatnya", () => {
    const r = riverHabitat(5, 20, 0.002, 0.035);
    const kecil = riverHabitat(r.bestDischarge * 0.5, 20, 0.002, 0.035);
    const besar = riverHabitat(r.bestDischarge * 2.5, 20, 0.002, 0.035);
    assert.equal(kecil.pastPeak, false);
    assert.equal(besar.pastPeak, true);
  });
});

/* ================================================================== *
 * FP-01 sampai FP-05
 * ================================================================== */

describe("Deret vorteks Karman", () => {
  it("bilangan Strouhal bertahan di sekitar nol koma dua di seluruh rentangnya", () => {
    for (const Re of [400, 4000, 40000, 150000]) {
      const U = 1;
      const nu = 1e-6;
      const d = (Re * nu) / U;
      const r = vortexStreet(U, d, nu);
      assert.ok(
        r.strouhal > 0.2 && r.strouhal < 0.215,
        `Re ${Re} memberi St ${r.strouhal}`
      );
    }
  });

  it("nisbah jarak kedua barisnya tetap, berapa pun keadaannya", () => {
    for (const U of [0.5, 5, 30])
      for (const d of [0.001, 0.05, 0.5]) {
        const r = vortexStreet(U, d, 1.5e-5);
        if (r.spacing <= 0) continue;
        assert.ok(
          Math.abs(r.rowGap / r.spacing - KARMAN_SPACING) < 1e-12,
          `U ${U} d ${d}`
        );
      }
  });

  it("nada siulnya berbanding lurus dengan kecepatan dan kebalikan garis tengahnya", () => {
    const a = vortexStreet(10, 0.001, 1.5e-5);
    const b = vortexStreet(20, 0.001, 1.5e-5);
    const c = vortexStreet(10, 0.002, 1.5e-5);
    /* Bukan tepat dua kali, karena bilangan Strouhal masih merayap sedikit
       bersama Reynolds pada rentang ini. Selisihnya di bawah dua persen. */
    assert.ok(Math.abs(b.frequency / a.frequency - 2) < 0.04);
    assert.ok(Math.abs(c.frequency / a.frequency - 0.5) < 0.02);
    /* Kawat satu milimeter di dalam angin sepuluh meter per detik */
    assert.ok(a.frequency > 1500 && a.frequency < 2200, `${a.frequency} Hz`);
  });

  it("tidak ada pusaran yang terlepas di bawah Reynolds empat puluh tujuh", () => {
    const r = vortexStreet(0.001, 0.01, 1e-6);
    assert.ok(r.reynolds < 47);
    assert.equal(r.shedding, false);
    assert.equal(r.frequency, 0);
  });

  it("menandai penguncian ketika kekerapan lepasnya mendekati getar alaminya", () => {
    const r = vortexStreet(10, 0.001, 1.5e-5);
    assert.equal(vortexStreet(10, 0.001, 1.5e-5, r.frequency).lockIn, true);
    assert.equal(vortexStreet(10, 0.001, 1.5e-5, r.frequency * 3).lockIn, false);
  });
});

describe("Kinematika vorteks", () => {
  it("pasangan berlawanan arah melaju lurus dengan jarak yang tetap", () => {
    for (const G0 of [5, 10, 40])
      for (const d of [1, 2, 5]) {
        const r = vortexPair(G0, -G0, d, 20);
        assert.equal(r.counterRotating, true);
        assert.ok(
          Math.abs(r.translation - G0 / (2 * Math.PI * d)) < 1e-12,
          `G ${G0} d ${d}`
        );
        assert.ok(
          r.separationDrift < 1e-4,
          `jaraknya berubah ${r.separationDrift}`
        );
      }
  });

  it("pasangan searah saling mengelilingi dengan perioda bentuk tertutupnya", () => {
    for (const G0 of [5, 20])
      for (const d of [1, 3]) {
        const r = vortexPair(G0, G0, d, 5);
        assert.equal(r.counterRotating, false);
        const acuan = (4 * Math.PI * Math.PI * d * d) / (2 * G0);
        assert.ok(Math.abs(r.period - acuan) < 1e-9);
        assert.ok(r.separationDrift < 1e-3);
      }
  });

  it("satu pusaran sendirian tidak pernah memindahkan dirinya", () => {
    const r = vortexPair(10, 0, 2, 20);
    for (const p of r.pathA) {
      assert.ok(Math.abs(p.x - r.pathA[0].x) < 1e-12);
      assert.ok(Math.abs(p.y - r.pathA[0].y) < 1e-12);
    }
    /* Sedangkan yang satunya tetap dibawa oleh pusaran pertama */
    assert.ok(Math.hypot(r.pathB[r.pathB.length - 1].x - r.pathB[0].x, r.pathB[r.pathB.length - 1].y - r.pathB[0].y) > 0.1);
  });
});

describe("Gelombang linear", () => {
  it("memenuhi hubungan sebarannya di seluruh rentang kedalamannya", () => {
    for (const T of [2, 8, 20, 1000])
      for (const h of [1, 10, 200, 4000]) {
        const r = linearWave(T, h);
        const sigma = (2 * Math.PI) / T;
        const kiri = sigma * sigma;
        const kanan = G * r.k * Math.tanh(r.k * h);
        assert.ok(
          Math.abs(kiri - kanan) / kiri < 1e-6,
          `T ${T} h ${h}: ${kiri} lawan ${kanan}`
        );
      }
  });

  it("air dangkal tidak menyebar: kecepatannya akar g h saja", () => {
    const r = linearWave(1000, 3000);
    assert.equal(r.regime, "dangkal");
    assert.ok(
      Math.abs(r.celerity / r.shallowCelerity - 1) < 0.01,
      `${r.celerity} lawan ${r.shallowCelerity}`
    );
    assert.ok(r.groupRatio > 0.99, "tenaganya merambat secepat puncaknya");
  });

  it("air dalam menyebar: kecepatannya hanya bergantung pada periodanya", () => {
    const r = linearWave(10, 2000);
    assert.equal(r.regime, "dalam");
    assert.ok(Math.abs(r.celerity / r.deepCelerity - 1) < 0.001);
    assert.ok(
      Math.abs(r.groupRatio - 0.5) < 0.001,
      "tenaganya merambat setengah kecepatan puncaknya"
    );
  });

  it("tenaga tidak pernah merambat lebih cepat daripada puncaknya", () => {
    for (const T of [2, 6, 15, 60])
      for (const h of [0.5, 5, 50, 500]) {
        const r = linearWave(T, h);
        assert.ok(
          r.groupRatio >= 0.5 - 1e-9 && r.groupRatio <= 1 + 1e-9,
          `T ${T} h ${h} memberi ${r.groupRatio}`
        );
      }
  });

  it("gelombang pendek tidak merasakan dasar sama sekali", () => {
    const r = linearWave(3, 100);
    assert.equal(r.feelsBottom, false);
    assert.ok(r.bottomOrbit < 1e-3, `lintasan di dasarnya ${r.bottomOrbit}`);
  });
});

describe("Adveksi dan difusi", () => {
  it("massanya kekal di seluruh sebarannya", () => {
    const M = 50;
    const A = 12;
    const r = advectionDiffusion(M, A, 0.4, 5, 800, [600]);
    const p = r.snapshots[0].profile;
    let luas = 0;
    for (let i = 1; i < p.length; i++)
      luas += ((p[i - 1].c + p[i].c) / 2) * (p[i].x - p[i - 1].x);
    assert.ok(
      Math.abs((luas * A) / M - 1) < 0.02,
      `massanya menjadi ${(luas * A) / M} kali`
    );
  });

  it("pusatnya bergerak menurut waktu, lebarnya hanya menurut akar waktu", () => {
    const a = advectionDiffusion(50, 12, 0.4, 5, 800, [400]);
    const b = advectionDiffusion(50, 12, 0.4, 5, 800, [1600]);
    assert.ok(Math.abs(b.centre / a.centre - 4) < 1e-9, "pusatnya empat kali");
    assert.ok(Math.abs(b.sigma / a.sigma - 2) < 1e-9, "lebarnya dua kali");
  });

  it("kepekatan puncaknya turun menurut akar waktu, bukan menurut waktu", () => {
    const a = advectionDiffusion(50, 12, 0.4, 5, 800, [400]);
    const b = advectionDiffusion(50, 12, 0.4, 5, 800, [1600]);
    assert.ok(Math.abs(a.peak / b.peak - 2) < 1e-9);
  });

  it("awan yang hanyut makin jauh makin sempit terhadap jarak tempuhnya", () => {
    let sebelum = Infinity;
    for (const t of [200, 800, 3200, 12800]) {
      const r = advectionDiffusion(50, 12, 0.4, 5, 800, [t]);
      assert.ok(r.spreadRatio < sebelum, `pada ${t} detik`);
      sebelum = r.spreadRatio;
    }
  });

  it("menandai keadaan yang adveksinya menguasai", () => {
    assert.equal(advectionDiffusion(50, 12, 0.4, 5, 2000).advectionDominated, true);
    assert.equal(advectionDiffusion(50, 12, 0.01, 50, 20).advectionDominated, false);
  });
});

describe("Lapisan batas Falkner-Skan", () => {
  it("memulangkan nilai terbitan Schlichting di seluruh tabelnya", () => {
    /*
     * Empat angka yang seluruhnya berasal dari luar kode ini. Kalau
     * penembakannya salah arah, tidak satu pun dari keempatnya cocok.
     */
    const acuan: [number, number][] = [
      [1, 1.2326],
      [0.5, 0.9277],
      [0, 0.4696],
      [-0.1, 0.3192],
    ];
    for (const [beta, fpp] of acuan) {
      const r = falknerSkan(beta);
      assert.ok(
        Math.abs(r.wallSlope - fpp) < 0.002,
        `beta ${beta}: ${r.wallSlope} lawan ${fpp}`
      );
    }
  });

  it("faktor bentuk Blasius dua koma lima sembilan", () => {
    const r = falknerSkan(0);
    assert.ok(Math.abs(r.shapeFactor - 2.59) < 0.01, `${r.shapeFactor}`);
  });

  it("pemisahan terjadi tepat pada beta terbitan, dan nilainya tidak bergantung apa pun", () => {
    const pas = falknerSkan(FALKNER_SKAN_SEPARATION);
    assert.ok(pas.wallSlope < 0.005, `kemiringan dindingnya ${pas.wallSlope}`);
    assert.equal(pas.separated, true);
    assert.equal(falknerSkan(FALKNER_SKAN_SEPARATION + 0.02).separated, false);
  });

  it("gradien yang membantu tidak pernah memisahkan lapisan batasnya", () => {
    for (const beta of [0.05, 0.3, 1, 1.6]) {
      const r = falknerSkan(beta);
      assert.equal(r.separated, false, `beta ${beta}`);
      assert.equal(r.favourable, true);
      assert.ok(r.wallSlope > 0.4, `beta ${beta} memberi ${r.wallSlope}`);
    }
  });

  it("kemiringan dinding naik monoton bersama beta", () => {
    let sebelum = -1;
    for (const beta of [-0.19, -0.15, -0.1, 0, 0.5, 1, 1.5]) {
      const r = falknerSkan(beta);
      assert.ok(r.wallSlope > sebelum, `beta ${beta}`);
      sebelum = r.wallSlope;
    }
  });

  it("faktor bentuknya naik ketika gradiennya makin melawan", () => {
    /* Faktor bentuk itulah penanda pemisahan yang dipakai di lapangan:
       ia menjauh dari dua koma enam menuju empat menjelang lepasnya. */
    const bantu = falknerSkan(1).shapeFactor;
    const datar = falknerSkan(0).shapeFactor;
    const lawan = falknerSkan(-0.18).shapeFactor;
    assert.ok(bantu < datar && datar < lawan);
    assert.ok(lawan > 3.2, `menjelang lepas faktornya ${lawan}`);
  });
});
