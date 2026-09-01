import type { Metadata } from "next";
import { EnergiSpesifikClient } from "./EnergiSpesifikClient";

export const metadata: Metadata = {
  title: "Energi Spesifik — HidroLab",
  description:
    "Kurva energi spesifik interaktif: kedalaman kritis, kedalaman normal Manning, dan klasifikasi kemiringan saluran.",
};

export default function Page() {
  return <EnergiSpesifikClient />;
}
