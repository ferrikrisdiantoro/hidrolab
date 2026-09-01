"use client";

import { useEffect, useRef } from "react";

export type DrawFn = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  /** Detik sejak pemasangan; 0 bila gerak dimatikan */
  t: number,
  /** Selang waktu sejak frame sebelumnya, detik */
  dt: number
) => void;

export type CanvasOptions = {
  /**
   * Jalankan gelung gambar terus-menerus.
   *
   * Dipakai HANYA bila ada besaran fisika yang memang bergerak, seperti
   * goresan aliran yang kecepatannya diturunkan dari debit. Untuk lembar
   * yang isinya diam — kurva, diagram — biarkan mati, supaya gambar hanya
   * dihitung ulang ketika ada yang benar-benar berubah.
   */
  animate?: boolean;
};

/**
 * Menyiapkan bidang gambar beresolusi tinggi yang mengikuti ukuran induknya.
 *
 * Bila gerak dimatikan, atau bila peramban meminta pengurangan gerak,
 * gambar tetap dihitung ulang saat masukan berubah — hanya animasinya
 * yang berhenti, bukan isinya.
 */
export function useCanvas(
  draw: DrawFn,
  deps: unknown[],
  opts: CanvasOptions = {}
) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  const animate = opts.animate ?? false;
  const startRef = useRef(0);
  const lastRef = useRef(0);

  const paint = useRef((t: number, dt: number) => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = parent.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawRef.current(ctx, w, h, t, dt);
  });

  // Gambar ulang saat nilai masukan berubah.
  useEffect(() => {
    if (!animate) paint.current(0, 0);
  });

  // Gelung gambar, hanya bila ada yang benar-benar bergerak.
  useEffect(() => {
    if (!animate) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      paint.current(0, 0);
      return;
    }

    let raf = 0;
    const loop = (now: number) => {
      if (!startRef.current) {
        startRef.current = now;
        lastRef.current = now;
      }
      const t = (now - startRef.current) / 1000;
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      paint.current(t, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  // Gambar ulang saat ukuran berubah, dan sekali lagi setelah huruf
  // selesai dimuat agar lebar label terukur dengan benar.
  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;

    const ro = new ResizeObserver(() => {
      if (!animate) paint.current(0, 0);
    });
    ro.observe(parent);

    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled && !animate) paint.current(0, 0);
    });

    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [animate]);

  return ref;
}
