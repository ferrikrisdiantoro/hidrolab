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
import { drawField, type FieldLine } from "@/lib/drawField";
import {
  MEANDER_CUTOFF,
  MEANDER_PEAK_RATIO,
  fmt,
  meanderPath,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
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
    lipat: "Sungai selebar ini tidak dapat membelok setajam ini",
    lipatNote:
      "Jari-jari lengkung terkecil lintasannya sudah kurang dari separuh lebar sungainya, sehingga tebing dalamnya harus berbelok dengan jari-jari negatif: garis tebingnya melipat dan membelit dirinya sendiri, seperti yang tergambar putus-putus. Bentuk itu tidak dapat ada. Sungai yang sebenarnya sudah memotong lehernya jauh sebelum sampai ke sini, jadi laju pindahnya tidak dituliskan. Sempitkan sungainya, panjangkan gelombangnya, atau kurangi sudut ayunnya.",
    uM: "W/tahun",
    lurusTak: "∞ (lurus)",
    bLipat: "Tebing melipat, mustahil",
    bTajam: "Terlalu tajam, melambat",
    bCepat: "Laju pindah tercepat",
    bLandai: "Landai, lambat",
    bBerkelok: "Berkelok",
    bMeander: "Bermeander",
    bPotong: "Leher terpotong",
    hP: "Sinusitas: panjang dua gelombang dibagi jarak lurus",
    hRc: "Jari-jari lengkung terkecil, di puncak kelokan",
    hM: "Laju pindah tebing, lengkung Hickin dan Nanson",
    hMTak: "Laju pindah tebing: tidak dihitung karena tebingnya melipat",
    potongNote:
      "Sinusitasnya sudah melewati 2,8, ambang tempat leher kelokan mulai terpotong. Yang terjadi berikutnya bukan kelokan yang bertambah tajam melainkan kelokan yang berakhir: kedua sisi lehernya bertemu, sungainya memotong jalan pintas, dan kelokan yang ditinggalkannya menjadi danau tapal kuda. Sungai karena itu tidak pernah berkelok semakin tajam tanpa batas, dan sinusitas sungai alami di seluruh dunia berhenti di sekitar tiga. Yang membatasinya bukan aliran airnya melainkan geometrinya sendiri.",
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
    lipat: "A river this wide cannot turn this sharply",
    lipatNote:
      "The smallest radius of the path is already less than half the river width, so the inner bank would have to turn on a negative radius: its line folds and loops over itself, as drawn dashed. That shape cannot exist. A real river cuts its neck long before it gets here, so no migration rate is written. Narrow the river, lengthen the wavelength, or reduce the swing angle.",
    uM: "W/year",
    lurusTak: "∞ (straight)",
    bLipat: "Bank folds, impossible",
    bTajam: "Too sharp, slowing",
    bCepat: "Fastest migration",
    bLandai: "Gentle, slow",
    bBerkelok: "Sinuous",
    bMeander: "Meandering",
    bPotong: "Neck cut off",
    hP: "Sinuosity: length of two waves over the straight distance",
    hRc: "Smallest radius of curvature, at the bend apex",
    hM: "Bank migration rate, Hickin and Nanson curve",
    hMTak: "Bank migration rate: not computed because the bank folds",
    potongNote:
      "The sinuosity has passed 2.8, the threshold at which the neck of a bend begins to be cut off. What comes next is not a sharper bend but the end of the bend: the two sides of the neck meet, the river takes the short cut, and the bend left behind becomes an oxbow lake. A river therefore never bends more and more sharply without limit, and the sinuosity of natural rivers everywhere stops at about three. What limits it is not the water but its own geometry.",
    note:
      "A meandering river does not meander because something is in its way. This sheet uses the sine-generated curve, the shape Langbein and Leopold found to be the path that turns a direction with the least work among all paths joining two points with a given length. That shape appears by itself in rivers, in meltwater channels across ice, and even in ocean currents that have no banks at all, so it is not a product of the ground but of geometry. Two numbers are worth remembering from it. First, the meander wavelength is nearly always about eleven times the river width, a relation holding from a one-metre ditch to a one-kilometre river, five orders of magnitude. Second, a bend migrates fastest not when it is sharpest but when its radius is about two to three times the river width. A gentler bend does not concentrate its flow enough; a sharper one has lost its own energy to friction in the turn. A river therefore has a preferred speed of bending, and a bend that passes that threshold actually slows down until its neck is cut off and the whole cycle begins again.",
  },
} as const;

const REFS = {
  id: [
    "Langbein, W.B. & Leopold, L.B. (1966). River meanders — theory of minimum variance. USGS Professional Paper 422-H.",
    "Leopold, L.B. & Wolman, M.G. (1960). River meanders. Geol. Soc. Am. Bull. 71, 769–794.",
    "Hickin, E.J. & Nanson, G.C. (1984). Lateral migration rates of river bends. Journal of Hydraulic Engineering 110(11).",
    "Ikeda, S., Parker, G. & Sawai, K. (1981). Bend theory of river meanders. J. Fluid Mech. 112, 363–377.",
  ],
  en: [
    "Langbein, W.B. & Leopold, L.B. (1966). River meanders — theory of minimum variance. USGS Professional Paper 422-H.",
    "Leopold, L.B. & Wolman, M.G. (1960). River meanders. Geol. Soc. Am. Bull. 71, 769–794.",
    "Hickin, E.J. & Nanson, G.C. (1984). Lateral migration rates of river bends. Journal of Hydraulic Engineering 110(11).",
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
  const [sudut, setSudut] = useState(40);

  const r = meanderPath(W_, L, sudut);
  /*
   * Tebing yang digambar sejauh setengah lebar dari sumbunya hanya
   * mungkin bila jari-jari lengkung terkecilnya lebih besar daripada
   * setengah lebar itu. Di bawahnya tebing dalam melipat, dan lembar ini
   * dulu tetap menggambarnya membelit sambil menyebut kelokannya "bergerak
   * lambat", dengan laju pindah yang diambil dari rumus yang dijepit.
   */
  const terlipat = r.radiusRatio < 0.5;
  const akhir = r.path[r.path.length - 1];
  const D = Math.hypot(akhir.x - r.path[0].x, akhir.y - r.path[0].y);
  const omegaRad = (sudut * Math.PI) / 180;

  /* Nada keadaan mengikuti pita Rc/W (Hickin dan Nanson 1984: tercepat
     di 1,7 sampai 3,3, sama dengan fastestMigration), kecuali leher yang
     sudah terpotong. Merah sinyal hanya untuk tebing yang melipat. */
  const nada: Tone = terlipat
    ? "invalid"
    : r.cutoff
      ? "caution"
      : r.radiusRatio < 1.7
        ? "caution"
        : r.fastestMigration
          ? "pass"
          : "neutral";

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
          color: terlipat ? C.signal : C.ink2,
          weight: W.thin,
          dash: terlipat ? DASH.hidden : DASH.solid,
          label: T.outerBank,
          labelAt: 0.24,
          labelDy: -10,
          labelAlign: "center",
        },
        {
          pts: tebing(r.path, setengah, -1),
          color: terlipat ? C.signal : C.ink2,
          weight: W.thin,
          dash: terlipat ? DASH.hidden : DASH.solid,
        },
        {
          pts: r.path,
          // Leher terpotong adalah keadaan sah yang perlu diwaspadai, bukan
          // di luar rentang; merah sinyal hanya untuk tebing yang melipat.
          color: r.cutoff ? C.caution : C.water,
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
      /* Ruang di atas untuk judul keadaan, supaya tidak menimpa kelokannya */
      const adaJudul = terlipat || r.cutoff || r.fastestMigration;
      const yMax = Math.max(...ys) + W_ + (adaJudul ? (Math.max(...ys) - Math.min(...ys) + 2 * W_) * 0.22 : 0);

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
          heading: terlipat
            ? x.lipat
            : r.cutoff
              ? x.potong
              : r.fastestMigration
                ? x.cepat
                : undefined,
          headingColor: terlipat ? C.signal : r.cutoff ? C.caution : C.critical,
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
      status={
        <div className="flex flex-col gap-3">
          <RegimeScale
            symbol="Rc/W"
            value={r.radiusRatio}
            invalid={terlipat}
            pesan={Number.isFinite(r.radiusRatio) ? undefined : x.lurusTak}
            scale="log"
            digits={2}
            bands={[
              { from: 0.01, to: 0.5, label: x.bLipat, tone: "invalid" },
              { from: 0.5, to: 1.7, label: x.bTajam, tone: "caution" },
              { from: 1.7, to: 3.3, label: x.bCepat, tone: "pass" },
              { from: 3.3, to: 100, label: x.bLandai, tone: "neutral" },
            ]}
          />
          <RegimeScale
            symbol="P"
            value={r.sinuosity}
            scale="log"
            digits={2}
            bands={[
              { from: 1, to: 1.5, label: x.bBerkelok, tone: "neutral" },
              { from: 1.5, to: MEANDER_CUTOFF, label: x.bMeander, tone: "water" },
              { from: MEANDER_CUTOFF, to: 100, label: x.bPotong, tone: "caution" },
            ]}
          />
        </div>
      }
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
            { label: "P", value: fmt(r.sinuosity, 3), tint: r.cutoff ? C.caution : C.water },
            {
              label: "Rc/W",
              value: fmt(r.radiusRatio, 2),
              tint: terlipat ? C.signal : r.fastestMigration ? C.critical : undefined,
            },
            { label: "λ/W", value: fmt(r.wavelength / W_, 1) },
            { label: "ṁ", value: terlipat ? "—" : `${fmt(r.migrationRate, 3)} ${x.uM}` },
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
                  { label: x.pMatang, apply: () => { setW(30); setL(330); setSudut(40); } },
                  { label: x.pLeher, apply: () => { setW(30); setL(330); setSudut(130); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "P", label: x.rSin, value: fmt(r.sinuosity, 4), tint: r.cutoff ? C.caution : C.water, strong: true },
                { symbol: "λ", label: x.rPanjang, value: fmt(r.wavelength, 1), unit: "m" },
                { symbol: "Rc", label: x.rJari, value: fmt(r.minRadius, 2), unit: "m" },
                { symbol: "Rc/W", label: x.rNisbah, value: fmt(r.radiusRatio, 3), tint: terlipat ? C.signal : C.critical, strong: true },
                { symbol: "ṁ", label: x.rPindah, value: terlipat ? "—" : fmt(r.migrationRate, 4), unit: terlipat ? undefined : x.uM },
                { symbol: "λL", label: x.rLeopold, value: fmt(r.wavelengthLeopold, 1), unit: "m" },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hP,
                    rumus: (<><span>P =</span><Frac num="2 · λ" den="D" /></>),
                    isi: `2 · ${fmt(L, 0)} / ${fmt(D, 2)}`,
                    hasil: fmt(r.sinuosity, 4),
                    tint: r.cutoff ? C.caution : C.water,
                  },
                  {
                    judul: x.hRc,
                    rumus: (<><span>Rc ≈</span><Frac num="λ" den="2π · ω" /></>),
                    // Model memakai koreksi kecil (sekitar 0,01 %), jadi ditulis ≈.
                    isi: `≈ ${fmt(L, 0)} / ( 2π · ${fmt(omegaRad, 4)} )`,
                    hasil: fmt(r.minRadius, 2),
                    satuan: Number.isFinite(r.minRadius) ? "m" : undefined,
                  },
                  {
                    judul: x.rNisbah,
                    rumus: <span>Rc / W</span>,
                    isi: `${fmt(r.minRadius, 3)} / ${fmt(W_, 0)}`,
                    hasil: fmt(r.radiusRatio, 3),
                    tint: terlipat ? C.signal : C.critical,
                  },
                  {
                    judul: terlipat ? x.hMTak : x.hM,
                    rumus: (<><span>ṁ = {fmt(0.04, 2)} ·</span><Frac num="Rc/W" den={fmt(MEANDER_PEAK_RATIO, 1)} /><span>· e^( 1 − ( Rc/W ) / {fmt(MEANDER_PEAK_RATIO, 1)} )</span></>),
                    isi: terlipat
                      ? "—"
                      : `${fmt(0.04, 2)} · ( ${fmt(r.radiusRatio, 3)} / ${fmt(MEANDER_PEAK_RATIO, 1)} ) · e^( 1 − ${fmt(r.radiusRatio, 3)} / ${fmt(MEANDER_PEAK_RATIO, 1)} )`,
                    hasil: terlipat ? "—" : fmt(r.migrationRate, 4),
                    satuan: terlipat ? undefined : x.uM,
                  },
                  {
                    judul: x.rLeopold,
                    rumus: <span>λL = {fmt(10.9, 1)} · W^{fmt(1.01, 2)}</span>,
                    isi: `${fmt(10.9, 1)} · ${fmt(W_, 0)}^${fmt(1.01, 2)}`,
                    hasil: fmt(r.wavelengthLeopold, 1),
                    satuan: "m",
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={nada}
            badge={terlipat ? x.lipat : r.cutoff ? x.potong : r.fastestMigration ? x.cepat : x.lambat}
            {...notice(W_, L, sudut, x.lipatNote, x.potongNote, lang)}
          />
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
                    ? `laju pindah memuncak di Rc/W ≈ ${fmt(MEANDER_PEAK_RATIO, 1)}; leher terpotong pada sinusitas P ≥ ${fmt(MEANDER_CUTOFF, 1)}`
                    : `migration peaks at Rc/W ≈ ${fmt(MEANDER_PEAK_RATIO, 1)}; the neck cuts off at sinuosity P ≥ ${fmt(MEANDER_CUTOFF, 1)}`}
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

/*
 * Kalimat pembanding dibangun dari laju pindah yang BENAR-BENAR dihitung
 * untuk sudut separuh dan sudut 1,6 kali. Dulu kalimatnya selalu menulis
 * "separuhkan, laju turun" dan "tajamkan, lebih lambat", yang terbalik
 * untuk kelokan yang sudah melewati puncak (separuhkan, laju naik) dan
 * untuk kelokan yang masih landai (tajamkan, laju naik). Kelokan yang
 * tebingnya melipat tidak diberi angka laju pindah sama sekali.
 */
function notice(
  W_: number,
  L: number,
  sudut: number,
  lipatNote: string,
  potongNote: string,
  lang: Lang
): { state: string; notice: string[] } {
  const a = meanderPath(W_, L, sudut);
  const sLandai = Math.max(5, sudut / 2);
  const sTajam = Math.min(140, sudut * 1.6);
  const landai = meanderPath(W_, L, sLandai);
  const tajam = meanderPath(W_, L, sTajam);
  const lipat = (m: ReturnType<typeof meanderPath>) => m.radiusRatio < 0.5;
  const en = lang === "en";

  const leopold = en
    ? `The wavelength Leopold and Wolman measured for a river of this width is ${fmt(a.wavelengthLeopold, 0)} metres, against the ${fmt(a.wavelength, 0)} set here.`
    : `Panjang gelombang yang diukur Leopold dan Wolman untuk sungai selebar ini ${fmt(a.wavelengthLeopold, 0)} meter, terhadap ${fmt(a.wavelength, 0)} yang dipilih di sini.`;

  if (lipat(a))
    return {
      state: en
        ? `At a swing of ${fmt(sudut, 0)} degrees the smallest radius is only ${fmt(a.radiusRatio, 2)} river widths, so the inner bank would fold over itself.`
        : `Pada sudut ayun ${fmt(sudut, 0)} derajat, jari-jari terkecilnya hanya ${fmt(a.radiusRatio, 2)} kali lebar sungai, sehingga tebing dalamnya melipat.`,
      notice: [lipatNote, leopold],
    };

  const butir: string[] = [];

  // Landaikan: separuh sudut ayun, paling kecil 5 derajat.
  if (sLandai < sudut) {
    const naik = landai.migrationRate > a.migrationRate;
    butir.push(
      en
        ? naik
          ? `Reduce the swing to ${fmt(sLandai, 0)} degrees and the migration rises to ${fmt(landai.migrationRate, 3)}: this bend is past the peak, and a gentler bend brings the radius back toward ${fmt(MEANDER_PEAK_RATIO, 1)} widths.`
          : `Reduce the swing to ${fmt(sLandai, 0)} degrees and the migration falls to ${fmt(landai.migrationRate, 3)}: a bend that gentle does not gather its flow against the outer bank.`
        : naik
          ? `Landaikan sudut ayunnya menjadi ${fmt(sLandai, 0)} derajat dan laju pindahnya naik ke ${fmt(landai.migrationRate, 3)}: kelokan ini sudah melewati puncaknya, dan kelokan yang lebih landai membawa jari-jarinya kembali mendekati ${fmt(MEANDER_PEAK_RATIO, 1)} kali lebar.`
          : `Landaikan sudut ayunnya menjadi ${fmt(sLandai, 0)} derajat dan laju pindahnya turun ke ${fmt(landai.migrationRate, 3)}: kelokan selandai itu belum memusatkan alirannya ke tebing luar.`
    );
  }

  // Tajamkan sudut ayun.
  if (sTajam > sudut) {
    if (lipat(tajam))
      butir.push(
        en
          ? `Sharpen the swing to ${fmt(sTajam, 0)} degrees and the inner bank would fold: no river of this width can turn that tightly.`
          : `Tajamkan sudut ayunnya menjadi ${fmt(sTajam, 0)} derajat dan tebing dalamnya akan melipat: tidak ada sungai selebar ini yang sanggup membelok setajam itu.`
      );
    else {
      const naik = tajam.migrationRate > a.migrationRate;
      butir.push(
        en
          ? naik
            ? `Sharpen the swing to ${fmt(sTajam, 0)} degrees and the migration rises to ${fmt(tajam.migrationRate, 3)}, because the radius moves toward the peak at ${fmt(MEANDER_PEAK_RATIO, 1)} widths.`
            : `Sharpen the swing to ${fmt(sTajam, 0)} degrees and the migration falls to ${fmt(tajam.migrationRate, 3)}: past the peak the bend spends its energy on friction in the turn rather than on its bank.`
          : naik
            ? `Tajamkan sudut ayunnya menjadi ${fmt(sTajam, 0)} derajat dan laju pindahnya naik ke ${fmt(tajam.migrationRate, 3)}, karena jari-jarinya bergerak mendekati puncak di ${fmt(MEANDER_PEAK_RATIO, 1)} kali lebar.`
            : `Tajamkan sudut ayunnya menjadi ${fmt(sTajam, 0)} derajat dan laju pindahnya turun ke ${fmt(tajam.migrationRate, 3)}: melewati puncaknya, kelokan menghabiskan tenaganya pada gesekan di tikungan, bukan pada tebingnya.`
      );
    }
  }

  if (a.cutoff) butir.push(potongNote);
  butir.push(leopold);

  return {
    state: en
      ? `At a swing of ${fmt(sudut, 0)} degrees the sinuosity is ${fmt(a.sinuosity, 2)} and the bend migrates at ${fmt(a.migrationRate, 3)} widths a year.`
      : `Pada sudut ayun ${fmt(sudut, 0)} derajat, sinusitasnya ${fmt(a.sinuosity, 2)} dan kelokannya berpindah ${fmt(a.migrationRate, 3)} lebar tiap tahun.`,
    notice: butir,
  };
}
