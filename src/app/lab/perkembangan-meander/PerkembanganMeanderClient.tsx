"use client";

import { useState } from "react";
import { Basis, Eq, LabShell } from "@/components/LabShell";
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
import { drawField, type FieldLine } from "@/lib/drawField";
import {
  MEANDER_CUTOFF,
  MEANDER_PEAK_RATIO,
  fmt,
  meanderPath,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksMeander } from "@/lib/checks";

const TXT = {
  id: {
    title: "Perkembangan meander",
    sheetTitle: "Lintasan sungai berkelok menurut lengkung bersudut sinus",
    dW: "Lebar sungai",
    dL: "Panjang gelombang meander sepanjang lintasan",
    dA: "Sudut ayun terbesar",
    pLurus: "Hampir lurus, baru mulai berkelok",
    pMatang: "Kelokan matang, laju pindah tercepat",
    pLeher: "Leher sudah sempit, siap terpotong",
    rSin: "Sinusitas, panjang lintasan dibagi jarak lurus",
    rPanjang: "Panjang gelombang meander",
    rJari: "Jari-jari lengkung terkecil",
    rNisbah: "Jari-jari terkecil dibagi lebar sungai",
    rPindah: "Laju pindah tebing",
    rLeopold: "Panjang gelombang menurut Leopold dan Wolman",
    cepat: "Nisbah jari-jari di sekitar laju pindah tercepat",
    lambat: "Kelokannya bergerak lambat",
    potong: "Lehernya sudah cukup sempit untuk terpotong",
    potongNote:
      "Nisbah jari-jari terhadap lebar sungai sudah turun di bawah ambang pemotongan. Yang terjadi berikutnya bukan kelokan yang bertambah tajam melainkan kelokan yang berakhir: kedua sisi lehernya bertemu, sungainya memotong jalan pintas, dan kelokan yang ditinggalkannya menjadi danau tapal kuda. Sungai karena itu tidak pernah berkelok semakin tajam tanpa batas, dan sinusitas sungai alami di seluruh dunia berhenti di sekitar tiga. Yang membatasinya bukan aliran airnya melainkan geometrinya sendiri.",
    note:
      "Sungai yang berkelok tidak berkelok karena ada yang menghalanginya. Lembar ini memakai lengkung bersudut sinus, yaitu bentuk yang ditemukan Langbein dan Leopold sebagai lintasan yang membelokkan arah dengan kerja paling sedikit di antara semua lintasan yang menghubungkan dua titik dengan panjang tertentu. Bentuk itu muncul sendiri pada sungai, pada aliran air lelehan di atas es, dan bahkan pada arus laut yang sama sekali tidak bertepi, jadi ia bukan hasil tanah melainkan hasil geometri. Dua angka pantas diingat darinya. Pertama, panjang gelombang meander hampir selalu sekitar sebelas kali lebar sungainya, hubungan yang bertahan dari parit selebar satu meter sampai sungai selebar satu kilometer, lima orde besaran. Kedua, kelokan berpindah paling cepat bukan saat ia paling tajam melainkan saat jari-jarinya sekitar dua sampai tiga kali lebar sungainya. Kelokan yang lebih landai belum cukup memusatkan alirannya; kelokan yang lebih tajam sudah kehilangan tenaganya sendiri karena gesekan di tikungan. Akibatnya sungai punya kecepatan berkelok yang paling disukainya, dan kelokan yang melewati ambang itu justru melambat sampai lehernya terpotong dan seluruh daurnya dimulai kembali.",
  },
  en: {
    title: "Meander development",
    sheetTitle: "A meandering river path following a sine-generated curve",
    dW: "River width",
    dL: "Meander wavelength along the path",
    dA: "Maximum swing angle",
    pLurus: "Nearly straight, only beginning to bend",
    pMatang: "A mature bend, migrating fastest",
    pLeher: "The neck is narrow, ready to be cut off",
    rSin: "Sinuosity, path length over straight distance",
    rPanjang: "Meander wavelength",
    rJari: "Smallest radius of curvature",
    rNisbah: "Smallest radius over river width",
    rPindah: "Bank migration rate",
    rLeopold: "Wavelength after Leopold and Wolman",
    cepat: "Radius ratio near the fastest migration",
    lambat: "The bend is moving slowly",
    potong: "The neck is narrow enough to be cut off",
    potongNote:
      "The ratio of radius to river width has dropped below the cutoff threshold. What comes next is not a sharper bend but the end of the bend: the two sides of the neck meet, the river takes the short cut, and the bend left behind becomes an oxbow lake. A river therefore never bends more and more sharply without limit, and the sinuosity of natural rivers everywhere stops at about three. What limits it is not the water but its own geometry.",
    note:
      "A meandering river does not meander because something is in its way. This sheet uses the sine-generated curve, the shape Langbein and Leopold found to be the path that turns a direction with the least work among all paths joining two points with a given length. That shape appears by itself in rivers, in meltwater channels across ice, and even in ocean currents that have no banks at all, so it is not a product of the ground but of geometry. Two numbers are worth remembering from it. First, the meander wavelength is nearly always about eleven times the river width, a relation holding from a one-metre ditch to a one-kilometre river, five orders of magnitude. Second, a bend migrates fastest not when it is sharpest but when its radius is about two to three times the river width. A gentler bend does not concentrate its flow enough; a sharper one has lost its own energy to friction in the turn. A river therefore has a preferred speed of bending, and a bend that passes that threshold actually slows down until its neck is cut off and the whole cycle begins again.",
  },
} as const;

const REFS = {
  id: [
    "Langbein, W.B. & Leopold, L.B. (1966). River meanders — theory of minimum variance. USGS Professional Paper 422-H.",
    "Leopold, L.B. & Wolman, M.G. (1960). River meanders. Geol. Soc. Am. Bull. 71, 769–794.",
    "Hickin, E.J. & Nanson, G.C. (1975). The character of channel migration on the Beatton River. Geol. Soc. Am. Bull. 86, 487–494.",
    "Ikeda, S., Parker, G. & Sawai, K. (1981). Bend theory of river meanders. J. Fluid Mech. 112, 363–377.",
  ],
  en: [
    "Langbein, W.B. & Leopold, L.B. (1966). River meanders — theory of minimum variance. USGS Professional Paper 422-H.",
    "Leopold, L.B. & Wolman, M.G. (1960). River meanders. Geol. Soc. Am. Bull. 71, 769–794.",
    "Hickin, E.J. & Nanson, G.C. (1975). The character of channel migration on the Beatton River. Geol. Soc. Am. Bull. 86, 487–494.",
    "Ikeda, S., Parker, G. & Sawai, K. (1981). Bend theory of river meanders. J. Fluid Mech. 112, 363–377.",
  ],
} as const;

/** Kedua tebing, yaitu lintasannya digeser setengah lebar ke kiri dan ke kanan. */
function tebing(path: { x: number; y: number }[], setengah: number, sisi: 1 | -1) {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(path.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const p = Math.hypot(dx, dy) || 1;
    out.push({
      x: path[i].x + (sisi * setengah * -dy) / p,
      y: path[i].y + (sisi * setengah * dx) / p,
    });
  }
  return out;
}

export function PerkembanganMeanderClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [W_, setW] = useState(30);
  const [L, setL] = useState(330);
  const [sudut, setSudut] = useState(70);

  const r = meanderPath(W_, L, sudut);
  const akhir = r.path[r.path.length - 1];

  const ref = useCanvas(
    (ctx, w, ch) => {
      const setengah = W_ / 2;
      const garis: FieldLine[] = [
        {
          pts: [
            { x: r.path[0].x, y: r.path[0].y },
            { x: akhir.x, y: akhir.y },
          ],
          color: C.ink3,
          weight: W.hair,
          dash: DASH.axis,
          label: T.straightLine,
          labelAt: 0.5,
          labelDy: 14,
          labelAlign: "center",
        },
        {
          pts: tebing(r.path, setengah, 1),
          color: C.ink2,
          weight: W.thin,
          dash: DASH.solid,
          label: T.outerBank,
          labelAt: 0.24,
          labelDy: -10,
          labelAlign: "center",
        },
        {
          pts: tebing(r.path, setengah, -1),
          color: C.ink2,
          weight: W.thin,
          dash: DASH.solid,
        },
        {
          pts: r.path,
          color: r.cutoff ? C.signal : C.water,
          weight: W.bold,
          dash: DASH.solid,
          label: T.riverPath,
          labelAt: 0.72,
          labelDy: -12,
          labelAlign: "center",
          arrow: true,
        },
      ];

      const xs = r.path.map((p) => p.x);
      const ys = r.path.map((p) => p.y);
      const xMin = Math.min(...xs) - W_;
      const xMax = Math.max(...xs) + W_;
      const yMin = Math.min(...ys) - W_;
      const yMax = Math.max(...ys) + W_;

      drawField(
        ctx,
        w,
        ch,
        {
          xMin,
          xMax,
          yMin,
          yMax,
          lines: garis,
          heading: r.cutoff
            ? x.potong
            : r.fastestMigration
              ? x.cepat
              : undefined,
          headingColor: r.cutoff ? C.signal : C.critical,
          axisX: T.axXMetre,
          axisY: T.axYMetre,
        },
        lang
      );
    },
    [W_, L, sudut, lang]
  );

  return (
    <LabShell
      sheet="OC-11"
      subject={SUBJECTS.OC[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Kelokan berpindah paling cepat bukan saat ia paling tajam melainkan
            saat jari-jarinya sekitar{" "}
            <Term tint={C.critical}>dua setengah kali lebar sungainya</Term>.
            Lebih tajam dari itu, ia justru melambat sampai{" "}
            <Term tint={C.water}>lehernya terpotong</Term>.
          </p>
        ) : (
          <p>
            A bend migrates fastest not when it is sharpest but when its radius
            is about{" "}
            <Term tint={C.critical}>two and a half times the river width</Term>.
            Sharper than that it slows, until its{" "}
            <Term tint={C.water}>neck is cut off</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="OC-11"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m)" },
            { label: "P", value: fmt(r.sinuosity, 3), tint: C.water },
            {
              label: "Rc/W",
              value: fmt(r.radiusRatio, 2),
              tint: r.cutoff ? C.signal : r.fastestMigration ? C.critical : undefined,
            },
            { label: "λ/W", value: fmt(r.wavelength / W_, 1) },
            { label: "ṁ", value: `${fmt(r.migrationRate, 3)} W/y` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="W" label={x.dW} value={W_} min={2} max={300} step={1} digits={0} unit="m" onChange={setW} />
              <InputRow symbol="λ" label={x.dL} value={L} min={20} max={2000} step={10} digits={0} unit="m" onChange={setL} tint={C.water} />
              <InputRow symbol="ω" label={x.dA} value={sudut} min={0} max={140} step={2} digits={0} unit="°" onChange={setSudut} tint={C.critical} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pLurus, apply: () => { setW(30); setL(330); setSudut(20); } },
                  { label: x.pMatang, apply: () => { setW(30); setL(330); setSudut(70); } },
                  { label: x.pLeher, apply: () => { setW(30); setL(330); setSudut(130); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={r.fastestMigration ? C.critical : C.ink2} alert={r.cutoff}>
                {r.cutoff ? x.potong : r.fastestMigration ? x.cepat : x.lambat}
              </Flag>
            </div>
            {r.cutoff && (
              <div className="mb-2.5">
                <Note>{x.potongNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "P", label: x.rSin, value: fmt(r.sinuosity, 4), tint: C.water, strong: true },
                { symbol: "λ", label: x.rPanjang, value: fmt(r.wavelength, 1), unit: "m" },
                { symbol: "Rc", label: x.rJari, value: fmt(r.minRadius, 2), unit: "m" },
                { symbol: "Rc/W", label: x.rNisbah, value: fmt(r.radiusRatio, 3), tint: r.cutoff ? C.signal : C.critical, strong: true },
                { symbol: "ṁ", label: x.rPindah, value: fmt(r.migrationRate, 4), unit: "W/y" },
                { symbol: "λL", label: x.rLeopold, value: fmt(r.wavelengthLeopold, 1), unit: "m" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(W_, L, sudut, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksMeander(W_, L, sudut)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>θ(s) = ω cos(2π s / λ)</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "arah lintasannya sinus terhadap jarak sepanjang lintasan"
                    : "the path direction is sinusoidal in distance along the path"}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `laju pindah memuncak di Rc/W ≈ ${fmt(MEANDER_PEAK_RATIO, 1)}; leher terpotong di bawah Rc/W ≈ ${fmt(MEANDER_CUTOFF, 1)}`
                    : `migration peaks at Rc/W ≈ ${fmt(MEANDER_PEAK_RATIO, 1)}; the neck cuts off below Rc/W ≈ ${fmt(MEANDER_CUTOFF, 1)}`}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "Leopold dan Wolman: λ ≈ 10,9 W^1,01"
                    : "Leopold and Wolman: λ ≈ 10.9 W^1.01"}
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

function notice(W_: number, L: number, sudut: number, lang: Lang) {
  const a = meanderPath(W_, L, sudut);
  const landai = meanderPath(W_, L, Math.max(5, sudut / 2));
  const tajam = meanderPath(W_, L, Math.min(140, sudut * 1.6));

  if (lang === "en")
    return `At a swing of ${fmt(sudut, 0)} degrees the sinuosity is ${fmt(a.sinuosity, 2)} and the bend migrates at ${fmt(a.migrationRate, 3)} widths a year. Halve the swing and the migration falls to ${fmt(landai.migrationRate, 3)}: too gentle to gather its flow. Increase it instead and the migration goes to ${fmt(tajam.migrationRate, 3)}, which is slower again, because past the peak the bend spends its energy on friction in the turn rather than on its bank. Notice too that the wavelength Leopold and Wolman measured for a river of this width is ${fmt(a.wavelengthLeopold, 0)} metres, against the ${fmt(a.wavelength, 0)} set here.`;
  return `Pada sudut ayun ${fmt(sudut, 0)} derajat, sinusitasnya ${fmt(a.sinuosity, 2)} dan kelokannya berpindah ${fmt(a.migrationRate, 3)} lebar tiap tahun. Separuhkan sudut ayunnya dan laju pindahnya turun ke ${fmt(landai.migrationRate, 3)}: terlalu landai untuk memusatkan alirannya. Tajamkan sebaliknya dan laju pindahnya menjadi ${fmt(tajam.migrationRate, 3)}, yang justru lebih lambat lagi, karena melewati puncaknya kelokan itu menghabiskan tenaganya pada gesekan di tikungan dan bukan pada tebingnya. Perhatikan pula panjang gelombang yang diukur Leopold dan Wolman untuk sungai selebar ini, yaitu ${fmt(a.wavelengthLeopold, 0)} meter, terhadap ${fmt(a.wavelength, 0)} yang dipilih di sini.`;
}
