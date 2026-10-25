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
import { drawTracer } from "@/lib/drawTracer";
import {
  TRACER_MIX_WIDTHS,
  TRACER_PECLET_MIN,
  dilutionDischarge,
  fmt,
  tracerCurve,
  type TracerResult,
} from "@/lib/hydraulics";
import { C, type Tone } from "@/lib/theme";
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
    rPe: "Bilangan Peclet, u L dibagi D",
    rQlaju: "Debit dari cara laju tetap",
    rArea: "Luas di bawah kurva",
    rPeak: "Kepekatan puncak",
    rTpeak: "Waktu datangnya puncak",
    rTtravel: "Waktu tempuh rata-rata",
    rDur: "Lama awan lewat",
    rU: "Kecepatan rata-rata",
    rMix: "Panjang pencampuran yang disyaratkan",
    kurang: "Pencampuran belum cukup",
    tercampur: "Tercampur, angkutan menguasai",
    bandSebar: "Penyebaran menguasai",
    bandAngkut: "Angkutan menguasai",
    bandBelum: "Belum tercampur, patokan 25 B",
    bandCampur: "Tercampur",
    hU: "Kecepatan dan waktu tempuh",
    hPe: "Bilangan Peclet",
    hPuncak: "Kepekatan puncak, dibaca dari kurva",
    hQ: "Luas kurva dan debit",
    hLaju: "Cara laju tetap: c₂ disusun dari Q yang dimasukkan, jadi Q′ = Q dengan sendirinya",
    sebar: "Penyebaran menguasai angkutan",
    sebarNote:
      "Bilangan Peclet, yaitu kecepatan dikali jarak dibagi koefisien sebaran, turun di bawah sepuluh. Pada keadaan itu awan garam menyebar hampir secepat ia terbawa arus, dan model sebaran satu dimensi (Fick) yang dipakai untuk menggambar kurva ini belum berlaku sedekat itu dengan titik suntik (Fischer dkk. 1979). Kurvanya juga berekor panjang, dan lembar ini memotong hitungan luasnya pada jendela waktu tetap, jadi bagian ekor yang terpotong ikut membuat debit dari luas kurva meleset. Perpanjang jaraknya, atau pakai bagian sungai yang arusnya lebih deras.",
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
    rPe: "Peclet number, u L divided by D",
    rQlaju: "Discharge from the constant-rate method",
    rArea: "Area under the curve",
    rPeak: "Peak concentration",
    rTpeak: "Time of the peak",
    rTtravel: "Mean travel time",
    rDur: "Duration of the passing cloud",
    rU: "Mean velocity",
    rMix: "Mixing length required",
    kurang: "Mixing not yet complete",
    tercampur: "Mixed, advection dominates",
    bandSebar: "Dispersion dominates",
    bandAngkut: "Advection dominates",
    bandBelum: "Not yet mixed, 25 B rule",
    bandCampur: "Mixed",
    hU: "Velocity and travel time",
    hPe: "Peclet number",
    hPuncak: "Peak concentration, read from the curve",
    hQ: "Area under the curve and discharge",
    hLaju: "Constant-rate method: c₂ is built from the Q entered, so Q′ = Q by construction",
    sebar: "Dispersion dominates transport",
    sebarNote:
      "The Peclet number, velocity times distance divided by the dispersion coefficient, has fallen below ten. The tracer cloud then spreads almost as fast as it travels, and the one-dimensional (Fickian) dispersion model used to draw this curve does not yet hold that close to the injection point (Fischer et al. 1979). The curve also has a long tail, and this sheet cuts the area integral off at a fixed time window, so the truncated tail adds to the error in the discharge recovered from the area. Lengthen the reach, or use a stretch with a faster current.",
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
  const sebar = r.dispersionDominated;

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
          outOfRange: kurang || sebar,
        },
        lang
      ),
    [Q, M, L, A, D, B, lang]
  );

  /* Galat debit dari luas kurva terhadap debit yang dimasukkan, ditulis
     sebagai angka, bukan "meleset jauh": pada Pe 9,6 galatnya 0,15 %. */
  const galat = Q > 0 ? ((r.Qgulp - Q) / Q) * 100 : 0;
  const rasioCampur = panjangCampur > 0 ? L / panjangCampur : 0;
  /* Belum tercampur adalah patokan praktik (lib menyebutnya penanda
     kelayakan), bukan batas berlaku rumus: oker, bukan merah sinyal. */
  const nada: Tone = sebar ? "invalid" : kurang ? "caution" : "pass";
  const badge = sebar ? x.sebar : kurang ? x.kurang : x.tercampur;
  const sejuta = fmt(1e6, 0);

  const langkah = [
    {
      judul: x.hU,
      rumus: <span>u = Q / A ;  L / u</span>,
      isi: `${fmt(Q, 2)} / ${fmt(A, 1)} = ${fmt(u, 4)} m/s ;  ${fmt(L, 0)} / ${fmt(u, 4)}`,
      hasil: fmt(r.tTravel, 0),
      satuan: "s",
      tint: C.critical,
    },
    {
      judul: x.hPe,
      rumus: (<><span>Pe =</span><Frac num="u L" den="D" /></>),
      isi: `${fmt(u, 4)} · ${fmt(L, 0)} / ${fmt(D, 1)}`,
      hasil: fmt(r.peclet, 1),
      tint: sebar ? C.signal : undefined,
    },
    {
      judul: x.hPuncak,
      rumus: <span>c_maks = maks c( L, t )</span>,
      isi: `t_p = ${fmt(r.tPeak, 0)} s`,
      hasil: fmt(r.cPeak, 2),
      satuan: "mg/l",
    },
    {
      judul: x.hQ,
      rumus: (<><span>Q =</span><Frac num={`M · ${sejuta}`} den="∫ c dt" /><span>/ 1000</span></>),
      isi: `∫ c dt = ${fmt(r.area, 1)} mg·s/l ;  ${fmt(M, 1)} · ${sejuta} / ${fmt(r.area, 1)} / 1000`,
      hasil: fmt(r.Qgulp, 4),
      satuan: "m³/s",
      tint: sebar ? C.signal : C.water,
    },
    {
      judul: x.hLaju,
      rumus: (<><span>c₂ =</span><Frac num="q c₁ + Q c₀" den="q + Q" /><span className="ml-3">Q′ = q</span><Frac num="c₁ − c₂" den="c₂ − c₀" /></>),
      isi: `c₂ = ( ${fmt(qSuntik, 1)} · ${fmt(c1, 0)} + ${fmt(Q * 1000, 0)} · ${fmt(c0, 0)} ) / ( ${fmt(qSuntik, 1)} + ${fmt(Q * 1000, 0)} ) = ${fmt(c2, 3)} mg/l ;  ${fmt(qSuntik, 1)} · ( ${fmt(c1, 0)} − ${fmt(c2, 3)} ) / ( ${fmt(c2, 3)} − ${fmt(c0, 0)} ) / 1000`,
      hasil: fmt(Qlaju, 4),
      satuan: "m³/s",
      tint: C.energy,
    },
  ];

  return (
    <LabShell
      status={
        /* Batas pita dari TRACER_PECLET_MIN (10) dan TRACER_MIX_WIDTHS (25
           lebar sungai; Day 1977, Moore 2005). Sumbu Pe 10⁻⁴ sampai 10⁶ dan
           L/L* 0,01 sampai 50 memuat rentang penggeser (Pe 8,3·10⁻⁴ sampai
           3,0·10⁵; L/L* 0,013 sampai 48). */
        <div className="flex flex-col gap-2">
          <RegimeScale
            symbol="Pe"
            value={r.peclet}
            invalid={sebar}
            scale="log"
            digits={1}
            bands={[
              { from: 1e-4, to: TRACER_PECLET_MIN, label: x.bandSebar, tone: "invalid" },
              { from: TRACER_PECLET_MIN, to: 1e6, label: x.bandAngkut, tone: "pass" },
            ]}
          />
          <RegimeScale
            symbol="L/L*"
            value={rasioCampur}
            scale="log"
            digits={2}
            bands={[
              { from: 0.01, to: 1, label: x.bandBelum, tone: "caution" },
              { from: 1, to: 50, label: x.bandCampur, tone: "pass" },
            ]}
          />
        </div>
      }
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
            // Merah bila lembar ini sendiri menyatakan angkanya tidak berlaku.
            { label: "Q", value: `${fmt(r.Qgulp, 3)} m³/s`, tint: sebar ? C.signal : C.water },
            { label: x.rPeak, value: `${fmt(r.cPeak, 1)} mg/l` },
            {
              label: x.rMix,
              value: `${fmt(panjangCampur, 0)} m`,
              tint: kurang ? C.caution : undefined,
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
              <InputRow symbol="B" label={x.dB} value={B} min={0.5} max={30} step={0.5} digits={1} unit="m" onChange={setB} />
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
            <ResultTable
              rows={[
                { symbol: "Q", label: x.rQgulp, value: fmt(r.Qgulp, 4), unit: "m³/s", tint: sebar ? C.signal : C.water, strong: true },
                /* Q′ selalu sama dengan Q masukan (c₂ disusun dari Q), jadi
                   bukan angka utama; Pe yang ditulis besar. */
                { symbol: "Pe", label: x.rPe, value: fmt(r.peclet, 1), tint: sebar ? C.signal : undefined, strong: true },
                { symbol: "Q′", label: x.rQlaju, value: fmt(Qlaju, 4), unit: "m³/s", tint: C.energy },
                { symbol: "∫c dt", label: x.rArea, value: fmt(r.area, 1), unit: "mg·s/l" },
                { symbol: "c_max", label: x.rPeak, value: fmt(r.cPeak, 2), unit: "mg/l" },
                { symbol: "t_p", label: x.rTpeak, value: fmt(r.tPeak, 0), unit: "s" },
                { symbol: "L/u", label: x.rTtravel, value: fmt(r.tTravel, 0), unit: "s", tint: C.critical },
                { symbol: "Δt", label: x.rDur, value: fmt(r.duration, 0), unit: "s" },
                { symbol: "u", label: x.rU, value: fmt(u, 3), unit: "m/s" },
                { symbol: "L*", label: x.rMix, value: fmt(panjangCampur, 0), unit: "m", tint: kurang ? C.caution : undefined },
              ]}
            />
            <div className="mt-3">
              <Hitungan langkah={langkah} />
            </div>
          </Block>

          <StateCard
            tone={nada}
            badge={badge}
            state={
              lang === "id"
                ? `Luas kurva ${fmt(r.area, 1)} mg·s/l memberi Q ${fmt(r.Qgulp, 3)} m³/s.`
                : `A curve area of ${fmt(r.area, 1)} mg·s/l gives Q ${fmt(r.Qgulp, 3)} m³/s.`
            }
            notice={butir(r, rLebar, kurang, sebar, panjangCampur, galat, x, lang)}
          />
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

/*
 * Butir yang perlu diperhatikan. Kalimat Peclet tidak lagi menulis "jauh
 * di bawah sepuluh … meleset jauh": pada Pe 9,6 debitnya hanya meleset
 * 0,15 %. Galatnya ditulis dari angka hasil model.
 */
function butir(
  r: TracerResult,
  rLebar: TracerResult,
  kurang: boolean,
  sebar: boolean,
  panjangCampur: number,
  galat: number,
  x: (typeof TXT)[Lang],
  lang: Lang
): string[] {
  const en = lang === "en";
  const out: string[] = [];
  if (sebar) {
    out.push(x.sebarNote);
    out.push(
      en
        ? `The Peclet number is ${fmt(r.peclet, 1)}, below ten; here the discharge from the area differs from the true discharge by ${fmt(galat, 2)} per cent. Lengthen the reach, or raise the velocity by reducing the cross-section, and watch the Peclet number climb and the curve return to a clean bell.`
        : `Bilangan Peclet-nya ${fmt(r.peclet, 1)}, di bawah sepuluh; di sini debit dari luas kurva berselisih ${fmt(galat, 2)} persen dari debit sebenarnya. Perpanjang jaraknya, atau perbesar kecepatannya dengan memperkecil luas penampang, lalu perhatikan Peclet naik dan kurvanya kembali berbentuk lonceng yang rapi.`
    );
  }
  if (kurang) {
    out.push(x.kurangNote);
    out.push(
      en
        ? `Lengthen the reach past ${fmt(panjangCampur, 0)} m, or narrow the river. While the mixing condition is unmet the numbers still appear but mean nothing, and the curve is drawn with fine dots to say so.`
        : `Perpanjang jaraknya sampai melewati ${fmt(panjangCampur, 0)} m, atau perkecil lebar sungainya. Selama syarat pencampuran belum terpenuhi, angkanya tetap keluar tetapi tidak berarti apa-apa, dan kurvanya digambar titik rapat untuk menyatakan hal itu.`
    );
  }
  if (sebar || kurang) return out;

  const bedaPuncak = ((r.cPeak - rLebar.cPeak) / r.cPeak) * 100;
  const bedaLuas = ((r.Qgulp - rLebar.Qgulp) / r.Qgulp) * 100;
  out.push(
    en
      ? `Compare the two curves. Tripling the dispersion drops the peak by ${fmt(bedaPuncak, 0)} per cent and stretches the cloud out over a much longer time, yet the discharge computed from the two areas differs by only ${fmt(Math.abs(bedaLuas), 3)} per cent.`
      : `Bandingkan kedua kurvanya. Melipattigakan sebarannya menurunkan puncak sebesar ${fmt(bedaPuncak, 0)} persen dan menjulurkan awannya jauh lebih lama, tetapi debit yang dihitung dari kedua luasnya hanya berbeda ${fmt(Math.abs(bedaLuas), 3)} persen.`,
    en
      ? "That is the whole method in one comparison: the peak catches the eye and does not matter, while the area is easy to overlook and holds the answer."
      : "Itulah seluruh isi cara ini dalam satu perbandingan: puncak menarik perhatian mata dan tidak menentukan apa pun, sedangkan luas mudah terlewat dan justru menyimpan jawabannya."
  );
  return out;
}
