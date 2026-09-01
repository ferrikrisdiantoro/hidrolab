import type { Metadata } from "next";
import { LoncatanAirClient } from "./LoncatanAirClient";

export const metadata: Metadata = {
  title: "Loncatan Air — HidroLab",
  description:
    "Simulator loncatan air: hitung kedalaman konjugat, energi teredam, dan panjang loncatan dari kondisi hulu.",
};

export default function Page() {
  return <LoncatanAirClient />;
}
