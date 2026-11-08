"use client";

import { useCanvas } from "@/lib/useCanvas";
import { drawChart, type ChartSpec } from "@/lib/drawChart";
import { useLang } from "@/lib/i18n";

/*
 * Grafik lembar pengamatan (mode praktikum P-B): profil kecepatan FM-03 dan
 * kurva konduktivitas FM-05 yang terbangun titik demi titik. Hanya pembungkus
 * drawChart; spesifikasinya disusun lembar dari baris tabel.
 *
 * Kanvas tidak terbaca pembaca layar, jadi `ringkasan` (kalimat isi grafik)
 * ditulis di label gambar. Angka lengkapnya ada di tabel pengamatan.
 */
export function GrafikPraktikum({
  spec,
  ringkasan,
  tinggi = "clamp(260px, 42vw, 380px)",
}: {
  spec: ChartSpec;
  /** Kalimat isi grafik untuk pembaca layar */
  ringkasan: string;
  tinggi?: string;
}) {
  const { lang } = useLang();
  // Spesifikasi berupa data biasa: kuncinya cukup untuk tahu kapan menggambar ulang.
  const kunci = JSON.stringify(spec);
  const ref = useCanvas((ctx, w, h) => drawChart(ctx, w, h, spec, lang), [kunci, lang]);
  return (
    <div className="relative border border-rule-strong bg-sheet" style={{ height: tinggi }} role="img" aria-label={ringkasan}>
      <canvas ref={ref} className="block h-full w-full" />
    </div>
  );
}
