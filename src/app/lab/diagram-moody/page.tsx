import type { Metadata } from "next";
import { DiagramMoodyClient } from "./DiagramMoodyClient";

export const metadata: Metadata = {
  title: "Diagram Moody — HidroLab",
  description:
    "Diagram Moody interaktif: faktor gesekan dari persamaan Colebrook-White, lengkap dengan kehilangan tekan sepanjang pipa.",
};

export default function Page() {
  return <DiagramMoodyClient />;
}
