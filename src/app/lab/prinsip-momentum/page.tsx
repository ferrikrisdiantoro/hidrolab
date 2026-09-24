import type { Metadata } from "next";
import { PrinsipMomentumClient } from "./PrinsipMomentumClient";

export const metadata: Metadata = {
  title: "Prinsip momentum — HidroLab",
  description:
    "Gaya pada belokan pipa dari kekekalan momentum, dengan volume kendali yang tidak pernah menanyakan apa yang terjadi di dalamnya.",
};

export default function Page() {
  return <PrinsipMomentumClient />;
}
