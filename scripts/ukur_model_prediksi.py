"""
Pengukuran ulang model prediksi cl42 untuk lembar HY-06.

Menjalankan berkas ONNX yang dipakai halaman ini pada data uji kedua
notebook pelatihan cl42, dengan fitur yang disusun PERSIS seperti peramban
menyusunnya (bukan seperti notebook menyusunnya saat melatih). Hasilnya
ditulis ke src/lib/forecastMetrics.json dan dibaca lembar HY-06.

Replikasi diperiksa dulu terhadap angka notebook: GBR univariat dengan
fitur seperti saat dilatih harus memberi MAE 0,286 dan LSTM 0,457.

Pemakaian (dari folder demo-hidrolab):
    python scripts/ukur_model_prediksi.py <folder webapp cl42> <folder data Catalonia>

Butuh numpy, pandas, openpyxl, onnxruntime.
"""

import json
import os
import sys

import numpy as np
import onnxruntime as ort
import pandas as pd

CL42 = sys.argv[1]
CAT = sys.argv[2]
MODELS = os.path.join(CL42, "public", "models")

BULAN = {"Januari": 1, "Februari": 2, "Maret": 3, "April": 4, "Mei": 5, "Juni": 6, "Juli": 7,
         "Agustus": 8, "September": 9, "Oktober": 10, "November": 11, "Desember": 12}


def deret_lengkap(df):
    """Seluruh 12 bulan, dengan nama bulan Indonesia diurai benar."""
    L = df.melt(id_vars=["Tanggal", "Bulan"], var_name="tahun", value_name="hujan")
    L["tahun"] = L["tahun"].astype(int)
    L["bln"] = L["Bulan"].map(BULAN)
    L["tanggal"] = pd.to_datetime(
        dict(year=L["tahun"], month=L["bln"], day=pd.to_numeric(L["Tanggal"], errors="coerce")), errors="coerce"
    )
    return L.dropna(subset=["tanggal", "hujan"]).sort_values("tanggal").reset_index(drop=True)


def metrik(y, p):
    y = np.asarray(y, float)
    p = np.asarray(p, float)
    return {
        "mae": float(np.abs(y - p).mean()),
        "rmse": float(np.sqrt(((y - p) ** 2).mean())),
        "nse": float(1 - ((y - p) ** 2).sum() / ((y - y.mean()) ** 2).sum()),
    }


def jalankan(nama, X):
    s = ort.InferenceSession(os.path.join(MODELS, f"model_{nama}.onnx"))
    return s.run(None, {s.get_inputs()[0].name: X.astype(np.float32)})[0].ravel()


# ------------------------------------------------------------------ #
# Univariat: Regresi-Hujan.xlsx, seperti prediksi_hujan.ipynb
# ------------------------------------------------------------------ #
df = pd.read_excel(os.path.join(CL42, "dataset", "Regresi-Hujan.xlsx"), sheet_name="Data Hjan Harian")
df = df.loc[:, df.columns.notna()]
df.columns = df.iloc[2]
df = df.iloc[3:].reset_index(drop=True)
yc = df.columns[2:]
df[yc] = df[yc].apply(pd.to_numeric, errors="coerce").clip(lower=0)
L = df.melt(id_vars=["Tanggal", "Bulan"], var_name="tahun", value_name="hujan")
L["tahun"] = L["tahun"].astype(int)
L["tanggal"] = pd.to_datetime(
    L["tahun"].astype(str) + "-" + L["Bulan"].astype(str) + "-" + L["Tanggal"].astype(str), errors="coerce"
)
L = L.dropna(subset=["tanggal", "hujan"]).sort_values("tanggal").reset_index(drop=True)

h = L["hujan"]
d = L.copy()
for k in (1, 3, 7):
    d[f"lag_{k}"] = h.shift(k)
# seperti dilatih: rolling TANPA shift, memuat hari yang diramal
d["roll_mean_3"] = h.rolling(3).mean()
d["roll_mean_7"] = h.rolling(7).mean()
d["roll_max_7"] = h.rolling(7).max()
d["roll_std_7"] = h.rolling(7).std()
# seperti peramban HidroLab: tujuh hari terakhir yang diketahui, pembagi n - 1
hs = h.shift(1)
d["b_mean_3"] = hs.rolling(3).mean()
d["b_mean_7"] = hs.rolling(7).mean()
d["b_max_7"] = hs.rolling(7).max()
d["b_std_7"] = hs.rolling(7).std()
d["bulan_idx"] = d["tanggal"].dt.month
d["day_of_week"] = d["tanggal"].dt.dayofweek
d = d.dropna().reset_index(drop=True)

cut = int(round(len(d) * 0.8))
test = d.iloc[cut:].reset_index(drop=True)
y = test["hujan"].values

sp = json.load(open(os.path.join(MODELS, "scaler_params.json")))
mu = np.array(sp["feature_scaler"]["mean"])
sd = np.array(sp["feature_scaler"]["scale"])
tm, ts = sp["target_scaler"]["mean"], sp["target_scaler"]["scale"]

F_latih = ["lag_1", "lag_3", "lag_7", "roll_mean_3", "roll_mean_7", "roll_max_7", "roll_std_7", "bulan_idx", "day_of_week"]
F_pakai = ["lag_1", "lag_3", "lag_7", "b_mean_3", "b_mean_7", "b_max_7", "b_std_7", "bulan_idx", "day_of_week"]

hasil = {"uv": {}, "mv": {}}

gbr_latih = np.maximum(0, jalankan("gbr", (test[F_latih].values - mu) / sd))
assert abs(metrik(y, gbr_latih)["mae"] - 0.286) < 0.001, "replikasi GBR tidak cocok dengan notebook"

pred = {}
for m in ("gbr", "xgb"):
    pred[m] = np.maximum(0, jalankan(m, (test[F_pakai].values - mu) / sd))
    hasil["uv"][m] = metrik(y, pred[m])
    hasil["uv"][m]["seperti_dilatih"] = metrik(y, np.maximum(0, jalankan(m, (test[F_latih].values - mu) / sd)))

# LSTM dan BiLSTM: tujuh hari sebelum setiap hari uji, skaler target
seri = d["hujan"].values
idx = np.arange(cut, len(d))
X_seq = np.stack([(seri[i - 7 : i] - tm) / ts for i in idx])[..., None]
for m in ("lstm", "bilstm"):
    pred[m] = np.maximum(0, jalankan(m, X_seq) * ts + tm)
    hasil["uv"][m] = metrik(y, pred[m])
assert abs(metrik(y, pred["lstm"])["mae"] - 0.457) < 0.002, "replikasi LSTM tidak cocok dengan notebook"

# Hybrid seperti cl42: 0,6 XGB + 0,4 LSTM
hasil["uv"]["hybrid"] = metrik(y, 0.6 * pred["xgb"] + 0.4 * pred["lstm"])
hasil["uv"]["persistensi"] = metrik(y, test["lag_1"].values)
# ------------------------------------------------------------------ #
# Univariat pada data LENGKAP: seluruh 12 bulan, harian berurutan.
#
# Notebook mengurai tanggal dari nama bulan berbahasa Indonesia dengan
# pd.to_datetime, yang hanya mengenal bahasa Inggris, sehingga hanya April,
# September, dan November yang terbaca. Pengguna lembar ini memasukkan data
# harian bulan apa pun, jadi inilah ketelitian yang akan ia alami.
# ------------------------------------------------------------------ #
dfl = pd.read_excel(os.path.join(CL42, "dataset", "Regresi-Hujan.xlsx"), sheet_name="Data Hjan Harian")
dfl = dfl.loc[:, dfl.columns.notna()]
dfl.columns = dfl.iloc[2]
dfl = dfl.iloc[3:].reset_index(drop=True)
dfl[dfl.columns[2:]] = dfl[dfl.columns[2:]].apply(pd.to_numeric, errors="coerce").clip(lower=0)
G = deret_lengkap(dfl)
gh = G["hujan"]
for k in (1, 3, 7):
    G[f"lag_{k}"] = gh.shift(k)
gs = gh.shift(1)
G["b_mean_3"], G["b_mean_7"] = gs.rolling(3).mean(), gs.rolling(7).mean()
G["b_max_7"], G["b_std_7"] = gs.rolling(7).max(), gs.rolling(7).std()
G["bulan_idx"], G["day_of_week"] = G["tanggal"].dt.month, G["tanggal"].dt.dayofweek
G = G.dropna().reset_index(drop=True)
cutG = int(round(len(G) * 0.8))
tG = G.iloc[cutG:].reset_index(drop=True)
yG = tG["hujan"].values
hasil["uv_lengkap"] = {}
pG = {}
for m in ("gbr", "xgb"):
    pG[m] = np.maximum(0, jalankan(m, (tG[F_pakai].values - mu) / sd))
    hasil["uv_lengkap"][m] = metrik(yG, pG[m])
serG = G["hujan"].values
XG = np.stack([(serG[i - 7 : i] - tm) / ts for i in range(cutG, len(G))])[..., None]
for m in ("lstm", "bilstm"):
    pG[m] = np.maximum(0, jalankan(m, XG) * ts + tm)
    hasil["uv_lengkap"][m] = metrik(yG, pG[m])
hasil["uv_lengkap"]["hybrid"] = metrik(yG, 0.6 * pG["xgb"] + 0.4 * pG["lstm"])
hasil["uv_lengkap"]["persistensi"] = metrik(yG, tG["lag_1"].values)
hasil["uv_lengkap"]["_uji"] = {
    "n": int(len(yG)),
    "dari": str(tG["tanggal"].min().date()),
    "sampai": str(tG["tanggal"].max().date()),
    "sumber": "Regresi-Hujan.xlsx, seluruh 12 bulan harian berurutan, 20 persen terakhir",
    "hari_dipakai_notebook": int(len(L)),
    "hari_seharusnya": int(len(deret_lengkap(dfl))),
}

hasil["uv"]["_uji"] = {
    "n": int(len(y)),
    "dari": str(test["tanggal"].min().date()),
    "sampai": str(test["tanggal"].max().date()),
    "sumber": "Regresi-Hujan.xlsx, 20 persen terakhir, seperti prediksi_hujan.ipynb",
}

# ------------------------------------------------------------------ #
# Multivariat: data Catalonia, seperti prediksi_hujan_jilid2.py
# ------------------------------------------------------------------ #
pl = pd.read_csv(os.path.join(CAT, "pluviometer_sensors_reads.csv"), index_col=0, parse_dates=True).sort_index()
st_pl = pl.isnull().sum().sort_values().index[0]
rain = (pl[st_pl].dropna() * 6).clip(lower=0)
gm = pd.read_csv(os.path.join(CAT, "metadata", "gauge_sensors_metadata.csv"))
rl = gm[gm["description"].str.lower().str.contains("river level", na=False)]["sensor_id"].tolist()
ga = pd.read_csv(os.path.join(CAT, "gauge_sensors_reads.csv"), index_col=0, parse_dates=True).sort_index()
kol = [c for c in ga.columns if c in rl]
st_ga = ga[kol].isnull().sum().sort_values().index[0]
wl = ga[st_ga].dropna() / 100
M = pd.DataFrame({"Rainfall": rain.resample("D").sum(), "WaterLevel": wl.resample("D").mean()})
M = M.reset_index().rename(columns={"datetime": "Date", "index": "Date"}).sort_values("Date").reset_index(drop=True)
M["Rainfall"] = M["Rainfall"].fillna(0).clip(lower=0)
M["WaterLevel"] = M["WaterLevel"].ffill().bfill()
M = M.dropna().reset_index(drop=True)

F = M.copy()
cols = []
for c in ("Rainfall", "WaterLevel"):
    s = F[c]
    F[f"{c}_lag1"], F[f"{c}_lag3"], F[f"{c}_lag7"] = s.shift(1), s.shift(3), s.shift(7)
    F[f"{c}_m3"] = s.shift(1).rolling(3).mean()
    F[f"{c}_m7"] = s.shift(1).rolling(7).mean()
    F[f"{c}_x7"] = s.shift(1).rolling(7).max()
    F[f"{c}_s7"] = s.shift(1).rolling(7).std()
    cols += [f"{c}_lag1", f"{c}_lag3", f"{c}_lag7", f"{c}_m3", f"{c}_m7", f"{c}_x7", f"{c}_s7"]
F = F.dropna().reset_index(drop=True)
n = len(F)
nt = int(n * 0.15)
te = F.iloc[n - nt :].reset_index(drop=True)
ym = te["Rainfall"].values

spm = json.load(open(os.path.join(MODELS, "scaler_params_mv.json")))
mu2 = np.array(spm["feature_scaler"]["mean"])
sd2 = np.array(spm["feature_scaler"]["scale"])
for m in ("gbr_mv", "xgb_mv"):
    hasil["mv"][m] = metrik(ym, np.maximum(0, jalankan(m, (te[cols].values - mu2) / sd2)))

rs, ws, tr = spm["sequence_rainfall_scaler"], spm["sequence_waterlevel_scaler"], spm["target_rainfall_scaler"]
Z = np.stack([(M["Rainfall"].values - rs["mean"]) / rs["scale"], (M["WaterLevel"].values - ws["mean"]) / ws["scale"]], axis=1)
ns = len(M) - 7
nts = int(ns * 0.15)
ids = np.arange(len(M) - nts, len(M))
Xs = np.stack([Z[i - 7 : i] for i in ids])
ys = M["Rainfall"].values[ids]
for m in ("lstm_mv", "bilstm_mv"):
    hasil["mv"][m] = metrik(ys, np.maximum(0, jalankan(m, Xs) * tr["scale"] + tr["mean"]))
hasil["mv"]["persistensi"] = metrik(ym, te["Rainfall_lag1"].values)
hasil["mv"]["_uji"] = {
    "n": int(len(ym)),
    "dari": str(te["Date"].min().date()),
    "sampai": str(te["Date"].max().date()),
    "sumber": f"Catalonia, pluviometer {st_pl} dan river level {st_ga}, 15 persen terakhir, seperti prediksi_hujan_jilid2.py",
}

keluar = os.path.join("src", "lib", "forecastMetrics.json")
json.dump(hasil, open(keluar, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
for grup in ("uv", "uv_lengkap", "mv"):
    for k, v in hasil[grup].items():
        if not k.startswith("_"):
            print(f"{grup} {k:12s} MAE {v['mae']:.3f}  RMSE {v['rmse']:.3f}  NSE {v['nse']:.3f}")
print("ditulis ke", keluar)
