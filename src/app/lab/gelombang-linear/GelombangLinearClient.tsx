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
import { drawField, type FieldLine, type FieldMarker } from "@/lib/drawField";
import {
  G,
  WAVE_BREAKER_INDEX,
  WAVE_DEEP,
  WAVE_MICHE_STEEPNESS,
  WAVE_SHALLOW,
  fmt,
  fmtSci,
  linearWave,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";

/* Sumbu pita h/L 0,003–400 memuat penggeser (0,00376 pada T 60, h 0,5;
   320 pada T 1, h 500). */
const HL_MIN = 0.003;
const HL_MAX = 400;
/** Periode terpanjang penggeser dan sumbu grafik, detik. */
const T_MAKS = 60;

const NADA_REZIM: Record<string, Tone> = {
  dangkal: "critical",
  menengah: "neutral",
  dalam: "water",
};
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksWave } from "@/lib/checks";

const REZIM = {
  id: { dangkal: "Air dangkal", menengah: "Kedalaman menengah", dalam: "Air dalam" },
  en: { dangkal: "Shallow water", menengah: "Intermediate depth", dalam: "Deep water" },
} as const;

const TXT = {
  id: {
    title: "Gelombang linear",
    sheetTitle: "Kecepatan rambat terhadap periode, pada kedalaman yang dipilih",
    dT: "Periode gelombang",
    dH: "Kedalaman air",
    dA: "Tinggi gelombang",
    pPantai: "Gelombang pantai, air dangkal",
    pecah: "Gelombang pecah, teori linear tidak berlaku",
    bDangkal: "Air dangkal, c → √(gh)",
    bMenengah: "Kedalaman menengah",
    bDalam: "Air dalam, c → gT/2π",
    hL0: "Panjang gelombang di air dalam",
    hL: "Hubungan sebaran, diselesaikan bagi dua: sisa persamaan",
    hC: "Kecepatan rambat dan kedalaman relatif",
    hCg: "Nisbah dan kecepatan rambat tenaga",
    hA0: "Setengah panjang gerak mendatar partikel di dasar",
    hPecah: "Pemeriksaan pecah: kecuraman (Miche) dan nisbah tinggi-kedalaman",
    pLaut: "Gelombang laut lepas, air dalam",
    pAlun: "Alun panjang yang merasakan dasar",
    rPanjang: "Panjang gelombang",
    rC: "Kecepatan rambat puncak",
    rCg: "Kecepatan rambat tenaga",
    rNisbah: "Kecepatan tenaga dibagi kecepatan puncak",
    rRel: "Kedalaman dibagi panjang gelombang",
    rDangkal: "Kecepatan menurut hampiran air dangkal",
    rDalam: "Kecepatan menurut hampiran air dalam",
    rOrbit: "Setengah panjang gerak mendatar partikel di dasar",
    rSteep: "Kecuraman gelombang",
    rasa: "Gerak airnya masih terasa sampai dasar",
    takRasa: "Dasarnya tidak merasakan gelombang ini",
    note:
      "Satu hubungan sebaran mengatur seluruh gelombang permukaan, dan seluruh hampiran yang dipakai sehari-hari adalah potongan darinya. Di air dalam, tangen hiperbolik mendekati satu dan kecepatan rambatnya hanya bergantung pada periode; gelombang yang periodenya panjang melaju lebih cepat, dan itulah sebabnya alun dari badai yang jauh tiba lebih dulu daripada gelombang pendeknya, berhari-hari lebih dulu. Di air dangkal, tangen hiperbolik mendekati sudutnya sendiri dan kecepatannya hanya bergantung pada kedalaman; seluruh periode melaju sama cepat, gelombangnya berhenti tersebar, dan bentuk yang datang bertahan sebagai bentuk. Itulah sebabnya tsunami, yang periodenya menit dan bukan detik, selalu berada dalam air dangkal bahkan di tengah samudra, dan sampai ke pantai masih berbentuk seperti saat berangkat. Satu hal lagi yang pantas diperhatikan adalah kecepatan tenaganya. Di air dalam tenaganya bergerak setengah kecepatan puncaknya, sehingga puncak-puncak gelombang muncul di belakang sekelompok gelombang, berjalan maju melewatinya, dan lenyap di depannya. Di air dangkal keduanya sama, dan gejala itu hilang sama sekali.",
  },
  en: {
    title: "Linear wave",
    sheetTitle: "Celerity against period, at the chosen depth",
    dT: "Wave period",
    dH: "Water depth",
    dA: "Wave height",
    pPantai: "A coastal wave in shallow water",
    pecah: "Breaking wave, linear theory does not apply",
    bDangkal: "Shallow water, c → √(gh)",
    bMenengah: "Intermediate depth",
    bDalam: "Deep water, c → gT/2π",
    hL0: "Deep-water wavelength",
    hL: "Dispersion relation, solved by bisection: equation residual",
    hC: "Celerity and relative depth",
    hCg: "Ratio and energy celerity",
    hA0: "Half-length of the horizontal particle excursion at the bed",
    hPecah: "Breaking check: steepness (Miche) and height-to-depth ratio",
    pLaut: "An open-sea wave in deep water",
    pAlun: "A long swell that feels the bottom",
    rPanjang: "Wavelength",
    rC: "Celerity of the crest",
    rCg: "Celerity of the energy",
    rNisbah: "Energy celerity over crest celerity",
    rRel: "Depth over wavelength",
    rDangkal: "Celerity by the shallow-water approximation",
    rDalam: "Celerity by the deep-water approximation",
    rOrbit: "Half-length of the horizontal particle excursion at the bed",
    rSteep: "Wave steepness",
    rasa: "The water motion still reaches the bed",
    takRasa: "The bed does not feel this wave",
    note:
      "One dispersion relation governs every surface wave, and every approximation used in daily work is a slice of it. In deep water the hyperbolic tangent approaches one and the celerity depends on the period alone; waves of longer period travel faster, which is why the swell from a distant storm arrives days before its short waves. In shallow water the tangent approaches its own argument and the celerity depends on the depth alone; every period travels at the same speed, the waves stop dispersing, and a shape that arrives survives as a shape. That is why a tsunami, whose period is minutes rather than seconds, is always in shallow water even in mid-ocean, and reaches the coast still shaped as it set out. One more thing deserves attention, the celerity of the energy. In deep water the energy moves at half the crest speed, so crests appear at the back of a group of waves, run forward through it, and vanish at its front. In shallow water the two are equal and the phenomenon disappears entirely.",
  },
} as const;

const REFS = {
  id: [
    "Airy, G.B. (1845). Tides and waves. Encyclopaedia Metropolitana.",
    "Dean, R.G. & Dalrymple, R.A. (1991). Water Wave Mechanics for Engineers and Scientists.",
    "Holthuijsen, L.H. (2007). Waves in Oceanic and Coastal Waters.",
    "U.S. Army Corps of Engineers (2002). Coastal Engineering Manual, bagian II.",
  ],
  en: [
    "Airy, G.B. (1845). Tides and waves. Encyclopaedia Metropolitana.",
    "Dean, R.G. & Dalrymple, R.A. (1991). Water Wave Mechanics for Engineers and Scientists.",
    "Holthuijsen, L.H. (2007). Waves in Oceanic and Coastal Waters.",
    "U.S. Army Corps of Engineers (2002). Coastal Engineering Manual, part II.",
  ],
} as const;

export function GelombangLinearClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [perioda, setPerioda] = useState(8);
  const [dalam, setDalam] = useState(20);
  const [tinggi, setTinggi] = useState(1);

  const r = linearWave(perioda, dalam, tinggi);
  const pecah = r.breaking;
  const kh = r.k * dalam;
  const sigma = (2 * Math.PI) / perioda;
  const sisa = G * r.k * Math.tanh(kh) - sigma * sigma;

  const ref = useCanvas(
    (ctx, w, ch) => {
      /* Lengkung sebarannya, dipetakan pada rentang periode satu sampai enam
         puluh detik supaya alun panjang ikut masuk ke dalam bidangnya. */
      const tMin = 1;
      const tMax = T_MAKS;
      const n = 120;
      const tepat: { x: number; y: number }[] = [];
      const dangkal: { x: number; y: number }[] = [];
      const laut: { x: number; y: number }[] = [];
      for (let i = 0; i <= n; i++) {
        const Ti = tMin * Math.pow(tMax / tMin, i / n);
        const g = linearWave(Ti, dalam, tinggi);
        tepat.push({ x: Ti, y: g.celerity });
        dangkal.push({ x: Ti, y: g.shallowCelerity });
        laut.push({ x: Ti, y: g.deepCelerity });
      }

      const garis: FieldLine[] = [
        {
          pts: laut,
          color: C.ink3,
          weight: W.hair,
          dash: DASH.hidden,
          label: T.deepWaterLimit,
          labelAt: 0.34,
          labelDy: -10,
          labelAlign: "center",
        },
        {
          pts: dangkal,
          color: C.ink3,
          weight: W.hair,
          dash: DASH.axis,
          label: T.shallowWaterLimit,
          labelAt: 0.9,
          labelDy: 15,
          labelAlign: "right",
        },
        {
          pts: tepat,
          color: C.water,
          weight: W.bold,
          dash: DASH.solid,
          /* Kurva ini kecepatan rambat terhadap periode, bukan muka air. */
          label: T.celerityCurve,
          labelAt: 0.62,
          labelDy: -12,
          labelAlign: "center",
        },
        /* Penunjuk pendek untuk titik kosong, yang dulu tidak bernama. */
        {
          pts: [
            { x: perioda, y: r.groupVelocity },
            { x: perioda + tMax * 0.035, y: r.groupVelocity },
          ],
          color: C.critical,
          weight: W.hair,
          dash: DASH.solid,
          label: T.groupVelocityMark,
          labelAt: 1,
          labelDy: 4,
          labelAlign: "left",
        },
      ];

      const titik: FieldMarker[] = [
        { x: perioda, y: r.celerity, color: C.energy, size: 5, filled: true },
        { x: perioda, y: r.groupVelocity, color: C.critical, size: 5, filled: false },
      ];

      const cMax = Math.max(r.shallowCelerity, ...tepat.map((p) => p.y)) * 1.18;

      drawField(
        ctx,
        w,
        ch,
        {
          xMin: 0,
          xMax: tMax,
          yMin: 0,
          yMax: cMax,
          equalScale: false,
          lines: garis,
          markers: titik,
          heading: pecah ? x.pecah : REZIM[lang][r.regime],
          headingColor: pecah ? C.signal : C.ink2,
          axisX: T.axWavePeriod,
          axisY: T.axCelerity,
        },
        lang
      );
    },
    [perioda, dalam, tinggi, lang]
  );

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="h/L"
          value={r.relativeDepth}
          scale="log"
          digits={4}
          invalid={pecah}
          pesan={pecah ? x.pecah : undefined}
          bands={[
            { from: HL_MIN, to: WAVE_SHALLOW, label: x.bDangkal, tone: "critical" },
            { from: WAVE_SHALLOW, to: WAVE_DEEP, label: x.bMenengah, tone: "neutral" },
            { from: WAVE_DEEP, to: HL_MAX, label: x.bDalam, tone: "water" },
          ]}
        />
      }
      sheet="FP-03"
      subject={SUBJECTS.FP[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Di <Term tint={C.water}>air dalam</Term> kecepatannya hanya
            bergantung pada periode; di{" "}
            <Term tint={C.critical}>air dangkal</Term> hanya pada kedalaman, dan
            seluruh periode melaju sama cepat.
          </p>
        ) : (
          <p>
            In <Term tint={C.water}>deep water</Term> the celerity depends on the
            period alone; in <Term tint={C.critical}>shallow water</Term> on the
            depth alone, and every period travels at the same speed.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FP-03"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, s, m/s)" },
            { label: "L", value: `${fmt(r.length, 1)} m` },
            { label: "c", value: `${fmt(r.celerity, 2)} m/s`, tint: C.energy },
            { label: "cg/c", value: fmt(r.groupRatio, 3), tint: C.critical },
            { label: "h/L", value: fmt(r.relativeDepth, 3), tint: pecah ? C.signal : undefined },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="T" label={x.dT} value={perioda} min={1} max={60} step={0.5} digits={1} unit="s" onChange={setPerioda} tint={C.energy} />
              <InputRow symbol="h" label={x.dH} value={dalam} min={0.5} max={500} step={0.5} digits={1} unit="m" onChange={setDalam} tint={C.water} />
              <InputRow symbol="H" label={x.dA} value={tinggi} min={0.1} max={6} step={0.1} digits={1} unit="m" onChange={setTinggi} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  /* Dulu H 1 m: H/h 0,83 > 0,78, sudah pecah. H 0,5 m tetap air
                     dangkal dan masih di dalam batas teori linear. */
                  { label: x.pPantai, apply: () => { setPerioda(8); setDalam(1.2); setTinggi(0.5); } },
                  { label: x.pLaut, apply: () => { setPerioda(8); setDalam(200); setTinggi(2); } },
                  { label: x.pAlun, apply: () => { setPerioda(20); setDalam(40); setTinggi(1.5); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "L", label: x.rPanjang, value: fmt(r.length, 2), unit: "m", strong: true },
                { symbol: "c", label: x.rC, value: fmt(r.celerity, 3), unit: "m/s", tint: C.energy, strong: true },
                { symbol: "cg", label: x.rCg, value: fmt(r.groupVelocity, 3), unit: "m/s", tint: C.critical, strong: true },
                { symbol: "cg/c", label: x.rNisbah, value: fmt(r.groupRatio, 4) },
                { symbol: "h/L", label: x.rRel, value: fmt(r.relativeDepth, 4), tint: pecah ? C.signal : undefined },
                { symbol: "H/L", label: x.rSteep, value: fmt(r.steepness, 4), tint: pecah ? C.signal : undefined },
                { symbol: "√gh", label: x.rDangkal, value: fmt(r.shallowCelerity, 3), unit: "m/s" },
                { symbol: "gT/2π", label: x.rDalam, value: fmt(r.deepCelerity, 3), unit: "m/s" },
                // Gelombang pecah: a₀ dari teori linear tidak bermakna (T 60, h 0,5, H 6 → 126,9 m).
                { symbol: "a₀", label: x.rOrbit, value: pecah ? "—" : fmt(r.bottomOrbit, 4), unit: pecah ? undefined : "m", tint: r.feelsBottom && !pecah ? C.critical : undefined },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hL0,
                    rumus: (<><span>L₀ =</span><Frac num="g T²" den="2π" /></>),
                    isi: `${fmt(G, 2)} · ${fmt(perioda, 1)}² / ( 2π )`,
                    hasil: fmt(r.deepLength, 2),
                    satuan: "m",
                  },
                  {
                    judul: `${x.hL}, L = ${fmt(r.length, 2)} m`,
                    rumus: (<><span>g k tanh( k h ) − σ² ≈ 0,</span><span className="ml-2">σ =</span><Frac num="2π" den="T" /><span className="ml-2">k =</span><Frac num="2π" den="L" /></>),
                    isi: `${fmt(G, 2)} · ${fmt(r.k, 5)} · tanh( ${fmt(r.k, 5)} · ${fmt(dalam, 1)} ) − ${fmt(sigma, 5)}² = ${Math.abs(sisa) < 1e-9 ? fmt(0, 0) : fmtSci(sisa)}`,
                    hasil: fmt(r.length, 2),
                    satuan: "m",
                    tint: C.water,
                  },
                  {
                    judul: x.hC,
                    rumus: (<><span>c =</span><Frac num="L" den="T" /><span className="ml-2">h / L</span></>),
                    isi: `${fmt(r.length, 3)} / ${fmt(perioda, 1)};  h/L = ${fmt(dalam, 1)} / ${fmt(r.length, 3)} = ${fmt(r.relativeDepth, 4)}`,
                    hasil: fmt(r.celerity, 3),
                    satuan: "m/s",
                    tint: C.energy,
                  },
                  {
                    judul: x.hCg,
                    rumus: (<><span>n =</span><Frac num="1" den="2" /><span>( 1 +</span><Frac num="2kh" den="sinh 2kh" /><span>),</span><span className="ml-2">cg = n c</span></>),
                    isi: `n = ½ ( 1 + ${fmt(2 * kh, 4)} / sinh ${fmt(2 * kh, 4)} ) = ${fmt(r.groupRatio, 4)};  ${fmt(r.groupRatio, 4)} · ${fmt(r.celerity, 4)}`,
                    hasil: fmt(r.groupVelocity, 3),
                    satuan: "m/s",
                    tint: C.critical,
                  },
                  {
                    judul: x.hA0,
                    rumus: (<><span>a₀ =</span><Frac num="H" den="2 sinh( k h )" /></>),
                    isi: pecah ? "—" : `${fmt(tinggi, 1)} / ( 2 · sinh ${fmt(kh, 4)} )`,
                    hasil: pecah ? "—" : fmt(r.bottomOrbit, 4),
                    satuan: pecah ? undefined : "m",
                  },
                  {
                    judul: x.hPecah,
                    rumus: (
                      <span>
                        H/L ≤ {fmt(WAVE_MICHE_STEEPNESS, 3)} tanh( k h ),{" "}
                        H/h ≤ {fmt(WAVE_BREAKER_INDEX, 2)}
                      </span>
                    ),
                    isi: `${fmt(r.steepness, 4)} ${r.steepness > r.steepnessLimit ? ">" : "≤"} ${fmt(r.steepnessLimit, 4)};  ${fmt(r.heightDepthRatio, 3)} ${r.heightDepthRatio > WAVE_BREAKER_INDEX ? ">" : "≤"} ${fmt(WAVE_BREAKER_INDEX, 2)}`,
                    hasil: pecah ? x.pecah : lang === "id" ? "tidak pecah" : "not breaking",
                    tint: pecah ? C.signal : undefined,
                  },
                ]}
              />
            </div>
          </Block>

          {pecah ? (
            <StateCard
              tone="invalid"
              badge={x.pecah}
              {...notice(perioda, dalam, tinggi, lang)}
            />
          ) : (
            <StateCard
              tone={NADA_REZIM[r.regime]}
              badge={REZIM[lang][r.regime]}
              {...notice(perioda, dalam, tinggi, lang)}
            />
          )}
        </>
      }
      verification={<Verification checks={checksWave(perioda, dalam, tinggi)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>σ² = g k tanh(k h)</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "hubungan sebaran, dan seluruh hampirannya potongan darinya"
                    : "the dispersion relation, of which every approximation is a slice"}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `air dangkal bila h/L < ${fmt(WAVE_SHALLOW, 2)}: c → √(gh); air dalam bila h/L > ${fmt(WAVE_DEEP, 2)}: c → gT/2π`
                    : `shallow if h/L < ${fmt(WAVE_SHALLOW, 2)}: c → √(gh); deep if h/L > ${fmt(WAVE_DEEP, 2)}: c → gT/2π`}
                </span>
              </Eq>
              <Eq>
                <span>cg =</span>
                <Frac num="c" den="2" />
                <span>(1 + 2kh / sinh 2kh)</span>
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
 * Isi kalimatnya sama dengan catatan lama; kalimat pertama menyatakan
 * keadaan, sisanya butir. Dua kalimat lama dibetulkan: periode pembanding
 * dibatasi ke maksimum penggeser 60 s, dan "500 m adalah batas air dalam"
 * hanya ditulis bila gelombang itu memang air dalam di 500 m (T ≳ 25 s
 * masih kedalaman menengah).
 */
function notice(
  perioda: number,
  dalam: number,
  tinggi: number,
  lang: Lang
): { state: string; notice: string[] } {
  const x = TXT[lang];
  const a = linearWave(perioda, dalam, tinggi);
  const Tp = Math.min(perioda * 2.5, T_MAKS);
  const panjang = linearWave(Tp, dalam, tinggi);
  const laut = linearWave(perioda, 500, tinggi);
  const bisaPanjang = Tp > perioda;
  const rezim = REZIM[lang][a.regime].toLowerCase();

  if (lang === "en") {
    const pecah = a.breaking
      ? [
          `H/h = ${fmt(a.heightDepthRatio, 2)} (limit ${fmt(WAVE_BREAKER_INDEX, 2)}) and H/L = ${fmt(a.steepness, 3)} (Miche limit ${fmt(a.steepnessLimit, 3)}): the wave is too high for this depth or too steep for its length and breaks. Linear theory assumes a small wave; its L, c and cg here are only the small-wave values, and the bed excursion is not written.`,
          "Lower the wave height or deepen the water until both ratios are inside their limits.",
        ]
      : [];
    return {
      state: `h/L = ${fmt(a.relativeDepth, 3)}: ${rezim}; c = ${fmt(a.celerity, 2)} m/s, energy travels at ${fmt(a.groupVelocity, 2)} m/s (n = ${fmt(a.groupRatio, 2)}).`,
      notice: [
        ...pecah,
        a.feelsBottom ? x.rasa + "." : x.takRasa + ".",
        `For comparison, the shallow-water approximation √(gh) gives ${fmt(a.shallowCelerity, 2)} m/s and the deep-water one gT/2π gives ${fmt(a.deepCelerity, 2)} m/s.`,
        bisaPanjang
          ? `Lengthen the period to ${fmt(Tp, 1)} s and the celerity becomes ${fmt(panjang.celerity, 2)} m/s: ${panjang.regime === "dangkal" ? "it has stopped growing, because in shallow water the depth alone decides it" : "it keeps growing, because the wave is still deep enough to disperse"}.`
          : "",
        laut.regime === "dalam"
          ? `Take the same period into 500 m of water and it reaches ${fmt(laut.celerity, 2)} m/s, the deep-water limit, beyond which more depth changes nothing at all.`
          : `Even in 500 m of water this period is still at intermediate depth: the celerity there is ${fmt(laut.celerity, 2)} m/s, below the deep-water value ${fmt(laut.deepCelerity, 2)} m/s, so the bed still matters.`,
      ],
    };
  }
  const pecah = a.breaking
    ? [
        `H/h = ${fmt(a.heightDepthRatio, 2)} (batas ${fmt(WAVE_BREAKER_INDEX, 2)}) dan H/L = ${fmt(a.steepness, 3)} (batas Miche ${fmt(a.steepnessLimit, 3)}): gelombangnya terlalu tinggi untuk kedalaman ini atau terlalu curam untuk panjangnya, jadi pecah. Teori linear menganggap gelombangnya kecil; L, c, dan cg di sini hanya nilai gelombang kecil, dan gerak partikel di dasar tidak ditulis.`,
        "Turunkan tinggi gelombangnya atau dalamkan airnya sampai kedua nisbah berada di dalam batasnya.",
      ]
    : [];
  return {
    state: `h/L = ${fmt(a.relativeDepth, 3)}: ${rezim}; c = ${fmt(a.celerity, 2)} m/s, energi merambat ${fmt(a.groupVelocity, 2)} m/s (n = ${fmt(a.groupRatio, 2)}).`,
    notice: [
      ...pecah,
      a.feelsBottom ? x.rasa + "." : x.takRasa + ".",
      `Sebagai pembanding, hampiran air dangkal √(gh) memberi ${fmt(a.shallowCelerity, 2)} m/s dan hampiran air dalam gT/2π memberi ${fmt(a.deepCelerity, 2)} m/s.`,
      bisaPanjang
        ? `Panjangkan periodenya menjadi ${fmt(Tp, 1)} s dan kecepatannya menjadi ${fmt(panjang.celerity, 2)} m/s: ${panjang.regime === "dangkal" ? "ia berhenti bertambah, karena di air dangkal kedalamannya sendiri yang menentukan" : "ia terus bertambah, karena gelombangnya masih cukup dalam untuk tersebar"}.`
        : "",
      laut.regime === "dalam"
        ? `Bawa periode yang sama ke air sedalam 500 m dan ia mencapai ${fmt(laut.celerity, 2)} m/s, yaitu batas air dalam, dan lebih dalam daripada itu tidak mengubah apa pun lagi.`
        : `Bahkan di air sedalam 500 m periode ini masih di kedalaman menengah: kecepatannya di sana ${fmt(laut.celerity, 2)} m/s, di bawah nilai air dalam ${fmt(laut.deepCelerity, 2)} m/s, jadi dasarnya masih berpengaruh.`,
    ],
  };
}
