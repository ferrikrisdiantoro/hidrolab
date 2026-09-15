import type { Metadata } from "next";
import { PemompaanAirTanahClient } from "./PemompaanAirTanahClient";

export const metadata: Metadata = {
  title: "Pemompaan air tanah — HidroLab",
  description:
    "Kerucut penurunan di sekitar sumur pompa menurut rumus Thiem, untuk akuifer tertekan maupun bebas.",
};

export default function Page() {
  return <PemompaanAirTanahClient />;
}
