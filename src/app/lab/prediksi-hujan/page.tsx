import type { Metadata } from "next";
import { PrediksiHujanClient } from "./PrediksiHujanClient";

export const metadata: Metadata = {
  title: "Prediksi curah hujan — HidroLab",
  description:
    "Prediksi curah hujan harian dengan model LSTM, BiLSTM, ARIMA, Gradient Boosting, dan XGBoost dari cl42, diuji ulang pada data yang dimasukkan dan dibandingkan dengan tebakan sama dengan kemarin.",
};

export default function Page() {
  return <PrediksiHujanClient />;
}
