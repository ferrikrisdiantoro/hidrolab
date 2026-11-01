"use client";

import { useEffect, useRef, useState } from "react";
import { langkahHalus } from "./halus";
import { useReducedMotion } from "./useCanvas";

/** Selang terpanjang satu frame, detik; sama dengan usePlate. */
const DT_MAX = 0.05;

/**
 * Nilai masukan yang mengejar `sasaran` dengan easing (lihat halus.ts).
 * Pemanggil menghitung ulang model dengan nilai yang dikembalikan.
 *
 * - `aktif` salah, atau peramban meminta pengurangan gerak: langsung
 *   sasaran, tanpa frame antara.
 * - Pertama kali dipasang: langsung sasaran (lembar tidak "tumbuh" saat
 *   dibuka).
 * - Gelung rAF hanya berjalan selama nilai belum sampai.
 */
export function useHalus(sasaran: number, aktif: boolean, tau = 0.1, eps = 1e-4): number {
  const reduced = useReducedMotion();
  const jalan = aktif && !reduced;
  const [tampil, setTampil] = useState(sasaran);
  const kini = useRef(sasaran);

  useEffect(() => {
    if (!jalan) {
      kini.current = sasaran;
      setTampil(sasaran);
      return;
    }
    if (kini.current === sasaran) return;
    let raf = 0;
    let last = -1;
    const loop = (now: number) => {
      const dt = last < 0 ? 0 : Math.min(DT_MAX, (now - last) / 1000);
      last = now;
      kini.current = langkahHalus(kini.current, sasaran, dt, tau, eps);
      setTampil(kini.current);
      if (kini.current !== sasaran) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sasaran, jalan, tau, eps]);

  return jalan ? tampil : sasaran;
}
