import "server-only";
import type { Supa } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const KUNCI_NOTIF_PPL = "notifikasi_ppl";

export type SakelarNotif = { aktif: boolean; updatedAt: string | null; diubahOleh: string | null };

/**
 * Sakelar global notifikasi PPL (diatur Admin Kab di /kab/notifikasi).
 * Baris belum ada → dianggap AKTIF (nilai bawaan migrasi 0016).
 * Tanpa `s` → dibaca dengan service role (cron, Server Action).
 */
export async function sakelarNotifPpl(s?: Supa): Promise<SakelarNotif> {
  const { data, error } = await (s ?? supabaseAdmin())
    .from("pengaturan")
    .select("nilai, updated_at, diubah_oleh")
    .eq("kunci", KUNCI_NOTIF_PPL)
    .maybeSingle();
  if (error || !data) return { aktif: true, updatedAt: null, diubahOleh: null };
  const nilai = (data.nilai ?? {}) as { aktif?: unknown };
  return { aktif: nilai.aktif !== false, updatedAt: data.updated_at, diubahOleh: data.diubah_oleh };
}
