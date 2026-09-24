import type { Metadata } from "next";
import { AdveksiDifusiClient } from "./AdveksiDifusiClient";

export const metadata: Metadata = {
  title: "Adveksi dan difusi — HidroLab",
  description:
    "Awan zat terlarut yang terbawa arus sambil menyebar, waktu tempuh, dan waktu lewatnya.",
};

export default function Page() {
  return <AdveksiDifusiClient />;
}
