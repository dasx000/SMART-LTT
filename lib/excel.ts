import "server-only";
import ExcelJS from "exceljs";

/**
 * Pembuat file Excel bersama untuk semua tombol unduh (plan §6b).
 * Dibuat di SERVER (route /api/unduh/...) → HP tidak memuat pustaka Excel.
 * Gaya mengikuti aplikasi lama (File_Javascript.html): judul tebal, info periode,
 * waktu unduh miring abu-abu, header hijau tulisan putih, garis tipis, zebra, baris total hijau muda.
 */

export const HIJAU = "FF16A34A";
export const HIJAU_TUA = "FF166534";
export const HIJAU_MUDA = "FFDCFCE7";
const ZEBRA = "FFF9FAFB";

const garis: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

export type Kolom = {
  judul: string;
  lebar: number;
  /** "angka" = #,##0.00 rata kanan; "persen" = 0.0% (nilai pecahan, mis. 0.85); "bulat" = #,##0 */
  jenis?: "teks" | "angka" | "persen" | "bulat";
};

export function waktuUnduh(): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

export function bukuBaru() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SMART LTT";
  wb.created = new Date();
  return wb;
}

/** Judul + baris info (+ waktu unduh) yang di-merge selebar tabel. Mengembalikan nomor baris berikutnya. */
export function kepala(ws: ExcelJS.Worksheet, jmlKolom: number, judul: string, info: string[] = []) {
  const baris = [judul, ...info, `Waktu Unduh: ${waktuUnduh()}`];
  baris.forEach((teks, i) => {
    const r = i + 1;
    ws.mergeCells(r, 1, r, jmlKolom);
    const c = ws.getCell(r, 1);
    c.value = teks;
    c.alignment = { horizontal: "center" };
    if (i === 0) c.font = { bold: true, size: 14, color: { argb: "FF1F2937" } };
    else if (i === baris.length - 1) c.font = { italic: true, size: 9, color: { argb: "FF6B7280" } };
    else c.font = { bold: true, size: 10, color: { argb: "FF4B5563" } };
  });
  ws.addRow([]);
}

export function gayaHeader(row: ExcelJS.Row, warna = HIJAU) {
  row.height = 22;
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: warna } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = garis;
  });
}

function formatSel(c: ExcelJS.Cell, k: Kolom | undefined) {
  c.border = garis;
  if (k?.jenis === "angka") {
    c.numFmt = "#,##0.00";
    c.alignment = { horizontal: "right", vertical: "middle" };
  } else if (k?.jenis === "bulat") {
    c.numFmt = "#,##0";
    c.alignment = { horizontal: "right", vertical: "middle" };
  } else if (k?.jenis === "persen") {
    c.numFmt = "0.0%";
    c.alignment = { horizontal: "center", vertical: "middle" };
  } else {
    c.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  }
}

/** Baris data dengan zebra. Sel `null` ditulis kosong (mis. persen tanpa target). */
export function barisData(ws: ExcelJS.Worksheet, kolom: Kolom[], nilai: (ExcelJS.CellValue | null)[]) {
  const row = ws.addRow(nilai.map((v) => (v === null ? "" : v)));
  const zebra = row.number % 2 === 0;
  for (let i = 1; i <= kolom.length; i++) {
    const c = row.getCell(i);
    formatSel(c, kolom[i - 1]);
    c.font = { size: 10, color: { argb: "FF000000" } };
    if (zebra) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
  }
  return row;
}

/** Baris jumlah/rata-rata: tebal, latar hijau muda. `gabung` = jumlah kolom label yang di-merge. */
export function barisTotal(ws: ExcelJS.Worksheet, kolom: Kolom[], nilai: (ExcelJS.CellValue | null)[], gabung = 1) {
  const row = ws.addRow(nilai.map((v) => (v === null ? "" : v)));
  if (gabung > 1) ws.mergeCells(row.number, 1, row.number, gabung);
  for (let i = 1; i <= kolom.length; i++) {
    const c = row.getCell(i);
    formatSel(c, kolom[i - 1]);
    c.font = { bold: true, size: 10, color: { argb: "FF065F46" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HIJAU_MUDA } };
  }
  return row;
}

/** Tabel lengkap: header + data + (opsional) total. Lebar kolom diatur. */
export function tabel(
  ws: ExcelJS.Worksheet,
  kolom: Kolom[],
  data: (ExcelJS.CellValue | null)[][],
  total?: { nilai: (ExcelJS.CellValue | null)[]; gabung?: number },
  warnaHeader = HIJAU,
) {
  kolom.forEach((k, i) => (ws.getColumn(i + 1).width = k.lebar));
  gayaHeader(ws.addRow(kolom.map((k) => k.judul)), warnaHeader);
  for (const d of data) barisData(ws, kolom, d);
  if (total) barisTotal(ws, kolom, total.nilai, total.gabung);
}

/** Persen sebagai pecahan untuk format 0.0% (null bila target 0 → sel kosong, seperti "—" di aplikasi). */
export function rasio(realisasi: number, target: number): number | null {
  return target > 0 ? realisasi / target : null;
}

const aman = (s: string) => s.replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

/** Kirim workbook sebagai unduhan. Nama: SMART-LTT_<jenis>_<wilayah>_<periode>.xlsx (plan §6b). */
export async function kirimXlsx(wb: ExcelJS.Workbook, bagian: string[]): Promise<Response> {
  const buf = await wb.xlsx.writeBuffer();
  const nama = `SMART-LTT_${bagian.filter(Boolean).map(aman).join("_")}.xlsx`;
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nama}"; filename*=UTF-8''${encodeURIComponent(nama)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
