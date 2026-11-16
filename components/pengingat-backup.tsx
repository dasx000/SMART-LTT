import Link from "next/link";
import { DatabaseBackup } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { formatTanggalJam, tanggalIsoWIB } from "@/lib/format";
import { BATAS_HARI_BACKUP } from "@/lib/backup";

export type BackupTerakhir = { waktu: string; nama: string | null } | null;

/** Backup terakhir (RLS: hanya Admin Kab yang bisa membaca; role lain → null). */
export async function ambilBackupTerakhir(): Promise<BackupTerakhir> {
  const s = await supabaseServer();
  const { data, error } = await s.from("riwayat_backup").select("waktu, nama").order("waktu", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  return data;
}

/**
 * Selisih hari KALENDER menurut WIB (bukan kelipatan 24 jam): backup tgl 16 pukul 20.00
 * dilihat tgl 17 pukul 08.00 → 1 hari lalu, bukan "hari ini".
 */
export const hariSejak = (waktu: string) =>
  Math.round((Date.parse(tanggalIsoWIB()) - Date.parse(tanggalIsoWIB(waktu))) / 86_400_000);

/** Pita pengingat di dashboard Admin Kab. Hijau ≤ 7 hari, merah lebih lama / belum pernah. */
export async function PengingatBackup() {
  const b = await ambilBackupTerakhir();
  const hari = b ? hariSejak(b.waktu) : null;
  const telat = hari === null || hari > BATAS_HARI_BACKUP;
  const teks =
    hari === null
      ? "Belum pernah ada backup data. Silakan unduh backup."
      : `Backup terakhir ${hari === 0 ? "hari ini" : `${hari} hari lalu`} (${formatTanggalJam(b!.waktu)}${b!.nama ? `, oleh ${b!.nama}` : ""}).${telat ? " Silakan unduh backup." : ""}`;

  return (
    <Link
      href="/kab/backup"
      className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition hover:opacity-90 ${
        telat ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"
      }`}
    >
      <DatabaseBackup size={16} className="shrink-0" />
      <span>{teks}</span>
    </Link>
  );
}
