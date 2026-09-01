import { C, DASH, F, W, stencil } from "./theme";
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
} from "./plate";
import { G, conjugateDepth, froude, jumpLength } from "./hydraulics";

export type JumpParams = {
  /** Kedalaman hulu, meter */
  y1: number;
  /** Kecepatan hulu, m/s */
  V1: number;
};

/**
 * Satu goresan aliran.
 *
 * Bukan partikel hiasan: posisinya dimajukan memakai kecepatan setempat
 * V = q / y, sehingga goresan benar-benar melambat saat melewati loncatan
 * dan masuk ke bagian yang lebih dalam. Panjang goresan dibuat sebanding
 * dengan kecepatan itu, seperti jejak pada foto berpajanan lama — jadi
 * gerakannya sekaligus berlaku sebagai skala kecepatan yang bisa dibaca.
 */
export type Streak = { x: number; yr: number; seed: number };

export function makeStreaks(n: number): Streak[] {
  const out: Streak[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: i / n,
      yr: 0.1 + ((i * 0.6180339887) % 1) * 0.8,
      seed: (i * 0.7548776662) % 1,
    });
  }
  return out;
}

export type JumpOptions = {
  showEnergy?: boolean;
  showDims?: boolean;
  /** Kondisi pembanding, digambar sebagai garis posisi alternatif */
  ghost?: JumpParams | null;
  /** Panjang saluran yang digambar, meter */
  domain?: number;
  compact?: boolean;
  /** Goresan aliran; bila tidak diberikan, gambar diam sepenuhnya */
  streaks?: Streak[] | null;
  /** Selang waktu sejak frame sebelumnya, detik */
  dt?: number;
  t?: number;
};

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
) {
  const {
    showEnergy = true,
    showDims = true,
    ghost = null,
    domain = 16,
    compact = false,
    streaks = null,
    dt = 0,
    t = 0,
  } = opt;

  const padL = compact ? 22 : 62;
  const padR = compact ? 22 : 34;
  const padT = compact ? 18 : 30;
  const padB = compact ? 26 : 54;

  const plotW = Math.max(10, w - padL - padR);
  const plotH = Math.max(10, h - padT - padB);
  const bedY = padT + plotH;

  const Fr1 = froude(p.V1, p.y1);
  const hasJump = Fr1 > 1;
  const y2 = hasJump ? conjugateDepth(p.y1, Fr1) : p.y1;
  const Lj = hasJump ? jumpLength(y2) : 0;

  const yMax = Math.max(y2 * 2.0, p.y1 * 3, 0.9);
  const sx = plotW / domain;
  const sy = plotH / yMax;

  const X = (m: number) => padL + m * sx;
  const Y = (m: number) => bedY - m * sy;

  const xJump = domain * 0.33;
  const q = p.V1 * p.y1;

  const depthAt = (x: number): number => {
    if (!hasJump) return p.y1;
    if (x <= xJump) return p.y1;
    if (x >= xJump + Lj) return y2;
    const s = (x - xJump) / Lj;
    return p.y1 + (y2 - p.y1) * (s * s * (3 - 2 * s));
  };

  ground(ctx, w, h);

  /* ---------------- kisi ---------------- */
  const yStep = niceStep(yMax, 5);
  const xStep = niceStep(domain, 8);
  const hs: number[] = [];
  const vs: number[] = [];
  for (let v = 0; v <= yMax + 1e-9; v += yStep) hs.push(Y(v));
  for (let x = 0; x <= domain + 1e-9; x += xStep) vs.push(X(x));
  ruling(ctx, padL, padT, padL + plotW, bedY, {
    horizontal: hs,
    vertical: vs,
  });

  if (!compact) {
    for (let v = 0; v <= yMax + 1e-9; v += yStep)
      axisValue(ctx, v.toFixed(1), padL - 8, Y(v), "right", "middle");
    for (let x = 0; x <= domain + 1e-9; x += xStep)
      axisValue(ctx, String(Math.round(x)), X(x), bedY + 9, "center", "top");

    axisTitle(ctx, "jarak sepanjang saluran, m", padL + plotW / 2, bedY + 34);
    axisTitle(ctx, "kedalaman, m", 18, padT + plotH / 2, -Math.PI / 2);
  }

  /* ---------------- badan air ---------------- */
  const step = Math.max(1, Math.floor(plotW / 320));
  const pts: [number, number][] = [];
  for (let px = 0; px <= plotW; px += step) {
    const xm = (px / plotW) * domain;
    pts.push([padL + px, Y(depthAt(xm))]);
  }

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

  /* ---------------- goresan aliran ---------------- */
  /* Setiap goresan dimajukan dengan kecepatan setempat V = q / y, dan
     panjangnya dibuat sebanding kecepatan itu. Jadi goresan yang rapat
     dan pendek di hilir bukan pilihan gaya — itu memang tanda aliran
     yang melambat setelah kedalamannya bertambah. */
  if (streaks && dt > 0) {
    ctx.save();
    clipWater();
    ctx.clip();

    for (const st of streaks) {
      const xm = st.x * domain;
      const d = depthAt(xm);
      const V = q / Math.max(d, 0.02);

      st.x += (V * dt) / domain;
      if (st.x > 1) {
        st.x -= 1;
        st.yr = 0.1 + ((st.seed * 7.3) % 1) * 0.8;
      }

      const inRoller = hasJump && xm > xJump && xm < xJump + Lj;
      // Di daerah gulungan, jalur air memang tidak lagi sejajar dasar.
      const wobble = inRoller
        ? Math.sin(t * 5.5 + st.seed * 40) * 0.2
        : Math.sin(t * 1.1 + st.seed * 12) * 0.012;
      const yr = Math.min(0.97, Math.max(0.03, st.yr + wobble));

      const px = X(xm);
      const py = Y(d * yr);
      const len = Math.max(2, Math.min(26, V * 2.6));

      pen(ctx, W.hair, C.water);
      ctx.globalAlpha = inRoller ? 0.5 : 0.34;
      ctx.beginPath();
      ctx.moveTo(px - len, py);
      ctx.lineTo(px, py);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

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
      const xm = (px / plotW) * domain;
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
    ctx.lineTo(X(domain), Y(y2));
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
    ctx.lineTo(X(domain), Y(p.y1));
    ctx.stroke();
  }

  /* ---------------- gulungan loncatan ---------------- */
  // Digambar sebagai busur berputar, cara buku teks menandai roller.
  if (hasJump && Fr1 > 1.7 && !compact) {
    pen(ctx, W.thin, C.water);
    ctx.globalAlpha = 0.65;
    const n = Math.min(7, Math.max(3, Math.round(Fr1 / 1.4)));
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const xm = xJump + f * Lj;
      const d = depthAt(xm);
      const cx = X(xm);
      const cy = Y(d * 0.82);
      const r = Math.min(7, (Lj * sx) / (n * 2.4));
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI * 0.25, Math.PI * 1.75);
      ctx.stroke();
      // Anak panah kecil di ujung busur, menunjukkan arah putaran.
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.5, cy - r * 0.86);
      ctx.lineTo(cx + r * 0.86, cy - r * 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- panah aliran ---------------- */
  // Hanya bila goresan dimatikan; kalau keduanya tampil, informasinya dobel.
  if (!compact && !streaks) {
    flowArrow(ctx, X(xJump * 0.28), Y(p.y1 * 0.5), Math.min(46, 6 + p.V1 * 4));
    if (hasJump) {
      const V2 = q / y2;
      flowArrow(
        ctx,
        X(Math.min(domain - 2.2, xJump + Lj + 2.2)),
        Y(y2 * 0.5),
        Math.min(46, 6 + V2 * 4)
      );
    }
  }

  /* ---------------- garis energi ---------------- */
  if (showEnergy) {
    const E1 = p.y1 + (p.V1 * p.V1) / (2 * G);
    const V2 = q / y2;
    const E2 = y2 + (V2 * V2) / (2 * G);

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
    ctx.lineTo(X(domain), Y(E2));
    ctx.stroke();
    ctx.setLineDash([]);

    if (!compact) {
      curveLabel(ctx, "garis energi", X(0.35), Y(E1) - 9, C.energy);

      // Kehilangan energi sebagai dimensi vertikal di hilir.
      if (hasJump && E1 - E2 > 0.02) {
        const xd = X(domain) - 6;
        dimV(ctx, xd, Y(E1), Y(E2), `ΔE ${(E1 - E2).toFixed(3)} m`, C.energy);
      }
    }
  }

  /* ---------------- dasar saluran ---------------- */
  const bedThk = compact ? 8 : 16;
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

  /* ---------------- dimensi dan nama wilayah ---------------- */
  if (showDims && !compact) {
    dimV(
      ctx,
      X(xJump * 0.62),
      Y(p.y1),
      Y(0),
      `y₁ ${p.y1.toFixed(2)} m`,
      C.water
    );

    if (hasJump) {
      dimV(
        ctx,
        X(Math.min(domain - 0.7, xJump + Lj + 3.4)),
        Y(y2),
        Y(0),
        `y₂ ${y2.toFixed(2)} m`,
        C.water
      );
      dimH(
        ctx,
        bedY + bedThk + 16,
        X(xJump),
        X(xJump + Lj),
        `Lj ≈ ${Lj.toFixed(1)} m`,
        C.critical,
        bedY + bedThk
      );

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

    region(ctx, "superkritis", X(xJump * 0.5), padT + 14, C.ink3);
    if (hasJump) {
      region(ctx, "loncatan", X(xJump + Lj / 2), padT + 14, C.critical);
      region(
        ctx,
        "subkritis",
        X(Math.min(domain - 2, xJump + Lj + (domain - xJump - Lj) / 2)),
        padT + 14,
        C.ink3
      );
    } else {
      region(
        ctx,
        "tidak terbentuk loncatan",
        X(xJump + (domain - xJump) / 2),
        padT + 14,
        C.ink3
      );
    }

    // Penanda bilangan Froude pada penampang masuk.
    leader(
      ctx,
      X(xJump),
      Y(p.y1),
      X(xJump) - 46,
      Y(p.y1) - 34,
      `Fr₁ ${Fr1.toFixed(2)}`,
      hasJump ? C.ink : C.signal
    );
  }
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
