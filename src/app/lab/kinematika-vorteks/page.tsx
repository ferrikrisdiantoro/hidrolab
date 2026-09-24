import type { Metadata } from "next";
import { KinematikaVorteksClient } from "./KinematikaVorteksClient";

export const metadata: Metadata = {
  title: "Kinematika vorteks — HidroLab",
  description:
    "Lintasan sepasang pusaran titik: yang berlawanan arah berpindah lurus, yang searah saling mengelilingi.",
};

export default function Page() {
  return <KinematikaVorteksClient />;
}
