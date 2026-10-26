"use client";

import { useEffect, useRef, useState } from "react";
import type { PlateOut } from "./plateOut";
import { useReducedMotion } from "./useCanvas";

/**
 * Penggambar lapis statis. Dipanggil dengan t = 0 dan dt = 0, sama seperti
 * useCanvas menggambar saat gerak mati, sehingga draw*.ts yang ada bisa
 * dipakai apa adanya. Boleh mengembalikan PlateOut untuk lapis gerak dan
 * pegangan seret.
 */
export type PlateDrawFn = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  dt: number
) => PlateOut | void;

/**
 * Penggambar lapis gerak. Kanvasnya sudah dibersihkan sebelum dipanggil.
 * `t` dan `dt` dalam detik waktu fisik (sudah dikali timeScale).
 * `out` = PlateOut terakhir dari lapis statis, atau null.
 */
export type MotionFn = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  dt: number,
  out: PlateOut | null
) => void;

export type PlateOptions = {
  /** Lapis gerak berjalan. Bawaan true. Jeda dari tombol putar/jeda. */
  playing?: boolean;
  /**
   * Pengali waktu: detik fisik per detik layar. Bila ≠ 1, lembar wajib
   * menulis "waktu dipercepat ×N" (atau diperlambat) di dekat gambar.
   */
  timeScale?: number;
};

export type PlateHandle = {
  /** Kanvas lapis statis */
  ref: React.RefObject<HTMLCanvasElement | null>;
  /** Kanvas lapis gerak, ditaruh tepat sesudah kanvas statis */
  motionRef: React.RefObject<HTMLCanvasElement | null>;
  /** PlateOut terakhir dari lapis statis */
  outRef: React.RefObject<PlateOut | null>;
  /** Naik satu setiap lapis statis digambar ulang; pemicu render pegangan */
  version: number;
  /** Ada fungsi gerak (tombol putar/jeda ditampilkan) */
  motionAllowed: boolean;
};

/** Selang terpanjang satu frame, detik; mencegah loncatan sesudah macet. */
const DT_MAX = 0.05;

/**
 * Bidang gambar dua lapis.
 *
 * - Lapis statis: digambar ulang HANYA saat deps atau ukuran berubah (dan
 *   sekali lagi sesudah huruf termuat). Isinya identik dengan useCanvas
 *   dalam keadaan diam.
 * - Lapis gerak: kanvas kedua di atasnya (absolute, pointer-events none),
 *   dibersihkan dan digambar tiap frame lewat `motion`. Berhenti saat jeda,
 *   tab tersembunyi, atau kanvas di luar layar. Saat berhenti, lapis ini
 *   kosong, jadi yang terlihat persis lapis statis. Reduced-motion diurus
 *   pemanggil lewat usePutar: tidak berputar sendiri, tetapi tetap bisa
 *   diputar dengan tombol.
 *
 * Pemakaian:
 *   const { ref, motionRef } = usePlate(draw, motion, [a, b, lang]);
 *   <canvas ref={ref} className="block h-full w-full" />
 *   <canvas ref={motionRef} />
 */
export function usePlate(
  draw: PlateDrawFn,
  motion: MotionFn | null,
  deps: unknown[],
  opts: PlateOptions = {}
): PlateHandle {
  const ref = useRef<HTMLCanvasElement>(null);
  const motionRef = useRef<HTMLCanvasElement>(null);
  const outRef = useRef<PlateOut | null>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const motionFnRef = useRef(motion);
  motionFnRef.current = motion;
  const scaleRef = useRef(opts.timeScale ?? 1);
  scaleRef.current = opts.timeScale ?? 1;

  // Ukuran terakhir lapis statis; lapis gerak memakainya tanpa mengukur
  // ulang DOM tiap frame.
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const [version, setVersion] = useState(0);

  const [pageVisible, setPageVisible] = useState(true);
  const [onScreen, setOnScreen] = useState(true);

  const playing = opts.playing ?? true;
  const hasMotion = motion !== null;
  const motionAllowed = hasMotion;
  const running = hasMotion && playing && pageVisible && onScreen;

  /* ---------------- lapis statis ---------------- */

  const paintStatic = useRef(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = parent.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));

    // Lebar buffer selalu bulat; dibandingkan dengan nilai pecahan
    // (dpr 1,25 / 1,5) syaratnya benar terus dan kanvas dialokasi ulang.
    // floor = cara peramban memotong w*dpr di useCanvas, jadi piksel sama.
    const pw = Math.floor(w * dpr);
    const ph = Math.floor(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    size.current.w = w;
    size.current.h = h;
    size.current.dpr = dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const out = drawRef.current(ctx, w, h, 0, 0);
    outRef.current = out ?? null;
    setVersion((v) => v + 1);
  });

  /* ---------------- lapis gerak ---------------- */

  // Menyamakan ukuran kanvas gerak dengan lapis statis; mengembalikan
  // konteks yang sudah bertransformasi dan bersih, atau null.
  const prepMotion = useRef((): CanvasRenderingContext2D | null => {
    const mc = motionRef.current;
    if (!mc) return null;
    const { w, h, dpr } = size.current;
    if (w === 0) return null;
    const pw = Math.floor(w * dpr);
    const ph = Math.floor(h * dpr);
    if (mc.width !== pw || mc.height !== ph) {
      mc.width = pw;
      mc.height = ph;
      mc.style.width = `${w}px`;
      mc.style.height = `${h}px`;
    }
    const ctx = mc.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return ctx;
  });

  // Gaya kanvas gerak dipasang di sini supaya Client tidak perlu ingat.
  useEffect(() => {
    const mc = motionRef.current;
    if (!mc) return;
    mc.setAttribute("aria-hidden", "true");
    const s = mc.style;
    s.position = "absolute";
    s.left = "0";
    s.top = "0";
    s.pointerEvents = "none";
  }, []);

  // Gambar ulang lapis statis saat masukan berubah. `deps` WAJIB nilai
  // primitif: paintStatic menaikkan `version`, jadi objek baru tiap render
  // akan memutar render tanpa henti. Kanvas gerak harus selalu dirender
  // (tidak bersyarat) di dalam induk ber-position relative.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    paintStatic.current();
  }, deps);

  // Ukuran dan huruf.
  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => paintStatic.current());
    ro.observe(parent);
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) paintStatic.current();
    });
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, []);

  // Tab tersembunyi.
  useEffect(() => {
    const on = () => setPageVisible(!document.hidden);
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  // Di luar layar. Hanya dipasang bila ada gerak.
  useEffect(() => {
    if (!hasMotion) return;
    const el = ref.current?.parentElement;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1];
      if (e) setOnScreen(e.isIntersecting);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMotion]);

  // Waktu fisik terkumpul; hanya maju selama berjalan, jadi jeda lalu
  // lanjut tidak membuat partikel meloncat.
  const tRef = useRef(0);

  useEffect(() => {
    if (!running) {
      // Berhenti: kosongkan lapis gerak, yang terlihat tinggal lapis statis.
      prepMotion.current();
      return;
    }
    let raf = 0;
    let last = -1;
    const loop = (now: number) => {
      const real = last < 0 ? 0 : Math.min(DT_MAX, (now - last) / 1000);
      last = now;
      const dt = real * scaleRef.current;
      tRef.current += dt;
      const ctx = prepMotion.current();
      const fn = motionFnRef.current;
      if (ctx && fn) {
        fn(ctx, size.current.w, size.current.h, tRef.current, dt, outRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  return { ref, motionRef, outRef, version, motionAllowed };
}

/**
 * Keadaan putar/jeda lapis gerak. Bawaannya berputar, kecuali peramban
 * meminta pengurangan gerak (setelan "animation effects" Windows mati,
 * "hapus animasi" Android, dsb.): animasi tidak berputar sendiri, tetapi
 * tombolnya tetap ada. Banyak laptop mahasiswa disetel begitu karena mode
 * hemat daya, dan tanpa tombol mereka tidak pernah melihat animasinya
 * (uji rekan V14, 25 Okt 2026). Pilihan pengguna menang atas bawaan.
 */
export function usePutar(): { playing: boolean; toggle: () => void } {
  const reduced = useReducedMotion();
  const [pilihan, setPilihan] = useState<boolean | null>(null);
  const playing = pilihan ?? !reduced;
  return { playing, toggle: () => setPilihan(!playing) };
}
