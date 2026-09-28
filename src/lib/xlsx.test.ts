import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";

import { colName, xlsxBytes } from "./xlsx.ts";

/** Baca arsip zip lewat direktori pusatnya, seperti Excel membacanya */
function bukaZip(b: Uint8Array): Map<string, string> {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const akhir = b.length - 22;
  assert.equal(v.getUint32(akhir, true), 0x06054b50, "tanda akhir arsip");
  const jumlah = v.getUint16(akhir + 10, true);
  let p = v.getUint32(akhir + 16, true);
  const hasil = new Map<string, string>();
  const dec = new TextDecoder();
  for (let i = 0; i < jumlah; i++) {
    assert.equal(v.getUint32(p, true), 0x02014b50, "tanda direktori pusat");
    const metode = v.getUint16(p + 10, true);
    const besar = v.getUint32(p + 20, true);
    const nNama = v.getUint16(p + 28, true);
    const lokal = v.getUint32(p + 42, true);
    const nama = dec.decode(b.subarray(p + 46, p + 46 + nNama));
    assert.equal(v.getUint32(lokal, true), 0x04034b50, `tanda berkas ${nama}`);
    const mulai = lokal + 30 + v.getUint16(lokal + 26, true) + v.getUint16(lokal + 28, true);
    const data = b.subarray(mulai, mulai + besar);
    hasil.set(nama, dec.decode(metode === 0 ? data : inflateRawSync(data)));
    p += 46 + nNama + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return hasil;
}

describe("Unduhan Excel (.xlsx) HY-05 dan HY-06", () => {
  it("nama kolom A, Z, AA, AZ, BA", () => {
    assert.deepEqual([0, 25, 26, 51, 52].map(colName), ["A", "Z", "AA", "AZ", "BA"]);
  });
  it("arsip berisi enam bagian buku kerja yang saling merujuk", () => {
    const z = bukaZip(xlsxBytes([["x"], [1]]));
    assert.deepEqual(
      [...z.keys()].sort(),
      ["[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml"].sort()
    );
  });
  it("angka tersimpan sebagai angka, teks sebagai teks, tanggal sebagai nomor seri Excel", () => {
    const z = bukaZip(
      xlsxBytes([
        ["tanggal", "hujan_mm", "jenis"],
        [new Date(Date.UTC(2020, 6, 5)), 0.257, "data <&>"],
        [new Date(Date.UTC(1900, 2, 1)), 1e-7, ""],
      ])
    );
    const s = z.get("xl/worksheets/sheet1.xml")!;
    // 5 Juli 2020 = 44017 di Excel; 1 Maret 1900 = 61 (sesudah 29 Februari 1900 fiktif Excel)
    assert.match(s, /<c r="A2" s="1"><v>44017<\/v><\/c>/);
    assert.match(s, /<c r="A3" s="1"><v>61<\/v><\/c>/);
    assert.match(s, /<c r="B2"><v>0.257<\/v><\/c>/);
    assert.match(s, /<c r="B3"><v>1e-7<\/v><\/c>/);
    assert.match(s, /<t xml:space="preserve">data &lt;&amp;&gt;<\/t>/);
    assert.doesNotMatch(s, /r="C3"/, "sel kosong tidak ditulis");
  });
});
