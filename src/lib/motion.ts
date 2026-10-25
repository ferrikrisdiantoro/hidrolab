import { C, W } from "./theme.ts";
import type { PlateMap } from "./plateOut.ts";

/**
 * Partikel lapis gerak.
 *
 * Aturan yang mengikat berkas ini: gerak adalah data. Partikel dimajukan
 * dengan kecepatan dari model (m/s) dalam koordinat fisik (m), dan panjang
 * goresan sebanding dengan kecepatan itu, seperti jejak foto berpajanan
 * lama. Tidak ada gerak hias.
 *
 * Semua larik dialokasikan sekali di createPool. advect dan drawStreaks
 * tidak membuat objek baru per frame, supaya pengumpul sampah tidak
 * memotong animasi 60 fps.
 */
export type Pool = {
  n: number;
  /** Posisi mendatar, m */
  x: Float32Array;
  /** Posisi tegak, m */
  y: Float32Array;
  /** Umur sejak terakhir lahir, detik waktu fisik */
  age: Float32Array;
  /** Bilangan acak tetap per partikel, 0..1 */
  seed: Float32Array;
  /** Kecepatan mendatar pada langkah advect terakhir, m/s */
  u: Float32Array;
  /** Kecepatan tegak pada langkah advect terakhir, m/s */
  v: Float32Array;
};

/** Domain fisik partikel, m. */
export type Domain = { x0: number; x1: number; y0: number; y1: number };

/**
 * Medan kecepatan. Tulis komponen ke out[0] (u, m/s) dan out[1] (v, m/s).
 * Memakai larik keluaran, bukan mengembalikan objek, supaya tanpa alokasi.
 */
export type VelocityField = (x: number, y: number, out: Float32Array) => void;

/** Menempatkan ulang partikel i yang keluar domain. */
export type Respawn = (p: Pool, i: number, dom: Domain) => void;

const PHI = 0.6180339887498949;

/**
 * Pool n partikel tersebar rata semu (urutan golden ratio) di domain
 * satuan; posisi diisi lewat `scatter` atau respawn pertama.
 */
export function createPool(n: number): Pool {
  const p: Pool = {
    n,
    x: new Float32Array(n),
    y: new Float32Array(n),
    age: new Float32Array(n),
    seed: new Float32Array(n),
    u: new Float32Array(n),
    v: new Float32Array(n),
  };
  for (let i = 0; i < n; i++) p.seed[i] = (i * 0.7548776662) % 1;
  return p;
}

/** Sebar partikel merata semu ke seluruh domain (keadaan awal). */
export function scatter(p: Pool, dom: Domain): void {
  const wx = dom.x1 - dom.x0;
  const wy = dom.y1 - dom.y0;
  for (let i = 0; i < p.n; i++) {
    p.x[i] = dom.x0 + ((i + 0.5) / p.n) * wx;
    p.y[i] = dom.y0 + ((i * PHI) % 1) * wy;
    p.age[i] = 0;
  }
}

/**
 * Respawn bawaan: lahir di tepi hulu (x0 untuk aliran ke kanan, x1 untuk
 * aliran ke kiri), tinggi dari seed yang digeser golden ratio supaya
 * jalurnya tidak berulang. Deterministik, tanpa Math.random.
 */
export const respawnInlet: Respawn = (p, i, dom) => {
  const s = (p.seed[i] + PHI) % 1;
  p.seed[i] = s;
  p.x[i] = p.u[i] < 0 ? dom.x1 : dom.x0;
  p.y[i] = dom.y0 + s * (dom.y1 - dom.y0);
  p.age[i] = 0;
};

const vel = new Float32Array(2);

/**
 * Memajukan semua partikel satu langkah Euler: x += u·dt, y += v·dt.
 * Kecepatan disimpan di p.u, p.v untuk drawStreaks. Partikel yang keluar
 * domain dilahirkan ulang lewat `respawn`.
 */
export function advect(
  p: Pool,
  u: VelocityField,
  dt: number,
  dom: Domain,
  respawn: Respawn = respawnInlet
): void {
  for (let i = 0; i < p.n; i++) {
    const x = p.x[i];
    const y = p.y[i];
    vel[0] = 0;
    vel[1] = 0;
    u(x, y, vel);
    p.u[i] = vel[0];
    p.v[i] = vel[1];
    const nx = x + vel[0] * dt;
    const ny = y + vel[1] * dt;
    p.age[i] += dt;
    // Ditulis terbalik supaya NaN dari medan ikut lahir ulang.
    if (!(nx >= dom.x0 && nx <= dom.x1 && ny >= dom.y0 && ny <= dom.y1)) {
      respawn(p, i, dom);
    } else {
      p.x[i] = nx;
      p.y[i] = ny;
    }
  }
}

export type StreakOptions = {
  /**
   * Panjang goresan per satuan kecepatan, m per (m/s) = detik pajanan.
   * Goresan = jejak partikel selama `lenPerMps` detik terakhir.
   */
  lenPerMps: number;
  /** Bawaan C.water: goresan aliran selalu biru air */
  color?: string;
  /** Bawaan W.hair */
  width?: number;
  /** Bawaan 0,34 seperti goresan OC-01 */
  alpha?: number;
  /** Panjang terpendek di layar, px, agar partikel lambat tetap tampak */
  minPx?: number;
  /**
   * Potong ke badan air: Path2D, atau poligon piksel x0,y0,x1,y1,...
   * (PlateOut.water).
   */
  clip?: Path2D | ArrayLike<number>;
};

/** Menelusuri poligon piksel x0,y0,x1,y1,... sebagai path terbuka. */
export function tracePolygon(
  ctx: CanvasRenderingContext2D,
  pts: ArrayLike<number>
): void {
  ctx.beginPath();
  for (let k = 0; k + 1 < pts.length; k += 2) {
    if (k === 0) ctx.moveTo(pts[k], pts[k + 1]);
    else ctx.lineTo(pts[k], pts[k + 1]);
  }
  ctx.closePath();
}

/**
 * Menggambar goresan: dari posisi partikel mundur sepanjang kecepatannya
 * selama `lenPerMps` detik. Satu path, satu stroke untuk semua partikel.
 */
export function drawStreaks(
  ctx: CanvasRenderingContext2D,
  p: Pool,
  map: PlateMap,
  opts: StreakOptions
): void {
  const L = opts.lenPerMps;
  const minPx = opts.minPx ?? 1;
  ctx.save();
  if (opts.clip) {
    if (typeof Path2D !== "undefined" && opts.clip instanceof Path2D) {
      ctx.clip(opts.clip);
    } else {
      tracePolygon(ctx, opts.clip as ArrayLike<number>);
      ctx.clip();
    }
  }
  ctx.lineWidth = opts.width ?? W.hair;
  ctx.strokeStyle = opts.color ?? C.water;
  ctx.globalAlpha = opts.alpha ?? 0.34;
  ctx.setLineDash([]);
  ctx.lineCap = "butt";
  ctx.beginPath();
  for (let i = 0; i < p.n; i++) {
    const hx = map.X(p.x[i]);
    const hy = map.Y(p.y[i]);
    let tx = map.X(p.x[i] - p.u[i] * L);
    let ty = map.Y(p.y[i] - p.v[i] * L);
    const dx = hx - tx;
    const dy = hy - ty;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < minPx) {
      // Terlalu pendek untuk terlihat: tampilkan minPx searah aliran,
      // atau mendatar bila partikel diam.
      const k = len > 1e-6 ? minPx / len : 0;
      tx = k ? hx - dx * k : hx - minPx;
      ty = k ? hy - dy * k : hy;
    }
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
  }
  ctx.stroke();
  ctx.restore();
}
