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
  G,
  chezyFromManning,
  chezyVelocity,
  darcyFromChezy,
  fmt,
  fmtPlain,
  stricklerN,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
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
    jauh: "Di bawah rentang lazim",
    jauhNote:
      "Angka Manning di bawah 0,010 hampir tidak pernah ditemui pada saluran nyata; itu lebih halus daripada kaca. Rumusnya tetap memberi angka karena ia memang tidak punya batas di dalam dirinya, tetapi angka itu tidak berdiri di atas pengukuran mana pun.",
    lazim: "Rentang lazim",
    banjir: "Dataran banjir berpohon atau bersemak",
    banjirNote:
      "Angka Manning 0,10 sampai 0,15 lazim untuk dataran banjir dengan tegakan pohon rapat atau semak dedalu (Chow 1959, Tabel 5-6). Pada kekasaran ini hambatannya datang dari batang dan dahan, bukan dari butiran dasar, jadi kekasaran butir setara Strickler di tabel tidak lagi bermakna ukuran butir.",
    state: (n: string, R: string, C: string, f: string) =>
      `Dengan n = ${n} dan R = ${R} m, koefisien Chezy C = ${C} m^½/s dan faktor gesekan Darcy f = ${f}.`,
    hKs: "Kekasaran butir setara, Strickler dibalik",
    hRasio: "Kenaikan C bila R dilipatempatkan, selalu 4^(1/6) apa pun n dan R",
    legenda: "Kurva pada grafik",
    legendaBantu: "Klik nama kurva untuk menyembunyikan atau menampilkannya.",
    kurvaDipakai: (n: string) => `n ${n} (dipakai)`,
    kurvaKeluarga: (n: string) => `n ${n}`,
    samaDipakai: "Sama dengan kurva yang sedang dipakai",
    tampilSemua: "Tampilkan semua",
    tersembunyi: (k: number) => `${k} kurva disembunyikan`,
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
    jauh: "Below the common range",
    jauhNote:
      "Manning values below 0.010 are almost never met on real channels; that is smoother than glass. The formula still returns a number, because it carries no limit within itself, but that number rests on no measurement.",
    lazim: "Common range",
    banjir: "Floodplain with trees or brush",
    banjirNote:
      "Manning values of 0.10 to 0.15 are common for floodplains with dense stands of trees or willow brush (Chow 1959, Table 5-6). At this roughness the resistance comes from trunks and branches rather than bed grains, so the Strickler equivalent grain roughness in the table no longer means a grain size.",
    state: (n: string, R: string, C: string, f: string) =>
      `With n = ${n} and R = ${R} m, the Chezy coefficient is C = ${C} m^½/s and the Darcy friction factor f = ${f}.`,
    hKs: "Equivalent grain roughness, Strickler inverted",
    hRasio: "Rise in C when R is quadrupled, always 4^(1/6) whatever n and R",
    legenda: "Curves on the chart",
    legendaBantu: "Click a curve name to hide or show it.",
    kurvaDipakai: (n: string) => `n ${n} (in use)`,
    kurvaKeluarga: (n: string) => `n ${n}`,
    samaDipakai: "Same as the curve in use",
    tampilSemua: "Show all",
    tersembunyi: (k: number) => `${k} curves hidden`,
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
  /* Legenda yang bisa diklik: kurva keluarga disimpan menurut angka
     Manning-nya (bukan teks label, yang ikut berganti koma/titik saat
     bahasa diganti), kurva yang dipakai dengan saklar sendiri. */
  const [sembunyiN, setSembunyiN] = useState<ReadonlySet<number>>(() => new Set());
  const [sembunyiDipakai, setSembunyiDipakai] = useState(false);
  const balikKeluarga = (nk: number) =>
    setSembunyiN((lama) => {
      const baru = new Set(lama);
      if (baru.has(nk)) baru.delete(nk);
      else baru.add(nk);
      return baru;
    });
  const jumlahSembunyi =
    KELUARGA_N.filter((nk) => sembunyiN.has(nk) && Math.abs(nk - n) >= 1e-9).length +
    (sembunyiDipakai ? 1 : 0);

  const C_ = chezyFromManning(n, R);
  const f = darcyFromChezy(C_);
  const V = chezyVelocity(C_, R, S);
  const ks = Math.pow(n * 21.1, 6);
  const rasio = C_ > 0 ? chezyFromManning(n, R * 4) / C_ : 0;
  /* Hanya sisi bawah yang di luar rentang berlaku. n 0,10 sampai 0,15
     memang ada di Chow (1959) Tabel 5-6 (tegakan pohon rapat 0,100/0,120/
     0,160, semak dedalu 0,110/0,150/0,200), jadi bukan keadaan invalid. */
  const jauh = n < N_MIN;
  const banjir = n > N_MAX;
  const nada: Tone = jauh ? "invalid" : "neutral";
  const nStr = stricklerN(ks);
  const ksTampil = ks >= 1 ? fmt(ks, 2) : fmt(ks * 1000, 1);
  const ksSatuan = ks >= 1 ? "m" : "mm";

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

      /* Kunci `hidden` = label deret seperti yang digambar. Kurva keluarga
         yang sama dengan n terpilih tidak berlabel dan memang tertutup kurva
         terpilih, jadi tidak ikut disembunyikan dari legenda. */
      const hidden = new Set<string>();
      for (const nk of KELUARGA_N) if (sembunyiN.has(nk)) hidden.add(fmtPlain(nk, 3));
      if (sembunyiDipakai) hidden.add(`n ${fmtPlain(n, 3)}`);

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
          hidden,
        },
        lang
      );
    },
    [n, R, S, lang, sembunyiN, sembunyiDipakai]
  );

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="n"
          value={n}
          invalid={jauh}
          scale="log"
          digits={3}
          bands={[
            { from: 0.005, to: N_MIN, label: x.jauh, tone: "invalid" },
            { from: N_MIN, to: N_MAX, label: x.lazim, tone: "neutral" },
            { from: N_MAX, to: 0.15, label: x.banjir, tone: "neutral" },
          ]}
        />
      }
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
        <>
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
        <Legenda
          judul={x.legenda}
          bantu={x.legendaBantu}
          tampilSemua={x.tampilSemua}
          ringkas={jumlahSembunyi > 0 ? x.tersembunyi(jumlahSembunyi) : null}
          onTampilSemua={() => {
            setSembunyiN(new Set());
            setSembunyiDipakai(false);
          }}
          item={[
            {
              kunci: "dipakai",
              teks: x.kurvaDipakai(fmt(n, 3)),
              warna: jauh ? C.signal : C.water,
              tebal: W.bold,
              dash: jauh ? DASH.invalid : DASH.solid,
              tampil: !sembunyiDipakai,
              onToggle: () => setSembunyiDipakai((v) => !v),
            },
            ...KELUARGA_N.map((nk) => {
              const sama = Math.abs(nk - n) < 1e-9;
              return {
                kunci: String(nk),
                teks: x.kurvaKeluarga(fmt(nk, 3)),
                warna: C.ink3,
                tebal: W.hair,
                dash: DASH.solid,
                tampil: sama || !sembunyiN.has(nk),
                nonaktif: sama ? x.samaDipakai : undefined,
                onToggle: () => balikKeluarga(nk),
              };
            }),
          ]}
        />
        </>
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
            <ResultTable
              rows={[
                { symbol: "C", label: x.rC, value: fmt(C_, 3), unit: "m^½/s", tint: C.water, strong: true },
                { symbol: "f", label: x.rF, value: fmt(f, 5), tint: C.energy, strong: true },
                { symbol: "V", label: x.rV, value: fmt(V, 4), unit: "m/s", tint: C.water },
                /*
                 * Satuannya ikut besarnya, karena kekasaran setara Strickler
                 * berbanding dengan PANGKAT ENAM angka Manning. Angka Manning
                 * 0,15 memberi butiran setara seribu meter, dan menuliskannya
                 * sebagai 1.005.176,4 mm membuat angka yang memang sudah tidak
                 * bermakna butir menjadi tidak terbaca pula. Kartu keadaan
                 * menjelaskan bahwa di atas n 0,10 hambatannya dari vegetasi.
                 */
                {
                  symbol: "ks",
                  label: x.rKs,
                  value: ksTampil,
                  unit: ksSatuan,
                  tint: C.critical,
                },
                { symbol: "n′", label: x.rNStrickler, value: fmt(nStr, 4) },
                { symbol: "—", label: x.rRasio, value: fmt(rasio, 4) },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.rC,
                    rumus: (<><span>C =</span><Frac num="R^(1/6)" den="n" /></>),
                    isi: `${fmt(R, 2)}^(1/6) / ${fmt(n, 3)}`,
                    hasil: fmt(C_, 3),
                    satuan: "m^½/s",
                    tint: C.water,
                  },
                  {
                    judul: x.rF,
                    rumus: (<><span>f =</span><Frac num="8 · g" den="C²" /></>),
                    isi: `8 · ${fmt(G, 2)} / ${fmt(C_, 4)}²`,
                    hasil: fmt(f, 5),
                    tint: C.energy,
                  },
                  {
                    judul: x.rV,
                    rumus: <span>V = C · √( R · S )</span>,
                    isi: `${fmt(C_, 4)} · √( ${fmt(R, 2)} · ${fmt(S, 5)} )`,
                    hasil: fmt(V, 4),
                    satuan: "m/s",
                    tint: C.water,
                  },
                  {
                    judul: x.hKs,
                    rumus: <span>ks = ( {fmt(21.1, 1)} · n )⁶</span>,
                    isi: `( ${fmt(21.1, 1)} · ${fmt(n, 3)} )⁶`,
                    hasil: ksTampil,
                    satuan: ksSatuan,
                    tint: C.critical,
                  },
                  {
                    judul: x.rNStrickler,
                    rumus: (<><span>n′ =</span><Frac num="ks^(1/6)" den={fmt(21.1, 1)} /></>),
                    isi: `${fmt(ks, 5)}^(1/6) / ${fmt(21.1, 1)}`,
                    hasil: fmt(nStr, 4),
                  },
                  {
                    judul: x.hRasio,
                    rumus: (<><Frac num="C(4R)" den="C(R)" /><span>=</span><Frac num="( 4R )^(1/6) / n" den="R^(1/6) / n" /><span>= 4^(1/6)</span></>),
                    isi: `4^(1/6) = ${fmt(Math.pow(4, 1 / 6), 4)}`,
                    hasil: fmt(rasio, 4),
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={nada}
            badge={jauh ? x.jauh : banjir ? x.banjir : x.lazim}
            state={x.state(fmt(n, 3), fmt(R, 2), fmt(C_, 1), fmt(f, 4))}
            notice={[
              ...notice(n, R, C_, f, lang),
              ...(jauh ? [x.jauhNote] : banjir ? [x.banjirNote] : []),
            ]}
          />
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

function notice(n: number, R: number, C_: number, f: number, lang: Lang): string[] {
  const cDangkal = chezyFromManning(n, R / 4);
  const fDangkal = darcyFromChezy(cDangkal);
  const naikF = f > 0 ? ((fDangkal - f) / f) * 100 : 0;

  if (lang === "en")
    return [
      `Hold the Manning value fixed and shrink the hydraulic radius to a quarter: the Chezy coefficient falls from ${fmt(C_, 1)} to ${fmt(cDangkal, 1)}, and the Darcy friction factor rises by ${fmt(naikF, 0)} per cent.`,
      "Nothing about the channel lining changed. That rise is entirely an artefact of holding n constant: whichever quantity you declare constant, the other two must move.",
    ];
  return [
    `Tahan angka Manning-nya lalu perkecil jari-jari hidroliknya menjadi seperempat: koefisien Chezy turun dari ${fmt(C_, 1)} ke ${fmt(cDangkal, 1)}, dan faktor gesekan Darcy naik ${fmt(naikF, 0)} persen.`,
    "Tidak ada satu pun yang berubah pada lapisan salurannya. Kenaikan itu sepenuhnya akibat menahan n tetap: besaran mana pun yang dinyatakan tetap, dua yang lain harus bergerak.",
  ];
}

type ItemLegenda = {
  kunci: string;
  teks: string;
  warna: string;
  tebal: number;
  dash: readonly number[];
  tampil: boolean;
  /** Bila terisi, tombolnya tidak bisa dipakai dan teks ini jadi keterangannya */
  nonaktif?: string;
  onToggle: () => void;
};

/**
 * Legenda yang bisa diklik di bawah gambar. Tiap nama kurva adalah tombol
 * aria-pressed (ditekan = kurvanya tampil), jadi bisa dipakai dengan Tab
 * dan Enter/Spasi. Contoh garisnya memakai warna, bobot, dan jenis garis
 * yang sama dengan kurva di grafik; yang disembunyikan dicoret dan pudar.
 */
function Legenda({
  judul,
  bantu,
  tampilSemua,
  ringkas,
  onTampilSemua,
  item,
}: {
  judul: string;
  bantu: string;
  tampilSemua: string;
  ringkas: string | null;
  onTampilSemua: () => void;
  item: ItemLegenda[];
}) {
  return (
    <div className="mt-2.5" role="group" aria-label={judul}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="stencil">{judul}</span>
        <span className="text-[0.78rem] text-ink-3">{bantu}</span>
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-4">
        {item.map((it) => (
          <li key={it.kunci}>
            <button
              type="button"
              aria-pressed={it.tampil}
              disabled={!!it.nonaktif}
              title={it.nonaktif}
              onClick={it.onToggle}
              className="group flex h-11 items-center gap-1.5 outline-none disabled:cursor-default"
            >
              <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden="true" className={it.tampil ? "" : "opacity-30"}>
                <line
                  x1="1"
                  y1="4"
                  x2="21"
                  y2="4"
                  stroke={it.warna}
                  strokeWidth={Math.max(it.tebal, 0.75)}
                  strokeDasharray={it.dash.length ? it.dash.join(" ") : undefined}
                />
              </svg>
              <span
                className={`label pb-px text-[0.8rem] transition-colors group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-water ${
                  it.nonaktif
                    ? "text-ink-3"
                    : it.tampil
                      ? "border-b border-rule-strong text-ink group-hover:border-ink"
                      : "border-b border-rule text-ink-3 line-through group-hover:text-ink-2"
                }`}
              >
                {it.teks}
              </span>
            </button>
          </li>
        ))}
        {ringkas && (
          <li className="flex h-11 items-center gap-2">
            <span className="text-[0.78rem] text-ink-3">{ringkas}</span>
            <button
              type="button"
              onClick={onTampilSemua}
              className="label border-b border-rule-strong pb-px text-[0.8rem] text-ink-2 outline-none transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-water"
            >
              {tampilSemua}
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
