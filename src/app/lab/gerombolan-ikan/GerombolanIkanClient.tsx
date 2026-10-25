"use client";

import { useMemo, useState } from "react";
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
import { drawField, type FieldLine, type FieldMarker } from "@/lib/drawField";
import { fmt, shoal, type Shoal } from "@/lib/hydraulics";
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
    ekor: "fish",
    desakCek:
      "The verification block below fails the check \u201cPolarisation rises with the alignment weight\u201d. The cause is crowding: at the alignment weight of 2.5 that check uses, {pct} % of the fish have a neighbour closer than the separation zone ({zr} m). The prioritised rules of Couzin et al. (2002) make those fish only move apart and not align, so the order does not rise. The simulation has not been changed; the check and the model still await a decision.",
    note:
      "Not one fish on this sheet knows the shape of its own school. Each sees only a few nearest neighbours and runs three simple rules: do not collide, follow their heading, do not fall behind. Out of those three rules, with no leader and no plan, come shapes that all have names in the fisheries literature. What deserves attention is not that the shapes appear but that the changes between them are abrupt. Raise the alignment weight little by little and the group jumps between shapes abruptly, not always in order: from swarming to milling, back to swarming, and only at a large enough weight into a single polarised column. Along the way there is even a narrow band that is already polarised and then disappears again. Two things follow for river engineering. First, schooling fish enter a fish pass as one body rather than one at a time, so a pass whose width was designed from a single fish will block. Second, a disturbance that breaks the school, light, sound, or a suddenly changing current, can remove the schooling behaviour altogether although not one fish is hurt.",
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

  /* Simulasinya n² tiap langkah dan dijalankan sebelas kali per keadaan
     (gambar, catatan, blok verifikasi), jadi hanya dihitung ulang bila
     masukannya berubah, tidak pada setiap render seperti ganti bahasa. */
  const r = useMemo(() => shoal(jumlah, selaras, jauh, dekat), [jumlah, selaras, jauh, dekat]);
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
            {...notice(jumlah, selaras, jauh, dekat, r, cekGagal ? x.desakCek.replace("{pct}", fmt(desakCek * 100, 0)).replace("{zr}", fmt(zr, 2)) : "", lang)}
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
function berdesakan(g: Shoal, zr: number): number {
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
  a: Shoal,
  desakCek: string,
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
