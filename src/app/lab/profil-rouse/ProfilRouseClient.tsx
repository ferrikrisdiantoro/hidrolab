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
  SentuhContoh,
  Sheet,
  StateCard,
  Term,
} from "@/components/ui";
import { usePlate } from "@/lib/usePlate";
import { DragLayer, type HandleSpec } from "@/components/DragLayer";
import type { ParamDef } from "@/lib/rentang";
import { drawChart, type ChartSeries } from "@/lib/drawChart";
import {
  G,
  KARMAN,
  ROUSE_BEDLOAD,
  ROUSE_BETA,
  ROUSE_FULL,
  ROUSE_PARTIAL,
  SEDIMENT_S,
  fmt,
  fmtPlain,
  fmtSci,
  rouseConcentration,
  rouseNumber,
  rouseState,
  waterViscosity,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksRouse } from "@/lib/checks";

const TXT = {
  id: {
    title: "Profil Rouse",
    sheetTitle: "Profil Rouse — sebaran sedimen melayang sepanjang kedalaman",
    dD: "Diameter butir",
    dUstar: "Kecepatan gesek",
    dH: "Kedalaman aliran",
    dA: "Ketinggian acuan di atas dasar",
    dRho: "Berat jenis relatif butir (Gs)",
    dT: "Suhu air",
    pLanau: "Lanau di sungai besar",
    pPasirHalus: "Pasir halus, arus sedang",
    pPasirKasar: "Pasir kasar, arus sedang",
    rWs: "Kecepatan endap butir",
    rZ: "Bilangan Rouse",
    rMode: "Cara angkut",
    rMid: "Kepekatan di setengah kedalaman",
    rBawah: "Bagian muatan di separuh bawah",
    rA: "Tinggi acuan di atas dasar",
    rNu: "Kekentalan kinematik",
    mWash: "Muatan bilas",
    mFull: "Melayang penuh",
    mPartial: "Melayang sebagian",
    mBed: "Angkutan dasar",
    hA: "Tinggi acuan",
    hMid: "Kepekatan di setengah kedalaman, y = h/2 sehingga (h − y)/y = 1",
    hBawah: "Bagian di separuh bawah, trapesium 200 pias",
    hBawahIsi: "∫ₐ^(h/2) c dy / ∫ₐ^h c dy",
    hdlMid: "Kurva di setengah kedalaman: geser mendatar untuk mengubah kecepatan gesek u*",
    hdlA: "Ketinggian acuan: geser tegak untuk mengubah a/h",
    note:
      "Satu angka menentukan seluruh bentuk kurva ini, dan angka itu perbandingan dua kecepatan: seberapa cepat butir jatuh terhadap seberapa kuat pusaran mengangkatnya. Karena keduanya sama-sama berdimensi kecepatan, perbandingannya tak bersatuan, dan satu bilangan itu berlaku untuk lanau di sungai besar maupun pasir di parit kecil. Perhatikan bentuk kurvanya pada bilangan Rouse kecil: hampir tegak, artinya muatannya tersebar merata dari dasar sampai permukaan. Pada bilangan besar kurvanya menempel ke sumbu, artinya seluruh muatan berdesakan di lapisan tipis dekat dasar. Yang tidak dikatakan kurva ini adalah berapa banyak sedimen yang ada; ia hanya menyatakan sebarannya terhadap satu nilai acuan yang harus diukur atau ditaksir tersendiri. Itulah keterbatasan terpenting yang perlu diingat saat memakainya.",
  },
  en: {
    title: "Rouse profile",
    sheetTitle: "Rouse profile — suspended sediment over the depth",
    dD: "Grain diameter",
    dUstar: "Friction velocity",
    dH: "Flow depth",
    dA: "Reference height above the bed",
    dRho: "Specific gravity of the grains (Gs)",
    dT: "Water temperature",
    pLanau: "Silt in a large river",
    pPasirHalus: "Fine sand, moderate current",
    pPasirKasar: "Coarse sand, moderate current",
    rWs: "Grain settling velocity",
    rZ: "Rouse number",
    rMode: "Transport mode",
    rMid: "Concentration at mid depth",
    rBawah: "Share of the load in the lower half",
    rA: "Reference height above the bed",
    rNu: "Kinematic viscosity",
    mWash: "Wash load",
    mFull: "Fully suspended",
    mPartial: "Partly suspended",
    mBed: "Bed load",
    hA: "Reference height",
    hMid: "Concentration at mid depth, y = h/2 so (h − y)/y = 1",
    hBawah: "Share in the lower half, trapezoid rule on 200 strips",
    hBawahIsi: "∫ₐ^(h/2) c dy / ∫ₐ^h c dy",
    hdlMid: "Curve at mid depth: drag sideways to change the friction velocity u*",
    hdlA: "Reference height: drag up or down to change a/h",
    note:
      "One number sets the whole shape of this curve, and that number is a ratio of two velocities: how fast the grain falls against how strongly the eddies lift it. Because both have the dimensions of velocity, the ratio carries no units, and the single number serves silt in a great river as well as sand in a small ditch. Notice the curve shape at small Rouse numbers: almost vertical, meaning the load is spread evenly from bed to surface. At large numbers the curve hugs the axis, meaning the whole load crowds into a thin layer near the bed. What this curve does not say is how much sediment there is; it only states the distribution relative to one reference value that must be measured or estimated separately. That is the most important limitation to keep in mind when using it.",
  },
} as const;

const REFS = {
  id: [
    "Rouse, H. (1937). Modern conceptions of the mechanics of fluid turbulence. Transactions ASCE, vol. 102.",
    "Vanoni, V.A. (1975). Sedimentation Engineering. ASCE Manual 54, Bab 2.",
    "Ferguson, R.I. & Church, M. (2004). A simple universal equation for grain settling velocity. Journal of Sedimentary Research, vol. 74.",
    "García, M.H. (2008). Sedimentation Engineering. ASCE Manual 110, Bab 2.",
  ],
  en: [
    "Rouse, H. (1937). Modern conceptions of the mechanics of fluid turbulence. Transactions ASCE, vol. 102.",
    "Vanoni, V.A. (1975). Sedimentation Engineering. ASCE Manual 54, Chapter 2.",
    "Ferguson, R.I. & Church, M. (2004). A simple universal equation for grain settling velocity. Journal of Sedimentary Research, vol. 74.",
    "García, M.H. (2008). Sedimentation Engineering. ASCE Manual 110, Chapter 2.",
  ],
} as const;

/** Bilangan Rouse yang digambar sebagai kurva latar. */
const KELUARGA_Z = [0.1, 0.3, 0.6, 1, 2, 4];

/* Rentang yang dipakai bersama penggeser, kotak angka, dan pegangan seret
   (aturan 4: satu sumber nilai). */
const P_U: ParamDef = { min: 0.002, max: 0.4, step: 0.002, digits: 3 };
const P_AH: ParamDef = { min: 0.005, max: 0.2, step: 0.005, digits: 3 };

/*
 * Kebalikan Rouse di setengah kedalaman. Pada y = h/2, (h − y)/y = 1, jadi
 *   c/ca = [ a/(h − a) ]^Z   →   Z = ln(c/ca) / ln( a/(h − a) )
 * dan dari Z = ws / (β κ u*):   u* = ws / (β κ Z).
 * a/(h − a) = (a/h) / (1 − a/h) < 1 karena a/h ≤ 0,2. c/ca ≥ 1 berarti
 * Z ≤ 0 (u* tak hingga), c/ca ≤ 0 berarti Z tak hingga (u* = 0): keduanya
 * dikirim ke luar rentang supaya snap memotongnya dengan penanda.
 */
function uStarDariMid(c: number, ws: number, aFrac: number): number {
  if (c >= 1) return P_U.max * 2;
  if (c <= 0) return 0;
  const Z = Math.log(c) / Math.log(aFrac / (1 - aFrac));
  return ws / (ROUSE_BETA * KARMAN * Z);
}

export function ProfilRouseClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [dMm, setDMm] = useState(0.1);
  const [uStar, setUStar] = useState(0.05);
  const [h, setH] = useState(2);
  const [aFrac, setAFrac] = useState(0.025);
  const [s, setS] = useState(SEDIMENT_S);
  const [suhu, setSuhu] = useState(15);
  // Pemadam tanda contoh untuk pegangan seret (lihat SentuhContoh).
  const sentuh = useRef<() => void>(() => {});

  const nu = waterViscosity(suhu);
  const d = dMm / 1000;
  const a = aFrac * h;
  const r = rouseState(d, s, nu, uStar, h, a);
  /*
   * Cara angkut dari field `transport` (gelombang 1), bukan `mode` lama yang
   * namanya bergeser satu golongan. Z ≥ 2,5 adalah angkutan dasar: keadaan
   * yang sah, persamaannya tetap berlaku, jadi nadanya hati-hati (caution),
   * bukan merah sinyal.
   */
  const dasar = r.transport === "dasar";

  const NAMA: Record<typeof r.transport, string> = {
    "muatan-bilas": x.mWash,
    "melayang-penuh": x.mFull,
    "melayang-sebagian": x.mPartial,
    dasar: x.mBed,
  };
  const NADA: Record<typeof r.transport, Tone> = {
    "muatan-bilas": "water",
    "melayang-penuh": "water",
    "melayang-sebagian": "neutral",
    dasar: "caution",
  };
  const modeNama = NAMA[r.transport];
  const aTeks = a >= 1 ? fmt(a, 3) : fmt(a * 1000, 1);
  const aSatuan = a >= 1 ? "m" : "mm";

  const plate = usePlate(
    (ctx, w, ch) => {
      const kurva = (Z: number) => {
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i <= 200; i++) {
          const yy = a + ((h - a) * i) / 200;
          pts.push({ x: rouseConcentration(yy, h, a, Z), y: yy / h });
        }
        return pts;
      };

      const deret: ChartSeries[] = KELUARGA_Z.map((Z) => ({
        pts: kurva(Z),
        color: C.ink3,
        weight: W.hair,
        label: `Z ${fmtPlain(Z, 1)}`,
        labelAt: 0.55,
        labelDy: -8,
      }));

      deret.push({
        pts: kurva(r.Z),
        color: dasar ? C.caution : C.water,
        weight: W.bold,
        dash: DASH.solid,
      });

      return drawChart(
        ctx,
        w,
        ch,
        {
          xMin: 0,
          xMax: 1,
          yMin: 0,
          yMax: 1,
          axisX: T.axRelConc,
          axisY: T.axHeight,
          series: deret,
          rules: [
            {
              axis: "y",
              at: a / h,
              color: C.critical,
              dash: DASH.axis,
              label: `${T.referenceHeight} ${fmtPlain(a, 3)} m`,
              labelAlign: "right",
            },
          ],
          point: {
            x: r.midRatio,
            y: 0.5,
            label: `Z ${fmtPlain(r.Z, 2)}`,
          },
          /* Pegangan: titik kurva di setengah kedalaman (sama dengan
             `point`), dan pangkal kurva di ketinggian acuan, tempat
             c/ca = 1 menurut definisinya. */
          anchors: {
            tengah: { x: r.midRatio, y: 0.5 },
            acuan: { x: 1, y: aFrac },
          },
        },
        lang
      );
    },
    null,
    [dMm, uStar, h, aFrac, s, suhu, lang]
  );

  /*
   * Pegangan seret. Kedua sumbu tetap 0–1, jadi tidak ada saling kejar.
   * - tengah: letak mendatarnya c/ca di h/2, HASIL model; bukan masukan.
   *   Dipetakan balik ke satu masukan, u* (d, Gs, T, a/h tetap), lewat
   *   uStarDariMid. Hanya mendatar.
   * - acuan: sumbu tegak adalah y/h, jadi a/h dibaca langsung. Hanya tegak.
   */
  /*
   * Pada butir kasar c/ca di h/2 jauh di bawah 1/lebar bidang: seluruh
   * rentang u* rendah menumpuk di bawah 1 px dari sumbu, jadi seret hanya
   * meloncat antara ujung bawah dan nilai besar (insinyur-hidraulika,
   * 26 Okt 2026). Di sana pegangan u* tidak dipasang; u* diatur lewat
   * penggeser.
   */
  const keluar = plate.outRef.current;
  const tengahRapat = keluar ? keluar.map.X(r.midRatio) - keluar.map.frame.x0 < 4 : false;
  // Selama diseret atau difokus keyboard pegangan tetap terpasang (kalau
  // dilepas di tengahnya, pointer capture dan fokus hilang); baru
  // disembunyikan sesudah dilepas dan fokus pindah.
  const [menyeret, setMenyeret] = useState(false);
  const [fokus, setFokus] = useState(false);
  // Hanya pegangan u* sendiri; fokus atau seret pada pegangan acuan tidak
  // boleh memunculkannya kembali.
  const pegTengah = (t: EventTarget) =>
    t instanceof Element && t.closest('[data-handle="tengah"]') !== null;
  const semuaPegangan: HandleSpec[] = [
    {
      id: "tengah",
      anchor: "tengah",
      axis: "x",
      label: x.hdlMid,
      hollow: true,
      tint: C.water,
      param: P_U,
      value: uStar,
      toValue: (px, _py, m) => uStarDariMid(m.invX(px), r.ws, aFrac),
      onChange: setUStar,
      format: (v) => `u* ${fmt(v, 3)} m/s, Z ${fmt(rouseNumber(r.ws, v), 3)}`,
    },
    {
      id: "acuan",
      anchor: "acuan",
      axis: "y",
      label: x.hdlA,
      param: P_AH,
      value: aFrac,
      toValue: (_px, py, m) => m.invY(py),
      onChange: setAFrac,
      format: (v) => `a/h ${fmt(v, 3)}, a ${fmt(v * h, 3)} m`,
    },
  ];
  const handles = tengahRapat && !menyeret && !fokus ? semuaPegangan.filter((p) => p.id !== "tengah") : semuaPegangan;

  return (
    <LabShell
      status={
        /* Batas ROUSE_FULL, ROUSE_PARTIAL, ROUSE_BEDLOAD dari rouseState.
           Rentang penggeser memberi Z 1,7·10⁻⁶ sampai 478, jadi kedua ujung
           bisa lewat skala. Tidak ada pita invalid: persamaan Rouse berlaku
           di seluruh rentang. */
        <RegimeScale
          symbol="Z"
          value={r.Z}
          scale="log"
          digits={3}
          bands={[
            { from: 0.001, to: ROUSE_FULL, label: x.mWash, tone: "water" },
            { from: ROUSE_FULL, to: ROUSE_PARTIAL, label: x.mFull, tone: "water" },
            { from: ROUSE_PARTIAL, to: ROUSE_BEDLOAD, label: x.mPartial, tone: "neutral" },
            { from: ROUSE_BEDLOAD, to: 100, label: x.mBed, tone: "caution" },
          ]}
        />
      }
      sheet="SD-02"
      subject={SUBJECTS.SD[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Dua kecepatan bersaing: <Term tint={C.critical}>laju jatuh</Term>{" "}
            butir melawan <Term tint={C.water}>kekuatan angkat pusaran</Term>.
            Perbandingan keduanya tidak bersatuan, dan satu angka itu
            menentukan seluruh bentuk sebarannya.
          </p>
        ) : (
          <p>
            Two velocities compete: the{" "}
            <Term tint={C.critical}>fall rate</Term> of the grain against the{" "}
            <Term tint={C.water}>lifting strength of the eddies</Term>. Their
            ratio has no units, and that single number sets the entire shape of
            the distribution.
          </p>
        )
      }
      drawing={
        <Sheet
          number="SD-02"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m/s)" },
            { label: "d", value: `${fmt(dMm, 3)} mm` },
            { label: "ws", value: `${fmtSci(r.ws)} m/s`, tint: C.critical },
            { label: "Z", value: fmt(r.Z, 3), tint: dasar ? C.caution : C.water },
            { label: "h", value: `${fmt(h, 2)} m` },
          ]}
        >
          <canvas ref={plate.ref} className="block h-full w-full" />
          <div
            className="contents"
            onPointerDown={(e) => {
              if (e.pointerType === "mouse" && e.button !== 0) return;
              if (!pegTengah(e.target)) return;
              setMenyeret(true);
            }}
            onPointerUp={() => setMenyeret(false)}
            onPointerCancel={() => setMenyeret(false)}
            onLostPointerCapture={() => setMenyeret(false)}
            onFocus={(e) => setFokus(pegTengah(e.target))}
            onBlur={() => setFokus(false)}
          >
            <DragLayer out={plate.outRef.current} handles={handles} touch={() => sentuh.current()} />
          </div>
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <SentuhContoh sentuh={sentuh} />
            <InputTable>
              <InputRow symbol="d" label={x.dD} value={dMm} min={0.004} max={4} step={0.002} digits={3} unit="mm" onChange={setDMm} tint={C.critical} />
              <InputRow symbol="u*" label={x.dUstar} value={uStar} {...P_U} unit="m/s" onChange={setUStar} tint={C.water} />
              <InputRow symbol="h" label={x.dH} value={h} min={0.1} max={20} step={0.1} digits={1} unit="m" onChange={setH} />
              <InputRow symbol="a/h" label={x.dA} value={aFrac} {...P_AH} onChange={setAFrac} />
              <InputRow symbol="Gs" label={x.dRho} value={s} min={1.05} max={4} step={0.05} digits={2} onChange={setS} />
              <InputRow symbol="T" label={x.dT} value={suhu} min={4} max={40} step={0.5} digits={1} unit="°C" onChange={setSuhu} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pLanau, apply: () => { setDMm(0.02); setUStar(0.06); setH(5); setAFrac(0.02); setS(SEDIMENT_S); setSuhu(15); } },
                  { label: x.pPasirHalus, apply: () => { setDMm(0.1); setUStar(0.05); setH(2); setAFrac(0.025); setS(SEDIMENT_S); setSuhu(15); } },
                  { label: x.pPasirKasar, apply: () => { setDMm(0.5); setUStar(0.05); setH(2); setAFrac(0.025); setS(SEDIMENT_S); setSuhu(15); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "Z", label: x.rZ, value: fmt(r.Z, 4), tint: dasar ? C.caution : C.water, strong: true },
                { symbol: "ws", label: x.rWs, value: fmtSci(r.ws), unit: "m/s", tint: C.critical, strong: true },
                { symbol: "—", label: x.rMode, value: modeNama },
                { symbol: "c½/ca", label: x.rMid, value: fmt(r.midRatio, 5) },
                { symbol: "—", label: x.rBawah, value: fmt(r.lowerHalf * 100, 1), unit: "%" },
                /*
                 * Satu-satunya besaran di lembar ini yang bergantung pada
                 * kedalaman. Tanpa baris ini, menggeser kedalaman dari
                 * sepersepuluh meter ke dua puluh meter tidak mengubah apa
                 * pun selain angka di kop, dan pembaca berhak menyimpulkan
                 * lembarnya rusak. Yang sebenarnya terjadi justru pokok
                 * lembar ini, dan dikatakan di kartu keadaan.
                 */
                { symbol: "a", label: x.rA, value: aTeks, unit: aSatuan },
                { symbol: "ν", label: x.rNu, value: fmtSci(nu), unit: "m²/s" },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.rWs,
                    rumus: (<><span>ws =</span><Frac num="(Gs − 1) g d²" den="18 ν + √(0,75 (Gs − 1) g d³)" /></>),
                    isi: `(${fmt(s, 2)} − 1) · ${fmt(G, 2)} · (${fmtSci(d)})² / [ 18 · ${fmtSci(nu)} + √( 0,75 · (${fmt(s, 2)} − 1) · ${fmt(G, 2)} · (${fmtSci(d)})³ ) ]`,
                    hasil: fmtSci(r.ws),
                    satuan: "m/s",
                    tint: C.critical,
                  },
                  {
                    judul: x.rZ,
                    rumus: (<><span>Z =</span><Frac num="ws" den="β · κ · u*" /></>),
                    isi: `${fmtSci(r.ws)} / ( 1 · ${fmt(KARMAN, 2)} · ${fmt(uStar, 3)} )`,
                    hasil: fmt(r.Z, 4),
                    tint: dasar ? C.caution : C.water,
                  },
                  {
                    judul: x.hA,
                    rumus: <span>a = (a/h) · h</span>,
                    isi: `${fmt(aFrac, 3)} · ${fmt(h, 1)}`,
                    hasil: aTeks,
                    satuan: aSatuan,
                  },
                  {
                    judul: x.hMid,
                    rumus: (<><span>c½/ca = [</span><Frac num="a" den="h − a" /><span>]^Z</span></>),
                    isi: `[ ${fmt(a, 4)} / ( ${fmt(h, 1)} − ${fmt(a, 4)} ) ]^${fmt(r.Z, 4)}`,
                    hasil: fmt(r.midRatio, 5),
                  },
                  {
                    judul: x.hBawah,
                    rumus: <span>{x.hBawahIsi}</span>,
                    isi: `Z = ${fmt(r.Z, 4)} ; a/h = ${fmt(aFrac, 3)}`,
                    hasil: fmt(r.lowerHalf * 100, 1),
                    satuan: "%",
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={NADA[r.transport]}
            badge={modeNama}
            {...notice(r.Z, r.lowerHalf, r.midRatio, a, modeNama, dasar, lang)}
          />
        </>
      }
      verification={<Verification checks={checksRouse(d, s, nu, uStar, h, a)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <Frac num="c" den="ca" />
                <span>=</span>
                <span className="ml-1">[</span>
                <Frac num="h − y" den="y" />
                <span>·</span>
                <Frac num="a" den="h − a" />
                <span>]^Z</span>
              </Eq>
              <Eq>
                <span>Z =</span>
                <Frac num="ws" den="β κ u*" />
                <span className="ml-5">β = 1</span>
                <span className="ml-3">κ = {fmtPlain(KARMAN, 2)}</span>
              </Eq>
              <Eq>
                <span>ws =</span>
                <Frac num="(s − 1) g d²" den="18 ν + √(0,75 (s−1) g d³)" />
                <span className="ml-3 text-ink-3">Ferguson-Church</span>
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
 * Kalimat keadaan, lalu butir: (a) contoh rata-rata kedalaman hanya
 * mewakili di bawah 0,8; (b) kedalaman tidak menggerakkan kurva (pokok
 * lembar); (c) untuk Z ≥ 2,5 muatannya angkutan dasar.
 */
function notice(
  Z: number,
  lowerHalf: number,
  mid: number,
  a: number,
  modeNama: string,
  dasar: boolean,
  lang: Lang
): { state: string; notice: string[] } {
  const en = lang === "en";
  const kedalaman = en
    ? `Drag the depth from a tenth of a metre to twenty metres and the curve does not move at all. That is not a fault but the point of this sheet: in relative coordinates the Rouse number contains no depth whatever, so a ten centimetre flume and a twenty metre river at the same friction velocity carry exactly the same relative distribution. All the depth changes is where the reference height actually sits, now ${a >= 1 ? `${fmt(a, 2)} metres` : `${fmt(a * 1000, 0)} millimetres`} above the bed.`
    : `Geser kedalamannya dari sepersepuluh meter ke dua puluh meter dan kurvanya tidak bergerak sedikit pun. Itu bukan kerusakan melainkan pokok lembar ini: pada sumbu nisbi, bilangan Rouse tidak mengandung kedalaman sama sekali, jadi flum sedalam sepuluh sentimeter dan sungai sedalam dua puluh meter yang kecepatan geseknya sama membawa sebaran nisbi yang sama persis. Yang diubah kedalaman hanya letak sebenarnya tinggi acuan, sekarang ${a >= 1 ? `${fmt(a, 2)} meter` : `${fmt(a * 1000, 0)} milimeter`} di atas dasar.`;

  const state = en
    ? `Z = ${fmt(Z, 3)}: ${modeNama.toLowerCase()}; ${fmt(lowerHalf * 100, 1)} % of the suspended load sits in the lower half.`
    : `Z = ${fmt(Z, 3)}: ${modeNama.toLowerCase()}; ${fmt(lowerHalf * 100, 1)} % muatan melayang di separuh bawah.`;

  const contoh = en
    ? `The concentration at mid depth is ${fmt(mid, 3)} of the reference value. Below ${fmtPlain(ROUSE_FULL, 1)} the load is essentially uniform and a single depth-averaged sample represents the whole column; above it a sample taken near the surface understates the load by whatever factor this curve says. That is why sediment sampling protocols specify the sampling height.`
    : `Kepekatan di setengah kedalaman ${fmt(mid, 3)} dari nilai acuannya. Di bawah ${fmtPlain(ROUSE_FULL, 1)} muatannya praktis merata dan satu contoh rata-rata kedalaman mewakili seluruh kolom; di atasnya, contoh yang diambil dekat permukaan mengecilkan muatannya sebesar yang dikatakan kurva ini. Itulah sebabnya tata cara pengambilan contoh sedimen menetapkan ketinggian pengambilannya.`;

  const dasarNote = en
    ? `Above ${fmtPlain(ROUSE_BEDLOAD, 1)} the suspended distribution is negligible; the load is bed load, grains rolling and hopping along the bed. The curve is still drawn because the equation still holds. Reduce the grain size or raise the friction velocity to bring Z below ${fmtPlain(ROUSE_BEDLOAD, 1)}.`
    : `Di atas ${fmtPlain(ROUSE_BEDLOAD, 1)} sebaran melayang dapat diabaikan; muatannya angkutan dasar, butir menggelinding dan meloncat di sepanjang dasar. Kurvanya tetap digambar karena persamaannya tetap berlaku. Perkecil butirnya atau perbesar kecepatan geseknya sampai Z turun di bawah ${fmtPlain(ROUSE_BEDLOAD, 1)}.`;

  return { state, notice: dasar ? [dasarNote, kedalaman] : [contoh, kedalaman] };
}
