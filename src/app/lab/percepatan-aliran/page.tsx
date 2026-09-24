import type { Metadata } from "next";
import { PercepatanAliranClient } from "./PercepatanAliranClient";

export const metadata: Metadata = {
  title: "Percepatan aliran — HidroLab",
  description:
    "Percepatan lokal dan percepatan konvektif di sepanjang saluran mengerucut, dan mengapa aliran tunak tetap dipercepat.",
};

export default function Page() {
  return <PercepatanAliranClient />;
}
