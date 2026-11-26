"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { wajibRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { angkaHa } from "@/lib/validasi";

export type HasilAksi = { sukses: boolean; pesan: string };

const skema = z.object({
  tahun: z.number().int().min(2000).max(2100),
  bulan: z.number().int().min(1).max(12),
  desaId: z.number().int().positive(),
  rincian: z
    .array(z.object({ jenisId: z.number().int().positive(), tanam: angkaHa("Target tanam"), panen: angkaHa("Target panen") }))
    .max(20)
    .default([]),
});

export type InputTargetPmAas = z.input<typeof skema>;

/**
 * Simpan target PM AAS padi satu desa (tahun, bulan) — migrasi 0020, keputusan user 26 Nov 2026.
 * Total tanam/panen = jumlah rincian per jenis LTT (dihitung di server). Tanpa LBS, tanpa pembatas.
 * Hak: PPL (penyuluh / admin_bpp mode PPL) untuk DESA BINAANNYA. RLS memeriksa ulang.
 */
export async function simpanTargetPmAasAction(input: InputTargetPmAas): Promise<HasilAksi> {
  const p = await wajibRole("penyuluh", "admin_bpp");
  const cek = skema.safeParse(input);
  if (!cek.success) return { sukses: false, pesan: cek.error.issues[0]?.message ?? "Isian tidak valid." };
  const d = cek.data;

  const s = await supabaseServer();
  const [{ data: desa }, { data: binaan }] = await Promise.all([
    s.from("desa").select("id, nama").eq("id", d.desaId).maybeSingle(),
    s.from("anggota_desa").select("desa_id").eq("user_id", p.id).eq("desa_id", d.desaId).maybeSingle(),
  ]);
  if (!desa) return { sukses: false, pesan: "Desa tidak ditemukan." };
  if (!binaan) return { sukses: false, pesan: "Anda tidak berhak mengisi target desa ini." };

  const rincian = d.rincian.filter((r) => r.tanam > 0 || r.panen > 0);
  const tanam = rincian.reduce((a, r) => a + r.tanam, 0);
  const panen = rincian.reduce((a, r) => a + r.panen, 0);

  const { data: t, error } = await s
    .from("target_desa_pm_aas")
    .upsert(
      { tahun: d.tahun, bulan: d.bulan, desa_id: d.desaId, target_tanam: tanam, target_panen: panen, pembuat_id: p.id },
      { onConflict: "tahun,bulan,desa_id" },
    )
    .select("id")
    .single();
  if (error || !t) return { sukses: false, pesan: `Gagal menyimpan: ${error?.message ?? "ditolak database (cek migrasi 0020)"}` };

  const { error: eHapus } = await s.from("target_desa_pm_aas_rincian").delete().eq("target_id", t.id);
  if (eHapus) return { sukses: false, pesan: `Gagal memperbarui rincian: ${eHapus.message}` };
  if (rincian.length > 0) {
    const { error: eSisip } = await s
      .from("target_desa_pm_aas_rincian")
      .insert(rincian.map((r) => ({ target_id: t.id, jenis_ltt_id: r.jenisId, target_tanam: r.tanam, target_panen: r.panen })));
    if (eSisip) return { sukses: false, pesan: `Gagal menyimpan rincian: ${eSisip.message}` };
  }

  revalidatePath("/ppl", "layout");
  return { sukses: true, pesan: `Target PM-AAS ${desa.nama} tersimpan.` };
}
