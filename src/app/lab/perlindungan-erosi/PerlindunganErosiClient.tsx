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
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import {
  ISBASH_EMBEDDED,
  ISBASH_EXPOSED,
  G,
  SEDIMENT_S,
  fmt,
  fmtPlain,
  riprapSize,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksRiprap } from "@/lib/checks";

const TXT = {
  id: {
    title: "Perlindungan erosi",
    sheetTitle: "Ukuran batu terhadap kecepatan aliran — rumus Isbash",
    dV: "Kecepatan rata-rata aliran",
    dS: "Berat jenis relatif batu (Gs)",
    dC: "Koefisien Isbash (C)",
    dChosen: "Ukuran batu yang direncanakan",
    pTertanam: "Batu tertanam rapat",
    pMenonjol: "Batu menonjol sendirian",
    pDeras: "Hilir pelimpah, batu 400 mm kurang",
    rD50: "Ukuran batu yang dituntut",
    rMassa: "Massa satu batu terpilih",
    rTebal: "Tebal lapisan yang disyaratkan",
    rVtahan: "Kecepatan yang sanggup ditahan",
    rPakai: "Perbandingan kecepatan kerja terhadap tahan",
    mantap: "Batu terpilih mantap",
    belumPilih: "Ukuran batu belum dipilih",
    belumPilihNote:
      "Penggeser ukuran batu masih di nol, artinya belum ada ukuran yang dipilih untuk dibandingkan. Empat baris terakhir tabel hasil karena itu dihitung dengan ukuran yang DITUNTUT alirannya, bukan dengan ukuran yang direncanakan, sehingga perbandingan kecepatan kerja terhadap kecepatan tahan pasti tepat satu. Angka satu di situ bukan hasil melainkan akibat dari belum adanya pilihan. Geser ukuran batunya ke nilai yang benar-benar akan dipakai supaya perbandingannya berarti.",
    goyah: "Batu terpilih terlalu kecil",
    bandMantap: "Batu mantap",
    bandGerak: "Batu bergerak",
    mD50: "Massa pada d₅₀",
    hMassa: "Massa satu batu (bola berdiameter d)",
    hBelum: "d belum dipilih: dipakai d₅₀, V/Vc = 1",
    pasir:
      "Ukuran yang dituntut kurang dari 2 mm, setara butir pasir. Rumus Isbash disusun untuk batu lapis lindung; angka sekecil ini hanya berarti aliran selambat ini tidak menuntut lapisan batu.",
    goyahNote:
      "Yang perlu diperhatikan tentang kegagalan lapisan batu: ia tidak pernah bertahap. Begitu beberapa batu terangkat, lubang yang ditinggalkannya memperbesar kecepatan setempat, batu tetangganya ikut terangkat, dan seluruh lapisan terbuka dalam satu banjir yang sama. Itu sebabnya perlindungan batu dirancang dengan cadangan ukuran, bukan dengan cadangan luas.",
    note:
      "Dua hal pada lembar ini yang paling berguna diingat, dan keduanya berasal dari pangkat pada rumusnya. Pertama, kecepatan muncul berpangkat dua pada ukuran batu, sehingga menggandakan kecepatan menuntut batu empat kali lebih besar diameternya. Karena massa sebanding dengan pangkat tiga diameter, itu berarti enam puluh empat kali lebih berat. Perbedaan antara aliran dua meter per detik dan empat meter per detik karena itu bukan perbedaan derajat melainkan perbedaan antara batu yang dapat diangkat dua orang dan batu yang menuntut alat berat. Kedua, koefisien Isbash menyatakan seberapa terlindung sebuah batu oleh tetangganya, dan perbedaan antara batu yang tertanam rapat dengan batu yang menonjol sendirian hampir dua kali lipat pada ukurannya. Itu sebabnya mutu pemasangan lapisan batu sama menentukannya dengan ukuran batunya sendiri: lapisan yang dipasang asal tumpuk membuat sebagian batunya menonjol, dan batu yang menonjol itulah yang lepas lebih dulu lalu membuka seluruh lapisan.",
  },
  en: {
    title: "Erosion protection",
    sheetTitle: "Stone size against flow velocity — the Isbash formula",
    dV: "Mean flow velocity",
    dS: "Specific gravity of the stone (Gs)",
    dC: "Isbash coefficient (C)",
    dChosen: "Stone size planned",
    pTertanam: "Stone embedded tightly",
    pMenonjol: "Stone standing proud alone",
    pDeras: "Below a spillway, 400 mm stone too small",
    rD50: "Stone size required",
    rMassa: "Mass of one chosen stone",
    rTebal: "Layer thickness required",
    rVtahan: "Velocity it can resist",
    rPakai: "Working velocity over resisting velocity",
    mantap: "Chosen stone is stable",
    belumPilih: "No stone size chosen yet",
    belumPilihNote:
      "The stone-size slider is still at zero, meaning no size has been chosen to compare against. The last four rows of the results are therefore computed with the size the flow DEMANDS rather than with a planned size, so the ratio of working velocity to resisting velocity is bound to be exactly one. That one is not a result but a consequence of nothing having been chosen. Move the stone size to the value that will actually be used, and the ratio starts to mean something.",
    goyah: "Chosen stone is too small",
    bandMantap: "Stone stable",
    bandGerak: "Stone moves",
    mD50: "Mass at d₅₀",
    hMassa: "Mass of one stone (sphere of diameter d)",
    hBelum: "no d chosen: d₅₀ is used, V/Vc = 1",
    pasir:
      "The required size is below 2 mm, the size of a sand grain. The Isbash formula was built for armour stone; a size this small only means a flow this slow needs no rock layer.",
    goyahNote:
      "What is worth knowing about riprap failure: it is never gradual. Once a few stones lift, the hole they leave raises the local velocity, their neighbours lift too, and the whole layer opens in the same flood. That is why rock protection is designed with a margin on size rather than a margin on area.",
    note:
      "Two things on this sheet are the most useful to remember, and both come from the exponents in the formula. First, velocity enters the stone size squared, so doubling the velocity demands a stone four times larger in diameter. Since mass scales with the cube of diameter, that is sixty-four times heavier. The difference between a two metre per second flow and a four metre per second flow is therefore not a difference of degree but the difference between a stone two people can lift and a stone that needs machinery. Second, the Isbash coefficient states how sheltered a stone is by its neighbours, and the difference between a tightly embedded stone and one standing proud alone is nearly a factor of two in size. That is why the quality of placement matters as much as the size of the stone: a layer tipped rather than placed leaves some stones proud, and it is those proud stones that go first and then open the whole layer.",
  },
} as const;

const REFS = {
  id: [
    "Isbash, S.V. (1936). Construction of dams by depositing rock in running water. 2nd Congress on Large Dams.",
    "USACE (1994). Hydraulic Design of Flood Control Channels, EM 1110-2-1601.",
    "CIRIA, CUR & CETMEF (2007). The Rock Manual, C683, edisi ke-2.",
    "Pilarczyk, K.W. (2001). Unification of stability formulae for revetments. IAHR Congress.",
  ],
  en: [
    "Isbash, S.V. (1936). Construction of dams by depositing rock in running water. 2nd Congress on Large Dams.",
    "USACE (1994). Hydraulic Design of Flood Control Channels, EM 1110-2-1601.",
    "CIRIA, CUR & CETMEF (2007). The Rock Manual, C683, 2nd ed.",
    "Pilarczyk, K.W. (2001). Unification of stability formulae for revetments. IAHR Congress.",
  ],
} as const;

const V_MIN = 0.2;
const V_MAX = 8;

export function PerlindunganErosiClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [V, setV] = useState(2);
  const [s, setS] = useState(SEDIMENT_S);
  const [Cis, setCis] = useState(ISBASH_EMBEDDED);
  const [chosenMm, setChosenMm] = useState(0);

  const chosen = chosenMm / 1000;
  const r = riprapSize(V, s, Cis, chosen);
  const pas = riprapSize(V, s, Cis);
  const adaPilihan = chosen > 0;
  const dPakai = adaPilihan ? chosen : pas.d50;
  const nada: Tone = !adaPilihan ? "neutral" : r.stable ? "pass" : "caution";
  const badge = !adaPilihan ? x.belumPilih : r.stable ? x.mantap : x.goyah;

  const ref = useCanvas(
    (ctx, w, ch) => {
      const kurva = (C_: number) => {
        const pts: { x: number; y: number }[] = [];
        for (let lg = Math.log10(V_MIN); lg <= Math.log10(V_MAX) + 1e-9; lg += 0.02) {
          const vv = Math.pow(10, lg);
          pts.push({ x: vv, y: riprapSize(vv, s, C_).d50 });
        }
        return pts;
      };

      const deret: ChartSeries[] = [
        {
          pts: kurva(ISBASH_EXPOSED),
          color: C.ink3,
          weight: W.hair,
          dash: DASH.hidden,
          /*
           * Namanya koefisien Isbash-nya sendiri, sejajar dengan kurva yang
           * satu lagi. Sebelumnya terpasang nama SUMBU-nya, dipotong dari
           * "diameter butiran, mm", sehingga di tengah bidang melayang
           * tulisan "diameter butir" yang tidak menyatakan kurva yang
           * mana dan terbaca seperti judul sumbu yang tersesat.
           */
          label: `C ${fmtPlain(ISBASH_EXPOSED, 2)}`,
          labelAt: 0.55,
          labelDy: -11,
        },
        {
          pts: kurva(Cis),
          color: C.critical,
          weight: W.bold,
          label: `C ${fmtPlain(Cis, 2)}`,
          labelAt: 0.78,
          labelDy: 14,
        },
      ];

      drawChart(
        ctx,
        w,
        ch,
        {
          xMin: V_MIN,
          xMax: V_MAX,
          /* Sumbu memuat seluruh rentang penggeser: d₅₀ 0,47 mm (V 0,2,
             C 1,40, Gs 3,20) sampai 6,66 m (V 8, C 0,70, Gs 2,00). */
          yMin: 0.0004,
          yMax: 8,
          xLog: true,
          yLog: true,
          axisX: T.axMeanVel,
          axisY: T.axGrainMm.replace("mm", "m"),
          series: deret,
          rules: adaPilihan
            ? [
                {
                  axis: "y",
                  at: chosen,
                  /* Batu terlalu kecil masih di dalam rentang Isbash:
                     keadaan rancangan yang gagal, oker, bukan merah sinyal. */
                  color: r.stable ? C.water : C.caution,
                  dash: DASH.axis,
                  label: `${T.stoneLayer} ${fmtPlain(chosen, 3)} m`,
                  labelAlign: "left",
                },
              ]
            : undefined,
          point: {
            x: V,
            y: pas.d50,
            label: `${fmtPlain(pas.d50, 3)} m`,
            color: adaPilihan && !r.stable ? C.caution : undefined,
          },
          heading: adaPilihan && !r.stable ? x.goyah : undefined,
          headingColor: C.caution,
        },
        lang
      );
    },
    [V, s, Cis, chosenMm, lang]
  );

  return (
    <LabShell
      status={
        /* Batas dari riprapSize: stable bila d ≥ d₅₀, setara V/Vc ≤ 1.
           Tanpa ukuran terpilih V/Vc = 1 menurut definisi, jadi pita tidak
           membawa informasi dan tidak ditampilkan. Sumbu 0,01 sampai 30
           memuat rentang penggeser (0,0154 sampai 25,8). */
        adaPilihan ? (
          <RegimeScale
            symbol="V/Vc"
            value={r.utilisation}
            scale="log"
            digits={2}
            bands={[
              { from: 0.01, to: 1, label: x.bandMantap, tone: "pass" },
              { from: 1, to: 30, label: x.bandGerak, tone: "caution" },
            ]}
          />
        ) : undefined
      }
      sheet="HS-08"
      subject={SUBJECTS.HS[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Kecepatan muncul <Term tint={C.critical}>berpangkat dua</Term> pada
            ukuran batu, dan massa berpangkat tiga pada ukurannya. Aliran dua
            kali lebih deras menuntut batu{" "}
            <Term tint={C.critical}>enam puluh empat kali lebih berat</Term>.
          </p>
        ) : (
          <p>
            Velocity enters the stone size <Term tint={C.critical}>squared</Term>,
            and mass enters the size cubed. A flow twice as fast demands a stone{" "}
            <Term tint={C.critical}>sixty-four times heavier</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HS-08"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m/s, kg)" },
            { label: "V", value: `${fmt(V, 2)} m/s`, tint: C.water },
            { label: "d50", value: `${fmt(pas.d50, 3)} m`, tint: C.critical },
            /* Sel d50 berisi batu yang dituntut, jadi massanya juga
               massa batu itu, bukan massa batu terpilih. */
            { label: "m(d₅₀)", value: massa(pas.stoneMass) },
            { label: "C", value: fmt(Cis, 2) },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="V" label={x.dV} value={V} min={0.2} max={8} step={0.05} digits={2} unit="m/s" onChange={setV} tint={C.water} />
              <InputRow symbol="Gs" label={x.dS} value={s} min={2} max={3.2} step={0.05} digits={2} onChange={setS} />
              <InputRow symbol="C" label={x.dC} value={Cis} min={0.7} max={1.4} step={0.02} digits={2} onChange={setCis} tint={C.critical} />
              <InputRow symbol="d" label={x.dChosen} value={chosenMm} min={0} max={2000} step={10} digits={0} unit="mm" onChange={setChosenMm} tint={C.critical} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pTertanam, apply: () => { setV(2); setS(SEDIMENT_S); setCis(ISBASH_EMBEDDED); setChosenMm(0); } },
                  { label: x.pMenonjol, apply: () => { setV(2); setS(SEDIMENT_S); setCis(ISBASH_EXPOSED); setChosenMm(0); } },
                  { label: x.pDeras, apply: () => { setV(5); setS(SEDIMENT_S); setCis(ISBASH_EMBEDDED); setChosenMm(400); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "d50", label: x.rD50, value: fmt(pas.d50, 4), unit: "m", tint: C.critical, strong: true },
                { symbol: "m", label: x.rMassa, value: massaAngka(r.stoneMass), unit: massaSatuan(r.stoneMass), strong: true },
                { symbol: "t", label: x.rTebal, value: fmt(r.layerThickness, 3), unit: "m" },
                { symbol: "Vc", label: x.rVtahan, value: fmt(r.capacityVelocity, 3), unit: "m/s", tint: C.water },
                {
                  symbol: "V/Vc",
                  label: x.rPakai,
                  value: fmt(r.utilisation, 3),
                  tint: adaPilihan && !r.stable ? C.caution : undefined,
                  strong: adaPilihan,
                },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.rD50,
                    rumus: (<><span>d₅₀ =</span><Frac num="V²" den="2 g C² (Gs − 1)" /></>),
                    isi: `${fmt(V, 2)}² / ( 2 · ${fmt(G, 2)} · ${fmt(Cis, 2)}² · ( ${fmt(s, 2)} − 1 ) )`,
                    hasil: fmt(pas.d50, 4),
                    satuan: "m",
                    tint: C.critical,
                  },
                  {
                    judul: x.hMassa,
                    rumus: (<><span>m = Gs · ρ ·</span><Frac num="π" den="6" /><span>· d³</span></>),
                    isi: `${fmt(s, 2)} · 1000 · π / 6 · ${fmt(dPakai, 4)}³`,
                    hasil: massaAngka(r.stoneMass),
                    satuan: massaSatuan(r.stoneMass),
                  },
                  {
                    judul: x.rTebal,
                    rumus: <span>t = 2 · d</span>,
                    isi: `2 · ${fmt(dPakai, 4)}`,
                    hasil: fmt(r.layerThickness, 3),
                    satuan: "m",
                  },
                  adaPilihan
                    ? {
                        judul: x.rPakai,
                        rumus: <span>Vc = C · √( 2 g ( Gs − 1 ) d ) ;  V / Vc</span>,
                        isi: `${fmt(Cis, 2)} · √( 2 · ${fmt(G, 2)} · ( ${fmt(s, 2)} − 1 ) · ${fmt(dPakai, 3)} ) = ${fmt(r.capacityVelocity, 3)} m/s ;  ${fmt(V, 2)} / ${fmt(r.capacityVelocity, 4)}`,
                        hasil: fmt(r.utilisation, 3),
                        tint: r.stable ? undefined : C.caution,
                      }
                    : {
                        judul: x.rPakai,
                        rumus: <span>Vc = C · √( 2 g ( Gs − 1 ) d₅₀ )</span>,
                        isi: x.hBelum,
                        hasil: fmt(r.utilisation, 3),
                      },
                ]}
              />
            </div>
          </Block>

          <StateCard tone={nada} badge={badge} {...keadaan(V, s, Cis, pas.d50, adaPilihan, r, x, lang)} />
        </>
      }
      verification={<Verification checks={checksRiprap(V, s, Cis, chosen)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>d₅₀ =</span>
                <Frac num="V²" den="2 g C² (s − 1)" />
                <span className="ml-5">m = s ρ</span>
                <Frac num="π" den="6" />
                <span>d₅₀³</span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `C ${fmtPlain(ISBASH_EMBEDDED, 1)} untuk batu tertanam rapat, ${fmtPlain(ISBASH_EXPOSED, 2)} untuk batu yang menonjol sendirian`
                    : `C ${fmtPlain(ISBASH_EMBEDDED, 1)} for tightly embedded stone, ${fmtPlain(ISBASH_EXPOSED, 2)} for stone standing proud`}
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

/** Massa kecil ditulis dalam gram: 0,0 kg terbaca seperti tanpa batu. */
const KECIL = 0.05;
function massaAngka(m: number) {
  return m < KECIL ? fmt(m * 1000, 1) : fmt(m, 2);
}
function massaSatuan(m: number) {
  return m < KECIL ? "g" : "kg";
}
function massa(m: number) {
  return `${massaAngka(m)} ${massaSatuan(m)}`;
}
/** Diameter dalam mm; di bawah 10 mm diberi satu desimal supaya tidak jadi "1 mm". */
function mm(d: number) {
  return fmt(d * 1000, d < 0.01 ? 1 : 0);
}

/*
 * Kalimat keadaan dan butir yang perlu diperhatikan. Semua angka dihitung
 * dari model pada setelan lembar, termasuk perbandingan koefisien: pada C
 * yang sudah batu menonjol, pembandingnya batu tertanam, bukan dirinya
 * sendiri (dulu kalimatnya menyuruh "setel ke nilai menonjol" dan menulis
 * angka yang sama dengan kalimat pertama).
 */
function keadaan(
  V: number,
  s: number,
  Cis: number,
  d50: number,
  adaPilihan: boolean,
  r: ReturnType<typeof riprapSize>,
  x: (typeof TXT)[Lang],
  lang: Lang
): { state: string; notice: string[] } {
  const dua = riprapSize(V * 2, s, Cis);
  const pas = riprapSize(V, s, Cis);
  const sudahMenonjol = Cis <= ISBASH_EXPOSED + 1e-9;
  const Cbanding = sudahMenonjol ? ISBASH_EMBEDDED : ISBASH_EXPOSED;
  const banding = riprapSize(V, s, Cbanding);
  const lipat = fmt(dua.stoneMass / Math.max(pas.stoneMass, 1e-12), 0);
  const en = lang === "en";
  const dPilih = r.layerThickness / 2;

  const state = !adaPilihan
    ? en
      ? `A flow of ${fmt(V, 2)} m/s demands a ${mm(d50)} mm stone.`
      : `Aliran ${fmt(V, 2)} m/s menuntut batu ${mm(d50)} mm.`
    : r.stable
      ? en
        ? `A ${mm(dPilih)} mm stone holds up to ${fmt(r.capacityVelocity, 2)} m/s; the working velocity is ${fmt(V, 2)} m/s (${fmt(r.utilisation, 2)} times).`
        : `Batu ${mm(dPilih)} mm menahan sampai ${fmt(r.capacityVelocity, 2)} m/s; kecepatan kerja ${fmt(V, 2)} m/s (${fmt(r.utilisation, 2)} kali).`
      : en
        ? `The chosen ${mm(dPilih)} mm stone is too small: ${mm(d50)} mm is required.`
        : `Batu terpilih ${mm(dPilih)} mm terlalu kecil: dituntut ${mm(d50)} mm.`;

  const notice: string[] = [];
  if (!adaPilihan) notice.push(x.belumPilihNote);
  if (adaPilihan && !r.stable) notice.push(x.goyahNote);
  if (d50 < 0.002) notice.push(x.pasir);
  notice.push(
    en
      ? `At ${fmt(V, 2)} m/s the required stone weighs ${massa(pas.stoneMass)}. Double the velocity and it becomes ${mm(dua.d50)} mm weighing ${massa(dua.stoneMass)}: ${lipat} times the mass for twice the speed.`
      : `Pada ${fmt(V, 2)} m/s batu yang dituntut seberat ${massa(pas.stoneMass)}. Lipatduakan kecepatannya dan ia menjadi ${mm(dua.d50)} mm seberat ${massa(dua.stoneMass)}: ${lipat} kali massanya untuk dua kali lajunya.`
  );
  notice.push(
    sudahMenonjol
      ? en
        ? `C is already at the exposed-stone value. The same flow over tightly embedded stone (C ${fmt(ISBASH_EMBEDDED, 2)}) would need only ${mm(banding.d50)} mm. The flow is the same; only how well the stone is held by its neighbours differs.`
        : `C sudah di nilai batu menonjol. Aliran yang sama di atas batu tertanam rapat (C ${fmt(ISBASH_EMBEDDED, 2)}) cukup menuntut ${mm(banding.d50)} mm. Alirannya sama; yang berbeda hanya seberapa baik batunya ditahan tetangganya.`
      : en
        ? `Set the Isbash coefficient to the exposed-stone value (C ${fmt(ISBASH_EXPOSED, 2)}) and the same flow demands ${mm(banding.d50)} mm. The flow did not change; only how well the stone is held by its neighbours did.`
        : `Setel koefisien Isbash ke nilai batu menonjol (C ${fmt(ISBASH_EXPOSED, 2)}) dan aliran yang sama menuntut ${mm(banding.d50)} mm. Alirannya tidak berubah; yang berubah hanya seberapa baik batunya ditahan tetangganya.`
  );
  notice.push(
    en
      ? "Placement quality matters as much as size: a tipped layer leaves some stones proud, and those go first and open the whole layer."
      : "Mutu pemasangan sama menentukannya dengan ukuran: lapisan yang ditumpuk asal membuat sebagian batu menonjol, dan batu itulah yang lepas lebih dulu lalu membuka seluruh lapisan."
  );
  return { state, notice };
}
