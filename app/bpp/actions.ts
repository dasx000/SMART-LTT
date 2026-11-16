"use server";

import { revalidatePath } from "next/cache";
import { wajibRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseSiap } from "@/lib/env";
import { skemaEditLaporanBpp } from "./skema";

export type ResponsAksiBpp = {
  sukses: boolean;
  pesan: string;
};

/**
 * Edit laporan LTT oleh Koordinator BPP
 */
export async function editLaporanBppAction(formData: FormData): Promise<ResponsAksiBpp> {
  const pengguna = await wajibRole("admin_bpp");

  if (!supabaseSiap()) {
    return { sukses: false, pesan: "Koneksi Supabase belum aktif." };
  }

  const parse = skemaEditLaporanBpp.safeParse({
    id: formData.get("id"),
    desaId: formData.get("desaId"),
    realisasiTanam: formData.get("realisasiTanam"),
    realisasiPanen: formData.get("realisasiPanen"),
    keterangan: formData.get("keterangan"),
  });

  if (!parse.success) {
    return {
      sukses: false,
      pesan: parse.error.issues[0]?.message ?? "Isian form tidak valid.",
    };
  }

  const { id, desaId, realisasiTanam, realisasiPanen, keterangan } = parse.data;

  try {
    const supabase = await supabaseServer();

    // Pastikan desa berada dalam kecamatan yang dinaungi oleh BPP
    const { data: desa, error: errDesa } = await supabase
      .from("desa")
      .select("id, nama, kecamatan_id")
      .eq("id", desaId)
      .single();

    if (errDesa || !desa) {
      return { sukses: false, pesan: "Desa tidak ditemukan." };
    }

    if (pengguna.role === "admin_bpp" && desa.kecamatan_id !== pengguna.kecamatanId) {
      return { sukses: false, pesan: "Anda hanya berwenang mengubah laporan di kecamatan Anda." };
    }

    const { data: berubahUpdate, error: errUpdate } = await supabase
      .from("laporan_ltt")
      .update({
        desa_id: desaId,
        realisasi_tanam: realisasiTanam,
        realisasi_panen: realisasiPanen,
        keterangan: keterangan || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id");

    if (errUpdate) {
      return { sukses: false, pesan: `Gagal memperbarui: ${errUpdate.message}` };
    }

    // RLS menolak diam-diam (0 baris) → jangan laporkan "berhasil"
    if (!berubahUpdate?.length) {
      return { sukses: false, pesan: "Tidak ada data yang berubah. Laporan mungkin sudah dihapus atau di luar wilayah kewenangan Anda." };
    }

    revalidatePath("/bpp", "layout");
    return { sukses: true, pesan: "Laporan berhasil diperbarui oleh BPP!" };
  } catch (err: unknown) {
    const pesan = err instanceof Error ? err.message : "Terjadi kesalahan internal.";
    return { sukses: false, pesan };
  }
}
