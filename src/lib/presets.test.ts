import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  FALKNER_SKAN_SEPARATION,
  acceleration,
  advectionDiffusion,
  curvaturePressure,
  deformation,
  ductEnergy,
  falknerSkan,
  linearWave,
  meanderPath,
  momentumForce,
  reynoldsExperiment,
  riverHabitat,
  shoal,
  vortexPair,
  vortexStreet,
  type DuctStation,
} from "./hydraulics.ts";

/**
 * Tombol kondisi contoh harus MENEPATI NAMANYA.
 *
 * Uji ini lahir dari FF-01: tombol bernama "leher terlalu tinggi, air
 * mendidih" memasang leher setinggi dua puluh lima meter, yang masih
 * menyisakan tekanan mutlak tiga setengah meter, sehingga lembarnya sendiri
 * menjawab "tekanan di mana-mana masih di atas tekanan uap". Tidak ada uji
 * yang menangkapnya karena setiap angkanya benar; yang salah hanya janji
 * pada nama tombolnya.
 *
 * Nilai-nilai di bawah disalin dari tombol di lembarnya masing-masing.
 * Kalau tombolnya diubah, uji ini ikut diubah, dan justru itu gunanya:
 * mengubah tombol memaksa orang memeriksa lagi apakah namanya masih benar.
 */

/* FF-01, saluran bernoulli seperti yang dibangun lembarnya */
function bernoulli(Q: number, H: number, D1: number, D2: number, dz: number) {
  const L = 60;
  return ductEnergy(
    Q,
    [
      { x: 0, z: 0, D: D1 },
      { x: L * 0.3, z: dz * 0.6, D: (D1 + D2) / 2 },
      { x: L * 0.5, z: dz, D: D2 },
      { x: L * 0.7, z: dz * 0.6, D: (D1 + D2) / 2 },
      { x: L, z: 0, D: D1 },
    ],
    H,
    0
  );
}

/* PI-07, pipa tekan berpompa seperti yang dibangun lembarnya */
function pipaTekan(Q: number, D: number, L: number, zp: number, z2: number, f: number) {
  const lintasan = (pompa: number): DuctStation[] => [
    { x: 0, z: 0, D, K: 0.5, pump: pompa },
    { x: L * 0.25, z: zp * 0.55, D },
    { x: L * 0.5, z: zp, D, K: 0.2 },
    { x: L * 0.75, z: zp + (z2 - zp) * 0.55, D },
    { x: L, z: z2, D },
  ];
  const tanpa = ductEnergy(Q, lintasan(0), 0, f);
  const Hp = Math.max(0, z2 - tanpa.points[tanpa.points.length - 1].hgl);
  return ductEnergy(Q, lintasan(Hp), 0, f);
}

describe("Tombol kondisi contoh pekan keempat menepati namanya", () => {
  it("FF-01 leher terlalu tinggi, air mendidih", () => {
    assert.ok(bernoulli(0.15, 20, 0.4, 0.13, 25).cavitates);
  });

  it("FF-01 pipa datar, leher menyempit: tidak mendidih, tidak menghisap", () => {
    const r = bernoulli(0.15, 20, 0.4, 0.18, 0);
    assert.ok(!r.cavitates && !r.subAtmospheric);
  });

  it("PI-07 puncak tinggi, pipa menghisap: menghisap tetapi belum mendidih", () => {
    const r = pipaTekan(0.06, 0.2, 900, 26, 14, 0.022);
    assert.ok(r.points[2].pressureHead < 0, "puncaknya belum menghisap");
    assert.ok(!r.cavitates, "puncaknya sudah mendidih, bukan sekadar menghisap");
  });

  it("PI-07 puncak terlalu tinggi, air mendidih", () => {
    assert.ok(pipaTekan(0.06, 0.2, 900, 40, 14, 0.022).cavitates);
  });

  it("FF-04 mercu terlalu tajam, air terangkat", () => {
    assert.ok(curvaturePressure(6, 0.8, 0.8).liftsOff);
  });

  it("FF-06 keempat tombolnya", () => {
    assert.ok(deformation(0, -1, 1, 0, 0.5).pureRotation, "putaran murni");
    assert.ok(deformation(1, 0, 0, -1, 0.5).pureStrain, "regangan murni");
    assert.ok(!deformation(1, 0, 0, 1, 0.5).incompressible, "memuai");
  });

  it("FF-07 ketiga tombolnya", () => {
    const tunak = acceleration(0.1, 0, 1, 0.2, 0.06, 0.5, 0.25, 0.4);
    assert.ok(tunak.steady && tunak.local === 0, "debit tetap");
    const ayun = acceleration(0.05, 0.8, 6, 0.2, 0.19, 0.5, 0.25, 0.4);
    assert.ok(Math.abs(ayun.local) > Math.abs(ayun.convective) * 3, "berayun, saluran hampir lurus");
    /* Dulu tombol ini memberi suku lokal 3,5 dari 314,5 m/s²: yang bekerja
       hanya satu, suku lainnya tidak terlihat di gambar. */
    const dua = acceleration(0.02, 0.5, 6, 0.2, 0.17, 0.5, 0.25, 0.2);
    const nisbah = Math.abs(dua.local / dua.convective);
    assert.ok(nisbah > 0.5 && nisbah < 2, `nisbah lokal/konvektif ${nisbah}`);
  });

  it("PI-04 keempat rezimnya", () => {
    assert.equal(reynoldsExperiment(0.00003, 0.05, 15, 0.4).regime, "laminar");
    assert.equal(reynoldsExperiment(0.0006, 0.05, 15, 0.4).regime, "peralihan");
    assert.equal(reynoldsExperiment(0.002, 0.05, 15, 0.4).regime, "turbulen");
    assert.ok(reynoldsExperiment(0.0005, 0.05, 15, 1).quietLaminar, "percobaan Reynolds sendiri");
  });

  it("PI-05 tanah lembek: bloknya jauh lebih lebar daripada tanah biasa", () => {
    /* Tombol ini hanya menjanjikan tanah yang lembek, dan memang memberi
       blok yang hampir dua kali lebih lebar. Yang dulu salah harapan di
       panduan uji, yang menuntut blok tunggal terlalu besar untuk dibuat. */
    const R = momentumForce(0.4, 0.4, 0.4, 90, 90).resultant;
    const lebar = (q: number) => R / 1000 / q / 1.2;
    assert.ok(lebar(35) > lebar(150) * 1.8);
  });

  it("PI-06 penyempitan mendadak: tekanannya turun", () => {
    assert.ok(!momentumForce(0.25, 0.45, 0.25, 30, 0).pressureRises);
  });

  it("OC-11 kelokan matang dan leher yang terpotong", () => {
    assert.ok(meanderPath(30, 330, 40).fastestMigration, "matang");
    assert.ok(meanderPath(30, 330, 130).cutoff, "leher");
  });

  it("EH-05 keempat bentuk gerombolan", () => {
    assert.equal(shoal(40, 0, 0.4, 0).state, "berpencar");
    assert.equal(shoal(40, 0, 1, 1).state, "bergerombol");
    assert.equal(shoal(40, 2.5, 1, 0.6).state, "searah");
    assert.equal(shoal(30, 0.02, 1, 0.2).state, "berputar");
  });

  it("EH-06 debit rendah, di puncak, dan banjir", () => {
    assert.ok(!riverHabitat(0.3, 20, 0.002, 0.035).pastPeak, "debit rendah");
    assert.ok(riverHabitat(90, 20, 0.002, 0.035).pastPeak, "banjir");
    const p = riverHabitat(2.1, 20, 0.002, 0.035);
    assert.ok(p.usableArea >= p.bestUsableArea * 0.9, "di puncak");
  });

  it("FP-01 kekerapan terkunci", () => {
    assert.ok(vortexStreet(12, 1.2, 1.5e-5, 2.7).lockIn);
  });

  it("FP-02 pasangan searah", () => {
    assert.ok(!vortexPair(10, 10, 2).counterRotating);
  });

  it("FP-03 gelombang pantai, laut lepas, dan alun", () => {
    assert.equal(linearWave(8, 1.2, 1).regime, "dangkal", "gelombang pantai");
    assert.equal(linearWave(8, 200, 2).regime, "dalam", "laut lepas");
    assert.ok(linearWave(20, 40, 1.5).feelsBottom, "alun yang merasakan dasar");
  });

  it("FP-04 ketiga tombolnya", () => {
    assert.ok(advectionDiffusion(50, 12, 1.5, 2, 800).advectionDominated, "arus kuat");
    const sebar = advectionDiffusion(50, 12, 0.05, 80, 800);
    assert.ok(!sebar.advectionDominated && !sebar.balanced, "penyebaran kuat");
    /* Dulu U 0,4 dan D 5: Pe 64, dan lembarnya menjawab adveksi berkuasa. */
    assert.ok(advectionDiffusion(50, 12, 0.05, 5, 800).balanced, "arus lambat, seimbang");
  });

  it("FP-05 tepat pada ambang terlepasnya", () => {
    assert.ok(falknerSkan(FALKNER_SKAN_SEPARATION).separated);
  });
});
