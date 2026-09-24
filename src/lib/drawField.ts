import { C, DASH, F, W, stencil } from "./theme";
import {
  axisTitle,
  axisValue,
  createLabelPlacer,
  dimH,
  dimV,
  ground,
  hatchConcrete,
  niceStep,
  pen,
  ruling,
} from "./plate";
import { fmtPlain } from "./hydraulics";
import { cl } from "./strings";
import type { Lang } from "./i18n";

/**
 * PENGGAMBAR MEDAN ALIRAN — keluarga FF dan FP.
 *
 * Tujuh lembar terakhir memakai bentuk yang sama: satu bidang berkoordinat
 * yang isinya bukan kurva melainkan MEDAN, yaitu garis yang mengikuti arah
 * aliran, panah kecepatan yang panjangnya membawa data, penanda partikel
 * yang punya arah hadap, dan benda pejal yang dilewati alirannya.
 *
 * Bedanya dengan penggambar kurva keluarga B: di sana sumbu tegak dan sumbu
 * datar adalah dua BESARAN YANG BERBEDA, misalnya kecepatan terhadap
 * kemiringan, dan skalanya karena itu bebas masing-masing. Di sini kedua
 * sumbunya adalah RUANG YANG SAMA, jadi skalanya harus sama di kedua sumbu
 * atau bentuk pusarannya berubah menjadi bentuk lain. Itu sebabnya berkas
 * ini berdiri sendiri dan bukan pilihan tambahan pada penggambar kurva.
 *
 * Pelajaran yang dibawa ke sini dari uji terima pekan kedua, supaya cacat
 * yang sudah dibayar sekali tidak dibayar lagi tujuh kali:
 *
 * - perataan tulisan diteruskan sampai ke penulisnya, tidak berhenti di
 *   mesin penempatnya
 * - garis baca dan penanda digambar sebelum seluruh tulisan, dan penanda
 *   keadaan digambar paling akhir supaya tidak pernah tertutup
 * - uji "di dalam bidang" bertoleransi, supaya titik yang jatuh tepat di
 *   tepi tidak dibuang oleh pembulatan
 * - merah sinyal hanya untuk di luar rentang keberlakuan, tidak untuk
 *   penekanan
 */

/** Satu garis di dalam medan: garis arus, lintasan, jejak, atau profil. */
export type FieldLine = {
  pts: { x: number; y: number }[];
  color?: string;
  weight?: number;
  dash?: readonly number[];
  label?: string;
  /** Letak label sepanjang deret, 0 di awal dan 1 di akhir */
  labelAt?: number;
  labelDy?: number;
  labelAlign?: CanvasTextAlign;
  /** Diberi kepala panah di ujungnya, untuk garis yang punya arah */
  arrow?: boolean;
};

/** Panah kecepatan. Panjangnya membawa data, jadi lembarnya yang menskalakan. */
export type FieldArrow = {
  x: number;
  y: number;
  /** Komponen dalam satuan ruang bidangnya sendiri */
  dx: number;
  dy: number;
  color?: string;
  weight?: number;
};

/** Penanda partikel, boleh punya arah hadap. */
export type FieldMarker = {
  x: number;
  y: number;
  /** Arah hadap dalam radian. Bila kosong, digambar sebagai bulatan */
  heading?: number;
  color?: string;
  /** Besar penanda dalam piksel */
  size?: number;
  /** Diisi penuh bila benar */
  filled?: boolean;
};

/** Benda pejal yang dilewati alirannya, misalnya silinder atau baji. */
export type FieldBody = {
  pts: { x: number; y: number }[];
  hatched?: boolean;
  color?: string;
};

/** Bentuk tertutup yang diberi warna, misalnya elemen fluida yang berubah. */
export type FieldPatch = {
  pts: { x: number; y: number }[];
  color?: string;
  fill?: string;
  dash?: readonly number[];
  label?: string;
};

/** Nama wilayah di dalam bidang. */
export type FieldRegion = {
  x: number;
  y: number;
  text: string;
  color?: string;
  big?: boolean;
};

/** Ukuran bergaris dimensi di dalam bidang. */
export type FieldDim = {
  axis: "h" | "v";
  at: number;
  from: number;
  to: number;
  text: string;
  color?: string;
  offset?: number;
};

export type FieldSpec = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /**
   * Skala yang sama di kedua sumbu. Bawaannya BENAR.
   *
   * Kedua sumbu di sini ruang yang sama, jadi skala yang berbeda mengubah
   * lingkaran menjadi bujur telur dan sudut empat puluh lima derajat
   * menjadi sudut yang lain. Dimatikan hanya pada lembar yang sumbu
   * tegaknya sebenarnya bukan ruang, misalnya profil kecepatan lapisan
   * batas yang sumbu datarnya kecepatan tak berdimensi.
   */
  equalScale?: boolean;
  bodies?: FieldBody[];
  patches?: FieldPatch[];
  lines?: FieldLine[];
  arrows?: FieldArrow[];
  markers?: FieldMarker[];
  regions?: FieldRegion[];
  dims?: FieldDim[];
  /** Nama besar di dalam bidang, menyatakan keadaan yang sedang digambar */
  heading?: string;
  headingColor?: string;
  axisX: string;
  axisY: string;
  /** Garis kisi disembunyikan pada lembar yang medannya sudah penuh */
  noGrid?: boolean;
  padRight?: number;
};

export function drawField(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: FieldSpec,
  lang: Lang
) {
  const T = cl(lang);
  ground(ctx, w, h);

  const padL = 58;
  const padR = s.padRight ?? 26;
  const padT = 26;
  const padB = 52;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = Math.max(10, h - padT - padB);

  /* ---------------- pemetaan ---------------- */

  const spanX = Math.max(s.xMax - s.xMin, 1e-12);
  const spanY = Math.max(s.yMax - s.yMin, 1e-12);
  const sama = s.equalScale !== false;
  const skalaX = sama ? Math.min(plotW / spanX, plotH / spanY) : plotW / spanX;
  const skalaY = sama ? skalaX : plotH / spanY;
  const lebarPakai = spanX * skalaX;
  const tinggiPakai = spanY * skalaY;
  const ox = padL + (plotW - lebarPakai) / 2;
  const oy = padT + (plotH - tinggiPakai) / 2;

  const X = (x: number) => ox + (x - s.xMin) * skalaX;
  const Y = (y: number) => oy + tinggiPakai - (y - s.yMin) * skalaY;

  const tolX = spanX * 1e-9;
  const tolY = spanY * 1e-9;
  const didalam = (x: number, y: number) =>
    x >= s.xMin - tolX &&
    x <= s.xMax + tolX &&
    y >= s.yMin - tolY &&
    y <= s.yMax + tolY;

  /* ---------------- kisi dan angka sumbu ---------------- */

  const xStep = niceStep(spanX, 6);
  const yStep = niceStep(spanY, 5);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let v = Math.ceil(s.xMin / xStep) * xStep; v <= s.xMax + 1e-9; v += xStep)
    xs.push(v);
  for (let v = Math.ceil(s.yMin / yStep) * yStep; v <= s.yMax + 1e-9; v += yStep)
    ys.push(v);

  if (!s.noGrid)
    ruling(ctx, padL, padT, padL + plotW, padT + plotH, {
      horizontal: ys.map(Y),
      vertical: xs.map(X),
    });

  const desimal = (step: number) =>
    step >= 10 ? 0 : step >= 1 ? 1 : step >= 0.1 ? 2 : 3;
  for (const v of xs)
    axisValue(ctx, fmtPlain(v, desimal(xStep)), X(v), padT + plotH + 9, "center", "top");
  for (const v of ys)
    axisValue(ctx, fmtPlain(v, desimal(yStep)), padL - 8, Y(v), "right", "middle");

  axisTitle(ctx, s.axisX, padL + plotW / 2, padT + plotH + 34);
  axisTitle(ctx, s.axisY, 16, padT + plotH / 2, -Math.PI / 2);

  const taruh = createLabelPlacer(ctx, { padL, padT, plotW, plotH });

  /* Seluruh gambar medannya dipotong pada bingkainya, supaya garis arus
     yang keluar bidang tidak menimpa angka sumbunya. */
  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, padT, plotW, plotH);
  ctx.clip();

  /* ---------------- bidang berwarna ---------------- */

  for (const p of s.patches ?? []) {
    if (p.pts.length < 3) continue;
    ctx.beginPath();
    p.pts.forEach((q, i) =>
      i ? ctx.lineTo(X(q.x), Y(q.y)) : ctx.moveTo(X(q.x), Y(q.y))
    );
    ctx.closePath();
    if (p.fill) {
      ctx.fillStyle = p.fill;
      ctx.fill();
    }
    pen(ctx, W.thin, p.color ?? C.critical, p.dash ?? DASH.solid);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* ---------------- benda pejal ---------------- */

  for (const b of s.bodies ?? []) {
    if (b.pts.length < 3) continue;
    const jalur = () => {
      ctx.beginPath();
      b.pts.forEach((q, i) =>
        i ? ctx.lineTo(X(q.x), Y(q.y)) : ctx.moveTo(X(q.x), Y(q.y))
      );
      ctx.closePath();
    };
    ctx.save();
    jalur();
    ctx.fillStyle = C.sheet;
    ctx.fill();
    if (b.hatched !== false) {
      ctx.clip();
      const xs2 = b.pts.map((q) => X(q.x));
      const ys2 = b.pts.map((q) => Y(q.y));
      hatchConcrete(
        ctx,
        Math.min(...xs2),
        Math.min(...ys2),
        Math.max(...xs2) - Math.min(...xs2),
        Math.max(...ys2) - Math.min(...ys2),
        6
      );
    }
    ctx.restore();
    pen(ctx, W.bold, b.color ?? C.ink);
    jalur();
    ctx.stroke();
  }

  /* ---------------- garis medan ---------------- */

  for (const l of s.lines ?? []) {
    if (l.pts.length < 2) continue;
    pen(ctx, l.weight ?? W.thin, l.color ?? C.water, l.dash ?? DASH.solid);
    ctx.beginPath();
    l.pts.forEach((p, i) =>
      i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))
    );
    ctx.stroke();
    ctx.setLineDash([]);

    if (l.arrow && l.pts.length >= 2) {
      const a = l.pts[l.pts.length - 2];
      const b = l.pts[l.pts.length - 1];
      panah(ctx, X(a.x), Y(a.y), X(b.x) - X(a.x), Y(b.y) - Y(a.y), l.color ?? C.water, l.weight ?? W.thin, true);
    }
  }

  /* ---------------- panah kecepatan ---------------- */

  for (const a of s.arrows ?? []) {
    const x0 = X(a.x);
    const y0 = Y(a.y);
    const x1 = X(a.x + a.dx);
    const y1 = Y(a.y + a.dy);
    panah(ctx, x0, y0, x1 - x0, y1 - y0, a.color ?? C.water, a.weight ?? W.thin);
  }

  /* ---------------- ukuran ---------------- */

  for (const d of s.dims ?? []) {
    const geser = d.offset ?? 0;
    if (d.axis === "v") dimV(ctx, X(d.at) + geser, Y(d.from), Y(d.to), d.text, d.color ?? C.ink);
    else dimH(ctx, Y(d.at) + geser, X(d.from), X(d.to), d.text, d.color ?? C.ink);
  }

  /* ---------------- penanda partikel ----------------
     Digambar sesudah seluruh garis dan sebelum seluruh tulisan, karena ia
     tanda dan bukan tulisan. Penanda tidak pernah tertutup alas tulisan
     karena tulisannya sendiri digambar di luar pemotongan ini. */

  for (const m of s.markers ?? []) {
    if (!didalam(m.x, m.y)) continue;
    const px = X(m.x);
    const py = Y(m.y);
    const r = m.size ?? 4;
    const warna = m.color ?? C.ink;
    pen(ctx, W.thin, warna);
    ctx.fillStyle = m.filled ? warna : C.sheet;

    if (m.heading === undefined) {
      ctx.beginPath();
      ctx.arc(px, py, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      /* Segitiga yang menghadap arahnya, bentuk baku penanda berarah */
      const a = -m.heading;
      const titik = [
        { d: 0, r: r * 1.5 },
        { d: 2.5, r: r * 0.9 },
        { d: -2.5, r: r * 0.9 },
      ];
      ctx.beginPath();
      titik.forEach((t, i) => {
        const xx = px + Math.cos(a + t.d) * t.r;
        const yy = py + Math.sin(a + t.d) * t.r;
        if (i) ctx.lineTo(xx, yy);
        else ctx.moveTo(xx, yy);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();

  /* ---------------- nama garis ---------------- */

  const berlabel = (s.lines ?? [])
    .filter((l) => l.label && l.pts.length >= 2)
    .map((l) => {
      const f = Math.min(Math.max(l.labelAt ?? 0.6, 0), 1);
      const i = Math.min(
        l.pts.length - 1,
        Math.max(0, Math.round(f * (l.pts.length - 1)))
      );
      return { l, p: l.pts[i] };
    })
    .filter(({ p }) => didalam(p.x, p.y))
    .sort((a, b) => Y(a.p.y) - Y(b.p.y));

  for (const { l, p } of berlabel)
    taruh.write(l.label as string, X(p.x), Y(p.y) + (l.labelDy ?? -10), l.color ?? C.water, {
      align: l.labelAlign ?? "center",
    });

  /* ---------------- nama bidang berwarna ---------------- */

  for (const p of s.patches ?? []) {
    if (!p.label || p.pts.length < 3) continue;
    const cx = p.pts.reduce((a, q) => a + q.x, 0) / p.pts.length;
    const cy = p.pts.reduce((a, q) => a + q.y, 0) / p.pts.length;
    if (!didalam(cx, cy)) continue;
    taruh.write(p.label, X(cx), Y(cy), p.color ?? C.critical, {});
  }

  /* ---------------- nama wilayah ---------------- */

  for (const g of s.regions ?? []) {
    if (!didalam(g.x, g.y)) continue;
    taruh.write(g.text, X(g.x), Y(g.y), g.color ?? C.ink3, { big: g.big });
  }

  /* ---------------- nama keadaan ---------------- */

  if (s.heading)
    taruh.write(s.heading, padL + plotW / 2, padT + 24, s.headingColor ?? C.ink, {
      big: true,
    });

  /* ---------------- bingkai ---------------- */

  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(padL) + 0.5,
    Math.round(padT) + 0.5,
    Math.round(plotW),
    Math.round(plotH)
  );
}

/**
 * Satu panah, arah bebas.
 *
 * Kepalanya digambar dari sudut batangnya sendiri. Panah yang terlalu
 * pendek digambar tanpa kepala, karena kepala yang lebih panjang daripada
 * batangnya menjadi tanda yang menyesatkan besarnya.
 */
function panah(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  dx: number,
  dy: number,
  color: string,
  weight: number,
  hanyaKepala = false
) {
  const panjang = Math.hypot(dx, dy);
  if (panjang < 0.5) return;
  const sudut = Math.atan2(dy, dx);
  const x1 = x0 + dx;
  const y1 = y0 + dy;
  const kepala = Math.min(6, panjang * 0.4);

  pen(ctx, weight, color);
  ctx.beginPath();
  if (!hanyaKepala) {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  }
  ctx.moveTo(x1, y1);
  ctx.lineTo(
    x1 - kepala * Math.cos(sudut - 0.4),
    y1 - kepala * Math.sin(sudut - 0.4)
  );
  ctx.moveTo(x1, y1);
  ctx.lineTo(
    x1 - kepala * Math.cos(sudut + 0.4),
    y1 - kepala * Math.sin(sudut + 0.4)
  );
  ctx.stroke();
}
