import type { Metadata } from "next";
import { GelombangLinearClient } from "./GelombangLinearClient";

export const metadata: Metadata = {
  title: "Gelombang linear — HidroLab",
  description:
    "Kecepatan rambat gelombang terhadap perioda dan kedalaman, beserta batas air dangkal dan air dalam.",
};

export default function Page() {
  return <GelombangLinearClient />;
}
