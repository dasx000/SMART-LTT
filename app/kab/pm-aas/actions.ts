"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { wajibRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { angkaHa } from "@/lib/validasi";

const skemaPeriode = z.object({
  tahun: z.coerce.number().int().min(2000).max(2100),
  bulan: z.coerce.number().int().min(1).max(12),
});
const skemaTarget = angkaHa("Target tanam");

/**
 * Set target (kesanggupan tanam) PM AAS per kecamatan untuk satu bulan (Admin Kab).
 * Field form: `kec_<id>` = target Ha. Kosong/0 → baris kecamatan itu dihapus.
 * Target kabupaten = jumlah target kecamatan (lihat `ambilTargetPmAasRinci`).
 */
export async function simpanTargetPmAasAction(fd: FormData): Promise<{ sukses: boolean; pesan: string }> {
  const p = await wajibRole("admin_kab");
  const per = skemaPeriode.safeParse({ tahun: fd.get("tahun"), bulan: fd.get("bulan") });
  if (!per.success) return { sukses: false, pesan: "Periode tidak valid." };
  const { tahun, bulan } = per.data;

  const isi: { tahun: number; bulan: number; kecamatan_id: number; target_tanam: number; pembuat_id: string }[] = [];
  const kosong: number[] = [];
  for (const [k, v] of fd.entries()) {
    const m = /^kec_(\d+)$/.exec(k);
    if (!m) continue;
    const cek = skemaTarget.safeParse(v);
    if (!cek.success) return { sukses: false, pesan: cek.error.issues[0]?.message ?? "Isian tidak valid." };
    const id = Number(m[1]);
    if (cek.data > 0) isi.push({ tahun, bulan, kecamatan_id: id, target_tanam: cek.data, pembuat_id: p.id });
    else kosong.push(id);
  }

  const s = await supabaseServer();
  if (isi.length) {
    const { error } = await s.from("target_pm_aas_kecamatan").upsert(isi, { onConflict: "tahun,bulan,kecamatan_id" });
    if (error) return { sukses: false, pesan: `Gagal menyimpan: ${error.message}` };
  }
  if (kosong.length) {
    const { error } = await s.from("target_pm_aas_kecamatan").delete().eq("tahun", tahun).eq("bulan", bulan).in("kecamatan_id", kosong);
    if (error) return { sukses: false, pesan: `Gagal menyimpan: ${error.message}` };
  }
  revalidatePath("/kab", "layout");
  return { sukses: true, pesan: "Target PM AAS per kecamatan tersimpan." };
}
