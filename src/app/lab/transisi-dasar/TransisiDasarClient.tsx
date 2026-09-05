"use client";

import { TransitionSheet } from "@/components/TransitionSheet";
import { Term } from "@/components/ui";
import { C } from "@/lib/theme";
import type { Lang } from "@/lib/i18n";

const TXT = {
  id: {
    title: "Transisi elevasi dasar",
    sheetTitle: "Ambang di dasar saluran, penampang persegi",
    dQ: "Debit",
    db1: "Lebar dasar",
    dy1: "Kedalaman hulu",
    db2: "Lebar hilir",
    ddz: "Kenaikan dasar",
    note: "Gesekan pada bentang transisi diabaikan, sebagaimana lazimnya pada perhitungan transisi pendek, sehingga garis energi digambar mendatar. Yang berlaku hanya kekekalan energi spesifik dikurangi kenaikan dasar. Kedalaman hilir dicari dari energi yang tersedia dengan metode bagi dua, dan cabang yang dipakai ditentukan oleh keadaan aliran masuknya: aliran tidak dapat berpindah dari cabang subkritis ke superkritis tanpa melewati kondisi kritis lebih dulu.",
  },
  en: {
    title: "Bed-level transition",
    sheetTitle: "Bed step in a channel, rectangular section",
    dQ: "Discharge",
    db1: "Bed width",
    dy1: "Upstream depth",
    db2: "Downstream width",
    ddz: "Bed rise",
    note: "Friction over the transition reach is neglected, as is usual for short transitions, so the energy line is drawn horizontal. Only specific energy less the bed rise applies. Downstream depth is solved from the available energy by bisection, and the branch used is set by the incoming flow: flow cannot move from the subcritical branch to the supercritical one without passing through critical first.",
  },
} as const;

const REFS = {
  id: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Bab 3, Energy and Momentum Principles.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Bab 2.",
    "Sturm, T.W. (2010). Open Channel Hydraulics, edisi ke-2. McGraw-Hill.",
    "USGS (1988). Basic Hydraulic Principles of Open-Channel Flow, Open-File Report 88-707.",
  ],
  en: [
    "Chow, V.T. (1959). Open-Channel Hydraulics. McGraw-Hill. Chapter 3, Energy and Momentum Principles.",
    "Henderson, F.M. (1966). Open Channel Flow. Macmillan. Chapter 2.",
    "Sturm, T.W. (2010). Open Channel Hydraulics, 2nd ed. McGraw-Hill.",
    "USGS (1988). Basic Hydraulic Principles of Open-Channel Flow, Open-File Report 88-707.",
  ],
} as const;

export function TransisiDasarClient() {
  return (
    <TransitionSheet
      sheet="OC-07"
      mode="step"
      txt={TXT}
      refs={REFS}
      awal={{ Q: 12, b1: 5, y1: 1.5, b2: 5, dz: 0.15 }}
      intro={(lang: Lang) =>
        lang === "id" ? (
          <p>
            Ambang di dasar saluran mengambil sebagian{" "}
            <Term tint={C.energy}>energi</Term> yang tersedia di hilir. Pada
            aliran subkritis, muka air justru turun saat melewatinya. Kalau
            ambangnya terlalu tinggi, energinya tidak lagi cukup dan aliran
            menjadi <Term tint={C.signal}>tersendat</Term>.
          </p>
        ) : (
          <p>
            A step in the bed takes part of the{" "}
            <Term tint={C.energy}>energy</Term> available downstream. In
            subcritical flow the water surface actually drops as it passes over.
            If the step is too high the energy no longer suffices and the flow
            becomes <Term tint={C.signal}>choked</Term>.
          </p>
        )
      }
    />
  );
}
