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
  SentuhContoh,
  Sheet,
  StateCard,
  Term,
} from "@/components/ui";
import { DragLayer, type HandleSpec } from "@/components/DragLayer";
import { usePlate } from "@/lib/usePlate";
import type { ParamDef } from "@/lib/rentang";
import {
  drawReach,
  type ReachMarker,
  type ReachPoint,
  type ReachRegion,
  type ReachSeries,
} from "@/lib/drawReach";
import {
  G,
  backwaterExtent,
  broadCrestControlDepth,
  conjugateDepth,
  criticalDepth,
  fmt,
  froude,
  fmtPlain,
  gvfProfile,
  minControllingHeight,
  normalDepth,
  normalDepthReachable,
  specificEnergy,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksBackwater } from "@/lib/checks";

const TXT = {
  id: {
    title: "Pengaruh hilir",
    sheetTitle: "Jangkauan pembendungan ke hulu — saluran persegi prismatis",
    dQ: "Debit",
    db: "Lebar dasar",
    dn: "Kekasaran Manning",
    dS: "Kemiringan dasar",
    dP: "Tinggi bangunan di atas dasar",
    dF: "Ambang pengaruh yang dianggap habis",
    pBendung: "Bendung sedang",
    pDatar: "Saluran hampir datar",
    pKecil: "Bangunan rendah",
    rY0: "Kedalaman normal",
    rYc: "Kedalaman kritis",
    rYctl: "Kedalaman di bangunan",
    rRise: "Kenaikan di bangunan terhadap normal",
    rDist: "Jangkauan pengaruh ke hulu",
    rDist10: "Jangkauan pada ambang sepuluh persen",
    rArea: "Tambahan luas genangan per meter lebar",
    tak: "Melampaui kapasitas saluran",
    takNote:
      "Pada lebar dan kemiringan ini, saluran tidak sanggup mengalirkan debit sebesar itu berapa pun dalamnya. Tidak ada kedalaman normal, jadi tidak ada pula kenaikan, jangkauan, atau penilaian bangunan yang bisa dihitung; semuanya ditulis “—”. Perbesar lebar dasar, perbesar kemiringan, atau kurangi debitnya.",
    rDistJump: "Jarak bangunan ke loncatan air",
    tbJump: "L loncatan",
    bandTidak: "Tidak membendung",
    bandBendung: "Membendung",
    profil: "profil",
    mEnd: "pengaruh tinggal",
    gF: "Ambang ε, seret titik akhir pengaruh di sepanjang muka air ke kiri atau kanan",
    mJump: "loncatan air",
    hQ: "Debit satuan dan kedalaman kritis",
    hY0: "Kedalaman normal, Manning dibalik: debit pada y₀",
    hPmin: "Tinggi bangunan terendah yang membendung",
    hYctl: "Kedalaman di bangunan, akar subkritis E = P + 1,5 yc",
    hL: "Penelusuran profil sampai y = y₀ + ε Δy",
    hJump: "Konjugat y₀ (Belanger); L = jarak sampai profil S1 setinggi y₂",
    hTenggelam: "bangunan tidak membendung",
    hTak: "tidak ada y yang memenuhi Manning",
    lonc: "Saluran curam, loncatan air",
    loncBangunan: "Loncatan sampai di bangunan",
    membendung: "Membendung",
    loncNote:
      "Di saluran curam aliran di hulu superkritis dan tidak dapat merasakan bangunan. Pengaruh bangunan berhenti tegas di loncatan air, tempat profil S1 setinggi kedalaman konjugat y₀. Karena itu ambang ε tidak berpengaruh di sini.",
    tenggelam: "Bangunan tidak membendung",
    tenggelamNote:
      "Energi aliran normal saluran sudah melampaui yang dibutuhkan untuk melewati mercu, jadi air lewat di atasnya tanpa harus menjadi kritis dan kedalaman di hulu tetap pada kedalaman normal. Tidak ada pembendungan, tidak ada jangkauan yang bisa dihitung. Bangunan ini baru mulai membendung bila tingginya melampaui",
    tbDrowned: "tidak membendung",
    jauh: "Melewati batas pencarian",
    jauhNote:
      "Pengaruhnya belum habis bahkan setelah 500 km ke hulu. Ini bukan kesalahan hitungan melainkan sifat saluran yang sangat landai: makin datar dasarnya, makin jauh sebuah bangunan terasa. Dalam praktik batas kajian pada kasus seperti ini ditentukan oleh bangunan lain, cabang, atau perubahan penampang yang mengambil alih kendali. Curamkan sedikit dasarnya, atau turunkan bangunannya, untuk melihat angka yang berarti.",
    exagg: "pelebihan tegak",
    note:
      "Kurva pembendungan mendekati kedalaman normal secara asimtotik, sehingga pertanyaan sampai di mana pengaruh sebuah bangunan berhenti sebenarnya tidak punya jawaban tegas. Ia tidak pernah benar-benar berhenti. Yang dapat dijawab, dan yang dipakai dalam praktik untuk menentukan batas kajian genangan, adalah sampai di mana pengaruhnya tinggal sekian bagian dari kenaikan di bangunan. Nilai yang lazim dipakai satu persen, dan angka itu dapat digeser pada tabel masukan supaya terlihat betapa besar pengaruhnya terhadap panjang yang harus dikaji. Yang paling menentukan justru bukan tinggi bangunannya melainkan kemiringan dasar saluran: pada saluran landai, mengurangi kemiringan menjadi separuh biasanya membuat jangkauannya membengkak lebih dari dua kali lipat (angka untuk setelan yang sedang dipakai ada pada butir di atas). Itulah sebabnya bendung setinggi satu meter di sungai dataran rendah dapat menggenangi lahan berkilometer ke hulu, sementara bendung yang sama di kaki bukit hampir tidak terasa. Saluran curam lain lagi: profil S1 diawali loncatan air, dan pengaruh bangunan berhenti tegas di loncatan itu.",
  },
  en: {
    title: "Downstream effects",
    sheetTitle: "Upstream extent of backwater — prismatic rectangular channel",
    dQ: "Discharge",
    db: "Bed width",
    dn: "Manning roughness",
    dS: "Bed slope",
    dP: "Structure height above the bed",
    dF: "Threshold at which the influence counts as spent",
    pBendung: "Medium weir",
    pDatar: "Nearly flat channel",
    pKecil: "Low structure",
    rY0: "Normal depth",
    rYc: "Critical depth",
    rYctl: "Depth at the structure",
    rRise: "Rise at the structure above normal",
    rDist: "Upstream extent of the influence",
    rDist10: "Extent at the ten per cent threshold",
    rArea: "Extra flooded area per metre of width",
    tak: "Exceeds channel capacity",
    takNote:
      "At this width and slope the channel cannot carry that discharge at any depth. There is no normal depth, so no rise, extent, or structure assessment can be computed either; all are shown as “—”. Widen the bed, steepen the slope, or reduce the discharge.",
    rDistJump: "Distance from the structure to the jump",
    tbJump: "L to jump",
    bandTidak: "No backwater",
    bandBendung: "Holds water back",
    profil: "profile",
    mEnd: "influence down to",
    gF: "Threshold ε, drag the end of influence along the water surface left or right",
    mJump: "hydraulic jump",
    hQ: "Unit discharge and critical depth",
    hY0: "Normal depth, Manning inverted: discharge at y₀",
    hPmin: "Lowest structure that holds water back",
    hYctl: "Depth at the structure, subcritical root of E = P + 1.5 yc",
    hL: "Profile traced until y = y₀ + ε Δy",
    hJump: "Conjugate of y₀ (Belanger); L = distance to where the S1 profile reaches y₂",
    hTenggelam: "the structure does not hold water back",
    hTak: "no y satisfies Manning",
    lonc: "Steep channel, hydraulic jump",
    loncBangunan: "Jump reaches the structure",
    membendung: "Holds water back",
    loncNote:
      "On a steep channel the flow upstream is supercritical and cannot feel the structure. Its influence stops sharply at the hydraulic jump, where the S1 profile reaches the conjugate depth of y₀. That is why the threshold ε has no effect here.",
    tenggelam: "No backwater from the structure",
    tenggelamNote:
      "The energy of the channel's normal flow already exceeds what is needed to pass the crest, so water goes over without having to turn critical and the upstream depth stays at normal depth. There is no backwater and no extent to compute. The structure only begins to hold water back once its height exceeds",
    tbDrowned: "no backwater",
    jauh: "Beyond the search limit",
    jauhNote:
      "The influence has still not died out 500 km upstream. That is not a calculation error but the nature of a very flat channel: the flatter the bed, the further a structure is felt. In practice the study limit in such a case is set by another structure, a tributary, or a change of section that takes over control. Steepen the bed slightly, or lower the structure, to see a meaningful number.",
    exagg: "vertical exaggeration",
    note:
      "A backwater curve approaches normal depth asymptotically, so the question of where a structure stops being felt has no sharp answer. It never truly stops. What can be answered, and what is used in practice to set the boundary of a flood study, is where the influence has fallen to some fraction of the rise at the structure. One per cent is the usual value, and that figure can be moved in the input table to show how strongly it drives the length that has to be studied. What matters most is not the height of the structure but the bed slope: on a mild channel, halving the slope usually swells the extent by more than a factor of two (the figure for the current setting is in the list above). That is why a one-metre weir on a lowland river can flood land for kilometres upstream while the same weir at the foot of a hill is barely noticed. A steep channel is different again: the S1 profile begins with a hydraulic jump, and the structure's influence stops sharply at that jump.",
  },
} as const;

const REFS = {
  id: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Bab 10, perhitungan kurva pembendungan.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Bab 5 dan Bab 6.",
    "USACE (2016). HEC-RAS Hydraulic Reference Manual, penentuan batas hulu kajian.",
    "FEMA (2003). Guidelines and Specifications for Flood Hazard Mapping Partners, penentuan batas hulu daerah genangan.",
  ],
  en: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Chapter 10, backwater computation.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Chapters 5 and 6.",
    "USACE (2016). HEC-RAS Hydraulic Reference Manual, setting the upstream study limit.",
    "FEMA (2003). Guidelines and Specifications for Flood Hazard Mapping Partners, setting the upstream limit of the flood boundary.",
  ],
} as const;

/*
 * Rentang ambang ε dalam persen: satu definisi untuk penggeser, kotak angka,
 * dan pegangan di titik akhir pengaruh (aturan 4, satu sumber nilai).
 */
const P_EPS: ParamDef = { min: 0.5, max: 10, step: 0.5, digits: 1 };

/** Sumbu dikunci selama pegangan diseret: panjang bentang dan puncak tegak. */
type Kunci = { L: number; zTop: number };

export function PengaruhHilirClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];

  const [Q, setQ] = useState(12);
  const [b, setB] = useState(5);
  const [n, setN] = useState(0.025);
  const [S0, setS0] = useState(0.0012);
  const [P, setP] = useState(1.4);
  const [pers, setPers] = useState(1);

  const yc = criticalDepth(Q / b);
  const y0 = normalDepth(Q, b, n, S0);
  const terjangkau = normalDepthReachable(Q, b, n, S0);

  /*
   * Kedalaman di hulu bangunan, dari persamaan energi untuk mercu lebar.
   *
   * Bangunan yang terlalu rendah tidak membendung apa pun: energi aliran
   * normal sudah cukup untuk melewati mercunya. Pada keadaan itu kedalaman
   * kendalinya adalah kedalaman normal itu sendiri, sehingga seluruh hitungan
   * di bawah dengan sendirinya memberi kenaikan nol dan jangkauan nol. Tanpa
   * itu, pembaca akan membaca "jangkauan pengaruh 29 km" untuk kenaikan
   * beberapa milimeter.
   */
  const q = Q / b;
  const pMin = minControllingHeight(y0, q);
  /* Tanpa kedalaman normal, y0 hanyalah batas atas pencarian (50 m), jadi
     "tenggelam" yang dihitung dari y0 itu bukan keadaan sungguhan dan
     ditekan; yang tersisa hanya keadaan di luar kapasitas. */
  const tenggelam = terjangkau && P <= pMin;
  const bendung = terjangkau && !tenggelam;
  const yCtl = bendung ? broadCrestControlDepth(P, q) : y0;
  const r = backwaterExtent(Q, b, n, S0, yCtl, pers / 100);
  const r10 = backwaterExtent(Q, b, n, S0, yCtl, 0.1);
  /* Saluran curam (profil S1): pengaruh berhenti di loncatan air, bukan
     pada ambang ε (backwaterExtent.endsInJump). */
  const lonc = bendung && r.endsInJump && !r.beyondSearch;
  const Fr0 = froude(q / y0, y0);
  const y2 = conjugateDepth(y0, Fr0);
  const E0 = specificEnergy(y0, q);

  // Bentang yang digambar dibuat sedikit lebih panjang daripada jangkauannya,
  // supaya ujung kurva yang sudah menyatu dengan kedalaman normal ikut terlihat.
  // Saat bangunannya tidak membendung tidak ada jangkauan, jadi dipakai bentang tetap.
  /*
   * Sumbu mendatar dikunci selama titik akhir pengaruh diseret: bentang yang
   * digambar adalah 1,25 kali jangkauan, dan jangkauan ikut ε. Tanpa kunci,
   * titik akhir akan selalu jatuh di pecahan yang sama dari lebar gambar dan
   * pegangannya saling kejar dengan sumbu. Dilepas = bentang dihitung ulang.
   */
  const [kunci, setKunci] = useState<Kunci | null>(null);
  const sentuh = useRef<() => void>(() => {});
  const L = kunci
    ? kunci.L
    : !bendung
      ? 2000
      : Math.min(200000, Math.max(200, r.beyondSearch ? 20000 : r.distance * 1.25));
  const profil = gvfProfile(Q, b, n, S0, yCtl, L, 800);
  const xLonc = lonc ? L - r.distance : null;

  /*
   * Pegangan hanya ada bila ε memang menentukan jangkauan: bangunan
   * membendung, profil berakhir menuju y₀ (bukan di loncatan, tempat ε tidak
   * berpengaruh), dan jangkauannya terhitung.
   */
  const adaPegangan = bendung && !lonc && !r.beyondSearch && Math.abs(yCtl - y0) > 1e-6;
  const dy = yCtl - y0;
  /*
   * Profil pemetaan balik: tiga kali bentang gambar supaya jari yang ditarik
   * melewati tepi kiri tetap terbaca (ε makin kecil sampai dipotong ke 0,5 %
   * dengan penanda). Jarak dari bangunan d = L − x; ε = (y(d) − y₀)/Δy.
   */
  const peta = useMemo(() => {
    if (!adaPegangan) return null;
    const Lj = 3 * L;
    const pr = gvfProfile(Q, b, n, S0, yCtl, Lj, 2400);
    const d = pr.points.map((p) => Lj - p.x);
    const y = pr.points.map((p) => p.y);
    const idx = d.map((_, i) => i).sort((i, j) => d[i] - d[j]);
    return { d: idx.map((i) => d[i]), y: idx.map((i) => y[i]) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Q, b, n, S0, yCtl, L, adaPegangan]);
  const epsPada = (dJarak: number): number => {
    if (!peta || peta.d.length < 2) return NaN;
    const { d, y } = peta;
    let yy: number;
    if (dJarak <= d[0]) yy = y[0];
    else if (dJarak >= d[d.length - 1]) yy = y0;
    else {
      let k = 0;
      while (k + 1 < d.length && d[k + 1] < dJarak) k++;
      const f = (dJarak - d[k]) / Math.max(d[k + 1] - d[k], 1e-12);
      yy = y[k] + (y[k + 1] - y[k]) * f;
    }
    return ((yy - y0) / dy) * 100;
  };
  // Titik akhir pengaruh: menurut definisinya y = y₀ + ε·Δy di x = L − jarak.
  const xAkhir = L - r.distance;
  const anchors = adaPegangan
    ? { akhir: { x: xAkhir, z: (L - xAkhir) * S0 + y0 + (pers / 100) * dy } }
    : undefined;

  const plate = usePlate(
    (ctx, w, h) =>
      drawReach(ctx, w, h, {
        ...susun({
          pts: profil.points,
          y0,
          yc,
          y2,
          L,
          S0,
          P,
          jarak: r.distance,
          lewatBatas: r.beyondSearch,
          tenggelam,
          terjangkau,
          xLonc,
          profilNama: profil.profile,
          pers,
          lang,
        }),
        ...(kunci ? { xMax: kunci.L, zTop: kunci.zTop, clip: true } : {}),
        ...(anchors ? { anchors } : {}),
      }),
    null,
    [Q, b, n, S0, P, pers, lang, kunci ? kunci.L : NaN, kunci ? kunci.zTop : NaN]
  );

  const handles: HandleSpec[] = adaPegangan
    ? [
        {
          id: "akhir",
          anchor: "akhir",
          axis: "x",
          label: x.gF,
          tint: C.water,
          param: P_EPS,
          value: pers,
          toValue: (px, _py, m) => epsPada(L - m.invX(px)),
          onChange: setPers,
          format: (v) => `ε ${fmt(v, 1)} %`,
        },
      ]
    : [];
  const kunciSumbu = () => {
    const o = plate.outRef.current;
    if (!o) return;
    setKunci({ L, zTop: o.map.invY(o.map.frame.y0) });
  };
  const lepasKunci = () => setKunci(null);

  const zSpan = Math.max(S0 * L + yCtl, 1e-3);
  const exagg = L / zSpan / 1.9;
  // Tambahan luas genangan per satuan lebar: selisih kedalaman terhadap normal,
  // dijumlahkan sepanjang bentang. Pada saluran curam hanya ruas antara
  // loncatan dan bangunan yang terbendung; di hulu loncatan muka air di y₀.
  const luas = [...profil.points]
    .filter((p) => xLonc === null || p.x >= xLonc)
    .sort((a, c) => a.x - c.x)
    .reduce((acc, p, i, arr) => {
      if (i === 0) return 0;
      const dx = p.x - arr[i - 1].x;
      return acc + ((p.y - y0 + (arr[i - 1].y - y0)) / 2) * dx;
    }, 0);

  const persTeks = fmt(pers, Number.isInteger(pers) ? 0 : 1);
  const jarakTeks = (rr: { distance: number; beyondSearch: boolean }) =>
    rr.beyondSearch ? `> ${fmt(500000, 0)}` : fmt(rr.distance, 0);

  /* Nada keadaan: keadaan sah yang tidak membendung bernada netral, batas
     pencarian bernada oker; merah sinyal hanya untuk di luar kapasitas. */
  const nada: Tone = !terjangkau
    ? "invalid"
    : tenggelam
      ? "neutral"
      : r.beyondSearch
        ? "caution"
        : lonc && r.distance <= 0
          ? "neutral"
          : "water";

  const kartu = !terjangkau
    ? { badge: x.tak, state: x.takNote, notice: [] as string[] }
    : keadaan({
        x,
        lang,
        tenggelam,
        lonc,
        r,
        r10,
        P,
        pMin,
        yCtl,
        y2,
        pers,
        profilNama: profil.profile,
        separuh: tenggelam || r.beyondSearch ? null : separuhKemiringan(Q, b, n, S0, P, pers),
      });

  const langkah = [
    {
      judul: x.hQ,
      rumus: (<><span>q =</span><Frac num="Q" den="b" /><span className="ml-3">yc = ∛( q² / g )</span></>),
      isi: `${fmt(Q, 1)} / ${fmt(b, 1)} = ${fmt(q, 4)} m²/s ;  ∛( ${fmt(q, 4)}² / ${fmt(G, 2)} )`,
      hasil: fmt(yc, 3),
      satuan: "m",
      tint: C.critical,
    },
    {
      judul: x.hY0,
      rumus: (<><span>Q =</span><Frac num="1" den="n" /><span>· b y₀ · R^⅔ · S₀^½</span></>),
      isi: terjangkau
        ? `( 1 / ${fmt(n, 3)} ) · ${fmt(b, 1)} · y₀ · R^⅔ · ${fmt(S0, 5)}^½ = ${fmt(Q, 1)} m³/s`
        : x.hTak,
      hasil: terjangkau ? fmt(y0, 3) : "—",
      satuan: terjangkau ? "m" : undefined,
      tint: C.water,
    },
    ...(terjangkau
      ? [
          {
            judul: x.hPmin,
            rumus: <span>pMin = E( y₀ ) − {fmt(1.5, 1)} · yc</span>,
            isi: `${fmt(E0, 4)} − ${fmt(1.5, 1)} · ${fmt(yc, 4)} ;  P = ${fmt(P, 2)} ${tenggelam ? "≤" : ">"} pMin`,
            hasil: fmt(pMin, 3),
            satuan: "m",
          },
          {
            judul: bendung ? `${x.hYctl}: y* = ${fmt(yCtl, 3)} m` : x.hYctl,
            rumus: <span>y* + q² / ( 2 g y*² ) = P + {fmt(1.5, 1)} · yc ;  Δy = y* − y₀</span>,
            isi: bendung
              ? `${fmt(P, 2)} + ${fmt(1.5, 1)} · ${fmt(yc, 4)} = ${fmt(P + 1.5 * yc, 4)} ;  ${fmt(yCtl, 4)} − ${fmt(y0, 4)}`
              : `P ≤ pMin: ${x.hTenggelam}`,
            hasil: bendung ? fmt(r.rise, 3) : "—",
            satuan: bendung ? "m" : undefined,
            tint: C.water,
          },
          lonc
            ? {
                judul: x.hJump,
                rumus: <span>y₂ = y₀ / 2 · ( √( 1 + 8 Fr₀² ) − 1 )</span>,
                isi: `y₂ = ${fmt(y0, 4)} / 2 · ( √( 1 + 8 · ${fmt(Fr0, 3)}² ) − 1 ) = ${fmt(y2, 3)} m ;  L ( y = y₂ )`,
                hasil: fmt(r.distance, 0),
                satuan: "m",
                tint: C.water,
              }
            : {
                judul: x.hL,
                rumus: (<><Frac num="dy" den="dx" /><span>=</span><Frac num="S₀ − Sf" den="1 − Fr²" /><span className="ml-3">y = y₀ + ε Δy</span></>),
                isi: bendung
                  ? `${fmt(y0, 4)} + ${fmt(pers / 100, 3)} · ${fmt(r.rise, 4)} = ${fmt(y0 + (pers / 100) * r.rise, 4)} m ;  L₁₀ = ${jarakTeks(r10)} m`
                  : "—",
                hasil: bendung ? jarakTeks(r) : "—",
                satuan: bendung ? "m" : undefined,
                tint: C.water,
              },
        ]
      : []),
  ];

  /* Batas pita dari minControllingHeight: bangunan membendung bila
     P > E(y0) − 1,5 yc (Henderson 1966 Bab 6). Sumbu 0 sampai 5 m sama
     dengan rentang penggeser P. */
  const P_MAKS = 5;
  const labelBendung = bendung
    ? `${x.bandBendung}, ${x.profil} ${profil.profile}`
    : x.bandBendung;
  const pitaP = !terjangkau
    ? [{ from: 0, to: P_MAKS, label: x.tak, tone: "invalid" as Tone }]
    : pMin >= P_MAKS
      ? [{ from: 0, to: P_MAKS, label: x.bandTidak, tone: "neutral" as Tone }]
      : pMin <= 1e-6
        ? [{ from: 0, to: P_MAKS, label: labelBendung, tone: "water" as Tone }]
        : [
            { from: 0, to: pMin, label: x.bandTidak, tone: "neutral" as Tone },
            { from: pMin, to: P_MAKS, label: labelBendung, tone: "water" as Tone },
          ];

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="P"
          value={terjangkau ? P : NaN}
          invalid={!terjangkau}
          pesan={terjangkau ? undefined : x.tak}
          digits={2}
          bands={pitaP}
        />
      }
      sheet="HS-09"
      subject={SUBJECTS.HS[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Sebuah bangunan menahan air, dan{" "}
            <Term tint={C.water}>kenaikan muka air</Term> itu tidak berhenti di
            tempat bangunannya berdiri. Ia menjalar ke hulu, makin lemah, tanpa
            pernah benar-benar habis. Pertanyaannya bukan sampai di mana ia
            berhenti, melainkan sampai di mana ia sudah cukup kecil untuk
            diabaikan.
          </p>
        ) : (
          <p>
            A structure holds water back, and that{" "}
            <Term tint={C.water}>rise in level</Term> does not stop where the
            structure stands. It travels upstream, weakening, without ever quite
            dying out. The question is not where it stops but where it has
            become small enough to ignore.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HS-09"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "Q", value: `${fmt(Q, 1)} m³/s`, tint: C.water },
            { label: "y₀", value: terjangkau ? `${fmt(y0, 3)} m` : "—", tint: C.water },
            {
              label: lonc ? x.tbJump : `L${persTeks}%`,
              value: !terjangkau
                ? "—"
                : tenggelam
                  ? x.tbDrowned
                  : r.beyondSearch
                    ? `> ${fmt(500, 0)} km`
                    : lonc
                      ? `${fmt(r.distance, 0)} m`
                      : `${fmt(r.distance / 1000, 2)} km`,
              tint: C.water,
            },
            { label: t.tbScale, value: `${x.exagg} ${fmt(exagg, 0)}×` },
          ]}
        >
          <canvas ref={plate.ref} className="block h-full w-full" />
          {/* display: contents; hanya menangkap pointerdown/lepas dari
              pegangan untuk mengunci sumbu (pola OC-06). */}
          <div
            className="contents"
            onPointerDown={(e) => {
              if (e.pointerType === "mouse" && e.button !== 0) return;
              if (kunci) return;
              kunciSumbu();
            }}
            onPointerUp={lepasKunci}
            onPointerCancel={lepasKunci}
            onLostPointerCapture={lepasKunci}
          >
            <DragLayer out={plate.outRef.current} handles={handles} touch={() => sentuh.current()} />
          </div>
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q} min={0.5} max={80} step={0.5} digits={1} unit="m³/s" onChange={setQ} tint={C.water} />
              <InputRow symbol="b" label={x.db} value={b} min={0.5} max={25} step={0.1} digits={1} unit="m" onChange={setB} />
              <InputRow symbol="n" label={x.dn} value={n} min={0.01} max={0.07} step={0.001} digits={3} onChange={setN} />
              <InputRow symbol="S₀" label={x.dS} value={S0 * 1000} min={0.05} max={10} step={0.05} digits={2} unit="‰" onChange={(v) => setS0(v / 1000)} />
              <InputRow symbol="P" label={x.dP} value={P} min={0.1} max={5} step={0.05} unit="m" onChange={setP} />
              <InputRow symbol="ε" label={x.dF} value={pers} {...P_EPS} unit="%" onChange={setPers} />
            </InputTable>

            <SentuhContoh sentuh={sentuh} />
            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pBendung, apply: () => { setQ(12); setB(5); setN(0.025); setS0(0.0012); setP(1.4); setPers(1); } },
                  { label: x.pDatar, apply: () => { setQ(12); setB(5); setN(0.025); setS0(0.0002); setP(3.0); setPers(1); } },
                  { label: x.pKecil, apply: () => { setQ(12); setB(5); setN(0.025); setS0(0.0012); setP(1.0); setPers(1); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                {
                  symbol: "L",
                  label: lonc ? x.rDistJump : x.rDist,
                  value: bendung ? jarakTeks(r) : "—",
                  unit: bendung ? "m" : undefined,
                  tint: C.water,
                  strong: true,
                },
                {
                  symbol: "Δy",
                  label: x.rRise,
                  value: terjangkau ? fmt(r.rise, 3) : "—",
                  unit: terjangkau ? "m" : undefined,
                  strong: true,
                },
                {
                  symbol: "L₁₀",
                  label: x.rDist10,
                  value: bendung && !lonc ? jarakTeks(r10) : "—",
                  unit: bendung && !lonc ? "m" : undefined,
                },
                { symbol: "y₀", label: x.rY0, value: terjangkau ? fmt(y0, 3) : "—", unit: terjangkau ? "m" : undefined, tint: C.water },
                { symbol: "yc", label: x.rYc, value: fmt(yc, 3), unit: "m", tint: C.critical },
                { symbol: "y*", label: x.rYctl, value: terjangkau ? fmt(yCtl, 3) : "—", unit: terjangkau ? "m" : undefined, tint: C.water },
                { symbol: "A", label: x.rArea, value: terjangkau ? fmt(luas, 0) : "—", unit: terjangkau ? "m²/m" : undefined },
              ]}
            />
            <div className="mt-3">
              <Hitungan langkah={langkah} />
            </div>
          </Block>

          <StateCard tone={nada} badge={kartu.badge} state={kartu.state} notice={kartu.notice} />
        </>
      }
      verification={<Verification checks={checksBackwater(Q, b, n, S0, yCtl)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <Frac num="dy" den="dx" />
                <span>=</span>
                <Frac num="S₀ − Sf" den="1 − Fr²" />
                <span className="ml-5">y → y₀</span>
                <span className="ml-2 text-ink-3">
                  {lang === "id" ? "secara asimtotik (profil M1)" : "asymptotically (M1 profile)"}
                </span>
              </Eq>
              <Eq>
                <span>L = x ( y = y₀ + ε Δy )</span>
                <span className="ml-4 text-ink-3">
                  {lang === "id"
                    ? "batas ditentukan ambang, bukan oleh persamaannya"
                    : "the limit is set by a threshold, not by the equation"}
                </span>
              </Eq>
              <Eq>
                <span>L = x ( y = y₂ ),</span>
                <span className="ml-2">y₂ = y₀ / 2 · ( √( 1 + 8 Fr₀² ) − 1 )</span>
                <span className="ml-4 text-ink-3">
                  {lang === "id" ? "saluran curam (profil S1)" : "steep channel (S1 profile)"}
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
 * Kemiringan separuh: angka, bukan janji
 * ------------------------------------------------------------------ */

type Separuh =
  | { jenis: "tak"; S: number }
  | { jenis: "tenggelam"; S: number; pMin: number }
  | { jenis: "hitung"; S: number; r: ReturnType<typeof backwaterExtent> };

/*
 * Kalimat lama "turunkan kemiringan menjadi separuh … jauh lebih dari dua
 * kali" benar pada 1,2 → 0,6 permil (×2,40) tetapi salah pada 0,4 → 0,2
 * (bangunan jadi tidak membendung) dan 10 → 5 (×1,96). Sekarang kemiringan
 * separuh dihitung dengan model yang sama dan angkanya yang ditulis.
 */
function separuhKemiringan(Q: number, b: number, n: number, S0: number, P: number, pers: number): Separuh {
  const S = S0 / 2;
  if (!normalDepthReachable(Q, b, n, S)) return { jenis: "tak", S };
  const y0h = normalDepth(Q, b, n, S);
  const pm = minControllingHeight(y0h, Q / b);
  if (P <= pm) return { jenis: "tenggelam", S, pMin: pm };
  return {
    jenis: "hitung",
    S,
    r: backwaterExtent(Q, b, n, S, broadCrestControlDepth(P, Q / b), pers / 100),
  };
}

function keadaan(a: {
  x: (typeof TXT)[Lang];
  lang: Lang;
  tenggelam: boolean;
  lonc: boolean;
  r: ReturnType<typeof backwaterExtent>;
  r10: ReturnType<typeof backwaterExtent>;
  P: number;
  pMin: number;
  yCtl: number;
  y2: number;
  pers: number;
  profilNama: string;
  separuh: Separuh | null;
}): { badge: string; state: string; notice: string[] } {
  const { x, r, r10, pers } = a;
  const en = a.lang === "en";
  const km = (m: number) => fmt(m / 1000, 2);

  if (a.tenggelam)
    return {
      badge: x.tenggelam,
      state: en
        ? `P ${fmt(a.P, 2)} m ≤ ${fmt(a.pMin, 2)} m: the structure does not hold water back.`
        : `P ${fmt(a.P, 2)} m ≤ ${fmt(a.pMin, 2)} m: bangunan tidak membendung.`,
      notice: [
        `${x.tenggelamNote} ${fmt(a.pMin, 2)} m.`,
        en
          ? "There is nothing to study: raise the structure past that limit and watch the extent appear the moment it begins to hold water back."
          : "Tidak ada yang perlu dikaji: tinggikan bangunannya melewati batas itu, lalu perhatikan jangkauan yang muncul begitu ia mulai membendung.",
      ],
    };

  if (r.beyondSearch)
    return {
      badge: x.jauh,
      state: en
        ? `The ${fmt(r.rise, 3)} m rise at the structure is still felt more than ${fmt(500, 0)} km upstream (threshold ${fmt(pers, 1)} %).`
        : `Kenaikan ${fmt(r.rise, 3)} m di bangunan masih terasa lebih dari ${fmt(500, 0)} km ke hulu (ambang ${fmt(pers, 1)} %).`,
      notice: [x.jauhNote],
    };

  const kalimatSeparuh = (): string | null => {
    const s = a.separuh;
    if (!s) return null;
    const Sp = fmt(s.S * 1000, 3);
    if (s.jenis === "tak")
      return en
        ? `At half the slope (${Sp} ‰) the channel can no longer carry this discharge at any depth.`
        : `Pada kemiringan separuh (${Sp} ‰) saluran tidak lagi sanggup mengalirkan debit ini berapa pun dalamnya.`;
    if (s.jenis === "tenggelam")
      return en
        ? `At half the slope (${Sp} ‰) normal depth rises so much that a ${fmt(a.P, 2)} m structure no longer holds water back (the limit becomes ${fmt(s.pMin, 2)} m).`
        : `Pada kemiringan separuh (${Sp} ‰) kedalaman normal naik sampai bangunan ${fmt(a.P, 2)} m tidak lagi membendung (batasnya menjadi ${fmt(s.pMin, 2)} m).`;
    const rh = s.r;
    if (rh.beyondSearch)
      return en
        ? `At half the slope (${Sp} ‰) the influence reaches beyond ${fmt(500, 0)} km.`
        : `Pada kemiringan separuh (${Sp} ‰) pengaruhnya melewati ${fmt(500, 0)} km.`;
    if (rh.endsInJump)
      return en
        ? `At half the slope (${Sp} ‰) the channel is still steep; the jump stands ${fmt(rh.distance, 0)} m upstream of the structure.`
        : `Pada kemiringan separuh (${Sp} ‰) saluran masih curam; loncatan air berada ${fmt(rh.distance, 0)} m di hulu bangunan.`;
    if (a.lonc || r.distance <= 0)
      return en
        ? `At half the slope (${Sp} ‰) the channel turns mild and the influence reaches ${km(rh.distance)} km at the ${fmt(pers, 1)} per cent threshold.`
        : `Pada kemiringan separuh (${Sp} ‰) saluran menjadi landai dan pengaruhnya mencapai ${km(rh.distance)} km pada ambang ${fmt(pers, 1)} persen.`;
    const kali = fmt(rh.distance / r.distance, 2);
    return en
      ? `At half the slope (${Sp} ‰) the extent becomes ${km(rh.distance)} km, ${kali} times the present one.`
      : `Pada kemiringan separuh (${Sp} ‰) jangkauannya menjadi ${km(rh.distance)} km, ${kali} kali yang sekarang.`;
  };

  if (a.lonc) {
    const diBangunan = r.distance <= 0;
    return {
      badge: diBangunan ? x.loncBangunan : x.lonc,
      state: diBangunan
        ? en
          ? `The depth at the structure, ${fmt(a.yCtl, 3)} m, does not exceed the conjugate of y₀ (${fmt(a.y2, 3)} m): the jump is pushed onto the structure and the flow upstream stays supercritical at y₀.`
          : `Kedalaman di bangunan ${fmt(a.yCtl, 3)} m tidak melampaui konjugat y₀ (${fmt(a.y2, 3)} m): loncatan air terdorong sampai ke bangunan, dan aliran di hulunya tetap superkritis pada y₀.`
        : en
          ? `Steep channel: the ${fmt(r.rise, 3)} m rise at the structure stops at a hydraulic jump ${fmt(r.distance, 0)} m upstream, where the S1 profile reaches y₂ ${fmt(a.y2, 3)} m.`
          : `Saluran curam: kenaikan ${fmt(r.rise, 3)} m di bangunan berhenti di loncatan air ${fmt(r.distance, 0)} m ke hulu, tempat profil S1 setinggi y₂ ${fmt(a.y2, 3)} m.`,
      notice: [x.loncNote, kalimatSeparuh()].filter((v): v is string => v !== null),
    };
  }

  const notice: string[] = [];
  if (pers < 10 && r10.distance > 0) {
    const rasio = fmt(r.distance / r10.distance, 1);
    notice.push(
      en
        ? `At ten per cent the influence reaches only ${km(r10.distance)} km. The ratio is ${rasio} to one, and it comes from the shape of the curve rather than from the structure: the last fraction of the rise takes the longest to disappear.`
        : `Pada ambang sepuluh persen pengaruhnya hanya ${km(r10.distance)} km. Perbandingannya ${rasio} banding satu, dan itu datang dari bentuk kurvanya, bukan dari bangunannya: bagian terakhir dari kenaikan itulah yang paling lama hilang.`
    );
  }
  const sp = kalimatSeparuh();
  if (sp) notice.push(sp);
  if (a.profilNama === "M1")
    notice.push(
      en
        ? "On an M1 profile the influence never truly dies out; L is only where the remaining rise has fallen to ε of Δy."
        : "Pada profil M1 pengaruhnya tidak pernah benar-benar habis; L hanyalah tempat sisa kenaikannya tinggal ε dari Δy."
    );

  return {
    badge: `${x.profil} ${a.profilNama}`,
    state: en
      ? `The ${fmt(r.rise, 3)} m rise at the structure is felt ${km(r.distance)} km upstream (threshold ${fmt(pers, 1)} %).`
      : `Kenaikan ${fmt(r.rise, 3)} m di bangunan terasa sampai ${km(r.distance)} km ke hulu (ambang ${fmt(pers, 1)} %).`,
    notice,
  };
}

/* ------------------------------------------------------------------ *
 * Penyusunan gambar
 * ------------------------------------------------------------------ */

function susun(a: {
  pts: { x: number; y: number; nearCritical: boolean }[];
  y0: number;
  yc: number;
  y2: number;
  L: number;
  S0: number;
  P: number;
  jarak: number;
  lewatBatas: boolean;
  tenggelam: boolean;
  terjangkau: boolean;
  /** Absis loncatan air pada saluran curam, null bila tidak ada */
  xLonc: number | null;
  profilNama: string;
  pers: number;
  lang: Lang;
}) {
  const { y0, yc, L, S0, P, jarak, lang } = a;
  const T = cl(lang);
  const x = TXT[lang];
  const zb = (xx: number) => (L - xx) * S0;

  const bed: ReachPoint[] = [
    { x: 0, z: zb(0) },
    { x: L, z: 0 },
  ];

  const urut = [...a.pts].sort((p, c) => p.x - c.x);
  /* Saluran curam: di hulu loncatan aliran superkritis pada y₀ dan tidak
     merasakan bangunan, jadi muka airnya digambar di y₀ sampai loncatan,
     lalu naik tegak ke profil S1. Profil S1 di hulu loncatan (yang turun
     menuju kritis) bukan muka air sungguhan dan tidak digambar. */
  const air: ReachPoint[] =
    a.xLonc === null
      ? urut.map((p) => ({ x: p.x, z: zb(p.x) + p.y, invalid: p.nearCritical }))
      : [
          { x: 0, z: zb(0) + y0 },
          { x: a.xLonc, z: zb(a.xLonc) + y0 },
          ...urut
            .filter((p) => p.x >= (a.xLonc as number))
            .map((p) => ({ x: p.x, z: zb(p.x) + p.y, invalid: p.nearCritical })),
        ];

  const garis: ReachSeries[] = [
    {
      pts: [
        { x: 0, z: zb(0) + y0 },
        { x: L, z: y0 },
      ],
      color: C.water,
      weight: W.thin,
      dash: DASH.hidden,
      label: `y₀ ${fmtPlain(y0, 2)} m`,
      labelAt: 0.02,
      labelDy: 11,
    },
    {
      pts: [
        { x: 0, z: zb(0) + yc },
        { x: L, z: yc },
      ],
      color: C.critical,
      weight: W.hair,
      dash: DASH.axis,
      label: `yc ${fmtPlain(yc, 2)} m`,
      labelAt: 0.5,
      labelDy: 11,
    },
    // Bangunan di hilir digambar sebagai badan pejal, bukan sekadar garis.
    {
      pts: [
        { x: L, z: 0 },
        { x: L, z: P },
      ],
      color: C.ink,
      weight: W.bold,
    },
  ];

  const tanda: ReachMarker[] = [
    {
      x: L,
      label: T.structure,
      color: C.ink,
      zBottom: 0,
      dim: {
        zTop: P,
        zBottom: 0,
        text: `P ${fmtPlain(P, 2)} m`,
        side: -1,
      },
    },
  ];

  const bendung = a.terjangkau && !a.tenggelam;
  if (bendung && !a.lewatBatas && jarak > 0 && jarak <= L) {
    const xr = L - jarak;
    const lonc = a.xLonc !== null;
    tanda.push({
      x: xr,
      /* Label memuat ambang yang sedang dipakai, bukan "1 %" yang dipatok;
         pada saluran curam penandanya loncatan air. */
      label: lonc ? x.mJump : `${x.mEnd} ${fmtPlain(a.pers, Number.isInteger(a.pers) ? 0 : 1)}%`,
      color: lonc ? C.critical : C.water,
      zBottom: zb(xr),
      dim: {
        zTop: zb(xr) + (lonc ? a.y2 : (urut.find((p) => p.x >= xr)?.y ?? y0)),
        zBottom: zb(xr),
        text: `${fmtPlain(jarak, 0)} m`,
        side: 1,
      },
    });
  }

  // Gambar harus menyatakan hal yang sama dengan tabel. Saat bangunannya
  // tidak membendung, muka airnya seragam dan nama profil tidak berlaku,
  // jadi yang ditulis adalah keadaannya, dengan tinta netral (keadaan sah).
  const wilayah: ReachRegion[] = [
    {
      x: L * 0.55,
      z: zb(L * 0.55) + Math.max(y0, yc) * 2.1,
      text: !a.terjangkau ? x.tak : a.tenggelam ? T.structureDrowned : a.profilNama,
      color: !a.terjangkau ? C.signal : a.tenggelam ? C.ink2 : C.ink,
      big: true,
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
