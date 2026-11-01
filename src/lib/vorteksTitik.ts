/*
 * M3 (FP-02) Dinamika titik pusaran dua dimensi.
 *
 * N pusaran lurus (garis pusaran sejajar sumbu z) di fluida tak termampatkan
 * tak terbatas, diam di tak hingga. Tiap pusaran tidak menggerakkan dirinya
 * sendiri; ia dibawa medan semua pusaran lain. Partikel pelacak (tanpa
 * sirkulasi) dibawa medan semua pusaran.
 *
 * Satuan SI: posisi m, sirkulasi Γ m²/s, waktu s, kecepatan m/s.
 *
 * Rujukan yang dibuka (Lamb, H. 1932. Hydrodynamics, ed. 6, Cambridge;
 * teks Internet Archive dli.ernet.3284):
 * - Art. 154 (hlm. 219-220): pusaran berkekuatan κ di (x', y') memberi di
 *   (x, y) kecepatan −κ(y−y')/(2πr²), κ(x−x')/(2πr²), besarnya κ/(2πr),
 *   tegak lurus garis penghubung. Σκu = Σκv = 0 sehingga titik
 *   (Σκx/Σκ, Σκy/Σκ) tetap; bila Σκ = 0 pusat itu di tak hingga.
 * - Art. 155 (hlm. 220-221): dua pusaran berjarak tetap dan berputar
 *   terhadap pusat itu dengan kecepatan sudut (κ1+κ2)/(2π AB²); bila
 *   κ1 = −κ2 keduanya melaju κ/(2π AB) tegak lurus AB.
 * - Art. 167 (hlm. 229-230): bentuk Kirchhoff. Fungsi W yang bergantung
 *   hanya pada Σ κ1κ2 log r12 tetap; Σκx, Σκy tetap; Σκr² tetap (pers. 7).
 * - Art. 27, diulang di Art. 168 pers. (1)-(2): inti berpusaran seragam
 *   jari-jari a; kecepatan di dalam inti sebanding r. Dipakai sebagai
 *   "inti teredam" (inti Rankine) supaya medan dan partikel pelacak tidak
 *   tak hingga di pusat pusaran. Dengan inti nol modelnya titik murni.
 *
 * Saffman, P.G. (1992) Vortex Dynamics bab 2 TIDAK dapat dibuka saat
 * penulisan; tidak ada angka yang diambil darinya.
 *
 * Hamiltonian yang dilaporkan: H = Σ_{i<j} Γi Γj G(rij) dengan
 * G(r) = −ln(r)/(2π) untuk r ≥ a, dan G(r) = −[ln a + (r² − a²)/(2a²)]/(2π)
 * untuk r < a. Turunannya tepat memberi kecepatan di atas
 * (Γi dxi/dt = ∂H/∂yi, Γi dyi/dt = −∂H/∂xi), jadi H tetap untuk inti nol
 * maupun inti Rankine. Prefaktor 1/(2π) tidak memengaruhi kekekalannya.
 *
 * Pemaduan waktu: Runge-Kutta orde empat, vortex dan pelacak dipadu dalam
 * satu langkah supaya pelacak membaca posisi pusaran pada tahap yang sama.
 * Semua larik dialokasi sekali di createVortexSystem; stepVortices tidak
 * mengalokasi apa pun.
 */

export type PointVortex = {
  /** Posisi, m */
  x: number;
  y: number;
  /** Sirkulasi, m²/s; positif berlawanan arah jarum jam */
  gamma: number;
};

export type VortexSystem = {
  /** Banyaknya pusaran */
  n: number;
  x: Float64Array;
  y: Float64Array;
  gamma: Float64Array;
  /** Jari-jari inti Rankine, m. Nol berarti titik murni */
  core: number;
  /** Banyaknya partikel pelacak */
  m: number;
  /** Posisi partikel pelacak, m. Boleh ditulis langsung oleh pemanggil */
  tx: Float64Array;
  ty: Float64Array;
  /** Waktu berjalan, s */
  t: number;
  /** Larik kerja RK4, panjang n + m (dalam) */
  _px: Float64Array;
  _py: Float64Array;
  _kx: Float64Array[];
  _ky: Float64Array[];
};

export type VortexInvariants = {
  /** ΣΓ, m²/s */
  circulation: number;
  /** ΣΓx dan ΣΓy (impuls per satuan rapat massa, Lamb Art. 154), m³/s */
  impulseX: number;
  impulseY: number;
  /** Pusat sirkulasi ΣΓx/ΣΓ, m; NaN bila ΣΓ = 0 */
  centreX: number;
  centreY: number;
  /** ΣΓ r² terhadap titik asal (Lamb Art. 167 pers. 7), m⁴/s */
  angularImpulse: number;
  /** Hamiltonian Kirchhoff per satuan rapat massa, m⁴/s² */
  hamiltonian: number;
};

/**
 * Menyusun sistem pusaran. Posisi disalin ke larik bertipe.
 * opsi.core: jari-jari inti Rankine (m), bawaan 0.
 * opsi.tracers: banyaknya partikel pelacak (posisi awal nol, isi sendiri).
 */
export function createVortexSystem(
  vortices: PointVortex[],
  opsi: { core?: number; tracers?: number } = {}
): VortexSystem {
  const n = vortices.length;
  const m = Math.max(0, Math.floor(opsi.tracers ?? 0));
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const gamma = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = vortices[i].x;
    y[i] = vortices[i].y;
    gamma[i] = vortices[i].gamma;
  }
  const L = n + m;
  const kx: Float64Array[] = [];
  const ky: Float64Array[] = [];
  for (let k = 0; k < 4; k++) {
    kx.push(new Float64Array(L));
    ky.push(new Float64Array(L));
  }
  return {
    n,
    x,
    y,
    gamma,
    core: Math.max(0, opsi.core ?? 0),
    m,
    tx: new Float64Array(m),
    ty: new Float64Array(m),
    t: 0,
    _px: new Float64Array(L),
    _py: new Float64Array(L),
    _kx: kx,
    _ky: ky,
  };
}

/**
 * Faktor kernel f(r²) sehingga kecepatan = Γ/(2π) · f · (−dy, dx).
 * Titik: f = 1/r². Inti Rankine (Lamb Art. 27): f = 1/a² di dalam inti.
 */
function kernel(r2: number, a2: number): number {
  if (r2 < a2) return 1 / a2;
  return r2 > 0 ? 1 / r2 : 0;
}

/** Kecepatan medan di titik (px, py) dari semua pusaran pada posisi xs, ys. */
function medan(
  n: number,
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  gamma: Float64Array,
  a2: number,
  px: number,
  py: number,
  skip: number,
  out: { u: number; v: number }
) {
  let u = 0;
  let v = 0;
  for (let j = 0; j < n; j++) {
    if (j === skip) continue;
    const dx = px - xs[j];
    const dy = py - ys[j];
    const f = (gamma[j] / (2 * Math.PI)) * kernel(dx * dx + dy * dy, a2);
    u -= f * dy;
    v += f * dx;
  }
  out.u = u;
  out.v = v;
}

const _tmp = { u: 0, v: 0 };

/**
 * Kecepatan medan (m/s) di sembarang titik, dari semua pusaran pada posisi
 * sekarang. Untuk medan vektor dan garis arus di gambar.
 */
export function vortexVelocityAt(
  sys: VortexSystem,
  px: number,
  py: number,
  out: { u: number; v: number } = { u: 0, v: 0 }
): { u: number; v: number } {
  medan(sys.n, sys.x, sys.y, sys.gamma, sys.core * sys.core, px, py, -1, out);
  return out;
}

/** Turunan waktu seluruh keadaan (pusaran lalu pelacak) pada posisi px, py. */
function turunan(sys: VortexSystem, px: Float64Array, py: Float64Array, kx: Float64Array, ky: Float64Array) {
  const { n, m, gamma } = sys;
  const a2 = sys.core * sys.core;
  for (let i = 0; i < n + m; i++) {
    medan(n, px, py, gamma, a2, px[i], py[i], i < n ? i : -1, _tmp);
    kx[i] = _tmp.u;
    ky[i] = _tmp.v;
  }
}

/** Satu langkah Runge-Kutta orde empat sepanjang dt detik, di tempat. */
export function stepVortices(sys: VortexSystem, dt: number): void {
  const { n, m } = sys;
  const L = n + m;
  if (L === 0 || !(dt > 0)) return;
  const px = sys._px;
  const py = sys._py;
  const [k1x, k2x, k3x, k4x] = sys._kx;
  const [k1y, k2y, k3y, k4y] = sys._ky;
  /* Keadaan awal langkah disimpan sementara di larik k4, yang baru diisi
     pada tahap keempat; pembaruan akhir menambah langsung ke sys.x. */
  const x0 = k4x;
  const y0 = k4y;
  for (let i = 0; i < n; i++) {
    x0[i] = sys.x[i];
    y0[i] = sys.y[i];
  }
  for (let i = 0; i < m; i++) {
    x0[n + i] = sys.tx[i];
    y0[n + i] = sys.ty[i];
  }
  turunan(sys, x0, y0, k1x, k1y);
  for (let i = 0; i < L; i++) {
    px[i] = x0[i] + 0.5 * dt * k1x[i];
    py[i] = y0[i] + 0.5 * dt * k1y[i];
  }
  turunan(sys, px, py, k2x, k2y);
  for (let i = 0; i < L; i++) {
    px[i] = x0[i] + 0.5 * dt * k2x[i];
    py[i] = y0[i] + 0.5 * dt * k2y[i];
  }
  turunan(sys, px, py, k3x, k3y);
  for (let i = 0; i < L; i++) {
    px[i] = x0[i] + dt * k3x[i];
    py[i] = y0[i] + dt * k3y[i];
  }
  turunan(sys, px, py, k4x, k4y);
  const c = dt / 6;
  for (let i = 0; i < n; i++) {
    sys.x[i] += c * (k1x[i] + 2 * k2x[i] + 2 * k3x[i] + k4x[i]);
    sys.y[i] += c * (k1y[i] + 2 * k2y[i] + 2 * k3y[i] + k4y[i]);
  }
  for (let i = 0; i < m; i++) {
    const j = n + i;
    sys.tx[i] += c * (k1x[j] + 2 * k2x[j] + 2 * k3x[j] + k4x[j]);
    sys.ty[i] += c * (k1y[j] + 2 * k2y[j] + 2 * k3y[j] + k4y[j]);
  }
  sys.t += dt;
}

/**
 * Langkah waktu yang membatasi sudut putar pasangan pusaran tercepat
 * menjadi maxAngle radian per langkah. Kecepatan sudut pasangan i, j
 * diambil (|Γi| + |Γj|)/(2π r²) (Lamb Art. 155, batas atas untuk tanda
 * campuran), dengan r tidak kurang dari jari-jari inti.
 * Tak hingga bila tidak ada pasangan yang bergerak.
 */
export function vortexTimeStep(sys: VortexSystem, maxAngle = 0.05): number {
  const { n, x, y, gamma } = sys;
  const a2 = sys.core * sys.core;
  let wMaks = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const r2 = Math.max((x[i] - x[j]) ** 2 + (y[i] - y[j]) ** 2, a2);
      if (r2 <= 0) continue;
      const w = (Math.abs(gamma[i]) + Math.abs(gamma[j])) / (2 * Math.PI * r2);
      if (w > wMaks) wMaks = w;
    }
  return wMaks > 0 ? maxAngle / wMaks : Infinity;
}

/**
 * Memajukan sistem sepanjang T detik dengan langkah yang dipilih ulang tiap
 * langkah (vortexTimeStep), berakhir tepat di t + T. Langkah paling kecil
 * T/maxSubsteps supaya pusaran yang nyaris bertumpuk tidak membekukan
 * halaman; bila batas itu tercapai, ketelitiannya turun (bukan berhenti).
 * Partikel pelacak tidak ikut menentukan langkah: pakai inti > 0 bila
 * pelacak bisa mendekati pusat pusaran.
 */
export function advanceVortices(
  sys: VortexSystem,
  T: number,
  maxAngle = 0.05,
  maxSubsteps = 100000
): void {
  if (!(T > 0)) return;
  const t0 = sys.t;
  let sisa = T;
  const dtMin = T / maxSubsteps;
  while (sisa > 0) {
    let dt = Math.max(vortexTimeStep(sys, maxAngle), dtMin);
    if (!Number.isFinite(dt)) dt = sisa;
    if (dt >= sisa) dt = sisa;
    stepVortices(sys, dt);
    sisa -= dt;
    if (sisa < 1e-12 * T) break;
  }
  sys.t = t0 + T;
}

/** Besaran yang kekal (Lamb Art. 154, 167). */
export function vortexInvariants(sys: VortexSystem): VortexInvariants {
  const { n, x, y, gamma } = sys;
  const a = sys.core;
  let G = 0;
  let ix = 0;
  let iy = 0;
  let ar = 0;
  let H = 0;
  for (let i = 0; i < n; i++) {
    G += gamma[i];
    ix += gamma[i] * x[i];
    iy += gamma[i] * y[i];
    ar += gamma[i] * (x[i] * x[i] + y[i] * y[i]);
    for (let j = i + 1; j < n; j++) {
      const r2 = (x[i] - x[j]) ** 2 + (y[i] - y[j]) ** 2;
      let g: number;
      if (a > 0 && r2 < a * a) g = -(Math.log(a) + (r2 - a * a) / (2 * a * a)) / (2 * Math.PI);
      else g = -(0.5 * Math.log(r2)) / (2 * Math.PI);
      H += gamma[i] * gamma[j] * g;
    }
  }
  const skala = gamma.reduce((s, g) => Math.max(s, Math.abs(g)), 0);
  const nol = Math.abs(G) <= 1e-12 * skala;
  return {
    circulation: G,
    impulseX: ix,
    impulseY: iy,
    centreX: nol ? NaN : ix / G,
    centreY: nol ? NaN : iy / G,
    angularImpulse: ar,
    hamiltonian: H,
  };
}

/** Laju lurus pasangan sama kuat berlawanan, |Γ|/(2πd) m/s (Lamb Art. 155). */
export function pairTranslationSpeed(gamma: number, d: number): number {
  return Math.abs(gamma) / (2 * Math.PI * d);
}

/** Kecepatan sudut dua pusaran terhadap pusatnya, (Γ1+Γ2)/(2πd²) rad/s (Lamb Art. 155). */
export function pairAngularVelocity(gamma1: number, gamma2: number, d: number): number {
  return (gamma1 + gamma2) / (2 * Math.PI * d * d);
}
