import { C, DASH, W } from "./theme.ts";
import { hatchConcrete, hatchSoil, hatchWater, pen } from "./plate.ts";
import type { PlateAnchor, PlateFrame, PlateOut } from "./plateOut.ts";

/**
 * PROYEKSI 3D DI KANVAS 2D (D0 Phase 3).
 *
 * Gambar 3D HidroLab tetap lembar gambar teknik: proyeksi ORTOGRAFIS
 * (garis sejajar tetap sejajar, ukuran bisa dibaca di mana pun di gambar),
 * bukan perspektif, dan bukan pemandangan bercahaya. Karena itu tidak
 * dipakai three.js: tiga bobot garis, arsir, dan PlateAnchor untuk
 * DragLayer tetap satu jalur dengan plate.ts.
 *
 * Koordinat dunia (meter): x searah aliran, y melintang, z ELEVASI (naik).
 *
 * Kamera:
 * - yaw memutar arah pandang mengelilingi sumbu z. yaw 0 = tampak depan,
 *   pengamat di sisi −y memandang ke +y, x ke kanan layar
 * - pitch mengangkat pengamat. pitch 0 = tampak depan mendatar,
 *   pitch π/2 = tampak atas
 * - ISO = isometrik baku (yaw 45°, pitch 35,26°): ketiga sumbu sama panjang
 *   di layar, pengamat di pojok −x −y
 *
 * `proyeksi` mengembalikan z = KEDALAMAN: jarak sepanjang arah pandang
 * (meter, makin besar makin jauh). Painter's algorithm menggambar muka
 * dari kedalaman rata-rata terbesar ke terkecil.
 *
 * Batas painter's algorithm yang disadari: urutan per muka dari titik
 * beratnya benar untuk benda prismatik yang tidak saling menembus dan
 * untuk permukaan kisi; dua muka panjang yang saling menyilang bisa salah
 * urut. Penggambar lembar memecah dinding panjang menjadi ruas pendek.
 */

export type V3 = readonly [number, number, number];

export type Kamera = {
  /** Putaran mengelilingi sumbu z, radian */
  yaw: number;
  /** Sudut angkat pengamat, radian (0 = mendatar, π/2 = dari atas) */
  pitch: number;
  /** Piksel CSS per meter */
  skala: number;
  /** Piksel layar tempat titik asal dunia jatuh */
  cx: number;
  cy: number;
};

/** Isometrik baku: yaw 45°, pitch atan(1/√2) ≈ 35,26°. */
export const ISO = { yaw: Math.PI / 4, pitch: Math.atan(Math.SQRT1_2) } as const;

/**
 * Benar bila pandangan ini isometrik baku: angkat 35,26° dan arah 45° +
 * k·90° (ketiga sumbu sama pendek di layar). Sudut lain aksonometri umum;
 * judul gambar tidak boleh lagi menyebutnya isometrik.
 */
export function isometrikBaku(yaw: number, pitch: number, tol = 1e-6): boolean {
  if (Math.abs(pitch - ISO.pitch) > tol) return false;
  const q = Math.PI / 2;
  const r = (((yaw - ISO.yaw) % q) + q) % q; // 0..q
  return r < tol || q - r < tol;
}

/** Bahan muka, menentukan pasangan token terang/bayang. */
export type Bahan = "beton" | "air";

export type Muka = {
  /** Titik sudut, BERLAWANAN jarum jam bila dilihat dari sisi luar */
  pts: readonly V3[];
  /** Isian. Tidak diisi = diturunkan dari normal dan bahan; null = tanpa isi */
  isi?: string | null;
  /** Warna garis tepi. Tidak diisi = C.ink; null = tanpa garis */
  garis?: string | null;
  /** Bobot garis, dibulatkan ke W.hair, W.thin, atau W.bold. Bawaan W.bold */
  bobot?: number;
  /** Jenis garis (DASH.*), bawaan solid */
  dash?: readonly number[];
  /**
   * Arsir di dalam muka, memakai pola plate.ts dalam ruang layar.
   * "sinyal" = garis miring rambut merah sinyal, HANYA untuk zona di luar
   * rentang berlaku model (aturan bahasa visual 3).
   */
  arsir?: "beton" | "tanah" | "air" | "sinyal";
  /** Muka yang hanya terlihat dari sisi luarnya; sisi belakang dibuang */
  satuSisi?: boolean;
  /** Bawaan "air" bila arsir air, selain itu "beton" */
  bahan?: Bahan;
  /**
   * Lapis gambar, bawaan 0. Lapis kecil SELALU digambar lebih dulu, baru
   * di dalam satu lapis diurut kedalaman. Untuk muka besar yang menjadi
   * alas segalanya (lantai saluran, muka tanah): titik beratnya bisa lebih
   * dekat ke pengamat daripada benda yang berdiri di atasnya, dan urutan
   * per titik berat lalu menimpa benda itu. Hanya untuk muka yang memang
   * tidak pernah menutupi muka lapis lain dari sudut pandang mana pun yang
   * dipakai lembar (lantai dilihat dari atas, pitch > 0).
   */
  lapis?: number;
};

/* ------------------------------------------------------------------ *
 * Kamera
 * ------------------------------------------------------------------ */

/** Proyeksi satu titik. z = kedalaman (m), makin besar makin jauh. */
export function proyeksi(p: V3, k: Kamera): { x: number; y: number; z: number } {
  const cyw = Math.cos(k.yaw);
  const syw = Math.sin(k.yaw);
  const cp = Math.cos(k.pitch);
  const sp = Math.sin(k.pitch);
  const xr = p[0] * cyw - p[1] * syw;
  const yr = p[0] * syw + p[1] * cyw;
  const up = p[2] * cp + yr * sp;
  return { x: k.cx + k.skala * xr, y: k.cy - k.skala * up, z: yr * cp - p[2] * sp };
}

/** Titik pegangan untuk DragLayer: proyeksi tanpa kedalaman. */
export function anchor3(p: V3, k: Kamera): PlateAnchor {
  const q = proyeksi(p, k);
  return { x: q.x, y: q.y };
}

/** Vektor satuan arah pandang di dunia (dari pengamat ke benda). */
export function arahPandang(k: Kamera): V3 {
  const cp = Math.cos(k.pitch);
  return [Math.sin(k.yaw) * cp, Math.cos(k.yaw) * cp, -Math.sin(k.pitch)];
}

/**
 * Arah cahaya di dunia (dari permukaan ke lampu), tetap terhadap PENGAMAT:
 * dari kiri atas layar, sedikit dari depan. Sama dengan arah cahaya yang
 * ditulis di theme.ts untuk faceLit/faceShade, jadi muka atas selalu
 * terang dan muka kanan yang membelakangi lampu selalu bayang, ke mana pun
 * gambar diputar.
 */
function arahCahaya(k: Kamera, out: Float64Array) {
  const cyw = Math.cos(k.yaw);
  const syw = Math.sin(k.yaw);
  const cp = Math.cos(k.pitch);
  const sp = Math.sin(k.pitch);
  // kanan R, atas U, pandang V
  const R0 = cyw, R1 = -syw, R2 = 0;
  const U0 = syw * sp, U1 = cyw * sp, U2 = cp;
  const V0 = syw * cp, V1 = cyw * cp, V2 = -sp;
  const a = -0.5, b = 0.8, c = -0.45;
  let x = a * R0 + b * U0 + c * V0;
  let y = a * R1 + b * U1 + c * V1;
  let z = a * R2 + b * U2 + c * V2;
  const n = Math.hypot(x, y, z);
  x /= n; y /= n; z /= n;
  out[0] = x; out[1] = y; out[2] = z;
}

/**
 * Kamera yang memuat kotak batas ke kanvas w × h dengan margin (piksel)
 * di keempat sisi, sebesar mungkin, di tengah. Yaw/pitch tetap.
 */
export function kameraPas(
  b: { min: V3; max: V3 },
  w: number,
  h: number,
  yaw: number,
  pitch: number,
  margin = 24
): Kamera {
  const k0: Kamera = { yaw, pitch, skala: 1, cx: 0, cy: 0 };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const p = proyeksi(
      [i & 1 ? b.max[0] : b.min[0], i & 2 ? b.max[1] : b.min[1], i & 4 ? b.max[2] : b.min[2]],
      k0
    );
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  const lw = Math.max(w - 2 * margin, 1);
  const lh = Math.max(h - 2 * margin, 1);
  const bw = x1 - x0;
  const bh = y1 - y0;
  const sx = bw > 1e-12 ? lw / bw : Infinity;
  const sy = bh > 1e-12 ? lh / bh : Infinity;
  let skala = Math.min(sx, sy);
  if (!Number.isFinite(skala)) skala = 1;
  return {
    yaw,
    pitch,
    skala,
    cx: w / 2 - (skala * (x0 + x1)) / 2,
    cy: h / 2 - (skala * (y0 + y1)) / 2,
  };
}

/* ------------------------------------------------------------------ *
 * Balikan piksel ke nilai fisik (untuk toValue DragLayer)
 * ------------------------------------------------------------------ */

/**
 * Titik dunia (x, y) di bidang datar z = z0 yang jatuh di piksel (px, py).
 * Untuk menaruh/menyeret sumur, titik amat, dsb. di permukaan tanah.
 * null bila bidang itu terlihat tepat dari samping (pitch ≈ 0): tidak ada
 * jawaban tunggal, Client tidak memasang pegangan.
 */
export function balikDiBidangZ(
  px: number,
  py: number,
  k: Kamera,
  z0: number
): readonly [number, number] | null {
  const sp = Math.sin(k.pitch);
  if (Math.abs(sp) < 1e-6) return null;
  const xr = (px - k.cx) / k.skala;
  const up = (k.cy - py) / k.skala;
  const yr = (up - z0 * Math.cos(k.pitch)) / sp;
  const c = Math.cos(k.yaw);
  const s = Math.sin(k.yaw);
  return [xr * c + yr * s, -xr * s + yr * c];
}

/**
 * Parameter t titik di garis a→b (t = 0 di a, 1 di b) yang paling dekat ke
 * piksel (px, py) di layar. Proyeksi ortografis bersifat affine, jadi t di
 * layar sama dengan t di dunia. TIDAK dijepit ke [0, 1]: Client menjepit
 * lewat ParamDef penggeser dan memberi penanda "dibatasi ke".
 * Garis yang tegak lurus layar (panjang di layar < 1e-9 px) memberi 0.
 */
export function balikDiGaris(px: number, py: number, k: Kamera, a: V3, b: V3): number {
  const A = proyeksi(a, k);
  const B = proyeksi(b, k);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const L2 = dx * dx + dy * dy;
  if (L2 < 1e-18) return 0;
  return ((px - A.x) * dx + (py - A.y) * dy) / L2;
}

/**
 * PlateOut untuk gambar 3D. Peta bidangnya piksel identitas (gambar 3D
 * tidak punya satu sumbu fisik mendatar dan tegak); pegangan dipasang
 * lewat anchors terproyeksi, dan toValue di Client memakai balikDiBidangZ
 * atau balikDiGaris dengan kamera yang sama.
 */
export function plateOut3(
  k: Kamera,
  w: number,
  h: number,
  anchors: Record<string, V3> = {},
  frame: PlateFrame = { x0: 0, y0: 0, x1: w, y1: h }
): PlateOut {
  const a: Record<string, PlateAnchor> = {};
  for (const key in anchors) a[key] = anchor3(anchors[key], k);
  const id = (v: number) => v;
  return { map: { X: id, Y: id, invX: id, invY: id, frame }, anchors: a };
}

/* ------------------------------------------------------------------ *
 * Muka
 * ------------------------------------------------------------------ */

/** Normal satuan muka (metode Newell), arah tangan kanan dari urutan titik. */
export function normalMuka(pts: readonly V3[]): V3 {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const n = Math.hypot(nx, ny, nz) || 1;
  return [nx / n, ny / n, nz / n];
}

/** Kotak sejajar sumbu: enam muka, normal ke luar. */
export function kotak(min: V3, max: V3, gaya: Omit<Muka, "pts"> = {}): Muka[] {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const f = (...pts: V3[]): Muka => ({ ...gaya, pts });
  return [
    f([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]), // bawah −z
    f([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]), // atas +z
    f([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]), // depan −y
    f([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]), // belakang +y
    f([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]), // kiri −x
    f([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]), // kanan +x
  ];
}

/**
 * Prisma tegak dari denah poligon CEMBUNG berlawanan jarum jam (dilihat
 * dari atas), antara elevasi z0 dan z1. Denah cekung harus dipecah dulu:
 * muka sampingnya tetap benar, tetapi urutan kedalaman bisa salah.
 */
export function prisma(
  alas: readonly { x: number; y: number }[],
  z0: number,
  z1: number,
  gaya: Omit<Muka, "pts"> = {}
): Muka[] {
  const n = alas.length;
  const out: Muka[] = [];
  out.push({ ...gaya, pts: alas.map((p) => [p.x, p.y, z1] as V3) });
  out.push({ ...gaya, pts: alas.map((p) => [p.x, p.y, z0] as V3).reverse() });
  for (let i = 0; i < n; i++) {
    const a = alas[i];
    const b = alas[(i + 1) % n];
    out.push({ ...gaya, pts: [[a.x, a.y, z0], [b.x, b.y, z0], [b.x, b.y, z1], [a.x, a.y, z1]] });
  }
  return out;
}

/**
 * Permukaan z = f(x, y) sebagai nx × ny muka segi empat. Titik kisi
 * dihitung sekali dan dibagi antar muka bertetangga, jadi tidak ada celah.
 * Muka (i, j) ada di indeks j·nx + i, normalnya ke atas (+z).
 * Dua sisi: permukaan terlihat dari bawah juga bila kamera di bawahnya.
 * Dibuat sekali per perubahan masukan, bukan per bingkai.
 */
export function permukaanGrid(
  f: (x: number, y: number) => number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  nx: number,
  ny: number,
  gaya: Omit<Muka, "pts">
): Muka[] {
  const titik: V3[] = new Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) {
    const y = y0 + ((y1 - y0) * j) / ny;
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx;
      titik[j * (nx + 1) + i] = [x, y, f(x, y)];
    }
  }
  const out: Muka[] = new Array(nx * ny);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      out[j * nx + i] = {
        ...gaya,
        pts: [titik[a], titik[a + 1], titik[a + nx + 2], titik[a + nx + 1]],
      };
    }
  return out;
}

/* ------------------------------------------------------------------ *
 * Pencahayaan
 * ------------------------------------------------------------------ */

/*
 * Nada muka: TANGGA_N + 1 anak tangga antara token bayang (anak tangga 0)
 * dan token terang (anak tangga terakhir), dicampur di ruang warna yang
 * sama. Kedua ujung adalah string token itu sendiri, bukan hasil campuran.
 * Anak tangga dibatasi supaya isian tidak berganti tiap muka pada
 * permukaan halus (fillStyle diset hanya bila berubah) dan supaya nada
 * hanya membedakan arah muka, bukan memberi gradasi hias.
 */
const TANGGA_N = 8;
/** Kosinus sudut datang di atas ini dianggap menghadap cahaya penuh. */
const T_TERANG = 0.8;

function urai(c: string): [number, number, number, number] {
  if (c.startsWith("#")) {
    const v = parseInt(c.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 1];
  }
  const m = c.match(/[\d.]+/g)!.map(Number);
  return [m[0], m[1], m[2], m[3] ?? 1];
}

function tangga(bayang: string, terang: string): string[] {
  const a = urai(bayang);
  const b = urai(terang);
  const out: string[] = [];
  for (let i = 0; i <= TANGGA_N; i++) {
    if (i === 0) out.push(bayang);
    else if (i === TANGGA_N) out.push(terang);
    else {
      const t = i / TANGGA_N;
      const r = Math.round(a[0] + (b[0] - a[0]) * t);
      const g = Math.round(a[1] + (b[1] - a[1]) * t);
      const bl = Math.round(a[2] + (b[2] - a[2]) * t);
      const al = +(a[3] + (b[3] - a[3]) * t).toFixed(3);
      out.push(`rgba(${r}, ${g}, ${bl}, ${al})`);
    }
  }
  return out;
}

const NADA: Record<Bahan, string[]> = {
  beton: tangga(C.faceShade, C.faceLit),
  air: tangga(C.waterFaceShade, C.waterFaceLit),
};

function anakTangga(t: number): number {
  if (t <= 0) return 0;
  if (t >= T_TERANG) return TANGGA_N;
  return Math.round((t / T_TERANG) * TANGGA_N);
}

const cahayaTmp = new Float64Array(3);

/**
 * Isian muka dari normalnya (tidak perlu satuan) di bawah kamera k.
 * Muka atas = token terang, muka yang membelakangi cahaya = token bayang.
 */
export function warnaMuka(n: V3, k: Kamera, bahan: Bahan = "beton"): string {
  arahCahaya(k, cahayaTmp);
  const L = Math.hypot(n[0], n[1], n[2]) || 1;
  const t = (n[0] * cahayaTmp[0] + n[1] * cahayaTmp[1] + n[2] * cahayaTmp[2]) / L;
  if (!Number.isFinite(t)) return NADA[bahan][0];
  return NADA[bahan][anakTangga(t)];
}

/* ------------------------------------------------------------------ *
 * Menggambar
 * ------------------------------------------------------------------ */

/*
 * Penyangga bersama, tumbuh bila perlu dan dipakai ulang tiap bingkai:
 * menggambar tidak mengalokasikan objek per muka.
 */
let bufX = new Float64Array(0);
let bufY = new Float64Array(0);
let bufAwal = new Uint32Array(0); // indeks titik pertama tiap muka di bufX/bufY
let bufKunci = new Float64Array(0); // kunci urut naik (lapis, lalu jauh ke dekat)
let bufNada = new Int8Array(0); // anak tangga, −1 = muka dibuang
let bufUrut = new Uint32Array(0);

function siapkan(muka: readonly Muka[]) {
  const n = muka.length;
  let titik = 0;
  for (let i = 0; i < n; i++) titik += muka[i].pts.length;
  if (bufX.length < titik) {
    bufX = new Float64Array(titik * 2);
    bufY = new Float64Array(titik * 2);
  }
  if (bufKunci.length < n) {
    bufAwal = new Uint32Array(n * 2 + 1);
    bufKunci = new Float64Array(n * 2);
    bufNada = new Int8Array(n * 2);
    bufUrut = new Uint32Array(n * 2);
  }
}

/**
 * Proyeksikan, buang muka belakang, urutkan. Hasilnya di penyangga bersama;
 * kembalian = banyaknya muka terlihat di bufUrut[0..m).
 */
function olah(muka: readonly Muka[], k: Kamera): number {
  siapkan(muka);
  const cyw = Math.cos(k.yaw);
  const syw = Math.sin(k.yaw);
  const cp = Math.cos(k.pitch);
  const sp = Math.sin(k.pitch);
  const V0 = syw * cp, V1 = cyw * cp, V2 = -sp;
  arahCahaya(k, cahayaTmp);
  const L0 = cahayaTmp[0], L1 = cahayaTmp[1], L2 = cahayaTmp[2];
  const s = k.skala;

  let q = 0;
  let m = 0;
  for (let i = 0; i < muka.length; i++) {
    const f = muka[i];
    const pts = f.pts;
    const np = pts.length;
    bufAwal[i] = q;

    // Normal Newell di dunia, tanpa alokasi.
    let nx = 0, ny = 0, nz = 0;
    let dalam = 0;
    for (let j = 0; j < np; j++) {
      const a = pts[j];
      const b = pts[j + 1 === np ? 0 : j + 1];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
      const xr = a[0] * cyw - a[1] * syw;
      const yr = a[0] * syw + a[1] * cyw;
      bufX[q] = k.cx + s * xr;
      bufY[q] = k.cy - s * (a[2] * cp + yr * sp);
      dalam += yr * cp - a[2] * sp;
      q++;
    }
    const nl = Math.hypot(nx, ny, nz) || 1;
    const menghadap = (nx * V0 + ny * V1 + nz * V2) / nl; // > 0 = membelakangi pengamat
    if (f.satuSisi && menghadap > -1e-9) {
      bufNada[i] = -1;
      continue;
    }
    // Muka dua sisi dilihat dari belakang: nada dari sisi yang terlihat.
    const balik = menghadap > 0 ? -1 : 1;
    const t = (balik * (nx * L0 + ny * L1 + nz * L2)) / nl;
    bufNada[i] = anakTangga(t);
    /* Satu kunci urut naik: lapis kecil dulu, di dalam lapis yang jauh dulu.
       Kedalaman gambar lembar jauh di bawah 1e6 m, jadi lapis tidak pernah
       tertukar oleh kedalaman. */
    bufKunci[i] = (f.lapis ?? 0) * LAPIS_JARAK - dalam / np;
    bufUrut[m++] = i;
  }
  bufAwal[muka.length] = q;
  bufUrut.subarray(0, m).sort(bandingUrut);
  return m;
}

const LAPIS_JARAK = 1e9;

function bandingUrut(a: number, b: number): number {
  return bufKunci[a] - bufKunci[b];
}

/** Indeks muka terlihat dalam urutan gambar (jauh ke dekat). */
export function urutMuka(muka: readonly Muka[], k: Kamera): number[] {
  const m = olah(muka, k);
  return Array.from(bufUrut.subarray(0, m));
}

function bobotTerdekat(b: number | undefined): number {
  if (b === undefined) return W.bold;
  const pilihan = [W.hair, W.thin, W.bold];
  let terbaik: number = W.bold;
  let jarak = Infinity;
  for (const p of pilihan) {
    const d = Math.abs(p - b);
    if (d < jarak) {
      jarak = d;
      terbaik = p;
    }
  }
  return terbaik;
}

function jalur(ctx: CanvasRenderingContext2D, a: number, b: number) {
  ctx.moveTo(bufX[a], bufY[a]);
  for (let j = a + 1; j < b; j++) ctx.lineTo(bufX[j], bufY[j]);
  ctx.closePath();
}

/**
 * Gambar muka dengan painter's algorithm: urut kedalaman, muka belakang
 * dibuang bila satuSisi, lalu tiap muka diisi, diarsir, dan digaris.
 * Gaya kanvas diset hanya bila berubah (anggaran kisi 40 × 40).
 * `bingkai` memotong seluruh gambar ke bidang gambar.
 */
export function gambarMuka(
  ctx: CanvasRenderingContext2D,
  muka: readonly Muka[],
  k: Kamera,
  opsi: { bingkai?: PlateFrame } = {}
): void {
  const m = olah(muka, k);
  ctx.save();
  if (opsi.bingkai) {
    const b = opsi.bingkai;
    ctx.beginPath();
    ctx.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    ctx.clip();
  }
  ctx.lineCap = "butt";
  ctx.lineJoin = "round"; // muka sempit pada sudut pandang miring tidak berduri miter

  let isiKini = "";
  let garisKini = "";
  let bobotKini = -1;
  let dashKini: readonly number[] | null = null;

  for (let u = 0; u < m; u++) {
    const i = bufUrut[u];
    const f = muka[i];
    const a = bufAwal[i];
    const b = a + f.pts.length;

    const isi =
      f.isi === null
        ? null
        : f.isi ?? NADA[f.bahan ?? (f.arsir === "air" ? "air" : "beton")][bufNada[i]];
    const garis = f.garis === null ? null : f.garis ?? C.ink;

    ctx.beginPath();
    jalur(ctx, a, b);
    if (isi) {
      if (isi !== isiKini) {
        ctx.fillStyle = isi;
        isiKini = isi;
      }
      ctx.fill();
    }

    if (f.arsir) {
      arsirMuka(ctx, f.arsir, a, b);
      // pola plate.ts mengubah gaya kanvas: paksa set ulang
      isiKini = "";
      garisKini = "";
      bobotKini = -1;
      dashKini = null;
      ctx.beginPath();
      jalur(ctx, a, b);
    }

    if (garis) {
      const bobot = bobotTerdekat(f.bobot);
      const dash = f.dash ?? DASH.solid;
      if (garis !== garisKini) {
        ctx.strokeStyle = garis;
        garisKini = garis;
      }
      if (bobot !== bobotKini) {
        ctx.lineWidth = bobot;
        bobotKini = bobot;
      }
      if (dash !== dashKini) {
        ctx.setLineDash(dash as number[]);
        dashKini = dash;
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function arsirMuka(
  ctx: CanvasRenderingContext2D,
  jenis: NonNullable<Muka["arsir"]>,
  a: number,
  b: number
) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let j = a; j < b; j++) {
    if (bufX[j] < x0) x0 = bufX[j];
    if (bufX[j] > x1) x1 = bufX[j];
    if (bufY[j] < y0) y0 = bufY[j];
    if (bufY[j] > y1) y1 = bufY[j];
  }
  ctx.save();
  if (jenis === "sinyal") {
    /* Garis x − y = k·jarak dalam ruang layar: polanya menyambung lurus
       melewati muka bertetangga, tidak mulai ulang di tiap muka. */
    const jarak = 6;
    ctx.beginPath();
    jalur(ctx, a, b);
    ctx.clip();
    pen(ctx, W.hair, C.signal);
    ctx.beginPath();
    const k0 = Math.floor((x0 - y1) / jarak);
    const k1 = Math.ceil((x1 - y0) / jarak);
    for (let k = k0; k <= k1; k++) {
      const c = k * jarak;
      ctx.moveTo(y0 + c, y0);
      ctx.lineTo(y1 + c, y1);
    }
    ctx.stroke();
  } else if (jenis === "air") {
    hatchWater(ctx, () => {
      ctx.beginPath();
      jalur(ctx, a, b);
    }, x0, x1, y0, y1);
  } else {
    ctx.beginPath();
    jalur(ctx, a, b);
    ctx.clip();
    if (jenis === "beton") hatchConcrete(ctx, x0, y0, x1 - x0, y1 - y0);
    else hatchSoil(ctx, x0, y0, x1 - x0, y1 - y0);
  }
  ctx.restore();
}
