"use client";

import { useMemo, useRef, useState } from "react";
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
import { usePlate, usePutar } from "@/lib/usePlate";
import {
  createReachMotion,
  drawReachMotion,
  reachFlow,
  reachTimeScale,
  type ReachMotion,
  type ReachStation,
} from "@/lib/drawReachMotion";
import {
  drawReach,
  type ReachMarker,
  type ReachPoint,
  type ReachRegion,
  type ReachSeries,
} from "@/lib/drawReach";
import {
  G,
  criticalDepth,
  fmt,
  fmtPlain,
  frictionSlope,
  sideChannelProfile,
  type TroughResult,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksSideChannel } from "@/lib/checks";

const TXT = {
  id: {
    title: "Pelimpah samping",
    sheetTitle: "Saluran pengumpul pelimpah samping — metode beda hingga Hinds",
    dQ: "Debit banjir rancangan",
    db: "Lebar dasar saluran pengumpul",
    dn: "Kekasaran Manning",
    dS: "Kemiringan dasar saluran pengumpul",
    dL: "Panjang mercu pelimpah",
    dz: "Tinggi mercu di atas dasar ujung keluar",
    pKecil: "Bendungan urukan kecil",
    pBesar: "Bendungan besar",
    pSempit: "Saluran terlalu sempit",
    rQ: "Debit di ujung keluar",
    rYc: "Kedalaman kritis di ujung keluar",
    rYmax: "Kedalaman terbesar di saluran pengumpul",
    rRise: "Kenaikan muka air ke arah pangkal",
    rFree: "Jagaan terhadap mercu",
    rDrop: "Penurunan dasar sepanjang saluran",
    rQstar: "Limpasan per satuan panjang mercu",
    tenggelam: "Mercu tenggelam",
    tenggelamNote:
      "Muka air di dalam saluran pengumpul naik sampai melewati elevasi mercu. Bila itu terjadi, pelimpahnya tidak lagi bekerja sebagai ambang bebas: debit yang lewat berkurang, dan seluruh perhitungan kapasitas pelimpah yang mengandaikan aliran bebas menjadi tidak berlaku. Perdalam saluran pengumpul dengan menaikkan mercu, perlebar dasarnya, atau perpanjang mercunya supaya limpasan per satuan panjang berkurang.",
    superkritis: "Aliran superkritis di bagian hulu",
    superkritisNote:
      "Dari titik yang ditandai ke arah pangkal, aliran di saluran pengumpul menjadi superkritis. Kendali di ujung keluar tidak lagi menjangkau bagian itu, jadi muka airnya tidak digambar dan kedalaman di pangkal, kenaikan, serta jagaan tidak dilaporkan. Di dalam saluran akan terbentuk loncatan air yang mengganggu pola aliran menuju saluran peluncur, sehingga rancangan seperti ini dihindari. Landaikan dasar saluran pengumpul atau perbesar lebarnya sampai seluruh salurannya subkritis.",
    mustahil: "Mercu di bawah dasar pangkal",
    mustahilNote:
      "Dasar saluran pengumpul naik S₀L ke arah pangkal, dan pada setelan ini dasar pangkal sudah lebih tinggi daripada mercu pelimpahnya. Bangunan seperti ini tidak dapat dibuat: mercu harus berdiri di atas dasar saluran di sepanjang sisinya. Jagaan karena itu ditulis “—”. Naikkan mercu, landaikan dasar, atau perpendek salurannya.",
    bebas: "Ambang bebas",
    bandTenggelam: "Mercu tenggelam",
    bandSuper: "Superkritis, profil tidak dihitung",
    hQ: "Limpasan per meter dan kedalaman kritis di ujung keluar",
    hHinds: "Langkah Hinds pertama, dari ujung keluar ke hulu sejauh Δx",
    hHf: "kehilangan gesek hf",
    hWs: "Muka air di pangkal terhadap ujung keluar",
    hYmax: "Kedalaman terbesar",
    hDz: "Penurunan dasar dan jagaan",
    hSuper: "aliran superkritis mulai",
    hSuperSeluruh: "seluruh saluran pengumpul superkritis",
    hMustahil: "z_m ≤ S₀L: mercu di bawah dasar pangkal",
    dariPangkal: "m dari pangkal",
    curam:
      "Curamkan dasar: kedalaman di pangkal berkurang, tetapi dasar pangkal naik S₀L, jadi muka air di pangkal ikut naik dan jagaan menyusut.",
    exagg: "pelebihan tegak",
    motion: (n: string) => `partikel bergerak dengan V = Q(x)/A, lahir merata di sepanjang mercu, fluks sebanding Q(x), waktu dipercepat ×${n}`,
    motionReal: "partikel bergerak dengan V = Q(x)/A, lahir merata di sepanjang mercu, fluks sebanding Q(x), waktu nyata",
    note:
      "Yang dipakai di sini bentuk beda hingga dari persamaan momentum, bukan bentuk diferensial, dan itu bukan pilihan gaya melainkan keharusan. Kendali saluran pengumpul berada tepat pada kondisi kritis di ujung keluarnya, dan di titik itu bentuk diferensial membagi dengan satu dikurangi kuadrat bilangan Froude yang menuju nol, sehingga penelusuran meledak pada langkah pertama. Bentuk beda hingga tidak pernah membagi dengan suku itu. Bentuk yang dipakai juga sudah dirapikan supaya tidak membagi dengan debit di hulu, sehingga pangkal saluran yang debitnya nol tetap dapat dihitung. Yang membuat saluran pengumpul dalam bukan gesekan melainkan momentum: air yang jatuh dari mercu masuk tegak lurus terhadap arah saluran dan harus dibelokkan serta dipercepat oleh aliran yang sudah ada di bawahnya. Biaya itu diambil dari tinggi tekan, dan hasilnya muka air yang justru naik ke arah pangkal walaupun dasarnya juga naik ke arah itu. Karena kedua permukaan naik bersamaan, kedalaman di pangkal tidak sebesar kenaikan muka airnya, dan itulah yang membuat pembacaan sepintas pada gambar mudah keliru.",
  },
  en: {
    title: "Side-channel spillway",
    sheetTitle: "Side-channel collector trough — Hinds finite-difference method",
    dQ: "Design flood discharge",
    db: "Trough bed width",
    dn: "Manning roughness",
    dS: "Trough bed slope",
    dL: "Spillway crest length",
    dz: "Crest height above the outlet bed",
    pKecil: "Small embankment dam",
    pBesar: "Large dam",
    pSempit: "Trough too narrow",
    rQ: "Discharge at the outlet",
    rYc: "Critical depth at the outlet",
    rYmax: "Greatest depth in the trough",
    rRise: "Rise in water level toward the head",
    rFree: "Freeboard below the crest",
    rDrop: "Bed drop along the trough",
    rQstar: "Overflow per unit length of crest",
    tenggelam: "Crest submerged",
    tenggelamNote:
      "The water surface inside the trough rises past the crest elevation. When that happens the spillway no longer acts as a free weir: the discharge passing drops, and every capacity calculation that assumed free flow stops being valid. Deepen the trough by raising the crest, widen the bed, or lengthen the crest so that the overflow per unit length falls.",
    superkritis: "Supercritical flow in the upper part",
    superkritisNote:
      "From the marked point toward the head, flow in the collector becomes supercritical. The control at the outlet no longer reaches that part, so its water surface is not drawn and the head depth, rise, and freeboard are not reported. A hydraulic jump would form inside the trough and disturb the flow into the chute, so such a design is avoided. Flatten the trough or widen it until the whole channel is subcritical.",
    mustahil: "Crest below the trough bed at the head",
    mustahilNote:
      "The trough bed rises by S₀L toward the head, and at this setting the bed at the head already stands above the spillway crest. Such a structure cannot be built: the crest has to stand above the trough bed along its whole side. The freeboard is therefore shown as “—”. Raise the crest, flatten the bed, or shorten the trough.",
    bebas: "Free weir",
    bandTenggelam: "Crest submerged",
    bandSuper: "Supercritical, profile not computed",
    hQ: "Overflow per metre and critical depth at the outlet",
    hHinds: "First Hinds step, from the outlet upstream by Δx",
    hHf: "friction loss hf",
    hWs: "Water level at the head relative to the outlet",
    hYmax: "Greatest depth",
    hDz: "Bed drop and freeboard",
    hSuper: "supercritical flow begins",
    hSuperSeluruh: "the whole collector trough is supercritical",
    hMustahil: "z_m ≤ S₀L: crest below the trough bed at the head",
    dariPangkal: "m from the head",
    curam:
      "Steepen the trough: the head depth falls, but the head bed rises by S₀L, so the head water level rises too and the freeboard shrinks.",
    exagg: "vertical exaggeration",
    motion: (n: string) => `particles move at V = Q(x)/A, born uniformly along the crest, flux in proportion to Q(x), time sped up ×${n}`,
    motionReal: "particles move at V = Q(x)/A, born uniformly along the crest, flux in proportion to Q(x), real time",
    note:
      "What is used here is the finite-difference form of the momentum equation rather than the differential form, and that is not a matter of style but a necessity. The control of a collector trough sits exactly at critical conditions at its outlet, and there the differential form divides by one minus the square of the Froude number, which tends to zero, so the traverse explodes on the first step. The finite-difference form never divides by that term. The form used has also been rearranged so that it does not divide by the upstream discharge, which keeps the head of the trough, where the discharge is zero, computable. What makes a collector trough deep is not friction but momentum: water falling off the crest enters at right angles to the channel and has to be turned and accelerated by the flow already beneath it. That cost is taken from head, and the result is a water surface that rises toward the head even though the bed rises that way too. Because both surfaces rise together, the depth at the head is smaller than the rise in level, and that is what makes a quick reading of the drawing easy to get wrong.",
  },
} as const;

const REFS = {
  id: [
    "Hinds, J. (1926). Side channel spillways. Transactions ASCE, vol. 89.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Bab 12, saluran pengumpul pelimpah samping.",
    "USBR (1987). Design of Small Dams, edisi ke-3, bab pelimpah saluran samping.",
    "Li, W.H. (1955). Open channels with non-uniform discharge. Transactions ASCE, vol. 120.",
  ],
  en: [
    "Hinds, J. (1926). Side channel spillways. Transactions ASCE, vol. 89.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Chapter 12, side-channel spillway troughs.",
    "USBR (1987). Design of Small Dams, 3rd ed., chapter on side-channel spillways.",
    "Li, W.H. (1955). Open channels with non-uniform discharge. Transactions ASCE, vol. 120.",
  ],
} as const;

export function PelimpahSampingClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [Q, setQ] = useState(50);
  const [b, setB] = useState(6);
  const [n, setN] = useState(0.014);
  const [S0, setS0] = useState(0.005);
  const [L, setL] = useState(60);
  const [zCrest, setZCrest] = useState(4.5);

  const r = sideChannelProfile(Q, b, n, S0, L);
  // Bila bagian hulu superkritis, titik pertama bukan pangkal saluran dan
  // semua besaran yang dibaca darinya tidak berarti. Yang dilaporkan cuma
  // yang memang dihitung.
  const terpotong = r.supercriticalFrom !== null;
  const pangkal = r.points[0];
  const jagaan = zCrest - pangkal.ws;
  /* Geometri mustahil: dasar pangkal (S₀L di atas dasar ujung keluar)
     sudah setinggi atau lebih tinggi daripada mercu. Dulu lolos dan
     terbaca "mercu tenggelam" (Q 2, b 1, n 0,030, S₀ 40 ‰, L 60, z_m 1,0). */
  const mustahil = !terpotong && zCrest <= S0 * L;
  const tenggelam = !terpotong && !mustahil && jagaan < 0;
  const takAda = "—";
  const kartu = keadaan(r, S0, L, jagaan, mustahil, x, lang);
  const fSah = !terpotong && !mustahil;

  /*
   * Lapis gerak: partikel bergerak dengan V = Q(x)/(b·y) dari profil Hinds.
   * Debit di pangkal nol, jadi semua partikel lahir di sepanjang saluran
   * dengan kerapatan yang membuat jumlah yang lewat penampang x per detik
   * sebanding Q(x) (drawReachMotion). Hanya bila profilnya berlaku: hulu
   * superkritis, geometri mustahil, atau mercu tenggelam tidak digerakkan.
   */
  const { playing, toggle: togglePutar } = usePutar();
  const gerak = useRef<ReachMotion | null>(null);
  if (gerak.current === null) gerak.current = createReachMotion(170);
  const berlaku = fSah && !tenggelam;
  const aliran = useMemo(() => {
    if (!berlaku) return null;
    const air: ReachPoint[] = r.points.map((p) => ({ x: p.x, z: p.ws }));
    const st: ReachStation[] = r.points.map((p) => ({ x: p.x, zb: p.zb, zs: p.ws, V: p.V, Q: p.Q }));
    return reachFlow(st, air, [
      { x: 0, z: S0 * L },
      { x: L, z: 0 },
    ]);
    // r dihitung ulang dari masukan yang sama; deps primitif.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Q, b, n, S0, L, berlaku]);
  const skala = aliran ? reachTimeScale(aliran.crossTime) : 1;
  const faktor = (v: number) => v.toLocaleString(lang === "id" ? "id-ID" : "en-US");
  const catatanGerak = skala === 1 ? x.motionReal : x.motion(faktor(skala));

  const plate = usePlate(
    (ctx, w, h) =>
      drawReach(ctx, w, h, {
        ...susun(r, b, L, S0, zCrest, lang),
        ...(playing || !aliran ? {} : { flowArrows: [L * 0.45, L * 0.85] }),
      }),
    aliran
      ? (ctx, _w, _h, tt, dt, out) => drawReachMotion(ctx, tt, dt, out, aliran, skala, gerak.current!)
      : null,
    [Q, b, n, S0, L, zCrest, lang, playing, berlaku],
    { playing, timeScale: skala }
  );

  const zSpan = Math.max(zCrest, pangkal.ws, S0 * L, 1e-3);
  const exagg = L / zSpan / 1.9;

  /* Langkah Hinds pertama: dua titik terakhir r.points (ujung keluar dan
     satu Δx di hulunya), dengan rumus yang sama persis dengan model. */
  const nP = r.points.length;
  const p2 = r.points[nP - 1];
  const p1 = nP >= 2 ? r.points[nP - 2] : null;
  const dx = L / 120;
  const dyM = p1
    ? ((p1.V + p2.V) / (G * (p1.Q + p2.Q))) * (p1.Q * (p2.V - p1.V) + p2.V * (p2.Q - p1.Q))
    : NaN;
  const hf = p1 ? ((frictionSlope(p1.Q, b, p1.y, n) + frictionSlope(p2.Q, b, p2.y, n)) / 2) * dx : NaN;

  const langkah = [
    {
      judul: x.hQ,
      rumus: (<><span>q* =</span><Frac num="Q" den="L" /><span className="ml-3">yc,out = ∛( ( Q / b )² / g )</span></>),
      isi: `${fmt(Q, 0)} / ${fmt(L, 0)} = ${fmt(Q / L, 4)} m²/s ;  ∛( ( ${fmt(Q, 0)} / ${fmt(b, 1)} )² / ${fmt(G, 2)} )`,
      hasil: fmt(r.ycOut, 3),
      satuan: "m",
      tint: C.critical,
    },
    ...(terpotong
      ? [
          {
            judul: x.superkritis,
            rumus: <span>Fr &gt; 1</span>,
            isi:
              (r.supercriticalFrom as number) >= L - 1e-9
                ? x.hSuperSeluruh
                : `${x.hSuper} ${fmt(r.supercriticalFrom as number, 1)} ${x.dariPangkal}`,
            hasil: takAda,
          },
        ]
      : [
          ...(p1
            ? [
                {
                  judul: `${x.hHinds} = ${fmt(dx, 2)} m`,
                  rumus: (
                    <>
                      <span>Δy =</span>
                      <Frac num="V₁ + V₂" den="g (Q₁ + Q₂)" />
                      <span>[ Q₁ (V₂ − V₁) + V₂ (Q₂ − Q₁) ] ;  ws₁ = ws₂ + Δy + hf</span>
                    </>
                  ),
                  isi: `( ${fmt(p1.V, 3)} + ${fmt(p2.V, 3)} ) / ( ${fmt(G, 2)} · ( ${fmt(p1.Q, 2)} + ${fmt(p2.Q, 2)} ) ) · [ ${fmt(p1.Q, 2)} · ( ${fmt(p2.V, 3)} − ${fmt(p1.V, 3)} ) + ${fmt(p2.V, 3)} · ( ${fmt(p2.Q, 2)} − ${fmt(p1.Q, 2)} ) ] = ${fmt(dyM, 5)} m ;  ${x.hHf} ${fmt(hf, 5)} m ;  ${fmt(p2.ws, 4)} + ${fmt(dyM, 5)} + ${fmt(hf, 5)}`,
                  hasil: fmt(p1.ws, 4),
                  satuan: "m",
                  tint: C.water,
                },
              ]
            : []),
          {
            judul: x.hWs,
            rumus: <span>Δws = ws( 0 ) − ws( L )</span>,
            isi: `${fmt(pangkal.ws, 4)} − ${fmt(p2.ws, 4)}`,
            hasil: fmt(r.rise, 3),
            satuan: "m",
            tint: C.energy,
          },
          {
            judul: x.hYmax,
            rumus: <span>y_max = maks y( x ) ;  y( 0 ) = ws( 0 ) − S₀ L</span>,
            isi: `y( 0 ) = ${fmt(pangkal.ws, 4)} − ${fmt(S0 * L, 3)} = ${fmt(pangkal.y, 3)} m`,
            hasil: fmt(r.yMax, 3),
            satuan: "m",
            tint: C.water,
          },
          {
            judul: x.hDz,
            rumus: <span>Δz = S₀ L ;  f = z_m − ws( 0 )</span>,
            isi: mustahil
              ? `${fmt(S0, 4)} · ${fmt(L, 0)} = ${fmt(S0 * L, 3)} m ;  ${x.hMustahil}`
              : `${fmt(S0, 4)} · ${fmt(L, 0)} = ${fmt(S0 * L, 3)} m ;  ${fmt(zCrest, 1)} − ${fmt(pangkal.ws, 4)}`,
            hasil: fSah ? fmt(jagaan, 3) : takAda,
            satuan: fSah ? "m" : undefined,
            tint: tenggelam ? C.signal : undefined,
          },
        ]),
  ];

  /* Batas pita: f < 0 berarti muka air di pangkal di atas mercu (Hinds
     1926, USBR 1987). Rentang penggeser memberi f −71,5 sampai 14,8 m;
     skala dipotong −5 sampai 15 supaya batas nol terbaca, nilai di bawah
     −5 ditandai di luar skala. */
  const pitaF: { from: number; to: number; label: string; tone: Tone }[] = terpotong
    ? [{ from: -5, to: 15, label: x.bandSuper, tone: "invalid" }]
    : mustahil
      ? [{ from: -5, to: 15, label: x.mustahil, tone: "invalid" }]
      : [
          { from: -5, to: 0, label: x.bandTenggelam, tone: "invalid" },
          { from: 0, to: 15, label: x.bebas, tone: "pass" },
        ];

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="f"
          value={fSah ? jagaan : NaN}
          invalid={!fSah || tenggelam}
          pesan={terpotong ? x.bandSuper : mustahil ? x.mustahil : undefined}
          digits={2}
          bands={pitaF}
        />
      }
      sheet="HS-10"
      subject={SUBJECTS.HS[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Air melimpah dari mercu di sepanjang sisi saluran, lalu berbelok
            sembilan puluh derajat dan mengalir searah saluran pengumpul. Yang
            membuat saluran itu harus dibuat dalam bukan gesekan, melainkan{" "}
            <Term tint={C.energy}>biaya membelokkan dan mempercepat</Term> air
            yang baru masuk.
          </p>
        ) : (
          <p>
            Water spills off the crest along the side of the channel, turns
            ninety degrees, and runs along the collector trough. What forces
            that trough to be deep is not friction but the{" "}
            <Term tint={C.energy}>cost of turning and accelerating</Term> the
            newly arrived water.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HS-10"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "Q", value: `${fmt(Q, 1)} m³/s`, tint: C.water },
            { label: "yc", value: `${fmt(r.ycOut, 3)} m`, tint: C.critical },
            {
              label: x.rFree,
              value: fSah ? `${fmt(jagaan, 2)} m` : takAda,
              tint: !fSah || tenggelam ? C.signal : undefined,
            },
            { label: t.tbScale, value: `${x.exagg} ${fmt(exagg, 1)}×` },
          ]}
          motion={{
            playing,
            onToggle: togglePutar,
            allowed: plate.motionAllowed,
            note: catatanGerak,
          }}
        >
          <canvas ref={plate.ref} className="block h-full w-full" />
          <canvas ref={plate.motionRef} />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q} min={2} max={300} step={1} digits={0} unit="m³/s" onChange={setQ} tint={C.water} />
              <InputRow symbol="b" label={x.db} value={b} min={1} max={20} step={0.2} digits={1} unit="m" onChange={setB} />
              <InputRow symbol="n" label={x.dn} value={n} min={0.011} max={0.03} step={0.001} digits={3} onChange={setN} />
              <InputRow symbol="S₀" label={x.dS} value={S0 * 1000} min={0.5} max={40} step={0.5} digits={1} unit="‰" onChange={(v) => setS0(v / 1000)} />
              <InputRow symbol="L" label={x.dL} value={L} min={10} max={200} step={2} digits={0} unit="m" onChange={setL} />
              <InputRow symbol="z_m" label={x.dz} value={zCrest} min={1} max={15} step={0.1} digits={1} unit="m" onChange={setZCrest} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pKecil, apply: () => { setQ(20); setB(4); setN(0.014); setS0(0.002); setL(40); setZCrest(3.2); } },
                  { label: x.pBesar, apply: () => { setQ(150); setB(10); setN(0.014); setS0(0.008); setL(120); setZCrest(7); } },
                  { label: x.pSempit, apply: () => { setQ(80); setB(3); setN(0.014); setS0(0.005); setL(50); setZCrest(4.5); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "y_max", label: x.rYmax, value: terpotong ? takAda : fmt(r.yMax, 3), unit: terpotong ? undefined : "m", tint: C.water, strong: true },
                /* Jagaan adalah keputusan rancangannya, jadi itu yang ditulis
                   besar, bukan kenaikan muka air. */
                { symbol: "f", label: x.rFree, value: fSah ? fmt(jagaan, 3) : takAda, unit: fSah ? "m" : undefined, tint: !fSah || tenggelam ? C.signal : undefined, strong: true },
                { symbol: "Δws", label: x.rRise, value: terpotong ? takAda : fmt(r.rise, 3), unit: terpotong ? undefined : "m", tint: C.energy },
                { symbol: "yc", label: x.rYc, value: fmt(r.ycOut, 3), unit: "m", tint: C.critical },
                { symbol: "Q", label: x.rQ, value: fmt(r.Qout, 1), unit: "m³/s", tint: C.water },
                { symbol: "q*", label: x.rQstar, value: fmt((Q / L) * 1000, 0), unit: "l/s·m" },
                { symbol: "Δz", label: x.rDrop, value: fmt(S0 * L, 3), unit: "m" },
              ]}
            />
            <div className="mt-3">
              <Hitungan langkah={langkah} />
            </div>
          </Block>

          <StateCard tone={kartu.tone} badge={kartu.badge} state={kartu.state} notice={kartu.notice} />
        </>
      }
      verification={
        <Verification checks={checksSideChannel(Q, b, n, S0, L)} />
      }
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>Δy =</span>
                <Frac num="V₁ + V₂" den="g (Q₁ + Q₂)" />
                <span>[ Q₁ (V₂ − V₁) + V₂ (Q₂ − Q₁) ]</span>
              </Eq>
              <Eq>
                <span>ws₁ = ws₂ + Δy + hf</span>
                <span className="ml-5">Q(x) = Q L⁻¹ x</span>
                <span className="ml-5">Fr = 1</span>
                <span className="ml-2 text-ink-3">
                  {lang === "id" ? "di ujung keluar" : "at the outlet"}
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

/* ------------------------------------------------------------------ *
 * Penyusunan gambar
 * ------------------------------------------------------------------ */

function susun(r: TroughResult, b: number, L: number, S0: number, zCrest: number, lang: Lang) {
  const T = cl(lang);
  const terpotong = r.supercriticalFrom !== null;

  // Dasarnya diketahui di sepanjang saluran. Muka airnya hanya sejauh yang
  // dihitung: bila bagian hulu superkritis, deretnya berhenti di sana.
  const bed: ReachPoint[] = [
    { x: 0, z: S0 * L },
    { x: L, z: 0 },
  ];
  const air: ReachPoint[] = r.points.map((p) => ({ x: p.x, z: p.ws }));

  const garis: ReachSeries[] = [
    // Mercu pelimpah: satu elevasi tetap di sepanjang saluran pengumpul.
    // Muka air di dalam saluran tidak boleh menyentuhnya.
    {
      pts: [
        { x: 0, z: zCrest },
        { x: L, z: zCrest },
      ],
      color: C.ink,
      weight: W.thin,
      dash: DASH.phantom,
      label: T.crest,
      labelAt: 0.12,
      labelDy: -9,
    },
    // Kedalaman kritis SETEMPAT, bukan kedalaman kritis ujung keluar yang
    // ditarik lurus. Debitnya bertambah sepanjang saluran, jadi garis kritisnya
    // menurun ke arah pangkal sampai nol. Garis lurus pada nilai ujung keluar
    // membuat muka air yang dangkal di pangkal terbaca superkritis, padahal
    // debit di sana hampir nol.
    {
      pts: Array.from({ length: 41 }, (_, i) => {
        const xx = (L * i) / 40;
        return { x: xx, z: S0 * (L - xx) + criticalDepth(((r.Qout * xx) / L) / b) };
      }),
      color: C.critical,
      weight: W.hair,
      dash: DASH.axis,
      label: "yc(x)",
      labelAt: 0.55,
      labelDy: 11,
    },
  ];

  const pangkal = r.points[0];
  const keluar = r.points[r.points.length - 1];

  const tanda: ReachMarker[] = [
    {
      x: L,
      label: T.control,
      // Kendali di ujung keluar adalah penampang kritis, bukan keadaan di luar rentang.
      color: C.critical,
      zBottom: 0,
      dim: {
        zTop: keluar.ws,
        zBottom: 0,
        text: `${fmtPlain(keluar.y, 2)} m`,
        side: -1,
      },
    },
  ];

  if (terpotong) {
    // Penelusuran berhenti di sini. Di hulunya tidak ada muka air yang
    // digambar, dan gambar harus mengatakan itu, bukan membiarkan kertas
    // kosong terbaca sebagai saluran kering.
    tanda.push({
      x: pangkal.x,
      label: T.profileEnds,
      color: C.signal,
      zBottom: pangkal.zb,
    });
  } else {
    tanda.push({
      x: 0,
      label: T.collector,
      color: C.water,
      zBottom: pangkal.zb,
      dim: {
        zTop: pangkal.ws,
        zBottom: pangkal.zb,
        text: `${fmtPlain(pangkal.y, 2)} m`,
        side: 1,
      },
    });
  }

  const wilayah: ReachRegion[] = [
    {
      x: L * 0.5,
      z: Math.max(zCrest, pangkal.ws, S0 * L) * 1.05,
      text: T.lateralInflow,
      color: C.ink3,
    },
  ];
  if (terpotong) {
    wilayah.push({
      x: pangkal.x / 2,
      z: S0 * (L - pangkal.x / 2) + r.ycOut,
      text: `${T.supercritical}, ${T.noProfile}`,
      color: C.signal,
    });
  }

  return {
    length: L,
    bed,
    water: air,
    series: garis,
    markers: tanda,
    regions: wilayah,
    axisX: T.axDistance,
    axisZ: T.elevation,
  };
}

function keadaan(
  r: TroughResult,
  S0: number,
  L: number,
  jagaan: number,
  mustahil: boolean,
  x: (typeof TXT)[Lang],
  lang: Lang
): { tone: Tone; badge: string; state: string; notice: string[] } {
  const en = lang === "en";
  const turunDasar = S0 * L;
  // Kedalaman terbesar tidak selalu di pangkal: dasar dan muka air sama-sama
  // naik ke arah itu, dan selisihnya bisa memuncak sedikit di hilir pangkal.
  const yPangkal = r.points[0].y;

  if (r.supercriticalFrom !== null) {
    const seluruh = r.supercriticalFrom >= L - 1e-9;
    const bagian = fmt((r.supercriticalFrom / L) * 100, 0);
    return {
      tone: "invalid",
      badge: x.superkritis,
      state: seluruh
        ? en
          ? "The whole collector trough is supercritical: the outlet control does not reach any of it."
          : "Seluruh saluran pengumpul superkritis: kendali di ujung keluar tidak menjangkau bagian mana pun."
        : en
          ? `The traverse from the outlet control stops ${fmt(r.supercriticalFrom, 1)} m from the head, ${bagian} per cent of the way along.`
          : `Penelusuran dari kendali di ujung keluar berhenti ${fmt(r.supercriticalFrom, 1)} m dari pangkal, ${bagian} persen dari panjangnya.`,
      notice: [
        x.superkritisNote,
        en
          ? "The trough is too steep or too narrow for the discharge it collects: flatten it, widen it, or lengthen the crest so that less water enters per metre."
          : "Saluran pengumpulnya terlalu curam atau terlalu sempit untuk debit yang dikumpulkannya: landaikan, perlebar, atau perpanjang mercunya supaya air yang masuk per meter berkurang.",
      ],
    };
  }

  const dasar = en
    ? `The water surface rises ${fmt(r.rise, 3)} m toward the head while the bed rises ${fmt(turunDasar, 3)} m over the same length, so the depth at the head is ${fmt(yPangkal, 3)} m against ${fmt(r.ycOut, 3)} m at the outlet.`
    : `Muka air naik ${fmt(r.rise, 3)} m ke arah pangkal, sementara dasarnya naik ${fmt(turunDasar, 3)} m sepanjang jarak yang sama, sehingga kedalaman di pangkal ${fmt(yPangkal, 3)} m berbanding ${fmt(r.ycOut, 3)} m di ujung keluar.`;

  if (mustahil)
    return {
      tone: "invalid",
      badge: x.mustahil,
      state: en
        ? `Crest ${fmt(turunDasar + jagaan + yPangkal, 2)} m is not above the head bed (S₀L = ${fmt(turunDasar, 2)} m).`
        : `Mercu ${fmt(turunDasar + jagaan + yPangkal, 2)} m tidak di atas dasar pangkal (S₀L = ${fmt(turunDasar, 2)} m).`,
      notice: [x.mustahilNote, dasar],
    };

  if (jagaan < 0)
    return {
      tone: "invalid",
      badge: x.tenggelam,
      state: en
        ? `The water surface at the head stands ${fmt(-jagaan, 2)} m above the crest.`
        : `Muka air di pangkal ${fmt(-jagaan, 2)} m di atas mercu.`,
      notice: [x.tenggelamNote, dasar],
    };

  return {
    tone: "pass",
    badge: x.bebas,
    state: en
      ? `The water surface rises ${fmt(r.rise, 3)} m toward the head; freeboard ${fmt(jagaan, 2)} m.`
      : `Muka air naik ${fmt(r.rise, 3)} m ke pangkal; jagaan ${fmt(jagaan, 2)} m.`,
    notice: [dasar, x.curam],
  };
}
