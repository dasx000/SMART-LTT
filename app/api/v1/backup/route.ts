import { NextResponse, type NextRequest } from "next/server";
import { jalankanApi } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tanggalIsoWIB } from "@/lib/format";
import { buatStreamBackup, headerBackup } from "@/lib/backup-stream";

/**
 * GET /api/v1/backup — izin: backup:baca
 * Unduh backup data SMART LTT (.json.gz) untuk bot VPS / cronjob otomatis.
 * Isi sama persis dengan /api/backup (backup manual Admin Kab); beda hanya autentikasi
 * (API key, bukan cookie) dan pencatatan riwayat (sumber='api', klien_id).
 */
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  return jalankanApi(req, "backup:baca", async (klien) => {
    const body = await buatStreamBackup(`API: ${klien.nama}`, async ({ jumlahBaris, ukuranByte }) => {
      const { error } = await supabaseAdmin().from("riwayat_backup").insert({
        nama: `Bot: ${klien.nama}`,
        jumlah_baris: jumlahBaris,
        ukuran_byte: ukuranByte,
        sumber: "api",
        klien_id: klien.id,
      });
      if (error) console.error("[backup-api] gagal mencatat riwayat:", error.message);
    });
    return new NextResponse(body, { status: 200, headers: headerBackup(tanggalIsoWIB(new Date())) });
  });
}
