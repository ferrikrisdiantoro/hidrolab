import { C, DASH, F, W, stencil, stencilWidth } from "./theme.ts";
import {
  axisTitle,
  axisValue,
  curveLabel,
  dimV,
  fitHeading,
  ground,
  hatchConcrete,
  hatchWater,
  niceStep,
  pen,
  region,
  ruling,
  splitLabel,
} from "./plate.ts";
import { fmtPlain } from "./hydraulics.ts";
import { anchorsFrom, mapFrom, rectsFrom, type PlateAnchor, type PlateOut } from "./plateOut.ts";

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
  /**
   * Ujung kanan sumbu mendatar, meter. Bawaan `length`. Dipakai lembar yang
   * mengunci skala selama pegangan diseret: bentangnya boleh lebih panjang
   * atau lebih pendek daripada sumbu, dan `clip` memotong lebihnya.
   */
  xMax?: number;
  /**
   * Potong air, dasar, garis tambahan, dan penampang ke bidang gambar.
   * Hanya selama skala dikunci; tanpa kunci gambarnya selalu muat dan
   * pemotongan akan mengubah piksel tepi bingkai.
   */
  clip?: boolean;
  /**
   * Panah arah aliran diam, absis meter. Digambar pada 0,6 kedalaman,
   * searah garis arus di situ. Dipakai saat lapis gerak dijeda supaya
   * arah aliran tetap terbaca; selagi bergerak lembar tidak mengirimnya.
   */
  flowArrows?: number[];
  /**
   * Tanda gulungan loncatan air (busur berpanah berlawanan jarum jam) di
   * hilir muka loncatan pada absis ini, meter. Diam; lapis gerak
   * (drawReachMotion) memutarnya.
   */
  rollers?: number[];
  /**
   * Titik bernama dalam meter (x jarak, z elevasi), diteruskan ke
   * PlateOut.anchors dalam piksel. Tidak digambar.
   */
  anchors?: Record<string, { x: number; z: number }>;
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
): PlateOut {
  const padL = 62;
  const padR = 34;
  const padT = 28;
  const padB = 52;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = Math.max(10, h - padT - padB);
  const L = s.length;
  // Panjang sumbu; sama dengan bentang kecuali selama skala dikunci.
  const Lx = s.xMax ?? L;

  const semua = [
    ...s.bed,
    ...s.water,
    ...(s.series ?? []).flatMap((d) => d.pts),
  ];
  const zMax = semua.reduce((m, p) => Math.max(m, p.z), 0);
  const zTop = s.zTop ?? Math.max(zMax * 1.12, 1e-3);

  const X = (x: number) => padL + (x / Lx) * plotW;
  const Z = (z: number) => padT + plotH - (z / zTop) * plotH;

  ground(ctx, w, h);

  /* ---------------- kisi dan sumbu ---------------- */
  const zStep = niceStep(zTop, 5);
  const xStep = niceStep(Lx, 6);
  const hs: number[] = [];
  const vs: number[] = [];
  for (let v = 0; v <= zTop + 1e-9; v += zStep) hs.push(Z(v));
  for (let x = 0; x <= Lx + 1e-9; x += xStep) vs.push(X(x));
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
  for (let x = 0; x <= Lx + 1e-9; x += xStep)
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

  /* Selama skala dikunci isi bidang dipotong ke bingkai: bentang yang lebih
     panjang daripada sumbu tidak boleh menembus bingkai. Dibuka lagi sesudah
     penampang bertanda, sebelum nama wilayah. */
  ctx.save();
  if (s.clip) {
    ctx.beginPath();
    ctx.rect(padL, padT, plotW, plotH);
    ctx.clip();
  }

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
    // Judul besar (turunan F.heading, tebal 700) mendapat kotak setinggi
    // hurufnya; judul yang dikecilkan fitHeading ikut terbaca ukurannya.
    const besar = (font ?? "").startsWith("700 ");
    const naik = besar ? Number(/(\d+)px/.exec(font as string)?.[1] ?? 15) + 2 : 7;
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

  /*
   * Menulis nama wilayah atau nama penampang. Tulisan yang lebih lebar
   * daripada bidangnya dipecah dua baris (judul besar dikecilkan dulu,
   * fitHeading), dan baris-barisnya ditempatkan sebagai satu blok: bila
   * salah satunya terdorong, blok dicoba 12 px lebih rendah, tetapi tidak
   * sampai keluar bawah bidang. Tulisan yang muat tetap satu baris di tempat
   * yang sama seperti sebelumnya.
   */
  const tulis = (
    teks: string,
    x: number,
    y: number,
    warna: string,
    big = false
  ) => {
    const muat = big ? fitHeading(ctx, teks, plotW) : null;
    const baris = muat ? muat.lines : splitLabel(ctx, teks, plotW);
    const awal = dipakai.length;
    const susun = (y0: number) => {
      const hasil: ReturnType<typeof tempatkan>[] = [];
      let yb = y0;
      let utuh = true;
      for (const b of baris) {
        const pos = muat
          ? tempatkan(b, x, yb, 2, "center", muat.font)
          : tempatkan(b, x, yb, 1.4, "center");
        if (hasil.length && pos.y !== yb) utuh = false;
        hasil.push(pos);
        yb = pos.bawah + (pos.bawah - pos.atas) - (muat ? 2 : 6);
      }
      return { hasil, utuh };
    };
    let coba = susun(y);
    for (let k = 1; k < 10 && !coba.utuh && baris.length > 1; k++) {
      const yBaru = coba.hasil[0].y + 12;
      dipakai.length = awal;
      const lagi = susun(yBaru);
      if (lagi.hasil[lagi.hasil.length - 1].bawah > padT + plotH - 2) {
        dipakai.length = awal;
        coba = susun(y);
        break;
      }
      coba = lagi;
    }
    baris.forEach((b, i) => {
      const pos = coba.hasil[i];
      alas(pos);
      if (muat) {
        ctx.fillStyle = warna;
        ctx.font = muat.font;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        stencil(ctx, b, pos.x, pos.y, 2);
      } else region(ctx, b, pos.x, pos.y, warna);
    });
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
  // Ditutup tegak di bawah kedua ujung dasar. Tanpa kunci keduanya tepat di
  // tepi bingkai (X(0) = padL, X(L) = padL + plotW), sama seperti dulu.
  ctx.lineTo(X(bedTerurut[bedTerurut.length - 1].x), padT + plotH);
  ctx.lineTo(X(bedTerurut[0].x), padT + plotH);
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
    // Penampang di luar sumbu yang dikunci tidak ditulis: penempat label akan
    // menahannya di tepi bingkai, dan namanya terbaca di tempat yang salah.
    if (s.clip && (m.x < -1e-9 || m.x > Lx + 1e-9)) continue;
    const xp = X(m.x);
    pen(ctx, W.thin, m.color, DASH.axis);
    ctx.beginPath();
    ctx.moveTo(xp, padT);
    ctx.lineTo(xp, Z(m.zBottom ?? 0));
    ctx.stroke();
    ctx.setLineDash([]);

    tulis(m.label, xp, padT + 12, m.color);

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

  /* ---------------- tanda diam: arah aliran dan gulungan ---------------- */
  const sisipAir = (x: number): number | null => sisip(s.water, x);
  const sisipDasar = (x: number): number | null => sisip(bedTerurut, x);
  for (const xa of s.flowArrows ?? []) {
    /* Panah pada 0,6 kedalaman, searah garis arus di situ (yang miring
       mengikuti pelebihan tegak). Badan air yang lebih tipis dari 8 px tidak
       diberi panah: panahnya akan menembus muka air. */
    // Panjang tetap 22 px di layar, berapa pun kemiringan garis arusnya.
    const panjang = 22;
    const dxm = (4 / plotW) * Lx;
    const tengah = (x: number) => {
      const a = sisipAir(x);
      const d = sisipDasar(x);
      // 0,6 kedalaman dari dasar, bukan tengah: garis kedalaman kritis sering
      // lewat dekat tengah kedalaman dan panahnya akan menumpang di garis itu.
      return a === null || d === null ? null : { y: Z(d + 0.6 * (a - d)), tebal: Z(d) - Z(a) };
    };
    const p0 = tengah(xa - dxm);
    const p1 = tengah(xa + dxm);
    const pm = tengah(xa);
    if (!p0 || !p1 || !pm || pm.tebal < 8) continue;
    const ux = X(xa + dxm) - X(xa - dxm);
    const uy = p1.y - p0.y;
    const ul = Math.hypot(ux, uy) || 1;
    const kx = ux / ul;
    const ky = uy / ul;
    const cx = X(xa);
    const xA = cx - (panjang / 2) * kx;
    const yA = pm.y - (panjang / 2) * ky;
    const xB = cx + (panjang / 2) * kx;
    const yB = pm.y + (panjang / 2) * ky;
    ctx.save();
    jalurAir();
    ctx.clip();
    pen(ctx, W.thin, C.water);
    ctx.beginPath();
    ctx.moveTo(xA, yA);
    ctx.lineTo(xB, yB);
    ctx.moveTo(xB - 5 * kx + 3 * ky, yB - 5 * ky - 3 * kx);
    ctx.lineTo(xB, yB);
    ctx.lineTo(xB - 5 * kx - 3 * ky, yB - 5 * ky + 3 * kx);
    ctx.stroke();
    ctx.restore();
  }
  for (const xr of s.rollers ?? []) {
    const r = rollerAt(xr, X, Z, s.water, bedTerurut);
    if (r) {
      ctx.save();
      jalurAir();
      ctx.clip();
      rollerIcon(ctx, r.cx, r.cy, r.r, 0);
      ctx.restore();
    }
  }

  ctx.restore(); // pemotongan kunci skala

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
    tulis(g.text, X(g.x), yg, g.color ?? (g.big ? C.ink : C.ink3), !!g.big);
  }

  /* ---------------- bingkai ---------------- */
  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(padL) + 0.5,
    Math.round(padT) + 0.5,
    Math.round(plotW),
    Math.round(plotH)
  );

  /* ---------------- keluaran untuk lapis di atas gambar ----------------
     Tidak menggambar apa pun. Titik bernama umum:
     - `upstreamSurface`, `downstreamSurface`: muka air di ujung hulu dan hilir
     - `upstreamBed`, `downstreamBed`: dasar di kedua ujung
     - `marker{i}`: muka air pada penampang bertanda ke-i (dasar bila muka
       air tidak sampai ke situ)
     ditambah `s.anchors` dari lembar. `water` = jalur isi air yang sama. */
  const frame = { x0: padL, y0: padT, x1: padL + plotW, y1: padT + plotH };
  const map = mapFrom(X, Z, frame, [0, Lx], [0, zTop]);
  const anchors: Record<string, PlateAnchor> = {};
  const di = (a: PlateAnchor) =>
    a.x >= frame.x0 - 0.5 && a.x <= frame.x1 + 0.5 && a.y >= frame.y0 - 0.5 && a.y <= frame.y1 + 0.5;
  const taruhTitik = (nama: string, x: number, z: number) => {
    const a = { x: X(x), y: Z(z) };
    if (Number.isFinite(a.x) && Number.isFinite(a.y) && di(a)) anchors[nama] = a;
  };
  const muka0 = s.water[0];
  const muka1 = s.water[s.water.length - 1];
  taruhTitik("upstreamSurface", muka0.x, muka0.z);
  taruhTitik("downstreamSurface", muka1.x, muka1.z);
  const dasar0 = bedTerurut[0];
  const dasar1 = bedTerurut[bedTerurut.length - 1];
  taruhTitik("upstreamBed", dasar0.x, dasar0.z);
  taruhTitik("downstreamBed", dasar1.x, dasar1.z);
  (s.markers ?? []).forEach((m, i) => {
    const z = sisip(s.water, m.x) ?? sisip(bedTerurut, m.x);
    if (z !== null) taruhTitik(`marker${i}`, m.x, z);
  });
  Object.assign(
    anchors,
    anchorsFrom(
      map,
      s.anchors &&
        Object.fromEntries(Object.entries(s.anchors).map(([k, p]) => [k, { x: p.x, y: p.z }]))
    )
  );

  // Poligon air: muka air ke hilir, lalu dasar di dalam rentangnya ke hulu.
  const poli: number[] = [];
  for (const p of s.water) poli.push(X(p.x), Z(p.z));
  for (let i = bedTerurut.length - 1; i >= 0; i--) {
    const p = bedTerurut[i];
    if (p.x > airAkhir + 1e-9 || p.x < airAwal - 1e-9) continue;
    poli.push(X(p.x), Z(p.z));
  }
  const water = Float64Array.from(poli);

  return { map, anchors, water, waters: [water], labels: rectsFrom(dipakai) };
}

/** Elevasi deret pada absis x (sisip linier), null di luar deret. */
function sisip(deret: ReachPoint[], x: number): number | null {
  for (let k = 1; k < deret.length; k++) {
    const a = deret[k - 1];
    const c = deret[k];
    if ((x - a.x) * (x - c.x) <= 0) {
      const t = Math.abs(c.x - a.x) < 1e-12 ? 0 : (x - a.x) / (c.x - a.x);
      return a.z + (c.z - a.z) * t;
    }
  }
  return null;
}

/** Busur gulungan 270°, celahnya berputar bersama sudut `phase`. */
const ROLL_SPAN = Math.PI * 1.5;

/**
 * Tanda gulungan loncatan: busur 270° berkepala panah, berputar BERLAWANAN
 * arah jarum jam untuk aliran ke kanan (permukaan gulungan mengalir balik ke
 * kaki loncatan, Chow 1959 §15-1), sama dengan tanda OC-01. `phase` dalam
 * radian; bertambah = berputar berlawanan jarum jam di layar. Satu path,
 * tanpa alokasi.
 */
export function rollerIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  phase: number
): void {
  // Sudut canvas (y ke bawah): berlawanan jarum jam di layar = sudut mengecil.
  const a1 = Math.PI * 0.25 - phase; // ujung berpanah
  const a0 = a1 + ROLL_SPAN; // pangkal
  pen(ctx, W.thin, C.water);
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  // Ekor busur di belakang kepala: dari a1 naik ke a0 (searah jarum jam
  // menurut canvas), jadi kepala di a1 memimpin gerak berlawanan jarum jam.
  ctx.arc(cx, cy, r, a1, a0, false);
  // Kepala panah di a1, menunjuk ke arah gerak (sudut mengecil).
  const tx = cx + r * Math.cos(a1);
  const ty = cy + r * Math.sin(a1);
  // Arah gerak di a1 untuk sudut mengecil: (sin a1, −cos a1).
  const ux = Math.sin(a1);
  const uy = -Math.cos(a1);
  const hl = Math.min(4, Math.max(2.5, r * 0.6));
  const ca = Math.cos(0.45);
  const sa = Math.sin(0.45);
  ctx.moveTo(tx - hl * (ux * ca - uy * sa), ty - hl * (ux * sa + uy * ca));
  ctx.lineTo(tx, ty);
  ctx.lineTo(tx - hl * (ux * ca + uy * sa), ty - hl * (-ux * sa + uy * ca));
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Letak tanda gulungan untuk loncatan di absis xj, piksel: tepat di hilir
 * muka loncatan, dekat muka air (gulungan gejala permukaan), jari-jari
 * 6 px dibatasi tebal badan air. null bila badan airnya terlalu tipis.
 */
export function rollerAt(
  xj: number,
  X: (x: number) => number,
  Z: (z: number) => number,
  water: ReachPoint[],
  bed: ReachPoint[]
): { cx: number; cy: number; r: number } | null {
  // Muka air sesudah muka loncatan: titik terakhir pada absis xj (loncatan
  // digambar sebagai dua titik pada absis yang sama), lalu deret di hilirnya.
  let k = -1;
  for (let i = 0; i < water.length; i++) if (Math.abs(water[i].x - xj) < 1e-9) k = i;
  if (k < 0) return null;
  const zs = water[k].z;
  const zb = sisip(bed, xj);
  if (zb === null) return null;
  const tebal = Z(zb) - Z(zs);
  const r = Math.min(6, (tebal - 5) / 2);
  if (!(r >= 2.5)) return null;
  const cx = X(xj) + r + 3;
  const cy = Z(zs) + 2.5 + r;
  return { cx, cy, r };
}
