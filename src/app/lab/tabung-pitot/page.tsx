import type { Metadata } from "next";
import { TabungPitotClient } from "./TabungPitotClient";

export const metadata: Metadata = {
  title: "Tabung Pitot — HidroLab",
  description:
    "Tabung Pitot statik di dalam pipa: dari satu bacaan tekanan menjadi debit, lewat profil hukum pangkat dan jari-jari acuan satu titik.",
};

export default function Page() {
  return <TabungPitotClient />;
}
