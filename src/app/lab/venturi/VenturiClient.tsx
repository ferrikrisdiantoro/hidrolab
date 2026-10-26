"use client";

import { useRef, useState } from "react";
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
import {
  createVenturiMotion,
  drawVenturi,
  drawVenturiMotion,
  venturiTimeScale,
  venturiTransitTime,
  type VenturiMotion,
} from "@/lib/drawVenturi";
import {
  G,
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
    motionNote: (lipat: string, skala: string) =>
      `goresan air di pipa: kecepatan u = Q/A setempat, di leher ${lipat}× kecepatan di pipa; ${skala}`,
    waktuNyata: "waktu nyata",
    diperlambat: (k: string) => `waktu diperlambat ×${k}`,
    dipercepat: (k: string) => `waktu dipercepat ×${k}`,
    sheetTitle: "Tabung venturi klasik — garis tinggi tekan dan potongan pipa",
    dD1: "Diameter pipa",
    dD2: "Diameter leher",
    ddh: "Beda tinggi tekan terbaca",
    dC: "Koefisien debit",
    pMesin: "Leher hasil pemesinan",
    pCor: "Leher hasil cor",
    pLas: "Pelat besi dilas",
    rQ: "Debit",
    rBeta: "Perbandingan diameter",
    rV1: "Kecepatan di pipa",
    rV2: "Kecepatan di leher",
    rFaktor: "Faktor kecepatan datang",
    rLoss: "Kehilangan tekanan tetap",
    rLossPct: "Bagian beda tekanan yang tidak pulih",
    rTanpa: "Debit bila faktor kecepatan datang diabaikan",
    rSalah: "Kesalahan bila faktor itu diabaikan",
    luar: "Di luar perbandingan yang lazim",
    sah: "Dalam rentang ISO 5167-4",
    indikatif: "indikatif",
    bandBawah: "Di bawah rentang ISO",
    bandIso: "Rentang ISO 5167-4",
    bandAtas: "Di atas rentang ISO",
    bandBukan: "Bukan venturi",
    hBukan: "β ≥ 1: tidak ada penyempitan",
    hLuas: "Luas leher dan debit",
    hV: "Kecepatan di pipa dan di leher",
    hSalah: "Debit tanpa faktor, kesalahannya, dan kehilangan tetap",
    bukan: "Leher tidak lebih sempit dari pipa",
    bukanNote:
      "Diameter leher sama dengan atau lebih besar daripada diameter pipa, jadi tidak ada penyempitan dan tidak ada percepatan. Rumus venturi membagi dengan akar dari satu dikurangi beta pangkat empat, yang nol pada beta satu, sehingga tidak ada debit yang dapat dihitung. Bacaan manometer yang dimasukkan pun tidak punya arti pada geometri ini. Kecilkan diameter lehernya.",
    luarKecil:
      "Perbandingan diameter di bawah 0,3. Leher sesempit itu menghasilkan kecepatan yang sangat tinggi dan beda tekanan yang besar, tetapi juga mendekatkan tekanan di leher ke tekanan uap, sehingga kavitasi menjadi risiko nyata. Koefisien debit terbitan juga tidak dijamin berlaku di luar rentang itu.",
    luarBesar:
      "Perbandingan diameter di atas 0,75. Beda tekanan yang dihasilkan menjadi terlalu kecil untuk dibaca dengan teliti, dan faktor kecepatan datang membesar cepat sehingga kesalahan kecil pada diameter berubah menjadi kesalahan besar pada debit.",
    note:
      "Satu suku pada rumus ini yang paling sering hilang, dan hilangnya selalu ke arah yang sama. Beda tekanan yang terbaca bukan mengukur tinggi kecepatan di leher melainkan SELISIH tinggi kecepatan antara leher dan pipa, karena air di pipa sudah bergerak sebelum masuk. Mengabaikan hal itu membuat debit yang dihitung selalu lebih kecil daripada yang sebenarnya, dan besarnya kesalahan naik cepat terhadap perbandingan diameter: pada 0,5 sekitar tiga persen, pada 0,75 sekitar tujuh belas persen. Faktor kecepatan datang pada tabel di samping adalah suku itu, dan lembar ini menghitung debit dengan dan tanpa suku itu supaya selisihnya terbaca sebagai angka. Hal kedua yang membedakan venturi dari pelat lubang terbaca pada panel atas: garis tinggi tekan menukik di leher lalu naik kembali hampir setinggi semula. Bagian yang tidak pulih itulah kehilangan tetap, dan kecilnya bagian itu berutang pada bagian membesar yang sengaja dibuat panjang dan landai, sehingga aliran tidak sempat terlepas dari dinding.",
  },
  en: {
    motionNote: (lipat: string, skala: string) =>
      `water streaks in the pipe: local speed u = Q/A, ${lipat}× the pipe speed in the throat; ${skala}`,
    waktuNyata: "real time",
    diperlambat: (k: string) => `time slowed ×${k}`,
    dipercepat: (k: string) => `time sped up ×${k}`,
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
    sah: "Within ISO 5167-4",
    indikatif: "indicative",
    bandBawah: "Below ISO range",
    bandIso: "ISO 5167-4 range",
    bandAtas: "Above ISO range",
    bandBukan: "Not a venturi",
    hBukan: "β ≥ 1: there is no contraction",
    hLuas: "Throat area and discharge",
    hV: "Velocity in the pipe and in the throat",
    hSalah: "Discharge without the factor, its error, and the permanent loss",
    bukan: "Throat no narrower than the pipe",
    bukanNote:
      "The throat diameter equals or exceeds the pipe diameter, so there is no contraction and no acceleration. The venturi formula divides by the square root of one minus beta to the fourth, which is zero at beta one, so no discharge can be computed. The manometer reading entered has no meaning for this geometry either. Reduce the throat diameter.",
    luarKecil:
      "The diameter ratio is below 0.3. A throat that narrow gives very high velocity and a large pressure difference, but it also brings the throat pressure close to vapour pressure, so cavitation becomes a real risk. The published discharge coefficient is not guaranteed outside that range either.",
    luarBesar:
      "The diameter ratio is above 0.75. The pressure difference produced becomes too small to read accurately, and the velocity of approach factor grows quickly, so a small error in diameter turns into a large error in discharge.",
    note:
      "One term in this formula goes missing more often than any other, and it always goes missing in the same direction. The measured pressure difference does not measure the velocity head in the throat but the DIFFERENCE in velocity head between throat and pipe, because the water in the pipe is already moving before it enters. Ignoring that makes the computed discharge always smaller than the real one, and the size of the error climbs quickly with the diameter ratio: about three per cent at 0.5, about seventeen per cent at 0.75. The velocity of approach factor in the table beside the drawing is that term, and this sheet computes the discharge both with and without it so the difference can be read as a number. The second thing that separates a Venturi from an orifice plate can be read on the upper panel: the pressure head line dips at the throat and then climbs back almost to where it started. What does not come back is the permanent loss, and how little that is owes everything to the long, gentle diverging section, which gives the flow no chance to separate from the wall.",
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
  const bukan = r.reason === "bukan-venturi";
  const tanpaFaktor = bukan ? 0 : r.Q / r.approachFactor;
  const salah = bukan ? 0 : ((r.Q - tanpaFaktor) / r.Q) * 100;
  const takAda = "—";

  /* Lapis gerak (Phase 2): goresan air di dalam pipa dengan kecepatan
     u(x) = Q/A(x) dari venturiDischarge, jadi di leher tepat (D₁/D₂)² kali
     lebih cepat. Skala waktu dari waktu tempuh fisik seluruh pipa (tangga
     1-2-5) dan ditulis di bawah gambar. Panah aliran diam hanya saat
     dijeda atau reduced-motion; bukan venturi = tanpa gerak, panah tetap. */
  const { playing, toggle: togglePutar } = usePutar();
  const gerak = useRef<VenturiMotion | null>(null);
  if (gerak.current === null) gerak.current = createVenturiMotion(70);
  const Qgerak = bukan ? 0 : r.Q;
  const skalaWaktu = venturiTimeScale(venturiTransitTime(D1, D2, Qgerak));
  const bergerak = playing && !bukan;
  const plate = usePlate(
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
          notVenturi: bukan,
          flow: bergerak,
        },
        lang
      ),
    bukan
      ? null
      : (ctx, _w, _h, tt, _dt, out) =>
          drawVenturiMotion(ctx, tt, out, { D1, D2, Q: Qgerak, notVenturi: bukan }, gerak.current!),
    [D1, D2, dh, Cc, lang, bergerak],
    { playing: bergerak, timeScale: skalaWaktu }
  );
  const teksSkala =
    skalaWaktu === 1
      ? x.waktuNyata
      : skalaWaktu < 1
        ? x.diperlambat(fmt(1 / skalaWaktu, 0))
        : x.dipercepat(fmt(skalaWaktu, 0));
  const catatanGerak = x.motionNote(fmt((D1 / D2) * (D1 / D2), 2), teksSkala);

  const alasan =
    r.reason === "beta-kecil"
      ? x.luarKecil
      : r.reason === "beta-besar"
        ? x.luarBesar
        : r.reason === "bukan-venturi"
          ? x.bukanNote
          : "";

  /* β di luar rentang ISO: C terbitan tidak berlaku, jadi debit tetap
     ditulis tetapi bertanda indikatif dengan merah sinyal. */
  const luarSah = r.outOfRange && !bukan;
  const tintQ = luarSah ? C.signal : C.water;
  const tandaQ = luarSah ? ` (${x.indikatif})` : "";
  const A1 = (Math.PI / 4) * D1 * D1;
  const A2 = (Math.PI / 4) * D2 * D2;
  const fLoss = 0.218 - 0.42 * r.beta + 0.38 * r.beta * r.beta;

  const langkah = [
    {
      judul: x.rBeta,
      rumus: (<><span>β =</span><Frac num="D₂" den="D₁" /></>),
      isi: `${fmt(D2 * 1000, 0)} / ${fmt(D1 * 1000, 0)}`,
      hasil: fmt(r.beta, 4),
      tint: r.outOfRange ? C.signal : undefined,
    },
    ...(bukan
      ? [{ judul: x.bukan, rumus: <span>β ≥ 1</span>, isi: x.hBukan, hasil: takAda }]
      : [
          {
            judul: x.rFaktor,
            rumus: (<><span>E =</span><Frac num="1" den="√( 1 − β⁴ )" /></>),
            isi: `1 / √( 1 − ${fmt(r.beta, 4)}⁴ )`,
            hasil: fmt(r.approachFactor, 4),
            tint: C.energy,
          },
          {
            judul: `${x.hLuas}${tandaQ}`,
            rumus: <span>A₂ = π D₂² / 4 ;  Q = C · E · A₂ · √( 2 g Δh )</span>,
            isi: `A₂ = ${fmt(A2, 6)} m² ;  ${fmt(Cc, 3)} · ${fmt(r.approachFactor, 4)} · ${fmt(A2, 6)} · √( 2 · ${fmt(G, 2)} · ${fmt(dh, 2)} )`,
            hasil: fmt(r.Q * 1000, 2),
            satuan: "l/s",
            tint: tintQ,
          },
          {
            judul: x.hV,
            rumus: <span>V₁ = Q / A₁ ;  V₂ = Q / A₂</span>,
            isi: `${fmt(r.Q, 5)} / ${fmt(A1, 6)} = ${fmt(r.V1, 3)} m/s ;  ${fmt(r.Q, 5)} / ${fmt(A2, 6)}`,
            hasil: fmt(r.V2, 3),
            satuan: "m/s",
            tint: C.water,
          },
          {
            judul: x.hSalah,
            rumus: (
              <span>
                Q′ = Q / E ;  ε = ( Q − Q′ ) / Q ;  hL = Δh ( {fmt(0.218, 3)} − {fmt(0.42, 2)} β + {fmt(0.38, 2)} β² )
              </span>
            ),
            isi: `Q′ = ${fmt(tanpaFaktor * 1000, 2)} l/s ;  ε = ( ${fmt(r.Q * 1000, 3)} − ${fmt(tanpaFaktor * 1000, 3)} ) / ${fmt(r.Q * 1000, 3)} = ${fmt(salah, 2)} % ;  hL = ${fmt(dh, 2)} · ${fmt(fLoss, 4)}`,
            hasil: fmt(r.permanentLoss, 4),
            satuan: "m",
            tint: C.energy,
          },
        ]),
  ];

  return (
    <LabShell
      status={
        /* Batas pita dari VENTURI_BETA_MIN/MAX dan beta ≥ 1 (bukan-venturi),
           ISO 5167-4. Sumbu dipotong 0 sampai 1,2; β sampai 20 (D₁ 25,
           D₂ 500 mm) ditandai di luar skala. */
        <RegimeScale
          symbol="β"
          value={r.beta}
          invalid={r.outOfRange}
          digits={3}
          bands={[
            { from: 0, to: VENTURI_BETA_MIN, label: x.bandBawah, tone: "invalid" },
            { from: VENTURI_BETA_MIN, to: VENTURI_BETA_MAX, label: x.bandIso, tone: "pass" },
            { from: VENTURI_BETA_MAX, to: 1, label: x.bandAtas, tone: "invalid" },
            { from: 1, to: 1.2, label: x.bandBukan, tone: "invalid" },
          ]}
        />
      }
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
            { label: "Q", value: bukan ? takAda : `${fmt(r.Q * 1000, 1)} l/s`, tint: r.outOfRange ? C.signal : C.water },
            { label: "C", value: fmt(Cc, 3) },
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
              <InputRow symbol="D₁" label={x.dD1} value={D1 * 1000} min={25} max={600} step={5} digits={0} unit="mm" onChange={(v) => setD1(v / 1000)} />
              <InputRow symbol="D₂" label={x.dD2} value={D2 * 1000} min={10} max={500} step={5} digits={0} unit="mm" onChange={(v) => setD2(v / 1000)} tint={C.energy} />
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
            <ResultTable
              rows={[
                { symbol: "Q", label: `${x.rQ}${tandaQ}`, value: bukan ? takAda : fmt(r.Q * 1000, 2), unit: bukan ? undefined : "l/s", tint: tintQ, strong: true },
                { symbol: "β", label: x.rBeta, value: fmt(r.beta, 4), tint: r.outOfRange ? C.signal : undefined, strong: true },
                { symbol: "E", label: x.rFaktor, value: bukan ? takAda : fmt(r.approachFactor, 4), tint: C.energy },
                { symbol: "Q′", label: x.rTanpa, value: bukan ? takAda : fmt(tanpaFaktor * 1000, 2), unit: bukan ? undefined : "l/s", tint: C.ink3 },
                { symbol: "ε", label: x.rSalah, value: bukan ? takAda : fmt(salah, 2), unit: bukan ? undefined : "%", tint: C.energy },
                { symbol: "V₁", label: x.rV1, value: bukan ? takAda : fmt(r.V1, 3), unit: bukan ? undefined : "m/s" },
                { symbol: "V₂", label: x.rV2, value: bukan ? takAda : fmt(r.V2, 3), unit: bukan ? undefined : "m/s", tint: C.water },
                { symbol: "hL", label: x.rLoss, value: bukan ? takAda : fmt(r.permanentLoss, 4), unit: bukan ? undefined : "m", tint: C.energy },
                { symbol: "%", label: x.rLossPct, value: bukan ? takAda : fmt(dh > 0 ? (r.permanentLoss / dh) * 100 : 0, 1), unit: bukan ? undefined : "%" },
              ]}
            />
            <div className="mt-3">
              <Hitungan langkah={langkah} />
            </div>
          </Block>

          <StateCard
            tone={r.outOfRange ? "invalid" : "pass"}
            badge={bukan ? x.bukan : r.outOfRange ? x.luar : x.sah}
            state={
              bukan
                ? x.bukanNote
                : lang === "id"
                  ? `β ${fmt(r.beta, 3)}: Q ${fmt(r.Q * 1000, 1)} l/s${tandaQ}; mengabaikan E mengecilkan debit ${fmt(salah, 2)} %.`
                  : `β ${fmt(r.beta, 3)}: Q ${fmt(r.Q * 1000, 1)} l/s${tandaQ}; ignoring E understates the discharge by ${fmt(salah, 2)} %.`
            }
            notice={[...(luarSah ? [alasan] : []), ...butir(r, salah, dh, lang)]}
          />
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

function butir(r: VenturiResult, salah: number, dh: number, lang: Lang): string[] {
  const pulih = dh > 0 ? (1 - r.permanentLoss / dh) * 100 : 0;
  if (r.reason === "bukan-venturi")
    return [
      lang === "en"
        ? "Bring the throat diameter below the pipe diameter and the pressure head line, the discharge, and the approach factor all come back."
        : "Kecilkan diameter leher sampai di bawah diameter pipa, dan garis tinggi tekan, debit, serta faktor kecepatan datang akan kembali.",
    ];
  if (lang === "en")
    return [
      `Push the throat diameter up toward the pipe diameter and watch the ${fmt(salah, 2)} per cent error grow far faster than the ratio does.`,
      `On the upper panel, ${fmt(pulih, 0)} per cent of the head difference comes back downstream; an orifice plate at the same ratio would return far less, and that recovery is the whole reason a Venturi costs more.`,
    ];
  return [
    `Naikkan diameter leher mendekati diameter pipa, lalu perhatikan kesalahan ${fmt(salah, 2)} persen itu bertambah jauh lebih cepat daripada perbandingannya sendiri.`,
    `Pada panel atas, ${fmt(pulih, 0)} persen dari beda tinggi tekan kembali di hilir; pelat lubang pada perbandingan yang sama mengembalikan jauh lebih sedikit, dan pemulihan itulah seluruh alasan venturi lebih mahal.`,
  ];
}
