import { C, DASH, F, W, stencil, stencilWidth } from "./theme.ts";
import {
  axisTitle,
  axisValue,
  curveLabel,
  dimH,
  dimV,
  ground,
  hatchConcrete,
  hatchWater,
  leader,
  niceStep,
  pen,
  region,
  ruling,
} from "./plate.ts";
import { G, conjugateDepth, froude, jumpLength, fmtPlain} from "./hydraulics.ts";
import { cl } from "./strings.ts";
import type { Lang } from "./i18n";
import { mapFrom, type PlateAnchor, type PlateOut } from "./plateOut.ts";
import { createPool, relane, type Pool } from "./motion.ts";

export type JumpParams = {
  /** Kedalaman hulu, meter */
  y1: number;
  /** Kecepatan hulu, m/s */
  V1: number;
};

export type JumpOptions = {
  showEnergy?: boolean;
  showDims?: boolean;
  /** Kondisi pembanding, digambar sebagai garis posisi alternatif */
  ghost?: JumpParams | null;
  /** Panjang saluran yang digambar, meter */
  domain?: number;
  compact?: boolean;
  lang?: Lang;
  /**
   * Aliran sedang digambar oleh lapis gerak (drawJumpMotion). Panah aliran
   * diam tidak digambar, karena goresan sudah membawa informasi yang sama.
   * Pemanggil memberi false saat dijeda atau reduced-motion, supaya arah
   * dan laju tetap terbaca dari panah.
   */
  flow?: boolean;
};

/** Batas atas loncatan berombak (Chow 1959 §15-3), sama dengan classifyJump. */
const FR_BEROMBAK = 1.7;

/**
 * Tata letak dan bentuk loncatan, dipakai bersama oleh lapis statis
 * (drawJump) dan lapis gerak (drawJumpMotion) supaya goresan berjalan di
 * badan air yang persis sama dengan yang digambar.
 */
export type JumpLayout = ReturnType<typeof jumpLayout>;

export function jumpLayout(w: number, h: number, p: JumpParams, opt: JumpOptions = {}) {
  const { showEnergy = true, showDims = true, domain = 16, compact = false } = opt;

  const padL = compact ? 22 : 62;
  const padR = compact ? 22 : 34;
  const padT = compact ? 18 : 30;
  /*
   * Di bawah dasar beton, dari atas ke bawah: dimensi Lj (tulisannya di
   * atas garis dimensi), angka sumbu jarak, judul sumbu. Dulu dimensi Lj
   * duduk di baris yang sama dengan judul sumbu dan menimpanya.
   */
  const bedThk = compact ? 8 : 16;
  const bawahDim = showDims && !compact;
  const padB = compact ? 26 : bawahDim ? 74 : 54;

  const plotW = Math.max(10, w - padL - padR);
  const plotH = Math.max(10, h - padT - padB);
  const bedY = padT + plotH;
  // Garis dimensi Lj, lalu angka sumbu dan judulnya di bawahnya.
  const ljY = bedY + bedThk + 14;
  const angkaY = bedY + bedThk + (bawahDim ? 20 : 5);
  const judulY = angkaY + 25;

  const Fr1 = froude(p.V1, p.y1);
  const hasJump = Fr1 > 1;
  const y2 = hasJump ? conjugateDepth(p.y1, Fr1) : p.y1;
  const Lj = hasJump ? jumpLength(y2) : 0;
  const E1 = p.y1 + (p.V1 * p.V1) / (2 * G);

  /*
   * Bentang yang digambar mengikuti panjang loncatannya, bukan dipatok.
   *
   * Panjang loncatan enam kali kedalaman hilir, jadi pada bilangan Froude
   * tinggi ia dengan mudah melebihi bentang tetap berapa pun. Bila itu
   * dibiarkan, loncatannya terpotong bingkai dan nama-nama wilayah jatuh
   * bertumpuk di tepi kanan. Loncatan mulai pada sepertiga bentang, jadi agar
   * ia beserta ekor subkritisnya muat, bentangnya harus sekitar dua kali
   * panjang loncatan.
   */
  const bentang = Math.max(domain, hasJump ? Lj * 2 : 0);

  /*
   * Skala tegak ikut memuat garis energi, tetapi hanya bila garis itu memang
   * ditampilkan. Pada kecepatan tinggi, tinggi kecepatan jauh melampaui
   * kedalaman airnya, dan skala yang hanya melihat kedalaman akan menggambar
   * garis energi di luar kotak. Mematikan garis energi lewat tombol tampilan
   * dengan sendirinya mengembalikan skala ke airnya saja.
   */
  const yMax = Math.max(
    y2 * 2.0,
    p.y1 * 3,
    0.9,
    showEnergy ? E1 * 1.08 : 0
  );
  const sx = plotW / bentang;
  const sy = plotH / yMax;

  const X = (m: number) => padL + m * sx;
  const Y = (m: number) => bedY - m * sy;

  const xJump = bentang * 0.33;
  const q = p.V1 * p.y1;

  /*
   * Loncatan berombak (1 < Fr₁ < 1,7) tidak punya gulungan: muka airnya
   * naik lalu bergelombang tegak dan meluruh ke y₂ (Chow 1959 §15-3).
   * Bentuk itu juga tidak diberikan Belanger, jadi tetap digambar titik
   * rapat; amplitudonya sebanding y₂ − y₁ dan gelombangnya hilang tepat di
   * akhir bentang loncatan sehingga ekor hilir tetap y₂ hasil hitungan.
   *
   * d = y₂ − (y₂ − y₁)·(1 − s)²·(0,3 + 0,7·cos 3πs), s = 0..1: berangkat
   * landai dari y₁, puncak pertama ≈ 0,18 (y₂ − y₁) di atas y₂ pada
   * sepertiga Lj, lalu gelombang yang meluruh kuadratis; lembah tidak
   * pernah di bawah y₁. Satu setengah gelombang saja: skala tegak gambar
   * jauh lebih besar dari skala mendatar, dan gelombang yang lebih rapat
   * tampak sebagai paku, bukan undulasi.
   */
  const undular = hasJump && Fr1 < FR_BEROMBAK;

  const depthAt = (x: number): number => {
    if (!hasJump) return p.y1;
    if (x <= xJump) return p.y1;
    if (x >= xJump + Lj) return y2;
    const s = (x - xJump) / Lj;
    if (undular) {
      const u = 1 - s;
      return y2 - (y2 - p.y1) * u * u * (0.3 + 0.7 * Math.cos(3 * Math.PI * s));
    }
    return p.y1 + (y2 - p.y1) * (s * s * (3 - 2 * s));
  };

  // Badan air: muka air disampel tiap `step` piksel.
  const step = Math.max(1, Math.floor(plotW / 320));
  const pts: [number, number][] = [];
  for (let px = 0; px <= plotW; px += step) {
    const xm = (px / plotW) * bentang;
    pts.push([padL + px, Y(depthAt(xm))]);
  }

  return {
    padL, padR, padT, padB, bedThk, bawahDim, plotW, plotH, bedY, ljY, angkaY, judulY,
    Fr1, hasJump, undular, y2, Lj, E1, bentang, yMax, sx, sy, X, Y, xJump, q,
    depthAt, step, pts,
  };
}

/** Busur gulungan dari sudut ROLL_A0 ke ROLL_A1 (arah canvas), celah di kanan. */
const ROLL_A0 = Math.PI * 0.25;
const ROLL_A1 = Math.PI * 1.75;
/** Jarak bebas tanda gulungan ke muka air dan dasar, px (memuat kaki panah). */
const ROLL_TEPI = 2.5;
/** Jari-jari terkecil yang masih terbaca sebagai busur berpanah, px. */
const ROLL_R_MIN = 2.5;

export type RollerMark = {
  cx: number;
  cy: number;
  r: number;
  /** Kepala panah terbuka: kaki 1 (x, y), ujung (x, y), kaki 2 (x, y), px */
  head: [number, number, number, number, number, number];
};

/**
 * Tanda gulungan (roller) di dalam loncatan, px.
 *
 * Arah putaran: pada aliran ke kanan gulungan berputar BERLAWANAN arah
 * jarum jam. Permukaan gulungan mengalir balik ke hulu menuju kaki
 * loncatan, bagian bawahnya terbawa semburan ke hilir (Chow 1959 §15-1).
 * Busur digambar dari 45° lewat bawah, kiri, atas sampai 315° (sudut
 * canvas, sumbu y ke bawah); bergerak berlawanan jarum jam berarti
 * berakhir di ujung 45° (kanan bawah), jadi kepala panah ada di situ,
 * menunjuk ke kanan atas.
 *
 * Jari-jari dan pusat dibatasi supaya busur selalu di dalam badan air:
 * dekat kaki loncatan airnya dangkal, dan busur 7 px pada 0,82 d dulu
 * menonjol di atas muka air. Busur yang tak muat sama sekali (jari-jari di
 * bawah ROLL_R_MIN) tidak digambar.
 */
export function rollerMarks(L: JumpLayout): RollerMark[] {
  if (!L.hasJump || L.undular) return [];
  const { Fr1, xJump, Lj, sx, depthAt, X, Y, bedY } = L;
  const n = Math.min(7, Math.max(3, Math.round(Fr1 / 1.4)));
  const out: RollerMark[] = [];
  for (let i = 0; i < n; i++) {
    const xm = xJump + ((i + 0.5) / n) * Lj;
    const r0 = Math.min(7, (Lj * sx) / (n * 2.4));
    // Muka air terendah di sepanjang lebar busur (px terbesar).
    const dx = r0 / sx;
    let dmin = Infinity;
    for (let k = -4; k <= 4; k++) dmin = Math.min(dmin, depthAt(xm + (k * dx) / 4));
    const muka = Y(dmin);
    const r = Math.min(r0, (bedY - muka - 2 * ROLL_TEPI) / 2);
    if (!(r >= ROLL_R_MIN)) continue;
    const cx = X(xm);
    // Dekat muka air (gulungan gejala permukaan), dijepit ke dalam badan air.
    let cy = Y(depthAt(xm) * 0.82);
    cy = Math.max(cy, muka + ROLL_TEPI + r);
    cy = Math.min(cy, bedY - ROLL_TEPI - r);

    // Kepala panah di ujung ROLL_A0. Arah gerak = tali busur dari titik
    // sepanjang kepala sebelumnya ke ujung, supaya kepala mengikuti
    // lengkungan pada jari-jari kecil.
    const hl = Math.min(4, Math.max(2.5, r * 0.75));
    const tx = cx + r * Math.cos(ROLL_A0);
    const ty = cy + r * Math.sin(ROLL_A0);
    const aq = ROLL_A0 + hl / r;
    let ux = tx - (cx + r * Math.cos(aq));
    let uy = ty - (cy + r * Math.sin(aq));
    const ul = Math.hypot(ux, uy) || 1;
    ux /= ul;
    uy /= ul;
    const a = 0.45; // setengah sudut kepala, rad (≈ 26°)
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    out.push({
      cx,
      cy,
      r,
      head: [
        tx - hl * (ux * ca - uy * sa),
        ty - hl * (ux * sa + uy * ca),
        tx,
        ty,
        tx - hl * (ux * ca + uy * sa),
        ty - hl * (-ux * sa + uy * ca),
      ],
    });
  }
  return out;
}

/**
 * POTONGAN MEMANJANG — loncatan air pada saluran persegi mendatar.
 *
 * Catatan penting soal kejujuran gambar: persamaan Belanger hanya
 * memberi kedalaman di kedua UJUNG loncatan, bukan bentuk permukaan
 * di antaranya. Karena itu bagian dalam loncatan digambar dengan garis
 * titik rapat — konvensi untuk "di luar jangkauan rumus" — bukan garis
 * menerus yang berpura-pura tahu.
 */
export function drawJump(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: JumpParams,
  opt: JumpOptions = {}
): PlateOut {
  const {
    showEnergy = true,
    showDims = true,
    ghost = null,
    compact = false,
    lang = "id",
    flow = false,
  } = opt;

  const T = cl(lang);
  const L = jumpLayout(w, h, p, opt);
  const {
    padL, padT, bedThk, plotW, plotH, bedY, ljY, angkaY, judulY,
    Fr1, hasJump, undular, y2, Lj, E1, bentang, yMax, sx, X, Y, xJump, q,
    depthAt, step, pts,
  } = L;

  ground(ctx, w, h);

  /* ---------------- kisi ---------------- */
  const yStep = niceStep(yMax, 5);
  const xStep = niceStep(bentang, 8);
  const hs: number[] = [];
  const vs: number[] = [];
  for (let v = 0; v <= yMax + 1e-9; v += yStep) hs.push(Y(v));
  for (let x = 0; x <= bentang + 1e-9; x += xStep) vs.push(X(x));
  ruling(ctx, padL, padT, padL + plotW, bedY, {
    horizontal: hs,
    vertical: vs,
  });

  if (!compact) {
    for (let v = 0; v <= yMax + 1e-9; v += yStep)
      axisValue(ctx, fmtPlain(v, 1), padL - 8, Y(v), "right", "middle");
    for (let x = 0; x <= bentang + 1e-9; x += xStep)
      axisValue(ctx, String(Math.round(x)), X(x), angkaY, "center", "top");

    axisTitle(ctx, T.axDistance, padL + plotW / 2, judulY);
    axisTitle(ctx, T.axDepth, 18, padT + plotH / 2, -Math.PI / 2);
  }

  /* ---------------- badan air ---------------- */
  const clipWater = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], bedY);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(pts[pts.length - 1][0], bedY);
    ctx.closePath();
  };

  ctx.save();
  clipWater();
  ctx.fillStyle = C.waterFill;
  ctx.fill();
  ctx.restore();

  hatchWater(ctx, clipWater, padL, padL + plotW, padT + 4, bedY);

  /* Goresan aliran ada di lapis gerak, drawJumpMotion di bawah. */

  /* ---------------- kondisi pembanding ---------------- */
  if (ghost) {
    const gFr = froude(ghost.V1, ghost.y1);
    const gy2 = gFr > 1 ? conjugateDepth(ghost.y1, gFr) : ghost.y1;
    const gLj = gFr > 1 ? jumpLength(gy2) : 0;
    const gDepth = (x: number) => {
      if (gFr <= 1) return ghost.y1;
      if (x <= xJump) return ghost.y1;
      if (x >= xJump + gLj) return gy2;
      const s = (x - xJump) / gLj;
      return ghost.y1 + (gy2 - ghost.y1) * (s * s * (3 - 2 * s));
    };
    pen(ctx, W.thin, C.ink3, DASH.phantom);
    ctx.beginPath();
    for (let px = 0; px <= plotW; px += step) {
      const xm = (px / plotW) * bentang;
      const py = Y(gDepth(xm));
      if (px === 0) ctx.moveTo(padL + px, py);
      else ctx.lineTo(padL + px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* ---------------- muka air ---------------- */
  // Bagian hulu dan hilir: hasil hitungan, garis menerus.
  pen(ctx, W.bold, C.water);
  ctx.beginPath();
  ctx.moveTo(X(0), Y(p.y1));
  ctx.lineTo(X(xJump), Y(p.y1));
  ctx.stroke();

  if (hasJump) {
    ctx.beginPath();
    ctx.moveTo(X(xJump + Lj), Y(y2));
    ctx.lineTo(X(bentang), Y(y2));
    ctx.stroke();

    // Bagian dalam loncatan: bentuk permukaan TIDAK diberikan oleh
    // persamaan Belanger. Digambar titik rapat sebagai pengakuan.
    pen(ctx, W.thin, C.water, DASH.invalid);
    ctx.beginPath();
    for (let x = xJump; x <= xJump + Lj; x += Lj / 40) {
      const py = Y(depthAt(x));
      if (x === xJump) ctx.moveTo(X(x), py);
      else ctx.lineTo(X(x), py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    pen(ctx, W.bold, C.water);
    ctx.beginPath();
    ctx.moveTo(X(xJump), Y(p.y1));
    ctx.lineTo(X(bentang), Y(p.y1));
    ctx.stroke();
  }

  /* ---------------- gulungan loncatan ---------------- */
  // Digambar sebagai busur berputar berkepala panah, cara buku teks
  // menandai roller. Tidak untuk loncatan berombak (rollerMarks kosong).
  if (!compact) {
    const marks = rollerMarks(L);
    if (marks.length) {
      ctx.save();
      // Pengaman: tanda gulungan tidak pernah keluar dari badan air.
      clipWater();
      ctx.clip();
      pen(ctx, W.thin, C.water);
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      for (const m of marks) {
        ctx.moveTo(m.cx + m.r * Math.cos(ROLL_A0), m.cy + m.r * Math.sin(ROLL_A0));
        ctx.arc(m.cx, m.cy, m.r, ROLL_A0, ROLL_A1);
        ctx.moveTo(m.head[0], m.head[1]);
        ctx.lineTo(m.head[2], m.head[3]);
        ctx.lineTo(m.head[4], m.head[5]);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------------- panah aliran ---------------- */
  // Hanya bila goresan tidak bergerak; kalau keduanya tampil, informasinya dobel.
  if (!compact && !flow) {
    flowArrow(ctx, X(xJump * 0.28), Y(p.y1 * 0.5), Math.min(46, 6 + p.V1 * 4));
    if (hasJump) {
      const V2 = q / y2;
      flowArrow(
        ctx,
        X(Math.min(bentang - 2.2, xJump + Lj + 2.2)),
        Y(y2 * 0.5),
        Math.min(46, 6 + V2 * 4)
      );
    }
  }

  /* ---------------- garis energi ---------------- */
  type Kotak = { x0: number; x1: number; y0: number; y1: number };
  let kotakEnergi: Kotak | null = null;
  // Garis energi sebagai deretan kotak tipis, supaya tulisan Fr₁ tidak
  // ditaruh tepat di atas garis itu.
  const ruasEnergi: Kotak[] = [];
  if (showEnergy) {
    const V2 = q / y2;
    const E2 = y2 + (V2 * V2) / (2 * G);
    const eAt = (x: number) => {
      if (!hasJump || x <= xJump) return E1;
      if (x >= xJump + Lj) return E2;
      const s = (x - xJump) / Lj;
      return E1 + (E2 - E1) * (s * s * (3 - 2 * s));
    };
    const xsE = [0, xJump];
    if (hasJump) for (let i = 1; i <= 24; i++) xsE.push(xJump + (Lj * i) / 24);
    xsE.push(bentang);
    for (let i = 1; i < xsE.length; i++) {
      const ya = Y(eAt(xsE[i - 1]));
      const yb = Y(eAt(xsE[i]));
      ruasEnergi.push({
        x0: X(xsE[i - 1]),
        x1: X(xsE[i]),
        y0: Math.min(ya, yb) - 2,
        y1: Math.max(ya, yb) + 2,
      });
    }

    pen(ctx, W.thin, C.energy, DASH.hidden);
    ctx.beginPath();
    ctx.moveTo(X(0), Y(E1));
    ctx.lineTo(X(xJump), Y(E1));
    if (hasJump) {
      for (let x = xJump; x <= xJump + Lj; x += Lj / 24) {
        const s = (x - xJump) / Lj;
        ctx.lineTo(X(x), Y(E1 + (E2 - E1) * (s * s * (3 - 2 * s))));
      }
    }
    ctx.lineTo(X(bentang), Y(E2));
    ctx.stroke();
    ctx.setLineDash([]);

    if (!compact) {
      /* Tulisan di atas garisnya, kecuali bila garis itu sudah berada di
         pita nama wilayah di atas bidang gambar (kecepatan tinggi, skala
         tegak dikuasai E₁); maka tulisannya pindah ke bawah garis supaya
         nama wilayah superkritis tidak terdesak hilang. */
      const yE = Y(E1) - 15 < padT + 34 && showDims ? Y(E1) + 10 : Y(E1) - 9;
      curveLabel(ctx, T.energyLine, X(0.35), yE, C.energy);
      // Kotak tulisan ini dicatat supaya penanda Fr₁ dan nama wilayah
      // tidak ditaruh di atasnya (lihat bagian dimensi).
      ctx.font = F.labelSm;
      const lebarE = stencilWidth(ctx, T.energyLine, 0.6);
      kotakEnergi = { x0: X(0.35) - 3, x1: X(0.35) + lebarE + 3, y0: yE - 6, y1: yE + 6 };

      // Kehilangan energi sebagai dimensi vertikal di hilir.
      if (hasJump && E1 - E2 > 0.02) {
        const xd = X(bentang) - 6;
        dimV(ctx, xd, Y(E1), Y(E2), `ΔE ${fmtPlain((E1 - E2), 3)} m`, C.energy);
      }
    }
  }

  /* ---------------- dasar saluran ---------------- */
  hatchConcrete(ctx, padL, bedY + 1, plotW, bedThk);
  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  ctx.moveTo(padL, bedY + 0.5);
  ctx.lineTo(padL + plotW, bedY + 0.5);
  ctx.stroke();
  pen(ctx, W.hair, C.ink3);
  ctx.beginPath();
  ctx.moveTo(padL, bedY + bedThk + 0.5);
  ctx.lineTo(padL + plotW, bedY + bedThk + 0.5);
  ctx.stroke();

  /* ---------------- keluaran untuk lapis di atas gambar ----------------
     Dihitung di sini, sebelum cabang dimensi yang bisa berakhir lebih awal.
     Tidak menggambar apa pun. Titik bernama:
     - `upstreamSurface`: muka air hulu (tengah ruas superkritis), kedalaman y1
     - `downstreamSurface`: muka air hilir (tengah ekor), kedalaman y2
     - `toe`: kaki loncatan, awal loncatan pada muka air hulu
     - `jumpEnd`: akhir loncatan pada muka air hilir (sama dengan toe bila
       tidak ada loncatan)
     - `energyUpstream`: garis energi hulu, hanya bila garis energi tampil
     `water` = badan air yang sama dengan isi biru (dasar ke muka air). */
  const keluar = (() => {
    const map = mapFrom(
      X,
      Y,
      { x0: padL, y0: padT, x1: padL + plotW, y1: bedY },
      [0, bentang],
      [0, yMax]
    );
    const xAkhir = hasJump ? xJump + Lj : xJump;
    const anchors: Record<string, PlateAnchor> = {
      upstreamSurface: { x: X(xJump / 2), y: Y(p.y1) },
      downstreamSurface: { x: X((xAkhir + bentang) / 2), y: Y(y2) },
      toe: { x: X(xJump), y: Y(p.y1) },
      jumpEnd: { x: X(xAkhir), y: Y(y2) },
    };
    if (showEnergy) anchors.energyUpstream = { x: X(xJump / 2), y: Y(E1) };
    const water = new Float64Array(pts.length * 2 + 4);
    let k = 0;
    water[k++] = pts[0][0];
    water[k++] = bedY;
    for (const [x, y] of pts) {
      water[k++] = x;
      water[k++] = y;
    }
    water[k++] = pts[pts.length - 1][0];
    water[k++] = bedY;
    return { map, anchors, water, waters: [water] } as PlateOut;
  })();

  /* ---------------- dimensi dan nama wilayah ---------------- */
  if (showDims && !compact) {
    /*
     * Dimensi y₁, penanda Fr₁, dan tulisan garis energi berbagi pojok kiri
     * awal loncatan. Bila kedalaman y₁ terlalu pendek untuk memuat
     * tulisannya, dimV menaruh tulisan itu tegak di atas tanda atasnya, dan
     * di layar sempit tulisan Fr₁ beserta garis penunjuknya jatuh tepat di
     * atasnya ("y₁ 0,30 m" tertutup). Pada aliran tanpa loncatan tulisan
     * Fr₁ jatuh di atas "garis energi". Karena itu letak siku penanda Fr₁
     * dipilih dari beberapa calon: calon pertama yang tidak menabrak tulisan
     * lain dan tidak keluar bidang gambar.
     */
    const teksY1 = `y₁ ${fmtPlain(p.y1, 2)} m`;
    const teksFr = `Fr₁ ${fmtPlain(Fr1, 2)}`;
    ctx.font = F.label;
    const lebarY1 = stencilWidth(ctx, teksY1);
    const lebarFr = stencilWidth(ctx, teksFr);
    const tinggiHuruf = 12;
    const muatY1 = Y(0) - Y(p.y1) >= lebarY1 + 6;
    const bahu = 14 + 4;
    const dimX = X(xJump * 0.62);
    /* Tanpa loncatan tidak ada kaki loncatan yang bisa ditunjuk; penanda
       Fr₁ menunjuk muka air di tengah bentang, wilayah tunggal yang sama. */
    const ujung = { x: X(hasJump ? xJump : bentang / 2), y: Y(p.y1) };

    // Tulisan y₁: di tengah dimensinya bila muat, kalau tidak di atasnya.
    const kotakY1: Kotak = muatY1
      ? {
          x0: dimX - 5 - tinggiHuruf,
          x1: dimX - 5,
          y0: (Y(0) + Y(p.y1)) / 2 - lebarY1 / 2,
          y1: (Y(0) + Y(p.y1)) / 2 + lebarY1 / 2,
        }
      : { x0: dimX - 5 - tinggiHuruf, x1: dimX - 5, y0: Y(p.y1) - 4 - lebarY1, y1: Y(p.y1) - 4 };

    // Tulisan Fr₁ dan garis penunjuknya, dari siku s.
    const kotakFr = (s: { x: number; y: number }): Kotak[] => {
      const kanan = s.x >= ujung.x;
      const x0 = kanan ? s.x + bahu : s.x - bahu - lebarFr;
      return [
        { x0, x1: x0 + lebarFr, y0: s.y - tinggiHuruf / 2, y1: s.y + tinggiHuruf / 2 },
        {
          x0: Math.min(s.x, ujung.x),
          x1: Math.max(s.x, ujung.x),
          y0: Math.min(s.y, ujung.y),
          y1: Math.max(s.y, ujung.y),
        },
      ];
    };
    const kena = (a: Kotak, b: Kotak) =>
      a.x0 < b.x1 + 4 && b.x0 < a.x1 + 4 && a.y0 < b.y1 + 2 && b.y0 < a.y1 + 2;
    const tulisan: Kotak[] = [kotakY1, ...(kotakEnergi ? [kotakEnergi] : [])];
    const lain: Kotak[] = [...tulisan, ...ruasEnergi];
    /* Tulisan Fr₁ tidak boleh menimpa tulisan lain maupun garis energi.
       Garis penunjuknya hanya dijaga dari tulisan: menyeberangi garis
       energi tidak terhindarkan, karena kaki loncatan selalu di bawahnya. */
    const layak = (s: { x: number; y: number }) => {
      const [teks, garis] = kotakFr(s);
      if (teks.x0 < padL + 2 || teks.x1 > padL + plotW - 2) return false;
      if (teks.y0 < padT + 34 || teks.y1 > bedY - 2) return false;
      return lain.every((k) => !kena(teks, k)) && tulisan.every((k) => !kena(garis, k));
    };
    // Siku tinggi: tepat di atas tulisan y₁, garis penunjuk hampir tegak
    // supaya tidak menyilang tulisan y₁ di kirinya.
    const yTinggi = Math.min(Y(p.y1) - 34, kotakY1.y0 - 14);
    const calon = [
      { x: ujung.x - 46, y: Y(p.y1) - 34 },
      { x: ujung.x - 10, y: yTinggi },
      { x: ujung.x + 46, y: Y(p.y1) - 34 },
      { x: ujung.x + 10, y: yTinggi },
      { x: ujung.x - 46, y: Y(p.y1) - 58 },
      // Di sela muka air dan garis energi bila sela itu cukup lebar.
      { x: ujung.x - 46, y: Y(p.y1) - 16 },
      { x: ujung.x + 46, y: Y(p.y1) - 16 },
    ];
    const siku = calon.find(layak) ?? calon[0];

    dimV(ctx, dimX, Y(p.y1), Y(0), teksY1, C.water);

    if (hasJump) {
      dimV(
        ctx,
        X(Math.min(bentang - 0.7, xJump + Lj + 3.4)),
        Y(y2),
        Y(0),
        `y₂ ${fmtPlain(y2, 2)} m`,
        C.water
      );
      /* Di bawah beton, di atas angka sumbu; lihat padB. Pada loncatan
         berombak Lj ≈ 6 y₂ di luar rentang ujinya (paling sesuai pada
         rentang mantap, Chow 1959 Gbr. 15-4), jadi ditulis sebagai
         pendekatan, tanpa angka yang terkesan pasti. */
      const teksLj = undular
        ? `Lj ≈ 6 y₂ ${T.ljApprox}`
        : `Lj ≈ ${fmtPlain(Lj, 1)} m`;
      dimH(
        ctx,
        ljY,
        X(xJump),
        X(xJump + Lj),
        teksLj,
        C.critical,
        bedY + bedThk,
        [padL, padL + plotW]
      );

      /* Letak kaki loncatan pada sepertiga bentang adalah pilihan gambar,
         bukan hasil hitungan: posisinya ditentukan muka air hilir
         (tailwater), yang tidak dimodelkan lembar ini. Keterangannya ditulis
         kecil di kiri garis sumbu kaki, sebaris dengan dimensi Lj, dan
         tidak digambar bila tidak muat di antara tepi kanvas dan tulisan Lj
         (catatan dasar teori lembar menyebutkannya juga). */
      // Tepi kiri tulisan Lj, dengan penjepit yang sama seperti di dimH.
      ctx.font = F.label;
      const separuhLj = stencilWidth(ctx, teksLj) / 2;
      const kiriLj =
        Math.min(
          Math.max((X(xJump) + X(xJump + Lj)) / 2, padL + separuhLj + 6),
          Math.max(padL + separuhLj + 6, padL + plotW - separuhLj - 6)
        ) - separuhLj;
      ctx.save();
      ctx.font = F.labelSm;
      const kananSk = Math.min(X(xJump) - 6, kiriLj - 8);
      if (kananSk - ctx.measureText(T.jumpSchematic).width >= 4) {
        ctx.fillStyle = C.ink3;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(T.jumpSchematic, kananSk, ljY - 5);
      }
      ctx.restore();

      // Garis sumbu menandai awal dan akhir loncatan.
      pen(ctx, W.hair, C.critical, DASH.axis);
      ctx.beginPath();
      for (const x of [xJump, xJump + Lj]) {
        ctx.moveTo(X(x), padT);
        ctx.lineTo(X(x), bedY);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    /*
     * Nama wilayah diletakkan di TENGAH wilayahnya sendiri bila muat.
     *
     * Di layar sempit (HP 390 px) wilayah superkritis hanya sekitar 85 px
     * dan ekor subkritis lebih sempit lagi, jadi aturan lama "lewati bila
     * tidak muat" menghapus keduanya dan gambar kehilangan nama rezimnya.
     * Sekarang ada dua jenjang cadangan: huruf kecil di tengah wilayah, lalu
     * huruf kecil yang boleh melewati batas wilayahnya, dijepit ke bidang
     * gambar, di baris kedua bila baris pertama sudah terisi di situ. Nama
     * baru dilewati bila kedua baris sudah terpakai di tempat itu.
     */
    type Zona = { x0: number; x1: number; teks: string; warna: string };
    /* Fr₁ ≤ 1: alirannya subkritis sepanjang bentang, jadi satu wilayah
       saja. Dulu bagian kirinya tetap bertuliskan "superkritis". */
    const zona: Zona[] = hasJump
      ? [
          { x0: 0, x1: xJump, teks: T.supercritical, warna: C.ink3 },
          { x0: xJump, x1: xJump + Lj, teks: T.jump, warna: C.critical },
          { x0: xJump + Lj, x1: bentang, teks: T.subcritical, warna: C.ink3 },
        ]
      : [{ x0: 0, x1: bentang, teks: `${T.subcritical} · ${T.noJump}`, warna: C.ink3 }];

    const baris = [padT + 14, padT + 27];
    const terpakai: { x0: number; x1: number; b: number }[] = [];
    // Tulisan garis energi juga bisa lewat di ketinggian nama wilayah.
    const bebas = (x0: number, x1: number, b: number) =>
      terpakai.every((u) => u.b !== b || x1 + 6 < u.x0 || u.x1 + 6 < x0) &&
      (!kotakEnergi ||
        !kena({ x0, x1, y0: baris[b] - 6, y1: baris[b] + 6 }, kotakEnergi));

    const tunda: Zona[] = [];
    // Jenjang pertama: huruf wilayah biasa, di tengah wilayah, baris pertama.
    for (const z of zona) {
      const lebarZona = X(z.x1) - X(z.x0);
      ctx.font = F.region;
      const lebar = stencilWidth(ctx, z.teks, 1.4);
      const cx = X((z.x0 + z.x1) / 2);
      if (lebar + 12 <= lebarZona && bebas(cx - lebar / 2, cx + lebar / 2, 0)) {
        region(ctx, z.teks, cx, baris[0], z.warna);
        terpakai.push({ x0: cx - lebar / 2, x1: cx + lebar / 2, b: 0 });
      } else tunda.push(z);
    }
    // Jenjang cadangan: huruf kecil, boleh melewati batas wilayahnya.
    for (const z of tunda) {
      ctx.font = F.labelSm;
      const lebar = stencilWidth(ctx, z.teks, 0.8);
      const tengah = X((z.x0 + z.x1) / 2);
      const cx = Math.min(
        Math.max(tengah, padL + 4 + lebar / 2),
        padL + plotW - 4 - lebar / 2
      );
      const x0 = cx - lebar / 2;
      const x1 = cx + lebar / 2;
      const b = bebas(x0, x1, 0) ? 0 : bebas(x0, x1, 1) ? 1 : -1;
      if (b < 0) continue;
      ctx.save();
      ctx.font = F.labelSm;
      ctx.fillStyle = z.warna;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      stencil(ctx, z.teks, cx, baris[b], 0.8);
      ctx.restore();
      terpakai.push({ x0, x1, b });
    }

    // Penanda bilangan Froude pada penampang masuk.
    leader(
      ctx,
      ujung.x,
      ujung.y,
      siku.x,
      siku.y,
      teksFr,
      hasJump ? C.ink : C.signal
    );
  }

  return keluar;
}

/* ================================================================== *
 * LAPIS GERAK: goresan aliran
 * ================================================================== */

/**
 * Keadaan lapis gerak OC-01. Dibuat sekali per lembar (createJumpMotion);
 * drawJumpMotion tidak mengalokasikan apa pun per frame kecuali saat
 * ukuran atau masukan berubah (tata letak dan Path2D badan air dihitung
 * ulang sekali).
 *
 * Isi pool (motion.ts): x = posisi sebagai bagian bentang (0..1), supaya
 * goresan tidak meloncat saat bentang berubah mengikuti Lj; y = kedalaman
 * relatif y/d (0..1). Dengan u = q/d(x) dan y = (y/d)·d(x), lintasan
 * goresan adalah garis arus medan dua dimensi yang memenuhi kontinuitas
 * (w = u·(y/d)·d'), jadi goresan naik mengikuti muka air di loncatan
 * tanpa pernah keluar dari badan air.
 */
export type JumpMotion = {
  pool: Pool;
  lay: JumpLayout | null;
  clip: Path2D | null;
  // Kunci tata letak terakhir (angka, bukan string, supaya tanpa alokasi).
  kw: number;
  kh: number;
  ky1: number;
  kV1: number;
  kE: boolean;
  kD: boolean;
};

export function createJumpMotion(n = 150): JumpMotion {
  const pool = createPool(n);
  /* Sebaran awal: posisi mendatar merata berurutan, lajur dari hash (seed
     createPool). Lajur frac(i·φ) yang dulu dipakai membuat tetangga
     mendatar berbaris miring. */
  for (let i = 0; i < n; i++) {
    pool.x[i] = i / n;
    pool.y[i] = 0.1 + pool.seed[i] * 0.8;
  }
  return { pool, lay: null, clip: null, kw: -1, kh: -1, ky1: -1, kV1: -1, kE: false, kD: false };
}

/** Panjang goresan per m/s pada bidang gambar selebar 700 px atau lebih. */
const PX_PER_MPS = 2.6;
/** Goresan terpendek agar partikel lambat tetap tampak, px. */
const GORES_MIN = 2;

/**
 * Menggambar satu frame goresan aliran di kanvas lapis gerak.
 *
 * Semua laju diturunkan dari hasil model, waktu nyata (tanpa pengali):
 * - Laju partikel = q / d(x): V₁ di hulu, V₂ = q / y₂ di hilir.
 * - Panjang goresan sebanding laju setempat sampai V₁ maksimum penggeser
 *   (16 m/s), tanpa batas atas. Skalanya 2,6 px per m/s, diperkecil
 *   sebanding lebar bidang gambar di bawah 700 px supaya goresan V₁ 16 m/s
 *   tidak menutupi gambar di HP.
 * - Goyangan tegak di daerah gulungan: amplitudo sebanding (y₂ − y₁)/y₂
 *   (kedalaman relatif), nol untuk loncatan berombak yang tidak punya
 *   gulungan; frekuensi sudut V₁/y₂ (rad/s), skala waktu alami gulungan.
 *   Di luar gulungan tidak ada goyangan: aliran di sana sejajar.
 */
export function drawJumpMotion(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  dt: number,
  p: JumpParams,
  opt: JumpOptions,
  st: JumpMotion
): void {
  const showEnergy = opt.showEnergy ?? true;
  const showDims = opt.showDims ?? true;
  if (
    !st.lay ||
    st.kw !== w ||
    st.kh !== h ||
    st.ky1 !== p.y1 ||
    st.kV1 !== p.V1 ||
    st.kE !== showEnergy ||
    st.kD !== showDims
  ) {
    st.lay = jumpLayout(w, h, p, opt);
    st.kw = w;
    st.kh = h;
    st.ky1 = p.y1;
    st.kV1 = p.V1;
    st.kE = showEnergy;
    st.kD = showDims;
    st.clip = null;
    if (typeof Path2D !== "undefined") {
      const c = new Path2D();
      const pts = st.lay.pts;
      c.moveTo(pts[0][0], st.lay.bedY);
      for (const [x, y] of pts) c.lineTo(x, y);
      c.lineTo(pts[pts.length - 1][0], st.lay.bedY);
      c.closePath();
      st.clip = c;
    }
  }
  const L = st.lay;
  const { bentang, depthAt, q, hasJump, undular, xJump, Lj, y2, X, Y } = L;
  const pool = st.pool;
  const n = pool.n;

  // Majukan semua partikel.
  for (let i = 0; i < n; i++) {
    const xm = pool.x[i] * bentang;
    const V = q / Math.max(depthAt(xm), 0.02);
    pool.u[i] = V;
    let f = pool.x[i] + (V * dt) / bentang;
    if (f > 1) {
      f -= 1;
      // Lahir ulang di hulu pada lajur baru: hash (i, hitungan lahir ulang),
      // tidak berkorelasi dengan urutan lewat (lihat motion.ts hash01).
      pool.y[i] = 0.1 + relane(pool, i) * 0.8;
    }
    pool.x[i] = f;
  }

  const k = PX_PER_MPS * Math.min(1, L.plotW / 700);
  // 0,25 memberi ≈ 0,2 pada keadaan awal (Fr₁ 4,1), sama dengan goyangan lama.
  const amp = hasJump && !undular ? 0.25 * ((y2 - p.y1) / y2) : 0;
  const omega = hasJump ? p.V1 / y2 : 0;

  ctx.save();
  if (st.clip) ctx.clip(st.clip);
  pen(ctx, W.hair, C.water);
  ctx.lineCap = "butt";
  // Dua lintasan: di luar gulungan (tipis), di dalam gulungan (lebih pekat,
  // karena air bergolak di sana). Satu path, satu stroke per lintasan.
  // Loncatan berombak tidak punya gulungan, jadi hanya lintasan pertama.
  const adaGulungan = hasJump && !undular;
  for (let pass = 0; pass < 2; pass++) {
    const roller = pass === 1;
    if (roller && !adaGulungan) break;
    ctx.globalAlpha = roller ? 0.5 : 0.34;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const xm = pool.x[i] * bentang;
      const inRoller = adaGulungan && xm > xJump && xm < xJump + Lj;
      if (inRoller !== roller) continue;
      // Selubung sin(πs): goyangan mulai dan berakhir nol di kedua ujung
      // gulungan, jadi goresan tidak meloncat tegak saat keluar-masuk.
      const wob = inRoller
        ? amp * Math.sin((Math.PI * (xm - xJump)) / Lj) * Math.sin(omega * t + pool.seed[i] * 40)
        : 0;
      const yr = Math.min(0.97, Math.max(0.03, pool.y[i] + wob));
      const len = Math.max(GORES_MIN, pool.u[i] * k);
      const hx = X(xm);
      const hy = Y(depthAt(xm) * yr);
      // Ekor mengikuti garis arus yang sama, mundur sepanjang `len` px.
      const xt = xm - len / L.sx;
      const ty = Y(depthAt(xt < 0 ? 0 : xt) * yr);
      ctx.moveTo(hx - len, ty);
      ctx.lineTo(hx, hy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Panah aliran: batang tipis dengan kepala terbuka. */
function flowArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number
) {
  pen(ctx, W.thin, C.water);
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(x - len / 2, y);
  ctx.lineTo(x + len / 2, y);
  ctx.moveTo(x + len / 2 - 5, y - 3.2);
  ctx.lineTo(x + len / 2, y);
  ctx.lineTo(x + len / 2 - 5, y + 3.2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
