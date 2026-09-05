import type { Metadata } from "next";
import { PersamaanEnergiSaluranClient } from "./PersamaanEnergiSaluranClient";

export const metadata: Metadata = {
  title: "Persamaan Energi Saluran Terbuka — HidroLab",
  description:
    "Garis energi, garis muka air, dan tinggi kecepatan di sepanjang bentang saluran, dengan kehilangan gesekan dihitung dari integrasi kemiringan gesek.",
};

export default function Page() {
  return <PersamaanEnergiSaluranClient />;
}
