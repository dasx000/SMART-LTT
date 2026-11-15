"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { wajibRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { angkaHa } from "@/lib/validasi";

const skema = z.object({
  tahun: z.coerce.number().int().min(2000).max(2100),
  bulan: z.coerce.number().int().min(1).max(12),
  targetTanam: angkaHa("Target tanam"),
});

/** Set target PM AAS kabupaten (Admin Kab) — pengganti sheet Target_PmAas_Kabupaten. */
export async function simpanTargetPmAasAction(fd: FormData): Promise<{ sukses: boolean; pesan: string }> {
  const p = await wajibRole("admin_kab");
  const cek = skema.safeParse({ tahun: fd.get("tahun"), bulan: fd.get("bulan"), targetTanam: fd.get("targetTanam") });
  if (!cek.success) return { sukses: false, pesan: cek.error.issues[0]?.message ?? "Isian tidak valid." };
  const s = await supabaseServer();
  const { error } = await s
    .from("target_pm_aas")
    .upsert({ tahun: cek.data.tahun, bulan: cek.data.bulan, target_tanam: cek.data.targetTanam, pembuat_id: p.id }, { onConflict: "tahun,bulan" });
  if (error) return { sukses: false, pesan: `Gagal menyimpan: ${error.message}` };
  revalidatePath("/kab", "layout");
  return { sukses: true, pesan: "Target PM AAS tersimpan." };
}
