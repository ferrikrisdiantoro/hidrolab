import { C, DASH, W } from "./theme.ts";
import { createLabelPlacer, ground, pen } from "./plate.ts";
import { rectsFrom, type PlateOut } from "./plateOut.ts";
import { denilFishway, fmtPlain } from "./hydraulics.ts";
import { ISO, anchor3, gambarMuka, kameraPas, plateOut3, type Kamera, type Muka, type V3 } from "./proyeksi.ts";
import { garis, prismaY, rasioBatas, sisiDekat, tulisPenunjuk } from "./isoBantu.ts";

/**
 * EH-02 3D: TANGGA IKAN DENIL, ISOMETRIK.
 *
 * Dari model denilFishway (hydraulics.ts):
 * - Lebar palung b, kemiringan S (lantai z = −S x), panjang L = H/S
 * - Muka air sejajar lantai pada kedalaman y TEGAK LURUS lantai (model),
 *   jadi tebal tegaknya y·√(1 + S²), sama dengan potongan
 *
 * Bukan dari model, mengikuti aturan gambar potongan lembar ini (siripDenil,
 * dipakai juga oleh potongan 2D):
 * - Sirip: jarak max(0,6 b; 0,25 m), tinggi tegak 0,62 y, puncak bergeser
 *   0,45 × tinggi ke hulu, tebal max(0,06 b; 0,03 m); sirip yang puncaknya
 *   menjulur ke hulu ujung palung tidak digambar. Di 3D sirip dibentang
 *   selebar palung, sama dengan potongannya; bukaan tengah dan sudut sirip
 *   Denil baku tidak ada di model (sudut sirip = permintaan tertunda klien,
 *   bukan masukan)
 * - Panjang tergambar min(L, 8 m); bila L > 8 m tertulis di gambar
 * - Tinggi dinding 1,25 × tebal air tegak, tebal dinding dan pelat: skematik
 *
 * ALIRAN SEKUNDER (putaran balik di dekat dinding dan dasar) TIDAK
 * digambar: model tidak memuatnya, dan sumber medan alirannya (Rajaratnam
 * & Katopodis) belum dibuka. Panah aliran hanya satu, di sumbu muka air,
 * berlabel kecepatan sumbu model (Vmaks).
 *
 * Koordinat: x mendatar searah aliran dari ujung hulu palung, y melintang
 * dengan sumbu palung di y = 0, z elevasi (lantai di ujung hulu z = 0).
 * Dinding sisi dekat dibuang; bidang potongnya memperlihatkan lantai, air,
 * dan sirip seperti potongan 2D.
 */

export type IsoDenilState = {
  /** Lebar palung antar sirip, m */
  b: number;
  /** Kedalaman aliran tegak lurus dasar, m */
  y: number;
  /** Kemiringan palung (pecahan, bukan persen) */
  S: number;
  /** Beda tinggi seluruhnya, m */
  rise: number;
  /** Kecepatan sentak ikan rancangan, m/s */
  burst: number;
};

export type IsoDenilOptions = {
  yaw?: number;
  pitch?: number;
  heading?: string;
  headingColor?: string;
  teks?: {
    /** "sirip penahan" */
    sirip?: string;
    /** Tulisan palung terpotong, dari L terformat */
    terpotong?: (L: string) => string;
  };
};

/** Panjang palung tergambar paling panjang, m (sama dengan potongan). */
export const PANJANG_GAMBAR_MAKS = 8;

/**
 * Aturan gambar sirip potongan EH-02. SATU sumber untuk potongan 2D dan
 * isometrik (isinya loop potongan sebelum 3D, diuji sama).
 */
export function siripDenil(b: number, y: number, panjang: number) {
  const jarakSirip = Math.max(b * 0.6, 0.25);
  const jumlah = Math.max(2, Math.floor(panjang / jarakSirip));
  const tebal = Math.max(b * 0.06, 0.03);
  // Sirip penahan: bidang tipis miring ke hulu, tingginya sebagian
  // kedalaman palung. Sirip yang puncaknya akan menjulur ke hulu
  // melewati ujung palung (x < 0, di luar genangan; y besar dan S
  // curam) tidak digambar.
  const tinggi = y * 0.62;
  const miring = tinggi * 0.45;
  const iPertama = Math.max(1, Math.ceil((miring - 1e-9) / jarakSirip));
  const xs: number[] = [];
  for (let i = iPertama; i <= jumlah; i++) {
    const xx = i * jarakSirip;
    if (xx > panjang) break;
    xs.push(xx);
  }
  return { jarakSirip, tebal, tinggi, miring, xs };
}

export type PeranDenil =
  | "lantai"
  | "potong-lantai"
  | "potong-air"
  | "air-atas"
  | "air-ujung"
  | "dinding-dalam"
  | "dinding-atas"
  | "ujung"
  | "sirip"
  | "sirip-potong"
  | "garis-air"
  | "tepi";

export type MukaDenil = {
  muka: Muka[];
  peran: PeranDenil[];
  batas: { min: V3; max: V3 };
  panjang: number;
  terpotong: boolean;
  sirip: { x: number; puncakX: number; puncakZ: number }[];
  titik: { y: V3; sirip: V3 | null; ujung: V3 };
};

const L_LANTAI = -3;
const L_DINDING = -2;
const L_SIRIP = -1;
const L_AIR = 0.5;
const L_GARIS_JAUH = 0.6;
const L_POTONG = 1;
const L_SIRIP_POTONG = 1.1;
const L_GARIS_DEKAT = 1.5;
const L_UJUNG = 2;

let cache: { kunci: string; hasil: MukaDenil }[] = [];

/** Muka palung untuk sisi dekat tertentu; di-cache per masukan dan sisi. */
export function mukaDenil(s: IsoDenilState, sisi: -1 | 1): MukaDenil {
  const kunci = `${s.b}|${s.y}|${s.S}|${s.rise}|${sisi}`;
  const ada = cache.find((c) => c.kunci === kunci);
  if (ada) return ada.hasil;
  const hasil = bangun(s, sisi);
  cache.push({ kunci, hasil });
  if (cache.length > 4) cache = cache.slice(-4);
  return hasil;
}

function bangun(s: IsoDenilState, sisi: -1 | 1): MukaDenil {
  const r = denilFishway(s.b, s.y, s.S, s.rise);
  const panjang = Math.min(r.runLength, PANJANG_GAMBAR_MAKS);
  const terpotong = r.runLength > PANJANG_GAMBAR_MAKS;
  const aturan = siripDenil(s.b, s.y, panjang);
  const yT = r.depth * Math.sqrt(1 + s.S * s.S);
  const hd = s.b / 2;
  const tw = Math.max(0.1 * s.b, 0.04);
  const slab = aturan.tebal * 2;
  const zAtasRel = 1.25 * yT;
  const far = -sisi;
  const dasar = (x: number) => -s.S * x;
  const X0 = 0, X1 = panjang;

  const muka: Muka[] = [];
  const peran: PeranDenil[] = [];
  const tambah = (m: Muka, p: PeranDenil) => {
    muka.push(m);
    peran.push(p);
  };
  const urut = (pts: V3[], ccw: boolean) => (ccw ? pts : pts.slice().reverse());
  const gBeton = { garis: null, satuSisi: true } as const;

  // Lantai palung: satu bidang miring.
  tambah(
    { pts: [[X0, -hd, dasar(X0)], [X1, -hd, dasar(X1)], [X1, hd, dasar(X1)], [X0, hd, dasar(X0)]], ...gBeton, lapis: L_LANTAI },
    "lantai"
  );

  // Dinding jauh: muka dalam dan muka atas.
  const yi = far * hd, yo = far * (hd + tw);
  tambah(
    {
      pts: urut([[X0, yi, dasar(X0)], [X1, yi, dasar(X1)], [X1, yi, dasar(X1) + zAtasRel], [X0, yi, dasar(X0) + zAtasRel]], far > 0),
      ...gBeton,
      lapis: L_DINDING,
    },
    "dinding-dalam"
  );
  tambah(
    {
      pts: urut([[X0, yi, dasar(X0) + zAtasRel], [X1, yi, dasar(X1) + zAtasRel], [X1, yo, dasar(X1) + zAtasRel], [X0, yo, dasar(X0) + zAtasRel]], far > 0),
      ...gBeton,
      lapis: L_DINDING,
    },
    "dinding-atas"
  );

  // Bidang potong sisi dekat: pelat lantai dan air.
  const yn = sisi * hd;
  tambah(
    {
      pts: urut([[X0, yn, dasar(X0) - slab], [X1, yn, dasar(X1) - slab], [X1, yn, dasar(X1)], [X0, yn, dasar(X0)]], sisi < 0),
      garis: null,
      satuSisi: true,
      arsir: "beton",
      lapis: L_POTONG,
    },
    "potong-lantai"
  );
  tambah(
    {
      pts: urut([[X0, yn, dasar(X0)], [X1, yn, dasar(X1)], [X1, yn, dasar(X1) + yT], [X0, yn, dasar(X0) + yT]], sisi < 0),
      garis: null,
      satuSisi: true,
      bahan: "air",
      arsir: "air",
      lapis: L_POTONG,
    },
    "potong-air"
  );

  // Muka atas air: bidang sejajar lantai sejauh y tegak lurus.
  tambah(
    {
      pts: [[X0, -hd, dasar(X0) + yT], [X1, -hd, dasar(X1) + yT], [X1, hd, dasar(X1) + yT], [X0, hd, dasar(X0) + yT]],
      bahan: "air",
      garis: null,
      lapis: L_AIR,
    },
    "air-atas"
  );

  // Sirip: potongan 2D disapu selebar palung.
  const sirip: MukaDenil["sirip"] = [];
  for (const xx of aturan.xs) {
    const z0 = dasar(xx);
    const alas = [
      { x: xx, z: z0 },
      { x: xx + aturan.tebal, z: z0 },
      { x: xx + aturan.tebal - aturan.miring, z: z0 + aturan.tinggi },
      { x: xx - aturan.miring, z: z0 + aturan.tinggi },
    ];
    const pr = prismaY(alas, -hd, hd, { garis: C.ink, bobot: W.bold, satuSisi: true, lapis: L_SIRIP });
    const dekat = sisi < 0 ? pr.sisi0 : pr.sisi1;
    const jauh = sisi < 0 ? pr.sisi1 : pr.sisi0;
    tambah({ ...dekat, lapis: L_SIRIP_POTONG }, "sirip-potong");
    tambah(jauh, "sirip");
    for (const m of pr.selubung) tambah(m, "sirip");
    sirip.push({ x: xx, puncakX: xx - aturan.miring, puncakZ: z0 + aturan.tinggi });
  }

  // Garis: muka air di dinding jauh dan di bidang potong, tepi benda.
  const dashAir = r.slopeOutOfRange ? DASH.invalid : DASH.solid;
  tambah(garis([X0, yi, dasar(X0) + yT], [X1, yi, dasar(X1) + yT], C.water, W.thin, L_GARIS_JAUH, dashAir), "garis-air");
  tambah(garis([X0, yn, dasar(X0) + yT], [X1, yn, dasar(X1) + yT], C.water, W.thin, L_GARIS_DEKAT, dashAir), "garis-air");
  tambah(garis([X0, yn, dasar(X0)], [X1, yn, dasar(X1)], C.concrete, W.bold, L_GARIS_DEKAT), "tepi");
  tambah(garis([X0, yn, dasar(X0) - slab], [X1, yn, dasar(X1) - slab], C.concrete, W.bold, L_GARIS_DEKAT), "tepi");
  tambah(garis([X0, yi, dasar(X0) + zAtasRel], [X1, yi, dasar(X1) + zAtasRel], C.concrete, W.bold, L_GARIS_JAUH), "tepi");
  tambah(garis([X0, yo, dasar(X0) + zAtasRel], [X1, yo, dasar(X1) + zAtasRel], C.concrete, W.bold, L_DINDING + 0.5), "tepi");
  tambah(garis([X0, yi, dasar(X0)], [X1, yi, dasar(X1)], C.concrete, W.thin, L_DINDING + 0.5), "tepi");

  // Ujung palung: penampang melintang beton (pelat + dinding jauh) dan air.
  for (const [x, arah] of [
    [X0, -1],
    [X1, 1],
  ] as const) {
    const zb = dasar(x);
    const ccw = arah * sisi < 0;
    tambah(
      {
        pts: urut(
          [
            [x, yn, zb - slab],
            [x, yo, zb - slab],
            [x, yo, zb + zAtasRel],
            [x, yi, zb + zAtasRel],
            [x, yi, zb],
            [x, yn, zb],
          ],
          ccw
        ),
        arsir: "beton",
        garis: C.concrete,
        bobot: W.bold,
        satuSisi: true,
        lapis: L_UJUNG,
      },
      "ujung"
    );
    tambah(
      {
        pts: urut([[x, yn, zb], [x, yi, zb], [x, yi, zb + yT], [x, yn, zb + yT]], ccw),
        bahan: "air",
        arsir: "air",
        garis: C.water,
        bobot: W.thin,
        satuSisi: true,
        lapis: L_UJUNG,
      },
      "air-ujung"
    );
  }

  const ym = hd + tw;
  const s2 = sirip.length > 1 ? sirip[1] : sirip[0];
  return {
    muka,
    peran,
    batas: { min: [X0, -ym, dasar(X1) - slab], max: [X1, ym, dasar(X0) + zAtasRel] },
    panjang,
    terpotong,
    sirip,
    titik: {
      y: [X1 * 0.9, yn, dasar(X1 * 0.9) + yT],
      sirip: s2 ? [s2.puncakX, yn, s2.puncakZ] : null,
      ujung: [X1, yn, dasar(X1) - slab],
    },
  };
}

/** Ruang judul di atas gambar, px. */
export const RUANG_JUDUL_ISO = 34;
/** Margin kameraPas di keempat sisi, px. */
export const MARGIN_ISO = 20;
/** Pandangan awal: pengamat di hilir sisi −y, seperti HS-02. */
export const PANDANG_AWAL = { yaw: -ISO.yaw, pitch: ISO.pitch } as const;

/** Tinggi/lebar kotak batas pada pandangan awal (tinggi bidang di HP). */
export function rasioIsoDenil(s: IsoDenilState): number {
  return rasioBatas(mukaDenil(s, -1).batas, PANDANG_AWAL.yaw, PANDANG_AWAL.pitch);
}

/** Menggambar EH-02 isometrik. Tanpa pegangan (potongan 2D tetap memegang y dan S). */
export function drawIsoDenil(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: IsoDenilState,
  opts: IsoDenilOptions = {}
): PlateOut & { kamera: Kamera } {
  ground(ctx, w, h);
  const yaw = opts.yaw ?? PANDANG_AWAL.yaw;
  const pitch = opts.pitch ?? PANDANG_AWAL.pitch;
  const k = kameraPas(mukaDenil(s, -1).batas, w, h - RUANG_JUDUL_ISO, yaw, pitch, MARGIN_ISO);
  k.cy += RUANG_JUDUL_ISO;
  const g = mukaDenil(s, sisiDekat(k));
  gambarMuka(ctx, g.muka, k, { bingkai: { x0: 0, y0: 0, x1: w, y1: h } });

  const r = denilFishway(s.b, s.y, s.S, s.rise);
  const tidakMampu = r.maxVelocity > s.burst;
  const placer = createLabelPlacer(ctx, { padL: 0, padT: 0, plotW: w, plotH: h });
  if (opts.heading) placer.write(opts.heading, w / 2, 20, opts.headingColor ?? C.ink3, { big: true });

  /* Panah aliran di sumbu muka air (searah aliran), berlabel kecepatan
     sumbu model. Bukan medan aliran: satu besaran, satu panah. */
  const yT = r.depth * Math.sqrt(1 + s.S * s.S);
  const xa = g.panjang * 0.18;
  const xb = g.panjang * 0.4;
  const A = anchor3([xa, 0, -s.S * xa + yT], k);
  const B = anchor3([xb, 0, -s.S * xb + yT], k);
  const warnaPanah = tidakMampu ? C.caution : C.water;
  const dx = B.x - A.x, dy = B.y - A.y;
  const Lp = Math.hypot(dx, dy);
  if (Lp > 12) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    pen(ctx, W.thin, warnaPanah, DASH.solid);
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();
    const ux = dx / Lp, uy = dy / Lp;
    ctx.fillStyle = warnaPanah;
    ctx.beginPath();
    ctx.moveTo(B.x, B.y);
    ctx.lineTo(B.x - 8 * ux - 3.5 * uy, B.y - 8 * uy + 3.5 * ux);
    ctx.lineTo(B.x - 8 * ux + 3.5 * uy, B.y - 8 * uy - 3.5 * ux);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const xm = (xa + xb) / 2;
  tulisPenunjuk(ctx, placer, `Vmaks ${fmtPlain(r.maxVelocity, 2)} m/s`, [xm, 0, -s.S * xm + yT], k, 20, -30, warnaPanah, w);
  tulisPenunjuk(ctx, placer, `y ${fmtPlain(r.depth, 2)} m`, g.titik.y, k, 22, 26, C.water, w);
  if (g.titik.sirip && opts.teks?.sirip) tulisPenunjuk(ctx, placer, opts.teks.sirip, g.titik.sirip, k, -24, 30, C.ink, w);
  if (g.terpotong && opts.teks?.terpotong)
    tulisPenunjuk(ctx, placer, opts.teks.terpotong(fmtPlain(r.runLength, 1)), g.titik.ujung, k, 20, 22, C.ink3, w);

  const out = plateOut3(k, w, h, {});
  return { ...out, labels: rectsFrom(placer.boxes()), kamera: k };
}
