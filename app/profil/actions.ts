"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bacaPengguna } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type HasilProfil = { sukses: boolean; pesan: string } | null;

// Sama dengan aturan di kelola pengguna (app/kab/pengguna/actions.ts). Boleh dikosongkan.
const skema = z.object({
  whatsapp: z.string().trim().max(20, "Nomor WhatsApp terlalu panjang.").regex(/^[0-9+ -]*$/, "Nomor WhatsApp hanya boleh angka, +, spasi, atau -."),
});

/**
 * Profil sendiri: HANYA nomor WhatsApp (keputusan user 16 Nov 2026).
 * Nama & NIP dikunci — diubah Admin Kabupaten lewat menu kelola pengguna.
 * ltt.anggota tidak bisa di-update oleh role authenticated (RLS), jadi pakai service role,
 * dikunci ke user id milik sesi ini dan hanya kolom whatsapp.
 */
export async function simpanWhatsAppAction(_prev: HasilProfil, formData: FormData): Promise<HasilProfil> {
  const p = await bacaPengguna();
  if (!p) return { sukses: false, pesan: "Sesi Anda berakhir. Silakan login ulang." };

  const cek = skema.safeParse({ whatsapp: formData.get("whatsapp") ?? "" });
  if (!cek.success) return { sukses: false, pesan: cek.error.issues[0]?.message ?? "Isian tidak valid." };

  const { error } = await supabaseAdmin()
    .from("anggota")
    .update({ whatsapp: cek.data.whatsapp || null })
    .eq("user_id", p.id);
  if (error) return { sukses: false, pesan: `Gagal menyimpan: ${error.message}` };

  revalidatePath("/profil");
  revalidatePath("/kab/pengguna");
  revalidatePath("/bpp/pengguna");
  return { sukses: true, pesan: "Nomor WhatsApp tersimpan." };
}
