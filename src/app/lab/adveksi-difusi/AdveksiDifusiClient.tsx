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
import { drawField, type FieldLine, type FieldMarker } from "@/lib/drawField";
import {
  TRACER_PECLET_MIN,
  advectionDiffusion,
  fmt,
  fmtPlain,
  fmtSci,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksAdvection } from "@/lib/checks";

const WAKTU = [60, 300, 900, 1800];
/** Saat terakhir yang dipakai x̄, σ, dan cmaks, detik. */
const T_AKHIR = WAKTU[WAKTU.length - 1];
/* Sumbu pita Pe 0,02–3·10⁴ memuat penggeser (0,025 pada U 0,05, x 50,
   D 100; 30 000 pada U 3, x 5000, D 0,5). */
const PE_MIN = 0.02;
const PE_MAX = 3e4;
/** Jarak titik amat terjauh pada penggeser, meter. */
const X_MAKS = 5000;

/** Kepekatan kecil ditulis bentuk pangkat; fmt(…, 4) dulu menulis 0,0000. */
const angkaC = (c: number, d: number) => (c > 0 && c < 1e-3 ? fmtSci(c) : fmt(c, d));

const TXT = {
  id: {
    title: "Adveksi dan difusi",
    sheetTitle: "Awan zat terlarut pada empat saat sesudah dilepas",
    dM: "Massa yang dilepas",
    dA: "Luas penampang sungai",
    dU: "Kecepatan rata-rata",
    dD: "Koefisien penyebaran memanjang",
    dX: "Jarak titik amat dari tempat lepasnya",
    pArus: "Arus kuat, awannya terbawa utuh",
    pSebar: "Penyebaran kuat, awannya melebar cepat",
    pLambat: "Arus lambat, keduanya seimbang",
    rPusat: "Letak pusat awan pada saat terakhir",
    rSigma: "Simpangan baku awan pada saat terakhir",
    rPuncak: "Kepekatan puncak pada saat terakhir",
    rPe: "Bilangan Peclet pada jarak titik amat",
    bSebar: "Penyebaran berkuasa",
    bSebanding: "Sebanding",
    bAdveksi: "Adveksi berkuasa",
    tpTak: "Waktu lewat tidak dihitung: awan berubah bentuk saat melintas",
    hTt: "Waktu tempuh sampai titik amat",
    hSigma: "Simpangan baku dan letak pusat pada 30 menit",
    hC: "Kepekatan puncak pada 30 menit",
    hPe: "Bilangan Peclet di titik amat",
    hTp: "Waktu lewat, hampiran awan beku",
    tpTakNote: `Waktu lewat 4σ/U menganggap awannya hampir tidak berubah selama melintasi titik amat (hampiran awan beku). Itu wajar bila adveksi berkuasa, Pe ≥ ${TRACER_PECLET_MIN}. Di sini awannya masih melebar banyak saat lewat, jadi tp tidak ditulis.`,
    rLebar: "Panjang awan yang memuat 95 persen massanya",
    rTempuh: "Waktu tempuh sampai titik amat",
    rLewat: "Selisih waktu datang tepi depan dan tepi belakang",
    adveksi: "Adveksi berkuasa, awannya terbawa utuh",
    difusi: "Penyebaran berkuasa, awannya melebar lebih cepat daripada terbawa",
    seimbang: "Keduanya sebanding, awannya terbawa sambil melebar",
    note:
      "Dua hal terjadi bersamaan pada zat yang tumpah ke sungai, dan keduanya menuntut jawaban yang berbeda. Adveksi memindahkan awan itu ke hilir tanpa mengubah bentuknya, dan yang ditentukannya adalah kapan zat itu tiba. Penyebaran melebarkan awannya tanpa memindahkan pusatnya, dan yang ditentukannya adalah seberapa pekat zat itu saat tiba dan berapa lama ia lewat. Bilangan Peclet menimbang keduanya, dan pada sungai ia hampir selalu besar, artinya awannya memang terbawa jauh lebih cepat daripada ia melebar. Tiga akibat yang langsung berguna. Pertama, waktu tiba dapat diperkirakan dari kecepatan arus saja, dan perkiraan itu cukup teliti untuk memerintahkan penutupan intake air minum di hilir. Kedua, kepekatan puncaknya turun seperti akar waktu dan bukan seperti waktu, jadi tumpahan yang sudah menempuh empat kali jarak hanya berkurang dua kali kepekatannya. Ketiga, lebar awannya tumbuh seperti akar waktu juga, sehingga tumpahan yang melewati satu titik dalam lima menit pada kilometer pertama akan lewat selama dua puluh menit pada kilometer keenam belas. Yang terakhir itu penting justru bagi yang menunggu di hilir: bukan hanya kapan zatnya datang, tetapi berapa lama ia harus ditunggu sampai habis.",
  },
  en: {
    title: "Advection and diffusion",
    sheetTitle: "A solute cloud at four instants after release",
    dM: "Mass released",
    dA: "River cross-sectional area",
    dU: "Mean velocity",
    dD: "Longitudinal dispersion coefficient",
    dX: "Distance of the observation point from the release",
    pArus: "Strong current, the cloud is carried whole",
    pSebar: "Strong dispersion, the cloud widens fast",
    pLambat: "Slow current, the two are balanced",
    rPusat: "Position of the cloud centre at the last instant",
    rSigma: "Standard deviation of the cloud at the last instant",
    rPuncak: "Peak concentration at the last instant",
    rPe: "Peclet number at the observation point",
    bSebar: "Dispersion dominates",
    bSebanding: "Comparable",
    bAdveksi: "Advection dominates",
    tpTak: "Passage time not computed: the cloud changes shape as it passes",
    hTt: "Travel time to the observation point",
    hSigma: "Standard deviation and centre position at 30 minutes",
    hC: "Peak concentration at 30 minutes",
    hPe: "Peclet number at the observation point",
    hTp: "Passage time, frozen-cloud approximation",
    tpTakNote: `The passage time 4σ/U assumes the cloud barely changes while it crosses the observation point (the frozen-cloud approximation). That is reasonable when advection dominates, Pe ≥ ${TRACER_PECLET_MIN}. Here the cloud is still widening a lot as it passes, so tp is not written.`,
    rLebar: "Length of cloud holding 95 per cent of its mass",
    rTempuh: "Travel time to the observation point",
    rLewat: "Time between the arrival of the leading and trailing edges",
    adveksi: "Advection rules, the cloud is carried whole",
    difusi: "Dispersion rules, the cloud widens faster than it is carried",
    seimbang: "The two are comparable, the cloud widens as it is carried",
    note:
      "Two things happen at once to a substance spilled into a river, and each demands a different answer. Advection moves the cloud downstream without changing its shape, and what it decides is when the substance arrives. Dispersion widens the cloud without moving its centre, and what it decides is how concentrated the substance is on arrival and how long it takes to pass. The Peclet number weighs the two, and in a river it is almost always large, meaning the cloud is indeed carried far faster than it widens. Three consequences are immediately useful. First, the arrival time can be estimated from the current alone, and that estimate is accurate enough to order a downstream drinking-water intake closed. Second, the peak concentration falls as the square root of time rather than as time, so a spill that has travelled four times as far is only twice as dilute. Third, the cloud length grows as the square root of time too, so a spill that passes a point in five minutes at the first kilometre will take twenty minutes to pass at the sixteenth. That last point matters most to whoever waits downstream: not only when the substance arrives, but how long it must be waited out.",
  },
} as const;

const REFS = {
  id: [
    "Taylor, G.I. (1954). The dispersion of matter in turbulent flow through a pipe. Proc. R. Soc. A 223, 446–468.",
    "Elder, J.W. (1959). The dispersion of marked fluid in turbulent shear flow. J. Fluid Mech. 5, 544–560.",
    "Fischer, H.B. dkk. (1979). Mixing in Inland and Coastal Waters.",
    "Rutherford, J.C. (1994). River Mixing.",
  ],
  en: [
    "Taylor, G.I. (1954). The dispersion of matter in turbulent flow through a pipe. Proc. R. Soc. A 223, 446–468.",
    "Elder, J.W. (1959). The dispersion of marked fluid in turbulent shear flow. J. Fluid Mech. 5, 544–560.",
    "Fischer, H.B. et al. (1979). Mixing in Inland and Coastal Waters.",
    "Rutherford, J.C. (1994). River Mixing.",
  ],
} as const;

export function AdveksiDifusiClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [massa, setMassa] = useState(50);
  const [luas, setLuas] = useState(12);
  const [U, setU] = useState(0.4);
  const [D, setD] = useState(5);
  const [titik, setTitik] = useState(800);

  const r = advectionDiffusion(massa, luas, U, D, titik, WAKTU);
  /*
   * Hampiran awan beku (tp = 4σ/U) hanya wajar bila adveksi berkuasa.
   * Model belum punya field-nya (perbaikan model 6 di spesifikasi B5), jadi
   * ambangnya dibaca dari tetapan yang sama dengan lembar pelacak.
   */
  const beku = r.peclet >= TRACER_PECLET_MIN;
  const tp = beku ? r.passageTime : NaN;
  const nada: Tone = r.advectionDominated ? "water" : r.balanced ? "neutral" : "caution";
  const warnaKeadaan = r.advectionDominated ? C.water : r.balanced ? C.ink2 : C.caution;
  const keadaan = r.advectionDominated
    ? x.adveksi
    : r.balanced
      ? x.seimbang
      : x.difusi;

  const ref = useCanvas(
    (ctx, w, ch) => {
      const warna = [C.ink3, C.critical, C.energy, C.water];
      /*
       * Nama tiap saat ditaruh di PUNCAK awannya sendiri. Dengan letak tetap
       * di tengah deret titiknya, nama awan yang masih rapat di dekat titik
       * lepas jatuh di ekornya yang datar di dasar gambar, lalu terdesak
       * keluar bingkai dan menimpa angka sumbu ("6(1 MIN").
       */
      const garis: FieldLine[] = r.snapshots.map((s, i) => {
        let iPuncak = 0;
        s.profile.forEach((p, j) => {
          if (p.c > s.profile[iPuncak].c) iPuncak = j;
        });
        return {
          pts: s.profile.map((p) => ({ x: p.x, y: p.c })),
          color: warna[i % warna.length],
          weight: i === r.snapshots.length - 1 ? W.bold : W.thin,
          dash: i === r.snapshots.length - 1 ? DASH.solid : DASH.hidden,
          label: `${fmtPlain(s.t / 60, 0)} min`,
          labelAt: s.profile.length > 1 ? iPuncak / (s.profile.length - 1) : 0.5,
          labelDy: -10,
          labelAlign: "center",
        } satisfies FieldLine;
      });

      /* Titik amatnya, sebagai garis tegak pada jarak yang dipilih. */
      const puncakSemua = Math.max(
        ...r.snapshots.flatMap((s) => s.profile.map((p) => p.c)),
        1e-12
      );
      garis.push({
        pts: [
          { x: titik, y: 0 },
          { x: titik, y: puncakSemua },
        ],
        color: C.ink2,
        weight: W.hair,
        dash: DASH.axis,
      });

      const tanda: FieldMarker[] = [
        { x: r.centre, y: r.peak, color: C.water, size: 5, filled: true },
      ];

      const xs = r.snapshots.flatMap((s) => s.profile.map((p) => p.x));

      drawField(
        ctx,
        w,
        ch,
        {
          xMin: Math.min(...xs, 0),
          xMax: Math.max(...xs, titik * 1.05),
          yMin: 0,
          /* Ruang di atas untuk judul keadaan dan nama awan 1 menit, yang
             puncaknya paling tinggi. Nama "awan zat terlarut" dihapus: tiap
             awan sudah bernama saatnya sendiri, dan tulisan itu dulu
             berebut tempat dengan judul dan nama 1 menit. */
          yMax: puncakSemua * 1.45,
          equalScale: false,
          lines: garis,
          markers: tanda,
          heading: keadaan,
          headingColor: warnaKeadaan,
          axisX: T.axXMetre,
          axisY: T.axConcentration,
        },
        lang
      );
    },
    [massa, luas, U, D, titik, lang]
  );

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="Pe"
          value={r.peclet}
          scale="log"
          digits={2}
          bands={[
            { from: PE_MIN, to: 1, label: x.bSebar, tone: "caution" },
            { from: 1, to: TRACER_PECLET_MIN, label: x.bSebanding, tone: "neutral" },
            { from: TRACER_PECLET_MIN, to: PE_MAX, label: x.bAdveksi, tone: "water" },
          ]}
        />
      }
      sheet="FP-04"
      subject={SUBJECTS.FP[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            <Term tint={C.water}>Adveksi</Term> menentukan kapan zatnya tiba;{" "}
            <Term tint={C.critical}>penyebaran</Term> menentukan seberapa pekat
            saat tiba dan berapa lama ia lewat.
          </p>
        ) : (
          <p>
            <Term tint={C.water}>Advection</Term> decides when the substance
            arrives; <Term tint={C.critical}>dispersion</Term> decides how
            concentrated it is on arrival and how long it takes to pass.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FP-04"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (kg, m, s)" },
            { label: "Pe", value: fmtSci(r.peclet), tint: warnaKeadaan },
            { label: "cmax", value: `${angkaC(r.peak, 4)} kg/m³` },
            { label: "σ", value: `${fmt(r.sigma, 1)} m` },
            { label: "tp", value: beku ? `${fmt(tp / 60, 1)} min` : "—" },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="M" label={x.dM} value={massa} min={1} max={500} step={1} digits={0} unit="kg" onChange={setMassa} />
              <InputRow symbol="A" label={x.dA} value={luas} min={1} max={100} step={1} digits={0} unit="m²" onChange={setLuas} />
              <InputRow symbol="U" label={x.dU} value={U} min={0.05} max={3} step={0.05} digits={2} unit="m/s" onChange={setU} tint={C.water} />
              <InputRow symbol="D" label={x.dD} value={D} min={0.5} max={100} step={0.5} digits={1} unit="m²/s" onChange={setD} tint={C.critical} />
              <InputRow symbol="x" label={x.dX} value={titik} min={50} max={5000} step={50} digits={0} unit="m" onChange={setTitik} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pArus, apply: () => { setMassa(50); setLuas(12); setU(1.5); setD(2); setTitik(800); } },
                  { label: x.pSebar, apply: () => { setMassa(50); setLuas(12); setU(0.05); setD(80); setTitik(800); } },
                  { label: x.pLambat, apply: () => { setMassa(50); setLuas(12); setU(0.05); setD(5); setTitik(800); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            {/* Angka besar: jawaban di titik amat (tt, tp) dan cmaks. x̄ dan σ
                saat 30 menit tidak bergantung pada titik amat. */}
            <ResultTable
              rows={[
                { symbol: "tt", label: x.rTempuh, value: fmt(r.travelTime / 60, 2), unit: "min", tint: C.water, strong: true },
                { symbol: "tp", label: x.rLewat, value: fmt(tp / 60, 2), unit: beku ? "min" : undefined, strong: true },
                { symbol: "cmax", label: x.rPuncak, value: angkaC(r.peak, 5), unit: "kg/m³", strong: true },
                { symbol: "x̄", label: x.rPusat, value: fmt(r.centre, 1), unit: "m", tint: C.water },
                { symbol: "σ", label: x.rSigma, value: fmt(r.sigma, 2), unit: "m", tint: C.critical },
                { symbol: "Pe", label: x.rPe, value: fmtSci(r.peclet) },
                { symbol: "Lc", label: x.rLebar, value: fmt(r.cloudLength, 1), unit: "m" },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hTt,
                    rumus: (<><span>tt =</span><Frac num="x" den="U" /></>),
                    isi: `${fmt(titik, 0)} / ${fmt(U, 2)} / 60`,
                    hasil: fmt(r.travelTime / 60, 2),
                    satuan: "min",
                    tint: C.water,
                  },
                  {
                    judul: x.hSigma,
                    rumus: (<><span>σ = √( 2 D t ),</span><span className="ml-2">x̄ = U t</span></>),
                    isi: `√( 2 · ${fmt(D, 1)} · ${fmt(T_AKHIR, 0)} ) = ${fmt(r.sigma, 2)} m;  ${fmt(U, 2)} · ${fmt(T_AKHIR, 0)} = ${fmt(r.centre, 1)} m`,
                    hasil: fmt(r.sigma, 2),
                    satuan: "m",
                    tint: C.critical,
                  },
                  {
                    judul: x.hC,
                    rumus: (<><span>cmax =</span><Frac num="M" den="A σ √(2π)" /></>),
                    isi: `${fmt(massa, 0)} / ( ${fmt(luas, 0)} · ${fmt(r.sigma, 3)} · √(2π) )`,
                    hasil: angkaC(r.peak, 5),
                    satuan: "kg/m³",
                  },
                  {
                    judul: x.hPe,
                    rumus: (<><span>Pe =</span><Frac num="U x" den="D" /></>),
                    isi: `${fmt(U, 2)} · ${fmt(titik, 0)} / ${fmt(D, 1)}`,
                    hasil: fmtSci(r.peclet),
                  },
                  {
                    judul: beku ? x.hTp : x.tpTak,
                    rumus: (<><span>tp =</span><Frac num="4 √( 2 D tt )" den="U" /></>),
                    isi: beku ? `4 · √( 2 · ${fmt(D, 1)} · ${fmt(r.travelTime, 0)} ) / ${fmt(U, 2)} / 60` : "—",
                    hasil: fmt(tp / 60, 2),
                    satuan: beku ? "min" : undefined,
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard tone={nada} badge={keadaan} {...notice(massa, luas, U, D, titik, lang)} />
        </>
      }
      verification={
        <Verification checks={checksAdvection(massa, luas, U, D, titik)} />
      }
      below={
        <Basis
          equations={
            <>
              <Eq>
                <Frac num="∂c" den="∂t" />
                <span>+ U</span>
                <Frac num="∂c" den="∂x" />
                <span>= D</span>
                <Frac num="∂²c" den="∂x²" />
              </Eq>
              <Eq>
                <span>c(x,t) =</span>
                <Frac num="M" den="A √(4πDt)" />
                <span>exp</span>
                <span>(−(x − Ut)² / 4Dt)</span>
              </Eq>
              <Eq>
                <span>Pe =</span>
                <Frac num="U x" den="D" />
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "σ tumbuh seperti akar waktu, jadi puncaknya turun seperti akar waktu juga"
                    : "σ grows as the square root of time, so the peak falls as its square root too"}
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

/*
 * Isi kalimatnya sama dengan catatan lama; kalimat pertama menyatakan
 * keadaan, sisanya butir. Butir "pindah titik 4×" hanya bila 4x masih di
 * penggeser (≤ 5 000 m) dan waktu lewat berlaku di kedua titik.
 */
function notice(
  massa: number,
  luas: number,
  U: number,
  D: number,
  titik: number,
  lang: Lang
): { state: string; notice: string[] } {
  const x = TXT[lang];
  const a = advectionDiffusion(massa, luas, U, D, titik, WAKTU);
  const beku = a.peclet >= TRACER_PECLET_MIN;
  const keadaan = a.advectionDominated ? x.adveksi : a.balanced ? x.seimbang : x.difusi;
  const x4 = titik * 4;
  const jauh = advectionDiffusion(massa, luas, U, D, x4, WAKTU);
  const bisa4 = x4 <= X_MAKS && beku;

  if (lang === "en")
    return {
      state: beku
        ? `Pe = ${fmt(a.peclet, 1)} at the observation point: ${keadaan.toLowerCase()}; arrives after ${fmt(a.travelTime / 60, 1)} minutes, passes in ${fmt(a.passageTime / 60, 1)} minutes.`
        : `Pe = ${fmt(a.peclet, 2)} at the observation point: ${keadaan.toLowerCase()}; arrives after ${fmt(a.travelTime / 60, 1)} minutes.`,
      notice: [
        beku ? "" : x.tpTakNote,
        bisa4
          ? `Move the point four times farther out, to ${fmt(x4, 0)} m: the travel time grows fourfold to ${fmt(jauh.travelTime / 60, 1)} minutes, but the passage time only doubles, to ${fmt(jauh.passageTime / 60, 1)}, because the width follows the square root of time. That asymmetry is the whole of the practical difference between the two processes: one is proportional to distance and the other to its square root.`
          : "",
      ],
    };
  return {
    state: beku
      ? `Pe = ${fmt(a.peclet, 1)} di titik amat: ${keadaan.toLowerCase()}; tiba ${fmt(a.travelTime / 60, 1)} menit, lewat ${fmt(a.passageTime / 60, 1)} menit.`
      : `Pe = ${fmt(a.peclet, 2)} di titik amat: ${keadaan.toLowerCase()}; tiba ${fmt(a.travelTime / 60, 1)} menit.`,
    notice: [
      beku ? "" : x.tpTakNote,
      bisa4
        ? `Pindahkan titik amatnya empat kali lebih jauh, ke ${fmt(x4, 0)} m: waktu tempuhnya berlipat empat menjadi ${fmt(jauh.travelTime / 60, 1)} menit, tetapi waktu lewatnya hanya berlipat dua, menjadi ${fmt(jauh.passageTime / 60, 1)}, karena lebarnya mengikuti akar waktu. Ketimpangan itulah seluruh beda praktis kedua proses ini: yang satu sebanding dengan jarak, yang lain sebanding dengan akarnya.`
        : "",
    ],
  };
}
