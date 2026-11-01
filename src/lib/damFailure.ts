/**
 * POSISI GAGAL BENDUNGAN GRAVITASI (DM-01, batch B3), gambar phantom.
 *
 * Model DM-01 (gravityDam) statis: ia menyatakan APAKAH gaya penahan
 * kalah, bukan bagaimana badan bergerak sesudahnya. Karena itu tidak ada
 * gerak. Yang digambar hanya garis phantom badan pada posisi gagalnya,
 * dengan besar putaran dan geseran SKEMATIK (tetap, bukan hitungan):
 *
 * - terguling: FS guling < 1, artinya resultan lewat di luar ujung kaki.
 *   Badan berputar di ujung kaki (B, 0) ke hilir, tumit terangkat.
 * - bergeser: FS geser < 1. Badan bergeser mendatar ke hilir di dasarnya.
 *
 * FS di antara 1 dan syarat lembar (1,5) bukan kegagalan: badan masih
 * diam, hanya cadangannya kurang. Di situ tidak ada phantom.
 */

/** Sudut putaran skematik saat terguling, derajat. */
export const DAM_TILT_DEG = 4;
/** Geseran skematik saat bergeser, bagian lebar dasar. */
export const DAM_SLIDE_FRACTION = 0.06;

export type DamFailureMode = "guling" | "geser" | null;

/** Cara gagal yang digambar: guling didahulukan bila keduanya. */
export function damFailureMode(fsOverturning: number, fsSliding: number, sumV: number): DamFailureMode {
  if (!(sumV > 0)) return null;
  if (fsOverturning < 1) return "guling";
  if (fsSliding < 1) return "geser";
  return null;
}

/**
 * Titik badan pada posisi gagal (garis tertutup: titik pertama diulang di
 * akhir). Putaran searah jarum jam di bidang x ke hilir, z ke atas.
 */
export function damFailedOutline(
  section: readonly { x: number; z: number }[],
  B: number,
  mode: Exclude<DamFailureMode, null>
): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  if (mode === "guling") {
    const th = (DAM_TILT_DEG * Math.PI) / 180;
    const c = Math.cos(th);
    const s = Math.sin(th);
    for (const p of section) {
      const dx = p.x - B;
      out.push({ x: B + dx * c + p.z * s, z: -dx * s + p.z * c });
    }
  } else {
    const d = DAM_SLIDE_FRACTION * B;
    for (const p of section) out.push({ x: p.x + d, z: p.z });
  }
  if (out.length) out.push({ ...out[0] });
  return out;
}
