/**
 * Pembaca jawaban hitung kuis, sadar bahasa.
 *
 * Kunci kuis ditulis dengan pemformat bahasa (fmtL), jadi kunci > 999 tampil
 * bertitik ribuan di ID ("11.307,3") dan berkoma ribuan di EN ("11,307.3").
 * Mahasiswa yang menyalin gaya itu harus terbaca benar.
 *
 *  - ID: titik = ribuan bila berpola d{1,3}(.ddd)+, koma = desimal
 *  - EN: koma = ribuan bila berpola d{1,3}(,ddd)+, titik = desimal
 *  - Kelompok ribuan wajib diawali 1-9: "0.467" (ID) tetap desimal 0,467,
 *    kebiasaan kalkulator dan Excel
 *  - Tanpa pola ribuan: satu tanda (koma atau titik) dibaca desimal,
 *    sama seperti parseAngka bersama
 *  - Bentuk ambigu satu kelompok tanpa desimal ("1.012" ID, "1,012" EN)
 *    punya dua bacaan; bacaJawabanCalon mengembalikan keduanya (ribuan
 *    lebih dulu). Keduanya berselisih 1000 kali, jadi menerima salah satu
 *    tidak meloloskan jawaban yang salah
 *
 * parseAngka di ui.tsx sengaja tidak diubah: kotak penggeser tidak pernah
 * menulis pemisah ribuan saat disunting.
 */
export function bacaJawaban(teks: string, lang: "id" | "en"): number | null {
  return bacaJawabanCalon(teks, lang)[0] ?? null;
}

export function bacaJawabanCalon(teks: string, lang: "id" | "en"): number[] {
  const s = teks.replace(/\s/g, "").replace(/[−–]/g, "-");
  const m = /^([-+]?)(.*)$/.exec(s);
  if (!m) return [];
  const tanda = m[1] === "-" ? -1 : 1;
  const badan = m[2];
  const ribu = lang === "id" ? "." : ",";
  const des = lang === "id" ? "," : ".";
  const polaRibu = lang === "id" ? /^[1-9]\d{0,2}(\.\d{3})+(,\d*)?$/ : /^[1-9]\d{0,2}(,\d{3})+(\.\d*)?$/;
  const polaAmbigu = lang === "id" ? /^[1-9]\d{0,2}\.\d{3}$/ : /^[1-9]\d{0,2},\d{3}$/;
  const angka = (norm: string): number[] => {
    const v = Number(norm);
    return Number.isFinite(v) ? [tanda * v] : [];
  };
  if (polaAmbigu.test(badan)) {
    return [...angka(badan.split(ribu).join("")), ...angka(badan.replace(ribu, "."))];
  }
  if (polaRibu.test(badan)) return angka(badan.split(ribu).join("").replace(des, "."));
  if (!/^(\d+[.,]?\d*|[.,]\d+)$/.test(badan)) return [];
  return angka(badan.replace(",", "."));
}
