/**
 * M1 Gerak butir sedimen untuk animasi SD-01 (kurva Shields) dan SD-03
 * (erosi dan suspensi): keadaan butir (diam, menggelinding di dasar,
 * melayang) dan laju butir dasar.
 *
 * Berkas ini tidak menghitung ulang ambang Shields atau kecepatan endap.
 * Keduanya diambil dari shieldsState() dan settlingVelocity() di
 * hydraulics.ts supaya lembar dan animasi membaca satu sumber yang sama.
 *
 * Semua fungsi murah dan dapat dipanggil tiap frame; grainMotion() menerima
 * objek `out` supaya tidak membuat objek baru.
 */

import { frictionVelocity, type ShieldsResult } from "./hydraulics.ts";

/* ------------------------------------------------------------------ *
 * Laju butir dasar
 * ------------------------------------------------------------------ */

/**
 * Tetapan rumus laju butir dasar Fernandez Luque & van Beek (1976):
 *
 *   us = 11,5 (u* - 0,7 u*c)
 *
 * Rujukan: Fernandez Luque, R. & van Beek, R. (1976), Erosion and transport
 * of bed-load sediment, J. Hydraul. Res. 14(2), 127-144. Naskah asli tidak
 * dapat dibuka (berbayar); abstraknya di pustaka IAHR (pid 7051) memastikan
 * bentuknya (laju butir = kecepatan fluida dekat dasar dikurangi tetapan
 * yang sebanding dengan u*c). Angka 11,5 dan 0,7 dicek pada kutipan
 * Penteado & Franklin (2016), Velocity fields of a bed-load layer under a
 * turbulent liquid flow, arXiv:1608.04412, bagian 1: "vx = 11.5(u* - 0.7 u*,th)".
 */
export const FLVB_A = 11.5;
export const FLVB_B = 0.7;

export type BedloadVelocity = {
  /** Laju rata-rata butir yang bergerak di dasar, m/s */
  us: number;
  /** Benar bila theta melampaui theta kritis */
  moving: boolean;
};

/**
 * Laju rata-rata butir dasar dari bilangan Shields.
 *
 * Karena theta sebanding dengan u*^2 (theta = u*^2 / ((s-1) g d)), kecepatan
 * gesek kritis cukup diturunkan dari perbandingan theta:
 *
 *   u*c = u* sqrt(theta_c / theta)
 *
 * Di bawah ambang butir diam dan lajunya nol. Tepat di atas ambang rumus
 * memberi 11,5 x 0,3 u*c, bukan nol: rumus ini memang tidak menuju nol
 * pada ambang (butir yang lepas langsung punya laju berhingga).
 */
export function bedloadGrainVelocity(
  /** Bilangan Shields yang bekerja */
  theta: number,
  /** Bilangan Shields kritis */
  thetaC: number,
  /** Kecepatan gesek yang bekerja, m/s */
  ustar: number
): BedloadVelocity {
  if (!(theta > thetaC) || !(thetaC > 0) || !(ustar > 0)) {
    return { us: 0, moving: false };
  }
  const ustarC = ustar * Math.sqrt(thetaC / theta);
  return { us: FLVB_A * (ustar - FLVB_B * ustarC), moving: true };
}

/* ------------------------------------------------------------------ *
 * Ambang melayang
 * ------------------------------------------------------------------ */

/**
 * Perbandingan u* / ws pada ambang melayang menurut Bagnold (1966).
 *
 * Bagnold menganggap butir tidak dapat melayang kecuali komponen kecepatan
 * pusaran ke atas melampaui kecepatan endap V. Dari data Laufer ia memakai
 * v' = 1,25 u*, sehingga v'/V = 1 bila 1,25 u* = V, yaitu u* = 0,8 ws
 * (ws/u* = 1,25). Untuk kuarsa di air ini sama dengan theta_s = 0,4 V^2/(gD)
 * (pers. 18a), dan contoh di naskah: D = 2 mm, V = 20 cm/s memberi
 * theta_s sekitar 0,8.
 *
 * Rujukan: Bagnold, R.A. (1966), An approach to the sediment transport
 * problem from general physics, USGS Professional Paper 422-I, hlm. I15-I16,
 * bagian "Critical flow stages for suspension", pers. 18a (naskah dibuka dari
 * pubs.usgs.gov/pp/0422i/report.pdf).
 *
 * Catatan: hjulstrom() di hydraulics.ts memakai ws = u* (perbandingan 1)
 * untuk kurva melayangnya. Bila lembar SD-03 harus sama persis dengan kurva
 * itu, panggil suspensionState(..., 1).
 */
export const BAGNOLD_SUSPENSION = 0.8;

export type SuspensionState = {
  /** ws/u*, tak hingga bila aliran diam */
  ratio: number;
  /** Benar bila u* >= kriteria x ws */
  suspended: boolean;
};

export function suspensionState(
  /** Kecepatan gesek, m/s */
  ustar: number,
  /** Kecepatan endap, m/s */
  ws: number,
  /** u* / ws pada ambang melayang; bawaan Bagnold (1966) 0,8 */
  criterion = BAGNOLD_SUSPENSION
): SuspensionState {
  if (!(ustar > 0)) return { ratio: Number.POSITIVE_INFINITY, suspended: false };
  const w = Math.max(ws, 0);
  return { ratio: w / ustar, suspended: ustar >= criterion * w };
}

/* ------------------------------------------------------------------ *
 * Keadaan butir untuk animasi
 * ------------------------------------------------------------------ */

export type GrainMode = "diam" | "dasar" | "melayang";

export type GrainMotion = {
  mode: GrainMode;
  /**
   * Laju butir dasar Fernandez Luque & van Beek, m/s. Nol bila diam. Pada
   * keadaan melayang nilainya tetap laju dasar (batas bawah); laju butir
   * melayang mendekati kecepatan aliran dan tidak dihitung di sini.
   */
  us: number;
  /** Kecepatan gesek dari tau shieldsState, m/s */
  ustar: number;
  /** ws/u* */
  ratio: number;
};

/**
 * Keadaan dan laju satu butir dari hasil shieldsState().
 *
 * Urutan keputusan: butir harus lepas dari dasar dulu (theta > theta_c),
 * baru diuji melayang. Butir halus yang ambang melayangnya di bawah ambang
 * Shields (Bagnold: sekitar d <= 0,1 mm) karena itu tetap "diam" sampai
 * ambang Shields terlampaui, lalu langsung "melayang".
 */
export function grainMotion(
  shields: Pick<ShieldsResult, "theta" | "thetaCritical" | "tau">,
  /** Kecepatan endap dari settlingVelocity(), m/s */
  ws: number,
  rho = 1000,
  criterion = BAGNOLD_SUSPENSION,
  out?: GrainMotion
): GrainMotion {
  const o: GrainMotion = out ?? { mode: "diam", us: 0, ustar: 0, ratio: 0 };
  const ustar = frictionVelocity(shields.tau, rho);
  const moving = shields.theta > shields.thetaCritical && ustar > 0;
  o.ustar = ustar;
  o.ratio = ustar > 0 ? Math.max(ws, 0) / ustar : Number.POSITIVE_INFINITY;
  if (!moving) {
    o.mode = "diam";
    o.us = 0;
    return o;
  }
  const ustarC = ustar * Math.sqrt(shields.thetaCritical / shields.theta);
  o.us = FLVB_A * (ustar - FLVB_B * ustarC);
  o.mode = ustar >= criterion * Math.max(ws, 0) ? "melayang" : "dasar";
  return o;
}
