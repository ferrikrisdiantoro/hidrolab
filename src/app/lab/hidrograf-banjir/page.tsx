import type { Metadata } from "next";
import { HidrografBanjirClient } from "./HidrografBanjirClient";

export const metadata: Metadata = {
  title: "Hidrograf banjir — HidroLab",
  description:
    "Hidrograf banjir SCS interaktif: hujan daerah aliran menjadi debit sungai lewat bilangan kurva dan hidrograf satuan.",
};

export default function Page() {
  return <HidrografBanjirClient />;
}
