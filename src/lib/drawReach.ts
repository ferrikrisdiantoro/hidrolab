import { C, DASH, F, W, stencil } from "./theme";
import {
  axisTitle,
  axisValue,
  curveLabel,
  dimV,
  ground,
  hatchConcrete,
  hatchWater,
  niceStep,
  pen,
  region,
  ruling,
} from "./plate";

export type ReachPoint = {
  /** Jarak dari ujung hulu, meter */
  x: number;
  /** Elevasi terhadap datum, meter */
  z: number;
  /** Digambar titik rapat: di luar rentang keberlakuan rumus */
  invalid?: boolean;
};

export type ReachSeries = {
  pts: ReachPoint[];
  color: string;
  weight: number;
  dash?: readonly number[];
  label?: string;
  /** Letak label sebagai pecahan panjang deret, 0 di hulu dan 1 di hilir */
  labelAt?: number;
  labelAlign?: CanvasTextAlign;
  /** Geseran tegak label, piksel */
  labelDy?: number;
};

export type ReachMarker = {
  x: number;
  label: string;
  color: string;
  /** Batas bawah garis penampang, dalam elevasi */
  zBottom?: number;
  dim?: { zTop: number; zBottom: number; text: string; side?: 1 | -1 };
};

export type ReachRegion = {
  x: number;
  z: number;
  text: string;
  color?: string;
  /** Ditulis besar; dipakai untuk nama profil */
  big?: boolean;
};

export type ReachState = {
  /** Panjang bentang yang digambar, meter */
  length: number;
  /** Dasar saluran. Wajib membentang penuh dari nol sampai panjang. */
  bed: ReachPoint[];
  /** Muka air. Loncatan digambar sebagai dua titik pada absis yang sama. */
  water: ReachPoint[];
  series?: ReachSeries[];
  markers?: ReachMarker[];
  regions?: ReachRegion[];
  axisX: string;
  axisZ: string;
  /** Batas atas sumbu tegak; dihitung sendiri bila tidak diberikan */
  zTop?: number;
};

/**
 * POTONGAN MEMANJANG, penggambar bersama untuk seluruh lembar yang berbicara
 * tentang apa yang terjadi di sepanjang sebuah saluran.
 *
 * Yang dikerjakan di sini hanya urusan lembar gambar: skala, kisi, arsiran,
 * bobot garis, dimensi, dan penamaan wilayah. Seluruh fisikanya sudah selesai
 * sebelum masuk ke sini dan datang sebagai deretan titik. Pemisahan itu
 * disengaja: satu penggambar bisa melayani banyak lembar justru karena ia tidak
 * tahu apa-apa tentang persoalan yang sedang digambar.
 *
 * Skala tegak selalu lebih besar daripada skala mendatar, seperti lazimnya
 * profil memanjang saluran. Angka pelebihannya wajib dicantumkan pada kop
 * gambar oleh lembar yang memakai penggambar ini, karena gambar yang skalanya
 * berbeda di dua arah dan tidak mengaku demikian adalah gambar yang menyesatkan.
 */
export function drawReach(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: ReachState
) {
  const padL = 62;
  const padR = 34;
  const padT = 28;
  const padB = 52;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = Math.max(10, h - padT - padB);
  const L = s.length;

  const semua = [
    ...s.bed,
    ...s.water,
    ...(s.series ?? []).flatMap((d) => d.pts),
  ];
  const zMax = semua.reduce((m, p) => Math.max(m, p.z), 0);
  const zTop = s.zTop ?? Math.max(zMax * 1.12, 1e-3);

  const X = (x: number) => padL + (x / L) * plotW;
  const Z = (z: number) => padT + plotH - (z / zTop) * plotH;

  ground(ctx, w, h);

  /* ---------------- kisi dan sumbu ---------------- */
  const zStep = niceStep(zTop, 5);
  const xStep = niceStep(L, 6);
  const hs: number[] = [];
  const vs: number[] = [];
  for (let v = 0; v <= zTop + 1e-9; v += zStep) hs.push(Z(v));
  for (let x = 0; x <= L + 1e-9; x += xStep) vs.push(X(x));
  ruling(ctx, padL, padT, padL + plotW, padT + plotH, {
    horizontal: hs,
    vertical: vs,
  });

  const zDigits = zStep < 0.1 ? 2 : zStep < 1 ? 1 : 0;
  for (let v = 0; v <= zTop + 1e-9; v += zStep)
    axisValue(ctx, v.toFixed(zDigits), padL - 8, Z(v), "right", "middle");
  for (let x = 0; x <= L + 1e-9; x += xStep)
    axisValue(
      ctx,
      String(Math.round(x)),
      X(x),
      padT + plotH + 9,
      "center",
      "top"
    );

  axisTitle(ctx, s.axisX, padL + plotW / 2, padT + plotH + 34);
  axisTitle(ctx, s.axisZ, 18, padT + plotH / 2, -Math.PI / 2);

  /* ---------------- badan air ----------------
     Dibentuk dengan menyusuri muka air ke hilir lalu dasar kembali ke hulu.
     Loncatan air menghasilkan sisi tegak, dan itu memang bentuk yang benar. */
  const bedTerurut = [...s.bed].sort((a, b) => a.x - b.x);
  const airAwal = s.water[0].x;
  const airAkhir = s.water[s.water.length - 1].x;

  const jalurAir = () => {
    ctx.beginPath();
    s.water.forEach((p, i) =>
      i ? ctx.lineTo(X(p.x), Z(p.z)) : ctx.moveTo(X(p.x), Z(p.z))
    );
    for (let i = bedTerurut.length - 1; i >= 0; i--) {
      const p = bedTerurut[i];
      if (p.x > airAkhir + 1e-9 || p.x < airAwal - 1e-9) continue;
      ctx.lineTo(X(p.x), Z(p.z));
    }
    ctx.closePath();
  };

  ctx.save();
  jalurAir();
  ctx.fillStyle = C.waterFill;
  ctx.fill();
  ctx.restore();

  hatchWater(ctx, jalurAir, padL, padL + plotW, padT + 4, padT + plotH, 10);

  /* ---------------- garis tambahan ---------------- */
  for (const d of s.series ?? []) {
    if (d.pts.length < 2) continue;
    pen(ctx, d.weight, d.color, d.dash ?? DASH.solid);
    ctx.beginPath();
    d.pts.forEach((p, i) =>
      i ? ctx.lineTo(X(p.x), Z(p.z)) : ctx.moveTo(X(p.x), Z(p.z))
    );
    ctx.stroke();
    ctx.setLineDash([]);

    if (d.label) {
      const i = Math.min(
        d.pts.length - 1,
        Math.max(0, Math.round((d.labelAt ?? 0.08) * (d.pts.length - 1)))
      );
      curveLabel(
        ctx,
        d.label,
        X(d.pts[i].x),
        Z(d.pts[i].z) + (d.labelDy ?? -10),
        d.color,
        d.labelAlign ?? "left"
      );
    }
  }

  /* ---------------- muka air ----------------
     Ruas di luar rentang keberlakuan digambar titik rapat dan tipis, supaya
     gambar mengaku tidak tahu alih-alih berpura-pura tahu. */
  let jalan: { pts: [number, number][]; invalid: boolean } | null = null;
  const tuang = () => {
    if (!jalan || jalan.pts.length < 2) return;
    pen(
      ctx,
      jalan.invalid ? W.thin : W.bold,
      C.water,
      jalan.invalid ? DASH.invalid : DASH.solid
    );
    ctx.beginPath();
    jalan.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  for (const p of s.water) {
    const titik: [number, number] = [X(p.x), Z(p.z)];
    const buruk = p.invalid === true;
    if (!jalan || jalan.invalid !== buruk) {
      if (jalan) {
        jalan.pts.push(titik);
        tuang();
      }
      jalan = { pts: [titik], invalid: buruk };
    } else {
      jalan.pts.push(titik);
    }
  }
  tuang();

  /* ---------------- dasar saluran ---------------- */
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(X(bedTerurut[0].x), Z(bedTerurut[0].z));
  for (const p of bedTerurut) ctx.lineTo(X(p.x), Z(p.z));
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.lineTo(padL, padT + plotH);
  ctx.closePath();
  ctx.clip();
  hatchConcrete(ctx, padL, padT, plotW, plotH);
  ctx.restore();

  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  bedTerurut.forEach((p, i) =>
    i ? ctx.lineTo(X(p.x), Z(p.z)) : ctx.moveTo(X(p.x), Z(p.z))
  );
  ctx.stroke();

  /* ---------------- penampang bertanda ---------------- */
  for (const m of s.markers ?? []) {
    const xp = X(m.x);
    pen(ctx, W.thin, m.color, DASH.axis);
    ctx.beginPath();
    ctx.moveTo(xp, padT);
    ctx.lineTo(xp, Z(m.zBottom ?? 0));
    ctx.stroke();
    ctx.setLineDash([]);
    region(ctx, m.label, xp, padT + 12, m.color);

    if (m.dim) {
      dimV(
        ctx,
        xp + (m.dim.side ?? 1) * 26,
        Z(m.dim.zTop),
        Z(m.dim.zBottom),
        m.dim.text,
        m.color
      );
    }
  }

  /* ---------------- nama wilayah ---------------- */
  for (const g of s.regions ?? []) {
    if (g.big) {
      ctx.fillStyle = g.color ?? C.ink;
      ctx.font = F.heading;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      stencil(ctx, g.text, X(g.x), Z(g.z), 2);
    } else {
      region(ctx, g.text, X(g.x), Z(g.z), g.color ?? C.ink3);
    }
  }

  /* ---------------- bingkai ---------------- */
  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(padL) + 0.5,
    Math.round(padT) + 0.5,
    Math.round(plotW),
    Math.round(plotH)
  );
}
