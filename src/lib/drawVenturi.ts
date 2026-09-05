import { C, DASH, F, W, stencil } from "./theme";
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
} from "./plate";
import { cl } from "./strings";
import type { Lang } from "./i18n";

export type VenturiDrawState = {
  /** Garis tengah pipa, meter */
  D1: number;
  /** Garis tengah leher, meter */
  D2: number;
  /** Kecepatan di pipa dan di leher */
  V1: number;
  V2: number;
  /** Beda tinggi tekan antara pipa dan leher, meter */
  dh: number;
  /** Kehilangan tekanan tetap sesudah alat, meter */
  permanentLoss: number;
  /** Di luar rentang perbandingan garis tengah yang lazim */
  outOfRange: boolean;
};

/**
 * DUA REGISTER BERTUMPUK PADA SATU SUMBU JARAK.
 *
 * Panel atas garis tinggi tekan, panel bawah potongan pipanya. Keduanya
 * dipisah karena skalanya memang tidak sebanding: tinggi tekan diukur dalam
 * meter kolom air sedangkan garis tengah pipa dalam sentimeter, dan
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
) {
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

  /* -------- geometri venturi dalam satuan garis tengah pipa --------
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

  const rMax = (s.D1 / 2) * 1.55;
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
    axisValue(ctx, v.toFixed(digits), padL - 8, Z(v), "right", "middle");
  for (let v = 0; v <= L + 1e-9; v += xStep)
    axisValue(
      ctx,
      v.toFixed(2),
      X(v),
      bawahY + tinggiBawah + 9,
      "center",
      "top"
    );

  axisTitle(ctx, T.axStation, padL + plotW / 2, bawahY + tinggiBawah + 34);
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

  dimV(
    ctx,
    X((a2 + a3) / 2),
    Z(zMasuk),
    Z(zLeher),
    `Δh ${s.dh.toFixed(4)} m`,
    C.energy
  );
  dimV(
    ctx,
    X(L) - 26,
    Z(zMasuk),
    Z(zPulih),
    `${s.permanentLoss.toFixed(4)} m`,
    C.signal
  );

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

  // Titik ukur tekanan: satu di pipa, satu di leher.
  for (const [x, teks] of [
    [a1 * 0.6, "1"],
    [(a2 + a3) / 2, "2"],
  ] as const) {
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
    `D₁ ${(s.D1 * 1000).toFixed(0)} mm`,
    C.ink
  );
  dimV(
    ctx,
    X((a2 + a3) / 2) + 30,
    R(s.D2 / 2),
    R(-s.D2 / 2),
    `D₂ ${(s.D2 * 1000).toFixed(0)} mm`,
    s.outOfRange ? C.signal : C.ink
  );

  ctx.fillStyle = C.ink;
  ctx.font = F.heading;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  stencil(ctx, T.throatSection, X((a2 + a3) / 2), bawahY + tinggiBawah - 12, 2);

  region(ctx, T.upstream, X(a1 * 0.5), bawahY + 12, C.ink3);
  region(ctx, T.downstream, X(a4 + xKeluar * 0.5), bawahY + 12, C.ink3);

  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(padL) + 0.5,
    Math.round(bawahY) + 0.5,
    Math.round(plotW),
    Math.round(tinggiBawah)
  );
}
