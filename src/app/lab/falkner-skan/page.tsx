import type { Metadata } from "next";
import { FalknerSkanClient } from "./FalknerSkanClient";

export const metadata: Metadata = {
  title: "Silinder Falkner–Skan — HidroLab",
  description:
    "Profil kecepatan lapisan batas pada gradien tekanan yang berubah, dari Blasius sampai ambang terlepasnya.",
};

export default function Page() {
  return <FalknerSkanClient />;
}
