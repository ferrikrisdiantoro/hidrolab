import type { Metadata } from "next";
import { GorongGorongClient } from "./GorongGorongClient";

export const metadata: Metadata = {
  title: "Gorong-gorong — HidroLab",
  description:
    "Gorong-gorong bulat: kendali sisi masuk dibanding kendali sisi keluar, dan mengapa keduanya harus dikerjakan.",
};

export default function Page() {
  return <GorongGorongClient />;
}
