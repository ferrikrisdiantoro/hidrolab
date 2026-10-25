"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { fmt, fmtPlain, getNumberLocale } from "@/lib/hydraulics";
import { TONE, type Tone } from "@/lib/theme";
import { keLangkah, sliderBounds, snap, type ParamDef } from "@/lib/rentang";
import { ResetButton } from "./ResetScope";

/* ------------------------------------------------------------------ *
 * Lembar gambar
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Penanda kondisi contoh yang sedang dipakai
 * ------------------------------------------------------------------ *
 * Menekan tombol kondisi contoh mengubah seluruh masukan sekaligus, dan
 * sesudah itu tidak ada apa pun di layar yang menyatakan kondisi mana yang
 * sedang berlaku. Pembaca yang menggeser satu penggeser lalu kembali
 * beberapa menit kemudian tidak dapat mengetahui apakah yang dilihatnya
 * masih kondisi contoh atau sudah keadaan buatannya sendiri.
 *
 * Yang dipakai di sini satu pencacah bersama di dalam satu blok. Menekan
 * kondisi contoh mencatat nomor pencacah saat itu; menggeser masukan apa
 * pun menaikkan pencacahnya. Penandanya menyala selama kedua angka itu
 * masih sama, jadi ia padam tepat pada geseran pertama sesudahnya. Dengan
 * begitu penandanya tidak pernah berbohong: ia tidak menyatakan lebih dari
 * "kondisi ini yang dipasang, dan belum ada yang diubah sejak itu".
 */

type PresetScope = { gen: number; touch: () => void };

const PresetContext = createContext<PresetScope | null>(null);

const tanpaLingkup = () => {};

/**
 * Fungsi untuk memadamkan tanda kondisi contoh di blok ini, sama seperti
 * menggeser penggeser. Untuk masukan di luar InputRow, misalnya pegangan
 * seret di kanvas. Di luar Block fungsinya tidak berbuat apa-apa.
 */
export function usePresetTouch(): () => void {
  const lingkup = useContext(PresetContext);
  return lingkup?.touch ?? tanpaLingkup;
}

export type TitleBlockCell = { label: string; value: string; tint?: string };

/**
 * Bidang gambar lengkap dengan kop di bawahnya.
 *
 * Kop ini hidup: isinya berubah mengikuti masukan. Kop yang isinya tetap
 * saat masukan berubah hanyalah properti panggung — di lembar teknik,
 * blok inilah yang membuat sebuah gambar bisa dipertanggungjawabkan,
 * karena ia menyimpan skala, satuan, dan asumsi yang dipakai.
 */
export function Sheet({
  number,
  title,
  cells,
  children,
  height = "clamp(360px, 56vh, 620px)",
  rev = "—",
}: {
  number: string;
  title: string;
  cells: TitleBlockCell[];
  children: ReactNode;
  height?: string;
  rev?: string;
}) {
  const { lang } = useLang();
  const t = str(lang);

  return (
    <figure className="sheet">
      <div className="relative w-full" style={{ height }}>
        {children}
      </div>

      <figcaption className="border-t border-ink">
        {/*
          Satu baris mulai lebar lg: kop yang terlipat ke dua baris tidak lagi
          terbaca sebagai kop. Sel boleh menyusut sampai kata terpanjangnya
          (min-content) dan isinya terlipat di dalam sel; judul menyusut lebih
          dulu karena isinya paling panjang. Di layar sempit kop boleh
          melipat seperti biasa.
        */}
        <div className="flex flex-wrap items-stretch lg:flex-nowrap">
          <div className="flex min-w-[180px] flex-1 flex-col justify-center border-r border-rule px-3.5 py-2.5 lg:min-w-[7.5rem] lg:px-3">
            <span className="stencil">{t.tbSimulation}</span>
            <span className="label mt-0.5 text-[0.82rem] font-semibold leading-tight text-ink">
              {title}
            </span>
          </div>

          {cells.map((c, i) => (
            <div
              key={i}
              className="flex min-w-[92px] flex-col justify-center border-r border-rule px-3.5 py-2.5 lg:min-w-min lg:px-3"
            >
              {/*
               * Label sel hampir selalu SIMBOL, dan huruf besar mengubah
               * artinya: h/L menjadi H/L padahal H tinggi gelombang, τ
               * menjadi Τ yang terbaca T, ω menjadi Ω, ε₁ menjadi E₁. Hanya
               * kata kop yang tetap berhuruf besar.
               */}
              <span
                className="stencil"
                style={
                  c.label === t.tbUnit || c.label === t.tbScale
                    ? undefined
                    : /* Tanpa jarak antarhuruf juga: jarak itu memisahkan
                         tanda gabung dari hurufnya, sehingga d̄ tertulis
                         "d ¯" dengan garis atasnya melayang di samping. */
                      { textTransform: "none", letterSpacing: "normal" }
                }
              >
                {c.label}
              </span>
              <span
                className="value label mt-0.5 text-[0.86rem] font-semibold leading-tight"
                style={{ color: c.tint ?? "var(--color-ink)" }}
              >
                {c.value}
              </span>
            </div>
          ))}

          <div className="flex min-w-[96px] flex-col justify-center px-3.5 py-2.5 lg:min-w-min lg:px-3">
            <span className="stencil">{t.tbSheet}</span>
            <span className="value label mt-0.5 text-[0.86rem] font-semibold leading-tight text-ink">
              {number}
              <span className="ml-2 font-normal text-ink-3">{t.tbRev} {rev}</span>
            </span>
          </div>
        </div>
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ *
 * Tabel masukan
 * ------------------------------------------------------------------ */

export function InputTable({ children }: { children: ReactNode }) {
  const t = str(useLang().lang);
  return (
    <table className="data">
      <thead>
        <tr>
          <th style={{ width: "2.6rem" }}>{t.thSym}</th>
          <th>{t.thQuantity}</th>
          {/* Kolom penggeser tidak berjudul; ruangnya dipakai tombol reset
              lembar, tepat di atas semua masukan yang dikembalikannya. */}
          <th style={{ width: "25%", textAlign: "right" }}>
            <ResetButton />
          </th>
          <th className="n" style={{ width: "5.6rem" }}>
            {t.thValue}
          </th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function InputRow({
  symbol,
  label,
  value,
  min,
  max,
  step,
  unit,
  digits = 2,
  onChange,
  tint,
  editable = true,
}: {
  symbol: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  digits?: number;
  onChange: (v: number) => void;
  tint?: string;
  /** Kotak angka yang bisa diketik di samping penggeser. Bawaan: ya. */
  editable?: boolean;
}) {
  const lingkup = useContext(PresetContext);
  const { lang } = useLang();
  const t = str(lang);
  const idCatatan = useId();

  /*
   * Kotak angka
   *
   * Satu sumber nilai: kotak dan penggeser memanggil onChange yang sama, dan
   * keduanya membaca `value` yang sama.
   *
   * Kotak dan penggeser sama-sama berpijak pada kelipatan langkah yang
   * dihitung dari NOL. Penggeser peramban berpijak pada atribut min, dan min
   * beberapa lembar bukan kelipatan langkah (Falkner-Skan: min -0,19884,
   * langkah 0,002; DebitPenampang: min 0,01, langkah 0,05), sehingga pijakan
   * min mengubah "0" menjadi -0,00084 dan membuat ujung atas tak tercapai.
   * Karena itu atribut min/max penggeser dilebarkan ke kelipatan langkah
   * terdekat di luar rentang, dan nilainya dikembalikan ke [min, max]: ujung
   * kiri penggeser berarti min, ujung kanan berarti max, persis.
   *
   * Setiap kali nilai yang berlaku berbeda dari yang diketik, ada tandanya
   * (aturan 4): "dibulatkan ke ...", "dibatasi ke ...", atau "dibaca
   * sebagai ..." untuk ketikan berpola ribuan. Tanda itu padam begitu
   * nilainya diubah lagi, lewat kotak maupun penggeser.
   *
   * Ketikan di luar [min, max] ditahan sebagai draf selama masih diketik
   * (angka 1 menuju 150 sempat melewati 15), lalu dipotong ke ujung rentang
   * saat kotak ditinggalkan atau Enter ditekan.
   */
  type Catatan = { jenis: "potong" | "bulat" | "pas"; nilai: number; tafsir?: number };
  const [draf, setDraf] = useState<string | null>(null);
  const [catatan, setCatatan] = useState<Catatan | null>(null);
  const fokus = useRef(false);
  const awal = useRef(value);

  const rentang: ParamDef = { min, max, step, digits };
  const { min: minGeser, max: maxGeser } = sliderBounds(rentang);
  const polos = (v: number) => fmtPlain(v, digits);
  /*
   * Di bahasa Indonesia titik adalah pemisah ribuan, jadi "1.250" bisa
   * berarti seribu dua ratus lima puluh. Kotak ini membaca titik sebagai
   * tanda desimal (1,25), dan menuliskan tafsiran itu supaya tidak diam-diam.
   * Sebaliknya di bahasa Inggris koma adalah pemisah ribuan, jadi "1,250"
   * yang dibaca 1.25 juga ditulis tafsirannya (tinjauan peninjau-kode).
   */
  const ambigu = (teks: string) =>
    lang === "id"
      ? /^[-+]?\d{1,3}\.\d{3}$/.test(teks.trim())
      : /^[-+]?\d{1,3},\d{3}$/.test(teks.trim());

  const kirim = (v: number) => {
    if (v === value) return;
    lingkup?.touch();
    onChange(v);
  };
  /** Mengirim ketikan sah v dan mencatat bila yang berlaku berbeda. */
  const terapkan = (v: number, teks: string) => {
    const hasil = snap(v, rentang);
    const akhir = hasil.value;
    kirim(akhir);
    const tafsir = ambigu(teks) ? v : undefined;
    if (hasil.clamped !== 0) setCatatan({ jenis: "potong", nilai: akhir, tafsir });
    else if (hasil.rounded) setCatatan({ jenis: "bulat", nilai: akhir, tafsir });
    else if (tafsir !== undefined) setCatatan({ jenis: "pas", nilai: akhir, tafsir });
    else setCatatan(null);
    return akhir;
  };
  /** Menutup suntingan: dipanggil saat blur dan Enter. */
  const selesai = (tetapFokus: boolean) => {
    if (draf === null) return;
    const v = parseAngka(draf);
    let akhir = value;
    if (v !== null && (v < min || v > max)) akhir = terapkan(v, draf);
    setDraf(tetapFokus ? polos(akhir) : null);
  };
  const langkahi = (arah: number) => {
    const nv = keLangkah(value + arah * step, rentang);
    kirim(nv);
    setCatatan(null);
    setDraf(polos(nv));
  };

  const ketik = parseAngka(draf ?? "");
  const salahKetik = draf !== null && draf.trim() !== "" && ketik === null;
  const luarRentang = draf !== null && ketik !== null && (ketik < min || ketik > max);
  const tampilCatatan =
    catatan !== null && catatan.nilai === value && !luarRentang && !salahKetik;
  const satuan = unit ? ` ${unit}` : "";
  const angkaTafsir = (v: number) =>
    v.toLocaleString(getNumberLocale(), { maximumFractionDigits: 6, useGrouping: false });
  let teksCatatan = "";
  if (luarRentang) teksCatatan = `${t.inOutOfRange} ${fmt(min, digits)}–${fmt(max, digits)}${satuan}`;
  else if (salahKetik) teksCatatan = t.inNotNumber;
  else if (tampilCatatan && catatan) {
    const nilai = `${fmt(catatan.nilai, digits)}${satuan}`;
    const ubah =
      catatan.jenis === "potong"
        ? `${t.inClampedTo} ${nilai}`
        : catatan.jenis === "bulat"
          ? `${t.inRoundedTo} ${nilai}`
          : "";
    teksCatatan =
      catatan.tafsir !== undefined
        ? `${t.inReadAs} ${angkaTafsir(catatan.tafsir)}${ubah ? `, ${ubah}` : ""}`
        : ubah;
  }
  // Lebar kotak menurut angka terpanjang di rentangnya, supaya kolom nilai
  // tidak melebar dan tidak bergoyang saat angkanya berubah. Yang diukur
  // dua bentuk: tampilan diam (fmt, dengan pemisah ribuan "1.200") dan
  // bentuk saat disunting (polos, "1200"). Dulu hanya bentuk polos yang
  // diukur, sehingga "1.200" terpotong menjadi "1.20".
  const lebarKotak = Math.max(
    fmt(min, digits).length,
    fmt(max, digits).length,
    polos(min).length,
    polos(max).length,
    3
  );

  return (
    <tr>
      <td
        className="value font-semibold"
        style={{ color: tint ?? "var(--color-ink)" }}
      >
        {symbol}
      </td>
      <td className="text-ink-2">{label}</td>
      <td className="pr-4">
        <input
          type="range"
          min={minGeser}
          max={maxGeser}
          step={step}
          value={value}
          onChange={(e) => {
            lingkup?.touch();
            setCatatan(null);
            onChange(Math.min(max, Math.max(min, parseFloat(e.target.value))));
          }}
          aria-label={label}
          aria-valuetext={`${fmt(value, digits)}${unit ? ` ${unit}` : ""}`}
          style={
            { "--slider-tint": tint ?? "var(--color-ink)" } as React.CSSProperties
          }
        />
      </td>
      <td className="n whitespace-nowrap">
        {editable ? (
          <input
            type="text"
            /* Papan angka iOS untuk "decimal" tidak punya tanda minus. */
            inputMode={min < 0 ? "text" : "decimal"}
            autoComplete="off"
            spellCheck={false}
            aria-label={`${label} ${t.inValueSuffix}`}
            aria-invalid={salahKetik || luarRentang || undefined}
            aria-describedby={teksCatatan ? idCatatan : undefined}
            title={`${t.inRangeHint} ${fmt(min, digits)} ${t.inRangeTo} ${fmt(max, digits)}${satuan}`}
            value={draf ?? fmt(value, digits)}
            onFocus={(e) => {
              fokus.current = true;
              awal.current = value;
              setDraf(polos(value));
              e.currentTarget.select();
            }}
            onBlur={() => {
              fokus.current = false;
              selesai(false);
            }}
            onChange={(e) => {
              const teks = e.target.value;
              const v = parseAngka(teks);
              if (v !== null && v >= min && v <= max) {
                terapkan(v, teks);
                setDraf(fokus.current ? teks : null);
              } else if (fokus.current || v === null) {
                setCatatan(null);
                setDraf(teks);
              } else {
                // Diisi tanpa fokus (skrip atau alat uji): tidak akan ada
                // blur yang menyusul, jadi langsung dipotong dan ditandai.
                terapkan(v, teks);
                setDraf(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                selesai(true);
              } else if (e.key === "Escape") {
                e.preventDefault();
                kirim(awal.current);
                setCatatan(null);
                setDraf(polos(awal.current));
              } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                langkahi((e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1));
              }
            }}
            className="label border-0 border-b border-rule-strong bg-transparent px-0.5 py-0 text-right text-[16px] font-semibold text-ink transition-colors hover:border-ink focus:border-ink sm:text-[0.84rem]"
            style={{
              width: `calc(${lebarKotak}ch + 0.6rem)`,
              borderBottomColor: salahKetik || luarRentang ? "var(--color-signal)" : undefined,
            }}
          />
        ) : (
          <span className="font-semibold">{fmt(value, digits)}</span>
        )}
        {unit && <span className="ml-1 text-[0.72rem] text-ink-3">{unit}</span>}
        <span id={idCatatan} role="status" className="block whitespace-normal">
          {teksCatatan && (
            <span
              className="label mt-0.5 inline-flex items-center gap-1 text-[0.68rem] leading-tight"
              style={{
                color: luarRentang ? "var(--color-signal)" : "var(--color-ink-2)",
              }}
            >
              {luarRentang && (
                <span
                  aria-hidden="true"
                  className="inline-block h-1 w-1 shrink-0"
                  style={{ background: "currentColor", transform: "rotate(45deg)" }}
                />
              )}
              {teksCatatan}
            </span>
          )}
        </span>
      </td>
    </tr>
  );
}

/**
 * Membaca ketikan angka. Koma dan titik sama-sama diterima sebagai tanda
 * desimal; pemisah ribuan tidak, karena kotaknya tidak pernah menuliskannya
 * saat disunting. Minus tipografi (−) dianggap minus biasa.
 */
export function parseAngka(teks: string): number | null {
  const s = teks.replace(/\s/g, "").replace(/[−–]/g, "-").replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  return Number(s);
}

/* ------------------------------------------------------------------ *
 * Tabel hasil
 * ------------------------------------------------------------------ */

export type ResultRow = {
  symbol?: string;
  label: string;
  value: string;
  unit?: string;
  tint?: string;
  strong?: boolean;
};

export type BigResultItem = {
  symbol?: string;
  label: string;
  value: string;
  unit?: string;
  tint?: string;
};

/**
 * Angka utama lembar, ditulis besar.
 *
 * Bentuknya meminjam sel kop gambar: petak bergaris rambut di dalam satu
 * bingkai tinta, label kecil di atas, angka di bawah. Ini angka yang
 * dicari orang saat membuka lembar, jadi ukurannya yang membedakan, bukan
 * kotak atau bayangan.
 */
export function BigResult({ items }: { items: BigResultItem[] }) {
  if (items.length === 0) return null;
  return (
    /* flex-wrap dengan sel yang tumbuh: baris terakhir yang berisi lebih
       sedikit kartu ikut melebar, jadi tidak ada petak kosong bergaris
       latar seperti pada grid. */
    <dl className="flex flex-wrap gap-px border border-ink bg-rule">
      {items.map((it, i) => (
        <div key={i} className="flex min-w-0 flex-[1_1_8.5rem] flex-col bg-sheet px-3 py-2">
          <dt className="label flex items-baseline gap-1.5 text-[0.72rem] leading-tight text-ink-2">
            {it.symbol && (
              <span
                className="value font-semibold"
                style={{ color: it.tint ?? "var(--color-ink)" }}
              >
                {it.symbol}
              </span>
            )}
            <span className="min-w-0">{it.label}</span>
          </dt>
          <dd className="value label mt-1 flex flex-wrap items-baseline gap-x-1 leading-none">
            <span
              className="text-[1.62rem] font-semibold tracking-[-0.01em]"
              style={{ color: it.tint ?? "var(--color-ink)" }}
            >
              {it.value}
            </span>
            {it.unit && <span className="text-[0.78rem] text-ink-3">{it.unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ResultTable({
  rows: semua,
  caption,
  big = true,
}: {
  caption?: string;
  rows: ResultRow[];
  /**
   * Baris `strong` dikeluarkan dari tabel dan ditulis besar di atasnya
   * (BigResult). Matikan bila angka utamanya sudah ditulis besar di tempat
   * lain atau tabelnya hanya pelengkap.
   */
  big?: boolean;
}) {
  const t = str(useLang().lang);
  const utama = big ? semua.filter((r) => r.strong) : [];
  const rows = big ? semua.filter((r) => !r.strong) : semua;

  if (utama.length > 0) {
    return (
      <div className="flex flex-col gap-3">
        <BigResult items={utama} />
        {rows.length > 0 && (
          <ResultTable rows={rows} caption={caption} big={false} />
        )}
      </div>
    );
  }

  return (
    <table className="data">
      <thead>
        <tr>
          <th style={{ width: "2.6rem" }}>{t.thSym}</th>
          <th>{caption ?? t.thComputed}</th>
          <th className="n" style={{ width: "7.2rem" }}>
            {t.thValue}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td
              className="value font-semibold"
              style={{ color: r.tint ?? "var(--color-ink-3)" }}
            >
              {r.symbol ?? ""}
            </td>
            <td className="text-ink-2">{r.label}</td>
            <td className="n whitespace-nowrap">
              <span
                className={r.strong ? "text-[0.98rem] font-semibold" : "font-semibold"}
                style={{ color: r.tint ?? "var(--color-ink)" }}
              >
                {r.value}
              </span>
              {r.unit && (
                <span className="ml-1 text-[0.72rem] text-ink-3">{r.unit}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------------ *
 * Blok
 * ------------------------------------------------------------------ */

export function Block({
  heading,
  children,
  tint,
}: {
  heading: string;
  children: ReactNode;
  tint?: string;
}) {
  const [gen, setGen] = useState(0);
  const touch = useCallback(() => setGen((g) => g + 1), []);
  const lingkup = useMemo(() => ({ gen, touch }), [gen, touch]);

  return (
    <PresetContext.Provider value={lingkup}>
      <section className="border-t border-ink pt-2.5">
        <h2
          className="stencil mb-2"
          style={tint ? { color: tint } : undefined}
        >
          {heading}
        </h2>
        {children}
      </section>
    </PresetContext.Provider>
  );
}

/** Catatan naratif. Serif, karena ini kalimat yang dibaca, bukan data. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-[62ch] text-[0.94rem] leading-[1.6] text-ink-2">
      {children}
    </p>
  );
}

/**
 * Istilah teknis yang diwarnai sama persis dengan objeknya di gambar.
 * Dengan begini kalimat penjelas berperan sebagai legenda, sehingga
 * tidak perlu kotak legenda terpisah.
 */
export function Term({
  children,
  tint,
}: {
  children: ReactNode;
  tint: string;
}) {
  return (
    <span style={{ color: tint }} className="font-semibold">
      {children}
    </span>
  );
}

/** Penanda kondisi. Satu-satunya tempat merah sinyal boleh muncul. */
export function Flag({
  children,
  tint,
  alert = false,
}: {
  children: ReactNode;
  tint?: string;
  alert?: boolean;
}) {
  const color = alert ? "var(--color-signal)" : (tint ?? "var(--color-ink-2)");
  return (
    <span
      className="stencil inline-flex items-center gap-2 border px-2 py-1"
      style={{ color, borderColor: color }}
    >
      {alert && (
        <span
          aria-hidden="true"
          className="inline-block h-1.5 w-1.5"
          style={{ background: color, transform: "rotate(45deg)" }}
        />
      )}
      {children}
    </span>
  );
}

export function PresetRow({
  label,
  presets,
  /**
   * Nomor tombol yang menyala, ditentukan lembarnya sendiri.
   *
   * Dipakai untuk deret yang menyatakan PILIHAN, misalnya jenis akuifer
   * atau ada tidaknya tekanan angkat, bukan yang menyatakan satu keadaan
   * contoh. Pilihan seperti itu tetap berlaku sesudah penggesernya diubah
   * dan sudah punya nilainya sejak lembar dibuka, jadi lembarnya yang tahu
   * mana yang menyala, bukan riwayat penekanan tombolnya.
   */
  active,
  /**
   * Isi tabel data lembar saat ini, untuk contoh yang juga memasang data
   * (bidang `data` pada tombolnya). Tanda contoh itu padam begitu isinya
   * berbeda. Tabel data ada di blok lain, jadi geseran pencacah blok ini
   * tidak melihat perubahannya: tanpa ini, unggah berkas penampang
   * membiarkan "Sungai alam, data cl42" tetap menyala (uji rekan V8).
   */
  dataKey,
}: {
  label: string;
  presets: { label: string; apply: () => void; data?: string }[];
  active?: number;
  dataKey?: string;
}) {
  const lingkup = useContext(PresetContext);
  const [dipakai, setDipakai] = useState<{ i: number; gen: number } | null>(
    null
  );

  const menyala = (i: number) =>
    active !== undefined
      ? active === i
      : dipakai !== null &&
        dipakai.i === i &&
        dipakai.gen === (lingkup?.gen ?? 0) &&
        (presets[i].data === undefined || presets[i].data === dataKey);

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
      <span className="stencil">{label}</span>
      {presets.map((p, i) => {
        const nyala = menyala(i);
        return (
          <button
            key={i}
            type="button"
            aria-pressed={nyala}
            onClick={() => {
              p.apply();
              setDipakai({ i, gen: lingkup?.gen ?? 0 });
            }}
            className={`label inline-flex items-center gap-1.5 pb-px text-[0.8rem] transition-colors ${
              nyala
                ? "border-b-2 border-ink font-semibold text-ink"
                : "border-b border-rule-strong text-ink-2 hover:border-ink hover:text-ink"
            }`}
          >
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 transition-opacity"
              style={{
                background: "var(--color-ink)",
                transform: "rotate(45deg)",
                opacity: nyala ? 1 : 0,
              }}
            />
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Kartu keadaan
 * ------------------------------------------------------------------ */

/**
 * Keadaan lembar saat ini, lalu hal yang perlu diperhatikan karenanya.
 *
 * Dipisah dua karena dibaca dengan dua cara: kalimat keadaan menjawab
 * "aliran ini apa", butir-butirnya menjawab "lalu apa akibatnya". Garis
 * kiri berwarna nada keadaan, sama dengan warna objeknya di gambar, jadi
 * kartu ini terbaca sebagai bagian dari kosakata gambar, bukan hiasan.
 */
export function StateCard({
  tone = "neutral",
  badge,
  state,
  notice,
}: {
  tone?: Tone;
  badge?: ReactNode;
  state: ReactNode;
  notice?: ReactNode | ReactNode[];
}) {
  const t = str(useLang().lang);
  const id = useId();
  const warna = TONE[tone].line;
  const butir = (Array.isArray(notice) ? notice : notice ? [notice] : []).filter(
    (n) => n !== null && n !== undefined && n !== false && n !== ""
  );

  return (
    <section
      aria-labelledby={id}
      className="border border-rule-strong bg-sheet"
      style={{ borderLeft: `2px solid ${warna}` }}
    >
      <div className="px-3.5 pb-3 pt-2.5">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <h2 id={id} className="stencil">
            {t.stateNow}
          </h2>
          {badge && (
            <Flag tint={warna} alert={tone === "invalid"}>
              {badge}
            </Flag>
          )}
        </div>
        <div className="max-w-[62ch] text-[0.94rem] leading-[1.58] text-ink">{state}</div>
      </div>
      {butir.length > 0 && (
        <div className="border-t border-rule px-3.5 pb-3 pt-2.5">
          <h3 className="stencil mb-1.5">{t.blkNotice}</h3>
          <ul className="flex max-w-[62ch] list-none flex-col gap-1.5">
            {butir.map((b, i) => (
              <li
                key={i}
                className="grid grid-cols-[0.9rem_1fr] text-[0.9rem] leading-[1.55] text-ink-2"
              >
                <span
                  aria-hidden="true"
                  className="mt-[0.62em] inline-block h-1 w-1 bg-ink-3"
                  style={{ transform: "rotate(45deg)" }}
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Skala rezim
 * ------------------------------------------------------------------ */

export type RegimeBand = { from: number; to: number; label: string; tone: Tone };

/** Angka ringkas untuk tanda skala: tiga angka bermakna, tanpa nol buntut. */
function angkaSkala(v: number) {
  return v.toLocaleString(getNumberLocale(), { maximumSignificantDigits: 3 });
}

/**
 * Pita mendatar yang membagi satu besaran menjadi rezim, dengan penanda
 * di nilai saat ini.
 *
 * Batas pita harus diambil dari batas yang dipakai model untuk
 * menggolongkan rezimnya, bukan dibulatkan supaya rapi; kalau tidak,
 * penanda bisa berada di pita "kritis" sementara lembar menulis
 * "subkritis". Pita sempit tetap digambar selebar aslinya; labelnya
 * pindah ke bawah pita bersama angka batasnya.
 */
export function RegimeScale({
  symbol,
  value,
  bands,
  scale = "lin",
  digits = 2,
  invalid = false,
  pesan,
}: {
  symbol: string;
  value: number;
  bands: RegimeBand[];
  scale?: "lin" | "log";
  digits?: number;
  /**
   * Nilai yang ditunjuk berada di luar rentang berlaku modelnya. Hanya
   * dengan ini skala memakai merah sinyal; nilai yang sekadar melewati
   * ujung skala tetap bernada netral.
   */
  invalid?: boolean;
  /** Teks pengganti nama rezim, misalnya alasan nilainya tidak ada. */
  pesan?: string;
}) {
  const t = str(useLang().lang);
  const lo = bands[0].from;
  const hi = bands[bands.length - 1].to;
  const log = scale === "log";
  const posisi = (v: number) => {
    if (log) {
      if (v <= 0) return -Infinity;
      return (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo));
    }
    return (v - lo) / (hi - lo);
  };

  type Ukur = { W: number; pita: number[]; gabung: number[]; angka: Record<string, number> };
  const [ukur, setUkur] = useState<Ukur | null>(null);
  const wadah = useRef<HTMLDivElement>(null);
  const lapisUkur = useRef<HTMLDivElement>(null);

  const sah = Number.isFinite(value);
  const p = sah ? posisi(value) : NaN;
  const luar = sah && (p < 0 || p > 1);
  const pTampil = Math.min(1, Math.max(0, p));
  const kini = sah && !luar ? bands.find((b) => value >= b.from && value <= b.to) : undefined;
  const nadaLuar = invalid ? TONE.invalid.line : TONE.neutral.line;
  const warnaPenanda = invalid ? TONE.invalid.line : luar ? TONE.neutral.line : "var(--color-ink)";
  const teksKanan = pesan ?? (luar ? t.offScale : undefined);
  const persen = (x: number) => `${(x * 100).toFixed(3)}%`;

  /* Tanda di bawah pita: ujung skala, batas antarpita, dan dekade untuk
     skala log. Pita yang labelnya tidak muat di dalam pitanya disebut
     sempit; labelnya pindah ke bawah pita sebagai satu tanda gabungan
     "label a–b", menggantikan dua angka batasnya.

     Dulu sempit atau tidaknya ditebak dari pecahan lebar skala (12 %) dan
     tanda gabungan semuanya ditulis di satu baris. Pita sempit yang
     berderet (Berombak, Lemah, Berosilasi di OC-01; Mulut terendam dan
     HW/D di gorong-gorong) jadi saling menimpa. Sekarang lebar teks dan
     lebar skala diukur di layar: pita sempit bila labelnya tidak muat,
     angka batas menempati baris pertama, dan tanda gabungan disusun di
     baris pertama sampai ketiga tanpa tumpang tindih. Tanda gabungan pita
     yang sedang ditunjuk ditempatkan lebih dulu, jadi selalu tampil; yang
     tidak kebagian tempat tetap terbaca lewat title di pitanya. */
  type Jenis = "ujung" | "batas" | "pita" | "dekade";
  type Tanda = { at: number; teks: string; jenis: Jenis; warna?: string; aktif?: boolean };
  const SEMPIT = 0.12;
  const lebarPita = (i: number) => posisi(bands[i].to) - posisi(bands[i].from);
  const teksGabung = (b: RegimeBand) => `${b.label} ${angkaSkala(b.from)}–${angkaSkala(b.to)}`;
  const sempit = (i: number) => {
    if (bands.length < 2) return false;
    // Sebelum diukur: aturan lama, pita ujung tidak pernah sempit.
    if (!ukur) return i > 0 && i < bands.length - 1 && lebarPita(i) < SEMPIT;
    // Sesudah diukur, pita ujung juga (dulu labelnya terpotong, misalnya
    // "Dalam batas la" di HS-05 pada 390 px). Label di dalam pita berjarak
    // px-1 (4 px) di kedua sisi.
    return lebarPita(i) * ukur.W < (ukur.pita[i] ?? 0) + 10;
  };
  const batas: Tanda[] = [];
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    if (sempit(i)) {
      batas.push({
        at: (posisi(b.from) + posisi(b.to)) / 2,
        teks: teksGabung(b),
        jenis: "pita",
        warna: TONE[b.tone].line,
        aktif: b === kini,
      });
    } else if (i > 0 && !sempit(i - 1)) {
      batas.push({ at: posisi(b.from), teks: angkaSkala(b.from), jenis: "batas" });
    }
  }
  const ujung: Tanda[] = [
    { at: 0, teks: angkaSkala(lo), jenis: "ujung" },
    { at: 1, teks: angkaSkala(hi), jenis: "ujung" },
  ];
  const dekade: Tanda[] = [];
  if (log) {
    for (let e = Math.ceil(Math.log10(lo)); e <= Math.floor(Math.log10(hi)); e++) {
      const at = posisi(10 ** e);
      if (at > 0.001 && at < 0.999) dekade.push({ at, teks: angkaSkala(10 ** e), jenis: "dekade" });
    }
  }

  /* Semua teks yang mungkin tampil di bawah dan di dalam pita, untuk
     diukur di lapisan tak terlihat. */
  const angkaUkur = Array.from(
    new Set([
      angkaSkala(lo),
      angkaSkala(hi),
      ...bands.map((b) => angkaSkala(b.from)),
      ...dekade.map((d) => d.teks),
    ])
  );
  const kunciUkur = [
    ...bands.map((b) => `${b.label}|${teksGabung(b)}`),
    ...angkaUkur,
  ].join("~");

  type Letak = Tanda & { x?: number; w?: number; baris: number };
  let letak: Letak[];
  let banyakBaris = 1;
  if (!ukur) {
    // Sebelum diukur (render server): aturan lama, satu baris.
    const jauh = (a: Tanda, daftar: Tanda[], jarak: number) =>
      daftar.every((b) => Math.abs(a.at - b.at) >= jarak);
    const batasDipakai = batas.filter((a) => jauh(a, ujung, 0.1));
    letak = [
      ...ujung,
      ...batasDipakai,
      ...dekade.filter((a) => jauh(a, [...ujung, ...batasDipakai], 0.12)),
    ].map((d) => ({ ...d, baris: 0 }));
  } else {
    const { W } = ukur;
    const JARAK = 6;
    const MAKS_BARIS = 3;
    const lebarTeks = (d: Tanda) =>
      d.jenis === "pita"
        ? ukur.gabung[bands.findIndex((b) => teksGabung(b) === d.teks)] ?? 0
        : ukur.angka[d.teks] ?? d.teks.length * 6;
    const baris: { x: number; w: number }[][] = Array.from({ length: MAKS_BARIS }, () => []);
    const muat = (r: number, x: number, w: number) =>
      baris[r].every((o) => x + w + JARAK <= o.x || o.x + o.w + JARAK <= x);
    const pita = batas.filter((d) => d.jenis === "pita");
    const urutan: Tanda[] = [
      ...ujung,
      ...batas.filter((d) => d.jenis === "batas"),
      ...pita.filter((d) => d.aktif),
      ...pita.filter((d) => !d.aktif),
      ...dekade,
    ];
    letak = [];
    for (const d of urutan) {
      const w = lebarTeks(d);
      const x =
        d.at <= 0.001 ? 0 : d.at >= 0.999 ? W - w : Math.min(W - w, Math.max(0, d.at * W - w / 2));
      const pilihan = d.jenis === "pita" ? [0, 1, 2] : [0];
      const r = pilihan.find((k) => muat(k, x, w));
      if (r === undefined) continue;
      baris[r].push({ x, w });
      letak.push({ ...d, x, w, baris: r });
      banyakBaris = Math.max(banyakBaris, r + 1);
    }
  }
  const TINGGI_BARIS = 13;
  const atasBaris = (r: number) => 4 + r * TINGGI_BARIS;
  /* Garis penunjuk dari pita ke tanda gabungan yang turun ke baris bawah,
     hanya bila tidak menembus tanda di baris atasnya. */
  const penunjuk = letak.filter(
    (d) =>
      ukur &&
      d.jenis === "pita" &&
      d.baris > 0 &&
      letak.every(
        (o) =>
          o.baris >= d.baris ||
          o.x === undefined ||
          o.w === undefined ||
          d.at * ukur.W < o.x - 2 ||
          d.at * ukur.W > o.x + o.w + 2
      )
  );

  useLayoutEffect(() => {
    const el = wadah.current;
    const lapis = lapisUkur.current;
    if (!el || !lapis) return;
    let aktif = true;
    const hitung = () => {
      if (!aktif) return;
      const lebar = (jenis: string) =>
        Array.from(lapis.querySelectorAll<HTMLElement>(`[data-u="${jenis}"]`)).map(
          (e) => e.getBoundingClientRect().width
        );
      const angka: Record<string, number> = {};
      lapis.querySelectorAll<HTMLElement>('[data-u="angka"]').forEach((e) => {
        angka[e.textContent ?? ""] = e.getBoundingClientRect().width;
      });
      const baru: Ukur = { W: el.clientWidth, pita: lebar("pita"), gabung: lebar("gabung"), angka };
      setUkur((lama) => (lama && JSON.stringify(lama) === JSON.stringify(baru) ? lama : baru));
    };
    hitung();
    const ro = new ResizeObserver(hitung);
    ro.observe(el);
    document.fonts?.ready.then(hitung);
    return () => {
      aktif = false;
      ro.disconnect();
    };
  }, [kunciUkur]);

  const ringkas = `${symbol} = ${sah ? fmt(value, digits) : "—"}${
    pesan ? `, ${pesan}` : kini ? `, ${kini.label}` : luar ? `, ${t.offScale}` : ""
  }`;

  return (
    <div
      role="group"
      aria-label={ringkas}
      className="border border-rule-strong bg-sheet px-3.5 pb-1.5 pt-2.5"
    >
      <div className="label flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="value text-[0.98rem] font-semibold text-ink">
          {symbol} = {sah ? fmt(value, digits) : "—"}
        </span>
        {kini && !pesan && (
          <span className="stencil" style={{ color: TONE[kini.tone].line }}>
            {kini.label}
          </span>
        )}
        {teksKanan && (
          <span
            className="stencil inline-flex items-center gap-1.5"
            style={{ color: nadaLuar }}
          >
            {invalid && (
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5"
                style={{ background: "currentColor", transform: "rotate(45deg)" }}
              />
            )}
            {teksKanan}
          </span>
        )}
      </div>

      <div ref={wadah} aria-hidden="true" className="relative mt-1.5">
        {/* Lapisan ukur: teks yang sama dengan kelas yang sama, tak terlihat,
            untuk mengukur lebarnya sebelum disusun. */}
        <div
          ref={lapisUkur}
          className="pointer-events-none invisible absolute left-0 top-0 h-0 overflow-hidden"
        >
          {bands.map((b, i) => (
            <span
              key={`p${i}`}
              data-u="pita"
              className="label absolute whitespace-nowrap text-[0.68rem] font-semibold leading-none"
            >
              {b.label}
            </span>
          ))}
          {bands.map((b, i) => (
            <span
              key={`g${i}`}
              data-u="gabung"
              className="label value absolute whitespace-nowrap text-[0.66rem] font-semibold leading-none"
            >
              {teksGabung(b)}
            </span>
          ))}
          {angkaUkur.map((a) => (
            <span
              key={`a${a}`}
              data-u="angka"
              className="label value absolute whitespace-nowrap text-[0.66rem] leading-none"
            >
              {a}
            </span>
          ))}
        </div>
        {/* Penanda: segitiga di atas pita, garis tipis menembus pita. */}
        <div className="relative h-[7px]">
          {sah && (
            <span
              className="absolute top-0 h-0 w-0"
              style={{
                left: persen(pTampil),
                transform: "translateX(-50%)",
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: `7px solid ${warnaPenanda}`,
              }}
            />
          )}
        </div>
        {/* Pita dipudarkan bila nilainya tidak berlaku: rezimnya tidak
            bermakna, tetapi letak batasnya tetap terbaca. */}
        <div
          className="relative h-6 border border-ink-3"
          style={invalid ? { opacity: 0.4 } : undefined}
        >
          {bands.map((b, i) => {
            const a = posisi(b.from);
            const z = posisi(b.to);
            const nada = TONE[b.tone];
            return (
              <div
                key={i}
                title={teksGabung(b)}
                className="absolute inset-y-0 overflow-hidden"
                style={{
                  left: persen(a),
                  width: persen(z - a),
                  background: nada.fill,
                  borderLeft: i > 0 ? `1px solid ${nada.line}` : undefined,
                  borderRight: sempit(i) ? `1px solid ${nada.line}` : undefined,
                }}
              >
                {!sempit(i) && (
                  /* Huruf biasa, bukan stensil kapital: pita paling sempit
                     yang masih diberi label hanya sekitar 80 px pada layar
                     390 px, dan "SUPERKRITIS" berjarak huruf tidak muat. */
                  <span
                    className="label absolute top-1/2 -translate-y-1/2 whitespace-nowrap px-1 text-[0.68rem] font-semibold leading-none"
                    style={{
                      color: nada.line,
                      ...(i === bands.length - 1 && bands.length > 1
                        ? { right: 0 }
                        : { left: 0 }),
                    }}
                  >
                    {b.label}
                  </span>
                )}
              </div>
            );
          })}
          {sah && (
            <span
              className="absolute inset-y-0 w-px"
              style={{ left: persen(pTampil), background: warnaPenanda }}
            />
          )}
        </div>
        <div
          className="relative"
          style={{ height: atasBaris(banyakBaris) + 3 }}
        >
          {penunjuk.map((d, i) => (
            <span
              key={`l${i}`}
              className="absolute top-0 w-px"
              style={{
                left: persen(d.at),
                height: atasBaris(d.baris) - 1,
                background: d.warna,
                opacity: 0.6,
              }}
            />
          ))}
          {letak.map((d, i) => (
            <span
              key={i}
              className="label value absolute whitespace-nowrap text-[0.66rem] leading-none"
              style={{
                top: atasBaris(d.baris),
                ...(d.x !== undefined
                  ? { left: d.x }
                  : {
                      left: persen(d.at),
                      transform:
                        d.at <= 0.001
                          ? "none"
                          : d.at >= 0.999
                            ? "translateX(-100%)"
                            : "translateX(-50%)",
                    }),
                color: d.warna ?? "var(--color-ink-3)",
                fontWeight: d.warna ? 600 : 400,
              }}
            >
              {d.teks}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Hitungan langkah demi langkah
 * ------------------------------------------------------------------ */

export type LangkahHitung = {
  judul?: string;
  /** Rumus simbolik, misalnya <>q = <Frac num="Q" den="b" /></> */
  rumus: ReactNode;
  /** Rumus yang sama dengan angka lembar dimasukkan, sudah diformat. */
  isi: string;
  /** Hasil, diformat sama persis dengan tabel hasil. */
  hasil: string;
  satuan?: string;
  tint?: string;
};

/**
 * Hitungan yang bisa dibuka.
 *
 * Angka di sini wajib angka yang SAMA dengan yang tampil di tabel hasil,
 * bukan hitungan ulang dengan rumus lain; kalau berbeda satu angka saja di
 * belakang koma, pembaca akan percaya salah satunya salah. Substitusinya
 * ditulis huruf mono seperti blok rumus regresi supaya terbaca sebagai
 * baris kalkulator, bukan kalimat.
 */
export function Hitungan({
  langkah,
  terbuka = false,
}: {
  langkah: LangkahHitung[];
  terbuka?: boolean;
}) {
  const t = str(useLang().lang);
  const [buka, setBuka] = useState(terbuka);
  const id = useId();

  return (
    <div>
      <button
        type="button"
        aria-expanded={buka}
        aria-controls={id}
        onClick={() => setBuka((b) => !b)}
        className="label inline-flex items-center gap-2 border-b border-rule-strong pb-px text-[0.8rem] text-ink-2 transition-colors hover:border-ink hover:text-ink"
      >
        <span
          aria-hidden="true"
          className="inline-block h-0 w-0 transition-transform"
          style={{
            borderTop: "4px solid transparent",
            borderBottom: "4px solid transparent",
            borderLeft: "6px solid currentColor",
            transform: buka ? "rotate(90deg)" : "none",
          }}
        />
        {buka ? t.hideCalc : t.showCalc}
      </button>

      <ol id={id} hidden={!buka} className="mt-3 flex list-none flex-col gap-3">
        {langkah.map((l, i) => (
          <li key={i} className="grid grid-cols-[1.6rem_minmax(0,1fr)]">
            <span className="value label pt-0.5 text-[0.72rem] text-ink-3">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 border-l border-rule-strong pl-3">
              {l.judul && (
                <div className="label mb-1 text-[0.74rem] text-ink-2">{l.judul}</div>
              )}
              <div className="label value overflow-x-auto overflow-y-hidden text-[0.9rem] text-ink">
                <div className="flex min-w-max items-center gap-1">{l.rumus}</div>
              </div>
              <div className="overflow-x-auto overflow-y-hidden">
                <code className="value block min-w-max py-0.5 text-[0.8rem] leading-snug text-ink-2">
                  = {l.isi}
                </code>
              </div>
              <div className="label value text-[0.9rem]">
                ={" "}
                <span className="font-semibold" style={{ color: l.tint ?? "var(--color-ink)" }}>
                  {l.hasil}
                </span>
                {l.satuan && <span className="ml-1 text-[0.74rem] text-ink-3">{l.satuan}</span>}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
