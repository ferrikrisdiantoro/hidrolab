"use client";

import { useState } from "react";
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
import { useCanvas } from "@/lib/useCanvas";
import {
  drawStructure,
  type StructureLine,
  type StructureVector,
} from "@/lib/drawStructure";
import {
  CONCRETE_UNIT_WEIGHT,
  UPLIFT_DRAIN_RESIDUAL,
  WATER_UNIT_WEIGHT,
  fmt,
  fmtPlain,
  gravityDam,
} from "@/lib/hydraulics";
import { C, DASH, F, W, stencilWidth, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksDam } from "@/lib/checks";

const DRAIN_AT = 0.1;
const FS_SLIDE_MIN = 1.5;
const FS_OVER_MIN = 1.5;

const TXT = {
  id: {
    title: "Stabilitas bendungan",
    sheetTitle: "Bendungan beton gravitasi — guling, geser, dan daya dukung",
    dHd: "Tinggi bendungan",
    dCrest: "Lebar mercu",
    dBase: "Lebar dasar",
    dH: "Kedalaman air hulu",
    dHt: "Kedalaman air hilir",
    dMu: "Koefisien gesek dasar",
    dCoh: "Kohesi dasar",
    dDrain: "Sisa tekanan angkat di garis tirisan",
    mode: "Tekanan angkat",
    mAda: "Diperhitungkan",
    mTanpa: "Ditiadakan",
    pPenuh: "Waduk penuh, tirisan bekerja",
    pTanpaTiris: "Waduk penuh, tirisan tersumbat",
    pHilir: "Air hilir tinggi",
    rW: "Berat badan bendungan",
    rU: "Gaya angkat",
    rPu: "Dorongan air hulu",
    rPd: "Dorongan air hilir",
    rV: "Jumlah gaya tegak",
    rHh: "Jumlah gaya mendatar",
    rX: "Letak resultan dari tumit",
    rE: "Simpangan dari tengah dasar",
    rHeel: "Tegangan di tumit",
    rToe: "Tegangan di ujung kaki",
    rFsO: "Faktor keamanan guling",
    rFsS: "Faktor keamanan geser",
    rBase: "Lebar dasar terkecil yang bebas tarik",
    aman: "Memenuhi ketiga syarat lembar ini",
    dipotong: "Muka air melampaui tinggi bendungan",
    mercu: "Lebar mercu dipotong ke lebar dasar",
    mercuNote:
      "Lebar mercu yang dipilih tidak lebih kecil daripada lebar dasarnya, jadi penampangnya tidak lagi segitiga bermercu. Model memotong lebar mercu ke lebar dasar sebelum menghitung, dan seluruh angka di bawah ini menyatakan penampang persegi itu, bukan yang sedang dipilih penggesernya. Perlebar dasarnya atau persempit mercunya.",
    luarDasar: "Resultan di luar dasar",
    luarDasarNote:
      "Resultan gaya tegak jatuh di luar lebar dasarnya sendiri. Rumus tegangan σ = ΣV/B (1 ± 6e/B) mengandaikan seluruh dasar menekan, dan di sini tidak ada bagian dasar yang dapat menahan resultan itu: bendungannya terguling, jadi tegangan tumit dan ujung kaki ditulis “—”.",
    bKakiT: "Ujung kaki tertarik",
    bTengah: "Sepertiga tengah",
    bTumitT: "Tumit tertarik",
    luarRentang: "Di luar rentang lembar",
    tarikKaki: "Ujung kaki tertarik, resultan keluar dari sepertiga tengah",
    fsJujur:
      "Syarat FSs ≥ 1,5 di lembar ini dipakai untuk faktor geser yang sudah memasukkan kohesi. Pedoman yang dirujuk menuntut faktor geser-gesek yang lebih tinggi untuk beban biasa (USBR 1976 dikutip 3,0, USACE EM 1110-2-2200 dikutip 2,0); angka itu belum diperiksa ke halaman sumbernya, jadi “memenuhi” di sini berarti memenuhi syarat lembar ini, bukan putusan rancangan.",
    kNm: "kN per m",
    hW: "Berat badan bendungan",
    hWRumus: "W = γc · luas penampang ; x̄w dari poligon",
    hGaya: "Dorongan air dan gaya angkat",
    hResultan: "Jumlah gaya dan letak resultan",
    hSigma: "Tegangan di tumit dan ujung kaki",
    hFs: "Faktor keamanan guling dan geser",
    dipotongNote:
      "Kedalaman air yang dipilih melewati tinggi bendungannya, atau muka air hilirnya melewati muka air hulunya. Keduanya keadaan yang tidak dihitung lembar ini, jadi angkanya dipotong pada batas yang masuk akal sebelum dipakai: air hulu setinggi mercu, dan air hilir setinggi air hulu. Yang tertulis di tabel karena itu bukan keadaan yang sedang dipilih penggesernya. Bendungan beton gravitasi memang boleh dilimpasi pada bagian pelimpahnya, tetapi tekanan air pada bagian yang tidak melimpas tetap berhenti di mercu, dan lembar ini menghitung bagian yang tidak melimpas.",
    tarik: "Tumit tertarik, resultan keluar dari sepertiga tengah",
    geser: "Faktor geser di bawah syarat",
    guling: "Faktor guling di bawah syarat",
    tarikNote:
      "Resultan jatuh di luar sepertiga tengah dasar, jadi tumitnya tertarik. Yang perlu diperhatikan tentang keadaan ini bukan besarnya tegangan tarik itu melainkan umpan balik yang dimulainya. Beton tidak menahan tarik, jadi tumitnya retak. Retakan itu terhubung dengan waduk, jadi ia terisi air bertekanan penuh. Tekanan angkat karena itu bekerja penuh sepanjang retakan, bukan lagi menurun landai dari tumit ke kaki. Gaya angkat yang naik menggeser resultan lebih jauh lagi ke arah kaki, yang memperpanjang retakan, yang menaikkan angkat lagi. Itu sebabnya aturan sepertiga tengah tidak diperlakukan sebagai batas kenyamanan melainkan sebagai batas mutlak: di sebelah luarnya, kegagalannya memberi makan dirinya sendiri.",
    note:
      "Dua hal pada lembar ini yang paling sering mengejutkan orang yang baru pertama menghitungnya. Pertama, yang paling sering menjatuhkan hitungan ini bukan dorongan airnya melainkan tekanan angkat di bawah dasarnya. Air yang mendorong muka hulu terlihat dan terasa berbahaya; air yang mengangkat dari bawah tidak terlihat sama sekali, dan pada bendungan tinggi ia menghapus seperempat sampai sepertiga berat betonnya. Matikan tekanan angkatnya di lembar ini dan lihat kedua faktor keamanannya melompat. Itu sebabnya tirisan di dekat tumit, yang biayanya kecil dibandingkan beton, sering menaikkan faktor geser lebih banyak daripada melebarkan dasarnya satu meter. Kedua, menaikkan air hilir tidak selalu menolong, dan sering justru merugikan. Air hilir memang mendorong balik dan mengurangi dorongan mendatar bersihnya, tetapi ia juga menaikkan tekanan angkat di sepanjang dasar. Faktor gesernya naik hanya bila gesekan yang hilang karena tambahan angkat, μ kali tambahan angkat itu, lebih kecil daripada dorongan yang dihemat dikali faktor geser yang sedang berlaku. Pada dasar tanpa kohesi syarat itu sama dengan tambahan angkat yang lebih kecil daripada dorongan yang dihemat dikali ΣV/ΣH, jadi hasilnya bergantung pada bentuk diagram angkat dan tinggi air hilirnya, bukan hanya pada ada tidaknya kohesi. Jadi jawaban atas pertanyaan apakah air hilir menolong bukan ya atau tidak; lembar ini menghitungnya untuk keadaan yang sedang dipilih.",
  },
  en: {
    title: "Dam stability",
    sheetTitle: "Concrete gravity dam — overturning, sliding, and bearing",
    dHd: "Dam height",
    dCrest: "Crest width",
    dBase: "Base width",
    dH: "Upstream water depth",
    dHt: "Tailwater depth",
    dMu: "Base friction coefficient",
    dCoh: "Base cohesion",
    dDrain: "Residual uplift at the drain line",
    mode: "Uplift",
    mAda: "Counted",
    mTanpa: "Left out",
    pPenuh: "Full reservoir, drains working",
    pTanpaTiris: "Full reservoir, drains blocked",
    pHilir: "High tailwater",
    rW: "Weight of the dam body",
    rU: "Uplift force",
    rPu: "Upstream thrust",
    rPd: "Tailwater thrust",
    rV: "Sum of vertical forces",
    rHh: "Sum of horizontal forces",
    rX: "Resultant position from the heel",
    rE: "Eccentricity from the base centre",
    rHeel: "Stress at the heel",
    rToe: "Stress at the toe",
    rFsO: "Factor of safety against overturning",
    rFsS: "Factor of safety against sliding",
    rBase: "Smallest tension free base width",
    aman: "Meets the three requirements of this sheet",
    dipotong: "The water level exceeds the dam height",
    mercu: "Crest width clipped to the base width",
    mercuNote:
      "The chosen crest width is not smaller than the base width, so the section is no longer a crested triangle. The model clips the crest width to the base width before computing, and every figure below describes that rectangular section, not the one the sliders are set to. Widen the base or narrow the crest.",
    luarDasar: "Resultant outside the base",
    luarDasarNote:
      "The resultant of the vertical forces falls outside the base itself. The stress formula σ = ΣV/B (1 ± 6e/B) assumes the whole base is in compression, and here no part of the base can carry that resultant: the dam overturns, so the heel and toe stresses are shown as “—”.",
    bKakiT: "Toe in tension",
    bTengah: "Middle third",
    bTumitT: "Heel in tension",
    luarRentang: "Outside the range of this sheet",
    tarikKaki: "The toe is in tension, the resultant leaves the middle third",
    fsJujur:
      "The FSs ≥ 1.5 requirement on this sheet is applied to a sliding factor that already includes cohesion. The guidelines cited ask for a higher shear-friction factor under usual loading (USBR 1976 quoted as 3.0, USACE EM 1110-2-2200 quoted as 2.0); those figures have not been checked against the source pages, so “meets” here means meets this sheet's requirement, not a design verdict.",
    kNm: "kN per m",
    hW: "Weight of the dam body",
    hWRumus: "W = γc · section area ; x̄w from the polygon",
    hGaya: "Water thrust and uplift",
    hResultan: "Force sums and resultant position",
    hSigma: "Stress at heel and toe",
    hFs: "Factors of safety against overturning and sliding",
    dipotongNote:
      "The chosen water depth passes the height of the dam, or the tailwater passes the headwater. Neither state is computed on this sheet, so the figures are clipped to sensible limits before use: headwater at crest level, tailwater at headwater level. What the table shows is therefore not the state the sliders are set to. A concrete gravity dam may indeed be overtopped across its spillway section, but the water load on a non-spillway section still stops at the crest, and this sheet computes a non-spillway section.",
    tarik: "The heel is in tension, the resultant leaves the middle third",
    geser: "The sliding factor is below requirement",
    guling: "The overturning factor is below requirement",
    tarikNote:
      "The resultant falls outside the middle third of the base, so the heel is in tension. What matters about this state is not the size of that tensile stress but the feedback it starts. Concrete does not take tension, so the heel cracks. The crack connects to the reservoir, so it fills with water at full pressure. Uplift therefore acts in full along the crack rather than tapering from heel to toe. The increased uplift pushes the resultant further towards the toe, which lengthens the crack, which raises the uplift again. That is why the middle third rule is treated not as a comfort margin but as an absolute limit: beyond it, the failure feeds itself.",
    note:
      "Two things on this sheet most often surprise someone computing it for the first time. First, what most often fails this calculation is not the water pushing on the face but the uplift beneath the base. Water pushing on the upstream face is visible and feels dangerous; water lifting from below is not visible at all, and on a tall dam it cancels a quarter to a third of the concrete weight. Switch the uplift off on this sheet and watch both factors of safety jump. That is why drains near the heel, cheap compared with concrete, often raise the sliding factor more than widening the base by a metre. Second, raising the tailwater does not always help, and often hurts. Tailwater does push back and reduce the net horizontal thrust, but it also raises the uplift along the whole base. The sliding factor rises only when the friction lost to the extra uplift, μ times that extra uplift, is smaller than the thrust saved times the sliding factor in force. On a base without cohesion that condition is the extra uplift being smaller than the thrust saved times ΣV/ΣH, so the outcome depends on the shape of the uplift diagram and the tailwater height, not only on whether there is cohesion. So the answer to whether tailwater helps is not yes or no; this sheet computes it for the state chosen.",
  },
} as const;

const REFS = {
  id: [
    "USBR (1976). Design of Gravity Dams. Denver.",
    "USACE (1995). Gravity Dam Design, EM 1110-2-2200.",
    "Novak, P., Moffat, A.I.B., Nalluri, C. & Narayanan, R. (2007). Hydraulic Structures, edisi ke-4, bab 4.",
    "ICOLD (2005). Bulletin 117: The gravity dam, a dam for the future.",
  ],
  en: [
    "USBR (1976). Design of Gravity Dams. Denver.",
    "USACE (1995). Gravity Dam Design, EM 1110-2-2200.",
    "Novak, P., Moffat, A.I.B., Nalluri, C. & Narayanan, R. (2007). Hydraulic Structures, 4th ed., ch. 4.",
    "ICOLD (2005). Bulletin 117: The gravity dam, a dam for the future.",
  ],
} as const;

export function StabilitasBendunganClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [Hd, setHd] = useState(40);
  const [crest, setCrest] = useState(6);
  const [B, setB] = useState(30);
  const [H, setH] = useState(38);
  const [Ht, setHt] = useState(3);
  const [mu, setMu] = useState(0.7);
  const [coh, setCoh] = useState(100);
  const [residual, setResidual] = useState(UPLIFT_DRAIN_RESIDUAL);
  const [upliftOn, setUpliftOn] = useState(true);

  /*
   * Kedua muka air dipotong sebelum dipakai: air hulu di mercu, air hilir
   * di air hulu. Pemotongannya benar, tetapi sebelumnya DIAM-DIAM, sehingga
   * penggeser menunjuk seratus meter sementara seluruh lembar menjawab
   * empat puluh meter tanpa satu pun tanda bahwa keduanya berbeda.
   */
  const Hp = Math.min(H, Hd);
  const Htp = Math.min(Ht, Hp);
  const dipotong = H > Hd || Ht > Hp;
  const r = gravityDam(Hd, crest, B, Hp, Htp, mu, coh, residual, DRAIN_AT, upliftOn);

  /* Mercu dipotong ke dasar oleh model (a = min(a, B)) bila B ≤ a; r.valid
     salah. Ditandai, bukan dipotong diam-diam. */
  const mercuDipotong = !r.valid && B <= crest;
  /* |e| > B/2: resultan di luar dasar, rumus σ tidak berlaku. */
  const luarDasar = Math.abs(r.eccentricity) > B / 2 || !Number.isFinite(r.eccentricity);
  const tidakSah = dipotong || mercuDipotong || luarDasar;
  const kurangGeser = r.fsSliding < FS_SLIDE_MIN;
  const kurangGuling = r.fsOverturning < FS_OVER_MIN;
  const tarikTumit = r.tension && r.eccentricity > 0;
  const gagal = r.tension || kurangGeser || kurangGuling;
  const kosong = "—";
  const eB = r.eccentricity / B;
  /* Nilai antara untuk langkah hitungan, dari hasil model yang sama. */
  const luasBadan = r.weight / CONCRETE_UNIT_WEIGHT;
  /* Tinggi tekan angkat di garis tirisan, sama dengan damCore: tanpa
     tirisan (ku ≥ 1) diagramnya lurus dari H ke Ht. */
  const hTiris = residual >= 1 ? Hp - DRAIN_AT * (Hp - Htp) : Htp + residual * (Hp - Htp);
  const badgeGagal = r.tension
    ? tarikTumit
      ? x.tarik
      : x.tarikKaki
    : kurangGeser
      ? x.geser
      : kurangGuling
        ? x.guling
        : x.aman;
  const nada: Tone = tidakSah ? "invalid" : gagal ? "caution" : "pass";

  const ref = useCanvas(
    (ctx, w, ch) => {
      /*
       * Ruang kiri dan kanan dihitung dari lebar tulisan "tumit" dan
       * "ujung kaki" yang sebenarnya. Pada layar 390 piksel ruang tetap
       * 0,42 B memotong "ujung kaki" di tepi kanan. Pemetaannya meniru
       * drawStructure (bantalan 58/26/26/52, skala sama kedua sumbu).
       */
      ctx.font = F.label;
      const perlu = (teks: string) => 24 + 14 + 4 + stencilWidth(ctx, teks) + 6;
      const perluKiri = perlu(T.heelLabel);
      const perluKanan = perlu(T.toeLabelDam);
      const judul = dipotong
        ? x.dipotong
        : mercuDipotong
          ? x.mercu
          : luarDasar
            ? x.luarDasar
            : r.tension
              ? tarikTumit
                ? x.tarik
                : x.tarikKaki
              : undefined;
      const zMinG = -Hd * 0.2 * 2;
      /* Di HP judul keadaan dipecah dua baris; ruang di atas mercu
         ditambah supaya judul itu tidak menutup mercunya. */
      const zMaxG = Hd * (w < 600 && judul ? 1.45 : 1.16);
      const plotW = Math.max(10, w - 58 - 26);
      const plotH = Math.max(10, ch - 26 - 52);
      const ruang = (pL: number, pR: number) => {
        const spanX = B + pL + pR;
        const s = Math.min(plotW / spanX, plotH / (zMaxG - zMinG));
        const ox = 58 + (plotW - spanX * s) / 2;
        return { kiri: ox + pL * s - 58, kanan: 58 + plotW - (ox + (pL + B) * s) };
      };
      /*
       * Layar sempit (HP): ruang mendatar untuk "tumit" dan "ujung kaki"
       * TIDAK dicadangkan. Di bidang selebar dua ratus lima puluh piksel
       * keduanya menuntut seratus dua puluh piksel tiap sisi, dan pinggir
       * yang dilebarkan sampai muat menyusutkan bendungannya menjadi
       * gambar kecil di sudut dengan seluruh label bertumpuk di atasnya.
       * Di HP kedua nama itu ditulis lewat penempat label di bawah dasar,
       * dengan alas kertas, jadi tidak perlu ruang di luar badan.
       */
      const sempit = w < 600;
      let pinggir = Math.max(B * (sempit ? 0.3 : 0.42), sempit ? 6 : 8);
      let pinggirKanan = pinggir;
      for (let i = 0; i < (sempit ? 0 : 40); i++) {
        const rr = ruang(pinggir, pinggirKanan);
        if (rr.kiri >= perluKiri && rr.kanan >= perluKanan) break;
        if (rr.kiri < perluKiri) pinggir *= 1.08;
        if (rr.kanan < perluKanan) pinggirKanan *= 1.08;
      }

      /* Panah gaya diskalakan terhadap gaya terbesar di lembar ini, supaya
         panjangnya membawa data dan bukan hiasan. */
      const terbesar = Math.max(r.weight, r.uplift, r.thrustUp, 1);
      const px = (gaya: number) => (gaya / terbesar) * 62;

      const vektor: StructureVector[] = [
        {
          x: r.weightArm,
          z: Hd * 0.42,
          dx: 0,
          dy: px(r.weight),
          text: `W ${fmtPlain(r.weight, 0)} kN`,
          color: C.ink,
          root: true,
        },
        {
          x: 0,
          z: Hp / 3,
          dx: px(r.thrustUp),
          dy: 0,
          text: `Pu ${fmtPlain(r.thrustUp, 0)} kN`,
          color: C.water,
          root: true,
        },
      ];
      if (Htp > 0)
        vektor.push({
          x: B,
          z: Htp / 3,
          dx: -px(r.thrustDown),
          dy: 0,
          /* Nama Pd ditulis sebagai label garis di atas air hilir, bukan
             di ujung panahnya: panahnya pendek sekali, sehingga namanya
             jatuh tepat di ujung kaki dan menyentuh penunjuk "ujung kaki". */
          color: C.water,
          root: true,
        });
      /* Panah U tanpa teks: teks panah tegak ditulis di ujungnya, dan
         pada setelan bawaan ujung panah W jatuh hampir di atasnya, jadi
         penempat label mendorong teks U turun menimpa panahnya sendiri.
         Namanya ditulis sebagai label garis di sebelah kanan batangnya. */
      if (upliftOn)
        vektor.push({
          x: r.upliftArm,
          z: 0,
          dx: 0,
          dy: -px(r.uplift),
          color: C.critical,
          root: true,
        });

      /* Diagram tekanan angkat di bawah dasar, diskalakan ke ketinggian
         gambar supaya bentuk berkaitnya di garis tirisan terbaca */
      const angkatMaks = Math.max(
        ...r.upliftShape.map((p) => Math.abs(p.z)),
        1e-9
      );
      const tinggiDiagram = Hd * 0.2;
      const diagram: StructureLine[] = upliftOn
        ? [
            {
              pts: r.upliftShape.map((p) => ({
                x: p.x,
                z: (p.z / angkatMaks) * tinggiDiagram,
              })),
              color: C.critical,
              weight: W.thin,
              dash: DASH.solid,
              label: T.upliftLabel,
              labelAt: 0.3,
              labelDy: 34,
            },
          ]
        : [];

      const titikU = { x: r.upliftArm + B * 0.035, z: 0 };
      /* Ordinat diagram tekanan angkat (sudah diskalakan) di absis x:
         sisi bawah poligonnya, tanpa dua titik alas di z = 0. */
      const zDiagram = (xx: number) => {
        if (!upliftOn) return 0;
        const pts = r.upliftShape.slice(1, -1);
        let z = 0;
        for (let i = 0; i + 1 < pts.length; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          if (b.x - a.x < 1e-9 || xx < a.x || xx > b.x) continue;
          const zz = a.z + ((b.z - a.z) * (xx - a.x)) / (b.x - a.x);
          z = Math.min(z, (zz / angkatMaks) * tinggiDiagram);
        }
        return z;
      };
      const zSepertiga = Math.min(zDiagram((2 * B) / 3), -tinggiDiagram * 0.35);
      const garis: StructureLine[] = [
        ...diagram,
        ...(upliftOn
          ? [
              {
                pts: [titikU, titikU],
                color: C.critical,
                weight: W.thin,
                dash: DASH.solid,
                label: `U ${fmtPlain(r.uplift, 0)} kN`,
                labelAt: 0,
                labelDy: -Math.max(px(r.uplift) / 2, 8),
                labelAlign: "left" as const,
              },
            ]
          : []),
        {
          /* Sepertiga tengah dasar, batas yang menentukan segalanya */
          pts: [
            { x: B / 3, z: 0 },
            { x: B / 3, z: -tinggiDiagram * 0.35 },
          ],
          color: C.critical,
          weight: W.hair,
          dash: DASH.axis,
        },
        {
          pts: [
            { x: (2 * B) / 3, z: 0 },
            { x: (2 * B) / 3, z: zSepertiga },
          ],
          color: C.critical,
          weight: W.hair,
          dash: DASH.axis,
          /*
           * Nama ditulis di BAWAH diagram tekanan angkat, rata kiri dari
           * garisnya (ke arah ujung kaki, tempat diagramnya makin dangkal).
           * Sebelumnya rata tengah enam belas piksel di bawah ujung garis
           * yang pendek, dan tulisannya menimpa garis diagram itu.
           */
          /*
           * Namanya diangkat mendekat ke garisnya sendiri, dari tiga puluh
           * empat piksel menjadi enam belas.
           *
           * Garis sepertiga tengah sudah duduk sembilan belas piksel di
           * bawah dasar, jadi nama yang digeser tiga puluh empat piksel
           * lagi mendarat tiga belas piksel dari ukuran lebar dasar. Tiga
           * belas piksel bukan jarak, itu tulisan setinggi dua belas piksel
           * yang kebetulan belum bertindih.
           */
          /* Di HP namanya tidak ditulis: satu-satunya ruang yang tersisa
             menimpa diagram tekanan angkat, dan pita "sepertiga tengah"
             di skala rezim di atas gambar sudah menamainya. */
          label: sempit ? undefined : T.middleThird,
          labelAt: 1,
          labelDy: 12,
          labelAlign: "left",
        },
        {
          /* Garis kerja resultan pada dasarnya */
          pts: [
            { x: r.resultantAt, z: Hd * 0.34 },
            { x: r.resultantAt, z: -tinggiDiagram * 0.55 },
          ],
          /* Merah sinyal hanya bila resultannya di luar dasar (rumus σ
             gugur); tumit tertarik adalah kegagalan syarat, bukan di luar
             rentang. */
          color: luarDasar ? C.signal : C.energy,
          weight: W.thin,
          dash: DASH.phantom,
          label: `${T.resultantLabel} ${fmtPlain(r.resultantAt, 2)} m`,
          labelAt: 0,
          labelDy: -12,
        },
      ];
      if (Htp > 0)
        garis.push({
          pts: [
            { x: B, z: Htp },
            { x: B, z: Htp },
          ],
          color: C.water,
          weight: W.thin,
          dash: DASH.solid,
          label: `Pd ${fmtPlain(r.thrustDown, 0)} kN`,
          labelAt: 0,
          labelDy: -10,
          labelAlign: "left",
        });
      /* Di HP nama tumit dan ujung kaki ditulis sebagai label (lihat
         catatan pinggir di atas): tumit rata kanan di sebelah hulu, ujung
         kaki rata kiri di sebelah hilir, keduanya tepat di bawah dasar. */
      if (sempit)
        garis.push(
          {
            pts: [
              { x: 0, z: 0 },
              { x: 0, z: 0 },
            ],
            color: C.ink2,
            weight: W.hair,
            dash: DASH.solid,
            label: T.heelLabel,
            labelAt: 0,
            labelDy: 12,
            labelAlign: "right",
          },
          {
            pts: [
              { x: B, z: 0 },
              { x: B, z: 0 },
            ],
            color: C.ink2,
            weight: W.hair,
            dash: DASH.solid,
            label: T.toeLabelDam,
            labelAt: 0,
            labelDy: 12,
            labelAlign: "left",
          }
        );
      if (residual < 1 && upliftOn)
        garis.push({
          pts: [
            { x: DRAIN_AT * B, z: Hd * 0.1 },
            { x: DRAIN_AT * B, z: 0 },
          ],
          color: C.ink3,
          weight: W.hair,
          dash: DASH.axis,
          /* Rata kiri dari garisnya, ke arah badan: dulu rata tengah dan
             bertabrakan dengan teks Pu, lalu didorong turun sampai
             menempel nama "tumit". */
          /* Di HP penempat label mendorong nama ini jauh dari garisnya
             (ruang di atasnya dipakai U dan W), jadi tidak ditulis; nama
             garis tirisan ada di baris masukan ku. */
          label: sempit ? undefined : T.drainLine,
          labelAt: 0,
          labelDy: -8,
          labelAlign: "left",
        });

      drawStructure(
        ctx,
        w,
        ch,
        {
          xMin: -pinggir,
          xMax: B + pinggirKanan,
          /*
           * Ruang di bawah dasar dilebarkan dari satu setengah kali tinggi
           * diagram menjadi dua kali.
           *
           * Di jalur setipis itu berdesakan ENAM tulisan sekaligus: tumit,
           * ujung kaki, garis tirisan, tekanan angkat, sepertiga tengah,
           * dan ukuran lebar dasar. Penempat tulisan memang menjaga
           * keenamnya tidak bertindih, tetapi tidak dapat menciptakan jarak
           * yang tidak ada, jadi hasilnya enam tulisan yang saling
           * bersentuhan dan terbaca sebagai satu kalimat panjang. Yang
           * kurang bukan aturan penempatannya melainkan ruangnya.
           */
          zMin: zMinG,
          zMax: zMaxG,
          bodies: [{ pts: r.section, hatch: "concrete" }],
          waters: [
            {
              surface: [
                { x: -pinggir, z: Hp },
                { x: 0, z: Hp },
              ],
            },
            ...(Htp > 0
              ? [
                  {
                    surface: [
                      { x: B, z: Htp },
                      { x: B + pinggirKanan, z: Htp },
                    ],
                  },
                ]
              : []),
          ],
          lines: garis,
          vectors: vektor,
          dims: [
            { axis: "h", at: 0, from: 0, to: B, text: `B ${fmtPlain(B, 1)} m`, offset: 66 },
          ],
          callouts: sempit
            ? []
            : [
                { x: 0, z: 0, dx: -24, dy: 16, text: T.heelLabel },
                { x: B, z: 0, dx: 22, dy: 16, text: T.toeLabelDam },
              ],
          heading: judul,
          headingColor: tidakSah ? C.signal : C.caution,
          axisX: T.axSection,
          axisZ: T.elevation,
        },
        lang
      );
    },
    [Hd, crest, B, H, Ht, mu, coh, residual, upliftOn, lang]
  );

  return (
    <LabShell
      status={
        dipotong || mercuDipotong ? (
          <RegimeScale
            symbol="e/B"
            value={NaN}
            invalid
            pesan={dipotong ? x.dipotong : x.mercu}
            digits={3}
            bands={[{ from: -0.5, to: 0.5, label: x.luarRentang, tone: "invalid" }]}
          />
        ) : (
          /* Batas ±1/6 dari tension: |e| > B/6 (aturan sepertiga tengah,
             USBR 1976). |e| > B/2 lewat ujung skala = resultan di luar
             dasar, satu-satunya keadaan merah sinyal di skala ini. */
          <RegimeScale
            symbol="e/B"
            value={eB}
            invalid={luarDasar}
            pesan={luarDasar ? x.luarDasar : undefined}
            digits={3}
            bands={[
              { from: -0.5, to: -1 / 6, label: x.bKakiT, tone: "caution" },
              { from: -1 / 6, to: 1 / 6, label: x.bTengah, tone: "pass" },
              { from: 1 / 6, to: 0.5, label: x.bTumitT, tone: "caution" },
            ]}
          />
        )
      }
      sheet="DM-01"
      subject={SUBJECTS.DM[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Yang paling sering menjatuhkan hitungan ini bukan dorongan airnya
            melainkan <Term tint={C.critical}>tekanan angkat</Term> di bawah
            dasarnya, yang menghapus{" "}
            <Term tint={C.critical}>
              {fmt((r.uplift / Math.max(r.weight, 1e-9)) * 100, 0)} persen
            </Term>{" "}
            berat betonnya.
          </p>
        ) : (
          <p>
            What most often fails this calculation is not the water pushing on
            the face but the <Term tint={C.critical}>uplift</Term> beneath the
            base, which cancels{" "}
            <Term tint={C.critical}>
              {fmt((r.uplift / Math.max(r.weight, 1e-9)) * 100, 0)} per cent
            </Term>{" "}
            of the concrete weight.
          </p>
        )
      }
      drawing={
        <Sheet
          number="DM-01"
          title={x.sheetTitle}
          rev="A"
          /* Di HP bingkai 56vh lebih tinggi daripada gambarnya; dibatasi
             118vw. Di layar lebar 56vh tetap yang menentukan. */
          height="clamp(360px, min(56vh, 118vw), 620px)"
          cells={[
            { label: t.tbUnit, value: "SI (m, kN, kPa)" },
            { label: "e", value: `${fmt(r.eccentricity, 2)} m`, tint: luarDasar ? C.signal : r.tension ? C.caution : C.critical },
            { label: "FSg", value: fmt(r.fsOverturning, 2), tint: kurangGuling ? C.caution : undefined },
            { label: "FSs", value: fmt(r.fsSliding, 2), tint: kurangGeser ? C.caution : undefined },
            { label: "γc", value: `${fmtPlain(CONCRETE_UNIT_WEIGHT, 0)} kN/m³` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <div className="mb-3">
              <PresetRow
                label={x.mode}
                active={upliftOn ? 0 : 1}
                presets={[
                  { label: x.mAda, apply: () => setUpliftOn(true) },
                  { label: x.mTanpa, apply: () => setUpliftOn(false) },
                ]}
              />
            </div>
            <InputTable>
              <InputRow symbol="Hd" label={x.dHd} value={Hd} min={10} max={100} step={1} digits={0} unit="m" onChange={setHd} />
              <InputRow symbol="a" label={x.dCrest} value={crest} min={2} max={14} step={0.5} digits={1} unit="m" onChange={setCrest} />
              <InputRow symbol="B" label={x.dBase} value={B} min={6} max={90} step={0.5} digits={1} unit="m" onChange={setB} tint={C.critical} />
              <InputRow symbol="H" label={x.dH} value={H} min={1} max={100} step={0.5} digits={1} unit="m" onChange={setH} tint={C.water} />
              <InputRow symbol="Ht" label={x.dHt} value={Ht} min={0} max={40} step={0.5} digits={1} unit="m" onChange={setHt} tint={C.water} />
              <InputRow symbol="μ" label={x.dMu} value={mu} min={0.4} max={1} step={0.02} digits={2} onChange={setMu} />
              <InputRow symbol="c" label={x.dCoh} value={coh} min={0} max={600} step={10} digits={0} unit="kPa" onChange={setCoh} />
              <InputRow symbol="ku" label={x.dDrain} value={residual} min={0} max={1} step={0.05} digits={2} onChange={setResidual} tint={C.critical} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pPenuh, apply: () => { setHd(40); setCrest(6); setB(30); setH(38); setHt(3); setMu(0.7); setCoh(100); setResidual(UPLIFT_DRAIN_RESIDUAL); setUpliftOn(true); } },
                  { label: x.pTanpaTiris, apply: () => { setHd(40); setCrest(6); setB(30); setH(38); setHt(3); setMu(0.7); setCoh(100); setResidual(1); setUpliftOn(true); } },
                  { label: x.pHilir, apply: () => { setHd(40); setCrest(6); setB(26); setH(38); setHt(12); setMu(0.7); setCoh(0); setResidual(1); setUpliftOn(true); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "FSg", label: x.rFsO, value: fmt(r.fsOverturning, 3), tint: kurangGuling ? C.caution : undefined, strong: true },
                { symbol: "FSs", label: x.rFsS, value: fmt(r.fsSliding, 3), tint: kurangGeser ? C.caution : undefined, strong: true },
                { symbol: "e", label: x.rE, value: fmt(r.eccentricity, 3), unit: "m", tint: luarDasar ? C.signal : r.tension ? C.caution : C.critical, strong: true },
                { symbol: "W", label: x.rW, value: fmt(r.weight, 0), unit: x.kNm },
                { symbol: "U", label: x.rU, value: fmt(r.uplift, 0), unit: x.kNm, tint: upliftOn ? C.critical : undefined },
                { symbol: "Pu", label: x.rPu, value: fmt(r.thrustUp, 0), unit: x.kNm, tint: C.water },
                { symbol: "Pd", label: x.rPd, value: fmt(r.thrustDown, 0), unit: x.kNm, tint: C.water },
                { symbol: "ΣV", label: x.rV, value: fmt(r.sumV, 0), unit: x.kNm },
                { symbol: "ΣH", label: x.rHh, value: fmt(r.sumH, 0), unit: x.kNm },
                { symbol: "x̄", label: x.rX, value: fmt(r.resultantAt, 3), unit: "m" },
                { symbol: "σt", label: x.rHeel, value: luarDasar ? kosong : fmt(r.heelStress, 1), unit: luarDasar ? undefined : "kPa", tint: !luarDasar && r.heelStress < 0 ? C.caution : undefined },
                { symbol: "σk", label: x.rToe, value: luarDasar ? kosong : fmt(r.toeStress, 1), unit: luarDasar ? undefined : "kPa", tint: !luarDasar && r.toeStress < 0 ? C.caution : undefined },
                { symbol: "Bmin", label: x.rBase, value: fmt(r.baseNoTension, 2), unit: "m" },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hW,
                    rumus: <span>{x.hWRumus}</span>,
                    isi: `${fmt(CONCRETE_UNIT_WEIGHT, 0)} · ${fmt(luasBadan, 1)} ; x̄w = ${fmt(r.weightArm, 3)} m`,
                    hasil: fmt(r.weight, 0),
                    satuan: x.kNm,
                  },
                  {
                    judul: x.hGaya,
                    rumus: (<><span>Pu =</span><Frac num="γw · H²" den="2" /><span>; Pd =</span><Frac num="γw · Ht²" den="2" /><span>; U = luas diagram angkat</span></>),
                    isi: upliftOn
                      ? `Pu = ½ · ${fmt(WATER_UNIT_WEIGHT, 2)} · ${fmt(Hp, 1)}² = ${fmt(r.thrustUp, 0)} ; Pd = ½ · ${fmt(WATER_UNIT_WEIGHT, 2)} · ${fmt(Htp, 1)}² = ${fmt(r.thrustDown, 0)} ; U: ${fmt(Hp, 1)} m (${T.heelLabel}), ${fmt(hTiris, 2)} m (${fmtPlain(DRAIN_AT, 1)} B), ${fmt(Htp, 1)} m (${T.toeLabelDam}) · ${fmt(WATER_UNIT_WEIGHT, 2)} ; x̄u = ${fmt(r.upliftArm, 3)} m`
                      : `Pu = ½ · ${fmt(WATER_UNIT_WEIGHT, 2)} · ${fmt(Hp, 1)}² = ${fmt(r.thrustUp, 0)} ; Pd = ½ · ${fmt(WATER_UNIT_WEIGHT, 2)} · ${fmt(Htp, 1)}² = ${fmt(r.thrustDown, 0)} ; U = 0`,
                    hasil: fmt(r.uplift, 0),
                    satuan: x.kNm,
                    tint: C.critical,
                  },
                  {
                    judul: x.hResultan,
                    rumus: (<><span>ΣV = W − U ; ΣH = Pu − Pd ; x̄ =</span><Frac num="W x̄w − U x̄u + Pu H/3 − Pd Ht/3" den="ΣV" /><span>; e = x̄ − B/2</span></>),
                    isi: `ΣV = ${fmt(r.weight, 0)} − ${fmt(r.uplift, 0)} = ${fmt(r.sumV, 0)} ; ΣH = ${fmt(r.thrustUp, 0)} − ${fmt(r.thrustDown, 0)} = ${fmt(r.sumH, 0)} ; x̄ = ${fmt(r.resultantAt, 3)} ; e = ${fmt(r.resultantAt, 3)} − ${fmt(B / 2, 2)}`,
                    hasil: fmt(r.eccentricity, 3),
                    satuan: "m",
                    tint: C.critical,
                  },
                  {
                    judul: x.hSigma,
                    rumus: (<><span>σ =</span><Frac num="ΣV" den="B" /><span>( 1 ∓ 6e/B )</span></>),
                    isi: luarDasar
                      ? x.luarDasar
                      : `${fmt(r.sumV, 0)} / ${fmt(B, 1)} · ( 1 − 6 · ${fmt(r.eccentricity, 3)} / ${fmt(B, 1)} ) = ${fmt(r.heelStress, 1)} ; ( 1 + … ) = ${fmt(r.toeStress, 1)}`,
                    hasil: luarDasar ? kosong : `${fmt(r.heelStress, 1)} ; ${fmt(r.toeStress, 1)}`,
                    satuan: luarDasar ? undefined : "kPa",
                  },
                  {
                    judul: x.hFs,
                    rumus: (<><span>FSg =</span><Frac num="W (B − x̄w) + Pd Ht/3" den="Pu H/3 + U (B − x̄u)" /><span>; FSs =</span><Frac num="μ ΣV + c B" den="ΣH" /></>),
                    isi: `FSg = ${fmt(r.fsOverturning, 3)} ; FSs = ( ${fmt(mu, 2)} · ${fmt(r.sumV, 0)} + ${fmt(coh, 0)} · ${fmt(B, 1)} ) / ${fmt(r.sumH, 0)}`,
                    hasil: `${fmt(r.fsOverturning, 3)} ; ${fmt(r.fsSliding, 3)}`,
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={nada}
            badge={dipotong ? x.dipotong : mercuDipotong ? x.mercu : luarDasar ? x.luarDasar : badgeGagal}
            {...notice(Hd, crest, B, Hp, Htp, mu, coh, residual, upliftOn, { dipotong, mercuDipotong, luarDasar }, x, lang)}
          />
        </>
      }
      verification={
        <Verification checks={checksDam(Hd, crest, B, Hp, Htp, mu, coh, residual, upliftOn)} />
      }
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>x̄ =</span>
                <Frac num="W x̄w − U x̄u + Pu H/3 − Pd Ht/3" den="W − U" />
                <span className="ml-5">e = x̄ −</span>
                <Frac num="B" den="2" />
              </Eq>
              <Eq>
                <span>σ =</span>
                <Frac num="ΣV" den="B" />
                <span>(1 ± 6e/B)</span>
                <span className="ml-5">FSs =</span>
                <Frac num="μ ΣV + c B" den="ΣH" />
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? `tirisan di ${fmtPlain(DRAIN_AT * 100, 0)} persen lebar dasar dari tumit, air ${fmtPlain(WATER_UNIT_WEIGHT, 2)} kN/m³, beton ${fmtPlain(CONCRETE_UNIT_WEIGHT, 0)} kN/m³, berat air di atas muka hilir diabaikan sebagai cadangan`
                    : `drain at ${fmtPlain(DRAIN_AT * 100, 0)} per cent of the base from the heel, water ${fmtPlain(WATER_UNIT_WEIGHT, 2)} kN/m³, concrete ${fmtPlain(CONCRETE_UNIT_WEIGHT, 0)} kN/m³, the weight of water on the downstream face is left out as a margin`}
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

/*
 * Kalimat keadaan, lalu butir: (a) angkat menghapus … % berat (cabang bila
 * angkat ditiadakan); (b) lebarkan 1 m vs tirisan; (c) air hilir naik 6 m,
 * alasannya dari perbandingan yang dihitung; (d) catatan di luar rentang,
 * tarik, dan kejujuran syarat FS.
 */
function notice(
  Hd: number,
  crest: number,
  B: number,
  H: number,
  Ht: number,
  mu: number,
  coh: number,
  residual: number,
  upliftOn: boolean,
  luar: { dipotong: boolean; mercuDipotong: boolean; luarDasar: boolean },
  x: { dipotongNote: string; mercuNote: string; luarDasarNote: string; tarikNote: string; fsJujur: string },
  lang: Lang
): { state: string; notice: string[] } {
  const en = lang === "en";
  const r = gravityDam(Hd, crest, B, H, Ht, mu, coh, residual, DRAIN_AT, upliftOn);
  const eB = r.eccentricity / B;
  const tengah = Math.abs(eB) <= 1 / 6;

  const state = luar.luarDasar
    ? en
      ? `e/B = ${fmt(eB, 3)}: the resultant falls outside the base; FSg ${fmt(r.fsOverturning, 2)}, FSs ${fmt(r.fsSliding, 2)}.`
      : `e/B = ${fmt(eB, 3)}: resultan jatuh di luar dasar; FSg ${fmt(r.fsOverturning, 2)}, FSs ${fmt(r.fsSliding, 2)}.`
    : en
      ? `e/B = ${fmt(eB, 3)}: the resultant is ${tengah ? "inside" : "outside"} the middle third; FSg ${fmt(r.fsOverturning, 2)}, FSs ${fmt(r.fsSliding, 2)}.`
      : `e/B = ${fmt(eB, 3)}: resultan ${tengah ? "di dalam" : "di luar"} sepertiga tengah; FSg ${fmt(r.fsOverturning, 2)}, FSs ${fmt(r.fsSliding, 2)}.`;

  const butir: string[] = [];
  if (luar.dipotong) butir.push(x.dipotongNote);
  if (luar.mercuDipotong) butir.push(x.mercuNote);
  if (luar.luarDasar) {
    butir.push(x.luarDasarNote);
    return { state, notice: butir };
  }
  if (r.tension) butir.push(x.tarikNote);

  const persen = fmt((r.uplift / Math.max(r.weight, 1e-9)) * 100, 0);
  if (upliftOn) {
    const tanpa = gravityDam(Hd, crest, B, H, Ht, mu, coh, residual, DRAIN_AT, false);
    butir.push(
      en
        ? `Uplift removes ${fmt(r.uplift, 0)} kN per metre, ${persen} per cent of the concrete weight. Switch it off and the sliding factor goes from ${fmt(r.fsSliding, 2)} to ${fmt(tanpa.fsSliding, 2)}.`
        : `Tekanan angkat menghapus ${fmt(r.uplift, 0)} kN tiap meter, ${persen} persen berat betonnya. Tiadakan ia dan faktor gesernya berpindah dari ${fmt(r.fsSliding, 2)} ke ${fmt(tanpa.fsSliding, 2)}.`
    );
  } else {
    const dengan = gravityDam(Hd, crest, B, H, Ht, mu, coh, residual, DRAIN_AT, true);
    butir.push(
      en
        ? `Uplift is left out, so these factors are an upper bound. Counting it would remove ${fmt(dengan.uplift, 0)} kN per metre and bring the sliding factor from ${fmt(r.fsSliding, 2)} down to ${fmt(dengan.fsSliding, 2)}.`
        : `Tekanan angkat sedang ditiadakan, jadi faktor-faktor ini batas atas. Bila diperhitungkan, ia menghapus ${fmt(dengan.uplift, 0)} kN tiap meter dan faktor gesernya turun dari ${fmt(r.fsSliding, 2)} ke ${fmt(dengan.fsSliding, 2)}.`
    );
  }

  const lebar = gravityDam(Hd, crest, B + 1, H, Ht, mu, coh, residual, DRAIN_AT, upliftOn);
  const tiris = gravityDam(Hd, crest, B, H, Ht, mu, coh, UPLIFT_DRAIN_RESIDUAL, DRAIN_AT, upliftOn);
  const naikLebar = lebar.fsSliding - r.fsSliding;
  const naikTiris = tiris.fsSliding - r.fsSliding;
  const adaTiris = upliftOn && residual > UPLIFT_DRAIN_RESIDUAL;
  butir.push(
    en
      ? `Widening the base by one metre buys ${fmt(naikLebar, 3)} on the sliding factor${adaTiris ? `, while making the drains work buys ${fmt(naikTiris, 3)} and costs far less concrete` : ""}.`
      : `Melebarkan dasarnya satu meter menaikkan faktor gesernya ${fmt(naikLebar, 3)}${adaTiris ? `, sedangkan membuat tirisannya bekerja menaikkannya ${fmt(naikTiris, 3)} dengan beton jauh lebih sedikit` : ""}.`
  );

  /* Air hilir naik enam meter, dipotong pada air hulu. FSs naik tepat
     bila μ·ΔU < FSs·ΔPd (dari FSs = (μΣV + cB)/ΣH); pada c = 0 setara
     ΔU < ΔPd·ΣV/ΣH. Alasannya ditulis dari angka ini, bukan dari ada
     tidaknya kohesi. */
  const HtBaru = Math.min(Ht + 6, H);
  const naik = HtBaru - Ht;
  if (naik > 1e-9) {
    const hilir = gravityDam(Hd, crest, B, H, HtBaru, mu, coh, residual, DRAIN_AT, upliftOn);
    const dU = hilir.uplift - r.uplift;
    const dPd = hilir.thrustDown - r.thrustDown;
    const hilang = mu * dU;
    const hemat = r.fsSliding * dPd;
    const lebihBaik = hilir.fsSliding > r.fsSliding;
    butir.push(
      en
        ? `Raise the tailwater by ${fmt(naik, 1)} m: the net thrust falls by ${fmt(dPd, 0)} kN and the uplift grows by ${fmt(dU, 0)} kN, so the sliding factor ${lebihBaik ? "rises" : "falls"} to ${fmt(hilir.fsSliding, 2)}. The friction lost, μ·ΔU = ${fmt(hilang, 0)} kN, is ${hilang < hemat ? "smaller" : "larger"} than the thrust saved times the sliding factor, FSs·ΔPd = ${fmt(hemat, 0)} kN.`
        : `Naikkan air hilirnya ${fmt(naik, 1)} m: dorongan bersihnya turun ${fmt(dPd, 0)} kN dan gaya angkatnya bertambah ${fmt(dU, 0)} kN, jadi faktor gesernya ${lebihBaik ? "naik" : "turun"} menjadi ${fmt(hilir.fsSliding, 2)}. Gesekan yang hilang, μ·ΔU = ${fmt(hilang, 0)} kN, ${hilang < hemat ? "lebih kecil" : "lebih besar"} daripada dorongan yang dihemat dikali faktor gesernya, FSs·ΔPd = ${fmt(hemat, 0)} kN.`
    );
  }

  butir.push(x.fsJujur);
  return { state, notice: butir };
}
