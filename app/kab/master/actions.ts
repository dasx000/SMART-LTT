"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { wajibRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseSiap } from "@/lib/env";

export type ResponsMaster = { sukses: boolean; pesan: string };

const id = z.coerce.number().int().positive().optional();
const nama = (label: string) =>
  z.string().trim().min(2, `${label} minimal 2 huruf.`).max(80, `${label} maksimal 80 huruf.`)
    .transform((s) => s.replace(/\s+/g, " "));

const skemaKecamatan = z.object({
  id,
  kode: z.string().trim().regex(/^\d{6}$/, "Kode kecamatan harus 6 angka (kode Kemendagri, mis. 180801)."),
  nama: nama("Nama kecamatan"),
});

const skemaDesa = z.object({
  id,
  kecamatanId: z.coerce.number().int().positive("Kecamatan wajib dipilih."),
  kode: z.string().trim().regex(/^\d{10}$/, "Kode desa harus 10 angka (kode Kemendagri, mis. 1808011005)."),
  nama: nama("Nama desa"),
});

const skemaJenis = z.object({
  id,
  nama: nama("Nama jenis LTT"),
  urutan: z.coerce.number().int().min(0, "Urutan minimal 0.").max(999, "Urutan maksimal 999."),
  aktif: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

/** Ubah pesan galat database jadi kalimat yang dimengerti pengguna. */
function pesanGalat(e: { code?: string; message: string }, ganda: string): string {
  if (e.code === "23505") return ganda;
  if (e.code === "23514") return e.message.includes("diawali") ? e.message : "Isian tidak memenuhi aturan data.";
  if (e.code === "42501") return "Anda tidak berhak mengubah data master.";
  return `Gagal menyimpan: ${e.message}`;
}

function selesai(): ResponsMaster {
  // Nama wilayah / jenis tampil di hampir semua halaman
  revalidatePath("/", "layout");
  return { sukses: true, pesan: "Data master tersimpan." };
}

function ambil(fd: FormData) {
  return Object.fromEntries([...fd.entries()].map(([k, v]) => [k, typeof v === "string" && v === "" && k === "id" ? undefined : v]));
}

export async function simpanKecamatanAction(fd: FormData): Promise<ResponsMaster> {
  await wajibRole("admin_kab");
  if (!supabaseSiap()) return { sukses: false, pesan: "Koneksi Supabase belum aktif." };
  const p = skemaKecamatan.safeParse(ambil(fd));
  if (!p.success) return { sukses: false, pesan: p.error.issues[0]?.message ?? "Isian tidak valid." };
  const { id: idKec, ...isi } = p.data;

  const s = await supabaseServer();
  if (idKec) {
    // Kode kecamatan diawali oleh semua kode desanya → ganti kode hanya jika belum punya desa
    const { data: lama } = await s.from("kecamatan").select("kode").eq("id", idKec).maybeSingle();
    if (lama && lama.kode !== isi.kode) {
      const { count } = await s.from("desa").select("id", { count: "exact", head: true }).eq("kecamatan_id", idKec);
      if (count) return { sukses: false, pesan: `Kode tidak bisa diganti: kecamatan ini sudah punya ${count} desa yang kodenya diawali ${lama.kode}.` };
    }
  }
  const { data, error } = idKec
    ? await s.from("kecamatan").update(isi).eq("id", idKec).select("id")
    : await s.from("kecamatan").insert(isi).select("id");
  if (error) return { sukses: false, pesan: pesanGalat(error, "Kode atau nama kecamatan sudah dipakai.") };
  if (!data?.length) return { sukses: false, pesan: "Tidak ada data yang berubah (data tidak ditemukan atau tidak berhak)." };
  return selesai();
}

export async function simpanDesaAction(fd: FormData): Promise<ResponsMaster> {
  await wajibRole("admin_kab");
  if (!supabaseSiap()) return { sukses: false, pesan: "Koneksi Supabase belum aktif." };
  const p = skemaDesa.safeParse(ambil(fd));
  if (!p.success) return { sukses: false, pesan: p.error.issues[0]?.message ?? "Isian tidak valid." };
  const { id: idDesa, kecamatanId, ...isi } = p.data;

  const s = await supabaseServer();
  const { data: kec } = await s.from("kecamatan").select("kode").eq("id", kecamatanId).maybeSingle();
  if (!kec) return { sukses: false, pesan: "Kecamatan tidak ditemukan." };
  if (!isi.kode.startsWith(kec.kode)) return { sukses: false, pesan: `Kode desa harus diawali kode kecamatannya (${kec.kode}).` };

  const baris = { ...isi, kecamatan_id: kecamatanId };
  const { data, error } = idDesa
    ? await s.from("desa").update(baris).eq("id", idDesa).select("id")
    : await s.from("desa").insert(baris).select("id");
  if (error) return { sukses: false, pesan: pesanGalat(error, "Kode desa sudah dipakai, atau nama desa sudah ada di kecamatan itu.") };
  if (!data?.length) return { sukses: false, pesan: "Tidak ada data yang berubah (data tidak ditemukan atau tidak berhak)." };
  return selesai();
}

/** Jenis LTT padi. Jagung & Ubi Kayu hanya punya satu jenis ("LTT") yang dipakai sistem, jadi tidak dikelola di sini. */
export async function simpanJenisLttAction(fd: FormData): Promise<ResponsMaster> {
  await wajibRole("admin_kab");
  if (!supabaseSiap()) return { sukses: false, pesan: "Koneksi Supabase belum aktif." };
  const p = skemaJenis.safeParse(ambil(fd));
  if (!p.success) return { sukses: false, pesan: p.error.issues[0]?.message ?? "Isian tidak valid." };
  const { id: idJenis, ...isi } = p.data;

  const s = await supabaseServer();
  const { data, error } = idJenis
    ? await s.from("jenis_ltt").update(isi).eq("id", idJenis).eq("komoditas", "Padi").select("id")
    : await s.from("jenis_ltt").insert({ ...isi, komoditas: "Padi" }).select("id");
  if (error) return { sukses: false, pesan: pesanGalat(error, "Nama jenis LTT padi itu sudah ada.") };
  if (!data?.length) return { sukses: false, pesan: "Tidak ada data yang berubah (data tidak ditemukan atau tidak berhak)." };
  return selesai();
}
