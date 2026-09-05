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
import { drawVenturi } from "@/lib/drawVenturi";
import {
  VENTURI_BETA_MAX,
  VENTURI_BETA_MIN,
  VENTURI_C_CAST,
  VENTURI_C_MACHINED,
  VENTURI_C_WELDED,
  fmt,
  venturiDischarge,
  type VenturiResult,
} from "@/lib/hydraulics";
import { C } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksVenturi } from "@/lib/checks";

const TXT = {
  id: {
    title: "Venturi",
    sheetTitle: "Tabung venturi klasik — garis tinggi tekan dan potongan pipa",
    dD1: "Garis tengah pipa",
    dD2: "Garis tengah leher",
    ddh: "Beda tinggi tekan terbaca",
    dC: "Koefisien debit",
    pMesin: "Leher hasil pemesinan",
    pCor: "Leher hasil cor",
    pLas: "Pelat besi dilas",
    rQ: "Debit",
    rBeta: "Perbandingan garis tengah",
    rV1: "Kecepatan di pipa",
    rV2: "Kecepatan di leher",
    rFaktor: "Faktor kecepatan datang",
    rLoss: "Kehilangan tekanan tetap",
    rLossPct: "Bagian beda tekanan yang tidak pulih",
    rTanpa: "Debit bila faktor kecepatan datang diabaikan",
    rSalah: "Kesalahan bila faktor itu diabaikan",
    luar: "Di luar perbandingan yang lazim",
    luarKecil:
      "Perbandingan garis tengah di bawah 0,3. Leher sesempit itu menghasilkan kecepatan yang sangat tinggi dan beda tekanan yang besar, tetapi juga mendekatkan tekanan di leher ke tekanan uap, sehingga kavitasi menjadi risiko nyata. Koefisien debit terbitan juga tidak dijamin berlaku di luar rentang itu.",
    luarBesar:
      "Perbandingan garis tengah di atas 0,75. Beda tekanan yang dihasilkan menjadi terlalu kecil untuk dibaca dengan teliti, dan faktor kecepatan datang membesar cepat sehingga kesalahan kecil pada garis tengah berubah menjadi kesalahan besar pada debit.",
    note:
      "Satu suku pada rumus ini yang paling sering hilang, dan hilangnya selalu ke arah yang sama. Beda tekanan yang terbaca bukan mengukur tinggi kecepatan di leher melainkan SELISIH tinggi kecepatan antara leher dan pipa, karena air di pipa sudah bergerak sebelum masuk. Mengabaikan hal itu membuat debit yang dihitung selalu lebih kecil daripada yang sebenarnya, dan besarnya kesalahan naik cepat terhadap perbandingan garis tengah: pada 0,5 sekitar tiga persen, pada 0,75 sudah lebih dari dua puluh persen. Faktor kecepatan datang pada tabel di samping adalah suku itu, dan lembar ini menghitung debit dengan dan tanpa suku itu supaya selisihnya terbaca sebagai angka. Hal kedua yang membedakan venturi dari pelat lubang terbaca pada panel atas: garis tinggi tekan menukik di leher lalu naik kembali hampir setinggi semula. Bagian yang tidak pulih itulah kehilangan tetap, dan kecilnya bagian itu berutang pada bagian membesar yang sengaja dibuat panjang dan landai, sehingga aliran tidak sempat terlepas dari dinding.",
  },
  en: {
    title: "Venturi meter",
    sheetTitle: "Classical Venturi tube — pressure head line and pipe section",
    dD1: "Pipe diameter",
    dD2: "Throat diameter",
    ddh: "Head difference read",
    dC: "Discharge coefficient",
    pMesin: "Machined throat",
    pCor: "As-cast throat",
    pLas: "Welded sheet iron",
    rQ: "Discharge",
    rBeta: "Diameter ratio",
    rV1: "Velocity in the pipe",
    rV2: "Velocity in the throat",
    rFaktor: "Velocity of approach factor",
    rLoss: "Permanent pressure loss",
    rLossPct: "Fraction of the head difference not recovered",
    rTanpa: "Discharge if the approach factor is ignored",
    rSalah: "Error from ignoring that factor",
    luar: "Outside the usual ratio",
    luarKecil:
      "The diameter ratio is below 0.3. A throat that narrow gives very high velocity and a large pressure difference, but it also brings the throat pressure close to vapour pressure, so cavitation becomes a real risk. The published discharge coefficient is not guaranteed outside that range either.",
    luarBesar:
      "The diameter ratio is above 0.75. The pressure difference produced becomes too small to read accurately, and the velocity of approach factor grows quickly, so a small error in diameter turns into a large error in discharge.",
    note:
      "One term in this formula goes missing more often than any other, and it always goes missing in the same direction. The measured pressure difference does not measure the velocity head in the throat but the DIFFERENCE in velocity head between throat and pipe, because the water in the pipe is already moving before it enters. Ignoring that makes the computed discharge always smaller than the real one, and the size of the error climbs quickly with the diameter ratio: about three per cent at 0.5, more than twenty per cent at 0.75. The velocity of approach factor in the table beside the drawing is that term, and this sheet computes the discharge both with and without it so the difference can be read as a number. The second thing that separates a Venturi from an orifice plate can be read on the upper panel: the pressure head line dips at the throat and then climbs back almost to where it started. What does not come back is the permanent loss, and how little that is owes everything to the long, gentle diverging section, which gives the flow no chance to separate from the wall.",
  },
} as const;

const REFS = {
  id: [
    "ISO 5167-4. Measurement of fluid flow by means of pressure differential devices — Venturi tubes.",
    "Miller, R.W. (1996). Flow Measurement Engineering Handbook, edisi ke-3. McGraw-Hill.",
    "Venturi, G.B. (1797). Recherches Experimentales sur le Principe de la Communication Laterale du Mouvement dans les Fluides.",
    "White, F.M. (2011). Fluid Mechanics, edisi ke-7. McGraw-Hill. Bab 6, alat ukur beda tekanan.",
  ],
  en: [
    "ISO 5167-4. Measurement of fluid flow by means of pressure differential devices — Venturi tubes.",
    "Miller, R.W. (1996). Flow Measurement Engineering Handbook, 3rd ed. McGraw-Hill.",
    "Venturi, G.B. (1797). Recherches Experimentales sur le Principe de la Communication Laterale du Mouvement dans les Fluides.",
    "White, F.M. (2011). Fluid Mechanics, 7th ed. McGraw-Hill. Chapter 6, differential pressure meters.",
  ],
} as const;

export function VenturiClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [D1, setD1] = useState(0.2);
  const [D2, setD2] = useState(0.1);
  const [dh, setDh] = useState(0.5);
  const [Cc, setCc] = useState(VENTURI_C_MACHINED);

  const r = venturiDischarge(D1, D2, dh, Cc);
  const tanpaFaktor = r.Q / r.approachFactor;
  const salah = ((r.Q - tanpaFaktor) / r.Q) * 100;

  const ref = useCanvas(
    (ctx, w, h) =>
      drawVenturi(
        ctx,
        w,
        h,
        {
          D1,
          D2,
          V1: r.V1,
          V2: r.V2,
          dh,
          permanentLoss: r.permanentLoss,
          outOfRange: r.outOfRange,
        },
        lang
      ),
    [D1, D2, dh, Cc, lang]
  );

  const alasan =
    r.reason === "beta-kecil" ? x.luarKecil : r.reason === "beta-besar" ? x.luarBesar : "";

  return (
    <LabShell
      sheet="FM-02"
      subject={SUBJECTS.FM[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Penyempitan memaksa air mempercepat diri, dan percepatan itu
            dibayar dengan <Term tint={C.energy}>tekanan</Term>. Yang terbaca
            pada manometer bukan tinggi kecepatan di leher, melainkan selisih
            tinggi kecepatan antara leher dan pipa, dan selisih itulah yang
            paling sering terlupa.
          </p>
        ) : (
          <p>
            A contraction forces the water to speed up, and that acceleration
            is paid for in <Term tint={C.energy}>pressure</Term>. What the
            manometer reads is not the velocity head in the throat but the
            difference in velocity head between throat and pipe, and that
            difference is the term most often forgotten.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FM-02"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "β", value: fmt(r.beta, 3), tint: r.outOfRange ? C.signal : undefined },
            { label: "Δh", value: `${fmt(dh, 3)} m`, tint: C.energy },
            { label: "Q", value: `${fmt(r.Q * 1000, 1)} l/s`, tint: C.water },
            { label: "C", value: fmt(Cc, 3) },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="D₁" label={x.dD1} value={D1 * 1000} min={25} max={600} step={5} digits={0} unit="mm" onChange={(v) => setD1(v / 1000)} />
              <InputRow symbol="D₂" label={x.dD2} value={D2 * 1000} min={10} max={500} step={5} digits={0} unit="mm" onChange={(v) => setD2(v / 1000)} tint={C.signal} />
              <InputRow symbol="Δh" label={x.ddh} value={dh} min={0.01} max={5} step={0.01} digits={2} unit="m" onChange={setDh} tint={C.energy} />
              <InputRow symbol="C" label={x.dC} value={Cc} min={0.95} max={1} step={0.001} digits={3} onChange={setCc} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pMesin, apply: () => { setD1(0.2); setD2(0.1); setDh(0.5); setCc(VENTURI_C_MACHINED); } },
                  { label: x.pCor, apply: () => { setD1(0.3); setD2(0.15); setDh(0.35); setCc(VENTURI_C_CAST); } },
                  { label: x.pLas, apply: () => { setD1(0.5); setD2(0.3); setDh(0.2); setCc(VENTURI_C_WELDED); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={C.water}>{`${fmt(r.Q * 1000, 1)} l/s`}</Flag>
              {r.outOfRange && <Flag alert>{x.luar}</Flag>}
            </div>
            {r.outOfRange && (
              <div className="mb-2.5">
                <Note>{alasan}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "Q", label: x.rQ, value: fmt(r.Q * 1000, 2), unit: "l/s", tint: C.water, strong: true },
                { symbol: "β", label: x.rBeta, value: fmt(r.beta, 4), tint: r.outOfRange ? C.signal : undefined, strong: true },
                { symbol: "E", label: x.rFaktor, value: fmt(r.approachFactor, 4), tint: C.energy },
                { symbol: "Q′", label: x.rTanpa, value: fmt(tanpaFaktor * 1000, 2), unit: "l/s", tint: C.ink3 },
                { symbol: "ε", label: x.rSalah, value: fmt(salah, 2), unit: "%", tint: C.signal },
                { symbol: "V₁", label: x.rV1, value: fmt(r.V1, 3), unit: "m/s" },
                { symbol: "V₂", label: x.rV2, value: fmt(r.V2, 3), unit: "m/s", tint: C.water },
                { symbol: "hL", label: x.rLoss, value: fmt(r.permanentLoss, 4), unit: "m", tint: C.signal },
                { symbol: "%", label: x.rLossPct, value: fmt(dh > 0 ? (r.permanentLoss / dh) * 100 : 0, 1), unit: "%" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(r, salah, dh, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksVenturi(D1, D2, dh, Cc)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Q = C</span>
                <Frac num="1" den="√(1 − β⁴)" />
                <span>A₂ √(2 g Δh)</span>
                <span className="ml-5">β =</span>
                <Frac num="D₂" den="D₁" />
              </Eq>
              <Eq>
                <span>Δh =</span>
                <Frac num="V₂² − V₁²" den="2g" />
                <span className="ml-5">{VENTURI_BETA_MIN} ≤ β ≤ {VENTURI_BETA_MAX}</span>
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

function notice(r: VenturiResult, salah: number, dh: number, lang: Lang): string {
  const pulih = dh > 0 ? (1 - r.permanentLoss / dh) * 100 : 0;

  if (lang === "en")
    return `At a diameter ratio of ${r.beta.toFixed(3)} the velocity of approach factor is ${r.approachFactor.toFixed(4)}, so leaving it out would understate the discharge by ${salah.toFixed(2)} per cent. Push the throat diameter up toward the pipe diameter and watch that error grow far faster than the ratio does. On the upper panel, ${pulih.toFixed(0)} per cent of the head difference comes back downstream; an orifice plate at the same ratio would return far less, and that recovery is the whole reason a Venturi costs more.`;
  return `Pada perbandingan garis tengah ${r.beta.toFixed(3)}, faktor kecepatan datangnya ${r.approachFactor.toFixed(4)}, sehingga melupakannya akan mengecilkan debit sebesar ${salah.toFixed(2)} persen. Naikkan garis tengah leher mendekati garis tengah pipa, lalu perhatikan kesalahan itu bertambah jauh lebih cepat daripada perbandingannya sendiri. Pada panel atas, ${pulih.toFixed(0)} persen dari beda tinggi tekan kembali di hilir; pelat lubang pada perbandingan yang sama mengembalikan jauh lebih sedikit, dan pemulihan itulah seluruh alasan venturi lebih mahal.`;
}
