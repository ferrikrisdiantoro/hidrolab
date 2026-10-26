"use client";

import { useRef, useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  Block,
  Hitungan,
  InputRow,
  InputTable,
  PresetRow,
  RegimeScale,
  ResultTable,
  SentuhContoh,
  Sheet,
  StateCard,
  Term,
} from "@/components/ui";
import { usePlate } from "@/lib/usePlate";
import { DragLayer, type HandleSpec } from "@/components/DragLayer";
import type { ParamDef } from "@/lib/rentang";
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import { fmt, fmtPlain, schaeferHarvest } from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
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
    lestari: "Di bawah MSY",
    satR: "th⁻¹",
    satY: "ton/th",
    axY: "hasil lestari, ton/th",
    bRuntuh: "Runtuh, model logistik tidak berlaku",
    bLebih: "Tangkap lebih",
    bBawah: "Di bawah MSY",
    hN: "Populasi pada keadaan mantap",
    hY: "Hasil pada upaya ini",
    hMsy: "Hasil lestari maksimum dan upayanya",
    hdlE: "Titik kerja: geser mendatar untuk mengubah upaya penangkapan E",
    hSel: "Selisih upaya dan populasi nisbi",
    habis: "Pada upaya ini populasinya habis; tidak ada upaya kembar.",
    puncak: "Ini puncaknya; tidak ada upaya kembar, karena hasil sebesar MSY hanya dicapai pada satu upaya.",
    nol: "Tanpa upaya tidak ada tangkapan. Satu-satunya upaya lain yang juga memberi nol adalah upaya yang menghabiskan populasinya.",
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
    lestari: "Below MSY",
    satR: "y⁻¹",
    satY: "t/y",
    axY: "sustainable yield, t/y",
    bRuntuh: "Collapsed, logistic model invalid",
    bLebih: "Overfished",
    bBawah: "Below MSY",
    hN: "Equilibrium stock",
    hY: "Yield at this effort",
    hMsy: "Maximum sustainable yield and its effort",
    hdlE: "Operating point: drag sideways to change the fishing effort E",
    hSel: "Effort margin and relative stock",
    habis: "At this effort the stock is exhausted; there is no twin effort.",
    puncak: "This is the peak; there is no twin effort, because a yield equal to MSY is reached at only one effort.",
    nol: "With no effort there is no catch. The only other effort that also gives zero is the one that exhausts the stock.",
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

/* Rentang upaya E, dipakai bersama penggeser, kotak angka, dan pegangan
   titik kerja (aturan 4: satu sumber nilai). */
const P_E: ParamDef = { min: 0, max: 150, step: 1, digits: 0 };

export function AturanPanenClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [r0, setR0] = useState(0.5);
  const [K, setK] = useState(1000);
  const [q, setQ] = useState(0.01);
  const [E, setE] = useState(20);
  // Pemadam tanda contoh untuk pegangan seret (lihat SentuhContoh).
  const sentuh = useRef<() => void>(() => {});
  /*
   * Ujung sumbu upaya dikunci selama pegangan diseret. Tanpa kunci, saat
   * E·1,05 > ujung kurva, sumbu ikut melebar dengan E: titik kerja selalu
   * di 95 % lebar bidang, dan tiap piksel geseran memperbesar E berlipat
   * (saling kejar). Dilepas = sumbu kembali dihitung dari E.
   */
  const [kunciE, setKunciE] = useState<number | null>(null);

  const r = schaeferHarvest(r0, K, q, E);
  const eKurva = r.curve[r.curve.length - 1].effort;
  /* Sumbu memuat upaya penggeser: pada r kecil dan q besar kurva model
     berhenti di 1,4 r/q, jauh di kiri E. Di luar r/q populasinya nol, jadi
     perpanjangan kurva ke kanan bernilai nol menurut model yang sama. */
  const eMaxBebas = Math.max(eKurva, E * 1.05);
  const eMax = kunciE ?? eMaxBebas;
  const nada: Tone = r.collapsed ? "invalid" : r.overfished ? "caution" : "pass";
  const badge = r.collapsed ? x.runtuh : r.overfished ? x.berlebih : x.lestari;

  const plate = usePlate(
    (ctx, w, h) => {
      const deret: ChartSeries[] = [
        {
          pts: [
            ...r.curve.map((p) => ({ x: p.effort, y: p.yield })),
            ...(eMax > eKurva ? [{ x: eMax, y: 0 }] : []),
          ],
          color: C.water,
          weight: W.bold,
          fill: C.waterFill,
        },
        {
          // Populasi diskalakan supaya muat pada sumbu yang sama; yang penting
          // bentuknya, yaitu turun lurus sementara hasilnya memuncak.
          pts: [
            ...r.curve.map((p) => ({
              x: p.effort,
              y: (p.stock / K) * r.msy * 1.2,
            })),
            ...(eMax > eKurva ? [{ x: eMax, y: 0 }] : []),
          ],
          color: C.ink3,
          weight: W.hair,
          dash: DASH.hidden,
          label: lang === "id" ? "populasi" : "stock",
          labelAt: 0.3,
          labelDy: 14,
        },
      ];

      return drawChart(
        ctx,
        w,
        h,
        {
          xMin: 0,
          xMax: eMax,
          yMin: 0,
          yMax: r.msy * 1.35,
          axisX: T.axEffort,
          axisY: x.axY,
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
            invalid: r.collapsed,
          },
          heading: r.collapsed ? x.runtuh : undefined,
          headingColor: C.signal,
          // Titik kerja sendiri (bukan `point`, yang hilang di luar bidang
          // saat sumbu dikunci): DragLayer menjepitnya ke tepi bidang.
          anchors: { kerja: { x: E, y: r.currentYield } },
        },
        lang
      );
    },
    null,
    [r0, K, q, E, eMax, lang]
  );

  /*
   * Posisi tegak titik kerja adalah hasil Y(E), HASIL model, jadi titik
   * hanya diseret mendatar: sumbu datar adalah E, masukan langsung.
   */
  const handles: HandleSpec[] = [
    {
      id: "kerja",
      anchor: "kerja",
      axis: "x",
      label: x.hdlE,
      hollow: true,
      param: P_E,
      value: E,
      toValue: (px, _py, m) => m.invX(px),
      onChange: setE,
      format: (v) => `E ${fmt(v, 0)}`,
    },
  ];
  const lepasKunci = () => setKunciE(null);

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="N/K"
          value={r.stock / K}
          invalid={r.collapsed}
          digits={2}
          bands={[
            { from: 0, to: 0.05, label: x.bRuntuh, tone: "invalid" },
            { from: 0.05, to: 0.5 - 1e-9, label: x.bLebih, tone: "caution" },
            { from: 0.5, to: 1, label: x.bBawah, tone: "pass" },
          ]}
        />
      }
      sheet="EK-02"
      subject={SUBJECTS.EK[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Kurva hasil lestari <Term tint={C.critical}>menurun</Term> sesudah
            puncaknya, dan karena itu satu angka hasil tangkapan selalu punya{" "}
            <Term tint={C.water}>dua penafsiran</Term> yang berlawanan.
          </p>
        ) : (
          <p>
            The sustainable yield curve <Term tint={C.critical}>falls</Term> after
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
            { label: t.tbUnit, value: `SI (ton, ${x.satR})` },
            { label: "MSY", value: `${fmt(r.msy, 1)} t`, tint: C.critical },
            { label: "E", value: fmt(E, 1), tint: r.overfished ? C.caution : undefined },
            { label: "Y", value: `${fmt(r.currentYield, 1)} t`, tint: C.water },
            { label: "N", value: `${fmt(r.stock, 0)} t`, tint: r.collapsed ? C.signal : undefined },
          ]}
        >
          <canvas ref={plate.ref} className="block h-full w-full" />
          {/* display: contents, jadi pembungkus tidak membuat kotak; hanya
              menangkap pointerdown/lepas yang menggelembung dari pegangan
              untuk mengunci sumbu. */}
          <div
            className="contents"
            onPointerDown={() => setKunciE(eMax)}
            onPointerUp={lepasKunci}
            onPointerCancel={lepasKunci}
            onLostPointerCapture={lepasKunci}
          >
            <DragLayer out={plate.outRef.current} handles={handles} touch={() => sentuh.current()} />
          </div>
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <SentuhContoh sentuh={sentuh} />
            <InputTable>
              <InputRow symbol="r" label={x.dR} value={r0} min={0.05} max={2} step={0.05} digits={2} unit={x.satR} onChange={setR0} />
              <InputRow symbol="K" label={x.dK} value={K} min={50} max={20000} step={50} digits={0} unit="ton" onChange={setK} />
              <InputRow symbol="q" label={x.dQ} value={q * 1000} min={1} max={50} step={0.5} digits={1} unit="×10⁻³" onChange={(v) => setQ(v / 1000)} />
              <InputRow symbol="E" label={x.dE} value={E} {...P_E} onChange={setE} />
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
            <ResultTable
              rows={[
                { symbol: "Y", label: x.rYield, value: fmt(r.currentYield, 2), unit: x.satY, tint: C.water, strong: true },
                { symbol: "MSY", label: x.rMsy, value: fmt(r.msy, 2), unit: x.satY, tint: C.critical, strong: true },
                { symbol: "Emsy", label: x.rEmsy, value: fmt(r.effortAtMsy, 2) },
                { symbol: "N", label: x.rStock, value: fmt(r.stock, 1), unit: "ton", tint: r.collapsed ? C.signal : undefined },
                { symbol: "N/K", label: x.rStockPct, value: fmt((r.stock / K) * 100, 1), unit: "%" },
                { symbol: "—", label: x.rCadangan, value: fmt(r.effortAtMsy - E, 2), tint: r.overfished ? C.caution : undefined },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hN,
                    rumus: (<><span>N* = K · ( 1 −</span><Frac num="q · E" den="r" /><span>)</span></>),
                    isi: `${fmt(K, 0)} · ( 1 − ${fmt(q, 4)} · ${fmt(E, 0)} / ${fmt(r0, 2)} )${r.stock === 0 ? `  → ${lang === "id" ? "negatif, dipotong ke 0" : "negative, cut to 0"}` : ""}`,
                    hasil: fmt(r.stock, 1),
                    satuan: "ton",
                    tint: r.collapsed ? C.signal : undefined,
                  },
                  {
                    judul: x.hY,
                    rumus: <span>Y = q · E · N*</span>,
                    isi: `${fmt(q, 4)} · ${fmt(E, 0)} · ${fmt(r.stock, 2)}`,
                    hasil: fmt(r.currentYield, 2),
                    satuan: x.satY,
                    tint: C.water,
                  },
                  {
                    judul: x.hMsy,
                    rumus: (<><span>MSY =</span><Frac num="r · K" den="4" /><span>;  Emsy =</span><Frac num="r" den="2 · q" /></>),
                    isi: `${fmt(r0, 2)} · ${fmt(K, 0)} / 4 ;  ${fmt(r0, 2)} / ( 2 · ${fmt(q, 4)} ) = ${fmt(r.effortAtMsy, 2)}`,
                    hasil: fmt(r.msy, 2),
                    satuan: x.satY,
                    tint: C.critical,
                  },
                  {
                    judul: x.hSel,
                    rumus: <span>Emsy − E ;  N* / K</span>,
                    isi: `${fmt(r.effortAtMsy, 2)} − ${fmt(E, 0)} ;  ${fmt(r.stock, 1)} / ${fmt(K, 0)} = ${fmt((r.stock / K) * 100, 1)} %`,
                    hasil: fmt(r.effortAtMsy - E, 2),
                    tint: r.overfished ? C.caution : undefined,
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={nada}
            badge={badge}
            {...notice(r0, K, q, E, r, lang)}
          />
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
  r: ReturnType<typeof schaeferHarvest>,
  lang: Lang
): { state: string; notice: string[] } {
  const x = TXT[lang];
  const en = lang === "en";
  const eMsy = r.effortAtMsy;

  const state = en
    ? `Y = ${fmt(r.currentYield, 1)} t/y of an MSY of ${fmt(r.msy, 1)}; effort ${E > eMsy ? "above" : E < eMsy ? "below" : "at"} Emsy ${fmt(eMsy, 1)}.`
    : `Y = ${fmt(r.currentYield, 1)} ton/th dari MSY ${fmt(r.msy, 1)}; upaya ${E > eMsy ? "di atas" : E < eMsy ? "di bawah" : "tepat di"} Emsy ${fmt(eMsy, 1)}.`;

  const butir: string[] = [];
  if (r.overfished) butir.push(x.berlebihNote);
  if (r.collapsed) butir.push(x.runtuhNote);

  /* Upaya lain yang memberi hasil yang sama persis, di sisi berlawanan
     puncak. Tidak ada bila populasinya habis (kembar negatif dan stoknya
     di atas K), tepat di puncak, atau tanpa upaya. */
  const kembar = 2 * eMsy - E;
  if (r.stock <= 0 || kembar < 0) {
    butir.push(x.habis);
  } else if (Math.abs(E - eMsy) < 1e-9) {
    butir.push(x.puncak);
  } else if (E === 0) {
    butir.push(x.nol);
  } else {
    const stokKembar = Math.max(K * (1 - (q * kembar) / r0), 0);
    const stokKini = r.stock;
    const rasio = Math.max(stokKini, stokKembar) / Math.max(Math.min(stokKini, stokKembar), 1e-9);
    butir.push(
      en
        ? `An effort of ${fmtPlain(kembar, 1)} gives exactly the same catch as this one, ${fmt(r.currentYield, 1)} tonnes, but leaves a stock of ${fmt(stokKembar, 0)} tonnes against ${fmt(stokKini, 0)} here: identical landings, one with ${fmt(rasio, 1)} times the fish in the water.`
        : `Upaya sebesar ${fmtPlain(kembar, 1)} memberi hasil tangkapan yang persis sama dengan yang ini, ${fmt(r.currentYield, 1)} ton, tetapi menyisakan populasi ${fmt(stokKembar, 0)} ton berbanding ${fmt(stokKini, 0)} ton di sini: tangkapan sama persis, yang satu dengan ${fmt(rasio, 1)} kali lebih banyak ikan di dalam air.`
    );
  }
  butir.push(
    en
      ? "Move the effort across the peak and the yield retraces its own values while the stock keeps falling in one direction only. That asymmetry is the whole warning of this sheet."
      : "Geser upaya melewati puncaknya dan hasilnya menelusuri kembali nilai-nilainya sendiri, sementara populasinya terus turun ke satu arah saja. Ketidaksetangkupan itulah seluruh peringatan lembar ini."
  );
  return { state, notice: butir };
}
