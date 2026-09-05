import type { Metadata } from "next";
import { VenturiClient } from "./VenturiClient";

export const metadata: Metadata = {
  title: "Venturi — HidroLab",
  description:
    "Tabung venturi klasik menurut ISO 5167-4: faktor kecepatan datang yang sering terlupa, dan kehilangan tekanan tetap yang kecil.",
};

export default function Page() {
  return <VenturiClient />;
}
