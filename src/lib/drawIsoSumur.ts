import { C, DASH, F, W } from "./theme.ts";
import { createLabelPlacer, ground } from "./plate.ts";
import { rectsFrom, type PlateOut } from "./plateOut.ts";
import { fmtPlain } from "./hydraulics.ts";
import { medanSumur, type AkuiferSumur, type Sumur } from "./sumurBanyak.ts";
import {
  ISO,
  anchor3,
  balikDiBidangZ,
  gambarMuka,
  kameraPas,
  kotak,
  normalMuka,
  plateOut3,
  prisma,
  proyeksi,
  type GarisDalam,
  type Kamera,
  type Muka,
  type V3,
} from "./proyeksi.ts";

/**
 * GW-02 3D: KERUCUT PENURUNAN SEBAGAI PERMUKAAN, DENGAN BANYAK SUMUR.
 *
 * Satu sumber angka: tiap titik kisi permukaan adalah medanSumur
 * (sumurBanyak.ts, M10), yaitu Thiem tunak yang sama dengan wellDrawdownAt
 * lembar ini (satu sumur = angka yang sama, diuji di sumurBanyak.test.ts),
 * dijumlah pada potensial debit bila sumurnya lebih dari satu: s untuk
 * akuifer tertekan, H² − h² untuk akuifer bebas. Garis kontur dihitung dari
 * nilai titik kisi yang SAMA (marching squares, interpolasi linear di tepi
 * sel), jadi kontur dan permukaan tidak pernah berselisih.
 *
 * Koordinat dunia gambar: x, y denah (m), sumur utama di (0, 0), denah
 * ±L (L = jari-jari pengaruh, sama dengan bentang tampak Potongan).
 * z = ELEVASI DI ATAS DASAR AKUIFER × VE. VE (skala tegak) dipilih dari
 * deret 1, 2, 5, 10, ... supaya kerucut terbaca; angkanya WAJIB ditulis di
 * gambar dan di catatan lembar.
 *
 * Kisi: paling banyak 41 × 41 titik (40 × 40 muka). Tidak seragam: titik
 * di letak tiap sumur, di tepi pipa, dan berjarak ukur (logaritmik) di
 * sekitarnya, sisanya seragam. Penurunan Thiem berubah menurut ln r: kisi
 * seragam 20 m memotong ujung kerucut sumur yang tidak jatuh di titik kisi,
 * sehingga muka air di sumur tambahan tergambar jauh lebih dangkal dari
 * hitungan.
 *
 * Yang SKEMATIK (ditulis di catatan lembar):
 * - Pipa sumur digambar selebar max(rw, 1,2 % L), bukan rw sebenarnya
 * - Kehilangan di sumur (C·Q²) tidak masuk permukaan: permukaan adalah muka
 *   air di akuifer
 * - Akuifer tertekan: muka piezometrik digambar sebagai permukaan di atas
 *   lapisan penutup, seperti tampak Potongan (0,5 b di atas atap)
 */

export type IsoSumurState = {
  /** Sumur; [0] = sumur utama di (0, 0) */
  wells: readonly Sumur[];
  /** Akuifer (sama dengan model lembar) */
  aq: AkuiferSumur;
  /** Aras muka air mula-mula di atas dasar akuifer, m */
  zAwal: number;
  /** Atap akuifer tertekan, m; tidak diisi = akuifer bebas */
  zAtap?: number;
  /** Tebal lapisan penutup di atas atap, m (akuifer tertekan) */
  tebalPenutup?: number;
  /** Setengah lebar denah, m */
  L: number;
};

export type IsoSumurTeks = {
  /** Judul gambar, sudah dalam bahasa lembar */
  heading?: string;
  /** Judul berwarna sinyal (di luar rentang) */
  headingInvalid?: boolean;
  /** "sumur" / "well" */
  sumur: string;
  /** Kalimat skala tegak, mis. (v) => `skala tegak ×${v}` */
  skalaTegak: (ve: string) => string;
  /** "muka air awal" */
  mukaAwal: string;
};

/** Titik kisi terbanyak per sumbu (40 muka). */
export const KISI_MAKS = 41;
/** Setengah lebar pipa sumur skematik sebagai pecahan L. */
export const PIPA_PECAHAN = 0.012;
/** Tinggi pipa di atas muka air awal, pecahan zAwal (sama dengan Potongan). */
const PIPA_ATAS = 1.18;
/**
 * Bentang tegak gambar sasaran sebagai pecahan lebar denah 2L. Kerucut
 * Thiem sempit (separuh penurunan selesai dalam √(R·rw)), jadi skala tegak
 * kecil membuatnya tak terbaca; blok boleh setinggi 0,6 lebar denahnya.
 * Hanya dari geometri (b, R), bukan dari Q: menggeser debit tidak
 * melompatkan skala.
 */
const TEGAK_SASARAN = 0.6;
/** Deret skala tegak. */
const DERET_VE = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000] as const;

/** Setengah lebar pipa sumur di gambar, m. */
export function jariPipa(s: Pick<IsoSumurState, "aq" | "L">): number {
  return Math.max(s.aq.rw, PIPA_PECAHAN * s.L);
}

/** Elevasi puncak pipa, m (sebelum VE). */
function zPuncak(s: Pick<IsoSumurState, "zAwal">): number {
  return s.zAwal * PIPA_ATAS;
}

/**
 * Skala tegak: angka terbesar dari deret yang tidak membuat tinggi gambar
 * melebihi TEGAK_SASARAN × lebar denah. Paling kecil 1 (tidak pernah
 * dipendekkan).
 */
export function skalaTegak(s: Pick<IsoSumurState, "zAwal" | "L">): number {
  const z = zPuncak(s);
  if (!(z > 0) || !(s.L > 0)) return 1;
  const sasaran = (TEGAK_SASARAN * 2 * s.L) / z;
  let ve = 1;
  for (const v of DERET_VE) if (v <= sasaran) ve = v;
  return ve;
}

/**
 * Titik kisi satu sumbu dalam [−L, L], naik, paling banyak KISI_MAKS.
 * Wajib: kedua tepi, letak tiap sumur, tepi pipa (±rp). Lalu jarak ukur
 * rp·(R/rp)^f di kedua sisi (f = ½, ¾, ¼, urut kepentingan), lalu titik
 * seragam pengisi celah terbesar.
 */
export function simpulSumbu(pusat: readonly number[], L: number, rp: number, R: number): number[] {
  const tol = (2 * L) / 4000;
  const pilih: number[] = [];
  const ada = (v: number) => pilih.some((p) => Math.abs(p - v) <= tol);
  const tambah = (v: number) => {
    if (pilih.length >= KISI_MAKS) return;
    if (!(v >= -L - 1e-12 && v <= L + 1e-12)) return;
    const vv = Math.min(L, Math.max(-L, v));
    if (!ada(vv)) pilih.push(vv);
  };
  tambah(-L);
  tambah(L);
  for (const c of pusat) tambah(c);
  for (const c of pusat) {
    tambah(c - rp);
    tambah(c + rp);
  }
  if (R > rp)
    for (const f of [0.5, 0.75, 0.25])
      for (const c of pusat) {
        const d = rp * Math.pow(R / rp, f);
        tambah(c - d);
        tambah(c + d);
      }
  // Pengisi seragam: tiap kali calon yang paling jauh dari titik terpilih.
  const n = KISI_MAKS - 1;
  const calon = Array.from({ length: n + 1 }, (_, i) => -L + (2 * L * i) / n);
  const langkah = (2 * L) / n;
  while (pilih.length < KISI_MAKS) {
    let terbaik = -1;
    let jauh = -1;
    for (let i = 0; i < calon.length; i++) {
      let d = Infinity;
      for (const p of pilih) d = Math.min(d, Math.abs(p - calon[i]));
      if (d > jauh) {
        jauh = d;
        terbaik = i;
      }
    }
    if (terbaik < 0 || jauh < 0.5 * langkah) break;
    pilih.push(calon[terbaik]);
    calon.splice(terbaik, 1);
  }
  return pilih.sort((a, b) => a - b);
}

export type MedanIso = {
  xs: number[];
  ys: number[];
  /** Penurunan di titik (i, j), indeks j·nx + i, m */
  s: Float64Array;
  /** Elevasi muka air di titik kisi (zAwal − s), m, sebelum VE */
  z: Float64Array;
  /** Akuifer bebas kering di titik itu */
  kering: Uint8Array;
  nx: number;
  ny: number;
  sMax: number;
  adaKering: boolean;
  /** Ada titik muka piezometrik di bawah atap akuifer tertekan */
  bawahAtap: boolean;
};

/** Medan penurunan di kisi gambar. Satu sumber untuk permukaan dan kontur. */
export function medanIso(st: IsoSumurState): MedanIso {
  const rp = jariPipa(st);
  const xs = simpulSumbu(st.wells.map((w) => w.x), st.L, rp, st.aq.R);
  const ys = simpulSumbu(st.wells.map((w) => w.y), st.L, rp, st.aq.R);
  const nx = xs.length;
  const ny = ys.length;
  const s = new Float64Array(nx * ny);
  const z = new Float64Array(nx * ny);
  const kering = new Uint8Array(nx * ny);
  let sMax = 0;
  let adaKering = false;
  let bawahAtap = false;
  const wells = st.wells as Sumur[];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const m = medanSumur(wells, xs[i], ys[j], st.aq);
      const k = j * nx + i;
      s[k] = m.s;
      z[k] = st.zAwal - m.s;
      if (m.dry) {
        kering[k] = 1;
        adaKering = true;
      }
      if (st.zAtap !== undefined && z[k] < st.zAtap) bawahAtap = true;
      if (m.s > sMax) sMax = m.s;
    }
  return { xs, ys, s, z, kering, nx, ny, sMax, adaKering, bawahAtap };
}

/** Langkah bulat 1, 2, 2,5, 5 × 10ⁿ yang terdekat (skala log) ke v. */
function langkahBulat(v: number): number {
  if (!(v > 0)) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  let terbaik = e;
  for (const m of [1, 2, 2.5, 5, 10])
    if (Math.abs(Math.log((m * e) / v)) < Math.abs(Math.log(terbaik / v))) terbaik = m * e;
  return terbaik;
}

/** Desimal terkecil yang menulis aras kontur v dengan tepat (paling banyak 4). */
export function digitLevel(v: number): number {
  for (let d = 0; d < 4; d++) {
    const f = Math.pow(10, d);
    if (Math.abs(v * f - Math.round(v * f)) < 1e-6) return d;
  }
  return 4;
}

/** Banyak kontur sasaran (langkah bulat terdekat; paling banyak dua kalinya). */
const KONTUR_SASARAN = 8;

/**
 * Aras kontur penurunan: k·langkah, 0 < s < sMax, dibulatkan ke 12 angka
 * bererti (0,30000000000000004 menjadi 0,3; aras tetap tepat yang ditulis).
 */
export function levelKontur(sMax: number): number[] {
  if (!(sMax > 0) || !Number.isFinite(sMax)) return [];
  const d = langkahBulat(sMax / KONTUR_SASARAN);
  const out: number[] = [];
  for (let k = 1; k * d < sMax - 1e-9 * d && out.length < 2 * KONTUR_SASARAN; k++) out.push(Number((k * d).toPrecision(12)));
  return out;
}

/** Satu ruas kontur di satu sel kisi, koordinat dunia SEBELUM VE. */
export type RuasKontur = { level: number; sel: number; a: V3; b: V3 };

/**
 * Kontur penurunan dari nilai titik kisi (marching squares). Ujung ruas di
 * tepi sel, diinterpolasi linear antara dua titik kisi tepi itu; z = zAwal
 * − level tepat. Sel pelana dipilih dari rata-rata keempat pojok.
 */
export function konturSumur(st: IsoSumurState, m: MedanIso = medanIso(st)): RuasKontur[] {
  const out: RuasKontur[] = [];
  const { xs, ys, s, nx, ny } = m;
  for (const lv of levelKontur(m.sMax)) {
    const zl = st.zAwal - lv;
    for (let j = 0; j + 1 < ny; j++)
      for (let i = 0; i + 1 < nx; i++) {
        // pojok: 0 (i,j), 1 (i+1,j), 2 (i+1,j+1), 3 (i,j+1)
        const k0 = j * nx + i;
        const v = [s[k0], s[k0 + 1], s[k0 + nx + 1], s[k0 + nx]];
        const px = [xs[i], xs[i + 1], xs[i + 1], xs[i]];
        const py = [ys[j], ys[j], ys[j + 1], ys[j + 1]];
        let kasus = 0;
        for (let c = 0; c < 4; c++) if (v[c] >= lv) kasus |= 1 << c;
        if (kasus === 0 || kasus === 15) continue;
        const tepi = (e: number): V3 => {
          const a = e;
          const b = (e + 1) % 4;
          const t = (lv - v[a]) / (v[b] - v[a]);
          return [px[a] + (px[b] - px[a]) * t, py[a] + (py[b] - py[a]) * t, zl];
        };
        // tepi e menghubungkan pojok e dan e+1; tepi yang dipotong = pojok beda kelas
        const dipotong: number[] = [];
        for (let e = 0; e < 4; e++) if (((kasus >> e) & 1) !== ((kasus >> ((e + 1) % 4)) & 1)) dipotong.push(e);
        const sel = j * (nx - 1) + i;
        if (dipotong.length === 2) {
          out.push({ level: lv, sel, a: tepi(dipotong[0]), b: tepi(dipotong[1]) });
        } else if (dipotong.length === 4) {
          // Pelana: pusat di atas level = pojok "atas" bersambung lewat tengah.
          const pusat = (v[0] + v[1] + v[2] + v[3]) / 4 >= lv;
          const atas0 = (kasus & 1) !== 0;
          if (pusat === atas0) {
            out.push({ level: lv, sel, a: tepi(0), b: tepi(1) });
            out.push({ level: lv, sel, a: tepi(2), b: tepi(3) });
          } else {
            out.push({ level: lv, sel, a: tepi(3), b: tepi(0) });
            out.push({ level: lv, sel, a: tepi(1), b: tepi(2) });
          }
        }
      }
  }
  return out;
}

/** Indeks sel yang memuat v di simpul naik (pencarian bagi dua). */
function selDi(simpul: readonly number[], v: number): number {
  let lo = 0;
  let hi = simpul.length - 1;
  if (v <= simpul[0]) return 0;
  if (v >= simpul[hi]) return hi - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (simpul[m] <= v) lo = m;
    else hi = m;
  }
  return lo;
}

/**
 * Lingkaran jari-jari pengaruh tiap sumur di permukaan: titik pada r = R,
 * z dari medanSumur (bukan zAwal: sumur lain bisa menurunkan muka air di
 * sana), dipecah di garis kisi supaya tiap potongan di dalam satu sel.
 * Bagian di luar denah dibuang.
 */
export function lingkaranPengaruh(st: IsoSumurState, m: MedanIso): { sel: number; pts: V3[] }[] {
  const out: { sel: number; pts: V3[] }[] = [];
  const { xs, ys } = m;
  const L = st.L;
  const N = 144;
  const R = st.aq.R;
  const wells = st.wells as Sumur[];
  const zDi = (x: number, y: number) => st.zAwal - medanSumur(wells, x, y, st.aq).s;
  for (const w of st.wells) {
    for (let n = 0; n < N; n++) {
      const t0 = (2 * Math.PI * n) / N;
      const t1 = (2 * Math.PI * (n + 1)) / N;
      let ax = w.x + R * Math.cos(t0);
      let ay = w.y + R * Math.sin(t0);
      let bx = w.x + R * Math.cos(t1);
      let by = w.y + R * Math.sin(t1);
      // Potong ruas ke kotak denah (Liang-Barsky).
      let u0 = 0;
      let u1 = 1;
      const dx = bx - ax;
      const dy = by - ay;
      let tolak = false;
      for (const [p, q] of [
        [-dx, ax + L],
        [dx, L - ax],
        [-dy, ay + L],
        [dy, L - ay],
      ] as const) {
        if (p === 0) {
          if (q < 0) tolak = true;
        } else {
          const r = q / p;
          if (p < 0) u0 = Math.max(u0, r);
          else u1 = Math.min(u1, r);
        }
      }
      if (tolak || u0 >= u1) continue;
      const x0 = ax + dx * u0, y0 = ay + dy * u0;
      bx = ax + dx * u1;
      by = ay + dy * u1;
      ax = x0;
      ay = y0;
      // Pecah di garis kisi.
      const potong = [0, 1];
      const ddx = bx - ax;
      const ddy = by - ay;
      for (const g of xs) if (ddx !== 0) { const u = (g - ax) / ddx; if (u > 0 && u < 1) potong.push(u); }
      for (const g of ys) if (ddy !== 0) { const u = (g - ay) / ddy; if (u > 0 && u < 1) potong.push(u); }
      potong.sort((a, b) => a - b);
      for (let q = 0; q + 1 < potong.length; q++) {
        const pa = potong[q];
        const pb = potong[q + 1];
        if (pb - pa < 1e-9) continue;
        const xa = ax + ddx * pa, ya = ay + ddy * pa;
        const xb = ax + ddx * pb, yb = ay + ddy * pb;
        const i = selDi(xs, (xa + xb) / 2);
        const j = selDi(ys, (ya + yb) / 2);
        const sel = j * (xs.length - 1) + i;
        const akhir = out[out.length - 1];
        // Potongan berurutan di sel yang sama digabung menjadi satu garis patah.
        const ujung = akhir?.pts[akhir.pts.length - 1];
        if (akhir && ujung && akhir.sel === sel && Math.abs(ujung[0] - xa) < 1e-9 && Math.abs(ujung[1] - ya) < 1e-9)
          akhir.pts.push([xb, yb, zDi(xb, yb)]);
        else out.push({ sel, pts: [[xa, ya, zDi(xa, ya)], [xb, yb, zDi(xb, yb)]] });
      }
    }
  }
  return out;
}

export type MukaSumur = {
  muka: Muka[];
  batas: { min: V3; max: V3 };
  VE: number;
  medan: MedanIso;
  kontur: RuasKontur[];
  /** Titik tengah ruas kontur per level (x, y, z sudah ×VE), untuk label */
  labelKontur: { level: number; titik: Float64Array }[];
  /** Muka permukaan (indeks sel j·(nx−1) + i) */
  permukaan: Muka[];
  /**
   * Pipa tiap sumur (urutan st.wells). luar = muka air di dinding sumur kering
   * (bebas) atau di bawah atap (tertekan): pipa diarsir sinyal, karena kerucut
   * yang sempit bisa seluruhnya tertutup lebar pipa gambar.
   */
  pipa: { muka: Muka[]; luar: boolean }[];
};

let cache: { kunci: string; hasil: MukaSumur } | null = null;

/** Seluruh muka gambar, di-cache per masukan (memutar hanya memproyeksi ulang). */
export function mukaSumur(st: IsoSumurState): MukaSumur {
  const kunci = JSON.stringify(st);
  if (cache && cache.kunci === kunci) return cache.hasil;
  const hasil = bangun(st);
  cache = { kunci, hasil };
  return hasil;
}

function bangun(st: IsoSumurState): MukaSumur {
  const VE = skalaTegak(st);
  const m = medanIso(st);
  const { xs, ys, nx, ny, z, kering } = m;
  const L = st.L;
  const muka: Muka[] = [];
  const P = (x: number, y: number, zz: number): V3 => [x, y, zz * VE];

  /* Permukaan muka air: opak, tanpa garis tepi tiap muka. Muka dengan pojok
     kering (bebas) atau di bawah atap (tertekan) diarsir sinyal. */
  const permukaan: Muka[] = [];
  const dalam: GarisDalam[][] = [];
  for (let j = 0; j + 1 < ny; j++)
    for (let i = 0; i + 1 < nx; i++) {
      const k = j * nx + i;
      const idx = [k, k + 1, k + nx + 1, k + nx];
      const pts: V3[] = [
        P(xs[i], ys[j], z[idx[0]]),
        P(xs[i + 1], ys[j], z[idx[1]]),
        P(xs[i + 1], ys[j + 1], z[idx[2]]),
        P(xs[i], ys[j + 1], z[idx[3]]),
      ];
      const luar = idx.some((q) => kering[q] === 1 || (st.zAtap !== undefined && z[q] < st.zAtap));
      const g: GarisDalam[] = [];
      dalam.push(g);
      const f: Muka = { pts, bahan: "airTanah", garis: null, garisDalam: g };
      if (luar) {
        f.arsir = "sinyal";
        f.isi = C.signalFill;
      }
      // Tepi denah: tepi muka air di bidang potong blok.
      if (j === 0) g.push({ pts: [pts[0], pts[1]], garis: C.water, bobot: W.thin });
      if (i + 2 === nx) g.push({ pts: [pts[1], pts[2]], garis: C.water, bobot: W.thin });
      if (j + 2 === ny) g.push({ pts: [pts[2], pts[3]], garis: C.water, bobot: W.thin });
      if (i === 0) g.push({ pts: [pts[3], pts[0]], garis: C.water, bobot: W.thin });
      permukaan.push(f);
    }

  const kontur = konturSumur(st, m);
  const perLevel = new Map<number, number[]>();
  for (const r of kontur) {
    const a = P(r.a[0], r.a[1], r.a[2]);
    const b = P(r.b[0], r.b[1], r.b[2]);
    dalam[r.sel].push({ pts: [a, b], garis: C.water, bobot: W.thin });
    let arr = perLevel.get(r.level);
    if (!arr) perLevel.set(r.level, (arr = []));
    arr.push((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  }
  for (const r of lingkaranPengaruh(st, m))
    dalam[r.sel].push({
      pts: r.pts.map((p) => P(p[0], p[1], p[2])),
      garis: C.ink2,
      bobot: W.thin,
      dash: DASH.axis,
    });
  muka.push(...permukaan);

  /* Sisi blok: satu muka per sisi denah, dari dasar sampai muka air (bebas)
     atau atap (tertekan), diarsir tanah; lalu pita lapisan penutup diarsir
     beton. Lapis 1: sisi depan blok cembung selalu di depan isinya. */
  const tertekan = st.zAtap !== undefined;
  const zAtap = st.zAtap ?? 0;
  const tPenutup = st.tebalPenutup ?? 0;
  const sisi: { tetap: "x" | "y"; nilai: number; luar: V3 }[] = [
    { tetap: "y", nilai: -L, luar: [0, -1, 0] },
    { tetap: "x", nilai: L, luar: [1, 0, 0] },
    { tetap: "y", nilai: L, luar: [0, 1, 0] },
    { tetap: "x", nilai: -L, luar: [-1, 0, 0] },
  ];
  const hadap = (pts: V3[], luar: V3) => {
    const n = normalMuka(pts);
    if (n[0] * luar[0] + n[1] * luar[1] + n[2] * luar[2] < 0) pts.reverse();
    return pts;
  };
  const tebing = { garis: C.ink, bobot: W.bold } as const;
  for (const sd of sisi) {
    const sepanjang = sd.tetap === "y" ? xs : ys;
    const zTepi = (q: number) => {
      const i = sd.tetap === "y" ? q : sd.nilai > 0 ? nx - 1 : 0;
      const j = sd.tetap === "y" ? (sd.nilai > 0 ? ny - 1 : 0) : q;
      return z[j * nx + i];
    };
    const titik = (u: number, zz: number): V3 => (sd.tetap === "y" ? P(u, sd.nilai, zz) : P(sd.nilai, u, zz));
    const n = sepanjang.length;
    const u0 = sepanjang[0];
    const u1 = sepanjang[n - 1];
    const tepiTanah = (zz: number) => [titik(u0, 0), titik(u1, 0), titik(u1, zz), titik(u0, zz)];
    let pts: V3[];
    const g: GarisDalam[] = [];
    if (tertekan) {
      pts = tepiTanah(zAtap);
      g.push({ pts: [titik(u0, zAtap), titik(u1, zAtap)], ...tebing });
    } else {
      pts = [titik(u0, 0), titik(u1, 0)];
      for (let q = n - 1; q >= 0; q--) pts.push(titik(sepanjang[q], Math.max(zTepi(q), 0)));
    }
    g.push({ pts: [titik(u0, 0), titik(u1, 0)], ...tebing });
    g.push({ pts: [titik(u0, 0), titik(u0, tertekan ? zAtap : Math.max(zTepi(0), 0))], ...tebing });
    g.push({ pts: [titik(u1, 0), titik(u1, tertekan ? zAtap : Math.max(zTepi(n - 1), 0))], ...tebing });
    muka.push({ pts: hadap(pts, sd.luar), satuSisi: true, garis: null, arsir: "tanah", garisDalam: g, lapis: 1 });
    if (tertekan && tPenutup > 0) {
      const band = [titik(u0, zAtap), titik(u1, zAtap), titik(u1, zAtap + tPenutup), titik(u0, zAtap + tPenutup)];
      muka.push({
        pts: hadap(band, sd.luar),
        satuSisi: true,
        garis: null,
        arsir: "beton",
        lapis: 1,
        garisDalam: [
          { pts: [titik(u0, zAtap + tPenutup), titik(u1, zAtap + tPenutup)], ...tebing },
          { pts: [titik(u0, zAtap), titik(u0, zAtap + tPenutup)], ...tebing },
          { pts: [titik(u1, zAtap), titik(u1, zAtap + tPenutup)], ...tebing },
        ],
      });
    }
  }

  // Alas kedap air di bawah dasar akuifer.
  const zPu = zPuncak(st);
  const tebalAlas = 0.06 * zPu;
  const alas = kotak([-L, -L, -tebalAlas * VE], [L, L, 0], { satuSisi: true, garis: C.concrete, bobot: W.bold });
  for (let i = 0; i < alas.length; i++) {
    if (i === 1) continue; // muka atas tertutup blok
    alas[i].arsir = "beton";
    alas[i].lapis = 1;
    muka.push(alas[i]);
  }

  // Pipa sumur: prisma segi empat dari muka air di sumur sampai di atas muka air awal.
  const rp = jariPipa(st);
  const pipa: MukaSumur["pipa"] = [];
  for (const w of st.wells) {
    const mw = medanSumur(st.wells as Sumur[], w.x, w.y, st.aq);
    const zw = st.zAwal - mw.s;
    const luar = mw.dry || (st.zAtap !== undefined && zw < st.zAtap);
    const denah = [
      { x: w.x - rp, y: w.y - rp },
      { x: w.x + rp, y: w.y - rp },
      { x: w.x + rp, y: w.y + rp },
      { x: w.x - rp, y: w.y + rp },
    ];
    const pr = prisma(denah, Math.max(zw, 0) * VE, zPu * VE, {
      satuSisi: true,
      garis: luar ? C.signal : C.ink,
      bobot: W.bold,
    });
    pr.splice(1, 1); // alas pipa tidak pernah terlihat
    if (luar)
      for (const f of pr) {
        f.arsir = "sinyal";
        f.isi = C.signalFill;
      }
    muka.push(...pr);
    pipa.push({ muka: pr, luar });
  }

  // Muka air awal: segi empat putus-putus di aras zAwal (datum), di atas segalanya.
  const za = st.zAwal;
  const pojok = [P(-L, -L, za), P(L, -L, za), P(L, L, za), P(-L, L, za)];
  for (let q = 0; q < 4; q++)
    muka.push({
      pts: [pojok[q], pojok[(q + 1) % 4]],
      isi: null,
      garis: C.water,
      bobot: W.thin,
      dash: tertekan ? DASH.axis : DASH.hidden,
      lapis: 2,
    });

  const labelKontur = [...perLevel.entries()].map(([level, arr]) => ({ level, titik: Float64Array.from(arr) }));

  return {
    muka,
    batas: { min: [-L, -L, -tebalAlas * VE], max: [L, L, zPu * VE] },
    VE,
    medan: m,
    kontur,
    labelKontur,
    permukaan,
    pipa,
  };
}

/** Ruang judul di atas gambar, px. */
export const RUANG_JUDUL_ISO = 34;
/** Ruang tulisan skala tegak di bawah gambar, px. */
export const RUANG_KAKI_ISO = 18;
/** Margin kameraPas di keempat sisi, px. */
export const MARGIN_ISO = 20;

/** Tinggi/lebar kotak batas terproyeksi pada pandangan awal (tinggi bidang di HP). */
export function rasioIsoSumur(st: IsoSumurState, yaw: number = -ISO.yaw, pitch: number = ISO.pitch): number {
  const { batas } = mukaSumur(st);
  const k = kameraPas(batas, 1000, 1e9, yaw, pitch, 0);
  let y0 = Infinity;
  let y1 = -Infinity;
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

/** Kamera gambar pada kanvas w × h (sama dengan yang dipakai drawIsoSumur). */
export function kameraSumur(st: IsoSumurState, w: number, h: number, yaw: number, pitch: number): Kamera {
  const { batas } = mukaSumur(st);
  const k = kameraPas(batas, w, h - RUANG_JUDUL_ISO - RUANG_KAKI_ISO, yaw, pitch, MARGIN_ISO);
  k.cy += RUANG_JUDUL_ISO;
  return k;
}

/**
 * Piksel → titik denah (x, y) di bidang muka air awal, untuk menaruh dan
 * menyeret sumur. null bila pandangan mendatar (tidak terjadi: pitch ≥ 10°).
 */
export function balikSumur(px: number, py: number, k: Kamera, st: IsoSumurState): readonly [number, number] | null {
  return balikDiBidangZ(px, py, k, st.zAwal * mukaSumur(st).VE);
}

const ingatAngka = new Map<string, string>();

/** Kunci anchor sumur ke-i (pegangan DragLayer). */
export const anchorSumur = (i: number) => `sumur${i}`;

/**
 * Menggambar GW-02 isometrik. Anchor `sumur<i>` = titik pipa sumur ke-i di
 * bidang muka air awal (tempat balikSumur membaca piksel). Bingkai plateOut
 * = bidang di bawah ruang judul, untuk klik-taruh.
 */
export function drawIsoSumur(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  st: IsoSumurState,
  teks: IsoSumurTeks,
  opts: { yaw?: number; pitch?: number } = {}
): PlateOut & { kamera: Kamera; VE: number } {
  ground(ctx, w, h);
  const ms = mukaSumur(st);
  /* Angka di gambar lewat fmtPlain (toLocaleString, mahal: ±0,05 ms per
     panggil) diingat per nilai dan bahasa; satu panggilan pemeriksa bahasa
     per bingkai, bukan satu per tulisan. */
  const bahasa = fmtPlain(1.5, 1);
  const angka = (v: number, d: number) => {
    const kunci = `${v}|${d}|${bahasa}`;
    let s = ingatAngka.get(kunci);
    if (s === undefined) {
      if (ingatAngka.size > 256) ingatAngka.clear();
      s = fmtPlain(v, d);
      ingatAngka.set(kunci, s);
    }
    return s;
  };
  const yaw = opts.yaw ?? -ISO.yaw;
  const pitch = opts.pitch ?? ISO.pitch;
  const k = kameraSumur(st, w, h, yaw, pitch);
  const bingkai = { x0: 0, y0: 0, x1: w, y1: h };
  gambarMuka(ctx, ms.muka, k, { bingkai });

  const placer = createLabelPlacer(ctx, { padL: 0, padT: 0, plotW: w, plotH: h });
  if (teks.heading) placer.write(teks.heading, w / 2, 20, teks.headingInvalid ? C.signal : C.ink3, { big: true });

  const VE = ms.VE;
  const zPu = zPuncak(st) * VE;

  // Nama sumur di atas pipa.
  st.wells.forEach((wl, i) => {
    const A = anchor3([wl.x, wl.y, zPu], k);
    placer.write(`${teks.sumur} ${i + 1}`, A.x, A.y - 12, ms.pipa[i]?.luar ? C.signal : C.ink);
  });

  /* Tulisan biasa (tanpa stensil: "s" dan "m" tetap huruf kecil) dengan
     alas kertas, ditaruh lewat placer supaya tidak bertumpuk. */
  const tulis = (t: string, x: number, y: number, warna: string, align: CanvasTextAlign) => {
    const pos = placer.place(t, x, y, 1, align);
    ctx.font = F.label;
    const lebar = ctx.measureText(t).width + 6;
    const x0 = align === "left" ? pos.x - 3 : align === "right" ? pos.x - lebar + 3 : pos.x - lebar / 2;
    ctx.fillStyle = C.sheet;
    ctx.fillRect(x0, pos.atas, lebar, pos.bawah - pos.atas);
    ctx.fillStyle = warna;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(t, pos.x, pos.y);
    return pos;
  };

  /* Label kontur: tiga aras terluar, di titik ruasnya yang paling kanan di
     layar (sisi kerucut, jarang tertutup). */
  const cyw = Math.cos(k.yaw), syw = Math.sin(k.yaw), cp = Math.cos(k.pitch), sp = Math.sin(k.pitch);
  for (let q = 0; q < Math.min(3, ms.labelKontur.length); q++) {
    const { level, titik } = ms.labelKontur[q];
    let bx = -Infinity, by = 0;
    for (let i = 0; i < titik.length; i += 3) {
      const sx = k.cx + k.skala * (titik[i] * cyw - titik[i + 1] * syw);
      if (sx > bx && sx < w - 8) {
        bx = sx;
        by = k.cy - k.skala * (titik[i + 2] * cp + (titik[i] * syw + titik[i + 1] * cyw) * sp);
      }
    }
    if (!Number.isFinite(bx)) continue;
    ctx.fillStyle = C.water;
    ctx.beginPath();
    ctx.arc(bx, by, 1.6, 0, Math.PI * 2);
    ctx.fill();
    tulis(`s ${angka(level, digitLevel(level))} m`, bx + 6, by, C.water, "left");
  }

  // Jari-jari pengaruh sumur utama: label di titik lingkaran paling kanan.
  {
    const w0 = st.wells[0];
    let bx = -Infinity, by = 0;
    for (let n = 0; n < 72; n++) {
      const t = (2 * Math.PI * n) / 72;
      const x = w0.x + st.aq.R * Math.cos(t);
      const y = w0.y + st.aq.R * Math.sin(t);
      if (Math.abs(x) > st.L || Math.abs(y) > st.L) continue;
      const p = proyeksi([x, y, st.zAwal * VE], k);
      if (p.x > bx && p.x < w - 40) {
        bx = p.x;
        by = p.y;
      }
    }
    if (Number.isFinite(bx)) tulis(`R ${angka(st.aq.R, 0)} m`, bx - 4, by - 10, C.ink2, "right");
  }

  // Muka air awal: label di pojok datum paling kiri.
  {
    const L = st.L;
    let best = { x: Infinity, y: 0 };
    for (const [x, y] of [[-L, -L], [L, -L], [L, L], [-L, L]] as const) {
      const p = anchor3([x, y, st.zAwal * VE], k);
      if (p.x < best.x) best = p;
    }
    tulis(teks.mukaAwal, best.x + 4, best.y - 10, C.water, "left");
  }

  // Skala tegak, selalu ditulis.
  ctx.font = F.label;
  ctx.fillStyle = C.ink2;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const kaki = teks.skalaTegak(angka(VE, 0));
  ctx.fillText(kaki, 8, h - RUANG_KAKI_ISO / 2 - 2);

  const anchors: Record<string, V3> = {};
  st.wells.forEach((wl, i) => {
    anchors[anchorSumur(i)] = [wl.x, wl.y, st.zAwal * VE];
  });
  const out = plateOut3(k, w, h, anchors, { x0: 0, y0: RUANG_JUDUL_ISO, x1: w, y1: h - RUANG_KAKI_ISO });
  return { ...out, labels: rectsFrom(placer.boxes()), kamera: k, VE };
}
