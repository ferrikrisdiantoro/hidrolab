import type { Metadata } from "next";
import { TanggaIkanKolamClient } from "./TanggaIkanKolamClient";

export const metadata: Metadata = {
  title: "Tangga ikan kolam — HidroLab",
  description:
    "Tangga ikan berkolam bercelah tegak: kecepatan celah dan lesapan daya kolam, dua syarat yang harus dipenuhi bersama.",
};

export default function Page() {
  return <TanggaIkanKolamClient />;
}
