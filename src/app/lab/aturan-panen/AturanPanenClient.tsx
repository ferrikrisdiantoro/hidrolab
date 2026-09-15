"use client";

import { useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  Block,
  Flag,
  InputRow,
  InputTable,
  Note,
  PresetRow,
  ResultTable,
  Sheet,
  Term,
} from "@/components/ui";
import { useCanvas } from "@/lib/useCanvas";
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import { fmt, fmtPlain, schaeferHarvest } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksHarvest } from "@/lib/checks";

const TXT = {
  id: {
    title: "Aturan panen",
    sheetTitle: "Model Schaefer — hasil lestari terhadap upaya penangkapan",
    dR: "Laju pertumbuhan hakiki",
    dK: "Daya dukung",
    dQ: "Kemampuan tangkap per satuan upaya",
    dE: "Upaya penangkapan",
    pLestari: "Dikelola pada hasil maksimum",
    pHatiHati: "Dikelola hati-hati",
    pBerlebih: "Ditangkap berlebihan",
    rYield: "Hasil pada upaya ini",
    rMsy: "Hasil lestari maksimum",
    rEmsy: "Upaya pada hasil maksimum",
    rStock: "Populasi pada keadaan mantap",
    rStockPct: "Populasi terhadap daya dukung",
    rCadangan: "Selisih terhadap upaya maksimum",
    berlebih: "Upaya melampaui titik hasil maksimum",
    berlebihNote:
      "Upayanya berada di sebelah kanan puncak kurva. Di daerah ini menambah kapal, hari melaut, atau jaring justru MENURUNKAN hasil tangkapan, bukan menaikkannya, karena populasi yang tersisa menyusut lebih cepat daripada bertambahnya upaya. Yang membuat keadaan ini berbahaya bukan hasilnya yang turun melainkan bentuk kurvanya: tiap tingkat hasil di bawah puncak dapat dicapai oleh dua tingkat upaya, satu di kiri dan satu di kanan. Angka hasil tangkapan saja karena itu tidak pernah cukup untuk mengetahui di sisi mana sebuah perikanan berada.",
    runtuh: "Populasi runtuh",
    runtuhNote:
      "Populasi tersisa di bawah lima persen daya dukungnya. Model Schaefer tetap memberi angka di sini, tetapi model ini mengandaikan pertumbuhan logistik yang mulus, dan andaian itu gugur pada populasi yang sangat kecil: perjumpaan untuk berkembang biak menjadi jarang, keragaman genetik menyusut, dan jenis lain mengambil alih ceruknya. Perikanan yang runtuh sering tidak pulih walaupun penangkapannya dihentikan sama sekali, dan kurva ini tidak dapat meramalkan hal itu.",
    note:
      "Kurva ini menurun sesudah puncaknya, dan seluruh kesulitan pengelolaan perikanan terletak pada kenyataan itu. Karena kurvanya parabola, tiap tingkat hasil di bawah puncak dapat dicapai oleh dua tingkat upaya yang sangat berbeda: satu dengan populasi besar dan armada kecil, satu lagi dengan populasi kecil dan armada besar. Keduanya memberi angka tangkapan tahunan yang sama persis, dan dari angka tangkapan saja keduanya tidak dapat dibedakan. Itulah sebabnya pengelolaan perikanan yang hanya memantau hasil tangkapan selalu terlambat menyadari keruntuhan: hasil yang bertahan stabil selama bertahun-tahun dapat berarti pengelolaan yang baik, atau dapat berarti armada yang terus membesar sambil mengejar populasi yang terus menyusut. Yang membedakan keduanya hanya pengukuran populasi, dan pengukuran itulah yang mahal dan karena itu sering dilewati.",
  },
  en: {
    title: "Harvesting rule",
    sheetTitle: "Schaefer model — sustainable yield against fishing effort",
    dR: "Intrinsic growth rate",
    dK: "Carrying capacity",
    dQ: "Catchability per unit effort",
    dE: "Fishing effort",
    pLestari: "Managed at maximum yield",
    pHatiHati: "Managed cautiously",
    pBerlebih: "Overfished",
    rYield: "Yield at this effort",
    rMsy: "Maximum sustainable yield",
    rEmsy: "Effort at maximum yield",
    rStock: "Equilibrium stock",
    rStockPct: "Stock relative to carrying capacity",
    rCadangan: "Margin to the peak effort",
    berlebih: "Effort past the maximum-yield point",
    berlebihNote:
      "The effort sits to the right of the peak of the curve. In this region adding boats, sea days, or nets LOWERS the catch rather than raising it, because the remaining stock shrinks faster than the effort grows. What makes this state dangerous is not the falling yield but the shape of the curve: every yield below the peak can be reached by two levels of effort, one on each side. Catch figures alone are therefore never enough to know which side a fishery is on.",
    runtuh: "Stock collapsed",
    runtuhNote:
      "The remaining stock is below five per cent of carrying capacity. The Schaefer model still returns numbers here, but it assumes smooth logistic growth, and that assumption fails at very small populations: breeding encounters become rare, genetic diversity narrows, and other species take over the niche. Collapsed fisheries often fail to recover even when fishing stops entirely, and this curve cannot predict that.",
    note:
      "This curve falls after its peak, and the whole difficulty of fisheries management rests on that fact. Because the curve is a parabola, every yield below the peak can be reached by two very different levels of effort: one with a large stock and a small fleet, another with a small stock and a large fleet. Both give exactly the same annual catch, and from the catch alone the two cannot be told apart. That is why fisheries management that watches only the catch is always late to notice a collapse: a yield that holds steady for years may mean good management, or may mean a fleet growing steadily while chasing a stock shrinking just as steadily. What separates the two is a measurement of the stock, and that measurement is expensive and therefore often skipped.",
  },
} as const;

const REFS = {
  id: [
    "Schaefer, M.B. (1954). Some aspects of the dynamics of populations important to the management of the commercial marine fisheries. Bulletin of the Inter-American Tropical Tuna Commission, vol. 1.",
    "Hilborn, R. & Walters, C.J. (1992). Quantitative Fisheries Stock Assessment. Chapman & Hall.",
    "Larkin, P.A. (1977). An epitaph for the concept of maximum sustained yield. Transactions of the American Fisheries Society, vol. 106.",
    "FAO (1995). Code of Conduct for Responsible Fisheries. FAO, Roma.",
  ],
  en: [
    "Schaefer, M.B. (1954). Some aspects of the dynamics of populations important to the management of the commercial marine fisheries. Bulletin of the Inter-American Tropical Tuna Commission, vol. 1.",
    "Hilborn, R. & Walters, C.J. (1992). Quantitative Fisheries Stock Assessment. Chapman & Hall.",
    "Larkin, P.A. (1977). An epitaph for the concept of maximum sustained yield. Transactions of the American Fisheries Society, vol. 106.",
    "FAO (1995). Code of Conduct for Responsible Fisheries. FAO, Rome.",
  ],
} as const;

export function AturanPanenClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [r0, setR0] = useState(0.5);
  const [K, setK] = useState(1000);
  const [q, setQ] = useState(0.01);
  const [E, setE] = useState(20);

  const r = schaeferHarvest(r0, K, q, E);
  const eMax = r.curve[r.curve.length - 1].effort;

  const ref = useCanvas(
    (ctx, w, h) => {
      const deret: ChartSeries[] = [
        {
          pts: r.curve.map((p) => ({ x: p.effort, y: p.yield })),
          color: C.water,
          weight: W.bold,
          fill: C.waterFill,
        },
        {
          // Populasi diskalakan supaya muat pada sumbu yang sama; yang penting
          // bentuknya, yaitu turun lurus sementara hasilnya memuncak.
          pts: r.curve.map((p) => ({
            x: p.effort,
            y: (p.stock / K) * r.msy * 1.2,
          })),
          color: C.ink3,
          weight: W.hair,
          dash: DASH.hidden,
          label: lang === "id" ? "populasi" : "stock",
          labelAt: 0.3,
          labelDy: 14,
        },
      ];

      drawChart(
        ctx,
        w,
        h,
        {
          xMin: 0,
          xMax: eMax,
          yMin: 0,
          yMax: r.msy * 1.35,
          axisX: T.axEffort,
          axisY: T.axYield,
          series: deret,
          bands: [
            { axis: "x", from: r.effortAtMsy, to: eMax, label: T.overfishedZone },
          ],
          rules: [
            {
              axis: "y",
              at: r.msy,
              color: C.critical,
              dash: DASH.axis,
              label: T.msyPoint,
              labelAlign: "left",
            },
          ],
          point: {
            x: E,
            y: r.currentYield,
            label: `${fmtPlain(r.currentYield, 1)} t`,
            invalid: r.overfished,
          },
          heading: r.collapsed ? x.runtuh : undefined,
          headingColor: C.signal,
        },
        lang
      );
    },
    [r0, K, q, E, lang]
  );

  return (
    <LabShell
      sheet="EK-02"
      subject={SUBJECTS.EK[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Kurva hasil lestari <Term tint={C.signal}>menurun</Term> sesudah
            puncaknya, dan karena itu satu angka hasil tangkapan selalu punya{" "}
            <Term tint={C.water}>dua penafsiran</Term> yang berlawanan.
          </p>
        ) : (
          <p>
            The sustainable yield curve <Term tint={C.signal}>falls</Term> after
            its peak, and because of that a single catch figure always carries{" "}
            <Term tint={C.water}>two opposite readings</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="EK-02"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (ton, th⁻¹)" },
            { label: "MSY", value: `${fmt(r.msy, 1)} t`, tint: C.critical },
            { label: "E", value: fmt(E, 1), tint: r.overfished ? C.signal : undefined },
            { label: "Y", value: `${fmt(r.currentYield, 1)} t`, tint: C.water },
            { label: "N", value: `${fmt(r.stock, 0)} t`, tint: r.collapsed ? C.signal : undefined },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="r" label={x.dR} value={r0} min={0.05} max={2} step={0.05} digits={2} unit="th⁻¹" onChange={setR0} />
              <InputRow symbol="K" label={x.dK} value={K} min={50} max={20000} step={50} digits={0} unit="ton" onChange={setK} />
              <InputRow symbol="q" label={x.dQ} value={q * 1000} min={1} max={50} step={0.5} digits={1} unit="×10⁻³" onChange={(v) => setQ(v / 1000)} />
              <InputRow symbol="E" label={x.dE} value={E} min={0} max={150} step={1} digits={0} onChange={setE} tint={C.signal} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pLestari, apply: () => { setR0(0.5); setK(1000); setQ(0.01); setE(25); } },
                  { label: x.pHatiHati, apply: () => { setR0(0.5); setK(1000); setQ(0.01); setE(15); } },
                  { label: x.pBerlebih, apply: () => { setR0(0.5); setK(1000); setQ(0.01); setE(45); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={r.overfished ? undefined : C.water} alert={r.overfished}>
                {`${fmt(r.currentYield, 1)} t/${lang === "id" ? "th" : "y"}`}
              </Flag>
              {r.overfished && <Flag alert>{x.berlebih}</Flag>}
              {r.collapsed && <Flag alert>{x.runtuh}</Flag>}
            </div>
            {r.overfished && (
              <div className="mb-2.5">
                <Note>{x.berlebihNote}</Note>
              </div>
            )}
            {r.collapsed && (
              <div className="mb-2.5">
                <Note>{x.runtuhNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "Y", label: x.rYield, value: fmt(r.currentYield, 2), unit: "ton/th", tint: C.water, strong: true },
                { symbol: "MSY", label: x.rMsy, value: fmt(r.msy, 2), unit: "ton/th", tint: C.critical, strong: true },
                { symbol: "Emsy", label: x.rEmsy, value: fmt(r.effortAtMsy, 2) },
                { symbol: "N", label: x.rStock, value: fmt(r.stock, 1), unit: "ton", tint: r.collapsed ? C.signal : undefined },
                { symbol: "N/K", label: x.rStockPct, value: fmt((r.stock / K) * 100, 1), unit: "%" },
                { symbol: "—", label: x.rCadangan, value: fmt(r.effortAtMsy - E, 2), tint: r.overfished ? C.signal : undefined },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(r0, K, q, E, r.effortAtMsy, r.currentYield, r.msy, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksHarvest(r0, K, q, E)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <Frac num="dN" den="dt" />
                <span>= r N</span>
                <span className="ml-1">(</span>
                <span>1 −</span>
                <Frac num="N" den="K" />
                <span>)</span>
                <span className="ml-2">− q E N</span>
              </Eq>
              <Eq>
                <span>N* = K</span>
                <span className="ml-1">(</span>
                <span>1 −</span>
                <Frac num="q E" den="r" />
                <span>)</span>
                <span className="ml-5">Y = q E N*</span>
              </Eq>
              <Eq>
                <span>MSY =</span>
                <Frac num="r K" den="4" />
                <span className="ml-5">Emsy =</span>
                <Frac num="r" den="2 q" />
                <span className="ml-3 text-ink-3">
                  {lang === "id"
                    ? "pada puncak, populasinya tepat separuh daya dukung"
                    : "at the peak the stock is exactly half the carrying capacity"}
                </span>
              </Eq>
            </>
          }
          note={x.note}
          refs={[...REFS[lang]]}
        />
      }
    />
  );
}

function notice(
  r0: number,
  K: number,
  q: number,
  E: number,
  eMsy: number,
  yieldNow: number,
  msy: number,
  lang: Lang
): string {
  // Upaya lain yang memberi hasil yang sama persis, di sisi berlawanan puncak.
  const kembar = 2 * eMsy - E;
  const stokKembar = Math.max(K * (1 - (q * kembar) / r0), 0);
  const stokKini = Math.max(K * (1 - (q * E) / r0), 0);

  if (lang === "en")
    return `An effort of ${fmtPlain(kembar, 1)} gives exactly the same catch as this one, ${fmt(yieldNow, 1)} tonnes, but leaves a stock of ${fmt(stokKembar, 0)} tonnes against ${fmt(stokKini, 0)} here. Two fisheries reporting identical landings, one with ${fmt(Math.max(stokKini, stokKembar) / Math.max(Math.min(stokKini, stokKembar), 1e-9), 1)} times the fish in the water. Move the effort slider across the peak and watch the yield retrace its own values while the stock keeps falling in one direction only. That asymmetry is the whole warning of this sheet.`;
  return `Upaya sebesar ${fmtPlain(kembar, 1)} memberi hasil tangkapan yang persis sama dengan yang ini, ${fmt(yieldNow, 1)} ton, tetapi menyisakan populasi ${fmt(stokKembar, 0)} ton berbanding ${fmt(stokKini, 0)} ton di sini. Dua perikanan yang melaporkan tangkapan yang sama persis, yang satu dengan ${fmt(Math.max(stokKini, stokKembar) / Math.max(Math.min(stokKini, stokKembar), 1e-9), 1)} kali lebih banyak ikan di dalam air. Geser slider upaya melewati puncaknya lalu perhatikan hasilnya menelusuri kembali nilai-nilainya sendiri sementara populasinya terus turun ke satu arah saja. Ketidaksetangkupan itulah seluruh peringatan lembar ini.`;
}
