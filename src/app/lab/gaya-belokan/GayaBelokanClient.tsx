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
  type StructureBody,
  type StructureVector,
} from "@/lib/drawStructure";
import { fmt, fmtPlain, momentumForce } from "@/lib/hydraulics";
import { C } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksMomentum } from "@/lib/checks";

/** Berat jenis beton, kN/m³. */
const GAMMA_BETON = 24;
/** Koefisien gesekan beton terhadap tanah, tanpa satuan. */
const MU = 0.45;
/** Tinggi blok angkur yang dipakai, meter. Tetap, supaya lebarnya yang bicara. */
const TINGGI_BLOK = 1.2;
/** Lebar muka tumpu yang masih pantas dibuat sebagai blok tunggal, meter. */
const LEBAR_WAJAR = 6;

const TXT = {
  id: {
    title: "Gaya pada belokan pipa",
    sheetTitle: "Blok angkur pada belokan pipa tekan, dilihat dari atas",
    dQ: "Debit",
    dD: "Garis tengah pipa",
    dH: "Tinggi tekan uji",
    dSudut: "Sudut belokan",
    dQt: "Daya dukung tanah yang diizinkan",
    pBiasa: "Belokan siku pada pipa induk",
    pBalik: "Belokan berbalik arah",
    pLembek: "Tanah lembek, daya dukung kecil",
    rR: "Resultan gaya pada belokan",
    rArah: "Arah resultan terhadap aliran masuk",
    rLuas: "Luas muka tumpu yang dibutuhkan",
    rLebar: "Lebar blok pada tinggi 1,2 m",
    rBerat: "Berat blok bila hanya mengandalkan gesekan",
    rVolume: "Volume beton bila hanya mengandalkan gesekan",
    rBagi: "Bagian resultan yang berasal dari tekanan",
    wajar: "Blok angkur tunggal masih memadai",
    takWajar: "Blok tunggal terlalu besar untuk dibuat",
    takAda: "Pipa lurus, tidak ada gaya belokan",
    labelBlok: "blok angkur",
    labelGaya: "resultan",
    takWajarNote:
      "Lebar muka tumpu yang dituntut sudah melewati enam meter, dan blok beton selebar itu bukan lagi pekerjaan biasa: penggaliannya memotong pipa lain, betonnya menyusut tidak merata, dan tanah di belakangnya harus dipadatkan ulang seluruhnya. Pada keadaan seperti ini belokan tidak diangkur, melainkan ditahan sendiri oleh pipanya dengan sambungan terkunci sepanjang beberapa puluh meter ke kedua arah, sehingga gaya belokannya dilawan gesekan tanah di sepanjang pipa itu, bukan dilawan satu blok di satu titik.",
    note:
      "Angka yang paling sering mengejutkan pada lembar ini adalah bagian tekanannya. Pada pipa air kota yang biasa, sembilan puluh tujuh sampai sembilan puluh sembilan persen gaya belokannya berasal dari tekanan dan hanya sisanya dari momentum air yang bergerak. Akibatnya sederhana dan sering dilupakan: blok angkur dirancang untuk tekanan uji, bukan untuk tekanan kerja, dan sama sekali bukan untuk debit. Pipa yang sedang diuji tekan dengan airnya diam menuntut angkur yang hampir sama besarnya dengan pipa yang mengalir penuh, dan justru uji tekanlah yang biasanya menjadi keadaan paling berat sepanjang umur pipa, karena tekanan ujinya memang sengaja dibuat lebih tinggi daripada tekanan kerjanya. Dua kesalahan yang lahir dari lupa ini sama-sama mahal. Yang pertama merancang angkur dari debit puncak dan mendapati blok bergeser saat uji tekan pertama, sebelum satu tetes air pun dialirkan kepada pelanggan. Yang kedua menambah ukuran blok setiap kali debitnya dinaikkan, padahal yang menentukan tidak pernah berubah.",
  },
  en: {
    title: "Pipe bend force",
    sheetTitle: "Thrust block at a pressure-pipe bend, seen from above",
    dQ: "Discharge",
    dD: "Pipe diameter",
    dH: "Test pressure head",
    dSudut: "Bend angle",
    dQt: "Allowable soil bearing pressure",
    pBiasa: "Right-angle bend on a trunk main",
    pBalik: "Bend reversing the flow",
    pLembek: "Soft ground, low bearing pressure",
    rR: "Resultant force at the bend",
    rArah: "Direction of the resultant from the inflow",
    rLuas: "Bearing area required",
    rLebar: "Block width at a height of 1.2 m",
    rBerat: "Block weight if friction alone is relied on",
    rVolume: "Concrete volume if friction alone is relied on",
    rBagi: "Share of the resultant coming from pressure",
    wajar: "A single thrust block is still adequate",
    takWajar: "A single block is too large to build",
    takAda: "Straight pipe, no bend force at all",
    labelBlok: "thrust block",
    labelGaya: "resultant",
    takWajarNote:
      "The bearing width demanded has passed six metres, and a concrete block that wide is no longer ordinary work: its excavation cuts across other pipes, its concrete shrinks unevenly, and the ground behind it must be recompacted in full. In a case like this the bend is not anchored at all but restrained by the pipe itself, with locked joints running some tens of metres each way, so that the thrust is carried by soil friction along that length of pipe rather than by one block at one point.",
    note:
      "The number that most often surprises on this sheet is the pressure share. On an ordinary city water main, ninety-seven to ninety-nine per cent of the bend force comes from pressure and only the remainder from the momentum of moving water. The consequence is simple and often forgotten: a thrust block is designed for the test pressure, not the working pressure, and not at all for the discharge. A pipe under a pressure test with its water standing still demands very nearly the same anchor as one flowing full, and it is the pressure test that is usually the severest condition of the pipe's whole life, since the test pressure is deliberately set above the working pressure. Two mistakes are born of forgetting this, and both are expensive. The first designs the anchor from the peak discharge and finds the block sliding during the first pressure test, before a drop of water has reached a customer. The second enlarges the block every time the discharge is raised, although what decides it never changed.",
  },
} as const;

const REFS = {
  id: [
    "AWWA (2017). M11 Steel Water Pipe: A Guide for Design and Installation, edisi ke-5.",
    "Ductile Iron Pipe Research Association (2016). Thrust Restraint Design for Ductile Iron Pipe, edisi ke-7.",
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, edisi ke-8, bab 3.",
    "Terzaghi, K., Peck, R.B. & Mesri, G. (1996). Soil Mechanics in Engineering Practice, edisi ke-3.",
  ],
  en: [
    "AWWA (2017). M11 Steel Water Pipe: A Guide for Design and Installation, 5th ed.",
    "Ductile Iron Pipe Research Association (2016). Thrust Restraint Design for Ductile Iron Pipe, 7th ed.",
    "Streeter, V.L. & Wylie, E.B. (1985). Fluid Mechanics, 8th ed., ch. 3.",
    "Terzaghi, K., Peck, R.B. & Mesri, G. (1996). Soil Mechanics in Engineering Practice, 3rd ed.",
  ],
} as const;

export function GayaBelokanClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Q, setQ] = useState(0.4);
  const [D, setD] = useState(0.4);
  const [head, setHead] = useState(90);
  const [sudut, setSudut] = useState(90);
  const [qTanah, setQTanah] = useState(150);

  const r = momentumForce(Q, D, D, head, sudut);
  const R = r.resultant;
  /* Daya dukung diberikan dalam kPa, gayanya dalam newton. */
  const luasTumpu = qTanah > 0 ? R / 1000 / qTanah : Infinity;
  const lebarBlok = luasTumpu / TINGGI_BLOK;
  const beratGesek = R / 1000 / MU;
  const volumeGesek = beratGesek / GAMMA_BETON;
  /*
   * Belokan bersudut nol pada penampang tetap tidak menghasilkan gaya sama
   * sekali, karena yang masuk dan yang keluar persis sama besar dan searah.
   * Di situ tidak ada blok angkur yang perlu dirancang, dan menggambar blok
   * selebar nol beserta panah sepanjang nol hanya akan menyesatkan.
   */
  const adaGaya = R > 1;
  const wajar = !adaGaya || (Number.isFinite(lebarBlok) && lebarBlok <= LEBAR_WAJAR);

  const ref = useCanvas(
    (ctx, w, ch) => {
      const panjang = D * 3.4;
      const pipa = bendPlan(D, D, sudut, panjang, panjang);
      /*
       * Bloknya diletakkan di belakang TITIK TENGAH BUSUR belokannya, bukan
       * di belakang titik asal bidangnya. Pada belokan bersudut besar titik
       * asal itu sudah jauh di depan belokannya, dan blok yang diletakkan di
       * sana akan tergambar menempel pada ruas masuknya, bukan pada
       * belokannya.
       */
      const busur = bendGeometry(D, D, sudut / 2, 0);

      /* Blok angkur diletakkan di belakang belokan, mukanya tegak lurus
         resultannya. Lebarnya lebar sungguhan, jadi blok yang tidak masuk
         akal akan terlihat tidak masuk akal. */
      const besar = Math.hypot(r.Fx, r.Fy);
      const ex = besar > 0 ? r.Fx / besar : 1;
      const ey = besar > 0 ? r.Fy / besar : 0;
      /* Tegak lurusnya, dipakai sebagai lebar muka tumpu. */
      const nx = -ey;
      const ny = ex;
      const setengah = Math.min(lebarBlok, LEBAR_WAJAR * 2.5) / 2;
      const tebal = Math.max(D * 0.8, 0.4);
      const jauh = D * 1.1;

      const muka = {
        x: busur.outlet.x + ex * jauh,
        z: busur.outlet.z + ey * jauh,
      };
      const belakang = {
        x: busur.outlet.x + ex * (jauh + tebal),
        z: busur.outlet.z + ey * (jauh + tebal),
      };
      const blok: StructureBody = {
        pts: [
          { x: muka.x + nx * setengah, z: muka.z + ny * setengah },
          { x: belakang.x + nx * setengah, z: belakang.z + ny * setengah },
          { x: belakang.x - nx * setengah, z: belakang.z - ny * setengah },
          { x: muka.x - nx * setengah, z: muka.z - ny * setengah },
        ],
        hatch: "concrete",
        hatched: true,
      };

      const panah: StructureVector[] = adaGaya
        ? [
            {
              x: busur.outlet.x,
              z: busur.outlet.z,
              dx: ex * 70,
              dy: -ey * 70,
              text: `${x.labelGaya} ${fmtPlain(R / 1000, 1)} kN`,
              color: C.energy,
              root: true,
            },
          ]
        : [];

      const semua = [...pipa, ...blok.pts];
      const xs = semua.map((p) => p.x);
      const zs = semua.map((p) => p.z);
      const margin = Math.max(D, 0.4);
      drawStructure(
        ctx,
        w,
        ch,
        {
          xMin: Math.min(...xs) - margin,
          xMax: Math.max(...xs) + margin,
          zMin: Math.min(...zs) - margin,
          zMax: Math.max(...zs) + margin,
          bodies: adaGaya
            ? [{ pts: pipa, hatch: "none", outline: true }, blok]
            : [{ pts: pipa, hatch: "none", outline: true }],
          vectors: panah,
          callouts: adaGaya
            ? [
                {
                  /*
                   * Nama blok ditunjukkan dari salah satu UJUNG muka
                   * belakangnya, menjulur ke kiri bawah. Dari tengah muka
                   * belakang ia jatuh tepat di ujung panah resultan, dan
                   * nama resultan menimpanya sampai tak terbaca.
                   */
                  x: belakang.x - nx * setengah,
                  z: belakang.z - ny * setengah,
                  dx: -20,
                  dy: 18,
                  text: x.labelBlok,
                },
              ]
            : [],
          heading: !adaGaya ? x.takAda : wajar ? undefined : x.takWajar,
          headingColor: adaGaya ? C.signal : C.ink2,
          axisX: T.planView,
          axisZ: T.planView,
        },
        lang
      );
    },
    [Q, D, head, sudut, qTanah, lang]
  );

  return (
    <LabShell
      sheet="PI-05"
      subject={SUBJECTS.PI[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Hampir seluruh gaya belokan berasal dari{" "}
            <Term tint={C.energy}>tekanan</Term>, bukan dari air yang bergerak.
            Blok angkurnya karena itu ditentukan{" "}
            <Term tint={C.critical}>tekanan uji</Term>, bukan debitnya.
          </p>
        ) : (
          <p>
            Almost all of the bend force comes from{" "}
            <Term tint={C.energy}>pressure</Term>, not from moving water. The
            thrust block is therefore sized by the{" "}
            <Term tint={C.critical}>test pressure</Term>, not by the discharge.
          </p>
        )
      }
      drawing={
        <Sheet
          number="PI-05"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (kN, m, kPa)" },
            { label: "R", value: `${fmt(R / 1000, 1)} kN`, tint: C.energy },
            { label: "A", value: `${fmt(luasTumpu, 2)} m²` },
            {
              label: "b",
              value: `${fmt(lebarBlok, 2)} m`,
              tint: wajar ? undefined : C.signal,
            },
            { label: "pA/R", value: adaGaya ? `${fmt(r.pressureShare * 100, 1)} %` : "—" },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q * 1000} min={0} max={2000} step={10} digits={0} unit="l/s" onChange={(v) => setQ(v / 1000)} tint={C.water} />
              <InputRow symbol="D" label={x.dD} value={D * 1000} min={100} max={1200} step={25} digits={0} unit="mm" onChange={(v) => setD(v / 1000)} />
              <InputRow symbol="h" label={x.dH} value={head} min={0} max={200} step={5} digits={0} unit="m" onChange={setHead} tint={C.energy} />
              <InputRow symbol="θ" label={x.dSudut} value={sudut} min={0} max={180} step={5} digits={0} unit="°" onChange={setSudut} />
              <InputRow symbol="q" label={x.dQt} value={qTanah} min={25} max={500} step={5} digits={0} unit="kPa" onChange={setQTanah} tint={C.critical} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pBiasa, apply: () => { setQ(0.4); setD(0.4); setHead(90); setSudut(90); setQTanah(150); } },
                  { label: x.pBalik, apply: () => { setQ(0.4); setD(0.4); setHead(90); setSudut(180); setQTanah(150); } },
                  { label: x.pLembek, apply: () => { setQ(0.4); setD(0.4); setHead(90); setSudut(90); setQTanah(35); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5">
              <Flag
                tint={!adaGaya ? C.ink2 : wajar ? C.water : undefined}
                alert={!wajar}
              >
                {!adaGaya ? x.takAda : wajar ? x.wajar : x.takWajar}
              </Flag>
            </div>
            {adaGaya && !wajar && (
              <div className="mb-2.5">
                <Note>{x.takWajarNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "R", label: x.rR, value: fmt(R / 1000, 2), unit: "kN", tint: C.energy, strong: true },
                { symbol: "α", label: x.rArah, value: fmt(r.direction, 1), unit: "°" },
                { symbol: "A", label: x.rLuas, value: fmt(luasTumpu, 3), unit: "m²", strong: true },
                { symbol: "b", label: x.rLebar, value: fmt(lebarBlok, 3), unit: "m", tint: wajar ? undefined : C.signal, strong: true },
                { symbol: "W", label: x.rBerat, value: fmt(beratGesek, 1), unit: "kN" },
                { symbol: "V", label: x.rVolume, value: fmt(volumeGesek, 2), unit: "m³" },
                { symbol: "—", label: x.rBagi, value: adaGaya ? fmt(r.pressureShare * 100, 2) : "—", unit: adaGaya ? "%" : undefined },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(Q, D, head, sudut, qTanah, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksMomentum(Q, D, D, head, sudut)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>R = 2(pA + ρQV) sin</span>
                <Frac num="θ" den="2" />
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "pada belokan berpenampang tetap"
                    : "for a bend of constant section"}
                </span>
              </Eq>
              <Eq>
                <span>A =</span>
                <Frac num="R" den="q" />
                <span className="ml-5">W =</span>
                <Frac num="R" den="μ" />
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? `μ = ${fmtPlain(MU, 2)} beton terhadap tanah, γ = ${fmtPlain(GAMMA_BETON, 0)} kN/m³`
                    : `μ = ${fmtPlain(MU, 2)} concrete on soil, γ = ${fmtPlain(GAMMA_BETON, 0)} kN/m³`}
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
  D: number,
  head: number,
  sudut: number,
  qTanah: number,
  lang: Lang
): string {
  const a = momentumForce(Q, D, D, head, sudut);
  const diam = momentumForce(0, D, D, head, sudut);
  const luas = (R: number) => (qTanah > 0 ? R / 1000 / qTanah : Infinity);

  if (lang === "en")
    return `The bend carries ${fmt(a.resultant / 1000, 1)} kilonewtons and needs ${fmt(luas(a.resultant), 2)} square metres of bearing face. Drag the discharge all the way down to zero, leaving the pressure untouched, and the force settles at ${fmt(diam.resultant / 1000, 1)} kilonewtons and the face at ${fmt(luas(diam.resultant), 2)} square metres. That is the whole of the design condition reached with the water standing perfectly still. Then drag the test head instead and watch both numbers move proportionally, because pressure force is pA and nothing else.`;
  return `Belokan ini memikul ${fmt(a.resultant / 1000, 1)} kilonewton dan menuntut muka tumpu seluas ${fmt(luas(a.resultant), 2)} meter persegi. Tarik debitnya sampai nol sama sekali, tanpa menyentuh tekanannya, dan gayanya menetap di ${fmt(diam.resultant / 1000, 1)} kilonewton dengan muka tumpu ${fmt(luas(diam.resultant), 2)} meter persegi. Itulah seluruh keadaan rancangannya, tercapai dengan air yang diam sempurna. Lalu tarik tinggi tekan ujinya dan perhatikan kedua angka itu bergerak sebanding, karena gaya tekanan memang pA dan bukan yang lain.`;
}
