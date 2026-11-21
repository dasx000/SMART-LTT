import { bacaPengguna } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tanggalIsoWIB } from "@/lib/format";
import { buatStreamBackup, headerBackup } from "@/lib/backup-stream";

/**
 * GET /api/backup — unduh backup data SMART LTT (.json.gz). HANYA Admin Kab.
 * Dibaca dengan service role (melewati RLS) — karena itu role diperiksa di sini, tanpa cache.
 * Logika stream ada di lib/backup-stream.ts (dipakai juga oleh /api/v1/backup).
 * Setelah selesai, dicatat di ltt.riwayat_backup.
 */
export const maxDuration = 120;

const teksErr = (pesan: string, status: number) =>
  new Response(pesan, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET() {
  const p = await bacaPengguna();
  if (!p) return teksErr("Silakan login terlebih dahulu.", 401);
  if (p.role !== "admin_kab") return teksErr("Hanya Admin Kabupaten yang boleh mengunduh backup.", 403);

  try {
    const body = await buatStreamBackup(p.nama, async ({ jumlahBaris, ukuranByte }) => {
      const { error } = await supabaseAdmin()
        .from("riwayat_backup")
        .insert({ pengguna_id: p.id, nama: p.nama, jumlah_baris: jumlahBaris, ukuran_byte: ukuranByte });
      if (error) console.error("[backup] gagal mencatat riwayat:", error.message);
    });
    return new Response(body, { headers: headerBackup(tanggalIsoWIB(new Date())) });
  } catch (e) {
    return teksErr(e instanceof Error ? e.message : "Gagal membuat backup.", 500);
  }
}
