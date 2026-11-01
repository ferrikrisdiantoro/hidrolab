/**
 * ARAH PANDANG GAMBAR 3D (D1 Phase 3), bagian murni tanpa React.
 *
 * Gambar 3D HidroLab diputar oleh pengguna saja: seret di area kosong
 * gambar, tombol panah, atau tombol panah papan ketik. Tidak ada putar
 * otomatis dan tidak ada transisi beranimasi: sudut berubah tepat sebesar
 * tindakan pengguna, jadi tiap bingkai adalah gambar teknik yang bisa
 * dibaca, bukan gerak hias.
 *
 * Satuan radian. yaw dan pitch berarti sama dengan Kamera di proyeksi.ts.
 */

export type Pandangan = { yaw: number; pitch: number };

const DEG = Math.PI / 180;

/**
 * Sudut angkat dijepit 10°..80°. Di bawah 10° lantai saluran menipis jadi
 * garis dan balikDiBidangZ kehilangan jawaban; di atas 80° dinding tegak
 * menipis jadi garis dan gambar berubah jadi denah (sudah ada di tampak
 * 2D). Ini batas pandangan, bukan pemotongan nilai fisik, jadi tidak
 * perlu penanda "dibatasi ke"; tombol yang menabrak batas dinonaktifkan.
 */
export const PITCH_MIN = 10 * DEG;
export const PITCH_MAX = 80 * DEG;

/** Satu tekan tombol atau tombol panah papan ketik. */
export const LANGKAH = 15 * DEG;
/** Seret: radian per piksel CSS (setengah derajat). */
export const PER_PIKSEL = 0.5 * DEG;

export function jepitPitch(p: number): number {
  if (!Number.isFinite(p)) return PITCH_MIN;
  return Math.min(PITCH_MAX, Math.max(PITCH_MIN, p));
}

/** yaw dibungkus ke (−π, π] supaya angka sudut yang tampil tetap pendek. */
export function bungkusYaw(y: number): number {
  if (!Number.isFinite(y)) return 0;
  let v = y % (2 * Math.PI);
  if (v <= -Math.PI) v += 2 * Math.PI;
  else if (v > Math.PI) v -= 2 * Math.PI;
  return v;
}

/** Putar sejauh (dyaw, dpitch) lalu bungkus dan jepit. */
export function putarPandangan(p: Pandangan, dyaw: number, dpitch: number): Pandangan {
  return { yaw: bungkusYaw(p.yaw + dyaw), pitch: jepitPitch(p.pitch + dpitch) };
}

/**
 * Seret sejauh (dx, dy) piksel layar. Geser ke kanan memutar benda ke
 * kanan (seperti memegang meja putar): pengamat bergerak ke kiri, yaw
 * berkurang. Geser ke bawah menarik pengamat naik melihat dari atas.
 */
export function seretPandangan(p: Pandangan, dx: number, dy: number): Pandangan {
  return putarPandangan(p, -dx * PER_PIKSEL, dy * PER_PIKSEL);
}

/** Tombol panah papan ketik → perubahan sudut, null bila bukan tombol panah. */
export function tombolPanah(key: string, besar = false): { dyaw: number; dpitch: number } | null {
  const s = besar ? 3 * LANGKAH : LANGKAH;
  switch (key) {
    case "ArrowLeft":
      return { dyaw: s, dpitch: 0 };
    case "ArrowRight":
      return { dyaw: -s, dpitch: 0 };
    case "ArrowUp":
      return { dyaw: 0, dpitch: s };
    case "ArrowDown":
      return { dyaw: 0, dpitch: -s };
    default:
      return null;
  }
}

/** Derajat bulat untuk dibaca di layar; tidak pernah menulis −0. */
export function derajat(r: number): number {
  const d = Math.round(r / DEG);
  return d === 0 ? 0 : d;
}

/** Sama dengan pandangan awal dalam setengah derajat. */
export function samaPandangan(a: Pandangan, b: Pandangan): boolean {
  return Math.abs(bungkusYaw(a.yaw - b.yaw)) < 0.5 * DEG && Math.abs(a.pitch - b.pitch) < 0.5 * DEG;
}
