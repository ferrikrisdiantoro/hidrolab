import type { Metadata } from "next";
import { PerkembanganMeanderClient } from "./PerkembanganMeanderClient";

export const metadata: Metadata = {
  title: "Perkembangan meander — HidroLab",
  description:
    "Lintasan sungai berkelok menurut lengkung bersudut sinus, laju pindah tebing, dan ambang pemotongan leher.",
};

export default function Page() {
  return <PerkembanganMeanderClient />;
}
