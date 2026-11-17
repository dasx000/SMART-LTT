// Spesifikasi file Excel (JSON) — disusun di SERVER (ringan, hanya data), dirender jadi .xlsx di BROWSER
// oleh lib/excel.ts (ExcelJS dimuat saat tombol unduh diklik). Tanpa dependensi.

/** persen = 0.0%, persen2 = 0.00% (nilai pecahan, mis. 0.1311 → 13,11%) */
export type JenisKolom = "teks" | "angka" | "persen" | "persen2" | "bulat";
export type Kolom = { judul: string; lebar: number; jenis?: JenisKolom; rata?: "left" | "center" | "right" };

/** Isi sel: nilai biasa, atau objek dengan warna latar/teks khusus (ARGB, mis. "FFEF4444"). */
export type Sel = string | number | null | { v: string | number | null; bg?: string; fc?: string; tebal?: boolean };

export type Blok =
  /** Baris header (bisa >1 baris). `gabung` = [baris1, kol1, baris2, kol2] relatif blok (1-based). */
  | { t: "header"; baris: Sel[][]; warna?: string; gabung?: [number, number, number, number][] }
  | { t: "data"; baris: Sel[][] }
  /** Baris jumlah: tebal, hijau muda. `gabung` = jumlah kolom label yang di-merge. */
  | { t: "total"; nilai: Sel[]; gabung?: number }
  /** Baris judul grup (tebal, di-merge selebar tabel). */
  | { t: "grup"; teks: string }
  | { t: "kosong" }
  /** Teks catatan/legenda (di-merge selebar tabel). */
  | { t: "catatan"; teks: string; bg?: string; fc?: string };

export type Lembar = {
  nama: string;
  judul: string;
  info?: string[];
  kolom: Kolom[];
  beku?: { x?: number; y?: number };
  /** warna garis sel (ARGB); bawaan hitam tipis */
  garis?: string;
  /** matikan zebra baris data */
  tanpaZebra?: boolean;
  blok: Blok[];
};

export type SpesifikasiExcel = {
  /** bagian nama file → SMART-LTT_<bagian...>.xlsx */
  namaFile: string[];
  /** Nama file utuh tanpa .xlsx (boleh berspasi, tanpa awalan SMART-LTT_). Bila ada, dipakai menggantikan namaFile. */
  judulFile?: string;
  lembar: Lembar[];
};

export const HIJAU = "FF16A34A";
export const HIJAU_TUA = "FF166534";
export const HIJAU_MUDA = "FFDCFCE7";

/** Header satu baris dari judul kolom. */
export const headerKolom = (kolom: Kolom[], warna?: string): Blok => ({ t: "header", baris: [kolom.map((k) => k.judul)], warna });

/** Persen sebagai pecahan untuk format 0.0% (null bila target 0 → sel kosong). */
export function rasio(realisasi: number, target: number): number | null {
  return target > 0 ? realisasi / target : null;
}
