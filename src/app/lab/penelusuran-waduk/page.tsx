import type { Metadata } from "next";
import { PenelusuranWadukClient } from "./PenelusuranWadukClient";

export const metadata: Metadata = {
  title: "Penelusuran waduk — HidroLab",
  description:
    "Penelusuran banjir lewat waduk: peredaman puncak oleh tampungan, dengan puncak keluar tepat di perpotongan kedua kurva.",
};

export default function Page() {
  return <PenelusuranWadukClient />;
}
