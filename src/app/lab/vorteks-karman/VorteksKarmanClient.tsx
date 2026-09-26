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
    dD: "Garis tengah silinder",
    dF: "Kekerapan getar alami batangnya",
    fluida: "Fluida",
    air: "Air, 15 °C",
    udara: "Udara",
    pTiang: "Tiang jembatan di sungai",
    pCerobong: "Cerobong tertiup angin",
    pKunci: "Kekerapan terkunci, batangnya beresonansi",
    rRe: "Bilangan Reynolds",
    rSt: "Bilangan Strouhal",
    rF: "Kekerapan lepasnya pusaran",
    rJarak: "Jarak antar pusaran sebaris",
    rGap: "Jarak antar kedua baris",
    rNisbah: "Nisbah jarak baris terhadap jarak sebaris",
    rNada: "Nada yang terdengar",
    kunci: "Kekerapan lepasnya terkunci pada getar alami batangnya",
    aman: "Kekerapan lepasnya jauh dari getar alami batangnya",
    kunciNote:
      "Kekerapan lepasnya pusaran sudah berdekatan dengan kekerapan getar alami batangnya, dan pada keadaan itu keduanya saling mengunci. Yang terjadi bukan penjumlahan dua getaran melainkan satu getaran yang menguatkan dirinya sendiri: batang yang bergoyang menggeser titik lepasnya pusaran, titik lepas yang bergeser memperkuat goyangannya, dan simpangannya tumbuh sampai ditahan sesuatu yang lain. Jembatan Tacoma Narrows bukan contohnya, karena yang di sana kibasan aeroelastik, tetapi cerobong baja, kabel laut, dan tiang rambu memang runtuh karena ini, dan penangkalnya selalu sama: pasang sirip pemecah di sepertiga atas batangnya supaya pusarannya tidak dapat lepas serentak di sepanjang batang.",
    note:
      "Deret vorteks adalah salah satu dari sedikit hal dalam mekanika fluida yang dapat diramalkan hampir tanpa perhitungan. Satu bilangan, yaitu bilangan Strouhal, mendatar di sekitar nol koma dua sepanjang empat orde besaran bilangan Reynolds, dan dari situ kekerapan lepasnya pusaran mengikuti langsung dari kecepatan dibagi garis tengahnya. Kármán sendiri menghitung susunan yang stabil dan menemukan bahwa hanya satu nisbah jarak yang bertahan, yaitu nol koma dua delapan satu, dan susunan dengan nisbah lain terurai sendiri. Dua akibat yang perlu dipegang. Pertama, gaya yang dirasakan silindernya berayun pada kekerapan itu, tegak lurus arah aliran, dan besarnya pada keadaan terkunci dapat melebihi gaya seretnya sendiri. Kedua, karena kekerapannya berbanding lurus dengan kecepatan, setiap batang yang terkena arus atau angin punya satu kecepatan tertentu yang paling berbahaya baginya, dan kecepatan itu belum tentu kecepatan terbesar yang pernah dialaminya. Batang yang selamat pada badai bisa runtuh pada angin sedang.",
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
    rNada: "Tone that is heard",
    kunci: "The shedding frequency is locked to the natural frequency",
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

  const ref = useCanvas(
    (ctx, w, ch) => {
      /* Silinder, digambar sebagai lingkaran sungguhan pada skala yang sama. */
      const lingkar: { x: number; y: number }[] = [];
      for (let i = 0; i < 48; i++) {
        const a = (2 * Math.PI * i) / 48;
        lingkar.push({ x: (d / 2) * Math.cos(a), y: (d / 2) * Math.sin(a) });
      }
      const badan: FieldBody[] = [{ pts: lingkar, hatched: true, color: C.ink }];

      const pusaran: FieldMarker[] = r.shedding
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

      drawField(
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
          headingColor: r.lockIn ? C.signal : C.ink2,
          axisX: T.axXMetre,
          axisY: T.axYMetre,
        },
        lang
      );
    },
    [U, d, alam, fluida, lang]
  );

  return (
    <LabShell
      sheet="FP-01"
      subject={SUBJECTS.FP[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Satu bilangan, <Term tint={C.water}>Strouhal</Term>, mendatar di
            sekitar nol koma dua sepanjang empat orde besaran, dan dari situ
            kekerapan lepasnya pusaran mengikuti langsung. Setiap batang punya
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
            { label: "St", value: fmt(r.strouhal, 3), tint: C.water },
            {
              label: "f",
              value: `${fmt(r.frequency, 2)} Hz`,
              tint: r.lockIn ? C.signal : C.critical,
            },
            { label: "h/a", value: fmt(nisbah, 3) },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
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
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={C.ink2}>{REZIM[lang][r.regime]}</Flag>
              {alam > 0 && (
                <Flag tint={r.lockIn ? undefined : C.water} alert={r.lockIn}>
                  {r.lockIn ? x.kunci : x.aman}
                </Flag>
              )}
            </div>
            {r.lockIn && (
              <div className="mb-2.5">
                <Note>{x.kunciNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "Re", label: x.rRe, value: fmtSci(r.reynolds), strong: true },
                { symbol: "St", label: x.rSt, value: fmt(r.strouhal, 4), tint: C.water, strong: true },
                { symbol: "f", label: x.rF, value: fmt(r.frequency, 3), unit: "Hz", tint: r.lockIn ? C.signal : C.critical, strong: true },
                { symbol: "a", label: x.rJarak, value: fmt(r.spacing, 3), unit: "m" },
                { symbol: "h", label: x.rGap, value: fmt(r.rowGap, 3), unit: "m" },
                { symbol: "h/a", label: x.rNisbah, value: fmt(nisbah, 4) },
                { symbol: "fn", label: x.rNada, value: fmt(r.toneHz, 2), unit: "Hz" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(U, d, nu, alam, lang)}</Note>
          </Block>
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

function notice(U: number, d: number, nu: number, alam: number, lang: Lang) {
  const a = vortexStreet(U, d, nu, alam);
  const cepat = vortexStreet(U * 2, d, nu, alam);
  const besar = vortexStreet(U, d * 2, nu, alam);
  const bahaya = alam > 0 && a.strouhal > 0 ? (alam * d) / a.strouhal : 0;

  if (lang === "en")
    return `The vortices leave at ${fmt(a.frequency, 2)} hertz. Double the velocity and the frequency doubles to ${fmt(cepat.frequency, 2)}; double the diameter instead and it halves to ${fmt(besar.frequency, 2)}. Both follow from one flat Strouhal number and nothing else.${alam > 0 ? ` For a member whose natural frequency is ${fmt(alam, 1)} hertz, the dangerous approach velocity is about ${fmt(bahaya, 2)} metres a second, and it is that velocity, not the largest one, that has to be checked.` : ""}`;
  return `Pusarannya lepas pada ${fmt(a.frequency, 2)} hertz. Lipatduakan kecepatannya dan kekerapannya ikut berlipat dua menjadi ${fmt(cepat.frequency, 2)}; lipatduakan garis tengahnya dan ia justru separuh, menjadi ${fmt(besar.frequency, 2)}. Keduanya mengikuti satu bilangan Strouhal yang mendatar dan bukan yang lain.${alam > 0 ? ` Untuk batang yang kekerapan getar alaminya ${fmt(alam, 1)} hertz, kecepatan datang yang berbahaya sekitar ${fmt(bahaya, 2)} meter tiap detik, dan kecepatan itulah yang harus diperiksa, bukan kecepatan terbesarnya.` : ""}`;
}
