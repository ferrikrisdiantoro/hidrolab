import { C, DASH, F, W, stencil, stencilWidth } from "./theme";
import { axisTitle, axisValue, ground, niceStep, pen, region, ruling } from "./plate";
import { fmtPlain } from "./hydraulics";
import { cl } from "./strings";
import type { Lang } from "./i18n";

/**
 * PENGGAMBAR KURVA X-Y UMUM — keluarga B.
 *
 * Empat belas lembar memakai bentuk yang sama: satu bidang berkisi, satu
 * atau beberapa kurva, sebuah titik kerja yang dibaca lewat jalur ke kedua
 * sumbu, dan daerah di luar rentang keberlakuan yang diarsir. Yang berbeda
 * antar lembar hanya besaran pada sumbunya, jadi seluruh bagian itu ditarik
 * ke satu berkas dan tiap lembar cukup menyusun datanya.
 *
 * Yang ikut dibawa ke sini adalah pelajaran pekan pertama, supaya cacat yang
 * sudah dibayar sekali tidak dibayar lagi empat belas kali:
 *
 * - jumlah desimal angka sumbu mengikuti langkahnya, tidak dibulatkan
 * - seluruh tulisan mendaftar ke satu daftar kotak terpakai, dan daftar itu
 *   menyimpan batas atas dan batas bawah, bukan satu ordinat
 * - tulisan diberi alas kertas, karena tulisan memotong garis dan bukan
 *   sebaliknya
 * - titik kerja yang jatuh di luar bidang dinyatakan dengan tulisan, tidak
 *   dibiarkan hilang tanpa keterangan
 */

/** Satu deret titik pada bidang. Nilai x dan y dalam satuan besarannya. */
export type ChartSeries = {
  pts: { x: number; y: number }[];
  color?: string;
  weight?: number;
  dash?: readonly number[];
  /** Nama kurva, ditulis di dekat salah satu titiknya */
  label?: string;
  /** Letak label sepanjang deret, 0 di awal dan 1 di akhir */
  labelAt?: number;
  /** Geseran label dalam piksel, negatif berarti ke atas */
  labelDy?: number;
  /** Perataan label terhadap titiknya */
  labelAlign?: CanvasTextAlign;
  /** Diisi warna sampai sumbu datar, dipakai untuk luas di bawah kurva */
  fill?: string;
};

/** Garis lurus sejajar salah satu sumbu, dipakai untuk ambang dan datum. */
export type ChartRule = {
  /** Sumbu yang dipotongnya: garis mendatar dipatok pada y, tegak pada x */
  axis: "x" | "y";
  at: number;
  color?: string;
  weight?: number;
  dash?: readonly number[];
  label?: string;
  labelAlign?: CanvasTextAlign;
};

/** Daerah yang diarsir, misalnya di luar rentang keberlakuan rumus. */
export type ChartBand = {
  axis: "x" | "y";
  from: number;
  to: number;
  label?: string;
};

/** Nama wilayah di dalam bidang, misalnya "laminar" atau "terangkut". */
export type ChartRegion = {
  x: number;
  y: number;
  text: string;
  color?: string;
  big?: boolean;
};

/** Titik kerja dengan jalur baca ke kedua sumbu. */
export type ChartPoint = {
  x: number;
  y: number;
  color?: string;
  /** Tulisan di dekat titik, biasanya nilai yang dibaca */
  label?: string;
  /** Salah, bila titiknya berada di luar rentang keberlakuan */
  invalid?: boolean;
};

export type ChartSpec = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** Benar bila sumbunya logaritmik. Nilai nol dan negatif tidak boleh */
  xLog?: boolean;
  yLog?: boolean;
  axisX: string;
  axisY: string;
  series: ChartSeries[];
  rules?: ChartRule[];
  bands?: ChartBand[];
  regions?: ChartRegion[];
  point?: ChartPoint;
  /** Nama besar di dalam bidang, menyatakan keadaan yang sedang digambar */
  heading?: string;
  headingColor?: string;
  /** Ruang tambahan di kanan, untuk lembar yang labelnya panjang */
  padRight?: number;
};

export function drawChart(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: ChartSpec,
  lang: Lang
) {
  const T = cl(lang);
  ground(ctx, w, h);

  const padL = 62;
  const padR = s.padRight ?? 30;
  const padT = 26;
  const padB = 52;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = Math.max(10, h - padT - padB);

  /* ---------------- pemetaan ---------------- */

  const lx0 = s.xLog ? Math.log10(s.xMin) : s.xMin;
  const lx1 = s.xLog ? Math.log10(s.xMax) : s.xMax;
  const ly0 = s.yLog ? Math.log10(s.yMin) : s.yMin;
  const ly1 = s.yLog ? Math.log10(s.yMax) : s.yMax;

  const X = (v: number) => {
    const t = ((s.xLog ? Math.log10(Math.max(v, 1e-300)) : v) - lx0) / (lx1 - lx0);
    return padL + t * plotW;
  };
  const Y = (v: number) => {
    const t = ((s.yLog ? Math.log10(Math.max(v, 1e-300)) : v) - ly0) / (ly1 - ly0);
    return padT + plotH - t * plotH;
  };

  const didalam = (x: number, y: number) =>
    x >= s.xMin && x <= s.xMax && y >= s.yMin && y <= s.yMax;

  /* ---------------- kisi dan angka sumbu ----------------
     Sumbu logaritmik diberi garis pada tiap dasawarsa; sumbu biasa pada
     langkah yang dipilih supaya angkanya bulat. */

  const xTicks: number[] = [];
  if (s.xLog) {
    for (let e = Math.ceil(lx0); e <= Math.floor(lx1) + 1e-9; e++)
      xTicks.push(Math.pow(10, e));
  } else {
    const step = niceStep(s.xMax - s.xMin, 6);
    for (let v = Math.ceil(s.xMin / step) * step; v <= s.xMax + 1e-9; v += step)
      xTicks.push(v);
  }

  const yTicks: number[] = [];
  if (s.yLog) {
    for (let e = Math.ceil(ly0); e <= Math.floor(ly1) + 1e-9; e++)
      yTicks.push(Math.pow(10, e));
  } else {
    const step = niceStep(s.yMax - s.yMin, 5);
    for (let v = Math.ceil(s.yMin / step) * step; v <= s.yMax + 1e-9; v += step)
      yTicks.push(v);
  }

  ruling(ctx, padL, padT, padL + plotW, padT + plotH, {
    horizontal: yTicks.map(Y),
    vertical: xTicks.map(X),
  });

  // Jumlah desimal dari jarak antar angka, bukan dari nilainya. Membulatkan
  // ke bilangan bulat membuat sumbu berlangkah setengah terbaca "0 1 1 2 2".
  const desimal = (nilai: number[]) => {
    if (nilai.length < 2) return 2;
    const beda = Math.abs(nilai[1] - nilai[0]);
    return beda >= 10 ? 0 : beda >= 1 ? 0 : beda >= 0.1 ? 1 : beda >= 0.01 ? 2 : 3;
  };
  const xDig = desimal(xTicks);
  const yDig = desimal(yTicks);

  for (const v of xTicks)
    axisValue(
      ctx,
      s.xLog ? pangkat(v) : fmtPlain(v, xDig),
      X(v),
      padT + plotH + 9,
      "center",
      "top"
    );
  for (const v of yTicks)
    axisValue(
      ctx,
      s.yLog ? pangkat(v) : fmtPlain(v, yDig),
      padL - 8,
      Y(v),
      "right",
      "middle"
    );

  axisTitle(ctx, s.axisX, padL + plotW / 2, padT + plotH + 34);
  axisTitle(ctx, s.axisY, 18, padT + plotH / 2, -Math.PI / 2);

  /* ---------------- daerah di luar rentang ----------------
     Digambar sebelum kurva, supaya kurvanya tetap di atas arsiran. */

  for (const b of s.bands ?? []) {
    const a1 = b.axis === "x" ? X(b.from) : Y(b.from);
    const a2 = b.axis === "x" ? X(b.to) : Y(b.to);
    const kiri = Math.min(a1, a2);
    const kanan = Math.max(a1, a2);
    ctx.save();
    ctx.fillStyle = C.paperSunk;
    ctx.globalAlpha = 0.7;
    if (b.axis === "x") ctx.fillRect(kiri, padT, kanan - kiri, plotH);
    else ctx.fillRect(padL, kiri, plotW, kanan - kiri);
    ctx.restore();

    pen(ctx, W.hair, C.ruleStrong, DASH.axis);
    ctx.beginPath();
    for (const a of [a1, a2]) {
      if (b.axis === "x") {
        if (a <= padL + 0.5 || a >= padL + plotW - 0.5) continue;
        ctx.moveTo(Math.round(a) + 0.5, padT);
        ctx.lineTo(Math.round(a) + 0.5, padT + plotH);
      } else {
        if (a <= padT + 0.5 || a >= padT + plotH - 0.5) continue;
        ctx.moveTo(padL, Math.round(a) + 0.5);
        ctx.lineTo(padL + plotW, Math.round(a) + 0.5);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* ---------------- daftar kotak terpakai ----------------
     Satu daftar untuk SELURUH tulisan di dalam bidang. Nama wilayah, label
     kurva, nama daerah arsir, dan tulisan titik kerja berebut ruang yang
     sama; menahan tumpukan pada salah satunya saja memindahkan cacatnya,
     bukan menghilangkannya. */

  const dipakai: { x0: number; x1: number; atas: number; bawah: number }[] = [];

  const tempatkan = (
    teks: string,
    x: number,
    y: number,
    spacing: number,
    align: CanvasTextAlign = "center",
    font?: string
  ) => {
    ctx.font = font ?? (spacing > 1 ? F.region : F.labelSm);
    const lebar = stencilWidth(ctx, teks, spacing) + 8;
    const kiri = align === "left" ? 0 : align === "right" ? lebar : lebar / 2;
    const xx = Math.min(
      Math.max(x, padL + kiri),
      padL + plotW - (lebar - kiri)
    );
    const x0 = xx - kiri;
    const x1 = x0 + lebar;

    // Tinggi tulisan ikut diperhitungkan: huruf besar bergaris dasar bawah
    // dan huruf biasa bergaris dasar tengah tidak dapat dibandingkan dengan
    // satu jarak tetap.
    const besar = (font ?? "").includes("15px");
    const naik = besar ? 17 : 7;
    const turun = besar ? 3 : 7;

    let yy = Math.min(Math.max(y, padT + naik + 2), padT + plotH - turun - 2);
    let putar = 0;
    while (
      putar < 10 &&
      dipakai.some(
        (d) => x0 < d.x1 && x1 > d.x0 && yy - naik < d.bawah && yy + turun > d.atas
      )
    ) {
      yy += 12;
      putar++;
    }
    dipakai.push({ x0, x1, atas: yy - naik, bawah: yy + turun });
    return { x: xx, y: yy, x0, x1, atas: yy - naik, bawah: yy + turun };
  };

  const alas = (pos: { x0: number; x1: number; atas: number; bawah: number }) => {
    ctx.fillStyle = C.sheet;
    ctx.fillRect(pos.x0 + 3, pos.atas, pos.x1 - pos.x0 - 6, pos.bawah - pos.atas);
  };

  /* ---------------- nama daerah arsir ---------------- */

  for (const b of s.bands ?? []) {
    if (!b.label) continue;
    const a1 = b.axis === "x" ? X(b.from) : Y(b.from);
    const a2 = b.axis === "x" ? X(b.to) : Y(b.to);
    const tengah = (a1 + a2) / 2;
    const pos =
      b.axis === "x"
        ? tempatkan(b.label, tengah, padT + plotH - 14, 1.4)
        : tempatkan(b.label, padL + plotW / 2, tengah, 1.4);
    alas(pos);
    region(ctx, b.label, pos.x, pos.y, C.ink3);
  }

  /* ---------------- kurva ----------------
     Digambar dengan pemotongan pada bingkai: deret yang keluar bidang
     dipotong di tepinya, bukan dibiarkan menggambar di atas sumbu. */

  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, padT, plotW, plotH);
  ctx.clip();

  for (const d of s.series) {
    if (d.pts.length < 2) continue;

    if (d.fill) {
      ctx.beginPath();
      d.pts.forEach((p, i) =>
        i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))
      );
      ctx.lineTo(X(d.pts[d.pts.length - 1].x), padT + plotH);
      ctx.lineTo(X(d.pts[0].x), padT + plotH);
      ctx.closePath();
      ctx.fillStyle = d.fill;
      ctx.fill();
    }

    pen(ctx, d.weight ?? W.bold, d.color ?? C.ink, d.dash ?? DASH.solid);
    ctx.beginPath();
    d.pts.forEach((p, i) =>
      i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))
    );
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();

  /* ---------------- garis ambang dan datum ---------------- */

  for (const r of s.rules ?? []) {
    pen(ctx, r.weight ?? W.thin, r.color ?? C.ink2, r.dash ?? DASH.hidden);
    ctx.beginPath();
    if (r.axis === "y") {
      const yy = Y(r.at);
      if (yy >= padT && yy <= padT + plotH) {
        ctx.moveTo(padL, yy);
        ctx.lineTo(padL + plotW, yy);
      }
    } else {
      const xx = X(r.at);
      if (xx >= padL && xx <= padL + plotW) {
        ctx.moveTo(xx, padT);
        ctx.lineTo(xx, padT + plotH);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    if (r.label) {
      const align = r.labelAlign ?? "right";
      const pos =
        r.axis === "y"
          ? tempatkan(
              r.label,
              align === "right" ? padL + plotW - 4 : padL + 4,
              Y(r.at) - 9,
              1.4,
              align
            )
          : tempatkan(r.label, X(r.at), padT + 12, 1.4, "center");
      alas(pos);
      region(ctx, r.label, pos.x, pos.y, r.color ?? C.ink2);
    }
  }

  /* ---------------- label kurva ----------------
     Ditempatkan sesudah seluruh kurva digambar, supaya tidak ada kurva yang
     melintas di atas tulisan yang sudah diberi alas. */

  for (const d of s.series) {
    if (!d.label || d.pts.length < 2) continue;
    const f = Math.min(Math.max(d.labelAt ?? 0.5, 0), 1);
    const i = Math.min(
      d.pts.length - 1,
      Math.max(0, Math.round(f * (d.pts.length - 1)))
    );
    const p = d.pts[i];
    if (!didalam(p.x, p.y)) continue;
    const pos = tempatkan(
      d.label,
      X(p.x),
      Y(p.y) + (d.labelDy ?? -10),
      1.4,
      d.labelAlign ?? "center"
    );
    alas(pos);
    region(ctx, d.label, pos.x, pos.y, d.color ?? C.ink);
  }

  /* ---------------- nama wilayah ---------------- */

  for (const g of s.regions ?? []) {
    const pos = g.big
      ? tempatkan(g.text, X(g.x), Y(g.y), 2, "center", F.heading)
      : tempatkan(g.text, X(g.x), Y(g.y), 1.4);
    alas(pos);
    if (g.big) {
      ctx.fillStyle = g.color ?? C.ink;
      ctx.font = F.heading;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      stencil(ctx, g.text, pos.x, pos.y, 2);
    } else {
      region(ctx, g.text, pos.x, pos.y, g.color ?? C.ink3);
    }
  }

  /* ---------------- titik kerja ---------------- */

  if (s.point) {
    const p = s.point;
    const warna = p.color ?? (p.invalid ? C.signal : C.signal);

    if (didalam(p.x, p.y)) {
      const px = X(p.x);
      const py = Y(p.y);

      pen(ctx, W.thin, warna, DASH.axis);
      ctx.beginPath();
      ctx.moveTo(px, padT + plotH);
      ctx.lineTo(px, py);
      ctx.lineTo(padL, py);
      ctx.stroke();
      ctx.setLineDash([]);

      // Belah ketupat, bentuk titik ukur pada gambar teknik.
      pen(ctx, W.thin, warna);
      ctx.fillStyle = C.sheet;
      ctx.beginPath();
      ctx.moveTo(px, py - 5);
      ctx.lineTo(px + 5, py);
      ctx.lineTo(px, py + 5);
      ctx.lineTo(px - 5, py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (p.label) {
        // Ke kanan titik bila titiknya dekat tepi kiri, supaya kotak
        // tulisannya tidak menutupi belah ketupatnya sendiri.
        const align: CanvasTextAlign = px < padL + 70 ? "left" : "right";
        const pos = tempatkan(
          p.label,
          align === "left" ? px + 9 : px - 9,
          py - 12,
          1.4,
          align
        );
        alas(pos);
        region(ctx, p.label, pos.x, pos.y, warna);
      }
    } else {
      // Titik di luar bidang tidak boleh sekadar hilang: pembaca akan
      // mengira gambarnya tidak menanggapi masukan.
      const teks = `${T.pointOffChart}${p.label ? `: ${p.label}` : ""}`;
      const pos = tempatkan(teks, padL + plotW / 2, padT + 14, 1.4);
      alas(pos);
      region(ctx, teks, pos.x, pos.y, C.signal);
    }
  }

  /* ---------------- nama keadaan ---------------- */

  if (s.heading) {
    const pos = tempatkan(
      s.heading,
      padL + plotW / 2,
      padT + 24,
      2,
      "center",
      F.heading
    );
    alas(pos);
    ctx.fillStyle = s.headingColor ?? C.ink;
    ctx.font = F.heading;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    stencil(ctx, s.heading, pos.x, pos.y, 2);
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

/** Angka dasawarsa ditulis sebagai pangkat sepuluh, seperti kertas log. */
function pangkat(v: number): string {
  const e = Math.round(Math.log10(v));
  return `10${sup(e)}`;
}

function sup(n: number): string {
  const angka = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const t = Math.abs(n)
    .toString()
    .split("")
    .map((d) => angka[Number(d)])
    .join("");
  return (n < 0 ? "⁻" : "") + t;
}
