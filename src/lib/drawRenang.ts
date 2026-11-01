import { C, DASH, F, W, stencil } from "./theme.ts";
import { createLabelPlacer, flowArrow, ground, pen } from "./plate.ts";
import { SWIM_BURST_TIME, fishSwim, fmtPlain } from "./hydraulics.ts";
import type { Lang } from "./i18n";
import { linearMap, type PlateMap, type PlateOut } from "./plateOut.ts";
import { createPool, relane, type Pool } from "./motion.ts";
import { tailBeat, type TailBeat } from "./renangGerak.ts";
import { drawFish, type FishPose } from "./fishGlyph.ts";

/**
 * EH-04 Renang ikan: lajur saluran uji di atas kurva ketahanan.
 *
 * Yang digambar keadaan yang sama persis dengan titik di kurva. fishSwim
 * menghitung ketahanan pada keadaan ikan MENAHAN DIRI di tempat, yaitu
 * berenang terhadap air secepat arusnya sendiri (komentar fishSwim di
 * hydraulics.ts). Jadi di lajur ini:
 *
 * - Arus V < Ub: ikan diam terhadap dasar, berenang secepat V terhadap air,
 *   selama ketahanan t dari kurva. Sesudah itu ia lelah: berhenti mengibas
 *   dan hanyut bersama air (kecepatan V ke hilir).
 * - Arus V >= Ub (tidak mampu): ikan berenang pada kecepatan sentaknya Ub
 *   dan tetap terdorong mundur dengan Ub - V (kecepatan maju bersih model,
 *   bernilai nol atau negatif) selama waktu sentak 20 s, lalu lelah.
 * - Kecepatan jelajah di atas kecepatan sentak (impossible): tidak ada
 *   gerak; lembar menolak keadaan itu.
 *
 * Kibasan ekor dari tailBeat (M2, Bainbridge 1958) dengan kecepatan renang
 * terhadap air di atas. Kibasan di bawah 5 per detik di luar rentang
 * Bainbridge dan ditandai merah sinyal di lajur.
 */

/** Kibasan tertinggi yang masih terbaca pada 60 fps (delapan frame per kibasan). */
export const KIBAS_TAMPIL_MAKS = 7.5;
/** Jeda sesudah ikan keluar bidang sebelum percobaan diulang, detik fisik. */
export const JEDA_ULANG = 1.5;
/** Waktu pajanan goresan air, detik: panjang goresan = V × pajanan. */
export const PAJANAN = 0.1;

export type RenangKeadaan = {
  /** Keadaan berlaku (kecepatan jelajah di bawah kecepatan sentak). */
  berlaku: boolean;
  /** Arus, m/s (ke hilir, arah x positif di lajur). */
  arus: number;
  /** Kecepatan renang terhadap air selama berusaha, m/s. */
  renang: number;
  /** Kecepatan terhadap dasar selama berusaha, m/s, positif ke hulu. */
  maju: number;
  /** Lama berusaha sebelum lelah, detik (Infinity untuk jelajah). */
  tahan: number;
  /** Ikan tidak mampu melawan arus (mode tidak-mampu fishSwim). */
  gagal: boolean;
  /** Kibasan ekor selama berusaha. */
  kibas: TailBeat;
  /** Panjang tubuh, m. */
  L: number;
};

/** Keadaan lajur dari keluaran fishSwim. Satu-satunya sumber angka lajur. */
export function renangKeadaan(
  L: number,
  V: number,
  susBL: number,
  burstBL: number
): RenangKeadaan {
  const r = fishSwim(L, V, susBL, burstBL);
  const gagal = r.mode === "tidak-mampu";
  const renang = gagal ? r.burst : V;
  return {
    berlaku: !r.impossible,
    arus: V,
    renang,
    maju: gagal ? r.groundSpeed : 0,
    tahan: gagal ? SWIM_BURST_TIME : r.endurance,
    gagal,
    kibas: tailBeat(renang, L),
    L,
  };
}

export type RenangPose = {
  /** Geseran titik tengah ikan dari posisi awal, m, positif ke hulu. */
  x: number;
  /** Fase gelombang tubuh, radian. */
  phase: number;
  /** Sudah melewati ketahanannya: tidak mengibas, hanyut bersama air. */
  lelah: boolean;
};

/**
 * Posisi ikan pada waktu fisik `te` sejak percobaan dimulai. Tanpa alokasi
 * bila `out` diberikan.
 */
export function renangPada(k: RenangKeadaan, te: number, out?: RenangPose): RenangPose {
  const o = out ?? { x: 0, phase: 0, lelah: false };
  const f = k.kibas.frequency;
  if (te <= k.tahan) {
    o.x = k.maju * te;
    o.phase = 2 * Math.PI * f * te;
    o.lelah = false;
  } else {
    const xLelah = k.maju * k.tahan;
    o.x = xLelah - k.arus * (te - k.tahan);
    o.phase = 2 * Math.PI * f * k.tahan;
    o.lelah = true;
  }
  return o;
}

/**
 * Lama satu percobaan, detik fisik: sampai seluruh ikan keluar tepi hilir
 * bidang (setengah lebar `separuh`, m) ditambah jeda. Infinity bila ikan
 * tidak pernah lelah (jelajah) atau tidak pernah keluar.
 */
export function renangSiklus(k: RenangKeadaan, separuh: number): number {
  const batas = separuh + k.L / 2;
  if (!Number.isFinite(k.tahan)) return Infinity;
  const xLelah = k.maju * k.tahan;
  if (xLelah <= -batas) return -batas / k.maju + JEDA_ULANG;
  if (!(k.arus > 0)) return Infinity;
  return k.tahan + (xLelah + batas) / k.arus + JEDA_ULANG;
}

/**
 * Pengali waktu lajur: 1 (waktu nyata) bila kibasan terbaca, lebih kecil
 * bila kibasan melampaui KIBAS_TAMPIL_MAKS. Lembar wajib menulis catatannya.
 */
export function renangSkalaWaktu(k: RenangKeadaan): number {
  const f = k.kibas.frequency;
  if (!k.berlaku || !(f > KIBAS_TAMPIL_MAKS)) return 1;
  return KIBAS_TAMPIL_MAKS / f;
}

/* ------------------------------------------------------------------ *
 * Gambar
 * ------------------------------------------------------------------ */

const PAD = { l: 12, r: 12, t: 10, b: 10 };

type Tata = {
  map: PlateMap;
  separuh: number;
  tinggi: number;
  /** Kotak teks waktu (lapis gerak), piksel. */
  waktuX: number;
  waktuY: number;
};

/**
 * Tata letak lajur: skala sama di kedua sumbu, tinggi lajur 2,2 panjang
 * tubuh, ikan di tengah. Lebar bidang (dalam m) mengikuti lebar kanvas.
 */
function tataLajur(w: number, h: number, L: number): Tata {
  const x0 = PAD.l;
  const x1 = Math.max(x0 + 10, w - PAD.r);
  const y0 = PAD.t;
  const y1 = Math.max(y0 + 10, h - PAD.b);
  const tinggi = 2.2 * L;
  const s = (y1 - y0) / tinggi;
  const separuh = (x1 - x0) / s / 2;
  const map = linearMap({ x0, y0, x1, y1 }, [-separuh, separuh], [-tinggi / 2, tinggi / 2]);
  return { map, separuh, tinggi, waktuX: x1 - 8, waktuY: y1 - 8 };
}

export type RenangLabels = {
  /** Keadaan saat berusaha, mis. "Menahan diri di tempat" */
  state: string;
  /** Satuan PT/dtk atau BL/s */
  bl: string;
  /** "kibasan/s" */
  beat: string;
  /** Teks di luar rentang Bainbridge */
  outOfRange: string;
  /** Teks keadaan mustahil */
  impossible: string;
};

/**
 * Lapis statis lajur. `ikanDiam`: gambar ikan diam di posisi awal (saat
 * dijeda atau gerak dikurangi), supaya gambar diam tetap utuh.
 */
export function drawRenangLajur(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  k: RenangKeadaan,
  label: RenangLabels,
  opts: { ikanDiam: boolean; lang: Lang }
): PlateOut {
  ground(ctx, w, h);
  const { map, tinggi } = tataLajur(w, h, k.L);
  const f = map.frame;
  const yAtas = map.Y(tinggi / 2);
  const yBawah = map.Y(-tinggi / 2);

  // Air di saluran uji.
  ctx.fillStyle = C.waterFill;
  ctx.fillRect(f.x0, yAtas, f.x1 - f.x0, yBawah - yAtas);
  // Dinding saluran uji: benda fisik.
  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  ctx.moveTo(f.x0, yAtas);
  ctx.lineTo(f.x1, yAtas);
  ctx.moveTo(f.x0, yBawah);
  ctx.lineTo(f.x1, yBawah);
  ctx.stroke();
  // Sumbu saluran.
  pen(ctx, W.hair, C.ink3, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(f.x0, map.Y(0));
  ctx.lineTo(f.x1, map.Y(0));
  ctx.stroke();
  ctx.setLineDash([]);

  const tulis = createLabelPlacer(ctx, {
    padL: f.x0,
    padT: yAtas,
    plotW: f.x1 - f.x0,
    plotH: yBawah - yAtas,
  });

  /* Tata tulisan: kolom kiri atas bertumpuk (keadaan, kibasan, catatan di
     luar rentang, jarak baris 15 px = tinggi kotak penempat), kanan bawah
     arus di atas teks waktu lapis gerak, kiri bawah skala. Kanan atas dibiarkan kosong untuk tombol putar. Ikan di
     baris tengah (tinggi lajur 2,2 L, tubuh paling lebar sekitar 0,3 L
     dengan simpangan ekornya), jadi tulisan tidak menindihnya. */
  const xl = f.x0 + 8;
  const ys = yBawah - 9;
  // Arus di kanan bawah, tepat di atas teks waktu lapis gerak.
  const xv = f.x1 - 8;
  const yv = yBawah - 24;
  const teksV = `V ${fmtPlain(k.arus, 2)} m/s`;
  const pv = tulis.write(teksV, xv, yv, C.water, { align: "right" });
  flowArrow(ctx, pv.x0 - 14, yv - 3, 22, C.water);

  if (!k.berlaku) {
    tulis.write(label.impossible, (f.x0 + f.x1) / 2, map.Y(0) + 4, C.signal);
    return { map };
  }

  // Skala: batang sepanjang satu panjang tubuh, kiri bawah.
  const xs0 = f.x0 + 10;
  const xs1 = xs0 + (map.X(k.L) - map.X(0));
  pen(ctx, W.thin, C.ink);
  ctx.beginPath();
  ctx.moveTo(xs0, ys - 3);
  ctx.lineTo(xs0, ys + 3);
  ctx.moveTo(xs0, ys);
  ctx.lineTo(xs1, ys);
  ctx.moveTo(xs1, ys - 3);
  ctx.lineTo(xs1, ys + 3);
  ctx.stroke();
  tulis.write(`L ${fmtPlain(k.L * 100, 0)} cm`, xs1 + 4, ys + 3, C.ink, { align: "left" });

  const U = k.L > 0 ? k.renang / k.L : 0;
  tulis.write(label.state, xl, yAtas + 14, k.gagal ? C.caution : C.ink, { align: "left" });
  tulis.write(
    `f ${fmtPlain(k.kibas.frequency, 1)} ${label.beat}   U ${fmtPlain(U, 1)} ${label.bl}`,
    xl,
    yAtas + 29,
    C.ink2,
    { align: "left" }
  );
  if (k.kibas.outOfRange) {
    tulis.write(label.outOfRange, xl, yAtas + 44, C.signal, { align: "left" });
  }

  if (opts.ikanDiam) {
    poseDiam.x = 0;
    poseDiam.y = 0;
    poseDiam.heading = Math.PI;
    poseDiam.length = k.L;
    poseDiam.phase = 0;
    poseDiam.amp = k.kibas.amplitude / k.L;
    drawFish(ctx, map, poseDiam, k.gagal ? { tone: "caution" } : undefined);
  }
  return { map };
}

const poseDiam: FishPose = { x: 0, y: 0, heading: Math.PI, length: 1, phase: 0 };

/* ---------------- lapis gerak ---------------- */

export type RenangGerak = {
  pool: Pool;
  pose: RenangPose;
  ikan: FishPose;
  /** Kunci keadaan; percobaan diulang dari awal bila berubah. */
  kunci: string;
  t0: number;
  /** Teks waktu terakhir dan detik bulatnya, supaya string tidak dibuat tiap frame. */
  teks: string;
  detik: number;
};

export function createRenangGerak(n = 70): RenangGerak {
  const pool = createPool(n);
  for (let i = 0; i < n; i++) {
    pool.x[i] = (i + 0.5) / n;
    pool.y[i] = 0.06 + pool.seed[i] * 0.88;
  }
  return {
    pool,
    pose: { x: 0, phase: 0, lelah: false },
    ikan: { x: 0, y: 0, heading: Math.PI, length: 1, phase: 0 },
    kunci: "",
    t0: 0,
    teks: "",
    detik: -1,
  };
}

/**
 * Lapis gerak lajur: goresan air dengan kecepatan arus V dan ikan dengan
 * posisi dan fase dari renangPada. Tidak dipanggil untuk keadaan mustahil.
 */
export function drawRenangGerak(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  dt: number,
  k: RenangKeadaan,
  st: RenangGerak,
  teksWaktu: (te: number, tahan: number) => string
): void {
  if (!k.berlaku) return;
  const { map, separuh, tinggi, waktuX, waktuY } = tataLajur(w, h, k.L);
  const kunci = `${k.L}|${k.arus}|${k.renang}|${k.tahan}`;
  if (kunci !== st.kunci) {
    st.kunci = kunci;
    st.t0 = t;
    st.detik = -1;
  }
  const siklus = renangSiklus(k, separuh);
  let te = t - st.t0;
  if (Number.isFinite(siklus) && te > siklus) {
    st.t0 = t;
    te = 0;
    st.detik = -1;
  }

  // Air: posisi pecahan lebar bidang, maju dengan V.
  const pool = st.pool;
  const lebar = 2 * separuh;
  const du = (k.arus * dt) / lebar;
  for (let i = 0; i < pool.n; i++) {
    let u = pool.x[i] + du;
    if (u > 1) {
      u -= 1;
      pool.y[i] = 0.06 + relane(pool, i) * 0.88;
    }
    pool.x[i] = u;
  }
  const f = map.frame;
  const yAtas = map.Y(tinggi / 2);
  const yBawah = map.Y(-tinggi / 2);
  const panjang = Math.max(2, map.X(k.arus * PAJANAN) - map.X(0));
  ctx.save();
  ctx.beginPath();
  ctx.rect(f.x0, yAtas, f.x1 - f.x0, yBawah - yAtas);
  ctx.clip();
  pen(ctx, W.hair, C.water);
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  for (let i = 0; i < pool.n; i++) {
    const hx = map.X(-separuh + pool.x[i] * lebar);
    const hy = yAtas + pool.y[i] * (yBawah - yAtas);
    ctx.moveTo(hx - panjang, hy);
    ctx.lineTo(hx, hy);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Ikan: kepala ke hulu (kiri). x lajur positif ke hilir.
  const p = renangPada(k, te, st.pose);
  const ikan = st.ikan;
  ikan.x = -p.x;
  ikan.y = 0;
  ikan.heading = Math.PI;
  ikan.length = k.L;
  ikan.phase = p.phase;
  ikan.amp = k.kibas.amplitude / k.L;
  if (Math.abs(ikan.x) <= separuh + k.L) {
    drawFish(ctx, map, ikan, k.gagal || p.lelah ? { tone: "caution" } : undefined);
  }
  ctx.restore();

  // Waktu percobaan, kanan bawah.
  const detik = Math.floor(te);
  if (detik !== st.detik) {
    st.detik = detik;
    st.teks = teksWaktu(te, k.tahan);
  }
  ctx.font = F.label;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  const lebarTeks = ctx.measureText(st.teks).width + st.teks.length * 0.8 + 8;
  ctx.fillStyle = C.sheet;
  ctx.fillRect(waktuX - lebarTeks + 4, waktuY - 10, lebarTeks, 14);
  ctx.fillStyle = p.lelah ? C.caution : C.ink;
  stencil(ctx, st.teks, waktuX, waktuY);
}
