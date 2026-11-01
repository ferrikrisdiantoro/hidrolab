import type { PlateMap } from "./plateOut.ts";

/**
 * Latar zona berwarna di atas bidang grafik yang SUDAH digambar drawChart.
 *
 * drawChart dipakai banyak lembar dan sedang dikerjakan penulis lain, jadi
 * zona tidak ditambahkan ke dalamnya. Lembar menggambar zona sesudah
 * drawChart lewat PlateOut.map, dengan campuran "multiply": isian pucat
 * dari token *Fill dikalikan dengan apa yang sudah ada. Di atas kertas
 * hasilnya sama dengan latar berwarna di belakang kisi; di atas tinta
 * (kurva, angka, tulisan) perubahannya tidak terlihat karena tinta hampir
 * hitam. Kisi, kurva, dan tulisan karena itu tetap terbaca di dalam zona.
 *
 * Zona selalu dipotong ke bingkai bidang (map.frame), jadi tidak pernah
 * menembus sumbu dan angka sumbu.
 *
 * Warna yang dipakai harus token isian bernama dari theme.ts (waterFill,
 * criticalFill, passFill, ...), berpasangan dengan garis berwarna penuh
 * dari kata yang sama di bidang itu. Isian tidak pernah menjadi
 * satu-satunya penanda zona.
 */

type Pt = { x: number; y: number };

function clipFrame(ctx: CanvasRenderingContext2D, map: PlateMap) {
  const f = map.frame;
  ctx.beginPath();
  ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
  ctx.clip();
}

/**
 * Isi daerah di atas atau di bawah sebuah kurva (titik dalam satuan sumbu,
 * urut menurut x) sampai tepi bingkai.
 */
export function tintCurveSide(
  ctx: CanvasRenderingContext2D,
  map: PlateMap,
  pts: readonly Pt[],
  side: "above" | "below",
  color: string
): void {
  if (pts.length < 2) return;
  const f = map.frame;
  const tepi = side === "above" ? f.y0 - 2 : f.y1 + 2;
  ctx.save();
  clipFrame(ctx, map);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = color;
  ctx.beginPath();
  const xa = map.X(pts[0].x);
  ctx.moveTo(xa, tepi);
  for (const p of pts) {
    const yy = map.Y(p.y);
    // Nilai tak hingga (kurva lepas sumbu log) dijepit di luar bingkai.
    ctx.lineTo(map.X(p.x), Number.isFinite(yy) ? Math.min(Math.max(yy, f.y0 - 4), f.y1 + 4) : tepi);
  }
  ctx.lineTo(map.X(pts[pts.length - 1].x), tepi);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Isi pita tegak antara dua nilai sumbu mendatar, setinggi bingkai. */
export function tintBandX(
  ctx: CanvasRenderingContext2D,
  map: PlateMap,
  from: number,
  to: number,
  color: string
): void {
  const f = map.frame;
  const a = map.X(Math.min(from, to));
  const b = map.X(Math.max(from, to));
  if (!(b > a)) return;
  ctx.save();
  clipFrame(ctx, map);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = color;
  ctx.fillRect(a, f.y0, b - a, f.y1 - f.y0);
  ctx.restore();
}
