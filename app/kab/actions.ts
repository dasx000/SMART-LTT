"use server";

import { revalidatePath } from "next/cache";
import { wajibRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseSiap } from "@/lib/env";
import { skemaEditLaporanKab } from "./skema";

export type ResponsAksiKab = {
  sukses: boolean;
  pesan: string;
};

/**
 * Edit laporan LTT oleh Admin Kabupaten
 * Dapat mengedit luas tanam, panen, bera, olah, dan metode penanaman (Regular/PM AAS)
 */
export async function editLaporanKabAction(formData: FormData): Promise<ResponsAksiKab> {
  await wajibRole("Admin_Kab");

  if (!supabaseSiap()) {
    return { sukses: false, pesan: "Koneksi Supabase belum aktif." };
  }

  const parse = skemaEditLaporanKab.safeParse({
    id: formData.get("id"),
    desaId: formData.get("desaId"),
    realisasiTanam: formData.get("realisasiTanam"),
    realisasiPanen: formData.get("realisasiPanen"),
    luasBera: formData.get("luasBera") || 0,
    realisasiOlah: formData.get("realisasiOlah") || 0,
    metodePenanaman: formData.get("metodePenanaman") || null,
    keterangan: formData.get("keterangan"),
  });

  if (!parse.success) {
    return {
      sukses: false,
      pesan: parse.error.issues[0]?.message ?? "Isian form tidak valid.",
    };
  }

  const { id, desaId, realisasiTanam, realisasiPanen, luasBera, realisasiOlah, metodePenanaman, keterangan } = parse.data;

  try {
    const supabase = await supabaseServer();

    const { error: errUpdate } = await supabase
      .from("laporan_ltt")
      .update({
        desa_id: desaId,
        realisasi_tanam: realisasiTanam,
        realisasi_panen: realisasiPanen,
        luas_bera: luasBera,
        realisasi_olah: realisasiOlah,
        metode_penanaman: metodePenanaman,
        keterangan: keterangan || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (errUpdate) {
      return { sukses: false, pesan: `Gagal memperbarui: ${errUpdate.message}` };
    }

    revalidatePath("/kab");
    return { sukses: true, pesan: "Laporan berhasil diperbarui oleh Admin Kabupaten!" };
  } catch (err: unknown) {
    const pesan = err instanceof Error ? err.message : "Terjadi kesalahan internal.";
    return { sukses: false, pesan };
  }
}

/**
 * Hapus laporan LTT oleh Admin Kabupaten (soft-delete)
 */
export async function hapusLaporanKabAction(id: number): Promise<ResponsAksiKab> {
  await wajibRole("Admin_Kab");

  if (!supabaseSiap()) {
    return { sukses: false, pesan: "Koneksi Supabase belum aktif." };
  }

  try {
    const supabase = await supabaseServer();

    const { error: errDel } = await supabase
      .from("laporan_ltt")
      .update({ dihapus_pada: new Date().toISOString() })
      .eq("id", id);

    if (errDel) {
      return { sukses: false, pesan: `Gagal menghapus: ${errDel.message}` };
    }

    revalidatePath("/kab");
    return { sukses: true, pesan: "Laporan berhasil dihapus oleh Admin Kabupaten." };
  } catch (err: unknown) {
    const pesan = err instanceof Error ? err.message : "Terjadi kesalahan internal.";
    return { sukses: false, pesan };
  }
}

