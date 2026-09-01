import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "HidroLab — Laboratorium Hidraulika Interaktif",
  description:
    "Berkas lembar gambar interaktif untuk hidraulika saluran terbuka dan aliran pipa. Geser masukan, dan seluruh gambar beserta angkanya menyesuaikan.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=Public+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen">
        <a
          href="#konten"
          className="plain sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-ink focus:bg-sheet focus:px-3 focus:py-2"
        >
          Lompat ke konten
        </a>
        <SiteHeader />
        <main id="konten">{children}</main>
        <footer className="mt-20 border-t border-ink">
          <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-6 py-7 text-[0.86rem] leading-[1.55] text-ink-2">
            <p className="max-w-[70ch]">
              HidroLab adalah purwarupa. Seluruh perhitungan berjalan di
              peramban dan tidak ada data yang dikirim keluar. Model diturunkan
              dari persamaan baku teknik hidro.
            </p>
            <p className="max-w-[70ch] text-ink-3">
              Hasil pada lembar-lembar ini ditujukan untuk membangun pemahaman,
              bukan menggantikan perhitungan desain yang terjamin mutunya.
              Setiap keluaran harus diperiksa secara independen sebelum dipakai
              untuk desain, penilaian keselamatan, atau pengajuan ke regulator.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
