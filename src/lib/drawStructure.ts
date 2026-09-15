import { C, DASH, F, W } from "./theme";
import {
  axisTitle,
  axisValue,
  createLabelPlacer,
  dimH,
  dimV,
  ground,
  hatchConcrete,
  hatchRock,
  hatchSoil,
  hatchWater,
  imperviousBase,
  leader,
  niceStep,
  pen,
  ruling,
} from "./plate";
import { fmtPlain } from "./hydraulics";
import { cl } from "./strings";
import type { Lang } from "./i18n";

/**
 * PENGGAMBAR POTONGAN MELINTANG — keluarga D, lalu keluarga G.
 *
 * Dua belas lembar memakai bentuk yang sama: satu potongan melintang bangunan
 * beton dengan air di kedua sisinya, satu atau beberapa garis muka air dan
 * garis energi, dimensi tegak dan mendatar, serta nama bagian yang ditunjuk
 * garis penunjuk. Yang berbeda antar lembar hanya bentuk bangunannya, jadi
 * seluruh bagian itu ditarik ke satu berkas dan tiap lembar cukup menyusun
 * poligon badannya.
 *
 * Bedanya dengan penggambar potongan memanjang keluarga A: di sana yang
 * digambar SALURAN sepanjang kilometer dengan dasar yang hampir datar, di
 * sini yang digambar BANGUNAN sepanjang beberapa meter dengan bentuk yang
 * justru menjadi pokoknya. Skalanya karena itu sama di kedua sumbu kecuali
 * diminta lain, supaya bentuk ogee dan kemiringan dinding terbaca apa adanya.
 *
 * Pekan ketiga menambahkan tiga lembar air tanah dan geoteknik ke berkas yang
 * sama alih-alih menulis penggambar keempat. Yang dituntut ketiganya ternyata
 * hanya empat hal yang belum ada di sini: arsiran tanah dan batu di samping
 * arsiran beton, skala yang boleh berbeda di kedua sumbu untuk akuifer yang
 * lebarnya ratusan meter sedangkan tebalnya puluhan, panah yang boleh miring,
 * dan panah gaya yang membawa namanya sendiri. Keempatnya ditambahkan sebagai
 * pilihan dengan bawaan yang sama persis dengan sebelumnya, jadi sembilan
 * lembar keluarga D tidak berubah satu piksel pun.
 */

/** Satu bidang pejal, misalnya badan bendung atau dinding gorong-gorong. */
export type StructureBody = {
  /** Titik sudut searah jarum jam, dalam meter */
  pts: { x: number; z: number }[];
  /** Diarsir beton bila benar, dibiarkan kosong bila salah */
  hatched?: boolean;
  /** Jenis arsirannya. Bawaannya beton, sesuai sembilan lembar pertama */
  hatch?: "concrete" | "soil" | "rock" | "none";
  color?: string;
  /** Garis tepinya tidak digambar bila salah, untuk lapisan yang menyatu */
  outline?: boolean;
};

/** Genangan air, digambar dengan arsiran air mendatar. */
export type StructureWater = {
  /** Muka air atas, dalam meter */
  surface: { x: number; z: number }[];
  /** Dasar genangan; bila kosong dipakai dasar bidang */
  bed?: { x: number; z: number }[];
  /** Digambar titik rapat bila keadaannya di luar rentang keberlakuan */
  invalid?: boolean;
};

/** Garis tambahan: garis energi, mercu, muka air alternatif. */
export type StructureLine = {
  pts: { x: number; z: number }[];
  color?: string;
  weight?: number;
  dash?: readonly number[];
  label?: string;
  /** Letak label sepanjang deret, 0 di awal dan 1 di akhir */
  labelAt?: number;
  labelDy?: number;
  labelAlign?: CanvasTextAlign;
};

/** Dimensi tegak atau mendatar dengan angkanya. */
export type StructureDim = {
  axis: "v" | "h";
  /** Untuk dimensi tegak: absis garisnya. Untuk mendatar: ordinatnya. */
  at: number;
  from: number;
  to: number;
  text: string;
  color?: string;
  /** Geseran garis dimensi dalam piksel, menjauhi bendanya */
  offset?: number;
};

/** Nama bagian yang ditunjuk garis penunjuk dari satu titik. */
export type StructureCallout = {
  x: number;
  z: number;
  /** Arah penunjuk dalam piksel dari titiknya */
  dx: number;
  dy: number;
  text: string;
  color?: string;
};

/** Panah arah aliran. */
export type StructureArrow = {
  x: number;
  z: number;
  /** Panjang mendatar dalam piksel; negatif berarti ke kiri */
  length: number;
  /** Panjang tegak dalam piksel; negatif berarti ke atas. Bawaannya nol */
  rise?: number;
  color?: string;
};

/**
 * Panah gaya beserta namanya.
 *
 * Bedanya dengan panah aliran: panah aliran menyatakan ARAH saja, panah gaya
 * menyatakan arah dan besar sekaligus, jadi panjangnya membawa data dan harus
 * diskalakan oleh lembarnya sendiri terhadap gaya terbesar di situ.
 */
export type StructureVector = {
  x: number;
  z: number;
  /** Komponen dalam piksel, diukur dari pangkalnya */
  dx: number;
  dy: number;
  text?: string;
  color?: string;
  /** Pangkalnya diberi bulatan kecil bila benar, menandai titik tangkapnya */
  root?: boolean;
};

export type StructureSpec = {
  /** Batas bidang dalam meter */
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
  bodies: StructureBody[];
  waters?: StructureWater[];
  lines?: StructureLine[];
  dims?: StructureDim[];
  callouts?: StructureCallout[];
  arrows?: StructureArrow[];
  vectors?: StructureVector[];
  /**
   * Skala yang sama di kedua sumbu. Bawaannya benar, karena sembilan lembar
   * pertama menggambar bangunan yang bentuknya justru menjadi pokoknya.
   * Dimatikan pada lembar akuifer, yang lebarnya ratusan meter sedangkan
   * tebalnya puluhan: memaksakan skala yang sama di situ menyisakan bidang
   * setinggi beberapa piksel dan tidak ada yang terbaca.
   */
  equalScale?: boolean;
  /** Garis kedap di dasar bidang, tanda batas yang tidak dapat ditembus air */
  imperviousFloor?: boolean;
  /** Nama wilayah besar, menyatakan keadaan yang sedang digambar */
  heading?: string;
  headingColor?: string;
  axisX: string;
  axisZ: string;
};

export function drawStructure(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: StructureSpec,
  lang: Lang
) {
  const T = cl(lang);
  ground(ctx, w, h);

  const padL = 58;
  const padR = 26;
  const padT = 26;
  const padB = 52;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = Math.max(10, h - padT - padB);

  /* ---------------- pemetaan ----------------
     Skala dijaga sama di kedua sumbu, lalu bidangnya dipusatkan. Bentuk ogee
     dan kemiringan dinding adalah pokok lembar-lembar ini, dan skala yang
     berbeda di kedua sumbu akan mengubah bentuk itu menjadi bentuk lain. */

  const spanX = Math.max(s.xMax - s.xMin, 1e-9);
  const spanZ = Math.max(s.zMax - s.zMin, 1e-9);
  const sama = s.equalScale !== false;
  const skalaX = sama ? Math.min(plotW / spanX, plotH / spanZ) : plotW / spanX;
  const skalaZ = sama ? skalaX : plotH / spanZ;
  const lebarPakai = spanX * skalaX;
  const tinggiPakai = spanZ * skalaZ;
  const ox = padL + (plotW - lebarPakai) / 2;
  const oy = padT + (plotH - tinggiPakai) / 2;

  const X = (x: number) => ox + (x - s.xMin) * skalaX;
  const Z = (z: number) => oy + tinggiPakai - (z - s.zMin) * skalaZ;

  /* ---------------- kisi dan angka sumbu ---------------- */

  const xStep = niceStep(spanX, 6);
  const zStep = niceStep(spanZ, 5);
  const xs: number[] = [];
  const zs: number[] = [];
  for (let v = Math.ceil(s.xMin / xStep) * xStep; v <= s.xMax + 1e-9; v += xStep)
    xs.push(v);
  for (let v = Math.ceil(s.zMin / zStep) * zStep; v <= s.zMax + 1e-9; v += zStep)
    zs.push(v);

  ruling(ctx, padL, padT, padL + plotW, padT + plotH, {
    horizontal: zs.map(Z),
    vertical: xs.map(X),
  });

  const desimal = (step: number) =>
    step >= 10 ? 0 : step >= 1 ? 1 : step >= 0.1 ? 2 : 3;
  for (const v of xs)
    axisValue(ctx, fmtPlain(v, desimal(xStep)), X(v), padT + plotH + 9, "center", "top");
  for (const v of zs)
    axisValue(ctx, fmtPlain(v, desimal(zStep)), padL - 8, Z(v), "right", "middle");

  axisTitle(ctx, s.axisX, padL + plotW / 2, padT + plotH + 34);
  axisTitle(ctx, s.axisZ, 16, padT + plotH / 2, -Math.PI / 2);

  const taruh = createLabelPlacer(ctx, { padL, padT, plotW, plotH });

  /* ---------------- genangan air ----------------
     Digambar sebelum badan bangunan, supaya beton selalu berada di atas air
     dan bukan sebaliknya. */

  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, padT, plotW, plotH);
  ctx.clip();

  for (const a of s.waters ?? []) {
    if (a.surface.length < 2) continue;
    const dasar = a.bed ?? [
      { x: a.surface[a.surface.length - 1].x, z: s.zMin },
      { x: a.surface[0].x, z: s.zMin },
    ];

    const jalur = () => {
      ctx.beginPath();
      a.surface.forEach((p, i) =>
        i ? ctx.lineTo(X(p.x), Z(p.z)) : ctx.moveTo(X(p.x), Z(p.z))
      );
      for (let i = dasar.length - 1; i >= 0; i--)
        ctx.lineTo(X(dasar[i].x), Z(dasar[i].z));
      ctx.closePath();
    };

    ctx.save();
    jalur();
    ctx.fillStyle = C.waterFill;
    ctx.fill();
    ctx.restore();

    const zTertinggi = a.surface.reduce((m, p) => Math.max(m, p.z), -Infinity);
    hatchWater(ctx, jalur, padL, padL + plotW, Z(zTertinggi), padT + plotH, 10);

    pen(
      ctx,
      a.invalid ? W.thin : W.bold,
      a.invalid ? C.signal : C.water,
      a.invalid ? DASH.invalid : DASH.solid
    );
    ctx.beginPath();
    a.surface.forEach((p, i) =>
      i ? ctx.lineTo(X(p.x), Z(p.z)) : ctx.moveTo(X(p.x), Z(p.z))
    );
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* ---------------- badan bangunan ---------------- */

  for (const b of s.bodies) {
    if (b.pts.length < 3) continue;
    const jalur = () => {
      ctx.beginPath();
      b.pts.forEach((p, i) =>
        i ? ctx.lineTo(X(p.x), Z(p.z)) : ctx.moveTo(X(p.x), Z(p.z))
      );
      ctx.closePath();
    };

    const jenis: NonNullable<StructureBody["hatch"]> =
      b.hatch ?? (b.hatched === false ? "none" : "concrete");

    ctx.save();
    jalur();
    ctx.fillStyle = C.sheet;
    ctx.fill();
    if (jenis !== "none") {
      ctx.clip();
      const xs2 = b.pts.map((p) => X(p.x));
      const zs2 = b.pts.map((p) => Z(p.z));
      const bx = Math.min(...xs2);
      const bz = Math.min(...zs2);
      const bw = Math.max(...xs2) - bx;
      const bh = Math.max(...zs2) - bz;
      if (jenis === "concrete") hatchConcrete(ctx, bx, bz, bw, bh, 6);
      else if (jenis === "soil") hatchSoil(ctx, bx, bz, bw, bh, 9);
      else hatchRock(ctx, bx, bz, bw, bh, 13);
    }
    ctx.restore();

    if (b.outline !== false) {
      pen(ctx, W.bold, b.color ?? C.ink);
      jalur();
      ctx.stroke();
    }
  }

  /* ---------------- panah aliran ---------------- */

  for (const a of s.arrows ?? []) {
    panah(ctx, X(a.x), Z(a.z), a.length, a.rise ?? 0, a.color ?? C.water, W.thin);
  }

  ctx.restore();

  /* ---------------- garis tambahan ---------------- */

  for (const l of s.lines ?? []) {
    if (l.pts.length < 2) continue;
    pen(ctx, l.weight ?? W.thin, l.color ?? C.energy, l.dash ?? DASH.hidden);
    ctx.beginPath();
    l.pts.forEach((p, i) =>
      i ? ctx.lineTo(X(p.x), Z(p.z)) : ctx.moveTo(X(p.x), Z(p.z))
    );
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* ---------------- dimensi ---------------- */

  for (const d of s.dims ?? []) {
    const geser = d.offset ?? 0;
    if (d.axis === "v") {
      dimV(ctx, X(d.at) + geser, Z(d.from), Z(d.to), d.text, d.color ?? C.ink);
    } else {
      dimH(ctx, Z(d.at) + geser, X(d.from), X(d.to), d.text, d.color ?? C.ink);
    }
  }

  /* ---------------- panah gaya ---------------- */

  for (const v of s.vectors ?? []) {
    const x0 = X(v.x);
    const y0 = Z(v.z);
    const warna = v.color ?? C.energy;
    panah(ctx, x0, y0, v.dx, v.dy, warna, W.bold);
    if (v.root) {
      pen(ctx, W.thin, warna);
      ctx.beginPath();
      ctx.arc(x0, y0, 2.4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /* ---------------- nama bagian ---------------- */

  for (const c of s.callouts ?? []) {
    leader(
      ctx,
      X(c.x),
      Z(c.z),
      X(c.x) + c.dx,
      Z(c.z) + c.dy,
      c.text,
      c.color ?? C.ink2
    );
  }

  /* ---------------- nama gaya ----------------
     Ditulis sesudah seluruh panah digambar, dengan alas kertas, karena panah
     gaya pada lembar stabilitas saling berpotongan rapat. */

  for (const v of s.vectors ?? []) {
    if (!v.text) continue;
    const ux = X(v.x) + v.dx;
    const uy = Z(v.z) + v.dy;
    taruh.write(
      v.text,
      ux + Math.sign(v.dx) * 4,
      uy + (v.dy < 0 ? -6 : 10),
      v.color ?? C.energy,
      { align: v.dx < -1 ? "right" : v.dx > 1 ? "left" : "center" }
    );
  }

  /* ---------------- label garis ----------------
     Ditempatkan sesudah seluruh garis digambar, supaya tidak ada garis yang
     melintas di atas tulisan yang sudah diberi alas. */

  for (const l of s.lines ?? []) {
    if (!l.label || l.pts.length < 2) continue;
    const f = Math.min(Math.max(l.labelAt ?? 0.5, 0), 1);
    const i = Math.min(
      l.pts.length - 1,
      Math.max(0, Math.round(f * (l.pts.length - 1)))
    );
    const p = l.pts[i];
    taruh.write(l.label, X(p.x), Z(p.z) + (l.labelDy ?? -10), l.color ?? C.energy, {
      align: l.labelAlign ?? "center",
    });
  }

  /* ---------------- nama keadaan ---------------- */

  if (s.heading) {
    taruh.write(s.heading, padL + plotW / 2, padT + 24, s.headingColor ?? C.ink, {
      big: true,
    });
  }

  /* ---------------- dasar kedap ---------------- */

  if (s.imperviousFloor) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(padL, padT, plotW, plotH + 10);
    ctx.clip();
    imperviousBase(ctx, padL, padL + plotW, Z(s.zMin));
    ctx.restore();
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

/**
 * Satu panah, arah bebas.
 *
 * Kepalanya digambar dari sudut batangnya sendiri, bukan dari tanda komponen
 * mendatarnya, supaya panah yang hampir tegak tidak berkepala menyamping.
 * Bentuk sebelumnya tidak pernah memperlihatkan cacat itu karena seluruh
 * panah keluarga D mendatar.
 */
function panah(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  dx: number,
  dy: number,
  color: string,
  weight: number
) {
  const panjang = Math.hypot(dx, dy);
  if (panjang < 1) return;
  const sudut = Math.atan2(dy, dx);
  const x1 = x0 + dx;
  const y1 = y0 + dy;
  const kepala = Math.min(6, panjang * 0.45);

  pen(ctx, weight, color);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
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
