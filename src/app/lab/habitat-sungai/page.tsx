import type { Metadata } from "next";
import { HabitatSungaiClient } from "./HabitatSungaiClient";

export const metadata: Metadata = {
  title: "Habitat sungai — HidroLab",
  description:
    "Luas layak terbobot terhadap debit menurut IFIM, beserta debit yang memberi habitat terbesar.",
};

export default function Page() {
  return <HabitatSungaiClient />;
}
