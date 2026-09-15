import type { Metadata } from "next";
import { HukumGesekanClient } from "./HukumGesekanClient";

export const metadata: Metadata = {
  title: "Hukum gesekan — HidroLab",
  description:
    "Chezy, Manning, dan Darcy-Weisbach sebagai tiga cara menyatakan satu gesekan yang sama, lengkap dengan akibat memilih salah satunya.",
};

export default function Page() {
  return <HukumGesekanClient />;
}
