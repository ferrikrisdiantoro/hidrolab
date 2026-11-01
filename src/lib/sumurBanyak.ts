/*
 * Banyak sumur pompa dan sumur bayangan dekat sungai (GW-02 Phase 3).
 *
 * Dasar tiap sumur sama dengan GW-02 sekarang (wellDrawdownAt di
 * hydraulics.ts): rumus Thiem tunak dengan jari-jari pengaruh R tetap,
 * jarak dipotong ke [rw, R]. Satu sumur tanpa sungai memberi angka yang SAMA
 * dengan wellDrawdownAt (diuji). Theis (tak tunak) tidak dipakai di sini.
 *
 * Superposisi dikerjakan pada potensial debit, bukan pada tinggi muka air
 * (Strack 1989, Groundwater Mechanics; buku tidak dibuka langsung, definisi
 * dibaca dari vignette paket R raem yang merujuknya: Φ = ½ k (h − zb)² untuk
 * aliran bebas, Φ linear terhadap h untuk tertekan, "by superimposing the
 * individual solutions, the combined effect of all elements can be
 * calculated at any point in space"):
 *
 *   tertekan:  s = Σ Qi ln(R/ri) / (2π T)
 *   bebas:     H² − h² = Σ Qi ln(R/ri) / (π k)
 *
 * Pada akuifer bebas yang dijumlah adalah H² − h², BUKAN s. Bentuk itu sama
 * dengan menjumlah penurunan terkoreksi Jacob s − s²/(2m) (Ferris dkk. 1962,
 * USGS WSP 1536-E hlm. 102–103), karena H² − (H − s)² = 2H (s − s²/2H).
 *
 * Sungai (Ferris dkk. 1962 hlm. 146–147, gb. 35): sungai tetap (perennial)
 * yang menembus penuh = garis bertinggi tekan tetap, tanpa penurunan di
 * sepanjang sungai. Diganti sumur bayangan IMBUH (−Q) pada jarak yang sama
 * di seberang sungai, segaris tegak lurus sungai. Di sisi akuifer penurunan
 * menjadi Q ln(r'/r)/(2πT). Sungai di sini garis x = river.x (sejajar
 * sumbu y). Titik di seberang sungai bukan akuifer: s = 0 dan ditandai.
 */

export type Sumur = {
  x: number;
  y: number;
  /** Debit, m³/s; positif = dipompa, negatif = diimbuhkan */
  Q: number;
};

export type AkuiferSumur = {
  /** Permeabilitas, m/s */
  k: number;
  /** Tebal akuifer tertekan atau tinggi muka air awal akuifer bebas H, m */
  thickness: number;
  /** Jari-jari sumur, m */
  rw: number;
  /** Jari-jari pengaruh, m */
  R: number;
  confined: boolean;
};

/** Sungai lurus x = konstanta */
export type Sungai = { x: number };

export type TitikMedan = {
  /** Penurunan, m (negatif = muka air naik) */
  s: number;
  /** Tinggi muka air (bebas) atau tinggi tekan (tertekan) di atas dasar akuifer, m */
  h: number;
  /** Akuifer bebas kering di titik ini (H² − h² ≥ H²); s dibatasi = H */
  dry: boolean;
  /** Titik berada di seberang sungai, tidak dihitung */
  beyondRiver: boolean;
};

/** Sisi akuifer terhadap sungai: tanda (x sumur pertama − x sungai). */
export function periksaSumur(
  wells: Sumur[],
  river: Sungai
): { sisiAkuifer: -1 | 0 | 1; salahSisi: boolean[] } {
  const sisi = wells.length > 0 ? (Math.sign(wells[0].x - river.x) as -1 | 0 | 1) : 0;
  return {
    sisiAkuifer: sisi,
    salahSisi: wells.map((w) => sisi === 0 || Math.sign(w.x - river.x) !== sisi),
  };
}

/** Sumur bayangan imbuh tiap sumur nyata: dicerminkan terhadap sungai, debit berlawanan. */
export function sumurBayangan(wells: Sumur[], river: Sungai): Sumur[] {
  return wells.map((w) => ({ x: 2 * river.x - w.x, y: w.y, Q: -w.Q }));
}

/** Σ Qi ln(R/ri) dengan ri dipotong ke [rw, R] seperti wellDrawdownAt. */
function jumlahLog(wells: Sumur[], x: number, y: number, aq: AkuiferSumur): number[] {
  return wells.map((w) => {
    const r = Math.hypot(x - w.x, y - w.y);
    const rr = Math.min(Math.max(r, aq.rw), aq.R);
    return w.Q * Math.log(aq.R / rr);
  });
}

/** Keadaan muka air di (x, y). */
export function medanSumur(
  wells: Sumur[],
  x: number,
  y: number,
  aq: AkuiferSumur,
  river?: Sungai
): TitikMedan {
  const H = aq.thickness;
  let semua = wells;
  if (river) {
    const sisi = periksaSumur(wells, river).sisiAkuifer;
    if (sisi !== 0 && Math.sign(x - river.x) === -sisi) {
      return { s: 0, h: H, dry: false, beyondRiver: true };
    }
    semua = [...wells, ...sumurBayangan(wells, river)];
  }
  const suku = jumlahLog(semua, x, y, aq);
  if (aq.confined) {
    const T = aq.k * H;
    let s = 0;
    for (const v of suku) s += T > 0 ? v / (2 * Math.PI * T) : v === 0 ? 0 : Infinity * Math.sign(v);
    return { s, h: H - s, dry: false, beyondRiver: false };
  }
  // bebas: H² − h² = Σ Q ln(R/r)/(π k); urutan hitung sama dengan wellDrawdownAt
  let jumlah = 0;
  for (const v of suku) jumlah += v / (Math.PI * Math.max(aq.k, 1e-30));
  const sisa = H * H - jumlah;
  if (sisa <= 0) return { s: H, h: 0, dry: true, beyondRiver: false };
  const h = Math.sqrt(sisa);
  return { s: H - h, h, dry: false, beyondRiver: false };
}

/** Penurunan di (x, y), m. Kontrak RENCANA S9 M10. */
export function drawdownField(
  wells: Sumur[],
  x: number,
  y: number,
  aq: AkuiferSumur,
  river?: Sungai
): number {
  return medanSumur(wells, x, y, aq, river).s;
}

/**
 * Kisi penurunan untuk peta kontur dan permukaan 3D (satu sumber untuk
 * keduanya). s[j·nx + i] pada x = x0 + (x1 − x0)·i/(nx − 1),
 * y = y0 + (y1 − y0)·j/(ny − 1).
 */
export function gridPenurunan(
  wells: Sumur[],
  aq: AkuiferSumur,
  area: { x0: number; x1: number; y0: number; y1: number },
  nx: number,
  ny: number,
  river?: Sungai
): { s: Float64Array; nx: number; ny: number; sMax: number; sMin: number; adaKering: boolean } {
  const s = new Float64Array(nx * ny);
  let sMax = -Infinity;
  let sMin = Infinity;
  let adaKering = false;
  for (let j = 0; j < ny; j++) {
    const y = ny > 1 ? area.y0 + ((area.y1 - area.y0) * j) / (ny - 1) : area.y0;
    for (let i = 0; i < nx; i++) {
      const x = nx > 1 ? area.x0 + ((area.x1 - area.x0) * i) / (nx - 1) : area.x0;
      const m = medanSumur(wells, x, y, aq, river);
      s[j * nx + i] = m.s;
      if (m.s > sMax) sMax = m.s;
      if (m.s < sMin) sMin = m.s;
      if (m.dry) adaKering = true;
    }
  }
  return { s, nx, ny, sMax, sMin, adaKering };
}
