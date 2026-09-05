import type { Metadata } from "next";
import { PelimpahSampingClient } from "./PelimpahSampingClient";

export const metadata: Metadata = {
  title: "Pelimpah Samping — HidroLab",
  description:
    "Muka air di saluran pengumpul pelimpah samping dengan metode beda hingga Hinds, lengkap dengan pemeriksaan jagaan terhadap mercu.",
};

export default function Page() {
  return <PelimpahSampingClient />;
}
