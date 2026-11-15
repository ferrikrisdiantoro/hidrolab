import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { bacaJawaban } from "./bacaJawaban.ts";

/*
 * Temuan uji rekan V20 (11 Nov): kunci kuis FF-07/FP-03 bisa > 999 dan
 * ditulis bertitik ribuan ("11.307,3"), tetapi parseAngka bersama menolak
 * ketikan yang sama persis. Pembaca jawaban kuis sadar bahasa.
 */
describe("bacaJawaban (kuis, sadar bahasa)", () => {
  it("ID: titik ribuan dan koma desimal", () => {
    assert.equal(bacaJawaban("11.307,3", "id"), 11307.3);
    assert.equal(bacaJawaban("1.012", "id"), 1012);
    assert.equal(bacaJawaban("1.234.567", "id"), 1234567);
    assert.equal(bacaJawaban("1,012", "id"), 1.012);
    assert.equal(bacaJawaban("0,5", "id"), 0.5);
    assert.equal(bacaJawaban("0.5", "id"), 0.5);
    assert.equal(bacaJawaban("1.0125", "id"), 1.0125);
    assert.equal(bacaJawaban("11307,3", "id"), 11307.3);
  });
  it("EN: koma ribuan dan titik desimal", () => {
    assert.equal(bacaJawaban("11,307.3", "en"), 11307.3);
    assert.equal(bacaJawaban("1,012", "en"), 1012);
    assert.equal(bacaJawaban("1.012", "en"), 1.012);
    assert.equal(bacaJawaban("0,5", "en"), 0.5);
    assert.equal(bacaJawaban("0.5", "en"), 0.5);
  });
  it("tanda, spasi, minus tipografi", () => {
    assert.equal(bacaJawaban(" −2,35 ", "id"), -2.35);
    assert.equal(bacaJawaban("-1.012,5", "id"), -1012.5);
    assert.equal(bacaJawaban("+3", "en"), 3);
    assert.equal(bacaJawaban(",5", "id"), 0.5);
  });
  it("menolak yang bukan angka atau pemisah salah urut", () => {
    for (const t of ["", "abc", "1,2,3", "1.2.3", "11,307.3x", "1,012.5,3", "--1", "1e3"]) {
      assert.equal(bacaJawaban(t, "id"), null, `id ${t}`);
    }
    assert.equal(bacaJawaban("11.307,3", "en"), null);
    assert.equal(bacaJawaban("11,307.3", "id"), null);
  });
});
