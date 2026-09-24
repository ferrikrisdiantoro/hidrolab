import type { Metadata } from "next";
import { PercobaanReynoldsClient } from "./PercobaanReynoldsClient";

export const metadata: Metadata = {
  title: "Percobaan Reynolds — HidroLab",
  description:
    "Peralihan laminar ke turbulen pada tabung kaca Reynolds, dan mengapa batas dua ribu adalah sifat gangguan dan bukan sifat air.",
};

export default function Page() {
  return <PercobaanReynoldsClient />;
}
