import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as ort from "onnxruntime-web";

import {
  HARI,
  gaps,
  mvTabularFeatures,
  oneStep,
  parseDate,
  predictNext,
  recursive,
  score,
  uvTabularFeatures,
  type ModelKey,
  type Runner,
  type Series,
} from "./forecast.ts";

const SAMPEL = JSON.parse(readFileSync(new URL("./forecastSamples.json", import.meta.url), "utf8"));
const UV = SAMPEL.skaler.uv;
const MV = SAMPEL.skaler.mv;

ort.env.wasm.numThreads = 1;
ort.env.logLevel = "error";
const sesi = new Map<string, ort.InferenceSession>();
const run: Runner = async (file, input, dims) => {
  if (!sesi.has(file))
    sesi.set(
      file,
      await ort.InferenceSession.create(readFileSync(new URL(`../../public/models/model_${file}.onnx`, import.meta.url)))
    );
  const s = sesi.get(file)!;
  const r = await s.run({ [s.inputNames[0]]: new ort.Tensor("float32", input, dims) });
  return (r[s.outputNames[0]].data as Float32Array)[0];
};

const seriUV: Series = { t: SAMPEL.uv.tanggal.map(parseDate), rain: SAMPEL.uv.hujan };
const seriMV: Series = { t: SAMPEL.mv.tanggal.map(parseDate), rain: SAMPEL.mv.hujan, wl: SAMPEL.mv.tma };

const dekat = (a: number, b: number, tol: number, pesan: string) =>
  assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${pesan}: ${a} bukan ${b}`);

describe("HY-06 fitur sama dengan pandas", () => {
  it("univariat, sembilan fitur, termasuk simpangan baku pembagi n − 1", () => {
    const f = uvTabularFeatures(seriUV.rain, parseDate(SAMPEL.uv.acuan.tanggal));
    SAMPEL.uv.acuan.fitur.forEach((v: number, i: number) => dekat(f[i], v, 1e-12, `fitur ${i}`));
  });
  it("multivariat, empat belas fitur", () => {
    const f = mvTabularFeatures(seriMV.rain, seriMV.wl!);
    SAMPEL.mv.acuan.fitur.forEach((v: number, i: number) => dekat(f[i], v, 1e-12, `fitur ${i}`));
  });
  it("data contoh univariat harian berurutan, tanpa celah", () => {
    assert.equal(gaps(seriUV.t), 0);
  });
});

describe("HY-06 keluaran ONNX di JavaScript sama dengan onnxruntime Python", () => {
  for (const k of ["gbr", "xgb", "lstm", "bilstm"] as ModelKey[])
    it(k, async () => {
      const acuan = Math.max(0, SAMPEL.uv.acuan[k]);
      dekat(await predictNext(k, seriUV, UV, MV, run), acuan, 1e-5, k);
    });
  for (const k of ["gbr_mv", "xgb_mv", "lstm_mv", "bilstm_mv"] as ModelKey[])
    it(k, async () => {
      const acuan = Math.max(0, SAMPEL.mv.acuan[k]);
      dekat(await predictNext(k, seriMV, UV, MV, run), acuan, 1e-5, k);
    });
});

describe("HY-06 ramalan berantai dan ukuran ketelitian", () => {
  it("langkah pertama ramalan berantai sama dengan ramalan satu langkah", async () => {
    const r = await recursive("lstm", seriUV, 5, UV, MV, run);
    assert.equal(r.length, 5);
    dekat(r[0], await predictNext("lstm", seriUV, UV, MV, run), 1e-12, "langkah 1");
    assert.ok(r.every((v) => v >= 0));
  });
  it("uji satu langkah hanya melihat masa lalu tiap titik", async () => {
    const p = await oneStep("lstm", seriUV, seriUV.t.length - 3, UV, MV, run);
    const potong: Series = { t: seriUV.t.slice(0, -1), rain: seriUV.rain.slice(0, -1) };
    dekat(p[2], await predictNext("lstm", potong, UV, MV, run), 1e-12, "titik terakhir");
  });
  it("NSE nol untuk tebakan rata-rata, AUC setengah untuk ramalan tetap", () => {
    const y = [0, 3, 0.5, 4, 2, 0, 6];
    const m = y.reduce((a, b) => a + b) / y.length;
    const s = score(y, y.map(() => m));
    dekat(s.nse, 0, 1e-12, "NSE");
    dekat(s.auc!, 0.5, 1e-12, "AUC");
    assert.equal(score(y, y).nse, 1);
    assert.equal(score(y, y).auc, 1);
  });
  it("tanggal dibaca dalam UTC dan tanggal mustahil ditolak", () => {
    assert.equal(parseDate("2020-12-01") + HARI, parseDate("2020-12-02"));
    assert.ok(Number.isNaN(parseDate("2021-02-30")));
    assert.ok(Number.isNaN(parseDate("01/12/2020")));
  });
});

import { arimaAcuan, checksForecast } from "./checksForecast.ts";
import { evaluate } from "./verify.ts";

describe("Blok verifikasi HY-06 lolos untuk setiap model", () => {
  const ACUAN_ARIMA = JSON.parse(readFileSync(new URL("./arimaReference.json", import.meta.url), "utf8"));
  const a101 = arimaAcuan(ACUAN_ARIMA);
  for (const [mode, k] of [
    ["uv", "lstm"], ["uv", "gbr"], ["uv", "hybrid"], ["mv", "lstm_mv"], ["mv", "xgb_mv"],
  ] as const)
    it(`${mode} ${k}`, async () => {
      const s = mode === "uv" ? seriUV : seriMV;
      const n = s.t.length;
      const dari = n - Math.round(n * 0.2);
      const p = await oneStep(k, s, dari, UV, MV, run);
      const y = s.rain.slice(dari);
      const yP = s.rain.slice(dari - 1, n - 1);
      const ac = mode === "uv" ? SAMPEL.uv.acuan : SAMPEL.mv.acuan;
      const acuan = k === "hybrid" ? 0.6 * Math.max(0, ac.xgb) + 0.4 * Math.max(0, ac.lstm) : Math.max(0, ac[k]);
      const cs = checksForecast({
        mode,
        samples: SAMPEL,
        arimaRef: ACUAN_ARIMA,
        onnxJs: { model: k, nilai: await predictNext(k, s, UV, MV, run), acuan },
        uji: { y, p, skor: score(y, p), persistensi: score(y, yP), yPersist: yP },
        ramalan: await recursive(k, s, 7, UV, MV, run),
        arima101: a101,
      });
      assert.ok(cs.length >= 5);
      for (const c of cs) assert.ok(evaluate(c).pass, `${c.label.id}: acuan ${c.expected}, hitungan ${c.actual}`);
    });
});
