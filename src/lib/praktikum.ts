/**
 * M11 Mode praktikum: model tanpa React untuk lembar pengamatan FM-01
 * (ambang V), FM-02 (venturi), FM-03 (traverse Pitot, nanti) dan FM-05
 * (pengenceran garam, nanti).
 *
 * Isi:
 * - buatRng: deret acak seragam berbenih (dibangun di atas hash01 motion.ts)
 * - bacaAlat: nilai benar + galat baca normal, dibulatkan ke resolusi alat
 * - ringkasan: n, rerata, simpangan baku sampel, galat baku rerata
 * - kalibrasi Cd: kuadrat terkecil lewat titik asal Q_ukur = Cd·Q_teori,
 *   dengan Q_teori memakai rumus model lembar (Cd = 1)
 * - kalibrasiPangkat: Q = K·x^m lewat regresi log-log
 * - integrasiTrapesium dan debitGulp untuk kurva konduktivitas FM-05
 * - barisEkspor: kepala + baris untuk downloadXlsx / downloadCsv
 *
 * Besaran galat baca alat (lihat ALAT_*) dan sumbernya:
 * - JCGM 100:2008 (GUM) F.2.2.1: resolusi δx = sebaran persegi selebar δx,
 *   varians δx²/12 (u = 0,29 δx). Inilah sebabnya pembulatan ke resolusi
 *   sudah menyumbang galat sendiri; sigma di bawah adalah galat baca DI LUAR
 *   pembulatan itu.
 * - Armfield F1-13 Flow Over Weirs, datasheet v2b, spesifikasi teknis:
 *   "Hook & point gauge range 0-150mm, Accuracy 0.1mm".
 * - Armfield H12 Liquid Manometers (halaman produk): "Scales are graduated in
 *   1mm divisions". Armfield F1-15 datasheet: manometer 0-400 mm, leher
 *   14,0 mm, hulu 26,0 mm (alat venturi bangku praktikum).
 * - USBR Water Measurement Manual, bab 8, tabel 8-1: galat baca point gage
 *   dalam sumur peredam 0,0015 ft (0,46 mm), dipakai sebagai batas atas;
 *   USBR menyebut angka tabel itu sengaja lebih besar dari galat acak.
 * ISO 1438, ISO 5167-4, ISO 5168 tidak dapat dibuka (berbayar), jadi tidak
 * dikutip angkanya.
 */

import type { Bi } from "./i18n.tsx";
import type { XlsxCell } from "./xlsx.ts";
import { G, NOTCH_KH } from "./hydraulics.ts";
import { hash01 } from "./motion.ts";

/* ------------------------------------------------------------------ *
 * Acak berbenih
 * ------------------------------------------------------------------ */

/** Pembangkit seragam [0, 1) */
export type Rng = () => number;

/**
 * Deret seragam berbenih: u_k = hash01(benih, k), k = 0, 1, 2, ...
 * Benih sama memberi deret sama (lembar praktikum bisa diulang persis).
 */
export function buatRng(benih: number): Rng {
  let k = 0;
  const b = benih | 0;
  return () => hash01(b, k++);
}

/** Normal baku lewat Box-Muller (memakai dua tarikan seragam). */
export function normalBaku(rng: Rng): number {
  const u1 = 1 - rng(); // (0, 1], aman untuk log
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/* ------------------------------------------------------------------ *
 * Bacaan alat
 * ------------------------------------------------------------------ */

export type AlatBaca = {
  /** Skala terkecil alat, satuan sama dengan nilai. 0 = tanpa pembulatan */
  resolusi: number;
  /** Simpangan baku galat baca mutlak (selain pembulatan) */
  sigma?: number;
  /** Simpangan baku galat baca relatif terhadap |nilai|, mis. 0,01 = 1 % */
  sigmaRel?: number;
};

/**
 * Pengukur titik/kait (hook & point gauge) untuk tinggi muka air H, meter.
 * Resolusi 0,1 mm: Armfield F1-13 datasheet v2b ("Accuracy 0.1mm").
 * Sigma 0,1 mm: angka akurasi Armfield dibaca sebagai 1σ. USULAN, PERLU CEK
 * INSINYUR (batas atas: USBR WMM tabel 8-1, point gage 0,0015 ft = 0,46 mm).
 */
export const ALAT_PENGUKUR_TITIK: AlatBaca = { resolusi: 0.0001, sigma: 0.0001 };

/**
 * Satu tabung manometer/piezometer, meter kolom air.
 * Resolusi 1 mm: Armfield H12 ("Scales are graduated in 1mm divisions").
 * Sigma 0,5 mm (setengah garis skala, paralaks dan meniskus). USULAN, PERLU
 * CEK INSINYUR. Δh = selisih dua tabung: baca tiap tabung terpisah dengan
 * alat ini lalu kurangkan, jangan bacaAlat(Δh) sekali.
 */
export const ALAT_MANOMETER: AlatBaca = { resolusi: 0.001, sigma: 0.0005 };

/**
 * Debit cara volumetrik (tangki ukur + stopwatch), m³/s.
 * Sigma relatif 1 %, resolusi 10⁻⁶ m³/s (0,001 L/dtk). USULAN, PERLU CEK
 * INSINYUR: tidak ada sumber terbuka yang memberi angka galat tangki
 * volumetrik bangku praktikum.
 */
export const ALAT_DEBIT_VOLUMETRIK: AlatBaca = { resolusi: 1e-6, sigmaRel: 0.01 };

/**
 * Bulatkan x ke kelipatan resolusi dan buang ekor biner
 * (0,1 + 0,2 → 0,3, bukan 0,30000000000000004).
 */
export function bulatkanKe(x: number, resolusi: number): number {
  if (!(resolusi > 0) || !Number.isFinite(x)) return x;
  const k = Math.round(x / resolusi);
  const des = Math.max(0, Math.ceil(-Math.log10(resolusi) - 1e-9)) + 3;
  return Number((k * resolusi).toFixed(Math.min(des, 20)));
}

/**
 * Bacaan alat: nilai benar + N(0, σ_tot²), lalu dibulatkan ke resolusi.
 * σ_tot = √(sigma² + (sigmaRel·|nilai|)²). Sebaran bacaan yang teramati
 * menjadi ≈ √(σ_tot² + resolusi²/12) (GUM F.2.2.1).
 *
 * Tidak dipotong ke rentang alat; bila Client membatasi rentang, ia wajib
 * memberi penanda di layar (aturan-hidrolab §4).
 */
export function bacaAlat(nilaiBenar: number, alat: AlatBaca, rng: Rng): number {
  const s = Math.hypot(alat.sigma ?? 0, (alat.sigmaRel ?? 0) * Math.abs(nilaiBenar));
  const x = s > 0 ? nilaiBenar + s * normalBaku(rng) : nilaiBenar;
  return bulatkanKe(x, alat.resolusi);
}

/* ------------------------------------------------------------------ *
 * Ringkasan statistik
 * ------------------------------------------------------------------ */

export type Ringkasan = {
  n: number;
  rerata: number;
  /** Simpangan baku sampel (pembagi n − 1); NaN bila n < 2 */
  sd: number;
  /** Galat baku rerata sd/√n; NaN bila n < 2 */
  seRerata: number;
};

/** Ringkasan; nilai bukan angka hingga dibuang dulu. */
export function ringkasan(xs: readonly number[]): Ringkasan {
  const v = xs.filter(Number.isFinite);
  const n = v.length;
  if (n === 0) return { n, rerata: NaN, sd: NaN, seRerata: NaN };
  const rerata = v.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return { n, rerata, sd: NaN, seRerata: NaN };
  const ss = v.reduce((a, b) => a + (b - rerata) ** 2, 0);
  const sd = Math.sqrt(ss / (n - 1));
  return { n, rerata, sd, seRerata: sd / Math.sqrt(n) };
}

/* ------------------------------------------------------------------ *
 * Kalibrasi Cd
 * ------------------------------------------------------------------ */

export type Kalibrasi = {
  /** Cd kuadrat terkecil lewat titik asal: Σ Qu·Qt / Σ Qt² */
  cd: number;
  /** Galat baku cd: √(Σ(Qu − cd·Qt)² / (n − 1) / Σ Qt²) */
  seCd: number;
  /** Rerata dan simpangan baku Cd per titik (Qu/Qt) */
  cdRerata: number;
  cdSd: number;
  n: number;
};

/**
 * Kalibrasi dari pasangan (Q ukur, Q teori dengan Cd = 1). Pasangan dengan
 * nilai bukan angka atau Q teori ≤ 0 dibuang.
 */
export function kalibrasiCd(pasangan: readonly { qUkur: number; qTeori: number }[]): Kalibrasi {
  const p = pasangan.filter((d) => Number.isFinite(d.qUkur) && Number.isFinite(d.qTeori) && d.qTeori > 0);
  const n = p.length;
  if (n === 0) return { cd: NaN, seCd: NaN, cdRerata: NaN, cdSd: NaN, n };
  const sTT = p.reduce((a, d) => a + d.qTeori * d.qTeori, 0);
  const sUT = p.reduce((a, d) => a + d.qUkur * d.qTeori, 0);
  const cd = sUT / sTT;
  const sse = p.reduce((a, d) => a + (d.qUkur - cd * d.qTeori) ** 2, 0);
  const seCd = n > 1 ? Math.sqrt(sse / (n - 1) / sTT) : NaN;
  const r = ringkasan(p.map((d) => d.qUkur / d.qTeori));
  return { cd, seCd, cdRerata: r.rerata, cdSd: r.sd, n };
}

/**
 * Q teori ambang V dengan Cd = 1, rumus sama dengan notchDischarge:
 * Q = (8/15)·√(2g)·tan(θ/2)·(H + kh)^(5/2). kh bawaan NOTCH_KH (model
 * lembar FM-01); kh = 0 untuk rumus buku ajar tanpa koreksi.
 */
export function qTeoriAmbangV(H: number, thetaDeg: number, kh: number = NOTCH_KH): number {
  const he = Math.max(0, H) + kh;
  return (8 / 15) * Math.sqrt(2 * G) * Math.tan((thetaDeg * Math.PI) / 360) * Math.pow(he, 2.5);
}

/** Cd satu titik ambang V: Q ukur / Q teori. */
export function cdAmbangV(H: number, Q: number, thetaDeg: number, kh: number = NOTCH_KH): number {
  return Q / qTeoriAmbangV(H, thetaDeg, kh);
}

export function kalibrasiAmbangV(
  titik: readonly { H: number; Q: number }[],
  thetaDeg: number,
  kh: number = NOTCH_KH
): Kalibrasi {
  return kalibrasiCd(titik.map((d) => ({ qUkur: d.Q, qTeori: qTeoriAmbangV(d.H, thetaDeg, kh) })));
}

/**
 * Q teori venturi dengan C = 1, rumus sama dengan venturiDischarge:
 * Q = A2·√(2g·Δh) / √(1 − β⁴). NaN bila β ≥ 1 (bukan venturi).
 */
export function qTeoriVenturi(dh: number, D1: number, D2: number): number {
  const beta = D1 > 0 ? D2 / D1 : 1;
  if (beta >= 1) return NaN;
  const A2 = (Math.PI / 4) * D2 * D2;
  return (A2 * Math.sqrt(2 * G * Math.max(dh, 0))) / Math.sqrt(1 - beta ** 4);
}

export function cdVenturi(dh: number, Q: number, D1: number, D2: number): number {
  return Q / qTeoriVenturi(dh, D1, D2);
}

export function kalibrasiVenturi(titik: readonly { dh: number; Q: number }[], D1: number, D2: number): Kalibrasi {
  return kalibrasiCd(titik.map((d) => ({ qUkur: d.Q, qTeori: qTeoriVenturi(d.dh, D1, D2) })));
}

export type KalibrasiPangkat = { K: number; m: number; r2: number; n: number };

/**
 * y = K·x^m lewat kuadrat terkecil pada (ln x, ln y). Titik x ≤ 0 atau
 * y ≤ 0 dibuang. Untuk FM-01 m mestinya ≈ 2,5, FM-02 ≈ 0,5.
 */
export function kalibrasiPangkat(titik: readonly { x: number; y: number }[]): KalibrasiPangkat {
  const p = titik.filter((d) => d.x > 0 && d.y > 0 && Number.isFinite(d.x) && Number.isFinite(d.y));
  const n = p.length;
  if (n < 2) return { K: NaN, m: NaN, r2: NaN, n };
  const X = p.map((d) => Math.log(d.x));
  const Y = p.map((d) => Math.log(d.y));
  const mx = X.reduce((a, b) => a + b, 0) / n;
  const my = Y.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (X[i] - mx) ** 2;
    sxy += (X[i] - mx) * (Y[i] - my);
    syy += (Y[i] - my) ** 2;
  }
  if (sxx === 0) return { K: NaN, m: NaN, r2: NaN, n };
  const m = sxy / sxx;
  return { K: Math.exp(my - m * mx), m, r2: syy > 0 ? (sxy * sxy) / (sxx * syy) : 1, n };
}

/* ------------------------------------------------------------------ *
 * Integrasi kurva (FM-05)
 * ------------------------------------------------------------------ */

/**
 * ∫ (c − latar) dt dengan aturan trapesium; langkah boleh tak seragam.
 * Panjang t dan c harus sama (yang lebih panjang dipotong).
 */
export function integrasiTrapesium(t: readonly number[], c: readonly number[], latar = 0): number {
  const n = Math.min(t.length, c.length);
  let I = 0;
  for (let i = 1; i < n; i++) I += ((c[i] - latar + c[i - 1] - latar) / 2) * (t[i] - t[i - 1]);
  return I;
}

/**
 * Debit suntikan sesaat dari luas kurva, sama dengan Qgulp tracerCurve:
 * Q = M / ∫c dt. M kg, luas mg/L·s, hasil m³/s. 0 bila luas ≤ 0.
 */
export function debitGulp(Mkg: number, luas: number): number {
  return luas > 0 ? (Mkg * 1e6) / luas / 1000 : 0;
}

/* ------------------------------------------------------------------ *
 * Ekspor
 * ------------------------------------------------------------------ */

export type KolomEkspor<R> = {
  key: string;
  judul: Bi<string>;
  satuan?: Bi<string>;
  /** Digit desimal saat diekspor; tanpa ini nilai penuh */
  digits?: number;
  /** Kolom hitungan; tanpa ini nilai diambil dari r[key] */
  hitung?: (r: R) => number;
};

/**
 * Kepala dan baris untuk downloadXlsx(kepala, baris, nama) atau
 * downloadCsv. Angka bukan hingga menjadi null (sel kosong).
 */
export function barisEkspor<R>(
  kolom: readonly KolomEkspor<R>[],
  rows: readonly R[],
  lang: "id" | "en"
): { kepala: string[]; baris: XlsxCell[][] } {
  const kepala = kolom.map((k) => (k.satuan ? `${k.judul[lang]} (${k.satuan[lang]})` : k.judul[lang]));
  const baris = rows.map((r) =>
    kolom.map((k): XlsxCell => {
      const v = k.hitung ? k.hitung(r) : (r as Record<string, unknown>)[k.key];
      if (typeof v === "number") {
        if (!Number.isFinite(v)) return null;
        return k.digits === undefined ? v : Number(v.toFixed(k.digits));
      }
      if (typeof v === "string" || v instanceof Date) return v;
      return null;
    })
  );
  return { kepala, baris };
}
