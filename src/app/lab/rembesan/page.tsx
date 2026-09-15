import type { Metadata } from "next";
import { RembesanClient } from "./RembesanClient";

export const metadata: Metadata = {
  title: "Rembesan — HidroLab",
  description:
    "Garis freatik pada bendungan urugan menurut parabola Kozeny, beserta pengaruh drainase kaki dan tanah berlapis.",
};

export default function Page() {
  return <RembesanClient />;
}
