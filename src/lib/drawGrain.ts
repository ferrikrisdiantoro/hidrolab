import { C, DASH, F, W } from "./theme.ts";
import { createLabelPlacer, dimH, flowArrow, ground, hatchGravel, hatchRiprap, hatchSoil, pen } from "./plate.ts";
import { hash01 } from "./motion.ts";
import { decadeTimeScale } from "./drawFieldMotion.ts";
import { mapFrom, rectsFrom, type PlateMap, type PlateOut } from "./plateOut.ts";
import type { GrainMode } from "./sedimenGerak.ts";
import { fmtPlain } from "./hydraulics.ts";

/**
 * SKETSA BUTIR DI DASAR (SD-01 kurva Shields, SD-03 erosi dan suspensi).
 *
 * Panel kecil di samping diagram: jendela potongan memanjang tepat di atas
 * dasar, berisi satu baris butir dasar yang terkunci dan beberapa butir
 * lepas di atasnya. Keadaan butir lepas (diam, menggelinding, melayang)
 * dan lajunya dibaca dari M1 (sedimenGerak.ts), tidak dihitung di sini.
 *
 * Skala: semua panjang dalam satuan diameter butir d. Rentang d di lembar
 * (0,004 sampai 300 mm) mencakup lima orde, jadi jendela berskala tetap
 * mustahil; yang dijaga adalah perbandingan antar besaran di jendela, dan
 * skala fisiknya ditulis sebagai garis ukur "N d = ... mm" di bawah dasar.
 *
 * Geometri dasar: baris bola berdiameter d dengan pusat di ketinggian d/2.
 * Butir lepas yang bersandar di antara dua bola dasar berpusat di
 * d/2 + d·√(1 − 1/4) = 1,366 d (kantong), dan yang menggelinding di atas
 * baris itu mengikuti busur bola dasar di bawahnya: pusatnya setinggi
 * d/2 + √(d² − Δx²), Δx jarak mendatar ke pusat bola dasar terdekat. Itu
 * geometri murni menggelinding di atas bola sama besar, bukan gerak hias.
 *
 * Gerak (lapis gerak, tanpa alokasi per frame):
 * - diam: laju nol. Butir yang masih di atas dasar (sesudah melayang)
 *   turun dengan kecepatan endap ws lalu berhenti di tempat ia mendarat.
 * - dasar: maju dengan laju butir dasar us (Fernandez Luque & van Beek),
 *   menggelinding di atas baris dasar; sudut putarnya jarak tempuh dibagi
 *   jari-jari (menggelinding tanpa selip).
 * - melayang: tegak = −ws + v', dengan v' fluktuasi pusaran berbesaran
 *   1,25 u* (Bagnold 1966, v' = 1,25 u*; sama dengan ambang u* = 0,8 ws di
 *   sedimenGerak.ts). Selang antar pusaran dipilih supaya difusivitas tegak
 *   sama dengan kappa u* z (lihat stepGrains), jadi sebaran tegaknya
 *   mendekati profil Rouse dekat dasar.
 *   Mendatar sama dengan us, BATAS BAWAH laju butir melayang (M1 tidak
 *   menghitung laju melayang); lembar wajib menulisnya di catatan gerak.
 *   Tepi atas jendela memantulkan butir: jendela adalah bagian dekat dasar
 *   dari kolom yang lebih tinggi, dan pada konsentrasi yang seragam ke
 *   samping butir yang keluar ke atas diganti butir lain yang masuk.
 * - Butir yang keluar di kanan masuk lagi di kiri (jendela berulang).
 */

/* ------------------------------------------------------------------ *
 * Warna butir dan arsiran menurut ukuran
 * ------------------------------------------------------------------ */

/** Batas golongan butir (Wentworth), m. */
export const SILT_LIMIT = 0.0000625;
export const SAND_LIMIT = 0.002;
export const GRAVEL_LIMIT = 0.064;

/** Warna isian butir dari golongan ukurannya (token benda di theme.ts). */
export function grainFill(dM: number): string {
  if (dM < SILT_LIMIT) return C.soil;
  if (dM < SAND_LIMIT) return C.grainSand;
  if (dM < GRAVEL_LIMIT) return C.grainGravel;
  return C.rock;
}

/** Arsiran lapisan di bawah dasar, sesuai golongan butirnya. */
function hatchBed(ctx: CanvasRenderingContext2D, dM: number, x: number, y: number, w: number, h: number) {
  if (dM < SAND_LIMIT) hatchSoil(ctx, x, y, w, h, 6);
  else if (dM < GRAVEL_LIMIT) hatchGravel(ctx, x, y, w, h, 8);
  else hatchRiprap(ctx, x, y, w, h, 12);
}

/* ------------------------------------------------------------------ *
 * Tata letak panel
 * ------------------------------------------------------------------ */

/** Ruang tulisan di atas jendela dan garis ukur di bawahnya, px. */
const PAD_TOP = 40;
const PAD_BOTTOM = 36;
const PAD_SIDE = 10;
/** Tinggi pusat butir lepas di kantong antara dua bola dasar, d. */
export const POCKET_Y = 0.5 + Math.sqrt(0.75);

/** Ukuran satu d di layar, px: butir 10 sampai 28 px. */
function grainPx(innerW: number, innerH: number): number {
  return Math.min(28, Math.max(10, Math.min(innerW / 12, innerH / 9)));
}

/**
 * Pemetaan panel: x dan y dalam satuan d, nol di kiri jendela dan di dasar
 * baris bola dasar. Dipakai lapis statis dan lapis gerak.
 */
export function grainPanelMap(w: number, h: number): PlateMap {
  const innerW = Math.max(1, w - 2 * PAD_SIDE);
  const yBed = h - PAD_BOTTOM;
  const innerH = Math.max(1, yBed - PAD_TOP);
  const D = grainPx(innerW, innerH);
  const X = (v: number) => PAD_SIDE + v * D;
  const Y = (v: number) => yBed - v * D;
  const frame = { x0: PAD_SIDE, y0: PAD_TOP, x1: PAD_SIDE + innerW, y1: yBed };
  return mapFrom(X, Y, frame, [0, innerW / D], [0, innerH / D]);
}

/** Lebar dan tinggi jendela dalam satuan d. */
export function grainDomain(map: PlateMap): { w: number; h: number } {
  return { w: map.invX(map.frame.x1), h: map.invY(map.frame.y0) };
}

/** Banyak butir lepas yang tampak pada lebar jendela ini. */
export function visibleGrains(n: number, widthD: number): number {
  return Math.max(1, Math.min(n, Math.floor((widthD - 1) / 2)));
}

/** Pusat butir lepas yang menggelinding di atas baris bola dasar, d. */
export function bedContour(x: number): number {
  const dx = x - (Math.floor(x) + 0.5);
  const a = Math.min(Math.abs(dx), 0.5);
  return 0.5 + Math.sqrt(1 - a * a);
}

/**
 * Lebar ulang jendela, d: bilangan bulat supaya busur dasar bersambung
 * tanpa loncatan saat butir masuk lagi di kiri.
 */
export function wrapWidth(widthD: number): number {
  return Math.max(2, Math.floor(widthD));
}

/** Letak diam butir i (kantong ke-2i+1), d. */
export function restX(i: number): number {
  return 2 * i + 1;
}

/**
 * Bilangan Rouse P = ws / (kappa u*). Tak hingga bila tidak ada aliran.
 */
export function rouseNumber(ws: number, ustar: number): number {
  return ustar > 0 ? Math.max(0, ws) / (0.4 * ustar) : Number.POSITIVE_INFINITY;
}

/**
 * Ketinggian pusat butir melayang ke-i, d: sampel deterministik (hash) dari
 * profil Rouse dekat dasar c ~ z^(-P) di antara z = 0,5 d dan tepi atas
 * jendela, z diukur dari puncak baris dasar. Dipakai gambar diam dan
 * penempatan awal saat lembar dibuka dalam keadaan melayang: sebaran yang
 * akan dicapai lapis gerak sendiri bila ditunggu (lihat stepGrains), tanpa
 * menunggu puluhan detik layar.
 */
export function rouseHeight(i: number, P: number, hD: number): number {
  const z0 = 0.5;
  const z1 = Math.max(z0 + 0.5, hD - 1.6);
  const u = hash01(i, 11);
  let z: number;
  if (!Number.isFinite(P)) z = z0;
  else if (Math.abs(1 - P) < 1e-6) z = z0 * Math.pow(z1 / z0, u);
  else {
    const e = 1 - P;
    const a = Math.pow(z0, e);
    const b = Math.pow(z1, e);
    z = Math.pow(a + u * (b - a), 1 / e);
  }
  return 1 + Math.min(Math.max(z, z0), z1);
}

/* ------------------------------------------------------------------ *
 * Lapis statis
 * ------------------------------------------------------------------ */

export type GrainPanelState = {
  /** Diameter butir, m */
  dM: number;
  mode: GrainMode;
  /** Judul keadaan, sudah dalam bahasa aktif */
  title: string;
  /** Warna judul, sama dengan nada kartu keadaan lembar */
  tint: string;
  /** Baris angka di bawah judul (simbol dan satuan, tidak dikapitalkan) */
  values: string;
  /** Tulisan "aliran" / "flow" di samping panah aliran */
  flowLabel: string;
  /** Benar bila u* > 0 (ada aliran) */
  flowing: boolean;
  /**
   * Lapis gerak sedang berjalan: butir lepas digambar lapis gerak, jadi
   * lapis statis tidak menggambarnya. Saat dijeda butir digambar di sini
   * pada letak diamnya (atau ketinggian contoh bila melayang).
   */
  animating: boolean;
  /** Di luar rentang berlaku (butir kohesif): judul merah sinyal, tanpa gerak */
  invalid?: boolean;
  /** Jumlah butir lepas (sama dengan createGrainSwarm) */
  n: number;
  /** Bilangan Rouse ws/(kappa u*), untuk ketinggian butir melayang gambar diam */
  rouseP?: number;
};

/** Garis ukur: kelipatan d yang bulat dan muat. */
function scaleBar(widthD: number): number {
  for (const k of [10, 5, 4, 2, 1]) if (k <= widthD * 0.6) return k;
  return 1;
}

/** Panjang fisik garis ukur dengan satuan yang terbaca. */
function lengthText(m: number): string {
  if (m >= 1) return `${fmtPlain(m, m >= 10 ? 1 : 2)} m`;
  if (m >= 0.001) {
    const mm = m * 1000;
    return `${fmtPlain(mm, mm >= 100 ? 0 : mm >= 10 ? 1 : 2)} mm`;
  }
  const um = m * 1e6;
  return `${fmtPlain(um, um >= 100 ? 0 : um >= 10 ? 1 : 2)} µm`;
}

function grainShape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  ang: number,
  fill: string
) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  pen(ctx, W.thin, C.ink);
  ctx.stroke();
  /* Garis jari-jari: tanda putaran. Saat menggelinding sudutnya jarak
     tempuh dibagi jari-jari, jadi laju putar ikut terbaca. */
  pen(ctx, W.hair, C.ink);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + r * Math.cos(ang), cy - r * Math.sin(ang));
  ctx.stroke();
}

export function drawGrainPanel(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: GrainPanelState
): PlateOut {
  ground(ctx, w, h);
  const map = grainPanelMap(w, h);
  const f = map.frame;
  const dom = grainDomain(map);
  const D = map.X(1) - map.X(0);
  const fill = grainFill(s.dM);

  /* Air di atas dasar sampai tepi atas jendela; jendela bukan muka air,
     jadi tidak ada garis muka air. */
  ctx.fillStyle = C.waterFill;
  ctx.fillRect(f.x0, f.y0, f.x1 - f.x0, map.Y(0.5) - f.y0);

  /* Lapisan di bawah baris dasar. */
  hatchBed(ctx, s.dM, f.x0, f.y1, f.x1 - f.x0, 12);

  ctx.save();
  ctx.beginPath();
  ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0 + 12);
  ctx.clip();
  /* Baris bola dasar: benda yang terkunci, garis rambut supaya butir lepas
     (garis tipis) terbaca sebagai yang dibicarakan. */
  for (let k = 0; k < Math.ceil(dom.w) + 1; k++) {
    ctx.beginPath();
    ctx.arc(map.X(k + 0.5), map.Y(0.5), D / 2, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    pen(ctx, W.hair, C.ink2);
    ctx.stroke();
  }
  ctx.restore();

  /* Garis dasar: puncak baris bola. */
  pen(ctx, W.hair, C.ink3, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(f.x0, map.Y(1));
  ctx.lineTo(f.x1, map.Y(1));
  ctx.stroke();
  ctx.setLineDash([]);

  /* Bingkai jendela. */
  pen(ctx, W.thin, C.ink2);
  ctx.strokeRect(f.x0, f.y0, f.x1 - f.x0, f.y1 + 12 - f.y0);

  /* Butir lepas pada gambar diam. */
  if (!s.animating || s.invalid) {
    const n = visibleGrains(s.n, dom.w);
    for (let i = 0; i < n; i++) {
      const melayang = s.mode === "melayang" && !s.invalid;
      const x = restX(i);
      const y = melayang ? rouseHeight(i, s.rouseP ?? 1, dom.h) : POCKET_Y;
      grainShape(ctx, map.X(x), map.Y(y), D / 2 - 0.5, Math.PI / 2, fill);
    }
  }

  /* Tulisan: satu penempat untuk seluruh panel. */
  const lp = createLabelPlacer(ctx, { padL: 4, padT: 2, plotW: w - 8, plotH: h - 4 });
  lp.write(s.title, f.x0, 12, s.invalid ? C.signal : s.tint, { align: "left" });
  ctx.font = F.value;
  ctx.fillStyle = C.ink2;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const lebarNilai = ctx.measureText(s.values).width;
  ctx.fillText(s.values, f.x0 + 4, 28, Math.max(20, w - 2 * PAD_SIDE - 8));
  lp.reserve(f.x0, f.x0 + 4 + lebarNilai, 22, 34);

  /* Panah aliran di dalam jendela, kiri atas air. */
  if (s.flowing) {
    const ax = f.x0 + 30;
    const ay = f.y0 + 12;
    flowArrow(ctx, ax, ay, 36, C.water);
    lp.write(s.flowLabel, ax + 22, ay, C.water, { align: "left" });
  }

  /* Garis ukur skala di bawah lapisan dasar. Tulisannya tidak lewat
     stensil dimH: stensil mengkapitalkan d menjadi D (simbol lain di
     lembar ini, D*) dan mm menjadi MM. */
  const k = scaleBar(dom.w);
  const yUkur = h - 6;
  dimH(ctx, yUkur, map.X(0), map.X(k), "", C.ink2, undefined, [0, w]);
  const teksUkur = `${k} d = ${lengthText(k * s.dM)}`;
  ctx.font = F.label;
  ctx.fillStyle = C.ink2;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  const lebarUkur = ctx.measureText(teksUkur).width;
  const xUkur = Math.min(map.X(k) + 8, w - lebarUkur - 4);
  ctx.fillText(teksUkur, xUkur, yUkur + 4);
  lp.reserve(xUkur, xUkur + lebarUkur, yUkur - 8, yUkur + 4);

  return { map, anchors: {}, labels: rectsFrom(lp.boxes()) };
}

/* ------------------------------------------------------------------ *
 * Lapis gerak
 * ------------------------------------------------------------------ */

export type GrainSwarm = {
  n: number;
  /** Banyak butir yang sedang dipakai (ikut lebar jendela) */
  active: number;
  /** Posisi pusat, d */
  x: Float32Array;
  y: Float32Array;
  /** Sudut tanda putaran, rad */
  ang: Float32Array;
  /** Laju langkah terakhir, d/s (untuk goresan) */
  vx: Float32Array;
  vy: Float32Array;
  /** Fluktuasi pusaran yang sedang bekerja, d/s */
  eddy: Float32Array;
  /** Sisa umur pusaran, s */
  life: Float32Array;
  /** Hitungan pusaran per butir, masukan hash */
  gen: Uint32Array;
};

/** Kumpulan n butir lepas, belum ditempatkan (active = 0). */
export function createGrainSwarm(n: number): GrainSwarm {
  return {
    n,
    active: 0,
    x: new Float32Array(n),
    y: new Float32Array(n),
    ang: new Float32Array(n),
    vx: new Float32Array(n),
    vy: new Float32Array(n),
    eddy: new Float32Array(n),
    life: new Float32Array(n),
    gen: new Uint32Array(n),
  };
}

export type GrainStep = {
  mode: GrainMode;
  /** Laju butir dasar dari grainMotion, m/s */
  us: number;
  /** Kecepatan gesek, m/s */
  ustar: number;
  /** Kecepatan endap, m/s */
  ws: number;
  /** Diameter butir, m */
  dM: number;
};

/** Perbandingan fluktuasi tegak terhadap u* (Bagnold 1966: v' = 1,25 u*). */
export const EDDY_PER_USTAR = 1.25;
/** Tetapan von Karman. */
export const KAPPA = 0.4;

/**
 * Menyesuaikan jumlah butir dengan lebar jendela. Butir baru ditaruh di
 * kantongnya; butir lama dipertahankan supaya peralihan tidak meloncat.
 */
function fitActive(m: GrainSwarm, dom: { w: number; h: number }, p: GrainStep) {
  const want = visibleGrains(m.n, dom.w);
  const P = p.mode === "melayang" ? rouseNumber(p.ws, p.ustar) : Number.POSITIVE_INFINITY;
  for (let i = m.active; i < want; i++) {
    m.x[i] = restX(i);
    m.y[i] = Number.isFinite(P) ? rouseHeight(i, P, dom.h) : POCKET_Y;
    m.ang[i] = Math.PI / 2;
    m.vx[i] = 0;
    m.vy[i] = 0;
    m.eddy[i] = 0;
    m.life[i] = 0;
  }
  m.active = want;
}

/**
 * Satu langkah waktu (detik fisik). `dom` = grainDomain(map), satuan d.
 * Tanpa alokasi.
 */
export function stepGrains(m: GrainSwarm, dt: number, p: GrainStep, dom: { w: number; h: number }): void {
  fitActive(m, dom, p);
  if (!(dt > 0) || !(p.dM > 0)) {
    for (let i = 0; i < m.active; i++) {
      m.vx[i] = 0;
      m.vy[i] = 0;
    }
    return;
  }
  const perD = 1 / p.dM;
  const U = p.mode === "diam" ? 0 : Math.max(0, p.us) * perD;
  const Ws = Math.max(0, p.ws) * perD;
  const Vp = EDDY_PER_USTAR * Math.max(0, p.ustar) * perD;
  /*
   * Selang pusaran dipilih supaya difusivitas tegak sama dengan difusivitas
   * dekat dasar K = kappa u* z (log law, dasar profil Rouse): untuk kecepatan
   * tetap sepotong-sepotong bersebaran v', K = v'^2 tau, jadi
   * tau = kappa u* z / v'^2 = kappa z / (1,25 v'). Hanyutan kappa u* (= dK/dz)
   * menjaga butir yang sudah tercampur rata tetap rata (syarat tercampur
   * baik). Dengan begitu sebaran tegak butir di jendela mendekati profil
   * Rouse c ~ z^(-ws/(kappa u*)): butir di sekitar ambang melayang tetap
   * berkumpul dekat dasar, butir halus naik tinggi.
   */
  const ustarD = Vp / EDDY_PER_USTAR;
  const tauPerZ = Vp > 0 ? KAPPA / (EDDY_PER_USTAR * Vp) : Infinity;
  const drift = KAPPA * ustarD;
  const top = Math.max(POCKET_Y + 0.5, dom.h - 0.5);
  const wrap = wrapWidth(dom.w);

  for (let i = 0; i < m.active; i++) {
    const x0 = m.x[i];
    const y0 = m.y[i];
    let x = x0;
    let y = y0;

    if (p.mode === "melayang") {
      m.life[i] -= dt;
      if (m.life[i] <= 0) {
        const g = (m.gen[i] + 1) >>> 0;
        m.gen[i] = g;
        // Box-Muller dari dua hash: fluktuasi bersebaran normal.
        const u1 = Math.max(1e-6, hash01(i, g));
        const u2 = hash01(i + 977, g);
        m.eddy[i] = Vp * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const tauE = tauPerZ * Math.max(0.5, y - 1);
        m.life[i] += tauE * (0.5 + hash01(i + 31, g));
        if (m.life[i] <= 0) m.life[i] = tauE;
      }
      x += U * dt;
      y += (m.eddy[i] - Ws + drift) * dt;
      const yb = bedContour(x);
      if (y < yb) {
        y = Math.min(top, 2 * yb - y);
        if (m.eddy[i] < 0) m.eddy[i] = -m.eddy[i];
      } else if (y > top) {
        y = Math.max(yb, 2 * top - y);
        if (m.eddy[i] > 0) m.eddy[i] = -m.eddy[i];
      }
    } else {
      const ybNow = bedContour(x);
      if (y > ybNow + 1e-4) {
        // Masih di atas dasar: turun dengan kecepatan endap.
        x += U * dt;
        y -= Ws * dt;
        const yb = bedContour(x);
        if (y < yb) y = yb;
      } else if (U > 0) {
        x += U * dt;
        y = bedContour(x);
      }
      // diam di dasar: tidak berubah sama sekali.
    }

    const dx = x - x0;
    if (x >= wrap) x -= wrap * Math.floor(x / wrap);
    else if (x < 0) x += wrap;
    m.x[i] = x;
    m.y[i] = y;
    m.vx[i] = dx / dt;
    m.vy[i] = (y - y0) / dt;
    // Menggelinding tanpa selip: sudut = jarak / jari-jari (0,5 d).
    if (dx !== 0) m.ang[i] -= dx / 0.5;
  }
}

/**
 * Pengali waktu: butir melintasi jendela (12 d) dalam 1 sampai 10 detik
 * layar; tanpa gerak mendatar, dipakai turunnya butir dengan ws.
 * Pangkat sepuluh (decadeTimeScale) supaya catatan "×1 000" terbaca.
 */
export function grainTimeScale(p: GrainStep): number {
  if (!(p.dM > 0)) return 1;
  const laju = p.mode !== "diam" && p.us > 0 ? p.us : p.ws;
  return decadeTimeScale(laju / p.dM / 12, 0.1);
}

/** Panjang goresan di belakang butir, detik pajanan (waktu fisik ditampilkan). */
const TRAIL_SECONDS = 0.18;

/**
 * Menggambar butir lepas di lapis gerak. `timeScale` dipakai supaya
 * panjang goresan dihitung dalam detik LAYAR, jadi panjangnya sebanding
 * dengan laju tampil, sama untuk semua pengali waktu.
 */
export function drawGrainSwarm(
  ctx: CanvasRenderingContext2D,
  m: GrainSwarm,
  out: PlateOut | null,
  dM: number,
  timeScale: number
): void {
  if (!out) return;
  const map = out.map;
  const f = map.frame;
  const D = map.X(1) - map.X(0);
  const fill = grainFill(dM);
  const L = TRAIL_SECONDS * timeScale;
  const widthD = (f.x1 - f.x0) / D;
  const wrap = wrapWidth(widthD);

  ctx.save();
  ctx.beginPath();
  ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
  ctx.clip();

  /* Goresan pajanan: satu path untuk semua butir. */
  pen(ctx, W.hair, C.ink2);
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  for (let i = 0; i < m.active; i++) {
    const vx = m.vx[i];
    const vy = m.vy[i];
    if (vx === 0 && vy === 0) continue;
    const hx = map.X(m.x[i]);
    const hy = map.Y(m.y[i]);
    ctx.moveTo(map.X(m.x[i] - vx * L), map.Y(m.y[i] - vy * L));
    ctx.lineTo(hx, hy);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  for (let i = 0; i < m.active; i++) {
    grainShape(ctx, map.X(m.x[i]), map.Y(m.y[i]), D / 2 - 0.5, m.ang[i], fill);
    /* Jendela berulang: butir di dekat tepi kiri juga tampak di tepi
       kanan (sisa lebar di atas lebar ulang), jadi butir tidak muncul
       atau hilang tiba-tiba. */
    const xc = m.x[i] + wrap;
    if (xc - 0.5 < widthD) {
      grainShape(ctx, map.X(xc), map.Y(m.y[i]), D / 2 - 0.5, m.ang[i], fill);
    }
  }
  ctx.restore();
}
