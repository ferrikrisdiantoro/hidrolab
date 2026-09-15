import type { Metadata } from "next";
import { TangkapTandaiUlangClient } from "./TangkapTandaiUlangClient";

export const metadata: Metadata = {
  title: "Tangkap-tandai-tangkap ulang — HidroLab",
  description:
    "Taksiran populasi dari dua kali penangkapan: Lincoln-Petersen, pembetulan Chapman, dan selang kepercayaannya.",
};

export default function Page() {
  return <TangkapTandaiUlangClient />;
}
