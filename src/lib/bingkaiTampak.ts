import type { PlateMap } from "./plateOut";

/**
 * Banyaknya titik (koordinat fisik) yang jatuh di luar bingkai yang benar-
 * benar tergambar. Dipakai lembar yang membandingkan titik taruhan dengan
 * bidang gambar: bidang nominal bisa lebih sempit daripada bingkai bila
 * penggambar memakai skala sama di kedua sumbu (drawField), jadi
 * pembandingnya harus bingkai piksel. Toleransi setengah piksel, sama
 * dengan uji di dalam bingkai milik drawField.
 */
export function hitungDiLuarBingkai(
  pts: readonly { x: number; y: number }[],
  map: Pick<PlateMap, "X" | "Y" | "frame">
): number {
  const f = map.frame;
  let n = 0;
  for (const p of pts) {
    const x = map.X(p.x);
    const y = map.Y(p.y);
    if (!(x >= f.x0 - 0.5 && x <= f.x1 + 0.5 && y >= f.y0 - 0.5 && y <= f.y1 + 0.5)) n++;
  }
  return n;
}
