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
import { drawStructure, type StructureBody, type StructureSpec } from "@/lib/drawStructure";
import {
  BRIDGE_BLOCKAGE_MAX,
  bridgePiers,
  fmt,
  fmtPlain,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksBridge } from "@/lib/checks";

const TXT = {
  id: {
    title: "Jembatan",
    sheetTitle: "Pembendungan oleh pilar jembatan — rumus Yarnell dan gerusan setempat",
    dQ: "Debit banjir rancangan",
    dB: "Lebar sungai",
    dY3: "Kedalaman di hilir jembatan",
    dN: "Banyaknya pilar",
    dWp: "Lebar satu pilar",
    dK: "Tetapan bentuk hidung pilar",
    pRamping: "Pilar ramping, sungai lebar",
    pTebal: "Pilar tebal, penyempitan berat",
    pDeras: "Banjir deras, mendekati kritis",
    rDh: "Kenaikan muka air di hulu",
    rAlpha: "Bagian lebar yang tertutup pilar",
    rFr: "Bilangan Froude di hilir",
    rV: "Kecepatan di antara pilar",
    rScour: "Gerusan setempat di hidung pilar",
    rDasar: "Kedalaman pondasi terkecil yang aman",
    sempit: "Penyempitan melampaui seperempat lebar",
    sempitNote:
      "Pilar menutup lebih dari seperempat lebar sungai. Rumus Yarnell diturunkan pada pita percobaan yang tidak menjangkau penyempitan sebesar itu, dan yang lebih penting: pada penyempitan seberat ini aliran dapat menjadi tersendat, yaitu terpaksa melewati kondisi kritis di antara pilar. Pembendungan pada keadaan tersendat jauh lebih besar daripada yang diramalkan rumus ini dan dihitung dengan cara yang sama sekali berbeda. Kurangi jumlah pilarnya, tipiskan, atau perlebar bentang jembatannya.",
    superkritis: "Aliran superkritis",
    tertutup: "Pilar menutup seluruh lebar sungai",
    tertutupNote:
      "Banyaknya pilar dikalikan lebar satu pilar sudah mencapai lebar sungainya sendiri, jadi tidak ada celah tersisa untuk air lewat. Luas antar pilarnya nol, kecepatan di antaranya tak hingga, dan yang tergambar bukan jembatan melainkan bendung pejal. Ini bukan penyempitan yang berat melainkan keadaan yang bukan aliran sama sekali, dan tidak ada rumus jembatan mana pun yang berlaku di sini. Kurangi banyaknya pilar, tipiskan pilarnya, atau lebarkan sungainya.",
    superkritisNote:
      "Bilangan Froude di hilir jembatan mencapai satu atau lebih. Rumus Yarnell diturunkan untuk aliran subkritis, tempat gangguan dapat menjalar ke hulu dan menaikkan muka air di sana. Pada aliran superkritis gangguan tidak dapat menjalar ke hulu sama sekali, sehingga tidak ada pembendungan dalam arti yang dimaksud rumus ini; yang terjadi gelombang kejut miring dari tiap hidung pilar. Perdalam alirannya atau perkecil debitnya.",
    note:
      "Perhatikan pangkat empat pada suku penyempitan di rumus Yarnell. Bagian lebar yang tertutup pilar muncul dua kali, sekali sebagai alpha dan sekali sebagai lima belas kali alpha pangkat empat, dan suku kedua itulah yang menjelaskan mengapa jembatan berpilar banyak jauh lebih mahal secara hidraulik daripada yang tampak. Menggandakan jumlah pilar tidak menggandakan pembendungannya melainkan lebih dari itu, dan pada penyempitan yang sudah besar jauh lebih dari itu. Hal kedua yang perlu dilihat bersama: gerusan setempat di hidung pilar sama sekali tidak bergantung pada pembendungannya. Ia bergantung pada lebar pilar dan kecepatan setempat, dan karena itu pilar yang ditipiskan mengurangi keduanya sekaligus sedangkan pilar yang dikurangi jumlahnya hanya mengurangi pembendungannya. Kedalaman gerusan yang dihitung di sini memakai bentuk HEC-18 yang sengaja konservatif dan lazim dianggap batas atas, bukan taksiran terbaik.",
  },
  en: {
    title: "Bridge",
    sheetTitle: "Backwater from bridge piers — the Yarnell formula and local scour",
    dQ: "Design flood discharge",
    dB: "River width",
    dY3: "Depth downstream of the bridge",
    dN: "Number of piers",
    dWp: "Width of one pier",
    dK: "Pier nose shape constant",
    pRamping: "Slender piers, wide river",
    pTebal: "Thick piers, heavy contraction",
    pDeras: "Fast flood, near critical",
    rDh: "Rise in water level upstream",
    rAlpha: "Fraction of width blocked by piers",
    rFr: "Froude number downstream",
    rV: "Velocity between piers",
    rScour: "Local scour at the pier nose",
    rDasar: "Minimum safe foundation depth",
    sempit: "Contraction exceeds a quarter of the width",
    sempitNote:
      "The piers block more than a quarter of the river width. The Yarnell formula was derived on an experimental band that does not reach contractions that heavy, and more importantly: at this degree of contraction the flow can choke, that is, be forced through critical conditions between the piers. Backwater in the choked state is far larger than this formula predicts and is computed in an entirely different way. Reduce the number of piers, make them thinner, or widen the bridge span.",
    superkritis: "Supercritical flow",
    tertutup: "The piers close the whole river width",
    tertutupNote:
      "The number of piers times the width of one has reached the width of the river itself, so no gap is left for water to pass. The area between the piers is zero, the velocity between them is infinite, and what is drawn is not a bridge but a solid weir. This is not heavy contraction but a state that is not a flow at all, and no bridge formula whatever applies here. Reduce the number of piers, make them thinner, or widen the river.",
    superkritisNote:
      "The Froude number downstream of the bridge has reached one or more. The Yarnell formula was derived for subcritical flow, where a disturbance can travel upstream and raise the level there. In supercritical flow a disturbance cannot travel upstream at all, so there is no backwater in the sense this formula means; what happens instead is an oblique shock wave from each pier nose. Deepen the flow or reduce the discharge.",
    note:
      "Note the fourth power on the contraction term in the Yarnell formula. The blocked fraction appears twice, once as alpha and once as fifteen times alpha to the fourth, and it is that second term which explains why a bridge with many piers is far more expensive hydraulically than it looks. Doubling the number of piers does not double the backwater but more than doubles it, and at contractions that are already large, far more than that. A second thing to see alongside it: local scour at the pier nose does not depend on the backwater at all. It depends on the pier width and the local velocity, so thinning the piers reduces both at once while reducing their number reduces only the backwater. The scour depth computed here uses the HEC-18 form, which is deliberately conservative and usually treated as an upper bound rather than a best estimate.",
  },
} as const;

const REFS = {
  id: [
    "Yarnell, D.L. (1934). Bridge piers as channel obstructions. USDA Technical Bulletin 442.",
    "Richardson, E.V. & Davis, S.R. (2001). Evaluating Scour at Bridges, HEC-18, edisi ke-4. FHWA.",
    "Hamill, L. (1999). Bridge Hydraulics. E & FN Spon.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill, Bab 17.",
  ],
  en: [
    "Yarnell, D.L. (1934). Bridge piers as channel obstructions. USDA Technical Bulletin 442.",
    "Richardson, E.V. & Davis, S.R. (2001). Evaluating Scour at Bridges, HEC-18, 4th ed. FHWA.",
    "Hamill, L. (1999). Bridge Hydraulics. E & FN Spon.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill, Chapter 17.",
  ],
} as const;

export function JembatanClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Q, setQ] = useState(200);
  const [B, setB] = useState(50);
  const [y3, setY3] = useState(3);
  const [piers, setPiers] = useState(2);
  const [wp, setWp] = useState(1.5);
  const [K, setK] = useState(0.9);

  const r = bridgePiers(Q, B, y3, piers, wp, K);
  /*
   * Dua sebab berbeda yang sama-sama membuat rumus Yarnell tidak berlaku,
   * dan keduanya perlu disebut dengan namanya masing-masing.
   *
   * Model menggabungkan keduanya ke dalam satu bendera di luar rentang,
   * yang memang benar untuk memutuskan apakah kenaikan muka airnya boleh
   * ditulis. Tetapi lembarnya sempat memakai bendera gabungan itu untuk
   * memilih KALIMATNYA juga, sehingga jembatan berpilar dua belas selebar
   * enam meter pada bilangan Froude nol koma dua diberi tulisan "aliran
   * superkritis". Yang benar di situ bukan alirannya yang terlalu cepat
   * melainkan sungainya yang tertutup habis.
   */
  const superkritis = r.Fr >= 1;

  const ref = useCanvas(
    (ctx, w, ch) => {
      // Tampak atas: aliran dari kiri ke kanan, pilar sebagai persegi panjang.
      /*
       * Panjang pilar searah aliran hanya ada di gambarnya, bukan di
       * hitungannya, jadi ia harus DIBATASI DI KEDUA UJUNG.
       *
       * Batas bawahnya sudah ada sejak semula supaya pilar tetap terlihat
       * pada sungai yang lebar. Batas atasnya belum: pilar selebar satu
       * setengah meter digambar sepanjang enam meter, dan pada sungai
       * selebar lima meter keduanya menembus keluar bidang gambar sampai
       * hampir satu meter di tiap sisi. Sekarang panjangnya tidak pernah
       * melebihi separuh lebar sungainya, sehingga pilar yang memang
       * kelewat besar tergambar kelewat besar, bukan tergambar di luar
       * kertas.
       */
      const panjangPilar = Math.min(
        Math.max(wp * 4, B * 0.12),
        B * 0.55
      );
      const badan: StructureBody[] = [];
      for (let i = 0; i < piers; i++) {
        const yTengah = (B * (i + 1)) / (piers + 1);
        badan.push({
          pts: [
            { x: -panjangPilar / 2, z: yTengah - wp / 2 },
            { x: panjangPilar / 2, z: yTengah - wp / 2 },
            { x: panjangPilar / 2, z: yTengah + wp / 2 },
            { x: -panjangPilar / 2, z: yTengah + wp / 2 },
          ],
        });
      }

      const spec: StructureSpec = {
        xMin: -B * 0.42,
        xMax: B * 0.42,
        zMin: -B * 0.05,
        zMax: B * 1.05,
        bodies: badan,
        waters: [
          {
            surface: [
              { x: -B * 0.42, z: B },
              { x: B * 0.42, z: B },
            ],
            bed: [
              { x: B * 0.42, z: 0 },
              { x: -B * 0.42, z: 0 },
            ],
            invalid: r.outOfRange,
          },
        ],
        lines: [
          {
            pts: [
              { x: -panjangPilar / 2, z: -B * 0.05 },
              { x: -panjangPilar / 2, z: B * 1.05 },
            ],
            color: C.ink2,
            weight: W.hair,
            dash: DASH.axis,
          },
          {
            pts: [
              { x: panjangPilar / 2, z: -B * 0.05 },
              { x: panjangPilar / 2, z: B * 1.05 },
            ],
            color: C.ink2,
            weight: W.hair,
            dash: DASH.axis,
          },
        ],
        dims:
          piers > 0
            ? [
                {
                  axis: "h",
                  at: B / (piers + 1) - wp / 2,
                  from: -panjangPilar / 2,
                  to: panjangPilar / 2,
                  text: `${fmtPlain(panjangPilar, 1)} m`,
                  color: C.ink3,
                  offset: -18,
                },
              ]
            : [],
        callouts:
          piers > 0
            ? [
                {
                  /*
                   * Namanya menunjuk pilar TERATAS, sedangkan ukuran
                   * panjangnya tetap di pilar terbawah. Keduanya di pilar
                   * yang sama akan berebut ruang yang itu-itu juga, dan
                   * pada dua belas pilar jaraknya tinggal beberapa piksel.
                   *
                   * Menjulurnya MENDATAR ke kiri, dari muka hulu pilarnya ke
                   * air terbuka. Menjulur ke atas membawanya ke kepala
                   * gambar pada dua belas pilar, dan ke badan pilarnya
                   * sendiri pada pilar selebar enam meter.
                   */
                  x: -panjangPilar / 2,
                  z: (B * piers) / (piers + 1),
                  dx: -54,
                  dy: -12,
                  text: T.pierLabel,
                },
              ]
            : [],
        arrows: [
          { x: -B * 0.34, z: B * 0.2, length: 26 },
          { x: -B * 0.34, z: B * 0.5, length: 26 },
          { x: -B * 0.34, z: B * 0.8, length: 26 },
        ],
        heading: r.fullyBlocked
          ? x.tertutup
          : superkritis
            ? x.superkritis
          : r.heavyBlockage
            ? x.sempit
            : T.planView2,
        headingColor: r.outOfRange || r.heavyBlockage ? C.signal : C.ink3,
        axisX: T.axHoriz,
        axisZ: T.axAcrossRiver,
      };

      drawStructure(ctx, w, ch, spec, lang);
    },
    [Q, B, y3, piers, wp, K, lang]
  );

  return (
    <LabShell
      sheet="HS-05"
      subject={SUBJECTS.HS[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Pilar menaikkan muka air di hulunya, dan kenaikan itu tumbuh menurut{" "}
            <Term tint={C.critical}>pangkat empat</Term> dari bagian lebar yang
            ditutupnya. Menggandakan pilar jauh lebih mahal daripada dua kali.
          </p>
        ) : (
          <p>
            Piers raise the water level upstream, and that rise grows as the{" "}
            <Term tint={C.critical}>fourth power</Term> of the fraction of width
            they block. Doubling the piers costs far more than double.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HS-05"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "α", value: fmt(r.blockage, 3), tint: r.heavyBlockage ? C.signal : undefined },
            { label: "Fr", value: fmt(r.Fr, 3), tint: superkritis ? C.signal : undefined },
            { label: "Δh", value: r.outOfRange ? "—" : `${fmt(r.backwater, 3)} m`, tint: C.water },
            { label: "ys", value: r.fullyBlocked ? "—" : `${fmt(r.scourDepth, 2)} m`, tint: C.critical },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q} min={5} max={3000} step={5} digits={0} unit="m³/s" onChange={setQ} tint={C.water} />
              <InputRow symbol="B" label={x.dB} value={B} min={5} max={300} step={1} digits={0} unit="m" onChange={setB} />
              <InputRow symbol="y₃" label={x.dY3} value={y3} min={0.3} max={15} step={0.1} digits={1} unit="m" onChange={setY3} />
              <InputRow symbol="N" label={x.dN} value={piers} min={0} max={12} step={1} digits={0} onChange={setPiers} />
              <InputRow symbol="ap" label={x.dWp} value={wp} min={0.2} max={6} step={0.1} digits={1} unit="m" onChange={setWp} />
              <InputRow symbol="K" label={x.dK} value={K} min={0.9} max={1.25} step={0.05} digits={2} onChange={setK} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pRamping, apply: () => { setQ(200); setB(60); setY3(3); setPiers(2); setWp(0.8); setK(0.9); } },
                  { label: x.pTebal, apply: () => { setQ(200); setB(30); setY3(3); setPiers(4); setWp(2.5); setK(1.05); } },
                  { label: x.pDeras, apply: () => { setQ(600); setB(50); setY3(2); setPiers(2); setWp(1.5); setK(0.9); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={r.outOfRange ? undefined : C.water} alert={r.outOfRange}>
                {superkritis
                  ? x.superkritis
                  : r.fullyBlocked
                    ? x.tertutup
                    : `${fmt(r.backwater * 1000, 0)} mm`}
              </Flag>
              {r.heavyBlockage && <Flag alert>{x.sempit}</Flag>}
            </div>
            {superkritis && (
              <div className="mb-2.5">
                <Note>{x.superkritisNote}</Note>
              </div>
            )}
            {r.fullyBlocked && (
              <div className="mb-2.5">
                <Note>{x.tertutupNote}</Note>
              </div>
            )}
            {r.heavyBlockage && (
              <div className="mb-2.5">
                <Note>{x.sempitNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "Δh", label: x.rDh, value: r.outOfRange ? "—" : fmt(r.backwater, 4), unit: r.outOfRange ? undefined : "m", tint: C.water, strong: true },
                /* Sungai yang tertutup habis bukan aliran, jadi tidak ada gerusan
                   maupun pondasi yang dapat dihitung dari alirannya. */
                { symbol: "ys", label: x.rScour, value: r.fullyBlocked ? "—" : fmt(r.scourDepth, 3), unit: r.fullyBlocked ? undefined : "m", tint: C.critical, strong: true },
                { symbol: "α", label: x.rAlpha, value: fmt(r.blockage, 4), tint: r.heavyBlockage ? C.signal : undefined },
                { symbol: "Fr", label: x.rFr, value: fmt(r.Fr, 4), tint: superkritis ? C.signal : undefined },
                { symbol: "V", label: x.rV, value: r.fullyBlocked ? "—" : fmt(r.velocityBetween, 3), unit: r.fullyBlocked ? undefined : "m/s" },
                { symbol: "zf", label: x.rDasar, value: r.fullyBlocked ? "—" : fmt(y3 + r.scourDepth, 2), unit: r.fullyBlocked ? undefined : "m", tint: C.critical },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(Q, B, y3, piers, wp, K, r.backwater, r.scourDepth, r.outOfRange, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksBridge(Q, B, y3, piers, wp, K)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Δh = K (K + 5 Fr² − 0,6) (α + 15 α⁴) Fr² y₃</span>
              </Eq>
              <Eq>
                <span>α =</span>
                <Frac num="N ap" den="B" />
                <span className="ml-5">ys = 2,0 ap^0,65 y₃^0,35 Fr^0,43</span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `berlaku pada aliran subkritis, dan pita percobaannya berhenti di α sekitar ${fmtPlain(BRIDGE_BLOCKAGE_MAX, 2)}`
                    : `valid in subcritical flow, and the experimental band stops near an α of ${fmtPlain(BRIDGE_BLOCKAGE_MAX, 2)}`}
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
  Q: number,
  B: number,
  y3: number,
  piers: number,
  wp: number,
  K: number,
  backwater: number,
  scour: number,
  outOfRange: boolean,
  lang: Lang
): string {
  if (outOfRange) {
    return lang === "id"
      ? "Pada aliran superkritis tidak ada pembendungan untuk dihitung, karena gangguan tidak dapat menjalar ke hulu. Perdalam alirannya sampai bilangan Froude turun di bawah satu."
      : "In supercritical flow there is no backwater to compute, because a disturbance cannot travel upstream. Deepen the flow until the Froude number falls below one.";
  }

  const dua = bridgePiers(Q, B, y3, piers * 2, wp, K);
  const tipis = bridgePiers(Q, B, y3, piers, wp / 2, K);
  const rasio = backwater > 0 ? dua.backwater / backwater : 2;

  if (lang === "en")
    return `Doubling the number of piers multiplies the backwater by ${fmt(rasio, 2)}, not by two, and it leaves the scour depth untouched at ${fmt(scour, 2)} m because scour depends on the pier width rather than their number. Halving the pier width instead gives ${fmt(tipis.backwater * 1000, 0)} mm of backwater and ${fmt(tipis.scourDepth, 2)} m of scour: both fall together. That asymmetry is worth carrying into design meetings, where the argument is usually about the number of piers and rarely about their thickness.`;
  return `Melipatduakan jumlah pilar mengalikan pembendungannya ${fmt(rasio, 2)} kali, bukan dua kali, dan sama sekali tidak mengubah kedalaman gerusannya yang tetap ${fmt(scour, 2)} m karena gerusan bergantung pada lebar pilar dan bukan pada jumlahnya. Menipiskan pilarnya menjadi separuh justru memberi pembendungan ${fmt(tipis.backwater * 1000, 0)} mm dan gerusan ${fmt(tipis.scourDepth, 2)} m: keduanya turun bersama-sama. Ketidaksetangkupan itu layak dibawa ke rapat perancangan, tempat perdebatannya biasanya tentang jumlah pilar dan jarang tentang ketebalannya.`;
}
