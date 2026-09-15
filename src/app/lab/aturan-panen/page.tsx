import type { Metadata } from "next";
import { AturanPanenClient } from "./AturanPanenClient";

export const metadata: Metadata = {
  title: "Aturan panen — HidroLab",
  description:
    "Model Schaefer: hasil lestari terhadap upaya penangkapan, dan mengapa satu angka tangkapan selalu punya dua penafsiran.",
};

export default function Page() {
  return <AturanPanenClient />;
}
