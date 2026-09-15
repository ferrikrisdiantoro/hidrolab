import type { Metadata } from "next";
import { BendungLabirinClient } from "./BendungLabirinClient";

export const metadata: Metadata = {
  title: "Bendung labirin — HidroLab",
  description:
    "Bendung labirin trapesium: perlipatan panjang mercu, keuntungan terhadap bendung lurus, dan batas ketika tirainya bertemu.",
};

export default function Page() {
  return <BendungLabirinClient />;
}
