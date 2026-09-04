"use client";

import Link from "next/link";
import { OpeningPlate } from "@/components/OpeningPlate";
import { LABS, SUBJECTS, type Subject } from "@/data/labs";
import { useLang } from "@/lib/i18n";
import { str } from "@/lib/strings";

export default function Home() {
  const { lang } = useLang();
  const t = str(lang);

  const ready = LABS.filter((l) => l.status === "siap").length;

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-9">
      {/* ---------------- Pembuka ---------------- */}
      <section className="mb-10 max-w-[62ch]">
        <h1 className="text-[clamp(2.1rem,4.6vw,3.4rem)] font-semibold leading-[1.06] tracking-[-0.018em] text-ink">
          {t.homeTitle}
        </h1>
        <p className="mt-4 text-[1.06rem] leading-[1.62] text-ink-2">
          {t.homeLead}
        </p>
      </section>

      <OpeningPlate />

      {/* ---------------- Daftar lembar ---------------- */}
      <section className="mt-16">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3 border-b border-ink pb-2">
          <h2 className="stencil">{t.sheetIndex}</h2>
          <span className="stencil">
            {ready} / {LABS.length} {t.statusReady}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="data" style={{ minWidth: "700px" }}>
            <thead>
              <tr>
                <th style={{ width: "5.4rem" }}>{t.colSheet}</th>
                <th style={{ width: "14rem" }}>{t.colTitle}</th>
                <th style={{ width: "12rem" }}>{t.colSubject}</th>
                <th>{t.colQuestion}</th>
                <th style={{ width: "6.4rem" }}>{t.colStatus}</th>
              </tr>
            </thead>
            <tbody>
              {LABS.map((lab) => {
                const isReady = lab.status === "siap";
                const dim = isReady ? "text-ink-2" : "text-ink-3";
                return (
                  <tr key={lab.sheet}>
                    <td className="value font-semibold">
                      {isReady ? (
                        <Link href={`/lab/${lab.slug}`} className="plain text-ink">
                          {lab.sheet}
                        </Link>
                      ) : (
                        <span className="text-ink-3">{lab.sheet}</span>
                      )}
                    </td>
                    <td>
                      {isReady ? (
                        <Link
                          href={`/lab/${lab.slug}`}
                          className="font-semibold text-ink"
                        >
                          {lab.title[lang]}
                        </Link>
                      ) : (
                        <span className="text-ink-3">{lab.title[lang]}</span>
                      )}
                    </td>
                    <td className={dim}>{SUBJECTS[lab.subject][lang]}</td>
                    <td className={dim}>{lab.question[lang]}</td>
                    <td>
                      <span
                        className="stencil"
                        style={{
                          color: isReady
                            ? "var(--color-ink)"
                            : "var(--color-ink-3)",
                        }}
                      >
                        {isReady ? t.statusReady : t.statusPlanned}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 max-w-[74ch] text-[0.88rem] leading-[1.55] text-ink-3">
          {t.indexNote}
        </p>
      </section>

      {/* ---------------- Metode ---------------- */}
      <section className="mt-16 grid gap-x-12 gap-y-8 border-t border-ink pt-4 md:grid-cols-2">
        <div>
          <h2 className="stencil mb-3">{t.methodHeading}</h2>
          <div className="flex max-w-[58ch] flex-col gap-3 text-[0.96rem] leading-[1.6] text-ink-2">
            <p>{t.method1}</p>
            <p>{t.method2}</p>
          </div>
        </div>

        <div>
          <h2 className="stencil mb-3">{t.rulesHeading}</h2>
          <table className="data">
            <tbody>
              {(
                [
                  [t.ruleBold, t.ruleBoldV],
                  [t.ruleThin, t.ruleThinV],
                  [t.ruleDash, t.ruleDashV],
                  [t.ruleDot, t.ruleDotV],
                  [t.ruleBlue, t.ruleBlueV],
                  [t.ruleRed, t.ruleRedV],
                  [t.rulePurple, t.rulePurpleV],
                ] as [string, string][]
              ).map(([k, v]) => (
                <tr key={k}>
                  <td className="text-ink-2" style={{ width: "9.5rem" }}>
                    {k}
                  </td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
