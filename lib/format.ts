// Format angka & tanggal gaya Indonesia, zona WIB.
// Dipakai di server dan client. Tanpa dependensi (Intl bawaan) agar ringan di HP.

export const ZONA_WIB = "Asia/Jakarta";

export const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
] as const;

export const NAMA_BULAN_PENDEK = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
] as const;

const fmtAngkaCache = new Map<number, Intl.NumberFormat>();

/** 1234.5 → "1.234,5" (maks. `maxDesimal` angka di belakang koma). */
export function formatAngka(nilai: number | null | undefined, maxDesimal = 2): string {
  const n = Number(nilai);
  if (!Number.isFinite(n)) return "0";
  let f = fmtAngkaCache.get(maxDesimal);
  if (!f) {
    f = new Intl.NumberFormat("id-ID", { maximumFractionDigits: maxDesimal });
    fmtAngkaCache.set(maxDesimal, f);
  }
  return f.format(n);
}

/** 12.5 → "12,50 Ha" */
export function formatHa(nilai: number | null | undefined): string {
  return `${formatAngka(nilai)} Ha`;
}

/**
 * Baca input desimal dari user: "1.234,5" / "1234,5" / "1234.5" → 1234.5.
 * Kosong → 0. Bukan angka → NaN (biar validator yang menolak).
 */
export function parseDesimal(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === "number") return input;
  let s = input.trim().replace(/\s+/g, "");
  if (s === "") return 0;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, ""); // titik = pemisah ribuan
  s = s.replace(",", ".");
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(s)) return Number.NaN;
  return Number.parseFloat(s);
}

const fmtTanggal = new Intl.DateTimeFormat("id-ID", {
  timeZone: ZONA_WIB, day: "numeric", month: "short", year: "numeric",
});
const fmtTanggalJam = new Intl.DateTimeFormat("id-ID", {
  timeZone: ZONA_WIB, day: "numeric", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit",
});
const fmtIso = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_WIB, year: "numeric", month: "2-digit", day: "2-digit",
});

/** → "13 Nov 2026" (WIB) */
export function formatTanggal(t: Date | string | number): string {
  return fmtTanggal.format(new Date(t));
}

/** → "13 Nov 2026, 14.05" (WIB) */
export function formatTanggalJam(t: Date | string | number): string {
  return fmtTanggalJam.format(new Date(t));
}

/** Tanggal WIB dalam format "YYYY-MM-DD" (untuk batas "hari ini"). */
export function tanggalIsoWIB(t: Date | string | number = new Date()): string {
  return fmtIso.format(new Date(t));
}
