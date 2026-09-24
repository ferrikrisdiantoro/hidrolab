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
import { aquiferResponse, fmt, fmtPlain } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksAquifer } from "@/lib/checks";

const TXT = {
  id: {
    title: "Respons air tanah",
    sheetTitle: "Muka air tanah terhadap imbuhan musiman dan pemompaan",
    dMean: "Imbuhan rata-rata",
    dSwing: "Simpangan imbuhan musiman",
    dPump: "Pemompaan, disebar atas luasnya",
    dSy: "Simpanan tertentu",
    dAlpha: "Tetapan resesi keluaran",
    pLambat: "Akuifer lamban, pasir halus tebal",
    pCepat: "Akuifer tanggap, kerikil tipis",
    pPompa: "Pemompaan melampaui imbuhan",
    rTau: "Tetapan waktu akuifer",
    rMean: "Muka air rata-rata",
    rAmp: "Simpangan muka air",
    rAmpUn: "Simpangan bila tanpa simpanan",
    rDamp: "Peredaman",
    rLag: "Tundaan puncak terhadap puncak imbuhan",
    rLagF: "Tundaan itu sebagai bagian satu musim",
    rMin: "Muka air terendah setahun",
    rBase: "Aliran dasar rata-rata",
    aman: "Muka air bertahan di atas ambang keluaran",
    kering: "Muka air turun di bawah ambang keluaran",
    keringNote:
      "Pemompaan melampaui imbuhan, jadi muka air tanah turun melewati ambang tempat akuifer ini mengalirkan airnya keluar. Yang terjadi sesudah itu tidak tergambar di lembar ini, dan sebabnya penting: begitu muka air turun di bawah ambang keluarannya, suku umpan balik yang menarik sistem kembali ke tempatnya berhenti bekerja. Akuifer yang kehilangan umpan baliknya tidak lagi punya keadaan tunak, dan penurunannya berjalan terus selama pemompaannya berjalan. Mata air mengering, sungai yang tadinya menerima air berbalik menyerahkannya, dan pemulihannya memakan waktu berkali-kali lipat tetapan waktu yang tertulis di tabel ini.",
    note:
      "Lembar ini sebenarnya lembar tentang umpan balik dan tundaan, dan air tanah hanya kebetulan menjadi bendanya. Umpan baliknya suku keluaran yang sebanding dengan muka airnya sendiri: makin tinggi muka air makin deras ia mengalir keluar, sehingga sistemnya selalu menarik dirinya kembali. Tundaannya simpanan tertentu: air yang masuk tidak segera menjadi muka air melainkan harus mengisi pori lebih dulu. Hasil bagi keduanya adalah tetapan waktu, dan seluruh perilaku sistemnya tergantung pada perbandingan tetapan waktu itu terhadap panjang musimnya. Yang paling berguna diingat dari lembar ini satu kalimat: tundaan puncaknya tidak pernah mencapai seperempat musim, betapa pun lamban akuifernya. Itu bukan angka empiris melainkan akibat bentuk arctan, yang tidak pernah mencapai setengah pi. Akibat praktisnya langsung: lapangan yang muka air tanahnya memuncak lebih dari tiga bulan sesudah puncak hujannya pasti tidak diberi makan oleh hujan setempat, dan mencari sumber imbuhannya di tempat lain akan lebih berhasil daripada memperbaiki taksiran simpanannya. Yang kedua: peredaman dan tundaan sama-sama mengukur satu besaran yang sama, yaitu tetapan waktu. Mengukur salah satunya di lapangan sudah cukup, dan mengukur keduanya adalah cara memeriksa apakah model tampungan tunggal ini memang berlaku di situ.",
  },
  en: {
    title: "Groundwater response",
    sheetTitle: "The water table against seasonal recharge and pumping",
    dMean: "Mean recharge",
    dSwing: "Seasonal recharge swing",
    dPump: "Pumping, spread over the area",
    dSy: "Specific yield",
    dAlpha: "Outflow recession constant",
    pLambat: "A sluggish aquifer, thick fine sand",
    pCepat: "A responsive aquifer, thin gravel",
    pPompa: "Pumping beyond the recharge",
    rTau: "Aquifer time constant",
    rMean: "Mean water table",
    rAmp: "Water table swing",
    rAmpUn: "Swing if there were no storage",
    rDamp: "Damping",
    rLag: "Peak lag behind the recharge peak",
    rLagF: "That lag as a fraction of the season",
    rMin: "Lowest water table in the year",
    rBase: "Mean baseflow",
    aman: "The water table stays above the outflow threshold",
    kering: "The water table falls below the outflow threshold",
    keringNote:
      "Pumping exceeds recharge, so the water table falls past the level at which this aquifer discharges. What happens after that is not drawn on this sheet, and the reason matters: once the table falls below its outflow threshold, the feedback term that pulls the system back stops working. An aquifer that has lost its feedback no longer has a steady state, and the decline continues for as long as the pumping does. Springs dry, a river that used to receive water begins to give it up, and recovery takes many times the time constant in the table here.",
    note:
      "This sheet is really about feedback and delay, and groundwater merely happens to be the thing it is made of. The feedback is the outflow term proportional to the water table itself: the higher the table, the faster it drains, so the system always pulls itself back. The delay is the specific yield: water arriving does not become water table at once but must fill pores first. Their quotient is the time constant, and all the behaviour follows from the ratio of that constant to the length of the season. The single most useful sentence from this sheet: the peak lag never reaches a quarter of the season, however sluggish the aquifer. That is not an empirical number but a consequence of the shape of arctan, which never reaches half pi. The practical consequence is immediate: a site whose water table peaks more than three months after its rainfall peak is certainly not fed by local rainfall, and looking elsewhere for the recharge source will pay better than refining the storage estimate. The second: damping and lag both measure the same single quantity, the time constant. Measuring one of them in the field is enough, and measuring both is how you check whether this single reservoir model holds there at all.",
  },
} as const;

const REFS = {
  id: [
    "Kraijenhoff van de Leur, D.A. (1958). A study of non-steady groundwater flow with special reference to a reservoir coefficient. De Ingenieur 70.",
    "Gelhar, L.W. (1974). Stochastic analysis of phreatic aquifers. Water Resources Research 10(3).",
    "Cuthbert, M.O. (2014). Straight thinking about groundwater recession. Water Resources Research 50(3).",
    "Boussinesq, J. (1904). Recherches théoriques sur l'écoulement des nappes d'eau infiltrées dans le sol.",
  ],
  en: [
    "Kraijenhoff van de Leur, D.A. (1958). A study of non-steady groundwater flow with special reference to a reservoir coefficient. De Ingenieur 70.",
    "Gelhar, L.W. (1974). Stochastic analysis of phreatic aquifers. Water Resources Research 10(3).",
    "Cuthbert, M.O. (2014). Straight thinking about groundwater recession. Water Resources Research 50(3).",
    "Boussinesq, J. (1904). Recherches théoriques sur l'écoulement des nappes d'eau infiltrées dans le sol.",
  ],
} as const;

export function ResponsAirTanahClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [rata, setRata] = useState(1.5);
  const [ayun, setAyun] = useState(1.2);
  const [pompa, setPompa] = useState(0);
  const [Sy, setSy] = useState(0.15);
  const [alpha, setAlpha] = useState(0.01);

  const r = aquiferResponse(rata, ayun, pompa, Sy, alpha);

  const ref = useCanvas(
    (ctx, w, ch) => {
      const yMin = Math.min(r.minHead, 0) - Math.max(r.amplitude * 0.5, 0.05);
      const yAtas = r.runsDry ? Math.max(0, r.maxHead) : r.maxHead;
      /*
       * Batas atas bidang memuat ambang keluarannya, yaitu nol, tepat pada
       * keadaan yang melanggarnya.
       *
       * Sebelumnya bidangnya hanya memuat muka airnya sendiri. Pada keadaan
       * kering seluruh muka airnya berada di bawah nol, jadi ambang yang
       * sedang dilanggar itu jatuh di luar bidang: penanda merah menyatakan
       * muka air turun di bawah ambang, sementara ambangnya tidak tergambar
       * di mana pun dan pita "di luar rentang" memenuhi seluruh bidang tanpa
       * tepi yang terlihat.
       */
      const yMax =
        yAtas +
        Math.max(r.amplitude * 0.9, 0.1) +
        (r.runsDry ? Math.max(r.amplitude * 0.6, 0.08) : 0);

      /* Imbuhan digambar pada bidang yang sama, diskalakan ke rentang muka
         airnya. Yang dipersoalkan lembar ini bukan besarnya masing-masing
         melainkan JARAK WAKTU antara kedua puncaknya, dan jarak itu hanya
         terbaca kalau keduanya berada pada satu sumbu waktu. */
      const imbMax = rata + Math.max(ayun, 1e-9);
      const imbMin = rata - Math.max(ayun, 1e-9);
      const skala = (v: number) =>
        yMin +
        ((v - imbMin) / Math.max(imbMax - imbMin, 1e-9)) * (yMax - yMin) * 0.9;

      const deret: ChartSeries[] = [
        {
          pts: r.series.map((p) => ({ x: p.t, y: skala(p.recharge) })),
          color: C.ink3,
          weight: W.hair,
          dash: DASH.hidden,
          label: T.rechargeCurve,
          labelAt: 0.3,
          labelDy: -10,
        },
        {
          pts: r.series.map((p) => ({ x: p.t, y: p.head })),
          color: C.water,
          weight: W.bold,
          label: T.headCurve,
          labelAt: 0.62,
          labelDy: 16,
        },
      ];

      /* Kedua puncak, dan garis mendatar antara keduanya yang menyatakan
         tundaannya sebagai panjang yang dapat diukur dengan mata */
      const tImbuhan = 365 / 4;
      const tMuka = tImbuhan + r.lagSim;
      if (r.seasonal)
        deret.push({
          pts: [
            { x: tImbuhan, y: r.maxHead },
            { x: tMuka, y: r.maxHead },
          ],
          color: C.critical,
          weight: W.thin,
          label: `${T.lagLabel} ${fmtPlain(r.lag, 0)} ${lang === "id" ? "hari" : "days"}`,
          labelAt: 0.5,
          labelDy: -10,
        });

      drawChart(
        ctx,
        w,
        ch,
        {
          xMin: 0,
          xMax: 365,
          yMin,
          yMax,
          axisX: T.axDay,
          axisY: T.axWaterTable,
          series: deret,
          rules: [
            {
              axis: "y",
              at: r.meanHead,
              color: C.ink3,
              dash: DASH.axis,
              label: T.meanLevel,
              labelAlign: "left",
            },
            ...(r.minHead < 0 || r.meanHead < 0
              ? [
                  {
                    axis: "y" as const,
                    at: 0,
                    color: C.signal,
                    dash: DASH.invalid,
                    label: T.belowRange,
                    labelAlign: "right" as const,
                  },
                ]
              : []),
          ],
          bands: r.runsDry ? [{ axis: "y", from: yMin, to: 0 }] : undefined,
          heading: r.runsDry ? x.kering : undefined,
          headingColor: C.signal,
          padRight: 46,
        },
        lang
      );
    },
    [rata, ayun, pompa, Sy, alpha, lang]
  );

  return (
    <LabShell
      sheet="GW-03"
      subject={SUBJECTS.GW[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Tundaan puncaknya{" "}
            <Term tint={C.critical}>tidak pernah mencapai seperempat musim</Term>
            , betapa pun lamban akuifernya. Lapangan yang puncaknya lebih
            terlambat daripada itu{" "}
            <Term tint={C.critical}>tidak diberi makan oleh hujan setempat</Term>.
          </p>
        ) : (
          <p>
            The peak lag <Term tint={C.critical}>never reaches a quarter of the season</Term>,
            however sluggish the aquifer. A site that peaks later than that{" "}
            <Term tint={C.critical}>is not fed by local rainfall</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="GW-03"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, mm/hari)" },
            { label: "τ", value: `${fmt(r.tau, 0)} hari`, tint: C.critical },
            { label: "Δh", value: `${fmt(r.amplitude, 3)} m`, tint: C.water },
            /*
             * Lambangnya "tp", bukan "t".
             *
             * Kop gambar menulis lambangnya dengan huruf besar, dan di situ
             * tau Yunani dan t Latin menjadi dua huruf T yang persis sama.
             * Dua sel bersebelahan yang lambangnya terbaca sama membuat
             * pembaca tidak dapat memastikan yang mana tetapan waktu dan
             * yang mana tundaan puncak, dan keduanya kebetulan berdekatan
             * nilainya pada setelan bawaan.
             */
            { label: "tp", value: `${fmt(r.lag, 0)} hari` },
            { label: "Sy", value: fmt(Sy, 2) },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="R" label={x.dMean} value={rata} min={0.1} max={8} step={0.1} digits={1} unit="mm/d" onChange={setRata} tint={C.water} />
              <InputRow symbol="A" label={x.dSwing} value={ayun} min={0.2} max={6} step={0.1} digits={1} unit="mm/d" onChange={setAyun} />
              <InputRow symbol="P" label={x.dPump} value={pompa} min={0} max={6} step={0.1} digits={1} unit="mm/d" onChange={setPompa} tint={C.critical} />
              <InputRow symbol="Sy" label={x.dSy} value={Sy} min={0.02} max={0.4} step={0.01} digits={2} onChange={setSy} />
              <InputRow symbol="α" label={x.dAlpha} value={alpha * 1000} min={1} max={80} step={1} digits={0} unit="10⁻³/d" onChange={(v) => setAlpha(v / 1000)} tint={C.critical} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pLambat, apply: () => { setRata(1.5); setAyun(1.2); setPompa(0); setSy(0.3); setAlpha(0.003); } },
                  { label: x.pCepat, apply: () => { setRata(1.5); setAyun(1.2); setPompa(0); setSy(0.05); setAlpha(0.05); } },
                  { label: x.pPompa, apply: () => { setRata(1.5); setAyun(1.2); setPompa(1.8); setSy(0.15); setAlpha(0.01); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={r.runsDry ? undefined : C.water} alert={r.runsDry}>
                {r.runsDry ? x.kering : x.aman}
              </Flag>
            </div>
            {r.runsDry && (
              <div className="mb-2.5">
                <Note>{x.keringNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "τ", label: x.rTau, value: fmt(r.tau, 1), unit: "d", tint: C.critical, strong: true },
                { symbol: "h̄", label: x.rMean, value: fmt(r.meanHead, 3), unit: "m", tint: C.water, strong: true },
                { symbol: "Δh", label: x.rAmp, value: fmt(r.amplitude, 4), unit: "m" },
                { symbol: "Δh₀", label: x.rAmpUn, value: fmt(r.amplitudeUndamped, 4), unit: "m" },
                { symbol: "D", label: x.rDamp, value: fmt(r.damping, 4) },
                { symbol: "t", label: x.rLag, value: fmt(r.lag, 1), unit: "d", strong: true },
                { symbol: "t/P", label: x.rLagF, value: fmt(r.lagFraction, 4) },
                { symbol: "hmin", label: x.rMin, value: fmt(r.minHead, 3), unit: "m", tint: r.runsDry ? C.signal : undefined },
                { symbol: "q", label: x.rBase, value: fmt(r.baseflow, 3), unit: "mm/d" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(rata, ayun, pompa, Sy, alpha, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksAquifer(rata, ayun, pompa, Sy, alpha)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Sy</span>
                <Frac num="dh" den="dt" />
                <span>= R(t) − P − α h</span>
                <span className="ml-5">τ =</span>
                <Frac num="Sy" den="α" />
              </Eq>
              <Eq>
                <span>peredaman =</span>
                <Frac num="1" den="√(1 + (ω τ)²)" />
                <span className="ml-5">tundaan =</span>
                <Frac num="arctan(ω τ)" den="ω" />
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
  rata: number,
  ayun: number,
  pompa: number,
  Sy: number,
  alpha: number,
  lang: Lang
): string {
  const r = aquiferResponse(rata, ayun, pompa, Sy, alpha);
  const lamban = aquiferResponse(rata, ayun, pompa, Sy * 3, alpha);
  const bulan = r.lag / 30.4;

  if (lang === "en")
    return `The time constant is ${fmt(r.tau, 0)} days, so the water table peaks ${fmt(r.lag, 0)} days after the recharge peak, about ${fmt(bulan, 1)} months, and swings ${fmt(r.damping * 100, 0)} per cent of what it would swing without storage. Now treble the specific yield. The lag grows to ${fmt(lamban.lag, 0)} days and the swing falls to ${fmt(lamban.damping * 100, 0)} per cent: storage buys smoothness and pays for it in delay. Push the storage as high as you like and the lag still stops short of ninety one days, a quarter of the season, because arctan never reaches half pi.`;
  return `Tetapan waktunya ${fmt(r.tau, 0)} hari, jadi muka air tanahnya memuncak ${fmt(r.lag, 0)} hari sesudah puncak imbuhan, kira-kira ${fmt(bulan, 1)} bulan, dan berayun ${fmt(r.damping * 100, 0)} persen dari ayunan yang akan terjadi bila tanpa simpanan. Sekarang lipattigakan simpanan tertentunya. Tundaannya menjadi ${fmt(lamban.lag, 0)} hari dan ayunannya turun menjadi ${fmt(lamban.damping * 100, 0)} persen: simpanan membeli kehalusan dan membayarnya dengan tundaan. Naikkan simpanannya setinggi apa pun dan tundaannya tetap berhenti sebelum sembilan puluh satu hari, yaitu seperempat musim, karena arctan tidak pernah mencapai setengah pi.`;
}
