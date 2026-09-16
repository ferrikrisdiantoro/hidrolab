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
import { RECAPTURE_MIN, fmt, fmtPlain, markRecapture } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksMarkRecapture } from "@/lib/checks";

const TXT = {
  id: {
    title: "Tangkap-tandai-tangkap ulang",
    sheetTitle: "Taksiran populasi dari dua kali penangkapan",
    dM: "Ditandai pada penangkapan pertama",
    dN: "Ditangkap pada penangkapan kedua",
    dm: "Bertanda di dalam tangkapan kedua",
    pBaik: "Contoh memadai",
    pSedikit: "Tangkapan ulang sedikit",
    pKecil: "Kolam kecil, contoh besar",
    rChap: "Taksiran Chapman",
    rPet: "Taksiran Lincoln-Petersen",
    rCi: "Selang kepercayaan 95 persen",
    rLebar: "Lebar selang terhadap taksirannya",
    rFrac: "Bagian populasi yang tertandai",
    rBias: "Selisih Petersen terhadap Chapman",
    sedikit: "Tangkapan ulang terlalu sedikit",
    mustahil: "Tangkapan bertanda melebihi tangkapan keduanya",
    mustahilNote:
      "Banyaknya bertanda di dalam tangkapan kedua disetel melebihi banyaknya yang tertangkap pada penangkapan kedua itu sendiri. Keadaan itu tidak mungkin: yang bertanda adalah sebagian dari yang tertangkap, bukan tambahan atasnya. Tidak ada taksiran yang dapat dihitung dari keadaan yang tidak dapat terjadi, jadi lembar ini tidak menghitungnya. Turunkan banyaknya yang bertanda, atau naikkan tangkapan keduanya.",
    sedikitNote:
      "Bertanda yang tertangkap ulang kurang dari tujuh ekor. Di bawah itu selang kepercayaannya melebar sampai taksirannya kehilangan arti praktis: batas atas dan batas bawah dapat terpaut berkali lipat. Angkanya tetap keluar, dan di situlah bahayanya, karena satu angka tunggal tampak lebih pasti daripada yang sebenarnya. Tambah usaha penangkapan kedua, atau tandai lebih banyak pada penangkapan pertama, sampai tangkapan ulangnya mencapai belasan.",
    note:
      "Gagasannya dapat dikatakan dalam satu kalimat: bila bagian yang tertandai pada tangkapan kedua sama dengan bagian yang tertandai pada seluruh populasi, maka jumlah populasinya dapat dihitung. Yang sulit bukan rumusnya melainkan syarat-syarat di baliknya, dan empat di antaranya jarang terpenuhi di sungai. Populasinya harus tertutup, tidak ada yang lahir, mati, masuk, atau keluar di antara kedua penangkapan. Tandanya tidak boleh lepas dan tidak boleh terlewat saat pemeriksaan. Ikan bertanda harus bercampur kembali secara merata sebelum penangkapan kedua. Dan yang paling sering dilanggar: peluang tertangkap harus sama bagi yang bertanda dan yang tidak, padahal ikan yang pernah tertangkap kerap belajar menghindari alat tangkap. Pelanggaran yang terakhir itu selalu membesarkan taksirannya, karena tangkapan ulang menjadi lebih sedikit daripada seharusnya. Taksiran Chapman dipakai di sini menggantikan Lincoln-Petersen karena ia tetap memberi angka terhingga bahkan ketika tidak ada satu pun yang tertangkap ulang.",
  },
  en: {
    title: "Mark-recapture",
    sheetTitle: "Population estimate from two capture events",
    dM: "Marked in the first capture",
    dN: "Caught in the second capture",
    dm: "Marked ones within the second catch",
    pBaik: "Adequate sample",
    pSedikit: "Few recaptures",
    pKecil: "Small pond, large sample",
    rChap: "Chapman estimate",
    rPet: "Lincoln-Petersen estimate",
    rCi: "95 per cent confidence interval",
    rLebar: "Interval width relative to the estimate",
    rFrac: "Fraction of the population marked",
    rBias: "Petersen minus Chapman",
    sedikit: "Too few recaptures",
    mustahil: "Marked recaptures exceed the second catch",
    mustahilNote:
      "The number of marked individuals within the second catch is set above the size of that second catch itself. This cannot happen: the marked ones are a part of what was caught, not an addition to it. No estimate can be computed from a state that cannot occur, so this sheet does not compute one. Lower the number marked, or raise the second catch.",
    sedikitNote:
      "Fewer than seven marked individuals were recaptured. Below that the confidence interval widens until the estimate loses practical meaning: upper and lower bounds can differ several times over. A number still appears, and that is the danger, because a single figure looks more certain than it is. Increase the second capture effort, or mark more in the first, until the recaptures reach the teens.",
    note:
      "The idea takes one sentence: if the marked fraction of the second catch equals the marked fraction of the whole population, the population size follows. What is hard is not the formula but the conditions behind it, and four of them are rarely met in a river. The population must be closed, with no births, deaths, arrivals, or departures between the two captures. Marks must not be shed and must not be missed on inspection. Marked fish must mix back evenly before the second capture. And the one most often violated: the chance of capture must be equal for marked and unmarked, although fish that have been caught once often learn to avoid the gear. That last violation always inflates the estimate, because recaptures come out fewer than they should. The Chapman estimate is used here in place of Lincoln-Petersen because it still returns a finite number even when nothing at all is recaptured.",
  },
} as const;

const REFS = {
  id: [
    "Seber, G.A.F. (1982). The Estimation of Animal Abundance and Related Parameters, edisi ke-2. Griffin.",
    "Chapman, D.G. (1951). Some properties of the hypergeometric distribution with applications to zoological censuses. University of California Publications in Statistics, vol. 1.",
    "Krebs, C.J. (1999). Ecological Methodology, edisi ke-2. Benjamin Cummings, Bab 2.",
    "Ricker, W.E. (1975). Computation and interpretation of biological statistics of fish populations. Fisheries Research Board of Canada Bulletin 191.",
  ],
  en: [
    "Seber, G.A.F. (1982). The Estimation of Animal Abundance and Related Parameters, 2nd ed. Griffin.",
    "Chapman, D.G. (1951). Some properties of the hypergeometric distribution with applications to zoological censuses. University of California Publications in Statistics, vol. 1.",
    "Krebs, C.J. (1999). Ecological Methodology, 2nd ed. Benjamin Cummings, Chapter 2.",
    "Ricker, W.E. (1975). Computation and interpretation of biological statistics of fish populations. Fisheries Research Board of Canada Bulletin 191.",
  ],
} as const;

export function TangkapTandaiUlangClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [M, setM] = useState(200);
  const [n, setN] = useState(150);
  const [m, setM2] = useState(30);

  /*
   * Tangkapan bertanda tidak mungkin melebihi tangkapan keduanya sendiri.
   *
   * Sebelumnya angkanya diam-diam dipotong ke n, dan akibatnya penggeser
   * menunjukkan dua ratus sementara kop menunjukkan lima, tanpa satu pun
   * tulisan yang menerangkan selisihnya. Pemotongan diam-diam pada masukan
   * yang mustahil selalu lebih buruk daripada penolakan yang bersuara:
   * pembaca yang tidak melihat keterangannya akan menyimpulkan lembarnya
   * salah hitung.
   */
  const mustahil = m > n;
  const mAman = Math.min(m, n);
  const r = markRecapture(M, n, mAman);
  const lebar = r.chapman > 0 ? (r.ciHigh - r.ciLow) / r.chapman : 0;

  const ref = useCanvas(
    (ctx, w, h) => {
      const chap: { x: number; y: number }[] = [];
      const pet: { x: number; y: number }[] = [];
      const atas: { x: number; y: number }[] = [];
      const bawah: { x: number; y: number }[] = [];
      const mMax = Math.min(n, Math.max(mAman * 3, 40));
      for (let k = 1; k <= mMax; k++) {
        const rk = markRecapture(M, n, k);
        chap.push({ x: k, y: rk.chapman });
        pet.push({ x: k, y: rk.petersen });
        atas.push({ x: k, y: rk.ciHigh });
        bawah.push({ x: k, y: rk.ciLow });
      }

      const yMax = Math.max(
        Math.min(chap[0].y * 1.2, r.chapman * 6),
        r.ciHigh * 1.15,
        1
      );

      const deret: ChartSeries[] = [
        {
          pts: atas,
          color: C.ink3,
          weight: W.hair,
          dash: DASH.hidden,
          label: T.axPopulation,
          labelAt: 0.6,
          labelDy: -10,
        },
        { pts: bawah, color: C.ink3, weight: W.hair, dash: DASH.hidden },
        {
          pts: pet,
          color: C.critical,
          weight: W.thin,
          dash: DASH.phantom,
          label: "Petersen",
          labelAt: 0.35,
          labelDy: -11,
        },
        {
          pts: chap,
          color: mAman < RECAPTURE_MIN ? C.signal : C.water,
          weight: W.bold,
          dash: mAman < RECAPTURE_MIN ? DASH.invalid : DASH.solid,
          label: "Chapman",
          labelAt: 0.75,
          labelDy: 14,
        },
      ];

      drawChart(
        ctx,
        w,
        h,
        {
          xMin: 1,
          xMax: mMax,
          yMin: 0,
          yMax: yMax,
          axisX: T.axRecapture,
          axisY: T.axPopulation,
          series: deret,
          bands: [{ axis: "x", from: 1, to: RECAPTURE_MIN }],
          heading: mustahil ? x.mustahil : undefined,
          headingColor: C.signal,
          point: {
            x: mAman,
            y: r.chapman,
            label: `${fmtPlain(r.chapman, 0)}`,
            invalid: r.tooFewRecaptures,
          },
        },
        lang
      );
    },
    [M, n, m, lang]
  );

  return (
    <LabShell
      sheet="EK-03"
      subject={SUBJECTS.EK[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Bila bagian yang <Term tint={C.water}>bertanda</Term> pada
            tangkapan kedua sama dengan bagian bertanda pada seluruh populasi,
            jumlahnya dapat dihitung. Yang sulit bukan rumusnya melainkan{" "}
            <Term tint={C.signal}>syarat di baliknya</Term>.
          </p>
        ) : (
          <p>
            If the <Term tint={C.water}>marked</Term> fraction of the second
            catch equals the marked fraction of the whole population, the size
            follows. What is hard is not the formula but the{" "}
            <Term tint={C.signal}>conditions behind it</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="EK-03"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: lang === "id" ? "ekor" : "individuals" },
            { label: "M", value: fmt(M, 0) },
            { label: "n", value: fmt(n, 0) },
            { label: "m", value: mustahil ? "—" : fmt(mAman, 0), tint: mustahil || r.tooFewRecaptures ? C.signal : undefined },
            { label: "N̂", value: mustahil ? "—" : fmt(r.chapman, 0), tint: mustahil ? C.signal : C.water },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="M" label={x.dM} value={M} min={5} max={2000} step={5} digits={0} onChange={setM} tint={C.water} />
              <InputRow symbol="n" label={x.dN} value={n} min={5} max={2000} step={5} digits={0} onChange={setN} />
              <InputRow symbol="m" label={x.dm} value={m} min={0} max={200} step={1} digits={0} onChange={setM2} tint={C.signal} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pBaik, apply: () => { setM(200); setN(150); setM2(30); } },
                  { label: x.pSedikit, apply: () => { setM(200); setN(150); setM2(3); } },
                  { label: x.pKecil, apply: () => { setM(80); setN(120); setM2(48); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={mustahil || r.tooFewRecaptures ? undefined : C.water} alert={mustahil || r.tooFewRecaptures}>
                {mustahil
                  ? x.mustahil
                  : `${fmt(r.chapman, 0)} ${lang === "id" ? "ekor" : "individuals"}`}
              </Flag>
              {!mustahil && r.tooFewRecaptures && <Flag alert>{x.sedikit}</Flag>}
            </div>
            {mustahil && (
              <div className="mb-2.5">
                <Note>{x.mustahilNote}</Note>
              </div>
            )}
            {!mustahil && r.tooFewRecaptures && (
              <div className="mb-2.5">
                <Note>{x.sedikitNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                /* Pada keadaan mustahil tidak satu pun taksiran ditampilkan.
                   Taksiran yang dihitung dari keadaan yang tidak dapat
                   terjadi bukan taksiran yang longgar melainkan taksiran
                   yang tidak punya arti. */
                { symbol: "N̂", label: x.rChap, value: mustahil ? "—" : fmt(r.chapman, 1), tint: mustahil ? C.signal : C.water, strong: true },
                { symbol: "—", label: x.rCi, value: mustahil ? "—" : `${fmt(r.ciLow, 0)} – ${fmt(r.ciHigh, 0)}`, tint: mustahil || r.tooFewRecaptures ? C.signal : undefined, strong: true },
                { symbol: "N̂p", label: x.rPet, value: mustahil ? "—" : Number.isFinite(r.petersen) ? fmt(r.petersen, 1) : "∞", tint: mustahil ? C.signal : C.critical },
                { symbol: "—", label: x.rBias, value: mustahil ? "—" : Number.isFinite(r.petersen) ? fmt(r.petersen - r.chapman, 1) : "∞" },
                { symbol: "—", label: x.rLebar, value: mustahil ? "—" : fmt(lebar * 100, 1), unit: mustahil ? undefined : "%" },
                { symbol: "M/N̂", label: x.rFrac, value: mustahil ? "—" : fmt(r.markedFraction * 100, 2), unit: mustahil ? undefined : "%" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(M, n, mAman, r.chapman, lebar, r.tooFewRecaptures, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksMarkRecapture(M, n, mAman)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <Frac num="m" den="n" />
                <span>=</span>
                <Frac num="M" den="N" />
                <span className="ml-5">N̂p =</span>
                <Frac num="M n" den="m" />
                <span className="ml-3 text-ink-3">
                  {lang === "id" ? "Lincoln-Petersen" : "Lincoln-Petersen"}
                </span>
              </Eq>
              <Eq>
                <span>N̂ =</span>
                <Frac num="(M+1)(n+1)" den="m+1" />
                <span>− 1</span>
                <span className="ml-3 text-ink-3">
                  {lang === "id"
                    ? "Chapman, tetap terhingga pada m nol"
                    : "Chapman, finite even at m of zero"}
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
  M: number,
  n: number,
  m: number,
  chapman: number,
  lebar: number,
  sedikit: boolean,
  lang: Lang
): string {
  const lebihSatu = markRecapture(M, n, m + 1);
  const bedaSatu = Math.abs(lebihSatu.chapman - chapman);

  if (lang === "en")
    return `One more recapture, ${fmtPlain(m + 1, 0)} instead of ${fmtPlain(m, 0)}, would change the estimate by ${fmt(bedaSatu, 0)} individuals. That single fish is worth ${fmt((bedaSatu / Math.max(chapman, 1e-9)) * 100, 1)} per cent of the answer, and it is the clearest measure of how much weight the second capture carries. The confidence interval spans ${fmt(lebar * 100, 0)} per cent of the estimate. Raise the number recaptured and watch that span close; drop it toward zero and watch the Petersen curve run away to infinity while Chapman stays finite.`;
  return `Satu ekor tangkapan ulang lagi, ${fmtPlain(m + 1, 0)} dan bukan ${fmtPlain(m, 0)}, akan mengubah taksirannya sebesar ${fmt(bedaSatu, 0)} ekor. Satu ikan itu bernilai ${fmt((bedaSatu / Math.max(chapman, 1e-9)) * 100, 1)} persen dari jawabannya, dan itulah ukuran paling jelas tentang berapa besar beban yang dipikul penangkapan kedua. Selang kepercayaannya selebar ${fmt(lebar * 100, 0)} persen dari taksirannya. Perbanyak tangkapan ulangnya lalu perhatikan selang itu merapat; kecilkan menuju nol lalu perhatikan kurva Petersen lari ke tak hingga sementara Chapman tetap terhingga.`;
}
