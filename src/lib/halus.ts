/**
 * Peralihan halus MASUKAN (OC-07 "muka air turun/naik dengan easing").
 *
 * Yang dianimasikan nilai masukan, bukan gambar: tiap frame model dihitung
 * ulang dengan nilai antara, jadi setiap gambar antara adalah keadaan tunak
 * yang sah untuk masukan itu. Yang tidak boleh terjadi adalah memudarkan
 * atau menyisipkan GAMBAR lama ke gambar baru, karena gambar antara seperti
 * itu tidak dihitung siapa pun.
 *
 * Langkah: pendekatan eksponensial (perlambatan di ujung, ease-out) dengan
 * tetapan waktu τ: sisa berkurang 1 − e^(−dt/τ) tiap langkah. Bila sisanya
 * di bawah `eps`, nilai melompat tepat ke sasaran, jadi gambar diam selalu
 * persis gambar sasarannya.
 */
export function langkahHalus(
  kini: number,
  sasaran: number,
  dt: number,
  tau: number,
  eps: number
): number {
  // Sasaran tak terhingga atau NaN: langsung, supaya gelung rAF berhenti.
  if (!Number.isFinite(sasaran) || !Number.isFinite(kini)) return sasaran;
  if (kini === sasaran) return sasaran;
  if (!(dt > 0)) return kini;
  const baru = sasaran + (kini - sasaran) * Math.exp(-dt / tau);
  return Math.abs(baru - sasaran) < eps ? sasaran : baru;
}
