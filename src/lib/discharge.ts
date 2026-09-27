/**
 * MODUL DEBIT — dipindahkan dari proyek cl42 ke HidroLab.
 *
 * Dua lembar memakai berkas ini: HY-03 debit penampang saluran dan HY-04
 * lengkung debit. Rumusnya sama dengan cl42 (Manning, Chezy, geometri
 * lingkaran, persegi, dan penampang alam, regresi pangkat dan polinomial),
 * tetapi empat cacat di sana tidak ikut pindah:
 *
 * 1. Muka air yang lebih tinggi daripada saluran dipotong DIAM-DIAM ke tinggi
 *    saluran. Di sini pemotongannya tetap terjadi, karena memang hanya itu
 *    yang dapat dihitung, tetapi selalu bersuara lewat `overtopped`.
 * 2. Penampang alam yang tebingnya lebih rendah daripada muka air dihitung
 *    seolah-olah ujungnya dinding tegak, juga tanpa keterangan.
 * 3. Kurva polinomial pada lengkung debit tergambar sebagai garis q = h,
 *    bukan kurva hasil hitungannya, karena koefisiennya tidak pernah dipakai.
 * 4. Lengkung debit dipakai di luar rentang data ukurnya tanpa peringatan.
 *
 * Ditambah satu bentuk yang dipakai dalam praktik hidrometri tetapi belum ada
 * di cl42: lengkung pangkat dengan tinggi aliran nol, Q = a (H − H0)^b. Papan
 * duga hampir tidak pernah dipasang tepat pada dasar sungai, jadi H = 0 pada
 * papan bukan berarti debit nol. Memaksa bentuk Q = a H^b pada data seperti
 * itu membengkokkan kedua koefisiennya.
 *
 * Rujukan: Chow, V.T. (1959). Open-Channel Hydraulics, bab 5 dan 6;
 * ISO 18320:2020, Hydrometry, determination of the stage-discharge relation;
 * WMO-No. 1044 (2010), Manual on Stream Gauging, jilid II.
 */

export type Pt = { x: number; y: number };

export type SectionShape = "lingkaran" | "persegi" | "alam";

export type SectionInput =
  | { shape: "lingkaran"; D: number }
  | { shape: "persegi"; W: number; Hc: number }
  | { shape: "alam"; pts: Pt[] };

export type Resistance =
  | { method: "manning"; n: number }
  | { method: "chezy"; C: number };

export type SectionFlow = {
  /** Kedalaman yang dipakai menghitung, sesudah dipotong ke tinggi saluran */
  depth: number;
  /** Elevasi muka air yang dipakai, meter di atas titik terendah */
  surface: number;
  area: number;
  perimeter: number;
  radius: number;
  /** Lebar muka air */
  topWidth: number;
  velocity: number;
  discharge: number;
  /** Bilangan Froude, V dibagi akar g kali kedalaman hidraulis */
  froude: number;
  /**
   * Benar bila muka air yang diminta lebih tinggi daripada salurannya.
   * Pada pipa: pipanya penuh. Pada saluran persegi dan penampang alam:
   * airnya meluap. Hitungannya dipotong ke tepi atas saluran.
   */
  overtopped: boolean;
  /** Bagian penampang yang basah, satu poligon untuk tiap genangan terpisah */
  wetted: Pt[][];
};

const G = 9.81;

/** Manning: V = (1/n) R^(2/3) S^(1/2) */
export function manningVelocity(R: number, S: number, n: number) {
  return R > 0 && S > 0 && n > 0 ? (1 / n) * Math.pow(R, 2 / 3) * Math.sqrt(S) : 0;
}

/** Chezy: V = C (R S)^(1/2) */
export function chezyVelocity(R: number, S: number, C: number) {
  return R > 0 && S > 0 && C > 0 ? C * Math.sqrt(R * S) : 0;
}

function velocityOf(R: number, S: number, r: Resistance) {
  return r.method === "manning"
    ? manningVelocity(R, S, r.n)
    : chezyVelocity(R, S, r.C);
}

/** Tinggi penampang, dipakai sebagai batas atas muka air yang dapat dihitung */
export function sectionHeight(s: SectionInput): number {
  if (s.shape === "lingkaran") return s.D;
  if (s.shape === "persegi") return s.Hc;
  if (s.pts.length < 2) return 0;
  const zMin = Math.min(...s.pts.map((p) => p.y));
  return Math.min(s.pts[0].y, s.pts[s.pts.length - 1].y) - zMin;
}

/**
 * Geometri basah penampang alam pada muka air tertentu.
 *
 * Dihitung per ruas: ruas yang seluruhnya di atas air dilewati, ruas yang
 * terpotong muka air dipotong di titik silangnya. Genangan yang terpisah oleh
 * gundukan yang muncul di atas air dicatat sebagai poligon sendiri, supaya
 * gundukan itu tidak tergambar sebagai air.
 */
function irregularWetted(pts: Pt[], surface: number) {
  let area = 0;
  let perimeter = 0;
  let topWidth = 0;
  const wetted: Pt[][] = [];
  let run: Pt[] = [];

  const tutup = () => {
    if (run.length >= 2) wetted.push(run);
    run = [];
  };

  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    if (p1.y >= surface && p2.y >= surface) {
      tutup();
      continue;
    }
    let a = { ...p1 };
    let b = { ...p2 };
    if (a.y > surface) {
      const t = (surface - p2.y) / (p1.y - p2.y);
      a = { x: p2.x + t * (p1.x - p2.x), y: surface };
    }
    if (b.y > surface) {
      const t = (surface - p1.y) / (p2.y - p1.y);
      b = { x: p1.x + t * (p2.x - p1.x), y: surface };
    }
    const dx = Math.abs(b.x - a.x);
    area += 0.5 * (surface - a.y + (surface - b.y)) * dx;
    perimeter += Math.hypot(b.x - a.x, b.y - a.y);
    topWidth += dx;
    if (run.length === 0) run.push(a);
    run.push(b);
    if (p2.y >= surface) tutup();
  }
  tutup();
  return { area, perimeter, topWidth, wetted };
}

/** Aliran seragam pada kedalaman H di atas titik terendah penampang. */
export function sectionFlow(
  s: SectionInput,
  H: number,
  S: number,
  r: Resistance
): SectionFlow {
  const tinggi = sectionHeight(s);
  const overtopped = H > tinggi + 1e-12;
  const y = Math.max(0, Math.min(H, tinggi));

  let area = 0;
  let perimeter = 0;
  let topWidth = 0;
  let wetted: Pt[][] = [];

  if (s.shape === "lingkaran") {
    const D = s.D;
    const rr = D / 2;
    if (y >= D) {
      area = (Math.PI * D * D) / 4;
      perimeter = Math.PI * D;
      topWidth = 0;
    } else if (y > 0) {
      const theta = 2 * Math.acos(1 - (2 * y) / D);
      area = ((D * D) / 8) * (theta - Math.sin(theta));
      perimeter = (D / 2) * theta;
      topWidth = D * Math.sin(theta / 2);
    }
    /* Poligon basah: busur dari tepi kiri muka air, lewat dasar, ke tepi
       kanan. Pusat lingkaran di (0, D/2); sudut f diukur dari titik
       terendah, jadi titiknya (r sin f, r − r cos f). */
    if (y > 0) {
      const phi = y >= D ? Math.PI : Math.acos((rr - y) / rr);
      const poly: Pt[] = [];
      const langkah = 96;
      for (let i = 0; i <= langkah; i++) {
        const f = -phi + (2 * phi * i) / langkah;
        poly.push({ x: rr * Math.sin(f), y: rr - rr * Math.cos(f) });
      }
      wetted = [poly];
    }
  } else if (s.shape === "persegi") {
    area = s.W * y;
    perimeter = y > 0 ? s.W + 2 * y : 0;
    topWidth = y > 0 ? s.W : 0;
    if (y > 0)
      wetted = [
        [
          { x: -s.W / 2, y },
          { x: -s.W / 2, y: 0 },
          { x: s.W / 2, y: 0 },
          { x: s.W / 2, y },
        ],
      ];
  } else if (s.pts.length >= 2) {
    const zMin = Math.min(...s.pts.map((p) => p.y));
    const g = irregularWetted(s.pts, zMin + y);
    area = g.area;
    perimeter = g.perimeter;
    topWidth = g.topWidth;
    wetted = g.wetted;
  }

  const radius = perimeter > 0 ? area / perimeter : 0;
  const velocity = velocityOf(radius, S, r);
  const discharge = velocity * area;
  const hidraulis = topWidth > 0 ? area / topWidth : 0;
  const froude = hidraulis > 0 ? velocity / Math.sqrt(G * hidraulis) : 0;

  const zMin =
    s.shape === "alam" && s.pts.length ? Math.min(...s.pts.map((p) => p.y)) : 0;

  return {
    depth: y,
    surface: zMin + y,
    area,
    perimeter,
    radius,
    topWidth,
    velocity,
    discharge,
    froude,
    overtopped,
    wetted,
  };
}

/**
 * Kedalaman normal: kedalaman yang mengalirkan debit Q pada kemiringan S.
 *
 * Dicari dengan membagi dua, bukan Newton-Raphson seperti di cl42. Pada pipa
 * lingkaran debitnya TIDAK naik terus sampai pipa penuh: puncaknya di sekitar
 * 0,938 D, lalu turun lagi karena keliling basah bertambah lebih cepat
 * daripada luasnya. Newton-Raphson yang mulai dari separuh pipa dapat
 * melompat ke cabang turun itu dan memberi kedalaman yang salah. Pembagian
 * dua dibatasi pada cabang naik, yaitu sampai kedalaman debit terbesar.
 *
 * Mengembalikan null bila Q melebihi debit terbesar penampangnya.
 */
export function normalDepth(
  s: SectionInput,
  Q: number,
  S: number,
  r: Resistance
): number | null {
  if (Q <= 0) return 0;
  const puncak = maxDischargeDepth(s, S, r);
  if (sectionFlow(s, puncak, S, r).discharge < Q * (1 - 1e-12)) return null;
  let lo = 0;
  let hi = puncak;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (sectionFlow(s, mid, S, r).discharge < Q) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Kedalaman yang memberi debit terbesar, dicari pada 400 titik lalu dihaluskan. */
export function maxDischargeDepth(s: SectionInput, S: number, r: Resistance) {
  const tinggi = sectionHeight(s);
  if (tinggi <= 0) return 0;
  let terbaik = tinggi;
  let qTerbaik = -1;
  const n = 400;
  for (let i = 1; i <= n; i++) {
    const y = (tinggi * i) / n;
    const q = sectionFlow(s, y, S, r).discharge;
    if (q > qTerbaik) {
      qTerbaik = q;
      terbaik = y;
    }
  }
  /* Pada saluran yang debitnya naik terus, puncaknya tepat di tepi atas.
     Penghalusan di situ hanya dapat mundur ke bawah tepi dan membuat debit
     tepat di tepi tampak melebihi kapasitasnya sendiri. */
  if (terbaik >= tinggi) return tinggi;
  /* Penghalusan emas di sekitar titik terbaik */
  let a = Math.max(0, terbaik - tinggi / n);
  let b = Math.min(tinggi, terbaik + tinggi / n);
  const phi = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 60; i++) {
    const c = b - phi * (b - a);
    const d = a + phi * (b - a);
    if (sectionFlow(s, c, S, r).discharge > sectionFlow(s, d, S, r).discharge) b = d;
    else a = c;
  }
  return (a + b) / 2;
}

/* ------------------------------------------------------------------ *
 * Membaca berkas koordinat dan pasangan data
 * ------------------------------------------------------------------ */

/**
 * Membaca teks dua kolom menjadi pasangan angka.
 *
 * Lebih longgar daripada cl42, yang hanya menerima koma sebagai pemisah
 * kolom. Berkas dari Excel berbahasa Indonesia memakai titik koma sebagai
 * pemisah kolom dan koma sebagai pemisah desimal, dan cl42 membacanya
 * sebagai data kosong tanpa keterangan. Di sini pemisah kolomnya ditebak
 * dari baris pertama: tab, titik koma, lalu koma. Bila pemisah kolomnya
 * bukan koma, koma di dalam angka dibaca sebagai pemisah desimal.
 */
export function parsePairs(text: string): { pts: Pt[]; skipped: number } {
  const baris = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (baris.length === 0) return { pts: [], skipped: 0 };
  const contoh = baris[0];
  const pemisah = contoh.includes("\t") ? "\t" : contoh.includes(";") ? ";" : ",";
  const angka = (s: string) =>
    parseFloat((pemisah === "," ? s : s.replace(",", ".")).trim());

  const pts: Pt[] = [];
  let skipped = 0;
  baris.forEach((l, i) => {
    const kolom = l.split(pemisah);
    const x = angka(kolom[0] ?? "");
    const y = angka(kolom[1] ?? "");
    if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y });
    else if (i > 0) skipped++;
  });
  return { pts, skipped };
}

/* ------------------------------------------------------------------ *
 * Lengkung debit
 * ------------------------------------------------------------------ */

export type RatingKind = "pangkat" | "pangkat-h0" | "polinomial";

export type RatingFit = {
  kind: RatingKind;
  /** Koefisien a dan b pada bentuk pangkat */
  a: number;
  b: number;
  /** Tinggi aliran nol; nol pada bentuk pangkat biasa */
  h0: number;
  /** Koefisien polinomial, c0 + c1 H + c2 H² + ... */
  coeffs: number[];
  r2: number;
  rmse: number;
  /** Rentang H data ukur yang dipakai menyusun lengkungnya */
  hMin: number;
  hMax: number;
  /** Banyaknya pasangan yang dipakai */
  n: number;
  /** Pasangan yang dibuang karena tidak dapat dipakai bentuk ini */
  dropped: number;
  /** Benar bila lengkungnya turun di suatu tempat di dalam rentang data */
  nonMonotone: boolean;
};

export function ratingValue(f: RatingFit, H: number): number {
  if (f.kind === "polinomial")
    return f.coeffs.reduce((s, c, i) => s + c * Math.pow(H, i), 0);
  const d = H - f.h0;
  return d > 0 ? f.a * Math.pow(d, f.b) : 0;
}

/**
 * Benar bila lengkungnya turun di suatu tempat di dalam rentang data.
 *
 * Lengkung debit yang turun ketika muka air naik tidak masuk akal secara
 * fisis. Polinomial derajat tinggi sering melakukannya di antara titik
 * datanya, dan bentuk pangkat pun melakukannya bila datanya sendiri janggal
 * sehingga pangkatnya keluar negatif.
 */
function turunDiRentang(f: RatingFit) {
  let sebelum = ratingValue(f, f.hMin);
  for (let i = 1; i <= 200; i++) {
    const q = ratingValue(f, f.hMin + ((f.hMax - f.hMin) * i) / 200);
    if (q < sebelum - 1e-9 * Math.max(1, Math.abs(sebelum))) return true;
    sebelum = q;
  }
  return false;
}

function metrik(Hs: number[], Qs: number[], f: (h: number) => number) {
  const n = Qs.length;
  const rata = Qs.reduce((s, v) => s + v, 0) / n;
  let ssTot = 0;
  let ssRes = 0;
  Qs.forEach((q, i) => {
    ssTot += (q - rata) ** 2;
    ssRes += (q - f(Hs[i])) ** 2;
  });
  return { r2: ssTot > 0 ? 1 - ssRes / ssTot : 0, rmse: Math.sqrt(ssRes / n) };
}

/** Kuadrat terkecil pada ln Q = ln a + b ln(H − h0). */
function pangkatLog(Hs: number[], Qs: number[], h0: number) {
  const n = Hs.length;
  const lx = Hs.map((h) => Math.log(h - h0));
  const ly = Qs.map((q) => Math.log(q));
  const mx = lx.reduce((s, v) => s + v, 0) / n;
  const my = ly.reduce((s, v) => s + v, 0) / n;
  let sxx = 0;
  let sxy = 0;
  lx.forEach((v, i) => {
    sxx += (v - mx) ** 2;
    sxy += (v - mx) * (ly[i] - my);
  });
  const b = sxx > 0 ? sxy / sxx : 0;
  const a = Math.exp(my - b * mx);
  let sse = 0;
  lx.forEach((v, i) => {
    sse += (ly[i] - (Math.log(a) + b * v)) ** 2;
  });
  return { a, b, sse };
}

/**
 * Pencocokan lengkung debit.
 *
 * Bentuk pangkat dicocokkan pada ruang logaritma, sama dengan cl42. Bentuk
 * pangkat dengan tinggi aliran nol mencari h0 yang memberi galat log
 * terkecil, dari dua rentang data di bawah H terkecil sampai tepat di
 * bawahnya; h0 boleh negatif, karena nol papan duga bisa berada di atas
 * dasar sungai. Untuk tiap h0 kedua koefisiennya kuadrat terkecil biasa,
 * jadi yang dicari satu bilangan saja. Polinomial memakai persamaan normal dengan pivot, sama
 * dengan cl42, tetapi H-nya dinormalkan dulu ke rentang satu supaya
 * matriksnya tidak mendekati singular pada H besar dan derajat empat.
 */
export function fitRating(
  data: Pt[],
  kind: RatingKind,
  degree = 2
): RatingFit | null {
  const semua = data.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const pakai =
    kind === "polinomial" ? semua : semua.filter((p) => p.x > 0 && p.y > 0);
  const dropped = semua.length - pakai.length;
  const perlu = kind === "polinomial" ? degree + 1 : kind === "pangkat-h0" ? 3 : 2;
  if (pakai.length < perlu) return null;

  const Hs = pakai.map((p) => p.x);
  const Qs = pakai.map((p) => p.y);
  const hMin = Math.min(...Hs);
  const hMax = Math.max(...Hs);
  if (hMax - hMin <= 0) return null;

  const dasar = {
    hMin,
    hMax,
    n: pakai.length,
    dropped,
    nonMonotone: false,
  };

  if (kind === "pangkat" || kind === "pangkat-h0") {
    let h0 = 0;
    if (kind === "pangkat-h0") {
      /* h0 boleh negatif: papan duga yang nolnya di atas dasar sungai */
      const bawah = hMin - (hMax - hMin) * 2;
      const atas = hMin - (hMax - hMin) * 1e-4;
      let a = bawah;
      let b = atas;
      const phi = (Math.sqrt(5) - 1) / 2;
      for (let i = 0; i < 120; i++) {
        const c = b - phi * (b - a);
        const d = a + phi * (b - a);
        if (pangkatLog(Hs, Qs, c).sse < pangkatLog(Hs, Qs, d).sse) b = d;
        else a = c;
      }
      h0 = (a + b) / 2;
    }
    const k = pangkatLog(Hs, Qs, h0);
    const f: RatingFit = {
      kind,
      a: k.a,
      b: k.b,
      h0,
      coeffs: [],
      r2: 0,
      rmse: 0,
      ...dasar,
    };
    const m = metrik(Hs, Qs, (h) => ratingValue(f, h));
    return { ...f, ...m, nonMonotone: turunDiRentang(f) };
  }

  /* Polinomial pada u = H / hMax, lalu dikembalikan ke koefisien H */
  const d = degree + 1;
  const skala = hMax;
  const U = Hs.map((h) => h / skala);
  const A: number[][] = Array.from({ length: d }, (_, i) =>
    Array.from({ length: d }, (__, j) => U.reduce((s, u) => s + Math.pow(u, i + j), 0))
  );
  const y: number[] = Array.from({ length: d }, (_, i) =>
    U.reduce((s, u, k) => s + Math.pow(u, i) * Qs[k], 0)
  );
  for (let col = 0; col < d; col++) {
    let maks = col;
    for (let row = col + 1; row < d; row++)
      if (Math.abs(A[row][col]) > Math.abs(A[maks][col])) maks = row;
    [A[col], A[maks]] = [A[maks], A[col]];
    [y[col], y[maks]] = [y[maks], y[col]];
    if (Math.abs(A[col][col]) < 1e-14) return null;
    for (let row = col + 1; row < d; row++) {
      const fk = A[row][col] / A[col][col];
      y[row] -= fk * y[col];
      for (let k = col; k < d; k++) A[row][k] -= fk * A[col][k];
    }
  }
  const cu = new Array(d).fill(0);
  for (let i = d - 1; i >= 0; i--) {
    cu[i] = y[i];
    for (let j = i + 1; j < d; j++) cu[i] -= A[i][j] * cu[j];
    cu[i] /= A[i][i];
  }
  const coeffs = cu.map((c, i) => c / Math.pow(skala, i));

  const f: RatingFit = {
    kind,
    a: 0,
    b: 0,
    h0: 0,
    coeffs,
    r2: 0,
    rmse: 0,
    ...dasar,
  };
  const m = metrik(Hs, Qs, (h) => ratingValue(f, h));
  return { ...f, ...m, nonMonotone: turunDiRentang(f) };
}

/** Rumus lengkung dalam bentuk yang dapat dibaca, dengan pemformat angka lembarnya. */
export function ratingFormula(f: RatingFit, num: (v: number, d: number) => string) {
  if (f.kind === "pangkat") return `Q = ${num(f.a, 4)} · H^${num(f.b, 3)}`;
  if (f.kind === "pangkat-h0") {
    const tanda = f.h0 >= 0 ? "−" : "+";
    return `Q = ${num(f.a, 4)} · (H ${tanda} ${num(Math.abs(f.h0), 3)})^${num(f.b, 3)}`;
  }
  return (
    "Q = " +
    f.coeffs
      .map((c, i) => {
        const nilai = num(Math.abs(c), 4);
        const tanda = i === 0 ? (c < 0 ? "−" : "") : c < 0 ? " − " : " + ";
        return `${tanda}${nilai}${i === 0 ? "" : i === 1 ? "·H" : `·H^${i}`}`;
      })
      .join("")
  );
}

/* ------------------------------------------------------------------ *
 * Data contoh, sama dengan berkas contoh cl42
 * ------------------------------------------------------------------ */

/** sample_rating_curve.csv dari cl42 */
export const SAMPLE_RATING: Pt[] = [
  { x: 0.2, y: 0.12 },
  { x: 0.35, y: 0.38 },
  { x: 0.5, y: 0.72 },
  { x: 0.65, y: 1.2 },
  { x: 0.8, y: 1.85 },
  { x: 0.95, y: 2.65 },
  { x: 1.1, y: 3.62 },
  { x: 1.3, y: 5.18 },
  { x: 1.5, y: 7.05 },
  { x: 1.75, y: 9.8 },
];

/** sample_xy_coords.csv dari cl42, penampang sungai selebar 16 m */
export const SAMPLE_SECTION: Pt[] = [
  { x: 0, y: 2.5 },
  { x: 2, y: 1.2 },
  { x: 4, y: 0.5 },
  { x: 6, y: 0.1 },
  { x: 8, y: 0 },
  { x: 10, y: 0.2 },
  { x: 12, y: 0.8 },
  { x: 14, y: 1.8 },
  { x: 16, y: 3 },
];

/** Kunci penyimpanan lengkung debit yang dipakai HY-03 */
export const RATING_STORAGE_KEY = "hidrolab.lengkungDebit";
