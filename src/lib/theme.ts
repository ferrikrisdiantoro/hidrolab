/**
 * Sistem visual: lembar gambar teknik.
 *
 * Tiga aturan yang mengikat seluruh berkas gambar:
 *
 *  1. KETEBALAN GARIS ADALAH HIERARKI, dan artinya terkunci.
 *     Kalau garis menggambarkan benda fisik  -> BOLD.
 *     Kalau garis membicarakan benda itu     -> THIN.
 *     Kalau garis hanya membantu mata        -> HAIR.
 *     Tidak ada ketebalan di luar tiga ini.
 *
 *  2. WARNA ADALAH KOSAKATA, BUKAN TEMA.
 *     Biru selalu air. Merah bata selalu energi. Ungu selalu kondisi kritis.
 *     Merah sinyal hanya berarti satu hal: di luar rentang validitas.
 *     Tidak ada warna dipakai sebagai hiasan, dan tidak ada warna di krom.
 *
 *  3. SETIAP TANDA MEMBAWA DATA. Kalau sebuah garis tidak menjelaskan
 *     apa pun, ia dihapus.
 */

export const C = {
  /* Kertas — kelabu dingin, bukan krem. Putih murni tidak pernah ada
     di lembar cetak dan membuat garis tipis menyilaukan. */
  paper: "#eceeec",
  paperSunk: "#e2e6e3",
  sheet: "#f7f8f7",
  sheetEdge: "#d5dad7",

  /* Tinta */
  ink: "#16191b",
  ink2: "#535d5b",
  ink3: "#8b9491",

  /* Garis bantu */
  rule: "#c8cecb",
  ruleFaint: "#dde1de",
  ruleStrong: "#aab2af",

  /* Kosakata terkunci */
  water: "#1f5f82",
  waterFill: "rgba(31, 95, 130, 0.10)",
  waterFillDeep: "rgba(31, 95, 130, 0.17)",
  energy: "#a6402b",
  critical: "#6e5595",
  signal: "#c0341f",

  /* Laju aliran di lapis gerak (OC-05 tampak atas): goresan partikel tetap
     keluarga biru air, makin pekat makin cepat. Satu tingkat = laju 20 %
     di atas tingkat sebelumnya, diukur terhadap kecepatan hulu V₁;
     tingkat tengah adalah `water` sendiri. Bukan hiasan: warna goresan
     dibaca sebagai V/V₁. */
  waterSlower: "#7aa3bb",
  waterSlow: "#4a7f9d",
  waterFast: "#164b69",
  waterFaster: "#0b3249",

  /* Material */
  concrete: "#3d4644",
  concreteFace: "#c3c9c6",

  /* Muka bidang pada gambar 3D, turunan concreteFace dan water. Satu arah
     cahaya tetap (dari kiri atas), jadi terang dan bayang hanya membedakan
     muka mana yang menghadap ke mana; bukan nilai dan bukan hiasan.
     faceLit = concreteFace dicampur 30 % ke sheet (muka atas, menghadap
     cahaya). faceShade = concreteFace dicampur 25 % ke concrete (muka
     samping yang membelakangi cahaya). waterFaceLit sama dengan waterFill
     (muka air dilihat dari atas); waterFaceShade untuk potongan badan air
     yang terlihat dari samping, lebih pekat supaya kedalaman terbaca. */
  faceLit: "#d3d7d5",
  faceShade: "#a2a8a6",
  waterFaceLit: "rgba(31, 95, 130, 0.10)",
  waterFaceShade: "rgba(31, 95, 130, 0.24)",

  /* Butir dan tanah: warna BENDA, untuk menggambar butir sedimen, batu, dan
     lapisan tanah (sketsa butir SD-01, SD-03, HS-08, DM-02). Sengaja kusam
     dan bersaturasi rendah supaya tidak terbaca sebagai kata penilaian:
     grainSand bukan caution (oker pekat), soil bukan energy (merah bata).
     Urutan terang ke gelap mengikuti ukuran butir: pasir paling terang,
     kerikil lebih gelap, batu paling gelap. Selalu dengan garis tepi tinta;
     warna isian saja tidak pernah menjadi satu-satunya pembeda. */
  /** Pasir (butir halus, kira-kira 0,06 sampai 2 mm) */
  grainSand: "#c4b896",
  /** Kerikil (kira-kira 2 sampai 64 mm) */
  grainGravel: "#8f8a7e",
  /** Batu, bongkah, dan batuan dasar */
  rock: "#6b675e",
  /** Tanah (lempung dan lanau, lapisan tanah di tepi dan dasar) */
  soil: "#7d6a52",

  /* Bentang dataran sungai (OC-11). floodplain adalah isian bidang daratan
     yang tergenang saat banjir: tanah, bukan air, jadi keluarga cokelat
     zaitun dan bukan biru. oldChannel adalah alur lama yang sudah
     ditinggalkan aliran: biru kelabu pucat (pernah air, kini tidak
     mengalir), selalu digambar dengan DASH.phantom karena ia keadaan
     sebelumnya. Jangan dipakai untuk alur yang masih berair. */
  floodplain: "rgba(122, 116, 84, 0.13)",
  oldChannel: "#8a9aa2",

  /* Kelas habitat ikan (EH-06), untuk latar zona pada peta habitat.
     Kelas "sesuai" TIDAK punya warna sendiri: artinya sama persis dengan
     pass (memenuhi syarat), jadi dipakai TONE.pass lewat HABITAT.suitable.
     Dua kelas tidak sesuai tidak memakai caution: caution berarti "masih
     berlaku tetapi waspadai", sedangkan terlalu dangkal dan terlalu deras
     adalah dua alasan berbeda yang harus bisa dibedakan satu sama lain.
     habitatShallow = cokelat khaki (dasar sungai tampak). habitatFast =
     biru batu tua kelabu, digeser ke nila supaya tidak terbaca sebagai
     water atau waterFast (yang berarti laju V/V₁), dan jauh dari critical.
     Bukan merah sinyal: tidak sesuai bagi ikan bukan di luar rentang rumus. */
  habitatShallow: "#8c7a55",
  habitatShallowFill: "rgba(140, 122, 85, 0.16)",
  habitatFast: "#4f5d75",
  habitatFastFill: "rgba(79, 93, 117, 0.16)",

  /* Kosakata penilaian — untuk pita rezim, badge, dan latar zona.
     Hijau kebiruan redup = memenuhi syarat (aman, lolos, dalam batas
     desain). Oker = masih berlaku tetapi perlu diwaspadai (mendekati
     batas, peralihan). Keduanya BUKAN air dan BUKAN energi: jangan
     dipakai untuk menggambar benda, hanya untuk menilai keadaan. */
  pass: "#3f7a5a",
  caution: "#a87a1e",

  /* Isian lembut: latar pita dan zona, selalu berpasangan dengan garis
     berwarna penuh dari kata yang sama. Isian tidak pernah berdiri
     sendiri sebagai penanda. signalFill hanya untuk zona di luar
     rentang berlaku, sama seperti signal. */
  passFill: "rgba(63, 122, 90, 0.12)",
  cautionFill: "rgba(168, 122, 30, 0.12)",
  criticalFill: "rgba(110, 85, 149, 0.12)",
  energyFill: "rgba(166, 64, 43, 0.12)",
  signalFill: "rgba(192, 52, 31, 0.12)",
  neutralFill: "rgba(83, 93, 91, 0.08)",
} as const;

/**
 * Nada sebuah keadaan, dipakai komponen penilai (StateCard, RegimeScale,
 * BigResult). Setiap nada memetakan ke satu kata dari kosakata di atas.
 * "invalid" adalah merah sinyal dan HANYA boleh berarti di luar rentang
 * berlaku; bukan untuk keadaan yang sekadar buruk atau kritis.
 */
export type Tone =
  | "neutral"
  | "water"
  | "critical"
  | "energy"
  | "pass"
  | "caution"
  | "invalid";

export const TONE: Record<Tone, { line: string; fill: string }> = {
  neutral: { line: C.ink2, fill: C.neutralFill },
  water: { line: C.water, fill: C.waterFill },
  critical: { line: C.critical, fill: C.criticalFill },
  energy: { line: C.energy, fill: C.energyFill },
  pass: { line: C.pass, fill: C.passFill },
  caution: { line: C.caution, fill: C.cautionFill },
  invalid: { line: C.signal, fill: C.signalFill },
};

/**
 * Kelas habitat ikan (EH-06) dalam bentuk garis dan isian seperti TONE.
 * `suitable` adalah TONE.pass itu sendiri, bukan salinan: kalau warna pass
 * berubah, kelas sesuai ikut berubah, karena artinya satu.
 */
export const HABITAT = {
  shallow: { line: C.habitatShallow, fill: C.habitatShallowFill },
  suitable: TONE.pass,
  fast: { line: C.habitatFast, fill: C.habitatFastFill },
} as const;

/** Tiga bobot garis. Tidak boleh ada nilai lain di seluruh aplikasi. */
export const W = {
  hair: 0.5,
  thin: 1,
  bold: 2,
} as const;

/**
 * Jenis garis, masing-masing dengan arti tetap.
 * Dipakai sebagai argumen setLineDash.
 */
export const DASH = {
  /** Terlihat, nyata */
  solid: [] as number[],
  /** Tersembunyi di balik sesuatu */
  hidden: [6, 4],
  /** Sumbu, datum, simetri */
  axis: [12, 3, 2, 3],
  /** Posisi alternatif — dipakai untuk kondisi sebelum perubahan */
  phantom: [16, 3, 2, 3, 2, 3],
  /** Di luar rentang validitas rumus */
  invalid: [1, 3],
} as const;

/* Huruf pada gambar mengikuti tradisi lettering drafting:
   sans, kapital, satu ketebalan, diberi jarak huruf. */
export const F = {
  label: '600 10px "Public Sans", system-ui, sans-serif',
  labelSm: '600 9px "Public Sans", system-ui, sans-serif',
  value: '500 11px "Public Sans", system-ui, sans-serif',
  region: '600 10px "Public Sans", system-ui, sans-serif',
  /** Nama besar di dalam gambar, misalnya nama profil muka air */
  heading: '700 15px "Public Sans", system-ui, sans-serif',
} as const;

/** Menulis teks kapital dengan jarak huruf, seperti stensil lettering. */
/*
 * Huruf stensil gambar teknik ditulis kapital, tetapi HANYA huruf Latin.
 * Huruf Yunani adalah simbol, dan kapitalnya simbol lain: β menjadi Β yang
 * terbaca B, ρ menjadi Ρ yang terbaca P (ρQV tertulis "PQV" di FF-03), ω
 * menjadi Ω. Simbol-simbol itu dibiarkan dalam bentuk aslinya.
 */
function kapitalLatin(teks: string) {
  return teks.replace(/[a-zà-ÿ]/g, (c) => c.toUpperCase());
}

export function stencil(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing = 0.8
) {
  const chars = kapitalLatin(text).split("");
  let cx = x;
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);

  if (ctx.textAlign === "center") cx = x - total / 2;
  else if (ctx.textAlign === "right") cx = x - total;

  const align = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + spacing;
  });
  ctx.textAlign = align;
  return total;
}

/** Mengukur lebar teks bergaya stensil tanpa menggambarnya. */
export function stencilWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  spacing = 0.8
) {
  const chars = kapitalLatin(text).split("");
  return (
    chars.reduce((a, c) => a + ctx.measureText(c).width, 0) +
    spacing * (chars.length - 1)
  );
}
