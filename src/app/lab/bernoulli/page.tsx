import type { Metadata } from "next";
import { BernoulliClient } from "./BernoulliClient";

export const metadata: Metadata = {
  title: "Bernoulli — HidroLab",
  description:
    "Pertukaran tinggi elevasi, tinggi tekan, dan tinggi kecepatan di sepanjang saluran tertutup tanpa gesekan, beserta batas kavitasi di lehernya.",
};

export default function Page() {
  return <BernoulliClient />;
}
