import type { Metadata } from "next";
import { LintasanIkanPopulasiClient } from "./LintasanIkanPopulasiClient";

export const metadata: Metadata = {
  title: "Lintasan ikan dan populasi — HidroLab",
  description:
    "Pengaruh keberhasilan lintasan ikan terhadap populasi jangka panjang, dan ambang yang memisahkan lestari dari punah.",
};

export default function Page() {
  return <LintasanIkanPopulasiClient />;
}
