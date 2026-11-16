import ExcelJS from "exceljs";
import { HIJAU, HIJAU_MUDA, type Kolom, type Lembar, type Sel, type SpesifikasiExcel } from "@/lib/excel-spec";

/**
 * Perender Excel di BROWSER: SpesifikasiExcel (JSON dari /api/unduh/...) → file .xlsx.
 * Modul ini hanya di-import secara dinamis oleh tombol unduh, jadi ExcelJS tidak ikut JS awal halaman.
 * Gaya mengikuti aplikasi lama: judul tebal, info periode, waktu unduh miring abu-abu,
 * header hijau tulisan putih, garis tipis, zebra, baris total hijau muda.
 */

const ZEBRA = "FFF9FAFB";
const buatGaris = (argb?: string): Partial<ExcelJS.Borders> => {
  const g = { style: "thin" as const, ...(argb ? { color: { argb } } : {}) };
  return { top: g, left: g, bottom: g, right: g };
};
let garis = buatGaris();

function waktuUnduh(): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(new Date());
}

const nilaiSel = (s: Sel) => (s !== null && typeof s === "object" ? s.v : s) ?? "";

function formatSel(c: ExcelJS.Cell, k: Kolom | undefined) {
  c.border = garis;
  if (k?.jenis === "angka") {
    c.numFmt = "#,##0.00";
    c.alignment = { horizontal: "right", vertical: "middle" };
  } else if (k?.jenis === "bulat") {
    c.numFmt = "#,##0";
    c.alignment = { horizontal: "right", vertical: "middle" };
  } else if (k?.jenis === "persen" || k?.jenis === "persen2") {
    c.numFmt = k.jenis === "persen2" ? "0.00%" : "0.0%";
    c.alignment = { horizontal: "center", vertical: "middle" };
  } else {
    c.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  }
  if (k?.rata) c.alignment = { ...c.alignment, horizontal: k.rata };
}

function warnaKhusus(c: ExcelJS.Cell, s: Sel) {
  if (s === null || typeof s !== "object") return;
  if (s.bg) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: s.bg } };
  if (s.fc || s.tebal) c.font = { ...c.font, ...(s.fc ? { color: { argb: s.fc } } : {}), ...(s.tebal ? { bold: true } : {}) };
}

function tulisLembar(wb: ExcelJS.Workbook, l: Lembar) {
  const ws = wb.addWorksheet(l.nama.slice(0, 31), l.beku ? { views: [{ state: "frozen", xSplit: l.beku.x ?? 0, ySplit: l.beku.y ?? 0 }] } : undefined);
  const n = l.kolom.length;
  garis = buatGaris(l.garis);
  l.kolom.forEach((k, i) => (ws.getColumn(i + 1).width = k.lebar));

  const kepala = [l.judul, ...(l.info ?? []), `Waktu Unduh: ${waktuUnduh()}`];
  kepala.forEach((teks, i) => {
    const r = i + 1;
    ws.mergeCells(r, 1, r, n);
    const c = ws.getCell(r, 1);
    c.value = teks;
    c.alignment = { horizontal: "center" };
    if (i === 0) c.font = { bold: true, size: 14, color: { argb: "FF1F2937" } };
    else if (i === kepala.length - 1) c.font = { italic: true, size: 9, color: { argb: "FF6B7280" } };
    else c.font = { bold: true, size: 10, color: { argb: "FF4B5563" } };
  });
  ws.addRow([]);

  for (const b of l.blok) {
    if (b.t === "header") {
      const awal = ws.rowCount + 1;
      for (const isi of b.baris) {
        const row = ws.addRow(isi.map(nilaiSel));
        row.height = 22;
        for (let i = 1; i <= n; i++) {
          const c = row.getCell(i);
          c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: b.warna ?? HIJAU } };
          c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          c.border = garis;
          warnaKhusus(c, isi[i - 1] ?? null);
        }
      }
      for (const [r1, c1, r2, c2] of b.gabung ?? []) ws.mergeCells(awal + r1 - 1, c1, awal + r2 - 1, c2);
    } else if (b.t === "data") {
      for (const isi of b.baris) {
        const row = ws.addRow(isi.map(nilaiSel));
        const zebra = !l.tanpaZebra && row.number % 2 === 0;
        for (let i = 1; i <= n; i++) {
          const c = row.getCell(i);
          formatSel(c, l.kolom[i - 1]);
          c.font = { size: 10, color: { argb: "FF000000" } };
          if (zebra) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
          warnaKhusus(c, isi[i - 1] ?? null);
        }
      }
    } else if (b.t === "total") {
      const row = ws.addRow(b.nilai.map(nilaiSel));
      if ((b.gabung ?? 1) > 1) ws.mergeCells(row.number, 1, row.number, b.gabung!);
      for (let i = 1; i <= n; i++) {
        const c = row.getCell(i);
        formatSel(c, l.kolom[i - 1]);
        c.font = { bold: true, size: 10, color: { argb: "FF065F46" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HIJAU_MUDA } };
        warnaKhusus(c, b.nilai[i - 1] ?? null);
      }
    } else if (b.t === "grup") {
      const row = ws.addRow([b.teks]);
      ws.mergeCells(row.number, 1, row.number, n);
      row.getCell(1).font = { bold: true };
    } else if (b.t === "catatan") {
      const row = ws.addRow([b.teks]);
      ws.mergeCells(row.number, 1, row.number, n);
      const c = row.getCell(1);
      c.font = { size: 9, color: { argb: b.fc ?? "FF4B5563" } };
      if (b.bg) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: b.bg } };
      c.alignment = { vertical: "middle", wrapText: true };
    } else {
      ws.addRow([]);
    }
  }
}

const aman = (s: string) => s.replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

/** Render spesifikasi → .xlsx lalu picu unduhan di browser. */
export async function unduhExcel(spec: SpesifikasiExcel) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SMART LTT";
  wb.created = new Date();
  for (const l of spec.lembar) tulisLembar(wb, l);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SMART-LTT_${spec.namaFile.filter(Boolean).map(aman).join("_")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
