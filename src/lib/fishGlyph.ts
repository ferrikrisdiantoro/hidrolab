import type { PlateMap } from "./plateOut.ts";
import { bodyAmplitude, bodyMidline } from "./renangGerak.ts";
import { C, DASH, TONE, W, type Tone } from "./theme.ts";

/**
 * S8 Ikan sebagai tanda gambar teknik (EH-01, EH-03, EH-04, EH-05, EK-03).
 *
 * Tubuh carangiform tampak atas: kepala tumpul, badan terlebar sekitar
 * sepertiga panjang, batang ekor menyempit, lalu sirip ekor bercabang.
 * Garis tengah tubuh BUKAN gerak hias: ia keluaran bodyMidline() model M2
 * (renangGerak.ts), gelombang yang merambat dari kepala ke ekor dengan
 * selubung amplitudo Videler (1993). Fase gelombang dan simpangan ekor
 * datang dari lembar (kibasan ekor tailBeat()), jadi ekor yang mengibas
 * lebih cepat memang berarti ikan berenang lebih cepat.
 *
 * Satuan pose dalam satuan gambar (m), sama dengan sumbu PlateMap. Ikan
 * digambar dengan skala sumbu; pada peta yang skala mendatar dan tegaknya
 * berbeda, ikan ikut memipih sama seperti benda lain di gambar itu.
 *
 * Tidak ada alokasi per panggilan: fishOutline() menerima wadah keluaran,
 * drawFish() memakai wadah milik modul ini.
 */

export type FishPose = {
  /** Titik tengah panjang tubuh, satuan gambar (m) */
  x: number;
  y: number;
  /** Arah kepala, radian, berlawanan jarum jam dari sumbu x gambar */
  heading: number;
  /** Panjang tubuh dari moncong ke ujung sirip ekor, m */
  length: number;
  /**
   * Fase gelombang tubuh, radian. Untuk kibasan f per detik: phase = 2 pi f t.
   * Fase yang bertambah merambatkan gelombang dari kepala ke ekor.
   */
  phase: number;
  /**
   * Simpangan ujung ekor dari sumbu tubuh dibagi panjang tubuh (separuh
   * puncak ke puncak), dari model M2. Bawaan bodyAmplitude(1) = 0,10.
   */
  amp?: number;
};

export type FishStyle = {
  /** Warna garis; menang atas tone. Bawaan tinta. */
  color?: string;
  /**
   * Nada penilaian, misalnya pass/caution untuk lolos/gagal EH-03.
   * Garis memakai TONE[tone].line dan isian TONE[tone].fill.
   * Jangan "invalid" kecuali ikan itu memang di luar rentang rumus.
   */
  tone?: Tone;
  /** Hanya garis tepi, tanpa isian (ikan di balik sesuatu atau hantu). */
  hollow?: boolean;
};

/** Jumlah stasiun bawaan sepanjang tubuh tiap sisi. */
export const FISH_STATIONS = 16;
const MIN_STATIONS = 6;

/** Akhir badan, awal sirip ekor (x/L). */
const PEDUNCLE = 0.84;
/** Takik cabang sirip ekor pada garis tengah (x/L). */
const FORK = 0.93;
/** Separuh bentang sirip ekor di ujungnya, dalam L. */
const FIN_HALF_SPAN = 0.085;
/** Faktor bentuk badan: separuh lebar = BODY_K sqrt(xi) (1 - xi / BODY_END). */
const BODY_K = 0.24;
const BODY_END = 0.9;

const LEBAR_BATANG = BODY_K * Math.sqrt(PEDUNCLE) * (1 - PEDUNCLE / BODY_END);

/** Separuh lebar tubuh pada xi = x/L, dalam L. Nol di moncong. */
export function fishHalfWidth(xi: number): number {
  if (xi <= 0) return 0;
  if (xi <= PEDUNCLE) return BODY_K * Math.sqrt(xi) * (1 - xi / BODY_END);
  const u = Math.min(1, (xi - PEDUNCLE) / (1 - PEDUNCLE));
  return LEBAR_BATANG + u * (FIN_HALF_SPAN - LEBAR_BATANG);
}

/** Panjang Float32Array yang diisi fishOutline untuk n stasiun. */
export function fishOutlineLength(n: number = FISH_STATIONS): number {
  return 2 * (2 * Math.max(MIN_STATIONS, Math.floor(n)) + 1);
}

let garisTengah = new Float32Array(2 * FISH_STATIONS);

/**
 * Garis tepi tubuh dalam satuan gambar, berurutan x0,y0,x1,y1,...
 *
 * Urutan titik: sisi kiri dari moncong ke ujung sirip atas (n titik), takik
 * cabang ekor (1 titik), sisi kanan dari ujung sirip bawah kembali ke
 * moncong (n titik). Lebar di moncong nol, jadi titik terakhir sama persis
 * dengan titik pertama: poligon tertutup, 2n + 1 titik.
 *
 * Lebar tubuh diukur tegak lurus sumbu tubuh (bukan tegak lurus garis
 * tengah yang melengkung), jadi rentang sepanjang arah kepala tepat sama
 * dengan `length` pada fase berapa pun.
 *
 * `out` boleh diberikan supaya tidak ada alokasi; panjangnya minimal
 * fishOutlineLength(n). Yang diisi hanya bagian depannya.
 */
export function fishOutline(
  f: FishPose,
  n: number = FISH_STATIONS,
  out?: Float32Array
): Float32Array {
  const ns = Math.max(MIN_STATIONS, Math.floor(n));
  const perlu = 2 * (2 * ns + 1);
  const o = out ?? new Float32Array(perlu);
  if (o.length < perlu) {
    throw new RangeError(`fishOutline: wadah ${o.length} < ${perlu}`);
  }
  /* Wadah garis tengah milik modul; hanya dibuat ulang bila jumlah
     stasiun berubah (drawFish selalu memakai FISH_STATIONS). */
  if (garisTengah.length !== 2 * ns) garisTengah = new Float32Array(2 * ns);
  const mid = garisTengah;

  const L = f.length;
  const skala = f.amp === undefined ? 1 : f.amp / bodyAmplitude(1);
  /* bodyMidline memberi L A(xi) sin(2 pi (x/lambda - f t)); dengan f = 1 dan
     t = phase / 2 pi, sinusnya menjadi sin(2 pi x/lambda - phase). */
  const lambda = L;
  bodyMidline(L, 1, lambda, f.phase / (2 * Math.PI), mid);

  const dx = Math.cos(f.heading);
  const dy = Math.sin(f.heading);
  /* Normal ke kiri arah kepala. */
  const nx = -dy;
  const ny = dx;
  const ox = f.x + 0.5 * L * dx;
  const oy = f.y + 0.5 * L * dy;

  /* Sisi kiri: moncong ke ujung sirip atas. */
  for (let i = 0; i < ns; i++) {
    const s = mid[2 * i];
    const lat = mid[2 * i + 1] * skala + fishHalfWidth(s / L) * L;
    o[2 * i] = ox - s * dx + lat * nx;
    o[2 * i + 1] = oy - s * dy + lat * ny;
  }
  /* Takik cabang sirip ekor, di garis tengah. */
  {
    const s = FORK * L;
    const lat = L * bodyAmplitude(FORK) * skala * Math.sin(2 * Math.PI * FORK - f.phase);
    o[2 * ns] = ox - s * dx + lat * nx;
    o[2 * ns + 1] = oy - s * dy + lat * ny;
  }
  /* Sisi kanan: ujung sirip bawah kembali ke moncong. */
  for (let i = ns - 1, j = ns + 1; i >= 0; i--, j++) {
    const s = mid[2 * i];
    const lat = mid[2 * i + 1] * skala - fishHalfWidth(s / L) * L;
    o[2 * j] = ox - s * dx + lat * nx;
    o[2 * j + 1] = oy - s * dy + lat * ny;
  }
  return o;
}

const wadahGambar = new Float32Array(fishOutlineLength(FISH_STATIONS));

/** Panjang tubuh dalam piksel di bawah ini mata tidak digambar. */
const MATA_MIN_PX = 14;

/**
 * Menggambar satu ikan. Garis tipis (W.thin): ikan adalah tanda pada
 * lembar, bukan benda yang dipotong. Isian bawaan kertas lembar supaya ikan
 * menutupi goresan air di belakangnya; dengan tone, isian nada di atasnya.
 */
export function drawFish(
  ctx: CanvasRenderingContext2D,
  map: PlateMap,
  f: FishPose,
  style?: FishStyle
): void {
  const ns = FISH_STATIONS;
  const titik = fishOutline(f, ns, wadahGambar);
  const m = 2 * ns + 1;

  const nada = style?.tone ? TONE[style.tone] : undefined;
  const garis = style?.color ?? nada?.line ?? C.ink;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(map.X(titik[0]), map.Y(titik[1]));
  for (let k = 1; k < m - 1; k++) ctx.lineTo(map.X(titik[2 * k]), map.Y(titik[2 * k + 1]));
  ctx.closePath();

  if (!style?.hollow) {
    ctx.fillStyle = C.sheet;
    ctx.fill();
    if (nada) {
      ctx.fillStyle = nada.fill;
      ctx.fill();
    }
  }
  ctx.lineWidth = W.thin;
  ctx.strokeStyle = garis;
  ctx.setLineDash(DASH.solid);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  /* Mata: penanda kepala, hanya bila ikan cukup besar untuk dibaca. */
  const hx = map.X(titik[0]);
  const hy = map.Y(titik[1]);
  const tx = 0.5 * (map.X(titik[2 * (ns - 1)]) + map.X(titik[2 * (ns + 1)]));
  const ty = 0.5 * (map.Y(titik[2 * (ns - 1) + 1]) + map.Y(titik[2 * (ns + 1) + 1]));
  const panjangPx = Math.hypot(hx - tx, hy - ty);
  if (panjangPx >= MATA_MIN_PX) {
    const u = 0.1;
    const ex = hx + u * (tx - hx);
    const ey = hy + u * (ty - hy);
    ctx.beginPath();
    ctx.arc(ex, ey, Math.max(0.9, 0.018 * panjangPx), 0, Math.PI * 2);
    ctx.fillStyle = garis;
    ctx.fill();
  }
  ctx.restore();
}
