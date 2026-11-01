import { C, W } from "./theme.ts";
import { drawJet, finishJetPath, jetKeyChanged, jetTransitTime, type JetMotion, type JetPath } from "./jetMotion.ts";
import type { PlateMap, PlateOut, PlateRect } from "./plateOut.ts";

/**
 * LAPIS GERAK DAN SKALA MOBIL GORONG-GORONG (HS-04, batch B3).
 *
 * Gerak: goresan air di dalam pipa, HANYA bila model menyatakan pipanya
 * mengalir penuh di bawah kendali sisi keluar. Di situ kecepatan rata-rata
 * penampang tepat V = Q/A pipa penuh (culvert().velocity), jadi butir
 * mengisi seluruh diameter dan melaju dengan V itu. Di bawah kendali sisi
 * masuk pipanya mengalir sebagian sesudah mulut (HDS-5), kedalaman dan
 * lajunya di dalam pipa tidak dihitung model, jadi tidak ada gerak yang
 * bisa digambar dari hitungan. Begitu pula saat jalan dilimpasi: hitungan
 * lembar tidak berlaku lagi.
 *
 * Mobil: tanda skala tegak di punggung timbunan, tinggi 1,5 m pada skala
 * tegak gambar. Potongan ini memanjang searah pipa, jadi jalannya memotong
 * bidang gambar tegak lurus: mobil di jalan terlihat dari belakang, bukan
 * dari samping. Lebarnya TIDAK menurut skala mendatar (sumbu tegak gambar
 * dilebihkan berkali-kali); perbandingan lebar dan tinggi mobil sungguhan
 * (1,8 : 1,5) dipakai bila punggung jalannya cukup lebar di layar, dan
 * dipersempit sampai batas yang masih terbaca sebagai mobil bila tidak.
 */

/** Tinggi mobil penumpang yang dipakai sebagai skala, m. */
export const CAR_HEIGHT = 1.5;
/** Lebar gambar mobil terhadap tingginya (tampak belakang): sebenarnya dan paling sempit. */
const CAR_ASPECT_MAX = 1.2;
const CAR_ASPECT_MIN = 0.7;

/** Lajur butir: bagian diameter dari dasar, supaya tidak menempel dinding. */
export const CULVERT_LANE0 = 0.06;
export const CULVERT_LANE1 = 0.94;

export type CulvertMotionState = {
  /** Panjang pipa, m */
  L: number;
  /** Kemiringan dasar */
  S: number;
  /** Diameter, m */
  D: number;
  /** Kecepatan rata-rata pipa penuh dari model, m/s */
  V: number;
};

/**
 * Lintasan lurus sepanjang dasar pipa dari mulut (x = 0, z = 0) ke ujung
 * keluar (x = L, z = −S·L); lajur tegak dari dasar. Laju tetap V di
 * sepanjang pipa (penampang tetap, kontinuitas). Mengembalikan V.
 */
export function fillCulvertPath(path: JetPath, s: CulvertMotionState): number {
  path.n = 0;
  if (!(s.L > 0) || !(s.D > 0) || !(s.V > 0)) return 0;
  path.x[0] = 0;
  path.z[0] = 0;
  path.x[1] = s.L;
  path.z[1] = -s.S * s.L;
  for (let k = 0; k < 2; k++) {
    path.v[k] = s.V;
    path.off0[k] = CULVERT_LANE0 * s.D;
    path.off1[k] = CULVERT_LANE1 * s.D;
  }
  path.n = 2;
  return finishJetPath(path);
}

/** Waktu tempuh fisik seluruh pipa, s: L√(1+S²)/V. */
export function culvertTransitTime(s: CulvertMotionState): number {
  if (!(s.L > 0) || !(s.V > 0)) return 0;
  return (s.L * Math.sqrt(1 + s.S * s.S)) / s.V;
}

/** Rongga pipa dalam piksel (x0,y0,...), untuk memotong goresan. */
const rongga = new Float64Array(8);

/**
 * Lapis gerak HS-04. `t` waktu fisik. `fishBarrier`: goresan ungu kritis,
 * sama dengan panah diam yang digantikannya (kecepatan di atas batas ikan).
 */
export function drawCulvertMotion(
  ctx: CanvasRenderingContext2D,
  t: number,
  out: PlateOut | null,
  s: CulvertMotionState & { fishBarrier: boolean },
  m: JetMotion
): void {
  if (!out) return;
  if (jetKeyChanged(m, s.L, s.S, s.D, s.V)) m.vMax = fillCulvertPath(m.path, s);
  if (!(jetTransitTime(m.path) > 0)) return;
  const map = out.map;
  const f = map.frame;
  const zK = -s.S * s.L;
  rongga[0] = map.X(0);
  rongga[1] = map.Y(0);
  rongga[2] = map.X(s.L);
  rongga[3] = map.Y(zK);
  rongga[4] = map.X(s.L);
  rongga[5] = map.Y(zK + s.D);
  rongga[6] = map.X(0);
  rongga[7] = map.Y(s.D);
  // Sumbu tegak dilebihkan: drawJet membatasi goresan dengan skala
  // terbesar, jadi goresan mendatar di sini diperpanjang sebanding.
  const sx = Math.abs(map.X(1) - map.X(0)) || 1;
  const sy = Math.abs(map.Y(1) - map.Y(0)) || 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
  ctx.clip();
  drawJet(ctx, m, map, t, {
    pxMax: 20 * (Math.max(sx, sy) / sx),
    color: s.fishBarrier ? C.critical : C.water,
    clip: rongga,
  });
  ctx.restore();
}

/** Kotak gambar mobil dalam piksel, atau null bila tidak muat. */
export type CarBox = { x: number; y: number; w: number; h: number };

/**
 * Letak mobil di punggung timbunan: posisi paling kiri di punggung jalan
 * yang tidak menyentuh tulisan mana pun yang sudah ditempatkan penggambar
 * (`labels`, termasuk nama "permukaan jalan"). Tinggi = CAR_HEIGHT pada
 * skala tegak. Null bila punggung jalannya terlalu sempit di layar atau
 * semua tempat tertutup tulisan.
 */
export function carBox(
  map: PlateMap,
  roadX0: number,
  roadX1: number,
  roadZ: number,
  labels: readonly PlateRect[] = []
): CarBox | null {
  const x0 = map.X(roadX0);
  const x1 = map.X(roadX1);
  const R = x1 - x0;
  const yJalan = map.Y(roadZ);
  const h = Math.abs(map.Y(roadZ + CAR_HEIGHT) - yJalan);
  if (!(R > 0) || !(h > 0)) return null;
  const w = Math.min(CAR_ASPECT_MAX * h, 0.9 * R);
  if (!(w >= CAR_ASPECT_MIN * h)) return null;
  const f = map.frame;
  // Mobil yang menembus bingkai atas tidak digambar (jalan di dekat tepi).
  if (yJalan - h < f.y0) return null;
  const y = yJalan - h;
  const jarak = 3;
  const kena = (kiri: number) =>
    labels.some(
      (r) =>
        kiri - jarak < r.x + r.w &&
        kiri + w + jarak > r.x &&
        y - jarak < r.y + r.h &&
        y + h + jarak > r.y
    );
  for (let kiri = x0 + 0.05 * R; kiri + w <= x1 - 0.05 * R + 1e-9 && kiri + w <= f.x1; kiri += 4) {
    if (!kena(kiri)) return { x: kiri, y, w, h };
  }
  return null;
}

/**
 * Siluet mobil tampak belakang: kabin, kaca belakang, badan, lampu,
 * bemper, dua roda. Garis tipis tinta, isi kertas supaya kisi dan arsiran
 * timbunan di belakangnya tidak tembus; roda diisi tinta.
 */
export function drawCar(ctx: CanvasRenderingContext2D, b: CarBox): void {
  const { x, y, w, h } = b;
  const yPinggang = y + h * 0.42;
  const yAlas = y + h * 0.86;
  const cham = Math.min(w, h) * 0.06;
  ctx.save();
  ctx.setLineDash([]);
  ctx.lineWidth = W.thin;
  ctx.strokeStyle = C.ink2;
  ctx.lineJoin = "round";
  // Roda: hanya bagian bawahnya yang terlihat di bawah badan.
  ctx.fillStyle = C.ink2;
  ctx.fillRect(x + w * 0.08, yAlas - 1, w * 0.17, y + h - yAlas + 1);
  ctx.fillRect(x + w * 0.75, yAlas - 1, w * 0.17, y + h - yAlas + 1);
  ctx.fillStyle = C.sheet;
  // Kabin.
  ctx.beginPath();
  ctx.moveTo(x + w * 0.07, yPinggang);
  ctx.lineTo(x + w * 0.2, y);
  ctx.lineTo(x + w * 0.8, y);
  ctx.lineTo(x + w * 0.93, yPinggang);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Badan.
  ctx.beginPath();
  ctx.moveTo(x + cham, yPinggang);
  ctx.lineTo(x + w - cham, yPinggang);
  ctx.lineTo(x + w, yPinggang + cham);
  ctx.lineTo(x + w, yAlas);
  ctx.lineTo(x, yAlas);
  ctx.lineTo(x, yPinggang + cham);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Kaca belakang, lampu, bemper.
  ctx.beginPath();
  ctx.moveTo(x + w * 0.17, yPinggang - h * 0.05);
  ctx.lineTo(x + w * 0.26, y + h * 0.07);
  ctx.lineTo(x + w * 0.74, y + h * 0.07);
  ctx.lineTo(x + w * 0.83, yPinggang - h * 0.05);
  ctx.closePath();
  ctx.rect(x + w * 0.06, yPinggang + h * 0.08, w * 0.14, h * 0.09);
  ctx.rect(x + w * 0.8, yPinggang + h * 0.08, w * 0.14, h * 0.09);
  ctx.moveTo(x, y + h * 0.72);
  ctx.lineTo(x + w, y + h * 0.72);
  ctx.stroke();
  ctx.restore();
}
