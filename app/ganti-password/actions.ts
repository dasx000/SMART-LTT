"use server";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { bacaPengguna } from "@/lib/auth";
import { env } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type HasilGanti = { sukses: boolean; pesan: string } | null;

const skema = z
  .object({
    lama: z.string().min(1, "Password lama wajib diisi.").max(100),
    baru: z.string().min(6, "Password baru minimal 6 karakter.").max(72, "Password baru maksimal 72 karakter."),
    ulang: z.string(),
  })
  .refine((d) => d.baru === d.ulang, { message: "Ulangi password baru tidak sama.", path: ["ulang"] })
  .refine((d) => d.baru !== d.lama, { message: "Password baru harus berbeda dari password lama.", path: ["baru"] });

/**
 * Ganti password sendiri (tidak wajib — keputusan user 16 Nov 2026).
 * 1. Sesi dibaca ulang (tanpa cache) → user id + email dari Supabase Auth.
 * 2. Password lama dicek lewat client terpisah tanpa cookie, supaya sesi yang sedang dipakai tidak terganggu.
 * 3. Password diganti lewat service role (tidak terkena aturan "reauthenticate" Supabase),
 *    hanya untuk user id milik sesi ini.
 * Akun bersama: password baru juga berlaku di aplikasi lain (CWS, TANIKU, ...).
 */
export async function gantiPasswordAction(_prev: HasilGanti, formData: FormData): Promise<HasilGanti> {
  const p = await bacaPengguna();
  if (!p) return { sukses: false, pesan: "Sesi Anda berakhir. Silakan login ulang." };

  const cek = skema.safeParse({ lama: formData.get("lama"), baru: formData.get("baru"), ulang: formData.get("ulang") });
  if (!cek.success) return { sukses: false, pesan: cek.error.issues[0]?.message ?? "Isian tidak valid." };

  const { data: u } = await (await supabaseServer()).auth.getUser();
  const email = u.user?.id === p.id ? u.user.email : undefined;
  if (!email) return { sukses: false, pesan: "Sesi Anda berakhir. Silakan login ulang." };

  const uji = createClient(env().NEXT_PUBLIC_SUPABASE_URL, env().NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const masuk = await uji.auth.signInWithPassword({ email, password: cek.data.lama });
  if (masuk.error || masuk.data.user?.id !== p.id) return { sukses: false, pesan: "Password lama salah." };
  await uji.auth.signOut({ scope: "local" });

  const a = supabaseAdmin();
  const { error } = await a.auth.admin.updateUserById(p.id, { password: cek.data.baru });
  if (error) return { sukses: false, pesan: `Gagal mengganti password: ${error.message}` };
  await a.from("anggota").update({ wajib_ganti_password: false }).eq("user_id", p.id);

  return { sukses: true, pesan: "Password berhasil diganti. Gunakan password baru saat login berikutnya (juga di aplikasi lain yang memakai akun yang sama)." };
}
