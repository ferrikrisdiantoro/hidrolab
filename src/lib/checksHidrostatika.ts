import type { Check } from "./verify.ts";
import { G } from "./hydraulics.ts";
import {
  hydrostaticPressure,
  inclinedRectangle,
  planeSurfaceForce,
  rectangleSection,
} from "./hidrostatika.ts";

/** Tekanan atmosfer baku di muka laut, Pa (ISO 2533). */
export const P_ATM = 101325;

const deg = (d: number) => (d * Math.PI) / 180;

/**
 * Integrasi numerik tekanan ukur sepanjang bagian basah pintu persegi
 * panjang miring: gaya dan kedalaman titik tangkapnya. Jalur kedua yang
 * tidak memakai rumus pusat tekanan sama sekali, hanya p = rho g d per pias.
 */
function integrasiPintu(
  b: number,
  L: number,
  top: number,
  angle: number,
  rho: number,
  N = 2000
): { force: number; depthCP: number } {
  const s = Math.sin(angle);
  const atas = Math.max(top, 0);
  /* Panjang basah: bagian di atas muka zat cair tidak ditekan zat cair. */
  const kering = top < 0 ? (s > 0 ? -top / s : L) : 0;
  const Lw = Math.max(L - kering, 0);
  if (Lw <= 0 || !(b > 0)) return { force: 0, depthCP: 0 };
  const ds = Lw / N;
  let F = 0;
  let M = 0;
  for (let i = 0; i < N; i++) {
    const d = atas + (i + 0.5) * ds * s;
    const dF = rho * G * d * b * ds;
    F += dF;
    M += dF * d;
  }
  return { force: F, depthCP: F > 0 ? M / F : 0 };
}

/**
 * Pemeriksaan FF-08 tekanan hidrostatis.
 *
 * Contoh terbitan: soal FE autarkaw (Fluids X-9) dan Crowe, Elementary
 * Fluid Mechanics, contoh 3.78 (salindia McKinney CE 319F, UT Austin),
 * sama dengan uji model M12 (hidrostatika.test.ts). Sisanya dihitung pada
 * masukan lembar saat ini, jadi ikut bergerak bersama penggeser.
 */
export function checksHidrostatika(
  rho: number,
  b: number,
  L: number,
  top: number,
  /** Sudut pintu terhadap muka zat cair, radian */
  angle: number,
  /** Kedalaman probe, m */
  depth: number,
  /** Tekanan di muka zat cair, Pa (0 = ukur) */
  pa: number
): Check[] {
  const fe = inclinedRectangle(1, 1, 0, deg(90), 1000, 9.8);
  const crowe = inclinedRectangle(4, 6, 3, deg(60), 1000, 9.81);
  const r = inclinedRectangle(b, L, top, angle, rho);
  const num = integrasiPintu(b, L, top, angle, rho);
  const tegak = inclinedRectangle(b, L, 0, Math.PI / 2, rho);
  const p = hydrostaticPressure(depth, rho, G, pa);
  const A = b * r.wettedLength;
  const mutlak =
    r.wettedLength > 0
      ? planeSurfaceForce(rectangleSection(b, r.wettedLength), r.depthCG, angle, rho, G, P_ATM)
      : { force: 0 };

  return [
    {
      label: {
        id: "Pintu tegak 1 × 1 m, tepi atas di muka air, g 9,8: gaya 4900 N",
        en: "Vertical 1 × 1 m gate, top edge at the surface, g 9.8: force 4900 N",
      },
      source: "Soal FE autarkaw, Fluids X-9 (pintu tegak, F = rho g hc A)",
      kind: "terbitan",
      expected: 4900,
      actual: fe.force,
      tol: 1e-9,
      unit: "N",
      digits: 1,
    },
    {
      label: {
        id: "Pintu 4 × 6 m miring 60 derajat, tepi atas 3 m: gaya 1 318 kN",
        en: "4 × 6 m gate inclined at 60 degrees, top edge at 3 m: force 1318 kN",
      },
      source: "Crowe, Elementary Fluid Mechanics, contoh 3.78 (salindia McKinney CE 319F)",
      kind: "terbitan",
      expected: 1.318e6,
      actual: crowe.force,
      tol: 1e-3,
      tolReason: {
        id: "Salindia membulatkan gaya ke ribuan newton.",
        en: "The slides round the force to thousands of newtons.",
      },
      unit: "N",
      digits: 0,
    },
    {
      label: {
        id: "Pintu yang sama: pusat tekanan 0,4641 m di bawah titik berat, diukur sepanjang pintu",
        en: "Same gate: centre of pressure 0.4641 m below the centroid, measured along the gate",
      },
      source: "Crowe, Elementary Fluid Mechanics, contoh 3.78 (salindia McKinney CE 319F)",
      kind: "terbitan",
      expected: 0.4641,
      actual: -crowe.yCP,
      tol: 2e-4,
      unit: "m",
      digits: 4,
    },
    {
      label: {
        id: "Gaya pada pintu ini sama dengan jumlah tekanan per pias sepanjang bagian basahnya",
        en: "The force on this gate equals the sum of pressure over strips along its wetted part",
      },
      source: "Integrasi numerik p = rho g d pada 2000 pias, tanpa rumus F = rho g hc A",
      kind: "silang",
      expected: num.force,
      actual: r.force,
      tol: 1e-6,
      absTol: 1e-6,
      unit: "N",
      digits: 1,
    },
    {
      label: {
        id: "Pusat tekanan pintu ini sama dengan titik tangkap momen tekanan per pias",
        en: "The centre of pressure of this gate matches the moment of the strip pressures",
      },
      source: "Integrasi numerik momen p d pada 2000 pias, tanpa rumus Ixx",
      kind: "silang",
      expected: num.depthCP,
      actual: r.wettedLength > 0 ? r.depthCP : 0,
      tol: 1e-6,
      absTol: 1e-9,
      unit: "m",
      digits: 4,
    },
    {
      label: {
        id: "Pintu tegak dari muka air: pusat tekanan di dua pertiga tingginya",
        en: "Vertical gate from the surface: centre of pressure at two thirds of its height",
      },
      source: "Sebaran tekanan segitiga, titik berat segitiga di 2/3 tinggi (White, bab 2)",
      kind: "sifat",
      expected: (2 * L) / 3,
      actual: tegak.depthCP,
      tol: 1e-9,
      unit: "m",
      digits: 4,
    },
    {
      label: {
        id: "Bacaan probe dibalik menjadi kedalaman mengembalikan letak probe",
        en: "The probe reading turned back into depth returns the probe position",
      },
      source: "h = (p − pa) / (rho g), kebalikan p = pa + rho g h",
      kind: "pulang-pergi",
      expected: depth,
      actual: (p - pa) / (rho * G),
      tol: 1e-9,
      absTol: 1e-9,
      unit: "m",
      digits: 4,
    },
    {
      label: {
        id: "Gaya tekanan mutlak dikurangi atmosfer di sisi udara sama dengan gaya tekanan ukur",
        en: "Absolute pressure force minus the atmosphere on the air side equals the gauge force",
      },
      source: "M12 dengan pa = 101 325 Pa dikurangi pa A, dibanding M12 dengan pa = 0",
      kind: "silang",
      expected: r.force,
      actual: mutlak.force - P_ATM * A,
      tol: 1e-9,
      absTol: 1e-6,
      unit: "N",
      digits: 1,
    },
  ];
}
