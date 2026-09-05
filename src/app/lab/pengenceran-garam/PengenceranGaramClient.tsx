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
import { drawTracer } from "@/lib/drawTracer";
import {
  TRACER_MIX_WIDTHS,
  dilutionDischarge,
  fmt,
  tracerCurve,
  type TracerResult,
} from "@/lib/hydraulics";
import { C } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksTracer } from "@/lib/checks";

const TXT = {
  id: {
    title: "Pengukuran pengenceran garam",
    sheetTitle: "Awan tracer di penampang ukur — penyuntikan sesaat",
    dQ: "Debit sungai yang sebenarnya",
    dM: "Massa garam yang disuntikkan",
    dL: "Jarak titik suntik ke penampang ukur",
    dA: "Luas penampang rata-rata",
    dD: "Koefisien sebaran memanjang",
    dB: "Lebar sungai",
    pKecil: "Anak sungai berbatu",
    pSedang: "Sungai pegunungan",
    pBesar: "Sungai sedang",
    rQgulp: "Debit dari luas kurva",
    rQlaju: "Debit dari cara laju tetap",
    rArea: "Luas di bawah kurva",
    rPeak: "Kepekatan puncak",
    rTpeak: "Waktu datangnya puncak",
    rTtravel: "Waktu tempuh rata-rata",
    rDur: "Lama awan lewat",
    rU: "Kecepatan rata-rata",
    rMix: "Panjang pencampuran yang disyaratkan",
    kurang: "Pencampuran belum cukup",
    kurangNote:
      "Jarak dari titik suntik ke penampang ukur lebih pendek daripada patokan pencampuran. Bila garam belum bercampur merata di seluruh penampang, kepekatan yang terbaca bergantung pada di mana tepatnya alat ukur dicelupkan, dan luas kurvanya kehilangan artinya. Ini bukan kesalahan yang tampak pada hasil: angkanya tetap keluar, hanya saja salah. Perpanjang jaraknya, atau suntikkan garam di beberapa titik melintang sekaligus.",
    note:
      "Cara ini dipakai justru pada sungai yang tidak mungkin diukur dengan cara biasa: berbatu, berarus deras, dan penampangnya berubah setiap beberapa meter. Kekuatannya terletak pada satu kenyataan yang mudah terlewat. Yang menentukan hasilnya bukan bentuk kurva melainkan LUAS di bawahnya, dan luas itu sama dengan massa yang disuntikkan dibagi debitnya, apa pun yang terjadi pada awan garam di perjalanan. Sebaran memanjang boleh besar atau kecil, sungai boleh berkelok, arus boleh berputar di balik batu: semuanya mengubah bentuk kurvanya tetapi tidak mengubah luasnya, karena seluruh garam yang disuntikkan pasti lewat. Garis khayal pada gambar memperlihatkan hal itu langsung, yaitu kurva pada sebaran tiga kali lebih besar yang jauh lebih pendek dan lebar tetapi luasnya sama. Konsekuensinya, koefisien sebaran tidak perlu diketahui sama sekali untuk mengukur debit, dan itu sebabnya cara ini bekerja di tempat yang persamaannya sendiri tidak dapat diselesaikan. Satu syarat tetap mengikat, dan pelanggarannya tidak akan terlihat pada hasil: garam harus sudah bercampur merata di seluruh penampang sebelum sampai ke alat ukur.",
  },
  en: {
    title: "Salt dilution gauging",
    sheetTitle: "Tracer cloud at the measuring section — gulp injection",
    dQ: "True river discharge",
    dM: "Mass of salt injected",
    dL: "Distance from injection to the measuring section",
    dA: "Mean cross-sectional area",
    dD: "Longitudinal dispersion coefficient",
    dB: "River width",
    pKecil: "Boulder tributary",
    pSedang: "Mountain stream",
    pBesar: "Medium river",
    rQgulp: "Discharge from the area under the curve",
    rQlaju: "Discharge from the constant-rate method",
    rArea: "Area under the curve",
    rPeak: "Peak concentration",
    rTpeak: "Time of the peak",
    rTtravel: "Mean travel time",
    rDur: "Duration of the passing cloud",
    rU: "Mean velocity",
    rMix: "Mixing length required",
    kurang: "Mixing not yet complete",
    kurangNote:
      "The distance from injection to the measuring section is shorter than the mixing rule of thumb. If the salt has not spread evenly across the section, the concentration read depends on exactly where the probe was dipped, and the area under the curve loses its meaning. This is not an error that shows in the result: a number still comes out, it is simply wrong. Lengthen the reach, or inject at several points across the width at once.",
    note:
      "This method is used precisely on the rivers that cannot be gauged the ordinary way: boulder-strewn, fast, with a cross section that changes every few metres. Its strength rests on one fact that is easy to miss. What sets the result is not the shape of the curve but the AREA under it, and that area equals the mass injected divided by the discharge, whatever happens to the salt cloud on the way. Dispersion may be large or small, the river may meander, the current may eddy behind boulders: all of that changes the shape of the curve and none of it changes the area, because every gram injected must pass. The phantom line on the drawing shows this directly, being the curve at three times the dispersion, much lower and wider, with the same area. The consequence is that the dispersion coefficient need not be known at all to measure the discharge, which is why the method works where its own equation cannot be solved. One condition still binds, and breaking it will not show in the result: the salt must be evenly mixed across the whole section before it reaches the probe.",
  },
} as const;

const REFS = {
  id: [
    "ISO 9555. Measurement of liquid flow in open channels — Tracer dilution methods.",
    "Day, T.J. (1977). Field procedures and evaluation of a slug dilution gauging method in mountain streams. Journal of Hydrology, New Zealand.",
    "Fischer, H.B. dkk. (1979). Mixing in Inland and Coastal Waters. Academic Press.",
    "Moore, R.D. (2005). Slug injection using salt in solution. Streamline Watershed Management Bulletin.",
  ],
  en: [
    "ISO 9555. Measurement of liquid flow in open channels — Tracer dilution methods.",
    "Day, T.J. (1977). Field procedures and evaluation of a slug dilution gauging method in mountain streams. Journal of Hydrology, New Zealand.",
    "Fischer, H.B. et al. (1979). Mixing in Inland and Coastal Waters. Academic Press.",
    "Moore, R.D. (2005). Slug injection using salt in solution. Streamline Watershed Management Bulletin.",
  ],
} as const;

export function PengenceranGaramClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [Q, setQ] = useState(1.2);
  const [M, setM] = useState(2);
  const [L, setL] = useState(120);
  const [A, setA] = useState(1.5);
  const [D, setD] = useState(3);
  const [B, setB] = useState(4);

  const r = tracerCurve(Q, M, L, A, D);
  const rLebar = tracerCurve(Q, M, L, A, D * 3);
  const u = A > 0 ? Q / A : 0;
  const panjangCampur = TRACER_MIX_WIDTHS * B;
  const kurang = L < panjangCampur;

  // Cara laju tetap, disusun dari keadaan yang sama supaya kedua cara dapat
  // dibandingkan pada satu lembar.
  const qSuntik = 0.5;
  const c1 = 200000;
  const c0 = 5;
  const c2 = (qSuntik * c1 + Q * 1000 * c0) / (qSuntik + Q * 1000);
  const Qlaju = dilutionDischarge(qSuntik, c1, c2, c0);

  const ref = useCanvas(
    (ctx, w, h) =>
      drawTracer(
        ctx,
        w,
        h,
        {
          points: r.points,
          cPeak: r.cPeak,
          tPeak: r.tPeak,
          tTravel: r.tTravel,
          area: r.area,
          Qgulp: r.Qgulp,
          compare: rLebar.points,
          plateau: c2 - c0,
          outOfRange: kurang,
        },
        lang
      ),
    [Q, M, L, A, D, B, lang]
  );

  return (
    <LabShell
      sheet="FM-05"
      subject={SUBJECTS.FM[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Pada sungai berbatu yang penampangnya berubah setiap beberapa
            meter, debit tidak diukur melainkan dihitung dari{" "}
            <Term tint={C.water}>luas di bawah kurva kepekatan</Term>. Bentuk
            kurvanya boleh apa saja, karena yang menyimpan debitnya bukan
            bentuk melainkan luas.
          </p>
        ) : (
          <p>
            On a boulder stream whose cross section changes every few metres,
            discharge is not measured but computed from the{" "}
            <Term tint={C.water}>area under the concentration curve</Term>. The
            shape of the curve may be anything, because what holds the
            discharge is not the shape but the area.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FM-05"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m³/s, mg/l)" },
            { label: "M", value: `${fmt(M, 2)} kg` },
            { label: "Q", value: `${fmt(r.Qgulp, 3)} m³/s`, tint: C.water },
            { label: x.rPeak, value: `${fmt(r.cPeak, 1)} mg/l` },
            {
              label: x.rMix,
              value: `${fmt(panjangCampur, 0)} m`,
              tint: kurang ? C.signal : undefined,
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
              <InputRow symbol="Q" label={x.dQ} value={Q} min={0.05} max={20} step={0.05} digits={2} unit="m³/s" onChange={setQ} tint={C.water} />
              <InputRow symbol="M" label={x.dM} value={M} min={0.1} max={30} step={0.1} digits={1} unit="kg" onChange={setM} />
              <InputRow symbol="L" label={x.dL} value={L} min={10} max={600} step={5} digits={0} unit="m" onChange={setL} />
              <InputRow symbol="A" label={x.dA} value={A} min={0.2} max={20} step={0.1} digits={1} unit="m²" onChange={setA} />
              <InputRow symbol="D" label={x.dD} value={D} min={0.2} max={30} step={0.2} digits={1} unit="m²/s" onChange={setD} />
              <InputRow symbol="B" label={x.dB} value={B} min={0.5} max={30} step={0.5} digits={1} unit="m" onChange={setB} tint={C.signal} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pKecil, apply: () => { setQ(0.4); setM(0.5); setL(80); setA(0.8); setD(1.5); setB(2.5); } },
                  { label: x.pSedang, apply: () => { setQ(1.2); setM(2); setL(120); setA(1.5); setD(3); setB(4); } },
                  { label: x.pBesar, apply: () => { setQ(5); setM(10); setL(300); setA(4); setD(8); setB(10); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={C.water}>{`${fmt(r.Qgulp, 3)} m³/s`}</Flag>
              {kurang && <Flag alert>{x.kurang}</Flag>}
            </div>
            {kurang && (
              <div className="mb-2.5">
                <Note>{x.kurangNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "Q", label: x.rQgulp, value: fmt(r.Qgulp, 4), unit: "m³/s", tint: C.water, strong: true },
                { symbol: "Q′", label: x.rQlaju, value: fmt(Qlaju, 4), unit: "m³/s", tint: C.energy, strong: true },
                { symbol: "∫c dt", label: x.rArea, value: fmt(r.area, 1), unit: "mg·s/l" },
                { symbol: "c_max", label: x.rPeak, value: fmt(r.cPeak, 2), unit: "mg/l", tint: C.signal },
                { symbol: "t_p", label: x.rTpeak, value: fmt(r.tPeak, 0), unit: "s" },
                { symbol: "L/u", label: x.rTtravel, value: fmt(r.tTravel, 0), unit: "s", tint: C.critical },
                { symbol: "Δt", label: x.rDur, value: fmt(r.duration, 0), unit: "s" },
                { symbol: "u", label: x.rU, value: fmt(u, 3), unit: "m/s" },
                { symbol: "L*", label: x.rMix, value: fmt(panjangCampur, 0), unit: "m", tint: kurang ? C.signal : undefined },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(r, rLebar, kurang, panjangCampur, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksTracer(Q, M, L, A, D)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Q =</span>
                <Frac num="M" den="∫ (c − c₀) dt" />
                <span className="ml-6">Q = q</span>
                <Frac num="c₁ − c₂" den="c₂ − c₀" />
              </Eq>
              <Eq>
                <span>c(t) =</span>
                <Frac num="M / A" den="√(4 π D t)" />
                <span>exp</span>
                <span className="ml-1">( −(L − u t)² / (4 D t) )</span>
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
  r: TracerResult,
  rLebar: TracerResult,
  kurang: boolean,
  panjangCampur: number,
  lang: Lang
): string {
  if (kurang) {
    return lang === "id"
      ? `Perpanjang jaraknya sampai melewati ${panjangCampur.toFixed(0)} m, atau perkecil lebar sungainya. Selama syarat pencampuran belum terpenuhi, angka pada tabel di atas tetap keluar tetapi tidak berarti apa-apa, dan kurvanya digambar titik rapat untuk menyatakan hal itu.`
      : `Lengthen the reach past ${panjangCampur.toFixed(0)} m, or narrow the river. While the mixing condition is unmet the numbers in the table still appear but mean nothing, and the curve is drawn with fine dots to say so.`;
  }

  const bedaPuncak = ((r.cPeak - rLebar.cPeak) / r.cPeak) * 100;
  const bedaLuas = ((r.Qgulp - rLebar.Qgulp) / r.Qgulp) * 100;

  if (lang === "en")
    return `Compare the two curves. Tripling the dispersion drops the peak by ${bedaPuncak.toFixed(0)} per cent and stretches the cloud out over a much longer time, yet the discharge computed from the two areas differs by only ${Math.abs(bedaLuas).toFixed(3)} per cent. That is the whole method in one comparison: the peak is the part that catches the eye and the part that does not matter, while the area is the part that is easy to overlook and the part that holds the answer.`;
  return `Bandingkan kedua kurvanya. Melipattigakan sebarannya menurunkan puncak sebesar ${bedaPuncak.toFixed(0)} persen dan menjulurkan awannya jauh lebih lama, tetapi debit yang dihitung dari kedua luasnya hanya berbeda ${Math.abs(bedaLuas).toFixed(3)} persen. Itulah seluruh isi cara ini dalam satu perbandingan: puncak adalah bagian yang menarik perhatian mata dan tidak menentukan apa pun, sedangkan luas adalah bagian yang mudah terlewat dan justru menyimpan jawabannya.`;
}
