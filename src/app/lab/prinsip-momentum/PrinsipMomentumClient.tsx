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
  bendGeometry,
  bendPlan,
  drawStructure,
  type StructureLine,
  type StructureVector,
} from "@/lib/drawStructure";
import { fmt, fmtPlain, momentumForce } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksMomentum } from "@/lib/checks";

const TXT = {
  id: {
    title: "Prinsip momentum",
    sheetTitle: "Volume kendali pada belokan pipa, dilihat dari atas",
    dQ: "Debit",
    dD1: "Garis tengah penampang masuk",
    dD2: "Garis tengah penampang keluar",
    dH: "Tinggi tekan di penampang masuk",
    dSudut: "Sudut belokan",
    pSiku: "Belokan siku",
    pBalik: "Belokan berbalik arah",
    pKecil: "Pipa tanpa tekanan, hanya momentum",
    rV1: "Kecepatan masuk",
    rV2: "Kecepatan keluar",
    rP1: "Gaya tekanan di penampang masuk",
    rP2: "Gaya tekanan di penampang keluar",
    rM1: "Laju aliran momentum masuk",
    rM2: "Laju aliran momentum keluar",
    rFx: "Gaya tumpuan searah aliran masuk",
    rFy: "Gaya tumpuan tegak lurus aliran masuk",
    rR: "Resultan gaya tumpuan",
    rArah: "Arah resultan terhadap aliran masuk",
    rBagi: "Bagian resultan yang berasal dari tekanan",
    tekananKuasa: "Tekanan yang menentukan",
    momentumKuasa: "Momentum yang menentukan",
    labelCV: "volume kendali",
    labelMasuk: "p₁A₁ + ρQV₁",
    labelKeluar: "p₂A₂ + ρQV₂",
    labelGaya: "gaya tumpuan",
    note:
      "Kekuatan prinsip momentum terletak pada apa yang tidak ditanyakannya. Ia tidak menanyakan bentuk belokannya, kekasaran dindingnya, pusaran yang terjadi di sudutnya, atau berapa energi yang hilang di dalamnya. Yang ditanyakannya hanya apa yang masuk menembus batas dan apa yang keluar menembus batas, dan selisih keduanya adalah gaya. Itu sebabnya prinsip ini masih menjawab pada persoalan yang persamaan energinya sama sekali tidak dapat dipakai, misalnya loncatan air, yang kehilangan energinya justru menjadi pertanyaan, bukan jawaban. Dua hal yang perlu diingat saat memakainya. Pertama, ia persamaan vektor, bukan skalar, jadi arahnya ikut diperhitungkan dan belokan seratus delapan puluh derajat menuntut dua kali gaya belokan sembilan puluh derajat. Kedua, pada pipa bertekanan suku tekanan hampir selalu jauh lebih besar daripada suku momentum, sering tiga puluh kali lipat, sehingga angkur belokan sebenarnya ditentukan oleh tekanan ujinya, bukan oleh alirannya. Pipa yang diuji bertekanan sementara airnya diam tetap menuntut angkur yang hampir sama besarnya.",
  },
  en: {
    title: "Momentum principle",
    sheetTitle: "A control volume at a pipe bend, seen from above",
    dQ: "Discharge",
    dD1: "Inlet diameter",
    dD2: "Outlet diameter",
    dH: "Pressure head at the inlet",
    dSudut: "Bend angle",
    pSiku: "Right-angle bend",
    pBalik: "Bend reversing the flow",
    pKecil: "Unpressurized pipe, momentum only",
    rV1: "Inlet velocity",
    rV2: "Outlet velocity",
    rP1: "Pressure force at the inlet",
    rP2: "Pressure force at the outlet",
    rM1: "Momentum flux in",
    rM2: "Momentum flux out",
    rFx: "Support force along the inflow",
    rFy: "Support force across the inflow",
    rR: "Resultant support force",
    rArah: "Direction of the resultant from the inflow",
    rBagi: "Share of the resultant coming from pressure",
    tekananKuasa: "Pressure decides",
    momentumKuasa: "Momentum decides",
    labelCV: "control volume",
    labelMasuk: "p₁A₁ + ρQV₁",
    labelKeluar: "p₂A₂ + ρQV₂",
    labelGaya: "support force",
    note:
      "The strength of the momentum principle lies in what it does not ask. It does not ask the shape of the bend, the roughness of its wall, the eddies in its corner, or how much energy is lost inside. All it asks is what crosses the boundary going in and what crosses it going out, and the difference between the two is the force. That is why it still answers problems the energy equation cannot touch at all, the hydraulic jump among them, where the energy lost is the question rather than the answer. Two things to keep in mind when using it. First, it is a vector equation, not a scalar one, so direction counts and a 180-degree bend demands twice the force of a 90-degree one. Second, in a pressurized pipe the pressure term is almost always far larger than the momentum term, often thirtyfold, so a bend anchor is really sized by its test pressure and not by its flow. A pipe under a pressure test with the water standing still still demands very nearly the same anchor.",
  },
} as const;

const REFS = {
  id: [
    "Euler, L. (1750). Découverte d'un nouveau principe de mécanique.",
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, edisi ke-8, bab 3.",
    "Chow, V.T. (1959). Open-Channel Hydraulics, bab 3.",
    "Idelchik, I.E. (1996). Handbook of Hydraulic Resistance, edisi ke-3.",
  ],
  en: [
    "Euler, L. (1750). Découverte d'un nouveau principe de mécanique.",
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, 8th ed., ch. 3.",
    "Chow, V.T. (1959). Open-Channel Hydraulics, ch. 3.",
    "Idelchik, I.E. (1996). Handbook of Hydraulic Resistance, 3rd ed.",
  ],
} as const;

export function PrinsipMomentumClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Q, setQ] = useState(0.5);
  const [D1, setD1] = useState(0.5);
  const [D2, setD2] = useState(0.5);
  const [head, setHead] = useState(60);
  const [sudut, setSudut] = useState(90);

  const r = momentumForce(Q, D1, D2, head, sudut);
  const panjang = Math.max(D1, D2) * 3;
  const geo = bendGeometry(D1, D2, sudut, panjang);

  const ref = useCanvas(
    (ctx, w, ch) => {
      const badan = bendPlan(D1, D2, sudut, panjang, panjang);

      /*
       * Batas volume kendalinya digambar BERSARANG di dalam pipanya, karena
       * volume kendali di sini memang airnya sendiri: dinding pipa sebagai
       * batas sampingnya, dan dua penampang sebagai batas masuk keluarnya.
       * Jari-jari belokannya dipakai ulang supaya kedua bentuk itu benar
       * benar sejajar dan bukan sekadar mirip. Bagian dalamnya sengaja
       * dibiarkan kosong, karena itulah pokok lembar ini.
       */
      const dalam = bendPlan(
        D1 * 0.78,
        D2 * 0.78,
        sudut,
        panjang * 0.9,
        panjang * 0.9,
        geo.radius
      );
      const kotak: StructureLine[] = [
        {
          pts: dalam,
          color: C.ink3,
          weight: W.thin,
          dash: DASH.hidden,
          label: x.labelCV,
          labelAt: 0.5,
          labelDy: -8,
          labelAlign: "center",
        },
      ];

      /* Panah diskalakan pada yang terbesar di antaranya, supaya
         perbandingan panjangnya benar-benar berarti. */
      const masuk = r.pressureForce1 + r.momentumIn;
      const keluar = r.pressureForce2 + r.momentumOut;
      const besar = Math.max(masuk, keluar, r.resultant, 1e-9);
      const k = 72 / besar;

      /* Titik tengah busur belokannya, tempat resultannya ditangkap. */
      const tengah = bendGeometry(D1, D2, sudut / 2, 0);

      const panah: StructureVector[] = [
        {
          x: -panjang,
          z: 0,
          dx: masuk * k,
          dy: 0,
          text: x.labelMasuk,
          color: C.water,
        },
        {
          x: geo.outlet.x,
          z: geo.outlet.z,
          dx: keluar * k * geo.direction.x,
          dy: -keluar * k * geo.direction.z,
          text: x.labelKeluar,
          color: C.water,
        },
        {
          x: tengah.outlet.x,
          z: tengah.outlet.z,
          dx: r.Fx * k,
          dy: -r.Fy * k,
          text: `${x.labelGaya} ${fmtPlain(r.resultant / 1000, 1)} kN`,
          color: C.energy,
          root: true,
        },
      ];

      const semua = [...badan, geo.outlet, { x: -panjang, z: 0 }];
      const lebarBidang = Math.max(D1, D2);
      const xs = semua.map((p) => p.x);
      const zs = semua.map((p) => p.z);
      drawStructure(
        ctx,
        w,
        ch,
        {
          xMin: Math.min(...xs) - lebarBidang,
          xMax: Math.max(...xs) + lebarBidang,
          zMin: Math.min(...zs) - lebarBidang,
          zMax: Math.max(...zs) + lebarBidang,
          bodies: [{ pts: badan, hatch: "none", outline: true }],
          lines: kotak,
          vectors: panah,
          heading: r.pressureShare > 0.8 ? x.tekananKuasa : x.momentumKuasa,
          axisX: T.planView,
          axisZ: T.planView,
        },
        lang
      );
    },
    [Q, D1, D2, head, sudut, lang]
  );

  return (
    <LabShell
      sheet="FF-03"
      subject={SUBJECTS.FF[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Yang menentukan gaya hanya apa yang{" "}
            <Term tint={C.water}>menembus batas</Term> volume kendalinya. Apa
            yang terjadi <Term tint={C.energy}>di dalamnya</Term> tidak pernah
            ditanyakan.
          </p>
        ) : (
          <p>
            The force is set only by what{" "}
            <Term tint={C.water}>crosses the boundary</Term> of the control
            volume. What happens <Term tint={C.energy}>inside it</Term> is never
            asked.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FF-03"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (N, m, m³/s)" },
            { label: "R", value: `${fmt(r.resultant / 1000, 1)} kN`, tint: C.energy },
            { label: "θ", value: `${fmt(sudut, 0)}°` },
            { label: "V₁", value: `${fmt(r.velocity1, 2)} m/s`, tint: C.water },
            { label: "p₁A₁/R", value: `${fmt(r.pressureShare * 100, 0)} %` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q * 1000} min={10} max={3000} step={10} digits={0} unit="l/s" onChange={(v) => setQ(v / 1000)} tint={C.water} />
              <InputRow symbol="D₁" label={x.dD1} value={D1 * 1000} min={100} max={1200} step={25} digits={0} unit="mm" onChange={(v) => setD1(v / 1000)} />
              <InputRow symbol="D₂" label={x.dD2} value={D2 * 1000} min={100} max={1200} step={25} digits={0} unit="mm" onChange={(v) => setD2(v / 1000)} />
              <InputRow symbol="h₁" label={x.dH} value={head} min={0} max={200} step={2} digits={0} unit="m" onChange={setHead} tint={C.energy} />
              <InputRow symbol="θ" label={x.dSudut} value={sudut} min={0} max={180} step={5} digits={0} unit="°" onChange={setSudut} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pSiku, apply: () => { setQ(0.5); setD1(0.5); setD2(0.5); setHead(60); setSudut(90); } },
                  { label: x.pBalik, apply: () => { setQ(0.5); setD1(0.5); setD2(0.5); setHead(60); setSudut(180); } },
                  { label: x.pKecil, apply: () => { setQ(0.5); setD1(0.5); setD2(0.5); setHead(0); setSudut(90); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5">
              <Flag tint={r.pressureShare > 0.8 ? C.energy : C.water}>
                {r.pressureShare > 0.8 ? x.tekananKuasa : x.momentumKuasa}
              </Flag>
            </div>
            <ResultTable
              rows={[
                { symbol: "V₁", label: x.rV1, value: fmt(r.velocity1, 3), unit: "m/s", tint: C.water },
                { symbol: "V₂", label: x.rV2, value: fmt(r.velocity2, 3), unit: "m/s", tint: C.water },
                { symbol: "p₁A₁", label: x.rP1, value: fmt(r.pressureForce1 / 1000, 2), unit: "kN" },
                { symbol: "p₂A₂", label: x.rP2, value: fmt(r.pressureForce2 / 1000, 2), unit: "kN" },
                { symbol: "ρQV₁", label: x.rM1, value: fmt(r.momentumIn / 1000, 3), unit: "kN" },
                { symbol: "ρQV₂", label: x.rM2, value: fmt(r.momentumOut / 1000, 3), unit: "kN" },
                { symbol: "Fx", label: x.rFx, value: fmt(r.Fx / 1000, 2), unit: "kN" },
                { symbol: "Fy", label: x.rFy, value: fmt(r.Fy / 1000, 2), unit: "kN" },
                { symbol: "R", label: x.rR, value: fmt(r.resultant / 1000, 2), unit: "kN", tint: C.energy, strong: true },
                { symbol: "α", label: x.rArah, value: fmt(r.direction, 1), unit: "°" },
                { symbol: "—", label: x.rBagi, value: fmt(r.pressureShare * 100, 1), unit: "%" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(Q, D1, D2, head, sudut, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksMomentum(Q, D1, D2, head, sudut)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>ΣF = ρQ(V₂ − V₁)</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "persamaan vektor, bukan skalar"
                    : "a vector equation, not a scalar one"}
                </span>
              </Eq>
              <Eq>
                <span>Fx = p₁A₁ + ρQV₁ − (p₂A₂ + ρQV₂) cos θ</span>
              </Eq>
              <Eq>
                <span>Fy = −(p₂A₂ + ρQV₂) sin θ</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "isi volume kendalinya tidak muncul di mana pun"
                    : "nothing inside the control volume appears anywhere"}
                </span>
              </Eq>
              <Eq>
                <Frac num="ρQV" den="pA" />
                <span className="ml-3 text-ink-3">
                  {lang === "id"
                    ? "nisbah inilah yang menentukan mana yang perlu dihitung teliti"
                    : "this ratio decides which term is worth computing carefully"}
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
  Q: number,
  D1: number,
  D2: number,
  head: number,
  sudut: number,
  lang: Lang
): string {
  const a = momentumForce(Q, D1, D2, head, sudut);
  const diam = momentumForce(1e-9, D1, D2, head, sudut);
  const balik = momentumForce(Q, D1, D2, head, 180);
  const siku = momentumForce(Q, D1, D2, head, 90);

  if (lang === "en")
    return `At this setting the support must resist ${fmt(a.resultant / 1000, 1)} kilonewtons. Now stop the water completely and leave the pressure where it is: the force only falls to ${fmt(diam.resultant / 1000, 1)} kilonewtons, that is ${fmt((diam.resultant / Math.max(a.resultant, 1e-9)) * 100, 0)} per cent of it. The anchor is sized by the pressure test, not by the flow. The angle is the other lever: a right-angle bend asks ${fmt(siku.resultant / 1000, 1)} kilonewtons and a reversing bend asks ${fmt(balik.resultant / 1000, 1)}, very nearly twice as much, because what counts is the change of direction of a vector and not the size of an angle.`;
  return `Pada setelan ini tumpuannya harus menahan ${fmt(a.resultant / 1000, 1)} kilonewton. Sekarang hentikan airnya sama sekali dan biarkan tekanannya tetap: gayanya hanya turun ke ${fmt(diam.resultant / 1000, 1)} kilonewton, yaitu ${fmt((diam.resultant / Math.max(a.resultant, 1e-9)) * 100, 0)} persennya. Angkurnya ditentukan uji tekan, bukan alirannya. Sudutnya tuas yang satu lagi: belokan siku menuntut ${fmt(siku.resultant / 1000, 1)} kilonewton dan belokan berbalik arah menuntut ${fmt(balik.resultant / 1000, 1)}, hampir dua kalinya, karena yang menentukan perubahan arah sebuah vektor dan bukan besar sebuah sudut.`;
}
