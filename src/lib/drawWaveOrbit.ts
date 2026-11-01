import { C, DASH, F, W } from "./theme.ts";
import { hatchSoil, niceStep, pen } from "./plate.ts";
import { fmtPlain } from "./hydraulics.ts";
import { mapFrom, type PlateMap, type PlateOut } from "./plateOut.ts";
import { waveOrbitAxes, waveParticle } from "./gelombangOrbit.ts";

/**
 * FP-03 PANEL RUANG FISIK: muka gelombang dan orbit partikel (teori Airy).
 *
 * Grafik sebaran di atasnya bukan ruang, jadi panel ini yang membawa
 * geraknya. Dua skala, keduanya ditulis di pojok panel:
 * - Posisi diam partikel dan dasar: skala tegak dari jendela kedalaman
 *   `zWin`; skala datar sama, kecuali bila dengan itu kurang dari satu
 *   panjang gelombang yang tampak (air dangkal): mendatar dimampatkan
 *   sampai satu L tampak, dan "tegak ×V" ditulis.
 * - Simpangan partikel dan muka air: SATU skala untuk kedua arah (×M
 *   terhadap skala tegak), jadi lingkaran tetap lingkaran dan elips tetap
 *   elips. Muka air digambar sebagai tempat kedudukan partikel muka air,
 *   sehingga partikel muka air selalu tepat di garisnya.
 */

export type WaveOrbitSpec = {
  /** Tinggi gelombang H, m */
  H: number;
  /** Bilangan gelombang k dan panjang L dari linearWave */
  k: number;
  L: number;
  /** Periode T, s (σ = 2π/T) */
  T: number;
  /** Kedalaman h, m */
  h: number;
  /** Kedalaman jendela gambar, m (dasar di luar gambar bila h > zWin) */
  zWin: number;
  /** Gelombang pecah: teori linear tidak berlaku, muka air merah sinyal */
  breaking: boolean;
  /** Lapis gerak sedang menggambar saat τ: keadaan t = 0 jadi phantom */
  faded: boolean;
  labels: {
    title: string;
    bedOut: (h: string) => string;
    scaleV: (v: string) => string;
    scaleM: (m: string) => string;
    invalid: string;
  };
};

/** Tata letak dan skala panel; dipakai lapis statis dan lapis gerak. */
export type WaveLayout = {
  map: PlateMap;
  /** Piksel per meter simpangan (sama untuk kedua arah) */
  E: number;
  /** Lebar tampak, m */
  span: number;
  /** Kolom dan baris posisi diam partikel */
  cols: Float64Array;
  rows: Float64Array;
  /** Nisbah skala tegak terhadap datar (1 = sama) */
  V: number;
  /** Pembesaran simpangan terhadap skala tegak */
  M: number;
};

const PAD = { l: 52, r: 16, t: 46, b: 30 };
/** Lebar kanvas di bawah ini: judul dan skala dua baris. */
const SEMPIT = 600;
/** Jarak muka air diam dari tepi atas kanvas: ruang judul dan simpangan muka air. */
function padT(w: number): number {
  return w < SEMPIT ? 60 : PAD.t;
}
/** Simpangan muka air yang dituju, piksel (dibatasi ruang di atas muka air). */
const AMP_PX = 20;

/** Angka 1-2-5 terbesar yang ≤ v (v > 0), termasuk pecahan 0,5; 0,2; ... */
export function niceFloor(v: number): number {
  if (!(v > 0) || !Number.isFinite(v)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  const d = m >= 5 ? 5 : m >= 2 ? 2 : 1;
  return d * p;
}

/** Kedalaman jendela untuk h dan L: 1,2·min(h, L/2). */
export function waveWindow(h: number, L: number): number {
  return 1.2 * Math.min(h, L / 2);
}

export function waveLayout(w: number, hPx: number, s: Pick<WaveOrbitSpec, "H" | "L" | "zWin" | "k" | "h">): WaveLayout {
  const plotW = Math.max(10, w - PAD.l - PAD.r);
  const plotH = Math.max(10, hPx - padT(w) - PAD.b);
  const sy = plotH / Math.max(s.zWin, 1e-9);
  const spanSama = plotW / sy;
  const span = Math.max(spanSama, s.L);
  const sx = plotW / span;
  const x0 = PAD.l;
  const y0 = padT(w);
  const X = (v: number) => x0 + v * sx;
  const Y = (z: number) => y0 - z * sy;
  const frame = { x0, y0: 6, x1: x0 + plotW, y1: y0 + plotH };
  const map = mapFrom(X, Y, frame, [0, span], [-s.zWin, 0]);
  // Kolom: jarak ≥ 46 px dan paling banyak 16 per panjang gelombang.
  const nCol = Math.max(3, Math.min(Math.floor(plotW / 46), Math.ceil((16 * span) / s.L)));
  /*
   * Pembesaran simpangan M (satu untuk kedua arah), angka 1-2-5 terbesar
   * yang memenuhi tiga batas:
   * - simpangan tegak muka air ≤ AMP_PX (ruang di atas muka air)
   * - setengah sumbu mendatar orbit muka air A₀ ≤ 0,4 jarak kolom, supaya
   *   orbit tidak saling tumpang
   * - k·A₀·E/sx ≤ 0,6, supaya muka air (tempat kedudukan partikel) tidak
   *   melipat; di air dangkal A₀ = (H/2)/tanh kh jauh lebih besar daripada
   *   H/2, jadi elipsnya tampak pipih, sesuai teori
   */
  const A0 = (s.H / 2) / Math.tanh(Math.max(s.k * s.h, 1e-12));
  const kolomPx = plotW / nCol;
  const batas = Math.min(
    AMP_PX / Math.max((s.H / 2) * sy, 1e-12),
    (0.4 * kolomPx) / Math.max(A0 * sy, 1e-12),
    (0.6 * sx) / Math.max(s.k * A0 * sy, 1e-12)
  );
  const M = niceFloor(batas);
  const E = M * sy;
  const cols = new Float64Array(nCol);
  for (let j = 0; j < nCol; j++) cols[j] = ((j + 0.5) * span) / nCol;
  const rows = new Float64Array(5);
  return { map, E, span, cols, rows, V: sy / sx, M };
}

/** Baris posisi diam: muka air, ¼, ½, ¾ kedalaman tampak, dan dasar bila tampak. */
function isiBaris(rows: Float64Array, h: number, zWin: number): number {
  const d = Math.min(h, zWin * 0.96);
  const n = h <= zWin ? 5 : 4;
  for (let i = 0; i < n; i++) rows[i] = (-d * i) / 4;
  return n;
}

const ab = new Float64Array(2);
const dz = new Float64Array(2);

/** Muka air pada saat t: tempat kedudukan partikel muka air (lihat kepala berkas). */
function jalurMuka(ctx: CanvasRenderingContext2D, lay: WaveLayout, s: WaveOrbitSpec, t: number, tutup: boolean) {
  const m = lay.map;
  const sig = (2 * Math.PI) / s.T;
  const n = 160;
  const lebih = lay.span * 0.06;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const x0 = -lebih + ((lay.span + 2 * lebih) * i) / n;
    waveParticle(s.H, s.k, sig, s.h, x0, 0, t, dz);
    const px = m.X(x0) + dz[0] * lay.E;
    const py = m.Y(0) - dz[1] * lay.E;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  if (tutup) {
    const yb = Math.min(m.Y(-s.h), m.frame.y1);
    ctx.lineTo(m.X(lay.span + lebih), yb);
    ctx.lineTo(m.X(-lebih), yb);
    ctx.closePath();
  }
}

/** Partikel (posisi saat t) di tiap orbit. */
function partikel(ctx: CanvasRenderingContext2D, lay: WaveLayout, s: WaveOrbitSpec, nRow: number, t: number, r: number) {
  const m = lay.map;
  const sig = (2 * Math.PI) / s.T;
  ctx.beginPath();
  for (let i = 0; i < nRow; i++)
    for (let j = 0; j < lay.cols.length; j++) {
      waveParticle(s.H, s.k, sig, s.h, lay.cols[j], lay.rows[i], t, dz);
      const px = m.X(lay.cols[j]) + dz[0] * lay.E;
      const py = m.Y(lay.rows[i]) - dz[1] * lay.E;
      ctx.moveTo(px + r, py);
      ctx.arc(px, py, r, 0, Math.PI * 2);
    }
}

export function drawWaveOrbit(ctx: CanvasRenderingContext2D, w: number, hPx: number, s: WaveOrbitSpec): PlateOut {
  ctx.fillStyle = C.sheet;
  ctx.fillRect(0, 0, w, hPx);
  const lay = waveLayout(w, hPx, s);
  const m = lay.map;
  const f = m.frame;
  const nRow = isiBaris(lay.rows, s.h, s.zWin);
  const yBed = m.Y(-s.h);
  const bedIn = s.h <= s.zWin;

  ctx.save();
  ctx.beginPath();
  ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
  ctx.clip();

  // Air (keadaan t = 0, atau air diam bila sedang bergerak).
  if (!s.faded) {
    jalurMuka(ctx, lay, s, 0, true);
    ctx.fillStyle = C.waterFill;
    ctx.fill();
  } else {
    ctx.fillStyle = C.waterFill;
    ctx.fillRect(f.x0, m.Y(0), f.x1 - f.x0, Math.min(yBed, f.y1) - m.Y(0));
  }

  // Muka air diam.
  pen(ctx, W.hair, C.ink3, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(f.x0, m.Y(0));
  ctx.lineTo(f.x1, m.Y(0));
  ctx.stroke();
  ctx.setLineDash([]);

  // Orbit.
  pen(ctx, W.hair, C.water);
  for (let i = 0; i < nRow; i++) {
    waveOrbitAxes(s.H, s.k, s.h, lay.rows[i], ab);
    const ra = ab[0] * lay.E;
    const rb = ab[1] * lay.E;
    for (let j = 0; j < lay.cols.length; j++) {
      const cx = m.X(lay.cols[j]);
      const cy = m.Y(lay.rows[i]);
      ctx.beginPath();
      if (rb < 0.4) {
        ctx.moveTo(cx - ra, cy);
        ctx.lineTo(cx + ra, cy);
      } else ctx.ellipse(cx, cy, Math.max(ra, 0.01), rb, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Muka air dan partikel pada t = 0.
  if (s.faded) {
    jalurMuka(ctx, lay, s, 0, false);
    pen(ctx, W.hair, s.breaking ? C.signal : C.water, DASH.phantom);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    jalurMuka(ctx, lay, s, 0, false);
    pen(ctx, W.bold, s.breaking ? C.signal : C.water, s.breaking ? DASH.invalid : DASH.solid);
    ctx.stroke();
    ctx.setLineDash([]);
    partikel(ctx, lay, s, nRow, 0, 2.2);
    ctx.fillStyle = C.ink;
    ctx.fill();
  }

  // Dasar.
  if (bedIn) {
    hatchSoil(ctx, f.x0, yBed, f.x1 - f.x0, f.y1 - yBed + 2);
    pen(ctx, W.bold, C.ink);
    ctx.beginPath();
    ctx.moveTo(f.x0, yBed);
    ctx.lineTo(f.x1, yBed);
    ctx.stroke();
  }
  ctx.restore();

  // Bingkai.
  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(Math.round(f.x0) + 0.5, Math.round(f.y0) + 0.5, Math.round(f.x1 - f.x0), Math.round(f.y1 - f.y0));

  // Angka kedalaman.
  ctx.font = F.value;
  ctx.fillStyle = C.ink3;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const st = niceStep(s.zWin, Math.max(2, Math.min(5, Math.round((f.y1 - m.Y(0)) / 40))));
  const dig = st >= 10 ? 0 : st >= 1 ? 1 : st >= 0.1 ? 2 : 3;
  for (let z = 0; z <= s.zWin + 1e-9; z += st) {
    const y = m.Y(-z);
    if (y > f.y1 + 0.5) break;
    ctx.fillText(z === 0 ? "0" : `−${fmtPlain(z, dig)}`, f.x0 - 6, y);
  }
  ctx.save();
  ctx.translate(14, (m.Y(0) + f.y1) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = F.labelSm;
  ctx.fillStyle = C.ink2;
  ctx.textAlign = "center";
  ctx.fillText("z, m", 0, 0);
  ctx.restore();

  // Judul, skala, dan keterangan di tepi atas (di atas simpangan muka air).
  ctx.font = F.labelSm;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = C.ink2;
  ctx.fillText(s.labels.title, f.x0 + 6, f.y0 + 8);
  const skala = [lay.V > 1.05 ? s.labels.scaleV(fmtPlain(lay.V, lay.V >= 10 ? 0 : 1)) : "", s.labels.scaleM(fmtPlain(lay.M, lay.M >= 1 ? 0 : Math.ceil(-Math.log10(lay.M) - 1e-9)))]
    .filter(Boolean)
    .join("; ");
  ctx.textAlign = "right";
  // Di kanvas sempit skala turun ke baris kedua (ruang atas dibuat lebih tinggi, padT).
  const sempit = w < SEMPIT;
  ctx.textAlign = sempit ? "left" : "right";
  ctx.fillText(skala, sempit ? f.x0 + 6 : f.x1 - 48, f.y0 + (sempit ? 21 : 8));
  if (s.breaking) {
    ctx.fillStyle = C.signal;
    ctx.textAlign = "center";
    ctx.fillText(s.labels.invalid, (f.x0 + f.x1) / 2, f.y0 + 22);
  }

  // Panjang gelombang di bawah bingkai.
  ctx.textAlign = "center";
  ctx.fillStyle = C.ink2;
  const yL = f.y1 + 16;
  if (s.L <= lay.span * 1.0001) {
    const xa = m.X(0);
    const xb = m.X(s.L);
    pen(ctx, W.thin, C.ink2);
    ctx.beginPath();
    ctx.moveTo(xa, yL);
    ctx.lineTo(xb, yL);
    ctx.moveTo(xa, yL - 4);
    ctx.lineTo(xa, yL + 4);
    ctx.moveTo(xb, yL - 4);
    ctx.lineTo(xb, yL + 4);
    ctx.stroke();
    const teks = `L = ${fmtPlain(s.L, s.L >= 100 ? 0 : 1)} m`;
    const lb = ctx.measureText(teks).width;
    ctx.fillStyle = C.sheet;
    ctx.fillRect((xa + xb) / 2 - lb / 2 - 4, yL - 7, lb + 8, 14);
    ctx.fillStyle = C.ink2;
    ctx.fillText(teks, (xa + xb) / 2, yL);
  }

  // Dasar di luar gambar.
  if (!bedIn) {
    ctx.textAlign = "center";
    ctx.fillStyle = C.ink2;
    ctx.fillText(s.labels.bedOut(fmtPlain(s.h, s.h >= 10 ? 0 : 1)), (f.x0 + f.x1) / 2, f.y1 - 10);
  }

  return {
    map: m,
    anchors: { dasar: { x: m.X(lay.span * 0.86), y: yBed } },
  };
}

export type WaveMotion = {
  kunci: number;
  teks: string;
  /** Tata letak terakhir dan kuncinya (w, h piksel, H, L, zWin, h): dibuat ulang hanya bila berubah */
  lay: WaveLayout | null;
  k: Float64Array;
};

export function createWaveMotion(): WaveMotion {
  return { kunci: NaN, teks: "", lay: null, k: new Float64Array(6) };
}

/**
 * Lapis gerak FP-03: muka air (tempat kedudukan partikel muka air) dan
 * partikel di orbitnya pada saat t (detik fisik). Laju sudut σ = 2π/T dan
 * bilangan gelombang k dari model, jadi puncak merambat c = σ/k = L/T dan
 * tiap partikel menempuh orbitnya sekali per periode. Tidak menggambar apa
 * pun bila gelombangnya pecah (teori linear tidak berlaku).
 */
export function drawWaveOrbitMotion(
  ctx: CanvasRenderingContext2D,
  w: number,
  hPx: number,
  t: number,
  s: WaveOrbitSpec,
  st: WaveMotion
): void {
  if (s.breaking) return;
  const kk = st.k;
  if (!st.lay || kk[0] !== w || kk[1] !== hPx || kk[2] !== s.H || kk[3] !== s.L || kk[4] !== s.zWin || kk[5] !== s.h) {
    st.lay = waveLayout(w, hPx, s);
    kk[0] = w;
    kk[1] = hPx;
    kk[2] = s.H;
    kk[3] = s.L;
    kk[4] = s.zWin;
    kk[5] = s.h;
  }
  const lay = st.lay;
  const m = lay.map;
  const f = m.frame;
  const nRow = isiBaris(lay.rows, s.h, s.zWin);
  ctx.save();
  ctx.beginPath();
  ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
  ctx.clip();
  jalurMuka(ctx, lay, s, t, true);
  ctx.fillStyle = C.waterFill;
  ctx.fill();
  jalurMuka(ctx, lay, s, t, false);
  pen(ctx, W.bold, C.water);
  ctx.stroke();
  partikel(ctx, lay, s, nRow, t, 2.2);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.restore();

  const kunci = Math.round((t % 1e6) * 10);
  if (kunci !== st.kunci) {
    st.kunci = kunci;
    st.teks = `t = ${fmtPlain(kunci / 10, 1)} s`;
  }
  ctx.font = F.value;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(st.teks).width;
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = C.sheet;
  ctx.fillRect(f.x0 + 4, f.y1 - 20, tw + 8, 16);
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.ink2;
  ctx.fillText(st.teks, f.x0 + 8, f.y1 - 12);
}

/** Pengali waktu FP-03: satu orbit 1 sampai 9,5 detik layar (×1 sampai T 9,5 s, lalu ×10). */
export function waveTimeScale(T: number): number {
  const f = 1 / Math.max(T, 1e-9);
  const k = Math.floor(Math.log10(f / 0.105));
  return Math.pow(10, -k);
}
