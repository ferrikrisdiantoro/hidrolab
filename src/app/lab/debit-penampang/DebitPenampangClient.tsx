"use client";

import { useEffect, useMemo, useState } from "react";
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
import { DataEntry, ptsFromRows, rowsFromPts, type Row } from "@/components/DataEntry";
import { useCanvas } from "@/lib/useCanvas";
import {
  drawStructure,
  type StructureBody,
  type StructureDim,
  type StructureLine,
  type StructureWater,
} from "@/lib/drawStructure";
import { fmt, fmtPlain } from "@/lib/hydraulics";
import {
  RATING_STORAGE_KEY,
  SAMPLE_SECTION,
  maxDischargeDepth,
  ratingValue,
  sectionFlow,
  sectionHeight,
  type Pt,
  type RatingFit,
  type Resistance,
  type SectionInput,
  type SectionShape,
} from "@/lib/discharge";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksSection } from "@/lib/checksDischarge";

const TXT = {
  id: {
    title: "Debit penampang saluran",
    sheetTitle: "Debit aliran seragam pada penampang lingkaran, persegi, dan alam",
    bentuk: "bentuk",
    sLingkaran: "lingkaran",
    sPersegi: "persegi",
    sAlam: "penampang alam",
    rumus: "rumus",
    blkKoordinat: "koordinat penampang",
    hX: "X, m",
    hY: "Y, m",
    dD: "Garis tengah pipa",
    dW: "Lebar dasar",
    dHc: "Tinggi dinding",
    dH: "Kedalaman air dari titik terendah",
    dS: "Kemiringan dasar",
    dN: "Koefisien Manning",
    dC: "Koefisien Chezy",
    pGorong: "Gorong-gorong beton",
    pBox: "Saluran kotak beton",
    pSungai: "Sungai alam, data cl42",
    rA: "Luas basah",
    rP: "Keliling basah",
    rR: "Jari-jari hidraulis",
    rT: "Lebar muka air",
    rV: "Kecepatan rata-rata",
    rQ: "Debit",
    rFr: "Bilangan Froude",
    rQmaks: "Debit terbesar penampang",
    rYmaks: "pada kedalaman",
    rQrc: "Debit menurut lengkung HY-04",
    rSelisih: "Selisih terhadap Manning atau Chezy",
    penuh: "Pipa penuh, air di atas puncaknya",
    penuhNote:
      "Muka air yang diminta lebih tinggi daripada puncak pipa, jadi pipanya penuh dan tidak lagi mengalir sebagai saluran terbuka. Debit yang ditulis adalah debit pipa penuh dengan garis energi sejajar dasar, yaitu kapasitas gravitasinya. Air yang lebih tinggi lagi di hulu tidak menambah debit lewat rumus ini: ia menambah tekanan, dan debitnya harus dihitung sebagai aliran bertekanan (lembar PI-07). Perhatikan juga bahwa pipa penuh mengalirkan LEBIH SEDIKIT daripada pipa yang terisi sekitar 94 persen.",
    luap: "Air meluap di atas tepi saluran",
    luapNote:
      "Muka air yang diminta lebih tinggi daripada tepi terendah salurannya. Air di atas tepi itu tidak lagi berada di dalam penampang ini: ia melimpas ke samping, ke bantaran atau ke jalan. Hitungannya karena itu dipotong di tepi terendah, dan debit yang ditulis adalah kapasitas penampangnya saat penuh sampai tepi, bukan debit pada muka air yang diminta. Untuk banjir yang melimpas ke bantaran, penampangnya harus diperlebar sampai mencakup bantaran itu, dan bantarannya biasanya diberi koefisien kekasaran sendiri.",
    kurangTitik: "Koordinat penampang belum cukup",
    kurangTitikNote:
      "Penampang alam butuh paling sedikit dua titik koordinat, disusun dari tebing kiri ke tebing kanan. Muat data contoh atau unggah berkas koordinat.",
    rcLuar: "Lengkung HY-04 dibaca di luar rentang datanya",
    rcDatum:
      "Lengkungnya dibaca pada H sama dengan kedalaman y di lembar ini. Itu hanya benar bila nol papan duga yang dipakai menyusun lengkungnya berada tepat di titik terendah penampang ini; bila tidak, selisih keduanya bukan selisih rumus melainkan selisih datum.",
    rcNone:
      "Belum ada lengkung debit tersimpan. Susun lengkungnya di lembar HY-04 lalu tekan \"pakai di HY-03\" untuk membandingkan kedua debit di sini.",
    note:
      "Rumus Manning dan Chezy menghitung debit ALIRAN SERAGAM, yaitu aliran yang kedalamannya sama sepanjang saluran karena gaya berat yang mendorong tepat diimbangi gesekan dasar dan dinding. Dua andaian ikut di dalamnya dan jarang disebut. Pertama, kemiringan yang dimasukkan adalah kemiringan garis energi, yang sama dengan kemiringan dasar hanya bila alirannya memang seragam; di dekat bendung, gorong-gorong, atau perubahan penampang, kedalamannya berubah dan rumus ini tidak berlaku. Kedua, koefisien kekasaran dianggap tetap untuk seluruh penampang, padahal pada sungai alam dasar berbatu dan bantaran berumput kekasarannya jauh berbeda. Yang menarik dari penampang lingkaran: debitnya tidak terbesar saat pipa penuh. Mendekati puncak, keliling basah bertambah jauh lebih cepat daripada luasnya, sehingga jari-jari hidraulisnya turun, dan puncak debitnya berada di sekitar 94 persen garis tengah.",
  },
  en: {
    title: "Channel section discharge",
    sheetTitle: "Uniform-flow discharge in circular, rectangular, and natural sections",
    bentuk: "shape",
    sLingkaran: "circular",
    sPersegi: "rectangular",
    sAlam: "natural section",
    rumus: "formula",
    blkKoordinat: "section coordinates",
    hX: "X, m",
    hY: "Y, m",
    dD: "Pipe diameter",
    dW: "Bottom width",
    dHc: "Wall height",
    dH: "Water depth above the lowest point",
    dS: "Bed slope",
    dN: "Manning coefficient",
    dC: "Chezy coefficient",
    pGorong: "Concrete culvert pipe",
    pBox: "Concrete box channel",
    pSungai: "Natural river, cl42 data",
    rA: "Wetted area",
    rP: "Wetted perimeter",
    rR: "Hydraulic radius",
    rT: "Top width",
    rV: "Mean velocity",
    rQ: "Discharge",
    rFr: "Froude number",
    rQmaks: "Largest section discharge",
    rYmaks: "at depth",
    rQrc: "Discharge from the HY-04 rating",
    rSelisih: "Difference from Manning or Chezy",
    penuh: "Pipe full, water above its crown",
    penuhNote:
      "The requested water level is above the pipe crown, so the pipe runs full and no longer flows as an open channel. The discharge written is the full-pipe discharge with the energy line parallel to the bed, which is its gravity capacity. Water standing higher upstream does not add discharge through this formula: it adds pressure, and the discharge must be computed as pressurised flow (sheet PI-07). Notice too that a full pipe carries LESS than a pipe filled to about 94 per cent.",
    luap: "Water spilling over the channel rim",
    luapNote:
      "The requested water level is above the lowest rim of the channel. Water above that rim is no longer inside this section: it spills sideways onto the floodplain or the road. The calculation is therefore cut off at the lowest rim, and the discharge written is the capacity of the section filled to the rim, not the discharge at the requested level. For floods that spill onto the floodplain, the section must be widened to include the floodplain, which usually gets its own roughness coefficient.",
    kurangTitik: "Not enough section coordinates",
    kurangTitikNote:
      "A natural section needs at least two coordinate points, ordered from the left bank to the right bank. Load the sample data or upload a coordinate file.",
    rcLuar: "The HY-04 rating is read outside its data range",
    rcDatum:
      "The rating is read at H equal to the depth y on this sheet. That is only right if the gauge zero used to build the rating sits exactly at the lowest point of this section; if not, the difference between them is a datum difference, not a formula difference.",
    rcNone:
      "No rating curve saved yet. Build it on sheet HY-04 and press \"use in HY-03\" to compare both discharges here.",
    note:
      "The Manning and Chezy formulas compute the discharge of UNIFORM FLOW, flow whose depth is the same along the channel because gravity pushing it is exactly balanced by bed and wall friction. Two assumptions come with them and are rarely stated. First, the slope entered is the slope of the energy line, which equals the bed slope only when the flow really is uniform; near a weir, a culvert, or a change of section the depth varies and these formulas do not hold. Second, the roughness coefficient is taken as constant over the whole section, whereas in a natural river a stony bed and a grassy floodplain differ widely. What is striking about the circular section: its discharge is not largest when full. Near the crown the wetted perimeter grows much faster than the area, so the hydraulic radius falls, and the peak discharge sits at about 94 per cent of the diameter.",
  },
} as const;

const REFS = {
  id: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill, bab 5 dan 6.",
    "Manning, R. (1891). On the flow of water in open channels and pipes. Transactions of the Institution of Civil Engineers of Ireland, vol. 20.",
    "Butler, D. & Davies, J.W. (2011). Urban Drainage, edisi ke-3. Spon Press, bab 9.",
    "Arcement, G.J. & Schneider, V.R. (1989). Guide for selecting Manning's roughness coefficients for natural channels and flood plains. USGS Water-Supply Paper 2339.",
  ],
  en: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill, Chapters 5 and 6.",
    "Manning, R. (1891). On the flow of water in open channels and pipes. Transactions of the Institution of Civil Engineers of Ireland, vol. 20.",
    "Butler, D. & Davies, J.W. (2011). Urban Drainage, 3rd edition. Spon Press, Chapter 9.",
    "Arcement, G.J. & Schneider, V.R. (1989). Guide for selecting Manning's roughness coefficients for natural channels and flood plains. USGS Water-Supply Paper 2339.",
  ],
} as const;

const SHAPES: SectionShape[] = ["lingkaran", "persegi", "alam"];

/** Bulatan setengah cincin dinding pipa, dari puncak ke dasar di satu sisi */
function setengahCincin(rr: number, t: number, sisi: 1 | -1): { x: number; z: number }[] {
  const n = 48;
  const luar: { x: number; z: number }[] = [];
  const dalam: { x: number; z: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const f = (Math.PI * i) / n;
    luar.push({ x: sisi * (rr + t) * Math.sin(f), z: rr + (rr + t) * Math.cos(f) });
    dalam.push({ x: sisi * rr * Math.sin(f), z: rr + rr * Math.cos(f) });
  }
  return [...luar, ...dalam.reverse()];
}

export function DebitPenampangClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [shape, setShape] = useState<SectionShape>("lingkaran");
  const [method, setMethod] = useState<"manning" | "chezy">("manning");
  const [D, setD] = useState(1);
  const [Wd, setWd] = useState(2);
  const [Hc, setHc] = useState(1.5);
  const [rows, setRows] = useState<Row[]>(rowsFromPts(SAMPLE_SECTION));
  const [H, setH] = useState(0.5);
  const [Spm, setSpm] = useState(1);
  const [n, setN] = useState(0.013);
  const [Cz, setCz] = useState(50);
  const [rc, setRc] = useState<RatingFit | null>(null);

  /* Lengkung dari HY-04, dibaca saat lembar dibuka dan tiap kali tab lain
     menyimpannya. */
  useEffect(() => {
    const baca = () => {
      try {
        const v = localStorage.getItem(RATING_STORAGE_KEY);
        setRc(v ? (JSON.parse(v) as RatingFit) : null);
      } catch {
        setRc(null);
      }
    };
    baca();
    window.addEventListener("storage", baca);
    return () => window.removeEventListener("storage", baca);
  }, []);

  const { pts } = ptsFromRows(rows);
  const kunciTitik = JSON.stringify(pts);
  const sec: SectionInput =
    shape === "lingkaran"
      ? { shape, D }
      : shape === "persegi"
        ? { shape, W: Wd, Hc }
        : { shape, pts };
  const res: Resistance = method === "manning" ? { method, n } : { method, C: Cz };
  const S = Spm / 1000;
  const cukup = shape !== "alam" || pts.length >= 2;
  const tinggi = sectionHeight(sec);

  const f = useMemo(
    () => sectionFlow(sec, H, S, res),
    [shape, D, Wd, Hc, kunciTitik, H, S, method, n, Cz] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const yMaks = useMemo(
    () => (shape === "lingkaran" && cukup ? maxDischargeDepth(sec, S, res) : null),
    [shape, D, S, method, n, Cz] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const qMaks = yMaks !== null ? sectionFlow(sec, yMaks, S, res).discharge : null;
  const cek = useMemo(
    () => (cukup ? checksSection(sec, H, S, res) : []),
    [shape, D, Wd, Hc, kunciTitik, H, S, method, n, Cz] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const qRc = rc ? ratingValue(rc, f.depth) : null;
  const rcLuar = rc !== null && (f.depth < rc.hMin || f.depth > rc.hMax);
  const hMaksSlider = Math.max(0.1, tinggi * 1.25);
  const langkahH = hMaksSlider > 4 ? 0.05 : 0.01;

  const ref = useCanvas(
    (ctx, w, ch) => {
      if (!cukup) {
        drawStructure(
          ctx,
          w,
          ch,
          {
            xMin: 0,
            xMax: 10,
            zMin: 0,
            zMax: 3,
            bodies: [],
            heading: x.kurangTitik,
            headingColor: C.signal,
            axisX: T.axAcrossSection,
            axisZ: T.axElevSection,
          },
          lang
        );
        return;
      }

      const bodies: StructureBody[] = [];
      const lines: StructureLine[] = [];
      const dims: StructureDim[] = [];
      let xMin = 0;
      let xMax = 1;
      let zMin = 0;
      let zMax = 1;
      /* Semua elevasi digambar dari titik terendah penampang, sama dengan
         kedalaman di penggeser. */
      let geser = 0;
      /* Absis ukuran kedalaman: di luar dinding, bukan di tepi air, supaya
         tulisannya tidak jatuh di atas arsiran dinding */
      let absisUkur = 0;

      if (shape === "lingkaran") {
        const rr = D / 2;
        const tb = Math.max(0.04, D * 0.08);
        bodies.push({ pts: setengahCincin(rr, tb, -1) }, { pts: setengahCincin(rr, tb, 1) });
        xMin = -rr - tb - D * 0.45;
        xMax = rr + tb + D * 0.45;
        zMin = -tb - D * 0.15;
        zMax = Math.max(D + tb, H) + D * 0.3;
        dims.push({ axis: "h", at: -tb, from: -rr, to: rr, text: `D ${fmtPlain(D, 2)} m`, offset: 24 });
        absisUkur = rr + tb;
      } else if (shape === "persegi") {
        const tb = Math.max(0.05, Math.max(Wd, Hc) * 0.06);
        const k = -Wd / 2;
        const ka = Wd / 2;
        bodies.push(
          { pts: [{ x: k - tb, z: Hc }, { x: k, z: Hc }, { x: k, z: 0 }, { x: k - tb, z: -tb }] },
          { pts: [{ x: ka, z: Hc }, { x: ka + tb, z: Hc }, { x: ka + tb, z: -tb }, { x: ka, z: 0 }] },
          { pts: [{ x: k - tb, z: -tb }, { x: k, z: 0 }, { x: ka, z: 0 }, { x: ka + tb, z: -tb }] }
        );
        const lebar = Wd + 2 * tb;
        xMin = -lebar / 2 - lebar * 0.3;
        xMax = lebar / 2 + lebar * 0.3;
        zMin = -tb - Hc * 0.2;
        zMax = Math.max(Hc, H) + Hc * 0.3;
        dims.push({ axis: "h", at: -tb, from: k, to: ka, text: `W ${fmtPlain(Wd, 2)} m`, offset: 24 });
        absisUkur = ka + tb;
      } else {
        geser = Math.min(...pts.map((p) => p.y));
        const xs = pts.map((p) => p.x);
        const zs = pts.map((p) => p.y - geser);
        const kaki = -Math.max(0.3, (Math.max(...zs) || 1) * 0.25);
        bodies.push({
          pts: [
            ...pts.map((p) => ({ x: p.x, z: p.y - geser })),
            { x: pts[pts.length - 1].x, z: kaki },
            { x: pts[0].x, z: kaki },
          ],
          hatch: "soil",
        });
        const lebar = Math.max(...xs) - Math.min(...xs) || 1;
        xMin = Math.min(...xs) - lebar * 0.08;
        xMax = Math.max(...xs) + lebar * 0.08;
        zMin = kaki;
        zMax = Math.max(...zs, H) + (Math.max(...zs) - kaki) * 0.3;
      }

      /* Air: satu genangan untuk tiap poligon basah */
      const waters: StructureWater[] = f.wetted.map((poly) => {
        const pz = poly.map((p) => ({ x: p.x, z: p.y - geser }));
        const kiri = pz[0];
        const kanan = pz[pz.length - 1];
        return {
          surface:
            Math.abs(kiri.x - kanan.x) < 1e-9
              ? [{ x: kiri.x - 1e-6, z: f.depth }, { x: kanan.x + 1e-6, z: f.depth }]
              : [{ x: kiri.x, z: f.depth }, { x: kanan.x, z: f.depth }],
          bed: pz.slice().reverse(),
        };
      });

      if (f.overtopped) {
        lines.push({
          pts: [
            { x: xMin, z: H },
            { x: xMax, z: H },
          ],
          color: C.signal,
          weight: W.thin,
          dash: DASH.invalid,
          label: T.requestedLevel,
          labelAt: 1,
          labelDy: -9,
          labelAlign: "right",
        });
      }

      if (f.depth > 0) {
        const kanan =
          shape === "alam" ? Math.max(...f.wetted.flat().map((p) => p.x)) : absisUkur;
        dims.push({
          axis: "v",
          at: kanan,
          from: 0,
          to: f.depth,
          text: `y ${fmtPlain(f.depth, 2)} m`,
          color: C.water,
          offset: 30,
        });
      }

      drawStructure(
        ctx,
        w,
        ch,
        {
          xMin,
          xMax,
          zMin,
          /* Ruang judul keadaan bila tampil */
          zMax: f.overtopped ? zMax + (zMax - zMin) * 0.15 : zMax,
          /* Penampang sungai digambar dengan skala tegak dilebihkan, seperti
             kebiasaan gambar potongan sungai: lebarnya belasan sampai ratusan
             meter sedangkan dalamnya beberapa meter. Pipa dan kotak tetap
             berskala sama supaya lingkarannya tetap bulat. */
          equalScale: shape !== "alam",
          bodies,
          waters,
          lines,
          dims,
          heading: f.overtopped ? (shape === "lingkaran" ? x.penuh : x.luap) : undefined,
          headingColor: C.signal,
          axisX: T.axAcrossSection,
          axisZ: T.axElevSection,
        },
        lang
      );
    },
    [shape, D, Wd, Hc, kunciTitik, H, S, method, n, Cz, lang]
  );

  const pilihBentuk = (s: SectionShape) => {
    setShape(s);
    if (s === "lingkaran") setH(Math.min(H, D * 0.5));
  };

  return (
    <LabShell
      sheet="HY-03"
      subject={SUBJECTS.HY[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Pada aliran seragam, <Term tint={C.ink}>gaya berat</Term> yang
            mendorong air tepat diimbangi <Term tint={C.energy}>gesekan</Term>{" "}
            dasar dan dinding. Debitnya ditentukan bentuk penampang lewat{" "}
            <Term tint={C.water}>jari-jari hidraulis</Term>, luas basah dibagi
            keliling basah.
          </p>
        ) : (
          <p>
            In uniform flow the <Term tint={C.ink}>weight</Term> driving the
            water is exactly balanced by bed and wall{" "}
            <Term tint={C.energy}>friction</Term>. The section shape sets the
            discharge through the <Term tint={C.water}>hydraulic radius</Term>,
            wetted area over wetted perimeter.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HY-03"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "A", value: cukup ? `${fmt(f.area, 3)} m²` : "—" },
            { label: "R", value: cukup ? `${fmt(f.radius, 3)} m` : "—" },
            { label: "V", value: cukup ? `${fmt(f.velocity, 2)} m/s` : "—" },
            {
              label: "Q",
              value: cukup ? `${fmt(f.discharge, 3)} m³/s` : "—",
              tint: f.overtopped ? C.signal : C.water,
            },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <PresetRow
              label={x.bentuk}
              active={SHAPES.indexOf(shape)}
              presets={[
                { label: x.sLingkaran, apply: () => pilihBentuk("lingkaran") },
                { label: x.sPersegi, apply: () => pilihBentuk("persegi") },
                { label: x.sAlam, apply: () => pilihBentuk("alam") },
              ]}
            />
            <div className="mt-2.5">
              <PresetRow
                label={x.rumus}
                active={method === "manning" ? 0 : 1}
                presets={[
                  { label: "Manning", apply: () => setMethod("manning") },
                  { label: "Chezy", apply: () => setMethod("chezy") },
                ]}
              />
            </div>
            <div className="mt-3.5">
              <InputTable>
                {shape === "lingkaran" && (
                  <InputRow symbol="D" label={x.dD} value={D} min={0.2} max={4} step={0.05} digits={2} unit="m" onChange={setD} />
                )}
                {shape === "persegi" && (
                  <>
                    <InputRow symbol="W" label={x.dW} value={Wd} min={0.3} max={20} step={0.1} digits={1} unit="m" onChange={setWd} />
                    <InputRow symbol="Hc" label={x.dHc} value={Hc} min={0.2} max={6} step={0.05} digits={2} unit="m" onChange={setHc} />
                  </>
                )}
                <InputRow
                  symbol="y"
                  label={x.dH}
                  value={H}
                  min={0.01}
                  max={Number(hMaksSlider.toFixed(2))}
                  step={langkahH}
                  digits={2}
                  unit="m"
                  onChange={setH}
                  tint={C.water}
                />
                <InputRow symbol="S" label={x.dS} value={Spm} min={0.05} max={50} step={0.05} digits={2} unit="‰" onChange={setSpm} />
                {method === "manning" ? (
                  <InputRow symbol="n" label={x.dN} value={n} min={0.009} max={0.08} step={0.001} digits={3} onChange={setN} tint={C.energy} />
                ) : (
                  <InputRow symbol="C" label={x.dC} value={Cz} min={10} max={100} step={1} digits={0} unit="m½/s" onChange={setCz} tint={C.energy} />
                )}
              </InputTable>
            </div>
            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pGorong, apply: () => { setShape("lingkaran"); setMethod("manning"); setD(1); setH(0.5); setSpm(1); setN(0.013); } },
                  { label: x.pBox, apply: () => { setShape("persegi"); setMethod("manning"); setWd(2); setHc(1.5); setH(0.8); setSpm(0.5); setN(0.015); } },
                  { label: x.pSungai, apply: () => { setShape("alam"); setMethod("manning"); setRows(rowsFromPts(SAMPLE_SECTION)); setH(1.5); setSpm(0.5); setN(0.035); } },
                ]}
              />
            </div>
          </Block>

          {shape === "alam" && (
            <Block heading={x.blkKoordinat}>
              <DataEntry rows={rows} onChange={setRows} headX={x.hX} headY={x.hY} sample={SAMPLE_SECTION} maxHeight="12rem" />
            </Block>
          )}

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              {!cukup ? (
                <Flag alert>{x.kurangTitik}</Flag>
              ) : (
                <>
                  <Flag tint={C.water} alert={f.overtopped}>
                    {`Q ${fmt(f.discharge, 3)} m³/s`}
                  </Flag>
                  {f.overtopped && <Flag alert>{shape === "lingkaran" ? x.penuh : x.luap}</Flag>}
                </>
              )}
            </div>
            {!cukup && (
              <div className="mb-2.5">
                <Note>{x.kurangTitikNote}</Note>
              </div>
            )}
            {f.overtopped && (
              <div className="mb-2.5">
                <Note>{shape === "lingkaran" ? x.penuhNote : x.luapNote}</Note>
              </div>
            )}
            {cukup && (
              <ResultTable
                rows={[
                  { symbol: "Q", label: x.rQ, value: fmt(f.discharge, 4), unit: "m³/s", tint: f.overtopped ? C.signal : C.water, strong: true },
                  { symbol: "V", label: x.rV, value: fmt(f.velocity, 3), unit: "m/s" },
                  { symbol: "A", label: x.rA, value: fmt(f.area, 4), unit: "m²" },
                  { symbol: "P", label: x.rP, value: fmt(f.perimeter, 4), unit: "m" },
                  { symbol: "R", label: x.rR, value: fmt(f.radius, 4), unit: "m", tint: C.water },
                  { symbol: "T", label: x.rT, value: fmt(f.topWidth, 3), unit: "m" },
                  { symbol: "Fr", label: x.rFr, value: fmt(f.froude, 3), tint: C.critical },
                  ...(qMaks !== null && yMaks !== null
                    ? [{ symbol: "Qmaks", label: `${x.rQmaks}, ${x.rYmaks} ${fmt(yMaks, 3)} m`, value: fmt(qMaks, 4), unit: "m³/s" }]
                    : []),
                ]}
              />
            )}
          </Block>

          <Block heading="HY-04">
            {rc && qRc !== null ? (
              <>
                {rcLuar && (
                  <div className="mb-2.5">
                    <Flag tint={C.critical}>{x.rcLuar}</Flag>
                  </div>
                )}
                <ResultTable
                  rows={[
                    { symbol: "Qrc", label: x.rQrc, value: fmt(qRc, 4), unit: "m³/s", tint: rcLuar ? C.critical : C.water, strong: true },
                    {
                      symbol: "Δ",
                      label: x.rSelisih,
                      value: f.discharge > 0 ? fmt(((qRc - f.discharge) / f.discharge) * 100, 1) : "—",
                      unit: f.discharge > 0 ? "%" : undefined,
                    },
                  ]}
                />
                <div className="mt-2.5">
                  <Note>{x.rcDatum}</Note>
                </div>
              </>
            ) : (
              <Note>{x.rcNone}</Note>
            )}
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(sec, S, res, cukup, lang)}</Note>
          </Block>
        </>
      }
      verification={cukup ? <Verification checks={cek} /> : undefined}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>V =</span>
                <Frac num="1" den="n" />
                <span>R^(2/3) S^(1/2)</span>
                <span className="ml-5">V = C (R S)^(1/2)</span>
              </Eq>
              <Eq>
                <span>R =</span>
                <Frac num="A" den="P" />
                <span className="ml-5">Q = V A</span>
                <span className="ml-5">Fr =</span>
                <Frac num="V" den="√(g A / T)" />
              </Eq>
              <Eq>
                <span>
                  {lang === "id"
                    ? "lingkaran: θ = 2 arccos(1 − 2y/D), A = D²(θ − sin θ)/8, P = Dθ/2"
                    : "circle: θ = 2 arccos(1 − 2y/D), A = D²(θ − sin θ)/8, P = Dθ/2"}
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

function notice(sec: SectionInput, S: number, res: Resistance, cukup: boolean, lang: Lang): string {
  if (!cukup)
    return lang === "id"
      ? "Begitu koordinat penampangnya lengkap, lembar ini menunjukkan di sini seberapa jauh debit berubah bila kekasarannya salah taksir."
      : "Once the section coordinates are complete, this sheet shows here how far the discharge moves if the roughness is misjudged.";
  const tinggi = sectionHeight(sec);
  const y = tinggi * 0.6;
  const q = sectionFlow(sec, y, S, res).discharge;
  const kasar: Resistance =
    res.method === "manning" ? { method: "manning", n: res.n * 1.2 } : { method: "chezy", C: res.C / 1.2 };
  const q2 = sectionFlow(sec, y, S, kasar).discharge;
  const turun = q > 0 ? ((q - q2) / q) * 100 : 0;
  if (lang === "en")
    return `At 60 per cent of the section height (${fmt(y, 2)} m) this section carries ${fmt(q, 3)} m³/s. Make the channel 20 per cent rougher, a difference well inside what two engineers reading the same photograph would choose, and the discharge drops by ${fmt(turun, 0)} per cent to ${fmt(q2, 3)} m³/s. The roughness coefficient is usually the least certain number on this sheet and the one that moves the answer the most, which is why a discharge computed this way should be checked against a measured rating curve whenever one exists.`;
  return `Pada 60 persen tinggi penampangnya (${fmt(y, 2)} m) penampang ini mengalirkan ${fmt(q, 3)} m³/s. Buat salurannya 20 persen lebih kasar, selisih yang masih wajar di antara dua insinyur yang membaca foto yang sama, dan debitnya turun ${fmt(turun, 0)} persen menjadi ${fmt(q2, 3)} m³/s. Koefisien kekasaran biasanya bilangan yang paling tidak pasti di lembar ini sekaligus yang paling menggeser jawabannya, dan itu sebabnya debit hitungan seperti ini perlu dibandingkan dengan lengkung debit hasil ukur bila ada.`;
}
