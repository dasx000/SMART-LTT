"use server";

import { revalidatePath } from "next/cache";
import { wajibRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseSiap } from "@/lib/env";
import { skemaLaporanLtt, skemaEditLaporanLtt } from "./skema";

export type ResponsAksi = {
  sukses: boolean;
  pesan: string;
};

/**
 * Simpan laporan baru LTT Jagung / Ubi Kayu oleh PPL
 */
export async function simpanLaporanAction(formData: FormData): Promise<ResponsAksi> {
  const pengguna = await wajibRole("Penyuluh", "Admin_BPP");

  if (!supabaseSiap()) {
    return { sukses: false, pesan: "Koneksi Supabase belum aktif." };
  }

  const parse = skemaLaporanLtt.safeParse({
    desaId: formData.get("desaId"),
    komoditas: formData.get("komoditas"),
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

  const { desaId, komoditas, realisasiTanam, realisasiPanen, keterangan } = parse.data;

  // Jika luas tanam dan panen keduanya 0, ingatkan pengguna sesuai aturan bisnis lama
  if (realisasiTanam === 0 && realisasiPanen === 0) {
    return {
      sukses: false,
      pesan: "Luas tanam atau luas panen harus lebih dari 0. Jika nihil, tidak perlu mengisi laporan.",
    };
  }

  try {
    const supabase = await supabaseServer();

    // Pastikan desa termasuk wilayah binaan atau kecamatannya
    const { data: desa, error: errDesa } = await supabase
      .from("desa")
      .select("id, nama, kecamatan_id")
      .eq("id", desaId)
      .single();

    if (errDesa || !desa) {
      return { sukses: false, pesan: "Desa tidak ditemukan." };
    }

    const { error: errInsert } = await supabase.from("laporan_ltt").insert({
      tanggal_lapor: new Date().toISOString(),
      pelapor_id: pengguna.id,
      nama_pelapor: pengguna.nama,
      nip_pelapor: pengguna.nip,
      desa_id: desaId,
      komoditas,
      realisasi_tanam: realisasiTanam,
      realisasi_panen: realisasiPanen,
      keterangan: keterangan || null,
      sumber: "manual",
    });

    if (errInsert) {
      return { sukses: false, pesan: `Gagal menyimpan: ${errInsert.message}` };
    }

    revalidatePath("/ppl");
    return { sukses: true, pesan: `Laporan ${komoditas} desa ${desa.nama} berhasil disimpan!` };
  } catch (err: unknown) {
    const pesan = err instanceof Error ? err.message : "Terjadi kesalahan internal.";
    return { sukses: false, pesan };
  }
}

/**
 * Edit laporan LTT oleh PPL (hanya laporan hari ini)
 */
export async function editLaporanAction(formData: FormData): Promise<ResponsAksi> {
  const pengguna = await wajibRole("Penyuluh", "Admin_BPP");

  if (!supabaseSiap()) {
    return { sukses: false, pesan: "Koneksi Supabase belum aktif." };
  }

  const parse = skemaEditLaporanLtt.safeParse({
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

    // Query laporan untuk pastikan kepemilikan
    const { data: lap, error: errLap } = await supabase
      .from("laporan_ltt")
      .select("id, pelapor_id, komoditas")
      .eq("id", id)
      .is("dihapus_pada", null)
      .single();

    if (errLap || !lap) {
      return { sukses: false, pesan: "Laporan tidak ditemukan atau sudah dihapus." };
    }

    // Hanya pelapor atau Admin_BPP yang bisa edit
    if (pengguna.role === "Penyuluh" && lap.pelapor_id !== pengguna.id) {
      return { sukses: false, pesan: "Anda hanya dapat mengedit laporan yang Anda input sendiri." };
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

    revalidatePath("/ppl");
    return { sukses: true, pesan: "Laporan berhasil diperbarui!" };
  } catch (err: unknown) {
    const pesan = err instanceof Error ? err.message : "Terjadi kesalahan internal.";
    return { sukses: false, pesan };
  }
}

/**
 * Hapus laporan LTT (soft-delete)
 */
export async function hapusLaporanAction(id: number): Promise<ResponsAksi> {
  const pengguna = await wajibRole("Penyuluh", "Admin_BPP");

  if (!supabaseSiap()) {
    return { sukses: false, pesan: "Koneksi Supabase belum aktif." };
  }

  try {
    const supabase = await supabaseServer();

    const { data: lap, error: errLap } = await supabase
      .from("laporan_ltt")
      .select("id, pelapor_id")
      .eq("id", id)
      .is("dihapus_pada", null)
      .single();

    if (errLap || !lap) {
      return { sukses: false, pesan: "Laporan tidak ditemukan." };
    }

    if (pengguna.role === "Penyuluh" && lap.pelapor_id !== pengguna.id) {
      return { sukses: false, pesan: "Anda hanya dapat menghapus laporan Anda sendiri." };
    }

    const { error: errDel } = await supabase
      .from("laporan_ltt")
      .update({ dihapus_pada: new Date().toISOString() })
      .eq("id", id);

    if (errDel) {
      return { sukses: false, pesan: `Gagal menghapus: ${errDel.message}` };
    }

    revalidatePath("/ppl");
    return { sukses: true, pesan: "Laporan berhasil dihapus." };
  } catch (err: unknown) {
    const pesan = err instanceof Error ? err.message : "Terjadi kesalahan internal.";
    return { sukses: false, pesan };
  }
}

