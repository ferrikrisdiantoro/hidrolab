import type { Metadata } from "next";
import { ProfilRouseClient } from "./ProfilRouseClient";

export const metadata: Metadata = {
  title: "Profil Rouse — HidroLab",
  description:
    "Profil Rouse interaktif: sebaran sedimen melayang sepanjang kedalaman, ditentukan oleh satu bilangan tak bersatuan.",
};

export default function Page() {
  return <ProfilRouseClient />;
}
