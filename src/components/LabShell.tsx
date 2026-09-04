"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { useLang } from "@/lib/i18n";
import { str } from "@/lib/strings";

/**
 * Susunan satu lembar laboratorium.
 *
 * Kolom kiri lebar untuk bidang gambar, kolom kanan sempit untuk tabel
 * masukan dan hasil. Ini meniru cara lembar teknik disusun: gambar
 * mendominasi, angka mendampingi di tepi, dan keduanya berbagi satu
 * kop yang sama.
 */
export function LabShell({
  sheet,
  subject,
  title,
  intro,
  drawing,
  side,
  below,
}: {
  sheet: string;
  subject: string;
  title: string;
  intro: ReactNode;
  drawing: ReactNode;
  side: ReactNode;
  below?: ReactNode;
}) {
  const t = str(useLang().lang);

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-8">
      <nav className="mb-6 flex items-baseline justify-between gap-4 border-b border-ink pb-2">
        <Link href="/" className="stencil plain hover:text-ink">
          {t.backToIndex}
        </Link>
        <span className="stencil">
          {subject} · {t.sheetWord} {sheet}
        </span>
      </nav>

      <header className="mb-7 max-w-[64ch]">
        <h1 className="text-[clamp(1.9rem,4vw,2.9rem)] font-semibold leading-[1.08] tracking-[-0.015em] text-ink">
          {title}
        </h1>
        <div className="mt-3 text-[1.02rem] leading-[1.62] text-ink-2">
          {intro}
        </div>
      </header>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.62fr)_minmax(310px,0.72fr)]">
        <div className="min-w-0">{drawing}</div>
        <aside className="flex flex-col gap-6">{side}</aside>
      </div>

      {below && <div className="mt-9">{below}</div>}
    </div>
  );
}

/**
 * Dasar perhitungan.
 *
 * Persamaan ditulis apa adanya di dalam alur baca, tidak dikurung
 * dalam kartu. Rujukan disusun sebagai daftar bernomor seperti pada
 * catatan lembar teknik.
 */
export function Basis({
  equations,
  note,
  refs,
}: {
  equations: ReactNode;
  note: string;
  refs: string[];
}) {
  const t = str(useLang().lang);

  return (
    <div className="grid gap-8 border-t border-ink pt-3 lg:grid-cols-[minmax(0,1.62fr)_minmax(310px,0.72fr)]">
      <div>
        <h2 className="stencil mb-3">{t.blkBasis}</h2>
        <div className="flex flex-col gap-2.5">{equations}</div>
        <p className="mt-4 max-w-[64ch] text-[0.94rem] leading-[1.6] text-ink-2">
          {note}
        </p>
      </div>
      <div>
        <h2 className="stencil mb-3">{t.blkRefs}</h2>
        <ol className="flex list-none flex-col gap-2.5">
          {refs.map((r, i) => (
            <li
              key={r}
              className="grid grid-cols-[1.6rem_1fr] text-[0.86rem] leading-[1.5] text-ink-2"
            >
              <span className="value text-ink-3">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{r}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Persamaan tunggal, diberi ruang dan garis rambut di kiri. */
export function Eq({ children }: { children: ReactNode }) {
  return (
    <div className="label value overflow-x-auto border-l border-rule-strong py-1 pl-3.5 text-[0.92rem] text-ink">
      <div className="flex min-w-max items-center gap-1.5">{children}</div>
    </div>
  );
}

/** Pecahan bertingkat, digambar dengan garis bagi sungguhan. */
export function Frac({ num, den }: { num: ReactNode; den: ReactNode }) {
  return (
    <span className="mx-1 inline-flex flex-col items-center align-middle leading-none">
      <span className="px-1.5 pb-[3px]">{num}</span>
      <span className="h-px w-full bg-ink" />
      <span className="px-1.5 pt-[3px]">{den}</span>
    </span>
  );
}
