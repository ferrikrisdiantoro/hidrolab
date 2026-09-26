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
import {
  ATM_HEAD,
  ductEnergy,
  fmt,
  fmtPlain,
  type DuctStation,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksDuct } from "@/lib/checks";

const TXT = {
  id: {
    title: "Persamaan energi aliran bertekanan",
    sheetTitle: "Garis tekanan dan garis energi di sepanjang pipa tekan berpompa",
    dQ: "Debit yang dipompa",
    dD: "Garis tengah pipa",
    dL: "Panjang pipa",
    dPuncak: "Elevasi puncak lintasan",
    dAkhir: "Elevasi muka air kolam tujuan",
    dF: "Faktor gesekan Darcy",
    pBiasa: "Pemompaan biasa",
    pPuncak: "Puncak tinggi, pipa menghisap",
    pKavitasi: "Puncak terlalu tinggi, air mendidih",
    rHp: "Tinggi tekan pompa yang dibutuhkan",
    rV: "Kecepatan aliran",
    rHf: "Kehilangan gesekan",
    rHk: "Kehilangan setempat",
    rPuncak: "Tinggi tekan di puncak",
    rDaya: "Daya hidraulik",
    aman: "Tekanan positif di sepanjang pipa",
    hisap: "Pipa menghisap di puncaknya",
    kavitasi: "Air mendidih di puncak",
    labelPompa: "pompa",
    labelPuncak: "puncak lintasan",
    labelTengah: "titik tengah lintasan",
    hisapNote:
      "Garis tekanan sudah jatuh di bawah sumbu pipa di puncaknya, jadi di situ pipa tidak lagi didorong dari dalam melainkan dihisap. Pipa yang dihisap masih boleh bekerja asal sambungannya rapat dan dindingnya kuat menahan tekanan dari luar, tetapi dua hal menjadi tidak berlaku lagi. Udara yang terlarut akan keluar di titik terendah tekanannya dan berkumpul di puncak sampai menyumbat penampangnya, dan setiap sambungan yang bocor akan menghisap udara masuk, bukan mengeluarkan air.",
    kavitasiNote:
      "Tekanan mutlak di puncak sudah mencapai tekanan uap air, jadi airnya mendidih di situ dan kolom airnya putus. Pompa yang lehernya putus tidak memompa apa-apa: debit yang tertulis pada lembar ini hanya berlaku selama kolomnya utuh. Turunkan puncaknya, besarkan pipanya, atau pindahkan pompanya lebih dekat ke puncak.",
    note:
      "Dua garis pada gambar ini sering dianggap satu, padahal aturannya berbeda sama sekali dan justru perbedaannya yang dipakai merancang. Garis energi hanya boleh turun, kecuali di pompa, karena tidak ada susunan pipa yang menciptakan tenaga. Garis tekanan boleh naik dan boleh turun, karena ia garis energi dikurangi tinggi kecepatan, dan tinggi kecepatan berubah di setiap perubahan penampang. Yang menentukan hidup matinya rancangan bukan keduanya melainkan jarak garis tekanan terhadap sumbu pipanya. Selama garis tekanan berada di atas sumbu pipa, pipanya didorong dari dalam dan semuanya berjalan seperti yang dibayangkan. Begitu ia jatuh di bawah sumbu pipa, pipanya dihisap: udara terlarut keluar dari air dan berkumpul di puncak, sambungan yang bocor menghisap udara masuk, dan bila jatuhnya sampai sepuluh koma tiga meter di bawah sumbu, airnya mendidih dan kolomnya putus. Itu sebabnya pipa tekan yang panjang tidak dirancang dari debitnya saja. Puncak lintasannya diperiksa satu per satu, dan pompanya diletakkan dekat puncak yang paling menyulitkan, bukan di tempat yang paling mudah dijangkau kendaraan.",
  },
  en: {
    title: "Pressurized energy equation",
    sheetTitle: "Hydraulic and energy grade lines along a pumped rising main",
    dQ: "Pumped discharge",
    dD: "Pipe diameter",
    dL: "Pipe length",
    dPuncak: "Elevation of the summit",
    dAkhir: "Water level of the receiving pool",
    dF: "Darcy friction factor",
    pBiasa: "Ordinary pumping",
    pPuncak: "High summit, the pipe sucks",
    pKavitasi: "Summit too high, the water boils",
    rHp: "Pump head required",
    rV: "Flow velocity",
    rHf: "Friction loss",
    rHk: "Minor losses",
    rPuncak: "Pressure head at the summit",
    rDaya: "Hydraulic power",
    aman: "Positive pressure all along the pipe",
    hisap: "The pipe sucks at its summit",
    kavitasi: "The water boils at the summit",
    labelPompa: "pump",
    labelPuncak: "summit",
    labelTengah: "midpoint of the route",
    hisapNote:
      "The hydraulic grade line has fallen below the pipe axis at the summit, so there the pipe is no longer pushed from inside but sucked. A pipe under suction may still work, provided its joints are tight and its wall can carry the outside pressure, but two things stop being true. Dissolved air comes out of solution at the point of lowest pressure and gathers at the summit until it blocks the section, and any leaking joint sucks air in rather than letting water out.",
    kavitasiNote:
      "The absolute pressure at the summit has reached the vapour pressure of water, so the water boils there and the column parts. A pump whose column has parted delivers nothing: the discharge written on this sheet only holds while the column is whole. Lower the summit, enlarge the pipe, or move the pump closer to the summit.",
    note:
      "The two lines on this drawing are often taken for one, although their rules differ completely and it is exactly the difference that designs get made from. The energy line may only fall, except at a pump, because no arrangement of pipe creates energy. The hydraulic grade line may rise or fall, since it is the energy line less the velocity head, and the velocity head changes at every change of section. What decides whether a design lives or dies is neither line by itself but the distance of the hydraulic grade line from the pipe axis. While it lies above the axis, the pipe is pushed from inside and everything runs as imagined. As soon as it drops below the axis, the pipe is sucked: dissolved air comes out of the water and gathers at the summit, leaking joints suck air in, and if the drop reaches 10.3 metres below the axis, the water boils and the column parts. That is why a long rising main is not designed from its discharge alone. Its summits are checked one by one, and the pump is placed near the most difficult summit, not at the spot the trucks reach most easily.",
  },
} as const;

const REFS = {
  id: [
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, edisi ke-8, bab 5 dan 12.",
    "Idelchik, I.E. (1996). Handbook of Hydraulic Resistance, edisi ke-3.",
    "Karassik, I.J. dkk. (2008). Pump Handbook, edisi ke-4, bab 2.",
    "Thorley, A.R.D. (2004). Fluid Transients in Pipeline Systems, edisi ke-2.",
  ],
  en: [
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, 8th ed., ch. 5 and 12.",
    "Idelchik, I.E. (1996). Handbook of Hydraulic Resistance, 3rd ed.",
    "Karassik, I.J. et al. (2008). Pump Handbook, 4th ed., ch. 2.",
    "Thorley, A.R.D. (2004). Fluid Transients in Pipeline Systems, 2nd ed.",
  ],
} as const;

const K_MASUK = 0.5;
const K_PUNCAK = 0.2;
const RHO_G = 9810;

/** Lintasan pipanya: naik dari sumur hisap ke puncak, lalu turun ke kolam tujuan. */
function lintasan(
  L: number,
  D: number,
  zPuncak: number,
  zAkhir: number,
  pompa: number
): DuctStation[] {
  return [
    { x: 0, z: 0, D, K: K_MASUK, pump: pompa },
    { x: L * 0.25, z: zPuncak * 0.55, D },
    { x: L * 0.5, z: zPuncak, D, K: K_PUNCAK },
    { x: L * 0.75, z: zPuncak + (zAkhir - zPuncak) * 0.55, D },
    { x: L, z: zAkhir, D },
  ];
}

/**
 * Tinggi tekan pompa yang dibutuhkan supaya airnya sampai.
 *
 * Tidak dijadikan penggeser sendiri. Pompa dan pipanya TERIKAT satu sama
 * lain: sekali debit, pipa, dan kedua elevasinya dipilih, tinggi tekan
 * pompanya sudah tidak boleh dipilih lagi. Kehilangan tidak bergantung pada
 * pompanya, jadi cukup sekali jalan tanpa pompa untuk mengetahuinya.
 */
function tinggiPompa(
  Q: number,
  L: number,
  D: number,
  zPuncak: number,
  zAkhir: number,
  f: number
) {
  const tanpa = ductEnergy(Q, lintasan(L, D, zPuncak, zAkhir, 0), 0, f);
  const ujung = tanpa.points[tanpa.points.length - 1];
  return Math.max(0, zAkhir - ujung.hgl);
}

export function EnergiBertekananClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Q, setQ] = useState(0.06);
  const [D, setD] = useState(0.2);
  const [L, setL] = useState(900);
  const [zPuncak, setZPuncak] = useState(18);
  const [zAkhir, setZAkhir] = useState(14);
  const [f, setF] = useState(0.022);

  const Hp = tinggiPompa(Q, L, D, zPuncak, zAkhir, f);
  const stations = lintasan(L, D, zPuncak, zAkhir, Hp);
  const r = ductEnergy(Q, stations, 0, f);
  const puncak = r.points[2];
  const daya = (RHO_G * Q * Hp) / 1000;

  /*
   * Kedua garis digambar bertangga di penampang yang punya perlengkapan atau
   * pompa: satu titik sebelum lompatannya, satu titik sesudahnya, pada absis
   * yang sama. Tanpa itu kenaikan pompa di hulu tergambar sebagai kemiringan
   * sepanjang seperempat lintasan, seolah pipanya sendiri menambah energi.
   */
  const bertangga = (pilih: "egl" | "hgl") => {
    const out: { x: number; z: number }[] = [];
    r.points.forEach((p, i) => {
      const lompat = (stations[i].pump ?? 0) - (stations[i].K ?? 0) * p.velocityHead;
      if (lompat !== 0) out.push({ x: p.x, z: p[pilih] - lompat });
      out.push({ x: p.x, z: p[pilih] });
    });
    return out;
  };

  const ref = useCanvas(
    (ctx, w, ch) => {
      const sumbu = r.points.map((p) => ({ x: p.x, z: p.z }));
      const atas = r.points.map((p) => ({ x: p.x, z: p.z + p.D / 2 }));
      const bawah = r.points.map((p) => ({ x: p.x, z: p.z - p.D / 2 }));

      const garis: StructureLine[] = [
        {
          pts: bertangga("egl"),
          color: C.energy,
          weight: W.bold,
          dash: DASH.solid,
          label: T.energyGrade,
          labelAt: 0.3,
          labelDy: -10,
          labelAlign: "center",
        },
        {
          pts: bertangga("hgl"),
          color: puncak.pressureHead < 0 ? C.critical : C.water,
          weight: W.bold,
          dash: DASH.hidden,
          label: T.hydraulicGrade,
          labelAt: 0.68,
          labelDy: 16,
          labelAlign: "center",
        },
        {
          pts: [
            { x: -L * 0.05, z: 0 },
            { x: L * 1.05, z: 0 },
          ],
          color: C.ink3,
          weight: W.hair,
          dash: DASH.axis,
          label: T.datumLine,
          labelAt: 0.04,
          labelDy: 13,
          labelAlign: "left",
        },
        { pts: sumbu, color: C.ink3, weight: W.hair, dash: DASH.axis },
        { pts: atas, color: C.ink, weight: W.bold, dash: DASH.solid },
        { pts: bawah, color: C.ink, weight: W.bold, dash: DASH.solid },
      ];

      /* Tinggi tekan di puncak, diukur dari sumbu pipanya ke garis tekanan.
         Itulah satu-satunya ukuran yang menentukan pipanya didorong atau
         dihisap, jadi ia yang digambar, bukan tinggi energinya. */
      const dims: StructureDim[] = [
        {
          axis: "v",
          at: L * 0.5,
          from: puncak.z,
          to: puncak.hgl,
          text: `${fmtPlain(puncak.pressureHead, 2)} m`,
          color: puncak.pressureHead < 0 ? C.signal : C.water,
          offset: 30,
        },
        {
          axis: "v",
          at: 0,
          from: 0,
          to: Hp,
          text: `Hp ${fmtPlain(Hp, 2)} m`,
          color: C.energy,
          /* Di sisi kiri pompa, karena nama pompanya di sisi kanan dan
             keduanya duduk pada ketinggian yang sama. */
          offset: -34,
        },
      ];

      const zMin = Math.min(0, ...r.points.map((p) => p.hgl)) - 2;
      const zMax = Math.max(zPuncak, zAkhir, Hp, ...r.points.map((p) => p.egl));
      drawStructure(
        ctx,
        w,
        ch,
        {
          xMin: -L * 0.07,
          xMax: L * 1.09,
          zMin,
          zMax: zMax + Math.max(2, zMax * 0.12),
          equalScale: false,
          bodies: [],
          lines: garis,
          dims,
          callouts: [
            { x: 0, z: Hp / 2, dx: 22, dy: 0, text: x.labelPompa },
            /*
             * Titik tengahnya hanya disebut puncak bila memang lebih tinggi
             * daripada kedua ujungnya. Pada setelan yang lebih rendah, titik
             * itu justru lembah lintasan, dan menamainya puncak menyuruh
             * pembaca mencari udara di tempat yang salah. Namanya menunjuk
             * ke ATAS, karena di bawah titik yang rendah sudah menunggu
             * angka sumbu datar.
             */
            {
              x: L * 0.5,
              z: zPuncak,
              dx: 10,
              dy: zPuncak > Math.max(0, zAkhir) ? 26 : -26,
              text: zPuncak > Math.max(0, zAkhir) ? x.labelPuncak : x.labelTengah,
            },
          ],
          heading: r.cavitates
            ? x.kavitasi
            : puncak.pressureHead < 0
              ? x.hisap
              : undefined,
          headingColor: r.cavitates ? C.signal : C.critical,
          axisX: T.axAlongDuct,
          axisZ: T.axHeadM,
        },
        lang
      );
    },
    [Q, D, L, zPuncak, zAkhir, f, lang]
  );

  return (
    <LabShell
      sheet="PI-07"
      subject={SUBJECTS.PI[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            <Term tint={C.energy}>Garis energi</Term> hanya boleh turun, kecuali
            di pompa. <Term tint={C.water}>Garis tekanan</Term> boleh naik dan
            boleh turun, dan yang menentukan rancangan adalah jaraknya terhadap
            sumbu pipa.
          </p>
        ) : (
          <p>
            The <Term tint={C.energy}>energy line</Term> may only fall, except at
            a pump. The <Term tint={C.water}>hydraulic grade line</Term> may rise
            or fall, and what decides the design is its distance from the pipe
            axis.
          </p>
        )
      }
      drawing={
        <Sheet
          number="PI-07"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "Hp", value: `${fmt(Hp, 2)} m`, tint: C.energy },
            {
              label: "p/γ",
              value: `${fmt(puncak.pressureHead, 2)} m`,
              tint: r.cavitates
                ? C.signal
                : puncak.pressureHead < 0
                  ? C.critical
                  : C.water,
            },
            { label: "hf", value: `${fmt(r.frictionLoss, 2)} m` },
            { label: "P", value: `${fmt(daya, 1)} kW` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q * 1000} min={2} max={400} step={2} digits={0} unit="l/s" onChange={(v) => setQ(v / 1000)} tint={C.water} />
              <InputRow symbol="D" label={x.dD} value={D * 1000} min={50} max={800} step={10} digits={0} unit="mm" onChange={(v) => setD(v / 1000)} />
              <InputRow symbol="L" label={x.dL} value={L} min={50} max={5000} step={50} digits={0} unit="m" onChange={setL} />
              <InputRow symbol="zp" label={x.dPuncak} value={zPuncak} min={0} max={60} step={0.5} digits={1} unit="m" onChange={setZPuncak} tint={C.critical} />
              <InputRow symbol="z₂" label={x.dAkhir} value={zAkhir} min={0} max={60} step={0.5} digits={1} unit="m" onChange={setZAkhir} />
              <InputRow symbol="f" label={x.dF} value={f} min={0.008} max={0.08} step={0.001} digits={3} onChange={setF} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pBiasa, apply: () => { setQ(0.06); setD(0.2); setL(900); setZPuncak(18); setZAkhir(14); setF(0.022); } },
                  { label: x.pPuncak, apply: () => { setQ(0.06); setD(0.2); setL(900); setZPuncak(26); setZAkhir(14); setF(0.022); } },
                  { label: x.pKavitasi, apply: () => { setQ(0.06); setD(0.2); setL(900); setZPuncak(40); setZAkhir(14); setF(0.022); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag
                tint={puncak.pressureHead < 0 ? C.critical : C.water}
                alert={r.cavitates}
              >
                {r.cavitates
                  ? x.kavitasi
                  : puncak.pressureHead < 0
                    ? x.hisap
                    : x.aman}
              </Flag>
            </div>
            {(r.cavitates || puncak.pressureHead < 0) && (
              <div className="mb-2.5">
                <Note>{r.cavitates ? x.kavitasiNote : x.hisapNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "Hp", label: x.rHp, value: fmt(Hp, 3), unit: "m", tint: C.energy, strong: true },
                { symbol: "V", label: x.rV, value: fmt(puncak.velocity, 3), unit: "m/s" },
                { symbol: "hf", label: x.rHf, value: fmt(r.frictionLoss, 3), unit: "m" },
                { symbol: "ΣhK", label: x.rHk, value: fmt(r.minorLoss, 4), unit: "m" },
                {
                  symbol: "p/γ",
                  label: x.rPuncak,
                  value: fmt(puncak.pressureHead, 3),
                  unit: "m",
                  tint: r.cavitates
                    ? C.signal
                    : puncak.pressureHead < 0
                      ? C.critical
                      : C.water,
                  strong: true,
                },
                { symbol: "P", label: x.rDaya, value: fmt(daya, 2), unit: "kW" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(Q, D, L, zPuncak, zAkhir, f, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksDuct(Q, stations, 0, f)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Hp = z₂ + f</span>
                <Frac num="L" den="D" />
                <Frac num="V²" den="2g" />
                <span>+ ΣK</span>
                <Frac num="V²" den="2g" />
              </Eq>
              <Eq>
                <Frac num="p" den="γ" />
                <span>= HGL − z</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? `negatif berarti dihisap; di bawah −${fmtPlain(ATM_HEAD, 2)} m airnya mendidih`
                    : `negative means suction; below −${fmtPlain(ATM_HEAD, 2)} m the water boils`}
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
  D: number,
  L: number,
  zPuncak: number,
  zAkhir: number,
  f: number,
  lang: Lang
): string {
  const di = (d: number) => {
    const hp = tinggiPompa(Q, L, d, zPuncak, zAkhir, f);
    const rr = ductEnergy(Q, lintasan(L, d, zPuncak, zAkhir, hp), 0, f);
    return { hp, p: rr.points[2].pressureHead, daya: (RHO_G * Q * hp) / 1000 };
  };
  const a = di(D);
  const b = di(D * 1.25);

  if (lang === "en")
    return `The pump must raise ${fmt(a.hp, 1)} metres to deliver this discharge, and ${fmt(a.hp - zAkhir, 1)} of those metres are spent purely on losses rather than on lifting anything. Widen the pipe by a quarter, to ${fmt(D * 1250, 0)} millimetres, and the required head drops to ${fmt(b.hp, 1)} metres and the power from ${fmt(a.daya, 1)} to ${fmt(b.daya, 1)} kilowatts. The pressure at the summit meanwhile moves from ${fmt(a.p, 1)} to ${fmt(b.p, 1)} metres. Pipe bought once, electricity paid every day for thirty years.`;
  return `Pompanya harus menaikkan ${fmt(a.hp, 1)} meter untuk mengantarkan debit ini, dan ${fmt(a.hp - zAkhir, 1)} meter di antaranya habis untuk kehilangan saja, bukan untuk menaikkan apa pun. Besarkan pipanya seperempat, menjadi ${fmt(D * 1250, 0)} milimeter, dan tinggi yang dibutuhkan turun ke ${fmt(b.hp, 1)} meter dan dayanya dari ${fmt(a.daya, 1)} ke ${fmt(b.daya, 1)} kilowatt. Sementara itu tekanan di puncaknya berpindah dari ${fmt(a.p, 1)} ke ${fmt(b.p, 1)} meter. Pipa dibeli sekali, listriknya dibayar tiap hari selama tiga puluh tahun.`;
}
