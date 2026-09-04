"use client";

import { useLang } from "@/lib/i18n";
import { str } from "@/lib/strings";

export function SkipLink() {
  const { lang } = useLang();
  return (
    <a
      href="#konten"
      className="plain sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-ink focus:bg-sheet focus:px-3 focus:py-2"
    >
      {str(lang).skip}
    </a>
  );
}
