import type { Metadata } from "next";
import { GayaBelokanClient } from "./GayaBelokanClient";

export const metadata: Metadata = {
  title: "Gaya pada belokan pipa — HidroLab",
  description:
    "Resultan gaya pada belokan pipa tekan dan ukuran blok angkur yang menahannya, yang ditentukan tekanan uji dan bukan debitnya.",
};

export default function Page() {
  return <GayaBelokanClient />;
}
