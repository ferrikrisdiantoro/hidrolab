import type { Metadata } from "next";
import { PintuSorongClient } from "./PintuSorongClient";

export const metadata: Metadata = {
  title: "Pintu sorong — HidroLab",
  description:
    "Pintu sorong interaktif: koefisien debit dari koefisien kontraksi, gaya pintu dari momentum, dan batas aliran tenggelam.",
};

export default function Page() {
  return <PintuSorongClient />;
}
