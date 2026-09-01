import Link from "next/link";
import { OpeningPlate } from "@/components/OpeningPlate";
import { LABS } from "@/data/labs";

export default function Home() {
  return (
    <div className="mx-auto max-w-[1320px] px-6 py-9">
      {/* ---------------- Pembuka ---------------- */}
      <section className="mb-10 max-w-[62ch]">
        <h1 className="text-[clamp(2.1rem,4.6vw,3.4rem)] font-semibold leading-[1.06] tracking-[-0.018em] text-ink">
          Berkas lembar gambar yang bisa dihitung ulang.
        </h1>
        <p className="mt-4 text-[1.06rem] leading-[1.62] text-ink-2">
          Setiap lembar di sini adalah gambar teknik yang hidup. Geser satu
          masukan, dan seluruh isinya dihitung ulang: profil muka air, garis
          energi, dimensi, sampai kop di bawah gambar. Tidak ada tabel jadi yang
          disalin, tidak ada gambar yang ditempel.
        </p>
      </section>

      <OpeningPlate />

      {/* ---------------- Daftar lembar ---------------- */}
      <section className="mt-16">
        <h2 className="stencil mb-3 border-b border-ink pb-2">daftar lembar</h2>

        <div className="overflow-x-auto">
          <table className="data" style={{ minWidth: "660px" }}>
            <thead>
              <tr>
                <th style={{ width: "5.4rem" }}>Lembar</th>
                <th style={{ width: "13rem" }}>Judul</th>
                <th style={{ width: "11rem" }}>Pokok bahasan</th>
                <th>Pertanyaan yang dijawab</th>
                <th style={{ width: "6.4rem" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {LABS.map((lab) => {
                const ready = lab.status === "siap";
                return (
                  <tr key={lab.sheet}>
                    <td className="value font-semibold text-ink">
                      {ready ? (
                        <Link href={`/lab/${lab.slug}`} className="plain">
                          {lab.sheet}
                        </Link>
                      ) : (
                        <span className="text-ink-3">{lab.sheet}</span>
                      )}
                    </td>
                    <td>
                      {ready ? (
                        <Link
                          href={`/lab/${lab.slug}`}
                          className="font-semibold text-ink"
                        >
                          {lab.title}
                        </Link>
                      ) : (
                        <span className="text-ink-3">{lab.title}</span>
                      )}
                    </td>
                    <td className={ready ? "text-ink-2" : "text-ink-3"}>
                      {lab.subject}
                    </td>
                    <td className={ready ? "text-ink-2" : "text-ink-3"}>
                      {lab.question}
                    </td>
                    <td>
                      <span
                        className="stencil"
                        style={{
                          color: ready
                            ? "var(--color-ink)"
                            : "var(--color-ink-3)",
                        }}
                      >
                        {ready ? "terbit" : "rencana"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 max-w-[70ch] text-[0.88rem] leading-[1.55] text-ink-3">
          Tiga lembar bertanda terbit sudah berjalan penuh. Sisanya
          memperlihatkan bagaimana berkas ini tumbuh: menambah satu lembar
          berarti menambah satu model perhitungan dan satu penggambar, sementara
          kerangka, kop, dan tata letaknya sudah dipakai bersama.
        </p>
      </section>

      {/* ---------------- Metode ---------------- */}
      <section className="mt-16 grid gap-x-12 gap-y-8 border-t border-ink pt-4 md:grid-cols-2">
        <div>
          <h2 className="stencil mb-3">cara lembar ini dibuat</h2>
          <div className="flex max-w-[58ch] flex-col gap-3 text-[0.96rem] leading-[1.6] text-ink-2">
            <p>
              Angka-angkanya diselesaikan sendiri, bukan diambil dari tabel.
              Kedalaman konjugat memakai persamaan Belanger; faktor gesekan
              memakai Colebrook-White yang implisit, diselesaikan dengan iterasi
              Newton-Raphson; kedalaman normal memakai Manning yang dibalik
              dengan metode bagi dua.
            </p>
            <p>
              Gambarnya digambar garis demi garis, tanpa pustaka grafik siap
              pakai. Itu sebabnya penampang, kurva log-log, dan arsiran air bisa
              mengikuti konvensi gambar teknik alih-alih mengikuti bentuk bawaan
              sebuah pustaka.
            </p>
          </div>
        </div>

        <div>
          <h2 className="stencil mb-3">aturan yang dipegang</h2>
          <table className="data">
            <tbody>
              <tr>
                <td className="text-ink-2" style={{ width: "9.5rem" }}>
                  Garis tebal
                </td>
                <td>Geometri nyata: dasar, dinding, muka air</td>
              </tr>
              <tr>
                <td className="text-ink-2">Garis tipis</td>
                <td>Yang membicarakan benda: dimensi, penunjuk, arsiran</td>
              </tr>
              <tr>
                <td className="text-ink-2">Garis putus</td>
                <td>Garis energi, dan hal yang tak terlihat langsung</td>
              </tr>
              <tr>
                <td className="text-ink-2">Titik rapat</td>
                <td>Di luar jangkauan rumus — gambar mengaku tidak tahu</td>
              </tr>
              <tr>
                <td className="text-ink-2">Biru</td>
                <td>Selalu air. Tidak pernah dipakai untuk hal lain</td>
              </tr>
              <tr>
                <td className="text-ink-2">Merah bata</td>
                <td>Selalu energi</td>
              </tr>
              <tr>
                <td className="text-ink-2">Ungu</td>
                <td>Selalu kondisi kritis</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
