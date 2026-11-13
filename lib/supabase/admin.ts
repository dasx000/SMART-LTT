import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env, serviceRoleKey } from "@/lib/env";

/**
 * Client service-role: MELEWATI RLS.
 * Hanya untuk: endpoint e-Pusluh (bot VPS), kelola akun auth (Admin Kab/BPP), ETL.
 * Setiap pemakai WAJIB sudah memeriksa hak akses sendiri sebelum memanggil ini.
 */
export function supabaseAdmin() {
  return createClient(env().NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
