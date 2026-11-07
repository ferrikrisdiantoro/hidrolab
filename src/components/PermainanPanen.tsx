"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
import { C, DASH, W, TONE } from "@/lib/theme";
import { fmt } from "@/lib/hydraulics";
import { usePlate } from "@/lib/usePlate";
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import {
  AMBANG_RUNTUH,
  P_E,
  TAHUN,
  awalPermainan,
  mainkan,
  nilaiPermainan,
  type ParamPanen,
} from "@/lib/permainanPanen";
import { Hitungan, InputRow, ResultTable } from "./ui";

/*
 * Permainan EK-02 (Phase 3, K-C): "atur berurutan".
 *
 * Pemain memilih upaya E (ParamDef P_E, sama dengan penggeser lembar) untuk
 * tiap tahun, lalu menekan Tangkap. Populasi maju satu tahun menurut
 * persamaan lembar (permainanPanen.ts, majuSetahun). r, K, q diambil dari
 * lembar saat tahun pertama dimainkan dan dikunci sampai permainan selesai,
 * supaya satu permainan memakai satu model; ubahan di lembar berlaku untuk
 * permainan berikutnya dan itu ditulis di kartu.
 *
 * Lembar tidak diubah oleh permainan, baik saat dimuat maupun saat dimainkan.
 * Reset lembar memasang ulang komponen ini, jadi permainannya kosong lagi.
 * Yang bertahan hanya catatan sesi di sessionStorage (banyak permainan
 * selesai dan skor relatif terbaik), dalam try/catch.
 */

const TXT = {
  id: {
    heading: "Permainan: kelola perikanan 20 tahun",
    aturan: (n0: string) =>
      `Stok awal ${n0} ton, separuh daya dukung. Tiap tahun pilih upaya penangkapan, lalu tekan Tangkap. Populasi bergerak menurut persamaan lembar ini selama satu tahun.`,
    param: "Model yang dipakai",
    paramBeda: "r, K, atau q di lembar sudah diubah. Permainan ini tetap memakai nilai saat tahun 1 dimainkan; nilai baru berlaku pada permainan berikutnya.",
    upaya: (t: number) => `Upaya tahun ${t}`,
    upayaSelesai: "Upaya",
    tangkap: (t: number) => `Tangkap tahun ${t}`,
    ulang: "Main lagi",
    ulangTitle: "Kosongkan permainan dan mulai dari tahun 1",
    tahun: "Tahun",
    dari: "dari",
    populasi: "Populasi",
    tangkapanLalu: "Tangkapan tahun lalu",
    total: "Jumlah tangkapan",
    status: (t: number, c: string, n: string, runtuh: boolean) =>
      `Tahun ${t}: tangkapan ${c} ton, populasi akhir ${n} ton${runtuh ? ", di bawah ambang runtuh" : ""}.`,
    selesai: (s: string, b: string, p: string) =>
      `Permainan selesai. Skor ${s} dari batas ${b}, atau ${p} persen.`,
    grafik: "Grafik populasi dan tangkapan tiap tahun",
    axX: "tahun",
    axY: "ton; tangkapan ton/th",
    lPop: "populasi N",
    lTangkap: "tangkapan C",
    lRuntuh: "runtuh",
    hRuntuh: "Populasi runtuh",
    ringkasan: "Ringkasan 20 tahun",
    rSkor: "Skor keberlanjutan",
    rBatas: "Batas atas, MSY × 20 tahun",
    rPersen: "Skor terhadap batas",
    rTotal: "Jumlah tangkapan",
    rKurasan: "Kurasan stok",
    rRuntuh: "Tahun runtuh",
    rPenalti: "Penalti runtuh",
    rNT: "Populasi akhir",
    rNmsy: "Populasi pada MSY",
    hSkor: "Skor",
    hKurasan: "Kurasan: stok yang diambil dari modal, bukan dari pertumbuhan",
    hPenalti: "Penalti: satu MSY untuk tiap tahun yang berakhir di bawah 0,05 K",
    rumusNote:
      "Batas MSY × T tidak dapat dilampaui strategi apa pun: tangkapan hanya bisa melebihi pertumbuhan populasi dengan menguras stoknya, dan kurasan itu dikurangkan. Pertumbuhan setahun paling besar rK/4, tepat saat populasinya K/2.",
    sesi: (n: number, p: string) =>
      n === 0 ? "Belum ada permainan selesai di sesi ini." : `Sesi ini: ${n} permainan selesai, skor terbaik ${p} % dari batas.`,
    deterministik: "Tanpa acak: persamaan lembar tidak memuat variasi lingkungan.",
    satY: "ton/th",
    satT: "tahun",
  },
  en: {
    heading: "Game: manage a fishery for 20 years",
    aturan: (n0: string) =>
      `The starting stock is ${n0} tonnes, half the carrying capacity. Each year choose a fishing effort, then press Fish. The population moves for one year by this sheet's equation.`,
    param: "Model in use",
    paramBeda: "r, K, or q on the sheet has changed. This game keeps the values from when year 1 was played; the new values apply to the next game.",
    upaya: (t: number) => `Effort for year ${t}`,
    upayaSelesai: "Effort",
    tangkap: (t: number) => `Fish year ${t}`,
    ulang: "Play again",
    ulangTitle: "Clear the game and start again from year 1",
    tahun: "Year",
    dari: "of",
    populasi: "Population",
    tangkapanLalu: "Last year's catch",
    total: "Total catch",
    status: (t: number, c: string, n: string, runtuh: boolean) =>
      `Year ${t}: catch ${c} tonnes, closing population ${n} tonnes${runtuh ? ", below the collapse threshold" : ""}.`,
    selesai: (s: string, b: string, p: string) =>
      `Game over. Score ${s} out of a ceiling of ${b}, or ${p} per cent.`,
    grafik: "Chart of population and catch per year",
    axX: "year",
    axY: "tonnes; catch t/y",
    lPop: "population N",
    lTangkap: "catch C",
    lRuntuh: "collapse",
    hRuntuh: "Stock collapsed",
    ringkasan: "Summary of 20 years",
    rSkor: "Sustainability score",
    rBatas: "Ceiling, MSY × 20 years",
    rPersen: "Score against the ceiling",
    rTotal: "Total catch",
    rKurasan: "Stock drawdown",
    rRuntuh: "Collapsed years",
    rPenalti: "Collapse penalty",
    rNT: "Closing population",
    rNmsy: "Population at MSY",
    hSkor: "Score",
    hKurasan: "Drawdown: stock taken from the capital, not from growth",
    hPenalti: "Penalty: one MSY for every year that ends below 0.05 K",
    rumusNote:
      "No strategy can beat the MSY × T ceiling: the catch can only exceed the population's growth by drawing the stock down, and that drawdown is subtracted. A year's growth is at most rK/4, reached exactly when the population is K/2.",
    sesi: (n: number, p: string) =>
      n === 0 ? "No game finished yet this session." : `This session: ${n} games finished, best score ${p} % of the ceiling.`,
    deterministik: "No randomness: the sheet's equation has no environmental variation.",
    satY: "t/y",
    satT: "years",
  },
} as const;

type Catatan = { main: number; terbaik: number };
const KUNCI = "hidrolab-permainan:EK-02";

function bacaSesi(): Catatan {
  try {
    const s = window.sessionStorage.getItem(KUNCI);
    if (!s) return { main: 0, terbaik: Number.NEGATIVE_INFINITY };
    const v = JSON.parse(s) as Catatan;
    if (typeof v?.main !== "number" || typeof v.terbaik !== "number") throw new Error();
    return v;
  } catch {
    return { main: 0, terbaik: Number.NEGATIVE_INFINITY };
  }
}

function tulisSesi(c: Catatan) {
  try {
    window.sessionStorage.setItem(KUNCI, JSON.stringify(c));
  } catch {
    // Penyimpanan ditolak (mode privat, kuota): catatan hanya di layar.
  }
}

export function PermainanPanen({
  r,
  K,
  q,
  E: eLembar,
}: {
  /** Masukan lembar saat ini; dikunci saat tahun 1 dimainkan. */
  r: number;
  K: number;
  q: number;
  /** Upaya lembar, hanya untuk nilai awal penggeser permainan. */
  E: number;
}) {
  const { lang } = useLang();
  const x = TXT[lang];
  const idJudul = useId();

  const [kunci, setKunci] = useState<ParamPanen | null>(null);
  const [efforts, setEfforts] = useState<number[]>([]);
  const [E, setE] = useState(eLembar);
  const [umum, setUmum] = useState("");
  const [sesi, setSesi] = useState<Catatan | null>(null);
  const ringkasanRef = useRef<HTMLDivElement>(null);
  const tombolRef = useRef<HTMLButtonElement>(null);
  const fokus = useRef<"ringkasan" | "tombol" | null>(null);

  useEffect(() => setSesi(bacaSesi()), []);

  const p: ParamPanen = kunci ?? { r, K, q };
  const tahun = useMemo(() => mainkan(p, efforts), [p.r, p.K, p.q, efforts]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = nilaiPermainan(p, tahun);
  const n = tahun.length;
  const selesai = n === TAHUN;
  const N = n ? tahun[n - 1].N1 : awalPermainan(p);
  const beda = kunci !== null && (kunci.r !== r || kunci.K !== K || kunci.q !== q);
  const batasPenuh = v.msy * TAHUN;

  useEffect(() => {
    if (fokus.current === "ringkasan") ringkasanRef.current?.focus();
    if (fokus.current === "tombol") tombolRef.current?.focus();
    fokus.current = null;
  });

  const tangkap = () => {
    if (selesai) return;
    const pk = kunci ?? { r, K, q };
    if (!kunci) setKunci(pk);
    const baru = [...efforts, E];
    const th = mainkan(pk, baru);
    const akhir = th[th.length - 1];
    setEfforts(baru);
    if (baru.length === TAHUN) {
      const nil = nilaiPermainan(pk, th);
      const persen = (nil.skor / nil.batas) * 100;
      const lama = sesi ?? bacaSesi();
      const c = { main: lama.main + 1, terbaik: Math.max(lama.terbaik, persen) };
      tulisSesi(c);
      setSesi(c);
      setUmum(x.selesai(fmt(nil.skor, 1), fmt(nil.batas, 1), fmt(persen, 1)));
      fokus.current = "ringkasan";
    } else {
      setUmum(x.status(akhir.t, fmt(akhir.tangkap, 1), fmt(akhir.N1, 0), akhir.runtuh));
    }
  };

  const ulang = () => {
    setKunci(null);
    setEfforts([]);
    setUmum("");
    // Tombol Main lagi lenyap bersama ringkasan; fokus pindah ke Tangkap.
    fokus.current = "tombol";
  };

  /* ---------------- grafik ---------------- */

  const plate = usePlate(
    (ctx, w, h) => {
      const popPts = [{ x: 0, y: awalPermainan(p) }, ...tahun.map((t) => ({ x: t.t, y: t.N1 }))];
      // Tangkapan setahun berlaku sepanjang tahun itu: tangga, bukan titik.
      const cPts = tahun.flatMap((t) => [
        { x: t.t - 1, y: t.tangkap },
        { x: t.t, y: t.tangkap },
      ]);
      const deret: ChartSeries[] = [
        { pts: popPts, color: C.water, weight: W.bold, label: x.lPop, labelAt: 0.12, labelDy: -10 },
      ];
      if (cPts.length) deret.push({ pts: cPts, color: C.ink, weight: W.thin, label: x.lTangkap, labelAt: 0.5, labelDy: 12 });
      const yMax = Math.max(p.K, ...tahun.map((t) => Math.max(t.N1, t.tangkap))) * 1.08;
      const runtuhKini = n > 0 && tahun[n - 1].runtuh;
      return drawChart(
        ctx,
        w,
        h,
        {
          xMin: 0,
          xMax: TAHUN,
          yMin: 0,
          yMax,
          axisX: x.axX,
          axisY: x.axY,
          series: deret,
          bands: [{ axis: "y", from: 0, to: AMBANG_RUNTUH * p.K, label: x.lRuntuh }],
          rules: [
            { axis: "y", at: v.msy, color: C.critical, dash: DASH.axis, label: "MSY", labelAlign: "right" },
            { axis: "y", at: p.K / 2, color: C.water, weight: W.hair, dash: DASH.hidden, label: "K/2", labelAlign: "right" },
          ],
          point: { x: n, y: N, label: `${fmt(N, 0)} t`, invalid: runtuhKini },
          heading: runtuhKini ? x.hRuntuh : undefined,
          headingColor: C.signal,
        },
        lang
      );
    },
    null,
    [p.r, p.K, p.q, efforts, lang]
  );

  const persen = n ? (v.skor / v.batas) * 100 : 0;

  return (
    <section aria-labelledby={idJudul} data-permainan="EK-02" className="border-t border-ink pt-2.5">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={idJudul} className="stencil">
          {x.heading}
        </h2>
        {n > 0 && (
          <button
            type="button"
            onClick={ulang}
            title={x.ulangTitle}
            className="label border-b border-rule-strong pb-px text-[0.8rem] text-ink-2 transition-colors hover:border-ink hover:text-ink"
          >
            {x.ulang}
          </button>
        )}
      </div>

      <div className="border border-rule-strong bg-sheet">
        <div className="px-3.5 pt-3">
          <p className="max-w-[62ch] text-[0.9rem] leading-[1.55] text-ink-2">{x.aturan(fmt(awalPermainan(p), 0))}</p>
          <p className="label mt-1.5 text-[0.74rem] text-ink-3">
            {x.param}: r {fmt(p.r, 2)}; K {fmt(p.K, 0)} t; q {fmt(p.q * 1000, 1)}×10⁻³; MSY {fmt(v.msy, 1)} {x.satY}
          </p>
          {beda && (
            <p className="mt-1.5 text-[0.84rem] leading-[1.5]" style={{ color: TONE.caution.line }}>
              {x.paramBeda}
            </p>
          )}
        </div>

        <div className="relative mt-2 h-[220px] w-full" role="img" aria-label={x.grafik}>
          <canvas ref={plate.ref} className="block h-full w-full" />
        </div>

        <dl className="label grid grid-cols-3 gap-px border-y border-rule bg-rule text-[0.74rem]">
          {[
            { k: x.tahun, v: `${n} ${x.dari} ${TAHUN}` },
            { k: x.populasi, v: `${fmt(N, 0)} t`, tint: n && tahun[n - 1].runtuh ? C.signal : C.water },
            { k: x.tangkapanLalu, v: n ? `${fmt(tahun[n - 1].tangkap, 1)} t` : "—" },
          ].map((s) => (
            <div key={s.k} className="bg-sheet px-2.5 py-1.5">
              <dt className="text-ink-3">{s.k}</dt>
              <dd className="value text-[0.9rem] font-semibold" style={{ color: s.tint ?? "var(--color-ink)" }}>
                {s.v}
              </dd>
            </div>
          ))}
        </dl>

        {!selesai && (
          // Bukan <form>: Enter di kotak angka InputRow menutup suntingannya,
          // dan submit pada ketukan yang sama akan memakai E sebelum ketikan.
          <div className="px-3.5 pb-3 pt-2">
            <table className="data">
              <tbody>
                <InputRow symbol="E" label={x.upaya(n + 1)} value={E} {...P_E} onChange={setE} />
              </tbody>
            </table>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
              <button
                ref={tombolRef}
                type="button"
                onClick={tangkap}
                data-permainan-tangkap
                className="label border-b-2 border-ink pb-px text-[0.88rem] font-semibold text-ink"
              >
                {x.tangkap(n + 1)}
              </button>
              <span className="label text-[0.72rem] text-ink-3">
                {x.total} {fmt(v.tangkapTotal, 1)} t
              </span>
            </div>
          </div>
        )}

        <p role="status" aria-live="polite" data-permainan-status className="sr-only">
          {umum}
        </p>

        {selesai && (
          <div ref={ringkasanRef} tabIndex={-1} className="px-3.5 pb-3.5 pt-3 outline-offset-2" data-permainan-ringkasan>
            <p className="stencil mb-2">{x.ringkasan}</p>
            <ResultTable
              rows={[
                { symbol: "S", label: x.rSkor, value: fmt(v.skor, 1), unit: "t", tint: v.nRuntuh ? C.signal : C.water, strong: true },
                { symbol: "S/B", label: x.rPersen, value: fmt(persen, 1), unit: "%", strong: true },
                { symbol: "B", label: x.rBatas, value: fmt(batasPenuh, 1), unit: "t", tint: C.critical },
                { symbol: "ΣC", label: x.rTotal, value: fmt(v.tangkapTotal, 1), unit: "t" },
                { symbol: "D", label: x.rKurasan, value: fmt(v.kurasan, 1), unit: "t" },
                { symbol: "n", label: x.rRuntuh, value: fmt(v.nRuntuh, 0), unit: x.satT, tint: v.nRuntuh ? C.signal : undefined },
                { symbol: "N_T", label: x.rNT, value: fmt(v.NT, 1), unit: "t" },
                { symbol: "K/2", label: x.rNmsy, value: fmt(p.K / 2, 1), unit: "t" },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                terbuka
                langkah={[
                  {
                    judul: x.hKurasan,
                    rumus: <span>D = max(0, N₀ − N_T)</span>,
                    isi: `max(0, ${fmt(v.N0, 1)} − ${fmt(v.NT, 1)})`,
                    hasil: fmt(v.kurasan, 1),
                    satuan: "t",
                  },
                  {
                    judul: x.hPenalti,
                    rumus: <span>P = MSY · n</span>,
                    isi: `${fmt(v.msy, 1)} · ${fmt(v.nRuntuh, 0)}`,
                    hasil: fmt(v.penalti, 1),
                    satuan: "t",
                    tint: v.nRuntuh ? C.signal : undefined,
                  },
                  {
                    judul: x.hSkor,
                    rumus: <span>S = ΣC − D − P ≤ MSY · T</span>,
                    isi: `${fmt(v.tangkapTotal, 1)} − ${fmt(v.kurasan, 1)} − ${fmt(v.penalti, 1)}  ≤  ${fmt(v.msy, 1)} · ${TAHUN} = ${fmt(batasPenuh, 1)}`,
                    hasil: fmt(v.skor, 1),
                    satuan: "t",
                    tint: C.water,
                  },
                ]}
              />
            </div>
            <p className="mt-2.5 max-w-[62ch] text-[0.86rem] leading-[1.5] text-ink-2">{x.rumusNote}</p>
            <div className="mt-2.5">
              <button
                type="button"
                onClick={ulang}
                title={x.ulangTitle}
                className="label border-b-2 border-ink pb-px text-[0.88rem] font-semibold text-ink"
              >
                {x.ulang}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-rule px-3.5 py-2">
          <span data-permainan-sesi className="label text-[0.74rem] text-ink-2">
            {sesi ? x.sesi(sesi.main, fmt(sesi.terbaik, 1)) : ""}
          </span>
          <span className="label text-[0.7rem] text-ink-3">{x.deterministik}</span>
        </div>
      </div>
    </section>
  );
}

