import type { Metadata } from "next";
import { PengaruhHilirClient } from "./PengaruhHilirClient";

export const metadata: Metadata = {
  title: "Pengaruh Hilir — HidroLab",
  description:
    "Sejauh mana ke hulu sebuah bendung terasa, dihitung dari kurva pembendungan dengan ambang pengaruh yang dapat diatur.",
};

export default function Page() {
  return <PengaruhHilirClient />;
}
