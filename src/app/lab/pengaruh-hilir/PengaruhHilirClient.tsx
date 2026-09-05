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
import {
  drawReach,
  type ReachMarker,
  type ReachPoint,
  type ReachRegion,
  type ReachSeries,
} from "@/lib/drawReach";
import {
  backwaterExtent,
  criticalDepth,
  fmt,
  gvfProfile,
  normalDepth,
  normalDepthReachable,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksBackwater } from "@/lib/checks";

const TXT = {
  id: {
    title: "Pengaruh hilir",
    sheetTitle: "Jangkauan pembendungan ke hulu — saluran persegi prismatis",
    dQ: "Debit",
    db: "Lebar dasar",
    dn: "Kekasaran Manning",
    dS: "Kemiringan dasar",
    dP: "Tinggi bangunan di atas dasar",
    dF: "Ambang pengaruh yang dianggap habis",
    pBendung: "Bendung sedang",
    pDatar: "Saluran hampir datar",
    pKecil: "Bangunan rendah",
    rY0: "Kedalaman normal",
    rYc: "Kedalaman kritis",
    rYctl: "Kedalaman di bangunan",
    rRise: "Kenaikan di bangunan terhadap normal",
    rDist: "Jangkauan pengaruh ke hulu",
    rDist10: "Jangkauan pada ambang sepuluh persen",
    rArea: "Tambahan luas genangan per meter lebar",
    tak: "Melampaui kapasitas saluran",
    takNote:
      "Pada lebar dan kemiringan ini, saluran tidak sanggup mengalirkan debit sebesar itu berapa pun dalamnya. Kedalaman normal yang tampil hanyalah batas atas pencarian.",
    jauh: "Melewati batas pencarian",
    jauhNote:
      "Pengaruhnya belum habis bahkan setelah 500 km ke hulu. Ini bukan kesalahan hitungan melainkan sifat saluran yang sangat landai: makin datar dasarnya, makin jauh sebuah bangunan terasa. Curamkan sedikit dasarnya, atau turunkan bangunannya, untuk melihat angka yang berarti.",
    exagg: "pelebihan tegak",
    note:
      "Kurva pembendungan mendekati kedalaman normal secara asimtotik, sehingga pertanyaan sampai di mana pengaruh sebuah bangunan berhenti sebenarnya tidak punya jawaban tegas. Ia tidak pernah benar-benar berhenti. Yang dapat dijawab, dan yang dipakai dalam praktik untuk menentukan batas kajian genangan, adalah sampai di mana pengaruhnya tinggal sekian bagian dari kenaikan di bangunan. Nilai yang lazim dipakai satu persen, dan angka itu dapat digeser pada tabel masukan supaya terlihat betapa besar pengaruhnya terhadap panjang yang harus dikaji. Yang paling menentukan justru bukan tinggi bangunannya melainkan kemiringan dasar saluran: mengurangi kemiringan menjadi separuh membuat jangkauannya membengkak jauh lebih dari dua kali lipat. Itulah sebabnya bendung setinggi satu meter di sungai dataran rendah dapat menggenangi lahan berkilometer ke hulu, sementara bendung yang sama di kaki bukit hampir tidak terasa.",
  },
  en: {
    title: "Downstream effects",
    sheetTitle: "Upstream extent of backwater — prismatic rectangular channel",
    dQ: "Discharge",
    db: "Bed width",
    dn: "Manning roughness",
    dS: "Bed slope",
    dP: "Structure height above the bed",
    dF: "Threshold at which the influence counts as spent",
    pBendung: "Medium weir",
    pDatar: "Nearly flat channel",
    pKecil: "Low structure",
    rY0: "Normal depth",
    rYc: "Critical depth",
    rYctl: "Depth at the structure",
    rRise: "Rise at the structure above normal",
    rDist: "Upstream extent of the influence",
    rDist10: "Extent at the ten per cent threshold",
    rArea: "Extra flooded area per metre of width",
    tak: "Exceeds channel capacity",
    takNote:
      "At this width and slope the channel cannot carry that discharge at any depth. The normal depth shown is only the upper bound of the search.",
    jauh: "Beyond the search limit",
    jauhNote:
      "The influence has still not died out 500 km upstream. That is not a calculation error but the nature of a very flat channel: the flatter the bed, the further a structure is felt. Steepen the bed slightly, or lower the structure, to see a meaningful number.",
    exagg: "vertical exaggeration",
    note:
      "A backwater curve approaches normal depth asymptotically, so the question of where a structure stops being felt has no sharp answer. It never truly stops. What can be answered, and what is used in practice to set the boundary of a flood study, is where the influence has fallen to some fraction of the rise at the structure. One per cent is the usual value, and that figure can be moved in the input table to show how strongly it drives the length that has to be studied. What matters most is not the height of the structure but the bed slope: halving the slope swells the extent by far more than a factor of two. That is why a one-metre weir on a lowland river can flood land for kilometres upstream while the same weir at the foot of a hill is barely noticed.",
  },
} as const;

const REFS = {
  id: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Bab 10, perhitungan kurva pembendungan.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Bab 5 dan Bab 6.",
    "USACE (2016). HEC-RAS Hydraulic Reference Manual, penentuan batas hulu kajian.",
    "FEMA (2003). Guidelines and Specifications for Flood Hazard Mapping Partners, penentuan batas hulu daerah genangan.",
  ],
  en: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Chapter 10, backwater computation.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Chapters 5 and 6.",
    "USACE (2016). HEC-RAS Hydraulic Reference Manual, setting the upstream study limit.",
    "FEMA (2003). Guidelines and Specifications for Flood Hazard Mapping Partners, setting the upstream limit of the flood boundary.",
  ],
} as const;

export function PengaruhHilirClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [Q, setQ] = useState(12);
  const [b, setB] = useState(5);
  const [n, setN] = useState(0.025);
  const [S0, setS0] = useState(0.0012);
  const [P, setP] = useState(1.4);
  const [pers, setPers] = useState(1);

  const yc = criticalDepth(Q / b);
  const y0 = normalDepth(Q, b, n, S0);
  const terjangkau = normalDepthReachable(Q, b, n, S0);

  // Kedalaman di bangunan: tinggi bangunan ditambah tinggi luapan di atasnya.
  // Tinggi luapan didekati dengan kedalaman kritis, yang berlaku bila mercunya
  // cukup lebar sehingga aliran melewati kondisi kritis di atas mercu.
  const yCtl = Math.max(P + yc, y0 * 1.001);
  const r = backwaterExtent(Q, b, n, S0, yCtl, pers / 100);
  const r10 = backwaterExtent(Q, b, n, S0, yCtl, 0.1);

  // Bentang yang digambar dibuat sedikit lebih panjang daripada jangkauannya,
  // supaya ujung kurva yang sudah menyatu dengan kedalaman normal ikut terlihat.
  const L = Math.min(200000, Math.max(200, r.beyondSearch ? 20000 : r.distance * 1.25));
  const profil = gvfProfile(Q, b, n, S0, yCtl, L, 800);

  const ref = useCanvas(
    (ctx, w, h) =>
      drawReach(ctx, w, h, susun(profil.points, y0, yc, L, S0, P, r.distance, r.beyondSearch, lang)),
    [Q, b, n, S0, P, pers, lang]
  );

  const zSpan = Math.max(S0 * L + yCtl, 1e-3);
  const exagg = L / zSpan / 1.9;
  // Tambahan luas genangan per satuan lebar: selisih kedalaman terhadap normal,
  // dijumlahkan sepanjang bentang.
  const luas = [...profil.points]
    .sort((a, c) => a.x - c.x)
    .reduce((acc, p, i, arr) => {
      if (i === 0) return 0;
      const dx = p.x - arr[i - 1].x;
      return acc + ((p.y - y0 + (arr[i - 1].y - y0)) / 2) * dx;
    }, 0);

  return (
    <LabShell
      sheet="HS-09"
      subject={SUBJECTS.HS[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Sebuah bangunan menahan air, dan{" "}
            <Term tint={C.water}>kenaikan muka air</Term> itu tidak berhenti di
            tempat bangunannya berdiri. Ia menjalar ke hulu, makin lemah, tanpa
            pernah benar-benar habis. Pertanyaannya bukan sampai di mana ia
            berhenti, melainkan sampai di mana ia sudah cukup kecil untuk
            diabaikan.
          </p>
        ) : (
          <p>
            A structure holds water back, and that{" "}
            <Term tint={C.water}>rise in level</Term> does not stop where the
            structure stands. It travels upstream, weakening, without ever quite
            dying out. The question is not where it stops but where it has
            become small enough to ignore.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HS-09"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "Q", value: `${fmt(Q, 1)} m³/s`, tint: C.water },
            { label: "y₀", value: `${fmt(y0, 3)} m`, tint: C.water },
            {
              label: `L${pers.toFixed(0)}%`,
              value: r.beyondSearch ? "> 500 km" : `${fmt(r.distance / 1000, 2)} km`,
              tint: C.signal,
            },
            { label: t.tbScale, value: `${x.exagg} ${fmt(exagg, 0)}×` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q} min={0.5} max={80} step={0.5} digits={1} unit="m³/s" onChange={setQ} tint={C.water} />
              <InputRow symbol="b" label={x.db} value={b} min={0.5} max={25} step={0.1} digits={1} unit="m" onChange={setB} />
              <InputRow symbol="n" label={x.dn} value={n} min={0.01} max={0.07} step={0.001} digits={3} onChange={setN} />
              <InputRow symbol="S₀" label={x.dS} value={S0 * 1000} min={0.05} max={10} step={0.05} digits={2} unit="‰" onChange={(v) => setS0(v / 1000)} />
              <InputRow symbol="P" label={x.dP} value={P} min={0.1} max={5} step={0.05} unit="m" onChange={setP} tint={C.signal} />
              <InputRow symbol="ε" label={x.dF} value={pers} min={0.5} max={10} step={0.5} digits={1} unit="%" onChange={setPers} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pBendung, apply: () => { setQ(12); setB(5); setN(0.025); setS0(0.0012); setP(1.4); setPers(1); } },
                  { label: x.pDatar, apply: () => { setQ(12); setB(5); setN(0.025); setS0(0.0002); setP(1.4); setPers(1); } },
                  { label: x.pKecil, apply: () => { setQ(12); setB(5); setN(0.025); setS0(0.0012); setP(0.35); setPers(1); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={C.critical}>{profil.profile}</Flag>
              {!terjangkau && <Flag alert>{x.tak}</Flag>}
              {r.beyondSearch && <Flag alert>{x.jauh}</Flag>}
            </div>
            {!terjangkau && (
              <div className="mb-2.5">
                <Note>{x.takNote}</Note>
              </div>
            )}
            {r.beyondSearch && (
              <div className="mb-2.5">
                <Note>{x.jauhNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                {
                  symbol: "L",
                  label: x.rDist,
                  value: r.beyondSearch ? "> 500.000" : fmt(r.distance, 0),
                  unit: "m",
                  tint: C.signal,
                  strong: true,
                },
                {
                  symbol: "L₁₀",
                  label: x.rDist10,
                  value: r10.beyondSearch ? "> 500.000" : fmt(r10.distance, 0),
                  unit: "m",
                },
                { symbol: "y₀", label: x.rY0, value: fmt(y0, 3), unit: "m", tint: C.water },
                { symbol: "yc", label: x.rYc, value: fmt(yc, 3), unit: "m", tint: C.critical },
                { symbol: "y*", label: x.rYctl, value: fmt(yCtl, 3), unit: "m", tint: C.water },
                { symbol: "Δy", label: x.rRise, value: fmt(r.rise, 3), unit: "m" },
                { symbol: "A", label: x.rArea, value: fmt(luas, 0), unit: "m²/m" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(r.distance, r.beyondSearch, r10.distance, S0, pers, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksBackwater(Q, b, n, S0, yCtl)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <Frac num="dy" den="dx" />
                <span>=</span>
                <Frac num="S₀ − Sf" den="1 − Fr²" />
                <span className="ml-5">y → y₀</span>
                <span className="ml-2 text-ink-3">
                  {lang === "id" ? "secara asimtotik" : "asymptotically"}
                </span>
              </Eq>
              <Eq>
                <span>L = x ( y = y₀ + ε Δy )</span>
                <span className="ml-4 text-ink-3">
                  {lang === "id"
                    ? "batas ditentukan ambang, bukan oleh persamaannya"
                    : "the limit is set by a threshold, not by the equation"}
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

/* ------------------------------------------------------------------ *
 * Penyusunan gambar
 * ------------------------------------------------------------------ */

function susun(
  pts: { x: number; y: number; nearCritical: boolean }[],
  y0: number,
  yc: number,
  L: number,
  S0: number,
  P: number,
  jarak: number,
  lewatBatas: boolean,
  lang: Lang
) {
  const T = cl(lang);
  const zb = (x: number) => (L - x) * S0;

  const bed: ReachPoint[] = [
    { x: 0, z: zb(0) },
    { x: L, z: 0 },
  ];

  const urut = [...pts].sort((a, c) => a.x - c.x);
  const air: ReachPoint[] = urut.map((p) => ({
    x: p.x,
    z: zb(p.x) + p.y,
    invalid: p.nearCritical,
  }));

  const garis: ReachSeries[] = [
    {
      pts: [
        { x: 0, z: zb(0) + y0 },
        { x: L, z: y0 },
      ],
      color: C.water,
      weight: W.thin,
      dash: DASH.hidden,
      label: `y₀ ${y0.toFixed(2)} m`,
      labelAt: 0.02,
      labelDy: 11,
    },
    {
      pts: [
        { x: 0, z: zb(0) + yc },
        { x: L, z: yc },
      ],
      color: C.critical,
      weight: W.hair,
      dash: DASH.axis,
      label: `yc ${yc.toFixed(2)} m`,
      labelAt: 0.5,
      labelDy: 11,
    },
    // Bangunan di hilir digambar sebagai badan pejal, bukan sekadar garis.
    {
      pts: [
        { x: L, z: 0 },
        { x: L, z: P },
      ],
      color: C.ink,
      weight: W.bold,
    },
  ];

  const tanda: ReachMarker[] = [
    {
      x: L,
      label: T.structure,
      color: C.ink,
      zBottom: 0,
      dim: {
        zTop: P,
        zBottom: 0,
        text: `P ${P.toFixed(2)} m`,
        side: -1,
      },
    },
  ];

  if (!lewatBatas && jarak <= L) {
    const xr = L - jarak;
    tanda.push({
      x: xr,
      label: T.influenceEnd,
      color: C.signal,
      zBottom: zb(xr),
      dim: {
        zTop: zb(xr) + (urut.find((p) => p.x >= xr)?.y ?? y0),
        zBottom: zb(xr),
        text: `${jarak.toFixed(0)} m`,
        side: 1,
      },
    });
  }

  const wilayah: ReachRegion[] = [
    {
      x: L * 0.55,
      z: zb(L * 0.55) + Math.max(y0, yc) * 2.1,
      text: "M1",
      color: C.ink,
      big: true,
    },
  ];

  return {
    length: L,
    bed,
    water: air,
    series: garis,
    markers: tanda,
    regions: wilayah,
    axisX: T.axDistance,
    axisZ: T.elevation,
  };
}

function notice(
  jarak: number,
  lewatBatas: boolean,
  jarak10: number,
  S0: number,
  pers: number,
  lang: Lang
): string {
  if (lewatBatas) {
    return lang === "id"
      ? "Pengaruhnya belum juga habis setelah 500 km, dan itu jawaban yang jujur untuk saluran sedatar ini. Dalam praktik, batas kajian pada kasus seperti ini tidak ditentukan oleh hitungan hidraulika melainkan oleh tempat sungai bertemu bangunan lain, cabang, atau perubahan penampang yang mengambil alih kendali. Curamkan dasarnya sedikit untuk melihat angka yang berarti."
      : "The influence has still not died out after 500 km, and that is an honest answer for a channel this flat. In practice the study limit in such a case is not set by hydraulics but by where the river meets another structure, a tributary, or a change of section that takes over control. Steepen the bed slightly to see a meaningful number.";
  }

  const rasio = jarak10 > 0 ? jarak / jarak10 : 0;

  if (lang === "en")
    return `The influence reaches ${(jarak / 1000).toFixed(2)} km upstream at the ${pers.toFixed(1)} per cent threshold, but only ${(jarak10 / 1000).toFixed(2)} km at ten per cent. The ratio is ${rasio.toFixed(1)} to one, and it comes from the shape of the curve rather than from the structure: the last fraction of the rise takes the longest to disappear. Halve the bed slope, currently ${(S0 * 1000).toFixed(2)} per mille, and watch the extent grow by far more than double.`;
  return `Pengaruhnya mencapai ${(jarak / 1000).toFixed(2)} km ke hulu pada ambang ${pers.toFixed(1)} persen, tetapi hanya ${(jarak10 / 1000).toFixed(2)} km pada ambang sepuluh persen. Perbandingannya ${rasio.toFixed(1)} banding satu, dan itu datang dari bentuk kurvanya, bukan dari bangunannya: bagian terakhir dari kenaikan itulah yang paling lama hilang. Turunkan kemiringan dasar menjadi separuh, sekarang ${(S0 * 1000).toFixed(2)} per mil, lalu perhatikan jangkauannya bertambah jauh lebih dari dua kali lipat.`;
}
