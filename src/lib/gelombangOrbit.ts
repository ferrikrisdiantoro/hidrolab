/**
 * FP-03  Gerak partikel gelombang linear (teori Airy) pada kedalaman z.
 *
 * Model lembar (linearWave di hydraulics.ts) memberi k, L, c dan setengah
 * sumbu mendatar orbit DI DASAR saja. Panel ruang fisik FP-03 butuh orbit
 * di setiap kedalaman, jadi berkas kecil ini menambah tiga rumus baku teori
 * linear, tanpa mengubah model yang ada. k dan σ = 2π/T tetap diambil dari
 * linearWave (hubungan sebaran yang sama).
 *
 * Rujukan: U.S. Army Corps of Engineers (2002). Coastal Engineering Manual,
 * EM 1110-2-1100, bagian II-1, Tabel II-1-1 (perpindahan partikel ξ, ζ dan
 * kecepatan u, w); Dean, R.G. & Dalrymple, R.A. (1991). Water Wave
 * Mechanics for Engineers and Scientists, bab 4.
 *
 *   η = (H/2) cos θ,                     θ = k x − σ t
 *   ξ = −(H/2) cosh k(h+z) / sinh kh · sin θ
 *   ζ =  (H/2) sinh k(h+z) / sinh kh · cos θ
 *   u =  (H/2) σ cosh k(h+z) / sinh kh · cos θ
 *   w =  (H/2) σ sinh k(h+z) / sinh kh · sin θ
 *
 * z diukur dari muka air diam, ke atas positif (dasar di z = −h). Bentuk
 * σ·cosh/sinh sama dengan (gHk/2σ)·cosh/cosh pada Tabel II-1-1 karena
 * σ² = g k tanh kh.
 *
 * Nisbah cosh/sinh dihitung lewat eksponen supaya tidak meluap di air
 * dalam (kh sampai ≈ 2000 pada rentang penggeser).
 */

/** cosh k(h+z) / sinh kh, stabil untuk kh besar (z ≤ 0). */
export function orbitRatioCosh(k: number, h: number, z: number): number {
  const kh = Math.max(k * h, 1e-12);
  return (Math.exp(k * z) + Math.exp(-k * (2 * h + z))) / (1 - Math.exp(-2 * kh));
}

/** sinh k(h+z) / sinh kh, stabil untuk kh besar (z ≤ 0). */
export function orbitRatioSinh(k: number, h: number, z: number): number {
  const kh = Math.max(k * h, 1e-12);
  return (Math.exp(k * z) - Math.exp(-k * (2 * h + z))) / (1 - Math.exp(-2 * kh));
}

/**
 * Setengah sumbu orbit partikel yang posisi diamnya di kedalaman z:
 * out[0] = mendatar A, out[1] = tegak B (m). Lingkaran di air dalam
 * (A = B = (H/2) e^{kz}), elips yang makin pipih ke dasar di air dangkal,
 * dan garis bolak-balik (B = 0) tepat di dasar.
 */
export function waveOrbitAxes(H: number, k: number, h: number, z: number, out: Float64Array): void {
  out[0] = (H / 2) * orbitRatioCosh(k, h, z);
  out[1] = (H / 2) * orbitRatioSinh(k, h, z);
}

/**
 * Perpindahan partikel dari posisi diamnya (x0, z0) pada saat t:
 * out[0] = ξ (mendatar), out[1] = ζ (tegak, ke atas positif), m.
 */
export function waveParticle(
  H: number,
  k: number,
  sigma: number,
  h: number,
  x0: number,
  z0: number,
  t: number,
  out: Float64Array
): void {
  const th = k * x0 - sigma * t;
  out[0] = -(H / 2) * orbitRatioCosh(k, h, z0) * Math.sin(th);
  out[1] = (H / 2) * orbitRatioSinh(k, h, z0) * Math.cos(th);
}

/** Kecepatan partikel: out[0] = u, out[1] = w, m/s. */
export function waveVelocity(
  H: number,
  k: number,
  sigma: number,
  h: number,
  x0: number,
  z0: number,
  t: number,
  out: Float64Array
): void {
  const th = k * x0 - sigma * t;
  out[0] = (H / 2) * sigma * orbitRatioCosh(k, h, z0) * Math.cos(th);
  out[1] = (H / 2) * sigma * orbitRatioSinh(k, h, z0) * Math.sin(th);
}

/** Muka air η(x, t) = (H/2) cos(kx − σt), m. */
export function waveSurface(H: number, k: number, sigma: number, x: number, t: number): number {
  return (H / 2) * Math.cos(k * x - sigma * t);
}
