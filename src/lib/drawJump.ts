import { C, DASH, F, W, stencil, stencilWidth } from "./theme";
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
import { G, conjugateDepth, froude, jumpLength, fmtPlain} from "./hydraulics";
import { cl } from "./strings";
import type { Lang } from "./i18n";

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
  lang?: Lang;
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
    lang = "id",
    streaks = null,
    dt = 0,
    t = 0,
  } = opt;

  const T = cl(lang);

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
  const step = Math.max(1, Math.floor(plotW / 320));
  const pts: [number, number][] = [];
  for (let px = 0; px <= plotW; px += step) {
    const xm = (px / plotW) * bentang;
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
      const xm = st.x * bentang;
      const d = depthAt(xm);
      const V = q / Math.max(d, 0.02);

      st.x += (V * dt) / bentang;
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
    const ujung = { x: X(xJump), y: Y(p.y1) };

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
      // Di bawah beton, di atas angka sumbu; lihat padB.
      dimH(
        ctx,
        ljY,
        X(xJump),
        X(xJump + Lj),
        `Lj ≈ ${fmtPlain(Lj, 1)} m`,
        C.critical,
        bedY + bedThk,
        [padL, padL + plotW]
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
    const zona: Zona[] = [{ x0: 0, x1: xJump, teks: T.supercritical, warna: C.ink3 }];
    if (hasJump) {
      zona.push({ x0: xJump, x1: xJump + Lj, teks: T.jump, warna: C.critical });
      zona.push({ x0: xJump + Lj, x1: bentang, teks: T.subcritical, warna: C.ink3 });
    } else {
      zona.push({ x0: xJump, x1: bentang, teks: T.noJump, warna: C.ink3 });
    }

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
      X(xJump),
      Y(p.y1),
      siku.x,
      siku.y,
      teksFr,
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
