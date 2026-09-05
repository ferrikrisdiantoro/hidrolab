import type { Metadata } from "next";
import { TiraiLuapanClient } from "./TiraiLuapanClient";

export const metadata: Metadata = {
  title: "Tirai Luapan Bebas — HidroLab",
  description:
    "Bentuk tirai luapan di atas ambang tajam menurut persamaan WES, dibandingkan langsung dengan lintasan peluru, lengkap dengan peran rongga udara di bawahnya.",
};

export default function Page() {
  return <TiraiLuapanClient />;
}
