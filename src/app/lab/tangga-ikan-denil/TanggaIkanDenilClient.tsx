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
import { drawStructure, type StructureBody, type StructureSpec } from "@/lib/drawStructure";
import {
  DENIL_RUN_MAX,
  DENIL_SLOPE_MAX,
  DENIL_SLOPE_MIN,
  denilFishway,
  fmt,
  fmtPlain,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksDenil } from "@/lib/checks";

const TXT = {
  id: {
    title: "Tangga ikan Denil",
    sheetTitle: "Tangga ikan Denil — sirip penahan miring ke hulu",
    dB: "Lebar palung antar sirip",
    dY: "Kedalaman aliran tegak lurus dasar",
    dS: "Kemiringan palung",
    dRise: "Beda tinggi seluruhnya",
    dU: "Kecepatan sentak ikan rancangan",
    pBaku: "Rancangan baku",
    pCuram: "Terlalu curam",
    pLebar: "Palung lebar, debit besar",
    rQ: "Debit yang lewat",
    rVmean: "Kecepatan rata-rata",
    rVmax: "Kecepatan di sumbu palung",
    rEps: "Lesapan daya per satuan isi",
    rRasio: "Terhadap batas tangga berkolam",
    rLength: "Panjang palung",
    rIstirahat: "Panjang terpanjang tanpa kolam istirahat",
    curam: "Kemiringan di luar rentang rancangan",
    curamNote:
      "Kemiringan palung di luar rentang sepersepuluh sampai seperempat. Di bawahnya sirip penahan tidak lagi menimbulkan putaran balik yang cukup dan palungnya berperilaku seperti saluran biasa, sehingga tidak ada gunanya memasang sirip sama sekali. Di atasnya kecepatan di sumbu palung naik melampaui yang sanggup dilawan hampir semua jenis ikan sungai, dan tangga ikannya menjadi penghalang alih-alih lintasan. Kurva rancangan Denil yang dipakai di sini pun hanya diterbitkan pada rentang itu.",
    lambat: "Ikan tidak sanggup melawan arus di sumbu palung",
    lambatNote:
      "Kecepatan di sumbu palung melampaui kecepatan sentak ikan rancangan, sehingga ikan tidak dapat maju berapa pun kuatnya ia berenang. Perlu diingat bahwa kecepatan sentak hanya dapat dipertahankan sekitar dua puluh detik, jadi memenuhi syarat ini tepat di ambangnya berarti merancang palung yang hanya dapat dilewati sekali oleh ikan yang benar-benar segar. Landaikan palungnya, atau pilih jenis ikan rancangan yang lebih lemah dan rancang untuknya.",
    istirahat: "Butuh kolam istirahat",
    istirahatNote:
      "Palungnya lebih panjang daripada sepuluh meter tanpa kolam istirahat. Karena ikan melewati tangga Denil dengan berenang sentak dan bukan berenang jelajah, panjang palung tanpa jeda dibatasi oleh berapa lama sentakan itu dapat dipertahankan, bukan oleh kekuatan bangunannya. Sisipkan kolam istirahat setiap enam sampai sepuluh meter panjang palung.",
    note:
      "Yang membuat tangga Denil bekerja bukan penghalangan melainkan pembalikan. Sirip yang miring ke hulu memaksa sebagian air berputar balik di dekat dinding dan dasar palung, dan putaran balik itu melesap tenaga tanpa menutup lintasan di tengah. Ikan berenang di sepanjang sumbu, tempat airnya masih mengalir maju tetapi jauh lebih lambat daripada kemiringan palungnya seharusnya membuatnya. Harga yang dibayar untuk lintasan yang jauh lebih pendek daripada tangga berkolam adalah keteradukan: lesapan daya di dalam palung Denil belasan sampai puluhan kali batas yang diterima tangga berkolam. Itu bukan cacat rancangan melainkan ciri alatnya, dan akibatnya jelas: Denil hanya cocok untuk jenis ikan yang kuat berenang, selalu menuntut kolam istirahat pada jarak tertentu, dan sama sekali tidak cocok untuk ikan kecil atau ikan yang bergerak di dasar.",
  },
  en: {
    title: "Denil fishway",
    sheetTitle: "Denil fishway — baffles angled upstream",
    dB: "Trough width between baffles",
    dY: "Flow depth normal to the invert",
    dS: "Trough slope",
    dRise: "Total rise",
    dU: "Burst speed of the design fish",
    pBaku: "Standard design",
    pCuram: "Too steep",
    pLebar: "Wide trough, large discharge",
    rQ: "Discharge through the trough",
    rVmean: "Mean velocity",
    rVmax: "Velocity on the trough axis",
    rEps: "Power dissipated per unit volume",
    rRasio: "Against the pool fishway limit",
    rLength: "Trough length",
    rIstirahat: "Longest run without a resting pool",
    curam: "Slope outside the design range",
    curamNote:
      "The trough slope lies outside one tenth to one quarter. Below it the baffles no longer set up enough reverse rotation and the trough behaves like an ordinary channel, so fitting baffles at all serves no purpose. Above it the axial velocity rises past what almost any river species can beat, and the fishway becomes a barrier rather than a passage. The Denil design curves used here are only published within that range in any case.",
    lambat: "The fish cannot beat the axial velocity",
    lambatNote:
      "The velocity on the trough axis exceeds the burst speed of the design fish, so the fish cannot advance however hard it swims. Remember that burst speed can be held for only about twenty seconds, so meeting this condition exactly at its limit means designing a trough that can be passed once by a genuinely fresh fish. Flatten the trough, or choose a weaker design species and design for that.",
    istirahat: "Resting pool required",
    istirahatNote:
      "The trough is longer than ten metres without a resting pool. Because fish pass a Denil by burst swimming rather than cruising, the length of an uninterrupted run is limited by how long that burst can be held, not by the strength of the structure. Insert a resting pool every six to ten metres of trough.",
    note:
      "What makes a Denil work is not obstruction but reversal. Baffles angled upstream force part of the water to rotate backwards near the walls and the invert, and that reverse rotation dissipates energy without closing the path down the middle. The fish swims along the axis, where the water still moves forward but far more slowly than the slope of the trough should make it. The price paid for a passage far shorter than a pool fishway is turbulence: the dissipation inside a Denil trough is ten to twenty times the limit a pool fishway accepts. That is not a design fault but a feature of the device, and its consequences are clear: a Denil suits only strong-swimming species, always demands resting pools at intervals, and does not suit small fish or bottom-moving fish at all.",
  },
} as const;

const REFS = {
  id: [
    "Denil, G. (1909). Les échelles à poissons et leur application aux barrages de Meuse et d'Ourthe. Annales des Travaux Publics de Belgique.",
    "Bell, M.C. (1991). Fisheries Handbook of Engineering Requirements and Biological Criteria. US Army Corps of Engineers.",
    "Katopodis, C. (1992). Introduction to Fishway Design. Freshwater Institute, Winnipeg.",
    "FAO/DVWK (2002). Fish Passes: Design, Dimensions and Monitoring. FAO, Roma.",
  ],
  en: [
    "Denil, G. (1909). Les échelles à poissons et leur application aux barrages de Meuse et d'Ourthe. Annales des Travaux Publics de Belgique.",
    "Bell, M.C. (1991). Fisheries Handbook of Engineering Requirements and Biological Criteria. US Army Corps of Engineers.",
    "Katopodis, C. (1992). Introduction to Fishway Design. Freshwater Institute, Winnipeg.",
    "FAO/DVWK (2002). Fish Passes: Design, Dimensions and Monitoring. FAO, Rome.",
  ],
} as const;

export function TanggaIkanDenilClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [b, setB] = useState(0.6);
  const [y, setY] = useState(0.7);
  const [S, setS] = useState(0.2);
  const [rise, setRise] = useState(3);
  const [burst, setBurst] = useState(2.5);

  const r = denilFishway(b, y, S, rise);
  const tidakMampu = r.maxVelocity > burst;

  const ref = useCanvas(
    (ctx, w, ch) => {
      // Potongan memanjang palung miring dengan sirip penahan miring ke hulu.
      const panjang = Math.min(r.runLength, 8);
      const jarakSirip = Math.max(b * 0.6, 0.25);
      const jumlah = Math.max(2, Math.floor(panjang / jarakSirip));
      const tebal = Math.max(b * 0.06, 0.03);

      const dasarDi = (xx: number) => -S * xx;

      const badan: StructureBody[] = [
        // Lantai palung.
        {
          pts: [
            { x: 0, z: dasarDi(0) },
            { x: panjang, z: dasarDi(panjang) },
            { x: panjang, z: dasarDi(panjang) - tebal * 2 },
            { x: 0, z: dasarDi(0) - tebal * 2 },
          ],
        },
      ];

      // Sirip penahan: bidang tipis miring ke hulu, tingginya sebagian
      // kedalaman palung.
      for (let i = 1; i <= jumlah; i++) {
        const xx = i * jarakSirip;
        if (xx > panjang) break;
        const z0 = dasarDi(xx);
        const tinggi = y * 0.62;
        const miring = tinggi * 0.45;
        badan.push({
          pts: [
            { x: xx, z: z0 },
            { x: xx + tebal, z: z0 },
            { x: xx + tebal - miring, z: z0 + tinggi },
            { x: xx - miring, z: z0 + tinggi },
          ],
          color: C.ink,
        });
      }

      const muka: { x: number; z: number }[] = [];
      for (let i = 0; i <= 40; i++) {
        const xx = (panjang * i) / 40;
        muka.push({ x: xx, z: dasarDi(xx) + y });
      }

      const spec: StructureSpec = {
        xMin: -panjang * 0.08,
        xMax: panjang * 1.08,
        zMin: dasarDi(panjang) - tebal * 3,
        zMax: y * 1.25,
        bodies: badan,
        waters: [
          {
            surface: muka,
            bed: [
              { x: panjang, z: dasarDi(panjang) },
              { x: 0, z: dasarDi(0) },
            ],
            invalid: r.slopeOutOfRange || tidakMampu,
          },
        ],
        dims: [
          {
            axis: "v",
            at: panjang * 0.5,
            from: dasarDi(panjang * 0.5),
            to: dasarDi(panjang * 0.5) + y,
            text: `y ${fmtPlain(y, 2)} m`,
            color: C.water,
            offset: 24,
          },
        ],
        callouts: [
          {
            x: jarakSirip * 2,
            z: dasarDi(jarakSirip * 2) + y * 0.6,
            dx: 20,
            dy: -32,
            text: T.baffleLabel,
          },
        ],
        arrows: [
          {
            x: panjang * 0.25,
            z: dasarDi(panjang * 0.25) + y * 0.82,
            length: -28,
            color: tidakMampu ? C.signal : C.water,
          },
        ],
        heading: r.slopeOutOfRange
          ? x.curam
          : tidakMampu
            ? x.lambat
            : undefined,
        headingColor: C.signal,
        axisX: T.axHoriz,
        axisZ: T.axLevel,
      };

      drawStructure(ctx, w, ch, spec, lang);
    },
    [b, y, S, rise, burst, lang]
  );

  return (
    <LabShell
      sheet="EH-02"
      subject={SUBJECTS.EH[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Sirip yang miring ke hulu tidak menghalangi aliran melainkan{" "}
            <Term tint={C.energy}>membalikkan sebagiannya</Term>. Lintasan di
            tengah palung tetap terbuka, jauh lebih lambat daripada kemiringan
            palungnya seharusnya membuatnya.
          </p>
        ) : (
          <p>
            Baffles angled upstream do not obstruct the flow but{" "}
            <Term tint={C.energy}>reverse part of it</Term>. The path down the
            middle stays open, far slower than the slope of the trough should
            make it.
          </p>
        )
      }
      drawing={
        <Sheet
          number="EH-02"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "S", value: fmt(S, 3), tint: r.slopeOutOfRange ? C.signal : undefined },
            { label: "Q", value: `${fmt(r.Q, 3)} m³/s`, tint: C.water },
            { label: "Vmaks", value: `${fmt(r.maxVelocity, 2)} m/s`, tint: tidakMampu ? C.signal : C.energy },
            { label: "L", value: `${fmt(r.runLength, 1)} m` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="b" label={x.dB} value={b} min={0.25} max={1.5} step={0.05} digits={2} unit="m" onChange={setB} />
              <InputRow symbol="y" label={x.dY} value={y} min={0.2} max={2} step={0.05} digits={2} unit="m" onChange={setY} tint={C.water} />
              <InputRow symbol="S" label={x.dS} value={S * 100} min={4} max={40} step={1} digits={0} unit="%" onChange={(v) => setS(v / 100)} tint={C.energy} />
              <InputRow symbol="H" label={x.dRise} value={rise} min={0.5} max={12} step={0.5} digits={1} unit="m" onChange={setRise} />
              <InputRow symbol="Ub" label={x.dU} value={burst} min={0.5} max={6} step={0.1} digits={1} unit="m/s" onChange={setBurst} tint={C.signal} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pBaku, apply: () => { setB(0.6); setY(0.7); setS(0.2); setRise(3); setBurst(2.5); } },
                  { label: x.pCuram, apply: () => { setB(0.6); setY(0.7); setS(0.35); setRise(3); setBurst(2.5); } },
                  { label: x.pLebar, apply: () => { setB(1.2); setY(1.2); setS(0.15); setRise(3); setBurst(2.5); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={tidakMampu || r.slopeOutOfRange ? undefined : C.water} alert={tidakMampu || r.slopeOutOfRange}>
                {`${fmt(r.maxVelocity, 2)} m/s`}
              </Flag>
              {r.slopeOutOfRange && <Flag alert>{x.curam}</Flag>}
              {tidakMampu && <Flag alert>{x.lambat}</Flag>}
              {r.needsRestPool && <Flag alert>{x.istirahat}</Flag>}
            </div>
            {r.slopeOutOfRange && (
              <div className="mb-2.5">
                <Note>{x.curamNote}</Note>
              </div>
            )}
            {tidakMampu && (
              <div className="mb-2.5">
                <Note>{x.lambatNote}</Note>
              </div>
            )}
            {r.needsRestPool && (
              <div className="mb-2.5">
                <Note>{x.istirahatNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "Vmaks", label: x.rVmax, value: fmt(r.maxVelocity, 3), unit: "m/s", tint: tidakMampu ? C.signal : C.energy, strong: true },
                { symbol: "Q", label: x.rQ, value: fmt(r.Q, 4), unit: "m³/s", tint: C.water, strong: true },
                { symbol: "Vrata", label: x.rVmean, value: fmt(r.meanVelocity, 3), unit: "m/s" },
                { symbol: "ε", label: x.rEps, value: fmt(r.powerDensity, 0), unit: "W/m³", tint: C.energy },
                { symbol: "—", label: x.rRasio, value: fmt(r.powerRatioToPool, 1), unit: "×", tint: C.signal },
                { symbol: "L", label: x.rLength, value: fmt(r.runLength, 2), unit: "m" },
                { symbol: "Lmax", label: x.rIstirahat, value: fmt(DENIL_RUN_MAX, 0), unit: "m", tint: r.needsRestPool ? C.signal : undefined },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(b, y, S, rise, r.powerRatioToPool, r.runLength, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksDenil(b, y, S, rise)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <Frac num="Q" den="b^2,5 √g" />
                <span>= 0,94</span>
                <Frac num="y" den="b" />
                <span>√S + 0,16</span>
                <span className="ml-1">(</span>
                <Frac num="y" den="b" />
                <span>)²</span>
              </Eq>
              <Eq>
                <span>ε =</span>
                <Frac num="ρ g Q S" den="b y" />
                <span className="ml-5">Vmaks = 1,5 Vrata</span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `berlaku pada kemiringan ${fmtPlain(DENIL_SLOPE_MIN, 2)} sampai ${fmtPlain(DENIL_SLOPE_MAX, 2)}`
                    : `valid for slopes from ${fmtPlain(DENIL_SLOPE_MIN, 2)} to ${fmtPlain(DENIL_SLOPE_MAX, 2)}`}
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
  b: number,
  y: number,
  S: number,
  rise: number,
  powerRatio: number,
  runLength: number,
  lang: Lang
): string {
  const landai = denilFishway(b, y, Math.max(S / 2, 0.02), rise);

  if (lang === "en")
    return `The dissipation in this trough is ${fmt(powerRatio, 1)} times what a pool fishway is allowed, and that is the trade this device makes: it climbs ${fmt(rise, 1)} m in ${fmt(runLength, 1)} m of length, where a pool fishway at the same rise would need several times that. Halve the slope and the run becomes ${fmt(landai.runLength, 1)} m long while the axial velocity falls from ${fmt(1.5 * (denilFishway(b, y, S, rise).meanVelocity), 2)} to ${fmt(landai.maxVelocity, 2)} m/s. Length bought, velocity saved: there is no setting that gives both.`;
  return `Lesapan daya di palung ini ${fmt(powerRatio, 1)} kali yang diizinkan pada tangga berkolam, dan itulah pertukaran yang dilakukan alat ini: ia menaiki ${fmt(rise, 1)} m dalam ${fmt(runLength, 1)} m panjang, sementara tangga berkolam pada beda tinggi yang sama menuntut beberapa kali lipat. Landaikan kemiringannya menjadi separuh dan panjangnya menjadi ${fmt(landai.runLength, 1)} m sementara kecepatan di sumbunya turun dari ${fmt(1.5 * denilFishway(b, y, S, rise).meanVelocity, 2)} ke ${fmt(landai.maxVelocity, 2)} m/s. Panjang dibeli, kecepatan dihemat: tidak ada setelan yang memberi keduanya sekaligus.`;
}
