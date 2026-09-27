import type { Metadata } from "next";
import { LengkungDebitClient } from "./LengkungDebitClient";

export const metadata: Metadata = {
  title: "Lengkung debit — HidroLab",
  description:
    "Lengkung debit interaktif: pasangan tinggi muka air dan debit terukur dicocokkan dengan bentuk pangkat, pangkat bertinggi aliran nol, atau polinomial.",
};

export default function Page() {
  return <LengkungDebitClient />;
}
