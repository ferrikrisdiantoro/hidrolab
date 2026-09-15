import type { Metadata } from "next";
import { FilterBendunganClient } from "./FilterBendunganClient";

export const metadata: Metadata = {
  title: "Filter bendungan — HidroLab",
  description:
    "Gradasi filter terhadap tanah yang dilindunginya menurut kriteria Terzaghi, beserta lebar jendela yang tersedia.",
};

export default function Page() {
  return <FilterBendunganClient />;
}
