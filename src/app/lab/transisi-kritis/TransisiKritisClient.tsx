"use client";

import { TransitionSheet } from "@/components/TransitionSheet";
import { Term } from "@/components/ui";
import { C } from "@/lib/theme";
import type { Lang } from "@/lib/i18n";

const TXT = {
  id: {
    title: "Transisi kritis",
    sheetTitle: "Batas tersendat, penyempitan dan kenaikan dasar bersamaan",
    dQ: "Debit",
    db1: "Lebar hulu",
    dy1: "Kedalaman hulu",
    db2: "Lebar hilir",
    ddz: "Kenaikan dasar",
    note: "Lembar ini menggabungkan penyempitan dan kenaikan dasar karena keduanya bekerja pada besaran yang sama, yaitu energi spesifik yang tersisa di penampang hilir. Kenaikan dasar mengurangi energi yang tersedia, penyempitan menaikkan energi minimum yang dibutuhkan, dan aliran tersendat begitu keduanya bertemu. Kedua batas, kenaikan dasar terbesar dan lebar tersempit, dihitung dari persamaan yang sama.",
  },
  en: {
    title: "Critical transition",
    sheetTitle: "Choking limit, contraction and bed rise together",
    dQ: "Discharge",
    db1: "Upstream width",
    dy1: "Upstream depth",
    db2: "Downstream width",
    ddz: "Bed rise",
    note: "This sheet combines contraction and bed rise because both act on the same quantity, the specific energy left at the downstream section. A bed rise reduces the energy available, a contraction raises the minimum energy required, and the flow chokes as soon as the two meet. Both limits, the maximum bed rise and the narrowest width, come from the same equation.",
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

export function TransisiKritisClient() {
  return (
    <TransitionSheet
      sheet="OC-04"
      mode="critical"
      txt={TXT}
      refs={REFS}
      awal={{ Q: 12, b1: 5, y1: 1.5, b2: 4.2, dz: 0.12 }}
      intro={(lang: Lang) =>
        lang === "id" ? (
          <p>
            Aliran melewati <Term tint={C.critical}>kondisi kritis</Term> tepat
            saat energi yang tersedia habis terpakai. Di sinilah kedua batasnya
            bertemu: kenaikan dasar terbesar dan lebar tersempit adalah dua cara
            memandang persamaan yang sama.
          </p>
        ) : (
          <p>
            Flow passes through <Term tint={C.critical}>critical</Term> exactly
            when the available energy is entirely used up. This is where both
            limits meet: the maximum bed rise and the narrowest width are two
            ways of reading the same equation.
          </p>
        )
      }
    />
  );
}
