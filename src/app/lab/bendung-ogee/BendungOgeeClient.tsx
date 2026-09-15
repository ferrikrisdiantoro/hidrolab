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
  type StructureLine,
  type StructureSpec,
} from "@/lib/drawStructure";
import {
  OGEE_CAVITATION_LIMIT,
  OGEE_CD_DESIGN,
  fmt,
  fmtPlain,
  ogeeWeir,
  wesCrest,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksOgee } from "@/lib/checks";

const TXT = {
  id: {
    title: "Bendung ogee",
    sheetTitle: "Bendung ogee — bentuk mercu WES dan kapasitas luapannya",
    dH: "Tinggi muka air di atas mercu",
    dHd: "Tinggi energi rancangan",
    dL: "Panjang mercu",
    dP: "Tinggi mercu di atas dasar hulu",
    pRancang: "Pada tinggi rancangan",
    pRendah: "Jauh di bawah rancangan",
    pBanjir: "Banjir di atas rancangan",
    rQ: "Debit",
    rHe: "Tinggi energi",
    rCd: "Koefisien debit",
    rRatio: "Perbandingan He terhadap Hd",
    rVa: "Kecepatan datang",
    rP: "Tekanan di mercu",
    rQperM: "Debit per meter mercu",
    kavitasi: "Risiko kavitasi di mercu",
    kavitasiNote:
      "Tekanan di mercu turun di bawah enam meter kolom air di bawah tekanan udara. Pada tekanan serendah itu gelembung uap terbentuk di permukaan beton, dan runtuhnya gelembung itu menggerus permukaan dengan cepat: pelimpah yang berulang kali dilewati banjir jauh di atas rancangannya dapat kehilangan beberapa sentimeter beton dalam satu musim. Yang perlu diperhatikan, koefisien debitnya justru NAIK pada keadaan ini, sehingga bendungnya tampak bekerja lebih baik tepat ketika ia sedang merusak dirinya sendiri. Naikkan tinggi rancangannya, atau terima bahwa mercunya perlu dilapisi bahan tahan gerus.",
    takKendali: "Mercu tidak mengendalikan aliran",
    takKendaliNote:
      "Tinggi muka air terlalu besar dibanding tinggi mercunya, sehingga kecepatan datang di hulu menjadi sebesar kecepatan di mercu dan tidak ada tinggi energi yang memenuhi persamaannya. Yang ada di sana bukan bendung melainkan penyempitan saluran, dan rumus ambang tidak berlaku sama sekali. Tinggikan mercunya, atau turunkan tinggi muka airnya.",
    luar: "Di luar rentang bagan",
    luarKecil:
      "Tinggi energi kurang dari seperlima tinggi rancangan. Pada tinggi serendah itu tirai menempel erat ke muka mercu dan tegangan permukaan mulai berperan, sehingga koefisien debit yang dihitung dari bagan tidak lagi dapat dipercaya.",
    luarBesar:
      "Tinggi energi lebih dari tiga kali tinggi rancangan. Bagan koefisien debit tidak diterbitkan sejauh itu, dan tekanan negatif di mercu sudah jauh melewati batas yang biasa diterima dalam perancangan.",
    note:
      "Bentuk mercu ogee bukan pilihan gaya melainkan jawaban atas satu pertanyaan yang sangat khusus: bentuk apa yang, bila dialiri air, tidak menekan maupun mengangkat airnya sendiri. Jawabannya ditemukan dengan cara yang mengejutkan sederhana, yaitu mengukur bentuk permukaan bawah tirai luapan bebas dari ambang tajam, lalu mencetak beton persis mengikuti bentuk itu. Karena mercunya menjadi tempat air memang ingin lewat, pada tinggi rancangan tekanan di seluruh permukaannya sama dengan tekanan udara. Yang perlu diingat: syarat itu berlaku pada tinggi ENERGI, bukan pada tinggi muka air. Keduanya berbeda sebesar tinggi kecepatan datang, dan pada bendung rendah dengan tinggi rancangan besar selisihnya sama sekali tidak kecil. Perhatikan pula apa yang terjadi di luar tinggi rancangan: di bawahnya tirai menekan dan koefisien debitnya turun, di atasnya tirai terangkat, tekanan menjadi negatif, dan koefisien debitnya naik. Kenaikan itu tampak menguntungkan dan justru merupakan tanda bahaya.",
  },
  en: {
    title: "Ogee weir",
    sheetTitle: "Ogee weir — the WES crest profile and its spillway capacity",
    dH: "Water level above the crest",
    dHd: "Design energy head",
    dL: "Crest length",
    dP: "Crest height above the upstream bed",
    pRancang: "At the design head",
    pRendah: "Far below the design head",
    pBanjir: "Flood above the design head",
    rQ: "Discharge",
    rHe: "Energy head",
    rCd: "Discharge coefficient",
    rRatio: "Ratio of He to Hd",
    rVa: "Approach velocity",
    rP: "Crest pressure",
    rQperM: "Discharge per metre of crest",
    kavitasi: "Cavitation risk at the crest",
    kavitasiNote:
      "The crest pressure has fallen more than six metres of water below atmospheric. At that pressure vapour bubbles form against the concrete surface, and their collapse erodes it quickly: a spillway repeatedly passing floods far above its design head can lose centimetres of concrete in a single season. Note that the discharge coefficient actually RISES in this state, so the weir appears to work better exactly while it is damaging itself. Raise the design head, or accept that the crest needs an erosion-resistant lining.",
    takKendali: "The crest does not control the flow",
    takKendaliNote:
      "The water level is too large compared with the crest height, so the approach velocity becomes as large as the velocity over the crest and no energy head satisfies the equation. What stands there is not a weir but a channel constriction, and the weir formula does not apply at all. Raise the crest, or lower the water level.",
    luar: "Outside the chart range",
    luarKecil:
      "The energy head is less than one fifth of the design head. At heads that low the nappe clings tightly to the crest face and surface tension begins to matter, so the discharge coefficient read from the chart can no longer be trusted.",
    luarBesar:
      "The energy head exceeds three times the design head. The discharge coefficient chart is not published that far, and the negative crest pressure is already well past what design practice accepts.",
    note:
      "The ogee crest shape is not a matter of style but the answer to one very specific question: what shape, when water flows over it, neither presses on nor lifts away from its own flow. The answer was found in a surprisingly simple way, by measuring the underside of the nappe falling freely from a sharp-crested weir and then casting concrete to exactly that shape. Because the crest becomes the place the water wanted to go anyway, at the design head the pressure over its whole surface equals atmospheric. Keep this in mind: that condition applies to the ENERGY head, not the water level. The two differ by the approach velocity head, and on a low weir with a large design head that difference is not small at all. Notice too what happens either side of the design head: below it the nappe presses down and the discharge coefficient falls; above it the nappe lifts, the pressure goes negative, and the coefficient rises. That rise looks like a gain and is in fact a warning.",
  },
} as const;

const REFS = {
  id: [
    "US Army Corps of Engineers (1987). Hydraulic Design Criteria, lembar 111-1 sampai 111-18.",
    "USBR (1987). Design of Small Dams, edisi ke-3, Bab 9: pelimpah.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill, Bab 14.",
    "Falvey, H.T. (1990). Cavitation in Chutes and Spillways. USBR Engineering Monograph 42.",
  ],
  en: [
    "US Army Corps of Engineers (1987). Hydraulic Design Criteria, sheets 111-1 to 111-18.",
    "USBR (1987). Design of Small Dams, 3rd ed., Chapter 9: spillways.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill, Chapter 14.",
    "Falvey, H.T. (1990). Cavitation in Chutes and Spillways. USBR Engineering Monograph 42.",
  ],
} as const;

export function BendungOgeeClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [h, setH] = useState(2);
  const [Hd, setHd] = useState(2);
  const [L, setL] = useState(20);
  const [P, setP] = useState(8);

  const r = ogeeWeir(h, Hd, L, P);
  const takKendali = !r.controlled;

  const ref = useCanvas(
    (ctx, w, ch) => {
      /* Geometri, dengan puncak mercu di titik asal:
         hulu di x negatif, muka hilir mengikuti bentuk WES ke kanan. */
      const xHulu = -Math.max(3 * Hd, 4);
      const xHilir = Math.max(3.2 * Hd, 5);

      const mukaHilir: { x: number; z: number }[] = [];
      for (let i = 0; i <= 60; i++) {
        const xx = (xHilir * i) / 60;
        mukaHilir.push({ x: xx, z: wesCrest(xx, Hd) });
      }
      const zKaki = mukaHilir[mukaHilir.length - 1].z;
      const zDasar = zKaki - 1.2;

      // Badan bendung: dinding hulu tegak, puncak, muka hilir WES, lalu dasar.
      const badan: { x: number; z: number }[] = [
        { x: -0.35 * Math.max(Hd, 0.5), z: -P },
        { x: -0.35 * Math.max(Hd, 0.5), z: -0.28 * Math.max(Hd, 0.5) },
        { x: -0.18 * Math.max(Hd, 0.5), z: 0 },
        ...mukaHilir,
        { x: xHilir, z: zDasar },
        { x: -0.35 * Math.max(Hd, 0.5), z: zDasar },
      ];

      const garis: StructureLine[] = [];

      if (!takKendali) {
        // Garis energi hulu, mendatar pada He di atas mercu.
        garis.push({
          pts: [
            { x: xHulu, z: r.He },
            { x: 0.4 * Hd, z: r.He },
          ],
          color: C.energy,
          weight: W.thin,
          dash: DASH.hidden,
          label: `He ${fmtPlain(r.He, 3)} m`,
          labelAt: 0.25,
          labelDy: -10,
        });

        // Tirai pada tinggi rancangan, sebagai pembanding tetap terhadap
        // muka mercu: pada tinggi rancangan keduanya berimpit.
        const tirai: { x: number; z: number }[] = [];
        for (let i = 0; i <= 60; i++) {
          const xx = (xHilir * i) / 60;
          tirai.push({ x: xx, z: wesCrest(xx, Hd) + Math.max(r.He - Hd, 0) * 0.55 });
        }
        garis.push({
          pts: tirai,
          color: C.critical,
          weight: W.thin,
          dash: DASH.phantom,
          label: T.designNappe,
          labelAt: 0.75,
          labelDy: -11,
        });
      }

      const spec: StructureSpec = {
        xMin: xHulu,
        xMax: xHilir,
        zMin: zDasar,
        zMax: Math.max(r.He, h) + 0.6 * Math.max(Hd, 0.5),
        bodies: [{ pts: badan }],
        waters: takKendali
          ? [
              {
                surface: [
                  { x: xHulu, z: h },
                  { x: xHilir, z: h },
                ],
                invalid: true,
              },
            ]
          : [
              {
                surface: [
                  { x: xHulu, z: h },
                  { x: -0.6 * Math.max(Hd, 0.5), z: h * 0.97 },
                  { x: 0, z: h * 0.72 },
                  ...mukaHilir.map((p) => ({
                    x: p.x,
                    z: p.z + Math.max(h * 0.28, 0.05),
                  })),
                ],
                bed: [
                  { x: xHilir, z: zDasar },
                  { x: -0.35 * Math.max(Hd, 0.5), z: zDasar },
                  { x: -0.35 * Math.max(Hd, 0.5), z: -P },
                  { x: xHulu, z: -P },
                ],
              },
            ],
        lines: garis,
        dims: [
          {
            axis: "v",
            at: xHulu * 0.75,
            from: 0,
            to: h,
            text: `h ${fmtPlain(h, 2)} m`,
            color: C.water,
            offset: 0,
          },
          {
            axis: "v",
            at: xHulu * 0.35,
            from: -P,
            to: 0,
            text: `P ${fmtPlain(P, 1)} m`,
            color: C.ink,
            offset: 0,
          },
        ],
        callouts: [
          {
            x: xHilir * 0.42,
            z: wesCrest(xHilir * 0.42, Hd),
            dx: 34,
            dy: 26,
            text: T.crestProfile,
          },
        ],
        arrows: [{ x: xHulu * 0.6, z: -P * 0.45, length: 26 }],
        heading: takKendali
          ? T.noControl
          : r.cavitationRisk
            ? T.cavitation
            : undefined,
        headingColor: C.signal,
        axisX: T.axHoriz,
        axisZ: T.axLevel,
      };

      drawStructure(ctx, w, ch, spec, lang);
    },
    [h, Hd, L, P, lang]
  );

  const alasan =
    r.reason === "He-kecil"
      ? x.luarKecil
      : r.reason === "He-besar"
        ? x.luarBesar
        : "";

  return (
    <LabShell
      sheet="HS-01"
      subject={SUBJECTS.HS[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Mercunya dibentuk mengikuti{" "}
            <Term tint={C.critical}>jejak tirai luapan bebas</Term>, sehingga
            pada tinggi rancangan air menyentuhnya tanpa menekan dan tanpa
            terangkat. Di luar tinggi itu, keduanya terjadi.
          </p>
        ) : (
          <p>
            The crest is shaped to follow the{" "}
            <Term tint={C.critical}>trace of a free nappe</Term>, so that at the
            design head the water touches it without pressing and without
            lifting. Away from that head, both happen.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HS-01"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "He/Hd", value: fmt(r.ratio, 3), tint: r.outOfRange ? C.signal : undefined },
            { label: "Cd", value: takKendali ? "—" : fmt(r.Cd, 3), tint: C.energy },
            { label: "Q", value: takKendali ? "—" : `${fmt(r.Q, 1)} m³/s`, tint: takKendali ? C.signal : C.water },
            {
              label: "p",
              value: takKendali ? "—" : `${fmt(r.crestPressure, 2)} m`,
              tint: r.cavitationRisk ? C.signal : undefined,
            },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="h" label={x.dH} value={h} min={0.05} max={12} step={0.05} digits={2} unit="m" onChange={setH} tint={C.water} />
              <InputRow symbol="Hd" label={x.dHd} value={Hd} min={0.3} max={8} step={0.1} digits={1} unit="m" onChange={setHd} tint={C.critical} />
              <InputRow symbol="L" label={x.dL} value={L} min={2} max={120} step={1} digits={0} unit="m" onChange={setL} />
              <InputRow symbol="P" label={x.dP} value={P} min={0.5} max={40} step={0.5} digits={1} unit="m" onChange={setP} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pRancang, apply: () => { setH(2); setHd(2); setL(20); setP(8); } },
                  { label: x.pRendah, apply: () => { setH(0.4); setHd(2); setL(20); setP(8); } },
                  { label: x.pBanjir, apply: () => { setH(5); setHd(2); setL(20); setP(8); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              {!takKendali && (
                <Flag tint={C.water}>{`${fmt(r.Q, 1)} m³/s`}</Flag>
              )}
              {takKendali && <Flag alert>{x.takKendali}</Flag>}
              {r.cavitationRisk && <Flag alert>{x.kavitasi}</Flag>}
              {r.outOfRange && !takKendali && <Flag alert>{x.luar}</Flag>}
            </div>
            {takKendali && (
              <div className="mb-2.5">
                <Note>{x.takKendaliNote}</Note>
              </div>
            )}
            {r.cavitationRisk && (
              <div className="mb-2.5">
                <Note>{x.kavitasiNote}</Note>
              </div>
            )}
            {alasan && !takKendali && (
              <div className="mb-2.5">
                <Note>{alasan}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "Q", label: x.rQ, value: takKendali ? "—" : fmt(r.Q, 2), unit: takKendali ? undefined : "m³/s", tint: C.water, strong: true },
                { symbol: "He", label: x.rHe, value: takKendali ? "—" : fmt(r.He, 4), unit: takKendali ? undefined : "m", tint: C.energy, strong: true },
                { symbol: "Cd", label: x.rCd, value: takKendali ? "—" : fmt(r.Cd, 4), tint: C.energy },
                { symbol: "He/Hd", label: x.rRatio, value: fmt(r.ratio, 4), tint: r.outOfRange ? C.signal : undefined },
                { symbol: "p", label: x.rP, value: takKendali ? "—" : fmt(r.crestPressure, 3), unit: takKendali ? undefined : "m", tint: r.cavitationRisk ? C.signal : undefined },
                { symbol: "Va", label: x.rVa, value: takKendali ? "—" : fmt(r.Va, 4), unit: takKendali ? undefined : "m/s" },
                { symbol: "q", label: x.rQperM, value: takKendali ? "—" : fmt(r.Q / L, 3), unit: takKendali ? undefined : "m³/s·m" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(h, Hd, L, P, r.Cd, r.crestPressure, takKendali, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksOgee(h, Hd, L, P)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <Frac num="y" den="Hd" />
                <span>= −0,5</span>
                <span className="ml-1">(</span>
                <Frac num="x" den="Hd" />
                <span>)^1,85</span>
                <span className="ml-4 text-ink-3">
                  {lang === "id" ? "bentuk WES" : "the WES profile"}
                </span>
              </Eq>
              <Eq>
                <span>Q = Cd L He^1,5</span>
                <span className="ml-5">He = h +</span>
                <Frac num="Va²" den="2g" />
                <span className="ml-5">Cd₀ = {fmtPlain(OGEE_CD_DESIGN, 1)}</span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `tekanan mercu nol bila He sama dengan Hd; kavitasi bila di bawah ${fmtPlain(OGEE_CAVITATION_LIMIT, 0)} m`
                    : `crest pressure is zero when He equals Hd; cavitation below ${fmtPlain(OGEE_CAVITATION_LIMIT, 0)} m`}
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
  h: number,
  Hd: number,
  L: number,
  P: number,
  Cd: number,
  pressure: number,
  takKendali: boolean,
  lang: Lang
): string {
  if (takKendali) {
    return lang === "id"
      ? "Selama mercunya tidak mengendalikan aliran, tidak ada kapasitas luapan untuk dibaca. Tinggikan mercunya sampai kecepatan datang kembali kecil dibanding kecepatan di mercu."
      : "While the crest does not control the flow there is no spillway capacity to read. Raise the crest until the approach velocity is again small compared with the velocity over it.";
  }

  const rancang = ogeeWeir(Hd, Hd, L, P);
  const bedaCd = rancang.Cd > 0 ? ((Cd - rancang.Cd) / rancang.Cd) * 100 : 0;

  if (lang === "en")
    return `The discharge coefficient here is ${fmt(Cd, 3)}, which is ${fmt(bedaCd, 1)} per cent away from its value at the design head, while the crest pressure sits at ${fmt(pressure, 2)} m of water. Sweep the water level from one end to the other and watch the two move in opposite senses: the coefficient climbs steadily while the pressure falls steadily. There is no head at which both improve. A spillway designed for a head it will rarely see is a spillway that spends most of its life with the nappe pressing on the crest and passing less water than the concrete could carry.`;
  return `Koefisien debitnya di sini ${fmt(Cd, 3)}, terpaut ${fmt(bedaCd, 1)} persen dari nilainya pada tinggi rancangan, sementara tekanan mercunya berada pada ${fmt(pressure, 2)} m kolom air. Geser tinggi muka airnya dari ujung ke ujung lalu perhatikan keduanya bergerak berlawanan arah: koefisiennya naik terus sementara tekanannya turun terus. Tidak ada satu tinggi pun yang membuat keduanya membaik. Pelimpah yang dirancang untuk tinggi yang jarang terjadi adalah pelimpah yang menghabiskan sebagian besar umurnya dengan tirai menekan mercu dan melewatkan air lebih sedikit daripada yang sanggup dipikul betonnya.`;
}
