import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Penjaga berkas teks.
 *
 * Dua kali sudah satu kunci ditulis dua kali di dalam blok yang sama, dan
 * TypeScript memang menangkapnya, tetapi baru sesudah beberapa lembar
 * memakai kunci yang salah. Lebih murah menangkapnya di sini, sekaligus
 * menangkap kunci yang ada di satu bahasa dan hilang di bahasa lainnya,
 * karena yang terakhir itu tidak ditangkap siapa pun: TypeScript hanya
 * menyimpulkan bentuknya dari blok Indonesia.
 */

const SUMBER = readFileSync(
  new URL("./strings.ts", import.meta.url),
  "utf8"
);

function blok(nama: string): { id: string[]; en: string[] } {
  const awal = SUMBER.indexOf(`export const ${nama} = {`);
  assert.ok(awal >= 0, `blok ${nama} tidak ditemukan`);
  const akhir = SUMBER.indexOf("\n} as const;", awal);
  const isi = SUMBER.slice(awal, akhir);
  const batas = isi.indexOf("\n  en: {");
  assert.ok(batas > 0, `blok ${nama} tidak punya bagian en`);
  const kunci = (t: string) =>
    [...t.matchAll(/^ {4}([A-Za-z0-9_]+):/gm)].map((m) => m[1]);
  return { id: kunci(isi.slice(0, batas)), en: kunci(isi.slice(batas)) };
}

describe("Berkas teks dua bahasa", () => {
  for (const nama of ["S", "CANVAS"]) {
    it(`${nama}: tidak ada kunci yang ditulis dua kali`, () => {
      const { id, en } = blok(nama);
      const dua = (x: string[]) => x.filter((v, i) => x.indexOf(v) !== i);
      assert.deepEqual(dua(id), [], `kunci ganda di bagian Indonesia ${nama}`);
      assert.deepEqual(dua(en), [], `kunci ganda di bagian Inggris ${nama}`);
    });

    it(`${nama}: kedua bahasa punya kunci yang sama persis`, () => {
      const { id, en } = blok(nama);
      assert.deepEqual(
        id.filter((k) => !en.includes(k)),
        [],
        `ada di Indonesia tetapi tidak di Inggris, ${nama}`
      );
      assert.deepEqual(
        en.filter((k) => !id.includes(k)),
        [],
        `ada di Inggris tetapi tidak di Indonesia, ${nama}`
      );
    });

    it(`${nama}: tidak ada teks yang kosong`, () => {
      const awal = SUMBER.indexOf(`export const ${nama} = {`);
      const isi = SUMBER.slice(awal, SUMBER.indexOf("\n} as const;", awal));
      for (const m of isi.matchAll(/^ {4}([A-Za-z0-9_]+):\s*""/gm))
        assert.fail(`${nama}.${m[1]} kosong`);
    });
  }
});
