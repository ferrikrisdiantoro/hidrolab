"use client";

import { useState, type ReactNode } from "react";
import { useLang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { fmt } from "@/lib/hydraulics";
import { LANGKAH, derajat } from "@/lib/pandangan";
import type { PandanganKendali } from "@/lib/usePandangan";

/**
 * Tombol pandang gambar 3D (D1 Phase 3): empat panah, pandangan awal, dan
 * angka sudut yang sedang dipakai. Krom, bukan data, jadi warnanya tinta;
 * bentuknya sama dengan tombol gerak di pojok Sheet (target sentuh 44 px,
 * kotak tampak 26 px bergaris tipis).
 *
 * Angka sudut ditulis karena gambar teknik yang diputar tetap harus bisa
 * diulang: "arah −45°, angkat 35°" menyebut pandangan yang sama di layar
 * mana pun.
 *
 * Tombol yang sampai di batas (Atas, Bawah, Pandangan awal) memakai
 * aria-disabled, bukan disabled: tombol yang menjadi disabled saat sedang
 * difokus membuang fokus ke body. Tombolnya tetap bisa difokus dan diklik,
 * kliknya saja yang diabaikan.
 *
 * Angka sudut yang tampak tidak aria-live: saat seret ia berubah puluhan
 * kali per detik. Yang diumumkan pembaca layar adalah salinan tersembunyi
 * yang hanya diperbarui bila sudut berubah BUKAN karena seret, yaitu dari
 * tombol ini atau panah papan ketik pada gambar.
 */
export function TombolPandang({ p }: { p: PandanganKendali }) {
  const t = str(useLang().lang);
  const s = derajat(LANGKAH);
  const sudut = `${t.viewYaw} ${fmt(derajat(p.yaw), 0)}°, ${t.viewPitch} ${fmt(derajat(p.pitch), 0)}°`;
  const kunci = `${p.yaw},${p.pitch}`;
  const [kunciLalu, setKunciLalu] = useState(kunci);
  const [umum, setUmum] = useState("");
  if (kunci !== kunciLalu) {
    setKunciLalu(kunci);
    if (!p.permukaan["data-memutar"]) setUmum(sudut);
  }
  return (
    <div role="group" aria-label={t.viewControls} className="flex flex-wrap items-center gap-x-1">
      <div className="flex items-center">
        <Kotak label={`${t.viewLeft} ${s}°`} onClick={() => p.putar(LANGKAH, 0)}>
          <path d="M6.5 1.5 2.5 5l4 3.5" />
        </Kotak>
        <Kotak label={`${t.viewRight} ${s}°`} onClick={() => p.putar(-LANGKAH, 0)}>
          <path d="M3.5 1.5 7.5 5l-4 3.5" />
        </Kotak>
        <Kotak label={`${t.viewUp} ${s}°`} onClick={() => p.putar(0, LANGKAH)} disabled={p.diAtas}>
          <path d="M1.5 6.5 5 2.5l3.5 4" />
        </Kotak>
        <Kotak label={`${t.viewDown} ${s}°`} onClick={() => p.putar(0, -LANGKAH)} disabled={p.diBawah}>
          <path d="M1.5 3.5 5 7.5l3.5-4" />
        </Kotak>
        <button
          type="button"
          onClick={() => {
            if (!p.diAwal) p.awal();
          }}
          aria-disabled={p.diAwal || undefined}
          className="group flex h-11 items-center px-1.5 outline-none aria-disabled:cursor-default"
        >
          <span className="label border-b border-rule-strong pb-px text-[0.78rem] text-ink-2 transition-colors group-hover:border-ink group-hover:text-ink group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-water group-aria-disabled:border-transparent group-aria-disabled:text-ink-3">
            {t.viewHome}
          </span>
        </button>
      </div>
      <span className="label whitespace-nowrap text-[0.74rem] tabular-nums text-ink-3">{sudut}</span>
      <span className="sr-only" role="status" aria-live="polite">
        {umum}
      </span>
    </div>
  );
}

function Kotak({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!disabled) onClick();
      }}
      aria-disabled={disabled || undefined}
      aria-label={label}
      title={label}
      className="group flex h-11 w-11 items-center justify-center outline-none aria-disabled:cursor-default"
    >
      <span
        aria-hidden="true"
        className="flex h-[26px] w-[26px] items-center justify-center border border-rule-strong bg-sheet text-ink transition-colors group-hover:border-ink group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-water group-aria-disabled:border-rule group-aria-disabled:text-ink-3"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          {children}
        </svg>
      </span>
    </button>
  );
}
