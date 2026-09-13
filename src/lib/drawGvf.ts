import { C, DASH, F, W, stencil } from "./theme";
import {
  axisTitle,
  axisValue,
  clampLabelX,
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
import type { GvfResult } from "./hydraulics";
import { cl } from "./strings";
import type { Lang } from "./i18n";
import { fmtPlain } from "./hydraulics";

export type GvfDrawState = {
  result: GvfResult;
  /** Panjang bentang yang digambar, meter */
  length: number;
  S0: number;
  /**
   * Benar bila saluran tidak sanggup mengalirkan debit ini berapa pun dalamnya.
   *
   * Tanpa kedalaman normal, tidak ada profil yang dapat ditelusuri: penyebut
   * persamaannya kehilangan acuan dan penelusurannya menghasilkan angka yang
   * tidak berarti apa pun. Dalam keadaan itu lembar ini TIDAK menggambar muka
   * air sama sekali, melainkan menyatakan bahwa profilnya tidak dapat dihitung.
   */
  normalUnreachable?: boolean;
};

/**
 * POTONGAN MEMANJANG — profil aliran berubah lambat.
 *
 * Dasar saluran digambar miring sesuai S0, dan kedalaman diukur tegak
 * dari dasar itu. Skala tegak dilebihkan terhadap skala mendatar, seperti
 * lazimnya profil memanjang saluran; angka pelebihannya dicantumkan di
 * kop gambar agar tidak menyesatkan.
 *
 * Bagian profil yang mendekati kedalaman kritis digambar titik rapat:
 * di situ penyebut (1 − Fr²) menuju nol dan persamaan berubah lambat
 * kehilangan keberlakuannya.
 */
export function drawGvf(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: GvfDrawState,
  lang: Lang
) {
  const T = cl(lang);
  const { result: r, length: L, S0 } = s;

  const padL = 62;
  const padR = 34;
  const padT = 28;
  const padB = 52;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = Math.max(10, h - padT - padB);

  const zb = (x: number) => (L - x) * S0;
  const zbMax = zb(0);

  const takAda = s.normalUnreachable === true;

  // Kedalaman di penampang kendali adalah satu-satunya kedalaman yang tetap
  // berarti saat kedalaman normal tidak ada, karena ia masukan pengguna dan
  // bukan hasil penelusuran.
  const ctrl = r.direction === "hulu" ? r.points[r.points.length - 1] : r.points[0];

  const maxSurface = takAda
    ? zbMax + Math.max(r.yc, ctrl.y) * 1.7
    : r.points.reduce((m, p) => Math.max(m, zb(p.x) + p.y), zbMax + r.yc);

  // Kedalaman normal sengaja tidak ikut menentukan skala saat ia tidak ada,
  // sebab angkanya hanyalah batas atas pencarian dan akan menggepengkan
  // seluruh gambar.
  const zTop = (takAda ? maxSurface : Math.max(maxSurface, zbMax + r.y0)) * 1.12;

  const X = (x: number) => padL + (x / L) * plotW;
  const Z = (z: number) => padT + plotH - (z / zTop) * plotH;

  /*
   * Label kedalaman normal dan kritis dijauhkan dari penampang kendali.
   *
   * Kendali aliran subkritis berada di ujung hilir, kendali aliran superkritis
   * di ujung hulu, dan dimensi kedalamannya berdiri tegak di situ. Label yang
   * dipatok di satu tempat tetap akan bertumpuk dengan dimensi itu pada salah
   * satu dari dua keadaan.
   */
  const xLabel = r.direction === "hilir" ? L * 0.62 : L * 0.06;

  ground(ctx, w, h);

  /* ---------------- kisi ---------------- */
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

  for (let v = 0; v <= zTop + 1e-9; v += zStep)
    axisValue(ctx, fmtPlain(v, 1), padL - 8, Z(v), "right", "middle");
  for (let x = 0; x <= L + 1e-9; x += xStep)
    axisValue(ctx, String(Math.round(x)), X(x), padT + plotH + 9, "center", "top");

  axisTitle(ctx, T.axDistance, padL + plotW / 2, padT + plotH + 34);
  axisTitle(ctx, T.elevation, 18, padT + plotH / 2, -Math.PI / 2);

  /* ---------------- badan air ---------------- */
  if (!takAda) {
  const clipWater = () => {
    ctx.beginPath();
    ctx.moveTo(X(r.points[0].x), Z(zb(r.points[0].x)));
    for (const p of r.points) ctx.lineTo(X(p.x), Z(zb(p.x) + p.y));
    for (let i = r.points.length - 1; i >= 0; i--)
      ctx.lineTo(X(r.points[i].x), Z(zb(r.points[i].x)));
    ctx.closePath();
  };

  ctx.save();
  clipWater();
  ctx.fillStyle = C.waterFill;
  ctx.fill();
  ctx.restore();

  hatchWater(ctx, clipWater, padL, padL + plotW, padT + 4, padT + plotH, 10);

  /* ---------------- garis kedalaman normal dan kritis ---------------- */
  pen(ctx, W.thin, C.water, DASH.hidden);
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) {
    const x = (i / 80) * L;
    const z = Z(zb(x) + r.y0);
    i ? ctx.lineTo(X(x), z) : ctx.moveTo(X(x), z);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  curveLabel(ctx, `y₀ ${fmtPlain(r.y0, 2)} m`, X(xLabel), Z(zb(xLabel) + r.y0) - 10, C.water);
  }

  pen(ctx, W.thin, C.critical, DASH.axis);
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) {
    const x = (i / 80) * L;
    const z = Z(zb(x) + r.yc);
    i ? ctx.lineTo(X(x), z) : ctx.moveTo(X(x), z);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  curveLabel(
    ctx,
    `yc ${fmtPlain(r.yc, 2)} m`,
    X(xLabel),
    Z(zb(xLabel) + r.yc) + 11,
    C.critical
  );

  /* ---------------- muka air ---------------- */
  /* Ruas yang muka airnya masih landai digambar menerus; ruas yang sudah
     terlalu curam untuk disebut berubah lambat digambar titik rapat.
     Penandanya kecuraman muka air, bukan kedekatan dengan kondisi kritis:
     jendela di sekitar kritis dilewati dalam kurang dari satu meter saluran,
     sehingga tidak pernah cukup panjang untuk digambar sebagai garis. */
  if (!takAda) {
  let run: { pts: [number, number][]; invalid: boolean } | null = null;
  const flush = () => {
    if (!run || run.pts.length < 2) return;
    pen(
      ctx,
      run.invalid ? W.thin : W.bold,
      C.water,
      run.invalid ? DASH.invalid : DASH.solid
    );
    ctx.beginPath();
    run.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.setLineDash([]);
  };

  for (const p of r.points) {
    const pt: [number, number] = [X(p.x), Z(zb(p.x) + p.y)];
    if (!run || run.invalid !== p.rapid) {
      if (run) {
        run.pts.push(pt);
        flush();
      }
      run = { pts: [pt], invalid: p.rapid };
    } else {
      run.pts.push(pt);
    }
  }
  flush();
  }

  /* ---------------- dasar saluran ---------------- */
  const bedPts: [number, number][] = [];
  for (let i = 0; i <= 60; i++) {
    const x = (i / 60) * L;
    bedPts.push([X(x), Z(zb(x))]);
  }
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bedPts[0][0], bedPts[0][1]);
  for (const [x, y] of bedPts) ctx.lineTo(x, y);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.lineTo(padL, padT + plotH);
  ctx.closePath();
  ctx.clip();
  hatchConcrete(ctx, padL, padT, plotW, plotH);
  ctx.restore();

  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  bedPts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();

  /* ---------------- penampang kendali ---------------- */
  const cxp = X(ctrl.x);
  pen(ctx, W.thin, C.signal, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(cxp, padT);
  ctx.lineTo(cxp, Z(zb(ctrl.x)));
  ctx.stroke();
  ctx.setLineDash([]);

  dimV(
    ctx,
    cxp + (r.direction === "hulu" ? -26 : 26),
    Z(zb(ctrl.x) + ctrl.y),
    Z(zb(ctrl.x)),
    `${fmtPlain(ctrl.y, 2)} m`,
    C.signal
  );
  region(
    ctx,
    T.control,
    clampLabelX(ctx, T.control, cxp, padL, padL + plotW),
    padT + 12,
    C.signal
  );

  /* ---------------- ujung profil ---------------- */
  /*
   * Profil yang berhenti karena mencapai kedalaman kritis hampir selalu jauh
   * lebih pendek daripada bentang yang digambar. Tanpa penanda, sisa bidang
   * yang kosong terbaca sebagai gambar yang gagal, padahal justru itu
   * jawabannya: profilnya memang sependek itu.
   */
  if (!takAda && r.endsAtCritical) {
    const urutX = [...r.points].sort((a, c) => a.x - c.x);
    const ujung = r.direction === "hulu" ? urutX[0] : urutX[urutX.length - 1];
    const xp = X(ujung.x);
    pen(ctx, W.thin, C.signal, DASH.axis);
    ctx.beginPath();
    ctx.moveTo(xp, padT + 26);
    ctx.lineTo(xp, Z(zb(ujung.x)));
    ctx.stroke();
    ctx.setLineDash([]);
    region(
      ctx,
      T.profileEnds,
      clampLabelX(ctx, T.profileEnds, xp, padL, padL + plotW),
      padT + 32,
      C.signal
    );
  }

  /* ---------------- ruas yang terlalu pendek untuk digambar ---------------- */
  /*
   * Bila ruas berubah cepat lebih sempit daripada beberapa piksel, ia tidak
   * dapat dibaca sebagai garis titik-titik dan akan hilang begitu saja. Dalam
   * keadaan itu ia ditandai sebagai satu penampang, supaya pembaca tetap
   * diberitahu bahwa ada tempat di mana persamaannya kehilangan keberlakuan.
   */
  //
  // Dilewati bila ujung profil sudah ditandai, karena pada profil yang berakhir
  // di kedalaman kritis kedua penanda menunjuk tempat yang praktis sama dan
  // tulisannya bertumpuk.
  if (!takAda && !r.endsAtCritical && r.rvf) {
    const lebarPiksel = X(r.rvf.to) - X(r.rvf.from);
    if (lebarPiksel < 8) {
      const xr = (r.rvf.from + r.rvf.to) / 2;
      const xp = X(xr);
      pen(ctx, W.thin, C.signal, DASH.invalid);
      ctx.beginPath();
      ctx.moveTo(xp, padT + 26);
      ctx.lineTo(xp, Z(zb(xr)));
      ctx.stroke();
      ctx.setLineDash([]);
      region(
        ctx,
        T.rapidlyVaried,
        clampLabelX(ctx, T.rapidlyVaried, xp, padL, padL + plotW),
        padT + 32,
        C.signal
      );
    }
  }

  /* ---------------- nama profil ---------------- */
  if (takAda) {
    // Tanpa kedalaman normal tidak ada profil untuk dinamai. Yang ditulis di
    // tengah bidang justru pengakuan bahwa ia tidak dapat dihitung, supaya
    // bidang yang kosong tidak terbaca sebagai gambar yang belum selesai.
    ctx.fillStyle = C.signal;
    ctx.font = F.heading;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    stencil(ctx, T.noProfile, padL + plotW / 2, padT + plotH * 0.42, 2);
    region(
      ctx,
      T.noNormalDepth,
      padL + plotW / 2,
      padT + plotH * 0.42 + 20,
      C.ink3
    );
  } else {
    const mid = r.points[Math.floor(r.points.length / 2)];
    ctx.fillStyle = C.ink;
    ctx.font = F.heading;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    stencil(ctx, r.profile, X(mid.x), Z(zb(mid.x) + mid.y) - 16, 2);

    /*
     * Regime aliran ditentukan kedalaman terhadap kedalaman kritis, BUKAN oleh
     * jenis kemiringan salurannya.
     *
     * Keduanya sering berbarengan sehingga mudah tertukar, tetapi tidak selalu:
     * profil M3 mengalir superkritis di atas saluran landai, dan profil S1
     * mengalir subkritis di atas saluran curam. Sebelumnya yang dibaca jenis
     * kemiringan, sehingga M3 diberi label subkritis.
     */
    region(
      ctx,
      mid.y > r.yc ? T.subcritical : T.supercritical,
      X(mid.x),
      Z(zb(mid.x) + mid.y) - 34,
      C.ink3
    );
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
