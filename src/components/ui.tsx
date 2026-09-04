"use client";

import { ReactNode } from "react";
import { useLang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { getNumberLocale } from "@/lib/hydraulics";

/* ------------------------------------------------------------------ *
 * Lembar gambar
 * ------------------------------------------------------------------ */

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
        <div className="flex flex-wrap items-stretch">
          <div className="flex min-w-[220px] flex-1 flex-col justify-center border-r border-rule px-3.5 py-2.5">
            <span className="stencil">{t.tbSimulation}</span>
            <span className="label mt-0.5 text-[0.82rem] font-semibold leading-tight text-ink">
              {title}
            </span>
          </div>

          {cells.map((c) => (
            <div
              key={c.label}
              className="flex min-w-[104px] flex-col justify-center border-r border-rule px-3.5 py-2.5"
            >
              <span className="stencil">{c.label}</span>
              <span
                className="value label mt-0.5 text-[0.86rem] font-semibold leading-tight"
                style={{ color: c.tint ?? "var(--color-ink)" }}
              >
                {c.value}
              </span>
            </div>
          ))}

          <div className="flex min-w-[96px] flex-col justify-center px-3.5 py-2.5">
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
          <th style={{ width: "38%" }} />
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
}) {
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
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          aria-label={label}
          style={
            { "--slider-tint": tint ?? "var(--color-ink)" } as React.CSSProperties
          }
        />
      </td>
      <td className="n whitespace-nowrap">
        <span className="font-semibold">
          {value.toLocaleString(getNumberLocale(), {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
          })}
        </span>
        {unit && <span className="ml-1 text-[0.72rem] text-ink-3">{unit}</span>}
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ *
 * Tabel hasil
 * ------------------------------------------------------------------ */

export function ResultTable({
  rows,
  caption,
}: {
  caption?: string;
  rows: {
    symbol?: string;
    label: string;
    value: string;
    unit?: string;
    tint?: string;
    strong?: boolean;
  }[];
}) {
  const t = str(useLang().lang);
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
        {rows.map((r) => (
          <tr key={r.label}>
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
  return (
    <section className="border-t border-ink pt-2.5">
      <h2
        className="stencil mb-2"
        style={tint ? { color: tint } : undefined}
      >
        {heading}
      </h2>
      {children}
    </section>
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
}: {
  label: string;
  presets: { label: string; apply: () => void }[];
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
      <span className="stencil">{label}</span>
      {presets.map((p) => (
        <button
          key={p.label}
          onClick={p.apply}
          className="label border-b border-rule-strong pb-px text-[0.8rem] text-ink-2 transition-colors hover:border-ink hover:text-ink"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
