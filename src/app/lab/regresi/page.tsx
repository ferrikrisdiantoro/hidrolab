import type { Metadata } from "next";
import { RegresiClient } from "./RegresiClient";

export const metadata: Metadata = {
  title: "Regresi — HidroLab",
  description:
    "Regresi interaktif enam bentuk garis tren Excel: linear, polinomial, eksponensial, pangkat, logaritmik, dan rata-rata bergerak, dengan ekspor grafik dan data.",
};

export default function Page() {
  return <RegresiClient />;
}
