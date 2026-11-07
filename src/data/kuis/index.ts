/**
 * Semua bank kuis menurut kode lembar. Bank baru cukup didaftarkan di sini
 * supaya ikut diuji kuis.test.ts (1000 benih per bank).
 */
import type { BankKuis } from "../../lib/kuis.ts";
import { FF05 } from "./ff05.ts";
import { OC01 } from "./oc01.ts";

export const BANK_KUIS: Record<string, BankKuis> = {
  "FF-05": FF05,
  "OC-01": OC01,
};
