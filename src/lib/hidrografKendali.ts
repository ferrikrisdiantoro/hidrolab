/*
 * Hidrograf masuk yang DIBENTUK dari titik kendali yang diseret (HY-01).
 *
 * Ini BUKAN model fisika. Tidak ada hujan, DAS, atau hidrograf satuan di
 * sini: pengguna menaruh beberapa titik (t, Q) dan berkas ini hanya
 * menyambungnya menjadi deret yang rapi supaya bisa diumpankan ke
 * reservoirRouting (hydraulics.ts), yang menerima deret masuk bebas.
 * Yang dijamin hanya sifat geometri:
 *
 * - urutan titik menurut indeks tidak pernah berubah (titik tidak melompati
 *   tetangganya), jarak waktu minimum ditegakkan, Q tidak negatif;
 * - setiap titik yang digeser atau dipotong ditandai (`dibatasi`), supaya
 *   Client bisa memasang penanda di layar (aturan-hidrolab bagian 4);
 * - sambungan monoton per ruas (Fritsch & Carlson 1980): kurva tidak
 *   melampaui puncak yang digambar dan tidak turun di bawah nol di antara
 *   dua titik, sehingga tidak muncul debit yang tidak pernah digambar.
 *
 * Rujukan interpolasi: Fritsch, F.N. & Carlson, R.E. (1980). Monotone
 * piecewise cubic interpolation. SIAM J. Numer. Anal. 17(2), 238–246.
 * Langkah yang dipakai (dibuka lewat ringkasan Wikipedia "Monotone cubic
 * interpolation", bagian Interpolant selection): garis potong δk, turunan
 * awal rata-rata δ, nol bila tanda δ berbeda atau δ = 0, lalu (α, β)
 * dipaksa masuk lingkaran berjari-jari 3, τ = 3/√(α² + β²).
 */

export type TitikHidrograf = { t: number; Q: number };

export type BatasTitik = {
  /** Waktu paling awal titik pertama */
  tMin?: number;
  /** Waktu paling akhir titik terakhir */
  tMax?: number;
  /** Debit terbesar yang boleh diseret */
  QMax?: number;
};

/**
 * Menegakkan urutan, jarak minimum, dan batas. Masukan tidak diubah.
 *
 * Titik ke-i dibatasi ke [tMin + i·g, tMax − (n−1−i)·g] lalu didorong maju
 * bila terlalu dekat titik sebelumnya. Bila rentang [tMin, tMax] terlalu
 * sempit untuk n titik, g dikecilkan menjadi (tMax − tMin)/(n − 1).
 */
export function rapikanTitik(
  p: TitikHidrograf[],
  minGap: number,
  batas: BatasTitik = {}
): { titik: TitikHidrograf[]; dibatasi: boolean[] } {
  const n = p.length;
  const tMin = batas.tMin ?? -Infinity;
  const tMax = batas.tMax ?? Infinity;
  const QMax = batas.QMax ?? Infinity;
  let g = Math.max(minGap, 0);
  if (n > 1 && Number.isFinite(tMin) && Number.isFinite(tMax)) {
    g = Math.min(g, Math.max(tMax - tMin, 0) / (n - 1));
  }
  const titik: TitikHidrograf[] = [];
  const dibatasi: boolean[] = [];
  for (let i = 0; i < n; i++) {
    let t = p[i].t;
    let Q = p[i].Q;
    const bawah = tMin + i * g;
    const atas = tMax - (n - 1 - i) * g;
    if (t < bawah) t = bawah;
    if (t > atas) t = atas;
    if (i > 0 && t < titik[i - 1].t + g) t = titik[i - 1].t + g;
    if (!(Q >= 0)) Q = 0;
    if (Q > QMax) Q = QMax;
    titik.push({ t, Q });
    dibatasi.push(t !== p[i].t || Q !== p[i].Q);
  }
  return { titik, dibatasi };
}

export type MetodeSambung = "monoton" | "linear";

/** Turunan Fritsch–Carlson di tiap titik. Anggapan: t naik tegas. */
function turunanMonoton(p: TitikHidrograf[]): number[] {
  const n = p.length;
  const m = new Array<number>(n).fill(0);
  if (n < 2) return m;
  const d: number[] = [];
  for (let k = 0; k < n - 1; k++) d.push((p[k + 1].Q - p[k].Q) / (p[k + 1].t - p[k].t));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) {
    m[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
  }
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) {
      m[k] = 0;
      m[k + 1] = 0;
      continue;
    }
    let a = m[k] / d[k];
    let b = m[k + 1] / d[k];
    if (a < 0) {
      m[k] = 0;
      a = 0;
    }
    if (b < 0) {
      m[k + 1] = 0;
      b = 0;
    }
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[k] = tau * a * d[k];
      m[k + 1] = tau * b * d[k];
    }
  }
  return m;
}

/** Titik dengan t naik tegas (yang tidak naik dibuang). */
function bersihkan(p: TitikHidrograf[]): TitikHidrograf[] {
  const out: TitikHidrograf[] = [];
  for (const q of p) {
    if (out.length === 0 || q.t > out[out.length - 1].t) out.push(q);
  }
  return out;
}

function evaluasi(p: TitikHidrograf[], m: number[] | null, t: number): number {
  const n = p.length;
  if (n === 0) return 0;
  if (t <= p[0].t) return p[0].Q;
  if (t >= p[n - 1].t) return p[n - 1].Q;
  let k = 0;
  let hi = n - 1;
  while (hi - k > 1) {
    const mid = (k + hi) >> 1;
    if (p[mid].t <= t) k = mid;
    else hi = mid;
  }
  const h = p[k + 1].t - p[k].t;
  const s = (t - p[k].t) / h;
  if (!m) return p[k].Q + (p[k + 1].Q - p[k].Q) * s;
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  return h00 * p[k].Q + h10 * h * m[k] + h01 * p[k + 1].Q + h11 * h * m[k + 1];
}

/** Nilai hidrograf kendali pada waktu t (di luar rentang: nilai ujung). */
export function nilaiHidrograf(
  p: TitikHidrograf[],
  t: number,
  metode: MetodeSambung = "monoton"
): number {
  const q = bersihkan(p);
  return evaluasi(q, metode === "monoton" ? turunanMonoton(q) : null, t);
}

/**
 * Deret {t, Q} dari titik kendali, kisi rata dt dari titik pertama sampai
 * terakhir, ditambah waktu tiap titik kendali supaya puncak yang digambar
 * tercatat persis (pelajaran triangularInflow). Satuan t mengikuti masukan
 * (jam untuk reservoirRouting).
 */
export function hidrografDariTitik(
  p: TitikHidrograf[],
  dt: number,
  metode: MetodeSambung = "monoton"
): TitikHidrograf[] {
  const q = bersihkan(p);
  if (q.length === 0) return [];
  const m = metode === "monoton" ? turunanMonoton(q) : null;
  const t0 = q[0].t;
  const t1 = q[q.length - 1].t;
  const langkah = dt > 0 ? dt : Math.max(t1 - t0, 1) / 100;
  const waktu: number[] = [];
  const nKisi = Math.floor((t1 - t0) / langkah + 1e-9);
  for (let i = 0; i <= nKisi; i++) waktu.push(t0 + i * langkah);
  for (const x of q) waktu.push(x.t);
  waktu.sort((a, b) => a - b);
  const eps = 1e-9 * Math.max(Math.abs(t1 - t0), 1);
  const out: TitikHidrograf[] = [];
  let k = 0;
  for (const t of waktu) {
    if (t > t1 + eps) continue;
    // titik kendali didahulukan: kisi yang nyaris berimpit dibuang
    while (k < q.length && q[k].t < t - eps) k++;
    const kendali = k < q.length && Math.abs(q[k].t - t) <= eps ? q[k] : null;
    const tt = kendali ? kendali.t : t;
    if (out.length > 0 && tt - out[out.length - 1].t <= eps) {
      if (kendali) out[out.length - 1] = { t: kendali.t, Q: kendali.Q };
      continue;
    }
    out.push(kendali ? { t: kendali.t, Q: kendali.Q } : { t, Q: evaluasi(q, m, t) });
  }
  return out;
}

/** Isi hidrograf (trapesium), m³, untuk t dalam jam dan Q dalam m³/s. */
export function volumeHidrograf(d: TitikHidrograf[]): number {
  let v = 0;
  for (let i = 1; i < d.length; i++) v += ((d[i].Q + d[i - 1].Q) / 2) * (d[i].t - d[i - 1].t) * 3600;
  return v;
}

/**
 * Titik kendali awal yang meniru triangularInflow (hydraulics.ts): 0 pada
 * t = 0, puncak Ip pada tp, 0 pada tb = 2,67 tp, ekor nol sampai 1,6 tb.
 * Dengan metode "linear" deretnya sama dengan triangularInflow.
 */
export function titikDariSegitiga(peak: number, tPeak: number): TitikHidrograf[] {
  const tb = 2.67 * tPeak;
  return [
    { t: 0, Q: 0 },
    { t: tPeak, Q: peak },
    { t: tb, Q: 0 },
    { t: 1.6 * tb, Q: 0 },
  ];
}
