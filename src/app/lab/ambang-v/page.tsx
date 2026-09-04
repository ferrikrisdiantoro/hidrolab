import type { Metadata } from "next";
import { AmbangVClient } from "./AmbangVClient";

export const metadata: Metadata = {
  title: "Ambang Ukur V — HidroLab",
  description:
    "Ambang ukur V berdinding tipis: hubungan tinggi muka air dan debit menurut ISO 1438, lengkap dengan batas keberlakuannya.",
};

export default function Page() {
  return <AmbangVClient />;
}
