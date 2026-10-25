import { C, DASH, F, W, stencil } from "./theme.ts";
import {
  axisTitle,
  axisValue,
  curveLabel,
  dimV,
  flowArrow,
  ground,
  niceStep,
  pen,
  pipeBody,
  region,
  ruling,
  type PipeWall,
} from "./plate.ts";
import { cl } from "./strings.ts";
import type { Lang } from "./i18n";
import { fmtPlain } from "./hydraulics.ts";
import { mapFrom, type PlateAnchor, type PlateOut } from "./plateOut.ts";

export type VenturiDrawState = {
  /** Diameter pipa, meter */
  D1: number;
  /** Diameter leher, meter */
  D2: number;
  /** Kecepatan di pipa dan di leher */
  V1: number;
  V2: number;
  /** Beda tinggi tekan antara pipa dan leher, meter */
  dh: number;
  /** Kehilangan tekanan tetap sesudah alat, meter */
  permanentLoss: number;
  /** Di luar rentang perbandingan diameter yang lazim */
  outOfRange: boolean;
  /** Leher tidak lebih sempit dari pipa: tidak ada garis tinggi tekan yang bisa digambar */
  notVenturi: boolean;
};

/**
 * DUA REGISTER BERTUMPUK PADA SATU SUMBU JARAK.
 *
 * Panel atas garis tinggi tekan, panel bawah potongan pipanya. Keduanya
 * dipisah karena skalanya memang tidak sebanding: tinggi tekan diukur dalam
 * meter kolom air sedangkan diameter pipa dalam sentimeter, dan
 * memaksakan keduanya pada satu skala akan membuat salah satunya lenyap.
 *
 * Yang harus terbaca sekali pandang: garis tekan MENUKIK di leher lalu naik
 * kembali, tetapi tidak naik sampai setinggi semula. Selisih yang tidak
 * kembali itu kehilangan tetap, dan justru kecilnya selisih itulah alasan
 * orang memilih venturi ketimbang pelat lubang.
 */
export function drawVenturi(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: VenturiDrawState,
  lang: Lang
): PlateOut {
  const T = cl(lang);
  ground(ctx, w, h);

  const padL = 62;
  const padR = 26;
  const padT = 24;
  const padB = 50;
  const sela = 26;

  const plotW = Math.max(10, w - padL - padR);
  const tinggiTotal = Math.max(20, h - padT - padB - sela);
  const tinggiAtas = tinggiTotal * 0.52;
  const tinggiBawah = tinggiTotal - tinggiAtas;
  const atasY = padT;
  const bawahY = padT + tinggiAtas + sela;

  /* -------- geometri venturi dalam satuan diameter pipa --------
     Perbandingan bagian-bagiannya mengikuti bentuk baku venturi klasik:
     bagian menyempit landai, leher pendek, bagian membesar jauh lebih
     panjang. Justru bagian membesar yang panjang itulah yang membuat
     kehilangan tetapnya kecil. */
  const xMasuk = 1.2 * s.D1;
  const xKerucut = 1.3 * s.D1;
  const xLeher = 1.0 * s.D2;
  const xLebar = 5.0 * s.D1;
  const xKeluar = 1.2 * s.D1;
  const a1 = xMasuk;
  const a2 = a1 + xKerucut;
  const a3 = a2 + xLeher;
  const a4 = a3 + xLebar;
  const L = a4 + xKeluar;

  const X = (x: number) => padL + (x / L) * plotW;

  const wall: PipeWall = [
    { x: 0, r: s.D1 / 2 },
    { x: a1, r: s.D1 / 2 },
    { x: a2, r: s.D2 / 2 },
    { x: a3, r: s.D2 / 2 },
    { x: a4, r: s.D1 / 2 },
    { x: L, r: s.D1 / 2 },
  ];

  // Skala jari-jari dari yang terbesar di antara pipa dan leher, supaya
  // leher yang lebih besar dari pipa tetap tergambar di dalam panelnya.
  const rMax = (Math.max(s.D1, s.D2) / 2) * 1.55;
  const R = (r: number) => bawahY + tinggiBawah / 2 - (r / rMax) * (tinggiBawah / 2);

  /* -------- panel atas: garis tinggi tekan -------- */
  const hDatang = Math.max(s.dh * 1.35, 0.05);
  const zTop = hDatang * 1.12;
  const Z = (z: number) => atasY + tinggiAtas - (z / zTop) * tinggiAtas;

  const zStep = niceStep(zTop, 4);
  const xStep = niceStep(L, 6);
  const hs: number[] = [];
  const vs: number[] = [];
  for (let v = 0; v <= zTop + 1e-9; v += zStep) hs.push(Z(v));
  for (let v = 0; v <= L + 1e-9; v += xStep) vs.push(X(v));
  ruling(ctx, padL, atasY, padL + plotW, atasY + tinggiAtas, {
    horizontal: hs,
    vertical: vs,
  });
  ruling(ctx, padL, bawahY, padL + plotW, bawahY + tinggiBawah, {
    vertical: vs,
  });

  const digits = zStep < 0.1 ? 3 : zStep < 1 ? 2 : 1;
  for (let v = 0; v <= zTop + 1e-9; v += zStep)
    axisValue(ctx, fmtPlain(v, digits), padL - 8, Z(v), "right", "middle");
  for (let v = 0; v <= L + 1e-9; v += xStep)
    axisValue(
      ctx,
      fmtPlain(v, 2),
      X(v),
      bawahY + tinggiBawah + 9,
      "center",
      "top"
    );

  axisTitle(ctx, T.axAlongPipe, padL + plotW / 2, bawahY + tinggiBawah + 34);
  axisTitle(ctx, T.axHead, 18, atasY + tinggiAtas / 2, -Math.PI / 2);

  // Garis tinggi tekan. Tinggi tekan datang dipatok sebagai acuan, lalu
  // turun sebesar beda tinggi tekan di leher dan pulih sebagian sesudahnya.
  const zMasuk = hDatang;
  const zLeher = hDatang - s.dh;
  const zPulih = hDatang - s.permanentLoss;

  const hgl: [number, number][] = [];
  hgl.push([0, zMasuk]);
  hgl.push([a1, zMasuk]);
  for (let i = 1; i <= 14; i++) {
    const f = i / 14;
    hgl.push([a1 + (a2 - a1) * f, zMasuk - (zMasuk - zLeher) * (f * f)]);
  }
  hgl.push([a3, zLeher]);
  for (let i = 1; i <= 20; i++) {
    const f = i / 20;
    hgl.push([a3 + (a4 - a3) * f, zLeher + (zPulih - zLeher) * Math.sqrt(f)]);
  }
  hgl.push([L, zPulih]);

  // Bila lehernya tidak lebih sempit, tidak ada penurunan tekanan yang bisa
  // digambar: bacaan manometer yang dimasukkan tidak punya arti di sini, dan
  // panel atas menyatakan itu alih-alih menggambar garis dari angka itu.
  if (s.notVenturi) {
    region(ctx, T.notVenturi, padL + plotW / 2, atasY + tinggiAtas / 2, C.signal);
  } else {
    pen(ctx, W.bold, C.energy);
    ctx.beginPath();
    hgl.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))));
    ctx.stroke();
    curveLabel(ctx, T.pressureLine, X(a1 * 0.15), Z(zMasuk) - 10, C.energy);

    // Tinggi tekan datang sebagai garis khayal, supaya bagian yang tidak pulih
    // terbaca sebagai jarak, bukan sebagai kesan.
    pen(ctx, W.hair, C.ink3, DASH.phantom);
    ctx.beginPath();
    ctx.moveTo(X(0), Z(zMasuk));
    ctx.lineTo(X(L), Z(zMasuk));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (!s.notVenturi) {
    dimV(
      ctx,
      X((a2 + a3) / 2),
      Z(zMasuk),
      Z(zLeher),
      `Δh ${fmtPlain(s.dh, 4)} m`,
      C.energy
    );
    dimV(
      ctx,
      X(L) - 26,
      Z(zMasuk),
      Z(zPulih),
      `${fmtPlain(s.permanentLoss, 4)} m`,
      C.signal
    );
  }

  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(padL) + 0.5,
    Math.round(atasY) + 0.5,
    Math.round(plotW),
    Math.round(tinggiAtas)
  );

  /* -------- panel bawah: potongan pipa -------- */
  const isiAir = () => {
    ctx.beginPath();
    const urut = [...wall];
    urut.forEach((p, i) =>
      i ? ctx.lineTo(X(p.x), R(p.r)) : ctx.moveTo(X(p.x), R(p.r))
    );
    for (let i = urut.length - 1; i >= 0; i--)
      ctx.lineTo(X(urut[i].x), R(-urut[i].r));
    ctx.closePath();
  };
  ctx.save();
  isiAir();
  ctx.fillStyle = C.waterFill;
  ctx.fill();
  ctx.restore();

  pipeBody(ctx, wall, X, R, {
    thickness: s.D1 * 0.06,
    clip: { x: padL, y: bawahY, w: plotW, h: tinggiBawah },
    axis: true,
  });

  // Panah kecepatan: panjangnya sebanding kecepatan setempat, jadi ia
  // memanjang dengan sendirinya di leher.
  const skalaPanah = (plotW / L) * 0.12;
  for (const [x, V] of [
    [a1 * 0.5, s.V1],
    [(a2 + a3) / 2, s.V2],
    [a4 + xKeluar * 0.5, s.V1],
  ] as const) {
    flowArrow(ctx, X(x), R(0) - 0.5, Math.max(10, V * skalaPanah), C.water);
  }

  // Titik ukur tekanan: satu di pipa, satu di leher. Tanpa penyempitan
  // tidak ada yang diukur, dan garisnya cuma akan memotong tulisan di panel
  // atas.
  for (const [x, teks] of s.notVenturi
    ? []
    : ([
        [a1 * 0.6, "1"],
        [(a2 + a3) / 2, "2"],
      ] as const)) {
    const rw = x < a1 ? s.D1 / 2 : s.D2 / 2;
    pen(ctx, W.thin, C.energy, DASH.axis);
    ctx.beginPath();
    ctx.moveTo(X(x), R(rw));
    ctx.lineTo(X(x), atasY);
    ctx.stroke();
    ctx.setLineDash([]);
    region(ctx, teks, X(x), R(rw) - 12, C.energy);
  }

  dimV(
    ctx,
    X(a1 * 0.25),
    R(s.D1 / 2),
    R(-s.D1 / 2),
    `D₁ ${fmtPlain((s.D1 * 1000), 0)} mm`,
    C.ink
  );
  dimV(
    ctx,
    X((a2 + a3) / 2) + 30,
    R(s.D2 / 2),
    R(-s.D2 / 2),
    `D₂ ${fmtPlain((s.D2 * 1000), 0)} mm`,
    s.outOfRange ? C.signal : C.ink
  );

  ctx.fillStyle = C.ink;
  ctx.font = F.heading;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Nama "leher" hanya bila memang ada leher: bila lehernya yang terbesar,
  // dindingnya turun sampai ke tempat tulisan ini.
  if (!s.notVenturi) stencil(ctx, T.throatSection, X((a2 + a3) / 2), bawahY + tinggiBawah - 12, 2);

  // Di sudut bawah, bukan atas: dimensi D₁ yang pendek menaruh teksnya di
  // atas dimensinya, tepat di baris nama wilayah kalau nama itu di atas.
  region(ctx, T.upstream, X(a1 * 0.5), bawahY + tinggiBawah - 12, C.ink3);
  region(ctx, T.downstream, X(a4 + xKeluar * 0.5), bawahY + tinggiBawah - 12, C.ink3);

  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(padL) + 0.5,
    Math.round(bawahY) + 0.5,
    Math.round(plotW),
    Math.round(tinggiBawah)
  );

  /*
   * PlateOut, tidak menggambar apa pun. Peta utama = potongan pipa (jarak
   * sepanjang pipa dan jari-jari dari sumbu, meter). Garis tinggi tekan di
   * `maps.head` (jarak, tinggi tekan relatif, meter).
   * - `pipeWall`: dinding atas pipa di dimensi D1
   * - `throatWall`: dinding atas leher di dimensi D2
   * - `headInlet`, `headThroat`: garis tinggi tekan di pipa dan di leher,
   *   hanya bila garis itu digambar (leher lebih sempit dari pipa)
   * `water` = isi pipa.
   */
  const map = mapFrom(X, R, { x0: padL, y0: bawahY, x1: padL + plotW, y1: bawahY + tinggiBawah }, [0, L], [-rMax, rMax]);
  const anchors: Record<string, PlateAnchor> = {
    pipeWall: { x: X(a1 * 0.25), y: R(s.D1 / 2) },
    throatWall: { x: X((a2 + a3) / 2), y: R(s.D2 / 2) },
  };
  if (!s.notVenturi) {
    anchors.headInlet = { x: X(a1 * 0.5), y: Z(zMasuk) };
    anchors.headThroat = { x: X((a2 + a3) / 2), y: Z(zLeher) };
  }
  const isi: number[] = [];
  for (const p of wall) isi.push(X(p.x), R(p.r));
  for (let i = wall.length - 1; i >= 0; i--) isi.push(X(wall[i].x), R(-wall[i].r));
  const water = Float64Array.from(isi);
  return {
    map,
    anchors,
    water,
    waters: [water],
    maps: {
      head: mapFrom(X, Z, { x0: padL, y0: atasY, x1: padL + plotW, y1: atasY + tinggiAtas }, [0, L], [0, zTop]),
    },
  };
}
