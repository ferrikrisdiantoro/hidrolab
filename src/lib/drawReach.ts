import { C, DASH, F, W, stencil, stencilWidth } from "./theme";
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
import { fmtPlain } from "./hydraulics";

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
  /**
   * Letak label sebagai pecahan panjang deret, 0 di hulu dan 1 di hilir.
   *
   * Nilainya benar-benar pecahan jarak, bukan pecahan jumlah titik. Deret yang
   * lurus cukup diberi dua titik ujungnya saja, dan labelnya tetap dapat
   * ditaruh di mana pun di antara keduanya.
   */
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
  /**
   * Geseran tegak dalam PIKSEL, bukan dalam meter.
   *
   * Jarak antar label harus tetap sama di layar berapa pun skala tegaknya.
   * Menyatakannya dalam meter membuatnya menyusut sampai bertumpuk pada ruas
   * curam, karena di sana sumbu tegaknya didominasi penurunan dasar dan bukan
   * oleh kedalaman airnya.
   */
  dy?: number;
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
    axisValue(ctx, fmtPlain(v, zDigits), padL - 8, Z(v), "right", "middle");
  // Angka desimalnya mengikuti langkah, bukan dibulatkan ke bilangan bulat:
  // pada bentang pendek langkahnya setengah meter, dan pembulatan membuat
  // sumbunya terbaca "0 1 1 2 2 3 3".
  const xDigits = xStep < 0.1 ? 2 : xStep < 1 ? 1 : 0;
  for (let x = 0; x <= L + 1e-9; x += xStep)
    axisValue(
      ctx,
      fmtPlain(x, xDigits),
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

  /*
   * Satu daftar kotak terpakai untuk SELURUH tulisan di dalam bidang.
   *
   * Label kurva dan nama penampang digambar oleh dua bagian yang berbeda,
   * tetapi keduanya berebut ruang yang sama. Menahan tumpukan hanya di salah
   * satunya membuat cacatnya berpindah, bukan hilang: pada profil yang jauh
   * lebih pendek daripada bentangnya, semua tulisan tumpah ke tepi kiri.
   */
  const dipakai: { x0: number; x1: number; atas: number; bawah: number }[] = [];

  /**
   * Menempatkan satu tulisan: ditahan agar utuh di dalam bingkai, lalu
   * digeser ke bawah bila tempatnya sudah dipakai tulisan lain.
   *
   * Perataan ikut diperhitungkan, karena tulisan rata kiri tumbuh ke kanan
   * dari absisnya sedangkan tulisan rata kanan tumbuh ke kiri. Menahan
   * keduanya dengan cara yang sama akan memotong salah satunya.
   */
  const tempatkan = (
    teks: string,
    x: number,
    y: number,
    spacing: number,
    align: CanvasTextAlign = "center",
    font?: string
  ) => {
    ctx.font = font ?? (spacing > 1 ? F.region : F.labelSm);
    const w = stencilWidth(ctx, teks, spacing) + 8;
    const kiri = align === "left" ? 0 : align === "right" ? w : w / 2;
    const xx = Math.min(
      Math.max(x, padL + kiri),
      padL + plotW - (w - kiri)
    );
    const x0 = xx - kiri;
    const x1 = x0 + w;

    /*
     * Tinggi tulisan ikut diperhitungkan, tidak dianggap sama rata.
     *
     * Nama wilayah besar memakai huruf lima belas piksel dengan garis dasar di
     * bawah, sedangkan label biasa sepuluh piksel dengan garis dasar di tengah.
     * Selama keduanya dibandingkan dengan satu jarak tetap sebelas piksel,
     * tulisan besar yang sudah digeser pun tetap menindih tetangganya dari atas.
     */
    const besar = (font ?? "").includes("15px");
    const naik = besar ? 17 : 7;
    const turun = besar ? 3 : 7;

    let yy = y;
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

  /**
   * Alas kertas di belakang tulisan.
   *
   * Nama wilayah dan nama penampang ditulis di bagian atas bidang, tempat
   * garis energi dan muka air juga lewat. Tanpa alas, garis itu menembus
   * hurufnya dan keduanya sama-sama sulit dibaca. Ini kebiasaan gambar
   * teknik: tulisan memotong garis, bukan sebaliknya.
   */
  const alas = (pos: {
    x0: number;
    x1: number;
    atas: number;
    bawah: number;
  }) => {
    ctx.fillStyle = C.sheet;
    ctx.fillRect(pos.x0 + 3, pos.atas, pos.x1 - pos.x0 - 6, pos.bawah - pos.atas);
  };

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
      /*
       * Letak label dicari dengan menyisipkan di sepanjang JARAK, bukan dengan
       * memilih titik ke sekian.
       *
       * Deret yang lurus wajar diberi dua titik ujungnya saja, dan pada deret
       * seperti itu memilih titik ke sekian hanya bisa menghasilkan salah satu
       * ujung. Akibatnya label yang diminta di tengah selalu mendarat di tepi,
       * tempat ia bertabrakan dengan dimensi penampang atau terpotong bingkai.
       */
      const f = Math.min(1, Math.max(0, d.labelAt ?? 0.08));
      const xa = d.pts[0].x;
      const xb = d.pts[d.pts.length - 1].x;
      const xt = xa + (xb - xa) * f;

      let zt = d.pts[0].z;
      for (let k = 1; k < d.pts.length; k++) {
        const a = d.pts[k - 1];
        const c = d.pts[k];
        if ((xt - a.x) * (xt - c.x) <= 0) {
          const t = Math.abs(c.x - a.x) < 1e-12 ? 0 : (xt - a.x) / (c.x - a.x);
          zt = a.z + (c.z - a.z) * t;
          break;
        }
        zt = c.z;
      }

      const rata = d.labelAlign ?? "left";
      const pos = tempatkan(
        d.label,
        X(xt),
        Z(zt) + (d.labelDy ?? -10),
        0.6,
        rata
      );
      curveLabel(ctx, d.label, pos.x, pos.y, d.color, rata);
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

  /* ---------------- penampang bertanda ----------------
     Label ditumpuk ke bawah bila penampang berikutnya terlalu dekat, karena
     dua nama yang berdesakan lebih buruk daripada satu nama yang bergeser. */
  for (const m of s.markers ?? []) {
    const xp = X(m.x);
    pen(ctx, W.thin, m.color, DASH.axis);
    ctx.beginPath();
    ctx.moveTo(xp, padT);
    ctx.lineTo(xp, Z(m.zBottom ?? 0));
    ctx.stroke();
    ctx.setLineDash([]);

    const pos = tempatkan(m.label, xp, padT + 12, 1.4, "center");
    alas(pos);
    region(ctx, m.label, pos.x, pos.y, m.color);

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
    /*
     * Ordinat ditahan LEBIH DULU, baru geserannya ditambahkan.
     *
     * Urutan ini penting. Bila penahan dipasang sesudah geseran, dua label yang
     * sama-sama berada di luar bidang akan dijepit ke baris yang sama dan
     * geserannya lenyap, sehingga keduanya bertumpuk justru pada keadaan yang
     * paling membutuhkan pemisahan.
     */
    const yDasar = Math.max(Z(g.z), padT + 14);
    const yg = Math.min(yDasar + (g.dy ?? 0), padT + plotH - 8);
    // Nama wilayah ikut daftar kotak terpakai yang sama dengan nama penampang.
    // Keduanya berebut baris teratas bidang, dan sebelum ini nama wilayah
    // digambar tanpa memeriksa apa pun, jadi "Fr = 1" selalu menimpa "leher".
    const pos = g.big
      ? tempatkan(g.text, X(g.x), yg, 2, "center", F.heading)
      : tempatkan(g.text, X(g.x), yg, 1.4, "center");
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

  /* ---------------- bingkai ---------------- */
  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(padL) + 0.5,
    Math.round(padT) + 0.5,
    Math.round(plotW),
    Math.round(plotH)
  );
}
