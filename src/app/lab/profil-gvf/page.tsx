import type { Metadata } from "next";
import { ProfilGvfClient } from "./ProfilGvfClient";

export const metadata: Metadata = {
  title: "Profil Aliran Berubah Lambat — HidroLab",
  description:
    "Penelusuran profil muka air M1, M2, M3, S1, S2, S3 dengan integrasi Runge-Kutta orde empat.",
};

export default function Page() {
  return <ProfilGvfClient />;
}
