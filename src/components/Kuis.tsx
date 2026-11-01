"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLang, type Lang } from "@/lib/i18n";
import { TONE } from "@/lib/theme";
import {
  benihAcak,
  fmtL,
  nilaiJawab,
  type BankKuis,
  type Keadaan,
  type Nilai,
  type Soal,
} from "@/lib/kuis";
import { Hitungan, parseAngka } from "./ui";

/*
 * Kartu kuis lembar (Phase 3, K1).
 *
 * Bentuknya lembar jawab: deret kotak bernomor di atas (satu per soal, terisi
 * nada benar atau belum tepat sesudah dijawab), lalu satu soal pada satu
 * waktu. Nomor di sini memang urutan soal, jadi kotaknya membawa data.
 *
 * Warna mengikuti kosakata penilaian theme.ts: benar = pass, belum tepat =
 * caution. Merah sinyal TIDAK dipakai: jawaban keliru bukan keadaan di luar
 * rentang berlaku.
 *
 * Penilaian: jawaban pertama tiap soal yang dicatat ke skor sesi (disimpan
 * di sessionStorage per kode lembar, bersama benihnya). Reset lembar
 * memasang ulang komponen ini: jawaban kosong lagi, set soal tetap (benih
 * dibaca dari sessionStorage), skor sesi tidak bertambah dua kali untuk
 * soal yang sama karena kuncinya benih:id.
 */

const TXT = {
  id: {
    heading: "Uji pemahaman",
    soal: "Soal",
    dari: "dari",
    jenis: { pilih: "Pilih satu", tebak: "Tebak dulu", hitung: "Hitung", atur: "Atur di lembar" },
    baru: "Soal baru",
    baruTitle: "Ganti seluruh soal dengan angka baru",
    lanjut: "Soal berikutnya",
    selesai: "Semua soal sudah dijawab. Tekan Soal baru untuk set berikutnya.",
    periksa: "Periksa",
    periksaLagi: "Periksa lagi",
    jawaban: "Jawaban",
    benar: "Benar",
    salah: "Belum tepat",
    kunciPilih: "Jawaban yang tepat",
    kunciHitung: (k: string, t: string, s: string) => `Kunci ${k} ${s}, toleransi ± ${t} ${s}.`,
    dijawab: (j: string, s: string) => `Jawaban ${j} ${s}.`,
    bukanAngka: "Tulis sebuah angka, misalnya 2,35. Koma dan titik sama-sama dibaca desimal.",
    ukurSekarang: "Nilai sekarang",
    sasaran: "Sasaran",
    tetapDiubah: (n: string, v: string) => `${n} harus tetap ${v}. Kembalikan dulu, lalu periksa.`,
    luarSasaran: (u: string) => `Nilai sekarang ${u}, belum di dalam sasaran.`,
    diSasaran: (u: string) => `Nilai sekarang ${u}, di dalam sasaran.`,
    terpasang: "Masukan soal ini sudah dipasang di lembar; lihat gambar dan tabel hasilnya.",
    siap: "Masukan awal soal ini sudah dipasang di lembar.",
    skor: (b: number, n: number) => (n === 0 ? "Belum ada soal yang dijawab di sesi ini." : `Sesi ini: ${b} benar dari ${n} soal dijawab.`),
    cek: "Soal contoh, belum ditelaah dosen pengampu.",
    statusKotak: { kosong: "belum dijawab", benar: "benar", salah: "belum tepat" },
    memuat: "Menyiapkan soal",
  },
  en: {
    heading: "Check your understanding",
    soal: "Question",
    dari: "of",
    jenis: { pilih: "Choose one", tebak: "Guess first", hitung: "Compute", atur: "Set it on the sheet" },
    baru: "New questions",
    baruTitle: "Replace every question with new numbers",
    lanjut: "Next question",
    selesai: "All questions answered. Press New questions for another set.",
    periksa: "Check",
    periksaLagi: "Check again",
    jawaban: "Answer",
    benar: "Correct",
    salah: "Not quite",
    kunciPilih: "The right answer",
    kunciHitung: (k: string, t: string, s: string) => `Key ${k} ${s}, tolerance ± ${t} ${s}.`,
    dijawab: (j: string, s: string) => `Answered ${j} ${s}.`,
    bukanAngka: "Type a number, for example 2.35. Comma and point are both read as decimals.",
    ukurSekarang: "Current value",
    sasaran: "Target",
    tetapDiubah: (n: string, v: string) => `${n} must stay at ${v}. Set it back, then check.`,
    luarSasaran: (u: string) => `Current value ${u}, not yet inside the target.`,
    diSasaran: (u: string) => `Current value ${u}, inside the target.`,
    terpasang: "This question's inputs are now set on the sheet; see the drawing and results.",
    siap: "This question's starting inputs are now set on the sheet.",
    skor: (b: number, n: number) => (n === 0 ? "No questions answered yet this session." : `This session: ${b} correct out of ${n} answered.`),
    cek: "Sample questions, not yet reviewed by a course lecturer.",
    statusKotak: { kosong: "not answered", benar: "correct", salah: "not quite" },
    memuat: "Preparing questions",
  },
} as const;

type Catatan = { benih: number; catat: Record<string, boolean> };
type Jawab = { jawab: string | number; nilai: Nilai; tercatat: boolean };

const kunciSimpan = (kode: string) => `hidrolab-kuis:${kode}`;

function bacaSimpan(kode: string): Catatan | null {
  try {
    const s = window.sessionStorage.getItem(kunciSimpan(kode));
    if (!s) return null;
    const v = JSON.parse(s) as Catatan;
    if (typeof v?.benih !== "number" || typeof v.catat !== "object" || v.catat === null) return null;
    return v;
  } catch {
    return null;
  }
}

function tulisSimpan(kode: string, c: Catatan) {
  try {
    window.sessionStorage.setItem(kunciSimpan(kode), JSON.stringify(c));
  } catch {
    // Penyimpanan ditolak (mode privat, kuota): skor hanya bertahan di layar.
  }
}

export function Kuis({
  bank,
  keadaan,
  onTerapkan,
  onUngkap,
  onAktif,
  label,
}: {
  bank: BankKuis;
  /** Masukan lembar saat ini, untuk soal "atur". */
  keadaan?: Keadaan;
  /** Memasang masukan soal ke lembar (penggeser yang sama). */
  onTerapkan?: (masukan: Keadaan) => void;
  /** Soal "tebak": lembar membuka yang tadinya disembunyikan. */
  onUngkap?: (soalId: string) => void;
  /** Soal yang sedang tampil, supaya lembar bisa menyembunyikan sesuatu untuk soal tebak. */
  onAktif?: (soal: Soal | null) => void;
  /** Nama tampilan masukan lembar, untuk pesan "harus tetap". */
  label?: Record<string, { simbol: string; satuan?: string; digits?: number }>;
}) {
  const { lang } = useLang();
  const x = TXT[lang];
  const idJudul = useId();

  const [catatan, setCatatan] = useState<Catatan | null>(null);
  const [indeks, setIndeks] = useState(0);
  const [jawab, setJawab] = useState<Record<string, Jawab>>({});
  const [pesan, setPesan] = useState<Record<string, string>>({});
  const disiapkan = useRef(new Set<string>());
  const judulSoal = useRef<HTMLParagraphElement>(null);
  const umpan = useRef<HTMLDivElement>(null);
  const pindahFokus = useRef<"soal" | "umpan" | null>(null);

  // Benih dibaca sesudah dipasang (sessionStorage tidak ada di server).
  useEffect(() => {
    const ada = bacaSimpan(bank.kode);
    const c = ada ?? { benih: benihAcak(), catat: {} };
    if (!ada) tulisSimpan(bank.kode, c);
    setCatatan(c);
  }, [bank.kode]);

  const benih = catatan?.benih ?? null;
  const soal = useMemo(() => (benih === null ? [] : bank.buat(benih)), [bank, benih]);
  const s: Soal | undefined = soal[indeks];

  useEffect(() => {
    onAktif?.(s ?? null);
    // onAktif dari lembar boleh berganti identitas tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s]);

  useEffect(() => {
    if (pindahFokus.current === "soal") judulSoal.current?.focus();
    if (pindahFokus.current === "umpan") umpan.current?.focus();
    pindahFokus.current = null;
  });

  const skor = useMemo(() => {
    const v = Object.values(catatan?.catat ?? {});
    return { benar: v.filter(Boolean).length, n: v.length };
  }, [catatan]);

  const buka = (i: number) => {
    const q = soal[i];
    setIndeks(i);
    // Klik kotak soal yang sudah aktif tidak merender ulang; permintaan fokus
    // yang tertinggal akan mencuri fokus dari penggeser pada render berikutnya.
    if (i !== indeks) pindahFokus.current = "soal";
    // Soal atur memasang keadaan awalnya sekali per set, saat pertama dibuka.
    if (q?.jenis === "atur" && q.siapkan && !jawab[q.id] && !disiapkan.current.has(q.id)) {
      disiapkan.current.add(q.id);
      onTerapkan?.(q.siapkan);
    }
  };

  const soalBaru = () => {
    const c: Catatan = { benih: benihAcak(), catat: catatan?.catat ?? {} };
    tulisSimpan(bank.kode, c);
    setCatatan(c);
    setJawab({});
    setPesan({});
    disiapkan.current.clear();
    setIndeks(0);
    pindahFokus.current = "soal";
  };

  const catat = (q: Soal, j: string | number, n: Nilai) => {
    if (benih === null) return;
    const k = `${benih}:${q.id}`;
    const sudah = jawab[q.id];
    setJawab((a) => ({ ...a, [q.id]: { jawab: j, nilai: n, tercatat: true } }));
    if (!sudah && catatan && !(k in catatan.catat)) {
      const c = { ...catatan, catat: { ...catatan.catat, [k]: n.benar } };
      tulisSimpan(bank.kode, c);
      setCatatan(c);
    }
    pindahFokus.current = "umpan";
    if (q.masukan) onTerapkan?.(q.masukan);
    if (q.jenis === "tebak") onUngkap?.(q.id);
  };

  const jawabPilih = (q: Soal, id: string) => {
    if (jawab[q.id]) return;
    catat(q, id, nilaiJawab(q, id));
  };

  const jawabHitung = (q: Soal, teks: string) => {
    if (jawab[q.id]) return;
    const v = parseAngka(teks);
    if (v === null) {
      setPesan((p) => ({ ...p, [q.id]: x.bukanAngka }));
      return;
    }
    setPesan((p) => ({ ...p, [q.id]: "" }));
    catat(q, v, nilaiJawab(q, v));
  };

  const jawabAtur = (q: Soal) => {
    const n = nilaiJawab(q, 0, keadaan);
    if (n.tetapDiubah && q.jenis === "atur") {
      const nama = n.tetapDiubah;
      const l = label?.[nama];
      const v = q.tetap?.[nama] ?? 0;
      setPesan((p) => ({
        ...p,
        [q.id]: x.tetapDiubah(l?.simbol ?? nama, `${fmtL(v, l?.digits ?? 2, lang)}${l?.satuan ? ` ${l.satuan}` : ""}`),
      }));
      return;
    }
    setPesan((p) => ({ ...p, [q.id]: "" }));
    // Periksa ulang soal atur boleh; skor tetap dari pemeriksaan pertama.
    const benih0 = benih;
    if (benih0 === null) return;
    const k = `${benih0}:${q.id}`;
    setJawab((a) => ({ ...a, [q.id]: { jawab: n.ukuran ?? Number.NaN, nilai: n, tercatat: true } }));
    if (catatan && !(k in catatan.catat)) {
      const c = { ...catatan, catat: { ...catatan.catat, [k]: n.benar } };
      tulisSimpan(bank.kode, c);
      setCatatan(c);
    }
    pindahFokus.current = "umpan";
  };

  const statusKotak = (q: Soal) => {
    const j = jawab[q.id];
    return !j ? "kosong" : j.nilai.benar ? "benar" : "salah";
  };

  const semuaDijawab = soal.length > 0 && soal.every((q) => jawab[q.id]);

  return (
    <section aria-labelledby={idJudul} data-kuis={bank.kode} className="border-t border-ink pt-2.5">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={idJudul} className="stencil">
          {x.heading}
        </h2>
        <button
          type="button"
          onClick={soalBaru}
          title={x.baruTitle}
          disabled={benih === null}
          className="label border-b border-rule-strong pb-px text-[0.8rem] text-ink-2 transition-colors hover:border-ink hover:text-ink"
        >
          {x.baru}
        </button>
      </div>

      {benih === null || !s ? (
        <p className="label text-[0.8rem] text-ink-3">{x.memuat}</p>
      ) : (
        <div className="border border-rule-strong bg-sheet">
          {/* Lembar jawab: satu kotak per soal. */}
          <ol className="flex list-none gap-px border-b border-rule bg-rule" aria-label={`${x.soal} 1–${soal.length}`}>
            {soal.map((q, i) => {
              const st = statusKotak(q);
              const nada = st === "benar" ? TONE.pass : st === "salah" ? TONE.caution : null;
              const aktif = i === indeks;
              return (
                <li key={q.id} className="flex-1">
                  <button
                    type="button"
                    onClick={() => buka(i)}
                    aria-current={aktif ? "step" : undefined}
                    aria-label={`${x.soal} ${i + 1}, ${x.statusKotak[st]}`}
                    className="label value relative flex h-9 w-full items-center justify-center text-[0.82rem] transition-colors hover:text-ink"
                    style={{
                      background: nada ? nada.fill : "var(--color-sheet)",
                      color: nada ? nada.line : aktif ? "var(--color-ink)" : "var(--color-ink-3)",
                      fontWeight: aktif ? 600 : 400,
                    }}
                  >
                    {i + 1}
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-[2px]"
                      style={{ background: aktif ? "var(--color-ink)" : "transparent" }}
                    />
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="px-3.5 pb-3.5 pt-3">
            <div className="label mb-1.5 flex items-baseline justify-between gap-2 text-[0.72rem] text-ink-3">
              <span>
                {x.soal} {indeks + 1} {x.dari} {soal.length}
              </span>
              <span>{x.jenis[s.jenis]}</span>
            </div>
            <p
              ref={judulSoal}
              tabIndex={-1}
              className="max-w-[62ch] text-[0.96rem] leading-[1.55] text-ink outline-offset-2"
            >
              {s.tanya[lang]}
            </p>

            <BadanSoal
              key={`${benih}:${s.id}`}
              s={s}
              lang={lang}
              j={jawab[s.id]}
              pesan={pesan[s.id] ?? ""}
              keadaan={keadaan}
              onPilih={(id) => jawabPilih(s, id)}
              onHitung={(t) => jawabHitung(s, t)}
              onAtur={() => jawabAtur(s)}
            />

            {jawab[s.id] && (
              <div
                ref={umpan}
                tabIndex={-1}
                role="status"
                aria-live="polite"
                className="mt-3 outline-offset-2"
              >
                <UmpanBalik s={s} j={jawab[s.id]} lang={lang} />
              </div>
            )}

            {jawab[s.id] && (
              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                {indeks < soal.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => buka(indeks + 1)}
                    className="label border-b-2 border-ink pb-px text-[0.84rem] font-semibold text-ink"
                  >
                    {x.lanjut}
                  </button>
                ) : (
                  <span />
                )}
              </div>
            )}
            {semuaDijawab && (
              <p className="mt-3 text-[0.88rem] leading-[1.5] text-ink-2">{x.selesai}</p>
            )}
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-rule px-3.5 py-2">
            <span data-kuis-skor className="label text-[0.74rem] text-ink-2">
              {x.skor(skor.benar, skor.n)}
            </span>
            <span className="label text-[0.7rem] text-ink-3">{x.cek}</span>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function BadanSoal({
  s,
  lang,
  j,
  pesan,
  keadaan,
  onPilih,
  onHitung,
  onAtur,
}: {
  s: Soal;
  lang: Lang;
  j?: Jawab;
  pesan: string;
  keadaan?: Keadaan;
  onPilih: (id: string) => void;
  onHitung: (teks: string) => void;
  onAtur: () => void;
}) {
  const x = TXT[lang];
  const [teks, setTeks] = useState("");
  const idPesan = useId();

  if (s.jenis === "pilih" || s.jenis === "tebak") {
    return (
      <ul className="mt-3 flex list-none flex-col gap-1.5" aria-label={x.jawaban}>
        {s.pilihan.map((p) => {
          const dipilih = j?.jawab === p.id;
          const kunci = j && p.id === s.kunci;
          const nada = kunci ? TONE.pass : dipilih ? TONE.caution : null;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPilih(p.id)}
                aria-disabled={j ? true : undefined}
                aria-pressed={j ? dipilih : undefined}
                className={`grid w-full grid-cols-[0.9rem_1fr] items-baseline border px-2.5 py-1.5 text-left text-[0.9rem] leading-[1.4] transition-colors ${
                  j ? "cursor-default" : "hover:border-ink"
                }`}
                style={{
                  borderColor: nada ? nada.line : "var(--color-rule-strong)",
                  background: nada ? nada.fill : "transparent",
                  color: nada ? "var(--color-ink)" : j ? "var(--color-ink-3)" : "var(--color-ink)",
                }}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 -translate-y-px"
                  style={{
                    background: nada ? nada.line : "var(--color-ink-3)",
                    transform: "rotate(45deg)",
                    opacity: j && !nada ? 0.4 : 1,
                  }}
                />
                <span>{p.teks[lang]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  if (s.jenis === "hitung") {
    return (
      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          onHitung(teks);
        }}
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <label className="label flex items-baseline gap-1.5 text-[0.8rem] text-ink-2">
            {x.jawaban}
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={j ? fmtL(Number(j.jawab), s.digits, lang) : teks}
              readOnly={!!j}
              onChange={(e) => setTeks(e.target.value)}
              aria-describedby={pesan ? idPesan : undefined}
              aria-invalid={pesan ? true : undefined}
              className="label w-[7ch] border-0 border-b border-rule-strong bg-transparent px-0.5 py-0 text-right text-[16px] font-semibold text-ink hover:border-ink focus:border-ink sm:text-[0.9rem]"
            />
            <span className="text-[0.76rem] text-ink-3">{s.satuan[lang]}</span>
          </label>
          {!j && (
            <button
              type="submit"
              className="label border-b-2 border-ink pb-px text-[0.84rem] font-semibold text-ink"
            >
              {x.periksa}
            </button>
          )}
        </div>
        <p id={idPesan} role="status" className="label mt-1 text-[0.74rem] text-ink-2">
          {pesan}
        </p>
      </form>
    );
  }

  // atur
  const u = keadaan ? s.ukur(keadaan) : Number.NaN;
  const di = Number.isFinite(u) && u >= s.target.min && u <= s.target.max;
  const sim = s.simbol ? `${s.simbol} ` : "";
  return (
    <div className="mt-3">
      <dl className="label grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.8rem]">
        <dt className="text-ink-3">{x.sasaran}</dt>
        <dd className="value text-ink">
          {sim}
          {ringkas(s.target.min, lang)} – {ringkas(s.target.max, lang)}
        </dd>
        <dt className="text-ink-3">{x.ukurSekarang}</dt>
        <dd
          className="value font-semibold"
          style={{ color: di ? TONE.pass.line : "var(--color-ink)" }}
        >
          {sim}= {fmtL(u, s.digits ?? 2, lang)}
        </dd>
      </dl>
      {s.siapkan && <p className="mt-1.5 text-[0.84rem] leading-[1.5] text-ink-2">{x.siap}</p>}
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <button
          type="button"
          onClick={onAtur}
          aria-describedby={pesan ? idPesan : undefined}
          className="label border-b-2 border-ink pb-px text-[0.84rem] font-semibold text-ink"
        >
          {j ? x.periksaLagi : x.periksa}
        </button>
      </div>
      <p id={idPesan} role="status" className="label mt-1 text-[0.74rem] text-ink-2">
        {pesan}
      </p>
    </div>
  );
}

/** Angka batas sasaran tanpa nol buntut (5, bukan 5,00). */
const ringkas = (v: number, lang: Lang) =>
  v.toLocaleString(lang === "en" ? "en-US" : "id-ID", { maximumFractionDigits: 3 });

function UmpanBalik({ s, j, lang }: { s: Soal; j: Jawab; lang: Lang }) {
  const x = TXT[lang];
  const nada = j.nilai.benar ? TONE.pass : TONE.caution;
  const baris: string[] = [];

  if (s.jenis === "pilih" || s.jenis === "tebak") {
    // Benar: pembahasan sudah menjelaskan kuncinya. Salah: mengapa pilihan
    // itu keliru, lalu jawaban yang tepat, lalu pembahasan.
    if (!j.nilai.benar) {
      const p = s.pilihan.find((q) => q.id === j.jawab);
      if (p?.alasan) baris.push(p.alasan[lang]);
      const k = s.pilihan.find((q) => q.id === s.kunci);
      if (k) baris.push(`${x.kunciPilih}: ${k.teks[lang]}.`);
    }
  } else if (s.jenis === "hitung") {
    const sat = s.satuan[lang];
    baris.push(x.dijawab(fmtL(Number(j.jawab), s.digits, lang), sat));
    if (j.nilai.kesalahan) baris.push(j.nilai.kesalahan.alasan[lang]);
    baris.push(x.kunciHitung(fmtL(s.kunci, s.digits, lang), fmtL(s.toleransi, s.digits, lang), sat));
  } else {
    const u = fmtL(j.nilai.ukuran ?? Number.NaN, 2, lang);
    baris.push(j.nilai.benar ? x.diSasaran(u) : x.luarSasaran(u));
  }
  baris.push(s.bahas[lang]);
  if (s.masukan) baris.push(x.terpasang);

  return (
    <div className="border border-rule-strong" style={{ borderLeft: `2px solid ${nada.line}` }}>
      <div className="px-3 pb-2.5 pt-2">
        <p className="stencil mb-1" style={{ color: nada.line }}>
          {j.nilai.benar ? x.benar : x.salah}
        </p>
        <ul className="flex list-none flex-col gap-1">
          {baris.map((b, i) => (
            <li key={i} className="max-w-[62ch] text-[0.88rem] leading-[1.5] text-ink-2">
              {b}
            </li>
          ))}
        </ul>
        {s.langkah && (
          <div className="mt-2.5">
            <Hitungan langkah={s.langkah[lang]} />
          </div>
        )}
      </div>
    </div>
  );
}
