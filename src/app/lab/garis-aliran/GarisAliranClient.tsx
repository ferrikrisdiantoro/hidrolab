"use client";

import { useRef, useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  Block,
  Hitungan,
  InputRow,
  InputTable,
  PresetRow,
  ResultTable,
  Sheet,
  StateCard,
  Term,
} from "@/components/ui";
import { usePlate, usePutar } from "@/lib/usePlate";
import {
  createFlowLinesMotion,
  drawFlowLinesMotion,
  type FlowLinesMotion,
} from "@/lib/drawFieldMotion";
import {
  drawField,
  type FieldArrow,
  type FieldLine,
  type FieldMarker,
} from "@/lib/drawField";
import { flowLines, fmt } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksFlowLines } from "@/lib/checks";

const SPAN = 10;

const TXT = {
  id: {
    title: "Garis aliran",
    sheetTitle: "Garis arus, garis jejak, dan lintasan partikel pada medan berayun",
    dU: "Kecepatan mendatar",
    dV: "Simpangan kecepatan tegak",
    dW: "Frekuensi ayunan",
    dT: "Saat pengamatan",
    pTunak: "Aliran tunak, ketiganya berimpit",
    pAyun: "Medan berayun perlahan",
    pCepat: "Ayunan cepat, ketiganya jauh berbeda",
    rPisah: "Jarak terjauh garis arus terhadap lintasan",
    rMiring: "Kemiringan garis arus pada saat ini",
    rAmp: "Simpangan terbesar lintasan partikel",
    rPeriode: "Periode ayunan",
    tunak: "Aliran tunak, ketiga garisnya berimpit",
    takTunak: "Aliran tak tunak, ketiga garisnya berbeda",
    rV: "Kecepatan tegak pada saat ini",
    sState: (k: string, d: string) => `${k}: garis arus dan lintasan terpisah ${d} m.`,
    sTunak: (k: string) =>
      `${k}: medannya tidak berubah terhadap waktu, jadi garis arus, lintasan, dan garis jejak berimpit (Δ = 0).`,
    nTunak: "Naikkan V dan ω di atas nol supaya medannya berubah terhadap waktu dan ketiga garisnya memisah.",
    nNol: (d: string) =>
      `Tarik V ke nol: jaraknya menutup dari ${d} m ke 0 m, karena medannya berhenti berubah terhadap waktu dan satu garis mengerjakan tugas tiga garis.`,
    nCepat: (a: string, b: string) =>
      `Tigakalikan ω: jaraknya berubah dari ${a} ke ${b} m. Airnya tidak berubah; yang berubah hanya seberapa cepat medannya berubah selama partikel menempuhnya.`,
    jV: "Kecepatan tegak pada saat pengamatan",
    jMiring: "Kemiringan garis arus pada saat itu",
    jAmp: "Simpangan terbesar yang dicapai lintasan sampai saat t",
    jPisah: "Jarak terjauh lintasan dari garis arus",
    jT: "Periode ayunan",
    motionNote: "diputar ulang 0 sampai t, waktu nyata",
    note:
      "Tiga garis ini berbeda meskipun dilahirkan satu medan kecepatan yang sama, dan perbedaannya bukan soal halus melainkan soal yang menentukan cara membaca setiap foto aliran yang pernah diambil. Garis arus menjawab pertanyaan ke mana air menuju pada satu saat, dan ia dibekukan pada saat itu. Lintasan partikel menjawab ke mana satu butir air pergi sepanjang waktu. Garis jejak menjawab di mana semua butir yang pernah lewat satu titik sekarang berada, dan itulah yang terlihat bila zat warna diteteskan terus-menerus dari satu jarum. Yang pertama milik satu saat dan seluruh ruang; yang kedua milik satu butir dan seluruh waktu; yang ketiga milik satu titik dan seluruh waktu. Ketiganya hanya berimpit bila medannya tidak berubah terhadap waktu, dan di situ pula satu-satunya tempat foto zat warna boleh dibaca sebagai garis arus. Setiap foto aliran tak tunak yang pernah dimuat buku teks adalah garis jejak, dan membacanya sebagai garis arus adalah kekeliruan yang jarang diucapkan tetapi sering dilakukan. Perhatikan pula bahwa garis jejak dan lintasan partikel di sini sama-sama sinus tetapi berbeda fase. Keduanya tampak serupa sekilas, dan justru keserupaan itulah yang membuat kekeliruannya bertahan.",
  },
  en: {
    title: "Flow lines",
    sheetTitle: "Streamline, streakline, and pathline in an oscillating field",
    dU: "Horizontal velocity",
    dV: "Vertical velocity amplitude",
    dW: "Oscillation frequency",
    dT: "Time of observation",
    pTunak: "Steady flow, all three coincide",
    pAyun: "A slowly oscillating field",
    pCepat: "Fast oscillation, all three far apart",
    rPisah: "Greatest gap between streamline and pathline",
    rMiring: "Slope of the streamline at this instant",
    rAmp: "Largest excursion of the pathline",
    rPeriode: "Period of the oscillation",
    tunak: "Steady flow, the three lines coincide",
    takTunak: "Unsteady flow, the three lines differ",
    rV: "Vertical velocity at this instant",
    sState: (k: string, d: string) => `${k}: streamline and pathline stand ${d} m apart.`,
    sTunak: (k: string) =>
      `${k}: the field does not change with time, so streamline, pathline and streakline coincide (Δ = 0).`,
    nTunak: "Raise V and ω above zero so the field changes with time and the three lines separate.",
    nNol: (d: string) =>
      `Drag V to zero: the gap closes from ${d} m to 0 m, because the field stops changing with time and a single line does the work of three.`,
    nCepat: (a: string, b: string) =>
      `Triple ω: the gap changes from ${a} to ${b} m. Nothing about the water changed; only how fast the field changed while the particle travelled through it.`,
    jV: "Vertical velocity at the time of observation",
    jMiring: "Slope of the streamline at that instant",
    jAmp: "Largest excursion the pathline reaches up to time t",
    jPisah: "Greatest gap between pathline and streamline",
    jT: "Period of the oscillation",
    motionNote: "replayed from 0 to t, real time",
    note:
      "These three lines differ although one and the same velocity field gives birth to all of them, and the difference is not a fine point but the thing that decides how every flow photograph ever taken should be read. A streamline answers where the water is heading at one instant, frozen at that instant. A pathline answers where one grain of water went over time. A streakline answers where all the grains that once passed one point are now, and that is what is seen when dye is released continuously from a needle. The first belongs to one instant and all of space; the second to one grain and all of time; the third to one point and all of time. They coincide only when the field does not change with time, and that is also the only case in which a dye photograph may be read as a streamline. Every photograph of an unsteady flow ever printed in a textbook is a streakline, and reading it as a streamline is a mistake seldom spoken of and often made. Notice too that the streakline and the pathline here are both sine curves, differing only in phase. At a glance they look alike, and it is exactly that likeness that keeps the mistake alive.",
  },
} as const;

const REFS = {
  id: [
    "Prandtl, L. & Tietjens, O.G. (1934). Fundamentals of Hydro- and Aeromechanics.",
    "Van Dyke, M. (1982). An Album of Fluid Motion.",
    "Panton, R.L. (2013). Incompressible Flow, edisi ke-4, bab 3.",
    "Batchelor, G.K. (1967). An Introduction to Fluid Dynamics, bab 2.",
  ],
  en: [
    "Prandtl, L. & Tietjens, O.G. (1934). Fundamentals of Hydro- and Aeromechanics.",
    "Van Dyke, M. (1982). An Album of Fluid Motion.",
    "Panton, R.L. (2013). Incompressible Flow, 4th ed., ch. 3.",
    "Batchelor, G.K. (1967). An Introduction to Fluid Dynamics, ch. 2.",
  ],
} as const;

export function GarisAliranClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [U, setU] = useState(2);
  const [V, setV] = useState(1);
  const [omega, setOmega] = useState(1);
  const [waktu, setWaktu] = useState(5);

  /*
   * Panjang yang digambar mengikuti lintasan partikelnya, bukan tetap
   * sepuluh meter. Partikel yang dilepas pada saat nol sudah menempuh U·t
   * pada saat pengamatan, dan jarak Δ di tabel diukur sepanjang seluruh
   * lintasan itu. Dengan panjang tetap, pada U atau t yang besar lintasan
   * dan garis jejaknya keluar dari bingkai (labelnya ikut hilang), dan Δ
   * dilaporkan di tempat yang tidak tergambar.
   */
  const panjang = Math.max(SPAN, U * waktu);
  const r = flowLines(U, V, omega, waktu, panjang);
  const miring = U !== 0 ? (V * Math.cos(omega * waktu)) / U : 0;
  /* Simpangan yang BENAR-BENAR dicapai lintasan sampai saat t, bukan
     |V/ω|: pada ω 0,05, V 1, t 0,5 bedanya 0,5 m lawan 20 m. */
  const amplitudo = Math.max(0, ...r.pathline.map((p) => Math.abs(p.y)));
  const vSaatIni = V * Math.cos(omega * waktu);
  const perioda = omega !== 0 ? (2 * Math.PI) / omega : Infinity;

  /*
   * Tinggi bingkai mencakup ketiga garisnya. Garis arusnya lurus dan dapat
   * naik jauh lebih tinggi daripada simpangan partikelnya.
   */
  const puncak = Math.max(
    ...[...r.streamline, ...r.pathline, ...r.streakline].map((p) => Math.abs(p.y))
  );
  const batasGambar = Math.max(puncak * 1.25, SPAN * 0.3);

  /* Lapis gerak (Phase 2): putaran ulang 0 sampai t dalam waktu nyata.
     Selagi bergerak, panah kecepatan seragam di lapis statis diganti
     goresan pelacak yang mengikuti medan yang sama pada saat putarannya,
     dan ketiga garis saat t digambar rambut bergaris phantom (posisi
     akhir, DASH.phantom) supaya tidak tertukar dengan garis yang sedang
     bergerak. Saat dijeda gambarnya sama persis dengan sebelumnya. */
  const { playing, toggle: togglePutar } = usePutar();
  const gerak = useRef<FlowLinesMotion | null>(null);
  if (gerak.current === null) gerak.current = createFlowLinesMotion();
  const bergerak = playing;

  const plate = usePlate(
    (ctx, w, ch) => {
      const garis: FieldLine[] = [
        /* Garis penunjuk dari titik lepasnya tegak ke bawah. Ketiga garis
           berangkat ke kanan, jadi sisi bawah titiknya selalu kosong, dan
           namanya tidak lagi mengambang di pojok bingkai jauh dari titiknya. */
        {
          pts: [
            { x: 0, y: 0 },
            { x: 0, y: -batasGambar * 0.62 },
          ],
          color: C.ink3,
          weight: W.hair,
          dash: DASH.solid,
          label: T.releasePoint,
          labelAt: 1,
          labelDy: 14,
          labelAlign: "left",
        },
        {
          pts: r.streamline,
          color: C.critical,
          weight: bergerak ? W.hair : W.bold,
          dash: bergerak ? DASH.phantom : DASH.solid,
          label: T.streamlineLabel,
          labelAt: 0.88,
          labelDy: -10,
          labelAlign: "right",
        },
        {
          pts: r.pathline,
          color: C.water,
          weight: bergerak ? W.hair : W.bold,
          dash: bergerak ? DASH.phantom : DASH.hidden,
          label: T.pathlineLabel,
          labelAt: 0.55,
          labelDy: 16,
          labelAlign: "center",
          arrow: true,
        },
        {
          pts: r.streakline,
          color: C.energy,
          weight: bergerak ? W.hair : W.thin,
          dash: bergerak ? DASH.phantom : DASH.solid,
          label: T.streaklineLabel,
          labelAt: 0.3,
          labelDy: -12,
          labelAlign: "center",
        },
      ];

      /* Panah kecepatan pada saat ini, seragam di seluruh bidang karena
         medannya memang seragam. Itulah sebabnya garis arusnya lurus.
         Panjangnya tetap sembilan persen lebar bingkai, arahnya mengikuti
         (U, v): tanpa itu pada U besar panahnya saling menyambung. */
      const vSaat = V * Math.cos(omega * waktu);
      const skala = U > 0 ? (panjang * 0.09) / U : 0;
      const panah: FieldArrow[] = [];
      for (let i = 1; i <= 4; i++)
        for (let j = -1; j <= 1; j++)
          panah.push({
            x: (panjang * i) / 5,
            y: j * batasGambar * 0.6,
            dx: U * skala,
            dy: vSaat * skala,
            color: C.ink3,
            weight: W.hair,
          });

      const titik: FieldMarker[] = [
        { x: 0, y: 0, color: C.ink, size: 4, filled: true },
      ];

      return drawField(
        ctx,
        w,
        ch,
        {
          xMin: -panjang * 0.06,
          xMax: panjang * 1.1,
          yMin: -batasGambar,
          yMax: batasGambar,
          equalScale: false,
          lines: garis,
          arrows: bergerak ? [] : panah,
          markers: titik,
          heading: r.steady ? x.tunak : undefined,
          axisX: T.axXMetre,
          axisY: T.axYMetre,
        },
        lang
      );
    },
    (ctx, _w, _h, tt, dt, out) =>
      drawFlowLinesMotion(ctx, tt, dt, out, { U, V, omega, waktu, panjang }, gerak.current!),
    [U, V, omega, waktu, lang, bergerak],
    { playing }
  );

  return (
    <LabShell
      sheet="FF-05"
      subject={SUBJECTS.FF[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            <Term tint={C.critical}>Garis arus</Term> milik satu saat,{" "}
            <Term tint={C.water}>lintasan partikel</Term> milik satu butir air,
            dan <Term tint={C.energy}>garis jejak</Term> milik satu titik lepas.
            Ketiganya hanya berimpit pada aliran tunak.
          </p>
        ) : (
          <p>
            A <Term tint={C.critical}>streamline</Term> belongs to one instant, a{" "}
            <Term tint={C.water}>pathline</Term> to one grain of water, and a{" "}
            <Term tint={C.energy}>streakline</Term> to one release point. They
            coincide only in steady flow.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FF-05"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m/s, rad/s)" },
            { label: "t", value: `${fmt(waktu, 1)} s` },
            { label: "U", value: `${fmt(U, 2)} m/s` },
            { label: "v(t)", value: `${fmt(V * Math.cos(omega * waktu), 2)} m/s` },
            {
              label: "Δ",
              value: `${fmt(r.separation, 2)} m`,
              tint: r.steady ? undefined : C.critical,
            },
          ]}
          motion={{
            playing,
            onToggle: togglePutar,
            allowed: plate.motionAllowed,
            note: x.motionNote,
          }}
        >
          <canvas ref={plate.ref} className="block h-full w-full" />
          <canvas ref={plate.motionRef} />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="U" label={x.dU} value={U} min={0.2} max={8} step={0.1} digits={1} unit="m/s" onChange={setU} />
              <InputRow symbol="V" label={x.dV} value={V} min={0} max={4} step={0.1} digits={1} unit="m/s" onChange={setV} tint={C.water} />
              <InputRow symbol="ω" label={x.dW} value={omega} min={0} max={4} step={0.05} digits={2} unit="rad/s" onChange={setOmega} tint={C.critical} />
              <InputRow symbol="t" label={x.dT} value={waktu} min={0.5} max={20} step={0.5} digits={1} unit="s" onChange={setWaktu} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pTunak, apply: () => { setU(2); setV(0); setOmega(1); setWaktu(5); } },
                  { label: x.pAyun, apply: () => { setU(2); setV(1); setOmega(0.5); setWaktu(8); } },
                  { label: x.pCepat, apply: () => { setU(2); setV(1.5); setOmega(3); setWaktu(12); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "Δ", label: x.rPisah, value: fmt(r.separation, 3), unit: "m", tint: r.steady ? undefined : C.critical, strong: true },
                { symbol: "v(t)", label: x.rV, value: fmt(vSaatIni, 3), unit: "m/s" },
                { symbol: "dy/dx", label: x.rMiring, value: fmt(miring, 4), tint: C.critical },
                { symbol: "A", label: x.rAmp, value: fmt(amplitudo, 3), unit: "m", tint: C.water },
                {
                  symbol: "T",
                  label: x.rPeriode,
                  value: Number.isFinite(perioda) ? fmt(perioda, 2) : "∞",
                  unit: "s",
                },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.jV,
                    rumus: <span>v(t) = V · cos ωt</span>,
                    isi: `${fmt(V, 1)} · cos( ${fmt(omega, 2)} · ${fmt(waktu, 1)} )`,
                    hasil: fmt(vSaatIni, 3),
                    satuan: "m/s",
                  },
                  {
                    judul: x.jMiring,
                    rumus: (<><span>dy/dx =</span><Frac num="v(t)" den="U" /></>),
                    isi: `${fmt(vSaatIni, 4)} / ${fmt(U, 1)}`,
                    hasil: fmt(miring, 4),
                    tint: C.critical,
                  },
                  {
                    judul: x.jAmp,
                    rumus:
                      omega !== 0 ? (
                        <span>A = maks | (V/ω) · sin ωτ |, 0 ≤ τ ≤ t</span>
                      ) : (
                        <span>A = maks | V · τ |, 0 ≤ τ ≤ t</span>
                      ),
                    isi:
                      omega !== 0
                        ? `maks | ( ${fmt(V, 1)} / ${fmt(omega, 2)} ) · sin( ${fmt(omega, 2)} · τ ) |, τ ≤ ${fmt(waktu, 1)}`
                        : `${fmt(V, 1)} · ${fmt(waktu, 1)}`,
                    hasil: fmt(amplitudo, 3),
                    satuan: "m",
                    tint: C.water,
                  },
                  {
                    judul: x.jPisah,
                    rumus: <span>Δ = maks | y_lintasan − (v(t)/U) · x |</span>,
                    isi: `maks | y_lintasan − ${fmt(miring, 4)} · x |, 0 ≤ x ≤ ${fmt(U * waktu, 2)}`,
                    hasil: fmt(r.separation, 3),
                    satuan: "m",
                    tint: r.steady ? undefined : C.critical,
                  },
                  {
                    judul: x.jT,
                    rumus: (<><span>T =</span><Frac num="2π" den="ω" /></>),
                    isi: omega !== 0 ? `2π / ${fmt(omega, 2)}` : `2π / 0`,
                    hasil: Number.isFinite(perioda) ? fmt(perioda, 2) : "∞",
                    satuan: "s",
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={r.steady ? "water" : "neutral"}
            badge={r.steady ? x.tunak : x.takTunak}
            state={r.steady ? x.sTunak(x.tunak) : x.sState(x.takTunak, fmt(r.separation, 2))}
            notice={notice(U, V, omega, waktu, lang)}
          />
        </>
      }
      verification={<Verification checks={checksFlowLines(U, V, omega, waktu)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>u = U,</span>
                <span className="ml-4">v = V cos ωt</span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "garis arus: dy/dx = v(t)/U pada t tetap"
                    : "streamline: dy/dx = v(t)/U at fixed t"}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "lintasan: x = Uτ, y = (V/ω) sin ωτ"
                    : "pathline: x = Uτ, y = (V/ω) sin ωτ"}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "garis jejak: x = U(t − t₀), y = (V/ω)(sin ωt − sin ωt₀)"
                    : "streakline: x = U(t − t₀), y = (V/ω)(sin ωt − sin ωt₀)"}
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
 * Saat sudah tunak (V = 0 atau ω = 0) kedua butir pembanding tidak punya
 * arti: tidak ada jarak yang dapat ditutup dan tidak ada frekuensi yang
 * dapat ditigakalikan.
 */
function notice(U: number, V: number, omega: number, t: number, lang: Lang): string[] {
  const x = TXT[lang];
  const panjang = Math.max(SPAN, U * t);
  const a = flowLines(U, V, omega, t, panjang);
  if (a.steady) return [x.nTunak];
  const cepat = flowLines(U, V, omega * 3, t, panjang);
  return [
    x.nNol(fmt(a.separation, 2)),
    x.nCepat(fmt(a.separation, 2), fmt(cepat.separation, 2)),
  ];
}
