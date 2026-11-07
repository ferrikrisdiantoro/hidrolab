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
  type RegimeBand,
} from "@/components/ui";
import { DragLayer, type HandleSpec } from "@/components/DragLayer";
import { usePlate } from "@/lib/usePlate";
import type { ParamDef } from "@/lib/rentang";
import { drawHidrostatika } from "@/lib/drawHidrostatika";
import {
  hydrostaticPressure,
  inclinedRectangle,
  planeSurfaceForce,
  rectangleSection,
} from "@/lib/hidrostatika";
import { G, fmt } from "@/lib/hydraulics";
import { C, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { P_ATM, checksHidrostatika } from "@/lib/checksHidrostatika";

const TXT = {
  id: {
    title: "Tekanan hidrostatis",
    sheetTitle: "Tangki berdinding miring dengan pintu, dan tekanan terhadap kedalaman",
    dRho: "Rapat massa zat cair",
    dH: "Kedalaman zat cair di tangki",
    dProbe: "Kedalaman ujung probe",
    dB: "Lebar pintu",
    dL: "Panjang pintu sepanjang dinding",
    dSudut: "Sudut dinding terhadap muka zat cair",
    dTop: "Kedalaman tepi atas pintu",
    gProbe: "Ujung probe, seret naik atau turun untuk mengubah kedalamannya",
    gTop: "Tepi atas pintu, seret naik atau turun sepanjang dinding",
    zat: "Zat cair",
    mode: "Tekanan",
    ukur: "Ukur (gauge)",
    mutlak: "Mutlak (absolut)",
    pFE: "Pintu tegak 1 × 1 m dari muka air",
    pCrowe: "Pintu 4 × 6 m miring 60°",
    pMenembus: "Pintu menembus muka air",
    rP: (abs: boolean) => (abs ? "Tekanan mutlak di ujung probe" : "Tekanan ukur di ujung probe"),
    rF: "Gaya resultan pada pintu",
    rHp: "Kedalaman pusat tekanan",
    rPa: "Tekanan di muka zat cair",
    rHc: "Kedalaman titik berat bagian basah",
    rPc: "Tekanan ukur di titik berat",
    rA: "Luas bagian basah",
    rLw: "Panjang bagian basah",
    rYcp: "Letak pusat tekanan dari titik berat, sepanjang pintu",
    rSelisih: "Pusat tekanan lebih dalam daripada titik berat",
    bandKering: "Di atas muka",
    bandMenembus: "Menembus muka",
    bandPenuh: "Terendam penuh",
    bandDasar: "Menembus dasar",
    kDasar: "Pintu menembus dasar tangki",
    kKering: "Pintu seluruhnya di atas muka zat cair",
    kMenembus: "Pintu menembus muka, hanya bagian basah dihitung",
    kPenuh: "Pintu terendam penuh",
    kProbe: "Probe di bawah dasar tangki",
    jP: "Tekanan di ujung probe",
    jLw: "Panjang dan luas bagian basah",
    jHc: "Kedalaman titik berat bagian basah",
    jF: "Gaya resultan, tekanan ukur di titik berat kali luas",
    jI: "Momen inersia luas terhadap titik berat",
    jY: "Letak pusat tekanan dari titik berat (negatif = lebih dalam)",
    jHp: "Kedalaman pusat tekanan",
    probeNote:
      "Ujung probe lebih dalam daripada dasar tangki, jadi tidak ada zat cair di sana untuk dibaca. Bacaannya tidak ditulis. Naikkan probe atau dalamkan tangkinya.",
    dasarNote:
      "Bagian bawah pintu jatuh di bawah dasar tangki, padahal di sana tidak ada zat cair maupun dinding. Gaya dan pusat tekanannya tidak ditulis. Naikkan tepi atas pintu, pendekkan pintunya, atau dalamkan tangkinya.",
    note:
      "Zat cair yang diam tidak dapat menahan geser, jadi satu-satunya gaya yang dapat diteruskannya ke dinding adalah tekanan, dan tekanan itu tegak lurus dinding di setiap titik. Pada kedalaman yang sama tekanannya sama, berapa pun bentuk tangkinya: yang menentukan hanya berat kolom zat cair di atas titik itu, rho g h, ditambah apa pun yang menekan muka zat cair. Itu sebabnya probe dan titik bacaannya di diagram selalu sejajar. Pada sebuah pintu tekanan itu bertambah lurus dari tepi atas ke tepi bawah, jadi jumlahnya sama dengan tekanan di titik berat dikali luasnya. Letak gaya itu tidak di titik berat. Bagian bawah pintu ditekan lebih kuat daripada bagian atasnya, jadi resultannya bergeser ke bawah, ke pusat tekanan. Pergeseran itu sebanding dengan momen inersia luas pintu dan berbanding terbalik dengan kedalaman titik beratnya: pada pintu yang dalam sebaran tekanannya hampir rata dan pusat tekanannya hampir di titik berat, sedangkan pada pintu yang tepi atasnya di muka air pusat tekanannya turun sampai dua pertiga tingginya. Udara di balik dinding menekan pintu dari sisi lain dengan tekanan atmosfer yang sama, jadi untuk gaya bersih pada pintu yang dipakai tekanan ukur.",
  },
  en: {
    title: "Hydrostatic pressure",
    sheetTitle: "Tank with an inclined wall and a gate, and pressure against depth",
    dRho: "Liquid density",
    dH: "Liquid depth in the tank",
    dProbe: "Probe tip depth",
    dB: "Gate width",
    dL: "Gate length along the wall",
    dSudut: "Wall angle to the liquid surface",
    dTop: "Depth of the gate top edge",
    gProbe: "Probe tip, drag up or down to change its depth",
    gTop: "Gate top edge, drag up or down along the wall",
    zat: "Liquid",
    mode: "Pressure",
    ukur: "Gauge",
    mutlak: "Absolute",
    pFE: "Vertical 1 × 1 m gate from the surface",
    pCrowe: "4 × 6 m gate inclined at 60°",
    pMenembus: "Gate breaking the surface",
    rP: (abs: boolean) => (abs ? "Absolute pressure at the probe tip" : "Gauge pressure at the probe tip"),
    rF: "Resultant force on the gate",
    rHp: "Depth of the centre of pressure",
    rPa: "Pressure at the liquid surface",
    rHc: "Depth of the centroid of the wetted part",
    rPc: "Gauge pressure at the centroid",
    rA: "Wetted area",
    rLw: "Wetted length",
    rYcp: "Centre of pressure from the centroid, along the gate",
    rSelisih: "Centre of pressure below the centroid",
    bandKering: "Above the surface",
    bandMenembus: "Breaks the surface",
    bandPenuh: "Fully submerged",
    bandDasar: "Through the floor",
    kDasar: "The gate passes through the tank floor",
    kKering: "The whole gate is above the liquid surface",
    kMenembus: "The gate breaks the surface, only the wetted part counts",
    kPenuh: "The gate is fully submerged",
    kProbe: "Probe below the tank floor",
    jP: "Pressure at the probe tip",
    jLw: "Wetted length and area",
    jHc: "Depth of the centroid of the wetted part",
    jF: "Resultant force, gauge pressure at the centroid times area",
    jI: "Second moment of area about the centroid",
    jY: "Centre of pressure from the centroid (negative = deeper)",
    jHp: "Depth of the centre of pressure",
    probeNote:
      "The probe tip is deeper than the tank floor, so there is no liquid there to read. The reading is not written. Raise the probe or deepen the tank.",
    dasarNote:
      "The lower part of the gate falls below the tank floor, where there is neither liquid nor wall. The force and centre of pressure are not written. Raise the top edge, shorten the gate, or deepen the tank.",
    note:
      "A liquid at rest cannot carry shear, so the only force it can pass to a wall is pressure, and that pressure is normal to the wall at every point. At the same depth the pressure is the same, whatever the shape of the tank: all that counts is the weight of the liquid column above the point, rho g h, plus whatever presses on the liquid surface. That is why the probe and its reading on the diagram always line up. On a gate that pressure grows linearly from the top edge to the bottom edge, so its sum equals the pressure at the centroid times the area. Where that force acts is not the centroid. The lower part of the gate is pressed harder than the upper part, so the resultant shifts down, to the centre of pressure. The shift is proportional to the second moment of area of the gate and inversely proportional to the depth of its centroid: on a deep gate the pressure is nearly uniform and the centre of pressure sits almost at the centroid, while on a gate whose top edge is at the surface it drops to two thirds of the height. Air behind the wall presses on the other face of the gate at the same atmospheric pressure, so the net force on the gate uses gauge pressure.",
  },
} as const;

const REFS = {
  id: [
    "White, F.M. Fluid Mechanics, bab 2, gaya hidrostatik pada bidang datar. Dirujuk lewat catatan kuliah Kartha, IIT Guwahati CE203, Lecture 7 (2017).",
    "Crowe, C.T., Elger, D.F., Roberson, J.A. Engineering Fluid Mechanics, contoh 3.78, lewat salindia McKinney, CE 319F, University of Texas at Austin.",
    "Kaw, A. (autarkaw). Soal latihan FE, Fluids X-9: gaya hidrostatik pada pintu tegak.",
    "ISO 2533:1975. Standard Atmosphere (tekanan atmosfer baku 101 325 Pa).",
  ],
  en: [
    "White, F.M. Fluid Mechanics, ch. 2, hydrostatic forces on plane surfaces. Cited through the lecture notes of Kartha, IIT Guwahati CE203, Lecture 7 (2017).",
    "Crowe, C.T., Elger, D.F., Roberson, J.A. Engineering Fluid Mechanics, example 3.78, via the slides of McKinney, CE 319F, University of Texas at Austin.",
    "Kaw, A. (autarkaw). FE practice problem, Fluids X-9: hydrostatic force on a vertical gate.",
    "ISO 2533:1975. Standard Atmosphere (standard atmospheric pressure 101 325 Pa).",
  ],
} as const;

/* Zat cair pilihan: rapat massa pada sekitar 20 °C, dibulatkan seperti
   tabel buku ajar (White, tabel A.3); air tawar 1000 dan air laut 1025
   sebagai nilai kuliah yang lazim. */
const ZAT = [
  { id: "Air tawar", en: "Fresh water", rho: 1000 },
  { id: "Air laut", en: "Seawater", rho: 1025 },
  { id: "Oli SAE 30", en: "SAE 30 oil", rho: 891 },
  { id: "Gliserin", en: "Glycerin", rho: 1260 },
  { id: "Raksa", en: "Mercury", rho: 13550 },
] as const;

/*
 * Satu definisi untuk penggeser, kotak angka, dan pegangan seret (aturan 4,
 * satu sumber nilai). Rentang probe dan tepi atas tidak bergantung pada H:
 * yang melewati dasar tangki tidak dipotong diam-diam, melainkan diberi
 * penanda merah sinyal dan angkanya tidak ditulis.
 */
const P_RHO: ParamDef = { min: 600, max: 14000, step: 1, digits: 0 };
const P_H: ParamDef = { min: 0.5, max: 20, step: 0.1, digits: 1 };
const P_PROBE: ParamDef = { min: 0, max: 20, step: 0.05, digits: 2 };
const P_B: ParamDef = { min: 0.1, max: 10, step: 0.1, digits: 1 };
const P_L: ParamDef = { min: 0.1, max: 10, step: 0.1, digits: 1 };
const P_SUDUT: ParamDef = { min: 10, max: 90, step: 1, digits: 0 };
const P_TOP: ParamDef = { min: -3, max: 15, step: 0.05, digits: 2 };

type Keadaan = "dasar" | "kering" | "menembus" | "penuh";

/** Keadaan pintu dari tepi atasnya; batasnya sama dengan model M12. */
function keadaanPintu(top: number, L: number, sin: number, H: number): Keadaan {
  if (top + L * sin > H + 1e-9) return "dasar";
  if (top <= -L * sin) return "kering";
  if (top < 0) return "menembus";
  return "penuh";
}

const NADA: Record<Keadaan, Tone> = {
  dasar: "invalid",
  kering: "neutral",
  menembus: "caution",
  penuh: "pass",
};

export function TekananHidrostatisClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [rho, setRho] = useState(1000);
  const [abs, setAbs] = useState(0);
  const [H, setH] = useState(6);
  const [probe, setProbe] = useState(3);
  const [b, setB] = useState(2);
  const [L, setL] = useState(3);
  const [sudut, setSudut] = useState(60);
  const [top, setTop] = useState(1);

  const absolute = abs === 1;
  const pa = absolute ? P_ATM : 0;
  const ang = (sudut * Math.PI) / 180;
  const sin = Math.sin(ang);

  const probeInvalid = probe > H + 1e-9;
  const pProbe = probeInvalid ? NaN : hydrostaticPressure(probe, rho, G, pa);
  const r = inclinedRectangle(b, L, top, ang, rho);
  const kp = keadaanPintu(top, L, sin, H);
  const gateInvalid = kp === "dasar";
  const basah = !gateInvalid && r.wettedLength > 0;
  /* Angka pintu yang tidak terjadi ditulis "—" lewat NaN. */
  const gp = (v: number) => (gateInvalid ? NaN : v);
  const gb = (v: number) => (basah ? v : NaN);
  const satuanP = (u: string) => (gateInvalid ? undefined : u);
  const satuanB = (u: string) => (basah ? u : undefined);
  const A = b * r.wettedLength;
  const I = (b * r.wettedLength ** 3) / 12;
  const h1 = Math.max(top, 0);

  const sentuh = useRef<() => void>(() => {});
  const plate = usePlate(
    (ctx, w, h) =>
      drawHidrostatika(
        ctx,
        w,
        h,
        {
          rho,
          H,
          probe,
          pProbe,
          pa,
          absolute,
          angle: ang,
          top,
          L,
          b,
          force: r.force,
          depthCG: r.depthCG,
          depthCP: r.depthCP,
          wettedLength: r.wettedLength,
          gateInvalid,
          probeInvalid,
        },
        lang
      ),
    null,
    [rho, abs, H, probe, b, L, sudut, top, lang]
  );

  /*
   * Kedua pegangan tegak. Skala gambar bergantung pada H, sudut, dan
   * lebar kanvas saja, jadi jari memberi kedalaman langsung: invY(py).
   * Tepi atas pintu bergerak sepanjang dinding; yang dibaca hanya
   * kedalamannya.
   */
  const handles: HandleSpec[] = [
    {
      id: "probe",
      anchor: "probe",
      axis: "y",
      label: x.gProbe,
      tint: probeInvalid ? C.signal : C.water,
      param: P_PROBE,
      value: probe,
      toValue: (_px, py, m) => m.invY(py),
      onChange: setProbe,
      format: (v) => `h ${fmt(v, 2)} m`,
    },
    {
      id: "pintu",
      anchor: "gateTop",
      axis: "y",
      label: x.gTop,
      tint: gateInvalid ? C.signal : undefined,
      param: P_TOP,
      value: top,
      toValue: (_px, py, m) => m.invY(py),
      onChange: setTop,
      format: (v) => `h₁ ${fmt(v, 2)} m`,
    },
  ];

  /* Pita rezim tepi atas pintu: batasnya dari keadaanPintu sendiri,
     dievaluasi di tengah tiap selang, jadi penanda dan kartu keadaan tidak
     pernah berbeda. */
  const pita: RegimeBand[] = [];
  {
    const potong = [P_TOP.min, -L * sin, 0, H - L * sin, P_TOP.max]
      .map((v) => Math.min(Math.max(v, P_TOP.min), P_TOP.max))
      .sort((a, c) => a - c);
    const nama: Record<Keadaan, string> = {
      dasar: x.bandDasar,
      kering: x.bandKering,
      menembus: x.bandMenembus,
      penuh: x.bandPenuh,
    };
    for (let i = 0; i + 1 < potong.length; i++) {
      const [a, c] = [potong[i], potong[i + 1]];
      if (c - a < 1e-9) continue;
      const k = keadaanPintu((a + c) / 2, L, sin, H);
      const akhir = pita[pita.length - 1];
      if (akhir && akhir.label === nama[k]) akhir.to = c;
      else pita.push({ from: a, to: c, label: nama[k], tone: NADA[k] });
    }
  }

  const badge =
    kp === "dasar" ? x.kDasar : kp === "kering" ? x.kKering : kp === "menembus" ? x.kMenembus : x.kPenuh;
  const nada: Tone = gateInvalid || probeInvalid ? "invalid" : NADA[kp];
  const pk = pProbe / 1000;

  const langkah = [
    {
      judul: x.jP,
      rumus: <span>p = pₐ + ρ · g · h</span>,
      isi: probeInvalid
        ? "—"
        : `${fmt(pa / 1000, 3)} + ${fmt(rho, 0)} · ${fmt(G, 2)} · ${fmt(probe, 2)} / 1000`,
      hasil: fmt(pk, 2),
      satuan: probeInvalid ? undefined : "kPa",
      tint: probeInvalid ? C.signal : C.water,
    },
    {
      judul: x.jLw,
      rumus: (
        <span>
          {r.clipped ? "L_w = L + h₁ / sin θ" : "L_w = L"} ;  A = b · L_w
        </span>
      ),
      isi: basah
        ? `${r.clipped ? `${fmt(L, 1)} + (${fmt(top, 2)}) / sin ${fmt(sudut, 0)}° = ` : ""}${fmt(r.wettedLength, 3)} ;  ${fmt(b, 1)} · ${fmt(r.wettedLength, 3)}`
        : "—",
      hasil: fmt(gb(A), 3),
      satuan: satuanB("m²"),
    },
    {
      judul: x.jHc,
      rumus: (
        <>
          <span>h_c = max(h₁, 0) +</span>
          <Frac num="L_w" den="2" />
          <span>· sin θ</span>
        </>
      ),
      isi: basah ? `${fmt(h1, 2)} + ${fmt(r.wettedLength, 3)} / 2 · sin ${fmt(sudut, 0)}°` : "—",
      hasil: fmt(gb(r.depthCG), 3),
      satuan: satuanB("m"),
    },
    {
      judul: x.jF,
      rumus: <span>F = p_c · A = ρ · g · h_c · A</span>,
      isi: basah
        ? `${fmt(rho, 0)} · ${fmt(G, 2)} · ${fmt(r.depthCG, 3)} · ${fmt(A, 3)} / 1000`
        : "—",
      hasil: fmt(gp(r.force / 1000), 2),
      satuan: satuanP("kN"),
      tint: gateInvalid ? C.signal : C.water,
    },
    {
      judul: x.jI,
      rumus: (
        <>
          <span>I_xx =</span>
          <Frac num="b · L_w³" den="12" />
        </>
      ),
      isi: basah ? `${fmt(b, 1)} · ${fmt(r.wettedLength, 3)}³ / 12` : "—",
      hasil: fmt(gb(I), 4),
      satuan: satuanB("m⁴"),
    },
    {
      judul: x.jY,
      rumus: (
        <>
          <span>y_CP = −</span>
          <Frac num="ρ · g · sin θ · I_xx" den="p_c · A" />
        </>
      ),
      isi: basah
        ? `− ${fmt(rho, 0)} · ${fmt(G, 2)} · sin ${fmt(sudut, 0)}° · ${fmt(I, 4)} / ( ${fmt(r.pCG, 0)} · ${fmt(A, 3)} )`
        : "—",
      hasil: fmt(gb(r.yCP), 4),
      satuan: satuanB("m"),
    },
    {
      judul: x.jHp,
      rumus: (
        <>
          <span>h_p = h_c − y_CP · sin θ = h_c +</span>
          <Frac num="I_xx · sin² θ" den="h_c · A" />
        </>
      ),
      isi: basah ? `${fmt(r.depthCG, 3)} − (${fmt(r.yCP, 4)}) · sin ${fmt(sudut, 0)}°` : "—",
      hasil: fmt(gb(r.depthCP), 3),
      satuan: satuanB("m"),
      tint: gateInvalid ? C.signal : C.water,
    },
  ];

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="h₁"
          value={top}
          digits={2}
          invalid={gateInvalid}
          bands={pita}
        />
      }
      sheet="FF-08"
      subject={SUBJECTS.FF[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Di zat cair yang diam tekanan hanya bergantung pada kedalaman:{" "}
            <Term tint={C.water}>p = ρgh</Term>, ditambah apa pun yang menekan
            mukanya. Pada sebuah pintu tekanan itu menjumlah menjadi satu gaya,
            dan gaya itu bekerja di bawah titik berat pintu, di pusat tekanan.
          </p>
        ) : (
          <p>
            In a liquid at rest the pressure depends on depth alone:{" "}
            <Term tint={C.water}>p = ρgh</Term>, plus whatever presses on the
            surface. On a gate that pressure adds up to one force, and the
            force acts below the centroid of the gate, at the centre of
            pressure.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FF-08"
          title={x.sheetTitle}
          rev="A"
          height="clamp(400px, 60vh, 640px)"
          cells={[
            { label: t.tbUnit, value: "SI (kPa, kN, m)" },
            { label: "ρ", value: `${fmt(rho, 0)} kg/m³` },
            {
              label: absolute ? (lang === "id" ? "p mutlak" : "p abs") : (lang === "id" ? "p ukur" : "p gauge"),
              value: probeInvalid ? "—" : `${fmt(pk, 1)} kPa`,
              tint: probeInvalid ? C.signal : C.water,
            },
            { label: "F", value: gateInvalid ? "—" : `${fmt(r.force / 1000, 1)} kN`, tint: gateInvalid ? C.signal : C.water },
            { label: "hp", value: basah ? `${fmt(r.depthCP, 2)} m` : "—" },
          ]}
        >
          <canvas ref={plate.ref} className="block h-full w-full" />
          <DragLayer out={plate.outRef.current} handles={handles} touch={() => sentuh.current()} />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="ρ" label={x.dRho} value={rho} {...P_RHO} unit="kg/m³" onChange={setRho} />
              <InputRow symbol="H" label={x.dH} value={H} {...P_H} unit="m" onChange={setH} tint={C.water} />
              <InputRow symbol="h" label={x.dProbe} value={probe} {...P_PROBE} unit="m" onChange={setProbe} tint={probeInvalid ? C.signal : C.water} />
              <InputRow symbol="b" label={x.dB} value={b} {...P_B} unit="m" onChange={setB} />
              <InputRow symbol="L" label={x.dL} value={L} {...P_L} unit="m" onChange={setL} />
              <InputRow symbol="θ" label={x.dSudut} value={sudut} {...P_SUDUT} unit="°" onChange={setSudut} />
              <InputRow symbol="h₁" label={x.dTop} value={top} {...P_TOP} unit="m" onChange={setTop} tint={gateInvalid ? C.signal : undefined} />
            </InputTable>

            <SentuhContoh sentuh={sentuh} />
            <div className="mt-3.5 flex flex-col gap-2">
              <PresetRow
                label={x.zat}
                active={ZAT.findIndex((z) => z.rho === rho)}
                presets={ZAT.map((z) => ({ label: z[lang], apply: () => setRho(z.rho) }))}
              />
              <PresetRow
                label={x.mode}
                active={abs}
                presets={[
                  { label: x.ukur, apply: () => setAbs(0) },
                  { label: x.mutlak, apply: () => setAbs(1) },
                ]}
              />
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pFE, apply: () => { setRho(1000); setH(2); setProbe(1); setB(1); setL(1); setSudut(90); setTop(0); } },
                  { label: x.pCrowe, apply: () => { setRho(1000); setH(10); setProbe(3); setB(4); setL(6); setSudut(60); setTop(3); } },
                  { label: x.pMenembus, apply: () => { setRho(1000); setH(4); setProbe(2); setB(1.5); setL(3); setSudut(90); setTop(-1); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "p", label: x.rP(absolute), value: fmt(pk, 2), unit: probeInvalid ? undefined : "kPa", tint: probeInvalid ? C.signal : C.water, strong: true },
                { symbol: "F", label: x.rF, value: fmt(gp(r.force / 1000), 2), unit: satuanP("kN"), tint: gateInvalid ? C.signal : C.water, strong: true },
                { symbol: "hp", label: x.rHp, value: fmt(gb(r.depthCP), 3), unit: satuanB("m"), tint: gateInvalid ? C.signal : C.water, strong: true },
                { symbol: "pₐ", label: x.rPa, value: fmt(pa / 1000, 3), unit: "kPa" },
                { symbol: "hc", label: x.rHc, value: fmt(gb(r.depthCG), 3), unit: satuanB("m") },
                { symbol: "p_c", label: x.rPc, value: fmt(gb(r.pCG / 1000), 2), unit: satuanB("kPa") },
                { symbol: "A", label: x.rA, value: fmt(gb(A), 3), unit: satuanB("m²") },
                { symbol: "L_w", label: x.rLw, value: fmt(gp(r.wettedLength), 3), unit: satuanP("m"), tint: kp === "menembus" ? C.caution : undefined },
                { symbol: "y_CP", label: x.rYcp, value: fmt(gb(r.yCP), 4), unit: satuanB("m") },
                { symbol: "Δh", label: x.rSelisih, value: fmt(gb(r.depthCP - r.depthCG), 4), unit: satuanB("m") },
              ]}
            />
            <div className="mt-3">
              <Hitungan langkah={langkah} />
            </div>
          </Block>

          <StateCard
            tone={nada}
            badge={probeInvalid && !gateInvalid ? x.kProbe : badge}
            state={keadaanTeks(lang, { probe, pk, absolute, probeInvalid, kp, b, L, sudut, r })}
            notice={[
              ...(probeInvalid ? [x.probeNote] : []),
              ...(gateInvalid ? [x.dasarNote] : []),
              ...notice(lang, { rho, probe, pa, absolute, probeInvalid, kp, b, L, top, ang, r }),
            ]}
          />
        </>
      }
      verification={<Verification checks={checksHidrostatika(rho, b, L, top, ang, probe, pa)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>p = pₐ + ρ g h</span>
                <span className="ml-5">F = ρ g h_c A</span>
              </Eq>
              <Eq>
                <span>y_CP = −</span>
                <Frac num="ρ g sin θ I_xx" den="p_c A" />
                <span className="ml-5">h_p = h_c +</span>
                <Frac num="I_xx sin² θ" den="h_c A" />
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "bentuk kanan untuk tekanan ukur; pintu tegak: h_p = h_c + I_xx / (h_c A)"
                    : "right-hand form for gauge pressure; vertical gate: h_p = h_c + I_xx / (h_c A)"}
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

type Hasil = ReturnType<typeof inclinedRectangle>;

function keadaanTeks(
  lang: Lang,
  s: { probe: number; pk: number; absolute: boolean; probeInvalid: boolean; kp: Keadaan; b: number; L: number; sudut: number; r: Hasil }
): string {
  const id = lang === "id";
  const probe = s.probeInvalid
    ? id
      ? `Probe di kedalaman ${fmt(s.probe, 2)} m sudah di bawah dasar tangki.`
      : `The probe at ${fmt(s.probe, 2)} m depth is already below the tank floor.`
    : id
      ? `Probe di kedalaman ${fmt(s.probe, 2)} m membaca ${fmt(s.pk, 1)} kPa ${s.absolute ? "mutlak" : "ukur"}.`
      : `The probe at ${fmt(s.probe, 2)} m depth reads ${fmt(s.pk, 1)} kPa ${s.absolute ? "absolute" : "gauge"}.`;
  const pintu = id
    ? `Pintu ${fmt(s.b, 1)} × ${fmt(s.L, 1)} m pada ${fmt(s.sudut, 0)}°`
    : `The ${fmt(s.b, 1)} × ${fmt(s.L, 1)} m gate at ${fmt(s.sudut, 0)}°`;
  let gate: string;
  if (s.kp === "dasar")
    gate = id ? `${pintu} menembus dasar tangki; gayanya tidak ditulis.` : `${pintu} passes through the tank floor; its force is not written.`;
  else if (s.kp === "kering")
    gate = id ? `${pintu} seluruhnya di atas muka zat cair, gayanya nol.` : `${pintu} is entirely above the liquid surface, so its force is zero.`;
  else
    gate = id
      ? `${pintu}: F ${fmt(s.r.force / 1000, 1)} kN bekerja ${fmt(s.r.depthCP, 2)} m di bawah muka, ${fmt(s.r.depthCP - s.r.depthCG, 3)} m lebih dalam daripada titik beratnya.`
      : `${pintu}: F ${fmt(s.r.force / 1000, 1)} kN acts ${fmt(s.r.depthCP, 2)} m below the surface, ${fmt(s.r.depthCP - s.r.depthCG, 3)} m deeper than its centroid.`;
  return `${probe} ${gate}`;
}

/*
 * Hal yang perlu diperhatikan, dihitung dengan model M12 pada keadaan
 * pengandaian: probe dua kali lebih dalam (dan zat cair raksa), pintu 5 m
 * lebih dalam, dan pada mode mutlak gaya satu sisi bila udara di balik
 * dinding dilupakan.
 */
function notice(
  lang: Lang,
  s: { rho: number; probe: number; pa: number; absolute: boolean; probeInvalid: boolean; kp: Keadaan; b: number; L: number; top: number; ang: number; r: Hasil }
): string[] {
  const id = lang === "id";
  const out: string[] = [];

  if (!s.probeInvalid) {
    const ukur = hydrostaticPressure(s.probe, s.rho) / 1000;
    const ukur2 = hydrostaticPressure(2 * s.probe, s.rho) / 1000;
    const raksa = hydrostaticPressure(s.probe, 13550) / 1000;
    if (s.probe <= 0)
      out.push(
        id
          ? `Ujung probe tepat di muka zat cair: tekanan ukurnya nol, dan tekanan mutlaknya ${fmt(P_ATM / 1000, 1)} kPa, tekanan udara di atasnya. Turunkan probe dan perhatikan bacaannya naik lurus terhadap kedalaman.`
          : `The probe tip sits exactly at the liquid surface: its gauge pressure is zero, and its absolute pressure is ${fmt(P_ATM / 1000, 1)} kPa, the air above it. Lower the probe and watch the reading rise linearly with depth.`
      );
    else if (s.absolute)
      out.push(
        id
          ? `Pada kedalaman dua kali lipat, tekanan ukur juga dua kali lipat (${fmt(ukur, 1)} menjadi ${fmt(ukur2, 1)} kPa), tetapi tekanan mutlak hanya naik dari ${fmt((ukur * 1000 + s.pa) / 1000, 1)} ke ${fmt((ukur2 * 1000 + s.pa) / 1000, 1)} kPa, karena atmosfer di atasnya tidak ikut berlipat.`
          : `At twice the depth the gauge pressure also doubles (${fmt(ukur, 1)} to ${fmt(ukur2, 1)} kPa), but the absolute pressure only rises from ${fmt((ukur * 1000 + s.pa) / 1000, 1)} to ${fmt((ukur2 * 1000 + s.pa) / 1000, 1)} kPa, because the atmosphere above does not double.`
      );
    else
      out.push(
        id
          ? `Pada kedalaman dua kali lipat, tekanan ukurnya juga dua kali lipat: ${fmt(ukur, 1)} menjadi ${fmt(ukur2, 1)} kPa. Ganti zat cairnya dengan raksa dan pada kedalaman yang sama bacaannya ${fmt(raksa, 1)} kPa, karena yang menentukan berat kolom di atas probe, bukan bentuk tangkinya.`
          : `At twice the depth the gauge pressure also doubles: ${fmt(ukur, 1)} to ${fmt(ukur2, 1)} kPa. Switch the liquid to mercury and at the same depth the reading is ${fmt(raksa, 1)} kPa, because what counts is the weight of the column above the probe, not the shape of the tank.`
      );
  }

  if (s.kp === "penuh" || s.kp === "menembus") {
    const dalam = inclinedRectangle(s.b, s.L, Math.max(s.top, 0) + 5, s.ang, s.rho);
    const geser = s.r.depthCP - s.r.depthCG;
    const geser5 = dalam.depthCP - dalam.depthCG;
    if (s.kp === "menembus")
      out.push(
        id
          ? `Hanya ${fmt(s.r.wettedLength, 2)} m dari ${fmt(s.L, 1)} m panjang pintu yang basah. Bagian di atas muka tidak ditekan zat cair, jadi gaya dan pusat tekanannya dihitung pada bagian basah saja, yang tepi atasnya di muka zat cair: pusat tekanannya di dua pertiga kedalaman bagian basah itu.`
          : `Only ${fmt(s.r.wettedLength, 2)} m of the ${fmt(s.L, 1)} m gate length is wetted. The part above the surface carries no liquid pressure, so the force and centre of pressure are computed on the wetted part alone, whose top edge is at the surface: the centre of pressure sits at two thirds of the depth of that wetted part.`
      );
    out.push(
      id
        ? `Pusat tekanan sekarang ${fmt(geser, 3)} m di bawah titik berat. Bila pintu yang sama terendam penuh dengan tepi atasnya ${fmt(Math.max(s.top, 0) + 5, 2)} m di bawah muka, gayanya naik ke ${fmt(dalam.force / 1000, 1)} kN tetapi selisih itu menyusut ke ${fmt(geser5, 3)} m: makin dalam, sebaran tekanannya makin rata.`
        : `The centre of pressure is now ${fmt(geser, 3)} m below the centroid. With the same gate fully submerged and its top edge ${fmt(Math.max(s.top, 0) + 5, 2)} m below the surface, the force rises to ${fmt(dalam.force / 1000, 1)} kN but that gap shrinks to ${fmt(geser5, 3)} m: the deeper it goes, the more uniform the pressure.`
    );
    if (s.absolute && s.r.wettedLength > 0) {
      const satuSisi = planeSurfaceForce(
        rectangleSection(s.b, s.r.wettedLength),
        s.r.depthCG,
        s.ang,
        s.rho,
        G,
        P_ATM
      );
      out.push(
        id
          ? `Bila udara di balik dinding dilupakan dan tekanan mutlak dipakai pada satu sisi saja, gayanya menjadi ${fmt(satuSisi.force / 1000, 1)} kN dan pusat tekanannya naik ke ${fmt(satuSisi.depthCP, 3)} m, hampir di titik berat. Udara menekan sisi lain pintu sama besar, jadi gaya bersihnya tetap gaya tekanan ukur, ${fmt(s.r.force / 1000, 1)} kN.`
          : `If the air behind the wall is forgotten and absolute pressure is applied to one face only, the force becomes ${fmt(satuSisi.force / 1000, 1)} kN and the centre of pressure rises to ${fmt(satuSisi.depthCP, 3)} m, almost at the centroid. Air presses on the other face just as hard, so the net force is still the gauge force, ${fmt(s.r.force / 1000, 1)} kN.`
      );
    }
  } else if (s.kp === "kering") {
    out.push(
      id
        ? "Seluruh pintu di atas muka zat cair, jadi tidak ada tekanan zat cair yang bekerja padanya. Turunkan tepi atasnya sampai menyentuh muka dan perhatikan gaya mulai tumbuh dari nol."
        : "The whole gate is above the liquid surface, so no liquid pressure acts on it. Lower its top edge until it touches the surface and watch the force grow from zero."
    );
  }
  return out;
}
