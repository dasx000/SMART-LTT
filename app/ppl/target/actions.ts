"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { wajibRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { angkaHa } from "@/lib/validasi";

export type HasilAksi = { sukses: boolean; pesan: string };

const skema = z.object({
  bulan: z.number().int().min(1).max(12),
  desaId: z.number().int().positive(),
  komoditas: z.enum(["Padi", "Jagung", "Ubi Kayu"]),
  targetTanam: angkaHa("Target tanam"),
  targetPanen: angkaHa("Target panen"),
  luasBaku: angkaHa("Luas baku"),
  rincian: z
    .array(z.object({ jenisId: z.number().int().positive(), tanam: angkaHa("Target tanam"), panen: angkaHa("Target panen") }))
    .max(20)
    .default([]),
});

export type InputTargetDesa = z.input<typeof skema>;

/**
 * Simpan target satu desa untuk (bulan, komoditas) — logika-bisnis §23h.
 * Padi: total tanam/panen = jumlah rincian per jenis (dihitung di server, bukan dari form).
 * Hak: penyuluh = desa binaannya; admin_bpp = desa di kecamatannya (isi target untuk PPL-nya)
 * atau desa binaannya sendiri. RLS target_desa memeriksa ulang di database.
 */
export async function simpanTargetDesaAction(input: InputTargetDesa): Promise<HasilAksi> {
  const p = await wajibRole("penyuluh", "admin_bpp");
  const cek = skema.safeParse(input);
  if (!cek.success) return { sukses: false, pesan: cek.error.issues[0]?.message ?? "Isian tidak valid." };
  const d = cek.data;

  const s = await supabaseServer();

  // Hak atas desa
  const [{ data: desa }, { data: binaan }] = await Promise.all([
    s.from("desa").select("id, nama, kecamatan_id").eq("id", d.desaId).maybeSingle(),
    s.from("anggota_desa").select("desa_id").eq("user_id", p.id).eq("desa_id", d.desaId).maybeSingle(),
  ]);
  if (!desa) return { sukses: false, pesan: "Desa tidak ditemukan." };
  const boleh = Boolean(binaan) || (p.role === "admin_bpp" && desa.kecamatan_id === p.kecamatanId);
  if (!boleh) return { sukses: false, pesan: "Anda tidak berhak mengisi target desa ini." };

  const rincian = d.komoditas === "Padi" ? d.rincian.filter((r) => r.tanam > 0 || r.panen > 0) : [];
  const tanam = d.komoditas === "Padi" ? rincian.reduce((a, r) => a + r.tanam, 0) : d.targetTanam;
  const panen = d.komoditas === "Padi" ? rincian.reduce((a, r) => a + r.panen, 0) : d.targetPanen;

  const { data: t, error } = await s
    .from("target_desa")
    .upsert(
      {
        bulan: d.bulan,
        desa_id: d.desaId,
        komoditas: d.komoditas,
        target_tanam: tanam,
        target_panen: panen,
        luas_baku: d.luasBaku,
        ip_eksisting: 0,
        pembuat_id: p.id,
      },
      { onConflict: "bulan,desa_id,komoditas" },
    )
    .select("id")
    .single();
  if (error || !t) return { sukses: false, pesan: `Gagal menyimpan: ${error?.message ?? "ditolak database"}` };

  if (d.komoditas === "Padi") {
    const { error: eHapus } = await s.from("target_desa_rincian").delete().eq("target_desa_id", t.id);
    if (eHapus) return { sukses: false, pesan: `Gagal memperbarui rincian: ${eHapus.message}` };
    if (rincian.length > 0) {
      const { error: eSisip } = await s.from("target_desa_rincian").insert(
        rincian.map((r) => ({ target_desa_id: t.id, jenis_ltt_id: r.jenisId, target_tanam: r.tanam, target_panen: r.panen })),
      );
      if (eSisip) return { sukses: false, pesan: `Gagal menyimpan rincian: ${eSisip.message}` };
    }
  }

  revalidatePath("/ppl/target");
  revalidatePath("/bpp/target");
  return { sukses: true, pesan: `Target ${d.komoditas} ${desa.nama} tersimpan.` };
}
