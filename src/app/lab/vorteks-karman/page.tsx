import type { Metadata } from "next";
import { VorteksKarmanClient } from "./VorteksKarmanClient";

export const metadata: Metadata = {
  title: "Deret vorteks Kármán — HidroLab",
  description:
    "Pusaran yang terlepas bergantian di belakang silinder, bilangan Strouhal, dan terkuncinya kekerapan pada getar alami batangnya.",
};

export default function Page() {
  return <VorteksKarmanClient />;
}
