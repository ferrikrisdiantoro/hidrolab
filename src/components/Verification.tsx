"use client";

import { useLang } from "@/lib/i18n";
import { C } from "@/lib/theme";
import {
  KIND_LABEL,
  deviationText,
  evaluate,
  summarise,
  type Check,
} from "@/lib/verify";
import { fmt } from "@/lib/hydraulics";

const TXT = {
  id: {
    heading: "verifikasi",
    lead: "Nilai acuan berasal dari luar aplikasi ini. Kolom hitungan dievaluasi saat halaman digambar, jadi tabel ini ikut berubah bila modelnya berubah.",
    thWhat: "Yang diperiksa",
    thKind: "Jenis",
    thSource: "Acuan",
    thExpected: "Nilai acuan",
    thActual: "Hitungan",
    thDev: "Selisih",
    pass: "lolos",
    fail: "tidak lolos",
    summary: (p: number, t: number) => `${p} dari ${t} pemeriksaan lolos`,
    runYourself:
      "Seluruh pemeriksaan ini juga tersedia sebagai berkas uji yang dapat dijalankan sendiri dengan perintah npm test.",
  },
  en: {
    heading: "verification",
    lead: "Reference values come from outside this application. The computed column is evaluated as the page is drawn, so this table changes with the model.",
    thWhat: "What is checked",
    thKind: "Kind",
    thSource: "Reference",
    thExpected: "Reference value",
    thActual: "Computed",
    thDev: "Deviation",
    pass: "pass",
    fail: "fail",
    summary: (p: number, t: number) => `${p} of ${t} checks pass`,
    runYourself:
      "All of these checks are also available as a test file you can run yourself with npm test.",
  },
} as const;

/**
 * Blok verifikasi.
 *
 * Sengaja ditaruh di dalam halaman, bukan di dokumen terpisah, supaya
 * pembacanya dapat memeriksa dasar angka pada lembar yang sedang dilihatnya
 * tanpa berpindah tempat.
 */
export function Verification({ checks }: { checks: Check[] }) {
  const { lang } = useLang();
  const x = TXT[lang];
  const s = summarise(checks);

  return (
    <section className="border-t border-ink pt-3">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="stencil">{x.heading}</h2>
        <span
          className="stencil"
          style={{ color: s.allPass ? "var(--color-ink-2)" : C.signal }}
        >
          {x.summary(s.passed, s.total)}
        </span>
      </div>

      <p className="mb-3 max-w-[74ch] text-[0.9rem] leading-[1.55] text-ink-2">
        {x.lead}
      </p>

      <div className="overflow-x-auto">
        <table className="data" style={{ minWidth: "760px" }}>
          <thead>
            <tr>
              <th>{x.thWhat}</th>
              <th style={{ width: "9rem" }}>{x.thKind}</th>
              <th style={{ width: "16rem" }}>{x.thSource}</th>
              <th className="n" style={{ width: "8rem" }}>
                {x.thExpected}
              </th>
              <th className="n" style={{ width: "8rem" }}>
                {x.thActual}
              </th>
              <th className="n" style={{ width: "7rem" }}>
                {x.thDev}
              </th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => {
              const r = evaluate(c);
              const d = c.digits ?? 4;
              return (
                <tr key={c.label.id}>
                  <td className="text-ink">{c.label[lang]}</td>
                  <td className="text-ink-3">{KIND_LABEL[c.kind][lang]}</td>
                  <td className="text-ink-2">{c.source}</td>
                  <td className="n text-ink-2">
                    {fmt(c.expected, d)}
                    {c.unit && (
                      <span className="ml-1 text-[0.72rem] text-ink-3">
                        {c.unit}
                      </span>
                    )}
                  </td>
                  <td className="n text-ink">
                    {fmt(c.actual, d)}
                    {c.unit && (
                      <span className="ml-1 text-[0.72rem] text-ink-3">
                        {c.unit}
                      </span>
                    )}
                  </td>
                  <td
                    className="n font-semibold"
                    style={{ color: r.pass ? "var(--color-ink)" : C.signal }}
                  >
                    {deviationText(c, lang)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {checks.some((c) => c.tolReason) && (
        <ul className="mt-3 flex max-w-[74ch] flex-col gap-1.5">
          {checks
            .filter((c) => c.tolReason)
            .map((c) => (
              <li key={c.label.id} className="text-[0.84rem] text-ink-3">
                {c.tolReason?.[lang]}
              </li>
            ))}
        </ul>
      )}

      <p className="mt-3 max-w-[74ch] text-[0.84rem] text-ink-3">
        {x.runYourself}
      </p>
    </section>
  );
}
