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
import { usePlate, usePutar } from "@/lib/usePlate";
import { drawKarmanMotion, karmanTimeScale } from "@/lib/drawFieldMotion";
import {
  drawField,
  type FieldBody,
  type FieldDim,
  type FieldLine,
  type FieldMarker,
} from "@/lib/drawField";
import { KARMAN_SPACING, fmt, fmtSci, vortexStreet } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksVortexStreet } from "@/lib/checks";

/** Kekentalan kinematik air lima belas derajat dan udara, m²/s. */
const NU_AIR = 1.14e-6;
const NU_UDARA = 1.5e-5;

const REZIM = {
  id: {
    merayap: "Merayap, tanpa olakan",
    "sepasang-tetap": "Sepasang pusaran tetap",
    "deret-karman": "Deret vorteks Kármán",
    "lapis-geser-turbulen": "Lapis geser turbulen",
    kritis: "Melewati bilangan kritis",
  },
  en: {
    merayap: "Creeping, no wake",
    "sepasang-tetap": "A fixed pair of vortices",
    "deret-karman": "Kármán vortex street",
    "lapis-geser-turbulen": "Turbulent shear layers",
    kritis: "Past the critical number",
  },
} as const;

const TXT = {
  id: {
    title: "Deret vorteks Kármán",
    sheetTitle: "Pusaran yang terlepas bergantian di belakang silinder",
    dU: "Kecepatan datang",
    dD: "Diameter silinder",
    dF: "Frekuensi getar alami batangnya",
    fluida: "Fluida",
    air: "Air, 15 °C",
    udara: "Udara",
    pTiang: "Tiang jembatan di sungai",
    pCerobong: "Cerobong tertiup angin",
    pKunci: "Frekuensi terkunci, batangnya beresonansi",
    rRe: "Bilangan Reynolds",
    rSt: "Bilangan Strouhal",
    rF: "Frekuensi lepasnya pusaran",
    rJarak: "Jarak antar pusaran sebaris",
    rGap: "Jarak antar kedua baris",
    rNisbah: "Nisbah jarak baris terhadap jarak sebaris",
    rSelisih: "Selisih f terhadap getar alami",
    sLepas: (rz: string, f: string, st: string) => `${rz}: pusaran lepas pada f = ${f} Hz (St ${st}).`,
    sTanpa: (re: string) => `Re = ${re} < 47: belum ada pusaran yang lepas.`,
    sKunci: (fn: string) => ` Frekuensi itu terkunci pada getar alami batangnya (${fn} Hz).`,
    sAman: (fn: string) => ` Getar alami batangnya ${fn} Hz, cukup jauh.`,
    nRasio: (fu: string, ru: string, fd: string, rd: string) =>
      `Lipatduakan U: f menjadi ${fu} Hz (${ru} kali). Lipatduakan d: f menjadi ${fd} Hz (${rd} kali). Nisbahnya hanya tepat 2 dan ½ bila St tetap; di dekat batas rezim St ikut berubah.`,
    nBahaya: (fn: string, u: string) =>
      `Untuk batang dengan getar alami ${fn} Hz, kecepatan datang yang berbahaya sekitar U = fn · d / St = ${u} m/s. Kecepatan itulah yang harus diperiksa, bukan kecepatan terbesarnya.`,
    nKunci:
      "Batang yang bergoyang menggeser titik lepasnya pusaran, dan titik lepas yang bergeser memperkuat goyangannya. Penangkalnya: sirip pemecah heliks di sepertiga atas batang supaya pusarannya tidak lepas serentak.",
    nKritis:
      "Di atas Re 2·10⁵ lapis batas silinder berubah dan pelepasannya tidak lagi teratur; model ini memakai St 0,27 tetap, jadi f di pita ini perkiraan kasar.",
    nMulai: (u: string) =>
      `Pusaran mulai lepas bila Re melewati 47: pada diameter dan fluida ini, U sekurangnya ${u} m/s.`,
    jRe: "Bilangan Reynolds",
    jSt: "Bilangan Strouhal (Roshko)",
    jF: "Frekuensi lepasnya pusaran",
    jA: "Jarak antar pusaran sebaris",
    jH: "Jarak antar kedua baris",
    jKunci: "Selisih terhadap getar alami, dibandingkan jendela 20 %",
    kunci: "Frekuensi lepasnya terkunci pada getar alami batangnya",
    motionReal: "pusaran hanyut 0,87 U, waktu nyata",
    motionFast: (n: string) => `pusaran hanyut 0,87 U, waktu dipercepat ×${n}`,
    motionSlow: (n: string) => `pusaran hanyut 0,87 U, waktu diperlambat ×${n}`,
    aman: "Frekuensi lepasnya jauh dari getar alami batangnya",
    kunciNote:
      "Frekuensi lepasnya pusaran sudah berdekatan dengan frekuensi getar alami batangnya, dan pada keadaan itu keduanya saling mengunci. Yang terjadi bukan penjumlahan dua getaran melainkan satu getaran yang menguatkan dirinya sendiri: batang yang bergoyang menggeser titik lepasnya pusaran, titik lepas yang bergeser memperkuat goyangannya, dan simpangannya tumbuh sampai ditahan sesuatu yang lain. Jembatan Tacoma Narrows bukan contohnya, karena yang di sana kibasan aeroelastik, tetapi cerobong baja, kabel laut, dan tiang rambu memang runtuh karena ini, dan penangkalnya selalu sama: pasang sirip pemecah di sepertiga atas batangnya supaya pusarannya tidak dapat lepas serentak di sepanjang batang.",
    note:
      "Deret vorteks adalah salah satu dari sedikit hal dalam mekanika fluida yang dapat diramalkan hampir tanpa perhitungan. Satu bilangan, yaitu bilangan Strouhal, mendatar di sekitar nol koma dua sepanjang empat orde besaran bilangan Reynolds, dan dari situ frekuensi lepasnya pusaran mengikuti langsung dari kecepatan dibagi diameternya. Kármán sendiri menghitung susunan yang stabil dan menemukan bahwa hanya satu nisbah jarak yang bertahan, yaitu nol koma dua delapan satu, dan susunan dengan nisbah lain terurai sendiri. Dua akibat yang perlu dipegang. Pertama, gaya yang dirasakan silindernya berayun pada frekuensi itu, tegak lurus arah aliran, dan besarnya pada keadaan terkunci dapat melebihi gaya seretnya sendiri. Kedua, karena frekuensinya berbanding lurus dengan kecepatan, setiap batang yang terkena arus atau angin punya satu kecepatan tertentu yang paling berbahaya baginya, dan kecepatan itu belum tentu kecepatan terbesar yang pernah dialaminya. Batang yang selamat pada badai bisa runtuh pada angin sedang.",
  },
  en: {
    title: "Kármán vortex street",
    sheetTitle: "Vortices shedding alternately behind a cylinder",
    dU: "Approach velocity",
    dD: "Cylinder diameter",
    dF: "Natural frequency of the member",
    fluida: "Fluid",
    air: "Water, 15 °C",
    udara: "Air",
    pTiang: "A bridge pier in a river",
    pCerobong: "A chimney in the wind",
    pKunci: "Frequencies locked in, the member resonates",
    rRe: "Reynolds number",
    rSt: "Strouhal number",
    rF: "Shedding frequency",
    rJarak: "Spacing along a row",
    rGap: "Gap between the two rows",
    rNisbah: "Ratio of row gap to spacing",
    rSelisih: "Gap between f and the natural frequency",
    sLepas: (rz: string, f: string, st: string) => `${rz}: vortices shed at f = ${f} Hz (St ${st}).`,
    sTanpa: (re: string) => `Re = ${re} < 47: no vortices shed yet.`,
    sKunci: (fn: string) => ` That frequency is locked to the natural frequency of the member (${fn} Hz).`,
    sAman: (fn: string) => ` The member's natural frequency is ${fn} Hz, far enough away.`,
    nRasio: (fu: string, ru: string, fd: string, rd: string) =>
      `Double U: f becomes ${fu} Hz (${ru} times). Double d: f becomes ${fd} Hz (${rd} times). The ratios are exactly 2 and ½ only while St stays constant; near a regime boundary St changes too.`,
    nBahaya: (fn: string, u: string) =>
      `For a member with a natural frequency of ${fn} Hz, the dangerous approach velocity is about U = fn · d / St = ${u} m/s. That velocity, not the largest one, is the one to check.`,
    nKunci:
      "The swaying member moves the point where vortices leave, and the moved shedding point strengthens the sway. The remedy: helical strakes over the upper third so the vortices cannot shed in step.",
    nKritis:
      "Above Re 2·10⁵ the cylinder's boundary layer changes and shedding is no longer regular; this model uses a fixed St of 0.27, so f in this band is a rough estimate.",
    nMulai: (u: string) =>
      `Vortices start to shed once Re passes 47: for this diameter and fluid, U must be at least ${u} m/s.`,
    jRe: "Reynolds number",
    jSt: "Strouhal number (Roshko)",
    jF: "Shedding frequency",
    jA: "Spacing along a row",
    jH: "Gap between the two rows",
    jKunci: "Gap to the natural frequency, against the 20 % window",
    kunci: "The shedding frequency is locked to the natural frequency",
    motionReal: "vortices drift at 0.87 U, real time",
    motionFast: (n: string) => `vortices drift at 0.87 U, time sped up ×${n}`,
    motionSlow: (n: string) => `vortices drift at 0.87 U, time slowed ×${n}`,
    aman: "The shedding frequency is far from the natural frequency",
    kunciNote:
      "The shedding frequency now lies close to the natural frequency of the member, and in that state the two lock to each other. What happens is not the sum of two vibrations but one vibration feeding itself: the swaying member moves the point at which the vortices leave, the moved shedding point strengthens the sway, and the amplitude grows until something else stops it. Tacoma Narrows is not an example, since that was aeroelastic flutter, but steel chimneys, marine cables, and sign posts do fail this way, and the remedy is always the same: fit helical strakes over the upper third so the vortices cannot shed in step along the whole length.",
    note:
      "The vortex street is one of the few things in fluid mechanics that can be predicted with almost no calculation. One number, the Strouhal number, stays flat at about 0.2 across four decades of Reynolds number, and from it the shedding frequency follows directly from velocity over diameter. Kármán himself computed which arrangement is stable and found that only one spacing ratio survives, 0.281, with any other arrangement pulling itself apart. Two consequences are worth holding on to. First, the force felt by the cylinder oscillates at that frequency, across the flow rather than along it, and in the locked-in state it can exceed the drag itself. Second, since the frequency is proportional to velocity, every member exposed to a current or a wind has one particular velocity that is most dangerous to it, and that velocity is not necessarily the largest it has ever met. A member that survived a storm can fail in a moderate breeze.",
  },
} as const;

const REFS = {
  id: [
    "Kármán, T. von (1911). Über den Mechanismus des Widerstandes. Nachr. Ges. Wiss. Göttingen, 509–517.",
    "Roshko, A. (1954). On the development of turbulent wakes from vortex streets. NACA Report 1191.",
    "Williamson, C.H.K. (1996). Vortex dynamics in the cylinder wake. Annu. Rev. Fluid Mech. 28, 477–539.",
    "Blevins, R.D. (1990). Flow-Induced Vibration, edisi ke-2.",
  ],
  en: [
    "Kármán, T. von (1911). Über den Mechanismus des Widerstandes. Nachr. Ges. Wiss. Göttingen, 509–517.",
    "Roshko, A. (1954). On the development of turbulent wakes from vortex streets. NACA Report 1191.",
    "Williamson, C.H.K. (1996). Vortex dynamics in the cylinder wake. Annu. Rev. Fluid Mech. 28, 477–539.",
    "Blevins, R.D. (1990). Flow-Induced Vibration, 2nd ed.",
  ],
} as const;

export function VorteksKarmanClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [U, setU] = useState(1.2);
  const [d, setD] = useState(0.6);
  const [alam, setAlam] = useState(0);
  /* Nol berarti air, satu berarti udara. */
  const [fluida, setFluida] = useState(0);

  const nu = fluida === 0 ? NU_AIR : NU_UDARA;
  const r = vortexStreet(U, d, nu, alam);
  const nisbah = r.spacing > 0 ? r.rowGap / r.spacing : 0;
  /* Tanpa pelepasan (Re < 47) model memberi St, f, a, h nol; angka nol itu
     bukan hasil, jadi ditulis "—" lewat NaN. */
  const lepas = r.shedding;
  const tampil = (v: number) => (lepas ? v : NaN);
  const satuan = (u: string) => (lepas ? u : undefined);
  const selisih = alam > 0 && lepas ? Math.abs(r.frequency - alam) / alam : NaN;
  const rumusSt =
    r.reynolds < 180
      ? `St = ${fmt(0.212, 3)} − ${fmt(4.5, 1)} / Re`
      : r.reynolds < 2e5
        ? `St = ${fmt(0.212, 3)} − ${fmt(2.7, 1)} / Re`
        : `St = ${fmt(0.27, 2)}`;

  /* Lapis gerak (Phase 2): pusaran hanyut ke hilir dengan a · f = 0,87 U
     (kecepatan hanyut yang dipakai model untuk jarak a), satu pusaran baru
     per baris tiap 1/f detik. Waktu dibuat pangkat sepuluh supaya lepasnya
     pusaran terlihat (0,3 sampai 3 per detik layar), dan ditulis di catatan.
     Tanpa pelepasan (Re < 47) tidak ada yang bergerak, jadi tanpa tombol. */
  const { playing, toggle: togglePutar } = usePutar();
  const skalaWaktu = karmanTimeScale(r.frequency);
  const faktor = (v: number) =>
    Math.round(v).toLocaleString(lang === "id" ? "id-ID" : "en-US");
  const catatanGerak =
    skalaWaktu === 1
      ? x.motionReal
      : skalaWaktu > 1
        ? x.motionFast(faktor(skalaWaktu))
        : x.motionSlow(faktor(1 / skalaWaktu));
  const bergerak = playing && lepas;

  const plate = usePlate(
    (ctx, w, ch) => {
      /* Silinder, digambar sebagai lingkaran sungguhan pada skala yang sama. */
      const lingkar: { x: number; y: number }[] = [];
      for (let i = 0; i < 48; i++) {
        const a = (2 * Math.PI * i) / 48;
        lingkar.push({ x: (d / 2) * Math.cos(a), y: (d / 2) * Math.sin(a) });
      }
      const badan: FieldBody[] = [{ pts: lingkar, hatched: true, color: C.ink }];

      /* Selagi bergerak pusarannya digambar lapis gerak. */
      const pusaran: FieldMarker[] = r.shedding && !bergerak
        ? r.street.map((p) => ({
            x: p.x,
            y: p.y,
            color: p.sign > 0 ? C.water : C.critical,
            size: 6,
            filled: p.sign > 0,
          }))
        : [];

      /* Kedua baris, sebagai dua garis sumbu yang menghubungkan pusarannya. */
      const atas = r.street.filter((p) => p.sign > 0);
      const bawah = r.street.filter((p) => p.sign < 0);
      const garis: FieldLine[] = r.shedding
        ? [
            {
              pts: atas.map((p) => ({ x: p.x, y: p.y })),
              color: C.water,
              weight: W.hair,
              dash: DASH.axis,
              label: T.vortexRow,
              labelAt: 0.9,
              labelDy: -10,
              labelAlign: "right",
            },
            {
              pts: bawah.map((p) => ({ x: p.x, y: p.y })),
              color: C.critical,
              weight: W.hair,
              dash: DASH.axis,
            },
          ]
        : [];

      const dims: FieldDim[] =
        r.shedding && atas.length >= 2
          ? [
              {
                axis: "h",
                at: atas[0].y,
                from: atas[0].x,
                to: atas[1].x,
                text: `a ${fmt(r.spacing, 2)} m`,
                color: C.water,
                offset: 22,
              },
              {
                axis: "v",
                at: atas[0].x,
                from: bawah.length > 0 ? bawah[0].y : -r.rowGap / 2,
                to: atas[0].y,
                text: `h ${fmt(r.rowGap, 2)} m`,
                color: C.critical,
                offset: 24,
              },
            ]
          : [];

      const xs = r.street.map((p) => p.x);
      const xMax = xs.length > 0 ? Math.max(...xs) * 1.08 : d * 6;
      const tinggi = Math.max(r.rowGap, d) * 2.4;

      return drawField(
        ctx,
        w,
        ch,
        {
          xMin: -d * 1.6,
          xMax,
          yMin: -tinggi / 2,
          yMax: tinggi / 2,
          bodies: badan,
          lines: garis,
          markers: pusaran,
          regions: [
            { x: 0, y: -tinggi * 0.42, text: T.cylinderLabel, color: C.ink3 },
            {
              x: xMax * 0.55,
              y: tinggi * 0.42,
              text: T.wakeLabel,
              color: C.ink3,
            },
          ],
          heading: r.lockIn ? x.kunci : REZIM[lang][r.regime],
          /* Resonansi ada di dalam rentang berlaku: nada waspada, bukan
             merah sinyal. */
          headingColor: r.lockIn ? C.caution : C.ink2,
          axisX: T.axXMetre,
          axisY: T.axYMetre,
        },
        lang
      );
    },
    lepas
      ? (ctx, _w, _h, tt, _dt, out) =>
          drawKarmanMotion(ctx, tt, out, {
            d,
            spacing: r.spacing,
            rowGap: r.rowGap,
            frequency: r.frequency,
            count: r.street.length / 2,
          })
      : null,
    [U, d, alam, fluida, lang, bergerak],
    { playing, timeScale: skalaWaktu }
  );

  return (
    <LabShell
      status={
        /* Batas dari vortexStreet: 5, 47 (Williamson 1996), 200, 2e5
           (Roshko 1954, 1961). Rentang hitung 1,33 sampai 7,02e7. */
        <RegimeScale
          symbol="Re"
          value={r.reynolds}
          scale="log"
          digits={0}
          bands={[
            { from: 1, to: 5, label: REZIM[lang].merayap, tone: "neutral" },
            { from: 5, to: 47, label: REZIM[lang]["sepasang-tetap"], tone: "neutral" },
            { from: 47, to: 200, label: REZIM[lang]["deret-karman"], tone: "water" },
            { from: 200, to: 2e5, label: REZIM[lang]["lapis-geser-turbulen"], tone: "water" },
            { from: 2e5, to: 1e8, label: REZIM[lang].kritis, tone: "caution" },
          ]}
        />
      }
      sheet="FP-01"
      subject={SUBJECTS.FP[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Satu bilangan, <Term tint={C.water}>Strouhal</Term>, mendatar di
            sekitar nol koma dua sepanjang empat orde besaran, dan dari situ
            frekuensi lepasnya pusaran mengikuti langsung. Setiap batang punya
            satu <Term tint={C.critical}>kecepatan paling berbahaya</Term>.
          </p>
        ) : (
          <p>
            One number, the <Term tint={C.water}>Strouhal number</Term>, stays
            flat near 0.2 across four decades, and the shedding frequency
            follows straight from it. Every member has one{" "}
            <Term tint={C.critical}>most dangerous velocity</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FP-01"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m/s, Hz)" },
            { label: "Re", value: fmtSci(r.reynolds) },
            { label: "St", value: fmt(tampil(r.strouhal), 3), tint: C.water },
            {
              label: "f",
              value: lepas ? `${fmt(r.frequency, 2)} Hz` : "—",
              tint: r.lockIn ? C.caution : C.critical,
            },
            { label: "h/a", value: fmt(tampil(nisbah), 3) },
          ]}
          motion={{
            playing,
            onToggle: togglePutar,
            allowed: plate.motionAllowed,
            note: catatanGerak,
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
              <InputRow symbol="U" label={x.dU} value={U} min={0.02} max={40} step={0.02} digits={2} unit="m/s" onChange={setU} tint={C.water} />
              <InputRow symbol="d" label={x.dD} value={d * 1000} min={1} max={2000} step={1} digits={0} unit="mm" onChange={(v) => setD(v / 1000)} />
              <InputRow symbol="fn" label={x.dF} value={alam} min={0} max={30} step={0.1} digits={1} unit="Hz" onChange={setAlam} tint={C.critical} />
            </InputTable>

            <div className="mt-3.5 flex flex-col gap-2">
              <PresetRow
                label={x.fluida}
                active={fluida}
                presets={[
                  { label: x.air, apply: () => setFluida(0) },
                  { label: x.udara, apply: () => setFluida(1) },
                ]}
              />
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pTiang, apply: () => { setU(1.2); setD(0.6); setAlam(0); setFluida(0); } },
                  { label: x.pCerobong, apply: () => { setU(12); setD(1.2); setAlam(0); setFluida(1); } },
                  { label: x.pKunci, apply: () => { setU(12); setD(1.2); setAlam(2.7); setFluida(1); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "Re", label: x.rRe, value: fmtSci(r.reynolds), strong: true },
                { symbol: "St", label: x.rSt, value: fmt(tampil(r.strouhal), 4), tint: C.water, strong: true },
                { symbol: "f", label: x.rF, value: fmt(tampil(r.frequency), 3), unit: satuan("Hz"), tint: r.lockIn ? C.caution : C.critical, strong: true },
                { symbol: "a", label: x.rJarak, value: fmt(tampil(r.spacing), 3), unit: satuan("m") },
                { symbol: "h", label: x.rGap, value: fmt(tampil(r.rowGap), 3), unit: satuan("m") },
                { symbol: "h/a", label: x.rNisbah, value: fmt(tampil(nisbah), 4) },
                ...(alam > 0
                  ? [{ symbol: "|f−fn|/fn", label: x.rSelisih, value: fmt(selisih * 100, 1), unit: lepas ? "%" : undefined, tint: r.lockIn ? C.caution : undefined }]
                  : []),
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.jRe,
                    rumus: (<><span>Re =</span><Frac num="U · d" den="ν" /></>),
                    isi: `${fmt(U, 2)} · ${fmt(d, 3)} / ${fmtSci(nu)}`,
                    hasil: fmtSci(r.reynolds),
                  },
                  {
                    judul: x.jSt,
                    rumus: <span>{lepas ? rumusSt : "Re < 47"}</span>,
                    isi: !lepas
                      ? "—"
                      : r.reynolds < 2e5
                        ? `${fmt(0.212, 3)} − ${fmt(r.reynolds < 180 ? 4.5 : 2.7, 1)} / ${fmtSci(r.reynolds)}`
                        : fmt(0.27, 2),
                    hasil: fmt(tampil(r.strouhal), 4),
                    tint: C.water,
                  },
                  {
                    judul: x.jF,
                    rumus: (<><span>f =</span><Frac num="St · U" den="d" /></>),
                    isi: lepas ? `${fmt(r.strouhal, 4)} · ${fmt(U, 2)} / ${fmt(d, 3)}` : "—",
                    hasil: fmt(tampil(r.frequency), 3),
                    satuan: satuan("Hz"),
                    tint: r.lockIn ? C.caution : C.critical,
                  },
                  {
                    judul: x.jA,
                    rumus: (<><span>a =</span><Frac num={`${fmt(0.87, 2)} · U`} den="f" /></>),
                    isi: lepas ? `${fmt(0.87, 2)} · ${fmt(U, 2)} / ${fmt(r.frequency, 4)}` : "—",
                    hasil: fmt(tampil(r.spacing), 3),
                    satuan: satuan("m"),
                  },
                  {
                    judul: x.jH,
                    rumus: <span>h = {fmt(KARMAN_SPACING, 3)} · a</span>,
                    isi: lepas ? `${fmt(KARMAN_SPACING, 3)} · ${fmt(r.spacing, 4)}` : "—",
                    hasil: fmt(tampil(r.rowGap), 3),
                    satuan: satuan("m"),
                  },
                  ...(alam > 0
                    ? [
                        {
                          judul: x.jKunci,
                          rumus: <span>|f − fn| / fn · 100</span>,
                          isi: lepas ? `| ${fmt(r.frequency, 4)} − ${fmt(alam, 1)} | / ${fmt(alam, 1)} · 100` : "—",
                          hasil: fmt(selisih * 100, 1),
                          satuan: lepas ? "%" : undefined,
                          tint: r.lockIn ? C.caution : undefined,
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={!lepas ? "neutral" : r.lockIn || r.regime === "kritis" ? "caution" : "water"}
            badge={r.lockIn ? x.kunci : REZIM[lang][r.regime]}
            state={
              lepas
                ? x.sLepas(REZIM[lang][r.regime], fmt(r.frequency, 2), fmt(r.strouhal, 3)) +
                  (alam > 0 ? (r.lockIn ? x.sKunci(fmt(alam, 1)) : x.sAman(fmt(alam, 1))) : "")
                : x.sTanpa(fmt(r.reynolds, 1))
            }
            notice={notice(U, d, nu, alam, lang)}
          />
        </>
      }
      verification={<Verification checks={checksVortexStreet(U, d, nu, alam)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>St =</span>
                <Frac num="f d" den="U" />
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "mendatar di sekitar 0,2 pada Re 300 sampai 200.000"
                    : "flat near 0.2 for Re from 300 to 200,000"}
                </span>
              </Eq>
              <Eq>
                <Frac num="h" den="a" />
                <span>= {fmt(KARMAN_SPACING, 3)}</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "satu-satunya nisbah yang susunannya bertahan, menurut Kármán"
                    : "the only ratio whose arrangement survives, after Kármán"}
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
 * Nisbah f ditulis dari hasil hitung, bukan "berlipat dua": di dekat batas
 * rezim St ikut berubah (Re 133 → ×2,27; Re 1,2·10⁵ → ×2,55 karena St
 * meloncat ke 0,27 di 2·10⁵).
 */
function notice(U: number, d: number, nu: number, alam: number, lang: Lang): string[] {
  const x = TXT[lang];
  const a = vortexStreet(U, d, nu, alam);
  if (!a.shedding) return [x.nMulai(fmt((47 * nu) / d, 3))];
  const cepat = vortexStreet(U * 2, d, nu, alam);
  const besar = vortexStreet(U, d * 2, nu, alam);
  const out: string[] = [
    x.nRasio(
      fmt(cepat.frequency, 2),
      fmt(cepat.frequency / a.frequency, 2),
      fmt(besar.frequency, 2),
      fmt(besar.frequency / a.frequency, 2)
    ),
  ];
  if (alam > 0) out.push(x.nBahaya(fmt(alam, 1), fmt((alam * d) / a.strouhal, 2)));
  if (a.lockIn) out.push(x.nKunci);
  if (a.regime === "kritis") out.push(x.nKritis);
  return out;
}
