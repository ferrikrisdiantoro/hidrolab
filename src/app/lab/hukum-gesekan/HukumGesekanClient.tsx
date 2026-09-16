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
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import {
  chezyFromManning,
  chezyVelocity,
  darcyFromChezy,
  fmt,
  fmtPlain,
  stricklerN,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksFrictionLaws } from "@/lib/checks";

const TXT = {
  id: {
    title: "Hukum gesekan",
    sheetTitle: "Chezy, Manning, dan Darcy — tiga nama untuk satu gesekan",
    dN: "Angka kekasaran Manning",
    dR: "Jari-jari hidrolik",
    dS: "Kemiringan dasar",
    pTanah: "Saluran tanah berumput",
    pBeton: "Saluran beton licin",
    pSungai: "Sungai berbatu",
    rC: "Koefisien Chezy",
    rF: "Faktor gesekan Darcy",
    rV: "Kecepatan aliran seragam",
    rKs: "Kekasaran butir setara, Strickler",
    rNStrickler: "Angka Manning dari kekasaran itu",
    rRasio: "Kenaikan C bila R dilipatempatkan",
    jauh: "Angka kekasaran di luar kebiasaan",
    jauhNote:
      "Angka Manning di luar rentang 0,010 sampai 0,10 hampir tidak pernah ditemui pada saluran nyata. Di bawah 0,010 lebih halus daripada kaca, di atas 0,10 lebih kasar daripada hutan tergenang. Rumusnya tetap memberi angka karena ia memang tidak punya batas di dalam dirinya, tetapi angka itu tidak berdiri di atas pengukuran mana pun.",
    note:
      "Ketiga hukum ini sering diperkenalkan sebagai pilihan, seolah seorang perancang boleh memilih salah satunya. Sebenarnya ketiganya menggambarkan gesekan yang sama dan dapat ditukar satu sama lain tanpa kehilangan apa pun; yang berbeda hanya besaran yang dianggap tetap. Darcy menganggap faktor gesekan tetap, dan itu benar untuk aliran kasar penuh di dalam pipa. Manning menganggap angka kekasaran tetap, dan itu pilihan yang hanya masuk akal untuk saluran terbuka pada rentang kedalaman yang tidak terlalu lebar. Chezy berada di antaranya, dan koefisiennya terang-terangan bergantung pada ukuran saluran. Kurva pada gambar ini menunjukkan akibat pilihan itu: angka Manning yang tetap berarti koefisien Chezy yang naik menurut akar pangkat enam jari-jari hidrolik, dan faktor gesekan Darcy yang justru turun. Yang mana yang benar bukan pertanyaan yang bisa dijawab; yang bisa dijawab adalah yang mana yang paling tidak berubah pada rentang keadaan yang sedang dirancang.",
  },
  en: {
    title: "Friction laws",
    sheetTitle: "Chezy, Manning, and Darcy — three names for one friction",
    dN: "Manning roughness coefficient",
    dR: "Hydraulic radius",
    dS: "Bed slope",
    pTanah: "Grassed earth channel",
    pBeton: "Smooth concrete channel",
    pSungai: "Boulder river",
    rC: "Chezy coefficient",
    rF: "Darcy friction factor",
    rV: "Uniform-flow velocity",
    rKs: "Equivalent grain roughness, Strickler",
    rNStrickler: "Manning value from that roughness",
    rRasio: "Rise in C when R is quadrupled",
    jauh: "Roughness outside common practice",
    jauhNote:
      "Manning values outside 0.010 to 0.10 are almost never met on real channels. Below 0.010 is smoother than glass; above 0.10 is rougher than flooded forest. The formula still returns a number, because it carries no limit within itself, but that number rests on no measurement.",
    note:
      "These three laws are often introduced as a choice, as if a designer were free to pick one. In fact all three describe the same friction and convert into one another without loss; what differs is only which quantity is held constant. Darcy holds the friction factor constant, and that is right for fully rough flow in pipes. Manning holds the roughness coefficient constant, a choice that only makes sense for open channels over a limited range of depths. Chezy sits between them, and its coefficient depends openly on the size of the channel. The curves here show the consequence of that choice: a constant Manning value means a Chezy coefficient rising as the sixth root of hydraulic radius, and a Darcy friction factor falling. Which one is correct is not an answerable question; what is answerable is which one changes least over the range of conditions being designed for.",
  },
} as const;

const REFS = {
  id: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill, Bab 5.",
    "Strickler, A. (1923). Beiträge zur Frage der Geschwindigkeitsformel. Mitteilungen des Eidgenössischen Amtes für Wasserwirtschaft 16.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan, Bab 4.",
    "Yen, B.C. (2002). Open channel flow resistance. Journal of Hydraulic Engineering, vol. 128.",
  ],
  en: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill, Chapter 5.",
    "Strickler, A. (1923). Beiträge zur Frage der Geschwindigkeitsformel. Mitteilungen des Eidgenössischen Amtes für Wasserwirtschaft 16.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan, Chapter 4.",
    "Yen, B.C. (2002). Open channel flow resistance. Journal of Hydraulic Engineering, vol. 128.",
  ],
} as const;

const N_MIN = 0.01;
const N_MAX = 0.1;
const R_MIN = 0.05;
const R_MAX = 12;

/** Angka Manning yang digambar sebagai kurva latar. */
const KELUARGA_N = [0.011, 0.014, 0.02, 0.025, 0.03, 0.04, 0.05, 0.07];

export function HukumGesekanClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [n, setN] = useState(0.025);
  const [R, setR] = useState(1);
  const [S, setS] = useState(0.001);

  const C_ = chezyFromManning(n, R);
  const f = darcyFromChezy(C_);
  const V = chezyVelocity(C_, R, S);
  const ks = Math.pow(n * 21.1, 6);
  const rasio = C_ > 0 ? chezyFromManning(n, R * 4) / C_ : 0;
  const jauh = n < N_MIN || n > N_MAX;

  const ref = useCanvas(
    (ctx, w, h) => {
      const deret: ChartSeries[] = KELUARGA_N.map((nk) => {
        const pts: { x: number; y: number }[] = [];
        for (let lg = Math.log10(R_MIN); lg <= Math.log10(R_MAX) + 1e-9; lg += 0.03) {
          const Rk = Math.pow(10, lg);
          pts.push({ x: Rk, y: chezyFromManning(nk, Rk) });
        }
        const dipilih = Math.abs(nk - n) < 1e-9;
        return {
          pts,
          color: dipilih ? C.water : C.ink3,
          weight: dipilih ? W.bold : W.hair,
          label: dipilih ? undefined : fmtPlain(nk, 3),
          labelAt: 1,
          labelDy: -8,
          labelAlign: "right" as CanvasTextAlign,
        };
      });

      // Angka kekasaran yang sedang dipakai tidak selalu ada di keluarga
      // kurva latar, jadi kurvanya digambar tersendiri.
      const terpilih: { x: number; y: number }[] = [];
      for (let lg = Math.log10(R_MIN); lg <= Math.log10(R_MAX) + 1e-9; lg += 0.02) {
        const Rk = Math.pow(10, lg);
        terpilih.push({ x: Rk, y: chezyFromManning(n, Rk) });
      }
      deret.push({
        pts: terpilih,
        color: jauh ? C.signal : C.water,
        weight: W.bold,
        dash: jauh ? DASH.invalid : DASH.solid,
        label: `n ${fmtPlain(n, 3)}`,
        labelAt: 0.34,
        labelDy: -11,
      });

      drawChart(
        ctx,
        w,
        h,
        {
          xMin: R_MIN,
          xMax: R_MAX,
          yMin: 0,
          yMax: 110,
          xLog: true,
          axisX: T.axHydraulicRadius,
          axisY: T.axChezy,
          series: deret,
          point: {
            x: R,
            y: C_,
            label: `C ${fmtPlain(C_, 1)}`,
            invalid: jauh,
          },
          regions: [
            { x: 0.09, y: 100, text: T.manningCurve, color: C.ink3 },
          ],
          padRight: 46,
        },
        lang
      );
    },
    [n, R, S, lang]
  );

  return (
    <LabShell
      sheet="OC-10"
      subject={SUBJECTS.OC[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Tiga hukum yang sering disajikan sebagai pilihan sebenarnya{" "}
            <Term tint={C.water}>satu gesekan yang sama</Term>. Yang berbeda
            hanya besaran mana yang dianggap tetap, dan pilihan itu punya
            akibat yang dapat digambar.
          </p>
        ) : (
          <p>
            Three laws usually offered as a choice are in fact{" "}
            <Term tint={C.water}>one and the same friction</Term>. What differs
            is only which quantity is held constant, and that choice has a
            consequence you can draw.
          </p>
        )
      }
      drawing={
        <Sheet
          number="OC-10"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m/s)" },
            { label: "n", value: fmt(n, 3), tint: jauh ? C.signal : undefined },
            { label: "R", value: `${fmt(R, 2)} m` },
            { label: "C", value: `${fmt(C_, 1)}`, tint: C.water },
            { label: "f", value: fmt(f, 4), tint: C.energy },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="n" label={x.dN} value={n} min={0.005} max={0.15} step={0.001} digits={3} onChange={setN} tint={C.water} />
              <InputRow symbol="R" label={x.dR} value={R} min={0.05} max={12} step={0.05} digits={2} unit="m" onChange={setR} />
              <InputRow symbol="S" label={x.dS} value={S * 1000} min={0.05} max={50} step={0.05} digits={2} unit="‰" onChange={(v) => setS(v / 1000)} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pTanah, apply: () => { setN(0.03); setR(1); setS(0.001); } },
                  { label: x.pBeton, apply: () => { setN(0.014); setR(1.5); setS(0.0005); } },
                  { label: x.pSungai, apply: () => { setN(0.05); setR(0.8); setS(0.01); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={C.water}>{`C ${fmt(C_, 1)}`}</Flag>
              {jauh && <Flag alert>{x.jauh}</Flag>}
            </div>
            {jauh && (
              <div className="mb-2.5">
                <Note>{x.jauhNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "C", label: x.rC, value: fmt(C_, 3), unit: "m^0,5/s", tint: C.water, strong: true },
                { symbol: "f", label: x.rF, value: fmt(f, 5), tint: C.energy, strong: true },
                { symbol: "V", label: x.rV, value: fmt(V, 4), unit: "m/s", tint: C.water },
                /*
                 * Satuannya ikut besarnya, karena kekasaran setara Strickler
                 * berbanding dengan PANGKAT ENAM angka Manning. Angka Manning
                 * 0,15 memberi butiran setara seribu meter, dan menuliskannya
                 * sebagai 1.005.176,4 mm membuat angka yang memang sudah tidak
                 * masuk akal menjadi tidak terbaca pula. Keadaan itu sendiri
                 * sudah ditandai merah di sebelahnya.
                 */
                {
                  symbol: "ks",
                  label: x.rKs,
                  value: ks >= 1 ? fmt(ks, 2) : fmt(ks * 1000, 1),
                  unit: ks >= 1 ? "m" : "mm",
                  tint: C.critical,
                },
                { symbol: "n′", label: x.rNStrickler, value: fmt(stricklerN(ks), 4) },
                { symbol: "—", label: x.rRasio, value: fmt(rasio, 4) },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(n, R, C_, f, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksFrictionLaws(n, R)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>V = C √(R S)</span>
                <span className="ml-6">C =</span>
                <Frac num="R^(1/6)" den="n" />
                <span className="ml-6">C = √</span>
                <Frac num="8 g" den="f" />
              </Eq>
              <Eq>
                <span>n =</span>
                <Frac num="ks^(1/6)" den="21,1" />
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "Strickler, jembatan antara dunia pipa dan saluran"
                    : "Strickler, the bridge between pipes and channels"}
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

function notice(n: number, R: number, C_: number, f: number, lang: Lang): string {
  const cDangkal = chezyFromManning(n, R / 4);
  const fDangkal = darcyFromChezy(cDangkal);
  const naikF = f > 0 ? ((fDangkal - f) / f) * 100 : 0;

  if (lang === "en")
    return `Hold the Manning value fixed and shrink the hydraulic radius to a quarter: the Chezy coefficient falls from ${fmt(C_, 1)} to ${fmt(cDangkal, 1)}, and the Darcy friction factor rises by ${fmt(naikF, 0)} per cent. Nothing about the channel lining changed. That rise is entirely an artefact of holding n constant, and it is the clearest statement of what the choice between these three laws actually costs: whichever quantity you declare constant, the other two must move.`;
  return `Tahan angka Manning-nya lalu perkecil jari-jari hidroliknya menjadi seperempat: koefisien Chezy turun dari ${fmt(C_, 1)} ke ${fmt(cDangkal, 1)}, dan faktor gesekan Darcy naik ${fmt(naikF, 0)} persen. Tidak ada satu pun yang berubah pada lapisan salurannya. Kenaikan itu sepenuhnya akibat menahan n tetap, dan itulah pernyataan paling jelas tentang harga sebenarnya dari memilih di antara ketiga hukum ini: besaran mana pun yang dinyatakan tetap, dua yang lain harus bergerak.`;
}
