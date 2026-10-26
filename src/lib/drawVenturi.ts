import { C, DASH, F, W, stencil } from "./theme.ts";
import {
  axisTitle,
  axisValue,
  curveLabel,
  dimV,
  flowArrow,
  ground,
  niceStep,
  pen,
  pipeBody,
  region,
  ruling,
  type PipeWall,
} from "./plate.ts";
import { cl } from "./strings.ts";
import type { Lang } from "./i18n";
import { fmtPlain } from "./hydraulics.ts";
import { mapFrom, type PlateAnchor, type PlateOut } from "./plateOut.ts";
import { createPool, drawStreaks, hash01, type Pool } from "./motion.ts";

export type VenturiDrawState = {
  /** Diameter pipa, meter */
  D1: number;
  /** Diameter leher, meter */
  D2: number;
  /** Kecepatan di pipa dan di leher */
  V1: number;
  V2: number;
  /** Beda tinggi tekan antara pipa dan leher, meter */
  dh: number;
  /** Kehilangan tekanan tetap sesudah alat, meter */
  permanentLoss: number;
  /** Di luar rentang perbandingan diameter yang lazim */
  outOfRange: boolean;
  /** Leher tidak lebih sempit dari pipa: tidak ada garis tinggi tekan yang bisa digambar */
  notVenturi: boolean;
  /**
   * Aliran sedang digambar lapis gerak (drawVenturiMotion): panah aliran
   * diam tidak digambar, karena goresan membawa informasi yang sama.
   * Pemanggil memberi false saat dijeda atau reduced-motion.
   */
  flow?: boolean;
};

/**
 * Letak sambungan venturi klasik sepanjang pipa, meter: akhir pipa masuk
 * (a1), akhir bagian menyempit (a2), akhir leher (a3), akhir bagian
 * membesar (a4), panjang total (L). Satu sumber untuk gambar dan gerak.
 * Perbandingannya mengikuti bentuk baku venturi klasik: bagian menyempit
 * landai, leher pendek, bagian membesar jauh lebih panjang. Justru bagian
 * membesar yang panjang itulah yang membuat kehilangan tetapnya kecil.
 */
export function venturiGeometry(D1: number, D2: number) {
  const a1 = 1.2 * D1;
  const a2 = a1 + 1.3 * D1;
  const a3 = a2 + 1.0 * D2;
  const a4 = a3 + 5.0 * D1;
  const L = a4 + 1.2 * D1;
  return { a1, a2, a3, a4, L };
}

/** Jari-jari dinding dalam pada jarak x, m (garis lurus antar sambungan). */
export function venturiRadius(D1: number, D2: number, x: number): number {
  const { a1, a2, a3, a4 } = venturiGeometry(D1, D2);
  const r1 = D1 / 2;
  const r2 = D2 / 2;
  if (x <= a1) return r1;
  if (x <= a2) return r1 + ((r2 - r1) * (x - a1)) / (a2 - a1);
  if (x <= a3) return r2;
  if (x <= a4) return r2 + ((r1 - r2) * (x - a3)) / (a4 - a3);
  return r1;
}

/**
 * DUA REGISTER BERTUMPUK PADA SATU SUMBU JARAK.
 *
 * Panel atas garis tinggi tekan, panel bawah potongan pipanya. Keduanya
 * dipisah karena skalanya memang tidak sebanding: tinggi tekan diukur dalam
 * meter kolom air sedangkan diameter pipa dalam sentimeter, dan
 * memaksakan keduanya pada satu skala akan membuat salah satunya lenyap.
 *
 * Yang harus terbaca sekali pandang: garis tekan MENUKIK di leher lalu naik
 * kembali, tetapi tidak naik sampai setinggi semula. Selisih yang tidak
 * kembali itu kehilangan tetap, dan justru kecilnya selisih itulah alasan
 * orang memilih venturi ketimbang pelat lubang.
 */
export function drawVenturi(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: VenturiDrawState,
  lang: Lang
): PlateOut {
  const T = cl(lang);
  ground(ctx, w, h);

  const padL = 62;
  const padR = 26;
  const padT = 24;
  const padB = 50;
  const sela = 26;

  const plotW = Math.max(10, w - padL - padR);
  const tinggiTotal = Math.max(20, h - padT - padB - sela);
  const tinggiAtas = tinggiTotal * 0.52;
  const tinggiBawah = tinggiTotal - tinggiAtas;
  const atasY = padT;
  const bawahY = padT + tinggiAtas + sela;

  /* -------- geometri venturi dalam satuan diameter pipa (venturiGeometry) -------- */
  const { a1, a2, a3, a4, L } = venturiGeometry(s.D1, s.D2);
  const xKeluar = L - a4;

  const X = (x: number) => padL + (x / L) * plotW;

  const wall: PipeWall = [
    { x: 0, r: s.D1 / 2 },
    { x: a1, r: s.D1 / 2 },
    { x: a2, r: s.D2 / 2 },
    { x: a3, r: s.D2 / 2 },
    { x: a4, r: s.D1 / 2 },
    { x: L, r: s.D1 / 2 },
  ];

  // Skala jari-jari dari yang terbesar di antara pipa dan leher, supaya
  // leher yang lebih besar dari pipa tetap tergambar di dalam panelnya.
  const rMax = (Math.max(s.D1, s.D2) / 2) * 1.55;
  const R = (r: number) => bawahY + tinggiBawah / 2 - (r / rMax) * (tinggiBawah / 2);

  /* -------- panel atas: garis tinggi tekan -------- */
  const hDatang = Math.max(s.dh * 1.35, 0.05);
  const zTop = hDatang * 1.12;
  const Z = (z: number) => atasY + tinggiAtas - (z / zTop) * tinggiAtas;

  const zStep = niceStep(zTop, 4);
  const xStep = niceStep(L, 6);
  const hs: number[] = [];
  const vs: number[] = [];
  for (let v = 0; v <= zTop + 1e-9; v += zStep) hs.push(Z(v));
  for (let v = 0; v <= L + 1e-9; v += xStep) vs.push(X(v));
  ruling(ctx, padL, atasY, padL + plotW, atasY + tinggiAtas, {
    horizontal: hs,
    vertical: vs,
  });
  ruling(ctx, padL, bawahY, padL + plotW, bawahY + tinggiBawah, {
    vertical: vs,
  });

  const digits = zStep < 0.1 ? 3 : zStep < 1 ? 2 : 1;
  for (let v = 0; v <= zTop + 1e-9; v += zStep)
    axisValue(ctx, fmtPlain(v, digits), padL - 8, Z(v), "right", "middle");
  for (let v = 0; v <= L + 1e-9; v += xStep)
    axisValue(
      ctx,
      fmtPlain(v, 2),
      X(v),
      bawahY + tinggiBawah + 9,
      "center",
      "top"
    );

  axisTitle(ctx, T.axAlongPipe, padL + plotW / 2, bawahY + tinggiBawah + 34);
  axisTitle(ctx, T.axHead, 18, atasY + tinggiAtas / 2, -Math.PI / 2);

  // Garis tinggi tekan. Tinggi tekan datang dipatok sebagai acuan, lalu
  // turun sebesar beda tinggi tekan di leher dan pulih sebagian sesudahnya.
  const zMasuk = hDatang;
  const zLeher = hDatang - s.dh;
  const zPulih = hDatang - s.permanentLoss;

  const hgl: [number, number][] = [];
  hgl.push([0, zMasuk]);
  hgl.push([a1, zMasuk]);
  for (let i = 1; i <= 14; i++) {
    const f = i / 14;
    hgl.push([a1 + (a2 - a1) * f, zMasuk - (zMasuk - zLeher) * (f * f)]);
  }
  hgl.push([a3, zLeher]);
  for (let i = 1; i <= 20; i++) {
    const f = i / 20;
    hgl.push([a3 + (a4 - a3) * f, zLeher + (zPulih - zLeher) * Math.sqrt(f)]);
  }
  hgl.push([L, zPulih]);

  // Bila lehernya tidak lebih sempit, tidak ada penurunan tekanan yang bisa
  // digambar: bacaan manometer yang dimasukkan tidak punya arti di sini, dan
  // panel atas menyatakan itu alih-alih menggambar garis dari angka itu.
  if (s.notVenturi) {
    region(ctx, T.notVenturi, padL + plotW / 2, atasY + tinggiAtas / 2, C.signal);
  } else {
    pen(ctx, W.bold, C.energy);
    ctx.beginPath();
    hgl.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))));
    ctx.stroke();
    curveLabel(ctx, T.pressureLine, X(a1 * 0.15), Z(zMasuk) - 10, C.energy);

    // Tinggi tekan datang sebagai garis khayal, supaya bagian yang tidak pulih
    // terbaca sebagai jarak, bukan sebagai kesan.
    pen(ctx, W.hair, C.ink3, DASH.phantom);
    ctx.beginPath();
    ctx.moveTo(X(0), Z(zMasuk));
    ctx.lineTo(X(L), Z(zMasuk));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (!s.notVenturi) {
    dimV(
      ctx,
      X((a2 + a3) / 2),
      Z(zMasuk),
      Z(zLeher),
      `Δh ${fmtPlain(s.dh, 4)} m`,
      C.energy
    );
    dimV(
      ctx,
      X(L) - 26,
      Z(zMasuk),
      Z(zPulih),
      // Kehilangan tetap = energi (sama dengan tint hL di tabel), bukan
      // tanda di luar rentang.
      `${fmtPlain(s.permanentLoss, 4)} m`,
      C.energy
    );
  }

  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(padL) + 0.5,
    Math.round(atasY) + 0.5,
    Math.round(plotW),
    Math.round(tinggiAtas)
  );

  /* -------- panel bawah: potongan pipa -------- */
  const isiAir = () => {
    ctx.beginPath();
    const urut = [...wall];
    urut.forEach((p, i) =>
      i ? ctx.lineTo(X(p.x), R(p.r)) : ctx.moveTo(X(p.x), R(p.r))
    );
    for (let i = urut.length - 1; i >= 0; i--)
      ctx.lineTo(X(urut[i].x), R(-urut[i].r));
    ctx.closePath();
  };
  ctx.save();
  isiAir();
  ctx.fillStyle = C.waterFill;
  ctx.fill();
  ctx.restore();

  pipeBody(ctx, wall, X, R, {
    thickness: s.D1 * 0.06,
    clip: { x: padL, y: bawahY, w: plotW, h: tinggiBawah },
    axis: true,
  });

  // Panah kecepatan: panjangnya sebanding kecepatan setempat, jadi ia
  // memanjang dengan sendirinya di leher.
  // Hanya saat goresan lapis gerak tidak berjalan; kalau keduanya tampil,
  // informasinya dobel.
  const skalaPanah = (plotW / L) * 0.12;
  if (!s.flow)
    for (const [x, V] of [
      [a1 * 0.5, s.V1],
      [(a2 + a3) / 2, s.V2],
      [a4 + xKeluar * 0.5, s.V1],
    ] as const) {
      flowArrow(ctx, X(x), R(0) - 0.5, Math.max(10, V * skalaPanah), C.water);
    }

  // Titik ukur tekanan: satu di pipa, satu di leher. Tanpa penyempitan
  // tidak ada yang diukur, dan garisnya cuma akan memotong tulisan di panel
  // atas.
  for (const [x, teks] of s.notVenturi
    ? []
    : ([
        [a1 * 0.6, "1"],
        [(a2 + a3) / 2, "2"],
      ] as const)) {
    const rw = x < a1 ? s.D1 / 2 : s.D2 / 2;
    pen(ctx, W.thin, C.energy, DASH.axis);
    ctx.beginPath();
    ctx.moveTo(X(x), R(rw));
    ctx.lineTo(X(x), atasY);
    ctx.stroke();
    ctx.setLineDash([]);
    region(ctx, teks, X(x), R(rw) - 12, C.energy);
  }

  dimV(
    ctx,
    X(a1 * 0.25),
    R(s.D1 / 2),
    R(-s.D1 / 2),
    `D₁ ${fmtPlain((s.D1 * 1000), 0)} mm`,
    C.ink
  );
  dimV(
    ctx,
    X((a2 + a3) / 2) + 30,
    R(s.D2 / 2),
    R(-s.D2 / 2),
    `D₂ ${fmtPlain((s.D2 * 1000), 0)} mm`,
    s.outOfRange ? C.signal : C.ink
  );

  ctx.fillStyle = C.ink;
  ctx.font = F.heading;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Nama "leher" hanya bila memang ada leher: bila lehernya yang terbesar,
  // dindingnya turun sampai ke tempat tulisan ini.
  if (!s.notVenturi) stencil(ctx, T.throatSection, X((a2 + a3) / 2), bawahY + tinggiBawah - 12, 2);

  // Di sudut bawah, bukan atas: dimensi D₁ yang pendek menaruh teksnya di
  // atas dimensinya, tepat di baris nama wilayah kalau nama itu di atas.
  region(ctx, T.upstream, X(a1 * 0.5), bawahY + tinggiBawah - 12, C.ink3);
  region(ctx, T.downstream, X(a4 + xKeluar * 0.5), bawahY + tinggiBawah - 12, C.ink3);

  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(padL) + 0.5,
    Math.round(bawahY) + 0.5,
    Math.round(plotW),
    Math.round(tinggiBawah)
  );

  /*
   * PlateOut, tidak menggambar apa pun. Peta utama = potongan pipa (jarak
   * sepanjang pipa dan jari-jari dari sumbu, meter). Garis tinggi tekan di
   * `maps.head` (jarak, tinggi tekan relatif, meter).
   * - `pipeWall`: dinding atas pipa di dimensi D1
   * - `throatWall`: dinding atas leher di dimensi D2
   * - `headInlet`, `headThroat`: garis tinggi tekan di pipa dan di leher,
   *   hanya bila garis itu digambar (leher lebih sempit dari pipa)
   * `water` = isi pipa.
   */
  const map = mapFrom(X, R, { x0: padL, y0: bawahY, x1: padL + plotW, y1: bawahY + tinggiBawah }, [0, L], [-rMax, rMax]);
  const anchors: Record<string, PlateAnchor> = {
    pipeWall: { x: X(a1 * 0.25), y: R(s.D1 / 2) },
    throatWall: { x: X((a2 + a3) / 2), y: R(s.D2 / 2) },
  };
  if (!s.notVenturi) {
    anchors.headInlet = { x: X(a1 * 0.5), y: Z(zMasuk) };
    anchors.headThroat = { x: X((a2 + a3) / 2), y: Z(zLeher) };
  }
  const isi: number[] = [];
  for (const p of wall) isi.push(X(p.x), R(p.r));
  for (let i = wall.length - 1; i >= 0; i--) isi.push(X(wall[i].x), R(-wall[i].r));
  const water = Float64Array.from(isi);
  return {
    map,
    anchors,
    water,
    waters: [water],
    maps: {
      head: mapFrom(X, Z, { x0: padL, y0: atasY, x1: padL + plotW, y1: atasY + tinggiAtas }, [0, L], [0, zTop]),
    },
  };
}

/* ------------------------------------------------------------------ *
 * Lapis gerak FM-02: goresan air di dalam pipa
 * ------------------------------------------------------------------ */

/**
 * Titik tabel per ruas: pipa masuk, menyempit, leher, membesar, keluar.
 * Ruas yang kecepatannya berubah diberi titik lebih rapat.
 */
const RUAS_N = [8, 40, 8, 80, 8] as const;
/** Jumlah titik tabel (sambungan ikut dihitung sekali). */
export const VENTURI_PATH_N = RUAS_N[0] + RUAS_N[1] + RUAS_N[2] + RUAS_N[3] + RUAS_N[4] + 1;

export type VenturiMotion = {
  /** Jarak sepanjang pipa, m */
  x: Float64Array;
  /** Waktu tempuh dari ujung hulu, s: τ(x) = ∫ A(x)/Q dx */
  tau: Float64Array;
  /** Waktu tempuh seluruh pipa, s (0 bila tidak ada aliran) */
  T: number;
  D1: number;
  D2: number;
  Q: number;
  /** Kecepatan terbesar (di penampang tersempit), m/s */
  uMax: number;
  pool: Pool;
};

export function createVenturiMotion(n = 70): VenturiMotion {
  return {
    x: new Float64Array(VENTURI_PATH_N),
    tau: new Float64Array(VENTURI_PATH_N),
    T: 0,
    D1: NaN,
    D2: NaN,
    Q: NaN,
    uMax: 0,
    pool: createPool(n),
  };
}

/**
 * Kecepatan rata-rata penampang pada jarak x, m/s: u = Q / A(x),
 * A = π r(x)². Model (venturiDischarge) memberi V₁ = Q/A₁ dan V₂ = Q/A₂;
 * di antaranya kontinuitas yang sama.
 */
export function venturiSpeed(D1: number, D2: number, Q: number, x: number): number {
  const r = venturiRadius(D1, D2, x);
  return Q / (Math.PI * r * r);
}

/**
 * Mengisi tabel waktu tempuh. Pada tiap selang r linear dalam x, jadi
 * ∫ π r² dx = π Δx (r₀² + r₀r₁ + r₁²)/3 tepat; τ = ∫ A/Q dx.
 */
export function fillVenturiPath(m: VenturiMotion, D1: number, D2: number, Q: number): void {
  m.D1 = D1;
  m.D2 = D2;
  m.Q = Q;
  const g = venturiGeometry(D1, D2);
  const batas0 = [0, g.a1, g.a2, g.a3, g.a4];
  const batas1 = [g.a1, g.a2, g.a3, g.a4, g.L];
  let k = 0;
  m.x[0] = 0;
  m.tau[0] = 0;
  for (let j = 0; j < 5; j++) {
    const n = RUAS_N[j];
    for (let i = 1; i <= n; i++) {
      k++;
      m.x[k] = batas0[j] + ((batas1[j] - batas0[j]) * i) / n;
    }
  }
  const ok = Q > 0 && D1 > 0 && D2 > 0;
  for (let i = 1; i < VENTURI_PATH_N; i++) {
    const r0 = venturiRadius(D1, D2, m.x[i - 1]);
    const r1 = venturiRadius(D1, D2, m.x[i]);
    const vol = (Math.PI * (m.x[i] - m.x[i - 1]) * (r0 * r0 + r0 * r1 + r1 * r1)) / 3;
    m.tau[i] = m.tau[i - 1] + (ok ? vol / Q : 0);
  }
  m.T = ok ? m.tau[VENTURI_PATH_N - 1] : 0;
  const rMin = Math.min(D1, D2) / 2;
  m.uMax = ok ? Q / (Math.PI * rMin * rMin) : 0;
}

const butir = new Float64Array(4);

/**
 * Letak dan kecepatan butir pada waktu tempuh τ, lajur η (−1..1, bagian
 * jari-jari setempat). Ditulis ke out: [x, y, u, v], m dan m/s.
 * Garis arus menjaga bagian debit di bawahnya, jadi y = η·r(x) dan
 * v = dy/dt = η·r′(x)·u. Tanpa alokasi.
 */
export function venturiParticleAt(m: VenturiMotion, tau: number, eta: number, out: Float64Array): void {
  let lo = 0;
  let hi = VENTURI_PATH_N - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (m.tau[mid] <= tau) lo = mid;
    else hi = mid;
  }
  const dt = m.tau[hi] - m.tau[lo];
  const f = dt > 0 ? Math.min(1, Math.max(0, (tau - m.tau[lo]) / dt)) : 0;
  const x = m.x[lo] + (m.x[hi] - m.x[lo]) * f;
  const r = venturiRadius(m.D1, m.D2, x);
  const dx = m.x[hi] - m.x[lo];
  const drdx = dx > 0 ? (venturiRadius(m.D1, m.D2, m.x[hi]) - venturiRadius(m.D1, m.D2, m.x[lo])) / dx : 0;
  const u = m.Q / (Math.PI * r * r);
  out[0] = x;
  out[1] = eta * r;
  out[2] = u;
  out[3] = eta * drdx * u;
}

/** Bagian jari-jari terluar yang dipakai lajur (butir tidak menempel dinding). */
export const VENTURI_ETA_MAX = 0.86;

/**
 * Lapis gerak FM-02. `t` waktu fisik (sudah dikali skala waktu Client).
 * Butir punya fase tetap di sepanjang waktu tempuh T; yang keluar di hilir
 * lahir lagi di hulu dengan lajur baru. Dipotong ke dalam pipa dan ke
 * panel potongan pipa. Tanpa butir bila leher tidak lebih sempit
 * (bukan venturi, debit tidak dihitung).
 */
export function drawVenturiMotion(
  ctx: CanvasRenderingContext2D,
  t: number,
  out: PlateOut | null,
  s: { D1: number; D2: number; Q: number; notVenturi: boolean },
  m: VenturiMotion
): void {
  if (!out || s.notVenturi) return;
  if (m.D1 !== s.D1 || m.D2 !== s.D2 || m.Q !== s.Q) fillVenturiPath(m, s.D1, s.D2, s.Q);
  const T = m.T;
  if (!(T > 0) || !(m.uMax > 0)) return;
  const p = m.pool;
  for (let i = 0; i < p.n; i++) {
    const fase = hash01(i, 0x7e17) * T + t;
    const putaran = Math.floor(fase / T);
    venturiParticleAt(m, fase - putaran * T, (2 * hash01(i, putaran + 1) - 1) * VENTURI_ETA_MAX, butir);
    p.x[i] = butir[0];
    p.y[i] = butir[1];
    p.u[i] = butir[2];
    p.v[i] = butir[3];
  }
  const map = out.map;
  const f = map.frame;
  const pxPerM = Math.abs(map.X(1) - map.X(0)) || 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
  ctx.clip();
  drawStreaks(ctx, p, map, {
    // Goresan terpanjang (di leher) 18 px; lainnya sebanding u.
    lenPerMps: 18 / (m.uMax * pxPerM),
    minPx: 2,
    alpha: 0.55,
    width: W.thin,
    clip: out.water,
  });
  ctx.restore();
}

/** Tangga skala waktu 1-2-5 (detik fisik per detik layar). */
const TANGGA = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100] as const;
/** Lama tempuh seluruh pipa yang dituju di layar, detik. */
const TEMPUH_LAYAR = 6;

/**
 * Skala waktu lapis gerak dari waktu tempuh fisik T: anak tangga 1-2-5
 * terdekat (skala log) ke T / 6 s, supaya butir melintasi pipa sekitar
 * enam detik layar berapa pun ukuran alatnya. Perbandingan laju
 * antartempat tetap tepat; skalanya ditulis di bawah gambar.
 */
export function venturiTimeScale(T: number): number {
  if (!(T > 0)) return 1;
  const target = T / TEMPUH_LAYAR;
  let best: number = TANGGA[0];
  for (const v of TANGGA) if (Math.abs(Math.log(v / target)) < Math.abs(Math.log(best / target))) best = v;
  return best;
}

/** Waktu tempuh fisik seluruh pipa, s (tanpa tabel; untuk Client). */
export function venturiTransitTime(D1: number, D2: number, Q: number): number {
  if (!(Q > 0 && D1 > 0 && D2 > 0)) return 0;
  const g = venturiGeometry(D1, D2);
  const r1 = D1 / 2;
  const r2 = D2 / 2;
  const kerucut = (len: number) => (Math.PI * len * (r1 * r1 + r1 * r2 + r2 * r2)) / 3;
  const vol =
    Math.PI * r1 * r1 * (g.a1 + (g.L - g.a4)) +
    kerucut(g.a2 - g.a1) +
    Math.PI * r2 * r2 * (g.a3 - g.a2) +
    kerucut(g.a4 - g.a3);
  return vol / Q;
}
