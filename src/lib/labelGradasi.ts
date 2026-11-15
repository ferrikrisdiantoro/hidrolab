import { C, F, W, stencil, stencilWidth } from "./theme.ts";
import { fitHeading, pen, region } from "./plate.ts";
import type { PlateOut } from "./plateOut.ts";

/**
 * DM-02: TULISAN DIAGRAM GRADASI YANG TIDAK MEMUTUS KURVA.
 *
 * Temuan uji rekan V20 (11 Nov), contoh "Tanah seragam, jendela sempit":
 * kurva tanah yang dilindungi hampir tegak dan melintas tepat di bawah
 * empat tulisan berurutan (batas mengalirkan, batas menahan, nama tanah,
 * nama keadaan). Tiap tulisan beralas kertas, jadi kurvanya terbaca putus
 * dari 100 % sampai 80 %. Nama jendela filter ditaruh rata tengah pada pita
 * yang lebarnya belasan piksel, jadi tulisannya lebih lebar daripada pitanya
 * dan huruf pertamanya tertutup garis batas putus-putus.
 *
 * Di sini tulisan-tulisan itu ditaruh SESUDAH diagramnya digambar, di tempat
 * yang menutup kurva paling sedikit. Untuk tiap tulisan disiapkan beberapa
 * calon tempat; biaya satu calon adalah panjang kurva (piksel) yang jatuh di
 * dalam kotaknya, dengan garis bantu (batas, 15 %, jalur baca D15) berbobot
 * setengah. Calon yang menimpa tulisan lain atau pegangan seret dibuang.
 * Calon pertama yang biayanya paling kecil dipakai, jadi urutan calon adalah
 * urutan kesukaan: pada layar lebar tempat yang tidak menutup apa pun
 * hampir selalu ada; pada HP 390 tempat yang menutup paling sedikit.
 */

export type Kotak = { x0: number; x1: number; atas: number; bawah: number };
export type Garis = { pts: readonly { x: number; y: number }[]; bobot: number };

/** Panjang potongan ruas (ax,ay)-(bx,by) di dalam kotak (Liang-Barsky). */
function potongRuas(k: Kotak, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - k.x0, k.x1 - ax, ay - k.atas, k.bawah - ay];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return 0;
      continue;
    }
    const r = q[i] / p[i];
    if (p[i] < 0) {
      if (r > t1) return 0;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return 0;
      if (r < t1) t1 = r;
    }
  }
  return (t1 - t0) * Math.hypot(dx, dy);
}

/** Panjang garis (piksel, dikali bobot) yang jatuh di dalam kotak. */
export function panjangDalam(k: Kotak, garis: readonly Garis[]): number {
  let s = 0;
  for (const g of garis) {
    for (let i = 1; i < g.pts.length; i++) {
      const a = g.pts[i - 1];
      const b = g.pts[i];
      if (Math.max(a.x, b.x) < k.x0 || Math.min(a.x, b.x) > k.x1) continue;
      if (Math.max(a.y, b.y) < k.atas || Math.min(a.y, b.y) > k.bawah) continue;
      s += g.bobot * potongRuas(k, a.x, a.y, b.x, b.y);
    }
  }
  return s;
}

const tabrak = (a: Kotak, b: Kotak) =>
  a.x0 < b.x1 && a.x1 > b.x0 && a.atas < b.bawah && a.bawah > b.atas;

/** Calon kotak beserta data gambarnya. */
export type Calon<T> = { kotak: Kotak[]; isi: T };

/**
 * Susunan judul: satu, dua, atau tiga baris, dipecah di spasi supaya baris
 * terpanjang sependek mungkin. Fon 15 px untuk satu baris, 12 px untuk dua
 * dan tiga baris, dikecilkan sampai 10 px bila masih lebih lebar daripada
 * bidang. Susunan yang tetap tidak muat dibuang.
 */
export function susunanJudul(
  ctx: CanvasRenderingContext2D,
  teks: string,
  lebarBidang: number
): { font: string; ukuran: number; lines: string[]; lebar: number[] }[] {
  const kata = teks.split(" ");
  const hasil: { font: string; ukuran: number; lines: string[]; lebar: number[] }[] = [];
  const ukur = (font: string, l: string) => {
    ctx.font = font;
    return stencilWidth(ctx, l, 2) + 8;
  };
  const pecahan: string[][] = [[teks]];
  let dua: string[] | null = null;
  let tiga: string[] | null = null;
  let terbaik2 = Infinity;
  let terbaik3 = Infinity;
  const f12 = F.heading.replace("15px", "12px");
  for (let i = 1; i < kata.length; i++) {
    const l = [kata.slice(0, i).join(" "), kata.slice(i).join(" ")];
    const m = Math.max(...l.map((b) => ukur(f12, b)));
    if (m < terbaik2) {
      terbaik2 = m;
      dua = l;
    }
    for (let j = i + 1; j < kata.length; j++) {
      const l3 = [kata.slice(0, i).join(" "), kata.slice(i, j).join(" "), kata.slice(j).join(" ")];
      const m3 = Math.max(...l3.map((b) => ukur(f12, b)));
      if (m3 < terbaik3) {
        terbaik3 = m3;
        tiga = l3;
      }
    }
  }
  if (dua) pecahan.push(dua);
  if (tiga) pecahan.push(tiga);
  for (const lines of pecahan) {
    let ukuran = lines.length === 1 ? 15 : 12;
    let font = F.heading.replace("15px", `${ukuran}px`);
    let lebar = lines.map((b) => ukur(font, b));
    while (Math.max(...lebar) + 6 > lebarBidang && ukuran > 10) {
      ukuran--;
      font = F.heading.replace("15px", `${ukuran}px`);
      lebar = lines.map((b) => ukur(font, b));
    }
    if (Math.max(...lebar) + 6 <= lebarBidang) hasil.push({ font, ukuran, lines, lebar });
  }
  if (!hasil.length) {
    const m = fitHeading(ctx, teks, lebarBidang);
    const ukuran = Number(/(\d+)px/.exec(m.font)?.[1] ?? 15);
    hasil.push({ font: m.font, ukuran, lines: m.lines, lebar: m.lines.map((b) => ukur(m.font, b)) });
  }
  return hasil;
}

/**
 * Calon termurah. Calon yang keluar bidang atau menimpa kotak terpakai
 * dibuang; bila semua terbuang, calon pertama dipakai (tidak pernah hilang).
 */
export function pilihCalon<T>(
  calon: readonly Calon<T>[],
  terpakai: readonly Kotak[],
  garis: readonly Garis[],
  bidang: Kotak,
  /** Biaya tambahan per calon (kesukaan tempat), bawaannya nol */
  tambahan: (c: Calon<T>) => number = () => 0
): Calon<T> {
  let terbaik: Calon<T> | null = null;
  let biaya = Infinity;
  /* Diperiksa urut biaya tambahannya (stabil, jadi seri tetap memilih calon
     yang lebih dulu). Biaya kurva tidak pernah negatif, jadi begitu biaya
     tambahan saja sudah menyamai yang terbaik, sisanya tidak perlu dihitung. */
  const t = calon.map(tambahan);
  const urut = calon.map((_, i) => i).sort((a, b) => t[a] - t[b] || a - b);
  for (const i of urut) {
    if (t[i] >= biaya - 0.5) break;
    const c = calon[i];
    if (
      c.kotak.some(
        (k) => k.x0 < bidang.x0 - 0.5 || k.x1 > bidang.x1 + 0.5 || k.atas < bidang.atas - 0.5 || k.bawah > bidang.bawah + 0.5
      )
    )
      continue;
    if (c.kotak.some((k) => terpakai.some((u) => tabrak(k, u)))) continue;
    // Berhenti begitu biayanya tidak mungkin lagi mengalahkan yang terbaik.
    let b = t[i];
    for (const k of c.kotak) {
      if (b >= biaya - 0.5) break;
      b += panjangDalam(k, garis);
    }
    if (b < biaya - 0.5) {
      biaya = b;
      terbaik = c;
    }
  }
  return terbaik ?? calon[0];
}

/**
 * Penyederhanaan Douglas-Peucker dengan toleransi piksel. Kurva gradasi
 * disampel 500 titik, sebagian besar mendatar di 0 % dan 100 %; tanpa ini
 * pencarian tempat judul memakan belasan milidetik per gambar.
 */
export function sederhanakan(
  pts: readonly { x: number; y: number }[],
  tol = 0.5
): { x: number; y: number }[] {
  if (pts.length < 3) return pts.slice();
  const simpan = new Uint8Array(pts.length);
  simpan[0] = 1;
  simpan[pts.length - 1] = 1;
  const tumpuk: [number, number][] = [[0, pts.length - 1]];
  while (tumpuk.length) {
    const [i0, i1] = tumpuk.pop()!;
    const a = pts[i0];
    const b = pts[i1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    let jauh = 0;
    let k = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const d = Math.abs((pts[i].x - a.x) * dy - (pts[i].y - a.y) * dx) / l;
      if (d > jauh) {
        jauh = d;
        k = i;
      }
    }
    if (k >= 0 && jauh > tol) {
      simpan[k] = 1;
      tumpuk.push([i0, k], [k, i1]);
    }
  }
  return pts.filter((_, i) => simpan[i]);
}

/** Titik x (piksel) tempat polyline memotong baris y untuk pertama kalinya. */
function xPada(pts: readonly { x: number; y: number }[], y: number): number | null {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) return a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
  }
  return null;
}

export type LabelGradasiSpec = {
  /** Seluruh kurva gradasi (nilai fisik: x mm, y % lolos) */
  kurva: readonly (readonly { x: number; y: number }[])[];
  /** Kurva yang diberi nama di sampingnya (tanah yang dilindungi) */
  nama: { pts: readonly { x: number; y: number }[]; text: string; color: string };
  /** Garis batas tegak. side −1: tulisan di kiri garis, +1: di kanan */
  batas: readonly { at: number; text: string; short: string; side: -1 | 1; color: string }[];
  /** Pita jendela pada sumbu datar */
  jendela: { from: number; to: number; text: string };
  /** Nama keadaan; tidak diisi = tidak ada */
  judul?: { text: string; color: string };
  /** Garis bantu lain (nilai fisik) yang sebaiknya tidak ditutup */
  bantu?: readonly (readonly { x: number; y: number }[])[];
};

export type LabelGradasiOut = {
  batas: { text: string; x: number; y: number; align: CanvasTextAlign }[];
  nama: Kotak;
  jendela: Kotak;
  judul: Kotak[];
};

/**
 * Menulis nama batas, nama kurva, nama jendela, dan nama keadaan di atas
 * diagram yang sudah digambar `drawChart`. Kotak yang dipakai ditambahkan ke
 * `out.labels` supaya pegangan seret ikut menghindarinya.
 */
export function labelGradasi(
  ctx: CanvasRenderingContext2D,
  out: PlateOut,
  s: LabelGradasiSpec
): LabelGradasiOut {
  const { X, Y, frame: f } = out.map;
  const bidang: Kotak = { x0: f.x0, x1: f.x1, atas: f.y0, bawah: f.y1 };
  const px = (pts: readonly { x: number; y: number }[]) => pts.map((p) => ({ x: X(p.x), y: Y(p.y) }));
  const kurvaPx = s.kurva.map((k) => sederhanakan(px(k)));
  const garis: Garis[] = [
    ...kurvaPx.map((pts) => ({ pts, bobot: 1 })),
    ...(s.bantu ?? []).map((g) => ({ pts: px(g), bobot: 0.5 })),
    ...[s.jendela.from, s.jendela.to].map((v) => ({
      pts: [
        { x: X(v), y: f.y0 },
        { x: X(v), y: f.y1 },
      ],
      bobot: 0.5,
    })),
  ];
  const terpakai: Kotak[] = (out.labels ?? []).map((r) => ({ x0: r.x, x1: r.x + r.w, atas: r.y, bawah: r.y + r.h }));
  for (const k in out.anchors ?? {}) {
    const a = out.anchors![k];
    terpakai.push({ x0: a.x - 14, x1: a.x + 14, atas: a.y - 12, bawah: a.y + 12 });
  }
  const ditaruh: Kotak[] = [];
  const pakai = (k: Kotak) => {
    terpakai.push(k);
    ditaruh.push(k);
  };
  const alas = (k: Kotak) => {
    ctx.fillStyle = C.sheet;
    ctx.fillRect(k.x0 + 3, k.atas, k.x1 - k.x0 - 6, k.bawah - k.atas);
  };
  /** Kotak tulisan kecil (F.region, spasi 1,4) bergaris dasar tengah. */
  const kotakKecil = (teks: string, x: number, y: number, align: CanvasTextAlign): Kotak => {
    ctx.font = F.region;
    const l = stencilWidth(ctx, teks, 1.4);
    const x0 = align === "left" ? x - 4 : align === "right" ? x - l - 4 : x - l / 2 - 4;
    return { x0, x1: x0 + l + 8, atas: y - 7, bawah: y + 7 };
  };

  /* 1. Nama batas di atas bingkai, di ujung garisnya: di luar bidang tidak
        ada kurva yang dapat diputus. Bila keduanya tidak muat berdampingan
        (HP), dipakai angkanya saja. */
  const yAtas = f.y0 - 9;
  const susunBatas = (pendek: boolean) => {
    const hasil: { text: string; x: number; y: number; align: CanvasTextAlign; k: Kotak }[] = [];
    for (const b of s.batas) {
      const teks = pendek ? b.short : b.text;
      const align: CanvasTextAlign = b.side < 0 ? "right" : "left";
      let x = X(b.at) + b.side * 4;
      let k = kotakKecil(teks, x, yAtas, align);
      // Dijepit ke lebar bidang.
      const geser = Math.max(0, f.x0 - k.x0) - Math.max(0, k.x1 - f.x1);
      x += geser;
      k = { ...k, x0: k.x0 + geser, x1: k.x1 + geser };
      hasil.push({ text: teks, x, y: yAtas, align, k });
    }
    return hasil;
  };
  let batas = susunBatas(false);
  const bertumpuk = (h: typeof batas) => h.some((a, i) => h.some((b, j) => i < j && tabrak(a.k, b.k)));
  if (bertumpuk(batas)) batas = susunBatas(true);
  for (const b of s.batas) {
    const t = batas.find((h) => h.text === b.text || h.text === b.short);
    if (!t) continue;
    region(ctx, t.text, t.x, t.y, b.color, 0, t.align);
  }

  /* 2. Nama keadaan: blok satu sampai tiga baris. Calon dari atas ke
        bawah, tiap baris dari tengah ke tepi. Kesukaan: dekat tepi atas dan
        sedikit baris; satu piksel kurva yang tertutup jauh lebih mahal. */
  const judulKotak: Kotak[] = [];
  if (s.judul) {
    const susunan = susunanJudul(ctx, s.judul.text, f.x1 - f.x0);
    type IsiJudul = { cx: number; y: number; n: number };
    const calon: Calon<IsiJudul>[] = [];
    const tengah = (f.x0 + f.x1) / 2;
    const xs: number[] = [tengah];
    for (let d = 16; d < f.x1 - f.x0; d += 16) xs.push(tengah - d, tengah + d);
    susunan.forEach((su, n) => {
      const jarak = su.ukuran + 3;
      const blok = (cx: number, y: number): Kotak[] =>
        su.lines.map((_, i) => ({
          x0: cx - su.lebar[i] / 2,
          x1: cx + su.lebar[i] / 2,
          atas: y + jarak * i - su.ukuran - 2,
          bawah: y + jarak * i + 3,
        }));
      for (let y = f.y0 + su.ukuran + 9; y + jarak * (su.lines.length - 1) + 3 < f.y1 - 2; y += 8)
        for (const cx of xs) calon.push({ kotak: blok(cx, y), isi: { cx, y, n } });
    });
    const c = pilihCalon(
      calon,
      terpakai,
      garis,
      bidang,
      (k) => 0.04 * (k.isi.y - f.y0) + 0.01 * Math.abs(k.isi.cx - tengah) + 3 * k.isi.n
    );
    const su = susunan[c.isi.n];
    su.lines.forEach((b, i) => {
      const k = c.kotak[i];
      alas(k);
      pakai(k);
      judulKotak.push(k);
      ctx.fillStyle = s.judul!.color;
      ctx.font = su.font;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      stencil(ctx, b, c.isi.cx, c.isi.y + (su.ukuran + 3) * i, 2);
    });
  }

  /* 3. Nama kurva tanah: di samping kurvanya pada beberapa ketinggian,
        kiri lebih dulu (kurva tanah di kiri filter). */
  const namaPx = px(s.nama.pts);
  const calonNama: Calon<{ x: number; y: number; align: CanvasTextAlign }>[] = [];
  for (const persen of [60, 50, 70, 40, 80, 30, 90, 20]) {
    const y = Y(persen);
    const xc = xPada(namaPx, y);
    if (xc === null) continue;
    for (const [x0, align] of [
      [xc - 8, "right"],
      [xc + 8, "left"],
    ] as const) {
      // Dijepit ke dalam bidang (HP: di kiri kurva tidak cukup ruang).
      const k0 = kotakKecil(s.nama.text, x0, y, align);
      const geser = Math.max(0, f.x0 + 1 - k0.x0) - Math.max(0, k0.x1 - f.x1 + 1);
      const x = x0 + geser;
      calonNama.push({ kotak: [kotakKecil(s.nama.text, x, y, align)], isi: { x, y, align } });
    }
  }
  let nama: Kotak = bidang;
  if (calonNama.length) {
    const c = pilihCalon(calonNama, terpakai, garis, bidang);
    nama = c.kotak[0];
    alas(nama);
    pakai(nama);
    region(ctx, s.nama.text, c.isi.x, c.isi.y, s.nama.color, 0, c.isi.align);
  }

  /* 4. Nama jendela di baris bawah. Muat di dalam pita: rata tengah di
        pita. Tidak muat: di samping pita dengan garis ukur selebar pita dan
        penunjuk mendatar ke tulisannya, supaya tidak terbaca sebagai nama
        daerah di sebelahnya. */
  const a = X(s.jendela.from);
  const b = X(s.jendela.to);
  ctx.font = F.region;
  const lebarJ = stencilWidth(ctx, s.jendela.text, 1.4) + 8;
  type IsiJ = { x: number; y: number; align: CanvasTextAlign; sisi: 0 | -1 | 1 };
  const calonJ: Calon<IsiJ>[] = [];
  /* Hanya di dua perlima bawah bidang, dengan kesukaan pada baris paling
     bawah: garis ukur selebar pita yang melintang di tengah diagram terbaca
     sebagai data. Muat di dalam pita = hurufnya (tanpa ruang napas) muat. */
  const yBawah = f.y1 - 10;
  for (let y = yBawah; y > f.y1 - 0.4 * (f.y1 - f.y0); y -= 12) {
    if (lebarJ - 8 <= b - a - 4) calonJ.push({ kotak: [kotakKecil(s.jendela.text, (a + b) / 2, y, "center")], isi: { x: (a + b) / 2, y, align: "center", sisi: 0 } });
    calonJ.push({ kotak: [kotakKecil(s.jendela.text, b + 14, y, "left")], isi: { x: b + 14, y, align: "left", sisi: 1 } });
    calonJ.push({ kotak: [kotakKecil(s.jendela.text, a - 14, y, "right")], isi: { x: a - 14, y, align: "right", sisi: -1 } });
  }
  const cj = pilihCalon(calonJ, terpakai, garis, bidang, (c) => 0.25 * (yBawah - c.isi.y));
  const jendela = cj.kotak[0];
  if (cj.isi.sisi !== 0) {
    // Garis ukur selebar pita dan penunjuk ke tulisan.
    const y = cj.isi.y;
    const ujung = cj.isi.sisi > 0 ? cj.isi.x - 4 : cj.isi.x + 4;
    pen(ctx, W.thin, C.pass);
    ctx.beginPath();
    ctx.moveTo(a, y);
    ctx.lineTo(b, y);
    ctx.moveTo(a, y - 4);
    ctx.lineTo(a, y + 4);
    ctx.moveTo(b, y - 4);
    ctx.lineTo(b, y + 4);
    ctx.moveTo(cj.isi.sisi > 0 ? b : a, y);
    ctx.lineTo(ujung, y);
    ctx.stroke();
  }
  alas(jendela);
  pakai(jendela);
  region(ctx, s.jendela.text, cj.isi.x, cj.isi.y, C.pass, 0, cj.isi.align);

  out.labels = [
    ...(out.labels ?? []),
    ...ditaruh.map((k) => ({ x: k.x0, y: k.atas, w: k.x1 - k.x0, h: k.bawah - k.atas })),
  ];
  return {
    batas: batas.map(({ text, x, y, align }) => ({ text, x, y, align })),
    nama,
    jendela,
    judul: judulKotak,
  };
}
