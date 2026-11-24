import { z } from "zod";
import { parseDesimal } from "@/lib/format";

/**
 * Angka luas (Ha) dari form: menerima "1,5", "1.5", "1.234,5", kosong (= 0).
 * `z.coerce.number()` biasa menolak koma, padahal HP berbahasa Indonesia memakai koma.
 */
export const angkaHa = (label: string, maks = 100_000) =>
  z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? parseDesimal(v) : 0),
    z
      .number({ error: `${label} harus berupa angka.` })
      .refine(Number.isFinite, `${label} harus berupa angka.`)
      .min(0, `${label} tidak boleh negatif.`)
      .max(maks, `${label} terlalu besar.`),
  );

/** Pesan wajib isi Luas Baku Sawah (LBS) Padi — dipakai form & server supaya sama. */
export const PESAN_LBS_WAJIB = "Luas Baku Sawah (LBS) wajib diisi untuk target Padi. Ketik 0 bila desa tidak punya sawah.";
/** Isian kosong (belum diketik)? */
export const isianKosong = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "");
/**
 * LBS wajib DIKETIK — HANYA untuk komoditas Padi (keputusan user 24 Nov 2026): kolom kosong ditolak,
 * angka 0 boleh (tidak semua desa punya sawah). Jagung / Ubi Kayu tetap opsional (pakai `angkaHa`).
 * Kosong dicek sebelum `angkaHa` yang mengubah kosong jadi 0.
 */
export const luasBakuWajib = () =>
  z
    .unknown()
    .refine((v) => !isianKosong(v), PESAN_LBS_WAJIB)
    .pipe(angkaHa("Luas baku"));

/** Luas baku sesuai komoditas: Padi wajib diketik, lainnya opsional (kosong = 0). */
export const luasBakuSesuaiKomoditas = (komoditas: string) => (komoditas === "Padi" ? luasBakuWajib() : angkaHa("Luas baku"));
