import type { Metadata } from "next";
import { TanggaIkanDenilClient } from "./TanggaIkanDenilClient";

export const metadata: Metadata = {
  title: "Tangga ikan Denil — HidroLab",
  description:
    "Tangga ikan Denil: sirip penahan yang membalikkan sebagian aliran, dan harga keteradukan yang dibayar untuk lintasan pendek.",
};

export default function Page() {
  return <TanggaIkanDenilClient />;
}
