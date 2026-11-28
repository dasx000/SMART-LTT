/**
 * Tipe & konstanta fitur "Cari OPT" (Hama / Penyakit / Gulma).
 * Data: schema `taniku` di project Supabase bersama (sumber ap-simpel.pertanian.go.id),
 * fungsi RPC-nya dibuat oleh aplikasi TANIKU (supabase/opt-search.sql). LTT hanya membaca.
 */

export type KategoriOpt = "hama" | "penyakit" | "gulma";

export const KATEGORI_OPT: KategoriOpt[] = ["hama", "penyakit", "gulma"];

export const LABEL_KATEGORI: Record<KategoriOpt, string> = {
  hama: "Hama",
  penyakit: "Penyakit",
  gulma: "Gulma",
};

export function kategoriValid(x: unknown): x is KategoriOpt {
  return typeof x === "string" && (KATEGORI_OPT as string[]).includes(x);
}

export type KomoditasOpsi = { id: number; nama: string };

export type OptOpsi = { id: number; nama_umum: string | null; nama_latin: string | null };

/** Grup OPT hasil pencarian lintas komoditas (lihat taniku.opt_nama_key). */
export type GrupOpt = { nama_key: string; nama_umum: string | null; nama_latin: string | null; jumlah_komoditas: number };

export type BahanAktif = { nama: string; jumlah_produk: number };

export type ProdukTop = {
  produk_id: number;
  nama: string;
  perusahaan: string | null;
  jenis_pestisida: string;
  dosis: string | null;
  bahan_aktif: string | null;
  tgl_berakhir: string | null;
  berlaku: boolean;
};

/** Hasil Server Action: data atau pesan gagal (tanpa melempar error ke browser). */
export type Hasil<T> = { ok: true; data: T } | { ok: false; pesan: string };

/**
 * Daftar komoditas default sebelum pengguna mengetik (sama dengan TANIKU).
 * Per kategori karena data sumber punya banyak varian nama komoditas ("Kakao" vs "Kakao (TBM)"):
 * dipilih ID varian yang datanya paling banyak untuk kategori itu.
 */
export const KOMODITAS_DEFAULT: Record<KategoriOpt, KomoditasOpsi[]> = {
  hama: [
    { id: 2, nama: "Padi" },
    { id: 10, nama: "Jagung" },
    { id: 4, nama: "Cabai" },
    { id: 52, nama: "Kopi" },
    { id: 36, nama: "Kakao" },
    { id: 114, nama: "Terung" },
    { id: 55, nama: "Kelapa Sawit" },
    { id: 13, nama: "Karet" },
  ],
  penyakit: [
    { id: 2, nama: "Padi" },
    { id: 10, nama: "Jagung" },
    { id: 4, nama: "Cabai" },
    { id: 52, nama: "Kopi" },
    { id: 36, nama: "Kakao" },
    { id: 103, nama: "Kelapa Sawit" }, // "Pembibitan kelapa sawit"
    { id: 13, nama: "Karet" },
  ],
  gulma: [
    { id: 2, nama: "Padi" },
    { id: 10, nama: "Jagung" },
    { id: 4, nama: "Cabai" },
    { id: 39, nama: "Kopi" }, // "Budidaya kopi (TBM)"
    { id: 106, nama: "Kakao" }, // "Kakao (TBM)"
    { id: 6, nama: "Kelapa Sawit" }, // "Kelapa sawit (TBM)"
    { id: 42, nama: "Karet" }, // "Karet (TBM)"
  ],
};