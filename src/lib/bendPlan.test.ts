import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { bendGeometry, bendPlan } from "./bendPlan.ts";

/**
 * Uji bentuk belokan pipa yang digambar bersama FF-03, PI-05, dan PI-06.
 *
 * Ditulis karena bentuk sebelumnya mempertemukan kedua sisinya pada satu
 * titik siku, dan titik itu melarikan diri ke luar gambar pada sudut besar
 * lalu lenyap sama sekali pada seratus delapan puluh derajat. Sudut itu
 * justru salah satu keadaan contoh pada dua lembar yang memakainya.
 */
describe("Belokan pipa tampak atas", () => {
  const sudutUji = [0, 1, 15, 45, 90, 135, 170, 179, 180];

  it("seluruh titiknya berhingga pada setiap sudut dan setiap penampang", () => {
    for (const th of sudutUji)
      for (const D1 of [0.1, 0.5, 1.2])
        for (const D2 of [0.1, 0.5, 1.2])
          for (const p of bendPlan(D1, D2, th, 2, 2))
            assert.ok(
              Number.isFinite(p.x) && Number.isFinite(p.z),
              `sudut ${th}, D ${D1}/${D2}: titik (${p.x}, ${p.z})`
            );
  });

  it("tidak ada titik yang melarikan diri jauh dari gambarnya", () => {
    /* Batas yang longgar sekalipun cukup: bentuk lamanya meleset sebelas
       kali lebar pipa pada seratus tujuh puluh derajat. */
    for (const th of sudutUji)
      for (const p of bendPlan(0.5, 0.5, th, 2, 2)) {
        assert.ok(Math.hypot(p.x, p.z) < 8, `sudut ${th}: (${p.x}, ${p.z})`);
      }
  });

  it("lebar penampang masuknya tepat garis tengah yang diminta", () => {
    for (const th of sudutUji) {
      const pts = bendPlan(0.4, 0.9, th, 2, 2);
      const awal = pts[0];
      const akhir = pts[pts.length - 1];
      assert.equal(awal.x, -2);
      assert.equal(akhir.x, -2);
      assert.ok(Math.abs(awal.z - akhir.z - 0.4) < 1e-12);
    }
  });

  it("penampang keluarnya selebar garis tengah keluar, tegak lurus arahnya", () => {
    for (const th of sudutUji.filter((s) => s > 0)) {
      const D2 = 0.9;
      const pts = bendPlan(0.4, D2, th, 2, 2);
      const g = bendGeometry(0.4, D2, th, 2);
      /* Kedua titik muka keluarnya berada tepat di tengah deretnya. */
      const n = pts.length;
      const kiri = pts[n / 2 - 1];
      const kanan = pts[n / 2];
      const lebar = Math.hypot(kiri.x - kanan.x, kiri.z - kanan.z);
      assert.ok(
        Math.abs(lebar - D2) < 1e-9,
        `sudut ${th}: lebar keluar ${lebar}`
      );
      /* Dan titik tengahnya memang titik yang dijanjikan bendGeometry. */
      const tx = (kiri.x + kanan.x) / 2;
      const tz = (kiri.z + kanan.z) / 2;
      assert.ok(
        Math.hypot(tx - g.outlet.x, tz - g.outlet.z) < 1e-9,
        `sudut ${th}: tengah muka keluar (${tx}, ${tz}) bukan (${g.outlet.x}, ${g.outlet.z})`
      );
    }
  });

  it("belokan berbalik arah memulangkan alirannya ke arah datangnya", () => {
    const g = bendGeometry(0.5, 0.5, 180, 2);
    assert.ok(Math.abs(g.direction.x + 1) < 1e-9);
    assert.ok(Math.abs(g.direction.z) < 1e-9);
    /* Dan kedua ruasnya terpisah dua kali jari-jari belokannya, tidak
       bertumpuk di atas satu sama lain. */
    assert.ok(Math.abs(g.outlet.z - 2 * g.radius) < 1e-9);
  });
});
