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
import { ductEnergy, fmt, fmtPlain, type DuctStation } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksDuct } from "@/lib/checks";

const TXT = {
  id: {
    title: "Persamaan energi",
    sheetTitle: "Ke mana tinggi energi pergi di sepanjang pipa penghubung",
    dH: "Beda muka air kedua kolam",
    dL: "Panjang pipa",
    dD: "Garis tengah pipa",
    dF: "Faktor gesekan Darcy",
    dK: "Koefisien kehilangan katup",
    pPendek: "Pipa pendek, kehilangan setempat berkuasa",
    pPanjang: "Pipa panjang, gesekan berkuasa",
    pKatup: "Katup setengah tertutup",
    rQ: "Debit yang terjadi",
    rV: "Kecepatan aliran",
    rHf: "Kehilangan gesekan",
    rHk: "Kehilangan setempat",
    rHv: "Tinggi kecepatan di ujung",
    rBagi: "Bagian gesekan dari seluruh tinggi",
    gesekanKuasa: "Gesekan sepanjang pipa yang berkuasa",
    setempatKuasa: "Kehilangan setempat yang berkuasa",
    labelEntry: "kehilangan masuk",
    labelValve: "katup",
    labelBend: "belokan",
    note:
      "Persamaan energi tidak lain persamaan Bernoulli yang jujur, yaitu Bernoulli dengan satu suku tambahan untuk energi yang tidak dapat dikembalikan. Suku tambahan itulah yang membuat lembar ini berbeda dari lembar sebelumnya: di sana garis energinya mendatar sempurna, di sini ia hanya boleh turun. Dua bentuk penurunannya perlu dibedakan karena keduanya menuntut perlakuan yang berbeda. Gesekan dinding menurunkannya sebagai kemiringan yang tetap, sebanding dengan panjang, jadi memperpanjang pipa selalu menambah biayanya. Kehilangan setempat menurunkannya sebagai anak tangga di satu titik, tidak peduli panjang pipanya, jadi pada pipa pendek justru anak tangga itulah yang menghabiskan hampir seluruh tinggi yang tersedia. Yang menyesatkan pada perhitungan yang tergesa adalah anggapan bahwa kehilangan setempat selalu kecil dan pantas diabaikan. Coba pendekkan pipanya di lembar ini sampai sepuluh meter dan perhatikan bagiannya. Keduanya kebetulan sebanding dengan tinggi kecepatan yang sama, jadi nisbah keduanya sama sekali tidak bergantung pada debit: sekali pipanya dikuasai kehilangan setempat, ia akan tetap begitu pada debit berapa pun.",
  },
  en: {
    title: "Energy equation",
    sheetTitle: "Where the total head goes along a connecting pipe",
    dH: "Difference between the two pool levels",
    dL: "Pipe length",
    dD: "Pipe diameter",
    dF: "Darcy friction factor",
    dK: "Valve loss coefficient",
    pPendek: "Short pipe, minor losses rule",
    pPanjang: "Long pipe, friction rules",
    pKatup: "Valve half closed",
    rQ: "Resulting discharge",
    rV: "Flow velocity",
    rHf: "Friction loss",
    rHk: "Minor losses",
    rHv: "Velocity head at the outlet",
    rBagi: "Share of the whole head taken by friction",
    gesekanKuasa: "Pipe friction rules",
    setempatKuasa: "Minor losses rule",
    labelEntry: "entry loss",
    labelValve: "valve",
    labelBend: "bend",
    note:
      "The energy equation is nothing but an honest Bernoulli, that is Bernoulli with one extra term for the energy that cannot be given back. That term is what separates this sheet from the last one: there the energy line was perfectly level, here it may only fall. Two forms of fall need to be told apart, because they ask for different treatment. Wall friction lowers it as a steady slope, proportional to length, so lengthening the pipe always adds to the bill. A minor loss lowers it as a step at one point, whatever the length, so on a short pipe it is the steps that consume nearly all the head available. What misleads a hurried calculation is the assumption that minor losses are always small and safely ignored. Try shortening the pipe on this sheet to ten metres and watch the share. Both happen to be proportional to the same velocity head, so their ratio does not depend on discharge at all: once a pipe is dominated by its fittings, it stays that way at every discharge.",
  },
} as const;

const REFS = {
  id: [
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, edisi ke-8, bab 5.",
    "Idelchik, I.E. (1996). Handbook of Hydraulic Resistance, edisi ke-3.",
    "Miller, D.S. (1990). Internal Flow Systems, edisi ke-2.",
    "Colebrook, C.F. (1939). Turbulent flow in pipes. J. Inst. Civ. Eng. 11, 133–156.",
  ],
  en: [
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, 8th ed., ch. 5.",
    "Idelchik, I.E. (1996). Handbook of Hydraulic Resistance, 3rd ed.",
    "Miller, D.S. (1990). Internal Flow Systems, 2nd ed.",
    "Colebrook, C.F. (1939). Turbulent flow in pipes. J. Inst. Civ. Eng. 11, 133–156.",
  ],
} as const;

const K_MASUK = 0.5;
const K_BELOK = 0.3;

/** Penampang-penampang pipanya, dengan katup di tengah dan belokan di tiga perempat. */
function pipa(L: number, D: number, H: number, Kv: number): DuctStation[] {
  /*
   * Pipa berangkat dari BAWAH muka air kolam hulu, menurun, lalu mendatar
   * di BAWAH muka air kolam hilir.
   *
   * Debitnya dicari dengan syarat garis tekanan di ujung pipa jatuh tepat di
   * muka air kolam hilir, dan syarat itu hanya berlaku bila ujungnya
   * terendam. Sebelumnya pipanya berakhir di tengah beda tinggi, tiga meter
   * DI ATAS muka air hilir, sehingga ujungnya sebenarnya mencurah bebas
   * sementara hitungannya menganggapnya terendam, dan separuh hilir pipanya
   * tergambar menghisap.
   */
  const zMasuk = -D * 1.5;
  const zKeluar = -H - D * 1.5;
  const z = (s: number) => zMasuk + (zKeluar - zMasuk) * Math.min(1, s * 1.6);
  return [
    { x: 0, z: z(0), D, K: K_MASUK },
    { x: L * 0.25, z: z(0.25), D },
    { x: L * 0.5, z: z(0.5), D, K: Kv },
    { x: L * 0.75, z: z(0.75), D, K: K_BELOK },
    { x: L, z: z(1), D },
  ];
}

/**
 * Debit yang benar-benar terjadi pada beda tinggi yang diberikan.
 *
 * Bukan penggeser. Debitnya TERIKAT oleh beda muka airnya, dan membiarkan
 * orang memilih debit sendiri akan membiarkannya memilih keadaan yang tidak
 * pernah ada. Dicari dengan membagi dua sampai garis tekanan di ujung
 * pipanya jatuh tepat di muka air kolam hilir.
 */
function debitAlami(L: number, D: number, H: number, Kv: number, f: number) {
  let lo = 0;
  let hi = 50;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const r = ductEnergy(mid, pipa(L, D, H, Kv), 0, f);
    const ujung = r.points[r.points.length - 1];
    /* Muka air hulu dijadikan acuan nol, jadi ujungnya harus mencapai −H. */
    if (ujung.hgl > -H) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function PersamaanEnergiClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [H, setH] = useState(6);
  const [L, setL] = useState(120);
  const [D, setD] = useState(0.25);
  const [f, setF] = useState(0.022);
  const [Kv, setKv] = useState(2);

  const stations = pipa(L, D, H, Kv);
  const Q = debitAlami(L, D, H, Kv, f);
  const r = ductEnergy(Q, stations, 0, f);
  const ujung = r.points[r.points.length - 1];
  const total = r.frictionLoss + r.minorLoss + ujung.velocityHead;
  const bagiGesekan = total > 0 ? r.frictionLoss / total : 0;

  /*
   * Kedua garis digambar bertangga: di penampang yang punya perlengkapan,
   * satu titik sebelum kehilangannya dan satu titik sesudahnya, pada absis
   * yang sama.
   *
   * Sebelumnya garisnya menghubungkan nilai sesudah-kehilangan dari satu
   * penampang ke penampang berikutnya, sehingga setiap anak tangga tergambar
   * sebagai kemiringan yang menyatu dengan kemiringan gesekan. Padahal
   * membedakan keduanya justru satu-satunya pokok lembar ini, dan kalimat
   * pengantarnya sendiri menyebut anak tangga.
   */
  const bertangga = (pilih: "egl" | "hgl") => {
    const out: { x: number; z: number }[] = [];
    r.points.forEach((p, i) => {
      const hk = (stations[i].K ?? 0) * p.velocityHead;
      if (hk > 0) out.push({ x: p.x, z: p[pilih] + hk });
      out.push({ x: p.x, z: p[pilih] });
    });
    return out;
  };

  const ref = useCanvas(
    (ctx, w, ch) => {
      const atas = r.points.map((p) => ({ x: p.x, z: p.z + p.D / 2 }));
      const bawah = r.points.map((p) => ({ x: p.x, z: p.z - p.D / 2 }));

      const garis: StructureLine[] = [
        {
          pts: [
            { x: -L * 0.06, z: 0 },
            { x: L * 1.06, z: 0 },
          ],
          color: C.ink3,
          weight: W.hair,
          dash: DASH.axis,
          label: T.upstream,
          labelAt: 0.02,
          labelDy: -9,
          labelAlign: "left",
        },
        /* Muka air kolam hilir, tempat garis tekanan di ujung pipa jatuh. */
        {
          pts: [
            { x: L * 0.86, z: -H },
            { x: L * 1.06, z: -H },
          ],
          color: C.ink3,
          weight: W.hair,
          dash: DASH.axis,
          label: T.downstream,
          labelAt: 1,
          labelDy: -9,
          labelAlign: "right",
        },
        {
          pts: bertangga("egl"),
          color: C.energy,
          weight: W.bold,
          dash: DASH.solid,
          label: T.energyGrade,
          labelAt: 0.42,
          labelDy: -10,
          labelAlign: "center",
        },
        {
          pts: bertangga("hgl"),
          color: C.water,
          weight: W.bold,
          dash: DASH.hidden,
          label: T.hydraulicGrade,
          labelAt: 0.74,
          labelDy: 15,
          labelAlign: "center",
        },
        { pts: atas, color: C.ink, weight: W.bold, dash: DASH.solid },
        { pts: bawah, color: C.ink, weight: W.bold, dash: DASH.solid },
      ];

      /* Kehilangan gesekan dan kehilangan setempat, masing-masing diukur di
         tempat kejadiannya sendiri: gesekan sebagai selisih seluruh garis
         energi yang bukan anak tangga, kehilangan setempat pada anak
         tangganya di katup. */
      const dims: StructureDim[] = [
        {
          axis: "v",
          at: L,
          from: ujung.egl,
          to: ujung.egl + r.frictionLoss,
          text: `hf ${fmtPlain(r.frictionLoss, 2)} m`,
          color: C.energy,
          offset: 30,
        },
        {
          axis: "v",
          at: L * 0.5,
          from: r.points[2].egl,
          to: r.points[2].egl + Kv * r.points[2].velocityHead,
          text: `hK ${fmtPlain(Kv * r.points[2].velocityHead, 2)} m`,
          color: C.critical,
          offset: 26,
        },
      ];

      const zMin =
        Math.min(ujung.z - D, ujung.egl, -H) - Math.max(0.6, H * 0.14);
      drawStructure(
        ctx,
        w,
        ch,
        {
          xMin: -L * 0.08,
          xMax: L * 1.1,
          zMin,
          zMax: Math.max(0.6, H * 0.18),
          equalScale: false,
          bodies: [],
          lines: garis,
          callouts: [
            { x: 0, z: 0, dx: 18, dy: 22, text: x.labelEntry },
            { x: L * 0.5, z: r.points[2].egl, dx: -12, dy: -24, text: x.labelValve },
            { x: L * 0.75, z: r.points[3].z, dx: 14, dy: 24, text: x.labelBend },
          ],
          dims,
          heading: bagiGesekan >= 0.5 ? x.gesekanKuasa : x.setempatKuasa,
          axisX: T.axAlongDuct,
          axisZ: T.axHeadM,
        },
        lang
      );
    },
    [H, L, D, f, Kv, lang]
  );

  return (
    <LabShell
      sheet="FF-02"
      subject={SUBJECTS.FF[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Garis energi di sini <Term tint={C.energy}>hanya boleh turun</Term>,
            dan turunnya dengan dua cara: sebagai{" "}
            <Term tint={C.energy}>kemiringan tetap</Term> karena gesekan, dan
            sebagai <Term tint={C.critical}>anak tangga</Term> di setiap katup
            dan belokan.
          </p>
        ) : (
          <p>
            The energy line here <Term tint={C.energy}>may only fall</Term>, and
            it falls in two ways: as a{" "}
            <Term tint={C.energy}>steady slope</Term> from friction, and as a{" "}
            <Term tint={C.critical}>step</Term> at every valve and bend.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FF-02"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "Q", value: `${fmt(Q * 1000, 1)} l/s`, tint: C.water },
            { label: "hf", value: `${fmt(r.frictionLoss, 2)} m`, tint: C.energy },
            { label: "ΣhK", value: `${fmt(r.minorLoss, 2)} m`, tint: C.critical },
            { label: "V²/2g", value: `${fmt(ujung.velocityHead, 3)} m` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="ΔH" label={x.dH} value={H} min={0.5} max={40} step={0.5} digits={1} unit="m" onChange={setH} tint={C.energy} />
              <InputRow symbol="L" label={x.dL} value={L} min={10} max={2000} step={10} digits={0} unit="m" onChange={setL} />
              <InputRow symbol="D" label={x.dD} value={D * 1000} min={50} max={900} step={10} digits={0} unit="mm" onChange={(v) => setD(v / 1000)} />
              <InputRow symbol="f" label={x.dF} value={f} min={0.008} max={0.08} step={0.001} digits={3} onChange={setF} />
              <InputRow symbol="K" label={x.dK} value={Kv} min={0} max={40} step={0.5} digits={1} onChange={setKv} tint={C.critical} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pPendek, apply: () => { setH(6); setL(10); setD(0.25); setF(0.022); setKv(2); } },
                  { label: x.pPanjang, apply: () => { setH(6); setL(1200); setD(0.25); setF(0.022); setKv(2); } },
                  { label: x.pKatup, apply: () => { setH(6); setL(120); setD(0.25); setF(0.022); setKv(30); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5">
              <Flag tint={bagiGesekan >= 0.5 ? C.energy : C.critical}>
                {bagiGesekan >= 0.5 ? x.gesekanKuasa : x.setempatKuasa}
              </Flag>
            </div>
            <ResultTable
              rows={[
                { symbol: "Q", label: x.rQ, value: fmt(Q * 1000, 2), unit: "l/s", tint: C.water, strong: true },
                { symbol: "V", label: x.rV, value: fmt(ujung.velocity, 3), unit: "m/s" },
                { symbol: "hf", label: x.rHf, value: fmt(r.frictionLoss, 3), unit: "m", tint: C.energy, strong: true },
                { symbol: "ΣhK", label: x.rHk, value: fmt(r.minorLoss, 3), unit: "m", tint: C.critical, strong: true },
                { symbol: "V²/2g", label: x.rHv, value: fmt(ujung.velocityHead, 4), unit: "m" },
                { symbol: "hf/ΔH", label: x.rBagi, value: fmt(bagiGesekan * 100, 1), unit: "%" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(H, L, D, f, Kv, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksDuct(Q, stations, 0, f)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>ΔH = f</span>
                <Frac num="L" den="D" />
                <Frac num="V²" den="2g" />
                <span>+ ΣK</span>
                <Frac num="V²" den="2g" />
                <span>+</span>
                <Frac num="V²" den="2g" />
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "gesekan sebanding panjang, kehilangan setempat tidak; keduanya sebanding tinggi kecepatan yang sama"
                    : "friction scales with length, minor losses do not; both scale with the same velocity head"}
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
  H: number,
  L: number,
  D: number,
  f: number,
  Kv: number,
  lang: Lang
): string {
  const bagi = (Lx: number) => {
    const q = debitAlami(Lx, D, H, Kv, f);
    const rr = ductEnergy(q, pipa(Lx, D, H, Kv), 0, f);
    const uj = rr.points[rr.points.length - 1];
    const tot = rr.frictionLoss + rr.minorLoss + uj.velocityHead;
    return { q, bagian: tot > 0 ? (rr.frictionLoss / tot) * 100 : 0 };
  };
  const pendek = Math.max(10, L / 10);
  const panjang = Math.min(2000, L * 10);
  const a = bagi(L);
  const b = bagi(pendek);
  const c = bagi(panjang);

  if (lang === "en")
    return `At ${fmt(L, 0)} metres of pipe, friction takes ${fmt(a.bagian, 0)} per cent of the available head and the discharge settles at ${fmt(a.q * 1000, 1)} litres a second. Shorten the pipe to ${fmt(pendek, 0)} metres and friction's share falls to ${fmt(b.bagian, 0)} per cent: the fittings now consume almost everything. Lengthen it to ${fmt(panjang, 0)} metres instead and the share rises to ${fmt(c.bagian, 0)} per cent, while the discharge drops to ${fmt(c.q * 1000, 1)} litres a second. The same fittings, the same valve, and a completely different answer to the question of what is worth designing carefully.`;
  return `Pada pipa sepanjang ${fmt(L, 0)} meter, gesekan mengambil ${fmt(a.bagian, 0)} persen tinggi yang tersedia dan debitnya menetap di ${fmt(a.q * 1000, 1)} liter tiap detik. Pendekkan pipanya menjadi ${fmt(pendek, 0)} meter dan bagian gesekannya turun ke ${fmt(b.bagian, 0)} persen: sekarang perlengkapannya yang menghabiskan hampir seluruhnya. Panjangkan menjadi ${fmt(panjang, 0)} meter dan bagiannya naik ke ${fmt(c.bagian, 0)} persen, sementara debitnya turun ke ${fmt(c.q * 1000, 1)} liter tiap detik. Perlengkapan yang sama, katup yang sama, dan jawaban yang sama sekali berbeda atas pertanyaan mana yang pantas dirancang dengan hati-hati.`;
}
