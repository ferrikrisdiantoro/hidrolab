import type { Metadata } from "next";
import { VenaContractaClient } from "./VenaContractaClient";

export const metadata: Metadata = {
  title: "Vena Contracta — HidroLab",
  description:
    "Penyempitan pancaran di hilir lubang berbibir tajam: koefisien kontraksi, koefisien kecepatan, dan cara memisahkan keduanya dengan meteran.",
};

export default function Page() {
  return <VenaContractaClient />;
}
