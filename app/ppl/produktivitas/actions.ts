"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { wajibRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { angkaHa } from "@/lib/validasi";
import type { HasilAksi } from "@/app/ppl/target/actions";

/**
 * Produktivitas & sarana (logika-bisnis §20): hanya penyuluh/admin_bpp, hanya DESA BINAAN sendiri
 * (dicek di sini dan oleh RLS). Produktivitas ton/ha 0–100 (cegah salah satuan kg/ha), kosong = 0.
 */

async function cekBinaan(desaId: number) {
  const p = await wajibRole("penyuluh", "admin_bpp");
  const s = await supabaseServer();
  const { data } = await s.from("anggota_desa").select("desa_id").eq("user_id", p.id).eq("desa_id", desaId).maybeSingle();
  return { p, s, boleh: Boolean(data) };
}

const skemaProdDesa = z.object({
  tahun: z.number().int().min(2000).max(2100),
  desaId: z.number().int().positive(),
  nilai: z.object({
    Padi: z.array(angkaHa("Produktivitas Padi", 100)).length(12),
    Jagung: z.array(angkaHa("Produktivitas Jagung", 100)).length(12),
    "Ubi Kayu": z.array(angkaHa("Produktivitas Ubi Kayu", 100)).length(12),
  }),
});

/** Simpan 12 bulan × 3 komoditas satu desa sekaligus (tampilan tabel ala GAS lama). */
export async function simpanProduktivitasDesaAction(input: z.input<typeof skemaProdDesa>): Promise<HasilAksi> {
  const cek = skemaProdDesa.safeParse(input);
  if (!cek.success) {
    const i = cek.error.issues[0];
    const bulan = typeof i?.path[2] === "number" ? ` (bulan ke-${i.path[2] + 1})` : "";
    return { sukses: false, pesan: `${i?.message ?? "Isian tidak valid."}${bulan} Maksimal 100 ton/ha.` };
  }
  const d = cek.data;
  const { p, s, boleh } = await cekBinaan(d.desaId);
  if (!boleh) return { sukses: false, pesan: "Hanya desa binaan Anda yang boleh diisi." };

  const baris = (Object.keys(d.nilai) as (keyof typeof d.nilai)[]).flatMap((kom) =>
    d.nilai[kom].map((v, i) => ({ tahun: d.tahun, bulan: i + 1, desa_id: d.desaId, komoditas: kom, nilai: v, penginput_id: p.id })),
  );
  const { error } = await s.from("produktivitas_desa").upsert(baris, { onConflict: "tahun,bulan,desa_id,komoditas" });
  if (error) return { sukses: false, pesan: `Gagal menyimpan: ${error.message}` };
  revalidatePath("/ppl/produktivitas");
  return { sukses: true, pesan: `Produktivitas ${d.tahun} tersimpan.` };
}

const bulat = (label: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : Number(String(v).trim())),
    z.number({ error: `${label} harus angka.` }).int(`${label} harus bilangan bulat.`).min(0, `${label} tidak boleh negatif.`).max(10_000),
  );

const skemaSarana = z.object({
  desaId: z.number().int().positive(),
  gudang_gabah: bulat("Gudang gabah"),
  embung: bulat("Embung"),
  lantai_jemur: bulat("Lantai jemur"),
  mesin_pengering: bulat("Mesin pengering"),
});

export async function simpanSaranaAction(input: z.input<typeof skemaSarana>): Promise<HasilAksi> {
  const cek = skemaSarana.safeParse(input);
  if (!cek.success) return { sukses: false, pesan: cek.error.issues[0]?.message ?? "Isian tidak valid." };
  const { desaId, ...nilai } = cek.data;
  const { p, s, boleh } = await cekBinaan(desaId);
  if (!boleh) return { sukses: false, pesan: "Hanya desa binaan Anda yang boleh diisi." };

  // 0 tetap disimpan (beda dengan "belum diisi")
  const { error } = await s.from("sarana_desa").upsert({ desa_id: desaId, ...nilai, penginput_id: p.id }, { onConflict: "desa_id" });
  if (error) return { sukses: false, pesan: `Gagal menyimpan: ${error.message}` };
  revalidatePath("/ppl/produktivitas");
  return { sukses: true, pesan: "Data sarana tersimpan." };
}
