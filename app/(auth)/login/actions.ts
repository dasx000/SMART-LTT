"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { env, supabaseSiap } from "@/lib/env";
import { BERANDA_ROLE, type Role } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export type HasilLogin = { pesan: string } | null;

const skemaLogin = z.object({
  nip: z.string().trim().min(1, "NIP wajib diisi.").max(30).regex(/^[A-Za-z0-9._-]+$/, "NIP tidak valid."),
  password: z.string().min(1, "Password wajib diisi.").max(100),
});

export async function login(_prev: HasilLogin, formData: FormData): Promise<HasilLogin> {
  if (!supabaseSiap()) {
    return { pesan: "Server belum dikonfigurasi (Supabase). Hubungi admin." };
  }

  const cek = skemaLogin.safeParse({ nip: formData.get("nip"), password: formData.get("password") });
  if (!cek.success) return { pesan: cek.error.issues[0]?.message ?? "Isian tidak valid." };

  const { nip, password } = cek.data;
  const supabase = await supabaseServer();
  const email = `${nip.toLowerCase()}@${env().AUTH_EMAIL_DOMAIN}`;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    // Pesan sama untuk NIP salah & password salah agar NIP tidak bisa ditebak.
    return { pesan: "NIP atau password salah." };
  }

  const { data: profil } = await supabase
    .from("profiles")
    .select("role, aktif, wajib_ganti_password")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profil || !profil.aktif) {
    await supabase.auth.signOut();
    return { pesan: "Akun Anda nonaktif, silakan hubungi admin." };
  }

  if (profil.wajib_ganti_password) redirect("/ganti-password");
  redirect(BERANDA_ROLE[profil.role as Role]);
}

export async function logout() {
  if (supabaseSiap()) {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
