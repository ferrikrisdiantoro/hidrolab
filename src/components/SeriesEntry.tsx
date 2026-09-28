"use client";

import { useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
import { HARI, isoDate, parseDate } from "@/lib/forecast";

/**
 * Tabel isian deret waktu harian untuk HY-06: tanggal dan satu atau dua
 * kolom nilai (hujan, dan tinggi muka air pada mode multivariat).
 *
 * Sama dengan tabel isian lain dari cl42: baris dicentang ikut atau tidak,
 * bukan dihapus (revisi klien Rev1), dan ada tombol kosongkan semua.
 *
 * Yang khusus di sini: modelnya membaca TUJUH HARI BERURUTAN terakhir, jadi
 * tanggal yang melompat atau tidak urut mengubah arti setiap fitur. Baris
 * diurutkan menurut tanggal sebelum dihitung, dan lompatan yang bukan satu
 * hari dihitung dan ditulis, tidak dibiarkan diam.
 */

export type SeriesRow = { d: string; v: string; w?: string; on?: boolean };

export type SeriesRead = {
  t: number[];
  rain: number[];
  wl: number[];
  bad: number;
  off: number;
  gaps: number;
  dup: number;
};

const angka = (s: string | undefined) => parseFloat((s ?? "").replace(",", "."));

/** Tanggal dari berkas: 2020-12-01, 2020/12/01, atau 01/12/2020 (hari dulu) */
function tanggalBerkas(s: string): number {
  const t = s.trim().replace(/\//g, "-");
  const iso = parseDate(t);
  if (Number.isFinite(iso)) return iso;
  const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(t);
  return m ? parseDate(`${m[3]}-${m[2]}-${m[1]}`) : NaN;
}

export function readSeries(rows: SeriesRow[], dua: boolean): SeriesRead {
  const pakai: { t: number; r: number; w: number }[] = [];
  let bad = 0;
  let off = 0;
  for (const row of rows) {
    if (row.d.trim() === "" && row.v.trim() === "" && (row.w ?? "").trim() === "") continue;
    if (row.on === false) {
      off++;
      continue;
    }
    const t = parseDate(row.d);
    const r = angka(row.v);
    const w = dua ? angka(row.w) : 0;
    if (Number.isFinite(t) && Number.isFinite(r) && Number.isFinite(w)) pakai.push({ t, r, w });
    else bad++;
  }
  pakai.sort((a, b) => a.t - b.t);
  let gaps = 0;
  let dup = 0;
  for (let i = 1; i < pakai.length; i++) {
    const d = pakai[i].t - pakai[i - 1].t;
    if (d === 0) dup++;
    else if (d !== HARI) gaps++;
  }
  return { t: pakai.map((p) => p.t), rain: pakai.map((p) => p.r), wl: pakai.map((p) => p.w), bad, off, gaps, dup };
}

const TXT = {
  id: {
    tanggal: "tanggal",
    pakai: "pakai",
    tambah: "tambah hari berikutnya",
    unggah: "unggah CSV",
    contoh: "data contoh",
    kosongkan: "kosongkan semua",
    terbaca: (n: number) => `${n} hari terbaca`,
    mati: (n: number) => `${n} baris tidak dicentang`,
    rusak: (n: number) => `${n} baris tanggal atau angkanya tidak terbaca`,
    celah: (n: number) => `${n} lompatan tanggal yang bukan satu hari`,
    ganda: (n: number) => `${n} tanggal ganda`,
    gagal: "Berkas ini tidak berisi satu pun baris bertanggal.",
    format: (dua: boolean) =>
      dua
        ? "Berkas tiga kolom: tanggal, hujan (mm), tinggi muka air (m). Tanggal 2020-12-01 atau 01/12/2020; pemisah koma, titik koma, atau tab."
        : "Berkas dua kolom: tanggal, hujan (mm). Tanggal 2020-12-01 atau 01/12/2020; pemisah koma, titik koma, atau tab.",
  },
  en: {
    tanggal: "date",
    pakai: "use",
    tambah: "add next day",
    unggah: "upload CSV",
    contoh: "sample data",
    kosongkan: "clear all",
    terbaca: (n: number) => `${n} days read`,
    mati: (n: number) => `${n} rows unticked`,
    rusak: (n: number) => `${n} rows with an unreadable date or number`,
    celah: (n: number) => `${n} date jumps that are not one day`,
    ganda: (n: number) => `${n} duplicated dates`,
    gagal: "This file does not contain a single dated row.",
    format: (dua: boolean) =>
      dua
        ? "A three-column file: date, rainfall (mm), water level (m). Dates as 2020-12-01 or 01/12/2020; comma, semicolon, or tab separated."
        : "A two-column file: date, rainfall (mm). Dates as 2020-12-01 or 01/12/2020; comma, semicolon, or tab separated.",
  },
} as const;

export function SeriesEntry({
  rows,
  onChange,
  dua,
  headV,
  headW,
  sample,
}: {
  rows: SeriesRow[];
  onChange: (rows: SeriesRow[]) => void;
  dua: boolean;
  headV: string;
  headW: string;
  sample: () => SeriesRow[];
}) {
  const { lang } = useLang();
  const x = TXT[lang];
  const berkas = useRef<HTMLInputElement>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const baca = readSeries(rows, dua);

  const ubah = (i: number, k: "d" | "v" | "w", v: string) => {
    const baru = rows.slice();
    baru[i] = { ...baru[i], [k]: v };
    onChange(baru);
  };

  const unggah = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const baris = String(r.result ?? "")
        .replace(/\r/g, "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const pemisah = baris[0]?.includes("\t") ? "\t" : baris[0]?.includes(";") ? ";" : ",";
      const hasil: SeriesRow[] = [];
      for (const l of baris) {
        const k = l.split(pemisah);
        /* Baris ramalan dari tombol unduh CSV lembar ini bukan data */
        if (k.some((s) => /^(ramalan|forecast)\b/i.test(s.trim()))) continue;
        const t = tanggalBerkas(k[0] ?? "");
        if (!Number.isFinite(t)) continue;
        hasil.push({ d: isoDate(t), v: (k[1] ?? "").trim(), w: dua ? (k[2] ?? "").trim() : undefined, on: true });
      }
      if (hasil.length === 0) {
        setPesan(x.gagal);
        return;
      }
      onChange(hasil);
      setPesan(null);
    };
    r.readAsText(f);
    e.target.value = "";
  };

  const tombol =
    "label border-b border-rule-strong pb-px text-[0.8rem] text-ink-2 hover:border-ink hover:text-ink";
  const sel = "value w-full border-b border-rule-faint bg-transparent text-right outline-none focus:border-ink";

  return (
    <div>
      <div className="overflow-y-auto" style={{ maxHeight: "16rem" }}>
        <table className="data">
          <thead>
            <tr>
              <th>{x.tanggal}</th>
              <th className="n">{headV}</th>
              {dua && <th className="n">{headW}</th>}
              <th style={{ width: "3rem" }}>{x.pakai}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={r.on === false ? { opacity: 0.45 } : undefined}>
                <td>
                  <input
                    type="date"
                    value={r.d}
                    onChange={(e) => ubah(i, "d", e.target.value)}
                    aria-label={`${x.tanggal} ${i + 1}`}
                    className="value w-full bg-transparent text-[0.8rem] outline-none"
                  />
                </td>
                <td className="n">
                  <input inputMode="decimal" value={r.v} onChange={(e) => ubah(i, "v", e.target.value)} aria-label={`${headV} ${i + 1}`} className={sel} />
                </td>
                {dua && (
                  <td className="n">
                    <input inputMode="decimal" value={r.w ?? ""} onChange={(e) => ubah(i, "w", e.target.value)} aria-label={`${headW} ${i + 1}`} className={sel} />
                  </td>
                )}
                <td className="n">
                  <input
                    type="checkbox"
                    checked={r.on !== false}
                    onChange={(e) => {
                      const baru = rows.slice();
                      baru[i] = { ...baru[i], on: e.target.checked };
                      onChange(baru);
                    }}
                    className="h-3.5 w-3.5 accent-[var(--color-ink)]"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        <button
          type="button"
          className={tombol}
          onClick={() => {
            const akhir = baca.t.length ? baca.t[baca.t.length - 1] + HARI : parseDate(new Date().toISOString().slice(0, 10));
            onChange([...rows, { d: isoDate(akhir), v: "", w: dua ? "" : undefined, on: true }]);
          }}
        >
          {x.tambah}
        </button>
        <button type="button" className={tombol} onClick={() => berkas.current?.click()}>
          {x.unggah}
        </button>
        <button type="button" className={tombol} onClick={() => { onChange(sample()); setPesan(null); }}>
          {x.contoh}
        </button>
        <button type="button" className={tombol} onClick={() => { onChange([{ d: "", v: "", w: dua ? "" : undefined, on: true }]); setPesan(null); }}>
          {x.kosongkan}
        </button>
        <input ref={berkas} type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" onChange={unggah} className="hidden" />
      </div>

      <p className="label mt-2 text-[0.76rem] text-ink-3">
        {x.terbaca(baca.t.length)}
        {baca.off > 0 && <span> · {x.mati(baca.off)}</span>}
        {baca.bad > 0 && <span className="text-signal"> · {x.rusak(baca.bad)}</span>}
        {baca.gaps > 0 && <span className="text-signal"> · {x.celah(baca.gaps)}</span>}
        {baca.dup > 0 && <span className="text-signal"> · {x.ganda(baca.dup)}</span>}
        {pesan && <span className="text-signal"> · {pesan}</span>}
      </p>
      <p className="label mt-1 text-[0.74rem] leading-snug text-ink-3">{x.format(dua)}</p>
    </div>
  );
}
