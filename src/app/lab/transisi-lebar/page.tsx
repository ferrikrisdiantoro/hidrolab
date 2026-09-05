import type { Metadata } from "next";
import { TransisiLebarClient } from "./TransisiLebarClient";

export const metadata: Metadata = {
  title: "Transisi Lebar - HidroLab",
  description: "Pengaruh penyempitan saluran terhadap muka air, dan lebar tersempit sebelum aliran tersendat.",
};

export default function Page() {
  return <TransisiLebarClient />;
}
