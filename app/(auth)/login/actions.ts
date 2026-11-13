"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseSiap } from "@/lib/env";
import { BERANDA_ROLE, type Role } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type HasilLogin = { pesan: string } | null;

const PESAN_GAGAL = "NIP atau password salah.";

const skemaLogin = z.object({
  nip: z.string().trim().min(1, "NIP wajib diisi.").max(100),
  password: z.string().min(1, "Password wajib diisi.").max(100),
});

/**
 * Cari email login dari NIP di core.profiles (dipakai bersama aplikasi CWS, TANIKU, ...).
 * Dijalankan di server dengan service role — fungsi SQL-nya TIDAK dibuka untuk anon,
 * supaya orang luar tidak bisa menebak-nebak NIP untuk mendapatkan email pegawai.
 */
async function emailDariNip(nip: string): Promise<string | null> {
  if (nip.includes("@")) return nip.toLowerCase(); // boleh juga login pakai email
  const { data, error } = await supabaseAdmin().rpc("resolve_login_email", { p_nip: nip });
  if (error || typeof data !== "string" || !data) return null;
  return data;
}

export async function login(_prev: HasilLogin, formData: FormData): Promise<HasilLogin> {
  if (!supabaseSiap() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { pesan: "Server belum dikonfigurasi (Supabase). Hubungi admin." };
  }

  const cek = skemaLogin.safeParse({ nip: formData.get("nip"), password: formData.get("password") });
  if (!cek.success) return { pesan: cek.error.issues[0]?.message ?? "Isian tidak valid." };

  const { nip, password } = cek.data;
  const email = await emailDariNip(nip);
  // Pesan sama untuk NIP tidak terdaftar & password salah agar NIP tidak bisa ditebak.
  if (!email) return { pesan: PESAN_GAGAL };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { pesan: PESAN_GAGAL };

  // Akun ada di project bersama, tapi belum tentu punya akses SMART LTT.
  const { data } = await supabase.rpc("pengguna_saya");
  const p = Array.isArray(data) ? data[0] : data;
  if (!p) {
    await supabase.auth.signOut();
    return { pesan: "Akun Anda belum terdaftar di SMART LTT. Hubungi admin." };
  }
  if (!p.aktif) {
    await supabase.auth.signOut();
    return { pesan: "Akun Anda nonaktif, silakan hubungi admin." };
  }

  if (p.wajib_ganti_password) redirect("/ganti-password");
  redirect(BERANDA_ROLE[p.role as Role]);
}

export async function logout() {
  if (supabaseSiap()) {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
