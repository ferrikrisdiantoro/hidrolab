/**
 * M12 Hidrostatika untuk modul baru FF-08 (tekanan hidrostatis): tekanan
 * pada kedalaman, gaya hidrostatik, dan pusat tekanan bidang datar
 * terendam yang miring.
 *
 * Rujukan: White, F.M., Fluid Mechanics, bab 2 (Hydrostatic forces on plane
 * surfaces). Buku asli TIDAK dibuka. Rumusnya dicek pada catatan kuliah
 * IIT Guwahati CE203 Lecture 7 "Hydrostatic Forces on Surface" (Kartha,
 * 2017) yang menyatakan "Source: Fluid Mechanics by F.M. White", hlm. 2-4:
 *
 *   F    = pCG A,   pCG = pa + rho g hCG
 *   yCP  = -rho g sin(theta) Ixx / (pCG A)
 *   xCP  = -rho g sin(theta) Ixy / (pCG A)
 *
 * dengan sumbu (x, y) berpangkal di titik berat bidang, y sepanjang bidang
 * dengan arah positif ke atas lereng (menuju muka air), theta sudut bidang
 * terhadap muka air, Ixx dan Ixy momen inersia luas terhadap titik berat.
 * Tanda negatif berarti pusat tekanan di bawah titik berat.
 *
 * Angka contoh soal di uji: soal FE autarkaw (Fluids X-9) dan Crowe,
 * Elementary Fluid Mechanics, contoh 3.78 dalam salindia McKinney CE 319F
 * (UT Austin), keduanya dibuka.
 *
 * Satuan SI. Tekanan bawaan tekanan ukur (pa = 0).
 */

import { G } from "./hydraulics.ts";

/** Tekanan pada kedalaman h di bawah muka air, Pa. */
export function hydrostaticPressure(
  /** Kedalaman, m */
  depth: number,
  rho = 1000,
  g = G,
  /** Tekanan di muka air, Pa (0 = tekanan ukur) */
  pa = 0
): number {
  return pa + rho * g * Math.max(depth, 0);
}

/** Sifat luas bidang terhadap titik beratnya. */
export type PlaneSection = {
  /** Luas, m2 */
  area: number;
  /** Momen inersia terhadap sumbu x lewat titik berat (sejajar muka air), m4 */
  Ixx: number;
  /** Hasil kali inersia terhadap titik berat, m4 (0 bila simetris) */
  Ixy: number;
};

/** Persegi panjang selebar b (sejajar muka air) dan sepanjang L (sepanjang lereng). */
export function rectangleSection(b: number, L: number): PlaneSection {
  return { area: b * L, Ixx: (b * L * L * L) / 12, Ixy: 0 };
}

/** Lingkaran berjari-jari R. */
export function circleSection(R: number): PlaneSection {
  return { area: Math.PI * R * R, Ixx: (Math.PI * R * R * R * R) / 4, Ixy: 0 };
}

export type PlaneForce = {
  /** Tekanan di titik berat, Pa */
  pCG: number;
  /** Gaya resultan tegak lurus bidang, N */
  force: number;
  /** Jarak pusat tekanan dari titik berat sepanjang lereng, m (negatif = lebih dalam) */
  yCP: number;
  /** Jarak pusat tekanan dari titik berat menyamping, m */
  xCP: number;
  /** Kedalaman titik berat, m */
  depthCG: number;
  /** Kedalaman pusat tekanan, m */
  depthCP: number;
};

/**
 * Gaya hidrostatik pada satu sisi bidang datar yang tercelup penuh.
 *
 * Pemanggil menjamin seluruh bidang di bawah muka air. Untuk persegi
 * panjang yang mungkin menembus muka air pakai inclinedRectangle().
 */
export function planeSurfaceForce(
  sec: PlaneSection,
  /** Kedalaman titik berat, m */
  depthCG: number,
  /** Sudut bidang terhadap muka air, radian (pi/2 = tegak) */
  angle: number,
  rho = 1000,
  g = G,
  pa = 0
): PlaneForce {
  const h = Math.max(depthCG, 0);
  const pCG = pa + rho * g * h;
  const force = pCG * sec.area;
  const s = Math.sin(angle);
  const yCP = force > 0 ? (-rho * g * s * sec.Ixx) / force : 0;
  const xCP = force > 0 ? (-rho * g * s * sec.Ixy) / force : 0;
  return { pCG, force, yCP, xCP, depthCG: h, depthCP: h - yCP * s };
}

export type RectangleForce = PlaneForce & {
  /** Panjang bagian pelat yang basah sepanjang lereng, m */
  wettedLength: number;
  /**
   * Benar bila sebagian atau seluruh pelat di atas muka air, sehingga gaya
   * dihitung pada bagian basahnya saja. Lembar wajib memberi penanda.
   */
  clipped: boolean;
};

/**
 * Pelat persegi panjang miring: lebar b sejajar muka air, panjang L
 * sepanjang lereng, tepi atas di kedalaman topDepth (negatif = di atas air).
 *
 * Bila tepi atas di atas muka air, hanya bagian basah yang dihitung:
 * bagian kering sepanjang -topDepth / sin(theta) dibuang dan tepi atas basah
 * diletakkan di muka air.
 */
export function inclinedRectangle(
  b: number,
  L: number,
  /** Kedalaman tepi atas, m */
  topDepth: number,
  /** Sudut terhadap muka air, radian */
  angle: number,
  rho = 1000,
  g = G,
  pa = 0
): RectangleForce {
  const s = Math.sin(angle);
  let top = topDepth;
  let Lw = Math.max(L, 0);
  let clipped = false;
  if (top < 0) {
    clipped = true;
    Lw = s > 0 ? Math.max(Lw + top / s, 0) : 0;
    top = 0;
  }
  if (Lw <= 0 || !(b > 0)) {
    return {
      pCG: pa, force: 0, yCP: 0, xCP: 0, depthCG: 0, depthCP: 0,
      wettedLength: 0, clipped,
    };
  }
  const depthCG = top + (Lw / 2) * s;
  const r = planeSurfaceForce(rectangleSection(b, Lw), depthCG, angle, rho, g, pa);
  return { ...r, wettedLength: Lw, clipped };
}
