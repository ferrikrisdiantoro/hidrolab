/**
 * Pembaca jawaban hitung kuis, sadar bahasa.
 *
 * Kunci kuis ditulis dengan pemformat bahasa (fmtL), jadi kunci > 999 tampil
 * bertitik ribuan di ID ("11.307,3") dan berkoma ribuan di EN ("11,307.3").
 * Mahasiswa yang menyalin gaya itu harus terbaca benar.
 *
 *  - ID: titik = ribuan bila berpola d{1,3}(.ddd)+, koma = desimal
 *  - EN: koma = ribuan bila berpola d{1,3}(,ddd)+, titik = desimal
 *  - Tanpa pola ribuan: satu tanda (koma atau titik) dibaca desimal,
 *    sama seperti parseAngka bersama
 *
 * parseAngka di ui.tsx sengaja tidak diubah: kotak penggeser tidak pernah
 * menulis pemisah ribuan saat disunting.
 */
export function bacaJawaban(teks: string, lang: "id" | "en"): number | null {
  const s = teks.replace(/\s/g, "").replace(/[−–]/g, "-");
  const m = /^([-+]?)(.*)$/.exec(s);
  if (!m) return null;
  const tanda = m[1] === "-" ? -1 : 1;
  const badan = m[2];
  const ribu = lang === "id" ? "." : ",";
  const des = lang === "id" ? "," : ".";
  const polaRibu = lang === "id" ? /^\d{1,3}(\.\d{3})+(,\d*)?$/ : /^\d{1,3}(,\d{3})+(\.\d*)?$/;
  let norm: string;
  if (polaRibu.test(badan)) {
    norm = badan.split(ribu).join("").replace(des, ".");
  } else {
    if (!/^(\d+[.,]?\d*|[.,]\d+)$/.test(badan)) return null;
    norm = badan.replace(",", ".");
  }
  const v = Number(norm);
  return Number.isFinite(v) ? tanda * v : null;
}
