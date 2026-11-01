/**
 * M2 Gerak renang ikan untuk EH-04 dan fishGlyph: frekuensi kibasan ekor
 * dari kecepatan renang dan panjang tubuh, amplitudo, dan gelombang tubuh.
 *
 * Model ini hanya untuk gambar beranimasi. Daya tahan dan mode renang tetap
 * dari fishSwim() di hydraulics.ts; lembar memberikan kecepatan renang hasil
 * fishSwim ke tailBeat() untuk menentukan seberapa cepat ekor mengibas.
 *
 * Satuan SI. tailBeat() dan bodyMidline() menerima wadah keluaran supaya
 * dapat dipanggil tiap frame tanpa membuat objek atau array baru.
 */

/* ------------------------------------------------------------------ *
 * Bainbridge (1958)
 * ------------------------------------------------------------------ */

/**
 * Frekuensi kibasan terendah tempat hubungan linier Bainbridge berlaku.
 *
 * Rujukan: Bainbridge, R. (1958), The speed of swimming of fish as related
 * to size and to the frequency and amplitude of the tail beat, J. Exp. Biol.
 * 35, 109-133. Naskah asli tidak dapat diunduh (penerbit menolak); abstrak
 * dibaca pada bibliografi USGS UMESC (fish_passage/bainbridge.html):
 * "Above a frequency of 5 tail beats per second, speed is directly
 * dependent upon frequency", dan rumus V = 1/4 {L (3f - 4)} dengan V cm/s,
 * L cm, f kibasan per detik.
 */
export const BAINBRIDGE_F_MIN = 5;

/**
 * Kecepatan renang dari frekuensi kibasan, V = L (3f - 4) / 4.
 *
 * Rumus asli dalam cm/s dan cm; karena kedua ruas sebanding dengan satuan
 * panjang yang sama, rumus yang sama berlaku dalam m/s dan m.
 */
export function bainbridgeSpeed(
  /** Frekuensi kibasan ekor, per detik */
  f: number,
  /** Panjang tubuh, m */
  L: number
): number {
  return (L * (3 * f - 4)) / 4;
}

/* ------------------------------------------------------------------ *
 * Amplitudo dan gelombang tubuh
 * ------------------------------------------------------------------ */

/**
 * Amplitudo kibasan ekor puncak ke puncak, dalam panjang tubuh.
 *
 * Rujukan: Hunter, J.R. & Zweifel, J.R. (1971), Swimming speed, tail beat
 * frequency, tail beat amplitude, and size in jack mackerel, Trachurus
 * symmetricus, and other fishes, Fishery Bulletin 69(2), 253-266, gbr. 6 dan
 * pembahasan hlm. 263-264: "A = 0.21L" untuk gabungan ikan mereka dan semua
 * ikan Bainbridge (1958); amplitudo diukur sebagai jarak antara simpangan
 * terjauh ekor ke kiri dan ke kanan (puncak ke puncak), dan tetap pada semua
 * kecepatan renang mantap. Naskah dibuka dari swfsc-publications.fisheries.noaa.gov.
 */
export const TAIL_AMPLITUDE_PP = 0.21;

/**
 * Selubung amplitudo sepanjang tubuh, A(x/L)/L = c0 + c1 xi + c2 xi^2.
 *
 * Rujukan: Videler, J.J. (1993), Fish Swimming, Chapman & Hall, data ikan
 * saithe berenang mantap: A(0) = 0,02, A(0,2) = 0,01, A(1) = 0,10 (simpangan
 * dari sumbu). Buku asli TIDAK dibuka; angka dan koefisien dibaca dari
 * Khalid dkk. (2020), Larger wavelengths suit the hydrodynamics of
 * carangiform swimmers, arXiv:2010.04748, yang mengutip Videler (1993):
 * "A(x/L) = 0.02 - 0.0825(x/L) + 0.1625(x/L)^2". Simpangan ekor 0,10 L
 * cocok dengan separuh 0,21 L Hunter & Zweifel di atas.
 */
export const VIDELER_ENVELOPE = [0.02, -0.0825, 0.1625] as const;

/**
 * Panjang gelombang tubuh dalam panjang tubuh, untuk perenang carangiform
 * dan subcarangiform.
 *
 * Rujukan: Khalid dkk. (2020) arXiv:2010.04748 (mengutip Sfakiotakis dkk.
 * 1999 dan Lauder & Madden 2006): "lambda is observed to be either equal to
 * or slightly larger than L". Nilai dari Videler (1993) sendiri tidak dapat
 * dicek karena bukunya tidak dibuka; dipakai 1 L.
 */
export const BODY_WAVELENGTH = 1;

/** Selubung amplitudo pada posisi xi = x/L (0 kepala, 1 ekor), dalam L. */
export function bodyAmplitude(xi: number): number {
  const [c0, c1, c2] = VIDELER_ENVELOPE;
  return c0 + c1 * xi + c2 * xi * xi;
}

export type TailBeat = {
  /** Frekuensi kibasan ekor, per detik */
  frequency: number;
  /** Simpangan ujung ekor dari sumbu tubuh (separuh puncak ke puncak), m */
  amplitude: number;
  /** Panjang gelombang tubuh, m */
  wavelength: number;
  /**
   * Benar bila frekuensi di bawah 5 per detik (di luar rentang linier
   * Bainbridge), kecepatan negatif, atau panjang tubuh tidak positif.
   * Nilai tetap dihitung (diekstrapolasi) supaya animasi tidak putus;
   * lembar wajib memberi penanda di layar.
   */
  outOfRange: boolean;
};

/**
 * Kibasan ekor untuk kecepatan renang U dan panjang tubuh L, kebalikan rumus
 * Bainbridge: f = (4/3) (U/L + 1).
 */
export function tailBeat(
  /** Kecepatan renang terhadap air, m/s */
  U: number,
  /** Panjang tubuh, m */
  L: number,
  out?: TailBeat
): TailBeat {
  const o: TailBeat = out ?? { frequency: 0, amplitude: 0, wavelength: 0, outOfRange: true };
  const sah = L > 0 && U >= 0;
  const Lp = L > 0 ? L : 0;
  const Up = U >= 0 ? U : 0;
  const f = Lp > 0 ? (4 / 3) * (Up / Lp + 1) : 0;
  o.frequency = f;
  o.amplitude = bodyAmplitude(1) * Lp;
  o.wavelength = BODY_WAVELENGTH * Lp;
  o.outOfRange = !sah || f < BAINBRIDGE_F_MIN;
  return o;
}

/**
 * Garis tengah tubuh pada waktu t, dalam kerangka tubuh (kepala di x = 0,
 * ekor di x = L, sumbu y menyamping):
 *
 *   y(x, t) = L A(x/L) sin(2 pi (x/lambda - f t))
 *
 * Gelombang merambat dari kepala ke ekor dengan laju f lambda. Panjang
 * tubuh di sepanjang x dianggap tidak memendek (simpangan kecil).
 *
 * `out` diisi pasangan (x, y) sebanyak out.length / 2 titik yang berjarak
 * sama dari kepala ke ekor. Tidak ada alokasi.
 */
export function bodyMidline(
  /** Panjang tubuh, m */
  L: number,
  /** Frekuensi kibasan, per detik */
  f: number,
  /** Panjang gelombang tubuh, m */
  wavelength: number,
  /** Waktu, detik */
  t: number,
  out: Float32Array
): Float32Array {
  const n = out.length >> 1;
  if (n < 1) return out;
  const k = wavelength > 0 ? 1 / wavelength : 0;
  const dua = 2 * Math.PI;
  for (let i = 0; i < n; i++) {
    const xi = n > 1 ? i / (n - 1) : 0;
    const x = xi * L;
    out[2 * i] = x;
    out[2 * i + 1] = L * bodyAmplitude(xi) * Math.sin(dua * (x * k - f * t));
  }
  return out;
}
