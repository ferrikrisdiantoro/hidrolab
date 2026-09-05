import type { Metadata } from "next";
import { TransisiKemiringanClient } from "./TransisiKemiringanClient";

export const metadata: Metadata = {
  title: "Transisi Kemiringan — HidroLab",
  description:
    "Patahan kemiringan dasar saluran: letak penampang kendali, profil M2 dan S2, serta letak loncatan air pada patahan curam ke landai.",
};

export default function Page() {
  return <TransisiKemiringanClient />;
}
