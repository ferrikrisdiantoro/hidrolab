import type { Metadata } from "next";
import { RegulasiTidurClient } from "./RegulasiTidurClient";

export const metadata: Metadata = {
  title: "Regulasi tidur — HidroLab",
  description:
    "Model dua proses Borbely: bagaimana satu keadaan yang menyimpan dan satu irama yang tidak menyimpan membentuk daur sebuah sistem.",
};

export default function Page() {
  return <RegulasiTidurClient />;
}
