import type { Metadata } from "next";
import { TekananHidrostatisClient } from "./TekananHidrostatisClient";

export const metadata: Metadata = {
  title: "Tekanan hidrostatis — HidroLab",
  description:
    "Tekanan zat cair diam p = ρgh dibaca dengan probe yang bisa diseret, lalu dijumlahkan menjadi gaya resultan dan pusat tekanan pada pintu tegak atau miring.",
};

export default function Page() {
  return <TekananHidrostatisClient />;
}
