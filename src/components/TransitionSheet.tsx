"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  Block,
  Hitungan,
  InputRow,
  InputTable,
  PresetRow,
  RegimeScale,
  ResultTable,
  SentuhContoh,
  Sheet,
  StateCard,
  type ResultRow,
} from "@/components/ui";
import { Verification } from "@/components/Verification";
import { DragLayer, type HandleSpec } from "@/components/DragLayer";
import { usePlate, usePutar } from "@/lib/usePlate";
import { useHalus } from "@/lib/useHalus";
import { keLangkah } from "@/lib/rentang";
import { drawTransition } from "@/lib/drawTransition";
import { Kuis } from "@/components/Kuis";
import type { BankKuis, Keadaan } from "@/lib/kuis";
// Rentang penggeser satu sumber dengan bank kuis OC-05.
import { P_B1, P_B2, P_Q, P_Y1 } from "@/data/kuis/oc05";
import {
  createTransitionMotion,
  drawTransitionMotion,
  panjangDenah,
  transitionFlow,
  type TransitionMotion,
} from "@/lib/drawTransitionMotion";
import { reachTimeScale } from "@/lib/drawReachMotion";
import { G, fmt, transition } from "@/lib/hydraulics";
import { checksTransition } from "@/lib/checks";
import { C, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";

/**
 * Tiga lembar transisi dibangun dari satu komponen.
 *
 * Perubahan elevasi dasar, perubahan lebar, dan peralihan melewati kondisi
 * kritis adalah persoalan yang sama: energi spesifik yang tersedia di hilir
 * dibandingkan dengan energi minimum yang dibutuhkan di sana. Yang berbeda
 * hanya masukan mana yang ditonjolkan dan pertanyaan apa yang dijawab.
 *
 * Ini contoh langsung dari keluarga penggambar di PRD: menambah lembar dalam
 * keluarga yang sudah ada berarti menambah teks dan pilihan masukan, bukan
 * membangun dari nol.
 */
export type TransitionMode = "step" | "width" | "critical";

export type TransitionTxt = {
  title: string;
  sheetTitle: string;
  dQ: string;
  db1: string;
  dy1: string;
  db2: string;
  ddz: string;
  note: string;
};

/*
 * Ambang "hampir tersendat" 12 % adalah batas lembar ini, bukan angka
 * terbitan. Batas 0 (E₂ = Emin) dari Chow 1959 Bab 3 dan Henderson 1966 §2.
 * Pita cadangan −50 sampai 100 %: penggeser dapat memberi cadangan sangat
 * negatif (sampai −3·10¹¹ %), penanda lalu menempel di ujung kiri dengan
 * keterangan "di luar skala".
 */
const BATAS_HAMPIR = 12;

/*
 * Rentang Q, b₁, y₁, b₂ (data/kuis/oc05.ts): satu definisi untuk penggeser,
 * kotak angka, pegangan dinding di tampak atas OC-05 (aturan 4, satu sumber
 * nilai), dan bank kuis OC-05.
 */

export function TransitionSheet({
  sheet,
  mode,
  txt,
  refs,
  intro,
  awal,
  kuis,
}: {
  sheet: string;
  mode: TransitionMode;
  txt: { id: TransitionTxt; en: TransitionTxt };
  refs: { id: readonly string[]; en: readonly string[] };
  intro: (lang: Lang) => ReactNode;
  awal: { Q: number; b1: number; y1: number; b2: number; dz: number };
  /** Bank kuis lembar; masukannya Q, b1, y1, b2 (Δz kuis selalu 0). */
  kuis?: BankKuis;
}) {
  const { lang } = useLang();
  const t = str(lang);
  const x = txt[lang];
  const u = UMUM[lang];

  const [Q, setQ] = useState(awal.Q);
  const [b1, setB1] = useState(awal.b1);
  const [y1, setY1] = useState(awal.y1);
  const [b2, setB2] = useState(awal.b2);
  const [dz, setDz] = useState(awal.dz);

  // Lebar dan elevasi dikunci pada lembar yang tidak membahasnya, supaya
  // pertanyaan yang dijawab tiap lembar tetap satu.
  const b2Efektif = mode === "step" ? b1 : b2;
  const dzEfektif = mode === "width" ? 0 : dz;

  const r = transition({ Q, b1, y1, b2: b2Efektif, dz: dzEfektif });
  const cadangan = (1 - r.chokeRatio) * 100;
  const keadaan = bacaKeadaan(mode, r, lang, { y1, b1, b2: b2Efektif, dz: dzEfektif });

  /*
   * OC-07: muka air turun/naik dengan easing. Yang dianimasikan MASUKAN Δz
   * (useHalus), dan model dihitung ulang tiap frame dengan Δz antara, jadi
   * tiap gambar antara adalah keadaan tunak yang sah. Tabel, kop, dan kartu
   * tetap memakai Δz sasaran. Reduced-motion: langsung, tanpa frame antara.
   */
  const dzTampil = useHalus(dzEfektif, mode === "step");
  const rTampil =
    dzTampil === dzEfektif ? r : transition({ Q, b1, y1, b2: b2Efektif, dz: dzTampil });

  /*
   * OC-05: lapis gerak dan pegangan dinding. Partikel bergerak dengan
   * V = Q/(b·y) model di penampang 1 dan 2 (kontinuitas pada geometri
   * tergambar di antaranya, drawTransitionMotion.ts). Tersendat: kedalaman
   * yang tergambar bukan kedalaman yang terjadi, jadi tanpa gerak dan tanpa
   * tombol (transitionFlow null). Saat dijeda, lapis statis menggambar panah
   * arah aliran diam di sumbu tampak atas.
   */
  const gerakAktif = mode === "width";
  const { playing, toggle: togglePutar } = usePutar();
  const gerak = useRef<TransitionMotion | null>(null);
  if (gerak.current === null) gerak.current = createTransitionMotion(220);
  // Panjang bentang tergambar (m), dibaca dari peta tampak atas sesudah
  // lapis statis digambar; berubah hanya saat ukuran atau skala berubah.
  const [panjang, setPanjang] = useState<number | null>(null);
  const aliran = useMemo(
    () =>
      gerakAktif && panjang !== null
        ? transitionFlow({ r, b1, b2: b2Efektif, y1, dz: dzEfektif }, Q, panjang)
        : null,
    // r dihitung ulang dari masukan yang sama; deps primitif.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gerakAktif, panjang, Q, b1, y1, b2Efektif, dzEfektif]
  );
  const skalaWaktu = aliran ? reachTimeScale(aliran.crossTime) : 1;
  const panah = gerakAktif && !playing && !r.choked;

  /*
   * Skala tampak atas dikunci selama dinding diseret. Tanpa kunci, skala
   * tegaknya max(b₁, b₂): dinding yang diseret melebar akan tetap di tepi
   * panel dan pegangannya saling kejar dengan skala. Dilepas = skala kembali
   * dihitung dari nilainya.
   */
  const [kunci, setKunci] = useState<number | null>(null);
  const sentuh = useRef<() => void>(() => {});

  // Kuis memasang masukan soal lewat setter penggeser yang sama dan
  // memadamkan tanda contoh seperti geseran biasa.
  const terapkanKuis = (m: Keadaan) => {
    sentuh.current();
    if (m.Q !== undefined) setQ(keLangkah(m.Q, P_Q));
    if (m.b1 !== undefined) setB1(keLangkah(m.b1, P_B1));
    if (m.y1 !== undefined) setY1(keLangkah(m.y1, P_Y1));
    if (m.b2 !== undefined) setB2(keLangkah(m.b2, P_B2));
  };

  const plate = usePlate(
    (ctx, w, h) =>
      drawTransition(
        ctx,
        w,
        h,
        { r: rTampil, b1, b2: b2Efektif, y1, dz: dzTampil },
        lang,
        { bMaxKunci: kunci ?? undefined, panah }
      ),
    aliran
      ? (ctx, _w, _h, _t, dt, out) =>
          drawTransitionMotion(ctx, dt, out, aliran, skalaWaktu, gerak.current!)
      : null,
    [Q, b1, y1, b2Efektif, dzTampil, lang, panah, kunci ?? NaN],
    { playing, timeScale: skalaWaktu }
  );

  useEffect(() => {
    if (!gerakAktif) return;
    const L = panjangDenah(plate.outRef.current);
    // Dibulatkan ke mm supaya ukuran piksel yang sama tidak memicu aliran baru.
    setPanjang(L === null ? null : Math.round(L * 1000) / 1000);
  }, [gerakAktif, plate.version, plate.outRef]);

  const faktor = (v: number) => v.toLocaleString(lang === "id" ? "id-ID" : "en-US");
  const catatanGerak =
    u.motion +
    (skalaWaktu === 1
      ? u.motionReal
      : skalaWaktu > 1
        ? u.motionFast(faktor(skalaWaktu))
        : u.motionSlow(faktor(Math.round(1 / skalaWaktu))));

  /*
   * Pemetaan balik pegangan dinding: sumbu tegak peta tampak atas adalah
   * jarak dari sumbu saluran (m, positif ke atas), dan tepi atas dinding
   * berada di b/2, jadi b = 2 · invY(py). Hanya tegak.
   */
  const keLebar = (py: number, cadang: number) => {
    const m = plate.outRef.current?.maps?.plan;
    return m ? 2 * m.invY(py) : cadang;
  };
  const handles: HandleSpec[] =
    mode === "width"
      ? [
          {
            id: "b1",
            anchor: "b1Grip",
            axis: "y",
            label: u.gB1,
            param: P_B1,
            value: b1,
            toValue: (_px, py) => keLebar(py, b1),
            onChange: setB1,
            format: (v) => `b₁ ${fmt(v, 1)} m`,
          },
          {
            id: "b2",
            anchor: "b2Grip",
            axis: "y",
            label: u.gB2,
            param: P_B2,
            value: b2,
            tint: C.critical,
            toValue: (_px, py) => keLebar(py, b2),
            onChange: setB2,
            format: (v) => `b₂ ${fmt(v, 1)} m`,
          },
        ]
      : [];
  const kunciSkala = () => setKunci(Math.max(b1, b2Efektif));
  const lepasKunci = () => setKunci(null);

  /* Baris hasil. Cadangan energi selalu angka utama; angka utama kedua
     menjawab pertanyaan lembarnya: Δzmax untuk ambang, b₂min untuk
     penyempitan, y₂ untuk lembar gabungan. Batas yang masukannya dikunci
     tidak ditampilkan karena tidak menjawab apa pun di lembar itu. */
  const baris: ResultRow[] = [
    {
      label: u.rMargin,
      value: fmt(cadangan, 1),
      unit: "%",
      tint: r.choked ? C.signal : undefined,
      strong: true,
    },
    ...(mode === "step"
      ? [{ symbol: "Δzmax", label: u.rDzMax, value: fmt(r.dzMax, 3), unit: "m", tint: C.critical, strong: true }]
      : []),
    ...(mode === "width"
      ? [{ symbol: "b₂min", label: u.rB2Min, value: fmt(r.b2Min, 2), unit: "m", tint: C.critical, strong: true }]
      : []),
    {
      symbol: "y₂",
      label: u.rY2,
      value: r.choked ? "—" : fmt(r.y2, 3),
      unit: r.choked ? undefined : "m",
      tint: C.water,
      strong: mode === "critical",
    },
    { symbol: "Fr₂", label: u.rFr2, value: r.choked ? fmt(1, 3) : fmt(r.Fr2, 3) },
    { symbol: "E₁", label: u.rE1, value: fmt(r.E1, 3), unit: "m", tint: C.energy },
    { symbol: "E₂", label: u.rE2, value: fmt(r.E2, 3), unit: "m", tint: C.energy },
    { symbol: "Emin", label: u.rEmin, value: fmt(r.Emin2, 3), unit: "m", tint: C.critical },
    { symbol: "yc₂", label: u.rYc2, value: fmt(r.yc2, 3), unit: "m", tint: C.critical },
    { symbol: "q₂", label: u.rQ2, value: fmt(r.q2, 3), unit: "m²/s" },
    { symbol: "Fr₁", label: u.rFr1, value: fmt(r.Fr1, 3) },
    ...(mode === "critical"
      ? [
          { symbol: "Δzmax", label: u.rDzMax, value: fmt(r.dzMax, 3), unit: "m", tint: C.critical },
          { symbol: "b₂min", label: u.rB2Min, value: fmt(r.b2Min, 2), unit: "m", tint: C.critical },
        ]
      : []),
  ];

  const g = fmt(G, 2);
  const langkahBatas = [
    ...(mode !== "width"
      ? [
          {
            judul: u.rDzMax,
            rumus: <span>Δzmax = E₁ − Emin</span>,
            isi: `${fmt(r.E1, 4)} − ${fmt(r.Emin2, 4)}`,
            hasil: fmt(r.dzMax, 3),
            satuan: "m",
            tint: C.critical,
          },
        ]
      : []),
    ...(mode !== "step"
      ? [
          {
            judul: u.rB2Min,
            rumus: (
              <>
                <span>b₂min =</span>
                <Frac num="Q" den={<>√( g · ( E₂ / {fmt(1.5, 1)} )³ )</>} />
              </>
            ),
            isi: `${fmt(Q, 1)} / √( ${g} · ( ${fmt(r.E2, 4)} / ${fmt(1.5, 1)} )³ )`,
            hasil: fmt(r.b2Min, 2),
            satuan: "m",
            tint: C.critical,
          },
        ]
      : []),
  ];

  return (
    <LabShell
      status={
        <div className="flex flex-col gap-2">
          <RegimeScale
            symbol={u.symMarginScale}
            value={cadangan}
            invalid={r.choked}
            scale="lin"
            digits={1}
            bands={[
              { from: -50, to: 0, label: u.choked, tone: "invalid" },
              { from: 0, to: BATAS_HAMPIR, label: u.pHampir, tone: "caution" },
              { from: BATAS_HAMPIR, to: 100, label: u.bandCukup, tone: "pass" },
            ]}
          />
          <RegimeScale
            symbol="Fr₁"
            value={r.Fr1}
            scale="log"
            digits={2}
            bands={[
              { from: 0.01, to: 1, label: u.sub, tone: "water" },
              { from: 1, to: 100, label: u.sup, tone: "neutral" },
            ]}
          />
        </div>
      }
      sheet={sheet}
      subject={SUBJECTS.OC[lang]}
      title={x.title}
      intro={intro(lang)}
      drawing={
        <Sheet
          number={sheet}
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "q₂", value: `${fmt(r.q2, 3)} m²/s` },
            { label: "yc₂", value: `${fmt(r.yc2, 3)} m`, tint: C.critical },
            { label: "Fr₂", value: r.choked ? fmt(1, 2) : fmt(r.Fr2) },
            {
              label: t.tbRegime,
              value: r.choked
                ? u.choked
                : r.branch === "subkritis"
                  ? u.sub
                  : u.sup,
              tint: r.choked ? C.signal : undefined,
            },
          ]}
          motion={
            gerakAktif
              ? {
                  playing,
                  onToggle: togglePutar,
                  allowed: plate.motionAllowed,
                  note: catatanGerak,
                }
              : undefined
          }
        >
          <canvas ref={plate.ref} className="block h-full w-full" />
          <canvas ref={plate.motionRef} />
          {handles.length > 0 && (
            /* display: contents, jadi pembungkus tidak membuat kotak; hanya
               menangkap pointerdown/lepas yang menggelembung dari pegangan
               untuk mengunci skala tampak atas. */
            <div
              className="contents"
              onPointerDown={(e) => {
                // Hanya tombol utama: DragLayer mengabaikan klik lain, jadi
                // tanpa capture tidak ada pelepas dan kunci akan tertinggal.
                if (e.pointerType === "mouse" && e.button !== 0) return;
                if (kunci !== null) return; // jari kedua tidak mengambil kunci baru
                kunciSkala();
              }}
              onPointerUp={lepasKunci}
              onPointerCancel={lepasKunci}
              onLostPointerCapture={lepasKunci}
            >
              <DragLayer out={plate.outRef.current} handles={handles} touch={() => sentuh.current()} />
            </div>
          )}
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q} {...P_Q} unit="m³/s" onChange={setQ} tint={C.water} />
              <InputRow symbol="b₁" label={x.db1} value={b1} {...P_B1} unit="m" onChange={setB1} />
              <InputRow symbol="y₁" label={x.dy1} value={y1} {...P_Y1} unit="m" onChange={setY1} tint={C.water} />
              {mode !== "step" && (
                <InputRow symbol="b₂" label={x.db2} value={b2} {...P_B2} unit="m" onChange={setB2} tint={C.critical} />
              )}
              {mode !== "width" && (
                <InputRow symbol="Δz" label={x.ddz} value={dz} min={-0.5} max={1.5} step={0.005} digits={3} unit="m" onChange={setDz} tint={C.critical} />
              )}
            </InputTable>

            {handles.length > 0 && <SentuhContoh sentuh={sentuh} />}
            <div className="mt-3.5 flex flex-col gap-2.5">
              <PresetRow
                label={t.presetExample}
                presets={preset(mode, u, {
                  setQ, setB1, setY1, setB2, setDz,
                })}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable rows={baris} />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: u.hQ,
                    rumus: (
                      <>
                        <span>q₁ =</span>
                        <Frac num="Q" den="b₁" />
                        <span className="ml-3">q₂ =</span>
                        <Frac num="Q" den="b₂" />
                      </>
                    ),
                    isi:
                      mode === "step"
                        ? `${fmt(Q, 1)} / ${fmt(b1, 1)} = ${fmt(r.q1, 4)} m²/s; ${u.hSamaLebar}`
                        : `${fmt(Q, 1)} / ${fmt(b1, 1)} = ${fmt(r.q1, 4)} m²/s; ${fmt(Q, 1)} / ${fmt(b2Efektif, 1)}`,
                    hasil: `q₂ = ${fmt(r.q2, 3)}`,
                    satuan: "m²/s",
                  },
                  {
                    judul: u.hE,
                    rumus: (
                      <>
                        <span>E₁ = y₁ +</span>
                        <Frac num="q₁²" den="2 · g · y₁²" />
                        <span className="ml-3">E₂ = E₁ − Δz</span>
                      </>
                    ),
                    isi:
                      `${fmt(y1, 2)} + ${fmt(r.q1, 4)}² / ( 2 · ${g} · ${fmt(y1, 2)}² ) = ${fmt(r.E1, 4)} m; ` +
                      (mode === "width" ? u.hTanpaAmbang : `${fmt(r.E1, 4)} − ${fmt(dzEfektif, 3)}`),
                    hasil: `E₂ = ${fmt(r.E2, 3)}`,
                    satuan: "m",
                    tint: C.energy,
                  },
                  {
                    judul: u.hEmin,
                    rumus: (
                      <>
                        <span>yc₂ =</span>
                        <Frac num="∛( q₂² )" den="∛g" />
                        <span className="ml-3">Emin = {fmt(1.5, 1)} · yc₂</span>
                        <span className="ml-3">{u.symMargin} = 1 − Emin / E₂</span>
                      </>
                    ),
                    isi: `∛( ${fmt(r.q2, 4)}² / ${g} ) = ${fmt(r.yc2, 4)} m; ${fmt(1.5, 1)} · ${fmt(r.yc2, 4)} = ${fmt(r.Emin2, 4)} m; 1 − ${fmt(r.Emin2, 4)} / ${fmt(r.E2, 4)}`,
                    hasil: fmt(cadangan, 1),
                    satuan: "%",
                    tint: r.choked ? C.signal : undefined,
                  },
                  {
                    judul: r.choked
                      ? u.hY2Tersendat
                      : r.branch === "subkritis"
                        ? u.hY2Sub
                        : u.hY2Sup,
                    rumus: (
                      <>
                        <span>E₂ = y₂ +</span>
                        <Frac num="q₂²" den="2 · g · y₂²" />
                        <span className="ml-3">Fr₂ =</span>
                        <Frac num="q₂" den="y₂ · √( g · y₂ )" />
                      </>
                    ),
                    isi: r.choked
                      ? `E₂ = ${fmt(r.E2, 4)} m < Emin = ${fmt(r.Emin2, 4)} m`
                      : `y₂ = ${fmt(r.y2, 4)} m; ${fmt(r.q2, 4)} / ( ${fmt(r.y2, 4)} · √( ${g} · ${fmt(r.y2, 4)} ) )`,
                    hasil: r.choked ? "—" : `Fr₂ = ${fmt(r.Fr2, 3)}`,
                    tint: C.water,
                  },
                  ...langkahBatas,
                ]}
              />
            </div>
          </Block>

          <StateCard tone={keadaan.tone} badge={keadaan.badge} state={keadaan.state} notice={keadaan.notice} />

          {kuis && (
            <Kuis
              bank={kuis}
              keadaan={{ Q, b1, y1, b2 }}
              onTerapkan={terapkanKuis}
              label={{
                Q: { simbol: "Q", satuan: "m³/s", digits: 1 },
                b1: { simbol: "b₁", satuan: "m", digits: 1 },
                y1: { simbol: "y₁", satuan: "m", digits: 2 },
                b2: { simbol: "b₂", satuan: "m", digits: 1 },
              }}
            />
          )}
        </>
      }
      verification={
        <Verification checks={checksTransition(Q, b1, y1, b2Efektif, dzEfektif)} />
      }
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>E = y +</span>
                <Frac num="q²" den="2 · g · y²" />
                <span className="ml-5">E₂ = E₁ − Δz</span>
              </Eq>
              <Eq>
                <span>Emin = {fmt(1.5, 1)} · yc</span>
                <span className="ml-5">Δzmax = E₁ − Emin₂</span>
              </Eq>
              <Eq>
                <span>b₂min =</span>
                <Frac num="Q" den={<>√( g · ( E₂ / {fmt(1.5, 1)} )³ )</>} />
              </Eq>
            </>
          }
          note={x.note}
          refs={[...refs[lang]]}
        />
      }
    />
  );
}

/* ------------------------------------------------------------------ *
 * Teks yang sama untuk ketiga lembar
 * ------------------------------------------------------------------ */

const UMUM = {
  id: {
    sub: "Subkritis",
    sup: "Superkritis",
    choked: "Tersendat",
    bandCukup: "Cadangan cukup",
    symMargin: "cadangan",
    symMarginScale: "Cadangan energi (%)",
    rMargin: "Cadangan energi sebelum tersendat",
    rY2: "Kedalaman hilir",
    rFr2: "Froude hilir",
    rE1: "Energi spesifik hulu",
    rE2: "Energi tersedia di hilir",
    rEmin: "Energi minimum yang dibutuhkan",
    rYc2: "Kedalaman kritis hilir",
    rQ2: "Debit satuan hilir",
    rFr1: "Froude hulu",
    rDzMax: "Kenaikan dasar terbesar",
    rB2Min: "Lebar tersempit",
    pAman: "Aman",
    pHampir: "Hampir tersendat",
    pTersendat: "Tersendat",
    pSuper: "Aliran superkritis",
    hQ: "Debit satuan hulu dan hilir",
    hSamaLebar: "b₂ = b₁ (lebar tetap)",
    hE: "Energi spesifik hulu dan energi tersedia di hilir",
    hTanpaAmbang: "Δz = 0, E₂ = E₁",
    hEmin: "Kedalaman kritis, energi minimum, dan cadangan di hilir",
    hY2Sub: "Kedalaman hilir pada cabang subkritis (bagi dua)",
    hY2Sup: "Kedalaman hilir pada cabang superkritis (bagi dua)",
    hY2Tersendat: "E₂ < Emin: tidak ada y₂ yang memenuhi",
    gesekan: "Gesekan pada bentang transisi diabaikan (transisi pendek).",
    gB1: "Lebar hulu b₁, seret dinding saluran di tampak atas ke atas atau ke bawah",
    gB2: "Lebar hilir b₂, seret dinding saluran di tampak atas ke atas atau ke bawah",
    motion:
      "partikel bergerak dengan V = Q/(b·y) penampang, denah berskala sama ke dua arah; warna makin pekat makin cepat, satu tingkat per 20 % terhadap V₁, 5 tingkat dengan ujung jenuh; panah saat dijeda hanya menunjukkan arah; ",
    motionReal: "waktu nyata",
    motionFast: (n: string) => `waktu dipercepat ×${n}`,
    motionSlow: (n: string) => `waktu diperlambat ×${n}`,
  },
  en: {
    sub: "Subcritical",
    sup: "Supercritical",
    choked: "Choked",
    bandCukup: "Adequate margin",
    symMargin: "margin",
    symMarginScale: "Energy margin (%)",
    rMargin: "Energy margin before choking",
    rY2: "Downstream depth",
    rFr2: "Downstream Froude",
    rE1: "Upstream specific energy",
    rE2: "Energy available downstream",
    rEmin: "Minimum energy required",
    rYc2: "Downstream critical depth",
    rQ2: "Downstream unit discharge",
    rFr1: "Upstream Froude",
    rDzMax: "Maximum bed rise",
    rB2Min: "Narrowest width",
    pAman: "Clear",
    pHampir: "Near choking",
    pTersendat: "Choked",
    pSuper: "Supercritical flow",
    hQ: "Upstream and downstream unit discharge",
    hSamaLebar: "b₂ = b₁ (constant width)",
    hE: "Upstream specific energy and energy available downstream",
    hTanpaAmbang: "Δz = 0, E₂ = E₁",
    hEmin: "Critical depth, minimum energy and margin downstream",
    hY2Sub: "Downstream depth on the subcritical branch (bisection)",
    hY2Sup: "Downstream depth on the supercritical branch (bisection)",
    hY2Tersendat: "E₂ < Emin: no y₂ satisfies the equation",
    gesekan: "Friction over the transition reach is neglected (short transition).",
    gB1: "Upstream width b₁, drag the channel wall in plan view up or down",
    gB2: "Downstream width b₂, drag the channel wall in plan view up or down",
    motion:
      "particles move at the section velocity V = Q/(b·y), plan drawn to the same scale both ways; darker means faster, one step per 20 % relative to V₁, 5 steps with saturated ends; arrows when paused show direction only; ",
    motionReal: "real time",
    motionFast: (n: string) => `time sped up ×${n}`,
    motionSlow: (n: string) => `time slowed ×${n}`,
  },
} as const;

// Nilainya dilonggarkan menjadi string biasa, karena `as const` membuat kedua
// bahasa punya tipe harfiah yang berbeda dan tidak saling tertukar.
type Umum = {
  [K in keyof (typeof UMUM)["id"]]: (typeof UMUM)["id"][K] extends (n: string) => string
    ? (n: string) => string
    : string;
};

/*
 * Tombol OC-04 dihitung ulang (spesifikasi B2, CACAT 1): nilai lama "Aman"
 * (b₂ 4,5, Δz 0,1) memberi cadangan 11,96 %, di bawah batas hampir
 * tersendat, dan "Hampir tersendat" (b₂ 4, Δz 0,24) sudah tersendat
 * (−4,8 %). Sekarang 15,98 % dan 2,73 %.
 */
function preset(
  mode: TransitionMode,
  u: Umum,
  set: {
    setQ: (v: number) => void;
    setB1: (v: number) => void;
    setY1: (v: number) => void;
    setB2: (v: number) => void;
    setDz: (v: number) => void;
  }
) {
  const dasar = () => {
    set.setQ(12);
    set.setB1(5);
    set.setY1(1.5);
  };
  const supers = () => {
    set.setQ(12);
    set.setB1(5);
    set.setY1(0.45);
  };

  if (mode === "width") {
    return [
      { label: u.pAman, apply: () => { dasar(); set.setB2(4.5); } },
      { label: u.pHampir, apply: () => { dasar(); set.setB2(3.45); } },
      { label: u.pTersendat, apply: () => { dasar(); set.setB2(2.8); } },
      { label: u.pSuper, apply: () => { supers(); set.setB2(4.5); } },
    ];
  }
  if (mode === "step") {
    return [
      { label: u.pAman, apply: () => { dasar(); set.setDz(0.15); } },
      { label: u.pHampir, apply: () => { dasar(); set.setDz(0.36); } },
      { label: u.pTersendat, apply: () => { dasar(); set.setDz(0.55); } },
      { label: u.pSuper, apply: () => { supers(); set.setDz(0.1); } },
    ];
  }
  return [
    { label: u.pAman, apply: () => { dasar(); set.setB2(4.6); set.setDz(0.05); } },
    { label: u.pHampir, apply: () => { dasar(); set.setB2(4.2); set.setDz(0.18); } },
    { label: u.pTersendat, apply: () => { dasar(); set.setB2(3.5); set.setDz(0.45); } },
    { label: u.pSuper, apply: () => { supers(); set.setB2(4.5); set.setDz(0.1); } },
  ];
}

/* ------------------------------------------------------------------ *
 * Kartu keadaan
 * ------------------------------------------------------------------ */

/**
 * Sebutan bagi tindakan yang MEMPERKECIL cadangan energi, menurut mode
 * lembar, untuk kalimat "sedikit saja … sudah cukup". Kalimat itu tetap
 * benar ke mana pun penggesernya digeser, karena ia berbicara tentang
 * langkah berikutnya menuju tersendat.
 */
function sebutan(mode: TransitionMode, lang: Lang) {
  if (lang === "en") {
    return {
      width: "a little more narrowing",
      step: "a slightly higher step",
      critical: "a little more narrowing or a slightly higher step",
    }[mode];
  }
  return {
    width: "sedikit saja penyempitan tambahan",
    step: "sedikit saja tambahan tinggi ambang",
    critical: "sedikit saja penyempitan tambahan atau ambang yang lebih tinggi",
  }[mode];
}

/**
 * Tindakan yang benar-benar terjadi di layar, dibangun dari tanda
 * (b₂ − b₁) dan Δz (spesifikasi B2, CACAT 4). Kalimat lama selalu menyebut
 * "menyempitkan" dan "menaikkan dasar", juga saat penggesernya melebarkan
 * saluran atau menurunkan dasar.
 */
function tindakan(
  mode: TransitionMode,
  lang: Lang,
  m: { b1: number; b2: number; dz: number }
): string[] {
  const en = lang === "en";
  const daftar: string[] = [];
  if (mode !== "step") {
    if (m.b2 < m.b1) daftar.push(en ? "narrowing the channel" : "penyempitan saluran");
    else if (m.b2 > m.b1) daftar.push(en ? "widening the channel" : "pelebaran saluran");
  }
  if (mode !== "width") {
    if (m.dz > 0) daftar.push(en ? "raising the bed" : "kenaikan dasar");
    else if (m.dz < 0) daftar.push(en ? "lowering the bed" : "penurunan dasar");
  }
  return daftar;
}

function bacaKeadaan(
  mode: TransitionMode,
  r: ReturnType<typeof transition>,
  lang: Lang,
  m: { y1: number; b1: number; b2: number; dz: number }
): { tone: Tone; badge: string; state: string; notice: string[] } {
  const en = lang === "en";
  const u = UMUM[lang];
  const sisa = (1 - r.chokeRatio) * 100;
  const naik = r.y2 > m.y1;
  const beda = Math.abs(r.y2 - m.y1);
  const aksi = tindakan(mode, lang, m);
  const aksiTeks = aksi.join(en ? " and " : " dan ");

  if (r.choked) {
    /* Sebab tersendat (CACAT 3). Pada lembar gabungan, Δzmax ≤ 0 berarti
       lebar b₂ itu sendiri sudah terlalu sempit, bahkan tanpa ambang;
       menyebut "kenaikan dasar di atas Δzmax negatif" menyesatkan. */
    let sebab: string;
    if (mode === "width") {
      sebab = en
        ? `The width b₂ = ${fmt(m.b2, 1)} m is below the narrowest passable width b₂min = ${fmt(r.b2Min, 2)} m.`
        : `Lebar b₂ = ${fmt(m.b2, 1)} m di bawah lebar tersempit yang masih dapat dilewati, b₂min = ${fmt(r.b2Min, 2)} m.`;
    } else if (mode === "step") {
      sebab = en
        ? `The bed rise Δz = ${fmt(m.dz, 3)} m exceeds the largest passable rise Δzmax = ${fmt(r.dzMax, 3)} m.`
        : `Kenaikan dasar Δz = ${fmt(m.dz, 3)} m melebihi kenaikan terbesar yang masih dapat dilewati, Δzmax = ${fmt(r.dzMax, 3)} m.`;
    } else if (r.dzMax <= 0) {
      sebab = en
        ? `The width b₂ = ${fmt(m.b2, 1)} m is below b₂min = ${fmt(r.b2Min, 2)} m; even without any bed rise this width cannot pass the flow (Δzmax = ${fmt(r.dzMax, 3)} m).`
        : `Lebar b₂ = ${fmt(m.b2, 1)} m di bawah b₂min = ${fmt(r.b2Min, 2)} m; bahkan tanpa kenaikan dasar, lebar ini tidak dapat melewatkan alirannya (Δzmax = ${fmt(r.dzMax, 3)} m).`;
    } else {
      sebab = en
        ? `At this width the bed rise may be at most Δzmax = ${fmt(r.dzMax, 3)} m (it is ${fmt(m.dz, 3)} m); at this bed rise the width must be at least b₂min = ${fmt(r.b2Min, 2)} m (it is ${fmt(m.b2, 1)} m).`
        : `Pada lebar ini kenaikan dasar paling besar Δzmax = ${fmt(r.dzMax, 3)} m (sekarang ${fmt(m.dz, 3)} m); pada kenaikan dasar ini lebarnya paling kecil b₂min = ${fmt(r.b2Min, 2)} m (sekarang ${fmt(m.b2, 1)} m).`;
    }
    return {
      tone: "invalid",
      badge: u.choked,
      state: en
        ? `Choked: E₂ = ${fmt(r.E2, 3)} m < Emin = ${fmt(r.Emin2, 3)} m. The transition cannot pass Q at this y₁; the upstream water level will rise.`
        : `Tersendat: E₂ = ${fmt(r.E2, 3)} m < Emin = ${fmt(r.Emin2, 3)} m. Transisi tidak dapat melewatkan Q pada y₁ ini; muka air hulu akan naik.`,
      notice: [
        sebab,
        en
          ? "The y₂ figure no longer applies, which is why it is shown as a dash rather than a number."
          : "Angka y₂ tidak berlaku lagi, karena itu ditampilkan sebagai garis, bukan angka.",
        u.gesekan,
      ],
    };
  }

  /* Arah perubahan kedalaman dibaca dari kurva energi. Pada cabang atas
     (subkritis) kedalaman turun bila energi tersedia berkurang atau debit
     satuan naik; pada cabang bawah (superkritis) kebalikannya. Arah yang
     ditulis adalah arah yang benar-benar dihitung model. */
  const arah = (() => {
    if (aksi.length === 0)
      return en
        ? "Width and bed level are unchanged, so the depth stays as it is."
        : "Lebar dan elevasi dasar tidak berubah, jadi kedalamannya tetap.";
    if (r.branch === "subkritis")
      return en
        ? `On the upper (subcritical) branch of the energy curve the depth falls when available energy drops or unit discharge rises, and rises in the opposite case. Here ${aksiTeks} ${naik ? "raises" : "lowers"} the water surface on balance.${!naik && (m.b2 < m.b1 || m.dz > 0) ? " This is the direction people find surprising: a contraction or a step in subcritical flow lowers the water rather than raising it." : ""}`
        : `Pada cabang atas (subkritis) kurva energi, kedalaman turun bila energi tersedia berkurang atau debit satuan naik, dan naik bila sebaliknya. Di sini ${aksiTeks} secara bersih ${naik ? "menaikkan" : "menurunkan"} muka air.${!naik && (m.b2 < m.b1 || m.dz > 0) ? " Arah inilah yang sering mengejutkan: penyempitan atau ambang pada aliran subkritis menurunkan muka air, bukan menaikkannya." : ""}`;
    return en
      ? `On the lower (supercritical) branch it works the other way: the depth rises when available energy drops or unit discharge rises. Here ${aksiTeks} ${naik ? "raises" : "lowers"} the water surface on balance, against intuition from subcritical flow.`
      : `Pada cabang bawah (superkritis) berlaku kebalikannya: kedalaman naik bila energi tersedia berkurang atau debit satuan naik. Di sini ${aksiTeks} secara bersih ${naik ? "menaikkan" : "menurunkan"} muka air, berlawanan dengan naluri dari aliran subkritis.`;
  })();

  const hampir =
    sisa < BATAS_HAMPIR
      ? en
        ? `At only ${fmt(sisa, 1)} per cent margin, ${sebutan(mode, lang)} tips the flow through critical, and the upstream level starts to rise. In design this is the boundary worth staying away from, not the one to sit on. The ${BATAS_HAMPIR} per cent line is this sheet's own threshold, not a published value.`
        : `Dengan cadangan ${fmt(sisa, 1)} persen, ${sebutan(mode, lang)} sudah cukup melemparkan aliran melewati kondisi kritis, dan muka air hulu mulai naik. Dalam desain, batas ini untuk dijauhi, bukan untuk ditempati. Garis ${BATAS_HAMPIR} persen adalah batas lembar ini, bukan angka terbitan.`
      : null;

  const kedalaman = en
    ? `depth ${naik ? "rises" : "falls"} by ${fmt(beda, 3)} m`
    : `kedalaman ${naik ? "naik" : "turun"} ${fmt(beda, 3)} m`;

  if (r.branch === "superkritis") {
    return {
      tone: "neutral",
      badge: u.sup,
      state: en
        ? `Supercritical (Fr₁ = ${fmt(r.Fr1, 2)}): ${kedalaman}.`
        : `Superkritis (Fr₁ = ${fmt(r.Fr1, 2)}): ${kedalaman}.`,
      notice: [arah, ...(hampir ? [hampir] : []), u.gesekan],
    };
  }
  if (hampir) {
    return {
      tone: "caution",
      badge: u.pHampir,
      state: en
        ? `Subcritical, margin down to ${fmt(sisa, 1)} %; ${kedalaman}.`
        : `Subkritis, cadangan tinggal ${fmt(sisa, 1)} %; ${kedalaman}.`,
      notice: [hampir, arah, u.gesekan],
    };
  }
  return {
    tone: "pass",
    badge: u.sub,
    state: en
      ? `Subcritical: ${kedalaman}, margin ${fmt(sisa, 1)} %.`
      : `Subkritis: ${kedalaman}, cadangan ${fmt(sisa, 1)} %.`,
    notice: [arah, u.gesekan],
  };
}
