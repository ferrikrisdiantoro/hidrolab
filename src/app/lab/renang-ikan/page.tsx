import type { Metadata } from "next";
import { RenangIkanClient } from "./RenangIkanClient";

export const metadata: Metadata = {
  title: "Renang ikan — HidroLab",
  description:
    "Daya renang ikan: kecepatan jelajah, berkelanjutan, dan sentak, serta jarak terjauh yang menentukan panjang gorong-gorong.",
};

export default function Page() {
  return <RenangIkanClient />;
}
