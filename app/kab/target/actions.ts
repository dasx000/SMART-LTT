"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { wajibRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { angkaHa } from "@/lib/validasi";

const skemaPeriode = z.object({
  tahun: z.coerce.number().int().min(2000).max(2100),
  bulan: z.coerce.number().int().min(1).max(12),
  komoditas: z.enum(["Padi", "Jagung", "Ubi Kayu"]),
});
const skemaTanam = angkaHa("Target tanam");
const skemaPanen = angkaHa("Target panen");

/**
 * Simpan Target Provinsi per kecamatan untuk satu (tahun, bulan, komoditas) — Admin Kab.
 * Field form: `tanam_<kecId>`, `panen_<kecId>`. Keduanya kosong/0 → baris kecamatan itu dihapus.
 */
export async function simpanTargetProvinsiAction(fd: FormData): Promise<{ sukses: boolean; pesan: string }> {
  const p = await wajibRole("admin_kab");
  const per = skemaPeriode.safeParse({ tahun: fd.get("tahun"), bulan: fd.get("bulan"), komoditas: fd.get("komoditas") });
  if (!per.success) return { sukses: false, pesan: "Periode atau komoditas tidak valid." };
  const { tahun, bulan, komoditas } = per.data;

  const ids = new Set<number>();
  for (const k of fd.keys()) {
    const m = /^(?:tanam|panen)_(\d+)$/.exec(k);
    if (m) ids.add(Number(m[1]));
  }

  const isi: { tahun: number; bulan: number; kecamatan_id: number; komoditas: string; target_tanam: number; target_panen: number; pembuat_id: string }[] = [];
  const kosong: number[] = [];
  for (const id of ids) {
    const t = skemaTanam.safeParse(fd.get(`tanam_${id}`) ?? "");
    if (!t.success) return { sukses: false, pesan: t.error.issues[0]?.message ?? "Isian tidak valid." };
    const pn = skemaPanen.safeParse(fd.get(`panen_${id}`) ?? "");
    if (!pn.success) return { sukses: false, pesan: pn.error.issues[0]?.message ?? "Isian tidak valid." };
    if (t.data > 0 || pn.data > 0) {
      isi.push({ tahun, bulan, kecamatan_id: id, komoditas, target_tanam: t.data, target_panen: pn.data, pembuat_id: p.id });
    } else kosong.push(id);
  }

  const s = await supabaseServer();
  if (isi.length) {
    const { error } = await s.from("target_provinsi").upsert(isi, { onConflict: "tahun,bulan,kecamatan_id,komoditas" });
    if (error) return { sukses: false, pesan: `Gagal menyimpan: ${error.message}` };
  }
  if (kosong.length) {
    const { error } = await s
      .from("target_provinsi")
      .delete()
      .eq("tahun", tahun)
      .eq("bulan", bulan)
      .eq("komoditas", komoditas)
      .in("kecamatan_id", kosong);
    if (error) return { sukses: false, pesan: `Gagal menyimpan: ${error.message}` };
  }
  revalidatePath("/kab", "layout");
  revalidatePath("/bpp", "layout");
  return { sukses: true, pesan: `Target Provinsi ${komoditas} tersimpan.` };
}
