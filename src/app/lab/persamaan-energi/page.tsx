import type { Metadata } from "next";
import { PersamaanEnergiClient } from "./PersamaanEnergiClient";

export const metadata: Metadata = {
  title: "Persamaan energi — HidroLab",
  description:
    "Ke mana tinggi energi pergi di sepanjang pipa penghubung: gesekan sebagai kemiringan tetap, kehilangan setempat sebagai anak tangga.",
};

export default function Page() {
  return <PersamaanEnergiClient />;
}
