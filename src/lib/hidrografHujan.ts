/*
 * Hidrograf banjir dari hyetograph bebas (HY-02).
 *
 * Dua langkah, masing-masing dari NEH 630 (USDA NRCS):
 *
 * 1. Bab 10 "Estimation of Direct Runoff from Storm Rainfall" (Juli 2004),
 *    bagian 630.1002(c) "Runoff during a storm" dan Contoh 10-6 / Tabel 10-2
 *    hlm. 10-17 s.d. 10-18: rumus CN dipakai pada hujan KUMULATIF, lalu
 *    limpasan per pias adalah selisih limpasan kumulatif berurutan. Akibatnya
 *    hujan pertama habis mengisi abstraksi awal Ia = 0,2 S dan pias yang
 *    datang belakangan menghasilkan limpasan lebih banyak untuk hujan yang
 *    sama.
 *
 * 2. Bab 16 "Hydrographs" (Maret 2007), Contoh 16-1 hlm. 16-7 s.d. 16-13:
 *    hidrograf banjir = konvolusi limpasan per pias dengan hidrograf satuan
 *    (Tabel 16-4, cara "lajur kertas"). Tp = ΔD/2 + 0,6 Tc (pers. 16A-7),
 *    ΔD tidak lebih dari 0,25 Tp (hlm. 16A-3).
 *
 * Hidrograf satuan yang dipakai floodHydrographBlocks sama dengan
 * floodHydrograph di hydraulics.ts: segitiga SCS (qp = 0,208 A/Tp, padanan
 * SI dari faktor puncak 484), supaya kedua lembar konsisten. Contoh 16-1
 * NEH memakai hidrograf satuan lengkung; konvolusiHidrografSatuan diuji
 * langsung dengan ordinat lengkung itu.
 *
 * Batas model yang ditulis jujur: hujan dianggap merata di seluruh DAS
 * (model terpusat). Letak awan hujan tidak mengubah puncak di model ini.
 */

import {
  SCS_BLOCK_MAX_TP,
  scsEffectiveRain,
  scsPeakRate,
  scsStorage,
  scsUnitHydrograph,
  type HydrographPoint,
  type HydrographResult,
} from "./hydraulics.ts";

/** Cara membagi hujan efektif ke tiap pias. */
export type MetodeKehilangan =
  /** NEH 630 Bab 10 Contoh 10-6: CN pada hujan kumulatif (bawaan) */
  | "kumulatif"
  /**
   * Hujan efektif total dibagi sebanding hujan tiap pias (koefisien limpasan
   * tetap). Hanya untuk kesetaraan dengan floodHydrograph lama; bukan cara
   * NEH untuk pola hujan selama badai
   */
  | "sebanding";

export type HujanEfektifKumulatif = {
  /** Hujan kumulatif di akhir tiap pias, mm */
  Pkum: number[];
  /** Hujan efektif (limpasan langsung) kumulatif di akhir tiap pias, mm */
  PeKum: number[];
  /** Hujan efektif tiap pias, mm */
  Pe: number[];
  /** Hujan yang tertahan (abstraksi) tiap pias, mm */
  kehilangan: number[];
  /** Simpanan maksimum S, mm */
  S: number;
  /** Abstraksi awal Ia = 0,2 S, mm */
  Ia: number;
};

/**
 * Limpasan per pias dengan CN kumulatif, NEH 630 Bab 10 Contoh 10-6:
 * PeKum_i = Pe(Pkum_i), Pe_i = PeKum_i − PeKum_(i−1). Satuan mm.
 */
export function hujanEfektifKumulatif(blocksMm: number[], CN: number): HujanEfektifKumulatif {
  const S = scsStorage(CN);
  const Pkum: number[] = [];
  const PeKum: number[] = [];
  const Pe: number[] = [];
  const kehilangan: number[] = [];
  let P = 0;
  let sebelum = 0;
  for (const b of blocksMm) {
    P += Math.max(b, 0);
    const q = scsEffectiveRain(P, CN);
    Pkum.push(P);
    PeKum.push(q);
    // Pe(P) naik monoton, jadi selisihnya tidak negatif; max hanya penjaga
    // pembulatan titik mengambang.
    const d = Math.max(q - sebelum, 0);
    Pe.push(d);
    kehilangan.push(Math.max(b, 0) - d);
    sebelum = q;
  }
  return { Pkum, PeKum, Pe, kehilangan, S, Ia: 0.2 * S };
}

/**
 * Konvolusi diskret hidrograf satuan, NEH 630 Bab 16 Tabel 16-4:
 *
 *   Q_j = Σ_k e_k · U_(j−k),   j = 0 … n + m − 2
 *
 * e_k = limpasan pias ke-k (pias [kΔD, (k+1)ΔD]), U_i = ordinat hidrograf
 * satuan pada iΔD sesudah awal pias (U_0 biasanya 0). Satuan Q = satuan U
 * kali satuan e per satuan limpasan hidrograf satuan.
 */
export function konvolusiHidrografSatuan(excess: number[], uh: number[]): number[] {
  if (excess.length === 0 || uh.length === 0) return [];
  const Q = new Array<number>(excess.length + uh.length - 1).fill(0);
  for (let k = 0; k < excess.length; k++) {
    const e = excess[k];
    if (e === 0) continue;
    for (let i = 0; i < uh.length; i++) Q[k + i] += e * uh[i];
  }
  return Q;
}

export type PiasHujan = {
  /** Awal dan akhir pias, jam sejak hujan mulai */
  t0: number;
  t1: number;
  /** Hujan pias, mm */
  P: number;
  /** Hujan kumulatif di akhir pias, mm */
  Pkum: number;
  /** Hujan efektif pias, mm */
  Pe: number;
  /** Hujan efektif kumulatif di akhir pias, mm */
  PeKum: number;
  /** Hujan tertahan pias, mm */
  kehilangan: number;
};

export type HydrographBlocksResult = HydrographResult & {
  pias: PiasHujan[];
  kehilangan: MetodeKehilangan;
  /** Hujan total, mm */
  totalRain: number;
  /** Simpanan maksimum S dan abstraksi awal Ia, mm */
  S: number;
  Ia: number;
};

/**
 * Hidrograf banjir dari hujan per pias yang digambar bebas.
 *
 * Uji kesetaraan: pias seragam dengan ΔD = floodHydrograph().blockLength dan
 * kehilangan "sebanding" memberi deret yang sama dengan floodHydrograph
 * (kisi waktu, Tp, qp, hujan efektif). Dengan "kumulatif" (bawaan, cara NEH)
 * isi limpasan sama tetapi bentuknya berbeda: limpasan menumpuk di akhir.
 */
export function floodHydrographBlocks(
  /** Hujan tiap pias, mm (nilai negatif dianggap nol) */
  blocksMm: number[],
  /** Lama satu pias ΔD, jam */
  blockHours: number,
  CN: number,
  /** Luas DAS, km² */
  areaKm2: number,
  /** Waktu konsentrasi, jam */
  tc: number,
  opsi: { steps?: number; kehilangan?: MetodeKehilangan } = {}
): HydrographBlocksResult {
  const steps = opsi.steps ?? 400;
  const metode = opsi.kehilangan ?? "kumulatif";
  const n = blocksMm.length;
  const dD = Math.max(blockHours, 1e-9);
  const blok = blocksMm.map((b) => Math.max(b, 0));
  const totalRain = blok.reduce((a, b) => a + b, 0);

  const kum = hujanEfektifKumulatif(blok, CN);
  let Pe: number[];
  if (metode === "kumulatif") {
    Pe = kum.Pe;
  } else {
    const PeTot = scsEffectiveRain(totalRain, CN);
    Pe = blok.map((b) => (totalRain > 0 ? (PeTot * b) / totalRain : 0));
  }
  const effectiveRain = Pe.reduce((a, b) => a + b, 0);

  // NEH 630 Bab 16 pers. 16A-7: Tp = ΔD/2 + L, L = 0,6 Tc
  const tp = 0.5 * dD + 0.6 * tc;
  const qp = scsPeakRate(areaKm2, tp);
  const tb = 2.67 * tp;
  const duration = n * dD;
  const tAkhir = duration + tb;
  const dt = tAkhir / steps;

  const points: HydrographPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i * dt;
    let Q = 0;
    for (let k = 0; k < n; k++) {
      if (Pe[k] !== 0) Q += Pe[k] * qp * scsUnitHydrograph(t - k * dD, tp);
    }
    let rain = 0;
    if (t < duration && n > 0) rain = blok[Math.min(Math.floor(t / dD), n - 1)] / dD;
    points.push({ t, rain, Q });
  }

  let volume = 0;
  for (let i = 1; i < points.length; i++) {
    volume += ((points[i].Q + points[i - 1].Q) / 2) * (points[i].t - points[i - 1].t) * 3600;
  }
  const puncak = points.reduce((m, p) => (p.Q > m.Q ? p : m), points[0]);

  const pias: PiasHujan[] = blok.map((P, k) => {
    const PeKum = Pe.slice(0, k + 1).reduce((a, b) => a + b, 0);
    return {
      t0: k * dD,
      t1: (k + 1) * dD,
      P,
      Pkum: kum.Pkum[k],
      Pe: Pe[k],
      PeKum,
      kehilangan: P - Pe[k],
    };
  });

  return {
    points,
    peak: puncak.Q,
    peakTime: puncak.t,
    tp,
    qp,
    effectiveRain,
    volume,
    runoffDepth: areaKm2 > 0 ? (volume / (areaKm2 * 1e6)) * 1000 : 0,
    burstTooShort: false,
    blockLength: dD,
    blockTooCoarse: dD > SCS_BLOCK_MAX_TP * tp,
    pias,
    kehilangan: metode,
    totalRain,
    S: kum.S,
    Ia: kum.Ia,
  };
}
