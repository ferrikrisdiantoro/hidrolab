import { C, DASH, F, W } from "./theme.ts";
import { createLabelPlacer, ground, pen } from "./plate.ts";
import { rectsFrom, type PlateOut } from "./plateOut.ts";
import { labyrinthWeir, wesNappe, WES_K, WES_N } from "./hydraulics.ts";
import { nappeHeadwater, nappeThickness } from "./drawNappe.ts";
import {
  ISO,
  anchor3,
  gambarMuka,
  kameraPas,
  kotak,
  normalMuka,
  plateOut3,
  prisma,
  type Kamera,
  type Muka,
  type V3,
} from "./proyeksi.ts";

/**
 * HS-02 3D: BENDUNG LABIRIN ISOMETRIK DENGAN TIRAI LUAPAN.
 *
 * Geometri dinding sama persis dengan denah model labyrinthWeir
 * (hydraulics.ts): tiap siklus selebar w = W / siklus berdenah trapesium,
 * kaki dari tepi siklus (x 0) ke puncak (x B) bergeser w/4 melintang,
 * puncak selebar w/2. Panjang garis tengah seluruh ruas = crestLength
 * model (diuji). Tinggi dinding = P, muka air hulu = P + h.
 *
 * Koordinat: x searah aliran (hulu di x < 0), y melintang 0..W, z elevasi
 * dari lantai saluran.
 *
 * Tirai (spesifikasi insinyur 3D-HS02-TIRAI, mengikat):
 * - Profil 2D yang ada, bukan rumus baru: sisi bawah wesNappe(h, d),
 *   d = jarak mendatar tegak lurus dari muka hilir dinding; sampai lantai
 *   di d_end = (2·h^0,85·P)^(1/1,85) (fillNappePath dengan tail = 0).
 *   Tebal dari nappeThickness dengan q = Q_model / panjang mercu, tegak
 *   lurus sisi bawah (normal analitik wesNappe, sama arah dengan
 *   nappeSheet)
 * - Va: nappeEnergy memakai Va = q/(h + P), sedangkan kecepatan datang
 *   labirin Q/(W(h + P)) lebih besar L/W kali. Selisih E ±5 cm (±2 % laju)
 *   pada bawaan; hanya mengubah tebal lembaran sedikit. Dicatat, tidak
 *   diubah (parameter Va di nappeEnergy = tugas pengembang-model)
 * - Disapu ke normal KANAN tiap ruas (sisi hilir; normal kiri ke siklus
 *   hulu). Sudut cembung x = B: profil yang sama diputar mengelilingi
 *   sumbu tegak di titik sudut, di antara kedua normal kanan. Titik V di
 *   x = 0 (sudut cekung di sisi hilir) tidak memancarkan tirai
 * - Lembaran tiap siklus dipotong pada bidang sumbu siklus hilirnya,
 *   y = i·w dan (i+1)·w, yang juga dinding saluran di y = 0 dan W. Garis
 *   temu tipis di tiap sumbu dalam, tanpa arsir dan tanpa label. Arsir
 *   merah sinyal di penampang temu HANYA bila model menandai interference
 *   (h/P > 0,9); tidak ada angka panjang zona
 * - Model tanpa muka air hilir: tirai sampai lantai (hilir bebas)
 * - Siklus sempit (sidewallTooSharp atau cycleTooNarrow) atau h ≤ 0:
 *   tirai dan air siklus tidak digambar
 *
 * Yang SKEMATIK dan ditulis di catatan lembar:
 * - Tebal dinding tidak ada di model; dipakai aturan gambar denah 2D lembar
 *   ini (5 % lebar siklus, paling tipis 0,12 m)
 * - Tirai dari profil 2D ambang tajam (WES) tegak lurus dinding; aliran
 *   miring di dinding sisi dan mercu bulat tidak dimodelkan
 * - Air siklus hulu: muka nappeHeadwater(h, P, −jarak ke dinding terdekat)
 *   (Chow 1959 bab 14, dipakai HS-06); air di atas mercu datar P + 0,85h
 */

export type IsoLabirinState = {
  /** Tinggi muka air di atas mercu, m */
  h: number;
  /** Tinggi mercu, m */
  P: number;
  /** Lebar saluran, m */
  W: number;
  /** Banyaknya siklus */
  cycles: number;
  /** Panjang siklus searah aliran, m */
  B: number;
  /** Dari model: di luar rentang berlaku (tirai bertemu) */
  outOfRange: boolean;
};

export type IsoLabirinOptions = {
  yaw?: number;
  pitch?: number;
  /** Judul gambar, sudah dalam bahasa lembar */
  heading?: string;
  /**
   * Nama zona arsir tirai bertemu, sudah dalam bahasa lembar ("tirai
   * bertemu (h/P > 0,9)"). Hanya ditulis bila arsirnya ada (interference).
   */
  labelBertemu?: string;
};

/** Ruas garis tengah dinding mercu dalam denah (x searah aliran, y melintang). */
export type RuasDinding = { a: { x: number; y: number }; b: { x: number; y: number } };

/** Tebal dinding skematik sebagai pecahan lebar satu siklus (lihat catatan berkas). */
export const TEBAL_PECAHAN = 0.05;
/** Tebal dinding skematik paling tipis, m. */
export const TEBAL_MIN = 0.12;

/** Tebal dinding skematik, m (lihat catatan berkas). */
export function tebalDinding(W: number, cycles: number): number {
  return Math.max((W / Math.max(cycles, 1)) * TEBAL_PECAHAN, TEBAL_MIN);
}

/** Garis tengah dinding mercu: 3 ruas per siklus, dari denah model. */
export function ruasLabirin(W: number, cycles: number, B: number): RuasDinding[] {
  const n = Math.max(1, Math.round(cycles));
  const w = W / n;
  const out: RuasDinding[] = [];
  for (let i = 0; i < n; i++) {
    const y0 = i * w;
    const p0 = { x: 0, y: y0 };
    const p1 = { x: B, y: y0 + w / 4 };
    const p2 = { x: B, y: y0 + (3 * w) / 4 };
    const p3 = { x: 0, y: y0 + w };
    out.push({ a: p0, b: p1 }, { a: p1, b: p2 }, { a: p2, b: p3 });
  }
  return out;
}

/**
 * Batas panjang miter terhadap setengah tebal. Di atasnya (sudut lebih
 * tajam) sisi CEMBUNG sambungan dibevel: miter penuh di V hulu (α 6°)
 * menjulurkan taji ±1,2 m ke kolam hulu, dan miter yang dijepit menipiskan
 * dinding ke 1,5·t·sin α (default α 11,8°: 0,61 t). Sisi cekung selalu
 * miter penuh: titik itu perpotongan sejati kedua muka dinding.
 */
const MITER_MAKS = 3;

type Titik2 = { x: number; y: number };

/**
 * Denah dinding: satu segi empat per ruas (berlawanan jarum jam dilihat
 * dari atas: kanan-awal, kanan-akhir, kiri-akhir, kiri-awal), ditambah
 * baji segitiga di tiap sambungan yang dibevel. Setiap titik segi empat
 * ruas berjarak tepat t/2 dari garis tengah ruasnya (tebal penuh di mana
 * pun). Ujung ruas pertama dan terakhir dipotong di dinding saluran y = 0
 * dan y = W, bukan menjulur keluar.
 */
export function alasDinding(
  ruas: readonly RuasDinding[],
  t: number,
  W: number
): { ruas: Titik2[][]; baji: Titik2[][] } {
  const m = ruas.length;
  const arah = ruas.map((r) => {
    const dx = r.b.x - r.a.x;
    const dy = r.b.y - r.a.y;
    const L = Math.hypot(dx, dy) || 1;
    return { x: dx / L, y: dy / L };
  });
  // Normal kiri satuan tiap ruas.
  const nl = arah.map((d) => ({ x: -d.y, y: d.x }));
  const h = t / 2;
  const kiriA: Titik2[] = [], kiriB: Titik2[] = [], kananA: Titik2[] = [], kananB: Titik2[] = [];
  const baji: Titik2[][] = [];

  /* Ujung saluran: perpotongan garis muka (offset ±t/2) dengan y = yc. */
  const diDinding = (j: number, sisi: 1 | -1, yc: number): Titik2 => {
    const o = { x: ruas[j].a.x + sisi * nl[j].x * h, y: ruas[j].a.y + sisi * nl[j].y * h };
    const s = Math.abs(arah[j].y) > 1e-12 ? (yc - o.y) / arah[j].y : 0;
    return { x: o.x + arah[j].x * s, y: yc };
  };
  kiriA[0] = diDinding(0, 1, 0);
  kananA[0] = diDinding(0, -1, 0);
  kiriB[m - 1] = diDinding(m - 1, 1, W);
  kananB[m - 1] = diDinding(m - 1, -1, W);

  for (let i = 1; i < m; i++) {
    const v = ruas[i].a;
    const a = nl[i - 1];
    const b = nl[i];
    const sx = a.x + b.x;
    const sy = a.y + b.y;
    const sl = Math.hypot(sx, sy);
    // Belok kiri (silang > 0): sisi kanan cembung, sisi kiri cekung.
    const silang = arah[i - 1].x * arah[i].y - arah[i - 1].y * arah[i].x;
    const cos = sl > 1e-12 ? (sx / sl) * a.x + (sy / sl) * a.y : 0;
    const miter = sl > 1e-12 ? { x: (sx / sl) * (h / cos), y: (sy / sl) * (h / cos) } : { x: 0, y: 0 };
    const kiriM = { x: v.x + miter.x, y: v.y + miter.y };
    const kananM = { x: v.x - miter.x, y: v.y - miter.y };
    if (cos >= 1 / MITER_MAKS) {
      kiriB[i - 1] = kiriA[i] = kiriM;
      kananB[i - 1] = kananA[i] = kananM;
    } else if (silang > 0) {
      kiriB[i - 1] = kiriA[i] = kiriM;
      kananB[i - 1] = { x: v.x - a.x * h, y: v.y - a.y * h };
      kananA[i] = { x: v.x - b.x * h, y: v.y - b.y * h };
      baji.push([kiriM, kananB[i - 1], kananA[i]]);
    } else {
      kananB[i - 1] = kananA[i] = kananM;
      kiriB[i - 1] = { x: v.x + a.x * h, y: v.y + a.y * h };
      kiriA[i] = { x: v.x + b.x * h, y: v.y + b.y * h };
      baji.push([kananM, kiriA[i], kiriB[i - 1]]);
    }
  }
  const segi = ruas.map((_, j) => [kananA[j], kananB[j], kiriB[j], kiriA[j]]);
  // Baji berlawanan jarum jam (luas bertanda positif) untuk prisma.
  for (const tri of baji) {
    const [p, q, r] = tri;
    if ((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x) < 0) tri.reverse();
  }
  return { ruas: segi, baji };
}

/**
 * Dinding mercu sebagai rangkaian prisma tegak 0..P: satu per ruas dan
 * satu per baji bevel. Ruas bertetangga berbagi titik sambungan, jadi tepi
 * sambungan berimpit (satu garis) dan tidak ada dinding yang bertumpuk.
 */
function dindingMercu(ruas: readonly RuasDinding[], t: number, P: number, W_: number): Muka[] {
  const { ruas: segi, baji } = alasDinding(ruas, t, W_);
  const out: Muka[] = [];
  const gaya = { satuSisi: true, bobot: W.bold, garis: C.concrete } as const;
  for (const alas of segi) out.push(...prisma(alas, 0, P, gaya));
  for (const alas of baji) out.push(...prisma(alas, 0, P, gaya));
  return out;
}

/* ------------------------------------------------------------------ *
 * Tirai luapan
 * ------------------------------------------------------------------ */

/**
 * Bagian dinding yang memancarkan tirai di sisi hilirnya.
 * - ruas: titik = a + u·s + n·(t/2 + D), s ∈ [0, L], n normal KANAN satuan
 * - sudut: sudut cembung x = B, titik = v + (t/2 + D)·(cos θ, sin θ),
 *   θ ∈ [th0, th0 + dth] dari normal kanan ruas sebelum ke ruas sesudah
 */
export type ElemenTirai =
  | { jenis: "ruas"; siklus: number; a: Titik2; u: Titik2; L: number; n: Titik2 }
  | { jenis: "sudut"; siklus: number; v: Titik2; th0: number; dth: number };

/** Satu muka lembaran: sisi bawah, sisi atas, atau ujung di lantai. */
export type LembarTirai = { sisi: "bawah" | "atas" | "ujung"; pts: V3[]; elemen: ElemenTirai };

export type TiraiLabirin = {
  lembar: LembarTirai[];
  /** Garis temu (sisi atas lembaran) di tiap bidang sumbu siklus hilir dalam */
  temu: V3[][];
  /** Penampang temu per sumbu, HANYA bila interference; kosong bila tidak */
  arsir: V3[][];
  /** Jangkauan sisi bawah di lantai, m dari muka hilir dinding */
  dEnd: number;
  /** Debit per meter panjang mercu, m²/s */
  q: number;
  interference: boolean;
};

type Profil = (w: number) => readonly [number, number];

/** Tirai digambar? Tidak bila siklus di luar segala percobaan atau h ≤ 0. */
function adaTirai(s: Pick<IsoLabirinState, "h" | "P" | "W" | "cycles" | "B">) {
  const r = labyrinthWeir(s.h, s.P, s.W, s.cycles, s.B);
  return { r, ada: s.h > 0 && s.P > 0 && !(r.sidewallTooSharp || r.cycleTooNarrow) };
}

function letak(e: ElemenTirai, u: number, R: number): [number, number] {
  if (e.jenis === "ruas") return [e.a.x + e.u.x * u + e.n.x * R, e.a.y + e.u.y * u + e.n.y * R];
  return [e.v.x + R * Math.cos(u), e.v.y + R * Math.sin(u)];
}

type Titik = { u: number; w: number; p: V3 };

/**
 * Sutherland-Hodgman satu bidang y = c pada poligon di ruang parameter
 * (u, w). Titik potong dicari dengan bagi dua sepanjang sisi parameter dan
 * dihitung ulang dari fungsi permukaan, jadi titik baru tetap TEPAT di
 * permukaan (sisi bawah tetap z = P − wesNappe(h, d)) dan di sisi dalam
 * bidang.
 */
function klipY(poli: Titik[], F: (u: number, w: number) => V3, c: number, arah: 1 | -1): Titik[] {
  const di = (p: V3) => arah * (p[1] - c) >= 0;
  const out: Titik[] = [];
  const n = poli.length;
  for (let i = 0; i < n; i++) {
    const A = poli[i];
    const Bt = poli[(i + 1) % n];
    const inA = di(A.p);
    const inB = di(Bt.p);
    if (inA !== inB) {
      // lo selalu di dalam, hi di luar
      let lo = inA ? 0 : 1;
      let hi = inA ? 1 : 0;
      let pLo = inA ? A.p : Bt.p;
      for (let it = 0; it < 54; it++) {
        const m = (lo + hi) / 2;
        const p = F(A.u + (Bt.u - A.u) * m, A.w + (Bt.w - A.w) * m);
        if (di(p)) {
          lo = m;
          pLo = p;
        } else hi = m;
      }
      out.push({ u: A.u + (Bt.u - A.u) * lo, w: A.w + (Bt.w - A.w) * lo, p: pLo });
    }
    if (inB) out.push(Bt);
  }
  return out;
}

/** Titik permukaan pada w tetap yang tepat di bidang y = c, atau null. */
function lintasY(e: ElemenTirai, F: (u: number, w: number) => V3, w: number, c: number): V3 | null {
  const u0 = e.jenis === "ruas" ? 0 : e.th0;
  const u1 = e.jenis === "ruas" ? e.L : e.th0 + e.dth;
  let g0 = F(u0, w)[1] - c;
  const g1 = F(u1, w)[1] - c;
  if (g0 === 0) return F(u0, w);
  if (g0 * g1 > 0) return null;
  let lo = u0, hi = u1;
  for (let it = 0; it < 54; it++) {
    const m = (lo + hi) / 2;
    const g = F(m, w)[1] - c;
    if ((g <= 0) === (g0 <= 0)) {
      lo = m;
      g0 = g;
    } else hi = m;
  }
  return F((lo + hi) / 2, w);
}

/**
 * Lembaran tirai seluruh labirin dari profil 2D yang ada (lihat catatan
 * berkas). Dibangun sekali per masukan; gambar memakai mukaLabirin.
 */
export function tiraiLabirin(s: Pick<IsoLabirinState, "h" | "P" | "W" | "cycles" | "B">): TiraiLabirin {
  const { r, ada } = adaTirai(s);
  const q = r.crestLength > 0 ? r.Q / r.crestLength : 0;
  const dEnd = s.h > 0 && s.P > 0 ? Math.pow(WES_K * Math.pow(s.h, WES_N - 1) * s.P, 1 / WES_N) : 0;
  const hasil: TiraiLabirin = { lembar: [], temu: [], arsir: [], dEnd, q, interference: r.interference };
  if (!ada) return hasil;

  const { h, P } = s;
  const n = Math.max(1, Math.round(s.cycles));
  const w = s.W / n;
  const t = tebalDinding(s.W, s.cycles);
  const R0 = t / 2;
  // Kerapatan: siklus banyak = tiap siklus kecil di layar, pita lebih sedikit.
  const K = n > 8 ? 6 : 10;
  const KIPAS = n > 8 ? 3 : 4;
  const sigma = Array.from({ length: K + 1 }, (_, k) => (dEnd * k) / K);

  const bawah: Profil = (d) => [d, Math.max(P - wesNappe(h, d), 0)];
  const atas: Profil = (d) => {
    const zb = Math.max(P - wesNappe(h, d), 0);
    const tb = nappeThickness({ h, P, q }, d);
    // Kemiringan sisi bawah dz/dd = −wesNappe'(d); normal ke atas-luar.
    const sl = d > 0 ? (WES_N * Math.pow(d, WES_N - 1)) / (WES_K * Math.pow(h, WES_N - 1)) : 0;
    const len = Math.hypot(1, sl);
    return [d + (sl / len) * tb, zb + tb / len];
  };
  const b1 = bawah(dEnd);
  const a1 = atas(dEnd);
  const ujung: Profil = (l) => [b1[0] + (a1[0] - b1[0]) * l, b1[1] + (a1[1] - b1[1]) * l];
  const permukaan = (e: ElemenTirai, pr: Profil) => (u: number, ww: number): V3 => {
    const [D, z] = pr(ww);
    const [x, y] = letak(e, u, R0 + D);
    return [x, y, z];
  };

  // Elemen tiap siklus: tiga ruas dan dua sudut cembung (x = B).
  const ruas = ruasLabirin(s.W, n, s.B);
  const elemenSiklus: ElemenTirai[][] = [];
  for (let i = 0; i < n; i++) {
    const el: ElemenTirai[] = [];
    const nk: Titik2[] = [];
    for (let j = 3 * i; j < 3 * i + 3; j++) {
      const g = ruas[j];
      const dx = g.b.x - g.a.x;
      const dy = g.b.y - g.a.y;
      const L = Math.hypot(dx, dy) || 1;
      const u = { x: dx / L, y: dy / L };
      const nKanan = { x: u.y, y: -u.x };
      nk.push(nKanan);
      el.push({ jenis: "ruas", siklus: i, a: g.a, u, L, n: nKanan });
    }
    for (let j = 0; j < 2; j++) {
      const th0 = Math.atan2(nk[j].y, nk[j].x);
      let dth = Math.atan2(nk[j + 1].y, nk[j + 1].x) - th0;
      while (dth <= 0) dth += 2 * Math.PI;
      while (dth > 2 * Math.PI) dth -= 2 * Math.PI;
      el.push({ jenis: "sudut", siklus: i, v: ruas[3 * i + j].b, th0, dth });
    }
    elemenSiklus.push(el);
  }

  const tambah = (
    e: ElemenTirai,
    sisi: LembarTirai["sisi"],
    pr: Profil,
    u0: number,
    u1: number,
    w0: number,
    w1: number,
    lo: number,
    hi: number
  ) => {
    const F = permukaan(e, pr);
    let poli: Titik[] = [
      { u: u0, w: w0, p: F(u0, w0) },
      { u: u1, w: w0, p: F(u1, w0) },
      { u: u1, w: w1, p: F(u1, w1) },
      { u: u0, w: w1, p: F(u0, w1) },
    ];
    poli = klipY(poli, F, lo, 1);
    if (poli.length >= 3) poli = klipY(poli, F, hi, -1);
    if (poli.length < 3) return;
    const pts = poli.map((p) => p.p);
    // Arah luar: bawah ke arah dinding, atas menjauh, ujung ke hilir.
    let uc = 0, wc = 0;
    for (const p of poli) {
      uc += p.u;
      wc += p.w;
    }
    uc /= poli.length;
    wc /= poli.length;
    let luar: [number, number, number];
    if (sisi === "ujung") {
      const [x0, y0] = letak(e, uc, R0);
      const [x1, y1] = letak(e, uc, R0 + 1);
      luar = [x1 - x0, y1 - y0, 0];
    } else {
      const pa = permukaan(e, atas)(uc, wc);
      const pb = permukaan(e, bawah)(uc, wc);
      const tanda = sisi === "atas" ? 1 : -1;
      luar = [tanda * (pa[0] - pb[0]), tanda * (pa[1] - pb[1]), tanda * (pa[2] - pb[2])];
    }
    const nm = normalMuka(pts);
    if (nm[0] * luar[0] + nm[1] * luar[1] + nm[2] * luar[2] < 0) pts.reverse();
    hasil.lembar.push({ sisi, pts, elemen: e });
  };

  for (let i = 0; i < n; i++) {
    const lo = i * w;
    const hi = (i + 1) * w;
    for (const e of elemenSiklus[i]) {
      const potong =
        e.jenis === "ruas"
          ? [0, e.L]
          : Array.from({ length: KIPAS + 1 }, (_, m) => e.th0 + (e.dth * m) / KIPAS);
      for (let m = 0; m + 1 < potong.length; m++) {
        const u0 = potong[m];
        const u1 = potong[m + 1];
        for (let k = 0; k < K; k++) {
          tambah(e, "bawah", bawah, u0, u1, sigma[k], sigma[k + 1], lo, hi);
          tambah(e, "atas", atas, u0, u1, sigma[k], sigma[k + 1], lo, hi);
        }
        tambah(e, "ujung", ujung, u0, u1, 0, 1, lo, hi);
      }
    }
  }

  // Garis temu dan penampang temu di tiap sumbu siklus hilir dalam: lembaran
  // siklus i (ruas ketiga dan sudut kedua) memotong y = (i + 1)·w.
  for (let i = 0; i + 1 < n; i++) {
    const c = (i + 1) * w;
    const el = [elemenSiklus[i][2], elemenSiklus[i][4]];
    const cari = (pr: Profil, ww: number) => {
      for (const e of el) {
        const p = lintasY(e, permukaan(e, pr), ww, c);
        if (p) return [p[0], c, p[2]] as V3;
      }
      return null;
    };
    const U: V3[] = [];
    const Lb: V3[] = [];
    for (const d of sigma) {
      const pu = cari(atas, d);
      const pl = cari(bawah, d);
      if (pu) U.push(pu);
      if (pl) Lb.push(pl);
    }
    if (U.length >= 2) hasil.temu.push(U);
    // Berpasangan per stasiun (pita profil yang sama di kedua sisi).
    if (r.interference && U.length >= 2 && Lb.length === U.length) hasil.arsir.push([...Lb, ...U.slice().reverse()]);
  }
  return hasil;
}

/**
 * Muka air di dalam siklus hulu: muka nappeHeadwater(h, P, −jarak ke muka
 * dinding terdekat), dibatasi muka dalam kedua kaki dan puncak. Kosong
 * bila tirai tidak digambar.
 */
export function airSiklusHulu(s: Pick<IsoLabirinState, "h" | "P" | "W" | "cycles" | "B">): Muka[] {
  if (!adaTirai(s).ada) return [];
  const n = Math.max(1, Math.round(s.cycles));
  const w = s.W / n;
  const R0 = tebalDinding(s.W, s.cycles) / 2;
  const L = Math.hypot(s.B, w / 4);
  const cosA = s.B / L;
  const miring = w / (4 * s.B);
  const xA = s.B - R0;
  const NU = 6;
  const NV = 4;
  const out: Muka[] = [];
  const gaya = { bahan: "air", garis: null, satuSisi: true } as const;
  for (let i = 0; i < n; i++) {
    const y0 = i * w;
    const yl = (x: number) => y0 + miring * x + R0 / cosA;
    const yr = (x: number) => y0 + w - miring * x - R0 / cosA;
    if (!(yr(xA) > yl(xA)) || !(xA > 0)) continue;
    const titik: V3[] = [];
    for (let iv = 0; iv <= NV; iv++)
      for (let iu = 0; iu <= NU; iu++) {
        const x = (xA * iu) / NU;
        const y = yl(x) + ((yr(x) - yl(x)) * iv) / NV;
        const dist = Math.max(0, Math.min((y - yl(x)) * cosA, (yr(x) - y) * cosA, xA - x));
        titik.push([x, y, nappeHeadwater(s.h, s.P, -dist)]);
      }
    for (let iv = 0; iv < NV; iv++)
      for (let iu = 0; iu < NU; iu++) {
        const a = iv * (NU + 1) + iu;
        out.push({ ...gaya, pts: [titik[a], titik[a + 1], titik[a + NU + 2], titik[a + NU + 1]] });
      }
  }
  return out;
}

let cache: { kunci: string; hasil: { muka: Muka[]; batas: { min: V3; max: V3 } } } | null = null;

/**
 * Seluruh muka gambar, terpisah dari kamera supaya bisa diuji. Di-cache
 * per masukan: memutar gambar hanya memproyeksi ulang, tidak membangun
 * lembaran lagi.
 */
export function mukaLabirin(s: IsoLabirinState): { muka: Muka[]; batas: { min: V3; max: V3 } } {
  const kunci = `${s.h}|${s.P}|${s.W}|${s.cycles}|${s.B}`;
  if (cache && cache.kunci === kunci) return cache.hasil;
  const hasil = bangunMuka(s);
  cache = { kunci, hasil };
  return hasil;
}

function bangunMuka(s: IsoLabirinState): { muka: Muka[]; batas: { min: V3; max: V3 } } {
  const t = tebalDinding(s.W, s.cycles);
  const T = tiraiLabirin(s);
  const bertirai = T.lembar.length > 0;
  let xMaks = 0;
  for (const l of T.lembar) for (const p of l.pts) if (p[0] > xMaks) xMaks = p[0];
  const hulu = Math.max(s.B * 0.6, 1);
  const hilir = Math.max(s.B * 0.5, 1, xMaks - s.B + 0.3);
  const lantai = Math.max(s.P * 0.12, 0.1);
  const muka: Muka[] = [];

  // Lantai saluran: muka atas polos, muka potongan diarsir beton.
  const dasar = kotak([-hulu, 0, -lantai], [s.B + hilir, s.W, 0], {
    satuSisi: true,
    bobot: W.bold,
    garis: C.concrete,
  });
  for (let i = 0; i < dasar.length; i++) {
    if (i !== 1) dasar[i].arsir = "beton";
    // Alas segalanya: digambar lebih dulu daripada dinding dan air.
    dasar[i].lapis = -1;
  }
  muka.push(...dasar);

  muka.push(...dindingMercu(ruasLabirin(s.W, s.cycles, s.B), t, s.P, s.W));

  // Kolam hulu, muka air datar P + h (skematik, lihat catatan berkas).
  const air = kotak([-hulu, 0, 0], [0, s.W, s.P + s.h], {
    satuSisi: true,
    bahan: "air",
    garis: C.water,
    bobot: W.thin,
  });
  air[0].garis = null; // alas air berimpit lantai
  for (let i = 2; i < air.length; i++) air[i].arsir = "air";
  // Bertirai: air kolam menyambung ke siklus hulu, bidang x = 0 bukan muka.
  muka.push(...(bertirai ? air.filter((_, i) => i !== 5) : air));

  if (bertirai) {
    muka.push(...airSiklusHulu(s));
    // Air di atas mercu, datar setinggi muka hulu di bidang mercu.
    const zM = nappeHeadwater(s.h, s.P, 0);
    const { ruas: segi, baji } = alasDinding(ruasLabirin(s.W, s.cycles, s.B), t, s.W);
    for (const alas of [...segi, ...baji])
      muka.push({ pts: alas.map((p) => [p.x, p.y, zM] as V3), bahan: "air", garis: null, satuSisi: true });
    for (const l of T.lembar) muka.push({ pts: l.pts, bahan: "air", garis: null, satuSisi: true });
    /* Garis temu dan penampang temu dipecah per pita profil: satu muka
       besar diurut dari titik beratnya saja dan bisa menimpa dinding di
       depannya. Garis dua titik = muka tanpa isi (closePath bolak-balik). */
    for (const g of T.temu)
      for (let k = 0; k + 1 < g.length; k++)
        muka.push({ pts: [g[k], g[k + 1]], isi: null, garis: C.water, bobot: W.thin });
    for (const a of T.arsir) {
      // a = sisi bawah L0..Lm lalu sisi atas Um..U0 (m + 1 titik masing-masing)
      const m = a.length / 2 - 1;
      for (let k = 0; k < m; k++) {
        const L0 = a[k], L1 = a[k + 1], U1 = a[a.length - 2 - k], U0 = a[a.length - 1 - k];
        muka.push({ pts: [L0, L1, U1, U0], isi: C.signalFill, garis: null, arsir: "sinyal" });
        muka.push({ pts: [L0, L1], isi: null, garis: C.signal, bobot: W.thin });
      }
    }
  }

  return {
    muka,
    batas: { min: [-hulu, 0, -lantai], max: [s.B + hilir, s.W, s.P + s.h] },
  };
}

/** Ruang judul di atas gambar, px. */
export const RUANG_JUDUL_ISO = 34;
const RUANG_JUDUL = RUANG_JUDUL_ISO;
/** Margin kameraPas di keempat sisi, px. */
export const MARGIN_ISO = 20;

/**
 * Tinggi/lebar kotak batas terproyeksi pada pandangan awal. Lembar memakai
 * ini untuk tinggi bidang gambar isometrik: tinggi = rasio·(lebar − 2·margin)
 * + 2·margin + ruang judul, jadi di HP (bidang sempit) gambar tidak duduk
 * kecil di tengah bidang yang tinggi. Pandangan yang diputar tetap muat
 * (kameraPas), hanya bisa lebih kecil.
 */
export function rasioIsoLabirin(
  s: IsoLabirinState,
  yaw: number = -ISO.yaw,
  pitch: number = ISO.pitch
): number {
  const { batas } = mukaLabirin(s);
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

/**
 * Menggambar HS-02 isometrik. Mengembalikan PlateOut (anchor terproyeksi:
 * `puncak` = puncak mercu siklus pertama, `hulu` = muka air hulu di tengah
 * kolam) dan kamera yang dipakai, untuk toValue pegangan di Client.
 */
export function drawIsoLabirin(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: IsoLabirinState,
  opts: IsoLabirinOptions = {}
): PlateOut & { kamera: Kamera } {
  ground(ctx, w, h);
  const { muka, batas } = mukaLabirin(s);
  /* Bawaan: pengamat di hilir kiri (yaw −45°), aliran datang dari kiri
     atas menuju pengamat, jadi muka hilir dinding dan siklus terbuka ke
     hilir terlihat. */
  const yaw = opts.yaw ?? -ISO.yaw;
  const pitch = opts.pitch ?? ISO.pitch;
  const k = kameraPas(batas, w, h - RUANG_JUDUL, yaw, pitch, MARGIN_ISO);
  k.cy += RUANG_JUDUL;

  const bingkai = { x0: 0, y0: 0, x1: w, y1: h };
  gambarMuka(ctx, muka, k, { bingkai });

  const placer = createLabelPlacer(ctx, { padL: 0, padT: 0, plotW: w, plotH: h });
  if (opts.heading)
    placer.write(opts.heading, w / 2, 20, s.outOfRange ? C.signal : C.ink3, { big: true });

  /* Nama zona tirai bertemu: hanya bila arsirnya ada (model menandai
     interference). Garis penunjuk ke penampang temu sumbu tengah. Ditulis
     tanpa stencil supaya "h/P" tidak menjadi "H/P". */
  const arsir = muka.filter((m) => m.arsir === "sinyal");
  if (opts.labelBertemu && arsir.length > 0) {
    const zona = arsir[Math.floor((arsir.length - 1) / 2)].pts;
    let cx = 0, cy = 0, cz = 0;
    for (const p of zona) {
      cx += p[0];
      cy += p[1];
      cz += p[2];
    }
    const A = anchor3([cx / zona.length, cy / zona.length, cz / zona.length], k);
    const kanan = A.x < w * 0.6;
    const pos = placer.place(opts.labelBertemu, A.x + (kanan ? 30 : -30), A.y + 36, 1.4, kanan ? "left" : "right");
    // Alas selebar huruf biasa (placer mengukur huruf stensil kapital).
    ctx.font = F.label;
    const lebar = ctx.measureText(opts.labelBertemu).width + 6;
    ctx.fillStyle = C.sheet;
    ctx.fillRect(kanan ? pos.x - 3 : pos.x - lebar + 3, pos.atas, lebar, pos.bawah - pos.atas);
    pen(ctx, W.thin, C.signal, DASH.solid);
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(kanan ? pos.x - 3 : pos.x + 3, pos.y);
    ctx.stroke();
    ctx.fillStyle = C.signal;
    ctx.beginPath();
    ctx.arc(A.x, A.y, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = F.label;
    ctx.textAlign = kanan ? "left" : "right";
    ctx.textBaseline = "middle";
    ctx.fillText(opts.labelBertemu, pos.x, pos.y);
  }

  const w1 = s.W / Math.max(1, Math.round(s.cycles));
  const out = plateOut3(k, w, h, {
    puncak: [s.B, w1 / 2, s.P],
    hulu: [-Math.max(s.B * 0.6, 1) / 2, s.W / 2, s.P + s.h],
  });
  return { ...out, labels: rectsFrom(placer.boxes()), kamera: k };
}
