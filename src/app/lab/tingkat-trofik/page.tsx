import type { Metadata } from "next";
import { TingkatTrofikClient } from "./TingkatTrofikClient";

export const metadata: Metadata = {
  title: "Tingkat trofik — HidroLab",
  description:
    "Piramida energi rantai makanan sungai: berapa tingkat yang dapat ditopang oleh produksi dasar tertentu.",
};

export default function Page() {
  return <TingkatTrofikClient />;
}
