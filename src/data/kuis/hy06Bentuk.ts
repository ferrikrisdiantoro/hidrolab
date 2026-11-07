/**
 * Kelas bentuk ramalan ARIMA 30 hari untuk kuis HY-06 butir 5, PERSIS
 * definisi revisi insinyur-hidraulika (KUIS.md, 1 November; Hyndman &
 * Athanasopoulos FPP3 §9.5, §9.9). f = forecastArima(fit, 30), f₁..f₃₀;
 * m = max(rata-rata y, 1 mm). Kelasnya saling meniadakan: deret yang masuk
 * nol atau lebih dari satu kelas tidak dipakai.
 *
 *  - Mendatar: max − min f₂₃..f₃₀ < 0,02·m
 *  - Tren lurus: tidak mendatar, |Δf| rata-rata hari 23–30 > 0,01·m, dan
 *    max|Δ²f| hari 23–30 < 0,1·|Δf| rata-rata
 *  - Mingguan (koreksi insinyur 8 November, KUIS.md): garis lurus f₂₃→f₃₀
 *    dibuang dulu, e_t = f_t − f₂₃ − (t − 23)(f₃₀ − f₂₃)/7 untuk t = 24..30,
 *    R = max e − min e. Mingguan bila tidak mendatar, sebaran (max − min)
 *    f_t − f_{t−7} untuk t = 15..30 < 0,1·R, dan R > 0,05·m. Ramalan lurus
 *    murni memberi R = 0, jadi hanya bisa masuk kelas tren
 */

import type { ArimaOrder } from "../../lib/arima.ts";

export type PresetHY06 = "111" | "211" | "112" | "sarima7";
export type Bentuk = "mendatar" | "tren" | "mingguan";

/** Sama dengan ARIMA_ORDER lembar PrediksiHujanClient. */
export const ORDE_HY06: Record<PresetHY06, ArimaOrder> = {
  "111": { p: 1, d: 1, q: 1 },
  "211": { p: 2, d: 1, q: 1 },
  "112": { p: 1, d: 1, q: 2 },
  sarima7: { p: 1, d: 1, q: 1, P: 1, D: 1, Q: 1, s: 7 },
};

/** Urutan tombol orde ARIMA lembar (ARIMA_PRESETS tanpa "auto" di depan). */
export const PRESET_HY06: PresetHY06[] = ["111", "211", "112", "sarima7"];

/**
 * f₁..f₃₀ disimpan di indeks 0..29: f(t) = f[t − 1]. `rentang` = R, rentang
 * sisa sesudah garis lurus f₂₃→f₃₀ dibuang (bukan rentang mentah f₂₄..f₃₀).
 */
export function ukuranBentuk(y: number[], f: number[]) {
  const m = Math.max(y.reduce((s, v) => s + v, 0) / y.length, 1);
  const F = (t: number) => f[t - 1];
  const jangka = (a: number, b: number) => {
    const v = Array.from({ length: b - a + 1 }, (_, i) => F(a + i));
    return Math.max(...v) - Math.min(...v);
  };
  const datar = jangka(23, 30);
  const d1 = Array.from({ length: 8 }, (_, i) => F(23 + i) - F(22 + i));
  const d1Rata = d1.reduce((s, v) => s + Math.abs(v), 0) / d1.length;
  const d2 = Array.from({ length: 8 }, (_, i) => Math.abs(F(23 + i) - 2 * F(22 + i) + F(21 + i)));
  const d2Maks = Math.max(...d2);
  const beda7 = Array.from({ length: 16 }, (_, i) => F(15 + i) - F(8 + i));
  const sebaran7 = Math.max(...beda7) - Math.min(...beda7);
  // Sisa sesudah garis lurus f₂₃→f₃₀ dibuang, t = 24..30.
  const e = Array.from({ length: 7 }, (_, i) => {
    const t = 24 + i;
    return F(t) - F(23) - ((t - 23) * (F(30) - F(23))) / 7;
  });
  const rentang = Math.max(...e) - Math.min(...e);
  return { m, datar, d1Rata, d2Maks, sebaran7, rentang };
}

/** Kelas-kelas yang dipenuhi (harus tepat satu untuk dipakai). */
export function kelasBentuk(y: number[], f: number[]): Bentuk[] {
  const u = ukuranBentuk(y, f);
  const mendatar = u.datar < 0.02 * u.m;
  const out: Bentuk[] = [];
  if (mendatar) out.push("mendatar");
  if (!mendatar && u.d1Rata > 0.01 * u.m && u.d2Maks < 0.1 * u.d1Rata) out.push("tren");
  if (!mendatar && u.sebaran7 < 0.1 * u.rentang && u.rentang > 0.05 * u.m) out.push("mingguan");
  return out;
}
