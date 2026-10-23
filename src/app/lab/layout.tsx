import type { ReactNode } from "react";
import { ResetScope } from "@/components/ResetScope";

/*
 * Lingkup reset untuk semua lembar. Layout ini komponen server tanpa
 * metadata sendiri, jadi metadata tiap page.tsx tetap berlaku dan lembar
 * tetap dibangun statis; ResetScope hanya pembungkus klien.
 */
export default function LabLayout({ children }: { children: ReactNode }) {
  return <ResetScope>{children}</ResetScope>;
}
