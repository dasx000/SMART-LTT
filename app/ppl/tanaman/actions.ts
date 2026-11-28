"use server";

import { revalidatePath } from "next/cache";
import { wajibRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseSiap } from "@/lib/env";
import { desaBinaanSaya } from "@/lib/data";
import { kunciKartu, muatPantau } from "./data";

export type ResponsSelesai = { sukses: boolean; pesan: string };

export type KartuDitandai = {
  desaId: number;
  komoditas: string;
  jenisLtt: string;
  metode: string;
  tanggalTanam: string;
};

/**
 * "Tandai Selesai" — simpan kartu Pantau Tanaman ke ltt.pantau_selesai supaya tidak tampil lagi.
 * Hanya menyembunyikan kartu; laporan_ltt tidak disentuh. Luas tanam & sisa dihitung ulang di server
 * (bukan dari browser) sebagai patokan "muncul lagi kalau data diperbarui".
 */
export async function tandaiSelesaiAction(k: KartuDitandai): Promise<ResponsSelesai> {
  const p = await wajibRole("penyuluh", "admin_bpp");
  if (!supabaseSiap()) return { sukses: false, pesan: "Koneksi Supabase belum aktif." };
  if (!Number.isInteger(k?.desaId) || !/^\d{4}-\d{2}-\d{2}$/.test(String(k?.tanggalTanam))) {
    return { sukses: false, pesan: "Permintaan tidak valid." };
  }

  const s = await supabaseServer();
  const desa = await desaBinaanSaya(s, p.id);
  if (!desa.some((d) => d.id === k.desaId)) return { sukses: false, pesan: "Desa ini bukan desa binaan Anda." };

  const kartu = (await muatPantau(s, [k.desaId])).find((x) => kunciKartu(x) === kunciKartu(k));
  if (!kartu) {
    // Sudah tidak ada (mis. panennya baru saja dilaporkan) — cukup segarkan halaman.
    revalidatePath("/ppl/tanaman");
    return { sukses: true, pesan: "Kartu sudah tidak ada." };
  }

  const { error } = await s.from("pantau_selesai").upsert(
    {
      desa_id: kartu.desaId,
      komoditas: kartu.komoditas,
      jenis_ltt: kartu.jenisLtt,
      metode: kartu.metode,
      tanggal_tanam: kartu.tanggalTanam,
      luas_tanam: Math.round(kartu.luasTanam * 100) / 100,
      sisa: kartu.sisa,
      ditandai_oleh: p.id,
    },
    { onConflict: "desa_id,komoditas,jenis_ltt,metode,tanggal_tanam" },
  );
  if (error) {
    console.error("[pantau-tanaman] tandai selesai:", error.message);
    return { sukses: false, pesan: "Gagal menyimpan. Coba lagi." };
  }

  revalidatePath("/ppl/tanaman");
  return { sukses: true, pesan: "Kartu dihilangkan." };
}
