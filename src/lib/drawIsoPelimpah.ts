import { C, DASH, F, W } from "./theme.ts";
import { createLabelPlacer, ground, pen } from "./plate.ts";
import { rectsFrom, type PlateOut } from "./plateOut.ts";
import { sideChannelProfile, type TroughResult } from "./hydraulics.ts";
import {
  ISO,
  anchor3,
  gambarMuka,
  kameraPas,
  plateOut3,
  type Kamera,
  type Muka,
  type V3,
} from "./proyeksi.ts";

/**
 * HS-10 3D: PELIMPAH SALURAN SAMPING ISOMETRIK, STATIS.
 *
 * Model lembar ini TUNAK (sideChannelProfile, metode beda hingga Hinds),
 * jadi gambar 3D-nya diam: muka air yang naik seiring waktu adalah
 * permintaan klien yang tertunda (B10) sampai ada model tak tunak.
 *
 * Koordinat: x searah saluran pengumpul dari pangkal (0) ke ujung keluar
 * (L), sama dengan x model; y melintang, 0..b di antara dinding, waduk dan
 * mercu di sisi y < 0; z elevasi terhadap dasar ujung keluar (datum model),
 * DIKALIKAN skala tegak ev.
 *
 * Dari model (diuji):
 * - Muka air: tepat ws di tiap stasiun r.points, satu muka per selang
 *   stasiun, tanpa titik sisipan. Penampang kendali di x = L setinggi ycOut
 * - Dasar z = S₀(L − x), lebar b, panjang mercu = L pada elevasi z_m
 * - Hulu superkritis (supercriticalFrom): air tidak digambar di hulu titik
 *   berhenti, dasar di sana diarsir merah sinyal
 *
 * SKEMATIK (ditulis di catatan lembar):
 * - Tirai luapan tidak digambar: model tidak menghitung tinggi muka air di
 *   atas mercu (tidak ada koefisien ambang), jadi wesNappe tidak punya Hd.
 *   Aliran masuk lateral hanya ditandai panah arah, bukan lintasan
 * - Peluncur: panjang max(0,3 L; 1,5 b), kemiringan 1 : 4, lebar b. Aliran
 *   di peluncur tidak dihitung, jadi airnya tidak digambar
 * - Tebal dinding, tebal lantai, bentuk mercu (dinding tegak), tinggi
 *   dinding seberang dan dinding peluncur
 *
 * Urutan gambar: painter's algorithm memecah dinding dan air per stasiun,
 * dan lapis dipilih dari sisi pengamat (kuadran yaw): dinding di sisi
 * pengamat digambar sesudah air, dinding di sisi jauh sebelum air. Muka
 * dalam dinding hanya dari muka air ke atas, jadi tidak pernah menindih
 * air dari belakang.
 */

export type IsoPelimpahState = {
  Q: number;
  b: number;
  n: number;
  S0: number;
  L: number;
  /** Elevasi mercu di atas dasar ujung keluar, m */
  zCrest: number;
};

export type LabelPelimpah = {
  crest: string;
  trough: string;
  /** Nama penampang kendali, angka yc ditambahkan penggambar */
  control: string;
  chute: string;
  inflow: string;
  profileEnds: string;
  /** "skala tegak" / "vertical scale" */
  exagg: string;
};

export type IsoPelimpahOptions = {
  yaw?: number;
  pitch?: number;
  heading?: string;
  /** Judul berwarna sinyal (mercu tenggelam, superkritis, mustahil) */
  headingSignal?: boolean;
  label?: LabelPelimpah;
  /** Pemformat angka lembar (koma desimal di ID) */
  fmt?: (v: number, d: number) => string;
};

export type Bagian =
  | "dasar-atas"
  | "dasar-peluncur"
  | "dasar-ujung"
  | "dasar-sinyal"
  | "air-atas"
  | "air-sisi"
  | "air-kendali"
  | "air-hulu"
  | "air-garis"
  | "air-tenggelam"
  | `${"mercu" | "seberang" | "pangkal" | "peluncur"}-${"luar" | "puncak" | "dalam" | "ujung" | "tepi"}`;

/**
 * tepi: garis dua titik (tepi benda yang dipecah per ruas). Muka yang
 * dipecah digambar tanpa garis supaya sambungan ruas tidak tampak sebagai
 * garis; tepi aslinya digambar sesudah muka di lapis yang sama.
 */
export type MukaPelimpah = Muka & { bagian: Bagian; tepi?: boolean };

export type GeometriPelimpah = {
  r: TroughResult;
  /** Skala tegak (bulat) */
  ev: number;
  /** Tebal dinding dan lantai, m (skematik) */
  t: number;
  /** Elevasi puncak dinding seberang dan pangkal, m (skematik) */
  zTop: number;
  chuteLength: number;
  chuteDrop: number;
  /** Elevasi tertinggi yang dipakai untuk skala tegak, m */
  zSpan: number;
  /** Panjang ekor panah aliran masuk di sisi waduk, m */
  arrowTail: number;
};

/** Kemiringan peluncur skematik (1 : 4). */
export const KEMIRINGAN_PELUNCUR = 0.25;

/**
 * Skala tegak bulat 1..4: dibesarkan hanya bila saluran sangat panjang DAN
 * lebar terhadap tingginya (min(L/8, b) / z dibulatkan), supaya kenaikan
 * muka air terbaca tanpa dinding yang dilebihkan menutupi saluran sempit.
 * Bergantung pada masukan saja, bukan sudut pandang.
 */
export function skalaTegak(s: IsoPelimpahState): number {
  return geometriPelimpah(s).ev;
}

export function geometriPelimpah(s: IsoPelimpahState): GeometriPelimpah {
  const r = sideChannelProfile(s.Q, s.b, s.n, s.S0, s.L);
  let wsMax = 0;
  for (const p of r.points) if (p.ws > wsMax) wsMax = p.ws;
  const zSpan = Math.max(s.zCrest, wsMax, s.S0 * s.L, 1e-3);
  const ev = Math.min(4, Math.max(1, Math.round(Math.min(s.L / 8, s.b) / zSpan)));
  const t = Math.min(1.2, Math.max(0.2, 0.08 * s.b));
  const zTop = Math.max(s.zCrest, wsMax) + 0.12 * zSpan;
  const chuteLength = Math.max(0.3 * s.L, 1.5 * s.b);
  return {
    r,
    ev,
    t,
    zTop,
    chuteLength,
    chuteDrop: KEMIRINGAN_PELUNCUR * chuteLength,
    zSpan,
    arrowTail: Math.max(1, 0.35 * s.b),
  };
}

/* ------------------------------------------------------------------ *
 * Muka
 * ------------------------------------------------------------------ */

type Dasar = { muka: MukaPelimpah[]; batas: { min: V3; max: V3 }; g: GeometriPelimpah };

function bangun(s: IsoPelimpahState): Dasar {
  const g = geometriPelimpah(s);
  const { r, ev, t, zTop, chuteLength: Lc, chuteDrop: Hc } = g;
  const { b, L, S0, zCrest } = s;
  const muka: MukaPelimpah[] = [];
  const Z = (z: number) => z * ev;
  const bed = (x: number) => S0 * (L - x);
  const bedC = (x: number) => -KEMIRINGAN_PELUNCUR * (x - L); // dasar peluncur, x ≥ L
  const lantai = t;
  const garisBeton = { satuSisi: true, bobot: W.bold, garis: C.concrete } as const;
  const tambah = (bagian: Bagian, pts: V3[], gaya: Omit<Muka, "pts"> = garisBeton) =>
    muka.push({ ...gaya, pts, bagian });
  /** Muka yang dipecah per ruas: tanpa garis (lihat MukaPelimpah.tepi). */
  const polos = { satuSisi: true, garis: null } as const;
  const tepi = (bagian: Bagian, a: V3, b2: V3, garis: string = C.concrete, bobot: number = W.bold) =>
    muka.push({ pts: [a, b2], isi: null, garis, bobot, bagian, tepi: true });

  const pts = r.points;
  const adaAir = pts.length >= 2;
  const x0 = pts[0].x; // awal profil (0 bila subkritis seluruhnya)

  /* Stasiun dinding: hulu titik berhenti (bila ada) dipecah rata, lalu
     stasiun model. zA = muka air (NaN bila tidak dihitung). */
  const st: { x: number; zA: number }[] = [];
  if (adaAir && x0 > 1e-9) {
    const nh = Math.max(2, Math.ceil((x0 / L) * 24));
    for (let i = 0; i < nh; i++) st.push({ x: (x0 * i) / nh, zA: NaN });
  } else if (!adaAir) {
    for (let i = 0; i < 24; i++) st.push({ x: (L * i) / 24, zA: NaN });
  }
  if (adaAir) for (const p of pts) st.push({ x: p.x, zA: p.ws });
  else st.push({ x: L, zA: NaN });
  const bawahDalam = (k: number) => {
    const p = st[k];
    return Number.isFinite(p.zA) ? Math.max(p.zA, bed(p.x)) : bed(p.x);
  };

  /* ---------------- dasar ---------------- */
  /* Muka besar tidak dipecah: muka bertetangga sewarna yang diisi tanpa
     garis meninggalkan garis rambut antialias di sambungannya. Urutan
     tetap benar karena lapis dipilih dari sisi pengamat. */
  tambah("dasar-atas", [[0, 0, Z(bed(0))], [L, 0, Z(bed(L))], [L, b, Z(bed(L))], [0, b, Z(bed(0))]], polos);
  const xe = L + Lc;
  tambah("dasar-peluncur", [[L, 0, Z(bedC(L))], [xe, 0, Z(bedC(xe))], [xe, b, Z(bedC(xe))], [L, b, Z(bedC(L))]], polos);
  // Patahan dasar di ujung keluar (awal peluncur).
  tepi("dasar-atas" as Bagian, [L, 0, 0], [L, b, 0], C.concrete, W.thin);
  // Potongan ujung peluncur (gambar berhenti di sini): arsir beton.
  tambah("dasar-ujung", [[xe, 0, Z(-Hc - lantai)], [xe, b, Z(-Hc - lantai)], [xe, b, Z(-Hc)], [xe, 0, Z(-Hc)]], {
    ...garisBeton,
    arsir: "beton",
  });

  // Hulu superkritis: dasar diarsir sinyal, air tidak dihitung di sana.
  if (r.supercriticalFrom !== null) {
    const xs = adaAir ? x0 : L;
    tambah("dasar-sinyal", [[0, 0, Z(bed(0))], [xs, 0, Z(bed(xs))], [xs, b, Z(bed(xs))], [0, b, Z(bed(0))]], {
      isi: C.signalFill,
      garis: null,
      arsir: "sinyal",
      satuSisi: true,
    });
  }

  /* ---------------- air ---------------- */
  if (adaAir) {
    const gayaAir = { bahan: "air", garis: null, satuSisi: true } as const;
    /* Muka atas: SATU poligon yang titiknya tepat stasiun model di kedua
       tepi (y = 0 pangkal ke ujung, lalu y = b kembali; berlawanan jarum jam dari atas), tanpa sisipan.
       Isian air pekat supaya terbaca di atas lantai. */
    const atas: V3[] = [];
    for (let i = 0; i < pts.length; i++) atas.push([pts[i].x, 0, Z(pts[i].ws)]);
    for (let i = pts.length - 1; i >= 0; i--) atas.push([pts[i].x, b, Z(pts[i].ws)]);
    tambah("air-atas", atas, { ...gayaAir, isi: C.waterFillDeep });
    const sisi0: V3[] = [];
    const sisiB: V3[] = [];
    for (const p of pts) {
      sisi0.push([p.x, 0, Z(p.zb)]);
      sisiB.push([p.x, b, Z(p.ws)]);
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      sisi0.push([pts[i].x, 0, Z(pts[i].ws)]);
      sisiB.push([pts[i].x, b, Z(pts[i].zb)]);
    }
    tambah("air-sisi", sisi0, gayaAir);
    tambah("air-sisi", sisiB, gayaAir);
    for (let i = 0; i + 1 < pts.length; i++) {
      const p = pts[i];
      const q = pts[i + 1];
      // Muka air di atas mercu (mercu tenggelam): diarsir sinyal.
      if ((p.ws + q.ws) / 2 > zCrest)
        tambah("air-tenggelam", [[p.x, 0, Z(p.ws)], [q.x, 0, Z(q.ws)], [q.x, b, Z(q.ws)], [p.x, b, Z(p.ws)]], {
          isi: null,
          garis: null,
          arsir: "sinyal",
          satuSisi: true,
        });
      // Garis muka air di kedua dinding: data utama gambar ini.
      tepi("air-garis", [p.x, 0, Z(p.ws)], [q.x, 0, Z(q.ws)], C.water, W.thin);
      tepi("air-garis", [p.x, b, Z(p.ws)], [q.x, b, Z(q.ws)], C.water, W.thin);
    }
    // Penampang kendali di ujung keluar: kedalaman kritis ycOut.
    const k = pts[pts.length - 1];
    tambah("air-kendali", [[k.x, 0, Z(k.zb)], [k.x, b, Z(k.zb)], [k.x, b, Z(k.ws)], [k.x, 0, Z(k.ws)]], {
      bahan: "air",
      arsir: "air",
      garis: C.water,
      bobot: W.thin,
      satuSisi: true,
    });
    const h = pts[0];
    tambah("air-hulu", [[h.x, b, Z(h.zb)], [h.x, 0, Z(h.zb)], [h.x, 0, Z(h.ws)], [h.x, b, Z(h.ws)]], {
      bahan: "air",
      arsir: "air",
      garis: r.supercriticalFrom !== null ? C.signal : C.water,
      bobot: W.thin,
      satuSisi: true,
    });
  }

  /* ---------------- dinding saluran pengumpul ---------------- */
  /*
   * Dinding memanjang x, tebal di y antara yIn (sisi air) dan yOut.
   * Muka luar dan puncak dalam ruas kasar (tiap 10 stasiun), muka dalam
   * per stasiun dari muka air (atau dasar) ke puncak.
   */
  const dinding = (nama: "mercu" | "seberang", yIn: number, yOut: number, zAtas: number) => {
    const s1 = yOut > yIn ? 1 : -1; // arah luar
    const xa = st[0].x;
    const xb = st[st.length - 1].x;
    const luar: V3[] = [[xa, yOut, Z(-lantai)], [xb, yOut, Z(-lantai)], [xb, yOut, Z(zAtas)], [xa, yOut, Z(zAtas)]];
    tambah(`${nama}-luar`, s1 < 0 ? luar : [luar[1], luar[0], luar[3], luar[2]]);
    const puncak: V3[] = [[xa, yIn, Z(zAtas)], [xa, yOut, Z(zAtas)], [xb, yOut, Z(zAtas)], [xb, yIn, Z(zAtas)]];
    tambah(`${nama}-puncak`, s1 < 0 ? puncak : [puncak[0], puncak[3], puncak[2], puncak[1]]);
    /* Muka dalam: satu poligon, kaki di muka air (atau dasar kering) tiap
       stasiun, puncak lurus. Tidak pernah turun ke bawah muka air. */
    const d: V3[] = [];
    for (let k = 0; k < st.length; k++) d.push([st[k].x, yIn, Z(Math.min(bawahDalam(k), zAtas))]);
    d.push([xb, yIn, Z(zAtas)], [xa, yIn, Z(zAtas)]);
    // muka dalam menghadap −s1
    tambah(`${nama}-dalam`, s1 > 0 ? d : d.reverse(), polos);
    // Kaki dinding di dasar yang kering (hulu superkritis); di air: garis muka air.
    for (let k = 0; k + 1 < st.length; k++)
      if (!Number.isFinite(st[k].zA) || !Number.isFinite(st[k + 1].zA))
        tepi(`${nama}-tepi`, [st[k].x, yIn, Z(bed(st[k].x))], [st[k + 1].x, yIn, Z(bed(st[k + 1].x))], C.concrete, W.thin);
  };
  dinding("mercu", 0, -t, zCrest);
  dinding("seberang", b, b + t, zTop);

  /* Dinding pangkal: x ∈ [−t, 0], y ∈ [−t, b + t], puncak zTop. */
  {
    const xo = -t;
    const lo = Z(-lantai);
    const hi = Z(zTop);
    tambah("pangkal-luar", [[xo, -t, lo], [xo, -t, hi], [xo, b + t, hi], [xo, b + t, lo]]);
    tambah("pangkal-puncak", [[xo, -t, hi], [0, -t, hi], [0, b + t, hi], [xo, b + t, hi]]);
    tambah("pangkal-ujung", [[xo, -t, lo], [0, -t, lo], [0, -t, hi], [xo, -t, hi]]); // sisi waduk −y
    tambah("pangkal-ujung", [[0, b + t, lo], [xo, b + t, lo], [xo, b + t, hi], [0, b + t, hi]]); // sisi +y
    // Muka dalam x = 0 (menghadap +x): di atas puncak mercu di sisi waduk,
    // di atas muka air (atau dasar) di dalam saluran.
    const zIn = Z(bawahDalam(0));
    const zm = Z(Math.min(zCrest, zTop));
    tambah("pangkal-dalam", ([[0, -t, zm], [0, 0, zm], [0, 0, zIn], [0, b, zIn], [0, b, hi], [0, -t, hi]] as V3[]).reverse());
  }

  /* ---------------- peluncur (skematik) ---------------- */
  {
    const hk = zTop; // tinggi dinding peluncur di atas dasarnya
    const sisi = (yIn: number, yOut: number) => {
      const s1 = yOut > yIn ? 1 : -1;
      const xa = L;
      const xb = xe;
      const la = Z(bedC(xa) - lantai), lb = Z(bedC(xb) - lantai);
      const ta = Z(bedC(xa) + hk), tb = Z(bedC(xb) + hk);
      const ba = Z(bedC(xa)), bb = Z(bedC(xb));
      const luar: V3[] = [[xa, yOut, la], [xb, yOut, lb], [xb, yOut, tb], [xa, yOut, ta]];
      tambah("peluncur-luar", s1 < 0 ? luar : [luar[1], luar[0], luar[3], luar[2]]);
      const puncak: V3[] = [[xa, yIn, ta], [xa, yOut, ta], [xb, yOut, tb], [xb, yIn, tb]];
      tambah("peluncur-puncak", s1 < 0 ? puncak : [puncak[0], puncak[3], puncak[2], puncak[1]]);
      const d: V3[] = [[xa, yIn, ba], [xb, yIn, bb], [xb, yIn, tb], [xa, yIn, ta]];
      tambah("peluncur-dalam", s1 > 0 ? d : [d[1], d[0], d[3], d[2]]);
      // Potongan ujung hilir: arsir beton.
      const ye = [yIn, yOut].sort((p, q) => p - q);
      tambah("peluncur-ujung", [[xe, ye[0], Z(-Hc - lantai)], [xe, ye[1], Z(-Hc - lantai)], [xe, ye[1], Z(-Hc + hk)], [xe, ye[0], Z(-Hc + hk)]], {
        ...garisBeton,
        arsir: "beton",
      });
    };
    sisi(0, -t);
    sisi(b, b + t);
    // Pangkal dinding peluncur sisi waduk menghadap hulu (−x), di atas puncak mercu.
    if (zTop > zCrest)
      tambah("peluncur-ujung", ([[L, 0, Z(zCrest)], [L, -t, Z(zCrest)], [L, -t, Z(zTop)], [L, 0, Z(zTop)]] as V3[]).reverse());
  }

  const tail = g.arrowTail;
  return {
    muka,
    g,
    batas: {
      min: [-t, -t - tail, Z(Math.min(-Hc - lantai, -lantai))],
      max: [L + Lc, b + t, Z(Math.max(zTop, zCrest) + 0.05 * g.zSpan)],
    },
  };
}

/* Lapis dari sisi pengamat. */
function lapisBagian(bagian: Bagian, ox: 1 | -1, oy: 1 | -1): number {
  if (bagian === "dasar-sinyal") return -3.5;
  if (bagian === "air-tenggelam") return -0.75;
  if (bagian.startsWith("dasar")) return -4;
  if (bagian.startsWith("air")) return -1;
  const depan = bagian.startsWith("mercu")
    ? oy < 0
    : bagian.startsWith("seberang")
      ? oy > 0
      : bagian.startsWith("pangkal")
        ? ox < 0
        : ox > 0; // peluncur
  return depan ? 0 : -2;
}

/** Sisi pengamat dari yaw: ox = +1 bila di hilir (+x), oy = −1 bila di sisi waduk (−y). */
function sisiPengamat(yaw: number): { ox: 1 | -1; oy: 1 | -1 } {
  return { ox: Math.sin(yaw) < 0 ? 1 : -1, oy: Math.cos(yaw) >= 0 ? -1 : 1 };
}

let cache: { kunci: string; dasar: Dasar; kuadran: Map<string, MukaPelimpah[]> } | null = null;

/**
 * Seluruh muka gambar untuk masukan s dan sisi pengamat dari yaw. Di-cache:
 * memutar gambar hanya memproyeksi ulang; lapis dibangun ulang hanya saat
 * yaw pindah kuadran (paling banyak empat larik per masukan).
 */
export function mukaPelimpah(
  s: IsoPelimpahState,
  yaw: number = -ISO.yaw
): { muka: MukaPelimpah[]; batas: { min: V3; max: V3 }; g: GeometriPelimpah } {
  const kunci = `${s.Q}|${s.b}|${s.n}|${s.S0}|${s.L}|${s.zCrest}`;
  if (!cache || cache.kunci !== kunci) cache = { kunci, dasar: bangun(s), kuadran: new Map() };
  const { ox, oy } = sisiPengamat(yaw);
  const kk = `${ox}${oy}`;
  let muka = cache.kuadran.get(kk);
  if (!muka) {
    muka = cache.dasar.muka.map((m) => ({ ...m, lapis: lapisBagian(m.bagian, ox, oy) + (m.tepi ? 0.5 : 0) }));
    cache.kuadran.set(kk, muka);
  }
  return { muka, batas: cache.dasar.batas, g: cache.dasar.g };
}

/** Ruang judul di atas gambar, px (judul + baris skala tegak). */
export const RUANG_JUDUL_ISO_PELIMPAH = 48;
/** Margin kameraPas, px. */
export const MARGIN_ISO_PELIMPAH = 20;

/**
 * Tinggi/lebar kotak batas terproyeksi pada pandangan awal, untuk tinggi
 * bidang gambar (sama dengan HS-02 rasioIsoLabirin).
 */
export function rasioIsoPelimpah(
  s: IsoPelimpahState,
  yaw: number = -ISO.yaw,
  pitch: number = ISO.pitch
): number {
  const { batas } = mukaPelimpah(s, yaw);
  const k = kameraPas(batas, 1000, 1e9, yaw, pitch, 0);
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const p = anchor3(
      [i & 1 ? batas.max[0] : batas.min[0], i & 2 ? batas.max[1] : batas.min[1], i & 4 ? batas.max[2] : batas.min[2]],
      k
    );
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  return (y1 - y0) / 1000;
}

/* ------------------------------------------------------------------ *
 * Gambar
 * ------------------------------------------------------------------ */

const fmtBawaan = (v: number, d: number) => v.toFixed(d);

/**
 * Menggambar HS-10 isometrik. Mengembalikan PlateOut (tanpa pegangan;
 * labels untuk uji tumpang) dan kamera yang dipakai.
 */
export function drawIsoPelimpah(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: IsoPelimpahState,
  opts: IsoPelimpahOptions = {}
): PlateOut & { kamera: Kamera } {
  ground(ctx, w, h);
  /* Bawaan: pengamat di sisi waduk dan hilir (yaw −45°): mercu di depan,
     saluran pengumpul menjauh ke kiri atas, penampang kendali dan
     peluncur di kanan bawah. */
  const yaw = opts.yaw ?? -ISO.yaw;
  const pitch = opts.pitch ?? ISO.pitch;
  const { muka, batas, g } = mukaPelimpah(s, yaw);
  const k = kameraPas(batas, w, h - RUANG_JUDUL_ISO_PELIMPAH, yaw, pitch, MARGIN_ISO_PELIMPAH);
  k.cy += RUANG_JUDUL_ISO_PELIMPAH;
  gambarMuka(ctx, muka, k, { bingkai: { x0: 0, y0: 0, x1: w, y1: h } });

  const { r, ev, t } = g;
  const Z = (z: number) => z * ev;
  const fmt = opts.fmt ?? fmtBawaan;
  const pts = r.points;
  const adaAir = pts.length >= 2;
  const wsDi = (x: number): number | null => {
    if (!adaAir || x < pts[0].x - 1e-9) return null;
    let best = pts[0];
    for (const p of pts) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    return best.ws;
  };
  const bed = (x: number) => s.S0 * (s.L - x);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();

  /* Panah aliran masuk lateral: arah saja, dari sisi waduk melewati mercu
     ke saluran. Bukan lintasan tirai (tidak dihitung model). */
  const NP = 6;
  pen(ctx, W.thin, C.water, DASH.solid);
  const ujungPanah: { x: number; y: number }[] = [];
  for (let i = 0; i < NP; i++) {
    const x = (s.L * (i + 0.5)) / NP;
    const zE = wsDi(x) ?? bed(x);
    const A = anchor3([x, -t - g.arrowTail, Z(s.zCrest + 0.04 * g.zSpan)], k);
    const B = anchor3([x, 0.35 * s.b, Z(zE)], k);
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();
    const a = Math.atan2(B.y - A.y, B.x - A.x);
    ctx.fillStyle = C.water;
    ctx.beginPath();
    ctx.moveTo(B.x, B.y);
    ctx.lineTo(B.x - 7 * Math.cos(a - 0.38), B.y - 7 * Math.sin(a - 0.38));
    ctx.lineTo(B.x - 7 * Math.cos(a + 0.38), B.y - 7 * Math.sin(a + 0.38));
    ctx.closePath();
    ctx.fill();
    ujungPanah.push(A);
  }
  ctx.restore();

  const placer = createLabelPlacer(ctx, { padL: 0, padT: 0, plotW: w, plotH: h });
  if (opts.heading) placer.write(opts.heading, w / 2, 20, opts.headingSignal ? C.signal : C.ink3, { big: true });
  const L = opts.label;
  if (L && ev > 1) placer.write(`${L.exagg} ${ev}×`, w / 2, 40, C.ink3);

  /* Nama bagian dengan garis penunjuk. Tulisan huruf biasa (bukan
     stensil) supaya simbol dan angka tetap terbaca. */
  const tunjuk = (teks: string, p: V3, dx: number, dy: number, warna: string) => {
    const A = anchor3(p, k);
    const kanan = dx >= 0;
    const pos = placer.place(teks, A.x + dx, A.y + dy, 1.4, kanan ? "left" : "right");
    ctx.font = F.label;
    const lebar = ctx.measureText(teks).width + 6;
    ctx.fillStyle = C.sheet;
    ctx.fillRect(kanan ? pos.x - 3 : pos.x - lebar + 3, pos.atas, lebar, pos.bawah - pos.atas);
    pen(ctx, W.hair, warna, DASH.solid);
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
  };

  if (L) {
    const kiri = (p: V3) => anchor3(p, k).x < w / 2;
    const arah = (p: V3, d: number) => (kiri(p) ? -d : d);
    const pMercu: V3 = [s.L * 0.3, -t / 2, Z(s.zCrest)];
    tunjuk(L.crest, pMercu, arah(pMercu, 26), 30, C.ink);
    if (ujungPanah.length > 0) {
      const pIn: V3 = [s.L * (0.5 / NP), -t - g.arrowTail, Z(s.zCrest + 0.04 * g.zSpan)];
      tunjuk(`${L.inflow} q* = ${fmt((s.Q / s.L) * 1000, 0)} l/s·m`, pIn, arah(pIn, 24), -22, C.water);
    }
    if (adaAir) {
      const xm = pts[0].x + (s.L - pts[0].x) * 0.5;
      const pAir: V3 = [xm, s.b * 0.7, Z(wsDi(xm) ?? 0)];
      tunjuk(L.trough, pAir, arah(pAir, 30), -34, C.water);
      const pK: V3 = [s.L, s.b / 2, Z(r.ycOut)];
      tunjuk(`${L.control}, yc ${fmt(r.ycOut, 2)} m`, pK, arah(pK, 28), -30, C.critical);
    }
    const xc = s.L + g.chuteLength * 0.6;
    const pC: V3 = [xc, s.b / 2, Z(-KEMIRINGAN_PELUNCUR * (xc - s.L))];
    tunjuk(L.chute, pC, arah(pC, 24), 28, C.ink);
    if (r.supercriticalFrom !== null) {
      const xs = adaAir ? pts[0].x : s.L;
      const pS: V3 = [xs, s.b / 2, Z(bed(xs))];
      tunjuk(L.profileEnds, pS, arah(pS, 26), 34, C.signal);
    }
  }

  return { ...plateOut3(k, w, h), labels: rectsFrom(placer.boxes()), kamera: k };
}
