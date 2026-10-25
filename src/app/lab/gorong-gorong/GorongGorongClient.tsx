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
  type RegimeBand,
} from "@/components/ui";
import { useCanvas } from "@/lib/useCanvas";
import {
  drawStructure,
  type StructureLine,
  type StructureSpec,
} from "@/lib/drawStructure";
import {
  CULVERT_FISH_VELOCITY,
  CULVERT_HW_D_MAX,
  G,
  HDS5_C,
  HDS5_K,
  HDS5_KS,
  HDS5_KU,
  HDS5_X_SUB,
  HDS5_X_UNSUB,
  HDS5_Y,
  culvert,
  fmt,
  fmtPlain,
} from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksCulvert } from "@/lib/checks";

const TXT = {
  id: {
    title: "Gorong-gorong",
    sheetTitle: "Gorong-gorong bulat — kendali sisi masuk dibanding kendali sisi keluar",
    dQ: "Debit rancangan",
    dD: "Diameter gorong-gorong",
    dL: "Panjang gorong-gorong",
    dS: "Kemiringan dasar",
    dN: "Angka kekasaran Manning",
    dTw: "Kedalaman air di hilir",
    dRoad: "Tinggi timbunan jalan",
    pMasuk: "Pendek dan curam, kendali masuk",
    pKeluar: "Panjang dan landai, kendali keluar",
    pBanjir: "Banjir melampaui jalan",
    rHw: "Tinggi muka air hulu yang dibutuhkan",
    rHwMasuk: "Bila kendali sisi masuk",
    rHwKeluar: "Bila kendali sisi keluar",
    rControl: "Yang mengendalikan",
    rV: "Kecepatan di dalam gorong-gorong",
    rHwD: "Perbandingan HW terhadap D",
    rJagaan: "Sisa tinggi sampai permukaan jalan",
    cMasuk: "Kendali sisi masuk",
    cKeluar: "Kendali sisi keluar",
    limpas: "Air melampaui permukaan jalan",
    takMuat: "Gorong-gorong tidak muat di bawah jalannya",
    takMuatNote:
      "Diameter gorong-gorongnya menyisakan kurang dari tiga ratus milimeter timbunan antara punggungnya dan permukaan jalan, jadi ia tidak dapat ditanam di situ sama sekali. Pipa yang timbunannya terlalu tipis hancur oleh beban roda, bukan oleh tanah di atasnya, karena timbunan itulah yang menyebarkan beban roda sebelum sampai ke punggung pipa; di bawah kira-kira sepertiga meter, bebannya sampai hampir utuh. Artinya pada perancangan: gorong-gorong tidak dapat begitu saja diperbesar sampai muka air hulunya cukup rendah. Melewati titik ini pilihannya menaikkan jalan, memakai beberapa pipa kecil berdampingan, atau berpindah ke gorong-gorong kotak yang atapnya datar sehingga bebannya ditahan sebagai lenturan dan bukan sebagai tekan cincin.",
    limpasNote:
      "Tinggi muka air hulu yang dibutuhkan melampaui tinggi timbunan jalan, artinya air melimpah di atas jalan dan sebagian debit lewat di sana alih-alih lewat gorong-gorong. Hitungan di lembar ini tidak berlaku sejak titik itu karena seluruhnya mengandaikan seluruh debit lewat pipanya. Yang lebih penting untuk perancangan: jalan yang dilimpasi tidak sekadar terputus, badan jalannya tergerus dari sisi hilir dan dapat runtuh dalam hitungan jam. Perbesar gorong-gorongnya, tambah jumlahnya, atau tinggikan jalannya.",
    penghalang: "Penghalang bagi ikan",
    penghalangNote:
      "Kecepatan di dalam gorong-gorong melampaui 1,2 meter per detik, batas yang lazim dipakai sebagai syarat lintasan ikan pada sungai kecil. Gorong-gorong yang terlalu cepat memutus sungai menjadi dua bagi ikan yang harus naik untuk memijah, dan akibatnya tidak terlihat sampai bertahun-tahun kemudian ketika bagian hulu kehilangan jenis ikannya. Perbesar diameternya, landaikan dasarnya, atau tanam dasarnya di bawah dasar sungai sehingga terisi sedimen dan kekasarannya menjadi kekasaran sungai.",
    tidakPenuh: "Pipa mengalir sebagian",
    tidakPenuhNote:
      "Debitnya belum cukup untuk mengisi penuh pipanya. Hitungan kendali sisi keluar di lembar ini memakai kecepatan pipa penuh dan muka air di ujung keluar ho = maks(TW, (dc + D)/2), dan keduanya hanya pendekatan pada aliran sebagian. Angka kendali sisi keluarnya karena itu taksiran kasar yang cenderung terlalu besar, dan HDS-5 sendiri menyatakan caranya hanya pendekatan di daerah ini. Angka kendali sisi masuk tetap berlaku.",
    rDc: "Kedalaman kritis di pipa",
    bTakTerendam: "Mulut tidak terendam",
    bTerendam: "Mulut terendam",
    bAtasBatas: "Di atas batas rancangan HW/D",
    bLimpas: "Melimpas jalan",
    bawahBagan: "Di bawah bagan HDS-5",
    bawahBaganNote: (hwi: string, dc: string) =>
      `Rumus kendali masuk HDS-5 memberi HWi = ${hwi} m, lebih rendah daripada kedalaman kritis di pipa dc = ${dc} m. Itu terjadi pada debit kecil di pipa besar yang curam, ketika suku kemiringan −0,5·S melampaui Hc/D. Titik ini di luar bagan HDS-5, jadi HWi dan HW tidak ditulis sebagai jawaban.`,
    sKendali: (c: string, hw: string, r: string, f: string) =>
      `${c}: HW = ${hw} m (HW/D = ${r}), sisa ke jalan ${f} m.`,
    sLimpas: (hw: string, hj: string) => `Air melampaui jalan: HW = ${hw} m > Hj = ${hj} m.`,
    sTakMuat: (d: string, hj: string) =>
      `Pipa D = ${d} m tidak muat di bawah timbunan Hj = ${hj} m (timbunan minimum 0,3 m).`,
    sBawahBagan: "Kendali masuk di luar bagan HDS-5: muka air hulu tidak dapat dibaca dari rumusnya.",
    atasBatasNote: (r: string) =>
      `HW/D = ${r} melampaui ${fmt(CULVERT_HW_D_MAX, 1)}, batas yang lazim dipakai instansi untuk rancangan gorong-gorong (bukan batas berlakunya rumus). Hasilnya tetap sah; muka air hulu setinggi ini biasanya berarti pipa perlu diperbesar.`,
    bentukMasuk: (x: string, f: string) => `Parameter kendali masuk X = ${x}: ${f}.`,
    fTak: "rumus mulut tidak terendam (HDS-5 pers. A.1)",
    fPeralihan: "di antara kedua rumus HDS-5, diinterpolasi lurus (pilihan model)",
    fTerendam: "rumus mulut terendam (HDS-5 pers. A.3)",
    hwoNegatif: "HWo dari rumus kendali keluar negatif: penurunan dasar sepanjang pipa melebihi kehilangan energi dan ho, jadi sisi keluar tidak mengendalikan. Angkanya ditulis \u201c—\u201d.",
    tidakKendali: "tidak mengendalikan",
    panjangNaik: (l1: string, l2: string, dk: string, dhw: string) =>
      `Lipatduakan panjangnya, dari ${l1} ke ${l2} m: angka kendali sisi masuk tidak berubah sama sekali, karena mulut gorong-gorong tidak tahu berapa panjang pipa di belakangnya, sedangkan angka kendali sisi keluar berubah ${dk} m. Muka air hulu yang berlaku naik ${dhw} m.`,
    panjangTurun: (l1: string, l2: string, dk: string, dhw: string) =>
      `Lipatduakan panjangnya, dari ${l1} ke ${l2} m: angka kendali sisi masuk tidak berubah, sedangkan angka kendali sisi keluar berubah ${dk} m. Pada dasar securam ini penurunan dasar S·L tumbuh lebih cepat daripada kehilangan gesekan, jadi muka air hulu yang berlaku justru turun ${dhw} m.`,
    panjangTetap: (l1: string, l2: string, dk: string) =>
      `Lipatduakan panjangnya, dari ${l1} ke ${l2} m: angka kendali sisi masuk tidak berubah, angka kendali sisi keluar berubah ${dk} m, dan karena sisi masuk tetap mengendalikan, muka air hulu yang berlaku tidak berubah.`,
    hV: "Luas penampang dan kecepatan pipa penuh",
    hDc: "Kedalaman kritis di pipa bulat (bagi dua) dan energi kritis",
    hX: "Parameter kendali masuk HDS-5",
    hHwi: "Kendali sisi masuk",
    hH: "Kehilangan energi pipa penuh dan muka air di ujung keluar",
    hHwo: "Kendali sisi keluar",
    hHw: "Yang lebih tinggi yang berlaku",
    note:
      "Yang paling sering salah dipahami dari gorong-gorong: ada DUA hitungan yang berbeda sama sekali, dan yang berlaku adalah yang menuntut muka air hulu lebih tinggi. Kendali sisi masuk berarti mulutnya yang membatasi, seperti ambang atau lubang, dan pada keadaan itu panjang maupun kekasaran pipanya tidak berpengaruh sama sekali: memperpanjang gorong-gorong yang dikendalikan sisi masuk tidak menaikkan muka air hulunya sedikit pun. Kendali sisi keluar berarti gesekan sepanjang pipa dan muka air hilir yang membatasi, dan di situ panjang serta kekasaran menentukan seluruhnya. Karena kedua hitungan menjawab pertanyaan yang berbeda, keduanya harus dikerjakan dan yang terbesar diambil; memilih salah satu di muka adalah kesalahan yang menghasilkan rancangan yang tampak benar dan gagal saat banjir. Geser panjang gorong-gorongnya dari ujung ke ujung dan perhatikan garis mana yang bergerak dan mana yang diam.",
  },
  en: {
    title: "Culvert",
    sheetTitle: "Circular culvert — inlet control against outlet control",
    dQ: "Design discharge",
    dD: "Culvert diameter",
    dL: "Culvert length",
    dS: "Barrel slope",
    dN: "Manning roughness",
    dTw: "Tailwater depth",
    dRoad: "Embankment height",
    pMasuk: "Short and steep, inlet control",
    pKeluar: "Long and flat, outlet control",
    pBanjir: "Flood overtopping the road",
    rHw: "Headwater required",
    rHwMasuk: "Under inlet control",
    rHwKeluar: "Under outlet control",
    rControl: "Which one governs",
    rV: "Velocity in the barrel",
    rHwD: "Ratio of HW to D",
    rJagaan: "Freeboard to the road surface",
    cMasuk: "Inlet control",
    cKeluar: "Outlet control",
    limpas: "Water overtops the road",
    takMuat: "The culvert does not fit under the road",
    takMuatNote:
      "The culvert diameter leaves less than 300 millimetres of cover between its crown and the road surface, so it cannot be buried there at all. A pipe with too little cover is crushed by wheel loads rather than by the earth above it, because the fill is what spreads a wheel load before it reaches the crown; below about a third of a metre the load arrives almost undiminished. What this means in practice is that a culvert cannot simply be enlarged until the headwater is acceptable. Past this point the choice is between raising the road, using several smaller barrels side by side, or changing to a box culvert whose flat top carries the load in bending rather than in ring compression.",
    limpasNote:
      "The required headwater exceeds the embankment height, meaning water spills over the road and part of the discharge passes there rather than through the culvert. The calculation on this sheet stops holding at that point, because all of it assumes the whole discharge passes through the barrel. More important for design: an overtopped road is not merely cut, its body is scoured from the downstream side and can fail within hours. Enlarge the culvert, add barrels, or raise the road.",
    penghalang: "Barrier to fish",
    penghalangNote:
      "The barrel velocity exceeds 1.2 metres per second, the limit commonly applied as a fish-passage requirement on small streams. A culvert that is too fast cuts the stream in two for fish that must move upstream to spawn, and the consequence is invisible until years later when the upper reach has lost its species. Enlarge the diameter, flatten the barrel, or embed the invert below the streambed so it fills with sediment and takes on the roughness of the stream.",
    tidakPenuh: "Barrel flowing part full",
    tidakPenuhNote:
      "The discharge is not yet enough to fill the barrel. The outlet-control calculation on this sheet uses the full-pipe velocity and an outlet water level ho = max(TW, (dc + D)/2), and both are only approximations in part-full flow. The outlet-control figure is therefore a rough estimate that tends to run high, and HDS-5 itself states that the method is only approximate in this region. The inlet-control figure still holds.",
    rDc: "Critical depth in the barrel",
    bTakTerendam: "Inlet unsubmerged",
    bTerendam: "Inlet submerged",
    bAtasBatas: "Above design HW/D",
    bLimpas: "Road overtopped",
    bawahBagan: "Below the HDS-5 chart",
    bawahBaganNote: (hwi: string, dc: string) =>
      `The HDS-5 inlet-control formula gives HWi = ${hwi} m, below the critical depth in the barrel dc = ${dc} m. This happens at small discharge in a large steep barrel, when the slope term −0.5·S outweighs Hc/D. The point lies outside the HDS-5 chart, so HWi and HW are not reported as answers.`,
    sKendali: (c: string, hw: string, r: string, f: string) =>
      `${c}: HW = ${hw} m (HW/D = ${r}), freeboard to the road ${f} m.`,
    sLimpas: (hw: string, hj: string) => `Water overtops the road: HW = ${hw} m > Hj = ${hj} m.`,
    sTakMuat: (d: string, hj: string) =>
      `A D = ${d} m barrel does not fit under an Hj = ${hj} m embankment (minimum cover 0.3 m).`,
    sBawahBagan: "Inlet control outside the HDS-5 chart: the headwater cannot be read from its formula.",
    atasBatasNote: (r: string) =>
      `HW/D = ${r} exceeds ${fmt(CULVERT_HW_D_MAX, 1)}, the limit agencies commonly apply to culvert design (not a limit on the formula itself). The result still holds; a headwater this high usually means the barrel should be larger.`,
    bentukMasuk: (x: string, f: string) => `Inlet-control parameter X = ${x}: ${f}.`,
    fTak: "unsubmerged inlet formula (HDS-5 eq. A.1)",
    fPeralihan: "between the two HDS-5 formulas, interpolated linearly (a model choice)",
    fTerendam: "submerged inlet formula (HDS-5 eq. A.3)",
    hwoNegatif: "The outlet-control formula gives a negative HWo: the fall of the barrel exceeds the energy loss and ho, so the outlet does not control. The figure is shown as \u201c—\u201d.",
    tidakKendali: "does not control",
    panjangNaik: (l1: string, l2: string, dk: string, dhw: string) =>
      `Double the length, from ${l1} to ${l2} m: the inlet-control figure does not change at all, because the inlet does not know how long the barrel behind it is, while the outlet-control figure changes by ${dk} m. The governing headwater rises by ${dhw} m.`,
    panjangTurun: (l1: string, l2: string, dk: string, dhw: string) =>
      `Double the length, from ${l1} to ${l2} m: the inlet-control figure does not change, while the outlet-control figure changes by ${dk} m. On a slope this steep the barrel fall S·L grows faster than the friction loss, so the governing headwater actually falls by ${dhw} m.`,
    panjangTetap: (l1: string, l2: string, dk: string) =>
      `Double the length, from ${l1} to ${l2} m: the inlet-control figure does not change, the outlet-control figure changes by ${dk} m, and because the inlet still governs, the governing headwater does not change.`,
    hV: "Area and full-barrel velocity",
    hDc: "Critical depth in a circular barrel (bisection) and critical energy",
    hX: "HDS-5 inlet-control parameter",
    hHwi: "Inlet control",
    hH: "Full-barrel energy loss and outlet water level",
    hHwo: "Outlet control",
    hHw: "The higher one governs",
    note:
      "The most commonly misunderstood thing about culverts: there are TWO entirely different calculations, and the one that governs is whichever demands the higher headwater. Inlet control means the entrance limits the flow, like a weir or an orifice, and in that state neither the length nor the roughness of the barrel matters at all: lengthening a culvert under inlet control does not raise the headwater by a millimetre. Outlet control means friction along the barrel and the tailwater limit it, and there the length and roughness decide everything. Because the two calculations answer different questions, both must be done and the larger taken; picking one in advance is the error that produces a design which looks right and fails in flood. Sweep the culvert length from end to end and watch which line moves and which stands still.",
  },
} as const;

const REFS = {
  id: [
    "FHWA (2012). Hydraulic Design of Highway Culverts, HDS-5, edisi ke-3.",
    "Normann, J.M., Houghtalen, R.J. & Johnston, W.J. (2012). HDS-5 Publication FHWA-HIF-12-026.",
    "Barnard, R.J. dkk. (2013). Water Crossings Design Guidelines. Washington Department of Fish and Wildlife.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill, Bab 17.",
  ],
  en: [
    "FHWA (2012). Hydraulic Design of Highway Culverts, HDS-5, 3rd ed.",
    "Normann, J.M., Houghtalen, R.J. & Johnston, W.J. (2012). HDS-5 Publication FHWA-HIF-12-026.",
    "Barnard, R.J. et al. (2013). Water Crossings Design Guidelines. Washington Department of Fish and Wildlife.",
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill, Chapter 17.",
  ],
} as const;

export function GorongGorongClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  /* Nilai awal Q 1,8 (bukan 2): dengan kendali masuk HDS-5 (gelombang 1
     model), Q 2 memberi HW/D 1,506, di atas batas rancangan 1,5, jadi
     lembar terbuka pada keadaan peringatan. Q 1,8 memberi HW/D 1,346. */
  const [Q, setQ] = useState(1.8);
  const [D, setD] = useState(1);
  const [L, setL] = useState(20);
  const [S, setS] = useState(0.02);
  const [n, setN] = useState(0.013);
  const [tw, setTw] = useState(0.4);
  const [road, setRoad] = useState(2.5);

  const r = culvert(Q, D, L, S, n, tw, road);
  const controlName = r.control === "masuk" ? x.cMasuk : x.cKeluar;
  /*
   * Dua penggeser yang terikat satu sama lain: diameter pipanya dan
   * tinggi timbunan jalannya. Gorong-gorong yang lebih tinggi daripada
   * timbunan di atasnya tidak dapat ditanam, dan gambarnya memang
   * memperlihatkan pipa yang menonjol di atas jalan. Yang kurang sebelumnya
   * hanya keterangan bahwa itu memang tidak boleh.
   */
  const timbunanMinimum = 0.3;
  const takMuat = D + timbunanMinimum > road;

  /* Nilai antara langkah hitungan kendali keluar. Lib belum menyimpan
     hLoss dan ho sebagai field (PERMINTAAN ke pengembang-model). ho dihitung
     dengan rumus yang sama persis dengan lib, dan H dibaca balik dari
     r.outletHeadwater, jadi angka langkahnya sama dengan tabel. */
  const A = (Math.PI / 4) * D * D;
  const ho = Math.max(tw, (r.criticalDepth + D) / 2);
  const hLoss = r.outletHeadwater - ho + S * L;
  /* HWo negatif (CACAT 4): penurunan dasar lebih besar daripada ho + H. */
  const hwoSah = r.outletHeadwater >= 0;
  const bentuk =
    r.inletForm === "tak-terendam" ? x.fTak : r.inletForm === "terendam" ? x.fTerendam : x.fPeralihan;
  const keadaan = bacaKeadaan({ Q, D, L, S, n, tw, road }, r, takMuat, hwoSah, bentuk, lang);

  const ref = useCanvas(
    (ctx, w, ch) => {
      const zMasuk = 0;
      const zKeluar = -S * L;
      const xKiri = -L * 0.35;
      const xKanan = L * 1.35;
      const tebal = Math.max(D * 0.08, 0.05);

      /*
       * Batas atas bidang DITAHAN, tidak mengikuti muka air hulu.
       *
       * Muka air hulu yang dibutuhkan tumbuh sangat cepat pada gorong-gorong
       * yang terlalu kecil: pada diameter tiga puluh sentimeter dengan
       * debit dua meter kubik tiap detik ia mencapai seratus empat puluh
       * tujuh meter. Membiarkan bidangnya memanjang sampai ke sana membuat
       * jalan setinggi dua setengah meter tinggal segaris dan seluruh
       * gambarnya tidak dapat dibaca, padahal justru keadaan itulah yang
       * ingin diperlihatkan.
       *
       * Aturannya sama dengan yang sudah dipakai pada lembar loncatan air:
       * skalanya dihitung dari bangunannya, dan angka yang keluar bidang
       * dinyatakan sebagai tulisan, bukan dipaksa masuk gambar.
       */
      const zPuncak = road + Math.max(D, 0.5) * 1.6;
      const hwGambar = Math.min(r.headwater, zPuncak);
      const hwDiLuar = r.headwater > zPuncak + 1e-9;

      // Timbunan jalan sebagai trapesium di atas gorong-gorong.
      const timbunan: { x: number; z: number }[] = [
        { x: -L * 0.05, z: zMasuk },
        { x: L * 0.18, z: road },
        { x: L * 0.82, z: road },
        { x: L * 1.05, z: zKeluar },
        { x: L * 1.05, z: zKeluar - D * 0.6 },
        { x: -L * 0.05, z: zMasuk - D * 0.6 },
      ];

      // Dinding gorong-gorong: dua pita sejajar mengikuti kemiringan dasar.
      const dasarMasuk = zMasuk;
      const dasarKeluar = zKeluar;
      const bawah: { x: number; z: number }[] = [
        { x: 0, z: dasarMasuk },
        { x: L, z: dasarKeluar },
        { x: L, z: dasarKeluar - tebal },
        { x: 0, z: dasarMasuk - tebal },
      ];
      const atas: { x: number; z: number }[] = [
        { x: 0, z: dasarMasuk + D },
        { x: L, z: dasarKeluar + D },
        { x: L, z: dasarKeluar + D + tebal },
        { x: 0, z: dasarMasuk + D + tebal },
      ];

      const spec: StructureSpec = {
        xMin: xKiri,
        xMax: xKanan,
        zMin: Math.min(zKeluar - D * 0.8, -D),
        zMax: Math.max(road, hwGambar) * 1.12,
        /*
         * Skala kedua sumbunya dibedakan, seperti lazimnya potongan
         * memanjang. Gorong-gorong boleh sepanjang dua ratus meter
         * sedangkan bangunannya setinggi beberapa meter saja, dan skala
         * yang sama di kedua sumbu meratakan seluruh gambar menjadi sepita
         * setebal beberapa puluh piksel. Bentuk timbunan bukan pokok lembar
         * ini; yang pokok letak muka air terhadap punggung pipa dan
         * permukaan jalan, dan itu justru terbaca lebih baik dengan sumbu
         * tegak yang dilebihkan.
         */
        equalScale: false,
        bodies: [
          { pts: timbunan },
          { pts: bawah, color: C.ink },
          { pts: atas, color: C.ink },
        ],
        waters: [
          {
            surface: [
              { x: xKiri, z: hwGambar },
              { x: 0, z: hwGambar * 0.98 },
            ],
            bed: [
              { x: 0, z: zMasuk - D * 0.6 },
              { x: xKiri, z: zMasuk - D * 0.6 },
            ],
            invalid: r.overtops,
          },
          {
            surface: [
              { x: L, z: zKeluar + tw },
              { x: xKanan, z: zKeluar + tw },
            ],
            bed: [
              { x: xKanan, z: zKeluar - D * 0.6 },
              { x: L, z: zKeluar - D * 0.6 },
            ],
          },
        ],
        lines: [
          /*
           * Kedua garis kendali hanya digambar bila masih masuk bidangnya.
           * Di luar bidang, garisnya sendiri tidak terlihat sedangkan
           * namanya tetap tertulis, dan namanya lalu menumpuk di pojok kiri
           * atas bersama kepala gambar, menyatakan sesuatu yang tidak ada
           * di mana-mana.
           */
          ...(r.inletHeadwater <= zPuncak
            ? ([
          {
            pts: [
              { x: xKiri, z: r.inletHeadwater },
              { x: L * 0.2, z: r.inletHeadwater },
            ],
            color: r.control === "masuk" ? C.critical : C.ink3,
            weight: r.control === "masuk" ? W.bold : W.hair,
            dash: DASH.hidden,
            /*
             * Kedua nama kendali dipisahkan MENDATAR, bukan hanya tegak.
             * Pada debit kecil kedua tinggi muka airnya hampir sama, jadi
             * kedua garisnya berimpit dan pemisahan tegak sepuluh piksel
             * tidak cukup: keduanya terbaca bertindihan.
             */
            label: T.inletControl,
            labelAt: 0.1,
            labelDy: -10,
            labelAlign: "left",
          },
            ] as StructureLine[])
            : []),
          ...(r.outletHeadwater <= zPuncak
            ? ([
          {
            pts: [
              { x: xKiri, z: r.outletHeadwater },
              { x: L * 0.2, z: r.outletHeadwater },
            ],
            color: r.control === "keluar" ? C.critical : C.ink3,
            weight: r.control === "keluar" ? W.bold : W.hair,
            dash: DASH.phantom,
            label: T.outletControl,
            /*
             * Ditumpuk di pangkal yang sama dengan nama kendali sisi masuk,
             * berjarak dua puluh empat piksel di bawahnya. Memisahkannya ke
             * ujung kanan garis memang berhasil pada gorong-gorong panjang,
             * tetapi pada gorong-gorong empat meter garisnya sendiri hanya
             * beberapa ratus piksel dan kedua nama itu justru bertemu di
             * tengah.
             */
            labelAt: 0.1,
            labelDy: 14,
            labelAlign: "left",
          },
            ] as StructureLine[])
            : []),
          {
            pts: [
              { x: L * 0.18, z: road },
              { x: L * 0.82, z: road },
            ],
            color: r.overtops ? C.signal : C.ink2,
            weight: W.thin,
            dash: DASH.axis,
            label: T.roadLevel,
            labelAt: 0.5,
            labelDy: -10,
          },
        ],
        dims: hwDiLuar
          ? []
          : [
              {
                axis: "v",
                at: xKiri * 0.22,
                from: zMasuk,
                to: r.headwater,
                text: `HW ${fmtPlain(r.headwater, 2)} m`,
                color: C.water,
              },
            ],
        callouts: [
          {
            x: L * 0.5,
            z: (dasarMasuk + dasarKeluar) / 2 + D / 2,
            dx: 0,
            dy: 34,
            text: T.barrelLabel,
          },
        ],
        arrows: [
          {
            x: L * 0.3,
            z: (dasarMasuk + dasarKeluar) / 2 + D * 0.45,
            length: 30,
            color: r.fishBarrier ? C.critical : C.water,
          },
        ],
        /*
         * Kepalanya menyebut yang benar-benar terjadi di sini. Sebelumnya
         * terpasang "titik operasi di luar diagram", yang milik lembar
         * berdiagram dan bukan milik gorong-gorong. Cacat berjenis sama
         * sudah terjadi sekali pada lembar bendung ogee pekan kedua.
         */
        heading: takMuat
          ? x.takMuat
          : r.inletBelowChart
            ? x.bawahBagan
            : r.overtops
            ? hwDiLuar
              ? `${x.limpas} · HW ${fmtPlain(r.headwater, 1)} m`
              : x.limpas
            : undefined,
        headingColor: C.signal,
        axisX: T.axHoriz,
        axisZ: T.axLevel,
      };

      drawStructure(ctx, w, ch, spec, lang);
    },
    [Q, D, L, S, n, tw, road, lang]
  );

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="HW/D"
          value={r.inletBelowChart ? NaN : r.hwRatio}
          scale="log"
          digits={2}
          invalid={r.overtops || takMuat || r.inletBelowChart}
          pesan={r.inletBelowChart ? x.bawahBagan : takMuat ? x.takMuat : undefined}
          bands={pitaHW(road / D, lang)}
        />
      }
      sheet="HS-04"
      subject={SUBJECTS.HS[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Dua hitungan yang berbeda sama sekali, dan yang berlaku adalah yang
            menuntut muka air lebih tinggi. Di bawah{" "}
            <Term tint={C.critical}>kendali sisi masuk</Term>, panjang pipanya
            tidak berpengaruh sedikit pun.
          </p>
        ) : (
          <p>
            Two entirely different calculations, and the one that governs is
            whichever demands the higher water level. Under{" "}
            <Term tint={C.critical}>inlet control</Term>, the length of the barrel
            does not matter at all.
          </p>
        )
      }
      drawing={
        <Sheet
          number="HS-04"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m, m³/s)" },
            { label: "HW", value: r.inletBelowChart ? "—" : `${fmt(r.headwater, 2)} m`, tint: r.overtops || r.inletBelowChart ? C.signal : C.water },
            { label: "HW/D", value: r.inletBelowChart ? "—" : fmt(r.hwRatio, 2), tint: r.hwRatio > CULVERT_HW_D_MAX && !r.overtops ? C.caution : undefined },
            { label: t.tbRegime, value: r.inletBelowChart ? "—" : controlName, tint: C.critical },
            { label: "V", value: `${fmt(r.velocity, 2)} m/s`, tint: r.fishBarrier ? C.critical : undefined },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
        </Sheet>
      }
      side={
        <>
          <Block heading={t.blkInput}>
            <InputTable>
              <InputRow symbol="Q" label={x.dQ} value={Q} min={0.05} max={30} step={0.05} digits={2} unit="m³/s" onChange={setQ} tint={C.water} />
              <InputRow symbol="D" label={x.dD} value={D} min={0.3} max={4} step={0.1} digits={1} unit="m" onChange={setD} />
              <InputRow symbol="L" label={x.dL} value={L} min={4} max={120} step={1} digits={0} unit="m" onChange={setL} />
              <InputRow symbol="S" label={x.dS} value={S * 1000} min={0.5} max={80} step={0.5} digits={1} unit="‰" onChange={(v) => setS(v / 1000)} />
              <InputRow symbol="n" label={x.dN} value={n} min={0.009} max={0.035} step={0.001} digits={3} onChange={setN} />
              <InputRow symbol="TW" label={x.dTw} value={tw} min={0} max={5} step={0.05} digits={2} unit="m" onChange={setTw} />
              <InputRow symbol="Hj" label={x.dRoad} value={road} min={0.5} max={12} step={0.1} digits={1} unit="m" onChange={setRoad} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  /* Dihitung ulang sesudah model kendali masuk HDS-5
                     (CACAT 2): tombol kendali keluar lama (Q 2, n 0,024)
                     memberi HW 3,14 m dan ikut melimpasi jalan 2,5 m.
                     Sekarang HW/D 1,331 (masuk) dan 1,332 (keluar), keduanya
                     di bawah jalan; n 0,013 pipa beton sesuai tetapan HDS-5
                     yang dipakai. */
                  { label: x.pMasuk, apply: () => { setQ(1.8); setD(1); setL(10); setS(0.05); setN(0.013); setTw(0.3); setRoad(2.5); } },
                  { label: x.pKeluar, apply: () => { setQ(1.5); setD(1); setL(80); setS(0.002); setN(0.013); setTw(0.9); setRoad(2.5); } },
                  { label: x.pBanjir, apply: () => { setQ(8); setD(1); setL(30); setS(0.01); setN(0.013); setTw(0.6); setRoad(2.5); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "HW", label: x.rHw, value: r.inletBelowChart ? "—" : fmt(r.headwater, 3), unit: r.inletBelowChart ? undefined : "m", tint: r.overtops || r.inletBelowChart ? C.signal : C.water, strong: true },
                { label: x.rControl, value: r.inletBelowChart ? "—" : controlName, tint: C.critical, strong: true },
                { symbol: "HWi", label: x.rHwMasuk, value: r.inletBelowChart ? "—" : fmt(r.inletHeadwater, 3), unit: r.inletBelowChart ? undefined : "m", tint: r.inletBelowChart ? C.signal : r.control === "masuk" ? C.critical : C.ink3 },
                { symbol: "HWo", label: x.rHwKeluar, value: hwoSah ? fmt(r.outletHeadwater, 3) : x.tidakKendali, unit: hwoSah ? "m" : undefined, tint: r.control === "keluar" ? C.critical : C.ink3 },
                { symbol: "HW/D", label: x.rHwD, value: r.inletBelowChart ? "—" : fmt(r.hwRatio, 3), tint: r.overtops ? C.signal : r.hwRatio > CULVERT_HW_D_MAX ? C.caution : undefined },
                { symbol: "V", label: x.rV, value: fmt(r.velocity, 3), unit: "m/s", tint: r.fishBarrier ? C.critical : undefined },
                { symbol: "dc", label: x.rDc, value: fmt(r.criticalDepth, 3), unit: "m", tint: C.critical },
                { symbol: "f", label: x.rJagaan, value: r.inletBelowChart ? "—" : fmt(road - r.headwater, 3), unit: r.inletBelowChart ? undefined : "m", tint: r.overtops ? C.signal : undefined },
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hV,
                    rumus: (<><span>A =</span><Frac num="π D²" den="4" /><span className="ml-3">V =</span><Frac num="Q" den="A" /></>),
                    isi: `A = π · ${fmt(D, 1)}² / 4 = ${fmt(A, 4)} m²; ${fmt(Q, 2)} / ${fmt(A, 4)}`,
                    hasil: fmt(r.velocity, 3),
                    satuan: "m/s",
                    tint: C.water,
                  },
                  {
                    judul: x.hDc,
                    rumus: (<><span>A(dc)³ / T(dc) = Q² / g</span><span className="ml-3">Hc = dc +</span><Frac num="Vc²" den="2g" /></>),
                    isi: `dc = ${fmt(r.criticalDepth, 4)} m; Hc = ${fmt(r.criticalDepth, 4)} + ${fmt(r.criticalHead - r.criticalDepth, 4)}`,
                    hasil: fmt(r.criticalHead, 3),
                    satuan: "m",
                    tint: C.critical,
                  },
                  {
                    judul: x.hX,
                    rumus: (<><span>X =</span><Frac num={`${fmt(HDS5_KU, 3)} · Q`} den="A · √D" /></>),
                    isi: `${fmt(HDS5_KU, 3)} · ${fmt(Q, 2)} / ( ${fmt(A, 4)} · √${fmt(D, 1)} ) ; ${bentuk}`,
                    hasil: fmt(r.inletParameter, 3),
                  },
                  {
                    judul: x.hHwi,
                    rumus:
                      r.inletForm === "tak-terendam" ? (
                        <span>HWi = D · ( Hc/D + {fmt(HDS5_K, 4)} · X² {fmt(HDS5_KS, 1)} · S )</span>
                      ) : r.inletForm === "terendam" ? (
                        <span>HWi = D · ( {fmt(HDS5_C, 4)} · X² + {fmt(HDS5_Y, 2)} {fmt(HDS5_KS, 1)} · S )</span>
                      ) : (
                        <span>HWi = D · ( ( 1 − f ) · A.1 + f · A.3 ), f = ( X − {fmt(HDS5_X_UNSUB, 1)} ) / ( {fmt(HDS5_X_SUB, 1)} − {fmt(HDS5_X_UNSUB, 1)} )</span>
                      ),
                    isi:
                      r.inletForm === "tak-terendam"
                        ? `${fmt(D, 1)} · ( ${fmt(r.criticalHead, 4)} / ${fmt(D, 1)} + ${fmt(HDS5_K, 4)} · ${fmt(r.inletParameter, 4)}² ${fmt(HDS5_KS, 1)} · ${fmt(S, 4)} )`
                        : r.inletForm === "terendam"
                          ? `${fmt(D, 1)} · ( ${fmt(HDS5_C, 4)} · ${fmt(r.inletParameter, 4)}² + ${fmt(HDS5_Y, 2)} ${fmt(HDS5_KS, 1)} · ${fmt(S, 4)} )`
                          : `f = ${fmt((r.inletParameter - HDS5_X_UNSUB) / (HDS5_X_SUB - HDS5_X_UNSUB), 4)}`,
                    hasil: r.inletBelowChart ? "—" : fmt(r.inletHeadwater, 3),
                    satuan: r.inletBelowChart ? undefined : "m",
                    tint: r.inletBelowChart ? C.signal : C.critical,
                  },
                  {
                    judul: x.hH,
                    rumus: (
                      <>
                        <span>H = ( Ke +</span>
                        <Frac num="2 g n² L" den="R^(4/3)" />
                        <span>+ 1 )</span>
                        <Frac num="V²" den="2g" />
                        <span className="ml-3">ho = maks( TW ; ( dc + D ) / 2 )</span>
                      </>
                    ),
                    isi: `Ke = ${fmt(0.5, 1)}, R = D/4 = ${fmt(D / 4, 4)} m; H = ${fmt(hLoss, 4)} m; ho = maks( ${fmt(tw, 2)} ; ( ${fmt(r.criticalDepth, 4)} + ${fmt(D, 1)} ) / 2 )`,
                    hasil: `ho = ${fmt(ho, 3)}`,
                    satuan: "m",
                    tint: C.energy,
                  },
                  {
                    judul: x.hHwo,
                    rumus: <span>HWo = ho + H − S · L</span>,
                    isi: `${fmt(ho, 4)} + ${fmt(hLoss, 4)} − ${fmt(S, 4)} · ${fmt(L, 0)}`,
                    hasil: hwoSah ? fmt(r.outletHeadwater, 3) : `${fmt(r.outletHeadwater, 3)} < 0 → ${x.tidakKendali}`,
                    satuan: hwoSah ? "m" : undefined,
                    tint: C.critical,
                  },
                  {
                    judul: x.hHw,
                    rumus: <span>HW = maks( HWi ; HWo )</span>,
                    isi: r.inletBelowChart
                      ? x.sBawahBagan
                      : `maks( ${fmt(r.inletHeadwater, 3)} ; ${hwoSah ? fmt(r.outletHeadwater, 3) : "—"} ) → ${controlName.toLowerCase()}`,
                    hasil: r.inletBelowChart ? "—" : fmt(r.headwater, 3),
                    satuan: r.inletBelowChart ? undefined : "m",
                    tint: C.water,
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard {...keadaan} />
        </>
      }
      verification={<Verification checks={checksCulvert(Q, D, L, S, n, tw, road)} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span>HW = max ( HWmasuk , HWkeluar )</span>
                <span className="ml-4 text-ink-3">
                  {lang === "id"
                    ? "dikerjakan keduanya, bukan dipilih"
                    : "both are computed, neither is chosen"}
                </span>
              </Eq>
              <Eq>
                <span>HWkeluar = ho + H − S L</span>
                <span className="ml-4">H =</span>
                <span className="ml-1">(</span>
                <span>Ke +</span>
                <Frac num="2 g n² L" den="R^(4/3)" />
                <span>+ 1</span>
                <span>)</span>
                <Frac num="V²" den="2g" />
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "HWmasuk tidak memuat L maupun n sama sekali"
                    : "HWmasuk contains neither L nor n at all"}
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
 * Pita HW/D dari batas culvert: 1,2 D (flowsFull, mulut terendam, HDS-5),
 * CULVERT_HW_D_MAX 1,5 (batas rancangan yang lazim dipakai instansi, bukan
 * HDS-5 sendiri) dan Hj/D (overtops). Batas yang jatuh di atas Hj/D
 * dipotong, jadi pita caution hilang bila jalannya lebih rendah dari 1,5 D.
 */
function pitaHW(hjD: number, lang: Lang): RegimeBand[] {
  const x = TXT[lang];
  const lo = 0.05;
  const hi = 100;
  const hj = Math.min(Math.max(hjD, lo * 1.001), hi * 0.999);
  const dasar: RegimeBand[] = [
    { from: lo, to: 1.2, label: x.bTakTerendam, tone: "water" },
    { from: 1.2, to: CULVERT_HW_D_MAX, label: x.bTerendam, tone: "neutral" },
    { from: CULVERT_HW_D_MAX, to: hi, label: x.bAtasBatas, tone: "caution" },
  ];
  const pita: RegimeBand[] = [];
  for (const b of dasar) {
    if (b.from >= hj) break;
    pita.push({ ...b, to: Math.min(b.to, hj) });
  }
  pita.push({ from: hj, to: hi, label: x.bLimpas, tone: "invalid" });
  return pita;
}

function bacaKeadaan(
  m: { Q: number; D: number; L: number; S: number; n: number; tw: number; road: number },
  r: ReturnType<typeof culvert>,
  takMuat: boolean,
  hwoSah: boolean,
  bentuk: string,
  lang: Lang
): { tone: Tone; badge: string; state: string; notice: string[] } {
  const x = TXT[lang];
  const controlName = r.control === "masuk" ? x.cMasuk : x.cKeluar;
  const ikan = r.fishBarrier ? [x.penghalangNote] : [];
  const sebagian = !r.flowsFull ? [x.tidakPenuhNote] : [];
  const hwoNote = !hwoSah ? [x.hwoNegatif] : [];
  const bentukNote = x.bentukMasuk(fmt(r.inletParameter, 2), bentuk);

  if (takMuat)
    return {
      tone: "invalid",
      badge: x.takMuat,
      state: x.sTakMuat(fmt(m.D, 1), fmt(m.road, 1)),
      notice: [x.takMuatNote],
    };
  if (r.inletBelowChart)
    return {
      tone: "invalid",
      badge: x.bawahBagan,
      state: x.sBawahBagan,
      notice: [x.bawahBaganNote(fmt(r.inletHeadwater, 3), fmt(r.criticalDepth, 3)), ...hwoNote],
    };
  if (r.overtops)
    return {
      tone: "invalid",
      badge: x.limpas,
      state: x.sLimpas(fmt(r.headwater, 3), fmt(m.road, 1)),
      notice: [x.limpasNote, ...ikan],
    };

  /* Kalimat lipat dua panjang (CACAT 3) dibangun dari tanda perubahan
     yang benar-benar dihitung: pada dasar curam HWo justru turun. */
  const panjang = culvert(m.Q, m.D, m.L * 2, m.S, m.n, m.tw, m.road);
  const bedaKeluar = panjang.outletHeadwater - r.outletHeadwater;
  const bedaHW = panjang.headwater - r.headwater;
  const l1 = fmt(m.L, 0);
  const l2 = fmt(m.L * 2, 0);
  const lipat =
    bedaHW > 5e-4
      ? x.panjangNaik(l1, l2, fmt(bedaKeluar, 3), fmt(bedaHW, 3))
      : bedaHW < -5e-4
        ? x.panjangTurun(l1, l2, fmt(bedaKeluar, 3), fmt(-bedaHW, 3))
        : x.panjangTetap(l1, l2, fmt(bedaKeluar, 3));

  const atas = r.hwRatio > CULVERT_HW_D_MAX;
  return {
    tone: atas ? "caution" : r.hwRatio >= 1.2 ? "neutral" : "water",
    badge: controlName,
    state: x.sKendali(controlName, fmt(r.headwater, 3), fmt(r.hwRatio, 3), fmt(m.road - r.headwater, 3)),
    notice: [
      ...(atas ? [x.atasBatasNote(fmt(r.hwRatio, 3))] : []),
      bentukNote,
      lipat,
      ...hwoNote,
      ...sebagian,
      ...ikan,
    ],
  };
}
