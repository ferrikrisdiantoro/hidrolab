import type { Metadata } from "next";
import { JembatanClient } from "./JembatanClient";

export const metadata: Metadata = {
  title: "Jembatan — HidroLab",
  description:
    "Pembendungan oleh pilar jembatan menurut Yarnell, beserta gerusan setempat di hidung pilar.",
};

export default function Page() {
  return <JembatanClient />;
}
