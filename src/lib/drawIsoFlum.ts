import { C, DASH, W } from "./theme.ts";
import { createLabelPlacer, ground } from "./plate.ts";
import { rectsFrom, type PlateOut } from "./plateOut.ts";
import { flumeDischarge, fmtPlain, type FlumeResult } from "./hydraulics.ts";
import {
  ISO,
  gambarMuka,
  kameraPas,
  plateOut3,
  sumbuGaris,
  type Kamera,
  type Muka,
  type V3,
} from "./proyeksi.ts";
import { garis, rasioBatas, sisiDekat, stasiunGabung, tulisPenunjuk, zPolyline } from "./isoBantu.ts";

/**
 * FM-04 3D: FLUM BERLEHER PANJANG PERSEGI, ISOMETRIK.
 *
 * Dari model flumeDischarge (hydraulics.ts), bukan karangan:
 * - Lebar saluran datang B, lebar leher b, panjang leher L, tinggi mercu p.
 *   Penampang persegi: dinding tegak (model tidak punya kemiringan dinding)
 * - Muka air: profil yang SAMA dengan potongan memanjang lembar ini
 *   (profilFlum, dipakai juga oleh susun() di Client): datar p + h₁ sampai
 *   penampang ukur, turun ke p + yc di awal leher, kritis (yc = ⅔ H₁)
 *   sepanjang leher, lalu peralihan ke muka air hilir (bertitik: tidak
 *   dihitung, sama dengan 2D)
 * - Garis energi p + H₁ sampai ujung leher dan garis kritis hanya bila
 *   model menyatakan leher mengendalikan aliran; tenggelam = garis kritis
 *   hilang, muka air hulu-leher bertitik (bentuknya tidak diketahui)
 *
 * SKEMATIK (ditulis di catatan lembar):
 * - Panjang bagian: saluran datang 2,5 L, peralihan menyempit 1 L, leher
 *   L, peralihan melebar 2 L, hilir 1,5 L: aturan gambar potongan lembar
 *   ini, bukan ukuran ISO 4359. Denah peralihan lurus
 * - Tinggi dinding 1,2 × muka air tertinggi, tebal dinding dan pelat
 *   lantai tidak ada di model
 * - Dinding sisi dekat dibuang: bidang potongnya memperlihatkan lantai dan
 *   air seperti potongan 2D
 *
 * Koordinat: x searah aliran dari ujung hulu gambar, y melintang dengan
 * sumbu saluran di y = 0, z elevasi dari dasar saluran datang, DIKALI
 * pelebihan tegak ex (ex = 1 kecuali flum sangat pipih; tertulis di gambar).
 */

export type IsoFlumState = {
  /** Tinggi muka air di atas mercu leher, m */
  h1: number;
  /** Lebar leher, m */
  b: number;
  /** Lebar saluran datang, m */
  B: number;
  /** Tinggi mercu leher, m */
  p: number;
  /** Panjang leher, m */
  Lt: number;
  Cd: number;
  /** Muka air hilir di atas dasar, m */
  tail: number;
};

export type IsoFlumOptions = {
  yaw?: number;
  pitch?: number;
  /** Judul gambar, sudah dalam bahasa lembar */
  heading?: string;
  /** Judul merah sinyal (keadaan di luar rentang) */
  headingSignal?: boolean;
  /** Tulisan dalam bahasa lembar */
  teks?: {
    /** "pelebihan tegak" */
    exagg?: string;
    /** "penampang ukur" */
    ukur?: string;
    /** "leher tidak mengendalikan aliran, ..." */
    takKendali?: string;
  };
  /**
   * Kamera dan pelebihan tegak dikunci selama pegangan diseret: tanpa
   * kunci, kotak batas (tinggi dinding dari H₁, lebar dari max(B, b))
   * berubah tiap piksel geseran dan pegangan saling kejar dengan skala.
   */
  kunci?: { kamera: Kamera; ex: number };
};

/* ------------------------------------------------------------------ *
 * Profil bersama potongan dan isometrik
 * ------------------------------------------------------------------ */

/** Stasiun potongan memanjang, kelipatan panjang leher (aturan gambar lembar). */
export function stasiunFlum(Lt: number) {
  const xDatang = 2.5 * Lt;
  const xKerucut = 1.0 * Lt;
  const xLeher = Lt;
  const xLebar = 2.0 * Lt;
  const xHilir = 1.5 * Lt;
  const a1 = xDatang;
  const a2 = a1 + xKerucut;
  const a3 = a2 + xLeher;
  const a4 = a3 + xLebar;
  const L = a4 + xHilir;
  return { a1, a2, a3, a4, L };
}

export type TitikProfil = { x: number; z: number; invalid?: boolean };

/**
 * Dasar dan muka air potongan memanjang. SATU sumber untuk potongan 2D
 * (susun di Client) dan isometrik; isinya persis kode potongan sebelum 3D
 * (diuji sama). Leher tak terkendali: muka air datar p + h₁ bertitik.
 */
export function profilFlum(
  r: FlumeResult,
  h1: number,
  p: number,
  Lt: number,
  tail: number,
  tenggelam: boolean
): { bed: TitikProfil[]; water: TitikProfil[]; xUkur: number; zUkur: number; zKritis: number } {
  const { a1, a2, a3, a4, L } = stasiunFlum(Lt);
  const bed: TitikProfil[] = [
    { x: 0, z: 0 },
    { x: a1, z: 0 },
    { x: a2, z: p },
    { x: a3, z: p },
    { x: a4, z: 0 },
    { x: L, z: 0 },
  ];

  const xUkur = Math.max(0.4 * Lt, a1 - 2.5 * h1);
  const zUkur = p + h1;
  const zKritis = p + r.yc;

  // Muka air: mendatar sampai penampang ukur, turun halus menuju kondisi
  // kritis di leher, tetap kritis sepanjang leher, lalu jatuh ke muka air
  // hilir. Ruas terakhir sengaja digambar sebagai peralihan, bukan hasil
  // hitungan, karena lembar ini tidak menelusuri profil di hilir leher.
  const air: TitikProfil[] = [{ x: 0, z: zUkur }, { x: xUkur, z: zUkur }];
  for (let i = 1; i <= 20; i++) {
    const f = i / 20;
    const xx = xUkur + (a2 - xUkur) * f;
    // Saat tenggelam bentuk muka air di kerucut dan leher tidak diketahui
    // lembar ini, jadi digambar bertitik rapat.
    air.push({ x: xx, z: zUkur - (zUkur - zKritis) * f * f, invalid: tenggelam || undefined });
  }
  air.push({ x: a3, z: zKritis, invalid: tenggelam || undefined });
  const zAkhir = Math.max(tail, 0.02);
  for (let i = 1; i <= 16; i++) {
    const f = i / 16;
    const xx = a3 + (a4 - a3) * f;
    air.push({ x: xx, z: zKritis - (zKritis - zAkhir) * Math.sqrt(f), invalid: true });
  }
  air.push({ x: L, z: zAkhir, invalid: true });

  const water: TitikProfil[] = r.controlled
    ? air
    : [
        { x: 0, z: zUkur, invalid: true },
        { x: L, z: zUkur, invalid: true },
      ];
  return { bed, water, xUkur, zUkur, zKritis };
}

/** Lebar dalam saluran di x: B, menyempit lurus ke b, leher b, melebar ke B. */
export function lebarFlum(x: number, s: Pick<IsoFlumState, "b" | "B" | "Lt">): number {
  const { a1, a2, a3, a4 } = stasiunFlum(s.Lt);
  if (x <= a1) return s.B;
  if (x < a2) return s.B + ((s.b - s.B) * (x - a1)) / (a2 - a1);
  if (x <= a3) return s.b;
  if (x < a4) return s.b + ((s.B - s.b) * (x - a3)) / (a4 - a3);
  return s.B;
}

function model(s: IsoFlumState) {
  const r = flumeDischarge(s.h1, s.b, s.B, s.p, s.Lt, s.Cd);
  return { r, tenggelam: r.controlled && s.tail > r.tailLimit };
}

/** Tinggi dinding skematik (m, sebelum pelebihan): 1,2 × muka air tertinggi. */
function tinggiDinding(s: IsoFlumState, r: FlumeResult): number {
  return 1.2 * Math.max(s.p + (r.controlled ? r.H1 : s.h1), s.p + s.h1, s.tail, 0.02);
}

/** Pilihan pelebihan tegak yang bulat. */
const PELEBIHAN = [1, 2, 5, 10, 20, 50, 100] as const;
/** Tinggi gambar paling kecil terhadap panjangnya sebelum dilebihkan. */
const RASIO_TEGAK_MIN = 0.08;

/**
 * Pelebihan tegak: 1 kecuali tinggi dinding < 8 % panjang gambar (flum
 * sangat pipih, mis. h₁ 0,02 m dengan leher 5 m); lalu kelipatan bulat
 * terkecil yang mencapai 8 %. Bila ≠ 1 gambar menulis "pelebihan tegak N×".
 */
export function pelebihanTegak(s: IsoFlumState): number {
  const { r } = model(s);
  const rasio = tinggiDinding(s, r) / Math.max(stasiunFlum(s.Lt).L, 1e-9);
  for (const e of PELEBIHAN) if (rasio * e >= RASIO_TEGAK_MIN) return e;
  return PELEBIHAN[PELEBIHAN.length - 1];
}

/* ------------------------------------------------------------------ *
 * Muka
 * ------------------------------------------------------------------ */

export type PeranFlum =
  | "lantai"
  | "potong-lantai"
  | "potong-air"
  | "air-atas"
  | "air-ujung"
  | "dinding-dalam"
  | "dinding-atas"
  | "ujung"
  | "garis-air"
  | "garis-energi"
  | "garis-kritis"
  | "garis-tenggelam"
  | "garis-ukur"
  | "tepi";

export type MukaFlum = {
  muka: Muka[];
  /** Peran tiap muka, sejajar `muka` (untuk uji) */
  peran: PeranFlum[];
  batas: { min: V3; max: V3 };
  ex: number;
  /** Titik dunia tulisan (sudah dikali ex) */
  titik: { ukur: V3; leher: V3; energi: V3 | null; tengah: V3 };
};

/*
 * Lapis gambar (lihat proyeksi.ts): lantai dulu, lalu dinding jauh, air,
 * garis di dinding jauh, bidang potong sisi dekat, garis di bidang potong.
 */
const L_LANTAI = -3;
const L_DINDING = -2;
const L_AIR = 0;
const L_GARIS_JAUH = 0.5;
const L_POTONG = 1;
const L_POTONG_AIR = 1.2;
const L_GARIS_DEKAT = 1.5;
const L_UJUNG = 2;

let cache: { kunci: string; hasil: MukaFlum }[] = [];

/** Muka seluruh flum untuk sisi dekat tertentu; di-cache per masukan dan sisi. */
export function mukaFlum(s: IsoFlumState, sisi: -1 | 1, exPaksa?: number): MukaFlum {
  const kunci = `${s.h1}|${s.b}|${s.B}|${s.p}|${s.Lt}|${s.Cd}|${s.tail}|${sisi}|${exPaksa ?? ""}`;
  const ada = cache.find((c) => c.kunci === kunci);
  if (ada) return ada.hasil;
  const hasil = bangun(s, sisi, exPaksa ?? pelebihanTegak(s));
  cache.push({ kunci, hasil });
  if (cache.length > 4) cache = cache.slice(-4);
  return hasil;
}

function bangun(s: IsoFlumState, sisi: -1 | 1, ex: number): MukaFlum {
  const { r, tenggelam } = model(s);
  const st = stasiunFlum(s.Lt);
  const prof = profilFlum(r, s.h1, s.p, s.Lt, s.tail, tenggelam);
  const zAtas = tinggiDinding(s, r);
  const Bmaks = Math.max(s.B, s.b);
  const tw = Math.max(0.05 * Bmaks, 0.03);
  const lantai = Math.max(0.12 * zAtas, 0.04);
  const Z = (z: number) => z * ex;
  const far = -sisi;

  const muka: Muka[] = [];
  const peran: PeranFlum[] = [];
  const tambah = (m: Muka, p: PeranFlum) => {
    muka.push(m);
    peran.push(p);
  };

  const xs = stasiunGabung(
    [...prof.water.map((q) => q.x), st.a1, st.a2, st.a3, st.a4],
    st.L,
    8
  );
  const n = xs.length;
  const wv = xs.map((x) => lebarFlum(x, s) / 2);
  const zw = xs.map((x) => Z(zPolyline(prof.water, x)));
  const zBed = (x: number) => Z(zPolyline(prof.bed, x));
  // Ruas muka air bertitik: titik akhir ruas polyline yang memuatnya bertanda invalid.
  const ruasTak = (xm: number) => {
    for (let j = 0; j + 1 < prof.water.length; j++)
      if (xm <= prof.water[j + 1].x) return !!prof.water[j + 1].invalid;
    return !!prof.water[prof.water.length - 1].invalid;
  };

  const gBeton = { garis: null, satuSisi: true } as const;
  const zt = Z(zAtas);
  const zAlas = Z(-lantai);

  /*
   * Bagian lurus denah: hulu, menyempit, leher, melebar, hilir. Di tiap
   * bagian lantai, dinding, dan bidang potong masing-masing SATU bidang
   * datar, jadi digambar satu muka per bagian (arsir hanya belasan muka).
   * Urutannya diatur lapis, bukan titik berat, jadi muka panjang aman.
   */
  const bagian = [0, st.a1, st.a2, st.a3, st.a4, st.L];
  for (let j = 0; j + 1 < bagian.length; j++) {
    const x0 = bagian[j], x1 = bagian[j + 1];
    if (x1 - x0 < 1e-12) continue;
    const w0 = lebarFlum(x0, s) / 2, w1 = lebarFlum(x1, s) / 2;
    const b0 = zBed(x0), b1 = zBed(x1);

    // Lantai (normal ke atas).
    tambah({ pts: [[x0, -w0, b0], [x1, -w1, b1], [x1, w1, b1], [x0, w0, b0]], ...gBeton, lapis: L_LANTAI }, "lantai");

    // Dinding jauh: muka dalam (normal ke arah sumbu) dan muka atas.
    const yi0 = far * w0, yi1 = far * w1;
    const yo0 = far * (w0 + tw), yo1 = far * (w1 + tw);
    const dalam: V3[] = [[x0, yi0, b0], [x1, yi1, b1], [x1, yi1, zt], [x0, yi0, zt]];
    tambah({ pts: far > 0 ? dalam : dalam.slice().reverse(), ...gBeton, lapis: L_DINDING }, "dinding-dalam");
    const atas: V3[] = [[x0, yi0, zt], [x1, yi1, zt], [x1, yo1, zt], [x0, yo0, zt]];
    tambah({ pts: far < 0 ? atas.slice().reverse() : atas, ...gBeton, lapis: L_DINDING }, "dinding-atas");

    // Bidang potong sisi dekat di muka dalam dinding: lantai (pelat dan mercu) dan air.
    const yn0 = sisi * w0, yn1 = sisi * w1;
    const pot: V3[] = [[x0, yn0, zAlas], [x1, yn1, zAlas], [x1, yn1, b1], [x0, yn0, b0]];
    tambah(
      { pts: sisi < 0 ? pot : pot.slice().reverse(), garis: null, satuSisi: true, arsir: "beton", lapis: L_POTONG },
      "potong-lantai"
    );
    const pa: V3[] = [[x0, yn0, b0], [x1, yn1, b1]];
    for (let i = n - 1; i >= 0; i--)
      if (xs[i] >= x0 - 1e-12 && xs[i] <= x1 + 1e-12) pa.push([xs[i], sisi * wv[i], Math.max(zw[i], zBed(xs[i]))]);
    tambah(
      { pts: sisi < 0 ? pa : pa.slice().reverse(), garis: null, satuSisi: true, bahan: "air", arsir: "air", lapis: L_POTONG_AIR },
      "potong-air"
    );

    // Tepi benda: profil lantai dan alas pelat di bidang potong, tepi dinding jauh.
    tambah(garis([x0, yn0, b0], [x1, yn1, b1], C.concrete, W.bold, L_GARIS_DEKAT), "tepi");
    tambah(garis([x0, yn0, zAlas], [x1, yn1, zAlas], C.concrete, W.bold, L_GARIS_DEKAT), "tepi");
    tambah(garis([x0, yi0, zt], [x1, yi1, zt], C.concrete, W.bold, L_GARIS_JAUH), "tepi");
    tambah(garis([x0, yo0, zt], [x1, yo1, zt], C.concrete, W.bold, L_DINDING + 0.5), "tepi");
    tambah(garis([x0, yi0, b0], [x1, yi1, b1], C.concrete, W.thin, L_DINDING + 0.5), "tepi");
  }

  // Muka atas air per stasiun profil, dan garis muka air di dinding jauh
  // dan di bidang potong; bertitik bila tidak dihitung (seperti 2D).
  for (let i = 0; i + 1 < n; i++) {
    const x0 = xs[i], x1 = xs[i + 1];
    const w0 = wv[i], w1 = wv[i + 1];
    const a0 = zw[i], a1 = zw[i + 1];
    tambah(
      { pts: [[x0, -w0, a0], [x1, -w1, a1], [x1, w1, a1], [x0, w0, a0]], bahan: "air", garis: null, lapis: L_AIR },
      "air-atas"
    );
    const dashAir = ruasTak((x0 + x1) / 2) ? DASH.invalid : DASH.solid;
    tambah(garis([x0, far * w0, a0], [x1, far * w1, a1], C.water, W.thin, L_GARIS_JAUH, dashAir), "garis-air");
    tambah(garis([x0, sisi * w0, a0], [x1, sisi * w1, a1], C.water, W.thin, L_GARIS_DEKAT, dashAir), "garis-air");
  }

  // Patahan lantai melintang di awal/akhir peralihan dan leher.
  for (const x of [st.a1, st.a2, st.a3, st.a4]) {
    const w = lebarFlum(x, s) / 2;
    const z = Z(zPolyline(prof.bed, x));
    tambah(garis([x, -w, z], [x, w, z], C.concrete, W.thin, L_LANTAI + 0.5), "tepi");
    tambah(garis([x, far * w, z], [x, far * w, Z(zAtas)], C.concrete, W.thin, L_DINDING + 0.5), "tepi");
  }

  // Ujung gambar x = 0 dan x = L: bidang potong melintang (beton dan air).
  for (const [x, arah] of [
    [0, -1],
    [st.L, 1],
  ] as const) {
    const w = lebarFlum(x, s) / 2;
    const zb = Z(zPolyline(prof.bed, x));
    const za = Z(zPolyline(prof.water, x));
    const zt = Z(zAtas);
    const yN = sisi * w;
    const yF = far * (w + tw);
    const yFi = far * w;
    // Pelat lantai dan dinding jauh sebagai satu penampang L.
    const penampang: V3[] = [
      [x, yN, Z(-lantai)],
      [x, yF, Z(-lantai)],
      [x, yF, zt],
      [x, yFi, zt],
      [x, yFi, zb],
      [x, yN, zb],
    ];
    const ccw = arah * sisi < 0;
    tambah(
      {
        pts: ccw ? penampang : penampang.slice().reverse(),
        arsir: "beton",
        garis: C.concrete,
        bobot: W.bold,
        satuSisi: true,
        lapis: L_UJUNG,
      },
      "ujung"
    );
    if (za > zb + 1e-12) {
      const air: V3[] = [
        [x, yN, zb],
        [x, yFi, zb],
        [x, yFi, za],
        [x, yN, za],
      ];
      tambah(
        {
          pts: ccw ? air : air.slice().reverse(),
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
  }

  // Garis model di bidang potong (seperti potongan 2D), dipatah di tiap bagian denah.
  const bagianX = [st.a1, st.a2, st.a3, st.a4];
  const diPotong = (x: number, z: number): V3 => [x, (sisi * lebarFlum(x, s)) / 2, Z(z)];
  const garisDi = (xa: number, xb: number, z: number, warna: string, bobot: number, dash: readonly number[], p: PeranFlum) => {
    const potong = bagianX.filter((x) => x > xa && x < xb);
    const t = [xa, ...potong, xb];
    for (let i = 0; i + 1 < t.length; i++) tambah(garis(diPotong(t[i], z), diPotong(t[i + 1], z), warna, bobot, L_GARIS_DEKAT, dash), p);
  };
  if (r.controlled) {
    garisDi(0, st.a3, s.p + r.H1, C.energy, W.thin, DASH.hidden, "garis-energi");
    if (!tenggelam) garisDi(st.a1, st.a4, s.p + r.yc, C.critical, W.hair, DASH.axis, "garis-kritis");
    garisDi(st.a3, st.L, r.tailLimit, s.tail > r.tailLimit ? C.signal : C.caution, W.hair, DASH.phantom, "garis-tenggelam");
  }
  // Penampang ukur: tanda tegak dari dasar sampai muka air.
  tambah(garis(diPotong(prof.xUkur, 0), diPotong(prof.xUkur, prof.zUkur), C.water, W.thin, L_GARIS_DEKAT), "garis-ukur");

  const yMaks = Bmaks / 2 + tw;
  const zMaks = Z(Math.max(zAtas, r.controlled ? s.p + r.H1 : 0, r.controlled ? r.tailLimit : 0));
  return {
    muka,
    peran,
    batas: { min: [0, -yMaks, Z(-lantai)], max: [st.L, yMaks, zMaks] },
    ex,
    titik: {
      ukur: diPotong(prof.xUkur, prof.zUkur),
      leher: [(st.a2 + st.a3) / 2, (sisi * s.b) / 2, Z(s.p + r.yc)],
      energi: r.controlled ? diPotong(st.a1 * 0.5, s.p + r.H1) : null,
      tengah: [st.L / 2, 0, Z(zPolyline(prof.water, st.L / 2))],
    },
  };
}

/* ------------------------------------------------------------------ *
 * Gambar
 * ------------------------------------------------------------------ */

/** Ruang judul di atas gambar, px. */
export const RUANG_JUDUL_ISO = 34;
/** Margin kameraPas di keempat sisi, px. */
export const MARGIN_ISO = 20;
/** Pandangan awal: pengamat di hilir sisi −y, seperti HS-02. */
export const PANDANG_AWAL = { yaw: -ISO.yaw, pitch: ISO.pitch } as const;

/** Tinggi/lebar kotak batas pada pandangan awal (tinggi bidang di HP). */
export function rasioIsoFlum(s: IsoFlumState): number {
  return rasioBatas(mukaFlum(s, -1).batas, PANDANG_AWAL.yaw, PANDANG_AWAL.pitch);
}

/**
 * Sumbu layar seret pegangan lebar leher dari yaw/pitch saja. Garis pegangan
 * sejajar sumbu y dunia di aras tetap, jadi arah proyeksinya tidak
 * bergantung pada skala, cx, cy, xm, sisi, maupun pelebihan tegak. Client
 * memanggil ini saat render, supaya sumbu tidak tertinggal satu render dari
 * kamera (ref gambar baru terisi sesudah menggambar). Sama dengan
 * drawIsoFlum(...).sumbuLeher (diuji).
 */
export function sumbuLeherFlum(yaw: number, pitch: number): "x" | "y" {
  return sumbuGaris({ yaw, pitch, skala: 1, cx: 0, cy: 0 }, [0, 0, 0], [0, 1, 0]);
}

/**
 * Menggambar FM-04 isometrik. Mengembalikan PlateOut dengan anchor
 * `leher` (tepi leher sisi dekat setinggi mercu, di tengah panjang leher)
 * dan garis pegangannya: titik di garisLeher.a + t·(b − a) adalah tepi
 * leher selebar t, jadi t = lebar leher (balikDiGarisSumbu dengan
 * sumbuLeher memberi b langsung dari piksel).
 */
export function drawIsoFlum(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: IsoFlumState,
  opts: IsoFlumOptions = {}
): PlateOut & { kamera: Kamera; ex: number; garisLeher: { a: V3; b: V3 }; sumbuLeher: "x" | "y" } {
  ground(ctx, w, h);
  const yaw = opts.yaw ?? PANDANG_AWAL.yaw;
  const pitch = opts.pitch ?? PANDANG_AWAL.pitch;
  const ex = opts.kunci?.ex ?? pelebihanTegak(s);
  let k: Kamera;
  if (opts.kunci) k = opts.kunci.kamera;
  else {
    // Kotak batas dari varian sisi −y; kedua varian sama besar.
    k = kameraPas(mukaFlum(s, -1, ex).batas, w, h - RUANG_JUDUL_ISO, yaw, pitch, MARGIN_ISO);
    k.cy += RUANG_JUDUL_ISO;
  }
  const sisi = sisiDekat(k);
  const g = mukaFlum(s, sisi, ex);
  gambarMuka(ctx, g.muka, k, { bingkai: { x0: 0, y0: 0, x1: w, y1: h } });

  const { r, tenggelam } = model(s);
  const placer = createLabelPlacer(ctx, { padL: 0, padT: 0, plotW: w, plotH: h });
  if (opts.heading) placer.write(opts.heading, w / 2, 20, opts.headingSignal ? C.signal : C.ink3, { big: true });
  if (ex !== 1 && opts.teks?.exagg)
    placer.write(`${opts.teks.exagg} ${ex}×`, w / 2, 38, C.ink3);

  const t = g.titik;
  tulisPenunjuk(ctx, placer, `${opts.teks?.ukur ? `${opts.teks.ukur} ` : ""}h₁ ${fmtPlain(s.h1, 3)} m`, t.ukur, k, -26, -30, C.water, w);
  if (r.controlled && t.energi)
    tulisPenunjuk(ctx, placer, `H₁ ${fmtPlain(r.H1, 3)} m`, t.energi, k, 24, -26, C.energy, w);
  if (r.controlled && !tenggelam)
    tulisPenunjuk(ctx, placer, `yc ${fmtPlain(r.yc, 3)} m, Fr = 1`, t.leher, k, 28, -34, C.critical, w);
  if (!r.controlled && opts.teks?.takKendali)
    tulisPenunjuk(ctx, placer, opts.teks.takKendali, t.tengah, k, 24, -40, C.signal, w);

  const st = stasiunFlum(s.Lt);
  const xm = (st.a2 + st.a3) / 2;
  const zH = s.p * ex;
  const garisLeher = { a: [xm, 0, zH] as V3, b: [xm, sisi * 0.5, zH] as V3 };
  const out = plateOut3(k, w, h, { leher: [xm, (sisi * s.b) / 2, zH] });
  return {
    ...out,
    labels: rectsFrom(placer.boxes()),
    kamera: k,
    ex,
    garisLeher,
    sumbuLeher: sumbuGaris(k, garisLeher.a, garisLeher.b),
  };
}
