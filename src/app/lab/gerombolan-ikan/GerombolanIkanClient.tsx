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
import { usePlate, usePutar } from "@/lib/usePlate";
import type { ParamDef } from "@/lib/rentang";
import { drawField, type FieldBody, type FieldLine } from "@/lib/drawField";
import {
  SHOAL_OBSTACLE_MAX,
  createShoalMotion,
  drawShoalMotion,
  drawShoalStill,
  shoalScene,
} from "@/lib/swarmMotion";
import { fmt, shoal } from "@/lib/hydraulics";
import { C, DASH, W, type Tone } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksShoal } from "@/lib/checks";
import { evaluate } from "@/lib/verify";

const NAMA = {
  id: {
    berpencar: "Berpencar",
    bergerombol: "Bergerombol",
    berputar: "Berputar",
    searah: "Searah",
  },
  en: {
    berpencar: "Scattered",
    bergerombol: "Swarming",
    berputar: "Milling",
    searah: "Polarised",
  },
} as const;

const TXT = {
  id: {
    title: "Gerombolan ikan",
    sheetTitle: "Tiga aturan tetangga terdekat, dilihat dari atas",
    dN: "Banyaknya ikan",
    dA: "Bobot penyamaan arah",
    dS: "Bobot menjauh bila terlalu rapat",
    dC: "Bobot mendekat bila terlalu renggang",
    pPencar: "Tanpa aturan sama sekali",
    pGerombol: "Bergerombol tanpa arah bersama",
    pSearah: "Seluruhnya searah, seperti ikan bermigrasi",
    pPutar: "Berputar mengelilingi pusat kosong",
    rPol: "Keteraturan arah",
    rMil: "Keteraturan putar terhadap pusat",
    rJarak: "Jarak rata-rata ke tetangga terdekat",
    rSebar: "Jari-jari gerombolan",
    rDesak: "Ikan yang punya tetangga di dalam zona menjauh",
    bTak: "Tak searah",
    bSearah: "Searah",
    hZona: "Lebar tiga zona",
    hP: "Keteraturan arah",
    hM: "Keteraturan putar",
    hR: "Jari-jari dan jarak tetangga",
    hGol: "Penggolongan bentuk",
    rerata: "rerata dari",
    dR: "Jari-jari rintangan",
    keluar: "ada ikan keluar bidang",
    tambah: "Tambah rintangan",
    gObs: (k: number) => `Posisi rintangan ${k}`,
    hapusSemua: "Hapus semua rintangan",
    rObsN: "Banyaknya rintangan",
    taruhPetunjuk: (n: number) =>
      `Klik di gambar untuk menaruh rintangan (paling banyak ${n}); seret untuk memindah, tombol Delete untuk menghapus. Ikan dibelokkan menjauhinya menurut aturan Reynolds (1999), tetapi aturan Reynolds hanya membelokkan dengan laju belok terbatas; rintangan besar atau yang ditaruh di atas gerombolan bisa ditembus. Ikan yang sedang di dalam rintangan digambar merah. Predator tidak dimodelkan: belum ada sumber jarak lari dan tanggapan ikan terhadap predator yang bisa dirujuk.`,
    nObs: (n: number, awal: number, masuk: number, terdekat: string) =>
      `Dengan ${n} rintangan, gambar, kop, dan tabel hasil berasal dari simulasi yang sama dengan rintangannya. Kalimat pembanding di bawah dan blok verifikasi dihitung tanpa rintangan.${
        awal + masuk > 0
          ? ` Rintangan pejal ditembus: ${awal} ikan sudah di dalamnya pada langkah 0 dan ${masuk} ikan masuk kemudian${masuk > 0 ? ` (paling dalam sampai ${terdekat} r dari pusat)` : ""}. Aturan Reynolds hanya membelokkan dengan laju belok terbatas; rintangan besar atau yang ditaruh di atas gerombolan bisa ditembus. Ikan yang sedang di dalam rintangan digambar merah: di situ modelnya di luar rentang berlaku.`
          : " Tidak ada ikan yang masuk ke dalam rintangan selama 300 langkah."
      }`,
    obsLuar: (k: number) => `${k} rintangan di luar bingkai`,
    clock: "t = ",
    clockStep: (k: number) => ` s, langkah ${k} dari 300`,
    motionNote:
      "diputar ulang dari langkah 0 sampai 300 (90 s), waktu dipercepat ×3. Garis tipis di belakang ikan = jejak ekor 3 m terakhir",
    ekor: "ekor",
    desakCek:
      "Blok verifikasi di bawah gagal pada cek \u201cKeteraturan arahnya naik bersama bobot penyamaan arah\u201d. Sebabnya gerombolan berdesakan: pada bobot penyamaan arah 2,5 yang dipakai cek itu, {pct} % ikan punya tetangga lebih dekat dari zona menjauh ({zr} m). Aturan berprioritas Couzin dkk. (2002) membuat ikan itu hanya menjauh dan tidak menyamakan arah, jadi keteraturannya tidak naik. Simulasinya tidak diubah; cek dan modelnya masih menunggu keputusan.",
    note:
      "Tidak ada satu pun ikan pada lembar ini yang tahu bentuk gerombolannya. Masing-masing hanya melihat beberapa tetangga terdekatnya dan menjalankan tiga aturan sederhana: jangan menabrak, ikuti arah mereka, dan jangan tertinggal. Dari tiga aturan itu, tanpa satu pun pemimpin dan tanpa satu pun rencana, muncul bentuk-bentuk yang seluruhnya punya nama dalam pustaka perikanan. Yang paling pantas diperhatikan bukan bahwa bentuknya muncul melainkan bahwa perpindahan antar bentuknya mendadak. Naikkan bobot penyamaan arah sedikit demi sedikit dan gerombolannya berpindah antar bentuk secara mendadak, tidak selalu berurutan: dari bergerombol ke berputar, kembali bergerombol, dan baru pada bobot yang cukup besar menjadi satu barisan yang seluruhnya searah. Di tengah jalan bahkan ada pita sempit yang sudah searah lalu hilang lagi. Bagi rekayasa sungai, dua hal mengikuti. Pertama, ikan yang bergerombol memasuki lintasan ikan sebagai satu kesatuan, bukan satu per satu, jadi lintasan yang lebarnya dirancang dari satu ekor akan menyumbat. Kedua, gangguan yang memecah gerombolan, misalnya cahaya, suara, atau arus yang berganti mendadak, dapat menghilangkan perilaku bergerombolnya sama sekali meskipun tidak satu ikan pun terluka.",
  },
  en: {
    title: "Fish schooling",
    sheetTitle: "Three nearest-neighbour rules, seen from above",
    dN: "Number of fish",
    dA: "Weight of alignment",
    dS: "Weight of separation when too close",
    dC: "Weight of cohesion when too far apart",
    pPencar: "No rules at all",
    pGerombol: "Swarming without a common heading",
    pSearah: "All heading one way, as in migration",
    pPutar: "Milling around an empty centre",
    rPol: "Order of heading",
    rMil: "Order of rotation about the centre",
    rJarak: "Mean distance to the nearest neighbour",
    rSebar: "Radius of the group",
    rDesak: "Fish with a neighbour inside the separation zone",
    bTak: "Not polarised",
    bSearah: "Polarised",
    hZona: "Width of the three zones",
    hP: "Order of heading",
    hM: "Order of rotation",
    hR: "Radius and neighbour distance",
    hGol: "Classifying the shape",
    rerata: "mean over",
    dR: "Obstacle radius",
    keluar: "some fish leave the plot",
    tambah: "Add obstacle",
    gObs: (k: number) => `Position of obstacle ${k}`,
    hapusSemua: "Remove all obstacles",
    rObsN: "Number of obstacles",
    taruhPetunjuk: (n: number) =>
      `Click the drawing to place an obstacle (at most ${n}); drag to move it, Delete to remove it. The fish are steered away from it by the rule of Reynolds (1999), but that rule only steers with a limited turning rate; a large obstacle or one placed on top of the school can be passed through. Fish currently inside an obstacle are drawn red. Predators are not modelled: there is no source yet for the flight distance and the response of fish to a predator that could be cited.`,
    nObs: (n: number, awal: number, masuk: number, terdekat: string) =>
      `With ${n} obstacles, the drawing, the title block, and the result table come from the same simulation with the obstacles. The comparison sentences below and the verification block are computed without obstacles.${
        awal + masuk > 0
          ? ` The solid obstacles are passed through: ${awal} fish are already inside at step 0 and ${masuk} enter later${masuk > 0 ? ` (deepest to ${terdekat} r from the centre)` : ""}. The Reynolds rule only steers with a limited turning rate; a large obstacle or one placed on top of the school can be passed through. Fish currently inside an obstacle are drawn red: there the model is outside its valid range.`
          : " No fish enters an obstacle during the 300 steps."
      }`,
    obsLuar: (k: number) => `${k} ${k === 1 ? "obstacle" : "obstacles"} outside the frame`,
    clock: "t = ",
    clockStep: (k: number) => ` s, step ${k} of 300`,
    motionNote:
      "replayed from step 0 to 300 (90 s), time sped up ×3. The thin line behind each fish = its tail trail over the last 3 m",
    ekor: "fish",
    desakCek:
      "The verification block below fails the check \u201cPolarisation rises with the alignment weight\u201d. The cause is crowding: at the alignment weight of 2.5 that check uses, {pct} % of the fish have a neighbour closer than the separation zone ({zr} m). The prioritised rules of Couzin et al. (2002) make those fish only move apart and not align, so the order does not rise. The simulation has not been changed; the check and the model still await a decision.",
    note:
      "Not one fish on this sheet knows the shape of its own school. Each sees only a few nearest neighbours and runs three simple rules: do not collide, follow their heading, do not fall behind. Out of those three rules, with no leader and no plan, come shapes that all have names in the fisheries literature. What deserves attention is not that the shapes appear but that the changes between them are abrupt. Raise the alignment weight little by little and the group jumps between shapes abruptly, not always in order: from swarming to milling, back to swarming, and only at a large enough weight into a single polarised column. Along the way there is even a narrow band that is already polarised and then disappears again. Two things follow for river engineering. First, schooling fish enter a fish pass as one body rather than one at a time, so a pass whose width was designed from a single fish will block. Second, a disturbance that breaks the school, light, sound, or a suddenly changing current, can remove the schooling behaviour altogether although not one fish is hurt.",
  },
} as const;

/* Rentang yang SAMA untuk pegangan dan penaruh rintangan. */
const P_POS: ParamDef = { min: -150, max: 150, step: 0.1, digits: 1 };
/** Pengali waktu lapis gerak: 300 langkah × 0,3 s = 90 s fisik dalam 30 s layar. */
const WAKTU = 3;

const REFS = {
  id: [
    "Reynolds, C.W. (1987). Flocks, herds and schools: a distributed behavioral model. SIGGRAPH Comput. Graph. 21, 25–34.",
    "Couzin, I.D. dkk. (2002). Collective memory and spatial sorting in animal groups. J. Theor. Biol. 218, 1–11.",
    "Partridge, B.L. (1982). The structure and function of fish schools. Sci. Am. 246, 114–123.",
    "Vicsek, T. dkk. (1995). Novel type of phase transition in a system of self-driven particles. Phys. Rev. Lett. 75, 1226–1229.",
  ],
  en: [
    "Reynolds, C.W. (1987). Flocks, herds and schools: a distributed behavioral model. SIGGRAPH Comput. Graph. 21, 25–34.",
    "Couzin, I.D. et al. (2002). Collective memory and spatial sorting in animal groups. J. Theor. Biol. 218, 1–11.",
    "Partridge, B.L. (1982). The structure and function of fish schools. Sci. Am. 246, 114–123.",
    "Vicsek, T. et al. (1995). Novel type of phase transition in a system of self-driven particles. Phys. Rev. Lett. 75, 1226–1229.",
  ],
} as const;

export function GerombolanIkanClient() {
  const { lang } = useLang();
  const t = str(lang);
  const x = TXT[lang];
  const T = cl(lang);

  const [jumlah, setJumlah] = useState(40);
  const [selaras, setSelaras] = useState(1);
  const [jauh, setJauh] = useState(1);
  const [dekat, setDekat] = useState(0.5);
  /* Rintangan dari klik/seret; jari-jari bersama dari satu penggeser. */
  const [rintangan, setRintangan] = useState<{ x: number; y: number }[]>([]);
  const [rObs, setRObs] = useState(1.5);
  const sentuh = useRef<() => void>(() => {});
  const { playing, toggle: togglePutar } = usePutar();

  const obs = useMemo(
    () => rintangan.map((p) => ({ x: p.x, y: p.y, r: rObs })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rintangan.map((p) => `${p.x},${p.y}`).join(";"), rObs]
  );
  const kunciObs = obs.map((o) => `${o.x},${o.y},${o.r}`).join(";");

  /* Simulasinya n² tiap langkah dan dijalankan sebelas kali per keadaan
     (gambar, catatan, blok verifikasi), jadi hanya dihitung ulang bila
     masukannya berubah, tidak pada setiap render seperti ganti bahasa.
     Tanpa rintangan shoalScene = shoal() (M5, identik bit demi bit). */
  const r = useMemo(
    () => shoalScene(jumlah, selaras, jauh, dekat, obs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jumlah, selaras, jauh, dekat, kunciObs]
  );
  const gerak = useMemo(
    () => createShoalMotion(jumlah, selaras, jauh, dekat, obs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jumlah, selaras, jauh, dekat, kunciObs]
  );
  const cek = useMemo(
    () => checksShoal(jumlah, selaras, jauh, dekat),
    [jumlah, selaras, jauh, dekat]
  );
  const nama = NAMA[lang][r.state];
  /* Lebar zona sama persis dengan shoal (hydraulics.ts, zonaJauh, zonaSearah,
     zonaTarik); ditulis ulang hanya untuk baris Hitungan dan penanda
     berdesakan. */
  const zr = 0.4 + 0.4 * Math.max(0, jauh);
  const zo = selaras * 5;
  const za = dekat * 14;
  /* Cek "keteraturan naik bersama bobot" membandingkan a 0 dengan a 2,5.
     Bila gagal, sebabnya dicari pada setelan a 2,5 itu: bagian ikan yang
     berdesakan di dalam zona menjauh. Simulasinya tidak diubah. */
  const cekGagal = useMemo(
    () =>
      cek.some(
        (c) => c.label.id.startsWith("Keteraturan arahnya naik") && !evaluate(c).pass
      ),
    [cek]
  );
  const desakCek = useMemo(
    () => (cekGagal ? berdesakan(shoal(jumlah, 2.5, jauh, dekat), zr) : 0),
    [cekGagal, jumlah, jauh, dekat, zr]
  );
  const desakKini = berdesakan(r, zr);
  const nada: Tone = r.state === "searah" ? "water" : r.state === "berputar" ? "critical" : r.state === "bergerombol" ? "energy" : "neutral";
  const warna =
    r.state === "searah"
      ? C.water
      : r.state === "berputar"
        ? C.critical
        : r.state === "bergerombol"
          ? C.energy
          : C.ink2;

  /* Bidang gambar ditentukan hanya oleh penggeser: kotak seluruh 300
     langkah gerombolan TANPA rintangan (bukan hanya keadaan akhir, supaya
     ikan di lapis gerak tidak keluar bingkai). Menaruh, menyeret, atau
     menghapus rintangan tidak mengubah skala, jadi rintangan tetap di
     tempat klik. Ikan yang dibelokkan rintangan keluar kotak itu dipotong
     bingkai dan diberi penanda. */
  const adaObs = obs.length > 0;
  const r0 = useMemo(
    () => (adaObs ? shoalScene(jumlah, selaras, jauh, dekat) : r),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jumlah, selaras, jauh, dekat, adaObs, adaObs ? null : r]
  );
  const bidangBaru = useMemo(() => {
    const margin = Math.max(r0.nearestNeighbour * 2, 2 * zr, 1);
    return {
      xMin: r0.xMin - margin,
      xMax: r0.xMax + margin,
      yMin: r0.yMin - margin,
      yMax: r0.yMax + margin + (r0.yMax - r0.yMin + 2 * margin) * 0.14,
    };
  }, [r0, zr]);
  const [beku, setBeku] = useState<typeof bidangBaru | null>(null);
  const bidang = beku ?? bidangBaru;
  const ikanKeluar =
    r.xMin < bidang.xMin || r.xMax > bidang.xMax || r.yMin < bidang.yMin || r.yMax > bidang.yMax;
  /* Rintangan yang tertinggal di luar bingkai saat penggeser mengecilkan
     bidang: tidak tergambar dan tidak bisa diseret, jadi jumlahnya ditulis. */
  const obsLuar = obs.filter(
    (o) => o.x < bidang.xMin || o.x > bidang.xMax || o.y < bidang.yMin || o.y > bidang.yMax
  ).length;

  const gayaIkan = {
    color: warna,
    bodyLength: zr,
    minBodyPx: 9,
    /* ikan di dalam rintangan pejal: di luar rentang berlaku model */
    insideColor: C.signal,
    clockPrefix: x.clock,
    clockStep: x.clockStep,
  };

  const plate = usePlate(
    (ctx, w, ch) => {
      const jejak: FieldLine[] = playing
        ? []
        : r.trails.map((jalur) => ({
            pts: jalur,
            color: C.ink3,
            weight: W.hair,
            dash: DASH.solid,
          }));
      /* Rintangan: lingkaran pejal berarsir (benda yang dihindari). */
      const benda: FieldBody[] = obs.map((o) => ({
        pts: Array.from({ length: 41 }, (_, k) => ({
          x: o.x + o.r * Math.cos((2 * Math.PI * k) / 40),
          y: o.y + o.r * Math.sin((2 * Math.PI * k) / 40),
        })),
        hatched: true,
      }));
      const anchors: Record<string, { x: number; y: number }> = {};
      obs.forEach((o, i) => (anchors[`o${i}`] = { x: o.x, y: o.y }));

      const out = drawField(
        ctx,
        w,
        ch,
        {
          ...bidang,
          bodies: benda,
          lines: jejak,
          regions: [
            {
              x: bidang.xMin + (bidang.xMax - bidang.xMin) * 0.12,
              y: bidang.yMax - (bidang.yMax - bidang.yMin) * 0.06,
              text: T.shoalLabel,
              color: C.ink3,
            },
            ...(ikanKeluar
              ? [
                  {
                    x: bidang.xMin + (bidang.xMax - bidang.xMin) * 0.8,
                    y: bidang.yMin + (bidang.yMax - bidang.yMin) * 0.05,
                    text: x.keluar,
                    color: C.ink3,
                  },
                ]
              : []),
            ...(obsLuar > 0
              ? [
                  {
                    x: bidang.xMin + (bidang.xMax - bidang.xMin) * 0.2,
                    y: bidang.yMin + (bidang.yMax - bidang.yMin) * 0.05,
                    text: x.obsLuar(obsLuar),
                    color: C.ink3,
                  },
                ]
              : []),
          ],
          heading: nama,
          headingColor: warna,
          axisX: T.axXMetre,
          axisY: T.axYMetre,
          anchors,
        },
        lang
      );
      /* Saat diam: ikan pada keadaan akhir (langkah 300), digambar dengan
         tanda ikan S8 di atas bidang. */
      if (!playing) drawShoalStill(ctx, out.map, r.agents, gayaIkan, obs);
      return out;
    },
    (ctx, _w, _h, tt, dt, out) => {
      if (!out) return;
      drawShoalMotion(ctx, out.map, tt, dt, gerak, gayaIkan, 1.5 * WAKTU);
    },
    [jumlah, selaras, jauh, dekat, kunciObs, lang, playing, ikanKeluar, bidang.xMin, bidang.xMax, bidang.yMin, bidang.yMax],
    { playing, timeScale: WAKTU }
  );

  const pegangan: HandleSpec[] = rintangan.map(
    (p, i): HandleSpec => ({
      id: `u${i}`,
      anchor: `o${i}`,
      axis: "xy",
      label: x.gObs(i + 1),
      param: [P_POS, P_POS],
      value: [p.x, p.y],
      toValue: (px, py, m) => [m.invX(px), m.invY(py)],
      onChange: ([vx, vy]) => setRintangan((l) => l.map((q, k) => (k === i ? { x: vx, y: vy } : q))),
      onRemove: () => setRintangan((l) => l.filter((_, k) => k !== i)),
      format: ([vx, vy]) => `x ${fmt(vx, 1)} m, y ${fmt(vy, 1)} m`,
    })
  );

  return (
    <LabShell
      status={
        <RegimeScale
          symbol="P"
          value={r.polarisation}
          digits={2}
          bands={[
            { from: 0, to: 0.75, label: x.bTak, tone: "neutral" },
            { from: 0.75, to: 1, label: x.bSearah, tone: "water" },
          ]}
        />
      }
      sheet="EH-05"
      subject={SUBJECTS.EH[lang]}
      title={x.title}
      intro={
        lang === "id" ? (
          <p>
            Tidak ada ikan yang tahu bentuk gerombolannya. Masing-masing hanya
            menjalankan <Term tint={C.water}>tiga aturan tetangga terdekat</Term>
            , dan bentuknya <Term tint={C.critical}>muncul sendiri</Term>.
          </p>
        ) : (
          <p>
            No fish knows the shape of its school. Each runs only{" "}
            <Term tint={C.water}>three nearest-neighbour rules</Term>, and the
            shape <Term tint={C.critical}>emerges by itself</Term>.
          </p>
        )
      }
      drawing={
        <Sheet
          number="EH-05"
          title={x.sheetTitle}
          rev="A"
          cells={[
            { label: t.tbUnit, value: "SI (m)" },
            { label: "P", value: fmt(r.polarisation, 3), tint: C.water },
            { label: "M", value: fmt(r.milling, 3), tint: C.critical },
            { label: "d_nn", value: `${fmt(r.nearestNeighbour, 2)} m` },
            { label: "R", value: `${fmt(r.spread, 2)} m` },
          ]}
          motion={{
            playing,
            onToggle: togglePutar,
            allowed: plate.motionAllowed,
            note: x.motionNote,
          }}
        >
          <canvas ref={plate.ref} className="block h-full w-full" />
          <canvas ref={plate.motionRef} />
          {/* Bidang dibekukan selama jari/tetikus turun di atas pegangan
              atau penangkap taruh. */}
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
                id: "rintangan",
                label: x.tambah,
                param: [P_POS, P_POS],
                toValue: (px, py, m) => [m.invX(px), m.invY(py)],
                onPlace: ([vx, vy]) => setRintangan((l) => [...l, { x: vx, y: vy }]),
                count: rintangan.length,
                max: SHOAL_OBSTACLE_MAX,
                fallback: [(bidang.xMin + bidang.xMax) / 2, (bidang.yMin + bidang.yMax) / 2],
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
              <InputRow symbol="N" label={x.dN} value={jumlah} min={5} max={120} step={1} digits={0} onChange={setJumlah} />
              <InputRow symbol="a" label={x.dA} value={selaras} min={0} max={3} step={0.01} digits={2} onChange={setSelaras} tint={C.water} />
              <InputRow symbol="s" label={x.dS} value={jauh} min={0} max={3} step={0.05} digits={2} onChange={setJauh} />
              <InputRow symbol="c" label={x.dC} value={dekat} min={0} max={2} step={0.05} digits={2} onChange={setDekat} tint={C.critical} />
              <InputRow symbol="r" label={x.dR} value={rObs} min={0.5} max={5} step={0.1} digits={1} unit="m" onChange={setRObs} />
            </InputTable>

            <p className="mt-2.5 text-[0.78rem] leading-snug text-ink-2">{x.taruhPetunjuk(SHOAL_OBSTACLE_MAX)}</p>
            {rintangan.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  sentuh.current();
                  setRintangan([]);
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
                  { label: x.pPencar, apply: () => { setJumlah(40); setSelaras(0); setJauh(0.4); setDekat(0); } },
                  { label: x.pGerombol, apply: () => { setJumlah(40); setSelaras(0); setJauh(1); setDekat(1); } },
                  { label: x.pSearah, apply: () => { setJumlah(40); setSelaras(2.5); setJauh(1); setDekat(0.6); } },
                  { label: x.pPutar, apply: () => { setJumlah(40); setSelaras(0.3); setJauh(1); setDekat(1); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <ResultTable
              rows={[
                { symbol: "P", label: x.rPol, value: fmt(r.polarisation, 4), tint: C.water, strong: true },
                { symbol: "M", label: x.rMil, value: fmt(r.milling, 4), tint: C.critical, strong: true },
                { symbol: "d_nn", label: x.rJarak, value: fmt(r.nearestNeighbour, 3), unit: "m" },
                { symbol: "R", label: x.rSebar, value: fmt(r.spread, 3), unit: "m" },
                { symbol: "—", label: x.rDesak, value: fmt(desakKini * 100, 0), unit: "%" },
                ...(rintangan.length > 0 ? [{ symbol: "nᵣ", label: x.rObsN, value: fmt(rintangan.length, 0) }] : []),
              ]}
            />
            <div className="mt-3">
              <Hitungan
                langkah={[
                  {
                    judul: x.hZona,
                    rumus: <span>zr = {fmt(0.4, 1)} + {fmt(0.4, 1)} · s ;  zo = 5 · a ;  za = 14 · c</span>,
                    isi: `${fmt(0.4, 1)} + ${fmt(0.4, 1)} · ${fmt(jauh, 2)} ;  5 · ${fmt(selaras, 2)} ;  14 · ${fmt(dekat, 2)}`,
                    hasil: `${fmt(zr, 2)} ; ${fmt(zo, 2)} ; ${fmt(za, 2)}`,
                    satuan: "m",
                  },
                  {
                    judul: x.hP,
                    rumus: (<><span>P =</span><Frac num="| Σ hᵢ |" den="N" /></>),
                    isi: `${fmt(r.polarisation * jumlah, 3)} / ${fmt(jumlah, 0)}`,
                    hasil: fmt(r.polarisation, 4),
                    tint: C.water,
                  },
                  {
                    judul: x.hM,
                    rumus: (<><span>M =</span><Frac num="| Σ ( rᵢ × hᵢ ) / | rᵢ | |" den="N" /></>),
                    isi: `${fmt(r.milling * jumlah, 3)} / ${fmt(jumlah, 0)}`,
                    hasil: fmt(r.milling, 4),
                    tint: C.critical,
                  },
                  {
                    judul: x.hR,
                    rumus: <span>R = {lang === "en" ? "mean" : "rerata"} | rᵢ − {lang === "en" ? "centre" : "pusat"} | ;  d_nn = {lang === "en" ? "mean" : "rerata"} minⱼ | rᵢ − rⱼ |</span>,
                    isi: `${x.rerata} ${fmt(jumlah, 0)} ${x.ekor}: R ${fmt(r.spread, 3)} m`,
                    hasil: fmt(r.nearestNeighbour, 3),
                    satuan: "m",
                  },
                  {
                    judul: x.hGol,
                    rumus: <span>P &gt; {fmt(0.75, 2)} → {NAMA[lang].searah} ;  M &gt; {fmt(0.45, 2)} → {NAMA[lang].berputar} ;  R &lt; {fmt(9.6, 1)} m → {NAMA[lang].bergerombol}</span>,
                    isi: `P ${fmt(r.polarisation, 2)} ${r.polarisation > 0.75 ? ">" : "≤"} ${fmt(0.75, 2)} ;  M ${fmt(r.milling, 2)} ${r.milling > 0.45 ? ">" : "≤"} ${fmt(0.45, 2)} ;  R ${fmt(r.spread, 1)} ${r.spread < 9.6 ? "<" : "≥"} ${fmt(9.6, 1)}`,
                    hasil: nama,
                    tint: warna,
                  },
                ]}
              />
            </div>
          </Block>

          <StateCard
            tone={nada}
            badge={nama}
            {...notice(jumlah, selaras, jauh, dekat, r, cekGagal ? x.desakCek.replace("{pct}", fmt(desakCek * 100, 0)).replace("{zr}", fmt(zr, 2)) : "", rintangan.length > 0 ? x.nObs(rintangan.length, r.obstacleStartInside, r.obstacleEntered, fmt(r.obstacleClosest, 2)) : "", lang)}
          />
        </>
      }
      verification={<Verification checks={cek} />}
      below={
        <Basis
          equations={
            <>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "menjauh: menjauhi tetangga yang lebih dekat daripada jarak nyamannya"
                    : "separation: steer away from neighbours closer than the comfortable distance"}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "menyelaraskan: memutar arah menuju arah rata-rata tetangganya"
                    : "alignment: turn toward the mean heading of the neighbours"}
                </span>
              </Eq>
              <Eq>
                <span className="text-ink-3">
                  {lang === "id"
                    ? "mendekat: menuju pusat tetangganya bila sudah terlalu renggang"
                    : "cohesion: steer toward the centre of the neighbours when too far apart"}
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

/** Bagian ikan yang punya tetangga lebih dekat dari lebar zona menjauh. */
function berdesakan(g: { agents: readonly { x: number; y: number }[] }, zr: number): number {
  const n = g.agents.length;
  if (n < 2) return 0;
  let desak = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (Math.hypot(g.agents[j].x - g.agents[i].x, g.agents[j].y - g.agents[i].y) < zr) {
        desak++;
        break;
      }
    }
  }
  return desak / n;
}

function notice(
  jumlah: number,
  selaras: number,
  jauh: number,
  dekat: number,
  a: { polarisation: number; milling: number; nearestNeighbour: number; state: keyof (typeof NAMA)["id"] },
  desakCek: string,
  obsCek: string,
  lang: Lang
): { state: string; notice: string[] } {
  const en = lang === "en";
  const tanpa = shoal(jumlah, 0, jauh, dekat);
  const penuh = shoal(jumlah, 3, jauh, dekat);
  /* Dibandingkan dengan ujung penggeser (3), bukan dikali tiga: s × 3 bisa
     di luar penggeser, dan pada s 0 tidak mengubah apa pun. Bila s sudah 3,
     dibandingkan dengan 1. */
  const sBanding = jauh < 3 ? 3 : 1;
  const banding = shoal(jumlah, selaras, sBanding, dekat);
  const namaKini = NAMA[lang][a.state].toLowerCase();
  const namaBanding = NAMA[lang][banding.state].toLowerCase();
  const bentukSama = banding.state === a.state;

  const state = en
    ? `${NAMA[lang][a.state]}: P = ${fmt(a.polarisation, 2)}, M = ${fmt(a.milling, 2)}.`
    : `${NAMA[lang][a.state]}: P = ${fmt(a.polarisation, 2)}, M = ${fmt(a.milling, 2)}.`;

  const butir: string[] = [];
  if (obsCek) butir.push(obsCek);
  if (desakCek) butir.push(desakCek);
  butir.push(
    en
      ? `Take the alignment weight to zero and the heading order falls to ${fmt(tanpa.polarisation, 2)}; take it to three and it reaches ${fmt(penuh.polarisation, 2)}. One rule, applied by each fish to its own neighbours alone, decides whether the group is a column or a cloud.`
      : `Bawa bobot penyamaan arahnya ke nol dan keteraturan arahnya turun ke ${fmt(tanpa.polarisation, 2)}; bawa ke tiga dan ia mencapai ${fmt(penuh.polarisation, 2)}. Satu aturan, yang dijalankan tiap ikan hanya terhadap tetangganya sendiri, menentukan gerombolannya menjadi barisan atau menjadi awan.`
  );
  butir.push(
    en
      ? `Setting the separation weight from ${fmt(jauh, 2)} to ${fmt(sBanding, 0)} moves the mean nearest-neighbour distance from ${fmt(a.nearestNeighbour, 2)} to ${fmt(banding.nearestNeighbour, 2)} metres, ${bentukSama ? `and the shape stays ${namaKini}` : `and the shape changes too, from ${namaKini} to ${namaBanding}`}.`
      : `Mengubah bobot menjauh dari ${fmt(jauh, 2)} ke ${fmt(sBanding, 0)} memindahkan jarak rata-rata ke tetangga terdekat dari ${fmt(a.nearestNeighbour, 2)} ke ${fmt(banding.nearestNeighbour, 2)} meter, ${bentukSama ? `dan bentuknya tetap ${namaKini}` : `dan bentuknya ikut berubah, dari ${namaKini} menjadi ${namaBanding}`}.`
  );
  return { state, notice: butir };
}
