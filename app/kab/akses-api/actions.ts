"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { wajibRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DAFTAR_IZIN, buatKunci, type Izin } from "@/lib/api";

export type HasilKunci = { sukses: boolean; pesan: string; kunci?: string };

const skema = z.object({
  nama: z.string().trim().min(2, "Nama klien minimal 2 huruf.").max(80, "Nama klien maksimal 80 huruf."),
  izin: z.array(z.enum(DAFTAR_IZIN as [Izin, ...Izin[]])).min(1, "Pilih minimal satu izin."),
});

/** Buat kunci API baru. Kunci asli hanya dikembalikan SEKALI; yang disimpan hanya hash-nya. */
export async function buatKunciAction(fd: FormData): Promise<HasilKunci> {
  const p = await wajibRole("admin_kab");
  const parse = skema.safeParse({ nama: fd.get("nama"), izin: fd.getAll("izin") });
  if (!parse.success) return { sukses: false, pesan: parse.error.issues[0]?.message ?? "Isian tidak valid." };

  const { kunci, hash, awalan } = buatKunci();
  const { error } = await supabaseAdmin()
    .from("api_klien")
    .insert({ nama: parse.data.nama, izin: parse.data.izin, hash, awalan, dibuat_oleh: p.id });
  if (error) return { sukses: false, pesan: `Gagal membuat kunci: ${error.message}` };

  revalidatePath("/kab/akses-api");
  return { sukses: true, pesan: "Kunci dibuat. Salin sekarang — kunci tidak bisa ditampilkan lagi.", kunci };
}

/** Hapus kunci yang SUDAH DICABUT beserta catatan pemakaiannya. Kunci aktif harus dicabut dulu. */
export async function hapusKunciAction(id: string): Promise<{ sukses: boolean; pesan: string }> {
  await wajibRole("admin_kab");
  if (!z.uuid().safeParse(id).success) return { sukses: false, pesan: "ID tidak valid." };
  const { data, error } = await supabaseAdmin().from("api_klien").delete().eq("id", id).eq("aktif", false).select("id");
  if (error) return { sukses: false, pesan: `Gagal menghapus: ${error.message}` };
  if (!data?.length) return { sukses: false, pesan: "Kunci tidak ditemukan atau masih aktif (cabut dulu)." };
  revalidatePath("/kab/akses-api");
  return { sukses: true, pesan: "Kunci dihapus." };
}

/** Cabut kunci: langsung tidak bisa dipakai. Tidak bisa diaktifkan lagi (buat kunci baru bila perlu). */
export async function cabutKunciAction(id: string): Promise<{ sukses: boolean; pesan: string }> {
  await wajibRole("admin_kab");
  if (!z.uuid().safeParse(id).success) return { sukses: false, pesan: "ID tidak valid." };
  const { data, error } = await supabaseAdmin()
    .from("api_klien")
    .update({ aktif: false, dicabut_pada: new Date().toISOString() })
    .eq("id", id)
    .eq("aktif", true)
    .select("id");
  if (error) return { sukses: false, pesan: `Gagal mencabut: ${error.message}` };
  if (!data?.length) return { sukses: false, pesan: "Kunci tidak ditemukan atau sudah dicabut." };
  revalidatePath("/kab/akses-api");
  return { sukses: true, pesan: "Kunci dicabut dan tidak bisa dipakai lagi." };
}
