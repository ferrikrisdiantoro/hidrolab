import type { Metadata } from "next";
import { TransisiKritisClient } from "./TransisiKritisClient";

export const metadata: Metadata = {
  title: "Transisi Kritis - HidroLab",
  description: "Batas antara aliran yang masih lewat dan aliran yang tersendat, dengan lebar dan elevasi dasar keduanya dapat diubah.",
};

export default function Page() {
  return <TransisiKritisClient />;
}
