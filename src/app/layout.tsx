import type { Metadata } from "next";
import { LangProvider } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SkipLink } from "@/components/SkipLink";
import "./globals.css";

export const metadata: Metadata = {
  title: "HidroLab — Laboratorium Hidraulika Interaktif",
  description:
    "Berkas lembar gambar interaktif untuk hidraulika saluran terbuka dan aliran pipa. Geser masukan, dan seluruh gambar beserta angkanya menyesuaikan. Interactive hydraulics laboratory sheets, in Indonesian and English.",
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
        <LangProvider>
          <SkipLink />
          <SiteHeader />
          <main id="konten">{children}</main>
          <SiteFooter />
        </LangProvider>
      </body>
    </html>
  );
}
