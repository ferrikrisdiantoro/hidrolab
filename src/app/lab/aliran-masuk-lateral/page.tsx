import type { Metadata } from "next";
import { AliranMasukLateralClient } from "./AliranMasukLateralClient";

export const metadata: Metadata = {
  title: "Aliran Masuk Lateral — HidroLab",
  description:
    "Aliran berubah beraturan dengan debit bertambah sepanjang saluran, dibandingkan langsung dengan profil tanpa aliran masuk.",
};

export default function Page() {
  return <AliranMasukLateralClient />;
}
