"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { wajibRole, type Pengguna } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { angkaHa, luasBakuSesuaiKomoditas } from "@/lib/validasi";

export type HasilAksi = { sukses: boolean; pesan: string };

const skemaPeriode = z.object({
  tahun: z.number().int().min(2000).max(2100),
  bulan: z.number().int().min(1).max(12),
  desaId: z.number().int().positive(),
  komoditas: z.enum(["Padi", "Jagung", "Ubi Kayu"]),
});

const skema = skemaPeriode.extend({
  targetTanam: angkaHa("Target tanam"),
  targetPanen: angkaHa("Target panen"),
  /** divalidasi setelah komoditas diketahui (wajib hanya Padi) */
  luasBaku: z.unknown(),
  rincian: z
    .array(z.object({ jenisId: z.number().int().positive(), tanam: angkaHa("Target tanam"), panen: angkaHa("Target panen") }))
    .max(20)
    .default([]),
});

export type InputTargetDesaAdmin = z.input<typeof skema>;

type Supa = Awaited<ReturnType<typeof supabaseServer>>;

/** Admin Kab: semua desa. Admin BPP: hanya desa di kecamatannya. RLS (migrasi 0019) memeriksa ulang. */
async function cekHakDesa(s: Supa, p: Pengguna, desaId: number): Promise<{ nama: string } | string> {
  const { data: desa } = await s.from("desa").select("id, nama, kecamatan_id").eq("id", desaId).maybeSingle();
  if (!desa) return "Desa tidak ditemukan.";
  if (p.role === "admin_bpp" && desa.kecamatan_id !== p.kecamatanId) return "Desa ini di luar kecamatan Anda.";
  return { nama: desa.nama };
}

function segarkan() {
  revalidatePath("/kab", "layout");
  revalidatePath("/bpp", "layout");
  revalidatePath("/ppl", "layout");
}

/**
 * Simpan target satu desa (tahun, bulan, komoditas) dari menu Admin Kab / BPP.
 * Padi: total = jumlah rincian per jenis (dihitung di server). Menimpa isian sebelumnya (termasuk isian PPL).
 */
export async function simpanTargetDesaAdminAction(input: InputTargetDesaAdmin): Promise<HasilAksi> {
  const p = await wajibRole("admin_kab", "admin_bpp");
  const cek = skema.safeParse(input);
  if (!cek.success) return { sukses: false, pesan: cek.error.issues[0]?.message ?? "Isian tidak valid." };
  const d = cek.data;
  const lbs = luasBakuSesuaiKomoditas(d.komoditas).safeParse(d.luasBaku);
  if (!lbs.success) return { sukses: false, pesan: lbs.error.issues[0]?.message ?? "Luas baku tidak valid." };

  const s = await supabaseServer();
  const hak = await cekHakDesa(s, p, d.desaId);
  if (typeof hak === "string") return { sukses: false, pesan: hak };

  const rincian = d.komoditas === "Padi" ? d.rincian.filter((r) => r.tanam > 0 || r.panen > 0) : [];
  const tanam = d.komoditas === "Padi" ? rincian.reduce((a, r) => a + r.tanam, 0) : d.targetTanam;
  const panen = d.komoditas === "Padi" ? rincian.reduce((a, r) => a + r.panen, 0) : d.targetPanen;

  const { data: t, error } = await s
    .from("target_desa")
    .upsert(
      {
        tahun: d.tahun,
        bulan: d.bulan,
        desa_id: d.desaId,
        komoditas: d.komoditas,
        target_tanam: tanam,
        target_panen: panen,
        luas_baku: lbs.data,
        ip_eksisting: 0,
        pembuat_id: p.id,
      },
      { onConflict: "tahun,bulan,desa_id,komoditas" },
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

  segarkan();
  return { sukses: true, pesan: `Target ${d.komoditas} ${hak.nama} tersimpan.` };
}

/** Hapus target satu desa (desa kembali berstatus "Belum diisi"). Rincian ikut terhapus (on delete cascade / manual). */
export async function hapusTargetDesaAdminAction(input: z.input<typeof skemaPeriode>): Promise<HasilAksi> {
  const p = await wajibRole("admin_kab", "admin_bpp");
  const cek = skemaPeriode.safeParse(input);
  if (!cek.success) return { sukses: false, pesan: "Data tidak valid." };
  const d = cek.data;

  const s = await supabaseServer();
  const hak = await cekHakDesa(s, p, d.desaId);
  if (typeof hak === "string") return { sukses: false, pesan: hak };

  const { data: t } = await s
    .from("target_desa")
    .select("id")
    .eq("tahun", d.tahun)
    .eq("bulan", d.bulan)
    .eq("desa_id", d.desaId)
    .eq("komoditas", d.komoditas)
    .maybeSingle();
  if (!t) return { sukses: false, pesan: "Target sudah tidak ada." };

  const { error: eR } = await s.from("target_desa_rincian").delete().eq("target_desa_id", t.id);
  if (eR) return { sukses: false, pesan: `Gagal menghapus rincian: ${eR.message}` };
  const { error, count } = await s.from("target_desa").delete({ count: "exact" }).eq("id", t.id);
  if (error) return { sukses: false, pesan: `Gagal menghapus: ${error.message}` };
  if (!count) return { sukses: false, pesan: "Gagal menghapus: ditolak database (cek migrasi 0019)." };

  segarkan();
  return { sukses: true, pesan: `Target ${d.komoditas} ${hak.nama} dihapus.` };
}
