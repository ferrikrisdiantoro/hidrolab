import type { Metadata } from "next";
import { BakSedimentasiClient } from "./BakSedimentasiClient";

export const metadata: Metadata = {
  title: "Bak sedimentasi — HidroLab",
  description:
    "Bak sedimentasi interaktif: efisiensi ditentukan luas permukaan, bukan kedalaman, dan itu dapat dibuktikan di layar.",
};

export default function Page() {
  return <BakSedimentasiClient />;
}
