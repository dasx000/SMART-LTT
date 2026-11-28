"use server";

import { wajibRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseSiap } from "@/lib/env";
import {
  kategoriValid,
  type BahanAktif,
  type GrupOpt,
  type Hasil,
  type KategoriOpt,
  type KomoditasOpsi,
  type OptOpsi,
  type ProdukTop,
} from "./jenis";

/**
 * Server Actions "Cari OPT" — membungkus RPC baca-saja di schema `taniku`.
 * Browser tidak query Supabase langsung; semua lewat sini (cek role + validasi input).
 */

const GAGAL = "Gagal memuat data. Coba lagi.";
const MAKS_QUERY = 60;

function bersihkan(q: unknown): string {
  return typeof q === "string" ? q.trim().slice(0, MAKS_QUERY) : "";
}

function idValid(x: unknown): x is number {
  return Number.isInteger(x) && (x as number) > 0;
}

async function rpc<T>(nama: string, arg: Record<string, unknown>): Promise<Hasil<T>> {
  await wajibRole("penyuluh", "admin_bpp");
  if (!supabaseSiap()) return { ok: false, pesan: "Koneksi Supabase belum aktif." };
  const s = await supabaseServer();
  const { data, error } = await s.schema("taniku").rpc(nama, arg);
  if (error) {
    console.error(`[cari-opt] ${nama}:`, error.message);
    return { ok: false, pesan: GAGAL };
  }
  return { ok: true, data: (data ?? []) as T };
}

const salahInput = { ok: false as const, pesan: "Permintaan tidak valid." };

/** Komoditas paling cocok dengan teks yang diketik (dibatasi 1 karena data komoditas banyak varian). */
export async function cariKomoditasAction(kategori: KategoriOpt, q: string): Promise<Hasil<KomoditasOpsi[]>> {
  const query = bersihkan(q);
  if (!kategoriValid(kategori) || !query) return salahInput;
  return rpc("list_komoditas_by_kategori", { p_kategori: kategori, p_query: query, p_limit: 1 });
}

/** Grup nama OPT lintas komoditas yang cocok dengan teks yang diketik. */
export async function cariGrupOptAction(kategori: KategoriOpt, q: string): Promise<Hasil<GrupOpt[]>> {
  const query = bersihkan(q);
  if (!kategoriValid(kategori) || !query) return salahInput;
  return rpc("search_opt_by_kategori", { p_kategori: kategori, p_query: query, p_limit: 10 });
}

/** Daftar OPT terdaftar untuk satu komoditas. */
export async function daftarOptAction(kategori: KategoriOpt, komoditasId: number, q: string): Promise<Hasil<OptOpsi[]>> {
  if (!kategoriValid(kategori) || !idValid(komoditasId)) return salahInput;
  return rpc("list_opt_by_komoditas", { p_komoditas_id: komoditasId, p_kategori: kategori, p_query: bersihkan(q), p_limit: 50 });
}

/** Bahan aktif untuk komoditas + OPT terpilih. */
export async function bahanAktifAction(kategori: KategoriOpt, komoditasId: number, optId: number): Promise<Hasil<BahanAktif[]>> {
  if (!kategoriValid(kategori) || !idValid(komoditasId) || !idValid(optId)) return salahInput;
  return rpc("kendali_opt_bahan_aktif", { p_komoditas_id: komoditasId, p_opt_id: optId, p_kategori: kategori });
}

/** Top 10 bahan aktif untuk grup OPT (gabungan semua komoditas). */
export async function bahanAktifGrupAction(kategori: KategoriOpt, namaKey: string): Promise<Hasil<BahanAktif[]>> {
  const key = bersihkan(namaKey);
  if (!kategoriValid(kategori) || !key) return salahInput;
  return rpc("kendali_opt_bahan_aktif_by_opt_key", { p_kategori: kategori, p_nama_key: key, p_limit: 10 });
}

/** Top 5 produk untuk komoditas + OPT terpilih. */
export async function produkTopAction(kategori: KategoriOpt, komoditasId: number, optId: number): Promise<Hasil<ProdukTop[]>> {
  if (!kategoriValid(kategori) || !idValid(komoditasId) || !idValid(optId)) return salahInput;
  return rpc("kendali_opt_produk_top", { p_komoditas_id: komoditasId, p_opt_id: optId, p_kategori: kategori, p_top_n: 5 });
}

/** Top 5 produk untuk grup OPT (gabungan semua komoditas). */
export async function produkTopGrupAction(kategori: KategoriOpt, namaKey: string): Promise<Hasil<ProdukTop[]>> {
  const key = bersihkan(namaKey);
  if (!kategoriValid(kategori) || !key) return salahInput;
  return rpc("kendali_opt_produk_top_by_opt_key", { p_kategori: kategori, p_nama_key: key, p_top_n: 5 });
}
