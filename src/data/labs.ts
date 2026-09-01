export type LabStatus = "siap" | "rencana";

export type Lab = {
  sheet: string;
  slug: string;
  title: string;
  subject: string;
  question: string;
  status: LabStatus;
};

/**
 * Daftar lembar.
 *
 * Penomoran mengikuti kebiasaan berkas gambar: dua huruf pokok bahasan
 * diikuti nomor urut. Setiap lembar berdiri sendiri — bisa direvisi,
 * dicetak, dan dipakai tanpa menyentuh lembar lain.
 */
export const LABS: Lab[] = [
  {
    sheet: "HJ-01",
    slug: "loncatan-air",
    title: "Loncatan air",
    subject: "Saluran terbuka",
    question:
      "Berapa kedalaman hilir setelah aliran superkritis meredam energinya?",
    status: "siap",
  },
  {
    sheet: "MD-01",
    slug: "diagram-moody",
    title: "Diagram Moody",
    subject: "Aliran dalam pipa",
    question:
      "Bagaimana kekasaran dinding dan bilangan Reynolds bersama menentukan faktor gesekan?",
    status: "siap",
  },
  {
    sheet: "SE-01",
    slug: "energi-spesifik",
    title: "Energi spesifik",
    subject: "Saluran terbuka",
    question:
      "Di mana letak kedalaman kritis, dan kapan sebuah saluran disebut curam?",
    status: "siap",
  },
  {
    sheet: "OG-01",
    slug: "bendung-ogee",
    title: "Bendung ogee",
    subject: "Bangunan air",
    question: "Berapa kapasitas luapan pada berbagai tinggi energi di atas mercu?",
    status: "rencana",
  },
  {
    sheet: "SH-01",
    slug: "kurva-shields",
    title: "Kurva Shields",
    subject: "Transpor sedimen",
    question: "Pada tegangan geser berapa butiran dasar mulai bergerak?",
    status: "rencana",
  },
  {
    sheet: "CV-01",
    slug: "gorong-gorong",
    title: "Gorong-gorong",
    subject: "Bangunan air",
    question: "Kapan aliran dikendalikan sisi masuk, kapan oleh sisi keluar?",
    status: "rencana",
  },
  {
    sheet: "GW-01",
    slug: "rembesan",
    title: "Rembesan bendungan",
    subject: "Air tanah",
    question: "Bagaimana bentuk garis freatik di tubuh bendungan urugan?",
    status: "rencana",
  },
  {
    sheet: "FP-01",
    slug: "tangga-ikan",
    title: "Tangga ikan kolam",
    subject: "Ekohidraulika",
    question: "Berapa disipasi energi per kolam agar ikan mampu melewatinya?",
    status: "rencana",
  },
  {
    sheet: "GV-01",
    slug: "profil-gvf",
    title: "Profil aliran berubah lambat",
    subject: "Saluran terbuka",
    question: "Bagaimana bentuk M1, M2, S2 terbentuk di antara dua kendali?",
    status: "rencana",
  },
];

export const READY_LABS = LABS.filter((l) => l.status === "siap");

export function getLab(slug: string): Lab | undefined {
  return LABS.find((l) => l.slug === slug);
}
