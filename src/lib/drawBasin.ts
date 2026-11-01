import { C, DASH, F, W, stencil, stencilWidth } from "./theme.ts";
import { dimV, flowArrow, hatchSoil, hatchWater, imperviousBase, pen, region } from "./plate.ts";
import { fmtPlain } from "./hydraulics.ts";
import { linearMap, type PlateFrame, type PlateMap, type PlateOut } from "./plateOut.ts";

/**
 * PENGGAMBAR HIDROLOGI: waduk tampak samping (HY-01), peta DAS dengan awan
 * hujan (HY-02), penampang akuifer (GW-03).
 *
 * Ketiganya panel pendamping grafik deret waktu: lembar menggambar grafik
 * dengan drawChart di bagian bawah kanvas dan panel ini di bagian atas,
 * lalu kursor waktu yang sama menggerakkan keduanya. Karena itu tiap panel
 * dipecah dua:
 *
 * - bagian tetap (struktur, tanah, tanggul), digambar di lapis statis;
 * - bagian keadaan (muka air, panah aliran, awan), digambar oleh fungsi
 *   `...State` dari tata letak yang dikembalikan bagian tetap. Lapis statis
 *   memanggilnya sekali saat diam; lapis gerak memanggilnya tiap bingkai.
 *
 * Fungsi keadaan tidak membuat objek atau larik baru: ia hanya membaca
 * tata letak dan angka yang diberikan, jadi aman dipanggil 60 kali sedetik.
 *
 * Yang digambar membaca hasil model apa adanya. Bentuk yang tidak dihitung
 * model (lengkung muka air tanah, garis tepi waduk, bentuk DAS) digambar
 * skematik dan lembar menyatakannya dengan tulisan.
 */

/* ------------------------------------------------------------------ *
 * Bantu bersama
 * ------------------------------------------------------------------ */

/** PlateMap yang digeser (dx, dy) piksel: panel digambar sesudah ctx.translate. */
export function offsetMap(m: PlateMap, dx: number, dy: number): PlateMap {
  return {
    X: (v) => m.X(v) + dx,
    Y: (v) => m.Y(v) + dy,
    invX: (px) => m.invX(px - dx),
    invY: (py) => m.invY(py - dy),
    frame: { x0: m.frame.x0 + dx, y0: m.frame.y0 + dy, x1: m.frame.x1 + dx, y1: m.frame.y1 + dy },
  };
}

/** PlateOut yang digeser (dx, dy) piksel, termasuk anchors, labels, maps. */
export function offsetOut(o: PlateOut, dx: number, dy: number): PlateOut {
  const anchors: Record<string, { x: number; y: number }> = {};
  for (const k in o.anchors ?? {}) anchors[k] = { x: o.anchors![k].x + dx, y: o.anchors![k].y + dy };
  const maps: Record<string, PlateMap> = {};
  for (const k in o.maps ?? {}) maps[k] = offsetMap(o.maps![k], dx, dy);
  return {
    map: offsetMap(o.map, dx, dy),
    anchors,
    labels: (o.labels ?? []).map((r) => ({ ...r, x: r.x + dx, y: r.y + dy })),
    maps,
  };
}

/**
 * Indeks k dengan ts[k] ≤ t < ts[k+1] (pencarian biner), dijepit ke
 * [0, n − 2]. `ts` naik. Tanpa alokasi.
 */
function cariSelang(n: number, tAt: (i: number) => number, t: number): number {
  if (n < 2) return 0;
  let lo = 0;
  let hi = n - 1;
  if (t <= tAt(0)) return 0;
  if (t >= tAt(hi)) return n - 2;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (tAt(mid) <= t) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Kursor waktu di grafik: garis tegak tipis selebar bidang dan bulatan di
 * tiap titik kurva yang dibaca. Dipakai lapis statis dan lapis gerak, jadi
 * kursor diam dan kursor bergerak identik.
 */
export function drawTimeCursor(
  ctx: CanvasRenderingContext2D,
  map: PlateMap,
  t: number,
  dots: readonly (readonly [number, string])[]
): void {
  const f = map.frame;
  const x = map.X(t);
  if (!(x >= f.x0 - 0.5 && x <= f.x1 + 0.5)) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
  ctx.clip();
  pen(ctx, W.thin, C.ink2, DASH.hidden);
  ctx.beginPath();
  ctx.moveTo(Math.round(x) + 0.5, f.y0);
  ctx.lineTo(Math.round(x) + 0.5, f.y1);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const [y, warna] of dots) {
    if (!Number.isFinite(y)) continue;
    const py = map.Y(y);
    pen(ctx, W.thin, warna);
    ctx.fillStyle = C.sheet;
    ctx.beginPath();
    ctx.arc(x, py, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Tulisan kecil berlatar kertas, tanpa penempat (posisinya disediakan tata letak). */
function tulis(
  ctx: CanvasRenderingContext2D,
  teks: string,
  x: number,
  y: number,
  warna: string,
  align: CanvasTextAlign = "left"
) {
  ctx.font = F.region;
  const lebar = stencilWidth(ctx, teks, 1.4);
  const kiri = align === "left" ? x : align === "right" ? x - lebar : x - lebar / 2;
  ctx.fillStyle = C.sheet;
  ctx.fillRect(kiri - 3, y - 7, lebar + 6, 14);
  region(ctx, teks, x, y, warna, 0, align);
}

/** Angka besaran berlatar kertas, huruf apa adanya (lambang tidak dikapitalkan). */
function tulisNilai(
  ctx: CanvasRenderingContext2D,
  teks: string,
  x: number,
  y: number,
  warna: string,
  align: CanvasTextAlign = "left"
) {
  ctx.font = F.value;
  const lebar = ctx.measureText(teks).width;
  const kiri = align === "left" ? x : align === "right" ? x - lebar : x - lebar / 2;
  ctx.fillStyle = C.sheet;
  ctx.fillRect(kiri - 3, y - 7, lebar + 6, 14);
  ctx.fillStyle = warna;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(teks, x, y);
}

/** Panah tegak (ke bawah bila panjang positif), panjang sebanding nilai. */
function panahTegak(ctx: CanvasRenderingContext2D, x: number, y: number, panjang: number, warna: string) {
  if (Math.abs(panjang) < 1) return;
  const kepala = Math.min(5, Math.abs(panjang) * 0.4);
  const arah = Math.sign(panjang);
  pen(ctx, W.thin, warna);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + panjang);
  ctx.moveTo(x - kepala * 0.6, y + panjang - arah * kepala);
  ctx.lineTo(x, y + panjang);
  ctx.lineTo(x + kepala * 0.6, y + panjang - arah * kepala);
  ctx.stroke();
}

/* ------------------------------------------------------------------ *
 * GW-03 Penampang akuifer
 * ------------------------------------------------------------------ */

export type AquiferSectionSpec = {
  /** Tinggi muka air tanah di atas ambang keluaran (muka air sungai), m */
  head: number;
  /** Rentang tinggi muka air sepanjang musim, m; menetapkan skala tegak */
  minHead: number;
  maxHead: number;
  /** Imbuhan saat ini, mm/hari (boleh negatif) */
  recharge: number;
  /** Keluaran ke sungai saat ini, mm/hari (negatif bila muka air di bawah ambang) */
  outflow: number;
  /** Pemompaan tetap, mm/hari */
  pumping: number;
  /** Nilai terbesar |R|, |q|, P sepanjang musim; menetapkan skala panah */
  fluxMax: number;
  /** Specific yield, untuk baris neraca */
  Sy: number;
};

export type AquiferLabels = {
  ground: string;
  aquifer: string;
  river: string;
  well: string;
  base: string;
  schematic: string;
  /** Satuan laju, "mm/hari" atau "mm/day" */
  unit: string;
  /** Tulisan bila keluaran negatif (di luar berlaku) */
  reversed: string;
};

/** Tata letak penampang, dipakai drawAquiferState. Piksel setempat panel. */
export type AquiferLayout = {
  map: PlateMap;
  /** Absis ternormal ξ: 0 = garis pemisah kiri, 1 = tebing sungai */
  xiRiver: number;
  xiWell: number;
  xiRecharge: readonly number[];
  /** Panjang panah terpanjang, px */
  arrowMax: number;
  fluxMax: number;
  Sy: number;
  pumping: number;
  /** Elevasi muka tanah pada ξ, m */
  groundAt: (xi: number) => number;
  zBase: number;
  /** Baris neraca: ordinat dan absis kiri */
  balanceY: number;
  balanceX: number;
  labels: AquiferLabels;
};

/** Lengkung skematik muka air tanah: z(ξ) = h·√(1 − ξ²), nol di tebing sungai. */
export function aquiferTableShape(head: number, xi: number): number {
  const s = Math.min(Math.max(xi, 0), 1);
  return head * Math.sqrt(1 - s * s);
}

/**
 * Bagian tetap penampang akuifer: tanah, lapisan kedap, sungai, sumur.
 * Bila `withState`, keadaan (muka air, panah, neraca) ikut digambar dari s.
 * Mengembalikan PlateOut (map = ξ terhadap elevasi) dan tata letaknya.
 */
export function drawAquiferSection(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: AquiferSectionSpec,
  opts: { labels: AquiferLabels; withState: boolean; padL?: number; padR?: number }
): { out: PlateOut; layout: AquiferLayout } {
  const sempit = w < 600;
  const padL = sempit ? 12 : (opts.padL ?? 62);
  const padR = sempit ? 12 : (opts.padR ?? 30);
  /* Baris atas untuk neraca, di kiri tombol putar (pojok kanan atas). */
  const padT = 30;
  const padB = 14;
  const frame: PlateFrame = { x0: padL, y0: padT, x1: Math.max(padL + 10, w - padR), y1: Math.max(padT + 10, h - padB) };
  const tinggi = frame.y1 - frame.y0;
  const arrowMax = Math.max(16, Math.min(40, tinggi * 0.22));

  const zLo = Math.min(s.minHead, 0);
  const span = Math.max(s.maxHead - zLo, 0.2);
  const zGround = Math.max(s.maxHead, 0) + 0.7 * span;
  const zBase = zLo - 0.55 * span;
  /* Ruang di atas muka tanah tertinggi untuk panah imbuhan terpanjang. */
  const atas = arrowMax + 14;
  const zTop = zGround + (atas / Math.max(tinggi - atas, 10)) * (zGround - zBase);
  const xiMax = 1.28;
  const map = linearMap(frame, [0, xiMax], [zBase, zTop]);
  const X = map.X;
  const Y = map.Y;

  const xiBank = 1;
  const zBank = 0.3 * span;
  const groundAt = (xi: number) =>
    xi <= xiBank
      ? zGround - (zGround - zBank) * Math.pow(Math.min(Math.max(xi, 0), 1), 1.6)
      : zBank;
  const zBed = zLo - 0.28 * span;
  const xiBedL = 1.06;
  const xiBedR = 1.2;
  /* Tepi air sungai (z = 0) di tebing kiri alur: muka air tanah berakhir
     di sini, karena muka sungai adalah ambang keluarannya. */
  const xiRiver = xiBank + (xiBedL - xiBank) * (zBank / Math.max(zBank - zBed, 1e-9));
  const xiRiverR = xiBedR + (xiMax - xiBedR) * ((0 - zBed) / Math.max(zBank - zBed, 1e-9));

  /* Tanah: dari muka tanah sampai lapisan kedap, kecuali alur sungai. */
  const garisTanah = (c: CanvasRenderingContext2D) => {
    c.moveTo(X(0), Y(zBase));
    c.lineTo(X(0), Y(groundAt(0)));
    for (let i = 1; i <= 40; i++) {
      const xi = (xiBank * i) / 40;
      c.lineTo(X(xi), Y(groundAt(xi)));
    }
    c.lineTo(X(xiBedL), Y(zBed));
    c.lineTo(X(xiBedR), Y(zBed));
    c.lineTo(X(xiMax), Y(zBank));
    c.lineTo(X(xiMax), Y(zBase));
    c.closePath();
  };
  ctx.save();
  ctx.beginPath();
  garisTanah(ctx);
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = C.soil;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.clip();
  hatchSoil(ctx, frame.x0, frame.y0, frame.x1 - frame.x0, frame.y1 - frame.y0, 11);
  ctx.restore();

  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  ctx.moveTo(X(0), Y(groundAt(0)));
  for (let i = 1; i <= 40; i++) {
    const xi = (xiBank * i) / 40;
    ctx.lineTo(X(xi), Y(groundAt(xi)));
  }
  ctx.lineTo(X(xiBedL), Y(zBed));
  ctx.lineTo(X(xiBedR), Y(zBed));
  ctx.lineTo(X(xiMax), Y(zBank));
  ctx.stroke();
  imperviousBase(ctx, X(0), X(xiMax), Y(zBase));

  /* Sungai: muka air sungai = ambang keluaran (z = 0). Tetap, karena model
     tidak menghitung muka sungai (sungai ke akuifer tidak dimodelkan). */
  const xL = X(xiRiver);
  const xR = X(xiRiverR);
  ctx.beginPath();
  ctx.moveTo(xL, Y(0));
  ctx.lineTo(X(xiBedL), Y(zBed));
  ctx.lineTo(X(xiBedR), Y(zBed));
  ctx.lineTo(xR, Y(0));
  ctx.closePath();
  ctx.fillStyle = C.waterFillDeep;
  ctx.fill();
  pen(ctx, W.bold, C.water);
  ctx.beginPath();
  ctx.moveTo(xL, Y(0) + 0.5);
  ctx.lineTo(xR, Y(0) + 0.5);
  ctx.stroke();

  /* Sumur pompa */
  const xiWell = 0.32;
  const xw = X(xiWell);
  const yTopWell = Y(groundAt(xiWell)) - 8;
  const yBotWell = Y(zLo - 0.2 * span);
  pen(ctx, W.thin, C.ink);
  ctx.beginPath();
  ctx.moveTo(xw - 3, yTopWell);
  ctx.lineTo(xw - 3, yBotWell);
  ctx.moveTo(xw + 3, yTopWell);
  ctx.lineTo(xw + 3, yBotWell);
  ctx.stroke();
  pen(ctx, W.hair, C.ink2, DASH.hidden);
  ctx.beginPath();
  ctx.moveTo(xw - 3, yBotWell - 14);
  ctx.lineTo(xw + 3, yBotWell - 14);
  ctx.stroke();
  ctx.setLineDash([]);

  /* Nama bagian, di tempat yang tidak dilewati panah */
  const L = opts.labels;
  tulis(ctx, L.river, (xL + xR) / 2, Y(zBed) + 10 > frame.y1 - 4 ? Y(zBed) - 8 : Y(zBed) + 10, C.water, "center");
  tulis(ctx, sempit ? L.aquifer : `${L.aquifer} (${L.schematic})`, X(0.55), Y(zBase) - 12, C.ink2, "center");
  tulis(ctx, L.well, xw + 7, yBotWell - 6, C.ink2, "left");

  const layout: AquiferLayout = {
    map,
    xiRiver,
    xiWell,
    xiRecharge: [0.1, 0.52, 0.74],
    arrowMax,
    fluxMax: Math.max(s.fluxMax, 1e-9),
    Sy: s.Sy,
    pumping: s.pumping,
    groundAt,
    zBase,
    balanceY: 14,
    balanceX: frame.x0 + 2,
    labels: L,
  };

  if (opts.withState) drawAquiferState(ctx, layout, s.head, s.recharge, s.outflow);

  const out: PlateOut = {
    map,
    anchors: { table: { x: X(0.5), y: Y(aquiferTableShape(s.head, 0.5 / xiRiver)) } },
  };
  return { out, layout };
}

/**
 * Keadaan penampang pada satu saat: muka air tanah, air jenuh diarsir,
 * panah imbuhan, keluaran, dan pemompaan sebanding laju, dan baris neraca
 * Sy·dh/dt = R − P − q. Tanpa alokasi.
 */
export function drawAquiferState(
  ctx: CanvasRenderingContext2D,
  L: AquiferLayout,
  head: number,
  recharge: number,
  outflow: number
): void {
  const { map } = L;
  const X = map.X;
  const Y = map.Y;
  const f = map.frame;
  const balik = outflow < 0;
  const warnaMuka = balik ? C.signal : C.water;

  /* Zona jenuh: dari lapisan kedap sampai muka air tanah, diarsir air. */
  const n = 32;
  const jenuh = (c: CanvasRenderingContext2D) => {
    c.beginPath();
    c.moveTo(X(0), Y(L.zBase));
    for (let i = 0; i <= n; i++) {
      const xi = (L.xiRiver * i) / n;
      c.lineTo(X(xi), Y(Math.min(aquiferTableShape(head, xi / L.xiRiver), L.groundAt(xi))));
    }
    c.lineTo(X(L.xiRiver), Y(L.zBase));
    c.closePath();
  };
  ctx.save();
  jenuh(ctx);
  ctx.fillStyle = C.waterFill;
  ctx.fill();
  ctx.restore();
  hatchWater(ctx, () => jenuh(ctx), f.x0, f.x1, Y(Math.max(head, 0)) + 6, Y(L.zBase), 10);

  pen(ctx, W.bold, warnaMuka, balik ? DASH.invalid : DASH.solid);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const xi = (L.xiRiver * i) / n;
    const z = Math.min(aquiferTableShape(head, xi / L.xiRiver), L.groundAt(xi));
    if (i === 0) ctx.moveTo(X(xi), Y(z));
    else ctx.lineTo(X(xi), Y(z));
  }
  ctx.stroke();
  ctx.setLineDash([]);
  /* Segitiga muka air (konvensi gambar teknik) di atas lengkungnya */
  const xm = X(0.2);
  const ym = Y(aquiferTableShape(head, 0.2 / L.xiRiver));
  pen(ctx, W.thin, warnaMuka);
  ctx.beginPath();
  ctx.moveTo(xm - 5, ym - 8);
  ctx.lineTo(xm + 5, ym - 8);
  ctx.lineTo(xm, ym - 1);
  ctx.closePath();
  ctx.stroke();

  /* Tinggi h di garis pemisah kiri, dari ambang (muka sungai) */
  if (Math.abs(Y(head) - Y(0)) > 4) {
    pen(ctx, W.hair, C.ink3, DASH.axis);
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0) + 0.5);
    ctx.lineTo(X(L.xiRiver), Y(0) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    dimV(ctx, X(0) + 12, Y(Math.max(head, 0)), Y(Math.min(head, 0)), `${fmtPlain(head, 2)} m`, warnaMuka);
  }

  /* Panah, panjang sebanding laju; skala tetap sepanjang musim */
  const k = L.arrowMax / L.fluxMax;
  const warnaR = recharge < 0 ? C.caution : C.water;
  for (const xi of L.xiRecharge) {
    const y0 = Y(L.groundAt(xi)) - 4 - Math.max(0, recharge * k);
    panahTegak(ctx, X(xi), recharge >= 0 ? y0 : Y(L.groundAt(xi)) - 2, recharge * k, warnaR);
  }
  const xi1 = L.xiRecharge[1];
  tulisNilai(ctx, `R ${fmtPlain(recharge, 2)}`, X(xi1) + 6, Y(L.groundAt(xi1)) - 6 - Math.abs(recharge * k) * 0.5, warnaR);

  if (L.pumping > 0) {
    const xw = X(L.xiWell);
    const yTop = Y(L.groundAt(L.xiWell)) - 10;
    panahTegak(ctx, xw, yTop, -L.pumping * k, C.critical);
    tulisNilai(ctx, `P ${fmtPlain(L.pumping, 2)}`, xw + 6, yTop - L.pumping * k * 0.6, C.critical);
  }

  const zq = Math.min(aquiferTableShape(head, 0.9 / L.xiRiver), L.groundAt(0.9));
  const yq = Math.min(Y(zq) + 10, Y(L.zBase) - 6);
  const xq = X(0.9);
  const pq = outflow * k;
  const warnaQ = balik ? C.signal : C.water;
  flowArrow(ctx, xq + pq / 2, yq, pq, warnaQ);
  tulisNilai(ctx, `q ${fmtPlain(outflow, 2)}`, xq - 4, yq + 13 > f.y1 - 6 ? yq - 12 : yq + 13, warnaQ, "right");

  /* Baris neraca: tampungan berubah sebesar sisanya */
  const dS = recharge - L.pumping - outflow;
  const teks = `Sy·dh/dt = R − P − q = ${fmtPlain(recharge, 2)} − ${fmtPlain(L.pumping, 2)} − ${fmtPlain(outflow, 2)} = ${fmtPlain(dS, 2)} ${L.labels.unit}`;
  /* Rumus ditulis apa adanya (tidak dikapitalkan): Sy, h, q, P berbeda arti
     dengan SY, H, Q. Ruang sampai 48 px dari tepi kanan, tempat tombol putar. */
  ctx.font = F.value;
  const ruang = f.x1 - L.balanceX - 40;
  const pendek = `R − P − q = ${fmtPlain(dS, 2)} ${L.labels.unit}`;
  const tampil = ctx.measureText(teks).width <= ruang ? teks : pendek;
  ctx.fillStyle = C.ink;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(tampil, L.balanceX, L.balanceY);
  if (balik) tulis(ctx, L.labels.reversed, (f.x0 + f.x1) / 2, f.y0 + 10, C.signal, "center");
}

/**
 * Keadaan akuifer pada hari t, dibaca dari deret model (interpolasi lurus
 * antara dua titik deret; tepat sama dengan deret di titik deretnya).
 * Hasil ditulis ke `out` supaya lapis gerak tidak membuat objek.
 */
export function readAquifer(
  series: readonly { t: number; head: number; recharge: number; outflow: number }[],
  t: number,
  out: { head: number; recharge: number; outflow: number }
): void {
  const n = series.length;
  if (n === 0) {
    out.head = out.recharge = out.outflow = 0;
    return;
  }
  if (n === 1) {
    out.head = series[0].head;
    out.recharge = series[0].recharge;
    out.outflow = series[0].outflow;
    return;
  }
  const k = cariSelang(n, (i) => series[i].t, t);
  const a = series[k];
  const b = series[k + 1];
  const u = Math.min(Math.max((t - a.t) / (b.t - a.t || 1), 0), 1);
  out.head = a.head + (b.head - a.head) * u;
  out.recharge = a.recharge + (b.recharge - a.recharge) * u;
  out.outflow = a.outflow + (b.outflow - a.outflow) * u;
}
