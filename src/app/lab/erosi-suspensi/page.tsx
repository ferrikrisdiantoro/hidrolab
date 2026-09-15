import type { Metadata } from "next";
import { ErosiSuspensiClient } from "./ErosiSuspensiClient";

export const metadata: Metadata = {
  title: "Erosi dan suspensi — HidroLab",
  description:
    "Diagram Hjulstrom interaktif: kapan butir mulai tererosi, kapan berhenti terangkut, dan kapan ia melayang.",
};

export default function Page() {
  return <ErosiSuspensiClient />;
}
