"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useLang } from "@/lib/i18n";
import { str } from "@/lib/strings";
import { fmt } from "@/lib/hydraulics";
import { W } from "@/lib/theme";
import type { ParamDef } from "@/lib/rentang";
import type { PlateAnchor, PlateMap, PlateOut } from "@/lib/plateOut";
import {
  samaNilai,
  snapSeret,
  titikSeret,
  tombolKeNilai,
  type NilaiSeret,
  type Pasangan,
} from "@/lib/seret";
import { usePresetTouch } from "./ui";

/* ------------------------------------------------------------------ *
 * Pegangan seret di atas gambar
 * ------------------------------------------------------------------ *
 * Lapis DOM yang ditaruh di dalam Sheet, sesudah kanvas. Posisi pegangan
 * dibaca dari PlateOut.anchors yang dikembalikan penggambar, jadi lapis ini
 * tidak menebak skala gambar.
 *
 * Satu sumber nilai (aturan 4): pegangan memanggil setter yang SAMA dengan
 * penggeser InputRow, dengan ParamDef yang SAMA. Nilai seret di-snap lewat
 * rentang.ts; bila dipotong ke ujung rentang, ada penanda "dibatasi ke ..."
 * di dekat pegangan sampai jari/tetikus dilepas.
 *
 * Lapisnya pointer-events: none dan touch-action bawaan, jadi halaman tetap
 * bisa digulir dengan menyentuh gambar. Hanya pegangan (target 44 px) yang
 * menangkap sentuhan dan memakai touch-action: none.
 */

type HandleBase = {
  id: string;
  /** Kunci di out.anchors. Pegangan tidak dirender bila kuncinya tidak ada. */
  anchor: string;
  /** aria-label, sudah dalam bahasa aktif. */
  label: string;
  /** Warna garis pegangan; samakan dengan tint InputRow-nya. Bawaan: tinta. */
  tint?: string;
  /**
   * Cincin pegangan tanpa isi, supaya tanda data yang digambar penggambar
   * di titik yang sama (misalnya belah ketupat titik kerja PI-01) tetap
   * terlihat di dalamnya. Bawaan: berisi warna kertas.
   */
  hollow?: boolean;
};

export type HandleSpec1 = HandleBase & {
  axis: "x" | "y";
  param: ParamDef;
  value: number;
  /** Piksel CSS (dari pojok kiri atas kanvas) → nilai mentah, sebelum snap. */
  toValue: (px: number, py: number, map: PlateMap) => number;
  onChange: (v: number) => void;
  /** Teks nilai untuk aria-valuetext dan penanda potong, sebaiknya dengan satuan. */
  format?: (v: number) => string;
};

export type HandleSpec2 = HandleBase & {
  axis: "xy";
  /** [sumbu 1 (panah kiri/kanan), sumbu 2 (panah atas/bawah)] */
  param: readonly [ParamDef, ParamDef];
  value: readonly [number, number];
  toValue: (px: number, py: number, map: PlateMap) => readonly [number, number];
  onChange: (v: [number, number]) => void;
  format?: (v: readonly [number, number]) => string;
};

export type HandleSpec = HandleSpec1 | HandleSpec2;

/** Setengah target sentuh 44 px. */
const R = 22;

function teksNilai(spec: HandleSpec, v: NilaiSeret): string {
  if (spec.axis === "xy") {
    const p = v as Pasangan;
    if (spec.format) return spec.format(p);
    return `${fmt(p[0], spec.param[0].digits ?? 2)}; ${fmt(p[1], spec.param[1].digits ?? 2)}`;
  }
  const n = v as number;
  return spec.format ? spec.format(n) : fmt(n, spec.param.digits ?? 2);
}

/** Mengirim nilai baru ke pemanggil dengan tipe yang sesuai sumbunya. */
function kirimNilai(spec: HandleSpec, v: NilaiSeret) {
  if (spec.axis === "xy") {
    const p = v as Pasangan;
    spec.onChange([p[0], p[1]]);
  } else {
    spec.onChange(v as number);
  }
}

function Pegangan({
  spec,
  at,
  asli,
  map,
  touchLembar,
}: {
  spec: HandleSpec;
  /** Posisi tampil, sudah dijepit ke bidang plot. */
  at: PlateAnchor;
  /** Posisi asli nilai (bisa di luar bidang); dasar ukuran seret. */
  asli: PlateAnchor;
  map: PlateMap;
  touchLembar?: () => void;
}) {
  const t = str(useLang().lang);
  // Pegangan duduk di Sheet, di luar Block, jadi konteks contoh sering
  // tidak sampai; lembar boleh memberi fungsi padamnya sendiri.
  const touchBlok = usePresetTouch();
  const touch = touchLembar ?? touchBlok;

  // Handler membaca nilai terbaru lewat ref, karena selama seret komponen
  // dirender ulang tiap kali pemanggil menyimpan nilai baru.
  const kini = useRef({ spec, asli, map });
  kini.current = { spec, asli, map };

  const seret = useRef<{
    id: number;
    geser: { x: number; y: number };
    awal: { x: number; y: number };
    /** Pojok lapis di layar saat seret dimulai. */
    lapis: { left: number; top: number };
  } | null>(null);
  const [aktif, setAktif] = useState(false);
  const [potong, setPotong] = useState<NilaiSeret | null>(null);

  const ubah = (v: NilaiSeret) => {
    const s = kini.current.spec;
    if (samaNilai(v, s.value)) return;
    touch();
    kirimNilai(s, v);
  };

  const pojokLapis = (e: PointerEvent<HTMLDivElement>) => {
    const lapis = e.currentTarget.parentElement;
    const r = lapis ? lapis.getBoundingClientRect() : { left: 0, top: 0 };
    return { left: r.left, top: r.top };
  };
  /*
   * Selama seret, jari diukur terhadap pojok lapis SAAT SERET DIMULAI, bukan
   * pojok sekarang. Nilai yang diseret bisa mengubah tinggi unsur di atas
   * gambar (label pita rezim yang terlipat ke dua baris di 390 px), dan
   * gambarnya bergeser di bawah jari yang diam. Diukur dari pojok sekarang,
   * geseran itu terbaca sebagai seret baru, nilainya melompat balik, label
   * kembali satu baris, dan nilainya berayun tiap gerakan (HS-01, 26 Okt).
   */
  const titikLapis = (
    e: PointerEvent<HTMLDivElement>,
    r: { left: number; top: number } = pojokLapis(e)
  ) => ({ x: e.clientX - r.left, y: e.clientY - r.top });

  const selesai = () => {
    seret.current = null;
    setAktif(false);
    setPotong(null);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    // Fokus supaya panah bisa langsung dipakai, tanpa cincin fokus: cincin
    // hanya untuk pemilihan dengan keyboard.
    e.currentTarget.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    e.currentTarget.setPointerCapture(e.pointerId);
    const pojok = pojokLapis(e);
    const p = titikLapis(e, pojok);
    // Diukur dari posisi asli, bukan posisi jepit: meraih pegangan yang
    // terjepit di tepi tidak meloncatkan nilai ke tepi bidang.
    const a = kini.current.asli;
    seret.current = {
      id: e.pointerId,
      geser: { x: a.x - p.x, y: a.y - p.y },
      awal: { x: a.x, y: a.y },
      lapis: pojok,
    };
    setAktif(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = seret.current;
    if (!g || g.id !== e.pointerId) return;
    const { spec: s, map: m } = kini.current;
    const q = titikSeret(titikLapis(e, g.lapis), g.geser, g.awal, s.axis);
    const hasil =
      s.axis === "xy"
        ? snapSeret(s.toValue(q.x, q.y, m), s.param)
        : snapSeret(s.toValue(q.x, q.y, m), s.param);
    setPotong(hasil.clamped ? hasil.value : null);
    ubah(hasil.value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const s = kini.current.spec;
    const baru =
      s.axis === "xy"
        ? tombolKeNilai(e.key, e.shiftKey, s.value, s.param)
        : tombolKeNilai(e.key, e.shiftKey, s.value, s.param);
    if (baru === null) return;
    e.preventDefault();
    setPotong(null);
    ubah(baru);
  };

  const p1 = spec.axis === "xy" ? spec.param[0] : spec.param;
  const now = spec.axis === "xy" ? spec.value[0] : spec.value;
  const garis = spec.tint ?? "var(--color-ink)";
  const kursor = spec.axis === "x" ? "ew-resize" : spec.axis === "y" ? "ns-resize" : "move";

  // Penanda potong: di atas pegangan, atau di bawahnya bila terlalu dekat
  // tepi atas bidang gambar; rata kiri/kanan bila dekat tepi samping.
  const f = map.frame;
  const bawah = at.y - f.y0 < 34;
  const geserX =
    at.x > f.x1 - 72 ? "-100%" : at.x < f.x0 + 72 ? "0%" : "-50%";
  const xPenanda = geserX === "-100%" ? at.x + 8 : geserX === "0%" ? at.x - 8 : at.x;
  const yPenanda = bawah ? at.y + 14 : at.y - 14;

  return (
    <>
      <div
        role="slider"
        tabIndex={0}
        aria-label={spec.label}
        aria-valuemin={p1.min}
        aria-valuemax={p1.max}
        aria-valuenow={now}
        aria-valuetext={teksNilai(spec, spec.value)}
        aria-orientation={
          spec.axis === "x" ? "horizontal" : spec.axis === "y" ? "vertical" : undefined
        }
        data-handle={spec.id}
        data-dragging={aktif || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={selesai}
        onPointerCancel={selesai}
        onLostPointerCapture={selesai}
        onKeyDown={onKeyDown}
        className="group pointer-events-auto absolute left-0 top-0 select-none outline-none"
        style={{
          width: R * 2,
          height: R * 2,
          transform: `translate(${at.x - R}px, ${at.y - R}px)`,
          touchAction: "none",
          cursor: kursor,
          // :focus-visible global di globals.css berada di luar layer dan
          // mengalahkan outline-none Tailwind; cincin sendiri ada di SVG.
          outline: "none",
        }}
      >
        <svg
          aria-hidden="true"
          width={R * 2}
          height={R * 2}
          viewBox={`0 0 ${R * 2} ${R * 2}`}
          className="pointer-events-none block overflow-visible"
        >
          {/* Cincin fokus: hanya saat dipilih dengan keyboard. */}
          <circle
            cx={R}
            cy={R}
            r={10}
            fill="none"
            stroke="var(--color-water)"
            strokeWidth={W.bold}
            className="opacity-0 group-focus-visible:opacity-100"
          />
          {/* Arah seret: tanda panah kecil hanya pada sumbu yang bisa digeser. */}
          <g
            fill="none"
            stroke="var(--color-ink-3)"
            strokeWidth={W.thin}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {spec.axis !== "y" && (
              <path d={`M${R - 13} ${R - 3}l-3 3 3 3M${R + 13} ${R - 3}l3 3-3 3`} />
            )}
            {spec.axis !== "x" && (
              <path d={`M${R - 3} ${R - 13}l3 -3 3 3M${R - 3} ${R + 13}l3 3 3 -3`} />
            )}
          </g>
          <circle
            cx={R}
            cy={R}
            r={spec.hollow ? 8 : 6}
            fill={spec.hollow ? "none" : "var(--color-sheet)"}
            stroke={garis}
            strokeWidth={W.thin}
          />
          {/* Titik tengah: menyala saat disentuh, diseret, atau difokus. */}
          <circle
            cx={R}
            cy={R}
            r={2}
            fill={garis}
            className={`transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${
              aktif ? "opacity-100" : "opacity-0"
            }`}
          />
        </svg>
      </div>
      <span
        role="status"
        className="pointer-events-none absolute left-0 top-0"
        style={{
          transform: `translate(${xPenanda}px, ${yPenanda}px) translate(${geserX}, ${bawah ? "0%" : "-100%"})`,
        }}
      >
        {aktif && potong !== null && (
          <span className="label block whitespace-nowrap border border-rule bg-sheet px-1 text-[0.68rem] leading-tight text-ink-2">
            {t.inClampedTo} {teksNilai(spec, potong)}
          </span>
        )}
      </span>
    </>
  );
}

/**
 * Lapis pegangan seret. Taruh di dalam Sheet sesudah kanvas:
 *
 *   const plate = usePlate(draw, motion, deps);
 *   <Sheet ...>
 *     <canvas ref={plate.ref} className="block h-full w-full" />
 *     <canvas ref={plate.motionRef} />
 *     <DragLayer out={plate.outRef.current} handles={[...]} />
 *   </Sheet>
 *
 * `out` dibaca ulang tiap render; usePlate menaikkan `version` setiap lapis
 * statis digambar ulang, jadi pemanggil ikut dirender dan pegangan pindah.
 */
export function DragLayer({
  out,
  handles,
  touch,
}: {
  out: PlateOut | null;
  handles: HandleSpec[];
  /** Pemadam tanda contoh dari lembar (useTouch di Block masukan). */
  touch?: () => void;
}) {
  if (!out) return null;
  const anchors = out.anchors ?? {};
  // Nilai ekstrem bisa membawa titik (garis energi, puncak, pintu terbuka
  // lebar) keluar sumbu. Pegangan dijepit ke tepi bidang plot terdekat,
  // bukan dihilangkan: seret tidak putus dan fokus keyboard tidak hilang.
  const frames = [out.map.frame, ...Object.values(out.maps ?? {}).map((m) => m.frame)];
  const jepit = (p: PlateAnchor): PlateAnchor => {
    let best = p;
    let jarak = Infinity;
    for (const f of frames) {
      const x = Math.min(Math.max(p.x, f.x0), f.x1);
      const y = Math.min(Math.max(p.y, f.y0), f.y1);
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < jarak) {
        jarak = d;
        best = { x, y };
      }
    }
    return best;
  };
  return (
    <div className="pointer-events-none absolute inset-0">
      {handles.map((h) => {
        const at = anchors[h.anchor];
        if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return null;
        return <Pegangan key={h.id} spec={h} at={jepit(at)} asli={at} map={out.map} touchLembar={touch} />;
      })}
    </div>
  );
}
