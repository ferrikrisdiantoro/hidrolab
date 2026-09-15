import type { Metadata } from "next";
import { ResponsAirTanahClient } from "./ResponsAirTanahClient";

export const metadata: Metadata = {
  title: "Respons air tanah — HidroLab",
  description:
    "Tanggapan muka air tanah terhadap imbuhan musiman dan pemompaan, sebagai satu tampungan lurus.",
};

export default function Page() {
  return <ResponsAirTanahClient />;
}
