import type { Metadata } from "next";
import { LintasanBertingkatClient } from "./LintasanBertingkatClient";

export const metadata: Metadata = {
  title: "Lintasan ikan bertingkat — HidroLab",
  description:
    "Rangkaian bendung bertingkat: tinggi undakan, kedalaman kolam yang disyaratkan, dan kecepatan lompat yang dituntut.",
};

export default function Page() {
  return <LintasanBertingkatClient />;
}
