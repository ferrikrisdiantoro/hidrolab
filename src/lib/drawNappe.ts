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
import { drawJet, finishJetPath, jetKeyChanged, type JetMotion, type JetPath, JET_MAX } from "./jetMotion.ts";
import { cl } from "./strings.ts";
import type { Lang } from "./i18n";
import { mapFrom, type PlateOut } from "./plateOut.ts";

export type NappeState = {
  /** Tinggi muka air di atas puncak mercu, meter */
  h: number;
  /** Tinggi mercu di atas lantai hilir, meter */
  P: number;
  /** Kecepatan rata-rata di atas mercu, meter per detik */
  V0: number;
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
  const awalTurun = -2 * s.h;
  const mukaHulu = (x: number) => {
    if (x <= awalTurun) return s.P + s.h;
    const f = (x - awalTurun) / (0 - awalTurun);
    return s.P + s.h - s.h * 0.28 * f * f;
  };

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
    for (let i = 0; i <= 60; i++) {
      const x = xKiri + ((0 - xKiri) * i) / 60;
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
  for (let i = 0; i <= 60; i++) {
    const x = xKiri + ((0 - xKiri) * i) / 60;
    i ? ctx.lineTo(X(x), Z(mukaHulu(x))) : ctx.moveTo(X(x), Z(mukaHulu(x)));
  }
  ctx.stroke();

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
  const tenggelam = s.tail > s.P;
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
   * `water` = genangan hulu; `waters` menambah genangan hilir. Lembaran
   * air tirai tidak termasuk: tebalnya tidak digambar (hanya sisi bawahnya),
   * jadi lapis gerak membangunnya sendiri dari debit (nappeMotion).
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
  for (let i = 0; i <= 60; i++) {
    const x = xKiri + ((0 - xKiri) * i) / 60;
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
 * Mengisi tabel lintasan: sisi bawah tirai WES (garis yang digambar
 * drawNappe), dari bibir mercu sampai muka air hilir atau lantai. Tebal
 * lembaran air tegak lurus aliran = q / v (kontinuitas). Tirai yang
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
    // Rapat di ujung, tempat tirai paling curam (jarak lengkung terbesar).
    const f = k / (n - 1);
    const x = xEnd * Math.sqrt(f);
    const z = Math.max(s.P - wesNappe(s.h, x), zEnd);
    const v = nappeSpeed(s, z);
    path.x[k] = x;
    path.z[k] = z;
    path.v[k] = v;
    path.off0[k] = 0;
    path.off1[k] = v > 1e-9 ? s.q / v : 0;
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
