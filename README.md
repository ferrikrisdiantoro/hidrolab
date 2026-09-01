# HidroLab

Purwarupa laboratorium hidraulika interaktif. Setiap halaman adalah satu
lembar gambar teknik yang dihitung ulang secara langsung: geser satu masukan,
dan profil muka air, garis energi, dimensi, sampai kop di bawah gambar ikut
menyesuaikan.

Seluruh perhitungan berjalan di peramban. Tidak ada server, tidak ada basis
data, dan tidak ada data yang dikirim keluar.

## Lembar yang tersedia

| Lembar | Judul | Model |
|---|---|---|
| HJ-01 | Loncatan air | Belanger, klasifikasi Froude, kehilangan energi |
| MD-01 | Diagram Moody | Colebrook-White, iterasi Newton-Raphson |
| SE-01 | Energi spesifik | Manning dibalik dengan metode bagi dua, kedalaman kritis |

## Menjalankan

```bash
npm install
npm run dev
```

Lalu buka http://localhost:3000

```bash
npm run build && npm run start   # mode produksi
```

## Catatan teknis

- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4
- Seluruh gambar digambar langsung di canvas 2D, tanpa pustaka grafik
- Tiga bobot garis dengan arti terkunci: tebal untuk geometri nyata, tipis
  untuk dimensi dan penunjuk, rambut untuk kisi
- Kosakata warna terkunci: biru selalu air, merah bata selalu energi, ungu
  selalu kondisi kritis, merah sinyal hanya untuk di luar rentang validitas
- Bagian yang berada di luar jangkauan rumus digambar dengan garis titik
  rapat, bukan garis menerus — misalnya bentuk permukaan di dalam loncatan
  air, yang tidak diberikan oleh persamaan Belanger

## Peringatan

Hasil pada lembar-lembar ini ditujukan untuk membangun pemahaman, bukan
menggantikan perhitungan desain yang terjamin mutunya. Setiap keluaran harus
diperiksa secara independen sebelum dipakai untuk desain, penilaian
keselamatan, atau pengajuan ke regulator.
