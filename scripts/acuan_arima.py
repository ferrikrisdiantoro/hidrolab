"""
Acuan ARIMA dari statsmodels untuk menguji src/lib/arima.ts.

Membangkitkan deret dengan benih tetap, mencocokkan beberapa orde dengan
statsmodels.tsa.arima.model.ARIMA (kemungkinan maksimum eksak, ruang
keadaan), lalu menulis deret, parameter, kemungkinan log, ramalan sepuluh
langkah, dan statistik KPSS ke src/lib/arimaReference.json.

Pemakaian (dari folder demo-hidrolab):
    python scripts/acuan_arima.py
Butuh numpy dan statsmodels (diuji dengan statsmodels 0.15.0).
"""

import json
import warnings

import numpy as np
import statsmodels
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.stattools import kpss

warnings.filterwarnings("ignore")
rng = np.random.default_rng(20260927)

n = 240
e = rng.normal(0, 1, n + 50)
arma = np.zeros(n + 50)
for t in range(2, n + 50):
    arma[t] = 0.55 * arma[t - 1] - 0.2 * arma[t - 2] + e[t] + 0.4 * e[t - 1]
arma = arma[50:] + 3.0
acak_jalan = np.cumsum(0.6 * arma - 1.8)
musim = arma + 1.5 * np.sin(2 * np.pi * np.arange(n) / 7)

kasus = [
    ("arma", arma, (1, 0, 1), (0, 0, 0, 0)),
    ("arma", arma, (2, 0, 1), (0, 0, 0, 0)),
    ("jalan", acak_jalan, (1, 1, 1), (0, 0, 0, 0)),
    ("jalan", acak_jalan, (2, 1, 1), (0, 0, 0, 0)),
    ("musim", musim, (1, 0, 1), (1, 1, 1, 7)),
]

keluar = {"statsmodels": statsmodels.__version__, "deret": {}, "kasus": [], "kpss": {}}
keluar["deret"] = {"arma": arma.tolist(), "jalan": acak_jalan.tolist(), "musim": musim.tolist()}

for nama, y, order, sorder in kasus:
    m = ARIMA(y, order=order, seasonal_order=sorder, trend="c" if order[1] == 0 and sorder[1] == 0 else "n")
    r = m.fit()
    par = dict(zip(r.model.param_names, r.params.tolist()))
    keluar["kasus"].append(
        {
            "deret": nama,
            "order": list(order),
            "seasonal": list(sorder),
            "params": par,
            "loglik": float(r.llf),
            "forecast": r.forecast(10).tolist(),
        }
    )
    print(nama, order, sorder, {k: round(v, 5) for k, v in par.items()}, round(r.llf, 4))

for nama in ("arma", "jalan"):
    y = keluar["deret"][nama]
    keluar["kpss"][nama] = float(kpss(y, regression="c", nlags="legacy")[0])

json.dump(keluar, open("src/lib/arimaReference.json", "w"), indent=1)
print("KPSS", keluar["kpss"])
