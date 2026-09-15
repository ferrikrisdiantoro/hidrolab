import type { Metadata } from "next";
import { KurvaShieldsClient } from "./KurvaShieldsClient";

export const metadata: Metadata = {
  title: "Kurva Shields — HidroLab",
  description:
    "Kurva Shields interaktif: ambang gerak butir dasar dari tegangan geser, ukuran butir, dan kekentalan air.",
};

export default function Page() {
  return <KurvaShieldsClient />;
}
