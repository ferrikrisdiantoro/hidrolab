import type { Bi, Lang } from "@/lib/i18n";

export type LabStatus = "siap" | "rencana";

/** Kode pokok bahasan, dipakai juga sebagai awalan nomor lembar. */
export type Subject =
  | "FF" | "FP" | "OC" | "HY" | "HS" | "PI" | "FM" | "EH" | "EK" | "SD" | "GW" | "DM" | "SY";

export const SUBJECTS: Record<Subject, Bi<string>> = {
  FF: { id: "Dasar mekanika fluida", en: "Fluid mechanics fundamentals" },
  FP: { id: "Fenomena aliran", en: "Flow phenomena" },
  OC: { id: "Saluran terbuka", en: "Open-channel flow" },
  HY: { id: "Hidrologi", en: "Hydrology" },
  HS: { id: "Bangunan air", en: "Hydraulic structures" },
  PI: { id: "Aliran dalam pipa", en: "Pipe flow" },
  FM: { id: "Pengukuran debit", en: "Flow measurement" },
  EH: { id: "Ekohidraulika", en: "Ecohydraulics" },
  EK: { id: "Ekologi", en: "Ecology" },
  SD: { id: "Transpor sedimen", en: "Sediment transport" },
  GW: { id: "Air tanah & rembesan", en: "Groundwater & seepage" },
  DM: { id: "Bendungan & geoteknik", en: "Dams & geotechnics" },
  SY: { id: "Sistem & dinamika", en: "Systems & dynamics" },
};

export type Lab = {
  sheet: string;
  slug: string;
  subject: Subject;
  title: Bi<string>;
  question: Bi<string>;
  status: LabStatus;
};

const L = (
  sheet: string,
  slug: string,
  subject: Subject,
  ti: string,
  te: string,
  qi: string,
  qe: string,
  status: LabStatus = "rencana"
): Lab => ({
  sheet,
  slug,
  subject,
  title: { id: ti, en: te },
  question: { id: qi, en: qe },
  status,
});

/**
 * Katalog lengkap: 69 laboratorium dalam 13 pokok bahasan.
 *
 * Penomoran mengikuti kebiasaan berkas gambar — dua huruf pokok bahasan
 * diikuti nomor urut. Setiap lembar berdiri sendiri dan bisa direvisi
 * tanpa menyentuh lembar lain.
 */
export const LABS: Lab[] = [
  /* ---------------- Saluran terbuka (12) ---------------- */
  L("OC-01", "loncatan-air", "OC", "Loncatan air", "Hydraulic jump",
    "Berapa kedalaman hilir setelah aliran superkritis meredam energinya?",
    "What is the downstream depth after supercritical flow dissipates its energy?", "siap"),
  L("OC-02", "energi-spesifik", "OC", "Energi spesifik", "Specific energy",
    "Di mana letak kedalaman kritis, dan kapan sebuah saluran disebut curam?",
    "Where does critical depth lie, and when is a channel called steep?", "siap"),
  L("OC-03", "profil-gvf", "OC", "Profil aliran berubah lambat", "Gradually varied flow profile",
    "Bagaimana bentuk M1, M2, dan S2 terbentuk di antara dua kendali?",
    "How do the M1, M2, and S2 profiles form between two controls?", "siap"),
  L("OC-04", "transisi-kritis", "OC", "Transisi kritis", "Critical transition",
    "Bagaimana aliran berpindah dari subkritis ke superkritis?",
    "How does flow pass from subcritical to supercritical?", "siap"),
  L("OC-05", "transisi-lebar", "OC", "Transisi lebar", "Width transition",
    "Apa yang terjadi pada muka air saat saluran menyempit?",
    "What happens to the water surface when the channel narrows?", "siap"),
  L("OC-06", "transisi-kemiringan", "OC", "Transisi kemiringan", "Slope transition",
    "Bagaimana muka air menyesuaikan saat kemiringan dasar berubah?",
    "How does the surface adjust when the bed slope changes?"),
  L("OC-07", "transisi-dasar", "OC", "Transisi elevasi dasar", "Bed-level transition",
    "Kapan ambang di dasar saluran memaksa aliran melewati kondisi kritis?",
    "When does a bed step force the flow through critical conditions?", "siap"),
  L("OC-08", "energi-momentum", "OC", "Energi dan momentum", "Energy and momentum",
    "Kapan kekekalan energi berlaku, dan kapan harus memakai momentum?",
    "When does energy conservation hold, and when must momentum be used?"),

  L("OC-09", "persamaan-energi-saluran", "OC", "Persamaan energi saluran terbuka", "Open-channel energy equation",
    "Bagaimana garis energi dan garis muka air tersusun di sepanjang saluran?",
    "How do the energy and water surface lines run along the channel?"),
  L("OC-10", "hukum-gesekan", "OC", "Hukum gesekan", "Friction laws",
    "Manning, Chezy, atau Darcy-Weisbach — mana yang dipakai pada kondisi apa?",
    "Manning, Chezy, or Darcy-Weisbach — which applies under what conditions?"),
  L("OC-11", "perkembangan-meander", "OC", "Perkembangan meander", "Meander development",
    "Bagaimana sungai yang lurus berubah menjadi berkelok?",
    "How does a straight river turn into a meandering one?"),
  L("OC-12", "aliran-masuk-lateral", "OC", "Aliran masuk lateral", "Lateral inflow",
    "Bagaimana muka air berubah bila air masuk di sepanjang saluran?",
    "How does the surface change when water enters along the channel?"),

  /* ---------------- Bangunan air (10) ---------------- */
  L("HS-01", "bendung-ogee", "HS", "Bendung ogee", "Ogee weir",
    "Berapa kapasitas luapan pada berbagai tinggi energi di atas mercu?",
    "What is the spillway capacity at various heads over the crest?"),
  L("HS-02", "bendung-labirin", "HS", "Bendung labirin", "Labyrinth weir",
    "Seberapa besar tambahan kapasitas dari memperpanjang mercu?",
    "How much extra capacity comes from lengthening the crest?"),
  L("HS-03", "pintu-sorong", "HS", "Pintu sorong", "Sluice gate",
    "Berapa debit yang lewat, dan kapan pintu menjadi tenggelam?",
    "What discharge passes, and when does the gate become submerged?"),
  L("HS-04", "gorong-gorong", "HS", "Gorong-gorong", "Culvert",
    "Kapan aliran dikendalikan sisi masuk, kapan oleh sisi keluar?",
    "When is flow inlet-controlled, and when outlet-controlled?"),
  L("HS-05", "jembatan", "HS", "Jembatan", "Bridge",
    "Berapa kenaikan muka air akibat penyempitan oleh pilar?",
    "How much backwater does pier contraction cause?"),
  L("HS-06", "tirai-luapan", "HS", "Tirai luapan bebas", "Free nappe",
    "Bagaimana bentuk pancaran yang jatuh bebas dari mercu?",
    "What shape does the jet take as it falls free of the crest?"),
  L("HS-07", "vena-contracta", "HS", "Vena contracta", "Vena contracta",
    "Seberapa jauh pancaran menyempit setelah melewati bukaan?",
    "How far does a jet contract after passing an opening?"),
  L("HS-08", "perlindungan-erosi", "HS", "Perlindungan erosi", "Erosion protection",
    "Berapa ukuran batu yang tahan terhadap kecepatan aliran ini?",
    "What stone size resists this flow velocity?"),
  L("HS-09", "pengaruh-hilir", "HS", "Pengaruh hilir", "Downstream effects",
    "Sejauh mana bangunan di hilir mempengaruhi muka air di hulu?",
    "How far upstream does a downstream structure affect the water surface?"),
  L("HS-10", "pelimpah-samping", "HS", "Pelimpah samping", "Side-channel spillway",
    "Bagaimana muka air terbentuk pada pelimpah yang mengalir menyamping?",
    "How does the water surface form along a spillway that flows sideways?"),

  /* ---------------- Dasar mekanika fluida (7) ---------------- */
  L("FF-01", "bernoulli", "FF", "Bernoulli", "Bernoulli",
    "Bagaimana tekanan, kecepatan, dan elevasi saling menukar peran?",
    "How do pressure, velocity, and elevation trade places?"),
  L("FF-02", "persamaan-energi", "FF", "Persamaan energi", "Energy equation",
    "Ke mana energi aliran pergi di sepanjang lintasannya?",
    "Where does the flow energy go along its path?"),
  L("FF-03", "prinsip-momentum", "FF", "Prinsip momentum", "Momentum principle",
    "Berapa gaya yang bekerja pada struktur akibat aliran?",
    "What force does the flow exert on a structure?"),
  L("FF-04", "asumsi-hidrostatis", "FF", "Asumsi hidrostatis", "Hydrostatic assumption",
    "Kapan sebaran tekanan berhenti bersifat hidrostatis?",
    "When does the pressure distribution stop being hydrostatic?"),
  L("FF-05", "garis-aliran", "FF", "Garis aliran", "Flow lines",
    "Apa beda garis arus, garis jejak, dan lintasan partikel?",
    "How do streamlines, streaklines, and pathlines differ?"),
  L("FF-06", "deformasi-fluida", "FF", "Deformasi fluida", "Fluid deformation",
    "Bagaimana elemen fluida meregang, memutar, dan berubah bentuk?",
    "How does a fluid element stretch, rotate, and deform?"),
  L("FF-07", "percepatan-aliran", "FF", "Percepatan aliran", "Flow acceleration",
    "Apa beda percepatan lokal dan percepatan konvektif?",
    "What separates local from convective acceleration?"),

  /* ---------------- Aliran dalam pipa (7) ---------------- */
  L("PI-01", "diagram-moody", "PI", "Diagram Moody", "Moody chart",
    "Bagaimana kekasaran dinding dan bilangan Reynolds bersama menentukan faktor gesekan?",
    "How do wall roughness and Reynolds number together set the friction factor?", "siap"),
  L("PI-02", "diagram-wallingford", "PI", "Diagram Wallingford", "Wallingford chart",
    "Bagaimana membaca debit pipa langsung dari kemiringan hidraulik?",
    "How is pipe discharge read directly from the hydraulic gradient?"),
  L("PI-03", "hukum-dinding", "PI", "Hukum dinding", "Law of the wall",
    "Bagaimana bentuk profil kecepatan dekat dinding pipa?",
    "What does the velocity profile look like near the pipe wall?"),
  L("PI-04", "percobaan-reynolds", "PI", "Percobaan Reynolds", "Reynolds experiment",
    "Pada kondisi apa aliran berubah dari laminar menjadi turbulen?",
    "At what condition does flow turn from laminar to turbulent?"),
  L("PI-05", "gaya-belokan", "PI", "Gaya pada belokan pipa", "Pipe bend force",
    "Berapa gaya yang harus ditahan angkur pada belokan pipa?",
    "What force must the anchor block at a pipe bend resist?"),
  L("PI-06", "momentum-pipa", "PI", "Momentum dalam pipa", "Pipe momentum",
    "Bagaimana perubahan penampang mengubah gaya di dalam pipa?",
    "How does a change in section alter the force inside the pipe?"),
  L("PI-07", "energi-bertekanan", "PI", "Persamaan energi aliran bertekanan", "Pressurized energy equation",
    "Bagaimana garis tekanan dan garis energi tersusun di sepanjang pipa?",
    "How do the hydraulic and energy grade lines run along the pipe?"),

  /* ---------------- Ekohidraulika (6) ---------------- */
  L("EH-01", "tangga-ikan-kolam", "EH", "Tangga ikan kolam", "Pool fishway",
    "Berapa disipasi energi per kolam agar ikan mampu melewatinya?",
    "What energy dissipation per pool still lets fish pass?"),
  L("EH-02", "tangga-ikan-denil", "EH", "Tangga ikan Denil", "Denil fishway",
    "Bagaimana sirip penahan memperlambat aliran tanpa menyumbatnya?",
    "How do baffles slow the flow without blocking it?"),
  L("EH-03", "lintasan-bertingkat", "EH", "Lintasan ikan bertingkat", "Cascade fish passage",
    "Bagaimana ikan melewati rangkaian bendung bertingkat?",
    "How do fish pass a series of stepped weirs?"),
  L("EH-04", "renang-ikan", "EH", "Renang ikan", "Fish locomotion",
    "Berapa lama ikan sanggup melawan kecepatan aliran tertentu?",
    "How long can a fish hold against a given flow velocity?"),
  L("EH-05", "gerombolan-ikan", "EH", "Gerombolan ikan", "Fish schooling",
    "Aturan sederhana apa yang memunculkan perilaku bergerombol?",
    "What simple rules give rise to schooling behaviour?"),
  L("EH-06", "habitat-sungai", "EH", "Habitat sungai", "River habitat",
    "Berapa luas habitat layak pada debit tertentu?",
    "How much suitable habitat exists at a given discharge?"),

  /* ---------------- Ekologi (4) ---------------- */
  L("EK-01", "tingkat-trofik", "EK", "Tingkat trofik", "Trophic levels",
    "Bagaimana energi berpindah antar tingkat dalam rantai makanan sungai?",
    "How does energy move between levels in a river food chain?"),
  L("EK-02", "aturan-panen", "EK", "Aturan panen", "Harvesting rule",
    "Berapa hasil tangkapan yang masih menyisakan populasi lestari?",
    "What harvest still leaves the population sustainable?"),
  L("EK-03", "tangkap-tandai-ulang", "EK", "Tangkap-tandai-tangkap ulang", "Mark-recapture",
    "Bagaimana ukuran populasi diperkirakan dari dua kali penangkapan?",
    "How is population size estimated from two capture events?"),
  L("EK-04", "lintasan-ikan-populasi", "EK", "Lintasan ikan dan populasi", "Fish passage & population",
    "Seberapa besar pengaruh keberhasilan lintasan ikan terhadap populasi jangka panjang?",
    "How much does fish passage success affect the long-term population?"),

  /* ---------------- Fenomena aliran (5) ---------------- */
  L("FP-01", "vorteks-karman", "FP", "Deret vorteks Kármán", "Kármán vortex street",
    "Mengapa pusaran terlepas bergantian di belakang silinder?",
    "Why do vortices shed alternately behind a cylinder?"),
  L("FP-02", "kinematika-vorteks", "FP", "Kinematika vorteks", "Vortex kinematics",
    "Bagaimana pusaran bergerak dan saling mempengaruhi?",
    "How do vortices move and influence one another?"),
  L("FP-03", "gelombang-linear", "FP", "Gelombang linear", "Linear wave",
    "Bagaimana kecepatan rambat gelombang bergantung pada kedalaman?",
    "How does wave celerity depend on water depth?"),
  L("FP-04", "adveksi-difusi", "FP", "Adveksi dan difusi", "Advection and diffusion",
    "Bagaimana sebaran zat terlarut menyebar sambil terbawa arus?",
    "How does a solute spread while being carried by the current?"),
  L("FP-05", "falkner-skan", "FP", "Silinder Falkner–Skan", "Falkner–Skan cylinder",
    "Bagaimana lapisan batas berkembang dan terlepas dari permukaan?",
    "How does the boundary layer grow and separate from a surface?"),

  /* ---------------- Transpor sedimen (4) ---------------- */
  L("SD-01", "kurva-shields", "SD", "Kurva Shields", "Shields curve",
    "Pada tegangan geser berapa butiran dasar mulai bergerak?",
    "At what shear stress do bed grains begin to move?"),
  L("SD-02", "profil-rouse", "SD", "Profil Rouse", "Rouse profile",
    "Bagaimana sebaran sedimen melayang berubah terhadap kedalaman?",
    "How does suspended sediment vary over the depth?"),
  L("SD-03", "erosi-suspensi", "SD", "Erosi dan suspensi", "Entrainment and suspension",
    "Kapan butiran terangkat dari dasar dan tetap melayang?",
    "When are grains lifted from the bed and kept in suspension?"),
  L("SD-04", "bak-sedimentasi", "SD", "Bak sedimentasi", "Settling basin",
    "Berapa panjang bak yang dibutuhkan agar butiran sempat mengendap?",
    "How long must a basin be for grains to settle out?"),

  /* ---------------- Pengukuran debit (5) ---------------- */
  L("FM-01", "ambang-v", "FM", "Ambang V", "V-notch weir",
    "Bagaimana tinggi muka air di atas ambang menentukan debit?",
    "How does the head over the notch determine discharge?", "siap"),
  L("FM-02", "venturi", "FM", "Venturi", "Venturi meter",
    "Bagaimana penyempitan penampang dipakai untuk mengukur debit?",
    "How is a contraction used to measure discharge?"),
  L("FM-03", "tabung-pitot", "FM", "Tabung Pitot", "Pitot tube",
    "Bagaimana selisih tekanan diubah menjadi kecepatan aliran?",
    "How is a pressure difference turned into flow velocity?"),
  L("FM-04", "flum-leher-panjang", "FM", "Flum berleher panjang", "Long-throated flume",
    "Bagaimana flum berleher panjang mengukur debit tanpa kalibrasi lapangan?",
    "How does a long-throated flume gauge discharge without field calibration?"),
  L("FM-05", "pengenceran-garam", "FM", "Pengukuran pengenceran garam", "Salt dilution gauging",
    "Bagaimana debit sungai berbatu diukur dari pengenceran larutan garam?",
    "How is discharge in a boulder stream measured from salt dilution?"),

  /* ---------------- Air tanah & rembesan (3) ---------------- */
  L("GW-01", "rembesan", "GW", "Rembesan", "Seepage",
    "Bagaimana bentuk garis freatik di tubuh bendungan urugan?",
    "What shape does the phreatic line take in an embankment dam?"),
  L("GW-02", "pemompaan-air-tanah", "GW", "Pemompaan air tanah", "Groundwater pumping",
    "Seberapa dalam kerucut penurunan akibat sumur pompa?",
    "How deep is the drawdown cone around a pumping well?"),
  L("GW-03", "respons-air-tanah", "GW", "Respons air tanah", "Groundwater response",
    "Bagaimana muka air tanah menanggapi hujan dan pemompaan?",
    "How does the water table respond to rainfall and pumping?"),

  /* ---------------- Bendungan & geoteknik (3) ---------------- */
  L("DM-01", "stabilitas-bendungan", "DM", "Stabilitas bendungan", "Dam stability",
    "Apakah bendungan aman terhadap guling, geser, dan daya dukung?",
    "Is the dam safe against overturning, sliding, and bearing failure?"),
  L("DM-02", "filter-bendungan", "DM", "Filter bendungan", "Dam filter",
    "Gradasi filter seperti apa yang mencegah butiran halus terbawa?",
    "What filter gradation stops fine particles from washing out?"),
  L("DM-03", "drainase-urugan-batu", "DM", "Drainase bendungan urugan batu", "Rockfill dam drainage",
    "Berapa kapasitas alir melalui tubuh bendungan urugan batu?",
    "What flow capacity passes through a rockfill dam body?"),

  /* ---------------- Hidrologi (2) ---------------- */
  L("HY-01", "penelusuran-waduk", "HY", "Penelusuran waduk", "Reservoir routing",
    "Seberapa besar waduk meredam puncak banjir yang masuk?",
    "How much does a reservoir attenuate the inflow flood peak?"),
  L("HY-02", "hidrograf-banjir", "HY", "Hidrograf banjir", "Flood hydrograph",
    "Bagaimana hujan di daerah aliran berubah menjadi debit sungai?",
    "How does catchment rainfall become river discharge?"),

  /* ---------------- Sistem & dinamika (1) ---------------- */
  L("SY-01", "regulasi-tidur", "SY", "Regulasi tidur", "Sleep regulation",
    "Bagaimana umpan balik dan tundaan membentuk irama sebuah sistem?",
    "How do feedback and delay shape the rhythm of a system?"),
];

export const READY_LABS = LABS.filter((l) => l.status === "siap");

export function getLab(slug: string): Lab | undefined {
  return LABS.find((l) => l.slug === slug);
}

export function subjectName(s: Subject, lang: Lang): string {
  return SUBJECTS[s][lang];
}
