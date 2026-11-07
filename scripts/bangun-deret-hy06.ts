/**
 * Pembangkit kumpulan deret kuis HY-06 butir 5 (sekali jalan).
 *
 *   node scripts/bangun-deret-hy06.ts > src/data/kuis/hy06Deret.ts
 *
 * Mencocokkan SARIMA butuh 1,5–3 detik per deret, terlalu lama untuk
 * dibangkitkan tiap kali soal dibuat di peramban atau untuk 1000 benih di
 * uji. Jadi deretnya dibangkitkan di sini sekali, dengan kunci dari lib
 * (forecastArima(fitArima(y, orde), 30) dan kelasBentuk), lalu
 * kuisHY06.test.ts memeriksa ulang setiap anggota sekali.
 *
 * Syarat anggota: 35 hari, hujan ≥ 0 dibulatkan 0,1 mm, tepat satu kelas
 * bentuk, ramalan terendah > 0 (lembar memotong ramalan negatif ke 0), dan
 * bermargin: ukuran kelas yang dipenuhi berjarak ≥ 30 % dari batasnya.
 */

import { fitArima, forecastArima } from "../src/lib/arima.ts";
import { normal, prng, seragam } from "../src/lib/kuis.ts";
import { ORDE_HY06, kelasBentuk, ukuranBentuk, type Bentuk, type PresetHY06 } from "../src/data/kuis/hy06Bentuk.ts";

type Pola = "acak" | "mingguan" | "tren";
const N = 35;
const b1 = (v: number) => Math.round(v * 10) / 10;

function deret(pola: Pola, r: () => number): number[] {
  const rata = seragam(r, 4, 12);
  const amp = seragam(r, 0.5, 0.9) * rata;
  const fase = Math.floor(r() * 7);
  const sd = seragam(r, 0.1, 0.3) * rata;
  if (pola === "tren") {
    // Naik makin cepat: kemiringan harian ikut naik, derau kecil.
    const a = seragam(r, 0.05, 0.3), c = seragam(r, 0.005, 0.02), s = seragam(r, 0.05, 0.3);
    return Array.from({ length: N }, (_, t) => b1(Math.max(0, 2 + a * t + c * t * t + s * normal(r))));
  }
  return Array.from({ length: N }, (_, t) => {
    let v = rata;
    if (pola === "mingguan") v += amp * Math.sin((2 * Math.PI * (t + fase)) / 7);
    return b1(Math.max(0, v + sd * normal(r)));
  });
}

/**
 * Margin: ukuran kelas yang terpenuhi jauh dari batasnya. u.rentang = R,
 * rentang sisa sesudah garis lurus f₂₃→f₃₀ dibuang (koreksi insinyur
 * 8 November), jadi ramalan lurus tidak bisa bermargin sebagai mingguan.
 */
function bermargin(y: number[], f: number[], k: Bentuk): boolean {
  const u = ukuranBentuk(y, f);
  if (k === "mendatar") return u.datar < 0.7 * 0.02 * u.m;
  if (u.datar < 1.3 * 0.02 * u.m) return false;
  if (k === "tren")
    return u.d1Rata > 1.3 * 0.01 * u.m && u.d2Maks < 0.7 * 0.1 * u.d1Rata && (u.sebaran7 > 1.3 * 0.1 * u.rentang || u.rentang < 0.7 * 0.05 * u.m);
  return u.sebaran7 < 0.7 * 0.1 * u.rentang && u.rentang > 1.3 * 0.05 * u.m && !(u.d1Rata > 0.7 * 0.01 * u.m && u.d2Maks < 1.3 * 0.1 * u.d1Rata);
}

const RENCANA: [Pola, PresetHY06, number][] = [
  ["acak", "111", 2],
  ["acak", "211", 1],
  ["acak", "112", 1],
  ["mingguan", "111", 2],
  ["mingguan", "sarima7", 4],
  ["tren", "211", 2],
  ["tren", "111", 2],
  ["tren", "112", 1],
];

const hasil: { pola: Pola; preset: PresetHY06; bentuk: Bentuk; y: number[] }[] = [];
for (const [pola, preset, mau] of RENCANA) {
  let dapat = 0;
  for (let s = 1; s <= 400 && dapat < mau; s++) {
    const y = deret(pola, prng(0x4806 * 1000 + s * 7 + pola.length));
    const fit = fitArima(y, ORDE_HY06[preset]);
    if (!fit) continue;
    const f = forecastArima(fit, 30);
    if (!f.every(Number.isFinite) || Math.min(...f) <= 0) continue;
    const k = kelasBentuk(y, f);
    if (k.length !== 1 || !bermargin(y, f, k[0])) continue;
    hasil.push({ pola, preset, bentuk: k[0], y });
    dapat++;
    console.error(`${pola} ${preset} -> ${k[0]} (benih ${s})`);
  }
  if (dapat < mau) console.error(`KURANG ${pola} ${preset}: ${dapat}/${mau}`);
}

console.log(`/**
 * Kumpulan deret kuis HY-06 butir 5. DIBANGKITKAN, jangan disunting:
 *   node scripts/bangun-deret-hy06.ts > src/data/kuis/hy06Deret.ts
 * Kelas bentuk dihitung lib saat dibangkitkan dan diperiksa ulang
 * kuisHY06.test.ts.
 */
import type { Bentuk, PresetHY06 } from "./hy06Bentuk.ts";

export type DeretHY06 = { pola: "acak" | "mingguan" | "tren"; preset: PresetHY06; bentuk: Bentuk; y: number[] };

export const DERET_HY06: DeretHY06[] = [
${hasil.map((h) => `  { pola: "${h.pola}", preset: "${h.preset}", bentuk: "${h.bentuk}", y: [${h.y.join(", ")}] },`).join("\n")}
];`);
