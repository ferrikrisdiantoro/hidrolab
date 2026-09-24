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
  drawStructure,
  type StructureLine,
  type StructureSpec,
} from "@/lib/drawStructure";
import {
  CULVERT_FISH_VELOCITY,
  CULVERT_HW_D_MAX,
  culvert,
  fmt,
  fmtPlain,
} from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
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
    dD: "Garis tengah gorong-gorong",
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
      "Garis tengah gorong-gorongnya menyisakan kurang dari tiga ratus milimeter timbunan antara punggungnya dan permukaan jalan, jadi ia tidak dapat ditanam di situ sama sekali. Pipa yang timbunannya terlalu tipis hancur oleh beban roda, bukan oleh tanah di atasnya, karena timbunan itulah yang menyebarkan beban roda sebelum sampai ke punggung pipa; di bawah kira-kira sepertiga meter, bebannya sampai hampir utuh. Artinya pada perancangan: gorong-gorong tidak dapat begitu saja diperbesar sampai muka air hulunya cukup rendah. Melewati titik ini pilihannya menaikkan jalan, memakai beberapa pipa kecil berdampingan, atau berpindah ke gorong-gorong kotak yang atapnya datar sehingga bebannya ditahan sebagai lenturan dan bukan sebagai tekan cincin.",
    limpasNote:
      "Tinggi muka air hulu yang dibutuhkan melampaui tinggi timbunan jalan, artinya air melimpah di atas jalan dan sebagian debit lewat di sana alih-alih lewat gorong-gorong. Hitungan di lembar ini tidak berlaku sejak titik itu karena seluruhnya mengandaikan seluruh debit lewat pipanya. Yang lebih penting untuk perancangan: jalan yang dilimpasi tidak sekadar terputus, badan jalannya tergerus dari sisi hilir dan dapat runtuh dalam hitungan jam. Perbesar gorong-gorongnya, tambah jumlahnya, atau tinggikan jalannya.",
    penghalang: "Penghalang bagi ikan",
    penghalangNote:
      "Kecepatan di dalam gorong-gorong melampaui 1,2 meter per detik, batas yang lazim dipakai sebagai syarat lintasan ikan pada sungai kecil. Gorong-gorong yang terlalu cepat memutus sungai menjadi dua bagi ikan yang harus naik untuk memijah, dan akibatnya tidak terlihat sampai bertahun-tahun kemudian ketika bagian hulu kehilangan jenis ikannya. Perbesar garis tengahnya, landaikan dasarnya, atau tanam dasarnya di bawah dasar sungai sehingga terisi sedimen dan kekasarannya menjadi kekasaran sungai.",
    tidakPenuh: "Pipa mengalir sebagian",
    tidakPenuhNote:
      "Debitnya belum cukup untuk mengisi penuh pipanya. Hitungan kendali sisi keluar di lembar ini memakai kecepatan pipa penuh dan mengandaikan muka air di ujung keluar setengah tinggi pipa, dan keduanya tidak berlaku pada aliran sebagian. Angka kendali sisi keluarnya karena itu taksiran kasar yang cenderung terlalu besar, dan HDS-5 sendiri menyatakan caranya hanya pendekatan di daerah ini. Angka kendali sisi masuk tetap berlaku.",
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
      "The discharge is not yet enough to fill the barrel. The outlet-control calculation on this sheet uses the full-pipe velocity and assumes the outlet water level sits at half the barrel height, and neither holds in part-full flow. The outlet-control figure is therefore a rough estimate that tends to run high, and HDS-5 itself states that the method is only approximate in this region. The inlet-control figure still holds.",
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

  const [Q, setQ] = useState(2);
  const [D, setD] = useState(1);
  const [L, setL] = useState(20);
  const [S, setS] = useState(0.02);
  const [n, setN] = useState(0.013);
  const [tw, setTw] = useState(0.4);
  const [road, setRoad] = useState(2.5);

  const r = culvert(Q, D, L, S, n, tw, road);
  const controlName = r.control === "masuk" ? x.cMasuk : x.cKeluar;
  /*
   * Dua penggeser yang terikat satu sama lain: garis tengah pipanya dan
   * tinggi timbunan jalannya. Gorong-gorong yang lebih tinggi daripada
   * timbunan di atasnya tidak dapat ditanam, dan gambarnya memang
   * memperlihatkan pipa yang menonjol di atas jalan. Yang kurang sebelumnya
   * hanya keterangan bahwa itu memang tidak boleh.
   */
  const timbunanMinimum = 0.3;
  const takMuat = D + timbunanMinimum > road;

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
       * yang terlalu kecil: pada garis tengah tiga puluh sentimeter dengan
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
      sheet="HS-04"
      subject={SUBJECTS.HS[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Dua hitungan yang berbeda sama sekali, dan yang berlaku adalah yang
            menuntut muka air lebih tinggi. Di bawah{" "}
            <Term tint={C.signal}>kendali sisi masuk</Term>, panjang pipanya
            tidak berpengaruh sedikit pun.
          </p>
        ) : (
          <p>
            Two entirely different calculations, and the one that governs is
            whichever demands the higher water level. Under{" "}
            <Term tint={C.signal}>inlet control</Term>, the length of the barrel
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
            { label: "HW", value: `${fmt(r.headwater, 2)} m`, tint: r.overtops ? C.signal : C.water },
            { label: "HW/D", value: fmt(r.hwRatio, 2) },
            { label: "—", value: controlName, tint: C.signal },
            { label: "V", value: `${fmt(r.velocity, 2)} m/s`, tint: r.fishBarrier ? C.signal : undefined },
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
              <InputRow symbol="Hj" label={x.dRoad} value={road} min={0.5} max={12} step={0.1} digits={1} unit="m" onChange={setRoad} tint={C.signal} />
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pMasuk, apply: () => { setQ(2); setD(1); setL(10); setS(0.05); setN(0.013); setTw(0.3); setRoad(2.5); } },
                  { label: x.pKeluar, apply: () => { setQ(2); setD(1); setL(80); setS(0.002); setN(0.024); setTw(0.9); setRoad(2.5); } },
                  { label: x.pBanjir, apply: () => { setQ(8); setD(1); setL(30); setS(0.01); setN(0.013); setTw(0.6); setRoad(2.5); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Flag tint={C.critical}>{controlName}</Flag>
              {takMuat && <Flag alert>{x.takMuat}</Flag>}
              {r.overtops && <Flag alert>{x.limpas}</Flag>}
              {r.fishBarrier && <Flag tint={C.critical}>{x.penghalang}</Flag>}
              {!r.flowsFull && <Flag tint={C.critical}>{x.tidakPenuh}</Flag>}
            </div>
            {takMuat && (
              <div className="mb-2.5">
                <Note>{x.takMuatNote}</Note>
              </div>
            )}
            {r.overtops && (
              <div className="mb-2.5">
                <Note>{x.limpasNote}</Note>
              </div>
            )}
            {!r.flowsFull && (
              <div className="mb-2.5">
                <Note>{x.tidakPenuhNote}</Note>
              </div>
            )}
            {r.fishBarrier && (
              <div className="mb-2.5">
                <Note>{x.penghalangNote}</Note>
              </div>
            )}
            <ResultTable
              rows={[
                { symbol: "HW", label: x.rHw, value: fmt(r.headwater, 3), unit: "m", tint: r.overtops ? C.signal : C.water, strong: true },
                { symbol: "—", label: x.rControl, value: controlName, strong: true },
                { symbol: "HWi", label: x.rHwMasuk, value: fmt(r.inletHeadwater, 3), unit: "m", tint: r.control === "masuk" ? C.critical : C.ink3 },
                { symbol: "HWo", label: x.rHwKeluar, value: fmt(r.outletHeadwater, 3), unit: "m", tint: r.control === "keluar" ? C.critical : C.ink3 },
                { symbol: "HW/D", label: x.rHwD, value: fmt(r.hwRatio, 3), tint: r.hwRatio > CULVERT_HW_D_MAX ? C.signal : undefined },
                { symbol: "V", label: x.rV, value: fmt(r.velocity, 3), unit: "m/s", tint: r.fishBarrier ? C.critical : undefined },
                { symbol: "f", label: x.rJagaan, value: fmt(road - r.headwater, 3), unit: "m", tint: r.overtops ? C.signal : undefined },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(Q, D, L, S, n, tw, road, r.control, lang)}</Note>
          </Block>
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

function notice(
  Q: number,
  D: number,
  L: number,
  S: number,
  n: number,
  tw: number,
  road: number,
  control: "masuk" | "keluar",
  lang: Lang
): string {
  const panjang = culvert(Q, D, L * 2, S, n, tw, road);
  const asli = culvert(Q, D, L, S, n, tw, road);
  const bedaMasuk = panjang.inletHeadwater - asli.inletHeadwater;
  const bedaKeluar = panjang.outletHeadwater - asli.outletHeadwater;

  if (lang === "en")
    return `Double the length, from ${fmtPlain(L, 0)} to ${fmtPlain(L * 2, 0)} m, and the inlet-control figure changes by ${fmt(bedaMasuk, 4)} m while the outlet-control figure changes by ${fmt(bedaKeluar, 3)} m. One of those numbers is exactly zero and always will be, because the inlet does not know how long the barrel behind it is. Right now the ${control === "masuk" ? "inlet" : "outlet"} governs, so doubling the length ${control === "masuk" ? "buys nothing and costs nothing" : "raises the headwater and may be the cheapest thing to avoid"}.`;
  return `Lipatduakan panjangnya, dari ${fmtPlain(L, 0)} ke ${fmtPlain(L * 2, 0)} m, dan angka kendali sisi masuk berubah ${fmt(bedaMasuk, 4)} m sedangkan angka kendali sisi keluar berubah ${fmt(bedaKeluar, 3)} m. Salah satu angka itu tepat nol dan akan selalu nol, karena mulut gorong-gorong tidak tahu berapa panjang pipa di belakangnya. Sekarang yang mengendalikan sisi ${control === "masuk" ? "masuk" : "keluar"}, jadi melipatduakan panjangnya ${control === "masuk" ? "tidak membeli apa pun dan tidak memakan apa pun" : "menaikkan muka air hulunya dan mungkin hal termurah yang perlu dihindari"}.`;
}
