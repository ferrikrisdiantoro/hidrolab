import type { Metadata } from "next";
import { GerombolanIkanClient } from "./GerombolanIkanClient";

export const metadata: Metadata = {
  title: "Gerombolan ikan — HidroLab",
  description:
    "Tiga aturan tetangga terdekat yang memunculkan perilaku bergerombol, berputar, dan bergerak searah.",
};

export default function Page() {
  return <GerombolanIkanClient />;
}
