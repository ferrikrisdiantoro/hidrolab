import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CONCRETE_UNIT_WEIGHT,
  FILTER_DRAIN,
  FILTER_RETAIN,
  G,
  PORE_RE_DARCY,
  SLEEP_TAU_FALL,
  SLEEP_TAU_RISE,
  WATER_UNIT_WEIGHT,
  aquiferResponse,
  criticalGradient,
  filterDesign,
  gradation,
  gravityDam,
  passingAt,
  polygonProps,
  pumpingWell,
  rockfillFlow,
  rockfillGradient,
  seepageLine,
  sizeAt,
  sleepFall,
  sleepRegulation,
  sleepRise,
  sleepTimeTo,
  wakeTimeTo,
  wellDrawdownAt,
  fishPassage,
} from "./hydraulics.ts";

/* ================================================================== *
 * GW-01  Rembesan
 * ================================================================== */

describe("Parabola Kozeny pada bendungan urugan", () => {
  it("melewati titik masuk terkoreksi dengan tepat", () => {
    for (const H of [2, 6, 11])
      for (const mUp of [2, 3, 4])
        for (const Ld of [3, 10, 25]) {
          const r = seepageLine(H, 12, 6, mUp, 2.5, Ld, 1e-6, 1e-6);
          /* z kuadrat harus sama dengan y0 kuadrat ditambah 2 y0 d */
          const z2 = r.y0 * r.y0 + 2 * r.y0 * r.d;
          assert.ok(
            Math.abs(Math.sqrt(z2) - H) < 1e-9,
            `H ${H} memberi ${Math.sqrt(z2)}`
          );
        }
  });

  it("rembesannya persis permeabilitas setara dikali y0", () => {
    const r = seepageLine(8, 12, 6, 3, 2.5, 10, 4e-6, 1e-6);
    assert.ok(Math.abs(r.q - r.kEq * r.y0) < 1e-18);
    assert.ok(Math.abs(r.kEq - Math.sqrt(4e-6 * 1e-6)) < 1e-18);
  });

  it("bertemu Dupuit ketika bendungannya jauh lebih lebar daripada tinggi airnya", () => {
    /* Untuk d jauh lebih besar daripada H, y0 mendekati H kuadrat per 2d,
       yaitu rumus Dupuit untuk aliran antara dua muka air. */
    const r = seepageLine(1.5, 40, 8, 3, 3, 20, 1e-6, 1e-6);
    const selisih = Math.abs(r.q - r.qDupuit) / r.qDupuit;
    assert.ok(selisih < 0.02, `selisih ${(selisih * 100).toFixed(2)} persen`);
  });

  it("drainase yang lebih panjang justru menaikkan rembesannya", () => {
    /* Berlawanan naluri: drainase memperpendek lintasan rembesan, jadi
       gradiennya naik. Yang dibeli dengan drainase bukan rembesan yang
       lebih sedikit melainkan garis freatik yang tidak keluar di lereng. */
    let naik = 0;
    for (let Ld = 2; Ld < 28; Ld += 1) {
      const a = seepageLine(8, 12, 6, 3, 2.5, Ld, 1e-6, 1e-6);
      const b = seepageLine(8, 12, 6, 3, 2.5, Ld + 1, 1e-6, 1e-6);
      if (b.q > a.q) naik++;
    }
    assert.equal(naik, 26);
  });

  it("garis freatik keluar di lereng hilir bila drainasenya terlalu pendek", () => {
    assert.equal(seepageLine(8, 12, 6, 3, 2.5, 0, 1e-6, 1e-6).daylights, true);
    assert.equal(seepageLine(8, 12, 6, 3, 2.5, 25, 1e-6, 1e-6).daylights, false);
  });

  it("panjang drainase yang dituntut adalah batas antara keluar dan tidak", () => {
    for (const H of [4, 8, 11]) {
      const r = seepageLine(H, 12, 6, 3, 2.5, 10, 1e-6, 1e-6);
      const kurang = seepageLine(H, 12, 6, 3, 2.5, r.drainNeeded * 0.9, 1e-6, 1e-6);
      const lebih = seepageLine(H, 12, 6, 3, 2.5, r.drainNeeded * 1.1, 1e-6, 1e-6);
      assert.equal(kurang.daylights, true, `H ${H} kurang`);
      assert.equal(lebih.daylights, false, `H ${H} lebih`);
    }
  });

  it("tanah yang mendatarnya lebih lolos merembeskan lebih banyak pada k ukur yang sama", () => {
    /* Permeabilitas rata-rata ukurnya dijaga tetap, hanya perbandingan
       mendatar terhadap tegaknya yang diubah. */
    const kEq = 1e-6;
    let sebelum = 0;
    for (const nisbah of [1, 4, 9, 16, 25]) {
      const kh = kEq * Math.sqrt(nisbah);
      const kv = kEq / Math.sqrt(nisbah);
      const r = seepageLine(8, 12, 6, 3, 2.5, 10, kh, kv);
      assert.ok(Math.abs(r.kEq - kEq) / kEq < 1e-12);
      assert.ok(r.q > sebelum, `nisbah ${nisbah}`);
      sebelum = r.q;
    }
  });

  it("gradien kritis untuk butiran baku mendekati satu", () => {
    assert.ok(Math.abs(criticalGradient(2.65, 0.7) - 0.9706) < 0.001);
  });
});

/* ================================================================== *
 * GW-02  Pemompaan air tanah
 * ================================================================== */

describe("Kerucut penurunan Thiem", () => {
  it("separuh penurunan selesai pada rata-rata ukur jari-jarinya", () => {
    /* Sifat logaritma, dan berlaku tepat untuk akuifer tertekan. */
    for (const rw of [0.1, 0.3])
      for (const R of [100, 500, 2000]) {
        const r = pumpingWell(0.02, 1e-4, 20, rw, R, true);
        assert.ok(Math.abs(r.halfRadius - Math.sqrt(rw * R)) < 1e-9);
        const s = wellDrawdownAt(r.halfRadius, 0.02, 1e-4, 20, rw, R, true);
        assert.ok(Math.abs(s - r.sAquifer / 2) < 1e-12);
      }
  });

  it("memulangkan debit yang dipakai menghitungnya", () => {
    for (const confined of [true, false])
      for (const Q of [0.005, 0.01, 0.02]) {
        const r = pumpingWell(Q, 1e-4, 25, 0.15, 400, confined);
        /* Di luar debit terbesarnya sumurnya kering dan tidak ada yang
           dapat dipulangkan; keadaan itu diuji tersendiri di bawah. */
        assert.equal(r.dry, false, `${confined} ${Q} sudah kering`);
        const balik = confined
          ? (r.sAquifer * 2 * Math.PI * r.T) / Math.log(400 / 0.15)
          : (Math.PI * 1e-4 * (25 * 25 - r.hWell * r.hWell)) /
            Math.log(400 / 0.15);
        assert.ok(
          Math.abs(balik - Q) / Q < 1e-9,
          `${confined} ${Q} memberi ${balik}`
        );
      }
  });

  it("akuifer bebas bertemu rumus tertekan ketika penurunannya kecil", () => {
    const r = pumpingWell(0.001, 1e-4, 40, 0.15, 400, false);
    assert.ok(r.sAquifer / 40 < 0.01);
    assert.ok(
      Math.abs(r.unconfinedRatio - 1) < 0.01,
      `nisbah ${r.unconfinedRatio}`
    );
  });

  it("penurunan akuifer bebas tumbuh lebih cepat daripada berbanding lurus", () => {
    const a = pumpingWell(0.01, 1e-4, 25, 0.15, 400, false);
    const b = pumpingWell(0.02, 1e-4, 25, 0.15, 400, false);
    assert.ok(b.sAquifer > 2 * a.sAquifer);
    /* Sedangkan pada akuifer tertekan tepat dua kali */
    const c = pumpingWell(0.01, 1e-4, 25, 0.15, 400, true);
    const d = pumpingWell(0.02, 1e-4, 25, 0.15, 400, true);
    assert.ok(Math.abs(d.sAquifer / c.sAquifer - 2) < 1e-12);
  });

  it("debit terbesar adalah debit yang mengeringkan sumurnya", () => {
    const r = pumpingWell(0.01, 1e-4, 25, 0.15, 400, false);
    const pas = pumpingWell(r.Qmax * 0.999, 1e-4, 25, 0.15, 400, false);
    assert.ok(pas.hWell / 25 < 0.05, `sisa ${pas.hWell}`);
    assert.equal(pumpingWell(r.Qmax * 1.001, 1e-4, 25, 0.15, 400, false).dry, true);
    assert.equal(r.dry, false);
  });

  it("jari-jari pengaruh berada di dalam logaritma, jadi taksirannya tidak menentukan", () => {
    const a = pumpingWell(0.02, 1e-4, 20, 0.15, 250, true);
    const b = pumpingWell(0.02, 1e-4, 20, 0.15, 1000, true);
    const naik = b.sAquifer / a.sAquifer - 1;
    const ramalan = Math.log(4) / Math.log(250 / 0.15);
    assert.ok(Math.abs(naik - ramalan) < 1e-9, `naik ${naik} ramalan ${ramalan}`);
    assert.ok(naik < 0.2);
  });

  it("kapasitas jenis turun ketika debitnya dinaikkan, bila sumurnya rugi", () => {
    const a = pumpingWell(0.01, 1e-4, 25, 0.15, 400, true, 2000);
    const b = pumpingWell(0.03, 1e-4, 25, 0.15, 400, true, 2000);
    assert.ok(b.specificCapacity < a.specificCapacity);
    /* Tanpa kehilangan sumur, kapasitas jenisnya tetap */
    const c = pumpingWell(0.01, 1e-4, 25, 0.15, 400, true, 0);
    const d = pumpingWell(0.03, 1e-4, 25, 0.15, 400, true, 0);
    assert.ok(Math.abs(d.specificCapacity / c.specificCapacity - 1) < 1e-12);
  });
});

/* ================================================================== *
 * GW-03  Tanggapan air tanah
 * ================================================================== */

describe("Akuifer sebagai satu tampungan lurus", () => {
  it("hitungan langkah demi langkah memulangkan simpangan bentuk tertutupnya", () => {
    for (const Sy of [0.05, 0.15, 0.3])
      for (const alpha of [0.002, 0.01, 0.05]) {
        const r = aquiferResponse(1.5, 1.2, 0, Sy, alpha);
        const selisih = Math.abs(r.amplitudeSim - r.amplitude) / r.amplitude;
        assert.ok(
          selisih < 0.01,
          `Sy ${Sy} alfa ${alpha} selisih ${(selisih * 100).toFixed(2)} persen`
        );
      }
  });

  it("dan memulangkan tundaannya juga", () => {
    for (const Sy of [0.05, 0.2])
      for (const alpha of [0.003, 0.02, 0.08]) {
        const r = aquiferResponse(1.5, 1.2, 0, Sy, alpha);
        assert.ok(
          Math.abs(r.lagSim - r.lag) < 1,
          `Sy ${Sy} alfa ${alpha}: ${r.lagSim} lawan ${r.lag}`
        );
      }
  });

  it("tundaannya tidak pernah mencapai seperempat musim", () => {
    for (const tau of [1, 10, 100, 1000, 100000]) {
      const Sy = 0.2;
      const r = aquiferResponse(1.5, 1.2, 0, Sy, Sy / tau);
      assert.ok(r.lag < 365 / 4, `tau ${tau} memberi ${r.lag}`);
      assert.ok(r.lagFraction < 0.25);
    }
    /* Dan mendekatinya untuk akuifer yang sangat lambat */
    const lambat = aquiferResponse(1.5, 1.2, 0, 0.2, 0.2 / 1e6);
    assert.ok(lambat.lagFraction > 0.2499);
  });

  it("muka air rata-rata adalah imbuhan bersih dibagi tetapan resesinya", () => {
    const r = aquiferResponse(2, 1, 0.5, 0.15, 0.01);
    assert.ok(Math.abs(r.meanHead - (2 - 0.5) / 1000 / 0.01) < 1e-12);
    /* Dan aliran dasarnya harus menutup neraca airnya */
    assert.ok(Math.abs(r.baseflow - (2 - 0.5)) < 1e-9);
  });

  it("akuifer yang lebih banyak menyimpan lebih meredam dan lebih terlambat", () => {
    let redam = 1;
    let tunda = 0;
    for (const Sy of [0.02, 0.05, 0.1, 0.2, 0.4]) {
      const r = aquiferResponse(1.5, 1.2, 0, Sy, 0.01);
      assert.ok(r.damping < redam);
      assert.ok(r.lag > tunda);
      redam = r.damping;
      tunda = r.lag;
    }
  });

  it("pemompaan yang melampaui imbuhan mengeringkan akuifernya", () => {
    assert.equal(aquiferResponse(1.5, 1, 0.5, 0.15, 0.01).runsDry, false);
    assert.equal(aquiferResponse(1.5, 1, 1.6, 0.15, 0.01).runsDry, true);
  });
});

/* ================================================================== *
 * DM-01  Stabilitas bendungan
 * ================================================================== */

describe("Bantu poligon", () => {
  it("memberi luas dan titik berat segitiga yang benar", () => {
    const p = polygonProps([
      { x: 0, z: 0 },
      { x: 3, z: 0 },
      { x: 0, z: 6 },
    ]);
    assert.ok(Math.abs(p.area - 9) < 1e-12);
    assert.ok(Math.abs(p.cx - 1) < 1e-12);
    assert.ok(Math.abs(p.cz - 2) < 1e-12);
  });

  it("tidak peduli arah putaran sudutnya", () => {
    const a = polygonProps([
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 4, z: 2 },
      { x: 0, z: 2 },
    ]);
    const b = polygonProps([
      { x: 0, z: 2 },
      { x: 4, z: 2 },
      { x: 4, z: 0 },
      { x: 0, z: 0 },
    ]);
    assert.ok(Math.abs(a.area - b.area) < 1e-12);
    assert.ok(Math.abs(a.cx - b.cx) < 1e-12);
  });
});

describe("Bendungan beton gravitasi", () => {
  const S = CONCRETE_UNIT_WEIGHT / WATER_UNIT_WEIGHT;

  it("memulangkan profil dasar yang terbit di buku teks, tanpa tekanan angkat", () => {
    /* Penampang segitiga, air penuh, tanpa angkat: B = H per akar S */
    for (const H of [10, 30, 60]) {
      const r = gravityDam(H, 0.001, 10, H, 0, 0.7, 0, 1, 0.1, false);
      const acuan = H / Math.sqrt(S);
      assert.ok(
        Math.abs(r.baseNoTension - acuan) / acuan < 0.002,
        `H ${H}: ${r.baseNoTension} lawan ${acuan}`
      );
    }
  });

  it("dan yang berlaku bila tekanan angkatnya penuh, B = H per akar (S − 1)", () => {
    for (const H of [10, 30, 60]) {
      const r = gravityDam(H, 0.001, 10, H, 0, 0.7, 0, 1, 0.1, true);
      const acuan = H / Math.sqrt(S - 1);
      assert.ok(
        Math.abs(r.baseNoTension - acuan) / acuan < 0.002,
        `H ${H}: ${r.baseNoTension} lawan ${acuan}`
      );
    }
  });

  it("faktor guling lebih dari satu tepat ketika resultannya jatuh di dalam dasar", () => {
    /*
     * Dua jalur yang sama sekali berbeda menuju pernyataan yang sama: nisbah
     * momen terhadap ujung kaki, dan letak resultan pada dasarnya. Keduanya
     * harus sepakat di SETIAP keadaan, bukan hanya di satu titik potong.
     */
    let diperiksa = 0;
    for (const B of [8, 14, 22, 30])
      for (const Ht of [0, 4])
        for (let H = 1; H <= 30; H += 0.25) {
          const r = gravityDam(30, 6, B, H, Math.min(Ht, H), 0.7, 0);
          if (r.sumV <= 0) continue;
          diperiksa++;
          assert.equal(
            r.fsOverturning > 1,
            r.resultantAt < B,
            `B ${B} Ht ${Ht} H ${H}: FS ${r.fsOverturning} resultan ${r.resultantAt}`
          );
        }
    assert.ok(diperiksa > 500, `hanya ${diperiksa} keadaan yang diperiksa`);
  });

  it("tumit tertarik tepat ketika simpangan resultan melampaui seperenam dasar", () => {
    for (let B = 6; B <= 30; B += 0.5) {
      const r = gravityDam(30, 6, B, 28, 0, 0.7, 0);
      if (!Number.isFinite(r.heelStress)) continue;
      assert.equal(
        r.tension,
        Math.abs(r.eccentricity) > B / 6,
        `B ${B}`
      );
      /* Dan tegangan tumit negatif adalah pernyataan yang sama persis */
      if (r.eccentricity > 0)
        assert.equal(r.heelStress < 0, r.eccentricity > B / 6, `B ${B} tegangan`);
    }
  });

  it("tekanan angkat menurunkan kedua faktor keamanannya", () => {
    const tanpa = gravityDam(40, 6, 30, 38, 3, 0.7, 100, 1, 0.1, false);
    const dengan = gravityDam(40, 6, 30, 38, 3, 0.7, 100, 1, 0.1, true);
    assert.ok(dengan.fsOverturning < tanpa.fsOverturning);
    assert.ok(dengan.fsSliding < tanpa.fsSliding);
  });

  it("tirisan yang bekerja menaikkan faktor geser tanpa menyentuh dorongan airnya", () => {
    const penuh = gravityDam(40, 6, 30, 38, 3, 0.7, 100, 1, 0.1);
    const tiris = gravityDam(40, 6, 30, 38, 3, 0.7, 100, 1 / 3, 0.1);
    assert.ok(tiris.fsSliding > penuh.fsSliding);
    assert.ok(Math.abs(tiris.sumH - penuh.sumH) < 1e-9);
    assert.ok(tiris.uplift < penuh.uplift);
  });

  it("momen resultannya pulang pergi lewat letak resultan", () => {
    for (const H of [10, 25, 38]) {
      const r = gravityDam(40, 6, 30, H, 2, 0.7, 100, 1 / 3, 0.1);
      const momen =
        r.weight * r.weightArm -
        r.uplift * r.upliftArm +
        (r.thrustUp * H) / 3 -
        (r.thrustDown * 2) / 3;
      assert.ok(Math.abs(r.sumV * r.resultantAt - momen) < 1e-6, `H ${H}`);
    }
  });

  it("jumlah tegangan dasarnya memulangkan gaya tegak seluruhnya", () => {
    const r = gravityDam(40, 6, 30, 38, 3, 0.7, 100, 1 / 3, 0.1);
    const luas = ((r.heelStress + r.toeStress) / 2) * 30;
    assert.ok(Math.abs(luas - r.sumV) / Math.abs(r.sumV) < 1e-12);
  });

  it("air hilir yang naik justru MENURUNKAN faktor geser pada dasar tanpa kohesi", () => {
    /*
     * Dugaan pertama keliru, dan ini salah satu hasil paling berguna pada
     * lembar ini. Air hilir memang mengurangi dorongan mendatar bersihnya,
     * tetapi ia juga menaikkan tekanan angkat di sepanjang dasar. Yang
     * hilang dari gaya tegak dikali koefisien gesek lebih besar daripada
     * yang dihemat dari dorongannya, jadi hasil bersihnya merugikan.
     */
    const a = gravityDam(40, 6, 26, 38, 2, 0.7, 0);
    const b = gravityDam(40, 6, 26, 38, 8, 0.7, 0);
    assert.ok(b.sumH < a.sumH, "dorongan bersihnya memang berkurang");
    assert.ok(b.uplift > a.uplift, "tetapi tekanan angkatnya bertambah");
    assert.ok(b.fsSliding < a.fsSliding, "dan hasil bersihnya merugikan");

    /*
     * Yang membalik arahnya bukan tirisan melainkan kohesi, karena kohesi
     * menambah perlawanan yang tidak bergantung pada gaya tegak sama sekali,
     * sehingga penghematan dorongan menjadi yang menentukan.
     */
    const c = gravityDam(40, 6, 26, 38, 2, 0.2, 100);
    const d = gravityDam(40, 6, 26, 38, 8, 0.2, 100);
    assert.ok(d.fsSliding > c.fsSliding, "dengan kohesi arahnya berbalik");
  });
});

/* ================================================================== *
 * DM-02  Filter bendungan
 * ================================================================== */

describe("Gradasi dan kriteria filter", () => {
  it("memulangkan keseragaman yang dipakai menyusunnya", () => {
    for (const cu of [1.5, 3, 8, 20]) {
      const g = gradation(0.5, cu);
      assert.ok(Math.abs(g.d60 / g.d10 - cu) / cu < 1e-12, `Cu ${cu}`);
    }
  });

  it("persen lolos pulang pergi lewat garis tengahnya", () => {
    const g = gradation(0.5, 6);
    for (const p of [10, 15, 50, 60, 85, 90]) {
      const d = sizeAt(g, p);
      assert.ok(
        Math.abs(passingAt(g, d) - p) < 0.5,
        `${p} persen memberi ${passingAt(g, d)}`
      );
    }
    assert.ok(Math.abs(passingAt(g, g.d15) - 15) < 0.01);
    assert.ok(Math.abs(passingAt(g, g.d85) - 85) < 0.01);
  });

  it("lebar jendela filter persis sama dengan rentang gradasi tanahnya", () => {
    /* Angka empat pada kedua syaratnya saling menghapus ketika dibagi. */
    for (const cu of [1.5, 3, 8, 20])
      for (const d50 of [0.05, 0.5, 5]) {
        const r = filterDesign(d50, cu, d50 * 10, 6);
        assert.ok(
          Math.abs(r.d15Max / r.d15Min - r.window) / r.window < 1e-12,
          `Cu ${cu}`
        );
        assert.ok(
          Math.abs(r.window - r.base.d85 / r.base.d15) / r.window < 1e-12
        );
      }
  });

  it("tanah yang seragam hampir tidak memberi pilihan filter", () => {
    const seragam = filterDesign(0.3, 1.5, 3, 6);
    const lebar = filterDesign(0.3, 15, 3, 6);
    assert.ok(seragam.window < 2);
    assert.ok(lebar.window > 8);
    assert.ok(lebar.window > seragam.window);
  });

  it("filter yang memenuhi syarat aliran sekurangnya enam belas kali lebih lolos", () => {
    /* Akibat langsung Hazen bersama syarat D15 empat kali lipat. */
    for (const cu of [2, 6, 15]) {
      const base = gradation(0.2, cu);
      /* Filter paling halus yang masih meloloskan air */
      const d15 = FILTER_DRAIN * base.d15;
      const filter = gradation((d15 / gradation(1, cu).d15) * 1, cu);
      const r = filterDesign(0.2, cu, filter.d50, cu);
      assert.ok(r.drains, `Cu ${cu} tidak lolos syarat aliran`);
      assert.ok(
        r.kRatio > 15.9,
        `Cu ${cu} memberi nisbah ${r.kRatio.toFixed(1)}`
      );
    }
  });

  it("menolak filter yang terlalu kasar dan filter yang terlalu halus", () => {
    const base = gradation(0.2, 6);
    const kasar = filterDesign(0.2, 6, base.d85 * 40, 6);
    const halus = filterDesign(0.2, 6, base.d15 * 1.2, 6);
    assert.equal(kasar.retains, false);
    assert.equal(kasar.drains, true);
    assert.equal(halus.retains, true);
    assert.equal(halus.drains, false);
    assert.equal(kasar.passes, false);
    assert.equal(halus.passes, false);
  });

  it("jendela itu selalu ada, betapa pun tanahnya", () => {
    /* D15 tanah tidak pernah melampaui D85 tanah, jadi batas bawahnya tidak
       pernah melampaui batas atasnya. */
    for (const cu of [1.01, 1.5, 5, 20, 100]) {
      const r = filterDesign(0.4, cu, 4, 6);
      assert.ok(r.d15Min <= r.d15Max, `Cu ${cu}`);
      assert.ok(r.window >= 1);
    }
    assert.equal(FILTER_RETAIN, FILTER_DRAIN);
  });
});

/* ================================================================== *
 * DM-03  Urugan batu
 * ================================================================== */

describe("Aliran melalui urugan batu", () => {
  it("bertemu Darcy pada gradien yang sangat kecil", () => {
    /* Simpangannya sebanding dengan gradiennya sendiri, jadi gradien yang
       dipakai harus benar-benar kecil supaya batasnya terlihat. */
    const i = 1e-12;
    const r = rockfillFlow(i, 0.2, 0.4, 1);
    const selisih = Math.abs(r.v - r.kDarcy * i) / (r.kDarcy * i);
    assert.ok(selisih < 1e-4, `selisih ${selisih}`);
    assert.ok(Math.abs(r.exponent - 1) < 1e-4);
    /* Dan pada gradien yang lebih besar simpangannya harus tumbuh */
    const besar = rockfillFlow(1e-6, 0.2, 0.4, 1);
    assert.ok(Math.abs(besar.exponent - 1) > selisih);
  });

  it("dan mendekati akar gradien pada gradien besar", () => {
    const r = rockfillFlow(0.5, 0.4, 0.4, 1);
    const inersia = Math.sqrt(0.5 / r.B);
    assert.ok(Math.abs(r.v - inersia) / inersia < 0.02);
    assert.ok(Math.abs(r.exponent - 0.5) < 0.02);
  });

  it("permeabilitas Darcynya adalah Kozeny-Carman", () => {
    const n = 0.4;
    const d = 0.2;
    const nu = 1.79e-6 / (1 + 0.03368 * 20 + 0.000221 * 400);
    const acuan = (n * n * n * G * d * d) / (150 * (1 - n) * (1 - n) * nu);
    const r = rockfillFlow(0.1, d, n, 1);
    assert.ok(Math.abs(r.kDarcy - acuan) / acuan < 1e-12);
  });

  it("pulang pergi antara gradien dan kecepatan", () => {
    for (const i of [1e-6, 1e-3, 0.01, 0.1, 1, 5])
      for (const d of [0.02, 0.2, 1])
        for (const n of [0.25, 0.4, 0.5]) {
          const r = rockfillFlow(i, d, n, 1);
          const balik = rockfillGradient(r.v, d, n);
          assert.ok(
            Math.abs(balik - i) / i < 1e-9,
            `i ${i} d ${d} n ${n} memberi ${balik}`
          );
        }
  });

  it("pangkatnya tidak pernah keluar dari setengah sampai satu", () => {
    for (const i of [1e-8, 1e-4, 0.01, 1, 100])
      for (const d of [0.005, 0.05, 0.5, 2])
        for (const n of [0.2, 0.35, 0.5]) {
          const r = rockfillFlow(i, d, n, 1);
          assert.ok(r.exponent >= 0.5 - 1e-9 && r.exponent <= 1 + 1e-9);
        }
  });

  it("Darcy selalu melebih-lebihkan, dan makin parah ketika batunya makin besar", () => {
    let sebelum = 0;
    for (const d of [0.01, 0.05, 0.2, 0.5, 1]) {
      const r = rockfillFlow(0.1, d, 0.4, 1);
      assert.ok(r.overprediction >= 1);
      assert.ok(r.overprediction > sebelum, `d ${d}`);
      sebelum = r.overprediction;
    }
    assert.ok(sebelum > 10);
  });

  it("menandai keadaan yang hukum Darcynya masih berlaku", () => {
    assert.equal(rockfillFlow(1e-6, 0.01, 0.4, 1).darcyValid, true);
    assert.equal(rockfillFlow(0.1, 0.5, 0.4, 1).darcyValid, false);
    const batas = rockfillFlow(0.1, 0.5, 0.4, 1);
    assert.ok(batas.poreRe > PORE_RE_DARCY);
  });

  it("menggandakan gradien menaikkan aliran hanya empat puluh satu persen di ujung inersia", () => {
    const a = rockfillFlow(0.2, 0.6, 0.4, 1);
    const b = rockfillFlow(0.4, 0.6, 0.4, 1);
    const naik = b.v / a.v;
    assert.ok(
      Math.abs(naik - Math.SQRT2) < 0.02,
      `naik ${naik} bukan akar dua`
    );
  });
});

/* ================================================================== *
 * SY-01  Regulasi tidur
 * ================================================================== */

describe("Model dua proses", () => {
  it("penyelesaian eksponensialnya memenuhi persamaan diferensialnya", () => {
    const dt = 1e-6;
    for (const S of [0.1, 0.4, 0.8]) {
      const naik = (sleepRise(S, dt) - S) / dt;
      assert.ok(Math.abs(naik - (1 - S) / SLEEP_TAU_RISE) < 1e-6);
      const turun = (sleepFall(S, dt) - S) / dt;
      assert.ok(Math.abs(turun + S / SLEEP_TAU_FALL) < 1e-6);
    }
  });

  it("waktu naik dan turunnya pulang pergi", () => {
    for (const S of [0.1, 0.35, 0.6]) {
      const t = wakeTimeTo(S, 0.7);
      assert.ok(Math.abs(sleepRise(S, t) - 0.7) < 1e-12);
      const u = sleepTimeTo(0.7, S);
      assert.ok(Math.abs(sleepFall(0.7, u) - S) < 1e-12);
    }
  });

  it("daurnya mantap: hitungan langkah demi langkah bertemu bentuk tertutupnya", () => {
    const r = sleepRegulation();
    assert.ok(r.episodes.length >= 8);
    const selisih = Math.abs(r.Swake - r.SwakeSteady);
    assert.ok(selisih < 0.01, `${r.Swake} lawan ${r.SwakeSteady}`);
  });

  it("lama tidurnya muncul sendiri, tidak ditetapkan di mana pun", () => {
    const r = sleepRegulation();
    assert.ok(r.meanDuration > 6 && r.meanDuration < 10, `${r.meanDuration} jam`);
    /* Tiga daur terakhir harus sudah berulang */
    const tiga = r.episodes.slice(-3);
    const rentang =
      Math.max(...tiga.map((e) => e.duration)) -
      Math.min(...tiga.map((e) => e.duration));
    assert.ok(rentang < 0.3, `rentang ${rentang} jam`);
  });

  it("panjang daurnya tanpa irama harian bukan dua puluh empat jam", () => {
    /*
     * Hasil yang paling mengubah cara membaca model ini. Matikan proses C
     * dan daurnya TETAP ADA, hanya panjangnya tujuh belas jam. Yang
     * dikerjakan irama harian bukan menciptakan daur melainkan menguncinya
     * ke dua puluh empat jam.
     */
    const datar = sleepRegulation(0);
    assert.ok(datar.episodes.length >= 8, "daurnya harus tetap ada");
    const tiga = datar.episodes.slice(-3);
    const daur = tiga[2].onset - tiga[1].onset;
    assert.ok(
      Math.abs(daur - datar.freePeriod) < 0.2,
      `daur ${daur} lawan bentuk tertutupnya ${datar.freePeriod}`
    );
    assert.ok(
      Math.abs(datar.freePeriod - 17.23) < 0.05,
      `${datar.freePeriod} jam`
    );
    assert.ok(Math.abs(daur - 24) > 5, "dan jelas bukan dua puluh empat");
  });

  it("irama harian yang cukup kuat menguncinya ke dua puluh empat jam", () => {
    const r = sleepRegulation();
    const tiga = r.episodes.slice(-3);
    assert.ok(Math.abs(tiga[2].onset - tiga[1].onset - 24) < 0.2);
    assert.ok(Math.abs(tiga[1].onset - tiga[0].onset - 24) < 0.2);
  });

  it("utang tidur pulih lebih cepat daripada ia menumpuk", () => {
    /* Tetapan waktu turun empat kali lebih pendek daripada yang naik. */
    assert.ok(SLEEP_TAU_FALL * 4 < SLEEP_TAU_RISE + 2);
    const naikSejam = sleepRise(0.5, 1) - 0.5;
    const turunSejam = 0.5 - sleepFall(0.5, 1);
    assert.ok(turunSejam > naikSejam * 3);
  });

  it("jadwal paksa menetapkan tekanan tidur pada aras baru, bukan menaikkannya tanpa batas", () => {
    const paksa = sleepRegulation(undefined, undefined, undefined, {
      bedtime: 23,
      wakeTime: 5,
    });
    assert.equal(paksa.restricted, true);
    assert.ok(Math.abs(paksa.meanDuration - 6) < 0.1, `${paksa.meanDuration} jam`);
    assert.ok(paksa.debtHours > 1, `utang ${paksa.debtHours} jam`);
    /* Yang membuktikan ia menetap: tekanan bangunnya bertemu bentuk tertutup
       daur dua puluh empat jam, dan arasnya lebih tinggi daripada jadwal
       bebas tetapi tetap jauh di bawah satu. */
    assert.ok(
      Math.abs(paksa.Swake - paksa.SwakeSteady) < 0.005,
      `${paksa.Swake} lawan ${paksa.SwakeSteady}`
    );
    assert.ok(paksa.Swake > sleepRegulation().Swake, "arasnya harus lebih tinggi");
    assert.ok(paksa.Swake < 0.5);
  });

  it("tidur lebih awal tidak membeli tidur, ia membeli berbaring", () => {
    /*
     * Jendela sepuluh jam dari jam delapan malam sampai jam enam pagi hanya
     * menghasilkan tidur sekitar tujuh jam, karena tekanan tidurnya belum
     * mencapai ambang atas pada jam delapan malam. Sisanya waktu tunggu.
     */
    const awal = sleepRegulation(undefined, undefined, undefined, {
      bedtime: 20,
      wakeTime: 6,
    });
    assert.equal(awal.cannotSleepYet, true);
    assert.ok(awal.latency > 2, `tunggu ${awal.latency} jam`);
    assert.ok(
      Math.abs(awal.meanDuration + awal.latency - 10) < 0.2,
      "jendela sepuluh jam harus terbagi habis"
    );
    /* Dan jendela yang sama panjangnya tetapi dimulai lebih larut memberi
       tidur yang lebih banyak, bukan lebih sedikit */
    const larut = sleepRegulation(undefined, undefined, undefined, {
      bedtime: 23,
      wakeTime: 9,
    });
    assert.ok(larut.meanDuration > awal.meanDuration, "yang larut lebih banyak tidurnya");
    assert.ok(larut.latency < awal.latency);
  });

  it("petang yang terlarang muncul hanya bila iramanya cukup kuat", () => {
    /*
     * Ambangnya harus naik lebih cepat daripada tekanan tidur naik
     * mengejarnya, dan laju naik ambang sebanding dengan simpangan iramanya.
     * Pada simpangan yang lazim, petang itu TIDAK ADA, dan menyatakannya
     * ada di situ akan menjadi ramalan yang tidak dimiliki modelnya.
     */
    assert.equal(sleepRegulation(0).forbiddenZone, false);
    assert.equal(sleepRegulation(0.1).forbiddenZone, false);
    const kuat = sleepRegulation(0.18);
    assert.equal(kuat.forbiddenZone, true);
    assert.ok(kuat.forbiddenHours > 1 && kuat.forbiddenHours < 12, `${kuat.forbiddenHours} jam`);
  });

  it("menolak ambang yang keluar dari rentang tekanan tidurnya", () => {
    assert.equal(sleepRegulation(0.1).valid, true);
    assert.equal(sleepRegulation(0.25).valid, false);
    assert.equal(sleepRegulation(0.1, 0.6, 0.7).valid, false);
  });
});

/* ================================================================== *
 * EK-04  Lintasan ikan dan populasi
 * ================================================================== */

describe("Populasi ikan ruaya di hulu bendung", () => {
  it("populasi yang dimulai jauh di atas daya dukungnya menurun ke keadaan mantapnya, bukan ke nol", () => {
    /*
     * Langkah Euler selebar satu tahun melompati nol pada keadaan ini,
     * lalu menjepitnya ke nol, sehingga populasi yang justru pulih
     * dinyatakan punah. Penyelesaian sebenarnya tidak pernah mencapai nol.
     */
    const r = fishPassage(20000, 500, 0.6, 0.3, 0.9);
    assert.ok(r.equilibrium > 0);
    assert.ok(
      Math.abs(r.path[60].population - r.equilibrium) / r.equilibrium < 0.01,
      `tahun 60 memberi ${r.path[60].population}, mantapnya ${r.equilibrium}`
    );
    assert.equal(r.extinct, false);
  });

  it("dan tidak pernah melompati nol berapa pun jarak awalnya dari daya dukungnya", () => {
    for (const N0 of [100, 5000, 20000])
      for (const K of [500, 10000, 50000])
        for (const passage of [0.6, 0.9, 1]) {
          const r = fishPassage(N0, K, 0.6, 0.3, passage);
          for (const p of r.path)
            assert.ok(
              p.population >= 0 && Number.isFinite(p.population),
              `N0 ${N0} K ${K} p ${passage} tahun ${p.year} memberi ${p.population}`
            );
          /*
           * Yang diperiksa ARAHNYA, bukan kedatangannya. Pertumbuhan bersih
           * yang lambat memang belum sampai ke keadaan mantapnya dalam enam
           * puluh tahun, dan menuntutnya sampai akan menuntut sifat yang
           * memang bukan milik penyelesaiannya. Yang harus berlaku: lintasan
           * logistik menghampiri keadaan mantapnya dari satu sisi saja dan
           * tidak pernah melewatinya.
           */
          if (r.equilibrium > 0) {
            const naik = N0 < r.equilibrium;
            for (const p of r.path)
              assert.ok(
                naik
                  ? p.population <= r.equilibrium * 1.001
                  : p.population >= r.equilibrium * 0.999,
                `N0 ${N0} K ${K} p ${passage} melewati keadaan mantapnya pada tahun ${p.year}: ${p.population}`
              );
            /* Populasi yang dimulai TEPAT pada keadaan mantapnya memang
               tidak bergerak ke mana pun, dan itu bukan arah yang salah
               melainkan tidak adanya arah sama sekali. */
            const akhir = r.path[60].population;
            const diam = Math.abs(N0 - r.equilibrium) / r.equilibrium < 1e-9;
            if (!diam)
              assert.ok(
                naik ? akhir > N0 : akhir < N0,
                `N0 ${N0} K ${K} p ${passage} bergerak ke arah yang salah`
              );
            else
              assert.ok(
                Math.abs(akhir - N0) / N0 < 1e-6,
                `N0 ${N0} K ${K} p ${passage} bergeser dari keadaan mantapnya`
              );
          }
        }
  });

  it("populasi punah hanya ketika pertumbuhan efektifnya memang kalah oleh kematiannya", () => {
    assert.equal(fishPassage(5000, 10000, 0.05, 1, 0.9).extinct, true);
    assert.equal(fishPassage(5000, 10000, 0.6, 0.3, 0.9).extinct, false);
    assert.ok(fishPassage(5000, 10000, 0.05, 1, 0.9).path[60].population < 1);
  });
});
