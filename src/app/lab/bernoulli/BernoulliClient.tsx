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
  drawStructure,
  type StructureDim,
  type StructureLine,
} from "@/lib/drawStructure";
import { ATM_HEAD, ductEnergy, fmt, fmtPlain } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksDuct } from "@/lib/checks";

const L = 60;

const TXT = {
  id: {
    title: "Bernoulli",
    sheetTitle: "Pertukaran tiga tinggi tekan di sepanjang saluran tanpa gesekan",
    dQ: "Debit",
    dH: "Tinggi energi di hulu",
    dD1: "Garis tengah di hulu",
    dD2: "Garis tengah di leher",
    dZ: "Kenaikan sumbu pipa di leher",
    pDatar: "Pipa datar, leher menyempit",
    pNaik: "Pipa naik enam meter",
    pKavitasi: "Leher terlalu tinggi, air mendidih",
    rV: "Kecepatan di leher",
    rHv: "Tinggi kecepatan di leher",
    rHp: "Tinggi tekan di leher",
    rAbs: "Tekanan mutlak di leher",
    rHmin: "Tinggi tekan terendah",
    rEgl: "Tinggi energi di hilir",
    aman: "Tekanan di mana-mana masih di atas tekanan uap",
    kavitasi: "Air mendidih di leher",
    subAtm: "Tekanan di leher di bawah atmosfer",
    kavitasiNote:
      "Tekanan mutlak di leher sudah turun ke tekanan uap air, jadi airnya mendidih pada suhu ruang dan gelembung terbentuk di dalam alirannya. Yang merusak bukan gelembungnya melainkan pecahnya: begitu alirannya melambat kembali dan tekanannya pulih, gelembung itu runtuh ke dalam dirinya sendiri dalam waktu sepersejuta detik, dan tumbukan yang dihasilkannya cukup keras untuk mengelupas baja. Itu sebabnya kavitasi tidak pernah diterima sebagai keadaan kerja, betapa pun kecil gelembungnya.",
    note:
      "Yang paling berguna dilihat pada lembar ini bukan rumusnya melainkan pertukarannya. Tinggi energi seluruhnya tidak berubah sedikit pun di sepanjang saluran ini, dan yang berubah hanya pembagiannya ke tiga suku. Naikkan sumbu pipanya satu meter dan tinggi tekannya turun tepat satu meter, ditukar satu lawan satu, sementara garis energinya tidak bergerak. Sempitkan lehernya dan tinggi kecepatannya naik menurut pangkat empat kebalikan garis tengahnya, sedangkan tinggi tekannya turun sebanyak itu juga. Dua hal yang mengikutinya langsung. Pertama, pipa yang naik terlalu tinggi kehabisan tekanan, bukan kehabisan tenaga, dan batasnya sepuluh koma tiga meter di atas garis energinya karena itulah seluruh tinggi tekan atmosfer. Kedua, leher yang terlalu sempit dapat menurunkan tekanan sampai di bawah tekanan uap meskipun tenaganya berlimpah. Keduanya kegagalan tekanan pada aliran yang tenaganya sama sekali tidak kurang, dan keduanya tidak akan pernah terlihat oleh orang yang hanya memeriksa neraca tenaganya.",
  },
  en: {
    title: "Bernoulli",
    sheetTitle: "The exchange of three heads along a frictionless duct",
    dQ: "Discharge",
    dH: "Total head upstream",
    dD1: "Diameter upstream",
    dD2: "Diameter at the throat",
    dZ: "Rise of the pipe axis at the throat",
    pDatar: "Level pipe, narrowed throat",
    pNaik: "Pipe raised six metres",
    pKavitasi: "Throat too high, the water boils",
    rV: "Velocity at the throat",
    rHv: "Velocity head at the throat",
    rHp: "Pressure head at the throat",
    rAbs: "Absolute pressure at the throat",
    rHmin: "Lowest pressure head",
    rEgl: "Total head downstream",
    aman: "The pressure stays above vapour pressure everywhere",
    kavitasi: "The water boils at the throat",
    subAtm: "The throat pressure is below atmospheric",
    kavitasiNote:
      "The absolute pressure at the throat has fallen to the vapour pressure of water, so the water boils at room temperature and bubbles form inside the flow. What does the damage is not the bubbles but their collapse: as soon as the flow slows again and the pressure recovers, each bubble implodes in a millionth of a second, and the impact is hard enough to strip steel. That is why cavitation is never accepted as a working condition, however small the bubbles.",
    note:
      "What is worth watching on this sheet is not the formula but the exchange. The total head does not change at all along this duct, and all that changes is how it divides between the three terms. Raise the pipe axis by a metre and the pressure head falls by exactly a metre, one for one, while the energy line does not move. Narrow the throat and the velocity head rises with the fourth power of the inverse diameter, while the pressure head falls by just as much. Two things follow at once. First, a pipe raised too high runs out of pressure, not out of energy, and the limit is 10.3 metres above its energy line because that is the whole of atmospheric head. Second, a throat made too narrow can drop the pressure below vapour pressure even while energy is abundant. Both are pressure failures in a flow whose energy is in no way short, and neither will ever be seen by someone who only checks the energy balance.",
  },
} as const;

const REFS = {
  id: [
    "Bernoulli, D. (1738). Hydrodynamica, sive de viribus et motibus fluidorum commentarii.",
    "Euler, L. (1757). Principes généraux du mouvement des fluides.",
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, edisi ke-8, bab 3.",
    "Knapp, R.T., Daily, J.W. & Hammitt, F.G. (1970). Cavitation.",
  ],
  en: [
    "Bernoulli, D. (1738). Hydrodynamica, sive de viribus et motibus fluidorum commentarii.",
    "Euler, L. (1757). Principes généraux du mouvement des fluides.",
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, 8th ed., ch. 3.",
    "Knapp, R.T., Daily, J.W. & Hammitt, F.G. (1970). Cavitation.",
  ],
} as const;

export function BernoulliClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Q, setQ] = useState(0.15);
  const [H, setH] = useState(20);
  const [D1, setD1] = useState(0.4);
  const [D2, setD2] = useState(0.18);
  const [dz, setDz] = useState(0);

  /* Saluran yang mengerucut ke leher di tengah lalu melebar kembali. */
  const stations = [
    { x: 0, z: 0, D: D1 },
    { x: L * 0.3, z: dz * 0.6, D: (D1 + D2) / 2 },
    { x: L * 0.5, z: dz, D: D2 },
    { x: L * 0.7, z: dz * 0.6, D: (D1 + D2) / 2 },
    { x: L, z: 0, D: D1 },
  ];
  const r = ductEnergy(Q, stations, H, 0);
  const leher = r.points[2];

  const ref = useCanvas(
    (ctx, w, ch) => {
      /*
       * Batas bidang dihitung lebih dulu, karena tebal pipa yang digambar
       * bergantung padanya. Batas atasnya memuat elevasi LEHER juga, bukan
       * hanya garis energinya: pada leher yang dinaikkan dua puluh lima
       * meter, pipanya menembus bingkai atas bersama nama dan ukurannya.
       */
      const zMin = Math.min(0, r.minPressureHead + leher.z, dz, -2);
      const zAtasAsli = Math.max(H, r.points[0].egl, dz);
      const rentang = Math.max(zAtasAsli - zMin, 1);

      /*
       * Garis tengah pipa DILEBIHKAN pada gambarnya, dan besarnya
       * pelebihan ditulis di nama dindingnya.
       *
       * Pipa empat puluh sentimeter pada sumbu setinggi dua puluh dua meter
       * tinggal dua garis rambut di dasar bidang, dan lehernya, yaitu pokok
       * lembar ini, sama sekali tidak terlihat menyempit. Diagram garis
       * energi di buku ajar pun menggambar pipanya dilebihkan dengan alasan
       * yang sama. Yang dilebihkan hanya tebal pipanya; seluruh tinggi tekan
       * tetap digambar pada skala yang sebenarnya.
       */
      const lebih = Math.max(1, Math.round((rentang * 0.07) / Math.max(D1, D2)));
      const zMax = (zAtasAsli + (lebih * Math.max(D1, D2)) / 2) * 1.14 + 1;
      const atas = r.points.map((p) => ({ x: p.x, z: p.z + (lebih * p.D) / 2 }));
      const bawah = r.points.map((p) => ({ x: p.x, z: p.z - (lebih * p.D) / 2 }));

      const garis: StructureLine[] = [
        {
          pts: r.points.map((p) => ({ x: p.x, z: p.egl })),
          color: C.energy,
          weight: W.bold,
          dash: DASH.solid,
          label: T.energyGrade,
          labelAt: 0.18,
          labelDy: -10,
          labelAlign: "left",
        },
        {
          pts: r.points.map((p) => ({ x: p.x, z: p.hgl })),
          color: C.water,
          weight: W.bold,
          dash: DASH.hidden,
          label: T.hydraulicGrade,
          labelAt: 1,
          labelDy: 16,
          labelAlign: "right",
        },
        {
          pts: [
            { x: 0, z: 0 },
            { x: L, z: 0 },
          ],
          color: C.ink3,
          weight: W.hair,
          dash: DASH.axis,
          label: T.datumLine,
          labelAt: 0.06,
          labelDy: 12,
          labelAlign: "left",
        },
        { pts: atas, color: C.ink, weight: W.bold, dash: DASH.solid },
        { pts: bawah, color: C.ink, weight: W.bold, dash: DASH.solid },
      ];

      /* Ketiga tinggi tekan di leher, sebagai tiga ukuran yang bertumpuk */
      const dims: StructureDim[] = [
        {
          axis: "v",
          at: L * 0.5,
          from: leher.hgl,
          to: leher.egl,
          text: `${fmtPlain(leher.velocityHead, 2)} m`,
          color: C.energy,
          offset: 30,
        },
        {
          axis: "v",
          at: L * 0.5,
          from: leher.z,
          to: leher.hgl,
          text: `${fmtPlain(leher.pressureHead, 2)} m`,
          color: C.water,
          offset: 58,
        },
        /* Ukuran sepanjang nol tidak mengukur apa pun, dan pada pipa datar
           ia hanya menjadi tulisan "0,00 m" yang tergantung di dasar. */
        ...(Math.abs(leher.z) > 0.05
          ? [
              {
                axis: "v" as const,
                at: L * 0.5,
                from: 0,
                to: leher.z,
                text: `${fmtPlain(leher.z, 2)} m`,
                offset: 86,
              },
            ]
          : []),
      ];

      drawStructure(
        ctx,
        w,
        ch,
        {
          xMin: -3,
          xMax: L + 3,
          zMin,
          zMax,
          equalScale: false,
          bodies: [],
          lines: garis,
          dims,
          callouts: [
            {
              x: L * 0.5,
              z: leher.z - (lebih * D2) / 2,
              dx: -14,
              dy: 26,
              text:
                lebih > 1
                  ? `${T.ductWall} · ${lang === "id" ? "tebal" : "width"} ×${lebih}`
                  : T.ductWall,
            },
          ],
          heading: r.cavitates ? x.kavitasi : undefined,
          headingColor: C.signal,
          axisX: T.axAlongDuct,
          axisZ: T.axHeadM,
        },
        lang
      );
    },
    [Q, H, D1, D2, dz, lang]
  );

  return (
    <LabShell
      sheet="FF-01"
      subject={SUBJECTS.FF[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Tinggi energi seluruhnya <Term tint={C.energy}>tidak berubah</Term>{" "}
            di sepanjang saluran ini. Yang berubah hanya{" "}
            <Term tint={C.water}>pembagiannya</Term>: satu meter elevasi
            ditukar tepat satu meter tinggi tekan.
          </p>
        ) : (
          <p>
            The total head <Term tint={C.energy}>does not change</Term> along
            this duct. All that changes is{" "}
            <Term tint={C.water}>how it divides</Term>: a metre of elevation is
            traded for exactly a metre of pressure head.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FF-01"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "H", value: `${fmt(H, 2)} m`, tint: C.energy },
            { label: "V", value: `${fmt(leher.velocity, 2)} m/s` },
            { label: "p/γ", value: `${fmt(leher.pressureHead, 2)} m`, tint: r.cavitates ? C.signal : C.water },
            { label: "V²/2g", value: `${fmt(leher.velocityHead, 2)} m` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q * 1000} min={5} max={600} step={5} digits={0} unit="l/s" onChange={(v) => setQ(v / 1000)} tint={C.water} />
              <InputRow symbol="H" label={x.dH} value={H} min={2} max={40} step={0.5} digits={1} unit="m" onChange={setH} tint={C.energy} />
              <InputRow symbol="D₁" label={x.dD1} value={D1 * 1000} min={100} max={800} step={10} digits={0} unit="mm" onChange={(v) => setD1(v / 1000)} />
              <InputRow symbol="D₂" label={x.dD2} value={D2 * 1000} min={40} max={800} step={10} digits={0} unit="mm" onChange={(v) => setD2(v / 1000)} tint={C.critical} />
              <InputRow symbol="Δz" label={x.dZ} value={dz} min={-8} max={25} step={0.5} digits={1} unit="m" onChange={setDz} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pDatar, apply: () => { setQ(0.15); setH(20); setD1(0.4); setD2(0.18); setDz(0); } },
                  { label: x.pNaik, apply: () => { setQ(0.15); setH(20); setD1(0.4); setD2(0.18); setDz(6); } },
                  /* Leher dinaikkan DAN disempitkan. Menaikkannya saja sampai batas
                     penggeser, dua puluh lima meter, masih menyisakan tekanan mutlak
                     tiga setengah meter, jauh di atas tekanan uap, sehingga tombol
                     bernama "air mendidih" menyalakan penanda "masih di atas tekanan
                     uap". */
                  { label: x.pKavitasi, apply: () => { setQ(0.15); setH(20); setD1(0.4); setD2(0.13); setDz(25); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={r.cavitates ? undefined : C.water} alert={r.cavitates}>
                {r.cavitates ? x.kavitasi : x.aman}
              </Flag>
              {!r.cavitates && r.subAtmospheric && (
                <Flag tint={C.critical}>{x.subAtm}</Flag>
              )}
            </div>
            {r.cavitates && (
              <div className="mb-2.5">
                <Note>{x.kavitasiNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "V", label: x.rV, value: fmt(leher.velocity, 3), unit: "m/s", strong: true },
                { symbol: "V²/2g", label: x.rHv, value: fmt(leher.velocityHead, 3), unit: "m", tint: C.energy, strong: true },
                { symbol: "p/γ", label: x.rHp, value: fmt(leher.pressureHead, 3), unit: "m", tint: r.cavitates ? C.signal : C.water, strong: true },
                /* Tekanan mutlak tidak dapat turun di bawah tekanan uap: di situ airnya
                   mendidih dan tekanannya tertahan. Angka negatif yang dihasilkan
                   persamaannya bukan tekanan melainkan tanda bahwa persamaannya
                   sudah tidak berlaku. */
                { symbol: "pabs", label: x.rAbs, value: r.cavitates ? "—" : fmt(leher.absoluteHead, 3), unit: r.cavitates ? undefined : "m", tint: r.cavitates ? C.signal : undefined },
                { symbol: "min", label: x.rHmin, value: fmt(r.minPressureHead, 3), unit: "m" },
                { symbol: "H", label: x.rEgl, value: fmt(r.points[r.points.length - 1].egl, 4), unit: "m", tint: C.energy },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(Q, H, D1, D2, dz, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksDuct(Q, stations, H, 0)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>z +</span>
                <Frac num="p" den="γ" />
                <span>+</span>
                <Frac num="V²" den="2g" />
                <span>= H</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id" ? "tetap di sepanjang salurannya" : "constant along the duct"}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `tinggi tekan atmosfer ${fmtPlain(ATM_HEAD, 2)} m kolom air; di bawahnya tidak ada tekanan yang tersisa untuk ditahan air`
                    : `atmospheric head ${fmtPlain(ATM_HEAD, 2)} m of water; below it no pressure is left for the water to hold`}
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
  H: number,
  D1: number,
  D2: number,
  dz: number,
  lang: Lang
): string {
  const st = (d2: number, z: number) => [
    { x: 0, z: 0, D: D1 },
    { x: L * 0.5, z, D: d2 },
    { x: L, z: 0, D: D1 },
  ];
  const asli = ductEnergy(Q, st(D2, dz), H, 0).points[1];
  const naik = ductEnergy(Q, st(D2, dz + 1), H, 0).points[1];
  const sempit = ductEnergy(Q, st(D2 / 2, dz), H, 0).points[1];

  if (lang === "en")
    return `At the throat the pressure head is ${fmt(asli.pressureHead, 2)} metres. Raise the pipe axis one metre and it becomes ${fmt(naik.pressureHead, 2)}: exactly one metre less, traded one for one, while the energy line has not moved at all. Now halve the throat diameter instead. The velocity head goes from ${fmt(asli.velocityHead, 2)} to ${fmt(sempit.velocityHead, 2)} metres, sixteen times over, because velocity head follows the fourth power of the inverse diameter. The pressure head pays for every metre of it.`;
  return `Di leher, tinggi tekannya ${fmt(asli.pressureHead, 2)} meter. Naikkan sumbu pipanya satu meter dan ia menjadi ${fmt(naik.pressureHead, 2)}: tepat satu meter lebih rendah, ditukar satu lawan satu, sementara garis energinya tidak bergerak sama sekali. Sekarang separuhkan garis tengah lehernya. Tinggi kecepatannya berpindah dari ${fmt(asli.velocityHead, 2)} ke ${fmt(sempit.velocityHead, 2)} meter, enam belas kali lipat, karena tinggi kecepatan mengikuti pangkat empat kebalikan garis tengahnya. Tinggi tekannya yang membayar setiap meternya.`;
}
