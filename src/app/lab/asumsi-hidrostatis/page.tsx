import type { Metadata } from "next";
import { AsumsiHidrostatisClient } from "./AsumsiHidrostatisClient";

export const metadata: Metadata = {
  title: "Asumsi hidrostatis — HidroLab",
  description:
    "Kapan sebaran tekanan berhenti hidrostatis, ditentukan satu bilangan kelengkungan V kuadrat dibagi gR.",
};

export default function Page() {
  return <AsumsiHidrostatisClient />;
}
