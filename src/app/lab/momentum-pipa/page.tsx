import type { Metadata } from "next";
import { MomentumPipaClient } from "./MomentumPipaClient";

export const metadata: Metadata = {
  title: "Momentum dalam pipa — HidroLab",
  description:
    "Perubahan penampang mendadak pada pipa tekan: tekanannya naik sementara energinya hilang, dan kehilangan Borda-Carnot yang menjelaskan keduanya.",
};

export default function Page() {
  return <MomentumPipaClient />;
}
