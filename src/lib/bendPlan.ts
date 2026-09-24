/**
 * Bentuk belokan pipa dilihat dari atas.
 *
 * Dipisahkan dari penggambarnya karena isinya ilmu ukur murni, tanpa satu
 * pun warna, ketebalan garis, atau bidang gambar. Dengan begitu bentuknya
 * dapat diuji sendiri tanpa kanvas, dan memang perlu diuji sendiri: bentuk
 * sebelumnya gagal pada sudut besar dan tidak ada yang menangkapnya.
 */
/**
 * Tepi luar belokan pipa dilihat dari atas, siap dipakai sebagai StructureBody.
 *
 * Dipakai bersama oleh FF-03, PI-05, dan PI-06, karena ketiganya menggambar
 * benda yang sama: satu ruas masuk, satu belokan, satu ruas keluar, dengan
 * penampang yang boleh berubah di belokannya.
 *
 * Belokannya digambar sebagai BUSUR berjari-jari berhingga, bukan sebagai
 * sudut siku yang dipertemukan.
 *
 * Mempertemukan kedua sisinya pada satu titik siku memang berhasil pada sudut
 * kecil, dan itulah yang paling mudah ditulis. Tetapi titik pertemuan itu
 * menjauh seperti satu per sinus setengah sudutnya, sehingga pada seratus
 * tujuh puluh derajat ia sudah berada sebelas kali lebar pipa di luar
 * gambarnya, dan pada seratus delapan puluh derajat ia tidak ada sama sekali.
 * Belokan berbalik arah justru salah satu keadaan contoh pada dua lembar yang
 * memakainya, jadi kegagalan itu pasti terlihat. Busur berjari-jari
 * berhingga tidak punya keadaan khusus di sudut mana pun, dan kebetulan
 * itulah juga bentuk belokan pipa yang sebenarnya.
 *
 * Yang tetap ditangani terpisah hanya sudut nol: di situ tidak ada belokan
 * sama sekali, yang ada justru anak tangga perubahan penampang, dan anak
 * tangga itulah pokok PI-06.
 */
export function bendPlan(
  /** Garis tengah penampang masuk, meter */
  D1: number,
  /** Garis tengah penampang keluar, meter */
  D2: number,
  /** Sudut belokan, derajat. Nol berarti lurus */
  angleDeg: number,
  /** Panjang ruas masuk dan ruas keluar yang digambar, meter */
  lenIn: number,
  lenOut: number,
  /**
   * Jari-jari sumbu belokannya, meter. Bila kosong dipakai satu setengah
   * kali garis tengah terbesarnya, yaitu belokan pabrikan yang biasa.
   *
   * Diberikan sendiri hanya bila ada bentuk kedua yang harus BERSARANG di
   * dalam bentuk pertama, misalnya batas volume kendali di dalam pipanya.
   * Bentuk yang jari-jarinya dihitung dari garis tengahnya masing-masing
   * tidak akan pernah sejajar dengan bentuk yang lain.
   */
  radius?: number
): { x: number; z: number }[] {
  const w1 = D1 / 2;
  const w2 = D2 / 2;
  const th = (angleDeg * Math.PI) / 180;

  if (Math.abs(th) < 1e-9) {
    /* Lurus: perubahan penampangnya menjadi anak tangga di titik asal. */
    return [
      { x: -lenIn, z: w1 },
      { x: 0, z: w1 },
      { x: 0, z: w2 },
      { x: lenOut, z: w2 },
      { x: lenOut, z: -w2 },
      { x: 0, z: -w2 },
      { x: 0, z: -w1 },
      { x: -lenIn, z: -w1 },
    ];
  }

  const b = bendGeometry(D1, D2, angleDeg, lenOut, radius);
  const arah = Math.sign(th);
  const Rb = b.radius;
  const n = 36;

  /* Sisi kiri arah jalan, yaitu sisi dalam belokan bila membelok ke kiri. */
  const kiri: { x: number; z: number }[] = [];
  const kanan: { x: number; z: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const phi = th * s;
    const w = w1 + (w2 - w1) * s;
    const sx = Math.sin(Math.abs(phi));
    const cz = Math.cos(Math.abs(phi));
    /* Pusat lengkungnya di (0, arah·Rb); titik sumbunya pada sudut phi. */
    const px = Rb * sx;
    const pz = arah * (Rb - Rb * cz);
    /* Normal kiri arah jalan, yang mengarah ke pusat bila membelok ke kiri. */
    const nx = -Math.sin(phi);
    const nz = Math.cos(phi);
    kiri.push({ x: px + w * nx, z: pz + w * nz });
    kanan.push({ x: px - w * nx, z: pz - w * nz });
  }

  const ux = Math.cos(th);
  const uz = Math.sin(th);
  const nxAkhir = -uz;
  const nzAkhir = ux;
  const ujung = b.outlet;

  return [
    { x: -lenIn, z: w1 },
    ...kiri,
    { x: ujung.x + w2 * nxAkhir, z: ujung.z + w2 * nzAkhir },
    { x: ujung.x - w2 * nxAkhir, z: ujung.z - w2 * nzAkhir },
    ...kanan.slice().reverse(),
    { x: -lenIn, z: -w1 },
  ];
}

/**
 * Letak dan arah penampang keluar belokan yang digambar bendPlan.
 *
 * Dipisahkan karena lembarnya perlu menaruh sesuatu DI penampang itu, misalnya
 * panah laju aliran momentum atau batas volume kendalinya, dan menebak
 * letaknya dari sudut belokan saja akan meleset sejauh jari-jari belokannya.
 */
export function bendGeometry(
  D1: number,
  D2: number,
  angleDeg: number,
  lenOut: number,
  radius?: number
): {
  /** Jari-jari sumbu belokannya, meter */
  radius: number;
  /** Titik tengah penampang keluar */
  outlet: { x: number; z: number };
  /** Arah satuan aliran keluar */
  direction: { x: number; z: number };
} {
  const th = (angleDeg * Math.PI) / 180;
  const arah = Math.sign(th) || 1;
  const Rb = radius ?? 1.5 * Math.max(D1, D2);
  const ux = Math.cos(th);
  const uz = Math.sin(th);

  if (Math.abs(th) < 1e-9)
    return {
      radius: Rb,
      outlet: { x: lenOut, z: 0 },
      direction: { x: 1, z: 0 },
    };

  const px = Rb * Math.sin(Math.abs(th));
  const pz = arah * (Rb - Rb * Math.cos(th));
  return {
    radius: Rb,
    outlet: { x: px + lenOut * ux, z: pz + lenOut * uz },
    direction: { x: ux, z: uz },
  };
}
