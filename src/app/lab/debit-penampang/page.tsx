import type { Metadata } from "next";
import { DebitPenampangClient } from "./DebitPenampangClient";

export const metadata: Metadata = {
  title: "Debit penampang saluran — HidroLab",
  description:
    "Debit aliran seragam interaktif dengan rumus Manning dan Chezy pada penampang lingkaran, persegi, dan penampang sungai alam.",
};

export default function Page() {
  return <DebitPenampangClient />;
}
