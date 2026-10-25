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
  type LangkahHitung,
} from "@/components/ui";
import { useCanvas } from "@/lib/useCanvas";
import {
  bendPlan,
  drawStructure,
  type StructureDim,
  type StructureLine,
  type StructureVector,
} from "@/lib/drawStructure";
import { G, fmt, fmtPlain, momentumForce } from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";

/* Sumbu pita D₂/D₁ 0,0625–32 memuat penggeser (50/800 dan 1600/50). */
const RASIO_MIN = 0.0625;
const RASIO_MAX = 32;
/*
 * Ambang kecepatan untuk butir peringatan. BUKAN angka terbitan: hanya
 * penanda bahwa kecepatan di atasnya jauh melampaui air di pipa nyata
 * (beberapa m/s). Rumusnya tetap berlaku, jadi nadanya caution. Ambang
 * akhirnya menunggu keputusan sesi utama.
 */
const V_WASPADA = 10;
/** Diameter hilir terbesar penggeser, meter. */
const D2_MAKS = 1.6;
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksMomentum } from "@/lib/checks";

const TXT = {
  id: {
    title: "Momentum dalam pipa",
    sheetTitle: "Perubahan penampang mendadak: tekanan naik, energi hilang",
    dQ: "Debit",
    dD1: "Diameter sebelum perubahan",
    dD2: "Diameter sesudah perubahan",
    dH: "Tinggi tekan sebelum perubahan",
    pBesar: "Pembesaran mendadak",
    pBesarSekali: "Pembesaran ke penampang jauh lebih besar",
    pKecil: "Penyempitan mendadak",
    rV1: "Kecepatan sebelum",
    rV2: "Kecepatan sesudah",
    rH2: "Tinggi tekan sesudah",
    rNaik: "Kenaikan tinggi tekan",
    rHilang: "Tinggi energi yang hilang",
    rF: "Gaya mendatar pada dinding anak tangga",
    rBagi: "Bagian tinggi kecepatan yang berhasil dipulihkan",
    tekananNaik: "Tekanan naik meskipun energi hilang",
    tekananTurun: "Tekanan turun, penampang menyempit",
    tetap: "Penampang tetap, tidak ada perubahan",
    bSempit: "Penyempitan: tekanan turun",
    bBesar: "Pembesaran: tekanan naik, energi hilang",
    hV: "Kecepatan sebelum dan sesudah",
    hHLBesar: "Kehilangan Borda-Carnot (pembesaran)",
    hHLSempit: "Kehilangan penyempitan mendadak",
    hNaik: "Perubahan tinggi tekan",
    hPulih: "Bagian tinggi kecepatan yang dipulihkan",
    hF: "Gaya mendatar pada dinding anak tangga",
    vCepat: (v: string) => `Kecepatan ${v} m/s jauh di atas air di pipa nyata, yang umumnya beberapa meter per detik. Rumusnya tetap berlaku, tetapi keadaan ini tidak dapat dibuat. Perbesar diameternya atau kurangi debitnya.`,
    mendidih: "Tekanan sesudah penyempitan jatuh ke tekanan uap",
    mendidihNote:
      "Debit ini tidak dapat lewat. Untuk memaksanya melalui penampang sesempit ini, tekanan sesudah penyempitan harus turun di bawah tekanan uap air, dan di situ airnya mendidih: kolomnya putus dan alirannya tersedak, jadi debit yang sebenarnya jauh lebih kecil daripada yang dipilih. Angka tekanan dan kehilangan di bawah karena itu tidak dituliskan. Perbesar penampang sesudahnya, kecilkan debitnya, atau naikkan tinggi tekan di hulunya.",
    labelStep: "anak tangga",
    labelGaya: "gaya pada anak tangga",
    note:
      "Dua pernyataan pada lembar ini terdengar bertentangan padahal keduanya benar sekaligus, dan yang membuatnya terdengar bertentangan hanyalah kebiasaan menyamakan tekanan dengan energi. Pada pembesaran mendadak tekanan NAIK, karena air melambat dan sebagian tinggi kecepatannya berubah menjadi tinggi tekan. Pada saat yang sama energi HILANG, karena perlambatannya terjadi dengan olakan yang tidak pernah kembali menjadi apa pun. Yang naik dan yang hilang bukan besaran yang sama: tinggi kecepatan yang dilepas lebih besar daripada tinggi tekan yang didapat, dan selisih keduanya itulah yang hilang. Rumus kehilangannya, kuadrat SELISIH kecepatan dan bukan selisih kuadratnya, adalah tempat kesalahan hitung paling sering terjadi, dan keduanya tidak pernah berbeda jauh sehingga kesalahannya jarang mencolok, tetapi arah kesimpulannya bisa terbalik. Perhatikan pula batasnya: pada pembesaran ke penampang yang jauh lebih besar, seluruh tinggi kecepatan hilang dan tidak ada yang dipulihkan sama sekali. Itulah sebabnya pipa yang bermuara ke waduk kehilangan satu tinggi kecepatan penuh, tidak peduli sebesar apa waduknya.",
  },
  en: {
    title: "Pipe momentum",
    sheetTitle: "A sudden change of section: the pressure rises, the energy goes",
    dQ: "Discharge",
    dD1: "Diameter before the change",
    dD2: "Diameter after the change",
    dH: "Pressure head before the change",
    pBesar: "Sudden enlargement",
    pBesarSekali: "Enlargement into a far larger section",
    pKecil: "Sudden contraction",
    rV1: "Velocity before",
    rV2: "Velocity after",
    rH2: "Pressure head after",
    rNaik: "Rise in pressure head",
    rHilang: "Head lost",
    rF: "Horizontal force on the step wall",
    rBagi: "Share of the velocity head actually recovered",
    tekananNaik: "The pressure rises although energy is lost",
    tekananTurun: "The pressure falls, the section narrows",
    tetap: "Constant section, no change",
    bSempit: "Contraction: pressure falls",
    bBesar: "Enlargement: pressure rises, energy lost",
    hV: "Velocity before and after",
    hHLBesar: "Borda-Carnot loss (enlargement)",
    hHLSempit: "Sudden contraction loss",
    hNaik: "Change in pressure head",
    hPulih: "Share of the velocity head recovered",
    hF: "Horizontal force on the step wall",
    vCepat: (v: string) => `A velocity of ${v} m/s is far above water in a real pipe, which is usually a few metres per second. The formulas still hold, but this state cannot be built. Enlarge the diameter or reduce the discharge.`,
    mendidih: "The pressure after the contraction reaches vapour pressure",
    mendidihNote:
      "This discharge cannot pass. To force it through a section this narrow, the pressure after the contraction would have to fall below the vapour pressure of water, and there the water boils: the column parts and the flow chokes, so the real discharge is far smaller than the one chosen. The pressure and loss figures below are therefore not written. Enlarge the downstream section, reduce the discharge, or raise the upstream pressure head.",
    labelStep: "step",
    labelGaya: "force on the step",
    note:
      "Two statements on this sheet sound contradictory although both are true at once, and what makes them sound so is only the habit of treating pressure as energy. Across a sudden enlargement the pressure RISES, because the water slows and part of its velocity head turns into pressure head. At the same moment energy is LOST, because the slowing happens through eddies that never turn back into anything. What rises and what is lost are not the same quantity: the velocity head given up is larger than the pressure head gained, and the difference between them is what is lost. The loss formula, the square of the DIFFERENCE of the velocities rather than the difference of their squares, is where the arithmetic most often goes wrong, and the two are never far apart so the error rarely stands out, although the direction of the conclusion can invert. Notice the limit as well: enlarging into a far larger section loses the whole velocity head and recovers nothing at all. That is why a pipe discharging into a reservoir loses one full velocity head, however large the reservoir is.",
  },
} as const;

const REFS = {
  id: [
    "Borda, J.-C. (1766). Mémoire sur l'écoulement des fluides par les orifices des vases.",
    "Carnot, L. (1783). Essai sur les machines en général.",
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, edisi ke-8, bab 3 dan 5.",
    "Idelchik, I.E. (1996). Handbook of Hydraulic Resistance, edisi ke-3, diagram 4-1.",
  ],
  en: [
    "Borda, J.-C. (1766). Mémoire sur l'écoulement des fluides par les orifices des vases.",
    "Carnot, L. (1783). Essai sur les machines en général.",
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, 8th ed., ch. 3 and 5.",
    "Idelchik, I.E. (1996). Handbook of Hydraulic Resistance, 3rd ed., diagram 4-1.",
  ],
} as const;

export function MomentumPipaClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Q, setQ] = useState(0.25);
  const [D1, setD1] = useState(0.25);
  const [D2, setD2] = useState(0.45);
  const [head, setHead] = useState(30);

  const r = momentumForce(Q, D1, D2, head, 0);
  /* Kehilangan seluruhnya: pembesaran ATAU penyempitan, tidak pernah keduanya. */
  const hilang = r.expansionLoss + r.contractionLoss;
  const mati = r.cavitates;
  const hv1 = (r.velocity1 * r.velocity1) / (2 * G);
  const hv2 = (r.velocity2 * r.velocity2) / (2 * G);
  const naik = r.head2 - head;
  const dilepas = hv1 - hv2;
  const besar = D2 > D1;
  const tetap = D2 === D1;
  /* Bagian yang dipulihkan hanya bermakna pada pembesaran yang tidak
     mendidih; penyempitan dan penampang tetap menulis "—". */
  const pulih = besar && !mati && dilepas > 1e-12 ? naik / dilepas : NaN;
  const nada: Tone = mati ? "invalid" : tetap ? "neutral" : besar ? "water" : "neutral";
  const badge = mati ? x.mendidih : tetap ? x.tetap : r.pressureRises ? x.tekananNaik : x.tekananTurun;
  const warnaNaik = naik >= 0 ? C.water : C.ink2;

  const ref = useCanvas(
    (ctx, w, ch) => {
      /*
       * Bidang ini memakai satu sumbu tegak untuk DUA hal sekaligus: jari-jari
       * pipanya dan tinggi tekan yang diukur dari tinggi tekan hulu. Keduanya
       * memang sebanding: tinggi kecepatan pipa air sehari-hari beberapa puluh
       * sentimeter, sebesar jari-jari pipanya sendiri. Kalau tinggi tekan
       * mutlaknya yang dipakai, puluhan meter itu akan menyisakan pipa
       * setinggi satu piksel.
       */
      const L = Math.max(D1, D2) * 2.6;
      const badan = bendPlan(D1, D2, 0, L, L);

      const garis: StructureLine[] = [
        {
          pts: [
            { x: -L, z: 0 },
            { x: L, z: 0 },
          ],
          color: C.ink3,
          weight: W.hair,
          dash: DASH.axis,
        },
        {
          /* Garis tekanan, diukur dari tinggi tekan hulu. */
          pts: [
            { x: -L, z: 0 },
            { x: 0, z: 0 },
            { x: L * 0.35, z: naik },
            { x: L, z: naik },
          ],
          color: C.water,
          weight: W.bold,
          dash: DASH.hidden,
          label: T.hydraulicGrade,
          /* Saat mendidih ruas hilirnya jatuh keluar bingkai, jadi namanya
             ditaruh di ruas hulu yang masih tergambar. */
          labelAt: mati ? 0.12 : 0.98,
          labelDy: -10,
          labelAlign: "right",
        },
        {
          /* Garis energi, diukur dari tinggi tekan hulu yang sama. */
          pts: [
            { x: -L, z: hv1 },
            { x: 0, z: hv1 },
            { x: L * 0.35, z: naik + hv2 },
            { x: L, z: naik + hv2 },
          ],
          color: C.energy,
          weight: W.bold,
          dash: DASH.solid,
          label: T.energyGrade,
          labelAt: 0.02,
          labelDy: -10,
          labelAlign: "left",
        },
      ];

      /* Pada keadaan mendidih kedua ukuran itu hanya tuntutan hitungan yang
         tidak dapat terjadi (Δp/γ sampai minus seribu meter), jadi tidak
         diukur; kop dan tabelnya pun menulis "—". */
      const dims: StructureDim[] = mati ? [] : [
        {
          axis: "v",
          at: L * 0.85,
          from: naik + hv2,
          to: hv1,
          text: `hL ${fmtPlain(hilang, 3)} m`,
          color: C.energy,
          offset: 26,
        },
        {
          axis: "v",
          at: L * 0.55,
          from: 0,
          to: naik,
          text: `Δp/γ ${fmtPlain(naik, 3)} m`,
          color: warnaNaik,
          offset: 26,
        },
      ];

      /* Gaya mendatar pada dinding anak tangganya, digambar di anak tangganya
         sendiri dan bukan di sumbu pipanya. */
      const zStep = (Math.max(D1, D2) + Math.min(D1, D2)) / 4;
      const panah: StructureVector[] =
        Math.abs(r.Fx) > 1
          ? [
              {
                x: 0,
                z: zStep,
                dx: r.Fx > 0 ? 56 : -56,
                dy: 0,
                text: `${x.labelGaya} ${fmtPlain(Math.abs(r.Fx) / 1000, 2)} kN`,
                color: C.energy,
                root: true,
              },
            ]
          : [];

      const tinggi = Math.max(D1, D2) / 2;
      /*
       * Pada keadaan mendidih bingkainya TIDAK diperluas sampai garis tekanan
       * yang minus seribu meter itu, karena pipanya lalu tinggal satu garis.
       * Garisnya dibiarkan jatuh menembus dasar bingkai: tekanan itu memang
       * tidak ada. Di atas disisakan ruang untuk judul dan tulisan ukuran,
       * yang dulu terpotong di tepi atas.
       */
      const zMaxDasar = Math.max(tinggi, hv1, naik + hv2) * 1.35 + 0.02;
      const zMin = mati
        ? -Math.max(tinggi * 3, hv1 * 2)
        : Math.min(-tinggi, naik) * 1.35 - 0.02;
      const zMax = zMaxDasar + (zMaxDasar - zMin) * 0.3;
      drawStructure(
        ctx,
        w,
        ch,
        {
          xMin: -L * 1.05,
          xMax: L * 1.12,
          zMin,
          zMax,
          equalScale: false,
          bodies: [{ pts: badan, hatch: "none", outline: true }],
          lines: garis,
          dims,
          vectors: panah,
          callouts: [{ x: 0, z: -zStep, dx: -14, dy: 24, text: x.labelStep }],
          heading: badge,
          headingColor: mati ? C.signal : r.pressureRises ? C.water : C.ink2,
          axisX: T.axAlongDuct,
          axisZ: T.axHeadM,
        },
        lang
      );
    },
    [Q, D1, D2, head, lang]
  );

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="D₂/D₁"
          value={D2 / D1}
          scale="log"
          digits={3}
          invalid={mati}
          pesan={mati ? x.mendidih : tetap ? x.tetap : undefined}
          bands={[
            { from: RASIO_MIN, to: 1, label: x.bSempit, tone: "neutral" },
            { from: 1, to: RASIO_MAX, label: x.bBesar, tone: "water" },
          ]}
        />
      }
      sheet="PI-06"
      subject={SUBJECTS.PI[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Pada pembesaran mendadak,{" "}
            <Term tint={C.water}>tekanannya naik</Term> sementara{" "}
            <Term tint={C.energy}>energinya hilang</Term>. Keduanya benar
            sekaligus, karena yang dilepas lebih besar daripada yang didapat.
          </p>
        ) : (
          <p>
            Across a sudden enlargement the{" "}
            <Term tint={C.water}>pressure rises</Term> while the{" "}
            <Term tint={C.energy}>energy is lost</Term>. Both are true at once,
            because what is given up exceeds what is gained.
          </p>
        )
      }
      drawing={
        <Sheet
          number="PI-06"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s, kN)" },
            { label: "Δp/γ", value: mati ? "—" : `${fmt(naik, 3)} m`, tint: warnaNaik },
            { label: "hL", value: mati ? "\u2014" : `${fmt(hilang, 3)} m`, tint: C.energy },
            { label: "V₁", value: `${fmt(r.velocity1, 2)} m/s` },
            { label: "V₂", value: `${fmt(r.velocity2, 2)} m/s` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q * 1000} min={5} max={1500} step={5} digits={0} unit="l/s" onChange={(v) => setQ(v / 1000)} tint={C.water} />
              <InputRow symbol="D₁" label={x.dD1} value={D1 * 1000} min={50} max={800} step={10} digits={0} unit="mm" onChange={(v) => setD1(v / 1000)} />
              <InputRow symbol="D₂" label={x.dD2} value={D2 * 1000} min={50} max={1600} step={10} digits={0} unit="mm" onChange={(v) => setD2(v / 1000)} tint={C.critical} />
              <InputRow symbol="h₁" label={x.dH} value={head} min={0} max={150} step={1} digits={0} unit="m" onChange={setHead} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pBesar, apply: () => { setQ(0.25); setD1(0.25); setD2(0.45); setHead(30); } },
                  { label: x.pBesarSekali, apply: () => { setQ(0.25); setD1(0.25); setD2(1.6); setHead(30); } },
                  { label: x.pKecil, apply: () => { setQ(0.25); setD1(0.45); setD2(0.25); setHead(30); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "Δp/γ", label: x.rNaik, value: mati ? "—" : fmt(naik, 4), unit: mati ? undefined : "m", tint: warnaNaik, strong: true },
                { symbol: "hL", label: x.rHilang, value: mati ? "—" : fmt(hilang, 4), unit: mati ? undefined : "m", tint: C.energy, strong: true },
                { symbol: "V₁", label: x.rV1, value: fmt(r.velocity1, 3), unit: "m/s" },
                { symbol: "V₂", label: x.rV2, value: fmt(r.velocity2, 3), unit: "m/s" },
                { symbol: "h₂", label: x.rH2, value: mati ? "—" : fmt(r.head2, 3), unit: mati ? undefined : "m" },
                { symbol: "Fx", label: x.rF, value: mati ? "—" : fmt(r.Fx / 1000, 2), unit: mati ? undefined : "kN" },
                { symbol: "—", label: x.rBagi, value: fmt(pulih * 100, 1), unit: Number.isFinite(pulih) ? "%" : undefined },
              ]}
            />
            <div className="mt-3">
              <Hitungan langkah={langkahHitung({ Q, D1, D2, head, r, hv1, hv2, naik, hilang, pulih, mati, besar }, lang)} />
            </div>
          </Block>

          <StateCard tone={nada} badge={badge} {...notice(Q, D1, D2, head, lang)} />
        </>
      }
      verification={<Verification checks={checksMomentum(Q, D1, D2, head, 0)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>hL =</span>
                <Frac num="(V₁ − V₂)²" den="2g" />
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "kuadrat selisihnya, bukan selisih kuadratnya"
                    : "the square of the difference, not the difference of the squares"}
                </span>
              </Eq>
              <Eq>
                <Frac num="Δp" den="γ" />
                <span>=</span>
                <Frac num="V₁² − V₂²" den="2g" />
                <span>− hL =</span>
                <Frac num="V₂(V₁ − V₂)" den="g" />
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
 * Langkah hitungan. Pembesaran: Borda-Carnot dan bagian dipulihkan.
 * Penyempitan: kehilangan 0,5(1 − A₂/A₁) V₂²/2g, bagian dipulihkan "—".
 * Mendidih: langkah 2 sampai 5 "—".
 */
function langkahHitung(
  s: {
    Q: number;
    D1: number;
    D2: number;
    head: number;
    r: ReturnType<typeof momentumForce>;
    hv1: number;
    hv2: number;
    naik: number;
    hilang: number;
    pulih: number;
    mati: boolean;
    besar: boolean;
  },
  lang: Lang
): LangkahHitung[] {
  const x = TXT[lang];
  const { r, mati, besar } = s;
  const g2 = `2 · ${fmt(G, 2)}`;
  return [
    {
      judul: x.hV,
      rumus: (<><span>V =</span><Frac num="Q" den="π D² / 4" /></>),
      isi: `${fmt(s.Q, 3)} / ( π · ${fmt(s.D1, 2)}² / 4 ) = ${fmt(r.velocity1, 3)};  ${fmt(s.Q, 3)} / ( π · ${fmt(s.D2, 2)}² / 4 ) = ${fmt(r.velocity2, 3)}`,
      hasil: `${fmt(r.velocity1, 3)} → ${fmt(r.velocity2, 3)}`,
      satuan: "m/s",
    },
    besar
      ? {
          judul: x.hHLBesar,
          rumus: (<><span>hL =</span><Frac num="( V₁ − V₂ )²" den="2g" /></>),
          isi: mati ? "—" : `( ${fmt(r.velocity1, 4)} − ${fmt(r.velocity2, 4)} )² / ( ${g2} )`,
          hasil: mati ? "—" : fmt(s.hilang, 4),
          satuan: mati ? undefined : "m",
          tint: C.energy,
        }
      : {
          judul: x.hHLSempit,
          rumus: (<><span>hL = {fmt(0.5, 1)} ( 1 −</span><Frac num="A₂" den="A₁" /><span>)</span><Frac num="V₂²" den="2g" /></>),
          isi: mati ? "—" : `${fmt(0.5, 1)} · ( 1 − ${fmt(r.area2, 4)} / ${fmt(r.area1, 4)} ) · ${fmt(r.velocity2, 4)}² / ( ${g2} )`,
          hasil: mati ? "—" : fmt(s.hilang, 4),
          satuan: mati ? undefined : "m",
          tint: C.energy,
        },
    {
      judul: x.hNaik,
      rumus: (<><Frac num="Δp" den="γ" /><span>=</span><Frac num="V₁² − V₂²" den="2g" /><span>− hL</span></>),
      isi: mati ? "—" : `( ${fmt(r.velocity1, 4)}² − ${fmt(r.velocity2, 4)}² ) / ( ${g2} ) − ${fmt(s.hilang, 5)}`,
      hasil: mati ? "—" : fmt(s.naik, 4),
      satuan: mati ? undefined : "m",
      tint: s.naik >= 0 ? C.water : undefined,
    },
    {
      judul: x.hPulih,
      rumus: (<><Frac num="Δp / γ" den="hv₁ − hv₂" /></>),
      isi: Number.isFinite(s.pulih) ? `${fmt(s.naik, 5)} / ( ${fmt(s.hv1, 5)} − ${fmt(s.hv2, 5)} ) · 100` : "—",
      hasil: fmt(s.pulih * 100, 1),
      satuan: Number.isFinite(s.pulih) ? "%" : undefined,
    },
    {
      judul: x.hF,
      rumus: <span>Fx = ( p₁A₁ + ρQV₁ ) − ( p₂A₂ + ρQV₂ )</span>,
      isi: mati
        ? "—"
        : `( ${fmt(r.pressureForce1 / 1000, 3)} + ${fmt(r.momentumIn / 1000, 3)} ) − ( ${fmt(r.pressureForce2 / 1000, 3)} + ${fmt(r.momentumOut / 1000, 3)} )`,
      hasil: mati ? "—" : fmt(r.Fx / 1000, 2),
      satuan: mati ? undefined : "kN",
    },
  ];
}

/*
 * Isi kalimatnya sama dengan catatan lama; kalimat pertama menyatakan
 * keadaan, sisanya butir. Butir "kuadrat selisih" dan "batas pembesaran
 * besar" hanya untuk pembesaran; penyempitan punya cabang sendiri (dulu
 * menulis "melepas −1,196 m … 0,000 m hilang"). Diameter pembanding
 * dibatasi ke maksimum penggeser 1 600 mm supaya dapat dicoba.
 */
function notice(
  Q: number,
  D1: number,
  D2: number,
  head: number,
  lang: Lang
): { state: string; notice: string[] } {
  const x = TXT[lang];
  const a = momentumForce(Q, D1, D2, head, 0);
  const hv1 = (a.velocity1 * a.velocity1) / (2 * G);
  const hv2 = (a.velocity2 * a.velocity2) / (2 * G);
  const naik = a.head2 - head;
  const hilang = a.expansionLoss + a.contractionLoss;
  const vMaks = Math.max(a.velocity1, a.velocity2);
  const cepat = vMaks > V_WASPADA ? x.vCepat(fmt(vMaks, 1)) : "";

  if (a.cavitates)
    return {
      state:
        lang === "id"
          ? "Tekanan sesudah penyempitan jatuh ke tekanan uap: kolom air putus, Δp/γ dan hL tidak ditulis."
          : "The pressure after the contraction falls to vapour pressure: the water column parts, so Δp/γ and hL are not written.",
      notice: [x.mendidihNote, cepat],
    };

  if (D2 === D1)
    return {
      state:
        lang === "id"
          ? "Penampang tetap: kecepatan, tekanan, dan energi tidak berubah, jadi tidak ada kehilangan dan tidak ada gaya pada dinding."
          : "Constant section: velocity, pressure and energy do not change, so there is no loss and no force on the wall.",
      notice: [cepat],
    };

  const state =
    lang === "id"
      ? `Δp/γ = ${fmt(naik, 3)} m, hL = ${fmt(hilang, 3)} m: ${(D2 > D1 ? x.tekananNaik : x.tekananTurun).toLowerCase()}.`
      : `Δp/γ = ${fmt(naik, 3)} m, hL = ${fmt(hilang, 3)} m: ${(D2 > D1 ? x.tekananNaik : x.tekananTurun).toLowerCase()}.`;

  if (D2 < D1) {
    const turun = hv2 - hv1;
    return {
      state,
      notice: [
        lang === "id"
          ? `Air dipercepat: tinggi kecepatannya naik ${fmt(turun, 3)} m, dan tinggi tekan membayarnya ditambah kehilangan ${fmt(hilang, 3)} m, jadi tekanannya turun ${fmt(-naik, 3)} m.`
          : `The water is accelerated: its velocity head rises by ${fmt(turun, 3)} m, and the pressure head pays for it plus a loss of ${fmt(hilang, 3)} m, so the pressure falls by ${fmt(-naik, 3)} m.`,
        lang === "id"
          ? "Kehilangan penyempitan jauh lebih kecil daripada pembesaran dengan nisbah yang sama, karena aliran yang dipercepat hampir tidak berolak; olakan hanya terjadi di vena contracta sesudah tepi tajamnya."
          : "A contraction loses far less than an enlargement of the same ratio, because accelerating flow hardly forms eddies; they appear only at the vena contracta just past the sharp edge.",
        cepat,
      ],
    };
  }

  /* Kehilangan yang keliru: selisih kuadrat, bukan kuadrat selisih. */
  const salah = hv1 - hv2;
  const D2Besar = Math.min(8 * D1, D2_MAKS);
  const besar = momentumForce(Q, D1, D2Besar, head, 0);
  const hvBesar = hv1;
  const mm = fmt(D2Besar * 1000, 0);
  const kali = fmt(D2Besar / D1, 1);

  if (lang === "en")
    return {
      state,
      notice: [
        `The water gives up ${fmt(hv1 - hv2, 3)} m of velocity head here and gets back ${fmt(naik, 3)} m of pressure head, so ${fmt(a.expansionLoss, 3)} m are simply gone.`,
        `Computing the loss as the difference of the squares rather than the square of the difference would have given ${fmt(salah, 3)} m, which is the whole of what was given up, and would have left no pressure rise at all.`,
        `Now push the downstream diameter to ${mm} mm (${kali} times the upstream one): the recovered head falls to ${fmt(besar.head2 - head, 4)} m while the loss climbs to ${fmt(besar.expansionLoss, 3)} m, approaching the full velocity head of ${fmt(hvBesar, 3)} m. That limit is the reason a pipe ending in a reservoir loses one whole velocity head.`,
        cepat,
      ],
    };
  return {
    state,
    notice: [
      `Airnya melepas ${fmt(hv1 - hv2, 3)} m tinggi kecepatan di sini dan mendapat kembali ${fmt(naik, 3)} m tinggi tekan, jadi ${fmt(a.expansionLoss, 3)} m memang hilang.`,
      `Menghitung kehilangannya sebagai selisih kuadrat dan bukan kuadrat selisih akan memberi ${fmt(salah, 3)} m, yaitu seluruh yang dilepas, dan tidak akan menyisakan kenaikan tekanan sama sekali.`,
      `Sekarang dorong diameter hilirnya sampai ${mm} mm (${kali} kali diameter hulunya): tinggi yang dipulihkan turun ke ${fmt(besar.head2 - head, 4)} m sementara kehilangannya naik ke ${fmt(besar.expansionLoss, 3)} m, mendekati tinggi kecepatan penuh sebesar ${fmt(hvBesar, 3)} m. Batas itulah sebabnya pipa yang bermuara ke waduk kehilangan satu tinggi kecepatan utuh.`,
      cepat,
    ],
  };
}
