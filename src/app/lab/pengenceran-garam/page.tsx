import type { Metadata } from "next";
import { PengenceranGaramClient } from "./PengenceranGaramClient";

export const metadata: Metadata = {
  title: "Pengukuran Pengenceran Garam — HidroLab",
  description:
    "Pengukuran debit sungai berbatu dengan tracer garam menurut ISO 9555: luas kurva yang menyimpan debit, dan syarat pencampuran yang tidak terlihat pada hasil.",
};

export default function Page() {
  return <PengenceranGaramClient />;
}
