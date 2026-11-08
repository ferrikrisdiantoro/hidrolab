import { C, DASH, F, W } from "./theme.ts";
import {
  axisTitle,
  axisValue,
  createLabelPlacer,
  ground,
  hatchConcrete,
  hatchWater,
  niceStep,
  pen,
  ruling,
} from "./plate.ts";
import { fmtPlain } from "./hydraulics.ts";
import { hydrostaticPressure } from "./hidrostatika.ts";
import type { Lang } from "./i18n";
import { mapFrom, type PlateOut } from "./plateOut.ts";

export type HidroDrawState = {
  /** Rapat massa zat cair, kg/m³ */
  rho: number;
  /** Kedalaman zat cair di tangki, m */
  H: number;
  /** Kedalaman ujung probe, m */
  probe: number;
  /** Tekanan terbaca probe, Pa (termasuk pa bila mutlak); NaN bila tidak sah */
  pProbe: number;
  /** Tekanan di muka zat cair yang dipakai diagram, Pa (0 = ukur) */
  pa: number;
  absolute: boolean;
  /** Sudut dinding dan pintu terhadap muka zat cair, radian */
  angle: number;
  /** Kedalaman tepi atas pintu, m (negatif = di atas muka) */
  top: number;
  /** Panjang pintu sepanjang lereng, m */
  L: number;
  /** Lebar pintu, m */
  b: number;
  /** Hasil model M12, tekanan ukur: gaya N, kedalaman titik berat dan pusat tekanan m */
  force: number;
  depthCG: number;
  depthCP: number;
  wettedLength: number;
  /** Pintu menembus dasar tangki (di luar rentang berlaku gambar) */
  gateInvalid: boolean;
  /** Probe di bawah dasar tangki */
  probeInvalid: boolean;
};

const TXT = {
  id: {
    axDepth: "kedalaman, m",
    axGauge: "tekanan ukur, kPa",
    axAbs: "tekanan mutlak, kPa",
    paGauge: "pa = 0 (ukur)",
    atm: "atmosfer",
    gate: "pintu",
    gateBelow: "pintu menembus dasar tangki",
    probeBelow: "probe di bawah dasar tangki",
    floor: "dasar",
  },
  en: {
    axDepth: "depth, m",
    axGauge: "gauge pressure, kPa",
    axAbs: "absolute pressure, kPa",
    paGauge: "pa = 0 (gauge)",
    atm: "atmosphere",
    gate: "gate",
    gateBelow: "gate passes through the tank floor",
    probeBelow: "probe below the tank floor",
    floor: "floor",
  },
} as const;

/** Panah lurus dari a ke b, kepala di b. */
function panah(
  ctx: CanvasRenderingContext2D,
  xa: number,
  ya: number,
  xb: number,
  yb: number,
  warna: string,
  tebal: number,
  kepala = 7
) {
  const dx = xb - xa;
  const dy = yb - ya;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len;
  const uy = dy / len;
  const k = Math.min(kepala, len * 0.45);
  pen(ctx, tebal, warna);
  ctx.beginPath();
  ctx.moveTo(xa, ya);
  ctx.lineTo(xb - ux * k * 0.6, yb - uy * k * 0.6);
  ctx.stroke();
  ctx.fillStyle = warna;
  ctx.beginPath();
  ctx.moveTo(xb, yb);
  ctx.lineTo(xb - ux * k - uy * k * 0.42, yb - uy * k + ux * k * 0.42);
  ctx.lineTo(xb - ux * k + uy * k * 0.42, yb - uy * k - ux * k * 0.42);
  ctx.closePath();
  ctx.fill();
}

/**
 * LEMBAR FF-08: TANGKI BERDINDING MIRING DI SAMPING DIAGRAM TEKANAN.
 *
 * Dua bidang berbagi satu sumbu kedalaman, seperti FM-03. Kiri potongan
 * tangki: dinding kanannya miring sebesar sudut pintu, pintu persegi
 * panjang duduk di dinding itu, probe tekanan tergantung dari atas. Kanan
 * tekanan terhadap kedalaman. Ujung probe dan titik bacaannya di diagram
 * selalu pada satu garis mendatar, begitu pula titik berat dan pusat
 * tekanan pintu: itu yang membuat "tekanan hanya bergantung pada
 * kedalaman" terbaca tanpa kalimat.
 *
 * Skala gambar bergantung pada H, sudut, dan lebar kanvas saja, tidak pada
 * kedalaman probe maupun tepi atas pintu. Keduanya diseret, jadi skala
 * yang ikut berubah akan membuat pegangan berlari dari jari.
 *
 * Di balik dinding ada udara bertekanan atmosfer, jadi gaya pada pintu
 * adalah gaya tekanan ukur (dari pemanggil, M12 dengan pa = 0). Pilihan
 * ukur/mutlak hanya mengubah bacaan probe dan diagramnya.
 */
export function drawHidrostatika(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: HidroDrawState,
  lang: Lang
): PlateOut {
  const T = TXT[lang];
  ground(ctx, w, h);

  const sempit = w < 560;
  const H = Math.max(s.H, 1e-6);
  const fb = 0.25 * H;
  const dasar = 0.08 * H;
  const sin = Math.sin(s.angle);
  const cot = s.angle >= Math.PI / 2 - 1e-9 ? 0 : Math.cos(s.angle) / Math.max(sin, 1e-9);

  const padT = 22;
  const padB = 46;
  const plotH = Math.max(40, h - padT - padB);

  /* Angka sumbu kedalaman menentukan tepi kiri. Langkahnya dari tinggi
     bidang dalam meter, yang belum diketahui sebelum skala; perkiraan
     dari H + fb sudah cukup karena hanya lebar angkanya yang dipakai. */
  const dStepKira = niceStep(H + fb + dasar, sempit ? 4 : 6);
  const dDigits = dStepKira < 0.1 ? 2 : dStepKira < 1 ? 1 : 0;
  ctx.font = F.value;
  const lebarAngka = Math.max(
    ctx.measureText(fmtPlain(-fb, dDigits)).width,
    ctx.measureText(fmtPlain(H * 1.4, dDigits)).width
  );
  const padKiri = Math.max(40, Math.ceil(lebarAngka) + 28);
  const padKanan = 12;
  const sela = 46;
  const tumpuk = 16;

  /*
   * Lebar: tangki di kiri, diagram di kanan, satu sumbu kedalaman. Sempit
   * (HP): keduanya ditumpuk, tangki di atas, dengan skala kedalaman yang
   * sama; berdampingan di 390 px membuat tangkinya selebar 130 px dan
   * setinggi seperempat bidang. Garis sekedalaman lalu digambar di dalam
   * diagram saja.
   */
  const isi = Math.max(60, w - padKiri - padKanan - (sempit ? 0 : sela));
  const kiriW = sempit ? isi : isi * 0.62;
  const kananW = sempit ? isi : isi - kiriW;
  const x0 = padKiri;
  const x1 = x0 + kiriW;
  const dx0 = sempit ? x0 : x1 + sela;
  const dx1 = dx0 + kananW;
  const y0 = padT;
  const tinggiPanel = sempit ? (plotH - tumpuk) / 2 : plotH;

  /* ---------------- skala tangki (sama di kedua sumbu) ---------------- */
  const tebal = 9;
  const ruangKanan = sempit ? 10 : 22;
  const xToe = 0.7 * H;
  const xTop = xToe + (H + fb) * cot;
  const k = Math.max(
    1e-6,
    Math.min((kiriW - 6 - 2 * tebal - ruangKanan) / xTop, tinggiPanel / (fb + H + dasar))
  );
  /* Bertumpuk: tiap panel setinggi tangkinya saja, sisanya di bawah. */
  const y1 = sempit ? y0 + (fb + H + dasar) * k : padT + plotH;
  const dy0 = sempit ? y1 + tumpuk : y0;
  const dy1 = dy0 + (y1 - y0);
  const X = (x: number) => x0 + 4 + tebal + x * k;
  const Y = (d: number) => y0 + (d + fb) * k;
  /** Kedalaman yang sama di panel diagram. */
  const YB = (d: number) => dy0 + (d + fb) * k;
  const dBawah = (y1 - y0) / k - fb;
  /** Titik dinding miring pada kedalaman d, piksel. */
  const Wp = (d: number) => ({ x: X(xToe + (H - d) * cot), y: Y(d) });
  const nx = sin;
  const ny = Math.cos(s.angle);

  /* ---------------- diagram tekanan ---------------- */
  const paK = s.pa / 1000;
  const pDasar = hydrostaticPressure(H, s.rho, undefined, s.pa) / 1000;
  const pMax = Math.max(pDasar * 1.18, 1e-3);
  const XP = (p: number) => dx0 + (p / pMax) * kananW;

  /* ---------------- kisi ---------------- */
  const dStep = niceStep(fb + Math.min(dBawah, H * 1.3), sempit ? 4 : 6);
  const digits = dStep < 0.1 ? 2 : dStep < 1 ? 1 : 0;
  const dTicks: number[] = [];
  for (let i = Math.ceil(-fb / dStep - 1e-9); i * dStep <= dBawah + 1e-9; i++)
    dTicks.push(i === 0 ? 0 : i * dStep);
  const pStep = niceStep(pMax, 4);
  const pTicks: number[] = [];
  for (let v = 0; v <= pMax + 1e-9; v += pStep) pTicks.push(v);

  ruling(ctx, x0, y0, x1, y1, { horizontal: dTicks.map(Y) });
  ruling(ctx, dx0, dy0, dx1, dy1, { horizontal: dTicks.map(YB), vertical: pTicks.map(XP) });
  for (const v of dTicks) {
    axisValue(ctx, fmtPlain(v, digits), x0 - 6, Y(v), "right", "middle");
    if (sempit) axisValue(ctx, fmtPlain(v, digits), dx0 - 6, YB(v), "right", "middle");
  }
  const pDigits = pStep < 1 ? 1 : 0;
  pTicks.forEach((v) => axisValue(ctx, fmtPlain(v, pDigits), XP(v), dy1 + 8, "center", "top"));
  axisTitle(ctx, T.axDepth, 11, (y0 + y1) / 2, -Math.PI / 2);
  if (sempit) axisTitle(ctx, T.axDepth, 11, (dy0 + dy1) / 2, -Math.PI / 2);
  axisTitle(ctx, s.absolute ? T.axAbs : T.axGauge, Math.min((dx0 + dx1) / 2, w - 70), dy1 + 32);

  const kiri = createLabelPlacer(ctx, { padL: x0, padT: y0, plotW: kiriW, plotH: y1 - y0 });
  const kanan = createLabelPlacer(ctx, { padL: dx0, padT: dy0, plotW: kananW, plotH: dy1 - dy0 });

  /* ================= bidang kiri: potongan tangki ================= */
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, kiriW, y1 - y0);
  ctx.clip();

  const sTop = Wp(0);
  const sToe = Wp(H);
  const air = () => {
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    ctx.lineTo(sTop.x, sTop.y);
    ctx.lineTo(sToe.x, sToe.y);
    ctx.lineTo(X(0), Y(H));
    ctx.closePath();
  };
  air();
  ctx.fillStyle = C.waterFill;
  ctx.fill();
  hatchWater(ctx, air, X(0), sTop.x, Y(0), Y(H));

  /* Dinding kiri tegak dan pelat dasar. */
  const yLantai = Y(H) + dasar * k;
  hatchConcrete(ctx, X(0) - tebal, Y(-fb), tebal, yLantai - Y(-fb));
  hatchConcrete(ctx, X(0) - tebal, Y(H), x1 - X(0) + tebal, dasar * k);
  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  ctx.moveTo(X(0), Y(-fb));
  ctx.lineTo(X(0), Y(H));
  ctx.lineTo(sToe.x, sToe.y);
  ctx.moveTo(X(0) - tebal, Y(-fb));
  ctx.lineTo(X(0) - tebal, yLantai);
  ctx.lineTo(x1, yLantai);
  ctx.stroke();

  /* Dinding kanan miring: muka basah di garis dinding, tebal ke sisi udara. */
  const atas = Wp(-fb);
  const dinding = () => {
    ctx.beginPath();
    ctx.moveTo(sToe.x, sToe.y);
    ctx.lineTo(atas.x, atas.y);
    ctx.lineTo(atas.x + nx * tebal, atas.y + ny * tebal);
    ctx.lineTo(sToe.x + nx * tebal, sToe.y + ny * tebal);
    ctx.closePath();
  };
  ctx.save();
  dinding();
  ctx.clip();
  hatchConcrete(ctx, Math.min(sToe.x, atas.x) - 2, atas.y - 2, Math.abs(atas.x - sToe.x) + tebal + 4, sToe.y - atas.y + tebal + 4);
  ctx.restore();
  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  ctx.moveTo(sToe.x, sToe.y);
  ctx.lineTo(atas.x, atas.y);
  ctx.moveTo(atas.x + nx * tebal, atas.y + ny * tebal);
  ctx.lineTo(sToe.x + nx * tebal, sToe.y + ny * tebal);
  ctx.stroke();

  /* Pintu: pita kosong di badan dinding, tepi tebal. Bagian di bawah dasar
     tangki tidak ada wujudnya, jadi digambar merah sinyal bertitik. */
  const gTop = s.top;
  const gBot = s.top + s.L * sin;
  const pita = (da: number, db: number) => {
    const a = Wp(da);
    const b = Wp(db);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x + nx * tebal, b.y + ny * tebal);
    ctx.lineTo(a.x + nx * tebal, a.y + ny * tebal);
    ctx.closePath();
  };
  const gNyata = Math.min(gBot, H);
  if (gNyata > gTop) {
    pita(gTop, gNyata);
    ctx.fillStyle = C.sheet;
    ctx.fill();
    pen(ctx, W.bold, C.ink);
    pita(gTop, gNyata);
    ctx.stroke();
  }
  if (gBot > H + 1e-9) {
    pita(Math.max(gTop, H), gBot);
    ctx.fillStyle = C.signalFill;
    ctx.fill();
    pen(ctx, W.thin, C.signal, DASH.invalid);
    pita(Math.max(gTop, H), gBot);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* Muka zat cair dan tanda segitiga terbalik. */
  pen(ctx, W.thin, C.water);
  ctx.beginPath();
  ctx.moveTo(X(0), Y(0));
  ctx.lineTo(sTop.x, sTop.y);
  ctx.stroke();
  const xSeg = X(0) + (sTop.x - X(0)) * 0.72;
  ctx.beginPath();
  ctx.moveTo(xSeg - 5, Y(0) - 8);
  ctx.lineTo(xSeg + 5, Y(0) - 8);
  ctx.lineTo(xSeg, Y(0) - 1);
  ctx.closePath();
  ctx.stroke();

  /* Tekanan di muka: panah kecil menekan muka zat cair. */
  const xProbe = X(0) + Math.min(0.32 * xToe * k, (sTop.x - X(0)) * 0.3);
  const fbPx = fb * k;
  const panjangAtm = Math.min(14, fbPx * 0.6);
  if (panjangAtm > 5)
    for (const f of [0.52, 0.86]) {
      const xa = X(0) + (sTop.x - X(0)) * f;
      panah(ctx, xa, Y(0) - panjangAtm - 2, xa, Y(0) - 2, C.ink2, W.thin, 5);
    }

  /* Sebaran tekanan ukur pada bagian basah pintu, tegak lurus pintu. */
  const d1 = Math.max(gTop, 0);
  const basah = !s.gateInvalid && s.wettedLength > 0 && gBot > d1;
  const pRef = hydrostaticPressure(H, s.rho);
  const prismaPx = Math.min(64, kiriW * 0.26);
  const tebalP = (d: number) => (hydrostaticPressure(d, s.rho) / (pRef || 1)) * prismaPx;
  if (basah) {
    const a = Wp(d1);
    const b = Wp(gBot);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a.x - nx * tebalP(d1), a.y - ny * tebalP(d1));
    ctx.lineTo(b.x - nx * tebalP(gBot), b.y - ny * tebalP(gBot));
    ctx.lineTo(b.x, b.y);
    ctx.closePath();
    ctx.fillStyle = C.waterFillDeep;
    ctx.fill();
    pen(ctx, W.thin, C.water);
    ctx.stroke();
    const n = 5;
    for (let i = 0; i < n; i++) {
      const d = d1 + ((i + 0.5) / n) * (gBot - d1);
      const p = Wp(d);
      const t = tebalP(d);
      if (t > 7) panah(ctx, p.x - nx * t, p.y - ny * t, p.x, p.y, C.water, W.thin, 5);
    }
  }

  /* Titik berat dan resultan di pusat tekanan. */
  if (basah) {
    const cg = Wp(s.depthCG);
    pen(ctx, W.thin, C.ink);
    ctx.beginPath();
    ctx.arc(cg.x, cg.y, 3.5, 0, Math.PI * 2);
    ctx.moveTo(cg.x - 6, cg.y);
    ctx.lineTo(cg.x + 6, cg.y);
    ctx.moveTo(cg.x, cg.y - 6);
    ctx.lineTo(cg.x, cg.y + 6);
    ctx.stroke();

    const cp = Wp(s.depthCP);
    const len = Math.min(prismaPx + 26, kiriW * 0.4);
    const ex = cp.x - nx * len;
    const ey = cp.y - ny * len;
    panah(ctx, ex, ey, cp.x, cp.y, C.water, W.bold, 9);
    pen(ctx, W.thin, C.water);
    ctx.beginPath();
    ctx.arc(ex, ey, 2.4, 0, Math.PI * 2);
    ctx.stroke();
    kiri.write(
      `F ${fmtPlain(s.force / 1000, s.force < 1e4 ? 2 : 1)} kN`,
      ex - 4,
      ey - 9,
      C.water,
      { align: "right" }
    );
  }

  /* Probe: batang dari atas, ujung pembaca di kedalaman yang dipilih. */
  const yProbeAsli = Y(s.probe);
  const yProbe = Math.min(Math.max(yProbeAsli, y0 + 4), y1 - 2);
  const yLantaiAtas = Y(H);
  pen(ctx, W.bold, C.ink);
  ctx.beginPath();
  ctx.moveTo(xProbe, y0);
  ctx.lineTo(xProbe, Math.min(yProbe, yLantaiAtas));
  ctx.stroke();
  if (s.probeInvalid) {
    pen(ctx, W.thin, C.signal, DASH.invalid);
    ctx.beginPath();
    ctx.moveTo(xProbe, yLantaiAtas);
    ctx.lineTo(xProbe, yProbe);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = s.probeInvalid ? C.signal : C.water;
  ctx.beginPath();
  ctx.arc(xProbe, yProbe, 3.4, 0, Math.PI * 2);
  ctx.fill();
  pen(ctx, W.thin, C.ink);
  ctx.stroke();

  /* Tulisan bidang kiri. Tekanan muka dulu, karena tempatnya sempit. */
  kiri.write(
    s.absolute ? `pa ${fmtPlain(paK, 1)} kPa` : T.paGauge,
    X(0) + 4,
    Y(0) - Math.max(9, Math.min(fbPx - 6, 18)),
    C.ink2,
    { align: "left" }
  );
  kiri.write(`ρ ${fmtPlain(s.rho, 0)} kg/m³`, X(0) + 4, Y(H) - 10, C.water, { align: "left" });
  if (gNyata > gTop && !sempit) {
    const mid = Wp(Math.max(gTop, -fb * 0.9) + 0.0);
    kiri.write(`${T.gate} ${fmtPlain(s.b, 1)} × ${fmtPlain(s.L, 1)} m`, mid.x + nx * tebal + 8, mid.y - 4, C.ink2, { align: "left" });
  }
  if (s.gateInvalid) kiri.write(T.gateBelow, (x0 + x1) / 2, y0 + 16, C.signal, { big: true });
  if (s.probeInvalid) kiri.write(T.probeBelow, (x0 + x1) / 2, y0 + (s.gateInvalid ? 50 : 16), C.signal, { big: true });

  ctx.restore();

  /* ---------------- garis sekedalaman ke diagram ---------------- */
  const sejajar = (xa: number, d: number, warna: string, dash: readonly number[]) => {
    if (d < -fb || d > dBawah) return;
    pen(ctx, W.hair, warna, dash);
    ctx.beginPath();
    ctx.moveTo(sempit ? dx0 : xa, YB(d));
    ctx.lineTo(dx1, YB(d));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  if (!s.probeInvalid) sejajar(xProbe + 4, s.probe, C.water, DASH.hidden);
  if (basah) {
    sejajar(Wp(s.depthCG).x + 7, s.depthCG, C.ink2, DASH.axis);
    sejajar(Wp(s.depthCP).x + 3, s.depthCP, C.water, DASH.hidden);
  }

  /* ================= bidang kanan: diagram tekanan ================= */
  ctx.save();
  ctx.beginPath();
  ctx.rect(dx0, dy0, kananW, dy1 - dy0);
  ctx.clip();

  if (s.absolute) {
    ctx.fillStyle = C.neutralFill;
    ctx.fillRect(XP(0), YB(-fb), XP(paK) - XP(0), YB(H) - YB(-fb));
  }
  ctx.beginPath();
  ctx.moveTo(XP(paK), YB(0));
  ctx.lineTo(XP(pDasar), YB(H));
  ctx.lineTo(XP(paK), YB(H));
  ctx.closePath();
  ctx.fillStyle = C.waterFill;
  ctx.fill();

  /* Di atas muka hanya udara: tekanannya pa, berat udara diabaikan. */
  if (s.absolute) {
    pen(ctx, W.thin, C.ink2);
    ctx.beginPath();
    ctx.moveTo(XP(paK), dy0);
    ctx.lineTo(XP(paK), YB(0));
    ctx.stroke();
  }
  pen(ctx, W.bold, C.water);
  ctx.beginPath();
  ctx.moveTo(XP(paK), YB(0));
  ctx.lineTo(XP(pDasar), YB(H));
  ctx.stroke();
  pen(ctx, W.hair, C.ink3, DASH.axis);
  ctx.beginPath();
  ctx.moveTo(dx0, YB(0));
  ctx.lineTo(dx1, YB(0));
  ctx.stroke();
  pen(ctx, W.thin, C.ink2);
  ctx.beginPath();
  ctx.moveTo(dx0, YB(H));
  ctx.lineTo(XP(pDasar), YB(H));
  ctx.stroke();
  ctx.setLineDash([]);

  if (s.absolute && XP(paK) - XP(0) > 16) {
    ctx.save();
    ctx.translate((XP(0) + XP(paK)) / 2, YB(H) - 6);
    ctx.rotate(-Math.PI / 2);
    ctx.font = F.region;
    ctx.fillStyle = C.ink2;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(T.atm.toUpperCase(), 0, 0);
    ctx.restore();
  }

  if (basah) {
    const pc = hydrostaticPressure(s.depthCG, s.rho, undefined, s.pa) / 1000;
    pen(ctx, W.thin, C.ink);
    ctx.beginPath();
    ctx.arc(XP(pc), YB(s.depthCG), 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (!s.probeInvalid && Number.isFinite(s.pProbe)) {
    const px = XP(s.pProbe / 1000);
    const py = YB(s.probe);
    ctx.fillStyle = C.water;
    ctx.beginPath();
    ctx.arc(px, py, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  /* Tulisan kanan: bacaan probe di dekat titiknya, lalu hc dan hp. */
  if (!s.probeInvalid && Number.isFinite(s.pProbe)) {
    const px = XP(s.pProbe / 1000);
    const kiriAtau = px > dx0 + kananW * 0.55;
    kanan.write(
      `p ${fmtPlain(s.pProbe / 1000, 1)} kPa`,
      kiriAtau ? px - 7 : px + 7,
      YB(s.probe) - 9,
      C.water,
      { align: kiriAtau ? "right" : "left" }
    );
  }
  if (basah) {
    kanan.write(`hc ${fmtPlain(s.depthCG, 2)}`, dx1 - 2, YB(s.depthCG) - 7, C.ink2, { align: "right" });
    kanan.write(`hp ${fmtPlain(s.depthCP, 2)}`, dx1 - 2, YB(s.depthCP) + 9, C.water, { align: "right" });
  }
  ctx.restore();

  /* Sumbu nol tekanan dan dasar diagram. */
  pen(ctx, W.thin, C.ink2);
  ctx.beginPath();
  ctx.moveTo(dx0, dy0);
  ctx.lineTo(dx0, dy1);
  ctx.lineTo(dx1, dy1);
  ctx.stroke();

  /* ---------------- keluaran untuk pegangan seret ---------------- */
  const frame = { x0, y0, x1, y1 };
  const map = mapFrom(X, Y, frame, [0, Math.max(xTop, 1e-6)], [-fb, H]);
  const tekanan = mapFrom(XP, YB, { x0: dx0, y0: dy0, x1: dx1, y1: dy1 }, [0, pMax], [-fb, H]);
  const jepitY = (y: number) => Math.min(Math.max(y, y0), y1);
  const dTopJepit = Math.min(Math.max(gTop, -fb), dBawah);
  const ga = Wp(dTopJepit);
  return {
    map,
    maps: { tekanan },
    anchors: {
      probe: { x: xProbe, y: jepitY(yProbeAsli) },
      /* Di muka basah tepi atas pintu, tanpa geser tegak: invY(y) harus
         memberi kedalaman tepi atas itu sendiri supaya pegangan tidak
         melompat saat mulai diseret. */
      gateTop: {
        x: Math.min(Math.max(ga.x + nx * tebal * 0.5, x0), x1),
        y: jepitY(ga.y),
      },
    },
  };
}
