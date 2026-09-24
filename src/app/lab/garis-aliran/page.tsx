import type { Metadata } from "next";
import { GarisAliranClient } from "./GarisAliranClient";

export const metadata: Metadata = {
  title: "Garis aliran — HidroLab",
  description:
    "Beda garis arus, garis jejak, dan lintasan partikel pada medan kecepatan yang berayun terhadap waktu.",
};

export default function Page() {
  return <GarisAliranClient />;
}
