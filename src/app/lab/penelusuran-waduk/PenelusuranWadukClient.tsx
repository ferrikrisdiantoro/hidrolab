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
  fmt,
  fmtPlain,
  floodHydrograph,
  reservoirRouting,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksRouting } from "@/lib/checks";

const TXT = {
  id: {
    title: "Penelusuran waduk",
    sheetTitle: "Penelusuran banjir lewat waduk — peredaman puncak oleh tampungan",
    dQp: "Puncak banjir masuk",
    dTp: "Waktu puncak banjir masuk",
    dArea: "Luas genangan pada muka air mercu",
    dB: "Lebar mercu pelimpah",
    dFb: "Tinggi jagaan di atas mercu",
    dCd: "Koefisien debit pelimpah",
    pKecil: "Waduk kecil, pelimpah lebar",
    pSedang: "Waduk sedang",
    pBesar: "Waduk besar, pelimpah sempit",
    rIn: "Puncak masuk",
    rOut: "Puncak keluar",
    rAtt: "Bagian puncak yang teredam",
    rLag: "Selang antara kedua puncak",
    rHmax: "Tinggi muka air tertinggi",
    rSmax: "Tampungan terpakai terbesar",
    rFb: "Sisa jagaan",
    limpas: "Air melampaui puncak bendungan",
    limpasNote:
      "Tinggi muka air tertinggi melebihi tinggi jagaan yang tersedia, artinya air melimpah di atas puncak bendungan dan bukan lagi lewat pelimpahnya saja. Hitungan di lembar ini tidak berlaku sejak saat itu, karena seluruhnya mengandaikan air keluar hanya lewat pelimpah. Bendungan urukan yang dilimpasi biasanya runtuh dalam hitungan jam. Perlebar pelimpahnya, perbesar luas genangannya, atau tinggikan jagaannya.",
    note:
      "Dua sifat lembar ini layak diperhatikan karena keduanya berlaku untuk waduk mana pun, apa pun bentuk dan ukurannya. Yang pertama, puncak keluar selalu terjadi persis ketika kurva keluar memotong kurva masuk. Alasannya sederhana dan tidak bergantung pada rumus pelimpah mana pun: selama debit masuk masih melebihi debit keluar, tampungannya masih bertambah, muka airnya masih naik, dan keluarannya masih ikut naik. Begitu keduanya sama, tampungannya berhenti bertambah, dan di situlah keluarannya memuncak. Yang kedua, luas di antara kedua kurva sebelum perpotongan itu persis sama dengan tampungan yang terpakai. Keduanya dapat dilihat langsung di gambar, dan keduanya diuji di blok verifikasi. Perhatikan juga bahwa peredaman tidak datang dari pelimpahnya melainkan dari tampungannya: memperlebar pelimpah justru mengurangi peredaman, karena air lebih mudah keluar dan lebih sedikit yang tersimpan.",
  },
  en: {
    title: "Reservoir routing",
    sheetTitle: "Flood routing through a reservoir — peak attenuation by storage",
    dQp: "Inflow flood peak",
    dTp: "Time of the inflow peak",
    dArea: "Surface area at crest level",
    dB: "Spillway crest width",
    dFb: "Freeboard above the crest",
    dCd: "Spillway discharge coefficient",
    pKecil: "Small reservoir, wide spillway",
    pSedang: "Medium reservoir",
    pBesar: "Large reservoir, narrow spillway",
    rIn: "Inflow peak",
    rOut: "Outflow peak",
    rAtt: "Fraction of the peak attenuated",
    rLag: "Gap between the two peaks",
    rHmax: "Highest water level",
    rSmax: "Largest storage used",
    rFb: "Freeboard remaining",
    limpas: "Water overtops the dam crest",
    limpasNote:
      "The highest water level exceeds the available freeboard, meaning water spills over the dam crest and no longer leaves through the spillway alone. The calculation on this sheet stops holding at that moment, because all of it assumes water leaves only through the spillway. An embankment dam that is overtopped usually fails within hours. Widen the spillway, enlarge the surface area, or raise the freeboard.",
    note:
      "Two properties of this sheet are worth noticing, because both hold for any reservoir whatever its shape or size. First, the outflow peak always occurs exactly where the outflow curve crosses the inflow curve. The reason is simple and depends on no spillway formula: while the inflow still exceeds the outflow, the storage is still growing, the level is still rising, and the outflow is still rising with it. The moment the two are equal, the storage stops growing, and that is where the outflow peaks. Second, the area between the two curves before that crossing is exactly the storage used. Both can be seen directly in the figure, and both are tested in the verification block. Note too that the attenuation comes from the storage rather than the spillway: widening the spillway reduces the attenuation, because water leaves more easily and less of it is held back.",
  },
} as const;

const REFS = {
  id: [
    "Chow, V.T., Maidment, D.R. & Mays, L.W. (1988). Applied Hydrology. McGraw-Hill, Bab 8.",
    "Puls, L.G. (1928). Construction of flood routing curves. House Document 185, US Congress.",
    "USBR (1987). Design of Small Dams, edisi ke-3, bab pelimpah dan penelusuran banjir.",
    "Fread, D.L. (1993). Flow routing. Dalam Maidment (ed.), Handbook of Hydrology, Bab 10.",
  ],
  en: [
    "Chow, V.T., Maidment, D.R. & Mays, L.W. (1988). Applied Hydrology. McGraw-Hill, Chapter 8.",
    "Puls, L.G. (1928). Construction of flood routing curves. House Document 185, US Congress.",
    "USBR (1987). Design of Small Dams, 3rd ed., chapters on spillways and flood routing.",
    "Fread, D.L. (1993). Flow routing. In Maidment (ed.), Handbook of Hydrology, Chapter 10.",
  ],
} as const;

export function PenelusuranWadukClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Qp, setQp] = useState(120);
  const [tPeak, setTPeak] = useState(6);
  const [areaHa, setAreaHa] = useState(200);
  const [b, setB] = useState(30);
  const [fb, setFb] = useState(3);
  const [Cd, setCd] = useState(0.6);

  // Banjir masuk disusun sebagai hidrograf satuan segitiga yang diskalakan,
  // supaya bentuknya selalu masuk akal dan puncaknya persis nilai yang
  // dimasukkan. Lembar ini tentang penelusurannya, bukan tentang asal
  // banjirnya; asal banjir dibahas lembar HY-02.
  const masuk = (() => {
    const tb = 2.67 * tPeak;
    const pts: { t: number; Q: number }[] = [];
    const n = 160;
    for (let i = 0; i <= n; i++) {
      const tt = (tb * 1.6 * i) / n;
      const f =
        tt <= 0 || tt >= tb ? 0 : tt <= tPeak ? tt / tPeak : (tb - tt) / (tb - tPeak);
      pts.push({ t: tt, Q: Qp * f });
    }
    return pts;
  })();

  const area = areaHa * 1e4;
  const r = reservoirRouting(masuk, area, b, fb, Cd);
  const sisaJagaan = fb - r.maxHead;

  const ref = useCanvas(
    (ctx, w, h) => {
      const tMax = masuk[masuk.length - 1].t;
      const deret: ChartSeries[] = [
        {
          pts: r.points.map((p) => ({ x: p.t, y: p.inflow })),
          color: C.water,
          weight: W.bold,
          label: T.inflowCurve,
          labelAt: 0.28,
          labelDy: -11,
        },
        {
          pts: r.points.map((p) => ({ x: p.t, y: p.outflow })),
          color: r.overtops ? C.signal : C.energy,
          weight: W.bold,
          dash: r.overtops ? DASH.invalid : DASH.solid,
          label: T.outflowCurve,
          labelAt: 0.62,
          labelDy: 14,
        },
      ];

      drawChart(
        ctx,
        w,
        h,
        {
          xMin: 0,
          xMax: tMax,
          yMin: 0,
          yMax: Math.max(Qp * 1.15, 1e-6),
          axisX: T.axTimeHour,
          axisY: T.axFlowRate,
          series: deret,
          point: {
            x: r.points.reduce((m, p) => (p.outflow > m.outflow ? p : m), r.points[0])
              .t,
            y: r.outflowPeak,
            /* Dua desimal untuk puncak yang kecil, karena waduk besar dengan
               pelimpah sempit meredam sampai puluhan liter per detik dan satu
               desimal menuliskannya sebagai nol. */
            label: `${fmtPlain(r.outflowPeak, r.outflowPeak < 1 ? 3 : 1)} m³/s`,
            invalid: r.overtops,
          },
          /*
           * Sebelumnya di sini tertulis T.pointOffChart, yaitu "titik operasi
           * di luar diagram", padahal titiknya justru tergambar di dalam
           * bidang. Yang terjadi bukan titik yang keluar bidang melainkan air
           * yang melampaui puncak bendungan, dan gambar yang mengumumkan
           * sebab yang salah lebih buruk daripada gambar yang diam.
           */
          heading: r.overtops ? x.limpas : undefined,
          headingColor: C.signal,
        },
        lang
      );
    },
    [Qp, tPeak, areaHa, b, fb, Cd, lang]
  );

  return (
    <LabShell
      sheet="HY-01"
      subject={SUBJECTS.HY[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Waduk tidak menghilangkan banjir, ia hanya{" "}
            <Term tint={C.energy}>menundanya dan meratakannya</Term>. Yang
            meredam puncak bukan pelimpahnya melainkan{" "}
            <Term tint={C.water}>tampungannya</Term>, dan itu terlihat jelas
            dari luas di antara kedua kurva.
          </p>
        ) : (
          <p>
            A reservoir does not remove a flood, it only{" "}
            <Term tint={C.energy}>delays and flattens it</Term>. What attenuates
            the peak is not the spillway but the{" "}
            <Term tint={C.water}>storage</Term>, and that shows plainly in the
            area between the two curves.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HY-01"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m³/s, m)" },
            { label: "Imax", value: `${fmt(r.inflowPeak, 1)} m³/s`, tint: C.water },
            { label: "Omax", value: `${fmt(r.outflowPeak, 1)} m³/s`, tint: C.energy },
            { label: "redam", value: `${fmt(r.attenuation * 100, 1)} %` },
            {
              label: "hmax",
              value: `${fmt(r.maxHead, 2)} m`,
              tint: r.overtops ? C.signal : undefined,
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
              <InputRow symbol="Ip" label={x.dQp} value={Qp} min={5} max={2000} step={5} digits={0} unit="m³/s" onChange={setQp} tint={C.water} />
              <InputRow symbol="tp" label={x.dTp} value={tPeak} min={0.5} max={36} step={0.5} digits={1} unit="h" onChange={setTPeak} />
              <InputRow symbol="As" label={x.dArea} value={areaHa} min={1} max={5000} step={1} digits={0} unit="ha" onChange={setAreaHa} tint={C.energy} />
              <InputRow symbol="b" label={x.dB} value={b} min={2} max={200} step={1} digits={0} unit="m" onChange={setB} />
              <InputRow symbol="f" label={x.dFb} value={fb} min={0.5} max={15} step={0.1} digits={1} unit="m" onChange={setFb} tint={C.signal} />
              <InputRow symbol="Cd" label={x.dCd} value={Cd} min={0.5} max={0.75} step={0.005} digits={3} onChange={setCd} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pKecil, apply: () => { setQp(120); setTPeak(6); setAreaHa(40); setB(60); setFb(3); setCd(0.6); } },
                  { label: x.pSedang, apply: () => { setQp(120); setTPeak(6); setAreaHa(200); setB(30); setFb(3); setCd(0.6); } },
                  { label: x.pBesar, apply: () => { setQp(120); setTPeak(6); setAreaHa(1200); setB(12); setFb(4); setCd(0.6); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={r.overtops ? undefined : C.energy} alert={r.overtops}>
                {`${fmt(r.attenuation * 100, 1)} %`}
              </Flag>
              {r.overtops && <Flag alert>{x.limpas}</Flag>}
            </div>
            {r.overtops && (
              <div className="mb-2.5">
                <Note>{x.limpasNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "Omax", label: x.rOut, value: fmt(r.outflowPeak, 2), unit: "m³/s", tint: C.energy, strong: true },
                { symbol: "—", label: x.rAtt, value: fmt(r.attenuation * 100, 2), unit: "%", strong: true },
                { symbol: "Imax", label: x.rIn, value: fmt(r.inflowPeak, 2), unit: "m³/s", tint: C.water },
                { symbol: "Δt", label: x.rLag, value: fmt(r.lag, 2), unit: "h" },
                { symbol: "hmax", label: x.rHmax, value: fmt(r.maxHead, 3), unit: "m", tint: r.overtops ? C.signal : undefined },
                { symbol: "Smax", label: x.rSmax, value: fmt(r.maxStorage / 1e6, 3), unit: T.millionCubic, tint: C.water },
                { symbol: "f′", label: x.rFb, value: fmt(sisaJagaan, 2), unit: "m", tint: r.overtops ? C.signal : undefined },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(r.attenuation, r.lag, r.maxStorage, r.overtops, masuk, area, b, fb, Cd, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksRouting(masuk, area, b, fb, Cd)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <Frac num="I₁ + I₂" den="2" />
                <span>−</span>
                <Frac num="O₁ + O₂" den="2" />
                <span>=</span>
                <Frac num="S₂ − S₁" den="Δt" />
              </Eq>
              <Eq>
                <span>O =</span>
                <Frac num="2" den="3" />
                <span>Cd b √(2g) h^1,5</span>
                <span className="ml-5">S = As h</span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "O₂ dan S₂ sama-sama fungsi h₂, jadi tiap langkah diselesaikan dengan bagi dua atas h₂"
                    : "O₂ and S₂ are both functions of h₂, so each step is solved by bisection on h₂"}
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
  attenuation: number,
  lag: number,
  maxStorage: number,
  overtops: boolean,
  masuk: { t: number; Q: number }[],
  area: number,
  b: number,
  fb: number,
  Cd: number,
  lang: Lang
): string {
  if (overtops) {
    return lang === "id"
      ? "Selama air melampaui puncak bendungan, seluruh angka di atas tidak berlaku karena hitungannya mengandaikan air keluar hanya lewat pelimpah. Perlebar pelimpahnya atau perbesar luas genangannya sampai penanda merah hilang, baru bacaannya berarti."
      : "While the water overtops the dam crest, every number above is invalid, because the calculation assumes water leaves only through the spillway. Widen the spillway or enlarge the surface area until the red flag clears, and only then read the values.";
  }

  const lebar = reservoirRouting(masuk, area, b * 2, fb, Cd);
  const luas = reservoirRouting(masuk, area * 2, b, fb, Cd);

  if (lang === "en")
    return `This reservoir holds back ${fmt(attenuation * 100, 0)} per cent of the peak and delays it by ${fmt(lag, 1)} hours, using ${fmt(maxStorage / 1e6, 2)} million cubic metres of storage. Double the spillway width and the attenuation falls to ${fmt(lebar.attenuation * 100, 0)} per cent; double the surface area instead and it rises to ${fmt(luas.attenuation * 100, 0)} per cent. The spillway is what lets water out, so making it larger makes the reservoir do less. It is the storage that does the work, and this comparison is the shortest way to see that.`;
  return `Waduk ini menahan ${fmt(attenuation * 100, 0)} persen puncaknya dan menundanya ${fmt(lag, 1)} jam, dengan memakai ${fmt(maxStorage / 1e6, 2)} juta meter kubik tampungan. Lipatduakan lebar pelimpahnya dan peredamannya turun ke ${fmt(lebar.attenuation * 100, 0)} persen; lipatduakan luas genangannya dan ia naik ke ${fmt(luas.attenuation * 100, 0)} persen. Pelimpah adalah jalan air keluar, jadi memperbesarnya justru membuat waduknya bekerja lebih sedikit. Yang bekerja tampungannya, dan perbandingan ini jalan terpendek untuk melihatnya.`;
}
