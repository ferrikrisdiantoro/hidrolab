"""
Data contoh dan acuan fitur untuk lembar HY-06.

Menulis src/lib/forecastSamples.json berisi:
- 180 hari terakhir data univariat (Regresi-Hujan.xlsx) dan multivariat
  (Catalonia), yaitu data yang sama dengan yang melatih modelnya, supaya
  contoh di lembar berada di dalam daerah keberlakuan model;
- vektor fitur untuk hari sesudah data contoh, disusun dengan pandas
  seperti peramban seharusnya menyusunnya (tujuh hari terakhir yang
  diketahui, simpangan baku pembagi n − 1);
- keluaran onnxruntime Python untuk vektor itu, sebagai acuan bahwa ONNX di
  peramban memberi angka yang sama.

Pemakaian (dari folder demo-hidrolab):
    python scripts/data_contoh_prediksi.py <folder webapp cl42> <folder data Catalonia>
"""

import json
import os
import sys

import numpy as np
import onnxruntime as ort
import pandas as pd

CL42, CAT = sys.argv[1], sys.argv[2]
MODELS = os.path.join(CL42, "public", "models")
N = 180

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


def jalankan(nama, X):
    s = ort.InferenceSession(os.path.join(MODELS, f"model_{nama}.onnx"))
    return float(s.run(None, {s.get_inputs()[0].name: np.asarray(X, np.float32)})[0].ravel()[0])


# Univariat
df = pd.read_excel(os.path.join(CL42, "dataset", "Regresi-Hujan.xlsx"), sheet_name="Data Hjan Harian")
df = df.loc[:, df.columns.notna()]
df.columns = df.iloc[2]
df = df.iloc[3:].reset_index(drop=True)
yc = df.columns[2:]
df[yc] = df[yc].apply(pd.to_numeric, errors="coerce").clip(lower=0)
L = deret_lengkap(df)
uv = L.tail(N).reset_index(drop=True)
assert (uv["tanggal"].diff().dropna().dt.days == 1).all(), "data contoh tidak harian berurutan"

h = uv["hujan"].values
besok = uv["tanggal"].iloc[-1] + pd.Timedelta(days=1)
w7 = h[-7:]
fitur_uv = [
    h[-1], h[-3], h[-7],
    h[-3:].mean(), w7.mean(), w7.max(), pd.Series(w7).std(),
    besok.month, besok.dayofweek,
]
sp = json.load(open(os.path.join(MODELS, "scaler_params.json")))
mu = np.array(sp["feature_scaler"]["mean"])
sd = np.array(sp["feature_scaler"]["scale"])
tm, ts = sp["target_scaler"]["mean"], sp["target_scaler"]["scale"]
X_tab = ((np.array(fitur_uv) - mu) / sd)[None, :]
X_seq = ((w7 - tm) / ts)[None, :, None]

acuan_uv = {
    "tanggal": str(besok.date()),
    "fitur": [float(v) for v in fitur_uv],
    "gbr": jalankan("gbr", X_tab),
    "xgb": jalankan("xgb", X_tab),
    "lstm": jalankan("lstm", X_seq) * ts + tm,
    "bilstm": jalankan("bilstm", X_seq) * ts + tm,
}

# Multivariat
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
mv = M.tail(N).reset_index(drop=True)

fitur_mv = []
for c in ("Rainfall", "WaterLevel"):
    v = mv[c].values
    w = v[-7:]
    fitur_mv += [v[-1], v[-3], v[-7], v[-3:].mean(), w.mean(), w.max(), pd.Series(w).std()]
spm = json.load(open(os.path.join(MODELS, "scaler_params_mv.json")))
mu2 = np.array(spm["feature_scaler"]["mean"])
sd2 = np.array(spm["feature_scaler"]["scale"])
rs, ws, tr = spm["sequence_rainfall_scaler"], spm["sequence_waterlevel_scaler"], spm["target_rainfall_scaler"]
X_tab2 = ((np.array(fitur_mv) - mu2) / sd2)[None, :]
Z = np.stack(
    [(mv["Rainfall"].values[-7:] - rs["mean"]) / rs["scale"], (mv["WaterLevel"].values[-7:] - ws["mean"]) / ws["scale"]],
    axis=1,
)[None]
acuan_mv = {
    "tanggal": str((mv["Date"].iloc[-1] + pd.Timedelta(days=1)).date()),
    "fitur": [float(v) for v in fitur_mv],
    "gbr_mv": jalankan("gbr_mv", X_tab2),
    "xgb_mv": jalankan("xgb_mv", X_tab2),
    "lstm_mv": jalankan("lstm_mv", Z) * tr["scale"] + tr["mean"],
    "bilstm_mv": jalankan("bilstm_mv", Z) * tr["scale"] + tr["mean"],
}

keluar = {
    "uv": {
        "sumber": "Regresi-Hujan.xlsx, 180 hari terakhir deret lengkap harian berurutan",
        "tanggal": [str(t.date()) for t in uv["tanggal"]],
        "hujan": [float(v) for v in uv["hujan"]],
        "acuan": acuan_uv,
    },
    "mv": {
        "sumber": f"Catalonia (data latih model multivariat cl42), pluviometer {st_pl}, river level {st_ga}, 180 hari terakhir",
        "tanggal": [str(t.date()) for t in mv["Date"]],
        "hujan": [float(v) for v in mv["Rainfall"]],
        "tma": [float(v) for v in mv["WaterLevel"]],
        "acuan": acuan_mv,
    },
    "skaler": {"uv": sp, "mv": spm},
}
json.dump(keluar, open(os.path.join("src", "lib", "forecastSamples.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("uv", uv["tanggal"].iloc[0].date(), "s.d.", uv["tanggal"].iloc[-1].date(), acuan_uv)
print("mv", mv["Date"].iloc[0].date(), "s.d.", mv["Date"].iloc[-1].date(), {k: v for k, v in acuan_mv.items() if k != "fitur"})
