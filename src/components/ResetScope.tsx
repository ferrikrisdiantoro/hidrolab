"use client";

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLang } from "@/lib/i18n";
import { str } from "@/lib/strings";

/* ------------------------------------------------------------------ *
 * Reset lembar
 * ------------------------------------------------------------------ *
 * Reset berarti kembali ke keadaan lembar saat pertama dibuka, bukan
 * "mengembalikan penggeser yang kebetulan diingat". Cara yang tidak bisa
 * lupa satu masukan pun adalah memasang ulang seluruh isi lembar: setiap
 * useState kembali ke nilai awalnya, tanda kondisi contoh padam karena
 * pencacah bloknya ikut lahir kembali, dan draf kotak angka hilang.
 *
 * Bahasa tidak ikut terhapus karena LangProvider berada di atas lingkup
 * ini (layout akar).
 */

type ResetCtx = {
  gen: number;
  reset: () => void;
  /**
   * Penjaga data: komponen yang menyimpan data isian pengguna (tabel data,
   * unggahan) mendaftar di sini selama isinya berbeda dari bawaan. Reset
   * menanyakan dulu bila ada satu saja yang terdaftar, karena data ketikan
   * atau unggahan tidak bisa dikembalikan seperti penggeser.
   */
  jaga: (id: string, aktif: boolean) => void;
  /** Benar sekali sesudah reset, supaya fokus pindah ke tombol baru. */
  ambilFokus: () => boolean;
};

const ResetContext = createContext<ResetCtx | null>(null);

export function ResetScope({ children }: { children: ReactNode }) {
  const t = str(useLang().lang);
  const [gen, setGen] = useState(0);
  const fokus = useRef(false);
  const dijaga = useRef(new Set<string>());
  const reset = useCallback(() => {
    if (dijaga.current.size > 0 && !window.confirm(t.resetConfirm)) return;
    dijaga.current.clear();
    fokus.current = true;
    setGen((g) => g + 1);
  }, [t.resetConfirm]);
  const jaga = useCallback((id: string, aktif: boolean) => {
    if (aktif) dijaga.current.add(id);
    else dijaga.current.delete(id);
  }, []);
  const ambilFokus = useCallback(() => {
    const v = fokus.current;
    fokus.current = false;
    return v;
  }, []);
  const ctx = useMemo(
    () => ({ gen, reset, jaga, ambilFokus }),
    [gen, reset, jaga, ambilFokus]
  );

  return (
    <ResetContext.Provider value={ctx}>
      <Fragment key={gen}>{children}</Fragment>
      {/* Pengumuman untuk pembaca layar; di luar Fragment supaya tidak ikut
          dipasang ulang dan benar-benar terdengar. */}
      <span className="sr-only" role="status" aria-live="polite">
        {/* Nomor reset ikut ditulis supaya reset kedua dan seterusnya juga
            mengubah teks dan terdengar lagi. */}
        {gen > 0 ? `${t.resetDone} (${gen})` : ""}
      </span>
    </ResetContext.Provider>
  );
}

/** Lingkup reset lembar, atau null di luar /lab. */
export function useLabReset() {
  return useContext(ResetContext);
}

/**
 * Mendaftarkan data isian yang sudah diubah pengguna, supaya Reset meminta
 * konfirmasi lebih dulu. `aktif` = isinya berbeda dari bawaan.
 */
export function useResetGuard(aktif: boolean) {
  const lingkup = useLabReset();
  const id = useId();
  const jaga = lingkup?.jaga;
  useEffect(() => {
    if (!jaga) return;
    jaga(id, aktif);
    return () => jaga(id, false);
  }, [jaga, id, aktif]);
}

/**
 * Tombol reset. Tidak menggambar apa pun di luar lingkup lembar, jadi
 * aman dipakai di komponen yang juga muncul di halaman lain.
 */
export function ResetButton({
  inline = false,
}: {
  /** Gaya tombol teks biasa (deret tombol tabel data), bukan judul kolom. */
  inline?: boolean;
} = {}) {
  const lingkup = useLabReset();
  const t = str(useLang().lang);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Tombol lama ikut lenyap saat dipasang ulang; tanpa ini fokus papan
    // ketik jatuh ke awal halaman.
    if (lingkup?.ambilFokus()) ref.current?.focus();
    // Hanya saat dipasang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!lingkup) return null;
  return (
    <button
      ref={ref}
      type="button"
      onClick={lingkup.reset}
      title={t.resetTitle}
      className={
        inline
          ? "label border-b border-rule-strong pb-px text-[0.8rem] text-ink-2 hover:border-ink hover:text-ink"
          : "label border-b border-rule-strong pb-px text-[0.66rem] font-semibold uppercase tracking-[0.11em] text-ink-2 transition-colors hover:border-ink hover:text-ink"
      }
    >
      {t.reset}
    </button>
  );
}
