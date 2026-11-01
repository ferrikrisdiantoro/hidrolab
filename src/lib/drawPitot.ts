import { C, DASH, F, W, stencil, stencilWidth } from "./theme.ts";
import {
  axisTitle,
  axisValue,
  curveLabel,
  dimV,
  flowArrow,
  ground,
  leader,
  niceStep,
  pen,
  pipeBody,
  region,
  ruling,
  type PipeWall,
} from "./plate.ts";
import { powerLawVelocity, fmtPlain} from "./hydraulics.ts";
import { cl } from "./strings.ts";
import type { Lang } from "./i18n";
import { mapFrom, type PlateOut } from "./plateOut.ts";

export type PitotDrawState = {
  /** Diameter pipa, meter */
  D: number;
  /** Kecepatan di sumbu pipa */
  uMax: number;
  /** Kecepatan rata-rata penampang */
  uMean: number;
  /** Pangkat pada hukum pangkat */
  n: number;
  /** Jarak ujung tabung dari sumbu pipa, meter */
  rProbe: number;
  /** Jarak dari sumbu tempat kecepatan setempat sama dengan rata-rata */
  rMean: number;
  /** Kecepatan setempat pada ujung tabung */
  uProbe: number;
};

/**
 * DUA REGISTER BERDAMPINGAN PADA SATU SUMBU JARI-JARI.
 *
 * Kiri potongan pipa dengan tabung yang benar-benar berada pada kedalaman
 * yang dipilih, kanan profil kecepatannya. Sumbu tegak keduanya sama, jadi
 * ujung tabung dan titik bacaannya pada kurva selalu sejajar. Itu yang
 * membuat pertanyaan lembar ini terjawab dengan melihat: satu bacaan hanya
 * mewakili satu titik, kecuali titik itu dipilih dengan sengaja.
 *
 * Jari-jari acuan, tempat kecepatan setempat kebetulan sama dengan kecepatan
 * rata-rata penampang, ditandai pada kedua panel. Di situlah juru ukur
 * meletakkan tabungnya bila hanya sempat mengambil satu bacaan.
 */
export function drawPitot(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: PitotDrawState,
  lang: Lang
): PlateOut {
  const T = cl(lang);
  ground(ctx, w, h);

  const padT = 26;
  const padB = 52;

  const R = s.D / 2;
  const rMax = R * 1.5;
  const rStep = niceStep(rMax * 2, 6);
  const digits = rStep < 0.1 ? 3 : rStep < 1 ? 2 : 1;
  // Garis sumbu tegak di kelipatan rStep yang muat di [-rMax, rMax], supaya
  // 0 selalu bertanda di sumbu pipa. Dulu mulai dari -rMax: bila rMax bukan
  // kelipatan rStep (D 25 mm) angkanya ganjil (-0,019 ... 0,001 ... 0,016)
  // dan sumbu pipa bertanda 0,001.
  const rTicks: number[] = [];
  for (let k = Math.ceil(-rMax / rStep - 1e-9); k * rStep <= rMax + 1e-9; k++)
    rTicks.push(k === 0 ? 0 : k * rStep);

  // Cukup untuk angka sumbu tiga desimal DAN judul sumbu di sebelah kirinya;
  // pada 40 piksel judulnya menimpa angka. Angka di bawah sumbu pipa
  // bertanda minus (-0,050 dan seterusnya), jadi tepinya mengikuti angka
  // terlebar, sama seperti drawField.
  ctx.font = F.value;
  let lebarAngka = 0;
  for (const v of rTicks)
    lebarAngka = Math.max(lebarAngka, ctx.measureText(fmtPlain(v, digits)).width);
  const padKiri = Math.max(58, Math.ceil(lebarAngka) + 36);
  const padKanan = 26;
  const sela = 54;

  const lebarTotal = Math.max(20, w - padKiri - padKanan - sela);
  const pipaW = lebarTotal * 0.52;
  const kurvaW = lebarTotal - pipaW;
  const plotH = Math.max(10, h - padT - padB);

  const pipaX0 = padKiri;
  const kurvaX0 = padKiri + pipaW + sela;

  const Y = (r: number) => padT + plotH / 2 - (r / rMax) * (plotH / 2);

  const Lpipa = s.D * 4;
  const X = (x: number) => pipaX0 + (x / Lpipa) * pipaW;

  const uTop = s.uMax * 1.18;
  const XU = (u: number) => kurvaX0 + (u / uTop) * kurvaW;

  /* ---------------- kisi ---------------- */
  const hs: number[] = [];
  for (const v of rTicks) hs.push(Y(v));
  const uStep = niceStep(uTop, 4);
  const vsU: number[] = [];
  for (let v = 0; v <= uTop + 1e-9; v += uStep) vsU.push(XU(v));

  ruling(ctx, pipaX0, padT, pipaX0 + pipaW, padT + plotH, { horizontal: hs });
  ruling(ctx, kurvaX0, padT, kurvaX0 + kurvaW, padT + plotH, {
    horizontal: hs,
    vertical: vsU,
  });

  // Bertanda: di atas sumbu pipa positif, di bawahnya negatif. Tanpa tanda
  // kedua sisi terbaca sama dan pembaca tidak tahu sisi mana yang mana.
  for (const v of rTicks)
    axisValue(ctx, fmtPlain(v, digits), pipaX0 - 8, Y(v), "right", "middle");
  for (let v = 0; v <= uTop + 1e-9; v += uStep)
    axisValue(ctx, fmtPlain(v, 1), XU(v), padT + plotH + 9, "center", "top");

  // Dijepit ke dalam kanvas: di HP judulnya lebih lebar daripada panel
  // profil dan dulu terpotong di tepi kanan ("KECEPATAN SETEMPAT, M").
  ctx.font = F.label;
  const setengahJudul = stencilWidth(ctx, T.axVelocity, 1.1) / 2;
  axisTitle(
    ctx,
    T.axVelocity,
    Math.min(kurvaX0 + kurvaW / 2, w - 4 - setengahJudul),
    padT + plotH + 34
  );
  axisTitle(ctx, T.axRadius, 14, padT + plotH / 2, -Math.PI / 2);

  /* ---------------- panel kiri: potongan pipa ---------------- */
  const wall: PipeWall = [
    { x: 0, r: R },
    { x: Lpipa, r: R },
  ];

  ctx.save();
  ctx.beginPath();
  ctx.rect(X(0), Y(R), X(Lpipa) - X(0), Y(-R) - Y(R));
  ctx.clip();
  ctx.fillStyle = C.waterFill;
  ctx.fillRect(X(0), Y(R), X(Lpipa) - X(0), Y(-R) - Y(R));
  ctx.restore();

  pipeBody(ctx, wall, X, Y, {
    thickness: R * 0.12,
    clip: { x: pipaX0, y: padT, w: pipaW, h: plotH },
    axis: true,
  });

  // Panah kecepatan pada beberapa kedalaman: panjangnya kecepatan setempat.
  const skala = (pipaW / Lpipa) * s.D * 0.24;
  for (let i = -4; i <= 4; i++) {
    const r = (i / 5) * R;
    const u = powerLawVelocity(r, R, s.uMax, s.n);
    flowArrow(ctx, X(Lpipa * 0.3), Y(r), Math.max(6, u * skala), C.water);
  }

  /* ---------------- tabung Pitot ---------------- */
  const xProbe = Lpipa * 0.68;
  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  // Batang menembus dinding dari atas, lalu berbelok menghadap aliran.
  ctx.moveTo(X(xProbe), padT + 4);
  ctx.lineTo(X(xProbe), Y(s.rProbe));
  ctx.lineTo(X(xProbe) - 16, Y(s.rProbe));
  ctx.stroke();

  ctx.fillStyle = C.signal;
  ctx.beginPath();
  ctx.arc(X(xProbe) - 16, Y(s.rProbe), 2.8, 0, Math.PI * 2);
  ctx.fill();

  // Penunjuk mengarah menjauhi dinding terdekat, supaya tulisannya tidak
  // jatuh di dalam arsiran dinding saat tabung didekatkan ke sana.
  const arahPenunjuk: 1 | -1 = s.rProbe > 0.4 * R ? 1 : -1;

  /*
   * Batas tulisan penunjuk di panel pipa: kanan garis ukur D (angkanya di
   * kiri garis itu) sampai tepi kanan panel. Pada panel yang lebar (laptop)
   * kedua tulisan muat satu baris dan digambar persis seperti dulu. Pada
   * panel sempit (HP 390) tulisan satu baris keluar panel: ke kiri menimpa
   * judul sumbu, ke kanan memotong panel profil. Di situ tulisannya dipecah
   * per kata dan diletakkan di dalam panel, di sisi yang tidak dilintasi
   * batang tabung.
   */
  const batasKiri = X(Lpipa * 0.1) + 6;
  const batasKanan = pipaX0 + pipaW - 4;
  const xUjung = X(xProbe) - 16;
  const yUjung = Y(s.rProbe);
  ctx.font = F.label;
  if (xUjung - 36 - 18 - stencilWidth(ctx, T.stagnation) >= batasKiri) {
    leader(ctx, xUjung, yUjung, X(xProbe) - 52, yUjung + arahPenunjuk * 22, T.stagnation, C.signal);
  } else {
    // Di atas ujung tabung ada batang tabungnya, jadi blok tidak boleh
    // melewati batang itu; di bawahnya boleh sampai tepi panel.
    tulisanBlok(ctx, xUjung, yUjung, arahPenunjuk, T.stagnation, C.signal, batasKiri,
      arahPenunjuk < 0 ? X(xProbe) - 5 : batasKanan);
  }

  const yStatik = yUjung - (yUjung - padT) * 0.42;
  ctx.font = F.label;
  if (X(xProbe) + 24 + 18 + stencilWidth(ctx, T.staticPort) <= batasKanan) {
    leader(ctx, X(xProbe), yStatik, X(xProbe) + 24, yStatik - 10, T.staticPort, C.ink2);
  } else {
    // Rata kanan di kiri batang, dengan penunjuk pendek ke titik lubangnya.
    const kanan = X(xProbe) - 8;
    const baris = pecahBaris(ctx, T.staticPort, kanan - batasKiri);
    const tinggi = baris.length * 11;
    // Di dalam pipa, di atas ujung tabung dan blok nama titik stagnasinya.
    // Bila tidak muat di sana (tabung dekat dinding atas), di ruang kosong
    // di atas dinding atas pipa.
    const batasBawah = (arahPenunjuk < 0 ? yUjung - 20 - 11 * 2 : yUjung - 18) - 3;
    let atas = Math.max(yStatik - tinggi / 2, Y(R) + 4);
    if (atas + tinggi > batasBawah) atas = padT + 4;
    alasBaris(ctx, baris, kanan, atas, "right");
    pen(ctx, W.thin, C.ink2);
    ctx.beginPath();
    ctx.moveTo(X(xProbe), yStatik);
    ctx.lineTo(kanan + 2, atas + tinggi / 2);
    ctx.stroke();
    ctx.fillStyle = C.ink2;
    ctx.beginPath();
    ctx.arc(X(xProbe), yStatik, 1.8, 0, Math.PI * 2);
    ctx.fill();
    tulisBaris(ctx, baris, kanan, atas, "right", C.ink2);
  }

  dimV(ctx, X(Lpipa * 0.1), Y(R), Y(-R), `D ${fmtPlain((s.D * 1000), 0)} mm`, C.ink);

  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(pipaX0) + 0.5,
    Math.round(padT) + 0.5,
    Math.round(pipaW),
    Math.round(plotH)
  );

  /* ---------------- panel kanan: profil kecepatan ---------------- */
  pen(ctx, W.bold, C.water);
  ctx.beginPath();
  for (let i = 0; i <= 240; i++) {
    const r = -R + (2 * R * i) / 240;
    const u = powerLawVelocity(r, R, s.uMax, s.n);
    i ? ctx.lineTo(XU(u), Y(r)) : ctx.moveTo(XU(u), Y(r));
  }
  ctx.stroke();

  // Dinding pipa pada panel kurva, supaya batas profilnya jelas.
  pen(ctx, W.bold, C.ink);
  for (const r of [R, -R]) {
    ctx.beginPath();
    ctx.moveTo(kurvaX0, Y(r));
    ctx.lineTo(kurvaX0 + kurvaW, Y(r));
    ctx.stroke();
  }

  // Kecepatan rata-rata sebagai garis tegak, dan jari-jari acuan sebagai
  // garis mendatar yang melintasi kedua panel.
  pen(ctx, W.thin, C.energy, DASH.hidden);
  ctx.beginPath();
  ctx.moveTo(XU(s.uMean), Y(R));
  ctx.lineTo(XU(s.uMean), Y(-R));
  ctx.stroke();
  ctx.setLineDash([]);
  // Di sisi bawah panel dan rata kanan terhadap garisnya: di sisi atas ia
  // bertumpuk dengan label jari-jari acuan, dan rata kiri ia keluar bingkai
  // bila kecepatan rata-ratanya dekat tepi kanan.
  // Panel profil yang sempit (HP) tidak memuat tulisan ini satu baris di
  // kiri garisnya: tulisannya dipecah per kata ke atas, rata kanan pada
  // garis yang sama. Yang muat tetap satu baris seperti dulu.
  // Kotak blok ini disimpan supaya label bacaan tabung di bawah menghindarinya.
  const blokRata = { x0: 0, x1: 0, y0: 0, y1: 0 };
  {
    const teks = `${T.meanVelocity} ${fmtPlain(s.uMean, 3)}`;
    const kanan = XU(s.uMean) - 4;
    const ruang = kanan - (kurvaX0 + 6);
    ctx.font = F.labelSm;
    const baris =
      stencilWidth(ctx, teks, 0.6) <= ruang ? [teks] : pecahBaris(ctx, teks, ruang, F.labelSm, 0.6);
    ctx.font = F.labelSm;
    const lebarBlok = Math.max(...baris.map((b) => stencilWidth(ctx, b, 0.6)));
    const kananJepit = baris.length > 1 ? Math.max(kanan, kurvaX0 + 6 + lebarBlok) : kanan;
    /*
     * Titik bacaan tabung yang jatuh di dalam blok tulisan ini (tabung
     * dekat dinding bawah, kecepatannya dekat kecepatan rata-rata, misalnya
     * r = -0,9 R) dulu menimpa angkanya. Pada keadaan itu blok naik sampai
     * baris terbawahnya selesai 6 px di atas titik. Selain itu tidak
     * berubah tempat.
     */
    let yBawah = Y(-R) - 8;
    const px = XU(s.uProbe);
    const py = Y(s.rProbe);
    const bx0 = kananJepit - lebarBlok - 3;
    const bx1 = kananJepit + 3;
    const atasBlok = yBawah - (baris.length - 1) * 11 - 6;
    if (px + 3 > bx0 && px - 3 < bx1 && py + 3 > atasBlok && py - 3 < yBawah + 6)
      yBawah = Math.min(yBawah, py - 3 - 6 - 6);
    baris.forEach((b, i) =>
      curveLabel(ctx, b, kananJepit, yBawah - (baris.length - 1 - i) * 11, C.energy, "right")
    );
    blokRata.x0 = bx0;
    blokRata.x1 = bx1;
    blokRata.y0 = yBawah - (baris.length - 1) * 11 - 6;
    blokRata.y1 = yBawah + 6;
  }

  pen(ctx, W.thin, C.critical, DASH.axis);
  for (const r of [s.rMean, -s.rMean]) {
    ctx.beginPath();
    ctx.moveTo(pipaX0, Y(r));
    ctx.lineTo(kurvaX0 + kurvaW, Y(r));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  curveLabel(
    ctx,
    `r = ${fmtPlain((s.rMean / R), 3)} R`,
    kurvaX0 + kurvaW - 4,
    Y(s.rMean) - 9,
    C.critical,
    "right"
  );

  // Titik bacaan tabung pada kurva, sejajar dengan ujung tabung di panel kiri.
  pen(ctx, W.hair, C.signal, DASH.hidden);
  ctx.beginPath();
  ctx.moveTo(X(xProbe) - 16, Y(s.rProbe));
  ctx.lineTo(XU(s.uProbe), Y(s.rProbe));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = C.signal;
  ctx.beginPath();
  ctx.arc(XU(s.uProbe), Y(s.rProbe), 3, 0, Math.PI * 2);
  ctx.fill();
  // Di dekat dinding bawah, label bacaan turun ke bawah titiknya: di atas
  // titik ia bertumpuk dengan label kecepatan rata-rata yang duduk di sisi
  // bawah panel.
  // Rata kiri di kanan titiknya; bila itu menjorok keluar tepi kanan panel
  // (HP), rata kanan di kiri titiknya.
  /*
   * Kertas di bawah label (12 px) dulu menghapus garis dinding pada panel
   * profil saat tabung dekat dinding (r = ±0,9 R), memutus garis jari-jari
   * acuan, dan menimpa label r* atau blok kecepatan rata-rata. Calon letak
   * dicoba berurutan: sisi biasa, sisi seberang titik, lalu di luar
   * dinding terdekat (ruang kosong antara dinding dan bingkai, plotH/6).
   */
  {
    const teks = `${fmtPlain(s.uProbe, 3)} m/s`;
    const px = XU(s.uProbe);
    const py = Y(s.rProbe);
    ctx.font = F.labelSm;
    const lebar = stencilWidth(ctx, teks, 0.6);
    const muatKanan = px + 6 + lebar + 3 <= kurvaX0 + kurvaW - 2;
    const bx0 = muatKanan ? px + 3 : px - 6 - lebar - 3;
    const bx1 = bx0 + lebar + 6;
    ctx.font = F.labelSm;
    const lebarAcuan = stencilWidth(ctx, `r = ${fmtPlain(s.rMean / R, 3)} R`, 0.6);
    const ax1 = kurvaX0 + kurvaW - 1;
    const ax0 = ax1 - lebarAcuan - 6;
    const ay = Y(s.rMean) - 9;
    const bebas = (yb: number) => {
      const y0 = yb - 6;
      const y1 = yb + 6;
      for (const yw of [Y(R), Y(-R), Y(s.rMean), Y(-s.rMean)])
        if (y0 < yw + 1.5 && y1 > yw - 1.5) return false;
      if (bx0 < ax1 && bx1 > ax0 && y0 < ay + 6 && y1 > ay - 6) return false;
      if (bx0 < blokRata.x1 && bx1 > blokRata.x0 && y0 < blokRata.y1 && y1 > blokRata.y0) return false;
      return true;
    };
    const bawah = py + 16;
    const atas = py - 10;
    const calon = s.rProbe < -0.6 * R ? [bawah, atas] : [atas, bawah];
    const yb =
      calon.find(bebas) ?? (s.rProbe >= 0 ? Y(R) - 8 : Y(-R) + 8);
    if (muatKanan) curveLabel(ctx, teks, px + 6, yb, C.signal);
    else curveLabel(ctx, teks, px - 6, yb, C.signal, "right");
  }

  ctx.fillStyle = C.ink;
  ctx.font = F.heading;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  stencil(ctx, `1 / ${s.n}`, XU(s.uMax * 0.42), padT + 8, 2);
  region(ctx, T.powerLaw, XU(s.uMax * 0.42), padT + 28, C.ink3);

  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(kurvaX0) + 0.5,
    Math.round(padT) + 0.5,
    Math.round(kurvaW),
    Math.round(plotH)
  );

  /*
   * PlateOut, tidak menggambar apa pun. Peta utama = potongan pipa (jarak
   * sepanjang pipa dan jari-jari dari sumbu, meter). Profil kecepatan di
   * `maps.profile` (kecepatan m/s, jari-jari m; sumbu tegak sama).
   * - `probe`: ujung tabung (titik stagnasi), jari-jari rProbe
   * - `probeReading`: bacaan tabung pada kurva profil
   * - `meanRadius`: jari-jari acuan rMean pada garis kecepatan rata-rata
   * - `wall`: dinding atas pipa di dimensi D
   * `water` = isi pipa.
   */
  const frameY = { y0: padT, y1: padT + plotH };
  const map = mapFrom(X, Y, { x0: pipaX0, ...frameY, x1: pipaX0 + pipaW }, [0, Lpipa], [-rMax, rMax]);
  const water = Float64Array.of(X(0), Y(R), X(Lpipa), Y(R), X(Lpipa), Y(-R), X(0), Y(-R));
  return {
    map,
    anchors: {
      probe: { x: X(xProbe) - 16, y: Y(s.rProbe) },
      probeReading: { x: XU(s.uProbe), y: Y(s.rProbe) },
      meanRadius: { x: XU(s.uMean), y: Y(s.rMean) },
      wall: { x: X(Lpipa * 0.1), y: Y(R) },
    },
    water,
    waters: [water],
    maps: {
      profile: mapFrom(XU, Y, { x0: kurvaX0, ...frameY, x1: kurvaX0 + kurvaW }, [0, uTop], [-rMax, rMax]),
    },
  };
}

/* ---------------- tulisan penunjuk berbaris ---------------- */

/** Memecah tulisan per kata menjadi baris yang selebar paling banyak `lebar`. */
function pecahBaris(
  ctx: CanvasRenderingContext2D,
  teks: string,
  lebar: number,
  font: string = F.label,
  spacing = 0.8
): string[] {
  ctx.font = font;
  const kata = teks.split(" ");
  const baris: string[] = [];
  let kini = "";
  for (const k of kata) {
    const coba = kini ? `${kini} ${k}` : k;
    if (!kini || stencilWidth(ctx, coba, spacing) <= lebar) kini = coba;
    else {
      baris.push(kini);
      kini = k;
    }
  }
  if (kini) baris.push(kini);
  return baris;
}

/** Alas kertas seukuran tulisannya saja, bukan lebih. */
function alasBaris(
  ctx: CanvasRenderingContext2D,
  baris: string[],
  x: number,
  atas: number,
  align: "left" | "right"
) {
  ctx.font = F.label;
  ctx.fillStyle = C.sheet;
  baris.forEach((b, i) => {
    const l = stencilWidth(ctx, b);
    ctx.fillRect(align === "left" ? x - 1 : x - l - 1, atas + i * 11, l + 2, 11);
  });
}

function tulisBaris(
  ctx: CanvasRenderingContext2D,
  baris: string[],
  x: number,
  atas: number,
  align: "left" | "right",
  warna: string
) {
  ctx.font = F.label;
  ctx.fillStyle = warna;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  baris.forEach((b, i) => stencil(ctx, b, x, atas + i * 11 + 5.5));
}

/**
 * Nama titik sebagai blok berbaris di atas (arah -1) atau di bawah (+1)
 * titiknya, rata kiri mulai paling kiri `kiri` dan tidak melewati `kanan`,
 * dengan garis penunjuk lurus dari titik ke tepi blok terdekat. Dipakai bila
 * penunjuk bersiku biasa tidak muat di dalam panel.
 */
function tulisanBlok(
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  arah: 1 | -1,
  teks: string,
  warna: string,
  kiri: number,
  kanan: number
) {
  const baris = pecahBaris(ctx, teks, kanan - kiri);
  const tinggi = baris.length * 11;
  ctx.font = F.label;
  const lebar = Math.max(...baris.map((b) => stencilWidth(ctx, b)));
  // Blok dipusatkan pada titiknya bila muat, lalu dijepit ke batasnya.
  const x0 = Math.min(Math.max(fx - lebar / 2, kiri), Math.max(kiri, kanan - lebar));
  // 20 px dari titiknya: lebih dekat, tanda arah seret pegangan (13 sampai
  // 16 px di atas dan di bawah titik) menimpa baris terdekat.
  const atas = arah > 0 ? fy + 20 : fy - 20 - tinggi;
  alasBaris(ctx, baris, x0, atas, "left");
  const tx = Math.min(Math.max(fx, x0 + 2), x0 + lebar - 2);
  pen(ctx, W.thin, warna);
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(tx, arah > 0 ? atas : atas + tinggi);
  ctx.stroke();
  ctx.fillStyle = warna;
  ctx.beginPath();
  ctx.arc(fx, fy, 1.8, 0, Math.PI * 2);
  ctx.fill();
  tulisBaris(ctx, baris, x0, atas, "left", warna);
}
