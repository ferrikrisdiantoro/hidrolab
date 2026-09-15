import type { Metadata } from "next";
import { BendungOgeeClient } from "./BendungOgeeClient";

export const metadata: Metadata = {
  title: "Bendung ogee — HidroLab",
  description:
    "Bendung ogee interaktif: bentuk mercu WES, kapasitas luapan, dan tekanan mercu yang menjadi sebab kavitasi.",
};

export default function Page() {
  return <BendungOgeeClient />;
}
