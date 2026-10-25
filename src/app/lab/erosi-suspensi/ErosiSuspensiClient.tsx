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
  type RegimeBand,
} from "@/components/ui";
import { useCanvas } from "@/lib/useCanvas";
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import {
  COHESIVE_LIMIT,
  G,
  SEDIMENT_S,
  chezyFromManning,
  dimensionlessGrain,
  fmt,
  fmtPlain,
  fmtSci,
  hjulstrom,
  settlingVelocity,
  shieldsCritical,
  waterViscosity,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksHjulstrom } from "@/lib/checks";

const TXT = {
  id: {
    title: "Erosi dan suspensi",
    sheetTitle: "Diagram Hjulstrom — erosi, angkutan, dan pengendapan",
    dD: "Diameter butir",
    dV: "Kecepatan rata-rata aliran",
    dH: "Kedalaman aliran",
    dN: "Angka kekasaran dasar",
    dRho: "Berat jenis relatif butir (Gs)",
    dT: "Suhu air",
    pSungai: "Sungai dataran, pasir halus",
    pBanjir: "Banjir bandang, kerikil",
    pWaduk: "Waduk tenang, lanau",
    rVero: "Kecepatan yang mulai mengerosi",
    rVdep: "Kecepatan yang berhenti mengangkut",
    rVsus: "Kecepatan yang membuat melayang",
    rWs: "Kecepatan endap butir",
    rKeadaan: "Nasib butir pada kecepatan ini",
    rUstar: "Kecepatan gesek",
    sErosi: "Tererosi",
    sAngkut: "Terangkut",
    sEndap: "Mengendap",
    kohesif: "Butir kohesif",
    kohesifPita: "Butir kohesif, kurva erosi tidak berlaku",
    kohesifIsi: "d < 0,06 mm: kurva erosi tidak berlaku",
    hC: "Koefisien Chezy dan kecepatan gesek",
    hVero: "Ambang erosi dari Shields, lewat Chezy",
    hVdep: "Ambang pengendapan, u* = ws/5",
    hVdepCap: "dibatasi τcr",
    hVsus: "Ambang melayang, u* = ws",
    hKeadaan: "Keadaan butir",
    kohesifNote:
      "Di bawah 0,06 mm butirnya masuk golongan lanau dan lempung, dan yang menahannya di dasar bukan lagi beratnya melainkan gaya tarik antar butir. Kurva erosi yang digambar diturunkan dari ambang Shields untuk butir lepas, jadi di daerah ini ia tidak berlaku. Justru di situlah letak keanehan diagram Hjulstrom yang paling terkenal: kurva erosinya berbalik naik ke kiri, sehingga lempung padat menuntut kecepatan lebih besar daripada pasir untuk mulai tererosi. Kenaikan itu nyata dan terukur, tetapi besarnya bergantung pada sejarah pengendapan, bukan pada ukuran butir, sehingga tidak dapat diramalkan dari satu angka.",
    note:
      "Diagram ini menjawab tiga pertanyaan sekaligus dengan satu gambar, dan justru karena itu ia sering disalahpahami. Kurva atas menyatakan kapan butir yang sedang diam mulai bergerak. Kurva bawah menyatakan kapan butir yang sedang bergerak berhenti dan mengendap. Kurva ketiga menyatakan kapan butir yang bergerak berhenti menyentuh dasar dan mulai melayang. Ketiganya bukan satu kurva yang sama dilihat dari sudut berbeda: jarak antara kurva atas dan bawah adalah daerah tempat butir yang sudah bergerak tetap bergerak sedangkan butir yang diam tetap diam, dan daerah itu nyata. Sebuah sungai yang kecepatannya berada di sana akan mengangkut apa yang sudah terangkut tanpa menambah muatan baru dari dasarnya. Kurva erosi di sini diturunkan dari ambang Shields lewat koefisien Chezy, bukan dibaca dari gambar Hjulstrom asli, supaya lembar ini tetap satu bangunan dengan lembar SD-01 dan tidak memakai dua sumber yang dapat bertentangan.",
  },
  en: {
    title: "Entrainment and suspension",
    sheetTitle: "Hjulstrom diagram — erosion, transport, and deposition",
    dD: "Grain diameter",
    dV: "Mean flow velocity",
    dH: "Flow depth",
    dN: "Bed roughness coefficient",
    dRho: "Specific gravity of the grains (Gs)",
    dT: "Water temperature",
    pSungai: "Lowland river, fine sand",
    pBanjir: "Flash flood, gravel",
    pWaduk: "Quiet reservoir, silt",
    rVero: "Velocity that starts erosion",
    rVdep: "Velocity that stops transport",
    rVsus: "Velocity that lifts into suspension",
    rWs: "Grain settling velocity",
    rKeadaan: "Fate of the grain at this velocity",
    rUstar: "Friction velocity",
    sErosi: "Eroded",
    sAngkut: "Transported",
    sEndap: "Deposited",
    kohesif: "Cohesive grain",
    kohesifPita: "Cohesive grain, erosion curve does not apply",
    kohesifIsi: "d < 0.06 mm: the erosion curve does not apply",
    hC: "Chezy coefficient and friction velocity",
    hVero: "Erosion threshold from Shields, through Chezy",
    hVdep: "Deposition threshold, u* = ws/5",
    hVdepCap: "capped at τcr",
    hVsus: "Suspension threshold, u* = ws",
    hKeadaan: "State of the grain",
    kohesifNote:
      "Below 0.06 mm the grains fall into the silt and clay class, and what holds them on the bed is no longer their weight but cohesion between grains. The erosion curve drawn here comes from the Shields threshold for loose grains, so it does not hold in this region. That is precisely where the best-known oddity of the Hjulstrom diagram lies: its erosion curve turns back upward to the left, so firm clay demands a higher velocity than sand to start eroding. That rise is real and measured, but its size depends on the deposition history rather than the grain size, and so cannot be predicted from a single number.",
    note:
      "This diagram answers three questions at once in one picture, and for that very reason it is often misread. The upper curve says when a grain at rest starts to move. The lower curve says when a moving grain stops and settles. The third curve says when a moving grain stops touching the bed and starts to travel in suspension. These are not one curve seen from different angles: the gap between the upper and lower curves is a region where grains already moving keep moving while grains at rest stay at rest, and that region is real. A river whose velocity sits there will carry what it already carries without picking up anything new from its bed. The erosion curve here is derived from the Shields threshold through the Chezy coefficient rather than read off the original Hjulstrom figure, so that this sheet remains one structure with sheet SD-01 and does not rely on two sources that could disagree.",
  },
} as const;

const REFS = {
  id: [
    "Hjulström, F. (1935). Studies of the morphological activity of rivers as illustrated by the River Fyris. Bulletin of the Geological Institute of Uppsala 25.",
    "Sundborg, Å. (1956). The River Klarälven: a study of fluvial processes. Geografiska Annaler 38.",
    "Shields, A. (1936). Anwendung der Ähnlichkeitsmechanik auf die Geschiebebewegung. Preussische Versuchsanstalt für Wasserbau 26.",
    "Miedema, S.A. (2012). Constructing the Shields curve. Journal of Dredging Engineering, vol. 12.",
  ],
  en: [
    "Hjulström, F. (1935). Studies of the morphological activity of rivers as illustrated by the River Fyris. Bulletin of the Geological Institute of Uppsala 25.",
    "Sundborg, Å. (1956). The River Klarälven: a study of fluvial processes. Geografiska Annaler 38.",
    "Shields, A. (1936). Anwendung der Ähnlichkeitsmechanik auf die Geschiebebewegung. Preussische Versuchsanstalt für Wasserbau 26.",
    "Miedema, S.A. (2012). Constructing the Shields curve. Journal of Dredging Engineering, vol. 12.",
  ],
} as const;

const D_MIN = 0.004;
const D_MAX = 300;
/** Sumbu skala rezim kecepatan = rentang penggeser V. */
const V_LO = 0.005;
const V_HI = 8;

export function ErosiSuspensiClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [dMm, setDMm] = useState(0.2);
  const [V, setV] = useState(0.5);
  const [h, setH] = useState(1);
  const [n, setN] = useState(0.025);
  const [s, setS] = useState(SEDIMENT_S);
  const [suhu, setSuhu] = useState(15);

  const nu = waterViscosity(suhu);
  const d = dMm / 1000;
  const r = hjulstrom(d, h, V, s, nu, n);
  const ws = settlingVelocity(d, s, nu);
  const Cz = chezyFromManning(n, h);
  const uStar = (V * Math.sqrt(G)) / Math.max(Cz, 1e-9);
  /* Nilai antara untuk langkah hitungan, dari fungsi yang sama yang
     dipakai hjulstrom, bukan rumus lain. */
  const dStar = dimensionlessGrain(d, s, nu);
  const thetaCr = shieldsCritical(dStar);
  const tauCr = thetaCr * (s - 1) * 1000 * G * d;
  const tauEndapWs = 1000 * Math.pow(ws / 5, 2);
  const dibatasi = tauEndapWs > tauCr;
  const tauEndap = Math.min(tauEndapWs, tauCr);

  const keadaanNama =
    r.state === "tererosi" ? x.sErosi : r.state === "terangkut" ? x.sAngkut : x.sEndap;
  /* Saat kohesif, ambang erosi tidak berlaku, jadi golongan tererosi /
     terangkut juga tidak; yang ditampilkan hanya bahwa butirnya kohesif. */
  const keadaanTampil = r.cohesive ? x.kohesif : keadaanNama;
  const NADA: Record<typeof r.state, Tone> = {
    tererosi: "energy",
    terangkut: "neutral",
    mengendap: "water",
  };
  const kosong = "—";
  /* Kecepatan ambang membentang dari 10⁻⁷ sampai puluhan m/s; empat
     desimal menulis yang kecil "0,0000". Di bawah 0,001 berpangkat, sama
     di tabel dan di hitungan. */
  const fV = (v: number) => (v > 0 && v < 1e-3 ? fmtSci(v) : fmt(v, 4));

  /* Pita skala dari kurva hjulstrom pada d, h, n ini, dipotong ke sumbu
     0,005–8 m/s (= rentang penggeser). Pita yang jatuh di luar sumbu atau
     selebar nol (butir kasar: V_dep = V_ero) dibuang. */
  const jepit = (v: number) => Math.min(V_HI, Math.max(V_LO, v));
  const pita: RegimeBand[] = (
    [
      { from: V_LO, to: jepit(r.deposition), label: x.sEndap, tone: "water" },
      { from: jepit(r.deposition), to: jepit(r.erosion), label: x.sAngkut, tone: "neutral" },
      { from: jepit(r.erosion), to: V_HI, label: x.sErosi, tone: "energy" },
    ] as RegimeBand[]
  ).filter((b) => b.to - b.from > 1e-12);

  const ref = useCanvas(
    (ctx, w, ch) => {
      const ero: { x: number; y: number }[] = [];
      const dep: { x: number; y: number }[] = [];
      const sus: { x: number; y: number }[] = [];
      for (let lg = Math.log10(D_MIN); lg <= Math.log10(D_MAX) + 1e-9; lg += 0.02) {
        const dk = Math.pow(10, lg);
        const rk = hjulstrom(dk / 1000, h, V, s, nu, n);
        ero.push({ x: dk, y: rk.erosion });
        dep.push({ x: dk, y: rk.deposition });
        sus.push({ x: dk, y: rk.suspension });
      }

      const kohesifX = COHESIVE_LIMIT * 1000;
      const deret: ChartSeries[] = [
        {
          /*
           * Merah bata, bukan merah sinyal. Ruas kurva erosi yang ini
           * berlaku penuh; yang tidak berlaku hanya perpanjangannya ke
           * butiran kohesif di sebelah kiri, dan ruas itulah yang merah
           * sinyal dan bertitik rapat. Dengan dua warna yang berbeda,
           * batas keberlakuannya terbaca dari warnanya sendiri dan tidak
           * bergantung pada pembaca memperhatikan jenis garisnya.
           */
          pts: ero.filter((p) => p.x >= kohesifX),
          color: C.energy,
          weight: W.bold,
          label: T.erosionCurve,
          labelAt: 0.75,
          labelDy: -11,
        },
        {
          pts: ero.filter((p) => p.x <= kohesifX),
          color: C.signal,
          weight: W.thin,
          dash: DASH.invalid,
        },
        {
          pts: dep,
          color: C.water,
          weight: W.bold,
          label: T.depositionCurve,
          labelAt: 0.55,
          labelDy: 13,
        },
        {
          pts: sus,
          color: C.critical,
          weight: W.thin,
          dash: DASH.hidden,
          label: T.suspensionCurve,
          labelAt: 0.4,
          labelDy: -11,
        },
      ];

      drawChart(
        ctx,
        w,
        ch,
        {
          xMin: D_MIN,
          xMax: D_MAX,
          yMin: 0.002,
          yMax: 20,
          xLog: true,
          yLog: true,
          axisX: T.axGrainMm,
          axisY: T.axMeanVel,
          series: deret,
          bands: r.cohesive
            ? [{ axis: "x", from: D_MIN, to: kohesifX }]
            : undefined,
          regions: [
            { x: 0.02, y: 8, text: T.erosionZone, color: C.energy },
            { x: 2.2, y: 0.09, text: T.depositionZone, color: C.ink3 },
          ],
          point: {
            x: dMm,
            y: V,
            label: keadaanTampil.toLowerCase(),
            invalid: r.cohesive,
          },
        },
        lang
      );
    },
    [dMm, V, h, n, s, suhu, lang]
  );

  return (
    <LabShell
      status={
        r.cohesive ? (
          <RegimeScale
            symbol="V"
            value={NaN}
            invalid
            pesan={x.kohesifPita}
            scale="log"
            digits={3}
            bands={[{ from: V_LO, to: V_HI, label: x.kohesifPita, tone: "invalid" }]}
          />
        ) : (
          <RegimeScale symbol="V" value={V} scale="log" digits={3} bands={pita} />
        )
      }
      sheet="SD-03"
      subject={SUBJECTS.SD[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Tiga pertanyaan berbeda dalam satu gambar: kapan butir{" "}
            <Term tint={C.energy}>mulai bergerak</Term>, kapan ia{" "}
            <Term tint={C.water}>berhenti dan mengendap</Term>, dan kapan ia{" "}
            <Term tint={C.critical}>lepas dari dasar dan melayang</Term>.
            Ketiganya tidak terjadi pada kecepatan yang sama.
          </p>
        ) : (
          <p>
            Three different questions in one figure: when a grain{" "}
            <Term tint={C.energy}>starts to move</Term>, when it{" "}
            <Term tint={C.water}>stops and settles</Term>, and when it{" "}
            <Term tint={C.critical}>leaves the bed and travels suspended</Term>.
            None of the three happens at the same velocity.
          </p>
        )
      }
      drawing={
        <Sheet
          number="SD-03"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (mm, m/s)" },
            { label: "d", value: `${fmt(dMm, 3)} mm`, tint: r.cohesive ? C.signal : undefined },
            { label: "V", value: `${fmt(V, 3)} m/s`, tint: C.water },
            { label: "V_ero", value: r.cohesive ? kosong : `${fmt(r.erosion, 3)} m/s`, tint: C.energy },
            { label: "—", value: keadaanTampil },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="d" label={x.dD} value={dMm} min={0.004} max={300} step={0.002} digits={3} unit="mm" onChange={setDMm} tint={C.critical} />
              <InputRow symbol="V" label={x.dV} value={V} min={0.005} max={8} step={0.005} digits={3} unit="m/s" onChange={setV} tint={C.water} />
              <InputRow symbol="h" label={x.dH} value={h} min={0.05} max={15} step={0.05} digits={2} unit="m" onChange={setH} />
              <InputRow symbol="n" label={x.dN} value={n} min={0.011} max={0.07} step={0.001} digits={3} onChange={setN} />
              <InputRow symbol="Gs" label={x.dRho} value={s} min={1.05} max={4} step={0.05} digits={2} onChange={setS} />
              <InputRow symbol="T" label={x.dT} value={suhu} min={4} max={40} step={0.5} digits={1} unit="°C" onChange={setSuhu} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pSungai, apply: () => { setDMm(0.2); setV(0.5); setH(1.5); setN(0.025); setS(SEDIMENT_S); setSuhu(15); } },
                  { label: x.pBanjir, apply: () => { setDMm(30); setV(3); setH(2); setN(0.04); setS(SEDIMENT_S); setSuhu(15); } },
                  { label: x.pWaduk, apply: () => { setDMm(0.02); setV(0.02); setH(8); setN(0.02); setS(SEDIMENT_S); setSuhu(15); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            {/* Keadaan butir kini badge kartu keadaan. Saat kohesif, V_ero
                ditulis "—": kurva erosinya diturunkan dari Shields untuk
                butir lepas dan tidak berlaku di sini. */}
            <ResultTable
              rows={[
                { symbol: "V_ero", label: x.rVero, value: r.cohesive ? kosong : fV(r.erosion), unit: r.cohesive ? undefined : "m/s", tint: C.energy, strong: true },
                { symbol: "V_dep", label: x.rVdep, value: fV(r.deposition), unit: "m/s", tint: C.water, strong: true },
                { symbol: "V_sus", label: x.rVsus, value: fV(r.suspension), unit: "m/s", tint: C.critical },
                { symbol: "ws", label: x.rWs, value: fmtSci(ws), unit: "m/s" },
                { symbol: "u*", label: x.rUstar, value: fmt(uStar, 5), unit: "m/s", tint: C.energy },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hC,
                    rumus: (<><span>C =</span><Frac num="h^(1/6)" den="n" /><span>; u* =</span><Frac num="V · √g" den="C" /></>),
                    isi: `C = ${fmt(h, 2)}^(1/6) / ${fmt(n, 3)} = ${fmt(Cz, 2)} ; u* = ${fmt(V, 3)} · √${fmt(G, 2)} / ${fmt(Cz, 2)}`,
                    hasil: fmt(uStar, 5),
                    satuan: "m/s",
                    tint: C.energy,
                  },
                  {
                    judul: x.hVero,
                    rumus: (<><span>τcr = θcr(D*) (Gs − 1) ρ g d ; V_ero =</span><Frac num="√( τcr · C² )" den="√( ρ · g )" /></>),
                    isi: r.cohesive
                      ? x.kohesifIsi
                      : `D* = ${fmt(dStar, 2)} ; θcr = ${fmt(thetaCr, 5)} ; τcr = ${fmt(thetaCr, 5)} · (${fmt(s, 2)} − 1) · 1000 · ${fmt(G, 2)} · ${fmtSci(d)} = ${fV(tauCr)} Pa ; V_ero = √( ${fV(tauCr)} · ${fmt(Cz, 2)}² / ( 1000 · ${fmt(G, 2)} ) )`,
                    hasil: r.cohesive ? kosong : fV(r.erosion),
                    satuan: r.cohesive ? undefined : "m/s",
                    tint: C.energy,
                  },
                  {
                    judul: x.hVdep,
                    rumus: (<><span>V_dep =</span><Frac num="√( min[ ρ (ws/5)², τcr ] · C² )" den="√( ρ · g )" /></>),
                    isi: `min[ 1000 · ( ${fmtSci(ws)} / 5 )², ${fV(tauCr)} ] = ${fV(tauEndap)} Pa${dibatasi ? ` (${x.hVdepCap})` : ""} ; √( ${fV(tauEndap)} · ${fmt(Cz, 2)}² / ( 1000 · ${fmt(G, 2)} ) )`,
                    hasil: fV(r.deposition),
                    satuan: "m/s",
                    tint: C.water,
                  },
                  {
                    judul: x.hVsus,
                    rumus: (<><span>V_sus =</span><Frac num="ws · C" den="√g" /></>),
                    isi: `${fmtSci(ws)} · ${fmt(Cz, 2)} / √${fmt(G, 2)}`,
                    hasil: fV(r.suspension),
                    satuan: "m/s",
                    tint: C.critical,
                  },
                  {
                    judul: x.hKeadaan,
                    rumus: <span>V ≥ V_ero → {x.sErosi} ; V_dep ≤ V &lt; V_ero → {x.sAngkut} ; V &lt; V_dep → {x.sEndap}</span>,
                    isi: r.cohesive
                      ? x.kohesifIsi
                      : r.state === "tererosi"
                        ? `${fmt(V, 3)} ≥ ${fV(r.erosion)}`
                        : r.state === "terangkut"
                          ? `${fV(r.deposition)} ≤ ${fmt(V, 3)} < ${fV(r.erosion)}`
                          : `${fmt(V, 3)} < ${fV(r.deposition)}`,
                    hasil: r.cohesive ? kosong : keadaanNama,
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={r.cohesive ? "invalid" : NADA[r.state]}
            badge={keadaanTampil}
            {...notice(V, r.erosion, r.deposition, r.suspension, keadaanNama, r.cohesive, x.kohesifNote, lang)}
          />
        </>
      }
      verification={<Verification checks={checksHjulstrom(d, h, V, s, nu, n)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>τ =</span>
                <Frac num="ρ g V²" den="C²" />
                <span className="ml-5">C =</span>
                <Frac num="h^(1/6)" den="n" />
                <span className="ml-3 text-ink-3">
                  {lang === "id"
                    ? "tegangan dari kecepatan, lewat Chezy"
                    : "stress from velocity, through Chezy"}
                </span>
              </Eq>
              <Eq>
                <span>{lang === "id" ? "erosi" : "erosion"}: τ = τcr</span>
                <span className="ml-5">
                  {lang === "id" ? "pengendapan" : "deposition"}: u* = ws / 5
                </span>
                <span className="ml-5">
                  {lang === "id" ? "melayang" : "suspension"}: u* = ws
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
 * Kalimat keadaan, lalu butir: (a) selang erosi-pengendapan sebagai daerah
 * angkutan berlanjut, hanya bila kedua kurva benar terpisah (> 1,05 kali);
 * (b) letak V_sus terhadap V_ero; (c) catatan kohesif.
 */
function notice(
  V: number,
  ero: number,
  dep: number,
  sus: number,
  keadaan: string,
  kohesif: boolean,
  kohesifNote: string,
  lang: Lang
): { state: string; notice: string[] } {
  const en = lang === "en";
  const f = (v: number) => (v > 0 && v < 1e-3 ? fmtSci(v) : fmt(v, 3));
  if (kohesif) {
    return en
      ? {
          state: `V = ${fmt(V, 3)} m/s on a cohesive grain: the erosion curve does not apply, so whether this bed erodes cannot be read from the diagram.`,
          notice: [
            kohesifNote,
            "The original diagram itself draws this region as a wide band rather than a line. Raise the grain size past 0.06 mm to see a curve that rests on a calculation.",
          ],
        }
      : {
          state: `V = ${fmt(V, 3)} m/s pada butir kohesif: kurva erosinya tidak berlaku, jadi apakah dasar ini tererosi tidak dapat dibaca dari diagram.`,
          notice: [
            kohesifNote,
            "Diagram aslinya pun menggambarkan daerah ini sebagai pita lebar, bukan garis. Perbesar butirnya melewati 0,06 mm untuk melihat kurva yang berdiri di atas hitungan.",
          ],
        };
  }

  const lebar = dep > 0 ? ero / dep : 0;
  const menyatu = !(lebar > 1.05);
  const state = en
    ? `V = ${fmt(V, 3)} m/s: ${keadaan.toLowerCase()}; erosion starts at ${f(ero)} m/s, deposition at ${f(dep)} m/s.`
    : `V = ${fmt(V, 3)} m/s: ${keadaan.toLowerCase()}; erosi mulai pada ${f(ero)} m/s, pengendapan pada ${f(dep)} m/s.`;

  const selang = menyatu
    ? en
      ? "At grains this coarse the erosion and deposition curves merge: a grain that stops being eroded settles at once."
      : "Pada butir sekasar ini kurva erosi dan pengendapan menyatu: butir yang berhenti tererosi langsung mengendap."
    : en
      ? `The two curves are a factor of ${fmt(lebar, 2)} apart. Everything inside that gap is the region of continued transport: a river slowing down through it keeps carrying its load without adding to it, and a river speeding up through it adds nothing new either. Move the velocity across the curves and watch the state change one step at a time.`
      : `Kedua kurva terpaut ${fmt(lebar, 2)} kali. Semua yang berada di dalam selang itu adalah daerah angkutan berlanjut: sungai yang melambat melewatinya tetap membawa muatannya tanpa menambah, dan sungai yang mengencang melewatinya juga tidak menambah apa pun yang baru. Geser kecepatannya melintasi kurva-kurva itu lalu perhatikan keadaannya berganti selangkah demi selangkah.`;

  const layang =
    sus < ero
      ? en
        ? `At grains this fine the suspension velocity (${f(sus)} m/s) is below the erosion velocity, so a grain once lifted goes straight into suspension.`
        : `Pada butir sehalus ini kecepatan melayang (${f(sus)} m/s) lebih kecil daripada kecepatan erosi, jadi butir yang terangkat langsung melayang.`
      : en
        ? `Only at ${f(sus)} m/s does a moving grain stop touching the bed altogether and travel in the body of the flow; between ${f(ero)} m/s and that velocity it rolls and hops along the bed.`
        : `Baru pada ${f(sus)} m/s butir yang bergerak berhenti menyentuh dasar sama sekali dan terbawa di dalam tubuh aliran; antara ${f(ero)} m/s dan kecepatan itu ia menggelinding dan meloncat di sepanjang dasar.`;

  return { state, notice: [selang, layang] };
}
