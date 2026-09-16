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
import {
  RE_TURBULENT_MIN,
  fmt,
  fmtPlain,
  fmtSci,
  wallingfordVelocity,
  waterViscosity,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksWallingford } from "@/lib/checks";

const TXT = {
  id: {
    title: "Diagram Wallingford",
    sheetTitle: "Bagan Wallingford — kecepatan pipa penuh dari kemiringan hidrolik",
    dD: "Garis tengah dalam pipa",
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

/** Keluarga garis tengah yang digambar sebagai kurva latar, meter. */
const KELUARGA_D = [0.075, 0.1, 0.15, 0.225, 0.3, 0.45, 0.6, 0.9, 1.2, 1.8];

const V_MIN = 0.05;
const V_MAX = 8;
const S_MIN = 1e-4;
const S_MAX = 1e-1;

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

      // Keluarga garis tengah baku, latar belakang untuk membaca pipa lain.
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
       * Sebelumnya kurva tebal hanya muncul bila garis tengahnya kebetulan
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
              y: 5.2,
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
            { label: "V", value: `${fmt(r.V, 3)} m/s`, tint: C.water },
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
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={r.outOfRange ? undefined : C.water} alert={r.outOfRange}>
                {`${fmt(r.V, 3)} m/s`}
              </Flag>
              {r.outOfRange && <Flag alert>{x.luar}</Flag>}
            </div>
            {r.outOfRange && (
              <div className="mb-2.5">
                <Note>{x.luarNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "V", label: x.rV, value: fmt(r.V, 4), unit: "m/s", tint: C.water, strong: true },
                { symbol: "Q", label: x.rQ, value: fmt(r.Q * 1000, 2), unit: "l/s", tint: C.water, strong: true },
                { symbol: "Re", label: x.rRe, value: fmtSci(r.Re), tint: r.outOfRange ? C.signal : undefined },
                { symbol: "f", label: x.rF, value: fmt(r.f, 5), tint: C.energy },
                { symbol: "ks/D", label: x.rKsD, value: fmtSci(ks / D) },
                { symbol: "hf", label: x.rHf, value: fmt(S * 100, 3), unit: "m", tint: C.energy },
                { symbol: "ν", label: x.rNu, value: fmtSci(nu), unit: "m²/s" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(r.V, r.f, D, S, ks, nu, lang)}</Note>
          </Block>
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

function notice(
  V: number,
  f: number,
  D: number,
  S: number,
  ks: number,
  nu: number,
  lang: Lang
): string {
  const dua = wallingfordVelocity(D, S * 4, ks, nu).V;
  const rasio = V > 0 ? dua / V : 0;

  if (lang === "en")
    return `Quadruple the gradient and the velocity rises by ${fmt(rasio, 3)} times, not exactly two. A pure square-root law would give exactly two; the excess appears because the friction factor itself falls as the flow speeds up, and it is largest on smooth pipes where the viscous term still matters. Set the roughness to zero and watch the excess grow; set it to several millimetres and watch the ratio settle onto two, which is the signature of fully rough flow where the friction factor no longer depends on the Reynolds number at all.`;
  return `Lipatempatkan kemiringannya dan kecepatannya naik ${fmt(rasio, 3)} kali, bukan tepat dua. Hukum akar murni akan memberi tepat dua; kelebihannya muncul karena faktor gesekannya sendiri turun ketika alirannya mengencang, dan kelebihan itu paling besar pada pipa licin tempat suku kekentalan masih berpengaruh. Setel kekasarannya ke nol lalu perhatikan kelebihan itu membesar; setel ke beberapa milimeter lalu perhatikan perbandingannya turun ke dua, dan dua itulah tanda aliran kasar penuh tempat faktor gesekan sudah tidak bergantung pada bilangan Reynolds sama sekali.`;
}
