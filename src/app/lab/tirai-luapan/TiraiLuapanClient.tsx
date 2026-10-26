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
import { drawNappe, drawNappeMotion } from "@/lib/drawNappe";
import { createJetMotion, type JetMotion } from "@/lib/jetMotion";
import {
  G,
  RECT_WEIR_HP_MAX,
  RECT_WEIR_KH,
  fmt,
  jetTrajectory,
  rectWeirDischarge,
  wesNappe,
} from "@/lib/hydraulics";
import { C, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksNappe } from "@/lib/checks";

const TXT = {
  id: {
    motionNote: "butir air di lembaran tirai, laju √(2g(E − z)), waktu diperlambat ×4",
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
    bRentang: "Dalam rentang rumus",
    bLaju: "Kecepatan datang terlalu besar",
    bBebas: "Tirai bebas",
    bTenggelam: "Tenggelam",
    badgeBebas: "Ambang tajam bebas",
    sBebas: (q: string, ls: string, ce: string) => `Ambang tajam bebas: Q = ${q} m³/s (${ls} l/s), Ce = ${ce}.`,
    sTenggelam: (yh: string, P: string) => `Ambang tenggelam: muka air hilir ${yh} m di atas lantai, melewati puncak mercu ${P} m. Hubungan h-Q gugur.`,
    sTanpaUdara: "Rongga di bawah tirai tanpa udara: tirai tertarik ke muka ambang, rumus debit tidak berlaku.",
    sLuar: (alasan: string) => `Di luar rentang rumus: ${alasan}`,
    ekstrapolasi: "Angkanya tetap ditulis, tetapi ini ekstrapolasi di luar rentang rumus dan tidak dijamin.",
    bentukTetap: (dh: string, hp: string) =>
      `Pada jarak satu kali tinggi muka air di hilir mercu, tirai turun tepat setengahnya; dalam satuan h bentuk tirai tidak berubah (y/h = 0,5 (x/h)^1,85). Selisihnya terhadap lintasan peluru tinggal ${dh} h, dan selisih itu mengecil ketika h/P (sekarang ${hp}) naik, karena air datang lebih kencang.`,
    saranTenggelam: "Turunkan muka air hilir sampai di bawah puncak, lalu perhatikan tirai terlepas dan rongga udara terbentuk di bawahnya.",
    saranUdara: "Gambar memperlihatkan bentuk yang seharusnya, bukan yang terjadi. Nyalakan kembali pemberian udara untuk membandingkan.",
    hCe: "Koefisien debit Kindsvater-Carter selebar penuh",
    hHe: "Tinggi muka air efektif",
    hQ: "Debit dan kecepatan datang",
    hL: "Jarak jatuh tirai sampai lantai (bentuk WES)",
    hD: "Pada x = h: tirai dibanding lintasan peluru",
    note:
      "Bentuk tirai luapan bebas bukan parabola, dan itu pernyataan yang dapat dilihat langsung pada gambar. Lintasan peluru, yaitu andaian bahwa air meninggalkan mercu mendatar lalu jatuh bebas, digambar sebagai garis khayal di sampingnya. Ia turun lebih cepat, karena mengabaikan dua hal yang nyata di puncak mercu: tekanan di dalam air belum nol, dan lintasannya sudah melengkung sebelum sampai ke bibir. Bentuk sesungguhnya diukur dari tirai ambang tajam yang diberi udara, lalu dirumuskan sebagai persamaan pangkat dengan pangkat 1,85. Dari situlah bentuk mercu ogee berasal: mercu ogee tidak dirancang lebih dulu lalu diuji, melainkan dibentuk mengikuti permukaan bawah tirai ini persis. Pada tinggi energi rancangan, air lalu menempel pada mercu tanpa menekan maupun terangkat, dan tekanan di sepanjang permukaannya kira-kira nol. Di bawah tinggi rancangan mercu menekan air, di atasnya tekanan menjadi negatif dan kavitasi menjadi risiko. Satu hal lagi yang mudah terlewat: rongga udara di bawah tirai bukan ruang kosong yang tidak penting. Ia bagian dari rancangan.",
  },
  en: {
    motionNote: "water particles in the nappe sheet, speed √(2g(E − z)), time slowed ×4",
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
    bRentang: "Within formula range",
    bLaju: "Approach velocity too large",
    bBebas: "Free nappe",
    bTenggelam: "Submerged",
    badgeBebas: "Free sharp-crested weir",
    sBebas: (q: string, ls: string, ce: string) => `Free sharp-crested weir: Q = ${q} m³/s (${ls} l/s), Ce = ${ce}.`,
    sTenggelam: (yh: string, P: string) => `Submerged weir: tailwater ${yh} m above the floor, above the ${P} m crest. The h-Q relation fails.`,
    sTanpaUdara: "Pocket beneath the nappe not vented: the nappe is pulled toward the weir face and the discharge formula does not apply.",
    sLuar: (alasan: string) => `Outside the formula range: ${alasan}`,
    ekstrapolasi: "The figures are still shown, but this is an extrapolation outside the formula range and not guaranteed.",
    bentukTetap: (dh: string, hp: string) =>
      `One head downstream of the crest the nappe has dropped exactly half a head; measured in h the nappe shape does not change (y/h = 0.5 (x/h)^1.85). Its difference from the projectile path is now ${dh} h, and that difference shrinks as h/P (now ${hp}) rises, because the water arrives faster.`,
    saranTenggelam: "Lower the tailwater below the crest and watch the nappe spring clear with an air pocket forming beneath it.",
    saranUdara: "The drawing shows the shape that ought to occur, not the one that does. Turn venting back on to compare.",
    hCe: "Full-width Kindsvater-Carter discharge coefficient",
    hHe: "Effective head",
    hQ: "Discharge and approach velocity",
    hL: "Fall distance of the nappe to the floor (WES shape)",
    hD: "At x = h: nappe against the projectile path",
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

/** Lapis gerak: waktu diperlambat empat kali (tirai jatuh dalam sepersekian detik). */
const SKALA_WAKTU = 0.25;

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
  /* Rumus gugur (CACAT 1): tenggelam atau rongga tanpa udara. Q, Ce, V₀,
     δ dan sel kop Q ditulis "—", sesuai notAeratedNote dan tenggelamNote
     yang menyatakan angkanya tidak berlaku. Di luar rentang (h, P, h/P)
     angkanya tetap ditulis sebagai ekstrapolasi. */
  const gugur = tenggelam || !aerated;
  const tampil = (v: number) => (gugur ? NaN : v);

  /* Lapis gerak (Phase 2): butir air jatuh di lembaran tirai dengan laju
     dari Bernoulli, √(2g(E − z)), E = P + h + Va²/2g dengan kecepatan
     datang Va = q/(h + P) (bukan V₀ di atas mercu); tebal lembaran
     q/v. Lapis statis tidak punya penanda arah, jadi sama saja saat
     berputar maupun dijeda. Berputar sendiri kecuali "kurangi animasi". */
  const { playing, toggle: togglePutar } = usePutar();
  const gerak = useRef<JetMotion | null>(null);
  if (gerak.current === null) gerak.current = createJetMotion(70, "normal");
  const qSatuan = b > 0 ? r.Q / b : 0;
  const plate = usePlate(
    (ctx, w, hh) =>
      drawNappe(
        ctx,
        w,
        hh,
        { h, P, V0: r.V0, tail, outOfRange: r.outOfRange || tenggelam, aerated },
        lang
      ),
    // Tanpa udara di rongga rumus gugur (V₀, Q ditulis "—") dan tirai
    // menempel: tidak ada gerak yang bisa digambar dari hitungan, jadi
    // tanpa lapis gerak dan tanpa tombol, sama seperti FP-01 di bawah Re 47.
    aerated
      ? (ctx, _w, _h, tt, _dt, out) =>
          drawNappeMotion(ctx, tt, out, { h, P, q: qSatuan, tail }, gerak.current!)
      : null,
    [h, P, b, tail, aerated, lang],
    { playing, timeScale: SKALA_WAKTU }
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
      status={
        <div className="flex flex-col gap-2">
          <RegimeScale
            symbol="h/P"
            value={h / P}
            scale="log"
            digits={3}
            invalid={r.outOfRange}
            pesan={r.reason === "h-kecil" || r.reason === "P-kecil" ? x.luar : undefined}
            bands={[
              { from: 0.005, to: RECT_WEIR_HP_MAX, label: x.bRentang, tone: "neutral" },
              { from: RECT_WEIR_HP_MAX, to: 30, label: x.bLaju, tone: "invalid" },
            ]}
          />
          <RegimeScale
            symbol="y_h/P"
            value={tail / P}
            scale="lin"
            digits={2}
            invalid={tenggelam}
            bands={[
              { from: 0, to: 1, label: x.bBebas, tone: "water" },
              { from: 1, to: 3, label: x.bTenggelam, tone: "invalid" },
            ]}
          />
        </div>
      }
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
            { label: "Q", value: gugur ? "—" : `${fmt(r.Q, 4)} m³/s`, tint: gugur ? C.signal : C.water },
            { label: "Ce", value: fmt(tampil(r.Ce), 4) },
            { label: "h/P", value: fmt(h / P, 3), tint: h / P > RECT_WEIR_HP_MAX ? C.signal : undefined },
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
              <InputRow symbol="h" label={x.dh} value={h} min={0.01} max={1.2} step={0.005} digits={3} unit="m" onChange={setH} tint={C.water} />
              <InputRow symbol="P" label={x.dP} value={P} min={0.05} max={2} step={0.05} unit="m" onChange={setP} />
              <InputRow symbol="b" label={x.db} value={b} min={0.2} max={8} step={0.1} digits={1} unit="m" onChange={setB} />
              <InputRow symbol="y_h" label={x.dTail} value={tail} min={0} max={2} step={0.05} unit="m" onChange={setTail} tint={C.water} />
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
            <ResultTable
              rows={[
                { symbol: "Q", label: x.rQ, value: fmt(tampil(r.Q), 4), unit: gugur ? undefined : "m³/s", tint: C.water, strong: true },
                { symbol: "Ce", label: x.rCe, value: fmt(tampil(r.Ce), 4), strong: true },
                { symbol: "he", label: x.rHe, value: fmt(r.he, 4), unit: "m" },
                { symbol: "V₀", label: x.rV0, value: fmt(tampil(r.V0), 3), unit: gugur ? undefined : "m/s" },
                { symbol: "h/P", label: x.rHP, value: fmt(h / P, 3), tint: h / P > RECT_WEIR_HP_MAX ? C.signal : undefined },
                { symbol: "L", label: x.rJatuh, value: fmt(xJatuh, 3), unit: "m" },
                { symbol: "δ", label: x.rBeda, value: fmt(tampil(bedaPeluru), 4), unit: gugur ? undefined : "m", tint: C.ink3 },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hCe,
                    rumus: (<><span>Ce = {fmt(0.602, 3)} + {fmt(0.075, 3)} ·</span><Frac num="h" den="P" /></>),
                    isi: `${fmt(0.602, 3)} + ${fmt(0.075, 3)} · ${fmt(h, 3)} / ${fmt(P, 2)}`,
                    hasil: fmt(tampil(r.Ce), 4),
                  },
                  {
                    judul: x.hHe,
                    rumus: <span>he = h + {fmt(RECT_WEIR_KH, 3)}</span>,
                    isi: `${fmt(h, 3)} + ${fmt(RECT_WEIR_KH, 3)}`,
                    hasil: fmt(r.he, 4),
                    satuan: "m",
                  },
                  {
                    judul: x.hQ,
                    rumus: (<><span>Q =</span><Frac num="2" den="3" /><span>· Ce · √( 2g ) · b · he^{fmt(1.5, 1)}</span><span className="ml-3">V₀ =</span><Frac num="Q" den="b · h" /></>),
                    isi: gugur
                      ? "—"
                      : `( 2/3 ) · ${fmt(r.Ce, 5)} · √( 2 · ${fmt(G, 2)} ) · ${fmt(b, 1)} · ${fmt(r.he, 4)}^${fmt(1.5, 1)} ; V₀ = ${fmt(r.Q, 5)} / ( ${fmt(b, 1)} · ${fmt(h, 3)} ) = ${fmt(r.V0, 4)} m/s`,
                    hasil: fmt(tampil(r.Q), 4),
                    satuan: gugur ? undefined : "m³/s",
                    tint: C.water,
                  },
                  {
                    judul: x.hL,
                    rumus: <span>L^{fmt(1.85, 2)} = 2 · h^{fmt(0.85, 2)} · P</span>,
                    isi: `( 2 · ${fmt(h, 3)}^${fmt(0.85, 2)} · ${fmt(Math.max(P, 0.01), 2)} )^( 1/${fmt(1.85, 2)} )`,
                    hasil: fmt(xJatuh, 3),
                    satuan: "m",
                  },
                  {
                    judul: x.hD,
                    rumus: (<><span>δ =</span><Frac num="g h²" den="2 V₀²" /><span>−</span><Frac num="h" den="2" /></>),
                    isi: gugur
                      ? "—"
                      : `${fmt(G, 2)} · ${fmt(h, 3)}² / ( 2 · ${fmt(r.V0, 4)}² ) − ${fmt(h / 2, 4)} = ${fmt(jetTrajectory(r.V0, h), 4)} − ${fmt(h / 2, 4)}`,
                    hasil: fmt(tampil(bedaPeluru), 4),
                    satuan: gugur ? undefined : "m",
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard {...bacaKeadaan(h, P, tail, aerated, tenggelam, r, bedaPeluru, alasanLuar, lang)} />
        </>
      }
      verification={<Verification checks={checksNappe(h, b, P)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>x^{fmt(1.85, 2)} = 2 h^{fmt(0.85, 2)} y</span>
                <span className="ml-6 text-ink-3">
                  {lang === "id" ? "bentuk WES, muka hulu tegak" : "WES shape, vertical upstream face"}
                </span>
              </Eq>
              <Eq>
                <span>Q =</span>
                <Frac num="2" den="3" />
                <span>Ce √(2g) b he^{fmt(1.5, 1)}</span>
                <span className="ml-5">Ce = {fmt(0.602, 3)} + {fmt(0.075, 3)}</span>
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

/*
 * Kalimat bentuk tirai (CACAT 2). Kalimat lama menulis kedua lintasan
 * memisah lebih cepat bila h naik; dijalankan (P 0,6): δ/h 0,933 (h 0,05),
 * 0,862 (0,3), 0,721 (0,6), 0,492 (1,2). Dalam satuan h bentuk tirai tetap,
 * yang berubah lintasan peluru, dan ia MENDEKATI tirai karena Ce naik.
 */
function bacaKeadaan(
  h: number,
  P: number,
  tail: number,
  aerated: boolean,
  tenggelam: boolean,
  r: ReturnType<typeof rectWeirDischarge>,
  beda: number,
  alasanLuar: string,
  lang: Lang
): { tone: Tone; badge: string; state: string; notice: string[] } {
  const x = TXT[lang];
  if (tenggelam)
    return {
      tone: "invalid",
      badge: x.tenggelam,
      state: x.sTenggelam(fmt(tail, 2), fmt(P, 2)),
      notice: [x.tenggelamNote, x.saranTenggelam],
    };
  if (!aerated)
    return { tone: "invalid", badge: x.notAerated, state: x.sTanpaUdara, notice: [x.notAeratedNote, x.saranUdara] };
  const bentuk = x.bentukTetap(fmt(h > 0 ? beda / h : NaN, 3), fmt(h / P, 3));
  if (r.outOfRange)
    return {
      tone: "invalid",
      badge: x.luar,
      state: x.sLuar(alasanLuar),
      notice: [x.ekstrapolasi, bentuk],
    };
  return {
    tone: "water",
    badge: x.badgeBebas,
    state: x.sBebas(fmt(r.Q, 4), fmt(r.Q * 1000, 0), fmt(r.Ce, 4)),
    notice: [bentuk],
  };
}
