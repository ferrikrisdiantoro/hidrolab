"use client";

import { useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
import { parsePairs, type Pt } from "@/lib/discharge";

/**
 * Tabel isian pasangan data, dengan unggah berkas.
 *
 * Dipakai lembar-lembar yang dipindahkan dari cl42, tempat pengguna membawa
 * data ukurnya sendiri. Enam puluh sembilan lembar lain hanya punya
 * penggeser, karena keadaannya dibangkitkan oleh modelnya sendiri; di sini
 * datanya datang dari luar, jadi lembarnya harus dapat menerimanya dan
 * mengatakan dengan jelas berapa baris yang tidak terbaca.
 *
 * Isinya disimpan sebagai teks, bukan angka, supaya pengguna dapat mengetik
 * "0," tanpa angkanya melompat. Baris yang belum lengkap atau bukan angka
 * tidak ikut dihitung, dan jumlahnya ditulis di bawah tabel.
 */

export type Row = { x: string; y: string };

export const rowsFromPts = (pts: Pt[]): Row[] =>
  pts.map((p) => ({ x: String(p.x), y: String(p.y) }));

/** Membaca baris isian; koma diterima sebagai pemisah desimal. */
export function ptsFromRows(rows: Row[]): { pts: Pt[]; bad: number } {
  const pts: Pt[] = [];
  let bad = 0;
  for (const r of rows) {
    if (r.x.trim() === "" && r.y.trim() === "") continue;
    const x = parseFloat(r.x.replace(",", "."));
    const y = parseFloat(r.y.replace(",", "."));
    if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y });
    else bad++;
  }
  return { pts, bad };
}

const TXT = {
  id: {
    tambah: "tambah baris",
    unggah: "unggah CSV",
    contoh: "data contoh",
    kosongkan: "kosongkan",
    hapus: "hapus baris",
    terbaca: (n: number) => `${n} pasangan terbaca`,
    rusak: (n: number) => `${n} baris bukan angka, tidak dihitung`,
    lewat: (n: number) => `${n} baris berkas tidak terbaca dan dilewati`,
    format:
      "Berkas dua kolom. Pemisah kolom koma, titik koma, atau tab; baris judul boleh ada. Berkas dari Excel berbahasa Indonesia (titik koma dan koma desimal) juga terbaca.",
    gagal: "Berkas ini tidak berisi satu pun pasangan angka.",
  },
  en: {
    tambah: "add row",
    unggah: "upload CSV",
    contoh: "sample data",
    kosongkan: "clear",
    hapus: "delete row",
    terbaca: (n: number) => `${n} pairs read`,
    rusak: (n: number) => `${n} rows are not numbers and are not counted`,
    lewat: (n: number) => `${n} file rows could not be read and were skipped`,
    format:
      "A two-column file. Columns separated by comma, semicolon, or tab; a header row is allowed. Files from Excel with a decimal comma are read too.",
    gagal: "This file does not contain a single numeric pair.",
  },
} as const;

export function DataEntry({
  rows,
  onChange,
  headX,
  headY,
  sample,
  maxHeight = "16rem",
}: {
  rows: Row[];
  onChange: (rows: Row[]) => void;
  headX: string;
  headY: string;
  sample: Pt[];
  maxHeight?: string;
}) {
  const { lang } = useLang();
  const x = TXT[lang];
  const berkas = useRef<HTMLInputElement>(null);
  const [pesanBerkas, setPesanBerkas] = useState<string | null>(null);
  const { pts, bad } = ptsFromRows(rows);

  const ubah = (i: number, k: "x" | "y", v: string) => {
    const baru = rows.slice();
    baru[i] = { ...baru[i], [k]: v };
    onChange(baru);
  };

  const unggah = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const hasil = parsePairs(String(r.result ?? ""));
      if (hasil.pts.length === 0) {
        setPesanBerkas(x.gagal);
        return;
      }
      onChange(rowsFromPts(hasil.pts));
      setPesanBerkas(hasil.skipped > 0 ? x.lewat(hasil.skipped) : null);
    };
    r.readAsText(f);
    e.target.value = "";
  };

  const tombol =
    "label border-b border-rule-strong pb-px text-[0.8rem] text-ink-2 hover:border-ink hover:text-ink";

  return (
    <div>
      <div className="overflow-y-auto" style={{ maxHeight }}>
        <table className="data">
          <thead>
            <tr>
              <th style={{ width: "2rem" }}>#</th>
              <th className="n">{headX}</th>
              <th className="n">{headY}</th>
              <th style={{ width: "2rem" }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="text-ink-3">{i + 1}</td>
                {(["x", "y"] as const).map((k) => (
                  <td key={k} className="n">
                    <input
                      inputMode="decimal"
                      value={r[k]}
                      onChange={(e) => ubah(i, k, e.target.value)}
                      aria-label={`${k === "x" ? headX : headY} ${i + 1}`}
                      className="value w-full border-b border-rule-faint bg-transparent text-right outline-none focus:border-ink"
                    />
                  </td>
                ))}
                <td className="n">
                  <button
                    type="button"
                    onClick={() => onChange(rows.filter((_, j) => j !== i))}
                    aria-label={`${x.hapus} ${i + 1}`}
                    className="text-ink-3 hover:text-ink"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        <button type="button" className={tombol} onClick={() => onChange([...rows, { x: "", y: "" }])}>
          {x.tambah}
        </button>
        <button type="button" className={tombol} onClick={() => berkas.current?.click()}>
          {x.unggah}
        </button>
        <button
          type="button"
          className={tombol}
          onClick={() => {
            onChange(rowsFromPts(sample));
            setPesanBerkas(null);
          }}
        >
          {x.contoh}
        </button>
        <button
          type="button"
          className={tombol}
          onClick={() => {
            onChange([{ x: "", y: "" }]);
            setPesanBerkas(null);
          }}
        >
          {x.kosongkan}
        </button>
        <input
          ref={berkas}
          type="file"
          accept=".csv,.txt,.tsv,text/csv,text/plain"
          onChange={unggah}
          className="hidden"
        />
      </div>

      <p className="label mt-2 text-[0.76rem] text-ink-3">
        {x.terbaca(pts.length)}
        {bad > 0 && <span className="text-signal"> · {x.rusak(bad)}</span>}
        {pesanBerkas && <span className="text-signal"> · {pesanBerkas}</span>}
      </p>
      <p className="label mt-1 text-[0.74rem] leading-snug text-ink-3">{x.format}</p>
    </div>
  );
}
