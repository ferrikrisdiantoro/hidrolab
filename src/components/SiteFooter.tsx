"use client";

import { useLang } from "@/lib/i18n";
import { str } from "@/lib/strings";

export function SiteFooter() {
  const { lang } = useLang();
  const t = str(lang);

  return (
    <footer className="mt-20 border-t border-ink">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-6 py-7 text-[0.86rem] leading-[1.55] text-ink-2">
        <p className="max-w-[70ch]">{t.footer1}</p>
        <p className="max-w-[70ch] text-ink-3">{t.footer2}</p>
      </div>
    </footer>
  );
}
