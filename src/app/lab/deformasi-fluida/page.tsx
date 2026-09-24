import type { Metadata } from "next";
import { DeformasiFluidaClient } from "./DeformasiFluidaClient";

export const metadata: Metadata = {
  title: "Deformasi fluida — HidroLab",
  description:
    "Gerak satu elemen fluida diurai menjadi putaran, pemuaian, dan perubahan bentuk, beserta syarat tak mampatnya.",
};

export default function Page() {
  return <DeformasiFluidaClient />;
}
