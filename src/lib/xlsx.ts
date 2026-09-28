/**
 * Buku kerja Excel (.xlsx) satu lembar, disusun tanpa pustaka.
 *
 * Alasannya dari uji rekan V7: CSV unduhan terbuka di Excel sebagai satu
 * kolom teks. Excel membaca CSV dengan pemisah daftar dan tanda desimal
 * dari pengaturannya sendiri, dan keduanya berbeda-beda antarkomputer. Di
 * komputer rekan pemisahnya titik koma tetapi desimalnya titik, jadi CSV
 * berkoma tidak terbelah dan CSV bergaya Indonesia (titik koma, koma
 * desimal) terbelah tetapi angkanya terbaca sebagai teks. Di .xlsx angka
 * tersimpan sebagai angka dan tanggal sebagai tanggal, sehingga terbuka
 * benar di Excel mana pun.
 *
 * Isinya lima berkas XML dalam arsip zip tanpa pemampatan.
 */

export type XlsxCell = string | number | Date | null;

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Karakter kendali tidak sah di XML 1.0
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

/** A, B, ..., Z, AA, ... */
export function colName(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Nomor seri tanggal Excel: hari sejak 30 Desember 1899 */
const serial = (d: Date) => d.getTime() / 86400000 + 25569;

function sheetXml(rows: XlsxCell[][]): string {
  const isi = rows
    .map((r, i) => {
      const sel = r
        .map((v, j) => {
          const ref = `${colName(j)}${i + 1}`;
          if (v === null || v === "" || (typeof v === "number" && !Number.isFinite(v))) return "";
          if (typeof v === "number") return `<c r="${ref}"><v>${v}</v></c>`;
          if (v instanceof Date) return `<c r="${ref}" s="1"><v>${serial(v)}</v></c>`;
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
        })
        .join("");
      return `<row r="${i + 1}">${sel}</row>`;
    })
    .join("");
  /* Lebar kolom mengikuti isi terpanjang. Tanpa ini kolom tanggal terlalu
     sempit dan Excel menampilkan ######## */
  const lebar: number[] = [];
  rows.forEach((r) =>
    r.forEach((v, j) => {
      const n = v instanceof Date ? 11 : typeof v === "number" ? Math.min(String(v).length, 12) : (v ?? "").length;
      lebar[j] = Math.max(lebar[j] ?? 8, n + 2);
    })
  );
  const cols = lebar.map((w, j) => `<col min="${j + 1}" max="${j + 1}" width="${Math.min(w, 60)}" customWidth="1"/>`).join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    (cols ? `<cols>${cols}</cols>` : "") +
    `<sheetData>${isi}</sheetData></worksheet>`
  );
}

const TIPE = "application/vnd.openxmlformats-officedocument.spreadsheetml";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG = "http://schemas.openxmlformats.org/package/2006";

function parts(rows: XlsxCell[][], sheetName: string): [string, string][] {
  return [
    [
      "[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<Types xmlns="${PKG}/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        `<Override PartName="/xl/workbook.xml" ContentType="${TIPE}.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${TIPE}.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="${TIPE}.styles+xml"/>` +
        "</Types>",
    ],
    [
      "_rels/.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<Relationships xmlns="${PKG}/relationships">` +
        `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/>` +
        "</Relationships>",
    ],
    [
      "xl/workbook.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${REL}">` +
        `<sheets><sheet name="${esc(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<Relationships xmlns="${PKG}/relationships">` +
        `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/>` +
        "</Relationships>",
    ],
    [
      "xl/styles.xml",
      /* Gaya 1: format tanggal bawaan Excel (numFmtId 14), yang tampil
         mengikuti pengaturan tanggal komputer pembacanya */
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        "</styleSheet>",
    ],
    ["xl/worksheets/sheet1.xml", sheetXml(rows)],
  ];
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Arsip zip tanpa pemampatan (metode 0), nama berkas UTF-8 */
function zip(files: [string, Uint8Array][]): Uint8Array {
  const enc = new TextEncoder();
  const lokal: Uint8Array[] = [];
  const pusat: Uint8Array[] = [];
  let offset = 0;
  // Tanggal tetap 1 Januari 2020 dalam format DOS, supaya keluaran sama tiap kali
  const WAKTU = 0;
  const TGL = ((2020 - 1980) << 9) | (1 << 5) | 1;
  for (const [nama, data] of files) {
    const n = enc.encode(nama);
    const crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x0800, true);
    h.setUint16(8, 0, true);
    h.setUint16(10, WAKTU, true);
    h.setUint16(12, TGL, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true);
    h.setUint32(22, data.length, true);
    h.setUint16(26, n.length, true);
    h.setUint16(28, 0, true);
    lokal.push(new Uint8Array(h.buffer), n, data);

    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, WAKTU, true);
    c.setUint16(14, TGL, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, n.length, true);
    c.setUint32(42, offset, true);
    pusat.push(new Uint8Array(c.buffer), n);
    offset += 30 + n.length + data.length;
  }
  const besarPusat = pusat.reduce((a, b) => a + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, besarPusat, true);
  e.setUint32(16, offset, true);
  const semua = [...lokal, ...pusat, new Uint8Array(e.buffer)];
  const out = new Uint8Array(semua.reduce((a, b) => a + b.length, 0));
  let p = 0;
  for (const b of semua) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}

/** Baris pertama judul kolom, sisanya data */
export function xlsxBytes(rows: XlsxCell[][], sheetName = "data"): Uint8Array {
  const enc = new TextEncoder();
  return zip(parts(rows, sheetName).map(([n, s]) => [n, enc.encode(s)]));
}
