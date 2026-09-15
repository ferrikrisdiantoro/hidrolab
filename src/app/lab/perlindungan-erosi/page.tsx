import type { Metadata } from "next";
import { PerlindunganErosiClient } from "./PerlindunganErosiClient";

export const metadata: Metadata = {
  title: "Perlindungan erosi — HidroLab",
  description:
    "Ukuran batu pelindung terhadap kecepatan aliran menurut Isbash, beserta pengaruh cara pemasangannya.",
};

export default function Page() {
  return <PerlindunganErosiClient />;
}
