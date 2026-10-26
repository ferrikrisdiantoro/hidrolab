"use client";

import { useMemo, useRef, useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  Block,
  Flag,
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
  criticalDepth,
  fmt,
  G,
  svfProfile,
  type SvfResult,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksSvf } from "@/lib/checks";

const TXT = {
  id: {
    title: "Aliran masuk lateral",
    sheetTitle: "Debit bertambah sepanjang saluran — saluran persegi prismatis",
    dQ0: "Debit masuk di ujung hulu",
    dq: "Aliran masuk per satuan panjang",
    db: "Lebar dasar",
    dn: "Kekasaran Manning",
    dS: "Kemiringan dasar",
    dL: "Panjang bentang",
    dy: "Kedalaman di ujung hilir",
    pDrainase: "Saluran drainase jalan",
    pIrigasi: "Saluran pembuang sawah",
    pTanpa: "Tanpa aliran masuk",
    rQend: "Debit di ujung hilir",
    rQ0: "Debit di ujung hulu",
    rYup: "Kedalaman di ujung hulu",
    rYdn: "Kedalaman di ujung hilir",
    rFrMax: "Bilangan Froude terbesar",
    rBeda: "Selisih terhadap hitungan tanpa suku percepatan",
    rYc: "Kedalaman kritis di ujung hilir",
    lintas: "Melewati kondisi kritis",
    hilirSuper: "Kendali tidak di ujung hilir",
    hilirSuperNote:
      "Aliran di ujung hilir ternyata superkritis, dan penelusuran ini mengandaikan kendalinya berada di sana. Pada aliran superkritis kendali pindah ke hulu, sehingga muka air yang tergambar tidak berlaku dan tidak boleh dibaca sebagai hasil. Naikkan kedalaman di ujung hilir sampai di atas kedalaman kritis, perlebar dasar, atau kurangi aliran masuknya.",
    lintasNote:
      "Profilnya melintasi kondisi kritis di tengah bentang. Di titik itu penyebut persamaan menuju nol dan kemiringan muka air menjadi tegak, sehingga hasil di sekitarnya digambar titik rapat dan tidak boleh dibaca sebagai angka. Keadaan nyata di situ adalah loncatan air atau penampang kendali, yang penanganannya berbeda. Perkecil aliran masuk, perbesar lebar dasar, atau naikkan kedalaman di ujung hilir.",
    exagg: "pelebihan tegak",
    motion: (n: string) => `partikel bergerak dengan V = Q(x)/A, lahir sebanding q*, waktu dipercepat ×${n}`,
    motionReal: "partikel bergerak dengan V = Q(x)/A, lahir sebanding q*, waktu nyata",
    bSub: "Subkritis, kendali hilir berlaku",
    bKr: "Mendekati kritis",
    bSup: "Superkritis, penelusuran tidak berlaku",
    tak: "Tidak berlaku: hilir superkritis",
    subkritis: "Subkritis",
    tanpaQ: "Tanpa aliran masuk",
    hQL: "Debit di ujung hilir",
    hYc: "Kedalaman kritis di ujung hilir",
    hSuku: "Suku percepatan di ujung hilir",
    hInteg: "Penelusuran ke hulu",
    hIntegIsi: (n: number) => `Runge-Kutta orde 4 dari x = L ke x = 0, ${n} langkah`,
    hBeda: "Selisih karena suku percepatan",
    hBedaRumus: "Δy = y(0) − y(0) tanpa suku percepatan",
    hTak: "Hilir superkritis: penelusuran dari hilir tidak berlaku",
    note:
      "Persamaannya sama dengan aliran berubah lambat kecuali satu suku tambahan di pembilang, dan suku itulah seluruh isi lembar ini. Air yang masuk dari samping datang tanpa membawa momentum searah saluran, sehingga ia harus dipercepat oleh aliran yang sudah ada, dan biaya percepatan itu diambil dari tinggi tekan. Akibatnya muka air selalu lebih tinggi daripada seandainya debit yang sama mengalir tanpa penambahan di sepanjang jalan. Garis putus panjang pada gambar memperlihatkan perbandingannya: itulah profil yang keluar bila debit di setiap penampang dihitung dengan benar tetapi suku percepatannya dilupakan, yaitu hitungan yang paling lazim dikerjakan orang. Debit di kedua profil sama persis di setiap penampang, sehingga selisih di antara keduanya bukan pengaruh gesekan dan bukan pula pengaruh bertambahnya debit, melainkan murni biaya mempercepat air yang baru masuk. Dalam perancangan saluran drainase tepi jalan dan saluran pembuang, selisih itulah yang menentukan tinggi jagaan, dan mengabaikannya membuat saluran tampak cukup di atas kertas tetapi melimpah di lapangan.",
  },
  en: {
    title: "Lateral inflow",
    sheetTitle: "Discharge increasing along the channel — prismatic rectangular channel",
    dQ0: "Inflow at the upstream end",
    dq: "Inflow per unit length",
    db: "Bed width",
    dn: "Manning roughness",
    dS: "Bed slope",
    dL: "Reach length",
    dy: "Depth at the downstream end",
    pDrainase: "Road drainage channel",
    pIrigasi: "Field drainage channel",
    pTanpa: "No lateral inflow",
    rQend: "Discharge at the downstream end",
    rQ0: "Discharge at the upstream end",
    rYup: "Depth at the upstream end",
    rYdn: "Depth at the downstream end",
    rFrMax: "Largest Froude number",
    rBeda: "Difference against the calculation without the acceleration term",
    rYc: "Critical depth at the downstream end",
    lintas: "Crosses critical conditions",
    hilirSuper: "Control is not at the downstream end",
    hilirSuperNote:
      "The flow at the downstream end turns out to be supercritical, and this traverse assumes the control sits there. In supercritical flow the control moves upstream, so the water surface drawn does not apply and must not be read as a result. Raise the depth at the downstream end above critical depth, widen the bed, or reduce the inflow.",
    lintasNote:
      "The profile crosses critical conditions in mid reach. There the denominator of the equation tends to zero and the surface slope becomes vertical, so results around that point are drawn with fine dots and must not be read as numbers. What really happens there is a hydraulic jump or a control section, which is handled differently. Reduce the inflow, widen the bed, or raise the depth at the downstream end.",
    exagg: "vertical exaggeration",
    motion: (n: string) => `particles move at V = Q(x)/A, born in proportion to q*, time sped up ×${n}`,
    motionReal: "particles move at V = Q(x)/A, born in proportion to q*, real time",
    bSub: "Subcritical, downstream control holds",
    bKr: "Near critical",
    bSup: "Supercritical, traverse not valid",
    tak: "Not valid: supercritical outlet",
    subkritis: "Subcritical",
    tanpaQ: "No lateral inflow",
    hQL: "Discharge at the downstream end",
    hYc: "Critical depth at the downstream end",
    hSuku: "Acceleration term at the downstream end",
    hInteg: "Traverse upstream",
    hIntegIsi: (n: number) => `Fourth-order Runge-Kutta from x = L to x = 0, ${n} steps`,
    hBeda: "Difference due to the acceleration term",
    hBedaRumus: "Δy = y(0) − y(0) without the acceleration term",
    hTak: "Supercritical outlet: a traverse from downstream does not apply",
    note:
      "The equation is the same as for gradually varied flow except for one extra term in the numerator, and that term is the whole content of this sheet. Water entering from the side arrives with no momentum along the channel, so it has to be accelerated by the flow already there, and the cost of that acceleration is taken from head. The water surface therefore always sits higher than it would if the same discharge flowed without being added along the way. The long dashed line on the drawing shows the comparison: it is the profile that comes out when the discharge at each section is computed correctly but the acceleration term is forgotten, which is the calculation people most often make. The discharge in both profiles is identical at every section, so the gap between them is neither friction nor the growth of discharge, but purely the cost of accelerating the newly arrived water. In designing roadside drains and field drainage channels, that gap is what sets the freeboard, and ignoring it makes a channel look adequate on paper while it overtops in the field.",
  },
} as const;

const REFS = {
  id: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Bab 12, aliran berubah beraturan dengan debit bertambah.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Bab 7.",
    "Yen, B.C. & Wenzel, H.G. (1970). Dynamic equations for steady spatially varied flow. Journal of the Hydraulics Division, ASCE.",
    "US Federal Highway Administration (2013). Urban Drainage Design Manual, HEC-22, edisi ke-3.",
  ],
  en: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Chapter 12, spatially varied flow with increasing discharge.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Chapter 7.",
    "Yen, B.C. & Wenzel, H.G. (1970). Dynamic equations for steady spatially varied flow. Journal of the Hydraulics Division, ASCE.",
    "US Federal Highway Administration (2013). Urban Drainage Design Manual, HEC-22, 3rd ed.",
  ],
} as const;

export function AliranMasukLateralClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [Q0, setQ0] = useState(4);
  const [qLit, setQLit] = useState(20);
  const [b, setB] = useState(5);
  const [n, setN] = useState(0.025);
  const [S0, setS0] = useState(0.0012);
  const [L, setL] = useState(500);
  const [yEnd, setYEnd] = useState(2.2);

  const qStar = qLit / 1000;
  const r = svfProfile(Q0, qStar, b, n, S0, L, yEnd);
  /*
   * Pembanding memakai distribusi debit YANG SAMA, hanya suku percepatannya
   * dimatikan.
   *
   * Pembanding sebelumnya memakai debit penuh sejak pangkal, dan itu mengukur
   * hal yang berbeda: profil dengan debit penuh tentu lebih dalam di hulu,
   * sehingga selisihnya berlawanan arah dengan yang mau ditunjukkan. Yang mau
   * ditunjukkan adalah harga mempercepat air yang masuk dari samping, dan itu
   * hanya terisolasi bila debit di setiap penampang dibuat sama persis.
   */
  const tanpa = svfProfile(Q0, qStar, b, n, S0, L, yEnd, 400, true);
  const ycEnd = criticalDepth(r.Qend / b);

  /*
   * Lapis gerak: partikel bergerak dengan V = Q(x)/(b·y) dari svfProfile di
   * tiap stasiun. Partikel lahir di hulu dengan peluang Q₀/Q_L dan sisanya
   * merata di sepanjang saluran, jadi jumlah yang lewat penampang x per detik
   * sebanding Q(x) = Q₀ + q*·x (drawReachMotion). Hilir superkritis: muka air
   * yang digambar tidak berlaku, jadi tidak ada gerak di atasnya.
   */
  const { playing, toggle: togglePutar } = usePutar();
  const gerak = useRef<ReachMotion | null>(null);
  if (gerak.current === null) gerak.current = createReachMotion(170);
  const aliran = useMemo(() => {
    if (r.outletSupercritical || !(r.Qend > 0)) return null;
    const zb = (xx: number) => (L - xx) * S0;
    const air: ReachPoint[] = r.points.map((p) => ({ x: p.x, z: zb(p.x) + p.y }));
    const st: ReachStation[] = r.points.map((p) => ({ x: p.x, zb: zb(p.x), zs: zb(p.x) + p.y, V: p.V, Q: p.Q }));
    return reachFlow(st, air, [
      { x: 0, z: zb(0) },
      { x: L, z: 0 },
    ]);
    // r dihitung ulang dari masukan yang sama; deps primitif.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Q0, qLit, b, n, S0, L, yEnd]);
  const skala = aliran ? reachTimeScale(aliran.crossTime) : 1;
  const faktor = (v: number) => v.toLocaleString(lang === "id" ? "id-ID" : "en-US");
  const catatanGerak = skala === 1 ? x.motionReal : x.motion(faktor(skala));

  const plate = usePlate(
    (ctx, w, h) =>
      drawReach(ctx, w, h, {
        ...susun(r, tanpa, ycEnd, L, S0, lang),
        ...(playing || !aliran ? {} : { flowArrows: [L * 0.3, L * 0.8] }),
      }),
    aliran
      ? (ctx, _w, _h, tt, dt, out) => drawReachMotion(ctx, tt, dt, out, aliran, skala, gerak.current!)
      : null,
    [Q0, qLit, b, n, S0, L, yEnd, lang, playing],
    { playing, timeScale: skala }
  );

  const zSpan = Math.max(S0 * L + r.yMax, 1e-3);
  const exagg = L / zSpan / 1.9;
  const frMax = r.points.reduce((m, p) => Math.max(m, p.Fr), 0);
  const beda = r.points[0].y - tanpa.points[0].y;
  /* Hilir superkritis: kendali tidak di hilir, kedalaman hulu hanyalah
     jepitan 0,01 m dari integrasi, jadi semua angka turunan ditekan. */
  const tak = r.outletSupercritical;
  const tampil = (v: number) => (tak ? NaN : v);
  const satuan = (u: string) => (tak ? undefined : u);
  const yHulu = r.points[0].y;
  const yHuluTanpa = tanpa.points[0].y;
  const AL = b * yEnd;
  const suku = (2 * r.Qend * qStar) / (G * AL * AL);

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="Fr"
          value={tak ? NaN : frMax}
          invalid={tak || frMax > 1}
          pesan={tak ? x.tak : undefined}
          scale="log"
          digits={2}
          bands={
            tak
              ? [{ from: 0.01, to: 10, label: x.tak, tone: "invalid" }]
              : [
                  { from: 0.01, to: FR_DEKAT, label: x.bSub, tone: "water" },
                  { from: FR_DEKAT, to: 1, label: x.bKr, tone: "critical" },
                  { from: 1, to: 10, label: x.bSup, tone: "invalid" },
                ]
          }
        />
      }
      sheet="OC-12"
      subject={SUBJECTS.OC[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Air masuk di sepanjang saluran, bukan hanya di ujungnya. Debitnya
            bertambah setiap meter, dan{" "}
            <Term tint={C.water}>muka airnya</Term> naik lebih tinggi daripada
            yang diperkirakan dari debit akhir saja, karena air yang baru masuk
            harus ikut dipercepat.
          </p>
        ) : (
          <p>
            Water enters along the channel, not only at its end. The discharge
            grows every metre, and the{" "}
            <Term tint={C.water}>water surface</Term> sits higher than the final
            discharge alone would suggest, because the newly arrived water has
            to be accelerated too.
          </p>
        )
      }
      drawing={
        <Sheet
          number="OC-12"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "Q₀", value: `${fmt(Q0, 1)} m³/s`, tint: C.water },
            { label: "Q_L", value: `${fmt(r.Qend, 1)} m³/s`, tint: C.water },
            { label: "q*", value: `${fmt(qLit, 0)} l/s·m` },
            { label: t.tbScale, value: `${x.exagg} ${fmt(exagg, 0)}×` },
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
              <InputRow symbol="Q₀" label={x.dQ0} value={Q0} min={0} max={40} step={0.5} digits={1} unit="m³/s" onChange={setQ0} tint={C.water} />
              <InputRow symbol="q*" label={x.dq} value={qLit} min={0} max={120} step={1} digits={0} unit="l/s·m" onChange={setQLit} tint={C.water} />
              <InputRow symbol="b" label={x.db} value={b} min={0.5} max={20} step={0.1} digits={1} unit="m" onChange={setB} />
              <InputRow symbol="n" label={x.dn} value={n} min={0.01} max={0.07} step={0.001} digits={3} onChange={setN} />
              <InputRow symbol="S₀" label={x.dS} value={S0 * 1000} min={0.1} max={20} step={0.1} digits={1} unit="‰" onChange={(v) => setS0(v / 1000)} />
              <InputRow symbol="L" label={x.dL} value={L} min={50} max={1500} step={10} digits={0} unit="m" onChange={setL} />
              <InputRow symbol="y_L" label={x.dy} value={yEnd} min={0.2} max={6} step={0.05} unit="m" onChange={setYEnd} tint={C.water} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pDrainase, apply: () => { setQ0(0); setQLit(4); setB(0.8); setN(0.014); setS0(0.004); setL(300); setYEnd(0.9); } },
                  { label: x.pIrigasi, apply: () => { setQ0(4); setQLit(20); setB(5); setN(0.025); setS0(0.0012); setL(500); setYEnd(2.2); } },
                  { label: x.pTanpa, apply: () => { setQ0(14); setQLit(0); setB(5); setN(0.025); setS0(0.0012); setL(500); setYEnd(2.2); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={C.water}>{`${fmt(Q0, 1)} → ${fmt(r.Qend, 1)} m³/s`}</Flag>
            </div>
            <ResultTable
              rows={[
                { symbol: "Q₀", label: x.rQ0, value: fmt(Q0, 2), unit: "m³/s", tint: C.water },
                { symbol: "Q_L", label: x.rQend, value: fmt(r.Qend, 2), unit: "m³/s", tint: C.water, strong: true },
                { symbol: "y(0)", label: x.rYup, value: fmt(tampil(yHulu), 3), unit: satuan("m"), tint: C.water, strong: true },
                { symbol: "y_L", label: x.rYdn, value: fmt(yEnd, 3), unit: "m" },
                { symbol: "Δy", label: x.rBeda, value: fmt(tampil(beda), 3), unit: satuan("m"), tint: C.water },
                { symbol: "Fr", label: x.rFrMax, value: fmt(tampil(frMax), 3) },
                { symbol: "yc", label: x.rYc, value: fmt(ycEnd, 3), unit: "m", tint: C.critical },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hQL,
                    rumus: <span>Q_L = Q₀ + q* · L</span>,
                    isi: `${fmt(Q0, 1)} + ${fmt(qStar, 3)} · ${fmt(L, 0)}`,
                    hasil: fmt(r.Qend, 2),
                    satuan: "m³/s",
                    tint: C.water,
                  },
                  {
                    judul: x.hYc,
                    rumus: (<><span>yc =</span><Frac num="∛( ( Q_L / b )² )" den="∛g" /></>),
                    isi: `∛( ( ${fmt(r.Qend, 3)} / ${fmt(b, 1)} )² / ${fmt(G, 2)} )`,
                    hasil: fmt(ycEnd, 3),
                    satuan: "m",
                    tint: C.critical,
                  },
                  {
                    /* Ditulis dalam ‰ supaya langsung terbanding dengan S₀. */
                    judul: x.hSuku,
                    rumus: <Frac num="2 · Q_L · q*" den="g · ( b · y_L )²" />,
                    isi: tak
                      ? "—"
                      : `2 · ${fmt(r.Qend, 3)} · ${fmt(qStar, 3)} / ( ${fmt(G, 2)} · ( ${fmt(b, 1)} · ${fmt(yEnd, 2)} )² ) · 1000`,
                    hasil: fmt(tampil(suku * 1000), 4),
                    satuan: satuan("‰"),
                  },
                  {
                    judul: tak ? x.hTak : x.hInteg,
                    rumus: (<><span>dy/dx =</span><Frac num="S₀ − Sf − 2 Q q* / ( g A² )" den="1 − Fr²" /></>),
                    isi: tak ? "—" : x.hIntegIsi(400),
                    hasil: tak ? "—" : `y(0) = ${fmt(yHulu, 3)}`,
                    satuan: satuan("m"),
                    tint: C.water,
                  },
                  {
                    judul: x.hBeda,
                    rumus: <span>{x.hBedaRumus}</span>,
                    isi: tak ? "—" : `${fmt(yHulu, 4)} − ${fmt(yHuluTanpa, 4)}`,
                    hasil: fmt(tampil(beda), 3),
                    satuan: satuan("m"),
                    tint: C.water,
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard {...kartu(beda, qStar, L, r, frMax, lang)} />
        </>
      }
      verification={
        <Verification checks={checksSvf(Q0, qStar, b, n, S0, L, yEnd)} />
      }
      below={
        <Basis
          equations={
            <>
              <Eq>
                <Frac num="dy" den="dx" />
                <span>=</span>
                <Frac num="S₀ − Sf − 2 Q q* / (g A²)" den="1 − Fr²" />
              </Eq>
              <Eq>
                <span>Q(x) = Q₀ + q* x</span>
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "suku ketiga di pembilang hilang bila q* nol"
                    : "the third term in the numerator vanishes when q* is zero"}
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

function susun(
  r: SvfResult,
  tanpa: SvfResult,
  ycEnd: number,
  L: number,
  S0: number,
  lang: Lang
) {
  const T = cl(lang);
  const zb = (x: number) => (L - x) * S0;

  const bed: ReachPoint[] = [
    { x: 0, z: zb(0) },
    { x: L, z: 0 },
  ];

  const air: ReachPoint[] = r.points.map((p) => ({
    x: p.x,
    z: zb(p.x) + p.y,
    invalid: p.nearCritical,
  }));

  const garis: ReachSeries[] = [
    {
      pts: tanpa.points.map((p) => ({ x: p.x, z: zb(p.x) + p.y })),
      color: C.water,
      weight: W.hair,
      dash: DASH.phantom,
      label: T.noInflow,
      labelAt: 0.3,
      labelDy: 12,
    },
    {
      pts: [
        { x: 0, z: zb(0) + ycEnd },
        { x: L, z: ycEnd },
      ],
      color: C.critical,
      weight: W.hair,
      dash: DASH.axis,
      label: `yc ${fmt(ycEnd, 2)} m`,
      labelAt: 0.45,
      labelDy: 11,
    },
  ];

  const tanda: ReachMarker[] = [
    {
      x: L,
      label: T.control,
      color: C.ink,
      zBottom: 0,
      dim: {
        zTop: r.points[r.points.length - 1].y,
        zBottom: 0,
        text: `${fmt(r.points[r.points.length - 1].y, 2)} m`,
        side: -1,
      },
    },
    {
      x: 0,
      label: T.upstream,
      color: C.water,
      zBottom: zb(0),
      dim: {
        zTop: zb(0) + r.points[0].y,
        zBottom: zb(0),
        // Hilir superkritis: kedalaman hulu hanyalah jepitan integrasi.
        text: r.outletSupercritical ? "—" : `${fmt(r.points[0].y, 2)} m`,
        side: 1,
      },
    },
  ];

  const wilayah: ReachRegion[] = [
    {
      x: L * 0.5,
      z: zb(L * 0.5) + r.yMax * 1.55,
      text: T.lateralInflow,
      color: C.ink3,
    },
  ];

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

/** Batas pita "mendekati kritis", sama dengan nearCritical di svfProfile. */
const FR_DEKAT = 0.94;

function kartu(
  beda: number,
  qStar: number,
  L: number,
  r: SvfResult,
  frMax: number,
  lang: Lang
): { tone: Tone; badge: string; state: string; notice?: string[] } {
  const x = TXT[lang];
  const id = lang === "id";

  if (r.outletSupercritical) {
    return { tone: "invalid", badge: x.hilirSuper, state: x.hilirSuperNote };
  }
  if (r.crossesCritical) {
    return { tone: "invalid", badge: x.lintas, state: x.lintasNote };
  }

  const dekat = frMax >= FR_DEKAT;
  const tone: Tone = dekat ? "critical" : "water";
  const keadaan = id
    ? `Fr terbesar ${fmt(frMax, 3)}: aliran subkritis di seluruh bentang, jadi kendali di ujung hilir berlaku dan muka air ditelusuri ke hulu sampai y(0) = ${fmt(r.points[0].y, 3)} m.`
    : `Largest Fr ${fmt(frMax, 3)}: the flow is subcritical over the whole reach, so the control at the downstream end holds and the surface is traced upstream to y(0) = ${fmt(r.points[0].y, 3)} m.`;
  const dekatTeks = dekat
    ? id
      ? "Fr sudah mendekati 1. Di sekitar kondisi kritis penyebut persamaan menuju nol, jadi muka air sangat peka terhadap masukan; titik rapat pada gambar menandai bagian itu."
      : "Fr is already close to 1. Near critical conditions the denominator of the equation tends to zero, so the surface is very sensitive to the inputs; fine dots on the drawing mark that part."
    : null;

  if (qStar <= 0) {
    return {
      tone,
      badge: x.tanpaQ,
      state: keadaan,
      notice: [
        id
          ? "Aliran masuk lateral dimatikan, jadi suku tambahannya hilang dan yang tersisa adalah persamaan aliran berubah lambat biasa."
          : "The lateral inflow is switched off, so the extra term vanishes and what remains is the ordinary gradually varied flow equation.",
        id
          ? "Profil menerus dan garis putus panjang berimpit tepat, dan memang harus berimpit: keduanya menyelesaikan persamaan yang sama persis. Blok verifikasi di bawah memeriksanya dengan angka."
          : "The solid profile and the long dashed line coincide, and they must: both solve exactly the same equation. The verification block below checks this numerically.",
        dekatTeks,
      ].filter((b): b is string => !!b),
    };
  }

  const persen = r.points[0].y > 0 ? (beda / r.points[0].y) * 100 : 0;
  return {
    tone,
    badge: dekat ? x.bKr : x.subkritis,
    state: keadaan,
    notice: [
      id
        ? `Sepanjang ${fmt(L, 0)} m, saluran ini memungut ${fmt(qStar * L, 2)} m³/s dari samping.`
        : `Over ${fmt(L, 0)} m the channel picks up ${fmt(qStar * L, 2)} m³/s from the side.`,
      id
        ? `Di ujung hulu muka air berdiri ${fmt(beda, 3)} m lebih tinggi daripada hitungan yang sama tanpa suku percepatan, yaitu ${fmt(persen, 1)} persen dari kedalaman di situ.`
        : `At the upstream end the surface stands ${fmt(beda, 3)} m higher than the same calculation without the acceleration term, which is ${fmt(persen, 1)} per cent of the depth there.`,
      id
        ? "Selisih itu adalah harga mempercepat air yang masuk dari samping, dan justru bagian itulah yang paling sering tertinggal dalam hitungan tangan."
        : "That difference is the price of accelerating water that entered sideways, and it is the part most often left out of a hand calculation.",
      dekatTeks,
    ].filter((b): b is string => !!b),
  };
}
