import type { Metadata } from "next";
import { HukumDindingClient } from "./HukumDindingClient";

export const metadata: Metadata = {
  title: "Hukum dinding — HidroLab",
  description:
    "Hukum dinding interaktif: lapisan kental, lapisan logaritmik, dan daerah penyangga yang tidak dijelaskan oleh keduanya.",
};

export default function Page() {
  return <HukumDindingClient />;
}
