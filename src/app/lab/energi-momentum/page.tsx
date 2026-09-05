import type { Metadata } from "next";
import { EnergiMomentumClient } from "./EnergiMomentumClient";

export const metadata: Metadata = {
  title: "Energi dan Momentum — HidroLab",
  description:
    "Kurva energi spesifik dan kurva fungsi momentum pada satu sumbu kedalaman, memperlihatkan mengapa kedalaman konjugat harus dicari lewat momentum.",
};

export default function Page() {
  return <EnergiMomentumClient />;
}
