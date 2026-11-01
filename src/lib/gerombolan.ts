/*
 * M4 (EH-05) Gerombolan ikan: model zona Couzin dkk. (2002) yang dijalankan
 * langkah demi langkah, ditambah rintangan menurut Reynolds (1999).
 *
 * Satuan SI: posisi m, laju m/s, waktu s, sudut rad.
 *
 * Rujukan yang dibuka:
 * - Couzin, I.D., Krause, J., James, R., Ruxton, G.D. & Franks, N.R. (2002).
 *   Collective memory and spatial sorting in animal groups. J. theor. Biol.
 *   218, 1-11. Hlm. 2-3 ("Behavioural rules: description"):
 *     zona tolak (zor) berprioritas mutlak, d = −Σ r_ij;
 *     bila tidak ada tetangga di zor: zona sejajar (zoo) d_o = Σ v_j dan
 *     zona tarik (zoa) d_a = Σ r_ij; keduanya ada: d = ½(d_o + d_a);
 *     vektor nol atau tanpa tetangga: d = v_i;
 *     tetangga di "blind volume" (360 − α) di belakang tidak terlihat;
 *     galat acak diputar dari sebaran Gauss terbungkus, simpangan σ;
 *     belok paling besar θτ per langkah, laju tetap s.
 *   Hlm. 4 pers. (4)-(6): p_group = |Σ v_i|/N, m_group = |Σ r_ic × v_i|/N,
 *   c_group = Σ c_i / N.
 *   Tabel 1 dan keterangan Gbr. 3: τ = 0,1 s, rr = 1, α = 270°, θ = 40°/s,
 *   s = 3, σ = 0,05 rad (satuan panjang tak berdimensi pada makalah).
 * - Reynolds, C.W. (1999). Steering behaviors for autonomous characters.
 *   Game Developers Conference (red3d.com/cwr/steer/gdc99). "Obstacle
 *   avoidance": jaga silinder ruang bebas di depan; untuk rintangan paling
 *   mengancam, kemudi = negatif proyeksi lateral pusat rintangan; bila tidak
 *   ada ancaman, nol. "Flee": kebalikan seek (dipakai bila ikan sudah di
 *   dalam rintangan).
 *
 * PENYIMPANGAN dari Couzin yang DIWARISI dari shoal() di hydraulics.ts
 * (sengaja dipertahankan supaya shoal(…, steps) = N kali stepShoal, M5):
 * - d = d_o/n_o + d_a/n_a (rata-rata per zona, bukan ½ jumlah ternormalisasi);
 *   arahnya berbeda dari Couzin bila kedua zona terisi tidak seimbang.
 * - Galat acak seragam (acak − 0,5)·σ, bukan Gauss terbungkus; ikan tanpa
 *   tetangga berkelana dengan σ dikali 12 dan tanpa batas belok.
 * - Lebar zona dari tiga bobot penggeser (lihat setShoalWeights), sudut buta
 *   60° (α = 300°), belok 0,15 rad per langkah 0,3 m pada laju 1 m/s.
 * - Pembangkit acak kongruen linear berbenih 20260919 (sama dengan shoal).
 * Keputusan menyamakan dengan Couzin murni = keputusan insinyur-hidraulika,
 * karena mengubah keluaran shoal() yang sudah diverifikasi di EH-05.
 *
 * Rintangan (tambahan, tidak ada di shoal()): prioritas di atas zona tolak.
 * Panjang silinder dihitung dari geometri belok, bukan angka pilihan: ikan
 * berbelok paling tajam pada jari-jari R = s/θ; lingkaran beloknya lolos dari
 * rintangan berjari-jari r bila pusat rintangan berjarak maju paling sedikit
 * √((R + r + b)² − R²), ditambah satu langkah s·dt karena keputusan diambil
 * sekali per langkah. b = jari-jari badan = ½ zona tolak (Couzin hlm. 3:
 * zor = ruang pribadi/menghindari tabrakan).
 *
 * Predator TIDAK dimodelkan: tidak ada sumber jarak lari/respons predator
 * yang dibuka (RENCANA S9 M4: rintangan saja).
 *
 * Semua larik dialokasi di createShoal; stepShoal tidak mengalokasi.
 */

/** Benih bawaan, sama dengan shoal() di hydraulics.ts */
export const SHOAL_SEED = 20260919;
/** Langkah waktu bawaan, s: laju 1 m/s × 0,3 s = 0,3 m per langkah seperti shoal() */
export const SHOAL_DT = 0.3;
/** Laju renang bawaan, m/s (shoal(): laju = 1) */
export const SHOAL_SPEED = 1;
/** Laju belok bawaan, rad/s: 0,15 rad per langkah 0,3 s pada shoal() */
export const SHOAL_TURN_RATE = 0.15 / 0.3;
/** Sudut buta di belakang, rad (shoal(): π/3, jadi α = 300°) */
export const SHOAL_BLIND_ANGLE = Math.PI / 3;
/** Kelipatan kegaduhan bagi ikan tanpa tetangga (shoal(): KELANA = 12) */
export const SHOAL_WANDER = 12;

export type ShoalRng = () => number;

/**
 * Pembangkit acak kongruen linear yang SAMA dengan shoal():
 * benih ← (benih·1664525 + 1013904223) mod 2³², keluaran benih/2³².
 * Hasil kali paling besar ≈ 7,1·10¹⁵ < 2⁵³, jadi tepat dalam double.
 */
export function createShoalRng(seed: number = SHOAL_SEED): ShoalRng {
  let benih = seed;
  return () => {
    benih = (benih * 1664525 + 1013904223) % 4294967296;
    return benih / 4294967296;
  };
}

export type ShoalState = {
  n: number;
  x: Float64Array;
  y: Float64Array;
  /** Arah renang, rad (tidak dibungkus ke ±π, sama dengan shoal()) */
  heading: Float64Array;
  /** Benar bila ekor ini melihat tetangga atau rintangan pada langkah terakhir */
  lastSeen: Uint8Array;
  /** Jari-jari luar zona tolak, sejajar, tarik (kumulatif), m */
  zoneRepulsion: number;
  zoneOrient: number;
  zoneAttract: number;
  /** Kegaduhan arah per langkah, rad */
  noise: number;
  speed: number;
  turnRate: number;
  blindAngle: number;
  /** Rintangan lingkaran: x, y, r berurutan; kapasitas tetap */
  obstacles: Float64Array;
  obstacleCount: number;
  obstacleCapacity: number;
  /** Jejak ekor: cincin per ekor, indeks i·trailLength + k */
  trailLength: number;
  trailX: Float64Array;
  trailY: Float64Array;
  /** Slot berikutnya yang akan ditulis, dan banyaknya slot terisi */
  trailHead: number;
  trailCount: number;
  /** Waktu berjalan, s, dan banyaknya langkah */
  t: number;
  steps: number;
  /* larik kerja */
  _hx: Float64Array;
  _hy: Float64Array;
  _next: Float64Array;
};

export type ShoalAgent = { x: number; y: number; vx: number; vy: number };

export type ShoalMetrics = {
  /** p_group (Couzin pers. 4), 0..1 */
  polarisation: number;
  /** m_group (Couzin pers. 5) dinormalkan r dan s, 0..1 */
  milling: number;
  /** Jarak rata-rata ke tetangga terdekat, m */
  nearestNeighbour: number;
  /** Jarak rata-rata ke c_group, m */
  spread: number;
  state: "berpencar" | "bergerombol" | "berputar" | "searah";
};

/** Bentuk keluaran shoal() di hydraulics.ts, ditulis ulang di sini */
export type ShoalResult = {
  agents: ShoalAgent[];
  trails: { x: number; y: number }[][];
} & ShoalMetrics;

/**
 * Lebar zona dari bobot penggeser EH-05, sama dengan shoal():
 * zona tolak 0,4 + 0,4·max(0, separation), lebar zona sejajar 5·alignment,
 * lebar zona tarik 14·cohesion (m).
 */
export function setShoalWeights(
  st: ShoalState,
  alignment: number,
  separation: number,
  cohesion: number,
  noise: number = st.noise
): void {
  const zonaJauh = 0.4 + 0.4 * Math.max(0, separation);
  const zonaSearah = alignment * 5;
  const zonaTarik = cohesion * 14;
  st.zoneRepulsion = zonaJauh;
  st.zoneOrient = zonaJauh + zonaSearah;
  st.zoneAttract = zonaJauh + zonaSearah + zonaTarik;
  st.noise = noise;
}

/**
 * Menyusun gerombolan. Posisi awal acak di kotak 20 × 20 m berpusat di asal
 * dan arah acak, dengan urutan pengambilan acak yang sama dengan shoal()
 * (arah, x, y untuk tiap ekor).
 */
export function createShoal(
  count: number,
  alignment: number,
  separation: number,
  cohesion: number,
  noise: number,
  rng: ShoalRng,
  opsi: {
    obstacleCapacity?: number;
    trailLength?: number;
    speed?: number;
    turnRate?: number;
  } = {}
): ShoalState {
  const n = Math.max(2, Math.round(count));
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const heading = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    x[i] = (rng() - 0.5) * 20;
    y[i] = (rng() - 0.5) * 20;
    heading[i] = a;
  }
  const cap = Math.max(0, Math.floor(opsi.obstacleCapacity ?? 16));
  const L = Math.max(0, Math.floor(opsi.trailLength ?? 0));
  const st: ShoalState = {
    n,
    x,
    y,
    heading,
    lastSeen: new Uint8Array(n),
    zoneRepulsion: 0,
    zoneOrient: 0,
    zoneAttract: 0,
    noise,
    speed: opsi.speed ?? SHOAL_SPEED,
    turnRate: opsi.turnRate ?? SHOAL_TURN_RATE,
    blindAngle: SHOAL_BLIND_ANGLE,
    obstacles: new Float64Array(3 * cap),
    obstacleCount: 0,
    obstacleCapacity: cap,
    trailLength: L,
    trailX: new Float64Array(n * L),
    trailY: new Float64Array(n * L),
    trailHead: 0,
    trailCount: 0,
    t: 0,
    steps: 0,
    _hx: new Float64Array(n),
    _hy: new Float64Array(n),
    _next: new Float64Array(n),
  };
  setShoalWeights(st, alignment, separation, cohesion, noise);
  return st;
}

/** Menambah rintangan lingkaran (m). Salah bila kapasitas penuh atau r ≤ 0. */
export function addObstacle(st: ShoalState, x: number, y: number, r: number): boolean {
  if (st.obstacleCount >= st.obstacleCapacity || !(r > 0)) return false;
  const k = 3 * st.obstacleCount;
  st.obstacles[k] = x;
  st.obstacles[k + 1] = y;
  st.obstacles[k + 2] = r;
  st.obstacleCount++;
  return true;
}

export function clearObstacles(st: ShoalState): void {
  st.obstacleCount = 0;
}

/** Hasil kemudi rintangan; ditulis ke objek tetap supaya tanpa alokasi */
const _hindar = { ada: false, dx: 0, dy: 0 };

/**
 * Reynolds (1999) obstacle avoidance untuk ekor di (xi, yi) berarah (hx, hy).
 * Mengisi _hindar.dx, dy dengan arah yang diinginkan bila ada ancaman.
 */
function hindarRintangan(st: ShoalState, xi: number, yi: number, hx: number, hy: number, dt: number) {
  _hindar.ada = false;
  if (st.obstacleCount === 0) return;
  const R = st.turnRate > 0 ? st.speed / st.turnRate : Infinity;
  const b = 0.5 * st.zoneRepulsion;
  let fTerdekat = Infinity;
  for (let k = 0; k < st.obstacleCount; k++) {
    const ox = st.obstacles[3 * k];
    const oy = st.obstacles[3 * k + 1];
    const r = st.obstacles[3 * k + 2];
    const px = ox - xi;
    const py = oy - yi;
    /* Sudah di dalam rintangan: lari menjauhi pusatnya (flee) */
    if (px * px + py * py < r * r) {
      _hindar.ada = true;
      _hindar.dx = -px;
      _hindar.dy = -py;
      return;
    }
    const maju = px * hx + py * hy;
    const lateral = -px * hy + py * hx; /* proyeksi ke kiri (−hy, hx) */
    const panjang = Number.isFinite(R)
      ? Math.sqrt((R + r + b) * (R + r + b) - R * R) + st.speed * dt
      : r + b + st.speed * dt;
    if (maju <= 0 || maju > panjang || Math.abs(lateral) >= r + b) continue;
    if (maju < fTerdekat) {
      fTerdekat = maju;
      /* negatif proyeksi lateral: belok ke sisi yang berlawanan */
      const tanda = lateral > 0 ? -1 : 1;
      _hindar.ada = true;
      _hindar.dx = tanda * -hy;
      _hindar.dy = tanda * hx;
    }
  }
}

/**
 * Satu langkah dt detik, di tempat. rng dipanggil tepat sekali per ekor per
 * langkah (urutan i = 0..n−1), sama dengan shoal().
 */
export function stepShoal(st: ShoalState, dt: number, rng: ShoalRng): void {
  const { n, x: px, y: py, heading: arah, _hx: hx, _hy: hy, _next: arahBaru } = st;
  const zona1 = st.zoneRepulsion;
  const zona2 = st.zoneOrient;
  const zona3k = st.zoneAttract * st.zoneAttract;
  const batasButa = -Math.cos(st.blindAngle / 2);
  const belokMaks = st.turnRate * dt;
  const langkahJarak = st.speed * dt;
  const noise = st.noise;

  for (let i = 0; i < n; i++) {
    hx[i] = Math.cos(arah[i]);
    hy[i] = Math.sin(arah[i]);
  }
  for (let i = 0; i < n; i++) {
    let jx = 0;
    let jy = 0;
    let nJauh = 0;
    let sx = 0;
    let sy = 0;
    let nSearah = 0;
    let tx = 0;
    let ty = 0;
    let nTarik = 0;
    const xi = px[i];
    const yi = py[i];
    const hxi = hx[i];
    const hyi = hy[i];

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dx = px[j] - xi;
      const dy = py[j] - yi;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1e-18 || d2 >= zona3k) continue;
      const d = Math.sqrt(d2);
      if (hxi * dx + hyi * dy < batasButa * d) continue;
      if (d < zona1) {
        jx -= dx / d;
        jy -= dy / d;
        nJauh++;
      } else if (d < zona2) {
        sx += hx[j];
        sy += hy[j];
        nSearah++;
      } else {
        tx += dx / d;
        ty += dy / d;
        nTarik++;
      }
    }

    let dx = hxi;
    let dy = hyi;
    if (nJauh > 0) {
      dx = jx;
      dy = jy;
    } else if (nSearah + nTarik > 0) {
      dx = 0;
      dy = 0;
      if (nSearah > 0) {
        dx += sx / nSearah;
        dy += sy / nSearah;
      }
      if (nTarik > 0) {
        dx += tx / nTarik;
        dy += ty / nTarik;
      }
    }

    hindarRintangan(st, xi, yi, hxi, hyi, dt);
    if (_hindar.ada) {
      dx = _hindar.dx;
      dy = _hindar.dy;
    }

    const sendirian = nJauh + nSearah + nTarik === 0 && !_hindar.ada;
    st.lastSeen[i] = sendirian ? 0 : 1;
    const ingin = Math.atan2(dy, dx) + (rng() - 0.5) * noise * (sendirian ? SHOAL_WANDER : 1);
    let belok = Math.atan2(Math.sin(ingin - arah[i]), Math.cos(ingin - arah[i]));
    if (!sendirian && Math.abs(belok) > belokMaks) belok = Math.sign(belok) * belokMaks;
    arahBaru[i] = arah[i] + belok;
  }
  for (let i = 0; i < n; i++) {
    arah[i] = arahBaru[i];
    px[i] += Math.cos(arah[i]) * langkahJarak;
    py[i] += Math.sin(arah[i]) * langkahJarak;
  }

  const L = st.trailLength;
  if (L > 0) {
    const k = st.trailHead;
    for (let i = 0; i < n; i++) {
      st.trailX[i * L + k] = px[i];
      st.trailY[i * L + k] = py[i];
    }
    st.trailHead = (k + 1) % L;
    if (st.trailCount < L) st.trailCount++;
  }
  st.t += dt;
  st.steps++;
}

/**
 * Ukuran keteraturan, dengan urutan hitung yang sama dengan shoal()
 * (supaya hasilnya identik bit demi bit). Mengalokasi; panggil per tampilan,
 * bukan per langkah bila tidak perlu.
 */
export function shoalMetrics(st: ShoalState): ShoalMetrics {
  return metrikAgen(agenDari(st), st.speed);
}

function agenDari(st: ShoalState): ShoalAgent[] {
  const agents: ShoalAgent[] = [];
  const laju = st.speed;
  for (let i = 0; i < st.n; i++)
    agents.push({
      x: st.x[i],
      y: st.y[i],
      vx: Math.cos(st.heading[i]) * laju,
      vy: Math.sin(st.heading[i]) * laju,
    });
  return agents;
}

function metrikAgen(agents: ShoalAgent[], laju = SHOAL_SPEED): ShoalMetrics {
  const n = agents.length;
  let jumlahX = 0;
  let jumlahY = 0;
  for (const a of agents) {
    jumlahX += a.vx;
    jumlahY += a.vy;
  }
  const polarisation = Math.hypot(jumlahX, jumlahY) / (n * laju);

  const mx = agents.reduce((s2, a) => s2 + a.x, 0) / n;
  const my = agents.reduce((s2, a) => s2 + a.y, 0) / n;
  let putar = 0;
  let spread = 0;
  for (const a of agents) {
    const rx = a.x - mx;
    const ry = a.y - my;
    const r = Math.hypot(rx, ry);
    spread += r;
    if (r > 1e-9) putar += (rx * a.vy - ry * a.vx) / (r * laju);
  }
  const milling = Math.abs(putar) / n;
  spread /= n;

  let nn = 0;
  for (let i = 0; i < n; i++) {
    let d = Infinity;
    for (let j = 0; j < n; j++)
      if (i !== j) d = Math.min(d, Math.hypot(agents[j].x - agents[i].x, agents[j].y - agents[i].y));
    nn += Number.isFinite(d) ? d : 0;
  }
  nn /= n;

  /* Ambang golongan sama dengan shoal() di hydraulics.ts */
  const state: ShoalMetrics["state"] =
    polarisation > 0.75
      ? "searah"
      : milling > 0.45
        ? "berputar"
        : spread < 9.6
          ? "bergerombol"
          : "berpencar";

  return { polarisation, milling, nearestNeighbour: nn, spread, state };
}

/**
 * Pengganti siap pakai untuk shoal() (M5): benih SHOAL_SEED, steps kali
 * stepShoal dengan dt SHOAL_DT, jejak lima ekor pertama pada 59 langkah
 * terakhir, lalu ukuran keteraturan. Keluarannya identik dengan shoal().
 */
export function simulateShoal(
  count: number,
  alignment: number,
  separation: number,
  cohesion: number,
  noise = 0.1,
  steps = 300
): ShoalResult {
  const rng = createShoalRng(SHOAL_SEED);
  const st = createShoal(count, alignment, separation, cohesion, noise, rng, { obstacleCapacity: 0 });
  const trails: { x: number; y: number }[][] = [[], [], [], [], []];
  for (let langkah = 0; langkah < steps; langkah++) {
    stepShoal(st, SHOAL_DT, rng);
    if (langkah > steps - 60)
      for (let k = 0; k < Math.min(5, st.n); k++) trails[k].push({ x: st.x[k], y: st.y[k] });
  }
  const agents = agenDari(st);
  return { agents, trails, ...metrikAgen(agents, st.speed) };
}
