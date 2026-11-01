import type { PlateMap, PlateOut, PlateRect } from "./plateOut.ts";

/**
 * Menggeser keluaran penggambar yang digambar di dalam panel.
 *
 * Lembar berpanel dua (FF-04 busur garis arus di samping diagram tekanan,
 * EH-06 peta habitat di bawah lengkung luas layak) menggambar tiap panel
 * dengan `ctx.translate(dx, dy)`, jadi penggambar panelnya mengembalikan
 * koordinat piksel terhadap pojok PANEL. Pegangan seret membaca piksel
 * terhadap pojok KANVAS, jadi semuanya digeser sebesar letak panelnya.
 * Nilai fisik tidak berubah: X, Y, invX, invY tetap fungsi yang sama,
 * hanya ditambah atau dikurangi geseran pikselnya.
 */
export function shiftMap(m: PlateMap, dx: number, dy: number): PlateMap {
  return {
    X: (v) => m.X(v) + dx,
    Y: (v) => m.Y(v) + dy,
    invX: (px) => m.invX(px - dx),
    invY: (py) => m.invY(py - dy),
    frame: { x0: m.frame.x0 + dx, y0: m.frame.y0 + dy, x1: m.frame.x1 + dx, y1: m.frame.y1 + dy },
  };
}

function shiftPoly(p: ArrayLike<number>, dx: number, dy: number): Float64Array {
  const out = new Float64Array(p.length);
  for (let i = 0; i < p.length; i++) out[i] = p[i] + (i % 2 === 0 ? dx : dy);
  return out;
}

export function shiftPlateOut(o: PlateOut, dx: number, dy: number): PlateOut {
  const anchors: Record<string, { x: number; y: number }> = {};
  for (const k in o.anchors ?? {}) {
    const a = (o.anchors as Record<string, { x: number; y: number }>)[k];
    anchors[k] = { x: a.x + dx, y: a.y + dy };
  }
  const maps: Record<string, PlateMap> = {};
  for (const k in o.maps ?? {}) maps[k] = shiftMap((o.maps as Record<string, PlateMap>)[k], dx, dy);
  const labels: PlateRect[] | undefined = o.labels?.map((r) => ({ ...r, x: r.x + dx, y: r.y + dy }));
  return {
    map: shiftMap(o.map, dx, dy),
    anchors,
    water: o.water ? shiftPoly(o.water, dx, dy) : undefined,
    waters: o.waters?.map((w) => shiftPoly(w, dx, dy)),
    labels,
    maps: o.maps ? maps : undefined,
  };
}
