import { C, DASH, F, W } from "./theme.ts";
import { pen } from "./plate.ts";
import type { PlateMap } from "./plateOut.ts";
import type { MeanderTimeline } from "./meanderWaktu.ts";

/**
 * LAPIS GERAK OC-11 — perkembangan meander terhadap waktu (batch B5b-2).
 *
 * Bentuk alur pada saat t datang dari lini masa M6 (meanderWaktu.ts):
 * sudut ayun ω(t), panjang gelombang lintasan M(t), dan amplitudo A(t)
 * disisip linear antar bingkai lini masa (selang 0,5°), lalu garis
 * tengahnya dipadu dengan Simpson persis seperti meanderFramePath. Bedanya
 * hanya wadah: di sini larik bertipe yang dibuat sekali, jadi tidak ada
 * alokasi per frame.
 *
 * Waktu lapis gerak dalam TAHUN (usePlate timeScale = tahun per detik
 * layar); lembar menulis skalanya di catatan gambar.
 *
 * Penyederhanaan yang diwarisi dari M6 dan harus tertulis di lembar:
 * translasi ke hilir tidak dimodelkan; sesudah leher terpotong alur
 * dikembalikan ke sudut awal (konvensi tampilan, bukan fisika).
 */

const RAD = Math.PI / 180;

/** Bentuk alur pada satu saat (hasil sisipan lini masa). */
export type MeanderShape = {
  t: number;
  cycle: number;
  omegaDeg: number;
  /** Panjang gelombang sepanjang lintasan M, m */
  pathWavelength: number;
  /** Setengah tinggi puncak-ke-puncak, m */
  amplitude: number;
};

export function createMeanderShape(): MeanderShape {
  return { t: 0, cycle: 0, omegaDeg: 0, pathWavelength: 0, amplitude: 0 };
}

/**
 * Bentuk pada saat t (tahun), dijepit ke bingkai pertama dan terakhir.
 * ω disisip linear sama dengan meanderFrameAt; M dan A disisip linear
 * antar bingkai (selisihnya terhadap hitungan ulang dari ω diuji < 10⁻⁴).
 */
export function meanderShapeAt(tl: MeanderTimeline, t: number, out: MeanderShape): MeanderShape {
  const Fr = tl.frames;
  let a = Fr[0];
  let b = Fr[0];
  if (t >= Fr[Fr.length - 1].t) {
    a = b = Fr[Fr.length - 1];
  } else if (t > Fr[0].t) {
    let lo = 0;
    let hi = Fr.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (Fr[mid].t <= t) lo = mid;
      else hi = mid;
    }
    a = Fr[lo];
    b = Fr[hi];
  }
  const r = b === a || b.cycle !== a.cycle || b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
  out.t = Math.min(Math.max(t, Fr[0].t), Fr[Fr.length - 1].t);
  out.cycle = a.cycle;
  out.omegaDeg = a.omegaDeg + r * (b.omegaDeg - a.omegaDeg);
  out.pathWavelength = a.pathWavelength + r * (b.pathWavelength - a.pathWavelength);
  out.amplitude = a.amplitude + r * (b.amplitude - a.amplitude);
  return out;
}

/** Bentuk pada bingkai pertama (sudut awal) ke `out`. */
export function meanderShapeStart(tl: MeanderTimeline, out: MeanderShape): MeanderShape {
  return meanderShapeAt(tl, tl.frames[0].t, out);
}

/** Panjang larik garis tengah untuk n ruas: (n + 1) titik × 2. */
export function centrelineLength(n: number): number {
  return 2 * (n + 1);
}

/**
 * Garis tengah sepanjang `cycles` panjang gelombang ke `out` (x0,y0,...),
 * mulai di lembah kelokan pada x = 0, y dipusatkan (sumbu lembah y = 0).
 * Pemaduan Simpson per ruas, sama dengan meanderFramePath. Tanpa alokasi.
 */
export function meanderCentreline(
  sh: MeanderShape,
  cycles: number,
  n: number,
  out: Float64Array
): Float64Array {
  const M = sh.pathWavelength;
  const w = sh.omegaDeg * RAD;
  const A = sh.amplitude;
  const ds = (M * cycles) / n;
  let x = 0;
  let y = 0;
  out[0] = 0;
  out[1] = -A;
  for (let i = 0; i < n; i++) {
    const a = i * ds;
    const ta = w * Math.sin((2 * Math.PI * a) / M);
    const tm = w * Math.sin((2 * Math.PI * (a + ds / 2)) / M);
    const tb = w * Math.sin((2 * Math.PI * (a + ds)) / M);
    x += (ds / 6) * (Math.cos(ta) + 4 * Math.cos(tm) + Math.cos(tb));
    y += (ds / 6) * (Math.sin(ta) + 4 * Math.sin(tm) + Math.sin(tb));
    out[2 * (i + 1)] = x;
    out[2 * (i + 1) + 1] = y - A;
  }
  return out;
}

/**
 * Tebing kiri (sisi = 1) atau kanan (−1): garis tengah digeser `half`
 * tegak lurus arah lokal (beda tengah), sama dengan fungsi tebing OC-11.
 */
export function meanderBank(
  c: Float64Array,
  n: number,
  half: number,
  side: 1 | -1,
  out: Float64Array
): Float64Array {
  for (let i = 0; i <= n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n, i + 1);
    const dx = c[2 * b] - c[2 * a];
    const dy = c[2 * b + 1] - c[2 * a + 1];
    const p = Math.hypot(dx, dy) || 1;
    out[2 * i] = c[2 * i] + (side * half * -dy) / p;
    out[2 * i + 1] = c[2 * i + 1] + (side * half * dx) / p;
  }
  return out;
}

function polyline(ctx: CanvasRenderingContext2D, map: PlateMap, p: ArrayLike<number>, n: number, reverse = false) {
  for (let k = 0; k <= n; k++) {
    const i = reverse ? n - k : k;
    const X = map.X(p[2 * i]);
    const Y = map.Y(p[2 * i + 1]);
    if (k === 0 && !reverse) ctx.moveTo(X, Y);
    else ctx.lineTo(X, Y);
  }
}

/** Danau oxbow: garis tengah kelokan yang terpotong, dalam m (meanderOxbow). */
export type OxbowSet = {
  /** Garis tengah tiap danau, x0,y0,... */
  lines: Float64Array[];
  /** Tebing luar dan dalam tiap danau */
  left: Float64Array[];
  right: Float64Array[];
};

/**
 * Danau oxbow pada semua kelokan yang muat di `cycles` panjang gelombang:
 * kelokan atas pertama dari meanderOxbow, digeser satu panjang gelombang
 * lembah λ; kelokan bawah = kelokan atas yang dicerminkan dan digeser λ/2
 * (kurva sinus simetris, jadi semua leher terpotong bersamaan).
 * Dibuat sekali per lini masa (mengalokasi).
 */
export function oxbowSet(
  upper: readonly { x: number; y: number }[],
  valleyWavelength: number,
  width: number,
  cycles: number
): OxbowSet {
  const set: OxbowSet = { lines: [], left: [], right: [] };
  if (upper.length < 2) return set;
  const n = upper.length - 1;
  const xs = upper.map((p) => p.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const tambah = (dx: number, cermin: boolean) => {
    if (xMin + dx < -1e-9 || xMax + dx > cycles * valleyWavelength + 1e-9) return;
    const c = new Float64Array(2 * (n + 1));
    for (let i = 0; i <= n; i++) {
      c[2 * i] = upper[i].x + dx;
      c[2 * i + 1] = cermin ? -upper[i].y : upper[i].y;
    }
    set.lines.push(c);
    set.left.push(meanderBank(c, n, width / 2, 1, new Float64Array(c.length)));
    set.right.push(meanderBank(c, n, width / 2, -1, new Float64Array(c.length)));
  };
  for (let k = 0; k < cycles; k++) tambah(k * valleyWavelength, false);
  for (let k = 0; k < cycles; k++) tambah(k * valleyWavelength + valleyWavelength / 2, true);
  return set;
}

export type MeanderMotion = {
  /** Banyaknya ruas garis tengah */
  n: number;
  cycles: number;
  c: Float64Array;
  left: Float64Array;
  right: Float64Array;
  shape: MeanderShape;
  /** Waktu lapis gerak, tahun */
  t: number;
  /** Nilai t terakhir dari lembar (penggeser lini masa) yang sudah dibaca */
  lastProp: number;
  /** Nilai t terakhir yang dikirim ke lembar; bila kembali lewat tProp, bukan geseran pengguna */
  pushed: number;
  /** Sisa diam di saat terpotong, tahun */
  holdLeft: number;
  /** Detik layar sejak t terakhir dikirim ke lembar */
  sincePush: number;
};

export function createMeanderMotion(n = 400, cycles = 2): MeanderMotion {
  const L = centrelineLength(n);
  return {
    n,
    cycles,
    c: new Float64Array(L),
    left: new Float64Array(L),
    right: new Float64Array(L),
    shape: createMeanderShape(),
    t: 0,
    lastProp: NaN,
    pushed: NaN,
    holdLeft: 0,
    sincePush: 0,
  };
}

export type MeanderStateStyle = {
  width: number;
  /** Danau oxbow (oxbowSet), digambar sesudah leher terpotong */
  oxbows: OxbowSet;
  /** Tulisan penanda danau, misalnya "danau oxbow" */
  oxbowLabel: string;
  /** Selang alur lama yang digambar memudar, tahun (0 = tanpa) */
  ghostStep: number;
  /** Tebing melipat (Rc/W < 0,5) pada bentuk ini: tebing merah sinyal putus */
  folded?: boolean;
};

/** Alur (isian air, dua tebing, garis tengah) untuk bentuk mo.shape. */
function gambarAlur(
  ctx: CanvasRenderingContext2D,
  map: PlateMap,
  mo: MeanderMotion,
  width: number,
  folded: boolean
) {
  const { n, c, left, right } = mo;
  meanderCentreline(mo.shape, mo.cycles, n, c);
  meanderBank(c, n, width / 2, 1, left);
  meanderBank(c, n, width / 2, -1, right);
  ctx.beginPath();
  polyline(ctx, map, left, n);
  polyline(ctx, map, right, n, true);
  ctx.closePath();
  ctx.fillStyle = C.waterFillDeep;
  ctx.fill();
  pen(ctx, W.thin, folded ? C.signal : C.ink2, folded ? DASH.hidden : DASH.solid);
  ctx.beginPath();
  polyline(ctx, map, left, n);
  ctx.stroke();
  ctx.beginPath();
  polyline(ctx, map, right, n);
  ctx.stroke();
  pen(ctx, W.bold, C.water);
  ctx.beginPath();
  polyline(ctx, map, c, n);
  ctx.stroke();
}

/** Garis tengah alur lama (oldChannel, phantom) untuk bentuk mo.shape. */
function gambarAlurLama(ctx: CanvasRenderingContext2D, map: PlateMap, mo: MeanderMotion, alpha: number) {
  meanderCentreline(mo.shape, mo.cycles, mo.n, mo.c);
  ctx.globalAlpha = alpha;
  pen(ctx, W.thin, C.oldChannel, DASH.phantom);
  ctx.beginPath();
  polyline(ctx, map, mo.c, mo.n);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function gambarOxbow(ctx: CanvasRenderingContext2D, map: PlateMap, ox: OxbowSet, label: string) {
  for (let k = 0; k < ox.lines.length; k++) {
    const n = ox.lines[k].length / 2 - 1;
    ctx.beginPath();
    polyline(ctx, map, ox.left[k], n);
    polyline(ctx, map, ox.right[k], n, true);
    ctx.closePath();
    ctx.fillStyle = C.waterFill;
    ctx.fill();
    pen(ctx, W.thin, C.water);
    ctx.stroke();
  }
  /* Satu penanda saja, di puncak danau pertama, berlatar kertas. */
  if (ox.lines.length > 0 && label) {
    const L = ox.lines[0];
    const n = L.length / 2 - 1;
    const i = Math.floor(n / 2);
    const X = map.X(L[2 * i]);
    const Y = map.Y(L[2 * i + 1]) - 16;
    ctx.font = F.label;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = ctx.measureText(label).width;
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = C.sheet;
    ctx.fillRect(X - w / 2 - 4, Y - 7, w + 8, 14);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.water;
    ctx.fillText(label, X, Y);
  }
}

/**
 * Keadaan alur pada saat t (tahun), dipakai lapis statis (saat dijeda)
 * dan lapis gerak:
 * - t < T potong: alur pada t, ditambah tiga alur lama (t − k·ghostStep)
 *   yang makin pudar;
 * - t ≥ T potong: danau oxbow, alur saat terpotong sebagai alur lama
 *   (pudar menurut cutFade), dan alur kembali ke sudut awal (konvensi).
 */
export function drawMeanderState(
  ctx: CanvasRenderingContext2D,
  map: PlateMap,
  tl: MeanderTimeline,
  t: number,
  mo: MeanderMotion,
  st: MeanderStateStyle,
  /** 0..1, kepekatan alur saat terpotong yang memudar sesudah dipotong */
  cutFade = 1
): void {
  const f = map.frame;
  ctx.save();
  ctx.beginPath();
  ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
  ctx.clip();
  const Tc = tl.timeToCutoff;
  const terpotong = !tl.cutoffAtStart && t >= Tc;
  if (terpotong) {
    gambarOxbow(ctx, map, st.oxbows, st.oxbowLabel);
    meanderShapeAt(tl, Tc, mo.shape);
    gambarAlurLama(ctx, map, mo, 0.25 + 0.75 * Math.min(1, Math.max(0, cutFade)));
    meanderShapeStart(tl, mo.shape);
    gambarAlur(ctx, map, mo, st.width, false);
  } else {
    if (st.ghostStep > 0)
      for (let k = 3; k >= 1; k--) {
        const tk = t - k * st.ghostStep;
        if (tk < 0) continue;
        meanderShapeAt(tl, tk, mo.shape);
        gambarAlurLama(ctx, map, mo, 0.85 - 0.2 * k);
      }
    meanderShapeAt(tl, t, mo.shape);
    gambarAlur(ctx, map, mo, st.width, !!st.folded);
  }
  ctx.restore();
}

export type MeanderMotionOptions = MeanderStateStyle & {
  /** Nilai penggeser lini masa sekarang, tahun */
  tProp: number;
  /** Mengirim t lapis gerak ke lembar (penggeser dan kartu), paling sering 4 kali per detik layar */
  onTime: (t: number) => void;
  /** Tahun per detik layar (sama dengan usePlate timeScale) */
  yearsPerSecond: number;
  /** Lama diam di saat terpotong, detik layar */
  holdSeconds: number;
};

/** Selang kirim t ke lembar, detik layar. */
const SELANG_KIRIM = 0.25;

/**
 * Satu frame OC-11. `dt` dalam tahun. Lini masa berjalan 0 → T potong,
 * diam di keadaan terpotong selama holdSeconds, lalu mulai lagi dari 0.
 * Penggeser yang digeser lembar (tProp berubah) langsung diikuti.
 */
export function drawMeanderMotion(
  ctx: CanvasRenderingContext2D,
  map: PlateMap,
  dt: number,
  tl: MeanderTimeline,
  mo: MeanderMotion,
  op: MeanderMotionOptions
): void {
  const Tc = tl.timeToCutoff;
  const hold = op.holdSeconds * op.yearsPerSecond;
  /* tProp berubah: kiriman lapis gerak yang kembali (abaikan), atau
     geseran penggeser oleh pengguna (ikuti). */
  let ikut = false;
  if (op.tProp !== mo.lastProp) {
    mo.lastProp = op.tProp;
    if (op.tProp !== mo.pushed) ikut = true;
  }
  if (ikut) {
    mo.t = op.tProp;
    mo.holdLeft = mo.t >= Tc ? hold : 0;
  } else if (dt > 0) {
    if (mo.t >= Tc) {
      mo.holdLeft -= dt;
      if (mo.holdLeft <= 0) mo.t = 0;
    } else {
      mo.t += dt;
      if (mo.t >= Tc) {
        mo.t = Tc;
        mo.holdLeft = hold;
      }
    }
  }
  mo.sincePush += op.yearsPerSecond > 0 ? dt / op.yearsPerSecond : 0;
  if (mo.sincePush >= SELANG_KIRIM) {
    mo.sincePush = 0;
    if (mo.t !== mo.pushed) {
      mo.pushed = mo.t;
      op.onTime(mo.t);
    }
  }
  const fade = mo.t >= Tc && hold > 0 ? Math.max(0, mo.holdLeft / hold) : 1;
  drawMeanderState(ctx, map, tl, mo.t, mo, op, fade);
}
