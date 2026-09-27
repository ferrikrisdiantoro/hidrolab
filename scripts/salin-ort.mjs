/*
 * Menyalin runtime WebAssembly ONNX ke public/ort sebelum dev dan build.
 *
 * Lembar HY-06 menjalankan model ONNX dari cl42 di peramban. Runtimenya
 * dilayani dari domain HidroLab sendiri, bukan dari CDN luar, supaya lembar
 * itu tetap jalan tanpa bergantung pada layanan pihak ketiga. Berkasnya
 * 12 MB, jadi tidak dimasukkan ke git: disalin dari node_modules setiap
 * kali, dan public/ort ada di .gitignore.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const akar = join(dirname(fileURLToPath(import.meta.url)), "..");
const dari = join(akar, "node_modules", "onnxruntime-web", "dist");
const ke = join(akar, "public", "ort");
mkdirSync(ke, { recursive: true });
for (const f of ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"]) copyFileSync(join(dari, f), join(ke, f));
console.log("runtime ONNX disalin ke public/ort");
