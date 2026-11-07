"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useLang, type Bi } from "@/lib/i18n";
import { TONE } from "@/lib/theme";
import { benihAcak, fmtL } from "@/lib/kuis";
import { barisEkspor, buatRng, type KolomEkspor, type Rng } from "@/lib/praktikum";
import { downloadCsv, downloadXlsx } from "@/lib/exportChart";
import { Hitungan, ResultTable, parseAngka, type LangkahHitung, type ResultRow } from "./ui";
import { useResetGuard } from "./ResetScope";

/*
 * Lembar pengamatan mode praktikum (Phase 3, P1).
 *
 * Bentuknya buku catatan praktikum: tombol Catat bacaan membaca keadaan
 * lembar saat itu lewat `catat(rng)` (nilai benar + galat baca alat dari
 * praktikum.ts), lalu menambah satu baris. Kolom hitungan, ringkasan, dan
 * langkah hitung dihitung ulang dari baris yang ada, jadi menghapus satu
 * baris langsung mengubah ringkasan.
 *
 * Data hanya di state komponen: tidak ada localStorage atau server. Memuat
 * ulang halaman menghapusnya, dan itu ditulis di lembar. Reset lembar (dan
 * tombol Kosongkan tabel) meminta konfirmasi bila ada baris.
 *
 * Benih: dipilih acak di peramban sesudah dipasang (bukan saat render server,
 * supaya tidak berbeda dengan hasil hidrasi), disimpan di state dan ditulis
 * di layar. Benih yang sama dengan urutan keadaan lembar yang sama memberi
 * bacaan yang sama persis. Benih hanya boleh diganti saat tabel kosong;
 * mengosongkan tabel memulai deret benih yang sama dari awal.
 *
 * Nomor bacaan adalah urutan pencatatan dan tidak dipakai ulang sesudah
 * baris dihapus, supaya berkas ekspor tetap bisa dicocokkan dengan catatan
 * tangan.
 */

export type KolomPraktikum<R> = KolomEkspor<R> & { digits: number; tint?: string };

const TXT = {
  id: {
    heading: "Lembar pengamatan",
    benih: "Benih",
    benihTitle: "Benih acak galat baca. Benih yang sama dengan urutan bacaan yang sama memberi angka yang sama.",
    benihBaru: "Benih baru",
    benihKunci: "Benih hanya bisa diganti saat tabel kosong.",
    pakaiBenih: "Ulangi dengan benih",
    pakai: "Pakai",
    benihSalah: "Tulis bilangan bulat 1 sampai 4294967295.",
    benihDipakai: (b: number) => `Benih ${b} dipakai.`,
    catat: "Catat bacaan",
    catatTitle: "Baca alat pada keadaan lembar sekarang dan tambahkan satu baris",
    jumlah: (n: number, m: number) => `${n} dari ${m} bacaan`,
    penuh: (m: number) => `Tabel penuh (${m} bacaan). Hapus baris atau ekspor dulu.`,
    dicatat: (no: number) => `Bacaan ${no} dicatat.`,
    dihapus: (no: number) => `Bacaan ${no} dihapus.`,
    dikosongkan: "Tabel pengamatan dikosongkan.",
    no: "No.",
    aksi: "Baris",
    hapus: "Hapus",
    hapusLabel: (no: number) => `Hapus bacaan ${no}`,
    tabel: "Tabel pengamatan",
    kosong: "Belum ada bacaan. Atur keadaan aliran, tekan Catat bacaan, ulangi untuk beberapa keadaan.",
    ringkasan: "Ringkasan",
    ringkasanKosong: "Ringkasan muncul sesudah bacaan pertama; simpangan perlu paling sedikit dua bacaan.",
    hitungTerakhir: (no: number) => `Hitungan bacaan ${no}`,
    prosedur: "Prosedur",
    alat: "Alat dan galat baca",
    xlsx: "Unduh .xlsx",
    csv: "Unduh .csv",
    eksporTitle: "Unduh tabel pengamatan beserta kolom hitungan",
    kosongkan: "Kosongkan tabel",
    konfirmasiKosong: (n: number) =>
      `Hapus ${n} bacaan di tabel pengamatan? Bacaan yang belum diekspor tidak bisa dikembalikan.`,
    konfirmasiReset: (n: number) =>
      `Tabel pengamatan berisi ${n} bacaan. Reset mengosongkannya dan mengembalikan semua masukan ke nilai awal. Bacaan yang belum diekspor tidak bisa dikembalikan. Lanjutkan?`,
    sementara:
      "Bacaan hanya tersimpan di halaman ini. Memuat ulang atau menutup halaman menghapusnya; unduh .xlsx atau .csv untuk menyimpan.",
    gulir: "Tabel dapat digeser ke samping",
  },
  en: {
    heading: "Observation sheet",
    benih: "Seed",
    benihTitle: "Random seed for reading errors. The same seed with the same sequence of readings gives the same numbers.",
    benihBaru: "New seed",
    benihKunci: "The seed can only be changed while the table is empty.",
    pakaiBenih: "Repeat with seed",
    pakai: "Use",
    benihSalah: "Type a whole number from 1 to 4294967295.",
    benihDipakai: (b: number) => `Seed ${b} in use.`,
    catat: "Record reading",
    catatTitle: "Read the instruments at the current sheet state and add one row",
    jumlah: (n: number, m: number) => `${n} of ${m} readings`,
    penuh: (m: number) => `Table full (${m} readings). Delete a row or export first.`,
    dicatat: (no: number) => `Reading ${no} recorded.`,
    dihapus: (no: number) => `Reading ${no} deleted.`,
    dikosongkan: "Observation table cleared.",
    no: "No.",
    aksi: "Row",
    hapus: "Delete",
    hapusLabel: (no: number) => `Delete reading ${no}`,
    tabel: "Observation table",
    kosong: "No readings yet. Set the flow, press Record reading, and repeat for several flows.",
    ringkasan: "Summary",
    ringkasanKosong: "The summary appears after the first reading; the spread needs at least two readings.",
    hitungTerakhir: (no: number) => `Working for reading ${no}`,
    prosedur: "Procedure",
    alat: "Instruments and reading error",
    xlsx: "Download .xlsx",
    csv: "Download .csv",
    eksporTitle: "Download the observation table with the computed columns",
    kosongkan: "Clear table",
    konfirmasiKosong: (n: number) =>
      `Delete ${n} readings from the observation table? Readings not yet exported cannot be recovered.`,
    konfirmasiReset: (n: number) =>
      `The observation table holds ${n} readings. Reset clears it and returns every input to its starting value. Readings not yet exported cannot be recovered. Continue?`,
    sementara:
      "Readings live only on this page. Reloading or closing the page deletes them; download .xlsx or .csv to keep them.",
    gulir: "The table scrolls sideways",
  },
} as const;

type Baris<R> = { no: number; r: R };

const BENIH_MAKS = 4294967295;

export function LembarPraktikum<R>({
  kode,
  kolom,
  kolomEkspor,
  catat,
  tolak,
  masukan,
  ringkasan,
  penanda,
  hitungan,
  grafik,
  alat,
  langkah,
  namaBerkas,
  maks = 30,
}: {
  /** Kode lembar, untuk penanda uji dan nama berkas */
  kode: string;
  /** Kolom tabel di layar (sesudah kolom No.) */
  kolom: KolomPraktikum<R>[];
  /** Kolom berkas ekspor; bawaan sama dengan kolom layar */
  kolomEkspor?: KolomPraktikum<R>[];
  /** Baca keadaan lembar + galat baca alat dengan deret acak berbenih */
  catat: (rng: Rng) => R;
  /** Alasan bacaan tidak bisa dicatat sekarang; kosong = boleh */
  tolak?: string | null;
  /** Kendali keadaan aliran di dekat tombol catat (penggeser yang sama dengan lembar) */
  masukan?: ReactNode;
  ringkasan?: (rows: R[]) => ResultRow[];
  /** Kalimat penanda di bawah ringkasan (geometri campur, di luar skala alat) */
  penanda?: (rows: R[]) => string[];
  /** Langkah hitung dengan angka bacaan terakhir; `rows` = semua baris (mis. integral seri) */
  hitungan?: (r: R, rows: R[]) => LangkahHitung[];
  /** Grafik yang terbangun dari baris (profil traverse, kurva konduktivitas), di bawah tombol catat */
  grafik?: (rows: R[]) => ReactNode;
  /** Keterangan alat dan besaran galat baca */
  alat?: ReactNode;
  /** Langkah prosedur, berurutan */
  langkah?: Bi<string>[];
  /** Awal nama berkas ekspor; benih ditambahkan di belakangnya */
  namaBerkas: string;
  maks?: number;
}) {
  const { lang } = useLang();
  const x = TXT[lang];
  const idJudul = useId();
  const idBenih = useId();
  const idPesanBenih = useId();

  const [benih, setBenih] = useState<number | null>(null);
  const [rows, setRows] = useState<Baris<R>[]>([]);
  // k menaikkan kunci isi wilayah status, jadi pengumuman yang sama dua kali
  // berturut-turut (Kosongkan tabel) tetap dibacakan ulang.
  const [umum, setUmumState] = useState({ teks: "", k: 0 });
  const setUmum = (teks: string) => setUmumState((u) => ({ teks, k: u.k + 1 }));
  const [teksBenih, setTeksBenih] = useState("");
  const [pesanBenih, setPesanBenih] = useState("");
  const rng = useRef<Rng | null>(null);
  const nomor = useRef(1);
  const tombolCatat = useRef<HTMLButtonElement>(null);
  const judul = useRef<HTMLHeadingElement>(null);
  const tombolHapus = useRef(new Map<number, HTMLButtonElement>());
  const fokusKe = useRef<number | "catat" | null>(null);

  // Benih dipilih sesudah dipasang: acak di server akan berbeda saat hidrasi.
  useEffect(() => {
    const b = benihAcak();
    rng.current = buatRng(b);
    setBenih(b);
  }, []);

  useEffect(() => {
    const f = fokusKe.current;
    fokusKe.current = null;
    if (f === "catat") {
      // Tombol Catat bisa nonaktif (leher tidak menyempit, tabel penuh);
      // fokus ke tombol nonaktif hilang ke body, jadi pindah ke judul bagian.
      const t = tombolCatat.current;
      if (t && !t.disabled) t.focus();
      else judul.current?.focus();
    }
    else if (typeof f === "number") tombolHapus.current.get(f)?.focus();
  });

  const n = rows.length;
  useResetGuard(n > 0, x.konfirmasiReset(n));

  const data = useMemo(() => rows.map((b) => b.r), [rows]);
  const penuh = n >= maks;
  const bisaCatat = benih !== null && !tolak && !penuh;

  const pasangBenih = (b: number) => {
    rng.current = buatRng(b);
    nomor.current = 1;
    setBenih(b);
  };

  const tambah = () => {
    if (!bisaCatat || !rng.current) return;
    // catat dipanggil di luar updater setState: StrictMode memanggil updater
    // dua kali, dan itu akan menarik deret acak dua kali.
    const r = catat(rng.current);
    const no = nomor.current++;
    setRows((rs) => [...rs, { no, r }]);
    setUmum(x.dicatat(no));
  };

  const hapus = (no: number) => {
    const i = rows.findIndex((b) => b.no === no);
    if (i < 0) return;
    const sisa = rows.filter((b) => b.no !== no);
    setRows(sisa);
    setUmum(x.dihapus(no));
    const berikut = sisa[i] ?? sisa[i - 1];
    fokusKe.current = berikut ? berikut.no : "catat";
  };

  const kosongkan = () => {
    if (n === 0 || !window.confirm(x.konfirmasiKosong(n))) return;
    setRows([]);
    if (benih !== null) pasangBenih(benih);
    setUmum(x.dikosongkan);
    setPesanBenih("");
    fokusKe.current = "catat";
  };

  const benihBaru = () => {
    if (n > 0) return;
    const b = benihAcak();
    pasangBenih(b);
    setPesanBenih(x.benihDipakai(b));
  };

  const pakaiBenih = () => {
    if (n > 0) return;
    const v = parseAngka(teksBenih);
    if (v === null || !Number.isInteger(v) || v < 1 || v > BENIH_MAKS) {
      setPesanBenih(x.benihSalah);
      return;
    }
    pasangBenih(v);
    setTeksBenih("");
    setPesanBenih(x.benihDipakai(v));
  };

  const ekspor = (jenis: "xlsx" | "csv") => {
    const kol: KolomEkspor<Baris<R>>[] = [
      { key: "no", judul: { id: TXT.id.no, en: TXT.en.no }, digits: 0, hitung: (b) => b.no },
      ...(kolomEkspor ?? kolom).map((k) => ({
        key: k.key,
        judul: k.judul,
        satuan: k.satuan,
        digits: k.digits,
        hitung: (b: Baris<R>) => nilai(k, b.r),
      })),
    ];
    const { kepala, baris } = barisEkspor(kol, rows, lang);
    const nama = `${namaBerkas}-${lang === "en" ? "seed" : "benih"}-${benih ?? 0}`;
    if (jenis === "xlsx") downloadXlsx(kepala, baris, nama);
    else downloadCsv(kepala, baris, nama);
  };

  const hasil = ringkasan && n > 0 ? ringkasan(data) : [];
  const tanda = penanda && n > 0 ? penanda(data) : [];
  const terakhir = rows[n - 1];

  const tombolTeks =
    "label border-b border-rule-strong pb-px text-[0.8rem] text-ink-2 transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:border-rule disabled:text-ink-3";

  return (
    <section aria-labelledby={idJudul} data-praktikum={kode} className="border-t border-ink pt-2.5">
      {/* Kepala: judul dan benih. Benih ditulis seperti sel kop: angka yang
          membuat lembar ini bisa diulang. */}
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
        <h2 id={idJudul} ref={judul} tabIndex={-1} className="stencil">
          {x.heading}
        </h2>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="label text-[0.78rem] text-ink-3" title={x.benihTitle}>
            {x.benih}{" "}
            <span data-praktikum-benih className="value font-semibold text-ink">
              {benih ?? "…"}
            </span>
          </span>
          <button
            type="button"
            onClick={benihBaru}
            disabled={n > 0 || benih === null}
            title={n > 0 ? x.benihKunci : x.benihTitle}
            className={tombolTeks}
          >
            {x.benihBaru}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.62fr)_minmax(310px,0.72fr)]">
        <div className="min-w-0">
          {/* Kendali: keadaan aliran dan tombol catat berdampingan, karena
              di laboratorium keduanya dikerjakan bergantian. */}
          <div className="border border-rule-strong bg-sheet">
            {masukan && <div className="border-b border-rule px-3 pb-1 pt-1.5">{masukan}</div>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
              <button
                ref={tombolCatat}
                data-praktikum-catat
                type="button"
                onClick={tambah}
                disabled={!bisaCatat}
                aria-describedby={tolak || penuh ? `${idJudul}-tolak` : undefined}
                title={x.catatTitle}
                className="label border border-ink bg-ink px-3.5 py-1.5 text-[0.86rem] font-semibold text-sheet transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:border-rule-strong disabled:bg-transparent disabled:text-ink-3"
              >
                {x.catat}
              </button>
              <span data-praktikum-jumlah className="label value text-[0.8rem] text-ink-2">
                {x.jumlah(n, maks)}
              </span>
            </div>
            {(tolak || penuh) && (
              <p
                id={`${idJudul}-tolak`}
                className="border-t px-3 py-2 text-[0.86rem] leading-[1.45] text-ink"
                style={{ borderColor: TONE.caution.line, background: TONE.caution.fill }}
              >
                {tolak || x.penuh(maks)}
              </p>
            )}
          </div>

          {grafik && <div className="mt-4" data-praktikum-grafik>{grafik(data)}</div>}

          <p className="sr-only" role="status" aria-live="polite">
            <span key={umum.k}>{umum.teks}</span>
          </p>

          {/* Petunjuk geser hanya di layar sempit, tempat tabel melewati lebar
              layar. Pembaca layar sudah mendapatnya dari label wilayah. */}
          <p aria-hidden="true" className="label mt-4 text-[0.74rem] text-ink-3 sm:hidden">
            {x.gulir} →
          </p>

          {/* Tabel pengamatan */}
          <div
            // relative: teks sr-only (absolute) di dalam tabel ikut terpotong
            // wadah gulir, tidak melebarkan halaman di 390.
            className="relative mt-1 overflow-x-auto sm:mt-4"
            role="region"
            aria-label={`${x.tabel}. ${x.gulir}`}
            tabIndex={0}
          >
            <table className="data min-w-[34rem]" data-praktikum-tabel>
              <caption className="sr-only">{x.tabel}</caption>
              <thead>
                <tr>
                  <th className="n" style={{ ...kepalaGaya, width: "2.8rem" }} scope="col">
                    {x.no}
                  </th>
                  {kolom.map((k) => (
                    <th key={k.key} className="n" style={kepalaGaya} scope="col">
                      <span style={k.tint ? { color: k.tint } : undefined}>{k.judul[lang]}</span>
                      {k.satuan && <span className="block font-normal text-ink-3">{k.satuan[lang]}</span>}
                    </th>
                  ))}
                  <th className="n" style={{ ...kepalaGaya, width: "4.6rem" }} scope="col">
                    <span className="sr-only">{x.aksi}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {n === 0 ? (
                  <tr>
                    <td colSpan={kolom.length + 2} className="py-4 text-[0.88rem] leading-[1.5] text-ink-3" style={{ fontFamily: "inherit" }}>
                      {x.kosong}
                    </td>
                  </tr>
                ) : (
                  rows.map((b) => (
                    <tr key={b.no} data-praktikum-baris={b.no}>
                      <th scope="row" className="n value" style={{ ...kepalaGaya, borderBottom: "1px solid var(--color-rule-faint)", color: "var(--color-ink-3)" }}>
                        {b.no}
                      </th>
                      {kolom.map((k) => (
                        <td key={k.key} className="n value" style={k.tint ? { color: k.tint } : undefined}>
                          {fmtL(nilai(k, b.r), k.digits, lang)}
                        </td>
                      ))}
                      <td className="n">
                        <button
                          type="button"
                          ref={(el) => {
                            if (el) tombolHapus.current.set(b.no, el);
                            else tombolHapus.current.delete(b.no);
                          }}
                          onClick={() => hapus(b.no)}
                          aria-label={x.hapusLabel(b.no)}
                          className="label text-[0.76rem] text-ink-3 underline decoration-rule-strong underline-offset-2 hover:text-ink hover:decoration-ink"
                        >
                          {x.hapus}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-t border-rule pt-2.5">
            <button type="button" onClick={() => ekspor("xlsx")} disabled={n === 0} title={x.eksporTitle} className={tombolTeks}>
              {x.xlsx}
            </button>
            <button type="button" onClick={() => ekspor("csv")} disabled={n === 0} title={x.eksporTitle} className={tombolTeks}>
              {x.csv}
            </button>
            <button type="button" onClick={kosongkan} disabled={n === 0} className={`${tombolTeks} sm:ml-auto`}>
              {x.kosongkan}
            </button>
          </div>
          <p className="mt-2 max-w-[70ch] text-[0.84rem] leading-[1.5] text-ink-2">{x.sementara}</p>

          {/* Ringkasan */}
          {ringkasan && (
            <div className="mt-6" data-praktikum-ringkasan>
              <h3 className="stencil mb-2">{x.ringkasan}</h3>
              {n === 0 ? (
                <p className="text-[0.88rem] leading-[1.5] text-ink-3">{x.ringkasanKosong}</p>
              ) : (
                <ResultTable rows={hasil} />
              )}
              {tanda.length > 0 && (
                <ul className="mt-3 flex list-none flex-col gap-1.5">
                  {tanda.map((t, i) => (
                    <li
                      key={i}
                      className="max-w-[70ch] py-1 pl-2.5 text-[0.86rem] leading-[1.5] text-ink-2"
                      style={{ borderLeft: `2px solid ${TONE.caution.line}` }}
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              )}
              {hitungan && terakhir && (
                <div className="mt-3">
                  <p className="label mb-1.5 text-[0.74rem] text-ink-3">{x.hitungTerakhir(terakhir.no)}</p>
                  <Hitungan langkah={hitungan(terakhir.r, data)} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {langkah && langkah.length > 0 && (
            <div>
              <h3 className="stencil mb-2">{x.prosedur}</h3>
              {/* Langkah prosedur memang berurutan, jadi bernomor. */}
              <ol className="flex list-none flex-col gap-2">
                {langkah.map((l, i) => (
                  <li key={i} className="grid grid-cols-[1.6rem_minmax(0,1fr)] text-[0.9rem] leading-[1.5] text-ink-2">
                    <span className="value label pt-px text-[0.76rem] text-ink-3">{i + 1}</span>
                    <span>{l[lang]}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {alat && (
            <div>
              <h3 className="stencil mb-2">{x.alat}</h3>
              <div className="flex flex-col gap-2 text-[0.86rem] leading-[1.5] text-ink-2">{alat}</div>
            </div>
          )}

          <form
            className="border-t border-rule pt-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              pakaiBenih();
            }}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
              <label htmlFor={idBenih} className="label text-[0.8rem] text-ink-2">
                {x.pakaiBenih}
              </label>
              <input
                id={idBenih}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                value={teksBenih}
                disabled={n > 0}
                onChange={(e) => setTeksBenih(e.target.value)}
                aria-describedby={idPesanBenih}
                aria-invalid={pesanBenih === x.benihSalah ? true : undefined}
                className="label w-[11ch] border-0 border-b border-rule-strong bg-transparent px-0.5 py-0 text-right text-[16px] text-ink hover:border-ink focus:border-ink disabled:text-ink-3 sm:text-[0.86rem]"
              />
              <button type="submit" disabled={n > 0} className={tombolTeks}>
                {x.pakai}
              </button>
            </div>
            {/* Hanya pesan benih yang diumumkan; teks kunci muncul saat bacaan
                pertama dicatat dan tidak perlu dibacakan sebagai status. */}
            <p id={idPesanBenih} className="label mt-1 text-[0.74rem] leading-snug text-ink-3">
              {n > 0 && x.benihKunci}
              <span role="status">{n > 0 ? "" : pesanBenih}</span>
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}

/** Judul kolom: tanpa huruf kapital paksa (h₁, Δh, mm harus tetap). */
const kepalaGaya = { textTransform: "none", letterSpacing: "0.01em", fontSize: "0.72rem", verticalAlign: "bottom" } as const;

function nilai<R>(k: KolomEkspor<R>, r: R): number {
  const v = k.hitung ? k.hitung(r) : (r as Record<string, unknown>)[k.key];
  return typeof v === "number" ? v : Number.NaN;
}
