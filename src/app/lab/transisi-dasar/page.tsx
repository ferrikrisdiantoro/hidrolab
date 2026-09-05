import type { Metadata } from "next";
import { TransisiDasarClient } from "./TransisiDasarClient";

export const metadata: Metadata = {
  title: "Transisi Elevasi Dasar - HidroLab",
  description: "Pengaruh ambang di dasar saluran terhadap muka air, dan kapan aliran menjadi tersendat.",
};

export default function Page() {
  return <TransisiDasarClient />;
}
