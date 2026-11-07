import { C, DASH, F, W } from "./theme.ts";
import { pen } from "./plate.ts";
import { anchor3, arahPandang, type Kamera, type Muka, type V3 } from "./proyeksi.ts";

/**
 * Bantuan kecil bersama gambar isometrik saluran (FM-04, EH-02).
 *
 * Saluran digambar dengan DINDING SISI DEKAT DIBUANG: bidang potong di muka
 * dalam dinding itu memperlihatkan lantai (arsir beton) dan air (arsir air)
 * seperti potongan memanjang 2D lembar yang sama, jadi tampak 3D dan
 * potongan dibaca dengan cara yang sama. Sisi mana yang dekat bergantung
 * arah pandang; penggambar membangun dua varian muka (sekali per masukan)
 * dan memilih satu per bingkai tanpa alokasi.
 */

/** Sisi saluran (tanda y) yang menghadap pengamat: −1 bila pengamat di −y. */
export function sisiDekat(k: Kamera): -1 | 1 {
  return arahPandang(k)[1] >= 0 ? -1 : 1;
}

/** Garis dua titik sebagai muka tanpa isi (gambarMuka menutup jalur bolak-balik). */
export function garis(
  a: V3,
  b: V3,
  warna: string,
  bobot: number,
  lapis: number,
  dash: readonly number[] = DASH.solid
): Muka {
  return { pts: [a, b], isi: null, garis: warna, bobot, lapis, dash };
}

/**
 * Stasiun gabungan terurut tanpa kembar (toleransi relatif 1e-12 panjang),
 * ditambah pembagian rata supaya tidak ada ruas lebih panjang dari L/nMin.
 * Muka panjang dipecah per stasiun: urutan painter's per titik berat hanya
 * benar untuk muka pendek.
 */
export function stasiunGabung(xs: readonly number[], L: number, nMin: number): number[] {
  const semua = [...xs];
  for (let i = 0; i <= nMin; i++) semua.push((L * i) / nMin);
  semua.sort((a, b) => a - b);
  const tol = Math.max(L, 1e-9) * 1e-12;
  const out: number[] = [];
  for (const x of semua) {
    if (x < -tol || x > L + tol) continue;
    if (out.length === 0 || x - out[out.length - 1] > tol) out.push(Math.min(Math.max(x, 0), L));
  }
  return out;
}

/** Interpolasi linear polyline {x, z} di x (seperti garis yang digambar 2D). */
export function zPolyline(pts: readonly { x: number; z: number }[], x: number): number {
  if (pts.length === 0) return NaN;
  if (x <= pts[0].x) return pts[0].z;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (x <= b.x) {
      if (b.x - a.x < 1e-15) return b.z;
      return a.z + ((b.z - a.z) * (x - a.x)) / (b.x - a.x);
    }
  }
  return pts[pts.length - 1].z;
}

/**
 * Tulisan dengan garis penunjuk ke titik dunia P, lewat createLabelPlacer
 * (tidak bertumpuk dengan tulisan lain). Alas kertas selebar huruf biasa,
 * tanpa stensil supaya simbol (h₁, yc, Fr) tidak dikapitalkan.
 */
export function tulisPenunjuk(
  ctx: CanvasRenderingContext2D,
  placer: {
    place: (
      t: string,
      x: number,
      y: number,
      spacing: number,
      align?: CanvasTextAlign
    ) => { x: number; y: number; atas: number; bawah: number };
  },
  teks: string,
  P: V3,
  k: Kamera,
  dx: number,
  dy: number,
  warna: string,
  w: number
) {
  const A = anchor3(P, k);
  const kanan = dx >= 0 ? A.x + dx < w * 0.8 : A.x + dx < w * 0.2;
  const pos = placer.place(teks, A.x + (kanan ? Math.abs(dx) : -Math.abs(dx)), A.y + dy, 1.4, kanan ? "left" : "right");
  ctx.font = F.label;
  const lebar = ctx.measureText(teks).width + 6;
  ctx.fillStyle = C.sheet;
  ctx.fillRect(kanan ? pos.x - 3 : pos.x - lebar + 3, pos.atas, lebar, pos.bawah - pos.atas);
  pen(ctx, W.thin, warna, DASH.solid);
  ctx.beginPath();
  ctx.moveTo(A.x, A.y);
  ctx.lineTo(kanan ? pos.x - 3 : pos.x + 3, pos.y);
  ctx.stroke();
  ctx.fillStyle = warna;
  ctx.beginPath();
  ctx.arc(A.x, A.y, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = F.label;
  ctx.textAlign = kanan ? "left" : "right";
  ctx.textBaseline = "middle";
  ctx.fillText(teks, pos.x, pos.y);
}

/**
 * Prisma dari poligon CEMBUNG di bidang xz (potongan memanjang), disapu
 * melintang dari y0 ke y1. Normal tiap muka diarahkan keluar dari titik
 * berat benda, jadi urutan titik masukan bebas.
 */
export function prismaY(
  alas: readonly { x: number; z: number }[],
  y0: number,
  y1: number,
  gaya: Omit<Muka, "pts"> = {}
): { sisi0: Muka; sisi1: Muka; selubung: Muka[] } {
  const n = alas.length;
  let cx = 0, cz = 0;
  for (const p of alas) {
    cx += p.x;
    cz += p.z;
  }
  cx /= n;
  cz /= n;
  const cy = (y0 + y1) / 2;
  const arahkan = (pts: V3[]): Muka => {
    // Newell, lalu bandingkan dengan arah dari titik berat benda.
    let nx = 0, ny = 0, nz = 0, mx = 0, my = 0, mz = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
      mx += a[0];
      my += a[1];
      mz += a[2];
    }
    const k = pts.length;
    const d = nx * (mx / k - cx) + ny * (my / k - cy) + nz * (mz / k - cz);
    return { ...gaya, pts: d < 0 ? pts.slice().reverse() : pts };
  };
  const sisi0 = arahkan(alas.map((p) => [p.x, y0, p.z] as V3));
  const sisi1 = arahkan(alas.map((p) => [p.x, y1, p.z] as V3));
  const selubung: Muka[] = [];
  for (let i = 0; i < n; i++) {
    const a = alas[i];
    const b = alas[(i + 1) % n];
    selubung.push(arahkan([[a.x, y0, a.z], [b.x, y0, b.z], [b.x, y1, b.z], [a.x, y1, a.z]]));
  }
  return { sisi0, sisi1, selubung };
}

/**
 * Tinggi/lebar kotak batas terproyeksi (untuk tinggi bidang gambar di HP,
 * sama dengan rasioIsoLabirin).
 */
export function rasioBatas(batas: { min: V3; max: V3 }, yaw: number, pitch: number): number {
  const k: Kamera = { yaw, pitch, skala: 1, cx: 0, cy: 0 };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const p = anchor3(
      [i & 1 ? batas.max[0] : batas.min[0], i & 2 ? batas.max[1] : batas.min[1], i & 4 ? batas.max[2] : batas.min[2]],
      k
    );
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  return x1 - x0 > 0 ? (y1 - y0) / (x1 - x0) : 1;
}
