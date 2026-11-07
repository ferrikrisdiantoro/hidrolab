"use client";

import { useMemo, useRef, useState } from "react";
import { Basis, Eq, Frac, LabShell } from "@/components/LabShell";
import {
  Block,
  Hitungan,
  InputRow,
  InputTable,
  PresetRow,
  ResultTable,
  SentuhContoh,
  Sheet,
  StateCard,
  Term,
} from "@/components/ui";
import { DragLayer, type HandleSpec } from "@/components/DragLayer";
import { usePlate, usePutar } from "@/lib/usePlate";
import type { ParamDef } from "@/lib/rentang";
import { drawField, type FieldLine, type FieldMarker } from "@/lib/drawField";
import {
  VORTEX_CORE,
  VORTEX_MAX,
  createVortexMotion,
  drawArrowLegend,
  drawVortexArrows,
  drawVortexMotion,
  fieldReferenceSpeed,
  hamiltonianDrift,
  loadVortices,
  trackPath,
  vortexTimeScale,
  vortexTrack,
  type VortexMotion,
} from "@/lib/swarmMotion";
import { fmt, vortexPair } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksVortexPair } from "@/lib/checks";

const TXT = {
  id: {
    title: "Kinematika vorteks",
    sheetTitle: "Lintasan pusaran titik selama dua puluh detik",
    dA: "Sirkulasi pusaran pertama",
    dB: "Sirkulasi pusaran kedua",
    dS: "Jarak awal antar keduanya",
    pLawan: "Berlawanan arah, pasangannya berpindah lurus",
    pSearah: "Searah, keduanya saling mengelilingi",
    pTimpang: "Kuatnya timpang, yang lemah mengelilingi yang kuat",
    pTiga: "Tiga pusaran searah di sudut segitiga",
    rPindah: "Kecepatan pindah pasangan sama kuat berlawanan arah",
    rSudut: "Kecepatan sudut putaran pasangannya",
    rPeriode: "Waktu satu putaran penuh",
    rAkhir: "Jarak keduanya di akhir pengamatan",
    rHanyut: "Perubahan jarak selama pengamatan",
    lawan: "Berlawanan arah, pasangannya berpindah lurus",
    searah: "Searah, keduanya saling mengelilingi",
    lawanTimpang: "Berlawanan tetapi tidak sama kuat, keduanya mengelilingi titik di luar pasangannya",
    satuNol: "Satu pusaran tanpa sirkulasi",
    tanpa: "Tanpa pusaran",
    sLaju: (k: string, u: string) => `${k}: U = ${u} m/s.`,
    sPutar: (k: string, w: string, T: string) => `${k}: Ω = ${w} rad/s, satu putaran tiap ${T} s.`,
    sSatu: (k: string, pasif: string, aktif: string, w: string, T: string) =>
      `${k}: pusaran ${pasif} hanya terbawa dan mengelilingi pusaran ${aktif}, yang diam karena tidak ada yang membawanya. Ω = ${w} rad/s, satu putaran tiap ${T} s.`,
    sTanpa: "Tanpa pusaran: kedua sirkulasi nol, jadi tidak ada kecepatan yang ditimbulkan dan tidak ada yang bergerak.",
    nDekatLaju: (d1: string, d2: string, a: string, b: string) =>
      `Separuhkan jaraknya dari ${d1} ke ${d2} m: kecepatan pindahnya naik dari ${a} ke ${b} m/s, dua kali.`,
    nDekatPutar: (d1: string, d2: string, a: string, b: string) =>
      `Separuhkan jaraknya dari ${d1} ke ${d2} m: kecepatan sudutnya naik dari ${a} ke ${b} rad/s, empat kali.`,
    nBanding: (u: string, T: string) =>
      `Dengan kekuatan sama besar berlawanan arah, pasangannya berpindah ${u} m/s dan tidak pernah berputar; dengan kekuatan sama besar searah ia tidak berpindah dan berputar satu kali tiap ${T} s.`,
    nJarak: (dd: string) => `Jarak keduanya hanya bergeser ${dd} m selama pengamatan: pusaran titik menjaga jaraknya.`,
    jSum: "Jumlah sirkulasi",
    jU: "Kecepatan pindah (jumlah sirkulasi nol)",
    jW: "Kecepatan sudut putaran",
    jT: "Waktu satu putaran",
    jXc: "Titik berat sirkulasi, tempat keduanya berputar",
    jD: "Pemeriksaan: jarak di akhir pengamatan",
    dK: "Sirkulasi pusaran yang ditaruh",
    pusaranKe: (k: number) => `pusaran ${k}`,
    keluar: "lintasan keluar bidang",
    diLuar: (n: number) => `${n} pusaran yang ditaruh di luar bingkai`,
    gKBelum: "Berlaku sesudah pusaran ketiga ditaruh di gambar.",
    nKasar: (dH: string) =>
      `Pusarannya berdesakan sangat rapat sehingga langkah hitungnya dikasarkan supaya halaman tidak macet (paling banyak 40 000 langkah per pengamatan). Akibatnya energi H berubah ${dH} % dari skala S selama pengamatan, padahal mestinya tetap: lintasannya hanya perkiraan. Renggangkan pusarannya atau kecilkan sirkulasinya.`,
    tambah: "Tambah pusaran",
    gPos: (k: number) => `Posisi pusaran ${k}`,
    gD1: "Jarak awal, seret pusaran pertama",
    gD2: "Jarak awal, seret pusaran kedua",
    taruhPetunjuk: (n: number) =>
      `Klik di gambar untuk menaruh pusaran ketiga dan seterusnya (paling banyak ${n} pusaran). Seret pusaran pertama atau kedua untuk mengubah jarak awalnya; pusaran yang ditaruh bisa diseret ke mana saja dan dihapus dengan tombol Delete.`,
    hapusSemua: "Hapus pusaran yang ditaruh",
    banyak: (n: number) => `${n} pusaran, tanpa bentuk tertutup`,
    sBanyak: (n: number, G: string, dH: string) =>
      `${n} pusaran: tidak ada rumus tertutup, jadi lintasannya dihitung langkah demi langkah. Yang tetap selama pengamatan: jumlah sirkulasi ${G} m²/s, titik berat sirkulasi, dan energi Kirchhoff H (berubah ${dH} % dari skala S).`,
    rN: "Banyaknya pusaran",
    rSum: "Jumlah sirkulasi",
    rXc: "Titik berat sirkulasi, x",
    rYc: "Titik berat sirkulasi, y",
    rH: "Energi Kirchhoff H di awal",
    rdH: "Perubahan H selama pengamatan, terhadap skala S",
    rdI: "Pergeseran titik berat selama pengamatan",
    jIx: "Titik berat sirkulasi",
    jH: "Energi Kirchhoff (fungsi Hamilton)",
    jHinti: "bila rᵢⱼ < a: bentuk inti Rankine, Lamb Art. 27",
    jS: "Skala energi, selalu positif (H sendiri bisa nol)",
    jdH: "Pemeriksaan: H di akhir dibanding di awal",
    nBanyak:
      "Tiga pusaran masih teratur; empat atau lebih umumnya kacau: susunan awal yang berbeda sedikit saja berakhir sangat berbeda (Aref 1983). Besaran kekalnya tetap terjaga, dan itulah yang diperiksa di tabel hasil.",
    nInti: (a: string) =>
      `Inti tiap pusaran dianggap berjari-jari ${a} m (inti Rankine, Lamb pasal 27): di dalamnya kecepatan sebanding jarak, supaya pelacak dan panah tidak tak hingga di pusatnya. Selama dua pusaran berjarak lebih dari itu, geraknya sama persis dengan pusaran titik.`,
    clock: "t = ",
    legend: "panah penuh: ≥ ",
    motionNote: (skala: string) =>
      skala === "1"
        ? "diputar ulang 0 sampai 20 s, waktu nyata. Titik biru = pelacak yang hanyut di medan pusaran"
        : `diputar ulang 0 sampai 20 s, waktu diperlambat ×${skala} supaya putarannya terbaca. Titik biru = pelacak yang hanyut di medan pusaran`,
    note:
      "Pusaran titik adalah salah satu benda pikiran yang paling jujur dalam mekanika fluida: ia tidak punya inti, tidak punya kekentalan, dan tidak punya massa, tetapi gerakannya meramalkan gerak pusaran sungguhan dengan ketepatan yang mengejutkan selama intinya masih rapat. Aturannya satu kalimat: setiap pusaran hanyut terbawa kecepatan yang ditimbulkan pusaran lain di tempatnya berada, dan tidak terbawa kecepatannya sendiri. Dari satu kalimat itu lahir dua perilaku yang sama sekali berbeda. Sepasang pusaran yang berlawanan arah saling mendorong ke arah yang sama, sehingga keduanya berpindah lurus sebagai satu pasangan sambil menjaga jaraknya; itulah yang membuat cincin asap melaju dan membuat pusaran ujung sayap pesawat turun perlahan di belakangnya. Sepasang yang searah sebaliknya saling memutar mengelilingi titik berat sirkulasinya, yang tepat di tengah hanya bila keduanya sama kuat, dan makin dekat keduanya makin cepat putarannya. Yang pantas diingat: jarak antar keduanya tidak berubah pada kedua keadaan itu, dan pusaran yang tampak saling mendekat pada aliran sungguhan sedang melakukan sesuatu yang lain, biasanya menyatu karena kekentalan, yang sama sekali tidak ada di dalam model ini.",
  },
  en: {
    title: "Vortex kinematics",
    sheetTitle: "The paths of point vortices over twenty seconds",
    dA: "Circulation of the first vortex",
    dB: "Circulation of the second",
    dS: "Initial separation",
    pLawan: "Counter-rotating, the pair translates",
    pSearah: "Co-rotating, the two orbit each other",
    pTimpang: "Unequal strengths, the weak orbits the strong",
    pTiga: "Three like vortices at the corners of a triangle",
    rPindah: "Translation speed of an equal and opposite pair",
    rSudut: "Angular speed of the pair's orbit",
    rPeriode: "Time for one full revolution",
    rAkhir: "Separation at the end of the observation",
    rHanyut: "Change in separation over the observation",
    lawan: "Counter-rotating, the pair translates",
    searah: "Co-rotating, the two orbit each other",
    lawanTimpang: "Opposite but unequal, the two orbit a point outside the pair",
    satuNol: "One vortex without circulation",
    tanpa: "No vortices",
    sLaju: (k: string, u: string) => `${k}: U = ${u} m/s.`,
    sPutar: (k: string, w: string, T: string) => `${k}: Ω = ${w} rad/s, one revolution every ${T} s.`,
    sSatu: (k: string, pasif: string, aktif: string, w: string, T: string) =>
      `${k}: vortex ${pasif} is only carried and orbits vortex ${aktif}, which stays still because nothing carries it. Ω = ${w} rad/s, one revolution every ${T} s.`,
    sTanpa: "No vortices: both circulations are zero, so no velocity is induced and nothing moves.",
    nDekatLaju: (d1: string, d2: string, a: string, b: string) =>
      `Halve the separation from ${d1} to ${d2} m: the translation speed rises from ${a} to ${b} m/s, twice.`,
    nDekatPutar: (d1: string, d2: string, a: string, b: string) =>
      `Halve the separation from ${d1} to ${d2} m: the angular speed rises from ${a} to ${b} rad/s, four times.`,
    nBanding: (u: string, T: string) =>
      `With equal and opposite strengths the pair translates at ${u} m/s and never turns; with equal like strengths it does not translate and orbits once every ${T} s.`,
    nJarak: (dd: string) => `The separation drifts by only ${dd} m over the observation: point vortices keep their distance.`,
    jSum: "Total circulation",
    jU: "Translation speed (zero total circulation)",
    jW: "Angular speed of the orbit",
    jT: "Time for one revolution",
    jXc: "Centre of circulation, about which both turn",
    jD: "Check: separation at the end of the observation",
    dK: "Circulation of the placed vortices",
    pusaranKe: (k: number) => `vortex ${k}`,
    keluar: "path leaves the plot",
    diLuar: (n: number) => `${n} placed ${n === 1 ? "vortex" : "vortices"} outside the frame`,
    gKBelum: "Takes effect once a third vortex is placed on the drawing.",
    nKasar: (dH: string) =>
      `The vortices are packed so closely that the time step was coarsened so the page does not freeze (at most 40 000 steps per observation). As a result the energy H changes by ${dH} % of the scale S over the observation although it should stay fixed: the paths are only approximate. Spread the vortices or reduce their circulation.`,
    tambah: "Add vortex",
    gPos: (k: number) => `Position of vortex ${k}`,
    gD1: "Initial separation, drag the first vortex",
    gD2: "Initial separation, drag the second vortex",
    taruhPetunjuk: (n: number) =>
      `Click the drawing to place a third vortex and more (at most ${n} vortices). Drag the first or second vortex to change their initial separation; placed vortices can be dragged anywhere and removed with the Delete key.`,
    hapusSemua: "Remove the placed vortices",
    banyak: (n: number) => `${n} vortices, no closed form`,
    sBanyak: (n: number, G: string, dH: string) =>
      `${n} vortices: there is no closed-form solution, so the paths are computed step by step. What stays fixed over the observation: total circulation ${G} m²/s, the centre of circulation, and the Kirchhoff energy H (changing by ${dH} % of the scale S).`,
    rN: "Number of vortices",
    rSum: "Total circulation",
    rXc: "Centre of circulation, x",
    rYc: "Centre of circulation, y",
    rH: "Kirchhoff energy H at the start",
    rdH: "Change in H over the observation, against the scale S",
    rdI: "Drift of the centre over the observation",
    jIx: "Centre of circulation",
    jH: "Kirchhoff energy (the Hamiltonian)",
    jHinti: "if rᵢⱼ < a: the Rankine-core form, Lamb Art. 27",
    jS: "Energy scale, always positive (H itself can be zero)",
    jdH: "Check: H at the end against the start",
    nBanyak:
      "Three vortices are still regular; four or more are generally chaotic: starting arrangements that differ only slightly end very differently (Aref 1983). The conserved quantities still hold, and that is what the result table checks.",
    nInti: (a: string) =>
      `Each vortex is given a core of radius ${a} m (a Rankine core, Lamb art. 27): inside it the velocity grows with distance, so tracers and arrows do not become infinite at the centre. As long as two vortices are farther apart than that, their motion is exactly that of point vortices.`,
    clock: "t = ",
    legend: "full arrow: ≥ ",
    motionNote: (skala: string) =>
      skala === "1"
        ? "replayed from 0 to 20 s, real time. Blue dots = tracers drifting in the vortex field"
        : `replayed from 0 to 20 s, time slowed ×${skala} so the turning can be read. Blue dots = tracers drifting in the vortex field`,
    note:
      "The point vortex is one of the most honest thought-objects in fluid mechanics: it has no core, no viscosity, and no mass, yet its motion predicts the motion of real vortices with surprising accuracy as long as their cores stay compact. Its rule is one sentence: each vortex drifts with the velocity that the others induce at its own position, and not with its own. From that one sentence two completely different behaviours are born. A counter-rotating pair pushes itself the same way at both ends, so the two translate in a straight line as one pair while keeping their distance; this is what drives a smoke ring forward and what makes an aircraft's wingtip vortices sink slowly behind it. A co-rotating pair instead turns about its centre of circulation, which lies at the midpoint only when the two are equally strong, and the closer they are the faster they turn. Worth remembering: the separation does not change in either case, and vortices that appear to approach each other in a real flow are doing something else, usually merging under viscosity, which is entirely absent from this model.",
  },
} as const;

/* Rentang yang SAMA untuk penggeser dan pegangan seret. */
const P_D: ParamDef = { min: 0.5, max: 8, step: 0.1, digits: 1 };
const P_POS: ParamDef = { min: -20, max: 20, step: 0.1, digits: 1 };
/* Pusaran pertama biru garis penuh, kedua ungu putus-putus (seperti
   sebelumnya); yang ditaruh tinta, garis sumbu. */
const WARNA = [C.water, C.critical, C.ink2] as const;
const JENIS = [DASH.solid, DASH.hidden, DASH.axis] as const;

const REFS = {
  id: [
    "Helmholtz, H. von (1858). Über Integrale der hydrodynamischen Gleichungen.",
    "Lamb, H. (1932). Hydrodynamics, edisi ke-6, bab 7.",
    "Saffman, P.G. (1992). Vortex Dynamics.",
    "Aref, H. (1983). Integrable, chaotic, and turbulent vortex motion. Annu. Rev. Fluid Mech. 15, 345–389.",
  ],
  en: [
    "Helmholtz, H. von (1858). Über Integrale der hydrodynamischen Gleichungen.",
    "Lamb, H. (1932). Hydrodynamics, 6th ed., ch. 7.",
    "Saffman, P.G. (1992). Vortex Dynamics.",
    "Aref, H. (1983). Integrable, chaotic, and turbulent vortex motion. Annu. Rev. Fluid Mech. 15, 345–389.",
  ],
} as const;

export function KinematikaVorteksClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [gA, setGA] = useState(10);
  const [gB, setGB] = useState(-10);
  const [jarak, setJarak] = useState(2);
  /* Pusaran ketiga dan seterusnya: posisi dari klik/seret, sirkulasi
     bersama dari satu penggeser. */
  const [tambahan, setTambahan] = useState<{ x: number; y: number }[]>([]);
  const [gK, setGK] = useState(10);
  const sentuh = useRef<() => void>(() => {});
  const { playing, toggle: togglePutar } = usePutar();
  const gerak = useRef<VortexMotion | null>(null);
  if (gerak.current === null) gerak.current = createVortexMotion();
  /* Pembaca medan untuk lapis statis (panah pada susunan awal). */
  const medanAwal = useRef<VortexMotion | null>(null);
  if (medanAwal.current === null) medanAwal.current = createVortexMotion(0, 1);

  const r = vortexPair(gA, gB, jarak);
  const N = 2 + tambahan.length;
  const banyak = N > 2;
  /* Kunci susunan: primitif, untuk useMemo dan deps lapis statis. */
  const kunci = `${gA}|${gB}|${jarak}|${banyak ? gK : ""}|${tambahan.map((p) => `${p.x},${p.y}`).join(";")}`;
  const track = useMemo(() => {
    const vs = [
      { x: -jarak / 2, y: 0, gamma: gA },
      { x: jarak / 2, y: 0, gamma: gB },
      ...tambahan.map((p) => ({ x: p.x, y: p.y, gamma: gK })),
    ];
    return vortexTrack(vs, 20, VORTEX_CORE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci]);
  const timeScale = vortexTimeScale(track.maxPairRate);
  const teksSkala = timeScale === 1 ? "1" : fmt(1 / timeScale, 0);
  /* Hanya pasangan yang jumlah sirkulasinya nol yang melaju lurus. Yang
     berlawanan tetapi tidak sama kuat tetap berputar, dengan pusat di luar
     ruas penghubungnya. */
  const sum = gA + gB;
  const tanpa = gA === 0 && gB === 0;
  const satuNol = !tanpa && (gA === 0 || gB === 0);
  const berputar = !r.translates && !tanpa;
  const keadaan = banyak
    ? x.banyak(N)
    : tanpa
      ? x.tanpa
      : satuNol
        ? x.satuNol
        : r.translates
          ? x.lawan
          : r.counterRotating
            ? x.lawanTimpang
            : x.searah;
  /* Titik berat sirkulasi, dari susunan awal (−d/2, 0) dan (d/2, 0). */
  const xc = sum !== 0 ? (gA * (-jarak / 2) + gB * (jarak / 2)) / sum : NaN;

  /* Besaran kekal N pusaran (Lamb Art. 154, 167), awal dan akhir. */
  const inv0 = track.start;
  const inv1 = track.end;
  /* ΔH dibagi skala positif S = (1/2π) Σ|ΓiΓj|, bukan |H(0)|: H(0) bisa
     nol (Γ 10, 10, −10 di (−1;0), (1;0), (0;1)) dan persennya meledak. */
  const drift = hamiltonianDrift(track);
  const dHpct = drift.percent;
  const adaPusat = Number.isFinite(inv0.centreX);
  const geserPusat = adaPusat
    ? Math.hypot(inv1.centreX - inv0.centreX, inv1.centreY - inv0.centreY)
    : NaN;

  /* Lintasan yang digambar: vortexPair untuk dua pusaran (bentuk tertutup,
     sama dengan tabel), jejak M3 untuk tiga atau lebih. */
  const jalur = useMemo(
    () =>
      banyak
        ? Array.from({ length: N }, (_, i) => trackPath(track, i))
        : [r.pathA, r.pathB],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kunci]
  );

  /* Bidang gambar ditentukan hanya oleh penggeser (lintasan pasangan
     pusaran 1 dan 2), tidak oleh pusaran yang ditaruh: menaruh, menyeret,
     atau menghapus pusaran tidak mengubah skala, jadi pusaran tetap di
     tempat klik. Lintasan yang keluar dipotong bingkai dan diberi penanda.
     Selama pegangan d diseret bidangnya dibekukan: bila sumbunya ikut
     berubah di bawah jari, jarak yang diseret dan skala saling kejar. */
  const bidangBaru = useMemo(() => {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const j of [r.pathA, r.pathB])
      for (const p of j) {
        if (p.x < x0) x0 = p.x;
        if (p.x > x1) x1 = p.x;
        if (p.y < y0) y0 = p.y;
        if (p.y > y1) y1 = p.y;
      }
    const margin = jarak * 0.4;
    return {
      xMin: x0 - margin,
      xMax: x1 + margin,
      yMin: y0 - margin,
      /* Ruang di atas untuk judul keadaannya, yang selalu tampil; tanpa
         itu lintasan yang melaju lurus ke atas menembus judulnya. */
      yMax: y1 + margin + (y1 - y0 + 2 * margin) * 0.16,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gA, gB, jarak]);
  const [beku, setBeku] = useState<typeof bidangBaru | null>(null);
  const bidang = beku ?? bidangBaru;

  /* Titik pertama lintasan yang keluar bidang, untuk penanda di tepinya. */
  const keluar = (() => {
    const { xMin, xMax, yMin, yMax } = bidang;
    for (const j of jalur)
      for (const p of j)
        if (p.x < xMin || p.x > xMax || p.y < yMin || p.y > yMax) {
          const dx = 0.1 * (xMax - xMin);
          const dy = 0.06 * (yMax - yMin);
          return {
            x: Math.min(xMax - dx, Math.max(xMin + dx, p.x)),
            y: Math.min(yMax - 2.5 * dy, Math.max(yMin + dy, p.y)),
          };
        }
    return null;
  })();

  /* Pusaran yang ditaruh lalu tertinggal di luar bingkai saat penggeser
     mengecilkan bidang: tidak tergambar dan tidak bisa diseret, jadi
     jumlahnya ditulis di gambar. */
  const nLuar = tambahan.filter(
    (p) => p.x < bidang.xMin || p.x > bidang.xMax || p.y < bidang.yMin || p.y > bidang.yMax
  ).length;

  const gMaks = Math.max(Math.abs(gA), Math.abs(gB), banyak ? Math.abs(gK) : 0);

  const plate = usePlate(
    (ctx, w, ch) => {
      const garis: FieldLine[] = jalur.map((pts, i) => ({
        pts,
        color: WARNA[Math.min(i, 2)],
        /* Selagi bergerak, lintasan penuh hanya garis tipis: jejak tebal
           digambar lapis gerak sampai saat t. */
        weight: playing ? W.thin : W.bold,
        dash: JENIS[Math.min(i, 2)],
        label: i === 0 ? T.vortexA : i === 1 ? T.vortexB : x.pusaranKe(i + 1),
        labelAt: 0.45,
        labelDy: i === 1 ? 16 : -11,
        labelAlign: "center" as CanvasTextAlign,
        arrow: !playing,
      }));
      const akhir = jalur.map((j) => j[j.length - 1]);
      if (!playing && !banyak)
        /* Garis penghubung keduanya di akhir, supaya jaraknya terbaca. */
        garis.push({ pts: [akhir[0], akhir[1]], color: C.ink3, weight: W.hair, dash: DASH.axis });

      const titik: FieldMarker[] = jalur.map((j, i) => ({
        x: j[0].x,
        y: j[0].y,
        color: WARNA[Math.min(i, 2)],
        size: 5,
        filled: false,
      }));
      if (!playing)
        akhir.forEach((p, i) => titik.push({ x: p.x, y: p.y, color: WARNA[Math.min(i, 2)], size: 5, filled: true }));

      const anchors: Record<string, { x: number; y: number }> = {
        A: { x: -jarak / 2, y: 0 },
        B: { x: jarak / 2, y: 0 },
      };
      tambahan.forEach((p, i) => (anchors[`v${i}`] = p));

      const out = drawField(
        ctx,
        w,
        ch,
        {
          ...bidang,
          lines: garis,
          markers: titik,
          regions: [
            ...(keluar ? [{ x: keluar.x, y: keluar.y, text: x.keluar, color: C.ink3 }] : []),
            ...(nLuar > 0
              ? [
                  {
                    x: bidang.xMin + 0.22 * (bidang.xMax - bidang.xMin),
                    y: bidang.yMax - 0.22 * (bidang.yMax - bidang.yMin),
                    text: x.diLuar(nLuar),
                    color: C.ink3,
                  },
                ]
              : []),
          ],
          heading: keadaan,
          headingColor: C.ink2,
          axisX: T.axXMetre,
          axisY: T.axYMetre,
          anchors,
        },
        lang
      );
      /* Saat diam: medan kecepatan pada susunan awal (yang diseret). */
      if (!playing) {
        const mo = medanAwal.current!;
        loadVortices(mo, track, 0);
        const uRef = fieldReferenceSpeed(gMaks, 1 / Math.abs(out.map.X(1) - out.map.X(0)));
        drawVortexArrows(ctx, out.map, mo, uRef);
        drawArrowLegend(ctx, out.map, mo, uRef, x.legend);
      }
      return out;
    },
    (ctx, _w, _h, tt, dt, out) => {
      if (!out) return;
      drawVortexMotion(ctx, out.map, tt, dt, track, gerak.current!, {
        colors: [C.water, C.critical, C.ink2, C.ink2, C.ink2, C.ink2],
        dashes: [DASH.solid, DASH.hidden, DASH.axis, DASH.axis, DASH.axis, DASH.axis],
        clockPrefix: x.clock,
        legendPrefix: x.legend,
        uRef: fieldReferenceSpeed(gMaks, 1 / Math.abs(out.map.X(1) - out.map.X(0))),
        hold: 1.5 * timeScale,
      });
    },
    [kunci, lang, playing, bidang.xMin, bidang.xMax, bidang.yMin, bidang.yMax],
    { playing, timeScale }
  );

  const pegangan: HandleSpec[] = [
    {
      id: "A",
      anchor: "A",
      axis: "x",
      label: x.gD1,
      tint: C.water,
      param: P_D,
      value: jarak,
      toValue: (px, _py, m) => -2 * m.invX(px),
      onChange: setJarak,
      format: (v) => `${fmt(v, 1)} m`,
    },
    {
      id: "B",
      anchor: "B",
      axis: "x",
      label: x.gD2,
      tint: C.critical,
      param: P_D,
      value: jarak,
      toValue: (px, _py, m) => 2 * m.invX(px),
      onChange: setJarak,
      format: (v) => `${fmt(v, 1)} m`,
    },
    ...tambahan.map(
      (p, i): HandleSpec => ({
        id: `u${i}`,
        anchor: `v${i}`,
        axis: "xy",
        label: x.gPos(i + 3),
        param: [P_POS, P_POS],
        value: [p.x, p.y],
        toValue: (px, py, m) => [m.invX(px), m.invY(py)],
        onChange: ([vx, vy]) => setTambahan((l) => l.map((q, k) => (k === i ? { x: vx, y: vy } : q))),
        onRemove: () => setTambahan((l) => l.filter((_, k) => k !== i)),
        format: ([vx, vy]) => `x ${fmt(vx, 1)} m, y ${fmt(vy, 1)} m`,
      })
    ),
  ];

  return (
    <LabShell
      sheet="FP-02"
      subject={SUBJECTS.FP[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Tiap pusaran hanyut terbawa kecepatan yang ditimbulkan{" "}
            <Term tint={C.critical}>pusaran lain</Term>, bukan terbawa
            kecepatannya sendiri. Dari satu aturan itu lahir{" "}
            <Term tint={C.water}>dua perilaku</Term> yang berlawanan.
          </p>
        ) : (
          <p>
            Each vortex drifts with the velocity induced by{" "}
            <Term tint={C.critical}>the others</Term>, not by itself. From that
            one rule come <Term tint={C.water}>two opposite behaviours</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="FP-02"
          title={x.sheetTitle}
          rev="A"
          cells={
            banyak
              ? [
                  { label: t.tbUnit, value: "SI (m²/s, m, s)" },
                  { label: "N", value: fmt(N, 0) },
                  { label: "ΣΓ", value: `${fmt(inv0.circulation, 0)} m²/s`, tint: C.water },
                  { label: "H", value: `${fmt(inv0.hamiltonian, 2)} m⁴/s²` },
                  { label: "ΔH", value: `${fmt(dHpct, 4)} %` },
                ]
              : [
                  { label: t.tbUnit, value: "SI (m²/s, m, s)" },
                  {
                    label: "U",
                    value: `${fmt(r.translation, 3)} m/s`,
                    tint: C.water,
                  },
                  {
                    label: "Ω",
                    value: `${fmt(r.angular, 3)} rad/s`,
                    tint: C.critical,
                  },
                  {
                    label: "T",
                    value: Number.isFinite(r.period) ? `${fmt(r.period, 2)} s` : "∞",
                  },
                  { label: "d", value: `${fmt(r.finalSeparation, 3)} m` },
                ]
          }
          motion={{
            playing,
            onToggle: togglePutar,
            allowed: plate.motionAllowed,
            note: x.motionNote(teksSkala),
          }}
        >
          <canvas ref={plate.ref} className="block h-full w-full" />
          <canvas ref={plate.motionRef} />
          {/* Bidang dibekukan selama jari/tetikus turun di atas pegangan
              atau penangkap taruh, dilepas saat diangkat. */}
          <div
            className="contents"
            onPointerDown={() => setBeku(bidang)}
            onPointerUp={() => setBeku(null)}
            onPointerCancel={() => setBeku(null)}
            onLostPointerCapture={() => setBeku(null)}
          >
            <DragLayer
              out={plate.outRef.current}
              touch={() => sentuh.current()}
              handles={pegangan}
              place={{
                id: "pusaran",
                label: x.tambah,
                param: [P_POS, P_POS],
                toValue: (px, py, m) => [m.invX(px), m.invY(py)],
                onPlace: ([vx, vy]) => setTambahan((l) => [...l, { x: vx, y: vy }]),
                count: N,
                max: VORTEX_MAX,
                fallback: [0, jarak],
                format: ([vx, vy]) => `x ${fmt(vx, 1)} m, y ${fmt(vy, 1)} m`,
              }}
            />
          </div>
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Γ₁" label={x.dA} value={gA} min={-40} max={40} step={1} digits={0} unit="m²/s" onChange={setGA} tint={C.water} />
              <InputRow symbol="Γ₂" label={x.dB} value={gB} min={-40} max={40} step={1} digits={0} unit="m²/s" onChange={setGB} tint={C.critical} />
              <InputRow symbol="d" label={x.dS} value={jarak} {...P_D} unit="m" onChange={setJarak} />
              <InputRow symbol="Γₖ" label={x.dK} value={gK} min={-40} max={40} step={1} digits={0} unit="m²/s" onChange={setGK} penanda={banyak ? null : x.gKBelum} />
            </InputTable>

            <p className="mt-2.5 text-[0.78rem] leading-snug text-ink-2">{x.taruhPetunjuk(VORTEX_MAX)}</p>
            {tambahan.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  sentuh.current();
                  setTambahan([]);
                }}
                className="label mt-2 border border-rule-strong bg-sheet px-2 py-1 text-[0.75rem] text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-water"
              >
                {x.hapusSemua}
              </button>
            )}

            <SentuhContoh sentuh={sentuh} />
            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pLawan, apply: () => { setGA(10); setGB(-10); setJarak(2); setTambahan([]); } },
                  { label: x.pSearah, apply: () => { setGA(10); setGB(10); setJarak(2); setTambahan([]); } },
                  { label: x.pTimpang, apply: () => { setGA(30); setGB(5); setJarak(2); setTambahan([]); } },
                  { label: x.pTiga, apply: () => { setGA(10); setGB(10); setJarak(2); setGK(10); setTambahan([{ x: 0, y: 1.7 }]); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            {banyak ? (
              <ResultTable
                rows={[
                  { symbol: "N", label: x.rN, value: fmt(N, 0) },
                  { symbol: "ΣΓ", label: x.rSum, value: fmt(inv0.circulation, 0), unit: "m²/s", tint: C.water, strong: true },
                  { symbol: "x_c", label: x.rXc, value: adaPusat ? fmt(inv0.centreX, 3) : "∞", unit: adaPusat ? "m" : undefined },
                  { symbol: "y_c", label: x.rYc, value: adaPusat ? fmt(inv0.centreY, 3) : "∞", unit: adaPusat ? "m" : undefined },
                  { symbol: "H", label: x.rH, value: fmt(inv0.hamiltonian, 3), unit: "m⁴/s²" },
                  { symbol: "ΔH", label: x.rdH, value: fmt(dHpct, 5), unit: "%", strong: true },
                  { symbol: "Δx_c", label: x.rdI, value: adaPusat ? fmt(geserPusat, 6) : "—", unit: adaPusat ? "m" : undefined },
                ]}
              />
            ) : (
              <ResultTable
                rows={[
                  /* Angka besar bersyarat: U bila pasangannya melaju, Ω dan T
                     bila berputar. Dulu U dan Ω selalu besar, salah satunya nol. */
                  { symbol: "U", label: x.rPindah, value: fmt(r.translation, 4), unit: "m/s", tint: C.water, strong: r.translates },
                  { symbol: "Ω", label: x.rSudut, value: fmt(r.angular, 4), unit: "rad/s", tint: C.critical, strong: berputar },
                  {
                    symbol: "T",
                    label: x.rPeriode,
                    value: Number.isFinite(r.period) ? fmt(r.period, 3) : "∞",
                    unit: "s",
                    strong: berputar,
                  },
                  { symbol: "d", label: x.rAkhir, value: fmt(r.finalSeparation, 4), unit: "m" },
                  { symbol: "Δd", label: x.rHanyut, value: fmt(r.separationDrift, 5), unit: "m" },
                ]}
              />
            )}
            <div className="mt-3">
              <Hitungan
                langkah={
                  banyak
                    ? [
                        {
                          judul: x.jSum,
                          rumus: <span>ΣΓ = Γ₁ + Γ₂ + (N − 2) · Γₖ</span>,
                          isi: `${fmt(gA, 0)} + ${kurung(gB, 0)} + ${fmt(N - 2, 0)} · ${kurung(gK, 0)}`,
                          hasil: fmt(inv0.circulation, 0),
                          satuan: "m²/s",
                          tint: C.water,
                        },
                        {
                          judul: x.jIx,
                          rumus: (<><span>x_c =</span><Frac num="Σ Γᵢ xᵢ" den="ΣΓ" /><span>;  y_c =</span><Frac num="Σ Γᵢ yᵢ" den="ΣΓ" /></>),
                          isi: adaPusat
                            ? `${fmt(inv0.impulseX, 3)} / ${fmt(inv0.circulation, 0)} ;  ${fmt(inv0.impulseY, 3)} / ${fmt(inv0.circulation, 0)}`
                            : `ΣΓ = 0`,
                          hasil: adaPusat ? `${fmt(inv0.centreX, 3)} ; ${fmt(inv0.centreY, 3)}` : "∞",
                          satuan: adaPusat ? "m" : undefined,
                        },
                        {
                          judul: x.jH,
                          rumus: (<><span>H = −</span><Frac num="1" den="2π" /><span>Σᵢ&lt;ⱼ Γᵢ Γⱼ ln rᵢⱼ</span><span className="ml-2 text-ink-3">({x.jHinti})</span></>),
                          isi: `${fmt(N * (N - 1) / 2, 0)} ${lang === "id" ? "pasangan" : "pairs"}`,
                          hasil: fmt(inv0.hamiltonian, 3),
                          satuan: "m⁴/s²",
                        },
                        {
                          judul: x.jS,
                          rumus: (<><span>S =</span><Frac num="1" den="2π" /><span>Σᵢ&lt;ⱼ | Γᵢ Γⱼ |</span></>),
                          isi: `Σ | Γᵢ Γⱼ | / 2π = ${fmt(drift.scale * 2 * Math.PI, 0)} / 2π`,
                          hasil: fmt(drift.scale, 3),
                          satuan: "m⁴/s²",
                        },
                        {
                          judul: x.jdH,
                          rumus: (<><span>ΔH =</span><Frac num="H(20 s) − H(0)" den="S" /><span>· 100</span></>),
                          isi: `( ${fmt(inv1.hamiltonian, 5)} − ${kurung(inv0.hamiltonian, 5)} ) / ${fmt(drift.scale, 3)} · 100`,
                          hasil: fmt(dHpct, 5),
                          satuan: "%",
                        },
                      ]
                    : [
                  {
                    judul: x.jSum,
                    rumus: <span>ΣΓ = Γ₁ + Γ₂</span>,
                    isi: `${fmt(gA, 0)} + ${kurung(gB, 0)}`,
                    hasil: fmt(sum, 0),
                    satuan: "m²/s",
                  },
                  ...(r.translates
                    ? [
                        {
                          judul: x.jU,
                          rumus: (<><span>U =</span><Frac num="|Γ₁|" den="2π · d" /></>),
                          isi: `${fmt(Math.abs(gA), 0)} / ( 2π · ${fmt(jarak, 1)} )`,
                          hasil: fmt(r.translation, 4),
                          satuan: "m/s",
                          tint: C.water,
                        },
                      ]
                    : berputar
                      ? [
                          {
                            judul: x.jW,
                            rumus: (<><span>Ω =</span><Frac num="ΣΓ" den="2π · d²" /></>),
                            isi: `${fmt(sum, 0)} / ( 2π · ${fmt(jarak, 1)}² )`,
                            hasil: fmt(r.angular, 4),
                            satuan: "rad/s",
                            tint: C.critical,
                          },
                          {
                            judul: x.jT,
                            rumus: (<><span>T =</span><Frac num="4π² · d²" den="|ΣΓ|" /></>),
                            isi: `4π² · ${fmt(jarak, 1)}² / ${fmt(Math.abs(sum), 0)}`,
                            hasil: fmt(r.period, 3),
                            satuan: "s",
                          },
                          {
                            judul: x.jXc,
                            rumus: (<><span>x_c =</span><Frac num="Γ₁ · (−d/2) + Γ₂ · (d/2)" den="ΣΓ" /></>),
                            isi: `( ${fmt(gA, 0)} · ${kurung(-jarak / 2, 2)} + ${kurung(gB, 0)} · ${fmt(jarak / 2, 2)} ) / ${fmt(sum, 0)}`,
                            hasil: fmt(xc, 3),
                            satuan: "m",
                          },
                        ]
                      : []),
                  {
                    judul: x.jD,
                    rumus: <span>d akhir = d</span>,
                    isi: fmt(jarak, 1),
                    hasil: fmt(r.finalSeparation, 4),
                    satuan: "m",
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={r.translates && !banyak ? "water" : "neutral"}
            badge={keadaan}
            state={
              banyak
                ? x.sBanyak(N, fmt(inv0.circulation, 0), fmt(dHpct, 4))
                : tanpa
                ? x.sTanpa
                : satuNol
                  ? x.sSatu(keadaan, gA === 0 ? "1" : "2", gA === 0 ? "2" : "1", fmt(r.angular, 3), fmt(r.period, 2))
                  : r.translates
                    ? x.sLaju(keadaan, fmt(r.translation, 3))
                    : x.sPutar(keadaan, fmt(r.angular, 3), fmt(r.period, 2))
            }
            notice={
              banyak
                ? [...(track.limited ? [x.nKasar(fmt(dHpct, 2))] : []), x.nBanyak, x.nInti(fmt(VORTEX_CORE, 1))]
                : [...notice(gA, gB, jarak, lang), x.nInti(fmt(VORTEX_CORE, 1))]
            }
          />
        </>
      }
      verification={<Verification checks={checksVortexPair(gA, gB, jarak)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>u =</span>
                <Frac num="Γ" den="2π r" />
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "kecepatan yang ditimbulkan satu pusaran titik"
                    : "the velocity induced by one point vortex"}
                </span>
              </Eq>
              <Eq>
                <span>U =</span>
                <Frac num="Γ" den="2π d" />
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "pasangan berlawanan arah, berpindah lurus"
                    : "counter-rotating pair, translating"}
                </span>
              </Eq>
              <Eq>
                <span>T =</span>
                <Frac num="4π² d²" den="Γ₁ + Γ₂" />
                <span className="ml-5 text-ink-3">
                  {lang === "id"
                    ? "pasangan searah, saling mengelilingi"
                    : "co-rotating pair, orbiting"}
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

/** Angka negatif dalam substitusi ditulis berkurung. */
function kurung(v: number, dg: number) {
  const t = fmt(v, dg);
  return v < 0 && t !== fmt(0, dg) ? `(${t})` : t;
}

/*
 * Butir: (a) jarak separuh → U ×2 atau Ω ×4, (b) perbandingan lawan dan
 * searah dengan kekuatan sama, (c) jarak tetap. Tanpa pusaran tidak ada
 * yang dibandingkan.
 */
function notice(gA: number, gB: number, jarak: number, lang: Lang): string[] {
  const x = TXT[lang];
  if (gA === 0 && gB === 0) return [];
  const a = vortexPair(gA, gB, jarak);
  const dekat = vortexPair(gA, gB, jarak / 2);
  const g = Math.abs(gA) > 0 ? Math.abs(gA) : Math.abs(gB);
  const lawan = vortexPair(g, -g, jarak);
  const searah = vortexPair(g, g, jarak);
  return [
    a.translates
      ? x.nDekatLaju(fmt(jarak, 1), fmt(jarak / 2, 2), fmt(a.translation, 3), fmt(dekat.translation, 3))
      : x.nDekatPutar(fmt(jarak, 1), fmt(jarak / 2, 2), fmt(a.angular, 3), fmt(dekat.angular, 3)),
    x.nBanding(fmt(lawan.translation, 3), fmt(searah.period, 2)),
    x.nJarak(fmt(a.separationDrift, 5)),
  ];
}
