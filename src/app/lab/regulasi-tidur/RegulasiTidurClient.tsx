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
import { drawChart, type ChartBand, type ChartSeries } from "@/lib/drawChart";
import {
  SLEEP_ACROPHASE,
  SLEEP_H0,
  SLEEP_L0,
  SLEEP_TAU_FALL,
  SLEEP_TAU_RISE,
  fmt,
  fmtPlain,
  sleepRegulation,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksSleep } from "@/lib/checks";

const HARI = 12;
/** Tiga hari terakhir yang digambar, karena dua belas hari tidak terbaca. */
const TAMPIL = 3;

const jam = (v: number) => {
  const t = ((v % 24) + 24) % 24;
  const h = Math.floor(t);
  const m = Math.round((t - h) * 60);
  return `${String(m === 60 ? h + 1 : h).padStart(2, "0")}.${String(m === 60 ? 0 : m).padStart(2, "0")}`;
};

const TXT = {
  id: {
    title: "Regulasi tidur",
    sheetTitle: "Model dua proses — tekanan tidur terhadap irama harian",
    dAmp: "Simpangan irama harian",
    dBed: "Jam tidur yang dipaksakan",
    dWake: "Jam bangun yang dipaksakan",
    mode: "Jadwal",
    mBebas: "Dibiarkan bebas",
    mPaksa: "Dipaksakan",
    pBebas: "Tanpa jadwal",
    pPendek: "Tidur enam jam",
    pAwal: "Tidur lebih awal",
    pTanpaIrama: "Tanpa irama harian",
    rOnset: "Jam mulai tidur",
    rWake: "Jam bangun",
    rDur: "Lama tidur",
    rLat: "Lama berbaring sebelum tertidur",
    rPeriod: "Panjang daur",
    rFree: "Panjang daur bila iramanya dimatikan",
    rSwake: "Tekanan tidur saat bangun",
    rSonset: "Tekanan tidur saat mulai tidur",
    rSteady: "Tekanan bangun menurut bentuk tertutupnya",
    rDebt: "Kekurangan tidur terhadap jadwal bebas",
    terkunci: "Daurnya terkunci dua puluh empat jam",
    bebasDaur: "Daurnya bebas, tidak terkunci ke hari",
    belumMantap: "Daurnya belum berulang sama",
    tidakTidur: "Pada jam tidurnya, tekanan tidurnya belum mencapai ambang",
    latNote:
      "Pada jam tidur yang dipaksakan, tekanan tidurnya belum mencapai ambang atas, jadi yang terjadi bukan tidur melainkan berbaring. Inilah ramalan model ini yang paling mudah diuji sendiri dan paling sering diabaikan: memajukan jam tidur satu jam menghasilkan satu jam terjaga di tempat tidur, bukan satu jam tidur tambahan. Tekanan tidur hanya dapat ditumpuk dengan terjaga, dan tidak ada yang dapat mempercepatnya. Yang memperpendek waktu berbaring itu hanya dua: bangun lebih pagi sehari sebelumnya, atau menggeser iramanya dengan cahaya, dan keduanya bekerja lewat jalur yang sama sekali berbeda.",
    belumMantapNote:
      "Pada simpangan irama ini, daurnya belum berulang sama dari hari ke hari. Keadaan ini bukan cacat hitungan melainkan ramalan modelnya: pada simpangan yang terlalu kecil untuk mengunci tetapi tidak nol, jam tidurnya berjalan maju sedikit demi sedikit dan tidak pernah menetap. Bentuk tertutup tekanan tidur yang mengandaikan daur berulang tidak berlaku di keadaan ini, dan lembar ini menyatakannya begitu alih-alih menampilkan angka yang tidak berarti apa-apa.",
    note:
      "Lembar ini lembar tentang sistem, dan tidur hanya kebetulan menjadi bendanya. Ada satu keadaan yang menyimpan, yaitu tekanan tidur, yang naik selama terjaga dan turun selama tidur. Ada satu isyarat yang tidak menyimpan apa pun, yaitu irama harian, yang hanya menaikturunkan dua ambang. Dari dua bagian sesederhana itu keluar empat hal yang tidak satu pun dituliskan ke dalamnya. Pertama, lama tidurnya tidak ditetapkan di mana pun. Tidak ada tetapan delapan jam di dalam model ini; lamanya muncul sendiri dari pertemuan keadaan yang menyimpan dengan ambang yang berayun. Kedua, iramanya bukan sumber daurnya. Matikan irama hariannya seluruhnya dan daurnya tetap ada, hanya panjangnya menjadi tujuh belas jam alih-alih dua puluh empat. Yang dikerjakan irama harian bukan menciptakan daur melainkan menguncinya ke panjang hari, dan itu perbedaan yang sama dengan perbedaan antara pendulum dan jam. Ketiga, utang tidur pulih lebih cepat daripada ia menumpuk, karena tetapan waktu turunnya empat kali lebih pendek daripada yang naik, sehingga satu malam pemulihan mengembalikan sebagian besar kekurangan beberapa hari. Keempat, jadwal yang memaksa tidur lebih pendek tidak membuat tekanan tidur naik tanpa batas melainkan menetapkannya pada aras baru yang lebih tinggi, dan sistemnya tetap mantap di situ. Itulah sebabnya orang yang kurang tidur menahun berhenti merasa bertambah buruk padahal dirinya tetap berada di aras yang buruk, dan itu pula sebabnya perasaan bukan alat ukur yang dapat dipercaya untuk keadaan ini.",
  },
  en: {
    title: "Sleep regulation",
    sheetTitle: "The two process model — sleep pressure against the circadian rhythm",
    dAmp: "Circadian amplitude",
    dBed: "Imposed bedtime",
    dWake: "Imposed wake time",
    mode: "Schedule",
    mBebas: "Left free",
    mPaksa: "Imposed",
    pBebas: "No schedule",
    pPendek: "Six hours in bed",
    pAwal: "An earlier bedtime",
    pTanpaIrama: "No circadian rhythm",
    rOnset: "Sleep onset",
    rWake: "Waking",
    rDur: "Sleep duration",
    rLat: "Time lying awake before sleep",
    rPeriod: "Cycle length",
    rFree: "Cycle length with the rhythm switched off",
    rSwake: "Sleep pressure at waking",
    rSonset: "Sleep pressure at onset",
    rSteady: "Waking pressure from the closed form",
    rDebt: "Sleep lost against the free schedule",
    terkunci: "The cycle is locked to twenty four hours",
    bebasDaur: "The cycle runs free, not locked to the day",
    belumMantap: "The cycle does not yet repeat",
    tidakTidur: "At the imposed bedtime, sleep pressure has not reached the threshold",
    latNote:
      "At the imposed bedtime, sleep pressure has not reached the upper threshold, so what happens is not sleep but lying awake. This is the prediction of the model easiest to test on yourself and most often ignored: moving bedtime an hour earlier produces an hour awake in bed, not an hour of extra sleep. Sleep pressure can only be built by being awake, and nothing hurries it. Only two things shorten that waiting: getting up earlier the day before, or shifting the rhythm with light, and the two work through entirely different routes.",
    belumMantapNote:
      "At this circadian amplitude the cycle does not yet repeat from day to day. This is not a defect of the calculation but a prediction of the model: at an amplitude too small to entrain yet not zero, bedtime drifts forward a little each day and never settles. The closed form for sleep pressure, which assumes a repeating cycle, does not apply in this state, and this sheet says so rather than showing a number that means nothing.",
    note:
      "This is a sheet about systems, and sleep merely happens to be the thing it is made of. There is one state that stores, sleep pressure, which rises while awake and falls while asleep. There is one signal that stores nothing, the circadian rhythm, which only raises and lowers two thresholds. From parts that simple, four things come out that were none of them written in. First, the duration of sleep is set nowhere. There is no eight hour constant in this model; the duration emerges from a storing state meeting a swinging threshold. Second, the rhythm is not the source of the cycle. Switch the circadian process off entirely and the cycle is still there, only seventeen hours long instead of twenty four. What the rhythm does is not to create the cycle but to lock it to the length of the day, and that is the same difference as between a pendulum and a clock. Third, sleep debt recovers faster than it accumulates, because the falling time constant is four times shorter than the rising one, so one recovery night returns most of several days of loss. Fourth, a schedule forcing shorter sleep does not raise sleep pressure without limit but settles it at a new higher level, and the system stays stable there. That is why someone chronically short of sleep stops feeling progressively worse while remaining at a poor level, and why feeling is not a trustworthy instrument for this condition.",
  },
} as const;

const REFS = {
  id: [
    "Borbély, A.A. (1982). A two process model of sleep regulation. Human Neurobiology 1(3).",
    "Daan, S., Beersma, D.G.M. & Borbély, A.A. (1984). Timing of human sleep: recovery process gated by a circadian pacemaker. American Journal of Physiology 246(2).",
    "Achermann, P. & Borbély, A.A. (2003). Mathematical models of sleep regulation. Frontiers in Bioscience 8.",
    "Strogatz, S.H. (1986). The Mathematical Structure of the Human Sleep-Wake Cycle. Springer.",
  ],
  en: [
    "Borbély, A.A. (1982). A two process model of sleep regulation. Human Neurobiology 1(3).",
    "Daan, S., Beersma, D.G.M. & Borbély, A.A. (1984). Timing of human sleep: recovery process gated by a circadian pacemaker. American Journal of Physiology 246(2).",
    "Achermann, P. & Borbély, A.A. (2003). Mathematical models of sleep regulation. Frontiers in Bioscience 8.",
    "Strogatz, S.H. (1986). The Mathematical Structure of the Human Sleep-Wake Cycle. Springer.",
  ],
} as const;

export function RegulasiTidurClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [amp, setAmp] = useState(0.1);
  const [bed, setBed] = useState(23);
  const [wake, setWake] = useState(5);
  const [paksa, setPaksa] = useState(false);

  const jadwal = paksa ? { bedtime: bed, wakeTime: wake } : null;
  const r = sleepRegulation(amp, SLEEP_H0, SLEEP_L0, jadwal, HARI);

  const ref = useCanvas(
    (ctx, w, ch) => {
      const t0 = (HARI - TAMPIL) * 24;
      const deret = r.series.filter((p) => p.t >= t0);

      const pita: ChartBand[] = [];
      let mulai: number | null = null;
      for (const p of deret) {
        if (p.asleep && mulai === null) mulai = p.t - t0;
        else if (!p.asleep && mulai !== null) {
          pita.push({ axis: "x", from: mulai, to: p.t - t0 });
          mulai = null;
        }
      }
      if (mulai !== null) pita.push({ axis: "x", from: mulai, to: TAMPIL * 24 });

      const kurva: ChartSeries[] = [
        {
          pts: deret.map((p) => ({ x: p.t - t0, y: p.upper })),
          color: C.critical,
          weight: W.thin,
          dash: DASH.hidden,
          label: T.upperThreshold,
          labelAt: 0.12,
          labelDy: -10,
          labelAlign: "left",
        },
        {
          pts: deret.map((p) => ({ x: p.t - t0, y: p.lower })),
          color: C.critical,
          weight: W.thin,
          dash: DASH.hidden,
          label: T.lowerThreshold,
          labelAt: 0.12,
          labelDy: 16,
          labelAlign: "left",
        },
        {
          pts: deret.map((p) => ({ x: p.t - t0, y: p.S })),
          color: C.water,
          weight: W.bold,
          label: T.sleepPressure,
          labelAt: 0.62,
          labelDy: -12,
        },
      ];

      drawChart(
        ctx,
        w,
        ch,
        {
          xMin: 0,
          xMax: TAMPIL * 24,
          yMin: 0,
          yMax: 1,
          axisX: T.axHour,
          axisY: T.sleepPressure,
          series: kurva,
          bands: pita,
          regions: pita.slice(0, 1).map((b) => ({
            x: (b.from + b.to) / 2,
            y: 0.08,
            text: T.asleepLabel,
            color: C.ink3,
          })),
          heading: !r.steady
            ? x.belumMantap
            : r.cannotSleepYet
              ? x.tidakTidur
              : undefined,
          headingColor: C.signal,
          padRight: 40,
        },
        lang
      );
    },
    [amp, bed, wake, paksa, lang]
  );

  return (
    <LabShell
      sheet="SY-01"
      subject={SUBJECTS.SY[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Matikan irama hariannya dan daurnya{" "}
            <Term tint={C.critical}>tetap ada</Term>, hanya panjangnya menjadi{" "}
            <Term tint={C.water}>{fmt(r.freePeriod, 1)} jam</Term>. Irama harian
            bukan sumber daurnya melainkan penguncinya ke panjang hari.
          </p>
        ) : (
          <p>
            Switch the circadian rhythm off and the cycle is{" "}
            <Term tint={C.critical}>still there</Term>, only{" "}
            <Term tint={C.water}>{fmt(r.freePeriod, 1)} hours</Term> long. The
            rhythm is not the source of the cycle but what locks it to the day.
          </p>
        )
      }
      drawing={
        <Sheet
          number="SY-01"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: lang === "id" ? "jam" : "hours" },
            { label: "D", value: `${fmt(r.meanDuration, 2)} h`, tint: C.water },
            { label: "P", value: `${fmt(r.cyclePeriod, 2)} h`, tint: C.critical },
            { label: "τr", value: `${fmtPlain(SLEEP_TAU_RISE, 1)} h` },
            { label: "τd", value: `${fmtPlain(SLEEP_TAU_FALL, 1)} h` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <div className="mb-3">
              <PresetRow
                label={x.mode}
                active={paksa ? 1 : 0}
                presets={[
                  { label: x.mBebas, apply: () => setPaksa(false) },
                  { label: x.mPaksa, apply: () => setPaksa(true) },
                ]}
              />
            </div>
            <InputTable>
              <InputRow symbol="a" label={x.dAmp} value={amp} min={0} max={0.18} step={0.005} digits={3} onChange={setAmp} tint={C.critical} />
              <InputRow symbol="tb" label={x.dBed} value={bed} min={18} max={26} step={0.25} digits={2} unit="h" onChange={setBed} tint={paksa ? C.water : C.ink3} />
              <InputRow symbol="tw" label={x.dWake} value={wake} min={3} max={11} step={0.25} digits={2} unit="h" onChange={setWake} tint={paksa ? C.water : C.ink3} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pBebas, apply: () => { setAmp(0.1); setPaksa(false); } },
                  { label: x.pPendek, apply: () => { setAmp(0.1); setBed(23); setWake(5); setPaksa(true); } },
                  { label: x.pAwal, apply: () => { setAmp(0.1); setBed(20); setWake(6); setPaksa(true); } },
                  { label: x.pTanpaIrama, apply: () => { setAmp(0); setPaksa(false); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={r.entrained ? C.water : undefined} alert={!r.steady}>
                {!r.steady ? x.belumMantap : r.entrained ? x.terkunci : x.bebasDaur}
              </Flag>
              {r.cannotSleepYet && <Flag alert>{x.tidakTidur}</Flag>}
            </div>
            {!r.steady && (
              <div className="mb-2.5">
                <Note>{x.belumMantapNote}</Note>
              </div>
            )}
            {r.steady && r.cannotSleepYet && (
              <div className="mb-2.5">
                <Note>{x.latNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "t1", label: x.rOnset, value: jam(r.onsetClock), tint: C.water },
                { symbol: "t2", label: x.rWake, value: jam(r.wakeClock), tint: C.water },
                { symbol: "D", label: x.rDur, value: fmt(r.meanDuration, 2), unit: "h", strong: true },
                { symbol: "tl", label: x.rLat, value: fmt(r.latency, 2), unit: "h", tint: r.cannotSleepYet ? C.signal : undefined },
                { symbol: "P", label: x.rPeriod, value: fmt(r.cyclePeriod, 2), unit: "h", tint: C.critical, strong: true },
                { symbol: "P0", label: x.rFree, value: fmt(r.freePeriod, 2), unit: "h" },
                { symbol: "Sb", label: x.rSwake, value: fmt(r.Swake, 4) },
                { symbol: "St", label: x.rSonset, value: fmt(r.Sonset, 4) },
                { symbol: "Sb*", label: x.rSteady, value: fmt(r.SwakeSteady, 4), tint: r.steady ? undefined : C.ink3 },
                { symbol: "Δ", label: x.rDebt, value: fmt(r.debtHours, 2), unit: "h", tint: r.restricted ? C.signal : undefined },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(amp, paksa, bed, wake, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksSleep(amp, jadwal)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <Frac num="dS" den="dt" />
                <span>=</span>
                <Frac num="1 − S" den={`τr ${fmtPlain(SLEEP_TAU_RISE, 1)} h`} />
                <span className="ml-5 text-ink-3">
                  {lang === "id" ? "terjaga" : "awake"}
                </span>
                <span className="ml-5">−</span>
                <Frac num="S" den={`τd ${fmtPlain(SLEEP_TAU_FALL, 1)} h`} />
                <span className="ml-5 text-ink-3">
                  {lang === "id" ? "tidur" : "asleep"}
                </span>
              </Eq>
              <Eq>
                <span>H(t) = {fmtPlain(SLEEP_H0, 2)} + a cos</span>
                <Frac num={`2π (t − ${fmtPlain(SLEEP_ACROPHASE, 0)})`} den="24" />
                <span className="ml-5">L(t) = {fmtPlain(SLEEP_L0, 2)} + a cos(…)</span>
              </Eq>
              <Eq>
                <span>Sbangun =</span>
                <Frac num="ef (1 − er)" den="1 − ef er" />
                <span className="ml-3 text-ink-3">
                  {lang === "id"
                    ? "ef = e^(−D/τd), er = e^(−(P−D)/τr), berlaku pada daur yang sudah berulang"
                    : "ef = e^(−D/τd), er = e^(−(P−D)/τr), valid on a repeating cycle"}
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
  amp: number,
  paksa: boolean,
  bed: number,
  wake: number,
  lang: Lang
): string {
  const r = sleepRegulation(amp, SLEEP_H0, SLEEP_L0, paksa ? { bedtime: bed, wakeTime: wake } : null, HARI);
  const datar = sleepRegulation(0, SLEEP_H0, SLEEP_L0, null, HARI);
  const awal = sleepRegulation(amp, SLEEP_H0, SLEEP_L0, { bedtime: 20, wakeTime: 6 }, HARI);

  if (lang === "en")
    return `The cycle here runs ${fmt(r.cyclePeriod, 2)} hours and sleep lasts ${fmt(r.meanDuration, 2)}. Now drag the circadian amplitude to zero: the cycle does not stop, it slows to ${fmt(datar.freePeriod, 2)} hours and stops matching the day, which is what a free running person in a cave actually does. Then take the imposed schedule and set bed at twenty hundred, waking at six. The window is ten hours long, yet only ${fmt(awal.meanDuration, 2)} of them are sleep: the other ${fmt(awal.latency, 2)} are spent awake in bed, because sleep pressure had not reached the threshold when the lights went out.`;
  return `Daurnya di sini ${fmt(r.cyclePeriod, 2)} jam dan tidurnya ${fmt(r.meanDuration, 2)} jam. Sekarang geser simpangan irama hariannya ke nol: daurnya tidak berhenti, ia melambat menjadi ${fmt(datar.freePeriod, 2)} jam dan berhenti cocok dengan hari, dan itulah yang sebenarnya terjadi pada orang yang tinggal di gua tanpa penunjuk waktu. Lalu pakai jadwal yang dipaksakan dan setel tidur pukul dua puluh, bangun pukul enam. Jendelanya sepuluh jam, tetapi hanya ${fmt(awal.meanDuration, 2)} jam yang menjadi tidur: ${fmt(awal.latency, 2)} jam sisanya terjaga di tempat tidur, karena tekanan tidurnya belum mencapai ambang ketika lampunya dimatikan.`;
}
