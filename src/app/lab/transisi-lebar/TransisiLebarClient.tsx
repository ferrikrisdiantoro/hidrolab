"use client";

import { TransitionSheet } from "@/components/TransitionSheet";
import { Term } from "@/components/ui";
import { C } from "@/lib/theme";
import type { Lang } from "@/lib/i18n";

const TXT = {
  id: {
    title: "Transisi lebar",
    sheetTitle: "Penyempitan saluran, penampang persegi",
    dQ: "Debit",
    db1: "Lebar hulu",
    dy1: "Kedalaman hulu",
    db2: "Lebar hilir",
    ddz: "Kenaikan dasar",
    note: "Penyempitan menaikkan debit satuan tanpa mengubah energi yang tersedia, sehingga kurva energinya bergeser ke kanan sementara garis energinya tetap. Itulah sebabnya lembar ini menggambar dua kurva sekaligus: satu untuk debit satuan hulu, satu untuk hilir. Titik operasinya berpindah dari kurva pertama ke kurva kedua pada garis energi yang sama.",
  },
  en: {
    title: "Width transition",
    sheetTitle: "Channel contraction, rectangular section",
    dQ: "Discharge",
    db1: "Upstream width",
    dy1: "Upstream depth",
    db2: "Downstream width",
    ddz: "Bed rise",
    note: "A contraction raises the unit discharge without changing the available energy, so the energy curve shifts right while the energy line stays put. That is why this sheet draws two curves at once: one for the upstream unit discharge and one for the downstream. The operating point moves from the first curve to the second along the same energy line.",
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

export function TransisiLebarClient() {
  return (
    <TransitionSheet
      sheet="OC-05"
      mode="width"
      txt={TXT}
      refs={REFS}
      awal={{ Q: 12, b1: 5, y1: 1.5, b2: 4.2, dz: 0 }}
      intro={(lang: Lang) =>
        lang === "id" ? (
          <p>
            Menyempitkan saluran menaikkan{" "}
            <Term tint={C.water}>debit satuan</Term> tanpa menambah energi. Pada
            aliran subkritis muka air turun, dan ada satu lebar tersempit yang
            masih dapat dilewati. Di bawah itu aliran{" "}
            <Term tint={C.signal}>tersendat</Term>.
          </p>
        ) : (
          <p>
            Narrowing a channel raises the{" "}
            <Term tint={C.water}>unit discharge</Term> without adding energy. In
            subcritical flow the surface drops, and there is one narrowest width
            that can still pass the flow. Below it the flow becomes{" "}
            <Term tint={C.signal}>choked</Term>.
          </p>
        )
      }
    />
  );
}
