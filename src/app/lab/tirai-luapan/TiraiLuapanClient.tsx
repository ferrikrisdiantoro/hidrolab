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
import { drawNappe } from "@/lib/drawNappe";
import {
  RECT_WEIR_HP_MAX,
  fmt,
  jetTrajectory,
  rectWeirDischarge,
  wesNappe,
} from "@/lib/hydraulics";
import { C } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksNappe } from "@/lib/checks";

const TXT = {
  id: {
    title: "Tirai luapan bebas",
    sheetTitle: "Bentuk tirai di atas ambang tajam — potongan melintang",
    dh: "Tinggi muka air di atas mercu",
    dP: "Tinggi mercu di atas lantai",
    db: "Lebar ambang",
    dTail: "Muka air hilir di atas lantai",
    pKecil: "Ambang laboratorium",
    pLapangan: "Ambang ukur lapangan",
    pTenggelam: "Muka air hilir tinggi",
    rQ: "Debit",
    rCe: "Koefisien debit",
    rV0: "Kecepatan rata-rata di atas mercu",
    rHP: "Perbandingan h terhadap P",
    rJatuh: "Jarak jatuh tirai sampai lantai",
    rBeda: "Selisih terhadap lintasan peluru pada x = h",
    rHe: "Tinggi muka air efektif",
    aerated: "Rongga diberi udara",
    notAerated: "Rongga tanpa udara",
    notAeratedNote:
      "Rongga di bawah tirai tidak diberi udara. Air yang jatuh menyeret udara di bawahnya keluar, tekanan di rongga itu turun, dan tirai tertarik mendekat ke muka ambang. Akibatnya debit yang lewat bertambah dari yang dihitung, tirai bergetar, dan pada ambang panjang getaran itu dapat merusak bangunannya. Rumus debit pada lembar ini mengandaikan rongga bertekanan udara luar, jadi angka yang tampil tidak berlaku selama rongga belum diberi udara. Lubang angin pada dinding samping menyelesaikannya.",
    tenggelam: "Ambang tenggelam",
    tenggelamNote:
      "Muka air hilir sudah naik melewati puncak mercu. Tirai tidak lagi jatuh bebas, dan hubungan antara tinggi muka air dan debit yang dipakai di sini gugur seluruhnya. Debit pada keadaan tenggelam bergantung pada selisih muka air hulu dan hilir, bukan pada tinggi muka air di atas mercu saja.",
    luar: "Di luar rentang standar",
    luarH: "Tinggi muka air di bawah 0,03 m. Di bawah itu tegangan permukaan dan kekentalan ikut menentukan bentuk tirai, dan koefisien debitnya tidak lagi tetap.",
    luarP: "Tinggi mercu di bawah 0,10 m. Ambang sependek itu tidak lagi memaksa air melepaskan diri secara bersih dari puncaknya.",
    luarHP: "Perbandingan tinggi muka air terhadap tinggi mercu melewati dua. Di atas itu kecepatan datang sudah terlalu besar untuk dikoreksi oleh satu suku linier.",
    note:
      "Bentuk tirai luapan bebas bukan parabola, dan itu pernyataan yang dapat dilihat langsung pada gambar. Lintasan peluru, yaitu andaian bahwa air meninggalkan mercu mendatar lalu jatuh bebas, digambar sebagai garis khayal di sampingnya. Ia turun lebih cepat, karena mengabaikan dua hal yang nyata di puncak mercu: tekanan di dalam air belum nol, dan lintasannya sudah melengkung sebelum sampai ke bibir. Bentuk sesungguhnya diukur dari tirai ambang tajam yang diberi udara, lalu dirumuskan sebagai persamaan pangkat dengan pangkat 1,85. Dari situlah bentuk mercu ogee berasal: mercu ogee tidak dirancang lebih dulu lalu diuji, melainkan dibentuk mengikuti permukaan bawah tirai ini persis. Pada tinggi energi rancangan, air lalu menempel pada mercu tanpa menekan maupun terangkat, dan tekanan di sepanjang permukaannya kira-kira nol. Di bawah tinggi rancangan mercu menekan air, di atasnya tekanan menjadi negatif dan kavitasi menjadi risiko. Satu hal lagi yang mudah terlewat: rongga udara di bawah tirai bukan ruang kosong yang tidak penting. Ia bagian dari rancangan.",
  },
  en: {
    title: "Free nappe",
    sheetTitle: "Nappe shape over a sharp-crested weir — cross section",
    dh: "Head above the crest",
    dP: "Crest height above the floor",
    db: "Weir width",
    dTail: "Tailwater above the floor",
    pKecil: "Laboratory weir",
    pLapangan: "Field gauging weir",
    pTenggelam: "High tailwater",
    rQ: "Discharge",
    rCe: "Discharge coefficient",
    rV0: "Mean velocity over the crest",
    rHP: "Ratio of h to P",
    rJatuh: "Fall distance of the nappe to the floor",
    rBeda: "Difference from the projectile path at x = h",
    rHe: "Effective head",
    aerated: "Pocket vented",
    notAerated: "Pocket not vented",
    notAeratedNote:
      "The pocket beneath the nappe is not vented. The falling water drags the air out from under it, the pressure in that pocket drops, and the nappe is pulled in toward the face of the weir. The discharge passing then exceeds the computed value, the nappe vibrates, and on a long weir that vibration can damage the structure. The discharge formula on this sheet assumes the pocket is at atmospheric pressure, so the numbers shown do not apply while the pocket stays unvented. A vent hole through the side wall settles it.",
    tenggelam: "Weir submerged",
    tenggelamNote:
      "The tailwater has risen above the crest. The nappe no longer falls free, and the head-discharge relation used here fails entirely. Submerged discharge depends on the difference between upstream and downstream levels, not on the head over the crest alone.",
    luar: "Outside the standard range",
    luarH: "The head is below 0.03 m. Below that, surface tension and viscosity start to shape the nappe, and the discharge coefficient is no longer constant.",
    luarP: "The crest height is below 0.10 m. A weir that short no longer forces the water to spring cleanly off its crest.",
    luarHP: "The ratio of head to crest height exceeds two. Above that, the approach velocity is too large to be corrected by a single linear term.",
    note:
      "The shape of a free nappe is not a parabola, and that statement can be seen directly on the drawing. The projectile path, the assumption that water leaves the crest horizontally and then falls freely, is drawn beside it as a phantom line. It falls faster, because it ignores two real things at the crest: the pressure inside the water is not yet zero, and the path is already curved before it reaches the lip. The real shape was measured from the ventilated nappe of a sharp-crested weir and then fitted as a power law with an exponent of 1.85. That is where the ogee crest comes from: an ogee is not designed first and tested afterwards but shaped to follow this lower nappe surface exactly. At the design head the water then clings to the crest without pressing on it or lifting off, and the pressure along the surface is close to zero. Below the design head the crest presses on the water; above it the pressure turns negative and cavitation becomes a risk. One more thing is easy to miss: the air pocket beneath the nappe is not an unimportant empty space. It is part of the design.",
  },
} as const;

const REFS = {
  id: [
    "USACE. Hydraulic Design Criteria, lembar bentuk mercu WES pada muka hulu tegak.",
    "ISO 1438. Hydrometry — Open channel flow measurement using thin-plate weirs.",
    "USBR (1987). Design of Small Dams, edisi ke-3, bab pelimpah mercu bebas.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Bab 14, ambang tajam dan tirai luapan.",
  ],
  en: [
    "USACE. Hydraulic Design Criteria, sheets on the WES crest shape for a vertical upstream face.",
    "ISO 1438. Hydrometry — Open channel flow measurement using thin-plate weirs.",
    "USBR (1987). Design of Small Dams, 3rd ed., chapter on overflow spillway crests.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Chapter 14, sharp-crested weirs and the nappe.",
  ],
} as const;

export function TiraiLuapanClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [h, setH] = useState(0.3);
  const [P, setP] = useState(0.6);
  const [b, setB] = useState(2);
  const [tail, setTail] = useState(0.2);
  const [aerated, setAerated] = useState(true);

  const r = rectWeirDischarge(h, b, P);
  const tenggelam = tail > P;
  const xJatuh = Math.pow(2 * Math.pow(h, 0.85) * Math.max(P, 0.01), 1 / 1.85);
  const bedaPeluru = jetTrajectory(r.V0, h) - wesNappe(h, h);

  const ref = useCanvas(
    (ctx, w, hh) =>
      drawNappe(
        ctx,
        w,
        hh,
        { h, P, V0: r.V0, tail, outOfRange: r.outOfRange || tenggelam, aerated },
        lang
      ),
    [h, P, b, tail, aerated, lang]
  );

  const alasanLuar =
    r.reason === "h-kecil"
      ? x.luarH
      : r.reason === "P-kecil"
        ? x.luarP
        : r.reason === "hP-besar"
          ? x.luarHP
          : "";

  return (
    <LabShell
      sheet="HS-06"
      subject={SUBJECTS.HS[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Air yang melewati ambang tajam melepaskan diri dari puncaknya dan
            jatuh sebagai <Term tint={C.water}>tirai bebas</Term>. Bentuk tirai
            itu bukan parabola, dan bukan pula sesuatu yang dipilih perancang:
            justru bentuk inilah yang kemudian ditiru menjadi bentuk mercu ogee.
          </p>
        ) : (
          <p>
            Water passing a sharp-crested weir springs clear of the crest and
            falls as a <Term tint={C.water}>free nappe</Term>. Its shape is not a
            parabola, nor is it something a designer chooses: it is this shape
            that the ogee crest was later copied from.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HS-06"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "h", value: `${fmt(h, 3)} m`, tint: C.water },
            { label: "Q", value: `${fmt(r.Q, 4)} m³/s`, tint: C.water },
            { label: "Ce", value: fmt(r.Ce, 4) },
            { label: "h/P", value: fmt(h / P, 3), tint: h / P > RECT_WEIR_HP_MAX ? C.signal : undefined },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="h" label={x.dh} value={h} min={0.01} max={1.2} step={0.005} digits={3} unit="m" onChange={setH} tint={C.water} />
              <InputRow symbol="P" label={x.dP} value={P} min={0.05} max={2} step={0.05} unit="m" onChange={setP} />
              <InputRow symbol="b" label={x.db} value={b} min={0.2} max={8} step={0.1} digits={1} unit="m" onChange={setB} />
              <InputRow symbol="y_h" label={x.dTail} value={tail} min={0} max={2} step={0.05} unit="m" onChange={setTail} tint={C.signal} />
            </InputTable>

            <div className="mt-3.5 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
              <span className="stencil">{t.presetView}</span>
              <button
                onClick={() => setAerated(!aerated)}
                aria-pressed={aerated}
                className="label border-b border-rule-strong pb-px text-[0.8rem] text-ink-2 transition-colors hover:border-ink hover:text-ink"
              >
                {aerated ? x.aerated : x.notAerated}
              </button>
            </div>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pKecil, apply: () => { setH(0.08); setP(0.3); setB(0.5); setTail(0.05); } },
                  { label: x.pLapangan, apply: () => { setH(0.3); setP(0.6); setB(2); setTail(0.2); } },
                  { label: x.pTenggelam, apply: () => { setH(0.3); setP(0.6); setB(2); setTail(0.75); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={C.water}>{`${fmt(r.Q * 1000, 0)} l/s`}</Flag>
              {!aerated && <Flag alert>{x.notAerated}</Flag>}
              {tenggelam && <Flag alert>{x.tenggelam}</Flag>}
              {r.outOfRange && <Flag alert>{x.luar}</Flag>}
            </div>
            {!aerated && (
              <div className="mb-2.5">
                <Note>{x.notAeratedNote}</Note>
              </div>
            )}
            {tenggelam && (
              <div className="mb-2.5">
                <Note>{x.tenggelamNote}</Note>
              </div>
            )}
            {r.outOfRange && (
              <div className="mb-2.5">
                <Note>{alasanLuar}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "Q", label: x.rQ, value: fmt(r.Q, 4), unit: "m³/s", tint: C.water, strong: true },
                { symbol: "Ce", label: x.rCe, value: fmt(r.Ce, 4), strong: true },
                { symbol: "he", label: x.rHe, value: fmt(r.he, 4), unit: "m" },
                { symbol: "V₀", label: x.rV0, value: fmt(r.V0, 3), unit: "m/s" },
                { symbol: "h/P", label: x.rHP, value: fmt(h / P, 3), tint: h / P > RECT_WEIR_HP_MAX ? C.signal : undefined },
                { symbol: "L", label: x.rJatuh, value: fmt(xJatuh, 3), unit: "m" },
                { symbol: "δ", label: x.rBeda, value: fmt(bedaPeluru, 4), unit: "m", tint: C.ink3 },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(h, P, bedaPeluru, aerated, tenggelam, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksNappe(h, b, P)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>x^1,85 = 2 h^0,85 y</span>
                <span className="ml-6 text-ink-3">
                  {lang === "id" ? "bentuk WES, muka hulu tegak" : "WES shape, vertical upstream face"}
                </span>
              </Eq>
              <Eq>
                <span>Q =</span>
                <Frac num="2" den="3" />
                <span>Ce √(2g) b he^1,5</span>
                <span className="ml-5">Ce = 0,602 + 0,075</span>
                <Frac num="h" den="P" />
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
  P: number,
  beda: number,
  aerated: boolean,
  tenggelam: boolean,
  lang: Lang
): string {
  if (tenggelam) {
    return lang === "id"
      ? "Selama muka air hilir masih di atas puncak mercu, tidak ada tirai bebas untuk dibicarakan. Turunkan muka air hilir sampai di bawah puncak, lalu perhatikan tirai terlepas dan rongga udara terbentuk di bawahnya."
      : "While the tailwater stays above the crest there is no free nappe to speak of. Lower the tailwater below the crest and watch the nappe spring clear with an air pocket forming beneath it.";
  }
  if (!aerated) {
    return lang === "id"
      ? "Dengan rongga tanpa udara, gambar ini memperlihatkan bentuk yang seharusnya, bukan bentuk yang sesungguhnya terjadi. Tirai yang tidak diberi udara tertarik ke muka ambang dan tidak lagi mengikuti bentuk terbitan. Nyalakan kembali pemberian udara untuk membandingkan."
      : "With the pocket unvented, this drawing shows the shape that ought to occur rather than the one that does. An unvented nappe is pulled toward the weir face and no longer follows the published shape. Turn venting back on to compare.";
  }

  if (lang === "en")
    return `At a distance of one head downstream of the crest the nappe has dropped exactly half a head, which is a number that falls straight out of the equation and is marked on the drawing. Over that same distance the projectile path has already fallen ${beda.toFixed(4)} m further. Raise the head, currently ${h.toFixed(3)} m against a crest height of ${P.toFixed(2)} m, and watch the two paths separate faster: the faster the water leaves the crest, the flatter the real nappe becomes relative to a free fall.`;
  return `Pada jarak satu kali tinggi muka air di hilir mercu, tirai sudah turun tepat setengahnya, dan angka itu jatuh langsung dari persamaannya serta ditandai pada gambar. Sepanjang jarak yang sama, lintasan peluru sudah turun ${beda.toFixed(4)} m lebih jauh. Naikkan tinggi muka airnya, sekarang ${h.toFixed(3)} m terhadap tinggi mercu ${P.toFixed(2)} m, lalu perhatikan kedua lintasan memisah lebih cepat: makin kencang air meninggalkan mercu, makin landai tirai sesungguhnya dibanding jatuh bebas.`;
}
