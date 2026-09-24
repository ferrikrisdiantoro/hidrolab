import type { Metadata } from "next";
import { EnergiBertekananClient } from "./EnergiBertekananClient";

export const metadata: Metadata = {
  title: "Persamaan energi aliran bertekanan — HidroLab",
  description:
    "Garis tekanan dan garis energi di sepanjang pipa tekan berpompa, beserta batas hisap dan kavitasi di puncak lintasannya.",
};

export default function Page() {
  return <EnergiBertekananClient />;
}
