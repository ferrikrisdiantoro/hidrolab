import type { Metadata } from "next";
import { DrainaseUruganBatuClient } from "./DrainaseUruganBatuClient";

export const metadata: Metadata = {
  title: "Drainase bendungan urugan batu — HidroLab",
  description:
    "Aliran melalui urugan batu menurut persamaan Ergun, dan seberapa jauh hukum Darcy melebih-lebihkannya.",
};

export default function Page() {
  return <DrainaseUruganBatuClient />;
}
