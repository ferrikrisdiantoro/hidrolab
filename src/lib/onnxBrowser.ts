"use client";

import type { Runner } from "./forecast";

/**
 * Menjalankan model ONNX di peramban untuk HY-06.
 *
 * Pustakanya dimuat hanya ketika lembar ini pertama kali meramal, jadi
 * tujuh puluh lembar lain tidak ikut menanggung runtime 12 MB-nya. Berkas
 * WebAssembly dilayani dari /ort/ di domain HidroLab sendiri (disalin
 * scripts/salin-ort.mjs), bukan dari CDN.
 *
 * Sesi disimpan setelah dibuat, dan setiap pemanggilan diantrekan satu per
 * satu. cl42 mematikan penyimpanan sesi karena galat "Session already
 * started", yang muncul bila dua pemanggilan berjalan bersamaan pada satu
 * sesi; antrean menghapus sebabnya tanpa membuat ulang sesi di setiap hari
 * yang diramal.
 */

type Ort = typeof import("onnxruntime-web/wasm");

let ortJanji: Promise<Ort> | null = null;
const sesi = new Map<string, Promise<import("onnxruntime-web/wasm").InferenceSession>>();
let antrean: Promise<unknown> = Promise.resolve();

function muatOrt(): Promise<Ort> {
  if (!ortJanji)
    ortJanji = import("onnxruntime-web/wasm").then((ort) => {
      ort.env.wasm.wasmPaths = "/ort/";
      ort.env.wasm.numThreads = 1;
      ort.env.logLevel = "error";
      return ort;
    });
  return ortJanji;
}

export const browserRunner: Runner = (file, input, dims) => {
  const kerja = antrean.then(async () => {
    const ort = await muatOrt();
    if (!sesi.has(file))
      sesi.set(file, ort.InferenceSession.create(`/models/model_${file}.onnx`, { executionProviders: ["wasm"] }));
    const s = await sesi.get(file)!;
    const r = await s.run({ [s.inputNames[0]]: new ort.Tensor("float32", input, dims) });
    return (r[s.outputNames[0]].data as Float32Array)[0];
  });
  antrean = kerja.catch(() => undefined);
  return kerja;
};
