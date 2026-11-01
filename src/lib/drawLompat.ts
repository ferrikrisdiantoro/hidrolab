import { DASH, TONE, W } from "./theme.ts";
import { pen } from "./plate.ts";
import { FISHWAY_POWER_GENERAL, G, SWIM_BURST_BL, cascadePassage } from "./hydraulics.ts";
import type { PlateMap, PlateOut } from "./plateOut.ts";
import { tailBeat } from "./renangGerak.ts";
import { drawFish, type FishPose } from "./fishGlyph.ts";

/**
 * EH-03 Lintasan ikan bertingkat: ikan rancangan beranimasi menaiki undakan.
 *
 * Keputusan lolos atau gagal sepenuhnya dari cascadePassage (hydraulics.ts),
 * dengan urutan yang sama dengan badge lembar:
 *
 * - tooHigh (u > Ub): ikan melompat TEGAK dengan kecepatan sentaknya Ub,
 *   naik setinggi Ub²/(2g) yang kurang dari Δz, lalu jatuh kembali.
 * - poolTooShallow atau teraduk (ε > 150 W/m³): ikan tidak melompat; ia
 *   berhenti di tengah kolam (teks lembar: tidak menemukan air untuk
 *   ancang-ancang / kehilangan arah). Tidak ada laju yang dikarang.
 * - Lolos: tiap undakan dilompati sebagai peluru dengan kecepatan awal Ub
 *   dari muka air kolam bawah. Sudutnya 45° bila Ub >= u45 (model) dan
 *   lintasannya muat di kolam; selain itu sudut terlandai yang masih sampai
 *   ke mercu, sin θ = u / Ub, yaitu batas lompatan tegak model. Bila sudut
 *   pilihan itu pun tidak muat di ruang ancang-ancang, sudutnya dicuramkan
 *   (bagi dua di antara max(θmin, 45°) dan 90°) sampai geseran mendatar
 *   saat naik sama dengan ruang; tegak bila ruangnya nol. Komponen tegak
 *   kecepatan awal tidak pernah kurang dari u = √(2 g Δz).
 *
 * Lompatan berjalan dengan g sungguhan dalam satuan gambar (m, s). Ikan
 * berenang di kolam pada kecepatan sentaknya Ub terhadap dasar (kecepatan
 * air di kolam diabaikan; model tidak menghitungnya).
 *
 * Panjang ikan rancangan tidak ada di model EH-03. Untuk ukuran gambar dan
 * kibasan ekor dipakai L = Ub / SWIM_BURST_BL (sentak 10 panjang tubuh per
 * detik, bawaan fishSwim EH-04). Panjang ini tidak memengaruhi keputusan.
 */

export type LompatHasil = "lolos" | "terlalu-tinggi" | "dangkal" | "teraduk";

/** Ukuran gambar undakan, sama dengan yang digambar lembar. */
export function undakanUkuran(steps: number, L: number): { tampil: number; tebal: number } {
  return { tampil: Math.min(steps, 5), tebal: Math.max(L * 0.07, 0.08) };
}

export type LompatMasukan = {
  rise: number;
  steps: number;
  L: number;
  B: number;
  D: number;
  Q: number;
  burst: number;
};

/** Ruas lintasan: 0 garis lurus, 1 peluru, 2 diam. */
type Ruas = {
  jenis: 0 | 1 | 2;
  x0: number;
  z0: number;
  /** Garis: titik akhir. Peluru: kecepatan awal (vx, vz). */
  a: number;
  b: number;
  dur: number;
  /** Ekor mengibas selama ruas ini. */
  kibas: boolean;
  /** Waktu mulai dan waktu kibas terkumpul di awal ruas. */
  t0: number;
  k0: number;
  /** Arah kepala untuk ruas diam, radian. */
  arah: number;
};

export type LompatRencana = {
  hasil: LompatHasil;
  /** Panjang ikan rancangan, m. */
  Lf: number;
  /** Kibasan ekor saat berenang pada Ub, per detik. */
  f: number;
  outOfRange: boolean;
  /** Amplitudo ekor / L. */
  amp: number;
  /** Kecepatan awal lompatan, m/s (= Ub). */
  v0: number;
  /** Sudut lompatan pertama, radian. */
  sudut: number;
  /** Puncak lompatan pertama di atas muka air kolam bawah, m. */
  puncak: number;
  ruas: Ruas[];
  /** Lama satu siklus, detik fisik (sudah termasuk jeda di akhir). */
  durasi: number;
};

/** Jeda di akhir siklus sebelum diulang, detik fisik. */
export const JEDA_SIKLUS = 1.5;
/** Lama ikan berhenti pada keadaan dangkal/teraduk sebelum diulang. */
export const LAMA_BERHENTI = 2.5;

/** Keputusan lembar, urutannya sama dengan badge LintasanBertingkatClient. */
export function lompatHasil(m: LompatMasukan): LompatHasil {
  const r = cascadePassage(m.rise, m.steps, m.L, m.B, m.D, m.Q, m.burst);
  if (r.tooHigh) return "terlalu-tinggi";
  if (r.poolTooShallow) return "dangkal";
  if (r.powerDensity > FISHWAY_POWER_GENERAL) return "teraduk";
  return "lolos";
}

/**
 * Sudut dan geseran mendatar lompatan di atas undakan setinggi dz dengan
 * kecepatan awal v0, untuk ruang ancang-ancang `ruang` (m).
 * Mengembalikan null bila v0 < u (tidak sampai).
 */
export function sudutLompat(
  v0: number,
  dz: number,
  ruang: number
): { sudut: number; tNaik: number; xNaik: number } | null {
  const u = Math.sqrt(2 * G * Math.max(dz, 0));
  if (v0 < u) return null;
  const coba = (th: number) => {
    const vx = v0 * Math.cos(th);
    const vz = v0 * Math.sin(th);
    // Saat pertama mencapai tinggi dz (cabang naik).
    const akar = Math.sqrt(Math.max(0, vz * vz - 2 * G * dz));
    const tNaik = (vz - akar) / G;
    return { sudut: th, tNaik, xNaik: vx * tNaik };
  };
  // Sudut terlandai yang masih sampai: komponen tegak tepat u.
  const thMin = Math.asin(Math.min(1, u / v0));
  const pilih = coba(v0 >= u * Math.SQRT2 ? Math.PI / 4 : thMin);
  if (pilih.xNaik <= ruang) return pilih;
  // Tidak muat. xNaik(θ) turun monoton ke 0 di 90° (vx -> 0 dan tNaik
  // mengecil), jadi bagi dua θ di [max(θmin, 45°), 90°] sampai xNaik = ruang.
  // Ujung atas selalu memenuhi xNaik <= ruang dan dialah yang dikembalikan.
  if (!(ruang > 0)) return coba(Math.PI / 2);
  let lo = Math.max(thMin, Math.PI / 4);
  let hi = Math.PI / 2;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    if (coba(mid).xNaik > ruang) lo = mid;
    else hi = mid;
  }
  return coba(hi);
}

/**
 * Rencana lintasan satu siklus dalam koordinat gambar lembar (x ke hilir,
 * z ke atas; kolam 0 paling hulu di kiri). Dibuat sekali per keadaan.
 */
export function rencanaLompat(m: LompatMasukan): LompatRencana {
  const r = cascadePassage(m.rise, m.steps, m.L, m.B, m.D, m.Q, m.burst);
  const hasil = lompatHasil(m);
  const { tampil, tebal } = undakanUkuran(m.steps, m.L);
  const drop = r.stepDrop;
  const Ub = m.burst;
  const Lf = Ub / SWIM_BURST_BL;
  const tb = tailBeat(Ub, Lf);
  const L = m.L;
  const muka = (i: number) => (tampil - 1 - i) * drop;
  const dalam = Math.min(0.3 * m.D, Math.max(Lf, 0.15 * m.D));

  const ruas: Ruas[] = [];
  let t = 0;
  let k = 0;
  let x = tampil * L - tebal - Lf;
  let z = muka(tampil - 1) - dalam;
  const garis = (x1: number, z1: number, v: number) => {
    const d = Math.hypot(x1 - x, z1 - z);
    const dur = v > 0 ? d / v : 0;
    ruas.push({ jenis: 0, x0: x, z0: z, a: x1, b: z1, dur, kibas: true, t0: t, k0: k, arah: 0 });
    t += dur;
    k += dur;
    x = x1;
    z = z1;
  };
  const peluru = (vx: number, vz: number, dur: number) => {
    ruas.push({ jenis: 1, x0: x, z0: z, a: vx, b: vz, dur, kibas: false, t0: t, k0: k, arah: 0 });
    t += dur;
    x += vx * dur;
    z += vz * dur - 0.5 * G * dur * dur;
  };
  const diam = (dur: number, arah: number) => {
    ruas.push({ jenis: 2, x0: x, z0: z, a: x, b: z, dur, kibas: false, t0: t, k0: k, arah });
    t += dur;
  };

  let sudut = Math.PI / 2;
  let puncak = (Ub * Ub) / (2 * G);

  if (hasil === "dangkal" || hasil === "teraduk") {
    garis((tampil - 1) * L + 0.5 * (L - tebal), z, Ub);
    diam(LAMA_BERHENTI, Math.PI);
  } else if (hasil === "terlalu-tinggi") {
    const j = tampil - 2;
    const kanan = (j + 1) * L;
    const zBawah = muka(j + 1);
    const xL = kanan + Math.max(0.6 * Lf, 0.05);
    garis(xL + 1.5 * Lf, z, Ub);
    garis(xL, zBawah, Ub);
    peluru(0, Ub, (2 * Ub) / G);
    garis(xL + 0.5 * Lf, zBawah - dalam, Ub);
    diam(JEDA_SIKLUS, Math.PI);
  } else {
    for (let j = tampil - 2; j >= 0; j--) {
      const kanan = (j + 1) * L;
      const zBawah = muka(j + 1);
      const ruang = Math.max(0, L - tebal - 3 * Lf);
      const s = sudutLompat(Ub, drop, ruang)!;
      if (j === tampil - 2) {
        sudut = s.sudut;
        const vz0 = Ub * Math.sin(s.sudut);
        puncak = (vz0 * vz0) / (2 * G);
      }
      const xL = kanan + Math.min(s.xNaik, ruang) + 0.02 * Lf;
      if (x > xL + 1.5 * Lf) garis(xL + 1.5 * Lf, z, Ub);
      garis(xL, zBawah, Ub);
      peluru(-Ub * Math.cos(s.sudut), Ub * Math.sin(s.sudut), s.tNaik);
      // Di atas mercu: masuk kolam atas lewat limpasan di mercu.
      garis(kanan - tebal - Lf, muka(j) - dalam, Ub);
    }
    garis(-0.1 * L - Lf, z, Ub);
    diam(JEDA_SIKLUS, Math.PI);
  }

  return {
    hasil,
    Lf,
    f: tb.frequency,
    outOfRange: tb.outOfRange,
    amp: tb.amplitude / Lf,
    v0: Ub,
    sudut,
    puncak,
    ruas,
    durasi: t,
  };
}

export type LompatPose = { x: number; z: number; heading: number; phase: number };

/** Pose ikan pada waktu siklus te (detik fisik). Tanpa alokasi bila out diberi. */
export function lompatPada(p: LompatRencana, te: number, out?: LompatPose): LompatPose {
  const o = out ?? { x: 0, z: 0, heading: Math.PI, phase: 0 };
  const rs = p.ruas;
  let i = 0;
  while (i < rs.length - 1 && te > rs[i].t0 + rs[i].dur) i++;
  const s = rs[i];
  const tau = Math.min(Math.max(te - s.t0, 0), s.dur);
  let kib = s.k0;
  if (s.jenis === 0) {
    const u = s.dur > 0 ? tau / s.dur : 1;
    o.x = s.x0 + (s.a - s.x0) * u;
    o.z = s.z0 + (s.b - s.z0) * u;
    o.heading = Math.atan2(s.b - s.z0, s.a - s.x0);
    kib += tau;
  } else if (s.jenis === 1) {
    o.x = s.x0 + s.a * tau;
    o.z = s.z0 + s.b * tau - 0.5 * G * tau * tau;
    const vz = s.b - G * tau;
    o.heading = Math.atan2(vz, s.a === 0 ? -1e-9 : s.a);
    // Lompatan tegak: kepala ke atas saat naik, ke bawah saat turun.
    if (s.a === 0) o.heading = vz >= 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    o.x = s.x0;
    o.z = s.z0;
    o.heading = s.arah;
  }
  o.phase = 2 * Math.PI * p.f * kib;
  return o;
}

/* ------------------------------------------------------------------ *
 * Gambar
 * ------------------------------------------------------------------ */

const poseIkan: FishPose = { x: 0, y: 0, heading: Math.PI, length: 1, phase: 0 };
const poseKerja: LompatPose = { x: 0, z: 0, heading: Math.PI, phase: 0 };

/** Nada ikan: lolos = pass, gagal = caution (bukan merah sinyal). */
export function lompatNada(h: LompatHasil): "pass" | "caution" {
  return h === "lolos" ? "pass" : "caution";
}

/**
 * Panjang tampil terpendek ikan, px. Ikan rancangan 5 sampai 60 cm pada
 * lintasan belasan meter hanya beberapa piksel di layar HP; di bawah batas
 * ini tandanya diperbesar (tidak berskala, ditulis di catatan lembar).
 * Lintasan dan laju tetap dalam satuan sebenarnya.
 */
export const IKAN_MIN_PX = 16;

function gambarIkan(ctx: CanvasRenderingContext2D, map: PlateMap, p: LompatRencana, q: LompatPose) {
  const pxPerM = Math.abs(map.X(1) - map.X(0));
  poseIkan.x = q.x;
  poseIkan.y = q.z;
  poseIkan.heading = q.heading;
  poseIkan.length = pxPerM > 0 ? Math.max(p.Lf, IKAN_MIN_PX / pxPerM) : p.Lf;
  poseIkan.phase = q.phase;
  poseIkan.amp = p.amp;
  drawFish(ctx, map, poseIkan, { tone: lompatNada(p.hasil) });
}

/**
 * Lintasan lompatan pertama sebagai garis rambut bernada hasil. Dipakai
 * lapis statis saat dijeda (penanda diam) bersama ikan di puncaknya.
 */
export function drawLompatDiam(
  ctx: CanvasRenderingContext2D,
  out: PlateOut,
  p: LompatRencana
): void {
  const map = out.map;
  const j = p.ruas.findIndex((s) => s.jenis === 1);
  ctx.save();
  const f = map.frame;
  ctx.beginPath();
  ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
  ctx.clip();
  if (j >= 0) {
    const s = p.ruas[j];
    pen(ctx, W.hair, TONE[lompatNada(p.hasil)].line, DASH.solid);
    ctx.beginPath();
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const tau = (s.dur * i) / n;
      const xx = map.X(s.x0 + s.a * tau);
      const zz = map.Y(s.z0 + s.b * tau - 0.5 * G * tau * tau);
      if (i === 0) ctx.moveTo(xx, zz);
      else ctx.lineTo(xx, zz);
    }
    ctx.stroke();
    // Ikan di puncak (gagal) atau di mercu (lolos).
    const tPuncak = s.a === 0 ? s.dur / 2 : s.dur;
    gambarIkan(ctx, map, p, lompatPada(p, s.t0 + tPuncak, poseKerja));
  } else {
    // Tidak melompat: ikan berhenti di tempat akhirnya.
    gambarIkan(ctx, map, p, lompatPada(p, p.durasi, poseKerja));
  }
  ctx.restore();
}

/** Keadaan lapis gerak: siklus dimulai ulang saat rencana berganti. */
export type LompatGerak = { rencana: LompatRencana | null; t0: number };

export function createLompatGerak(): LompatGerak {
  return { rencana: null, t0: 0 };
}

/** Lapis gerak: ikan pada waktu t (detik fisik, sudah dikali skala waktu). */
export function drawLompatGerak(
  ctx: CanvasRenderingContext2D,
  out: PlateOut | null,
  t: number,
  p: LompatRencana,
  st: LompatGerak
): void {
  if (!out || !(p.durasi > 0)) return;
  if (st.rencana !== p) {
    st.rencana = p;
    st.t0 = t;
  }
  const map = out.map;
  const te = (t - st.t0) % p.durasi;
  const f = map.frame;
  ctx.save();
  ctx.beginPath();
  ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
  ctx.clip();
  gambarIkan(ctx, map, p, lompatPada(p, te, poseKerja));
  ctx.restore();
}
