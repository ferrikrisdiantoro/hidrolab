"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { setNumberLocale } from "./hydraulics";

export type Lang = "id" | "en";

const STORAGE_KEY = "hidrolab-bahasa";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
};

const LangContext = createContext<Ctx>({ lang: "id", setLang: () => {} });

/**
 * Pemilihan bahasa disimpan di peramban pengunjung dan dapat pula
 * dipaksa lewat parameter alamat (?lang=en), supaya satu tautan bisa
 * dikirim langsung dalam bahasa tertentu — berguna saat mengirim
 * lembar tertentu ke rekan yang tidak berbahasa Indonesia.
 */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("id");

  useEffect(() => {
    let next: Lang | null = null;

    const param = new URLSearchParams(window.location.search).get("lang");
    if (param === "id" || param === "en") {
      next = param;
      // Parameter dibersihkan dari alamat setelah dibaca, agar tautan
      // yang disalin pengunjung tetap rapi.
      const url = new URL(window.location.href);
      url.searchParams.delete("lang");
      window.history.replaceState({}, "", url.toString());
    }

    if (!next) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === "id" || saved === "en") next = saved;
      } catch {
        // Penyimpanan bisa diblokir; bahasa bawaan tetap dipakai.
      }
    }

    if (next) setLangState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Diterapkan saat penggambaran, bukan di dalam efek, agar angka pada
  // penggambaran pertama sudah memakai pemisah desimal yang benar.
  setNumberLocale(lang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // Diabaikan: pilihan tetap berlaku selama kunjungan ini.
    }
  }, []);

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

/** Memilih satu dari sepasang teks menurut bahasa yang aktif. */
export type Bi<T> = { id: T; en: T };

export function pick<T>(bi: Bi<T>, lang: Lang): T {
  return bi[lang];
}
