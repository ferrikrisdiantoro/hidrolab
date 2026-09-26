"use client";

import { useState } from "react";
import { Basis, Eq, LabShell } from "@/components/LabShell";
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
import { drawField, type FieldLine, type FieldMarker } from "@/lib/drawField";
import { fmt, shoal } from "@/lib/hydraulics";
import { C, DASH, W } from "@/lib/theme";
import { SUBJECTS } from "@/data/labs";
import { useLang, type Lang } from "@/lib/i18n";
import { cl, str } from "@/lib/strings";
import { Verification } from "@/components/Verification";
import { checksShoal } from "@/lib/checks";

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
    note:
      "Tidak ada satu pun ikan pada lembar ini yang tahu bentuk gerombolannya. Masing-masing hanya melihat beberapa tetangga terdekatnya dan menjalankan tiga aturan sederhana: jangan menabrak, ikuti arah mereka, dan jangan tertinggal. Dari tiga aturan itu, tanpa satu pun pemimpin dan tanpa satu pun rencana, muncul bentuk-bentuk yang seluruhnya punya nama dalam pustaka perikanan. Yang paling pantas diperhatikan bukan bahwa bentuknya muncul melainkan bahwa perpindahan antar bentuknya mendadak. Naikkan bobot penyamaan arah sedikit demi sedikit dan gerombolan yang tadinya berputar tanpa arah akan tiba-tiba, pada satu nilai sempit, berubah menjadi satu barisan yang seluruhnya searah. Tidak ada keadaan setengah jalan yang bertahan lama di antara keduanya. Bagi rekayasa sungai, dua hal mengikuti. Pertama, ikan yang bergerombol memasuki lintasan ikan sebagai satu kesatuan, bukan satu per satu, jadi lintasan yang lebarnya dirancang dari satu ekor akan menyumbat. Kedua, gangguan yang memecah gerombolan, misalnya cahaya, suara, atau arus yang berganti mendadak, dapat menghilangkan perilaku bergerombolnya sama sekali meskipun tidak satu ikan pun terluka.",
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
    note:
      "Not one fish on this sheet knows the shape of its own school. Each sees only a few nearest neighbours and runs three simple rules: do not collide, follow their heading, do not fall behind. Out of those three rules, with no leader and no plan, come shapes that all have names in the fisheries literature. What deserves attention is not that the shapes appear but that the changes between them are abrupt. Raise the alignment weight little by little and a group that was milling without direction will suddenly, over a narrow range, become a single polarised column. No halfway state lasts long between them. Two things follow for river engineering. First, schooling fish enter a fish pass as one body rather than one at a time, so a pass whose width was designed from a single fish will block. Second, a disturbance that breaks the school, light, sound, or a suddenly changing current, can remove the schooling behaviour altogether although not one fish is hurt.",
  },
} as const;

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

  const r = shoal(jumlah, selaras, jauh, dekat);
  const nama = NAMA[lang][r.state];
  const warna =
    r.state === "searah"
      ? C.water
      : r.state === "berputar"
        ? C.critical
        : r.state === "bergerombol"
          ? C.energy
          : C.ink2;

  const ref = useCanvas(
    (ctx, w, ch) => {
      const jejak: FieldLine[] = r.trails.map((jalur) => ({
        pts: jalur,
        color: C.ink3,
        weight: W.hair,
        dash: DASH.solid,
      }));

      const ikan: FieldMarker[] = r.agents.map((a) => ({
        x: a.x,
        y: a.y,
        heading: Math.atan2(a.vy, a.vx),
        color: warna,
        size: 6,
        filled: false,
      }));

      /* Bingkai mencakup jejaknya juga, bukan hanya ikannya: jejak ekor
         yang tertinggal di belakang gerombolan dulu menembus tepi bingkai
         dan menimpa judul keadaannya. Ruang di atas disisakan untuk judul. */
      const semua = [...r.agents, ...r.trails.flat()];
      const xs = semua.map((a) => a.x);
      const ys = semua.map((a) => a.y);
      const margin = Math.max(r.nearestNeighbour * 2, r.spread * 0.2, 1);
      const xMin = Math.min(...xs) - margin;
      const xMax = Math.max(...xs) + margin;
      const yMin = Math.min(...ys) - margin;
      const yMax = Math.max(...ys) + margin + (Math.max(...ys) - Math.min(...ys) + 2 * margin) * 0.14;

      drawField(
        ctx,
        w,
        ch,
        {
          xMin,
          xMax,
          yMin,
          yMax,
          lines: jejak,
          markers: ikan,
          regions: [
            {
              x: xMin + (xMax - xMin) * 0.12,
              y: yMax - (yMax - yMin) * 0.06,
              text: T.shoalLabel,
              color: C.ink3,
            },
          ],
          heading: nama,
          headingColor: warna,
          axisX: T.axXMetre,
          axisY: T.axYMetre,
        },
        lang
      );
    },
    [jumlah, selaras, jauh, dekat, lang]
  );

  return (
    <LabShell
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
            { label: "d̄", value: `${fmt(r.nearestNeighbour, 2)} m` },
            { label: "R", value: `${fmt(r.spread, 2)} m` },
          ]}
        >
          <canvas ref={ref} className="block h-full w-full" />
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
            </InputTable>

            <div className="mt-3.5">
              <PresetRow
                label={t.presetExample}
                presets={[
                  { label: x.pPencar, apply: () => { setJumlah(40); setSelaras(0); setJauh(0.4); setDekat(0); } },
                  { label: x.pGerombol, apply: () => { setJumlah(40); setSelaras(0); setJauh(1); setDekat(1); } },
                  { label: x.pSearah, apply: () => { setJumlah(40); setSelaras(2.5); setJauh(1); setDekat(0.6); } },
                  { label: x.pPutar, apply: () => { setJumlah(30); setSelaras(0.02); setJauh(1); setDekat(0.2); } },
                ]}
              />
            </div>
          </Block>

          <Block heading={t.blkResult}>
            <div className="mb-2.5">
              <Flag tint={warna}>{nama}</Flag>
            </div>
            <ResultTable
              rows={[
                { symbol: "P", label: x.rPol, value: fmt(r.polarisation, 4), tint: C.water, strong: true },
                { symbol: "M", label: x.rMil, value: fmt(r.milling, 4), tint: C.critical, strong: true },
                { symbol: "d̄", label: x.rJarak, value: fmt(r.nearestNeighbour, 3), unit: "m" },
                { symbol: "R", label: x.rSebar, value: fmt(r.spread, 3), unit: "m" },
              ]}
            />
          </Block>

          <Block heading={t.blkNotice}>
            <Note>{notice(jumlah, selaras, jauh, dekat, lang)}</Note>
          </Block>
        </>
      }
      verification={<Verification checks={checksShoal(jumlah, selaras, jauh, dekat)} />}
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

function notice(
  jumlah: number,
  selaras: number,
  jauh: number,
  dekat: number,
  lang: Lang
) {
  const a = shoal(jumlah, selaras, jauh, dekat);
  const tanpa = shoal(jumlah, 0, jauh, dekat);
  const penuh = shoal(jumlah, 3, jauh, dekat);
  const rapat = shoal(jumlah, selaras, jauh * 3, dekat);

  if (lang === "en")
    return `At this setting the heading order is ${fmt(a.polarisation, 2)} and the group is ${NAMA[lang][a.state].toLowerCase()}. Take the alignment weight to zero and it falls to ${fmt(tanpa.polarisation, 2)}; take it to three and it reaches ${fmt(penuh.polarisation, 2)}. Nothing else changed: one rule, applied by each fish to its own neighbours alone, decides whether the group is a column or a cloud. The separation weight sets the spacing rather than the shape: tripling it moves the mean nearest-neighbour distance from ${fmt(a.nearestNeighbour, 2)} to ${fmt(rapat.nearestNeighbour, 2)} metres.`;
  return `Pada setelan ini keteraturan arahnya ${fmt(a.polarisation, 2)} dan gerombolannya ${NAMA[lang][a.state].toLowerCase()}. Bawa bobot penyamaan arahnya ke nol dan ia turun ke ${fmt(tanpa.polarisation, 2)}; bawa ke tiga dan ia mencapai ${fmt(penuh.polarisation, 2)}. Tidak ada yang lain berubah: satu aturan, yang dijalankan tiap ikan hanya terhadap tetangganya sendiri, menentukan gerombolannya menjadi barisan atau menjadi awan. Bobot menjauhnya mengatur kerapatan dan bukan bentuknya: melipattigakannya memindahkan jarak rata-rata ke tetangga terdekat dari ${fmt(a.nearestNeighbour, 2)} ke ${fmt(rapat.nearestNeighbour, 2)} meter.`;
}
