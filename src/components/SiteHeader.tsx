"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n";
import { str } from "@/lib/strings";

export function SiteHeader() {
  const { lang, setLang } = useLang();
  const t = str(lang);

  return (
    <header className="border-b border-ink">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 py-2.5">
        <Link href="/" className="plain flex items-baseline gap-2.5">
          <span className="label text-[0.98rem] font-bold tracking-tight text-ink">
            HidroLab
          </span>
          <span className="stencil">{t.tagline}</span>
        </Link>

        <div className="flex items-baseline gap-5">
          <span className="stencil hidden sm:inline">{t.headerMeta}</span>
          <LangSwitch />
        </div>
      </div>
    </header>
  );
}

/**
 * Pengalih bahasa.
 *
 * Digayakan seperti pilihan pada lembar gambar: dua kode berdampingan
 * dengan pemisah tipis, yang aktif ditandai tinta pekat. Tidak ada
 * bendera negara — bahasa bukan negara, dan lembar ini dipakai lintas
 * tempat.
 */
function LangSwitch() {
  const { lang, setLang } = useLang();

  return (
    <div className="flex items-baseline gap-1.5">
      {(["id", "en"] as const).map((code, i) => (
        <span key={code} className="flex items-baseline gap-1.5">
          {i > 0 && <span className="text-rule-strong">/</span>}
          <button
            onClick={() => setLang(code)}
            aria-pressed={lang === code}
            className={`stencil transition-colors ${
              lang === code
                ? "text-ink"
                : "text-ink-3 hover:text-ink-2"
            }`}
            style={
              lang === code
                ? { borderBottom: "1px solid currentColor", paddingBottom: 1 }
                : undefined
            }
          >
            {code === "id" ? "ID" : "EN"}
          </button>
        </span>
      ))}
    </div>
  );
}
