import type { Metadata } from "next";
import { DiagramWallingfordClient } from "./DiagramWallingfordClient";

export const metadata: Metadata = {
  title: "Diagram Wallingford — HidroLab",
  description:
    "Bagan Wallingford interaktif: kecepatan pipa penuh langsung dari kemiringan hidrolik, tanpa iterasi.",
};

export default function Page() {
  return <DiagramWallingfordClient />;
}
