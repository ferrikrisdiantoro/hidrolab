import type { Metadata } from "next";
import { StabilitasBendunganClient } from "./StabilitasBendunganClient";

export const metadata: Metadata = {
  title: "Stabilitas bendungan — HidroLab",
  description:
    "Keamanan bendungan beton gravitasi terhadap guling, geser, dan daya dukung, beserta peran tekanan angkat di bawah dasarnya.",
};

export default function Page() {
  return <StabilitasBendunganClient />;
}
