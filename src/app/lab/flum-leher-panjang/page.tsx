import type { Metadata } from "next";
import { FlumLeherPanjangClient } from "./FlumLeherPanjangClient";

export const metadata: Metadata = {
  title: "Flum Berleher Panjang — HidroLab",
  description:
    "Flum berleher panjang persegi menurut ISO 4359: aliran kritis di leher, koefisien kecepatan datang, dan dua batas keberlakuan yang harus dijaga.",
};

export default function Page() {
  return <FlumLeherPanjangClient />;
}
