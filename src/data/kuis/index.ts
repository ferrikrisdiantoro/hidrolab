/**
 * Semua bank kuis menurut kode lembar. Bank baru cukup didaftarkan di sini
 * supaya ikut diuji kuis.test.ts (1000 benih per bank).
 */
import type { BankKuis } from "../../lib/kuis.ts";
import { FF05 } from "./ff05.ts";
import { FF07 } from "./ff07.ts";
import { FP03 } from "./fp03.ts";
import { OC01 } from "./oc01.ts";
import { OC03 } from "./oc03.ts";
import { OC05 } from "./oc05.ts";
import { FF01 } from "./ff01.ts";
import { HY04 } from "./hy04.ts";
import { HY05 } from "./hy05.ts";

export const BANK_KUIS: Record<string, BankKuis> = {
  "FF-05": FF05,
  "FF-07": FF07,
  "FP-03": FP03,
  "OC-01": OC01,
  "OC-03": OC03,
  "OC-05": OC05,
  "FF-01": FF01,
  "HY-04": HY04,
  "HY-05": HY05,
};
