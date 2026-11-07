"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  PITCH_MAX,
  PITCH_MIN,
  putarPandangan,
  samaPandangan,
  seretPandangan,
  tombolPanah,
  type Pandangan,
} from "./pandangan.ts";
import { KETUK_GESER } from "./taruh.ts";

/**
 * Pengendali arah pandang gambar 3D (D1 Phase 3).
 *
 * - Seret di AREA KOSONG gambar memutar (yaw dari geser mendatar, pitch
 *   dari geser tegak). Pegangan DragLayer ([data-handle]), lapis klik-taruh
 *   ([data-place]), tombol, dan isian tidak ikut memutar: pointerdown dari
 *   sana diabaikan, jadi satu gerak tangan tidak pernah melakukan dua hal.
 * - Sentuhan: touch-action pan-y. Geser tegak di HP tetap menggulir
 *   halaman (gambar ini setinggi separuh layar; mengunci gulir di sana
 *   membuat halaman terasa macet), geser mendatar memutar yaw. Pitch di
 *   HP lewat tombol panah.
 * - Papan ketik pada permukaan yang terfokus: panah = 15°, Shift + panah
 *   = 45°, Home = pandangan awal.
 * - Tanpa putar otomatis dan tanpa transisi beranimasi, jadi
 *   prefers-reduced-motion terpenuhi tanpa cabang khusus: sudut berubah
 *   seketika sebesar tindakan pengguna.
 *
 * Reset lembar memasang ulang isi lembar, jadi pandangan ikut kembali ke
 * awal tanpa kode tambahan.
 *
 * Opsi `seretDiTaruh` (GW-02, tambahan sesudah pilot): lapis klik-taruh
 * DragLayer menutup seluruh gambar, jadi tanpa opsi ini gambar yang bisa
 * ditaruhi titik tidak bisa diputar dengan seret sama sekali. Dengan opsi
 * ini, tetikus/pena yang ditekan di lapis taruh baru memutar sesudah
 * bergeser lebih dari KETUK_GESER (6 px), ambang yang sama yang membuat
 * lapis taruh membuang calon ketuknya: klik tetap menaruh, seret memutar,
 * tidak pernah keduanya. Sentuhan di lapis taruh tetap milik peramban
 * (gulir); di HP pandangan diputar dengan tombol. Tanpa opsi perilaku sama
 * persis dengan sebelumnya.
 */
export type PandanganKendali = {
  yaw: number;
  pitch: number;
  /** Putar sejauh (dyaw, dpitch) radian, dijepit. */
  putar: (dyaw: number, dpitch: number) => void;
  /** Kembali ke pandangan awal. */
  awal: () => void;
  diAwal: boolean;
  /** pitch sudah di batas atas / bawah: tombol arah itu dinonaktifkan. */
  diAtas: boolean;
  diBawah: boolean;
  /** Sebar ke elemen permukaan gambar (pembungkus kanvas). */
  permukaan: {
    tabIndex: number;
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
    style: CSSProperties;
    "data-memutar": boolean;
  };
};

/** Asal pointerdown yang BUKAN area kosong gambar. */
const BUKAN_KOSONG = "[data-handle],[data-place],button,a,input,select,textarea,label";
/** Sama, tanpa lapis taruh (opsi seretDiTaruh). */
const BUKAN_KOSONG_TARUH = "[data-handle],button,a,input,select,textarea,label";

export function usePandangan(
  mula: Pandangan,
  opsi: { seretDiTaruh?: boolean } = {}
): PandanganKendali {
  const seretDiTaruh = opsi.seretDiTaruh === true;
  // Pandangan awal dibekukan saat pasang: objek literal baru tiap render
  // dari pemanggil tidak boleh menggeser titik "pandangan awal".
  const mulaRef = useRef(mula);
  const [p, setP] = useState<Pandangan>(mula);
  const pRef = useRef(p);
  pRef.current = p;
  const seret = useRef<{ id: number; x: number; y: number; p0: Pandangan } | null>(null);
  /** Tekan di lapis taruh yang belum bergeser cukup jauh untuk menjadi seret. */
  const tunda = useRef<{ id: number; x: number; y: number } | null>(null);
  const [memutar, setMemutar] = useState(false);

  const putar = useCallback((dyaw: number, dpitch: number) => {
    setP((q) => putarPandangan(q, dyaw, dpitch));
  }, []);
  const awal = useCallback(() => setP(mulaRef.current), []);

  const selesai = useCallback((e: PointerEvent<HTMLElement>) => {
    if (tunda.current?.id === e.pointerId) tunda.current = null;
    const s = seret.current;
    if (!s || s.id !== e.pointerId) return;
    seret.current = null;
    setMemutar(false);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const permukaan = useMemo<PandanganKendali["permukaan"]>(
    () => ({
      tabIndex: 0,
      onPointerDown: (e) => {
        if (e.button !== 0 || seret.current) return;
        const asal = e.target as Element | null;
        if (seretDiTaruh && e.pointerType !== "touch" && asal?.closest?.("[data-place]")) {
          if (asal.closest(BUKAN_KOSONG_TARUH)) return;
          tunda.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          return;
        }
        if (asal?.closest?.(BUKAN_KOSONG)) return;
        seret.current = { id: e.pointerId, x: e.clientX, y: e.clientY, p0: pRef.current };
        setMemutar(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
      },
      onPointerMove: (e) => {
        const d = tunda.current;
        if (d && d.id === e.pointerId && !seret.current) {
          if (Math.hypot(e.clientX - d.x, e.clientY - d.y) <= KETUK_GESER) return;
          tunda.current = null;
          seret.current = { id: d.id, x: d.x, y: d.y, p0: pRef.current };
          setMemutar(true);
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }
        const s = seret.current;
        if (!s || s.id !== e.pointerId) return;
        // Dari pandangan saat tekan + geser total: tidak menumpuk galat.
        setP(seretPandangan(s.p0, e.clientX - s.x, e.clientY - s.y));
      },
      onPointerUp: selesai,
      onPointerCancel: selesai,
      onKeyDown: (e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Home") {
          e.preventDefault();
          awal();
          return;
        }
        const d = tombolPanah(e.key, e.shiftKey);
        if (!d) return;
        e.preventDefault();
        putar(d.dyaw, d.dpitch);
      },
      style: { touchAction: "pan-y", cursor: memutar ? "grabbing" : "grab" },
      "data-memutar": memutar,
    }),
    [selesai, awal, putar, memutar, seretDiTaruh]
  );

  return {
    yaw: p.yaw,
    pitch: p.pitch,
    putar,
    awal,
    diAwal: samaPandangan(p, mulaRef.current),
    diAtas: p.pitch >= PITCH_MAX - 1e-9,
    diBawah: p.pitch <= PITCH_MIN + 1e-9,
    permukaan,
  };
}
