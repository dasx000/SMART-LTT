import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Client Supabase atas nama user yang login (RLS berlaku).
 * Satu-satunya jalur data aplikasi: dipanggil dari Server Component / Server Action.
 * Browser tidak pernah query Supabase langsung (keputusan plan §11 no. 17).
 */
export async function supabaseServer() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = env();
  const cookieStore = await cookies();

  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Dipanggil dari Server Component (cookie read-only). Aman diabaikan:
          // proxy.ts yang menyegarkan cookie sesi di setiap navigasi.
        }
      },
    },
  });
}
