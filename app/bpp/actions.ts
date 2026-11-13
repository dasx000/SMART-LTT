"use server";

import { revalidatePath } from "next/cache";
import { wajibRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseSiap } from "@/lib/env";
import { skemaTargetKecamatan, skemaEditLaporanBpp } from "./skema";

export type ResponsAksiBpp = {
  sukses: boolean;
  pesan: string;
};

/**
 * Simpan / perbarui target kecamatan (diisi oleh Admin BPP)
 */
export async function simpanTargetKecamatanAction(formData: FormData): Promise<ResponsAksiBpp> {
  const pengguna = await wajibRole("Admin_BPP", "Admin_Kab");

  if (!supabaseSiap()) {
    return { sukses: false, pesan: "Koneksi Supabase belum aktif." };
  }

  const parse = skemaTargetKecamatan.safeParse({
    bulan: formData.get("bulan"),
    komoditas: formData.get("komoditas"),
    targetTanam: formData.get("targetTanam"),
    targetPanen: formData.get("targetPanen"),
  });

  if (!parse.success) {
    return {
      sukses: false,
      pesan: parse.error.issues[0]?.message ?? "Isian target tidak valid.",
    };
  }

  const { bulan, komoditas, targetTanam, targetPanen } = parse.data;
  const kecamatanId = pengguna.kecamatanId;

  if (!kecamatanId) {
    return { sukses: false, pesan: "Akun Anda belum terikat ke kecamatan tertentu." };
  }

  try {
    const supabase = await supabaseServer();

    const { error } = await supabase.from("target_kecamatan").upsert(
      {
        bulan,
        kecamatan_id: kecamatanId,
        komoditas,
        target_tanam: targetTanam,
        target_panen: targetPanen,
        pembuat_id: pengguna.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "bulan, kecamatan_id, komoditas" }
    );

    if (error) {
      return { sukses: false, pesan: `Gagal menyimpan target: ${error.message}` };
    }

    revalidatePath("/bpp");
    return { sukses: true, pesan: `Target ${komoditas} bulan ${bulan} berhasil disimpan!` };
  } catch (err: unknown) {
    const pesan = err instanceof Error ? err.message : "Terjadi kesalahan internal.";
    return { sukses: false, pesan };
  }
}

/**
 * Edit laporan LTT oleh Koordinator BPP
 */
export async function editLaporanBppAction(formData: FormData): Promise<ResponsAksiBpp> {
  const pengguna = await wajibRole("Admin_BPP", "Admin_Kab");

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

    if (pengguna.role === "Admin_BPP" && desa.kecamatan_id !== pengguna.kecamatanId) {
      return { sukses: false, pesan: "Anda hanya berwenang mengubah laporan di kecamatan Anda." };
    }

    const { error: errUpdate } = await supabase
      .from("laporan_ltt")
      .update({
        desa_id: desaId,
        realisasi_tanam: realisasiTanam,
        realisasi_panen: realisasiPanen,
        keterangan: keterangan || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (errUpdate) {
      return { sukses: false, pesan: `Gagal memperbarui: ${errUpdate.message}` };
    }

    revalidatePath("/bpp");
    return { sukses: true, pesan: "Laporan berhasil diperbarui oleh BPP!" };
  } catch (err: unknown) {
    const pesan = err instanceof Error ? err.message : "Terjadi kesalahan internal.";
    return { sukses: false, pesan };
  }
}

/**
 * Hapus laporan LTT oleh Koordinator BPP (soft-delete)
 */
export async function hapusLaporanBppAction(id: number): Promise<ResponsAksiBpp> {
  const pengguna = await wajibRole("Admin_BPP", "Admin_Kab");

  if (!supabaseSiap()) {
    return { sukses: false, pesan: "Koneksi Supabase belum aktif." };
  }

  try {
    const supabase = await supabaseServer();

    const { data: lap, error: errLap } = await supabase
      .from("laporan_ltt")
      .select("id, desa:desa_id(kecamatan_id)")
      .eq("id", id)
      .is("dihapus_pada", null)
      .single();

    if (errLap || !lap) {
      return { sukses: false, pesan: "Laporan tidak ditemukan." };
    }

    const d = lap.desa as unknown as { kecamatan_id: number } | null;
    if (pengguna.role === "Admin_BPP" && d?.kecamatan_id !== pengguna.kecamatanId) {
      return { sukses: false, pesan: "Anda hanya berwenang menghapus laporan di kecamatan Anda." };
    }

    const { error: errDel } = await supabase
      .from("laporan_ltt")
      .update({ dihapus_pada: new Date().toISOString() })
      .eq("id", id);

    if (errDel) {
      return { sukses: false, pesan: `Gagal menghapus: ${errDel.message}` };
    }

    revalidatePath("/bpp");
    return { sukses: true, pesan: "Laporan berhasil dihapus oleh BPP." };
  } catch (err: unknown) {
    const pesan = err instanceof Error ? err.message : "Terjadi kesalahan internal.";
    return { sukses: false, pesan };
  }
}
