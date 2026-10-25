"use client";

import { useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  Block,
  Hitungan,
  InputRow,
  InputTable,
  PresetRow,
  RegimeScale,
  ResultTable,
  Sheet,
  StateCard,
  Term,
} from "@/components/ui";
import { useCanvas } from "@/lib/useCanvas";
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import {
  G,
  RE_TURBULENT_MIN,
  colebrookFriction,
  fmt,
  fmtPlain,
  fmtSci,
  wallingfordVelocity,
  waterViscosity,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksWallingford } from "@/lib/checks";

const TXT = {
  id: {
    title: "Diagram Wallingford",
    sheetTitle: "Bagan Wallingford — kecepatan pipa penuh dari kemiringan hidrolik",
    dD: "Diameter dalam pipa",
    dS: "Kemiringan hidrolik",
    dKs: "Kekasaran mutlak dinding",
    dT: "Suhu air",
    pBeton: "Beton pracetak, 300 mm",
    pBesi: "Besi tuang lama, 600 mm",
    pPvc: "PVC halus, 150 mm",
    rV: "Kecepatan rata-rata",
    rQ: "Debit",
    rRe: "Bilangan Reynolds",
    rF: "Faktor gesekan yang menyertainya",
    rNu: "Kekentalan kinematik",
    rHf: "Kehilangan tinggi tekan per 100 m",
    rKsD: "Kekasaran relatif",
    luar: "Belum turbulen",
    bandLuar: "Belum turbulen, bagan tidak berlaku",
    bandTrans: "Turbulen transisi",
    bandKasar: "Kasar penuh, V ∝ √S",
    hNu: "Kekentalan kinematik dari suhu",
    hAkar: "Suku akar dan dua suku di dalam logaritma",
    hV: "Kecepatan, Colebrook-White dibalik",
    hQ: "Debit",
    hRe: "Bilangan Reynolds, pemeriksaan ≥ 4.000",
    hF: "Faktor gesekan, dihitung mundur",
    luarNote:
      "Bilangan Reynolds di bawah 4.000, jadi alirannya belum turbulen. Rumus Colebrook-White diturunkan untuk aliran turbulen dan tidak berlaku di bawah batas itu; bagan Wallingford pun tidak pernah dicetak untuk daerah ini. Kurvanya digambar titik rapat justru karena itu. Perbesar kemiringannya, perbesar pipanya, atau naikkan suhu airnya.",
    note:
      "Diagram Moody dan bagan ini menyelesaikan persamaan yang sama, tetapi menjawab pertanyaan yang berbeda, dan perbedaan itulah isi lembar ini. Moody menjawab berapa faktor gesekannya, dan sesudah itu masih tersisa satu persamaan yang harus diselesaikan untuk mendapat kecepatan. Bagan Wallingford menjawab berapa kecepatannya, sekali jalan. Yang membuatnya mungkin bukan pendekatan melainkan penyusunan ulang yang tepat: bila yang dicari kecepatan dan bukan faktor gesekan, Colebrook-White dapat dibalik secara tertutup, karena kecepatan muncul di kedua ruas dalam bentuk yang saling menghapus. Itu sebabnya perancang saluran air limbah memakai bagan ini, bukan Moody, dan tetap memakainya lama setelah kalkulator tersedia. Perhatikan bahwa faktor gesekan tetap ditampilkan di tabel hasil, tetapi ia dihitung mundur dari kecepatan, bukan dipakai untuk menghitungnya.",
  },
  en: {
    title: "Wallingford chart",
    sheetTitle: "Wallingford chart — full-pipe velocity from the hydraulic gradient",
    dD: "Internal pipe diameter",
    dS: "Hydraulic gradient",
    dKs: "Absolute wall roughness",
    dT: "Water temperature",
    pBeton: "Precast concrete, 300 mm",
    pBesi: "Old cast iron, 600 mm",
    pPvc: "Smooth PVC, 150 mm",
    rV: "Mean velocity",
    rQ: "Discharge",
    rRe: "Reynolds number",
    rF: "The friction factor that accompanies it",
    rNu: "Kinematic viscosity",
    rHf: "Head loss per 100 m",
    rKsD: "Relative roughness",
    luar: "Not yet turbulent",
    bandLuar: "Not yet turbulent, chart does not apply",
    bandTrans: "Transitional turbulent",
    bandKasar: "Fully rough, V ∝ √S",
    hNu: "Kinematic viscosity from temperature",
    hAkar: "Root term and the two terms inside the logarithm",
    hV: "Velocity, Colebrook-White inverted",
    hQ: "Discharge",
    hRe: "Reynolds number, check ≥ 4,000",
    hF: "Friction factor, computed backwards",
    luarNote:
      "The Reynolds number is below 4,000, so the flow is not yet turbulent. Colebrook-White was derived for turbulent flow and does not hold below that limit; the Wallingford charts were never printed for this region either. That is exactly why the curve is drawn with fine dots. Increase the gradient, enlarge the pipe, or raise the water temperature.",
    note:
      "The Moody chart and this one solve the same equation but answer different questions, and that difference is the substance of this sheet. Moody answers what the friction factor is, after which one equation still remains to be solved for the velocity. The Wallingford chart answers what the velocity is, in a single step. What makes that possible is not an approximation but an exact rearrangement: if the unknown is the velocity rather than the friction factor, Colebrook-White can be inverted in closed form, because the velocity appears on both sides in forms that cancel. That is why sewer designers use this chart rather than Moody, and kept using it long after calculators arrived. Note that the friction factor is still shown in the results table, but it is computed backwards from the velocity rather than used to obtain it.",
  },
} as const;

const REFS = {
  id: [
    "Colebrook, C.F. (1939). Turbulent flow in pipes. Journal of the ICE, vol. 11.",
    "Barr, D.I.H. & HR Wallingford (2006). Tables for the Hydraulic Design of Pipes, Sewers and Channels, edisi ke-8. Thomas Telford.",
    "Butler, D. & Davies, J. (2011). Urban Drainage, edisi ke-3. Spon Press, Bab 8.",
  ],
  en: [
    "Colebrook, C.F. (1939). Turbulent flow in pipes. Journal of the ICE, vol. 11.",
    "Barr, D.I.H. & HR Wallingford (2006). Tables for the Hydraulic Design of Pipes, Sewers and Channels, 8th ed. Thomas Telford.",
    "Butler, D. & Davies, J. (2011). Urban Drainage, 3rd ed. Spon Press, Chapter 8.",
  ],
} as const;

/** Keluarga diameter yang digambar sebagai kurva latar, meter. */
const KELUARGA_D = [0.075, 0.1, 0.15, 0.225, 0.3, 0.45, 0.6, 0.9, 1.2, 1.8];

const V_MIN = 0.05;
/* Sumbu V harus memuat hasil penggeser (aturan §5): D 1800, S 100 ‰, ks 0,
   T 40 memberi V 23,7 m/s. Dulu 8 m/s, titik jadi "di luar diagram". */
const V_MAX = 30;
const S_MIN = 1e-4;
const S_MAX = 1e-1;

/* Sumbu pita Re 5·10²–10⁸ memuat penggeser (878 pada D 50, S 0,1 ‰, ks 6,
   T 4; 6,44·10⁷ pada D 1800, S 100 ‰, ks 0, T 40). */
const RE_AXIS_MIN = 5e2;
const RE_AXIS_MAX = 1e8;

/*
 * Re awal kasar penuh: Re·(ks/D)·√f = 200 dengan f Colebrook, kriteria yang
 * sama dengan PI-01 dan garis putus drawMoody. Bagi dua pada log Re.
 */
function reKasarPenuh(rr: number): number {
  if (rr <= 0) return Infinity;
  const g = (lg: number) => {
    const Re = 10 ** lg;
    return Re * rr * Math.sqrt(colebrookFriction(Re, rr)) - 200;
  };
  let lo = Math.log10(RE_TURBULENT_MIN);
  let hi = Math.log10(RE_AXIS_MAX);
  if (g(lo) >= 0) return RE_TURBULENT_MIN;
  if (g(hi) < 0) return Infinity;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (g(m) >= 0) hi = m;
    else lo = m;
  }
  return 10 ** hi;
}

export function DiagramWallingfordClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [D, setD] = useState(0.3);
  const [S, setS] = useState(0.005);
  const [ksMm, setKsMm] = useState(0.6);
  const [suhu, setSuhu] = useState(15);

  const nu = waterViscosity(suhu);
  const ks = ksMm / 1000;
  const r = wallingfordVelocity(D, S, ks, nu);

  const luar = r.outOfRange;
  // Di bawah Re 4000 Colebrook-White tidak berlaku: V, Q, f ditulis "—".
  const sah = (v: number) => (luar ? NaN : v);
  const akar = Math.sqrt(2 * G * D * S);
  const sukuKs = ks / (3.7 * D);
  const sukuNu = (2.51 * nu) / (D * akar);
  const reKp = Math.min(Math.max(reKasarPenuh(ks / D), RE_TURBULENT_MIN), RE_AXIS_MAX);
  const kasarPenuh = !luar && ks > 0 && r.Re >= reKp;
  const bands = [
    { from: RE_AXIS_MIN, to: RE_TURBULENT_MIN, label: x.bandLuar, tone: "invalid" as Tone },
    { from: RE_TURBULENT_MIN, to: reKp, label: x.bandTrans, tone: "water" as Tone },
    { from: reKp, to: RE_AXIS_MAX, label: x.bandKasar, tone: "neutral" as Tone },
  ].filter((b) => b.to > b.from);

  const ref = useCanvas(
    (ctx, w, h) => {
      const kurvaUntuk = (Dk: number) => {
        const pts: { x: number; y: number }[] = [];
        for (let lg = Math.log10(S_MIN); lg <= Math.log10(S_MAX) + 1e-9; lg += 0.04) {
          // Dijepit ke batas bidangnya, karena penjumlahan langkah logaritma
          // melewatkan titik terakhirnya beberapa angka pecahan di luar batas.
          const Sk = Math.min(Math.pow(10, lg), S_MAX);
          const v = wallingfordVelocity(Dk, Sk, ks, nu);
          if (v.V > 0) pts.push({ x: Sk, y: v.V });
        }
        return pts;
      };

      /*
       * Label ditaruh di tempat kurvanya MENINGGALKAN bidang, bukan pada
       * pecahan panjang yang tetap.
       *
       * Kurva pipa besar keluar lewat tepi atas jauh sebelum sampai tepi
       * kanan. Label pada pecahan tetap karena itu jatuh di luar bidang lalu
       * dibuang seluruhnya, dan pembaca melihat garis kelabu tanpa nama.
       * Diletakkan di titik keluarnya, tiap kurva mendapat namanya di tempat
       * ia masih terlihat, dan karena tiap kurva keluar pada kemiringan yang
       * berbeda, labelnya tersebar mendatar alih-alih bertumpuk.
       */
      const tandai = (
        pts: { x: number; y: number }[]
      ): Pick<ChartSeries, "labelAt" | "labelDy" | "labelAlign"> => {
        let i = pts.length - 1;
        while (i > 0 && pts[i].y > V_MAX * 0.99) i--;
        const lewatAtas = i < pts.length - 1;
        return {
          labelAt: pts.length > 1 ? i / (pts.length - 1) : 1,
          labelDy: lewatAtas ? 14 : -8,
          labelAlign: (lewatAtas ? "center" : "right") as CanvasTextAlign,
        };
      };

      // Keluarga diameter baku, latar belakang untuk membaca pipa lain.
      const deret: ChartSeries[] = KELUARGA_D.map((Dk) => {
        const pts = kurvaUntuk(Dk);
        return {
          pts,
          color: C.ink3,
          weight: W.hair,
          dash: DASH.solid,
          label:
            Math.abs(Dk - D) < 1e-9 ? undefined : `${fmtPlain(Dk * 1000, 0)}`,
          ...tandai(pts),
        };
      });

      /*
       * Pipa yang sedang dipilih, SELALU digambar sebagai kurvanya sendiri.
       *
       * Sebelumnya kurva tebal hanya muncul bila diameternya kebetulan
       * salah satu dari sepuluh ukuran baku, padahal penggesernya melangkah
       * lima milimeter. Hampir seluruh posisi penggeser karena itu tidak
       * punya kurva tebal sama sekali, dan titik kerjanya melayang di antara
       * garis kelabu tanpa kurva yang menjelaskannya.
       */
      const terpilih = kurvaUntuk(D);
      deret.push({
        pts: terpilih,
        color: C.water,
        weight: W.bold,
        dash: DASH.solid,
        label: `${fmtPlain(D * 1000, 0)}`,
        ...tandai(terpilih),
      });

      // Ruas yang belum turbulen pada pipa terpilih, digambar titik rapat.
      const takBerlaku: { x: number; y: number }[] = [];
      for (let lg = Math.log10(S_MIN); lg <= Math.log10(S_MAX) + 1e-9; lg += 0.02) {
        const Sk = Math.pow(10, lg);
        const v = wallingfordVelocity(D, Sk, ks, nu);
        if (v.Re < RE_TURBULENT_MIN && v.V > 0) takBerlaku.push({ x: Sk, y: v.V });
      }
      // Didorong paling akhir supaya tergambar di atas kurva pipanya.
      if (takBerlaku.length > 1)
        deret.push({
          pts: takBerlaku,
          color: C.signal,
          weight: W.thin,
          dash: DASH.invalid,
        });

      drawChart(
        ctx,
        w,
        h,
        {
          xMin: S_MIN,
          xMax: S_MAX,
          yMin: V_MIN,
          yMax: V_MAX,
          xLog: true,
          yLog: true,
          axisX: T.axGradient,
          axisY: T.axMeanVelocity,
          series: deret,
          point: {
            x: S,
            y: r.V,
            label: `${fmtPlain(r.V, 3)} m/s`,
            invalid: r.outOfRange,
          },
          regions: [
            {
              x: 1.6e-4,
              y: 18,
              text: `${T.wallRoughness} ${fmtPlain(ksMm, 3)} mm`,
              color: C.ink3,
            },
          ],
          padRight: 46,
        },
        lang
      );
    },
    [D, S, ksMm, suhu, lang]
  );

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="Re"
          value={r.Re}
          scale="log"
          digits={0}
          invalid={luar}
          bands={bands}
        />
      }
      sheet="PI-02"
      subject={SUBJECTS.PI[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Persamaan yang sama dengan diagram Moody, pertanyaan yang berbeda.
            Di sini yang dicari <Term tint={C.water}>kecepatan</Term>, dan
            begitu pertanyaannya diubah, Colebrook-White ternyata dapat dibalik
            tanpa iterasi sama sekali.
          </p>
        ) : (
          <p>
            The same equation as the Moody chart, a different question. Here the
            unknown is the <Term tint={C.water}>velocity</Term>, and once the
            question changes, Colebrook-White turns out to be invertible with no
            iteration at all.
          </p>
        )
      }
      drawing={
        <Sheet
          number="PI-02"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m/s)" },
            { label: "D", value: `${fmtPlain(D * 1000, 0)} mm` },
            { label: "S", value: fmtSci(S) },
            { label: "V", value: luar ? "—" : `${fmt(r.V, 3)} m/s`, tint: C.water },
            {
              label: "Re",
              value: fmtSci(r.Re),
              tint: r.outOfRange ? C.signal : undefined,
            },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="D" label={x.dD} value={D * 1000} min={50} max={1800} step={5} digits={0} unit="mm" onChange={(v) => setD(v / 1000)} tint={C.water} />
              <InputRow symbol="S" label={x.dS} value={S * 1000} min={0.1} max={100} step={0.1} digits={1} unit="‰" onChange={(v) => setS(v / 1000)} />
              <InputRow symbol="ks" label={x.dKs} value={ksMm} min={0} max={6} step={0.015} digits={3} unit="mm" onChange={setKsMm} />
              <InputRow symbol="T" label={x.dT} value={suhu} min={4} max={40} step={0.5} digits={1} unit="°C" onChange={setSuhu} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pBeton, apply: () => { setD(0.3); setS(0.005); setKsMm(0.6); setSuhu(15); } },
                  { label: x.pBesi, apply: () => { setD(0.6); setS(0.002); setKsMm(3); setSuhu(15); } },
                  { label: x.pPvc, apply: () => { setD(0.15); setS(0.01); setKsMm(0.015); setSuhu(15); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "V", label: x.rV, value: fmt(sah(r.V), 4), unit: luar ? undefined : "m/s", tint: C.water, strong: true },
                { symbol: "Q", label: x.rQ, value: fmt(sah(r.Q * 1000), 2), unit: luar ? undefined : "l/s", tint: C.water, strong: true },
                { symbol: "Re", label: x.rRe, value: fmtSci(r.Re), tint: luar ? C.signal : undefined },
                { symbol: "f", label: x.rF, value: fmt(sah(r.f), 5), tint: C.energy },
                { symbol: "ks/D", label: x.rKsD, value: ks > 0 ? fmtSci(ks / D) : fmt(0, 0) },
                { symbol: "hf", label: x.rHf, value: fmt(S * 100, 3), unit: "m", tint: C.energy },
                { symbol: "ν", label: x.rNu, value: fmtSci(nu), unit: "m²/s" },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hNu,
                    rumus: (<><span>ν =</span><Frac num={`${fmt(1.79, 2)} · 10⁻⁶`} den={`1 + ${fmt(0.03368, 5)} T + ${fmt(0.000221, 6)} T²`} /></>),
                    isi: `${fmt(1.79, 2)} · 10⁻⁶ / ( 1 + ${fmt(0.03368, 5)} · ${fmt(suhu, 1)} + ${fmt(0.000221, 6)} · ${fmt(suhu, 1)}² )`,
                    hasil: fmtSci(nu),
                    satuan: "m²/s",
                  },
                  {
                    judul: x.hAkar,
                    rumus: (
                      <>
                        <span>√( 2 g D S ),</span>
                        <Frac num="ks" den={`${fmt(3.7, 1)} D`} />
                        <span>,</span>
                        <Frac num={`${fmt(2.51, 2)} ν`} den="D √( 2 g D S )" />
                      </>
                    ),
                    isi: `√( 2 · ${fmt(G, 2)} · ${fmt(D, 3)} · ${fmt(S, 4)} ) = ${fmt(akar, 4)};  ${fmt(ks, 6)} / ( ${fmt(3.7, 1)} · ${fmt(D, 3)} ) = ${sukuKs > 0 ? fmtSci(sukuKs) : fmt(0, 0)};  ${fmt(2.51, 2)} · ${fmtSci(nu)} / ( ${fmt(D, 3)} · ${fmt(akar, 4)} ) = ${fmtSci(sukuNu)}`,
                    hasil: fmt(akar, 4),
                    satuan: "m/s",
                  },
                  {
                    judul: x.hV,
                    rumus: <span>V = −2 √( 2 g D S ) · log₁₀[ … + … ]</span>,
                    isi: luar ? "—" : `−2 · ${fmt(akar, 4)} · log₁₀( ${sukuKs > 0 ? fmtSci(sukuKs) : fmt(0, 0)} + ${fmtSci(sukuNu)} )`,
                    hasil: fmt(sah(r.V), 4),
                    satuan: luar ? undefined : "m/s",
                    tint: C.water,
                  },
                  {
                    judul: x.hQ,
                    rumus: (<><span>Q = V ·</span><Frac num="π D²" den="4" /></>),
                    isi: luar ? "—" : `${fmt(r.V, 5)} · π · ${fmt(D, 3)}² / 4 · 1000`,
                    hasil: fmt(sah(r.Q * 1000), 2),
                    satuan: luar ? undefined : "l/s",
                    tint: C.water,
                  },
                  {
                    judul: x.hRe,
                    rumus: (<><span>Re =</span><Frac num="V · D" den="ν" /><span>≥ {fmt(RE_TURBULENT_MIN, 0)}</span></>),
                    isi: `${fmt(r.V, 5)} · ${fmt(D, 3)} / ${fmtSci(nu)}`,
                    hasil: fmtSci(r.Re),
                    tint: luar ? C.signal : undefined,
                  },
                  {
                    judul: x.hF,
                    rumus: (<><span>f =</span><Frac num="2 g D S" den="V²" /></>),
                    isi: luar ? "—" : `2 · ${fmt(G, 2)} · ${fmt(D, 3)} · ${fmt(S, 4)} / ${fmt(r.V, 5)}²`,
                    hasil: fmt(sah(r.f), 5),
                    tint: C.energy,
                  },
                ]}
              />
            </div>
          </Block>

          {luar ? (
            <StateCard
              tone="invalid"
              badge={x.luar}
              state={
                lang === "id"
                  ? `Re = ${fmtSci(r.Re)} < ${fmt(RE_TURBULENT_MIN, 0)}: aliran belum turbulen, rumus tidak berlaku.`
                  : `Re = ${fmtSci(r.Re)} < ${fmt(RE_TURBULENT_MIN, 0)}: the flow is not yet turbulent, the formula does not apply.`
              }
              notice={[x.luarNote]}
            />
          ) : (
            <StateCard
              tone={kasarPenuh ? "neutral" : "water"}
              badge={kasarPenuh ? x.bandKasar : x.bandTrans}
              {...notice(r.V, r.Q, D, S, ks, nu, lang)}
            />
          )}
        </>
      }
      verification={<Verification checks={checksWallingford(D, S, ks, nu)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>V = −2 √(2 g D S) · log₁₀</span>
                <span className="ml-1">[</span>
                <Frac num="ks" den="3,7 D" />
                <span>+</span>
                <Frac num="2,51 ν" den="D √(2 g D S)" />
                <span>]</span>
              </Eq>
              <Eq>
                <span>S =</span>
                <Frac num="hf" den="L" />
                <span className="ml-5">f =</span>
                <Frac num="2 g D S" den="V²" />
                <span className="ml-2 text-ink-3">
                  {lang === "id"
                    ? "dihitung mundur, bukan dipakai maju"
                    : "computed backwards, not used forwards"}
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

/*
 * Isi kalimatnya sama dengan catatan lama; kalimat pertama menyatakan
 * keadaan, sisanya butir. Nisbah V(4S)/V dibaca dari model: bila praktis
 * tepat dua (kasar penuh), kalimat "bukan tepat dua" tidak lagi benar.
 */
function notice(
  V: number,
  Q: number,
  D: number,
  S: number,
  ks: number,
  nu: number,
  lang: Lang
): { state: string; notice: string[] } {
  const dua = wallingfordVelocity(D, S * 4, ks, nu).V;
  const rasio = V > 0 ? dua / V : 0;
  const tepatDua = Math.abs(rasio - 2) < 0.005;
  const keadaan =
    lang === "en"
      ? `V = ${fmt(V, 3)} m/s, Q = ${fmt(Q * 1000, 2)} l/s at S = ${fmt(S * 1000, 1)} ‰.`
      : `V = ${fmt(V, 3)} m/s, Q = ${fmt(Q * 1000, 2)} l/s pada S = ${fmt(S * 1000, 1)} ‰.`;

  if (lang === "en")
    return {
      state: keadaan,
      notice: tepatDua
        ? [
            `Quadruple the gradient and the velocity rises by ${fmt(rasio, 3)} times, practically exactly two: the flow is fully rough, the friction factor no longer depends on the Reynolds number, and V follows √S.`,
            "Set the roughness to zero and watch the ratio climb above two, because on a smooth pipe the viscous term still matters.",
          ]
        : [
            `Quadruple the gradient and the velocity rises by ${fmt(rasio, 3)} times, not exactly two. A pure square-root law would give exactly two; the excess appears because the friction factor itself falls as the flow speeds up, and it is largest on smooth pipes where the viscous term still matters.`,
            "Set the roughness to zero and watch the excess grow; set it to several millimetres and watch the ratio settle onto two, which is the signature of fully rough flow where the friction factor no longer depends on the Reynolds number at all.",
          ],
    };
  return {
    state: keadaan,
    notice: tepatDua
      ? [
          `Lipatempatkan kemiringannya dan kecepatannya naik ${fmt(rasio, 3)} kali, praktis tepat dua: alirannya kasar penuh, faktor gesekan sudah tidak bergantung pada bilangan Reynolds, dan V mengikuti √S.`,
          "Setel kekasarannya ke nol lalu perhatikan perbandingannya naik di atas dua, karena pada pipa licin suku kekentalan masih berpengaruh.",
        ]
      : [
          `Lipatempatkan kemiringannya dan kecepatannya naik ${fmt(rasio, 3)} kali, bukan tepat dua. Hukum akar murni akan memberi tepat dua; kelebihannya muncul karena faktor gesekannya sendiri turun ketika alirannya mengencang, dan kelebihan itu paling besar pada pipa licin tempat suku kekentalan masih berpengaruh.`,
          "Setel kekasarannya ke nol lalu perhatikan kelebihan itu membesar; setel ke beberapa milimeter lalu perhatikan perbandingannya turun ke dua, dan dua itulah tanda aliran kasar penuh tempat faktor gesekan sudah tidak bergantung pada bilangan Reynolds sama sekali.",
        ],
  };
}
