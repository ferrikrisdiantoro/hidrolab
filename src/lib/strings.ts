import type { Lang } from "./i18n";

/**
 * Teks antarmuka bersama.
 *
 * Prosa khusus tiap laboratorium tidak ditaruh di sini melainkan di
 * berkas laboratoriumnya masing-masing, supaya kalimat penjelas tetap
 * berdampingan dengan perhitungan yang dijelaskannya.
 */
export const S = {
  id: {
    /* kepala dan kaki halaman */
    tagline: "laboratorium hidraulika interaktif",
    headerMeta: "berkas gambar · satuan SI · purwarupa",
    langLabel: "bahasa",
    footer1:
      "HidroLab adalah purwarupa. Seluruh perhitungan berjalan di peramban dan tidak ada data yang dikirim keluar. Model diturunkan dari persamaan baku teknik hidro.",
    footer2:
      "Hasil pada lembar-lembar ini ditujukan untuk membangun pemahaman, bukan menggantikan perhitungan desain yang terjamin mutunya. Setiap keluaran harus diperiksa secara independen sebelum dipakai untuk desain, penilaian keselamatan, atau pengajuan ke regulator.",
    skip: "Lompat ke konten",

    /* beranda */
    homeTitle: "Berkas lembar gambar yang bisa dihitung ulang.",
    homeLead:
      "Setiap lembar di sini adalah gambar teknik yang hidup. Geser satu masukan, dan seluruh isinya dihitung ulang: profil muka air, garis energi, dimensi, sampai kop di bawah gambar. Tidak ada tabel jadi yang disalin, tidak ada gambar yang ditempel.",
    sheetIndex: "daftar lembar",
    colSheet: "Lembar",
    colTitle: "Judul",
    colSubject: "Pokok bahasan",
    colQuestion: "Pertanyaan yang dijawab",
    colStatus: "Status",
    statusReady: "terbit",
    statusPlanned: "rencana",
    indexNote:
      "Lembar bertanda terbit sudah berjalan penuh. Sisanya memperlihatkan bagaimana berkas ini tumbuh: menambah satu lembar berarti menambah satu model perhitungan dan satu penggambar, sementara kerangka, kop, dan tata letaknya sudah dipakai bersama.",
    methodHeading: "cara lembar ini dibuat",
    method1:
      "Angka-angkanya diselesaikan sendiri, bukan diambil dari tabel. Kedalaman konjugat memakai persamaan Belanger; faktor gesekan memakai Colebrook-White yang implisit, diselesaikan dengan iterasi Newton-Raphson; kedalaman normal memakai Manning yang dibalik dengan metode bagi dua.",
    method2:
      "Gambarnya digambar garis demi garis, tanpa pustaka grafik siap pakai. Itu sebabnya penampang, kurva log-log, dan arsiran air bisa mengikuti konvensi gambar teknik alih-alih mengikuti bentuk bawaan sebuah pustaka.",
    rulesHeading: "aturan yang dipegang",
    ruleBold: "Garis tebal",
    ruleBoldV: "Geometri nyata: dasar, dinding, muka air",
    ruleThin: "Garis tipis",
    ruleThinV: "Yang membicarakan benda: dimensi, penunjuk, arsiran",
    ruleDash: "Garis putus",
    ruleDashV: "Garis energi, dan hal yang tak terlihat langsung",
    ruleDot: "Titik rapat",
    ruleDotV: "Di luar jangkauan rumus — gambar mengaku tidak tahu",
    ruleBlue: "Biru",
    ruleBlueV: "Selalu air. Tidak pernah dipakai untuk hal lain",
    ruleRed: "Merah bata",
    ruleRedV: "Selalu energi",
    rulePurple: "Ungu",
    rulePurpleV: "Selalu kondisi kritis",

    /* kerangka lembar */
    backToIndex: "← daftar lembar",
    sheetWord: "lembar",
    blkInput: "masukan",
    blkResult: "hasil",
    blkCondition: "kondisi",
    blkNotice: "yang perlu diperhatikan",
    blkBasis: "dasar perhitungan",
    blkRefs: "rujukan",
    presetExample: "kondisi contoh",
    presetView: "tampilan",

    /* kop gambar */
    tbSimulation: "simulasi",
    tbSheet: "lembar",
    tbRev: "rev",
    tbScale: "skala",
    tbUnit: "satuan",
    tbRegime: "regime",
    tbAxis: "sumbu",
    tbSlope: "kemiringan",

    /* tabel */
    thSym: "Sim",
    thQuantity: "Besaran",
    thValue: "Nilai",
    thComputed: "Besaran terhitung",
  },

  en: {
    tagline: "interactive hydraulics laboratory",
    headerMeta: "drawing set · SI units · prototype",
    langLabel: "language",
    footer1:
      "HidroLab is a prototype. Every calculation runs in your browser and no data leaves your device. The models are derived from standard hydraulic engineering equations.",
    footer2:
      "Results on these sheets are meant for building understanding, not for replacing quality-assured design calculations. Every output must be checked independently before it is used for design, safety assessment, or regulatory submission.",
    skip: "Skip to content",

    homeTitle: "A drawing set that recalculates itself.",
    homeLead:
      "Every sheet here is a living engineering drawing. Move one input and the whole thing is recomputed: water surface profile, energy line, dimensions, right down to the title block beneath the drawing. No pasted tables, no static images.",
    sheetIndex: "sheet index",
    colSheet: "Sheet",
    colTitle: "Title",
    colSubject: "Subject",
    colQuestion: "Question it answers",
    colStatus: "Status",
    statusReady: "issued",
    statusPlanned: "planned",
    indexNote:
      "Sheets marked issued are fully working. The rest show how this set grows: adding a sheet means adding one calculation model and one renderer, while the framework, title block, and layout are already shared.",
    methodHeading: "how these sheets are made",
    method1:
      "The numbers are solved here, not looked up. Conjugate depth uses the Bélanger equation; the friction factor uses the implicit Colebrook-White equation solved by Newton-Raphson iteration; normal depth inverts Manning's equation using bisection.",
    method2:
      "The drawings are drawn line by line, with no charting library. That is why the cross sections, log-log curves, and water hatching can follow engineering drawing conventions instead of a library's built-in shapes.",
    rulesHeading: "rules held throughout",
    ruleBold: "Thick line",
    ruleBoldV: "Real geometry: bed, walls, water surface",
    ruleThin: "Thin line",
    ruleThinV: "What talks about the object: dimensions, leaders, hatching",
    ruleDash: "Dashed line",
    ruleDashV: "Energy line, and anything not directly visible",
    ruleDot: "Fine dots",
    ruleDotV: "Beyond the reach of the equation — the drawing admits it",
    ruleBlue: "Blue",
    ruleBlueV: "Always water. Never used for anything else",
    ruleRed: "Brick red",
    ruleRedV: "Always energy",
    rulePurple: "Violet",
    rulePurpleV: "Always the critical condition",

    backToIndex: "← sheet index",
    sheetWord: "sheet",
    blkInput: "input",
    blkResult: "results",
    blkCondition: "condition",
    blkNotice: "what to notice",
    blkBasis: "basis of calculation",
    blkRefs: "references",
    presetExample: "example conditions",
    presetView: "display",

    tbSimulation: "simulation",
    tbSheet: "sheet",
    tbRev: "rev",
    tbScale: "scale",
    tbUnit: "units",
    tbRegime: "regime",
    tbAxis: "axes",
    tbSlope: "slope",

    thSym: "Sym",
    thQuantity: "Quantity",
    thValue: "Value",
    thComputed: "Computed quantity",
  },
} as const;

export type Strings = (typeof S)["id"];

export function str(lang: Lang): Strings {
  return S[lang] as Strings;
}

/* ------------------------------------------------------------------ *
 * Label di dalam gambar
 *
 * Dipisahkan dari teks antarmuka karena dipakai oleh fungsi penggambar,
 * yang berjalan di luar React dan hanya menerima kode bahasa.
 * ------------------------------------------------------------------ */

export const CANVAS = {
  id: {
    axDistance: "jarak sepanjang saluran, m",
    axDepth: "kedalaman, m",
    axEnergy: "energi spesifik E, m",
    axDepthShort: "kedalaman y, m",
    axReynolds: "bilangan reynolds, Re",
    axFriction: "faktor gesekan darcy, f",
    axRoughness: "kekasaran relatif, ε/D",
    axHead: "tinggi energi H, m",
    axDischarge: "debit Q, m³/s",
    energyLine: "garis energi",
    supercritical: "superkritis",
    subcritical: "subkritis",
    jump: "loncatan",
    noJump: "tidak terbentuk loncatan",
    laminar: "laminar",
    criticalZone: "zona kritis",
    fullyRough: "turbulen penuh",
    smoothPipe: "pipa licin",
    branchSub: "cabang subkritis",
    branchSuper: "cabang superkritis",
    critical: "kritis",
    normal: "normal",
    section: "penampang melintang",
    minEnergy: "E min",
    ratingCurve: "kurva debit",
    notch: "ambang",
    profile: "profil muka air",
    control: "penampang kendali",
    belowRange: "di luar rentang",
    elevation: "elevasi, m",
    upstream: "hulu",
    downstream: "hilir",
    choked: "tersendat",
    planView: "tampak atas",
    slopeBreak: "patahan kemiringan",
    reachUp: "ruas hulu",
    reachDown: "ruas hilir",
    uniform: "seragam",
    energyGrade: "garis energi",
    waterGrade: "garis muka air",
    velocityHead: "tinggi kecepatan",
    datum: "datum",
    lateralInflow: "aliran masuk lateral",
    noInflow: "tanpa aliran masuk",
    collector: "saluran pengumpul",
    influenceEnd: "pengaruh tinggal 1%",
    structure: "bangunan",
    tailwater: "muka air hilir",
    drowned: "loncatan tenggelam",
    crest: "mercu",
  },
  en: {
    axDistance: "distance along channel, m",
    axDepth: "depth, m",
    axEnergy: "specific energy E, m",
    axDepthShort: "depth y, m",
    axReynolds: "reynolds number, Re",
    axFriction: "darcy friction factor, f",
    axRoughness: "relative roughness, ε/D",
    axHead: "head H, m",
    axDischarge: "discharge Q, m³/s",
    energyLine: "energy line",
    supercritical: "supercritical",
    subcritical: "subcritical",
    jump: "jump",
    noJump: "no jump forms",
    laminar: "laminar",
    criticalZone: "critical zone",
    fullyRough: "fully rough",
    smoothPipe: "smooth pipe",
    branchSub: "subcritical branch",
    branchSuper: "supercritical branch",
    critical: "critical",
    normal: "normal",
    section: "cross section",
    minEnergy: "E min",
    ratingCurve: "rating curve",
    notch: "notch",
    profile: "water surface profile",
    control: "control section",
    belowRange: "below valid range",
    elevation: "elevation, m",
    upstream: "upstream",
    downstream: "downstream",
    choked: "choked",
    planView: "plan view",
    slopeBreak: "slope break",
    reachUp: "upstream reach",
    reachDown: "downstream reach",
    uniform: "uniform",
    energyGrade: "energy grade line",
    waterGrade: "water surface line",
    velocityHead: "velocity head",
    datum: "datum",
    lateralInflow: "lateral inflow",
    noInflow: "without lateral inflow",
    collector: "collector channel",
    influenceEnd: "influence down to 1%",
    structure: "structure",
    tailwater: "tailwater",
    drowned: "jump drowned",
    crest: "crest",
  },
} as const;

export type CanvasLabels = (typeof CANVAS)["id"];

export function cl(lang: Lang): CanvasLabels {
  return CANVAS[lang] as CanvasLabels;
}
