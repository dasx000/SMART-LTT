import "server-only";
import { z } from "zod";

const skema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  AUTH_EMAIL_DOMAIN: z.string().min(1).default("smartltt.local"),
});

let cache: z.infer<typeof skema> | null = null;

/** Env yang wajib untuk aplikasi. Dibaca saat dipakai, bukan saat build. */
export function env() {
  if (!cache) {
    const hasil = skema.safeParse(process.env);
    if (!hasil.success) {
      throw new Error(
        "Konfigurasi .env.local belum lengkap: " +
          hasil.error.issues.map((i) => i.path.join(".")).join(", "),
      );
    }
    cache = hasil.data;
  }
  return cache;
}

/** true jika Supabase sudah dikonfigurasi (dipakai untuk pesan ramah di halaman login). */
export function supabaseSiap(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Service role — hanya untuk endpoint e-Pusluh, cron, ETL. */
export function serviceRoleKey(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diisi.");
  return k;
}
