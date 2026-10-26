import { C, DASH, F, W, stencil, stencilWidth } from "./theme.ts";
import {
  axisTitle,
  axisValue,
  curveLabel,
  dimH,
  dimV,
  fitHeading,
  ground,
  hatchConcrete,
  hatchWater,
  leader,
  niceStep,
  pen,
  region,
  ruling,
} from "./plate.ts";
import { G, WES_K, WES_N, jetTrajectory, wesNappe, fmtPlain } from "./hydraulics.ts";
import {
  createJetPath,
  drawJet,
  finishJetPath,
  jetKeyChanged,
  type JetMotion,
  type JetPath,
  JET_MAX,
} from "./jetMotion.ts";
import { cl } from "./strings.ts";
import type { Lang } from "./i18n";
import { mapFrom, type PlateOut } from "./plateOut.ts";

/**
 * Jumlah ruas muka air hulu dari tepi kiri sampai mercu. Lengkung tajam
 * penurunan di dekat mercu (nappeHeadwater) butuh ruas rapat supaya tidak
 * bersegi.
 */
const N_HULU = 180;

export type NappeState = {
  /** Tinggi muka air di atas puncak mercu, meter */
  h: number;
  /** Tinggi mercu di atas lantai hilir, meter */
  P: number;
  /** Kecepatan rata-rata di atas mercu, meter per detik (lintasan peluru) */
  V0: number;
  /** Debit per meter lebar, m²/s (tebal lembaran tirai) */
  q: number;
  /** Muka air hilir di atas lantai, meter */
  tail: number;
  /** Di luar rentang keberlakuan standar */
  outOfRange: boolean;
  /** Rongga di bawah tirai diberi udara */
  aerated: boolean;
};

/**
 * POTONGAN MELINTANG AMBANG TAJAM DENGAN TIRAI LUAPAN BEBAS.
 *
 * Yang harus terbaca dari gambar ini ada tiga, dan ketiganya menuntut potongan
 * tegak, bukan grafik:
 *
 * - Bentuk tirai itu sendiri, yang bukan parabola. Lintasan peluru digambar
 *   berdampingan sebagai garis khayal supaya selisihnya terlihat, bukan
 *   diceritakan.
 * - Rongga udara di bawah tirai. Rongga inilah yang menentukan apakah tirai
 *   bekerja sebagaimana rumus debitnya mengandaikan.
 * - Muka air hilir terhadap puncak mercu. Begitu ia naik melewati puncak,
 *   ambangnya tenggelam dan seluruh perhitungan debitnya gugur.
 */
export function drawNappe(
  ctx: CanvasRenderingContext2D,
  w: number,
  hCanvas: number,
  s: NappeState,
  lang: Lang
): PlateOut {
  const T = cl(lang);
  ground(ctx, w, hCanvas);

  const padL = 58;
  const padR = 30;
  const padT = 26;
  const padB = 52;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = Math.max(10, hCanvas - padT - padB);

  // Jarak jatuh tirai sampai lantai, dipakai menentukan lebar bidang gambar.
  const xJatuh =
    s.h > 0 ? Math.pow(2 * Math.pow(s.h, 0.85) * Math.max(s.P, 0.01), 1 / 1.85) : 0.1;

  const xKiri = -Math.max(3 * s.h, 0.3);
  const xKanan = Math.max(xJatuh * 1.25, s.h * 2.5, 0.3);
  const spanX = xKanan - xKiri;
  const zAtas = Math.max(s.P + s.h * 1.6, s.P * 1.25, 0.3);

  const X = (x: number) => padL + ((x - xKiri) / spanX) * plotW;
  const Z = (z: number) => padT + plotH - (z / zAtas) * plotH;

  /* ---------------- kisi dan sumbu ---------------- */
  const zStep = niceStep(zAtas, 5);
  const xStep = niceStep(spanX, 6);
  const hs: number[] = [];
  const vs: number[] = [];
  for (let v = 0; v <= zAtas + 1e-9; v += zStep) hs.push(Z(v));
  for (let v = Math.ceil(xKiri / xStep) * xStep; v <= xKanan + 1e-9; v += xStep)
    vs.push(X(v));
  ruling(ctx, padL, padT, padL + plotW, padT + plotH, {
    horizontal: hs,
    vertical: vs,
  });

  const digits = zStep < 0.1 ? 2 : zStep < 1 ? 1 : 0;
  for (let v = 0; v <= zAtas + 1e-9; v += zStep)
    axisValue(ctx, fmtPlain(v, digits), padL - 8, Z(v), "right", "middle");
  for (let v = Math.ceil(xKiri / xStep) * xStep; v <= xKanan + 1e-9; v += xStep)
    axisValue(ctx, fmtPlain(v, digits), X(v), padT + plotH + 9, "center", "top");

  axisTitle(ctx, T.axStation, padL + plotW / 2, padT + plotH + 34);
  axisTitle(ctx, T.elevation, 16, padT + plotH / 2, -Math.PI / 2);

  const tenggelam = s.tail > s.P;

  /* ---------------- tirai luapan ---------------- */
  const langkah = 160;
  const tirai: [number, number][] = [];
  for (let i = 0; i <= langkah; i++) {
    const x = (i / langkah) * xKanan;
    const z = s.P - wesNappe(s.h, x);
    if (z < 0) break;
    tirai.push([x, z]);
  }
  if (tirai.length === 0) tirai.push([0, s.P]);

  /* ---------------- badan air di hulu ----------------
     Muka air mulai turun kira-kira dua kali tinggi luapan sebelum mercu.
     Penurunan itu digambar, karena tanpa itu gambar menyiratkan muka air
     mendatar sampai ke bibir mercu, dan itu tidak benar. */
  const mukaHulu = (x: number) => nappeHeadwater(s.h, s.P, x);

  /*
   * Genangan hulu saja: dari muka air hulu turun ke lantai di muka ambang.
   *
   * Dulu jalur ini menyambung terus sepanjang tirai lalu ditutup dengan
   * garis miring dari puncak mercu ke pojok kiri bawah. Akibatnya rongga di
   * bawah tirai, yang berisi UDARA dan diberi nama "rongga udara", diwarnai
   * sebagai air, dan sepertiga bawah genangan hulu justru kosong. Tirai
   * adalah sisi BAWAH lembaran air yang jatuh (bentuk WES); airnya berada
   * di atas garis itu, bukan di bawahnya.
   */
  const jalurAir = () => {
    ctx.beginPath();
    ctx.moveTo(X(xKiri), Z(0));
    ctx.lineTo(X(xKiri), Z(mukaHulu(xKiri)));
    for (let i = 0; i <= N_HULU; i++) {
      const x = xKiri + ((0 - xKiri) * i) / N_HULU;
      ctx.lineTo(X(x), Z(mukaHulu(x)));
    }
    ctx.lineTo(X(0), Z(0));
    ctx.closePath();
  };

  ctx.save();
  jalurAir();
  ctx.fillStyle = C.waterFill;
  ctx.fill();
  ctx.restore();
  hatchWater(ctx, jalurAir, padL, X(0), padT + 4, Z(0), 10);

  /* ---------------- muka air hilir ---------------- */
  if (s.tail > 0) {
    const jalurHilir = () => {
      ctx.beginPath();
      ctx.moveTo(X(xJatuh * 0.2), Z(0));
      ctx.lineTo(X(xJatuh * 0.2), Z(s.tail));
      ctx.lineTo(X(xKanan), Z(s.tail));
      ctx.lineTo(X(xKanan), Z(0));
      ctx.closePath();
    };
    ctx.save();
    jalurHilir();
    ctx.fillStyle = C.waterFill;
    ctx.fill();
    ctx.restore();
    hatchWater(ctx, jalurHilir, X(xJatuh * 0.2), padL + plotW, Z(s.tail), Z(0), 10);

    pen(ctx, W.bold, C.water);
    ctx.beginPath();
    ctx.moveTo(X(xJatuh * 0.2), Z(s.tail));
    ctx.lineTo(X(xKanan), Z(s.tail));
    ctx.stroke();
    curveLabel(ctx, T.tailwater, X(xKanan) - 4, Z(s.tail) - 10, C.water, "right");
  }

  /* ---------------- lintasan peluru sebagai pembanding ---------------- */
  pen(ctx, W.hair, C.ink3, DASH.phantom);
  ctx.beginPath();
  let mulai = false;
  for (let i = 0; i <= langkah; i++) {
    const x = (i / langkah) * xKanan;
    const z = s.P - jetTrajectory(s.V0, x);
    if (z < 0) break;
    mulai ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z));
    mulai = true;
  }
  ctx.stroke();
  ctx.setLineDash([]);
  curveLabel(
    ctx,
    T.projectile,
    X(xKanan * 0.55),
    Z(Math.max(0, s.P - jetTrajectory(s.V0, xKanan * 0.55))) + 12,
    C.ink3
  );

  /* ---------------- muka air hulu ---------------- */
  pen(ctx, W.bold, C.water);
  ctx.beginPath();
  for (let i = 0; i <= N_HULU; i++) {
    const x = xKiri + ((0 - xKiri) * i) / N_HULU;
    i ? ctx.lineTo(X(x), Z(mukaHulu(x))) : ctx.moveTo(X(x), Z(mukaHulu(x)));
  }
  ctx.stroke();

  /* ---------------- lembaran air tirai ----------------
     Sisi bawah WES ditambah tebal t(x) tegak lurus lintasan (nappeSheet,
     tabel yang sama dengan lapis gerak), diisi warna air. Dengan ini
     lembaran air terlihat juga saat gerak dijeda, sisi atasnya menyambung
     muka hulu di x = 0, dan rongga di bawah sisi bawah tetap kosong
     (udara). Ambang tenggelam tidak punya lembaran bebas. */
  const lembaran = tenggelam ? null : nappeSheet({ h: s.h, P: s.P, q: s.q, tail: s.tail });
  if (lembaran) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(padL, padT, plotW, plotH);
    ctx.clip();
    ctx.beginPath();
    for (let i = 0; i < lembaran.length; i += 2)
      i ? ctx.lineTo(X(lembaran[i]), Z(lembaran[i + 1])) : ctx.moveTo(X(lembaran[i]), Z(lembaran[i + 1]));
    ctx.closePath();
    ctx.fillStyle = C.waterFill;
    ctx.fill();
    // Sisi atas lembaran: muka air bebas, garis tipis (sisi bawah = tirai
    // tebal di bawah). Titik sisi atas mengisi separuh akhir larik, dari
    // ujung bawah kembali ke bibir.
    const nBawah = (lembaran.length + 4) / 6;
    pen(ctx, W.thin, C.water);
    ctx.beginPath();
    for (let i = lembaran.length - 2, k = 0; i >= 2 * nBawah; i -= 2, k++)
      k ? ctx.lineTo(X(lembaran[i]), Z(lembaran[i + 1])) : ctx.moveTo(X(lembaran[i]), Z(lembaran[i + 1]));
    ctx.stroke();
    ctx.restore();
  }

  /* ---------------- tirai ---------------- */
  pen(
    ctx,
    s.outOfRange ? W.thin : W.bold,
    C.water,
    s.outOfRange ? DASH.invalid : DASH.solid
  );
  ctx.beginPath();
  tirai.forEach(([x, z], i) =>
    i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))
  );
  ctx.stroke();
  ctx.setLineDash([]);

  /* ---------------- ambang ---------------- */
  const tebal = Math.max(spanX * 0.012, 0.004);
  ctx.save();
  ctx.beginPath();
  ctx.rect(X(-tebal), Z(s.P), X(0) - X(-tebal), Z(0) - Z(s.P));
  ctx.clip();
  hatchConcrete(ctx, padL, padT, plotW, plotH);
  ctx.restore();

  pen(ctx, W.bold, C.ink);
  ctx.strokeRect(X(-tebal), Z(s.P), X(0) - X(-tebal), Z(0) - Z(s.P));

  // Lantai hilir dan dasar hulu.
  ctx.beginPath();
  ctx.moveTo(padL, Z(0));
  ctx.lineTo(padL + plotW, Z(0));
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, Z(0), plotW, padT + plotH - Z(0));
  ctx.clip();
  hatchConcrete(ctx, padL, Z(0), plotW, padT + plotH - Z(0));
  ctx.restore();

  /* ---------------- rongga udara ---------------- */
  // Saat muka air hilir melampaui mercu, tidak ada rongga udara: ruang itu
  // terisi air. Menuliskannya di sana sama saja menyatakan tirainya masih
  // jatuh bebas, padahal lembar ini sendiri menandai ambangnya tenggelam.
  const xRongga = Math.min(xJatuh * 0.45, xKanan * 0.4);
  const zRongga = (s.P - wesNappe(s.h, xRongga)) * 0.45;
  if (!tenggelam) {
    // Alas kertas: muka air hilir lewat tepat di ketinggian ini, dan garisnya
    // mencoret hurufnya.
    const teksRongga = s.aerated ? T.airPocket : T.notAerated;
    ctx.font = F.region;
    const wRongga = stencilWidth(ctx, teksRongga, 1.4);
    ctx.fillStyle = C.sheet;
    ctx.fillRect(X(xRongga) - wRongga / 2 - 3, Z(zRongga) - 7, wRongga + 6, 14);
    region(
      ctx,
      teksRongga,
      X(xRongga),
      Z(zRongga),
      s.aerated ? C.ink3 : C.signal
    );
  }
  if (!s.aerated && !tenggelam) {
    leader(
      ctx,
      X(xRongga * 0.6),
      Z(zRongga * 1.5),
      X(xRongga * 0.6) + 30,
      Z(zRongga * 1.5) - 26,
      T.suction,
      C.signal
    );
  }

  /* ---------------- dimensi ---------------- */
  dimV(ctx, X(xKiri) + 26, Z(s.P + s.h), Z(s.P), `h ${fmtPlain(s.h, 3)} m`, C.water);
  dimV(ctx, X(xKiri) + 62, Z(s.P), Z(0), `P ${fmtPlain(s.P, 3)} m`, C.ink);

  // Titik acuan bentuk WES: pada x sama dengan tinggi rancangan, tirai sudah
  // turun tepat setengahnya. Angka itu jatuh langsung dari persamaannya.
  if (s.h > 0 && s.h < xKanan) {
    const zAcuan = s.P - wesNappe(s.h, s.h);
    if (zAcuan > 0) {
      pen(ctx, W.hair, C.critical, DASH.axis);
      ctx.beginPath();
      ctx.moveTo(X(s.h), Z(s.P));
      ctx.lineTo(X(s.h), Z(zAcuan));
      ctx.stroke();
      ctx.setLineDash([]);
      dimH(ctx, Z(s.P) - 16, X(0), X(s.h), `x = h`, C.critical);
      ctx.fillStyle = C.critical;
      ctx.beginPath();
      ctx.arc(X(s.h), Z(zAcuan), 2.6, 0, Math.PI * 2);
      ctx.fill();
      curveLabel(ctx, "y = h / 2", X(s.h) + 6, Z(zAcuan) + 10, C.critical);
    }
  }

  /* ---------------- nama wilayah ---------------- */
  // Judul panel menyatakan keadaan yang sedang digambar, bukan satu nama
  // tetap. "Tirai luapan bebas" pada ambang yang tenggelam adalah kalimat
  // yang dibantah oleh penanda merah di sebelahnya.
  const judul = tenggelam ? T.drownedNappe : T.freeNappe;
  // Aturan muat judul yang sama dengan penggambar lain (fitHeading): judul
  // yang lebih lebar daripada bidangnya dikecilkan lalu dipecah dua baris.
  // Judul yang muat tetap satu baris 15 px seperti sebelumnya.
  const muatJudul = fitHeading(ctx, judul, plotW);
  ctx.fillStyle = tenggelam ? C.signal : C.ink;
  ctx.font = muatJudul.font;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  // Judul keadaan tenggelam jauh lebih panjang daripada judul biasa, dan
  // dipusatkan pada tengah tirai ia keluar bingkai di sisi kanan.
  const ukuranJudul = Number(/(\d+)px/.exec(muatJudul.font)?.[1] ?? 15);
  muatJudul.lines.forEach((baris, i) => {
    const wJudul = stencilWidth(ctx, baris, 2);
    const xJudul = Math.min(
      Math.max(X((0 + xKanan) / 2), padL + wJudul / 2 + 6),
      padL + plotW - wJudul / 2 - 6
    );
    stencil(ctx, baris, xJudul, padT + 20 + i * (ukuranJudul + 6), 2);
  });

  region(ctx, T.upstream, X(xKiri * 0.55), Z(s.P + s.h) - 16, C.ink3);

  /* ---------------- bingkai ---------------- */
  pen(ctx, W.thin, C.ink);
  ctx.strokeRect(
    Math.round(padL) + 0.5,
    Math.round(padT) + 0.5,
    Math.round(plotW),
    Math.round(plotH)
  );

  /*
   * PlateOut, tidak menggambar apa pun. Peta: stasiun dari mercu (m) dan
   * elevasi dari lantai hilir (m).
   * - `crest`: puncak mercu (0, P)
   * - `headwater`: muka air hulu di garis dimensi h (P + h)
   * - `tailwater`: muka air hilir di tengah genangan hilir (0 bila kering)
   * - `nappeLanding`: ujung bawah tirai yang tergambar
   * `water` = genangan hulu; `waters` menambah genangan hilir (bila ada)
   * lalu lembaran tirai (nappeSheet, bila tidak tenggelam).
   */
  const map = mapFrom(X, Z, { x0: padL, y0: padT, x1: padL + plotW, y1: padT + plotH }, [xKiri, xKanan], [0, zAtas]);
  const ujungTirai = tirai[tirai.length - 1];
  const anchors = {
    crest: { x: X(0), y: Z(s.P) },
    headwater: { x: X(xKiri) + 26, y: Z(s.P + s.h) },
    tailwater: { x: X((xJatuh * 0.2 + xKanan) / 2), y: Z(Math.max(0, s.tail)) },
    nappeLanding: { x: X(ujungTirai[0]), y: Z(ujungTirai[1]) },
  };
  const hulu: number[] = [X(xKiri), Z(0), X(xKiri), Z(mukaHulu(xKiri))];
  for (let i = 0; i <= N_HULU; i++) {
    const x = xKiri + ((0 - xKiri) * i) / N_HULU;
    hulu.push(X(x), Z(mukaHulu(x)));
  }
  hulu.push(X(0), Z(0));
  const water = Float64Array.from(hulu);
  const waters: Float64Array[] = [water];
  if (s.tail > 0) {
    const xa = X(xJatuh * 0.2);
    const xb = X(xKanan);
    waters.push(Float64Array.of(xa, Z(0), xa, Z(s.tail), xb, Z(s.tail), xb, Z(0)));
  }
  if (lembaran) {
    const px = new Float64Array(lembaran.length);
    for (let i = 0; i < lembaran.length; i += 2) {
      px[i] = X(lembaran[i]);
      px[i + 1] = Z(lembaran[i + 1]);
    }
    waters.push(px);
  }
  return { map, anchors, water, waters };
}

/* ------------------------------------------------------------------ *
 * Lapis gerak HS-06: butir air yang jatuh di lembaran tirai
 * ------------------------------------------------------------------ */

export type NappeMotionState = {
  /** Tinggi muka air di atas mercu, m */
  h: number;
  /** Tinggi mercu di atas lantai hilir, m */
  P: number;
  /** Debit per meter lebar, m²/s (Q/b dari rectWeirDischarge) */
  q: number;
  /** Muka air hilir di atas lantai, m */
  tail: number;
};

/**
 * Garis energi di atas lantai hilir, m: E = P + h + Va²/2g.
 *
 * Bernoulli ditarik dari genangan hulu, jadi kecepatannya kecepatan DATANG
 * Va = q/(h + P) di penampang hulu yang dalamnya h + P, bukan V₀ = q/h di
 * atas mercu (Henderson 1966 §6). V₀ dipakai lembar untuk lintasan peluru
 * pembanding; memasukkannya ke E menaikkan laju di mercu (h 0,3; P 0,6;
 * b 2: 2,639 m/s, seharusnya 2,451 m/s).
 */
export function nappeEnergy(s: Pick<NappeMotionState, "h" | "P" | "q">): number {
  const Va = s.h + s.P > 0 ? s.q / (s.h + s.P) : 0;
  return s.P + s.h + (Va * Va) / (2 * G);
}

/**
 * Laju butir di tirai pada elevasi z, m/s.
 *
 * Di dalam tirai yang diberi udara tekanannya atmosfer di kedua sisinya,
 * jadi Bernoulli dari muka air hulu memberi v = √(2g(E − z)), dengan E dari
 * nappeEnergy (q dari rectWeirDischarge, persamaan yang sama yang mengisi
 * kop lembar).
 */
export function nappeSpeed(s: NappeMotionState, z: number): number {
  return Math.sqrt(2 * G * Math.max(nappeEnergy(s) - z, 0));
}

/**
 * Penurunan muka hulu di bidang mercu, bagian dari h. Muka atas tirai di
 * atas puncak ambang tajam ±0,85 h (Chow 1959 bab 14, profil tirai dari
 * pengukuran USBR), jadi turun 0,15 h.
 */
export const NAPPE_DRAWDOWN = 0.15;

/**
 * Muka air hulu di atas lantai pada stasiun x ≤ 0 (m): datar P + h sampai
 * x = −2h, lalu turun sampai P + (1 − NAPPE_DRAWDOWN)·h di bidang mercu.
 * Dipakai gambar genangan hulu dan tebal lembaran di x = 0.
 *
 * Bentuk penurunan g(f) = ½f² + ½f¹¹ (f = 0 di −2h, 1 di mercu): separuh
 * landai sejak −2h, separuh melengkung tajam di dekat bidang mercu, tempat
 * air mulai dipercepat masuk ke tirai. Kemiringan ujungnya
 * 0,15·6,5/2 ≈ 0,49 menyamai sisi atas lembaran di dekat bibir (±0,4..0,6),
 * jadi muka air tidak patah di x = 0. Parabola murni berakhir pada
 * kemiringan 0,15 dan patah terlihat di HP.
 */
export function nappeHeadwater(h: number, P: number, x: number): number {
  const awalTurun = -2 * h;
  if (x <= awalTurun) return P + h;
  const f = Math.min(1, (x - awalTurun) / (0 - awalTurun));
  const f2 = f * f;
  const f11 = f2 * f2 * f2 * f2 * f2 * f;
  return P + h - h * NAPPE_DRAWDOWN * (0.5 * f2 + 0.5 * f11);
}

/**
 * Tebal lembaran tirai tegak lurus lintasan pada stasiun x ≥ 0 (m).
 *
 * - Jauh dari mercu (x ≥ h) tekanan di dalam lembaran atmosfer: laju
 *   √(2g(E − z)) dan tebal t_B = q / laju (kontinuitas).
 * - Di bibir (x = 0) tebalnya t₀ = muka hulu − P, supaya sisi atas lembaran
 *   menyambung genangan hulu tanpa tangga. Di situ tekanan di dalam air
 *   belum nol, jadi laju rata-rata q/t₀ lebih kecil daripada Bernoulli
 *   bertekanan atmosfer.
 * - Di antaranya t = t_B(x) + (t₀ − t_B(0))·(1 − x/h)³: kelebihan tebal
 *   di bibir meluruh dan habis tepat di x = h, dengan turunan pertama dan
 *   kedua ikut nol di sana (menyambung). Peluruhan pangkat tiga dipilih
 *   karena sisi atas lembaran tetap melengkung satu arah; smoothstep
 *   t₀ → t_B menurunkan tebal paling cepat di tengah lalu berhenti, dan sisi
 *   atasnya menggambar bahu di sekitar x = h.
 */
export function nappeThickness(s: Pick<NappeMotionState, "h" | "P" | "q">, x: number): number {
  const E = nappeEnergy(s);
  const tebalBebas = (xx: number) => {
    const v = Math.sqrt(2 * G * Math.max(E - (s.P - wesNappe(s.h, Math.max(xx, 0))), 0));
    return v > 1e-9 ? s.q / v : 0;
  };
  const tB = tebalBebas(x);
  if (!(s.h > 0) || x >= s.h) return tB;
  const t0 = nappeHeadwater(s.h, s.P, 0) - s.P;
  const u = 1 - Math.max(x, 0) / s.h;
  return tB + (t0 - tebalBebas(0)) * u * u * u;
}

/**
 * Poligon lembaran tirai (m, stasiun dan elevasi), panjang 6n − 4: n titik
 * sisi bawah dari bibir sampai muka air hilir, lalu sisi atas kembali ke
 * bibir, dua titik per ruas. Sisi atas tiap ruas memakai normal ruas itu,
 * persis seperti jetAt menempatkan butir, jadi semua butir berada di dalam
 * poligon. null bila tanpa lintasan bebas.
 */
export function nappeSheet(s: NappeMotionState): Float64Array | null {
  const p = createJetPath("normal");
  fillNappePath(p, s);
  const n = p.n;
  if (n < 2) return null;
  const out = new Float64Array(6 * n - 4);
  let i = 0;
  for (let k = 0; k < n; k++) {
    out[i++] = p.x[k];
    out[i++] = p.z[k];
  }
  for (let k = n - 2; k >= 0; k--) {
    const dx = p.x[k + 1] - p.x[k];
    const dz = p.z[k + 1] - p.z[k];
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    out[i++] = p.x[k + 1] + nx * p.off1[k + 1];
    out[i++] = p.z[k + 1] + nz * p.off1[k + 1];
    out[i++] = p.x[k] + nx * p.off1[k];
    out[i++] = p.z[k] + nz * p.off1[k];
  }
  // Di bibir garis singgung WES mendatar (dz/dx = 0 di x = 0), jadi normal
  // sesungguhnya tegak: sisi atas tepat di (0, P + t₀) = muka hulu, tanpa
  // celah segitiga terhadap genangan hulu yang berhenti tegak di x = 0.
  // Normal ruas pertama sedikit miring; butir di ruas itu tetap di dalam
  // poligon karena titik ini berada di kiri-atas titik butirnya.
  out[i - 2] = p.x[0];
  out[i - 1] = p.z[0] + p.off1[0];
  return out;
}

/**
 * Mengisi tabel lintasan: sisi bawah tirai WES (garis yang digambar
 * drawNappe), dari bibir mercu sampai muka air hilir atau lantai. Tebal
 * lembaran tegak lurus aliran t(x) dari nappeThickness, laju = q / t
 * (kontinuitas tepat di tiap titik, tanpa tangga di mercu). Tirai yang
 * tenggelam (muka air hilir di atas mercu) tidak punya lintasan bebas:
 * n = 0. Mengembalikan laju terbesar.
 */
export function fillNappePath(path: JetPath, s: NappeMotionState): number {
  const zEnd = Math.max(s.tail, 0);
  path.n = 0;
  if (!(s.h > 0) || !(s.P > zEnd)) return 0;
  // wesNappe(h, x) = P − zEnd dibalik: x = (K h^(N−1) (P − zEnd))^(1/N).
  const xEnd = Math.pow(WES_K * Math.pow(s.h, WES_N - 1) * (s.P - zEnd), 1 / WES_N);
  const n = JET_MAX;
  for (let k = 0; k < n; k++) {
    // Jarak mendatar sama. Dulu √f (rapat di ujung yang curam), tetapi ruas
    // pertama lalu 6 % xEnd panjangnya dan sisi atas lembaran yang digambar
    // dari tabel ini patah di dekat bibir, tepat di tempat tebalnya paling
    // cepat berubah. Kemiringan tirai sampai muka air hilir tidak sampai 2,
    // jadi ruas terpanjang paling banyak dua kali yang terpendek.
    const x = (xEnd * k) / (n - 1);
    const z = Math.max(s.P - wesNappe(s.h, x), zEnd);
    const t = nappeThickness(s, x);
    path.x[k] = x;
    path.z[k] = z;
    path.v[k] = t > 1e-12 ? s.q / t : 0;
    path.off0[k] = 0;
    path.off1[k] = t;
  }
  path.n = n;
  return finishJetPath(path);
}

/**
 * Lapis gerak HS-06. `t` waktu fisik (Client memakai waktu diperlambat ×4).
 * Butir lahir di bibir mercu dan hilang di muka air hilir (atau lantai);
 * dipotong ke bidang gambar.
 */
export function drawNappeMotion(
  ctx: CanvasRenderingContext2D,
  t: number,
  out: PlateOut | null,
  s: NappeMotionState,
  m: JetMotion
): void {
  if (!out) return;
  if (jetKeyChanged(m, s.h, s.P, s.q, s.tail)) m.vMax = fillNappePath(m.path, s);
  const f = out.map.frame;
  ctx.save();
  ctx.beginPath();
  ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
  ctx.clip();
  drawJet(ctx, m, out.map, t);
  ctx.restore();
}
