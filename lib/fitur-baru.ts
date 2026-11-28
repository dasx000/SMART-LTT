import { tanggalIsoWIB } from "@/lib/format";

/**
 * Fitur baru di beranda PPL: lencana "BARU" di ikon menu,
 * tampil sampai tanggal `sampai` (WIB, inklusif), lalu hilang sendiri.
 */
export const FITUR_BARU = {
  // Semua hilang mulai 31 Des 2026 (permintaan pengguna)
  opt: { nama: "Cari OPT", href: "/ppl/opt", sampai: "2026-12-30" },
  tanaman: { nama: "Pantau Tanaman", href: "/ppl/tanaman", sampai: "2026-12-30" },
  pupuk: { nama: "Kalkulator Pupuk", href: "/ppl/pupuk", sampai: "2026-12-30" },
} as const;

export type KunciFiturBaru = keyof typeof FITUR_BARU;

export function fiturBaruAktif(hariIni = tanggalIsoWIB()): Set<KunciFiturBaru> {
  return new Set((Object.keys(FITUR_BARU) as KunciFiturBaru[]).filter((k) => hariIni <= FITUR_BARU[k].sampai));
}
